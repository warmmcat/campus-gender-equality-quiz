# 大專性平知識大會考

此儲存庫用於將現有測驗網站移轉至 GitHub Pages，並以 Supabase 提供 Google 帳號登入、題庫、作答紀錄與管理員權限。

## 預定架構

- GitHub Pages：公開網站
- Supabase Auth：Google 登入／登出
- Supabase Database + RLS：題庫、成績與權限
- 唯一管理員：`warmmcat@gmail.com`

> 請勿將 Supabase `service_role` 金鑰或 Google OAuth Client Secret 提交至此儲存庫。
