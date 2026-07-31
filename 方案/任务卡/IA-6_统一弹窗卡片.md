---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: UI体验
task_status: 已发卡
status: 讨论中
series: IA
---
# IA-6 统一弹窗卡片替代浏览器 alert（一营施工）

> 来源：砚仁测试反馈 ②③（猜人提示丑 + 发任务提示不友好）
> 施工：Claude Code（一营）｜验收：施工二营
> 优先级：**P1 体验修复**（~1.5h）
> 法源：砚仁终审

---

## 施工内容

### 浏览器 alert/confirm → 卡片弹窗组件

**现状**：多处使用浏览器原生 `alert()` / `confirm()`，弹出样式丑、夹缝显示、与整体 UI 不搭。

砚仁原话：
> "提示词应该是再多一个弹窗卡片，而不是从浏览器上方弹出……以最好看的提示方式去提示"

**修复**：

1. **搜索所有 `alert(` 和 `confirm(` 调用**（排除 `showConfirm` / `showToast` 已有的美化调用）

2. **新建统一弹窗组件 `_showAlertCard(options)`**：
   - 卡片式弹窗（居中、圆角、阴影、动画）
   - 支持 `type: 'info' | 'warn' | 'error' | 'success'`
   - 支持 `title` + `message` + `onConfirm` + `onCancel`
   - 复用现有 `showConfirm()` 如果它已满足卡片样式需求

```js
// 示例组件（一营自行设计更好看的版本）
function _showAlertCard(opts) {
  var overlay = document.createElement('div');
  overlay.className = 'alert-overlay';
  overlay.innerHTML = '<div class="alert-card ' + (opts.type||'info') + '">' +
    '<div class="alert-card-title">' + esc(opts.title||'提示') + '</div>' +
    '<div class="alert-card-msg">' + esc(opts.message||'') + '</div>' +
    '<div class="alert-card-btns">' +
    '<button class="alert-card-btn ok" onclick="this.closest(\'.alert-overlay\').remove()">' + (opts.okText||'知道了') + '</button>' +
    (opts.cancelText ? '<button class="alert-card-btn cancel" onclick="this.closest(\'.alert-overlay\').remove()">' + opts.cancelText + '</button>' : '') +
    '</div></div>';
  document.body.appendChild(overlay);
}
```

3. **CSS 样式**（与现有主题一致）：
   - `.alert-overlay`：固定定位全屏遮罩
   - `.alert-card`：居中白色卡片，圆角 16px，阴影
   - 入场动画 fadeIn + scale

4. **逐处替换**：找到每个 `alert(` / `confirm(` 调用，替换为 `_showAlertCard()` 或已有的 `showConfirm()`

> 重点替换场景（砚仁反馈）：
> - 猜人时"不能猜自己"的提示
> - 发任务失败时的提示
> - 其他所有浏览器原生弹窗

## 禁区

- `server/` 零改动
- 不改 `showConfirm()` / `showToast()` 现有逻辑（可复用）

## 爆炸半径

- 改几个文件：1-2（app.js，可能 ui-cardroom.js / ui-phase4.js）
- 影响功能：所有用户提示弹窗
- 破坏性变更：无（替换实现方式，不改触发逻辑）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `node --check` 全绿

## 判据

1. `grep -rn '\balert(' nantang-mobile/js/` → 0 匹配（排除 console 和注释）
2. `grep -rn '\bconfirm(' nantang-mobile/js/` → 只剩 `showConfirm`（排除原生 confirm）
3. 弹窗样式：居中卡片 + 圆角 + 阴影 + 动画（非浏览器顶部弹出）
4. 猜自己时弹出卡片式提示（非 alert）
5. `node --check` 全绿
