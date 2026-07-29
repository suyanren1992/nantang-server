import { defineConfig } from "vitest/config";

// S-3a: 前端 jsdom 轻量单测——锁无 DOM 纯逻辑 (utils/api/data)
// environment=jsdom 提供 window/document/localStorage；被测源码只读，靠整文件间接 eval 挂全局
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/*.test.js"],
  },
});
