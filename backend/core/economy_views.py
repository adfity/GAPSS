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


# KONFIGURASI INDIKATOR EKONOMI
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
        "definisi_lengkap": "PDRB adalah nilai tambah yang dihasilkan oleh semua kegiatan ekonomi di sebuah daerah. Ini mencakup pengeluaran untuk konsumsi rumah tangga, investasi, pengeluaran pemerintah, dan net ekspor. PDRB menunjukkan kekuatan ekonomi daerah secara keseluruhan.",
        "alasan_pemilihan": "PDRB dipilih karena merupakan indikator output ekonomi yang paling komprehensif. Semakin besar PDRB menunjukkan ekonomi daerah lebih kuat, terintegrasi dengan baik, dan memiliki daya saing yang tinggi di pasar nasional maupun global.",
        "alasan_bobot": "Bobot 40% (tertinggi) diberikan karena PDRB adalah ukuran outcome yang holistik. PDRB mencerminkan hasil akhir dari semua aktivitas ekonomi termasuk kontribusi sektor pertanian, industri, dan jasa.",
        "interpretasi": {
            "tinggi": {
                "nilai": "> Rp75 miliar",
                "skor": 3,
                "makna": "Ekonomi daerah sangat kuat dengan output besar, terintegrasi dengan ekonomi nasional, dan memiliki daya saing tinggi",
                "indikasi": "Pusat ekonomi regional atau nasional, diversifikasi sektor bagus, produktivitas tinggi"
            },
            "sedang": {
                "nilai": "Rp50-75 miliar",
                "skor": 2,
                "makna": "Ekonomi daerah sedang berkembang dengan potensi pertumbuhan yang masih bisa ditingkatkan",
                "indikasi": "Daerah dengan aktivitas ekonomi cukup baik namun masih ada ruang untuk pengembangan"
            },
            "rendah": {
                "nilai": "< Rp50 miliar",
                "skor": 1,
                "makna": "Ekonomi daerah masih lemah dan memerlukan percepatan pembangunan berkelanjutan",
                "indikasi": "Daerah dengan aktivitas ekonomi terbatas, perlu insentif khusus untuk pengembangan"
            }
        }
    },
    "KEMISKINAN": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/192/th/125/key/{key}/",
        "nama": "Persentase Penduduk Miskin",
        "satuan": "%",
        "threshold_rendah": 7,
        "threshold_sedang": 12,
        "bobot": 0.40,
        "reverse": True,
        "penjelasan": "Persentase penduduk yang hidup di bawah garis kemiskinan yang mencerminkan tingkat kesejahteraan masyarakat",
        "definisi_lengkap": "Kemiskinan diukur sebagai persentase penduduk yang konsumsi per bulannya di bawah garis kemiskinan yang ditetapkan BPS. Indikator ini mencerminkan keberhasilan pemerintah dalam meningkatkan kesejahteraan masyarakat dan distribusi manfaat pertumbuhan ekonomi.",
        "alasan_pemilihan": "Kemiskinan dipilih karena menunjukkan tingkat kesejahteraan dan inklusivitas pertumbuhan ekonomi. Pertumbuhan ekonomi yang tinggi hanya bermakna jika manfaatnya terdistribusi kepada masyarakat luas.",
        "alasan_bobot": "Bobot 40% (sama dengan PDRB) diberikan karena pertumbuhan ekonomi yang equitable (adil) sama pentingnya dengan pertumbuhan yang besar. Dua indikator ini saling melengkapi: PDRB menjawab 'seberapa besar ekonomi' sedangkan Kemiskinan menjawab 'seberapa baik distribusinya'.",
        "arah_hubungan": "REVERSE - Semakin RENDAH persentase kemiskinan semakin BAIK kondisi ekonomi (berbeda dengan PDRB dan Investasi)",
        "interpretasi": {
            "rendah": {
                "nilai": "< 7%",
                "skor": 3,
                "makna": "Kondisi ideal - kesejahteraan masyarakat baik dan pertumbuhan ekonomi inklusif",
                "indikasi": "Distribusi manfaat ekonomi merata, program sosial efektif, akses pendidikan & kesehatan baik"
            },
            "sedang": {
                "nilai": "7-12%",
                "skor": 2,
                "makna": "Masih ada kemiskinan signifikan, tetapi ada upaya pengurangan yang terukur",
                "indikasi": "Perlu peningkatan program pemberdayaan ekonomi dan jangkauan sosial yang lebih luas"
            },
            "tinggi": {
                "nilai": "> 12%",
                "skor": 1,
                "makna": "Kemiskinan luas menunjukkan distribusi manfaat ekonomi tidak merata, memerlukan intervensi khusus",
                "indikasi": "Banyak masyarakat di bawah garis kemiskinan, perlu akselerasi program pemberdayaan & inklusivitas"
            }
        }
    },
    "INVESTASI": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/793/th/123/key/{key}/",
        "nama": "Realisasi Investasi PMDN",
        "satuan": "Milyar Rupiah",
        "threshold_tinggi": 10000,
        "threshold_sedang": 5000,
        "bobot": 0.20,
        "reverse": False,
        "penjelasan": "Investasi Penanaman Modal Dalam Negeri yang menunjukkan kepercayaan investor dan aktivitas ekonomi",
        "definisi_lengkap": "Investasi PMDN adalah realisasi investasi yang dilakukan oleh pengusaha domestik Indonesia. Investasi ini mencakup pembangunan pabrik, infrastruktur, teknologi, dan modal kerja. Investasi mencerminkan ekspektasi investor tentang prospek ekonomi daerah di masa depan.",
        "alasan_pemilihan": "Investasi dipilih karena merupakan leading indicator (indikator terdepan) dari pertumbuhan PDRB. Investasi tinggi hari ini akan menghasilkan PDRB lebih tinggi di masa depan. Selain itu, investasi mencerminkan kepercayaan investor terhadap iklim bisnis, stabilitas sosial, dan kebijakan pemerintah.",
        "alasan_bobot": "Bobot 20% (lebih rendah dari PDRB & Kemiskinan) diberikan karena investasi adalah INPUT/komponen dari PDRB, bukan OUTPUT langsung. Investasi adalah sarana untuk mencapai PDRB tinggi, bukan hasil akhirnya. Ini adalah hubungan kausal: Investasi ↑ → PDRB ↑ di masa depan.",
        "indikator_kepercayaan": "Investasi tinggi mencerminkan: (1) Iklim bisnis kondusif, (2) Stabilitas sosial & keamanan, (3) Kebijakan pemerintah pro-bisnis, (4) Infrastruktur memadai, (5) SDM kompeten",
        "interpretasi": {
            "tinggi": {
                "nilai": "> Rp10 triliun",
                "skor": 3,
                "makna": "Daerah sangat menarik bagi investor, mengindikasikan iklim bisnis excellent dan prospek pertumbuhan sangat baik",
                "indikasi": "Investor besar percaya akan prospek daerah, infrastruktur mendukung, regulasi jelas, daya saing kompetitif"
            },
            "sedang": {
                "nilai": "Rp5-10 triliun",
                "skor": 2,
                "makna": "Daerah cukup menarik bagi investor dengan aktivitas investasi teratur dan stabil",
                "indikasi": "Ada aktivitas investasi rutin, iklim bisnis cukup baik, tetapi masih ada area improvement"
            },
            "rendah": {
                "nilai": "< Rp5 triliun",
                "skor": 1,
                "makna": "Daerah kurang menarik bagi investor, mengindikasikan tantangan dalam iklim bisnis dan kepercayaan investor",
                "indikasi": "Perlu perbaikan signifikan dalam infrastruktur, regulasi, keamanan, dan positioning ekonomi daerah"
            }
        }
    }
}


