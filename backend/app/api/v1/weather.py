from fastapi import APIRouter, HTTPException, Query, status

from app.services.weather_service import weather_service

router = APIRouter(prefix="/weather", tags=["Weather"])


@router.get("/cities")
def list_supported_cities():
    return {"cities": weather_service.list_cities()}


@router.get("")
async def get_city_weather(city: str = Query("Yogyakarta")):
    snapshot = await weather_service.get_weather(city)
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kota '{city}' tidak didukung",
        )
    return snapshot
