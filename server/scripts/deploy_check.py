#!/usr/bin/env python3
"""deploy_check.py — 部署前总检（纯 stdlib，零依赖）。

六检:
  1. 依赖对账: requirements.txt 清单 vs 代码实际 import, 缺则报红
  2. ?v= 一致性: index.html 引用的 js/css 是否都带 ?v=, 漏则报黄(缓存铁律机检)
  3. JS 语法机检: node --check 逐文件检查 JS 语法, 语法错则 FAIL 拦截(219ce8b 同类)
  4. API 契约机检: api.js 的 this.request 清单 vs routes/*.py 的 @router 清单双向对扫(前端调后端没有/方法不匹配 FAIL, 后端未调 WARN)
  5. 环境变量清单: 代码里 os.environ / os.getenv 读取的变量汇总成表
  6. 部署后冒烟: 给定 URL, 检查站点 200 / /api/nt/sync 401 / 版本号回显

用法:
  python server/scripts/deploy_check.py                          # 本地六检
  python server/scripts/deploy_check.py --url https://x.pages.dev
  python server/scripts/deploy_check.py --skip-smoke
"""
import argparse, ast, os, re, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SERVER = ROOT / "server"
FRONTEND = ROOT / "nantang-mobile"
REQUIREMENTS = ROOT / "requirements.txt"
INDEX_HTML = FRONTEND / "index.html"
API_JS = FRONTEND / "js" / "api.js"

STDLIBS = set(sys.stdlib_module_names) | {"__future__"}
LOCAL_PREFIXES = ("routes", "models", "database", "auth_utils", "nt_helpers",
                  "chain_scanner", "cron")
PACKAGE_TO_REQ = {
    "bcrypt": "bcrypt", "fastapi": "fastapi", "uvicorn": "uvicorn",
    "sqlalchemy": "sqlalchemy", "aiosqlite": "aiosqlite", "asyncpg": "asyncpg",
    "jose": "python-jose", "web3": "web3", "pydantic": "pydantic", "httpx": "httpx",
}
RED = "\033[31m"; YEL = "\033[33m"; GRN = "\033[32m"; RST = "\033[0m"


def _collect_imports(py_file):
    try: tree = ast.parse(py_file.read_text(encoding="utf-8"))
    except SyntaxError: return set()
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names: names.add(a.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module.split(".")[0])
    return names


def _parse_requirements(req_file):
    pkgs = set()
    if not req_file.exists(): return pkgs
    for line in req_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"): continue
        name = re.split(r"[<>=!~\[]", line, maxsplit=1)[0].strip()
        pkgs.add(name)
    return pkgs


def _collect_env_vars(py_file):
    try: tree = ast.parse(py_file.read_text(encoding="utf-8"))
    except SyntaxError: return set()
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Subscript):
            if (isinstance(node.value, ast.Attribute) and isinstance(node.value.value, ast.Name)
                    and node.value.value.id == "os" and node.value.attr == "environ"):
                sl = node.slice
                if isinstance(sl, ast.Constant) and isinstance(sl.value, str):
                    names.add(sl.value)
        elif isinstance(node, ast.Call):
            func = node.func; key = None
            if (isinstance(func, ast.Attribute) and func.attr == "get"
                    and isinstance(func.value, ast.Attribute)
                    and isinstance(func.value.value, ast.Name)
                    and func.value.value.id == "os" and func.value.attr == "environ"):
                key = node.args[0] if node.args else None
            elif (isinstance(func, ast.Attribute) and func.attr == "getenv"
                  and isinstance(func.value, ast.Name) and func.value.id == "os"):
                key = node.args[0] if node.args else None
            if key and isinstance(key, ast.Constant) and isinstance(key.value, str):
                names.add(key.value)
    return names


def check_deps():
    print(f"\n{GRN}[1/6] 依赖对账{RST}")
    req_pkgs = _parse_requirements(REQUIREMENTS)
    all_imports = set()
    for py in SERVER.rglob("*.py"):
        if "__pycache__" in py.parts or ".archives" in py.parts or "tests" in py.parts: continue
        all_imports |= _collect_imports(py)
    third_party = {n for n in all_imports
                   if n not in STDLIBS and not any(n.startswith(p) for p in LOCAL_PREFIXES)}
    missing = []
    for imp in sorted(third_party):
        req_name = PACKAGE_TO_REQ.get(imp)
        if req_name is None:
            print(f"  {YEL}? {imp} 不在 PACKAGE_TO_REQ 映射里, 请确认{RST}")
            continue
        if req_name not in req_pkgs:
            missing.append((imp, req_name))
    if missing:
        for imp, req in missing:
            print(f"  {RED}X 代码 import '{imp}' 但 requirements.txt 缺 '{req}'{RST}")
        return False
    print(f"  {GRN}V {len(third_party)} 个第三方 import 均已声明{RST}")
    return True


