-- =============================================
-- 字力測驗 zilitest - Supabase Schema（Route A）
-- 在 Supabase Dashboard > SQL Editor 執行此檔案
-- 路線 A：不使用 RLS，所有存取走 API + service role key
-- =============================================

-- =============================================
-- 使用者（含訂閱狀態機）
-- =============================================
CREATE TABLE users (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id             TEXT UNIQUE NOT NULL,
  display_name             TEXT,
  avatar_url               TEXT,
  email                    TEXT,
  status                   TEXT NOT NULL DEFAULT 'trial'
                           CHECK (status IN ('trial', 'active', 'payment_failed', 'suspended', 'cancelled')),
  auto_renew               BOOLEAN NOT NULL DEFAULT true,
  is_early_bird            BOOLEAN NOT NULL DEFAULT false,
  trial_start_at           TIMESTAMPTZ,
  trial_end_at             TIMESTAMPTZ,
  first_paid_at            TIMESTAMPTZ,
  next_billing_at          TIMESTAMPTZ,
  payment_failed_at        TIMESTAMPTZ,
  grace_period_end_at      TIMESTAMPTZ,
  word_count               INTEGER NOT NULL DEFAULT 0,
  suspended_at             TIMESTAMPTZ,
  data_purge_scheduled_at  TIMESTAMPTZ,
  last_reminder_sent_at    TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  current_streak           INTEGER NOT NULL DEFAULT 0,
  longest_streak           INTEGER NOT NULL DEFAULT 0,
  last_streak_date         DATE,
  streak_frozen_at         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_line_user_id_idx ON users (line_user_id);
CREATE INDEX users_status_idx ON users (status);
CREATE INDEX users_early_bird_active_idx ON users (is_early_bird)
  WHERE is_early_bird = true AND status <> 'cancelled';

-- =============================================
-- 單字本
-- =============================================
CREATE TABLE wordbooks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  language    TEXT NOT NULL CONSTRAINT wordbooks_language_check
              CHECK (language IN ('en', 'ja', 'ko')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX wordbooks_user_id_idx ON wordbooks (user_id);
CREATE INDEX wordbooks_user_language_idx ON wordbooks (user_id, language);

-- =============================================
-- 單字
-- =============================================
CREATE TABLE words (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wordbook_id  UUID NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
  term         TEXT NOT NULL,
  answer       TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX words_wordbook_id_idx ON words (wordbook_id);

-- =============================================
-- 標籤（跨單字本共用）
-- =============================================
CREATE TABLE tags (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE INDEX tags_user_id_idx ON tags (user_id);

-- =============================================
-- 單字-標籤 多對多
-- =============================================
CREATE TABLE word_tags (
  word_id  UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (word_id, tag_id)
);

CREATE INDEX word_tags_tag_id_idx ON word_tags (tag_id);

-- =============================================
-- 使用者語言設定
-- =============================================
CREATE TABLE user_language_settings (
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language             TEXT NOT NULL CHECK (language IN ('en', 'ja', 'ko')),
  enabled              BOOLEAN NOT NULL DEFAULT true,
  daily_review_limit   INTEGER NOT NULL DEFAULT 30 CHECK (daily_review_limit >= 0),
  daily_new_limit      INTEGER NOT NULL DEFAULT 5 CHECK (daily_new_limit >= 0),
  peak_mastered_count  INTEGER NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, language)
);

-- =============================================
-- 熟練度與複習排程（無 row 視同 stage = 0）
-- =============================================
CREATE TABLE word_progress (
  word_id             UUID PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage               INTEGER NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 7),
  due_date            DATE,
  introduced_at       TIMESTAMPTZ,
  last_reviewed_date  DATE,
  lapse_count         INTEGER NOT NULL DEFAULT 0,
  mastered_at         TIMESTAMPTZ
);

CREATE INDEX word_progress_user_due_idx ON word_progress (user_id, due_date);

-- =============================================
-- 每日任務
-- =============================================
CREATE TABLE daily_tasks (
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

-- =============================================
-- 成就（定義寫在程式碼常數；解鎖永不收回）
-- =============================================
CREATE TABLE user_achievements (
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key  TEXT NOT NULL,
  unlocked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_key)
);

-- =============================================
-- 單字測驗統計（一對一 words）
-- =============================================
CREATE TABLE word_stats (
  word_id         UUID PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  last_tested_at  TIMESTAMPTZ
);

CREATE INDEX word_stats_user_id_idx ON word_stats (user_id);

-- =============================================
-- 測驗場次
-- =============================================
CREATE TABLE quiz_sessions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filter_wordbook_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  filter_tag_ids        JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_type         TEXT NOT NULL CONSTRAINT quiz_sessions_question_type_check
                        CHECK (question_type IN ('是非題', '選擇題', '輸入題', 'mixed')),
  mode                  TEXT NOT NULL DEFAULT 'free_practice' CONSTRAINT quiz_sessions_mode_check
                        CHECK (mode IN ('daily_task', 'free_practice')),
  daily_task_id         UUID REFERENCES daily_tasks(id) ON DELETE SET NULL,
  word_count_requested  INTEGER NOT NULL,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  score                 NUMERIC
);

CREATE INDEX quiz_sessions_user_id_idx ON quiz_sessions (user_id);
CREATE UNIQUE INDEX quiz_sessions_daily_task_idx ON quiz_sessions (daily_task_id)
  WHERE daily_task_id IS NOT NULL;

-- =============================================
-- 測驗作答紀錄
-- =============================================
CREATE TABLE quiz_answers (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  word_id     UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  is_correct  BOOLEAN NOT NULL
);

CREATE INDEX quiz_answers_session_id_idx ON quiz_answers (session_id);
CREATE UNIQUE INDEX quiz_answers_session_word_idx ON quiz_answers (session_id, word_id);

-- =============================================
-- 卡牌熟悉度自評（一對一 words）
-- =============================================
CREATE TABLE card_familiarity (
  word_id      UUID PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  familiarity  TEXT NOT NULL CHECK (familiarity IN ('unknown', 'known')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX card_familiarity_user_id_idx ON card_familiarity (user_id);

-- =============================================
-- updated_at 自動更新
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_language_settings_updated_at
  BEFORE UPDATE ON user_language_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION update_card_familiarity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER card_familiarity_updated_at
  BEFORE UPDATE ON card_familiarity FOR EACH ROW EXECUTE FUNCTION update_card_familiarity_updated_at();

-- =============================================
-- 使用者回饋
-- =============================================
CREATE TABLE feedback (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feedback_content_len CHECK (char_length(content) BETWEEN 1 AND 2000)
);

CREATE INDEX feedback_user_id_idx ON feedback (user_id);
CREATE INDEX feedback_created_at_idx ON feedback (created_at DESC);

-- =============================================
-- LINE 註冊／登入（含早鳥名額原子判定）
-- =============================================
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

-- =============================================
-- 建立單字本（同時建立該語言設定）
-- =============================================
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

-- =============================================
-- 某語言全部單字＋熟練度（每日任務產生、干擾項用）
-- 回傳單一 json，不受 PostgREST max-rows 限制
-- =============================================
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

-- =============================================
-- 各語言掌握統計（成長面板、成就檢查）
-- =============================================
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

-- =============================================
-- 歷史最高掌握數只升不降
-- =============================================
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

-- =============================================
-- 各單字本字數（{ wordbook_id: count }）
-- =============================================
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

-- =============================================
-- 寫入作答（每日任務逐題／自由練習整批共用）
-- p_answers: [{ word_id, is_correct, progress: {stage, due_date, introduced_at,
--              last_reviewed_date, lapse_count, mastered_at} | null }]
-- 同一場次同一單字只記一次；回傳實際寫入的 word_id 陣列
-- =============================================
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

-- =============================================
-- 刪除帳號：立即清空所有資料（含改善建議），users 列保留供登入識別
-- 同一 LINE 帳號再登入時由 register_line_user 視為全新帳號
-- =============================================
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

-- =============================================
-- 暫停滿 3 個月的帳號清除資料（目前手動執行：SELECT purge_expired_accounts();）
-- 回傳本次清除的帳號數
-- =============================================
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

-- =============================================
-- 付費恢復時解除成長資料凍結（第九節 4.）：連續天數與複習排程順延 p_days 天
-- 狀態改為 active 由付款流程負責（待 LINE Pay 串接）
-- =============================================
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

-- =============================================
-- 撤銷 anon / authenticated 直接存取權限
-- =============================================
REVOKE ALL ON TABLE users            FROM anon, authenticated;
REVOKE ALL ON TABLE wordbooks        FROM anon, authenticated;
REVOKE ALL ON TABLE words            FROM anon, authenticated;
REVOKE ALL ON TABLE tags             FROM anon, authenticated;
REVOKE ALL ON TABLE word_tags        FROM anon, authenticated;
REVOKE ALL ON TABLE word_stats       FROM anon, authenticated;
REVOKE ALL ON TABLE quiz_sessions    FROM anon, authenticated;
REVOKE ALL ON TABLE quiz_answers     FROM anon, authenticated;
REVOKE ALL ON TABLE card_familiarity FROM anon, authenticated;
REVOKE ALL ON TABLE feedback         FROM anon, authenticated;
REVOKE ALL ON TABLE user_language_settings FROM anon, authenticated;
REVOKE ALL ON TABLE word_progress          FROM anon, authenticated;
REVOKE ALL ON TABLE daily_tasks            FROM anon, authenticated;
REVOKE ALL ON TABLE user_achievements      FROM anon, authenticated;

GRANT ALL ON TABLE users            TO service_role;
GRANT ALL ON TABLE wordbooks        TO service_role;
GRANT ALL ON TABLE words            TO service_role;
GRANT ALL ON TABLE tags             TO service_role;
GRANT ALL ON TABLE word_tags        TO service_role;
GRANT ALL ON TABLE word_stats       TO service_role;
GRANT ALL ON TABLE quiz_sessions    TO service_role;
GRANT ALL ON TABLE quiz_answers     TO service_role;
GRANT ALL ON TABLE card_familiarity TO service_role;
GRANT ALL ON TABLE feedback         TO service_role;
GRANT ALL ON TABLE user_language_settings TO service_role;
GRANT ALL ON TABLE word_progress          TO service_role;
GRANT ALL ON TABLE daily_tasks            TO service_role;
GRANT ALL ON TABLE user_achievements      TO service_role;

GRANT EXECUTE ON FUNCTION register_line_user(text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION create_wordbook(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_wordbook(uuid, text, text) TO service_role;

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

REVOKE EXECUTE ON FUNCTION delete_account(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION purge_expired_accounts()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION unfreeze_growth(uuid, integer)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_account(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION purge_expired_accounts()        TO service_role;
GRANT EXECUTE ON FUNCTION unfreeze_growth(uuid, integer)  TO service_role;


