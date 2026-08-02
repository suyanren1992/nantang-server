// S-3a loader：整文件读出 → 间接 eval → 顶层 var/function 挂到 globalThis(=jsdom window)
// 被测源码一律只读，绝不改动
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SRC_DIR = path.resolve(__dirname, "..", "..", "js");
export const FIXTURE_DIR = path.resolve(__dirname, "..", "fixtures");

// 从真源码目录 js/ 载入（只读）
export function loadSource(name) {
  const code = fs.readFileSync(path.join(SRC_DIR, name), "utf8");
  // vitest 4.x: 间接 eval 作用域不再暴露 jsdom 全局变量(window/document 等)为裸标识符，
  // 需显式从 globalThis 别名声明，否则被测源码顶层引用 window 报 ReferenceError
  (0, eval)(
    'var window=globalThis.window,self=globalThis.self,document=globalThis.document,' +
    'localStorage=globalThis.localStorage,sessionStorage=globalThis.sessionStorage,' +
    'navigator=globalThis.navigator;\n' + code
  );
}

// 从 fixtures/ 载入（试爆用，不碰真源码）
export function loadFixture(name) {
  const code = fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
  (0, eval)(code);
}
