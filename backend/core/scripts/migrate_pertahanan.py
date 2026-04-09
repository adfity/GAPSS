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

# Prioritas 1: military tag (nilai utama dari dataset pertahanan)
MILITARY_TO_CATEGORY = {
    "base":              "base",
    "barracks":          "barracks",
    "checkpoint":        "checkpoint",
    "office":            "military_office",
    "training_area":     "training_area",
    "airfield":          "airfield",
    "naval_base":        "naval_base",
    "bunker":            "bunker",
    "obstacle":          "checkpoint",
    "range":             "training_area",
    "danger_area":       "training_area",
    "ammunition":        "ammunition",
    "guard_post":        "checkpoint",
    "trench":            "checkpoint",
    "launchpad":         "base",
}

# Prioritas 2: military_service (cabang militer)
MILITARY_SERVICE_TO_BRANCH = {
    "army":         "TNI AD",
    "navy":         "TNI AL",
    "air_force":    "TNI AU",
    "marines":      "TNI AL",
    "coast_guard":  "TNI AL",
    "police":       "Kepolisian",
}

# Prioritas 3: keyword pada nama
NAME_KEYWORDS = {
    "base":          ["markas besar", "mabes", "markas", "pangkalan", "komando", "korem",
                      "kodam", "kopassus", "kostrad", "lanud", "lanal", "lauda"],
    "barracks":      ["batalyon", "yonif", "yonkav", "yonarmed", "yonzipur", "yonkes",
                      "kodim", "koramil", "korem", "batalion", "detasemen", "den"],
    "checkpoint":    ["pos", "pos jaga", "pos pemeriksaan", "penjagaan", "portal"],
    "military_office":["kantor", "markas", "staf", "headquarters"],
    "training_area": ["latihan", "pusdiklat", "dodik", "pendidikan", "training"],
    "naval_base":    ["angkatan laut", "ksatrian", "lanal", "komando armada"],
    "airfield":      ["lanud", "pangkalan udara", "apron", "angkatan udara"],
}

TYPE_LABELS = {
    "base":            "Markas / Pangkalan Militer",
    "barracks":        "Batalyon / Asrama Militer",
    "checkpoint":      "Pos Pemeriksaan / Penjagaan",
    "military_office": "Kantor / Staf Militer",
    "training_area":   "Area Latihan Militer",
    "airfield":        "Pangkalan Udara (TNI AU)",
    "naval_base":      "Pangkalan Laut (TNI AL)",
    "bunker":          "Bunker / Benteng",
    "ammunition":      "Gudang Amunisi",
}

BRANCH_LABELS = {
    "army":      "TNI AD",
    "navy":      "TNI AL",
    "air_force": "TNI AU",
    "marines":   "TNI AL",
}


def detect_category(props: dict) -> str:
    """
    Tentukan kategori pertahanan / militer dari properti OSM.
    Prioritas: military tag → name keyword → landuse → default 'base'
    """
    military      = str(props.get("military",      "")).lower().strip()
    landuse       = str(props.get("landuse",       "")).lower().strip()
    name          = str(props.get("name",          "")).lower()
    alt_name      = str(props.get("alt_name",      "")).lower()
    combined_name = f"{name} {alt_name}"

    if military in MILITARY_TO_CATEGORY:
        return MILITARY_TO_CATEGORY[military]

    for cat, keywords in NAME_KEYWORDS.items():
        if any(kw in combined_name for kw in keywords):
            return cat

    if landuse == "military":
        return "base"

    return "base"  # default


def detect_branch(props: dict) -> str | None:
    """
    Tentukan cabang militer (AD/AL/AU) jika bisa dideteksi.
    """
    military_service = str(props.get("military_service", "")).lower().strip()
    name             = str(props.get("name",             "")).lower()
    alt_name         = str(props.get("alt_name",         "")).lower()
    combined         = f"{name} {alt_name}"

    if military_service in MILITARY_SERVICE_TO_BRANCH:
        return MILITARY_SERVICE_TO_BRANCH[military_service]

    if any(kw in combined for kw in ["angkatan darat", " ad ", "yonif", "kodam", "kodim",
                                      "koramil", "korem", "kostrad", "kopassus"]):
        return "TNI AD"
    if any(kw in combined for kw in ["angkatan laut", " al ", "lanal", "koarmada",
                                      "marinir", "al "]):
        return "TNI AL"
    if any(kw in combined for kw in ["angkatan udara", " au ", "lanud", "koopsud",
                                      "paskhas"]):
        return "TNI AU"

    return None


# ─── Main migrate ─────────────────────────────────────────────────────────────

def migrate_data():
    db = get_db()

    COLLECTION = "waypoint_pertahanan"

    data_dir  = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
    ))
    file_path = os.path.join(data_dir, "pertahanan.geojson")

    print("─" * 60)
    print("  MIGRASI DATA PERTAHANAN / MILITER → MongoDB")
    print("─" * 60)
    print(f"  Koleksi  : {COLLECTION}")
    print(f"  File     : {file_path}")
    print("─" * 60)

    if not os.path.exists(file_path):
        print(f"\n❌ File tidak ditemukan:\n   {file_path}")
        print(f"\n   Pastikan pertahanan.geojson ada di:\n   {data_dir}")
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
        branch                = detect_branch(props)

        props["category"]     = category
        props["type_label"]   = TYPE_LABELS.get(category, "Fasilitas Militer / Pertahanan")
        if branch:
            props["branch"]   = branch

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
    db[COLLECTION].create_index([("properties.branch", 1)])
    print("✅ Index '2dsphere', 'properties.category', 'properties.name', 'properties.branch' berhasil dibuat")

    print("\n" + "─" * 60)
    print("  SELESAI — Cek MongoDB Compass Anda")
    print("─" * 60)


if __name__ == "__main__":
    migrate_data()