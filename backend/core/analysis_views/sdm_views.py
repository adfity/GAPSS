from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import psycopg2, psycopg2.extras
import requests, uuid, warnings, joblib, numpy as np, json, os
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


# ── ARIMA CONFIG ──────────────────────────────────────────────────────────────

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ai_models', 'sdm')

MODEL_FILES    = {'UHH': 'model_uhh.pkl', 'RLS': 'model_rls.pkl', 'HLS': 'model_hls.pkl', 'DAYA_BELI': 'model_daya_beli.pkl'}
METADATA_FILES = {'UHH': 'metadata_uhh.json', 'RLS': 'metadata_rls.json', 'HLS': 'metadata_hls.json', 'DAYA_BELI': 'metadata_daya_beli.json'}
SKENARIO_FILES = {'UHH': 'skenario_uhh.json', 'RLS': 'skenario_rls.json', 'HLS': 'skenario_hls.json', 'DAYA_BELI': 'skenario_daya_beli.json'}

CV_METRICS_FALLBACK = {
    'UHH':       {'cv_mae': 0.0994,  'cv_rmse': 0.1492,  'cv_wmape': 0.1258},
    'RLS':       {'cv_mae': 0.1821,  'cv_rmse': 0.2534,  'cv_wmape': 1.1421},
    'HLS':       {'cv_mae': 0.2103,  'cv_rmse': 0.3012,  'cv_wmape': 0.5285},
    'DAYA_BELI': {'cv_mae': 312.45,  'cv_rmse': 445.12,  'cv_wmape': 1.6909},
}
CLIP_RANGE = {
    'UHH': (40.0, 90.0), 'RLS': (0.0, 25.0), 'HLS': (0.0, 25.0), 'DAYA_BELI': (1000.0, 50000.0),
}

LAST_HIST_YEAR     = 2023
TAHUN_MAX_PREDIKSI = 2045

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
    '91': 'PAPUA',                      '92': 'PAPUA BARAT',
    '94': 'PAPUA TENGAH',               '95': 'PAPUA PEGUNUNGAN',
    '96': 'PAPUA SELATAN',              '97': 'PAPUA BARAT DAYA',
}
PROVINSI_FALLBACK = {
    'PAPUA SELATAN': 'PAPUA', 'PAPUA TENGAH': 'PAPUA',
    'PAPUA PEGUNUNGAN': 'PAPUA', 'PAPUA BARAT DAYA': 'PAPUA BARAT',
}


# ── ARIMA HELPERS ─────────────────────────────────────────────────────────────

def _clip(val, key):
    lo, hi = CLIP_RANGE.get(key, (None, None))
    val = float(val)
    if lo is not None: val = max(lo, val)
    if hi is not None: val = min(hi, val)
    return round(val, 4)


def _load_metadata(key):
    path = os.path.join(MODELS_DIR, METADATA_FILES.get(key, ''))
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            pass
    fb = CV_METRICS_FALLBACK.get(key, {})
    return {'cv_mae': fb.get('cv_mae'), 'cv_rmse': fb.get('cv_rmse'), 'cv_wmape': fb.get('cv_wmape'),
            'n_wilayah': 38, 'tahun_historis': [2010, LAST_HIST_YEAR], 'source': 'hardcoded'}


def _load_skenario_json(key):
    path = os.path.join(MODELS_DIR, SKENARIO_FILES.get(key, ''))
    if not os.path.exists(path):
        return {}
    try:
        col, result = key.lower(), {}
        with open(path) as f:
            raw = json.load(f)
        for row in raw:
            nama  = str(row.get('wilayah', row.get('nama_provinsi', ''))).upper().strip()
            tahun = int(row.get('tahun', 0))
            if not tahun or not nama:
                continue
            result.setdefault(nama, {})[tahun] = {
                'optimis': _clip(row.get(f'{col}_optimis', row.get('optimis', 0)), key),
                'moderat': _clip(row.get(f'{col}_moderat', row.get('moderat', 0)), key),
                'pesimis': _clip(row.get(f'{col}_pesimis', row.get('pesimis', 0)), key),
                'ci_lo':   _clip(row.get(f'{col}_ci_lo',   row.get('ci_lo', 0)),   key),
                'ci_hi':   _clip(row.get(f'{col}_ci_hi',   row.get('ci_hi', 0)),   key),
            }
        return result
    except Exception as e:
        print(f'✗ skenario {key}: {e}')
        return {}


def check_arima_available(key):
    return os.path.exists(os.path.join(MODELS_DIR, MODEL_FILES.get(key, '')))


def load_model(key):
    path = os.path.join(MODELS_DIR, MODEL_FILES.get(key, ''))
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model ARIMA {key} tidak ditemukan: {path}")

    prov_bucket = {}
    for raw_key, entry in joblib.load(path).items():
        str_key = str(raw_key).strip()
        fitted  = (entry.get('model') or entry.get('result') or entry.get('fitted') or
                   next((v for v in entry.values() if v is not None and not isinstance(v, (dict, list, str, int, float, bool))), None)
                   ) if isinstance(entry, dict) else entry
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
            nama = str_key.upper().strip()
            prov_bucket.setdefault(nama, {'prov': None, 'kab': None})
            prov_bucket[nama]['prov'] = fitted

    converted = {n: (b['prov'] or b['kab']) for n, b in prov_bucket.items() if b['prov'] or b['kab']}
    for nama_baru, nama_induk in PROVINSI_FALLBACK.items():
        if nama_baru not in converted and nama_induk in converted:
            converted[nama_baru] = converted[nama_induk]
    print(f"✓ ARIMA {key}: {len(converted)} provinsi")
    return converted


def _do_forecast(model, n_steps, key):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        for method in ['get_forecast', 'forecast', 'predict']:
            try:
                if method == 'get_forecast':
                    fc  = model.get_forecast(steps=n_steps)
                    ci  = fc.conf_int(alpha=0.05)
                    return fc.predicted_mean.to_numpy(), ci.iloc[:, 0].to_numpy(), ci.iloc[:, 1].to_numpy()
                fc   = (model.forecast if method == 'forecast' else
                        model.predict)(steps=n_steps) if method == 'forecast' else \
                       model.predict(start=int(model.nobs) if hasattr(model, 'nobs') else 10,
                                     end=(int(model.nobs) if hasattr(model, 'nobs') else 10) + n_steps - 1)
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


