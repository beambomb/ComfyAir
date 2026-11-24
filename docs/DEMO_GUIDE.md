# Panduan Demo Produk — ComfyAir

Panduan langkah demi langkah untuk menjalankan dan mendemonstrasikan seluruh fitur ComfyAir saat presentasi akhir Senior Project TI.

## Kredensial Akun Demo
- **Email:** `demo@comfyair.id`
- **Kata Sandi:** `comfyair123`

*(Akun ini otomatis tersedia pada basis data lokal maupun saat pendaftaran akun baru melalui halaman `/akun`.)*

---

## Persiapan Sebelum Demo

1. Jalankan backend FastAPI di terminal pertama:
   ```powershell
   cd backend
   .\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```
2. Jalankan frontend Next.js di terminal kedua:
   ```powershell
   cd frontend
   npm run dev
   ```
3. Pastikan kedua URL berikut merespons:
   - Aplikasi Web: `http://localhost:3000/`
   - Swagger API Docs: `http://localhost:8000/docs`

---

## Alur Demo Langsung (5 Menit)

### 1. Halaman Dasbor (`/`) — Pilar AI & Jaringan
1. Tunjukkan angka **Setpoint** hasil prediksi model ML (`GradientBoostingRegressor`) beserta baris info `Indeks panas ...°C`.
2. Ganti kota pada pemilih **Cuaca** (misal `Yogyakarta` -> `Jakarta`) dan perhatikan data suhu/kelembapan diambil dari endpoint server `/api/v1/weather` dan langsung memperbarui prediksi ML.
3. Ubah mode (`Hemat`, `Tidur`, `Nyaman`) atau geser tombol `−` / `+` pada suhu & kelembapan untuk memperlihatkan perubahan *setpoint* secara adaptif, lalu tekan `Reset` untuk kembali ke cuaca *live*.

### 2. Halaman Grafik (`/grafik`) — Kurva Suhu Tidur Biologis (FR 6)
1. Tunjukkan grafik perbandingan kurva prakiraan suhu luar malam (`21.00–07.00 WIB`) dengan target bertingkat ComfyAir (`Mulai tidur`, `Tidur nyenyak`, `Menjelang bangun`).
2. Ubah konfigurasi **Profil Tidur** (misal jam tidur `23:00`, jam bangun `06:00`, suhu awal `23°C`) dan amati grafik serta rincian fase berubah langsung.

### 3. Halaman Penghematan (`/penghematan`) — Filter Periode & Pencatatan Cloud (FR 8 & FR 9)
1. Uji filter periode **Harian**, **Mingguan**, dan **Bulanan** untuk melihat perubahan biaya baseline `20°C` vs biaya *setpoint* optimal.
2. Ubah **Daya AC** (`1,5 PK`) dan **Tarif listrik**, lalu perhatikan perhitungan kWh dasar dan penghematan Rupiah berubah real-time.

### 4. Halaman Akun & Diagnostik Sistem (`/akun`) — Pilar Cloud & Autentikasi (FR 1 & FR 2)
1. Klik **Gunakan akun demo** lalu masuk sebagai `demo@comfyair.id`.
2. Tunjukkan panel **Informasi Sistem** yang membaca langsung dari `/api/v1/health`, `/api/v1/model/info`, dan `WS /api/v1/ws/telemetry`:
   - Status API & WebSocket **Aktif**
   - IP Klien & *Backend* penyimpanan (`Supabase PostgreSQL` / `SQLite Lokal`)
   - Tabel perbandingan 4 algoritma ML (`GradientBoostingRegressor` R² `0,974`)
3. Kembali ke `/penghematan` dan tekan **Catat penghematan** untuk menyimpan log ke tabel `energy_saving_logs`, lalu buktikan data muncul pada **Riwayat Penghematan** dan bertahan setelah *refresh* browser.
