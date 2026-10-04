-- =============================================
-- 單字讀音（選填）：日文漢字單字的假名讀音，填空題輸入寫法或讀音皆算正確
-- 對應技術規格 v5 第三節 2.、第四節、第五節 8.
-- 只新增可為 NULL 的欄位，不改動既有資料
-- =============================================

BEGIN;

ALTER TABLE words ADD COLUMN IF NOT EXISTS reading TEXT;

-- 每日任務取字時一併回傳讀音（新字卡片顯示用）
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
