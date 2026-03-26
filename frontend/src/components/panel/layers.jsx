"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import { Globe, MapPin, Map, Layers as LayersIcon, Hotel, Building2, ShoppingBag, Wrench } from 'lucide-react';

// ─── Konfigurasi layer batas wilayah ─────────────────────────────────────────

const BOUNDARY_LAYERS = [
  {
    id: 'batas_provinsi',
    label: 'Batas Provinsi',
    description: 'Garis batas antar provinsi',
    icon: <Globe size={14} />,
  },
  {
    id: 'batas_kabupaten',
    label: 'Batas Kabupaten',
    description: 'Garis batas kabupaten/kota',
    icon: <MapPin size={14} />,
  },
];

// ─── Konfigurasi layer waypoint sarana prasarana ──────────────────────────────

const WAYPOINT_LAYERS = [
  {
    id: 'waypoint_sarana_prasarana',
    label: 'Sarana Prasarana',
    description: 'Fasilitas umum & infrastruktur',
    category: 'sarana_prasarana',
    endpoint: '/api/waypoint/sarana-prasarana/',
    color: '#8b5cf6',
    emoji: '🏗️',
    icon: <Wrench size={14} />,
  },
  {
    id: 'waypoint_hotel',
    label: 'Hotel',
    description: 'Hotel & penginapan',
    category: 'hotel',
    endpoint: '/api/waypoint/hotel/',
    color: '#f59e0b',
    emoji: '🏨',
    icon: <Hotel size={14} />,
  },
  {
    id: 'waypoint_kantor',
    label: 'Kantor',
    description: 'Kantor pemerintah & swasta',
    category: 'kantor',
    endpoint: '/api/waypoint/kantor/',
    color: '#3b82f6',
    emoji: '🏢',
    icon: <Building2 size={14} />,
  },
  {
    id: 'waypoint_perbelanjaan',
    label: 'Perbelanjaan',
    description: 'Pasar, mall & pusat belanja',
    category: 'perbelanjaan',
    endpoint: '/api/waypoint/perbelanjaan/',
    color: '#10b981',
    emoji: '🛍️',
    icon: <ShoppingBag size={14} />,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLuas(m2) {
  if (m2 == null) return null;
  const km2 = m2 / 1_000_000;
  return `${km2.toLocaleString('id-ID', { maximumFractionDigits: 2 })} km²`;
}

function formatCoord(val, isLat) {
  if (val == null) return '-';
  const abs = Math.abs(val).toFixed(4);
  const dir = isLat ? (val >= 0 ? 'LU' : 'LS') : (val >= 0 ? 'BT' : 'BB');
  return `${abs}° ${dir}`;
}

const ROW = 'display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;';
const LBL = 'font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;';
const VAL = 'font-size:12px;font-weight:700;color:#1e293b;text-align:right;max-width:140px;';

function row(label, value, color = '') {
  if (!value && value !== 0) return '';
  return `<div style="${ROW}">
    <span style="${LBL}">${label}</span>
    <span style="${VAL}${color ? `color:${color};` : ''}">${value}</span>
  </div>`;
}

// ─── Popup Builders ───────────────────────────────────────────────────────────

function buildProvinsiPopup(props) {
  const name  = props.name  || props.NAMOBJ || 'Tanpa Nama';
  const code  = props.code  || props.KODE   || '';
  const luas  = formatLuas(props.luas_wilayah_m2);
  const pulau = props.jumlah_pulau != null
    ? `${Number(props.jumlah_pulau).toLocaleString('id-ID')} pulau`
    : null;
  const lat   = props.latitude  ?? props.LAT;
  const lng   = props.longitude ?? props.LNG;
  const coord = lat != null
    ? `${formatCoord(lat, true)},&nbsp;${formatCoord(lng, false)}`
    : null;

  return `
    <div style="font-family:inherit;min-width:230px;padding:2px;">
      <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);color:white;
                  padding:11px 13px;border-radius:10px 10px 4px 4px;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:800;opacity:0.8;text-transform:uppercase;
                    letter-spacing:0.12em;margin-bottom:3px;">Provinsi</div>
        <div style="font-size:16px;font-weight:900;letter-spacing:0.01em;">${name}</div>
      </div>
      <div style="padding:0 4px 4px;">
        ${row('Kode Wilayah', code)}
        ${row('Luas Wilayah', luas, '#0ea5e9')}
        ${row('Jumlah Pulau', pulau, '#8b5cf6')}
        ${row('Koordinat', coord)}
      </div>
    </div>`;
}

function buildKabupatenPopup(props) {
  const name = props.name || props.NAMOBJ || props.KAB_KOTA || props.KABUPATEN || 'Tanpa Nama';
  const code = props.code || props.KODE || '';
  const prov = props.provinsi || props.PROPINSI || props.Propinsi || '';
  const tipe = props.type_wilayah || props.TIPE || '';

  return `
    <div style="font-family:inherit;min-width:210px;padding:2px;">
      <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;
                  padding:11px 13px;border-radius:10px 10px 4px 4px;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:800;opacity:0.8;text-transform:uppercase;
                    letter-spacing:0.12em;margin-bottom:3px;">Kabupaten / Kota</div>
        <div style="font-size:16px;font-weight:900;letter-spacing:0.01em;">${name}</div>
      </div>
      <div style="padding:0 4px 4px;">
        ${row('Kode Wilayah', code)}
        ${row('Tipe', tipe)}
        ${row('Provinsi', prov, '#10b981')}
      </div>
    </div>`;
}

// ─── Hook: Boundary ───────────────────────────────────────────────────────────

export function useBoundaryData(activeLayers) {
  const [boundaryData, setBoundaryData] = useState({ provinsi: null, kabupaten: null });

  const fetchBoundaryData = async (type) => {
    try {
      const endpoint = type === 'provinsi' ? '/api/batas-provinsi/' : '/api/batas-kabupaten/';
      const res = await axios.get(`http://127.0.0.1:8000${endpoint}`);
      setBoundaryData(prev => ({ ...prev, [type]: res.data }));
    } catch (err) {
      console.error(`Gagal mengambil data batas ${type}:`, err);
    }
  };

  useEffect(() => {
    if (activeLayers.includes('batas_provinsi')  && !boundaryData.provinsi)  fetchBoundaryData('provinsi');
    if (activeLayers.includes('batas_kabupaten') && !boundaryData.kabupaten) fetchBoundaryData('kabupaten');
  }, [activeLayers, boundaryData]);

  const getBoundaryStyle = (type) =>
    type === 'provinsi'
      ? { color: '#006aff', weight: 2, fillColor: 'transparent', fillOpacity: 0, dashArray: '8,8', opacity: 0.7 }
      : { color: '#fffb00', weight: 2, fillColor: 'transparent', fillOpacity: 0, dashArray: '4,4', opacity: 0.6 };

  const onEachBoundary = (feature, layer, type) => {
    const props   = feature.properties || {};
    const content = type === 'provinsi' ? buildProvinsiPopup(props) : buildKabupatenPopup(props);
    layer.bindPopup(content, { maxWidth: 290 });

    layer.on({
      mouseover: (e) => e.target.setStyle({ weight: type === 'provinsi' ? 3 : 2, dashArray: '0', opacity: 1 }),
      mouseout:  (e) => e.target.setStyle(getBoundaryStyle(type)),
    });
  };

  return { boundaryData, getBoundaryStyle, onEachBoundary, fetchBoundaryData };
}

// ─── Hook: Waypoint Sarana Prasarana ─────────────────────────────────────────

export function useWaypointData(activeLayers) {
  // { layerId: FeatureCollection | null }
  const [waypointData, setWaypointData] = useState(
    Object.fromEntries(WAYPOINT_LAYERS.map(l => [l.id, null]))
  );

  useEffect(() => {
    WAYPOINT_LAYERS.forEach(async (layer) => {
      // Fetch hanya jika layer baru diaktifkan dan belum ada datanya
      if (activeLayers.includes(layer.id) && !waypointData[layer.id]) {
        try {
          const res = await axios.get(`http://127.0.0.1:8000${layer.endpoint}`);
          setWaypointData(prev => ({ ...prev, [layer.id]: res.data }));
        } catch (err) {
          console.error(`Gagal mengambil data waypoint ${layer.id}:`, err);
        }
      }
    });
  }, [activeLayers]);

  return { waypointData };
}

// ─── GeoJSON Layer: Boundary ──────────────────────────────────────────────────

export function BoundaryLayer({ activeLayers, boundaryData, getBoundaryStyle, onEachBoundary }) {
  if (!boundaryData) return null;
  return (
    <>
      {activeLayers.includes('batas_provinsi') && boundaryData.provinsi && (
        <GeoJSON
          key="batas-provinsi"
          data={boundaryData.provinsi}
          style={getBoundaryStyle('provinsi')}
          onEachFeature={(f, l) => onEachBoundary(f, l, 'provinsi')}
        />
      )}
      {activeLayers.includes('batas_kabupaten') && boundaryData.kabupaten && (
        <GeoJSON
          key="batas-kabupaten"
          data={boundaryData.kabupaten}
          style={getBoundaryStyle('kabupaten')}
          onEachFeature={(f, l) => onEachBoundary(f, l, 'kabupaten')}
        />
      )}
    </>
  );
}

// ─── Waypoint Marker Layer ────────────────────────────────────────────────────

export function WaypointLayer({ activeLayers, waypointData }) {
  return (
    <>
      {WAYPOINT_LAYERS.map((layer) => {
        if (!activeLayers.includes(layer.id)) return null;
        const fc = waypointData[layer.id];
        if (!fc?.features?.length) return null;

        return fc.features.map((feature, i) => {
          const coords = feature?.geometry?.coordinates; // [lng, lat]
          if (!coords) return null;
          const props = feature.properties || {};

          return (
            <CircleMarker
              key={`${layer.id}-${i}`}
              center={[coords[1], coords[0]]}
              radius={7}
              pathOptions={{
                color: layer.color,
                fillColor: layer.color,
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'inherit', minWidth: '180px', padding: '2px' }}>
                  <div style={{
                    background: layer.color,
                    color: 'white',
                    padding: '8px 11px',
                    borderRadius: '8px 8px 3px 3px',
                    marginBottom: '6px',
                  }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                      {layer.emoji} {layer.label}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 900 }}>
                      {props.name || 'Tanpa Nama'}
                    </div>
                  </div>
                  <div style={{ padding: '0 4px 4px', fontSize: '11px', color: '#475569' }}>
                    {props.address && <p style={{ margin: '2px 0' }}>📍 {props.address}</p>}
                    {props.type    && <p style={{ margin: '2px 0' }}>🏷️ {props.type}</p>}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        });
      })}
    </>
  );
}

// ─── Panel UI ─────────────────────────────────────────────────────────────────

export default function LayersPanel({ activeLayers, onToggleLayer }) {
  return (
    <div
      className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
        <h3 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <LayersIcon size={20} />
          Layer Kontrol
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Kelola tampilan batas wilayah & sarana prasarana
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── Batas Wilayah ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Map size={14} className="text-cyan-500" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Batas Wilayah
            </span>
          </div>
          <div className="space-y-3">
            {BOUNDARY_LAYERS.map(layer => {
              const isActive = activeLayers.includes(layer.id);
              return (
                <button
                  key={layer.id}
                  onClick={() => onToggleLayer(layer.id)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all flex items-start gap-3 text-left ${
                    isActive
                      ? 'border-cyan-500 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 shadow-lg'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    isActive
                      ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  }`}>
                    {layer.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${
                      isActive ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {layer.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {layer.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg animate-pulse mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Sarana Prasarana ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={14} className="text-violet-500" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Sarana Prasarana
            </span>
          </div>
          <div className="space-y-3">
            {WAYPOINT_LAYERS.map(layer => {
              const isActive = activeLayers.includes(layer.id);
              return (
                <button
                  key={layer.id}
                  onClick={() => onToggleLayer(layer.id)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all flex items-start gap-3 text-left ${
                    isActive
                      ? 'border-2 shadow-lg'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  style={isActive ? {
                    borderColor: layer.color,
                    background: `${layer.color}18`,
                  } : {}}
                >
                  <div
                    className="p-2 rounded-lg"
                    style={isActive
                      ? { backgroundColor: `${layer.color}25`, color: layer.color }
                      : { backgroundColor: 'rgb(241 245 249)', color: '#94a3b8' }
                    }
                  >
                    {layer.icon}
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-bold"
                      style={isActive ? { color: layer.color } : {}}
                    >
                      {layer.emoji} {layer.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {layer.description}
                    </p>
                  </div>
                  {isActive && (
                    <div
                      className="w-3 h-3 rounded-full shadow-lg animate-pulse mt-1"
                      style={{ backgroundColor: layer.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}