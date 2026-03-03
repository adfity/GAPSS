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

# ── Load .env dari path yang benar ────────────────────────────────────────────
base_dir    = os.path.dirname(__file__)
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
BPS_API_KEY   = os.getenv("BPS_WEB_API_KEY")

client   = MongoClient(MONGO_URI)
mongo_db = client[DB_MONGO_NAME]

# ── Koneksi PostgreSQL ────────────────────────────────────────────────────────
def get_pg_connection():
    return psycopg2.connect(
        host     = os.getenv("DB_HOST"),
        port     = int(os.getenv("DB_PORT", "5432")),
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# KONFIGURASI INDIKATOR EKONOMI — mapping th (tahun BPS) ke tahun kalender
# BPS menggunakan kode th internal: 125 = 2024, 124 = 2023, 123 = 2022, dst.
# ═══════════════════════════════════════════════════════════════════════════════

# Mapping kode tahun BPS → tahun kalender (2010-2024)
BPS_TAHUN_MAP = {
    "130": 2030,  # Untuk kebutuhan masa depan
    "129": 2029,
    "128": 2028,
    "127": 2027,
    "126": 2026,
    "125": 2025,
    "124": 2024,
    "123": 2023,
    "122": 2022,
    "121": 2021,
    "120": 2020,
    "119": 2019,
    "118": 2018,
    "117": 2017,
    "116": 2016,
    "115": 2015,
    "114": 2014,
    "113": 2013,
    "112": 2012,
    "111": 2011,
    "110": 2010,
}

# Urutan tahun dari terbaru ke terlama (untuk auto-fallback)
BPS_TAHUN_URUT = ["130", "129", "128", "127", "126", "125", "124", "123", "122", "121", "120", "119", "118", "117", "116", "115", "114", "113", "112", "111", "110"]

INDIKATOR_EKONOMI = {
    "PDRB": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/534/th/{th}/key/{key}/",
        "nama": "PDRB Atas Dasar Harga Berlaku Menurut Pengeluaran",
        "satuan": "Milyar Rupiah",
        "threshold_tinggi": 75000,
        "threshold_sedang": 50000,
        "bobot": 0.40,
        "reverse": False,
        "penjelasan": "Produk Domestik Regional Bruto yang mencerminkan kapasitas ekonomi daerah dan output ekonomi total",
        "interpretasi": {
            "tinggi": {"nilai": "> Rp75 miliar", "skor": 3},
            "sedang": {"nilai": "Rp50-75 miliar", "skor": 2},
            "rendah": {"nilai": "< Rp50 miliar",  "skor": 1},
        },
    },
    "KEMISKINAN": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/192/th/{th}/key/{key}/",
        "nama": "Persentase Penduduk Miskin",
        "satuan": "%",
        "threshold_rendah": 7,
        "threshold_sedang": 12,
        "bobot": 0.40,
        "reverse": True,
        "penjelasan": "Persentase penduduk yang hidup di bawah garis kemiskinan",
        "interpretasi": {
            "rendah": {"nilai": "< 7%",   "skor": 3},
            "sedang": {"nilai": "7-12%",  "skor": 2},
            "tinggi": {"nilai": "> 12%",  "skor": 1},
        },
    },
    "INVESTASI": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/793/th/{th}/key/{key}/",
        "nama": "Realisasi Investasi PMDN",
        "satuan": "Milyar Rupiah",
        "threshold_tinggi": 10000,
        "threshold_sedang": 5000,
        "bobot": 0.20,
        "reverse": False,
        "penjelasan": "Investasi Penanaman Modal Dalam Negeri",
        "interpretasi": {
            "tinggi": {"nilai": "> Rp10 triliun", "skor": 3},
            "sedang": {"nilai": "Rp5-10 triliun", "skor": 2},
            "rendah": {"nilai": "< Rp5 triliun",  "skor": 1},
        },
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: BANK KEBIJAKAN dari PostgreSQL
# ═══════════════════════════════════════════════════════════════════════════════

