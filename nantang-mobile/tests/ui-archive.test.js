// A-2 核验：toggleArchiveExpand 归档展开——体检报告称"无响应"，
// 经勘察一营已修（git: 6916af8/a717b7b 等 XSS+时间线修复），依赖齐全。
// 此测试锁定回归：展开/收起 toggle 行为必须正常。
import { describe, it, expect, beforeEach } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("data.js");       // getUsers / TASKS / MOCK_ITEMS / JOURNAL_TYPES
loadSource("ui-archive.js"); // toggleArchiveExpand / _renderTimelineHTML

describe("toggleArchiveExpand 归档展开 (A-2)", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="archiveExpand" style="display:none"></div>' +
      '<div id="archiveCountText">暂无归档</div>';
    window.AppData = { _data: { users: {}, tasks: {}, journal: [], activity_log: [] } };
    if (typeof window.esc !== "function")
      window.esc = function (s) { return String(s == null ? "" : s); };
  });

  it("展开不抛错，archiveExpand 切为 block", () => {
    expect(() => toggleArchiveExpand()).not.toThrow();
    expect(document.getElementById("archiveExpand").style.display).toBe("block");
  });

  it("再次点击收起（toggle 行为）", () => {
    toggleArchiveExpand();
    toggleArchiveExpand();
    expect(document.getElementById("archiveExpand").style.display).toBe("none");
  });
});
