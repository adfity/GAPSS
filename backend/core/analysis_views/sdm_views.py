from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import psycopg2, psycopg2.extras
import uuid, math, json, os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env')))

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
mongo_db      = MongoClient(MONGO_URI)[DB_MONGO_NAME]
METADATA_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ai_models', 'sdm')


def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"),
    )


# ── PARAMETER IPM BPS ─────────────────────────────────────────────────────────
AHH_MIN = 20.0; AHH_MAX = 85.0; AHH_DENOM = 65.0
HLS_MAX = 18.0; RLS_MAX = 15.0
PENG_MIN_RP = 1_007_436.0; PENG_MAX_RP = 26_572_352.0
LN_PENG_MIN = math.log(PENG_MIN_RP); LN_PENG_MAX = math.log(PENG_MAX_RP)
LN_PENG_DENOM = LN_PENG_MAX - LN_PENG_MIN

TAHUN_SEMUA = list(range(2010, 2046))
TAHUN_MAX   = 2045

INDIKATOR_DATASET_MAP = {
    'ALL':         ['UHH', 'RLS', 'HLS', 'PENGELUARAN'],
    'KESEHATAN':   ['UHH'],
    'PENDIDIKAN':  ['RLS', 'HLS'],
    'PENGELUARAN': ['PENGELUARAN'],
}
DB_COL_MAP = {'UHH': 'ahh', 'RLS': 'rls', 'HLS': 'hls', 'PENGELUARAN': 'pengeluaran'}

# Label ramah untuk setiap kolom
LABEL_KOLOM = {
    'UHH':         'Angka Harapan Hidup (AHH)',
    'RLS':         'Rata-rata Lama Sekolah (RLS)',
    'HLS':         'Harapan Lama Sekolah (HLS)',
    'PENGELUARAN': 'Pengeluaran per Kapita',
}

WARNA_MAP = {
    'SANGAT_TINGGI':    '#008cd6',
    'TINGGI':           '#abcd05',
    'SEDANG':           '#fff67f',
    'RENDAH':           '#af4284',
    'TIDAK_TERANALISIS':'#a6a6a6',
}
LABEL_MAP = {
    'SANGAT_TINGGI':    'SANGAT TINGGI',
    'TINGGI':           'TINGGI',
    'SEDANG':           'SEDANG',
    'RENDAH':           'RENDAH',
    'TIDAK_TERANALISIS':'TIDAK TERANALISIS',
}

STATUS_VALID       = ('SANGAT_TINGGI', 'TINGGI', 'SEDANG', 'RENDAH')
PRIORITAS_BAND_MAP = {
    'RENDAH': [1,2,3], 'SEDANG': [3,4], 'TINGGI': [4,5,6], 'SANGAT_TINGGI': [5,6],
}


# ── FORMULA ───────────────────────────────────────────────────────────────────
def _ik(ahh):
    if ahh is None: return None
    return max(0.0, min(1.0, (float(ahh) - AHH_MIN) / AHH_DENOM))

def _ip(hls, rls):
    ihls = max(0.0, min(1.0, float(hls)/HLS_MAX)) if hls is not None else None
    irls = max(0.0, min(1.0, float(rls)/RLS_MAX)) if rls is not None else None
    komps = [v for v in [ihls, irls] if v is not None]
    if not komps: return None, None, None
    return round(sum(komps)/len(komps), 6), \
           round(ihls, 6) if ihls is not None else None, \
           round(irls, 6) if irls is not None else None

def _ipeng(peng_rb):
    if peng_rb is None: return None
    peng_rp = float(peng_rb) * 1000.0
    if peng_rp <= 0: return 0.0
    return max(0.0, min(1.0, (math.log(peng_rp) - LN_PENG_MIN) / LN_PENG_DENOM))

def hitung_isdm(ahh, rls, hls, peng_rb, indikator='ALL'):
    ik_val             = _ik(ahh)
    ip_val, ihls, irls = _ip(hls, rls)
    ipeng_val          = _ipeng(peng_rb)

    def geom(*vals):
        arr = [v for v in vals if v is not None]
        if len(arr) < len(vals): return None
        if any(v <= 0 for v in arr): return 0.0
        return round(math.pow(math.prod(arr), 1.0/len(arr)), 6)

    isdm_all_01 = geom(ik_val, ip_val, ipeng_val)
    if indikator == 'KESEHATAN':   isdm_01 = ik_val
    elif indikator == 'PENDIDIKAN': isdm_01 = ip_val
    elif indikator == 'PENGELUARAN': isdm_01 = ipeng_val
    else: isdm_01 = isdm_all_01

    def x100(v): return round(v*100, 2) if v is not None else None
    return {
        'ik': round(ik_val,6) if ik_val is not None else None,
        'ip': round(ip_val,6) if ip_val is not None else None,
        'ipeng': round(ipeng_val,6) if ipeng_val is not None else None,
        'ihls': round(ihls,6) if ihls is not None else None,
        'irls': round(irls,6) if irls is not None else None,
        'indeks_sdm':     x100(isdm_01),
        'indeks_sdm_all': x100(isdm_all_01),
        'indeks_sdm_01':  isdm_01,
    }

