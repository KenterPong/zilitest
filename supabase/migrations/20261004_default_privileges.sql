-- =============================================
-- 預設權限收緊：public schema 之後新建立的函式與資料表，
-- 預設不開放 anon / authenticated（Postgres 預設任何人都可執行新函式）。
-- 並對目前所有函式、資料表、序列再全面撤銷一次。
-- 本專案所有存取都走 API + service role（技術規格第二節 4.）。
-- 在 SQL Editor（postgres 角色）執行；只改權限，不動資料
-- =============================================

BEGIN;

-- 之後由 postgres 角色在 public 建立的物件
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- 目前已存在的物件（觸發器函式只在建立觸發器時檢查權限，撤銷不影響觸發）
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