def check_cache_busting():
    print(f"\n{GRN}[2/6] ?v= 一致性(缓存铁律机检){RST}")
    if not INDEX_HTML.exists():
        print(f"  {YEL}? index.html 不存在, 跳过{RST}"); return True
    html = INDEX_HTML.read_text(encoding="utf-8")
    local_refs = re.findall(r'(?:src|href)="((?!https?://)[^"]+\.(?:js|css))"', html)
    missing_v = [r for r in local_refs if "?v=" not in r]
    if missing_v:
        for r in missing_v:
            print(f"  {YEL}! {r} 未带 ?v=, 改了文件用户拿不到新版本{RST}")
        return False
    print(f"  {GRN}V {len(local_refs)} 个本地 js/css 引用全部带 ?v={RST}")
    return True


REQUIRED_ENV = {"JWT_SECRET", "DATABASE_URL"}
OPTIONAL_INFO = {
    "INVITE_CODES": "邀请制码池, 空=关闭邀请制",
    "FRONTEND_ORIGIN": "额外 CORS 白名单(逗号分隔)",
    "MAX_BEDS_PER_ROOM": "宿舍每间最大床位数(默认 6)",
    "CRON_ACTIVE": "cron 开关(1/true/yes 启用)",
    "OP_RPC_URL": "Optimism RPC 节点 URL",
    "NT_TOKEN_CONTRACT": "NT 代币合约地址",
    "PLATFORM_WALLET_ADDRESS": "平台冷钱包地址",
    "SCAN_INTERVAL": "链扫描间隔秒(默认 30)",
    "SCAN_START_BLOCKS_BACK": "链扫描回补块数(默认 500)",
    "EARN_SYNC_DAILY_LIMIT": "每日 earn 上限(默认 5)",
    "EARN_SYNC_MAX_BATCH": "单次同步最大批(默认 50)",
}


