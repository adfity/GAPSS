from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import psycopg2
import psycopg2.extras
import requests
import uuid
from datetime import datetime
import os
from dotenv import load_dotenv

base_dir    = os.path.dirname(__file__)
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
BPS_API_KEY   = os.getenv("BPS_WEB_API_KEY")

client   = MongoClient(MONGO_URI)
mongo_db = client[DB_MONGO_NAME]

def get_pg_connection():
    return psycopg2.connect(
        host     = os.getenv("DB_HOST"),
        port     = int(os.getenv("DB_PORT", "5432")),
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD"),
    )

# ─── TAHUN CONFIG ─────────────────────────────────────────────────────────────
# Mapping tahun ke kode BPS (th param) untuk API list/model
TAHUN_BPS_MAP = {
    2020: 120, 2021: 121, 2022: 122, 2023: 123,
    2024: 124, 2025: 125,
}

# ─── THRESHOLD KLASIFIKASI IPSDA ──────────────────────────────────────────────
# TINGGI  > 0.70  : SDA berkontribusi signifikan terhadap ekonomi daerah
# SEDANG  0.40–0.70: SDA berkontribusi sedang; masih ada potensi yg belum dimanfaatkan
# RENDAH  < 0.40  : Ketimpangan antara potensi SDA dan kontribusi ekonomi
THRESHOLD_IPSDA = {'TINGGI': 0.70, 'SEDANG': 0.40}

# ─── 8 KOMODITAS PERKEBUNAN (turvar) ─────────────────────────────────────────
# var=132 (2008-2023): turvar 252-259
KOMODITAS_VAR132 = {
    252: 'Kelapa Sawit',
    253: 'Kelapa',
    254: 'Karet',
    255: 'Kopi',
    256: 'Kakao',
    257: 'Tebu',
    258: 'Teh',
    259: 'Tembakau',
}

# var=2566 (2024): turvar 2321-2327 (7 komoditas, Tembakau tidak ada)
KOMODITAS_VAR2566 = {
    2321: 'Kelapa Sawit',
    2322: 'Kelapa',
    2323: 'Karet',
    2324: 'Kopi',
    2325: 'Kakao',
    2326: 'Teh',
    2327: 'Tebu',
}

# ─── PDRB: turvar untuk Sektor A dan Total ────────────────────────────────────
PDRB_SEKTOR_A  = 2005   # A Pertanian, Kehutanan dan Perikanan
PDRB_TOTAL     = 2022   # Produk Domestik Regional Bruto
PDRB_TAHUNAN   = 35     # turtahun "Tahunan"


def normalize_province_name(name: str) -> str:
    """Normalize province names to standard format"""
    if not isinstance(name, str):
        name = str(name)
    for tag in ['<b>', '</b>', '<B>', '</B>']:
        name = name.replace(tag, '')
    name = name.upper().strip()

    special = {
        'DKI JAKARTA':                   'JAKARTA',
        'DAERAH KHUSUS IBUKOTA JAKARTA': 'JAKARTA',
        'DKI':                           'JAKARTA',
        'YOGYAKARTA':                    'DAERAH ISTIMEWA YOGYAKARTA',
        'DIY':                           'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA':               'DAERAH ISTIMEWA YOGYAKARTA',
        'D I YOGYAKARTA':                'DAERAH ISTIMEWA YOGYAKARTA',
        'DI YOGYAKARTA':                 'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG':               'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG':          'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU':                     'KEPULAUAN RIAU',
        'KEP RIAU':                      'KEPULAUAN RIAU',
    }
    for k, v in special.items():
        if k in name:
            return v

    abbr = {
        'KEP.': 'KEPULAUAN', 'KEP ': 'KEPULAUAN ',
        'NTB': 'NUSA TENGGARA BARAT', 'NTT': 'NUSA TENGGARA TIMUR',
    }
    for a, f in abbr.items():
        if a in name:
            name = name.replace(a, f)

    for prefix in ['PROVINSI ', 'PROV. ', 'PROV ', 'DAERAH KHUSUS IBUKOTA ']:
        if name.startswith(prefix):
            name = name[len(prefix):]

    return name.strip()


def _safe_float(val):
    """Safely convert value to float, return None on failure"""
    if val is None:
        return None
    try:
        return float(str(val).replace('.', '').replace(',', '.'))
    except (ValueError, TypeError):
        return None


# ─── PROVINCE CODE MAPPING untuk data penduduk & PDRB ────────────────────────
# Mapping kode vervar PDRB (2-digit) → nama provinsi standar
PDRB_PROV_MAP = {
    11: 'ACEH',
    12: 'SUMATERA UTARA',
    13: 'SUMATERA BARAT',
    14: 'RIAU',
    15: 'JAMBI',
    16: 'SUMATERA SELATAN',
    17: 'BENGKULU',
    18: 'LAMPUNG',
    19: 'KEPULAUAN BANGKA BELITUNG',
    21: 'KEPULAUAN RIAU',
    31: 'JAKARTA',
    32: 'JAWA BARAT',
    33: 'JAWA TENGAH',
    34: 'DAERAH ISTIMEWA YOGYAKARTA',
    35: 'JAWA TIMUR',
    36: 'BANTEN',
    51: 'BALI',
    52: 'NUSA TENGGARA BARAT',
    53: 'NUSA TENGGARA TIMUR',
    61: 'KALIMANTAN BARAT',
    62: 'KALIMANTAN TENGAH',
    63: 'KALIMANTAN SELATAN',
    64: 'KALIMANTAN TIMUR',
    65: 'KALIMANTAN UTARA',
    71: 'SULAWESI UTARA',
    72: 'SULAWESI TENGAH',
    73: 'SULAWESI SELATAN',
    74: 'SULAWESI TENGGARA',
    75: 'GORONTALO',
    76: 'SULAWESI BARAT',
    81: 'MALUKU',
    82: 'MALUKU UTARA',
    91: 'PAPUA BARAT',
    92: 'PAPUA BARAT DAYA',
    94: 'PAPUA',
    95: 'PAPUA SELATAN',
    96: 'PAPUA TENGAH',
    97: 'PAPUA PEGUNUNGAN',
}

