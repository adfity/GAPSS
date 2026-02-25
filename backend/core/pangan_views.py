"""
pangan_views.py — Ketahanan Pangan Backend Views

Model YOLO dilatih custom dengan 4 kelas:
  - pepohonan  (vegetasi/hutan)
  - perairan   (sungai/danau/kolam)
  - bangunan   (gedung/permukiman)
  - jalan      (jalan raya/infrastruktur)

Formula IKPG:
  Dengan GeoAI:
    IKPG = (0.50×GeoAI_Weighted) + (0.30×Production_Score) + (0.10×Calorie_Score) + (0.10×Insecurity_Score)

  GeoAI_Weighted (4 kelas):
    raw  = (+0.40×Pepohonan%) + (+0.30×Perairan%) − (0.20×Bangunan%) − (0.10×Jalan%)
    norm = raw + 30  → range [0, 100]

  Fallback tanpa GeoAI:
    IKPG = (0.60×Production_Score) + (0.20×Calorie_Score) + (0.20×Insecurity_Score)
"""

import uuid
import requests
from datetime import datetime
from pymongo import MongoClient
from rest_framework.decorators import api_view
from rest_framework.response import Response
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
BPS_API_KEY   = os.getenv("BPS_WEB_API_KEY")

client   = MongoClient(MONGO_URI)
mongo_db = client[DB_MONGO_NAME]


# ─────────────────────────────────────────────────────────────
# KONFIGURASI INDIKATOR PANGAN
# ─────────────────────────────────────────────────────────────

INDIKATOR_PANGAN = {
    "PRODUKSI": {
        "url_template": "https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi/id/25/tahun/2024/id_tabel/ZjZ6MXlacGJNR0JaaHBPRSs0TzNUdz09/wilayah/0000000/key/{key}/",
        "nama":          "Produksi Padi",
        "satuan":        "ton",
        "bobot_fallback": 0.6,
        "penjelasan":    "Total produksi padi (ton) per provinsi tahun 2024.",
        "scoring":       "minmax",
        "format":        "v2_table",
        "var_kolom":     "mtn492ybb1",
    },
    "KALORI": {
        "url_template": "https://webapi.bps.go.id/v1/api/view/domain/0000/model/statictable/lang/ind/id/951/key/{key}/",
        "nama":          "Konsumsi Kalori",
        "satuan":        "kkal/kapita/hari",
        "bobot_fallback": 0.2,
        "penjelasan":    "Rata-rata konsumsi kalori per kapita per hari 2025, dibandingkan AKG 2100 kkal/hari.",
        "scoring":       "akg",
        "akg":           2100,
        "format":        "v1_html",
    },
    "INSECURITY": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/1473/th/125/key/{key}/",
        "nama":          "Prevalensi Ketidakcukupan Pangan",
        "satuan":        "%",
        "bobot_fallback": 0.2,
        "penjelasan":    "Persentase penduduk mengalami ketidakcukupan pangan 2025. Diinversi: semakin rendah, semakin baik.",
        "scoring":       "inverse",
        "format":        "v1_datacontent",
    },
}

# ─────────────────────────────────────────────────────────────
# FALLBACK DATA
# ─────────────────────────────────────────────────────────────