def _build_skenario(mean, lo, hi, g_std, n_steps, key):
    if mean is None or len(mean) == 0:
        return None, None, None, None, None
    mod   = float(mean[-1])
    val_lo = float(lo[-1]) if lo is not None and len(lo) > 0 else mod - g_std * n_steps
    val_hi = float(hi[-1]) if hi is not None and len(hi) > 0 else mod + g_std * n_steps
    return _clip(mod, key), _clip(val_hi, key), _clip(val_lo, key), _clip(val_lo, key), _clip(val_hi, key)


def _predict_from_cache_or_model(models_dict, key, tahun, skenario_cache, all_scenarios=False):
    """Shared core for predict_for_year / predict_all_skenario."""
    cache = (skenario_cache or {}).get(key, {})
    result = {}
    if cache:
        for prov, thn_map in cache.items():
            if tahun in thn_map:
                result[prov] = thn_map[tahun] if all_scenarios else (
                    thn_map[tahun].get('moderat') or thn_map[tahun].get('moderat')
                )
        if result:
            return result

    model_map = models_dict.get(key, {})
    n_steps   = max(1, tahun - LAST_HIST_YEAR)
    g_std     = (_load_metadata(key) or {}).get('global_std_growth', 0.0)

    for provinsi, model in model_map.items():
        try:
            mean, lo, hi = _do_forecast(model, n_steps, key)
            mod, opt, pes, ci_lo, ci_hi = _build_skenario(mean, lo, hi, g_std, n_steps, key)
            if mod is None:
                continue
            result[provinsi] = {'optimis': opt, 'moderat': mod, 'pesimis': pes, 'ci_lo': ci_lo, 'ci_hi': ci_hi} \
                               if all_scenarios else mod
        except Exception as e:
            print(f"✗ predict {key}/{provinsi}: {e}")
    return result


def predict_for_year(models_dict, key, tahun, skenario='moderat', skenario_cache=None):
    raw = _predict_from_cache_or_model(models_dict, key, tahun, skenario_cache, all_scenarios=False)
    # raw values may be plain floats (from model) or dicts (when cache fallback returned all_scenarios)
    result = {}
    for prov, val in raw.items():
        if isinstance(val, dict):
            result[prov] = _clip(val.get(skenario, val.get('moderat', 0)), key)
        else:
            result[prov] = val
    return result


def predict_all_skenario(models_dict, key, tahun, skenario_cache=None):
    return _predict_from_cache_or_model(models_dict, key, tahun, skenario_cache, all_scenarios=True)


def get_model_quality_label(cv_wmape):
    if cv_wmape is None:
        return {'grade': '?', 'label': 'Tidak Diketahui', 'color': '#94a3b8', 'desc': 'Metrik tidak tersedia'}
    if cv_wmape < 2.0:  return {'grade': '🥇', 'label': 'Sangat Baik',      'color': '#10b981', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}
    if cv_wmape < 5.0:  return {'grade': '✅', 'label': 'Baik',             'color': '#3b82f6', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}
    if cv_wmape < 10.0: return {'grade': '⚠️', 'label': 'Cukup',            'color': '#f59e0b', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}
    return              {'grade': '❌', 'label': 'Perlu Perhatian',          'color': '#ef4444', 'desc': f'CV-WMAPE {cv_wmape:.4f}%'}


# ── SDM CONSTANTS ─────────────────────────────────────────────────────────────

TAHUN_BPS_MAP    = {2020: 120, 2021: 121, 2022: 122, 2023: 123, 2024: 124, 2025: 125, 2026: 126}
TAHUN_BPS_AKTUAL = list(TAHUN_BPS_MAP.keys())
TAHUN_ARIMA_ONLY = list(range(2027, TAHUN_MAX_PREDIKSI + 1))
TAHUN_SEMUA      = sorted(TAHUN_BPS_AKTUAL + TAHUN_ARIMA_ONLY)

INDIKATOR_DATASET_MAP = {
    'ALL': ['UHH', 'RLS', 'HLS', 'DAYA_BELI'],
    'KESEHATAN': ['UHH'], 'PENDIDIKAN': ['RLS', 'HLS'], 'DAYA_BELI': ['DAYA_BELI'],
}
THRESHOLD_MAP = {
    'ALL':        {'TINGGI': 0.70, 'SEDANG': 0.60},
    'KESEHATAN':  {'TINGGI': 0.80, 'SEDANG': 0.72},
    'PENDIDIKAN': {'TINGGI': 0.65, 'SEDANG': 0.55},
    'DAYA_BELI':  {'TINGGI': 0.60, 'SEDANG': 0.30},
}
UHH_MAX, RLS_MAX, HLS_MAX = 85.0, 15.0, 18.0

# Prioritas kebijakan per band nilai indeks
PRIORITAS_BAND = {
    'RENDAH': [(0.00, 0.42, [1, 2]), (0.42, 0.52, [1, 2, 3]), (0.52, 1.00, [2, 3])],
    'SEDANG': [(0.00, 0.625, [3, 4]), (0.625, 0.655, [3, 4]), (0.655, 1.00, [3, 4])],
    'TINGGI': [(0.00, 0.745, [4, 5, 6]), (0.745, 0.82, [4, 5, 6]), (0.82, 1.00, [5, 6])],
}
_PRIORITAS_FALLBACK = {'RENDAH': [1, 2, 3], 'SEDANG': [3, 4], 'TINGGI': [4, 5, 6]}


# ── SDM HELPERS ───────────────────────────────────────────────────────────────