def hitung_per_indikator(ahh, rls, hls, peng_rb):
    result = {}
    for ind in ['ALL','KESEHATAN','PENDIDIKAN','PENGELUARAN']:
        s = hitung_isdm(ahh, rls, hls, peng_rb, ind)
        k, w, _ = kategorisasi(s['indeks_sdm'])
        result[ind] = {'kategori': k, 'warna': w}
    return result

def kategorisasi(nilai_100):
    if nilai_100 is None: return 'TIDAK_TERANALISIS', '#a6a6a6', 'TIDAK TERANALISIS'
    if nilai_100 >= 80:   return 'SANGAT_TINGGI',     '#008cd6', 'SANGAT TINGGI'
    if nilai_100 >= 70:   return 'TINGGI',             '#abcd05', 'TINGGI'
    if nilai_100 >= 60:   return 'SEDANG',             '#fff67f', 'SEDANG'
    return                       'RENDAH',             '#af4284', 'RENDAH'


# ── NORMALIZER ────────────────────────────────────────────────────────────────
def normalize_province_name(name):
    name = str(name)
    for tag in ['<b>','</b>','<B>','</B>']: name = name.replace(tag, '')
    name = name.upper().strip()
    SPECIAL = {
        'DKI JAKARTA':'JAKARTA','DAERAH KHUSUS IBUKOTA JAKARTA':'JAKARTA',
        'YOGYAKARTA':'DAERAH ISTIMEWA YOGYAKARTA','DIY':'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA':'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG':'KEPULAUAN BANGKA BELITUNG','KEP. BANGKA BELITUNG':'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU':'KEPULAUAN RIAU',
    }
    for k, v in SPECIAL.items():
        if k in name: return v
    for a, f in {'KEP.':'KEPULAUAN','NTB':'NUSA TENGGARA BARAT','NTT':'NUSA TENGGARA TIMUR'}.items():
        name = name.replace(a, f)
    for prefix in ['PROVINSI ','PROV. ','PROV ','DAERAH KHUSUS IBUKOTA ']:
        if name.startswith(prefix): name = name[len(prefix):]
    return name.strip()


