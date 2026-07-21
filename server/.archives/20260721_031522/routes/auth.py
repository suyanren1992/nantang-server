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


def _user_json(u):
    return {"name": u.id, "role": u.role, "nt_balance": u.nt_balance,
            "contribution_value": u.contribution_value, "experience_value": u.experience_value,
            "trust_score": u.trust_score, "trust_level": u.trust_level,
            "frozen_cv": u.frozen_cv, "avatar_seed": u.avatar_seed,
            "bio": u.bio, "location": u.location, "wallet_address": u.wallet_address,
            "created_at": u.created_at}


def _set_rt_cookie(response: Response, token: str):
    response.set_cookie("nt_rt", token, httponly=False, samesite="lax", max_age=7*86400, path="/")


async def get_current_user(authorization: str = Header(None), db: AsyncSession = Depends(get_db)) -> User | None:
    if not authorization or not authorization.startswith("Bearer "): return None
    payload = decode_token(authorization[7:])
    if not payload: return None
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    return result.scalar_one_or_none()


async def require_admin(user: User = Depends(get_current_user)):
    if not user or user.role != "admin": raise HTTPException(status_code=403, detail="Admin required")
    return user


@router.post("/register")
async def register(req: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if len(req.password) < 6: return JSONResponse({"ok": False, "error": "密码至少6位"})
    ex = await db.execute(select(User).where(User.id == req.name))
    if ex.scalar_one_or_none(): return JSONResponse({"ok": False, "error": "用户名已存在"})
    c = await db.execute(select(func.count(User.id)))
    is_first = c.scalar() == 0
    u = User(id=req.name, password_hash=hash_password(req.password),
             role="admin" if is_first else req.role,
             nt_balance=200 if is_first else 50,
             avatar_seed=req.avatar_seed or req.name,
             created_at=datetime.utcnow().isoformat(), updated_at=datetime.utcnow().isoformat())
    db.add(u)
    pool = await db.execute(select(CommunityPool).limit(1)); pool = pool.scalar_one_or_none()
    if not pool: pool = CommunityPool(balance=2000, total_issued=2000, task_escrow=0); db.add(pool)
    pool.total_issued += (200 if is_first else 50)
    await db.commit()
    _rt = create_refresh_token(u.id)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role), "refresh_token": _rt, "user": _user_json(u)}


@router.post("/login")
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(User).where(User.id == req.name))).scalar_one_or_none()
    if not u: return JSONResponse({"ok": False, "error": "用户不存在"})
    if not verify_password(req.password, u.password_hash): return JSONResponse({"ok": False, "error": "密码错误"})
    _rt = create_refresh_token(u.id)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role), "refresh_token": _rt, "user": _user_json(u)}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    rt = body.get("refresh_token") or request.cookies.get("nt_rt")
    if not rt: return JSONResponse({"ok": False, "error": "无 refresh token"}, status_code=401)
    payload = decode_token(rt)
    if not payload or payload.get("type") != "refresh": return JSONResponse({"ok": False, "error": "token 无效"}, status_code=401)
    u = (await db.execute(select(User).where(User.id == payload["sub"]))).scalar_one_or_none()
    if not u: return JSONResponse({"ok": False, "error": "用户不存在"}, status_code=401)
    _rt = create_refresh_token(u.id)
    _set_rt_cookie(response, _rt)
    return {"ok": True, "token": create_access_token(u.id, u.role), "refresh_token": _rt, "user": _user_json(u)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("nt_rt", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    if not user: raise HTTPException(status_code=401)
    return _user_json(user)


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return [{"name": u.id, "avatar_seed": u.avatar_seed} for u in result.scalars()]
