"""FastAPI application entry point — serves API + frontend static files."""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from database import init_db
from routes import auth, nt, tasks, camps, data

# 前端文件目录（nantang-mobile）
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "nantang-mobile"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path(__file__).resolve().parent.parent  # fallback


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="南塘云村 API",
    description="Nantang Cloud Village — Backend API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
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


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# 前端静态文件 + 禁止缓存（内测期间）
from starlette.responses import FileResponse
import os as _os

class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

if FRONTEND_DIR.exists():
    app.mount("/", NoCacheStaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


# 根 URL 由 StaticFiles 处理（html=True 自动返回 index.html）
