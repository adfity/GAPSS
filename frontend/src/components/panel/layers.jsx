"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import {
  Globe, MapPin, Layers as LayersIcon,
  GraduationCap, School, BookOpen, Baby,
  ChevronUp, ChevronDown,
} from 'lucide-react';

// ─── Data Layer ───────────────────────────────────────────────────────────────

const BOUNDARY_LAYERS = [
  { id: 'batas_provinsi',  label: 'Batas Provinsi',  description: 'Garis batas antar provinsi', icon: <Globe size={13} /> },
  { id: 'batas_kabupaten', label: 'Batas Kabupaten', description: 'Garis batas kabupaten/kota', icon: <MapPin size={13} /> },
];

export const WAYPOINT_LAYERS = [
  {
    id:          'waypoint_university',
    label:       'Universitas / Institut',
    description: 'Perguruan tinggi & institut',
    category:    'university',
    endpoint:    '/api/waypoint/pendidikan/university/',
    color:       '#2563eb',
    icon:        <GraduationCap size={13} />,
  },
  {
    id:          'waypoint_college',
    label:       'Politeknik / Akademi',
    description: 'D3/D4, Politeknik, Akademi',
    category:    'college',
    endpoint:    '/api/waypoint/pendidikan/college/',
    color:       '#7c3aed',
    icon:        <BookOpen size={13} />,
  },
  {
    id:          'waypoint_school',
    label:       'Sekolah (SD/SMP/SMA)',
    description: 'SD, SMP, SMA, SMK, Madrasah',
    category:    'school',
    endpoint:    '/api/waypoint/pendidikan/school/',
    color:       '#0891b2',
    icon:        <School size={13} />,
  },
  {
    id:          'waypoint_kindergarten',
    label:       'TK / PAUD',
    description: 'Taman Kanak-kanak & PAUD',
    category:    'kindergarten',
    endpoint:    '/api/waypoint/pendidikan/kindergarten/',
    color:       '#16a34a',
    icon:        <Baby size={13} />,
  },
];

const LEGEND_MAP = {
  batas_provinsi:        { label: 'Batas Provinsi',        color: '#006aff', type: 'dashed' },
  batas_kabupaten:       { label: 'Batas Kabupaten',       color: '#fffb00', type: 'dashed' },
  waypoint_university:   { label: 'Universitas / Institut', color: '#2563eb', type: 'dot'    },
  waypoint_college:      { label: 'Politeknik / Akademi',  color: '#7c3aed', type: 'dot'    },
  waypoint_school:       { label: 'Sekolah',               color: '#0891b2', type: 'dot'    },
  waypoint_kindergarten: { label: 'TK / PAUD',             color: '#16a34a', type: 'dot'    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLuas(m2) {
  if (m2 == null) return null;
  return `${(m2 / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} km²`;
}
function formatCoord(val, isLat) {
  if (val == null) return '-';
  const dir = isLat ? (val >= 0 ? 'LU' : 'LS') : (val >= 0 ? 'BT' : 'BB');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
}
const ROW = 'display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;';
const LBL = 'font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;';
const VAL = 'font-size:12px;font-weight:700;color:#1e293b;text-align:right;max-width:140px;';
function popupRow(label, value, color = '') {
  if (!value && value !== 0) return '';
  return `<div style="${ROW}"><span style="${LBL}">${label}</span><span style="${VAL}${color ? `color:${color};` : ''}">${value}</span></div>`;
}

// ─── Popup Builders ───────────────────────────────────────────────────────────

function buildProvinsiPopup(props) {
  const name  = props.name || props.NAMOBJ || 'Tanpa Nama';
  const code  = props.code || props.KODE   || '';
  const luas  = formatLuas(props.luas_wilayah_m2);
  const pulau = props.jumlah_pulau != null ? `${Number(props.jumlah_pulau).toLocaleString('id-ID')} pulau` : null;
  const lat   = props.latitude ?? props.LAT;
  const lng   = props.longitude ?? props.LNG;
  const coord = lat != null ? `${formatCoord(lat, true)},&nbsp;${formatCoord(lng, false)}` : null;
  return `<div style="font-family:inherit;min-width:230px;padding:2px;">
    <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);color:white;padding:11px 13px;border-radius:10px 10px 4px 4px;margin-bottom:8px;">
      <div style="font-size:9px;font-weight:800;opacity:.8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px;">Provinsi</div>
      <div style="font-size:16px;font-weight:900;">${name}</div>
    </div>
    <div style="padding:0 4px 4px;">
      ${popupRow('Kode Wilayah', code)}${popupRow('Luas Wilayah', luas, '#0ea5e9')}${popupRow('Jumlah Pulau', pulau, '#8b5cf6')}${popupRow('Koordinat', coord)}
    </div>
  </div>`;
}

function buildKabupatenPopup(props) {
  const name = props.name || props.NAMOBJ || props.KAB_KOTA || 'Tanpa Nama';
  const code = props.code || props.KODE || '';
  const prov = props.provinsi || props.PROPINSI || '';
  const tipe = props.type_wilayah || props.TIPE || '';
  return `<div style="font-family:inherit;min-width:210px;padding:2px;">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:11px 13px;border-radius:10px 10px 4px 4px;margin-bottom:8px;">
      <div style="font-size:9px;font-weight:800;opacity:.8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px;">Kabupaten / Kota</div>
      <div style="font-size:16px;font-weight:900;">${name}</div>
    </div>
    <div style="padding:0 4px 4px;">
      ${popupRow('Kode Wilayah', code)}${popupRow('Tipe', tipe)}${popupRow('Provinsi', prov, '#10b981')}
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
    } catch (err) { console.error(`Gagal fetch batas ${type}:`, err); }
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
      mouseover: (e) => e.target.setStyle({ weight: 3, dashArray: '0', opacity: 1 }),
      mouseout:  (e) => e.target.setStyle(getBoundaryStyle(type)),
    });
  };

  return { boundaryData, getBoundaryStyle, onEachBoundary };
}

// ─── Hook: Waypoint Pendidikan ────────────────────────────────────────────────

export function useWaypointData(activeLayers) {
  const [waypointData, setWaypointData] = useState(
    Object.fromEntries(WAYPOINT_LAYERS.map(l => [l.id, null]))
  );

  useEffect(() => {
    WAYPOINT_LAYERS.forEach(async (layer) => {
      if (activeLayers.includes(layer.id) && !waypointData[layer.id]) {
        try {
          const res = await axios.get(`http://127.0.0.1:8000${layer.endpoint}`);
          setWaypointData(prev => ({ ...prev, [layer.id]: res.data }));
        } catch (err) { console.error(`Gagal fetch waypoint ${layer.id}:`, err); }
      }
    });
  }, [activeLayers]);

  return { waypointData };
}

