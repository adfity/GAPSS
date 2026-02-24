from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import uuid
import requests
import os
from dotenv import load_dotenv
from datetime import datetime

# download xlsx
import io
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
BPS_API_KEY = os.getenv("BPS_WEB_API_KEY")

# Koneksi MongoDB
client = MongoClient(MONGO_URI)
mongo_db = client[DB_MONGO_NAME]

# KONFIGURASI INDIKATOR PENDIDIKAN
INDIKATOR_PENDIDIKAN = {
    "RLS": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/459/th/124/key/{key}/",
        "nama": "Rata-rata Lama Sekolah",
        "satuan": "tahun",
        "bobot": 0.30
    },
    "APS": {
        "url_template": "https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/0000/var/2211/th/125/key/{key}/",
        "nama": "Angka Partisipasi Sekolah",
        "satuan": "%",
        "bobot": 0.50
    },
    "SD": {
        "url_template": "https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi/id/25/tahun/2024/id_tabel/UkJNaEl6ZHRVYXNaMzZhZG9BbS9ZZz09/wilayah/0000000/key/{key}/",
        "nama": "Data SD",
        "jenis": "sekolah"
    },
    "SMP": {
        "url_template": "https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi/id/25/tahun/2024/id_tabel/dzdoVmp3YWdGNU0yWEgraVIwbmRqZz09/wilayah/0000000/key/{key}/",
        "nama": "Data SMP",
        "jenis": "sekolah"
    },
    "SMA": {
        "url_template": "https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi/id/25/tahun/2024/id_tabel/a1lFcnlHNXNYMFlueG8xL0ZOZnU0Zz09/wilayah/0000000/key/{key}/",
        "nama": "Data SMA",
        "jenis": "sekolah"
    },
    "SMK": {
        "url_template": "https://webapi.bps.go.id/v1/api/interoperabilitas/datasource/simdasi/id/25/tahun/2024/id_tabel/MU90V01YZ0RxenhmbFdsU21iUHh2Zz09/wilayah/0000000/key/{key}/",
        "nama": "Data SMK",
        "jenis": "sekolah"
    }
}


# ✅ HELPER: STYLE OPENPYXL
def _style_header(ws, row_num, col_count, title, subtitle=None):
    """Tambah header biru dengan judul dan subtitle opsional"""
    COLOR_HEADER = "1F4E79"
    COLOR_SUBHEADER = "2E75B6"

    # Judul utama
    ws.merge_cells(start_row=row_num, start_column=1, end_row=row_num, end_column=col_count)
    cell = ws.cell(row=row_num, column=1, value=title)
    cell.font = Font(name="Arial", bold=True, color="FFFFFF", size=14)
    cell.fill = PatternFill("solid", fgColor=COLOR_HEADER)
    cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[row_num].height = 30

    if subtitle:
        row_num += 1
        ws.merge_cells(start_row=row_num, start_column=1, end_row=row_num, end_column=col_count)
        cell = ws.cell(row=row_num, column=1, value=subtitle)
        cell.font = Font(name="Arial", italic=True, color="FFFFFF", size=10)
        cell.fill = PatternFill("solid", fgColor=COLOR_SUBHEADER)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[row_num].height = 20
        row_num += 1
    else:
        row_num += 1

    return row_num


def _style_col_headers(ws, row_num, headers, col_widths=None):
    """Buat baris header kolom dengan warna biru tua"""
    COLOR_COL_HEADER = "2E75B6"
    thin = Side(style="thin", color="FFFFFF")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=row_num, column=col_idx, value=header)
        cell.font = Font(name="Arial", bold=True, color="FFFFFF", size=10)
        cell.fill = PatternFill("solid", fgColor=COLOR_COL_HEADER)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border

    ws.row_dimensions[row_num].height = 35

    if col_widths:
        for col_idx, width in enumerate(col_widths, start=1):
            ws.column_dimensions[get_column_letter(col_idx)].width = width

    return row_num + 1


def _write_data_rows(ws, start_row, data_rows, number_cols=None, highlight_last=True):
    """Tulis baris data dengan alternating row color"""
    COLOR_EVEN = "DEEAF1" 
    COLOR_ODD = "FFFFFF"
    COLOR_TOTAL = "FFF2CC"

    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    for row_offset, row_data in enumerate(data_rows):
        row_num = start_row + row_offset
        is_last = (row_offset == len(data_rows) - 1) and highlight_last

        if is_last:
            fill_color = COLOR_TOTAL
            font_bold = True
        elif row_offset % 2 == 0:
            fill_color = COLOR_EVEN
            font_bold = False
        else:
            fill_color = COLOR_ODD
            font_bold = False

        fill = PatternFill("solid", fgColor=fill_color)

        for col_idx, value in enumerate(row_data, start=1):
            cell = ws.cell(row=row_num, column=col_idx, value=value)
            cell.fill = fill
            cell.border = border
            cell.font = Font(name="Arial", bold=font_bold, size=10)

            if number_cols and col_idx in number_cols:
                cell.alignment = Alignment(horizontal="right", vertical="center")
                if isinstance(value, float):
                    cell.number_format = '#,##0.00'
                elif isinstance(value, int):
                    cell.number_format = '#,##0'
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

        ws.row_dimensions[row_num].height = 18

    return start_row + len(data_rows)