def get_bank_kebijakan_by_kategori(kategori_list: list, limit_per_kategori: int = 8) -> list:
    results = []
    conn    = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        for kategori in kategori_list:
            cur.execute("""
                SELECT id, kategori_utama, sub_sektor, prioritas, no_aksi,
                       nama_aksi, detail_aksi, timeline, budget_est,
                       sektor_terkait, indikator_dampak
                FROM bank_kebijakan
                WHERE domain = 'ekonomi' AND kategori_utama = %s
                ORDER BY no_aksi ASC
                LIMIT %s
            """, (kategori, limit_per_kategori))

            docs = [dict(row) for row in cur.fetchall()]
            if docs:
                results.append({
                    "kategori":    kategori,
                    "prioritas":   docs[0].get("prioritas", "-"),
                    "jumlah_aksi": len(docs),
                    "aksi":        docs,
                })

        cur.close()
    except Exception as e:
        print(f"  ✗ Error get_bank_kebijakan_by_kategori: {e}")
    finally:
        if conn:
            conn.close()

    return results


def build_kategori_list(kategori_iek: str, data_ekonomi: dict) -> list:
    kategori_list = [kategori_iek]

    pdrb       = data_ekonomi.get("PDRB")
    kemiskinan = data_ekonomi.get("KEMISKINAN")
    investasi  = data_ekonomi.get("INVESTASI")

    if pdrb is not None and pdrb < INDIKATOR_EKONOMI["PDRB"]["threshold_sedang"]:
        kategori_list.append("PDRB_RENDAH")

    if kemiskinan is not None and kemiskinan > INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_sedang"]:
        kategori_list.append("KEMISKINAN_TINGGI")

    if investasi is not None and investasi < INDIKATOR_EKONOMI["INVESTASI"]["threshold_sedang"]:
        kategori_list.append("INVESTASI_RENDAH")

    return list(dict.fromkeys(kategori_list))


# ═══════════════════════════════════════════════════════════════════════════════
# KELAS ANALITIK EKONOMI
# ═══════════════════════════════════════════════════════════════════════════════

