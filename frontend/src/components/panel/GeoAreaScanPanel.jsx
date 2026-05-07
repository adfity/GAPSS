"use client";
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Grid, Play, Square, Trash2, Save, ChevronRight, Layers,
  ScanLine, CheckCircle2, XCircle, Clock, AlertTriangle,
  Home, Waves, Trees, Route, Pause, RotateCcw, ChevronDown, ChevronUp, X,
  MousePointer2, Zap, MapPin, Search, Map,
  BarChart2, Activity, TrendingUp, FileText, Download,
  Building2, Leaf, Info, Globe, Scan,
  Navigation, Target, Copy, Eye, Circle as CircleIcon,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Rectangle, Polygon, GeoJSON, Popup, useMapEvents, useMap, Circle, Marker } from 'react-leaflet';
import { createPortal } from 'react-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import L from 'leaflet';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'bangunan',  label: 'Bangunan',  color: '#f59e0b', Icon: Home  },
  { id: 'perairan',  label: 'Perairan',  color: '#2563eb', Icon: Waves },
  { id: 'pepohonan', label: 'Pepohonan', color: '#16a34a', Icon: Trees },
  { id: 'jalan',     label: 'Jalan',     color: '#64748b', Icon: Route },
];
const CAPTURE_ZOOM       = 20;
const CAPTURE_PX         = 640;
const TILE_METER         = 150;
const YOLO_SIZE          = 640;
const WAYPOINT_SCAN_ZOOM = 17;
const KABUPATEN_TILE_ZOOM = 17;

const SCAN_MODES = [
  { id: 'draw',   label: 'AREA',   icon: Square },
  { id: 'scan',   label: 'Config', icon: Grid   },
  { id: 'hasil',  label: 'Hasil',  icon: Layers },
];

// ─── RADIUS CONSTANTS ─────────────────────────────────────────────────────────
const WAYPOINT_CATEGORY_MAP = {
  university: ['bangunan'], college: ['bangunan'], school: ['bangunan'],
  kindergarten: ['bangunan'], sekolah: ['bangunan'], universitas: ['bangunan'],
  madrasah: ['bangunan'], hospital: ['bangunan'], clinic: ['bangunan'],
  health_post: ['bangunan'], pharmacy: ['bangunan'], puskesmas: ['bangunan'],
  rumah_sakit: ['bangunan'], klinik: ['bangunan'], townhall: ['bangunan'],
  village_office: ['bangunan'], government_office: ['bangunan'], ministry: ['bangunan'],
  police: ['bangunan'], fire_station: ['bangunan'], courthouse: ['bangunan'],
  immigration: ['bangunan'], tax_office: ['bangunan'], legislative: ['bangunan'],
  kantor: ['bangunan'], community_centre: ['bangunan'], kitchen: ['bangunan'],
  food_centre: ['bangunan'], nutrition_centre: ['bangunan', 'pepohonan'],
  canteen: ['bangunan'], base: ['bangunan'], barracks: ['bangunan'],
  checkpoint: ['bangunan'], military_office: ['bangunan'],
  training_area: ['pepohonan', 'bangunan'], airfield: ['bangunan', 'jalan'],
  naval_base: ['bangunan', 'perairan'], taman: ['pepohonan'], hutan: ['pepohonan'],
  sungai: ['perairan'], danau: ['perairan'], sawah: ['pepohonan', 'perairan'],
  jalan: ['jalan'], jembatan: ['jalan'],
  default: ['bangunan', 'pepohonan', 'perairan', 'jalan'],
};

const CATEGORY_META = {
  bangunan:  { color: '#f59e0b', Icon: Home,  label: 'Bangunan'  },
  pepohonan: { color: '#16a34a', Icon: Trees, label: 'Pepohonan' },
  perairan:  { color: '#2563eb', Icon: Waves, label: 'Perairan'  },
  jalan:     { color: '#64748b', Icon: Route, label: 'Jalan'     },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const meterToLat = (m)      => m / 111320;
const meterToLng = (m, lat) => m / (111320 * Math.cos((lat * Math.PI) / 180));

function getBoundsFromFeature(feature) {
  const geom = feature?.geometry;
  if (!geom) return null;
  let coords = [];
  if (geom.type === 'Polygon')      coords = geom.coordinates[0];
  if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => coords.push(...p[0]));
  if (!coords.length) return null;
  return [
    { lat: Math.min(...coords.map(c => c[1])), lng: Math.min(...coords.map(c => c[0])) },
    { lat: Math.max(...coords.map(c => c[1])), lng: Math.max(...coords.map(c => c[0])) },
  ];
}

function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function pointInFeature(latlng, feature) {
  const geom = feature?.geometry, pt = [latlng.lng, latlng.lat];
  if (geom?.type === 'Polygon')      return pointInPolygon(pt, geom.coordinates[0]);
  if (geom?.type === 'MultiPolygon') return geom.coordinates.some(p => pointInPolygon(pt, p[0]));
  return false;
}

function clipPolygonToBounds(polygon, bounds) {
  if (!polygon || polygon.length < 3 || !bounds) return polygon;
  const south = Math.min(bounds[0].lat, bounds[1].lat);
  const north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng);
  const east  = Math.max(bounds[0].lng, bounds[1].lng);
  const clip = (pts, insideFn, intersectFn) => {
    if (!pts.length) return [];
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i], prev = pts[(i - 1 + pts.length) % pts.length];
      const curIn = insideFn(cur), prevIn = insideFn(prev);
      if (curIn) { if (!prevIn) out.push(intersectFn(prev, cur)); out.push(cur); }
      else if (prevIn) out.push(intersectFn(prev, cur));
    }
    return out;
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const tVal = (a, b, v, axis) => (v - a[axis]) / (b[axis] - a[axis]);
  let pts = polygon.map(p => [p[0], p[1]]);
  pts = clip(pts, p => p[0] >= south, (a, b) => { const t = tVal(a, b, south, 0); return lerp(a, b, t); });
  pts = clip(pts, p => p[0] <= north, (a, b) => { const t = tVal(a, b, north, 0); return lerp(a, b, t); });
  pts = clip(pts, p => p[1] >= west,  (a, b) => { const t = tVal(a, b, west,  1); return lerp(a, b, t); });
  pts = clip(pts, p => p[1] <= east,  (a, b) => { const t = tVal(a, b, east,  1); return lerp(a, b, t); });
  return pts.length >= 3 ? pts.map(p => [p[0], p[1]]) : null;
}

function estimateTileCount(bounds, tileMeter = 150) {
  if (!bounds) return 0;
  const south = Math.min(bounds[0].lat, bounds[1].lat), north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng), east  = Math.max(bounds[0].lng, bounds[1].lng);
  const cLat = (south + north) / 2;
  return Math.max(1, Math.ceil((north - south) / meterToLat(tileMeter)) * Math.ceil((east - west) / meterToLng(tileMeter, cLat)));
}

function fmtArea(m2) {
  if (!m2) return '—';
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  if (m2 >= 10_000)    return `${(m2 / 10_000).toFixed(2)} ha`;
  return `${m2.toFixed(0)} m²`;
}

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcEnvScore(catCounts, total) {
  if (!total) return 0;
  const pohon    = (catCounts.pepohonan || 0) / total;
  const perairan = (catCounts.perairan  || 0) / total;
  const bangun   = (catCounts.bangunan  || 0) / total;
  return Math.min(100, Math.round(pohon * 50 + perairan * 30 - bangun * 20 + 50));
}

function exportJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function exportCSVFile(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines   = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))];
  const blob    = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// ─── OSM BUILDING HELPERS ─────────────────────────────────────────────────────
async function fetchOpenBuildings(south, west, north, east) {
  const query = `[out:json][timeout:25];(way["building"](${south},${west},${north},${east});relation["building"](${south},${west},${north},${east}););out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error('Overpass API error');
  return await res.json();
}

// ─── OSM ROAD HELPERS ─────────────────────────────────────────────────────────
async function fetchOpenRoads(south, west, north, east) {
  const query = `[out:json][timeout:25];(way["highway"~"^(primary|secondary|tertiary|residential|unclassified|trunk|motorway|path|footway|cycleway)$"](${south},${west},${north},${east}););out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error('Overpass API error');
  return await res.json();
}

// ─── OSM WATER HELPERS ────────────────────────────────────────────────────────
async function fetchOpenWater(south, west, north, east) {
  const query = `[out:json][timeout:25];(way["natural"~"^(water|wetland|marsh)$"](${south},${west},${north},${east});way["waterway"~"^(river|stream|canal|drain)$"](${south},${west},${north},${east});relation["natural"="water"](${south},${west},${north},${east}););out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error('Overpass API error');
  return await res.json();
}

// ─── OSM VEGETATION HELPERS ───────────────────────────────────────────────────
async function fetchOpenVegetation(south, west, north, east) {
  const query = `[out:json][timeout:25];(way["landuse"~"^(forest|orchard|vineyard|meadow|grass|farmland)$"](${south},${west},${north},${east});way["natural"~"^(wood|scrub|grassland|heath|tree_row)$"](${south},${west},${north},${east});relation["landuse"="forest"](${south},${west},${north},${east}););out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error('Overpass API error');
  return await res.json();
}

function overpassToPolygons(data, bounds) {
  const results = [];
  for (const el of (data.elements || [])) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const polygonLatLng = el.geometry.map(pt => [pt.lat, pt.lon]);
    if (polygonLatLng.length < 3) continue;
    let area = 0;
    for (let i = 0, j = polygonLatLng.length - 1; i < polygonLatLng.length; j = i++) {
      const [lat1, lng1] = polygonLatLng[i], [lat2, lng2] = polygonLatLng[j];
      const x1 = lng1 * 111320 * Math.cos(lat1 * Math.PI / 180), y1 = lat1 * 111320;
      const x2 = lng2 * 111320 * Math.cos(lat2 * Math.PI / 180), y2 = lat2 * 111320;
      area += (x1 * y2 - x2 * y1);
    }
    const luas_m2 = Math.abs(area / 2);
    if (luas_m2 < 10) continue;
    const clipped = clipPolygonToBounds(polygonLatLng, bounds);
    if (!clipped || clipped.length < 3) continue;
    const props = el.tags || {};
    results.push({
      kategori: 'bangunan', confidence_score: 1.0,
      luas_m2: Math.round(luas_m2), polygonLatLng: clipped,
      tile_id: 'osm_building',
      scanLat: (bounds[0].lat + bounds[1].lat) / 2,
      scanLng: (bounds[0].lng + bounds[1].lng) / 2,
      osm_id: el.id,
      nama_bangunan: props.name || props['name:id'] || props.building || 'Bangunan',
      building_type: props.building || 'yes', source: 'osm',
    });
  }
  return results;
}

// ─── OSM ROAD → POLYGON (buffer garis jadi polygon tipis) ─────────────────────
function overpassRoadsToPolygons(data, bounds) {
  const results = [];
  for (const el of (data.elements || [])) {
    if (!el.geometry?.length || el.geometry.length < 2) continue;
    // Buat "buffer" sederhana: duplikat garis jadi polygon sempit
    const pts  = el.geometry.map(pt => [pt.lat, pt.lon]);
    const props = el.tags || {};
    // Untuk jalan, simpan sebagai polyline tapi representasikan sebagai polygon buffer 5m
    const bufferDeg = 0.00004; // ~5m
    const polygon = [];
    for (const p of pts)   polygon.push([p[0] + bufferDeg, p[1]]);
    for (const p of [...pts].reverse()) polygon.push([p[0] - bufferDeg, p[1]]);
    if (polygon.length < 3) continue;
    const clipped = clipPolygonToBounds(polygon, bounds);
    if (!clipped || clipped.length < 3) continue;
    results.push({
      kategori: 'jalan', confidence_score: 1.0,
      luas_m2: Math.round(pts.length * 10 * bufferDeg * 111320 * 2),
      polygonLatLng: clipped,
      tile_id: 'osm_road',
      scanLat: (bounds[0].lat + bounds[1].lat) / 2,
      scanLng: (bounds[0].lng + bounds[1].lng) / 2,
      osm_id: el.id,
      nama_bangunan: props.name || props.highway || 'Jalan',
      source: 'osm',
    });
  }
  return results;
}

// ─── OSM WATER → POLYGON ──────────────────────────────────────────────────────
function overpassWaterToPolygons(data, bounds) {
  const results = [];
  for (const el of (data.elements || [])) {
    if (!el.geometry?.length || el.geometry.length < 3) continue;
    const polygonLatLng = el.geometry.map(pt => [pt.lat, pt.lon]);
    let area = 0;
    for (let i = 0, j = polygonLatLng.length - 1; i < polygonLatLng.length; j = i++) {
      const [lat1, lng1] = polygonLatLng[i], [lat2, lng2] = polygonLatLng[j];
      const x1 = lng1 * 111320 * Math.cos(lat1 * Math.PI / 180), y1 = lat1 * 111320;
      const x2 = lng2 * 111320 * Math.cos(lat2 * Math.PI / 180), y2 = lat2 * 111320;
      area += (x1 * y2 - x2 * y1);
    }
    const luas_m2 = Math.abs(area / 2);
    if (luas_m2 < 25) continue;
    const clipped = clipPolygonToBounds(polygonLatLng, bounds);
    if (!clipped || clipped.length < 3) continue;
    const props = el.tags || {};
    results.push({
      kategori: 'perairan', confidence_score: 1.0,
      luas_m2: Math.round(luas_m2), polygonLatLng: clipped,
      tile_id: 'osm_water',
      scanLat: (bounds[0].lat + bounds[1].lat) / 2,
      scanLng: (bounds[0].lng + bounds[1].lng) / 2,
      osm_id: el.id,
      nama_bangunan: props.name || props.natural || props.waterway || 'Perairan',
      source: 'osm',
    });
  }
  return results;
}

// ─── OSM VEGETATION → POLYGON ─────────────────────────────────────────────────
function overpassVegetationToPolygons(data, bounds) {
  const results = [];
  for (const el of (data.elements || [])) {
    if (!el.geometry?.length || el.geometry.length < 3) continue;
    const polygonLatLng = el.geometry.map(pt => [pt.lat, pt.lon]);
    let area = 0;
    for (let i = 0, j = polygonLatLng.length - 1; i < polygonLatLng.length; j = i++) {
      const [lat1, lng1] = polygonLatLng[i], [lat2, lng2] = polygonLatLng[j];
      const x1 = lng1 * 111320 * Math.cos(lat1 * Math.PI / 180), y1 = lat1 * 111320;
      const x2 = lng2 * 111320 * Math.cos(lat2 * Math.PI / 180), y2 = lat2 * 111320;
      area += (x1 * y2 - x2 * y1);
    }
    const luas_m2 = Math.abs(area / 2);
    if (luas_m2 < 25) continue;
    const clipped = clipPolygonToBounds(polygonLatLng, bounds);
    if (!clipped || clipped.length < 3) continue;
    const props = el.tags || {};
    results.push({
      kategori: 'pepohonan', confidence_score: 1.0,
      luas_m2: Math.round(luas_m2), polygonLatLng: clipped,
      tile_id: 'osm_vegetation',
      scanLat: (bounds[0].lat + bounds[1].lat) / 2,
      scanLng: (bounds[0].lng + bounds[1].lng) / 2,
      osm_id: el.id,
      nama_bangunan: props.name || props.landuse || props.natural || 'Vegetasi',
      source: 'osm',
    });
  }
  return results;
}

// ─── MERGE OSM + AI POLYGONS ──────────────────────────────────────────────────
function calcPolygonOverlapRatio(polyA, polyB) {
  // Hitung bounding box overlap sebagai aproksimasi cepat
  const minLat = (p) => Math.min(...p.map(x => x[0]));
  const maxLat = (p) => Math.max(...p.map(x => x[0]));
  const minLng = (p) => Math.min(...p.map(x => x[1]));
  const maxLng = (p) => Math.max(...p.map(x => x[1]));

  const overlapLat = Math.max(0, Math.min(maxLat(polyA), maxLat(polyB)) - Math.max(minLat(polyA), minLat(polyB)));
  const overlapLng = Math.max(0, Math.min(maxLng(polyA), maxLng(polyB)) - Math.max(minLng(polyA), minLng(polyB)));
  const overlapArea = overlapLat * overlapLng;

  const areaA = (maxLat(polyA) - minLat(polyA)) * (maxLng(polyA) - minLng(polyA));
  const areaB = (maxLat(polyB) - minLat(polyB)) * (maxLng(polyB) - minLng(polyB));
  const minArea = Math.min(areaA, areaB);

  if (minArea <= 0) return 0;
  return overlapArea / minArea;
}

