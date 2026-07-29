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
