"""
pangan_views.py
─────────────────────────────────────────────────────────────────────────────
Backend analisis Indeks Ketahanan Pangan (IKP) — versi pangan.

Rumus IKP:
  IKv  = Produksi Padi (Ton) / Jumlah Penduduk (Ribu Jiwa)
  IA   = 1 - (Persentase Penduduk Miskin / 100)
  IPm  = (Konsumsi Protein / 57) + (Konsumsi Kalori / 2100)   → cap di 2.0
  IS   = 1 / CV Produksi Padi 5 tahun terakhir                → cap di 1.0

Normalisasi Min-Max ke [0-1], kemudian:
  IKP  = (IKv_norm + IA_norm + IPm_norm + IS_norm) / 4

Klasifikasi:
  IKP > 0.70  → TINGGI
  IKP 0.40-0.70 → SEDANG
  IKP < 0.40  → RENDAH

Sumber data BPS (live):
  - Produksi Padi  : SIMDASI id_tabel ZjZ6MXlacGJNR0JaaHBPRSs0TzNUdz09  (tahun)
  - Konsumsi       : static table 951
  - Kemiskinan     : var/192 (Semester 2 / September, turvar=434=Jumlah)
  - Penduduk       : SIMDASI id_tabel WVRlTTcySlZDa3lUcFp6czNwbHl4QT09   (tahun)

Prediksi ARIMA (2026-2045):
  Model disimpan di:  backend/core/ai_models/pangan/
    model_padi.pkl, metadata_padi.json
    model_kemiskinan.pkl, metadata_kemiskinan.json
    model_kalori.pkl, metadata_kalori.json
    model_protein.pkl, metadata_protein.json
  Penduduk:
    backend/core/ai_models/penduduk/
    model_penduduk.pkl, metadata_penduduk.json
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import psycopg2, psycopg2.extras
import requests, uuid, warnings, joblib, numpy as np, json, os, re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env')))

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
BPS_API_KEY   = os.getenv("BPS_WEB_API_KEY")

mongo_db = MongoClient(MONGO_URI)[DB_MONGO_NAME]


def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"),
    )


# ── PATH MODELS ───────────────────────────────────────────────────────────────

PANGAN_MODELS_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ai_models', 'pangan')
PENDUDUK_MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ai_models', 'penduduk')

PANGAN_MODEL_FILES = {
    'PADI':       'model_padi.pkl',
    'KEMISKINAN': 'model_kemiskinan.pkl',
    'KALORI':     'model_kalori.pkl',
    'PROTEIN':    'model_protein.pkl',
}
PANGAN_METADATA_FILES = {
    'PADI':       'metadata_padi.json',
    'KEMISKINAN': 'metadata_kemiskinan.json',
    'KALORI':     'metadata_kalori.json',
    'PROTEIN':    'metadata_protein.json',
}
PENDUDUK_MODEL_FILE    = 'model_penduduk.pkl'
PENDUDUK_METADATA_FILE = 'metadata_penduduk.json'

# ── KONSTANTA ─────────────────────────────────────────────────────────────────

LAST_HIST_YEAR     = 2025          # tahun historis terakhir yang tersedia di BPS
TAHUN_MAX_PREDIKSI = 2045
TAHUN_BPS_AKTUAL   = list(range(2020, LAST_HIST_YEAR + 1))     # 2020-2025
TAHUN_ARIMA_ONLY   = list(range(LAST_HIST_YEAR + 1, TAHUN_MAX_PREDIKSI + 1))  # 2026-2045
TAHUN_SEMUA        = sorted(TAHUN_BPS_AKTUAL + TAHUN_ARIMA_ONLY)

# BPS static-table tahun-code mapping (untuk Konsumsi & Kemiskinan)
TAHUN_BPS_MAP = {
    2020: 120, 2021: 121, 2022: 122, 2023: 123, 2024: 124, 2025: 125,
}

# IKP threshold
THRESHOLD_TINGGI = 0.70
THRESHOLD_SEDANG = 0.40

# IPm: standar AKG (Permenkes 28/2019)
PROTEIN_STANDAR = 57.0    # gram/kapita/hari
KALORI_STANDAR  = 2100.0  # kkal/kapita/hari

# Clip ranges untuk ARIMA
CLIP_RANGE_PANGAN = {
    'PADI':       (0.0, 20_000_000.0),
    'KEMISKINAN': (0.0, 50.0),
    'KALORI':     (1000.0, 4000.0),
    'PROTEIN':    (20.0, 120.0),
    'PENDUDUK':   (100.0, 60_000.0),   # ribu jiwa
}

CV_METRICS_FALLBACK = {
    'PADI':       {'cv_mae': 50000.0,  'cv_rmse': 80000.0,  'cv_wmape': 3.50},
    'KEMISKINAN': {'cv_mae': 0.50,     'cv_rmse': 0.75,     'cv_wmape': 2.80},
    'KALORI':     {'cv_mae': 30.0,     'cv_rmse': 45.0,     'cv_wmape': 1.50},
    'PROTEIN':    {'cv_mae': 1.5,      'cv_rmse': 2.2,      'cv_wmape': 2.10},
    'PENDUDUK':   {'cv_mae': 50.0,     'cv_rmse': 80.0,     'cv_wmape': 1.20},
}

KODE_PROVINSI_MAP = {
    '11': 'ACEH',                       '12': 'SUMATERA UTARA',
    '13': 'SUMATERA BARAT',             '14': 'RIAU',
    '15': 'JAMBI',                      '16': 'SUMATERA SELATAN',
    '17': 'BENGKULU',                   '18': 'LAMPUNG',
    '19': 'KEPULAUAN BANGKA BELITUNG',  '21': 'KEPULAUAN RIAU',
    '31': 'JAKARTA',                    '32': 'JAWA BARAT',
    '33': 'JAWA TENGAH',                '34': 'DAERAH ISTIMEWA YOGYAKARTA',
    '35': 'JAWA TIMUR',                 '36': 'BANTEN',
    '51': 'BALI',                       '52': 'NUSA TENGGARA BARAT',
    '53': 'NUSA TENGGARA TIMUR',        '61': 'KALIMANTAN BARAT',
    '62': 'KALIMANTAN TENGAH',          '63': 'KALIMANTAN SELATAN',
    '64': 'KALIMANTAN TIMUR',           '65': 'KALIMANTAN UTARA',
    '71': 'SULAWESI UTARA',             '72': 'SULAWESI TENGAH',
    '73': 'SULAWESI SELATAN',           '74': 'SULAWESI TENGGARA',
    '75': 'GORONTALO',                  '76': 'SULAWESI BARAT',
    '81': 'MALUKU',                     '82': 'MALUKU UTARA',
    '91': 'PAPUA BARAT',                '92': 'PAPUA BARAT DAYA',
    '94': 'PAPUA',                      '95': 'PAPUA SELATAN',
    '96': 'PAPUA TENGAH',               '97': 'PAPUA PEGUNUNGAN',
}

PROVINSI_FALLBACK = {
    'PAPUA SELATAN':    'PAPUA',
    'PAPUA TENGAH':     'PAPUA',
    'PAPUA PEGUNUNGAN': 'PAPUA',
    'PAPUA BARAT DAYA': 'PAPUA BARAT',
}

# Prioritas kebijakan per band nilai IKP (mirip SDM PRIORITAS_BAND)
PRIORITAS_BAND_IKP = {
    'RENDAH': [(0.00, 0.20, [1, 2]), (0.20, 0.30, [1, 2, 3]), (0.30, 0.40, [2, 3, 4])],
    'SEDANG': [(0.00, 0.55, [3, 4]),  (0.55, 0.63, [4, 5]),    (0.63, 0.70, [5, 6])],
    'TINGGI': [(0.00, 0.80, [4, 5]),  (0.80, 0.90, [5, 6]),    (0.90, 1.00, [6, 7])],
}
_PRIORITAS_FALLBACK_IKP = {'RENDAH': [1, 2, 3], 'SEDANG': [3, 4, 5], 'TINGGI': [5, 6, 7]}


# ── HELPERS UMUM ──────────────────────────────────────────────────────────────

def _clip_pangan(val, key):
    lo, hi = CLIP_RANGE_PANGAN.get(key, (None, None))
    val = float(val)
    if lo is not None: val = max(lo, val)
    if hi is not None: val = min(hi, val)
    return round(val, 4)


def normalize_province_name_pangan(name):
    name = str(name)
    for tag in ['<b>', '</b>', '<B>', '</B>']:
        name = name.replace(tag, '')
    name = name.upper().strip()

    SPECIAL = {
        'DKI JAKARTA':                     'JAKARTA',
        'DAERAH KHUSUS IBUKOTA JAKARTA':   'JAKARTA',
        'DKI':                             'JAKARTA',
        'YOGYAKARTA':                      'DAERAH ISTIMEWA YOGYAKARTA',
        'DIY':                             'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA':                 'DAERAH ISTIMEWA YOGYAKARTA',
        'D I YOGYAKARTA':                  'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG':                 'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG':            'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU':                       'KEPULAUAN RIAU',
        'DI YOGYAKARTA':                   'DAERAH ISTIMEWA YOGYAKARTA',
    }
    for k, v in SPECIAL.items():
        if k in name:
            return v
    for a, f in {
        'KEP.':  'KEPULAUAN',
        'KEP ':  'KEPULAUAN ',
        'NTB':   'NUSA TENGGARA BARAT',
        'NTT':   'NUSA TENGGARA TIMUR',
    }.items():
        name = name.replace(a, f)
    for prefix in ['PROVINSI ', 'PROV. ', 'PROV ', 'DAERAH KHUSUS IBUKOTA ']:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name.strip()


def _parse_number(val):
    """Konversi string BPS (mis. '1.615.200,00') ke float."""
    if val is None:
        return None
    s = str(val).strip()
    # hapus karakter spasi & tanda pemisah ribuan titik, ganti koma desimal
    s = s.replace('\xa0', '').replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def get_quality_label(cv_wmape):
    if cv_wmape is None:
        return {'grade': '?', 'label': 'Tidak Diketahui', 'color': '#94a3b8', 'desc': 'Metrik tidak tersedia'}
    if cv_wmape < 2.0:  return {'grade': '🥇', 'label': 'Sangat Baik',   'color': '#10b981', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}
    if cv_wmape < 5.0:  return {'grade': '✅', 'label': 'Baik',          'color': '#3b82f6', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}
    if cv_wmape < 10.0: return {'grade': '⚠️', 'label': 'Cukup',         'color': '#f59e0b', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}
    return              {'grade': '❌', 'label': 'Perlu Perhatian',       'color': '#ef4444', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}


# ── ARIMA HELPERS (pola identik SDM) ─────────────────────────────────────────

def _load_metadata_pangan(key, models_dir=None):
    if models_dir is None:
        models_dir = PANGAN_MODELS_DIR
    meta_file = PANGAN_METADATA_FILES.get(key, f'metadata_{key.lower()}.json')
    path = os.path.join(models_dir, meta_file)
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            pass
    fb = CV_METRICS_FALLBACK.get(key, {})
    return {
        'cv_mae': fb.get('cv_mae'), 'cv_rmse': fb.get('cv_rmse'),
        'cv_wmape': fb.get('cv_wmape'), 'n_wilayah': 38,
        'tahun_historis': [2018, LAST_HIST_YEAR], 'source': 'hardcoded',
    }


def _load_metadata_penduduk():
    path = os.path.join(PENDUDUK_MODELS_DIR, PENDUDUK_METADATA_FILE)
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            pass
    fb = CV_METRICS_FALLBACK.get('PENDUDUK', {})
    return {'cv_mae': fb.get('cv_mae'), 'cv_rmse': fb.get('cv_rmse'),
            'cv_wmape': fb.get('cv_wmape'), 'n_wilayah': 38,
            'tahun_historis': [2010, LAST_HIST_YEAR], 'source': 'hardcoded'}


def _load_arima_model(pkl_path, key_clip):
    """Load .pkl dan kembalikan dict {nama_prov: fitted_model}."""
    if not os.path.exists(pkl_path):
        raise FileNotFoundError(f"Model ARIMA tidak ditemukan: {pkl_path}")

    prov_bucket = {}
    raw = joblib.load(pkl_path)

    for raw_key, entry in raw.items():
        str_key = str(raw_key).strip()

        # Cari objek fitted (sama persis pola SDM)
        fitted = (
            (entry.get('model') or entry.get('result') or entry.get('fitted') or
             next((v for v in entry.values()
                   if v is not None and not isinstance(v, (dict, list, str, int, float, bool))), None))
            if isinstance(entry, dict) else entry
        )
        if fitted is None:
            continue

        if str_key.isdigit():
            kode = str_key[:2]
            nama = KODE_PROVINSI_MAP.get(kode)
            if not nama:
                continue
            prov_bucket.setdefault(nama, {'prov': None, 'kab': None})
            if str_key.endswith('00'):
                prov_bucket[nama]['prov'] = fitted
            else:
                prov_bucket[nama].setdefault('kab', fitted)
        else:
            nama = normalize_province_name_pangan(str_key)
            prov_bucket.setdefault(nama, {'prov': None, 'kab': None})
            prov_bucket[nama]['prov'] = fitted

    converted = {n: (b['prov'] or b['kab']) for n, b in prov_bucket.items() if b['prov'] or b['kab']}
    for nama_baru, nama_induk in PROVINSI_FALLBACK.items():
        if nama_baru not in converted and nama_induk in converted:
            converted[nama_baru] = converted[nama_induk]
    print(f"✓ ARIMA {key_clip}: {len(converted)} provinsi")
    return converted


def _do_forecast_pangan(model, n_steps):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        for method in ['get_forecast', 'forecast', 'predict']:
            try:
                if method == 'get_forecast':
                    fc  = model.get_forecast(steps=n_steps)
                    ci  = fc.conf_int(alpha=0.05)
                    return fc.predicted_mean.to_numpy(), ci.iloc[:, 0].to_numpy(), ci.iloc[:, 1].to_numpy()
                fc = (model.forecast(steps=n_steps) if method == 'forecast'
                      else model.predict(
                          start=int(model.nobs) if hasattr(model, 'nobs') else 10,
                          end=(int(model.nobs) if hasattr(model, 'nobs') else 10) + n_steps - 1))
                mean = np.array(fc)
                std  = float(np.std(mean)) * 0.5 if len(mean) > 1 else abs(float(mean[0])) * 0.02
                return mean, mean - std, mean + std
            except Exception:
                continue
        try:
            fc  = model.model.apply(model.params).get_forecast(steps=n_steps)
            ci  = fc.conf_int(alpha=0.05)
            return fc.predicted_mean.to_numpy(), ci.iloc[:, 0].to_numpy(), ci.iloc[:, 1].to_numpy()
        except Exception:
            pass
    return None, None, None


def _build_skenario_pangan(mean, lo, hi, n_steps, key):
    if mean is None or len(mean) == 0:
        return None, None, None, None, None
    mod   = float(mean[-1])
    lo_v  = float(lo[-1]) if lo is not None and len(lo) > 0 else mod * 0.95
    hi_v  = float(hi[-1]) if hi is not None and len(hi) > 0 else mod * 1.05
    return (
        _clip_pangan(mod,  key),
        _clip_pangan(hi_v, key),
        _clip_pangan(lo_v, key),
        _clip_pangan(lo_v, key),
        _clip_pangan(hi_v, key),
    )


def _predict_arima(models_dict, key, tahun, all_skenario=False):
    """Prediksi satu indikator untuk semua provinsi di tahun tertentu."""
    n_steps   = max(1, tahun - LAST_HIST_YEAR)
    model_map = models_dict.get(key, {})
    result    = {}
    for prov, model in model_map.items():
        try:
            mean, lo, hi = _do_forecast_pangan(model, n_steps)
            mod, opt, pes, ci_lo, ci_hi = _build_skenario_pangan(mean, lo, hi, n_steps, key)
            if mod is None:
                continue
            result[prov] = (
                {'optimis': opt, 'moderat': mod, 'pesimis': pes, 'ci_lo': ci_lo, 'ci_hi': ci_hi}
                if all_skenario else mod
            )
        except Exception as e:
            print(f"✗ predict {key}/{prov}: {e}")
    return result


def predict_pangan_for_year(models_dict, key, tahun, skenario='moderat'):
    raw = _predict_arima(models_dict, key, tahun, all_skenario=False)
    return {p: v for p, v in raw.items()}


def predict_pangan_all_skenario(models_dict, key, tahun):
    return _predict_arima(models_dict, key, tahun, all_skenario=True)


def check_model_available(key, models_dir=None):
    if models_dir is None:
        models_dir = PANGAN_MODELS_DIR
    model_file = PANGAN_MODEL_FILES.get(key, f'model_{key.lower()}.pkl')
    return os.path.exists(os.path.join(models_dir, model_file))


# ── BANK KEBIJAKAN ────────────────────────────────────────────────────────────

def _get_prioritas_ikp(status, nilai):
    if nilai is None:
        return list(range(1, 8))
    for lo, hi, prios in PRIORITAS_BAND_IKP.get(status, []):
        if lo <= nilai < hi:
            return prios
    return _PRIORITAS_FALLBACK_IKP.get(status, list(range(1, 8)))


def get_bank_kebijakan_pangan(kategori_list, limit_per_kategori=10, ikp_nilai=None):
    results, conn = [], None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for status in [k for k in kategori_list if k in ('TINGGI', 'SEDANG', 'RENDAH')]:
            prio_list    = _get_prioritas_ikp(status, (ikp_nilai or {}).get(status))
            placeholders = ','.join(['%s'] * len(prio_list))
            cur.execute(f"""
                SELECT id, indeks, status, prioritas, pilar_kebijakan,
                       isu_strategis, kebijakan, rekomendasi_program, indikator_terkait
                FROM bank_kebijakan
                WHERE indeks = 'IKP' AND status = %s AND prioritas IN ({placeholders})
                ORDER BY prioritas ASC, pilar_kebijakan ASC LIMIT %s
            """, (status, *prio_list, limit_per_kategori))

            pilar_map = {}
            for row in [dict(r) for r in cur.fetchall()]:
                pilar = row['pilar_kebijakan'] or 'Umum'
                pilar_map.setdefault(pilar, {
                    'pilar': pilar, 'prioritas': row['prioritas'], 'jumlah_aksi': 0, 'aksi': [],
                })
                pilar_map[pilar]['aksi'].append({
                    'no_aksi':         len(pilar_map[pilar]['aksi']) + 1,
                    'isu_strategis':   row['isu_strategis'],
                    'nama_aksi':       row['kebijakan'],
                    'detail_aksi':     row['rekomendasi_program'],
                    'indikator_terkait': row['indikator_terkait'],
                    'sub_sektor':      row['pilar_kebijakan'],
                })
                pilar_map[pilar]['jumlah_aksi'] += 1
            results.extend(pilar_map.values())
        cur.close()
    except Exception as e:
        print(f"✗ get_bank_kebijakan_pangan: {e}")
    finally:
        if conn: conn.close()
    return results


# ── FETCHER DATA BPS ──────────────────────────────────────────────────────────

def _fetch_simdasi(id_tabel, tahun, key=None):
    """Ambil data dari BPS SIMDASI (produksi padi / penduduk)."""
    url = (
        f"https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi/id/25"
        f"/tahun/{tahun}/id_tabel/{id_tabel}/wilayah/0000000/key/{BPS_API_KEY}/"
    )
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"✗ SIMDASI {id_tabel} {tahun}: {e}")
    return None


def _fetch_konsumsi(tahun):
    """Ambil tabel statis 951 (kalori & protein per provinsi)."""
    url = (
        f"https://webapi.bps.go.id/v1/api/view/domain/0000/model/statictable"
        f"/lang/ind/id/951/key/{BPS_API_KEY}/"
    )
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"✗ Konsumsi {tahun}: {e}")
    return None


def _fetch_kemiskinan(tahun):
    """Ambil kemiskinan var/192 — Semester 2 (September), turvar=434 (Jumlah)."""
    th_code = TAHUN_BPS_MAP.get(tahun, 125)
    url = (
        f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000"
        f"/var/192/th/{th_code}/key/{BPS_API_KEY}/"
    )
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"✗ Kemiskinan {tahun}: {e}")
    return None


# ── PARSER DATA BPS ───────────────────────────────────────────────────────────

def _parse_simdasi_padi(raw):
    """
    Kembalikan dict {nama_provinsi: produksi_ton}.
    Kolom target: 'Rekap Produksi Padi (ton)' — cari via nama_variabel.
    """
    result = {}
    if not raw:
        return result
    try:
        data_list = raw.get('data', [{}])
        if isinstance(data_list, list) and len(data_list) > 1:
            tabel = data_list[1]
        else:
            tabel = data_list[0] if data_list else {}

        kolom      = tabel.get('kolom', {})
        data_rows  = tabel.get('data', [])

        # Cari key kolom produksi ton
        produksi_key = None
        for k, v in kolom.items():
            nama_var = v.get('nama_variabel', '')
            if 'produksi' in nama_var.lower() and 'ton' in nama_var.lower():
                produksi_key = k
                break

        if not produksi_key:
            # fallback: ambil kolom ketiga (indeks 2)
            keys = list(kolom.keys())
            if len(keys) >= 3:
                produksi_key = keys[2]

        for row in data_rows:
            label = row.get('label_raw') or row.get('label', '')
            if not label or label.lower() in ('indonesia', ''):
                continue
            nama = normalize_province_name_pangan(label)
            var  = row.get('variables', {})
            val  = _parse_number(var.get(produksi_key, {}).get('value_raw'))
            if val is not None:
                result[nama] = val
    except Exception as e:
        print(f"✗ parse padi: {e}")
    return result


def _parse_simdasi_penduduk(raw):
    """
    Kembalikan dict {nama_provinsi: jumlah_penduduk_ribu_jiwa}.
    Kolom target: 'Jumlah Penduduk' dengan unit_multiplier=3 (ribu).
    """
    result = {}
    if not raw:
        return result
    try:
        data_list = raw.get('data', [{}])
        if isinstance(data_list, list) and len(data_list) > 1:
            tabel = data_list[1]
        else:
            tabel = data_list[0] if data_list else {}

        kolom     = tabel.get('kolom', {})
        data_rows = tabel.get('data', [])

        # Cari kolom Jumlah Penduduk
        penduduk_key = None
        for k, v in kolom.items():
            if 'jumlah penduduk' in v.get('nama_variabel', '').lower():
                penduduk_key = k
                break
        if not penduduk_key and kolom:
            penduduk_key = list(kolom.keys())[0]

        for row in data_rows:
            label = row.get('label_raw') or row.get('label', '')
            if not label or label.lower() in ('indonesia', ''):
                continue
            nama = normalize_province_name_pangan(label)
            var  = row.get('variables', {})
            val  = _parse_number(var.get(penduduk_key, {}).get('value_raw'))
            if val is not None:
                result[nama] = val   # sudah dalam ribu jiwa
    except Exception as e:
        print(f"✗ parse penduduk: {e}")
    return result


def _parse_konsumsi_html(raw, tahun):
    """
    Parse HTML tabel statik 951 → {nama_prov: {'kalori': float, 'protein': float}}.
    HTML di-encode sebagai string dalam field 'table'.
    """
    result = {}
    if not raw:
        return result
    try:
        table_html = raw.get('data', {}).get('table', '')
        # Decode HTML entities
        import html as html_lib
        table_html = html_lib.unescape(table_html)

        # Cari semua baris <tr>
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.IGNORECASE)

        # Tentukan indeks kolom untuk tahun yang diminta
        # Header baris ke-2 berisi tahun (2007..2025) untuk kalori, lalu ulang untuk protein
        # Kita cari posisi tahun target di header
        header_row = None
        for i, row in enumerate(rows):
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL | re.IGNORECASE)
            cells_text = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            if str(tahun) in cells_text:
                header_row = cells_text
                break

        if not header_row:
            # fallback: coba tahun terdekat
            for yr in range(tahun, 2006, -1):
                for row in rows:
                    cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL | re.IGNORECASE)
                    cells_text = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
                    if str(yr) in cells_text:
                        header_row = cells_text
                        tahun = yr
                        break
                if header_row:
                    break

        if not header_row:
            return result

        # Posisi kolom tahun (pertama = kalori, kedua = protein)
        col_positions = [i for i, v in enumerate(header_row) if v == str(tahun)]
        if len(col_positions) < 2:
            return result
        col_kalori  = col_positions[0]
        col_protein = col_positions[1]

        # Parse baris data
        for row in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL | re.IGNORECASE)
            cells_text = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            if len(cells_text) < max(col_kalori, col_protein) + 1:
                continue
            nama_raw = cells_text[0]
            if not nama_raw or nama_raw.startswith('Diolah') or nama_raw == 'Provinsi':
                continue
            nama = normalize_province_name_pangan(nama_raw)
            if not nama or nama == 'INDONESIA':
                continue
            try:
                kal = _parse_number(cells_text[col_kalori])
                pro = _parse_number(cells_text[col_protein])
                if kal is not None and pro is not None and kal > 0 and pro > 0:
                    result[nama] = {'kalori': kal, 'protein': pro}
            except Exception:
                continue
    except Exception as e:
        print(f"✗ parse konsumsi html: {e}")
    return result


def _parse_kemiskinan(raw):
    """
    Kembalikan dict {nama_prov: persen_miskin}.
    Ambil turvar=434 (Jumlah), Semester 2 (September) → key berakhiran '62'.
    """
    result = {}
    if not raw:
        return result
    try:
        datacontent = raw.get('datacontent', {})
        vervar      = {str(item['val']): item['label'] for item in raw.get('vervar', [])}

        for dc_key, value in datacontent.items():
            # Format key: {kode_prov}19243{turvar}{turtahun}
            # turvar 434=Jumlah → '434', turtahun 62=Sep → '62'
            # Lebih aman: ambil yang berakhiran '43462' (turvar=434, turtahun=62)
            # kode_prov 4 digit berakhiran '00'
            if not dc_key.endswith('43462'):
                continue
            prov_code = dc_key[:4]
            if prov_code not in vervar:
                continue
            if value is None:
                continue
            try:
                val_f = float(value)
                nama  = normalize_province_name_pangan(vervar[prov_code])
                result[nama] = val_f
            except (ValueError, TypeError):
                continue
    except Exception as e:
        print(f"✗ parse kemiskinan: {e}")
    return result


# ── KALKULATOR IKP ────────────────────────────────────────────────────────────

class IKPCalculator:
    """Hitung IKP dari komponen mentah (sebelum normalisasi) + normalisasi lintas provinsi."""

    COLORS = {'TINGGI': '#10b981', 'SEDANG': '#f59e0b', 'RENDAH': '#ef4444'}

    def compute_raw_indices(self, padi_ton, penduduk_ribu, persen_miskin, kalori, protein):
        """
        Hitung indeks mentah (SEBELUM normalisasi).
        IKv  : ton/ribu jiwa
        IA   : 0-1
        IPm  : 0-2  (cap di 2.0)
        IS   : dihitung terpisah dari time-series → di sini diberi None (akan diisi caller)
        """
        ikv = round(padi_ton / penduduk_ribu, 4) if (padi_ton is not None and penduduk_ribu) else None
        ia  = round(1 - persen_miskin / 100, 4)  if persen_miskin is not None else None
        if kalori is not None and protein is not None:
            ipm = round(min((protein / PROTEIN_STANDAR) + (kalori / KALORI_STANDAR), 2.0), 4)
        else:
            ipm = None
        return {'ikv': ikv, 'ia': ia, 'ipm': ipm}

    def normalize_all(self, province_raw):
        """
        Min-Max normalisasi setiap komponen lintas provinsi.
        province_raw: {nama: {'ikv': float, 'ia': float, 'ipm': float, 'is': float}}
        Kembalikan {nama: {'ikv_norm': float, 'ia_norm': float, 'ipm_norm': float, 'is_norm': float, 'ikp': float}}
        """
        def minmax(vals):
            clean = [v for v in vals if v is not None]
            if not clean:
                return None, None
            return min(clean), max(clean)

        ikv_min, ikv_max = minmax([v.get('ikv')  for v in province_raw.values()])
        ia_min,  ia_max  = minmax([v.get('ia')   for v in province_raw.values()])
        ipm_min, ipm_max = minmax([v.get('ipm')  for v in province_raw.values()])
        is_min,  is_max  = minmax([v.get('is')   for v in province_raw.values()])

        def norm(val, mn, mx):
            if val is None or mn is None or mx is None:
                return None
            denom = mx - mn
            if denom == 0:
                return 0.5
            return round(max(0.0, min(1.0, (val - mn) / denom)), 4)

        result = {}
        for prov, raw in province_raw.items():
            ikv_n = norm(raw.get('ikv'), ikv_min, ikv_max)
            ia_n  = norm(raw.get('ia'),  ia_min,  ia_max)
            ipm_n = norm(raw.get('ipm'), ipm_min, ipm_max)
            is_n  = norm(raw.get('is'),  is_min,  is_max)

            components = [v for v in [ikv_n, ia_n, ipm_n, is_n] if v is not None]
            ikp = round(sum(components) / len(components), 4) if components else None

            result[prov] = {
                'ikv_norm': ikv_n, 'ia_norm': ia_n, 'ipm_norm': ipm_n, 'is_norm': is_n,
                'ikp': ikp,
            }
        return result

    def categorize(self, ikp):
        if ikp is None:
            return 'TIDAK DIKETAHUI', '#6b7280'
        if ikp > THRESHOLD_TINGGI:
            return 'TINGGI', self.COLORS['TINGGI']
        if ikp >= THRESHOLD_SEDANG:
            return 'SEDANG', self.COLORS['SEDANG']
        return 'RENDAH', self.COLORS['RENDAH']

    def generate_insights(self, prov, raw, norm, ikp, kategori):
        insights = [
            f"Provinsi {prov} memiliki IKP {ikp} — kategori {kategori}."
        ]
        ikv, ia, ipm, is_ = raw.get('ikv'), raw.get('ia'), raw.get('ipm'), raw.get('is')
        if ikv is not None:
            insights.append(f"{'✅' if ikv >= 2.0 else '⚠️' if ikv >= 0.5 else '🚨'} "
                            f"Ketersediaan (IKv): {ikv:.2f} ton/ribu jiwa.")
        if ia is not None:
            pct = round((1 - ia) * 100, 2)
            insights.append(f"{'✅' if pct <= 5 else '⚠️' if pct <= 15 else '🚨'} "
                            f"Akses (IA): {ia:.4f} — kemiskinan {pct}%.")
        if ipm is not None:
            insights.append(f"{'✅' if ipm >= 1.8 else '⚠️' if ipm >= 1.4 else '🚨'} "
                            f"Pemanfaatan (IPm): {ipm:.4f}.")
        if is_ is not None:
            insights.append(f"{'✅' if is_ >= 5.0 else '⚠️' if is_ >= 2.0 else '🚨'} "
                            f"Stabilitas (IS): {is_:.4f}.")
        return insights


# ── HELPER IS (Stabilitas) ────────────────────────────────────────────────────

def compute_is_from_timeseries(padi_ts):
    """
    padi_ts: dict {tahun(int): {nama_prov: produksi_ton}}
    Kembalikan {nama_prov: IS} menggunakan CV 5 tahun terakhir.
    CV = std / mean; IS = 1 / CV  (di-clip [0, 20] agar tidak inf)
    """
    from statistics import stdev, mean as stat_mean
    result = {}
    if not padi_ts:
        return result

    tahun_sorted = sorted(padi_ts.keys())[-5:]   # 5 tahun terakhir
    all_provs = set()
    for t in tahun_sorted:
        all_provs.update(padi_ts[t].keys())

    for prov in all_provs:
        vals = [padi_ts[t][prov] for t in tahun_sorted if prov in padi_ts[t]]
        if len(vals) < 2:
            continue
        m = stat_mean(vals)
        if m == 0:
            continue
        sd = stdev(vals)
        cv = sd / m
        result[prov] = round(min(1.0 / cv, 20.0), 4) if cv > 0 else 20.0
    return result


# ── API: CEK KETERSEDIAAN DATA ─────────────────────────────────────────────────

@api_view(['POST'])
def check_pangan_year_data(request):
    """
    Cek apakah data BPS tersedia untuk tahun yang diminta.
    Mirip check_sdm_year_data.
    """
    tahun = int(request.data.get('tahun', 2025))
    if tahun not in TAHUN_SEMUA:
        return Response({"error": f"Tahun {tahun} tidak didukung. Pilih antara 2020–{TAHUN_MAX_PREDIKSI}."}, status=400)

    is_arima_only = tahun in TAHUN_ARIMA_ONLY
    arima_metrics = {}

    def _build_arima_metric_pangan(key, models_dir=None):
        meta     = _load_metadata_pangan(key, models_dir)
        cv_wmape = meta.get('cv_wmape')
        return {
            'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
            'cv_wmape': cv_wmape, 'n_wilayah': meta.get('n_wilayah'),
            'quality': get_quality_label(cv_wmape),
        }

    if is_arima_only:
        dataset_status = {}
        for key in list(PANGAN_MODEL_FILES.keys()):
            avail = check_model_available(key)
            dataset_status[key] = {
                'nama': key, 'tersedia': False,
                'status': 'Tahun Prediksi — Gunakan ARIMA', 'arima_tersedia': avail,
            }
            if avail:
                arima_metrics[key] = _build_arima_metric_pangan(key)

        pend_avail = os.path.exists(os.path.join(PENDUDUK_MODELS_DIR, PENDUDUK_MODEL_FILE))
        dataset_status['PENDUDUK'] = {
            'nama': 'PENDUDUK', 'tersedia': False,
            'status': 'Tahun Prediksi — Gunakan ARIMA', 'arima_tersedia': pend_avail,
        }
        if pend_avail:
            arima_metrics['PENDUDUK'] = _build_arima_metric_pangan('PENDUDUK', PENDUDUK_MODELS_DIR)

        arima_keys = [k for k, v in dataset_status.items() if v.get('arima_tersedia')]
        return Response({
            'tahun': tahun, 'dataset_status': dataset_status,
            'tersedia': [], 'kosong': list(dataset_status.keys()),
            'semua_kosong': True, 'ada_yang_kosong': False,
            'bisa_dieksekusi': False,
            'is_prediction_year': True, 'is_arima_only': True,
            'bisa_pakai_arima': len(arima_keys) == len(dataset_status),
            'arima_keys': arima_keys, 'arima_metrics': arima_metrics,
        })

    if not BPS_API_KEY:
        return Response({"error": "BPS Web API Key belum dikonfigurasi"}, status=500)

    # Cek data BPS aktual
    ID_PADI      = 'ZjZ6MXlacGJNR0JaaHBPRSs0TzNUdz09'
    ID_PENDUDUK  = 'WVRlTTcySlZDa3lUcFp6czNwbHl4QT09'

    dataset_status = {}
    checks = {
        'PADI':       lambda: _fetch_simdasi(ID_PADI, tahun),
        'KONSUMSI':   lambda: _fetch_konsumsi(tahun),
        'KEMISKINAN': lambda: _fetch_kemiskinan(tahun),
        'PENDUDUK':   lambda: _fetch_simdasi(ID_PENDUDUK, tahun),
    }

    for key, fetcher in checks.items():
        if key in PANGAN_MODEL_FILES:
            avail_arima = check_model_available(key)
        elif key == 'PENDUDUK':
            avail_arima = os.path.exists(os.path.join(PENDUDUK_MODELS_DIR, PENDUDUK_MODEL_FILE))
        else:
            avail_arima = False

        try:
            raw    = fetcher()
            kosong = raw is None
            dataset_status[key] = {
                'nama': key, 'tersedia': not kosong,
                'status': 'Tersedia' if not kosong else 'Kosong / Tidak Tersedia',
                'arima_tersedia': avail_arima,
            }
        except Exception as e:
            dataset_status[key] = {
                'nama': key, 'tersedia': False,
                'status': f'Gagal ({str(e)[:50]})', 'arima_tersedia': avail_arima,
            }

        if avail_arima:
            md = PANGAN_MODELS_DIR if key != 'PENDUDUK' else PENDUDUK_MODELS_DIR
            arima_metrics[key] = _build_arima_metric_pangan(key if key in PANGAN_MODEL_FILES else 'PENDUDUK', md)

    tersedia_list = [k for k, v in dataset_status.items() if v['tersedia']]
    kosong_list   = [k for k, v in dataset_status.items() if not v['tersedia']]
    arima_keys    = [k for k in kosong_list if dataset_status[k].get('arima_tersedia')]

    return Response({
        'tahun': tahun, 'dataset_status': dataset_status,
        'tersedia': tersedia_list, 'kosong': kosong_list,
        'semua_kosong': not tersedia_list, 'ada_yang_kosong': bool(kosong_list) and bool(tersedia_list),
        'bisa_dieksekusi': not kosong_list,
        'is_prediction_year': False,
        'bisa_pakai_arima': bool(kosong_list) and len(arima_keys) == len(kosong_list),
        'arima_keys': arima_keys, 'arima_metrics': arima_metrics,
    })


# ── API: ANALISIS UTAMA IKP ───────────────────────────────────────────────────

@api_view(['POST'])
def analyze_pangan_bps(request):
    """
    Endpoint utama: fetch data BPS → hitung IKP → overlay peta → simpan rekomendasi.
    Request body:
      tahun       : int  (2020-2045)
      use_arima   : bool (isi komponen yang kosong dengan prediksi ARIMA)
      skenario    : 'optimis'|'moderat'|'pesimis'
      arima_keys  : list[str] komponen yang pakai ARIMA (bila use_arima=True)
    """
    try:
        tahun      = int(request.data.get('tahun', 2025))
        use_arima  = bool(request.data.get('use_arima', False))
        skenario   = request.data.get('skenario', 'moderat').lower()
        arima_keys_req = request.data.get('arima_keys', [])

        if tahun not in TAHUN_SEMUA:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)
        if skenario not in ('optimis', 'moderat', 'pesimis'):
            return Response({"error": f"Skenario '{skenario}' tidak valid."}, status=400)

        is_prediction_year = tahun in TAHUN_ARIMA_ONLY
        timestamp_fetch    = datetime.now().isoformat()

        ID_PADI     = 'ZjZ6MXlacGJNR0JaaHBPRSs0TzNUdz09'
        ID_PENDUDUK = 'WVRlTTcySlZDa3lUcFp6czNwbHl4QT09'

        # ── 1. FETCH DATA BPS (historis) ──────────────────────────────────────
        if not is_prediction_year and BPS_API_KEY:
            raw_padi      = _fetch_simdasi(ID_PADI, tahun)
            raw_konsumsi  = _fetch_konsumsi(tahun)
            raw_kemiskinan = _fetch_kemiskinan(tahun)
            raw_penduduk  = _fetch_simdasi(ID_PENDUDUK, tahun)
        else:
            raw_padi = raw_konsumsi = raw_kemiskinan = raw_penduduk = None

        # ── 2. PARSE ──────────────────────────────────────────────────────────
        padi_values     = _parse_simdasi_padi(raw_padi)       # {prov: ton}
        penduduk_values = _parse_simdasi_penduduk(raw_penduduk)  # {prov: ribu jiwa}
        konsumsi_values = _parse_konsumsi_html(raw_konsumsi, tahun)  # {prov: {kalori, protein}}
        kemiskinan_values = _parse_kemiskinan(raw_kemiskinan)  # {prov: persen}

        # ── 3. IS: ambil time-series produksi padi 5 tahun ────────────────────
        padi_ts = {}
        if not is_prediction_year:
            for yr in range(max(tahun - 4, 2018), tahun + 1):
                r = _fetch_simdasi(ID_PADI, yr)
                if r:
                    padi_ts[yr] = _parse_simdasi_padi(r)
        is_values = compute_is_from_timeseries(padi_ts)   # {prov: IS_raw}

        # ── 4. ARIMA: isi komponen yang kosong ───────────────────────────────
        models_dict   = {}
        arima_filled  = []
        arima_metrics_resp = {}
        arima_detail  = {}

        if use_arima or is_prediction_year:
            valid_arima_pangan = list(PANGAN_MODEL_FILES.keys()) if is_prediction_year else [
                k for k in (arima_keys_req or list(PANGAN_MODEL_FILES.keys()))
                if k in PANGAN_MODEL_FILES
            ]
            do_penduduk = is_prediction_year or 'PENDUDUK' in (arima_keys_req or [])

            for pk in valid_arima_pangan:
                model_file = PANGAN_MODEL_FILES[pk]
                pkl_path   = os.path.join(PANGAN_MODELS_DIR, model_file)
                try:
                    models_dict[pk] = _load_arima_model(pkl_path, pk)
                    meta = _load_metadata_pangan(pk)
                    cv   = meta.get('cv_wmape')
                    arima_metrics_resp[pk] = {
                        'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
                        'cv_wmape': cv, 'n_wilayah': meta.get('n_wilayah'),
                        'quality': get_quality_label(cv),
                        'arima_version': 'v1.0', 'tahun_historis': meta.get('tahun_historis'),
                    }
                    arima_filled.append(pk)
                except Exception as e:
                    print(f"✗ Load ARIMA {pk}: {e}")

            if do_penduduk:
                pend_pkl = os.path.join(PENDUDUK_MODELS_DIR, PENDUDUK_MODEL_FILE)
                try:
                    models_dict['PENDUDUK'] = _load_arima_model(pend_pkl, 'PENDUDUK')
                    meta = _load_metadata_penduduk()
                    cv   = meta.get('cv_wmape')
                    arima_metrics_resp['PENDUDUK'] = {
                        'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
                        'cv_wmape': cv, 'n_wilayah': meta.get('n_wilayah'),
                        'quality': get_quality_label(cv),
                        'arima_version': 'v1.0', 'tahun_historis': meta.get('tahun_historis'),
                    }
                    arima_filled.append('PENDUDUK')
                except Exception as e:
                    print(f"✗ Load ARIMA PENDUDUK: {e}")

            # Prediksi & isi gap
            for pk in arima_filled:
                pred = predict_pangan_for_year(models_dict, pk, tahun, skenario)
                arima_detail[pk] = predict_pangan_all_skenario(models_dict, pk, tahun)

                if pk == 'PADI':
                    for prov, v in pred.items():
                        if prov not in padi_values:
                            padi_values[prov] = v
                elif pk == 'KEMISKINAN':
                    for prov, v in pred.items():
                        if prov not in kemiskinan_values:
                            kemiskinan_values[prov] = v
                elif pk == 'KALORI':
                    for prov, v in pred.items():
                        if prov not in konsumsi_values:
                            konsumsi_values[prov] = {}
                        if 'kalori' not in konsumsi_values[prov]:
                            konsumsi_values[prov]['kalori'] = v
                elif pk == 'PROTEIN':
                    for prov, v in pred.items():
                        if prov not in konsumsi_values:
                            konsumsi_values[prov] = {}
                        if 'protein' not in konsumsi_values[prov]:
                            konsumsi_values[prov]['protein'] = v
                elif pk == 'PENDUDUK':
                    for prov, v in pred.items():
                        if prov not in penduduk_values:
                            penduduk_values[prov] = v

            # IS untuk prediction year: prediksi padi 5 tahun lalu → hitung IS
            if is_prediction_year and 'PADI' in models_dict:
                padi_ts_pred = {}
                for yr in range(tahun - 4, tahun + 1):
                    pred_yr = predict_pangan_for_year(models_dict, 'PADI', yr, skenario)
                    padi_ts_pred[yr] = pred_yr
                is_values_pred = compute_is_from_timeseries(padi_ts_pred)
                for prov, v in is_values_pred.items():
                    if prov not in is_values:
                        is_values[prov] = v

        # ── 5. KUMPULKAN SEMUA PROVINSI ───────────────────────────────────────
        all_provinces = set(padi_values.keys()) | set(penduduk_values.keys()) | \
                        set(konsumsi_values.keys()) | set(kemiskinan_values.keys())

        # ── 6. HITUNG RAW INDICES ─────────────────────────────────────────────
        calc = IKPCalculator()
        province_raw = {}
        for prov in all_provinces:
            padi_ton   = padi_values.get(prov)
            penduduk   = penduduk_values.get(prov)
            miskin_pct = kemiskinan_values.get(prov)
            kons       = konsumsi_values.get(prov, {})
            kalori     = kons.get('kalori') if kons else None
            protein    = kons.get('protein') if kons else None
            is_raw     = is_values.get(prov)

            raw = calc.compute_raw_indices(padi_ton, penduduk, miskin_pct, kalori, protein)
            raw['is']         = is_raw
            raw['padi_ton']   = padi_ton
            raw['penduduk']   = penduduk
            raw['miskin_pct'] = miskin_pct
            raw['kalori']     = kalori
            raw['protein']    = protein
            province_raw[prov] = raw

        # ── 7. NORMALISASI & IKP ──────────────────────────────────────────────
        province_norm = calc.normalize_all(province_raw)

        # ── 8. OVERLAY PETA (MongoDB batas_provinsi) ─────────────────────────
        boundary_features = list(mongo_db["batas_provinsi"].find({}, {'_id': 0}))
        province_map = {}
        for feat in boundary_features:
            props = feat.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    for nv in [str(props[field]).upper().strip(),
                               normalize_province_name_pangan(str(props[field]))]:
                        province_map[nv] = feat

        matched_features, analysis_summary = [], []
        kategori_counts = {'TINGGI': 0, 'SEDANG': 0, 'RENDAH': 0}
        kebijakan_cache = {}

        for prov in sorted(all_provinces):
            norm = province_norm.get(prov, {})
            raw  = province_raw.get(prov, {})
            ikp  = norm.get('ikp')
            if ikp is None:
                continue

            kategori, warna = calc.categorize(ikp)
            insights = calc.generate_insights(prov, raw, norm, ikp, kategori)

            # Arima info
            arima_keys_used = []
            if 'PADI' in arima_filled and prov not in _parse_simdasi_padi(raw_padi or {}):
                arima_keys_used.append('PADI')
            if 'KEMISKINAN' in arima_filled and prov not in _parse_kemiskinan(raw_kemiskinan or {}):
                arima_keys_used.append('KEMISKINAN')
            if 'KALORI' in arima_filled or 'PROTEIN' in arima_filled:
                if prov not in _parse_konsumsi_html(raw_konsumsi or {}, tahun):
                    arima_keys_used += [k for k in ['KALORI', 'PROTEIN'] if k in arima_filled]
            if 'PENDUDUK' in arima_filled and prov not in _parse_simdasi_penduduk(raw_penduduk or {}):
                arima_keys_used.append('PENDUDUK')

            if arima_keys_used:
                insights.insert(1, f"⚙️ [AI Prediksi ARIMA v1.0 · {skenario}] — {', '.join(arima_keys_used)}")

            ck = (kategori, round(ikp, 2))
            if ck not in kebijakan_cache:
                kebijakan_cache[ck] = get_bank_kebijakan_pangan([kategori], 10, {kategori: ikp})
            rekomendasi = kebijakan_cache[ck]

            norm_prov = normalize_province_name_pangan(prov)
            matched_feat = (province_map.get(norm_prov) or province_map.get(prov) or
                            next((f for mn, f in province_map.items()
                                  if norm_prov in mn or mn in norm_prov), None))
            if not matched_feat:
                continue

            kategori_counts[kategori] = kategori_counts.get(kategori, 0) + 1
            feat_copy  = matched_feat.copy()
            props_copy = feat_copy.get('properties', {}).copy()

            props_copy['ikp_analysis'] = {
                'nama_provinsi':    prov,
                'ikp':              ikp,
                'kategori':         kategori,
                'warna':            warna,
                # Komponen ternormalisasi
                'ikv_norm':         norm.get('ikv_norm'),
                'ia_norm':          norm.get('ia_norm'),
                'ipm_norm':         norm.get('ipm_norm'),
                'is_norm':          norm.get('is_norm'),
                # Nilai mentah
                'ikv_raw':          raw.get('ikv'),
                'ia_raw':           raw.get('ia'),
                'ipm_raw':          raw.get('ipm'),
                'is_raw':           raw.get('is'),
                # Data sumber
                'padi_ton':         raw.get('padi_ton'),
                'penduduk_ribu':    raw.get('penduduk'),
                'persen_miskin':    raw.get('miskin_pct'),
                'kalori':           raw.get('kalori'),
                'protein':          raw.get('protein'),
                'insights':         insights,
                'rekomendasi':      rekomendasi,
                'use_arima':        bool(arima_keys_used),
                'arima_keys_used':  arima_keys_used,
                'skenario_arima':   skenario if arima_keys_used else None,
                'arima_detail': {
                    pk: arima_detail.get(pk, {}).get(prov)
                    for pk in arima_filled if pk in arima_keys_used
                },
                'arima_metrics': {
                    pk: arima_metrics_resp.get(pk)
                    for pk in arima_filled if pk in arima_keys_used
                },
            }
            feat_copy['properties'] = props_copy
            matched_features.append(feat_copy)

            summary_row = {
                'provinsi':         prov,
                'ikp':              ikp,
                'kategori':         kategori,
                'warna':            warna,
                'ikv_norm':         norm.get('ikv_norm'),
                'ia_norm':          norm.get('ia_norm'),
                'ipm_norm':         norm.get('ipm_norm'),
                'is_norm':          norm.get('is_norm'),
                'padi_ton':         raw.get('padi_ton'),
                'penduduk_ribu':    raw.get('penduduk'),
                'persen_miskin':    raw.get('miskin_pct'),
                'kalori':           raw.get('kalori'),
                'protein':          raw.get('protein'),
                'use_arima':        bool(arima_keys_used),
                'arima_keys_used':  arima_keys_used,
            }
            analysis_summary.append(summary_row)

        sorted_summary = sorted(
            [s for s in analysis_summary if s['ikp'] is not None],
            key=lambda x: x['ikp']
        )

        return Response({
            'status':                'success',
            'source':                'ARIMA v1.0 Prediksi' if is_prediction_year else 'BPS Web API',
            'tahun':                 tahun,
            'is_prediction_year':    is_prediction_year,
            'total_success':         len(matched_features),
            'kategori_distribusi':   kategori_counts,
            'timestamp':             timestamp_fetch,
            'formula': {
                'IKv':  'Produksi Padi (Ton) / Jumlah Penduduk (Ribu Jiwa)',
                'IA':   '1 - (Persen Miskin / 100)',
                'IPm':  '(Protein/57) + (Kalori/2100), cap 2.0',
                'IS':   '1 / CV Produksi Padi 5 tahun, cap 20',
                'norm': 'Min-Max ke [0,1]',
                'IKP':  '(IKv_norm + IA_norm + IPm_norm + IS_norm) / 4',
            },
            'threshold_klasifikasi': {
                'TINGGI': f'IKP > {THRESHOLD_TINGGI}',
                'SEDANG': f'IKP {THRESHOLD_SEDANG} – {THRESHOLD_TINGGI}',
                'RENDAH': f'IKP < {THRESHOLD_SEDANG}',
            },
            'use_arima':             bool(arima_filled),
            'skenario':              skenario if arima_filled else None,
            'arima_keys':            arima_filled,
            'arima_metrics':         arima_metrics_resp,
            'matched_features':      {'type': 'FeatureCollection', 'features': matched_features},
            'analysis_summary':      analysis_summary,
            'worst_provinces':       sorted_summary[:5],
            'best_provinces':        sorted_summary[-5:][::-1],
            'colors':                IKPCalculator.COLORS,
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({'error': str(e), 'message': 'Gagal menganalisis data pangan'}, status=500)


# ── API: SIMPAN ANALISIS (MongoDB) ────────────────────────────────────────────

@api_view(['POST'])
def save_pangan_analysis(request):
    try:
        name = request.data.get('name', 'Analisis Pangan Tanpa Nama')
        data = request.data.get('analysis_data')
        if not data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)
        analysis_id = str(uuid.uuid4())
        doc = {
            'analysis_id': analysis_id, 'name': name, 'type': 'pangan',
            'timestamp': datetime.now().isoformat(), **data,
        }
        mongo_db['pangan_analysis'].insert_one(doc)
        return Response({
            'status': 'success', 'message': f"Analisis '{name}' berhasil disimpan.",
            'analysis_id': analysis_id, 'saved_at': doc['timestamp'],
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
def get_pangan_analysis_list(request):
    try:
        results = list(mongo_db['pangan_analysis'].find(
            {},
            {'_id': 0, 'analysis_id': 1, 'name': 1, 'timestamp': 1,
             'total_success': 1, 'kategori_distribusi': 1, 'tahun': 1,
             'use_arima': 1, 'skenario': 1, 'is_prediction_year': 1},
        ).sort('timestamp', -1))
        return Response({'status': 'success', 'count': len(results), 'results': results})
    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
def get_pangan_analysis_detail(request, analysis_id):
    try:
        result = mongo_db['pangan_analysis'].find_one({'analysis_id': analysis_id}, {'_id': 0})
        if not result:
            return Response({'error': 'Analisis tidak ditemukan'}, status=404)
        return Response(result)
    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['DELETE'])
def delete_pangan_analysis(request, analysis_id):
    try:
        result = mongo_db['pangan_analysis'].delete_one({'analysis_id': analysis_id})
        if result.deleted_count == 0:
            return Response({'error': 'Analisis tidak ditemukan'}, status=404)
        return Response({'status': 'success', 'message': 'Analisis pangan berhasil dihapus.'})
    except Exception as e:
        return Response({'error': str(e)}, status=500)


# ── API: BANK KEBIJAKAN IKP ───────────────────────────────────────────────────

def _kebijakan_ikp_row(r):
    return {
        'id': r['id'], 'status': r['status'], 'prioritas': r['prioritas'],
        'pilar': r['pilar_kebijakan'], 'isu_strategis': r.get('isu_strategis'),
        'kebijakan': r['kebijakan'], 'rekomendasi': r['rekomendasi_program'],
        'indikator': r['indikator_terkait'],
    }


@api_view(['GET'])
def get_bank_kebijakan_ikp(request):
    conn = None
    try:
        conn  = get_pg_connection()
        cur   = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query = ("SELECT id, indeks, status, prioritas, pilar_kebijakan, isu_strategis, "
                 "kebijakan, rekomendasi_program, indikator_terkait "
                 "FROM bank_kebijakan WHERE indeks = 'IKP'")
        params = []
        sf  = request.GET.get('status', '').upper()
        pf  = request.GET.get('pilar', '')
        idf = request.GET.get('indikator', '')
        if sf in ('TINGGI', 'SEDANG', 'RENDAH'):
            query += " AND status = %s"; params.append(sf)
        if idf:
            query += " AND indikator_terkait = %s"; params.append(idf.upper())
        if pf:
            query += " AND pilar_kebijakan ILIKE %s"; params.append(f"%{pf}%")
        query += " ORDER BY status ASC, prioritas ASC, pilar_kebijakan ASC"
        cur.execute(query, params)
        hasil = [_kebijakan_ikp_row(dict(r)) for r in cur.fetchall()]
        cur.close()
        return Response({'status': 'success', 'count': len(hasil), 'results': hasil})
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['POST'])
def add_bank_kebijakan_ikp(request):
    conn = None
    try:
        d        = request.data
        required = ['status', 'prioritas', 'pilar_kebijakan', 'kebijakan', 'rekomendasi_program', 'indikator_terkait']
        for f in required:
            if not d.get(f):
                return Response({'error': f"Field '{f}' wajib diisi."}, status=400)
        status = d['status'].upper()
        if status not in ('TINGGI', 'SEDANG', 'RENDAH'):
            return Response({'error': 'Status harus TINGGI, SEDANG, atau RENDAH.'}, status=400)
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            INSERT INTO bank_kebijakan
              (indeks, status, prioritas, pilar_kebijakan, isu_strategis, kebijakan, rekomendasi_program, indikator_terkait)
            VALUES ('IKP', %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (status, int(d['prioritas']), d['pilar_kebijakan'], d.get('isu_strategis', ''),
              d['kebijakan'], d['rekomendasi_program'], d['indikator_terkait'].upper()))
        new_id = cur.fetchone()['id']
        conn.commit(); cur.close()
        return Response({'status': 'success', 'message': 'Kebijakan IKP berhasil ditambahkan.', 'id': new_id})
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['PUT'])
def update_bank_kebijakan_ikp(request, kebijakan_id):
    conn = None
    try:
        d    = request.data
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE bank_kebijakan
            SET status=%s, prioritas=%s, pilar_kebijakan=%s, isu_strategis=%s,
                kebijakan=%s, rekomendasi_program=%s, indikator_terkait=%s
            WHERE id=%s AND indeks='IKP'
        """, (d['status'].upper(), int(d['prioritas']), d['pilar_kebijakan'],
              d.get('isu_strategis', ''), d['kebijakan'], d['rekomendasi_program'],
              d['indikator_terkait'].upper(), kebijakan_id))
        if cur.rowcount == 0:
            return Response({'error': 'Kebijakan tidak ditemukan.'}, status=404)
        conn.commit(); cur.close()
        return Response({'status': 'success', 'message': 'Kebijakan IKP berhasil diperbarui.'})
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['DELETE'])
def delete_bank_kebijakan_ikp(request, kebijakan_id):
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute("DELETE FROM bank_kebijakan WHERE id=%s AND indeks='IKP'", (kebijakan_id,))
        if cur.rowcount == 0:
            return Response({'error': 'Kebijakan tidak ditemukan.'}, status=404)
        conn.commit(); cur.close()
        return Response({'status': 'success', 'message': 'Kebijakan IKP berhasil dihapus.'})
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['GET'])
def get_bank_kebijakan_ikp_for_provinsi(request):
    """Kebijakan IKP dikelompokkan per pilar, untuk edit rekomendasi provinsi."""
    conn = None
    try:
        conn   = get_pg_connection()
        cur    = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query  = ("SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, "
                  "kebijakan, rekomendasi_program, indikator_terkait "
                  "FROM bank_kebijakan WHERE indeks = 'IKP'")
        params = []
        sf     = request.GET.get('status', '').upper()
        if sf in ('TINGGI', 'SEDANG', 'RENDAH'):
            query += " AND status = %s"; params.append(sf)
        query += " ORDER BY status ASC, prioritas ASC, pilar_kebijakan ASC"
        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()

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
            'flat': [{
                'id': r['id'], 'status': r['status'], 'prioritas': r['prioritas'],
                'pilar': r['pilar_kebijakan'] or 'Umum', 'isu_strategis': r['isu_strategis'],
                'kebijakan': r['kebijakan'], 'rekomendasi': r['rekomendasi_program'],
                'indikator_terkait': r['indikator_terkait'],
            } for r in rows],
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    finally:
        if conn: conn.close()


