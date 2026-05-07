import os
import re
from pymongo import MongoClient
from dotenv import load_dotenv

from rest_framework.decorators import api_view
from rest_framework.response import Response

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


def _fetch(collection: str, category: str = None):
    """Helper: ambil dokumen dari koleksi, filter kategori jika ada."""
    db    = get_db()
    query = {"properties.category": category} if category else {}
    docs  = list(db[collection].find(query, {"_id": 0}))
    return {"type": "FeatureCollection", "features": docs}

# ----------------------------------


# PENDIDIKAN
# ----------------------------------
@api_view(['GET'])
def waypoint_pendidikan(request):
    """GET /api/waypoint/pendidikan/"""
    try:
        return Response(_fetch("waypoint_pendidikan"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ─── Helper deteksi jenjang dari nama ────────────────────────────────────────
SMK_PAT = re.compile(r'\b(SMK|SMKN|SMKS|Vocational|Kejuruan)\b', re.I)
SMA_PAT = re.compile(r'\b(SMA|SMAN|SMAS|MA|MAN|MAS|SLTA|Aliyah)\b', re.I)
SMP_PAT = re.compile(r'\b(SMP|SMPN|SMPS|MTs|MTsN|MTsS|SLTP|Tsanawiyah)\b', re.I)
SD_PAT  = re.compile(r'\b(SD|SDN|SDS|MI|MIN|MIS|Ibtidaiyah|Elementary)\b', re.I)

def _fetch_school_by_jenjang(jenjang: str):
    db   = get_db()
    docs = list(db["waypoint_pendidikan"].find(
        {"properties.amenity": "school"}, {"_id": 0}
    ))
    filtered = []
    for doc in docs:
        name = doc.get("properties", {}).get("name", "")
        if jenjang == "smk" and SMK_PAT.search(name):
            filtered.append(doc)
        elif jenjang == "sma" and not SMK_PAT.search(name) and SMA_PAT.search(name):
            filtered.append(doc)
        elif jenjang == "smp" and SMP_PAT.search(name):
            filtered.append(doc)
        elif jenjang == "sd" and SD_PAT.search(name):
            filtered.append(doc)
    return {"type": "FeatureCollection", "features": filtered}

@api_view(['GET'])
def waypoint_sd(request):
    """GET /api/waypoint/pendidikan/sd/"""
    try:
        return Response(_fetch_school_by_jenjang("sd"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_smp(request):
    """GET /api/waypoint/pendidikan/smp/"""
    try:
        return Response(_fetch_school_by_jenjang("smp"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_sma(request):
    """GET /api/waypoint/pendidikan/sma/"""
    try:
        return Response(_fetch_school_by_jenjang("sma"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_smk(request):
    """GET /api/waypoint/pendidikan/smk/"""
    try:
        return Response(_fetch_school_by_jenjang("smk"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_kindergarten(request):
    """GET /api/waypoint/pendidikan/kindergarten/"""
    try:
        return Response(_fetch("waypoint_pendidikan", "kindergarten"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_college(request):
    """GET /api/waypoint/pendidikan/college/"""
    try:
        return Response(_fetch("waypoint_pendidikan", "college"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_university(request):
    """GET /api/waypoint/pendidikan/university/"""
    try:
        return Response(_fetch("waypoint_pendidikan", "university"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ----------------------------------


# KESEHATAN
# ----------------------------------
@api_view(['GET'])
def waypoint_kesehatan(request):
    """GET /api/waypoint/kesehatan/"""
    try:
        return Response(_fetch("waypoint_kesehatan"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_hospital(request):
    """GET /api/waypoint/kesehatan/hospital/"""
    try:
        return Response(_fetch("waypoint_kesehatan", "hospital"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_clinic(request):
    """GET /api/waypoint/kesehatan/clinic/"""
    try:
        return Response(_fetch("waypoint_kesehatan", "clinic"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_health_post(request):
    """GET /api/waypoint/kesehatan/health-post/"""
    try:
        return Response(_fetch("waypoint_kesehatan", "health_post"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_pharmacy(request):
    """GET /api/waypoint/kesehatan/pharmacy/"""
    try:
        return Response(_fetch("waypoint_kesehatan", "pharmacy"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ----------------------------------


# KANTOR PEMERINTAHAN
# ----------------------------------
@api_view(['GET'])
def waypoint_pemerintahan(request):
    """GET /api/waypoint/pemerintahan/"""
    try:
        return Response(_fetch("waypoint_pemerintahan"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_townhall(request):
    """GET /api/waypoint/pemerintahan/townhall/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "townhall"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_village_office(request):
    """GET /api/waypoint/pemerintahan/village-office/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "village_office"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_government_office(request):
    """GET /api/waypoint/pemerintahan/government-office/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "government_office"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_ministry(request):
    """GET /api/waypoint/pemerintahan/ministry/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "ministry"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_police(request):
    """GET /api/waypoint/pemerintahan/police/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "police"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_fire_station(request):
    """GET /api/waypoint/pemerintahan/fire-station/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "fire_station"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_courthouse(request):
    """GET /api/waypoint/pemerintahan/courthouse/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "courthouse"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_customs(request):
    """GET /api/waypoint/pemerintahan/customs/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "customs"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_immigration(request):
    """GET /api/waypoint/pemerintahan/immigration/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "immigration"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_tax_office(request):
    """GET /api/waypoint/pemerintahan/tax-office/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "tax_office"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_legislative(request):
    """GET /api/waypoint/pemerintahan/legislative/"""
    try:
        return Response(_fetch("waypoint_pemerintahan", "legislative"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ----------------------------------


# MBG (MAKAN BERGIZI GRATIS)
# ----------------------------------
@api_view(['GET'])
def waypoint_mbg(request):
    """GET /api/waypoint/mbg/"""
    try:
        return Response(_fetch("waypoint_mbg"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_mbg_community_centre(request):
    """GET /api/waypoint/mbg/community-centre/"""
    try:
        return Response(_fetch("waypoint_mbg", "community_centre"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_mbg_kitchen(request):
    """GET /api/waypoint/mbg/kitchen/"""
    try:
        return Response(_fetch("waypoint_mbg", "kitchen"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_mbg_food_centre(request):
    """GET /api/waypoint/mbg/food-centre/"""
    try:
        return Response(_fetch("waypoint_mbg", "food_centre"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_mbg_nutrition_centre(request):
    """GET /api/waypoint/mbg/nutrition-centre/"""
    try:
        return Response(_fetch("waypoint_mbg", "nutrition_centre"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_mbg_canteen(request):
    """GET /api/waypoint/mbg/canteen/"""
    try:
        return Response(_fetch("waypoint_mbg", "canteen"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ----------------------------------


# PERTAHANAN / MILITER
# ----------------------------------
@api_view(['GET'])
def waypoint_pertahanan(request):
    """GET /api/waypoint/pertahanan/"""
    try:
        return Response(_fetch("waypoint_pertahanan"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_military_base(request):
    """GET /api/waypoint/pertahanan/base/"""
    try:
        return Response(_fetch("waypoint_pertahanan", "base"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_military_barracks(request):
    """GET /api/waypoint/pertahanan/barracks/"""
    try:
        return Response(_fetch("waypoint_pertahanan", "barracks"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_military_checkpoint(request):
    """GET /api/waypoint/pertahanan/checkpoint/"""
    try:
        return Response(_fetch("waypoint_pertahanan", "checkpoint"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_military_office(request):
    """GET /api/waypoint/pertahanan/office/"""
    try:
        return Response(_fetch("waypoint_pertahanan", "military_office"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_military_training(request):
    """GET /api/waypoint/pertahanan/training-area/"""
    try:
        return Response(_fetch("waypoint_pertahanan", "training_area"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_airfield(request):
    """GET /api/waypoint/pertahanan/airfield/"""
    try:
        return Response(_fetch("waypoint_pertahanan", "airfield"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def waypoint_naval_base(request):
    """GET /api/waypoint/pertahanan/naval-base/"""
    try:
        return Response(_fetch("waypoint_pertahanan", "naval_base"))
    except Exception as e:
        return Response({"error": str(e)}, status=500)