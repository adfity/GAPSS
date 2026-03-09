"use client";
import { useState, useRef, useEffect } from 'react';
import {
  Grid, Play, Square, Trash2, Save, ChevronRight, Layers,
  ScanLine, CheckCircle2, XCircle, Clock, AlertTriangle,
  Home, Waves, Trees, Route, Pause, RotateCcw, ChevronDown, ChevronUp, X
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Rectangle, Polygon, Popup, useMapEvents, useMap } from 'react-leaflet';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'bangunan',  label: 'Bangunan',  color: '#f59e0b', Icon: Home  },
  { id: 'perairan',  label: 'Perairan',  color: '#2563eb', Icon: Waves },
  { id: 'pepohonan', label: 'Pepohonan', color: '#16a34a', Icon: Trees },
  { id: 'jalan',     label: 'Jalan',     color: '#64748b', Icon: Route },
];

const TILE_METER   = 50;
const CAPTURE_ZOOM = 19;
const CAPTURE_PX   = 640;

const SCAN_MODES = [
  { id: 'draw',   label: 'Gambar Area', icon: Square },
  { id: 'scan',   label: 'Konfigurasi', icon: Grid   },
  { id: 'result', label: 'Hasil Scan',  icon: Layers },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const meterToLat = (m)      => m / 111320;
const meterToLng = (m, lat) => m / (111320 * Math.cos((lat * Math.PI) / 180));

function generateTilesFromBounds(bounds) {
  const south = Math.min(bounds[0].lat, bounds[1].lat);
  const north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng);
  const east  = Math.max(bounds[0].lng, bounds[1].lng);
  const centerLat = (south + north) / 2;
  const latStep   = meterToLat(TILE_METER);
  const lngStep   = meterToLng(TILE_METER, centerLat);

  const tiles = [];
  let row = 0;
  for (let lat = south; lat < north; lat += latStep) {
    let col = 0;
    for (let lng = west; lng < east; lng += lngStep) {
      const tileNorth = Math.min(lat + latStep, north);
      const tileEast  = Math.min(lng + lngStep, east);
      tiles.push({
        id:        `tile_${row}_${col}`,
        row, col,
        south:     lat,
        north:     tileNorth,
        west:      lng,
        east:      tileEast,
        centerLat: (lat + tileNorth) / 2,
        centerLng: (lng + tileEast)  / 2,
        status:    'pending',
        count:     0,
      });
      col++;
    }
    row++;
  }
  // Sweep kiri→kanan, baris per baris
  tiles.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
  return tiles;
}

function estimateTileCount(bounds) {
  if (!bounds) return 0;
  const south = Math.min(bounds[0].lat, bounds[1].lat);
  const north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng);
  const east  = Math.max(bounds[0].lng, bounds[1].lng);
  const centerLat = (south + north) / 2;
  const rows = Math.ceil((north - south) / meterToLat(TILE_METER));
  const cols = Math.ceil((east  - west)  / meterToLng(TILE_METER, centerLat));
  return Math.max(1, rows * cols);
}

