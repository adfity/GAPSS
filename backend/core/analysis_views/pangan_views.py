from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import psycopg2, psycopg2.extras
import uuid, os, json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env')))

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
mongo_db      = MongoClient(MONGO_URI)[DB_MONGO_NAME]
METADATA_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ai_models', 'pangan')


def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"),
    )


# ── PARAMETER IKP BAPANAS ─────────────────────────────────────────────────────
BOBOT_KETERSEDIAAN   = 0.335
BOBOT_KETERJANGKAUAN = 0.330
BOBOT_PEMANFAATAN    = 0.335

TAHUN_SEMUA = list(range(2020, 2046))
TAHUN_MAX   = 2045

DB_COL_MAP = {
    'KETERSEDIAAN':   'ketersediaan',
    'KETERJANGKAUAN': 'keterjangkauan',
    'PEMANFAATAN':    'pemanfaatan',
}

LABEL_KOLOM = {
    'KETERSEDIAAN':   'Skor Ketersediaan Pangan',
    'KETERJANGKAUAN': 'Skor Keterjangkauan Pangan',
    'PEMANFAATAN':    'Skor Pemanfaatan Pangan',
}

# Status key pakai underscore (konsisten dengan DB bank_kebijakan)
STATUS_KEY_MAP = {
    'SANGAT RENTAN': 'SANGAT_RENTAN',
    'RENTAN':        'RENTAN',
    'AGAK RENTAN':   'AGAK_RENTAN',
    'AGAK TAHAN':    'AGAK_TAHAN',
    'TAHAN':         'TAHAN',
    'SANGAT TAHAN':  'SANGAT_TAHAN',
}

WARNA_MAP = {
    'SANGAT_RENTAN':    '#6e1f1f',
    'RENTAN':           '#e85961',
    'AGAK_RENTAN':      '#f4a1a7',
    'AGAK_TAHAN':       '#c9e077',
    'TAHAN':            '#94c945',
    'SANGAT_TAHAN':     '#3b703b',
    'TIDAK_TERANALISIS':'#a6a6a6',
}

LABEL_MAP = {
    'SANGAT_RENTAN':    'SANGAT RENTAN',
    'RENTAN':           'RENTAN',
    'AGAK_RENTAN':      'AGAK RENTAN',
    'AGAK_TAHAN':       'AGAK TAHAN',
    'TAHAN':            'TAHAN',
    'SANGAT_TAHAN':     'SANGAT TAHAN',
    'TIDAK_TERANALISIS':'TIDAK TERANALISIS',
}

STATUS_VALID = ('SANGAT_RENTAN', 'RENTAN', 'AGAK_RENTAN', 'AGAK_TAHAN', 'TAHAN', 'SANGAT_TAHAN')

# Prioritas band per kategori (untuk query bank_kebijakan)
PRIORITAS_BAND_MAP = {
    'SANGAT_RENTAN': [1],
    'RENTAN':        [1, 2],
    'AGAK_RENTAN':   [2, 3],
    'AGAK_TAHAN':    [3, 4],
    'TAHAN':         [4, 5],
    'SANGAT_TAHAN':  [5, 6],
}

KEYS_AKTIF = ['KETERSEDIAAN', 'KETERJANGKAUAN', 'PEMANFAATAN']


# ── METADATA MODEL PREDIKSI ───────────────────────────────────────────────────
def _load_ols_metadata():
    """
    Load metadata model Regresi Linear OLS untuk ketiga aspek IKP.
    File: ketersediaan_metadata.json, keterjangkauan_metadata.json, pemanfaatan_metadata.json
    """
    files = {
        'KETERSEDIAAN':   'ketersediaan_metadata.json',
        'KETERJANGKAUAN': 'keterjangkauan_metadata.json',
        'PEMANFAATAN':    'pemanfaatan_metadata.json',
    }
    result = {}
    for key, fname in files.items():
        path = os.path.join(METADATA_DIR, fname)
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    result[key] = json.load(f)
            except Exception as e:
                print(f"✗ metadata pangan {fname}: {e}")
    return result


def _build_ols_metrics(meta_dict, keys_prediksi):
    """
    Bangun dict ringkasan metrik model OLS untuk kolom-kolom yang pakai prediksi.
    Struktur output selaras dengan sdm_views._build_ols_metrics().
    """
    metrics = {}
    for k in keys_prediksi:
        m = meta_dict.get(k)
        if not m:
            continue
        ev   = m.get('evaluasi_ringkasan', {})
        mape = ev.get('rata_rata_MAPE_pct')
        metrics[k] = {
            'model':            m.get('nama_model', 'Regresi Linear OLS (Ordinary Least Squares)'),
            'metode':           m.get('metode', 'Regresi Linear OLS (Ordinary Least Squares)'),
            'indikator':        m.get('indikator'),
            'satuan':           m.get('satuan'),
            'tahun_training':   m.get('tahun_training'),
            'tahun_prediksi':   m.get('tahun_prediksi'),
            'jumlah_wilayah':   m.get('jumlah_wilayah'),
            'jumlah_gagal':     m.get('jumlah_gagal', 0),
            'tanggal_pembuatan':m.get('tanggal_pembuatan'),
            'strategi_evaluasi':m.get('strategi_evaluasi', {}).get('metode'),
            'mape_pct':         mape,
            'mae_poin':         ev.get('rata_rata_MAE_poin'),
            'rmse_poin':        ev.get('rata_rata_RMSE_poin'),
            'median_mape_pct':  ev.get('median_MAPE_pct'),
            'quality':          _quality_label(mape),
            'clamp_info': {
                'floor':          m.get('clamp_info', {}).get('floor', 0.0),
                'cap':            m.get('clamp_info', {}).get('cap', 100.0),
                'jumlah_wilayah': m.get('clamp_info', {}).get('jumlah_wilayah'),
            },
        }
    return metrics


