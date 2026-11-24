# ComfyAir

**Proyek Senior Project TI · Kelompok AB to Z · DTETI FT UGM**

Solusi web berbasis **Jaringan Komputer**, **Komputasi Awan**, dan **Kecerdasan Buatan** untuk merekomendasikan suhu *setpoint* AC secara dinamis berdasarkan cuaca luar *real-time*, mengkalibrasi preferensi kenyamanan pengguna melalui *feedback loop* ML, dan menghitung estimasi penghematan listrik tanpa perangkat keras tambahan.

---

## Anggota Kelompok & Pembagian Peran

| Nama | NIM | Peran | Tanggung Jawab Utama |
| :--- | :--- | :--- | :--- |
| **Arnold Gavrael Bonardo Situmorang** *(Ketua)* | `24/539797/TK/59872` | Project Manager (PM) & Software Engineer (SE) | Perencanaan proyek, arsitektur sistem, integrasi backend/frontend |
| **Zakhrova Salsabila** | `24/534625/TK/59268` | UI/UX Designer (UXD) & AI Engineer (AIE) | Antarmuka web 3 halaman, dataset termal, pelatihan & kalibrasi model ML |
| **Johannes De Deo Dimas Aryobimo** | `24/540351/TK/59948` | Cloud Engineer (CE) & Software Engineer (SE) | Skema basis data relasional, Docker, CI/CD, deployment Azure |

---

## Latar Belakang & Rumusan Masalah

Di wilayah tropis Indonesia, pengguna AC rumah tangga umumnya menyetel suhu konstan terlalu rendah (`18°C–20°C`). Akibatnya:
1. **Pemborosan energi listrik:** Setiap penurunan *setpoint* `1°C` di bawah kondisi nyaman meningkatkan beban kerja kompresor sekitar `6%–8%`, berdampak langsung pada tagihan listrik rumah tangga PLN golongan R-1 (`Rp1.444,70/kWh`).
2. **Ketidaknyamanan termal:** Pengaturan suhu AC manual tidak memperhitungkan kombinasi suhu luar, kelembapan tinggi (*heat index*), jam lokal, dan preferensi individu pengguna.
3. **Biaya perangkat keras *smart thermostat*:** Produk seperti Nest, ecobee, atau pengontrol IR pintar memerlukan perangkat tambahan berbiaya tinggi dan instalasi fisik.

**Solusi ComfyAir:** Aplikasi web SaaS 3 halaman (**Dasbor**, **Penghematan**, **Akun**) tanpa sensor tambahan yang menggabungkan data cuaca multi-kota via Open-Meteo API, model *machine learning* `GradientBoostingRegressor` berbasis *Heat Index* (NOAA) dan ASHRAE 55, kalibrasi preferensi adaptif (`Terlalu dingin` / `Pas` / `Terlalu panas`), serta pencatatan penghematan berbasis *cloud*.

---

## Tiga Pilar Teknologi

1. **Jaringan Komputer**
   - Komunikasi client-server berbasis **HTTP/REST** (FastAPI + JSON) dan **HTTPS** ke Open-Meteo Weather API dengan *in-memory TTL caching* (10 menit) serta pengukuran latensi *upstream*.
   - Kanal **WebSocket** (`WS /api/v1/ws/telemetry`) untuk sinkronisasi telemetri prediksi dan umpan balik secara *real-time*.
   - Middleware observabilitas `X-Process-Time-Ms`, inspeksi header `X-Forwarded-For` untuk identifikasi IP klien, serta konfigurasi CORS terukur.
2. **Komputasi Awan**
   - Penyimpanan data terpusat pada **Supabase PostgreSQL** (9 tabel relasional pada [schema.sql](backend/schema.sql)) dengan *fallback* **SQLite lokal** otomatis saat mode luring.
   - Kontainerisasi penuh (`backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`) siap *deploy* pada **Microsoft Azure Web App / Container Apps** milik DTETI FT UGM serta CI/CD GitHub Actions.
3. **Kecerdasan Buatan**
   - Pipeline pelatihan [train_model.py](backend/ml/train_model.py) dengan dataset 2.400 sampel kondisi tropis Indonesia (`dataset.csv`), *feature engineering* `heat_index_c` ([thermal.py](backend/app/services/thermal.py)), dan *5-fold cross-validation*.
   - Pemilihan otomatis model terbaik: **`GradientBoostingRegressor`** (`CV R² = 0,972`, `Test R² = 0,974`, `MAE = 0,146°C`, `RMSE = 0,203°C`) mengungguli `RandomForestRegressor`, `Ridge`, dan `LinearRegression`.
   - **Kalibrasi Adaptif Personal:** Umpan balik kenyamanan pengguna disimpan ke tabel `comfort_feedback` dan secara langsung mengkalibrasi prediksi model ML berikutnya.

---

## Matriks Keterlacakan Kebutuhan Fungsional (`FR 1`–`FR 9`)

| Kode | Kebutuhan Fungsional | Endpoint Backend | Halaman Frontend |
| :--- | :--- | :--- | :--- |
| **FR 1** | Autentikasi & manajemen akun pengguna | `POST /api/v1/auth/register`, `login`, `refresh`, `logout`, `GET /me` | `/akun` |
| **FR 2** | Pengelolaan profil AC (PK), tarif listrik, & kota | `GET / PUT /api/v1/preferences` | `/penghematan`, `/akun` |
| **FR 3** | Ringkasan status & kontrol utama AC | `POST /api/v1/predict` | `/` (Dasbor) |
| **FR 4** | Dasbor interaktif cuaca *real-time* multi-kota | `GET /api/v1/weather`, `GET /api/v1/weather/cities` | `/` (Dasbor) |
| **FR 5** | Tampilan hasil rekomendasi suhu otomatis ML | `POST /api/v1/predict`, `GET /api/v1/model/info` | `/` (Dasbor), `/akun` |
| **FR 6** | Kalibrasi ML adaptif via umpan balik kenyamanan | `POST / GET / DELETE /api/v1/feedback` | `/` (Dasbor), `/akun` |
| **FR 7** | Kalkulasi rekomendasi suhu optimal ML | `ml_service.predict_setpoint()` (`GradientBoostingRegressor`) | `/` (Dasbor) |
| **FR 8** | Filter periode waktu (Harian, Mingguan, Bulanan) | `GET /api/v1/savings/logs?period=daily\|weekly\|monthly` | `/penghematan` |
| **FR 9** | Kalkulasi & pencatatan penghematan kWh dan Rupiah | `POST / DELETE /api/v1/savings/logs` | `/penghematan` |

---

## Menjalankan Proyek Secara Lokal

### 1. Backend (FastAPI + scikit-learn)
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests -v
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```
Dokumentasi Swagger interaktif tersedia di `http://localhost:8000/docs`.

### 2. Frontend (Next.js)
```powershell
cd frontend
npm ci
npm run dev
```
Aplikasi web berjalan di `http://localhost:3000`.

### 3. Docker Compose (Full-Stack)
```powershell
docker compose up --build
```

---

## Dokumen Pendukung
- [Lean Canvas & Analisis Kompetitor](docs/LEAN_CANVAS.md)
- [Arsitektur Sistem, Jaringan, Cloud, & ML](docs/ARCHITECTURE.md)
- [Panduan Demo & Pengujian](docs/DEMO_GUIDE.md)
- [Panduan Deployment Azure](docs/AZURE_DEPLOYMENT.md)
- [Dokumentasi Perancangan SDLC](docs/index.md)