# Mapping kode vervar Perkebunan (4-digit) → nama provinsi standar
PERK_PROV_MAP = {
    1100: 'ACEH',
    1200: 'SUMATERA UTARA',
    1300: 'SUMATERA BARAT',
    1400: 'RIAU',
    1500: 'JAMBI',
    1600: 'SUMATERA SELATAN',
    1700: 'BENGKULU',
    1800: 'LAMPUNG',
    1900: 'KEPULAUAN BANGKA BELITUNG',
    2100: 'KEPULAUAN RIAU',
    3100: 'JAKARTA',
    3200: 'JAWA BARAT',
    3300: 'JAWA TENGAH',
    3400: 'DAERAH ISTIMEWA YOGYAKARTA',
    3500: 'JAWA TIMUR',
    3600: 'BANTEN',
    5100: 'BALI',
    5200: 'NUSA TENGGARA BARAT',
    5300: 'NUSA TENGGARA TIMUR',
    6100: 'KALIMANTAN BARAT',
    6200: 'KALIMANTAN TENGAH',
    6300: 'KALIMANTAN SELATAN',
    6400: 'KALIMANTAN TIMUR',
    6500: 'KALIMANTAN UTARA',
    7100: 'SULAWESI UTARA',
    7200: 'SULAWESI TENGAH',
    7300: 'SULAWESI SELATAN',
    7400: 'SULAWESI TENGGARA',
    7500: 'GORONTALO',
    7600: 'SULAWESI BARAT',
    8100: 'MALUKU',
    8200: 'MALUKU UTARA',
    9100: 'PAPUA BARAT',
    9200: 'PAPUA BARAT DAYA',
    9400: 'PAPUA',
    9500: 'PAPUA SELATAN',
    9600: 'PAPUA TENGAH',
    9700: 'PAPUA PEGUNUNGAN',
    9999: 'INDONESIA',
}

# Mapping kode vervar penduduk (1-2 digit) → nama provinsi standar
PENDUDUK_PROV_MAP = {
    1:  'ACEH',
    2:  'SUMATERA UTARA',
    3:  'SUMATERA BARAT',
    4:  'RIAU',
    5:  'KEPULAUAN RIAU',
    6:  'JAMBI',
    7:  'SUMATERA SELATAN',
    8:  'KEPULAUAN BANGKA BELITUNG',
    9:  'BENGKULU',
    10: 'LAMPUNG',
    11: 'JAKARTA',
    12: 'JAWA BARAT',
    13: 'BANTEN',
    14: 'JAWA TENGAH',
    15: 'DAERAH ISTIMEWA YOGYAKARTA',
    16: 'JAWA TIMUR',
    17: 'KALIMANTAN BARAT',
    18: 'KALIMANTAN TENGAH',
    19: 'KALIMANTAN SELATAN',
    20: 'KALIMANTAN TIMUR',
    21: 'KALIMANTAN UTARA',
    22: 'SULAWESI UTARA',
    23: 'GORONTALO',
    24: 'SULAWESI TENGAH',
    25: 'SULAWESI SELATAN',
    26: 'SULAWESI BARAT',
    27: 'SULAWESI TENGGARA',
    28: 'BALI',
    29: 'NUSA TENGGARA BARAT',
    30: 'NUSA TENGGARA TIMUR',
    31: 'MALUKU',
    32: 'MALUKU UTARA',
    33: 'PAPUA BARAT',
    34: 'PAPUA',
    35: 'INDONESIA',
}


# ─── FETCH HELPERS ────────────────────────────────────────────────────────────

def _fetch_json(url: str, timeout: int = 30):
    """Fetch JSON dari URL BPS, return dict atau None"""
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code == 200:
            return resp.json()
        print(f"  HTTP {resp.status_code}: {url}")
    except Exception as e:
        print(f"  Error fetch: {e} → {url}")
    return None


def fetch_produksi_ikan(tahun: int) -> dict:
    """
    Ambil Produksi Perikanan Tangkap (ton) per provinsi.

    - 2017–2022 : API simdasi id/25, format ton langsung
      kolom target: c9knnv4dte  (Produksi Perikanan Tangkap total)
    - 2023–2024 : API simdasi id/25 interop, format KG → konversi ke ton
      kolom target: cnt2nlnwxu  (Produksi Perikanan Tangkap total kg)

    Returns:
        dict {nama_provinsi: nilai_ton}
    """
    print(f"\n  [IKAN] Fetching tahun={tahun}")

    if tahun <= 2022:
        url = (
            f"https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi"
            f"/id/25/tahun/{tahun}"
            f"/id_tabel/NTdHM1BiQXJXUHAyUUNoMXNabkRwZz09"
            f"/wilayah/0000000/key/{BPS_API_KEY}"
        )
        col_key    = "c9knnv4dte"   # Produksi Perikanan Tangkap (ton)
        satuan_kg  = False
    else:
        url = (
            f"https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi"
            f"/id/25/tahun/{tahun}"
            f"/id_tabel/Si8wS0pVcDhRUTJidGFnSzl5UDIxZz09"
            f"/wilayah/0000000/key/{BPS_API_KEY}"
        )
        col_key    = "cnt2nlnwxu"   # Produksi Perikanan Tangkap (kg) – interop
        satuan_kg  = True

    raw = _fetch_json(url)
    if not raw:
        return {}

    # Data ada di raw["data"][1]["data"]
    try:
        table_data = raw["data"][1]["data"]
    except (KeyError, IndexError, TypeError):
        print("  [IKAN] Format response tidak dikenali")
        return {}

    result = {}
    for row in table_data:
        label = row.get("label_raw") or row.get("label", "")
        if not label or label.upper() == "INDONESIA":
            continue

        variables = row.get("variables", {})
        if not isinstance(variables, dict):
            continue

        col_data = variables.get(col_key, {})
        if not isinstance(col_data, dict):
            continue

        val_raw = col_data.get("value_raw")
        if val_raw is None:
            continue

        val = _safe_float(val_raw)
        if val is None:
            continue

        if satuan_kg:
            val = val / 1000.0   # kg → ton

        prov = normalize_province_name(label)
        result[prov] = round(val, 4)

    print(f"  [IKAN] Parsed {len(result)} provinces")
    return result


