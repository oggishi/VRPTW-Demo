from __future__ import annotations

from fastapi import Header, HTTPException

from services.auth_service import get_user_by_token


async def require_user(authorization: str | None = Header(default=None)) -> dict[str, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    return get_user_by_token(token)