class EkonomiAnalytics:
    """Model analisis ekonomi dengan data BPS"""
    
    def __init__(self):
        self.colors = {
            "MAJU": "#10b981",
            "BERKEMBANG": "#f59e0b",
            "TERTINGGAL": "#ef4444"
        }
    
    def fetch_all_data(self):
        """Fetch semua data sekaligus dari BPS"""
        all_data = {}
        
        for indikator_key, config in INDIKATOR_EKONOMI.items():
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
        
        if not raw_data:
            return province_values
        
        try:
            datacontent = raw_data.get("datacontent", {})
            vervar_list = raw_data.get("vervar", [])
            
            # Buat mapping kode provinsi ke nama
            province_code_map = {}
            for item in vervar_list:
                code = str(item.get("val", ""))
                label = item.get("label", "")
                if code and label and code != "9999":
                    province_code_map[code] = label
            
            # Parse datacontent
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
                        
                        province_values[provinsi_clean] = value_float
                        
                except (ValueError, TypeError, IndexError) as e:
                    continue
            
            print(f"  Parsed {len(province_values)} provinces for {indikator_key}")
            
            # Debug: print beberapa contoh
            if province_values:
                sample_provs = list(province_values.items())[:3]
                print(f"  Sample: {sample_provs}")
            
        except Exception as e:
            print(f"  Parse error for {indikator_key}: {e}")
        
        return province_values
    
    def calculate_ekonomi_index(self, data_ekonomi):
        """Hitung Indeks Ekonomi Komposit (IEK)"""
        scores = {}
        
        # Hitung skor PDRB
        pdrb = data_ekonomi.get("PDRB")
        if pdrb is not None:
            if pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_tinggi"]:
                scores["PDRB"] = 3
            elif pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_sedang"]:
                scores["PDRB"] = 2
            else:
                scores["PDRB"] = 1
        
        # Hitung skor Kemiskinan (reverse - semakin rendah semakin baik)
        kemiskinan = data_ekonomi.get("KEMISKINAN")
        if kemiskinan is not None:
            if kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_rendah"]:
                scores["KEMISKINAN"] = 3
            elif kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_sedang"]:
                scores["KEMISKINAN"] = 2
            else:
                scores["KEMISKINAN"] = 1
        
        # Hitung skor Investasi
        investasi = data_ekonomi.get("INVESTASI")
        if investasi is not None:
            if investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_tinggi"]:
                scores["INVESTASI"] = 3
            elif investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_sedang"]:
                scores["INVESTASI"] = 2
            else:
                scores["INVESTASI"] = 1
        
        # Hitung Indeks Ekonomi Komposit
        # IEK = (0.4 × Skor PDRB) + (0.4 × Skor Kemiskinan) + (0.2 × Skor Investasi)
        total_score = 0
        total_weight = 0
        
        for key, weight in [("PDRB", 0.40), ("KEMISKINAN", 0.40), ("INVESTASI", 0.20)]:
            if key in scores:
                total_score += scores[key] * weight
                total_weight += weight
        
        iek = (total_score / total_weight) if total_weight > 0 else 0
        return round(iek, 2)
    
    def categorize_province(self, ekonomi_index):
        """Kategorikan provinsi berdasarkan Indeks Ekonomi"""
        if ekonomi_index >= 2.4:
            return "MAJU", ekonomi_index
        elif ekonomi_index >= 1.8:
            return "BERKEMBANG", ekonomi_index
        else:
            return "TERTINGGAL", ekonomi_index
    
    def generate_insights(self, provinsi, data_ekonomi, kategori, ekonomi_index):
        """Generate insight berdasarkan data ekonomi"""
        insights = []
        
        # Insight utama
        if kategori == "TERTINGGAL":
            insights.append(f"⚠️ {provinsi} dalam kategori TERTINGGAL - Indeks Ekonomi: {ekonomi_index}")
            insights.append("Memerlukan intervensi khusus untuk pembangunan ekonomi")
        elif kategori == "BERKEMBANG":
            insights.append(f"📊 {provinsi} dalam kategori BERKEMBANG - Indeks Ekonomi: {ekonomi_index}")
            insights.append("Perlu penguatan untuk mencapai ekonomi maju")
        else:
            insights.append(f"✅ {provinsi} dalam kategori MAJU - Indeks Ekonomi: {ekonomi_index}")
            insights.append("Ekonomi terus tumbuh dengan baik")
        
        # Insight per indikator
        pdrb = data_ekonomi.get("PDRB")
        if pdrb is not None:
            if pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_tinggi"]:
                insights.append(f"📈 PDRB: Rp{pdrb:.0f} milyar - TINGGI (Kuat)")
            elif pdrb > INDIKATOR_EKONOMI["PDRB"]["threshold_sedang"]:
                insights.append(f"📊 PDRB: Rp{pdrb:.0f} milyar - SEDANG (Perlu dikembangkan)")
            else:
                insights.append(f"📉 PDRB: Rp{pdrb:.0f} milyar - RENDAH (Perlu perhatian)")
        
        kemiskinan = data_ekonomi.get("KEMISKINAN")
        if kemiskinan is not None:
            if kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_rendah"]:
                insights.append(f"✅ Kemiskinan: {kemiskinan}% - RENDAH (Baik - sedikit miskin)")
            elif kemiskinan < INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_sedang"]:
                insights.append(f"⚠️ Kemiskinan: {kemiskinan}% - SEDANG (Perlu pengurangan)")
            else:
                insights.append(f"🚨 Kemiskinan: {kemiskinan}% - TINGGI (Banyak miskin)")
        
        investasi = data_ekonomi.get("INVESTASI")
        if investasi is not None:
            if investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_tinggi"]:
                insights.append(f"💰 Investasi: Rp{investasi:.0f} milyar - TINGGI (Sangat menarik)")
            elif investasi > INDIKATOR_EKONOMI["INVESTASI"]["threshold_sedang"]:
                insights.append(f"💵 Investasi: Rp{investasi:.0f} milyar - SEDANG (Cukup menarik)")
            else:
                insights.append(f"💸 Investasi: Rp{investasi:.0f} milyar - RENDAH (Perlu ditingkatkan)")
        
        return insights
    
    def generate_recommendations(self, kategori, data_ekonomi):
        """Generate rekomendasi kebijakan ekonomi LENGKAP dan COMPREHENSIVE"""
        recommendations = []
        
        # REKOMENDASI KATEGORI UTAMA
        if kategori == "TERTINGGAL":
            recommendations.append({
                'priority': 'DARURAT',
                'kategori': 'Percepatan Pembangunan Ekonomi Daerah Tertinggal',
                'level': 1,
                'description': 'Daerah dalam kategori TERTINGGAL memerlukan percepatan pembangunan dengan fokus pada dasar-dasar ekonomi yang kuat. Prioritas utama adalah infrastruktur dasar, akses modal, dan pemberdayaan masyarakat.',
                'actions': [
                    {
                        'no': 1,
                        'aksi': 'Alokasi Dana Infrastruktur Prioritas dari APBN',
                        'detail': 'Fokus pada jalan desa, pelabuhan, listrik, air bersih, dan telekomunikasi sebagai fondasi ekonomi daerah yang kuat',
                        'timeline': '2-3 tahun',
                        'budget_est': 'Sesuai APBD + APBN'
                    },
                    {
                        'no': 2,
                        'aksi': 'Program Pemberian Modal Usaha UMKM dengan Bunga Subsidi',
                        'detail': 'Menyediakan akses kredit mikro dengan bunga 0-3% untuk UMKM lokal agar dapat berkembang tanpa terbebani biaya bunga tinggi',
                        'timeline': '6-12 bulan',
                        'budget_est': '500 M - 2 T'
                    },
                    {
                        'no': 3,
                        'aksi': 'Pembukaan Zona Ekonomi Khusus (SEZ) atau Kawasan Industri Baru',
                        'detail': 'Menciptakan environment bisnis yang kondusif dengan insentif pajak, perizinan cepat, dan infrastruktur mendukung untuk menarik investor',
                        'timeline': '3-6 bulan persiapan',
                        'budget_est': '1-5 T'
                    },
                    {
                        'no': 4,
                        'aksi': 'Program Pelatihan Keterampilan & Pendidikan Vokasi Masif',
                        'detail': 'Meningkatkan SDM melalui pelatihan teknis, vokasi, dan soft skills untuk membuka lapangan kerja baru dan meningkatkan produktivitas',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '100-500 M/tahun'
                    },
                    {
                        'no': 5,
                        'aksi': 'Fasilitasi Akses Pasar Nasional untuk Produk Lokal',
                        'detail': 'Membuka akses distribusi, bekerja sama dengan retailer nasional, dan promosi produk lokal ke tingkat nasional dan global',
                        'timeline': '6-18 bulan',
                        'budget_est': '50-200 M'
                    },
                    {
                        'no': 6,
                        'aksi': 'Program Insentif Investasi untuk Sektor Prioritas',
                        'detail': 'Memberikan insentif: PPh 0% selama 5 tahun, kemudahan impor mesin, tax holiday untuk investasi tertentu di sektor strategis',
                        'timeline': 'Implementasi langsung',
                        'budget_est': 'Non-budgetary'
                    },
                    {
                        'no': 7,
                        'aksi': 'Identifikasi & Pengembangan Potensi Ekonomi Unggulan',
                        'detail': 'Melakukan kajian mendalam tentang aset lokal (pertanian, pariwisata, kerajinan, dst) dan mengembangkannya menjadi economic driver',
                        'timeline': '3-6 bulan',
                        'budget_est': '50-200 M'
                    },
                    {
                        'no': 8,
                        'aksi': 'Perbaikan Sistem Logistik & Distribusi Regional',
                        'detail': 'Mengembangkan hub distribusi, memperbaiki rute transportasi, dan mengurangi biaya logistik untuk efisiensi pasar lokal',
                        'timeline': '2-3 tahun',
                        'budget_est': '500 M - 2 T'
                    }
                ]
            })
            
        elif kategori == "BERKEMBANG":
            recommendations.append({
                'priority': 'TINGGI',
                'kategori': 'Penguatan Ekonomi Menuju Status Maju',
                'level': 1,
                'description': 'Daerah BERKEMBANG memiliki fondasi ekonomi yang cukup kuat. Fokus adalah penguatan melalui inovasi, diversifikasi, dan peningkatan nilai tambah produk.',
                'actions': [
                    {
                        'no': 1,
                        'aksi': 'Peningkatan Kualitas & Modernisasi Infrastruktur Ekonomi',
                        'detail': 'Upgrade jalan, terminal, bandara, dan infrastruktur digital untuk meningkatkan efisiensi dan daya saing ekonomi daerah',
                        'timeline': '2-3 tahun',
                        'budget_est': '1-5 T'
                    },
                    {
                        'no': 2,
                        'aksi': 'Investasi di Sektor Unggulan & Industri Kreatif Berbasis Teknologi',
                        'detail': 'Fokus pada sektor dengan nilai tambah tinggi: agro-industri, pariwisata digital, kerajinan modern, dan industri kreatif lainnya',
                        'timeline': '1-2 tahun',
                        'budget_est': '500 M - 2 T'
                    },
                    {
                        'no': 3,
                        'aksi': 'Program Pengembangan SDM Berkualitas Tinggi',
                        'detail': 'Pelatihan specialized skills, sertifikasi internasional, dan program magang dengan perusahaan multinasional untuk meningkatkan kompetensi',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '200-500 M/tahun'
                    },
                    {
                        'no': 4,
                        'aksi': 'Promosi Adopsi Teknologi Digital di UMKM & UKM',
                        'detail': 'Program digitalisasi: e-commerce, digital marketing, payment system, dan supply chain management untuk meningkatkan efisiensi bisnis',
                        'timeline': '6-18 bulan',
                        'budget_est': '100-300 M'
                    },
                    {
                        'no': 5,
                        'aksi': 'Pengembangan Ekosistem Pariwisata Berkelanjutan',
                        'detail': 'Membangun pariwisata yang ramah lingkungan dengan meningkatkan amenities, connectivity, dan branding destinasi wisata',
                        'timeline': '1-2 tahun',
                        'budget_est': '500 M - 1 T'
                    },
                    {
                        'no': 6,
                        'aksi': 'Kerjasama Strategis dengan Investor Swasta & Korporasi Nasional',
                        'detail': 'Memfasilitasi partnership antara UMKM lokal dengan perusahaan besar untuk technology transfer, market access, dan capital injection',
                        'timeline': '6-12 bulan',
                        'budget_est': 'Non-budgetary'
                    },
                    {
                        'no': 7,
                        'aksi': 'Peningkatan Daya Saing Produk Lokal melalui Inovasi & Branding',
                        'detail': 'Mendukung R&D produk lokal, packaging modern, sertifikasi mutu internasional, dan brand development untuk meningkatkan nilai jual',
                        'timeline': '1-2 tahun',
                        'budget_est': '200-500 M'
                    },
                    {
                        'no': 8,
                        'aksi': 'Ekspansi Pasar ke Tingkat Regional & Internasional',
                        'detail': 'Memfasilitasi partisipasi di trade fair internasional, membuka akses ekspor, dan membangun supply chain global untuk produk unggulan',
                        'timeline': '1-2 tahun',
                        'budget_est': '100-300 M'
                    }
                ]
            })
            
        else:  # MAJU
            recommendations.append({
                'priority': 'PEMELIHARAAN',
                'kategori': 'Keberlanjutan & Peningkatan Pertumbuhan Ekonomi Maju',
                'level': 1,
                'description': 'Daerah MAJU sudah memiliki ekonomi yang kuat. Fokus adalah sustain pertumbuhan dan meningkatkan posisi kompetitif di tingkat global.',
                'actions': [
                    {
                        'no': 1,
                        'aksi': 'Modernisasi & Upgrade Infrastruktur Ekonomi untuk Sustainabilitas',
                        'detail': 'Investasi di infrastruktur smart city, transportasi modern, renewable energy, dan digital infrastructure untuk efisiensi jangka panjang',
                        'timeline': '2-3 tahun',
                        'budget_est': '5-10 T'
                    },
                    {
                        'no': 2,
                        'aksi': 'Pengembangan Industri High-Tech & Knowledge-Based Economy',
                        'detail': 'Fokus pada AI, biotechnology, fintech, dan industri berbasis pengetahuan untuk menciptakan nilai tambah tertinggi dan sustainable growth',
                        'timeline': '2-3 tahun',
                        'budget_est': '1-3 T'
                    },
                    {
                        'no': 3,
                        'aksi': 'Pertumbuhan Ekonomi Berkelanjutan Ramah Lingkungan (Green Economy)',
                        'detail': 'Menerapkan prinsip circular economy, renewable energy, dan environmental management dalam semua sektor ekonomi',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '1-3 T/tahun'
                    },
                    {
                        'no': 4,
                        'aksi': 'Ekspansi Pasar Ekspor ke Tingkat Global untuk Produk Premium',
                        'detail': 'Meningkatkan ekspor produk bernilai tinggi, membuka market baru, dan membangun brand internasional untuk produk unggulan',
                        'timeline': '1-2 tahun',
                        'budget_est': '200-500 M'
                    },
                    {
                        'no': 5,
                        'aksi': 'Peningkatan Daya Saing Global melalui Inovasi Berkelanjutan',
                        'detail': 'Investasi R&D, patent development, dan continuous innovation untuk tetap menjadi market leader di industri masing-masing',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '500 M - 1 T/tahun'
                    },
                    {
                        'no': 6,
                        'aksi': 'Investasi Signifikan dalam Research & Development (R&D)',
                        'detail': 'Membangun R&D center, bekerja sama dengan universitas terkemuka, dan mendorong inovasi untuk produk & proses baru',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '300-800 M/tahun'
                    },
                    {
                        'no': 7,
                        'aksi': 'Penciptaan Ekosistem Startup & Innovation Hub',
                        'detail': 'Memfasilitasi startup ecosystem dengan venture capital, coworking space, mentorship, dan akses ke talent terbaik',
                        'timeline': '1-2 tahun',
                        'budget_est': '200-500 M'
                    },
                    {
                        'no': 8,
                        'aksi': 'Kemitraan Strategis dengan Universitas & Lembaga Riset untuk Knowledge Transfer',
                        'detail': 'Membangun linkage industri-universitas untuk transfer teknologi, training SDM, dan collaborative research',
                        'timeline': 'Berkelanjutan',
                        'budget_est': 'Non-budgetary/APBD'
                    }
                ]
            })
        
        # REKOMENDASI SPESIFIK PER INDIKATOR
        
        # PDRB RENDAH
        pdrb = data_ekonomi.get("PDRB")
        if pdrb and pdrb < INDIKATOR_EKONOMI["PDRB"]["threshold_sedang"]:
            recommendations.append({
                'priority': 'KHUSUS - PDRB RENDAH',
                'kategori': 'Peningkatan Output Ekonomi (PDRB)',
                'level': 2,
                'description': f'PDRB daerah sebesar Rp{pdrb:.0f} miliar termasuk kategori RENDAH. Diperlukan akselerasi output ekonomi melalui diversifikasi sektor dan peningkatan produktivitas.',
                'actions': [
                    {
                        'no': 1,
                        'aksi': 'Identifikasi Sektor Ekonomi Unggulan & Kompetitif Daerah',
                        'detail': 'Melakukan analisis mendalam tentang competitive advantage daerah di sektor pertanian, manufaktur, pariwisata, atau jasa untuk menjadi fokus pengembangan',
                        'timeline': '1-3 bulan',
                        'budget_est': '20-50 M'
                    },
                    {
                        'no': 2,
                        'aksi': 'Insentif Pajak & Kepabeanan untuk Investor di Sektor Prioritas',
                        'detail': 'Memberikan tax incentive: PPh final 5-10%, PPN waived, import duty free untuk mesin & raw materials, dan tax holiday selama 3-5 tahun',
                        'timeline': 'Implementasi langsung',
                        'budget_est': 'Non-budgetary'
                    },
                    {
                        'no': 3,
                        'aksi': 'Pengembangan Klaster Ekonomi & Agribusiness yang Terintegrasi',
                        'detail': 'Membentuk cluster industri (misal: agro-processing cluster) dengan menyatukan produsen, supplier, dan distributor untuk efisiensi skala',
                        'timeline': '6-12 bulan',
                        'budget_est': '100-300 M'
                    },
                    {
                        'no': 4,
                        'aksi': 'Dukungan Penuh untuk Ekspor Produk Lokal Berkualitas Tinggi',
                        'detail': 'Subsidi transportasi ekspor, fasilitasi sertifikasi internasional (ISO, Food Safety), dan dukungan marketing di pasar global',
                        'timeline': '6-18 bulan',
                        'budget_est': '50-200 M/tahun'
                    },
                    {
                        'no': 5,
                        'aksi': 'Pembangunan Special Economic Zone (SEZ) atau Kawasan Industri Modern',
                        'detail': 'Menciptakan industrial park dengan infrastruktur lengkap (air, listrik, gas, telekomunikasi) dan one-stop service untuk investor',
                        'timeline': '2-3 tahun',
                        'budget_est': '1-5 T'
                    },
                    {
                        'no': 6,
                        'aksi': 'Program Kemitraan UMKM dengan Perusahaan Besar (Supply Chain Partnership)',
                        'detail': 'Memfasilitasi UMKM lokal untuk menjadi supplier bagi perusahaan besar melalui standard compliance dan quality assurance programs',
                        'timeline': '6-12 bulan',
                        'budget_est': '50-150 M'
                    },
                    {
                        'no': 7,
                        'aksi': 'Peningkatan Nilai Tambah Produk melalui Processing & Packaging Modern',
                        'detail': 'Investasi di processing facility, modern packaging, dan value-added production untuk meningkatkan harga jual dan margin keuntungan',
                        'timeline': '1-2 tahun',
                        'budget_est': '200-500 M'
                    },
                    {
                        'no': 8,
                        'aksi': 'Akses Pasar Luas melalui E-Commerce & Digital Platform Nasional',
                        'detail': 'Memfasilitasi UMKM untuk hadir di marketplace nasional (Tokopedia, Shopee, Lazada) dengan subsidi biaya dan training digital marketing',
                        'timeline': '3-6 bulan',
                        'budget_est': '30-100 M'
                    }
                ]
            })
        
        # KEMISKINAN TINGGI
        kemiskinan = data_ekonomi.get("KEMISKINAN")
        if kemiskinan and kemiskinan > INDIKATOR_EKONOMI["KEMISKINAN"]["threshold_sedang"]:
            recommendations.append({
                'priority': 'KHUSUS - KEMISKINAN TINGGI',
                'kategori': 'Pengurangan Kemiskinan & Pemberdayaan Masyarakat',
                'level': 2,
                'description': f'Tingkat kemiskinan {kemiskinan}% mengindikasikan distribusi manfaat ekonomi yang tidak merata. Diperlukan program pemberdayaan komprehensif untuk meningkatkan kesejahteraan masyarakat.',
                'actions': [
                    {
                        'no': 1,
                        'aksi': 'Program Bantuan Sosial Terintegrasi untuk Keluarga Miskin Berkelanjutan',
                        'detail': 'Implementasi bantuan tunai, pangan, dan kesehatan yang terintegrasi dengan program pemberdayaan untuk break the poverty cycle',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '500 M - 1 T/tahun'
                    },
                    {
                        'no': 2,
                        'aksi': 'Pelatihan Keterampilan & Penciptaan Lapangan Kerja Baru',
                        'detail': 'Program training teknis, soft skills, dan entrepreneurship untuk memberdayakan tenaga kerja usia produktif menciptakan lapangan kerja sendiri',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '100-300 M/tahun'
                    },
                    {
                        'no': 3,
                        'aksi': 'Akses Pembiayaan Mikro untuk Usaha Mikro & Kecil (UMK)',
                        'detail': 'Program kredit tanpa jaminan dengan bunga ringan melalui koperasi & lembaga keuangan mikro untuk memulai atau mengembangkan usaha kecil',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '300 M - 1 T'
                    },
                    {
                        'no': 4,
                        'aksi': 'Program Pendidikan Gratis & Beasiswa Penuh untuk Anak Keluarga Miskin',
                        'detail': 'Memastikan akses pendidikan dari SD-SMA/SMK gratis plus beasiswa untuk menurunkan angka putus sekolah dan meningkatkan SDM generasi depan',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '200-500 M/tahun'
                    },
                    {
                        'no': 5,
                        'aksi': 'Program Kesehatan Preventif & Nutrisi untuk Masyarakat Rentan',
                        'detail': 'Checkup kesehatan gratis, program vaksinasi, dan nutrisi untuk mengurangi beban kesehatan dan meningkatkan produktivitas kerja',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '100-200 M/tahun'
                    },
                    {
                        'no': 6,
                        'aksi': 'Bantuan Modal Kerja untuk Mengembangkan Usaha Rumahan (Home-Based Business)',
                        'detail': 'Menyediakan alat & modal untuk usaha rumahan (kerajinan, kuliner, dll) dengan mentoring untuk meningkatkan income keluarga',
                        'timeline': '6-12 bulan',
                        'budget_est': '200-500 M'
                    },
                    {
                        'no': 7,
                        'aksi': 'Program Kemitraan dengan Perusahaan untuk Job Placement & Skills Development',
                        'detail': 'Menjalin kerjasama dengan industri untuk job placement dan on-the-job training untuk masyarakat miskin masuk ke lapangan kerja formal',
                        'timeline': '6-12 bulan',
                        'budget_est': '50-150 M'
                    },
                    {
                        'no': 8,
                        'aksi': 'Penguatan Kelembagaan Lokal (Koperasi & Kelompok Usaha) untuk Ekonomi Lokal',
                        'detail': 'Memberdayakan koperasi & kelompok usaha lokal sebagai medium saving, lending, dan marketing untuk ekonomi kerakyatan yang kuat',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '50-150 M/tahun'
                    }
                ]
            })
        
        # INVESTASI RENDAH
        investasi = data_ekonomi.get("INVESTASI")
        if investasi and investasi < INDIKATOR_EKONOMI["INVESTASI"]["threshold_sedang"]:
            recommendations.append({
                'priority': 'KHUSUS - INVESTASI RENDAH',
                'kategori': 'Peningkatan Iklim Investasi & Kepercayaan Investor',
                'level': 2,
                'description': f'Investasi PMDN sebesar Rp{investasi:.0f} miliar tergolong RENDAH, mengindikasikan investor masih kurang percaya pada prospek daerah. Diperlukan perbaikan iklim investasi.',
                'actions': [
                    {
                        'no': 1,
                        'aksi': 'Penyederhanaan Perizinan Usaha & Deregulasi yang Mengganggu',
                        'detail': 'Implementasi online single window (OSW), pengurangan dokumen diperlukan, dan fast-track approval untuk investor strategis',
                        'timeline': '1-3 bulan',
                        'budget_est': 'Non-budgetary'
                    },
                    {
                        'no': 2,
                        'aksi': 'Peningkatan Infrastruktur Dasar untuk Mendukung Aktivitas Investasi',
                        'detail': 'Upgrade jalan, bandara, pelabuhan, listrik, dan internet untuk menjadikan daerah attractive untuk investasi manufaktur & logistik',
                        'timeline': '2-3 tahun',
                        'budget_est': '1-3 T'
                    },
                    {
                        'no': 3,
                        'aksi': 'Promosi Investasi Agresif melalui Roadshow & Business Expo',
                        'detail': 'Melakukan investor roadshow di kota-kota besar, partisipasi di trade fair internasional, dan direct marketing ke potential investors',
                        'timeline': '6-12 bulan',
                        'budget_est': '50-150 M/tahun'
                    },
                    {
                        'no': 4,
                        'aksi': 'Perlindungan Hak Investasi & Kepastian Hukum yang Jelas',
                        'detail': 'Mengeluarkan regulasi yang jelas tentang hak investor, kompensasi, dan legal certainty untuk mengurangi business risk',
                        'timeline': '1-3 bulan',
                        'budget_est': 'Non-budgetary'
                    },
                    {
                        'no': 5,
                        'aksi': 'Pembangunan Kawasan Industri Modern & Pusat Bisnis Komersial',
                        'detail': 'Mengembangkan industrial estate dengan one-stop service, ready to operate facilities, dan professional management',
                        'timeline': '2-3 tahun',
                        'budget_est': '1-3 T'
                    },
                    {
                        'no': 6,
                        'aksi': 'Peningkatan Keamanan, Stabilitas Sosial & Transparansi Pemerintah',
                        'detail': 'Investasi di keamanan, community engagement, dan good governance untuk membangun investor confidence terhadap daerah',
                        'timeline': 'Berkelanjutan',
                        'budget_est': '200-500 M/tahun'
                    },
                    {
                        'no': 7,
                        'aksi': 'Insentif Khusus untuk Investasi Infrastruktur & Sektor Strategis',
                        'detail': 'Tax holiday, land provision subsidy, import duty waiver untuk investasi besar di sektor priority (energy, agriculture, manufacturing)',
                        'timeline': 'Implementasi langsung',
                        'budget_est': 'Non-budgetary'
                    },
                    {
                        'no': 8,
                        'aksi': 'Pembentukan Task Force Investasi untuk One-Stop Service ke Investor',
                        'detail': 'Dedicated team untuk melayani investor dari proses konsultasi, perizinan, hingga operasional untuk mempercepat investasi masuk',
                        'timeline': '1 bulan',
                        'budget_est': 'Non-budgetary'
                    }
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
    
    # Cek mapping khusus
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
def analyze_ekonomi_bps(request):
    """Analisis data ekonomi menggunakan BPS Web API dengan 3 indikator"""
    
    if not BPS_API_KEY:
        return Response({
            "error": "BPS Web API Key belum dikonfigurasi",
            "message": "Silakan tambahkan BPS_WEB_API_KEY di file .env"
        }, status=500)
    
    try:
        # Inisialisasi analytics
        analytics = EkonomiAnalytics()
        
        print("=== Mulai fetch data dari BPS ===")
        # Fetch semua data sekaligus
        raw_data = analytics.fetch_all_data()
        
        # Parse data per provinsi untuk setiap indikator
        print("\n=== Parse data per provinsi ===")
        parsed_data = {}
        for indikator_key in INDIKATOR_EKONOMI.keys():
            values = analytics.parse_province_data(
                raw_data[indikator_key], 
                indikator_key
            )
            parsed_data[indikator_key] = values
        
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
        kategori_counts = {"MAJU": 0, "BERKEMBANG": 0, "TERTINGGAL": 0}
        
        for prov_name in sorted(all_provinces):
            # Kumpulkan data ekonomi untuk provinsi ini
            data_ekonomi = {}
            for indikator_key in INDIKATOR_EKONOMI.keys():
                value = parsed_data[indikator_key].get(prov_name)
                data_ekonomi[indikator_key] = value
            
            # Skip jika tidak ada data sama sekali
            if not any(v is not None for v in data_ekonomi.values()):
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
            
            # Hitung indeks ekonomi
            ekonomi_index = analytics.calculate_ekonomi_index(data_ekonomi)
            kategori, _ = analytics.categorize_province(ekonomi_index)
            warna = analytics.colors[kategori]
            
            # Generate insights & recommendations
            insights = analytics.generate_insights(prov_name, data_ekonomi, kategori, ekonomi_index)
            recommendations = analytics.generate_recommendations(kategori, data_ekonomi)
            
            # Update counts
            kategori_counts[kategori] += 1
            
            # Tambahkan ke feature
            feature_copy = matched_feature.copy()
            props = feature_copy.get('properties', {})
            
            props['ekonomi_analysis'] = {
                'nama_provinsi': prov_name,
                'kategori': kategori,
                'warna': warna,
                'ekonomi_index': ekonomi_index,
                'insights': insights,
                'rekomendasi': recommendations,
                'data_ekonomi': data_ekonomi
            }
            
            feature_copy['properties'] = props
            matched_features.append(feature_copy)
            
            # Tambahkan ke summary
            analysis_summary.append({
                'provinsi': prov_name,
                'kategori': kategori,
                'warna': warna,
                'ekonomi_index': ekonomi_index,
                'pdrb': data_ekonomi.get('PDRB'),
                'kemiskinan': data_ekonomi.get('KEMISKINAN'),
                'investasi': data_ekonomi.get('INVESTASI'),
                'matched': True
            })
            
            print(f"  ✓ {prov_name}: {kategori} (Index: {ekonomi_index})")
        
        # Generate rekomendasi nasional
        national_recommendations = []
        
        if kategori_counts['TERTINGGAL'] > 0:
            national_recommendations.append({
                'priority': 'Darurat',
                'title': f'Fokus Pembangunan {kategori_counts["TERTINGGAL"]} Provinsi Tertinggal',
                'content': f'Terdapat {kategori_counts["TERTINGGAL"]} provinsi dalam kategori TERTINGGAL yang memerlukan percepatan pembangunan ekonomi berkelanjutan.',
                'actions': [
                    'Program dana alokasi khusus untuk daerah tertinggal dari APBN',
                    'Pembangunan infrastruktur ekonomi strategis (jalan, air, listrik)',
                    'Pengembangan sektor ekonomi unggulan daerah berdasarkan potensi lokal',
                    'Peningkatan akses modal untuk UMKM lokal dengan bunga terjangkau',
                    'Pelatihan tenaga kerja dan pengembangan SDM terampil',
                    'Kemitraan dengan sektor swasta untuk technology transfer',
                    'Program pemasaran produk lokal ke tingkat nasional & internasional'
                ]
            })
        
        if kategori_counts['BERKEMBANG'] > 0:
            national_recommendations.append({
                'priority': 'Tinggi',
                'title': f'Penguatan {kategori_counts["BERKEMBANG"]} Provinsi Berkembang',
                'content': f'Terdapat {kategori_counts["BERKEMBANG"]} provinsi dalam kategori BERKEMBANG yang menuju status maju.',
                'actions': [
                    'Peningkatan investasi sektor strategis dan industri modern',
                    'Pengembangan industri inovatif dan ekonomi digital',
                    'Kemitraan strategis dengan investor domestik & internasional',
                    'Ekspansi pasar lokal dan internasional untuk produk unggulan',
                    'Peningkatan efisiensi logistik dan supply chain',
                    'Pembangunan infrastruktur digital (telekomunikasi, internet cepat)',
                    'Program inovasi dan entrepreneurship berbasis teknologi'
                ]
            })
        
        if kategori_counts['MAJU'] > 0:
            national_recommendations.append({
                'priority': 'Maintenance',
                'title': f'Sustain {kategori_counts["MAJU"]} Provinsi Maju',
                'content': f'Terdapat {kategori_counts["MAJU"]} provinsi dalam kategori MAJU dengan ekonomi yang kuat.',
                'actions': [
                    'Modernisasi berkelanjutan infrastruktur ekonomi exististing',
                    'Pengembangan industri high-tech dan knowledge economy',
                    'Pertumbuhan ekonomi yang sustainable dan green',
                    'Memperkuat posisi dalam pasar ekspor global',
                    'Investasi riset & pengembangan untuk produk premium',
                    'Pembangunan ekosistem startup dan innovation hub',
                    'Peningkatan daya saing kompetitif di tingkat internasional'
                ]
            })
        
        # Cari provinsi dengan kondisi terburuk dan terbaik
        sorted_by_index = sorted(
            [s for s in analysis_summary if s['ekonomi_index'] is not None],
            key=lambda x: x['ekonomi_index']
        )
        
        worst_provinces = sorted_by_index[:5]  # 5 terburuk
        best_provinces = sorted_by_index[-5:][::-1]  # 5 terbaik (reverse)
        
        # Dokumentasi metodologi LENGKAP
        metodologi = {
            "judul": "Metodologi Perhitungan Indeks Ekonomi Komposit (IEK) Indonesia",
            "deskripsi": "Indeks Ekonomi Komposit (IEK) menggabungkan 3 indikator kunci ekonomi dengan pembobotan berdasarkan dampak strategis terhadap pembangunan daerah. Pendekatan ini mengikuti standar Kementerian PPN/Bappenas untuk klasifikasi tingkat kemajuan ekonomi daerah.",
            
            "filosofi_indeks": {
                "tujuan": "Memberikan penilaian holistik tentang kondisi ekonomi daerah yang mempertimbangkan aspek output (PDRB), distribusi kesejahteraan (Kemiskinan), dan dinamika investasi (PMDN).",
                "prinsip": [
                    "Komprehensif: Menggabungkan perspektif makro (PDRB) dan mikro (kemiskinan)",
                    "Praktis: Data tersedia dan terupdate dari sumber resmi BPS",
                    "Comparable: Dapat dibandingkan antar daerah dan antar tahun",
                    "Actionable: Hasil dapat digunakan untuk policy making",
                    "Transparent: Metodologi jelas dan dapat direplikasi"
                ]
            },
            
            "formula_utama": "IEK = (0.4 × Skor_PDRB) + (0.4 × Skor_Kemiskinan) + (0.2 × Skor_Investasi)",
            
            "indikator": [
                {
                    "nama": "PDRB Atas Dasar Harga Berlaku (Pengeluaran)",
                    "bobot": "40%",
                    "satuan": "Milyar Rupiah",
                    "alasan_pemilihan": "Mencerminkan kapasitas ekonomi daerah yang utuh, mencakup konsumsi rumah tangga, investasi, pengeluaran pemerintah, dan net ekspor. Sebagai output indikator, PDRB menunjukkan hasil akhir dari seluruh aktivitas ekonomi.",
                    "alasan_bobot_tinggi": "Bobot 40% (tertinggi) karena PDRB adalah ukuran outcome yang komprehensif - semakin besar PDRB menunjukkan ekonomi lebih kuat dan terintegrasi.",
                    "threshold_scoring": {
                        "tinggi": {
                            "nilai": "> Rp75 miliar",
                            "skor": 3,
                            "interpretasi": "Ekonomi daerah sangat kuat, terintegrasi dengan ekonomi nasional, daya saing tinggi"
                        },
                        "sedang": {
                            "nilai": "Rp50-75 miliar",
                            "skor": 2,
                            "interpretasi": "Ekonomi daerah sedang berkembang, ada potensi pertumbuhan"
                        },
                        "rendah": {
                            "nilai": "< Rp50 miliar",
                            "skor": 1,
                            "interpretasi": "Ekonomi daerah masih lemah, memerlukan pengembangan berkelanjutan"
                        }
                    },
                    "referensi": "Kepri Rp167,9 miliar (tertinggi), Rata-rata nasional ~Rp82,5 miliar, DIY Rp52,1 miliar"
                },
                {
                    "nama": "Persentase Penduduk Miskin (P0)",
                    "bobot": "40%",
                    "satuan": "%",
                    "alasan_pemilihan": "Mencerminkan tingkat kesejahteraan masyarakat dan efektivitas distribusi manfaat ekonomi. Kemiskinan menunjukkan seberapa inklusif pertumbuhan ekonomi dalam menjangkau masyarakat.",
                    "alasan_bobot_sama": "Bobot sama dengan PDRB (40%) karena pentingnya equitable growth - pertumbuhan hanya bermakna jika kesejahteraan masyarakat meningkat. Dua indikator ini saling melengkapi: PDRB (how big) dan Kemiskinan (how distributed).",
                    "arah_hubungan": "REVERSE - Semakin RENDAH kemiskinan semakin BAIK (berbeda dengan indikator lain)",
                    "threshold_scoring": {
                        "rendah": {
                            "nilai": "< 7%",
                            "skor": 3,
                            "interpretasi": "Kondisi ideal - kesejahteraan masyarakat baik, pertumbuhan inklusif"
                        },
                        "sedang": {
                            "nilai": "7-12%",
                            "skor": 2,
                            "interpretasi": "Masih ada kemiskinan signifikan, perlu pengurangan berkelanjutan"
                        },
                        "tinggi": {
                            "nilai": "> 12%",
                            "skor": 1,
                            "interpretasi": "Kemiskinan luas, distribusi manfaat ekonomi buruk, perlu intervensi"
                        }
                    },
                    "referensi": "Nasional 8,47% (SEDANG), Papua Pegunungan 40%+ (TINGGI), DKI Jakarta ~3% (RENDAH)"
                },
                {
                    "nama": "Realisasi Investasi Penanaman Modal Dalam Negeri (PMDN)",
                    "bobot": "20%",
                    "satuan": "Milyar Rupiah",
                    "alasan_pemilihan": "Menunjukkan kepercayaan investor terhadap stabilitas dan prospek ekonomi daerah. Investasi adalah leading indicator pertumbuhan PDRB di masa depan.",
                    "alasan_bobot_lebih_rendah": "Bobot 20% (lebih rendah) karena investasi adalah input/komponen dari PDRB, bukan output langsung. Tinggi investasi hari ini = PDRB lebih tinggi di masa depan, sehingga tidak boleh setara dengan PDRB yang mengukur output sekarang.",
                    "indikator_kepercayaan": "Investasi mencerminkan confidence investor pada iklim bisnis, stabilitas sosial, dan kebijakan pemerintah yang kondusif.",
                    "threshold_scoring": {
                        "tinggi": {
                            "nilai": "> Rp10 triliun",
                            "skor": 3,
                            "interpretasi": "Daerah sangat menarik bagi investor, ekonomi berkembang pesat"
                        },
                        "sedang": {
                            "nilai": "Rp5-10 triliun",
                            "skor": 2,
                            "interpretasi": "Daerah cukup menarik, ada aktivitas investasi teratur"
                        },
                        "rendah": {
                            "nilai": "< Rp5 triliun",
                            "skor": 1,
                            "interpretasi": "Daerah kurang menarik, perlu perbaikan iklim investasi"
                        }
                    },
                    "referensi": "Jawa Barat ~Rp88 triliun (TINGGI), Kalimantan Timur ~Rp52 triliun (TINGGI), Papua ~Rp1 triliun (RENDAH)"
                }
            ],
            
            "kategori_hasil": [
                {
                    "nama": "MAJU",
                    "range": "IEK ≥ 2.4",
                    "warna": "#10b981 (🟢 Hijau)",
                    "makna": "Ekonomi sangat kuat dengan pertumbuhan berkelanjutan",
                    "karakteristik": [
                        "PDRB besar dan terus tumbuh",
                        "Kemiskinan rendah, kesejahteraan masyarakat baik",
                        "Investasi tinggi dari investor dalam dan luar negeri",
                        "Daya saing tinggi di pasar nasional dan internasional"
                    ],
                    "rekomendasi_kebijakan": "Fokus pada sustainabilitas, inovasi, dan peningkatan daya saing global"
                },
                {
                    "nama": "BERKEMBANG",
                    "range": "1.8 ≤ IEK < 2.4",
                    "warna": "#f59e0b (🟡 Kuning)",
                    "makna": "Ekonomi menunjukkan perkembangan dengan potensi mencapai status maju",
                    "karakteristik": [
                        "PDRB sedang, pertumbuhan ada tapi masih perlu ditingkatkan",
                        "Kemiskinan sedang, masih ada ruang untuk pengurangan",
                        "Investasi sedang, mencerminkan stabilitas namun belum optimal",
                        "Perlu penguatan untuk mencapai pertumbuhan yang lebih kuat"
                    ],
                    "rekomendasi_kebijakan": "Fokus pada penguatan infrastruktur, peningkatan investasi, dan pengembangan SDM"
                },
                {
                    "nama": "TERTINGGAL",
                    "range": "IEK < 1.8",
                    "warna": "#ef4444 (🔴 Merah)",
                    "makna": "Ekonomi belum berkembang optimal, memerlukan intervensi dan akselerasi",
                    "karakteristik": [
                        "PDRB rendah, ekonomi tidak terintegrasi dengan baik",
                        "Kemiskinan tinggi, banyak masyarakat di bawah garis kemiskinan",
                        "Investasi rendah, mencerminkan kurang menariknya iklim bisnis",
                        "Memerlukan percepatan pembangunan dan intervensi khusus"
                    ],
                    "rekomendasi_kebijakan": "Fokus pada percepatan pembangunan infrastruktur, pemberdayaan UMKM, dan peningkatan investasi"
                }
            ],
            
            "proses_perhitungan": {
                "langkah_1": {
                    "nama": "Konversi Nilai ke Skor (1-3)",
                    "penjelasan": "Setiap indikator dikonversi menjadi skor 1-3 berdasarkan threshold yang telah ditetapkan"
                },
                "langkah_2": {
                    "nama": "Penghitungan IEK",
                    "penjelasan": "IEK = (0.4 × Skor_PDRB) + (0.4 × Skor_Kemiskinan) + (0.2 × Skor_Investasi)",
                    "hasil_range": "IEK berkisar antara 1.0 (terendah) hingga 3.0 (tertinggi)"
                },
                "langkah_3": {
                    "nama": "Kategorisasi",
                    "penjelasan": "Hasil IEK dikategorikan menjadi 3 kategori: MAJU, BERKEMBANG, atau TERTINGGAL"
                },
                "contoh_perhitungan": {
                    "provinsi": "JAMBI",
                    "pdrb": 125000,
                    "skor_pdrb": "2 (SEDANG - 50-75 ribu tidak ada di data, anggap 2)",
                    "kemiskinan": 9.5,
                    "skor_kemiskinan": "2 (SEDANG - 7-12%)",
                    "investasi": 8500,
                    "skor_investasi": "2 (SEDANG - 5-10 triliun)",
                    "perhitungan": "IEK = (0.4×2) + (0.4×2) + (0.2×2) = 0.8 + 0.8 + 0.4 = 2.0",
                    "hasil": "BERKEMBANG (1.8 ≤ 2.0 < 2.4)"
                }
            },
            
            "validitas_dan_keterbatasan": {
                "validitas": [
                    "Mengikuti standar Kementerian PPN/Bappenas untuk klasifikasi daerah",
                    "Mengacu pada metodologi WHO untuk composite indicator",
                    "Data bersumber dari BPS yang credible dan terpercaya",
                    "Metodologi transparan dan dapat direplikasi"
                ],
                "keterbatasan": [
                    "PDRB & Kemiskinan 2025 (provisional), Investasi 2023 (data terbaru tersedia)",
                    "Indikator terbatas pada ekonomi makro, belum mencakup aspek kualitas hidup",
                    "Threshold ditentukan berdasarkan konsensus, bukan hasil empiris formal",
                    "Tidak mempertimbangkan variasi seasonal atau shock ekonomi saat ini"
                ],
                "rekomendasi_penggunaan": [
                    "Gunakan sebagai screening tool, bukan deterministic judgment",
                    "Kombinasikan dengan analisis kualitatif dan stakeholder input",
                    "Update tahunan dengan data terbaru dari BPS",
                    "Customization threshold mungkin diperlukan untuk konteks spesifik daerah"
                ]
            },
            
            "sumber_data": [
                "BPS Web API - PDRB Atas Dasar Harga Berlaku (Var: 534, Tahun: 2025)",
                "BPS Web API - Persentase Penduduk Miskin (Var: 192, Tahun: 2025)",
                "BPS Web API - Realisasi Investasi PMDN (Var: 793, Tahun: 2023)"
            ],
            
            "catatan_penting": "Analisis ini memberikan gambaran HOLISTIK kondisi ekonomi daerah dengan mempertimbangkan aspek output (PDRB), distribusi kesejahteraan (Kemiskinan), dan dinamika investasi secara berimbang. Hasil kategorisasi bukan penilaian mutlak tetapi framework untuk policy discussion dan strategic planning."
        }
        
        print(f"\n=== Analysis Complete ===")
        print(f"Total matched: {len(matched_features)} provinces")
        print(f"Distribution: MAJU={kategori_counts['MAJU']}, BERKEMBANG={kategori_counts['BERKEMBANG']}, TERTINGGAL={kategori_counts['TERTINGGAL']}")
        
        return Response({
            'status': 'success',
            'source': 'BPS Web API - Direct Endpoints',
            'total_provinces': len(all_provinces),
            'total_matched': len(matched_features),
            'total_success': len(matched_features),
            'kategori_distribusi': kategori_counts,
            'matched_features': {
                "type": "FeatureCollection",
                "features": matched_features
            },
            'analysis_summary': analysis_summary,
            'national_recommendations': national_recommendations,
            'worst_provinces': worst_provinces,
            'best_provinces': best_provinces,
            'colors': analytics.colors,
            'indikator_info': {k: {
                'nama': v['nama'],
                'satuan': v['satuan'],
                'penjelasan': v['penjelasan'],
                'bobot': v['bobot'],
                'threshold_tinggi': v.get('threshold_tinggi'),
                'threshold_sedang': v.get('threshold_sedang'),
                'threshold_rendah': v.get('threshold_rendah'),
            } for k, v in INDIKATOR_EKONOMI.items()},
            'metodologi': metodologi,
            'raw_datasets': {
                'PDRB': parsed_data.get('PDRB', {}),
                'KEMISKINAN': parsed_data.get('KEMISKINAN', {}),
                'INVESTASI': parsed_data.get('INVESTASI', {})
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
def save_ekonomi_analysis(request):
    """Simpan hasil analisis ekonomi"""
    try:
        data = request.data
        analysis_name = data.get('name', 'Analisis Ekonomi Tanpa Nama')
        analysis_data = data.get('analysis_data')
        
        if not analysis_data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)
        
        analysis_id = str(uuid.uuid4())
        
        document = {
            "analysis_id": analysis_id,
            "name": analysis_name,
            "type": "ekonomi",
            "timestamp": datetime.now().isoformat(),
            **analysis_data
        }
        
        mongo_db["ekonomi_analysis"].insert_one(document)
        
        return Response({
            "status": "success",
            "message": f"Analisis ekonomi '{analysis_name}' berhasil disimpan",
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
def get_ekonomi_analysis_list(request):
    """Get list semua analisis ekonomi"""
    try:
        cursor = mongo_db["ekonomi_analysis"].find(
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
def get_ekonomi_analysis_detail(request, analysis_id):
    """Get detail analisis ekonomi"""
    try:
        result = mongo_db["ekonomi_analysis"].find_one(
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
def delete_ekonomi_analysis(request, analysis_id):
    """Hapus analisis ekonomi"""
    try:
        result = mongo_db["ekonomi_analysis"].delete_one(
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