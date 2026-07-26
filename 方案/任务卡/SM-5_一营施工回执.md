---
created: 2026-07-27
project: 南塘云村
type: 施工回执
domain: 测试基建
card: SM-5
commit: d7cb977
---

# SM-5 一营施工回执（v1.1）

> commit `d7cb977` · 2026-07-27 · Claude Code 一营

---

## 影响面声明

| 层 | 文件 | 改动 | 风险 |
|----|------|------|------|
| **服务端** | `server/routes/admin.py` | 新增 2 端点（dev-reset/dev-seed），~220行；新 import os/json/hashlib/delete/MapLocation/Camp/NTTask | **中**：dev-reset hard 档删全库。双闸保护（DEV_TOOLS_ENABLED+admin），关闭时端点 404，无需担心误触 |
| **服务端** | `server/routes/auth.py` | register 加 `name.strip()` + 查重文案改 | **低**：纯防御性加固，不影响现有用户 |
| **前端** | `nantang-mobile/js/app-data.js` | `reset()` 改 `localStorage.clear()` | **低**：`resetAllData()` 已先调 `localStorage.clear()`，此处为第二道保险 |
| **前端** | `nantang-mobile/index.html` | 4 处 autocomplete 属性 + 🧪测试台 DOM + 3 处 ?v= | **低**：autocomplete 是浏览器提示属性，无功能副作用；测试台仅 admin 渲染 |
| **前端** | `nantang-mobile/js/api.js` | 新增 devReset/devSeed 2 方法（3行） | **低** |
| **前端** | `nantang-mobile/js/core.js` | showMy 显隐测试台 + devReset/devSeed 函数（~35行） | **低**：仅 admin 可见路径 |

- **资金路径**：未碰现有业务资金端点。dev-reset 清 nt_ledger 仅显式调用 + 写日志（池重置写 `pool_init` 账）。dev-seed 用户 NT 走构造器直写（测试数据，无 transaction）。
- **权限逻辑**：未改现有鉴权。dev 端点有独立 `_dev_gate()` 双闸（环境变量 + admin role），不与业务鉴权重合。
- **回滚**：`git revert d7cb977` 一键回滚，零数据迁移。

---

## 爆炸半径四答

1. **调用方**：
   - dev-reset：前端 `devReset(mode)` → `showConfirm` → `API.devReset(mode)` → `POST /api/admin/dev-reset?mode=soft|hard`。仅 🧪测试台按钮触发。
   - dev-seed：前端 `devSeed()` → `showConfirm` → `API.devSeed()` → `POST /api/admin/dev-seed`。仅 🧪测试台按钮触发。
   - register trim：所有注册请求走 `POST /api/auth/register` → `auth.py:register`。前端 `enterVillage()` 已有 `.trim()`（line 1045），服务端再加 `.strip()` 双保险。

2. **被依赖方**：
   - dev-reset hard：`delete(NTTask/Verification/NTLedger/MapLocation/Camp/User)` → 直接 SQL DELETE。池重建走 `CommunityPool` 构造器 + `NTLedger` 写账。
   - dev-reset soft：保留了 users 表，用户余额/贡献值/经验值归零。`CommunityPool` 重置 + 写账。
   - dev-seed：幂等键 = `_seed_id(key)` 生成的可预测 ID（`seed_` + md5 前 8 位）。幂等保证：插入前 `select(...).where(id==seed_id)` 查重。
   - register trim：`name = req.name.strip()` → 后续 `re.fullmatch` 正则 + `select(User).where(User.id == name)` 查重均用 trim 后的值。

3. **关联测试**：
   - `deploy_check.py`：部署配置 / ?v= 一致性 / 语法检查 / 服务冒烟 → **全 PASS**
   - 手动实测清单（留验收）：
     - 非 admin 看不到 🧪测试台；DEV_TOOLS_ENABLED 未设时端点 404
     - 软重置后任务/校核/物品/时间线全空，账号能登
     - 硬重置后需重注册，社区池=500
     - 填充后（无痕重登）：3 任务 / 5 物品（临期+过期警告）/ 3 时间线 / 2 翻牌 / 2 营地无 null / 1 待校核
     - 重复点填充不重复（幂等）
     - 重置后 localStorage 全空（DevTools）+ hard 档登录页账号列表空
     - 注册"张三␣"后无法注册"张三"

4. **回滚路径**：`git revert d7cb977` → index.html ?v= 回退 → push。dev-reset 写入的 `nt_ledger` 池初始化记录会残留（不影响业务——C-7 也写同样格式的 log），其他 seed 数据走 `_seed_id` 前缀 ID 可手动清理。

---

## v1.1 三问对策覆盖

| 问 | 实证 | 对策 | 位置 |
|----|------|------|------|
| ①旧重置清不干净 | `AppData.reset()` 只删 2 key，15+ key（nt_local_roles/nt_mgmt_data/多用户私有数据）残留 | `localStorage.clear()` 全清 | `app-data.js:650` |
| ②重复注册 | `RegisterRequest.name` 无 trim → "张三"与"张三␣"是两个账号 | 服务端 `req.name.strip()` + 前端 `enterVillage()` 已有 `.trim()` + 查重改人话 | `auth.py:65-76`, `core.js:1045` |
| ③密码填充奇怪 | 密码框无 autocomplete → 浏览器乱填/错位填 | regPwd=`new-password`, loginPwd=`current-password`, loginName/regName=`username` | `index.html:54-66` |

---

## 代码变更统计

```
nantang-mobile/index.html     |  22 +++--
nantang-mobile/js/api.js      |   3 +
nantang-mobile/js/app-data.js |   4 +-
nantang-mobile/js/core.js     |  41 ++++++++
server/routes/admin.py        | 218 +++++++++++++++++++++++++++++++++++
server/routes/auth.py         |  14 +--
6 files changed, 282 insertions(+), 20 deletions(-)
```

---

## 🚦 闸口状态

- `python server/scripts/deploy_check.py` → **PASS**（部署配置 / ?v= 一致性 / 语法检查 / 服务冒烟 全绿）
- **待二营验收**（逻辑关/实测关/机检关/真机留砚仁）
- **待丞相 push**

> **太傅注**：补课 §19 数据生命周期。人话——测试台就是砚仁测 bug 的拐杖。之前每次测都要手动注册→手动造数据→测完留一堆垃圾→换设备再来一遍。现在两键：重置清场、填充上菜。v1.1 三问的核心教训是「枚举必漏」：写 `reset()` 时枚举了 2 个 key，后来别人加了 13 个 key 不会回来改 `reset()`——所以清数据必须 `clear()` 全清，不能靠枚举。同理「trim 是信任边界」：前端 trim 了但服务端不 trim，curl 一发带空格的请求就绕过——所以双端都要 trim。