def fetch_produksi_perkebunan(tahun: int) -> dict:
    """
    Ambil rata-rata produksi 8 komoditas perkebunan (Ribu Ton) per provinsi.

    - 2008–2023 : var=132, turvar 252–259 (8 komoditas incl Tembakau)
    - 2024      : var=2566, turvar 2321–2327 (7 komoditas, tanpa Tembakau)

    Returns:
        dict {nama_provinsi: rata_rata_ribu_ton}
        (rata-rata dari komoditas yang ada nilainya ≠ 0)
    """
    print(f"\n  [PERK] Fetching tahun={tahun}")
    th = TAHUN_BPS_MAP.get(tahun, 123)

    if tahun <= 2023:
        url = (
            f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind"
            f"/domain/0000/var/132/th/{th}/key/{BPS_API_KEY}"
        )
        komoditas_map   = KOMODITAS_VAR132
        n_komoditas_std = 8
    else:
        url = (
            f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind"
            f"/domain/0000/var/2566/th/{th}/key/{BPS_API_KEY}"
        )
        komoditas_map   = KOMODITAS_VAR2566
        n_komoditas_std = 7

    raw = _fetch_json(url)
    if not raw or not raw.get("datacontent"):
        return {}

    datacontent = raw["datacontent"]

    # ── Decode key format ─────────────────────────────────────────────────────
    # var=132  key: "{prov4}{var3}{turvar3}{turtahun3}{th3}{turtahun_sub1}"
    #   contoh: "11001322521230"
    #   = prov=1100, var=132, turvar=252, th=123, turtahun=0
    #   Pola: key[0:4]=prov, key[4:7]=var(132), key[7:10]=turvar, key[10:13]=th, key[13]=sub
    #
    # var=2566 key: "{prov4}{var4}{turvar4}{th3}{turtahun_sub1}"
    #   contoh: "11002566232112240"  → panjang bervariasi
    #   = prov=1100, var=2566, turvar=2321, th=124, sub=0
    #
    # Cara parsing: gunakan prov_map dari vervar list dan cari prefix

    # Build accumulator: {prov_code_4digit: {turvar: value}}
    prov_turvar = {}

    for dc_key, value in datacontent.items():
        if value is None:
            continue
        val = _safe_float(value)
        if val is None:
            continue

        # Ambil 4 digit pertama sebagai kode provinsi
        prov_code = int(dc_key[:4])
        if prov_code not in PERK_PROV_MAP or prov_code == 9999:
            continue

        # Cari turvar yang cocok dari sisa key
        matched_turvar = None
        for tv in komoditas_map:
            tv_str = str(tv)
            if tv_str in dc_key[4:]:
                matched_turvar = tv
                break

        if matched_turvar is None:
            continue

        if prov_code not in prov_turvar:
            prov_turvar[prov_code] = {}
        # Jika sudah ada (misalnya duplikat key), ambil nilai terakhir
        prov_turvar[prov_code][matched_turvar] = val

    result = {}
    for prov_code, turvar_vals in prov_turvar.items():
        prov_name = PERK_PROV_MAP[prov_code]
        # Hitung rata-rata dari semua komoditas yang terdaftar (bisa 0)
        total      = sum(turvar_vals.get(tv, 0.0) for tv in komoditas_map)
        n          = n_komoditas_std
        rata_rata  = total / n
        result[prov_name] = round(rata_rata, 4)

    print(f"  [PERK] Parsed {len(result)} provinces")
    return result


def fetch_pdrb(tahun: int) -> dict:
    """
    Ambil PDRB Sektor A (Pertanian, Kehutanan, Perikanan) dan PDRB Total
    per provinsi. Gunakan nilai Tahunan (turtahun=35).

    API: var=2268, th=125 (2025 adalah update terakhir, berisi data 2025)
    Untuk tahun lain, bisa disesuaikan mapping th.

    Returns:
        dict {nama_provinsi: {'sektor_a': float, 'total': float, 'rasio': float}}
    """
    print(f"\n  [PDRB] Fetching")
    # PDRB hanya tersedia satu versi (var=2268, th=125)
    # Jika tahun != 2025 maka tetap pakai data ini (data terlengkap)
    th_pdrb = TAHUN_BPS_MAP.get(tahun, 125)

    url = (
        f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind"
        f"/domain/0000/var/2268/th/{th_pdrb}/key/{BPS_API_KEY}"
    )
    raw = _fetch_json(url)
    if not raw or not raw.get("datacontent"):
        return {}

    datacontent = raw["datacontent"]

    # Key format: "{prov2}{var4}{turvar4}{th3}{turtahun2}"
    # contoh: "112268200512531"
    #   prov=11, var=2268, turvar=2005, th=125, turtahun=35
    # turtahun Tahunan = 35

    prov_data = {}

    for dc_key, value in datacontent.items():
        if value is None:
            continue
        val = _safe_float(value)
        if val is None:
            continue

        # Key panjang bervariasi (15-16 char), ambil 2 digit pertama sbg prov
        try:
            prov_code = int(dc_key[:2])
        except ValueError:
            continue

        if prov_code not in PDRB_PROV_MAP:
            continue

        # Cari turvar (sektor A=2005 atau total=2022) dan turtahun tahunan (35)
        key_rest = dc_key[2:]

        # Cek apakah ini data Tahunan (turtahun=35)
        # Format: var(4) + turvar(4) + th(3) + turtahun(2) → 13 karakter sisa
        # turtahun=35 → "35" di akhir 2 digit
        if not key_rest.endswith("35"):
            continue

        # Cek turvar
        if str(PDRB_SEKTOR_A) in key_rest:
            if prov_code not in prov_data:
                prov_data[prov_code] = {}
            prov_data[prov_code]['sektor_a'] = val
        elif str(PDRB_TOTAL) in key_rest:
            if prov_code not in prov_data:
                prov_data[prov_code] = {}
            prov_data[prov_code]['total'] = val

    result = {}
    for prov_code, vals in prov_data.items():
        prov_name = PDRB_PROV_MAP[prov_code]
        sektor_a  = vals.get('sektor_a')
        total     = vals.get('total')
        if sektor_a is not None and total is not None and total > 0:
            rasio = sektor_a / total
            result[prov_name] = {
                'sektor_a': round(sektor_a, 2),
                'total':    round(total, 2),
                'rasio':    round(rasio, 6),
            }

    print(f"  [PDRB] Parsed {len(result)} provinces")
    return result