# ── API: PATCH REKOMENDASI PROVINSI ──────────────────────────────────────────

@api_view(['PATCH'])
def patch_provinsi_kebijakan_pangan(request, analysis_id):
    try:
        nama_provinsi = request.data.get('nama_provinsi', '').strip().upper()
        rekomendasi   = request.data.get('rekomendasi')
        if not nama_provinsi:
            return Response({'error': 'nama_provinsi wajib diisi.'}, status=400)
        if rekomendasi is None or not isinstance(rekomendasi, list):
            return Response({'error': 'rekomendasi harus berupa array.'}, status=400)

        doc = mongo_db['pangan_analysis'].find_one({'analysis_id': analysis_id})
        if not doc:
            return Response({'error': 'Analisis tidak ditemukan.'}, status=404)

        features = doc.get('matched_features', {}).get('features', [])
        updated  = False
        now      = datetime.now().isoformat()

        for feat in features:
            ikp_data = feat.get('properties', {}).get('ikp_analysis', {})
            if ikp_data.get('nama_provinsi', '').upper().strip() == nama_provinsi:
                ikp_data.update({
                    'rekomendasi': rekomendasi,
                    'rekomendasi_edited': True,
                    'rekomendasi_edited_at': now,
                })
                feat['properties']['ikp_analysis'] = ikp_data
                updated = True
                break

        if not updated:
            return Response({'error': f'Provinsi "{nama_provinsi}" tidak ditemukan dalam analisis.'}, status=404)

        summary = doc.get('analysis_summary', [])
        for s in summary:
            if s.get('provinsi', '').upper().strip() == nama_provinsi:
                s['rekomendasi_edited'] = True
                break

        mongo_db['pangan_analysis'].update_one(
            {'analysis_id': analysis_id},
            {'$set': {
                'matched_features.features': features,
                'analysis_summary': summary,
                f'edits.{nama_provinsi.replace(" ", "_")}': {
                    'updated_at': now, 'pilar_count': len(rekomendasi),
                },
            }}
        )
        return Response({
            'status': 'success',
            'message': f'Rekomendasi {nama_provinsi} berhasil diperbarui.',
            'provinsi': nama_provinsi, 'pilar_count': len(rekomendasi), 'updated_at': now,
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({'error': str(e)}, status=500)


# ── API: PREDIKSI ARIMA MANDIRI ───────────────────────────────────────────────

@api_view(['POST'])
def predict_pangan_arima(request):
    """
    Prediksi mandiri (tanpa fetch BPS) untuk semua komponen IKP.
    Body: { tahun: int, keys: list[str], skenario: str }
    """
    try:
        tahun    = int(request.data.get('tahun', 2026))
        keys     = request.data.get('keys', list(PANGAN_MODEL_FILES.keys()) + ['PENDUDUK'])
        skenario = request.data.get('skenario', 'moderat').lower()

        if skenario not in ('optimis', 'moderat', 'pesimis'):
            return Response({'error': f"Skenario '{skenario}' tidak valid."}, status=400)
        if not (LAST_HIST_YEAR < tahun <= TAHUN_MAX_PREDIKSI):
            return Response({'error': f"Tahun harus antara {LAST_HIST_YEAR + 1}–{TAHUN_MAX_PREDIKSI}."}, status=400)

        models_dict, prediksi, prediksi_detail, model_metrics = {}, {}, {}, {}
        model_tersedia, model_tidak_ada = [], []

        for key in keys:
            if key == 'PENDUDUK':
                pkl_path = os.path.join(PENDUDUK_MODELS_DIR, PENDUDUK_MODEL_FILE)
                meta     = _load_metadata_penduduk()
            elif key in PANGAN_MODEL_FILES:
                pkl_path = os.path.join(PANGAN_MODELS_DIR, PANGAN_MODEL_FILES[key])
                meta     = _load_metadata_pangan(key)
            else:
                model_tidak_ada.append(key); continue

            try:
                models_dict[key] = _load_arima_model(pkl_path, key if key != 'PENDUDUK' else 'PENDUDUK')
                cv = meta.get('cv_wmape')
                model_metrics[key] = {
                    'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
                    'cv_wmape': cv, 'n_wilayah': meta.get('n_wilayah'),
                    'quality': get_quality_label(cv),
                    'arima_version': 'v1.0', 'tahun_historis': meta.get('tahun_historis'),
                }
                model_tersedia.append(key)
            except FileNotFoundError as e:
                print(f"✗ {e}"); model_tidak_ada.append(key)

        if not model_tersedia:
            return Response({'error': 'Tidak ada model ARIMA pangan tersedia.', 'model_tidak_ada': model_tidak_ada}, status=404)

        for key in model_tersedia:
            prediksi[key]        = predict_pangan_for_year(models_dict, key, tahun, skenario)
            prediksi_detail[key] = predict_pangan_all_skenario(models_dict, key, tahun)

        return Response({
            'status': 'success', 'tahun': tahun, 'skenario': skenario,
            'prediksi': prediksi, 'prediksi_detail': prediksi_detail,
            'model_metrics': model_metrics,
            'model_tersedia': model_tersedia, 'model_tidak_ada': model_tidak_ada,
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
def get_pangan_arima_info(request):
    """Info model ARIMA pangan (ketersediaan + metrik)."""
    info = {}
    all_keys = list(PANGAN_MODEL_FILES.keys()) + ['PENDUDUK']

    for key in all_keys:
        if key == 'PENDUDUK':
            tersedia = os.path.exists(os.path.join(PENDUDUK_MODELS_DIR, PENDUDUK_MODEL_FILE))
            meta     = _load_metadata_penduduk() if tersedia else {}
        else:
            tersedia = check_model_available(key)
            meta     = _load_metadata_pangan(key) if tersedia else {}

        cv = meta.get('cv_wmape')
        info[key] = {
            'tersedia': tersedia,
            'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
            'cv_wmape': cv, 'n_wilayah': meta.get('n_wilayah'),
            'quality': get_quality_label(cv),
            'tahun_historis': meta.get('tahun_historis'),
            'tahun_prediksi_range': f"{LAST_HIST_YEAR + 1}–{TAHUN_MAX_PREDIKSI}",
        }

    return Response({'status': 'success', 'model_info': info, 'timestamp': datetime.now().isoformat()})