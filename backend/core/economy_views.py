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

# ── Load .env dari path yang benar (sama seperti migrate_bank_kebijakan.py) ──
base_dir    = os.path.dirname(__file__)
dotenv_path = os.path.abspath(os.path.join(base_dir, '..', '..', '.env'))
load_dotenv(dotenv_path)

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
BPS_API_KEY   = os.getenv("BPS_WEB_API_KEY")

client   = MongoClient(MONGO_URI)
mongo_db = client[DB_MONGO_NAME]

# ── Koneksi PostgreSQL (tanpa fallback hardcoded, murni dari .env) ────────────
def get_pg_connection():
    return psycopg2.connect(
        host     = os.getenv("DB_HOST"),
        port     = int(os.getenv("DB_PORT", "5432")),
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# KONFIGURASI INDIKATOR EKONOMI
# ═══════════════════════════════════════════════════════════════════════════════
INDIKATOR_EKONOMI = {
    "PDRB": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/534/th/125/key/{key}/",
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
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/192/th/125/key/{key}/",
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
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/793/th/123/key/{key}/",
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
                FROM bank_kebijakan_ekonomi
                WHERE kategori_utama = %s
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

    def fetch_all_data(self):
        all_data = {}
        for key, cfg in INDIKATOR_EKONOMI.items():
            try:
                url  = cfg["url_template"].format(key=BPS_API_KEY)
                resp = requests.get(url, timeout=30)
                all_data[key] = resp.json() if resp.status_code == 200 else None
                status = "✓" if resp.status_code == 200 else f"✗ HTTP {resp.status_code}"
                print(f"  {status} {key}")
            except Exception as e:
                print(f"  ✗ {key}: {e}")
                all_data[key] = None
        return all_data

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
      - kategori   : TERTINGGAL | BERKEMBANG | MAJU | PDRB_RENDAH | KEMISKINAN_TINGGI | INVESTASI_RENDAH
      - limit      : jumlah aksi (default 50, max 300)
      - sub_sektor : filter opsional
    """
    kategori   = request.GET.get("kategori", "").upper().strip()
    limit      = min(int(request.GET.get("limit", 50)), 300)
    sub_sektor = request.GET.get("sub_sektor", "").strip()

    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        where_clauses = []
        params        = []

        if kategori:
            where_clauses.append("kategori_utama = %s")
            params.append(kategori)
        if sub_sektor:
            where_clauses.append("sub_sektor ILIKE %s")
            params.append(f"%{sub_sektor}%")

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        params.append(limit)

        cur.execute(f"""
            SELECT id, kategori_utama, sub_sektor, prioritas, no_aksi,
                   nama_aksi, detail_aksi, timeline, budget_est,
                   sektor_terkait, indikator_dampak
            FROM bank_kebijakan_ekonomi
            {where_sql}
            ORDER BY no_aksi ASC
            LIMIT %s
        """, params)

        docs = [dict(row) for row in cur.fetchall()]

        cur.execute("""
            SELECT kategori_utama, COUNT(*) as jumlah
            FROM bank_kebijakan_ekonomi
            GROUP BY kategori_utama
            ORDER BY kategori_utama
        """)
        distribusi = {row["kategori_utama"]: row["jumlah"] for row in cur.fetchall()}

        cur.close()

        return Response({
            "status":     "success",
            "total":      len(docs),
            "filter":     {"kategori": kategori, "sub_sektor": sub_sektor},
            "distribusi": distribusi,
            "data":       docs,
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn:
            conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT: ANALISIS EKONOMI BPS
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(["POST"])
def analyze_ekonomi_bps(request):
    """Analisis data ekonomi menggunakan BPS Web API dengan 3 indikator."""

    if not BPS_API_KEY:
        return Response({
            "error":   "BPS Web API Key belum dikonfigurasi",
            "message": "Tambahkan BPS_WEB_API_KEY di file .env",
        }, status=500)

    try:
        analytics = EkonomiAnalytics()

        print("=== Fetch data dari BPS ===")
        raw_data = analytics.fetch_all_data()

        print("\n=== Parse data per provinsi ===")
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

        print(f"\n=== Selesai: {len(matched_features)} provinsi ===")
        print(f"  MAJU={kategori_counts['MAJU']} | BERKEMBANG={kategori_counts['BERKEMBANG']} | TERTINGGAL={kategori_counts['TERTINGGAL']}")

        return Response({
            "status":                   "success",
            "source":                   "BPS Web API + PostgreSQL Bank Kebijakan",
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