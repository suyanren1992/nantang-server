/**
 * ponytail: 最小事件总线 —— 6 行，够用。需要通配符/优先级时再换 EventEmitter2。
 * App 架构 §4.3 定义的事件在此注册和触发。
 *
 * 事件清单（从 App 架构复刻）：
 *   navigate:map?building=X&room=Y    — 跳转地图
 *   navigate:task?taskId=Z            — 跳转任务
 *   navigate:square                   — 回村口
 *   task:updated                      — 任务变更广播
 *   user:balanceChanged               — 余额变更广播
 *   cleaning:submitted                — 新打扫提交（复议通知）
 */
var EventBus = {
  _handlers: {},
  on: function (event, fn) {
    (this._handlers[event] = this._handlers[event] || []).push(fn);
  },
  off: function (event, fn) {
    var hs = this._handlers[event];
    if (hs) this._handlers[event] = hs.filter(function (h) { return h !== fn; });
  },
  emit: function (event, data) {
    (this._handlers[event] || []).forEach(function (fn) { fn(data); });
  }
};
