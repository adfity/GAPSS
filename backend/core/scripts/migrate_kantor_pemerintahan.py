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
    "townhall":       "townhall",
    "police":         "police",
    "fire_station":   "fire_station",
    "courthouse":     "courthouse",
    "prison":         "prison",
    "post_office":    "post_office",
    "public_building":"government_office",
    "community_centre":"community_centre",
    "library":        "library",
}

# Prioritas 2: government tag
GOVERNMENT_TO_CATEGORY = {
    "administrative":  "government_office",
    "public_service":  "government_office",
    "yes":             "government_office",
    "register_office": "government_office",
    "office":          "government_office",
    "village_office":  "village_office",
    "government":      "government_office",
    "ministry":        "ministry",
    "tax":             "tax_office",
    "transportation":  "government_office",
    "customs":         "customs",
    "healthcare":      "government_office",
    "education":       "government_office",
    "environment":     "government_office",
    "agriculture":     "government_office",
    "social_services": "government_office",
    "local":           "government_office",
    "prosecutor":      "courthouse",
    "legislative":     "legislative",
    "immigration":     "immigration",
    "judicial":        "courthouse",
    "forestry":        "government_office",
    "finance":         "government_office",
    "police":          "police",
}

# Prioritas 3: townhall:type
TOWNHALL_TYPE_TO_CATEGORY = {
    "city":             "townhall",
    "town":             "townhall",
    "municipality":     "townhall",
    "municipal":        "townhall",
    "district":         "government_office",
    "village":          "village_office",
    "rt":               "village_office",
    "rw":               "village_office",
    "barangay":         "village_office",
    "government_office":"government_office",
}

# Prioritas 4: keyword pada nama
NAME_KEYWORDS = {
    "police":           ["polri", "polres", "polsek", "polda", "kepolisian", "kapolsek"],
    "fire_station":     ["pemadam kebakaran", "damkar", "fire station"],
    "courthouse":       ["pengadilan", "kejaksaan", "mahkamah"],
    "prison":           ["lapas", "lembaga pemasyarakatan", "rutan", "rumah tahanan"],
    "townhall":         ["balai kota", "walikota", "bupati", "gubernur", "kantor bupati",
                         "kantor walikota", "kantor gubernur"],
    "village_office":   ["kantor desa", "kantor kelurahan", "kelurahan", "balai desa",
                         "kantor camat", "kecamatan"],
    "ministry":         ["kementerian", "departemen", "dirjen", "direktorat jenderal"],
    "customs":          ["bea cukai", "imigrasi"],
    "immigration":      ["imigrasi", "kantor imigrasi"],
    "tax_office":       ["pajak", "kpp", "kantor pajak", "bprd", "bpkad"],
    "legislative":      ["dprd", "dpr", "mpr", "dpd"],
    "military":         ["tni", "kodam", "korem", "kodim", "koramil", "markas"],
    "government_office":["kantor pemerintah", "kantor dinas", "dinas", "badan",
                         "pusat pemerintahan", "gedung pemerintah", "kantor"],
}

TYPE_LABELS = {
    "townhall":         "Kantor Walikota / Bupati / Gubernur",
    "village_office":   "Kantor Desa / Kelurahan / Kecamatan",
    "government_office":"Kantor Pemerintahan",
    "ministry":         "Kementerian / Direktorat",
    "police":           "Kepolisian",
    "fire_station":     "Pemadam Kebakaran",
    "courthouse":       "Pengadilan / Kejaksaan",
    "prison":           "Lembaga Pemasyarakatan",
    "post_office":      "Kantor Pos",
    "customs":          "Bea Cukai",
    "immigration":      "Kantor Imigrasi",
    "tax_office":       "Kantor Pajak",
    "legislative":      "Lembaga Legislatif",
    "military":         "Fasilitas Militer",
    "community_centre": "Pusat Komunitas",
    "library":          "Perpustakaan",
}


def detect_category(props: dict) -> str:
    """
    Tentukan kategori kantor pemerintahan dari properti OSM.
    Prioritas: amenity → government → townhall:type → name keyword → default
    """
    amenity       = str(props.get("amenity",       "")).lower().strip()
    government    = str(props.get("government",    "")).lower().strip()
    townhall_type = str(props.get("townhall:type", "")).lower().strip()
    military      = str(props.get("military",      "")).lower().strip()
    name          = str(props.get("name",          "")).lower()

    if amenity in AMENITY_TO_CATEGORY:
        return AMENITY_TO_CATEGORY[amenity]

    if military:
        return "military"

    if government in GOVERNMENT_TO_CATEGORY:
        return GOVERNMENT_TO_CATEGORY[government]

    if townhall_type in TOWNHALL_TYPE_TO_CATEGORY:
        return TOWNHALL_TYPE_TO_CATEGORY[townhall_type]

    for cat, keywords in NAME_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return cat

    return "government_office"  # default


# ─── Main migrate ─────────────────────────────────────────────────────────────

def migrate_data():
    db = get_db()

    COLLECTION = "waypoint_pemerintahan"

    data_dir  = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
    ))
    file_path = os.path.join(data_dir, "kantor_pemerintahan.geojson")

    print("─" * 60)
    print("  MIGRASI DATA KANTOR PEMERINTAHAN → MongoDB")
    print("─" * 60)
    print(f"  Koleksi  : {COLLECTION}")
    print(f"  File     : {file_path}")
    print("─" * 60)

    if not os.path.exists(file_path):
        print(f"\n❌ File tidak ditemukan:\n   {file_path}")
        print(f"\n   Pastikan kantor_pemerintahan.geojson ada di:\n   {data_dir}")
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
        props["type_label"]   = TYPE_LABELS.get(category, "Kantor Pemerintahan")

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