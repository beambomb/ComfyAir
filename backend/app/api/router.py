from fastapi import APIRouter
from app.api.v1 import auth, health, predict, preferences, savings, weather, ws

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(preferences.router)
api_router.include_router(predict.router)
api_router.include_router(savings.router)
api_router.include_router(weather.router)
api_router.include_router(ws.router)