def _add_source_footer(ws, row_num, col_count, source_text, timestamp=None):
    """Tambah footer sumber data"""
    row_num += 1
    ws.merge_cells(start_row=row_num, start_column=1, end_row=row_num, end_column=col_count)
    text = f"Sumber: {source_text}"
    if timestamp:
        text += f"  |  Waktu Pengambilan Data: {timestamp}"
    cell = ws.cell(row=row_num, column=1, value=text)
    cell.font = Font(name="Arial", italic=True, color="595959", size=9)
    cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[row_num].height = 16


# ENDPOINT: DOWNLOAD XLSX RLS
@api_view(['POST'])
def download_rls_xlsx(request):
    """Download dataset RLS (Rata-rata Lama Sekolah) sebagai file XLSX berformat bagus"""
    try:
        rls_data = request.data.get('rls_data')  # dict: {provinsi: {rls_laki_laki, rls_perempuan, rls_rata_rata}}
        timestamp = request.data.get('timestamp', datetime.now().isoformat())

        if not rls_data:
            return Response({"error": "Data RLS tidak ditemukan"}, status=400)

        wb = Workbook()
        ws = wb.active
        ws.title = "RLS"
        ws.sheet_view.showGridLines = False

        # Freeze pane
        ws.freeze_panes = "A4"

        # Header utama
        next_row = _style_header(
            ws, 1, 4,
            "RATA-RATA LAMA SEKOLAH (RLS) MENURUT JENIS KELAMIN",
            "Sumber: BPS Susenas | Tahun 2024 | Seluruh Provinsi Indonesia"
        )

        # Header kolom
        headers = ["No.", "Provinsi", "Laki-laki (Tahun)", "Perempuan (Tahun)", "Rata-rata (Tahun)"]
        col_widths = [6, 35, 20, 20, 20]
        next_row = _style_col_headers(ws, next_row, headers, col_widths)

        # Data rows — urutkan nama provinsi
        sorted_provinces = sorted(rls_data.items(), key=lambda x: x[0])
        data_rows = []
        for idx, (prov, data) in enumerate(sorted_provinces, start=1):
            data_rows.append([
                idx,
                data.get('provinsi', prov),
                data.get('rls_laki_laki', '-'),
                data.get('rls_perempuan', '-'),
                data.get('rls_rata_rata', '-'),
            ])

        _write_data_rows(ws, next_row, data_rows, number_cols={3, 4, 5}, highlight_last=False)

        # Footer
        _add_source_footer(ws, next_row + len(data_rows), 5,
                           "BPS Web API — Susenas, Variabel 459, Tahun 2024",
                           timestamp[:19].replace('T', ' ') if timestamp else None)

        # Kirim sebagai response file
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        tanggal = datetime.now().strftime("%Y-%m-%d")
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="Dataset_RLS_BPS_{tanggal}.xlsx"'
        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)

# ENDPOINT: DOWNLOAD XLSX APS
@api_view(['POST'])
def download_aps_xlsx(request):
    """Download dataset APS (Angka Partisipasi Sekolah) per kelompok umur sebagai XLSX"""
    try:
        aps_data = request.data.get('aps_data')  # dict: {provinsi: {aps_7_12, aps_13_15, aps_16_18, aps_19_23}}
        timestamp = request.data.get('timestamp', datetime.now().isoformat())

        if not aps_data:
            return Response({"error": "Data APS tidak ditemukan"}, status=400)

        wb = Workbook()
        ws = wb.active
        ws.title = "APS"
        ws.sheet_view.showGridLines = False
        ws.freeze_panes = "A4"

        next_row = _style_header(
            ws, 1, 5,
            "ANGKA PARTISIPASI SEKOLAH (APS) MENURUT KELOMPOK UMUR",
            "Sumber: BPS Susenas | Tahun 2025 | Seluruh Provinsi Indonesia"
        )

        headers = ["No.", "Provinsi", "APS 7-12 Tahun (%)", "APS 13-15 Tahun (%)", "APS 16-18 Tahun (%)", "APS 19-23 Tahun (%)"]
        col_widths = [6, 35, 20, 20, 20, 20]
        next_row = _style_col_headers(ws, next_row, headers, col_widths)

        sorted_provinces = sorted(aps_data.items(), key=lambda x: x[0])
        data_rows = []
        for idx, (prov, data) in enumerate(sorted_provinces, start=1):
            data_rows.append([
                idx,
                data.get('provinsi', prov),
                data.get('aps_7_12_tahun', '-'),
                data.get('aps_13_15_tahun', '-'),
                data.get('aps_16_18_tahun', '-'),
                data.get('aps_19_23_tahun', '-'),
            ])

        _write_data_rows(ws, next_row, data_rows, number_cols={3, 4, 5, 6}, highlight_last=False)

        _add_source_footer(ws, next_row + len(data_rows), 6,
                           "BPS Web API — Susenas, Variabel 2211, Tahun 2025",
                           timestamp[:19].replace('T', ' ') if timestamp else None)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        tanggal = datetime.now().strftime("%Y-%m-%d")
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="Dataset_APS_BPS_{tanggal}.xlsx"'
        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


