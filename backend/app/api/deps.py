from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings
from app.database import get_db

bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=["HS256"]
        )
        return {"id": int(payload["sub"]), "role": payload["role"]}
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

async def require_rp(user=Depends(get_current_user)):
    if user["role"] != "responsible_person":
        raise HTTPException(status_code=403, detail="Responsible Person role required")
    return user

async def require_agent(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
):
    try:
        jwt.decode(
            credentials.credentials,
            settings.AGENT_TOKEN_SECRET,
            algorithms=["HS256"]
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid agent token")