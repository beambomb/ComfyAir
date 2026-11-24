# Panduan Deployment ke Microsoft Azure (DTETI FT UGM)

Sesuai ketentuan Modul 1 (*"Produk akhir dari setiap kelompok akan di deploy pada akun Azure milik departemen untuk showcase"*), ComfyAir mendukung deployment berbasis kontainer ke **Azure Web App for Containers** atau **Azure Container Apps**.

## 1. Prasyarat
- Akun Azure DTETI & Azure CLI (`az`)
- Azure Container Registry (ACR) atau GitHub Container Registry
- (Opsional) Proyek Supabase PostgreSQL beserta `SUPABASE_URL` dan `SUPABASE_KEY`

## 2. Pengujian Lokal via Docker Compose
```powershell
docker compose up --build
```
- Backend API berjalan di `http://localhost:8000` dengan `HEALTHCHECK` otomatis ke `/api/v1/health`.
- Frontend statis berjalan di `http://localhost:3000` via Nginx Alpine.

## 3. Langkah Deploy ke Azure Web App (CLI)
```bash
# 1. Login & buat Resource Group (sesuaikan dengan resource group departemen)
az login
az group create --name rg-comfyair-dteti --location southeastasia

# 2. Buat App Service Plan Linux
az appservice plan create --name plan-comfyair --resource-group rg-comfyair-dteti --is-linux --sku B1

# 3. Deploy Backend FastAPI
az webapp create --resource-group rg-comfyair-dteti --plan plan-comfyair \
  --name comfyair-api --deployment-container-image-name comfyair-backend:latest

az webapp config appsettings set --resource-group rg-comfyair-dteti --name comfyair-api --settings \
  ENVIRONMENT=production \
  JWT_SECRET="<random-secret>" \
  CORS_ORIGINS="https://comfyair-web.azurewebsites.net" \
  SUPABASE_URL="<supabase-url>" \
  SUPABASE_KEY="<supabase-service-or-anon-key>"

# 4. Deploy Frontend Next.js (di-build dengan NEXT_PUBLIC_API_URL mengarah ke comfyair-api)
az webapp create --resource-group rg-comfyair-dteti --plan plan-comfyair \
  --name comfyair-web --deployment-container-image-name comfyair-frontend:latest
```

Tersedia pula alur CI/CD pada [.github/workflows/deploy-azure.yml](../.github/workflows/deploy-azure.yml) yang dapat dijalankan manual melalui tab **GitHub Actions** setelah mengisi *secrets* `AZURE_CREDENTIALS` serta profil *publish* Azure.
