from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt, JWTError
from app.config import settings

_ROUNDS = 12


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        'sub': str(user_id),
        'role': role,
        'exp': expire,
        'type': 'access',
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def create_agent_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    payload = {
        'type': 'agent',
        'exp': expire,
    }
    return jwt.encode(payload, settings.AGENT_TOKEN_SECRET, algorithm='HS256')


def decode_token(token: str, secret: str = None) -> dict:
    if secret is None:
        secret = settings.JWT_SECRET
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except JWTError as e:
        raise ValueError(f'Invalid token: {e}')