def get_indikator_config(tahun):
    th   = TAHUN_BPS_MAP.get(tahun, 124)
    base = f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000"
    return {
        "UHH":       {"url_template": f"{base}/var/414/th/{th}/key/{{key}}/", "nama": "Umur Harapan Hidup",                  "satuan": "tahun",                   "has_gender": True,  "penjelasan": "UHH mencerminkan derajat kesehatan populasi"},
        "HLS":       {"url_template": f"{base}/var/417/th/{th}/key/{{key}}/", "nama": "Harapan Lama Sekolah",                "satuan": "tahun",                   "has_gender": False, "penjelasan": "HLS mencerminkan harapan anak baru masuk sekolah"},
        "RLS":       {"url_template": f"{base}/var/415/th/{th}/key/{{key}}/", "nama": "Rata-rata Lama Sekolah",              "satuan": "tahun",                   "has_gender": False, "penjelasan": "RLS mencerminkan tingkat pendidikan rata-rata penduduk dewasa"},
        "DAYA_BELI": {"url_template": f"{base}/var/416/th/{th}/key/{{key}}/", "nama": "Pengeluaran per Kapita Disesuaikan",  "satuan": "Ribu Rupiah/Orang/Tahun", "has_gender": False, "penjelasan": "Pengeluaran per kapita riil yang disesuaikan"},
    }


def _is_data_empty(data):
    dc = (data or {}).get("datacontent", {})
    return not dc or not any(v for v in dc.values() if v is not None and v != 0)


def normalize_province_name(name):
    name = str(name)
    for tag in ['<b>', '</b>', '<B>', '</B>']:
        name = name.replace(tag, '')
    name = name.upper().strip()

    SPECIAL = {
        'DKI JAKARTA': 'JAKARTA', 'DAERAH KHUSUS IBUKOTA JAKARTA': 'JAKARTA', 'DKI': 'JAKARTA',
        'YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA', 'DIY': 'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA', 'D I YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG', 'KEP. BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU': 'KEPULAUAN RIAU',
    }
    for k, v in SPECIAL.items():
        if k in name:
            return v
    for a, f in {'KEP.': 'KEPULAUAN', 'KEP ': 'KEPULAUAN ', 'NTB': 'NUSA TENGGARA BARAT', 'NTT': 'NUSA TENGGARA TIMUR'}.items():
        name = name.replace(a, f)
    for prefix in ['PROVINSI ', 'PROV. ', 'PROV ', 'DAERAH KHUSUS IBUKOTA ']:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name.strip()


def _get_prioritas_for_nilai(status, nilai):
    if nilai is None:
        return list(range(1, 8))
    for lo, hi, prios in PRIORITAS_BAND.get(status, []):
        if lo <= nilai < hi:
            return prios
    return _PRIORITAS_FALLBACK.get(status, list(range(1, 8)))


def get_bank_kebijakan_by_kategori(kategori_list, limit_per_kategori=10, indeks_nilai=None):
    results, conn = [], None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for status in [k for k in kategori_list if k in ('TINGGI', 'SEDANG', 'RENDAH')]:
            prio_list    = _get_prioritas_for_nilai(status, (indeks_nilai or {}).get(status))
            placeholders = ','.join(['%s'] * len(prio_list))
            cur.execute(f"""
                SELECT id, indeks, status, prioritas, pilar_kebijakan,
                       isu_strategis, kebijakan, rekomendasi_program, indikator_terkait
                FROM bank_kebijakan
                WHERE indeks = 'ISDM' AND status = %s AND prioritas IN ({placeholders})
                ORDER BY prioritas ASC, pilar_kebijakan ASC LIMIT %s
            """, (status, *prio_list, limit_per_kategori))

            rows = [dict(r) for r in cur.fetchall()]

            # ── FALLBACK: kalau 0 hasil, ambil semua prioritas untuk status ini ──
            if not rows:
                cur.execute("""
                    SELECT id, indeks, status, prioritas, pilar_kebijakan,
                           isu_strategis, kebijakan, rekomendasi_program, indikator_terkait
                    FROM bank_kebijakan
                    WHERE indeks = 'ISDM' AND status = %s
                    ORDER BY prioritas ASC, pilar_kebijakan ASC LIMIT %s
                """, (status, limit_per_kategori))
                rows = [dict(r) for r in cur.fetchall()]

            pilar_map = {}
            for row in rows:
                pilar = row['pilar_kebijakan'] or 'Umum'
                pilar_map.setdefault(pilar, {"pilar": pilar, "prioritas": row['prioritas'], "jumlah_aksi": 0, "aksi": []})
                pilar_map[pilar]['aksi'].append({
                    "no_aksi": len(pilar_map[pilar]['aksi']) + 1,
                    "isu_strategis": row['isu_strategis'], "nama_aksi": row['kebijakan'],
                    "detail_aksi": row['rekomendasi_program'], "indikator_terkait": row['indikator_terkait'],
                    "sub_sektor": row['pilar_kebijakan'],
                })
                pilar_map[pilar]['jumlah_aksi'] += 1
            results.extend(pilar_map.values())
        cur.close()
    except Exception as e:
        print(f"✗ get_bank_kebijakan: {e}")
    finally:
        if conn: conn.close()
    return results

# ── SDM ANALYTICS CLASS ───────────────────────────────────────────────────────