def fetch_jumlah_penduduk() -> dict:
    """
    Ambil Jumlah Penduduk per provinsi (Ribu Jiwa).
    API statis — var=958, th=118 (data 2018, digunakan sebagai pendekatan
    karena data penduduk lengkap per provinsi).

    Returns:
        dict {nama_provinsi: jumlah_ribu_jiwa}
    """
    print(f"\n  [PDDK] Fetching jumlah penduduk")
    url = (
        f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind"
        f"/domain/7100/var/958/th/118/key/{BPS_API_KEY}"
    )
    raw = _fetch_json(url)
    if not raw or not raw.get("datacontent"):
        return {}

    datacontent = raw["datacontent"]

    # Key format: "{prov1-2}95801180"
    # contoh: "195801180" → prov=1, var=958, turtahun=0, th=118, sub=0
    result = {}
    for dc_key, value in datacontent.items():
        if value is None:
            continue
        val = _safe_float(value)
        if val is None or val <= 0:
            continue

        # Ambil digit sebelum "95801180"
        suffix = "95801180"
        if not dc_key.endswith(suffix):
            continue
        prov_part = dc_key[:len(dc_key) - len(suffix)]
        try:
            prov_code = int(prov_part)
        except ValueError:
            continue

        if prov_code not in PENDUDUK_PROV_MAP:
            continue
        prov_name = PENDUDUK_PROV_MAP[prov_code]
        if prov_name == 'INDONESIA':
            continue

        result[prov_name] = round(val, 2)

    print(f"  [PDDK] Parsed {len(result)} provinces")
    return result


# ─── KALKULASI IPSDA ──────────────────────────────────────────────────────────

