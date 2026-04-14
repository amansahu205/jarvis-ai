from fastapi import APIRouter
from app.api.v1 import auth, regumap, telemetry

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(regumap.router, prefix="/regumap", tags=["regumap"])
router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])