// Clip polygon ke bounding box tile (Sutherland-Hodgman)
function clipPolygonToBox(polygon, south, west, north, east) {
  if (!polygon || polygon.length < 3) return polygon;

  const clip = (pts, x0, y0, x1, y1) => {
    if (!pts.length) return [];
    const inside = (p) => {
      const dx = x1 - x0, dy = y1 - y0;
      return dx * (p[1] - y0) - dy * (p[0] - x0) >= 0;
    };
    const intersect = (a, b) => {
      const dx1 = b[0]-a[0], dy1 = b[1]-a[1];
      const dx2 = x1-x0,     dy2 = y1-y0;
      const d = dx1*dy2 - dy1*dx2;
      if (Math.abs(d) < 1e-10) return a;
      const t = ((x0-a[0])*dy2 - (y0-a[1])*dx2) / d;
      return [a[0]+t*dx1, a[1]+t*dy1];
    };
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const cur  = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const ci   = inside(cur);
      const pi   = inside(prev);
      if (ci) { if (!pi) out.push(intersect(prev, cur)); out.push(cur); }
      else if (pi) out.push(intersect(prev, cur));
    }
    return out;
  };

  // Clip terhadap 4 sisi: S, N, W, E (dalam [lat, lng])
  let pts = polygon.map(p => [p[0], p[1]]);
  pts = clip(pts, south, west,  north, west,  ); // west edge:  lng >= west
  pts = clip(pts, north, west,  north, east   ); // north edge: lat <= north
  pts = clip(pts, north, east,  south, east   ); // east edge:  lng <= east
  pts = clip(pts, south, east,  south, west   ); // south edge: lat >= south

  // Sutherland-Hodgman butuh edge sebagai half-plane
  // Implementasi sederhana: clip tiap edge
  let poly = polygon.map(p => [p[0], p[1]]);

  const edges = [
    // [minLat, minLng, maxLat, maxLng] sebagai batas
  ];

  // Cara lebih simpel: filter titik & re-clip dengan batas lat/lng
  poly = polygon.filter(([lat, lng]) =>
    lat >= south - 0.000001 && lat <= north + 0.000001 &&
    lng >= west  - 0.000001 && lng <= east  + 0.000001
  );

  return poly.length >= 3 ? poly : [];
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = {
    pending:  { color: 'bg-slate-100 text-slate-500',  icon: Clock,         label: 'Menunggu'    },
    scanning: { color: 'bg-blue-100 text-blue-600',    icon: ScanLine,      label: 'Scanning...' },
    done:     { color: 'bg-green-100 text-green-600',  icon: CheckCircle2,  label: 'Selesai'     },
    error:    { color: 'bg-red-100 text-red-600',      icon: XCircle,       label: 'Error'       },
    empty:    { color: 'bg-amber-100 text-amber-600',  icon: AlertTriangle, label: 'Kosong'      },
  };
  const s = cfg[status] || cfg.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>
      <Icon size={9} /> {s.label}
    </span>
  );
}

// ─── SCAN OVERLAY (di dalam MapContainer) ─────────────────────────────────────