# ENDPOINT: DOWNLOAD XLSX RASIO (SD, SMP, SMA, SMK — 4 sheet)
@api_view(['POST'])
def download_rasio_xlsx(request):
    """Download dataset Rasio Murid-Guru (SD, SMP, SMA, SMK) dalam 1 file XLSX dengan 4 sheet"""
    try:
        rasio_sd  = request.data.get('rasio_sd', {})
        rasio_smp = request.data.get('rasio_smp', {})
        rasio_sma = request.data.get('rasio_sma', {})
        rasio_smk = request.data.get('rasio_smk', {})
        timestamp = request.data.get('timestamp', datetime.now().isoformat())

        JENJANG_CONFIG = [
            ("SD",  rasio_sd,  "Sekolah Dasar (SD)"),
            ("SMP", rasio_smp, "Sekolah Menengah Pertama (SMP)"),
            ("SMA", rasio_sma, "Sekolah Menengah Atas (SMA)"),
            ("SMK", rasio_smk, "Sekolah Menengah Kejuruan (SMK)"),
        ]

        wb = Workbook()
        wb.remove(wb.active)

        for sheet_name, data_dict, label_panjang in JENJANG_CONFIG:
            ws = wb.create_sheet(title=sheet_name)
            ws.sheet_view.showGridLines = False
            ws.freeze_panes = "A4"

            next_row = _style_header(
                ws, 1, 4,
                f"RASIO MURID-GURU — {label_panjang.upper()}",
                f"Sumber: Kemdikbudristek DAPODIK | Semester Ganjil 2024/2025 | Seluruh Provinsi Indonesia"
            )

            headers = ["No.", "Provinsi", f"Jumlah Guru {sheet_name}", f"Jumlah Murid {sheet_name}", "Rasio Murid per Guru"]
            col_widths = [6, 35, 22, 22, 22]
            next_row = _style_col_headers(ws, next_row, headers, col_widths)

            sorted_provinces = sorted(data_dict.items(), key=lambda x: x[0])
            data_rows = []
            for idx, (prov, data) in enumerate(sorted_provinces, start=1):
                data_rows.append([
                    idx,
                    data.get('provinsi', prov),
                    data.get('jumlah_guru', '-'),
                    data.get('jumlah_murid', '-'),
                    data.get('rasio_murid_per_guru', '-'),
                ])

            _write_data_rows(ws, next_row, data_rows, number_cols={3, 4, 5}, highlight_last=False)

            _add_source_footer(ws, next_row + len(data_rows), 5,
                               f"BPS Web API — SIMDASI Kemdikbudristek, {sheet_name}, Tahun 2024",
                               timestamp[:19].replace('T', ' ') if timestamp else None)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        tanggal = datetime.now().strftime("%Y-%m-%d")
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="Dataset_Rasio_Murid_Guru_BPS_{tanggal}.xlsx"'
        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


