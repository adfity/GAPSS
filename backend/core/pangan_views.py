"""
pangan_views.py — Backend Ketahanan Pangan (IKPG)

Model YOLO custom 4 kelas: pepohonan, perairan, bangunan, jalan

Formula IKPG:
  Dengan GeoAI : IKPG = 0.50×GeoAI + 0.30×Produksi + 0.10×Kalori + 0.10×Insecurity
  Tanpa GeoAI  : IKPG = 0.60×Produksi + 0.20×Kalori + 0.20×Insecurity

  GeoAI = clamp((+0.40×Pepohonan%) + (+0.30×Perairan%) - (0.20×Bangunan%) - (0.10×Jalan%) + 30, 0, 100)
"""

import re
import html as htmllib
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


# Konfigurasi -

INDIKATOR_PANGAN = {
    "PRODUKSI": {
        "url_template": (
            "https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi"
            "/id/25/tahun/2024/id_tabel/ZjZ6MXlacGJNR0JaaHBPRSs0TzNUdz09"
            "/wilayah/0000000/key/{key}/"
        ),
        "nama": "Produksi Padi", "satuan": "ton", "bobot_fallback": 0.6,
        "scoring": "minmax", "format": "v2_table", "var_kolom": "mtn492ybb1",
        "penjelasan": "Total produksi padi (ton) per provinsi tahun 2024.",
    },
    "KALORI": {
        "url_template": (
            "https://webapi.bps.go.id/v1/api/view/domain/0000/model/statictable"
            "/lang/ind/id/951/key/{key}/"
        ),
        "nama": "Konsumsi Kalori", "satuan": "kkal/kapita/hari",
        "bobot_fallback": 0.2, "scoring": "akg", "akg": 2100, "format": "v1_html",
        "penjelasan": "Rata-rata konsumsi kalori per kapita per hari 2025, dibandingkan AKG 2100 kkal/hari.",
    },
    "INSECURITY": {
        "url_template": (
            "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000"
            "/var/1473/th/125/key/{key}/"
        ),
        "nama": "Prevalensi Ketidakcukupan Pangan", "satuan": "%",
        "bobot_fallback": 0.2, "scoring": "inverse", "format": "v1_datacontent",
        "penjelasan": "Persentase penduduk mengalami ketidakcukupan pangan 2025. Diinversi: semakin rendah prevalensi, semakin baik.",
    },
}

BOBOT_IKPG  = {"geoai": 0.50, "produksi": 0.30, "kalori": 0.10, "insecurity": 0.10}
BOBOT_GEOAI = {"pepohonan": +0.40, "perairan": +0.30, "bangunan": -0.20, "jalan": -0.10}

KATEGORI_LAHAN_MAP = {
    "pepohonan": ["pepohonan","vegetasi","hutan","pohon","hijau","tree","forest",
                  "woodland","plantation","mangrove","bakau","vegetation","greenery","shrub","semak"],
    "perairan":  ["perairan","air","sungai","danau","laut","kolam","water","river",
                  "lake","sea","pond","wetland","rawa","teluk","pantai","estuari","irigasi"],
    "bangunan":  ["bangunan","gedung","rumah","permukiman","infrastruktur","building",
                  "house","rooftop","urban","settlement","industri","pabrik","gudang","residential","commercial"],
    "jalan":     ["jalan","jalan raya","jalur","road","highway","street","path","track","rel","kereta","aspal"],
}


# Fallback Data BPS -

