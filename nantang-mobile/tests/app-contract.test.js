// A-4 核验：入住南塘卡片 onclick=_openMgmtSheet('stay') → _showStaySheet()
// app.js 3900+ 行不适合 jsdom 整文件 eval，改用源码契约测试锁调用链关键节点不被误删。
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { SRC_DIR } from "./helpers/load.js";

const APP_JS = fs.readFileSync(path.join(SRC_DIR, "app.js"), "utf8");

describe("入住南塘入口调用链 (A-4)", () => {
  it("卡片 onclick 绑定 _openMgmtSheet('stay')", () => {
    expect(APP_JS).toContain("_openMgmtSheet(\\'stay\\')");
  });
  it("_openMgmtSheet 定义存在", () => {
    expect(APP_JS).toContain("function _openMgmtSheet");
  });
  it("stay 分支调用 _showStaySheet", () => {
    expect(APP_JS).toContain("_showStaySheet()");
  });
  it("_showStaySheet 定义存在（含数据 fallback）", () => {
    expect(APP_JS).toContain("function _showStaySheet");
  });
});
