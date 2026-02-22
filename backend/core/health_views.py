from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import requests
import uuid
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
BPS_API_KEY = os.getenv("BPS_WEB_API_KEY")

# Koneksi MongoDB
client = MongoClient(MONGO_URI)
mongo_db = client[DB_MONGO_NAME]


# KONFIGURASI INDIKATOR KESEHATAN - MENGGUNAKAN DATA YANG DISEDIAKAN
INDIKATOR_KESEHATAN = {
    "AHH": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/501/th/124/key/{key}/",
        "nama": "Angka Harapan Hidup",
        "satuan": "tahun",
        "threshold_baik": 72,      # > 72 tahun = baik
        "threshold_sedang": 68,    # 68-72 tahun = sedang
        "bobot": 0.40,
        "reverse": False,  # Higher is better
        "penjelasan": "Indikator utama kesehatan populasi yang mencerminkan kualitas layanan kesehatan, nutrisi, dan kondisi sanitasi"
    },
    "IMUNISASI": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/2280/th/124/key/{key}/",
        "nama": "Cakupan Imunisasi Dasar Lengkap",
        "satuan": "%",
        "threshold_baik": 90,      # > 90% = baik
        "threshold_sedang": 80,    # 80-90% = sedang
        "bobot": 0.35,
        "reverse": False,  # Higher is better
        "penjelasan": "Mencerminkan efektivitas program preventif kesehatan, terutama untuk melindungi bayi dan anak dari penyakit menular"
    },
    "SANITASI": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/847/th/125/key/{key}/",
        "nama": "Akses Sanitasi Layak",
        "satuan": "%",
        "threshold_baik": 85,      # > 85% = baik
        "threshold_sedang": 70,    # 70-85% = sedang
        "bobot": 0.25,
        "reverse": False,  # Higher is better
        "penjelasan": "Indikator infrastruktur dasar kesehatan lingkungan yang berdampak langsung pada pencegahan penyakit"
    }
}


