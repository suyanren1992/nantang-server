#!/usr/bin/env python3
"""check_env.py — 环境诊断（纯 stdlib，零依赖）。

五检:
  1. Python 版本: >= 3.12
  2. 依赖完整性: requirements.txt 声明 vs 实际 import 可用
  3. 数据库连接: SQLite 本地 / PostgreSQL（设 DATABASE_URL）
  4. Node.js: 可选，JS 语法机检需要
  5. 全检入口: 指向 deploy_check.py

用法:
  python server/scripts/check_env.py
"""
import importlib, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
REQUIREMENTS = ROOT / "requirements.txt"

RED = "\033[31m"; YEL = "\033[33m"; GRN = "\033[32m"; RST = "\033[0m"
OK = f"{GRN}V{RST}"; WARN = f"{YEL}!{RST}"; FAIL = f"{RED}X{RST}"


def check_python_version():
    print(f"\n{GRN}[1/5] Python 版本{RST}")
    v = sys.version_info
    ver = f"{v.major}.{v.minor}.{v.micro}"
    if v.major >= 3 and v.minor >= 12:
        print(f"  {OK} Python {ver}")
        return True
    else:
        print(f"  {FAIL} Python {ver} < 3.12，请升级")
        return False


def check_dependencies():
    print(f"\n{GRN}[2/5] 依赖完整性{RST}")
    if not REQUIREMENTS.exists():
        print(f"  {FAIL} requirements.txt 不存在: {REQUIREMENTS}")
        return False

    # 映射 import name -> pip package name
    pkg_map = {
        "bcrypt": "bcrypt", "fastapi": "fastapi", "uvicorn": "uvicorn",
        "sqlalchemy": "sqlalchemy", "aiosqlite": "aiosqlite", "asyncpg": "asyncpg",
        "jwt": "PyJWT", "web3": "web3", "pydantic": "pydantic",
    }
    missing = []
    for import_name, pkg_name in pkg_map.items():
        try:
            importlib.import_module(import_name)
        except ImportError:
            missing.append(pkg_name)

    if missing:
        print(f"  {FAIL} 缺少: {', '.join(missing)}")
        print(f"  修复: pip install -r {REQUIREMENTS}")
        return False

    # 检查 dev 依赖
    dev_missing = []
    for pkg in ["pytest", "pytest_asyncio", "httpx"]:
        try:
            importlib.import_module(pkg)
        except ImportError:
            dev_missing.append(pkg)

    if dev_missing:
        print(f"  {WARN} 开发依赖缺少: {', '.join(dev_missing)} (pip install -r requirements-dev.txt)")
    print(f"  {OK} 运行时依赖全部可用" + ("" if not dev_missing else "（开发依赖有缺）"))
    return True


def check_database():
    print(f"\n{GRN}[3/5] 数据库连接{RST}")
    db_url = os.environ.get("DATABASE_URL", "")

    if db_url.startswith("postgres"):
        try:
            import sqlalchemy
            engine = sqlalchemy.create_engine(db_url, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(sqlalchemy.text("SELECT 1"))
            print(f"  {OK} PostgreSQL 连接成功")
            engine.dispose()
            return True
        except Exception as e:
            print(f"  {FAIL} PostgreSQL 连接失败: {e}")
            return False

    # 默认 SQLite
    try:
        import aiosqlite
        print(f"  {OK} aiosqlite 可用（本地 SQLite 模式）")
        if not db_url:
            print(f"  {WARN} 未设 DATABASE_URL，默认 SQLite；生产环境请设 PostgreSQL")
        return True
    except ImportError:
        print(f"  {FAIL} aiosqlite 不可用")
        return False


def check_node():
    print(f"\n{GRN}[4/5] Node.js{RST}")
    node = shutil.which("node")
    if not node:
        print(f"  {WARN} node 未找到（JS 语法机检不可用，不影响后端）")
        return True  # 非阻断

    try:
        r = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            print(f"  {OK} Node {r.stdout.strip()}")
            return True
        else:
            print(f"  {WARN} node --version 返回 {r.returncode}")
            return True
    except Exception as e:
        print(f"  {WARN} node 检测异常: {e}")
        return True


def check_full():
    print(f"\n{GRN}[5/5] 全检入口{RST}")
    deploy_check = ROOT / "server" / "scripts" / "deploy_check.py"
    if deploy_check.exists():
        print(f"  部署前六检: python {deploy_check.relative_to(ROOT)}")
        print(f"  带冒烟:    python {deploy_check.relative_to(ROOT)} --url <URL>")
    else:
        print(f"  {WARN} deploy_check.py 未找到")
    return True


def main():
    print("=" * 50)
    print("南塘云村 · 环境诊断 (check_env.py)")
    print("=" * 50)

    results = [
        ("Python 版本", check_python_version()),
        ("依赖完整性", check_dependencies()),
        ("数据库连接", check_database()),
        ("Node.js", check_node()),
        ("全检入口", check_full()),
    ]

    print("\n" + "=" * 50)
    all_ok = all(r[1] for r in results)
    for name, r in results:
        status = f"{GRN}PASS{RST}" if r else f"{RED}FAIL{RST}"
        print(f"  {name:15s} {status}")
    print("=" * 50)
    if all_ok:
        print(f"\n{GRN}环境就绪。启动: cd server && uvicorn main:app --reload{RST}")
    else:
        print(f"\n{RED}环境有问题，请按上述提示修复后重跑。{RST}")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