def _quality_label(mape):
    """Grade kualitas model OLS berdasarkan MAPE (%) — threshold selaras sdm_views."""
    if mape is None:
        return {'grade': '?',  'label': 'Tidak Diketahui', 'color': '#94a3b8'}
    if mape < 2:
        return {'grade': '🥇', 'label': 'Sangat Baik',     'color': '#10b981'}
    if mape < 5:
        return {'grade': '✅', 'label': 'Baik',             'color': '#3b82f6'}
    if mape < 10:
        return {'grade': '⚠️', 'label': 'Cukup',           'color': '#f59e0b'}
    return     {'grade': '❌', 'label': 'Perlu Perhatian',  'color': '#ef4444'}



# ── FORMULA IKP ───────────────────────────────────────────────────────────────
def hitung_ikp(ketersediaan, keterjangkauan, pemanfaatan):
    """
    Hitung IKP dari tiga skor aspek (skala 0–100).
    Return dict lengkap dengan nilai komponen dan IKP akhir.
    """
    komponen = {
        'ketersediaan':   float(ketersediaan)   if ketersediaan   is not None else None,
        'keterjangkauan': float(keterjangkauan) if keterjangkauan is not None else None,
        'pemanfaatan':    float(pemanfaatan)    if pemanfaatan    is not None else None,
    }

    tersedia = {k: v for k, v in komponen.items() if v is not None}
    if not tersedia:
        return {**komponen, 'ikp': None}

    # Jika semua tersedia → hitung penuh
    if len(tersedia) == 3:
        ikp = round(
            komponen['ketersediaan']   * BOBOT_KETERSEDIAAN +
            komponen['keterjangkauan'] * BOBOT_KETERJANGKAUAN +
            komponen['pemanfaatan']    * BOBOT_PEMANFAATAN,
            2
        )
    else:
        # Partial: normalisasi bobot proporsional
        bobot_map = {
            'ketersediaan':   BOBOT_KETERSEDIAAN,
            'keterjangkauan': BOBOT_KETERJANGKAUAN,
            'pemanfaatan':    BOBOT_PEMANFAATAN,
        }
        total_bobot = sum(bobot_map[k] for k in tersedia)
        ikp = round(
            sum(tersedia[k] * bobot_map[k] for k in tersedia) / total_bobot * 1.0,
            2
        ) if total_bobot > 0 else None

    return {**komponen, 'ikp': ikp}


def kategorisasi(ikp_nilai):
    """
    Klasifikasi IKP ke 6 prioritas Bapanas.
    Return (status_key, warna, label)
    """
    if ikp_nilai is None:
        return 'TIDAK_TERANALISIS', WARNA_MAP['TIDAK_TERANALISIS'], LABEL_MAP['TIDAK_TERANALISIS']
    if ikp_nilai < 45.60:
        return 'SANGAT_RENTAN', WARNA_MAP['SANGAT_RENTAN'], LABEL_MAP['SANGAT_RENTAN']
    if ikp_nilai <= 53.42:
        return 'RENTAN', WARNA_MAP['RENTAN'], LABEL_MAP['RENTAN']
    if ikp_nilai <= 61.47:
        return 'AGAK_RENTAN', WARNA_MAP['AGAK_RENTAN'], LABEL_MAP['AGAK_RENTAN']
    if ikp_nilai <= 69.52:
        return 'AGAK_TAHAN', WARNA_MAP['AGAK_TAHAN'], LABEL_MAP['AGAK_TAHAN']
    if ikp_nilai <= 77.35:
        return 'TAHAN', WARNA_MAP['TAHAN'], LABEL_MAP['TAHAN']
    return 'SANGAT_TAHAN', WARNA_MAP['SANGAT_TAHAN'], LABEL_MAP['SANGAT_TAHAN']

def get_prioritas_number(status_key):
    mapping = {
        'SANGAT_RENTAN': 1,
        'RENTAN':        2,
        'AGAK_RENTAN':   3,
        'AGAK_TAHAN':    4,
        'TAHAN':         5,
        'SANGAT_TAHAN':  6,
    }
    return mapping.get(status_key)


