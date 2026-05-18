from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import psycopg2, psycopg2.extras
import uuid, json, os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env')))

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
mongo_db      = MongoClient(MONGO_URI)[DB_MONGO_NAME]
METADATA_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ai_models', 'iska')


def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"),
    )


# ── KONSTANTA ─────────────────────────────────────────────────────────────────
TAHUN_SEMUA = list(range(2010, 2046))
TAHUN_MAX   = 2045

# Bobot default (sama rata Wi = 1/7) — digunakan jika tidak ada metadata bobot PDRB
BOBOT_DEFAULT = {
    'padi':        1/7,
    'hortikultura': 1/7,
    'ttplahan':    1/7,   # Kehutanan: luas penutupan/tutupan lahan
    'hahutan':     1/7,   # Hasil Hutan: produksi kayu bulat
    'kebun':       1/7,   # Perkebunan
    'ikan':        1/7,   # Perikanan
    'proktam':     1/7,   # Pertambangan: PDRB sektor B
}

# Nama dimensi per kolom
DIMENSI_MAP = {
    'padi':        'S1_Pertanian',
    'hortikultura': 'S2_Hortikultura',
    'ttplahan':    'S3_Kehutanan',
    'hahutan':     'S4_Hasil_Hutan',
    'kebun':       'S5_Perkebunan',
    'ikan':        'S6_Perikanan',
    'proktam':     'S7_Pertambangan',
}

# Label ramah per dimensi
LABEL_DIMENSI = {
    'padi':        'Produktivitas Tanaman Padi (Ku/Ha)',
    'hortikultura': 'Total Produksi Hortikultura (Kuintal)',
    'ttplahan':    'Luas Penutupan/Tutupan Lahan (Ha)',
    'hahutan':     'Produksi Kayu Bulat (M³)',
    'kebun':       'Total Produksi Perkebunan (Ton)',
    'ikan':        'Total Produksi Perikanan (Ton)',
    'proktam':     'PDRB Pertambangan Tahunan (Miliar Rp)',
}

# Semua kolom sumber data
KOLOM_AKTIF = ['padi', 'hortikultura', 'ttplahan', 'hahutan', 'kebun', 'ikan', 'proktam']

# Kolom yang diambil dari prediksi (OLS tersedia)
KOLOM_PREDIKSI_TERSEDIA = ['padi', 'hortikultura', 'ttplahan', 'hahutan', 'kebun', 'ikan', 'proktam']

# Mapping indikator → subset kolom
INDIKATOR_DATASET_MAP = {
    'ALL':           ['padi', 'hortikultura', 'ttplahan', 'hahutan', 'kebun', 'ikan', 'proktam'],
    'PERTANIAN':     ['padi'],
    'HORTIKULTURA':  ['hortikultura'],
    'KEHUTANAN':     ['ttplahan'],
    'HASIL_HUTAN':   ['hahutan'],
    'PERKEBUNAN':    ['kebun'],
    'PERIKANAN':     ['ikan'],
    'PERTAMBANGAN':  ['proktam'],
}

WARNA_MAP = {
    'SANGAT_TINGGI':     '#008cd6',
    'TINGGI':            '#abcd05',
    'SEDANG':            '#fff67f',
    'RENDAH':            '#af4284',
    'TIDAK_TERANALISIS': '#a6a6a6',
}
LABEL_MAP = {
    'SANGAT_TINGGI':     'SANGAT TINGGI',
    'TINGGI':            'TINGGI',
    'SEDANG':            'SEDANG',
    'RENDAH':            'RENDAH',
    'TIDAK_TERANALISIS': 'TIDAK TERANALISIS',
}

STATUS_VALID       = ('SANGAT_TINGGI', 'TINGGI', 'SEDANG', 'RENDAH')
# Status di bank_kebijakan ISKA menggunakan spasi (lihat JSON sumber)
STATUS_KEBIJAKAN_MAP = {
    'SANGAT_TINGGI': 'SANGAT TINGGI',
    'TINGGI':        'TINGGI',
    'SEDANG':        'SEDANG',
    'RENDAH':        'RENDAH',
}
PRIORITAS_BAND_MAP = {
    'RENDAH':        [1, 2, 3],
    'SEDANG':        [3, 4],
    'TINGGI':        [4, 5, 6],
    'SANGAT_TINGGI': [5, 6],
}


# ── FORMULA ISKA ──────────────────────────────────────────────────────────────

def minmax_normalize(nilai_dict: dict) -> dict:
    """
    Normalisasi Min-Max lintas 38 provinsi per dimensi.
    Input : {prov: {kolom: nilai, ...}, ...}
    Output: {prov: {kolom: skor_0_100, ...}, ...}
    Nilai 0 atau kosong = tidak ada produksi (tetap disertakan, bukan data hilang).
    """
    # Kumpulkan semua nilai per kolom (termasuk 0, kecuali None)
    kolom_vals: dict[str, list] = {k: [] for k in KOLOM_AKTIF}
    for row in nilai_dict.values():
        for k in KOLOM_AKTIF:
            v = row.get(k)
            if v is not None:
                kolom_vals[k].append(float(v))

    # Hitung xmin / xmax per kolom
    minmax: dict[str, tuple] = {}
    for k, vals in kolom_vals.items():
        if vals:
            minmax[k] = (min(vals), max(vals))
        else:
            minmax[k] = (0.0, 0.0)

    # Normalisasi
    skor_dict: dict[str, dict] = {}
    for prov, row in nilai_dict.items():
        skor_dict[prov] = {}
        for k in KOLOM_AKTIF:
            v = row.get(k)
            if v is None:
                skor_dict[prov][k] = None
                continue
            xmin, xmax = minmax[k]
            if xmax == xmin:
                # Semua provinsi punya nilai sama → semua dapat 0
                skor_dict[prov][k] = 0.0
            else:
                s = ((float(v) - xmin) / (xmax - xmin)) * 100.0
                skor_dict[prov][k] = round(max(0.0, min(100.0, s)), 4)
    return skor_dict


