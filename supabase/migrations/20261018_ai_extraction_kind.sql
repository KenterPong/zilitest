-- =============================================
-- 圖片轉文字（技術規格 v5 第十節 7.）：ai_extractions 加 kind 區分紀錄類型
-- 抽字與圖片轉文字共用每月次數（同一張表計數）
-- 只新增欄位，既有紀錄自動視為 'extract'，不改動既有資料
-- delete_account() 已刪除 ai_extractions，不需修改
-- =============================================

BEGIN;

ALTER TABLE ai_extractions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'extract';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_extractions_kind_check'
  ) THEN
    ALTER TABLE ai_extractions
      ADD CONSTRAINT ai_extractions_kind_check CHECK (kind IN ('extract', 'transcribe_image'));
  END IF;
END $$;

COMMIT;
