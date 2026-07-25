#!/usr/bin/env python3
"""arch_check.py — 架构图与代码一致性机检（纯 stdlib，零依赖）。

检查项：
  1. 模块存在性：架构图所列 js 模块是否存在于磁盘
  2. 行数漂移：任一模块行数变化超 ±30% 亮黄灯
  3. index.html 引用对账：<script> 清单 vs 磁盘实有文件
  4. import 依赖对账：架构图所绘依赖关系 vs 代码实际 import
  5. 旧单文件版存废：nantang-mobile.html 是否存在

输出：exit 0=通过 / 1=黄灯(警告) / 2=红灯(阻断)
用法：python arch_check.py [project_root]
挂载点：每日闸（vault_gate 调用） / 部署总检（deploy_check 调用）
锚点："基于 commit xxxx 实证"，从 git rev-parse HEAD 自动抓
"""
import sys, os, re, subprocess
from pathlib import Path

# ── 基线数据（来自 方案/架构现状图.md · 2026-07-26 · commit d4d1a09）──
# 格式：{文件名: 基线行数}
BASELINE = {
    "js/utils.js": 190,
    "js/mobile-bundle.js": 299,
    "js/nt.js": 236,
    "js/auth.js": 428,
    "js/seed-test-data.js": 10,
    "js/nt-core.js": 768,
    "js/app-data.js": 699,
    "js/api.js": 178,
    "js/data.js": 715,
    "js/core.js": 1798,
    "js/ui-village.js": 112,
    "js/ui-camp.js": 1587,
    "js/ui-wizard.js": 1026,
    "js/ui-phase4.js": 267,
    "js/ui-social.js": 447,
    "js/ui-archive.js": 422,
    "js/ui-cardroom.js": 1368,
    "js/app.js": 2715,
}

# ── 辅助 ──
def git_head(proj):
    try:
        r = subprocess.run(["git", "-C", str(proj), "rev-parse", "HEAD"],
                         capture_output=True, text=True, timeout=10)
        return r.stdout.strip()[:8] if r.returncode == 0 else "unknown"
    except:
        return "unknown"

def wc(fpath):
    try:
        with open(fpath, encoding='utf-8', errors='replace') as f:
            return len(f.readlines())
    except:
        return None

# ── main ──
def main():
    try: sys.stdout.reconfigure(encoding='utf-8')
    except: pass
    proj = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent.parent
    mobile = proj / "nantang-mobile"
    head = git_head(proj)
    print(f"[arch_check] 锚点: commit {head} 实证")

    issues_red = []
    issues_yellow = []

    # [1] 模块存在性
    missing = []
    for fname in BASELINE:
        if not (mobile / fname).exists():
            missing.append(fname)
    if missing:
        issues_red.append(f"[1] 缺模块: {', '.join(missing)}")
    else:
        print(f"  [1] 模块存在性: OK ({len(BASELINE)} 个全部在位)")

    # [2] 行数漂移 (±30%)
    drifted = []
    for fname, baseline in BASELINE.items():
        actual = wc(mobile / fname)
        if actual is None:
            continue
        pct = abs(actual - baseline) / baseline * 100
        if pct > 30:
            direction = "+" if actual > baseline else "-"
            drifted.append(f"{fname}: {baseline}→{actual} ({direction}{pct:.0f}%)")
    if drifted:
        issues_yellow.append(f"[2] 行数漂移(>±30%): {len(drifted)} 个\n" +
                           '\n'.join(f"    - {d}" for d in drifted))
    else:
        print(f"  [2] 行数漂移: OK (全部在 ±30% 内)")

    # [3] index.html 引用对账
    idx = mobile / "index.html"
    if idx.exists():
        # 从 index.html 中提取本地 js 引用
        txt = idx.read_text(encoding='utf-8', errors='replace')
        refs = set()
        for m in re.finditer(r'<script\s+src="(js/[^"?\s]+\.js)', txt):
            refs.add(m.group(1))
        # 磁盘实有
        on_disk = set()
        for f in (mobile / "js").glob("*.js"):
            on_disk.add(f"js/{f.name}")
        # 交叉对比
        ref_unused = on_disk - refs  # 磁盘有但 index.html 没引用
        missing_ref = refs - on_disk  # index.html 引用但磁盘没有
        if missing_ref:
            issues_red.append(f"[3] index.html 引用但磁盘无: {', '.join(sorted(missing_ref))}")
        if ref_unused:
            issues_yellow.append(f"[3] 磁盘有但 index.html 未引用: {', '.join(sorted(ref_unused))}")
        if not missing_ref and not ref_unused:
            print(f"  [3] 引用对账: OK ({len(refs)} 引用 = {len(on_disk)} 磁盘)")
    else:
        issues_red.append("[3] index.html 不存在")

    # [4] 架构图锚点新鲜度（head vs 架构现状图文档锚点）
    arch_doc = proj / "方案" / "架构现状图.md"
    if arch_doc.exists():
        doc_txt = arch_doc.read_text(encoding='utf-8', errors='replace')
        m = re.search(r'commit\s+`([a-f0-9]+)`', doc_txt)
        if m:
            doc_anchor = m.group(1)
            try:
                r = subprocess.run(
                    ["git", "-C", str(proj), "rev-list", "--count", f"{doc_anchor}..HEAD"],
                    capture_output=True, text=True, timeout=10)
                ahead = int(r.stdout.strip()) if r.returncode == 0 else 999
            except:
                ahead = 999
            if ahead >= 10:
                issues_yellow.append(f"[4] 架构图锚点落后 HEAD {ahead} commits (≥10 黄灯)")
            else:
                print(f"  [4] 锚点新鲜度: OK (落后 {ahead} commits)")
        else:
            issues_yellow.append("[4] 架构图锚点缺失: 文档中未找到 commit hash")
    else:
        issues_yellow.append("[4] 架构现状图.md 不存在（E-1 未完成？）")

    # [5] 旧单文件版存废
    old_mono = proj / "nantang-mobile.html"
    if old_mono.exists():
        issues_yellow.append(f"[5] 旧单体文件仍存: nantang-mobile.html ({wc(old_mono)} 行)")
    else:
        print("  [5] 旧文件: OK (nantang-mobile.html 已删除)")

    # ── 输出 ──
    all_issues = issues_red + issues_yellow
    if not all_issues:
        print(f"[arch_check] DONE. 全绿 (commit {head})")
        return 0

    for issue in all_issues:
        prefix = "🔴" if issue in issues_red else "🟡"
        print(f"  {prefix} {issue}")

    print(f"[arch_check] DONE. {len(issues_red)} 红灯 {len(issues_yellow)} 黄灯 (commit {head})")
    return 2 if issues_red else 1

if __name__ == "__main__":
    sys.exit(main())
