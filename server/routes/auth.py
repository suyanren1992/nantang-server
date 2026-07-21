"""Authentication: register, login, refresh (httpOnly cookie), logout."""
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models import User, CommunityPool
from auth_utils import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str; password: str; role: str = "visitor"; avatar_seed: str | None = None


class LoginRequest(BaseModel):
    name: str; password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


def _user_json(u):
    return {"name": u.id, "role": u.role, "nt_balance": u.nt_balance,
            "contribution_value": u.contribution_value, "experience_value": u.experience_value,
            "trust_score": u.trust_score, "trust_level": u.trust_level,
            "frozen_cv": u.frozen_cv, "avatar_seed": u.avatar_seed,
            "bio": u.bio, "location": u.location, "wallet_address": u.wallet_address,
            "created_at": u.created_at}


def _set_rt_cookie(response: Response, token: str):
    response.set_cookie("nt_rt", token, httponly=True, samesite="lax", max_age=7*86400, path="/")


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
    return u


async def require_admin(user: User = Depends(get_current_user)):
    if not user or user.role != "admin": raise HTTPException(status_code=403, detail="Admin required")
    return user


@router.post("/register")
async def register(req: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if not req.name or len(req.name) > 64: return JSONResponse({"ok": False, "error": "用户名需为1-64字符"})
    if len(req.password) < 8: return JSONResponse({"ok": False, "error": "密码至少8位"})
    ex = await db.execute(select(User).where(User.id == req.name))
    if ex.scalar_one_or_none(): return JSONResponse({"ok": False, "error": "用户名已存在"})
    c = await db.execute(select(func.count(User.id)))
    is_first = c.scalar() == 0
    u = User(id=req.name, password_hash=hash_password(req.password),
             role="admin" if is_first else "visitor",
             nt_balance=0,
             avatar_seed=req.avatar_seed or req.name,
             created_at=datetime.utcnow().isoformat(), updated_at=datetime.utcnow().isoformat())
    db.add(u)
    pool = await db.execute(select(CommunityPool).limit(1)); pool = pool.scalar_one_or_none()
    if not pool: pool = CommunityPool(balance=0, total_issued=0, task_escrow=0, contribution_pool=0, camp_balance=0); db.add(pool)
    # ponytail: NT 仅来自链上充值，注册不再赠送
    await db.commit()
    _rt = create_refresh_token(u.id, u.token_version)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role, u.token_version), "user": _user_json(u)}


@router.post("/login")
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # ponytail: 无速率限制。日活 <50 时内存 IP 计数足够，>50 时加 slowapi/Redis。
    u = (await db.execute(select(User).where(User.id == req.name))).scalar_one_or_none()
    if not u: return JSONResponse({"ok": False, "error": "用户不存在"})
    if not verify_password(req.password, u.password_hash): return JSONResponse({"ok": False, "error": "密码错误"})
    _rt = create_refresh_token(u.id, u.token_version)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role, u.token_version), "user": _user_json(u)}


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
    return {"ok": True, "token": create_access_token(u.id, u.role, u.token_version), "user": _user_json(u)}


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
    return _user_json(user)


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), limit: int = 50, offset: int = 0):
    # 公开端点：登录页账号列表用。只返回名字+头像种子，不含任何敏感字段
    result = await db.execute(select(User).limit(limit).offset(offset))
    return [{"name": u.id, "avatar_seed": u.avatar_seed} for u in result.scalars()]
