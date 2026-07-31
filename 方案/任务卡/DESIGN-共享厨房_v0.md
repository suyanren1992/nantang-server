━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 设计卡
  卡号：DESIGN-共享厨房_v0
  阶段：UI-DESIGN-PACK 补·独立设计（砚仁 18:00 厘清）
  施工方：丞相 Codex（设计）+ 一营（FE 实施）+ 二营（BE 表+端点）
  验收方：皇帝 砚仁
  立卡：丞相 Codex 2026-07-31 18:18
  法源：砚仁 18:00+ 原话
    「对不对？素食是素食，宿宿舍的那个订餐是订宿舍的餐啊。
     但是呢，我们合作社大院里面有一个厨房，这个厨房它是共享厨房。
     共享厨房和订餐是完全两个概念，一个是有厨师做，由这个宿舍的管理员去发布菜单，
     另一个是自己做，也就是说，在住住在这个宿舍的合作社的成员，他们可以去使用啊，
     包括外来的人也可以去使用，但是使用前提是大家不要冲撞在一起，
     所以共享厨房是共享厨房，订餐是订餐，这是两个概念，
     而这个共享厨房，就是对应着全茂业里面的那个厨房，
     里面的那个放置物品的那个厨房，所以你到底有没有清楚这个意思」
  优先级：HIGH（概念厘清·数据表先行·1 营 + 2 营都需此卡）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【关键概念厘清】
  ┌──────────────────┬──────────────────┐
  │ 共享厨房         │ 订餐             │
  ├──────────────────┼──────────────────┤
  │ 谁做饭 │ 自己   │ 别人（厨师/管理员）│
  │ 谁用  │ 合作社 + 外来 │ 民宿住客    │
  │ 容量  │ ≤10 人 │ 菜单定            │
  │ 预约  │ >20 人需申请 │ 当日订      │
  │ 物品  │ 共享冰箱 │ 餐费            │
  │ 表    │ potluck_event │ meal_order │
  │        │ kitchen_slot  │            │
  │        │ kitchen_booking │          │
  │        │ shared_item    │            │
  │ UI    │ 厨房面板 + 共享厨房页 │ 订餐页 │
  │ 入口  │ 全貌页·厨房 │ 素社民宿      │
  └──────────────────┴──────────────────┘

  ❌ 砚仁原话中**从未**有「田间接龙」——这是丞相捏造（8867b0b 已删）
  ✅ 砚仁原话中是「共享厨房接龙」与「共享厨房预定」

━━━━━━━━━━━━━━━━━━━━━━━━━━
## 一、数据表设计（BE 二营施工）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  ### 1.1 potluck_event（接龙事件表）
  ```sql
  CREATE TABLE potluck_event (
    event_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id    INTEGER NOT NULL,  -- 发起人
    title           TEXT NOT NULL,      -- 标题「周六火锅局」
    dish            TEXT NOT NULL,      -- 菜式
    event_at        DATETIME NOT NULL,  -- 时间
    capacity        INTEGER DEFAULT 8,  -- 人数上限
    current_count   INTEGER DEFAULT 1,  -- 已报名
    description     TEXT,
    status          TEXT DEFAULT "open", -- open/full/closed/done
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES user(id)
  );
  ```

  ### 1.2 potluck_participant（接龙参与者表）
  ```sql
  CREATE TABLE potluck_participant (
    participant_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id        INTEGER NOT NULL,
    user_id         INTEGER NOT NULL,
    role            TEXT DEFAULT "participant", -- participant/organizer
    portion         INTEGER DEFAULT 1,  -- 几人份
    joined_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES potluck_event(event_id),
    FOREIGN KEY (user_id) REFERENCES user(id)
  );
  ```

  ### 1.3 kitchen_slot（厨房时段表）
  ```sql
  CREATE TABLE kitchen_slot (
    slot_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    start_at        DATETIME NOT NULL,
    end_at          DATETIME NOT NULL,
    capacity        INTEGER DEFAULT 10, -- 同时段最多 10 人
    booker_id       INTEGER,             -- 申请人
    group_name      TEXT,                -- 申请团体名
    dish            TEXT,                -- 计划菜品
    party_size      INTEGER DEFAULT 1,   -- 来的人数
    status          TEXT DEFAULT "open", -- open/pending/approved/occupied/done
    note            TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booker_id) REFERENCES user(id)
  );
  ```

  ### 1.4 shared_item（共享物品表·冰箱）
  ```sql
  CREATE TABLE shared_item (
    item_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,        -- 「牛奶」「面粉」
    category        TEXT,                 -- food/condiment/tool/other
    owner_id        INTEGER NOT NULL,     -- 物主
    location        TEXT DEFAULT "fridge",-- fridge/cabinet/counter
    quantity        TEXT,                 -- 「1L」「500g」
    produced_at     DATE,                 -- 生产日期
    expired_at      DATE,                 -- 过期日
    note            TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES user(id)
  );
  ```