# ── METADATA REGRESI LINEAR OLS ───────────────────────────────────────────────
def _load_ols_metadata():
    files = {
        'UHH':         'uhh_metadata.json',
        'RLS':         'rls_metadata.json',
        'HLS':         'hls_metadata.json',
        'PENGELUARAN': 'pengeluaran_metadata.json',
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
        if not m: continue
        ev   = m.get('evaluasi_ringkasan', {})
        mape = ev.get('rata_rata_MAPE (%)')
        metrics[k] = {
            'model':          'Regresi Linear (Ordinary Least Squares)',
            'tahun_training': m.get('tahun_training'),
            'tahun_prediksi': m.get('tahun_prediksi'),
            'jumlah_wilayah': m.get('jumlah_wilayah'),
            'mape_pct':       mape,
            'mae':            ev.get('rata_rata_MAE (Ribu Rupiah)') or ev.get('rata_rata_MAE'),
            'quality':        _quality_label(mape),
        }
    return metrics

def _quality_label(mape):
    if mape is None: return {'grade':'?','label':'Tidak Diketahui','color':'#94a3b8'}
    if mape < 2:  return {'grade':'🥇','label':'Sangat Baik','color':'#10b981'}
    if mape < 5:  return {'grade':'✅','label':'Baik','color':'#3b82f6'}
    if mape < 10: return {'grade':'⚠️','label':'Cukup','color':'#f59e0b'}
    return              {'grade':'❌','label':'Perlu Perhatian','color':'#ef4444'}


# ── DB CHECK & FETCH ──────────────────────────────────────────────────────────

def check_data_tersedia(tahun, keys_aktif):
    """
    Selalu cek indikator_wilayah terlebih dahulu.
    Jika kolom kosong/NULL → cek apakah tersedia di prediksi_indikator_wilayah.
    Return:
      dataset_status: dict per kolom → {sumber, jumlah_aktual, jumlah_prediksi, tersedia, perlu_prediksi}
      ada_prediksi:   bool, True jika ada kolom yang butuh fallback prediksi
      semua_tersedia: bool, True jika semua kolom tersedia (aktual atau prediksi)
    """
    dataset_status = {}
    ada_prediksi   = False
    conn = None
    try:
        conn = get_pg_connection()
        for k in keys_aktif:
            col = DB_COL_MAP[k]

            # Cek aktual
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
                # Tidak ada di aktual → cek prediksi
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
        if conn: conn.close()

    semua_tersedia = all(v['tersedia'] for v in dataset_status.values())
    return dataset_status, ada_prediksi, semua_tersedia


def fetch_data_from_db(tahun, keys_aktif):
    """
    Ambil data: indikator_wilayah dulu, NULL → isi dari prediksi_indikator_wilayah.
    Return (dict{prov: entry}, ada_prediksi)
    """
    kolom_sql = ['provinsi', 'kode_wilayah'] + [DB_COL_MAP[k] for k in keys_aktif]
    result = {}; ada_prediksi = False
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
                val = row.get(DB_COL_MAP[k])
                entry[k] = float(val) if val is not None else None
            result[prov] = entry

        # Langkah 2: prediksi sebagai fallback untuk NULL
        prov_null = {p: [k for k in keys_aktif if result[p].get(k) is None] for p in result}
        prov_null = {p: v for p, v in prov_null.items() if v}

        if not result:
            cur.execute(
                f"SELECT {', '.join(kolom_sql)} FROM prediksi_indikator_wilayah "
                f"WHERE tahun=%s AND level='provinsi' ORDER BY provinsi",
                (tahun,)
            )
            for row in cur.fetchall():
                prov = normalize_province_name(row['provinsi'])
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
                if not pred_row: continue
                for k in missing_keys:
                    val = pred_row.get(DB_COL_MAP[k])
                    if val is not None:
                        result[prov][k] = float(val)
                        result[prov]['kolom_prediksi'].append(k)
                        ada_prediksi = True
                kp = result[prov]['kolom_prediksi']
                if kp:
                    result[prov]['sumber'] = 'prediksi' if set(kp) == set(keys_aktif) else 'campuran'

        cur.close()
    except Exception as e:
        print(f"✗ fetch_data_from_db({tahun}): {e}")
    finally:
        if conn: conn.close()
    return result, ada_prediksi


# ── INSIGHTS ──────────────────────────────────────────────────────────────────
def generate_insights(prov, ahh, rls, hls, peng_rb, scores, kat_label, isdm_100, indikator, sumber, kolom_prediksi):
    src = {
        'aktual':   '(Aktual BPS)',
        'prediksi': '(Prediksi Regresi Linear OLS)',
        'campuran': '(Aktual+Prediksi)',
    }.get(sumber, '')
    insights = [f"Provinsi {prov} — ISDM {isdm_100} → {kat_label} {src}."]
    if kolom_prediksi:
        nama_kol = ', '.join(LABEL_KOLOM.get(k, k) for k in kolom_prediksi)
        insights.insert(1, f"⚙️ Data {nama_kol} diambil dari prediksi Regresi Linear (OLS)")
    ik, ip, ipeng = scores['ik'], scores['ip'], scores['ipeng']
    if indikator in ('ALL', 'KESEHATAN') and ahh is not None:
        ico = '✅' if ahh >= 68 else ('⚠️' if ahh >= 61 else '🚨')
        insights.append(f"{ico} AHH {ahh} th → IK={round(ik*100,2) if ik else '-'}.")
    if indikator in ('ALL', 'PENDIDIKAN'):
        if rls is not None:
            ico = '✅' if rls >= 9 else ('⚠️' if rls >= 7 else '🚨')
            insights.append(f"{ico} RLS {rls} th (IRLS={round(scores['irls']*100,2) if scores['irls'] else '-'}).")
        if hls is not None:
            ico = '✅' if hls >= 13 else ('⚠️' if hls >= 11 else '🚨')
            insights.append(f"{ico} HLS {hls} th (IHLS={round(scores['ihls']*100,2) if scores['ihls'] else '-'}).")
        if ip is not None:
            insights.append(f"   IP = {round(ip*100,2)}.")
    if indikator in ('ALL', 'PENGELUARAN') and peng_rb is not None:
        peng_rp = peng_rb * 1000
        ico = '💰' if (ipeng or 0) >= 0.7 else ('💵' if (ipeng or 0) >= 0.4 else '💸')
        insights.append(f"{ico} Pengeluaran Rp{peng_rp:,.0f} → IPeng={round(ipeng*100,2) if ipeng else '-'}.")
    return insights


# ── KEBIJAKAN ─────────────────────────────────────────────────────────────────
def get_bank_kebijakan_by_kategori(kategori_key, limit=10):
    prio_list = PRIORITAS_BAND_MAP.get(kategori_key, [3, 4])
    results, conn = [], None
    try:
        conn = get_pg_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        ph = ','.join(['%s'] * len(prio_list))
        cur.execute(
            f"SELECT id,status,prioritas,pilar_kebijakan,isu_strategis,kebijakan,rekomendasi_program,indikator_terkait "
            f"FROM bank_kebijakan WHERE indeks='ISDM' AND status=%s AND prioritas IN ({ph}) "
            f"ORDER BY prioritas ASC,pilar_kebijakan ASC LIMIT %s",
            (kategori_key, *prio_list, limit)
        )
        rows = [dict(r) for r in cur.fetchall()]
        if not rows and kategori_key == 'SANGAT_TINGGI':
            cur.execute(
                "SELECT id,status,prioritas,pilar_kebijakan,isu_strategis,kebijakan,rekomendasi_program,indikator_terkait "
                "FROM bank_kebijakan WHERE indeks='ISDM' AND status='TINGGI' ORDER BY prioritas ASC LIMIT %s",
                (limit,)
            )
            rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            cur.execute(
                "SELECT id,status,prioritas,pilar_kebijakan,isu_strategis,kebijakan,rekomendasi_program,indikator_terkait "
                "FROM bank_kebijakan WHERE indeks='ISDM' AND status=%s ORDER BY prioritas ASC LIMIT %s",
                (kategori_key, limit)
            )
            rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        pilar_map = {}
        for row in rows:
            pilar = row['pilar_kebijakan'] or 'Umum'
            pilar_map.setdefault(pilar, {'pilar': pilar, 'prioritas': row['prioritas'], 'jumlah_aksi': 0, 'aksi': []})
            pilar_map[pilar]['aksi'].append({
                'no_aksi':        len(pilar_map[pilar]['aksi']) + 1,
                'isu_strategis':  row['isu_strategis'],
                'nama_aksi':      row['kebijakan'],
                'detail_aksi':    row['rekomendasi_program'],
                'indikator_terkait': row['indikator_terkait'],
                'sub_sektor':     row['pilar_kebijakan'],
            })
            pilar_map[pilar]['jumlah_aksi'] += 1
        results = list(pilar_map.values())
    except Exception as e:
        print(f"✗ get_bank_kebijakan: {e}")
    finally:
        if conn: conn.close()
    return results


# ── API: CHECK DATA ───────────────────────────────────────────────────────────

@api_view(['POST'])
def check_sdm_year_data(request):
    """
    Selalu cek indikator_wilayah dulu.
    Response mencakup:
      - dataset_status: detail per kolom (sumber, tersedia, perlu_prediksi)
      - ada_prediksi: apakah ada kolom yang butuh fallback Regresi Linear OLS
      - kolom_prediksi: list kolom yang akan pakai prediksi
      - pesan_peringatan: string peringatan jika ada kolom prediksi
      - bisa_dieksekusi: semua kolom bisa diisi (aktual atau prediksi)
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

    # OLS metrics hanya untuk kolom yang prediksi
    ols_metrics = {}
    if ada_pred:
        all_meta    = _load_ols_metadata()
        ols_metrics = _build_ols_metrics(all_meta, kolom_prediksi)

    return Response({
        "tahun":             tahun,
        "indikator":         indikator,
        "dataset_status":    dataset_status,
        "kolom_aktual":      kolom_aktual,
        "kolom_prediksi":    kolom_prediksi,
        "kolom_kosong":      kolom_kosong,
        "ada_prediksi":      ada_pred,
        "semua_tersedia":    semua,
        "semua_aktual":      not ada_pred and semua,
        "bisa_dieksekusi":   semua,
        "pesan_peringatan":  pesan_peringatan,
        "ols_metrics":       ols_metrics,
    })


# ── API: ANALYZE ──────────────────────────────────────────────────────────────

@api_view(['POST'])
def analyze_sdm_bps(request):
    """
    Analisis ISDM. Selalu cek indikator_wilayah dulu, fallback ke prediksi.
    Parameter tambahan:
      gunakan_prediksi: bool (harus True jika ada kolom prediksi, validasi FE)
    """
    try:
        tahun            = int(request.data.get('tahun', 2024))
        indikator        = request.data.get('indikator', 'ALL')
        gunakan_prediksi = request.data.get('gunakan_prediksi', False)

        if indikator not in INDIKATOR_DATASET_MAP: indikator = 'ALL'
        if tahun not in TAHUN_SEMUA:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)

        keys_aktif = INDIKATOR_DATASET_MAP[indikator]

        _, ada_pred, semua = check_data_tersedia(tahun, keys_aktif)
        if ada_pred and not gunakan_prediksi:
            return Response({
                "error": "Ada kolom yang memerlukan data prediksi. Kirim gunakan_prediksi=true untuk melanjutkan.",
                "ada_prediksi": True,
            }, status=400)

        db_data, ada_prediksi = fetch_data_from_db(tahun, keys_aktif)
        if not db_data:
            return Response({"error": f"Tidak ada data untuk tahun {tahun}."}, status=404)

        ols_metrics = {}
        if ada_prediksi:
            all_meta    = _load_ols_metadata()
            ols_metrics = _build_ols_metrics(all_meta, keys_aktif)

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
                    all_boundary_names.add(normalize_province_name(str(props[field]))); break

        all_provs         = all_boundary_names | set(db_data.keys())
        matched_features  = []
        analysis_summary  = []
        sdm_data_for_xlsx = {}
        kategori_counts   = {'SANGAT_TINGGI': 0, 'TINGGI': 0, 'SEDANG': 0, 'RENDAH': 0, 'TIDAK_TERANALISIS': 0}
        kebijakan_cache   = {}

        for prov_name in sorted(all_provs):
            row = db_data.get(prov_name)
            norm = normalize_province_name(prov_name)
            matched_feature = (
                province_map.get(norm) or province_map.get(prov_name) or
                next((f for mn, f in province_map.items() if norm in mn or mn in norm), None)
            )
            if not matched_feature: continue

            has_data = row is not None and any(row.get(k) is not None for k in keys_aktif)
            if not has_data:
                kategori_counts['TIDAK_TERANALISIS'] += 1
                fc = matched_feature.copy(); pc = fc.get('properties', {}).copy()
                pc['sdm_analysis'] = {
                    'nama_provinsi': prov_name, 'indikator': indikator,
                    'kategori': 'TIDAK_TERANALISIS', 'kategori_label': 'TIDAK TERANALISIS', 'warna': '#a6a6a6',
                    'indeks_sdm': None, 'indeks_sdm_all': None, 'indeks_sdm_01': None,
                    'ik': None, 'ip': None, 'ipeng': None, 'ihls': None, 'irls': None,
                    'insights': [f"Provinsi {prov_name} tidak memiliki data untuk tahun {tahun}."],
                    'rekomendasi': [], 'sumber': 'tidak_tersedia', 'kolom_prediksi': [],
                    'kategori_per_indikator': {i: 'TIDAK_TERANALISIS' for i in ['ALL', 'KESEHATAN', 'PENDIDIKAN', 'PENGELUARAN']},
                    'warna_per_indikator':    {i: '#a6a6a6' for i in ['ALL', 'KESEHATAN', 'PENDIDIKAN', 'PENGELUARAN']},
                    'data_komponen': {k: None for k in ['UHH', 'HLS', 'RLS', 'PENGELUARAN']},
                }
                fc['properties'] = pc; matched_features.append(fc)
                analysis_summary.append({
                    'provinsi': prov_name, 'indikator': indikator,
                    'kategori': 'TIDAK_TERANALISIS', 'kategori_label': 'TIDAK TERANALISIS', 'warna': '#a6a6a6',
                    'indeks_sdm': None, 'indeks_sdm_all': None,
                    'ik': None, 'ip': None, 'ipeng': None,
                    'uhh': None, 'hls': None, 'rls': None, 'pengeluaran': None,
                    'kategori_per_indikator': {i: 'TIDAK_TERANALISIS' for i in ['ALL', 'KESEHATAN', 'PENDIDIKAN', 'PENGELUARAN']},
                    'warna_per_indikator':    {i: '#a6a6a6' for i in ['ALL', 'KESEHATAN', 'PENDIDIKAN', 'PENGELUARAN']},
                    'sumber': 'tidak_tersedia', 'kolom_prediksi': [],
                })
                continue

            ahh         = row.get('UHH')         if 'UHH'         in keys_aktif else None
            hls         = row.get('HLS')         if 'HLS'         in keys_aktif else None
            rls         = row.get('RLS')         if 'RLS'         in keys_aktif else None
            pengeluaran = row.get('PENGELUARAN') if 'PENGELUARAN' in keys_aktif else None
            sumber      = row.get('sumber', 'aktual')
            kolom_pred  = row.get('kolom_prediksi', [])

            scores                    = hitung_isdm(ahh, rls, hls, pengeluaran, indikator)
            isdm_100                  = scores['indeks_sdm']
            kat_key, warna, kat_label = kategorisasi(isdm_100)
            insights                  = generate_insights(
                prov_name, ahh, rls, hls, pengeluaran,
                scores, kat_label, isdm_100, indikator, sumber, kolom_pred,
            )

            per_ind       = hitung_per_indikator(ahh, rls, hls, pengeluaran)
            kat_per_ind   = {ind: per_ind[ind]['kategori'] for ind in per_ind}
            warna_per_ind = {ind: per_ind[ind]['warna']    for ind in per_ind}

            bucket = (round(isdm_100 / 5) * 5) if isdm_100 is not None else None
            ck = (kat_key, bucket)
            if ck not in kebijakan_cache: kebijakan_cache[ck] = get_bank_kebijakan_by_kategori(kat_key, 10)
            rekomendasi = kebijakan_cache[ck]
            kategori_counts[kat_key] = kategori_counts.get(kat_key, 0) + 1

            fc = matched_feature.copy(); pc = fc.get('properties', {}).copy()
            pc['sdm_analysis'] = {
                'nama_provinsi': prov_name, 'indikator': indikator,
                'kategori': kat_key, 'kategori_label': kat_label, 'warna': warna,
                'indeks_sdm': isdm_100, 'indeks_sdm_all': scores['indeks_sdm_all'], 'indeks_sdm_01': scores['indeks_sdm_01'],
                'ik': scores['ik'], 'ip': scores['ip'], 'ipeng': scores['ipeng'], 'ihls': scores['ihls'], 'irls': scores['irls'],
                'insights': insights, 'rekomendasi': rekomendasi,
                'kategori_per_indikator': kat_per_ind,
                'warna_per_indikator':    warna_per_ind,
                'sumber': sumber, 'kolom_prediksi': kolom_pred,
                'data_komponen': {'UHH': ahh, 'HLS': hls, 'RLS': rls, 'PENGELUARAN': pengeluaran},
                'ols_metrics': {k: ols_metrics.get(k) for k in kolom_pred} if kolom_pred else {},
            }
            fc['properties'] = pc; matched_features.append(fc)

            summary_row = {
                'provinsi': prov_name, 'indikator': indikator,
                'kategori': kat_key, 'kategori_label': kat_label, 'warna': warna,
                'indeks_sdm': isdm_100, 'indeks_sdm_all': scores['indeks_sdm_all'],
                'ik': scores['ik'], 'ip': scores['ip'], 'ipeng': scores['ipeng'],
                'ihls': scores['ihls'], 'irls': scores['irls'],
                'uhh': ahh, 'hls': hls, 'rls': rls, 'pengeluaran': pengeluaran,
                'kategori_per_indikator': kat_per_ind,
                'warna_per_indikator':    warna_per_ind,
                'sumber': sumber, 'kolom_prediksi': kolom_pred,
            }
            analysis_summary.append(summary_row)
            sdm_data_for_xlsx[prov_name] = summary_row.copy()

        sorted_summary = sorted(
            [s for s in analysis_summary if s['indeks_sdm'] is not None],
            key=lambda x: x['indeks_sdm'],
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
            'status': 'success', 'source': source_label, 'tahun': tahun, 'indikator': indikator,
            'ada_prediksi': ada_prediksi, 'dataset_aktif': keys_aktif,
            'total_success':           len([s for s in analysis_summary if s['kategori'] != 'TIDAK_TERANALISIS']),
            'total_tidak_teranalisis': kategori_counts['TIDAK_TERANALISIS'],
            'kategori_distribusi': kategori_counts,
            'timestamp': datetime.now().isoformat(),
            'formula': {
                'IK':    '(AHH-20)/(85-20)',
                'IP':    '(HLS/18+RLS/15)/2',
                'IPeng': '[ln(Peng_Rp)-ln(1007436)]/[ln(26572352)-ln(1007436)]',
                'ISDM':  '³√(IK×IP×IPeng)×100',
            },
            'parameter_bps': {
                'AHH_min': AHH_MIN, 'AHH_max': AHH_MAX,
                'HLS_max': HLS_MAX, 'RLS_max': RLS_MAX,
                'Peng_min_Rp': PENG_MIN_RP, 'Peng_max_Rp': PENG_MAX_RP,
            },
            'klasifikasi': {k: {'warna': WARNA_MAP[k], 'label': LABEL_MAP[k]} for k in ['SANGAT_TINGGI', 'TINGGI', 'SEDANG', 'RENDAH', 'TIDAK_TERANALISIS']},
            'ada_prediksi': ada_prediksi,
            'ols_metrics':  ols_metrics,
            'matched_features':   {'type': 'FeatureCollection', 'features': matched_features},
            'analysis_summary':   analysis_summary,
            'sdm_data':           sdm_data_for_xlsx,
            'worst_provinces':    sorted_summary[:5],
            'best_provinces':     sorted_summary[-5:][::-1],
            'colors':             WARNA_MAP,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e), "message": "Gagal menganalisis data SDM"}, status=500)


# ── BANK KEBIJAKAN ─────────────────────────────────────────────────────────────
def _k_row(r):
    return {
        "id": r["id"], "status": r["status"], "prioritas": r["prioritas"],
        "pilar": r["pilar_kebijakan"], "kebijakan": r["kebijakan"],
        "rekomendasi": r["rekomendasi_program"], "indikator": r["indikator_terkait"],
        "isu_strategis": r.get("isu_strategis"),
    }

@api_view(['GET'])
def get_bank_kebijakan_sdm(request):
    conn = None
    try:
        conn = get_pg_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q = "SELECT id,indeks,status,prioritas,pilar_kebijakan,isu_strategis,kebijakan,rekomendasi_program,indikator_terkait FROM bank_kebijakan WHERE indeks='ISDM'"
        params = []; sf = request.GET.get('status'); pf = request.GET.get('pilar')
        if sf and sf.upper() in STATUS_VALID: q += " AND status=%s"; params.append(sf.upper())
        if pf: q += " AND pilar_kebijakan ILIKE %s"; params.append(f"%{pf}%")
        q += " ORDER BY status ASC,prioritas ASC,pilar_kebijakan ASC"; cur.execute(q, params)
        hasil = [_k_row(dict(r)) for r in cur.fetchall()]; cur.close()
        return Response({"status": "success", "count": len(hasil), "results": hasil})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()

@api_view(['POST'])
def add_bank_kebijakan_sdm(request):
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
            "VALUES('ISDM',%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (status, int(data['prioritas']), data['pilar_kebijakan'], data.get('isu_strategis', ''),
             data['kebijakan'], data['rekomendasi_program'], data['indikator_terkait'].upper())
        )
        new_id = cur.fetchone()['id']; conn.commit(); cur.close()
        return Response({"status": "success", "id": new_id})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()

@api_view(['PUT'])
def update_bank_kebijakan_sdm(request, kebijakan_id):
    conn = None
    try:
        d = request.data; status = d.get('status', '').upper()
        if status not in STATUS_VALID: return Response({"error": "Status tidak valid."}, status=400)
        conn = get_pg_connection(); cur = conn.cursor()
        cur.execute(
            "UPDATE bank_kebijakan SET status=%s,prioritas=%s,pilar_kebijakan=%s,isu_strategis=%s,"
            "kebijakan=%s,rekomendasi_program=%s,indikator_terkait=%s WHERE id=%s AND indeks='ISDM'",
            (status, int(d['prioritas']), d['pilar_kebijakan'], d.get('isu_strategis', ''),
             d['kebijakan'], d['rekomendasi_program'], d['indikator_terkait'].upper(), kebijakan_id)
        )
        if cur.rowcount == 0: return Response({"error": "Tidak ditemukan."}, status=404)
        conn.commit(); cur.close(); return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()

@api_view(['DELETE'])
def delete_bank_kebijakan_sdm(request, kebijakan_id):
    conn = None
    try:
        conn = get_pg_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM bank_kebijakan WHERE id=%s AND indeks='ISDM'", (kebijakan_id,))
        if cur.rowcount == 0: return Response({"error": "Tidak ditemukan."}, status=404)
        conn.commit(); cur.close(); return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()

@api_view(['POST'])
def save_sdm_analysis(request):
    try:
        name = request.data.get('name', 'Analisis SDM'); data = request.data.get('analysis_data')
        if not data: return Response({"error": "Data tidak ditemukan"}, status=400)
        analysis_id = str(uuid.uuid4())
        doc = {"analysis_id": analysis_id, "name": name, "type": "sdm", "timestamp": datetime.now().isoformat(), **data}
        mongo_db["sdm_analysis"].insert_one(doc)
        return Response({"status": "success", "analysis_id": analysis_id, "saved_at": doc["timestamp"]})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def get_sdm_analysis_list(request):
    try:
        results = list(mongo_db["sdm_analysis"].find(
            {},
            {"_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1, "total_success": 1,
             "kategori_distribusi": 1, "tahun": 1, "indikator": 1, "ada_prediksi": 1}
        ).sort("timestamp", -1))
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def get_sdm_analysis_detail(request, analysis_id):
    try:
        result = mongo_db["sdm_analysis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not result: return Response({"error": "Tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['DELETE'])
def delete_sdm_analysis(request, analysis_id):
    try:
        result = mongo_db["sdm_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0: return Response({"error": "Tidak ditemukan"}, status=404)
        return Response({"status": "success"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def get_bank_kebijakan_isdm_for_provinsi(request):
    conn = None
    try:
        conn = get_pg_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        q = ("SELECT id,status,prioritas,pilar_kebijakan,isu_strategis,kebijakan,rekomendasi_program,indikator_terkait "
             "FROM bank_kebijakan WHERE indeks='ISDM'")
        params = []; sf = request.GET.get('status', '').upper()
        if sf in STATUS_VALID: q += " AND status=%s"; params.append(sf)
        q += " ORDER BY status ASC,prioritas ASC,pilar_kebijakan ASC"; cur.execute(q, params)
        rows = [dict(r) for r in cur.fetchall()]; cur.close()
        pilar_map = {}
        for r in rows:
            p = r['pilar_kebijakan'] or 'Umum'
            pilar_map.setdefault(p, []).append({
                'id': r['id'], 'status': r['status'], 'prioritas': r['prioritas'],
                'pilar': p, 'isu_strategis': r['isu_strategis'],
                'kebijakan': r['kebijakan'], 'rekomendasi': r['rekomendasi_program'],
                'indikator_terkait': r['indikator_terkait'],
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

@api_view(['PATCH'])
def patch_provinsi_kebijakan(request, analysis_id):
    try:
        nama_provinsi = request.data.get('nama_provinsi', '').strip().upper()
        rekomendasi   = request.data.get('rekomendasi')
        if not nama_provinsi: return Response({'error': 'nama_provinsi wajib.'}, status=400)
        if not isinstance(rekomendasi, list): return Response({'error': 'rekomendasi harus array.'}, status=400)
        doc = mongo_db['sdm_analysis'].find_one({'analysis_id': analysis_id})
        if not doc: return Response({'error': 'Tidak ditemukan.'}, status=404)
        features = doc.get('matched_features', {}).get('features', [])
        updated, now = False, datetime.now().isoformat()
        for feat in features:
            sdm = feat.get('properties', {}).get('sdm_analysis', {})
            if sdm.get('nama_provinsi', '').upper().strip() == nama_provinsi:
                sdm.update({'rekomendasi': rekomendasi, 'rekomendasi_edited': True, 'rekomendasi_edited_at': now})
                feat['properties']['sdm_analysis'] = sdm; updated = True; break
        if not updated: return Response({'error': f'Provinsi "{nama_provinsi}" tidak ditemukan.'}, status=404)
        summary = doc.get('analysis_summary', [])
        for s in summary:
            if s.get('provinsi', '').upper().strip() == nama_provinsi:
                s['rekomendasi_edited'] = True; break
        mongo_db['sdm_analysis'].update_one(
            {'analysis_id': analysis_id},
            {'$set': {
                'matched_features.features': features,
                'analysis_summary': summary,
                f'edits.{nama_provinsi.replace(" ", "_")}': {'updated_at': now, 'pilar_count': len(rekomendasi)},
            }}
        )
        return Response({'status': 'success', 'provinsi': nama_provinsi, 'pilar_count': len(rekomendasi), 'updated_at': now})
    except Exception as e:
        import traceback; traceback.print_exc(); return Response({'error': str(e)}, status=500)

@api_view(['GET'])
def get_ols_model_info(request):
    """Informasi model Regresi Linear OLS yang digunakan untuk prediksi."""
    all_meta    = _load_ols_metadata()
    ols_metrics = _build_ols_metrics(all_meta, list(DB_COL_MAP.keys()))
    return Response({
        "status":     "success",
        "model":      "Regresi Linear (Ordinary Least Squares)",
        "model_info": ols_metrics,
        "timestamp":  datetime.now().isoformat(),
    })