class KesehatanAnalytics:
    """Model analisis kesehatan dengan data BPS"""
    
    def __init__(self):
        self.colors = {
            "KRITIS": "#ef4444",     # Merah - kondisi buruk
            "WASPADA": "#f59e0b",    # Kuning - perlu perhatian
            "STABIL": "#10b981"      # Hijau - kondisi baik
        }
    
    def fetch_all_data(self):
        """Fetch semua data sekaligus dari BPS"""
        all_data = {}
        
        for indikator_key, config in INDIKATOR_KESEHATAN.items():
            try:
                url = config["url_template"].format(key=BPS_API_KEY)
                print(f"Fetching {indikator_key}: {url}")
                
                response = requests.get(url, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    all_data[indikator_key] = data
                    print(f"✓ {indikator_key}: Success")
                else:
                    print(f"✗ {indikator_key}: HTTP {response.status_code}")
                    all_data[indikator_key] = None
                    
            except Exception as e:
                print(f"✗ {indikator_key}: Error - {e}")
                all_data[indikator_key] = None
        
        return all_data
    
    def parse_province_data(self, raw_data, indikator_key):
        """Parse data per provinsi dari response BPS"""
        province_values = {}
        province_details = {}  # Menyimpan detail per gender untuk AHH
        
        if not raw_data:
            return province_values, province_details
        
        try:
            # Format response BPS:
            # {
            #   "datacontent": {
            #     "15005012121240": 74.09,   # format: vervar_code + var + turvar + tahun + 0
            #     "12005012121240": 72.3,
            #     ...
            #   },
            #   "vervar": [
            #     {"val": 1500, "label": "JAMBI"},
            #     {"val": 1200, "label": "SUMATERA UTARA"},
            #     ...
            #   ],
            #   "turvar": [
            #     {"val": 1, "label": "Laki-laki"},
            #     {"val": 2, "label": "Perempuan"}
            #   ]
            # }
            
            datacontent = raw_data.get("datacontent", {})
            vervar_list = raw_data.get("vervar", [])
            turvar_list = raw_data.get("turvar", [])
            
            # Buat mapping kode provinsi ke nama
            province_code_map = {}
            for item in vervar_list:
                code = str(item.get("val", ""))
                label = item.get("label", "")
                if code and label and code != "9999":  # Skip INDONESIA
                    province_code_map[code] = label
            
            # Buat mapping turvar (untuk gender di AHH)
            turvar_map = {}
            for item in turvar_list:
                code = str(item.get("val", ""))
                label = item.get("label", "")
                turvar_map[code] = label
            
            # Temporary storage untuk menampung data per gender
            temp_data = {}
            
            # Parse datacontent
            # Key format contoh: "15005012121240" 
            # - 4 digit pertama = kode provinsi (1500)
            # - sisanya = var + turvar + tahun + 0
            
            for key, value in datacontent.items():
                try:
                    # Ambil 4 digit pertama sebagai kode provinsi
                    prov_code = key[:4]
                    
                    # Skip INDONESIA (9999)
                    if prov_code == "9999":
                        continue
                    
                    # Cari nama provinsi
                    provinsi_name = province_code_map.get(prov_code)
                    
                    if provinsi_name and value is not None:
                        provinsi_clean = str(provinsi_name).upper().strip()
                        value_float = float(value)
                        
                        # Untuk AHH yang ada turvar (Laki-laki/Perempuan)
                        if turvar_map:
                            # Ada turvar, berarti ada breakdown per gender
                            # Extract turvar code (digit ke-8)
                            try:
                                turvar_code = key[7:8]  # Posisi turvar dalam key
                                gender_label = turvar_map.get(turvar_code, "Unknown")
                                
                                if provinsi_clean not in temp_data:
                                    temp_data[provinsi_clean] = {}
                                
                                temp_data[provinsi_clean][gender_label] = value_float
                            except:
                                # Fallback jika parsing turvar gagal
                                if provinsi_clean in province_values:
                                    province_values[provinsi_clean] = (province_values[provinsi_clean] + value_float) / 2
                                else:
                                    province_values[provinsi_clean] = value_float
                        else:
                            # Tidak ada turvar, langsung assign
                            province_values[provinsi_clean] = value_float
                        
                except (ValueError, TypeError, IndexError) as e:
                    continue
            
            # Hitung rata-rata untuk data yang punya breakdown gender
            if temp_data:
                for prov, gender_data in temp_data.items():
                    # Simpan detail per gender
                    province_details[prov] = gender_data
                    
                    # Hitung rata-rata untuk nilai utama
                    values = list(gender_data.values())
                    if values:
                        province_values[prov] = round(sum(values) / len(values), 2)
            
            print(f"  Parsed {len(province_values)} provinces for {indikator_key}")
            if province_details:
                print(f"  Found gender breakdown for {len(province_details)} provinces")
            
            # Debug: print beberapa contoh
            if province_values:
                sample_provs = list(province_values.items())[:3]
                print(f"  Sample: {sample_provs}")
            
        except Exception as e:
            print(f"  Parse error for {indikator_key}: {e}")
        
        return province_values, province_details
    
    def calculate_health_index(self, data_kesehatan):
        """Hitung Indeks Kesehatan Komposit (IKK)"""
        total_score = 0
        total_weight = 0
        
        for key, value in data_kesehatan.items():
            if value is None:
                continue
            
            config = INDIKATOR_KESEHATAN.get(key)
            if not config:
                continue
            
            # Semua indikator kita higher is better
            if value >= config["threshold_baik"]:
                score = 100
            elif value >= config["threshold_sedang"]:
                score = 70
            else:
                score = 40
            
            total_score += score * config["bobot"]
            total_weight += config["bobot"]
        
        return round(total_score / total_weight if total_weight > 0 else 0, 2)
    
    def categorize_province(self, health_index):
        """Kategorikan provinsi berdasarkan Indeks Kesehatan"""
        if health_index >= 80:
            return "STABIL", health_index
        elif health_index >= 60:
            return "WASPADA", health_index
        else:
            return "KRITIS", health_index
    
    def generate_insights(self, provinsi, data_kesehatan, kategori, health_index):
        """Generate insight berdasarkan data kesehatan"""
        insights = []
        
        # Insight utama
        if kategori == "KRITIS":
            insights.append(f"⚠️ {provinsi} dalam kondisi KRITIS - Indeks Kesehatan: {health_index}")
            insights.append("Memerlukan intervensi darurat di sektor kesehatan")
        elif kategori == "WASPADA":
            insights.append(f"📊 {provinsi} dalam kondisi WASPADA - Indeks Kesehatan: {health_index}")
            insights.append("Perlu penguatan program kesehatan preventif")
        else:
            insights.append(f"✅ {provinsi} dalam kondisi STABIL - Indeks Kesehatan: {health_index}")
            insights.append("Pertahankan kualitas layanan kesehatan")
        
        # Insight per indikator
        for key, value in data_kesehatan.items():
            if value is None:
                continue
            
            config = INDIKATOR_KESEHATAN.get(key)
            if not config:
                continue
            
            nama = config["nama"]
            satuan = config["satuan"]
            
            if key == "AHH":
                if value < config["threshold_sedang"]:
                    insights.append(f"📉 {nama}: {value} {satuan} - RENDAH (Target: >{config['threshold_baik']})")
                elif value < config["threshold_baik"]:
                    insights.append(f"⚠️ {nama}: {value} {satuan} - Perlu peningkatan")
                else:
                    insights.append(f"✅ {nama}: {value} {satuan} - Baik")
            
            elif key == "IMUNISASI":
                if value < config["threshold_sedang"]:
                    insights.append(f"🚨 {nama}: {value}% - RENDAH (Target: >{config['threshold_baik']}%)")
                elif value < config["threshold_baik"]:
                    insights.append(f"⚠️ {nama}: {value}% - Perlu ditingkatkan")
                else:
                    insights.append(f"✅ {nama}: {value}% - Sangat baik")
            
            elif key == "SANITASI":
                if value < config["threshold_sedang"]:
                    insights.append(f"🚨 {nama}: {value}% - RENDAH (Target: >{config['threshold_baik']}%)")
                elif value < config["threshold_baik"]:
                    insights.append(f"⚠️ {nama}: {value}% - Perlu perbaikan infrastruktur")
                else:
                    insights.append(f"✅ {nama}: {value}% - Memadai")
        
        return insights
    
    def generate_recommendations(self, kategori, data_kesehatan):
        """Generate rekomendasi kebijakan kesehatan"""
        recommendations = []
        
        # Rekomendasi berdasarkan kategori
        if kategori == "KRITIS":
            recommendations.append({
                'priority': 'Darurat',
                'title': 'Intervensi Segera Diperlukan',
                'actions': [
                    'Alokasi anggaran darurat untuk perbaikan infrastruktur kesehatan',
                    'Penambahan tenaga kesehatan melalui program penugasan khusus',
                    'Program bantuan kesehatan gratis untuk kelompok rentan',
                    'Pembangunan puskesmas dan fasilitas sanitasi di daerah terpencil',
                    'Kampanye kesehatan ibu dan anak secara masif'
                ]
            })
        elif kategori == "WASPADA":
            recommendations.append({
                'priority': 'Tinggi',
                'title': 'Penguatan Sistem Kesehatan',
                'actions': [
                    'Optimalisasi BPJS Kesehatan dan JKN-KIS',
                    'Peningkatan kualitas layanan puskesmas dan rumah sakit',
                    'Program imunisasi terintegrasi dan menyeluruh',
                    'Pelatihan dan sertifikasi tenaga kesehatan',
                    'Pembangunan infrastruktur air bersih dan sanitasi'
                ]
            })
        else:
            recommendations.append({
                'priority': 'Pemeliharaan',
                'title': 'Inovasi & Peningkatan Kualitas',
                'actions': [
                    'Digitalisasi layanan kesehatan (telemedicine)',
                    'Program kesehatan preventif berbasis komunitas',
                    'Riset dan pengembangan kesehatan lokal',
                    'Kemitraan dengan rumah sakit swasta',
                    'Peningkatan sistem rujukan berjenjang'
                ]
            })
        
        # Rekomendasi spesifik per indikator
        ahh = data_kesehatan.get("AHH")
        if ahh and ahh < INDIKATOR_KESEHATAN["AHH"]["threshold_sedang"]:
            recommendations.append({
                'priority': 'Khusus - AHH',
                'title': 'Peningkatan Angka Harapan Hidup',
                'actions': [
                    'Program pencegahan penyakit tidak menular (PTM)',
                    'Peningkatan akses layanan kesehatan primer',
                    'Kampanye pola hidup sehat (GERMAS)',
                    'Deteksi dini dan skrining kesehatan berkala'
                ]
            })
        
        imunisasi = data_kesehatan.get("IMUNISASI")
        if imunisasi and imunisasi < INDIKATOR_KESEHATAN["IMUNISASI"]["threshold_sedang"]:
            recommendations.append({
                'priority': 'Khusus - Imunisasi',
                'title': 'Percepatan Cakupan Imunisasi',
                'actions': [
                    'Program Bulan Imunisasi Anak Nasional (BIAN)',
                    'Sosialisasi pentingnya imunisasi lengkap',
                    'Penyediaan vaksin gratis dan mudah diakses',
                    'Pemberdayaan kader posyandu untuk monitoring',
                    'Sistem reminder imunisasi berbasis digital'
                ]
            })
        
        sanitasi = data_kesehatan.get("SANITASI")
        if sanitasi and sanitasi < INDIKATOR_KESEHATAN["SANITASI"]["threshold_sedang"]:
            recommendations.append({
                'priority': 'Khusus - Sanitasi',
                'title': 'Perbaikan Akses Sanitasi Layak',
                'actions': [
                    'Program STBM (Sanitasi Total Berbasis Masyarakat)',
                    'Pembangunan jamban sehat untuk rumah tangga miskin',
                    'Penyediaan akses air bersih yang memadai',
                    'Edukasi PHBS (Perilaku Hidup Bersih dan Sehat)',
                    'Kemitraan dengan swasta untuk CSR sanitasi'
                ]
            })
        
        return recommendations


# MAPPING NAMA PROVINSI
def normalize_province_name(name):
    """Normalisasi nama provinsi untuk matching"""
    if not isinstance(name, str):
        name = str(name)
    
    name = name.upper().strip()
    
    # Mapping khusus untuk nama yang berbeda antara BPS dan boundary data
    special_mappings = {
        'DKI JAKARTA': 'JAKARTA',
        'DAERAH KHUSUS IBUKOTA JAKARTA': 'JAKARTA',
        'DKI': 'JAKARTA',
        'YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
        'DIY': 'DAERAH ISTIMEWA YOGYAKARTA',
        'D.I. YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
        'BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
        'KEP. BANGKA BELITUNG': 'KEPULAUAN BANGKA BELITUNG',
        'KEPULAUAN RIAU': 'KEPULAUAN RIAU',
        'KEP. RIAU': 'KEPULAUAN RIAU',
    }
    
    # Cek mapping khusus terlebih dahulu
    for key, value in special_mappings.items():
        if key in name:
            return value
    
    # Singkatan umum
    abbreviations = {
        'KEP.': 'KEPULAUAN',
        'KEP ': 'KEPULAUAN ',
        'NTB': 'NUSA TENGGARA BARAT',
        'NTT': 'NUSA TENGGARA TIMUR',
    }
    
    for abbr, full in abbreviations.items():
        if abbr in name:
            name = name.replace(abbr, full)
    
    # Hapus prefix
    prefixes = ['PROVINSI ', 'PROV. ', 'PROV ', 'DAERAH KHUSUS IBUKOTA ']
    for prefix in prefixes:
        if name.startswith(prefix):
            name = name[len(prefix):]
    
    return name.strip()


@api_view(['POST'])
def analyze_health_bps(request):
    """Analisis data kesehatan menggunakan BPS Web API dengan 3 indikator"""
    
    if not BPS_API_KEY:
        return Response({
            "error": "BPS Web API Key belum dikonfigurasi",
            "message": "Silakan tambahkan BPS_WEB_API_KEY di file .env"
        }, status=500)
    
    try:
        # Inisialisasi analytics
        analytics = KesehatanAnalytics()
        
        print("=== Mulai fetch data dari BPS ===")
        # Fetch semua data sekaligus
        raw_data = analytics.fetch_all_data()
        
        # Parse data per provinsi untuk setiap indikator
        print("\n=== Parse data per provinsi ===")
        parsed_data = {}
        parsed_details = {}  # Untuk menyimpan breakdown per gender
        for indikator_key in INDIKATOR_KESEHATAN.keys():
            values, details = analytics.parse_province_data(
                raw_data[indikator_key], 
                indikator_key
            )
            parsed_data[indikator_key] = values
            if details:
                parsed_details[indikator_key] = details
        
        # Ambil data batas provinsi dari MongoDB
        print("\n=== Load boundary data ===")
        cursor = mongo_db["batas_provinsi"].find({}, {'_id': 0})
        boundary_features = list(cursor)
        
        # Buat mapping nama provinsi ke boundary
        province_map = {}
        for feature in boundary_features:
            props = feature.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    official_name = str(props[field]).upper().strip()
                    normalized = normalize_province_name(official_name)
                    province_map[normalized] = feature
                    # Simpan juga versi asli untuk partial matching
                    province_map[official_name] = feature
        
        print(f"Loaded {len(province_map)} province boundaries")
        
        # Kumpulkan semua nama provinsi unik dari data BPS
        all_provinces = set()
        for indikator_data in parsed_data.values():
            all_provinces.update(indikator_data.keys())
        
        print(f"\n=== Processing {len(all_provinces)} provinces ===")
        
        # Proses analisis per provinsi
        matched_features = []
        analysis_summary = []
        kategori_counts = {"KRITIS": 0, "WASPADA": 0, "STABIL": 0}
        
        for prov_name in sorted(all_provinces):
            # Kumpulkan data kesehatan untuk provinsi ini
            data_kesehatan = {}
            for indikator_key in INDIKATOR_KESEHATAN.keys():
                value = parsed_data[indikator_key].get(prov_name)
                data_kesehatan[indikator_key] = value
            
            # Skip jika tidak ada data sama sekali
            if not any(v is not None for v in data_kesehatan.values()):
                continue
            
            # Cari matching boundary
            normalized_prov = normalize_province_name(prov_name)
            matched_feature = None
            
            # Exact match
            if normalized_prov in province_map:
                matched_feature = province_map[normalized_prov]
            elif prov_name in province_map:
                matched_feature = province_map[prov_name]
            else:
                # Partial match
                for map_name, feature in province_map.items():
                    if normalized_prov in map_name or map_name in normalized_prov:
                        matched_feature = feature
                        break
            
            if not matched_feature:
                print(f"  ✗ {prov_name}: No boundary match")
                continue
            
            # Hitung indeks kesehatan
            health_index = analytics.calculate_health_index(data_kesehatan)
            kategori, _ = analytics.categorize_province(health_index)
            warna = analytics.colors[kategori]
            
            # Generate insights & recommendations
            insights = analytics.generate_insights(prov_name, data_kesehatan, kategori, health_index)
            recommendations = analytics.generate_recommendations(kategori, data_kesehatan)
            
            # Update counts
            kategori_counts[kategori] += 1
            
            # Tambahkan ke feature
            feature_copy = matched_feature.copy()
            props = feature_copy.get('properties', {})
            
            props['health_analysis'] = {
                'nama_provinsi': prov_name,
                'kategori': kategori,
                'warna': warna,
                'health_index': health_index,
                'insights': insights,
                'rekomendasi': recommendations,
                'data_kesehatan': data_kesehatan
            }
            
            feature_copy['properties'] = props
            matched_features.append(feature_copy)
            
            # Tambahkan ke summary
            analysis_summary.append({
                'provinsi': prov_name,
                'kategori': kategori,
                'warna': warna,
                'health_index': health_index,
                'ahh': data_kesehatan.get('AHH'),
                'imunisasi': data_kesehatan.get('IMUNISASI'),
                'sanitasi': data_kesehatan.get('SANITASI'),
                'matched': True
            })
            
            print(f"  ✓ {prov_name}: {kategori} (Index: {health_index})")
        
        # Generate rekomendasi nasional
        national_recommendations = []
        
        if kategori_counts['KRITIS'] > 0:
            national_recommendations.append({
                'priority': 'Darurat',
                'title': 'Fokus Provinsi Kritis',
                'content': f'Terdapat {kategori_counts["KRITIS"]} provinsi dalam kondisi KRITIS yang memerlukan intervensi segera.',
                'actions': [
                    'Alokasi dana darurat kesehatan untuk provinsi kritis',
                    'Task force kesehatan nasional',
                    'Mobilisasi sumber daya kesehatan lintas provinsi'
                ]
            })
        
        if kategori_counts['WASPADA'] > 0:
            national_recommendations.append({
                'priority': 'Tinggi',
                'title': 'Penguatan Provinsi Waspada',
                'content': f'Terdapat {kategori_counts["WASPADA"]} provinsi dalam kondisi WASPADA.',
                'actions': [
                    'Program preventif kesehatan masyarakat',
                    'Monitoring dan evaluasi berkala',
                    'Penguatan sistem kesehatan primer'
                ]
            })
        
        # Cari provinsi dengan kondisi terburuk
        sorted_by_index = sorted(
            [s for s in analysis_summary if s['health_index'] is not None],
            key=lambda x: x['health_index']
        )[:5]  # Top 5 terburuk
        
        # Dokumentasi metodologi
        metodologi = {
            "judul": "Metodologi Perhitungan Indeks Kesehatan Komposit (IKK)",
            "deskripsi": "Indeks Kesehatan Komposit (IKK) menggabungkan 3 indikator kunci kesehatan dengan pembobotan berdasarkan dampak dan relevansi terhadap kualitas hidup masyarakat.",
            "formula": "IKK = (Skor_AHH × 0.40) + (Skor_Imunisasi × 0.35) + (Skor_Sanitasi × 0.25)",
            "catatan_gender": {
                "indikator": "Angka Harapan Hidup (AHH)",
                "metode": "Rata-rata dari AHH Laki-laki dan Perempuan",
                "alasan": "AHH memiliki perbedaan biologis dan sosial antara laki-laki dan perempuan. Untuk mendapatkan gambaran populasi secara keseluruhan, digunakan rata-rata sederhana (simple average) dari kedua gender. Metode ini sesuai dengan praktik BPS dan standar internasional dalam menghitung indikator kesehatan agregat.",
                "formula_ahh": "AHH_Provinsi = (AHH_Laki-laki + AHH_Perempuan) / 2",
                "contoh": "JAMBI: (70.09 + 74.09) / 2 = 72.09 tahun"
            },
            "indikator": [
                {
                    "nama": "Angka Harapan Hidup (AHH)",
                    "bobot": "40%",
                    "alasan": "Indikator paling komprehensif yang mencerminkan hasil akhir dari seluruh sistem kesehatan, mencakup nutrisi, akses layanan, dan kondisi lingkungan. Bobot tertinggi karena merepresentasikan outcome utama kesehatan populasi.",
                    "threshold": {
                        "baik": "> 72 tahun (Skor: 100)",
                        "sedang": "68-72 tahun (Skor: 70)",
                        "rendah": "< 68 tahun (Skor: 40)"
                    },
                    "breakdown_gender": True,
                    "metode_agregasi": "Rata-rata AHH Laki-laki dan Perempuan"
                },
                {
                    "nama": "Cakupan Imunisasi Dasar Lengkap",
                    "bobot": "35%",
                    "alasan": "Indikator preventif yang sangat penting untuk melindungi generasi masa depan. Bobot tinggi karena imunisasi adalah intervensi cost-effective dengan dampak jangka panjang terhadap kesehatan populasi dan dapat mencegah KLB (Kejadian Luar Biasa).",
                    "threshold": {
                        "baik": "> 90% (Skor: 100)",
                        "sedang": "80-90% (Skor: 70)",
                        "rendah": "< 80% (Skor: 40)"
                    },
                    "breakdown_gender": False
                },
                {
                    "nama": "Akses Sanitasi Layak",
                    "bobot": "25%",
                    "alasan": "Indikator infrastruktur dasar yang berdampak pada pencegahan penyakit menular dan kesehatan lingkungan. Bobot lebih rendah karena merupakan prasyarat (input) dibanding outcome langsung, namun tetap krusial untuk kesehatan jangka panjang.",
                    "threshold": {
                        "baik": "> 85% (Skor: 100)",
                        "sedang": "70-85% (Skor: 70)",
                        "rendah": "< 70% (Skor: 40)"
                    },
                    "breakdown_gender": False
                }
            ],
            "kategori": [
                {
                    "nama": "STABIL",
                    "range": "IKK ≥ 80",
                    "makna": "Kondisi kesehatan baik, sistem berfungsi optimal"
                },
                {
                    "nama": "WASPADA",
                    "range": "60 ≤ IKK < 80",
                    "makna": "Perlu penguatan, ada area yang memerlukan perbaikan"
                },
                {
                    "nama": "KRITIS",
                    "range": "IKK < 60",
                    "makna": "Memerlukan intervensi segera, kondisi mengkhawatirkan"
                }
            ],
            "validitas": "Pembobotan ini mengacu pada standar WHO dan Kemenkes RI, dengan penyesuaian konteks Indonesia. AHH mendapat bobot tertinggi karena merupakan outcome indikator yang mencerminkan efektivitas keseluruhan sistem kesehatan. Imunisasi sebagai indikator preventif kritikal mendapat bobot kedua. Sanitasi sebagai indikator infrastruktur/input mendapat bobot terendah namun tetap signifikan.",
            "sumber_data": [
                "BPS Web API - Angka Harapan Hidup (Var: 501) - Breakdown per Gender",
                "BPS Web API - Cakupan Imunisasi Dasar Lengkap (Var: 2280)",
                "BPS Web API - Akses Sanitasi Layak (Var: 847)"
            ],
            "catatan": "Analisis ini memberikan gambaran holistik kondisi kesehatan dengan mempertimbangkan aspek outcome (AHH), preventif (imunisasi), dan infrastruktur (sanitasi) secara berimbang."
        }
        
        print(f"\n=== Analysis Complete ===")
        print(f"Total matched: {len(matched_features)} provinces")
        print(f"Distribution: KRITIS={kategori_counts['KRITIS']}, WASPADA={kategori_counts['WASPADA']}, STABIL={kategori_counts['STABIL']}")
        
        return Response({
            'status': 'success',
            'source': 'BPS Web API - Direct Endpoints',
            'total_provinces': len(all_provinces),
            'total_matched': len(matched_features),
            'total_success': len(matched_features),  # Untuk kompatibilitas dengan frontend
            'kategori_distribusi': kategori_counts,
            'matched_features': {
                "type": "FeatureCollection",
                "features": matched_features
            },
            'analysis_summary': analysis_summary,
            'national_recommendations': national_recommendations,
            'worst_provinces': sorted_by_index,
            'colors': analytics.colors,
            'indikator_info': {k: {
                'nama': v['nama'],
                'satuan': v['satuan'],
                'penjelasan': v['penjelasan'],
                'bobot': v['bobot'],
                'threshold_baik': v['threshold_baik'],
                'threshold_sedang': v['threshold_sedang']
            } for k, v in INDIKATOR_KESEHATAN.items()},
            'metodologi': metodologi,
            'raw_datasets': {
                'AHH': parsed_data.get('AHH', {}),
                'IMUNISASI': parsed_data.get('IMUNISASI', {}),
                'SANITASI': parsed_data.get('SANITASI', {})
            },
            'raw_datasets_detail': {
                'AHH_breakdown': parsed_details.get('AHH', {}),  # Include gender breakdown
                'IMUNISASI': parsed_data.get('IMUNISASI', {}),
                'SANITASI': parsed_data.get('SANITASI', {})
            }
        })
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            "error": str(e),
            "message": "Gagal mengambil data dari BPS"
        }, status=500)


