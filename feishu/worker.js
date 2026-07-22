/**
 * 南塘云村 · 飞书多维表格 Worker
 * 部署到 Cloudflare Workers，作为前端与飞书 Bitable 之间的 token 代理
 *
 * 环境变量（Cloudflare Dashboard → Settings → Variables）：
 *   FEISHU_APP_ID      — 自建应用的 App ID
 *   FEISHU_APP_SECRET  — 自建应用的 App Secret
 *   FEISHU_APP_TOKEN   — 多维表格 Base 的 app_token（URL 里那串）
 *   ALLOWED_ORIGIN     — 前端域名，如 https://nantang.pages.dev
 *
 * 使用：
 *   GET  /feishu/camps           → 查营地列表
 *   POST /feishu/meal_orders     → 新增订餐
 *   GET  /feishu/canteen_menu    → 查菜单
 *   GET  /feishu/user_profiles   → 查人员档案
 *   GET  /feishu/announcements   → 查公告
 */

const FEISHU_TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
const FEISHU_BITABLE_BASE = 'https://open.feishu.cn/open-apis/bitable/v1';

// 内存缓存 token（Worker 实例生命周期内有效，通常几分钟到几小时）
let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) return cachedToken; // 提前 1 分钟刷新

  const resp = await fetch(FEISHU_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: ENV.FEISHU_APP_ID,
      app_secret: ENV.FEISHU_APP_SECRET,
    }),
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`飞书 token 获取失败: ${data.msg}`);
  cachedToken = data.tenant_access_token;
  tokenExpiresAt = now + data.expire * 1000;
  return cachedToken;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ENV.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function tableId(tableName) {
  // 每张表的 table_id（在飞书 Base 里每个表有唯一 ID，建好表后填入）
  const MAP = {
    camps:           ENV.FEISHU_TABLE_CAMPS           || 'tblXXXXXXXXXXXXX',
    meal_orders:     ENV.FEISHU_TABLE_MEAL_ORDERS     || 'tblXXXXXXXXXXXXX',
    canteen_menu:    ENV.FEISHU_TABLE_CANTEEN_MENU    || 'tblXXXXXXXXXXXXX',
    user_profiles:   ENV.FEISHU_TABLE_USER_PROFILES   || 'tblXXXXXXXXXXXXX',
    announcements:   ENV.FEISHU_TABLE_ANNOUNCEMENTS   || 'tblXXXXXXXXXXXXX',
  };
  return MAP[tableName] || tableName;
}

export default {
  async fetch(request, env) {
    // 让 Worker 内可以访问环境变量
    globalThis.ENV = env;

    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // 只处理 /feishu/* 路径
    if (!path.startsWith('/feishu/')) {
      return new Response('Not Found', { status: 404 });
    }

    const [, , table] = path.split('/'); // /feishu/camps → table=camps
    const tid = tableId(table);
    const token = await getToken();

    try {
      if (request.method === 'GET') {
        // 查询记录（支持 ?page_size=50&page_token=xxx）
        const pageSize = url.searchParams.get('page_size') || 50;
        const pageToken = url.searchParams.get('page_token') || '';
        const qs = `?page_size=${pageSize}${pageToken ? '&page_token=' + pageToken : ''}`;
        const resp = await fetch(
          `${FEISHU_BITABLE_BASE}/apps/${env.FEISHU_APP_TOKEN}/tables/${tid}/records${qs}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await resp.json();
        // 简化返回：只给 items 数组
        const items = (data.data?.items || []).map(r => ({ id: r.record_id, ...r.fields }));
        return new Response(JSON.stringify({ ok: true, items, has_more: data.data?.has_more || false, page_token: data.data?.page_token || '' }), { headers: corsHeaders() });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        // 新增记录
        const resp = await fetch(
          `${FEISHU_BITABLE_BASE}/apps/${env.FEISHU_APP_TOKEN}/tables/${tid}/records`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: body }),
          }
        );
        const data = await resp.json();
        if (data.code !== 0) {
          return new Response(JSON.stringify({ ok: false, error: data.msg }), { status: 400, headers: corsHeaders() });
        }
        return new Response(JSON.stringify({ ok: true, id: data.data?.record?.record_id }), { headers: corsHeaders() });
      }

      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: corsHeaders() });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders() });
    }
  },
};