KALORI_FALLBACK_2025 = {
    "ACEH": 2027.78, "SUMATERA UTARA": 2069.98, "SUMATERA BARAT": 2079.39,
    "RIAU": 2033.81, "JAMBI": 2040.04, "SUMATERA SELATAN": 2202.46,
    "BENGKULU": 2059.99, "LAMPUNG": 2037.55,
    "KEPULAUAN BANGKA BELITUNG": 2032.92, "KEPULAUAN RIAU": 2117.91,
    "JAKARTA": 2086.14, "JAWA BARAT": 2084.82, "JAWA TENGAH": 2028.44,
    "DAERAH ISTIMEWA YOGYAKARTA": 2066.00, "JAWA TIMUR": 2091.80,
    "BANTEN": 2147.88, "BALI": 2223.68, "NUSA TENGGARA BARAT": 2447.98,
    "NUSA TENGGARA TIMUR": 1974.01, "KALIMANTAN BARAT": 1893.68,
    "KALIMANTAN TENGAH": 2113.16, "KALIMANTAN SELATAN": 2171.82,
    "KALIMANTAN TIMUR": 1934.48, "KALIMANTAN UTARA": 1870.63,
    "SULAWESI UTARA": 2050.93, "SULAWESI TENGAH": 2016.05,
    "SULAWESI SELATAN": 2092.11, "SULAWESI TENGGARA": 1991.33,
    "GORONTALO": 1986.54, "SULAWESI BARAT": 2065.19,
    "MALUKU": 1852.28, "MALUKU UTARA": 1825.77,
    "PAPUA BARAT": 1813.42, "PAPUA BARAT DAYA": 1800.38,
    "PAPUA": 1744.82, "PAPUA SELATAN": 1874.55,
    "PAPUA TENGAH": 1760.35, "PAPUA PEGUNUNGAN": 2115.15,
}

PRODUKSI_FALLBACK_2024 = {
    "ACEH": 1659966.28, "SUMATERA UTARA": 2204875.51,
    "SUMATERA BARAT": 1356467.93, "RIAU": 222055.71,
    "JAMBI": 281022.05, "SUMATERA SELATAN": 2909411.67,
    "BENGKULU": 272848.55, "LAMPUNG": 2791347.53,
    "KEPULAUAN BANGKA BELITUNG": 77489.79, "KEPULAUAN RIAU": 305.09,
    "JAKARTA": 2306.54, "JAWA BARAT": 8626879.91,
    "JAWA TENGAH": 8891297.05, "DAERAH ISTIMEWA YOGYAKARTA": 452831.77,
    "JAWA TIMUR": 9270435.29, "BANTEN": 1550623.46,
    "BALI": 635473.35, "NUSA TENGGARA BARAT": 1453408.37,
    "NUSA TENGGARA TIMUR": 707792.54, "KALIMANTAN BARAT": 764784.15,
    "KALIMANTAN TENGAH": 366146.82, "KALIMANTAN SELATAN": 1029567.93,
    "KALIMANTAN TIMUR": 249642.90, "KALIMANTAN UTARA": 30079.77,
    "SULAWESI UTARA": 273134.94, "SULAWESI TENGAH": 761936.39,
    "SULAWESI SELATAN": 4818429.39, "SULAWESI TENGGARA": 555836.08,
    "GORONTALO": 234862.88, "SULAWESI BARAT": 318876.59,
    "MALUKU": 91125.35, "MALUKU UTARA": 31232.95,
    "PAPUA BARAT": 20729.15, "PAPUA BARAT DAYA": 988.64,
    "PAPUA": 4609.95, "PAPUA SELATAN": 217789.62,
    "PAPUA TENGAH": 6072.38, "PAPUA PEGUNUNGAN": 42.38,
}

# ─────────────────────────────────────────────────────────────
# BOBOT
# ─────────────────────────────────────────────────────────────
BOBOT_IKPG = {"geoai": 0.50, "produksi": 0.30, "kalori": 0.10, "insecurity": 0.10}

# GeoAI 4 kelas: positif = mendukung ekosistem pertanian, negatif = alih fungsi
BOBOT_GEOAI = {
    "pepohonan": +0.40,  # tutupan hijau → ekosistem subur
    "perairan":  +0.30,  # sumber air / irigasi
    "bangunan":  -0.20,  # alih fungsi lahan (penalti besar)
    "jalan":     -0.10,  # infrastruktur (penalti kecil)
}