function mergeOsmWithAI(osmPolygons, aiPolygons, overlapThreshold = 0.4) {
  const merged = [];
  const usedAiIdx = new Set();

  for (const osm of osmPolygons) {
    let bestMatch = null;
    let bestRatio = overlapThreshold;
    let bestIdx   = -1;

    for (let i = 0; i < aiPolygons.length; i++) {
      if (usedAiIdx.has(i)) continue;
      const ai = aiPolygons[i];
      // Hanya match kalau kategori sama (keduanya bangunan)
      if (ai.kategori !== osm.kategori) continue;
      const ratio = calcPolygonOverlapRatio(osm.polygonLatLng, ai.polygonLatLng);
      if (ratio > bestRatio) { bestRatio = ratio; bestMatch = ai; bestIdx = i; }
    }

    if (bestMatch && bestIdx >= 0) {
      // Pakai shape AI, metadata OSM
      usedAiIdx.add(bestIdx);
      merged.push({
        ...osm,
        polygonLatLng: bestMatch.polygonLatLng, // shape dari AI
        confidence_score: bestMatch.confidence_score,
        luas_m2: bestMatch.luas_m2 || osm.luas_m2,
        source: 'osm+ai',
        ai_confidence: bestMatch.confidence_score,
        osm_luas: osm.luas_m2,
      });
    } else {
      // Tidak ada AI match → tetap pakai OSM
      merged.push({ ...osm, source: 'osm' });
    }
  }

  return merged;
}

// ─── RADIUS HELPERS ───────────────────────────────────────────────────────────
function getExpectedCategories(waypointCategory = '') {
  const cat = waypointCategory.toLowerCase().replace(/[\s-]/g, '_');
  for (const [key, val] of Object.entries(WAYPOINT_CATEGORY_MAP)) {
    if (cat.includes(key)) return val;
  }
  return WAYPOINT_CATEGORY_MAP.default;
}

function findNearestWaypoint(polygonLatLng, waypoints, maxDistMeter = 500) {
  if (!polygonLatLng?.length || !waypoints?.length) return null;
  const sumLat = polygonLatLng.reduce((s, p) => s + p[0], 0);
  const sumLng = polygonLatLng.reduce((s, p) => s + p[1], 0);
  const cLat = sumLat / polygonLatLng.length;
  const cLng = sumLng / polygonLatLng.length;
  let nearest = null, minDist = Infinity;
  for (const wp of waypoints) {
    const d = calcDistance(cLat, cLng, wp.lat, wp.lng);
    if (d < minDist) { minDist = d; nearest = { ...wp, distToPolygon: d }; }
  }
  if (!nearest || minDist > maxDistMeter) return null;
  return nearest;
}

function crossValidatePolygon(polygon, nearestWp) {
  if (!nearestWp) return {
    status: 'no_waypoint', label: 'Tidak ada waypoint', color: '#94a3b8',
    reason: 'Tidak ada waypoint terdekat dalam radius 500m',
  };
  const expected = getExpectedCategories(nearestWp.category);
  const isMatch  = expected.includes(polygon.kategori);
  const conf     = polygon.confidence_score || 0;
  if (isMatch && conf >= 0.5) return {
    status: 'valid', label: 'Valid ✓', color: '#22c55e',
    reason: `Sesuai dengan ${nearestWp.name} (${nearestWp.category}) · ${Math.round(conf * 100)}%`,
    waypointName: nearestWp.name, waypointCategory: nearestWp.category,
  };
  if (isMatch && conf < 0.5) return {
    status: 'low_conf', label: 'Conf Rendah', color: '#f59e0b',
    reason: `Sesuai tipe tapi confidence rendah (${Math.round(conf * 100)}%)`,
    waypointName: nearestWp.name, waypointCategory: nearestWp.category,
  };
  return {
    status: 'mismatch', label: 'Tidak Sesuai ⚠', color: '#ef4444',
    reason: `Terdeteksi ${polygon.kategori} tapi waypoint "${nearestWp.name}" (${nearestWp.category}) berharap ${expected.join('/')}`,
    waypointName: nearestWp.name, waypointCategory: nearestWp.category,
  };
}

function calcValidationStats(allPolygons) {
  const valid    = allPolygons.filter(p => p.validation?.status === 'valid').length;
  const mismatch = allPolygons.filter(p => p.validation?.status === 'mismatch').length;
  const lowConf  = allPolygons.filter(p => p.validation?.status === 'low_conf').length;
  const noWp     = allPolygons.filter(p => p.validation?.status === 'no_waypoint').length;
  const total    = allPolygons.length;
  const validRate = total > 0 ? Math.round((valid / total) * 100) : 0;
  const catCounts = {};
  allPolygons.forEach(p => { catCounts[p.kategori] = (catCounts[p.kategori] || 0) + 1; });
  return { valid, mismatch, lowConf, noWp, total, validRate, catCounts };
}

function extractWaypoints(waypointData, waypointLayers, activeLayers) {
  const waypoints = [];
  waypointLayers.filter(l => activeLayers.includes(l.id) && waypointData[l.id]).forEach(layer => {
    const raw = waypointData[layer.id];
    const features = raw?.features || (Array.isArray(raw) ? raw : []);
    features.forEach((feature, idx) => {
      let lat, lng;
      if (feature?.geometry?.coordinates) { lng = feature.geometry.coordinates[0]; lat = feature.geometry.coordinates[1]; }
      else if (feature?.lat != null)       { lat = feature.lat; lng = feature.lng; }
      else if (feature?.latitude != null)  { lat = feature.latitude; lng = feature.longitude; }
      if (isNaN(lat) || isNaN(lng) || lat == null || lng == null) return;
      const props = feature.properties || feature || {};
      waypoints.push({
        id: `${layer.id}_${idx}`, lat, lng,
        name: props.name || props.nama || props.NAMOBJ || 'Tanpa Nama',
        category: layer.category || props.kategori || props.category || props.amenity || '',
        layerId: layer.id, layerLabel: layer.label, color: layer.color,
      });
    });
  });
  return waypoints;
}

