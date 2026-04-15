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


COLLECTION = "waypoint_kesehatan"


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

class WaypointKesehatanView(View):
    """GET /api/waypoint/kesehatan/ → semua kategori kesehatan sekaligus"""

    def get(self, request):
        try:
            data = fetch_by_category(category=None)
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointHospitalView(View):
    """GET /api/waypoint/kesehatan/hospital/ → Rumah Sakit"""

    def get(self, request):
        try:
            data = fetch_by_category("hospital")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointClinicView(View):
    """GET /api/waypoint/kesehatan/clinic/ → Klinik / Puskesmas"""

    def get(self, request):
        try:
            data = fetch_by_category("clinic")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointHealthPostView(View):
    """GET /api/waypoint/kesehatan/health-post/ → Pos Kesehatan / Posyandu"""

    def get(self, request):
        try:
            data = fetch_by_category("health_post")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointPharmacyView(View):
    """GET /api/waypoint/kesehatan/pharmacy/ → Apotek / Farmasi"""

    def get(self, request):
        try:
            data = fetch_by_category("pharmacy")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)