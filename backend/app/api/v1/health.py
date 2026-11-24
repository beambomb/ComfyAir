import socket
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.core.config import settings
from app.core.storage import get_storage
from app.services.ml_service import ml_service
from app.services.telemetry import telemetry_manager
from app.services.weather_service import weather_service

router = APIRouter(tags=["System"])


@router.get("/health")
def health_check(request: Request):
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    info = ml_service.get_model_info()
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "client_ip": client_ip,
        "server_hostname": socket.gethostname(),
        "storage_backend": get_storage().storage_backend_name,
        "ml_model_loaded": info["loaded"],
        "ml_model_name": info["model_name"],
        "ws_connections": telemetry_manager.connection_count,
        "weather_cache_entries": weather_service.cache_size,
    }
