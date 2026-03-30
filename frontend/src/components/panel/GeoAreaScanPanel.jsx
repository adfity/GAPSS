"use client";
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Grid, Play, Square, Trash2, Save, ChevronRight, Layers,
  ScanLine, CheckCircle2, XCircle, Clock, AlertTriangle,
  Home, Waves, Trees, Route, Pause, RotateCcw, ChevronDown, ChevronUp, X,
  MousePointer2, Zap, MapPin, Search, Map,
  BarChart2, Activity, TrendingUp, FileText, Download,
  Building2, Leaf, Info, Globe, Scan,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Rectangle, Polygon, GeoJSON, Popup, useMapEvents, useMap } from 'react-leaflet';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'bangunan',  label: 'Bangunan',  color: '#f59e0b', Icon: Home  },
  { id: 'perairan',  label: 'Perairan',  color: '#2563eb', Icon: Waves },
  { id: 'pepohonan', label: 'Pepohonan', color: '#16a34a', Icon: Trees },
  { id: 'jalan',     label: 'Jalan',     color: '#64748b', Icon: Route },
];
const CAPTURE_ZOOM = 18;
const CAPTURE_PX   = 640;
const TILE_METER   = 150;
const YOLO_SIZE    = 640;
const SCAN_MODES   = [
  { id: 'draw',   label: 'Area',    icon: Square },
  { id: 'scan',   label: 'Config',  icon: Grid   },
  { id: 'result', label: 'Hasil',   icon: Layers },
];

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

/** Clip a polygon (array of [lat,lng]) to a bounding box */
function clipPolygonToBounds(polygon, bounds) {
  if (!polygon || polygon.length < 3 || !bounds) return polygon;
  const south = Math.min(bounds[0].lat, bounds[1].lat);
  const north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng);
  const east  = Math.max(bounds[0].lng, bounds[1].lng);

  // Sutherland-Hodgman clipping
  const clip = (pts, edgeFn, insideFn, intersectFn) => {
    if (!pts.length) return [];
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const cur  = pts[i];
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curIn  = insideFn(cur);
      const prevIn = insideFn(prev);
      if (curIn) {
        if (!prevIn) out.push(intersectFn(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersectFn(prev, cur));
      }
    }
    return out;
  };

  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const tVal = (a, b, v, axis) => (v - a[axis]) / (b[axis] - a[axis]);

  let pts = polygon.map(p => [p[0], p[1]]);
  pts = clip(pts, null, p => p[0] >= south, (a, b) => { const t = tVal(a, b, south, 0); return lerp(a, b, t); });
  pts = clip(pts, null, p => p[0] <= north, (a, b) => { const t = tVal(a, b, north, 0); return lerp(a, b, t); });
  pts = clip(pts, null, p => p[1] >= west,  (a, b) => { const t = tVal(a, b, west,  1); return lerp(a, b, t); });
  pts = clip(pts, null, p => p[1] <= east,  (a, b) => { const t = tVal(a, b, east,  1); return lerp(a, b, t); });
  return pts.length >= 3 ? pts.map(p => [p[0], p[1]]) : null;
}

function generateTilesFromBounds(bounds, tileMeter = 150, clipFeature = null) {
  const south = Math.min(bounds[0].lat, bounds[1].lat), north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng), east  = Math.max(bounds[0].lng, bounds[1].lng);
  const cLat = (south + north) / 2, latStep = meterToLat(tileMeter), lngStep = meterToLng(tileMeter, cLat);
  const tiles = []; let row = 0;
  for (let lat = south; lat < north; lat += latStep) {
    let col = 0;
    for (let lng = west; lng < east; lng += lngStep) {
      const tN = Math.min(lat + latStep, north), tE = Math.min(lng + lngStep, east);
      const cLt = (lat + tN) / 2, cLg = (lng + tE) / 2;
      if (clipFeature && !pointInFeature({ lat: cLt, lng: cLg }, clipFeature)) { col++; continue; }
      tiles.push({ id: `tile_${row}_${col}`, row, col, south: lat, north: tN, west: lng, east: tE, centerLat: cLt, centerLng: cLg, status: 'pending', count: 0 });
      col++;
    }
    row++;
  }
  tiles.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
  return tiles;
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

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines   = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))];
  const blob    = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

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

