# Lean Canvas & Analisis Kompetitor — ComfyAir

Dokumen ini disusun sesuai **Modul 1 Lab 1.2 & Lab 1.3** Praktikum Senior Project TI DTETI FT UGM.

## 1. Lembar Lean Canvas (9 Blok)

| Blok | Rincian ComfyAir |
| :--- | :--- |
| **1. Problem** | 1. Penyetelan suhu AC statis terlalu dingin (`18°C–20°C`) memicu pemborosan listrik rumah tangga.<br>2. Penyetelan manual tidak memperhitungkan kombinasi suhu luar, kelembapan tinggi (*heat index*), dan preferensi individu pengguna.<br>3. *Smart thermostat* fisik membutuhkan biaya perangkat dan instalasi tinggi serta tidak kompatibel dengan semua unit AC lama. |
| **2. Customer Segments** | Pemilik/pengguna AC split rumah tangga di kota tropis Indonesia (mahasiswa kos, pekerja, keluarga muda) dengan tarif listrik PLN R-1 (`1.300–2.200 VA`) yang sensitif terhadap tagihan listrik dan kenyamanan ruangan. *(Early Adopters: mahasiswa & penghuni kamar ber-AC di Yogyakarta).* |
| **3. Unique Value Proposition** | Rekomendasi suhu *setpoint* AC adaptif berbasis Machine Learning dan cuaca *real-time* yang terus belajar dari umpan balik pengguna langsung di browser tanpa perangkat keras tambahan. |
| **4. Solution** | 1. Prediksi *setpoint* AC optimal berbasis `GradientBoostingRegressor` menggunakan suhu luar, kelembapan, jam lokal, mode, *Heat Index*, dan kapasitas PK AC.<br>2. Kalibrasi adaptif via tombol umpan balik (*Terlalu dingin / Pas / Terlalu panas*) yang tersimpan di basis data untuk menyesuaikan preferensi tiap pengguna.<br>3. Kalkulator & pencatat penghematan listrik (kWh dan Rupiah) dengan filter harian, mingguan, dan bulanan. |
| **5. Channels** | Aplikasi web 3 halaman yang ringan dan responsif (desktop & mobile), showcase Azure DTETI FT UGM, repositori terbuka GitHub, dan komunitas pengguna rumah tangga hemat energi. |
| **6. Revenue Streams** | Model *Freemium SaaS*: fitur prediksi ML dan kalkulator dasar gratis; paket berlangganan (*subscription*) untuk pencatatan riwayat multi-ruangan, laporan penghematan bulanan, dan integrasi API pihak ketiga. |
| **7. Cost Structure** | Biaya *hosting* layanan API & frontend (Azure Web App / Container Apps), basis data *cloud* (Supabase PostgreSQL), riset/pemeliharaan model ML, serta *bandwidth* API cuaca. |
| **8. Key Metrics** | - **Akurasi Model ML:** `Test R² >= 0,95`, `MAE <= 0,2°C`<br>- **Keandalan Jaringan:** Latensi API `< 100 ms`, *uptime* `>= 99%`<br>- **Keterlibatan Pengguna:** *Daily/Monthly Active Users* (DAU/MAU), jumlah umpan balik kalibrasi ML, dan rata-rata estimasi penghematan kWh per pengguna. |
| **9. Unfair Advantage** | Kombinasi model termal tropis Indonesia (*Heat Index* + ASHRAE 55 + kalibrasi preferensi personal) yang berjalan tanpa ketergantungan perangkat keras khusus (*zero hardware lock-in*) dengan arsitektur *hybrid cloud-fallback*. |

---

## 2. Analisis Kompetitor

| Produk | Jenis | Keunggulan | Kelemahan | Posisi ComfyAir |
| :--- | :--- | :--- | :--- | :--- |
| **Google Nest / ecobee** | *Smart Thermostat* (Hardware) | Otomatisasi fisik langsung ke sistem HVAC sentral, sensor okupansi akurat | Harga perangkat mahal, instalasi kabel rumit, tidak cocok untuk AC *split* di Indonesia | Tanpa biaya perangkat keras, fokus pada AC *split* & iklim tropis Indonesia |
| **Sensibo / BroadLink** | *Smart IR Blaster* (Hardware) | Mengontrol remote AC lama via Wi-Fi dan aplikasi ponsel | Tetap memerlukan pembelian alat tambahan per unit AC dan kalibrasi IR | 100% berbasis perangkat lunak (*software-only*), siap dipakai instan |
| **Mode Eco Bawaan Remote AC** | Fitur Kontrol Lokal Statis | Sudah tersedia di sebagian besar remote AC tanpa biaya tambahan | Tidak mempertimbangkan suhu & kelembapan luar *real-time*, kalibrasi personal, maupun estimasi biaya Rupiah | Adaptif terhadap cuaca luar *real-time* lintas kota, memiliki kalibrasi ML personal, dan transparan menghitung penghematan kWh/Rp |
