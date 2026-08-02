---
created: '2026-08-02'
type: 任务卡
编号: W7-EVENT-1
标题: 空间事情栏（SpaceEvent 模型 + API + 三档公开度）
派给: 二营+一营
优先级: 🔴 P1（空间孪生双柱之一 · 阻塞档案室 #29）
轨: A 后端（models.py + routes/events.py）+ B 前端（空间页事情栏 widget）
前置: W7-ITEM-1 ✅（物品表建好后，事情可关联物品）
禁区: 不得改 nt.py / community.py；前端不动全貌页（只加空间页内事情栏）
法源: 方案/空间孪生_总架构_设计稿_v0.md + 皇帝 08-02 确认三档公开度
---

> ⚠ **本卡遵循：`Schema\施工流程.md` v0.5**（铁律 10 入口强制）
> **档位**：**大卡** —— 新数据模型 + 跨端
> **触发铁律 8（架构图更新）**：**是** —— 新增 SpaceEvent 模型
> **自检命令（v0.5 M-6）**：`$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/ -q`
> **回执必填**（v0.5 M-2 · 大卡）：commit hash / 验证原始输出 / 爆炸半径四问 / 未验事项 / git status / 太傅注

---

# W7-EVENT-1 · 空间事情栏

## 一、为什么开

皇帝 08-01：「每个建筑是一个容器——装物和事。」
皇帝 08-02：「公共事件就应该是公开的，不需要人来选。有些需要人选的、有争议的，才让人选。」

**现状**：零。没有事情模型、没有事情 API、空间页没有事情栏。

**本卡 = 建 SpaceEvent 表 + API + 前端空间页事情栏 widget。**

## 二、做什么

### EVENT-A · SpaceEvent 模型（models.py）

```python
class SpaceEvent(Base):
    __tablename__ = "space_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(String, ForeignKey("map_locations.key"), nullable=False)  # 发生在哪个空间
    user_id = Column(String, ForeignKey("users.id"))       # 谁做的（NULL=匿名）
    type = Column(String, nullable=False)                   # 事件类型
    text = Column(String, nullable=False)                   # 描述
    visibility = Column(String, default="public")           # public / anonymous / private
    linked_item_id = Column(Integer, ForeignKey("items.id"))# 关联物品（可选）
    linked_task_id = Column(String, ForeignKey("nt_tasks.id"))# 关联任务（可选）
    created_at = Column(String)
```

**三档公开度**：
| 档 | visibility | 谁可见 | 何时用 |
|----|-----------|--------|--------|
| 🌍 公开 | public | 所有人 | 大多数事件（默认） |
| 🎭 匿名 | anonymous | 所有人，但不显示谁做的 | tip/note 可选 |
| 🔒 私密 | private | 仅本人+管理员 | tip/note 可选 / system 强制 |

**公开度规则（事件永远公开，身份可选隐藏）**：

核心逻辑：共享空间里发生的事，**事件本身对全社区可见**。区别只在**做这件事的人是否留名**——这正是校核室「做好事不留名」+ 卡片室「猜猜是谁」的基础。

| 事件类型 | 事件可见 | 身份可选 | 规则 |
|---------|---------|---------|------|
| cooking / cleaning / farming | 🌍 全社区 | 🎭 可选匿名 | 公共劳动，做了好事可以不留名 |
| item_put / item_take | 🌍 全社区 | 🎭 可选匿名 | 共享储物，存取透明，但不强求留名 |
| checkin / checkout | 🌍 全社区 | ❌ 强制留名 | 住宿是正式记录，必须知道谁入住 |
| tip（打赏） | 🌍/🎭/🔒 可选 | ✅ 全可选 | 涉钱+个人关系 |
| note（备注） | 🌍/🎭/🔒 可选 | ✅ 全可选 | 个人记录 |
| system | 🔒 仅管理员 | — | 系统内部 |

**实现方式**：`visibility` 字段存的是身份可见度，不是事件可见度。

| visibility 值 | 含义 | 前端展示 |
|--------------|------|---------|
| `public` | 显示姓名 | 「张三 打扫了厨房」 |
| `anonymous` | 隐藏姓名 | 「🎭 有人打扫了厨房」|
| `private` | 仅本人+管理员可见 | 对他人完全不返回 |

**服务端强制**：
- checkin/checkout → 不接受 visibility 参数，强制 `public`
- system → 强制 `private`
- tip/note → 接受任意 visibility
- 其他 → 接受 `public` 或 `anonymous`，不接受 `private`（共享空间没有"私密劳动"）

**事件类型（String，开放枚举）**：
`cooking / cleaning / farming / item_put / item_take / checkin / checkout / tip / note / system`

### EVENT-B · API 端点（routes/events.py，新建）

```
GET  /api/events?location_id=X&type=Y&limit=50  → 空间事情列表
POST /api/events                                  → 记录事情
GET  /api/events/{id}                             → 单条详情
```

**公开度由服务端决定**：
- `POST /api/events` 时，用户传 `type` + `text` + 可选 `visibility`
- 服务端查表：该 type 是否接受该 visibility？否 → 强制覆盖
- 前端只对允许选的类型展示公开度选择器

### ⚠ 事件匿名 ≠ 物品归属匿名（关键设计区分）

`item_put` / `item_take` 事件可以匿名（"🎭 有人放了一瓶牛奶"），但底层 Item 记录的 `owner_id` 必须始终有值（或明确为 NULL=公用）。**事件是叙事层，物品是数据层——叙事可以模糊，数据不能。** 详见 ITEM-1 卡面同节。

**权限规则**：
- `visibility=private` 的事件，只有本人 + admin 能看到

### EVENT-C · 前端空间页事情栏（nantang-mobile/）

在空间页（`openSpacePage` / 物品栏旁边）加事情栏：

- 三 Tab：今天 / 本周 / 全部
- 每条事情显示：时间 + 描述 + 公开度图标（🌍/🎭/🔒）
- 公开：显示"张三 打扫了厨房"
- 匿名：显示"🎭 有人整理了台面"
- 私密：只本人看到
- 底部「+ 记录事情」按钮 → 弹 Sheet（H 范式）录入

### EVENT-D · 测试（≥4 条）

新建 `test_events.py`：
1. 公开事件所有人可见
2. 匿名事件不返回 user_id
3. 私密事件他人不可见
4. 按 location_id 筛选正确

## 三、不做什么

- 不做卡片室校核接入（卡片室闭环已存在，事件只是记录，校核是另一条链路）
- 不做"猜猜是谁"交互（那是后续交互卡）
- 不做事情归档到档案室（#29）
- 不接弹幕/评论

## 四、影响面

| 问 | 答 |
|---|---|
| 调用方 | 空间页（前端新增 widget）+ 卡片室（可选，不强制） |
| 被依赖方 | 档案室 #29（>30 天归档）+ 物品流转闭环 |
| 关联测试 | `test_events.py`（+4 条） |
| 回滚路径 | 新表 + 新文件，独立 revert 不影响既有功能 |

## 五、自检命令

```
$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/ -q
```

**预期**：ITEM-1 后基线 346 passed + 本卡 4 条 = 350 passed

---

**太傅注**
- 补课：visibility 是 column 不是权限中间件——每条事情自带公开度，存的时候决定，读的时候过滤。比做一个复杂的权限系统简单得多。
- 一句原理：匿名 ≠ 不存 user_id。存了才能防滥用（admin 可追溯），只是 API 返回时洗掉。这是 Wikipedia 的"匿名编辑"模式。
- 不这样做会怎样：不存 user_id = 无法追溯 = 有人发了不该发的东西查不到 = 信任崩。