def hitung_iska(skor_dict_prov: dict, bobot: dict, keys_aktif: list) -> dict:
    """
    Hitung ISKA = Σ(Wi × Si) untuk satu provinsi.
    skor_dict_prov: {kolom: skor_0_100}
    Kolom yang None → dianggap 0 (tidak ada produksi, bukan data hilang).
    Kembalikan dict lengkap skor + nilai ISKA.
    """
    total_bobot = 0.0
    total_iska  = 0.0
    for k in keys_aktif:
        s = skor_dict_prov.get(k)
        w = bobot.get(k, 1.0 / len(keys_aktif))
        if s is None:
            s = 0.0   # tidak ada produksi = 0
        total_iska  += w * s
        total_bobot += w

    # Normalisasi bobot jika subset indikator
    iska_val = round(total_iska / total_bobot * (1.0 if total_bobot == 0 else 1.0), 4) if total_bobot > 0 else None
    # Karena bobot bisa subset, rescale agar tetap 0-100
    if total_bobot > 0 and total_bobot != 1.0:
        iska_val = round(total_iska / total_bobot, 4)
    else:
        iska_val = round(total_iska, 4)

    result = {}
    for k in KOLOM_AKTIF:
        result[f's_{k}'] = skor_dict_prov.get(k)
    result['iska'] = iska_val
    return result


def kategorisasi(nilai_iska: float):
    """Klasifikasi nilai ISKA → (key, warna, label)"""
    if nilai_iska is None:
        return 'TIDAK_TERANALISIS', WARNA_MAP['TIDAK_TERANALISIS'], LABEL_MAP['TIDAK_TERANALISIS']
    if nilai_iska >= 75:
        return 'SANGAT_TINGGI', WARNA_MAP['SANGAT_TINGGI'], LABEL_MAP['SANGAT_TINGGI']
    if nilai_iska >= 50:
        return 'TINGGI', WARNA_MAP['TINGGI'], LABEL_MAP['TINGGI']
    if nilai_iska >= 25:
        return 'SEDANG', WARNA_MAP['SEDANG'], LABEL_MAP['SEDANG']
    return 'RENDAH', WARNA_MAP['RENDAH'], LABEL_MAP['RENDAH']


# ── NORMALIZER NAMA PROVINSI ──────────────────────────────────────────────────

def normalize_province_name(name: str) -> str:
    name = str(name)
    for tag in ['<b>', '</b>', '<B>', '</B>']:
        name = name.replace(tag, '')
    name = name.upper().strip()
    SPECIAL = {
        'DKI JAKARTA':                      'JAKARTA',
        'DAERAH KHUSUS IBUKOTA JAKARTA':    'JAKARTA',
        'YOGYAKARTA':                        'DAERAH ISTIMEWA YOGYAKARTA',
        'DIY':                              'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA':                  'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG':                  'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG':             'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU':                        'KEPULAUAN RIAU',
    }
    for k, v in SPECIAL.items():
        if k in name:
            return v
    for a, f in {
        'KEP.': 'KEPULAUAN',
        'NTB':  'NUSA TENGGARA BARAT',
        'NTT':  'NUSA TENGGARA TIMUR',
    }.items():
        name = name.replace(a, f)
    for prefix in ['PROVINSI ', 'PROV. ', 'PROV ', 'DAERAH KHUSUS IBUKOTA ']:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name.strip()


# ── METADATA OLS ──────────────────────────────────────────────────────────────

def _load_ols_metadata():
    """Muat metadata OLS per kolom (jika tersedia)."""
    files = {
        'padi':         'padi_metadata.json',
        'hortikultura': 'hortikultura_metadata.json',
        'ttplahan':     'ttplahan_metadata.json',
        'hahutan':      'hahutan_metadata.json',
        'kebun':        'kebun_metadata.json',
        'ikan':         'ikan_metadata.json',
        'proktam':      'proktam_metadata.json',
    }
    result = {}
    for key, fname in files.items():
        path = os.path.join(METADATA_DIR, fname)
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    result[key] = json.load(f)
            except Exception as e:
                print(f"✗ metadata {fname}: {e}")
    return result


def _build_ols_metrics(meta_dict: dict, keys_aktif: list) -> dict:
    metrics = {}
    for k in keys_aktif:
        m = meta_dict.get(k)
        if not m:
            continue
        ev   = m.get('evaluasi_ringkasan', {})
        mape = ev.get('rata_rata_MAPE (%)')
        metrics[k] = {
            'model':          'Regresi Linear (Ordinary Least Squares)',
            'tahun_training': m.get('tahun_training'),
            'tahun_prediksi': m.get('tahun_prediksi'),
            'jumlah_wilayah': m.get('jumlah_wilayah') or m.get('jumlah_provinsi'),
            'mape_pct':       mape,
            'mae':            (ev.get('rata_rata_MAE (Miliar Rp)')
                               or ev.get('rata_rata_MAE (Ton)')
                               or ev.get('rata_rata_MAE (Ha)')
                               or ev.get('rata_rata_MAE (Kuintal)')
                               or ev.get('rata_rata_MAE (Ku/Ha)')
                               or ev.get('rata_rata_MAE (M³)')
                               or ev.get('rata_rata_MAE')),
            'quality':        _quality_label(mape),
        }
    return metrics


def _quality_label(mape):
    if mape is None:
        return {'grade': '?', 'label': 'Tidak Diketahui', 'color': '#94a3b8'}
    if mape < 2:
        return {'grade': '🥇', 'label': 'Sangat Baik', 'color': '#10b981'}
    if mape < 5:
        return {'grade': '✅', 'label': 'Baik', 'color': '#3b82f6'}
    if mape < 10:
        return {'grade': '⚠️', 'label': 'Cukup', 'color': '#f59e0b'}
    return {'grade': '❌', 'label': 'Perlu Perhatian', 'color': '#ef4444'}