# ─────────────────────────────────────────────────────────────
# MAPPING KATEGORI 4 KELAS YOLO
# ─────────────────────────────────────────────────────────────
KATEGORI_LAHAN_MAP = {
    "pepohonan": [
        "pepohonan", "vegetasi", "hutan", "pohon", "hijau",
        "tree", "forest", "woodland", "plantation", "mangrove", "bakau",
        "vegetation", "greenery", "shrub", "semak",
    ],
    "perairan": [
        "perairan", "air", "sungai", "danau", "laut", "kolam",
        "water", "river", "lake", "sea", "pond", "wetland",
        "rawa", "teluk", "pantai", "estuari", "irigasi",
    ],
    "bangunan": [
        "bangunan", "gedung", "rumah", "permukiman", "infrastruktur",
        "building", "house", "rooftop", "urban", "settlement",
        "industri", "pabrik", "gudang", "residential", "commercial",
    ],
    "jalan": [
        "jalan", "jalan raya", "jalur", "road", "highway",
        "street", "path", "track", "rel", "kereta", "aspal",
    ],
}


# ─────────────────────────────────────────────────────────────
# NORMALISASI PROVINSI
# ─────────────────────────────────────────────────────────────

ALIAS_PROVINSI = {
    "DKI JAKARTA": "JAKARTA",
    "DAERAH KHUSUS IBUKOTA JAKARTA": "JAKARTA",
    "DAERAH KHUSUS JAKARTA": "JAKARTA",
    "DI YOGYAKARTA": "DAERAH ISTIMEWA YOGYAKARTA",
    "D.I. YOGYAKARTA": "DAERAH ISTIMEWA YOGYAKARTA",
    "D.I YOGYAKARTA": "DAERAH ISTIMEWA YOGYAKARTA",
    "DIY": "DAERAH ISTIMEWA YOGYAKARTA",
    "YOGYAKARTA": "DAERAH ISTIMEWA YOGYAKARTA",
    "KEP. BANGKA BELITUNG": "KEPULAUAN BANGKA BELITUNG",
    "BANGKA BELITUNG": "KEPULAUAN BANGKA BELITUNG",
    "KEP. RIAU": "KEPULAUAN RIAU",
    "NTB": "NUSA TENGGARA BARAT",
    "NTT": "NUSA TENGGARA TIMUR",
}


def normalize_provinsi(name):
    if not name:
        return ""
    name = str(name).upper().strip()
    for key, val in ALIAS_PROVINSI.items():
        if key in name:
            return val
    for prefix in ["PROVINSI ", "PROV. ", "PROV "]:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name.strip()


def match_provinsi(query, dataset):
    q = normalize_provinsi(query)
    if q in dataset:
        return dataset[q]
    for k, v in dataset.items():
        if normalize_provinsi(k) == q:
            return v
    for k, v in dataset.items():
        kn = normalize_provinsi(k)
        if q in kn or kn in q:
            return v
    return None


# ─────────────────────────────────────────────────────────────
# BPS FETCH & PARSE
# ─────────────────────────────────────────────────────────────

def fetch_bps_data(key):
    url = INDIKATOR_PANGAN[key]["url_template"].format(key=BPS_API_KEY)
    print(f"  Fetching {key}: {url}")
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            print(f"  ✓ {key}: OK")
            return r.json()
        print(f"  ✗ {key}: HTTP {r.status_code}")
        return None
    except Exception as e:
        print(f"  ✗ {key}: {e}")
        return None


def parse_bps_v2_table(raw_data, var_kolom):
    result = {}
    if not raw_data:
        return result
    try:
        outer = raw_data.get("data", {})
        rows  = outer[1].get("data", []) if isinstance(outer, list) and len(outer) >= 2 else \
                outer.get("data", []) if isinstance(outer, dict) else []
        for row in rows:
            label = row.get("label", "").strip()
            kode  = str(row.get("kode_wilayah", ""))
            if kode == "0000000" or label.upper() in ("INDONESIA", ""):
                continue
            col = row.get("variables", {}).get(var_kolom, {})
            raw = col.get("value_raw", col.get("value", ""))
            if not raw or str(raw).strip() in ("...", "–", "-", "NA", ""):
                continue
            try:
                val = float(str(raw).replace(".", "").replace(",", "."))
                result[normalize_provinsi(label)] = round(val, 2)
            except (ValueError, TypeError):
                continue
        print(f"  v2_table: {len(result)} provinces")
    except Exception as e:
        import traceback; traceback.print_exc()
    return result


