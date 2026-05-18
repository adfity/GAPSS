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
METADATA_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ai_models', 'ipe')


def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"),
    )


# ── PARAMETER IPE ─────────────────────────────────────────────────────────────
#
# Metodologi IPE — Min-Max Normalisasi (bobot equal weight 50:50):
#
#   Dimensi 1 — Laju Pertumbuhan PDRB ADHK (%)   → kolom DB: spe  → key: LAJU_PE
#   Dimensi 2 — PDRB per Kapita ADHK (Ribu Rp)   → kolom DB: spk  → key: PDRB_KAPITA
#
#   S1  = [(spe - spe_min) / (spe_max - spe_min)] × 100
#   S2  = [(spk - spk_min) / (spk_max - spk_min)] × 100
#   IPE = (0.50 × S1) + (0.50 × S2)
#
#   Min-Max dihitung dinamis dari seluruh 38 provinsi pada tahun yang sama.

TAHUN_SEMUA = list(range(2010, 2046))
TAHUN_MAX   = 2045

# Internal keys — sama persis dengan nilai yg dikirim FE di field 'indikator'
LAJU_PE     = 'LAJU_PE'
PDRB_KAPITA = 'PDRB_KAPITA'

# key internal → kolom PostgreSQL
# spe = Laju Pertumbuhan PDRB ADHK (%)
# spk = PDRB per Kapita ADHK (Ribu Rp)
DB_COL_MAP = {
    LAJU_PE:     'spe',
    PDRB_KAPITA: 'spk',
}

INDIKATOR_DATASET_MAP = {
    'ALL':      [LAJU_PE, PDRB_KAPITA],
    LAJU_PE:    [LAJU_PE],
    PDRB_KAPITA:[PDRB_KAPITA],
}

