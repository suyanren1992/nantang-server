# 飞书多维表格集成 · 配置指南

> 2026-07-22 · 配合 Cloudflare Worker + 前端 feishu.js

---

## 一、飞书侧配置

### 1. 创建自建应用
1. 打开 [飞书开放平台](https://open.feishu.cn/app)
2. 创建企业自建应用 → 拿到 **App ID** 和 **App Secret**
3. 权限配置 → 添加 `bitable:app`（多维表格读写权限）
4. 发布应用（仅企业内部可用即可）

### 2. 创建多维表格 Base
1. 飞书客户端 → 新建 → 多维表格
2. 命名为「南塘云村」
3. 在 Base 里建 5 张表（表名固定，table_id 后续填入 Worker 环境变量）：

**表 1: camps（营地）**
| 字段 | 类型 | 说明 |
|------|------|------|
| name | 文本 | 营地名称 |
| season | 文本 | 所属季度 |
| type | 文本 | 类型 |
| emoji | 文本 | 图标 |
| status | 单选 | active/upcoming/archived |
| date | 文本 | 日期 |
| people | 数字 | 人数 |
| max | 数字 | 上限 |
| location | 文本 | 地点 |
| created_by | 文本 | 创建人 |

**表 2: meal_orders（订餐）**
| 字段 | 类型 | 说明 |
|------|------|------|
| user | 文本 | 用户名 |
| date | 文本 | 日期 YYYY-MM-DD |
| meal | 文本 | 餐别 lunch/dinner |
| status | 单选 | ordered/cancelled |
| ordered_at | 文本 | 下单时间 |

**表 3: canteen_menu（菜单）**
| 字段 | 类型 | 说明 |
|------|------|------|
| date | 文本 | 日期 YYYY-MM-DD（唯一） |
| lunch | 文本 | 午餐菜品 JSON 数组 |
| dinner | 文本 | 晚餐菜品 JSON 数组 |

**表 4: user_profiles（人员档案）**
| 字段 | 类型 | 说明 |
|------|------|------|
| name | 文本 | 用户名（主键） |
| role | 单选 | admin/builder/adventurer/npc/visitor |
| avatar_seed | 文本 | DiceBear 头像种子 |
| wallet_address | 文本 | OP Chain 钱包地址 |
| location | 文本 | 当前坐标/位置 |
| bio | 文本 | 个人简介 |

**表 5: announcements（公告）**
| 字段 | 类型 | 说明 |
|------|------|------|
| type | 文本 | 公告类型 |
| doer | 文本 | 劳动者 |
| verifier | 文本 | 校核人 |
| action | 文本 | 劳动内容 |
| nt_amount | 数字 | NT 金额 |
| created_at | 文本 | 时间 |

### 3. 获取每张表的 table_id
- 打开每张表 → 浏览器地址栏 URL 里的 `tblXXXXXXXXXXXXX` 就是 table_id
- 也可以点「...」→ 复制链接 → 提取 table_id

### 4. 获取 Base 的 app_token
- Base 首页 → 浏览器地址栏 `https://xxx.feishu.cn/base/` 后面那串就是

---

## 二、Cloudflare Worker 部署

### 1. 安装 wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 wrangler.toml
```toml
name = "nantang-feishu"
main = "worker.js"
compatibility_date = "2026-07-22"

[vars]
ALLOWED_ORIGIN = "https://nantang.pages.dev"
FEISHU_APP_TOKEN = "替换为你的 Base app_token"

# 每张表的 table_id（创建表后从飞书 URL 获取）
FEISHU_TABLE_CAMPS = "tblXXXXXXXXXXXXX"
FEISHU_TABLE_MEAL_ORDERS = "tblXXXXXXXXXXXXX"
FEISHU_TABLE_CANTEEN_MENU = "tblXXXXXXXXXXXXX"
FEISHU_TABLE_USER_PROFILES = "tblXXXXXXXXXXXXX"
FEISHU_TABLE_ANNOUNCEMENTS = "tblXXXXXXXXXXXXX"
```

### 3. 设置密钥（不进代码仓库）
```bash
wrangler secret put FEISHU_APP_ID
wrangler secret put FEISHU_APP_SECRET
```

### 4. 部署
```bash
wrangler deploy
```
部署后会得到 Worker 地址如 `https://nantang-feishu.workers.dev`

---

## 三、前端配置

修改 `nantang-mobile/js/feishu.js` 第 10 行：
```javascript
var FEISHU_WORKER = 'https://nantang-feishu.workers.dev'; // ← 改成你的 Worker 地址
```

---

## 四、验证

```bash
# 测试营地读取
curl https://nantang-feishu.workers.dev/feishu/camps
# 应返回 { "ok": true, "items": [...] }

# 测试订餐写入
curl -X POST https://nantang-feishu.workers.dev/feishu/meal_orders \
  -H "Content-Type: application/json" \
  -d '{"user":"砚仁","date":"2026-07-22","meal":"lunch","status":"ordered","ordered_at":"2026-07-22T08:00:00"}'
```

---

## 五、数据流总览

```
用户打开南塘云村
    │
    ├── 查看营地列表  →  feishu.js.feishuCamps()  →  Worker  →  飞书 Bitable
    ├── 订餐          →  feishu.js.feishuOrderMeal()  →  Worker  →  飞书
    ├── 查看菜单      →  feishu.js.feishuMenu()  →  Worker  →  飞书
    ├── 发布任务/NT   →  api.js → FastAPI server → SQLite (不变!)
    └── 校核/提现     →  api.js → FastAPI server → SQLite (不变!)
```

**金融真相源仍然是服务端 SQLite。飞书只存运营类数据。**