@api_view(['POST'])
def save_health_analysis(request):
    """Simpan hasil analisis kesehatan"""
    try:
        data = request.data
        analysis_name = data.get('name', 'Analisis Kesehatan Tanpa Nama')
        analysis_data = data.get('analysis_data')
        
        if not analysis_data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)
        
        analysis_id = str(uuid.uuid4())
        
        document = {
            "analysis_id": analysis_id,
            "name": analysis_name,
            "type": "health",
            "timestamp": datetime.now().isoformat(),
            **analysis_data
        }
        
        mongo_db["health_analysis"].insert_one(document)
        
        return Response({
            "status": "success",
            "message": f"Analisis kesehatan '{analysis_name}' berhasil disimpan",
            "analysis_id": analysis_id,
            "saved_at": document["timestamp"]
        })
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            "error": str(e),
            "message": "Gagal menyimpan analisis"
        }, status=500)


@api_view(['GET'])
def get_health_analysis_list(request):
    """Get list semua analisis kesehatan"""
    try:
        cursor = mongo_db["health_analysis"].find(
            {},
            {
                '_id': 0,
                'analysis_id': 1,
                'name': 1,
                'timestamp': 1,
                'total_matched': 1,
                'kategori_distribusi': 1
            }
        ).sort('timestamp', -1)
        
        results = list(cursor)
        
        return Response({
            "status": "success",
            "count": len(results),
            "results": results
        })
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return Response({
            "error": str(e),
            "message": "Gagal mengambil daftar analisis"
        }, status=500)


@api_view(['GET'])
def get_health_analysis_detail(request, analysis_id):
    """Get detail analisis kesehatan"""
    try:
        result = mongo_db["health_analysis"].find_one(
            {"analysis_id": analysis_id},
            {'_id': 0}
        )
        
        if not result:
            return Response({
                "error": "Analisis tidak ditemukan"
            }, status=404)
        
        return Response(result)
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return Response({
            "error": str(e),
            "message": "Gagal mengambil detail analisis"
        }, status=500)


@api_view(['DELETE'])
def delete_health_analysis(request, analysis_id):
    """Hapus analisis kesehatan"""
    try:
        result = mongo_db["health_analysis"].delete_one(
            {"analysis_id": analysis_id}
        )
        
        if result.deleted_count == 0:
            return Response({
                "error": "Analisis tidak ditemukan"
            }, status=404)
        
        return Response({
            "status": "success",
            "message": "Analisis berhasil dihapus"
        })
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return Response({
            "error": str(e),
            "message": "Gagal menghapus analisis"
        }, status=500)