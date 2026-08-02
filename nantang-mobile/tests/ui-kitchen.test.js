// A-6 修复：共享厨房页面空白——_renderKitchenPage 查找 kitchenContent 元素，
// 但 index.html 静态 overlay 用的是 id=kitchenBody，导致找到 null 后 return 空白。
// 修复后兼容 kitchenBody（静态 HTML）和 kitchenContent（动态创建路径）。
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("data.js");       // _pushOverlay, closeAllExpands, esc
loadSource("ui-kitchen.js"); // openKitchenPage, _renderKitchenPage

describe("共享厨房空白修复 (A-6)", () => {
  beforeEach(() => {
    // 模拟 index.html 的静态 overlay 结构（id=kitchenBody 非 kitchenContent）
    document.body.innerHTML =
      '<div id="overlayKitchen" class="overlay">' +
      '<div class="overlay-top"><span class="overlay-title">🍳 共享厨房</span></div>' +
      '<div class="overlay-body" id="kitchenBody" style="padding:10px 14px"></div>' +
      '</div>';
    window.AppData = { _data: {} };
    // 无 API token 时数据加载器返回空数组，聚焦 overlay 渲染逻辑
    window.API = { token: null };
    if (typeof window.showToast !== "function") window.showToast = function () {};
    // closeAllExpands 在 core.js 中定义，此处 mock 避免加载整个 core.js
    if (typeof window.closeAllExpands !== "function") window.closeAllExpands = function () {};
  });

  it("openKitchenPage 后 kitchenBody 不再空白", () => {
    expect(() => openKitchenPage()).not.toThrow();
    var body = document.getElementById("kitchenBody");
    expect(body).toBeTruthy();
    // 修复前 kitchenBody 保持空白；修复后应被 _renderKitchenPage 填充（至少含 tab 按钮）
    expect(body.innerHTML.length).toBeGreaterThan(0);
  });

  it("_renderKitchenPage 兼容 kitchenBody（非 kitchenContent）", () => {
    _renderKitchenPage();
    var body = document.getElementById("kitchenBody");
    expect(body.innerHTML).toContain("共享厨房");
  });
});
