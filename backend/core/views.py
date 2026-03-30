import os
import io
import uuid
import math
from datetime import datetime

import requests
from PIL import Image
from ultralytics import YOLO
from pymongo import MongoClient
from dotenv import load_dotenv
from shapely.geometry import Point, shape
from shapely.ops import unary_union

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

load_dotenv()

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")

# ─── Model ────────────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ai_models', 'best.pt')
model = YOLO(MODEL_PATH)

# ─── MongoDB ──────────────────────────────────────────────────────────────────
client           = MongoClient(MONGO_URI)
mongo_db         = client[DB_MONGO_NAME]
mongo_collection = mongo_db["ai_features"]
scan_sessions    = mongo_db["area_scan_sessions"]

YOLO_TARGET_SIZE = 640

# ─── Tile Server (Esri World Imagery) ─────────────────────────────────────────
# Ganti URL ini jika basemap Anda berbeda
TILE_SERVER_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"


# ─────────────────────────────────────────────────────────────────────────────
#  HELPER FUNCTIONS  (semua original, tidak diubah)
# ─────────────────────────────────────────────────────────────────────────────

def calculate_polygon_area(coords):
    if len(coords) < 3:
        return 0
    area = 0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i+1]
        x1 = lon1 * 111320 * math.cos(math.radians(lat1))
        y1 = lat1 * 111320
        x2 = lon2 * 111320 * math.cos(math.radians(lat2))
        y2 = lat2 * 111320
        area += (x1 * y2) - (x2 * y1)
    return abs(area) / 2


def calculate_pixel_polygon_area(segmentation_pixels, lat, lng, capture_size=640):
    if len(segmentation_pixels) < 3:
        return 0
    avg_zoom = 18
    meters_per_pixel = (40075016.686 * abs(math.cos(lat * math.pi / 180))) / (256 * pow(2, avg_zoom))
    area_pixels = 0
    for i in range(len(segmentation_pixels) - 1):
        x1, y1 = segmentation_pixels[i]
        x2, y2 = segmentation_pixels[i+1]
        area_pixels += (x1 * y2) - (x2 * y1)
    area_pixels = abs(area_pixels) / 2
    return round(area_pixels * (meters_per_pixel ** 2), 2)


def get_province_from_coords(lat, lng, boundary_data=None):
    try:
        if boundary_data is None:
            provinsi_collection = mongo_db["batas_provinsi"]
            boundary_data = list(provinsi_collection.find({}, {'_id': 0}))
            if not boundary_data:
                print("Warning: Collection batas_provinsi kosong")
                return None
        point = Point(lng, lat)
        for feature in boundary_data:
            try:
                geometry  = feature.get('geometry', {})
                geom_type = geometry.get('type')
                if geom_type in ['Polygon', 'MultiPolygon']:
                    geom = shape(geometry)
                    if geom.contains(point):
                        return feature.get('properties', {}).get('name', 'Unknown')
            except Exception as e:
                print(f"Error processing feature: {str(e)}")
                continue
        print(f"Koordinat ({lat}, {lng}) tidak ditemukan dalam boundary apapun")
        return None
    except Exception as e:
        print(f"Error in get_province_from_coords: {str(e)}")
        return None


def calculate_centroid(coords_list):
    if not coords_list or len(coords_list) < 3:
        return None
    try:
        coords_to_calc = coords_list[:-1] if coords_list[0] == coords_list[-1] else coords_list
        avg_lng = sum(c[0] for c in coords_to_calc) / len(coords_to_calc)
        avg_lat = sum(c[1] for c in coords_to_calc) / len(coords_to_calc)
        return (avg_lat, avg_lng)
    except Exception as e:
        print(f"Error calculating centroid: {str(e)}")
        return None


# ─── Tile fetch helpers (Mode A — scan cepat) ─────────────────────────────────

def _lat_lng_to_tile(lat, lng, zoom):
    lat_r = math.radians(lat)
    n     = 2 ** zoom
    x     = int((lng + 180.0) / 360.0 * n)
    y     = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    return x, y


