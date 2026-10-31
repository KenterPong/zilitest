-- =============================================
-- 單字例句（技術規格 v5 第三節 2.、第十節 3.、8.）＋ question_type 統一為英文代碼（第五節 2.）
-- 1. words 新增 7 個 example_* 欄位（皆可為 NULL），不改動既有單字
-- 2. ai_extractions.kind 允許 generate_examples（AI 補例句）
-- 3. quiz_sessions.question_type：中文值改為英文代碼，並允許三個例句題型
-- 4. get_language_words() 一併回傳例句欄位（單字卡冊顯示用）
--
-- ⚠️ 套用順序：新 CHECK 不接受中文值、舊程式也寫不進英文代碼，
--    執行後須立即部署新程式，中間不要用正式站或本機舊程式開測驗。執行前先備份。
-- 不新增帶 user_id 的資料表，delete_account() 不需修改
-- =============================================

BEGIN;

-- 1. 例句欄位
ALTER TABLE words ADD COLUMN IF NOT EXISTS example TEXT;
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_translation TEXT;
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_source TEXT;
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_target TEXT;
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_chunks JSONB;
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_tts TEXT;
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_updated_at TIMESTAMPTZ;

ALTER TABLE words DROP CONSTRAINT IF EXISTS words_example_source_check;
ALTER TABLE words ADD CONSTRAINT words_example_source_check
  CHECK (example_source IN ('original', 'generated'));

-- 2. AI 補例句計次
ALTER TABLE ai_extractions DROP CONSTRAINT IF EXISTS ai_extractions_kind_check;
ALTER TABLE ai_extractions ADD CONSTRAINT ai_extractions_kind_check
  CHECK (kind IN ('extract', 'transcribe_image', 'generate_examples'));

-- 3. question_type：移除舊 CHECK → 中文值改英文代碼 → 加上新 CHECK
ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_question_type_check;

UPDATE quiz_sessions SET question_type = 'tf'     WHERE question_type = '是非題';
UPDATE quiz_sessions SET question_type = 'choice' WHERE question_type = '選擇題';
UPDATE quiz_sessions SET question_type = 'input'  WHERE question_type = '輸入題';

ALTER TABLE quiz_sessions ADD CONSTRAINT quiz_sessions_question_type_check
  CHECK (question_type IN ('tf', 'choice', 'input', 'mixed', 'example_choice', 'example_tf', 'example_reorder'));

-- 4. 某語言全部單字＋熟練度，加回傳例句（詞塊只在重組時另外查詢，不放這裡）
CREATE OR REPLACE FUNCTION get_language_words(p_user_id uuid, p_language text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(t), '[]'::json)
  FROM (
    SELECT
      w.id,
      w.term,
      w.reading,
      w.pronunciation,
      w.answer,
      w.description,
      w.example,
      w.example_translation,
      w.example_source,
      w.example_target,
      w.example_tts,
      w.created_at,
      b.created_at AS wordbook_created_at,
      COALESCE(p.stage, 0) AS stage,
      p.due_date,
      COALESCE(p.lapse_count, 0) AS lapse_count,
      p.introduced_at,
      p.last_reviewed_date,
      p.mastered_at
    FROM words w
    JOIN wordbooks b ON b.id = w.wordbook_id
    LEFT JOIN word_progress p ON p.word_id = w.id
    WHERE b.user_id = p_user_id
      AND b.language = p_language
  ) t;
$$;

REVOKE EXECUTE ON FUNCTION get_language_words(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_language_words(uuid, text) TO service_role;

COMMIT;
