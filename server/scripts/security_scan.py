#!/usr/bin/env python3
"""security_scan.py — 依赖漏洞月扫（轻量优先）。

策略：
  - 优先用 pip-audit（PyPA 官方，数据库来自 OSV）
  - pip-audit 未装则降级输出提示 + "扫描时间 + 0 结果（未扫描）" 防静默失效
  - 输出一份 markdown 报告到 server/scripts/security_report_YYYY-MM.md

用法：
  python server/scripts/security_scan.py            # 当月报告
  python server/scripts/security_scan.py --install  # 自动 pip install pip-audit 后再扫
"""
import argparse, subprocess, sys, datetime, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
REQ = ROOT / "requirements.txt"
REPORT_DIR = Path(__file__).resolve().parent


def now_ym():
    return datetime.datetime.now().strftime("%Y-%m")


def now_ts():
    return datetime.datetime.now().isoformat(timespec="seconds")


def run_pip_audit():
    """返回 (成功?, 文本输出, 漏洞数)。失败时返回 (False, 错误文本, -1)。"""
    if not REQ.exists():
        return False, f"requirements.txt 不存在: {REQ}", -1
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pip_audit", "-r", str(REQ), "--format", "json"],
            capture_output=True, text=True, timeout=120,
        )
    except FileNotFoundError:
        return False, "pip-audit 未安装。pip install pip-audit 后重试，或加 --install。", -1
    except subprocess.TimeoutExpired:
        return False, "pip-audit 超时（120s）", -1
    out = proc.stdout.strip() or proc.stderr.strip()
    # pip-audit 有漏洞时 exit code 非 0 但输出仍是合法 JSON
    import json as _json
    try:
        data = _json.loads(out) if out else {}
    except _json.JSONDecodeError:
        return False, out[:2000], -1
    count = 0
    lines = []
    for dep in data.get("dependencies", []):
        for vuln in dep.get("vulns", []):
            count += 1
            lines.append(
                f"- **{dep.get('name')} {dep.get('version')}**: "
                f"{vuln.get('id')} (fix: {', '.join(vuln.get('fix_versions') or ['无'])}) — {vuln.get('description','')[:120]}"
            )
    return True, ("\n".join(lines) if lines else "无已知漏洞"), count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--install", action="store_true", help="先 pip install pip-audit")
    args = ap.parse_args()

    if args.install:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pip-audit"])

    ts = now_ts()
    ym = now_ym()
    ok, body, count = run_pip_audit()

    if ok:
        head = f"# 依赖漏洞月报 {ym}\n\n- 扫描时间: {ts}\n- 数据源: pip-audit (OSV)\n- 漏洞数: **{count}**\n\n"
        if count > 0:
            head += "## 漏洞列表\n\n"
        else:
            head += "（0 漏洞）\n\n"
        report = head + body + "\n"
        if count > 0:
            print(f"\033[31m发现 {count} 个漏洞，请见报告\033[0m")
        else:
            print(f"\033[32m无已知漏洞\033[0m")
    else:
        # 失败也必须落一份报告（防静默失效：卡面判据要求"含0漏洞也要输出"）
        report = (
            f"# 依赖漏洞月报 {ym}\n\n"
            f"- 扫描时间: {ts}\n"
            f"- **状态: 未扫描成功**\n"
            f"- 原因: {body}\n\n"
            f"请手动执行 `pip install pip-audit && python server/scripts/security_scan.py` 重扫。\n"
        )
        print(f"\033[33m扫描失败：{body}\033[0m")

    out_path = REPORT_DIR / f"security_report_{ym}.md"
    out_path.write_text(report, encoding="utf-8")
    print(f"报告已写入: {out_path}")
    sys.exit(0 if ok and count == 0 else 1)


if __name__ == "__main__":
    main()