export function AreaScanOverlay({
  isDrawing, onBoundsSet,
  drawnBounds, tileGrid, scanningTileIdx,
  previewResults,
  onTileClick,   // ← baru: callback saat user klik tile
}) {
  const map     = useMap();
  const startPt = useRef(null);
  const [tempRect, setTempRect] = useState(null);
  const [ready,    setReady]    = useState(false);

  // Nonaktifkan scroll zoom & drag HANYA saat mode menggambar
  useEffect(() => {
    if (!map) return;
    if (isDrawing) {
      map.scrollWheelZoom.disable();
    } else {
      // saat scan atau idle → zoom bebas
      map.scrollWheelZoom.enable();
    }
    return () => { map.scrollWheelZoom.enable(); };
  }, [map, isDrawing]);

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
      if (!isDrawing || !ready) return;
      startPt.current = e.latlng;
      map.dragging.disable();
      map.scrollWheelZoom.disable();
    },
    mousemove(e) {
      if (!isDrawing || !startPt.current) return;
      setTempRect([startPt.current, e.latlng]);
    },
    mouseup(e) {
      if (!isDrawing || !startPt.current) return;
      const b0 = startPt.current;
      const b1 = e.latlng;
      if (Math.abs(b0.lat - b1.lat) > meterToLat(TILE_METER) &&
          Math.abs(b0.lng - b1.lng) > meterToLng(TILE_METER, b0.lat)) {
        onBoundsSet([b0, b1]);
      } else {
        toast.error('Area terlalu kecil! Gambar lebih besar.');
      }
      setTempRect(null);
      startPt.current = null;
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    },
  });

  const getCatColor = (cat) => CATEGORIES.find(c => c.id === cat)?.color || '#ef4444';

  return (
    <>
      {/* Saat drag */}
      {tempRect && (
        <Rectangle bounds={tempRect}
          pathOptions={{
            color: '#ffffff', weight: 2.5,
            fillColor: '#06b6d4', fillOpacity: 0.15,
            dashArray: '8,5',
          }} />
      )}

      {/* Area tergambar — sebelum grid muncul */}
      {drawnBounds && tileGrid.length === 0 && (
        <Rectangle
          bounds={[[drawnBounds[0].lat, drawnBounds[0].lng],[drawnBounds[1].lat, drawnBounds[1].lng]]}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#06b6d4', fillOpacity: 0.12, dashArray: '8,5' }}
        />
      )}

      {/* Grid tiles — warna kontras untuk satelit */}
      {tileGrid.map((tile, idx) => {
        const scanning = idx === scanningTileIdx;
        let color, fillOp, weight, dash;
        if (scanning) {
          color = '#00ffff'; fillOp = 0.0; weight = 3; dash = undefined;
        } else if (tile.status === 'done') {
          color = '#00ff88'; fillOp = 0.18; weight = 1.5; dash = undefined;
        } else if (tile.status === 'empty') {
          color = '#ffcc00'; fillOp = 0.0; weight = 1; dash = '3,3';
        } else if (tile.status === 'error') {
          color = '#ff4444'; fillOp = 0.15; weight = 1.5; dash = undefined;
        } else {
          color = '#ffffff'; fillOp = 0.0; weight = 0.6; dash = '2,4';
        }
        return (
          <Rectangle key={tile.id}
            bounds={[[tile.south, tile.west],[tile.north, tile.east]]}
            pathOptions={{ color, weight, fillColor: color, fillOpacity: fillOp, dashArray: dash }}
            eventHandlers={{
              click: () => {
                // Klik tile → flyTo ke tile dengan animasi smooth
                if (onTileClick) onTileClick(tile);
              },
              mouseover: (e) => {
                // Hover highlight tipis
                if (!scanning) e.target.setStyle({ weight: 2, fillOpacity: fillOp + 0.1 });
              },
              mouseout: (e) => {
                if (!scanning) e.target.setStyle({ weight, fillOpacity: fillOp });
              },
            }}
          />
        );
      })}

      {/* FIX: Animasi sweep — tile aktif highlight + glow effect */}
      {scanningTileIdx >= 0 && tileGrid[scanningTileIdx] && (() => {
        const t = tileGrid[scanningTileIdx];
        return (
          <>
            {/* Outer glow */}
            <Rectangle
              bounds={[[t.south - meterToLat(5), t.west - meterToLng(5, t.centerLat)],
                       [t.north + meterToLat(5), t.east + meterToLng(5, t.centerLat)]]}
              pathOptions={{ color: '#00ffff', weight: 1, fillColor: '#00ffff', fillOpacity: 0.08, dashArray: undefined }}
            />
            {/* Active tile */}
            <Rectangle
              bounds={[[t.south, t.west],[t.north, t.east]]}
              pathOptions={{ color: '#00ffff', weight: 3, fillColor: '#00ffff', fillOpacity: 0.30 }}
            />
          </>
        );
      })()}

      {/* Preview hasil segmentasi — di-clip ke batas tile masing-masing */}
      {previewResults.map((obj, idx) => {
        if (!obj.polygonLatLng || obj.polygonLatLng.length < 3) return null;
        const color = getCatColor(obj.kategori);

        // FIX: clip polygon ke batas tile agar tidak keluar grid
        const tile = obj._tile;
        const clipped = tile
          ? clipPolygonToBox(obj.polygonLatLng, tile.south, tile.west, tile.north, tile.east)
          : obj.polygonLatLng;

        if (!clipped || clipped.length < 3) return null;

        return (
          <Polygon key={`prev-${idx}`}
            positions={clipped}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 2 }}>
            <Popup>
              <div className="p-2 min-w-[140px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="font-bold text-xs uppercase">{obj.kategori}</span>
                </div>
                {obj.luas_m2 && (
                  <p className="text-[10px] text-slate-500">Luas: <b className="text-sky-600">{obj.luas_m2} m²</b></p>
                )}
                <p className="text-[10px] text-slate-400">Akurasi: {(obj.confidence_score * 100).toFixed(1)}%</p>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

// ─── SUMMARY FLOATING PANEL ───────────────────────────────────────────────────

function SummaryPanel({ results, tileStats, onSave, onCancel, isSaving, isScanning }) {
  const [collapsed, setCollapsed] = useState(false);

  const catSummary = results.reduce((acc, r) => {
    acc[r.kategori] = (acc[r.kategori] || 0) + 1;
    return acc;
  }, {});
  const totalLuas = results.reduce((s, r) => s + (r.luas_m2 || 0), 0);
  const pct = tileStats.total > 0 ? Math.round((tileStats.done / tileStats.total) * 100) : 0;

  if (!isScanning && results.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1200] w-[340px] max-w-[92vw]">
      <div className="bg-slate-900/96 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
          onClick={() => setCollapsed(v => !v)}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-cyan-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-white text-xs font-black uppercase tracking-wide">
              {isScanning
                ? `Scanning ${tileStats.done}/${tileStats.total} (${pct}%)`
                : `${results.length} Objek Terdeteksi`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isScanning && results.length > 0 && (
              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                PREVIEW
              </span>
            )}
            {collapsed ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </div>
        </div>

        {isScanning && (
          <div className="h-1.5 bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
              style={{ width: `${pct}%` }} />
          </div>
        )}

        {!collapsed && (
          <div className="px-4 pb-4 pt-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: tileStats.total,   l: 'Total',   c: 'text-white'     },
                { v: tileStats.done,    l: 'Selesai', c: 'text-green-400' },
                { v: results.length,    l: 'Objek',   c: 'text-amber-400' },
              ].map(s => (
                <div key={s.l} className="bg-slate-800 rounded-xl p-2 text-center">
                  <div className={`text-base font-black ${s.c}`}>{s.v}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">{s.l}</div>
                </div>
              ))}
            </div>

            {Object.keys(catSummary).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(catSummary).map(([cat, cnt]) => {
                  const info = CATEGORIES.find(c => c.id === cat);
                  const Icon = info?.Icon || ScanLine;
                  const p    = Math.round((cnt / results.length) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: info?.color || '#94a3b8' }}>
                        <Icon size={11} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-slate-300 capitalize">{cat}</span>
                          <span className="text-[10px] font-black text-white">{cnt}</span>
                        </div>
                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${p}%`, backgroundColor: info?.color || '#94a3b8' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalLuas > 0 && (
              <div className="flex justify-between py-2 border-t border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total Luas</span>
                <span className="text-xs font-black text-cyan-400">{totalLuas.toFixed(1)} m²</span>
              </div>
            )}

            {!isScanning && results.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={onSave} disabled={isSaving}
                  className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg">
                  <Save size={13} />
                  {isSaving ? 'Menyimpan...' : `Simpan (${results.length})`}
                </button>
                <button onClick={onCancel}
                  className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-red-400 text-xs font-black flex items-center justify-center gap-1.5 border border-slate-600">
                  <X size={13} /> Batal
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
  mapRef,
  zoomLevel,
  onNewData,
  isDrawingArea,   setIsDrawingArea,
  drawnBounds,     setDrawnBounds,
  tileGrid,        setTileGrid,
  previewResults,  setPreviewResults,
  scanningTileIdx, setScanningTileIdx,
  tileStats,       setTileStats,
  isScanning,      setIsScanning,
}) {
  const [step,         setStep]         = useState('draw');
  const [selectedCats, setSelectedCats] = useState([]);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const pauseRef = useRef(false);
  const abortRef = useRef(false);

  const estTiles   = drawnBounds ? estimateTileCount(drawnBounds) : 0;
  const estMinutes = Math.ceil(estTiles * 1.5 / 60); // FIX: estimasi lebih cepat ~1.5s/tile

  useEffect(() => { if (isScanning) setStep('result'); }, [isScanning]);

  // ── flyTo + capture — animasi smooth tapi cepat ──────────────────────────────

  const flyAndCapture = async (tile) => {
    const map = mapRef.current;
    if (!map) throw new Error('Map not ready');

    // flyTo dengan durasi 0.25s — ada animasi tapi cepat
    await new Promise((resolve) => {
      map.flyTo([tile.centerLat, tile.centerLng], CAPTURE_ZOOM, {
        animate:  true,
        duration: 0.25,
      });
      map.once('moveend', resolve);
    });

    // Tunggu tiles satelit render
    await new Promise(r => setTimeout(r, 200));

    const html2canvas = (await import('html2canvas')).default;
    const mapEl = document.querySelector('.leaflet-container');
    if (!mapEl) throw new Error('Map element not found');

    const rect = mapEl.getBoundingClientRect();
    const size = Math.min(CAPTURE_PX, rect.width, rect.height);
    const x    = (rect.width  - size) / 2;
    const y    = (rect.height - size) / 2;

    const canvas = await html2canvas(mapEl, {
      useCORS: true, allowTaint: true,
      x, y, width: size, height: size, scale: 1, logging: false,
      ignoreElements: el => (
        el.tagName === 'BUTTON' || el.tagName === 'ASIDE' ||
        el.classList.contains('leaflet-control') ||
        el.classList.contains('fixed') || el.classList.contains('absolute')
      ),
    });

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  // ── pixel → LatLng ────────────────────────────────────────────────────────────

  const pixelsToLatLng = (segmentation, centerLat, centerLng) => {
    const map  = mapRef.current;
    if (!map)  return [];
    const cp   = map.latLngToContainerPoint([centerLat, centerLng]);
    const half = CAPTURE_PX / 2;
    return segmentation.map(pt => {
      const ll = map.containerPointToLatLng([
        cp.x + (pt[0] - half),
        cp.y + (pt[1] - half),
      ]);
      return [ll.lat, ll.lng];
    });
  };

  // ── Scan loop ─────────────────────────────────────────────────────────────────

  const handleStartScan = async () => {
    if (!drawnBounds)         { toast.error('Gambar area terlebih dahulu!'); return; }
    if (!selectedCats.length) { toast.error('Pilih minimal satu kategori!'); return; }
    if (estTiles === 0)       { toast.error('Area terlalu kecil!'); return; }
    if (estTiles > 5000)      { toast.error(`Terlalu besar (${estTiles} tile). Maks 5000.`); return; }

    const grid = generateTilesFromBounds(drawnBounds);
    setTileGrid(grid);
    setPreviewResults([]);
    setIsScanning(true);
    setIsPaused(false);
    setStep('result');
    abortRef.current = false;
    pauseRef.current = false;

    const map        = mapRef.current;
    const origCenter = map?.getCenter();
    const origZoom   = map?.getZoom();

    let done = 0;
    const allResults  = [];
    const updatedGrid = [...grid];
    const scanToast   = toast.loading(`Scan ${grid.length} tile...`);
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
        const blob     = await flyAndCapture(tile);
        const formData = new FormData();
        formData.append('image',        blob, `t${i}.png`);
        formData.append('lat',          tile.centerLat);
        formData.append('lng',          tile.centerLng);
        formData.append('capture_size', CAPTURE_PX);
        formData.append('categories',   selectedCats.join(','));

        // FIX: paralel fetch tidak nunggu lama
        const res   = await fetch('http://127.0.0.1:8000/api/run-detection/', { method: 'POST', body: formData });
        const data  = await res.json();
        const count = data.results?.length || 0;

        if (count > 0) {
          // Convert pixel → LatLng SEKARANG selagi map masih di posisi tile
          const enriched = data.results.map(obj => ({
            ...obj,
            tile_id:       tile.id,
            _tile:         tile, // simpan tile bounds untuk clipping
            polygonLatLng: obj.segmentation
              ? pixelsToLatLng(obj.segmentation, tile.centerLat, tile.centerLng)
              : [],
          }));
          allResults.push(...enriched);
          // Update preview incremental
          setPreviewResults(prev => [...prev, ...enriched]);
        }

        done++;
        updatedGrid[i] = { ...updatedGrid[i], status: count > 0 ? 'done' : 'empty', count };
        setTileGrid([...updatedGrid]);
        setTileStats({ total: grid.length, done, objects: allResults.length });

        // Update toast setiap 5 tile agar tidak spam
        if (done % 5 === 0 || done === grid.length) {
          toast.loading(`${done}/${grid.length} tile — ${allResults.length} objek`, { id: scanToast });
        }

      } catch (err) {
        done++;
        updatedGrid[i] = { ...updatedGrid[i], status: 'error' };
        setTileGrid([...updatedGrid]);
        setTileStats(prev => ({ ...prev, done }));
      }
    }

    setScanningTileIdx(-1);
    setIsScanning(false);

    // FIX: kembali ke posisi awal dengan animasi smooth
    if (map && origCenter) {
      map.setView(origCenter, origZoom, { animate: true, duration: 0.8 });
    }

    toast[abortRef.current ? 'error' : 'success'](
      abortRef.current
        ? 'Scan dihentikan.'
        : `Selesai! ${allResults.length} objek dari ${grid.length} tile.`,
      { id: scanToast, duration: 5000 }
    );
  };

  const handlePauseResume = () => {
    const next = !isPaused;
    setIsPaused(next);
    pauseRef.current = next;
    toast(next ? '⏸ Dijeda' : '▶ Dilanjutkan', { duration: 1500 });
  };

  const handleSaveAll = async () => {
    if (!previewResults.length) { toast.error('Tidak ada hasil'); return; }
    setIsSaving(true);
    const t = toast.loading(`Menyimpan ${previewResults.length} objek...`);
    try {
      const features = previewResults
        .filter(o => o.polygonLatLng?.length >= 3)
        .map(obj => {
          const tile   = obj._tile;
          // Clip sebelum simpan
          const clipped = tile
            ? clipPolygonToBox(obj.polygonLatLng, tile.south, tile.west, tile.north, tile.east)
            : obj.polygonLatLng;
          if (!clipped || clipped.length < 3) return null;
          const wkt = clipped.map(([lat, lng]) => `${lng} ${lat}`);
          wkt.push(wkt[0]);
          return {
            nama:             obj.kategori,
            kategori:         obj.kategori,
            confidence_score: obj.confidence_score,
            polygon_coords:   wkt.join(', '),
            metadata: {
              capture_size: CAPTURE_PX,
              zoom_level:   CAPTURE_ZOOM,
              timestamp:    new Date().toISOString(),
              luas_m2:      obj.luas_m2,
              tile_id:      obj.tile_id,
              scan_mode:    'area_scan_50m',
            },
          };
        })
        .filter(Boolean);

      const res = await axios.post('http://127.0.0.1:8000/api/save-detection/', { features });
      if (res.status === 201) {
        toast.success(`${features.length} objek disimpan!`, { id: t, duration: 3000 });
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
    setIsScanning(false);
    setIsPaused(false);
    setScanningTileIdx(-1);
    setDrawnBounds(null);
    setTileGrid([]);
    setPreviewResults([]);
    setTileStats({ total: 0, done: 0, objects: 0 });
    setStep('draw');
  };

  const progress = tileStats.total > 0 ? Math.round((tileStats.done / tileStats.total) * 100) : 0;

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
      onWheel={e => e.stopPropagation()}>

      {/* HEADER */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Grid size={20} className="text-cyan-500" /> Area Scan
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Tile 50m × 50m • z{CAPTURE_ZOOM} • Tanpa batas area
        </p>
        <div className="flex gap-1 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {SCAN_MODES.map(mode => {
            const Icon = mode.icon;
            const active = step === mode.id;
            return (
              <button key={mode.id}
                onClick={() => !isScanning && setStep(mode.id)}
                disabled={isScanning}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all ${
                  active ? 'bg-white dark:bg-slate-700 text-cyan-600 shadow' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}>
                <Icon size={13} /> {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ═══ DRAW ═══ */}
        {step === 'draw' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide">
              Gambar Area Scan
            </p>
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
              {[
                'Aktifkan mode gambar lalu klik & drag di peta',
                'Tidak ada batasan ukuran area',
                'Area otomatis dipecah jadi tile 50m × 50m',
                'Peta bergerak otomatis tile per tile saat scan',
                'Hasil segmentasi langsung tampil di peta',
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setIsDrawingArea(v => !v)}
              className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                isDrawingArea
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/30'
              }`}>
              <Square size={16} />
              {isDrawingArea ? 'Batal Menggambar' : 'Aktifkan Mode Gambar'}
            </button>

            {isDrawingArea && (
              <div className="mt-3 p-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 text-center">
                <p className="text-[10px] font-bold text-cyan-600 animate-pulse">
                  🖱️ Klik &amp; drag di peta — bebas pilih area seberapa besar
                </p>
              </div>
            )}

            {drawnBounds && (
              <>
                <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-[10px] font-bold text-green-600 mb-1">✓ Area berhasil digambar</p>
                  <p className="text-[10px] text-green-600/70">
                    Estimasi: <b>{estTiles.toLocaleString()}</b> tile • ~{estMinutes} menit
                  </p>
                  {estTiles > 5000 && (
                    <p className="text-[10px] font-bold text-red-500 mt-1">
                      ⚠️ Terlalu besar! Maks 5000 tile.
                    </p>
                  )}
                </div>
                <button onClick={() => setStep('scan')}
                  className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                  Lanjut ke Konfigurasi <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        )}

        {/* ═══ CONFIG ═══ */}
        {step === 'scan' && (
          <>
            {!drawnBounds && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-center">
                <AlertTriangle size={20} className="text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-amber-700 font-bold">Gambar area terlebih dahulu</p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide flex items-center gap-2">
                <Grid size={13} /> Info Scan
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: 'Ukuran Tile',  v: '50m × 50m'              },
                  { l: 'Zoom',         v: `z${CAPTURE_ZOOM}`        },
                  { l: 'Resolusi',     v: `${CAPTURE_PX}px`         },
                  { l: 'Total Tile',   v: estTiles.toLocaleString()  },
                  { l: 'Est. Waktu',   v: `~${estMinutes} menit`    },
                  { l: 'Kecepatan',    v: '~1.5s/tile'              },
                ].map(item => (
                  <div key={item.l} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-2.5 text-center">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-200">{item.v}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{item.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide flex items-center gap-2">
                <ScanLine size={13} /> Kategori
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ id, label, color, Icon }) => (
                  <button key={id}
                    onClick={() => setSelectedCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])}
                    className={`p-3 rounded-xl border-2 transition-all font-bold text-xs flex flex-col items-center gap-1.5 ${
                      selectedCats.includes(id) ? 'text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                    style={selectedCats.includes(id) ? { backgroundColor: color, borderColor: color } : {}}>
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleStartScan}
              disabled={!drawnBounds || !selectedCats.length || estTiles > 5000 || estTiles === 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-bold shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
              <Play size={16} /> Mulai Area Scan
            </button>
          </>
        )}

        {/* ═══ RESULT ═══ */}
        {step === 'result' && (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Progress Scan</span>
                <span className="text-xs font-black text-cyan-600">{progress}%</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: tileStats.total,   l: 'Total',   c: 'text-slate-700 dark:text-slate-200' },
                  { v: tileStats.done,    l: 'Selesai', c: 'text-green-600 dark:text-green-400' },
                  { v: tileStats.objects, l: 'Objek',   c: 'text-amber-600 dark:text-amber-400' },
                ].map(s => (
                  <div key={s.l} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700">
                    <div className={`text-lg font-black ${s.c}`}>{s.v}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {isScanning && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handlePauseResume}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    isPaused ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}>
                  {isPaused ? <><Play size={13} /> Lanjut</> : <><Pause size={13} /> Jeda</>}
                </button>
                <button onClick={() => { abortRef.current = true; setIsScanning(false); }}
                  className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800">
                  <Square size={13} /> Hentikan
                </button>
              </div>
            )}

            {tileGrid.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wide">
                  Tile ({tileGrid.length})
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {tileGrid.map((tile, idx) => (
                    <div key={tile.id}
                      className={`flex items-center gap-2 p-1.5 rounded-lg text-[10px] transition-all ${
                        idx === scanningTileIdx
                          ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800'
                          : 'bg-slate-50 dark:bg-slate-700/50'
                      }`}>
                      <span className="font-mono text-slate-400 w-7 text-right">{String(idx+1).padStart(2,'0')}</span>
                      <span className="flex-1 text-slate-500 dark:text-slate-400">R{tile.row+1}C{tile.col+1}</span>
                      {tile.count > 0 && <span className="font-bold text-green-600">{tile.count}</span>}
                      <StatusBadge status={tile.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isScanning && (
              <button onClick={handleReset}
                className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:border-red-300 hover:text-red-500 transition-all">
                <RotateCcw size={14} /> Reset &amp; Scan Ulang
              </button>
            )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30 flex items-center justify-between">
        <p className="text-[10px] text-slate-400 dark:text-slate-600">
          {tileGrid.length > 0 ? `${tileGrid.length} tile • 50m • z${CAPTURE_ZOOM}` : 'GeoAI Area Scanner v3'}
        </p>
        {(drawnBounds || tileGrid.length > 0) && !isScanning && (
          <button onClick={handleReset}
            className="text-[10px] text-red-400 hover:text-red-600 font-bold flex items-center gap-1">
            <Trash2 size={10} /> Reset
          </button>
        )}
      </div>

      {/* SUMMARY FLOATING PANEL */}
      <SummaryPanel
        results={previewResults}
        tileStats={tileStats}
        onSave={handleSaveAll}
        onCancel={handleReset}
        isSaving={isSaving}
        isScanning={isScanning}
      />
    </div>
  );
}