# ── DB CHECK & FETCH ──────────────────────────────────────────────────────────

def check_data_tersedia(tahun: int, keys_aktif: list) -> tuple:
    """
    Cek ketersediaan data per kolom di indikator_wilayah (aktual),
    lalu fallback ke prediksi_indikator_wilayah jika tidak tersedia.
    Return: (dataset_status, ada_prediksi, semua_tersedia)
    """
    dataset_status: dict = {}
    ada_prediksi = False
    conn = None
    try:
        conn = get_pg_connection()
        for k in keys_aktif:
            # Cek aktual
            cur = conn.cursor()
            cur.execute(
                f"SELECT COUNT(*) FROM indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' AND {k} IS NOT NULL",
                (tahun,)
            )
            cnt_aktual = cur.fetchone()[0]
            cur.close()

            if cnt_aktual > 0:
                dataset_status[k] = {
                    'label':           LABEL_DIMENSI[k],
                    'dimensi':         DIMENSI_MAP[k],
                    'tersedia':        True,
                    'perlu_prediksi':  False,
                    'sumber':          'aktual',
                    'jumlah_aktual':   cnt_aktual,
                    'jumlah_prediksi': 0,
                    'tabel':           'indikator_wilayah',
                }
            else:
                # Cek prediksi
                cur2 = conn.cursor()
                cur2.execute(
                    f"SELECT COUNT(*) FROM prediksi_indikator_wilayah "
                    f"WHERE tahun=%s AND level='provinsi' AND {k} IS NOT NULL",
                    (tahun,)
                )
                cnt_pred = cur2.fetchone()[0]
                cur2.close()

                if cnt_pred > 0:
                    ada_prediksi = True
                    dataset_status[k] = {
                        'label':           LABEL_DIMENSI[k],
                        'dimensi':         DIMENSI_MAP[k],
                        'tersedia':        True,
                        'perlu_prediksi':  True,
                        'sumber':          'prediksi',
                        'jumlah_aktual':   0,
                        'jumlah_prediksi': cnt_pred,
                        'tabel':           'prediksi_indikator_wilayah',
                    }
                else:
                    dataset_status[k] = {
                        'label':           LABEL_DIMENSI[k],
                        'dimensi':         DIMENSI_MAP[k],
                        'tersedia':        False,
                        'perlu_prediksi':  False,
                        'sumber':          None,
                        'jumlah_aktual':   0,
                        'jumlah_prediksi': 0,
                        'tabel':           '-',
                    }
    except Exception as e:
        for k in keys_aktif:
            dataset_status[k] = {
                'label': LABEL_DIMENSI[k], 'dimensi': DIMENSI_MAP[k],
                'tersedia': False, 'perlu_prediksi': False,
                'sumber': None, 'jumlah_aktual': 0, 'jumlah_prediksi': 0,
                'tabel': '-', 'error': str(e),
            }
    finally:
        if conn:
            conn.close()

    semua_tersedia = all(v['tersedia'] for v in dataset_status.values())
    return dataset_status, ada_prediksi, semua_tersedia


def fetch_data_from_db(tahun: int, keys_aktif: list) -> tuple:
    """
    Ambil data raw per provinsi: aktual dulu, NULL → isi dari prediksi.
    Return: ({prov: {kolom: nilai, sumber, kolom_prediksi}}, ada_prediksi)
    """
    kolom_sql = ['provinsi', 'kode_wilayah'] + keys_aktif
    result: dict = {}
    ada_prediksi = False
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Langkah 1: aktual
        cur.execute(
            f"SELECT {', '.join(kolom_sql)} FROM indikator_wilayah "
            f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
            (tahun,)
        )
        for row in cur.fetchall():
            prov = normalize_province_name(row['provinsi'])
            entry = {'sumber': 'aktual', 'kolom_prediksi': []}
            for k in keys_aktif:
                v = row.get(k)
                entry[k] = float(v) if v is not None else None
            result[prov] = entry

        # Langkah 2: prediksi sebagai fallback untuk NULL
        prov_null = {
            p: [k for k in keys_aktif if result[p].get(k) is None]
            for p in result
        }
        prov_null = {p: v for p, v in prov_null.items() if v}

        if not result:
            # Tidak ada data aktual sama sekali → ambil semua dari prediksi
            cur.execute(
                f"SELECT {', '.join(kolom_sql)} FROM prediksi_indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
                (tahun,)
            )
            for row in cur.fetchall():
                prov = normalize_province_name(row['provinsi'])
                entry = {'sumber': 'prediksi', 'kolom_prediksi': list(keys_aktif)}
                for k in keys_aktif:
                    v = row.get(k)
                    entry[k] = float(v) if v is not None else None
                result[prov] = entry
                ada_prediksi = True
        elif prov_null:
            # Ada beberapa kolom NULL → isi dari prediksi
            cur.execute(
                f"SELECT {', '.join(kolom_sql)} FROM prediksi_indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
                (tahun,)
            )
            pred_map = {normalize_province_name(r['provinsi']): r for r in cur.fetchall()}
            for prov, missing_keys in prov_null.items():
                pred_row = pred_map.get(prov)
                if not pred_row:
                    continue
                for k in missing_keys:
                    v = pred_row.get(k)
                    if v is not None:
                        result[prov][k] = float(v)
                        result[prov]['kolom_prediksi'].append(k)
                        ada_prediksi = True
                kp = result[prov]['kolom_prediksi']
                if kp:
                    result[prov]['sumber'] = (
                        'prediksi' if set(kp) == set(keys_aktif) else 'campuran'
                    )
        cur.close()
    except Exception as e:
        print(f"✗ fetch_data_from_db ISKA ({tahun}): {e}")
    finally:
        if conn:
            conn.close()
    return result, ada_prediksi


