// ═══════════ 统一数据访问层 ═══════════
// 统一的 save/load/reset 入口。保证所有写操作都触发备份。
window.App = window.App || {};

App.store = {
  // 从 localStorage 加载数据（自动迁移旧版本格式）
  load: function() {
    var raw = safeStorage.getItem('camp_data');
    if (!raw) return App.schema.defaultData();
    try {
      var data = JSON.parse(raw);
      App.schema.migrate(data);  // 自动检测版本并迁移
      return data;
    } catch (e) {
      console.error('[App.store] 数据损坏，使用默认数据:', e.message);
      // Keep a backup of the corrupted raw data before resetting
      try { safeStorage.setItem('camp_data__corrupted_backup', raw); } catch(ex) {}
      alert('⚠️ 数据文件损坏，已重置为空白数据。\n原始数据已备份到 camp_data__corrupted_backup，可尝试手动恢复。\n错误：' + e.message);
      return App.schema.defaultData();
    }
  },

  // 写入 localStorage（自动触发备份）
  save: function(data) {
    data._schema_version = App.schema.version;
    safeStorage.setItem('camp_data', JSON.stringify(data));
    App.backup.auto();
  },

  // 重置为默认数据
  reset: function() {
    safeStorage.removeItem('camp_data');
    return App.schema.defaultData();
  }
};
