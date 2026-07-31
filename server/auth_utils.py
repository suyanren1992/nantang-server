"""Authentication: bcrypt + JWT access/refresh token (industry standard)."""
import os
import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from datetime import datetime, timedelta
import uuid

SECRET_KEY = os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET 环境变量未设置")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15       # TD-3: 15min (short-lived, 前端有401→refresh→retry循环)
REFRESH_TOKEN_EXPIRE_DAYS = 7           # 7 days (httpOnly cookie)
ABSOLUTE_MAX_DAYS = 30                  # R14-3 M47: refresh session 最大年龄


def hash_password(password: str) -> str:
    # bcrypt 上限 72 字节——超长截断（新版 bcrypt 不再静默截断，超 72 字节会 raise ValueError）。
    # 应用层 max_length=128 拦截多 MB DoS；此处 72 截断保证 73-128 字节密码正常哈希。
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8"))


def create_access_token(user_id: str, role: str, token_version: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": user_id, "role": role, "jti": str(uuid.uuid4()), "type": "access", "version": token_version, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": user_id, "jti": str(uuid.uuid4()), "type": "refresh", "version": token_version, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