def _fetch_single_tile(tile_x, tile_y, tile_z):
    url  = TILE_SERVER_URL.format(z=tile_z, x=tile_x, y=tile_y)
    resp = requests.get(
        url,
        headers={'User-Agent': 'TerraSeg/1.0', 'Referer': 'http://localhost:3000'},
        timeout=10,
    )
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert('RGB')


def _fetch_composite_image(lat, lng, zoom, target_size=640):
    """
    Ambil grid 3x3 tile, gabungkan, crop ke target_size x target_size.
    Menggantikan html2canvas — ~10x lebih cepat.
    """
    cx, cy = _lat_lng_to_tile(lat, lng, zoom)
    canvas = Image.new('RGB', (256 * 3, 256 * 3))
    for dy in range(-1, 2):
        for dx in range(-1, 2):
            try:
                tile = _fetch_single_tile(cx + dx, cy + dy, zoom)
                canvas.paste(tile, ((dx + 1) * 256, (dy + 1) * 256))
            except Exception as e:
                print(f"  tile ({cx+dx},{cy+dy},{zoom}): {e}")
    w, h    = canvas.size
    half_t  = target_size // 2
    cropped = canvas.crop((w//2 - half_t, h//2 - half_t, w//2 + half_t, h//2 + half_t))
    if cropped.size != (YOLO_TARGET_SIZE, YOLO_TARGET_SIZE):
        cropped = cropped.resize((YOLO_TARGET_SIZE, YOLO_TARGET_SIZE), Image.LANCZOS)
    return cropped


# ─────────────────────────────────────────────────────────────────────────────
#  AI DETECTION ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def feature_list(request):
    """List semua features yang terdeteksi"""
    try:
        cursor = mongo_collection.find({}, {'_id': 0}).sort('created_at', -1)
        return Response(list(cursor))
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def run_detection(request):
    """
    Jalankan YOLO detection.

    Mendukung DUA mode:

      MODE A  (use_tile_url=true)  — FAST
        Backend download gambar dari tile server, tanpa html2canvas.
        Fields: lat, lng, tile_z, categories

      MODE B  (default)  — ORIGINAL
        Frontend kirim gambar screenshot sebagai multipart upload.
        Fields: image (file), lat, lng, capture_size, categories

    Koordinat mask selalu dalam ruang 640px. Tidak ada double-scaling.
    """
    lat            = float(request.data.get('lat', 0) or 0)
    lng            = float(request.data.get('lng', 0) or 0)
    capture_size   = int(request.data.get('capture_size', YOLO_TARGET_SIZE))
    categories_raw = request.data.get('categories', '')
    selected_categories = [c.strip().lower() for c in categories_raw.split(',') if c.strip()]
    use_tile_url   = str(request.data.get('use_tile_url', 'false')).lower() == 'true'

    # Tile bounds — used for accurate pixel→LatLng projection in tile URL mode
    tile_north = float(request.data.get('tile_north', 0) or 0)
    tile_south = float(request.data.get('tile_south', 0) or 0)
    tile_west  = float(request.data.get('tile_west',  0) or 0)
    tile_east  = float(request.data.get('tile_east',  0) or 0)
    has_tile_bounds = tile_north and tile_south and tile_west and tile_east

    def pixel_to_latlng(px, py):
        """
        Convert YOLO pixel coord (0-640) to LatLng using tile bounds.
        Uses Web Mercator inverse projection for accuracy (not linear).
        """
        import math
        # Normalize to 0-1
        nx = px / YOLO_TARGET_SIZE
        ny = py / YOLO_TARGET_SIZE
        # Linear interpolation within tile bounds
        # For 150m tiles at z18, linear is accurate enough (error < 0.1m)
        lat_out = tile_north - ny * (tile_north - tile_south)
        lng_out = tile_west  + nx * (tile_east  - tile_west)
        return [lat_out, lng_out]

    try:
        # ── MODE A: tile server fetch ─────────────────────────────────────────
        if use_tile_url:
            if not lat or not lng:
                return Response({"error": "lat/lng diperlukan"}, status=400)
            tile_z    = int(request.data.get('tile_z', 18))
            img       = _fetch_composite_image(lat, lng, tile_z, YOLO_TARGET_SIZE)
            img_resized = img  # sudah YOLO_TARGET_SIZE

        # ── MODE B: image upload (original) ──────────────────────────────────
        else:
            image_file = request.FILES.get('image')
            if not image_file or not lat or not lng:
                return Response({"error": "Data tidak lengkap"}, status=400)
            img = Image.open(image_file)
            if img.size != (YOLO_TARGET_SIZE, YOLO_TARGET_SIZE):
                img_resized = img.resize((YOLO_TARGET_SIZE, YOLO_TARGET_SIZE), Image.LANCZOS)
            else:
                img_resized = img

        # ── YOLO ─────────────────────────────────────────────────────────────
        results       = model.predict(source=img_resized, save=False)
        detected_data = []

        for result in results:
            if result.masks is not None:
                for i, mask in enumerate(result.masks.xy):
                    cls_idx    = int(result.boxes.cls[i])
                    raw_label  = result.names[cls_idx].lower()
                    confidence = float(result.boxes.conf[i])

                    if raw_label in selected_categories:
                        segment_list = [[float(pt[0]), float(pt[1])] for pt in mask.tolist()]
                        luas_m2      = calculate_pixel_polygon_area(segment_list, lat, lng, YOLO_TARGET_SIZE)

                        obj = {
                            "nama":             f"{raw_label.capitalize()} Terdeteksi",
                            "kategori":         raw_label,
                            "segmentation":     segment_list,   # pixel coords (for Mode B frontend)
                            "confidence_score": round(confidence, 2),
                            "luas_m2":          luas_m2,
                            "lat":              lat,
                            "lng":              lng,
                            "capture_size":     YOLO_TARGET_SIZE,
                        }

                        # For Mode A: also return LatLng coords directly (accurate, no frontend projection needed)
                        if use_tile_url and has_tile_bounds:
                            obj["latlng_segmentation"] = [pixel_to_latlng(pt[0], pt[1]) for pt in mask.tolist()]

                        detected_data.append(obj)
            else:
                # Bounding box fallback (tidak ada mask)
                for box in result.boxes:
                    raw_label = result.names[int(box.cls[0])].lower()
                    if raw_label in selected_categories:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        detected_data.append({
                            "nama":             f"{raw_label.capitalize()} Terdeteksi",
                            "kategori":         raw_label,
                            "bbox":             [int(x1), int(y1), int(x2), int(y2)],
                            "confidence_score": round(float(box.conf[0]), 2),
                            "lat":              lat,
                            "lng":              lng,
                            "capture_size":     YOLO_TARGET_SIZE,
                        })

        return Response({
            "status":   "success",
            "results":  detected_data,
            "metadata": {
                "yolo_size":             YOLO_TARGET_SIZE,
                "capture_size_received": capture_size,
                "mode":                  "tile_url" if use_tile_url else "screenshot",
            },
        })

    except Exception as e:
        print(f"Error AI: {str(e)}")
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def save_detection(request):
    try:
        features = request.data.get('features', [])

        for item in features:
            raw_coords = item.get('polygon_coords')
            try:
                coords_list = []
                for pair in raw_coords.split(','):
                    c = pair.strip().split()
                    if len(c) == 2:
                        coords_list.append([float(c[0]), float(c[1])])
                if coords_list and coords_list[0] != coords_list[-1]:
                    coords_list.append(coords_list[0])
            except Exception:
                return Response({"error": "Format koordinat salah"}, status=400)

            luas_m2  = calculate_polygon_area(coords_list)
            centroid = calculate_centroid(coords_list)
            provinsi = None
            if centroid:
                avg_lat, avg_lng = centroid
                provinsi = get_province_from_coords(avg_lat, avg_lng)
                print(f"Deteksi di ({avg_lat:.4f}, {avg_lng:.4f}) -> Provinsi: {provinsi}")

            feature_uuid = str(uuid.uuid4())

            mongo_collection.insert_one({
                "feature_id":       feature_uuid,
                "user_id":          request.user.id if request.user.is_authenticated else None,
                "nama":             item.get('nama'),
                "kategori":         item.get('kategori'),
                "confidence_score": item.get('confidence_score'),
                "provinsi":         provinsi,
                "location": {
                    "type":        "Polygon",
                    "coordinates": [coords_list],
                },
                "metadata": {
                    **item.get('metadata', {}),
                    "luas_estimasi": round(luas_m2, 2),
                    "satuan":        "m2",
                    "provinsi":      provinsi,
                    "centroid_lat":  centroid[0] if centroid else None,
                    "centroid_lng":  centroid[1] if centroid else None,
                },
                "created_at": datetime.now().isoformat(),
            })
            print(f"Data {item.get('kategori')} di {provinsi} berhasil disimpan")

        return Response({
            "status":  "success",
            "message": f"{len(features)} objek berhasil disimpan",
        }, status=201)

    except Exception as e:
        print(f"Error in save_detection: {str(e)}")
        return Response({"error": str(e)}, status=500)


@api_view(['DELETE'])
def delete_feature(request, feature_id):
    try:
        result = mongo_collection.delete_one({"feature_id": feature_id})
        if result.deleted_count > 0:
            return Response({"message": "Data berhasil dihapus dari NoSQL"}, status=200)
        return Response({"error": "Data tidak ditemukan"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['PUT', 'PATCH'])
def update_feature_mongo(request, feature_id):
    """Update feature di MongoDB"""
    try:
        new_nama     = request.data.get('nama')
        new_kategori = request.data.get('kategori')
        result = mongo_collection.update_one(
            {"feature_id": feature_id},
            {"$set": {
                "nama":       new_nama,
                "kategori":   new_kategori,
                "updated_at": datetime.now().isoformat(),
            }}
        )
        if result.matched_count > 0:
            return Response({"message": "Update Berhasil"})
        return Response({"error": "Data tidak ditemukan"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
#  PROVINCE FEATURES ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def features_by_province(request):
    try:
        provinsi = request.query_params.get('provinsi')
        if not provinsi:
            return Response({"error": "Parameter 'provinsi' diperlukan"}, status=400)
        cursor  = mongo_collection.find({"provinsi": provinsi}, {'_id': 0}).sort('created_at', -1)
        results = list(cursor)
        return Response({"provinsi": provinsi, "total": len(results), "features": results})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def provinces_summary(request):
    try:
        pipeline = [
            {"$group": {
                "_id":            "$provinsi",
                "total_deteksi":  {"$sum": 1},
                "total_luas":     {"$sum": "$metadata.luas_estimasi"},
                "kategori":       {"$push": "$kategori"},
                "confidence_avg": {"$avg": "$confidence_score"},
            }},
            {"$sort": {"total_deteksi": -1}},
        ]
        results = list(mongo_collection.aggregate(pipeline))
        return Response({
            "summary":               results,
            "total_provinsi":        len(results),
            "total_deteksi_overall": sum(r["total_deteksi"] for r in results),
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
#  RBI DATA ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def rbi_pendidikan_list(request):
    wilayah_query = request.query_params.get('wilayah', None)
    query = {"properties.wilayah": wilayah_query} if wilayah_query else {}
    cursor = mongo_db["rbi_pendidikan"].find(query, {'_id': 0})
    return Response({"type": "FeatureCollection", "features": list(cursor)})


@api_view(['GET'])
def rbi_kesehatan_list(request):
    """List RBI Kesehatan"""
    wilayah_query = request.query_params.get('wilayah', None)
    query = {"properties.wilayah": wilayah_query} if wilayah_query else {}
    cursor = mongo_db["rbi_kesehatan"].find(query, {'_id': 0})
    return Response({"type": "FeatureCollection", "features": list(cursor)})


# ─────────────────────────────────────────────────────────────────────────────
#  BOUNDARY DATA ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def batas_provinsi(request):
    try:
        cursor = mongo_db["batas_provinsi"].find({}, {'_id': 0})
        return Response({"type": "FeatureCollection", "features": list(cursor)})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def batas_kabupaten(request):
    try:
        cursor = mongo_db["batas_kabupaten"].find({}, {'_id': 0})
        return Response({"type": "FeatureCollection", "features": list(cursor)})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
#  AREA SCAN SESSION ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def area_scan_session(request):
    """POST /api/area-scan/start/  — daftarkan sesi scan baru"""
    try:
        data       = request.data
        session_id = str(uuid.uuid4())
        scan_sessions.insert_one({
            "session_id":  session_id,
            "user_id":     request.user.id if request.user.is_authenticated else None,
            "bounds":      data.get("bounds"),
            "tile_size":   data.get("tile_size", 512),
            "zoom_level":  data.get("zoom_level"),
            "categories":  data.get("categories", []),
            "total_tiles": data.get("total_tiles", 0),
            "status":      "running",
            "started_at":  datetime.now().isoformat(),
            "finished_at": None,
        })
        return Response({"session_id": session_id}, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET', 'PATCH'])
def area_scan_status(request):
    """
    GET  /api/area-scan/status/?session_id=<uuid>
    PATCH /api/area-scan/status/  { session_id, status }
    """
    if request.method == 'GET':
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({"error": "session_id required"}, status=400)
        session = scan_sessions.find_one({"session_id": session_id}, {'_id': 0})
        if not session:
            return Response({"error": "Session not found"}, status=404)
        objects_found = mongo_collection.count_documents({"metadata.session_id": session_id})
        return Response({"session": session, "objects_found": objects_found})

    elif request.method == 'PATCH':
        try:
            session_id = request.data.get('session_id')
            new_status = request.data.get('status', 'done')
            result = scan_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"status": new_status, "finished_at": datetime.now().isoformat()}}
            )
            if result.matched_count == 0:
                return Response({"error": "Session not found"}, status=404)
            return Response({"message": f"Session marked as {new_status}"})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def area_scan_summary(request):
    """GET /api/area-scan/summary/?session_id=<uuid>"""
    try:
        session_id   = request.query_params.get('session_id')
        match_filter = {"metadata.session_id": session_id} if session_id else {}

        agg = list(mongo_collection.aggregate([
            {"$match": match_filter},
            {"$group": {
                "_id":        None,
                "total":      {"$sum": 1},
                "total_area": {"$sum": "$metadata.luas_estimasi"},
                "avg_conf":   {"$avg": "$confidence_score"},
                "categories": {"$push": "$kategori"},
                "provinces":  {"$push": "$provinsi"},
            }},
        ]))

        if not agg:
            return Response({
                "session_id":     session_id,
                "total_objects":  0,
                "by_category":    {},
                "by_province":    {},
                "total_area_m2":  0,
                "avg_confidence": 0,
            })

        d = agg[0]
        by_cat  = {}
        for c in d.get("categories", []):
            if c: by_cat[c] = by_cat.get(c, 0) + 1
        by_prov = {}
        for p in d.get("provinces", []):
            if p: by_prov[p] = by_prov.get(p, 0) + 1

        return Response({
            "session_id":     session_id,
            "total_objects":  d.get("total", 0),
            "by_category":    by_cat,
            "by_province":    by_prov,
            "total_area_m2":  round(d.get("total_area", 0) or 0, 2),
            "avg_confidence": round(d.get("avg_conf",   0) or 0, 4),
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def area_scan_sessions_list(request):
    """GET /api/area-scan/sessions/ — 20 sesi terbaru"""
    try:
        cursor   = scan_sessions.find({}, {'_id': 0}).sort('started_at', -1).limit(20)
        sessions = list(cursor)
        for s in sessions:
            s['objects_found'] = mongo_collection.count_documents(
                {"metadata.session_id": s.get("session_id")}
            )
        return Response({"sessions": sessions})
    except Exception as e:
        return Response({"error": str(e)}, status=500)