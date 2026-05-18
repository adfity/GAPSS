import os
import pandas as pd
import numpy as np

try:
    import psycopg2
    import psycopg2.extras
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

from dotenv import load_dotenv

# ─── Setup path ───────────────────────────────────────────────────────────────

base_dir    = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

# ─── Koneksi PostgreSQL ───────────────────────────────────────────────────────

def get_pg_conn():
    return psycopg2.connect(
        host     = os.getenv("DB_HOST", "127.0.0.1"),
        port     = int(os.getenv("DB_PORT", "5432")),
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD"),
    )

# ─── Path ke CSV ──────────────────────────────────────────────────────────────

# Sesuaikan path ini ke lokasi file CSV hasil gabungan
CSV_PATH = os.path.abspath(os.path.join(
    base_dir, '..', '..', '..', 'frontend', 'public', 'data',
        'prediksi_indikator_gabungan.csv'
))

# ═══════════════════════════════════════════════════════════════════════════════
# DDL
# ═══════════════════════════════════════════════════════════════════════════════

DDL = """
CREATE TABLE IF NOT EXISTS prediksi_indikator_wilayah (
    id              SERIAL PRIMARY KEY,
    kode_wilayah    INTEGER       NOT NULL,
    wilayah         VARCHAR(150)  NOT NULL,
    provinsi        VARCHAR(150)  NOT NULL,
    level           VARCHAR(20)   NOT NULL,   -- 'provinsi' atau 'kab_kota'
    tahun           SMALLINT      NOT NULL,   -- 2024-2045

    -- ISDM
    hls             NUMERIC(8,4),
    rls             NUMERIC(8,4),
    ahh             NUMERIC(8,4),
    pengeluaran     NUMERIC(12,4),

    -- ISKA
    hortikultura    NUMERIC(18,4),
    padi            NUMERIC(8,4),
    ttplahan        NUMERIC(12,4),
    hahutan         NUMERIC(12,4),
    kebun           NUMERIC(12,4),
    ikan            NUMERIC(12,4),
    proktam         NUMERIC(12,4),

    -- IKP
    ketersediaan    NUMERIC(8,4),
    keterjangkauan  NUMERIC(8,4),
    pemanfaatan     NUMERIC(8,4),

    -- IPE
    spk             NUMERIC(12,4),
    spe             NUMERIC(8,4),

    created_at      TIMESTAMP DEFAULT NOW(),

    UNIQUE (kode_wilayah, tahun)
);
"""

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_piw_kode     ON prediksi_indikator_wilayah (kode_wilayah);",
    "CREATE INDEX IF NOT EXISTS idx_piw_tahun    ON prediksi_indikator_wilayah (tahun);",
    "CREATE INDEX IF NOT EXISTS idx_piw_level    ON prediksi_indikator_wilayah (level);",
    "CREATE INDEX IF NOT EXISTS idx_piw_provinsi ON prediksi_indikator_wilayah (provinsi);",
]

INDIKATOR_COLS = [
    'hls', 'rls', 'ahh', 'pengeluaran',
    'hortikultura', 'padi', 'ttplahan', 'hahutan', 'kebun', 'ikan', 'proktam',
    'ketersediaan', 'keterjangkauan', 'pemanfaatan',
    'spk', 'spe',
]

# ═══════════════════════════════════════════════════════════════════════════════
# MIGRATE
# ═══════════════════════════════════════════════════════════════════════════════