# ── INSIGHTS ──────────────────────────────────────────────────────────────────

def generate_insights(
    prov: str, row: dict, skor_prov: dict,
    iska_val: float, kat_label: str, indikator: str,
    sumber: str, kolom_prediksi: list,
) -> list:
    src = {
        'aktual':   '(Aktual BPS)',
        'prediksi': '(Prediksi Regresi Linear OLS)',
        'campuran': '(Aktual + Prediksi OLS)',
    }.get(sumber, '')
    insights = [f"Provinsi {prov} — ISKA {iska_val} → {kat_label} {src}."]

    if kolom_prediksi:
        nama_kol = ', '.join(LABEL_DIMENSI.get(k, k) for k in kolom_prediksi)
        insights.insert(1, f"⚙️ Data {nama_kol} diambil dari prediksi Regresi Linear (OLS).")

    keys_aktif = INDIKATOR_DATASET_MAP.get(indikator, KOLOM_AKTIF)
    for k in keys_aktif:
        s = skor_prov.get(f's_{k}')
        v = row.get(k)
        label = LABEL_DIMENSI.get(k, k)
        if s is None:
            continue
        ico = '✅' if s >= 66 else ('⚠️' if s >= 33 else '🚨')
        val_str = f"{v:,.2f}" if v is not None else 'N/A'
        insights.append(f"{ico} {label}: nilai={val_str} → Skor S={round(s, 2)}/100.")
    return insights


# ── KEBIJAKAN ─────────────────────────────────────────────────────────────────

def get_bank_kebijakan_by_kategori(kategori_key: str, limit: int = 10) -> list:
    """
    Ambil rekomendasi kebijakan dari bank_kebijakan untuk indeks ISKA
    berdasarkan kategori. Status di tabel disimpan sebagai string spasi
    (misal 'SANGAT TINGGI'), bukan underscore.
    """
    status_label = STATUS_KEBIJAKAN_MAP.get(kategori_key, kategori_key)
    prio_list    = PRIORITAS_BAND_MAP.get(kategori_key, [3, 4])
    results      = []
    conn         = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        ph   = ','.join(['%s'] * len(prio_list))
        cur.execute(
            f"SELECT id, status, prioritas, pilar_kebijakan, dimensi, isu_strategis, "
            f"kebijakan, rekomendasi_program, indikator_terkait "
            f"FROM bank_kebijakan "
            f"WHERE indeks='ISKA' AND status=%s AND prioritas IN ({ph}) "
            f"ORDER BY prioritas ASC, pilar_kebijakan ASC LIMIT %s",
            (status_label, *prio_list, limit)
        )
        rows = [dict(r) for r in cur.fetchall()]

        # Fallback jika kosong
        if not rows and kategori_key == 'SANGAT_TINGGI':
            cur.execute(
                "SELECT id, status, prioritas, pilar_kebijakan, dimensi, isu_strategis, "
                "kebijakan, rekomendasi_program, indikator_terkait "
                "FROM bank_kebijakan WHERE indeks='ISKA' AND status='TINGGI' "
                "ORDER BY prioritas ASC LIMIT %s",
                (limit,)
            )
            rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            cur.execute(
                "SELECT id, status, prioritas, pilar_kebijakan, dimensi, isu_strategis, "
                "kebijakan, rekomendasi_program, indikator_terkait "
                "FROM bank_kebijakan WHERE indeks='ISKA' AND status=%s "
                "ORDER BY prioritas ASC LIMIT %s",
                (status_label, limit)
            )
            rows = [dict(r) for r in cur.fetchall()]
        cur.close()

        # Kelompokkan per pilar
        pilar_map: dict = {}
        for row in rows:
            pilar = row.get('pilar_kebijakan') or 'Umum'
            pilar_map.setdefault(pilar, {
                'pilar':        pilar,
                'dimensi':      row.get('dimensi'),
                'prioritas':    row['prioritas'],
                'jumlah_aksi':  0,
                'aksi':         [],
            })
            pilar_map[pilar]['aksi'].append({
                'no_aksi':           len(pilar_map[pilar]['aksi']) + 1,
                'isu_strategis':     row['isu_strategis'],
                'nama_aksi':         row['kebijakan'],
                'detail_aksi':       row['rekomendasi_program'],
                'indikator_terkait': row['indikator_terkait'],
                'sub_sektor':        row.get('pilar_kebijakan'),
            })
            pilar_map[pilar]['jumlah_aksi'] += 1
        results = list(pilar_map.values())
    except Exception as e:
        print(f"✗ get_bank_kebijakan ISKA: {e}")
    finally:
        if conn:
            conn.close()
    return results


# ── API: CHECK DATA ───────────────────────────────────────────────────────────