def parse_bps_html_kalori(raw_data):
    import re, html as htmllib
    result = {}
    if not raw_data:
        return result
    try:
        d = raw_data.get("data", {})
        html_str = d.get("table", "") if isinstance(d, dict) else \
                   (d[0].get("table", "") if isinstance(d, list) and d and isinstance(d[0], dict) else "")
        if not html_str:
            return result
        decoded = htmllib.unescape(html_str)
        for row_html in re.findall(r'<tr[^>]*>(.*?)</tr>', decoded, re.DOTALL):
            pm = re.search(r'class=xl[68][69]5943[^>]*>(.*?)</td>', row_html, re.DOTALL)
            if not pm:
                continue
            prov = re.sub(r'\s+', ' ', pm.group(1)).strip()
            if not prov or prov.upper() == "INDONESIA":
                continue
            km = re.search(r'class=xl885943[^>]*>([\d\s,.]+)</td>', row_html)
            if not km:
                continue
            try:
                val = float(km.group(1).strip().replace(" ", "").replace(",", "."))
                result[normalize_provinsi(prov)] = round(val, 2)
            except (ValueError, TypeError):
                continue
        print(f"  HTML kalori: {len(result)} provinces")
    except Exception as e:
        import traceback; traceback.print_exc()
    return result


def parse_bps_province_data(raw_data, key):
    result = {}
    if not raw_data:
        return result
    try:
        dc   = raw_data.get("datacontent", {})
        vvl  = raw_data.get("vervar", [])
        if not dc:
            return result
        codes = sorted(
            [(str(i.get("val","")), i.get("label","")) for i in vvl
             if str(i.get("val","")) not in ("0","9999","0000") and i.get("label")],
            key=lambda x: len(x[0]), reverse=True
        )
        if not codes:
            return result
        temp = {}
        for k, v in dc.items():
            if v is None:
                continue
            try:
                fv = float(v)
            except (TypeError, ValueError):
                continue
            for code, label in codes:
                if k.startswith(code):
                    temp.setdefault(normalize_provinsi(label), []).append(fv)
                    break
        for pn, vals in temp.items():
            result[pn] = round(sum(vals) / len(vals), 2)
        print(f"  datacontent: {len(result)} provinces for {key}")
    except Exception as e:
        import traceback; traceback.print_exc()
    return result


def fetch_all_bps_pangan():
    print("=== Fetching BPS ===")
    parsed = {}
    for key, cfg in INDIKATOR_PANGAN.items():
        raw = fetch_bps_data(key)
        fmt = cfg.get("format", "v1_datacontent")
        if fmt == "v2_table":
            parsed[key] = parse_bps_v2_table(raw, cfg.get("var_kolom", "")) if raw else {}
        elif key == "KALORI":
            r = parse_bps_html_kalori(raw) if raw else {}
            parsed[key] = r or (parse_bps_province_data(raw, key) if raw else {})
        else:
            parsed[key] = parse_bps_province_data(raw, key) if raw else {}
    if not parsed.get("PRODUKSI"):
        parsed["PRODUKSI"] = dict(PRODUKSI_FALLBACK_2024)
    if not parsed.get("KALORI"):
        parsed["KALORI"] = dict(KALORI_FALLBACK_2025)
    return parsed


# ─────────────────────────────────────────────────────────────
# GEOAI STATS (4 kelas)
# ─────────────────────────────────────────────────────────────

def get_geoai_stats_for_provinsi(provinsi_name):
    try:
        docs = list(mongo_db["ai_features"].find(
            {"provinsi": {"$regex": provinsi_name, "$options": "i"}},
            {"_id": 0, "kategori": 1, "luas_m2": 1, "metadata": 1}
        ))
        if not docs:
            return None

        stats = {"pepohonan_m2": 0, "perairan_m2": 0, "bangunan_m2": 0, "jalan_m2": 0, "count": len(docs)}
        for doc in docs:
            kat  = str(doc.get("kategori", "")).lower().strip()
            luas = doc.get("metadata", {}).get("luas_estimasi") or doc.get("luas_m2") or 0
            try:
                luas = float(luas)
            except (TypeError, ValueError):
                luas = 0
            mapped = False
            for group, kws in KATEGORI_LAHAN_MAP.items():
                if any(kw in kat for kw in kws):
                    stats[f"{group}_m2"] += luas
                    mapped = True
                    break
            if not mapped:
                print(f"  ⚠ kategori '{kat}' tidak dikenali, dilewati")

        stats["total_luas_m2"] = stats["pepohonan_m2"] + stats["perairan_m2"] + \
                                  stats["bangunan_m2"]  + stats["jalan_m2"]
        return stats
    except Exception as e:
        print(f"  GeoAI error: {e}")
        return None


