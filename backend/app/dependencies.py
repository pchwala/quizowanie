from typing import AsyncGenerator

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.user import User

_firebase_app: firebase_admin.App | None = None

bearer_scheme = HTTPBearer()


def init_firebase() -> firebase_admin.App:
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    cred = credentials.ApplicationDefault()
    _firebase_app = firebase_admin.initialize_app(
        cred, {"projectId": settings.firebase_project_id}
    )
    return _firebase_app


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    http_credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = http_credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token, app=_firebase_app)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token wygasł",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowe dane uwierzytelniające",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid: str = decoded["uid"]
    email: str = decoded.get("email", "")

    result = await db.execute(select(User).where(User.firebase_uid == uid))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(firebase_uid=uid, email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user
