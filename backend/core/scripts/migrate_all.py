import json
import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

# ─── Setup path ───────────────────────────────────────────────────────────────

base_dir    = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

# ─── Koneksi ──────────────────────────────────────────────────────────────────

def get_mongo_db():
    user    = os.getenv("DB_MONGO_USER")
    pw      = os.getenv("DB_MONGO_PASSWORD")
    host    = os.getenv("DB_MONGO_HOST", "localhost")
    port    = os.getenv("DB_MONGO_PORT", "27017")
    db_name = os.getenv("DB_MONGO_NAME")

    uri    = f"mongodb://{user}:{pw}@{host}:{port}/" if user and pw else f"mongodb://{host}:{port}/"
    client = MongoClient(uri)
    return client[db_name]

def get_pg_conn():
    return psycopg2.connect(
        host     = os.getenv("DB_HOST", "127.0.0.1"),
        port     = int(os.getenv("DB_PORT", "5432")),
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD"),
    )

DATA_DIR = os.path.abspath(os.path.join(
    base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
))

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def _read_geojson(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print(f"  ❌ File tidak ditemukan: {path}")
        return []
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('features', [])

def _migrate_geojson(db, collection: str, filename: str, enrich_fn=None, extra_indexes: list = None):
    """
    Baca GeoJSON, enrich tiap feature (opsional), hapus data lama, insert baru, buat index.
    enrich_fn(props) → memodifikasi props in-place dan return category string (opsional)
    """
    features = _read_geojson(filename)
    if not features:
        return

    print(f"  ✅ {len(features):,} features ditemukan")

    deleted = db[collection].delete_many({})
    print(f"  🗑️  Data lama dihapus: {deleted.deleted_count:,} dokumen")

    category_counts = {}
    enriched = []
    for feature in features:
        props = feature.get("properties") or {}
        if enrich_fn:
            cat = enrich_fn(props)
            category_counts[cat] = category_counts.get(cat, 0) + 1
        feature["properties"] = props
        enriched.append(feature)

    db[collection].insert_many(enriched)
    print(f"  ✅ BERHASIL: {len(enriched):,} dokumen → '{collection}'")

    if category_counts:
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            print(f"     • {cat:<45} : {count:,}")

    indexes = [
        [("geometry", "2dsphere")],
        [("properties.category", 1)],
        [("properties.name", 1)],
    ]
    if extra_indexes:
        indexes.extend(extra_indexes)
    for idx in indexes:
        db[collection].create_index(idx)
    print(f"  ✅ Index dibuat")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. BOUNDARY
# ═══════════════════════════════════════════════════════════════════════════════

def migrate_boundary(db):
    print("\n" + "═" * 60)
    print("  [1/7] BOUNDARY")
    print("═" * 60)

    tasks = [
        ("batas_kabupaten", "gabungan_38_wilayah_batas_kabkota.geojson"),
        ("batas_provinsi",  "gabungan_38_wilayah_batas_provinsi(update).geojson"),
    ]

    for collection, filename in tasks:
        path = os.path.join(DATA_DIR, filename)
        print(f"\n  ⏳ {filename}")
        if not os.path.exists(path):
            print(f"  ❌ File tidak ditemukan: {path}")
            continue
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        features = data.get('features', [])
        if not features:
            print("  ⚠️  Tidak ada features, dilewati.")
            continue
        db[collection].delete_many({})
        db[collection].insert_many(features)
        print(f"  ✅ {len(features):,} dokumen → '{collection}'")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. KANTOR PEMERINTAHAN
# ═══════════════════════════════════════════════════════════════════════════════

_AMENITY_GOV = {
    "townhall":"townhall","police":"police","fire_station":"fire_station",
    "courthouse":"courthouse","prison":"prison","post_office":"post_office",
    "public_building":"government_office","community_centre":"community_centre",
    "library":"library",
}
_GOVERNMENT_GOV = {
    "administrative":"government_office","public_service":"government_office",
    "yes":"government_office","register_office":"government_office",
    "office":"government_office","village_office":"village_office",
    "government":"government_office","ministry":"ministry","tax":"tax_office",
    "transportation":"government_office","customs":"customs",
    "healthcare":"government_office","education":"government_office",
    "environment":"government_office","agriculture":"government_office",
    "social_services":"government_office","local":"government_office",
    "prosecutor":"courthouse","legislative":"legislative",
    "immigration":"immigration","judicial":"courthouse",
    "forestry":"government_office","finance":"government_office","police":"police",
}
_TOWNHALL_TYPE_GOV = {
    "city":"townhall","town":"townhall","municipality":"townhall","municipal":"townhall",
    "district":"government_office","village":"village_office","rt":"village_office",
    "rw":"village_office","barangay":"village_office","government_office":"government_office",
}
_NAME_KW_GOV = {
    "police":           ["polri","polres","polsek","polda","kepolisian","kapolsek"],
    "fire_station":     ["pemadam kebakaran","damkar","fire station"],
    "courthouse":       ["pengadilan","kejaksaan","mahkamah"],
    "prison":           ["lapas","lembaga pemasyarakatan","rutan","rumah tahanan"],
    "townhall":         ["balai kota","walikota","bupati","gubernur","kantor bupati",
                         "kantor walikota","kantor gubernur"],
    "village_office":   ["kantor desa","kantor kelurahan","kelurahan","balai desa",
                         "kantor camat","kecamatan"],
    "ministry":         ["kementerian","departemen","dirjen","direktorat jenderal"],
    "customs":          ["bea cukai","imigrasi"],
    "immigration":      ["imigrasi","kantor imigrasi"],
    "tax_office":       ["pajak","kpp","kantor pajak","bprd","bpkad"],
    "legislative":      ["dprd","dpr","mpr","dpd"],
    "military":         ["tni","kodam","korem","kodim","koramil","markas"],
    "government_office":["kantor pemerintah","kantor dinas","dinas","badan",
                         "pusat pemerintahan","gedung pemerintah","kantor"],
}
_LABELS_GOV = {
    "townhall":"Kantor Walikota / Bupati / Gubernur","village_office":"Kantor Desa / Kelurahan / Kecamatan",
    "government_office":"Kantor Pemerintahan","ministry":"Kementerian / Direktorat",
    "police":"Kepolisian","fire_station":"Pemadam Kebakaran","courthouse":"Pengadilan / Kejaksaan",
    "prison":"Lembaga Pemasyarakatan","post_office":"Kantor Pos","customs":"Bea Cukai",
    "immigration":"Kantor Imigrasi","tax_office":"Kantor Pajak","legislative":"Lembaga Legislatif",
    "military":"Fasilitas Militer","community_centre":"Pusat Komunitas","library":"Perpustakaan",
}

def _enrich_pemerintahan(props: dict) -> str:
    amenity       = str(props.get("amenity",       "")).lower().strip()
    government    = str(props.get("government",    "")).lower().strip()
    townhall_type = str(props.get("townhall:type", "")).lower().strip()
    military      = str(props.get("military",      "")).lower().strip()
    name          = str(props.get("name",          "")).lower()

    if amenity in _AMENITY_GOV:    cat = _AMENITY_GOV[amenity]
    elif military:                  cat = "military"
    elif government in _GOVERNMENT_GOV: cat = _GOVERNMENT_GOV[government]
    elif townhall_type in _TOWNHALL_TYPE_GOV: cat = _TOWNHALL_TYPE_GOV[townhall_type]
    else:
        cat = next((c for c, kws in _NAME_KW_GOV.items() if any(kw in name for kw in kws)), "government_office")

    props["category"]   = cat
    props["type_label"] = _LABELS_GOV.get(cat, "Kantor Pemerintahan")
    return cat

def migrate_pemerintahan(db):
    print("\n" + "═" * 60)
    print("  [2/7] KANTOR PEMERINTAHAN")
    print("═" * 60)
    _migrate_geojson(db, "waypoint_pemerintahan", "kantor_pemerintahan.geojson", _enrich_pemerintahan)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. KESEHATAN
# ═══════════════════════════════════════════════════════════════════════════════

_AMENITY_KES = {
    "hospital":"hospital","clinic":"clinic","health_post":"health_post",
    "pharmacy":"pharmacy","doctors":"clinic",
}
_HEALTHCARE_KES = {
    "hospital":"hospital","clinic":"clinic","centre":"clinic","dialysis":"hospital",
    "doctor":"clinic","midwife":"clinic","dentist":"clinic","laboratory":"clinic",
    "birthing_centre":"clinic","birthing_center":"clinic",
    "vaccination_centre":"clinic","blood_donation":"clinic","Puskesmas":"clinic",
}
_NAME_KW_KES = {
    "hospital":    ["rumah sakit","rs ","rsu ","rsud","rsia","rsup","rskb","hospital","klinik utama"],
    "clinic":      ["puskesmas","klinik","poliklinik","balai pengobatan","praktek","praktek dokter","dokter","bidan"],
    "health_post": ["posyandu","pos kesehatan","polindes","poskesdes","pos bidan","pustu"],
    "pharmacy":    ["apotek","apotik","farmasi","pharmacy"],
}
_LABELS_KES = {
    "hospital":"Rumah Sakit","clinic":"Klinik / Puskesmas",
    "health_post":"Pos Kesehatan / Posyandu","pharmacy":"Apotek / Farmasi",
}

def _enrich_kesehatan(props: dict) -> str:
    amenity    = str(props.get("amenity",    "")).lower().strip()
    healthcare = str(props.get("healthcare", "")).strip()
    name       = str(props.get("name",       "")).lower()

    if amenity in _AMENITY_KES:
        cat = _AMENITY_KES[amenity]
    elif healthcare in _HEALTHCARE_KES:
        cat = _HEALTHCARE_KES[healthcare]
    elif any(hv.lower() in healthcare.lower() for hv, hc in _HEALTHCARE_KES.items()):
        cat = next(hc for hv, hc in _HEALTHCARE_KES.items() if hv.lower() in healthcare.lower())
    else:
        cat = next((c for c, kws in _NAME_KW_KES.items() if any(kw in name for kw in kws)), "clinic")

    props["category"]   = cat
    props["type_label"] = _LABELS_KES.get(cat, "Fasilitas Kesehatan")
    return cat

def migrate_kesehatan(db):
    print("\n" + "═" * 60)
    print("  [3/7] KESEHATAN")
    print("═" * 60)
    _migrate_geojson(db, "waypoint_kesehatan", "kesehatan.geojson", _enrich_kesehatan)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. MBG
# ═══════════════════════════════════════════════════════════════════════════════

_AMENITY_MBG = {
    "community_centre":"community_centre","social_facility":"social_facility",
    "canteen":"canteen","restaurant":"restaurant","fast_food":"fast_food",
    "kitchen":"kitchen","school":"school","kindergarten":"kindergarten","food_court":"food_court",
}
_CC_MBG = {
    "food":"food_centre","kitchen":"kitchen","nutrition":"nutrition_centre","social":"social_facility",
}
_NAME_KW_MBG = {
    "kitchen":          ["dapur","dapur umum","dapur makan","cooking"],
    "food_centre":      ["makan bergizi","mbg","pusat makanan","food centre"],
    "canteen":          ["kantin","warung","katering","catering"],
    "nutrition_centre": ["gizi","posyandu gizi","kebun gizi","nutrisi"],
    "social_facility":  ["sosial","pusat komunitas","balai","community"],
    "school":           ["sekolah","sd","smp","sma","madrasah"],
}
_LABELS_MBG = {
    "community_centre":"Pusat Komunitas / MBG","social_facility":"Fasilitas Sosial",
    "canteen":"Kantin / Warung","restaurant":"Restoran","fast_food":"Makanan Cepat Saji",
    "kitchen":"Dapur Umum","food_centre":"Pusat Makan Bergizi",
    "nutrition_centre":"Pusat Gizi / Kebun Gizi","food_court":"Food Court",
    "school":"Sekolah (Titik MBG)","kindergarten":"TK / PAUD (Titik MBG)",
}

def _enrich_mbg(props: dict) -> str:
    amenity          = str(props.get("amenity",          "")).lower().strip()
    community_centre = str(props.get("community_centre", "")).lower().strip()
    name             = str(props.get("name",             "")).lower()
    combined         = f"{name} {str(props.get('name:hi', '')).lower()}"

    if amenity in _AMENITY_MBG:
        cat = _AMENITY_MBG[amenity]
        if cat == "community_centre":
            if community_centre in _CC_MBG:
                cat = _CC_MBG[community_centre]
            else:
                cat = next((c for c, kws in _NAME_KW_MBG.items() if any(kw in combined for kw in kws)), cat)
    else:
        cat = next((c for c, kws in _NAME_KW_MBG.items() if any(kw in combined for kw in kws)), "community_centre")

    props["category"]   = cat
    props["type_label"] = _LABELS_MBG.get(cat, "Titik MBG")
    return cat

def migrate_mbg(db):
    print("\n" + "═" * 60)
    print("  [4/7] MBG (MAKAN BERGIZI GRATIS)")
    print("═" * 60)
    _migrate_geojson(db, "waypoint_mbg", "mbg.geojson", _enrich_mbg)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. PENDIDIKAN
# ═══════════════════════════════════════════════════════════════════════════════

_AMENITY_PEND = {
    "school":"school","kindergarten":"kindergarten","college":"college","university":"university",
}
_NAME_KW_PEND = {
    "university":   ["universitas","institut","uin","itb","ui ","ugm","unpad"],
    "college":      ["politeknik","akademi","stie","stik","stmik","amik","d3","d4"],
    "kindergarten": ["tk ","paud","taman kanak","playgroup","ra "],
    "school":       ["sd ","smp","sma","smk","madrasah","pesantren","pondok"],
}
_LABELS_PEND = {
    "school":"Sekolah (SD/SMP/SMA/SMK)","kindergarten":"TK / PAUD",
    "college":"Politeknik / Akademi","university":"Universitas / Institut",
}

def _enrich_pendidikan(props: dict) -> str:
    amenity = str(props.get("amenity", "")).lower().strip()
    name    = str(props.get("name",    "")).lower()

    if amenity in _AMENITY_PEND:
        cat = _AMENITY_PEND[amenity]
    else:
        cat = next((c for c, kws in _NAME_KW_PEND.items() if any(kw in name for kw in kws)), "school")

    props["category"]   = cat
    props["type_label"] = _LABELS_PEND.get(cat, "Lembaga Pendidikan")
    return cat

def migrate_pendidikan(db):
    print("\n" + "═" * 60)
    print("  [5/7] PENDIDIKAN")
    print("═" * 60)
    _migrate_geojson(db, "waypoint_pendidikan", "pendidikan.geojson", _enrich_pendidikan)


# ═══════════════════════════════════════════════════════════════════════════════
# 6. PERTAHANAN / MILITER
# ═══════════════════════════════════════════════════════════════════════════════

_MILITARY_CAT = {
    "base":"base","barracks":"barracks","checkpoint":"checkpoint","office":"military_office",
    "training_area":"training_area","airfield":"airfield","naval_base":"naval_base",
    "bunker":"bunker","obstacle":"checkpoint","range":"training_area",
    "danger_area":"training_area","ammunition":"ammunition","guard_post":"checkpoint",
    "trench":"checkpoint","launchpad":"base",
}
_NAME_KW_MIL = {
    "base":           ["markas besar","mabes","markas","pangkalan","komando","korem",
                       "kodam","kopassus","kostrad","lanud","lanal","lauda"],
    "barracks":       ["batalyon","yonif","yonkav","yonarmed","yonzipur","yonkes",
                       "kodim","koramil","korem","batalion","detasemen","den"],
    "checkpoint":     ["pos","pos jaga","pos pemeriksaan","penjagaan","portal"],
    "military_office":["kantor","markas","staf","headquarters"],
    "training_area":  ["latihan","pusdiklat","dodik","pendidikan","training"],
    "naval_base":     ["angkatan laut","ksatrian","lanal","komando armada"],
    "airfield":       ["lanud","pangkalan udara","apron","angkatan udara"],
}
_LABELS_MIL = {
    "base":"Markas / Pangkalan Militer","barracks":"Batalyon / Asrama Militer",
    "checkpoint":"Pos Pemeriksaan / Penjagaan","military_office":"Kantor / Staf Militer",
    "training_area":"Area Latihan Militer","airfield":"Pangkalan Udara (TNI AU)",
    "naval_base":"Pangkalan Laut (TNI AL)","bunker":"Bunker / Benteng",
    "ammunition":"Gudang Amunisi",
}

def _detect_branch(props: dict):
    svc  = str(props.get("military_service", "")).lower().strip()
    name = f"{str(props.get('name','')).lower()} {str(props.get('alt_name','')).lower()}"
    svc_map = {"army":"TNI AD","navy":"TNI AL","air_force":"TNI AU","marines":"TNI AL","coast_guard":"TNI AL","police":"Kepolisian"}
    if svc in svc_map:
        return svc_map[svc]
    if any(kw in name for kw in ["angkatan darat"," ad ","yonif","kodam","kodim","koramil","korem","kostrad","kopassus"]):
        return "TNI AD"
    if any(kw in name for kw in ["angkatan laut"," al ","lanal","koarmada","marinir"]):
        return "TNI AL"
    if any(kw in name for kw in ["angkatan udara"," au ","lanud","koopsud","paskhas"]):
        return "TNI AU"
    return None

def _enrich_pertahanan(props: dict) -> str:
    military = str(props.get("military", "")).lower().strip()
    landuse  = str(props.get("landuse",  "")).lower().strip()
    name     = f"{str(props.get('name','')).lower()} {str(props.get('alt_name','')).lower()}"

    if military in _MILITARY_CAT:
        cat = _MILITARY_CAT[military]
    else:
        cat = next((c for c, kws in _NAME_KW_MIL.items() if any(kw in name for kw in kws)),
                   "base" if landuse == "military" else "base")

    branch = _detect_branch(props)
    props["category"]   = cat
    props["type_label"] = _LABELS_MIL.get(cat, "Fasilitas Militer / Pertahanan")
    if branch:
        props["branch"] = branch
    return cat

def migrate_pertahanan(db):
    print("\n" + "═" * 60)
    print("  [6/7] PERTAHANAN / MILITER")
    print("═" * 60)
    _migrate_geojson(
        db, "waypoint_pertahanan", "pertahanan.geojson", _enrich_pertahanan,
        extra_indexes=[[("properties.branch", 1)]]
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 7. BANK KEBIJAKAN (PostgreSQL)
# ═══════════════════════════════════════════════════════════════════════════════

def migrate_bank_kebijakan():
    print("\n" + "═" * 60)
    print("  [7/7] BANK KEBIJAKAN (PostgreSQL)")
    print("═" * 60)

    if not HAS_PSYCOPG2:
        print("  ⚠️  psycopg2 tidak terinstall, lewati bank_kebijakan.")
        return

    file_path = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data',
        'bank_kebijakan_revisi_v2.json'
    ))
    print(f"  📂 File: {file_path}")

    if not os.path.exists(file_path):
        print(f"  ❌ File tidak ditemukan, dilewati.")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list) or not data:
        print("  ⚠️  File kosong atau format tidak valid.")
        return

    print(f"  ✅ {len(data)} data ditemukan di JSON")

    try:
        conn = get_pg_conn()
        cur  = conn.cursor()
        print(f"  ✅ PostgreSQL terhubung")
    except Exception as e:
        print(f"  ❌ Gagal koneksi PostgreSQL: {e}")
        return

    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bank_kebijakan (
                id                  SERIAL PRIMARY KEY,
                indeks              VARCHAR(50),
                status              VARCHAR(20),
                prioritas           INTEGER,
                pilar_kebijakan     TEXT,
                isu_strategis       TEXT,
                kebijakan           TEXT,
                rekomendasi_program TEXT,
                indikator_terkait   VARCHAR(100),
                created_at          TIMESTAMP DEFAULT NOW()
            );
        """)
        cur.execute("TRUNCATE TABLE bank_kebijakan RESTART IDENTITY;")
        print(f"  🗑️  Data lama dihapus")

        for row in data:
            cur.execute("""
                INSERT INTO bank_kebijakan
                    (indeks, status, prioritas, pilar_kebijakan,
                     isu_strategis, kebijakan, rekomendasi_program, indikator_terkait)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                row.get('indeks'), row.get('status'), row.get('prioritas'),
                row.get('pilar_kebijakan'), row.get('isu_strategis'),
                row.get('kebijakan'), row.get('rekomendasi_program'), row.get('indikator_terkait'),
            ))

        conn.commit()
        print(f"  ✅ BERHASIL: {len(data)} data → tabel 'bank_kebijakan'")

    except Exception as e:
        conn.rollback()
        print(f"  ❌ ERROR saat insert: {e}")
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "█" * 60)
    print("  MIGRATE ALL — MULAI")
    print("█" * 60)

    # MongoDB migrations
    try:
        db = get_mongo_db()
        print("\n✅ MongoDB terhubung")
    except Exception as e:
        print(f"\n❌ Gagal koneksi MongoDB: {e}")
        sys.exit(1)

    migrate_boundary(db)
    migrate_pemerintahan(db)
    migrate_kesehatan(db)
    migrate_mbg(db)
    migrate_pendidikan(db)
    migrate_pertahanan(db)

    # PostgreSQL migration
    migrate_bank_kebijakan()

    print("\n" + "█" * 60)
    print("  MIGRATE ALL — SELESAI ✅")
    print("█" * 60 + "\n")


if __name__ == "__main__":
    main()