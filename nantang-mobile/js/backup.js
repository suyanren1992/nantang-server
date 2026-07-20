// ═══════════ 自动备份 ═══════════
// 每次 save() 自动写入日备份，保留最近 5 个版本
window.App = window.App || {};

App.backup = {
  MAX_BACKUPS: 5,

  // 自动备份（由 App.store.save() 自动调用）
  auto: function() {
    var raw = safeStorage.getItem('camp_data');
    if (!raw) return;
    var today = Clock.today();
    var key = 'camp_data_backup_' + today;
    // 同一天只保留最新一份
    safeStorage.setItem(key, raw);
    this._prune();
  },

  // 手动创建命名快照
  snapshot: function(label) {
    var raw = safeStorage.getItem('camp_data');
    if (!raw) return null;
    var key = 'camp_data_backup_' + Clock.iso().replace(/[:.]/g, '-');
    safeStorage.setItem(key, raw);
    this._prune();
    return key;
  },

  // 列出所有备份
  list: function() {
    var backups = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith('camp_data_backup_')) {
        backups.push(key.replace('camp_data_backup_', ''));
      }
    }
    return backups.sort().reverse();
  },

  // 恢复指定备份
  restore: function(key) {
    var raw = safeStorage.getItem('camp_data_backup_' + key);
    if (!raw) return false;
    safeStorage.setItem('camp_data', raw);
    return true;
  },

  // 清理过期备份（保留最近 MAX_BACKUPS 个）
  _prune: function() {
    var all = this.list();
    if (all.length <= this.MAX_BACKUPS) return;
    all.slice(this.MAX_BACKUPS).forEach(function(k) {
      safeStorage.removeItem('camp_data_backup_' + k);
    });
  }
};
