// S-3a · api.js 路径拼接单测——stub API.request 捕获 (method, path)，不发网络
import { describe, it, expect, beforeEach } from "vitest";
import { loadSource } from "./helpers/load.js";

loadSource("api.js");  // 整文件间接 eval → 全局 API（末尾 API.init() 只设 base，无网络）

// 捕获器：替换 request，记录调用参数并返回可 await 的空 Promise
let calls;
beforeEach(() => {
  calls = [];
  API.request = function (method, path, body) {
    calls.push({ method, path, body });
    return Promise.resolve({ ok: true });
  };
  API.token = null;
});

describe("api.js 路径拼接（变量段/查询串/编码）", () => {
  it("deleteTask 拼接 /api/tasks/{name}", () => {
    API.deleteTask("扫地任务");
    expect(calls[0]).toMatchObject({ method: "DELETE", path: "/api/tasks/扫地任务" });
  });

  it("rejectVerification 拼接 /api/nt/verifications/{id}/reject + body", () => {
    API.rejectVerification("v123", "理由");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].path).toBe("/api/nt/verifications/v123/reject");
    expect(calls[0].body).toEqual({ reject_reason: "理由" });
  });

  it("approveVerification 拼接 /api/nt/verifications/{id}/approve", () => {
    API.approveVerification("v9", { nt: 10 });
    expect(calls[0].path).toBe("/api/nt/verifications/v9/approve");
  });

  it("confirmWithdraw 用 encodeURIComponent 编码 entry_id 查询串", () => {
    API.confirmWithdraw("e 1&x");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].path).toBe("/api/admin/withdraw/confirm?entry_id=e%201%26x");
  });

  it("getLedger 组装 ?limit= 默认 50", () => {
    API.getLedger();
    expect(calls[0].path).toBe("/api/nt/ledger?limit=50");
  });

  it("getLedger 带 type 追加 &type=", () => {
    API.getLedger({ limit: 20, type: "transfer" });
    expect(calls[0].path).toBe("/api/nt/ledger?limit=20&type=transfer");
  });

  it("devReset 默认 soft / 传参 hard", () => {
    API.devReset();
    expect(calls[0].path).toBe("/api/admin/dev-reset?mode=soft");
    API.devReset("hard");
    expect(calls[1].path).toBe("/api/admin/dev-reset?mode=hard");
  });

  it("archiveSummary 编码 userId", () => {
    API.archiveSummary("a/b c");
    expect(calls[0].path).toBe("/api/data/archive_summary/a%2Fb%20c");
  });
});