LABEL_KOLOM = {
    LAJU_PE:     'Laju Pertumbuhan PDRB ADHK (%)',
    PDRB_KAPITA: 'PDRB per Kapita ADHK (Ribu Rp)',
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
PRIORITAS_BAND_MAP = {
    'RENDAH':        [1, 2, 3],
    'SEDANG':        [2, 3],
    'TINGGI':        [2, 3],
    'SANGAT_TINGGI': [3],
}


# ── FORMULA ───────────────────────────────────────────────────────────────────
def _minmax(val, vmin, vmax):
    if val is None or vmin is None or vmax is None:
        return None
    denom = float(vmax) - float(vmin)
    if denom == 0:
        return 0.0
    return round(max(0.0, min(100.0, (float(val) - float(vmin)) / denom * 100.0)), 4)


def hitung_ipe(laju_pe, pdrb_kapita, g_min, g_max, y_min, y_max, indikator='ALL'):
    """
    Hitung skor komponen dan nilai IPE.

    laju_pe     : nilai kolom spe (Laju PE %)
    pdrb_kapita : nilai kolom spk (PDRB/Kapita Ribu Rp)
    g_min/max   : min-max laju PE (spe) lintas provinsi
    y_min/max   : min-max PDRB/kapita (spk) lintas provinsi
    """
    s1 = _minmax(laju_pe,     g_min, g_max)
    s2 = _minmax(pdrb_kapita, y_min, y_max)

    if s1 is not None and s2 is not None:
        ipe_all = round(0.50 * s1 + 0.50 * s2, 4)
    elif s1 is not None:
        ipe_all = round(s1, 4)
    elif s2 is not None:
        ipe_all = round(s2, 4)
    else:
        ipe_all = None

    if indikator == LAJU_PE:
        ipe = s1
    elif indikator == PDRB_KAPITA:
        ipe = s2
    else:
        ipe = ipe_all

    ipe_rounded = round(ipe, 2) if ipe is not None else None

    return {
        's1':       round(s1, 4)      if s1      is not None else None,
        's2':       round(s2, 4)      if s2      is not None else None,
        'ipe':      ipe_rounded,
        'ipe_all':  round(ipe_all, 4) if ipe_all is not None else None,
        'indeks_ipe': ipe_rounded,  # alias untuk akses FE: d.indeks_ipe
    }


def kategorisasi(ipe):
    if ipe is None:
        return 'TIDAK_TERANALISIS', WARNA_MAP['TIDAK_TERANALISIS'], LABEL_MAP['TIDAK_TERANALISIS']
    if ipe >= 75:
        return 'SANGAT_TINGGI', WARNA_MAP['SANGAT_TINGGI'], LABEL_MAP['SANGAT_TINGGI']
    if ipe >= 50:
        return 'TINGGI', WARNA_MAP['TINGGI'], LABEL_MAP['TINGGI']
    if ipe >= 25:
        return 'SEDANG', WARNA_MAP['SEDANG'], LABEL_MAP['SEDANG']
    return 'RENDAH', WARNA_MAP['RENDAH'], LABEL_MAP['RENDAH']


def hitung_per_indikator(laju_pe, pdrb_kapita, g_min, g_max, y_min, y_max):
    result = {}
    for ind in ['ALL', LAJU_PE, PDRB_KAPITA]:
        sc = hitung_ipe(laju_pe, pdrb_kapita, g_min, g_max, y_min, y_max, ind)
        k, w, _ = kategorisasi(sc['ipe'])
        result[ind] = {'kategori': k, 'warna': w, 'nilai': sc['ipe']}
    return result


# ── NORMALIZER ────────────────────────────────────────────────────────────────
def normalize_province_name(name):
    name = str(name)
    for tag in ['<b>', '</b>', '<B>', '</B>']:
        name = name.replace(tag, '')
    name = name.upper().strip()
    SPECIAL = {
        'DKI JAKARTA': 'JAKARTA',
        'DAERAH KHUSUS IBUKOTA JAKARTA': 'JAKARTA',
        'YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
        'DIY': 'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU': 'KEPULAUAN RIAU',
    }
    for k, v in SPECIAL.items():
        if k in name:
            return v
    for a, f in {'KEP.': 'KEPULAUAN', 'NTB': 'NUSA TENGGARA BARAT', 'NTT': 'NUSA TENGGARA TIMUR'}.items():
        name = name.replace(a, f)
    for prefix in ['PROVINSI ', 'PROV. ', 'PROV ', 'DAERAH KHUSUS IBUKOTA ']:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name.strip()


# ── OLS METADATA ──────────────────────────────────────────────────────────────
def _load_ols_metadata():
    files = {
        LAJU_PE:     'spe_metadata.json',
        PDRB_KAPITA: 'spk_metadata.json',
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


def _build_ols_metrics(meta_dict, keys_aktif):
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
            'jumlah_wilayah': m.get('jumlah_wilayah'),
            'mape_pct':       mape,
            'mae':            ev.get('rata_rata_MAE') or ev.get('rata_rata_MAE (%)'),
            'quality':        _quality_label(mape),
        }
    return metrics


def _quality_label(mape):
    if mape is None:
        return {'grade': '?',  'label': 'Tidak Diketahui',  'color': '#94a3b8'}
    if mape < 2:
        return {'grade': '🥇', 'label': 'Sangat Baik',      'color': '#10b981'}
    if mape < 5:
        return {'grade': '✅', 'label': 'Baik',             'color': '#3b82f6'}
    if mape < 10:
        return {'grade': '⚠️', 'label': 'Cukup',           'color': '#f59e0b'}
    return     {'grade': '❌', 'label': 'Perlu Perhatian', 'color': '#ef4444'}


# ── DB CHECK & FETCH ──────────────────────────────────────────────────────────
def check_data_tersedia(tahun, keys_aktif):
    dataset_status = {}
    ada_prediksi   = False
    conn = None
    try:
        conn = get_pg_connection()
        for k in keys_aktif:
            col = DB_COL_MAP[k]  # 'spe' atau 'spk'
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
        for k in keys_aktif:
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


def fetch_data_from_db(tahun, keys_aktif):
    """
    Fetch data dari indikator_wilayah (aktual), fallback NULL ke prediksi.
    Entry dict:
        LAJU_PE     : float|None  ← dari kolom spe
        PDRB_KAPITA : float|None  ← dari kolom spk
        sumber      : str
        kolom_prediksi: list
    """
    db_cols   = [DB_COL_MAP[k] for k in keys_aktif]
    kolom_sql = ['provinsi', 'kode_wilayah'] + db_cols
    result       = {}
    ada_prediksi = False
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Aktual
        cur.execute(
            f"SELECT {', '.join(kolom_sql)} FROM indikator_wilayah "
            f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
            (tahun,)
        )
        for row in cur.fetchall():
            prov  = normalize_province_name(row['provinsi'])
            entry = {'sumber': 'aktual', 'kolom_prediksi': []}
            for k in keys_aktif:
                val = row.get(DB_COL_MAP[k])
                entry[k] = float(val) if val is not None else None
            result[prov] = entry

        # Fallback prediksi untuk NULL
        prov_null = {
            p: [k for k in keys_aktif if result[p].get(k) is None]
            for p in result
        }
        prov_null = {p: v for p, v in prov_null.items() if v}

        if not result:
            cur.execute(
                f"SELECT {', '.join(kolom_sql)} FROM prediksi_indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
                (tahun,)
            )
            for row in cur.fetchall():
                prov  = normalize_province_name(row['provinsi'])
                entry = {'sumber': 'prediksi', 'kolom_prediksi': list(keys_aktif)}
                for k in keys_aktif:
                    val = row.get(DB_COL_MAP[k])
                    entry[k] = float(val) if val is not None else None
                result[prov] = entry
                ada_prediksi = True
        elif prov_null:
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
                    val = pred_row.get(DB_COL_MAP[k])
                    if val is not None:
                        result[prov][k] = float(val)
                        result[prov]['kolom_prediksi'].append(k)
                        ada_prediksi = True
                kp = result[prov]['kolom_prediksi']
                if kp:
                    result[prov]['sumber'] = (
                        'prediksi' if set(kp) == set(keys_aktif) else 'campuran'
                    )
        cur.close()
    except Exception as e:
        print(f"✗ fetch_data_from_db IPE ({tahun}): {e}")
    finally:
        if conn:
            conn.close()
    return result, ada_prediksi


def _compute_minmax(db_data, keys_aktif):
    """Min-Max dari seluruh provinsi yang sudah di-fetch."""
    values = {k: [] for k in keys_aktif}
    for entry in db_data.values():
        for k in keys_aktif:
            v = entry.get(k)
            if v is not None:
                values[k].append(v)
    minmax = {}
    for k in keys_aktif:
        arr = values[k]
        minmax[k] = {'min': min(arr), 'max': max(arr)} if arr else {'min': None, 'max': None}
    return minmax


# ── INSIGHTS ──────────────────────────────────────────────────────────────────
def generate_insights(prov, laju_pe, pdrb_kapita, scores, kat_label, ipe_val,
                      indikator, sumber, kolom_prediksi):
    src = {
        'aktual':   '(Aktual BPS)',
        'prediksi': '(Prediksi Regresi Linear OLS)',
        'campuran': '(Aktual+Prediksi)',
    }.get(sumber, '')

    insights = [f"Provinsi {prov} — IPE {ipe_val} → {kat_label} {src}."]

    if kolom_prediksi:
        nama_kol = ', '.join(LABEL_KOLOM.get(k, k) for k in kolom_prediksi)
        insights.insert(1, f"⚙️ Data {nama_kol} diambil dari prediksi Regresi Linear (OLS)")

    s1, s2 = scores['s1'], scores['s2']

    if indikator in ('ALL', LAJU_PE) and laju_pe is not None:
        ico = '🚀' if (s1 or 0) >= 75 else ('✅' if (s1 or 0) >= 50 else ('⚠️' if (s1 or 0) >= 25 else '🚨'))
        insights.append(f"{ico} Laju PE PDRB {laju_pe:.2f}% → S1={round(s1, 2) if s1 is not None else '-'}.")

    if indikator in ('ALL', PDRB_KAPITA) and pdrb_kapita is not None:
        ico = '💰' if (s2 or 0) >= 75 else ('✅' if (s2 or 0) >= 50 else ('⚠️' if (s2 or 0) >= 25 else '💸'))
        insights.append(
            f"{ico} PDRB/Kapita Rp{pdrb_kapita * 1000:,.0f} → S2={round(s2, 2) if s2 is not None else '-'}."
        )

    if s1 is not None and s2 is not None and indikator == 'ALL':
        insights.append(
            f"   IPE = (0,50 × {round(s1, 2)}) + (0,50 × {round(s2, 2)}) = {ipe_val}."
        )
    return insights


# ── KEBIJAKAN ─────────────────────────────────────────────────────────────────
def get_bank_kebijakan_by_kategori(kategori_key, limit=10):
    prio_list = PRIORITAS_BAND_MAP.get(kategori_key, [2, 3])
    results, conn = [], None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        ph   = ','.join(['%s'] * len(prio_list))
        cur.execute(
            f"SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, kebijakan, "
            f"rekomendasi_program, indikator_terkait "
            f"FROM bank_kebijakan WHERE indeks='IPE' AND status=%s AND prioritas IN ({ph}) "
            f"ORDER BY prioritas ASC, pilar_kebijakan ASC LIMIT %s",
            (kategori_key, *prio_list, limit)
        )
        rows = [dict(r) for r in cur.fetchall()]
        if not rows and kategori_key == 'SANGAT_TINGGI':
            cur.execute(
                "SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, kebijakan, "
                "rekomendasi_program, indikator_terkait "
                "FROM bank_kebijakan WHERE indeks='IPE' AND status='TINGGI' "
                "ORDER BY prioritas ASC LIMIT %s", (limit,)
            )
            rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            cur.execute(
                "SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, kebijakan, "
                "rekomendasi_program, indikator_terkait "
                "FROM bank_kebijakan WHERE indeks='IPE' AND status=%s "
                "ORDER BY prioritas ASC LIMIT %s", (kategori_key, limit)
            )
            rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        pilar_map = {}
        for row in rows:
            pilar = row['pilar_kebijakan'] or 'Umum'
            pilar_map.setdefault(pilar, {'pilar': pilar, 'prioritas': row['prioritas'], 'jumlah_aksi': 0, 'aksi': []})
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
        print(f"✗ get_bank_kebijakan IPE: {e}")
    finally:
        if conn:
            conn.close()
    return results


# ── API: CHECK DATA ───────────────────────────────────────────────────────────
@api_view(['POST'])
def check_ipe_year_data(request):
    """
    POST { tahun, indikator }
    Cek kolom spe (laju PE) dan spk (PDRB/kapita) di indikator_wilayah.
    Fallback ke prediksi_indikator_wilayah jika NULL.
    """
    tahun     = int(request.data.get('tahun', 2024))
    indikator = request.data.get('indikator', 'ALL')

    if tahun not in TAHUN_SEMUA:
        return Response({"error": f"Tahun {tahun} tidak didukung (2010–{TAHUN_MAX})."}, status=400)

    keys_aktif                      = INDIKATOR_DATASET_MAP.get(indikator, INDIKATOR_DATASET_MAP['ALL'])
    dataset_status, ada_pred, semua = check_data_tersedia(tahun, keys_aktif)

    kolom_aktual   = [k for k, v in dataset_status.items() if v.get('sumber') == 'aktual']
    kolom_prediksi = [k for k, v in dataset_status.items() if v.get('perlu_prediksi')]
    kolom_kosong   = [k for k, v in dataset_status.items() if not v['tersedia']]

    pesan_peringatan = None
    if kolom_prediksi:
        nama_kolom = ', '.join(LABEL_KOLOM.get(k, k) for k in kolom_prediksi)
        pesan_peringatan = (
            f"Data {nama_kolom} untuk tahun {tahun} tidak tersedia di database aktual BPS. "
            f"Sistem dapat menggunakan hasil prediksi model Regresi Linear (OLS) sebagai pengganti. "
            f"Klik 'Lanjutkan dengan Prediksi' untuk melanjutkan, atau pilih tahun lain."
        )

    ols_metrics = {}
    if ada_pred:
        ols_metrics = _build_ols_metrics(_load_ols_metadata(), kolom_prediksi)

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
def analyze_ipe(request):
    """
    POST { tahun, indikator, gunakan_prediksi }

    Hitung IPE per provinsi:
      S1  = Min-Max(spe)  × 100   [Laju PE]
      S2  = Min-Max(spk)  × 100   [PDRB/Kapita]
      IPE = 0.50·S1 + 0.50·S2
    """
    try:
        tahun            = int(request.data.get('tahun', 2024))
        indikator        = request.data.get('indikator', 'ALL')
        gunakan_prediksi = request.data.get('gunakan_prediksi', False)

        if indikator not in INDIKATOR_DATASET_MAP:
            indikator = 'ALL'
        if tahun not in TAHUN_SEMUA:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)

        keys_aktif = INDIKATOR_DATASET_MAP[indikator]

        _, ada_pred, _ = check_data_tersedia(tahun, keys_aktif)
        if ada_pred and not gunakan_prediksi:
            return Response({
                "error":        "Ada kolom yang memerlukan data prediksi. Kirim gunakan_prediksi=true untuk melanjutkan.",
                "ada_prediksi": True,
            }, status=400)

        db_data, ada_prediksi = fetch_data_from_db(tahun, keys_aktif)
        if not db_data:
            return Response({"error": f"Tidak ada data untuk tahun {tahun}."}, status=404)

        # Min-Max lintas 38 provinsi
        minmax  = _compute_minmax(db_data, keys_aktif)
        g_min   = minmax.get(LAJU_PE,     {}).get('min')
        g_max   = minmax.get(LAJU_PE,     {}).get('max')
        y_min   = minmax.get(PDRB_KAPITA, {}).get('min')
        y_max   = minmax.get(PDRB_KAPITA, {}).get('max')

        ols_metrics = {}
        if ada_prediksi:
            ols_metrics = _build_ols_metrics(_load_ols_metadata(), keys_aktif)

        # Batas provinsi dari MongoDB
        boundary_features = list(mongo_db["batas_provinsi"].find({}, {'_id': 0}))
        province_map      = {}
        for feat in boundary_features:
            props = feat.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    for nv in [str(props[field]).upper().strip(), normalize_province_name(str(props[field]))]:
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
        ipe_data_export  = {}
        kategori_counts  = {'SANGAT_TINGGI': 0, 'TINGGI': 0, 'SEDANG': 0, 'RENDAH': 0, 'TIDAK_TERANALISIS': 0}
        kebijakan_cache  = {}

        for prov_name in sorted(all_provs):
            row  = db_data.get(prov_name)
            norm = normalize_province_name(prov_name)
            matched_feature = (
                province_map.get(norm)
                or province_map.get(prov_name)
                or next((f for mn, f in province_map.items() if norm in mn or mn in norm), None)
            )
            if not matched_feature:
                continue

            has_data = row is not None and any(row.get(k) is not None for k in keys_aktif)

            # ─── Tidak ada data ───
            if not has_data:
                kategori_counts['TIDAK_TERANALISIS'] += 1
                fc = matched_feature.copy()
                pc = fc.get('properties', {}).copy()
                pc['ipe_analysis'] = {
                    'nama_provinsi':  prov_name, 'indikator': indikator,
                    'kategori':       'TIDAK_TERANALISIS', 'kategori_label': 'TIDAK TERANALISIS',
                    'warna':          '#a6a6a6',
                    'ipe': None, 'ipe_all': None, 'indeks_ipe': None, 's1': None, 's2': None,
                    'insights':    [f"Provinsi {prov_name} tidak memiliki data untuk tahun {tahun}."],
                    'rekomendasi': [], 'sumber': 'tidak_tersedia', 'kolom_prediksi': [],
                    'kategori_per_indikator': {i: 'TIDAK_TERANALISIS' for i in ['ALL', LAJU_PE, PDRB_KAPITA]},
                    'warna_per_indikator':    {i: '#a6a6a6' for i in ['ALL', LAJU_PE, PDRB_KAPITA]},
                    'data_komponen': {LAJU_PE: None, PDRB_KAPITA: None},
                }
                fc['properties'] = pc
                matched_features.append(fc)
                analysis_summary.append({
                    'provinsi': prov_name, 'indikator': indikator,
                    'kategori': 'TIDAK_TERANALISIS', 'kategori_label': 'TIDAK TERANALISIS',
                    'warna': '#a6a6a6',
                    'ipe': None, 'ipe_all': None, 'indeks_ipe': None, 's1': None, 's2': None,
                    'laju_pe': None, 'pdrb_kapita': None,
                    'kategori_per_indikator': {i: 'TIDAK_TERANALISIS' for i in ['ALL', LAJU_PE, PDRB_KAPITA]},
                    'warna_per_indikator':    {i: '#a6a6a6' for i in ['ALL', LAJU_PE, PDRB_KAPITA]},
                    'sumber': 'tidak_tersedia', 'kolom_prediksi': [],
                })
                continue

            # ─── Ada data ───
            laju_pe_val     = row.get(LAJU_PE)     if LAJU_PE     in keys_aktif else None
            pdrb_kapita_val = row.get(PDRB_KAPITA) if PDRB_KAPITA in keys_aktif else None
            sumber          = row.get('sumber', 'aktual')
            kolom_pred      = row.get('kolom_prediksi', [])

            scores                    = hitung_ipe(laju_pe_val, pdrb_kapita_val, g_min, g_max, y_min, y_max, indikator)
            ipe_val                   = scores['ipe']
            kat_key, warna, kat_label = kategorisasi(ipe_val)
            insights                  = generate_insights(
                prov_name, laju_pe_val, pdrb_kapita_val,
                scores, kat_label, ipe_val, indikator, sumber, kolom_pred,
            )
            per_ind       = hitung_per_indikator(laju_pe_val, pdrb_kapita_val, g_min, g_max, y_min, y_max)
            kat_per_ind   = {ind: per_ind[ind]['kategori'] for ind in per_ind}
            warna_per_ind = {ind: per_ind[ind]['warna']    for ind in per_ind}

            if kat_key not in kebijakan_cache:
                kebijakan_cache[kat_key] = get_bank_kebijakan_by_kategori(kat_key, 10)
            rekomendasi = kebijakan_cache[kat_key]
            kategori_counts[kat_key] = kategori_counts.get(kat_key, 0) + 1

            fc = matched_feature.copy()
            pc = fc.get('properties', {}).copy()
            pc['ipe_analysis'] = {
                'nama_provinsi':  prov_name, 'indikator': indikator,
                'kategori':       kat_key, 'kategori_label': kat_label, 'warna': warna,
                'ipe':            scores['ipe'],
                'ipe_all':        scores['ipe_all'],
                'indeks_ipe':     scores['indeks_ipe'],
                's1':             scores['s1'],
                's2':             scores['s2'],
                'insights':       insights,
                'rekomendasi':    rekomendasi,
                'kategori_per_indikator': kat_per_ind,
                'warna_per_indikator':    warna_per_ind,
                'sumber':         sumber,
                'kolom_prediksi': kolom_pred,
                # data_komponen pakai key LAJU_PE / PDRB_KAPITA agar FE bisa akses dc.LAJU_PE dst
                'data_komponen':  {LAJU_PE: laju_pe_val, PDRB_KAPITA: pdrb_kapita_val},
                'ols_metrics':    {k: ols_metrics.get(k) for k in kolom_pred} if kolom_pred else {},
                'minmax_referensi': {'g_min': g_min, 'g_max': g_max, 'y_min': y_min, 'y_max': y_max},
            }
            fc['properties'] = pc
            matched_features.append(fc)

            summary_row = {
                'provinsi':       prov_name, 'indikator': indikator,
                'kategori':       kat_key, 'kategori_label': kat_label, 'warna': warna,
                'ipe':            scores['ipe'],
                'ipe_all':        scores['ipe_all'],
                'indeks_ipe':     scores['indeks_ipe'],
                's1':             scores['s1'],
                's2':             scores['s2'],
                'laju_pe':        laju_pe_val,       # FE tabel: d.laju_pe / dc.LAJU_PE
                'pdrb_kapita':    pdrb_kapita_val,   # FE tabel: d.pdrb_kapita / dc.PDRB_KAPITA
                'kategori_per_indikator': kat_per_ind,
                'warna_per_indikator':    warna_per_ind,
                'sumber':         sumber,
                'kolom_prediksi': kolom_pred,
            }
            analysis_summary.append(summary_row)
            ipe_data_export[prov_name] = summary_row.copy()

        sorted_summary = sorted(
            [s for s in analysis_summary if s['ipe'] is not None],
            key=lambda x: x['ipe'],
        )

        semua_sumber = set(
            s.get('sumber') for s in analysis_summary
            if s.get('sumber') not in (None, 'tidak_tersedia')
        )
        if semua_sumber == {'aktual'}:
            source_label = 'indikator_wilayah (Aktual BPS)'
        elif 'aktual' in semua_sumber:
            source_label = 'indikator_wilayah (Aktual) + prediksi_indikator_wilayah (Fallback OLS)'
        else:
            source_label = 'prediksi_indikator_wilayah (Regresi Linear / OLS)'

        return Response({
            'status':    'success',
            'source':    source_label,
            'tahun':     tahun,
            'indikator': indikator,
            'ada_prediksi':  ada_prediksi,
            'dataset_aktif': keys_aktif,
            'total_success':           len([s for s in analysis_summary if s['kategori'] != 'TIDAK_TERANALISIS']),
            'total_tidak_teranalisis': kategori_counts['TIDAK_TERANALISIS'],
            'kategori_distribusi':     kategori_counts,
            'timestamp': datetime.now().isoformat(),
            'formula': {
                'S1':  '[(spe - spe_min) / (spe_max - spe_min)] × 100',
                'S2':  '[(spk - spk_min) / (spk_max - spk_min)] × 100',
                'IPE': '(0,50 × S1) + (0,50 × S2)',
                'keterangan': {
                    'spe': 'Laju Pertumbuhan PDRB ADHK 2010 (%) — key: LAJU_PE — Dimensi S1',
                    'spk': 'PDRB per Kapita ADHK 2010 (Ribu Rp) — key: PDRB_KAPITA — Dimensi S2',
                    'basis': 'Min-Max dihitung lintas seluruh provinsi pada tahun yang sama',
                },
            },
            'minmax_tahun': {
                'spe_min': g_min, 'spe_max': g_max,
                'spk_min': y_min, 'spk_max': y_max,
            },
            'klasifikasi': {
                k: {'warna': WARNA_MAP[k], 'label': LABEL_MAP[k]}
                for k in ['SANGAT_TINGGI', 'TINGGI', 'SEDANG', 'RENDAH', 'TIDAK_TERANALISIS']
            },
            'ols_metrics':      ols_metrics,
            'matched_features': {'type': 'FeatureCollection', 'features': matched_features},
            'analysis_summary': analysis_summary,
            'ipe_data':         ipe_data_export,
            'worst_provinces':  sorted_summary[:5],
            'best_provinces':   sorted_summary[-5:][::-1],
            'colors':           WARNA_MAP,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e), "message": "Gagal menganalisis data IPE"}, status=500)