KALORI_FALLBACK_2025 = {
    "ACEH": 2027.78,               "SUMATERA UTARA": 2069.98,
    "SUMATERA BARAT": 2079.39,     "RIAU": 2033.81,
    "JAMBI": 2040.04,              "SUMATERA SELATAN": 2202.46,
    "BENGKULU": 2059.99,           "LAMPUNG": 2037.55,
    "KEPULAUAN BANGKA BELITUNG": 2032.92,
    "KEPULAUAN RIAU": 2117.91,     "JAKARTA": 2086.14,
    "JAWA BARAT": 2084.82,         "JAWA TENGAH": 2028.44,
    "DAERAH ISTIMEWA YOGYAKARTA": 2066.00,
    "JAWA TIMUR": 2091.80,         "BANTEN": 2147.88,
    "BALI": 2223.68,               "NUSA TENGGARA BARAT": 2447.98,
    "NUSA TENGGARA TIMUR": 1974.01,"KALIMANTAN BARAT": 1893.68,
    "KALIMANTAN TENGAH": 2113.16,  "KALIMANTAN SELATAN": 2171.82,
    "KALIMANTAN TIMUR": 1934.48,   "KALIMANTAN UTARA": 1870.63,
    "SULAWESI UTARA": 2050.93,     "SULAWESI TENGAH": 2016.05,
    "SULAWESI SELATAN": 2092.11,   "SULAWESI TENGGARA": 1991.33,
    "GORONTALO": 1986.54,          "SULAWESI BARAT": 2065.19,
    "MALUKU": 1852.28,             "MALUKU UTARA": 1825.77,
    "PAPUA BARAT": 1813.42,        "PAPUA BARAT DAYA": 1800.38,
    "PAPUA": 1744.82,              "PAPUA SELATAN": 1874.55,
    "PAPUA TENGAH": 1760.35,       "PAPUA PEGUNUNGAN": 2115.15,
}

PRODUKSI_FALLBACK_2024 = {
    "ACEH": 1659966.28,            "SUMATERA UTARA": 2204875.51,
    "SUMATERA BARAT": 1356467.93,  "RIAU": 222055.71,
    "JAMBI": 281022.05,            "SUMATERA SELATAN": 2909411.67,
    "BENGKULU": 272848.55,         "LAMPUNG": 2791347.53,
    "KEPULAUAN BANGKA BELITUNG": 77489.79,
    "KEPULAUAN RIAU": 305.09,      "JAKARTA": 2306.54,
    "JAWA BARAT": 8626879.91,      "JAWA TENGAH": 8891297.05,
    "DAERAH ISTIMEWA YOGYAKARTA": 452831.77,
    "JAWA TIMUR": 9270435.29,      "BANTEN": 1550623.46,
    "BALI": 635473.35,             "NUSA TENGGARA BARAT": 1453408.37,
    "NUSA TENGGARA TIMUR": 707792.54,
    "KALIMANTAN BARAT": 764784.15, "KALIMANTAN TENGAH": 366146.82,
    "KALIMANTAN SELATAN": 1029567.93,
    "KALIMANTAN TIMUR": 249642.90, "KALIMANTAN UTARA": 30079.77,
    "SULAWESI UTARA": 273134.94,   "SULAWESI TENGAH": 761936.39,
    "SULAWESI SELATAN": 4818429.39,"SULAWESI TENGGARA": 555836.08,
    "GORONTALO": 234862.88,        "SULAWESI BARAT": 318876.59,
    "MALUKU": 91125.35,            "MALUKU UTARA": 31232.95,
    "PAPUA BARAT": 20729.15,       "PAPUA BARAT DAYA": 988.64,
    "PAPUA": 4609.95,              "PAPUA SELATAN": 217789.62,
    "PAPUA TENGAH": 6072.38,       "PAPUA PEGUNUNGAN": 42.38,
}

INSECURITY_FALLBACK_2025 = {
    "ACEH": 8.60,                  "SUMATERA UTARA": 7.20,
    "SUMATERA BARAT": 7.67,        "RIAU": 10.90,
    "JAMBI": 10.22,                "SUMATERA SELATAN": 5.94,
    "BENGKULU": 9.50,              "LAMPUNG": 10.62,
    "KEPULAUAN BANGKA BELITUNG": 10.00,
    "KEPULAUAN RIAU": 9.09,        "JAKARTA": 3.22,
    "JAWA BARAT": 5.23,            "JAWA TENGAH": 8.61,
    "DAERAH ISTIMEWA YOGYAKARTA": 8.41,
    "JAWA TIMUR": 8.05,            "BANTEN": 2.88,
    "BALI": 3.36,                  "NUSA TENGGARA BARAT": 2.67,
    "NUSA TENGGARA TIMUR": 12.12,  "KALIMANTAN BARAT": 13.75,
    "KALIMANTAN TENGAH": 8.20,     "KALIMANTAN SELATAN": 4.02,
    "KALIMANTAN TIMUR": 8.62,      "KALIMANTAN UTARA": 14.48,
    "SULAWESI UTARA": 5.63,        "SULAWESI TENGAH": 10.81,
    "SULAWESI SELATAN": 6.87,      "SULAWESI TENGGARA": 9.55,
    "GORONTALO": 15.32,            "SULAWESI BARAT": 7.13,
    "MALUKU": 30.54,               "MALUKU UTARA": 27.83,
    "PAPUA BARAT": 20.42,          "PAPUA BARAT DAYA": 21.58,
    "PAPUA": 26.11,                "PAPUA SELATAN": 27.51,
    "PAPUA TENGAH": 32.30,         "PAPUA PEGUNUNGAN": 28.72,
}