def load_boundary_map():
    feats = list(mongo_db["batas_provinsi"].find({}, {"_id": 0}))
    if not feats:
        feats = list(mongo_db["batas_wilayah"].find(
            {"$or": [{"properties.level": "province"}, {"properties.name": {"$exists": True}}]},
            {"_id": 0}
        ))
    bmap = {}
    for f in feats:
        name = f.get("properties", {}).get("name", "")
        if name:
            bmap[normalize_provinsi(name)] = f
            bmap[str(name).upper().strip()] = f
    print(f"  Boundaries loaded: {len(feats)}")
    return bmap


def find_boundary(prov_norm, bmap):
    if prov_norm in bmap:
        return bmap[prov_norm]
    for k, f in bmap.items():
        if prov_norm in k or k in prov_norm:
            return f
    return None


# ─────────────────────────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────────────────────────

def hitung_production_score(nilai, semua):
    if nilai is None or not semua:
        return None
    vals = [v for v in semua.values() if v is not None]
    if not vals:
        return None
    mn, mx = min(vals), max(vals)
    return 50.0 if mx == mn else round(((nilai - mn) / (mx - mn)) * 100, 2)


def hitung_calorie_score(nilai, akg=2100):
    if nilai is None:
        return None
    return round(min((nilai / akg) * 100, 100), 2)


def hitung_insecurity_score(nilai):
    if nilai is None:
        return None
    return round(max(100 - nilai, 0), 2)


def hitung_geoai_weighted(stats):
    """
    GeoAI Weighted Score (4 kelas).
    raw  = (+0.40×Pepohonan%) + (+0.30×Perairan%) − (0.20×Bangunan%) − (0.10×Jalan%)
    norm = clamp(raw + 30, 0, 100)
    Offset +30 agar skenario terburuk (100% bangunan → raw=-20) → skor ~10.
    """
    if not stats:
        return None, {}, False
    total = stats.get("pepohonan_m2", 0) + stats.get("perairan_m2", 0) + \
            stats.get("bangunan_m2",  0) + stats.get("jalan_m2",    0)
    if total <= 0:
        return None, {}, False

    proporsi = {
        "pepohonan": round(stats["pepohonan_m2"] / total * 100, 2),
        "perairan":  round(stats["perairan_m2"]  / total * 100, 2),
        "bangunan":  round(stats["bangunan_m2"]  / total * 100, 2),
        "jalan":     round(stats["jalan_m2"]     / total * 100, 2),
    }
    raw  = sum(BOBOT_GEOAI[k] * proporsi[k] for k in BOBOT_GEOAI)
    norm = round(max(min(raw + 30, 100), 0), 2)
    return norm, proporsi, True


def hitung_ikpg(geoai, prod, kalori, insec):
    if geoai is not None:
        bobot  = BOBOT_IKPG.copy()
        scores = {"geoai": geoai, "produksi": prod or 0, "kalori": kalori or 0, "insecurity": insec or 0}
    else:
        bobot  = {"geoai": 0.0, "produksi": INDIKATOR_PANGAN["PRODUKSI"]["bobot_fallback"],
                  "kalori": INDIKATOR_PANGAN["KALORI"]["bobot_fallback"],
                  "insecurity": INDIKATOR_PANGAN["INSECURITY"]["bobot_fallback"]}
        scores = {"geoai": 0, "produksi": prod or 0, "kalori": kalori or 0, "insecurity": insec or 0}

    ikpg = round(max(min(sum(bobot[k] * scores[k] for k in bobot), 100), 0), 2)
    if ikpg >= 70:
        return ikpg, "Tinggi", "#10b981", "🟢", bobot, geoai is not None
    elif ikpg >= 40:
        return ikpg, "Sedang", "#f59e0b", "🟡", bobot, geoai is not None
    return ikpg, "Rendah", "#ef4444", "🔴", bobot, geoai is not None