# ── BANK KEBIJAKAN ─────────────────────────────────────────────────────────────
def _k_row(r):
    return {
        "id": r["id"], "status": r["status"], "prioritas": r["prioritas"],
        "pilar": r["pilar_kebijakan"], "kebijakan": r["kebijakan"],
        "rekomendasi": r["rekomendasi_program"], "indikator": r["indikator_terkait"],
        "isu_strategis": r.get("isu_strategis"),
    }


@api_view(['GET'])
def get_bank_kebijakan_ipe(request):
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q    = ("SELECT id, indeks, status, prioritas, pilar_kebijakan, isu_strategis, "
                "kebijakan, rekomendasi_program, indikator_terkait FROM bank_kebijakan WHERE indeks='IPE'")
        params = []
        sf = request.GET.get('status'); pf = request.GET.get('pilar')
        if sf and sf.upper() in STATUS_VALID: q += " AND status=%s"; params.append(sf.upper())
        if pf: q += " AND pilar_kebijakan ILIKE %s"; params.append(f"%{pf}%")
        q += " ORDER BY status ASC, prioritas ASC, pilar_kebijakan ASC"
        cur.execute(q, params)
        hasil = [_k_row(dict(r)) for r in cur.fetchall()]; cur.close()
        return Response({"status": "success", "count": len(hasil), "results": hasil})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['POST'])