# CLASS & FUNGSI YANG SUDAH ADA (TIDAK DIUBAH)
class PendidikanAnalytics:
    """Model analisis pendidikan dengan data BPS - RUMUS VALIDATED"""
    
    def __init__(self):
        self.colors = {
            "BAIK": "#10b981",
            "SEDANG": "#f59e0b",
            "KRITIS": "#ef4444"
        }
        self.timestamp_fetch = None
    
    def fetch_all_data(self):
        """Fetch semua data sekaligus dari BPS"""
        all_data = {}
        self.timestamp_fetch = datetime.now().isoformat()
        
        for indikator_key, config in INDIKATOR_PENDIDIKAN.items():
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
    
    def parse_rls_data(self, raw_data):
        """Parse data RLS dengan BREAKDOWN GENDER LENGKAP"""
        rls_values = {}
        rls_details = {}
        rls_raw_breakdown = {}
        
        if not raw_data:
            print("  ❌ RLS: No raw data")
            return rls_values, rls_details, rls_raw_breakdown
        
        try:
            datacontent = raw_data.get("datacontent", {})
            
            if not datacontent:
                print("  ❌ RLS: datacontent is empty")
                return rls_values, rls_details, rls_raw_breakdown
            
            print(f"  📊 RLS: datacontent has {len(datacontent)} keys")
            
            province_names = {
                '1100': 'ACEH', '1200': 'SUMATERA UTARA', '1300': 'SUMATERA BARAT',
                '1400': 'RIAU', '1500': 'JAMBI', '1600': 'SUMATERA SELATAN',
                '1700': 'BENGKULU', '1800': 'LAMPUNG', '1900': 'KEPULAUAN BANGKA BELITUNG',
                '2100': 'KEPULAUAN RIAU', '3100': 'JAKARTA', '3200': 'JAWA BARAT',
                '3300': 'JAWA TENGAH', '3400': 'DAERAH ISTIMEWA YOGYAKARTA', '3500': 'JAWA TIMUR',
                '3600': 'BANTEN', '5100': 'BALI', '5200': 'NUSA TENGGARA BARAT',
                '5300': 'NUSA TENGGARA TIMUR', '6100': 'KALIMANTAN BARAT',
                '6200': 'KALIMANTAN TENGAH', '6300': 'KALIMANTAN SELATAN',
                '6400': 'KALIMANTAN TIMUR', '6500': 'KALIMANTAN UTARA',
                '7100': 'SULAWESI UTARA', '7200': 'SULAWESI TENGAH',
                '7300': 'SULAWESI SELATAN', '7400': 'SULAWESI TENGGARA',
                '7500': 'GORONTALO', '7600': 'SULAWESI BARAT',
                '8100': 'MALUKU', '8200': 'MALUKU UTARA',
                '9100': 'PAPUA BARAT', '9200': 'PAPUA BARAT DAYA',
                '9400': 'PAPUA', '9500': 'PAPUA SELATAN',
                '9600': 'PAPUA TENGAH', '9700': 'PAPUA PEGUNUNGAN'
            }
            
            for prov_code, prov_name in province_names.items():
                try:
                    key_male = f"{prov_code}4592111240"
                    key_female = f"{prov_code}4592121240"
                    
                    rls_male = None
                    rls_female = None
                    
                    if key_male in datacontent and key_female in datacontent:
                        rls_male = datacontent.get(key_male)
                        rls_female = datacontent.get(key_female)
                    else:
                        matching_keys = [k for k in datacontent.keys() if k.startswith(prov_code + '459')]
                        if len(matching_keys) >= 2:
                            rls_male = datacontent.get(matching_keys[0])
                            rls_female = datacontent.get(matching_keys[1]) if len(matching_keys) > 1 else rls_male
                    
                    if rls_male is not None and rls_female is not None:
                        try:
                            rls_male_val = float(rls_male)
                            rls_female_val = float(rls_female)
                            rls_avg = round((rls_male_val + rls_female_val) / 2, 2)
                            
                            prov_normalized = normalize_province_name(prov_name)
                            rls_values[prov_normalized] = rls_avg
                            
                            rls_details[prov_normalized] = {
                                "laki_laki": round(rls_male_val, 2),
                                "perempuan": round(rls_female_val, 2),
                                "rata_rata": rls_avg
                            }
                            
                            rls_raw_breakdown[prov_normalized] = {
                                "provinsi": prov_normalized,
                                "rls_laki_laki": round(rls_male_val, 2),
                                "rls_perempuan": round(rls_female_val, 2),
                                "rls_rata_rata": rls_avg
                            }
                            
                            if len(rls_values) <= 3:
                                print(f"    ✓ {prov_normalized}: Laki={rls_male_val}, Perempuan={rls_female_val}, Avg={rls_avg}")
                        
                        except (ValueError, TypeError) as e:
                            print(f"    ✗ {prov_name}: Error converting values - {e}")
                            continue
                            
                except Exception as e:
                    print(f"    ✗ {prov_name}: Error - {e}")
                    continue
            
            print(f"  ✅ RLS: Parsed {len(rls_values)} provinces")
            
        except Exception as e:
            print(f"  ❌ Parse error for RLS: {e}")
            import traceback
            traceback.print_exc()
        
        return rls_values, rls_details, rls_raw_breakdown
    
    def parse_aps_data(self, raw_data):
        """Parse data APS - 4 KELOMPOK UMUR + RAW BREAKDOWN"""
        aps_values = {}
        aps_raw_breakdown = {}
        
        if not raw_data:
            return aps_values, aps_raw_breakdown
        
        try:
            datacontent = raw_data.get("datacontent", {})
            vervar_list = raw_data.get("vervar", [])
            turvar_list = raw_data.get("turvar", [])
            
            province_code_map = {}
            for item in vervar_list:
                code = str(item.get("val", ""))
                label = item.get("label", "")
                if code and label and code != "9999" and code.endswith("00"):
                    province_code_map[code] = label
            
            turvar_map = {}
            for item in turvar_list:
                code = str(item.get("val", ""))
                label = item.get("label", "")
                turvar_map[code] = label
            
            temp_data = {}
            
            for key, value in datacontent.items():
                try:
                    if len(key) != 16:
                        continue
                    
                    prov_code = key[0:4]
                    var_code = key[4:8]
                    turvar_code = key[8:12]
                    
                    if prov_code == "9999" or var_code != "2211":
                        continue
                    
                    provinsi_name = province_code_map.get(prov_code)
                    
                    if provinsi_name and value is not None:
                        provinsi_clean = normalize_province_name(str(provinsi_name))
                        value_float = float(value)
                        umur_label = turvar_map.get(turvar_code)
                        
                        if umur_label:
                            if provinsi_clean not in temp_data:
                                temp_data[provinsi_clean] = {}
                            temp_data[provinsi_clean][umur_label] = value_float
                            
                except (ValueError, TypeError, IndexError):
                    continue
            
            for prov, umur_data in temp_data.items():
                formatted_data = {}
                raw_breakdown_data = {"provinsi": prov}
                
                for key, val in umur_data.items():
                    if key == '7-12':
                        formatted_data['7_12'] = val
                        raw_breakdown_data['aps_7_12_tahun'] = val
                    elif key == '13-15':
                        formatted_data['13_15'] = val
                        raw_breakdown_data['aps_13_15_tahun'] = val
                    elif key == '16-18':
                        formatted_data['16_18'] = val
                        raw_breakdown_data['aps_16_18_tahun'] = val
                    elif key == '19-23':
                        formatted_data['19_23'] = val
                        raw_breakdown_data['aps_19_23_tahun'] = val
                    else:
                        formatted_data[key.replace('-', '_')] = val
                        raw_breakdown_data[f'aps_{key}'] = val
                
                aps_values[prov] = formatted_data
                aps_raw_breakdown[prov] = raw_breakdown_data
            
            print(f"  ✅ Parsed {len(aps_values)} provinces for APS")
            
        except Exception as e:
            print(f"  ❌ Parse error for APS: {e}")
        
        return aps_values, aps_raw_breakdown
    
    def parse_school_data(self, raw_data, jenjang):
        """Parse data sekolah untuk menghitung rasio murid-guru + RAW DATA"""
        rasio_values = {}
        raw_breakdown = {}
        
        if not raw_data:
            return rasio_values, raw_breakdown
        
        try:
            data_container = raw_data.get('data', [])
            
            if not data_container or len(data_container) < 2:
                return rasio_values, raw_breakdown
            
            table_data = data_container[1]
            
            if not isinstance(table_data, dict):
                return rasio_values, raw_breakdown
            
            data_rows = table_data.get('data', [])
            
            if not data_rows:
                return rasio_values, raw_breakdown
            
            for row_data in data_rows:
                try:
                    if not isinstance(row_data, dict):
                        continue
                    
                    prov_name_raw = row_data.get('label', '').strip()
                    
                    if not prov_name_raw or prov_name_raw.upper() == 'INDONESIA':
                        continue
                    
                    prov_lower = prov_name_raw.lower()
                    if any(x in prov_lower for x in ['kab', 'kota', 'kabupaten', 'kecamatan']):
                        continue
                    
                    variables = row_data.get('variables', {})
                    if not variables:
                        continue
                    
                    guru_key = None
                    murid_key = None
                    
                    kolom_info = table_data.get('kolom', {})
                    
                    for key, value in variables.items():
                        var_name = kolom_info.get(key, {}).get('nama_variabel', '')
                        if 'Guru' in var_name and '(Negeri+Swasta)' in var_name:
                            guru_key = key
                        elif 'Murid' in var_name and '(Negeri+Swasta)' in var_name:
                            murid_key = key
                    
                    if not guru_key or not murid_key:
                        continue
                    
                    guru_data = variables.get(guru_key, {})
                    murid_data = variables.get(murid_key, {})
                    
                    guru_raw = guru_data.get('value', '').strip()
                    murid_raw = murid_data.get('value', '').strip()
                    
                    guru_clean = guru_raw.replace('.', '').replace(',', '').replace(' ', '').strip()
                    murid_clean = murid_raw.replace('.', '').replace(',', '').replace(' ', '').strip()
                    
                    if not guru_clean or not murid_clean or guru_clean in ['-', '...'] or murid_clean in ['-', '...']:
                        continue
                    
                    try:
                        guru = float(guru_clean)
                        murid = float(murid_clean)
                    except ValueError:
                        continue
                    
                    if guru > 0 and murid > 0:
                        prov_name = normalize_province_name(prov_name_raw)
                        rasio = round(murid / guru, 2)
                        rasio_values[prov_name] = rasio
                        
                        raw_breakdown[prov_name] = {
                            "provinsi": prov_name,
                            "jumlah_guru": int(guru),
                            "jumlah_murid": int(murid),
                            "rasio_murid_per_guru": rasio
                        }
                        
                except (ValueError, TypeError, KeyError):
                    continue
            
            print(f"  ✅ {jenjang}: Successfully parsed {len(rasio_values)} provinces")
            
        except Exception as e:
            print(f"  ❌ {jenjang}: Parse error - {str(e)}")
        
        return rasio_values, raw_breakdown


