from sqlalchemy import make_url
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# asyncpg doesn't accept sslmode/channel_binding URL params — strip them and use connect_args
_raw_url = make_url(settings.database_url)
_ASYNC_UNSUPPORTED_PARAMS = {"sslmode", "channel_binding"}
_clean_query = {k: v for k, v in _raw_url.query.items() if k not in _ASYNC_UNSUPPORTED_PARAMS}
_clean_url = _raw_url.set(query=_clean_query)

engine = create_async_engine(_clean_url, connect_args={"ssl": True}, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