class SdmAnalytics:
    COLORS = {"TINGGI": "#10b981", "SEDANG": "#f59e0b", "RENDAH": "#ef4444"}

    def __init__(self, tahun=2024):
        self.tahun            = tahun
        self.indikator_config = get_indikator_config(tahun)
        self.timestamp_fetch  = None

    def fetch_selected_data(self, keys):
        self.timestamp_fetch = datetime.now().isoformat()
        result = {}
        for key in keys:
            config = self.indikator_config.get(key)
            if not config:
                continue
            try:
                resp = requests.get(config["url_template"].format(key=BPS_API_KEY), timeout=30)
                raw  = resp.json() if resp.status_code == 200 else None
                result[key] = raw if raw and raw.get("datacontent") else None
            except Exception as e:
                print(f"✗ {key}: {e}")
                result[key] = None
        return result

    def parse_bps_data(self, raw_data, key):
        province_values, raw_breakdown = {}, {}
        if not raw_data:
            return province_values, raw_breakdown
        try:
            datacontent   = raw_data.get("datacontent", {})
            prov_code_map = {
                str(item.get("val", "")): item.get("label", "")
                for item in raw_data.get("vervar", [])
                if str(item.get("val", "")) not in ("", "9999")
                and len(str(item.get("val", ""))) == 4
                and str(item.get("val", "")).endswith("00")
            }
            for dc_key, value in datacontent.items():
                prov_code = dc_key[:4] if len(dc_key) >= 4 else None
                if not prov_code or prov_code not in prov_code_map or value is None:
                    continue
                try:
                    val_float = float(value)
                    prov_name = normalize_province_name(prov_code_map[prov_code])
                    province_values[prov_name] = round(
                        (province_values[prov_name] + val_float) / 2 if prov_name in province_values else val_float, 2
                    )
                    raw_breakdown[prov_name] = {"provinsi": prov_name, "nilai": province_values[prov_name]}
                except (ValueError, TypeError):
                    continue
        except Exception as e:
            print(f"❌ Parse {key}: {e}")
        return province_values, raw_breakdown

    def calculate_indices(self, data_sdm, pengeluaran_min, pengeluaran_max, indikator='ALL'):
        uhh, hls, rls, pengeluaran = data_sdm.get("UHH"), data_sdm.get("HLS"), data_sdm.get("RLS"), data_sdm.get("DAYA_BELI")
        ik  = round(min(uhh / UHH_MAX, 1.0), 4) if uhh is not None else None
        ip  = round(min(((rls or 0) / RLS_MAX + (hls or 0) / HLS_MAX) / (2 if rls and hls else 1), 1.0), 4) \
              if rls is not None or hls is not None else None
        denom = pengeluaran_max - pengeluaran_min
        idb = round(min((pengeluaran - pengeluaran_min) / denom, 1.0), 4) \
              if pengeluaran is not None and denom > 0 else (0.5 if pengeluaran is not None else None)

        components    = [c for c in [ik, ip, idb] if c is not None]
        indeks_sdm_all = round(sum(components) / len(components), 4) if components else None
        indeks_sdm     = {'ALL': indeks_sdm_all, 'KESEHATAN': ik, 'PENDIDIKAN': ip, 'DAYA_BELI': idb}.get(indikator, indeks_sdm_all)
        return {"ik": ik, "ip": ip, "idb": idb, "indeks_sdm": indeks_sdm, "indeks_sdm_all": indeks_sdm_all}

    def categorize_province(self, scores, indikator='ALL'):
        nilai = {'ALL': scores.get('indeks_sdm_all'), 'KESEHATAN': scores.get('ik'),
                 'PENDIDIKAN': scores.get('ip'), 'DAYA_BELI': scores.get('idb')}.get(indikator, scores.get('indeks_sdm_all'))
        if nilai is None:
            return "TIDAK DIKETAHUI", "#6b7280"
        th = THRESHOLD_MAP.get(indikator, THRESHOLD_MAP['ALL'])
        if nilai >= th['TINGGI']:   return "TINGGI", self.COLORS["TINGGI"]
        if nilai >= th['SEDANG']:   return "SEDANG", self.COLORS["SEDANG"]
        return "RENDAH", self.COLORS["RENDAH"]

    def generate_insights(self, provinsi, data_sdm, scores, kategori, indeks_sdm, indikator='ALL'):
        insights = [f"Provinsi {provinsi} memiliki Indeks {indikator if indikator != 'ALL' else 'SDM'} {indeks_sdm} — kategori {kategori}."]
        uhh, rls, hls, pengeluaran = data_sdm.get("UHH"), data_sdm.get("RLS"), data_sdm.get("HLS"), data_sdm.get("DAYA_BELI")
        ik, ip, idb = scores.get("ik"), scores.get("ip"), scores.get("idb")

        if indikator in ('ALL', 'KESEHATAN') and uhh is not None:
            insights.append(f"{'✅' if uhh >= 68 else '⚠️' if uhh >= 61 else '🚨'} UHH {uhh} tahun (IK = {ik}).")
        if indikator in ('ALL', 'PENDIDIKAN'):
            if rls is not None:
                insights.append(f"{'✅' if rls >= 9.0 else '⚠️' if rls >= 7.0 else '🚨'} RLS {rls} tahun (IP = {ip}).")
            if hls is not None:
                insights.append(f"{'✅' if hls >= 13.0 else '⚠️' if hls >= 11.0 else '🚨'} HLS {hls} tahun.")
        if indikator in ('ALL', 'DAYA_BELI') and pengeluaran is not None and idb is not None:
            insights.append(f"{'💰' if idb >= 0.60 else '💵' if idb >= 0.30 else '💸'} Pengeluaran Rp{pengeluaran:,.0f} ribu (IDB = {idb}).")
        return insights


# ── API ENDPOINTS — SDM ANALYSIS ──────────────────────────────────────────────

