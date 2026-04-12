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


COLLECTION = "waypoint_pertahanan"


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

class WaypointPertahananView(View):
    """GET /api/waypoint/pertahanan/ → semua kategori fasilitas pertahanan / militer"""

    def get(self, request):
        try:
            data = fetch_by_category()
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMilitaryBaseView(View):
    """GET /api/waypoint/pertahanan/base/ → Markas / Pangkalan Militer"""

    def get(self, request):
        try:
            data = fetch_by_category("base")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMilitaryBarracksView(View):
    """GET /api/waypoint/pertahanan/barracks/ → Batalyon / Asrama Militer"""

    def get(self, request):
        try:
            data = fetch_by_category("barracks")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMilitaryCheckpointView(View):
    """GET /api/waypoint/pertahanan/checkpoint/ → Pos Pemeriksaan / Penjagaan"""

    def get(self, request):
        try:
            data = fetch_by_category("checkpoint")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMilitaryOfficeView(View):
    """GET /api/waypoint/pertahanan/office/ → Kantor / Staf Militer"""

    def get(self, request):
        try:
            data = fetch_by_category("military_office")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMilitaryTrainingView(View):
    """GET /api/waypoint/pertahanan/training-area/ → Area Latihan Militer"""

    def get(self, request):
        try:
            data = fetch_by_category("training_area")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointAirfieldView(View):
    """GET /api/waypoint/pertahanan/airfield/ → Pangkalan Udara TNI AU"""

    def get(self, request):
        try:
            data = fetch_by_category("airfield")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointNavalBaseView(View):
    """GET /api/waypoint/pertahanan/naval-base/ → Pangkalan Laut TNI AL"""

    def get(self, request):
        try:
            data = fetch_by_category("naval_base")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)