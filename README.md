# 大專性平知識大會考

GitHub Pages 靜態前端，使用 Supabase Auth、Database 與 RLS。

## 安全設計

- 前端只包含 Supabase publishable key；不包含 secret/service_role key。
- 學生只能建立及讀取自己的完成紀錄。
- `warmmcat@gmail.com` 是唯一管理員，管理權限由資料庫 RLS 驗證。
- 不長期保存個別題目的作答選擇。
- 完成紀錄超過一年由 Supabase Cron 自動刪除。

## OAuth 設定

Supabase Google provider 的 callback URL：

`https://bnnoikfcztusxjhazsir.supabase.co/auth/v1/callback`

正式網站 URL：

`https://warmmcat.github.io/campus-gender-equality-quiz/`
