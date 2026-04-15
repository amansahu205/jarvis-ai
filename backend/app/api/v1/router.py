from fastapi import APIRouter
from app.api.v1 import auth, regumap, telemetry, locations

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(regumap.router, prefix="/regumap", tags=["regumap"])
router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])
router.include_router(locations.router, prefix="/locations", tags=["locations"])