@api_view(['POST'])
def check_iska_year_data(request):
    """
    Cek ketersediaan data ISKA untuk tahun tertentu.
    Selalu cek indikator_wilayah (aktual) dulu, lalu prediksi_indikator_wilayah.
    """
    tahun     = int(request.data.get('tahun', 2024))
    indikator = request.data.get('indikator', 'ALL')

    if tahun not in TAHUN_SEMUA:
        return Response({"error": f"Tahun {tahun} tidak didukung (2010–{TAHUN_MAX})."}, status=400)
    if indikator not in INDIKATOR_DATASET_MAP:
        indikator = 'ALL'

    keys_aktif = INDIKATOR_DATASET_MAP[indikator]
    dataset_status, ada_pred, semua = check_data_tersedia(tahun, keys_aktif)

    kolom_aktual   = [k for k, v in dataset_status.items() if v.get('sumber') == 'aktual']
    kolom_prediksi = [k for k, v in dataset_status.items() if v.get('perlu_prediksi')]
    kolom_kosong   = [k for k, v in dataset_status.items() if not v['tersedia']]

    pesan_peringatan = None
    if kolom_prediksi:
        nama_kolom = ', '.join(LABEL_DIMENSI.get(k, k) for k in kolom_prediksi)
        pesan_peringatan = (
            f"Data {nama_kolom} untuk tahun {tahun} tidak tersedia di database aktual BPS. "
            f"Sistem dapat menggunakan hasil prediksi model Regresi Linear (OLS) sebagai pengganti. "
            f"Klik 'Lanjutkan dengan Prediksi' untuk melanjutkan, atau pilih tahun lain."
        )

    ols_metrics = {}
    if ada_pred:
        all_meta    = _load_ols_metadata()
        ols_metrics = _build_ols_metrics(all_meta, kolom_prediksi)

    return Response({
        "tahun":            tahun,
        "indikator":        indikator,
        "dataset_status":   dataset_status,
        "kolom_aktual":     kolom_aktual,
        "kolom_prediksi":   kolom_prediksi,
        "kolom_kosong":     kolom_kosong,
        "ada_prediksi":     ada_pred,
        "semua_tersedia":   semua,
        "semua_aktual":     not ada_pred and semua,
        "bisa_dieksekusi":  semua,
        "pesan_peringatan": pesan_peringatan,
        "ols_metrics":      ols_metrics,
    })


# ── API: ANALYZE ──────────────────────────────────────────────────────────────

