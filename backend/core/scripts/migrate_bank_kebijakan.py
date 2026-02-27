import json
import os
import sys
import psycopg2
from dotenv import load_dotenv

base_dir = os.path.dirname(__file__)
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

def migrate_bank_kebijakan():
    base_dir = os.path.dirname(__file__)
    data_dir = os.path.abspath(os.path.join(
        base_dir, '..', '..', '..', 'frontend', 'public', 'data'
    ))
    file_path = os.path.join(data_dir, 'bank_kebijakan_300.json')

    print("--- MEMULAI MIGRASI BANK KEBIJAKAN EKONOMI → PostgreSQL ---")

    if not os.path.exists(file_path):
        print(f"❌ File TIDAK ADA: {file_path}")
        print("💡 Pastikan 'bank_kebijakan_300.json' ada di frontend/public/data/")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list) or len(data) == 0:
        print("⚠️ File kosong atau format tidak valid.")
        return

    print(f"📥 Ditemukan {len(data)} data di file JSON")

    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "5432"))
    db_name = os.getenv("DB_NAME", "postgres")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")

    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=db_name,
            user=user,
            password=password,
        )
        cur = conn.cursor()
        print(f"✅ PostgreSQL terhubung ke database '{db_name}'")
    except Exception as e:
        print(f"❌ Gagal koneksi PostgreSQL: {e}")
        sys.exit(1)

    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bank_kebijakan_ekonomi (
                id               SERIAL PRIMARY KEY,
                kategori_utama   VARCHAR(50),
                sub_sektor       VARCHAR(100),
                prioritas        VARCHAR(20),
                no_aksi          INTEGER,
                nama_aksi        TEXT,
                detail_aksi      TEXT,
                timeline         VARCHAR(50),
                budget_est       VARCHAR(50),
                sektor_terkait   VARCHAR(100),
                indikator_dampak VARCHAR(100),
                created_at       TIMESTAMP DEFAULT NOW()
            );
        """)

        cur.execute("DELETE FROM bank_kebijakan_ekonomi;")
        print("🗑️  Data lama dihapus")

        insert_query = """
            INSERT INTO bank_kebijakan_ekonomi
                (id, kategori_utama, sub_sektor, prioritas, no_aksi, nama_aksi,
                 detail_aksi, timeline, budget_est, sektor_terkait, indikator_dampak)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for row in data:
            cur.execute(insert_query, (
                row.get('id'),
                row.get('kategori_utama'),
                row.get('sub_sektor'),
                row.get('prioritas'),
                row.get('no_aksi'),
                row.get('nama_aksi'),
                row.get('detail_aksi'),
                row.get('timeline'),
                row.get('budget_est'),
                row.get('sektor_terkait'),
                row.get('indikator_dampak'),
            ))

        conn.commit()
        print(f"✅ BERHASIL: {len(data)} data masuk ke tabel 'bank_kebijakan_ekonomi'")
        print("💡 Buka DBeaver → refresh tabel bank_kebijakan_ekonomi untuk melihat data")

    except Exception as e:
        conn.rollback()
        print(f"❌ ERROR saat insert: {e}")
    finally:
        cur.close()
        conn.close()

    print("\n--- SELESAI ---")

if __name__ == "__main__":
    migrate_bank_kebijakan()