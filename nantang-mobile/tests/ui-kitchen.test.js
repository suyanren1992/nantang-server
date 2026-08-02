// W7-KITCHEN-CARD: 厨房改为 _showCardPopup 卡片式弹出 + 事件日志钩子
// 旧测试验证 kitchenBody 填充 → 新测试验证 .mgmt-sheet-body 填充 + _logKitchenEvent
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("data.js");       // closeAllExpands, esc, addJournal
loadSource("ui-kitchen.js"); // openKitchenPage, _renderKitchenPage, _logKitchenEvent

describe("厨房卡片式弹出 (W7-KITCHEN-CARD)", () => {
  beforeEach(() => {
    // 模拟 _showCardPopup 创建的 .mgmt-sheet DOM 结构
    document.body.innerHTML =
      '<div class="mgmt-sheet">' +
      '<div class="mgmt-sheet-inner">' +
      '<span class="mgmt-sheet-title">🍳 厨房</span>' +
      '<div class="mgmt-sheet-body"></div>' +
      '<div class="mgmt-sheet-actions"></div>' +
      '</div></div>';
    window.AppData = { _data: {} };
    window.API = { token: null };
    if (typeof window.showToast !== "function") window.showToast = function () {};
    if (typeof window.closeAllExpands !== "function") window.closeAllExpands = function () {};
    // _showCardPopup 在 app.js 中，测试环境不加载 app.js，mock 增量更新逻辑
    window._showCardPopup = function (title, bodyHTML, actionBtn, fullscreen) {
      var existing = document.querySelector(".mgmt-sheet");
      if (existing) {
        var inner = existing.querySelector(".mgmt-sheet-inner");
        if (inner) {
          var titleEl = inner.querySelector(".mgmt-sheet-title");
          if (titleEl) titleEl.textContent = title;
          var bodyEl = inner.querySelector(".mgmt-sheet-body");
          if (bodyEl) bodyEl.innerHTML = bodyHTML;
        }
        return;
      }
      var el = document.createElement("div"); el.className = "mgmt-sheet";
      el.innerHTML = '<div class="mgmt-sheet-inner"><span class="mgmt-sheet-title">' + title + '</span><div class="mgmt-sheet-body">' + bodyHTML + '</div><div class="mgmt-sheet-actions"></div></div>';
      document.body.appendChild(el);
    };
    // mock _me() 和 addJournal（app.js 中的函数，测试环境不加载）
    window._me = function () { return "测试用户"; };
    window.addJournal = vi.fn();
  });

  it("openKitchenPage 后 mgmt-sheet-body 不再空白", () => {
    expect(() => openKitchenPage()).not.toThrow();
    var body = document.querySelector(".mgmt-sheet-body");
    expect(body).toBeTruthy();
    expect(body.innerHTML.length).toBeGreaterThan(0);
  });

  it("_renderKitchenPage 渲染到 mgmt-sheet-body", () => {
    _renderKitchenPage();
    var body = document.querySelector(".mgmt-sheet-body");
    expect(body.innerHTML).toContain("共享厨房");
  });

  it("mgmt-sheet-body 不存在时 _renderKitchenPage 安全返回", () => {
    document.body.innerHTML = "";
    expect(() => _renderKitchenPage()).not.toThrow();
  });
});

describe("厨房事件日志钩子 _logKitchenEvent", () => {
  beforeEach(() => {
    window._me = function () { return "测试用户"; };
    window.addJournal = vi.fn();
  });

  it("_logKitchenEvent 调用 addJournal 写入 kitchen 类型事件", () => {
    _logKitchenEvent("item_add", '放入了「牛奶」', { itemId: 1, location: "fridge" });
    expect(window.addJournal).toHaveBeenCalledWith(
      "测试用户",
      "kitchen",
      '放入了「牛奶」',
      { space: "kitchen", itemId: 1, location: "fridge" }
    );
  });

  it("_logKitchenEvent addJournal 不可用时安全返回不抛错", () => {
    window.addJournal = undefined;
    expect(function () {
      _logKitchenEvent("item_take", "取出了物品", { itemId: 2 });
    }).not.toThrow();
  });
});
