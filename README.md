# GAPSS (GeoAI Spasial) - Project Magang

GAPSS (GeoAI Spasial) adalah platform Sistem Informasi Geografis (GIS) terintegrasi yang menggabungkan teknologi Artificial Intelligence (AI), analisis spasial, dan visualisasi geospasial dalam satu ekosistem aplikasi modern.

Platform ini dikembangkan menggunakan:

- **Django** sebagai Backend API
- **Next.js** sebagai Frontend Interface
- **PostgreSQL** sebagai database relasional
- **MongoDB (NoSQL)** untuk penyimpanan data fleksibel dan analisis spasial

GAPSS dirancang untuk mendukung pengolahan, visualisasi, analisis, dan pengelolaan data geospasial secara efisien dan interaktif.

---

# Persyaratan Sistem (Prerequisites)

Sebelum memulai, pastikan perangkat lokal sudah terinstall software berikut:

- **Python** `3.12.x` (Minimal `3.10+`)
- **Node.js** `18.x` atau lebih baru (Disarankan versi LTS)
- **Docker & Docker Compose** versi terbaru
- **pip** untuk Python Package Manager
- **npm** untuk Node.js Package Manager

---

# Panduan Instalasi (Getting Started)

Ikuti langkah-langkah berikut untuk menjalankan project GAPSS secara lokal.

---

## 1. Setup Database (Docker)

Jalankan PostgreSQL dan MongoDB menggunakan Docker Compose.

Buka terminal pada folder root project `GAPSS/` lalu jalankan:

```bash
# Menjalankan database di background
docker-compose up -d
```

---

## 2. Setup Backend (Django)

Buka terminal baru lalu masuk ke folder root project `GAPSS/`.

### Membuat Virtual Environment

```bash
python -m venv venv
```

### Aktivasi Virtual Environment

#### Windows
```bash
.\venv\Scripts\activate
```

#### Linux / MacOS
```bash
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Menjalankan Backend

```bash
# Masuk ke folder backend
cd backend

# Migrasi database
python manage.py migrate

# Menjalankan script migrasi tambahan
python core/scripts/migrate_all.py

# Menjalankan server backend
python manage.py runserver
```

---

## 3. Setup Frontend (Next.js)

Buka terminal baru lalu jalankan frontend aplikasi.

```bash
# Masuk ke folder frontend
cd frontend

# Install dependencies
npm install

# Menjalankan frontend development server
npm run dev
```

---

# Struktur Teknologi

| Layer | Teknologi |
|---|---|
| Frontend | Next.js |
| Backend | Django |
| Database Relasional | PostgreSQL |
| Database NoSQL | MongoDB |
| Containerization | Docker |

---

# Catatan Penting

- Pastikan file `.env` sudah dibuat dari `.env.example`
- Sesuaikan konfigurasi database pada folder `backend/`
- Jalankan Docker terlebih dahulu sebelum backend dijalankan

---

# Akses Layanan

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://127.0.0.1:8000` |

---

# Default Port

| Service | Port |
|---|---|
| PostgreSQL | `5432` |
| MongoDB | `27017` |

---

# Deskripsi Singkat

GAPSS (GeoAI Spasial) merupakan platform berbasis WebGIS yang berfokus pada integrasi teknologi geospasial dan kecerdasan buatan untuk mendukung analisis data wilayah, visualisasi peta interaktif, serta pengolahan data spasial secara modern dan scalable.

---