@api_view(['POST'])
def analyze_iska(request):
    """
    Analisis ISKA per provinsi.

    Metodologi:
      1. Ambil nilai raw: padi (Ku/Ha), hortikultura (Kw), ttplahan (Ha),
         hahutan (M³), kebun (Ton), ikan (Ton), proktam (Miliar Rp).
      2. Min-Max Normalisasi lintas 38 provinsi → Si ∈ [0, 100].
         Nilai 0 / kosong = tidak ada produksi, tetap disertakan.
      3. ISKA = Σ(Wi × Si), default Wi = 1/7 (sama rata).
      4. Klasifikasi: ≥75 SANGAT TINGGI, ≥50 TINGGI, ≥25 SEDANG, <25 RENDAH.

    Parameter request:
      tahun            : int  (default 2024)
      indikator        : str  (default 'ALL')
      gunakan_prediksi : bool (wajib True jika ada kolom prediksi)
      bobot            : dict {kolom: float} opsional — override bobot default
    """
    try:
        tahun            = int(request.data.get('tahun', 2024))
        indikator        = request.data.get('indikator', 'ALL')
        gunakan_prediksi = request.data.get('gunakan_prediksi', False)
        bobot_override   = request.data.get('bobot', {})  # opsional

        if indikator not in INDIKATOR_DATASET_MAP:
            indikator = 'ALL'
        if tahun not in TAHUN_SEMUA:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)

        keys_aktif = INDIKATOR_DATASET_MAP[indikator]

        # Validasi prediksi
        _, ada_pred_check, _ = check_data_tersedia(tahun, keys_aktif)
        if ada_pred_check and not gunakan_prediksi:
            return Response({
                "error": "Ada kolom yang memerlukan data prediksi. "
                         "Kirim gunakan_prediksi=true untuk melanjutkan.",
                "ada_prediksi": True,
            }, status=400)

        # Ambil data raw
        db_data, ada_prediksi = fetch_data_from_db(tahun, keys_aktif)
        if not db_data:
            return Response({"error": f"Tidak ada data untuk tahun {tahun}."}, status=404)

        # Bobot
        bobot = {k: BOBOT_DEFAULT[k] for k in keys_aktif}
        # Normalisasi ulang agar Σ bobot = 1 untuk subset
        total_w = sum(bobot.values())
        bobot   = {k: v / total_w for k, v in bobot.items()}
        # Override bobot jika dikirim
        if bobot_override:
            for k, w in bobot_override.items():
                if k in bobot:
                    bobot[k] = float(w)
            total_w = sum(bobot.values())
            if total_w > 0:
                bobot = {k: v / total_w for k, v in bobot.items()}

        # OLS metrics
        ols_metrics = {}
        if ada_prediksi:
            all_meta    = _load_ols_metadata()
            ols_metrics = _build_ols_metrics(all_meta, keys_aktif)

        # Min-Max Normalisasi lintas semua provinsi
        # Siapkan dict nilai raw: {prov: {kolom: nilai}}
        raw_dict = {prov: {k: row.get(k) for k in KOLOM_AKTIF} for prov, row in db_data.items()}
        skor_all  = minmax_normalize(raw_dict)

        # Batas provinsi dari MongoDB
        boundary_features = list(mongo_db["batas_provinsi"].find({}, {'_id': 0}))
        province_map: dict = {}
        for feat in boundary_features:
            props = feat.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    for nv in [
                        str(props[field]).upper().strip(),
                        normalize_province_name(str(props[field])),
                    ]:
                        province_map[nv] = feat

        all_boundary_names: set = set()
        for feat in boundary_features:
            props = feat.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    all_boundary_names.add(normalize_province_name(str(props[field])))
                    break

        all_provs        = all_boundary_names | set(db_data.keys())
        matched_features = []
        analysis_summary = []
        iska_data_xlsx   = {}
        kategori_counts  = {
            'SANGAT_TINGGI': 0, 'TINGGI': 0,
            'SEDANG': 0, 'RENDAH': 0, 'TIDAK_TERANALISIS': 0,
        }
        kebijakan_cache: dict = {}

        for prov_name in sorted(all_provs):
            row  = db_data.get(prov_name)
            norm = normalize_province_name(prov_name)
            matched_feature = (
                province_map.get(norm)
                or province_map.get(prov_name)
                or next(
                    (f for mn, f in province_map.items() if norm in mn or mn in norm),
                    None,
                )
            )
            if not matched_feature:
                continue

            has_data = row is not None and any(row.get(k) is not None for k in keys_aktif)

            if not has_data:
                kategori_counts['TIDAK_TERANALISIS'] += 1
                fc = matched_feature.copy()
                pc = fc.get('properties', {}).copy()
                pc['iska_analysis'] = {
                    'nama_provinsi':  prov_name,
                    'indikator':      indikator,
                    'kategori':       'TIDAK_TERANALISIS',
                    'kategori_label': 'TIDAK TERANALISIS',
                    'warna':          WARNA_MAP['TIDAK_TERANALISIS'],
                    'iska':           None,
                    'skor_dimensi':   {f's_{k}': None for k in KOLOM_AKTIF},
                    'data_raw':       {k: None for k in KOLOM_AKTIF},
                    'insights':       [f"Provinsi {prov_name} tidak memiliki data untuk tahun {tahun}."],
                    'rekomendasi':    [],
                    'sumber':         'tidak_tersedia',
                    'kolom_prediksi': [],
                }
                fc['properties'] = pc
                matched_features.append(fc)
                analysis_summary.append({
                    'provinsi':      prov_name,
                    'indikator':     indikator,
                    'kategori':      'TIDAK_TERANALISIS',
                    'kategori_label':'TIDAK TERANALISIS',
                    'warna':         WARNA_MAP['TIDAK_TERANALISIS'],
                    'iska':          None,
                    'skor_dimensi':  {f's_{k}': None for k in KOLOM_AKTIF},
                    'data_raw':      {k: None for k in KOLOM_AKTIF},
                    'sumber':        'tidak_tersedia',
                    'kolom_prediksi': [],
                })
                continue

            sumber     = row.get('sumber', 'aktual')
            kolom_pred = row.get('kolom_prediksi', [])

            # Ambil skor hasil normalisasi lintas provinsi
            skor_prov = skor_all.get(prov_name, {})

            # Hitung ISKA
            hasil    = hitung_iska(skor_prov, bobot, keys_aktif)
            iska_val = hasil['iska']

            kat_key, warna, kat_label = kategorisasi(iska_val)
            insights = generate_insights(
                prov_name, row, hasil,
                iska_val, kat_label, indikator,
                sumber, kolom_pred,
            )

            # Kebijakan
            ck = kat_key
            if ck not in kebijakan_cache:
                kebijakan_cache[ck] = get_bank_kebijakan_by_kategori(kat_key, 10)
            rekomendasi = kebijakan_cache[ck]
            kategori_counts[kat_key] = kategori_counts.get(kat_key, 0) + 1

            skor_dimensi = {f's_{k}': hasil.get(f's_{k}') for k in KOLOM_AKTIF}
            data_raw     = {k: row.get(k) for k in KOLOM_AKTIF}

            fc = matched_feature.copy()
            pc = fc.get('properties', {}).copy()
            pc['iska_analysis'] = {
                'nama_provinsi':  prov_name,
                'indikator':      indikator,
                'kategori':       kat_key,
                'kategori_label': kat_label,
                'warna':          warna,
                'iska':           iska_val,
                'skor_dimensi':   skor_dimensi,
                'data_raw':       data_raw,
                'bobot':          bobot,
                'insights':       insights,
                'rekomendasi':    rekomendasi,
                'sumber':         sumber,
                'kolom_prediksi': kolom_pred,
                'ols_metrics':    {k: ols_metrics.get(k) for k in kolom_pred} if kolom_pred else {},
            }
            fc['properties'] = pc
            matched_features.append(fc)

            summary_row = {
                'provinsi':      prov_name,
                'indikator':     indikator,
                'kategori':      kat_key,
                'kategori_label': kat_label,
                'warna':         warna,
                'iska':          iska_val,
                'skor_dimensi':  skor_dimensi,
                'data_raw':      data_raw,
                'sumber':        sumber,
                'kolom_prediksi': kolom_pred,
            }
            analysis_summary.append(summary_row)
            iska_data_xlsx[prov_name] = summary_row.copy()

        sorted_summary = sorted(
            [s for s in analysis_summary if s['iska'] is not None],
            key=lambda x: x['iska'],
        )

        semua_sumber = set(
            s.get('sumber') for s in analysis_summary
            if s.get('sumber') not in (None, 'tidak_tersedia')
        )
        if semua_sumber == {'aktual'}:
            source_label = 'indikator_wilayah (Aktual BPS)'
        elif 'aktual' in semua_sumber:
            source_label = 'indikator_wilayah (Aktual) + prediksi_indikator_wilayah (Fallback Regresi Linear OLS)'
        else:
            source_label = 'prediksi_indikator_wilayah (Regresi Linear / Ordinary Least Squares)'

        return Response({
            'status':    'success',
            'source':    source_label,
            'tahun':     tahun,
            'indikator': indikator,
            'ada_prediksi':   ada_prediksi,
            'dataset_aktif':  keys_aktif,
            'total_success':           len([s for s in analysis_summary if s['kategori'] != 'TIDAK_TERANALISIS']),
            'total_tidak_teranalisis': kategori_counts['TIDAK_TERANALISIS'],
            'kategori_distribusi': kategori_counts,
            'timestamp': datetime.now().isoformat(),
            'metodologi': {
                'nama':        'Indeks Sumber Kekayaan Alam (ISKA)',
                'formula':     'ISKA = Σ(Wi × Si), dengan Si = Min-Max Normalisasi lintas 38 provinsi',
                'normalisasi': 'Si = [(X - Xmin) / (Xmax - Xmin)] × 100',
                'bobot':       'Wi berbasis kontribusi PDRB sektoral (default: sama rata 1/7)',
                'dimensi':     {k: {'label': LABEL_DIMENSI[k], 'dimensi': DIMENSI_MAP[k]} for k in KOLOM_AKTIF},
            },
            'bobot_digunakan': bobot,
            'klasifikasi': {
                k: {'warna': WARNA_MAP[k], 'label': LABEL_MAP[k]}
                for k in ['SANGAT_TINGGI', 'TINGGI', 'SEDANG', 'RENDAH', 'TIDAK_TERANALISIS']
            },
            'ols_metrics':      ols_metrics,
            'matched_features': {'type': 'FeatureCollection', 'features': matched_features},
            'analysis_summary': analysis_summary,
            'iska_data':        iska_data_xlsx,
            'worst_provinces':  sorted_summary[:5],
            'best_provinces':   sorted_summary[-5:][::-1],
            'colors':           WARNA_MAP,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e), "message": "Gagal menganalisis data ISKA"}, status=500)


