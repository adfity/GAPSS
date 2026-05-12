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

# ─────────────────────────────────────────────────────────────
# KONSTANTA
# ─────────────────────────────────────────────────────────────

TAHUN_BPS_MAP = {
    2020: 120, 2021: 121, 2022: 122, 2023: 123,
    2024: 124, 2025: 125, 2026: 126,
}

TURVAR_KR        = 1544
TURVAR_PMTB      = 1547
TURVAR_NET       = 1549
TURVAR_PDRB      = 1550
TURTAHUN_TAHUNAN = 35
VAR_PENDUDUK     = 958

# ─────────────────────────────────────────────────────────────
# DATA PENDUDUK HARDCODED (fallback terakhir)
# Sumber: BPS var=958 yang dikonfirmasi dari JSON user.
# Digunakan HANYA jika semua URL BPS gagal return data.
# Satuan: Ribu Jiwa
# ─────────────────────────────────────────────────────────────

PENDUDUK_HARDCODED = {
    2024: {
        "ACEH": 5554.8, "SUMATERA UTARA": 15588.5, "SUMATERA BARAT": 5836.2,
        "RIAU": 6728.1, "KEPULAUAN RIAU": 2183.3, "JAMBI": 3724.3,
        "SUMATERA SELATAN": 8837.3, "KEPULAUAN BANGKA BELITUNG": 1531.5,
        "BENGKULU": 2112.2, "LAMPUNG": 9419.6, "JAKARTA": 10684.9,
        "JAWA BARAT": 50345.2, "BANTEN": 12431.4, "JAWA TENGAH": 37892.3,
        "DAERAH ISTIMEWA YOGYAKARTA": 3759.5, "JAWA TIMUR": 41814.5,
        "KALIMANTAN BARAT": 5695.5, "KALIMANTAN TENGAH": 2809.7,
        "KALIMANTAN SELATAN": 4273.4, "KALIMANTAN TIMUR": 4045.9,
        "KALIMANTAN UTARA": 739.8, "SULAWESI UTARA": 2701.8,
        "GORONTALO": 1227.8, "SULAWESI TENGAH": 3121.8,
        "SULAWESI SELATAN": 9463.4, "SULAWESI BARAT": 1503.2,
        "SULAWESI TENGGARA": 2793.1, "BALI": 4433.3,
        "NUSA TENGGARA BARAT": 5646.0, "NUSA TENGGARA TIMUR": 5656.0,
        "MALUKU": 1945.6, "MALUKU UTARA": 1355.6,
        "PAPUA BARAT": 1205.8, "PAPUA": 4542.6,
    },
    2023: {
        "ACEH": 5430.6, "SUMATERA UTARA": 15340.0, "SUMATERA BARAT": 5753.1,
        "RIAU": 6659.9, "KEPULAUAN RIAU": 2145.2, "JAMBI": 3670.3,
        "SUMATERA SELATAN": 8700.9, "KEPULAUAN BANGKA BELITUNG": 1512.2,
        "BENGKULU": 2083.4, "LAMPUNG": 9331.4, "JAKARTA": 10600.2,
        "JAWA BARAT": 49715.5, "BANTEN": 12255.1, "JAWA TENGAH": 37456.4,
        "DAERAH ISTIMEWA YOGYAKARTA": 3714.4, "JAWA TIMUR": 41416.3,
        "KALIMANTAN BARAT": 5630.5, "KALIMANTAN TENGAH": 2774.2,
        "KALIMANTAN SELATAN": 4231.4, "KALIMANTAN TIMUR": 3987.2,
        "KALIMANTAN UTARA": 729.5, "SULAWESI UTARA": 2673.0,
        "GORONTALO": 1207.3, "SULAWESI TENGAH": 3063.1,
        "SULAWESI SELATAN": 9399.7, "SULAWESI BARAT": 1482.3,
        "SULAWESI TENGGARA": 2759.1, "BALI": 4385.2,
        "NUSA TENGGARA BARAT": 5607.3, "NUSA TENGGARA TIMUR": 5601.5,
        "MALUKU": 1920.7, "MALUKU UTARA": 1340.5,
        "PAPUA BARAT": 1190.6, "PAPUA": 4450.8,
    },
    2022: {
        "ACEH": 5274.9, "SUMATERA UTARA": 15114.5, "SUMATERA BARAT": 5690.2,
        "RIAU": 6589.9, "KEPULAUAN RIAU": 2118.8, "JAMBI": 3617.1,
        "SUMATERA SELATAN": 8551.8, "KEPULAUAN BANGKA BELITUNG": 1497.1,
        "BENGKULU": 2057.8, "LAMPUNG": 9258.2, "JAKARTA": 10679.1,
        "JAWA BARAT": 48782.7, "BANTEN": 12166.0, "JAWA TENGAH": 37032.4,
        "DAERAH ISTIMEWA YOGYAKARTA": 3723.9, "JAWA TIMUR": 40909.4,
        "KALIMANTAN BARAT": 5557.1, "KALIMANTAN TENGAH": 2741.6,
        "KALIMANTAN SELATAN": 4216.8, "KALIMANTAN TIMUR": 3925.2,
        "KALIMANTAN UTARA": 714.4, "SULAWESI UTARA": 2648.3,
        "GORONTALO": 1194.3, "SULAWESI TENGAH": 3020.3,
        "SULAWESI SELATAN": 9360.6, "SULAWESI BARAT": 1437.0,
        "SULAWESI TENGGARA": 2725.2, "BALI": 4362.7,
        "NUSA TENGGARA BARAT": 5512.3, "NUSA TENGGARA TIMUR": 5537.4,
        "MALUKU": 1857.0, "MALUKU UTARA": 1319.3,
        "PAPUA BARAT": 1148.2, "PAPUA": 4380.8,
    },
    2021: {
        "ACEH": 5163.2, "SUMATERA UTARA": 14992.0, "SUMATERA BARAT": 5623.4,
        "RIAU": 6493.2, "KEPULAUAN RIAU": 2064.6, "JAMBI": 3548.2,
        "SUMATERA SELATAN": 8470.2, "KEPULAUAN BANGKA BELITUNG": 1455.7,
        "BENGKULU": 2025.3, "LAMPUNG": 9177.9, "JAKARTA": 10562.1,
        "JAWA BARAT": 48274.2, "BANTEN": 11924.7, "JAWA TENGAH": 36516.0,
        "DAERAH ISTIMEWA YOGYAKARTA": 3668.7, "JAWA TIMUR": 40666.0,
        "KALIMANTAN BARAT": 5459.6, "KALIMANTAN TENGAH": 2669.0,
        "KALIMANTAN SELATAN": 4119.8, "KALIMANTAN TIMUR": 3865.2,
        "KALIMANTAN UTARA": 700.0, "SULAWESI UTARA": 2600.5,
        "GORONTALO": 1175.8, "SULAWESI TENGAH": 2985.6,
        "SULAWESI SELATAN": 9073.5, "SULAWESI BARAT": 1419.2,
        "SULAWESI TENGGARA": 2671.5, "BALI": 4361.8,
        "NUSA TENGGARA BARAT": 5448.4, "NUSA TENGGARA TIMUR": 5464.8,
        "MALUKU": 1822.5, "MALUKU UTARA": 1282.0,
        "PAPUA BARAT": 1134.1, "PAPUA": 4294.0,
    },
    2020: {
        "ACEH": 5274.9, "SUMATERA UTARA": 14799.4, "SUMATERA BARAT": 5534.5,
        "RIAU": 6394.1, "KEPULAUAN RIAU": 2064.6, "JAMBI": 3548.2,
        "SUMATERA SELATAN": 8467.4, "KEPULAUAN BANGKA BELITUNG": 1455.7,
        "BENGKULU": 2011.8, "LAMPUNG": 9081.9, "JAKARTA": 10562.1,
        "JAWA BARAT": 48038.2, "BANTEN": 11904.8, "JAWA TENGAH": 36516.0,
        "DAERAH ISTIMEWA YOGYAKARTA": 3668.7, "JAWA TIMUR": 40665.7,
        "KALIMANTAN BARAT": 5414.4, "KALIMANTAN TENGAH": 2669.0,
        "KALIMANTAN SELATAN": 4072.6, "KALIMANTAN TIMUR": 3765.0,
        "KALIMANTAN UTARA": 700.0, "SULAWESI UTARA": 2621.6,
        "GORONTALO": 1171.7, "SULAWESI TENGAH": 2985.7,
        "SULAWESI SELATAN": 9073.5, "SULAWESI BARAT": 1419.2,
        "SULAWESI TENGGARA": 2624.9, "BALI": 4317.4,
        "NUSA TENGGARA BARAT": 5310.4, "NUSA TENGGARA TIMUR": 5325.6,
        "MALUKU": 1848.9, "MALUKU UTARA": 1282.0,
        "PAPUA BARAT": 1134.1, "PAPUA": 4294.0,
    },
}


