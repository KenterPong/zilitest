-- =============================================
-- v5 第一階段：單字本語言、每日任務、熟練度、成長系統
-- 對應技術規格 v5 第三節 1.、第五節 2.、第八節、第九節
-- 執行前請先備份，或先在測試專案驗證
-- 只新增欄位與資料表，不刪除、不改寫既有資料
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 單字本語言（建立後不可變更，由 API 控制）
-- 既有單字本若存在，SET NOT NULL 會失敗並整批回滾，不會寫入錯誤的語言
-- ---------------------------------------------
ALTER TABLE wordbooks ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE wordbooks ALTER COLUMN language SET NOT NULL;
ALTER TABLE wordbooks DROP CONSTRAINT IF EXISTS wordbooks_language_check;
ALTER TABLE wordbooks ADD CONSTRAINT wordbooks_language_check
  CHECK (language IN ('en', 'ja', 'ko'));

CREATE INDEX IF NOT EXISTS wordbooks_user_language_idx ON wordbooks (user_id, language);

-- ---------------------------------------------
-- 使用者連續天數
-- ---------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_streak_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_frozen_at TIMESTAMPTZ;

-- ---------------------------------------------
-- 使用者語言設定
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS user_language_settings (
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language             TEXT NOT NULL CHECK (language IN ('en', 'ja', 'ko')),
  enabled              BOOLEAN NOT NULL DEFAULT true,
  daily_review_limit   INTEGER NOT NULL DEFAULT 30 CHECK (daily_review_limit >= 0),
  daily_new_limit      INTEGER NOT NULL DEFAULT 5 CHECK (daily_new_limit >= 0),
  peak_mastered_count  INTEGER NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, language)
);

DROP TRIGGER IF EXISTS user_language_settings_updated_at ON user_language_settings;
CREATE TRIGGER user_language_settings_updated_at
  BEFORE UPDATE ON user_language_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------
-- 熟練度與複習排程（無 row 視同 stage = 0）
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS word_progress (
  word_id             UUID PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage               INTEGER NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 7),
  due_date            DATE,
  introduced_at       TIMESTAMPTZ,
  last_reviewed_date  DATE,
  lapse_count         INTEGER NOT NULL DEFAULT 0,
  mastered_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS word_progress_user_due_idx ON word_progress (user_id, due_date);

-- ---------------------------------------------
-- 每日任務
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS daily_tasks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_date        DATE NOT NULL,
  language         TEXT NOT NULL CHECK (language IN ('en', 'ja', 'ko')),
  review_word_ids  UUID[] NOT NULL DEFAULT '{}',
  new_word_ids     UUID[] NOT NULL DEFAULT '{}',
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, task_date, language)
);

-- ---------------------------------------------
-- 成就（定義寫在程式碼常數；解鎖永不收回）
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key  TEXT NOT NULL,
  unlocked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_key)
);

-- ---------------------------------------------
-- 測驗場次：模式與每日任務關聯
-- ---------------------------------------------
ALTER TABLE quiz_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'free_practice';
ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_mode_check;
ALTER TABLE quiz_sessions ADD CONSTRAINT quiz_sessions_mode_check
  CHECK (mode IN ('daily_task', 'free_practice'));

