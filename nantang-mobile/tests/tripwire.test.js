// S-3a · fixture 试爆红灯——证明单测有牙：对植入 bug 的假源码，真契约断言会 FAIL
// 关键：只加载 fixtures/ 下假源码，绝不碰真 js/*.js
import { describe, it, expect } from "vitest";
import { loadFixture } from "./helpers/load.js";

loadFixture("buggy-utils.js");  // → 全局 BuggyClock / BuggyBranch

describe("试爆红灯：单测能抓到回归（对 fixture 生效，不碰真源码）", () => {
  it("_p2 不补零的 bug 会被 today 契约断言抓红", () => {
    // 真源码契约：today() 补零应得 '2026-01-05'
    // 对 buggy fixture 跑同一断言 → 必抛（证明断言有牙）
    expect(() => {
      expect(BuggyClock.today()).toBe("2026-01-05");
    }).toThrow();
    // 实证 buggy 输出确实是未补零的坏值
    expect(BuggyClock.today()).toBe("2026-1-5");
  });

  it("repair 阈值被改错(99)会被阈值契约断言抓红", () => {
    // 真源码契约：repair.min === 5
    expect(() => {
      expect(BuggyBranch.repair.min).toBe(5);
    }).toThrow();
    expect(BuggyBranch.repair.min).toBe(99); // 坏值实证
  });
});