def get_penduduk_hardcoded(tahun: int) -> dict:
    if tahun in PENDUDUK_HARDCODED:
        return dict(PENDUDUK_HARDCODED[tahun])
    available = sorted(PENDUDUK_HARDCODED.keys())
    closest   = min(available, key=lambda t: abs(t - tahun))
    print(f"  ⚠ Hardcoded {tahun} tidak ada, pakai {closest}")
    return dict(PENDUDUK_HARDCODED[closest])


# ─────────────────────────────────────────────────────────────
# KONFIGURASI URL API BPS
# ─────────────────────────────────────────────────────────────

def get_ekon_config(tahun: int) -> dict:
    th = TAHUN_BPS_MAP.get(tahun, 124)
    return {
        "PDRB_PENGELUARAN": {
            "url_template": (
                f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                f"domain/0000/var/533/th/{th}/key/{{key}}/"
            ),
            "nama": "PDRB Pengeluaran (KR, PMTB, Net Ekspor, PDRB)",
            "satuan": "Milyar Rupiah",
            "penjelasan": "Dataset PDRB menurut pengeluaran: KR, PMTB, Net Ekspor, dan PDRB total",
        },
        "PENDUDUK": {
            # URL utama + fallback — dicoba berurutan sampai berhasil
            "url_template": (
                f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                f"domain/0000/var/{VAR_PENDUDUK}/th/{th}/key/{{key}}/"
            ),
            "url_fallbacks": [
                # Fallback 1: tanpa th (ambil semua tahun, filter manual)
                (
                    f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                    f"domain/0000/var/{VAR_PENDUDUK}/key/{{key}}/"
                ),
                # Fallback 2: domain Aceh — var=958 adalah data nasional, bisa dari domain mana saja
                (
                    f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                    f"domain/1100/var/{VAR_PENDUDUK}/th/{th}/key/{{key}}/"
                ),
                # Fallback 3: domain DKI Jakarta
                (
                    f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                    f"domain/3100/var/{VAR_PENDUDUK}/th/{th}/key/{{key}}/"
                ),
                # Fallback 4: domain Sulawesi Utara — terbukti bekerja dari JSON user
                (
                    f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                    f"domain/7100/var/{VAR_PENDUDUK}/th/{th}/key/{{key}}/"
                ),
            ],
            "nama": "Jumlah Penduduk",
            "satuan": "Ribu Jiwa",
            "penjelasan": "Jumlah penduduk per provinsi (Ribu Jiwa) sebagai pembagi untuk nilai per kapita",
        },
    }