class SdaAnalytics:
    """
    Menghitung Indeks Pemerataan Sumber Kekayaan Alam (IPSDA) per provinsi.

    Formula:
        Indeks Produksi Ikan       = Produksi Ikan (Ton) / Jumlah Penduduk (Ribu Jiwa)
        Indeks Produksi Perkebunan = (Σ8 Komoditas / 8) / Jumlah Penduduk (Ribu Jiwa)
        Indeks Kontribusi SDA      = PDRB Sektor A / PDRB Total

        → Ketiga indeks dinormalisasi Min-Max ke [0, 1]
        IPSDA = (Ikan_norm + Perkebunan_norm + KontribusiSDA_norm) / 3

    Klasifikasi:
        TINGGI  > 0.70
        SEDANG  0.40 – 0.70
        RENDAH  < 0.40
    """

    COLORS = {
        "TINGGI": "#10b981",   # hijau
        "SEDANG": "#f59e0b",   # kuning
        "RENDAH": "#ef4444",   # merah
    }

    def __init__(self, tahun: int = 2023):
        self.tahun           = tahun
        self.timestamp_fetch = None

    def fetch_all(self):
        """Fetch semua dataset yang diperlukan"""
        self.timestamp_fetch = datetime.now().isoformat()
        return {
            'ikan':       fetch_produksi_ikan(self.tahun),
            'perkebunan': fetch_produksi_perkebunan(self.tahun),
            'pdrb':       fetch_pdrb(self.tahun),
            'penduduk':   fetch_jumlah_penduduk(),
        }

    @staticmethod
    def minmax_normalize(values: dict) -> dict:
        """Min-Max normalisasi: {prov: nilai} → {prov: 0-1}"""
        if not values:
            return {}
        valid = {k: v for k, v in values.items() if v is not None}
        if not valid:
            return {}
        vmin = min(valid.values())
        vmax = max(valid.values())
        denom = vmax - vmin
        if denom == 0:
            return {k: 0.5 for k in valid}
        return {k: round((v - vmin) / denom, 6) for k, v in valid.items()}

    def compute_raw_indices(self, datasets: dict) -> dict:
        """
        Hitung nilai mentah ketiga indeks sebelum normalisasi.

        Returns:
            dict {prov: {'idx_ikan_raw': float, 'idx_perk_raw': float, 'idx_sda_raw': float}}
        """
        ikan_vals  = datasets.get('ikan', {})
        perk_vals  = datasets.get('perkebunan', {})
        pdrb_vals  = datasets.get('pdrb', {})
        pddk_vals  = datasets.get('penduduk', {})

        all_provs = set(ikan_vals) | set(perk_vals) | set(pdrb_vals)

        raw = {}
        for prov in all_provs:
            pddk = pddk_vals.get(prov)

            # Indeks Produksi Ikan: ton / ribu jiwa
            ikan = ikan_vals.get(prov)
            idx_ikan = (ikan / pddk) if (ikan is not None and pddk and pddk > 0) else None

            # Indeks Produksi Perkebunan: (Σ8/8) ribu ton / ribu jiwa
            perk = perk_vals.get(prov)
            idx_perk = (perk / pddk) if (perk is not None and pddk and pddk > 0) else None

            # Indeks Kontribusi SDA: PDRB A / PDRB Total (sudah rasio)
            pdrb_info = pdrb_vals.get(prov)
            idx_sda   = pdrb_info['rasio'] if pdrb_info else None

            if any(v is not None for v in [idx_ikan, idx_perk, idx_sda]):
                raw[prov] = {
                    'idx_ikan_raw': round(idx_ikan, 6) if idx_ikan is not None else None,
                    'idx_perk_raw': round(idx_perk, 6) if idx_perk is not None else None,
                    'idx_sda_raw':  round(idx_sda,  6) if idx_sda  is not None else None,
                    # simpan komponen sumber
                    'produksi_ikan_ton':     round(ikan, 2) if ikan is not None else None,
                    'produksi_perk_ributon': round(perk, 4) if perk is not None else None,
                    'pdrb_sektor_a':         pdrb_info['sektor_a'] if pdrb_info else None,
                    'pdrb_total':            pdrb_info['total']    if pdrb_info else None,
                    'jumlah_penduduk_ribu':  round(pddk, 2) if pddk is not None else None,
                }

        return raw

    def compute_ipsda(self, raw: dict) -> dict:
        """
        Normalisasi Min-Max dan hitung IPSDA gabungan.

        Returns:
            dict {prov: {...raw..., 'idx_ikan_norm', 'idx_perk_norm',
                          'idx_sda_norm', 'ipsda', 'kategori', 'warna'}}
        """
        # Pisahkan nilai raw per indeks
        ikan_raw  = {p: v['idx_ikan_raw'] for p, v in raw.items() if v.get('idx_ikan_raw') is not None}
        perk_raw  = {p: v['idx_perk_raw'] for p, v in raw.items() if v.get('idx_perk_raw') is not None}
        sda_raw   = {p: v['idx_sda_raw']  for p, v in raw.items() if v.get('idx_sda_raw')  is not None}

        # Normalisasi
        ikan_norm = self.minmax_normalize(ikan_raw)
        perk_norm = self.minmax_normalize(perk_raw)
        sda_norm  = self.minmax_normalize(sda_raw)

        result = {}
        for prov, data in raw.items():
            i_n = ikan_norm.get(prov)
            p_n = perk_norm.get(prov)
            s_n = sda_norm.get(prov)

            components = [c for c in [i_n, p_n, s_n] if c is not None]
            ipsda      = round(sum(components) / len(components), 6) if components else None

            kategori, warna = self._classify(ipsda)

            result[prov] = {
                **data,
                'idx_ikan_norm': round(i_n, 6) if i_n is not None else None,
                'idx_perk_norm': round(p_n, 6) if p_n is not None else None,
                'idx_sda_norm':  round(s_n, 6) if s_n is not None else None,
                'ipsda':         ipsda,
                'kategori':      kategori,
                'warna':         warna,
            }

        return result

    @staticmethod
    def _classify(ipsda):
        """Klasifikasi IPSDA → (kategori, warna)"""
        if ipsda is None:
            return "TIDAK DIKETAHUI", "#6b7280"
        if ipsda > THRESHOLD_IPSDA['TINGGI']:
            return "TINGGI", SdaAnalytics.COLORS["TINGGI"]
        elif ipsda >= THRESHOLD_IPSDA['SEDANG']:
            return "SEDANG", SdaAnalytics.COLORS["SEDANG"]
        else:
            return "RENDAH", SdaAnalytics.COLORS["RENDAH"]

    @staticmethod
    def generate_insights(prov: str, data: dict) -> list:
        """Generate insight analisis per provinsi"""
        ipsda    = data.get('ipsda')
        kategori = data.get('kategori', '')
        insights = [
            f"Provinsi {prov} memiliki IPSDA {ipsda} — kategori {kategori}."
        ]

        ikan = data.get('produksi_ikan_ton')
        pddk = data.get('jumlah_penduduk_ribu')
        perk = data.get('produksi_perk_ributon')
        rasio_sda = data.get('idx_sda_raw')

        if ikan is not None and pddk:
            per_kapita_ikan = round(ikan / pddk, 2)
            mark = "✅" if per_kapita_ikan >= 30 else ("⚠️" if per_kapita_ikan >= 10 else "🚨")
            insights.append(
                f"{mark} Produksi ikan tangkap {ikan:,.0f} ton "
                f"({per_kapita_ikan} ton/ribu jiwa)."
            )

        if perk is not None and pddk:
            per_kapita_perk = round(perk / pddk, 4)
            mark = "✅" if per_kapita_perk >= 0.5 else ("⚠️" if per_kapita_perk >= 0.1 else "🚨")
            insights.append(
                f"{mark} Rata-rata produksi perkebunan {perk:,.2f} ribu ton "
                f"({per_kapita_perk} ribu ton/ribu jiwa)."
            )

        if rasio_sda is not None:
            persen = round(rasio_sda * 100, 2)
            mark   = "✅" if persen >= 20 else ("⚠️" if persen >= 10 else "🚨")
            insights.append(
                f"{mark} Kontribusi SDA (PDRB Sektor A) terhadap PDRB: {persen}%."
            )

        return insights


# ─── KEBIJAKAN ────────────────────────────────────────────────────────────────

def get_bank_kebijakan_sda(kategori_sdm: str, limit: int = 10) -> list:
    """
    Ambil rekomendasi kebijakan dari tabel bank_kebijakan di PostgreSQL.
    Filter: indeks = 'IPSDA', status = kategori_sdm
    """
    results = []
    conn    = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        valid = ['TINGGI', 'SEDANG', 'RENDAH']
        if kategori_sdm not in valid:
            return results

        cur.execute("""
            SELECT id, indeks, status, prioritas, pilar_kebijakan,
                   isu_strategis, kebijakan, rekomendasi_program,
                   indikator_terkait
            FROM bank_kebijakan
            WHERE indeks = 'IPSDA' AND status = %s
            ORDER BY prioritas ASC, pilar_kebijakan ASC
            LIMIT %s
        """, (kategori_sdm, limit))

        docs = [dict(row) for row in cur.fetchall()]
        pilar_map = {}
        for row in docs:
            pilar = row['pilar_kebijakan'] or 'Umum'
            if pilar not in pilar_map:
                pilar_map[pilar] = {
                    "pilar":       pilar,
                    "prioritas":   row['prioritas'],
                    "jumlah_aksi": 0,
                    "aksi":        [],
                }
            pilar_map[pilar]['aksi'].append({
                "no_aksi":           len(pilar_map[pilar]['aksi']) + 1,
                "isu_strategis":     row['isu_strategis'],
                "nama_aksi":         row['kebijakan'],
                "detail_aksi":       row['rekomendasi_program'],
                "indikator_terkait": row['indikator_terkait'],
                "sub_sektor":        row['pilar_kebijakan'],
            })
            pilar_map[pilar]['jumlah_aksi'] += 1

        results = list(pilar_map.values())
        cur.close()
    except Exception as e:
        print(f"  ✗ Error get_bank_kebijakan_sda: {e}")
        import traceback; traceback.print_exc()
    finally:
        if conn:
            conn.close()
    return results


