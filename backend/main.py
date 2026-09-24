from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API ComfyAir untuk Rekomendasi Suhu AC Dinamis & Kurva Tidur Biologis"
)

# CORS Middleware agar Frontend Next.js di localhost:3000 dapat mengakses API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Boleh disesuaikan ke origin Next.js
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "app": "ComfyAir Backend API",
        "status": "Online",
        "docs": "/docs"
    }