# ── NORMALIZER ────────────────────────────────────────────────────────────────
def normalize_province_name(name):
    name = str(name)
    for tag in ['<b>', '</b>', '<B>', '</B>']:
        name = name.replace(tag, '')
    name = name.upper().strip()
    SPECIAL = {
        'DKI JAKARTA':                    'JAKARTA',
        'DAERAH KHUSUS IBUKOTA JAKARTA':  'JAKARTA',
        'YOGYAKARTA':                     'DAERAH ISTIMEWA YOGYAKARTA',
        'DIY':                            'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA':                'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG':                'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG':           'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU':                      'KEPULAUAN RIAU',
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


# ── DB CHECK & FETCH ──────────────────────────────────────────────────────────
def check_data_tersedia(tahun):
    """
    Cek ketersediaan data untuk tahun tertentu.
    Prioritas: indikator_wilayah → prediksi_indikator_wilayah (fallback).
    """
    dataset_status = {}
    ada_prediksi   = False
    conn = None
    try:
        conn = get_pg_connection()
        for k in KEYS_AKTIF:
            col = DB_COL_MAP[k]

            cur = conn.cursor()
            cur.execute(
                f"SELECT COUNT(*) FROM indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' AND {col} IS NOT NULL",
                (tahun,)
            )
            cnt_aktual = cur.fetchone()[0]
            cur.close()

            if cnt_aktual > 0:
                dataset_status[k] = {
                    'label':           LABEL_KOLOM[k],
                    'tersedia':        True,
                    'perlu_prediksi':  False,
                    'sumber':          'aktual',
                    'jumlah_aktual':   cnt_aktual,
                    'jumlah_prediksi': 0,
                    'tabel':           'indikator_wilayah',
                }
            else:
                cur2 = conn.cursor()
                cur2.execute(
                    f"SELECT COUNT(*) FROM prediksi_indikator_wilayah "
                    f"WHERE tahun=%s AND level='provinsi' AND {col} IS NOT NULL",
                    (tahun,)
                )
                cnt_pred = cur2.fetchone()[0]
                cur2.close()

                if cnt_pred > 0:
                    ada_prediksi = True
                    dataset_status[k] = {
                        'label':           LABEL_KOLOM[k],
                        'tersedia':        True,
                        'perlu_prediksi':  True,
                        'sumber':          'prediksi',
                        'jumlah_aktual':   0,
                        'jumlah_prediksi': cnt_pred,
                        'tabel':           'prediksi_indikator_wilayah',
                    }
                else:
                    dataset_status[k] = {
                        'label':           LABEL_KOLOM[k],
                        'tersedia':        False,
                        'perlu_prediksi':  False,
                        'sumber':          None,
                        'jumlah_aktual':   0,
                        'jumlah_prediksi': 0,
                        'tabel':           '-',
                    }
    except Exception as e:
        for k in KEYS_AKTIF:
            dataset_status[k] = {
                'label': LABEL_KOLOM[k], 'tersedia': False, 'perlu_prediksi': False,
                'sumber': None, 'jumlah_aktual': 0, 'jumlah_prediksi': 0,
                'tabel': '-', 'error': str(e),
            }
    finally:
        if conn:
            conn.close()

    semua_tersedia = all(v['tersedia'] for v in dataset_status.values())
    return dataset_status, ada_prediksi, semua_tersedia


def fetch_data_from_db(tahun):
    """
    Ambil data ketersediaan/keterjangkauan/pemanfaatan dari DB.
    Prioritas: indikator_wilayah → prediksi_indikator_wilayah (fallback NULL).
    Return (dict{prov_name: entry}, ada_prediksi)
    """
    kolom_sql = ['provinsi', 'kode_wilayah', 'wilayah',
                 'ketersediaan', 'keterjangkauan', 'pemanfaatan']
    result = {}
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
            entry = {
                'sumber':          'aktual',
                'kolom_prediksi':  [],
                'wilayah':         row.get('wilayah'),
                'KETERSEDIAAN':    float(row['ketersediaan'])   if row.get('ketersediaan')   is not None else None,
                'KETERJANGKAUAN':  float(row['keterjangkauan']) if row.get('keterjangkauan') is not None else None,
                'PEMANFAATAN':     float(row['pemanfaatan'])    if row.get('pemanfaatan')    is not None else None,
            }
            result[prov] = entry

        # Langkah 2: prediksi sebagai fallback untuk NULL
        prov_null = {
            p: [k for k in KEYS_AKTIF if result[p].get(k) is None]
            for p in result
        }
        prov_null = {p: v for p, v in prov_null.items() if v}

        if not result:
            # Tidak ada data aktual sama sekali → pakai semua dari prediksi
            cur.execute(
                f"SELECT {', '.join(kolom_sql)} FROM prediksi_indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
                (tahun,)
            )
            for row in cur.fetchall():
                prov = normalize_province_name(row['provinsi'])
                entry = {
                    'sumber':          'prediksi',
                    'kolom_prediksi':  list(KEYS_AKTIF),
                    'wilayah':         row.get('wilayah'),
                    'KETERSEDIAAN':    float(row['ketersediaan'])   if row.get('ketersediaan')   is not None else None,
                    'KETERJANGKAUAN':  float(row['keterjangkauan']) if row.get('keterjangkauan') is not None else None,
                    'PEMANFAATAN':     float(row['pemanfaatan'])    if row.get('pemanfaatan')    is not None else None,
                }
                result[prov] = entry
                ada_prediksi = True

        elif prov_null:
            # Ada beberapa provinsi dengan kolom NULL → isi dari prediksi
            cur.execute(
                f"SELECT {', '.join(kolom_sql)} FROM prediksi_indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
                (tahun,)
            )
            pred_map = {
                normalize_province_name(r['provinsi']): r
                for r in cur.fetchall()
            }
            for prov, missing_keys in prov_null.items():
                pred_row = pred_map.get(prov)
                if not pred_row:
                    continue
                for k in missing_keys:
                    val = pred_row.get(DB_COL_MAP[k])
                    if val is not None:
                        result[prov][k] = float(val)
                        result[prov]['kolom_prediksi'].append(k)
                        ada_prediksi = True
                kp = result[prov]['kolom_prediksi']
                if kp:
                    result[prov]['sumber'] = (
                        'prediksi' if set(kp) == set(KEYS_AKTIF) else 'campuran'
                    )

        cur.close()
    except Exception as e:
        print(f"✗ fetch_data_from_db IKP ({tahun}): {e}")
    finally:
        if conn:
            conn.close()
    return result, ada_prediksi


# ── INSIGHTS ──────────────────────────────────────────────────────────────────
def generate_insights(prov, scores, kat_label, ikp_nilai, sumber, kolom_prediksi):
    src = {
        'aktual':   '(Aktual Bapanas)',
        'prediksi': '(Prediksi)',
        'campuran': '(Aktual+Prediksi)',
    }.get(sumber, '')

    insights = [f"Provinsi {prov} — IKP {ikp_nilai} → {kat_label} {src}."]

    if kolom_prediksi:
        nama_kol = ', '.join(LABEL_KOLOM.get(k, k) for k in kolom_prediksi)
        insights.insert(1, f"⚙️ Data {nama_kol} diambil dari prediksi (fallback).")

    kets = scores.get('ketersediaan')
    ketj = scores.get('keterjangkauan')
    pmnf = scores.get('pemanfaatan')

    if kets is not None:
        ico = '✅' if kets >= 70 else ('⚠️' if kets >= 50 else '🚨')
        insights.append(f"{ico} Ketersediaan: {kets:.2f} (bobot 33,5%).")

    if ketj is not None:
        ico = '✅' if ketj >= 70 else ('⚠️' if ketj >= 50 else '🚨')
        insights.append(f"{ico} Keterjangkauan: {ketj:.2f} (bobot 33,0%).")

    if pmnf is not None:
        ico = '✅' if pmnf >= 70 else ('⚠️' if pmnf >= 50 else '🚨')
        insights.append(f"{ico} Pemanfaatan: {pmnf:.2f} (bobot 33,5%).")

    return insights


# ── BANK KEBIJAKAN ─────────────────────────────────────────────────────────────
def get_bank_kebijakan_by_kategori(kategori_key, limit=10):
    """Ambil bank kebijakan IKP sesuai kategori dari DB."""
    prio_list = PRIORITAS_BAND_MAP.get(kategori_key, [3, 4])
    results   = []
    conn      = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        ph   = ','.join(['%s'] * len(prio_list))

        # Status di DB disimpan sebagai "SANGAT RENTAN" (dengan spasi) sesuai JSON
        status_label = LABEL_MAP.get(kategori_key, kategori_key.replace('_', ' '))

        cur.execute(
            f"SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, "
            f"kebijakan, rekomendasi_program, indikator_terkait "
            f"FROM bank_kebijakan "
            f"WHERE indeks='IKP' AND status=%s AND prioritas IN ({ph}) "
            f"ORDER BY prioritas ASC, pilar_kebijakan ASC LIMIT %s",
            (status_label, *prio_list, limit)
        )
        rows = [dict(r) for r in cur.fetchall()]

        # Fallback: hanya filter status
        if not rows:
            cur.execute(
                "SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, "
                "kebijakan, rekomendasi_program, indikator_terkait "
                "FROM bank_kebijakan WHERE indeks='IKP' AND status=%s "
                "ORDER BY prioritas ASC LIMIT %s",
                (status_label, limit)
            )
            rows = [dict(r) for r in cur.fetchall()]

        cur.close()

        # Kelompokkan per pilar
        pilar_map = {}
        for row in rows:
            pilar = row['pilar_kebijakan'] or 'Umum'
            pilar_map.setdefault(pilar, {
                'pilar':       pilar,
                'prioritas':   row['prioritas'],
                'jumlah_aksi': 0,
                'aksi':        [],
            })
            pilar_map[pilar]['aksi'].append({
                'no_aksi':           len(pilar_map[pilar]['aksi']) + 1,
                'isu_strategis':     row['isu_strategis'],
                'nama_aksi':         row['kebijakan'],
                'detail_aksi':       row['rekomendasi_program'],
                'indikator_terkait': row['indikator_terkait'],
                'sub_sektor':        row['pilar_kebijakan'],
            })
            pilar_map[pilar]['jumlah_aksi'] += 1

        results = list(pilar_map.values())

    except Exception as e:
        print(f"✗ get_bank_kebijakan IKP: {e}")
    finally:
        if conn:
            conn.close()
    return results


# ── API: CHECK DATA ───────────────────────────────────────────────────────────
@api_view(['POST'])
def check_ikp_year_data(request):
    """
    Cek ketersediaan data IKP untuk tahun tertentu.
    Response mencakup dataset_status per kolom, info prediksi, dan apakah bisa dieksekusi.
    """
    tahun = int(request.data.get('tahun', 2024))
    if tahun not in TAHUN_SEMUA:
        return Response(
            {"error": f"Tahun {tahun} tidak didukung (2020–{TAHUN_MAX})."},
            status=400
        )

    dataset_status, ada_pred, semua = check_data_tersedia(tahun)

    kolom_aktual   = [k for k, v in dataset_status.items() if v.get('sumber') == 'aktual']
    kolom_prediksi = [k for k, v in dataset_status.items() if v.get('perlu_prediksi')]
    kolom_kosong   = [k for k, v in dataset_status.items() if not v['tersedia']]

    pesan_peringatan = None
    if kolom_prediksi:
        nama_kolom = ', '.join(LABEL_KOLOM.get(k, k) for k in kolom_prediksi)
        pesan_peringatan = (
            f"Data {nama_kolom} untuk tahun {tahun} tidak tersedia di database aktual Bapanas. "
            f"Sistem dapat menggunakan hasil prediksi model Regresi Linear (OLS) sebagai pengganti. "
            f"Klik 'Lanjutkan dengan Prediksi' untuk melanjutkan, atau pilih tahun lain."
        )

    # OLS metrics hanya untuk kolom yang prediksi
    ols_metrics = {}
    if ada_pred:
        all_meta     = _load_ols_metadata()
        ols_metrics = _build_ols_metrics(all_meta, kolom_prediksi)

    return Response({
        "tahun":            tahun,
        "dataset_status":   dataset_status,
        "kolom_aktual":     kolom_aktual,
        "kolom_prediksi":   kolom_prediksi,
        "kolom_kosong":     kolom_kosong,
        "ada_prediksi":     ada_pred,
        "semua_tersedia":   semua,
        "semua_aktual":     not ada_pred and semua,
        "bisa_dieksekusi":  semua,
        "pesan_peringatan": pesan_peringatan,
        "ols_metrics":     ols_metrics,
    })


# ── API: ANALYZE ──────────────────────────────────────────────────────────────
@api_view(['POST'])
def analyze_ikp(request):
    """
    Analisis IKP per provinsi.
    Body: { tahun: int, gunakan_prediksi: bool }
    """
    try:
        tahun            = int(request.data.get('tahun', 2024))
        gunakan_prediksi = request.data.get('gunakan_prediksi', False)

        if tahun not in TAHUN_SEMUA:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)

        _, ada_pred, semua = check_data_tersedia(tahun)
        if ada_pred and not gunakan_prediksi:
            return Response({
                "error": "Ada kolom yang memerlukan data prediksi. Kirim gunakan_prediksi=true untuk melanjutkan.",
                "ada_prediksi": True,
            }, status=400)

        db_data, ada_prediksi = fetch_data_from_db(tahun)
        if not db_data:
            return Response({"error": f"Tidak ada data untuk tahun {tahun}."}, status=404)

        ols_metrics = {}
        if ada_prediksi:
            all_meta     = _load_ols_metadata()
            ols_metrics = _build_ols_metrics(all_meta, KEYS_AKTIF)

        # Ambil batas provinsi dari MongoDB
        boundary_features = list(mongo_db["batas_provinsi"].find({}, {'_id': 0}))
        province_map      = {}
        for feat in boundary_features:
            props = feat.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    for nv in [
                        str(props[field]).upper().strip(),
                        normalize_province_name(str(props[field]))
                    ]:
                        province_map[nv] = feat

        all_boundary_names = set()
        for feat in boundary_features:
            props = feat.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    all_boundary_names.add(normalize_province_name(str(props[field])))
                    break

        all_provs        = all_boundary_names | set(db_data.keys())
        matched_features = []
        analysis_summary = []
        ikp_data_for_xlsx = {}

        kategori_counts = {
            'SANGAT_RENTAN': 0, 'RENTAN': 0, 'AGAK_RENTAN': 0,
            'AGAK_TAHAN': 0, 'TAHAN': 0, 'SANGAT_TAHAN': 0,
            'TIDAK_TERANALISIS': 0,
        }
        kebijakan_cache = {}

        for prov_name in sorted(all_provs):
            row  = db_data.get(prov_name)
            norm = normalize_province_name(prov_name)
            matched_feature = (
                province_map.get(norm) or
                province_map.get(prov_name) or
                next((f for mn, f in province_map.items() if norm in mn or mn in norm), None)
            )
            if not matched_feature:
                continue

            has_data = (
                row is not None and
                any(row.get(k) is not None for k in KEYS_AKTIF)
            )

            if not has_data:
                kategori_counts['TIDAK_TERANALISIS'] += 1
                fc = matched_feature.copy()
                pc = fc.get('properties', {}).copy()
                pc['ikp_analysis'] = {
                    'nama_provinsi':  prov_name,
                    'kategori':       'TIDAK_TERANALISIS',
                    'kategori_label': 'TIDAK TERANALISIS',
                    'prioritas':      None,
                    'warna':          WARNA_MAP['TIDAK_TERANALISIS'],
                    'ikp':            None,
                    'ketersediaan':   None,
                    'keterjangkauan': None,
                    'pemanfaatan':    None,
                    'insights':       [f"Provinsi {prov_name} tidak memiliki data untuk tahun {tahun}."],
                    'rekomendasi':    [],
                    'sumber':         'tidak_tersedia',
                    'kolom_prediksi': [],
                }
                fc['properties'] = pc
                matched_features.append(fc)
                analysis_summary.append({
                    'provinsi':       prov_name,
                    'kategori':       'TIDAK_TERANALISIS',
                    'kategori_label': 'TIDAK TERANALISIS',
                    'prioritas':      None,
                    'warna':          WARNA_MAP['TIDAK_TERANALISIS'],
                    'ikp':            None,
                    'ketersediaan':   None,
                    'keterjangkauan': None,
                    'pemanfaatan':    None,
                    'sumber':         'tidak_tersedia',
                    'kolom_prediksi': [],
                })
                continue

            ketersediaan   = row.get('KETERSEDIAAN')
            keterjangkauan = row.get('KETERJANGKAUAN')
            pemanfaatan    = row.get('PEMANFAATAN')
            sumber         = row.get('sumber', 'aktual')
            kolom_pred     = row.get('kolom_prediksi', [])

            scores                    = hitung_ikp(ketersediaan, keterjangkauan, pemanfaatan)
            ikp_nilai                 = scores['ikp']
            kat_key, warna, kat_label = kategorisasi(ikp_nilai)
            prioritas_num             = get_prioritas_number(kat_key)
            insights                  = generate_insights(
                prov_name, scores, kat_label, ikp_nilai, sumber, kolom_pred
            )

            if kat_key not in kebijakan_cache:
                kebijakan_cache[kat_key] = get_bank_kebijakan_by_kategori(kat_key, 10)
            rekomendasi = kebijakan_cache[kat_key]

            kategori_counts[kat_key] = kategori_counts.get(kat_key, 0) + 1

            fc = matched_feature.copy()
            pc = fc.get('properties', {}).copy()
            pc['ikp_analysis'] = {
                'nama_provinsi':  prov_name,
                'kategori':       kat_key,
                'kategori_label': kat_label,
                'prioritas':      prioritas_num,
                'warna':          warna,
                'ikp':            ikp_nilai,
                'ketersediaan':   ketersediaan,
                'keterjangkauan': keterjangkauan,
                'pemanfaatan':    pemanfaatan,
                'insights':       insights,
                'rekomendasi':    rekomendasi,
                'sumber':         sumber,
                'kolom_prediksi': kolom_pred,
                'ols_metrics':   {k: ols_metrics.get(k) for k in kolom_pred} if kolom_pred else {},
            }
            fc['properties'] = pc
            matched_features.append(fc)

            summary_row = {
                'provinsi':       prov_name,
                'kategori':       kat_key,
                'kategori_label': kat_label,
                'prioritas':      prioritas_num,
                'warna':          warna,
                'ikp':            ikp_nilai,
                'ketersediaan':   ketersediaan,
                'keterjangkauan': keterjangkauan,
                'pemanfaatan':    pemanfaatan,
                'sumber':         sumber,
                'kolom_prediksi': kolom_pred,
            }
            analysis_summary.append(summary_row)
            ikp_data_for_xlsx[prov_name] = summary_row.copy()

        # Sort untuk worst/best
        sorted_summary = sorted(
            [s for s in analysis_summary if s['ikp'] is not None],
            key=lambda x: x['ikp'],
        )

        semua_sumber = set(
            s.get('sumber') for s in analysis_summary
            if s.get('sumber') not in (None, 'tidak_tersedia')
        )
        if semua_sumber == {'aktual'}:
            source_label = 'indikator_wilayah (Aktual Bapanas)'
        elif 'aktual' in semua_sumber:
            source_label = 'indikator_wilayah (Aktual) + prediksi_indikator_wilayah (Fallback Regresi Linear OLS)'
        else:
            source_label = 'prediksi_indikator_wilayah (Regresi Linear / Ordinary Least Squares)'

        return Response({
            'status':    'success',
            'source':    source_label,
            'tahun':     tahun,
            'ada_prediksi': ada_prediksi,
            'total_success':           len([s for s in analysis_summary if s['kategori'] != 'TIDAK_TERANALISIS']),
            'total_tidak_teranalisis': kategori_counts['TIDAK_TERANALISIS'],
            'kategori_distribusi':     kategori_counts,
            'timestamp': datetime.now().isoformat(),
            'formula': {
                'IKP': 'IKP = (I_Ketersediaan × 0.335) + (I_Keterjangkauan × 0.330) + (I_Pemanfaatan × 0.335)',
                'catatan': 'Skor tiap aspek diambil langsung dari publikasi resmi Bapanas (skala 0–100)',
            },
            'bobot': {
                'ketersediaan':   BOBOT_KETERSEDIAAN,
                'keterjangkauan': BOBOT_KETERJANGKAUAN,
                'pemanfaatan':    BOBOT_PEMANFAATAN,
            },
            'klasifikasi': {
                k: {
                    'warna':    WARNA_MAP[k],
                    'label':    LABEL_MAP[k],
                    'prioritas': get_prioritas_number(k),
                }
                for k in [
                    'SANGAT_RENTAN', 'RENTAN', 'AGAK_RENTAN',
                    'AGAK_TAHAN', 'TAHAN', 'SANGAT_TAHAN', 'TIDAK_TERANALISIS'
                ]
            },
            'matched_features':  {'type': 'FeatureCollection', 'features': matched_features},
            'analysis_summary':  analysis_summary,
            'ikp_data':          ikp_data_for_xlsx,
            'worst_provinces':   sorted_summary[:5],
            'best_provinces':    sorted_summary[-5:][::-1],
            'colors':            WARNA_MAP,
            'ols_metrics':      ols_metrics,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e), "message": "Gagal menganalisis data IKP"}, status=500)


