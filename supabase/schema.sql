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
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_line_user_id_idx ON users (line_user_id);
CREATE INDEX users_status_idx ON users (status);

-- =============================================
-- 單字本
-- =============================================
CREATE TABLE wordbooks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX wordbooks_user_id_idx ON wordbooks (user_id);

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
  question_type         TEXT NOT NULL
                        CHECK (question_type IN ('是非題', '選擇題', '輸入題')),
  word_count_requested  INTEGER NOT NULL,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  score                 NUMERIC
);

CREATE INDEX quiz_sessions_user_id_idx ON quiz_sessions (user_id);

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

GRANT ALL ON TABLE users            TO service_role;
GRANT ALL ON TABLE wordbooks        TO service_role;
GRANT ALL ON TABLE words            TO service_role;
GRANT ALL ON TABLE tags             TO service_role;
GRANT ALL ON TABLE word_tags        TO service_role;
GRANT ALL ON TABLE word_stats       TO service_role;
GRANT ALL ON TABLE quiz_sessions    TO service_role;
GRANT ALL ON TABLE quiz_answers     TO service_role;
GRANT ALL ON TABLE card_familiarity TO service_role;
