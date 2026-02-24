import os
from PIL import Image
from ultralytics import YOLO
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import json
from pymongo import MongoClient
import uuid
from dotenv import load_dotenv
from datetime import datetime
import math
from shapely.geometry import Point, shape
from shapely.ops import unary_union

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")

# Load Model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'ai_models', 'best.pt')
model = YOLO(MODEL_PATH)

# Koneksi MongoDB
client = MongoClient(MONGO_URI)
mongo_db = client[DB_MONGO_NAME]
mongo_collection = mongo_db["ai_features"]

# HELPER FUNCTIONS

def calculate_polygon_area(coords):
    """
    Menghitung luas poligon sederhana menggunakan rumus Shoelace.
    Input: [[lng1, lat1], [lng2, lat2], ...]
    Output: Luas dalam meter persegi (pendekatan kasar)
    """
    if len(coords) < 3:
        return 0
    
    area = 0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i+1]
        
        # Konversi ke meter sederhana
        x1 = lon1 * 111320 * math.cos(math.radians(lat1))
        y1 = lat1 * 111320
        x2 = lon2 * 111320 * math.cos(math.radians(lat2))
        y2 = lat2 * 111320
        
        area += (x1 * y2) - (x2 * y1)
        
    return abs(area) / 2

def calculate_pixel_polygon_area(segmentation_pixels, lat, lng, capture_size):
    """
    Hitung luas dari koordinat pixel segmentasi
    Returns: Luas dalam m²
    """
    if len(segmentation_pixels) < 3:
        return 0
    
    avg_zoom = 19
    meters_per_pixel = (40075016.686 * abs(math.cos(lat * math.pi / 180))) / (256 * pow(2, avg_zoom))
    
    # Hitung luas dalam pixel menggunakan Shoelace formula
    area_pixels = 0
    for i in range(len(segmentation_pixels) - 1):
        x1, y1 = segmentation_pixels[i]
        x2, y2 = segmentation_pixels[i+1]
        area_pixels += (x1 * y2) - (x2 * y1)
    
    area_pixels = abs(area_pixels) / 2
    
    # Konversi ke m²
    area_m2 = area_pixels * (meters_per_pixel ** 2)
    
    return round(area_m2, 2)

def get_province_from_coords(lat, lng, boundary_data=None):
    """
    ✅ NEW FUNCTION - CORRECTED
    Menentukan provinsi dari koordinat lat/lng menggunakan data boundary polygon
    
    ⚠️ PERHATIAN: Field nama provinsi adalah 'name' (bukan 'Propinsi')
    
    Args:
        lat (float): Latitude (-90 to 90)
        lng (float): Longitude (-180 to 180)
        boundary_data (list, optional): GeoJSON features list dari MongoDB
    
    Returns:
        str: Nama provinsi atau None jika koordinat tidak ditemukan dalam boundary
    """
    try:
        # Jika tidak ada boundary data, ambil dari MongoDB
        if boundary_data is None:
            provinsi_collection = mongo_db["batas_provinsi"]
            boundary_data = list(provinsi_collection.find({}, {'_id': 0}))
            
            if not boundary_data:
                print("⚠️  Warning: Collection batas_provinsi kosong")
                return None
        
        # Buat point dari koordinat (GeoJSON format: [lng, lat])
        point = Point(lng, lat)
        
        # Iterasi setiap feature (provinsi) di boundary data
        for feature in boundary_data:
            try:
                geometry = feature.get('geometry', {})
                geom_type = geometry.get('type')
                
                if geom_type in ['Polygon', 'MultiPolygon']:
                    # Konversi GeoJSON geometry ke Shapely shape
                    geom = shape(geometry)
                    
                    # Cek apakah point berada dalam polygon
                    if geom.contains(point):
                        # ✅ PENTING: Field adalah 'name' bukan 'Propinsi'
                        provinsi_name = feature.get('properties', {}).get('name', 'Unknown')
                        return provinsi_name
                        
            except Exception as e:
                print(f"Error processing feature: {str(e)}")
                continue
        
        print(f"⚠️  Koordinat ({lat}, {lng}) tidak ditemukan dalam boundary apapun")
        return None
        
    except Exception as e:
        print(f"❌ Error in get_province_from_coords: {str(e)}")
        return None

