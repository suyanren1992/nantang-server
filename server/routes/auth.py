"""Authentication: register, login, refresh (httpOnly cookie), logout."""
import os
import re
import time
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime, date
from database import get_db
from models import User, CommunityPool
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str; password: str; role: str = "visitor"; avatar_seed: str | None = None
    invite_code: str = ''


class LoginRequest(BaseModel):
    name: str; password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


def _user_json(u, include_sensitive=False):
    # IA-2: 敏感字段（location/wallet_address）默认不返回；仅本人可见场景（login/refresh/me/register）传 True。
    d = {"name": u.id, "uid": u.id, "role": u.role, "nt_balance": u.nt_balance,
         "contribution_value": u.contribution_value, "experience_value": u.experience_value,
         "trust_score": u.trust_score, "trust_level": u.trust_level,
         "frozen_cv": u.frozen_cv, "avatar_seed": u.avatar_seed,
         "bio": u.bio, "created_at": u.created_at}
    if include_sensitive:
        d["location"] = u.location
        d["wallet_address"] = u.wallet_address
    return d


def _set_rt_cookie(response: Response, token: str):
    response.set_cookie("nt_rt", token, httponly=True, secure=True, samesite="lax", max_age=7*86400, path="/")


async def get_current_user(authorization: str = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401)
    payload = decode_token(authorization[7:])
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401)
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    u = result.scalar_one_or_none()
    if not u: raise HTTPException(status_code=401)
    if payload.get("version") != u.token_version:
        raise HTTPException(status_code=401)
    # DB-P0-1: 活跃追踪——每请求更新 last_active_at（同日跳过，轻量写入）
    _today = date.today()
    if u.last_active_at != _today:
        u.last_active_at = _today
        await db.commit()
    return u


async def require_admin(user: User = Depends(get_current_user)):
    if not user or user.role != "admin": raise HTTPException(status_code=403, detail="Admin required")
    return user


# ══ P1-2: 登录失败限速（内存 IP 计数）══
# ponytail: 内存态，多进程/重启即丢失。日活 <50 足够；规模化换 slowapi/Redis。
# 连续失败 达阈值 → 锁定 M 分钟；期间任何登录直接 429；成功登录清零；锁定过期自动重置。
_LOGIN_FAIL_MAX = int(os.environ.get("LOGIN_FAIL_MAX", "5"))       # 触发锁定的连续失败次数
_LOGIN_LOCK_MINUTES = int(os.environ.get("LOGIN_LOCK_MINUTES", "15"))  # 锁定时长（分钟）
_login_fails: dict[str, list] = {}  # ip -> [fail_count, lock_until_epoch]


def _client_ip(request: Request) -> str:
    return request.client.host if request and request.client else "unknown"


def _login_lock_remaining(ip: str) -> int:
    """返回该 IP 剩余锁定秒数；0=未锁定。锁定过期则重置计数。"""
    rec = _login_fails.get(ip)
    if not rec:
        return 0
    lock_until = rec[1]
    if lock_until and lock_until > time.time():
        return int(lock_until - time.time()) + 1
    if lock_until:  # 锁已过期 → 清零重来
        _login_fails.pop(ip, None)
    return 0


def _login_record_fail(ip: str):
    rec = _login_fails.get(ip) or [0, 0]
    rec[0] += 1
    if rec[0] >= _LOGIN_FAIL_MAX:
        rec[1] = time.time() + _LOGIN_LOCK_MINUTES * 60
    _login_fails[ip] = rec


def _login_clear(ip: str):
    _login_fails.pop(ip, None)


@router.post("/register")
async def register(req: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # SM-5.5: trim 防「张三␣」影子账号
    name = req.name.strip() if req.name else ""
    if not name or len(name) > 64: return JSONResponse({"ok": False, "error": "用户名需为1-64字符"})
    # D-4 H-1: 用户名字符白名单（中英文/数字/下划线），堵 LIKE 通配符注入入口
    if not re.fullmatch(r"[a-zA-Z0-9_一-龥]+", name): return JSONResponse({"ok": False, "error": "用户名仅限中英文、数字、下划线"})
    if len(req.password) < 8: return JSONResponse({"ok": False, "error": "密码至少8位"})
    # D-3 CR-2: 邀请制——INVITE_CODES 环境变量（逗号分隔码池）；未设置/为空=邀请制关闭，向后兼容
    _codes = os.environ.get("INVITE_CODES", "")
    if _codes.strip():
        _pool = [c.strip() for c in _codes.split(",") if c.strip()]
        if req.invite_code not in _pool:
            return JSONResponse({"ok": False, "error": "邀请码无效"})
    ex = await db.execute(select(User).where(User.id == name))
    if ex.scalar_one_or_none(): return JSONResponse({"ok": False, "error": "这个名字已经被占用了，换一个试试"})
    c = await db.execute(select(func.count(User.id)))
    is_first = c.scalar() == 0
    u = User(id=name, password_hash=hash_password(req.password),
             role="admin" if is_first else "visitor",
             nt_balance=0,
             avatar_seed=req.avatar_seed or name,
             created_at=datetime.utcnow().isoformat(), updated_at=datetime.utcnow().isoformat())
    db.add(u)
    pool = await db.execute(select(CommunityPool).limit(1)); pool = pool.scalar_one_or_none()
    if not pool: pool = CommunityPool(balance=0, total_issued=0, task_escrow=0, contribution_pool=0, camp_balance=0, reserve=0, frozen=0); db.add(pool)
    # ponytail: NT 仅来自链上充值，注册不再赠送
    await db.commit()
    _rt = create_refresh_token(u.id, u.token_version)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role, u.token_version), "user": _user_json(u, include_sensitive=True)}


