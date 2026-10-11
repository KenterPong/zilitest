-- =============================================
-- AI 抽字（技術規格 v5 第十節）：等級設定、抽字紀錄；刪除帳號一併清除紀錄
-- 只新增欄位與資料表，不改動既有資料
-- =============================================

BEGIN;

ALTER TABLE user_language_settings ADD COLUMN IF NOT EXISTS extract_level TEXT;

CREATE TABLE IF NOT EXISTS ai_extractions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wordbook_id   UUID REFERENCES wordbooks(id) ON DELETE SET NULL,
  language      TEXT NOT NULL CHECK (language IN ('en', 'ja', 'ko')),
  level         TEXT NOT NULL,
  input_length  INTEGER NOT NULL,
  result_count  INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_extractions_user_created_idx ON ai_extractions (user_id, created_at);

REVOKE ALL ON TABLE ai_extractions FROM anon, authenticated;
GRANT ALL ON TABLE ai_extractions TO service_role;

-- 刪除帳號時一併清除抽字紀錄
CREATE OR REPLACE FUNCTION delete_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 單字本 → 單字 → 標籤關聯、統計、卡牌、熟練度、作答紀錄（皆 ON DELETE CASCADE）
  DELETE FROM wordbooks WHERE user_id = p_user_id;
  DELETE FROM tags WHERE user_id = p_user_id;
  DELETE FROM quiz_sessions WHERE user_id = p_user_id;
  DELETE FROM daily_tasks WHERE user_id = p_user_id;
  DELETE FROM user_achievements WHERE user_id = p_user_id;
  DELETE FROM user_language_settings WHERE user_id = p_user_id;
  DELETE FROM word_progress WHERE user_id = p_user_id;
  DELETE FROM word_stats WHERE user_id = p_user_id;
  DELETE FROM card_familiarity WHERE user_id = p_user_id;
  DELETE FROM feedback WHERE user_id = p_user_id;
  DELETE FROM ai_extractions WHERE user_id = p_user_id;

  UPDATE users SET
    status = 'cancelled',
    cancelled_at = now(),
    email = NULL,
    word_count = 0,
    current_streak = 0,
    longest_streak = 0,
    last_streak_date = NULL,
    streak_frozen_at = NULL
  WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_account(uuid) TO service_role;

COMMIT;
