"use client";
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import { Search, X, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Styling ──────────────────────────────────────────────────────────────────

const glass = [
  "bg-white/85 dark:bg-slate-900/85",
  "backdrop-blur-md",
  "border border-white/70 dark:border-slate-700/60",
  "shadow-[0_4px_20px_rgba(0,0,0,0.12)]",
].join(" ");

const NAVBAR_H   = 56;
const LEFT_PX    = 12;
const TOP_ZOOM   = NAVBAR_H + 12;
const TOP_CLEAN  = TOP_ZOOM + 90 + 8;
const TOP_SEARCH = TOP_CLEAN + 36 + 8;

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getNamaWilayah(properties = {}) {
  return (
    properties.Propinsi  || properties.PROPINSI  ||
    properties.Provinsi  || properties.provinsi  ||
    properties.NAMOBJ    || properties.name      ||
    properties.NAME      || properties.KAB_KOTA  ||
    properties.KABUPATEN || properties.kabupaten ||
    ''
  );
}

function formatLuas(m2) {
  if (m2 == null) return null;
  return `${(m2 / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} km²`;
}

function formatCoord(val, isLat) {
  if (val == null) return '-';
  return `${Math.abs(val).toFixed(4)}° ${isLat ? (val >= 0 ? 'LU' : 'LS') : (val >= 0 ? 'BT' : 'BB')}`;
}

function buildProvinsiPopup(p) {
  const luas  = formatLuas(p.luas_wilayah_m2);
  const pulau = p.jumlah_pulau != null
    ? `${Number(p.jumlah_pulau).toLocaleString('id-ID')} pulau` : null;
  const lat = p.latitude  ?? p.LAT;
  const lng = p.longitude ?? p.LNG;
  const ROW = 'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;';
  const LBL = 'font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;';
  const VAL = 'font-size:12px;font-weight:700;color:#1e293b;text-align:right;';
  const rows = [
    p.code  ? `<div style="${ROW}"><span style="${LBL}">Kode</span><span style="${VAL}">${p.code}</span></div>` : '',
    luas    ? `<div style="${ROW}"><span style="${LBL}">Luas</span><span style="${VAL};color:#0ea5e9;">${luas}</span></div>` : '',
    pulau   ? `<div style="${ROW}"><span style="${LBL}">Pulau</span><span style="${VAL};color:#8b5cf6;">${pulau}</span></div>` : '',
    lat != null ? `<div style="${ROW}"><span style="${LBL}">Koordinat</span><span style="${VAL};font-size:11px;">${formatCoord(lat,true)}, ${formatCoord(lng,false)}</span></div>` : '',
  ].filter(Boolean).join('');
  return `
    <div style="font-family:inherit;min-width:220px;padding:2px;">
      <div style="background:linear-gradient(135deg,#006aff,#2563eb);color:white;
                  padding:10px 13px;border-radius:10px 10px 4px 4px;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:800;opacity:0.8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:2px;">Provinsi</div>
        <div style="font-size:16px;font-weight:900;">${p.name || p.NAMOBJ || ''}</div>
      </div>
      <div style="padding:0 4px 4px;">${rows}</div>
    </div>`;
}

function buildKabupatenPopup(p) {
  const name = getNamaWilayah(p);
  const prov = p.provinsi || p.PROPINSI || p.Propinsi || '';
  return `
    <div style="font-family:inherit;min-width:200px;padding:2px;">
      <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;
                  padding:10px 13px;border-radius:10px 10px 4px 4px;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:800;opacity:0.8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:2px;">Kabupaten / Kota</div>
        <div style="font-size:16px;font-weight:900;">${name}</div>
      </div>
      <div style="padding:0 4px 4px;">
        ${p.code ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Kode</span><span style="font-size:12px;font-weight:700;color:#1e293b;">${p.code}</span></div>` : ''}
        ${prov   ? `<div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Provinsi</span><span style="font-size:12px;font-weight:700;color:#10b981;">${prov}</span></div>` : ''}
      </div>
    </div>`;
}

function buildWaypointPopup(item, layerLabel, layerColor) {
  const name = item.name || item.nama || 'Tanpa Nama';
  const ROW = 'display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;';
  const LBL = 'font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;';
  const VAL = 'font-size:11px;font-weight:600;color:#1e293b;text-align:right;';
  const rows = [
    item.amenity       ? `<div style="${ROW}"><span style="${LBL}">Tipe</span><span style="${VAL}">${item.amenity}</span></div>` : '',
    item['addr:city']  ? `<div style="${ROW}"><span style="${LBL}">Kota</span><span style="${VAL}">${item['addr:city']}</span></div>` : '',
    item.operator      ? `<div style="${ROW}"><span style="${LBL}">Operator</span><span style="${VAL}">${item.operator}</span></div>` : '',
    item.opening_hours ? `<div style="${ROW}"><span style="${LBL}">Jam</span><span style="${VAL}">${item.opening_hours}</span></div>` : '',
    item.phone         ? `<div style="${ROW}"><span style="${LBL}">Telepon</span><span style="${VAL}">${item.phone}</span></div>` : '',
  ].filter(Boolean).join('');
  
  return `
    <div style="font-family:inherit;min-width:210px;padding:2px;">
      <div style="background:linear-gradient(135deg,${layerColor},${layerColor}dd);color:white;
                  padding:10px 13px;border-radius:10px 10px 4px 4px;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:800;opacity:0.8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:2px;">${layerLabel}</div>
        <div style="font-size:14px;font-weight:900;">${name}</div>
      </div>
      <div style="padding:0 4px 4px;">${rows}</div>
    </div>`;
}

// ─── Layer Definitions ────────────────────────────────────────────────────────

const WAYPOINT_CONFIG = [
  // Pendidikan
  { id: 'waypoint_university',   label: 'Universitas', color: '#3b82f6', endpoint: '/api/waypoint/pendidikan/university/' },
  { id: 'waypoint_college',      label: 'Politeknik / Akademi', color: '#8b5cf6', endpoint: '/api/waypoint/pendidikan/college/' },
  { id: 'waypoint_school',       label: 'Sekolah', color: '#06b6d4', endpoint: '/api/waypoint/pendidikan/school/' },
  { id: 'waypoint_kindergarten', label: 'TK / PAUD', color: '#10b981', endpoint: '/api/waypoint/pendidikan/kindergarten/' },
  // Kesehatan
  { id: 'waypoint_hospital',    label: 'Rumah Sakit', color: '#ef4444', endpoint: '/api/waypoint/kesehatan/hospital/' },
  { id: 'waypoint_clinic',      label: 'Klinik / Puskesmas', color: '#f97316', endpoint: '/api/waypoint/kesehatan/clinic/' },
  { id: 'waypoint_health_post', label: 'Pos Kesehatan', color: '#eab308', endpoint: '/api/waypoint/kesehatan/health-post/' },
  { id: 'waypoint_pharmacy',    label: 'Apotek / Farmasi', color: '#22c55e', endpoint: '/api/waypoint/kesehatan/pharmacy/' },
  // Pemerintahan
  { id: 'waypoint_townhall',          label: 'Kantor Walikota / Bupati', color: '#3b82f6', endpoint: '/api/waypoint/pemerintahan/townhall/' },
  { id: 'waypoint_village_office',    label: 'Kantor Desa / Kelurahan', color: '#0ea5e9', endpoint: '/api/waypoint/pemerintahan/village-office/' },
  { id: 'waypoint_government_office', label: 'Kantor Pemerintahan', color: '#38bdf8', endpoint: '/api/waypoint/pemerintahan/government-office/' },
  { id: 'waypoint_ministry',          label: 'Kementerian / Direktorat', color: '#6366f1', endpoint: '/api/waypoint/pemerintahan/ministry/' },
  { id: 'waypoint_police',            label: 'Kepolisian', color: '#1d4ed8', endpoint: '/api/waypoint/pemerintahan/police/' },
  { id: 'waypoint_fire_station',      label: 'Pemadam Kebakaran', color: '#dc2626', endpoint: '/api/waypoint/pemerintahan/fire-station/' },
  { id: 'waypoint_courthouse',        label: 'Pengadilan / Kejaksaan', color: '#9333ea', endpoint: '/api/waypoint/pemerintahan/courthouse/' },
  { id: 'waypoint_immigration',       label: 'Kantor Imigrasi', color: '#14b8a6', endpoint: '/api/waypoint/pemerintahan/immigration/' },
  { id: 'waypoint_tax_office',        label: 'Kantor Pajak', color: '#d97706', endpoint: '/api/waypoint/pemerintahan/tax-office/' },
  { id: 'waypoint_legislative',       label: 'Lembaga Legislatif', color: '#059669', endpoint: '/api/waypoint/pemerintahan/legislative/' },
  // MBG
  { id: 'waypoint_mbg_community',   label: 'Pusat Komunitas / MBG', color: '#16a34a', endpoint: '/api/waypoint/mbg/community-centre/' },
  { id: 'waypoint_mbg_kitchen',     label: 'Dapur Umum', color: '#f97316', endpoint: '/api/waypoint/mbg/kitchen/' },
  { id: 'waypoint_mbg_food_centre', label: 'Pusat Makan Bergizi', color: '#ef4444', endpoint: '/api/waypoint/mbg/food-centre/' },
  { id: 'waypoint_mbg_nutrition',   label: 'Pusat Gizi / Kebun Gizi', color: '#22c55e', endpoint: '/api/waypoint/mbg/nutrition-centre/' },
  { id: 'waypoint_mbg_canteen',     label: 'Kantin / Warung MBG', color: '#ca8a04', endpoint: '/api/waypoint/mbg/canteen/' },
  // Pertahanan
  { id: 'waypoint_mil_base',       label: 'Markas / Pangkalan Militer', color: '#16a34a', endpoint: '/api/waypoint/pertahanan/base/' },
  { id: 'waypoint_mil_barracks',   label: 'Batalyon / Asrama Militer', color: '#15803d', endpoint: '/api/waypoint/pertahanan/barracks/' },
  { id: 'waypoint_mil_checkpoint', label: 'Pos Pemeriksaan / Penjagaan', color: '#92400e', endpoint: '/api/waypoint/pertahanan/checkpoint/' },
  { id: 'waypoint_mil_office',     label: 'Kantor / Staf Militer', color: '#4d7c0f', endpoint: '/api/waypoint/pertahanan/office/' },
  { id: 'waypoint_mil_training',   label: 'Area Latihan Militer', color: '#65a30d', endpoint: '/api/waypoint/pertahanan/training-area/' },
  { id: 'waypoint_mil_airfield',   label: 'Pangkalan Udara (TNI AU)', color: '#0284c7', endpoint: '/api/waypoint/pertahanan/airfield/' },
  { id: 'waypoint_mil_naval',      label: 'Pangkalan Laut (TNI AL)', color: '#1e40af', endpoint: '/api/waypoint/pertahanan/naval-base/' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SearchLocation({ mapRef, modeBersih, activeLayers = [] }) {
  const [searchTerbuka,     setSearchTerbuka]     = useState(false);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isLoading,         setIsLoading]         = useState(false);
  const [hasHighlight,      setHasHighlight]      = useState(false);

  const cacheRef     = useRef({ 
    provinsi:  null, 
    kabupaten: null,
    waypoints: {} // Cache untuk waypoint per layer ID
  });
  const highlightRef = useRef(null);

  // Fetch boundary data (lazy, cached)
  const ensureData = async (type) => {
    if (cacheRef.current[type]) return cacheRef.current[type];
    try {
      const endpoint = type === 'provinsi' ? '/api/batas-provinsi/' : '/api/batas-kabupaten/';
      const res = await axios.get(`http://127.0.0.1:8000${endpoint}`);
      cacheRef.current[type] = res.data;
      return res.data;
    } catch (err) {
      console.error(`Gagal fetch batas ${type}:`, err);
      return null;
    }
  };

  // Fetch waypoint data untuk layer yang aktif
  const ensureWaypointData = async (layerId) => {
    if (cacheRef.current.waypoints[layerId]) return cacheRef.current.waypoints[layerId];
    
    const layerConfig = WAYPOINT_CONFIG.find(l => l.id === layerId);
    if (!layerConfig) return null;

    try {
      const res = await axios.get(`http://127.0.0.1:8000${layerConfig.endpoint}`);
      cacheRef.current.waypoints[layerId] = res.data;
      return res.data;
    } catch (err) {
      console.error(`Gagal fetch waypoint ${layerId}:`, err);
      return null;
    }
  };

  // Load data saat search dibuka DAN saat activeLayers berubah
  useEffect(() => {
    if (searchTerbuka) {
      ensureData('provinsi');
      ensureData('kabupaten');
      
      // Load waypoint data untuk semua active layers
      activeLayers.forEach(layerId => {
        if (layerId.startsWith('waypoint_')) {
          ensureWaypointData(layerId);
        }
      });
    }
  }, [searchTerbuka, activeLayers.join(',')]);

  // Load waypoint data juga saat user ketik (lazy load yang belum di-cache)
  useEffect(() => {
    if (!searchQuery.trim() || !searchTerbuka) return;
    
    activeLayers.forEach(layerId => {
      if (layerId.startsWith('waypoint_') && !cacheRef.current.waypoints[layerId]) {
        ensureWaypointData(layerId);
      }
    });
  }, [searchQuery, searchTerbuka, activeLayers.join(',')]);

  // Clear highlight
  const clearHighlight = () => {
    const map = mapRef?.current;
    if (highlightRef.current && map) {
      try { map.removeLayer(highlightRef.current); } catch (_) {}
      highlightRef.current = null;
    }
    if (map) map.closePopup();
    setHasHighlight(false);
  };

  // Auto suggestions — mencakup boundary + waypoint
  useEffect(() => {
    if (!searchQuery.trim()) { 
      setSearchSuggestions([]); 
      return; 
    }

    const q = searchQuery.toLowerCase();
    const hasil = [];

    // Cari di boundary (provinsi & kabupaten)
    const scanBoundary = (features, tipe, zoom) => {
      features?.forEach(f => {
        const nama = getNamaWilayah(f.properties);
        if (nama && nama.toLowerCase().includes(q)) {
          hasil.push({ 
            nama, 
            tipe, 
            feature: f, 
            zoom,
            type: 'boundary',
            data: f
          });
        }
      });
    };
    
    scanBoundary(cacheRef.current.provinsi?.features,  'Provinsi',       7);
    scanBoundary(cacheRef.current.kabupaten?.features, 'Kabupaten/Kota', 9);

    // Cari di waypoint (dari active layers saja)
    activeLayers.forEach(layerId => {
      if (!layerId.startsWith('waypoint_')) return;
      
      const layerConfig = WAYPOINT_CONFIG.find(l => l.id === layerId);
      if (!layerConfig) return;

      const waypointData = cacheRef.current.waypoints[layerId];
      if (!waypointData) {
        console.warn(`Data waypoint ${layerId} belum di-cache`);
        return;
      }

      // Handle berbagai format response dari API
      let features = [];
      if (waypointData?.features && Array.isArray(waypointData.features)) {
        features = waypointData.features;
      } else if (waypointData?.data && Array.isArray(waypointData.data)) {
        features = waypointData.data;
      } else if (Array.isArray(waypointData)) {
        features = waypointData;
      }

      if (features.length === 0) {
        console.warn(`[Search Debug] ${layerId} tidak ada features`);
        return;
      }

      features.forEach((f, idx) => {
        const props = f.properties || f;
        
        // Coba ekstrak nama dari berbagai field yang mungkin ada
        const nama = props.name 
          || props.nama 
          || props.title 
          || props.Title
          || props.NAME
          || props.Nama
          || props.school_name
          || props.universityName
          || '';
        
        // Debug: log feature pertama
        if (idx === 0) {
          console.log(`[Search Debug] ${layerId}[0] found keys:`, Object.keys(props).slice(0, 10));
          console.log(`[Search Debug] ${layerId}[0] nama="${nama}"`);
        }

        if (!nama) return;

        if (nama.toLowerCase().includes(q)) {
          hasil.push({
            nama,
            tipe: layerConfig.label,
            type: 'waypoint',
            layerId,
            layerConfig,
            data: f
          });
        }
      });
    });

    setSearchSuggestions(hasil.slice(0, 12));
  }, [searchQuery, activeLayers.join(',')]);

  // Draw highlight untuk boundary
  const drawHighlightBoundary = (fitur, tipe) => {
    const map = mapRef?.current;
    if (!map) return;

    if (highlightRef.current) {
      try { map.removeLayer(highlightRef.current); } catch (_) {}
      highlightRef.current = null;
    }

    const isProvinsi = tipe === 'Provinsi';

    const glow = L.geoJSON(fitur, {
      style: {
        color:   isProvinsi ? '#006aff' : '#fffb00',
        weight:  isProvinsi ? 10 : 8,
        opacity: 0.2,
        fill:    false,
      },
    });

    const line = L.geoJSON(fitur, {
      style: {
        color:       isProvinsi ? '#006aff' : '#fffb00',
        weight:      isProvinsi ? 3 : 2,
        dashArray:   isProvinsi ? '8,8' : '4,4',
        opacity:     1,
        fillColor:   isProvinsi ? '#006aff' : '#fffb00',
        fillOpacity: 0.07,
      },
    });

    const group = L.layerGroup([glow, line]);
    group.addTo(map);
    highlightRef.current = group;
    setHasHighlight(true);
  };

  // Draw highlight untuk waypoint
  const drawHighlightWaypoint = (lat, lng, layerConfig) => {
    const map = mapRef?.current;
    if (!map) return;

    if (highlightRef.current) {
      try { map.removeLayer(highlightRef.current); } catch (_) {}
      highlightRef.current = null;
    }

    const circle = L.circleMarker([lat, lng], {
      radius: 15,
      color: layerConfig.color,
      weight: 3,
      fillColor: layerConfig.color,
      fillOpacity: 0.2,
      dashArray: '5,5',
    });

    const glow = L.circleMarker([lat, lng], {
      radius: 25,
      color: layerConfig.color,
      weight: 1,
      fillColor: layerConfig.color,
      fillOpacity: 0.05,
      dashArray: '3,3',
    });

    const group = L.layerGroup([glow, circle]);
    group.addTo(map);
    highlightRef.current = group;
    setHasHighlight(true);
  };

  // Show popup
  const showPopup = (item, latlng, type, tipeLabel, layerConfig) => {
    const map = mapRef?.current;
    if (!map) return;

    let content = '';
    
    if (type === 'boundary') {
      const tipe = item.tipe;
      const feature = item.feature || item.data;
      const props = feature.properties || {};
      content = tipe === 'Provinsi' 
        ? buildProvinsiPopup(props) 
        : buildKabupatenPopup(props);
    } else if (type === 'waypoint') {
      const props = item.data.properties || item.data;
      content = buildWaypointPopup(props, tipeLabel, layerConfig.color);
    }

    L.popup({ maxWidth: 280, autoClose: true, closeOnClick: false })
      .setLatLng(latlng)
      .setContent(content)
      .openOn(map);
  };

  // Main search handler
  const handleSearch = async (item) => {
    const map = mapRef?.current;
    if (!map) return;

    setIsLoading(true);

    try {
      let latlng, zoomLevel, feature;

      if (item.type === 'boundary') {
        feature = item.feature || item.data;
        const coords = feature.geometry.coordinates;
        const ring   = feature.geometry.type === 'MultiPolygon' ? coords[0][0] : coords[0];
        const lat    = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        const lng    = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        latlng = [lat, lng];
        zoomLevel = item.zoom;

        map.setView(latlng, zoomLevel, { animate: true });
        drawHighlightBoundary(feature, item.tipe);
        setTimeout(() => showPopup(item, latlng, 'boundary', item.tipe), 450);
      } 
      else if (item.type === 'waypoint') {
        let lat, lng;
        const props = item.data.properties || item.data;

        // Extract coordinate dari GeoJSON atau direct props
        if (item.data.geometry?.coordinates) {
          lng = item.data.geometry.coordinates[0];
          lat = item.data.geometry.coordinates[1];
        } else if (props.lat != null && props.lng != null) {
          lat = props.lat;
          lng = props.lng;
        } else if (props.latitude != null && props.longitude != null) {
          lat = props.latitude;
          lng = props.longitude;
        }

        if (isNaN(lat) || isNaN(lng)) {
          throw new Error('Koordinat tidak valid');
        }

        latlng = [lat, lng];
        zoomLevel = 15;

        map.setView(latlng, zoomLevel, { animate: true });
        drawHighlightWaypoint(lat, lng, item.layerConfig);
        setTimeout(() => showPopup(item, latlng, 'waypoint', item.layerConfig.label, item.layerConfig), 450);
      }

      setSearchTerbuka(false);
      setSearchQuery('');
      setSearchSuggestions([]);
    } catch (err) {
      console.error('Error dalam pencarian:', err);
      toast.error('Gagal menavigasi ke lokasi');
    } finally {
      setIsLoading(false);
    }
  };

  // Query change
  const handleQueryChange = async (val) => {
    setSearchQuery(val);
    if (!val.trim()) return;
    const needFetch = !cacheRef.current.provinsi || !cacheRef.current.kabupaten;
    if (needFetch) {
      await Promise.all([ensureData('provinsi'), ensureData('kabupaten')]);
      setSearchQuery(v => v);
    }
  };

  if (modeBersih) return null;

  return (
    <div
      className="fixed z-[1200] flex flex-col gap-1.5"
      style={{ top: TOP_SEARCH, left: LEFT_PX }}
    >
      {/* Search panel / tombol */}
      {searchTerbuka ? (
        <div
          className={`${glass} rounded-2xl overflow-hidden`}
          style={{ minWidth: 300, maxWidth: 320 }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 p-2">
            {isLoading
              ? <div className="ml-1 w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
              : <Search size={14} className="ml-1 text-slate-400 shrink-0" />
            }
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchQuery.trim() && searchSuggestions.length > 0 && handleSearch(searchSuggestions[0])}
              placeholder="Cari wilayah, fasilitas…"
              className="flex-1 bg-transparent text-sm text-black dark:text-white placeholder-slate-400 outline-none min-w-0"
              autoFocus
            />
            <button
              onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-black dark:text-white transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          <div className="px-3 pb-2">
            {activeLayers.some(id => id.startsWith('waypoint_')) || activeLayers.includes('batas_provinsi') || activeLayers.includes('batas_kabupaten')
              ? <span className="text-[10px] text-slate-400">Ketik nama dari layer yang aktif</span>
              : <span className="text-[10px] text-slate-500 italic">Aktifkan layer terlebih dahulu</span>
            }
          </div>

          {searchSuggestions.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700/60 max-h-56 overflow-y-auto">
              {searchSuggestions.map((sug, idx) => {
                const isWaypoint = sug.type === 'waypoint';
                const dotColor = isWaypoint ? sug.layerConfig.color : (sug.tipe === 'Provinsi' ? '#0ea5e9' : '#f59e0b');
                const badge = isWaypoint ? 'FASILITAS' : (sug.tipe === 'Provinsi' ? 'PROV' : 'KAB');
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleSearch(sug)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/40 last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-black dark:text-white truncate">{sug.nama}</div>
                        {sug.tipe && (
                          <div className="text-[9px] text-slate-500 truncate">{sug.tipe}</div>
                        )}
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap`}
                      style={{ 
                        backgroundColor: `${dotColor}25`,
                        color: dotColor,
                        border: `1px solid ${dotColor}40`
                      }}
                    >
                      {badge}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {searchQuery.trim() && searchSuggestions.length === 0 && !isLoading && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/60">
              <p className="text-[11px] text-slate-400">Tidak ada hasil ditemukan.</p>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setSearchTerbuka(true)}
          className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
                      text-black dark:text-white hover:bg-white dark:hover:bg-slate-800
                      transition-all active:scale-90`}
          title="Cari Wilayah & Fasilitas"
        >
          <Search size={15} />
        </button>
      )}

      {/* Tombol hapus batas — muncul kalau ada highlight aktif */}
      {hasHighlight && !searchTerbuka && (
        <button
          onClick={clearHighlight}
          title="Hapus highlight"
          className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
                      text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30
                      transition-all active:scale-90`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}