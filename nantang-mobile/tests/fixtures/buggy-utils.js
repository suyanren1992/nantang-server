// S-3a fixture · 故意植入 bug 的假源码（仅供试爆红灯，绝不代表真源码）
// bug1: _p2 不补零（真源码补零）  bug2: repair 阈值错成 99（真源码=5）
var BuggyClock = {
  _p2: function (n) { return "" + n; },              // ❌ 应补零 (n<10?'0':'')+n
  today: function () {
    // 用错误的 _p2 拼日期
    return "2026-" + this._p2(1) + "-" + this._p2(5); // ❌ 得 "2026-1-5" 而非 "2026-01-05"
  },
};
var BuggyBranch = {
  repair: { min: 99, icon: "🔧", name: "修理工" },    // ❌ 真源码 min=5
};