@api_view(['POST'])
def check_sdm_year_data(request):
    tahun     = int(request.data.get('tahun', 2024))
    indikator = request.data.get('indikator', 'ALL')
    if tahun not in TAHUN_SEMUA:
        return Response({"error": f"Tahun {tahun} tidak didukung. Pilih antara 2020–{TAHUN_MAX_PREDIKSI}."}, status=400)

    keys_to_check  = INDIKATOR_DATASET_MAP.get(indikator, INDIKATOR_DATASET_MAP['ALL'])
    is_arima_only  = tahun in TAHUN_ARIMA_ONLY
    arima_metrics  = {}

    def _build_arima_metric(key):
        meta     = _load_metadata(key)
        cv_wmape = meta.get('cv_wmape')
        return {'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'), 'cv_wmape': cv_wmape,
                'n_wilayah': meta.get('n_wilayah'), 'quality': get_model_quality_label(cv_wmape)}

    if is_arima_only:
        dataset_status = {}
        for key in keys_to_check:
            avail = check_arima_available(key)
            dataset_status[key] = {"nama": key, "tersedia": False, "status": "Tahun Prediksi — Gunakan ARIMA", "arima_tersedia": avail}
            if avail:
                arima_metrics[key] = _build_arima_metric(key)
        arima_keys = [k for k, v in dataset_status.items() if v.get('arima_tersedia')]
        return Response({
            "tahun": tahun, "indikator": indikator, "dataset_status": dataset_status,
            "tersedia": [], "kosong": keys_to_check, "semua_kosong": True, "ada_yang_kosong": False,
            "bisa_dieksekusi": False, "is_prediction_year": True, "is_arima_only": True,
            "bisa_pakai_arima": len(arima_keys) == len(keys_to_check),
            "arima_keys": arima_keys, "arima_metrics": arima_metrics,
        })

    if not BPS_API_KEY:
        return Response({"error": "BPS Web API Key belum dikonfigurasi"}, status=500)

    all_config, dataset_status = get_indikator_config(tahun), {}
    for key in keys_to_check:
        config    = all_config.get(key)
        avail     = check_arima_available(key)
        try:
            resp  = requests.get(config["url_template"].format(key=BPS_API_KEY), timeout=20)
            kosong = _is_data_empty(resp.json()) if resp.status_code == 200 else True
            dataset_status[key] = {"nama": config["nama"], "tersedia": not kosong,
                                   "status": "Tersedia" if not kosong else "Kosong / Tidak Tersedia", "arima_tersedia": avail}
        except Exception as e:
            dataset_status[key] = {"nama": config["nama"], "tersedia": False, "status": f"Gagal ({str(e)[:50]})", "arima_tersedia": avail}
        if avail:
            arima_metrics[key] = _build_arima_metric(key)

    tersedia_list = [k for k, v in dataset_status.items() if v["tersedia"]]
    kosong_list   = [k for k, v in dataset_status.items() if not v["tersedia"]]
    arima_keys    = [k for k in kosong_list if dataset_status[k].get("arima_tersedia")]
    return Response({
        "tahun": tahun, "indikator": indikator, "dataset_status": dataset_status,
        "tersedia": tersedia_list, "kosong": kosong_list,
        "semua_kosong": not tersedia_list, "ada_yang_kosong": bool(kosong_list) and bool(tersedia_list),
        "bisa_dieksekusi": bool(tersedia_list) and not kosong_list,
        "is_prediction_year": False, "bisa_pakai_arima": bool(kosong_list) and len(arima_keys) == len(kosong_list),
        "arima_keys": arima_keys, "arima_metrics": arima_metrics,
    })


