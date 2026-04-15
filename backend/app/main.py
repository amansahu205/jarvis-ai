import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.config import settings
from app.database import create_tables
from app.models import *
from app.api.v1.router import router
from services.sentinel_monitor import SentinelAgent


def _build_allowed_origins() -> list[str]:
    configured = [origin.strip() for origin in settings.FRONTEND_URL.split(',') if origin.strip()]
    dev_defaults = ['http://localhost:3000', 'http://127.0.0.1:3000']
    ordered: list[str] = []
    for origin in configured + dev_defaults:
        if origin not in ordered:
            ordered.append(origin)
    return ordered


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    monitor_task = asyncio.create_task(SentinelAgent().run_forever())
    app.state.sentinel_monitor_task = monitor_task
    try:
        yield
    finally:
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass


def create_app() -> FastAPI:
    app = FastAPI(
        title='JarvisAI',
        version='1.0.0',
        docs_url='/docs' if settings.DEBUG else None,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_build_allowed_origins(),
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    @app.exception_handler(Exception)
    async def global_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={'success': False, 'error': str(exc), 'code': 'INTERNAL_ERROR'}
        )

    app.include_router(router, prefix='/api/v1')
    return app


app = create_app()