@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # P1-2: 内存 IP 限速——连续失败达阈值锁定 M 分钟，钝化暴力撞库/枚举。
    ip = _client_ip(request)
    remaining = _login_lock_remaining(ip)
    if remaining > 0:
        return JSONResponse(
            {"ok": False, "error": f"登录失败次数过多，请 {remaining // 60 + 1} 分钟后再试"},
            status_code=429,
        )
    u = (await db.execute(select(User).where(User.id == req.name))).scalar_one_or_none()
    # D-3 M-10: 「用户不存在」与「密码错误」统一文案，消除用户枚举
    if not u:
        _login_record_fail(ip)
        return JSONResponse({"ok": False, "error": "用户名或密码错误"})
    if not verify_password(req.password, u.password_hash):
        _login_record_fail(ip)
        return JSONResponse({"ok": False, "error": "用户名或密码错误"})
    _login_clear(ip)  # 成功登录 → 清零该 IP 失败计数
    _rt = create_refresh_token(u.id, u.token_version)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role, u.token_version), "user": _user_json(u, include_sensitive=True)}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    rt = request.cookies.get("nt_rt")
    if not rt: return JSONResponse({"ok": False, "error": "无 refresh token"}, status_code=401)
    payload = decode_token(rt)
    if not payload or payload.get("type") != "refresh": return JSONResponse({"ok": False, "error": "token 无效"}, status_code=401)
    u = (await db.execute(select(User).where(User.id == payload["sub"]))).scalar_one_or_none()
    if not u: return JSONResponse({"ok": False, "error": "用户不存在"}, status_code=401)
    if payload.get("version") != u.token_version:
        return JSONResponse({"ok": False, "error": "token 已失效"}, status_code=401)
    _rt = create_refresh_token(u.id, u.token_version)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role, u.token_version), "user": _user_json(u, include_sensitive=True)}


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # 手动读取 token，不做强制认证（无 token 用户也要能删 cookie）
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        payload = decode_token(auth_header[7:])
        if payload and payload.get("sub"):
            u = (await db.execute(select(User).where(User.id == payload["sub"]))).scalar_one_or_none()
            if u and payload.get("version") == u.token_version:
                u.token_version += 1
                await db.commit()
    response.delete_cookie("nt_rt", path="/")
    return {"ok": True}


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    if len(req.new_password) < 8:
        return JSONResponse({"ok": False, "error": "密码至少8位"})
    if not verify_password(req.old_password, user.password_hash):
        return JSONResponse({"ok": False, "error": "当前密码错误"})
    user.password_hash = hash_password(req.new_password)
    user.token_version += 1  # 踢掉所有旧登录
    user.updated_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True}


class UpdateProfileRequest(BaseModel):
    wallet_address: str | None = None
    bio: str | None = None
    location: str | None = None


@router.put("/profile")
async def update_profile(req: UpdateProfileRequest, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    if req.wallet_address is not None:
        addr = req.wallet_address.strip()
        if addr:
            if not addr.startswith("0x") or len(addr) != 42:
                raise HTTPException(status_code=400, detail="无效的钱包地址格式（应为 0x 开头的 42 位地址）")
            # 检查地址未被其他用户占用（大小写不敏感）
            from sqlalchemy import func
            dup = (await db.execute(
                select(User).where(func.lower(User.wallet_address) == addr.lower(), User.id != user.id)
            )).scalar_one_or_none()
            if dup: raise HTTPException(status_code=409, detail="该钱包地址已被其他用户绑定")
        user.wallet_address = addr or None
    if req.bio is not None:
        user.bio = req.bio
    if req.location is not None:
        user.location = req.location
    user.updated_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True, "wallet_address": user.wallet_address}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return _user_json(user, include_sensitive=True)


@router.get("/users")
async def list_users(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db), limit: int = 50, offset: int = 0):
    # 只返回名字+头像种子，不含任何敏感字段
    result = await db.execute(select(User).limit(limit).offset(offset))
    return [{"name": u.id, "avatar_seed": u.avatar_seed} for u in result.scalars()]
