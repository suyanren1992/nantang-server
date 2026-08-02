// S-3a · data.js BRANCH_TITLES 阈值 + TITLE_LADDER 分级单测
import { describe, it, expect, beforeEach } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("data.js");  // 整文件间接 eval → BRANCH_TITLES/TITLE_LADDER/computeTitle 挂全局

describe("BRANCH_TITLES 阈值表", () => {
  it("六类分支称号齐全", () => {
    expect(Object.keys(BRANCH_TITLES).sort()).toEqual(
      ["art", "cleaning", "cooking", "discovery", "farming", "repair"]
    );
  });
  it("repair 阈值 5，其余为 10", () => {
    expect(BRANCH_TITLES.repair.min).toBe(5);
    expect(BRANCH_TITLES.cleaning.min).toBe(10);
    expect(BRANCH_TITLES.farming.min).toBe(10);
    expect(BRANCH_TITLES.cooking.min).toBe(10);
    expect(BRANCH_TITLES.art.min).toBe(10);
    expect(BRANCH_TITLES.discovery.min).toBe(10);
  });
  it("每类含 icon 与 name", () => {
    for (const k of Object.keys(BRANCH_TITLES)) {
      expect(typeof BRANCH_TITLES[k].icon).toBe("string");
      expect(typeof BRANCH_TITLES[k].name).toBe("string");
    }
  });
});

describe("TITLE_LADDER 经验分级", () => {
  it("五级阶梯 min 单调递增", () => {
    const mins = TITLE_LADDER.map((t) => t.min);
    expect(mins).toEqual([0, 100, 500, 2000, 5000]);
    for (let i = 1; i < mins.length; i++) expect(mins[i]).toBeGreaterThan(mins[i - 1]);
  });
});

describe("computeTitle 综合（tier 落档 + 分支阈值触发）", () => {
  beforeEach(() => {
    // 造 window.NT / window.AppData 最小上下文（无 DOM）
    window.NT = { getUser: (id) => ({ experienceValue: window.__xp || 0 }) };
    window.AppData = { _data: { journal: [], cardDiscoveries: [] } };
  });

  it("xp=0 → 新芽档，无分支", () => {
    window.__xp = 0;
    const r = computeTitle("u1");
    expect(r.tier.tier).toBe("🌱 新芽");
    expect(r.branches).toEqual([]);
  });

  it("xp=600 → 大树档", () => {
    window.__xp = 600;
    expect(computeTitle("u1").tier.tier).toBe("🌳 大树");
  });

  it("repair 满 5 次触发修理工，cleaning 4 次不触发", () => {
    window.__xp = 0;
    window.AppData._data.journal = [
      { type: "repair" }, { type: "repair" }, { type: "repair" },
      { type: "repair" }, { type: "repair" },   // repair=5 → 达阈
      { type: "cleaning" }, { type: "cleaning" },
      { type: "cleaning" }, { type: "cleaning" }, // cleaning=4 → 未达 10
    ];
    const r = computeTitle("u1");
    const names = r.branches.map((b) => b.name);
    expect(names).toContain("修理工");
    expect(names).not.toContain("清洁工");
    expect(r.stats.repair).toBe(5);
    expect(r.stats.cleaning).toBe(4);
  });

  it("confirmed 卡片发现累加 discovery 统计", () => {
    window.__xp = 0;
    window.AppData._data.journal = [];
    window.AppData._data.cardDiscoveries = Array.from({ length: 10 }, () => ({
      status: "confirmed", guessedPerson: "u1",
    }));
    const r = computeTitle("u1");
    expect(r.stats.discovery).toBe(10);
    expect(r.branches.map((b) => b.name)).toContain("发现者");
  });
});