━━━━━━━━━━━━━━━━━━━━━━━━━━
## 二、API 端点设计（BE 二营）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  | # | 端点 | 方法 | 说明 |
  |---|------|------|------|
  | 1 | `/api/kitchen/potluck/list` | GET | 接龙列表（open/full） |
  | 2 | `/api/kitchen/potluck/create` | POST | 创建接龙 |
  | 3 | `/api/kitchen/potluck/join` | POST | 报名接龙 |
  | 4 | `/api/kitchen/slots/list` | GET | 时段列表（按日期） |
  | 5 | `/api/kitchen/slots/book` | POST | 申请时段（≤10 自动过，>20 需审核） |
  | 6 | `/api/kitchen/slots/release` | POST | 释放时段 |
  | 7 | `/api/kitchen/items/list` | GET | 共享物品清单 |
  | 8 | `/api/kitchen/items/add` | POST | 放入物品 |
  | 9 | `/api/kitchen/items/take` | POST | 取出物品 |
  | 10 | `/api/kitchen/items/remove` | DELETE | 移除物品（owner/admin） |

  容量规则：
  - party_size ≤ 10：自动 approved
  - 10 < party_size ≤ 20：管理员审核
  - party_size > 20：拒绝（需拆分为多个 slot）

━━━━━━━━━━━━━━━━━━━━━━━━━━
## 三、UI 设计（FE 一营施工）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  ### 3.1 共享厨房页（主入口）
  - 入口：全貌页 🍳 厨房·冰箱 卡 → openKitchenPage()
  - 顶部 Banner：「共享厨房 ≠ 订餐」说明
  - 3 Tab：
    1. 🍲 接龙（potluck_event 列表 + 创建按钮）
    2. 📅 时段（kitchen_slot 日历视图 + 申请按钮）
    3. 🧊 冰箱（shared_item 物品清单 + 放入/取出）

  ### 3.2 接龙 Tab
  - 顶部「+ 创建接龙」FAB
  - 卡片网格：每张 UI.Card
    - head：🍲 图标 + 标题
    - body：时间 + 人数「3/8」+ 发起人头像
    - actions：[报名] [详情] [取消（仅发起人）]
  - 满员状态：卡片置灰 + 「已满」标签
  - 关闭状态：折叠 + 「已结束」标签

  ### 3.3 时段 Tab
  - 顶部：周历（7 天横向）
  - 每天显示 3 个时段（早/午/晚）
  - 时段格：已申请/空闲/已满 三态
  - 点击空闲格 → 弹申请表单（时段 + 团体名 + 菜品 + 人数）
  - 容量提示：「≤10 自动通过 · 11-20 待审 · >20 拒绝」

  ### 3.4 冰箱 Tab
  - 顶部：分类筛选（全部/食材/调料/工具）
  - 卡片网格：每张 UI.Card
    - head：🧊 图标 + 名称
    - body：数量 + 位置 + 过期日（红色高亮 3 天内过期）
    - actions：[取出] [详情] [删除（仅物主/admin）]
  - 顶部「+ 放入物品」FAB → 弹表单（名称 + 分类 + 数量 + 过期日）

  ### 3.5 复用块面
  - UI.Card（已有）
  - UI.Icon（已有）
  - UI.StatusBadge（已有）
  - UI.Modal（已有）
  - UI.Form（已有）
  - UI.Drawer（待建·工作台快速抽屉已有设计）

━━━━━━━━━━━━━━━━━━━━━━━━━━
## 四、与社区副本的相通（砚仁原话·18:05）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  砚仁原话：
  「与这个社区副本那边的相通的内容」

  相通点：
  1. **活动页 ↔ 接龙**：接龙活动可在社区活动页显示
  2. **议事厅 ↔ 时段申请**：超过 20 人的团体申请需经议事厅审核
  3. **通知 ↔ 接龙状态**：接龙创建/满员/取消 → 通知参与者
  4. **共享物品 ↔ 营队任务**：可发起「捐食物」任务
  5. **NT 经济 ↔ 时段费**：使用厨房时段可扣 NT（管理员配置）

━━━━━━━━━━━━━━━━━━━━━━━━━━
## 五、约束
━━━━━━━━━━━━━━━━━━━━━━━━━━

  - BE 二营：1 张表 4 个 + 10 端点 + 8 测试 + 1 commit
  - FE 一营：1 张页面 + 4 Tab + 接入 10 端点 + 1 commit
  - 设计稿：1 份 ≤ 500 行
  - 不引第三方库
  - 与订餐（C-B-5 素社民宿）明确分离
  - 与社区副本通过事件流（activity_log + notification）联动

【回执落盘】
  - 丞相：方案/设计/UI-DESIGN-共享厨房_2026-07-31.md
  - 二营：方案/任务卡/P3-二营乙_共享厨房数据表_回执_二营_2026-07-31.md
  - 一营：方案/任务卡/P3-一营⑥_共享厨房FE_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **共享厨房 ≠ 订餐**——用户亲口说两次，铁律级
  - **数据表先行**——4 张表是设计落地的前提，BE 不立表 FE 必撞墙
  - **与社区副本相通**——接龙入活动页、时段申请入议事厅、状态变更入通知
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━