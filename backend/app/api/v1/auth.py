from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.schemas.base import SuccessResponse
from app.models.user import User, UserRole
from app.repositories.user_repo import get_by_email, create
from app.services.auth_service import hash_password, verify_password, create_access_token
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", status_code=201)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await get_by_email(db, request.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=request.email,
        name=request.name,
        hashed_password=hash_password(request.password),
        role=UserRole(request.role),
    )
    user = await create(db, user)
    token = create_access_token(user.id, user.role.value)
    return SuccessResponse(data=TokenResponse(
        access_token=token,
        role=user.role.value,
        name=user.name
    ))

@router.post("/login")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await get_by_email(db, request.email)
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.role.value)
    return SuccessResponse(data=TokenResponse(
        access_token=token,
        role=user.role.value,
        name=user.name
    ))

@router.get("/me")
async def me(db: AsyncSession = Depends(get_db),
             current_user=Depends(get_current_user)):
    from app.repositories.user_repo import get_by_id
    user = await get_by_id(db, current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return SuccessResponse(data={"id": user.id, "email": user.email,
                                  "name": user.name, "role": user.role.value})