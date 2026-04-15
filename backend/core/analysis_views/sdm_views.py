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

# Mapping tahun ke kode BPS (untuk fleksibilitas di masa depan)
TAHUN_BPS_MAP = {
    2020: 120, 2021: 121, 2022: 122, 2023: 123,
    2024: 124, 2025: 125, 2026: 126,
}

# Indikator dan dataset yang digunakan
INDIKATOR_DATASET_MAP = {
    'ALL':        ['UHH', 'RLS', 'HLS', 'DAYA_BELI'],
    'KESEHATAN':  ['UHH'],
    'PENDIDIKAN': ['RLS', 'HLS'],
    'DAYA_BELI':  ['DAYA_BELI'],
}

INDIKATOR_LABELS = {
    'ALL':        'Indeks SDM Gabungan (Kesehatan + Pendidikan + Daya Beli)',
    'KESEHATAN':  'Indeks Kesehatan — Umur Harapan Hidup',
    'PENDIDIKAN': 'Indeks Pendidikan — RLS & HLS',
    'DAYA_BELI':  'Indeks Daya Beli — Pengeluaran per Kapita',
}

# Target untuk setiap komponen (sesuai dokumen RSDM)
UHH_MAX = 85.0
RLS_MAX = 15.0
HLS_MAX = 18.0

def get_indikator_config(tahun: int) -> dict:
    """
    Konfigurasi indikator dengan URL API BPS yang benar
    
    Variable IDs:
    - 414: UHH (Umur Harapan Hidup)
    - 415: RLS (Rata-rata Lama Sekolah)
    - 417: HLS (Harapan Lama Sekolah)
    - 416: Pengeluaran per Kapita Disesuaikan
    """
    th = TAHUN_BPS_MAP.get(tahun, 124)
    return {
        "UHH": {
            "url_template": (
                f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                f"domain/0000/var/414/th/{th}/key/{{key}}/"
            ),
            "nama":       "Umur Harapan Hidup",
            "satuan":     "tahun",
            "has_gender": True,
            "penjelasan": "UHH mencerminkan derajat kesehatan populasi — komponen Indeks Kesehatan SDM",
        },
        "HLS": {
            "url_template": (
                f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                f"domain/0000/var/417/th/{th}/key/{{key}}/"
            ),
            "nama":       "Harapan Lama Sekolah",
            "satuan":     "tahun",
            "has_gender": False,
            "penjelasan": "HLS mencerminkan harapan anak baru masuk sekolah — komponen Indeks Pendidikan SDM",
        },
        "RLS": {
            "url_template": (
                f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                f"domain/0000/var/415/th/{th}/key/{{key}}/"
            ),
            "nama":       "Rata-rata Lama Sekolah",
            "satuan":     "tahun",
            "has_gender": False,
            "penjelasan": "RLS mencerminkan tingkat pendidikan rata-rata penduduk dewasa — komponen Indeks Pendidikan SDM",
        },
        "DAYA_BELI": {
            "url_template": (
                f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
                f"domain/0000/var/416/th/{th}/key/{{key}}/"
            ),
            "nama":       "Pengeluaran per Kapita Disesuaikan",
            "satuan":     "Ribu Rupiah/Orang/Tahun",
            "has_gender": False,
            "penjelasan": "Pengeluaran per kapita riil yang disesuaikan — komponen Indeks Daya Beli SDM",
        },
    }


def _is_data_empty(data):
    """Check if API response contains valid data"""
    if data is None:
        return True
    datacontent = data.get("datacontent", {})
    if not datacontent:
        return True
    valid = [v for v in datacontent.values() if v is not None and v != 0]
    return len(valid) == 0


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
        'BANGKA BELITUNG':               'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG':          'KEPULAUAN BANGKA BELITUNG',
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


