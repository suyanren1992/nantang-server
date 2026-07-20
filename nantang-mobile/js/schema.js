// ═══════════ 数据模型定义 & 版本迁移 ═══════════
// 所有 localStorage key 和数据结构集中在此，方便审计和迁移。
window.App = window.App || {};

App.schema = {
  version: 1,  // 当前数据格式版本号（每次不兼容变更 +1）

  // 所有 localStorage key 清单
  keys: {
    camp_data:           { desc: '核心营队数据',        critical: true },
    nt_users:            { desc: '用户账号注册表',       critical: true },
    nt_session:          { desc: '当前登录会话',         critical: false },
    nt_remembered_user:  { desc: '记住我',              critical: false },
    nt_invite_codes:     { desc: 'NPC 邀请码',          critical: false },
    nt_world_codes:      { desc: '冒险者世界码',         critical: false },
    nt_virtual_ms:       { desc: '虚拟时钟冻结时间',     critical: false },
    nt_last_pages:       { desc: '用户上次访问页面',     critical: false },
    nt_test_mode:        { desc: '内测模式标记',         critical: false },
    camp_data__real_backup: { desc: '内测前数据备份',    critical: true },
    camp_wizard_tasks:   { desc: '向导任务池暂存',       critical: false },
    camp_templates:      { desc: '任务/日程模板',        critical: false },
    budget_item_counter: { desc: '预算项自增ID',         critical: false },
    inbox_seen_ids:      { desc: '信箱已读消息',         critical: false },
    inbox_seen_before:   { desc: '信箱已读时间戳',       critical: false },
    nt_npc_in_main:      { desc: 'NPC进入主界面标记',    critical: false },
  },

  // 默认数据结构（新用户/重置后）
  defaultData: function() {
    return {
      _schema_version: App.schema.version,
      tasks: [],
      decisions: [],
      members: {},
      budget: {},
      budget_items: [],
      finance_cny: {},
      finance: [],
      schedule: {},
      camp_progress: { step: 0, steps: { '0': 'active', '1': 'locked', '2': 'locked', '3': 'locked', '4': 'locked' } },
      camp_dates: { start: '', end: '', duration_days: 15, milestones: [] },
      staff_cards: [],
      inventory: [],
      canteen_menus: {},
      canteen_orders: [],
      canteen_suggestions: [],
      inn_rooms: [],
      inn_bookings: [],
      teahouse_posts: [],
      game_sessions: [],
      auctions: [],
      tips: [],
      council_meetings: [],
      council_room: {},
      community_pool: {},
      community_archives: [],
      deposits: [],
      withdrawals: [],
      finance_archives: [],
      activity_log: [],
      member_notes: {},
      payment_passwords: {},
      custom_tags: [],
      archived_periods: {},
      currentPeriod: '',
      periodClosed: '',
      mapMilestones: [],
      camp_info: {
        current: {
          version: 0, updated_at: '', updated_by: '',
          identity: { name: '', period: '', description: '', type: 'regular', status: 'draft', created_at: '', created_by: '', test_mode: false },
          budget: { nt_total_pool: 0, nt_allocated: 0, nt_remaining: 0, rmb_budget: 0, rmb_items: [], allocation_rules: {}, community_pool_total: 0, community_pool_daily: 0 },
          calendar: { start_date: '', end_date: '', duration_days: 15, daily_schedule: [], milestones: [], key_dates: [] },
          team: { admin: '', staff_cards: [], members: {} },
          tasks: { pool: [], assignments: {}, templates: [] },
          governance: { council_meetings: [], decisions: [], rules: {} }
        },
        snapshots: [],
        changelog: []
      },
      _initialized: false,
      _role_migrated: false
    };
  },

  // 版本迁移（按顺序执行）
  migrate: function(data) {
    var ver = data._schema_version || 0;

    // v0 → v1: 添加缺失的默认字段
    if (ver < 1) {
      if (!data.camp_info) data.camp_info = App.schema.defaultData().camp_info;
      if (!data.inventory) data.inventory = [];
      if (!data.canteen_menus) data.canteen_menus = {};
      if (!data.deposits) data.deposits = [];
      if (!data.withdrawals) data.withdrawals = [];
      if (!data.payment_passwords) data.payment_passwords = {};
      if (!data.archived_periods) data.archived_periods = {};
      if (data._role_migrated === undefined) data._role_migrated = false;
      data._schema_version = 1;
    }

    // 未来 v1 → v2 在这里添加:
    // if (ver < 2) { ... data._schema_version = 2; }
  }
};
