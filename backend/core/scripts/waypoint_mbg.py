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


COLLECTION = "waypoint_mbg"


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

class WaypointMbgView(View):
    """GET /api/waypoint/mbg/ → semua titik MBG"""

    def get(self, request):
        try:
            data = fetch_by_category()
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMbgCommunityCentreView(View):
    """GET /api/waypoint/mbg/community-centre/ → Pusat Komunitas / MBG"""

    def get(self, request):
        try:
            data = fetch_by_category("community_centre")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMbgKitchenView(View):
    """GET /api/waypoint/mbg/kitchen/ → Dapur Umum MBG"""

    def get(self, request):
        try:
            data = fetch_by_category("kitchen")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMbgFoodCentreView(View):
    """GET /api/waypoint/mbg/food-centre/ → Pusat Makan Bergizi"""

    def get(self, request):
        try:
            data = fetch_by_category("food_centre")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMbgNutritionCentreView(View):
    """GET /api/waypoint/mbg/nutrition-centre/ → Pusat Gizi / Kebun Gizi"""

    def get(self, request):
        try:
            data = fetch_by_category("nutrition_centre")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


class WaypointMbgCanteenView(View):
    """GET /api/waypoint/mbg/canteen/ → Kantin / Warung MBG"""

    def get(self, request):
        try:
            data = fetch_by_category("canteen")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)