class EkonomiAnalytics:

    COLORS = {
        "MAJU":       "#10b981",
        "BERKEMBANG": "#f59e0b",
        "TERTINGGAL": "#ef4444",
    }

    def fetch_all_data(self, th_code: str = "125"):
        """Fetch data dari BPS untuk kode tahun tertentu."""
        all_data = {}
        for key, cfg in INDIKATOR_EKONOMI.items():
            try:
                url  = cfg["url_template"].format(th=th_code, key=BPS_API_KEY)
                resp = requests.get(url, timeout=30)
                raw  = resp.json() if resp.status_code == 200 else None
                # Validasi: pastikan ada data
                if raw and raw.get("datacontent"):
                    all_data[key] = raw
                    print(f"  ✓ {key} (th={th_code})")
                else:
                    all_data[key] = None
                    print(f"  ✗ {key} (th={th_code}): kosong atau error")
            except Exception as e:
                print(f"  ✗ {key}: {e}")
                all_data[key] = None
        return all_data

    def fetch_latest_available(self):
        """
        Coba fetch dari tahun terbaru sampai dapat data.
        Return (all_data, th_code, tahun_kalender)
        """
        for th_code in BPS_TAHUN_URUT:
            print(f"\n=== Mencoba tahun BPS th={th_code} ({BPS_TAHUN_MAP.get(th_code, '?')}) ===")
            data = self.fetch_all_data(th_code)
            # Cek apakah minimal satu indikator berhasil
            if any(v is not None for v in data.values()):
                tahun_kal = BPS_TAHUN_MAP.get(th_code, th_code)
                print(f"  → Menggunakan data tahun {tahun_kal}")
                return data, th_code, tahun_kal
        # Fallback jika semua gagal
        return {k: None for k in INDIKATOR_EKONOMI}, BPS_TAHUN_URUT[0], None

    def fetch_historis(self, th_codes: list):
        """
        Fetch data untuk beberapa tahun sekaligus (untuk grafik tren).
        Return dict: { tahun_kalender: { provinsi: { PDRB, KEMISKINAN, INVESTASI } } }
        """
        historis = {}
        for th_code in th_codes:
            tahun_kal = BPS_TAHUN_MAP.get(th_code, th_code)
            print(f"  Historis th={th_code} ({tahun_kal})")
            data = self.fetch_all_data(th_code)
            parsed = {
                k: self.parse_province_data(data[k], k)
                for k in INDIKATOR_EKONOMI
            }
            # Konsolidasikan per provinsi
            semua_prov = set()
            for pd in parsed.values():
                semua_prov.update(pd.keys())

            historis[tahun_kal] = {}
            for prov in semua_prov:
                historis[tahun_kal][prov] = {
                    k: parsed[k].get(prov) for k in INDIKATOR_EKONOMI
                }
        return historis

    def parse_province_data(self, raw_data, indikator_key):
        province_values = {}
        if not raw_data:
            return province_values
        try:
            datacontent   = raw_data.get("datacontent", {})
            vervar_list   = raw_data.get("vervar", [])
            prov_code_map = {
                str(v.get("val", "")): v.get("label", "")
                for v in vervar_list
                if str(v.get("val", "")) != "9999"
            }
            for k, val in datacontent.items():
                try:
                    prov_code = k[:4]
                    if prov_code == "9999":
                        continue
                    name = prov_code_map.get(prov_code)
                    if name and val is not None:
                        province_values[str(name).upper().strip()] = float(val)
                except (ValueError, TypeError):
                    continue
            print(f"  Parsed {len(province_values)} provinces untuk {indikator_key}")
        except Exception as e:
            print(f"  Parse error {indikator_key}: {e}")
        return province_values

    def calculate_ekonomi_index(self, data_ekonomi: dict) -> float:
        scores = {}
        pdrb = data_ekonomi.get("PDRB")
        if pdrb is not None:
            if pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_tinggi"]:
                scores["PDRB"] = 3
            elif pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_sedang"]:
                scores["PDRB"] = 2
            else:
                scores["PDRB"] = 1

        kemiskinan = data_ekonomi.get("KEMISKINAN")
        if kemiskinan is not None:
            if kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_rendah"]:
                scores["KEMISKINAN"] = 3
            elif kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_sedang"]:
                scores["KEMISKINAN"] = 2
            else:
                scores["KEMISKINAN"] = 1

        investasi = data_ekonomi.get("INVESTASI")
        if investasi is not None:
            if investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_tinggi"]:
                scores["INVESTASI"] = 3
            elif investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_sedang"]:
                scores["INVESTASI"] = 2
            else:
                scores["INVESTASI"] = 1

        total_score  = 0.0
        total_weight = 0.0
        for key, weight in [("PDRB", 0.40), ("KEMISKINAN", 0.40), ("INVESTASI", 0.20)]:
            if key in scores:
                total_score  += scores[key] * weight
                total_weight += weight

        return round(total_score / total_weight, 2) if total_weight > 0 else 0.0

    def categorize_province(self, iek: float):
        if iek >= 2.4:
            return "MAJU", iek
        elif iek >= 1.8:
            return "BERKEMBANG", iek
        return "TERTINGGAL", iek

    def generate_insights(self, provinsi, data_ekonomi, kategori, iek):
        insights = []
        label_map = {
            "MAJU":       ("✅", "dalam kategori MAJU - Ekonomi terus tumbuh dengan baik"),
            "BERKEMBANG": ("📊", "dalam kategori BERKEMBANG - Perlu penguatan menuju maju"),
            "TERTINGGAL": ("⚠️", "dalam kategori TERTINGGAL - Memerlukan intervensi khusus"),
        }
        icon, desc = label_map[kategori]
        insights.append(f"{icon} {provinsi} {desc} (Index: {iek})")

        pdrb = data_ekonomi.get("PDRB")
        if pdrb is not None:
            if pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_tinggi"]:
                insights.append(f"📈 PDRB: Rp{pdrb:.0f} milyar - TINGGI (Kuat)")
            elif pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_sedang"]:
                insights.append(f"📊 PDRB: Rp{pdrb:.0f} milyar - SEDANG")
            else:
                insights.append(f"📉 PDRB: Rp{pdrb:.0f} milyar - RENDAH (Perlu perhatian)")

        kemiskinan = data_ekonomi.get("KEMISKINAN")
        if kemiskinan is not None:
            if kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_rendah"]:
                insights.append(f"✅ Kemiskinan: {kemiskinan}% - RENDAH (Baik)")
            elif kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_sedang"]:
                insights.append(f"⚠️ Kemiskinan: {kemiskinan}% - SEDANG")
            else:
                insights.append(f"🚨 Kemiskinan: {kemiskinan}% - TINGGI")

        investasi = data_ekonomi.get("INVESTASI")
        if investasi is not None:
            if investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_tinggi"]:
                insights.append(f"💰 Investasi: Rp{investasi:.0f} milyar - TINGGI")
            elif investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_sedang"]:
                insights.append(f"💵 Investasi: Rp{investasi:.0f} milyar - SEDANG")
            else:
                insights.append(f"💸 Investasi: Rp{investasi:.0f} milyar - RENDAH")

        return insights


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: NORMALISASI NAMA PROVINSI
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_province_name(name: str) -> str:
    if not isinstance(name, str):
        name = str(name)
    name = name.upper().strip()

    special = {
        "DKI JAKARTA":                   "JAKARTA",
        "DAERAH KHUSUS IBUKOTA JAKARTA": "JAKARTA",
        "DKI":                           "JAKARTA",
        "YOGYAKARTA":                    "DAERAH ISTIMEWA YOGYAKARTA",
        "DIY":                           "DAERAH ISTIMEWA YOGYAKARTA",
        "D.I. YOGYAKARTA":               "DAERAH ISTIMEWA YOGYAKARTA",
        "BANGKA BELITUNG":               "KEPULAUAN BANGKA BELITUNG",
        "KEP. BANGKA BELITUNG":          "KEPULAUAN BANGKA BELITUNG",
        "KEP. RIAU":                     "KEPULAUAN RIAU",
    }
    for k, v in special.items():
        if k in name:
            return v

    abbr = {
        "KEP.": "KEPULAUAN",
        "KEP ": "KEPULAUAN ",
        "NTB":  "NUSA TENGGARA BARAT",
        "NTT":  "NUSA TENGGARA TIMUR",
    }
    for a, f in abbr.items():
        name = name.replace(a, f)

    for prefix in ["PROVINSI ", "PROV. ", "PROV ", "DAERAH KHUSUS IBUKOTA "]:
        if name.startswith(prefix):
            name = name[len(prefix):]

    return name.strip()


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: GET BANK KEBIJAKAN dari PostgreSQL
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
def get_bank_kebijakan(request):
    """
    GET /api/bank-kebijakan/
    Query params:
      - domain     : ekonomi | kesehatan | pendidikan (default: ekonomi)
      - kategori   : TERTINGGAL | BERKEMBANG | MAJU | PDRB_RENDAH | dst
      - limit      : jumlah aksi (default 50, max 300)
      - sub_sektor : filter opsional
    """
    domain     = request.GET.get("domain", "ekonomi").lower().strip()
    kategori   = request.GET.get("kategori", "").upper().strip()
    limit      = min(int(request.GET.get("limit", 50)), 300)
    sub_sektor = request.GET.get("sub_sektor", "").strip()

    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        where_clauses = ["domain = %s"]
        params        = [domain]

        if kategori:
            where_clauses.append("kategori_utama = %s")
            params.append(kategori)
        if sub_sektor:
            where_clauses.append("sub_sektor ILIKE %s")
            params.append(f"%{sub_sektor}%")

        where_sql = "WHERE " + " AND ".join(where_clauses)
        params.append(limit)

        cur.execute(f"""
            SELECT id, domain, kategori_utama, sub_sektor, prioritas, no_aksi,
                   nama_aksi, detail_aksi, timeline, budget_est,
                   sektor_terkait, indikator_dampak
            FROM bank_kebijakan
            {where_sql}
            ORDER BY no_aksi ASC
            LIMIT %s
        """, params)

        docs = [dict(row) for row in cur.fetchall()]

        cur.execute("""
            SELECT kategori_utama, COUNT(*) as jumlah
            FROM bank_kebijakan
            WHERE domain = %s
            GROUP BY kategori_utama
            ORDER BY kategori_utama
        """, (domain,))
        distribusi = {row["kategori_utama"]: row["jumlah"] for row in cur.fetchall()}

        cur.close()

        return Response({
            "status":     "success",
            "domain":     domain,
            "total":      len(docs),
            "filter":     {"domain": domain, "kategori": kategori, "sub_sektor": sub_sektor},
            "distribusi": distribusi,
            "data":       docs,
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: ANALISIS EKONOMI BPS — dengan parameter tahun
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(["POST"])
def analyze_ekonomi_bps(request):
    """
    Analisis data ekonomi menggunakan BPS Web API.
    Body JSON:
      - provinces         : 'ALL'
      - indikator_terpilih: 'ALL' | 'PDRB' | 'KEMISKINAN' | 'INVESTASI'
      - th_code           : kode tahun BPS (opsional, default auto-detect terbaru)
    """

    if not BPS_API_KEY:
        return Response({
            "error":   "BPS Web API Key belum dikonfigurasi",
            "message": "Tambahkan BPS_WEB_API_KEY di file .env",
        }, status=500)

    # Ambil parameter tahun dari request (opsional)
    th_code_req = request.data.get("th_code", None)

    try:
        analytics = EkonomiAnalytics()

        if th_code_req and th_code_req in BPS_TAHUN_MAP:
            print(f"=== Fetch data dari BPS (tahun diminta: {th_code_req}) ===")
            raw_data  = analytics.fetch_all_data(th_code_req)
            th_code   = th_code_req
            tahun_kal = BPS_TAHUN_MAP[th_code_req]
        else:
            print("=== Fetch data dari BPS (auto-detect tahun terbaru) ===")
            raw_data, th_code, tahun_kal = analytics.fetch_latest_available()

        print(f"\n=== Parse data per provinsi (tahun {tahun_kal}) ===")
        parsed_data = {
            k: analytics.parse_province_data(raw_data[k], k)
            for k in INDIKATOR_EKONOMI
        }

        print("\n=== Load boundary data ===")
        boundary_features = list(mongo_db["batas_provinsi"].find({}, {"_id": 0}))
        province_map = {}
        for feat in boundary_features:
            props = feat.get("properties", {})
            for field in ["NAMOBJ", "name", "WADMPR", "Provinsi"]:
                if field in props and props[field]:
                    official = str(props[field]).upper().strip()
                    province_map[normalize_province_name(official)] = feat
                    province_map[official] = feat

        print(f"Loaded {len(province_map)} province boundaries")

        all_provinces = set()
        for ind_data in parsed_data.values():
            all_provinces.update(ind_data.keys())

        matched_features = []
        analysis_summary = []
        kategori_counts  = {"MAJU": 0, "BERKEMBANG": 0, "TERTINGGAL": 0}

        for prov in sorted(all_provinces):
            data_ekonomi = {k: parsed_data[k].get(prov) for k in INDIKATOR_EKONOMI}

            if not any(v is not None for v in data_ekonomi.values()):
                continue

            norm    = normalize_province_name(prov)
            matched = province_map.get(norm) or province_map.get(prov)
            if not matched:
                for map_name, feat in province_map.items():
                    if norm in map_name or map_name in norm:
                        matched = feat
                        break
            if not matched:
                print(f"  ✗ {prov}: no boundary match")
                continue

            iek          = analytics.calculate_ekonomi_index(data_ekonomi)
            kategori, _  = analytics.categorize_province(iek)
            warna        = EkonomiAnalytics.COLORS[kategori]
            insights     = analytics.generate_insights(prov, data_ekonomi, kategori, iek)

            kategori_list   = build_kategori_list(kategori, data_ekonomi)
            recommendations = get_bank_kebijakan_by_kategori(kategori_list, limit_per_kategori=8)

            kategori_counts[kategori] += 1

            feat_copy = matched.copy()
            props     = feat_copy.get("properties", {})
            props["ekonomi_analysis"] = {
                "nama_provinsi":    prov,
                "kategori":         kategori,
                "warna":            warna,
                "ekonomi_index":    iek,
                "insights":         insights,
                "rekomendasi":      recommendations,
                "kategori_applied": kategori_list,
                "data_ekonomi":     data_ekonomi,
            }
            feat_copy["properties"] = props
            matched_features.append(feat_copy)

            analysis_summary.append({
                "provinsi":      prov,
                "kategori":      kategori,
                "warna":         warna,
                "ekonomi_index": iek,
                "pdrb":          data_ekonomi.get("PDRB"),
                "kemiskinan":    data_ekonomi.get("KEMISKINAN"),
                "investasi":     data_ekonomi.get("INVESTASI"),
            })
            print(f"  ✓ {prov}: {kategori} (IEK={iek})")

        national_recommendations = []
        if kategori_counts["TERTINGGAL"] > 0:
            national_recommendations.append({
                "priority": "Darurat",
                "title":    f"Fokus Pembangunan {kategori_counts['TERTINGGAL']} Provinsi Tertinggal",
                "content":  f"{kategori_counts['TERTINGGAL']} provinsi memerlukan percepatan pembangunan ekonomi.",
            })
        if kategori_counts["BERKEMBANG"] > 0:
            national_recommendations.append({
                "priority": "Tinggi",
                "title":    f"Penguatan {kategori_counts['BERKEMBANG']} Provinsi Berkembang",
                "content":  f"{kategori_counts['BERKEMBANG']} provinsi menuju status maju.",
            })
        if kategori_counts["MAJU"] > 0:
            national_recommendations.append({
                "priority": "Maintenance",
                "title":    f"Sustain {kategori_counts['MAJU']} Provinsi Maju",
                "content":  f"{kategori_counts['MAJU']} provinsi dengan ekonomi yang kuat.",
            })

        sorted_idx      = sorted(
            [s for s in analysis_summary if s["ekonomi_index"] is not None],
            key=lambda x: x["ekonomi_index"],
        )
        worst_provinces = sorted_idx[:5]
        best_provinces  = sorted_idx[-5:][::-1]

        print(f"\n=== Selesai: {len(matched_features)} provinsi (tahun {tahun_kal}) ===")

        # Daftar tahun yang tersedia untuk selector frontend
        tahun_tersedia = [
            {"th_code": k, "tahun": v, "label": str(v)}
            for k, v in BPS_TAHUN_MAP.items()
            if k in BPS_TAHUN_URUT
        ]
        tahun_tersedia.sort(key=lambda x: x["tahun"], reverse=True)

        return Response({
            "status":                   "success",
            "source":                   "BPS Web API + PostgreSQL Bank Kebijakan",
            "tahun":                    tahun_kal,
            "th_code":                  th_code,
            "tahun_tersedia":           tahun_tersedia,
            "total_provinces":          len(all_provinces),
            "total_matched":            len(matched_features),
            "total_success":            len(matched_features),
            "kategori_distribusi":      kategori_counts,
            "matched_features": {
                "type":     "FeatureCollection",
                "features": matched_features,
            },
            "analysis_summary":         analysis_summary,
            "national_recommendations": national_recommendations,
            "worst_provinces":          worst_provinces,
            "best_provinces":           best_provinces,
            "colors":                   EkonomiAnalytics.COLORS,
            "indikator_info": {
                k: {
                    "nama":             v["nama"],
                    "satuan":           v["satuan"],
                    "penjelasan":       v["penjelasan"],
                    "bobot":            v["bobot"],
                    "threshold_tinggi": v.get("threshold_tinggi"),
                    "threshold_sedang": v.get("threshold_sedang"),
                    "threshold_rendah": v.get("threshold_rendah"),
                }
                for k, v in INDIKATOR_EKONOMI.items()
            },
            "raw_datasets": {
                "PDRB":       parsed_data.get("PDRB", {}),
                "KEMISKINAN": parsed_data.get("KEMISKINAN", {}),
                "INVESTASI":  parsed_data.get("INVESTASI", {}),
            },
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e), "message": "Gagal mengambil data dari BPS"}, status=500)


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT BARU: DATA HISTORIS UNTUK GRAFIK TREN
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
def get_historis_ekonomi(request):
    """
    GET /api/historis-ekonomi/
    Query params:
      - provinsi : nama provinsi (opsional, kalau tidak ada → data nasional agregat)
      - tahun_mulai : 2020 (default)
      - tahun_akhir : 2024 (default)
    Mengembalikan data tren per tahun untuk grafik.
    """
    if not BPS_API_KEY:
        return Response({"error": "BPS_WEB_API_KEY belum dikonfigurasi"}, status=500)

    provinsi_req  = request.GET.get("provinsi", "").upper().strip()
    tahun_mulai   = int(request.GET.get("tahun_mulai", 2020))
    tahun_akhir   = int(request.GET.get("tahun_akhir", 2024))

    # Tentukan th_codes yang diperlukan
    th_codes = [
        k for k, v in BPS_TAHUN_MAP.items()
        if tahun_mulai <= v <= tahun_akhir and k in BPS_TAHUN_URUT
    ]
    th_codes.sort(key=lambda k: BPS_TAHUN_MAP[k])  # urut dari lama ke baru

    try:
        analytics = EkonomiAnalytics()
        historis_raw = analytics.fetch_historis(th_codes)

        # Susun response per tahun
        tren = []
        for tahun_kal in sorted(historis_raw.keys()):
            data_tahun = historis_raw[tahun_kal]

            if provinsi_req:
                # Data spesifik satu provinsi
                prov_data = data_tahun.get(provinsi_req) or {}
                # Coba normalisasi jika tidak ketemu langsung
                if not prov_data:
                    for pn, pd in data_tahun.items():
                        if normalize_province_name(pn) == normalize_province_name(provinsi_req):
                            prov_data = pd
                            break
                tren.append({
                    "tahun":     tahun_kal,
                    "pdrb":      prov_data.get("PDRB"),
                    "kemiskinan":prov_data.get("KEMISKINAN"),
                    "investasi": prov_data.get("INVESTASI"),
                })
            else:
                # Agregat nasional: rata-rata semua provinsi
                pdrb_list = [v["PDRB"] for v in data_tahun.values() if v.get("PDRB") is not None]
                kem_list  = [v["KEMISKINAN"] for v in data_tahun.values() if v.get("KEMISKINAN") is not None]
                inv_list  = [v["INVESTASI"] for v in data_tahun.values() if v.get("INVESTASI") is not None]
                tren.append({
                    "tahun":      tahun_kal,
                    "pdrb":       round(sum(pdrb_list) / len(pdrb_list), 2) if pdrb_list else None,
                    "kemiskinan": round(sum(kem_list) / len(kem_list), 2) if kem_list else None,
                    "investasi":  round(sum(inv_list) / len(inv_list), 2) if inv_list else None,
                })

        return Response({
            "status":    "success",
            "provinsi":  provinsi_req or "NASIONAL",
            "tren":      tren,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: SIMPAN / LIST / DETAIL / HAPUS HASIL ANALISIS
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(["POST"])
def save_ekonomi_analysis(request):
    try:
        data          = request.data
        analysis_name = data.get("name", "Analisis Ekonomi Tanpa Nama")
        analysis_data = data.get("analysis_data")
        if not analysis_data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)

        analysis_id = str(uuid.uuid4())
        document = {
            "analysis_id": analysis_id,
            "name":        analysis_name,
            "type":        "ekonomi",
            "timestamp":   datetime.now().isoformat(),
            **analysis_data,
        }
        mongo_db["ekonomi_analysis"].insert_one(document)
        return Response({
            "status":      "success",
            "message":     f"Analisis '{analysis_name}' berhasil disimpan",
            "analysis_id": analysis_id,
            "saved_at":    document["timestamp"],
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
def get_ekonomi_analysis_list(request):
    try:
        cursor = mongo_db["ekonomi_analysis"].find(
            {},
            {"_id": 0, "analysis_id": 1, "name": 1, "timestamp": 1,
             "total_matched": 1, "kategori_distribusi": 1}
        ).sort("timestamp", -1)
        results = list(cursor)
        return Response({"status": "success", "count": len(results), "results": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
def get_ekonomi_analysis_detail(request, analysis_id):
    try:
        result = mongo_db["ekonomi_analysis"].find_one(
            {"analysis_id": analysis_id}, {"_id": 0}
        )
        if not result:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response(result)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["DELETE"])
def delete_ekonomi_analysis(request, analysis_id):
    try:
        result = mongo_db["ekonomi_analysis"].delete_one({"analysis_id": analysis_id})
        if result.deleted_count == 0:
            return Response({"error": "Analisis tidak ditemukan"}, status=404)
        return Response({"status": "success", "message": "Analisis berhasil dihapus"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)