// ─── ANALYSIS PANEL ───────────────────────────────────────────────────────────
function AnalysisPanel({ results, tileGrid, tileStats, scanMode, kabupatenName, isDirectScan }) {
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [showExport, setShowExport] = useState(false);

  const catCounts = useMemo(() =>
    results.reduce((acc, r) => { acc[r.kategori] = (acc[r.kategori] || 0) + 1; return acc; }, {}), [results]);
  const catLuas = useMemo(() =>
    results.reduce((acc, r) => { acc[r.kategori] = (acc[r.kategori] || 0) + (r.luas_m2 || 0); return acc; }, {}), [results]);
  const totalLuas  = useMemo(() => Object.values(catLuas).reduce((a, b) => a + b, 0), [catLuas]);
  const avgConf    = useMemo(() => results.length ? (results.reduce((s, r) => s + r.confidence_score, 0) / results.length) : 0, [results]);
  const envScore   = useMemo(() => calcEnvScore(catCounts, results.length), [catCounts, results.length]);
  const highConf   = useMemo(() => results.filter(r => r.confidence_score >= 0.8).length, [results]);

  const barData = useMemo(() =>
    CATEGORIES.filter(c => catCounts[c.id]).map(c => ({
      name: c.label, id: c.id,
      count: catCounts[c.id] || 0,
      luas:  catLuas[c.id]  || 0,
      color: c.color,
      pct:   results.length ? Math.round(((catCounts[c.id] || 0) / results.length) * 100) : 0,
    })), [catCounts, catLuas, results.length]);

  const pieData = useMemo(() => barData.map(d => ({ name: d.name, value: d.count, fill: d.color })), [barData]);

  const insights = useMemo(() => {
    const out = [], total = results.length;
    if (!total) return out;
    const pB = (catCounts.bangunan  || 0) / total;
    const pP = (catCounts.pepohonan || 0) / total;
    const pA = (catCounts.perairan  || 0) / total;
    const pJ = (catCounts.jalan     || 0) / total;
    if (pB > 0.6)              out.push({ type: 'danger',  title: 'Densitas Bangunan Tinggi',    desc: `${Math.round(pB * 100)}% objek terdeteksi sebagai bangunan.` });
    else if (pB > 0.4)         out.push({ type: 'warning', title: 'Densitas Bangunan Sedang',    desc: `${Math.round(pB * 100)}% bangunan. Pertumbuhan perlu dipantau.` });
    if (pP < 0.1 && pB > 0.3) out.push({ type: 'danger',  title: 'Defisit RTH',                 desc: `Vegetasi hanya ${Math.round(pP * 100)}% — di bawah standar 30%.` });
    else if (pP > 0.4)         out.push({ type: 'success', title: 'Tutupan Vegetasi Baik',       desc: `${Math.round(pP * 100)}% area bervegetasi.` });
    if (pA > 0.15)             out.push({ type: 'warning', title: 'Potensi Rawan Banjir',        desc: `Perairan ${Math.round(pA * 100)}% — relatif tinggi.` });
    if (pJ < 0.05 && pB > 0.2) out.push({ type: 'warning', title: 'Aksesibilitas Rendah',       desc: 'Rasio jalan vs bangunan rendah.' });
    if (avgConf < 0.6)         out.push({ type: 'info',    title: 'Akurasi Rendah',              desc: `Confidence rata-rata ${Math.round(avgConf * 100)}%.` });
    else if (avgConf > 0.85)   out.push({ type: 'success', title: 'Akurasi Tinggi',              desc: `Confidence rata-rata ${Math.round(avgConf * 100)}%.` });
    return out;
  }, [results, catCounts, avgConf]);

  const tileStatusCounts = useMemo(() => ({
    done:  tileGrid.filter(t => t.status === 'done').length,
    empty: tileGrid.filter(t => t.status === 'empty').length,
    error: tileGrid.filter(t => t.status === 'error').length,
  }), [tileGrid]);

  const handleExportJSON = () => {
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    exportJSON({
      meta:    { scanMode, kabupatenName, scanDate: new Date().toISOString(), tileTotal: tileStats.total, tileDone: tileStats.done },
      summary: { totalObjects: results.length, totalLuas, avgConf, envScore, catCounts, catLuas },
      results,
    }, `geoscan_${kabupatenName || 'area'}_${ts}.json`);
    setShowExport(false);
  };

  const handleExportCSV = () => {
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    exportCSV(results.map(r => ({
      kategori: r.kategori, confidence_score: r.confidence_score,
      luas_m2: r.luas_m2 || '', tile_id: r.tile_id || '',
      scan_lat: r.scanLat || '', scan_lng: r.scanLng || '',
    })), `geoscan_${kabupatenName || 'area'}_${ts}.csv`);
    setShowExport(false);
  };

  const insightStyle = {
    danger:  'border-red-400/40 bg-red-500/5 text-red-500 dark:text-red-400',
    warning: 'border-amber-400/40 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    success: 'border-green-400/40 bg-green-500/5 text-green-600 dark:text-green-400',
    info:    'border-cyan-400/40 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400',
  };
  const insightIcon = { danger: '⚠', warning: '⚠', success: '✓', info: 'ℹ' };

  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan', icon: BarChart2 },
    { id: 'lahan',     label: 'Lahan',     icon: Layers    },
    { id: 'insight',   label: 'Insight',   icon: Zap       },
  ];

  const envColor = envScore >= 60 ? 'text-green-600 dark:text-green-400' : envScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const envLabel = envScore >= 70 ? 'Baik' : envScore >= 50 ? 'Cukup' : envScore >= 30 ? 'Perlu Perhatian' : 'Kritis';
  if (!results.length) return null;

  const tooltipStyle = { background: 'var(--tooltip-bg,#0f172a)', border: '1px solid var(--tooltip-border,#334155)', borderRadius: 8, fontSize: 10 };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <BarChart2 size={12} className="text-white" />
          </div>
          <span className="text-[11px] font-black text-slate-700 dark:text-white uppercase tracking-wide">Analisis</span>
          <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full border border-cyan-500/20">
            {results.length} obj
          </span>
          {isDirectScan && (
            <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20">
              DIRECT
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExport(v => !v)}
            className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-cyan-500/50 transition-colors"
          >
            <Download size={10} className="text-slate-500 dark:text-slate-400" />
          </button>
          {showExport && (
            <>
              <div className="fixed inset-0 z-[50]" onClick={() => setShowExport(false)} />
              <div className="absolute right-0 top-8 z-[51] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden w-28">
                <button onClick={handleExportJSON} className="w-full px-3 py-2 text-left text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                  <FileText size={10} className="text-cyan-500" /> JSON
                </button>
                <button onClick={handleExportCSV} className="w-full px-3 py-2 text-left text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2">
                  <Globe size={10} className="text-green-500" /> CSV
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-black uppercase tracking-wider transition-all border-b-2 ${
                activeTab === t.id
                  ? 'text-cyan-600 dark:text-cyan-400 border-cyan-500 bg-white dark:bg-slate-800'
                  : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={9} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="p-3 space-y-3">

        {/* ── RINGKASAN ── */}
        {activeTab === 'ringkasan' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Objek',      value: results.length.toLocaleString(), sub: isDirectScan ? '1 capture' : `${tileStats.done} tile`, accent: '#06b6d4' },
                { label: 'Akurasi',   value: `${Math.round(avgConf * 100)}%`,  sub: `${highConf} ≥80%`,          accent: '#a78bfa' },
                { label: 'Luas',      value: fmtArea(totalLuas),               sub: 'estimasi',                  accent: '#f59e0b' },
                { label: 'Env Score', value: `${envScore}`,                    sub: envLabel,                    accent: envScore >= 60 ? '#22c55e' : envScore >= 40 ? '#f59e0b' : '#ef4444' },
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
                  const cat  = CATEGORIES.find(c => c.id === d.id);
                  const Icon = cat?.Icon || Layers;
                  return (
                    <div key={d.id} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${d.color}22` }}>
                        <Icon size={10} style={{ color: d.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{d.name}</span>
                          <span className="text-[10px] font-black text-slate-800 dark:text-white">
                            {d.count.toLocaleString()} <span className="text-slate-400 font-medium">({d.pct}%)</span>
                          </span>
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
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {barData.map(d => (
                    <div key={d.id} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 flex-1">{d.name}</span>
                      <span className="text-[9px] font-black text-slate-800 dark:text-white">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!isDirectScan && (
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { l: 'Terisi', v: tileStatusCounts.done,  c: 'text-green-600 dark:text-green-400' },
                  { l: 'Kosong', v: tileStatusCounts.empty, c: 'text-amber-600 dark:text-amber-400' },
                  { l: 'Error',  v: tileStatusCounts.error, c: 'text-red-600 dark:text-red-400'   },
                ].map(s => (
                  <div key={s.l} className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 rounded-xl p-2 text-center">
                    <div className={`text-base font-black ${s.c}`}>{s.v}</div>
                    <div className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase">{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── LAHAN ── */}
        {activeTab === 'lahan' && (
          <>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Objek per Kategori</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={barData} barSize={22}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#00000008' }} />
                  <Bar dataKey="count" name="Jumlah" radius={[4, 4, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {totalLuas > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Luas per Kategori</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={barData.filter(d => d.luas > 0)} barSize={22}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} width={36}
                      tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(0)}ha` : `${v}m²`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [fmtArea(v), 'Luas']} cursor={{ fill: '#00000008' }} />
                    <Bar dataKey="luas" name="Luas" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5">Terbangun vs Alami</p>
              {[
                { label: 'Terbangun', value: (catCounts.bangunan || 0) + (catCounts.jalan || 0),     color: '#ef4444' },
                { label: 'Alami',     value: (catCounts.pepohonan || 0) + (catCounts.perairan || 0), color: '#22c55e' },
              ].map(row => {
                const pct = results.length ? Math.round((row.value / results.length) * 100) : 0;
                return (
                  <div key={row.label} className="mb-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{row.label}</span>
                      <span className="text-[10px] font-black text-slate-800 dark:text-white">{row.value.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                <span className="text-[9px] font-black text-slate-400 uppercase">Env Score</span>
                <span className={`text-base font-black ${envColor}`}>{envScore}/100 · {envLabel}</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Detail</p>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Kat.', 'Jml', 'Luas', 'Conf.'].map(h => (
                      <th key={h} className="py-1.5 px-1 text-left font-black text-slate-400 dark:text-slate-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.filter(c => catCounts[c.id]).map(cat => {
                    const catRes = results.filter(r => r.kategori === cat.id);
                    const ac = catRes.length ? catRes.reduce((s, r) => s + r.confidence_score, 0) / catRes.length : 0;
                    const Icon = cat.Icon;
                    return (
                      <tr key={cat.id} className="border-b border-slate-100 dark:border-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="py-2 px-1">
                          <div className="flex items-center gap-1">
                            <Icon size={9} style={{ color: cat.color }} />
                            <span className="text-slate-600 dark:text-slate-300 font-bold">{cat.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-1 font-black text-slate-800 dark:text-white">{(catCounts[cat.id] || 0).toLocaleString()}</td>
                        <td className="py-2 px-1 text-slate-500 dark:text-slate-400">{fmtArea(catLuas[cat.id] || 0)}</td>
                        <td className={`py-2 px-1 font-black ${ac >= 0.8 ? 'text-green-600 dark:text-green-400' : ac >= 0.6 ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {Math.round(ac * 100)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── INSIGHT ── */}
        {activeTab === 'insight' && (
          <>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Info Scan</p>
              <div className="space-y-1.5">
                {[
                  { k: 'Wilayah',   v: kabupatenName || 'Manual' },
                  { k: 'Mode',      v: isDirectScan ? 'Direct' : scanMode === 'kabupaten' ? 'Kabupaten' : 'Tile Grid' },
                  { k: 'Tile',      v: isDirectScan ? '1x' : `${tileStats.done}/${tileStats.total}` },
                  { k: 'Objek',     v: results.length.toLocaleString() },
                  { k: 'Luas',      v: fmtArea(totalLuas) },
                  { k: 'Conf',      v: `${Math.round(avgConf * 100)}%` },
                  { k: 'Env Score', v: `${envScore}/100` },
                  { k: 'Tanggal',   v: new Date().toLocaleDateString('id-ID') },
                ].map(row => (
                  <div key={row.k} className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/40 last:border-0">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">{row.k}</span>
                    <span className="text-[10px] text-slate-800 dark:text-white font-bold">{row.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                Temuan ({insights.length})
              </p>
              {insights.length > 0 ? (
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <div key={i} className={`border rounded-xl p-2.5 flex items-start gap-2 ${insightStyle[ins.type]}`}>
                      <span className="text-xs mt-0.5 flex-shrink-0">{insightIcon[ins.type]}</span>
                      <div>
                        <p className="text-[10px] font-black text-slate-800 dark:text-white">{ins.title}</p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{ins.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-3">Tidak ada temuan.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── KABUPATEN SEARCH ─────────────────────────────────────────────────────────
function KabupatenSearchPanel({ kabupatenList, selectedKabupaten, onSelect, isLoading }) {
  const [query,  setQuery]  = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const getName = (f) => f?.properties?.name || f?.properties?.NAMOBJ || f?.properties?.KAB_KOTA || '';
  const getProv = (f) => f?.properties?.provinsi || f?.properties?.PROPINSI || f?.properties?.Propinsi || '';

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return kabupatenList.slice(0, 60);
    return kabupatenList.filter(f => getName(f).toLowerCase().includes(q)).slice(0, 60);
  }, [query, kabupatenList]);

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 cursor-text transition-all ${isOpen ? 'border-cyan-500 shadow-lg shadow-cyan-500/10' : 'border-slate-200 dark:border-slate-700'}`}
        onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
      >
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          : <Search size={13} className="text-slate-400 flex-shrink-0" />}
        <input
          ref={inputRef} value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Cari kabupaten / kota..."
          className="flex-1 bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none min-w-0"
        />
        {selectedKabupaten && !query && (
          <button onClick={e => { e.stopPropagation(); onSelect(null); setQuery(''); }} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {selectedKabupaten && !isOpen && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-cyan-700 dark:text-cyan-400 truncate">{getName(selectedKabupaten)}</p>
            {getProv(selectedKabupaten) && <p className="text-[9px] text-cyan-600/60 truncate">{getProv(selectedKabupaten)}</p>}
          </div>
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
                      <button key={idx} onClick={() => { onSelect(f); setQuery(''); setIsOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isSel ? 'bg-cyan-50 dark:bg-cyan-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <MapPin size={11} className={isSel ? 'text-cyan-500' : 'text-slate-400'} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold truncate ${isSel ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-200'}`}>{name}</p>
                          {prov && <p className="text-[9px] text-slate-400 truncate">{prov}</p>}
                        </div>
                        {isSel && <CheckCircle2 size={11} className="text-cyan-500 flex-shrink-0" />}
                      </button>
                    );
                  })
              }
            </div>
            <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
              <p className="text-[9px] text-slate-400">{filtered.length} hasil · atau klik di peta</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── KABUPATEN MAP OVERLAY ────────────────────────────────────────────────────
export const KabupatenMapOverlay = memo(function KabupatenMapOverlay({
  kabupatenList, selectedKabupaten, isClickMode, onSelect, isActive,
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.getContainer().style.cursor = isClickMode ? 'crosshair' : '';
    return () => { if (map.getContainer()) map.getContainer().style.cursor = ''; };
  }, [map, isClickMode]);

  useMapEvents({
    click(e) {
      if (!isClickMode || !kabupatenList?.length) return;
      const hit = kabupatenList.find(f => pointInFeature(e.latlng, f));
      if (hit) onSelect?.(hit);
      else toast('Klik di dalam wilayah kabupaten', { icon: '📍', duration: 1500 });
    },
  });

  const getSelName = () =>
    selectedKabupaten?.properties?.name || selectedKabupaten?.properties?.NAMOBJ ||
    selectedKabupaten?.properties?.KAB_KOTA || '';

  const style = useCallback((feature) => {
    const name  = feature.properties?.name || feature.properties?.NAMOBJ || feature.properties?.KAB_KOTA || '';
    const isSel = selectedKabupaten && name === getSelName();
    if (isSel)       return { color: '#00ffcc', weight: 2.5, fillColor: '#00ffcc', fillOpacity: 0.18, opacity: 1 };
    if (isClickMode) return { color: '#38bdf8', weight: 0.8, fillColor: '#0ea5e9', fillOpacity: 0.04, dashArray: '5,5', opacity: 0.7 };
    return             { color: '#38bdf8', weight: 0.5, fillColor: 'transparent', fillOpacity: 0, dashArray: '6,6', opacity: 0.35 };
  }, [selectedKabupaten, isClickMode]);

  const onEachFeature = useCallback((feature, layer) => {
    const props = feature.properties || {};
    const name  = props.name || props.NAMOBJ || props.KAB_KOTA || '';
    const prov  = props.provinsi || props.PROPINSI || props.Propinsi || '';
    const tipe  = props.type_wilayah || props.TIPE || '';
    const isSel = selectedKabupaten && name === getSelName();

    layer.bindPopup(`
      <div style="font-family:system-ui,sans-serif;min-width:190px;padding:2px">
        <div style="background:linear-gradient(135deg,#0d9488,#0891b2);color:white;padding:10px 12px;border-radius:10px 10px 4px 4px;margin-bottom:6px">
          <div style="font-size:8px;font-weight:800;opacity:.75;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">${tipe || 'Kabupaten / Kota'}</div>
          <div style="font-size:15px;font-weight:900">${name}</div>
        </div>
        <div style="padding:0 4px 4px">
          ${prov ? `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase">Provinsi</span><span style="font-size:11px;font-weight:700;color:#0f766e">${prov}</span></div>` : ''}
          ${isClickMode && !isSel ? `<div style="margin-top:6px;padding:6px 8px;background:#f0fdfa;border-radius:8px;border:1px solid #99f6e4;font-size:9px;font-weight:700;color:#0d9488;text-align:center">✓ Klik untuk pilih</div>` : ''}
          ${isSel ? `<div style="margin-top:6px;padding:6px 8px;background:#ecfdf5;border-radius:8px;border:1px solid #6ee7b7;font-size:9px;font-weight:700;color:#059669;text-align:center">✅ Dipilih</div>` : ''}
        </div>
      </div>`, { maxWidth: 240 });

    layer.on({
      mouseover: (e) => {
        if (isSel) return;
        e.target.setStyle({ fillOpacity: 0.12, color: '#22d3ee', weight: 1.5, opacity: 1, dashArray: undefined });
        e.target.bindTooltip(`<span style="font-size:11px;font-weight:800;color:#0f172a">${name}</span>`, { sticky: true }).openTooltip();
      },
      mouseout: (e) => {
        if (isSel) return;
        e.target.setStyle(style(feature));
        e.target.closeTooltip();
      },
      click: (e) => {
        if (!isClickMode) return;
        e.target.setStyle({ fillColor: '#00ffcc', fillOpacity: 0.4, color: '#00ffcc', weight: 3, dashArray: undefined });
        setTimeout(() => onSelect?.(feature), 180);
      },
    });
  }, [selectedKabupaten, isClickMode, onSelect, style]);

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
}) {
  const map    = useMap();
  const startPt = useRef(null);
  const [tempRect, setTempRect] = useState(null);
  const [ready, setReady] = useState(false);
  // Only allow drawing when explicitly in draw mode AND not scanning
  const canDraw = isDrawing && !isScanning;

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (canDraw) {
      map.scrollWheelZoom.disable();
      container.style.cursor = 'crosshair';
    } else {
      map.scrollWheelZoom.enable();
      map.dragging.enable();
      container.style.cursor = '';
    }
    return () => {
      map.scrollWheelZoom.enable();
      map.dragging.enable();
      container.style.cursor = '';
    };
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
    mousedown(e) {
      if (!canDraw || !ready) return;
      startPt.current = e.latlng;
      map.dragging.disable();
      map.scrollWheelZoom.disable();
    },
    mousemove(e) {
      if (!canDraw || !startPt.current) return;
      setTempRect([startPt.current, e.latlng]);
    },
    mouseup(e) {
      if (!canDraw || !startPt.current) return;
      const b0 = startPt.current, b1 = e.latlng;
      if (Math.abs(b0.lat - b1.lat) > meterToLat(50) && Math.abs(b0.lng - b1.lng) > meterToLng(50, b0.lat)) {
        onBoundsSet([b0, b1]);
      } else {
        toast.error('Area terlalu kecil!');
      }
      setTempRect(null);
      startPt.current = null;
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    },
  });

  const getCatColor = (cat) => CATEGORIES.find(c => c.id === cat)?.color || '#ef4444';
  if (!isActive) return null;

  return (
    <>
      {/* Drawing preview */}
      {tempRect && (
        <Rectangle bounds={tempRect} pathOptions={{ color: '#fff', weight: 2, fillColor: '#06b6d4', fillOpacity: 0.12, dashArray: '8,5' }} />
      )}

      {/* Drawn area outline */}
      {drawnBounds && (isDirectMode ? true : tileGrid.length === 0) && (
        <Rectangle
          bounds={[[drawnBounds[0].lat, drawnBounds[0].lng], [drawnBounds[1].lat, drawnBounds[1].lng]]}
          pathOptions={{
            color: directScanningActive ? '#00ffcc' : '#06b6d4',
            weight: directScanningActive ? 2.5 : 1.5,
            fillColor: directScanningActive ? '#00ffcc' : '#06b6d4',
            fillOpacity: directScanningActive ? 0.04 : 0.08,
            dashArray: directScanningActive ? undefined : '8,5',
          }}
        />
      )}

      {/* Tile grid */}
      {!isDirectMode && tileGrid.map((tile, idx) => {
        const scanning = idx === scanningTileIdx;
        let color, fillOp, weight, dash;
        if (scanning)                     { color = '#00ffff'; fillOp = 0.0;  weight = 2.5; dash = undefined; }
        else if (tile.status === 'done')  { color = '#00ff88'; fillOp = 0.06; weight = 0.8; dash = undefined; }
        else if (tile.status === 'empty') { color = '#ffcc00'; fillOp = 0.0;  weight = 0.6; dash = '3,3'; }
        else if (tile.status === 'error') { color = '#ff4444'; fillOp = 0.08; weight = 0.8; dash = undefined; }
        else                              { color = '#ffffff'; fillOp = 0.0;  weight = 0.3; dash = '2,4'; }
        return (
          <Rectangle
            key={tile.id}
            bounds={[[tile.south, tile.west], [tile.north, tile.east]]}
            pathOptions={{ color, weight, fillColor: color, fillOpacity: fillOp, dashArray: dash }}
            eventHandlers={{
              click: () => { if (onTileClick && !isScanning) onTileClick(tile); },
              mouseover: (e) => { if (!scanning) e.target.setStyle({ weight: 1.5, fillOpacity: fillOp + 0.08 }); },
              mouseout:  (e) => { if (!scanning) e.target.setStyle({ weight, fillOpacity: fillOp }); },
            }}
          />
        );
      })}

      {/* Active scanning tile highlight */}
      {!isDirectMode && scanningTileIdx >= 0 && tileGrid[scanningTileIdx] && (() => {
        const t = tileGrid[scanningTileIdx];
        return <Rectangle bounds={[[t.south, t.west], [t.north, t.east]]} pathOptions={{ color: '#00ffff', weight: 2.5, fillColor: '#00ffff', fillOpacity: 0.15 }} />;
      })()}

      {/* FIX: clip polygons to drawnBounds so they don't spill outside */}
      {previewResults.map((obj, idx) => {
        if (!obj.polygonLatLng || obj.polygonLatLng.length < 3) return null;
        const color = getCatColor(obj.kategori);

        // Clip polygon to scan bounds
        const bounds = drawnBounds || (obj._tile ? {
          0: { lat: obj._tile.south, lng: obj._tile.west },
          1: { lat: obj._tile.north, lng: obj._tile.east },
        } : null);

        let positions = obj.polygonLatLng;
        if (bounds) {
          const clipped = clipPolygonToBounds(positions, bounds);
          if (!clipped || clipped.length < 3) return null;
          positions = clipped;
        }

        return (
          <Polygon
            key={`prev-${idx}`}
            positions={positions}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.4,
              weight: 1.5,
              // FIX: remove stroke artifacts with smooth rendering
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
            <Popup>
              <div className="p-2 min-w-[130px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="font-bold text-xs uppercase">{obj.kategori}</span>
                </div>
                {obj.luas_m2 && <p className="text-[10px] text-slate-500">Luas: <b className="text-sky-600">{obj.luas_m2} m²</b></p>}
                <p className="text-[10px] text-slate-400">Conf: {(obj.confidence_score * 100).toFixed(1)}%</p>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

// ─── SUMMARY PANEL (floating) ─────────────────────────────────────────────────
function SummaryPanel({ results, tileStats, onSave, onCancel, isSaving, isScanning, isDirectMode }) {
  const [collapsed, setCollapsed] = useState(false);
  const catSummary = results.reduce((acc, r) => { acc[r.kategori] = (acc[r.kategori] || 0) + 1; return acc; }, {});
  const totalLuas  = results.reduce((s, r) => s + (r.luas_m2 || 0), 0);
  const pct = tileStats.total > 0 ? Math.round((tileStats.done / tileStats.total) * 100) : 0;
  if (!isScanning && results.length === 0) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1200] w-[320px] max-w-[92vw]">
      <div className="bg-slate-900/96 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none" onClick={() => setCollapsed(v => !v)}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-cyan-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-white text-xs font-black uppercase tracking-wide">
              {isScanning
                ? isDirectMode ? 'Menganalisis...' : `Scanning ${tileStats.done}/${tileStats.total} (${pct}%)`
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
          <div className="h-1 bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
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
                  { v: tileStats.total, l: 'Total',   c: 'text-white' },
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
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────
export default function GeoAreaScanPanel({
  mapRef, zoomLevel, onNewData,
  isDrawingArea, setIsDrawingArea, drawnBounds, setDrawnBounds,
  tileGrid, setTileGrid, previewResults, setPreviewResults,
  scanningTileIdx, setScanningTileIdx, tileStats, setTileStats,
  isScanning, setIsScanning,
  onKabupatenStateChange,
  // FIX: accept onClose prop so panel can be dismissed
  onClose,
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

  const pauseRef = useRef(false);
  const abortRef = useRef(false);

  const isDirectMode = scanMode === 'manual-direct';

  const activeBounds = useMemo(() => {
    if (scanMode === 'kabupaten' && selectedKabupaten) return getBoundsFromFeature(selectedKabupaten);
    return drawnBounds;
  }, [scanMode, selectedKabupaten, drawnBounds]);

  const estTiles   = isDirectMode ? 1 : (activeBounds ? estimateTileCount(activeBounds, TILE_METER) : 0);
  const estSeconds = isDirectMode ? 2 : estTiles * 1.5;
  const estMinutes = estSeconds < 60 ? `${Math.ceil(estSeconds)}s` : `~${Math.ceil(estSeconds / 60)} menit`;

  useEffect(() => { if (isScanning) setStep('result'); }, [isScanning]);
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
    setIsKabupatenClickMode(false);
    const name = feature.properties?.name || feature.properties?.NAMOBJ || feature.properties?.KAB_KOTA || '';
    toast.success(`✓ ${name} dipilih`, { duration: 2000 });
    const bounds = getBoundsFromFeature(feature);
    if (bounds && mapRef?.current) {
      mapRef.current.fitBounds(
        [[bounds[0].lat, bounds[0].lng], [bounds[1].lat, bounds[1].lng]],
        { padding: [60, 60] }
      );
    }
  }, [mapRef]);

  useEffect(() => {
    onKabupatenStateChange?.({ scanMode, kabupatenList, selectedKabupaten, isKabupatenClickMode, handleSelect });
  }, [scanMode, kabupatenList, selectedKabupaten, isKabupatenClickMode, handleSelect]);

  // ── DIRECT SCAN ──
  const handleDirectScan = async () => {
    if (!activeBounds)        { toast.error('Tentukan area scan terlebih dahulu!'); return; }
    if (!selectedCats.length) { toast.error('Pilih minimal satu kategori!'); return; }

    const map = mapRef?.current;
    if (!map) return;

    setIsScanning(true); setDirectScanningActive(true);
    setIsDrawingArea(false); // reset draw mode so cursor clears
    setPreviewResults([]); setStep('result'); setShowAnalysis(false);
    abortRef.current = false;
    const scanToast = toast.loading('Menangkap & menganalisis area...');

    try {
      // FIX: fly to CENTER of drawn bounds, not just any center
      const centerLat = (activeBounds[0].lat + activeBounds[1].lat) / 2;
      const centerLng = (activeBounds[0].lng + activeBounds[1].lng) / 2;

      await new Promise(resolve => {
        map.flyTo([centerLat, centerLng], CAPTURE_ZOOM, { animate: true, duration: 0.8 });
        map.once('moveend', resolve);
      });
      await new Promise(r => setTimeout(r, 700));

      const scanCenter  = map.getCenter();
      const scanLat     = scanCenter.lat;
      const scanLng     = scanCenter.lng;
      const mapElement  = document.querySelector('.leaflet-container');
      const rect        = mapElement.getBoundingClientRect();
      const captureSize = Math.min(CAPTURE_PX, rect.width, rect.height);

      const html2canvasLib = (await import('html2canvas')).default;
      const startX = (rect.width  - captureSize) / 2;
      const startY = (rect.height - captureSize) / 2;

      const canvas = await html2canvasLib(mapElement, {
        useCORS: true, allowTaint: true,
        x: startX, y: startY, width: captureSize, height: captureSize,
        scale: 1, logging: false,
        ignoreElements: el => (
          el.tagName === 'BUTTON' || el.tagName === 'ASIDE' ||
          el.classList.contains('leaflet-control') ||
          el.classList.contains('absolute') || el.classList.contains('fixed') ||
          el.classList.contains('lucide')
        ),
      });

      const blob     = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const formData = new FormData();
      formData.append('image',        blob, 'map_capture.png');
      formData.append('lat',          scanLat);
      formData.append('lng',          scanLng);
      formData.append('capture_size', captureSize);
      formData.append('categories',   selectedCats.join(','));

      const res  = await fetch('http://127.0.0.1:8000/api/run-detection/', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        const scanCenterPixel = map.latLngToContainerPoint([scanLat, scanLng]);
        const halfSize        = captureSize / 2;

        const enriched = data.results.map(obj => {
          if (!obj.segmentation || obj.segmentation.length < 3) return null;
          const polygonLatLng = obj.segmentation.map(pt => {
            const latLng = map.containerPointToLatLng([
              scanCenterPixel.x + (pt[0] - halfSize),
              scanCenterPixel.y + (pt[1] - halfSize),
            ]);
            return [latLng.lat, latLng.lng];
          });
          return {
            ...obj,
            lat: scanLat, lng: scanLng,
            capture_size: captureSize,
            tile_id: 'direct',
            scanLat, scanLng,
            polygonLatLng,
          };
        }).filter(Boolean);

        // FIX: clip all polygons to drawnBounds immediately after detection
        const clipped = enriched.map(obj => {
          if (!obj.polygonLatLng || obj.polygonLatLng.length < 3) return null;
          const clippedPoly = clipPolygonToBounds(obj.polygonLatLng, activeBounds);
          if (!clippedPoly || clippedPoly.length < 3) return null;
          return { ...obj, polygonLatLng: clippedPoly };
        }).filter(Boolean);

        setPreviewResults(clipped);
        setTileStats({ total: 1, done: 1, objects: clipped.length });
        toast.success(`${clipped.length} objek terdeteksi`, { id: scanToast, duration: 3000 });
      } else {
        setTileStats({ total: 1, done: 1, objects: 0 });
        toast.error('Tidak ada objek ditemukan.', { id: scanToast });
      }
    } catch (err) {
      console.error('Direct scan error:', err);
      toast.error(`Error: ${err.message}`, { id: scanToast });
      setTileStats({ total: 1, done: 1, objects: 0 });
    } finally {
      setIsScanning(false);
      setDirectScanningActive(false);
      // FIX: always re-enable map interaction after scan
      if (mapRef?.current) {
        mapRef.current.dragging.enable();
        mapRef.current.scrollWheelZoom.enable();
      }
    }
  };

  // ── FLY & CAPTURE (tile scan) ──
  const flyAndCapture = async (tile) => {
    const map = mapRef.current;
    if (!map) throw new Error('Map not ready');

    await new Promise(resolve => {
      map.flyTo([tile.centerLat, tile.centerLng], CAPTURE_ZOOM, { animate: true, duration: 0.5 });
      map.once('moveend', resolve);
    });
    await new Promise(r => setTimeout(r, 700));

    const centerLatLng = map.getCenter();
    const zoom         = map.getZoom();
    const mapEl        = document.querySelector('.leaflet-container');
    const rect         = mapEl.getBoundingClientRect();
    const captureSize  = Math.min(CAPTURE_PX, rect.width, rect.height);
    const centerWorld  = map.project(centerLatLng, zoom);
    const halfCapture  = captureSize / 2;
    const topLeftWorld = { x: centerWorld.x - halfCapture, y: centerWorld.y - halfCapture };

    const pixelsToLatLng = (segmentation) =>
      segmentation.map(([px, py]) => {
        const scaledX = (px / YOLO_SIZE) * captureSize;
        const scaledY = (py / YOLO_SIZE) * captureSize;
        const ll = map.unproject([topLeftWorld.x + scaledX, topLeftWorld.y + scaledY], zoom);
        return [ll.lat, ll.lng];
      });

    const html2canvas = (await import('html2canvas')).default;
    if (!mapEl) throw new Error('Map element not found');
    const startX = (rect.width  - captureSize) / 2;
    const startY = (rect.height - captureSize) / 2;
    const canvas = await html2canvas(mapEl, {
      useCORS: true, allowTaint: true,
      x: startX, y: startY, width: captureSize, height: captureSize,
      scale: 1, logging: false,
      ignoreElements: el => (
        el.tagName === 'BUTTON' || el.tagName === 'ASIDE' ||
        el.classList.contains('leaflet-control') ||
        el.classList.contains('fixed') || el.classList.contains('absolute') ||
        el.classList.contains('lucide')
      ),
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return { blob, scanLat: centerLatLng.lat, scanLng: centerLatLng.lng, captureSize, pixelsToLatLng };
  };

  // ── TILE SCAN ──
  const handleStartTileScan = async () => {
    if (!activeBounds)        { toast.error('Tentukan area scan terlebih dahulu!'); return; }
    if (!selectedCats.length) { toast.error('Pilih minimal satu kategori!'); return; }
    if (estTiles === 0)       { toast.error('Area terlalu kecil!'); return; }

    const clipFeature = scanMode === 'kabupaten' ? selectedKabupaten : null;
    const grid = generateTilesFromBounds(activeBounds, TILE_METER, clipFeature);
    if (!grid.length) { toast.error('Tidak ada tile!'); return; }

    setTileGrid(grid); setPreviewResults([]); setIsScanning(true); setIsPaused(false);
    setIsDrawingArea(false); setStep('result'); setShowAnalysis(false);
    abortRef.current = false; pauseRef.current = false;

    let done = 0;
    const allResults = [], updatedGrid = [...grid];
    const kabName    = selectedKabupaten?.properties?.name || selectedKabupaten?.properties?.NAMOBJ || '';
    const scanToast  = toast.loading(`Scan ${grid.length} tile${kabName ? ` · ${kabName}` : ''}...`);
    setTileStats({ total: grid.length, done: 0, objects: 0 });

    for (let i = 0; i < grid.length; i++) {
      if (abortRef.current) break;
      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 200));
        if (abortRef.current) break;
      }
      if (abortRef.current) break;

      setScanningTileIdx(i);
      updatedGrid[i] = { ...updatedGrid[i], status: 'scanning' };
      setTileGrid([...updatedGrid]);

      const tile = grid[i];
      try {
        const { blob, scanLat, scanLng, captureSize, pixelsToLatLng } = await flyAndCapture(tile);

        const formData = new FormData();
        formData.append('image',        blob, `tile_${i}.png`);
        formData.append('lat',          scanLat);
        formData.append('lng',          scanLng);
        formData.append('capture_size', YOLO_SIZE);
        formData.append('categories',   selectedCats.join(','));

        const res   = await fetch('http://127.0.0.1:8000/api/run-detection/', { method: 'POST', body: formData });
        const data  = await res.json();
        const count = data.results?.length || 0;

        if (count > 0) {
          const tileBounds = [{ lat: tile.south, lng: tile.west }, { lat: tile.north, lng: tile.east }];
          const enriched = data.results.map(obj => {
            if (!obj.segmentation || obj.segmentation.length < 3) return null;
            const raw = pixelsToLatLng(obj.segmentation);
            if (!raw || raw.length < 3) return null;
            // FIX: clip to tile bounds
            const clipped = clipPolygonToBounds(raw, tileBounds);
            if (!clipped || clipped.length < 3) return null;
            return { ...obj, tile_id: tile.id, _tile: tile, scanLat, scanLng, captureSize, polygonLatLng: clipped };
          }).filter(Boolean);
          allResults.push(...enriched);
          setPreviewResults(prev => [...prev, ...enriched]);
        }

        done++;
        updatedGrid[i] = { ...updatedGrid[i], status: count > 0 ? 'done' : 'empty', count };
        setTileGrid([...updatedGrid]);
        setTileStats({ total: grid.length, done, objects: allResults.length });
        if (done % 5 === 0 || done === grid.length)
          toast.loading(`${done}/${grid.length} · ${allResults.length} obj`, { id: scanToast });

      } catch (err) {
        console.error(`Tile ${i} error:`, err);
        done++;
        updatedGrid[i] = { ...updatedGrid[i], status: 'error' };
        setTileGrid([...updatedGrid]);
        setTileStats(prev => ({ ...prev, done }));
      }
    }

    setScanningTileIdx(-1); setIsScanning(false);
    // FIX: re-enable map after tile scan
    if (mapRef?.current) {
      mapRef.current.dragging.enable();
      mapRef.current.scrollWheelZoom.enable();
    }
    toast[abortRef.current ? 'error' : 'success'](
      abortRef.current
        ? 'Scan dihentikan.'
        : allResults.length > 0
          ? `Selesai — ${allResults.length} obj · ${grid.length} tile`
          : 'Selesai — tidak ada objek.',
      { id: scanToast, duration: 4000 }
    );
  };

  const handleStartScan = () => {
    if (isDirectMode) handleDirectScan();
    else handleStartTileScan();
  };

  const handlePauseResume = () => {
    const n = !isPaused; setIsPaused(n); pauseRef.current = n;
    toast(n ? '⏸ Dijeda' : '▶ Dilanjutkan', { duration: 1500 });
  };

  const handleSaveAll = async () => {
    if (!previewResults.length) { toast.error('Tidak ada hasil'); return; }
    setIsSaving(true);
    const t = toast.loading(`Menyimpan ${previewResults.length} objek...`);
    try {
      const features = previewResults.filter(o => o.polygonLatLng?.length >= 3).map(obj => {
        let polygon_coords;
        if (isDirectMode || obj.tile_id === 'direct') {
          const map     = mapRef.current;
          const cPixel  = map.latLngToContainerPoint([obj.lat, obj.lng]);
          const half    = (obj.capture_size || CAPTURE_PX) / 2;
          const wktPts  = obj.segmentation.map(pt => {
            const ll = map.containerPointToLatLng([cPixel.x + (pt[0] - half), cPixel.y + (pt[1] - half)]);
            return `${ll.lng} ${ll.lat}`;
          });
          wktPts.push(wktPts[0]);
          polygon_coords = wktPts.join(', ');
        } else {
          const wkt = obj.polygonLatLng.map(([lat, lng]) => `${lng} ${lat}`);
          wkt.push(wkt[0]);
          polygon_coords = wkt.join(', ');
        }
        return {
          nama: obj.kategori, kategori: obj.kategori, confidence_score: obj.confidence_score,
          polygon_coords,
          metadata: {
            capture_size: CAPTURE_PX, zoom_level: CAPTURE_ZOOM,
            timestamp: new Date().toISOString(),
            luas_m2: obj.luas_m2, tile_id: obj.tile_id,
            ...(isDirectMode ? { scan_mode: 'direct_area_scan' } : { tile_size_m: TILE_METER, scan_mode: scanMode === 'kabupaten' ? 'kabupaten_scan' : 'area_tile_scan' }),
            ...(selectedKabupaten ? { kabupaten: selectedKabupaten.properties?.name || selectedKabupaten.properties?.NAMOBJ || '' } : {}),
          },
        };
      });
      const res = await axios.post('http://127.0.0.1:8000/api/save-detection/', { features });
      if (res.status === 201) {
        toast.success(`${features.length} objek disimpan`, { id: t, duration: 3000 });
        if (onNewData) onNewData();
        handleReset();
      }
    } catch (err) {
      toast.error(`Gagal: ${err.response?.data?.message || err.message}`, { id: t });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    abortRef.current = true;
    setIsScanning(false); setIsPaused(false); setIsDrawingArea(false);
    setScanningTileIdx(-1); setDrawnBounds(null); setTileGrid([]); setPreviewResults([]);
    setTileStats({ total: 0, done: 0, objects: 0 }); setStep('draw');
    setSelectedKabupaten(null); setIsKabupatenClickMode(false); setShowAnalysis(false);
    setDirectScanningActive(false);
    // FIX: always restore map controls on reset
    if (mapRef?.current) {
      mapRef.current.dragging.enable();
      mapRef.current.scrollWheelZoom.enable();
    }
  };

  const progress = tileStats.total > 0 ? Math.round((tileStats.done / tileStats.total) * 100) : 0;
  const kabName  = selectedKabupaten?.properties?.name || selectedKabupaten?.properties?.NAMOBJ || selectedKabupaten?.properties?.KAB_KOTA || '';

  return (
    <div
      className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
      onWheel={e => e.stopPropagation()}
    >
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
          {isScanning && (
            <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[9px] font-black text-cyan-500 uppercase">AKTIF</span>
            </div>
          )}
          {/* FIX: close button */}
          {!isScanning && onClose && (
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors text-slate-400"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {/* Step tabs */}
        <div className="flex gap-1 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {SCAN_MODES.map(mode => {
            const Icon   = mode.icon;
            const active = step === mode.id;
            const done   = (mode.id === 'draw' && activeBounds) || (mode.id === 'scan' && isScanning);
            return (
              <button key={mode.id} onClick={() => !isScanning && setStep(mode.id)} disabled={isScanning}
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
                { id: 'manual-direct', label: 'Direct',     icon: Scan,   desc: '1x capture'   },
                { id: 'manual-tile',   label: 'Tile Grid',  icon: Grid,   desc: 'Grid per area' },
                { id: 'kabupaten',     label: 'Kabupaten',  icon: MapPin, desc: 'Batas wilayah' },
              ].map(m => (
                <button key={m.id}
                  onClick={() => {
                    setScanMode(m.id);
                    if (m.id !== 'kabupaten') { setSelectedKabupaten(null); setIsKabupatenClickMode(false); }
                    if (m.id !== 'manual-direct' && m.id !== 'manual-tile') { setIsDrawingArea(false); setDrawnBounds(null); }
                  }}
                  className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wide flex flex-col items-center gap-0.5 transition-all ${
                    scanMode === m.id
                      ? m.id === 'kabupaten'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                  <m.icon size={11} />
                  {m.label}
                  <span className={`text-[7px] font-medium ${scanMode === m.id ? 'opacity-80' : 'text-slate-400'}`}>{m.desc}</span>
                </button>
              ))}
            </div>

            {/* Direct / Tile modes */}
            {(scanMode === 'manual-direct' || scanMode === 'manual-tile') && (
              <>
                {scanMode === 'manual-direct' && (
                  <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 flex items-start gap-2">
                    <Zap size={12} className="text-violet-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-violet-700 dark:text-violet-400 font-medium">Mode Direct: area scan 1x capture tanpa tile. Cocok untuk area kecil.</p>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (isScanning) return;
                    if (isDrawingArea) { setIsDrawingArea(false); setDrawnBounds(null); }
                    else setIsDrawingArea(true);
                  }}
                  disabled={isScanning}
                  className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                    isDrawingArea
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-md shadow-cyan-500/20'
                  }`}>
                  {isDrawingArea ? <><X size={15} /> Batal</> : <><Square size={15} /> Gambar Area</>}
                </button>

                {isDrawingArea && !isScanning && (
                  <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700/40 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center flex-shrink-0 animate-pulse">
                      <MousePointer2 size={10} className="text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400">Klik & drag di peta</p>
                      <p className="text-[9px] text-cyan-600/70">Tentukan area scan</p>
                    </div>
                  </div>
                )}

                {drawnBounds && !isScanning && (
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={11} className="text-green-600" />
                      <span className="text-[10px] font-bold text-green-700 dark:text-green-400">Area ditandai</span>
                    </div>
                    {scanMode === 'manual-tile' && (
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-white dark:bg-green-900/30 rounded-lg p-2 text-center">
                          <div className="text-sm font-black text-green-700 dark:text-green-400">{estTiles.toLocaleString()}</div>
                          <div className="text-[8px] text-slate-500 uppercase font-bold">Tile</div>
                        </div>
                        <div className="bg-white dark:bg-green-900/30 rounded-lg p-2 text-center">
                          <div className="text-sm font-black text-green-700 dark:text-green-400">{estMinutes}</div>
                          <div className="text-[8px] text-slate-500 uppercase font-bold">Est.</div>
                        </div>
                      </div>
                    )}
                    <button onClick={() => setStep('scan')} className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2">
                      Konfigurasi <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Kabupaten mode */}
            {scanMode === 'kabupaten' && (
              <div className="space-y-3">
                <KabupatenSearchPanel
                  kabupatenList={kabupatenList}
                  selectedKabupaten={selectedKabupaten}
                  onSelect={handleSelect}
                  isLoading={kabupatenLoading}
                />

                <button
                  onClick={() => setIsKabupatenClickMode(v => !v)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border-2 ${
                    isKabupatenClickMode
                      ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'
                  }`}>
                  {isKabupatenClickMode
                    ? <><div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> Klik wilayah aktif</>
                    : <><Map size={13} /> Klik Wilayah di Peta</>}
                </button>

                {selectedKabupaten ? (
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
                        <MapPin size={13} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</p>
                        <p className="text-[9px] text-teal-600/70 truncate">{selectedKabupaten.properties?.provinsi || selectedKabupaten.properties?.PROPINSI || ''}</p>
                      </div>
                      <button onClick={() => handleSelect(null)} className="text-teal-400 hover:text-red-400"><X size={11} /></button>
                    </div>
                    {activeBounds && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-white dark:bg-teal-900/30 rounded-lg p-2 text-center">
                          <div className="text-sm font-black text-teal-700 dark:text-teal-400">{estTiles.toLocaleString()}</div>
                          <div className="text-[8px] text-slate-500 uppercase font-bold">Tile</div>
                        </div>
                        <div className="bg-white dark:bg-teal-900/30 rounded-lg p-2 text-center">
                          <div className="text-sm font-black text-teal-700 dark:text-teal-400">{estMinutes}</div>
                          <div className="text-[8px] text-slate-500 uppercase font-bold">Est.</div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setStep('scan')}
                      disabled={estTiles === 0}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 disabled:from-slate-400 disabled:to-slate-500 text-white text-xs font-bold flex items-center justify-center gap-2">
                      Konfigurasi <ChevronRight size={13} />
                    </button>
                  </div>
                ) : !kabupatenLoading && (
                  <div className="py-5 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
                      <MapPin size={18} className="text-slate-400" />
                    </div>
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
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Konfigurasi</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: 'Zoom',      v: `z${CAPTURE_ZOOM}` },
                  { l: 'Resolusi',  v: `${CAPTURE_PX}px`  },
                  ...(isDirectMode
                    ? [{ l: 'Mode', v: 'Direct' }, { l: 'Est.', v: estMinutes }]
                    : [{ l: 'Tile',  v: `${TILE_METER}m` }, { l: 'Jumlah', v: estTiles.toLocaleString() }, { l: 'Est.', v: estMinutes }, { l: 'Mode', v: scanMode === 'kabupaten' ? 'Kab. Clip' : 'Grid' }]
                  ),
                ].map(item => (
                  <div key={item.l} className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-2 text-center">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-200">{item.v}</div>
                    <div className="text-[8px] text-slate-400 mt-0.5 uppercase font-bold">{item.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kategori</p>
                <span className="text-[9px] text-slate-400">{selectedCats.length}/{CATEGORIES.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ id, label, color, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])}
                    className={`p-2.5 rounded-xl border-2 transition-all font-bold text-xs flex items-center gap-2 ${
                      selectedCats.includes(id)
                        ? 'text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                    style={selectedCats.includes(id) ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <Icon size={13} /> <span>{label}</span>
                    {selectedCats.includes(id) && <CheckCircle2 size={10} className="ml-auto opacity-80" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartScan}
              disabled={!activeBounds || !selectedCats.length || (!isDirectMode && estTiles === 0)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-bold shadow-md disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Play size={15} />
              {isDirectMode ? 'Scan Langsung' : `Scan (${estTiles.toLocaleString()} tile)`}
            </button>
          </>
        )}

        {/* ── STEP: HASIL ── */}
        {step === 'result' && (
          <>
            {scanMode === 'kabupaten' && kabName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
                <MapPin size={10} className="text-teal-500" />
                <span className="text-[11px] font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</span>
              </div>
            )}

            {/* Analysis panel toggle */}
            {!isScanning && previewResults.length > 0 && (
              <>
                <button
                  onClick={() => setShowAnalysis(v => !v)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border-2 ${
                    showAnalysis
                      ? 'bg-white dark:bg-slate-800 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                      : 'bg-cyan-500/5 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:border-cyan-500/60'
                  }`}>
                  <BarChart2 size={12} />
                  {showAnalysis ? 'Sembunyikan Analisis' : `Analisis (${previewResults.length} obj)`}
                  {showAnalysis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showAnalysis && (
                  <AnalysisPanel
                    results={previewResults}
                    tileGrid={tileGrid}
                    tileStats={tileStats}
                    scanMode={scanMode}
                    kabupatenName={kabName}
                    isDirectScan={isDirectMode}
                  />
                )}
              </>
            )}

            {/* Progress */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {isDirectMode ? 'Status' : 'Progress'}
                </span>
                {!isDirectMode && <span className="text-xs font-black text-cyan-600">{progress}%</span>}
                {isDirectMode && (
                  <span className={`text-xs font-black ${isScanning ? 'text-cyan-500' : previewResults.length > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                    {isScanning ? 'Proses...' : previewResults.length > 0 ? 'Selesai' : '—'}
                  </span>
                )}
              </div>
              {!isDirectMode && (
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {isDirectMode && isScanning && (
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full animate-pulse w-full" />
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: isDirectMode ? (isScanning ? '...' : '1') : tileStats.total,                    l: isDirectMode ? 'Capture' : 'Total',  c: 'text-slate-700 dark:text-slate-200' },
                  { v: isDirectMode ? (previewResults.length > 0 ? '1' : '0') : tileStats.done,        l: 'Selesai', c: 'text-green-600 dark:text-green-400' },
                  { v: isDirectMode ? previewResults.length : tileStats.objects,                        l: 'Objek',   c: 'text-amber-600 dark:text-amber-400' },
                ].map(s => (
                  <div key={s.l} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700">
                    <div className={`text-base font-black ${s.c}`}>{s.v}</div>
                    <div className="text-[8px] text-slate-400 font-black uppercase">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scan controls (tile mode only) */}
            {isScanning && !isDirectMode && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePauseResume}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    isPaused
                      ? 'bg-cyan-500 text-white'
                      : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}>
                  {isPaused ? <><Play size={12} /> Lanjut</> : <><Pause size={12} /> Jeda</>}
                </button>
                <button
                  onClick={() => { abortRef.current = true; setIsScanning(false); }}
                  className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800">
                  <Square size={12} /> Stop
                </button>
              </div>
            )}

            {/* Tile list */}
            {!isDirectMode && tileGrid.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700">
                <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">Tile ({tileGrid.length})</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {tileGrid.map((tile, idx) => (
                    <div
                      key={tile.id}
                      className={`flex items-center gap-2 p-1.5 rounded-lg text-[10px] transition-all ${
                        idx === scanningTileIdx
                          ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800'
                          : 'bg-slate-50 dark:bg-slate-700/50'
                      }`}>
                      <span className="font-mono text-slate-400 w-7 text-right">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="flex-1 text-slate-500 dark:text-slate-400">R{tile.row + 1}C{tile.col + 1}</span>
                      {tile.count > 0 && <span className="font-bold text-green-600">{tile.count}</span>}
                      <StatusBadge status={tile.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save / cancel */}
            {!isScanning && previewResults.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleSaveAll} disabled={isSaving}
                  className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5">
                  <Save size={12} /> {isSaving ? 'Menyimpan...' : `Simpan (${previewResults.length})`}
                </button>
                <button onClick={handleReset}
                  className="py-2.5 rounded-xl bg-white dark:bg-slate-700 text-red-500 text-xs font-black flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-800">
                  <Trash2 size={12} /> Batal
                </button>
              </div>
            )}

            {!isScanning && (
              <button onClick={handleReset}
                className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:border-red-300 hover:text-red-500 transition-all">
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30 flex items-center justify-between">
        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-medium">
          {isDirectMode
            ? `Direct · z${CAPTURE_ZOOM}${kabName ? ' · ' + kabName : ''}`
            : tileGrid.length > 0
              ? `${tileGrid.length} tile · ${TILE_METER}m · z${CAPTURE_ZOOM}${kabName ? ' · ' + kabName : ''}`
              : scanMode === 'kabupaten'
                ? `Kab · ${TILE_METER}m · z${CAPTURE_ZOOM}`
                : `Tile · z${CAPTURE_ZOOM}`
          }
        </p>
        {(activeBounds || tileGrid.length > 0) && !isScanning && (
          <button onClick={handleReset} className="text-[10px] text-red-400 hover:text-red-600 font-bold flex items-center gap-1">
            <Trash2 size={9} /> Reset
          </button>
        )}
      </div>

      <SummaryPanel
        results={previewResults}
        tileStats={tileStats}
        onSave={handleSaveAll}
        onCancel={handleReset}
        isSaving={isSaving}
        isScanning={isScanning}
        isDirectMode={isDirectMode}
      />
    </div>
  );
}