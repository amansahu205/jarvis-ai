from fastapi import APIRouter
from app.api.v1 import auth, regumap, telemetry, locations, strategist, shipments

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(regumap.router, prefix="/regumap", tags=["regumap"])
router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])
router.include_router(locations.router, prefix="/locations", tags=["locations"])
router.include_router(strategist.router, prefix="/strategist", tags=["strategist"])
router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
