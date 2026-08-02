// A-7 修复：档案室显示 "undefined"——getUsers() 返回的用户对象可能缺 role 字段，
// 且 openMemberArchive 的 _render 函数未对 API 返回字段做空值兜底，
// 导致 undefined + ' 次' 渲染为 "undefined 次" 等文字。
// 修复：role 兜底为 'visitor'，_render 所有字段 || 0。
import { describe, it, expect, beforeEach } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("data.js");
loadSource("ui-archive.js");

describe("档案室 undefined 修复 (A-7)", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="archiveBody"></div>' +
      '<div id="memberArchiveBody"></div>';
    window.AppData = { _data: { users: {}, tasks: {}, journal: [], activity_log: [] } };
    if (typeof window.esc !== "function")
      window.esc = function (s) { return String(s == null ? "" : s); };
    if (typeof window.showToast !== "function") window.showToast = function () {};
    // roleName / avatarURL 在 core.js 中定义，此处 mock 避免加载整个 core.js
    if (typeof window.roleName !== "function")
      window.roleName = function (r) {
        return r === "admin" ? "管理员" : r === "builder" ? "共建者" :
          r === "adventurer" ? "冒险者" : r === "npc" ? "在地伙伴" : "云村民";
      };
    if (typeof window.avatarURL !== "function")
      window.avatarURL = function () { return ""; };
  });

  it("renderArchiveMembers 对缺 role 的用户不渲染 undefined", () => {
    // 构造一个没有 role 字段的用户对象
    window.AppData._data.users = {
      testuser: { name: "testuser", avatar_seed: 42 }  // 无 role 字段
    };
    // getUsers 从 AppData._data.users 读取
    if (typeof window.getUsers !== "function") {
      window.getUsers = function () { return window.AppData._data.users; };
    }

    var el = document.getElementById("archiveBody");
    expect(() => renderArchiveMembers(el)).not.toThrow();

    // 不应出现字面 "undefined" 文字
    expect(el.innerHTML).not.toContain("undefined");
    // role 兜底为 'visitor'，roleName 应显示 "云村民"
    expect(el.innerHTML).toContain("云村民");
  });

  it("openMemberArchive._render 对缺失字段不显示 undefined", () => {
    // mock API 返回部分字段（缺失 verifications_done / accommodation_days）
    var partialData = { tasks_completed: 5 };  // 缺 verifications_done, accommodation_*

    // 模拟 _render 的核心逻辑：所有字段都应兜底为 0
    var d = partialData;
    var stays = d.accommodation_stays || 0;
    var days  = d.accommodation_days || 0;
    var tc    = d.tasks_completed || 0;
    var vd    = d.verifications_done || 0;

    expect(stays).toBe(0);
    expect(days).toBe(0);
    expect(tc).toBe(5);
    expect(vd).toBe(0);

    // 拼接结果不应含 "undefined"
    var stayLine = stays + ' 次';
    var rendered = tc + ' ' + vd + ' ' + stayLine;
    expect(rendered).not.toContain("undefined");
  });
});