def normalize_province_name(name):
    """Normalisasi nama provinsi untuk matching"""
    if not isinstance(name, str):
        name = str(name)
    
    name = name.upper().strip()
    
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
    
    for key, value in special_mappings.items():
        if key in name:
            return value
    
    abbreviations = {
        'KEP.': 'KEPULAUAN',
        'KEP ': 'KEPULAUAN ',
        'NTB': 'NUSA TENGGARA BARAT',
        'NTT': 'NUSA TENGGARA TIMUR',
    }
    
    for abbr, full in abbreviations.items():
        if abbr in name:
            name = name.replace(abbr, full)
    
    prefixes = ['PROVINSI ', 'PROV. ', 'PROV ', 'DAERAH KHUSUS IBUKOTA ']
    for prefix in prefixes:
        if name.startswith(prefix):
            name = name[len(prefix):]
    
    return name.strip()


def calculate_scores(rls_value, aps_data, rasio_data):
    """Hitung skor berdasarkan RLS, APS, dan Rasio"""
    
    skor_rls = 0
    if rls_value is not None:
        if rls_value > 9.5:
            skor_rls = 3
        elif rls_value >= 8.0:
            skor_rls = 2
        else:
            skor_rls = 1
    
    skor_aps_list = []
    aps_details = {}
    
    if isinstance(aps_data, dict):
        umur_keys = ['7_12', '13_15', '16_18', '19_23']
        
        for key in umur_keys:
            value = aps_data.get(key)
            aps_details[key] = value
            
            if value is not None:
                if value > 80:
                    skor = 3
                elif value >= 70:
                    skor = 2
                else:
                    skor = 1
                skor_aps_list.append(skor)
    
    if skor_aps_list:
        skor_aps = round(sum(skor_aps_list) / len(skor_aps_list), 2)
    else:
        skor_aps = 0
    
    rasio_values = []
    rasio_details = {}
    jenjang_keys = ['SD', 'SMP', 'SMA', 'SMK']
    
    for key in jenjang_keys:
        value = rasio_data.get(key)
        rasio_details[key] = value
        if value is not None and value > 0:
            rasio_values.append(value)
    
    rasio_rata = round(sum(rasio_values) / len(rasio_values), 2) if rasio_values else 0
    
    skor_rasio = 0
    if rasio_rata > 0:
        if rasio_rata < 12:
            skor_rasio = 3
        elif rasio_rata <= 16:
            skor_rasio = 2
        else:
            skor_rasio = 1
    
    skor_total = round((0.3 * skor_rls) + (0.5 * skor_aps) + (0.2 * skor_rasio), 2)
    
    return {
        'skor_rls': skor_rls,
        'skor_aps': skor_aps,
        'skor_rasio': skor_rasio,
        'skor_total': skor_total,
        'rasio_rata': rasio_rata,
        'aps_details': aps_details,
        'rasio_details': rasio_details,
        'aps_count': len(skor_aps_list)
    }


