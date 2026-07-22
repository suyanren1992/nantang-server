/**
 * 南塘云村 · 飞书多维表格客户端
 * 通过 Cloudflare Worker 代理读写飞书 Bitable 数据
 *
 * 前置：Cloudflare Worker 已部署并可访问
 * 配置：改 WORKER_URL 为实际 Worker 地址
 */
var FEISHU_WORKER = 'https://nantang-feishu.workers.dev';

// ═══ 通用请求 ═══
function _feishuGet(table, params) {
  var qs = params ? '?' + Object.keys(params).map(function(k) { return k + '=' + encodeURIComponent(params[k]); }).join('&') : '';
  return fetch(FEISHU_WORKER + '/feishu/' + table + qs)
    .then(function(r) { return r.json(); })
    .then(function(d) { return d.ok ? d : Promise.reject(d.error); });
}

function _feishuPost(table, fields) {
  return fetch(FEISHU_WORKER + '/feishu/' + table, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
    .then(function(r) { return r.json(); })
    .then(function(d) { return d.ok ? d : Promise.reject(d.error); });
}

// ═══ 营地 ═══
// 字段映射：name/season/type/theme/desc/emoji/status/date/people/max/location/created_by
function feishuCamps()           { return _feishuGet('camps'); }
function feishuCreateCamp(data)  { return _feishuPost('camps', data); }

// ═══ 订餐 ═══
// 字段映射：user/date/meal/status/ordered_at
function feishuMealOrders(user)  { return _feishuGet('meal_orders', { user: user }); }
function feishuOrderMeal(data)   { return _feishuPost('meal_orders', data); }

// ═══ 菜单 ═══
// 字段映射：date/lunch(JSON)/dinner(JSON)
function feishuMenu(date)        { return _feishuGet('canteen_menu', { date: date }); }
function feishuSetMenu(data)     { return _feishuPost('canteen_menu', data); }

// ═══ 人员档案 ═══
// 字段映射：name/role/avatar_seed/wallet_address/location/bio
function feishuProfiles()        { return _feishuGet('user_profiles'); }
function feishuUpsertProfile(data){ return _feishuPost('user_profiles', data); }

// ═══ 公告 ═══
// 字段映射：type/doer/verifier/action/nt_amount/created_at
function feishuAnnouncements()   { return _feishuGet('announcements'); }
function feishuAddAnnouncement(data) { return _feishuPost('announcements', data); }
