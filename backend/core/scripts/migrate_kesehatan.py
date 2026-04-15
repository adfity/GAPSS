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

# ─── Mapping kategori dari nilai OSM ─────────────────────────────────────────

AMENITY_TO_CATEGORY = {
    "hospital":    "hospital",
    "clinic":      "clinic",
    "health_post": "health_post",
    "pharmacy":    "pharmacy",
    "doctors":     "clinic",
}

HEALTHCARE_TO_CATEGORY = {
    "hospital":    "hospital",
    "clinic":      "clinic",
    "centre":      "clinic",
    "dialysis":    "hospital",
    "doctor":      "clinic",
    "midwife":     "clinic",
    "dentist":     "clinic",
    "laboratory":  "clinic",
    "birthing_centre":  "clinic",
    "birthing_center":  "clinic",
    "vaccination_centre": "clinic",
    "blood_donation":     "clinic",
    "Puskesmas":          "clinic",
}

# Fallback: deteksi dari nama
NAME_KEYWORDS = {
    "hospital":   ["rumah sakit", "rs ", "rsu ", "rsud", "rsia", "rsup", "rskb",
                   "hospital", "klinik utama"],
    "clinic":     ["puskesmas", "klinik", "poliklinik", "balai pengobatan",
                   "praktek", "praktek dokter", "dokter", "bidan"],
    "health_post":["posyandu", "pos kesehatan", "polindes", "poskesdes",
                   "pos bidan", "pustu"],
    "pharmacy":   ["apotek", "apotik", "farmasi", "pharmacy"],
}

TYPE_LABELS = {
    "hospital":    "Rumah Sakit",
    "clinic":      "Klinik / Puskesmas",
    "health_post": "Pos Kesehatan / Posyandu",
    "pharmacy":    "Apotek / Farmasi",
}


def detect_category(props: dict) -> str:
    """
    Tentukan kategori kesehatan dari properti OSM.
    Prioritas: amenity → healthcare → name keyword → default 'clinic'
    """
    amenity    = str(props.get("amenity",    "")).lower().strip()
    healthcare = str(props.get("healthcare", "")).strip()

    if amenity in AMENITY_TO_CATEGORY:
        return AMENITY_TO_CATEGORY[amenity]

    if healthcare in HEALTHCARE_TO_CATEGORY:
        return HEALTHCARE_TO_CATEGORY[healthcare]

    # Cek apakah healthcare mengandung kata kunci (multi-value pakai ';')
    for hc_val, cat in HEALTHCARE_TO_CATEGORY.items():
        if hc_val.lower() in healthcare.lower():
            return cat

    name = str(props.get("name", "")).lower()
    for cat, keywords in NAME_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return cat

    return "clinic"  # default


# ─── Main migrate ─────────────────────────────────────────────────────────────

def migrate_data():
    db = get_db()

    COLLECTION = "waypoint_kesehatan"

    data_dir  = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
    ))
    file_path = os.path.join(data_dir, "kesehatan.geojson")

    print("─" * 60)
    print("  MIGRASI DATA KESEHATAN → MongoDB")
    print("─" * 60)
    print(f"  Koleksi  : {COLLECTION}")
    print(f"  File     : {file_path}")
    print("─" * 60)

    if not os.path.exists(file_path):
        print(f"\n❌ File tidak ditemukan:\n   {file_path}")
        print(f"\n   Pastikan kesehatan.geojson ada di:\n   {data_dir}")
        return

    print("\n⏳ Membaca file GeoJSON ...")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    features = data.get('features', [])
    if not features:
        print("⚠️  File GeoJSON tidak memiliki features. Proses dibatalkan.")
        return

    print(f"✅ Ditemukan {len(features):,} features\n")

    deleted = db[COLLECTION].delete_many({})
    print(f"🗑️  Data lama dihapus: {deleted.deleted_count:,} dokumen\n")

    print("⏳ Memproses dan mendeteksi kategori ...")
    enriched        = []
    category_counts = {}

    for feature in features:
        props = feature.get("properties") or {}

        category              = detect_category(props)
        props["category"]     = category
        props["type_label"]   = TYPE_LABELS.get(category, "Fasilitas Kesehatan")

        feature["properties"] = props
        enriched.append(feature)
        category_counts[category] = category_counts.get(category, 0) + 1

    print("⏳ Mengupload ke MongoDB ...")
    db[COLLECTION].insert_many(enriched)
    print(f"✅ BERHASIL: {len(enriched):,} dokumen masuk ke koleksi '{COLLECTION}'\n")

    print("   Rincian kategori:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"     • {TYPE_LABELS.get(cat, cat):<35} : {count:,}")

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