-- =============================================
-- 例句題型不寫 word_stats（技術規格 v5 第五節 9.，2026/11/01）
-- record_answers() 每筆作答可帶 skip_stats = true，此時只寫 quiz_answers，不寫 word_stats。
-- 只替換函式，不改資料表與既有資料；舊程式不帶 skip_stats 時行為不變，
-- 因此 migration 與部署的先後順序不影響運作。執行前仍建議先備份。
-- 已寫入 word_stats 的例句題成績不回溯清除。
-- =============================================

BEGIN;

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

    IF NOT COALESCE((v_item->>'skip_stats')::boolean, false) THEN
      INSERT INTO word_stats (word_id, user_id, attempt_count, correct_count, last_tested_at)
      VALUES (v_word_id, p_user_id, 1, CASE WHEN v_correct THEN 1 ELSE 0 END, v_now)
      ON CONFLICT (word_id) DO UPDATE SET
        attempt_count = word_stats.attempt_count + 1,
        correct_count = word_stats.correct_count + CASE WHEN v_correct THEN 1 ELSE 0 END,
        last_tested_at = v_now;
    END IF;

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

REVOKE EXECUTE ON FUNCTION record_answers(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_answers(uuid, uuid, jsonb) TO service_role;

COMMIT;
