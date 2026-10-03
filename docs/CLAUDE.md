# 字力測驗 zilitest — Claude Code 專案規則

多語言(英/日/韓)自學者的單字成長系統。LINE Login、Next.js + TypeScript、Supabase、Vercel、Cloudflare。

## 規格文件(唯一依據)

- `docs/單字背誦網站_技術規格文件_v5.md`:資料庫、業務邏輯、演算法、視覺規範(附錄 A)
- `docs/單字背誦網站_營運文件.md`:訂價、帳號狀態、法規等業務規則
- `docs/DEPLOY.md`:部署與環境變數

**規則**:
- 實作一律以規格為準。若規格有矛盾、遺漏或與現有程式衝突,**先停下來列出問題詢問**,不要自行決定,也不要修改 `docs/` 內的文件。
- 不要實作規格中標示為「第二階段」「第三階段」「未來規劃」的功能(AI 抽字、小遊戲、發音、排行榜、LINE Pay、FB/Google 登入),除非明確指示。

## 不可違反的技術原則

- **日期**:每日任務、熟練度、連續天數、早鳥截止等所有「日期」一律以 **Asia/Taipei** 計算,統一使用共用的台北日期工具函式,不要直接用 `new Date()` 取日期或依伺服器時區。
- **資料存取**:不使用 Supabase Auth、不使用 RLS。所有讀寫走 Next.js API route + service role,並在 API 層驗證 `cookie.user_id` 與資料列的 `user_id` 相符。
- `SUPABASE_SERVICE_ROLE_KEY`、`ANTHROPIC_API_KEY` 僅限伺服器端,不可使用 `NEXT_PUBLIC_*` 前綴。
- 新資料表一律 `REVOKE ALL ... FROM anon, authenticated`。
- `users.status = 'cancelled'` 的 session:API 回 401 並清除 cookie。
- 500 字上限一律以 `users.word_count`(帳號全站加總)判斷,不可用單一單字本字數。

## 資料庫 migration

- `supabase/schema.sql`:永遠維持最新完整版本(新專案直接執行)
- `supabase/migrations/`:既有專案升級用,檔名 `YYYYMMDD_說明.sql`,依檔名順序執行
- 每次 schema 變更必須**同時**新增 migration 檔並更新 `schema.sql`
- migration 須可在已有正式資料的資料庫上安全執行(已有早鳥使用者),避免破壞性操作;執行前提醒先備份或先在測試專案驗證

## UI

- 依技術規格**附錄 A**(paper-and-stamp):色彩 token、字體、圓角 2/5/8px、每個畫面只放一個 `--stamp-red` 主要按鈕
- 所有動畫須支援 `prefers-reduced-motion: reduce`
- 介面文案使用繁體中文(台灣用語)

## 工作方式

- 以「階段」為單位進行;每個階段先提出計畫(要動哪些檔案、資料表、API),確認後再實作
- 熟練度、每日任務產生、連續天數等核心邏輯寫成純函式,並附單元測試
- 每個階段完成後列出:變更檔案、需手動執行的 SQL、驗收步驟
- 與我溝通使用繁體中文
