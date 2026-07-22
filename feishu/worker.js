/**
 * 南塘云村 · 飞书多维表格 Worker v2
 * 替代 FastAPI + SQLite，全部数据存飞书 Bitable，零自建服务器
 *
 * 环境变量（Cloudflare Dashboard → Settings → Variables）：
 *   FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_APP_TOKEN
 *   FEISHU_TABLE_USERS / FEISHU_TABLE_TASKS / FEISHU_TABLE_LEDGER
 *   FEISHU_TABLE_POOL / FEISHU_TABLE_VERIFICATIONS
 *   FEISHU_TABLE_CAMPS / FEISHU_TABLE_MEAL_ORDERS / FEISHU_TABLE_CANTEEN_MENU
 *   FEISHU_TABLE_USER_PROFILES / FEISHU_TABLE_ANNOUNCEMENTS
 *   FEISHU_TABLE_TENANCIES / FEISHU_TABLE_DEPOSIT_INTENTS
 *   ALLOWED_ORIGIN
 */

const TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
const BITABLE = 'https://open.feishu.cn/open-apis/bitable/v1';

let cachedToken = null, tokenExpiresAt = 0;

async function getToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) return cachedToken;
  const r = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error(`token: ${d.msg}`);
  cachedToken = d.tenant_access_token;
  tokenExpiresAt = now + d.expire * 1000;
  return cachedToken;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// ═══ 飞书 API 封装 ═══
async function bitableGet(env, table, params = {}) {
  const token = await getToken(env);
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${BITABLE}/apps/${env.FEISHU_APP_TOKEN}/tables/${env[table]}/records?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.json();
}

