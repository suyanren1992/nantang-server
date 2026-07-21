"""FastAPI application entry point — serves API + frontend static files."""
import os
import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from database import init_db, async_session
from routes import auth, nt, tasks, camps, data, accommodation, admin

# 前端文件目录（nantang-mobile）
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "nantang-mobile"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path(__file__).resolve().parent.parent  # fallback


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # 启动链扫描器（RPC 未配则跳过）
    scanner_task = None
    try:
        from chain_scanner import _scanner_singleton
        scanner = _scanner_singleton(async_session)
        if scanner:
            scanner_task = asyncio.create_task(scanner.start())
            app.state.chain_scanner = scanner
    except Exception as e:
        print(f"[scanner] 初始化失败: {e}")
    # P5: 启动 cron（每日 00:05 触发，asyncio sleep loop）
    cron_task = None
    try:
        from cron import run_cron
        cron_task = asyncio.create_task(run_cron())
        app.state.cron_task = cron_task
    except Exception as e:
        print(f"[cron] 初始化失败: {e}")
    yield
    if scanner_task:
        scanner_task.cancel()
        try:
            await scanner_task
        except (asyncio.CancelledError, Exception):
            pass
    if cron_task:
        cron_task.cancel()
        try:
            await cron_task
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(
    title="南塘云村 API",
    description="Nantang Cloud Village — Backend API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        os.environ.get("FRONTEND_ORIGIN", "http://localhost:8000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 路由
app.include_router(auth.router)
app.include_router(nt.router)
app.include_router(tasks.router)
app.include_router(camps.router)
app.include_router(data.router)
app.include_router(accommodation.router)
app.include_router(accommodation.role_router)
app.include_router(admin.router)
app.include_router(nt.system_router)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# 前端静态文件——浏览器正常缓存 JS/CSS，只 HTML 每次拉新
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


# 根 URL 由 StaticFiles 处理（html=True 自动返回 index.html）
