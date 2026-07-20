# nantang-mobile

> 南塘云村 · 移动端代码
> 模块化目录骨架——参照 [App Hub-and-Spoke 架构](../../南塘云村App/架构方案_导航与模块骨架.md)

```
nantang-mobile/
├── index.html              ← 入口，加载所有模块
├── core/
│   ├── data.js             ← 共享数据层
│   ├── eventbus.js         ← 模块间事件通信
│   └── storage.js          ← localStorage/IndexedDB 封装
├── modules/
│   ├── village/            ← 村口（Hub 根节点，三张轮播卡）
│   ├── map/                ← 实景地图（空间交互 + 物品 + 打扫状态灯）
│   ├── tasks/              ← 任务大厅（发布/认领/审核/结算）
│   ├── events/             ← 社区副本（活动列表 + 报名）
│   ├── profile/            ← 我的工作台（四 Tab）
│   ├── economy/            ← NT/CV/XP 三层引擎 + 虚拟账本
│   └── admin/              ← 管理后台（Step 8）
└── ui/
    ├── components/         ← 可复用 UI 组件
    └── theme.css           ← 全局视觉 token
```

## 加载顺序

```html
<!-- core（必须最先加载） -->
<script src="core/data.js"></script>
<script src="core/storage.js"></script>
<script src="core/eventbus.js"></script>

<!-- modules（按依赖顺序） -->
<script src="modules/economy/ledger.js"></script>
<script src="modules/village/main.js"></script>
<script src="modules/map/main.js"></script>
<script src="modules/tasks/main.js"></script>
<script src="modules/events/main.js"></script>
<script src="modules/profile/main.js"></script>
<script src="modules/admin/main.js"></script>

<!-- ui -->
<script src="ui/components/toast.js"></script>
```
