# Step 2：空间语义 + 物品标记

> 来源文档：`02_空间地图与物品标记.md`（主要蓝本）、`07_管理后台深化.md`（存储分层部分）
> 前置依赖：Step 0（地图桥接）、Step 1（数据清理）
> 解锁：Step 3（打扫系统）、Step 5（社区活动）

---

## 做什么

地图从「只能看」变成「能交互」。管理员在现有网格地图上框选区域定义空间（厨房/画室/宿舍…），每个空间有子区域（冰箱上层/下层/门架…），点击空间查看和管理物品。物品有完整生命周期（放入→存放→过期→消耗）。

## 关键设计决策

- 地图和物品是一体的——点地图上的厨房→看到冰箱→看到每层有什么，不是两个独立页面
- 子区域模型：空间（厨房）→ 子区域（冰箱·上层）→ 物品（白菜×2）
- 脏污度字段在空间定义时预留，但不在本阶段实现（Step 3 做）
- 照片存 IndexedDB（不在 localStorage 塞 base64），缩略图压缩
- ⚠️ **iOS Safari 7 天数据驱逐**：未添加到主屏幕的 PWA，IndexedDB 在 7 天无活动后可能被系统清理。需在 `<head>` 加 `<meta name="apple-mobile-web-app-capable" content="yes">`，并引导用户添加 App 到主屏幕。Step 7 服务器上线后，照片应同步到服务器作为主存储。
- 过期检查在页面打开时触发，纯前端限制——文档已注明

## 数据模型

### 空间语义层（叠加在已有网格地图上）

```js
// nt_spaces
{
  "coop-1F-kitchen": {
    id: "coop-1F-kitchen",
    name: "厨房",
    type: "kitchen",
    gridArea: { x1:2, y1:3, x2:6, y2:8 },
    subSpaces: [
      { id: "fridge-upper", name: "冰箱·上层", storage: "fridge" },
      { id: "fridge-lower", name: "冰箱·下层", storage: "freezer" },
      { id: "fridge-door", name: "冰箱·门架", storage: "fridge" },
      { id: "cabinet-A", name: "橱柜A", storage: "room_temp" },
      { id: "counter", name: "台面", storage: "room_temp" }
    ]
  }
}
```

### 物品

```js
// nt_inventory.items[]
{
  id: "inv-001",
  name: "白菜", emoji: "🥬", category: "蔬菜",
  quantity: 2, unit: "棵",
  location: "coop-1F-kitchen",
  subLocation: "fridge-upper",
  storage: "fridge",
  putBy: "小杨", putDate: "2026-07-04",
  expiryDate: "2026-07-09", expiryDays: 5,
  status: "fresh",  // fresh | aging | expired | consumed | spoiled | moved
  photo: null,  // 存 IndexedDB，这里只放 key
  note: ""
}
```

### 物品状态流转

```
放入 → fresh →（天数过去）→ aging →（超过到期日）→ expired
                  ↓                ↓                ↓
               被吃掉→consumed  被扔掉→spoiled   被移走→moved
```

## 空间类型与属性

| 类型 | 典型子区域 | 脏污度倍率（Step 3用） |
|------|-----------|:---:|
| kitchen | 冰箱(上层/下层/门架)、橱柜、台面 | 1.5× |
| bedroom | 床、衣柜、书桌 | 0.5× |
| bathroom | 淋浴区、马桶、洗手台 | 2.0× |
| hallway | — | 1.0× |
| storage | 货架A、货架B | 0.3× |
| field | 地块1、地块2... | — |
| studio | 画架区、材料区 | 0.8× |
| laundry | 洗衣机、晾衣区 | 0.5× |
| outdoor | — | — |

## NT 奖励（Step 4 前用现有 NT 系统，Step 4 后切到三栏）

> `ponytail:` 以下代码在 Step 4 执行时需要改造为三栏记账。标注此注释为标记点。

当前（Step 4 前）：
- 添加物品：+2 NT
- 消耗物品（吃掉/用掉）：+1 NT
- 过期丢弃：0 NT

Step 4 后映射：

| 操作 | 原 NT 奖励 | Step 4 三栏（CV + XP） | 说明 |
|------|:--:|:--:|------|
| 添加物品 | +2 NT | +2 CV +2 XP | 不再发放 NT |
| 消耗物品 | +1 NT | +1 CV +1 XP | 不再发放 NT |
| 过期丢弃 | 0 | 0 | 无变化 |

> **注意**：Step 6 时间线中物品操作会自动生成 journal entry（入库 +2 CV +2 XP，出库 +1 CV +1 XP）。**这是同一笔奖励在不同阶段的表现形式，不是双重发放。** Step 4 后物品操作直接走三栏记账，Step 6 的 journal entry 是展示层记录而非第二笔奖励。

## 过期提醒

页面打开时遍历物品：
- expired → 🔴 红色警告
- ≤1天 → 🟡 黄色
- ≤3天 → 🔵 蓝色

在首页顶部横幅显示。

## 具体任务

| # | 任务 | 说明 |
|---|------|------|
| 2.1 | 空间定义 UI | 管理员在地图上框选区域→命名→选类型→加子区域 |
| 2.2 | 空间点击交互 | 点地图空间→弹出空间信息面板（子区域+物品列表+状态） |
| 2.3 | 物品 CRUD | 添加（名称/数量/位置/保质期/照片）+ 消耗（吃/扔/移） |
| 2.4 | 过期追踪 | 每日检查 + 颜色提醒 + 首页过期横幅 |
| 2.5 | 物品 NT 奖励 | 放入 +2，消耗 +1（调 `recordTransaction`） |
| 2.6 | 地图板切换 | 底部 Tab：方位图/宿舍/合作社1F/2F/菜地/周边 |
| 2.7 | IndexedDB 照片存储 | 照片压缩→IndexedDB，localStorage 只存 key |
| 2.8 | 移动端 UI 适配 | 空间面板在移动端小屏优化（非桌面端双栏布局） |

## 验证

打开地图→点厨房→看到冰箱上层有白菜×2（小杨 3 天前放，2 天后过期）→点白菜→可消耗/查看详情。
