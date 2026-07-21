"""一次性迁移（2026-07-21）：users.frozen_cv 默认值 75 → 0。

对 server/nantang_fresh.db 执行 UPDATE users SET frozen_cv = 0。
仅用 sqlite3 标准库；运行前已有 .bak 备份（nantang_fresh_20260721_134513.db.bak）。
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "nantang_fresh.db")


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA user_version")
    print(f"PRAGMA user_version = {cur.fetchone()[0]}")
    cur.execute("UPDATE users SET frozen_cv = 0")
    print(f"影响行数: {cur.rowcount}")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
