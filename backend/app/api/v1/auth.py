from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.core.storage import get_storage
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    UserPublic,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _to_public(user: dict[str, Any]) -> UserPublic:
    return UserPublic(
        user_id=user["user_id"],
        name=user["name"],
        email=user["email"],
        role=user.get("role", "user"),
        is_verified=bool(user.get("is_verified", True)),
    )


def _issue_tokens(user: dict[str, Any], request: Request) -> AuthResponse:
    storage = get_storage()
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    user_agent = request.headers.get("user-agent", "unknown")
    storage.create_session(user["user_id"], client_ip, user_agent)

    access_token = create_access_token(
        subject=user["user_id"],
        email=user["email"],
        role=user.get("role", "user"),
        name=user["name"],
    )
    refresh_raw = generate_refresh_token()
    refresh_exp = (
        datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ).isoformat()
    storage.store_refresh_token(user["user_id"], hash_token(refresh_raw), refresh_exp)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_raw,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_to_public(user),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request):
    storage = get_storage()
    if storage.get_user_by_email(req.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar",
        )
    user = storage.create_user(req.name, req.email, hash_password(req.password))
    return _issue_tokens(user, request)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, request: Request):
    storage = get_storage()
    user = storage.get_user_by_email(req.email)
    if user is None or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau kata sandi salah",
        )
    return _issue_tokens(user, request)


@router.post("/refresh", response_model=AuthResponse)
def refresh(req: RefreshRequest, request: Request):
    storage = get_storage()
    token_digest = hash_token(req.refresh_token)
    record = storage.verify_refresh_token(token_digest)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token tidak valid atau kedaluwarsa",
        )
    user = storage.get_user_by_id(record["user_id"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pengguna tidak ditemukan",
        )
    storage.revoke_refresh_token(token_digest)
    return _issue_tokens(user, request)


@router.post("/logout")
def logout(req: LogoutRequest):
    if req.refresh_token:
        get_storage().revoke_refresh_token(hash_token(req.refresh_token))
    return {"status": "ok"}


@router.get("/me", response_model=UserPublic)
def me(user: dict[str, Any] = Depends(get_current_user)):
    return _to_public(user)