# ─── DATASET CONFIG untuk check endpoint ─────────────────────────────────────
# Mapping indikator → dataset keys yang dibutuhkan
INDIKATOR_DATASET_MAP_SDA = {
    'ALL':   ['IKAN', 'KEBUN', 'PDRB'],
    'IKAN':  ['IKAN'],
    'KEBUN': ['KEBUN'],
    'PDRB':  ['PDRB'],
}

DATASET_LABELS_SDA = {
    'IKAN':  'Produksi Perikanan Tangkap (Ton)',
    'KEBUN': 'Produksi Tanaman Perkebunan 8 Komoditas',
    'PDRB':  'PDRB Sektor A / Total PDRB',
}


def _cek_dataset_tersedia(key: str, tahun: int) -> dict:
    """
    Cek apakah dataset tertentu tersedia untuk tahun yg diminta.
    Lakukan quick fetch dan cek apakah data tidak kosong.
    """
    nama = DATASET_LABELS_SDA.get(key, key)
    try:
        if key == 'IKAN':
            data = fetch_produksi_ikan(tahun)
            tersedia = len(data) > 0
        elif key == 'KEBUN':
            data = fetch_produksi_perkebunan(tahun)
            tersedia = len(data) > 0
        elif key == 'PDRB':
            data = fetch_pdrb(tahun)
            tersedia = len(data) > 0
        else:
            tersedia = False

        return {
            "nama":     nama,
            "tersedia": tersedia,
            "status":   "Tersedia" if tersedia else "Kosong / Tidak Tersedia",
        }
    except Exception as e:
        return {
            "nama":     nama,
            "tersedia": False,
            "status":   f"Gagal ({str(e)[:60]})",
        }


# ─── API VIEWS ────────────────────────────────────────────────────────────────

@api_view(['POST'])
def check_sda_data(request):
    """
    Cek ketersediaan data SDA untuk tahun dan indikator tertentu.

    Request body:
    {
        "tahun":     2023,   # default 2023
        "indikator": "ALL"   # ALL | IKAN | KEBUN | PDRB
    }

    Response:
    {
        "tahun": 2023,
        "indikator": "ALL",
        "dataset_status": { "IKAN": {...}, "KEBUN": {...}, "PDRB": {...} },
        "tersedia": ["IKAN", "KEBUN"],
        "kosong":   ["PDRB"],
        "semua_kosong":    false,
        "ada_yang_kosong": true,
        "bisa_dieksekusi": false
    }
    """
    if not BPS_API_KEY:
        return Response({"error": "BPS Web API Key belum dikonfigurasi"}, status=500)

    tahun     = request.data.get('tahun', 2023)
    indikator = request.data.get('indikator', 'ALL')

    try:
        tahun = int(tahun)
    except (ValueError, TypeError):
        tahun = 2023

    valid_years = list(range(2017, 2025))
    if tahun not in valid_years:
        return Response({"error": f"Tahun {tahun} tidak didukung. Pilih antara 2017–2024."}, status=400)

    if indikator not in INDIKATOR_DATASET_MAP_SDA:
        indikator = 'ALL'

    keys_to_check  = INDIKATOR_DATASET_MAP_SDA[indikator]
    dataset_status = {}

    for key in keys_to_check:
        print(f"  [CEK] {key} tahun={tahun}")
        dataset_status[key] = _cek_dataset_tersedia(key, tahun)

    tersedia_list   = [k for k, v in dataset_status.items() if v["tersedia"]]
    kosong_list     = [k for k, v in dataset_status.items() if not v["tersedia"]]
    semua_kosong    = len(tersedia_list) == 0
    ada_yang_kosong = len(kosong_list) > 0 and not semua_kosong

    return Response({
        "tahun":           tahun,
        "indikator":       indikator,
        "dataset_status":  dataset_status,
        "tersedia":        tersedia_list,
        "kosong":          kosong_list,
        "semua_kosong":    semua_kosong,
        "ada_yang_kosong": ada_yang_kosong,
        "bisa_dieksekusi": not semua_kosong and not ada_yang_kosong,
    })


