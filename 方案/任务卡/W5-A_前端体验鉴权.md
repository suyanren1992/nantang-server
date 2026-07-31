---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 前端体验
task_status: 已派工
status: 讨论中
series: Wave 5
---
# W5-A · 前端体验 + 鉴权修复（IA-7/8/9 + H-1/H-2）

> 归属：一营（Claude Code）
> 阵地：`nantang-mobile/`
> 禁区：`server/` 不许碰
> 并行：二营 W5-B 同步做后端，不互相等

## 问题（5 个）

### IA-7：顶栏信息完善
- **现象**：顶栏缺入住信息 / 天气 / 日期时间
- **阵地**：`app.js` + `core.js` + `index.html`

### IA-8：设置面板填充
- **现象**：设置页内容空（个人信息/通知/退出登录等）
- **阵地**：`ui-phase4.js` 或新建

### IA-9：信箱 UI 重排
- **现象**：信箱信息重叠 + 弹窗定位错位
- **阵地**：`app.js` + `css`

### H-1：fetch 缺 token 头
- **位置**：`nantang-mobile/js/core.js:804`
- **现象**：`fetch('/api/auth/users')` 无 Authorization header → 必 401
- **修**：改用 `API.request('GET', '/api/auth/users')` 或手动加 `Authorization: Bearer ${API.token}`

### H-2：checkin 未传 track
- **位置**：`nantang-mobile/js/app.js:1848` 附近
- **现象**：checkin 请求未传 `track='inn'` → 永远走 coop 轨
- **修**：传 track 参数

## 额外：网站加载优化（B 方案）
- **问题**：index.html:8 `body{visibility:hidden}` + HTTP 模式再隐藏 → 等 API 响应才显示
- **修**：加超时保底，3 秒 API 无响应 → 显示加载提示（spinner / skeleton），不继续白屏
- ~5 行 JS

## 判据（机器可验证）

1. H-1：`core.js:804` 不再裸 `fetch`，带 token
2. H-2：checkin 请求 body 含 `track` 字段
3. 加载优化：白屏 ≤ 3 秒后出现加载提示
4. `node --check` 所有改动文件全绿
5. `?v=` 版本号全部 bump
6. 禁区 `server/` 零改动

## 纪律
- 具名 `git add`，禁 `-A`
- commit message 带卡号：`fix(W5-A): 前端体验+鉴权 IA-7/8/9+H-1/H-2 · 一营`
- 修 js/css 必升 `?v=`（同 commit）
- 不 push
- 回执四件套 + 太傅注三行
