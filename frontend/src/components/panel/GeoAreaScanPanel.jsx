"use client";
import { useState, useRef, useEffect } from 'react';
import {
  Grid, Play, Square, Trash2, Save, ChevronRight, Layers,
  ScanLine, CheckCircle2, XCircle, Clock, AlertTriangle,
  Home, Waves, Trees, Route, Pause, RotateCcw, ChevronDown, ChevronUp, X,
  MousePointer2, Zap
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

const CAPTURE_ZOOM = 18;
const CAPTURE_PX   = 640;
const TILE_METER   = 150;
const YOLO_SIZE    = 640;

const SCAN_MODES = [
  { id: 'draw',   label: 'Area',        icon: Square },
  { id: 'scan',   label: 'Konfigurasi', icon: Grid   },
  { id: 'result', label: 'Hasil',       icon: Layers },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const meterToLat = (m)      => m / 111320;
const meterToLng = (m, lat) => m / (111320 * Math.cos((lat * Math.PI) / 180));

// ─── POLYGON CLIPPING (Sutherland-Hodgman) ────────────────────────────────────

function clipPolygonToTile(polygonLatLng, tile) {
  const south = tile.south;
  const north = tile.north;
  const west  = tile.west;
  const east  = tile.east;

  const latPad = (north - south) * 0.005;
  const lngPad = (east  - west)  * 0.005;
  const S = south - latPad;
  const N = north + latPad;
  const W = west  - lngPad;
  const E = east  + lngPad;

  const clip_edges = [
    { inside: ([lat]) => lat >= S, intersect: ([la, lo], [lb, lb2]) => {
        const t = (S - la) / (lb - la);
        return [S, lo + t * (lb2 - lo)];
    }},
    { inside: ([lat]) => lat <= N, intersect: ([la, lo], [lb, lb2]) => {
        const t = (N - la) / (lb - la);
        return [N, lo + t * (lb2 - lo)];
    }},
    { inside: ([,lng]) => lng >= W, intersect: ([la, lo], [lb, lb2]) => {
        const t = (W - lo) / (lb2 - lo);
        return [la + t * (lb - la), W];
    }},
    { inside: ([,lng]) => lng <= E, intersect: ([la, lo], [lb, lb2]) => {
        const t = (E - lo) / (lb2 - lo);
        return [la + t * (lb - la), E];
    }},
  ];

  let output = [...polygonLatLng];

  for (const edge of clip_edges) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const current  = input[i];
      const previous = input[(i - 1 + input.length) % input.length];
      if (edge.inside(current)) {
        if (!edge.inside(previous)) output.push(edge.intersect(previous, current));
        output.push(current);
      } else if (edge.inside(previous)) {
        output.push(edge.intersect(previous, current));
      }
    }
  }

  return output;
}

function generateTilesFromBounds(bounds, tileMeter = 150) {
  const south = Math.min(bounds[0].lat, bounds[1].lat);
  const north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng);
  const east  = Math.max(bounds[0].lng, bounds[1].lng);
  const centerLat = (south + north) / 2;
  const latStep   = meterToLat(tileMeter);
  const lngStep   = meterToLng(tileMeter, centerLat);
  const tiles = [];
  let row = 0;
  for (let lat = south; lat < north; lat += latStep) {
    let col = 0;
    for (let lng = west; lng < east; lng += lngStep) {
      const tileNorth = Math.min(lat + latStep, north);
      const tileEast  = Math.min(lng + lngStep, east);
      tiles.push({
        id: `tile_${row}_${col}`, row, col,
        south: lat, north: tileNorth,
        west: lng,  east: tileEast,
        centerLat: (lat + tileNorth) / 2,
        centerLng: (lng + tileEast)  / 2,
        status: 'pending', count: 0,
      });
      col++;
    }
    row++;
  }
  tiles.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
  return tiles;
}

