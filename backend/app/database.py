import ssl
import socket
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from app.config import settings


def _build_engine():
    """
    Build the SQLAlchemy async engine using a custom asyncpg creator.

    On networks where asyncio's DNS resolution fails for the Supabase pooler
    hostname (observed with Python 3.12 ProactorEventLoop on Windows/UMD),
    we pre-resolve the host synchronously at startup and connect by IP with
    an SSL context that skips hostname verification.
    """
    # Parse connection details from DATABASE_URL
    # Format: postgresql+asyncpg://user:pass@host:port/db
    url = settings.DATABASE_URL
    without_scheme = url.split('://', 1)[1]
    userinfo, hostinfo = without_scheme.rsplit('@', 1)
    user, password = userinfo.split(':', 1)
    hostport, database = hostinfo.split('/', 1)
    host, port = hostport.rsplit(':', 1)

    # Pre-resolve hostname → IP synchronously (main thread, no async DNS issues)
    try:
        resolved_host = socket.gethostbyname(host)
    except OSError:
        resolved_host = host  # fallback to hostname

    # SSL context: skip hostname check since we're connecting by IP
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    async def creator():
        return await asyncpg.connect(
            host=resolved_host,
            port=int(port),
            user=user,
            password=password,
            database=database,
            ssl=ssl_ctx,
        )

    engine = create_async_engine(
        "postgresql+asyncpg://",
        async_creator=creator,
        echo=settings.DEBUG,
        pool_size=5,
        max_overflow=10,
    )
    return engine


engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