ALTER TABLE quiz_sessions
  ADD COLUMN IF NOT EXISTS daily_task_id UUID REFERENCES daily_tasks(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quiz_sessions_daily_task_idx ON quiz_sessions (daily_task_id)
  WHERE daily_task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_session_word_idx ON quiz_answers (session_id, word_id);

ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_question_type_check;
ALTER TABLE quiz_sessions ADD CONSTRAINT quiz_sessions_question_type_check
  CHECK (question_type IN ('是非題', '選擇題', '輸入題', 'mixed'));

-- ---------------------------------------------
-- LINE 註冊／登入：cancelled 再登入時一併重置連續天數欄位
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 建立單字本（同時建立該語言設定）
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION create_wordbook(
  p_user_id uuid,
  p_name text,
  p_language text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book wordbooks%ROWTYPE;
BEGIN
  INSERT INTO user_language_settings (user_id, language)
  VALUES (p_user_id, p_language)
  ON CONFLICT (user_id, language) DO NOTHING;

  INSERT INTO wordbooks (user_id, name, language)
  VALUES (p_user_id, p_name, p_language)
  RETURNING * INTO v_book;

  RETURN row_to_json(v_book);
END;
$$;

-- ---------------------------------------------
-- 某語言全部單字＋熟練度（每日任務產生、干擾項用）
-- 回傳單一 json，不受 PostgREST max-rows 限制
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 各語言掌握統計（成長面板、成就檢查）
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION progress_summary(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(t), '[]'::json)
  FROM (
    SELECT
      b.language,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(p.stage, 0) >= 4)::int AS mastered,
      COUNT(*) FILTER (WHERE p.stage BETWEEN 1 AND 3)::int AS learning,
      COUNT(*) FILTER (WHERE COALESCE(p.stage, 0) = 0)::int AS unlearned
    FROM words w
    JOIN wordbooks b ON b.id = w.wordbook_id
    LEFT JOIN word_progress p ON p.word_id = w.id
    WHERE b.user_id = p_user_id
    GROUP BY b.language
  ) t;
$$;

-- ---------------------------------------------
-- 歷史最高掌握數只升不降
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION refresh_peak_mastered(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_language_settings s
  SET peak_mastered_count = c.mastered
  FROM (
    SELECT b.language, COUNT(*)::int AS mastered
    FROM words w
    JOIN wordbooks b ON b.id = w.wordbook_id
    JOIN word_progress p ON p.word_id = w.id
    WHERE b.user_id = p_user_id AND p.stage >= 4
    GROUP BY b.language
  ) c
  WHERE s.user_id = p_user_id
    AND s.language = c.language
    AND c.mastered > s.peak_mastered_count;
$$;

-- ---------------------------------------------
-- 各單字本字數（{ wordbook_id: count }）
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION wordbook_word_counts(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_object_agg(c.id, c.cnt), '{}'::json)
  FROM (
    SELECT b.id, COUNT(w.id)::int AS cnt
    FROM wordbooks b
    LEFT JOIN words w ON w.wordbook_id = b.id
    WHERE b.user_id = p_user_id
    GROUP BY b.id
  ) c;
$$;

-- ---------------------------------------------
-- 寫入作答（每日任務逐題／自由練習整批共用）
-- p_answers: [{ word_id, is_correct, progress: {stage, due_date, introduced_at,
--              last_reviewed_date, lapse_count, mastered_at} | null }]
-- 同一場次同一單字只記一次；回傳實際寫入的 word_id 陣列
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION record_answers(
  p_user_id uuid,
  p_session_id uuid,
  p_answers jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_word_id uuid;
  v_correct boolean;
  v_progress jsonb;
  v_inserted uuid[] := '{}';
  v_now timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM quiz_sessions WHERE id = p_session_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    v_word_id := (v_item->>'word_id')::uuid;
    v_correct := (v_item->>'is_correct')::boolean;
    v_progress := v_item->'progress';

    IF NOT EXISTS (
      SELECT 1 FROM words w JOIN wordbooks b ON b.id = w.wordbook_id
      WHERE w.id = v_word_id AND b.user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'word not owned';
    END IF;

    INSERT INTO quiz_answers (session_id, word_id, is_correct)
    VALUES (p_session_id, v_word_id, v_correct)
    ON CONFLICT (session_id, word_id) DO NOTHING;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    v_inserted := v_inserted || v_word_id;

    INSERT INTO word_stats (word_id, user_id, attempt_count, correct_count, last_tested_at)
    VALUES (v_word_id, p_user_id, 1, CASE WHEN v_correct THEN 1 ELSE 0 END, v_now)
    ON CONFLICT (word_id) DO UPDATE SET
      attempt_count = word_stats.attempt_count + 1,
      correct_count = word_stats.correct_count + CASE WHEN v_correct THEN 1 ELSE 0 END,
      last_tested_at = v_now;

    IF v_progress IS NOT NULL AND jsonb_typeof(v_progress) = 'object' THEN
      INSERT INTO word_progress (
        word_id, user_id, stage, due_date, introduced_at,
        last_reviewed_date, lapse_count, mastered_at
      ) VALUES (
        v_word_id,
        p_user_id,
        (v_progress->>'stage')::int,
        (v_progress->>'due_date')::date,
        (v_progress->>'introduced_at')::timestamptz,
        (v_progress->>'last_reviewed_date')::date,
        (v_progress->>'lapse_count')::int,
        (v_progress->>'mastered_at')::timestamptz
      )
      ON CONFLICT (word_id) DO UPDATE SET
        stage = EXCLUDED.stage,
        due_date = EXCLUDED.due_date,
        introduced_at = EXCLUDED.introduced_at,
        last_reviewed_date = EXCLUDED.last_reviewed_date,
        lapse_count = EXCLUDED.lapse_count,
        mastered_at = EXCLUDED.mastered_at;
    END IF;
  END LOOP;

  RETURN to_json(v_inserted);
END;
$$;

-- ---------------------------------------------
-- 權限
-- ---------------------------------------------
REVOKE ALL ON TABLE user_language_settings FROM anon, authenticated;
REVOKE ALL ON TABLE word_progress          FROM anon, authenticated;
REVOKE ALL ON TABLE daily_tasks            FROM anon, authenticated;
REVOKE ALL ON TABLE user_achievements      FROM anon, authenticated;

GRANT ALL ON TABLE user_language_settings TO service_role;
GRANT ALL ON TABLE word_progress          TO service_role;
GRANT ALL ON TABLE daily_tasks            TO service_role;
GRANT ALL ON TABLE user_achievements      TO service_role;

REVOKE EXECUTE ON FUNCTION create_wordbook(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_wordbook(uuid, text, text) TO service_role;

-- 修正：register_line_user 原本未撤銷 anon 執行權限（anon key 公開於前端）
REVOKE EXECUTE ON FUNCTION get_language_words(uuid, text)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION progress_summary(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refresh_peak_mastered(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION wordbook_word_counts(uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION record_answers(uuid, uuid, jsonb)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION register_line_user(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_language_words(uuid, text)       TO service_role;
GRANT EXECUTE ON FUNCTION progress_summary(uuid)               TO service_role;
GRANT EXECUTE ON FUNCTION refresh_peak_mastered(uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION wordbook_word_counts(uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION record_answers(uuid, uuid, jsonb)    TO service_role;


COMMIT;
