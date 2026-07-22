/**
 * 南塘云村 · 飞书 Bitable 客户端 v2
 * 全部 API 走 Cloudflare Worker，零自建服务器
 *
 * 配置：改 WORKER_URL 为实际 Worker 地址
 */
var FEISHU_WORKER = 'https://nantang-feishu.workers.dev';

// ═══ 通用请求 ═══
function _fw(path, method, body) {
  var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(FEISHU_WORKER + path, opts)
    .then(function(r) { return r.json(); });
}

// ═══ 认证（Worker 处理注册/登录，查飞书 users 表） ═══
function feishuRegister(name, password) { return _fw('/api/auth/register', 'POST', { name: name, password: password }); }
function feishuLogin(name, password)    { return _fw('/api/auth/login', 'POST', { name: name, password: password }); }

// ═══ NT 系统 ═══
function feishuSync()          { return _fw('/api/nt/sync', 'GET'); }
function feishuPools()         { return _fw('/api/nt/pools', 'GET'); }

// ═══ 运营表 ═══
function feishuCamps()         { return _fw('/feishu/camps', 'GET'); }
function feishuMealOrders(u)   { return _fw('/feishu/meal_orders', 'GET'); }
function feishuMenu(date)      { return _fw('/feishu/canteen_menu?date=' + (date||''), 'GET'); }
function feishuProfiles()      { return _fw('/feishu/user_profiles', 'GET'); }
function feishuAnnouncements() { return _fw('/feishu/announcements', 'GET'); }
function feishuPost(table, data) { return _fw('/feishu/' + table, 'POST', data); }