def generate_rekomendasi(proporsi, prod, kal, insec, ikpg, status):
    rekom = []
    if proporsi:
        b, p, pp, j = (proporsi.get(k, 0) for k in ("bangunan","perairan","pepohonan","jalan"))
        if b > 40:
            rekom.append({"kategori": "Tata Ruang",  "icon": "🏗️",
                "pesan": f"Bangunan {b:.1f}% — Alih fungsi lahan tinggi, perkuat regulasi tata ruang."})
        if p < 10:
            rekom.append({"kategori": "Irigasi",     "icon": "💧",
                "pesan": f"Perairan {p:.1f}% — Prioritaskan pembangunan jaringan irigasi."})
        if pp < 20:
            rekom.append({"kategori": "Ekosistem",   "icon": "🌳",
                "pesan": f"Vegetasi {pp:.1f}% — Dorong program penghijauan untuk kesuburan tanah."})
        if j > 30:
            rekom.append({"kategori": "Tata Wilayah","icon": "🛣️",
                "pesan": f"Jalan {j:.1f}% — Dominasi infrastruktur tinggi, jaga lahan produktif."})
    if prod is not None:
        if prod < 30:
            rekom.append({"kategori": "Produksi Pangan","icon": "🌾",
                "pesan": f"Skor produksi rendah ({prod:.1f}) — Intensifikasi: benih unggul, pupuk, mekanisasi."})
        elif prod < 60:
            rekom.append({"kategori": "Produksi Pangan","icon": "📈",
                "pesan": f"Skor produksi sedang ({prod:.1f}) — Tingkatkan dengan teknologi presisi."})
    if kal is not None and kal < 80:
        rekom.append({"kategori": "Konsumsi Kalori","icon": "🍽️",
            "pesan": f"Kalori di bawah optimal ({kal:.1f}/100) — Perkuat diversifikasi pangan."})
    if insec is not None and insec < 80:
        rekom.append({"kategori": "Kerawanan Pangan","icon": "⚠️",
            "pesan": f"Prevalensi insecurity {100-insec:.1f}% — Percepat distribusi bantuan pangan."})
    labels = {"Rendah":("🔴","Kategori RENDAH. Diperlukan intervensi segera."),
              "Sedang":("🟡","Kategori SEDANG. Perkuat program berjalan."),
              "Tinggi":("🟢","Kategori TINGGI. Pertahankan dan jadikan model.")}
    ic, msg = labels.get(status, ("⚪",""))
    rekom.append({"kategori": "Status IKPG","icon": ic,"pesan": f"IKPG {ikpg} — {msg}"})
    return rekom


def _get_metodologi():
    return {
        "judul":         "Metodologi IKPG (Indeks Ketahanan Pangan Gabungan)",
        "kelas_geoai":   "4 kelas YOLO custom: pepohonan, perairan, bangunan, jalan",
        "formula_utama": "IKPG = (0.50×GeoAI) + (0.30×Produksi) + (0.10×Kalori) + (0.10×Insecurity)",
        "formula_geoai": "GeoAI = clamp((+0.40×Pepohonan%) + (+0.30×Perairan%) − (0.20×Bangunan%) − (0.10×Jalan%) + 30, 0, 100)",
        "formula_fb":    "IKPG = (0.60×Produksi) + (0.20×Kalori) + (0.20×Insecurity)  [tanpa GeoAI]",
        "indikator": [
            {"kode":"GeoAI",     "nama":"GeoAI Weighted (4 kelas)","bobot":"50%","sumber":"YOLO — MongoDB ai_features"},
            {"kode":"PRODUKSI",  "nama":"Produksi Padi",           "bobot":"30%","sumber":"BPS mms/557, 2024"},
            {"kode":"KALORI",    "nama":"Konsumsi Kalori",         "bobot":"10%","sumber":"BPS Var 951, 2025"},
            {"kode":"INSECURITY","nama":"Prevalensi Insecurity",   "bobot":"10%","sumber":"BPS Var 1473, 2025"},
        ],
    }


