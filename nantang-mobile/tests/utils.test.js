// S-3a · utils.js 无 DOM 纯逻辑单测（Clock 时区/日期/_p2/_shift · parseMD · 日期计算 · 编码/转义）
import { describe, it, expect, beforeEach } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("utils.js");  // 整文件间接 eval → Clock/parseMD/daysBetween/... 挂 globalThis

describe("Clock 时区/日期（_shift UTC+8 · _p2 补零）", () => {
  beforeEach(() => { Clock._reset(); });

  it("_setFrozen 后 today() 输出 UTC+8 日历日且月/日补零", () => {
    // 2026-01-05 01:05 UTC = 09:05 UTC+8
    Clock._setFrozen(Date.UTC(2026, 0, 5, 1, 5, 0));
    expect(Clock.today()).toBe("2026-01-05");   // _p2 补零验证（01/05）
  });

  it("hour()/min() 取的是 UTC+8 字段", () => {
    Clock._setFrozen(Date.UTC(2026, 0, 5, 1, 5, 0)); // +8h → 09:05
    expect(Clock.hour()).toBe(9);
    expect(Clock.min()).toBe(5);
  });

  it("iso()/ms() 反映冻结时刻", () => {
    const ms = Date.UTC(2026, 6, 10, 3, 30, 0);
    Clock._setFrozen(ms);
    expect(Clock.ms()).toBe(ms);
    expect(Clock.iso()).toBe(new Date(ms).toISOString());
  });

  it("_state() 报告虚拟态，_reset() 恢复真实时间", () => {
    Clock._setFrozen(Date.UTC(2026, 6, 10));
    expect(Clock._state().virtual).toBe(true);
    Clock._reset();
    expect(Clock._state().virtual).toBe(false);
  });

  it("跨月日期不补零边界（12 月 31 日）", () => {
    Clock._setFrozen(Date.UTC(2026, 11, 31, 12, 0, 0)); // +8h 仍在同日 20:00
    expect(Clock.today()).toBe("2026-12-31");
  });
});

describe("parseMD 多格式解析", () => {
  it("解析 M/D HH:MM", () => {
    const d = parseMD("7/10 14:30");
    expect(d.getMonth()).toBe(6);   // 0-based
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });
  it("解析 YYYY-MM-DD", () => {
    const d = parseMD("2026-07-10");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(10);
  });
  it("解析 M月D日", () => {
    const d = parseMD("7月10日");
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(10);
  });
  it("空串/无效返回 null", () => {
    expect(parseMD("")).toBeNull();
    expect(parseMD("完全不是日期xyz")).toBeNull();
  });
});

describe("日期计算 daysBetween/daysSince/daysUntil（UTC+8 运行时）", () => {
  it("daysBetween 同值为 0", () => {
    expect(daysBetween("2026-07-10", "2026-07-10")).toBe(0);
  });
  it("daysBetween 相差 5 天", () => {
    expect(daysBetween("2026-07-10", "2026-07-05")).toBe(5);
  });
  it("daysSince(今日)=0 / daysUntil 未来为正", () => {
    Clock._setFrozen(Date.UTC(2026, 6, 10, 0, 0, 0));
    expect(daysSince(Clock.today())).toBe(0);
    expect(daysUntil("2026-07-15")).toBeGreaterThan(0);
    Clock._reset();
  });
});

describe("编码/哈希/转义", () => {
  it("simpleHash 确定性 + px_ 前缀", () => {
    expect(simpleHash("abc")).toBe(simpleHash("abc"));
    expect(simpleHash("abc").startsWith("px_")).toBe(true);
  });
  it("esc 转义 < > & 单双引号", () => {
    expect(esc(`<a href="x" name='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; name=&#39;y&#39;&gt;&amp;"
    );
    expect(escHtml("<b>")).toBe("&lt;b&gt;");
  });
  it("encodePassword 确定性 + v2$ 前缀", () => {
    const h = encodePassword("Passw0rd!", "alice");
    expect(h).toBe(encodePassword("Passw0rd!", "alice"));
    expect(h.startsWith("v2$")).toBe(true);
    // 不同用户名 → 不同 hash（加盐生效）
    expect(h).not.toBe(encodePassword("Passw0rd!", "bob"));
  });
  it("isOldPasswordFormat 识别非 v2$ 旧格式", () => {
    expect(isOldPasswordFormat("btoaOldHash")).toBe(true);
    expect(isOldPasswordFormat("v2$xxxx")).toBe(false);
  });
});
