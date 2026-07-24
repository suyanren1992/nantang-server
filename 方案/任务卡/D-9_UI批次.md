# 任务卡 D-9：UI 批次（小屏/safe-area/原生弹窗/防抖/滚动锁定）🟠

> 施工方：Claude Code（一营） · 监察：Kimi Code · 验收：Kimi Work · 单独 commit，不 push
> 来源：《全面权限扫描_B方案_2026-07-24》H-9 + M-5/M-6/M-7/M-8 + L-4/L-8

## 清单（逐项修，一次 commit）
1. **H-9 村口小屏裁剪**：`css/main.css:100` `.village-group` 固定 top:200px + `.village-window` 340px = 540px，iPhone SE（可视约 500px）底部被裁 → 改相对定位或 `calc(100vh - 头部高度)`，375×667 与 320×568 都不裁
2. **M-8 村口品牌区缺刘海屏适配**：`main.css:95` 加 `env(safe-area-inset-top)`
3. **L-8 子页面底部硬编码 80px**：`main.css:289` 改 `calc(80px + env(safe-area-inset-bottom, 0px))`
4. **L-4 Overlay 关闭按钮 32×32 < 44px 触摸目标**：`main.css:287` 调到 ≥44×44（视觉尺寸可不变，扩大可点区域即可）
5. **M-7 Overlay 打开时无 body 滚动锁定**（iOS 橡皮筋穿透，`main.css:282` 相关）：overlay open 时给 body 加 `overflow:hidden` class，关闭时移除
6. **M-6 我的任务搜索无防抖**：`index.html:127` `oninput="renderMyTasks()"` 每次按键全量渲染 → 包一层现有 `_debounce`
7. **M-5 原生 confirm()/prompt() 替换**：`js/ui-cardroom.js:520` 等约 8 处 → 统一换 `_showModal()`/现有自定义弹窗（原生弹窗可被浏览器"阻止对话框"静默吞掉）

## 验收
- Chrome DevTools 设备模拟 iPhone SE：村口三卡完整可见、无底部裁剪；overlay 打开时背景不跟着滚
- 全局搜不到残留 `confirm(`/`prompt(`（showConfirm 等自定义函数除外）
- 遵守铁律 6：升 main.css / index.html 引用及各改动 js 的 ?v=
- commit message：`fix(D-9): UI 批次——小屏裁剪/safe-area/触摸目标/滚动锁定/搜索防抖/原生弹窗替换（H-9+M-5~M-8+L-4/L-8）`
