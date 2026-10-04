-- =============================================
-- 帳號狀態機：刪除帳號、暫停期滿清除、付費恢復時解除成長凍結
-- 對應技術規格 v5 第一節 2.、7.、第二節 3.1、第九節 4.
-- 只新增函式，不修改資料表與既有資料
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 刪除帳號：立即清空所有資料（含改善建議），users 列保留供登入識別
-- 同一 LINE 帳號再登入時由 register_line_user 視為全新帳號
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 暫停滿 3 個月的帳號清除資料（目前手動執行：SELECT purge_expired_accounts();）
-- 回傳本次清除的帳號數
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION purge_expired_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM users
    WHERE status = 'suspended'
      AND data_purge_scheduled_at IS NOT NULL
      AND data_purge_scheduled_at <= now()
    FOR UPDATE
  LOOP
    PERFORM delete_account(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------
-- 付費恢復時解除成長資料凍結（第九節 4.）：連續天數與複習排程順延 p_days 天
-- 狀態改為 active 由付款流程負責（待 LINE Pay 串接）
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION unfreeze_growth(p_user_id uuid, p_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET
    last_streak_date = last_streak_date + p_days,
    streak_frozen_at = NULL
  WHERE id = p_user_id;

  UPDATE word_progress SET due_date = due_date + p_days
  WHERE user_id = p_user_id AND due_date IS NOT NULL;
END;
$$;

-- ---------------------------------------------
-- 權限
-- ---------------------------------------------
REVOKE EXECUTE ON FUNCTION delete_account(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION purge_expired_accounts()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION unfreeze_growth(uuid, integer)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_account(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION purge_expired_accounts()        TO service_role;
GRANT EXECUTE ON FUNCTION unfreeze_growth(uuid, integer)  TO service_role;

COMMIT;
