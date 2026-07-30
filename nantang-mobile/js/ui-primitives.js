/* ══════════════════════════════════════════════════════════════════
   ui-primitives.js — 南塘云村 通用块面 5 件套（范式先行 · 阶段 1/4）
   卡号：W6-UI-CARD-API · 一营 Claude Code · 2026-07-31

   组件：Card / Icon / Progress / StatusBadge / TaskCard
   挂载：window.UI
   法源：方案/设计系统底座_v0.md + 方案/卡片化范式_勘察v0.md

   令牌（theme.css --g-*）：
     卡片底 --g-card / 圆角 --g-radius (12px) / 阴影 --g-shadow
     间距 --g-gap (8px) --g-pad-sm (10px) --g-pad (14px)
     品牌 --g-accent / 成功 --g-green / 警示 --g-warn / 危险 --g-red
     字色 --g-text --g-text-dim --g-text-muted
     CSS 类 .progress-bar / .progress-fill（theme.css:272-274）

   阶段 3 预埋（props 留口，不做实现）：
     Card.onAction / TaskCard.pollingInterval / Progress.autoRefresh
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── 共享状态色（Icon 与 StatusBadge 共用 status 语义） ──
  var STATUS = {
    green:   { dot: '🟢', hex: '#5d8c52', css: 'var(--g-green)' },
    yellow:  { dot: '🟡', hex: '#c88740', css: 'var(--g-warn)' },
    red:     { dot: '🔴', hex: '#b84c38', css: 'var(--g-red)' },
    offline: { dot: '⚫', hex: '#8a8a8a', css: 'var(--g-text-dim)' }
  };

  function _el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) {
      if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    return e;
  }

  var UI = window.UI = {};

  // ═══ ① Card — head / body / actions 三段式 ═══
  // 用法：UI.Card({ object:'field', head:'...', body:'...', actions:'...' [, onAction] })
  // onAction 预埋：阶段 3 A-CLEAN-WEEKLY 用，回调 (actionName, cardProps)
  UI.Card = function (opts) {
    opts = opts || {};
    var card = _el('div', 'ui-card', {
      style: 'background:var(--g-card);border-radius:var(--g-radius);box-shadow:var(--g-shadow);overflow:hidden',
      'data-object': opts.object || ''
    });

    if (opts.head) {
      card.appendChild(_el('div', 'ui-card-head', {
        html: opts.head,
        style: 'padding:var(--g-pad-sm) var(--g-pad);font-weight:700;font-size:var(--g-font-size);' +
               'border-bottom:1px solid var(--g-card-border);display:flex;align-items:center;gap:var(--g-gap)'
      }));
    }

    if (opts.body) {
      card.appendChild(_el('div', 'ui-card-body', {
        html: opts.body,
        style: 'padding:var(--g-pad)'
      }));
    }

    if (opts.actions) {
      var actWrap = _el('div', 'ui-card-actions', {
        html: opts.actions,
        style: 'padding:var(--g-pad-sm) var(--g-pad);border-top:1px solid var(--g-card-border);' +
               'display:flex;gap:var(--g-gap);flex-wrap:wrap'
      });
      // 预埋 onAction：click 委托到 [data-action] 元素
      if (opts.onAction) {
        actWrap.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-action]');
          if (btn) opts.onAction(btn.getAttribute('data-action'), opts);
        });
      }
      card.appendChild(actWrap);
    }

    return card;
  };

  // ═══ ② Icon — emoji 双轨（emoji + 状态点） ═══
  // 用法：UI.Icon({ name:'🌾', size:'md', status:'green' })
  UI.Icon = function (opts) {
    opts = opts || {};
    var sizes = { sm: '1rem', md: '1.5rem', lg: '2.5rem' };
    var sz = sizes[opts.size] || sizes.md;
    var wrap = _el('span', 'ui-icon', {
      style: 'display:inline-flex;align-items:center;justify-content:center;position:relative;' +
             'font-size:' + sz + ';line-height:1'
    });

    wrap.appendChild(_el('span', 'ui-icon-emoji', { html: opts.name || '📦' }));

    var st = STATUS[opts.status];
    if (st) {
      wrap.appendChild(_el('span', 'ui-icon-dot', {
        style: 'position:absolute;bottom:0;right:0;width:8px;height:8px;border-radius:50%;' +
               'background:' + st.css + ';border:1.5px solid var(--g-card)'
      }));
    }

    return wrap;
  };

  // ═══ ③ Progress — 激活 theme.css .progress-bar / .progress-fill ═══
  // 用法：UI.Progress({ value:45, max:100, label:'生长度 45/100', variant:'linear' })
  // autoRefresh 预埋：阶段 3 田间/住宿状态变化时重渲染
  UI.Progress = function (opts) {
    opts = opts || {};
    var pct = Math.min(100, Math.max(0, ((opts.value || 0) / (opts.max || 100)) * 100));

    if (opts.variant === 'circular') return _circularProgress(pct, opts);

    // linear（默认）：复用 theme.css:272-274 .progress-bar / .progress-fill
    var wrap = _el('div', 'ui-progress', { style: 'width:100%' });

    if (opts.label) {
      wrap.appendChild(_el('div', 'ui-progress-label', {
        html: opts.label,
        style: 'display:flex;justify-content:space-between;font-size:var(--g-font-size-xs);' +
               'color:var(--g-text-dim);margin-bottom:3px'
      }));
    }

    var bar = _el('div', 'progress-bar');
    bar.appendChild(_el('div', 'progress-fill', { style: 'width:' + pct + '%' }));
    wrap.appendChild(bar);

    if (opts.autoRefresh !== undefined) {
      wrap.setAttribute('data-auto-refresh', opts.autoRefresh);
    }

    return wrap;
  };

  function _circularProgress(pct, opts) {
    var r = 22, cx = 50, cy = 50;
    var circ = 2 * Math.PI * r;
    var dash = circ * (1 - pct / 100);

    var wrap = _el('div', 'ui-progress-circular', {
      style: 'display:inline-flex;flex-direction:column;align-items:center'
    });

    wrap.innerHTML =
      '<svg width="56" height="56" viewBox="0 0 100 100">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
          'stroke="var(--g-content)" stroke-width="6"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
          'stroke="var(--g-green)" stroke-width="6" ' +
          'stroke-dasharray="' + circ + '" stroke-dashoffset="' + dash + '" ' +
          'stroke-linecap="round" transform="rotate(-90 ' + cx + ' ' + cy + ')" ' +
          'style="transition:stroke-dashoffset .3s ease"/>' +
        '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" ' +
          'font-size="15" fill="var(--g-text)" font-weight="700">' +
          Math.round(pct) + '%</text>' +
      '</svg>';

    if (opts.label) {
      wrap.appendChild(_el('div', 'ui-progress-label', {
        html: opts.label,
        style: 'font-size:var(--g-font-size-xs);color:var(--g-text-dim);margin-top:4px;text-align:center'
      }));
    }

    return wrap;
  }

  // ═══ ④ StatusBadge — 4 态状态牌 ═══
  // 用法：UI.StatusBadge({ status:'green', text:'在地' })
  // status 语义与 Icon 共用 STATUS 定义
  UI.StatusBadge = function (opts) {
    opts = opts || {};
    var st = STATUS[opts.status] || STATUS.offline;
    // RRGGBB + 18 → RRGGBBAA (~10% alpha)，现代浏览器全支持
    var badge = _el('span', 'ui-status-badge', {
      style: 'display:inline-flex;align-items:center;gap:4px;font-size:var(--g-font-size-xs);' +
             'padding:3px 8px;border-radius:var(--g-radius-sm);' +
             'color:' + st.hex + ';background:' + st.hex + '18'
    });
    badge.innerHTML = st.dot + ' ' + (opts.text || '');
    return badge;
  };

  // ═══ ⑤ TaskCard — 选英雄式任务卡（阶段 3 A-CLEAN-WEEKLY 预埋） ═══
  // 用法：UI.TaskCard({ taskId:'t1', title:'洗碗', reward:'+5NT', doer:'' })
  // doer: ''=可领 / '某人'=已领 / 'locked'=锁定倒计时
  // pollingInterval 预埋：默认 3000ms，CLEAN-WEEKLY-BE 后端驱动状态机
  UI.TaskCard = function (opts) {
    opts = opts || {};
    var doer = opts.doer || '';
    var state = doer === 'locked' ? 'locked' : doer ? 'claimed' : 'claimable';

    var cfg = {
      claimable: { border: 'var(--g-accent)',   bg: 'var(--g-accent-bg)', btn: '🟢 领取',   btnColor: 'var(--g-accent)' },
      claimed:   { border: 'var(--g-green)',    bg: 'var(--g-green-bg)',  btn: '✅ ' + doer, btnColor: 'var(--g-green)' },
      locked:    { border: 'var(--g-text-dim)', bg: 'rgba(0,0,0,0.02)',  btn: '🔒 倒计时', btnColor: 'var(--g-text-dim)' }
    }[state];

    var card = _el('div', 'ui-task-card', {
      style: 'background:var(--g-card);border-radius:var(--g-radius);box-shadow:var(--g-shadow);' +
             'border:2px solid ' + cfg.border + ';overflow:hidden;' +
             'cursor:' + (state === 'claimable' ? 'pointer' : 'default'),
      'data-task-id': opts.taskId || '',
      'data-state': state,
      'data-polling-interval': opts.pollingInterval || 3000
    });

    card.innerHTML =
      '<div style="background:' + cfg.bg + ';padding:var(--g-pad)">' +
        '<div style="font-weight:700;font-size:var(--g-font-size);margin-bottom:6px">' +
          (opts.title || '') +
        '</div>' +
        '<div style="font-size:var(--g-font-size-xs);color:var(--g-text-dim)">' +
          '🎁 ' + (opts.reward || '') +
        '</div>' +
      '</div>' +
      '<div style="padding:var(--g-pad-sm) var(--g-pad);border-top:1px solid var(--g-card-border);text-align:center">' +
        '<span style="font-size:var(--g-font-size-xs);font-weight:700;color:' + cfg.btnColor + '">' +
          cfg.btn +
        '</span>' +
      '</div>';

    return card;
  };

})();
