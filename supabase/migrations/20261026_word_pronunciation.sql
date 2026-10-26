-- =============================================
-- 發音標註：英文 IPA 音標、韓文羅馬拼音由系統於寫入單字時產生；日文第二層沿用 reading
-- 對應技術規格 v5 第十三節
-- 只新增欄位（皆有預設值或可為 NULL），不改動既有資料；既有單字由 scripts/backfill-pronunciation.ts 補齊
-- =============================================

BEGIN;

ALTER TABLE words ADD COLUMN IF NOT EXISTS pronunciation TEXT;

ALTER TABLE user_language_settings
  ADD COLUMN IF NOT EXISTS show_pronunciation BOOLEAN NOT NULL DEFAULT true;

-- 每日任務取字時一併回傳發音標註（卡片第二層顯示用）
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
