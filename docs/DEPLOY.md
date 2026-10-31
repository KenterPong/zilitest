# 字力測驗 zilitest 部署指南

比照 [web_reserve](https://github.com/KenterPong/web_reserve) 的 Supabase + LINE Login + Vercel + Cloudflare 架構。

## 1. Supabase

1. 建立新 Supabase 專案
2. **新專案**：Dashboard → **SQL Editor** → 貼上 [`supabase/schema.sql`](../supabase/schema.sql) → **Run**（`schema.sql` 永遠維持最新完整版本）
3. **既有專案升級**：依檔名順序執行 `supabase/migrations/` 內**尚未執行過**的 migration 檔（檔名以日期開頭，例如 `20261003_v5_daily_tasks.sql`）
4. 資料表與欄位定義**以技術規格文件為準**（第一節 `users`、`feedback`;第三節、第八節、第十節、第十二節、第十三節），本文件不另列資料表清單，避免兩邊不同步
5. **發音標註（2026/10/26）**：既有專案執行 `20261026_word_pronunciation.sql` 後，再補齊既有英韓單字的發音標註（新專案沒有既有單字，不需要）：
   ```
   npm run backfill:pronunciation -- --dry-run   # 先看會寫入幾個字
   npm run backfill:pronunciation
   ```
   腳本讀取 `.env.local` 的 Supabase 設定（本機連的是正式資料庫），可重複執行，只寫入 `words.pronunciation`。**先執行 migration 再部署程式**，否則新版查詢 `pronunciation` 欄位會失敗
6. **例句（2026/10/31）**：既有專案執行 `20261031_word_examples.sql`（`words` 新增 7 個 `example_*` 欄位、`ai_extractions.kind` 允許 `generate_examples`、`quiz_sessions.question_type` 中文值改為英文代碼並允許例句題型、`get_language_words()` 回傳例句欄位）。既有單字不會被改動，例句欄位皆為 NULL，可用「AI 補例句」補上。
   - ⚠️ **執行 migration 後須立即部署新程式**：新的 `question_type` CHECK 不接受中文值，舊程式也寫不進英文代碼，兩者之間不要用正式站或本機舊程式開測驗。執行前先備份
   - 部署前確認 Vercel 已設定 `EXAMPLE_SIGNING_SECRET`（見第 2 節），否則例句不會寫入
7. Settings → API 複製：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（僅伺服器端，勿公開）

## 2. 環境變數

複製 [`.env.example`](../.env.example) 為 `.env.local`（本機）或在 Vercel 設定：

| 變數 | 說明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `LINE_CLIENT_ID` / `LINE_CLIENT_SECRET` | LINE Login channel |
| `LINE_CALLBACK_URL` | 伺服器用，須與 Console 一致 |
| `NEXT_PUBLIC_LINE_CLIENT_ID` | 與 LINE_CLIENT_ID 相同 |
| `NEXT_PUBLIC_LINE_CALLBACK_URL` | 與 LINE_CALLBACK_URL 相同 |
| `NEXT_PUBLIC_APP_URL` | 主站 URL |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `zilitest.com` |
| `CRON_SECRET` | Phase 2 cron 用（可先填隨機字串） |
| `OPENAI_API_KEY` | AI 抽字用 OpenAI API key（僅伺服器端） |
| `OPENAI_MODEL` | AI 抽字用模型 ID，目前為 `gpt-6-luna`（僅伺服器端） |
| `EXAMPLE_SIGNING_SECRET` | 例句簽章金鑰（僅伺服器端，隨機長字串，例如 `openssl rand -base64 32`）；AI 產生的例句寫入前驗證未被改動。未設定時 AI 抽字照常運作，但例句不會寫入 |

### OpenAI（AI 抽字）

- 兩個變數都**不可**加 `NEXT_PUBLIC_*` 前綴；任一未設定時，AI 抽字顯示「尚未開放」，其他功能不受影響
- Vercel 只在部署開始時讀取環境變數：新增或修改後，到 Deployments 對最新部署按 **Redeploy** 才會生效
- OpenAI 後台另建專案 `zilitest`，API key 名稱 `zilitest-production`（不與其他專案共用）
- 專案 Settings → Limits：
  - **Allowed models** 只允許 `gpt-6-luna`；改用其他模型時，要同時在這裡開放該模型並更新 `OPENAI_MODEL`，否則請求會被擋下
  - **每月支出上限 US$5，已啟用 hard limit**：達上限後請求失敗（429），App 顯示「AI 服務忙碌中」且不扣使用者次數
- 模型須支援 Structured Outputs（JSON Schema），程式以此固定回傳格式
- 模型須支援**圖片輸入**（圖片轉文字沿用同一個 `OPENAI_MODEL`）
- 程式呼叫一律設定 `store: false`，OpenAI 後台 Logs 不會留下請求內容
- **時限**：AI 抽字、圖片轉文字、AI 補例句三支 API 的 `maxDuration` 為 120 秒，OpenAI 用戶端逾時 110 秒、不重試（2026/10/31 由 60／50 秒放寬：日文長文實測 20–55 秒）。Vercel 專案須開啟 **Fluid Compute**（Settings → Functions），否則 Hobby 方案上限仍為 60 秒；平台中斷時前端顯示「AI 處理時間過長」
- 成本：2026/10/18 實測，`zilitest` 專案 13 次請求（抽字與圖片轉文字合計）< US$0.005，每次遠低於 US$0.002
- 例句 token 用量（2026/10/31 本機直接呼叫 OpenAI 實測，現行設定 `reasoning_effort: 'low'`）：
  - 加入例句前（預設推理）：英文 640 字元 → 36 字、輸出 2,323 token、20.9 秒
  - 加入例句後：英文 2,765 字元 → 53 字、輸出 3,689 token、23.2 秒；日文 536 字元 → 29 字、輸出 4,138 token、34.3 秒；日文約 1,900–2,750 字元（N2）→ 9–49 字、輸出 1,500–7,400 token、20–55 秒（舊設定 50 秒逾時時，曾有一次逾時重試共 63 秒）
  - 同一段原文每次結果差異很大；每月 US$5 上限是否調整，依 OpenAI 後台 Usage 的實際月支出再評估

### 本機開發（LINE callback）

- 可使用 `http://www.lvh.me:3000` 或 `http://localhost:3000`
- Callback：`http://www.lvh.me:3000/auth/callback` 或 `http://localhost:3000/auth/callback`（`.env.local` 的 `LINE_CALLBACK_URL`、`NEXT_PUBLIC_LINE_CALLBACK_URL` 須與之一致）
- LINE Developers Console 需登記此 callback；與正式 callback 寫在同一個輸入框，一行一個。**正式 callback 不可刪除**，否則正式站無法登入；未登記時 LINE 會回 400 `Invalid redirect_uri value`
- 目前已登記：`https://www.zilitest.com/auth/callback`、`http://localhost:3000/auth/callback`（2026/10/26）
- `next.config.js` 已設定 `allowedDevOrigins: ['*.lvh.me']`

### 正式環境

- Callback 必須登記：`https://www.zilitest.com/auth/callback`
- 所有 `NEXT_PUBLIC_*_URL` 使用 `https://www.zilitest.com`

## 3. LINE Developers Console

1. 建立 **LINE Login** channel（Service 類型，送審）
2. Callback URL：`https://www.zilitest.com/auth/callback`（本機測試在同一欄另加 localhost 或 lvh.me，一行一個）
3. Scopes：`profile`、`openid`（不需 email）
4. 取得 Channel ID / Channel Secret

## 4. GitHub

- Repository：`KenterPong/zilitest`
- 分支：`main`

## 5. Vercel

1. [vercel.com](https://vercel.com) → Add New Project → Import `KenterPong/zilitest`
2. Framework：Next.js
3. 設定上述環境變數（Production）
4. Deploy
5. **函式地區須與 Supabase 相同**：[`vercel.json`](../vercel.json) 的 `regions` 目前為 `sin1`（對應 Supabase `ap-southeast-1` Singapore）。若 Supabase 換成其他地區，需一併修改（例如 Tokyo → `hnd1`、Seoul → `icn1`），否則每次資料庫查詢都要跨區來回，頁面會明顯變慢。可由回應標頭 `x-vercel-id`（格式 `邊緣節點::函式地區::…`）確認實際執行地區

## 6. Cloudflare DNS（zilitest.com）

| 類型 | 名稱 | 內容 | Proxy |
|------|------|------|-------|
| CNAME | `www` | `cname.vercel-dns.com` | DNS only（灰雲）建議 |
| CNAME | `@` | `cname.vercel-dns.com` | DNS only |

- Vercel → Settings → Domains：加入 `zilitest.com`、`www.zilitest.com`
- Cloudflare SSL/TLS：**Full (strict)**
- Apex redirect：`zilitest.com` → `https://www.zilitest.com`（301）

## 7. 驗收

- [x] 首頁 `https://www.zilitest.com` 可開啟
- [x] LINE 登入成功，Supabase `users` 出現 `status=trial`（早鳥為 `is_early_bird=true`、`trial_end_at` 至 2027/12/31）
- [x] `/app` 顯示試用／早鳥 banner 與使用者名稱
- [x] Footer「改善建議」→ `/app/feedback` 可送出，Supabase `feedback` 表有資料
- [x] Footer 隱私權／服務條款；已登入時 header 顯示「返回 App」
- [x] 單字本「AI 抽字」可抽出所設等級的單字並匯入；成功後本月剩餘次數減 1，錯誤時不扣次數
- [x] AI 抽字「上傳圖片」可把圖片文字填入文字框；成功後本月剩餘次數減 1（與抽字共用），錯誤時不扣次數（需先執行 `20261018_ai_extraction_kind.sql`）
- [x] 匯出 Excel 共 7 欄（單字、答案、描述、讀音、發音標註、例句、例句翻譯），前 4 欄可原樣再匯入；第 5–7 欄唯讀（例句兩欄 2026/10/31 加入；2026/10/26 實際匯出確認前 5 欄；再匯入以單元測試確認，未匯入站長帳號以免重複）
- [x] 單字本：英文顯示 IPA 音標、韓文顯示羅馬拼音、日文顯示讀音；日文含漢字未填讀音顯示「未填讀音」（2026/10/26 本機連正式資料庫驗收）
- [x] 設定頁「發音」區塊可依語言關閉第二層，其他語言不受影響
- [x] 遊戲「拼字挑戰」英日韓可玩，成績寫入 `game_scores`（`game = 'spell'`）
- [x] 正式站部署後再確認一次上述三項（2026/10/26 正式站驗收通過）

## Phase 2 預留

- `vercel.json` cron：試用到期、扣款失敗、資料清除排程
- LINE Pay Sandbox 金流
