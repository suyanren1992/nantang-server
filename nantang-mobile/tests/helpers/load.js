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
  (0, eval)(code);
}

// 从 fixtures/ 载入（试爆用，不碰真源码）
export function loadFixture(name) {
  const code = fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
  (0, eval)(code);
}