def categorize_province(skor_total):
    """Kategorikan provinsi berdasarkan skor total"""
    colors = {
        "BAIK": "#10b981",
        "SEDANG": "#f59e0b",
        "KRITIS": "#ef4444"
    }
    
    if skor_total >= 2.4:
        return "BAIK", colors["BAIK"]
    elif skor_total >= 1.8:
        return "SEDANG", colors["SEDANG"]
    else:
        return "KRITIS", colors["KRITIS"]


def generate_insights(provinsi, rls_value, aps_data, rasio_rata, kategori, skor_total, aps_details=None, rasio_details=None):
    """Generate insights berdasarkan data"""
    insights = []
    
    insights.append(f"Provinsi {provinsi} berada pada kategori {kategori} dengan skor total {skor_total}.")
    
    if rls_value is not None:
        if rls_value < 8.0:
            insights.append(f"⚠️ Rata-rata lama sekolah ({rls_value} tahun) masih di bawah target nasional 9 tahun.")
        elif rls_value >= 9.5:
            insights.append(f"✅ Rata-rata lama sekolah ({rls_value} tahun) sudah melampaui target nasional.")
    
    if aps_details:
        aps_values = [v for v in aps_details.values() if v is not None]
        if aps_values:
            min_aps = min(aps_values)
            if min_aps < 70:
                insights.append(f"📉 Terdapat kelompok umur dengan APS di bawah 70%, memerlukan perhatian khusus.")
    
    if rasio_rata > 16:
        insights.append(f"👥 Rasio murid-guru ({rasio_rata}) menunjukkan kekurangan guru di wilayah ini.")
    elif rasio_rata < 12:
        insights.append(f"✅ Rasio murid-guru ({rasio_rata}) dalam kondisi ideal.")
    
    return insights


