-- =============================================
-- 早鳥截止日由 2026-12-31 延至 2027-12-31（Asia/Taipei）
-- 對應技術規格 v5 第一節 8.、營運文件第二節 8.
-- 執行前請先備份，或先在測試專案驗證
-- =============================================

BEGIN;

-- 註冊判定：截止日與早鳥到期日改為 2027-12-31
CREATE OR REPLACE FUNCTION register_line_user(
  p_line_user_id text,
  p_display_name text,
  p_avatar_url text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_is_early boolean := false;
  v_cnt int;
  v_now timestamptz := timezone('utc', now());
  v_trial_end timestamptz;
  v_taipei_today date;
BEGIN
  SELECT * INTO v_user
  FROM users
  WHERE line_user_id = p_line_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_user.status = 'cancelled' THEN
      -- 再登入：一律一般 30 天試用，不再發早鳥
      UPDATE users SET
        display_name = p_display_name,
        avatar_url = p_avatar_url,
        status = 'trial',
        is_early_bird = false,
        auto_renew = true,
        trial_start_at = v_now,
        trial_end_at = v_now + interval '30 days',
        word_count = 0,
        first_paid_at = NULL,
        next_billing_at = NULL,
        payment_failed_at = NULL,
        grace_period_end_at = NULL,
        suspended_at = NULL,
        data_purge_scheduled_at = NULL,
        last_reminder_sent_at = NULL,
        cancelled_at = NULL,
        current_streak = 0,
        longest_streak = 0,
        last_streak_date = NULL,
        streak_frozen_at = NULL,
        updated_at = v_now
      WHERE id = v_user.id
      RETURNING * INTO v_user;
      RETURN row_to_json(v_user);
    END IF;

    UPDATE users SET
      display_name = p_display_name,
      avatar_url = p_avatar_url,
      updated_at = v_now
    WHERE id = v_user.id
    RETURNING * INTO v_user;
    RETURN row_to_json(v_user);
  END IF;

  -- 新註冊：advisory lock 避免早鳥超收；cancelled 不佔名額
  PERFORM pg_advisory_xact_lock(87001100);

  v_taipei_today := (timezone('Asia/Taipei', v_now))::date;
  IF v_taipei_today <= DATE '2027-12-31' THEN
    SELECT COUNT(*)::int INTO v_cnt
    FROM users
    WHERE is_early_bird = true
      AND status <> 'cancelled';
    IF v_cnt < 100 THEN
      v_is_early := true;
    END IF;
  END IF;

  IF v_is_early THEN
    v_trial_end := timezone('Asia/Taipei', timestamp '2027-12-31 23:59:59');
  ELSE
    v_trial_end := v_now + interval '30 days';
  END IF;

  INSERT INTO users (
    line_user_id,
    display_name,
    avatar_url,
    status,
    is_early_bird,
    auto_renew,
    trial_start_at,
    trial_end_at,
    word_count
  ) VALUES (
    p_line_user_id,
    p_display_name,
    p_avatar_url,
    'trial',
    v_is_early,
    true,
    v_now,
    v_trial_end,
    0
  )
  RETURNING * INTO v_user;

  RETURN row_to_json(v_user);
END;
$$;

REVOKE EXECUTE ON FUNCTION register_line_user(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_line_user(text, text, text) TO service_role;

-- 既有早鳥使用者一併延後（目前尚未到 2026-12-31，不會有已暫停的早鳥）
UPDATE users
SET trial_end_at = timezone('Asia/Taipei', timestamp '2027-12-31 23:59:59')
WHERE is_early_bird = true
  AND status = 'trial';

COMMIT;