@api_view(['POST'])
def analyze_sdm_bps(request):
    if not BPS_API_KEY and request.data.get('tahun', 2024) in TAHUN_BPS_MAP:
        return Response({"error": "BPS Web API Key belum dikonfigurasi"}, status=500)
    try:
        tahun     = int(request.data.get('tahun', 2024))
        indikator = request.data.get('indikator', 'ALL') if request.data.get('indikator') in INDIKATOR_DATASET_MAP else 'ALL'
        use_arima = bool(request.data.get('use_arima', False))
        skenario  = request.data.get('skenario', 'moderat').lower()
        arima_keys_req = request.data.get('arima_keys', [])

        if tahun not in TAHUN_SEMUA:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)

        is_prediction_year = tahun in TAHUN_ARIMA_ONLY
        keys_aktif         = INDIKATOR_DATASET_MAP[indikator]
        analytics          = SdmAnalytics(tahun=min(tahun, 2026))

        raw_data = analytics.fetch_selected_data(keys_aktif) if not is_prediction_year and BPS_API_KEY else {k: None for k in keys_aktif}

        empty = ({}, {})
        uhh_values,  uhh_raw  = analytics.parse_bps_data(raw_data.get('UHH'),       'UHH')       if 'UHH'       in keys_aktif else empty
        hls_values,  hls_raw  = analytics.parse_bps_data(raw_data.get('HLS'),       'HLS')       if 'HLS'       in keys_aktif else empty
        rls_values,  rls_raw  = analytics.parse_bps_data(raw_data.get('RLS'),       'RLS')       if 'RLS'       in keys_aktif else empty
        peng_values, peng_raw = analytics.parse_bps_data(raw_data.get('DAYA_BELI'), 'DAYA_BELI') if 'DAYA_BELI' in keys_aktif else empty

        arima_detail, arima_filled, arima_metrics = {}, [], {}

        if use_arima or is_prediction_year:
            valid_arima = keys_aktif if is_prediction_year else [k for k in (arima_keys_req or keys_aktif) if k in keys_aktif]
            models_dict, skenario_cache = {}, {}

            for pk in valid_arima:
                try:
                    models_dict[pk]    = load_model(pk)
                    skenario_cache[pk] = _load_skenario_json(pk)
                    meta               = _load_metadata(pk)
                    cv_wmape           = meta.get('cv_wmape')
                    arima_metrics[pk]  = {'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
                                          'cv_wmape': cv_wmape, 'n_wilayah': meta.get('n_wilayah'),
                                          'quality': get_model_quality_label(cv_wmape),
                                          'arima_version': 'v4.0', 'tahun_historis': meta.get('tahun_historis')}
                except Exception as e:
                    print(f"✗ ARIMA {pk}: {e}")

            fill_map = {'UHH': uhh_values, 'RLS': rls_values, 'HLS': hls_values, 'DAYA_BELI': peng_values}
            for pk in [k for k in valid_arima if k in models_dict]:
                pred_vals         = predict_for_year(models_dict, pk, tahun, skenario, skenario_cache)
                arima_detail[pk]  = predict_all_skenario(models_dict, pk, tahun, skenario_cache)
                arima_filled.append(pk)
                fill_map[pk].update({k: v for k, v in pred_vals.items() if k not in fill_map[pk]})
            uhh_values, rls_values, hls_values, peng_values = fill_map['UHH'], fill_map['RLS'], fill_map['HLS'], fill_map['DAYA_BELI']

        peng_list        = [v for v in peng_values.values() if v is not None]
        pengeluaran_min  = min(peng_list) if peng_list else 0.0
        pengeluaran_max  = max(peng_list) if peng_list else 1.0

        boundary_features = list(mongo_db["batas_provinsi"].find({}, {'_id': 0}))
        province_map      = {}
        for feat in boundary_features:
            props = feat.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    for nv in [str(props[field]).upper().strip(), normalize_province_name(str(props[field]))]:
                        province_map[nv] = feat

        all_provinces = set()
        for key, vals in [('UHH', uhh_values), ('HLS', hls_values), ('RLS', rls_values), ('DAYA_BELI', peng_values)]:
            if key in keys_aktif:
                all_provinces.update(vals.keys())

        matched_features, analysis_summary, sdm_data_for_xlsx = [], [], {}
        kategori_counts  = {"TINGGI": 0, "SEDANG": 0, "RENDAH": 0}
        kebijakan_cache  = {}
        bps_raw_sets     = {'UHH': set(uhh_raw), 'RLS': set(rls_raw), 'HLS': set(hls_raw), 'DAYA_BELI': set(peng_raw)}

        for prov_name in sorted(all_provinces):
            is_from_arima = {pk: (prov_name not in bps_raw_sets.get(pk, set()) and pk in arima_filled) for pk in keys_aktif}
            data_sdm = {
                "UHH":       uhh_values.get(prov_name)  if 'UHH'       in keys_aktif else None,
                "HLS":       hls_values.get(prov_name)  if 'HLS'       in keys_aktif else None,
                "RLS":       rls_values.get(prov_name)  if 'RLS'       in keys_aktif else None,
                "DAYA_BELI": peng_values.get(prov_name) if 'DAYA_BELI' in keys_aktif else None,
            }
            if not any(v is not None for v in data_sdm.values()):
                continue

            scores          = analytics.calculate_indices(data_sdm, pengeluaran_min, pengeluaran_max, indikator)
            kategori, warna = analytics.categorize_province(scores, indikator)
            indeks_sdm      = scores["indeks_sdm"]
            insights        = analytics.generate_insights(prov_name, data_sdm, scores, kategori, indeks_sdm, indikator)

            if any(is_from_arima.values()):
                insights.insert(1, f"⚙️ [AI Prediksi ARIMA v4.0 · {skenario}] — " + ", ".join(k for k, v in is_from_arima.items() if v))

            kategori_per_ind = {ind: analytics.categorize_province(scores, ind)[0] for ind in ['ALL', 'KESEHATAN', 'PENDIDIKAN', 'DAYA_BELI']}
            warna_per_ind    = {ind: analytics.categorize_province(scores, ind)[1] for ind in ['ALL', 'KESEHATAN', 'PENDIDIKAN', 'DAYA_BELI']}

            nilai_bucket = round(round(indeks_sdm / 0.05) * 0.05, 2) if indeks_sdm is not None else None
            ck = (kategori, nilai_bucket)
            if ck not in kebijakan_cache:
                kebijakan_cache[ck] = get_bank_kebijakan_by_kategori([kategori], 10, {kategori: indeks_sdm})
            rekomendasi = kebijakan_cache[ck]

            norm = normalize_province_name(prov_name)
            matched_feature = province_map.get(norm) or province_map.get(prov_name) or next(
                (f for mn, f in province_map.items() if norm in mn or mn in norm), None)
            if not matched_feature:
                continue

            kategori_counts[kategori] = kategori_counts.get(kategori, 0) + 1
            feature_copy              = matched_feature.copy()
            props                     = feature_copy.get('properties', {})
            arima_keys_used           = [k for k, v in is_from_arima.items() if v]

            props['sdm_analysis'] = {
                "nama_provinsi": prov_name, "indikator": indikator,
                "kategori": kategori, "warna": warna,
                "indeks_sdm": indeks_sdm, "indeks_sdm_all": scores.get("indeks_sdm_all"),
                "ik": scores["ik"], "ip": scores["ip"], "idb": scores["idb"],
                "insights": insights, "rekomendasi": rekomendasi,
                "kategori_per_indikator": kategori_per_ind, "warna_per_indikator": warna_per_ind,
                "use_arima": bool(arima_keys_used), "arima_keys_used": arima_keys_used,
                "skenario_arima": skenario if arima_keys_used else None,
                "arima_detail":  {pk: arima_detail.get(pk, {}).get(prov_name) for pk in arima_filled if is_from_arima.get(pk)},
                "arima_metrics": {pk: arima_metrics.get(pk) for pk in arima_filled if is_from_arima.get(pk)},
                "data_komponen": data_sdm,
            }
            feature_copy['properties'] = props
            matched_features.append(feature_copy)

            summary_row = {
                "provinsi": prov_name, "indikator": indikator, "kategori": kategori, "warna": warna,
                "indeks_sdm": indeks_sdm, "indeks_sdm_all": scores.get("indeks_sdm_all"),
                "ik": scores["ik"], "ip": scores["ip"], "idb": scores["idb"],
                "uhh": data_sdm.get("UHH"), "hls": data_sdm.get("HLS"), "rls": data_sdm.get("RLS"),
                "pengeluaran": data_sdm.get("DAYA_BELI"),
                "kategori_per_indikator": kategori_per_ind, "warna_per_indikator": warna_per_ind,
                "use_arima": bool(arima_keys_used), "arima_keys_used": arima_keys_used,
            }
            analysis_summary.append(summary_row)
            sdm_data_for_xlsx[prov_name] = {**summary_row, "provinsi": prov_name}

        sorted_summary  = sorted([s for s in analysis_summary if s['indeks_sdm'] is not None], key=lambda x: x['indeks_sdm'])
        return Response({
            "status": "success",
            "source": "ARIMA v4.0 Prediksi" if is_prediction_year else "BPS Web API — IPM Metode Baru",
            "tahun": tahun, "indikator": indikator, "is_prediction_year": is_prediction_year,
            "dataset_aktif": keys_aktif, "total_success": len(matched_features),
            "kategori_distribusi": kategori_counts, "timestamp": analytics.timestamp_fetch,
            "formula": {"IK": "UHH / 85", "IP": "(RLS/15 + HLS/18) / 2", "IDB": "(Pengeluaran - min) / (max - min)", "Indeks_SDM": "(IK + IP + IDB) / 3"},
            "threshold_klasifikasi": THRESHOLD_MAP.get(indikator, THRESHOLD_MAP['ALL']),
            "use_arima": bool(arima_filled), "skenario": skenario if arima_filled else None,
            "arima_keys": arima_filled, "arima_metrics": arima_metrics,
            "matched_features": {"type": "FeatureCollection", "features": matched_features},
            "analysis_summary": analysis_summary, "sdm_data": sdm_data_for_xlsx,
            "worst_provinces": sorted_summary[:5], "best_provinces": sorted_summary[-5:][::-1],
            "colors": SdmAnalytics.COLORS,
            "indikator_info": {k: {"nama": v["nama"], "satuan": v["satuan"], "penjelasan": v["penjelasan"]}
                               for k, v in get_indikator_config(min(tahun, 2026)).items()},
            "raw_datasets": {"timestamp": analytics.timestamp_fetch, "tahun": tahun, "indikator": indikator,
                             "pengeluaran_min": pengeluaran_min, "pengeluaran_max": pengeluaran_max},
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e), "message": "Gagal menganalisis data SDM"}, status=500)