# ── BANK KEBIJAKAN CRUD ───────────────────────────────────────────────────────

def _k_row(r: dict) -> dict:
    return {
        "id":             r["id"],
        "status":         r["status"],
        "prioritas":      r["prioritas"],
        "dimensi":        r.get("dimensi"),
        "pilar":          r["pilar_kebijakan"],
        "kebijakan":      r["kebijakan"],
        "rekomendasi":    r["rekomendasi_program"],
        "indikator":      r["indikator_terkait"],
        "isu_strategis":  r.get("isu_strategis"),
        "dasar_hukum":    r.get("dasar_hukum"),
    }


@api_view(['GET'])
def get_bank_kebijakan_iska(request):
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q      = ("SELECT id, indeks, status, prioritas, pilar_kebijakan, dimensi, "
                  "isu_strategis, kebijakan, rekomendasi_program, indikator_terkait, dasar_hukum "
                  "FROM bank_kebijakan WHERE indeks='ISKA'")
        params = []
        sf     = request.GET.get('status', '').upper()
        pf     = request.GET.get('pilar', '')
        df     = request.GET.get('dimensi', '')
        if sf:
            q += " AND status=%s"; params.append(sf)
        if pf:
            q += " AND pilar_kebijakan ILIKE %s"; params.append(f"%{pf}%")
        if df:
            q += " AND dimensi ILIKE %s"; params.append(f"%{df}%")
        q += " ORDER BY status ASC, prioritas ASC, pilar_kebijakan ASC"
        cur.execute(q, params)
        hasil = [_k_row(dict(r)) for r in cur.fetchall()]
        cur.close()
        return Response({"status": "success", "count": len(hasil), "results": hasil})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn:
            conn.close()


@api_view(['POST'])
def add_bank_kebijakan_iska(request):
    conn = None
    try:
        data = request.data
        for f in ['status', 'prioritas', 'pilar_kebijakan', 'kebijakan', 'rekomendasi_program', 'indikator_terkait']:
            if not data.get(f):
                return Response({"error": f"Field '{f}' wajib."}, status=400)
        status = data['status'].upper().replace('_', ' ')   # normalkan ke spasi
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO bank_kebijakan("
            "indeks, status, prioritas, pilar_kebijakan, dimensi, isu_strategis, "
            "kebijakan, rekomendasi_program, indikator_terkait, dasar_hukum"
            ") VALUES('ISKA',%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (
                status,
                int(data['prioritas']),
                data['pilar_kebijakan'],
                data.get('dimensi', ''),
                data.get('isu_strategis', ''),
                data['kebijakan'],
                data['rekomendasi_program'],
                data['indikator_terkait'],
                data.get('dasar_hukum', ''),
            )
        )
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        return Response({"status": "success", "id": new_id})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn:
            conn.close()


@api_view(['PUT'])
def update_bank_kebijakan_iska(request, kebijakan_id):
    conn = None
    try:
        d      = request.data
        status = d.get('status', '').upper().replace('_', ' ')
        conn   = get_pg_connection()
        cur    = conn.cursor()
        cur.execute(
            "UPDATE bank_kebijakan SET "
            "status=%s, prioritas=%s, pilar_kebijakan=%s, dimensi=%s, "
            "isu_strategis=%s, kebijakan=%s, rekomendasi_program=%s, "
            "indikator_terkait=%s, dasar_hukum=%s "
            "WHERE id=%s AND indeks='ISKA'",
            (
                status,
                int(d['prioritas']),
                d['pilar_kebijakan'],
                d.get('dimensi', ''),
                d.get('isu_strategis', ''),
                d['kebijakan'],
                d['rekomendasi_program'],
                d['indikator_terkait'],
                d.get('dasar_hukum', ''),
                kebijakan_id,
            )
        )
        if cur.rowcount == 0:
            return Response({"error": "Tidak ditemukan."}, status=404)
        conn.commit()
        cur.close()
        return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn:
            conn.close()


@api_view(['DELETE'])
def delete_bank_kebijakan_iska(request, kebijakan_id):
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute("DELETE FROM bank_kebijakan WHERE id=%s AND indeks='ISKA'", (kebijakan_id,))
        if cur.rowcount == 0:
            return Response({"error": "Tidak ditemukan."}, status=404)
        conn.commit()
        cur.close()
        return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn:
            conn.close()


# ── SIMPAN / AMBIL ANALISIS ───────────────────────────────────────────────────

