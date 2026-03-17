"use client";
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Grid, Play, Square, Trash2, Save, ChevronRight, Layers,
  ScanLine, CheckCircle2, XCircle, Clock, AlertTriangle,
  Home, Waves, Trees, Route, Pause, RotateCcw, ChevronDown, ChevronUp, X,
  MousePointer2, Zap, MapPin, Search, Map,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Rectangle, Polygon, GeoJSON, Popup, useMapEvents, useMap } from 'react-leaflet';

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
  { id: 'draw',   label: 'Area',        icon: Square },
  { id: 'scan',   label: 'Konfigurasi', icon: Grid   },
  { id: 'result', label: 'Hasil',       icon: Layers },
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

function clipPolygonToTile(poly, tile) {
  const lp = (tile.north-tile.south)*0.005, lq = (tile.east-tile.west)*0.005;
  const S=tile.south-lp, N=tile.north+lp, W=tile.west-lq, E=tile.east+lq;
  const edges = [
    { inside:([lat])=>lat>=S, intersect:([la,lo],[lb,lb2])=>{const t=(S-la)/(lb-la);return[S,lo+t*(lb2-lo)];} },
    { inside:([lat])=>lat<=N, intersect:([la,lo],[lb,lb2])=>{const t=(N-la)/(lb-la);return[N,lo+t*(lb2-lo)];} },
    { inside:([,lng])=>lng>=W, intersect:([la,lo],[lb,lb2])=>{const t=(W-lo)/(lb2-lo);return[la+t*(lb-la),W];} },
    { inside:([,lng])=>lng<=E, intersect:([la,lo],[lb,lb2])=>{const t=(E-lo)/(lb2-lo);return[la+t*(lb-la),E];} },
  ];
  let out = [...poly];
  for (const edge of edges) {
    if (!out.length) break;
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i-1+inp.length)%inp.length];
      if (edge.inside(cur)) { if (!edge.inside(prev)) out.push(edge.intersect(prev,cur)); out.push(cur); }
      else if (edge.inside(prev)) out.push(edge.intersect(prev,cur));
    }
  }
  return out;
}

// generateTilesFromBounds — satu fungsi untuk kedua mode.
// clipFeature = null  → mode manual, semua tile dalam bbox di-include.
// clipFeature = Feature → mode kabupaten, tile di luar polygon di-skip.
function generateTilesFromBounds(bounds, tileMeter=150, clipFeature=null) {
  const south=Math.min(bounds[0].lat,bounds[1].lat), north=Math.max(bounds[0].lat,bounds[1].lat);
  const west=Math.min(bounds[0].lng,bounds[1].lng),  east=Math.max(bounds[0].lng,bounds[1].lng);
  const cLat=(south+north)/2, latStep=meterToLat(tileMeter), lngStep=meterToLng(tileMeter,cLat);
  const tiles=[]; let row=0;
  for (let lat=south; lat<north; lat+=latStep) {
    let col=0;
    for (let lng=west; lng<east; lng+=lngStep) {
      const tN=Math.min(lat+latStep,north), tE=Math.min(lng+lngStep,east);
      const cLt=(lat+tN)/2, cLg=(lng+tE)/2;
      if (clipFeature && !pointInFeature({lat:cLt,lng:cLg}, clipFeature)) { col++; continue; }
      tiles.push({id:`tile_${row}_${col}`,row,col,south:lat,north:tN,west:lng,east:tE,centerLat:cLt,centerLng:cLg,status:'pending',count:0});
      col++;
    }
    row++;
  }
  tiles.sort((a,b)=>a.row!==b.row?a.row-b.row:a.col-b.col);
  return tiles;
}