// A-12 · closeOverlay 参数名遮蔽全局函数 showVillage() 的回归测试
describe("closeOverlay 参数遮蔽修复 (A-12)", () => {
  beforeEach(() => {
    // 重置 overlay 栈 + 造一个打开态 overlay
    _overlayStack.length = 0;
    document.body.innerHTML = '<div id="overlayX" class="overlay open"></div>';
    // mock 全局 showVillage（真源在 core.js，单测里用桩替代）
    window.__svCalled = false;
    window.showVillage = () => { window.__svCalled = true; };
  });

  it("不传第二参数时调用全局 showVillage，不报 TypeError", () => {
    // 旧 bug：参数名 showVillage 遮蔽全局函数 → undefined() → TypeError
    expect(() => closeOverlay("overlayX")).not.toThrow();
    expect(window.__svCalled).toBe(true);
    // overlay 的 open 类应被移除
    expect(document.getElementById("overlayX").classList.contains("open")).toBe(false);
  });

  it("传 false 时仅解锁 body，不回村口", () => {
    closeOverlay("overlayX", false);
    expect(window.__svCalled).toBe(false);
  });
});

// A-1 · _findTask 统一任务查找——本地任务键=name、API任务键=id，任一键都能找到
// 旧 bug：claimTask(t.name) 而 TASKS 键是 t.id → TASKS[name]=undefined → 静默 return → 认领无响应
describe("_findTask 统一任务查找 (A-1)", () => {
  beforeEach(() => {
    Object.keys(TASKS).forEach(function(k){ delete TASKS[k]; });
  });
  it("本地任务键=name，按 name 直接命中", () => {
    TASKS["打扫卫生"] = { name: "打扫卫生", title: "打扫卫生" };
    expect(_findTask("打扫卫生")).toBe(TASKS["打扫卫生"]);
  });
  it("API任务键=id，按 title/name 也能找到（认领不再无响应）", () => {
    TASKS["5"] = { name: "帮厨", title: "帮厨", _srvId: "5" };
    // 认领按钮传 t.name(=title)，旧代码 TASKS["帮厨"] 找不到
    expect(_findTask("帮厨")).toBe(TASKS["5"]);
    // 用 id 查也行
    expect(_findTask("5")).toBe(TASKS["5"]);
  });
  it("找不到时返回 null", () => {
    expect(_findTask("不存在")).toBeNull();
    expect(_findTask("")).toBeNull();
  });
});

// W7-UI-STACK · overlay 栈逐层返回回归测试
describe("_pushOverlay + closeOverlay 栈行为 (W7-UI-STACK)", () => {
  beforeEach(() => {
    _overlayStack.length = 0;
    document.body.innerHTML = '<div id="overlayA" class="overlay open"></div><div id="overlayB" class="overlay open"></div>';
    window.__svCalled = false;
    window.showVillage = function() { window.__svCalled = true; };
  });

  it("栈有上层 overlay → 关闭当前恢复上层，不回村口", () => {
    _pushOverlay("overlayA");
    _pushOverlay("overlayB");
    closeOverlay("overlayB");
    expect(window.__svCalled).toBe(false);
    expect(document.getElementById("overlayA").classList.contains("open")).toBe(true);
    expect(document.getElementById("overlayB").classList.contains("open")).toBe(false);
  });

  it("栈空 → 关闭回村口（现有行为不变）", () => {
    _pushOverlay("overlayA");
    closeOverlay("overlayA");
    expect(window.__svCalled).toBe(true);
  });

  it("_pushOverlay 幂等——重复推同一 ID 不重复", () => {
    _pushOverlay("overlayA");
    _pushOverlay("overlayA");
    _pushOverlay("overlayA");
    expect(_overlayStack.length).toBe(1);
    expect(_overlayStack[0]).toBe("overlayA");
  });

  it("三级 overlay → 逐层关闭正确回退", () => {
    document.body.innerHTML += '<div id="overlayC" class="overlay open"></div>';
    _pushOverlay("overlayA");
    _pushOverlay("overlayB");
    _pushOverlay("overlayC");
    // 关 C → 回到 B
    closeOverlay("overlayC");
    expect(window.__svCalled).toBe(false);
    expect(document.getElementById("overlayB").classList.contains("open")).toBe(true);
    // 关 B → 回到 A
    window.__svCalled = false;
    closeOverlay("overlayB");
    expect(window.__svCalled).toBe(false);
    expect(document.getElementById("overlayA").classList.contains("open")).toBe(true);
    // 关 A → 回村口
    closeOverlay("overlayA");
    expect(window.__svCalled).toBe(true);
  });
});