# ── BANK KEBIJAKAN CRUD ────────────────────────────────────────────────────────
def _k_row(r):
    return {
        "id":             r["id"],
        "status":         r["status"],
        "prioritas":      r["prioritas"],
        "pilar":          r["pilar_kebijakan"],
        "isu_strategis":  r.get("isu_strategis"),
        "kebijakan":      r["kebijakan"],
        "rekomendasi":    r["rekomendasi_program"],
        "indikator":      r["indikator_terkait"],
        "dasar_hukum":    r.get("dasar_hukum"),
    }


@api_view(['GET'])
def get_bank_kebijakan_ikp(request):
    """Ambil semua kebijakan IKP, opsional filter status & pilar."""
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q      = ("SELECT id, indeks, status, prioritas, pilar_kebijakan, isu_strategis, "
                  "kebijakan, rekomendasi_program, indikator_terkait, dasar_hukum "
                  "FROM bank_kebijakan WHERE indeks='IKP'")
        params = []
        sf     = request.GET.get('status')
        pf     = request.GET.get('pilar')
        if sf:
            q += " AND status=%s"; params.append(sf)
        if pf:
            q += " AND pilar_kebijakan ILIKE %s"; params.append(f"%{pf}%")
        q += " ORDER BY prioritas ASC, pilar_kebijakan ASC"
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
def add_bank_kebijakan_ikp(request):
    """Tambah kebijakan IKP baru ke DB."""
    conn = None
    try:
        data = request.data
        required = ['status', 'prioritas', 'pilar_kebijakan', 'kebijakan',
                    'rekomendasi_program', 'indikator_terkait']
        for f in required:
            if not data.get(f):
                return Response({"error": f"Field '{f}' wajib."}, status=400)

        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO bank_kebijakan "
            "(indeks, status, prioritas, pilar_kebijakan, isu_strategis, "
            " kebijakan, rekomendasi_program, indikator_terkait, dasar_hukum) "
            "VALUES ('IKP',%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (
                data['status'],
                int(data['prioritas']),
                data['pilar_kebijakan'],
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
def update_bank_kebijakan_ikp(request, kebijakan_id):
    """Update kebijakan IKP berdasarkan ID."""
    conn = None
    try:
        d    = request.data
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute(
            "UPDATE bank_kebijakan SET "
            "status=%s, prioritas=%s, pilar_kebijakan=%s, isu_strategis=%s, "
            "kebijakan=%s, rekomendasi_program=%s, indikator_terkait=%s, dasar_hukum=%s "
            "WHERE id=%s AND indeks='IKP'",
            (
                d['status'],
                int(d['prioritas']),
                d['pilar_kebijakan'],
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
def delete_bank_kebijakan_ikp(request, kebijakan_id):
    """Hapus kebijakan IKP berdasarkan ID."""
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute(
            "DELETE FROM bank_kebijakan WHERE id=%s AND indeks='IKP'",
            (kebijakan_id,)
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


@api_view(['GET'])
def get_bank_kebijakan_ikp_for_provinsi(request):
    """
    Ambil kebijakan IKP terstruktur per pilar, opsional filter status.
    Dipakai FE untuk tampilan detail per provinsi.
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q      = ("SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, "
                  "kebijakan, rekomendasi_program, indikator_terkait, dasar_hukum "
                  "FROM bank_kebijakan WHERE indeks='IKP'")
        params = []
        sf     = request.GET.get('status', '').strip()
        if sf:
            q += " AND status=%s"; params.append(sf)
        q += " ORDER BY prioritas ASC, pilar_kebijakan ASC"
        cur.execute(q, params)
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()

        pilar_map = {}
        for r in rows:
            p = r['pilar_kebijakan'] or 'Umum'
            pilar_map.setdefault(p, []).append({
                'id':                r['id'],
                'status':            r['status'],
                'prioritas':         r['prioritas'],
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
            'by_pilar': [
                {'pilar': p, 'items': items}
                for p, items in sorted(pilar_map.items())
            ],
            'flat': [{
                'id':                r['id'],
                'status':            r['status'],
                'prioritas':         r['prioritas'],
                'pilar':             r['pilar_kebijakan'] or 'Umum',
                'isu_strategis':     r['isu_strategis'],
                'kebijakan':         r['kebijakan'],
                'rekomendasi':       r['rekomendasi_program'],
                'indikator_terkait': r['indikator_terkait'],
                'dasar_hukum':       r.get('dasar_hukum'),
            } for r in rows],
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn:
            conn.close()


# ── SIMPAN & KELOLA HASIL ANALISIS (MongoDB) ──────────────────────────────────
@api_view(['POST'])
def save_ikp_analysis(request):
    """Simpan hasil analisis IKP ke MongoDB."""
    try:
        name = request.data.get('name', 'Analisis IKP')
        data = request.data.get('analysis_data')
        if not data:
            return Response({"error": "Data tidak ditemukan"}, status=400)
        analysis_id = str(uuid.uuid4())
        doc = {
            "analysis_id": analysis_id,
            "name":        name,
            "type":        "ikp",
            "timestamp":   datetime.now().isoformat(),
            **data,
        }
        mongo_db["ikp_analysis"].insert_one(doc)
        return Response({
            "status":      "success",
            "analysis_id": analysis_id,
            "saved_at":    doc["timestamp"],
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_ikp_analysis_list(request):
    """Daftar hasil analisis IKP yang tersimpan."""
    try:
        results = list(mongo_db["ikp_analysis"].find(
            {},
            {
                "_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
                "total_success": 1, "kategori_distribusi": 1,
                "tahun": 1, "ada_prediksi": 1,
            }
        ).sort("timestamp", -1))
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_ikp_analysis_detail(request, analysis_id):
    """Detail satu hasil analisis IKP."""
    try:
        result = mongo_db["ikp_analysis"].find_one(
            {"analysis_id": analysis_id}, {"_id": 0}
        )
        if not result:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_ikp_analysis(request, analysis_id):
    """Hapus satu hasil analisis IKP."""
    try:
        result = mongo_db["ikp_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['PATCH'])
def patch_provinsi_kebijakan_ikp(request, analysis_id):
    """
    Override rekomendasi kebijakan untuk satu provinsi dalam satu hasil analisis.
    Body: { nama_provinsi: str, rekomendasi: list }
    """
    try:
        nama_provinsi = request.data.get('nama_provinsi', '').strip().upper()
        rekomendasi   = request.data.get('rekomendasi')
        if not nama_provinsi:
            return Response({'error': 'nama_provinsi wajib.'}, status=400)
        if not isinstance(rekomendasi, list):
            return Response({'error': 'rekomendasi harus array.'}, status=400)

        doc = mongo_db['ikp_analysis'].find_one({'analysis_id': analysis_id})
        if not doc:
            return Response({'error': 'Tidak ditemukan.'}, status=404)

        features = doc.get('matched_features', {}).get('features', [])
        now      = datetime.now().isoformat()
        updated  = False

        for feat in features:
            ikp = feat.get('properties', {}).get('ikp_analysis', {})
            if ikp.get('nama_provinsi', '').upper().strip() == nama_provinsi:
                ikp.update({
                    'rekomendasi':           rekomendasi,
                    'rekomendasi_edited':    True,
                    'rekomendasi_edited_at': now,
                })
                feat['properties']['ikp_analysis'] = ikp
                updated = True
                break

        if not updated:
            return Response({'error': f'Provinsi "{nama_provinsi}" tidak ditemukan.'}, status=404)

        summary = doc.get('analysis_summary', [])
        for s in summary:
            if s.get('provinsi', '').upper().strip() == nama_provinsi:
                s['rekomendasi_edited'] = True
                break

        mongo_db['ikp_analysis'].update_one(
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

# ── INFO MODEL PREDIKSI ───────────────────────────────────────────────────────
@api_view(['GET'])
def get_ols_model_info_ikp(request):
    """Informasi model Regresi Linear OLS yang digunakan untuk prediksi IKP."""
    all_meta    = _load_ols_metadata()
    ols_metrics = _build_ols_metrics(all_meta, KEYS_AKTIF)
    return Response({
        "status":     "success",
        "model":      "Regresi Linear OLS (Ordinary Least Squares)",
        "keterangan": (
            "Model Regresi Linear OLS untuk prediksi skor aspek IKP (Ketersediaan, "
            "Keterjangkauan, Pemanfaatan) tahun 2026-2045. Prediksi di-clamp ke "
            "rentang [0, 100] sesuai definisi indeks skor Bapanas."
        ),
        "model_info": ols_metrics,
        "timestamp":  datetime.now().isoformat(),
    })