function estimateTileCount(bounds, tileMeter=150) {
  if (!bounds) return 0;
  const south=Math.min(bounds[0].lat,bounds[1].lat), north=Math.max(bounds[0].lat,bounds[1].lat);
  const west=Math.min(bounds[0].lng,bounds[1].lng),  east=Math.max(bounds[0].lng,bounds[1].lng);
  const cLat=(south+north)/2;
  return Math.max(1, Math.ceil((north-south)/meterToLat(tileMeter)) * Math.ceil((east-west)/meterToLng(tileMeter,cLat)));
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    pending:  {color:'bg-slate-100 text-slate-500',  icon:Clock,        label:'Menunggu'},
    scanning: {color:'bg-blue-100 text-blue-600',    icon:ScanLine,     label:'Scanning...'},
    done:     {color:'bg-green-100 text-green-600',  icon:CheckCircle2, label:'Selesai'},
    error:    {color:'bg-red-100 text-red-600',      icon:XCircle,      label:'Error'},
    empty:    {color:'bg-amber-100 text-amber-600',  icon:AlertTriangle,label:'Kosong'},
  };
  const s=cfg[status]||cfg.pending, Icon=s.icon;
  return <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${s.color}`}><Icon size={9}/> {s.label}</span>;
}

// ─── KABUPATEN SEARCH ─────────────────────────────────────────────────────────
function KabupatenSearchPanel({ kabupatenList, selectedKabupaten, onSelect, isLoading }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const getName  = (f) => f?.properties?.name || f?.properties?.NAMOBJ || f?.properties?.KAB_KOTA || '';
  const getProv  = (f) => f?.properties?.provinsi || f?.properties?.PROPINSI || f?.properties?.Propinsi || '';

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return kabupatenList.slice(0,60);
    return kabupatenList.filter(f => getName(f).toLowerCase().includes(q)).slice(0,60);
  }, [query, kabupatenList]);

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 bg-white dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 cursor-text transition-all ${isOpen?'border-cyan-500 shadow-lg shadow-cyan-500/10':'border-slate-200 dark:border-slate-700'}`}
        onClick={()=>{setIsOpen(true);inputRef.current?.focus();}}>
        {isLoading
          ? <div className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
          : <Search size={13} className="text-slate-400 flex-shrink-0"/>}
        <input ref={inputRef} value={query} onChange={e=>{setQuery(e.target.value);setIsOpen(true);}} onFocus={()=>setIsOpen(true)}
          placeholder="Cari kabupaten / kota..."
          className="flex-1 bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none min-w-0"/>
        {selectedKabupaten && !query && <button onClick={e=>{e.stopPropagation();onSelect(null);setQuery('');}} className="text-slate-400 hover:text-red-400 transition-colors"><X size={12}/></button>}
      </div>

      {selectedKabupaten && !isOpen && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0"/>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-cyan-700 dark:text-cyan-400 truncate">{getName(selectedKabupaten)}</p>
            {getProv(selectedKabupaten) && <p className="text-[9px] text-cyan-600/60 truncate">{getProv(selectedKabupaten)}</p>}
          </div>
          <button onClick={()=>{onSelect(null);setQuery('');}} className="text-cyan-400 hover:text-red-400 flex-shrink-0"><X size={11}/></button>
        </div>
      )}

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={()=>setIsOpen(false)}/>
          <div className="absolute top-full left-0 right-0 mt-1 z-[1000] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-52 overflow-y-auto">
              {filtered.length===0
                ? <div className="py-6 text-center text-[11px] text-slate-400">{isLoading?'Memuat...':'Tidak ditemukan'}</div>
                : filtered.map((f,idx)=>{
                    const name=getName(f), prov=getProv(f), isSel=selectedKabupaten&&getName(selectedKabupaten)===name;
                    return (
                      <button key={idx} onClick={()=>{onSelect(f);setQuery('');setIsOpen(false);}}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isSel?'bg-cyan-50 dark:bg-cyan-900/30':'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <MapPin size={11} className={isSel?'text-cyan-500':'text-slate-400'}/>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold truncate ${isSel?'text-cyan-700 dark:text-cyan-400':'text-slate-700 dark:text-slate-200'}`}>{name}</p>
                          {prov && <p className="text-[9px] text-slate-400 truncate">{prov}</p>}
                        </div>
                        {isSel && <CheckCircle2 size={11} className="text-cyan-500 flex-shrink-0"/>}
                      </button>
                    );
                  })
              }
            </div>
            <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
              <p className="text-[9px] text-slate-400">{filtered.length} hasil · atau klik langsung di peta</p>
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
      else toast('Klik di dalam wilayah kabupaten', { icon:'📍', duration:1500 });
    },
  });

  const getSelName = () =>
    selectedKabupaten?.properties?.name || selectedKabupaten?.properties?.NAMOBJ ||
    selectedKabupaten?.properties?.KAB_KOTA || '';

  const style = useCallback((feature) => {
    const name  = feature.properties?.name || feature.properties?.NAMOBJ || feature.properties?.KAB_KOTA || '';
    const isSel = selectedKabupaten && name === getSelName();
    if (isSel)       return { color:'#00ffcc', weight:2.5, fillColor:'#00ffcc', fillOpacity:0.18, opacity:1 };
    if (isClickMode) return { color:'#38bdf8', weight:0.8, fillColor:'#0ea5e9', fillOpacity:0.04, dashArray:'5,5', opacity:0.7 };
    return             { color:'#38bdf8', weight:0.5, fillColor:'transparent', fillOpacity:0, dashArray:'6,6', opacity:0.35 };
  }, [selectedKabupaten, isClickMode]);

  const onEachFeature = useCallback((feature, layer) => {
    const props = feature.properties||{};
    const name  = props.name||props.NAMOBJ||props.KAB_KOTA||'';
    const prov  = props.provinsi||props.PROPINSI||props.Propinsi||'';
    const tipe  = props.type_wilayah||props.TIPE||'';
    const isSel = selectedKabupaten && name === getSelName();

    layer.bindPopup(`
      <div style="font-family:system-ui,sans-serif;min-width:190px;padding:2px">
        <div style="background:linear-gradient(135deg,#0d9488,#0891b2);color:white;padding:10px 12px;border-radius:10px 10px 4px 4px;margin-bottom:6px">
          <div style="font-size:8px;font-weight:800;opacity:.75;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">${tipe||'Kabupaten / Kota'}</div>
          <div style="font-size:15px;font-weight:900">${name}</div>
        </div>
        <div style="padding:0 4px 4px">
          ${prov?`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase">Provinsi</span><span style="font-size:11px;font-weight:700;color:#0f766e">${prov}</span></div>`:''}
          ${isClickMode&&!isSel?`<div style="margin-top:6px;padding:6px 8px;background:#f0fdfa;border-radius:8px;border:1px solid #99f6e4;font-size:9px;font-weight:700;color:#0d9488;text-align:center">✓ Klik untuk pilih wilayah ini</div>`:''}
          ${isSel?`<div style="margin-top:6px;padding:6px 8px;background:#ecfdf5;border-radius:8px;border:1px solid #6ee7b7;font-size:9px;font-weight:700;color:#059669;text-align:center">✅ Wilayah ini dipilih</div>`:''}
        </div>
      </div>`, { maxWidth:240 });

    layer.on({
      mouseover: (e) => {
        if (isSel) return;
        e.target.setStyle({ fillOpacity:0.12, color:'#22d3ee', weight:1.5, opacity:1, dashArray:undefined });
        e.target.bindTooltip(`<span style="font-size:11px;font-weight:800;color:#0f172a">${name}</span>`, { sticky:true }).openTooltip();
      },
      mouseout: (e) => {
        if (isSel) return;
        e.target.setStyle(style(feature));
        e.target.closeTooltip();
      },
      click: (e) => {
        if (!isClickMode) return;
        e.target.setStyle({ fillColor:'#00ffcc', fillOpacity:0.4, color:'#00ffcc', weight:3, dashArray:undefined });
        setTimeout(() => onSelect?.(feature), 180);
      },
    });
  }, [selectedKabupaten, isClickMode, onSelect, style]);

  if (!isActive || !kabupatenList?.length) return null;

  return (
    <GeoJSON
      key={`kab-${kabupatenList.length}`}
      data={{ type:'FeatureCollection', features:kabupatenList }}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
});

// ─── AREA SCAN OVERLAY ────────────────────────────────────────────────────────
export function AreaScanOverlay({
  isActive, isDrawing, onBoundsSet, drawnBounds,
  tileGrid, scanningTileIdx, previewResults, onTileClick, isScanning,
}) {
  const map = useMap();
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
    mousedown(e) { if (!canDraw||!ready) return; startPt.current=e.latlng; map.dragging.disable(); map.scrollWheelZoom.disable(); },
    mousemove(e) { if (!canDraw||!startPt.current) return; setTempRect([startPt.current,e.latlng]); },
    mouseup(e) {
      if (!canDraw||!startPt.current) return;
      const b0=startPt.current, b1=e.latlng;
      if (Math.abs(b0.lat-b1.lat)>meterToLat(50)&&Math.abs(b0.lng-b1.lng)>meterToLng(50,b0.lat)) onBoundsSet([b0,b1]);
      else toast.error('Area terlalu kecil!');
      setTempRect(null); startPt.current=null; map.dragging.enable(); map.scrollWheelZoom.enable();
    },
  });

  const getCatColor = (cat) => CATEGORIES.find(c=>c.id===cat)?.color||'#ef4444';
  if (!isActive) return null;

  return (
    <>
      {tempRect && <Rectangle bounds={tempRect} pathOptions={{color:'#fff',weight:2.5,fillColor:'#06b6d4',fillOpacity:0.15,dashArray:'8,5'}}/>}
      {drawnBounds && tileGrid.length===0 && (
        <Rectangle bounds={[[drawnBounds[0].lat,drawnBounds[0].lng],[drawnBounds[1].lat,drawnBounds[1].lng]]}
          pathOptions={{color:'#fff',weight:2,fillColor:'#06b6d4',fillOpacity:0.12,dashArray:'8,5'}}/>
      )}
      {tileGrid.map((tile,idx)=>{
        const scanning=idx===scanningTileIdx;
        let color,fillOp,weight,dash;
        if(scanning)                  {color='#00ffff';fillOp=0.0; weight=3;  dash=undefined;}
        else if(tile.status==='done') {color='#00ff88';fillOp=0.08;weight=1;  dash=undefined;}
        else if(tile.status==='empty'){color='#ffcc00';fillOp=0.0; weight=0.8;dash='3,3';}
        else if(tile.status==='error'){color='#ff4444';fillOp=0.10;weight=1;  dash=undefined;}
        else                          {color='#ffffff';fillOp=0.0; weight=0.4;dash='2,4';}
        return (
          <Rectangle key={tile.id} bounds={[[tile.south,tile.west],[tile.north,tile.east]]}
            pathOptions={{color,weight,fillColor:color,fillOpacity:fillOp,dashArray:dash}}
            eventHandlers={{
              click:()=>{if(onTileClick&&!isScanning)onTileClick(tile);},
              mouseover:(e)=>{if(!scanning)e.target.setStyle({weight:2,fillOpacity:fillOp+0.1});},
              mouseout: (e)=>{if(!scanning)e.target.setStyle({weight,fillOpacity:fillOp});},
            }}/>
        );
      })}
      {scanningTileIdx>=0&&tileGrid[scanningTileIdx]&&(()=>{
        const t=tileGrid[scanningTileIdx];
        return <Rectangle bounds={[[t.south,t.west],[t.north,t.east]]} pathOptions={{color:'#00ffff',weight:3,fillColor:'#00ffff',fillOpacity:0.20}}/>;
      })()}
      {previewResults.map((obj,idx)=>{
        if(!obj.polygonLatLng||obj.polygonLatLng.length<3) return null;
        const color=getCatColor(obj.kategori);
        return (
          <Polygon key={`prev-${idx}`} positions={obj.polygonLatLng} pathOptions={{color,fillColor:color,fillOpacity:0.45,weight:2}}>
            <Popup>
              <div className="p-2 min-w-[140px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{background:color}}/>
                  <span className="font-bold text-xs uppercase">{obj.kategori}</span>
                </div>
                {obj.luas_m2&&<p className="text-[10px] text-slate-500">Luas: <b className="text-sky-600">{obj.luas_m2} m²</b></p>}
                <p className="text-[10px] text-slate-400">Akurasi: {(obj.confidence_score*100).toFixed(1)}%</p>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

// ─── SUMMARY PANEL ────────────────────────────────────────────────────────────
function SummaryPanel({ results, tileStats, onSave, onCancel, isSaving, isScanning }) {
  const [collapsed, setCollapsed] = useState(false);
  const catSummary = results.reduce((acc,r)=>{acc[r.kategori]=(acc[r.kategori]||0)+1;return acc;},{});
  const totalLuas  = results.reduce((s,r)=>s+(r.luas_m2||0),0);
  const pct = tileStats.total>0?Math.round((tileStats.done/tileStats.total)*100):0;
  if (!isScanning && results.length===0) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1200] w-[340px] max-w-[92vw]">
      <div className="bg-slate-900/96 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none" onClick={()=>setCollapsed(v=>!v)}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isScanning?'bg-cyan-400 animate-pulse':'bg-green-400'}`}/>
            <span className="text-white text-xs font-black uppercase tracking-wide">
              {isScanning?`Scanning ${tileStats.done}/${tileStats.total} (${pct}%)`:`${results.length} Objek Terdeteksi`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isScanning&&results.length>0&&<span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">PREVIEW</span>}
            {collapsed?<ChevronUp size={14} className="text-slate-400"/>:<ChevronDown size={14} className="text-slate-400"/>}
          </div>
        </div>
        {isScanning&&<div className="h-1.5 bg-slate-800"><div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300" style={{width:`${pct}%`}}/></div>}
        {!collapsed&&(
          <div className="px-4 pb-4 pt-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{v:tileStats.total,l:'Total',c:'text-white'},{v:tileStats.done,l:'Selesai',c:'text-green-400'},{v:results.length,l:'Objek',c:'text-amber-400'}].map(s=>(
                <div key={s.l} className="bg-slate-800 rounded-xl p-2 text-center">
                  <div className={`text-base font-black ${s.c}`}>{s.v}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">{s.l}</div>
                </div>
              ))}
            </div>
            {Object.keys(catSummary).length>0&&(
              <div className="space-y-1.5">
                {Object.entries(catSummary).map(([cat,cnt])=>{
                  const info=CATEGORIES.find(c=>c.id===cat),Icon=info?.Icon||ScanLine,p=Math.round((cnt/results.length)*100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{backgroundColor:info?.color||'#94a3b8'}}><Icon size={11}/></div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5"><span className="text-[10px] font-bold text-slate-300 capitalize">{cat}</span><span className="text-[10px] font-black text-white">{cnt}</span></div>
                        <div className="h-1 bg-slate-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{width:`${p}%`,backgroundColor:info?.color||'#94a3b8'}}/></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {totalLuas>0&&<div className="flex justify-between py-2 border-t border-slate-700"><span className="text-[10px] text-slate-400 font-bold uppercase">Total Luas</span><span className="text-xs font-black text-cyan-400">{totalLuas.toFixed(1)} m²</span></div>}
            {!isScanning&&results.length>0&&(
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={onSave} disabled={isSaving} className="py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg">
                  <Save size={13}/> {isSaving?'Menyimpan...':`Simpan (${results.length})`}
                </button>
                <button onClick={onCancel} className="py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-red-400 text-xs font-black flex items-center justify-center gap-1.5 border border-slate-600">
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
  isDrawingArea, setIsDrawingArea, drawnBounds, setDrawnBounds,
  tileGrid, setTileGrid, previewResults, setPreviewResults,
  scanningTileIdx, setScanningTileIdx, tileStats, setTileStats,
  isScanning, setIsScanning,
  onKabupatenStateChange,
}) {
  const [step,         setStep]         = useState('draw');
  const [selectedCats, setSelectedCats] = useState([]);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const [scanMode,             setScanMode]             = useState('manual');
  const [kabupatenList,        setKabupatenList]        = useState([]);
  const [kabupatenLoading,     setKabupatenLoading]     = useState(false);
  const [selectedKabupaten,    setSelectedKabupaten]    = useState(null);
  const [isKabupatenClickMode, setIsKabupatenClickMode] = useState(false);
  const pauseRef = useRef(false);
  const abortRef = useRef(false);

  const activeBounds = useMemo(()=>{
    if (scanMode==='kabupaten'&&selectedKabupaten) return getBoundsFromFeature(selectedKabupaten);
    return drawnBounds;
  },[scanMode,selectedKabupaten,drawnBounds]);

  const estTiles   = activeBounds?estimateTileCount(activeBounds,TILE_METER):0;
  const estSeconds = estTiles*1.5;
  const estMinutes = estSeconds<60?`${Math.ceil(estSeconds)}s`:`~${Math.ceil(estSeconds/60)} menit`;

  useEffect(()=>{if(isScanning)setStep('result');},[isScanning]);

  useEffect(()=>{
    if(scanMode!=='kabupaten'||kabupatenList.length>0) return;
    setKabupatenLoading(true);
    axios.get('http://127.0.0.1:8000/api/batas-kabupaten/')
      .then(res=>setKabupatenList(res.data?.features||[]))
      .catch(()=>toast.error('Gagal memuat data kabupaten'))
      .finally(()=>setKabupatenLoading(false));
  },[scanMode]);

  const handleSelect = useCallback((feature) => {
    if (!feature) { setSelectedKabupaten(null); return; }
    setSelectedKabupaten(feature);
    setIsKabupatenClickMode(false);
    const name = feature.properties?.name||feature.properties?.NAMOBJ||feature.properties?.KAB_KOTA||'';
    toast.success(`✓ ${name} dipilih`, { duration:2000 });
    const bounds = getBoundsFromFeature(feature);
    if (bounds && mapRef?.current) {
      mapRef.current.fitBounds(
        [[bounds[0].lat,bounds[0].lng],[bounds[1].lat,bounds[1].lng]],
        { padding:[60,60] }
      );
    }
  }, [mapRef]);

  useEffect(()=>{
    onKabupatenStateChange?.({
      scanMode, kabupatenList, selectedKabupaten, isKabupatenClickMode, handleSelect,
    });
  },[scanMode,kabupatenList,selectedKabupaten,isKabupatenClickMode,handleSelect]);

  // ── flyTo + html2canvas — satu fungsi, dipakai kedua mode ────────────────
  const flyAndCapture = async (tile) => {
    const map = mapRef.current;
    if (!map) throw new Error('Map not ready');
    await new Promise(resolve => {
      map.flyTo([tile.centerLat, tile.centerLng], CAPTURE_ZOOM, { animate:true, duration:0.5 });
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
      useCORS:true, allowTaint:true,
      x:startX, y:startY, width:captureSize, height:captureSize,
      scale:1, logging:false,
      ignoreElements: el => (
        el.tagName==='BUTTON' || el.tagName==='ASIDE' ||
        el.classList.contains('leaflet-control') ||
        el.classList.contains('fixed') || el.classList.contains('absolute') ||
        el.classList.contains('lucide')
      ),
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return { blob, scanLat:centerLatLng.lat, scanLng:centerLatLng.lng, captureSize, pixelsToLatLng };
  };

  // ── Scan loop — IDENTIK untuk mode manual & kabupaten ────────────────────
  // Satu-satunya perbedaan ada di generateTilesFromBounds:
  //   manual    → clipFeature = null  → semua tile dalam bbox
  //   kabupaten → clipFeature = GeoJSON Feature → tile di luar polygon di-skip
  const handleStartScan = async () => {
    if (!activeBounds)        { toast.error('Tentukan area scan terlebih dahulu!'); return; }
    if (!selectedCats.length) { toast.error('Pilih minimal satu kategori!'); return; }
    if (estTiles===0)         { toast.error('Area terlalu kecil!'); return; }

    const clipFeature = scanMode==='kabupaten' ? selectedKabupaten : null;
    const grid = generateTilesFromBounds(activeBounds, TILE_METER, clipFeature);
    if (!grid.length) { toast.error('Tidak ada tile dalam wilayah!'); return; }

    setTileGrid(grid); setPreviewResults([]); setIsScanning(true); setIsPaused(false);
    setIsDrawingArea(false); setStep('result');
    abortRef.current=false; pauseRef.current=false;

    let done=0;
    const allResults=[], updatedGrid=[...grid];
    const kabName=selectedKabupaten?.properties?.name||selectedKabupaten?.properties?.NAMOBJ||'';
    const scanToast=toast.loading(`Scan ${grid.length} tile${kabName?` · ${kabName}`:''}...`);
    setTileStats({total:grid.length, done:0, objects:0});

    for (let i = 0; i < grid.length; i++) {
      if (abortRef.current) break;
      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 200));
        if (abortRef.current) break;
      }
      if (abortRef.current) break;

      setScanningTileIdx(i);
      updatedGrid[i] = {...updatedGrid[i], status:'scanning'};
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
          const enriched = data.results.map(obj => {
            if (!obj.segmentation || obj.segmentation.length < 3) return null;
            const rawLatLng     = pixelsToLatLng(obj.segmentation);
            const polygonLatLng = clipPolygonToTile(rawLatLng, tile);
            if (!polygonLatLng || polygonLatLng.length < 3) return null;
            return { ...obj, tile_id:tile.id, _tile:tile, scanLat, scanLng, captureSize, polygonLatLng };
          }).filter(Boolean);
          allResults.push(...enriched);
          setPreviewResults(prev => [...prev, ...enriched]);
        }

        done++;
        updatedGrid[i] = {...updatedGrid[i], status:count>0?'done':'empty', count};
        setTileGrid([...updatedGrid]);
        setTileStats({total:grid.length, done, objects:allResults.length});
        if (done%5===0||done===grid.length)
          toast.loading(`${done}/${grid.length} tile · ${allResults.length} objek`,{id:scanToast});

      } catch(err) {
        console.error(`Tile ${i} error:`,err);
        done++;
        updatedGrid[i]={...updatedGrid[i],status:'error'};
        setTileGrid([...updatedGrid]);
        setTileStats(prev=>({...prev,done}));
      }
    }

    setScanningTileIdx(-1); setIsScanning(false);
    toast[abortRef.current?'error':'success'](
      abortRef.current?'Scan dihentikan.'
        :allResults.length>0
          ?`Selesai! ${allResults.length} objek · ${grid.length} tile${kabName?` · ${kabName}`:''}`
          :'Selesai! Tidak ada objek.',
      {id:scanToast,duration:5000}
    );
  };

  const handlePauseResume=()=>{const n=!isPaused;setIsPaused(n);pauseRef.current=n;toast(n?'⏸ Dijeda':'▶ Dilanjutkan',{duration:1500});};

  const handleSaveAll=async()=>{
    if(!previewResults.length){toast.error('Tidak ada hasil');return;}
    setIsSaving(true);
    const t=toast.loading(`Menyimpan ${previewResults.length} objek...`);
    try {
      const features=previewResults.filter(o=>o.polygonLatLng?.length>=3).map(obj=>{
        const wkt=obj.polygonLatLng.map(([lat,lng])=>`${lng} ${lat}`);
        wkt.push(wkt[0]);
        return {
          nama:obj.kategori, kategori:obj.kategori, confidence_score:obj.confidence_score,
          polygon_coords:wkt.join(', '),
          metadata:{
            capture_size:YOLO_SIZE, zoom_level:CAPTURE_ZOOM,
            timestamp:new Date().toISOString(),
            luas_m2:obj.luas_m2, tile_id:obj.tile_id, tile_size_m:TILE_METER,
            scan_mode:scanMode==='kabupaten'?'kabupaten_scan':'area_scan',
            ...(selectedKabupaten?{kabupaten:selectedKabupaten.properties?.name||selectedKabupaten.properties?.NAMOBJ||''}:{}),
          },
        };
      });
      const res=await axios.post('http://127.0.0.1:8000/api/save-detection/',{features});
      if(res.status===201){toast.success(`${features.length} objek disimpan!`,{id:t,duration:3000});if(onNewData)onNewData();handleReset();}
    } catch(err){toast.error(`Gagal: ${err.response?.data?.message||err.message}`,{id:t});}
    finally{setIsSaving(false);}
  };

  const handleReset=()=>{
    abortRef.current=true;
    setIsScanning(false);setIsPaused(false);setIsDrawingArea(false);
    setScanningTileIdx(-1);setDrawnBounds(null);setTileGrid([]);setPreviewResults([]);
    setTileStats({total:0,done:0,objects:0});setStep('draw');setScanMode('manual');
    setSelectedKabupaten(null);setIsKabupatenClickMode(false);
  };

  const progress=tileStats.total>0?Math.round((tileStats.done/tileStats.total)*100):0;
  const kabName=selectedKabupaten?.properties?.name||selectedKabupaten?.properties?.NAMOBJ||selectedKabupaten?.properties?.KAB_KOTA||'';

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800" onWheel={e=>e.stopPropagation()}>
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/30"><Grid size={14} className="text-white"/></div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-100">Area Scan</h3>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">AI · z{CAPTURE_ZOOM} · {TILE_METER}m/tile</p>
          </div>
          {isScanning&&<div className="ml-auto flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/><span className="text-[9px] font-black text-cyan-500 uppercase tracking-wide">AKTIF</span></div>}
        </div>
        <div className="flex gap-1 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {SCAN_MODES.map(mode=>{
            const Icon=mode.icon,active=step===mode.id,done=(mode.id==='draw'&&activeBounds)||(mode.id==='scan'&&isScanning);
            return (
              <button key={mode.id} onClick={()=>!isScanning&&setStep(mode.id)} disabled={isScanning}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all ${active?'bg-white dark:bg-slate-700 shadow-sm':'hover:bg-white/50 dark:hover:bg-slate-700/50'}`}>
                <div className={active?'text-cyan-600':done?'text-green-500':'text-slate-400'}><Icon size={12}/></div>
                <span className={`text-[8px] font-black uppercase tracking-wider ${active?'text-cyan-600':done?'text-green-500':'text-slate-400'}`}>{mode.label}</span>
                <div className={`w-1 h-1 rounded-full ${active?'bg-cyan-500':'bg-transparent'}`}/>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* ── STEP: DRAW ── */}
        {step==='draw'&&(
          <div className="space-y-3">
            {/* Mode toggle */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-1.5 flex gap-1">
              <button onClick={()=>{setScanMode('manual');handleSelect(null);setIsKabupatenClickMode(false);}}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all ${scanMode==='manual'?'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <Square size={11}/> Gambar Area
              </button>
              <button onClick={()=>{setScanMode('kabupaten');setIsDrawingArea(false);setDrawnBounds(null);}}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all ${scanMode==='kabupaten'?'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md':'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <MapPin size={11}/> Per Kabupaten
              </button>
            </div>

            {/* Manual */}
            {scanMode==='manual'&&(
              <>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  {[{n:1,t:'Navigasi ke lokasi target di peta'},{n:2,t:'Aktifkan mode gambar & drag area scan'},{n:3,t:'Pilih kategori & mulai scan otomatis'}].map(s=>(
                    <div key={s.n} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">{s.n}</span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{s.t}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>{if(isScanning)return;if(isDrawingArea){setIsDrawingArea(false);setDrawnBounds(null);}else setIsDrawingArea(true);}} disabled={isScanning}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${isDrawingArea?'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30':'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25'}`}>
                  {isDrawingArea?<><X size={16}/> Batal Menggambar</>:<><Square size={16}/> Aktifkan Mode Gambar</>}
                </button>
                {isDrawingArea&&!isScanning&&(
                  <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700/40 flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center flex-shrink-0 animate-pulse"><MousePointer2 size={11} className="text-cyan-600"/></div>
                    <div><p className="text-[10px] font-black text-cyan-700 dark:text-cyan-400">Mode gambar aktif</p><p className="text-[9px] text-cyan-600/70">Klik & drag di peta untuk menentukan area</p></div>
                  </div>
                )}
                {drawnBounds&&!isScanning&&(
                  <>
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                      <div className="flex items-center gap-2 mb-1.5"><CheckCircle2 size={12} className="text-green-600"/><span className="text-[10px] font-black text-green-700 dark:text-green-400">Area berhasil ditandai</span></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white dark:bg-green-900/30 rounded-lg p-2 text-center"><div className="text-sm font-black text-green-700 dark:text-green-400">{estTiles.toLocaleString()}</div><div className="text-[8px] text-slate-500 uppercase font-bold">Tile ({TILE_METER}m)</div></div>
                        <div className="bg-white dark:bg-green-900/30 rounded-lg p-2 text-center"><div className="text-sm font-black text-green-700 dark:text-green-400">{estMinutes}</div><div className="text-[8px] text-slate-500 uppercase font-bold">Est. Waktu</div></div>
                      </div>
                    </div>
                    <button onClick={()=>setStep('scan')} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg">Lanjut Konfigurasi <ChevronRight size={16}/></button>
                  </>
                )}
              </>
            )}

            {/* Kabupaten — UI pilih wilayah saja, scan logic identik manual */}
            {scanMode==='kabupaten'&&(
              <div className="space-y-3">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  {[
                    {n:1,t:'Cari nama kabupaten di kolom pencarian'},
                    {n:2,t:'Atau klik langsung wilayah di peta'},
                    {n:3,t:'Tile grid otomatis di-clip ke batas wilayah'},
                  ].map(s=>(
                    <div key={s.n} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-teal-500 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">{s.n}</span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{s.t}</span>
                    </div>
                  ))}
                </div>
                <KabupatenSearchPanel kabupatenList={kabupatenList} selectedKabupaten={selectedKabupaten} onSelect={handleSelect} isLoading={kabupatenLoading}/>
                <button onClick={()=>setIsKabupatenClickMode(v=>!v)}
                  className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border-2 ${isKabupatenClickMode?'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'}`}>
                  {isKabupatenClickMode?<><div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"/> Klik wilayah di peta aktif</>:<><Map size={15}/> Klik Wilayah di Peta</>}
                </button>
                {isKabupatenClickMode&&(
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center flex-shrink-0 animate-pulse"><MousePointer2 size={11} className="text-teal-600"/></div>
                    <div><p className="text-[10px] font-black text-teal-700 dark:text-teal-400">Batas wilayah tampil di peta</p><p className="text-[9px] text-teal-600/70">Klik di dalam kabupaten/kota untuk memilih</p></div>
                  </div>
                )}
                {selectedKabupaten?(
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-teal-500/30"><MapPin size={14} className="text-white"/></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</p>
                        <p className="text-[9px] text-teal-600/70 truncate">{selectedKabupaten.properties?.provinsi||selectedKabupaten.properties?.PROPINSI||''}</p>
                      </div>
                      <button onClick={()=>handleSelect(null)} className="text-teal-400 hover:text-red-400 transition-colors"><X size={12}/></button>
                    </div>
                    {activeBounds&&(
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white dark:bg-teal-900/30 rounded-lg p-2 text-center"><div className="text-sm font-black text-teal-700 dark:text-teal-400">{estTiles.toLocaleString()}</div><div className="text-[8px] text-slate-500 uppercase font-bold">Tile ({TILE_METER}m)</div></div>
                        <div className="bg-white dark:bg-teal-900/30 rounded-lg p-2 text-center"><div className="text-sm font-black text-teal-700 dark:text-teal-400">{estMinutes}</div><div className="text-[8px] text-slate-500 uppercase font-bold">Est. Waktu</div></div>
                      </div>
                    )}
                    <button onClick={()=>setStep('scan')} disabled={estTiles===0}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 disabled:from-slate-400 disabled:to-slate-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
                      Lanjut Konfigurasi <ChevronRight size={14}/>
                    </button>
                  </div>
                ):!kabupatenLoading&&(
                  <div className="py-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3"><MapPin size={20} className="text-slate-400"/></div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Pilih kabupaten via pencarian</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">atau aktifkan mode klik di peta</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: KONFIGURASI ── */}
        {step==='scan'&&(
          <>
            {!activeBounds&&<div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-center"><AlertTriangle size={20} className="text-amber-500 mx-auto mb-2"/><p className="text-xs text-amber-700 font-bold">Tentukan area scan terlebih dahulu</p></div>}
            {scanMode==='kabupaten'&&kabName&&<div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl"><MapPin size={11} className="text-teal-500 flex-shrink-0"/><span className="text-[11px] font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</span><span className="ml-auto text-[9px] text-teal-500 font-bold bg-teal-100 dark:bg-teal-900/40 px-1.5 py-0.5 rounded-full">KAB. SCAN</span></div>}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3"><Zap size={12} className="text-cyan-500"/><p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Konfigurasi Scan</p></div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {l:'Zoom',        v:`z${CAPTURE_ZOOM}`},
                  {l:'Resolusi',    v:`${YOLO_SIZE}px`},
                  {l:'Ukuran Tile', v:`${TILE_METER}m`},
                  {l:'Total Tile',  v:estTiles.toLocaleString()},
                  {l:'Est. Waktu',  v:estMinutes},
                  {l:'Mode',        v:scanMode==='kabupaten'?'Kab. Scan (Clip)':'Area Gambar'},
                ].map(item=>(
                  <div key={item.l} className="bg-slate-50 dark:bg-slate-700/60 rounded-xl p-2.5 text-center">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-200 leading-tight">{item.v}</div>
                    <div className="text-[8px] text-slate-400 mt-0.5 uppercase font-bold">{item.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3"><ScanLine size={12} className="text-cyan-500"/><p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Kategori</p><span className="ml-auto text-[9px] text-slate-400">{selectedCats.length}/{CATEGORIES.length}</span></div>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({id,label,color,Icon})=>(
                  <button key={id} onClick={()=>setSelectedCats(p=>p.includes(id)?p.filter(c=>c!==id):[...p,id])}
                    className={`p-3 rounded-xl border-2 transition-all font-bold text-xs flex items-center gap-2 ${selectedCats.includes(id)?'text-white shadow-md':'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                    style={selectedCats.includes(id)?{backgroundColor:color,borderColor:color}:{}}>
                    <Icon size={14}/> <span>{label}</span>
                    {selectedCats.includes(id)&&<CheckCircle2 size={11} className="ml-auto opacity-80"/>}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleStartScan} disabled={!activeBounds||!selectedCats.length||estTiles===0}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-bold shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Play size={16}/> Mulai Scan ({estTiles.toLocaleString()} tile)
            </button>
          </>
        )}

        {/* ── STEP: HASIL ── */}
        {step==='result'&&(
          <>
            {scanMode==='kabupaten'&&kabName&&<div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl"><MapPin size={11} className="text-teal-500"/><span className="text-[11px] font-black text-teal-700 dark:text-teal-400 truncate">{kabName}</span></div>}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Progress</span><span className="text-xs font-black text-cyan-600">{progress}%</span></div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300 relative overflow-hidden" style={{width:`${progress}%`}}>
                  {isScanning&&<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"/>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  {v:tileStats.total,   l:'Total',   c:'text-slate-700 dark:text-slate-200'},
                  {v:tileStats.done,    l:'Selesai', c:'text-green-600 dark:text-green-400'},
                  {v:tileStats.objects, l:'Objek',   c:'text-amber-600 dark:text-amber-400'},
                ].map(s=>(
                  <div key={s.l} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700"><div className={`text-lg font-black ${s.c}`}>{s.v}</div><div className="text-[8px] text-slate-400 font-black uppercase">{s.l}</div></div>
                ))}
              </div>
            </div>
            {isScanning&&(
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handlePauseResume} className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${isPaused?'bg-cyan-500 text-white shadow-md':'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'}`}>
                  {isPaused?<><Play size={13}/> Lanjut</>:<><Pause size={13}/> Jeda</>}
                </button>
                <button onClick={()=>{abortRef.current=true;setIsScanning(false);}} className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800">
                  <Square size={13}/> Hentikan
                </button>
              </div>
            )}
            {tileGrid.length>0&&(
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-widest">Tile Grid ({tileGrid.length})</p>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {tileGrid.map((tile,idx)=>(
                    <div key={tile.id} className={`flex items-center gap-2 p-1.5 rounded-lg text-[10px] transition-all ${idx===scanningTileIdx?'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800':'bg-slate-50 dark:bg-slate-700/50'}`}>
                      <span className="font-mono text-slate-400 w-7 text-right">{String(idx+1).padStart(2,'0')}</span>
                      <span className="flex-1 text-slate-500 dark:text-slate-400">R{tile.row+1}C{tile.col+1}</span>
                      {tile.count>0&&<span className="font-bold text-green-600">{tile.count}</span>}
                      <StatusBadge status={tile.status}/>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isScanning&&<button onClick={handleReset} className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 hover:border-red-300 hover:text-red-500 transition-all"><RotateCcw size={14}/> Reset &amp; Scan Ulang</button>}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30 flex items-center justify-between">
        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-medium">
          {tileGrid.length>0
            ? `${tileGrid.length} tile · ${TILE_METER}m · z${CAPTURE_ZOOM}${kabName?' · '+kabName:''}`
            : scanMode==='kabupaten'
              ? `Kab. Scan · ${TILE_METER}m · z${CAPTURE_ZOOM}`
              : `GeoAI Scanner · z${CAPTURE_ZOOM}`
          }
        </p>
        {(activeBounds||tileGrid.length>0)&&!isScanning&&<button onClick={handleReset} className="text-[10px] text-red-400 hover:text-red-600 font-bold flex items-center gap-1"><Trash2 size={10}/> Reset</button>}
      </div>

      <SummaryPanel results={previewResults} tileStats={tileStats} onSave={handleSaveAll} onCancel={handleReset} isSaving={isSaving} isScanning={isScanning}/>
    </div>
  );
}