# ─────────────────────────────────────────────────────────────
# HELPER: NORMALISASI NAMA PROVINSI
# ─────────────────────────────────────────────────────────────

def normalize_province_name(name: str) -> str:
    if not isinstance(name, str):
        name = str(name)
    for tag in ['<b>', '</b>', '<B>', '</B>']:
        name = name.replace(tag, '')
    name = name.upper().strip()

    special = {
        'DKI JAKARTA':                   'JAKARTA',
        'DAERAH KHUSUS IBUKOTA JAKARTA': 'JAKARTA',
        'D.K.I. JAKARTA':                'JAKARTA',
        'DKI':                           'JAKARTA',
        'YOGYAKARTA':                    'DAERAH ISTIMEWA YOGYAKARTA',
        'DIY':                           'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA':               'DAERAH ISTIMEWA YOGYAKARTA',
        'D I YOGYAKARTA':                'DAERAH ISTIMEWA YOGYAKARTA',
        'DI YOGYAKARTA':                 'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG':               'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG':          'KEPULAUAN BANGKA BELITUNG',
        'KEPULAUAN BANGKA-BELITUNG':     'KEPULAUAN BANGKA BELITUNG',
        'KEP. RIAU':                     'KEPULAUAN RIAU',
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


# ─────────────────────────────────────────────────────────────
# HELPER: FUZZY MATCH
# ─────────────────────────────────────────────────────────────

def fuzzy_match_province(target: str, candidates: dict) -> str | None:
    tn = normalize_province_name(target)
    if tn in candidates:
        return tn
    for c in candidates:
        if tn in c or c in tn:
            return c
    t_tok = set(tn.split())
    best_n, best_k = 0, None
    for c in candidates:
        ov = len(t_tok & set(c.split()))
        if ov > best_n:
            best_n, best_k = ov, c
    if best_k and best_n >= 1:
        tok = list(t_tok)
        if best_n >= 2 or (best_n == 1 and len(tok[0]) >= 5):
            return best_k
    return None


# ─────────────────────────────────────────────────────────────
# HELPER: PARSE RAW PENDUDUK
# ─────────────────────────────────────────────────────────────

def _parse_raw_penduduk(raw_data, th_str: str) -> dict:
    """
    Parse datacontent BPS var=958.
    Key format: {vervar} + "958" + "0" + th_str + "0"
    Contoh th_str="124": vervar=1 → "195801240", vervar=10 → "1095801240"
    """
    result = {}
    if not raw_data:
        return result

    datacontent = raw_data.get("datacontent", {})
    vervar_list = raw_data.get("vervar", [])
    if not datacontent or not vervar_list:
        return result

    prov_val_map = {}
    for item in vervar_list:
        val   = str(item.get("val", "")).strip()
        label = item.get("label", "").strip()
        if val and label and val != "35":
            prov_val_map[val] = label

    if not prov_val_map:
        return result

    # Suffix yang benar untuk tahun ini
    expected_suffix = f"9580{th_str}0"

    for dc_key, value in datacontent.items():
        if value is None:
            continue
        try:
            val_float = float(value)
        except (ValueError, TypeError):
            continue
        if val_float <= 0:
            continue
        if expected_suffix not in dc_key:
            continue

        idx = dc_key.find("958")
        if idx < 0:
            continue
        vervar_code = dc_key[:idx]
        if vervar_code not in prov_val_map:
            continue

        prov_name = normalize_province_name(prov_val_map[vervar_code])
        result[prov_name] = round(val_float, 1)

    return result


# ─────────────────────────────────────────────────────────────
# HELPER: CEK DATA KOSONG
# ─────────────────────────────────────────────────────────────

def _is_data_empty(data):
    if data is None:
        return True
    dc = data.get("datacontent", {})
    if not dc:
        return True
    return len([v for v in dc.values() if v is not None and v != 0]) == 0


# ─────────────────────────────────────────────────────────────
# HELPER: BANK KEBIJAKAN
# ─────────────────────────────────────────────────────────────

def get_bank_kebijakan_ekonomi(kategori_list: list, limit_per_kategori: int = 10) -> list:
    results, conn = [], None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        valid = ['TINGGI', 'SEDANG', 'RENDAH']
        for status in [k for k in kategori_list if k in valid]:
            cur.execute("""
                SELECT id, indeks, status, prioritas, pilar_kebijakan,
                       isu_strategis, kebijakan, rekomendasi_program, indikator_terkait
                FROM bank_kebijakan
                WHERE indeks = 'IED' AND status = %s
                ORDER BY prioritas ASC, pilar_kebijakan ASC LIMIT %s
            """, (status, limit_per_kategori))
            docs = [dict(row) for row in cur.fetchall()]
            if docs:
                pilar_map = {}
                for row in docs:
                    pilar = row['pilar_kebijakan'] or 'Umum'
                    if pilar not in pilar_map:
                        pilar_map[pilar] = {"pilar": pilar, "prioritas": row['prioritas'], "jumlah_aksi": 0, "aksi": []}
                    pilar_map[pilar]['aksi'].append({
                        "no_aksi": len(pilar_map[pilar]['aksi']) + 1,
                        "isu_strategis": row['isu_strategis'],
                        "nama_aksi": row['kebijakan'],
                        "detail_aksi": row['rekomendasi_program'],
                        "indikator_terkait": row['indikator_terkait'],
                        "sub_sektor": row['pilar_kebijakan'],
                    })
                    pilar_map[pilar]['jumlah_aksi'] += 1
                results.extend(list(pilar_map.values()))
        cur.close()
    except Exception as e:
        print(f"  ✗ Bank kebijakan error: {e}")
    finally:
        if conn:
            conn.close()
    return results


def build_kategori_list_ekon(kategori: str) -> list:
    return {'TINGGI': ['TINGGI'], 'SEDANG': ['SEDANG'], 'RENDAH': ['RENDAH']}.get(kategori, ['SEDANG'])


# ─────────────────────────────────────────────────────────────
# KELAS ANALITIK
# ─────────────────────────────────────────────────────────────

class EkonAnalytics:
    COLORS = {"TINGGI": "#10b981", "SEDANG": "#f59e0b", "RENDAH": "#ef4444"}

    def __init__(self, tahun: int = 2024):
        self.tahun           = tahun
        self.ekon_config     = get_ekon_config(tahun)
        self.timestamp_fetch = None
        self.penduduk_source = "BPS API"

    # ── FETCH ────────────────────────────────────────────────

    def fetch_all_data(self) -> dict:
        all_data = {}
        self.timestamp_fetch = datetime.now().isoformat()

        # Fetch PDRB
        cfg = self.ekon_config["PDRB_PENGELUARAN"]
        url = cfg["url_template"].format(key=BPS_API_KEY)
        print(f"Fetching PDRB_PENGELUARAN: {url}")
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 200:
                raw = resp.json()
                if raw and raw.get("datacontent"):
                    all_data["PDRB_PENGELUARAN"] = raw
                    print(f"  ✓ PDRB: {len(raw['datacontent'])} keys")
                else:
                    all_data["PDRB_PENGELUARAN"] = None
                    print("  ✗ PDRB: Kosong")
            else:
                all_data["PDRB_PENGELUARAN"] = None
                print(f"  ✗ PDRB: HTTP {resp.status_code}")
        except Exception as e:
            all_data["PDRB_PENGELUARAN"] = None
            print(f"  ✗ PDRB: {e}")

        # Fetch PENDUDUK dengan multi-URL fallback
        all_data["PENDUDUK"] = self._fetch_penduduk()
        return all_data

    def _fetch_penduduk(self):
        """
        Coba semua URL penduduk secara berurutan.
        Jika semua gagal, return None → parse_penduduk akan pakai hardcoded.
        """
        th_str  = str(TAHUN_BPS_MAP.get(self.tahun, 124))
        cfg     = self.ekon_config["PENDUDUK"]
        all_url = [cfg["url_template"]] + cfg.get("url_fallbacks", [])
        labels  = ["domain/0000 (utama)", "domain/0000 tanpa th", "domain/1100 (Aceh)", "domain/3100 (DKI)", "domain/7100 (Sulut)"]

        for i, url_tpl in enumerate(all_url):
            url   = url_tpl.format(key=BPS_API_KEY)
            label = labels[i] if i < len(labels) else f"fallback-{i}"
            print(f"  Fetching PENDUDUK [{label}]: {url}")
            try:
                resp = requests.get(url, timeout=25)
                if resp.status_code != 200:
                    print(f"    ✗ HTTP {resp.status_code}")
                    continue
                raw = resp.json()
                if not raw or not raw.get("datacontent"):
                    print(f"    ✗ Datacontent kosong")
                    continue

                parsed = _parse_raw_penduduk(raw, th_str)
                if len(parsed) >= 30:
                    print(f"    ✅ Berhasil: {len(parsed)} provinsi [{label}]")
                    self.penduduk_source = f"BPS API [{label}]"
                    return raw
                else:
                    print(f"    ⚠ Hanya {len(parsed)} provinsi — coba URL berikutnya")
            except Exception as e:
                print(f"    ✗ Error: {e}")

        # Semua gagal
        print(f"  ⚠ Semua URL penduduk gagal → akan pakai hardcoded")
        self.penduduk_source = f"Hardcoded BPS ({self.tahun})"
        return None

    # ── PARSE PDRB ────────────────────────────────────────────

    def parse_pdrb_pengeluaran(self, raw_data) -> dict:
        result = {}
        if not raw_data:
            return result
        try:
            datacontent = raw_data.get("datacontent", {})
            vervar_list = raw_data.get("vervar", [])

            prov_code_map = {}
            for item in vervar_list:
                code  = str(item.get("val", ""))
                label = item.get("label", "")
                if code and label and code != "9999" and len(code) == 4 and code.endswith("00"):
                    clean = label.replace('<b>', '').replace('</b>', '').replace('<B>', '').replace('</B>', '').strip()
                    prov_code_map[code] = clean

            print(f"  Found {len(prov_code_map)} provinces in PDRB vervar")

            th  = str(TAHUN_BPS_MAP.get(self.tahun, 124))
            tth = str(TURTAHUN_TAHUNAN)
            turvar_map = {str(TURVAR_KR): "KR", str(TURVAR_PMTB): "PMTB", str(TURVAR_NET): "NET", str(TURVAR_PDRB): "PDRB"}

            for dc_key, value in datacontent.items():
                if value is None or len(dc_key) != 16:
                    continue
                prov_code = dc_key[0:4]
                var_code  = dc_key[4:7]
                turv_code = dc_key[7:11]
                thn_code  = dc_key[11:14]
                tthn_code = dc_key[14:16]

                if prov_code not in prov_code_map: continue
                if var_code != "533":               continue
                if thn_code != th:                  continue
                if tthn_code != tth:                continue

                komponen = turvar_map.get(turv_code)
                if not komponen:
                    continue
                try:
                    val_float = float(value)
                except (ValueError, TypeError):
                    continue

                prov_name = normalize_province_name(prov_code_map[prov_code])
                if prov_name not in result:
                    result[prov_name] = {}
                result[prov_name][komponen] = round(val_float, 2)

            print(f"  ✅ PDRB parsed: {len(result)} provinces")
        except Exception as e:
            print(f"  ❌ Parse PDRB error: {e}")
            import traceback; traceback.print_exc()
        return result

    # ── PARSE PENDUDUK ────────────────────────────────────────

    def parse_penduduk(self, raw_data) -> dict:
        """
        Jika raw_data=None → pakai hardcoded.
        Jika raw_data ada tapi parse < 30 → merge hardcoded + API.
        """
        if raw_data is None:
            print(f"  ℹ Menggunakan data penduduk hardcoded (tahun {self.tahun})")
            data = get_penduduk_hardcoded(self.tahun)
            print(f"  ✅ PENDUDUK hardcoded: {len(data)} provinsi")
            return data

        th_str = str(TAHUN_BPS_MAP.get(self.tahun, 124))
        result = _parse_raw_penduduk(raw_data, th_str)
        print(f"  ✅ PENDUDUK API: {len(result)} provinsi")

        if len(result) < 30:
            print(f"  ⚠ API kurang ({len(result)}), merge dengan hardcoded")
            hardcoded = get_penduduk_hardcoded(self.tahun)
            merged    = {**hardcoded, **result}   # API overwrite jika ada
            self.penduduk_source = "Merged (hardcoded + BPS API)"
            print(f"  ✅ PENDUDUK merged: {len(merged)} provinsi")
            return merged

        return result

    # ── HITUNG ────────────────────────────────────────────────

    def calculate_per_kapita(self, pdrb_data: dict, penduduk_data: dict) -> dict:
        per_kapita, no_match = {}, []
        for prov, komponen in pdrb_data.items():
            pop = penduduk_data.get(prov)
            if pop is None:
                mk = fuzzy_match_province(prov, penduduk_data)
                if mk:
                    pop = penduduk_data[mk]
                    print(f"  🔄 Fuzzy: '{prov}' → '{mk}' ({pop})")
                else:
                    no_match.append(prov)
                    continue
            if pop <= 0:
                continue
            per_kapita[prov] = {
                k: round(v / pop, 4) if komponen.get(k) is not None else None
                for k, v in [(kk, komponen.get(kk)) for kk in ["KR", "PMTB", "NET", "PDRB"]]
            }
        if no_match:
            print(f"  ⚠ No penduduk: {no_match}")
        print(f"  ✅ Per kapita: {len(per_kapita)} provinsi")
        return per_kapita

    @staticmethod
    def minmax_normalize(values: dict) -> dict:
        valid = {k: v for k, v in values.items() if v is not None}
        if not valid:
            return {}
        mn, mx = min(valid.values()), max(valid.values())
        d = mx - mn
        if d == 0:
            return {k: 0.5 for k in valid}
        return {k: round((v - mn) / d, 4) for k, v in valid.items()}

    def calculate_indices(self, per_kapita_all: dict) -> dict:
        kr_r   = {p: d.get("KR")   for p, d in per_kapita_all.items()}
        pmtb_r = {p: d.get("PMTB") for p, d in per_kapita_all.items()}
        net_r  = {p: d.get("NET")  for p, d in per_kapita_all.items()}
        pdrb_r = {p: d.get("PDRB") for p, d in per_kapita_all.items()}
        kr_n   = self.minmax_normalize(kr_r)
        pmtb_n = self.minmax_normalize(pmtb_r)
        net_n  = self.minmax_normalize(net_r)
        pdrb_n = self.minmax_normalize(pdrb_r)
        result = {}
        for prov in per_kapita_all:
            comps  = [v for v in [kr_n.get(prov), pmtb_n.get(prov), net_n.get(prov), pdrb_n.get(prov)] if v is not None]
            result[prov] = {
                "kr_raw": kr_r.get(prov), "pmtb_raw": pmtb_r.get(prov),
                "net_raw": net_r.get(prov), "pdrb_raw": pdrb_r.get(prov),
                "kr_norm": kr_n.get(prov), "pmtb_norm": pmtb_n.get(prov),
                "net_norm": net_n.get(prov), "pdrb_norm": pdrb_n.get(prov),
                "indeks_ekonomi": round(sum(comps) / len(comps), 4) if comps else None,
            }
        return result

    def categorize_province(self, indeks):
        if indeks is None:
            return "TIDAK DIKETAHUI", "#6b7280"
        if indeks > 0.70:
            return "TINGGI", self.COLORS["TINGGI"]
        elif indeks >= 0.40:
            return "SEDANG", self.COLORS["SEDANG"]
        else:
            return "RENDAH", self.COLORS["RENDAH"]

    def generate_insights(self, provinsi, scores, kategori, indeks) -> list:
        ins = [f"Provinsi {provinsi} IED={indeks} — {kategori}."]
        for rk, lbl, nk in [("kr_raw","KR","kr_norm"),("pmtb_raw","PMTB","pmtb_norm"),
                             ("net_raw","NET","net_norm"),("pdrb_raw","PDRB","pdrb_norm")]:
            v, n = scores.get(rk), scores.get(nk)
            if v is not None:
                mark = "✅" if n and n >= 0.60 else ("⚠️" if n and n >= 0.30 else "🚨")
                ins.append(f"{mark} {lbl}/kap: {v:.4f} Mlrd/RbJiwa (norm={n}).")
        return ins


# ─────────────────────────────────────────────────────────────
# ENDPOINT: CEK DATA
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
def check_ekon_year_data(request):
    """
    Cek ketersediaan data.
    PENDUDUK selalu Tersedia karena ada data hardcoded sebagai fallback.
    """
    if not BPS_API_KEY:
        return Response({"error": "BPS API Key belum dikonfigurasi"}, status=500)

    tahun = request.data.get('tahun', 2024)
    try:
        tahun = int(tahun)
    except (ValueError, TypeError):
        tahun = 2024

    if tahun not in TAHUN_BPS_MAP:
        return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)

    config         = get_ekon_config(tahun)
    dataset_status = {}
    th_str         = str(TAHUN_BPS_MAP.get(tahun, 124))

    for key, cfg in config.items():
        if key == "PENDUDUK":
            # Cek apakah BPS return data → jika tidak, hardcoded tetap tersedia
            all_urls = [cfg["url_template"]] + cfg.get("url_fallbacks", [])
            src      = f"Hardcoded BPS {tahun}"
            bps_ok   = False

            for i, url_tpl in enumerate(all_urls):
                try:
                    resp = requests.get(url_tpl.format(key=BPS_API_KEY), timeout=12)
                    if resp.status_code == 200:
                        raw    = resp.json()
                        parsed = _parse_raw_penduduk(raw, th_str) if raw else {}
                        if len(parsed) >= 30:
                            src    = f"BPS API (URL-{i})"
                            bps_ok = True
                            break
                except Exception:
                    pass

            dataset_status[key] = {
                "nama":     cfg["nama"],
                "tersedia": True,   # selalu True karena hardcoded
                "status":   f"Tersedia ({src})",
                "sumber":   src,
                "bps_api":  bps_ok,
            }
        else:
            url = cfg["url_template"].format(key=BPS_API_KEY)
            try:
                resp = requests.get(url, timeout=20)
                if resp.status_code == 200:
                    kosong = _is_data_empty(resp.json())
                    dataset_status[key] = {
                        "nama": cfg["nama"],
                        "tersedia": not kosong,
                        "status": "Tersedia" if not kosong else "Kosong / Tidak Tersedia",
                    }
                else:
                    dataset_status[key] = {"nama": cfg["nama"], "tersedia": False, "status": f"HTTP {resp.status_code}"}
            except Exception as e:
                dataset_status[key] = {"nama": cfg["nama"], "tersedia": False, "status": f"Error: {str(e)[:50]}"}

    tersedia_list   = [k for k, v in dataset_status.items() if v["tersedia"]]
    kosong_list     = [k for k, v in dataset_status.items() if not v["tersedia"]]
    semua_kosong    = len(tersedia_list) == 0
    ada_yang_kosong = len(kosong_list) > 0 and not semua_kosong

    return Response({
        "tahun": tahun, "dataset_status": dataset_status,
        "tersedia": tersedia_list, "kosong": kosong_list,
        "semua_kosong": semua_kosong, "ada_yang_kosong": ada_yang_kosong,
        "bisa_dieksekusi": not semua_kosong and not ada_yang_kosong,
    })


