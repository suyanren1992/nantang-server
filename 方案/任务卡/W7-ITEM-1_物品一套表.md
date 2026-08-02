---
created: '2026-08-02'
type: 任务卡
编号: W7-ITEM-1
标题: 物品一套表（Item 模型 + 迁移 + CRUD + 十档类别 + 保质期）
派给: 二营
优先级: 🔴 P1（阻塞 ITEM-2/ITEM-3/ITEM-4/EVENT-1）
轨: A 后端（server/ 独占 · models.py + database.py + routes/items.py）
前置: 皇帝 08-02 确认空间孪生设计稿
禁区: 不得改 nantang-mobile/；不动现有 User/Pool/NTLedger 模型
法源: 方案/空间孪生_总架构_设计稿_v0.md + 皇帝 08-02 口述决策
---

> ⚠ **本卡遵循：`Schema\施工流程.md` v0.5**（铁律 10 入口强制）
> **档位**：**大卡** —— 新数据模型 + 迁移 + 全站新功能根基
> **触发铁律 8（架构图更新）**：**是** —— 新增 Item 模型 + 物品 CRUD 端点
> **自检命令（v0.5 M-6）**：`$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/ -q`
> **回执必填**（v0.5 M-2 · 大卡）：commit hash / 验证原始输出 / 爆炸半径四问 / 未验事项 / git status / 太傅注
> **复用勘察**（铁律 11）：参考 `StorageItem` 模型（已有，models.py 旧物品表）——本卡新建 `Item` 替代它

## 📋 承接方必读（直接执行，不问）

1. **法源**：`Schema\施工流程.md` v0.5。先读。
2. **档位**：大卡，一项一 commit（铁律 12）。
3. **自检命令**：卡头已写，回执含改前/改后两次原始输出。
4. **零权限越界**：禁区文件一律不碰。

---

# W7-ITEM-1 · 物品一套表

## 一、为什么开

皇帝 08-01：「每个建筑就是一个物品空间——物的对应以及事的对应。」
皇帝 08-02：「十档类别保留，输入时有下拉选择也可以自己输入。录入时默认提醒保质期。」

**现状**：`StorageItem` 模型（models.py）是旧设计，字段不完整、无类别体系、无保质期、无最后确认。全站物品功能建立在此之上，必须先换根基。

**本卡 = 建 Item 表 + CRUD 端点。** 只建基础设施，不做 UI。

## 二、做什么

### ITEM-A · Item 模型（models.py）

```python
class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)              # 物品名
    category = Column(String, nullable=False)            # 十档之一 或 自定义
    location_id = Column(String, ForeignKey("map_locations.key"), nullable=False)  # 在哪个房间
    owner_id = Column(String, ForeignKey("users.id"))    # 物主（NULL=公用）
    put_by = Column(String, ForeignKey("users.id"))      # 谁放的
    quantity = Column(String, default="1")               # 数量/规格（"1L""3颗""半瓶"）
    expiration = Column(String)                          # 保质期/过期日（ISO date，可空）
    state = Column(String, default="active")             # active / consumed / expired / removed / listed
    listed_to = Column(String)                           # 上架到哪（auction / bazaar，NULL=未上架）
    listing_id = Column(String)                          # 上架关联ID
    notes = Column(String)                               # 备注
    last_confirmed = Column(String)                      # 最后确认时间
    created_at = Column(String)
    updated_at = Column(String)
```

**十档类别（硬编码默认值，用户可自定义输入）**：
`酒类 / 蔬菜 / 肉蛋 / 乳品 / 调料 / 主食 / 熟食 / 饮料 / 工具 / 其他`

### ⚠ 物品归属 ≠ 事件匿名（关键设计区分）

**物品必须标明归属，绝不允许匿名。** 冰箱里的牛奶、阁楼里的工具——别人要知道"这是谁的"，才能判断能不能用、过期了该通知谁。

| | 事件（SpaceEvent） | 物品（Item） |
|---|---|---|
| 可以匿名？ | ✅ 可选（"🎭 有人放了一瓶牛奶"） | ❌ 绝不允许 |
| 原因 | 做好事不留名，校核室+卡片室的游戏化基础 | 现实辅助：归属不明 = 没法用 |
| owner 字段 | user_id 存但不对外（anonymous 时） | owner_id 始终对外可见 |
| NULL 含义 | 不适用 | `owner_id=NULL` = 公用物品（社区公物，如扫把/拖把） |

**公用物品**：拖把、扫把、公用的锅——`owner_id=NULL`，表示这是"大家的"。不是匿名，是"没有个人归属"。

### ITEM-B · 数据库迁移（database.py）

幂等迁移（同 NTLedger 修复模式）：
- 建 `items` 表
- 建索引：`location_id` / `owner_id` / `category` / `state` / `expiration`
- 旧 `storage_items` 表不删（渐进迁移，ITEM-3 再切）

### ITEM-C · CRUD 端点（routes/items.py，新建）

```
GET    /api/items?location_id=X&category=Y&owner=Z&state=active   → 物品列表
POST   /api/items                                                  → 放入物品
PUT    /api/items/{id}                                             → 修改物品
DELETE /api/items/{id}                                             → 移除物品
POST   /api/items/{id}/confirm                                     → 标记"还在"
```

### ITEM-D · 保质期提示

`POST /api/items` 时：
- 如果是食物类（蔬菜/肉蛋/乳品/熟食），返回 `{"suggestion": "建议填写保质期"}`，不强拦
- 如果填了 `expiration`，系统按 `expiration - 3天` 标记为"即将过期"（ITEM-3 前端展示用）

### ITEM-E · 测试（≥4 条）

新建 `test_items.py`：
1. 放入物品 + 查列表
2. 按类别筛选
3. 标记"还在"刷新 last_confirmed
4. 食物类未填保质期 → 返回 suggestion

## 三、不做什么

- 不做前端 UI（ITEM-2/ITEM-3）
- 不接上架/售出（ITEM-4）
- 不删旧 `storage_items` 表（渐进迁移）
- 不做最后确认超期提醒（#30 独立派）

## 四、影响面

| 问 | 答 |
|---|---|
| 调用方 | 暂无（本卡只建基础设施） |
| 被依赖方 | ITEM-2/ITEM-3/ITEM-4/EVENT-1 全部依赖此表 |
| 关联测试 | `test_items.py`（+4 条） |
| 回滚路径 | 迁移可逆（新表 DROP 不回滚老 storage_items） |

## 五、自检命令

```
$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/ -q
```

**预期**：基线 342 passed + 本卡 4 条 = 346 passed

---

**太傅注**
- 补课：建新表不删旧表 = 渐进迁移。旧 `storage_items` 还在用，ITEM-3 做前端切换时再统一迁移数据，现在删会炸全貌页。
- 一句原理：`category` 是 String 不是 Enum——因为皇帝要"自定义输入"。String 灵活但查询慢，加索引（`CREATE INDEX idx_items_category ON items(category)`）补回来。
- 不这样做会怎样：拿 Enum 锁死十档 = 用户塞不进"酱料""干货""宠物食品" = 录入卡壳。
