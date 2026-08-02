// A-3 核验：openInn 素社民宿入口——体检报告称"无响应"，
// 经勘察 openInn 实现完整 + overlayInn 元素存在(index.html:223) + _innLoad 有 API fallback，
// 判定代码健康。此测试锁回归：openInn 必须能打开 overlay。
import { describe, it, expect, beforeEach } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("data.js");       // _pushOverlay
loadSource("ui-phase4.js");  // openInn

describe("openInn 素社民宿入口 (A-3)", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="overlayInn" class="overlay"><div id="innBody"></div></div>';
    window.AppData = { _data: {} };
    // mock _innLoad 避免 _innRender 复杂渲染依赖，聚焦 overlay 打开行为
    window._innLoad = function () {};
  });

  it("openInn 打开 overlayInn 不抛错", () => {
    expect(() => openInn()).not.toThrow();
    expect(document.getElementById("overlayInn").classList.contains("open")).toBe(true);
  });
});