# ─────────────────────────────────────────────────────────────
# ENDPOINT: ANALISIS UTAMA
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
def analyze_ekon_bps(request):
    if not BPS_API_KEY:
        return Response({"error": "BPS API Key belum dikonfigurasi"}, status=500)
    try:
        tahun = int(request.data.get('tahun', 2024))
        if tahun not in TAHUN_BPS_MAP:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)

        analytics = EkonAnalytics(tahun=tahun)

        print(f"\n=== FETCH EKONOMI | TAHUN={tahun} ===")
        raw_data = analytics.fetch_all_data()

        print("\n=== PARSE ===")
        pdrb_data     = analytics.parse_pdrb_pengeluaran(raw_data.get("PDRB_PENGELUARAN"))
        penduduk_data = analytics.parse_penduduk(raw_data.get("PENDUDUK"))

        if not pdrb_data:
            return Response({"error": "Data PDRB tidak tersedia"}, status=400)
        if not penduduk_data:
            return Response({"error": "Data Penduduk tidak tersedia (seharusnya tidak terjadi)"}, status=400)

        print("\n=== HITUNG ===")
        per_kapita = analytics.calculate_per_kapita(pdrb_data, penduduk_data)
        if not per_kapita:
            return Response({"error": "Tidak ada data per kapita yang berhasil"}, status=400)

        indices = analytics.calculate_indices(per_kapita)

        cursor            = mongo_db["batas_provinsi"].find({}, {'_id': 0})
        boundary_features = list(cursor)
        province_map      = {}
        for feature in boundary_features:
            props = feature.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    off  = str(props[field]).upper().strip()
                    norm = normalize_province_name(off)
                    province_map[norm] = feature
                    province_map[off]  = feature

        matched_features = []
        analysis_summary = []
        ekon_xlsx        = {}
        kat_counts       = {"TINGGI": 0, "SEDANG": 0, "RENDAH": 0}
        keb_cache        = {}

        for prov in sorted(indices.keys()):
            sc     = indices[prov]
            ie     = sc["indeks_ekonomi"]
            kat, w = analytics.categorize_province(ie)
            ins    = analytics.generate_insights(prov, sc, kat, ie)

            if kat not in keb_cache:
                keb_cache[kat] = get_bank_kebijakan_ekonomi(build_kategori_list_ekon(kat), 10)
            rekom = keb_cache[kat]

            norm_prov = normalize_province_name(prov)
            feat      = province_map.get(norm_prov) or province_map.get(prov)
            if not feat:
                for mn, mf in province_map.items():
                    if norm_prov in mn or mn in norm_prov:
                        feat = mf; break
            if not feat:
                print(f"  ✗ {prov}: no boundary")
                continue

            kat_counts[kat] = kat_counts.get(kat, 0) + 1
            fc   = feat.copy()
            pop  = penduduk_data.get(prov) or penduduk_data.get(norm_prov)
            props = fc.get('properties', {})
            props['ekon_analysis'] = {
                "nama_provinsi": prov, "kategori": kat, "warna": w,
                "indeks_ekonomi": ie,
                "kr_norm": sc["kr_norm"], "pmtb_norm": sc["pmtb_norm"],
                "net_norm": sc["net_norm"], "pdrb_norm": sc["pdrb_norm"],
                "insights": ins, "rekomendasi": rekom,
                "data_komponen": {
                    "kr_per_kapita": sc["kr_raw"], "pmtb_per_kapita": sc["pmtb_raw"],
                    "net_per_kapita": sc["net_raw"], "pdrb_per_kapita": sc["pdrb_raw"],
                    "penduduk": pop,
                },
            }
            fc['properties'] = props
            matched_features.append(fc)

            row = {
                "provinsi": prov, "kategori": kat, "warna": w,
                "indeks_ekonomi": ie,
                "kr_norm": sc["kr_norm"], "pmtb_norm": sc["pmtb_norm"],
                "net_norm": sc["net_norm"], "pdrb_norm": sc["pdrb_norm"],
                "kr_per_kapita": sc["kr_raw"], "pmtb_per_kapita": sc["pmtb_raw"],
                "net_per_kapita": sc["net_raw"], "pdrb_per_kapita": sc["pdrb_raw"],
                "penduduk": pop,
            }
            analysis_summary.append(row)
            ekon_xlsx[prov] = {**row}
            print(f"  ✓ {prov}: {kat} (IED={ie})")

        ss  = sorted([s for s in analysis_summary if s['indeks_ekonomi'] is not None], key=lambda x: x['indeks_ekonomi'])
        print(f"\n=== SELESAI | {len(matched_features)} provinces | {kat_counts} ===")

        return Response({
            "status": "success",
            "source": f"PDRB: BPS API | Penduduk: {analytics.penduduk_source}",
            "tahun": tahun, "total_success": len(matched_features),
            "kategori_distribusi": kat_counts,
            "timestamp": analytics.timestamp_fetch,
            "penduduk_source": analytics.penduduk_source,
            "formula": {
                "KR_pk": "Konsumsi RT (Milyar Rp) / Penduduk (Ribu Jiwa)",
                "I_pk": "PMTB (Milyar Rp) / Penduduk (Ribu Jiwa)",
                "EN_pk": "Net Ekspor (Milyar Rp) / Penduduk (Ribu Jiwa)",
                "P_pk": "PDRB (Milyar Rp) / Penduduk (Ribu Jiwa)",
                "Normalisasi": "Min-Max",
                "Indeks_Ekonomi": "(KR_norm + I_norm + EN_norm + P_norm) / 4",
            },
            "klasifikasi": {"TINGGI": "> 0.70", "SEDANG": "0.40–0.70", "RENDAH": "< 0.40"},
            "matched_features": {"type": "FeatureCollection", "features": matched_features},
            "analysis_summary": analysis_summary,
            "ekon_data": ekon_xlsx,
            "worst_provinces": ss[:5],
            "best_provinces": ss[-5:][::-1],
            "colors": EkonAnalytics.COLORS,
            "dataset_info": {
                k: {"nama": v["nama"], "satuan": v["satuan"], "penjelasan": v["penjelasan"]}
                for k, v in get_ekon_config(tahun).items()
            },
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e), "message": "Gagal menganalisis data Ekonomi"}, status=500)