def calculate_centroid(coords_list):
    """
    NEW FUNCTION
    Hitung titik tengah (centroid) dari polygon koordinat
    
    Args:
        coords_list (list): List koordinat [[lng1, lat1], [lng2, lat2], ...]
    
    Returns:
        tuple: (lat, lng) centroid atau None jika list kosong
    """
    if not coords_list or len(coords_list) < 3:
        return None
    
    try:
        # Jangan hitung point terakhir jika itu duplikat dari point pertama
        coords_to_calc = coords_list[:-1] if coords_list[0] == coords_list[-1] else coords_list
        
        avg_lng = sum(c[0] for c in coords_to_calc) / len(coords_to_calc)
        avg_lat = sum(c[1] for c in coords_to_calc) / len(coords_to_calc)
        
        return (avg_lat, avg_lng)
    except Exception as e:
        print(f"Error calculating centroid: {str(e)}")
        return None

# API ENDPOINTS - AI DETECTION & FEATURES

@api_view(['GET'])
def feature_list(request):
    """List semua features yang terdeteksi (ORIGINAL)"""
    try:
        cursor = mongo_collection.find({}, {'_id': 0}).sort('created_at', -1)
        return Response(list(cursor))
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['POST'])
def run_detection(request):
    """Jalankan YOLO detection (ORIGINAL)"""
    image_file = request.FILES.get('image')
    lat = float(request.data.get('lat'))
    lng = float(request.data.get('lng'))
    capture_size = int(request.data.get('capture_size', 640))
    
    categories_raw = request.data.get('categories', '')
    selected_categories = [c.strip().lower() for c in categories_raw.split(',') if c]

    if not image_file or not lat or not lng:
        return Response({"error": "Data tidak lengkap"}, status=400)

    try:
        img = Image.open(image_file)
        
        # Resize gambar untuk deteksi optimal
        target_size = 640
        if img.size != (target_size, target_size):
            img_resized = img.resize((target_size, target_size), Image.LANCZOS)
        else:
            img_resized = img
        
        results = model.predict(source=img_resized, save=False)
        detected_data = []

        # Scale factor
        scale_x = capture_size / target_size
        scale_y = capture_size / target_size

        for result in results:
            if result.masks is not None:
                for i, mask in enumerate(result.masks.xy):
                    cls_idx = int(result.boxes.cls[i])
                    raw_label = result.names[cls_idx].lower()
                    confidence = float(result.boxes.conf[i])

                    if raw_label in selected_categories:
                        # Scale koordinat mask
                        segment_list = [[pt[0] * scale_x, pt[1] * scale_y] for pt in mask.tolist()]
                        
                        # Hitung luas dari segmentasi
                        luas_m2 = calculate_pixel_polygon_area(segment_list, lat, lng, capture_size)

                        detected_data.append({
                            "nama": f"{raw_label.capitalize()} Terdeteksi",
                            "kategori": raw_label,
                            "segmentation": segment_list,
                            "confidence_score": round(confidence, 2),
                            "luas_m2": luas_m2,
                            "lat": lat,
                            "lng": lng,
                            "capture_size": capture_size
                        })
            else:
                # Bounding box fallback
                for box in result.boxes:
                    raw_label = result.names[int(box.cls[0])].lower()
                    if raw_label in selected_categories:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        detected_data.append({
                            "nama": f"{raw_label.capitalize()} Terdeteksi",
                            "kategori": raw_label,
                            "bbox": [
                                int(x1 * scale_x), 
                                int(y1 * scale_y), 
                                int(x2 * scale_x), 
                                int(y2 * scale_y)
                            ],
                            "confidence_score": round(float(box.conf[0]), 2),
                            "lat": lat,
                            "lng": lng,
                            "capture_size": capture_size
                        })

        return Response({
            "status": "success",
            "results": detected_data,
            "metadata": {
                "capture_size": capture_size,
                "detection_size": target_size,
                "scale_factor": scale_x
            }
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
            
            # Hitung luas dari koordinat geografis
            luas_m2 = calculate_polygon_area(coords_list)

            provinsi = None
            centroid = calculate_centroid(coords_list)
            if centroid:
                avg_lat, avg_lng = centroid
                provinsi = get_province_from_coords(avg_lat, avg_lng)
                print(f"✓ Deteksi di ({avg_lat:.4f}, {avg_lng:.4f}) → Provinsi: {provinsi}")

            feature_uuid = str(uuid.uuid4())

            mongo_document = {
                "feature_id": feature_uuid,
                "user_id": request.user.id if request.user.is_authenticated else None,
                "nama": item.get('nama'),
                "kategori": item.get('kategori'),
                "confidence_score": item.get('confidence_score'),
                "provinsi": provinsi,
                "location": {
                    "type": "Polygon",
                    "coordinates": [coords_list]
                },
                "metadata": {
                    **item.get('metadata', {}),
                    "luas_estimasi": round(luas_m2, 2),
                    "satuan": "m2",
                    "provinsi": provinsi,
                    "centroid_lat": centroid[0] if centroid else None,
                    "centroid_lng": centroid[1] if centroid else None,
                },
                "created_at": datetime.now().isoformat()
            }
            
            # Insert ke MongoDB
            mongo_collection.insert_one(mongo_document)
            print(f"✓ Data {item.get('kategori')} di {provinsi} berhasil disimpan")

        message = f"{len(features)} objek berhasil disimpan"
        return Response({
            "status": "success", 
            "message": message
        }, status=201)
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Error in save_detection: {error_msg}")
        return Response({"error": error_msg}, status=500)

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
    """Update feature di MongoDB (ORIGINAL)"""
    try:
        new_nama = request.data.get('nama')
        new_kategori = request.data.get('kategori')

        result = mongo_collection.update_one(
            {"feature_id": feature_id}, 
            {"$set": {
                "nama": new_nama,
                "kategori": new_kategori,
                "updated_at": datetime.now().isoformat()
            }}
        )

        if result.matched_count > 0:
            return Response({"message": "Update Berhasil"})
        return Response({"error": "Data tidak ditemukan"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# OPTIONAL: ENDPOINTS FOR PROVINCE FEATURES

@api_view(['GET'])
def features_by_province(request):
    try:
        provinsi = request.query_params.get('provinsi')
        
        if not provinsi:
            return Response({"error": "Parameter 'provinsi' diperlukan"}, status=400)
        
        # Query MongoDB
        cursor = mongo_collection.find(
            {"provinsi": provinsi},
            {'_id': 0}
        ).sort('created_at', -1)
        
        results = list(cursor)
        
        return Response({
            "provinsi": provinsi,
            "total": len(results),
            "features": results
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def provinces_summary(request):
    try:
        # Aggregate deteksi per provinsi
        pipeline = [
            {
                "$group": {
                    "_id": "$provinsi",
                    "total_deteksi": {"$sum": 1},
                    "total_luas": {
                        "$sum": "$metadata.luas_estimasi"
                    },
                    "kategori": {"$push": "$kategori"},
                    "confidence_avg": {
                        "$avg": "$confidence_score"
                    }
                }
            },
            {"$sort": {"total_deteksi": -1}}
        ]
        
        results = list(mongo_collection.aggregate(pipeline))
        
        return Response({
            "summary": results,
            "total_provinsi": len(results),
            "total_deteksi_overall": sum(r["total_deteksi"] for r in results)
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# RBI DATA ENDPOINTS (ORIGINAL)

@api_view(['GET'])
def rbi_pendidikan_list(request):
    wilayah_query = request.query_params.get('wilayah', None)
    
    query = {}
    if wilayah_query:
        query = {"properties.wilayah": wilayah_query}

    cursor = mongo_db["rbi_pendidikan"].find(query, {'_id': 0})
    features = list(cursor)
    
    return Response({
        "type": "FeatureCollection",
        "features": features
    })

@api_view(['GET'])
def rbi_kesehatan_list(request):
    """List RBI Kesehatan (ORIGINAL)"""
    wilayah_query = request.query_params.get('wilayah', None)
    
    query = {}
    if wilayah_query:
        query = {"properties.wilayah": wilayah_query}

    cursor = mongo_db["rbi_kesehatan"].find(query, {'_id': 0})
    features = list(cursor)
    
    return Response({
        "type": "FeatureCollection",
        "features": features
    })

# BOUNDARY DATA ENDPOINTS (ORIGINAL)

@api_view(['GET'])
def batas_provinsi(request):
    try:
        cursor = mongo_db["batas_provinsi"].find({}, {'_id': 0})
        features = list(cursor)
        return Response({
            "type": "FeatureCollection",
            "features": features
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
@api_view(['GET'])
def batas_kabupaten(request):
    try:
        cursor = mongo_db["batas_kabupaten"].find({}, {'_id': 0})
        features = list(cursor)
        return Response({
            "type": "FeatureCollection",
            "features": features
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)