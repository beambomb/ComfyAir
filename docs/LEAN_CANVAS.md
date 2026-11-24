# Lean Canvas & Analisis Kompetitor — ComfyAir

Dokumen ini disusun sesuai **Modul 1 Lab 1.2 & Lab 1.3** Praktikum Senior Project TI DTETI FT UGM.

## 1. Lembar Lean Canvas (9 Blok)

| Blok | Rincian ComfyAir |
| :--- | :--- |
| **1. Problem** | 1. Penyetelan suhu AC statis (`18°C–20°C`) sepanjang malam memicu pemborosan listrik rumah tangga hingga puluhan persen.<br>2. Penurunan suhu luar dan metabolisme tubuh saat tidur menyebabkan penghuni sering terbangun kedinginan.<br>3. *Smart thermostat* fisik membutuhkan biaya perangkat dan instalasi tinggi serta tidak kompatibel dengan semua unit AC lama. |
| **2. Customer Segments** | Pemilik/pengguna AC split rumah tangga di kota tropis Indonesia (mahasiswa kos, pekerja, keluarga muda) dengan tarif listrik PLN R-1 (`1.300–2.200 VA`) yang sensitif terhadap tagihan listrik dan kualitas tidur. *(Early Adopters: mahasiswa & penghuni kamar ber-AC di Yogyakarta).* |
| **3. Unique Value Proposition** | Optimasi suhu *setpoint* AC adaptif berbasis AI dan cuaca *real-time* langsung dari browser tanpa perangkat keras atau sensor tambahan. |
| **4. Solution** | 1. Prediksi *setpoint* AC optimal berbasis `GradientBoostingRegressor` menggunakan suhu luar, kelembapan, jam lokal, mode, *Heat Index*, dan kapasitas PK AC.<br>2. Perencana kurva suhu tidur biologis 3 fase (*Mulai tidur*, *Tidur nyenyak*, *Menjelang bangun*) yang sinkron dengan prakiraan cuaca malam.<br>3. Kalkulator & pencatat penghematan listrik (kWh dan Rupiah) dengan filter harian, mingguan, dan bulanan. |
| **5. Channels** | Aplikasi web responsif (desktop & mobile), showcase Azure DTETI FT UGM, repositori terbuka GitHub, dan komunitas pengguna rumah tangga hemat energi. |
| **6. Revenue Streams** | Model *Freemium SaaS*: fitur prediksi adaptif dan kalkulator dasar gratis; paket berlangganan (*subscription*) untuk pencatatan riwayat multi-ruangan, laporan penghematan bulanan, dan integrasi API pihak ketiga. |
| **7. Cost Structure** | Biaya *hosting* layanan API & frontend (Azure Web App / Container Apps), basis data *cloud* (Supabase PostgreSQL), riset/pemeliharaan model ML, serta *bandwidth* API cuaca. |
| **8. Key Metrics** | - **Akurasi Model ML:** `Test R² >= 0,95`, `MAE <= 0,2°C`<br>- **Keandalan Jaringan:** Latensi API `< 100 ms`, *uptime* `>= 99%`<br>- **Keterlibatan Pengguna:** *Daily/Monthly Active Users* (DAU/MAU), jumlah sesi penyimpanan kurva tidur, dan rata-rata estimasi penghematan kWh per pengguna. |
| **9. Unfair Advantage** | Kombinasi model termal tropis Indonesia (*Heat Index* + ASHRAE 55 + kurva sirkadian tidur) yang berjalan tanpa ketergantungan perangkat keras khusus (*zero hardware lock-in*) dengan arsitektur *hybrid cloud-fallback* yang tetap berfungsi saat luring. |

---

## 2. Analisis Kompetitor

| Produk | Jenis | Keunggulan | Kelemahan | Posisi ComfyAir |
| :--- | :--- | :--- | :--- | :--- |
| **Google Nest / ecobee** | *Smart Thermostat* (Hardware) | Otomatisasi fisik langsung ke sistem HVAC sentral, sensor okupansi akurat | Harga perangkat mahal, instalasi kabel rumit, tidak cocok untuk AC *split* di Indonesia | Tanpa biaya perangkat keras, fokus pada AC *split* & iklim tropis Indonesia |
| **Sensibo / BroadLink** | *Smart IR Blaster* (Hardware) | Mengontrol remote AC lama via Wi-Fi dan aplikasi ponsel | Tetap memerlukan pembelian alat tambahan per unit AC dan kalibrasi IR | 100% berbasis perangkat lunak (*software-only*), siap dipakai instan |
| **Mode Eco / Sleep Bawaan Remote AC** | Fitur Kontrol Lokal Statis | Sudah tersedia di sebagian besar remote AC tanpa biaya tambahan | Tidak mempertimbangkan suhu & kelembapan luar *real-time* maupun estimasi biaya Rupiah | Adaptif terhadap cuaca luar *real-time* lintas kota dan transparan menghitung penghematan kWh/Rp |