# ─────────────────────────────────────────────────────────────
# ENDPOINT: SIMPAN, LIST, DETAIL, HAPUS
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
def save_ekon_analysis(request):
    try:
        name = request.data.get('name', 'Analisis Ekonomi')
        data = request.data.get('analysis_data')
        if not data:
            return Response({"error": "Data tidak ditemukan"}, status=400)
        aid = str(uuid.uuid4())
        mongo_db["ekon_analysis"].insert_one({
            "analysis_id": aid, "name": name, "type": "ekon",
            "timestamp": datetime.now().isoformat(), **data,
        })
        return Response({"status": "success", "message": f"'{name}' disimpan", "analysis_id": aid})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_ekon_analysis_list(request):
    try:
        results = list(mongo_db["ekon_analysis"].find(
            {}, {"_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
                 "total_success": 1, "kategori_distribusi": 1, "tahun": 1}
        ).sort("timestamp", -1))
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_ekon_analysis_detail(request, analysis_id):
    try:
        result = mongo_db["ekon_analysis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not result:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_ekon_analysis(request, analysis_id):
    try:
        r = mongo_db["ekon_analysis"].delete_one({"analysis_id": analysis_id})
        if r.deleted_count == 0:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response({"status": "success", "message": "Berhasil dihapus"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)