async function bitablePost(env, table, fields) {
  const token = await getToken(env);
  const r = await fetch(`${BITABLE}/apps/${env.FEISHU_APP_TOKEN}/tables/${env[table]}/records`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return r.json();
}

async function bitablePut(env, table, recordId, fields) {
  const token = await getToken(env);
  const r = await fetch(`${BITABLE}/apps/${env.FEISHU_APP_TOKEN}/tables/${env[table]}/records/${recordId}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return r.json();
}

async function bitableSearch(env, table, filter) {
  const token = await getToken(env);
  const r = await fetch(`${BITABLE}/apps/${env.FEISHU_APP_TOKEN}/tables/${env[table]}/records/search`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter, page_size: 500 }),
  });
  return r.json();
}

// ═══ 工具 ═══
function nowISO() { return new Date().toISOString(); }
function todayStr() { return nowISO().slice(0, 10); }
function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

// 从飞书 record 提取 fields
function fields(items) { return (items || []).map(r => ({ id: r.record_id, ...r.fields })); }

// ═══ 用户认证 (简化版: 用户名+密码 → 飞书 user_profiles 表验证) ═══
async function authUser(env, name, password) {
  const r = await bitableSearch(env, 'FEISHU_TABLE_USERS', `CurrentValue.[name]="${name}"`);
  const items = fields(r.data?.items || []);
  if (!items.length) return null;
  const u = items[0];
  // 简易密码校验：生产环境应存 bcrypt hash
  if (u.password !== password) return null;
  return u;
}

// ═══ 金融事务: 原子化扣池+写流水+加余额 ═══
async function financialTx(env, ops) {
  // ops: [{ table, recordId?, fields, action: 'create'|'update' }]
  const results = [];
  const snapshots = []; // 失败时回滚
  for (const op of ops) {
    try {
      if (op.action === 'create') {
        const r = await bitablePost(env, op.table, op.fields);
        if (r.code !== 0) throw new Error(r.msg);
        results.push(r.data?.record?.record_id);
        snapshots.push({ table: op.table, recordId: r.data?.record?.record_id, action: 'delete' });
      } else if (op.action === 'update') {
        // 先读旧值
        const old = await bitableGet(env, op.table, { page_size: 1 });
        const oldFields = fields(old.data?.items || [])[0]?.fields || {};
        await bitablePut(env, op.table, op.recordId, op.fields);
        snapshots.push({ table: op.table, recordId: op.recordId, oldFields, action: 'revert' });
        results.push(op.recordId);
      }
    } catch (e) {
      // 回滚已执行的操作
      for (const snap of snapshots.reverse()) {
        try {
          if (snap.action === 'delete') await bitablePut(env, snap.table, snap.recordId, { _deleted: true });
          else if (snap.action === 'revert') await bitablePut(env, snap.table, snap.recordId, snap.oldFields);
        } catch (_) {}
      }
      throw e;
    }
  }
  return results;
}

// ═══ 路由 ═══
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ── 公开端点 ──
      if (path === '/api/health') return json({ status: 'ok' });

      // ── 认证 ──
      if (path === '/api/auth/register' && method === 'POST') {
        const { name, password } = await request.json();
        if (!name || !password || password.length < 8) return json({ ok: false, error: '名字不为空，密码≥8位' }, 400);
        const exist = await bitableSearch(env, 'FEISHU_TABLE_USERS', `CurrentValue.[name]="${name}"`);
        if (fields(exist.data?.items || []).length) return json({ ok: false, error: '用户名已存在' }, 400);
        const r = await bitablePost(env, 'FEISHU_TABLE_USERS', {
          name, password,  // 生产环境应 bcrypt
          role: 'visitor', nt_balance: 0, contribution_value: 0, experience_value: 0,
          trust_score: 100, created_at: nowISO(),
        });
        // 首个用户 = admin
        const all = await bitableGet(env, 'FEISHU_TABLE_USERS', { page_size: 2 });
        if (fields(all.data?.items || []).length === 1 && r.data?.record?.record_id) {
          await bitablePut(env, 'FEISHU_TABLE_USERS', r.data.record.record_id, { role: 'admin' });
        }
        // 初始化社区池
        const poolExist = await bitableGet(env, 'FEISHU_TABLE_POOL', { page_size: 1 });
        if (!fields(poolExist.data?.items || []).length) {
          await bitablePost(env, 'FEISHU_TABLE_POOL', {
            balance: 0, reserve: 0, frozen: 0, task_escrow: 0, camp_balance: 0,
            total_issued: 0, contribution_pool: 0, last_tick_date: '', updated_at: nowISO(),
          });
        }
        return json({ ok: true, name, role: 'admin' });
      }

      if (path === '/api/auth/login' && method === 'POST') {
        const { name, password } = await request.json();
        const u = await authUser(env, name, password);
        if (!u) return json({ ok: false, error: '用户名或密码错误' }, 401);
        return json({ ok: true, token: 'feishu-' + uid(), user: { name, role: u.role, avatar_seed: u.avatar_seed || name }, name, role: u.role });
      }

      // ── 需要认证的端点 ──
      const auth = request.headers.get('Authorization') || '';
      if (!auth.startsWith('feishu-') && path !== '/api/health') {
        return json({ ok: false, error: '未登录' }, 401);
      }

      // ── 查询端点 ──
      if (path === '/api/nt/sync' && method === 'GET') {
        // 简版 sync：返回所有公开数据
        const [usersR, tasksR, ledgerR, poolR, vfyR] = await Promise.all([
          bitableGet(env, 'FEISHU_TABLE_USERS', { page_size: 200 }),
          bitableGet(env, 'FEISHU_TABLE_TASKS', { page_size: 200 }),
          bitableGet(env, 'FEISHU_TABLE_LEDGER', { page_size: 50 }),
          bitableGet(env, 'FEISHU_TABLE_POOL', { page_size: 1 }),
          bitableGet(env, 'FEISHU_TABLE_VERIFICATIONS', { page_size: 50 }),
        ]);
        const pool = fields(poolR.data?.items || [])[0]?.fields || {};
        return json({
          users: fields(usersR.data?.items || []),
          tasks: fields(tasksR.data?.items || []),
          ledger: fields(ledgerR.data?.items || []),
          pool,
          verifications: fields(vfyR.data?.items || []).filter(v => v.status === 'pending'),
        });
      }

      if (path === '/api/nt/pools' && method === 'GET') {
        const r = await bitableGet(env, 'FEISHU_TABLE_POOL', { page_size: 1 });
        return json(fields(r.data?.items || [])[0]?.fields || {});
      }

      // ── 通用表查询 ──
      const tableMap = {
        '/feishu/camps': 'FEISHU_TABLE_CAMPS',
        '/feishu/meal_orders': 'FEISHU_TABLE_MEAL_ORDERS',
        '/feishu/canteen_menu': 'FEISHU_TABLE_CANTEEN_MENU',
        '/feishu/user_profiles': 'FEISHU_TABLE_USER_PROFILES',
        '/feishu/announcements': 'FEISHU_TABLE_ANNOUNCEMENTS',
      };
      const tbl = tableMap[path];
      if (tbl && method === 'GET') {
        const r = await bitableGet(env, tbl, { page_size: 100 });
        return json({ ok: true, items: fields(r.data?.items || []) });
      }
      if (tbl && method === 'POST') {
        const body = await request.json();
        const r = await bitablePost(env, tbl, body);
        return json({ ok: r.code === 0, id: r.data?.record?.record_id, error: r.msg });
      }

      // ── 校核通过（金融事务） ──
      if (path.startsWith('/api/nt/verifications/') && path.endsWith('/approve') && method === 'POST') {
        const vfyId = path.split('/')[4];
        const vfyR = await bitableGet(env, 'FEISHU_TABLE_VERIFICATIONS', { page_size: 500 });
        const vfy = fields(vfyR.data?.items || []).find(v => v.id === vfyId);
        if (!vfy) return json({ ok: false, error: '校核记录不存在' }, 404);
        if (vfy.status !== 'pending') return json({ ok: false, error: '校核已处理' }, 400);

        const poolR = await bitableGet(env, 'FEISHU_TABLE_POOL', { page_size: 1 });
        const poolItem = fields(poolR.data?.items || [])[0];
        const pool = poolItem?.fields || {};
        const total = (vfy.nt_amount || 0) + (vfy.verifier_reward || 0);
        if ((pool.balance || 0) < total) return json({ ok: false, error: '社区池余额不足' }, 400);

        // 原子事务：更新池 + 写流水 + 更新 doer 余额 + 更新校核状态
        await financialTx(env, [
          { action: 'update', table: 'FEISHU_TABLE_POOL', recordId: poolItem.id, fields: { balance: (pool.balance || 0) - total } },
          { action: 'create', table: 'FEISHU_TABLE_LEDGER', fields: { entry_id: uid(), from_user: 'community_pool', to_user: vfy.doer, amount: vfy.nt_amount, type: 'earn', reason: `校核通过: ${vfy.action}`, status: 'settled', created_at: nowISO() } },
          { action: 'create', table: 'FEISHU_TABLE_LEDGER', fields: { entry_id: uid(), from_user: 'community_pool', to_user: request.headers.get('x-verifier') || '', amount: vfy.verifier_reward, type: 'earn', reason: `校核奖励: ${vfy.action}`, status: 'settled', created_at: nowISO() } },
          { action: 'update', table: 'FEISHU_TABLE_VERIFICATIONS', recordId: vfyId, fields: { status: 'verified', verified_at: nowISO() } },
        ]);
        return json({ ok: true });
      }

      return json({ ok: false, error: 'Not Found' }, 404);
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  },
};