# Normalisasi Provinsi -

ALIAS_PROVINSI = {
    "DKI JAKARTA": "JAKARTA", "DAERAH KHUSUS IBUKOTA JAKARTA": "JAKARTA",
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


def normalize_provinsi(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r'\s*\d+\)\s*$', '', str(name).upper().strip()).strip()
    if name in ALIAS_PROVINSI:
        return ALIAS_PROVINSI[name]
    for key, val in ALIAS_PROVINSI.items():
        if len(key) > 4 and key in name:
            return val
    for prefix in ["PROVINSI ", "PROV. ", "PROV "]:
        if name.startswith(prefix):
            name = name[len(prefix):]
    return name.strip()


def match_provinsi(query: str, dataset: dict):
    q = normalize_provinsi(query)
    if q in dataset:
        return dataset[q]
    for k, v in dataset.items():
        if normalize_provinsi(k) == q:
            return v
    for k, v in dataset.items():
        kn = normalize_provinsi(k)
        if len(q) > 4 and (q in kn or kn in q):
            return v
    return None


# BPS Fetch & Parse -

def fetch_bps_data(key: str):
    url = INDIKATOR_PANGAN[key]["url_template"].format(key=BPS_API_KEY)
    print(f"  Fetching {key}: {url[:80]}...")
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            print(f"  v {key}: OK")
            return r.json()
        print(f"  x {key}: HTTP {r.status_code}")
    except Exception as e:
        print(f"  x {key}: {e}")
    return None


def parse_bps_v2_table(raw_data: dict, var_kolom: str) -> dict:
    result = {}
    if not raw_data:
        return result
    try:
        outer = raw_data.get("data", {})
        rows  = outer[1].get("data", []) if isinstance(outer, list) and len(outer) >= 2 else outer.get("data", [])
        for row in rows:
            label = row.get("label", "").strip()
            kode  = str(row.get("kode_wilayah", ""))
            if kode == "0000000" or label.upper() in ("INDONESIA", ""):
                continue
            col = row.get("variables", {}).get(var_kolom, {})
            raw = col.get("value_raw", col.get("value", ""))
            if not raw or str(raw).strip() in ("...", "-", "NA", ""):
                continue
            try:
                val = float(str(raw).replace(".", "").replace(",", "."))
                result[normalize_provinsi(label)] = round(val, 2)
            except (ValueError, TypeError):
                continue
        print(f"  Produksi parsed: {len(result)} provinsi")
    except Exception:
        import traceback; traceback.print_exc()
    return result


def parse_bps_html_kalori(raw_data: dict) -> dict:
    """Kolom 0=nama, kolom 1-19=kalori 2007-2025. Iterasi dari kanan ambil terbaru."""
    result = {}
    if not raw_data:
        return result
    try:
        d        = raw_data.get("data", {})
        html_str = d.get("table", "") if isinstance(d, dict) else (d[0].get("table", "") if d else "")
        if not html_str:
            return result

        decoded = htmllib.unescape(html_str)
        rows    = re.findall(r'<tr[^>]*>(.*?)</tr>', decoded, re.DOTALL)
        SKIP    = {'indonesia','provinsi','kalori','protein','diolah','sumber','susenas','nbsp'}

        for row_html in rows:
            cells    = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
            if len(cells) < 3:
                continue
            prov_raw = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', cells[0])).strip()
            if not prov_raw or prov_raw == '&nbsp;' or len(prov_raw) < 3:
                continue
            if any(kw in prov_raw.lower() for kw in SKIP):
                continue

            prov_norm  = normalize_provinsi(prov_raw)
            kalori_val = None
            for cell in reversed(cells[1:20]):
                txt = re.sub(r'<[^>]+>', '', cell).replace('\xa0', '').replace('&nbsp;', '').strip()
                if not txt or txt in ('-', '-', '...', 'NA', ''):
                    continue
                try:
                    val = float(txt.replace(' ', ''))
                    if 500 < val < 5000:
                        kalori_val = round(val, 2)
                        break
                except (ValueError, TypeError):
                    continue
            if kalori_val is not None:
                result[prov_norm] = kalori_val

        print(f"  Kalori parsed: {len(result)} provinsi")
        missing = set(normalize_provinsi(k) for k in KALORI_FALLBACK_2025) - set(result.keys())
        if missing:
            print(f"  ! Kalori fallback untuk: {sorted(missing)}")
    except Exception:
        import traceback; traceback.print_exc()
    return result


def parse_bps_insecurity(raw_data: dict) -> dict:
    """datacontent key = kode_wilayah + var_id + kode_tahun."""
    result = {}
    if not raw_data:
        return result
    try:
        dc  = raw_data.get("datacontent", {})
        vvl = raw_data.get("vervar", [])
        if not dc or not vvl:
            return result

        code_to_label = {
            str(item["val"]): normalize_provinsi(item["label"])
            for item in vvl
            if str(item.get("val", "")) not in ("0", "9999", "0000") and item.get("label")
        }
        print(f"  Insecurity kode tersedia: {len(code_to_label)}")

        for dc_key, dc_val in dc.items():
            if dc_val is None:
                continue
            try:
                fval = float(dc_val)
            except (TypeError, ValueError):
                continue
            for code, label in code_to_label.items():
                if dc_key.startswith(code):
                    result[label] = round(fval, 2)
                    break

        print(f"  Insecurity parsed: {len(result)} provinsi")
        missing = set(normalize_provinsi(k) for k in INSECURITY_FALLBACK_2025) - set(result.keys())
        if missing:
            print(f"  ! Insecurity fallback untuk: {sorted(missing)}")
    except Exception:
        import traceback; traceback.print_exc()
    return result


def _merge_fallback(parsed: dict, fallback_raw: dict, label: str) -> dict:
    fb    = {normalize_provinsi(k): v for k, v in fallback_raw.items()}
    added = []
    for k, v in fb.items():
        if k not in parsed:
            parsed[k] = v
            added.append(k)
    if added:
        print(f"  <- {label} fallback untuk {len(added)} provinsi: {sorted(added)}")
    return parsed


def fetch_all_bps_pangan() -> dict:
    print("=== Fetching BPS Pangan Data ===")
    parsed = {}
    for key, fallback in [("PRODUKSI", PRODUKSI_FALLBACK_2024), ("KALORI", KALORI_FALLBACK_2025), ("INSECURITY", INSECURITY_FALLBACK_2025)]:
        raw = fetch_bps_data(key)
        if key == "PRODUKSI":   parsed[key] = parse_bps_v2_table(raw, "mtn492ybb1") if raw else {}
        elif key == "KALORI":   parsed[key] = parse_bps_html_kalori(raw) if raw else {}
        else:                   parsed[key] = parse_bps_insecurity(raw) if raw else {}
        _merge_fallback(parsed[key], fallback, key.title())
    print(f"=== BPS Final: {' | '.join(f'{k}={len(parsed[k])}' for k in parsed)} ===")
    return parsed


# GeoAI & Boundary -

def get_geoai_stats_for_provinsi(provinsi_name: str):
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
            for group, kws in KATEGORI_LAHAN_MAP.items():
                if any(kw in kat for kw in kws):
                    stats[f"{group}_m2"] += luas
                    break
        stats["total_luas_m2"] = sum(stats[f"{g}_m2"] for g in BOBOT_GEOAI)
        return stats
    except Exception as e:
        print(f"  GeoAI error: {e}")
        return None


def load_boundary_map() -> dict:
    feats = list(mongo_db["batas_provinsi"].find({}, {"_id": 0})) or \
            list(mongo_db["batas_wilayah"].find(
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


def find_boundary(prov_norm: str, bmap: dict):
    if prov_norm in bmap:
        return bmap[prov_norm]
    for k, f in bmap.items():
        if len(prov_norm) > 4 and (prov_norm in k or k in prov_norm):
            return f
    return None


# Scoring -

def hitung_production_score(nilai, semua: dict):
    if nilai is None or not semua:
        return None
    vals = [v for v in semua.values() if v is not None]
    if not vals:
        return None
    mn, mx = min(vals), max(vals)
    return 50.0 if mx == mn else round(((nilai - mn) / (mx - mn)) * 100, 2)


def hitung_calorie_score(nilai, akg: float = 2100.0):
    return None if nilai is None else round(min((nilai / akg) * 100, 100), 2)


def hitung_insecurity_score(prevalensi_persen):
    return None if prevalensi_persen is None else round(max(100.0 - float(prevalensi_persen), 0.0), 2)


def hitung_geoai_weighted(stats):
    if not stats:
        return None, {}, False
    total = sum(stats.get(f"{g}_m2", 0) for g in BOBOT_GEOAI)
    if total <= 0:
        return None, {}, False
    proporsi = {g: round(stats[f"{g}_m2"] / total * 100, 2) for g in BOBOT_GEOAI}
    raw  = sum(BOBOT_GEOAI[k] * proporsi[k] for k in BOBOT_GEOAI)
    norm = round(max(min(raw + 30, 100), 0), 2)
    return norm, proporsi, True


def hitung_ikpg(geoai, prod, kalori, insec):
    if geoai is not None:
        bobot  = BOBOT_IKPG.copy()
        scores = {"geoai": geoai, "produksi": prod or 0, "kalori": kalori or 0, "insecurity": insec or 0}
    else:
        bobot  = {"geoai": 0.0, "produksi": 0.6, "kalori": 0.2, "insecurity": 0.2}
        scores = {"geoai": 0,   "produksi": prod or 0, "kalori": kalori or 0, "insecurity": insec or 0}
    ikpg = round(max(min(sum(bobot[k] * scores[k] for k in bobot), 100), 0), 2)
    if ikpg >= 70: return ikpg, "Tinggi", "#10b981", "ok",  bobot, geoai is not None
    if ikpg >= 40: return ikpg, "Sedang", "#f59e0b", "mid", bobot, geoai is not None
    return ikpg, "Rendah", "#ef4444", "low", bobot, geoai is not None


def generate_rekomendasi(proporsi, prod, kal, insec, ikpg, status):
    rekom = []
    if proporsi:
        b, p, pp, j = proporsi.get("bangunan",0), proporsi.get("perairan",0), proporsi.get("pepohonan",0), proporsi.get("jalan",0)
        if b  > 40: rekom.append({"kategori": "Tata Ruang",   "pesan": f"Bangunan {b:.1f}% — Alih fungsi lahan tinggi, perkuat regulasi tata ruang."})
        if p  < 10: rekom.append({"kategori": "Irigasi",      "pesan": f"Perairan {p:.1f}% — Prioritaskan pembangunan jaringan irigasi."})
        if pp < 20: rekom.append({"kategori": "Ekosistem",    "pesan": f"Vegetasi {pp:.1f}% — Dorong program penghijauan untuk kesuburan tanah."})
        if j  > 30: rekom.append({"kategori": "Tata Wilayah", "pesan": f"Jalan {j:.1f}% — Dominasi infrastruktur tinggi, jaga lahan produktif."})
    if prod is not None:
        if prod < 30:   rekom.append({"kategori": "Produksi Pangan", "pesan": f"Skor produksi rendah ({prod:.1f}) — Intensifikasi: benih unggul, pupuk, mekanisasi."})
        elif prod < 60: rekom.append({"kategori": "Produksi Pangan", "pesan": f"Skor produksi sedang ({prod:.1f}) — Tingkatkan dengan teknologi presisi."})
    if kal  is not None and kal  < 80: rekom.append({"kategori": "Konsumsi Kalori",  "pesan": f"Kalori di bawah optimal ({kal:.1f}/100) — Perkuat diversifikasi pangan."})
    if insec is not None and insec < 80: rekom.append({"kategori": "Kerawanan Pangan", "pesan": f"Prevalensi ketidakcukupan {100-insec:.1f}% — Percepat distribusi bantuan pangan."})
    msg = {"Rendah": "Kategori RENDAH. Diperlukan intervensi segera.",
           "Sedang": "Kategori SEDANG. Perkuat program berjalan.",
           "Tinggi": "Kategori TINGGI. Pertahankan dan jadikan model."}.get(status, "")
    rekom.append({"kategori": "Status IKPG", "pesan": f"IKPG {ikpg} — {msg}"})
    return rekom


# Endpoints -

def _build_analysis_data(prov, pr, kr, ir, parsed):
    ps  = hitung_production_score(pr, parsed["PRODUKSI"])
    ks  = hitung_calorie_score(kr)
    iss = hitung_insecurity_score(ir)
    gs, prop, hg = hitung_geoai_weighted(get_geoai_stats_for_provinsi(prov))
    ikpg, status, warna, icon, bobot, hg = hitung_ikpg(gs, ps, ks, iss)
    return {
        "nama_provinsi": prov, "ikpg": ikpg, "status": status,
        "warna": warna, "icon": icon, "has_geoai_data": hg,
        "komponen": {"geoai_weighted": gs, "production_score": ps, "calorie_score": ks, "insecurity_score": iss},
        "bobot_used": bobot, "proporsi_lahan": prop or {},
        "bps_raw": {"produksi_padi_ton": pr, "kalori_kkal_perhari": kr, "prevalensi_insecurity_persen": ir,
                    "tahun_produksi": 2024, "tahun_kalori": 2025, "tahun_insecurity": 2025, "sumber": "BPS Web API"},
        "rekomendasi": generate_rekomendasi(prop, ps, ks, iss, ikpg, status),
    }, gs, prop


@api_view(['POST'])
def analyze_food_security_bps(request):
    if not BPS_API_KEY:
        return Response({"error": "BPS_WEB_API_KEY belum dikonfigurasi"}, status=500)
    provinsi    = request.data.get("provinsi", "").strip()
    geoai_stats = request.data.get("geoai_stats")
    if not provinsi:
        return Response({"error": "Parameter 'provinsi' wajib diisi"}, status=400)
    try:
        parsed  = fetch_all_bps_pangan()
        pr      = match_provinsi(provinsi, parsed["PRODUKSI"])
        kr      = match_provinsi(provinsi, parsed["KALORI"])
        ir      = match_provinsi(provinsi, parsed["INSECURITY"])
        ps      = hitung_production_score(pr, parsed["PRODUKSI"])
        ks      = hitung_calorie_score(kr)
        iss     = hitung_insecurity_score(ir)
        if not geoai_stats:
            geoai_stats = get_geoai_stats_for_provinsi(provinsi)
        gs, proporsi, hg = hitung_geoai_weighted(geoai_stats)
        ikpg, status, warna, icon, bobot, hg = hitung_ikpg(gs, ps, ks, iss)
        return Response({
            "provinsi": provinsi, "ikpg": ikpg, "status": status,
            "status_warna": warna, "status_icon": icon, "has_geoai_data": hg,
            "komponen": {"geoai_weighted": gs, "production_score": ps, "calorie_score": ks, "insecurity_score": iss},
            "bobot_used": bobot, "proporsi_lahan": proporsi or {},
            "bps_raw": {
                "produksi_padi_ton": pr, "kalori_kkal_perhari": kr,
                "prevalensi_insecurity_persen": ir,
                "insecurity_score_formula": f"100 - {ir} = {iss}",
                "tahun_produksi": 2024, "tahun_kalori": 2025, "tahun_insecurity": 2025, "sumber": "BPS Web API",
            },
            "rekomendasi": generate_rekomendasi(proporsi, ps, ks, iss, ikpg, status),
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
                        seen.add(nm)
                        master.append(nm)
        else:
            master = [p for p in parsed["INSECURITY"].keys() if len(p) > 4]

        matched, summary, counts = [], [], {"Tinggi": 0, "Sedang": 0, "Rendah": 0}

        for prov in sorted(master):
            pr = match_provinsi(prov, parsed["PRODUKSI"])
            kr = match_provinsi(prov, parsed["KALORI"])
            ir = match_provinsi(prov, parsed["INSECURITY"])
            if all(v is None for v in [pr, kr, ir]):
                print(f"  ! Skip {prov}: semua data None")
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
                "komponen": {"geoai_weighted": gs, "production_score": ps, "calorie_score": ks, "insecurity_score": iss},
                "bps_raw": {"produksi_padi_ton": pr, "kalori_kkal_perhari": kr, "prevalensi_insecurity_persen": ir},
                "proporsi_lahan": prop,
                "rekomendasi": generate_rekomendasi(prop, ps, ks, iss, ikpg, status),
            }
            summary.append(ad)
            b = find_boundary(prov, bmap)
            if b:
                matched.append({"type": b.get("type","Feature"), "properties": {**b.get("properties",{}), "food_analysis": ad}, "geometry": b.get("geometry",{})})

        vals = [s["ikpg"] for s in summary if s["ikpg"] is not None]
        avg  = round(sum(vals) / len(vals), 2) if vals else None

        return Response({
            "status": "success", "source": "BPS Web API",
            "total_provinces": len(summary), "total_matched": len(matched),
            "status_distribusi": counts, "national_avg_ikpg": avg,
            "summary": summary,
            "geojson": {"type": "FeatureCollection", "features": matched},
            "indikator_info": {k: {"nama": v["nama"], "satuan": v["satuan"], "penjelasan": v["penjelasan"]} for k, v in INDIKATOR_PANGAN.items()},
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
        aid = str(uuid.uuid4())
        doc = {"analysis_id": aid, "timestamp": datetime.now().isoformat(), **data}
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
        q     = {"provinsi": {"$regex": prov, "$options": "i"}} if prov else {}
        cur   = mongo_db["pangan_analisis"].find(q, {"_id": 0}).sort("timestamp", -1).skip((page-1)*limit).limit(limit)
        return Response({"status": "success", "total": mongo_db["pangan_analisis"].count_documents(q),
                         "page": page, "limit": limit, "results": list(cur)})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_food_security_analysis_detail(request, analysis_id):
    try:
        r = mongo_db["pangan_analisis"].find_one({"analysis_id": analysis_id}, {"_id": 0})
        return Response(r) if r else Response({"error": "Tidak ditemukan"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_food_security_analysis(request, analysis_id):
    try:
        res = mongo_db["pangan_analisis"].delete_one({"analysis_id": analysis_id})
        return Response({"status": "success"}) if res.deleted_count else Response({"error": "Tidak ditemukan"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def debug_bps_raw(request):
    """Debug: GET /api/debug-bps-pangan/?indikator=INSECURITY"""
    if not BPS_API_KEY:
        return Response({"error": "BPS_WEB_API_KEY belum dikonfigurasi"}, status=500)
    key = request.query_params.get("indikator", "INSECURITY")
    if key not in INDIKATOR_PANGAN:
        return Response({"error": f"indikator harus salah satu dari: {list(INDIKATOR_PANGAN.keys())}"}, status=400)
    try:
        raw = fetch_bps_data(key)
        if not raw:
            return Response({"error": "Gagal fetch dari BPS"}, status=500)
        if key == "PRODUKSI":   parsed = parse_bps_v2_table(raw, "mtn492ybb1")
        elif key == "KALORI":   parsed = parse_bps_html_kalori(raw)
        else:                   parsed = parse_bps_insecurity(raw)
        dc, vv = raw.get("datacontent", {}), raw.get("vervar", [])
        return Response({
            "indikator": key, "url": INDIKATOR_PANGAN[key]["url_template"].format(key="[HIDDEN]"),
            "datacontent_total": len(dc), "vervar_total": len(vv),
            "sample_dc_10": dict(list(dc.items())[:10]) if dc else {},
            "sample_vv_5": vv[:5] if vv else [],
            "parsed_count": len(parsed), "parsed_all": parsed,
        })
    except Exception as e:
        import traceback
        return Response({"error": str(e), "traceback": traceback.format_exc()}, status=500)