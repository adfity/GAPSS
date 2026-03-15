"""
views_area_scan.py
──────────────────
Endpoint tambahan untuk fitur Area Scan (SAS Planet style).
Daftarkan di urls.py:
    from .views_area_scan import area_scan_session, area_scan_status, area_scan_summary

    urlpatterns += [
        path('api/area-scan/start/',   area_scan_session, name='area_scan_start'),
        path('api/area-scan/status/',  area_scan_status,  name='area_scan_status'),
        path('api/area-scan/summary/', area_scan_summary, name='area_scan_summary'),
    ]

NOTE:
  - Endpoint run-detection dan save-detection yang sudah ada di views.py
    tetap digunakan oleh frontend (tile per tile).
  - File ini hanya menambahkan:
      1. area_scan_session  → menyimpan metadata sesi scan
      2. area_scan_status   → ringkasan progres sesi
      3. area_scan_summary  → statistik per kategori / provinsi hasil sesi
"""

import os
import uuid
import math
from datetime import datetime

from pymongo import MongoClient
from dotenv import load_dotenv

from rest_framework.decorators import api_view
from rest_framework.response import Response

load_dotenv()

# ─── MongoDB ──────────────────────────────────────────────────────────────────

client         = MongoClient(os.getenv("MONGO_URI"))
mongo_db       = client[os.getenv("DB_MONGO_NAME")]
scan_sessions  = mongo_db["area_scan_sessions"]
ai_features    = mongo_db["ai_features"]

# ─────────────────────────────────────────────────────────────────────────────
#  1. START / REGISTER SCAN SESSION
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def area_scan_session(request):
    """
    POST /api/area-scan/start/
    Body JSON:
    {
        "bounds": {
            "north": float, "south": float,
            "west":  float, "east":  float
        },
        "tile_size":   int,         // px, e.g. 512
        "zoom_level":  int,
        "categories":  ["bangunan", "perairan", ...],
        "total_tiles": int
    }
    Returns:
        { "session_id": "uuid" }
    """
    try:
        data        = request.data
        session_id  = str(uuid.uuid4())

        doc = {
            "session_id":  session_id,
            "user_id":     request.user.id if request.user.is_authenticated else None,
            "bounds":      data.get("bounds"),
            "tile_size":   data.get("tile_size", 512),
            "zoom_level":  data.get("zoom_level"),
            "categories":  data.get("categories", []),
            "total_tiles": data.get("total_tiles", 0),
            "status":      "running",   # running | done | aborted
            "started_at":  datetime.now().isoformat(),
            "finished_at": None,
        }
        scan_sessions.insert_one(doc)

        return Response({"session_id": session_id}, status=201)

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
#  2. GET SCAN SESSION STATUS
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET', 'PATCH'])
def area_scan_status(request):
    """
    GET  /api/area-scan/status/?session_id=<uuid>
         → { session, tiles_done, objects_found }

    PATCH /api/area-scan/status/
          Body: { "session_id": "uuid", "status": "done" | "aborted" }
          → marks session finished
    """
    if request.method == 'GET':
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({"error": "session_id required"}, status=400)

        session = scan_sessions.find_one({"session_id": session_id}, {'_id': 0})
        if not session:
            return Response({"error": "Session not found"}, status=404)

        # Count objects saved under this session
        objects_found = ai_features.count_documents({
            "metadata.session_id": session_id
        })

        return Response({
            "session":       session,
            "objects_found": objects_found,
        })

    elif request.method == 'PATCH':
        try:
            session_id = request.data.get('session_id')
            new_status = request.data.get('status', 'done')

            result = scan_sessions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "status":      new_status,
                    "finished_at": datetime.now().isoformat(),
                }}
            )

            if result.matched_count == 0:
                return Response({"error": "Session not found"}, status=404)

            return Response({"message": f"Session marked as {new_status}"})

        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
#  3. AREA SCAN SUMMARY  (per sesi atau global)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def area_scan_summary(request):
    """
    GET /api/area-scan/summary/?session_id=<uuid>
    
    Returns statistics for a completed scan session:
    {
        "session_id": "...",
        "total_objects": int,
        "by_category": { "bangunan": 12, "perairan": 3, ... },
        "by_province":  { "DKI Jakarta": 10, ... },
        "total_area_m2": float,
        "avg_confidence": float
    }
    """
    try:
        session_id = request.query_params.get('session_id')

        match_filter = {}
        if session_id:
            match_filter["metadata.session_id"] = session_id

        pipeline = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": None,
                    "total":         {"$sum": 1},
                    "total_area":    {"$sum": "$metadata.luas_estimasi"},
                    "avg_conf":      {"$avg": "$confidence_score"},
                    "categories":    {"$push": "$kategori"},
                    "provinces":     {"$push": "$provinsi"},
                }
            }
        ]

        agg = list(ai_features.aggregate(pipeline))

        if not agg:
            return Response({
                "session_id":    session_id,
                "total_objects": 0,
                "by_category":   {},
                "by_province":   {},
                "total_area_m2": 0,
                "avg_confidence": 0,
            })

        data = agg[0]

        # Build category counts
        by_cat = {}
        for c in data.get("categories", []):
            if c:
                by_cat[c] = by_cat.get(c, 0) + 1

        # Build province counts
        by_prov = {}
        for p in data.get("provinces", []):
            if p:
                by_prov[p] = by_prov.get(p, 0) + 1

        return Response({
            "session_id":     session_id,
            "total_objects":  data.get("total", 0),
            "by_category":    by_cat,
            "by_province":    by_prov,
            "total_area_m2":  round(data.get("total_area", 0) or 0, 2),
            "avg_confidence": round(data.get("avg_conf", 0) or 0, 4),
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
#  4. LIST ALL SCAN SESSIONS
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def area_scan_sessions_list(request):
    """
    GET /api/area-scan/sessions/
    Returns last 20 scan sessions, newest first.
    """
    try:
        cursor = scan_sessions.find({}, {'_id': 0}).sort('started_at', -1).limit(20)
        sessions = list(cursor)

        # Annotate each session with object count
        for s in sessions:
            s['objects_found'] = ai_features.count_documents({
                "metadata.session_id": s.get("session_id")
            })

        return Response({"sessions": sessions})

    except Exception as e:
        return Response({"error": str(e)}, status=500)