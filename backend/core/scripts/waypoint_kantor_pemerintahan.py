import os
from django.http import JsonResponse
from django.views import View
from pymongo import MongoClient
from dotenv import load_dotenv

# ─── Koneksi MongoDB ──────────────────────────────────────────────────────────

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.abspath(os.path.join(BASE_DIR, '..', '..', '.env'))
load_dotenv(DOTENV_PATH)


def get_db():
    user    = os.getenv("DB_MONGO_USER")
    pw      = os.getenv("DB_MONGO_PASSWORD")
    host    = os.getenv("DB_MONGO_HOST", "localhost")
    port    = os.getenv("DB_MONGO_PORT", "27017")
    db_name = os.getenv("DB_MONGO_NAME")

    uri    = f"mongodb://{user}:{pw}@{host}:{port}/" if user and pw else f"mongodb://{host}:{port}/"
    client = MongoClient(uri)
    return client[db_name]


COLLECTION = "waypoint_pemerintahan"


def fetch_by_category(category: str | None = None):
    """Ambil semua dokumen dari koleksi, filter per kategori jika diberikan."""
    db    = get_db()
    query = {}
    if category:
        query["properties.category"] = category

    docs = list(db[COLLECTION].find(query, {"_id": 0}))

    return {
        "type": "FeatureCollection",
        "features": docs,
    }


# ─── Views ────────────────────────────────────────────────────────────────────

class WaypointPemerintahanView(View):
    """GET /api/waypoint/pemerintahan/ → semua kategori kantor pemerintahan"""

    def get(self, request):
        try:
            data = fetch_by_category()
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointTownhallView(View):
    """GET /api/waypoint/pemerintahan/townhall/ → Kantor Walikota / Bupati / Gubernur"""

    def get(self, request):
        try:
            data = fetch_by_category("townhall")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointVillageOfficeView(View):
    """GET /api/waypoint/pemerintahan/village-office/ → Kantor Desa / Kelurahan / Kecamatan"""

    def get(self, request):
        try:
            data = fetch_by_category("village_office")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointGovernmentOfficeView(View):
    """GET /api/waypoint/pemerintahan/government-office/ → Kantor Pemerintahan Umum"""

    def get(self, request):
        try:
            data = fetch_by_category("government_office")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMinistryView(View):
    """GET /api/waypoint/pemerintahan/ministry/ → Kementerian / Direktorat"""

    def get(self, request):
        try:
            data = fetch_by_category("ministry")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointPoliceView(View):
    """GET /api/waypoint/pemerintahan/police/ → Kepolisian"""

    def get(self, request):
        try:
            data = fetch_by_category("police")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointFireStationView(View):
    """GET /api/waypoint/pemerintahan/fire-station/ → Pemadam Kebakaran"""

    def get(self, request):
        try:
            data = fetch_by_category("fire_station")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointCourthouseView(View):
    """GET /api/waypoint/pemerintahan/courthouse/ → Pengadilan / Kejaksaan"""

    def get(self, request):
        try:
            data = fetch_by_category("courthouse")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointCustomsView(View):
    """GET /api/waypoint/pemerintahan/customs/ → Bea Cukai"""

    def get(self, request):
        try:
            data = fetch_by_category("customs")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointImmigrationView(View):
    """GET /api/waypoint/pemerintahan/immigration/ → Kantor Imigrasi"""

    def get(self, request):
        try:
            data = fetch_by_category("immigration")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointTaxOfficeView(View):
    """GET /api/waypoint/pemerintahan/tax-office/ → Kantor Pajak"""

    def get(self, request):
        try:
            data = fetch_by_category("tax_office")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointLegislativeView(View):
    """GET /api/waypoint/pemerintahan/legislative/ → Lembaga Legislatif (DPR/DPRD)"""

    def get(self, request):
        try:
            data = fetch_by_category("legislative")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)