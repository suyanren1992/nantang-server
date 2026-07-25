# server/tests

D 系列回归测试集合。

## 怎么跑

```bash
pip install -r requirements-dev.txt   # pytest + pytest-asyncio + httpx
cd server
pytest tests/ -v
```

测试自动建临时 SQLite 库（不碰开发库 `nantang_fresh.db`），用 httpx ASGI 传输直连 FastAPI，不走网络。

## 怎么加新测试

1. 新文件放 `tests/`，命名 `test_<模块>.py`
2. 用 `client` fixture 发请求，用 `db` fixture 直连库做断言
3. 辅助函数可放同一文件，跨文件共享则写进 `conftest.py`
4. 每个 bug 修完必加一条回归测试，命名 `test_<卡名>_<行为>`

## 测试数据怎么造

- 造用户：用 `server.auth_utils.hash_password` 直接写库（绕开注册邀请码），见 `test_auth.py::_create_user`
- 造任务/营地：直接 `session.add(Model(...))` + `commit()`
- 鉴权：登录拿 token → `{"Authorization": f"Bearer {tok}"}`
- 环境变量：用 pytest `monkeypatch.setenv/delenv`（每测试自动回滚）