def get_bank_kebijakan_by_kategori(kategori_list: list, limit_per_kategori: int = 10) -> list:
    """
    Ambil rekomendasi kebijakan dari tabel bank_kebijakan di PostgreSQL.
    Filter: indeks = 'ISDM', status IN kategori_list
    
    Klasifikasi 3 kelas:
    - TINGGI  ≥ 0.70
    - SEDANG  0.60 – 0.70
    - RENDAH  < 0.60
    """
    results = []
    conn    = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        valid_statuses   = ['TINGGI', 'SEDANG', 'RENDAH']
        kategori_filter  = [k for k in kategori_list if k in valid_statuses]

        if not kategori_filter:
            return results

        for status_kategori in kategori_filter:
            cur.execute("""
                SELECT id, indeks, status, prioritas, pilar_kebijakan,
                       isu_strategis, kebijakan, rekomendasi_program,
                       indikator_terkait
                FROM bank_kebijakan
                WHERE indeks = 'ISDM' AND status = %s
                ORDER BY prioritas ASC, pilar_kebijakan ASC
                LIMIT %s
            """, (status_kategori, limit_per_kategori))

            docs = [dict(row) for row in cur.fetchall()]

            if docs:
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

                results.extend(list(pilar_map.values()))

        cur.close()

    except Exception as e:
        print(f"  ✗ Error get_bank_kebijakan_by_kategori: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()

    return results


def build_kategori_list(kategori_sdm: str) -> list:
    """
    Mapping kategori SDM (3 kelas) → status di bank_kebijakan.
    """
    mapping = {
        'TINGGI': ['TINGGI'],
        'SEDANG': ['SEDANG'],
        'RENDAH': ['RENDAH'],
    }
    return mapping.get(kategori_sdm, ['SEDANG'])


@api_view(['POST'])
def check_sdm_year_data(request):
    """
    Cek ketersediaan data SDM untuk tahun dan indikator tertentu
    """
    if not BPS_API_KEY:
        return Response({"error": "BPS Web API Key belum dikonfigurasi"}, status=500)

    tahun     = request.data.get('tahun', 2024)
    indikator = request.data.get('indikator', 'ALL')

    try:
        tahun = int(tahun)
    except (ValueError, TypeError):
        tahun = 2024

    if tahun not in TAHUN_BPS_MAP:
        return Response({"error": f"Tahun {tahun} tidak didukung. Pilih antara 2020–2026."}, status=400)

    keys_to_check  = INDIKATOR_DATASET_MAP.get(indikator, INDIKATOR_DATASET_MAP['ALL'])
    all_config     = get_indikator_config(tahun)
    dataset_status = {}

    for key in keys_to_check:
        config = all_config.get(key)
        if not config:
            continue
        url = config["url_template"].format(key=BPS_API_KEY)
        try:
            resp = requests.get(url, timeout=20)
            if resp.status_code == 200:
                data   = resp.json()
                kosong = _is_data_empty(data)
                dataset_status[key] = {
                    "nama":     config["nama"],
                    "tersedia": not kosong,
                    "status":   "Tersedia" if not kosong else "Kosong / Tidak Tersedia",
                }
            else:
                dataset_status[key] = {
                    "nama":     config["nama"],
                    "tersedia": False,
                    "status":   f"HTTP Error {resp.status_code}",
                }
        except Exception as e:
            dataset_status[key] = {
                "nama":     config["nama"],
                "tersedia": False,
                "status":   f"Gagal ({str(e)[:50]})",
            }

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


class SdmAnalytics:
    """
    Menghitung Indeks SDM per provinsi berdasarkan rumus IPM BPS:
    
    Formula (sesuai dokumen RSDM):
        IK  = UHH / 85
        IP  = (RLS/15 + HLS/18) / 2
        IDB = (Pengeluaran - min) / (max - min)
        Indeks_SDM = (IK + IP + IDB) / 3

    Klasifikasi 3 kelas:
        TINGGI  ≥ 0.70 (warna hijau)
        SEDANG  0.60 – 0.70 (warna kuning)
        RENDAH  < 0.60 (warna merah)
    """

    COLORS = {
        "TINGGI": "#10b981",   # hijau
        "SEDANG": "#f59e0b",   # kuning
        "RENDAH": "#ef4444",   # merah
    }

    def __init__(self, tahun: int = 2024):
        self.tahun            = tahun
        self.indikator_config = get_indikator_config(tahun)
        self.timestamp_fetch  = None

    def fetch_all_data(self):
        return self.fetch_selected_data(list(self.indikator_config.keys()))

    def fetch_selected_data(self, keys: list) -> dict:
        """Fetch data dari BPS API untuk indikator yang dipilih"""
        all_data = {}
        self.timestamp_fetch = datetime.now().isoformat()
        for key in keys:
            config = self.indikator_config.get(key)
            if not config:
                continue
            try:
                url  = config["url_template"].format(key=BPS_API_KEY)
                print(f"Fetching {key} (th={TAHUN_BPS_MAP.get(self.tahun)}, tahun={self.tahun}): {url}")
                resp = requests.get(url, timeout=30)
                if resp.status_code == 200:
                    raw = resp.json()
                    if raw and raw.get("datacontent"):
                        all_data[key] = raw
                        print(f"  ✓ {key}: Success ({len(raw['datacontent'])} keys)")
                    else:
                        all_data[key] = None
                        print(f"  ✗ {key}: Kosong")
                else:
                    print(f"  ✗ {key}: HTTP {resp.status_code}")
                    all_data[key] = None
            except Exception as e:
                print(f"  ✗ {key}: Error - {e}")
                all_data[key] = None
        return all_data

    def parse_bps_data(self, raw_data, key: str) -> tuple:
        """
        Parse data dari BPS API dan ekstrak hanya data PROVINSI
        
        Format kode:
        - Provinsi: 4 digit akhir dengan 00 (contoh: 1100 = Aceh, 1200 = Sumatera Utara)
        - Kabupaten/Kota: 4+ digit dengan angka di akhir (contoh: 1101, 1102, dll)
        
        Returns:
            (province_values, raw_breakdown)
        """
        province_values = {}
        raw_breakdown   = {}

        if not raw_data:
            return province_values, raw_breakdown

        try:
            datacontent = raw_data.get("datacontent", {})
            vervar_list = raw_data.get("vervar", [])

            # Build prov_code_map dari vervar
            prov_code_map = {}
            for item in vervar_list:
                code  = str(item.get("val", ""))
                label = item.get("label", "")
                # Filter hanya provinsi: kode 4 digit yang berakhir dengan 00
                if code and label and code != "9999" and len(code) == 4 and code.endswith("00"):
                    clean_label = label.replace('<b>', '').replace('</b>', '')\
                                       .replace('<B>', '').replace('</B>', '').strip()
                    prov_code_map[code] = clean_label

            print(f"  Found {len(prov_code_map)} provinces in vervar")

            # Parse data content
            for dc_key, value in datacontent.items():
                if len(dc_key) < 4 or value is None:
                    continue
                
                # Ekstrak kode provinsi (4 digit pertama)
                prov_code = dc_key[:4]
                
                # Hanya ambil data yang kodenya ada di prov_code_map (provinsi saja)
                if prov_code not in prov_code_map:
                    continue
                
                try:
                    val_float = float(value)
                    prov_name = normalize_province_name(prov_code_map[prov_code])
                    
                    # Jika sudah ada data untuk provinsi ini, ambil rata-ratanya
                    if prov_name in province_values:
                        existing = province_values[prov_name]
                        province_values[prov_name] = round((existing + val_float) / 2, 2)
                    else:
                        province_values[prov_name] = round(val_float, 2)
                    
                    raw_breakdown[prov_name] = {"provinsi": prov_name, "nilai": province_values[prov_name]}
                except (ValueError, TypeError):
                    continue

            print(f"  ✅ {key}: Parsed {len(province_values)} provinces")

        except Exception as e:
            print(f"  ❌ Parse error {key}: {e}")
            import traceback; traceback.print_exc()

        return province_values, raw_breakdown

    def calculate_indices(self, data_sdm: dict, pengeluaran_min: float, pengeluaran_max: float, indikator: str = 'ALL') -> dict:
        """
        Hitung indeks komponen SDM sesuai rumus:
        
        IK  = UHH / 85
        IP  = (RLS/15 + HLS/18) / 2
        IDB = (Pengeluaran - min) / (max - min)
        Indeks_SDM = (IK + IP + IDB) / 3
        """
        uhh         = data_sdm.get("UHH")
        hls         = data_sdm.get("HLS")
        rls         = data_sdm.get("RLS")
        pengeluaran = data_sdm.get("DAYA_BELI")

        # Indeks Kesehatan: UHH / 85
        ik = round(min(uhh / UHH_MAX, 1.0), 4) if uhh is not None else None

        # Indeks Pendidikan: (RLS/15 + HLS/18) / 2
        ip = None
        if rls is not None and hls is not None:
            ip = round(min((rls / RLS_MAX + hls / HLS_MAX) / 2, 1.0), 4)
        elif rls is not None:
            ip = round(min(rls / RLS_MAX, 1.0), 4)
        elif hls is not None:
            ip = round(min(hls / HLS_MAX, 1.0), 4)

        # Indeks Daya Beli: (Pengeluaran - min) / (max - min)
        idb = None
        if pengeluaran is not None:
            denom = pengeluaran_max - pengeluaran_min
            if denom > 0:
                idb = round(min((pengeluaran - pengeluaran_min) / denom, 1.0), 4)
            else:
                idb = 0.5

        # Indeks SDM sesuai indikator
        if indikator == 'KESEHATAN':
            indeks_sdm = ik
        elif indikator == 'PENDIDIKAN':
            indeks_sdm = ip
        elif indikator == 'DAYA_BELI':
            indeks_sdm = idb
        else:  # 'ALL'
            components = [c for c in [ik, ip, idb] if c is not None]
            indeks_sdm = round(sum(components) / len(components), 4) if components else None

        return {"ik": ik, "ip": ip, "idb": idb, "indeks_sdm": indeks_sdm}

    def categorize_province(self, indeks_sdm):
        """
        Kategorisasi provinsi ke 3 kelas:
          ≥ 0.70 → TINGGI  (hijau)
          ≥ 0.60 → SEDANG  (kuning)
          <  0.60 → RENDAH  (merah)
        """
        if indeks_sdm is None:
            return "TIDAK DIKETAHUI", "#6b7280"
        if indeks_sdm >= 0.70:
            return "TINGGI", self.COLORS["TINGGI"]
        elif indeks_sdm >= 0.60:
            return "SEDANG", self.COLORS["SEDANG"]
        else:
            return "RENDAH", self.COLORS["RENDAH"]

    def generate_insights(self, provinsi, data_sdm, scores, kategori, indeks_sdm, indikator='ALL') -> list:
        """Generate insight/analisis untuk setiap provinsi"""
        insights = [f"Provinsi {provinsi} memiliki Indeks SDM {indeks_sdm} — kategori {kategori}."]

        uhh = data_sdm.get("UHH")
        rls = data_sdm.get("RLS")
        hls = data_sdm.get("HLS")
        pengeluaran = data_sdm.get("DAYA_BELI")
        ik  = scores.get("ik")
        ip  = scores.get("ip")
        idb = scores.get("idb")

        if indikator in ('ALL', 'KESEHATAN') and uhh is not None:
            if uhh >= 72:
                insights.append(f"✅ UHH {uhh} tahun — harapan hidup tinggi (IK = {ik}).")
            elif uhh >= 68:
                insights.append(f"⚠️ UHH {uhh} tahun — harapan hidup sedang (IK = {ik}).")
            else:
                insights.append(f"🚨 UHH {uhh} tahun — harapan hidup rendah (IK = {ik}).")

        if indikator in ('ALL', 'PENDIDIKAN'):
            if rls is not None:
                mark = "✅" if rls >= 9.0 else ("⚠️" if rls >= 7.0 else "🚨")
                insights.append(f"{mark} RLS {rls} tahun (target nasional 9-15 tahun — IP = {ip}).")
            if hls is not None:
                mark = "✅" if hls >= 13.0 else ("⚠️" if hls >= 11.0 else "🚨")
                insights.append(f"{mark} HLS {hls} tahun (target nasional ≥13-18 tahun).")

        if indikator in ('ALL', 'DAYA_BELI') and pengeluaran is not None and idb is not None:
            if idb >= 0.70:
                insights.append(f"💰 Daya beli tinggi — Pengeluaran Rp{pengeluaran:,.0f} ribu (IDB = {idb}).")
            elif idb >= 0.40:
                insights.append(f"💵 Daya beli sedang — Pengeluaran Rp{pengeluaran:,.0f} ribu (IDB = {idb}).")
            else:
                insights.append(f"💸 Daya beli rendah — Pengeluaran Rp{pengeluaran:,.0f} ribu (IDB = {idb}).")

        return insights


@api_view(['POST'])
def analyze_sdm_bps(request):
    """
    Endpoint utama untuk analisis Indeks SDM menggunakan BPS Web API.
    
    Request body:
    {
        "tahun": 2024,      # optional, default 2024
        "indikator": "ALL"  # optional: ALL, KESEHATAN, PENDIDIKAN, DAYA_BELI
    }
    
    Komponen: UHH (var 414) + RLS (var 415) + HLS (var 417) + Pengeluaran (var 416)
    
    Formula:
        IK  = UHH / 85
        IP  = (RLS/15 + HLS/18) / 2
        IDB = (Pengeluaran - min) / (max - min)
        Indeks_SDM = (IK + IP + IDB) / 3
    
    Klasifikasi 3 kelas: 
        TINGGI ≥0.70 | SEDANG 0.60–0.70 | RENDAH <0.60
    """
    if not BPS_API_KEY:
        return Response({
            "error":   "BPS Web API Key belum dikonfigurasi",
            "message": "Tambahkan BPS_WEB_API_KEY di file .env",
        }, status=500)

    try:
        tahun     = request.data.get('tahun', 2024)
        indikator = request.data.get('indikator', 'ALL')

        try:
            tahun = int(tahun)
        except (ValueError, TypeError):
            tahun = 2024

        if tahun not in TAHUN_BPS_MAP:
            return Response({"error": f"Tahun {tahun} tidak didukung."}, status=400)
        if indikator not in INDIKATOR_DATASET_MAP:
            indikator = 'ALL'

        keys_aktif = INDIKATOR_DATASET_MAP[indikator]
        analytics  = SdmAnalytics(tahun=tahun)

        print(f"\n=== MULAI FETCH SDM BPS | TAHUN={tahun} | INDIKATOR={indikator} ===")
        raw_data = analytics.fetch_selected_data(keys_aktif)

        print("\n=== PARSE DATA PER KOMPONEN (PROVINSI SAJA) ===")
        empty = ({}, {})

        uhh_values,  uhh_raw  = analytics.parse_bps_data(raw_data.get('UHH'),       'UHH')       if 'UHH'       in keys_aktif else empty
        hls_values,  hls_raw  = analytics.parse_bps_data(raw_data.get('HLS'),       'HLS')       if 'HLS'       in keys_aktif else empty
        rls_values,  rls_raw  = analytics.parse_bps_data(raw_data.get('RLS'),       'RLS')       if 'RLS'       in keys_aktif else empty
        peng_values, peng_raw = analytics.parse_bps_data(raw_data.get('DAYA_BELI'), 'DAYA_BELI') if 'DAYA_BELI' in keys_aktif else empty

        peng_list       = [v for v in peng_values.values() if v is not None]
        pengeluaran_min = min(peng_list) if peng_list else 0.0
        pengeluaran_max = max(peng_list) if peng_list else 1.0
        print(f"  📊 Pengeluaran Min={pengeluaran_min}, Max={pengeluaran_max}")

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

        all_provinces = set()
        if 'UHH'       in keys_aktif: all_provinces.update(uhh_values.keys())
        if 'HLS'       in keys_aktif: all_provinces.update(hls_values.keys())
        if 'RLS'       in keys_aktif: all_provinces.update(rls_values.keys())
        if 'DAYA_BELI' in keys_aktif: all_provinces.update(peng_values.keys())

        print(f"\n=== PROCESSING {len(all_provinces)} PROVINCES | INDIKATOR={indikator} ===")

        matched_features  = []
        analysis_summary  = []
        sdm_data_for_xlsx = {}
        kategori_counts   = {"TINGGI": 0, "SEDANG": 0, "RENDAH": 0}

        # Cache kebijakan per kategori
        kebijakan_cache = {}

        for prov_name in sorted(all_provinces):
            data_sdm = {
                "UHH":       uhh_values.get(prov_name)  if 'UHH'       in keys_aktif else None,
                "HLS":       hls_values.get(prov_name)  if 'HLS'       in keys_aktif else None,
                "RLS":       rls_values.get(prov_name)  if 'RLS'       in keys_aktif else None,
                "DAYA_BELI": peng_values.get(prov_name) if 'DAYA_BELI' in keys_aktif else None,
            }

            if not any(v is not None for v in data_sdm.values()):
                continue

            scores = analytics.calculate_indices(data_sdm, pengeluaran_min, pengeluaran_max, indikator)
            indeks_sdm      = scores["indeks_sdm"]
            kategori, warna = analytics.categorize_province(indeks_sdm)
            insights        = analytics.generate_insights(prov_name, data_sdm, scores, kategori, indeks_sdm, indikator)

            # Ambil kebijakan dari DB (cache per kategori)
            if kategori not in kebijakan_cache:
                kategori_list = build_kategori_list(kategori)
                kebijakan_cache[kategori] = get_bank_kebijakan_by_kategori(
                    kategori_list, limit_per_kategori=10
                )
            rekomendasi = kebijakan_cache[kategori]

            # Match boundary GeoJSON
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

            feature_copy = matched_feature.copy()
            props        = feature_copy.get('properties', {})
            props['sdm_analysis'] = {
                "nama_provinsi":   prov_name,
                "indikator":       indikator,
                "kategori":        kategori,
                "warna":           warna,
                "indeks_sdm":      indeks_sdm,
                "ik":              scores["ik"],
                "ip":              scores["ip"],
                "idb":             scores["idb"],
                "insights":        insights,
                "rekomendasi":     rekomendasi,
                "data_komponen": {
                    "UHH":       data_sdm.get("UHH"),
                    "HLS":       data_sdm.get("HLS"),
                    "RLS":       data_sdm.get("RLS"),
                    "DAYA_BELI": data_sdm.get("DAYA_BELI"),
                },
            }
            feature_copy['properties'] = props
            matched_features.append(feature_copy)

            analysis_summary.append({
                "provinsi":    prov_name,
                "indikator":   indikator,
                "kategori":    kategori,
                "warna":       warna,
                "indeks_sdm":  indeks_sdm,
                "ik":          scores["ik"],
                "ip":          scores["ip"],
                "idb":         scores["idb"],
                "uhh":         data_sdm.get("UHH"),
                "hls":         data_sdm.get("HLS"),
                "rls":         data_sdm.get("RLS"),
                "pengeluaran": data_sdm.get("DAYA_BELI"),
            })

            sdm_data_for_xlsx[prov_name] = {
                "provinsi":    prov_name,
                "uhh":         data_sdm.get("UHH"),
                "hls":         data_sdm.get("HLS"),
                "rls":         data_sdm.get("RLS"),
                "pengeluaran": data_sdm.get("DAYA_BELI"),
                "ik":          scores["ik"],
                "ip":          scores["ip"],
                "idb":         scores["idb"],
                "indeks_sdm":  indeks_sdm,
                "kategori":    kategori,
            }

            print(f"  ✓ {prov_name}: {kategori} (Indeks SDM: {indeks_sdm})")

        sorted_summary  = sorted(
            [s for s in analysis_summary if s['indeks_sdm'] is not None],
            key=lambda x: x['indeks_sdm'],
        )
        worst_provinces = sorted_summary[:5]
        best_provinces  = sorted_summary[-5:][::-1]

        print(f"\n=== SDM ANALYSIS COMPLETE | {len(matched_features)} provinces ===")
        print(f"    Distribusi: {kategori_counts}")

        raw_datasets = {
            "timestamp":       analytics.timestamp_fetch,
            "tahun":           tahun,
            "indikator":       indikator,
            "UHH":             uhh_raw  if 'UHH'       in keys_aktif else {},
            "HLS":             hls_raw  if 'HLS'       in keys_aktif else {},
            "RLS":             rls_raw  if 'RLS'       in keys_aktif else {},
            "DAYA_BELI":       peng_raw if 'DAYA_BELI' in keys_aktif else {},
            "pengeluaran_min": pengeluaran_min,
            "pengeluaran_max": pengeluaran_max,
        }

        return Response({
            "status":              "success",
            "source":              "BPS Web API — IPM Metode Baru (UHH, RLS, HLS, Pengeluaran per Kapita)",
            "tahun":               tahun,
            "indikator":           indikator,
            "dataset_aktif":       keys_aktif,
            "total_success":       len(matched_features),
            "kategori_distribusi": kategori_counts,
            "timestamp":           analytics.timestamp_fetch,
            "formula": {
                "IK":         "UHH / 85",
                "IP":         "(RLS/15 + HLS/18) / 2",
                "IDB":        "(Pengeluaran - min) / (max - min)",
                "Indeks_SDM": "(IK + IP + IDB) / 3",
            },
            "matched_features": {
                "type":     "FeatureCollection",
                "features": matched_features,
            },
            "analysis_summary": analysis_summary,
            "sdm_data":         sdm_data_for_xlsx,
            "worst_provinces":  worst_provinces,
            "best_provinces":   best_provinces,
            "colors":           SdmAnalytics.COLORS,
            "indikator_info": {
                k: {
                    "nama":       v["nama"],
                    "satuan":     v["satuan"],
                    "penjelasan": v["penjelasan"],
                }
                for k, v in get_indikator_config(tahun).items()
            },
            "raw_datasets": raw_datasets,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({
            "error":   str(e),
            "message": "Gagal menganalisis data SDM dari BPS",
        }, status=500)


@api_view(['POST'])
def save_sdm_analysis(request):
    """Simpan hasil analisis SDM ke MongoDB"""
    try:
        analysis_name = request.data.get('name', 'Analisis SDM Tanpa Nama')
        analysis_data = request.data.get('analysis_data')
        if not analysis_data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)

        analysis_id = str(uuid.uuid4())
        document    = {
            "analysis_id": analysis_id,
            "name":        analysis_name,
            "type":        "sdm",
            "timestamp":   datetime.now().isoformat(),
            **analysis_data,
        }
        mongo_db["sdm_analysis"].insert_one(document)
        return Response({
            "status":      "success",
            "message":     f"Analisis SDM '{analysis_name}' berhasil disimpan",
            "analysis_id": analysis_id,
            "saved_at":    document["timestamp"],
        })
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal menyimpan analisis"}, status=500)


@api_view(['GET'])
def get_sdm_analysis_list(request):
    """Dapatkan daftar semua analisis SDM"""
    try:
        cursor = mongo_db["sdm_analysis"].find(
            {},
            {
                "_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
                "total_success": 1, "kategori_distribusi": 1, "tahun": 1, "indikator": 1,
            }
        ).sort("timestamp", -1)
        results = list(cursor)
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal mengambil daftar analisis"}, status=500)


@api_view(['GET'])
def get_sdm_analysis_detail(request, analysis_id):
    """Dapatkan detail analisis SDM berdasarkan ID"""
    try:
        result = mongo_db["sdm_analysis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not result:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal mengambil detail analisis"}, status=500)


@api_view(['DELETE'])
def delete_sdm_analysis(request, analysis_id):
    """Hapus analisis SDM berdasarkan ID"""
    try:
        result = mongo_db["sdm_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response({"status": "success", "message": "Analisis SDM berhasil dihapus"})
    except Exception as e:
        return Response({"error": str(e), "message": "Gagal menghapus analisis"}, status=500)