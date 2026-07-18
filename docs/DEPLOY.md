# 字力測驗 zilitest 部署指南

比照 [web_reserve](https://github.com/KenterPong/web_reserve) 的 Supabase + LINE Login + Vercel + Cloudflare 架構。

## 1. Supabase

1. 建立新 Supabase 專案
2. Dashboard → **SQL Editor** → 貼上 [`supabase/schema.sql`](../supabase/schema.sql) → **Run**
3. 確認 Table Editor 出現表：`users`、`wordbooks`、`words`、`tags`、`word_tags`、`word_stats`、`quiz_sessions`、`quiz_answers`、`card_familiarity`、`feedback`
4. **既有專案升級**：若先前已跑過舊 schema，改執行 [`supabase/migration_early_bird_feedback.sql`](../supabase/migration_early_bird_feedback.sql)（會加 `is_early_bird`、`feedback`、`register_line_user`，並為現有帳號補發早鳥）
5. Settings → API 複製：
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

### 本機開發（LINE callback）

- 建議使用 `http://www.lvh.me:3000`
- Callback：`http://www.lvh.me:3000/auth/callback`
- LINE Developers Console 需登記此 callback
- `next.config.js` 已設定 `allowedDevOrigins: ['*.lvh.me']`

### 正式環境

- Callback 只登記：`https://www.zilitest.com/auth/callback`
- 所有 `NEXT_PUBLIC_*_URL` 使用 `https://www.zilitest.com`

## 3. LINE Developers Console

1. 建立 **LINE Login** channel（Service 類型，送審）
2. Callback URL：`https://www.zilitest.com/auth/callback`（本機測試另加 lvh.me）
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

## 6. Cloudflare DNS（zilitest.com）

| 類型 | 名稱 | 內容 | Proxy |
|------|------|------|-------|
| CNAME | `www` | `cname.vercel-dns.com` | DNS only（灰雲）建議 |
| CNAME | `@` | `cname.vercel-dns.com` | DNS only |

- Vercel → Settings → Domains：加入 `zilitest.com`、`www.zilitest.com`
- Cloudflare SSL/TLS：**Full (strict)**
- Apex redirect：`zilitest.com` → `https://www.zilitest.com`（301）

## 7. 驗收

- [ ] 首頁 `https://www.zilitest.com` 可開啟
- [ ] LINE 登入成功，Supabase `users` 出現 `status=trial`
- [ ] `/app` 顯示試用 banner 與使用者名稱

## Phase 2 預留

- `vercel.json` cron：試用到期、扣款失敗、資料清除排程
- LINE Pay Sandbox 金流
