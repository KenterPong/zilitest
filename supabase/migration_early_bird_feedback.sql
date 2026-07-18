-- =============================================
-- 既有專案升級：早鳥 + 回饋（在 SQL Editor 執行一次）
-- =============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_early_bird BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_early_bird_active_idx ON users (is_early_bird)
  WHERE is_early_bird = true AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feedback_content_len CHECK (char_length(content) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback (user_id);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);

REVOKE ALL ON TABLE feedback FROM anon, authenticated;
GRANT ALL ON TABLE feedback TO service_role;

-- LINE 註冊／登入（含早鳥名額原子判定）
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

  PERFORM pg_advisory_xact_lock(87001100);

  v_taipei_today := (timezone('Asia/Taipei', v_now))::date;
  IF v_taipei_today <= DATE '2026-12-31' THEN
    SELECT COUNT(*)::int INTO v_cnt
    FROM users
    WHERE is_early_bird = true
      AND status <> 'cancelled';
    IF v_cnt < 100 THEN
      v_is_early := true;
    END IF;
  END IF;

  IF v_is_early THEN
    v_trial_end := timezone('Asia/Taipei', timestamp '2026-12-31 23:59:59');
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

GRANT EXECUTE ON FUNCTION register_line_user(text, text, text) TO service_role;

-- 既有試用帳號補發早鳥（依註冊時間，補足至 100 名；排除 cancelled）
WITH existing_count AS (
  SELECT COUNT(*)::int AS cnt
  FROM users
  WHERE is_early_bird = true
    AND status <> 'cancelled'
),
ranked AS (
  SELECT
    u.id,
    ROW_NUMBER() OVER (ORDER BY u.created_at ASC) AS rn
  FROM users u
  WHERE u.status <> 'cancelled'
    AND u.is_early_bird = false
    AND (timezone('Asia/Taipei', now()))::date <= DATE '2026-12-31'
)
UPDATE users u
SET
  is_early_bird = true,
  trial_end_at = timezone('Asia/Taipei', timestamp '2026-12-31 23:59:59'),
  updated_at = now()
FROM ranked r
CROSS JOIN existing_count e
WHERE u.id = r.id
  AND e.cnt < 100
  AND r.rn <= (100 - e.cnt);
