"""FastAPI application entry point — serves API + frontend static files."""
import os
import asyncio
import logging
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from database import init_db, async_session
from routes import auth, nt, tasks, camps, data, accommodation, admin, covenant

# BE-2②: 日志写文件——INFO 级以上落盘，cron 等模块的 logger 自动接入根配置
LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    filename=str(LOG_DIR / "app.log"),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    encoding="utf-8",
)
logger = logging.getLogger("nantang")

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
        logger.error(f"[scanner] 初始化失败: {e}")
    # P5: 启动 cron（每日 00:05 触发，asyncio sleep loop）
    cron_task = None
    try:
        from cron import run_cron
        cron_task = asyncio.create_task(run_cron())
        app.state.cron_task = cron_task
    except Exception as e:
        logger.error(f"[cron] 初始化失败: {e}")
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

# D-2: CORS 精确白名单（CR-1）——通配符域名 + allow_credentials = CSRF 敞口
_cors_origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://nantang.imeeting.club",
    "https://nantang-server.pages.dev",
]
# 环境变量 FRONTEND_ORIGIN 存在才追加，逗号可分隔多个
if os.environ.get("FRONTEND_ORIGIN"):
    _cors_origins += [o.strip() for o in os.environ["FRONTEND_ORIGIN"].split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["X-Total-Count"],  # B-3: 分页总数头需显式暴露给分离部署前端
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
app.include_router(covenant.router)  # G-1 公约签署
app.include_router(nt.system_router)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    t0 = time.time()
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    # BE-2②: 每请求一行记录（时间由日志格式自带）
    logger.info(f"{request.method} {request.url.path} {response.status_code} {(time.time()-t0)*1000:.0f}ms")
    return response


# BE-2①: 全局异常兜底——只接"漏网之鱼"，现有手工 raise HTTPException 不受影响
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    fields = [{"loc": [str(x) for x in e.get("loc", [])], "msg": e.get("msg", "")} for e in exc.errors()]
    logger.warning(f"参数校验失败 {request.method} {request.url.path}: {fields}")
    return JSONResponse(status_code=422, content={"ok": False, "error": "参数有误", "fields": fields})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"未捕获异常 {request.method} {request.url.path}")
    return JSONResponse(status_code=500, content={"ok": False, "error": "系统开小差了，请稍后再试"})


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# 前端静态文件——浏览器正常缓存 JS/CSS，只 HTML 每次拉新
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


# 根 URL 由 StaticFiles 处理（html=True 自动返回 index.html）
