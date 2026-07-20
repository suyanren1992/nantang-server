/* ══════════════════════════════════════════════════════════════════
   utils.js — 南塘云村 核心工具（从 app.js 提取）
   Clock / uid / parseMD / 日期工具 / 编码 / 字符串
   ══════════════════════════════════════════════════════════════════ */

// ── Clock：全系统统一时间源（app.js:19-58）──
var Clock = (function () {
  var TZ_MIN = 8 * 60;                 // 锁定 UTC+8（Asia/Shanghai）
  function _wall() { return Date.now(); }   // 真实设备时钟：ID 用，永远真实

  // NT-TEST:START
  // ── 第三期内测注入：冻结时刻（null=真实时间；有值=全系统时间钉在该毫秒）──
  var _frozenMs = null;
  try { var _sv = localStorage.getItem('nt_virtual_ms');            // 加载时恢复，跨刷新/切用户保持同一虚拟日
        if (_sv != null && _sv !== '') { var _n = parseInt(_sv, 10); if (!isNaN(_n)) _frozenMs = _n; } } catch (e) {}
  function _persistV() { try { if (_frozenMs == null) localStorage.removeItem('nt_virtual_ms');
                               else localStorage.setItem('nt_virtual_ms', String(_frozenMs)); } catch (e) {} }
  // NT-TEST:END

  function _now()  {
    // NT-TEST:START
    if (_frozenMs != null) return _frozenMs;
    // NT-TEST:END
    return _wall();
  }  // 应用时钟：冻结则返回虚拟时刻
  function _shift(ms) { return new Date(ms + TZ_MIN * 60000); }  // 移到锁定时区再取字段
  function _p2(n) { return (n < 10 ? '0' : '') + n; }

  return {
    date:  function () { return new Date(_now()); },
    ms:    function () { return _now(); },
    iso:   function () { return new Date(_now()).toISOString(); },     // 完整时间戳（UTC ISO）
    today: function () { var d = _shift(_now());                       // 'YYYY-MM-DD'（UTC+8 日历日）
             return d.getUTCFullYear() + '-' + _p2(d.getUTCMonth() + 1) + '-' + _p2(d.getUTCDate()); },
    hour:  function () { return _shift(_now()).getUTCHours(); },
    min:   function () { return _shift(_now()).getUTCMinutes(); },
    stamp: function () { return _wall().toString(36); },               // ID 前缀；后缀 Math.random() 由调用处保留；恒真实，不受冻结影响
    // NT-TEST:START
    // ── 第三期内测接口（真实模式下永不调用）──
    _setFrozen: function (ms) { _frozenMs = ms; _persistV(); },        // 跳到并冻结在某毫秒
    _step: function (deltaMs) { if (_frozenMs == null) _frozenMs = _wall(); _frozenMs += deltaMs; _persistV(); }, // 步进（±小时/天/周）
    _reset: function () { _frozenMs = null; _persistV(); },            // 恢复真实时间
    _state: function () { return { virtual: _frozenMs != null, ms: _now() }; },
    // NT-TEST:END
  };
})();