def add_bank_kebijakan_ipe(request):
    conn = None
    try:
        data = request.data
        for f in ['status', 'prioritas', 'pilar_kebijakan', 'kebijakan', 'rekomendasi_program', 'indikator_terkait']:
            if not data.get(f): return Response({"error": f"Field '{f}' wajib."}, status=400)
        status = data['status'].upper()
        if status not in STATUS_VALID: return Response({"error": f"Status: {', '.join(STATUS_VALID)}."}, status=400)
        conn = get_pg_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO bank_kebijakan(indeks,status,prioritas,pilar_kebijakan,isu_strategis,kebijakan,rekomendasi_program,indikator_terkait) "
            "VALUES('IPE',%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (status, int(data['prioritas']), data['pilar_kebijakan'], data.get('isu_strategis',''),
             data['kebijakan'], data['rekomendasi_program'], data['indikator_terkait'].upper())
        )
        new_id = cur.fetchone()['id']; conn.commit(); cur.close()
        return Response({"status": "success", "id": new_id})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['PUT'])
def update_bank_kebijakan_ipe(request, kebijakan_id):
    conn = None
    try:
        d = request.data; status = d.get('status','').upper()
        if status not in STATUS_VALID: return Response({"error": "Status tidak valid."}, status=400)
        conn = get_pg_connection(); cur = conn.cursor()
        cur.execute(
            "UPDATE bank_kebijakan SET status=%s,prioritas=%s,pilar_kebijakan=%s,isu_strategis=%s,"
            "kebijakan=%s,rekomendasi_program=%s,indikator_terkait=%s WHERE id=%s AND indeks='IPE'",
            (status, int(d['prioritas']), d['pilar_kebijakan'], d.get('isu_strategis',''),
             d['kebijakan'], d['rekomendasi_program'], d['indikator_terkait'].upper(), kebijakan_id)
        )
        if cur.rowcount == 0: return Response({"error": "Tidak ditemukan."}, status=404)
        conn.commit(); cur.close(); return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['DELETE'])
