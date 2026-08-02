// A-5 核验：抽屉柜——体检报告称"建设中"占位，经勘察 openDrawerCabinet(core.js:2003)
// 已是完整六格（UI-4 返修已修），非建设中。契约测试锁六格入口不被退回占位。
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { SRC_DIR } from "./helpers/load.js";

const CORE_JS = fs.readFileSync(path.join(SRC_DIR, "core.js"), "utf8");

describe("抽屉柜六格 (A-5)", () => {
  it("openDrawerCabinet 定义存在", () => {
    expect(CORE_JS).toContain("function openDrawerCabinet");
  });
  it("六格入口齐全（非建设中占位）", () => {
    ["素社订餐", "共享厨房", "素社民宿", "萝卜议事厅", "二手集市", "白菜拍卖行"].forEach(function (label) {
      expect(CORE_JS).toContain(label);
    });
  });
});
