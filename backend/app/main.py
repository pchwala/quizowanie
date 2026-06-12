import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.dependencies import init_firebase
from app.routers import bundles, sync

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    yield


app = FastAPI(title="Quizowanie API", lifespan=lifespan)


# Unhandled exceptions normally become 500s in Starlette's outermost error
# middleware — OUTSIDE CORSMiddleware — so the browser reports a bogus CORS
# failure instead of the real 500. Catch here (inside CORS: added first =
# innermost) so error responses still get CORS headers.
@app.middleware("http")
async def errors_with_cors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bundles.router)
app.include_router(sync.router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
