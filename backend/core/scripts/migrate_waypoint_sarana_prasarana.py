import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv

base_dir = os.path.dirname(__file__)
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

def migrate_data():
    user    = os.getenv("DB_MONGO_USER")
    pw      = os.getenv("DB_MONGO_PASSWORD")
    host    = os.getenv("DB_MONGO_HOST")
    port    = os.getenv("DB_MONGO_PORT")
    db_name = os.getenv("DB_MONGO_NAME")

    uri    = f"mongodb://{user}:{pw}@{host}:{port}/" if user and pw else f"mongodb://{host}:{port}/"
    client = MongoClient(uri)
    db     = client[db_name]

    tasks = [
        {
            "collection": "waypoint_sarana_prasarana",
            "file": "waypoint_papua_sarana_prasarana_hotel_kantor_perbelanjaan.geojson"
        }
    ]

    data_dir = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
    ))

    CATEGORY_KEYWORDS = {
        "hotel":        ["hotel", "penginapan", "resort", "motel", "hostel", "lodge", "inn"],
        "kantor":       ["kantor", "office", "pemerintah", "balai", "dinas", "badan",
                         "kecamatan", "kelurahan", "instansi", "perkantoran"],
        "perbelanjaan": ["mall", "pasar", "supermarket", "minimarket", "toko", "plaza",
                         "pusat perbelanjaan", "market", "hypermart", "indomaret", "alfamart"],
    }

    def detect_category(props: dict) -> str:
        for field in ("category", "type", "amenity", "fclass", "kind"):
            val = str(props.get(field, "")).lower()
            if val:
                for cat, keywords in CATEGORY_KEYWORDS.items():
                    if any(kw in val for kw in keywords):
                        return cat
        name = str(props.get("name", "")).lower()
        for cat, keywords in CATEGORY_KEYWORDS.items():
            if any(kw in name for kw in keywords):
                return cat
        return "sarana_prasarana"

    print(f"--- MEMULAI PROSES UPLOAD WAYPOINT SARANA PRASARANA ---")

    for task in tasks:
        file_path       = os.path.join(data_dir, task["file"])
        collection_name = task["collection"]

        print(f"\n⏳ Sedang memproses file: {task['file']}")

        try:
            if not os.path.exists(file_path):
                print(f"❌ File TIDAK ADA di folder: {file_path}")
                continue

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            features = data.get('features', [])

            if not features:
                print(f"⚠️ Kosong: File tidak punya data 'features'.")
                continue

            db[collection_name].delete_many({})

            category_counts = {}
            enriched = []

            for feature in features:
                props = feature.get("properties") or {}

                if not props.get("category"):
                    props["category"] = detect_category(props)

                cat = props["category"]
                category_counts[cat] = category_counts.get(cat, 0) + 1
                feature["properties"] = props
                enriched.append(feature)

            db[collection_name].insert_many(enriched)
            print(f"✅ BERHASIL: {len(enriched)} dokumen masuk ke koleksi '{collection_name}'")
            print(f"   Rincian kategori:")
            for cat, count in sorted(category_counts.items()):
                print(f"     • {cat}: {count} data")

            db[collection_name].create_index([("geometry", "2dsphere")])
            db[collection_name].create_index([("properties.category", 1)])
            print(f"   ✅ Index '2dsphere' dan 'properties.category' dibuat")

        except Exception as e:
            print(f"❌ ERROR saat upload {task['file']}: {e}")

    print(f"\n--- SELESAI: Cek MongoDB Compass Anda ---")

if __name__ == "__main__":
    migrate_data()