@api_view(['POST'])
def analyze_sda_bps(request):
    """
    Endpoint utama untuk analisis Indeks SDA (IPSDA) menggunakan BPS Web API.

    Request body:
    {
        "tahun": 2023   # optional, default 2023. Range: 2017–2024
    }

    Formula:
        Indeks Produksi Ikan       = Produksi Ikan (Ton) / Penduduk (Ribu Jiwa)
        Indeks Produksi Perkebunan = (Σ8 Komoditas / 8) Ribu Ton / Penduduk (Ribu Jiwa)
        Indeks Kontribusi SDA      = PDRB Sektor A / PDRB Total
        → Min-Max Normalisasi masing-masing indeks
        IPSDA = (Ikan_norm + Perkebunan_norm + KontribusiSDA_norm) / 3

    Klasifikasi:
        TINGGI  > 0.70
        SEDANG  0.40 – 0.70
        RENDAH  < 0.40
    """
    if not BPS_API_KEY:
        return Response({
            "error":   "BPS Web API Key belum dikonfigurasi",
            "message": "Tambahkan BPS_WEB_API_KEY di file .env",
        }, status=500)

    try:
        tahun     = request.data.get('tahun', 2023)
        indikator = request.data.get('indikator', 'ALL')

        try:
            tahun = int(tahun)
        except (ValueError, TypeError):
            tahun = 2023

        if indikator not in INDIKATOR_DATASET_MAP_SDA:
            indikator = 'ALL'

        valid_years = list(range(2017, 2025))
        if tahun not in valid_years:
            return Response({
                "error": f"Tahun {tahun} tidak didukung. Pilih antara 2017–2024."
            }, status=400)

        analytics = SdaAnalytics(tahun=tahun)

        print(f"\n=== MULAI FETCH SDA BPS | TAHUN={tahun} | INDIKATOR={indikator} ===")
        datasets = analytics.fetch_all()

        print("\n=== HITUNG RAW INDICES ===")
        raw_indices = analytics.compute_raw_indices(datasets)

        print("\n=== NORMALISASI & HITUNG IPSDA ===")
        ipsda_results = analytics.compute_ipsda(raw_indices)

        print("\n=== LOAD BOUNDARY DATA PROVINSI ===")
        cursor            = mongo_db["batas_provinsi"].find({}, {'_id': 0})
        boundary_features = list(cursor)

        province_map = {}
        for feature in boundary_features:
            props = feature.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    official   = str(props[field]).upper().strip()
                    normalized = normalize_province_name(official)
                    province_map[normalized] = feature
                    province_map[official]   = feature

        print(f"\n=== PROCESSING {len(ipsda_results)} PROVINCES ===")

        matched_features  = []
        analysis_summary  = []
        kategori_counts   = {"TINGGI": 0, "SEDANG": 0, "RENDAH": 0}
        kebijakan_cache   = {}

        for prov_name in sorted(ipsda_results.keys()):
            data = ipsda_results[prov_name]
            if data.get('ipsda') is None:
                continue

            kategori = data['kategori']
            warna    = data['warna']
            ipsda    = data['ipsda']

            insights = analytics.generate_insights(prov_name, data)

            # Kebijakan (cache per kategori)
            if kategori not in kebijakan_cache:
                kebijakan_cache[kategori] = get_bank_kebijakan_sda(kategori)
            rekomendasi = kebijakan_cache[kategori]

            # Match boundary
            normalized_prov = normalize_province_name(prov_name)
            matched_feature = province_map.get(normalized_prov) or province_map.get(prov_name)
            if not matched_feature:
                for map_name, feat in province_map.items():
                    if normalized_prov in map_name or map_name in normalized_prov:
                        matched_feature = feat
                        break
            if not matched_feature:
                print(f"  ✗ {prov_name}: no boundary match")
                continue

            kategori_counts[kategori] = kategori_counts.get(kategori, 0) + 1

            # ── Nilai per indikator (untuk FE switching tanpa re-fetch) ──────
            # FE menggunakan: indeks_ikan, indeks_kebun, indeks_pdrb, indeks_utama
            # Nilai utama sesuai indikator yang dipilih
            indeks_ikan  = round(data['idx_ikan_norm'],  4) if data.get('idx_ikan_norm')  is not None else None
            indeks_kebun = round(data['idx_perk_norm'],  4) if data.get('idx_perk_norm')  is not None else None
            indeks_pdrb  = round(data['idx_sda_norm'],   4) if data.get('idx_sda_norm')   is not None else None

            indeks_utama_map = {
                'ALL':   ipsda,
                'IKAN':  indeks_ikan,
                'KEBUN': indeks_kebun,
                'PDRB':  indeks_pdrb,
            }
            indeks_utama = indeks_utama_map.get(indikator, ipsda)

            # Hitung kategori & warna per indikator (untuk FE dynamic coloring)
            def _classify_ind(nilai, ind):
                if nilai is None:
                    return "TIDAK DIKETAHUI", "#6b7280"
                th = { 'ALL': (0.70, 0.40), 'IKAN': (0.60, 0.25), 'KEBUN': (0.60, 0.25), 'PDRB': (0.60, 0.25) }
                t_tinggi, t_sedang = th.get(ind, (0.70, 0.40))
                if nilai >= t_tinggi:
                    return "TINGGI", "#10b981"
                elif nilai >= t_sedang:
                    return "SEDANG", "#f59e0b"
                return "RENDAH", "#ef4444"

            kategori_per_indikator = {
                'ALL':   _classify_ind(ipsda,        'ALL')[0],
                'IKAN':  _classify_ind(indeks_ikan,  'IKAN')[0],
                'KEBUN': _classify_ind(indeks_kebun, 'KEBUN')[0],
                'PDRB':  _classify_ind(indeks_pdrb,  'PDRB')[0],
            }
            warna_per_indikator = {
                'ALL':   _classify_ind(ipsda,        'ALL')[1],
                'IKAN':  _classify_ind(indeks_ikan,  'IKAN')[1],
                'KEBUN': _classify_ind(indeks_kebun, 'KEBUN')[1],
                'PDRB':  _classify_ind(indeks_pdrb,  'PDRB')[1],
            }

            pdrb_rasio = data.get('idx_sda_raw')

            feature_copy = matched_feature.copy()
            props        = feature_copy.get('properties', {})
            props['sda_analysis'] = {
                "nama_provinsi":  prov_name,
                "tahun":          tahun,
                "indikator":      indikator,
                # ── Nilai indeks (nama sesuai ekspektasi FE) ──
                "ipsda":          ipsda,           # gabungan selalu ada
                "indeks_utama":   indeks_utama,    # nilai utama sesuai indikator aktif
                "indeks_ikan":    indeks_ikan,
                "indeks_kebun":   indeks_kebun,
                "indeks_pdrb":    indeks_pdrb,
                # ── Kategori & warna ──
                "kategori":       kategori,
                "warna":          warna,
                "kategori_per_indikator": kategori_per_indikator,
                "warna_per_indikator":    warna_per_indikator,
                # ── Raw untuk debug ──
                "idx_ikan_raw":   data.get('idx_ikan_raw'),
                "idx_perk_raw":   data.get('idx_perk_raw'),
                "idx_sda_raw":    pdrb_rasio,
                # ── Komponen sumber ──
                "data_komponen": {
                    "produksi_ikan_ton":     data.get('produksi_ikan_ton'),
                    "rata_kebun_ton":        round(data['produksi_perk_ributon'] * 1000, 2) if data.get('produksi_perk_ributon') is not None else None,
                    "pdrb_sektor_a_miliar":  data.get('pdrb_sektor_a'),
                    "pdrb_total_miliar":     data.get('pdrb_total'),
                    "pdrb_rasio":            round(pdrb_rasio, 6) if pdrb_rasio is not None else None,
                    "kontribusi_sda_persen": round(pdrb_rasio * 100, 2) if pdrb_rasio is not None else None,
                    "jumlah_penduduk_ribu":  data.get('jumlah_penduduk_ribu'),
                },
                "insights":    insights,
                "rekomendasi": rekomendasi,
            }
            feature_copy['properties'] = props
            matched_features.append(feature_copy)

            analysis_summary.append({
                "provinsi":              prov_name,
                "tahun":                 tahun,
                "indikator":             indikator,
                "ipsda":                 ipsda,
                "indeks_utama":          indeks_utama,
                "indeks_ikan":           indeks_ikan,
                "indeks_kebun":          indeks_kebun,
                "indeks_pdrb":           indeks_pdrb,
                "kategori":              kategori,
                "warna":                 warna,
                "kategori_per_indikator": kategori_per_indikator,
                "warna_per_indikator":    warna_per_indikator,
                "produksi_ikan_ton":     data.get('produksi_ikan_ton'),
                "rata_kebun_ton":        round(data['produksi_perk_ributon'] * 1000, 2) if data.get('produksi_perk_ributon') is not None else None,
                "pdrb_rasio":            round(pdrb_rasio, 6) if pdrb_rasio is not None else None,
                "kontribusi_sda_persen": round(pdrb_rasio * 100, 2) if pdrb_rasio is not None else None,
                "penduduk_ribu_jiwa":    data.get('jumlah_penduduk_ribu'),
            })

            print(f"  ✓ {prov_name}: {kategori} (IPSDA={ipsda})")

        sorted_summary  = sorted(
            [s for s in analysis_summary if s['ipsda'] is not None],
            key=lambda x: x['ipsda'],
        )
        worst_provinces = sorted_summary[:5]
        best_provinces  = sorted_summary[-5:][::-1]

        print(f"\n=== SDA ANALYSIS COMPLETE | {len(matched_features)} provinces ===")
        print(f"    Distribusi: {kategori_counts}")

        return Response({
            "status":              "success",
            "source":              "BPS Web API — IPSDA (Produksi Ikan, Perkebunan, Kontribusi SDA)",
            "tahun":               tahun,
            "indikator":           indikator,
            "total_success":       len(matched_features),
            "kategori_distribusi": kategori_counts,
            "timestamp":           analytics.timestamp_fetch,
            "formula": {
                "Idx_Ikan":       "Produksi Ikan (ton) / Penduduk (Ribu Jiwa)",
                "Idx_Perkebunan": "(Σ8 Komoditas / 8) Ribu Ton / Penduduk (Ribu Jiwa)",
                "Idx_SDA":        "PDRB Sektor A / PDRB Total",
                "Normalisasi":    "Min-Max (0–1) per indeks",
                "IPSDA":          "(Ikan_norm + Perk_norm + SDA_norm) / 3",
            },
            "threshold_klasifikasi": THRESHOLD_IPSDA,
            "matched_features": {
                "type":     "FeatureCollection",
                "features": matched_features,
            },
            "analysis_summary": analysis_summary,
            "worst_provinces":  worst_provinces,
            "best_provinces":   best_provinces,
            "colors":           SdaAnalytics.COLORS,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({
            "error":   str(e),
            "message": "Gagal menganalisis data SDA dari BPS",
        }, status=500)


@api_view(['POST'])
def save_sda_analysis(request):
    """Simpan hasil analisis SDA ke MongoDB"""
    try:
        analysis_name = request.data.get('name', 'Analisis SDA Tanpa Nama')
        analysis_data = request.data.get('analysis_data')
        if not analysis_data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)

        analysis_id = str(uuid.uuid4())
        document    = {
            "analysis_id": analysis_id,
            "name":        analysis_name,
            "type":        "sda",
            "timestamp":   datetime.now().isoformat(),
            **analysis_data,
        }
        mongo_db["sda_analysis"].insert_one(document)
        return Response({
            "status":      "success",
            "message":     f"Analisis SDA '{analysis_name}' berhasil disimpan",
            "analysis_id": analysis_id,
            "saved_at":    document["timestamp"],
        })
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal menyimpan analisis"}, status=500)


@api_view(['GET'])
def get_sda_analysis_list(request):
    """Dapatkan daftar semua analisis SDA"""
    try:
        cursor = mongo_db["sda_analysis"].find(
            {},
            {
                "_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
                "total_success": 1, "kategori_distribusi": 1, "tahun": 1,
            }
        ).sort("timestamp", -1)
        results = list(cursor)
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal mengambil daftar analisis"}, status=500)


@api_view(['GET'])
def get_sda_analysis_detail(request, analysis_id):
    """Dapatkan detail analisis SDA berdasarkan ID"""
    try:
        result = mongo_db["sda_analysis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not result:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal mengambil detail analisis"}, status=500)


@api_view(['DELETE'])
def delete_sda_analysis(request, analysis_id):
    """Hapus analisis SDA berdasarkan ID"""
    try:
        result = mongo_db["sda_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response({"status": "success", "message": "Analisis SDA berhasil dihapus"})
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal menghapus analisis"}, status=500)