def migrate_prediksi_indikator():
    print("\n" + "=" * 60)
    print("  MIGRATE PREDIKSI INDIKATOR WILAYAH (PostgreSQL)")
    print("=" * 60)

    if not HAS_PSYCOPG2:
        print("  psycopg2 tidak terinstall.")
        print("  Jalankan: pip install psycopg2-binary")
        return

    # Baca CSV
    print(f"\n  File: {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print(f"  File tidak ditemukan: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH, low_memory=False,
                     na_values=['-', '', ' ', 'N/A', 'NA', 'nan', 'None'])

    # Dedup jaga-jaga
    before = len(df)
    df = df.drop_duplicates(subset=['kode_wilayah', 'tahun'], keep='first')
    if len(df) < before:
        print(f"  {before - len(df):,} baris duplikat dihapus")

    print(f"  {len(df):,} baris siap "
          f"(tahun {df['tahun'].min()}-{df['tahun'].max()}, "
          f"{df['level'].value_counts().to_dict()})")

    # Koneksi
    try:
        conn = get_pg_conn()
        cur  = conn.cursor()
        print(f"  PostgreSQL terhubung")
    except Exception as e:
        print(f"  Gagal koneksi PostgreSQL: {e}")
        return

    try:
        # Buat tabel
        cur.execute(DDL)
        conn.commit()
        print(f"  Tabel 'prediksi_indikator_wilayah' siap")

        # Hapus data lama
        cur.execute("SELECT COUNT(*) FROM prediksi_indikator_wilayah;")
        existing = cur.fetchone()[0]
        cur.execute("TRUNCATE TABLE prediksi_indikator_wilayah RESTART IDENTITY;")
        conn.commit()
        print(f"  Data lama dihapus: {existing:,} baris")

        # Siapkan rows
        def to_float(val):
            if val is None or (isinstance(val, float) and np.isnan(val)):
                return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return None

        rows = [
            (
                int(row['kode_wilayah']),
                str(row['wilayah']),
                str(row['provinsi']),
                str(row['level']),
                int(row['tahun']),
                *[to_float(row.get(col)) for col in INDIKATOR_COLS]
            )
            for _, row in df.iterrows()
        ]

        # Insert batch
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO prediksi_indikator_wilayah
                (kode_wilayah, wilayah, provinsi, level, tahun,
                 hls, rls, ahh, pengeluaran,
                 hortikultura, padi, ttplahan, hahutan, kebun, ikan, proktam,
                 ketersediaan, keterjangkauan, pemanfaatan,
                 spk, spe)
            VALUES %s
            ON CONFLICT (kode_wilayah, tahun) DO UPDATE SET
                wilayah        = EXCLUDED.wilayah,
                provinsi       = EXCLUDED.provinsi,
                level          = EXCLUDED.level,
                hls            = EXCLUDED.hls,
                rls            = EXCLUDED.rls,
                ahh            = EXCLUDED.ahh,
                pengeluaran    = EXCLUDED.pengeluaran,
                hortikultura   = EXCLUDED.hortikultura,
                padi           = EXCLUDED.padi,
                ttplahan       = EXCLUDED.ttplahan,
                hahutan        = EXCLUDED.hahutan,
                kebun          = EXCLUDED.kebun,
                ikan           = EXCLUDED.ikan,
                proktam        = EXCLUDED.proktam,
                ketersediaan   = EXCLUDED.ketersediaan,
                keterjangkauan = EXCLUDED.keterjangkauan,
                pemanfaatan    = EXCLUDED.pemanfaatan,
                spk            = EXCLUDED.spk,
                spe            = EXCLUDED.spe;
            """,
            rows,
            page_size=500
        )
        conn.commit()
        print(f"  BERHASIL: {len(rows):,} baris -> tabel 'prediksi_indikator_wilayah'")

        # Index
        for idx_sql in INDEXES:
            cur.execute(idx_sql)
        conn.commit()
        print(f"  Index dibuat")

        # Verifikasi
        cur.execute("SELECT COUNT(*) FROM prediksi_indikator_wilayah;")
        total = cur.fetchone()[0]

        cur.execute("SELECT MIN(tahun), MAX(tahun) FROM prediksi_indikator_wilayah;")
        tahun_range = cur.fetchone()

        cur.execute("SELECT level, COUNT(*) FROM prediksi_indikator_wilayah GROUP BY level ORDER BY level;")
        level_counts = cur.fetchall()

        print(f"\n  -- Verifikasi --")
        print(f"  Total baris   : {total:,}")
        print(f"  Rentang tahun : {tahun_range[0]} - {tahun_range[1]}")
        for level, count in level_counts:
            print(f"  Level {level:<12}: {count:,} baris")

    except Exception as e:
        conn.rollback()
        print(f"  ERROR saat migrate: {e}")
        raise
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  MIGRATE PREDIKSI INDIKATOR -- MULAI")
    print("=" * 60)

    migrate_prediksi_indikator()

    print("\n" + "=" * 60)
    print("  MIGRATE PREDIKSI INDIKATOR -- SELESAI")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()