// ─── Map Layers ───────────────────────────────────────────────────────────────

export function BoundaryLayer({ activeLayers, boundaryData, getBoundaryStyle, onEachBoundary }) {
  if (!boundaryData) return null;
  return (
    <>
      {activeLayers.includes('batas_provinsi') && boundaryData.provinsi && (
        <GeoJSON key="batas-provinsi" data={boundaryData.provinsi} style={getBoundaryStyle('provinsi')} onEachFeature={(f, l) => onEachBoundary(f, l, 'provinsi')} />
      )}
      {activeLayers.includes('batas_kabupaten') && boundaryData.kabupaten && (
        <GeoJSON key="batas-kabupaten" data={boundaryData.kabupaten} style={getBoundaryStyle('kabupaten')} onEachFeature={(f, l) => onEachBoundary(f, l, 'kabupaten')} />
      )}
    </>
  );
}

export function WaypointLayer({ activeLayers, waypointData }) {
  return (
    <>
      {WAYPOINT_LAYERS.map((layer) => {
        if (!activeLayers.includes(layer.id)) return null;
        const fc = waypointData[layer.id];
        if (!fc?.features?.length) return null;

        return fc.features.map((feature, i) => {
          const coords = feature?.geometry?.coordinates;
          if (!coords) return null;
          const props = feature.properties || {};

          return (
            <CircleMarker
              key={`${layer.id}-${i}`}
              center={[coords[1], coords[0]]}
              radius={6}
              pathOptions={{ color: layer.color, fillColor: layer.color, fillOpacity: 0.85, weight: 2 }}
            >
              <Popup>
                <div style={{ fontFamily: 'inherit', minWidth: 200, padding: 2 }}>
                  <div style={{ background: layer.color, color: 'white', padding: '8px 11px', borderRadius: '8px 8px 3px 3px', marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, opacity: .85, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>
                      {props.type_label || layer.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{props.name || 'Tanpa Nama'}</div>
                  </div>
                  <div style={{ padding: '0 4px 4px', fontSize: 11, color: '#475569' }}>
                    {props.amenity      && <p style={{ margin: '2px 0' }}>{props.amenity}</p>}
                    {props['addr:city'] && <p style={{ margin: '2px 0' }}>{props['addr:city']}</p>}
                    {props.operator     && <p style={{ margin: '2px 0' }}>{props.operator}</p>}
                    {props.website      && (
                      <p style={{ margin: '2px 0' }}>
                        <a href={props.website} target="_blank" rel="noopener noreferrer"
                          style={{ color: layer.color }}>{props.website}</a>
                      </p>
                    )}
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

// ─── UI Sub-components ────────────────────────────────────────────────────────

// Sub-judul section — font seragam untuk semua section
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

// Checkbox item kompak — kotak kecil + label kecil, persis seperti screenshot
function CheckItem({ checked, onChange, label, colorSwatch }) {
  return (
    <label
      className="flex items-center gap-2 cursor-pointer select-none group"
      onClick={onChange}
    >
      {/* Kotak checkbox */}
      <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all
        ${checked ? 'border-orange-500 bg-orange-500' : 'border-gray-400 bg-white group-hover:border-orange-400'}`}>
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4l1.8 1.8L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>

      {/* Dot warna untuk waypoint */}
      {colorSwatch && (
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: colorSwatch }}
        />
      )}

      {/* Label teks */}
      <span className={`text-[11px] leading-tight ${checked ? 'text-orange-600 font-semibold' : 'text-gray-600'}`}>
        {label}
      </span>
    </label>
  );
}

function Divider() {
  return <div className="border-t border-orange-100 my-2" />;
}

// ─── Legend Bar ───────────────────────────────────────────────────────────────

function LegendBar({ activeLayers, isOpen, onToggle }) {
  const items = activeLayers.filter(id => LEGEND_MAP[id]);
  return (
    <div className="border-t-2 border-orange-400 bg-white flex-shrink-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-orange-50 transition-colors"
      >
        {/* Sub-judul legend sama dengan section lain */}
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Keterangan</span>
        {isOpen
          ? <ChevronDown size={12} className="text-orange-500" />
          : <ChevronUp   size={12} className="text-orange-500" />
        }
      </button>

      {isOpen && (
        <div className="overflow-y-auto px-3 pb-2 space-y-1" style={{ maxHeight: 130 }}>
          {items.length === 0
            ? <p className="text-[10px] text-gray-400 italic py-1">Belum ada layer yang diaktifkan.</p>
            : items.map(id => {
                const leg = LEGEND_MAP[id];
                return (
                  <div key={id} className="flex items-center gap-2 py-0.5">
                    {leg.type === 'dot'
                      ? <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: leg.color }} />
                      : <span className="flex-shrink-0" style={{ display: 'inline-block', width: 18, height: 0, borderTop: `2px dashed ${leg.color}` }} />
                    }
                    <span className="text-[11px] text-gray-700">{leg.label}</span>
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function LayersPanel({ activeLayers, onToggleLayer }) {
  const [legendOpen, setLegendOpen] = useState(true);

  return (
    <div
      className="flex flex-col bg-white"
      style={{ height: '100%', fontFamily: "'Segoe UI', Arial, sans-serif" }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b-2 border-orange-400 flex-shrink-0">
        <span className="w-6 h-6 flex items-center justify-center bg-orange-500 rounded">
          <LayersIcon size={14} color="white" />
        </span>
        <span className="text-[16px] font-black text-orange-500 uppercase tracking-wide">Layer Services</span>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2.5 space-y-2">

          {/* Batas Wilayah */}
          <div>
            <SectionLabel>Batas Wilayah</SectionLabel>
            <div className="space-y-1.5">
              {BOUNDARY_LAYERS.map(layer => (
                <CheckItem
                  key={layer.id}
                  checked={activeLayers.includes(layer.id)}
                  onChange={() => onToggleLayer(layer.id)}
                  label={layer.label}
                />
              ))}
            </div>
          </div>

          <Divider />

          {/* Sarana Pendidikan */}
          <div>
            <SectionLabel>Sarana Pendidikan</SectionLabel>
            <div className="space-y-1.5">
              {WAYPOINT_LAYERS.map(layer => (
                <CheckItem
                  key={layer.id}
                  checked={activeLayers.includes(layer.id)}
                  onChange={() => onToggleLayer(layer.id)}
                  label={layer.label}
                  colorSwatch={layer.color}
                />
              ))}
            </div>
          </div>

        </div>
      </div>


      {/* ── Legend ── */}
      <LegendBar
        activeLayers={activeLayers}
        isOpen={legendOpen}
        onToggle={() => setLegendOpen(v => !v)}
      />
    </div>
  );
}