def generate_recommendations(kategori, rls_value, aps_data, rasio_rata):
    """Generate rekomendasi berdasarkan kondisi"""
    recommendations = []
    
    if kategori == "KRITIS":
        recommendations.append({
            'priority': 'Tinggi',
            'title': 'Percepatan Peningkatan Kualitas Pendidikan',
            'actions': [
                'Alokasi dana khusus untuk peningkatan infrastruktur pendidikan',
                'Program beasiswa dan bantuan pendidikan untuk siswa kurang mampu',
                'Rekrutmen dan pelatihan guru berkualitas',
                'Kampanye wajib belajar 12 tahun'
            ]
        })
    elif kategori == "SEDANG":
        recommendations.append({
            'priority': 'Sedang',
            'title': 'Optimalisasi Program Pendidikan',
            'actions': [
                'Peningkatan kualitas pembelajaran melalui pelatihan guru',
                'Perbaikan sarana dan prasarana sekolah',
                'Program pengurangan angka putus sekolah',
                'Integrasi teknologi dalam pembelajaran'
            ]
        })
    else:
        recommendations.append({
            'priority': 'Rendah',
            'title': 'Pemeliharaan dan Inovasi',
            'actions': [
                'Pengembangan pusat keunggulan pendidikan',
                'Program pertukaran guru dan siswa',
                'Inovasi kurikulum berbasis kompetensi abad 21',
                'Kolaborasi dengan institusi pendidikan internasional'
            ]
        })
    
    if rasio_rata > 16:
        recommendations.append({
            'priority': 'Tinggi',
            'title': 'Penanganan Kekurangan Guru',
            'actions': [
                'Rekrutmen guru honorer menjadi PNS/PPPK',
                'Program penempatan guru di daerah terpencil',
                'Pelatihan guru multi-kompetensi'
            ]
        })
    
    return recommendations


@api_view(['POST'])
def analyze_education_bps(request):
    """Analisis pendidikan menggunakan BPS Web API"""
    
    if not BPS_API_KEY:
        return Response({
            "error": "BPS Web API Key belum dikonfigurasi",
            "message": "Silakan tambahkan BPS_WEB_API_KEY di file .env"
        }, status=500)
    
    try:
        analytics = PendidikanAnalytics()
        
        print("\n=== MULAI FETCH DATA DARI BPS ===")
        raw_data = analytics.fetch_all_data()
        
        print("\n=== PARSE DATA PER PROVINSI ===")
        
        rls_values, rls_details, rls_raw_breakdown = analytics.parse_rls_data(raw_data.get('RLS'))
        aps_values, aps_raw_breakdown = analytics.parse_aps_data(raw_data.get('APS'))
        rasio_sd, rasio_sd_raw = analytics.parse_school_data(raw_data.get('SD'), 'SD')
        rasio_smp, rasio_smp_raw = analytics.parse_school_data(raw_data.get('SMP'), 'SMP')
        rasio_sma, rasio_sma_raw = analytics.parse_school_data(raw_data.get('SMA'), 'SMA')
        rasio_smk, rasio_smk_raw = analytics.parse_school_data(raw_data.get('SMK'), 'SMK')
        
        print("\n=== LOAD BOUNDARY DATA ===")
        cursor = mongo_db["batas_provinsi"].find({}, {'_id': 0})
        boundary_features = list(cursor)
        
        province_map = {}
        for feature in boundary_features:
            props = feature.get('properties', {})
            for field in ['NAMOBJ', 'name', 'WADMPR', 'Provinsi']:
                if field in props and props[field]:
                    official_name = str(props[field]).upper().strip()
                    normalized = normalize_province_name(official_name)
                    province_map[normalized] = feature
                    province_map[official_name] = feature
        
        print(f"Loaded {len(province_map)} province boundaries")
        
        all_provinces = set()
        all_provinces.update(rls_values.keys())
        all_provinces.update(aps_values.keys())
        all_provinces.update(rasio_sd.keys())
        all_provinces.update(rasio_smp.keys())
        all_provinces.update(rasio_sma.keys())
        all_provinces.update(rasio_smk.keys())
        
        print(f"\n=== PROCESSING {len(all_provinces)} PROVINCES ===")
        
        matched_features = []
        analysis_summary = []
        kategori_counts = {"BAIK": 0, "SEDANG": 0, "KRITIS": 0}
        
        for prov_name in sorted(all_provinces):
            rls_value = rls_values.get(prov_name)
            aps_prov = aps_values.get(prov_name, {})
            rasio_prov = {
                'SD': rasio_sd.get(prov_name),
                'SMP': rasio_smp.get(prov_name),
                'SMA': rasio_sma.get(prov_name),
                'SMK': rasio_smk.get(prov_name)
            }
            
            scores = calculate_scores(rls_value, aps_prov, rasio_prov)
            kategori, warna = categorize_province(scores['skor_total'])
            
            normalized_prov = normalize_province_name(prov_name)
            matched_feature = None
            
            if normalized_prov in province_map:
                matched_feature = province_map[normalized_prov]
            elif prov_name in province_map:
                matched_feature = province_map[prov_name]
            else:
                for map_name, feature in province_map.items():
                    if normalized_prov in map_name or map_name in normalized_prov:
                        matched_feature = feature
                        break
            
            if not matched_feature:
                continue
            
            insights = generate_insights(
                prov_name, rls_value, aps_prov, 
                scores['rasio_rata'], kategori, scores['skor_total'],
                scores.get('aps_details'), scores.get('rasio_details')
            )
            recommendations = generate_recommendations(kategori, rls_value, aps_prov, scores['rasio_rata'])
            
            kategori_counts[kategori] += 1
            
            feature_copy = matched_feature.copy()
            props = feature_copy.get('properties', {})
            
            props['education_analysis'] = {
                'nama_provinsi': prov_name,
                'kategori': kategori,
                'warna': warna,
                'skor_total': scores['skor_total'],
                'skor_rls': scores['skor_rls'],
                'skor_aps': scores['skor_aps'],
                'skor_rasio': scores['skor_rasio'],
                'insights': insights,
                'rekomendasi': recommendations,
                'data_pendidikan': {
                    'RLS': rls_value,
                    'RLS_DETAIL': rls_details.get(prov_name, {}),
                    'APS_7_12': aps_prov.get('7_12'),
                    'APS_13_15': aps_prov.get('13_15'),
                    'APS_16_18': aps_prov.get('16_18'),
                    'APS_19_23': aps_prov.get('19_23'),
                    'SKOR_APS': scores['skor_aps'],
                    'RASIO_SD': rasio_prov['SD'],
                    'RASIO_SMP': rasio_prov['SMP'],
                    'RASIO_SMA': rasio_prov['SMA'],
                    'RASIO_SMK': rasio_prov['SMK'],
                    'RASIO_RATA': scores['rasio_rata']
                }
            }
            
            feature_copy['properties'] = props
            matched_features.append(feature_copy)
            
            analysis_summary.append({
                'provinsi': prov_name,
                'kategori': kategori,
                'warna': warna,
                'skor_total': scores['skor_total'],
                'rls': rls_value,
                'skor_aps': scores['skor_aps'],
                'rasio_rata': scores['rasio_rata']
            })
            
            print(f"  ✓ {prov_name}: {kategori} (Skor: {scores['skor_total']})")
        
        print(f"\n=== ANALYSIS COMPLETE ===")
        print(f"Total: {len(matched_features)} provinces")
        
        raw_datasets = {
            'timestamp': analytics.timestamp_fetch,
            'RLS': rls_raw_breakdown,
            'APS': aps_raw_breakdown,
            'RASIO_SD': rasio_sd_raw,
            'RASIO_SMP': rasio_smp_raw,
            'RASIO_SMA': rasio_sma_raw,
            'RASIO_SMK': rasio_smk_raw
        }
        
        return Response({
            'status': 'success',
            'source': 'BPS Web API - 6 Endpoints',
            'total_success': len(matched_features),
            'kategori_distribusi': kategori_counts,
            'timestamp': analytics.timestamp_fetch,
            'matched_features': {
                'type': 'FeatureCollection',
                'features': matched_features
            },
            'analysis_summary': analysis_summary,
            'raw_datasets': raw_datasets
        })
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e),
            'message': 'Gagal menganalisis data pendidikan dari BPS'
        }, status=500)


