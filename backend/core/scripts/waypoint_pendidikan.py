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
 
 
COLLECTION = "waypoint_pendidikan"
 
 
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
 
class WaypointPendidikanView(View):
    """GET /api/waypoint/pendidikan/ → semua kategori pendidikan sekaligus"""
 
    def get(self, request):
        try:
            data = fetch_by_category(category=None)
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
 
 
class WaypointSchoolView(View):
    """GET /api/waypoint/pendidikan/school/ → SD/SMP/SMA/SMK"""
 
    def get(self, request):
        try:
            data = fetch_by_category("school")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
 
 
class WaypointKindergartenView(View):
    """GET /api/waypoint/pendidikan/kindergarten/ → TK / PAUD"""
 
    def get(self, request):
        try:
            data = fetch_by_category("kindergarten")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
 
 
class WaypointCollegeView(View):
    """GET /api/waypoint/pendidikan/college/ → Politeknik / Akademi"""
 
    def get(self, request):
        try:
            data = fetch_by_category("college")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
 
 
class WaypointUniversityView(View):
    """GET /api/waypoint/pendidikan/university/ → Universitas / Institut"""
 
    def get(self, request):
        try:
            data = fetch_by_category("university")
            return JsonResponse(data, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)