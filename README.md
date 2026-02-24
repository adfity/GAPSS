# TerraSeg - Project Magang

TerraSeg adalah platform Sistem Informasi Geografis (GIS) terintegrasi yang menggunakan Django (Backend), Next.js (Frontend), serta dukungan database PostgreSQL dan NoSQL.

---

## Persyaratan Sistem (Prerequisites)

Sebelum memulai, pastikan mesin lokal kamu sudah terinstall software dengan versi berikut:

* **Python**: `3.12.x` (Minimal `3.10`+)
* **Node.js**: `18.x` atau lebih baru (Rekomendasi versi LTS)
* **Docker & Docker Compose**: Versi terbaru (Untuk menjalankan database)
* **Package Manager**: `pip` (Python) dan `npm` (Node.js)

---

## Panduan Instalasi (Getting Started)

Ikuti langkah-langkah di bawah ini secara berurutan untuk menjalankan proyek:

### 1. Setup Database (Docker)
Jalankan perintah ini di dalam folder utama (root) `TerraSeg/` untuk menyalakan PostgreSQL dan MongoDB:
```bash
# Menjalankan database di latar belakang
docker-compose up -d

```

### 2. Setup Backend (Django)

Buka terminal baru, masuk ke folder utama (root) `TerraSeg/`, dan siapkan environment:

```bash
# Membuat Virtual Environment
python -m venv venv

# Aktivasi Virtual Environment (Windows)
.\venv\Scripts\activate

# Install semua library yang dibutuhkan
pip install -r requirements.txt

# Masuk ke folder backend
cd backend

# Migrasi database dan jalankan server
python manage.py migrate
python manage.py runserver

```

### 3. Setup Frontend (Next.js)

Buka terminal satu lagi, masuk ke folder frontend, dan jalankan interface web:

```bash
# Masuk ke folder frontend
cd frontend

# Install dependensi Node.js
npm install

# Jalankan server development
npm run dev

```

---

## Catatan Penting

* **Environment**: Pastikan sudah menyalin `.env.example` menjadi `.env` di dalam folder `backend/` dan sesuaikan kredensial database sebelum menjalankan server.
* **Akses Layanan**:
* **Frontend**: `http://localhost:3000`
* **Backend (API)**: `http://127.0.0.1:8000`


* **Default Ports**:
* **PostgreSQL**: `5432`
* **MongoDB**: `27017`



---