# ── API ENDPOINTS — BANK KEBIJAKAN ────────────────────────────────────────────

def _kebijakan_row_to_dict(r):
    return {"id": r["id"], "status": r["status"], "prioritas": r["prioritas"], "pilar": r["pilar_kebijakan"],
            "kebijakan": r["kebijakan"], "rekomendasi": r["rekomendasi_program"],
            "indikator": r["indikator_terkait"], "isu_strategis": r.get("isu_strategis")}


@api_view(['GET'])
def get_bank_kebijakan_sdm(request):
    conn = None
    try:
        conn   = get_pg_connection()
        cur    = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query  = "SELECT id, indeks, status, prioritas, pilar_kebijakan, isu_strategis, kebijakan, rekomendasi_program, indikator_terkait FROM bank_kebijakan WHERE indeks = 'ISDM'"
        params = []
        sf, idF, pf = request.GET.get('status'), request.GET.get('indikator'), request.GET.get('pilar')
        if sf and sf.upper() in ('TINGGI', 'SEDANG', 'RENDAH'):
            query += " AND status = %s"; params.append(sf.upper())
        if idF:
            query += " AND indikator_terkait = %s"; params.append(idF.upper())
        if pf:
            query += " AND pilar_kebijakan ILIKE %s"; params.append(f"%{pf}%")
        query += " ORDER BY status ASC, prioritas ASC, pilar_kebijakan ASC"
        cur.execute(query, params)
        hasil = [_kebijakan_row_to_dict(dict(r)) for r in cur.fetchall()]
        cur.close()
        return Response({"status": "success", "count": len(hasil), "results": hasil})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['POST'])
def add_bank_kebijakan_sdm(request):
    conn = None
    try:
        data     = request.data
        required = ['status', 'prioritas', 'pilar_kebijakan', 'kebijakan', 'rekomendasi_program', 'indikator_terkait']
        for f in required:
            if not data.get(f):
                return Response({"error": f"Field '{f}' wajib diisi."}, status=400)
        status = data['status'].upper()
        if status not in ('TINGGI', 'SEDANG', 'RENDAH'):
            return Response({"error": "Status harus TINGGI, SEDANG, atau RENDAH."}, status=400)
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            INSERT INTO bank_kebijakan (indeks, status, prioritas, pilar_kebijakan, isu_strategis, kebijakan, rekomendasi_program, indikator_terkait)
            VALUES ('ISDM', %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (status, int(data['prioritas']), data['pilar_kebijakan'], data.get('isu_strategis', ''),
              data['kebijakan'], data['rekomendasi_program'], data['indikator_terkait'].upper()))
        new_id = cur.fetchone()['id']
        conn.commit(); cur.close()
        return Response({"status": "success", "message": "Kebijakan berhasil ditambahkan.", "id": new_id})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['PUT'])