def delete_bank_kebijakan_ipe(request, kebijakan_id):
    conn = None
    try:
        conn = get_pg_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM bank_kebijakan WHERE id=%s AND indeks='IPE'", (kebijakan_id,))
        if cur.rowcount == 0: return Response({"error": "Tidak ditemukan."}, status=404)
        conn.commit(); cur.close(); return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['GET'])
def get_bank_kebijakan_ipe_for_provinsi(request):
    conn = None
    try:
        conn = get_pg_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q = ("SELECT id,status,prioritas,pilar_kebijakan,isu_strategis,kebijakan,rekomendasi_program,indikator_terkait "
             "FROM bank_kebijakan WHERE indeks='IPE'")
        params = []; sf = request.GET.get('status','').upper()
        if sf in STATUS_VALID: q += " AND status=%s"; params.append(sf)
        q += " ORDER BY status ASC,prioritas ASC,pilar_kebijakan ASC"; cur.execute(q, params)
        rows = [dict(r) for r in cur.fetchall()]; cur.close()
        pilar_map = {}
        for r in rows:
            p = r['pilar_kebijakan'] or 'Umum'
            pilar_map.setdefault(p, []).append({
                'id': r['id'], 'status': r['status'], 'prioritas': r['prioritas'], 'pilar': p,
                'isu_strategis': r['isu_strategis'], 'kebijakan': r['kebijakan'],
                'rekomendasi': r['rekomendasi_program'], 'indikator_terkait': r['indikator_terkait'],
            })
        return Response({
            'status': 'success', 'count': len(rows),
            'by_pilar': [{'pilar': p, 'items': items} for p, items in sorted(pilar_map.items())],
            'flat': [{'id': r['id'], 'status': r['status'], 'prioritas': r['prioritas'],
                      'pilar': r['pilar_kebijakan'] or 'Umum', 'isu_strategis': r['isu_strategis'],
                      'kebijakan': r['kebijakan'], 'rekomendasi': r['rekomendasi_program'],
                      'indikator_terkait': r['indikator_terkait']} for r in rows],
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn: conn.close()


# ── SIMPAN / KELOLA ────────────────────────────────────────────────────────────
@api_view(['POST'])
def save_ipe_analysis(request):
    try:
        name = request.data.get('name', 'Analisis IPE'); data = request.data.get('analysis_data')
        if not data: return Response({"error": "Data tidak ditemukan"}, status=400)
        analysis_id = str(uuid.uuid4())
        doc = {"analysis_id": analysis_id, "name": name, "type": "ipe",
               "timestamp": datetime.now().isoformat(), **data}
        mongo_db["ipe_analysis"].insert_one(doc)
        return Response({"status": "success", "analysis_id": analysis_id, "saved_at": doc["timestamp"]})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_ipe_analysis_list(request):
    try:
        results = list(mongo_db["ipe_analysis"].find(
            {}, {"_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
                 "total_success": 1, "kategori_distribusi": 1, "tahun": 1, "indikator": 1, "ada_prediksi": 1}
        ).sort("timestamp", -1))
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_ipe_analysis_detail(request, analysis_id):
    try:
        result = mongo_db["ipe_analysis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not result: return Response({"error": "Tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_ipe_analysis(request, analysis_id):
    try:
        result = mongo_db["ipe_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0: return Response({"error": "Tidak ditemukan"}, status=404)
        return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['PATCH'])
def patch_provinsi_kebijakan_ipe(request, analysis_id):
    try:
        nama_provinsi = request.data.get('nama_provinsi', '').strip().upper()
        rekomendasi   = request.data.get('rekomendasi')
        if not nama_provinsi: return Response({'error': 'nama_provinsi wajib.'}, status=400)
        if not isinstance(rekomendasi, list): return Response({'error': 'rekomendasi harus array.'}, status=400)
        doc = mongo_db['ipe_analysis'].find_one({'analysis_id': analysis_id})
        if not doc: return Response({'error': 'Tidak ditemukan.'}, status=404)
        features = doc.get('matched_features', {}).get('features', []); updated = False; now = datetime.now().isoformat()
        for feat in features:
            ipe = feat.get('properties', {}).get('ipe_analysis', {})
            if ipe.get('nama_provinsi', '').upper().strip() == nama_provinsi:
                ipe.update({'rekomendasi': rekomendasi, 'rekomendasi_edited': True, 'rekomendasi_edited_at': now})
                feat['properties']['ipe_analysis'] = ipe; updated = True; break
        if not updated: return Response({'error': f'Provinsi "{nama_provinsi}" tidak ditemukan.'}, status=404)
        summary = doc.get('analysis_summary', [])
        for s in summary:
            if s.get('provinsi', '').upper().strip() == nama_provinsi: s['rekomendasi_edited'] = True; break
        mongo_db['ipe_analysis'].update_one(
            {'analysis_id': analysis_id},
            {'$set': {
                'matched_features.features': features, 'analysis_summary': summary,
                f'edits.{nama_provinsi.replace(" ","_")}': {'updated_at': now, 'pilar_count': len(rekomendasi)},
            }}
        )
        return Response({'status': 'success', 'provinsi': nama_provinsi, 'pilar_count': len(rekomendasi), 'updated_at': now})
    except Exception as e:
        import traceback; traceback.print_exc(); return Response({'error': str(e)}, status=500)


@api_view(['GET'])
def get_ols_model_info_ipe(request):
    ols_metrics = _build_ols_metrics(_load_ols_metadata(), [LAJU_PE, PDRB_KAPITA])
    return Response({
        "status": "success",
        "model":  "Regresi Linear (Ordinary Least Squares)",
        "keterangan_kolom": {
            "spe → LAJU_PE":     "Laju Pertumbuhan PDRB ADHK 2010 (%) — Dimensi S1",
            "spk → PDRB_KAPITA": "PDRB per Kapita ADHK 2010 (Ribu Rp) — Dimensi S2",
        },
        "model_info": ols_metrics,
        "timestamp": datetime.now().isoformat(),
    })