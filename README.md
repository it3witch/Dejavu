# Deja vu 梦境记录

这是一个纯前端 + Supabase 的版本：

- `frontend/`: 页面、样式、交互、Supabase Auth 登录
- `database/`: 数据表、RLS 权限策略、示例数据
- `backend/`: 旧 FastAPI 版本，当前路线 B 不再依赖它

## 本地预览

```powershell
cd D:\Project_dejavu
.\.venv\Scripts\python.exe -m http.server 5173 --bind 127.0.0.1 --directory frontend
```

打开：

```text
http://127.0.0.1:5173/
```

## Supabase 配置

1. 打开 Supabase 项目。
2. 进入 `SQL Editor`。
3. 如果是新库，执行 `database/schema.sql`。
4. 如果是已有 `dreams` 表，执行 `database/auth-migration.sql`。
5. 可选：执行 `database/seed.sql` 导入示例梦境。
6. 进入 `Project Settings -> API`，复制：
   - `Project URL`
   - `anon public key`
7. 修改 `frontend/config.js`：

```js
window.DEJAVU_SUPABASE_URL = 'https://你的项目.supabase.co';
window.DEJAVU_SUPABASE_ANON_KEY = '你的 anon public key';
```

不要把 `service_role key` 放进前端。

## Auth 回调地址

Supabase 里进入 `Authentication -> URL Configuration`：

- `Site URL`: 本地测试时填 `http://127.0.0.1:5173`
- `Redirect URLs`: 加上
  - `http://127.0.0.1:5173`
  - `https://你的-vercel-域名.vercel.app`

部署到 Vercel 后，把 `Site URL` 改成你的 Vercel 域名。

## Vercel 部署

1. 把项目推到 GitHub。
2. 在 Vercel 导入这个仓库。
3. 在 `Project Settings -> Environment Variables` 添加：

```text
DEJAVU_SUPABASE_URL=https://你的项目.supabase.co
DEJAVU_SUPABASE_ANON_KEY=你的 anon public key
```

4. Vercel 会运行 `npm run build`，自动生成 `frontend/config.js`。
5. 部署完成后，用手机打开 Vercel 给你的网址。

## 登录方式

当前使用 Supabase 邮箱验证码：

1. 网站右下角点登录。
2. 输入邮箱。
3. 查看邮件里的 6 位验证码。
4. 回到网站输入验证码后即可记录梦境。

如果邮件里仍然是登录链接，而不是 6 位验证码，进入 Supabase：

```text
Authentication -> Email Templates -> Magic Link
```

把模板里的链接变量改成验证码变量，例如：

```html
<h2>你的 Deja vu 验证码</h2>
<p>{{ .Token }}</p>
```

不要只保留 `{{ .ConfirmationURL }}`，否则 Supabase 会继续发送魔法链接。

登录后：

- 私密梦境只有自己可见。
- 勾选“匿名公开”的梦境会进入大厅。
- 检索会匹配公开梦境和自己的梦境。

## 手机访问

手机不能访问电脑上的 `http://127.0.0.1:5173`。`127.0.0.1` 在手机上代表手机自己，不是电脑。

部署后请用 Vercel 域名访问，例如：

```text
https://你的项目.vercel.app
```

如果只想在同一个 Wi-Fi 下本地预览，需要把前端服务绑定到局域网地址：

```powershell
cd D:\Project_dejavu
.\.venv\Scripts\python.exe -m http.server 5173 --bind 0.0.0.0 --directory frontend
```

然后在电脑上运行 `ipconfig` 找到 IPv4 地址，手机访问：

```text
http://电脑IPv4地址:5173
```
