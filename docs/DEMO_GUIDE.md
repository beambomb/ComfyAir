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

## Alur Demo Langsung (4 Menit)

### 1. Halaman Dasbor (`/`) — Pilar AI, Kalibrasi, & Jaringan
1. Tunjukkan angka **Setpoint** hasil prediksi model ML (`GradientBoostingRegressor`) beserta baris info `Indeks panas ...°C`.
2. Ganti kota pada pemilih **Cuaca** (misal `Yogyakarta` -> `Jakarta`) dan perhatikan data suhu/kelembapan diambil dari endpoint server `/api/v1/weather` dan langsung memperbarui prediksi ML.
3. Ubah mode (`Hemat`, `Tidur`, `Nyaman`) atau geser tombol `−` / `+` pada suhu & kelembapan untuk memperlihatkan perubahan *setpoint* secara adaptif, lalu tekan `Reset` untuk kembali ke cuaca *live*.
4. Klik tombol umpan balik **Terlalu dingin** / **Pas** / **Terlalu panas** untuk menunjukkan bagaimana ComfyAir menyimpan preferensi pengguna dan menampilkan penyesuaian `kalibrasi +...°C` langsung pada rekomendasi ML, lalu tekan **Reset kalibrasi** bila ingin mengembalikan ke setelan dasar.

### 2. Halaman Penghematan (`/penghematan`) — Filter Periode & Pencatatan Cloud (FR 8 & FR 9)
1. Uji filter periode **Harian**, **Mingguan**, dan **Bulanan** untuk melihat perubahan biaya baseline `20°C` vs biaya *setpoint* optimal.
2. Ubah **Daya AC** (`1,5 PK`), **Tarif listrik**, dan **Jam / malam**, lalu perhatikan perhitungan kWh dasar dan penghematan Rupiah berubah real-time.

### 3. Halaman Akun & Diagnostik Sistem (`/akun`) — Pilar Cloud & Autentikasi (FR 1 & FR 2)
1. Klik **Gunakan akun demo** lalu masuk sebagai `demo@comfyair.id`.
2. Tunjukkan panel **Informasi Sistem** yang membaca langsung dari `/api/v1/health`, `/api/v1/model/info`, `/api/v1/feedback`, dan `WS /api/v1/ws/telemetry`:
   - Status API & WebSocket **Aktif**
   - IP Klien & *Backend* penyimpanan (`Supabase PostgreSQL` / `SQLite Lokal`)
   - Kalibrasi ML personal & tabel perbandingan 4 algoritma ML (`GradientBoostingRegressor` R² `0,974`)
3. Kembali ke `/penghematan` dan tekan **Catat penghematan** untuk menyimpan log ke tabel `energy_saving_logs`, lalu buktikan data muncul pada **Riwayat Penghematan** dan bertahan setelah *refresh* browser.
