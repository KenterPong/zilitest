-- =============================================
-- 小遊戲成績（技術規格 v5 第十二節）；刪除帳號一併清除
-- 只新增資料表與更新函式，不改動既有資料
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS game_scores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game        TEXT NOT NULL CHECK (game IN ('match', 'listen', 'spell')),
  language    TEXT NOT NULL CHECK (language IN ('en', 'ja', 'ko')),
  word_count  INTEGER NOT NULL CHECK (word_count > 0),
  score       INTEGER NOT NULL CHECK (score >= 0),
  mistakes    INTEGER NOT NULL DEFAULT 0 CHECK (mistakes >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_scores_user_game_idx ON game_scores (user_id, game, language);

REVOKE ALL ON TABLE game_scores FROM anon, authenticated;
GRANT ALL ON TABLE game_scores TO service_role;

-- 刪除帳號時一併清除遊戲成績
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
  DELETE FROM game_scores WHERE user_id = p_user_id;

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
