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

# Prioritas 1: amenity
AMENITY_TO_CATEGORY = {
    "community_centre": "community_centre",
    "social_facility":  "social_facility",
    "canteen":          "canteen",
    "restaurant":       "restaurant",
    "fast_food":        "fast_food",
    "kitchen":          "kitchen",
    "school":           "school",
    "kindergarten":     "kindergarten",
    "food_court":       "food_court",
}

# Prioritas 2: community_centre tag
COMMUNITY_CENTRE_TO_CATEGORY = {
    "food":             "food_centre",
    "kitchen":          "kitchen",
    "nutrition":        "nutrition_centre",
    "social":           "social_facility",
}

# Prioritas 3: keyword pada nama
NAME_KEYWORDS = {
    "kitchen":          ["dapur", "dapur umum", "dapur makan", "cooking"],
    "food_centre":      ["makan bergizi", "mbg", "pusat makanan", "food centre"],
    "canteen":          ["kantin", "warung", "katering", "catering"],
    "nutrition_centre": ["gizi", "posyandu gizi", "kebun gizi", "nutrisi"],
    "social_facility":  ["sosial", "pusat komunitas", "balai", "community"],
    "school":           ["sekolah", "sd", "smp", "sma", "madrasah"],
}

TYPE_LABELS = {
    "community_centre": "Pusat Komunitas / MBG",
    "social_facility":  "Fasilitas Sosial",
    "canteen":          "Kantin / Warung",
    "restaurant":       "Restoran",
    "fast_food":        "Makanan Cepat Saji",
    "kitchen":          "Dapur Umum",
    "food_centre":      "Pusat Makan Bergizi",
    "nutrition_centre": "Pusat Gizi / Kebun Gizi",
    "food_court":       "Food Court",
    "school":           "Sekolah (Titik MBG)",
    "kindergarten":     "TK / PAUD (Titik MBG)",
}


def detect_category(props: dict) -> str:
    """
    Tentukan kategori MBG (Makan Bergizi Gratis) dari properti OSM.
    Prioritas: amenity → community_centre → name keyword → default
    """
    amenity          = str(props.get("amenity",          "")).lower().strip()
    community_centre = str(props.get("community_centre", "")).lower().strip()
    name             = str(props.get("name",             "")).lower()
    name_hi          = str(props.get("name:hi",          "")).lower()
    combined_name    = f"{name} {name_hi}"

    if amenity in AMENITY_TO_CATEGORY:
        cat = AMENITY_TO_CATEGORY[amenity]
        # Refine community_centre berdasarkan sub-tag atau nama
        if cat == "community_centre":
            if community_centre in COMMUNITY_CENTRE_TO_CATEGORY:
                return COMMUNITY_CENTRE_TO_CATEGORY[community_centre]
            for cat2, keywords in NAME_KEYWORDS.items():
                if any(kw in combined_name for kw in keywords):
                    return cat2
        return cat

    for cat, keywords in NAME_KEYWORDS.items():
        if any(kw in combined_name for kw in keywords):
            return cat

    return "community_centre"  # default — MBG umumnya berbasis komunitas


# ─── Main migrate ─────────────────────────────────────────────────────────────

def migrate_data():
    db = get_db()

    COLLECTION = "waypoint_mbg"

    data_dir  = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
    ))
    file_path = os.path.join(data_dir, "mbg.geojson")

    print("─" * 60)
    print("  MIGRASI DATA MBG (MAKAN BERGIZI GRATIS) → MongoDB")
    print("─" * 60)
    print(f"  Koleksi  : {COLLECTION}")
    print(f"  File     : {file_path}")
    print("─" * 60)

    if not os.path.exists(file_path):
        print(f"\n❌ File tidak ditemukan:\n   {file_path}")
        print(f"\n   Pastikan mbg.geojson ada di:\n   {data_dir}")
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
        props["type_label"]   = TYPE_LABELS.get(category, "Titik MBG")

        feature["properties"] = props
        enriched.append(feature)
        category_counts[category] = category_counts.get(category, 0) + 1

    print("⏳ Mengupload ke MongoDB ...")
    db[COLLECTION].insert_many(enriched)
    print(f"✅ BERHASIL: {len(enriched):,} dokumen masuk ke koleksi '{COLLECTION}'\n")

    print("   Rincian kategori:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"     • {TYPE_LABELS.get(cat, cat):<45} : {count:,}")

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