@api_view(['POST'])
def save_iska_analysis(request):
    try:
        name = request.data.get('name', 'Analisis ISKA')
        data = request.data.get('analysis_data')
        if not data:
            return Response({"error": "Data tidak ditemukan"}, status=400)
        analysis_id = str(uuid.uuid4())
        doc = {
            "analysis_id": analysis_id,
            "name":        name,
            "type":        "iska",
            "timestamp":   datetime.now().isoformat(),
            **data,
        }
        mongo_db["iska_analysis"].insert_one(doc)
        return Response({
            "status":      "success",
            "analysis_id": analysis_id,
            "saved_at":    doc["timestamp"],
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_iska_analysis_list(request):
    try:
        results = list(
            mongo_db["iska_analysis"].find(
                {},
                {
                    "_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
                    "total_success": 1, "kategori_distribusi": 1,
                    "tahun": 1, "indikator": 1, "ada_prediksi": 1,
                }
            ).sort("timestamp", -1)
        )
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_iska_analysis_detail(request, analysis_id):
    try:
        result = mongo_db["iska_analysis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not result:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_iska_analysis(request, analysis_id):
    try:
        result = mongo_db["iska_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['PATCH'])
def patch_provinsi_kebijakan_iska(request, analysis_id):
    """Update rekomendasi kebijakan per provinsi pada hasil analisis tersimpan."""
    try:
        nama_provinsi = request.data.get('nama_provinsi', '').strip().upper()
        rekomendasi   = request.data.get('rekomendasi')
        if not nama_provinsi:
            return Response({'error': 'nama_provinsi wajib.'}, status=400)
        if not isinstance(rekomendasi, list):
            return Response({'error': 'rekomendasi harus array.'}, status=400)

        doc = mongo_db['iska_analysis'].find_one({'analysis_id': analysis_id})
        if not doc:
            return Response({'error': 'Tidak ditemukan.'}, status=404)

        features = doc.get('matched_features', {}).get('features', [])
        updated  = False
        now      = datetime.now().isoformat()
        for feat in features:
            sdm = feat.get('properties', {}).get('iska_analysis', {})
            if sdm.get('nama_provinsi', '').upper().strip() == nama_provinsi:
                sdm.update({
                    'rekomendasi':           rekomendasi,
                    'rekomendasi_edited':    True,
                    'rekomendasi_edited_at': now,
                })
                feat['properties']['iska_analysis'] = sdm
                updated = True
                break

        if not updated:
            return Response({'error': f'Provinsi "{nama_provinsi}" tidak ditemukan.'}, status=404)

        summary = doc.get('analysis_summary', [])
        for s in summary:
            if s.get('provinsi', '').upper().strip() == nama_provinsi:
                s['rekomendasi_edited'] = True
                break

        mongo_db['iska_analysis'].update_one(
            {'analysis_id': analysis_id},
            {'$set': {
                'matched_features.features': features,
                'analysis_summary':          summary,
                f'edits.{nama_provinsi.replace(" ", "_")}': {
                    'updated_at':  now,
                    'pilar_count': len(rekomendasi),
                },
            }}
        )
        return Response({
            'status':      'success',
            'provinsi':    nama_provinsi,
            'pilar_count': len(rekomendasi),
            'updated_at':  now,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)


# ── INFO MODEL OLS ────────────────────────────────────────────────────────────

@api_view(['GET'])
def get_ols_model_info_iska(request):
    """Informasi model Regresi Linear OLS yang digunakan untuk prediksi dimensi ISKA."""
    all_meta    = _load_ols_metadata()
    ols_metrics = _build_ols_metrics(all_meta, KOLOM_AKTIF)
    return Response({
        "status":     "success",
        "model":      "Regresi Linear (Ordinary Least Squares)",
        "deskripsi":  "Model prediksi per dimensi ISKA untuk tahun di luar rentang data aktual BPS.",
        "dimensi":    {k: LABEL_DIMENSI[k] for k in KOLOM_AKTIF},
        "model_info": ols_metrics,
        "timestamp":  datetime.now().isoformat(),
    })


@api_view(['GET'])
def get_bank_kebijakan_iska_for_provinsi(request):
    """
    Ambil semua kebijakan ISKA, dikelompokkan per pilar,
    opsional filter by status dan dimensi.
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q      = ("SELECT id, status, prioritas, pilar_kebijakan, dimensi, isu_strategis, "
                  "kebijakan, rekomendasi_program, indikator_terkait, dasar_hukum "
                  "FROM bank_kebijakan WHERE indeks='ISKA'")
        params = []
        sf     = request.GET.get('status', '').strip()
        df     = request.GET.get('dimensi', '').strip()
        if sf:
            q += " AND status=%s"; params.append(sf)
        if df:
            q += " AND dimensi ILIKE %s"; params.append(f"%{df}%")
        q += " ORDER BY status ASC, prioritas ASC, pilar_kebijakan ASC"
        cur.execute(q, params)
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()

        pilar_map: dict = {}
        for r in rows:
            p = r['pilar_kebijakan'] or 'Umum'
            pilar_map.setdefault(p, []).append({
                'id':                r['id'],
                'status':            r['status'],
                'prioritas':         r['prioritas'],
                'dimensi':           r.get('dimensi'),
                'pilar':             p,
                'isu_strategis':     r['isu_strategis'],
                'kebijakan':         r['kebijakan'],
                'rekomendasi':       r['rekomendasi_program'],
                'indikator_terkait': r['indikator_terkait'],
                'dasar_hukum':       r.get('dasar_hukum'),
            })
        return Response({
            'status':   'success',
            'count':    len(rows),
            'by_pilar': [{'pilar': p, 'items': items} for p, items in sorted(pilar_map.items())],
            'flat':     [
                {
                    'id':                r['id'],
                    'status':            r['status'],
                    'prioritas':         r['prioritas'],
                    'dimensi':           r.get('dimensi'),
                    'pilar':             r['pilar_kebijakan'] or 'Umum',
                    'isu_strategis':     r['isu_strategis'],
                    'kebijakan':         r['kebijakan'],
                    'rekomendasi':       r['rekomendasi_program'],
                    'indikator_terkait': r['indikator_terkait'],
                    'dasar_hukum':       r.get('dasar_hukum'),
                }
                for r in rows
            ],
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn:
            conn.close()