def update_bank_kebijakan_sdm(request, kebijakan_id):
    conn = None
    try:
        d    = request.data
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE bank_kebijakan SET status=%s, prioritas=%s, pilar_kebijakan=%s,
            isu_strategis=%s, kebijakan=%s, rekomendasi_program=%s, indikator_terkait=%s
            WHERE id=%s AND indeks='ISDM'
        """, (d['status'].upper(), int(d['prioritas']), d['pilar_kebijakan'], d.get('isu_strategis', ''),
              d['kebijakan'], d['rekomendasi_program'], d['indikator_terkait'].upper(), kebijakan_id))
        if cur.rowcount == 0:
            return Response({"error": "Kebijakan tidak ditemukan."}, status=404)
        conn.commit(); cur.close()
        return Response({"status": "success", "message": "Kebijakan berhasil diperbarui."})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


@api_view(['DELETE'])
def delete_bank_kebijakan_sdm(request, kebijakan_id):
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute("DELETE FROM bank_kebijakan WHERE id=%s AND indeks='ISDM'", (kebijakan_id,))
        if cur.rowcount == 0:
            return Response({"error": "Kebijakan tidak ditemukan."}, status=404)
        conn.commit(); cur.close()
        return Response({"status": "success", "message": "Kebijakan berhasil dihapus."})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


# ── API ENDPOINTS — CRUD ANALISIS (MongoDB) ───────────────────────────────────

@api_view(['POST'])
def save_sdm_analysis(request):
    try:
        name = request.data.get('name', 'Analisis SDM Tanpa Nama')
        data = request.data.get('analysis_data')
        if not data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)
        analysis_id = str(uuid.uuid4())
        doc = {"analysis_id": analysis_id, "name": name, "type": "sdm",
               "timestamp": datetime.now().isoformat(), **data}
        mongo_db["sdm_analysis"].insert_one(doc)
        return Response({"status": "success", "message": f"Analisis '{name}' berhasil disimpan",
                         "analysis_id": analysis_id, "saved_at": doc["timestamp"]})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_sdm_analysis_list(request):
    try:
        results = list(mongo_db["sdm_analysis"].find(
            {}, {"_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
                 "total_success": 1, "kategori_distribusi": 1, "tahun": 1,
                 "indikator": 1, "use_arima": 1, "skenario": 1, "is_prediction_year": 1}
        ).sort("timestamp", -1))
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_sdm_analysis_detail(request, analysis_id):
    try:
        result = mongo_db["sdm_analysis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not result:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_sdm_analysis(request, analysis_id):
    try:
        result = mongo_db["sdm_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response({"status": "success", "message": "Analisis SDM berhasil dihapus"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ── API ENDPOINT — EDIT REKOMENDASI PER PROVINSI ──────────────────────────────

@api_view(['GET'])
def get_bank_kebijakan_isdm_for_provinsi(request):
    conn = None
    try:
        conn    = get_pg_connection()
        cur     = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query   = "SELECT id, status, prioritas, pilar_kebijakan, isu_strategis, kebijakan, rekomendasi_program, indikator_terkait FROM bank_kebijakan WHERE indeks = 'ISDM'"
        params  = []
        sf      = request.GET.get('status', '').upper()
        if sf in ('TINGGI', 'SEDANG', 'RENDAH'):
            query += " AND status = %s"; params.append(sf)
        query  += " ORDER BY status ASC, prioritas ASC, pilar_kebijakan ASC"
        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()

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


@api_view(['PATCH'])
def patch_provinsi_kebijakan(request, analysis_id):
    try:
        nama_provinsi = request.data.get('nama_provinsi', '').strip().upper()
        rekomendasi   = request.data.get('rekomendasi')
        if not nama_provinsi:
            return Response({'error': 'nama_provinsi wajib diisi.'}, status=400)
        if rekomendasi is None or not isinstance(rekomendasi, list):
            return Response({'error': 'rekomendasi harus berupa array.'}, status=400)

        doc = mongo_db['sdm_analysis'].find_one({'analysis_id': analysis_id})
        if not doc:
            return Response({'error': 'Analisis tidak ditemukan.'}, status=404)

        features = doc.get('matched_features', {}).get('features', [])
        updated  = False
        now      = datetime.now().isoformat()

        for feat in features:
            sdm = feat.get('properties', {}).get('sdm_analysis', {})
            if sdm.get('nama_provinsi', '').upper().strip() == nama_provinsi:
                sdm.update({'rekomendasi': rekomendasi, 'rekomendasi_edited': True, 'rekomendasi_edited_at': now})
                feat['properties']['sdm_analysis'] = sdm
                updated = True
                break

        if not updated:
            return Response({'error': f'Provinsi "{nama_provinsi}" tidak ditemukan dalam analisis.'}, status=404)

        summary = doc.get('analysis_summary', [])
        for s in summary:
            if s.get('provinsi', '').upper().strip() == nama_provinsi:
                s['rekomendasi_edited'] = True
                break

        mongo_db['sdm_analysis'].update_one(
            {'analysis_id': analysis_id},
            {'$set': {
                'matched_features.features': features, 'analysis_summary': summary,
                f'edits.{nama_provinsi.replace(" ", "_")}': {'updated_at': now, 'pilar_count': len(rekomendasi)},
            }}
        )
        return Response({'status': 'success', 'message': f'Rekomendasi {nama_provinsi} berhasil diperbarui.',
                         'provinsi': nama_provinsi, 'pilar_count': len(rekomendasi), 'updated_at': now})
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({'error': str(e)}, status=500)


# ── API ENDPOINTS — ARIMA ─────────────────────────────────────────────────────

@api_view(['POST'])
def predict_sdm_arima(request):
    try:
        tahun    = int(request.data.get('tahun', 2026))
        keys     = request.data.get('keys', list(MODEL_FILES.keys()))
        skenario = request.data.get('skenario', 'moderat').lower()

        if skenario not in ('optimis', 'moderat', 'pesimis'):
            return Response({"error": f"Skenario '{skenario}' tidak valid."}, status=400)
        if not (2024 <= tahun <= TAHUN_MAX_PREDIKSI):
            return Response({"error": f"Tahun harus antara 2024–{TAHUN_MAX_PREDIKSI}"}, status=400)

        models_dict, skenario_cache, metadata_all = {}, {}, {}
        model_tersedia, model_tidak_ada = [], []

        for key in keys:
            if key not in MODEL_FILES:
                model_tidak_ada.append(key); continue
            try:
                models_dict[key]    = load_model(key)
                skenario_cache[key] = _load_skenario_json(key)
                metadata_all[key]   = _load_metadata(key)
                model_tersedia.append(key)
            except FileNotFoundError as e:
                print(f"✗ {e}"); model_tidak_ada.append(key)

        if not model_tersedia:
            return Response({"error": "Tidak ada model ARIMA tersedia", "model_tidak_ada": model_tidak_ada}, status=404)

        prediksi, prediksi_detail, model_metrics = {}, {}, {}
        for key in model_tersedia:
            prediksi[key]        = predict_for_year(models_dict, key, tahun, skenario, skenario_cache)
            prediksi_detail[key] = predict_all_skenario(models_dict, key, tahun, skenario_cache)
            meta                 = metadata_all.get(key, {})
            cv_wmape             = meta.get('cv_wmape')
            model_metrics[key]   = {'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
                                    'cv_wmape': cv_wmape, 'n_wilayah': meta.get('n_wilayah'),
                                    'quality': get_model_quality_label(cv_wmape),
                                    'tahun_historis': meta.get('tahun_historis')}

        return Response({
            "status": "success", "tahun": tahun, "skenario": skenario,
            "prediksi": prediksi, "prediksi_detail": prediksi_detail,
            "model_metrics": model_metrics, "model_tersedia": model_tersedia,
            "model_tidak_ada": model_tidak_ada, "timestamp": datetime.now().isoformat(),
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_arima_model_info(request):
    info = {}
    for key in MODEL_FILES:
        tersedia = check_arima_available(key)
        meta     = _load_metadata(key) if tersedia else {}
        cv_wmape = meta.get('cv_wmape')
        info[key] = {'tersedia': tersedia, 'cv_mae': meta.get('cv_mae'), 'cv_rmse': meta.get('cv_rmse'),
                     'cv_wmape': cv_wmape, 'n_wilayah': meta.get('n_wilayah'),
                     'quality': get_model_quality_label(cv_wmape),
                     'tahun_historis': meta.get('tahun_historis'),
                     'tahun_prediksi_range': f"2024–{TAHUN_MAX_PREDIKSI}"}
    return Response({"status": "success", "model_info": info, "timestamp": datetime.now().isoformat()})