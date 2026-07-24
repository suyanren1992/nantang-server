# 任务卡 D-2：CORS 通配符 → 精确白名单 🔴

> 施工方：豆包 Codex（二营） · 监察：Kimi Code · 验收：Kimi Work · 单独 commit，不 push
> 来源：《全面权限扫描_B方案_2026-07-24》CR-1

## 位置
`server/main.py:61-75`

## 问题
`allow_origins` 含 `https://*.trycloudflare.com` 和 `https://*.pages.dev` 通配符，同时 `allow_credentials=True`。攻击者注册免费 `attacker.trycloudflare.com` 子域即可携带受害者 cookie 发起跨站请求，以受害者身份转账/提现。

## 修法
1. 删除两个通配符域名
2. 精确白名单 = 硬编码基础项（`http://localhost:8000`、`http://127.0.0.1:8000`、`https://nantang.imeeting.club`、`https://nantang-server.pages.dev`）+ 环境变量 `FRONTEND_ORIGIN`（存在才追加，逗号可分隔多个）
3. `allow_credentials=True` 保留（cookie 认证需要）；`allow_methods/allow_headers` 收敛为实际用到的：`["GET","POST","PUT","DELETE","OPTIONS"]` 和 `["Content-Type","Authorization"]`

## 验收
- `uvicorn main:app` 本地起得来，`/docs` 正常
- `curl -X OPTIONS -H "Origin: https://attacker.trycloudflare.com" -H "Access-Control-Request-Method: POST" <本地>/api/auth/login -i` 响应**不含** `access-control-allow-origin: https://attacker.trycloudflare.com`
- `Origin: https://nantang.imeeting.club` 同样请求则正常放行
- commit message：`fix(D-2): CORS 通配符改精确白名单（CR-1，凭 credentials 通配=CSRF 敞口）`
