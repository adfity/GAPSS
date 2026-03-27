import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv
 
# ─── Setup path ───────────────────────────────────────────────────────────────
 
base_dir    = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)
 
# ─── Koneksi MongoDB ──────────────────────────────────────────────────────────
 
def get_db():
    user    = os.getenv("DB_MONGO_USER")
    pw      = os.getenv("DB_MONGO_PASSWORD")
    host    = os.getenv("DB_MONGO_HOST", "localhost")
    port    = os.getenv("DB_MONGO_PORT", "27017")
    db_name = os.getenv("DB_MONGO_NAME")
 
    uri    = f"mongodb://{user}:{pw}@{host}:{port}/" if user and pw else f"mongodb://{host}:{port}/"
    client = MongoClient(uri)
    return client[db_name]
 
# ─── Mapping kategori berdasarkan nilai `amenity` OSM ────────────────────────
 
AMENITY_TO_CATEGORY = {
    "school":       "school",        # SD, SMP, SMA, SMK
    "kindergarten": "kindergarten",  # TK / PAUD
    "college":      "college",       # Politeknik, Akademi
    "university":   "university",    # Universitas, Institut
}
 
# Fallback: deteksi dari nama jika amenity tidak dikenali
NAME_KEYWORDS = {
    "university":   ["universitas", "institut", "uin", "itb", "ui ", "ugm", "unpad"],
    "college":      ["politeknik", "akademi", "stie", "stik", "stmik", "amik", "d3", "d4"],
    "kindergarten": ["tk ", "paud", "taman kanak", "playgroup", "ra "],
    "school":       ["sd ", "smp", "sma", "smk", "madrasah", "pesantren", "pondok"],
}
 
 
def detect_category(props: dict) -> str:
    """
    Tentukan kategori pendidikan dari properti OSM.
    Prioritas: amenity field → name keyword → default 'school'
    """
    amenity = str(props.get("amenity", "")).lower().strip()
    if amenity in AMENITY_TO_CATEGORY:
        return AMENITY_TO_CATEGORY[amenity]
 
    name = str(props.get("name", "")).lower()
    for cat, keywords in NAME_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return cat
 
    return "school"  # default
 
 
# ─── Main migrate ─────────────────────────────────────────────────────────────
 
def migrate_data():
    db = get_db()
 
    COLLECTION = "waypoint_pendidikan"
 
    # Path file GeoJSON
    data_dir  = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
    ))
    file_path = os.path.join(data_dir, "pendidikan.geojson")
 
    print("─" * 60)
    print("  MIGRASI DATA PENDIDIKAN → MongoDB")
    print("─" * 60)
    print(f"  Koleksi  : {COLLECTION}")
    print(f"  File     : {file_path}")
    print("─" * 60)
 
    # Validasi file
    if not os.path.exists(file_path):
        print(f"\n❌ File tidak ditemukan:\n   {file_path}")
        print("\n   Pastikan file pendidikan.geojson sudah ada di folder:")
        print(f"   {data_dir}")
        return
 
    # Baca GeoJSON
    print("\n⏳ Membaca file GeoJSON ...")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
 
    features = data.get('features', [])
    if not features:
        print("⚠️  File GeoJSON tidak memiliki features. Proses dibatalkan.")
        return
 
    print(f"✅ Ditemukan {len(features):,} features\n")
 
    # Hapus data lama
    deleted = db[COLLECTION].delete_many({})
    print(f"🗑️  Data lama dihapus: {deleted.deleted_count:,} dokumen\n")
 
    # Proses & enrichment
    print("⏳ Memproses dan mendeteksi kategori ...")
    enriched        = []
    category_counts = {}
 
    for feature in features:
        props = feature.get("properties") or {}
 
        # Tambah/override kategori
        category           = detect_category(props)
        props["category"]  = category
 
        # Tambah field bantu untuk frontend
        props["type_label"] = {
            "school":       "Sekolah (SD/SMP/SMA/SMK)",
            "kindergarten": "TK / PAUD",
            "college":      "Politeknik / Akademi",
            "university":   "Universitas / Institut",
        }.get(category, "Lembaga Pendidikan")
 
        feature["properties"] = props
        enriched.append(feature)
 
        category_counts[category] = category_counts.get(category, 0) + 1
 
    # Insert ke MongoDB
    print("⏳ Mengupload ke MongoDB ...")
    db[COLLECTION].insert_many(enriched)
    print(f"✅ BERHASIL: {len(enriched):,} dokumen masuk ke koleksi '{COLLECTION}'\n")
 
    # Rincian per kategori
    print("   Rincian kategori:")
    labels = {
        "school":       "Sekolah (SD/SMP/SMA/SMK)",
        "kindergarten": "TK / PAUD",
        "college":      "Politeknik / Akademi",
        "university":   "Universitas / Institut",
    }
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"     • {labels.get(cat, cat):<32} : {count:,}")
 
    # Buat index
    print("\n⏳ Membuat index ...")
    db[COLLECTION].create_index([("geometry", "2dsphere")])
    db[COLLECTION].create_index([("properties.category", 1)])
    db[COLLECTION].create_index([("properties.name", 1)])
    print("✅ Index '2dsphere', 'properties.category', 'properties.name' berhasil dibuat")
 
    print("\n" + "─" * 60)
    print("  SELESAI — Cek MongoDB Compass Anda")
    print("─" * 60)
 
 
if __name__ == "__main__":
    migrate_data()