// ─── LEAFLET ICONS ────────────────────────────────────────────────────────────
const createCenterIcon = () =>
  L.divIcon({
    html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#06b6d4,#3b82f6);border-radius:50%;border:3px solid white;box-shadow:0 0 18px rgba(6,182,212,0.9);display:flex;align-items:center;justify-content:center;"><div style="width:7px;height:7px;background:white;border-radius:50%;"></div></div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });

const createWaypointIcon = (color = '#3b82f6') =>
  L.divIcon({
    html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${color}80;"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    pending:  { color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',   icon: Clock,         label: 'Pending'   },
    scanning: { color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',     icon: ScanLine,      label: 'Scanning'  },
    done:     { color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400', icon: CheckCircle2,  label: 'Done'      },
    error:    { color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',         icon: XCircle,       label: 'Error'     },
    empty:    { color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', icon: AlertTriangle, label: 'Empty'     },
  };
  const s = cfg[status] || cfg.pending, Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>
      <Icon size={9} /> {s.label}
    </span>
  );
}

// ─── RADIUS POLYGON CARD ──────────────────────────────────────────────────────
function RadiusPolygonCard({ polygon, onLocate }) {
  const [open, setOpen] = useState(false);
  const meta       = CATEGORY_META[polygon.kategori] || {};
  const validation = polygon.validation || {};
  const catColor   = meta.color || '#94a3b8';

  const statusBg = {
    valid:    'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700/40',
    mismatch: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40',
    low_conf: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40',
  }[validation.status] || 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700';

  const tileLabel = polygon.waypointSource?.name
    ? polygon.waypointSource.name.slice(0, 8) + (polygon.waypointSource.name.length > 8 ? '…' : '')
    : '—';

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${statusBg}`}>
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-1" style={{ background: catColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">
                {meta.label || polygon.kategori}
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: `${validation.color || '#94a3b8'}20`, color: validation.color || '#94a3b8' }}>
                {validation.label || '—'}
              </span>
            </div>
            {validation.waypointName && (
              <p className="text-[9px] mt-0.5 truncate text-slate-400 dark:text-slate-500">
                WP: <b>{validation.waypointName}</b>
                {validation.waypointCategory ? ` (${validation.waypointCategory})` : ''}
              </p>
            )}
          </div>
          <span className={`text-[9px] font-black flex-shrink-0 ${
            polygon.confidence_score >= 0.7 ? 'text-green-500' :
            polygon.confidence_score >= 0.5 ? 'text-amber-500' : 'text-red-500'
          }`}>{Math.round((polygon.confidence_score || 0) * 100)}%</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {[
            { val: tileLabel,                    label: 'Sumber', col: 'text-cyan-600 dark:text-cyan-400'   },
            { val: fmtArea(polygon.luas_m2),     label: 'Luas',   col: 'text-amber-600 dark:text-amber-400' },
            { val: polygon.nearestWp ? fmtDist(polygon.nearestWp.distToPolygon) : '—',
              label: 'Jarak', col: 'text-violet-600 dark:text-violet-400' },
          ].map(s => (
            <div key={s.label} className="p-1.5 rounded-lg text-center bg-white/60 dark:bg-slate-700/40">
              <div className={`text-[10px] font-black truncate ${s.col}`}>{s.val}</div>
              <div className="text-[8px] text-slate-500 font-bold uppercase">{s.label}</div>
            </div>
          ))}
        </div>

        {validation.reason && (
          <p className="text-[9px] px-2 py-1.5 rounded-lg mb-2 bg-slate-100 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400">
            {validation.reason}
          </p>
        )}

        {polygon.nearestWp && (
          <button onClick={() => setOpen(v => !v)}
            className="w-full flex items-center justify-between text-[9px] font-black uppercase mb-1 text-slate-400 dark:text-slate-500">
            <span>Waypoint Terdekat</span>
            {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
        {open && polygon.nearestWp && (
          <div className="text-[9px] px-2 py-1.5 rounded-lg mb-2 space-y-0.5 bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300">
            <p><b>Nama:</b> {polygon.nearestWp.name}</p>
            <p><b>Layer:</b> {polygon.nearestWp.layerLabel}</p>
            <p><b>Kategori:</b> {polygon.nearestWp.category}</p>
            <p><b>Koordinat:</b> {polygon.nearestWp.lat.toFixed(5)}, {polygon.nearestWp.lng.toFixed(5)}</p>
            <p><b>Jarak ke Polygon:</b> {fmtDist(polygon.nearestWp.distToPolygon)}</p>
          </div>
        )}

        <button onClick={onLocate}
          className="w-full py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all">
          <Eye size={10} /> Lihat di Peta
        </button>
      </div>
    </div>
  );
}

// ─── RADIUS NO WAYPOINT CARD ──────────────────────────────────────────────────
function RadiusNoWaypointCard({ polygon, onLocate, onGeocode, geocodeResult }) {
  const meta     = CATEGORY_META[polygon.kategori] || {};
  const catColor = meta.color || '#94a3b8';
  const [loading, setLoading] = useState(false);

  const cLat = polygon.polygonLatLng?.length
    ? polygon.polygonLatLng.reduce((s, p) => s + p[0], 0) / polygon.polygonLatLng.length : 0;
  const cLng = polygon.polygonLatLng?.length
    ? polygon.polygonLatLng.reduce((s, p) => s + p[1], 0) / polygon.polygonLatLng.length : 0;

  const handleGeocode = async () => {
    if (geocodeResult || loading) return;
    setLoading(true);
    await onGeocode(cLat, cLng);
    setLoading(false);
  };

  return (
    <div className="rounded-xl border-2 overflow-hidden bg-slate-50 dark:bg-slate-800/60 border-violet-200 dark:border-violet-800/40">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: catColor }} />
          <span className="text-[11px] font-black uppercase flex-1 text-slate-800 dark:text-slate-200">
            {meta.label || polygon.kategori}
          </span>
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500">Luar WP</span>
          <span className={`text-[9px] font-black ml-1 ${
            polygon.confidence_score >= 0.7 ? 'text-green-500' :
            polygon.confidence_score >= 0.5 ? 'text-amber-500' : 'text-red-500'
          }`}>{Math.round((polygon.confidence_score || 0) * 100)}%</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div className="p-1.5 rounded-lg text-center bg-white/60 dark:bg-slate-700/40">
            <div className="text-[10px] font-black text-amber-600 dark:text-amber-400">{fmtArea(polygon.luas_m2)}</div>
            <div className="text-[8px] text-slate-500 font-bold uppercase">Luas</div>
          </div>
          <div className="p-1.5 rounded-lg text-center bg-white/60 dark:bg-slate-700/40">
            <div className="text-[10px] font-black truncate text-cyan-600 dark:text-cyan-400">
              {polygon.waypointSource?.name
                ? polygon.waypointSource.name.slice(0, 10) + (polygon.waypointSource.name.length > 10 ? '…' : '')
                : '—'}
            </div>
            <div className="text-[8px] text-slate-500 font-bold uppercase">Scan dari</div>
          </div>
        </div>

        {geocodeResult ? (
          <div className="px-2 py-1.5 rounded-lg mb-2 text-[9px] bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
            <p className="font-black mb-0.5">📍 {geocodeResult.name}</p>
            {geocodeResult.address?.road && (
              <p className="opacity-70 truncate">
                {geocodeResult.address.road}{geocodeResult.address.suburb ? `, ${geocodeResult.address.suburb}` : ''}
              </p>
            )}
          </div>
        ) : (
          <button onClick={handleGeocode} disabled={loading}
            className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase mb-2 flex items-center justify-center gap-1 transition-all ${
              loading
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                : 'bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800'
            }`}>
            <Search size={10} />
            {loading ? 'Mencari...' : 'Cari Nama via OSM'}
          </button>
        )}

        <button onClick={onLocate}
          className="w-full py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all">
          <Eye size={10} /> Lihat di Peta
        </button>
      </div>
    </div>
  );
}

// ─── RADIUS VALIDATION SUMMARY ────────────────────────────────────────────────
function RadiusValidationSummary({ allPolygons, waypointsInRadius }) {
  const stats = useMemo(() => calcValidationStats(allPolygons), [allPolygons]);
  return (
    <div className="p-3 rounded-xl border-2 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-cyan-300/50 dark:border-cyan-500/20">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-cyan-600 dark:text-cyan-400" />
        <h3 className="text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
          Ringkasan Validasi
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {[
          { label: 'Total Polygon',  value: stats.total,              color: 'text-slate-800 dark:text-slate-200' },
          { label: 'Valid ✓',        value: stats.valid,              color: 'text-green-500' },
          { label: 'Tidak Sesuai',   value: stats.mismatch,           color: 'text-red-500' },
          { label: 'Conf Rendah',    value: stats.lowConf,            color: 'text-amber-500' },
          { label: 'Luar Waypoint',  value: stats.noWp,               color: 'text-violet-500' },
          { label: 'Waypoint Aktif', value: waypointsInRadius.length, color: 'text-cyan-600 dark:text-cyan-400' },
        ].map(s => (
          <div key={s.label} className="p-2 rounded-lg text-center bg-white/60 dark:bg-slate-700/30">
            <div className={`text-sm font-black ${s.color}`}>{s.value}</div>
            <div className="text-[8px] font-bold uppercase text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {stats.total > 0 && (
        <div className="p-2 rounded-lg mb-3 bg-white/50 dark:bg-slate-700/40">
          <p className="text-[8px] font-black uppercase text-slate-400 mb-1.5">Polygon per Kategori</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.catCounts).map(([cat, cnt]) => {
              const meta = CATEGORY_META[cat] || {};
              return (
                <span key={cat} className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${meta.color}20`, color: meta.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                  {meta.label || cat}: {cnt}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-bold uppercase text-slate-500">Validasi Rate</span>
          <span className={`text-sm font-black ${stats.validRate >= 70 ? 'text-green-500' : stats.validRate >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
            {stats.validRate}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              stats.validRate >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
              stats.validRate >= 40 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
              'bg-gradient-to-r from-red-500 to-red-600'
            }`}
            style={{ width: `${stats.validRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── RADIUS SCAN PROGRESS ─────────────────────────────────────────────────────
function RadiusScanProgress({ progress, currentWaypoint, isScanning }) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="p-3 rounded-xl border-2 bg-cyan-50 dark:bg-slate-800/70 border-cyan-300/50 dark:border-cyan-500/30">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-cyan-500 animate-pulse' : 'bg-green-500'}`} />
        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
          {isScanning ? `SCANNING ${pct}%` : 'SELESAI'}
        </span>
        <span className="text-[9px] ml-auto text-slate-500 dark:text-slate-400">
          {progress.done}/{progress.total} · {progress.objects} obj
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-2 bg-cyan-200 dark:bg-slate-700">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      {isScanning && currentWaypoint && (
        <p className="text-[9px] truncate text-slate-600 dark:text-slate-400">
          <ScanLine size={9} className="inline mr-1" />
          {currentWaypoint.name} · ({currentWaypoint.lat.toFixed(4)}, {currentWaypoint.lng.toFixed(4)})
        </p>
      )}
    </div>
  );
}

// ─── ANALYSIS PANEL ───────────────────────────────────────────────────────────
function AnalysisPanel({ results, tileGrid, tileStats, scanMode, kabupatenName, isDirectScan }) {
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [showExport, setShowExport] = useState(false);

  const catCounts = useMemo(() => results.reduce((acc, r) => { acc[r.kategori] = (acc[r.kategori] || 0) + 1; return acc; }, {}), [results]);
  const catLuas   = useMemo(() => results.reduce((acc, r) => { acc[r.kategori] = (acc[r.kategori] || 0) + (r.luas_m2 || 0); return acc; }, {}), [results]);
  const totalLuas = useMemo(() => Object.values(catLuas).reduce((a, b) => a + b, 0), [catLuas]);
  const avgConf   = useMemo(() => results.length ? (results.reduce((s, r) => s + r.confidence_score, 0) / results.length) : 0, [results]);
  const envScore  = useMemo(() => calcEnvScore(catCounts, results.length), [catCounts, results.length]);
  const highConf  = useMemo(() => results.filter(r => r.confidence_score >= 0.8).length, [results]);

  const barData = useMemo(() =>
    CATEGORIES.filter(c => catCounts[c.id]).map(c => ({
      name: c.label, id: c.id,
      count: catCounts[c.id] || 0, luas: catLuas[c.id] || 0, color: c.color,
      pct: results.length ? Math.round(((catCounts[c.id] || 0) / results.length) * 100) : 0,
    })), [catCounts, catLuas, results.length]);

  const pieData = useMemo(() => barData.map(d => ({ name: d.name, value: d.count, fill: d.color })), [barData]);

  const insights = useMemo(() => {
    const out = [], total = results.length;
    if (!total) return out;
    const pB = (catCounts.bangunan  || 0) / total;
    const pP = (catCounts.pepohonan || 0) / total;
    const pA = (catCounts.perairan  || 0) / total;
    const pJ = (catCounts.jalan     || 0) / total;
    if (pB > 0.6)              out.push({ type: 'danger',  title: 'Densitas Bangunan Tinggi',  desc: `${Math.round(pB * 100)}% objek terdeteksi sebagai bangunan.` });
    else if (pB > 0.4)         out.push({ type: 'warning', title: 'Densitas Bangunan Sedang',  desc: `${Math.round(pB * 100)}% bangunan. Pertumbuhan perlu dipantau.` });
    if (pP < 0.1 && pB > 0.3)  out.push({ type: 'danger',  title: 'Defisit RTH',               desc: `Vegetasi hanya ${Math.round(pP * 100)}% — di bawah standar 30%.` });
    else if (pP > 0.4)         out.push({ type: 'success', title: 'Tutupan Vegetasi Baik',     desc: `${Math.round(pP * 100)}% area bervegetasi.` });
    if (pA > 0.15)             out.push({ type: 'warning', title: 'Potensi Rawan Banjir',      desc: `Perairan ${Math.round(pA * 100)}% — relatif tinggi.` });
    if (pJ < 0.05 && pB > 0.2) out.push({ type: 'warning', title: 'Aksesibilitas Rendah',      desc: 'Rasio jalan vs bangunan rendah.' });
    if (avgConf < 0.6)         out.push({ type: 'info',    title: 'Akurasi Rendah',             desc: `Confidence rata-rata ${Math.round(avgConf * 100)}%.` });
    else if (avgConf > 0.85)   out.push({ type: 'success', title: 'Akurasi Tinggi',             desc: `Confidence rata-rata ${Math.round(avgConf * 100)}%.` });
    return out;
  }, [results, catCounts, avgConf]);

  const tileStatusCounts = useMemo(() => ({
    done:  tileGrid.filter(t => t.status === 'done').length,
    empty: tileGrid.filter(t => t.status === 'empty').length,
    error: tileGrid.filter(t => t.status === 'error').length,
  }), [tileGrid]);

  const handleExportJSON = () => {
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    exportJSON({ meta: { scanMode, kabupatenName, scanDate: new Date().toISOString(), tileTotal: tileStats.total, tileDone: tileStats.done }, summary: { totalObjects: results.length, totalLuas, avgConf, envScore, catCounts, catLuas }, results }, `geoscan_${kabupatenName || 'area'}_${ts}.json`);
    setShowExport(false);
  };

  const handleExportCSV = () => {
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    exportCSVFile(results.map(r => ({ kategori: r.kategori, confidence_score: r.confidence_score, luas_m2: r.luas_m2 || '', tile_id: r.tile_id || '', scan_lat: r.scanLat || '', scan_lng: r.scanLng || '' })), `geoscan_${kabupatenName || 'area'}_${ts}.csv`);
    setShowExport(false);
  };

  const insightStyle = { danger: 'border-red-400/40 bg-red-500/5 text-red-500 dark:text-red-400', warning: 'border-amber-400/40 bg-amber-500/5 text-amber-600 dark:text-amber-400', success: 'border-green-400/40 bg-green-500/5 text-green-600 dark:text-green-400', info: 'border-cyan-400/40 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400' };
  const insightIcon  = { danger: '⚠', warning: '⚠', success: '✓', info: 'ℹ' };

  const tabs = [{ id: 'ringkasan', label: 'Ringkasan', icon: BarChart2 }, { id: 'lahan', label: 'Lahan', icon: Layers }, { id: 'insight', label: 'Insight', icon: Zap }];
  const envColor = envScore >= 60 ? 'text-green-600 dark:text-green-400' : envScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const envLabel = envScore >= 70 ? 'Baik' : envScore >= 50 ? 'Cukup' : envScore >= 30 ? 'Perlu Perhatian' : 'Kritis';
  if (!results.length) return null;

  const tooltipStyle = { background: 'var(--tooltip-bg,#0f172a)', border: '1px solid var(--tooltip-border,#334155)', borderRadius: 8, fontSize: 10 };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <BarChart2 size={12} className="text-white" />
          </div>
          <span className="text-[11px] font-black text-slate-700 dark:text-white uppercase tracking-wide">Analisis</span>
          <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full border border-cyan-500/20">{results.length} obj</span>
          {isDirectScan && <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20">DIRECT</span>}
        </div>
        <div className="relative">
          <button onClick={() => setShowExport(v => !v)} className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-cyan-500/50 transition-colors">
            <Download size={10} className="text-slate-500 dark:text-slate-400" />
          </button>
          {showExport && (
            <>
              <div className="fixed inset-0 z-[50]" onClick={() => setShowExport(false)} />
              <div className="absolute right-0 top-8 z-[51] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden w-28">
                <button onClick={handleExportJSON} className="w-full px-3 py-2 text-left text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"><FileText size={10} className="text-cyan-500" /> JSON</button>
                <button onClick={handleExportCSV}  className="w-full px-3 py-2 text-left text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"><Globe size={10} className="text-green-500" /> CSV</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-black uppercase tracking-wider transition-all border-b-2 ${activeTab === t.id ? 'text-cyan-600 dark:text-cyan-400 border-cyan-500 bg-white dark:bg-slate-800' : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <Icon size={9} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="p-3 space-y-3">
        {activeTab === 'ringkasan' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Objek',      value: results.length.toLocaleString(), sub: isDirectScan ? '1 capture' : `${tileStats.done} tile`, accent: '#06b6d4' },
                { label: 'Akurasi',   value: `${Math.round(avgConf * 100)}%`,  sub: `${highConf} ≥80%`,  accent: '#a78bfa' },
                { label: 'Luas',      value: fmtArea(totalLuas),               sub: 'estimasi',          accent: '#f59e0b' },
                { label: 'Env Score', value: `${envScore}`,                    sub: envLabel,            accent: envScore >= 60 ? '#22c55e' : envScore >= 40 ? '#f59e0b' : '#ef4444' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-xl p-2.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{s.label}</span>
                  <div className="text-lg font-black leading-none mt-1" style={{ color: s.accent }}>{s.value}</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5">Distribusi</p>
              <div className="space-y-2">
                {barData.map(d => {
                  const cat = CATEGORIES.find(c => c.id === d.id), Icon = cat?.Icon || Layers;
                  return (
                    <div key={d.id} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${d.color}22` }}><Icon size={10} style={{ color: d.color }} /></div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{d.name}</span>
                          <span className="text-[10px] font-black text-slate-800 dark:text-white">{d.count.toLocaleString()} <span className="text-slate-400 font-medium">({d.pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
                        </div>
                        {d.luas > 0 && <p className="text-[8px] text-slate-400 dark:text-slate-600 mt-0.5">{fmtArea(d.luas)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Proporsi</p>
              <div className="flex items-center gap-3">
                <ResponsiveContainer width={110} height={110}>
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={3} strokeWidth={0}>{pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">{barData.map(d => (<div key={d.id} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} /><span className="text-[9px] text-slate-500 dark:text-slate-400 flex-1">{d.name}</span><span className="text-[9px] font-black text-slate-800 dark:text-white">{d.pct}%</span></div>))}</div>
              </div>
            </div>
            {!isDirectScan && (
              <div className="grid grid-cols-3 gap-1.5">
                {[{ v: tileStatusCounts.done, l: 'Terisi', c: 'text-green-600 dark:text-green-400' }, { v: tileStatusCounts.empty, l: 'Kosong', c: 'text-amber-600 dark:text-amber-400' }, { v: tileStatusCounts.error, l: 'Error', c: 'text-red-600 dark:text-red-400' }].map(s => (
                  <div key={s.l} className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 rounded-xl p-2 text-center">
                    <div className={`text-base font-black ${s.c}`}>{s.v}</div>
                    <div className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase">{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === 'lahan' && (
          <>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Objek per Kategori</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={barData} barSize={22}><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} width={24} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#00000008' }} /><Bar dataKey="count" name="Jumlah" radius={[4, 4, 0, 0]}>{barData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar></BarChart>
              </ResponsiveContainer>
            </div>
            {totalLuas > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Luas per Kategori</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={barData.filter(d => d.luas > 0)} barSize={22}><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(0)}ha` : `${v}m²`} /><Tooltip contentStyle={tooltipStyle} formatter={v => [fmtArea(v), 'Luas']} cursor={{ fill: '#00000008' }} /><Bar dataKey="luas" name="Luas" radius={[4, 4, 0, 0]}>{barData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar></BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5">Terbangun vs Alami</p>
              {[{ label: 'Terbangun', value: (catCounts.bangunan || 0) + (catCounts.jalan || 0), color: '#ef4444' }, { label: 'Alami', value: (catCounts.pepohonan || 0) + (catCounts.perairan || 0), color: '#22c55e' }].map(row => {
                const pct = results.length ? Math.round((row.value / results.length) * 100) : 0;
                return (
                  <div key={row.label} className="mb-2">
                    <div className="flex justify-between mb-1"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{row.label}</span><span className="text-[10px] font-black text-slate-800 dark:text-white">{row.value.toLocaleString()} ({pct}%)</span></div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: row.color }} /></div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                <span className="text-[9px] font-black text-slate-400 uppercase">Env Score</span>
                <span className={`text-base font-black ${envColor}`}>{envScore}/100 · {envLabel}</span>
              </div>
            </div>
          </>
        )}
        {activeTab === 'insight' && (
          <>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Info Scan</p>
              <div className="space-y-1.5">
                {[{ k: 'Wilayah', v: kabupatenName || 'Radius' }, { k: 'Mode', v: isDirectScan ? 'Direct' : scanMode === 'kabupaten' ? 'Kabupaten' : scanMode === 'radius' ? 'Radius Scan' : 'Direct' }, { k: 'Tile', v: isDirectScan ? '1x' : `${tileStats.done}/${tileStats.total}` },
                  
                { k: 'Objek', v: results.length.toLocaleString() }, { k: 'Luas', v: fmtArea(totalLuas) }, { k: 'Conf', v: `${Math.round(avgConf * 100)}%` }, { k: 'Env Score', v: `${envScore}/100` }, { k: 'Tanggal', v: new Date().toLocaleDateString('id-ID') }].map(row => (
                  <div key={row.k} className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/40 last:border-0">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">{row.k}</span>
                    <span className="text-[10px] text-slate-800 dark:text-white font-bold">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Temuan ({insights.length})</p>
              {insights.length > 0 ? (
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <div key={i} className={`border rounded-xl p-2.5 flex items-start gap-2 ${insightStyle[ins.type]}`}>
                      <span className="text-xs mt-0.5 flex-shrink-0">{insightIcon[ins.type]}</span>
                      <div><p className="text-[10px] font-black text-slate-800 dark:text-white">{ins.title}</p><p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{ins.desc}</p></div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-3">Tidak ada temuan.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── KABUPATEN SEARCH ─────────────────────────────────────────────────────────
function KabupatenSearchPanel({ kabupatenList, selectedKabupaten, onSelect, isLoading }) {
  const [query, setQuery]   = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const getName = (f) => f?.properties?.name || f?.properties?.NAMOBJ || f?.properties?.KAB_KOTA || '';
  const getProv = (f) => f?.properties?.provinsi || f?.properties?.PROPINSI || f?.properties?.Propinsi || '';
  const filtered = useMemo(() => { const q = query.toLowerCase().trim(); if (!q) return kabupatenList.slice(0, 60); return kabupatenList.filter(f => getName(f).toLowerCase().includes(q)).slice(0, 60); }, [query, kabupatenList]);

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 cursor-text transition-all ${isOpen ? 'border-cyan-500 shadow-lg shadow-cyan-500/10' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}>
        {isLoading ? <div className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin flex-shrink-0" /> : <Search size={13} className="text-slate-400 flex-shrink-0" />}
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder="Cari kabupaten / kota..." className="flex-1 bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none min-w-0" />
        {selectedKabupaten && !query && <button onClick={e => { e.stopPropagation(); onSelect(null); setQuery(''); }} className="text-slate-400 hover:text-red-400 transition-colors"><X size={12} /></button>}
      </div>
      {selectedKabupaten && !isOpen && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
          <div className="flex-1 min-w-0"><p className="text-[11px] font-black text-cyan-700 dark:text-cyan-400 truncate">{getName(selectedKabupaten)}</p>{getProv(selectedKabupaten) && <p className="text-[9px] text-cyan-600/60 truncate">{getProv(selectedKabupaten)}</p>}</div>
          <button onClick={() => { onSelect(null); setQuery(''); }} className="text-cyan-400 hover:text-red-400 flex-shrink-0"><X size={11} /></button>
        </div>
      )}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 z-[1000] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0
                ? <div className="py-6 text-center text-[11px] text-slate-400">{isLoading ? 'Memuat...' : 'Tidak ditemukan'}</div>
                : filtered.map((f, idx) => {
                    const name = getName(f), prov = getProv(f), isSel = selectedKabupaten && getName(selectedKabupaten) === name;
                    return (
                      <button key={idx} onClick={() => { onSelect(f); setQuery(''); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isSel ? 'bg-cyan-50 dark:bg-cyan-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <MapPin size={11} className={isSel ? 'text-cyan-500' : 'text-slate-400'} />
                        <div className="flex-1 min-w-0"><p className={`text-[11px] font-bold truncate ${isSel ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-200'}`}>{name}</p>{prov && <p className="text-[9px] text-slate-400 truncate">{prov}</p>}</div>
                        {isSel && <CheckCircle2 size={11} className="text-cyan-500 flex-shrink-0" />}
                      </button>
                    );
                  })
              }
            </div>
            <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"><p className="text-[9px] text-slate-400">{filtered.length} hasil · atau klik di peta</p></div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── KABUPATEN MAP OVERLAY ────────────────────────────────────────────────────
export const KabupatenMapOverlay = memo(function KabupatenMapOverlay({ 
  kabupatenList, selectedKabupaten, isClickMode, onSelect, isActive, isDisabled 
}) { 
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.getContainer().style.cursor = (isClickMode && !isDisabled) ? 'crosshair' : '';
    return () => { if (map.getContainer()) map.getContainer().style.cursor = ''; };
  }, [map, isClickMode, isDisabled]);

  useMapEvents({
    click(e) {
      if (!isClickMode || !kabupatenList?.length || isDisabled) return;
      const hit = kabupatenList.find(f => pointInFeature(e.latlng, f));
      if (hit) onSelect?.(hit);
      else toast('Klik di dalam wilayah kabupaten', { icon: '📍', duration: 1500 });
    },
  });

  const getSelName = () => 
    selectedKabupaten?.properties?.name || 
    selectedKabupaten?.properties?.NAMOBJ || 
    selectedKabupaten?.properties?.KAB_KOTA || '';

  const style = useCallback((feature) => {
    const name  = feature.properties?.name || feature.properties?.NAMOBJ || feature.properties?.KAB_KOTA || '';
    const isSel = selectedKabupaten && name === getSelName();
    if (isSel) return { color: '#00ffcc', weight: 2.5, fillColor: '#00ffcc', fillOpacity: 0.18, opacity: 1 };
    return { color: '#38bdf8', weight: 0.8, fillColor: '#0ea5e9', fillOpacity: 0.04, dashArray: '5,5', opacity: 0.7 };
  }, [selectedKabupaten]);

  const onEachFeature = useCallback((feature, layer) => {
    const props = feature.properties || {};
    const name  = props.name || props.NAMOBJ || props.KAB_KOTA || '';
    const prov  = props.provinsi || props.PROPINSI || props.Propinsi || '';
    const tipe  = props.type_wilayah || props.TIPE || '';
    const isSel = selectedKabupaten && name === getSelName();
    layer.bindPopup(`<div style="font-family:system-ui,sans-serif;min-width:190px;padding:2px"><div style="background:linear-gradient(135deg,#0d9488,#0891b2);color:white;padding:10px 12px;border-radius:10px 10px 4px 4px;margin-bottom:6px"><div style="font-size:8px;font-weight:800;opacity:.75;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">${tipe || 'Kabupaten / Kota'}</div><div style="font-size:15px;font-weight:900">${name}</div></div><div style="padding:0 4px 4px">${prov ? `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase">Provinsi</span><span style="font-size:11px;font-weight:700;color:#0f766e">${prov}</span></div>` : ''}${isClickMode && !isSel ? `<div style="margin-top:6px;padding:6px 8px;background:#f0fdfa;border-radius:8px;border:1px solid #99f6e4;font-size:9px;font-weight:700;color:#0d9488;text-align:center">✓ Klik untuk pilih</div>` : ''}${isSel ? `<div style="margin-top:6px;padding:6px 8px;background:#ecfdf5;border-radius:8px;border:1px solid #6ee7b7;font-size:9px;font-weight:700;color:#059669;text-align:center">✅ Dipilih</div>` : ''}</div></div>`, { maxWidth: 240 });
    layer.on({
      mouseover: (e) => { 
        if (isSel || isDisabled) return; 
        e.target.setStyle({ fillOpacity: 0.12, color: '#22d3ee', weight: 1.5, opacity: 1, dashArray: undefined }); 
        e.target.bindTooltip(`<span style="font-size:11px;font-weight:800;color:#0f172a">${name}</span>`, { sticky: true }).openTooltip(); 
      },
      mouseout: (e) => { 
        if (isSel || isDisabled) return; 
        e.target.setStyle(style(feature)); 
        e.target.closeTooltip(); 
      },
      click: (e) => { 
        if (!isClickMode || isDisabled) return; 
        e.target.setStyle({ fillColor: '#00ffcc', fillOpacity: 0.4, color: '#00ffcc', weight: 3, dashArray: undefined }); 
        setTimeout(() => onSelect?.(feature), 180); 
      },
    });
  }, [selectedKabupaten, isClickMode, onSelect, style, isDisabled]);

  if (!isActive || !kabupatenList?.length) return null;
  return (
    <GeoJSON 
      key={`kab-${kabupatenList.length}`} 
      data={{ type: 'FeatureCollection', features: kabupatenList }} 
      style={style} 
      onEachFeature={onEachFeature} 
    />
  );
});

// ─── AREA SCAN OVERLAY ────────────────────────────────────────────────────────
export function AreaScanOverlay({
  isActive, isDrawing, onBoundsSet, drawnBounds,
  tileGrid, scanningTileIdx, previewResults, onTileClick, isScanning,
  isDirectMode, directScanningActive,
  radiusLayers, activeRadius, radiusCenter, waypointsInRadius,
  allRadiusPolygons, isRadiusMode,
}) {
  const map     = useMap();
  const startPt = useRef(null);
  const [tempRect, setTempRect] = useState(null);
  const [ready, setReady]       = useState(false);
  const canDraw = isDrawing && !isScanning;

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (canDraw) { map.scrollWheelZoom.disable(); container.style.cursor = 'crosshair'; }
    else         { map.scrollWheelZoom.enable(); map.dragging.enable(); container.style.cursor = ''; }
    return () => { map.scrollWheelZoom.enable(); map.dragging.enable(); container.style.cursor = ''; };
  }, [map, canDraw]);

  useEffect(() => {
    if (!map) return;
    if (map._loaded) { setReady(true); return; }
    const fn = () => setReady(true);
    map.once('load', fn);
    const t = setTimeout(() => setReady(true), 500);
    return () => { map.off('load', fn); clearTimeout(t); };
  }, [map]);

  useMapEvents({
    mousedown(e) { if (!canDraw || !ready) return; startPt.current = e.latlng; map.dragging.disable(); map.scrollWheelZoom.disable(); },
    mousemove(e) { if (!canDraw || !startPt.current) return; setTempRect([startPt.current, e.latlng]); },
    mouseup(e) {
      if (!canDraw || !startPt.current) return;
      const b0 = startPt.current, b1 = e.latlng;
      if (Math.abs(b0.lat - b1.lat) > meterToLat(50) && Math.abs(b0.lng - b1.lng) > meterToLng(50, b0.lat)) { onBoundsSet([b0, b1]); }
      else { toast.error('Area terlalu kecil!'); }
      setTempRect(null); startPt.current = null; map.dragging.enable(); map.scrollWheelZoom.enable();
    },
  });

  const getCatColor = (cat) => CATEGORIES.find(c => c.id === cat)?.color || '#ef4444';
  if (!isActive) return null;

  return (
    <>
      {tempRect && <Rectangle bounds={tempRect} pathOptions={{ color: '#fff', weight: 2, fillColor: '#06b6d4', fillOpacity: 0.12, dashArray: '8,5' }} />}
      {drawnBounds && !isRadiusMode && (isDirectMode ? true : tileGrid.length === 0) && (
        <Rectangle bounds={[[drawnBounds[0].lat, drawnBounds[0].lng], [drawnBounds[1].lat, drawnBounds[1].lng]]} pathOptions={{ color: directScanningActive ? '#00ffcc' : '#06b6d4', weight: directScanningActive ? 2.5 : 1.5, fillColor: directScanningActive ? '#00ffcc' : '#06b6d4', fillOpacity: directScanningActive ? 0.04 : 0.08, dashArray: directScanningActive ? undefined : '8,5' }} />
      )}

      {/* Radius map elements */}
      {isRadiusMode && radiusLayers?.map(rl => (
        <Circle key={rl.id} center={rl.center} radius={rl.radius}
          pathOptions={{ color: activeRadius === rl.id ? '#06b6d4' : '#3b82f6', fillColor: activeRadius === rl.id ? '#06b6d4' : '#3b82f6', fillOpacity: activeRadius === rl.id ? 0.08 : 0.03, weight: activeRadius === rl.id ? 2.5 : 1.5, dashArray: activeRadius === rl.id ? undefined : '6,5' }} />
      ))}
      {isRadiusMode && radiusCenter && (
        <Marker position={radiusCenter} icon={createCenterIcon()}>
          <Popup><div className="p-2 min-w-[160px]"><p className="font-bold text-cyan-600 text-xs mb-1">TITIK PUSAT</p><p className="text-[10px] text-slate-500">{radiusCenter.lat.toFixed(6)}, {radiusCenter.lng.toFixed(6)}</p></div></Popup>
        </Marker>
      )}
      {isRadiusMode && waypointsInRadius?.map(wp => (
        <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={createWaypointIcon(wp.color)}>
          <Popup><div className="p-2 min-w-[170px] text-xs"><div className="flex items-center gap-1.5 mb-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: wp.color }} /><span className="font-bold text-slate-700">{wp.name}</span></div><p className="text-slate-500">{wp.layerLabel}</p><p className="text-slate-400 text-[10px]">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</p></div></Popup>
        </Marker>
      ))}
      {isRadiusMode && allRadiusPolygons?.map((poly, idx) => {
        if (!poly.polygonLatLng || poly.polygonLatLng.length < 3) return null;
        const color = CATEGORY_META[poly.kategori]?.color || '#ef4444';
const borderColor = poly.validation?.color || color;
        const meta     = CATEGORY_META[poly.kategori] || {};
        const isDashed = poly.validation?.status === 'mismatch' || poly.validation?.status === 'no_waypoint';
        return (
          <Polygon key={`rpoly-${idx}`} positions={poly.polygonLatLng} pathOptions={{ color: borderColor, fillColor: color, fillOpacity: 0.45, weight: poly.validation?.status === 'valid' ? 2.5 : 1.5, dashArray: isDashed ? '5,4' : undefined }}>
            <Popup>
              <div className="p-2 min-w-[200px] text-xs">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: meta.color || color }} />
                  <span className="font-bold uppercase">{meta.label || poly.kategori}</span>
                  <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>{poly.validation?.label || '—'}</span>
                </div>
                {poly.nearestWp && <p className="text-slate-500 mb-1">WP: <b>{poly.nearestWp.name}</b></p>}
                {poly.validation?.reason && <p className="text-slate-400 text-[9px] italic mb-1">{poly.validation.reason}</p>}
                {poly.luas_m2 && <p className="text-slate-500">Luas: <b className="text-sky-600">{fmtArea(poly.luas_m2)}</b></p>}
                <p className="text-slate-400">Conf: {Math.round((poly.confidence_score || 0) * 100)}%</p>
              </div>
            </Popup>
          </Polygon>
        );
      })}

      {/* Tile grid */}
      {!isRadiusMode && tileGrid.map((tile, idx) => {
        const scanning = idx === scanningTileIdx;
        let color, fillOp, weight, dash;
        if (scanning)                     { color = '#00ffff'; fillOp = 0.0;  weight = 2.5; dash = undefined; }
        else if (tile.status === 'done')  { color = '#00ff88'; fillOp = 0.06; weight = 0.8; dash = undefined; }
        else if (tile.status === 'empty') { color = '#ffcc00'; fillOp = 0.0;  weight = 0.6; dash = '3,3'; }
        else if (tile.status === 'error') { color = '#ff4444'; fillOp = 0.08; weight = 0.8; dash = undefined; }
        else                              { color = '#ffffff'; fillOp = 0.0;  weight = 0.3; dash = '2,4'; }
        return (
          <Rectangle key={tile.id} bounds={[[tile.south, tile.west], [tile.north, tile.east]]} pathOptions={{ color, weight, fillColor: color, fillOpacity: fillOp, dashArray: dash }}
            eventHandlers={{ click: () => { if (onTileClick && !isScanning) onTileClick(tile); }, mouseover: (e) => { if (!scanning) e.target.setStyle({ weight: 1.5, fillOpacity: fillOp + 0.08 }); }, mouseout: (e) => { if (!scanning) e.target.setStyle({ weight, fillOpacity: fillOp }); } }} />
        );
      })}

      {!isRadiusMode && previewResults.map((obj, idx) => {
        if (!obj.polygonLatLng || obj.polygonLatLng.length < 3) return null;
        const color = getCatColor(obj.kategori);
        const bounds = drawnBounds || null;
        let positions = obj.polygonLatLng;
        if (bounds) { const clipped = clipPolygonToBounds(positions, bounds); if (!clipped || clipped.length < 3) return null; positions = clipped; }
        return (
          <Polygon key={`prev-${idx}`} positions={positions} pathOptions={{ color, fillColor: color, fillOpacity: 0.4, weight: 1.5, lineCap: 'round', lineJoin: 'round' }}>
            <Popup><div className="p-2 min-w-[130px]"><div className="flex items-center gap-2 mb-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /><span className="font-bold text-xs uppercase">{obj.kategori}</span></div>{obj.luas_m2 && <p className="text-[10px] text-slate-500">Luas: <b className="text-sky-600">{obj.luas_m2} m²</b></p>}<p className="text-[10px] text-slate-400">Conf: {(obj.confidence_score * 100).toFixed(1)}%</p></div></Popup>
          </Polygon>
        );
      })}
    </>
  );
}

// ─── SUMMARY PANEL ────────────────────────────────────────────────────────────
function SummaryPanel({ results, tileStats, onSave, onCancel, isSaving, isScanning, isDirectMode, isPaused, onPauseResume, onStop }) {
  const [collapsed, setCollapsed] = useState(false);
  const scanStartRef = useRef(null);

  useEffect(() => {
    if (isScanning && !scanStartRef.current) scanStartRef.current = Date.now();
    if (!isScanning) scanStartRef.current = null;
  }, [isScanning]);
  const catSummary = results.reduce((acc, r) => { acc[r.kategori] = (acc[r.kategori] || 0) + 1; return acc; }, {});
  const totalLuas  = results.reduce((s, r) => s + (r.luas_m2 || 0), 0);
  const pct = tileStats.total > 0 ? Math.round((tileStats.done / tileStats.total) * 100) : 0;
  if (!isScanning && results.length === 0) return null;

  const content = (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[99999] w-[340px] max-w-[92vw]">
      <div className="bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none" onClick={() => setCollapsed(v => !v)}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-cyan-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-white text-xs font-black uppercase tracking-wide">
              {isScanning
                ? isDirectMode ? 'Menganalisis...' : `SCANNING ${tileStats.done}/${tileStats.total} (${pct}%)`
                : `${results.length} Objek`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isScanning && results.length > 0 && (
              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">PREVIEW</span>
            )}
            {collapsed ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
          </div>
        </div>

        {isScanning && !isDirectMode && (
  <>
    <div className="h-1 bg-slate-800">
      <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
    {tileStats.done > 0 && (() => {
  const elapsed = (Date.now() - (scanStartRef.current || Date.now())) / 1000;
  const avgPerTile = elapsed / tileStats.done;
  const remaining = (tileStats.total - tileStats.done) * avgPerTile;
  const estStr = remaining >= 3600
    ? `~${Math.ceil(remaining / 3600)} jam`
    : remaining >= 60
    ? `~${Math.ceil(remaining / 60)} mnt`
    : `~${Math.ceil(remaining)} dtk`;
  return (
    <div className="flex justify-between px-3 py-1 bg-slate-800/50">
      <span className="text-[9px] text-slate-500">Sisa estimasi</span>
      <span className="text-[9px] font-black text-cyan-400">{estStr}</span>
    </div>
  );
})()}
  </>
)}
        {isScanning && isDirectMode && (
          <div className="h-1 bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 animate-pulse w-full" />
          </div>
        )}

        {!collapsed && (
          <div className="px-4 pb-4 pt-2 space-y-2.5">
            {!isDirectMode && (
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { v: tileStats.total, l: 'Total',   c: 'text-white'     },
                  { v: tileStats.done,  l: 'Selesai', c: 'text-green-400' },
                  { v: results.length,  l: 'Objek',   c: 'text-amber-400' },
                ].map(s => (
                  <div key={s.l} className="bg-slate-800 rounded-xl p-2 text-center">
                    <div className={`text-sm font-black ${s.c}`}>{s.v}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            {Object.keys(catSummary).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(catSummary).map(([cat, cnt]) => {
                  const info = CATEGORIES.find(c => c.id === cat), Icon = info?.Icon || ScanLine;
                  const p = Math.round((cnt / results.length) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: info?.color || '#94a3b8' }}>
                        <Icon size={10} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-slate-300 capitalize">{cat}</span>
                          <span className="text-[10px] font-black text-white">{cnt}</span>
                        </div>
                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, backgroundColor: info?.color || '#94a3b8' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalLuas > 0 && (
              <div className="flex justify-between py-1.5 border-t border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Luas</span>
                <span className="text-xs font-black text-cyan-400">{totalLuas.toFixed(1)} m²</span>
              </div>
            )}

            {/* Jeda / Stop saat scanning kabupaten */}
            {isScanning && !isDirectMode && onPauseResume && onStop && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={onPauseResume}
                  className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    isPaused ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
                  }`}>
                  {isPaused ? <><Play size={12} /> Lanjut</> : <><Pause size={12} /> Jeda</>}
                </button>
                <button onClick={onStop}
                  className="py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-black flex items-center justify-center gap-1.5 border border-red-500/40">
                  <Square size={12} /> Stop
                </button>
              </div>
            )}

            {/* Save/Cancel setelah selesai */}
            {!isScanning && results.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={onSave} disabled={isSaving}
                  className="py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5">
                  <Save size={12} /> {isSaving ? 'Menyimpan...' : `Simpan (${results.length})`}
                </button>
                <button onClick={onCancel}
                  className="py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-red-400 text-xs font-black flex items-center justify-center gap-1.5 border border-slate-600">
                  <X size={12} /> Batal
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render ke body langsung agar tidak terpengaruh parent yang hidden
  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────
export default function GeoAreaScanPanel({
  mapRef, zoomLevel, onNewData,
  isDrawingArea, setIsDrawingArea, drawnBounds, setDrawnBounds,
  tileGrid, setTileGrid, previewResults, setPreviewResults,
  scanningTileIdx, setScanningTileIdx, tileStats, setTileStats,
  isScanning, setIsScanning,
  onKabupatenStateChange,
  onClose,
  waypointData = {}, waypointLayers = [], activeLayers = [],
  onRadiusStateChange,
}) {
  const [step,         setStep]         = useState('draw');
  const [selectedCats, setSelectedCats] = useState([]);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [scanMode,             setScanMode]             = useState('manual-direct');
  const [kabupatenList,        setKabupatenList]        = useState([]);
  const [kabupatenLoading,     setKabupatenLoading]     = useState(false);
  const [selectedKabupaten,    setSelectedKabupaten]    = useState(null);
  const [isKabupatenClickMode, setIsKabupatenClickMode] = useState(false);
  const [directScanningActive, setDirectScanningActive] = useState(false);

  // Radius state
  const [radiusCenter,       setRadiusCenter]       = useState(null);
  const [radiusSize,         setRadiusSize]         = useState(1000);
  const [radiusDrawing,      setRadiusDrawing]      = useState(false);
  const [radiusLayers,       setRadiusLayers]       = useState([]);
  const [activeRadius,       setActiveRadius]       = useState(null);
  const [allRadiusPolygons,  setAllRadiusPolygons]  = useState([]);
  const [radiusScanProgress, setRadiusScanProgress] = useState({ total: 0, done: 0, objects: 0 });
  const [currentRadiusWpIdx, setCurrentRadiusWpIdx] = useState(-1);
  const [radiusIsScanning,   setRadiusIsScanning]   = useState(false);
  const [radiusIsPaused,     setRadiusIsPaused]     = useState(false);
  const [radiusScanCats,     setRadiusScanCats]     = useState([]);
  const [geocodeCache,       setGeocodeCache]       = useState({});

  // Radius hasil UI state
  const [radiusActiveSubTab,  setRadiusActiveSubTab]  = useState('with_waypoint');
  const [radiusFilterStatus,  setRadiusFilterStatus]  = useState('all');
  const [showDetailPolygons,  setShowDetailPolygons]  = useState(true);

  const radiusPauseRef = useRef(false);
  const radiusAbortRef = useRef(false);
  const radiusClickRef = useRef(null);
  const pauseRef = useRef(false);
  const abortRef = useRef(false);

  const isDirectMode = scanMode === 'manual-direct';
  const isRadiusMode = scanMode === 'radius';

  // Waypoints
  const activeWaypoints = useMemo(
    () => extractWaypoints(waypointData, waypointLayers, activeLayers),
    [waypointData, waypointLayers, activeLayers]
  );
  const activeWpLayers = useMemo(
    () => waypointLayers.filter(l => activeLayers.includes(l.id)),
    [waypointLayers, activeLayers]
  );
  const waypointsInRadius = useMemo(() => {
    const rl = radiusLayers.find(r => r.id === activeRadius);
    if (!rl) return [];
    return activeWaypoints.filter(wp => calcDistance(wp.lat, wp.lng, rl.center[0], rl.center[1]) <= rl.radius);
  }, [activeWaypoints, radiusLayers, activeRadius]);

  const currentRadiusScanWp = useMemo(() => {
    if (!radiusIsScanning || currentRadiusWpIdx < 0) return null;
    return waypointsInRadius[currentRadiusWpIdx] || null;
  }, [radiusIsScanning, currentRadiusWpIdx, waypointsInRadius]);

  // Filtered polygon lists for hasil tab
  const radiusWithWpPolygons = useMemo(
    () => allRadiusPolygons.filter(p => p.validation?.status !== 'no_waypoint'),
    [allRadiusPolygons]
  );
  const radiusNoWpPolygons = useMemo(
    () => allRadiusPolygons.filter(p => p.validation?.status === 'no_waypoint'),
    [allRadiusPolygons]
  );
  const radiusFilteredPolygons = useMemo(() => {
    const byTab = radiusActiveSubTab === 'no_waypoint' ? radiusNoWpPolygons : radiusWithWpPolygons;
    if (radiusFilterStatus === 'all') return byTab;
    return byTab.filter(p => p.validation?.status === radiusFilterStatus);
  }, [allRadiusPolygons, radiusFilterStatus, radiusActiveSubTab, radiusWithWpPolygons, radiusNoWpPolygons]);

  const radiusStats = useMemo(() => calcValidationStats(allRadiusPolygons), [allRadiusPolygons]);

  // Sync radius state to parent
  useEffect(() => {
    onRadiusStateChange?.({
      radiusLayers, activeRadius,
      radiusCenter: radiusCenter ? { lat: radiusCenter.lat, lng: radiusCenter.lng } : null,
      waypointsInRadius, allRadiusPolygons, isRadiusMode,
    });
  }, [radiusLayers, activeRadius, radiusCenter, waypointsInRadius, allRadiusPolygons, isRadiusMode]);

  const activeBounds = useMemo(() => {
    if (scanMode === 'kabupaten' && selectedKabupaten) return getBoundsFromFeature(selectedKabupaten);
    return drawnBounds;
  }, [scanMode, selectedKabupaten, drawnBounds]);

  const estTiles   = isDirectMode ? 1 : (activeBounds ? estimateTileCount(activeBounds, TILE_METER) : 0);
  const estSeconds = isDirectMode ? 2 : scanMode === 'kabupaten' ? estTiles * 2.5 : estTiles * 1.5;
  const estMinutes = estSeconds < 60 ? `${Math.ceil(estSeconds)}s` : `~${Math.ceil(estSeconds / 60)} menit`;

  useEffect(() => { if (isScanning) setStep('hasil'); }, [isScanning]);
  useEffect(() => { if (!isScanning && previewResults.length > 0) setShowAnalysis(true); }, [isScanning, previewResults.length]);

  useEffect(() => {
    if (scanMode !== 'kabupaten' || kabupatenList.length > 0) return;
    setKabupatenLoading(true);
    axios.get('http://127.0.0.1:8000/api/batas-kabupaten/')
      .then(res => setKabupatenList(res.data?.features || []))
      .catch(() => toast.error('Gagal memuat data kabupaten'))
      .finally(() => setKabupatenLoading(false));
  }, [scanMode]);

  const handleSelect = useCallback((feature) => {
  if (!feature) { setSelectedKabupaten(null); return; }
  setSelectedKabupaten(feature);
  const name = feature.properties?.name || feature.properties?.NAMOBJ || feature.properties?.KAB_KOTA || '';
  toast.success(`✓ ${name} dipilih`, { duration: 2000 });
  const bounds = getBoundsFromFeature(feature);
  if (bounds && mapRef?.current) mapRef.current.fitBounds([[bounds[0].lat, bounds[0].lng], [bounds[1].lat, bounds[1].lng]], { padding: [60, 60] });
}, [mapRef]);

  useEffect(() => {
    onKabupatenStateChange?.({ scanMode, kabupatenList, selectedKabupaten, isKabupatenClickMode, handleSelect });
  }, [scanMode, kabupatenList, selectedKabupaten, isKabupatenClickMode, handleSelect]);

  // ── Reverse Geocode ──────────────────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat, lng) => {
    const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
    if (geocodeCache[key]) return geocodeCache[key];
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'id', 'User-Agent': 'RadiusValidator/1.0' } }
      );
      const data = await res.json();
      const name =
        data.address?.building || data.address?.amenity || data.address?.shop ||
        data.address?.office   || data.address?.road    ||
        data.display_name?.split(',')[0] || 'Tidak diketahui';
      const result = { name, full: data.display_name, address: data.address || {} };
      setGeocodeCache(prev => ({ ...prev, [key]: result }));
      return result;
    } catch {
      return { name: 'Gagal geocode', full: '', address: {} };
    }
  }, [geocodeCache]);

  // ── Export CSV radius ────────────────────────────────────────────────────
  const exportRadiusCSV = useCallback(() => {
    if (!allRadiusPolygons.length) { toast.error('Tidak ada hasil'); return; }
    const rows = allRadiusPolygons.map(p => {
      const cLat = p.polygonLatLng?.length ? p.polygonLatLng.reduce((s, x) => s + x[0], 0) / p.polygonLatLng.length : 0;
      const cLng = p.polygonLatLng?.length ? p.polygonLatLng.reduce((s, x) => s + x[1], 0) / p.polygonLatLng.length : 0;
      const gcKey = `${cLat.toFixed(5)}_${cLng.toFixed(5)}`;
      const gc = geocodeCache[gcKey];
      return {
        Kategori: p.kategori,
        'Conf%': Math.round((p.confidence_score || 0) * 100),
        Luas: fmtArea(p.luas_m2),
        Status: p.validation?.status || '',
        Label: p.validation?.label || '',
        WaypointTerdekat: p.nearestWp?.name || '',
        KatWaypoint: p.nearestWp?.category || '',
        'JarakWp(m)': p.nearestWp ? Math.round(p.nearestWp.distToPolygon) : '',
        ScanDariWP: p.waypointSource?.name || '',
        NamaOSM: gc?.name || '',
        JalanOSM: gc?.address?.road || '',
        Waktu: new Date().toLocaleString('id-ID'),
      };
    });
    exportCSVFile(rows, `radius-scan-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success('✓ CSV exported');
  }, [allRadiusPolygons, geocodeCache]);

  // ── Radius Drawing ───────────────────────────────────────────────────────
  const handleStartRadiusDrawing = useCallback(() => {
    if (radiusDrawing) { handleCancelRadiusDrawing(); return; }
    const map = mapRef?.current;
    if (!map) return;
    setRadiusDrawing(true);
    setRadiusCenter(null);
    map.dragging.disable();
    map.doubleClickZoom.disable();
    map.getContainer().style.cursor = 'crosshair';
    const handler = (e) => {
      setRadiusCenter(e.latlng);
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = '';
      map.off('click', handler);
      setRadiusDrawing(false);
      map.flyTo(e.latlng, Math.max(map.getZoom(), 14), { animate: true, duration: 1.2 });
    };
    radiusClickRef.current = handler;
    map.on('click', handler);
  }, [radiusDrawing, mapRef]);

  const handleCancelRadiusDrawing = useCallback(() => {
    const map = mapRef?.current;
    if (radiusClickRef.current && map) { map.off('click', radiusClickRef.current); radiusClickRef.current = null; }
    if (map) { map.dragging.enable(); map.doubleClickZoom.enable(); map.getContainer().style.cursor = ''; }
    setRadiusDrawing(false);
  }, [mapRef]);

  const copyRadiusCoordinates = useCallback(() => {
    if (!radiusCenter) return;
    navigator.clipboard.writeText(`${radiusCenter.lat.toFixed(6)}, ${radiusCenter.lng.toFixed(6)}`)
      .then(() => toast.success('✓ Koordinat disalin!'))
      .catch(() => toast.error('Gagal menyalin'));
  }, [radiusCenter]);

  const createRadius = useCallback(() => {
    if (!radiusCenter) { toast.error('Pilih titik pusat terlebih dahulu!'); return; }
    const newR = { id: Date.now(), center: [radiusCenter.lat, radiusCenter.lng], radius: radiusSize, color: '#06b6d4' };
    setRadiusLayers(prev => [...prev, newR]);
    setActiveRadius(newR.id);
    setAllRadiusPolygons([]);
    toast.success(`✓ Radius ${radiusSize >= 1000 ? `${radiusSize / 1000}km` : `${radiusSize}m`} dibuat!`);
    setStep('scan');
  }, [radiusCenter, radiusSize]);

  const removeRadius = useCallback((id) => {
    setRadiusLayers(prev => prev.filter(r => r.id !== id));
    if (activeRadius === id) { setActiveRadius(null); setAllRadiusPolygons([]); }
  }, [activeRadius]);

  // ── Radius Fly & Capture ─────────────────────────────────────────────────

const radiusFlyAndCapture = useCallback(async (centerLat, centerLng) => {
  const map = mapRef?.current;
  if (!map) throw new Error('Map not ready');

  // Pakai setView (instant, bukan flyTo) agar posisi presisi
  map.setView([centerLat, centerLng], WAYPOINT_SCAN_ZOOM, { animate: false });
  await new Promise(r => setTimeout(r, 600)); // tunggu tiles render

  const mapEl       = document.querySelector('.leaflet-container');
  const rect        = mapEl.getBoundingClientRect();
  const captureSize = Math.min(CAPTURE_PX, rect.width, rect.height);

  // Pakai koordinat waypoint asli sebagai anchor, bukan map.getCenter()
  const zoom            = WAYPOINT_SCAN_ZOOM;
  const centerWorld     = map.project([centerLat, centerLng], zoom);
  const halfSize        = captureSize / 2;
  const topLeftWorld    = { x: centerWorld.x - halfSize, y: centerWorld.y - halfSize };

  const pixelsToLatLng = (segmentation) => segmentation.map(([px, py]) => {
    // px/py dari YOLO adalah 0–640, scale ke captureSize
    const scaledX = (px / YOLO_SIZE) * captureSize;
    const scaledY = (py / YOLO_SIZE) * captureSize;
    const ll = map.unproject(
      [topLeftWorld.x + scaledX, topLeftWorld.y + scaledY],
      zoom
    );
    return [ll.lat, ll.lng];
  });

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(mapEl, {
    useCORS: true, allowTaint: true,
    x: (rect.width - captureSize) / 2, y: (rect.height - captureSize) / 2,
    width: captureSize, height: captureSize, scale: 1, logging: false,
    ignoreElements: el => el.tagName === 'BUTTON' || el.tagName === 'ASIDE' ||
      el.classList.contains('leaflet-control') || el.classList.contains('fixed') ||
      el.classList.contains('absolute'),
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  return { blob, scanLat: centerLat, scanLng: centerLng, captureSize, pixelsToLatLng };
}, [mapRef]);

  // ── Radius Scan ──────────────────────────────────────────────────────────
  const startRadiusScan = useCallback(async () => {
    if (!activeRadius) { toast.error('Pilih atau buat radius terlebih dahulu'); return; }
    if (radiusScanCats.length === 0) { toast.error('Pilih minimal satu kategori!'); return; }
    if (waypointsInRadius.length === 0) { toast.error('Tidak ada waypoint dalam radius!'); return; }

    setRadiusIsScanning(true);
    setAllRadiusPolygons([]);
    setGeocodeCache({});
    radiusAbortRef.current = false;
    radiusPauseRef.current = false;
    setRadiusIsPaused(false);
    setCurrentRadiusWpIdx(-1);
    setRadiusScanProgress({ total: waypointsInRadius.length, done: 0, objects: 0 });
    setStep('hasil');
    setRadiusActiveSubTab('with_waypoint');
    setRadiusFilterStatus('all');

    const allDetected = [];
    for (let i = 0; i < waypointsInRadius.length; i++) {
      if (radiusAbortRef.current) break;
      while (radiusPauseRef.current) { await new Promise(r => setTimeout(r, 300)); if (radiusAbortRef.current) break; }
      if (radiusAbortRef.current) break;
      const wp = waypointsInRadius[i];
      setCurrentRadiusWpIdx(i);
      const scanToast = toast.loading(`(${i + 1}/${waypointsInRadius.length}) Scanning: ${wp.name}`, { duration: Infinity });
      try {
        const { blob, scanLat, scanLng, captureSize, pixelsToLatLng } = await radiusFlyAndCapture(wp.lat, wp.lng);
        const form = new FormData();
        form.append('image', blob, 'wp_capture.png');
        form.append('lat', scanLat);
        form.append('lng', scanLng);
        form.append('capture_size', captureSize);
        form.append('categories', radiusScanCats.join(','));
        const res  = await fetch('http://127.0.0.1:8000/api/run-detection/', { method: 'POST', body: form });
        const data = await res.json();
        const raw  = data.results || [];
        // Ambil OSM buildings di area sekitar waypoint
            let osmWpPolygons = [];
            if (radiusScanCats.includes('bangunan')) {
              try {
                const wpDelta = 0.0002; // ~20m radius dari waypoint
                const osmData = await fetchOpenBuildings(
                  wp.lat - wpDelta, wp.lng - wpDelta,
                  wp.lat + wpDelta, wp.lng + wpDelta
                );
                const wpBounds = [
                  { lat: wp.lat - wpDelta, lng: wp.lng - wpDelta },
                  { lat: wp.lat + wpDelta, lng: wp.lng + wpDelta },
                ];
                osmWpPolygons = overpassToPolygons(osmData, wpBounds);
              } catch { osmWpPolygons = []; }
            }

            const rawAi = raw.filter(obj => obj.segmentation?.length >= 3);
            const aiMapped = rawAi.map(obj => {
              const polygonLatLng = pixelsToLatLng(obj.segmentation);
              if (!polygonLatLng || polygonLatLng.length < 3) return null;
              return { ...obj, polygonLatLng };
            }).filter(Boolean);

            // Merge OSM + AI untuk bangunan
            let finalPolygons = [];
            if (osmWpPolygons.length > 0) {
              const aiBldg    = aiMapped.filter(r => r.kategori === 'bangunan');
              const aiOther   = aiMapped.filter(r => r.kategori !== 'bangunan');
              const merged    = mergeOsmWithAI(osmWpPolygons, aiBldg);
              finalPolygons   = [...merged, ...aiOther];
            } else {
              finalPolygons = aiMapped;
            }

            const enriched = finalPolygons.map(obj => {
              const nearestWp  = findNearestWaypoint(obj.polygonLatLng, activeWaypoints, 500);
              const validation = crossValidatePolygon(obj, nearestWp);
              return { ...obj, tile_id: `wp_${wp.id}`, waypointSource: wp, scanLat, scanLng, captureSize, nearestWp, validation };
            }).filter(Boolean);
        allDetected.push(...enriched);
        setAllRadiusPolygons([...allDetected]);
        setRadiusScanProgress({ total: waypointsInRadius.length, done: i + 1, objects: allDetected.length });
        toast.success(`✓ ${wp.name}: ${enriched.length} obj`, { id: scanToast, duration: 2000 });
      } catch (err) {
        console.error(`Error scan ${wp.name}:`, err);
        toast.error(`✗ ${wp.name}: ${err.message}`, { id: scanToast, duration: 2000 });
        setRadiusScanProgress(prev => ({ ...prev, done: i + 1 }));
      }
      await new Promise(r => setTimeout(r, 400));
    }

    const finalStats = calcValidationStats(allDetected);
    toast.success(
      allDetected.length > 0
        ? `Selesai! ${allDetected.length} polygon · ${finalStats.valid} valid · ${finalStats.mismatch} mismatch`
        : 'Scan selesai. Tidak ada objek terdeteksi.',
      { duration: 5000 }
    );
    setCurrentRadiusWpIdx(-1);
    setRadiusIsScanning(false);
    const map = mapRef?.current;
    if (map) { map.dragging.enable(); map.scrollWheelZoom.enable(); }
  }, [activeRadius, waypointsInRadius, radiusScanCats, radiusFlyAndCapture, activeWaypoints, mapRef]);

  const handleRadiusPauseResume = useCallback(() => {
    const n = !radiusPauseRef.current;
    radiusPauseRef.current = n;
    setRadiusIsPaused(n);
    toast(n ? '⏸ Dijeda' : '▶ Dilanjutkan', { duration: 1200 });
  }, []);

  const handleRadiusAbort = useCallback(() => {
    radiusAbortRef.current = true;
    setRadiusIsScanning(false);
    setRadiusIsPaused(false);
    toast.error('Scan dihentikan');
  }, []);

  const handleRadiusReset = useCallback(() => {
    radiusAbortRef.current = true;
    setRadiusIsScanning(false);
    setRadiusIsPaused(false);
    setAllRadiusPolygons([]);
    setRadiusScanProgress({ total: 0, done: 0, objects: 0 });
    setCurrentRadiusWpIdx(-1);
    setGeocodeCache({});
    setRadiusCenter(null);
    setRadiusLayers([]);
    setActiveRadius(null);
    setRadiusActiveSubTab('with_waypoint');
    setRadiusFilterStatus('all');
    setStep('draw');
    const map = mapRef?.current;
    if (map) { map.dragging.enable(); map.scrollWheelZoom.enable(); }
  }, [mapRef]);

  // ── Direct Scan ──────────────────────────────────────────────────────────
  const handleDirectScan = async () => {
  if (!activeBounds)        { toast.error('Tentukan area scan terlebih dahulu!'); return; }
  if (!selectedCats.length) { toast.error('Pilih minimal satu kategori!'); return; }
  const map = mapRef?.current;
  if (!map) return;

  setIsScanning(true); setDirectScanningActive(true);
  setIsDrawingArea(false); setPreviewResults([]); setStep('hasil'); setShowAnalysis(false);
  abortRef.current = false;
  const scanToast = toast.loading('Memulai scan...');

  try {
    const south = Math.min(activeBounds[0].lat, activeBounds[1].lat);
    const north = Math.max(activeBounds[0].lat, activeBounds[1].lat);
    const west  = Math.min(activeBounds[0].lng, activeBounds[1].lng);
    const east  = Math.max(activeBounds[0].lng, activeBounds[1].lng);
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;

    const wantBuilding = selectedCats.includes('bangunan');
    const wantOther    = selectedCats.some(c => c !== 'bangunan');
    let allResults = [];

    // ── 1. OSM Buildings ────────────────────────────────────────────────
if (wantBuilding) {
  toast.loading('Memproses...', { id: scanToast });
  try {
    const osmData     = await fetchOpenBuildings(south, west, north, east);
    const osmPolygons = overpassToPolygons(osmData, activeBounds);
    allResults.push(...osmPolygons);
    toast.loading(`${osmPolygons.length} bangunan OSM ditemukan, lanjut AI...`, { id: scanToast });
  } catch (osmErr) {
    console.warn('OSM timeout, fallback AI:', osmErr);
    toast.loading('OSM timeout, pakai AI scan...', { id: scanToast });
  }
}

// ── 1b. OSM Jalan, Perairan, Pepohonan ────────────────────────────
const wantJalan     = selectedCats.includes('jalan');
const wantPerairan  = selectedCats.includes('perairan');
const wantPepohonan = selectedCats.includes('pepohonan');

if (wantJalan || wantPerairan || wantPepohonan) {
  toast.loading('Mengambil data...', { id: scanToast });
  try {
    const [osmRoadData, osmWaterData, osmVegData] = await Promise.allSettled([
      wantJalan     ? fetchOpenRoads(south, west, north, east)       : Promise.resolve(null),
      wantPerairan  ? fetchOpenWater(south, west, north, east)       : Promise.resolve(null),
      wantPepohonan ? fetchOpenVegetation(south, west, north, east)  : Promise.resolve(null),
    ]);

    if (osmRoadData.status === 'fulfilled' && osmRoadData.value)
      allResults.push(...overpassRoadsToPolygons(osmRoadData.value, activeBounds));

    if (osmWaterData.status === 'fulfilled' && osmWaterData.value)
      allResults.push(...overpassWaterToPolygons(osmWaterData.value, activeBounds));

    if (osmVegData.status === 'fulfilled' && osmVegData.value)
      allResults.push(...overpassVegetationToPolygons(osmVegData.value, activeBounds));

  } catch (osmOtherErr) {
    console.warn('OSM lainnya error:', osmOtherErr);
  }
}

// ── 2. AI scan — MULTI-PASS (1 capture, kirim per kategori) ──────────

const osmCoveredCats = new Set(allResults.map(r => r.kategori));
const needAI = selectedCats.some(c => !osmCoveredCats.has(c)) ||
               (wantBuilding && allResults.filter(r => r.source === 'osm' && r.kategori === 'bangunan').length === 0);

if (needAI) {
  toast.loading('AI scanning (multi-pass)...', { id: scanToast });

  const mapEl = document.querySelector('.leaflet-container');
  const rect  = mapEl.getBoundingClientRect();
  const captureSize = Math.min(CAPTURE_PX, rect.width, rect.height);

  let optimalZoom = 17;
  for (let z = 20; z >= 12; z--) {
    const sw = L.CRS.EPSG3857.latLngToPoint(L.latLng(south, west), z);
    const ne = L.CRS.EPSG3857.latLngToPoint(L.latLng(north, east), z);
    if (Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y)) <= captureSize * 0.85) {
      optimalZoom = z; break;
    }
  }

  await new Promise(resolve => {
    map.flyTo([centerLat, centerLng], optimalZoom, { animate: true, duration: 0.8 });
    map.once('moveend', resolve);
  });
  await new Promise(r => setTimeout(r, 800));

  const scanCenter     = map.getCenter();
  const html2canvasLib = (await import('html2canvas')).default;

  // ── Capture SEKALI, pakai berkali-kali ──────────────────────────────
  const canvas = await html2canvasLib(mapEl, {
    useCORS: true, allowTaint: true,
    x: (rect.width - captureSize) / 2, y: (rect.height - captureSize) / 2,
    width: captureSize, height: captureSize, scale: 1, logging: false,
    ignoreElements: el => el.tagName === 'BUTTON' || el.tagName === 'ASIDE' ||
      el.classList.contains('leaflet-control') || el.classList.contains('fixed') ||
      el.classList.contains('absolute'),
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

  const scanCenterPixel = map.latLngToContainerPoint(scanCenter);
  const halfSize        = captureSize / 2;
  const pixelsToLatLng  = (seg) => seg.map(pt => {
    const ll = map.containerPointToLatLng([
      (scanCenterPixel.x - halfSize) + pt[0],
      (scanCenterPixel.y - halfSize) + pt[1],
    ]);
    return [ll.lat, ll.lng];
  });

  // ── Fungsi deduplikasi antar kategori yang sama ─────────────────────
  const deduplicateByOverlap = (results, threshold = 0.5) => {
    const kept = [];
    for (const r of results) {
      const isDuplicate = kept.some(k =>
        k.kategori === r.kategori &&
        k.polygonLatLng && r.polygonLatLng &&
        calcPolygonOverlapRatio(k.polygonLatLng, r.polygonLatLng) > threshold
      );
      if (!isDuplicate) kept.push(r);
    }
    return kept;
  };

  // ── Tentukan kategori mana yang perlu AI ────────────────────────────
  // Kalau OSM sudah cover kategori tertentu, skip AI untuk kategori itu
  const aiCats = selectedCats.filter(cat => {
    if (cat === 'bangunan') {
      // Pakai AI untuk bangunan hanya kalau OSM tidak ada hasil
      return allResults.filter(r => r.source === 'osm' && r.kategori === 'bangunan').length === 0;
    }
    // Kategori lain selalu pakai AI (OSM sudah diambil terpisah di atas)
    return !osmCoveredCats.has(cat);
  });

  // ── MULTI-PASS: kirim 1 kategori per request ────────────────────────
  const allAiResults = [];

  for (let i = 0; i < aiCats.length; i++) {
    const cat = aiCats[i];
    toast.loading(
      `AI scanning... (${i + 1}/${aiCats.length}) ${cat}`,
      { id: scanToast }
    );

    try {
      const formData = new FormData();
      formData.append('image', blob, 'map_capture.png');
      formData.append('lat', scanCenter.lat);
      formData.append('lng', scanCenter.lng);
      formData.append('capture_size', captureSize);
      formData.append('categories', cat); // ← SATU KATEGORI PER REQUEST

      const res  = await fetch('http://127.0.0.1:8000/api/run-detection/', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.results?.length > 0) {
        const mapped = data.results
          .filter(obj => obj.segmentation?.length >= 3)
          .map(obj => {
            const polygonLatLng = pixelsToLatLng(obj.segmentation);
            if (!polygonLatLng || polygonLatLng.length < 3) return null;
            const clipped = clipPolygonToBounds(polygonLatLng, activeBounds);
            if (!clipped || clipped.length < 3) return null;
            return {
              ...obj, lat: scanCenter.lat, lng: scanCenter.lng,
              capture_size: captureSize, tile_id: `direct_ai_${cat}`,
              scanLat: scanCenter.lat, scanLng: scanCenter.lng,
              polygonLatLng: clipped, source: 'ai',
            };
          }).filter(Boolean);

        allAiResults.push(...mapped);
      }
    } catch (err) {
      console.warn(`AI pass gagal untuk ${cat}:`, err);
      // Lanjut ke kategori berikutnya meski ada error
    }

    // Jeda kecil antar request agar server tidak overload
    if (i < aiCats.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  // ── Deduplikasi hasil AI (kalau ada overlap antar pass) ─────────────
  const dedupedAiResults = deduplicateByOverlap(allAiResults);

  // ── Merge OSM + AI seperti sebelumnya ──────────────────────────────
  if (dedupedAiResults.length > 0) {
    const osmBuildings         = allResults.filter(r => r.source === 'osm');
    const nonOsmResults        = allResults.filter(r => r.source !== 'osm');
    const aiBuildingResults    = dedupedAiResults.filter(r => r.kategori === 'bangunan');
    const aiNonBuildingResults = dedupedAiResults.filter(r => r.kategori !== 'bangunan');

    if (osmBuildings.length > 0 && aiBuildingResults.length > 0) {
      const mergedBuildings = mergeOsmWithAI(osmBuildings, aiBuildingResults);
      allResults = [...nonOsmResults, ...mergedBuildings, ...aiNonBuildingResults];
    } else if (osmBuildings.length > 0) {
      allResults = [...nonOsmResults, ...osmBuildings, ...aiNonBuildingResults];
    } else {
      allResults = [...nonOsmResults, ...dedupedAiResults];
    }
  }
}

    setPreviewResults(allResults);
    setTileStats({ total: 1, done: 1, objects: allResults.length });

    const osmCount = allResults.filter(r => r.source === 'osm').length;
    const aiCount  = allResults.filter(r => r.source === 'ai').length;
    const msg = osmCount > 0 && aiCount > 0
      ? `${allResults.length} objek (${osmCount} OSM + ${aiCount} AI)`
      : osmCount > 0 ? `${osmCount} Objek` : `${aiCount} objek dari AI`;

    allResults.length > 0
      ? toast.success(msg, { id: scanToast, duration: 4000 })
      : toast.error('Tidak ada objek ditemukan.', { id: scanToast });

  } catch (err) {
    console.error('Direct scan error:', err);
    toast.error(`Error: ${err.message}`, { id: scanToast });
    setTileStats({ total: 1, done: 1, objects: 0 });
  } finally {
    setIsScanning(false); setDirectScanningActive(false);
    if (mapRef?.current) {
      mapRef.current.dragging.enable();
      mapRef.current.scrollWheelZoom.enable();
    }
  }
};

 const flyAndCapture = async (tile) => {
  const map = mapRef.current;
  if (!map) throw new Error('Map not ready');
  const zoom = tile.overrideZoom || CAPTURE_ZOOM;

  map.setView([tile.centerLat, tile.centerLng], zoom, { animate: false });

  // Tunggu tiles benar-benar rendered — 150ms cukup untuk setView tanpa animasi
  await new Promise(r => setTimeout(r, 150));

  const mapEl = document.querySelector('.leaflet-container');
  const rect = mapEl.getBoundingClientRect();
  const captureSize = Math.min(CAPTURE_PX, rect.width, rect.height);
  const centerWorld = map.project(map.getCenter(), zoom);
  const halfCapture = captureSize / 2;
  const topLeftWorld = { x: centerWorld.x - halfCapture, y: centerWorld.y - halfCapture };

  const pixelsToLatLng = (segmentation) => segmentation.map(([px, py]) => {
    const scaledX = (px / YOLO_SIZE) * captureSize;
    const scaledY = (py / YOLO_SIZE) * captureSize;
    const ll = map.unproject([topLeftWorld.x + scaledX, topLeftWorld.y + scaledY], zoom);
    return [ll.lat, ll.lng];
  });

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(mapEl, {
    useCORS: true, allowTaint: true,
    x: (rect.width - captureSize) / 2,
    y: (rect.height - captureSize) / 2,
    width: captureSize, height: captureSize,
    scale: 1, logging: false,
    ignoreElements: el => (
      el.tagName === 'BUTTON' || el.tagName === 'ASIDE' ||
      el.classList.contains('leaflet-control') ||
      el.classList.contains('fixed') ||
      el.classList.contains('absolute') ||
      el.classList.contains('lucide')
    ),
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const center = map.getCenter();
  return { blob, scanLat: center.lat, scanLng: center.lng, captureSize, pixelsToLatLng };
};

  const handleStartScan = () => { if (isDirectMode) handleDirectScan(); 
    else if (scanMode === 'kabupaten') handleKabupatenTileScan();
   };
  
  const handlePauseResume = () => { const n = !isPaused; setIsPaused(n); pauseRef.current = n; toast(n ? '⏸ Dijeda' : '▶ Dilanjutkan', { duration: 1500 }); };

  const handleSaveAll = async () => {
    if (!previewResults.length) { toast.error('Tidak ada hasil'); return; }
    setIsSaving(true);
    const t = toast.loading(`Menyimpan ${previewResults.length} objek...`);
    try {
      const features = previewResults.filter(o => o.polygonLatLng?.length >= 3).map(obj => {
        let polygon_coords;
        if (isDirectMode || obj.tile_id === 'direct') {
  const wkt = obj.polygonLatLng.map(([lat, lng]) => `${lng} ${lat}`);
  wkt.push(wkt[0]);
  polygon_coords = wkt.join(', ');
        } else { const wkt = obj.polygonLatLng.map(([lat, lng]) => `${lng} ${lat}`); wkt.push(wkt[0]); polygon_coords = wkt.join(', '); }
        return { nama: obj.kategori, kategori: obj.kategori, confidence_score: obj.confidence_score, polygon_coords, metadata: { capture_size: CAPTURE_PX, zoom_level: CAPTURE_ZOOM, timestamp: new Date().toISOString(), luas_m2: obj.luas_m2, tile_id: obj.tile_id, ...(isDirectMode ? { scan_mode: 'direct_area_scan' } : { tile_size_m: TILE_METER, scan_mode: 'area_tile_scan' }), ...(selectedKabupaten ? { kabupaten: selectedKabupaten.properties?.name || selectedKabupaten.properties?.NAMOBJ || '' } : {}) } };
      });
      const res = await axios.post('http://127.0.0.1:8000/api/save-detection/', { features });
      if (res.status === 201) { toast.success(`${features.length} objek disimpan`, { id: t, duration: 3000 }); if (onNewData) onNewData(); handleReset(); }
    } catch (err) { toast.error(`Gagal: ${err.response?.data?.message || err.message}`, { id: t }); }
    finally { setIsSaving(false); }
  };

  const handleReset = () => {
  abortRef.current = true;
  setIsScanning(false); setIsPaused(false); setIsDrawingArea(false);
  setScanningTileIdx(-1); setDrawnBounds(null); setTileGrid([]); setPreviewResults([]);
  setTileStats({ total: 0, done: 0, objects: 0 }); setStep('draw');
  setSelectedKabupaten(null);
  setIsKabupatenClickMode(true); // ← reset ke true agar bisa klik lagi
  setShowAnalysis(false);
  setDirectScanningActive(false);
  if (mapRef?.current) { mapRef.current.dragging.enable(); mapRef.current.scrollWheelZoom.enable(); }
};

  const progress = tileStats.total > 0 ? Math.round((tileStats.done / tileStats.total) * 100) : 0;
  const kabName  = selectedKabupaten?.properties?.name || selectedKabupaten?.properties?.NAMOBJ || selectedKabupaten?.properties?.KAB_KOTA || '';
  const radiusOptions = [500, 1000, 2000, 5000, 10000];

  const handleKabupatenTileScan = async () => {
  if (!activeBounds) { toast.error('Pilih kabupaten terlebih dahulu!'); return; }
  if (!selectedCats.length) { toast.error('Pilih minimal satu kategori!'); return; }
  const map = mapRef?.current;
  if (!map) return;

  const south = Math.min(activeBounds[0].lat, activeBounds[1].lat);
  const north = Math.max(activeBounds[0].lat, activeBounds[1].lat);
  const west  = Math.min(activeBounds[0].lng, activeBounds[1].lng);
  const east  = Math.max(activeBounds[0].lng, activeBounds[1].lng);
  const cLat  = (south + north) / 2;

  const tiles = [];
  let tileId  = 0;
  for (let lat = south; lat < north; lat += meterToLat(TILE_METER)) {
    for (let lng = west; lng < east; lng += meterToLng(TILE_METER, cLat)) {
      const tileNorth = Math.min(lat + meterToLat(TILE_METER), north);
      const tileEast  = Math.min(lng + meterToLng(TILE_METER, cLat), east);
      const centerLat = (lat + tileNorth) / 2;
      const centerLng = (lng + tileEast)  / 2;
      if (selectedKabupaten) {
  const corners = [
    { lat: lat,        lng: lng       },
    { lat: lat,        lng: tileEast  },
    { lat: tileNorth,  lng: lng       },
    { lat: tileNorth,  lng: tileEast  },
    { lat: centerLat,  lng: centerLng },
  ];
  const anyInside = corners.some(c => pointInFeature(c, selectedKabupaten));
  if (!anyInside) continue;
}
      tiles.push({
        id: `kab_tile_${tileId++}`,
        south: lat, north: tileNorth, west: lng, east: tileEast,
        centerLat, centerLng, status: 'pending',
      });
    }
  }

  if (tiles.length === 0) { toast.error('Tidak ada tile dalam wilayah kabupaten'); return; }

  setIsScanning(true);
  onClose?.();
  setIsKabupatenClickMode(false);
  setDirectScanningActive(false);
  setIsDrawingArea(false);
  setPreviewResults([]);
  setTileGrid(tiles);
  setStep('hasil');
  setShowAnalysis(false);
  abortRef.current  = false;
  pauseRef.current  = false;
  setIsPaused(false);
  setTileStats({ total: tiles.length, done: 0, objects: 0 });

  const allResults = [];
  const updatedTiles = [...tiles];
  const wantBuilding = selectedCats.includes('bangunan');

  for (let i = 0; i < tiles.length; i++) {
    if (abortRef.current) break;
    while (pauseRef.current) {
      await new Promise(r => setTimeout(r, 300));
      if (abortRef.current) break;
    }
    if (abortRef.current) break;

    const tile = tiles[i];
    updatedTiles[i] = { ...tile, status: 'scanning' };
    setTileGrid([...updatedTiles]);
    setScanningTileIdx(i);

    try {
      const tileBounds = [
        { lat: tile.south, lng: tile.west },
        { lat: tile.north, lng: tile.east },
      ];

      // ── OSM ONLY (paralel dengan setView) ─────────────────────────
      const wantJalan     = selectedCats.includes('jalan');
const wantPerairan  = selectedCats.includes('perairan');
const wantPepohonan = selectedCats.includes('pepohonan');

const map = mapRef.current;
if (map) map.setView([tile.centerLat, tile.centerLng], KABUPATEN_TILE_ZOOM, { animate: false });

const [bldgRes, roadRes, waterRes, vegRes] = await Promise.allSettled([
  wantBuilding  ? fetchOpenBuildings(tile.south, tile.west, tile.north, tile.east).then(d => overpassToPolygons(d, tileBounds)).catch(() => [])       : Promise.resolve([]),
  wantJalan     ? fetchOpenRoads(tile.south, tile.west, tile.north, tile.east).then(d => overpassRoadsToPolygons(d, tileBounds)).catch(() => [])       : Promise.resolve([]),
  wantPerairan  ? fetchOpenWater(tile.south, tile.west, tile.north, tile.east).then(d => overpassWaterToPolygons(d, tileBounds)).catch(() => [])       : Promise.resolve([]),
  wantPepohonan ? fetchOpenVegetation(tile.south, tile.west, tile.north, tile.east).then(d => overpassVegetationToPolygons(d, tileBounds)).catch(() => []) : Promise.resolve([]),
]);

const tilePolygonsRaw = [
  ...(bldgRes.value  || []),
  ...(roadRes.value  || []),
  ...(waterRes.value || []),
  ...(vegRes.value   || []),
];

const osmTilePolygonsFiltered = selectedKabupaten
  ? tilePolygonsRaw.filter(p => {
      if (!p.polygonLatLng?.length) return false;
      const cLat = p.polygonLatLng.reduce((s, x) => s + x[0], 0) / p.polygonLatLng.length;
      const cLng = p.polygonLatLng.reduce((s, x) => s + x[1], 0) / p.polygonLatLng.length;
      return pointInFeature({ lat: cLat, lng: cLng }, selectedKabupaten);
    })
  : tilePolygonsRaw;

updatedTiles[i] = { ...tile, status: osmTilePolygonsFiltered.length > 0 ? 'done' : 'empty' };
allResults.push(...osmTilePolygonsFiltered);
      setTileGrid([...updatedTiles]);
      setPreviewResults([...allResults]);
      setTileStats({ total: tiles.length, done: i + 1, objects: allResults.length });

    } catch (err) {
      console.error(`Tile error ${tile.id}:`, err);
      updatedTiles[i] = { ...tile, status: 'error' };
      setTileGrid([...updatedTiles]);
      setTileStats(prev => ({ ...prev, done: i + 1 }));
    }
  }

  setScanningTileIdx(-1);
  setIsScanning(false);
  if (mapRef?.current) {
    mapRef.current.dragging.enable();
    mapRef.current.scrollWheelZoom.enable();
  }

  allResults.length > 0
    ? toast.success(`Selesai! ${allResults.length} objek OSM dari ${tiles.length} tile`)
    : toast.error('Scan selesai. Tidak ada objek ditemukan.');
};

  // Fly to polygon centroid
  const flyToPolygon = useCallback((polygon) => {
    const map = mapRef?.current;
    if (!map || !polygon.polygonLatLng?.length) return;
    const cLat = polygon.polygonLatLng.reduce((s, p) => s + p[0], 0) / polygon.polygonLatLng.length;
    const cLng = polygon.polygonLatLng.reduce((s, p) => s + p[1], 0) / polygon.polygonLatLng.length;
    map.flyTo([cLat, cLng], 18, { animate: true, duration: 0.8 });
  }, [mapRef]);

  return (
    <>
    <div className={`geo-scan-panel-root h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 ${isScanning && !isDirectMode ? 'hidden' : ''}`} onWheel={e => e.stopPropagation()}>
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/30">
            <Grid size={14} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">GeoAI</h3>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">AI · z{CAPTURE_ZOOM} · {TILE_METER}m/tile</p>
          </div>
          {(isScanning || radiusIsScanning) && (
            <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[9px] font-black text-cyan-500 uppercase">AKTIF</span>
            </div>
          )}
          {!isScanning && !radiusIsScanning && onClose && (
            <button onClick={onClose} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors text-slate-400">
              <X size={12} />
            </button>
          )}
        </div>
        {/* Step tabs */}
        <div className="flex gap-1 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {SCAN_MODES.map(mode => {
            const Icon   = mode.icon;
            const active = step === mode.id;
            const done   = (mode.id === 'draw' && (activeBounds || radiusCenter)) || (mode.id === 'scan' && (isScanning || radiusIsScanning));
            return (
              <button key={mode.id} onClick={() => !isScanning && !radiusIsScanning && setStep(mode.id)} disabled={isScanning || radiusIsScanning}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all ${active ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-slate-700/50'}`}>
                <div className={active ? 'text-cyan-600' : done ? 'text-green-500' : 'text-slate-400'}><Icon size={11} /></div>
                <span className={`text-[8px] font-black uppercase tracking-wider ${active ? 'text-cyan-600' : done ? 'text-green-500' : 'text-slate-400'}`}>{mode.label}</span>
                <div className={`w-1 h-1 rounded-full ${active ? 'bg-cyan-500' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* ── STEP: AREA ── */}
        {step === 'draw' && (
          <div className="space-y-3">
            {/* Mode selector */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-1.5 grid grid-cols-3 gap-1">
              {[
                { id: 'manual-direct', label: 'Direct',    icon: Scan,       desc: '1x capture'    },
                { id: 'radius',        label: 'Radius',    icon: CircleIcon, desc: 'Per waypoint'  },
                { id: 'kabupaten',     label: 'Kabupaten', icon: MapPin,     desc: 'Batas wilayah' },
              ].map(m => (
                <button key={m.id}
                  onClick={() => {
  setScanMode(m.id);
  if (m.id !== 'kabupaten') {
    setSelectedKabupaten(null);
    setIsKabupatenClickMode(false);
  }
  if (m.id === 'kabupaten') {
    setIsKabupatenClickMode(true); 
  }
  if (m.id !== 'manual-direct') { setIsDrawingArea(false); setDrawnBounds(null); }
  if (m.id !== 'radius') { handleCancelRadiusDrawing(); }
}}
                  className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wide flex flex-col items-center gap-0.5 transition-all ${
                    scanMode === m.id
                      ? m.id === 'kabupaten' ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md'
                        : m.id === 'radius'  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                  <m.icon size={11} />
                  {m.label}
                  <span className={`text-[7px] font-medium ${scanMode === m.id ? 'opacity-80' : 'text-slate-400'}`}>{m.desc}</span>
                </button>
              ))}
            </div>

            {/* Direct mode */}
            {scanMode === 'manual-direct' && (
              <>
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 flex items-start gap-2">
                  <Zap size={12} className="text-violet-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-violet-700 dark:text-violet-400 font-medium">Mode Direct: area scan 1x capture tanpa tile. Cocok untuk area kecil.</p>
                </div>
                <button onClick={() => { if (isScanning) return; if (isDrawingArea) { setIsDrawingArea(false); setDrawnBounds(null); } else setIsDrawingArea(true); }} disabled={isScanning}
                  className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${isDrawingArea ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-md shadow-cyan-500/20'}`}>
                  {isDrawingArea ? <><X size={15} /> Batal</> : <><Square size={15} /> Gambar Area</>}
                </button>
                {isDrawingArea && !isScanning && (
                  <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700/40 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center flex-shrink-0 animate-pulse"><MousePointer2 size={10} className="text-cyan-600" /></div>
                    <div><p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400">Klik & drag di peta</p><p className="text-[9px] text-cyan-600/70">Tentukan area scan</p></div>
                  </div>
                )}
                {drawnBounds && !isScanning && (
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                    <div className="flex items-center gap-2 mb-2"><CheckCircle2 size={11} className="text-green-600" /><span className="text-[10px] font-bold text-green-700 dark:text-green-400">Area ditandai</span></div>
                    <button onClick={() => setStep('scan')} className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2">Konfigurasi <ChevronRight size={13} /></button>
                  </div>
                )}
              </>
            )}

            {/* Radius mode */}
            {scanMode === 'radius' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 flex items-start gap-2">
                  <Navigation size={12} className="text-violet-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-violet-700 dark:text-violet-400 font-medium">Mode Radius: scan per waypoint dalam radius. Aktifkan layer waypoint di panel Layers terlebih dahulu.</p>
                </div>

                {activeWpLayers.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed p-4 text-center border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                    <Layers size={20} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-xs font-bold mb-1 text-slate-600 dark:text-slate-400">Layer waypoint belum aktif</p>
                    <p className="text-[10px] text-slate-400">Buka panel <b>Layers</b> → aktifkan waypoint</p>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 p-3 bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Layer Waypoint Aktif</p>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">{activeWaypoints.length} titik</span>
                    </div>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {activeWpLayers.map(layer => {
                        const raw = waypointData[layer.id];
                        const cnt = raw?.features?.length || (Array.isArray(raw) ? raw.length : 0);
                        return (
                          <div key={layer.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layer.color }} />
                            <span className="text-[10px] font-medium flex-1 truncate text-slate-700 dark:text-slate-300">{layer.label}</span>
                            <span className="text-[9px] text-slate-400">{cnt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border-2 p-3.5 bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] font-black uppercase tracking-wider mb-3 text-slate-500">1. Tentukan Titik Pusat</p>
                  <div className={`p-3 rounded-lg mb-3 border-2 ${radiusDrawing ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-700' : radiusCenter ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700' : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}>
                    <div className="flex items-center gap-2">
                      <Target size={14} className={radiusDrawing ? 'text-amber-500' : radiusCenter ? 'text-green-500' : 'text-slate-400'} />
                      <p className={`text-[11px] font-bold flex-1 ${radiusDrawing ? 'text-amber-600 dark:text-amber-400' : radiusCenter ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {radiusDrawing ? '📍 Klik lokasi di peta' : radiusCenter ? `✓ ${radiusCenter.lat.toFixed(5)}, ${radiusCenter.lng.toFixed(5)}` : 'Belum ada titik pusat'}
                      </p>
                      {radiusCenter && !radiusDrawing && <button onClick={copyRadiusCoordinates} className="text-slate-400 hover:text-cyan-500"><Copy size={10} /></button>}
                    </div>
                  </div>
                  {!radiusDrawing ? (
                    <button onClick={handleStartRadiusDrawing} className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-md transition-all mb-3">
                      <MapPin size={13} /> PILIH TITIK DI PETA
                    </button>
                  ) : (
                    <button onClick={handleCancelRadiusDrawing} className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 mb-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                      <X size={13} /> BATALKAN
                    </button>
                  )}
                  {radiusCenter && !radiusDrawing && (
                    <>
                      <p className="text-[9px] font-black uppercase tracking-wider mb-2 text-slate-500">2. Ukuran Radius</p>
                      <div className="grid grid-cols-5 gap-1.5 mb-3">
                        {radiusOptions.map(opt => (
                          <button key={opt} onClick={() => setRadiusSize(opt)}
                            className={`py-1.5 rounded-lg text-[9px] font-black transition-all ${radiusSize === opt ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'}`}>
                            {opt >= 1000 ? `${opt / 1000}km` : `${opt}m`}
                          </button>
                        ))}
                      </div>
                      <div className="px-3 py-2 rounded-lg mb-3 bg-slate-100 dark:bg-slate-700/40">
                        <p className="text-[9px] text-slate-600 dark:text-slate-400">
                          ~{activeWaypoints.filter(wp => radiusCenter && calcDistance(wp.lat, wp.lng, radiusCenter.lat, radiusCenter.lng) <= radiusSize).length} waypoint dalam radius ini
                        </p>
                      </div>
                      <button onClick={createRadius} className="w-full py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-md transition-all">
                        BUAT RADIUS → LANJUT CONFIG
                      </button>
                    </>
                  )}
                </div>

                {radiusLayers.length > 0 && (
                  <div className="rounded-xl border-2 p-3 bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Radius Tersimpan</p>
                      <button onClick={() => { setRadiusLayers([]); setActiveRadius(null); setAllRadiusPolygons([]); }} className="text-[9px] font-bold flex items-center gap-1 text-red-500 hover:text-red-700">
                        <Trash2 size={10} /> Hapus Semua
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {radiusLayers.map(r => (
                        <div key={r.id} className={`rounded-lg border-2 overflow-hidden transition-all ${activeRadius === r.id ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500' : 'bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600'}`}>
                          <div onClick={() => setActiveRadius(r.id)} className="flex items-center justify-between px-3 py-2 cursor-pointer">
                            <div className="flex items-center gap-2">
                              {activeRadius === r.id && <CheckCircle2 size={11} className="text-cyan-500" />}
                              <span className={`text-xs font-bold ${activeRadius === r.id ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-400'}`}>{r.radius >= 1000 ? `${r.radius / 1000}km` : `${r.radius}m`}</span>
                            </div>
                            <button onClick={e => { e.stopPropagation(); removeRadius(r.id); }} className="text-red-400 hover:text-red-600 p-0.5"><X size={10} /></button>
                          </div>
                          {activeRadius === r.id && (
                            <div className="px-2 pb-2">
                              <button onClick={() => setStep('scan')} className="w-full py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-all">
                                <Play size={10} /> Scan Radius Ini
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Kabupaten mode */}
            {scanMode === 'kabupaten' && (
              <div className="space-y-3">
                <KabupatenSearchPanel kabupatenList={kabupatenList} selectedKabupaten={selectedKabupaten} onSelect={handleSelect} isLoading={kabupatenLoading} />
                <button onClick={() => setIsKabupatenClickMode(v => !v)} className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border-2 ${isKabupatenClickMode ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'}`}>
                  {isKabupatenClickMode ? <><div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> Klik wilayah aktif</> : <><Map size={13} /> Klik Wilayah di Peta</>}
                </button>
                {selectedKabupaten ? (
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0"><MapPin size={13} className="text-white" /></div>
                      <div className="flex-1 min-w-0"><p className="text-xs font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</p><p className="text-[9px] text-teal-600/70 truncate">{selectedKabupaten.properties?.provinsi || selectedKabupaten.properties?.PROPINSI || ''}</p></div>
                      <button onClick={() => handleSelect(null)} className="text-teal-400 hover:text-red-400"><X size={11} /></button>
                    </div>
                    {activeBounds && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-white dark:bg-teal-900/30 rounded-lg p-2 text-center"><div className="text-sm font-black text-teal-700 dark:text-teal-400">{estTiles.toLocaleString()}</div><div className="text-[8px] text-slate-500 uppercase font-bold">Tile</div></div>
                        <div className="bg-white dark:bg-teal-900/30 rounded-lg p-2 text-center"><div className="text-sm font-black text-teal-700 dark:text-teal-400">{estMinutes}</div><div className="text-[8px] text-slate-500 uppercase font-bold">Est.</div></div>
                      </div>
                    )}
                    <button onClick={() => setStep('scan')} disabled={estTiles === 0} className="w-full py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 disabled:from-slate-400 disabled:to-slate-500 text-white text-xs font-bold flex items-center justify-center gap-2">Konfigurasi <ChevronRight size={13} /></button>
                  </div>
                ) : !kabupatenLoading && (
                  <div className="py-5 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2"><MapPin size={18} className="text-slate-400" /></div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Pilih kabupaten</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">cari atau klik di peta</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: CONFIG ── */}
        {step === 'scan' && (
          <>
            {isRadiusMode ? (
              <div className="space-y-3">
                {!activeRadius ? (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-center">
                    <AlertTriangle size={18} className="text-amber-500 mx-auto mb-1.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">Buat radius di tab AREA terlebih dahulu</p>
                    <button onClick={() => setStep('draw')} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white">Ke Tab AREA</button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border-2 p-3 bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <p className="text-[10px] font-black text-violet-700 dark:text-violet-400">
                          Radius aktif: {radiusLayers.find(r => r.id === activeRadius)?.radius >= 1000
                            ? `${radiusLayers.find(r => r.id === activeRadius)?.radius / 1000}km`
                            : `${radiusLayers.find(r => r.id === activeRadius)?.radius}m`}
                          {' · '}{waypointsInRadius.length} waypoint
                        </p>
                      </div>
                    </div>

                    {radiusIsScanning && (
                      <>
                        <RadiusScanProgress progress={radiusScanProgress} currentWaypoint={currentRadiusScanWp} isScanning={radiusIsScanning} />
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={handleRadiusPauseResume} className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${radiusIsPaused ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'}`}>
                            {radiusIsPaused ? <><Play size={12} /> Lanjut</> : <><Pause size={12} /> Jeda</>}
                          </button>
                          <button onClick={handleRadiusAbort} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800">
                            <Square size={12} /> Stop
                          </button>
                        </div>
                      </>
                    )}

                    {!radiusIsScanning && (
                      <>
                        {/* Alur info */}
                        <div className="px-3 py-2.5 rounded-xl text-[10px] space-y-1.5 bg-blue-50 dark:bg-slate-700/40">
                          {[
                            { icon: '📍', text: `Zoom ke tiap waypoint (zoom ${WAYPOINT_SCAN_ZOOM}× ≈ ~150m)` },
                            { icon: '🔍', text: 'AI deteksi objek → polygon per waypoint' },
                            { icon: '🗺️', text: 'Cocokkan centroid polygon dengan waypoint terdekat (≤500m)' },
                            { icon: '✅', text: 'Validasi kategori polygon ↔ tipe waypoint' },
                            { icon: '🟣', text: 'Tanpa waypoint → tab Luar Waypoint + cari OSM' },
                          ].map((s, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span>{s.icon}</span>
                              <span className="text-blue-700 dark:text-slate-300">{s.text}</span>
                            </div>
                          ))}
                        </div>

                        {/* Kategori */}
                        <div className={`rounded-xl border-2 p-3.5 transition-all duration-300 bg-white dark:bg-slate-800/70 ${radiusScanCats.length === 0 ? 'border-amber-400 dark:border-amber-500/60 shadow-amber-500/20 shadow-md' : 'border-slate-200 dark:border-slate-700'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Kategori yang Dideteksi</p>
                            {radiusScanCats.length === 0 && (
                              <span className="flex items-center gap-1 animate-bounce text-amber-500 text-[9px] font-black">Pilih dulu! 👆</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(CATEGORY_META).map(([id, meta]) => {
                              const Icon    = meta.Icon;
                              const checked = radiusScanCats.includes(id);
                              return (
                                <button key={id}
                                  onClick={() => setRadiusScanCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])}
                                  className={`p-2 rounded-lg border-2 text-[10px] font-bold flex items-center gap-1.5 transition-all ${checked ? 'text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'}`}
                                  style={checked ? { backgroundColor: meta.color, borderColor: meta.color } : {}}>
                                  <Icon size={11} />{meta.label}
                                  {checked && <CheckCircle2 size={9} className="ml-auto opacity-80" />}
                                </button>
                              );
                            })}
                          </div>
                          {radiusScanCats.length === 0 && (
                            <p className="text-[9px] text-center mt-2 font-semibold text-amber-500 animate-pulse">⚠ Pilih minimal satu kategori untuk mulai scan</p>
                          )}
                        </div>

                        {waypointsInRadius.length === 0 && activeWpLayers.length > 0 && (
                          <div className="px-3 py-2 rounded-lg flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-700 dark:text-amber-400">Tidak ada waypoint dalam radius. Perbesar radius di tab AREA.</p>
                          </div>
                        )}

                        {waypointsInRadius.length > 0 && (
                          <div className="px-3 py-2 rounded-lg flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{waypointsInRadius.length} waypoint siap di-scan</p>
                          </div>
                        )}

                        <button onClick={startRadiusScan} disabled={radiusScanCats.length === 0 || waypointsInRadius.length === 0}
                          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white shadow-lg transition-all">
                          <Play size={15} /> SCAN {waypointsInRadius.length} WAYPOINT
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Direct / Kabupaten Config */
              <>
                {!activeBounds && (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-center">
                    <AlertTriangle size={18} className="text-amber-500 mx-auto mb-1.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">Tentukan area terlebih dahulu</p>
                  </div>
                )}
                {scanMode === 'kabupaten' && kabName && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
                    <MapPin size={10} className="text-teal-500 flex-shrink-0" />
                    <span className="text-[11px] font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</span>
                    <span className="ml-auto text-[8px] text-teal-500 font-bold bg-teal-100 dark:bg-teal-900/40 px-1.5 py-0.5 rounded-full">KAB</span>
                  </div>
                )}
                {isDirectMode && drawnBounds && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                    <Scan size={10} className="text-violet-500 flex-shrink-0" />
                    <span className="text-[11px] font-black text-violet-700 dark:text-violet-400">Direct Scan</span>
                    <span className="ml-auto text-[8px] text-violet-500 font-bold bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full">1x</span>
                  </div>
                )}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Kategori</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(({ id, label, color, Icon }) => (
                      <button key={id} onClick={() => setSelectedCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])}
                        className={`p-2.5 rounded-xl border-2 transition-all font-bold text-xs flex items-center gap-2 ${selectedCats.includes(id) ? 'text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                        style={selectedCats.includes(id) ? { backgroundColor: color, borderColor: color } : {}}>
                        <Icon size={13} /> <span>{label}</span>
                        {selectedCats.includes(id) && <CheckCircle2 size={10} className="ml-auto opacity-80" />}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleStartScan} disabled={!activeBounds || !selectedCats.length}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-bold shadow-md disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  <Play size={15} /> Scan Langsung
                </button>
              </>
            )}
          </>
        )}

        {/* ── STEP: HASIL ── */}
        {step === 'hasil' && (
          <>
            {isRadiusMode ? (
              <div className="space-y-3">
                {/* Export + Reset */}
                {allRadiusPolygons.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setShowAnalysis(v => !v)}
                      className={`py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 col-span-2 transition-all border-2 ${showAnalysis ? 'bg-white dark:bg-slate-800 border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'bg-cyan-500/5 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'}`}>
                      <BarChart2 size={11} />
                      {showAnalysis ? 'Sembunyikan Analisis' : 'Analisis'}
                    </button>
                    <button onClick={exportRadiusCSV}
                      className="py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                      <Download size={11} /> CSV
                    </button>
                  </div>
                )}
                {showAnalysis && allRadiusPolygons.length > 0 && (
                  <AnalysisPanel results={allRadiusPolygons} tileGrid={[]} tileStats={{ total: waypointsInRadius.length, done: radiusScanProgress.done, objects: allRadiusPolygons.length }} scanMode="radius" kabupatenName="" isDirectScan={false} />
                )}

                {/* Scan progress */}
                {(radiusIsScanning || radiusScanProgress.done > 0) && (
                  <RadiusScanProgress progress={radiusScanProgress} currentWaypoint={currentRadiusScanWp} isScanning={radiusIsScanning} />
                )}

                {/* Validation Summary */}
                {allRadiusPolygons.length > 0 && (
                  <RadiusValidationSummary allPolygons={allRadiusPolygons} waypointsInRadius={waypointsInRadius} />
                )}

                {/* Sub-tab: Ada Waypoint / Luar Waypoint */}
                {allRadiusPolygons.length > 0 && (
                  <div className="flex rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700">
                    {[
                      { id: 'with_waypoint', label: 'Ada Waypoint', count: radiusWithWpPolygons.length,  grad: 'from-cyan-500 to-blue-600' },
                      { id: 'no_waypoint',   label: 'Luar Waypoint', count: radiusNoWpPolygons.length,   grad: 'from-violet-500 to-purple-600' },
                    ].map(tab => (
                      <button key={tab.id}
                        onClick={() => { setRadiusActiveSubTab(tab.id); setRadiusFilterStatus('all'); }}
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase transition-all ${
                          radiusActiveSubTab === tab.id
                            ? `bg-gradient-to-r ${tab.grad} text-white`
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}>
                        {tab.label}
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] ${radiusActiveSubTab === tab.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Filter (hanya Ada Waypoint) */}
                {allRadiusPolygons.length > 0 && radiusActiveSubTab === 'with_waypoint' && (
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { id: 'all',      label: `Semua (${radiusWithWpPolygons.length})` },
                      { id: 'valid',    label: `Valid (${radiusStats.valid})` },
                      { id: 'mismatch', label: `Mismatch (${radiusStats.mismatch})` },
                      { id: 'low_conf', label: `Low Conf (${radiusStats.lowConf})` },
                    ].map(f => (
                      <button key={f.id} onClick={() => setRadiusFilterStatus(f.id)}
                        className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all ${
                          radiusFilterStatus === f.id
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
                        }`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Info Luar Waypoint */}
                {allRadiusPolygons.length > 0 && radiusActiveSubTab === 'no_waypoint' && radiusNoWpPolygons.length > 0 && (
                  <div className="px-3 py-2 rounded-xl flex items-start gap-2 text-[10px] bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                    <Info size={11} className="flex-shrink-0 mt-0.5" />
                    <span>Klik <b>Cari Nama via OSM</b> untuk mendapatkan informasi lokasi dari OpenStreetMap.</span>
                  </div>
                )}

                {/* Detail Polygon Cards */}
                {allRadiusPolygons.length > 0 && (
                  <div className="rounded-xl border-2 p-3 bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700">
                    <button onClick={() => setShowDetailPolygons(v => !v)}
                      className="w-full flex items-center justify-between py-1 mb-2 text-slate-600 dark:text-slate-400">
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        Detail Polygon ({radiusFilteredPolygons.length})
                      </span>
                      <ChevronRight size={12} className={`transition-transform ${showDetailPolygons ? 'rotate-90' : ''}`} />
                    </button>

                    {showDetailPolygons && (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {radiusFilteredPolygons.length === 0 ? (
                          <p className="text-[10px] text-center py-4 text-slate-400 dark:text-slate-500">
                            Tidak ada polygon dengan filter ini
                          </p>
                        ) : radiusFilteredPolygons.map((polygon, idx) => {
                          const cLat = polygon.polygonLatLng?.length
                            ? polygon.polygonLatLng.reduce((s, p) => s + p[0], 0) / polygon.polygonLatLng.length : 0;
                          const cLng = polygon.polygonLatLng?.length
                            ? polygon.polygonLatLng.reduce((s, p) => s + p[1], 0) / polygon.polygonLatLng.length : 0;
                          const gcKey = `${cLat.toFixed(5)}_${cLng.toFixed(5)}`;

                          return radiusActiveSubTab === 'no_waypoint' ? (
                            <RadiusNoWaypointCard
                              key={`nwp_${idx}`}
                              polygon={polygon}
                              geocodeResult={geocodeCache[gcKey]}
                              onGeocode={(lat, lng) => reverseGeocode(lat, lng)}
                              onLocate={() => flyToPolygon(polygon)}
                            />
                          ) : (
                            <RadiusPolygonCard
                              key={`poly_${idx}`}
                              polygon={polygon}
                              onLocate={() => flyToPolygon(polygon)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Scan controls */}
                {radiusIsScanning && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleRadiusPauseResume} className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${radiusIsPaused ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'}`}>
                      {radiusIsPaused ? <><Play size={12} /> Lanjut</> : <><Pause size={12} /> Jeda</>}
                    </button>
                    <button onClick={handleRadiusAbort} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800">
                      <Square size={12} /> Stop
                    </button>
                  </div>
                )}

                {!radiusIsScanning && (
                  <button onClick={handleRadiusReset}
                    className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:border-red-300 hover:text-red-500 transition-all">
                    <RotateCcw size={13} /> Reset
                  </button>
                )}

                {/* Footer stats */}
                {allRadiusPolygons.length > 0 && !radiusIsScanning && (
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 dark:text-slate-600">
                      {radiusStats.valid} valid · {radiusStats.mismatch} mismatch · {radiusStats.noWp} luar WP
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Direct / Kabupaten hasil */
              <>
                {scanMode === 'kabupaten' && kabName && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
                    <MapPin size={10} className="text-teal-500" />
                    <span className="text-[11px] font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</span>
                  </div>
                )}
                {!isScanning && previewResults.length > 0 && (
                  <>
                    <button onClick={() => setShowAnalysis(v => !v)} className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border-2 ${showAnalysis ? 'bg-white dark:bg-slate-800 border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'bg-cyan-500/5 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:border-cyan-500/60'}`}>
                      <BarChart2 size={12} />
                      {showAnalysis ? 'Sembunyikan Analisis' : `Analisis (${previewResults.length} obj)`}
                      {showAnalysis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {showAnalysis && <AnalysisPanel results={previewResults} tileGrid={tileGrid} tileStats={tileStats} scanMode={scanMode} kabupatenName={kabName} isDirectScan={isDirectMode} />}
                  </>
                )}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                    <span className={`text-xs font-black ${isScanning ? 'text-cyan-500' : previewResults.length > 0 ? 'text-green-600' : 'text-slate-400'}`}>{isScanning ? 'Proses...' : previewResults.length > 0 ? 'Selesai' : '—'}</span>
                  </div>
                  {isScanning && <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3"><div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full animate-pulse w-full" /></div>}
                  {isScanning && <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3"><div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full animate-pulse w-full" /></div>}

{/* ← TAMBAHKAN DI SINI */}
{isScanning && scanMode === 'kabupaten' && (
  <div className="grid grid-cols-2 gap-2">
    <button onClick={handlePauseResume}
      className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
        isPaused
          ? 'bg-cyan-500 text-white'
          : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'
      }`}>
      {isPaused ? <><Play size={12} /> Lanjut</> : <><Pause size={12} /> Jeda</>}
    </button>
    <button
      onClick={() => { abortRef.current = true; setIsScanning(false); setIsPaused(false); pauseRef.current = false; toast.error('Scan dihentikan'); }}
      className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800">
      <Square size={12} /> Stop
    </button>
  </div>
)}

<div className="grid grid-cols-3 gap-2 text-center"></div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[{ v: isScanning ? '...' : '1', l: 'Capture', c: 'text-slate-700 dark:text-slate-200' }, { v: previewResults.length > 0 ? '1' : '0', l: 'Selesai', c: 'text-green-600 dark:text-green-400' }, { v: previewResults.length, l: 'Objek', c: 'text-amber-600 dark:text-amber-400' }].map(s => (
                      <div key={s.l} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700"><div className={`text-base font-black ${s.c}`}>{s.v}</div><div className="text-[8px] text-slate-400 font-black uppercase">{s.l}</div></div>
                    ))}
                  </div>
                </div>
                {!isScanning && previewResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleSaveAll} disabled={isSaving} className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5"><Save size={12} /> {isSaving ? 'Menyimpan...' : `Simpan (${previewResults.length})`}</button>
                    <button onClick={handleReset} className="py-2.5 rounded-xl bg-white dark:bg-slate-700 text-red-500 text-xs font-black flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-800"><Trash2 size={12} /> Batal</button>
                  </div>
                )}
                {!isScanning && <button onClick={handleReset} className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:border-red-300 hover:text-red-500 transition-all"><RotateCcw size={13} /> Reset</button>}
              </>
            )}
          </>
        )}
      

      {/* FOOTER */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30 flex items-center justify-between">
        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-medium">
          {isRadiusMode
            ? `Radius · z${WAYPOINT_SCAN_ZOOM} · per waypoint`
            : isDirectMode
              ? `Direct · z${CAPTURE_ZOOM}${kabName ? ' · ' + kabName : ''}`
              : `Direct · z${CAPTURE_ZOOM}`}
        </p>
        {(activeBounds || allRadiusPolygons.length > 0) && !isScanning && !radiusIsScanning && (
          <button onClick={isRadiusMode ? handleRadiusReset : handleReset} className="text-[10px] text-red-400 hover:text-red-600 font-bold flex items-center gap-1"><Trash2 size={9} /> Reset</button>
        )}
      </div>

      {/* Clean mode — sembunyikan semua UI saat scan kabupaten */}
      {isScanning && !isDirectMode && (
        <style>{`
          .geo-scan-panel-root { display: none !important; }
          .leaflet-control-container { display: none !important; }
        `}</style>
      )}

      </div>

      {/* Summary panel untuk non-radius */}
      {!isRadiusMode && (
        <SummaryPanel
          results={previewResults}
          tileStats={tileStats}
          onSave={handleSaveAll}
          onCancel={handleReset}
          isSaving={isSaving}
          isScanning={isScanning}
          isDirectMode={isDirectMode}
          isPaused={isPaused}
          onPauseResume={handlePauseResume}
          onStop={() => {
            abortRef.current = true;
            setIsScanning(false);
            setIsPaused(false);
            pauseRef.current = false;
            toast.error('Scan dihentikan');
          }}
        />
      )}
    </div>
    </>
  );
}