def check_js_syntax():
    """T-1: JS 语法机检——subprocess node --check 逐文件检查 index.html 引用的本地 js。

    node 不可用时降级 WARN（不静默 PASS），避免 219ce8b 类语法错误带病上线。
    """
    print(f"\n{GRN}[3/6] JS 语法机检{RST}")
    if not INDEX_HTML.exists():
        print(f"  {YEL}? index.html 不存在, 跳过{RST}"); return True
    html = INDEX_HTML.read_text(encoding="utf-8")
    # 复用 ?v= 检的清单逻辑：取 .js 本地引用
    local_js_refs = re.findall(r'src="((?!https?://)[^"]+\.js(?:\?v=\d+)?)"', html)
    if not local_js_refs:
        print(f"  {YEL}! 未发现本地 JS 引用{RST}"); return True

    try:
        r = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10)
        if r.returncode != 0:
            print(f"  {YEL}! node --version 不可用(returncode={r.returncode}), JS 语法机检缺失——请装 node.js 后重跑{RST}")
            return True
    except FileNotFoundError:
        print(f"  {YEL}! node 命令未找到, JS 语法机检缺失——请装 node.js 后重跑{RST}")
        return True
    except Exception as e:
        print(f"  {YEL}! node 检测异常({e}), JS 语法机检缺失{RST}")
        return True

    ok = True
    for ref in sorted(set(local_js_refs)):
        clean = ref.split("?v=")[0] if "?v=" in ref else ref
        js_path = (FRONTEND / clean).resolve()
        if not js_path.exists():
            print(f"  {YEL}! JS 路径不存在: {clean} (index.html 引用){RST}")
            continue
        r = subprocess.run(["node", "--check", str(js_path)],
                           capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            err = (r.stderr.strip() or r.stdout.strip() or "语法错误")
            brief = err.split("\n")[0] if "\n" in err else err
            print(f"  {RED}X 语法错误: {clean} — {brief}{RST}")
            ok = False
        else:
            print(f"  {GRN}V {clean} 语法通过{RST}")

    if ok:
        print(f"  {GRN}V {len(set(local_js_refs))} 个 JS 文件语法全部通过{RST}")
    else:
        print(f"  {RED}X 存在 JS 语法错误，请修复后重新运行{RST}")
    return ok


def _split_top_plus(expr):
    """按顶层 + 切分 JS 表达式（跳过引号/括号内的 +）。"""
    parts, depth, q, cur = [], 0, None, ""
    for c in expr:
        if q:
            cur += c
            if c == q: q = None
        elif c in "\'\"":
            q = c; cur += c
        elif c in "([{": depth += 1; cur += c
        elif c in ")]}": depth -= 1; cur += c
        elif c == "+" and depth == 0:
            parts.append(cur); cur = ""
        else:
            cur += c
    if cur.strip(): parts.append(cur)
    return parts


def _norm_fe_path(expr):
    """把 api.js 路径表达式归一化：字符串字面量拼接, 变量段折成 {}, 去 query。"""
    out = ""
    for part in _split_top_plus(expr):
        part = part.strip()
        m = re.match(r"^'([^']*)'$", part) or re.match(r'^"([^"]*)"$', part)
        if m:
            out += m.group(1)
        else:
            if out.endswith("/"): out += "{}"
            else: break
    out = out.split("?")[0]
    if len(out) > 1: out = out.rstrip("/")
    return out


def _extract_fe_calls(src):
    """从 api.js 抽取 (METHOD, 归一化路径) 集合。"""
    calls = set()
    for m in re.finditer(r"this\.request\(", src):
        tail = src[m.end(): m.end() + 300]
        mm = re.match(r"\s*'(\w+)'\s*,\s*", tail)
        if not mm: continue
        method = mm.group(1); rest = tail[mm.end():]
        depth = 0; q = None; expr = ""
        for c in rest:
            if q:
                expr += c
                if c == q: q = None
            elif c in "\'\"":
                q = c; expr += c
            elif c in "([{": depth += 1; expr += c
            elif c in ")]}":
                if depth == 0: break
                depth -= 1; expr += c
            elif c == "," and depth == 0:
                break
            else:
                expr += c
        path = _norm_fe_path(expr.strip())
        if path.startswith("/api/"):
            calls.add((method.upper(), path))
    return calls


def _extract_be_routes():
    """从 routes/*.py 抽取 (METHOD, prefix+子路径, {} 归一) 集合。"""
    routes = set()
    routes_dir = SERVER / "routes"
    for f in sorted(routes_dir.glob("*.py")):
        txt = f.read_text(encoding="utf-8")
        prefixes = {}
        for pm in re.finditer(r"(\w+)\s*=\s*APIRouter\(\s*prefix=[\'\"]([^\'\"]*)[\'\"]", txt):
            prefixes[pm.group(1)] = pm.group(2)
        for dm in re.finditer(r"@(\w+)\.(get|post|put|delete)\(\s*[\'\"]([^\'\"]*)[\'\"]", txt):
            var, method, sub = dm.group(1), dm.group(2), dm.group(3)
            full = prefixes.get(var, "") + sub
            full = re.sub(r"\{[^}]+\}", "{}", full)
            if len(full) > 1: full = full.rstrip("/")
            routes.add((method.upper(), full))
    return routes


def _frontend_api_corpus():
    """整前端 js 目录里出现过的 /api/... 字面量前缀集合（用于后端→前端 WARN 判定）。"""
    corpus = set()
    js_dir = FRONTEND / "js"
    if not js_dir.exists(): return corpus
    for f in js_dir.glob("*.js"):
        txt = f.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"[\'\"](/api/[A-Za-z0-9_\-/]*)", txt):
            path = m.group(1)
            corpus.add(path.rstrip("/") if len(path) > 1 else path)
    return corpus