@api_view(['POST'])
def save_education_analysis(request):
    """Simpan hasil analisis pendidikan"""
    try:
        data = request.data
        analysis_name = data.get('name', 'Analisis Pendidikan Tanpa Nama')
        analysis_data = data.get('analysis_data')
        
        if not analysis_data:
            return Response({"error": "Data analisis tidak ditemukan"}, status=400)
        
        analysis_id = str(uuid.uuid4())
        
        document = {
            "analysis_id": analysis_id,
            "name": analysis_name,
            "type": "education",
            "timestamp": datetime.now().isoformat(),
            **analysis_data
        }
        
        mongo_db["education_analysis"].insert_one(document)
        
        return Response({
            "status": "success",
            "message": f"Analisis pendidikan '{analysis_name}' berhasil disimpan",
            "analysis_id": analysis_id,
            "saved_at": document["timestamp"]
        })
        
    except Exception as e:
        return Response({
            "error": str(e),
            "message": "Gagal menyimpan analisis"
        }, status=500)


@api_view(['GET'])
def get_education_analysis_list(request):
    """Get list semua analisis pendidikan"""
    try:
        cursor = mongo_db["education_analysis"].find(
            {},
            {
                '_id': 0,
                'analysis_id': 1,
                'name': 1,
                'timestamp': 1,
                'total_success': 1,
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
        return Response({
            "error": str(e),
            "message": "Gagal mengambil daftar analisis"
        }, status=500)


@api_view(['GET'])
def get_education_analysis_detail(request, analysis_id):
    """Get detail analisis pendidikan"""
    try:
        result = mongo_db["education_analysis"].find_one(
            {"analysis_id": analysis_id},
            {'_id': 0}
        )
        
        if not result:
            return Response({
                "error": "Analisis tidak ditemukan"
            }, status=404)
        
        return Response(result)
        
    except Exception as e:
        return Response({
            "error": str(e),
            "message": "Gagal mengambil detail analisis"
        }, status=500)


@api_view(['DELETE'])
def delete_education_analysis(request, analysis_id):
    """Hapus analisis pendidikan"""
    try:
        result = mongo_db["education_analysis"].delete_one(
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
        return Response({
            "error": str(e),
            "message": "Gagal menghapus analisis"
        }, status=500)