function estimateTileCount(bounds, tileMeter = 150) {
  if (!bounds) return 0;
  const south = Math.min(bounds[0].lat, bounds[1].lat);
  const north = Math.max(bounds[0].lat, bounds[1].lat);
  const west  = Math.min(bounds[0].lng, bounds[1].lng);
  const east  = Math.max(bounds[0].lng, bounds[1].lng);
  const centerLat = (south + north) / 2;
  const rows = Math.ceil((north - south) / meterToLat(tileMeter));
  const cols = Math.ceil((east  - west)  / meterToLng(tileMeter, centerLat));
  return Math.max(1, rows * cols);
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

// ─── SCAN OVERLAY ─────────────────────────────────────────────────────────────

export function AreaScanOverlay({
  isActive,         // ✅ BARU: apakah panel areascan sedang aktif
  isDrawing, onBoundsSet, drawnBounds,
  tileGrid, scanningTileIdx, previewResults,
  onTileClick, isScanning,
}) {
  const map     = useMap();
  const startPt = useRef(null);
  const [tempRect, setTempRect] = useState(null);
  const [ready,    setReady]    = useState(false);
  const canDraw = isDrawing && !isScanning;

  useEffect(() => {
    if (!map) return;
    canDraw ? map.scrollWheelZoom.disable() : map.scrollWheelZoom.enable();
    return () => map.scrollWheelZoom.enable();
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
      if (Math.abs(b0.lat - b1.lat) > meterToLat(50) &&
          Math.abs(b0.lng - b1.lng) > meterToLng(50, b0.lat)) {
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

  // ✅ FIX: Jika panel tidak aktif, jangan render apapun
  if (!isActive) return null;

  return (
    <>
      {tempRect && (
        <Rectangle bounds={tempRect}
          pathOptions={{ color:'#fff', weight:2.5, fillColor:'#06b6d4', fillOpacity:0.15, dashArray:'8,5' }}/>
      )}

      {/* ✅ FIX: Hanya tampilkan drawnBounds jika tileGrid kosong DAN panel aktif */}
      {drawnBounds && tileGrid.length === 0 && (
        <Rectangle
          bounds={[[drawnBounds[0].lat, drawnBounds[0].lng],[drawnBounds[1].lat, drawnBounds[1].lng]]}
          pathOptions={{ color:'#fff', weight:2, fillColor:'#06b6d4', fillOpacity:0.12, dashArray:'8,5' }}
        />
      )}

      {tileGrid.map((tile, idx) => {
        const scanning = idx === scanningTileIdx;
        let color, fillOp, weight, dash;
        if (scanning)                   { color='#00ffff'; fillOp=0.0;  weight=3;   dash=undefined; }
        else if(tile.status==='done')   { color='#00ff88'; fillOp=0.08; weight=1;   dash=undefined; }
        else if(tile.status==='empty')  { color='#ffcc00'; fillOp=0.0;  weight=0.8; dash='3,3'; }
        else if(tile.status==='error')  { color='#ff4444'; fillOp=0.10; weight=1;   dash=undefined; }
        else                            { color='#ffffff'; fillOp=0.0;  weight=0.4; dash='2,4'; }
        return (
          <Rectangle key={tile.id}
            bounds={[[tile.south, tile.west],[tile.north, tile.east]]}
            pathOptions={{ color, weight, fillColor:color, fillOpacity:fillOp, dashArray:dash }}
            eventHandlers={{
              click:     () => { if (onTileClick && !isScanning) onTileClick(tile); },
              mouseover: (e) => { if (!scanning) e.target.setStyle({ weight:2, fillOpacity:fillOp+0.1 }); },
              mouseout:  (e) => { if (!scanning) e.target.setStyle({ weight, fillOpacity:fillOp }); },
            }}
          />
        );
      })}

      {scanningTileIdx >= 0 && tileGrid[scanningTileIdx] && (() => {
        const t = tileGrid[scanningTileIdx];
        return (
          <Rectangle bounds={[[t.south, t.west],[t.north, t.east]]}
            pathOptions={{ color:'#00ffff', weight:3, fillColor:'#00ffff', fillOpacity:0.20 }}
          />
        );
      })()}

      {previewResults.map((obj, idx) => {
        if (!obj.polygonLatLng || obj.polygonLatLng.length < 3) return null;
        const color = getCatColor(obj.kategori);
        return (
          <Polygon key={`prev-${idx}`}
            positions={obj.polygonLatLng}
            pathOptions={{ color, fillColor:color, fillOpacity:0.45, weight:2 }}>
            <Popup>
              <div className="p-2 min-w-[140px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background:color }}/>
                  <span className="font-bold text-xs uppercase">{obj.kategori}</span>
                </div>
                {obj.luas_m2 && (
                  <p className="text-[10px] text-slate-500">Luas: <b className="text-sky-600">{obj.luas_m2} m²</b></p>
                )}
                <p className="text-[10px] text-slate-400">Akurasi: {(obj.confidence_score*100).toFixed(1)}%</p>
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
  const catSummary = results.reduce((acc, r) => { acc[r.kategori]=(acc[r.kategori]||0)+1; return acc; }, {});
  const totalLuas  = results.reduce((s, r) => s + (r.luas_m2||0), 0);
  const pct = tileStats.total > 0 ? Math.round((tileStats.done/tileStats.total)*100) : 0;
  if (!isScanning && results.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1200] w-[340px] max-w-[92vw]">
      <div className="bg-slate-900/96 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
          onClick={() => setCollapsed(v=>!v)}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isScanning?'bg-cyan-400 animate-pulse':'bg-green-400'}`}/>
            <span className="text-white text-xs font-black uppercase tracking-wide">
              {isScanning ? `Scanning ${tileStats.done}/${tileStats.total} (${pct}%)` : `${results.length} Objek Terdeteksi`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isScanning && results.length>0 && (
              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">PREVIEW</span>
            )}
            {collapsed ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
          </div>
        </div>
        {isScanning && (
          <div className="h-1.5 bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{ width:`${pct}%` }}/>
          </div>
        )}
        {!collapsed && (
          <div className="px-4 pb-4 pt-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { v:tileStats.total, l:'Total',   c:'text-white'     },
                { v:tileStats.done,  l:'Selesai', c:'text-green-400' },
                { v:results.length,  l:'Objek',   c:'text-amber-400' },
              ].map(s => (
                <div key={s.l} className="bg-slate-800 rounded-xl p-2 text-center">
                  <div className={`text-base font-black ${s.c}`}>{s.v}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">{s.l}</div>
                </div>
              ))}
            </div>
            {Object.keys(catSummary).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(catSummary).map(([cat,cnt]) => {
                  const info = CATEGORIES.find(c=>c.id===cat);
                  const Icon = info?.Icon || ScanLine;
                  const p = Math.round((cnt/results.length)*100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor:info?.color||'#94a3b8' }}>
                        <Icon size={11}/>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-slate-300 capitalize">{cat}</span>
                          <span className="text-[10px] font-black text-white">{cnt}</span>
                        </div>
                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width:`${p}%`, backgroundColor:info?.color||'#94a3b8' }}/>
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
                  className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg">
                  <Save size={13}/> {isSaving?'Menyimpan...':`Simpan (${results.length})`}
                </button>
                <button onClick={onCancel}
                  className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-red-400 text-xs font-black flex items-center justify-center gap-1.5 border border-slate-600">
                  <X size={13}/> Batal
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

  const estTiles   = drawnBounds ? estimateTileCount(drawnBounds, TILE_METER) : 0;
  const estSeconds = estTiles * 1.5;
  const estMinutes = estSeconds < 60 ? `${Math.ceil(estSeconds)}s` : `~${Math.ceil(estSeconds/60)} menit`;

  useEffect(() => { if (isScanning) setStep('result'); }, [isScanning]);

  const flyAndCapture = async (tile) => {
    const map = mapRef.current;
    if (!map) throw new Error('Map not ready');

    await new Promise((resolve) => {
      map.flyTo([tile.centerLat, tile.centerLng], CAPTURE_ZOOM, { animate: true, duration: 0.5 });
      map.once('moveend', resolve);
    });

    await new Promise(r => setTimeout(r, 700));

    const centerLatLng = map.getCenter();
    const zoom         = map.getZoom();
    const mapEl        = document.querySelector('.leaflet-container');
    const rect         = mapEl.getBoundingClientRect();
    const captureSize  = Math.min(CAPTURE_PX, rect.width, rect.height);

    const centerWorld = map.project(centerLatLng, zoom);

    const halfCapture = captureSize / 2;
    const topLeftWorld = {
      x: centerWorld.x - halfCapture,
      y: centerWorld.y - halfCapture,
    };

    const pixelsToLatLng = (segmentation) =>
      segmentation.map(([px, py]) => {
        const scaledX = (px / YOLO_SIZE) * captureSize;
        const scaledY = (py / YOLO_SIZE) * captureSize;
        const worldX = topLeftWorld.x + scaledX;
        const worldY = topLeftWorld.y + scaledY;
        const ll = map.unproject([worldX, worldY], zoom);
        return [ll.lat, ll.lng];
      });

    const html2canvas = (await import('html2canvas')).default;
    if (!mapEl) throw new Error('Map element not found');
    const startX = (rect.width  - captureSize) / 2;
    const startY = (rect.height - captureSize) / 2;

    const canvas = await html2canvas(mapEl, {
      useCORS: true, allowTaint: true,
      x: startX, y: startY,
      width: captureSize, height: captureSize,
      scale: 1, logging: false,
      ignoreElements: el => (
        el.tagName==='BUTTON' || el.tagName==='ASIDE' ||
        el.classList.contains('leaflet-control') ||
        el.classList.contains('fixed') || el.classList.contains('absolute') ||
        el.classList.contains('lucide')
      ),
    });

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    return {
      blob,
      scanLat:     centerLatLng.lat,
      scanLng:     centerLatLng.lng,
      captureSize,
      pixelsToLatLng,
    };
  };

  // ─── Scan loop ───────────────────────────────────────────────────────────────
  const handleStartScan = async () => {
    if (!drawnBounds)         { toast.error('Gambar area terlebih dahulu!'); return; }
    if (!selectedCats.length) { toast.error('Pilih minimal satu kategori!'); return; }
    if (estTiles === 0)       { toast.error('Area terlalu kecil!'); return; }
    if (estTiles > 5000)      { toast.error(`Terlalu besar (${estTiles} tile). Maks 5000.`); return; }

    const grid = generateTilesFromBounds(drawnBounds, TILE_METER);
    setTileGrid(grid);
    setPreviewResults([]);
    setIsScanning(true);
    setIsPaused(false);
    setIsDrawingArea(false);
    setStep('result');
    abortRef.current = false;
    pauseRef.current = false;

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
        const { blob, scanLat, scanLng, captureSize, pixelsToLatLng } = await flyAndCapture(tile);

        const formData = new FormData();
        formData.append('image',        blob, `tile_${i}.png`);
        formData.append('lat',          scanLat);
        formData.append('lng',          scanLng);
        formData.append('capture_size', YOLO_SIZE);
        formData.append('categories',   selectedCats.join(','));

        const res  = await fetch('http://127.0.0.1:8000/api/run-detection/', { method:'POST', body:formData });
        const data = await res.json();
        const count = data.results?.length || 0;

        if (count > 0) {
          const enriched = data.results
            .map(obj => {
              if (!obj.segmentation || obj.segmentation.length < 3) return null;

              const rawLatLng = pixelsToLatLng(obj.segmentation);
              const polygonLatLng = clipPolygonToTile(rawLatLng, tile);

              if (!polygonLatLng || polygonLatLng.length < 3) return null;

              return {
                ...obj,
                tile_id: tile.id,
                _tile:   tile,
                scanLat, scanLng, captureSize,
                polygonLatLng,
              };
            })
            .filter(Boolean);

          allResults.push(...enriched);
          setPreviewResults(prev => [...prev, ...enriched]);
        }

        done++;
        updatedGrid[i] = { ...updatedGrid[i], status: count>0?'done':'empty', count };
        setTileGrid([...updatedGrid]);
        setTileStats({ total: grid.length, done, objects: allResults.length });

        if (done%5===0 || done===grid.length) {
          toast.loading(`${done}/${grid.length} tile · ${allResults.length} objek`, { id: scanToast });
        }

      } catch (err) {
        console.error(`Tile ${i} error:`, err);
        done++;
        updatedGrid[i] = { ...updatedGrid[i], status:'error' };
        setTileGrid([...updatedGrid]);
        setTileStats(prev => ({ ...prev, done }));
      }
    }

    setScanningTileIdx(-1);
    setIsScanning(false);
    toast[abortRef.current?'error':'success'](
      abortRef.current ? 'Scan dihentikan.'
        : allResults.length > 0
          ? `Selesai! ${allResults.length} objek · ${grid.length} tile`
          : 'Selesai! Tidak ada objek.',
      { id: scanToast, duration: 5000 }
    );
  };

  const handlePauseResume = () => {
    const next = !isPaused;
    setIsPaused(next);
    pauseRef.current = next;
    toast(next?'⏸ Dijeda':'▶ Dilanjutkan', { duration:1500 });
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!previewResults.length) { toast.error('Tidak ada hasil'); return; }
    setIsSaving(true);
    const t = toast.loading(`Menyimpan ${previewResults.length} objek...`);
    try {
      const features = previewResults
        .filter(o => o.polygonLatLng?.length >= 3)
        .map(obj => {
          const wktPoints = obj.polygonLatLng.map(([lat, lng]) => `${lng} ${lat}`);
          wktPoints.push(wktPoints[0]);

          return {
            nama:             obj.kategori,
            kategori:         obj.kategori,
            confidence_score: obj.confidence_score,
            polygon_coords:   wktPoints.join(', '),
            metadata: {
              capture_size: YOLO_SIZE,
              zoom_level:   CAPTURE_ZOOM,
              timestamp:    new Date().toISOString(),
              luas_m2:      obj.luas_m2,
              tile_id:      obj.tile_id,
              tile_size_m:  TILE_METER,
              scan_mode:    'area_scan',
            },
          };
        })
        .filter(Boolean);

      const res = await axios.post('http://127.0.0.1:8000/api/save-detection/', { features });
      if (res.status === 201) {
        toast.success(`${features.length} objek disimpan!`, { id:t, duration:3000 });
        if (onNewData) onNewData();
        handleReset();
      }
    } catch (err) {
      toast.error(`Gagal: ${err.response?.data?.message || err.message}`, { id:t });
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ FIX: handleReset juga membersihkan drawnBounds sehingga garis hilang
  const handleReset = () => {
    abortRef.current = true;
    setIsScanning(false);
    setIsPaused(false);
    setIsDrawingArea(false);
    setScanningTileIdx(-1);
    setDrawnBounds(null);   // ← penting: hapus bounds agar garis hilang
    setTileGrid([]);
    setPreviewResults([]);
    setTileStats({ total:0, done:0, objects:0 });
    setStep('draw');
  };

  const progress = tileStats.total>0 ? Math.round((tileStats.done/tileStats.total)*100) : 0;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
      onWheel={e => e.stopPropagation()}>

      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/30">
            <Grid size={14} className="text-white"/>
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">Area Scan</h3>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">AI · z{CAPTURE_ZOOM} · {TILE_METER}m/tile</p>
          </div>
          {isScanning && (
            <div className="ml-auto flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>
              <span className="text-[9px] font-black text-cyan-500 uppercase tracking-wide">AKTIF</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {SCAN_MODES.map((mode) => {
            const Icon   = mode.icon;
            const active = step === mode.id;
            const done   = (mode.id==='draw'&&drawnBounds)||(mode.id==='scan'&&isScanning);
            return (
              <button key={mode.id}
                onClick={() => !isScanning && setStep(mode.id)}
                disabled={isScanning}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all ${
                  active ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}>
                <div className={active?'text-cyan-600':done?'text-green-500':'text-slate-400'}>
                  <Icon size={12}/>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-wider ${
                  active?'text-cyan-600':done?'text-green-500':'text-slate-400'
                }`}>{mode.label}</span>
                <div className={`w-1 h-1 rounded-full ${active?'bg-cyan-500':'bg-transparent'}`}/>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* DRAW */}
        {step === 'draw' && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              {[
                { n:1, t:'Navigasi ke lokasi target di peta' },
                { n:2, t:'Aktifkan mode gambar & drag area scan' },
                { n:3, t:'Pilih kategori & mulai scan otomatis' },
              ].map(s => (
                <div key={s.n} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">{s.n}</span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{s.t}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                if (isScanning) return;
                if (isDrawingArea) {
                  // ✅ FIX: Batal menggambar → hapus juga garis yang sudah tergambar
                  setIsDrawingArea(false);
                  setDrawnBounds(null);
                } else {
                  setIsDrawingArea(true);
                }
              }}
              disabled={isScanning}
              className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                isDrawingArea
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25'
              }`}>
              {isDrawingArea ? <><X size={16}/> Batal Menggambar</> : <><Square size={16}/> Aktifkan Mode Gambar</>}
            </button>

            {isDrawingArea && !isScanning && (
              <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700/40 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <MousePointer2 size={11} className="text-cyan-600"/>
                </div>
                <div>
                  <p className="text-[10px] font-black text-cyan-700 dark:text-cyan-400">Mode gambar aktif</p>
                  <p className="text-[9px] text-cyan-600/70">Klik & drag di peta untuk menentukan area</p>
                </div>
              </div>
            )}

            {drawnBounds && !isScanning && (
              <>
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 size={12} className="text-green-600"/>
                    <span className="text-[10px] font-black text-green-700 dark:text-green-400">Area berhasil ditandai</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white dark:bg-green-900/30 rounded-lg p-2 text-center">
                      <div className="text-sm font-black text-green-700 dark:text-green-400">{estTiles.toLocaleString()}</div>
                      <div className="text-[8px] text-slate-500 uppercase font-bold">Tile ({TILE_METER}m)</div>
                    </div>
                    <div className="bg-white dark:bg-green-900/30 rounded-lg p-2 text-center">
                      <div className="text-sm font-black text-green-700 dark:text-green-400">{estMinutes}</div>
                      <div className="text-[8px] text-slate-500 uppercase font-bold">Est. Waktu</div>
                    </div>
                  </div>
                  {estTiles > 5000 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-red-500">
                      <AlertTriangle size={10}/> Terlalu besar! Maks 5000 tile.
                    </div>
                  )}
                </div>
                <button onClick={() => setStep('scan')}
                  disabled={estTiles > 5000}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
                  Lanjut Konfigurasi <ChevronRight size={16}/>
                </button>
              </>
            )}
          </div>
        )}

        {/* CONFIG */}
        {step === 'scan' && (
          <>
            {!drawnBounds && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-center">
                <AlertTriangle size={20} className="text-amber-500 mx-auto mb-2"/>
                <p className="text-xs text-amber-700 font-bold">Gambar area terlebih dahulu</p>
              </div>
            )}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={12} className="text-cyan-500"/>
                <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Konfigurasi Scan</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l:'Zoom',        v:`z${CAPTURE_ZOOM}`        },
                  { l:'Resolusi',    v:`${YOLO_SIZE}px`          },
                  { l:'Ukuran Tile', v:`${TILE_METER}m`          },
                  { l:'Total Tile',  v:estTiles.toLocaleString() },
                  { l:'Est. Waktu',  v:estMinutes                },
                  { l:'Proyeksi',    v:'TopLeft-Frozen'          },
                ].map(item => (
                  <div key={item.l} className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-2.5 text-center">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-200 leading-tight">{item.v}</div>
                    <div className="text-[8px] text-slate-400 mt-0.5 uppercase font-bold">{item.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <ScanLine size={12} className="text-cyan-500"/>
                <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Kategori</p>
                <span className="ml-auto text-[9px] text-slate-400">{selectedCats.length}/{CATEGORIES.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ id, label, color, Icon }) => (
                  <button key={id}
                    onClick={() => setSelectedCats(p => p.includes(id)?p.filter(c=>c!==id):[...p,id])}
                    className={`p-3 rounded-xl border-2 transition-all font-bold text-xs flex items-center gap-2 ${
                      selectedCats.includes(id)?'text-white shadow-md':'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                    style={selectedCats.includes(id)?{ backgroundColor:color, borderColor:color }:{}}>
                    <Icon size={14}/> <span>{label}</span>
                    {selectedCats.includes(id) && <CheckCircle2 size={11} className="ml-auto opacity-80"/>}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleStartScan}
              disabled={!drawnBounds||!selectedCats.length||estTiles>5000||estTiles===0}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-bold shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Play size={16}/> Mulai Scan ({estTiles.toLocaleString()} tile)
            </button>
          </>
        )}

        {/* RESULT */}
        {step === 'result' && (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Progress</span>
                <span className="text-xs font-black text-cyan-600">{progress}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300 relative overflow-hidden"
                  style={{ width:`${progress}%` }}>
                  {isScanning && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"/>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v:tileStats.total,   l:'Total',   c:'text-slate-700 dark:text-slate-200' },
                  { v:tileStats.done,    l:'Selesai', c:'text-green-600 dark:text-green-400' },
                  { v:tileStats.objects, l:'Objek',   c:'text-amber-600 dark:text-amber-400' },
                ].map(s => (
                  <div key={s.l} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700">
                    <div className={`text-lg font-black ${s.c}`}>{s.v}</div>
                    <div className="text-[8px] text-slate-400 font-black uppercase">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {isScanning && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handlePauseResume}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    isPaused?'bg-cyan-500 text-white shadow-md':'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}>
                  {isPaused?<><Play size={13}/> Lanjut</>:<><Pause size={13}/> Jeda</>}
                </button>
                <button onClick={() => { abortRef.current=true; setIsScanning(false); }}
                  className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800">
                  <Square size={13}/> Hentikan
                </button>
              </div>
            )}

            {tileGrid.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-widest">Tile Grid ({tileGrid.length})</p>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {tileGrid.map((tile, idx) => (
                    <div key={tile.id}
                      className={`flex items-center gap-2 p-1.5 rounded-lg text-[10px] transition-all ${
                        idx===scanningTileIdx
                          ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800'
                          : 'bg-slate-50 dark:bg-slate-700/50'
                      }`}>
                      <span className="font-mono text-slate-400 w-7 text-right">{String(idx+1).padStart(2,'0')}</span>
                      <span className="flex-1 text-slate-500 dark:text-slate-400">R{tile.row+1}C{tile.col+1}</span>
                      {tile.count>0 && <span className="font-bold text-green-600">{tile.count}</span>}
                      <StatusBadge status={tile.status}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isScanning && (
              <button onClick={handleReset}
                className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:border-red-300 hover:text-red-500 transition-all">
                <RotateCcw size={14}/> Reset &amp; Scan Ulang
              </button>
            )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30 flex items-center justify-between">
        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-medium">
          {tileGrid.length>0 ? `${tileGrid.length} tile · ${TILE_METER}m · z${CAPTURE_ZOOM}` : `GeoAI Scanner · z${CAPTURE_ZOOM}`}
        </p>
        {(drawnBounds||tileGrid.length>0) && !isScanning && (
          <button onClick={handleReset} className="text-[10px] text-red-400 hover:text-red-600 font-bold flex items-center gap-1">
            <Trash2 size={10}/> Reset
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
      />
    </div>
  );
}