def check_api_contract():
    """S-2: API 契约机检——双向对扫 api.js this.request vs routes/*.py @router。

    前端调了后端没有 -> FAIL; 方法不匹配 -> FAIL; 后端有前端未调 -> WARN 不阻塞。
    (node 非必需, 纯 stdlib 静态解析; api.js 缺失时降级 WARN, 不静默 PASS。)
    """
    print(f"\n{GRN}[4/6] API 契约机检{RST}")
    if not API_JS.exists():
        print(f"  {YEL}! api.js 不存在({API_JS}), API 契约机检缺失——请核查前端路径{RST}")
        return True
    fe = _extract_fe_calls(API_JS.read_text(encoding="utf-8"))
    be = _extract_be_routes()
    if not fe:
        print(f"  {YEL}! 未从 api.js 解析到 this.request 调用, API 契约机检缺失{RST}")
        return True
    be_by_path = {}
    for mth, path in be:
        be_by_path.setdefault(path, set()).add(mth)

    ok = True
    for mth, path in sorted(fe):
        if path not in be_by_path:
            print(f"  {RED}X 前端调后端没有: {mth} {path}{RST}"); ok = False
        elif mth not in be_by_path[path]:
            print(f"  {RED}X 方法不匹配: 前端 {mth} {path} / 后端仅 {sorted(be_by_path[path])}{RST}"); ok = False

    corpus = _frontend_api_corpus()
    def _called(be_path):
        prefix = be_path.split("{}")[0].rstrip("/")
        for c in corpus:
            if c == be_path or c == prefix: return True
            if "{}" in be_path and c.startswith(prefix) and len(c) > len(prefix): return True
        return False
    warns = [(m, p) for (m, p) in sorted(be) if not _called(p)]
    for mth, path in warns:
        print(f"  {YEL}! 后端有前端未调: {mth} {path} (WARN 不阻塞){RST}")

    if ok:
        print(f"  {GRN}V 前端 {len(fe)} 调用全部命中后端路由(路径/方法一致); "
              f"后端 {len(be)} 路由中 {len(warns)} 个前端未调(WARN){RST}")
    else:
        print(f"  {RED}X 存在前端调用与后端路由不匹配, 请修复后重跑{RST}")
    return ok


def check_env_vars():
    print(f"\n{GRN}[5/6] 环境变量清单{RST}")
    all_vars = set()
    for py in SERVER.rglob("*.py"):
        if "__pycache__" in py.parts or ".archives" in py.parts or "tests" in py.parts: continue
        all_vars |= _collect_env_vars(py)
    print(f"  代码读取的环境变量共 {len(all_vars)} 个:")
    for v in sorted(all_vars):
        mark = f"{RED}必需{RST}" if v in REQUIRED_ENV else "可选"
        info = OPTIONAL_INFO.get(v, "")
        print(f"    [{mark}] {v:30s} {info}")
    missing_required = [v for v in REQUIRED_ENV if v not in all_vars]
    if missing_required:
        print(f"  {YEL}! 未扫描到必需环境变量: {missing_required} (可能别名化){RST}")
    return True


def check_smoke(base_url):
    print(f"\n{GRN}[6/6] 部署后冒烟 ({base_url}){RST}")
    ok = True
    def _get(path):
        url = base_url.rstrip("/") + path
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="GET"), timeout=10) as resp:
                return resp.status, resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", errors="replace")
        except Exception as e:
            return None, str(e)
    code, body = _get("/")
    if code == 200:
        print(f"  {GRN}V 首页 / -> 200{RST}")
    else:
        print(f"  {RED}X 首页 / -> {code}{RST}"); ok = False
    code, _ = _get("/api/nt/sync")
    if code in (401, 403, 422):
        print(f"  {GRN}V /api/nt/sync 未鉴权 -> {code} (鉴权生效){RST}")
    else:
        print(f"  {RED}X /api/nt/sync 未鉴权 -> {code} (鉴权可能失效){RST}"); ok = False
    if body and "?v=" in body:
        versions = re.findall(r'\?v=(\d+)', body)
        print(f"  {GRN}V 版本号回显: {sorted(set(versions), key=int)[-3:]}{RST}")
    else:
        print(f"  {YEL}! 首页未发现 ?v= 版本号{RST}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--skip-smoke", action="store_true")
    args = ap.parse_args()
    print("=" * 60)
    print("南塘云村 · 部署总检 (deploy_check.py · 纯 stdlib)")
    print("=" * 60)
    results = [("依赖对账", check_deps()), ("?v= 一致性", check_cache_busting()),
               ("JS语法机检", check_js_syntax()), ("API契约", check_api_contract()),
               ("环境变量", check_env_vars())]
    if not args.skip_smoke:
        results.append(("部署冒烟", check_smoke(args.url)))
    print("\n" + "=" * 60)
    all_ok = all(r[1] for r in results)
    for name, r in results:
        status = f"{GRN}PASS{RST}" if r else f"{RED}FAIL{RST}"
        print(f"  {name:15s} {status}")
    print("=" * 60)
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