# ─────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
def analyze_food_security_bps(request):
    if not BPS_API_KEY:
        return Response({"error": "BPS_WEB_API_KEY belum dikonfigurasi"}, status=500)
    provinsi    = request.data.get("provinsi", "").strip()
    geoai_stats = request.data.get("geoai_stats")
    if not provinsi:
        return Response({"error": "Parameter 'provinsi' wajib diisi"}, status=400)
    try:
        parsed = fetch_all_bps_pangan()
        prod_r  = match_provinsi(provinsi, parsed["PRODUKSI"])
        kal_r   = match_provinsi(provinsi, parsed["KALORI"])
        insec_r = match_provinsi(provinsi, parsed["INSECURITY"])
        prod_s  = hitung_production_score(prod_r, parsed["PRODUKSI"])
        kal_s   = hitung_calorie_score(kal_r)
        insec_s = hitung_insecurity_score(insec_r)
        if not geoai_stats:
            geoai_stats = get_geoai_stats_for_provinsi(provinsi)
        geoai_s, proporsi, has_geoai = hitung_geoai_weighted(geoai_stats)
        ikpg, status, warna, icon, bobot, has_geoai = hitung_ikpg(geoai_s, prod_s, kal_s, insec_s)
        return Response({
            "provinsi": provinsi, "ikpg": ikpg, "status": status,
            "status_warna": warna, "status_icon": icon, "has_geoai_data": has_geoai,
            "komponen": {"geoai_weighted": geoai_s, "production_score": prod_s,
                         "calorie_score": kal_s, "insecurity_score": insec_s},
            "bobot_used": bobot, "proporsi_lahan": proporsi or {},
            "bps_raw": {"produksi_padi_ton": prod_r, "kalori_kkal_perhari": kal_r,
                        "prevalensi_insecurity_persen": insec_r,
                        "tahun_produksi": 2024, "tahun_kalori": 2025,
                        "tahun_insecurity": 2025, "sumber": "BPS Web API"},
            "rekomendasi": generate_rekomendasi(proporsi, prod_s, kal_s, insec_s, ikpg, status),
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def analyze_all_provinces_bps(request):
    if not BPS_API_KEY:
        return Response({"error": "BPS_WEB_API_KEY belum dikonfigurasi"}, status=500)
    try:
        parsed = fetch_all_bps_pangan()
        bmap   = load_boundary_map()

        if bmap:
            seen, master = set(), []
            for fd in mongo_db["batas_provinsi"].find({}, {"_id": 0, "properties": 1}):
                n = fd.get("properties", {}).get("name", "")
                if n:
                    nm = normalize_provinsi(n)
                    if nm not in seen:
                        seen.add(nm); master.append(nm)
        else:
            master = [p for p in parsed.get("INSECURITY", {}).keys() if len(p) > 4]

        matched, summary, counts = [], [], {"Tinggi": 0, "Sedang": 0, "Rendah": 0}

        for prov in sorted(master):
            pr, kr, ir = (parsed["PRODUKSI"].get(prov), parsed["KALORI"].get(prov),
                          parsed["INSECURITY"].get(prov))
            if all(v is None for v in [pr, kr, ir]):
                continue
            ps  = hitung_production_score(pr, parsed["PRODUKSI"])
            ks  = hitung_calorie_score(kr)
            iss = hitung_insecurity_score(ir)
            gs, prop, hg = hitung_geoai_weighted(get_geoai_stats_for_provinsi(prov))
            ikpg, status, warna, icon, bobot, hg = hitung_ikpg(gs, ps, ks, iss)
            counts[status] = counts.get(status, 0) + 1
            ad = {
                "nama_provinsi": prov, "ikpg": ikpg, "status": status,
                "warna": warna, "icon": icon, "has_geoai_data": hg,
                "komponen": {"geoai_weighted": gs, "production_score": ps,
                             "calorie_score": ks, "insecurity_score": iss},
                "bps_raw": {"produksi_padi_ton": pr, "kalori_kkal_perhari": kr,
                            "prevalensi_insecurity_persen": ir},
                "proporsi_lahan": prop,
                "rekomendasi": generate_rekomendasi(prop, ps, ks, iss, ikpg, status),
            }
            summary.append(ad)
            b = find_boundary(prov, bmap)
            if b:
                matched.append({
                    "type": b.get("type", "Feature"),
                    "properties": {**b.get("properties", {}), "food_analysis": ad},
                    "geometry": b.get("geometry", {}),
                })

        vals = [s["ikpg"] for s in summary if s["ikpg"] is not None]
        avg  = round(sum(vals) / len(vals), 2) if vals else None

        return Response({
            "status": "success", "source": "BPS Web API",
            "total_provinces": len(summary), "total_matched": len(matched),
            "status_distribusi": counts, "national_avg_ikpg": avg,
            "summary": summary,
            "geojson": {"type": "FeatureCollection", "features": matched},
            "metodologi": _get_metodologi(),
            "indikator_info": {k: {"nama": v["nama"], "satuan": v["satuan"],
                                   "penjelasan": v["penjelasan"]}
                               for k, v in INDIKATOR_PANGAN.items()},
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def save_food_security_analysis(request):
    try:
        data = request.data
        if not data.get("provinsi"):
            return Response({"error": "Data tidak lengkap"}, status=400)
        aid  = str(uuid.uuid4())
        doc  = {"analysis_id": aid, "timestamp": datetime.now().isoformat(), **data}
        mongo_db["pangan_analisis"].insert_one(doc)
        return Response({"status": "success", "analysis_id": aid, "saved_at": doc["timestamp"]})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_food_security_analysis_list(request):
    try:
        prov  = request.query_params.get("provinsi")
        limit = int(request.query_params.get("limit", 20))
        page  = int(request.query_params.get("page", 1))
        skip  = (page - 1) * limit
        q     = {"provinsi": {"$regex": prov, "$options": "i"}} if prov else {}
        cur   = mongo_db["pangan_analisis"].find(q, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit)
        total = mongo_db["pangan_analisis"].count_documents(q)
        return Response({"status": "success", "total": total, "page": page, "limit": limit, "results": list(cur)})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_food_security_analysis_detail(request, analysis_id):
    try:
        r = mongo_db["pangan_analisis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        if not r:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response(r)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_food_security_analysis(request, analysis_id):
    try:
        res = mongo_db["pangan_analisis"].delete_one({"analysis_id": analysis_id})
        if res.deleted_count == 0:
            return Response({"error": "Tidak ditemukan"}, status=404)
        return Response({"status": "success", "message": "Berhasil dihapus"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def debug_bps_raw(request):
    if not BPS_API_KEY:
        return Response({"error": "BPS_WEB_API_KEY belum dikonfigurasi"}, status=500)
    key = request.query_params.get("indikator", "PRODUKSI")
    if key not in INDIKATOR_PANGAN:
        return Response({"error": f"indikator harus: {list(INDIKATOR_PANGAN.keys())}"}, status=400)
    try:
        raw = fetch_bps_data(key)
        if not raw:
            return Response({"error": "Gagal fetch"}, status=500)
        dc      = raw.get("datacontent", {})
        vv      = raw.get("vervar", [])
        parsed  = parse_bps_province_data(raw, key)
        return Response({
            "indikator": key,
            "url": INDIKATOR_PANGAN[key]["url_template"].format(key="[HIDDEN]"),
            "datacontent_total": len(dc), "vervar_total": len(vv),
            "sample_dc": dict(list(dc.items())[:10]),
            "sample_vv": vv[:10],
            "parsed_count": len(parsed),
            "parsed_sample": dict(list(parsed.items())[:10]),
        })
    except Exception as e:
        import traceback
        return Response({"error": str(e), "traceback": traceback.format_exc()}, status=500)