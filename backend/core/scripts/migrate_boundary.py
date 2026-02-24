import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv

base_dir = os.path.dirname(__file__)
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

def migrate_data():
    user = os.getenv("DB_MONGO_USER")
    pw = os.getenv("DB_MONGO_PASSWORD")
    host = os.getenv("DB_MONGO_HOST")
    port = os.getenv("DB_MONGO_PORT")
    db_name = os.getenv("DB_MONGO_NAME")

    uri = f"mongodb://{user}:{pw}@{host}:{port}/" if user and pw else f"mongodb://{host}:{port}/"
    client = MongoClient(uri)
    db = client[db_name]

    tasks = [
        {
            "collection": "batas_kabupaten", 
            "file": "gabungan_38_wilayah_batas_kabkota.geojson"
        },
        {
            "collection": "batas_provinsi", 
            "file": "gabungan_38_wilayah_batas_provinsi.geojson"
        }
    ]

    data_dir = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data', 'boundary'
    ))

    print(f"--- MEMULAI PROSES UPLOAD DUA FILE ---")
    
    for task in tasks:
        file_path = os.path.join(data_dir, task["file"])
        collection_name = task["collection"]
        
        print(f"\n⏳ Sedang memproses file: {task['file']}")

        try:
            if not os.path.exists(file_path):
                print(f"❌ File TIDAK ADA di folder: {file_path}")
                continue

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            features = data.get('features', [])
            
            if features:
                # Menghapus data lama di koleksi terkait agar tidak tumpang tindih
                db[collection_name].delete_many({}) 
                
                # Memasukkan data baru ke koleksi yang sesuai
                db[collection_name].insert_many(features)
                print(f"✅ BERHASIL: {len(features)} data masuk ke koleksi '{collection_name}'")
            else:
                print(f"⚠️ Kosong: File {task['file']} tidak punya data 'features'.")

        except Exception as e:
            print(f"❌ ERROR saat upload {task['file']}: {e}")

    print(f"\n--- SELESAI: Cek MongoDB Compass Anda ---")

if __name__ == "__main__":
    migrate_data()