// ── 统一 ID 生成（app.js:5-14）──
function uid(prefix) {
  var rand;
  try {
    rand = crypto.randomUUID().slice(0, 8);
  } catch(e) {
    // 回退：crypto.randomUUID 在非 secure context 下不可用
    rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  return (prefix || 'id') + '_' + Clock.stamp() + '_' + rand;
}

// ── 统一日期解析（app.js:61-82）──
function parseMD(s) {
  if (!s) return null;
  // "M/D HH:MM" 或 "M/D H:MM" 格式（如 "7/10 14:30"）——必须在纯日期正则之前
  var m0 = s.match(/(\d+)\/(\d+)\s+(\d{1,2}):(\d{2})/);
  if (m0) return new Date(Clock.date().getFullYear(), parseInt(m0[1]) - 1, parseInt(m0[2]), parseInt(m0[3]), parseInt(m0[4]));
  // "M/D" 格式（如 "7/10"）
  var m1 = s.match(/(\d+)\/(\d+)/);
  if (m1) return new Date(Clock.date().getFullYear(), parseInt(m1[1]) - 1, parseInt(m1[2]));
  // "M月D日" 格式（如 "7月10日"）
  var m2 = s.match(/(\d+)月(\d+)日?/);
  if (m2) return new Date(Clock.date().getFullYear(), parseInt(m2[1]) - 1, parseInt(m2[2]));
  // "YYYY-MM-DD" / "YYYY/MM/DD" 格式（如 "2026-07-10"）—— 必须在 M-D 之前
  var m3 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m3) return new Date(parseInt(m3[1]), parseInt(m3[2]) - 1, parseInt(m3[3]));
  // "M-D" / "M.D" 格式（如 "7-10" / "7.10"）—— 两位数字的短格式
  var m4 = s.match(/^(\d{1,2})[.-](\d{1,2})/);
  if (m4) return new Date(Clock.date().getFullYear(), parseInt(m4[1]) - 1, parseInt(m4[2]));
  // ISO 格式回退
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// ── 日期计算工具（app.js:85-106）──
function daysBetween(a, b) {
  var toDate = function(x) {
    if (x instanceof Date) return x;
    if (typeof x === 'number') return new Date(x);
    var d = parseMD(x); if (d) return d;
    return new Date(x + 'T00:00:00');
  };
  var da = toDate(a), db = toDate(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  var TZ = 8 * 60 * 60000;
  return Math.floor((da.getTime() + TZ) / 86400000) - Math.floor((db.getTime() + TZ) / 86400000);
}
function daysSince(x) { return daysBetween(Clock.today(), x); }
function daysUntil(x) { return daysBetween(x, Clock.today()); }
function getWeekNumber(d) {
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
var ARCHIVE_DAYS = 7;

// ── 防抖工具（app.js:308）──
function _debounce(key, ms, fn) { clearTimeout(window['_dt_'+key]); window['_dt_'+key] = setTimeout(fn, ms); }

// ── 简单哈希（app.js:431-435）──
function simpleHash(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return 'px_' + Math.abs(h).toString(36);
}

// ── 复制到剪贴板（app.js:477-494）──
function copyText(txt) {
  if (!txt) return;
  // 方案1: navigator.clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() { setStatus('✅ 已复制'); }).catch(function() { _fallbackCopy(txt); });
    return;
  }
  _fallbackCopy(txt);
}
function _fallbackCopy(txt) {
  var ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.position = 'fixed'; ta.style.left = '-9999px'; ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); setStatus('已复制：' + txt.slice(0,20) + '...'); } catch(e) { prompt('手动复制：', txt); }
  document.body.removeChild(ta);
}

// ── Auth helpers（app.js:1025）──
// v2: salted iterative hash (old btoa format detected & migrated on login)
function encodePassword(password, username) {
  var SALT = 'N4nT4nG_v2_$4Lt';
  var input = password + ':' + username;
  var hash = SALT;
  // 2000 iterations — one-way, not reversible like btoa
  for (var r = 0; r < 2000; r++) {
    var h = 0;
    var mixed = hash + '|' + input;
    for (var i = 0; i < mixed.length; i++) {
      h = ((h << 5) - h + mixed.charCodeAt(i)) | 0;
    }
    hash = (h >>> 0).toString(36);
    input = input.slice(-1) + input.slice(0, -1); // rotate
  }
  return 'v2$' + hash;
}
// Check if a stored hash is old (btoa) format — for migration
function isOldPasswordFormat(stored) {
  return stored && stored.indexOf('v2$') !== 0;
}

// ── HTML 转义（app.js:8538-8539）──
// Escapes < > & ' " for safe innerHTML and attribute interpolation
function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }
function escHtml(s){return esc(s);}

// ── 相对时间显示（内部）（app.js:4745-4752）──
function _timeAgo(iso) {
  if (!iso) return '';
  var t = new Date(iso).getTime(); if (isNaN(t)) return '';
  var d = Clock.ms() - t; var m = Math.floor(d / 60000);
  if (m < 1) return '刚刚'; if (m < 60) return m + '分钟前';
  var hh = Math.floor(m / 60); if (hh < 24) return hh + '小时前';
  return Math.floor(hh / 24) + '天前';
}

// ── 相对时间显示（app.js:9068-9081）──
function timeAgo(isoStr) {
  if (!isoStr) return '';
  var diff = Clock.ms() - new Date(isoStr).getTime();
  if (diff < 0) return '刚刚';
  var sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  var min = Math.floor(sec / 60);
  if (min < 60) return min + '分钟前';
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + '小时前';
  var day = Math.floor(hr / 24);
  if (day < 30) return day + '天前';
  return Math.floor(day / 30) + '个月前';
}
