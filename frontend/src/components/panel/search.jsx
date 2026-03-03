"use client";
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import { Search, X, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Tidak ada useMap() di sini — komponen ini hidup di luar MapContainer

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

// ─── Komponen utama — terima mapRef dari luar ─────────────────────────────────

export default function SearchLocation({ mapRef, modeBersih }) {
  const [searchTerbuka,     setSearchTerbuka]     = useState(false);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isLoading,         setIsLoading]         = useState(false);
  const [hasHighlight,      setHasHighlight]      = useState(false);

  const cacheRef     = useRef({ provinsi: null, kabupaten: null });
  const highlightRef = useRef(null);

  // ── Fetch boundary data (lazy, cached) ──────────────────────────────────────
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

  useEffect(() => {
    if (searchTerbuka) {
      ensureData('provinsi');
      ensureData('kabupaten');
    }
  }, [searchTerbuka]);

  // ── Clear highlight ──────────────────────────────────────────────────────────
  const clearHighlight = () => {
    const map = mapRef?.current;
    if (highlightRef.current && map) {
      try { map.removeLayer(highlightRef.current); } catch (_) {}
      highlightRef.current = null;
    }
    if (map) map.closePopup();
    setHasHighlight(false);
  };

  // ── Auto suggestions ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchSuggestions([]); return; }
    const q = searchQuery.toLowerCase();
    const hasil = [];
    const scan = (features, tipe, zoom) => {
      features?.forEach(f => {
        const nama = getNamaWilayah(f.properties);
        if (nama && nama.toLowerCase().includes(q)) hasil.push({ nama, tipe, feature: f, zoom });
      });
    };
    scan(cacheRef.current.provinsi?.features,  'Provinsi',       7);
    scan(cacheRef.current.kabupaten?.features, 'Kabupaten/Kota', 9);
    setSearchSuggestions(hasil.slice(0, 8));
  }, [searchQuery]);

  // ── Draw highlight via mapRef ────────────────────────────────────────────────
  const drawHighlight = (fitur, tipe) => {
    const map = mapRef?.current;
    if (!map) return;

    // Hapus highlight lama
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

  // ── Show popup via mapRef ────────────────────────────────────────────────────
  const showPopup = (fitur, tipe, latlng) => {
    const map = mapRef?.current;
    if (!map) return;

    const content = tipe === 'Provinsi'
      ? buildProvinsiPopup(fitur.properties || {})
      : buildKabupatenPopup(fitur.properties || {});

    L.popup({ maxWidth: 280, autoClose: true, closeOnClick: false })
      .setLatLng(latlng)
      .setContent(content)
      .openOn(map);
  };

  // ── Main search handler ──────────────────────────────────────────────────────
  const handleSearch = async (item) => {
    const map = mapRef?.current;
    if (!map) return;

    setIsLoading(true);
    let fitur, tipe, zoomLevel;

    if (typeof item === 'string') {
      const [dataProv, dataKab] = await Promise.all([
        ensureData('provinsi'),
        ensureData('kabupaten'),
      ]);
      const q        = item.trim().toLowerCase();
      const fromProv = dataProv?.features?.find(f => getNamaWilayah(f.properties).toLowerCase() === q);
      const fromKab  = dataKab?.features?.find( f => getNamaWilayah(f.properties).toLowerCase() === q);
      fitur     = fromProv || fromKab;
      tipe      = fromProv ? 'Provinsi' : 'Kabupaten/Kota';
      zoomLevel = fromProv ? 7 : 9;
    } else {
      fitur     = item.feature;
      tipe      = item.tipe;
      zoomLevel = item.zoom;
    }

    setIsLoading(false);

    if (!fitur) {
      toast.error('Wilayah tidak ditemukan');
      return;
    }

    const coords = fitur.geometry.coordinates;
    const ring   = fitur.geometry.type === 'MultiPolygon' ? coords[0][0] : coords[0];
    const lat    = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    const lng    = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const latlng = [lat, lng];

    map.setView(latlng, zoomLevel, { animate: true });
    drawHighlight(fitur, tipe);
    setTimeout(() => showPopup(fitur, tipe, latlng), 450);

    setSearchTerbuka(false);
    setSearchQuery('');
    setSearchSuggestions([]);
  };

  // ── Query change ─────────────────────────────────────────────────────────────
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
    // fixed — sepenuhnya di luar MapContainer, scroll di sini tidak gerakkan peta
    <div
      className="fixed z-[1200] flex flex-col gap-1.5"
      style={{ top: TOP_SEARCH, left: LEFT_PX }}
    >
      {/* ── Search panel / tombol ── */}
      {searchTerbuka ? (
        <div
          className={`${glass} rounded-2xl overflow-hidden`}
          style={{ minWidth: 280 }}
          // Blokir wheel event agar tidak tembus ke peta di belakangnya
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
              onKeyDown={(e) => e.key === 'Enter' && searchQuery.trim() && handleSearch(searchQuery)}
              placeholder="Cari provinsi / kab / kota…"
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
            <span className="text-[10px] text-slate-400">Ketik nama provinsi atau kabupaten/kota</span>
          </div>

          {searchSuggestions.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700/60 max-h-56 overflow-y-auto">
              {searchSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(sug)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sug.tipe === 'Provinsi' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                    <span className="text-sm font-medium text-black dark:text-white truncate">{sug.nama}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                    ${sug.tipe === 'Provinsi'
                      ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}
                  >
                    {sug.tipe === 'Provinsi' ? 'PROV' : 'KAB'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim() && searchSuggestions.length === 0 && !isLoading && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/60">
              <p className="text-[11px] text-slate-400">Wilayah tidak ditemukan.</p>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setSearchTerbuka(true)}
          className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
                      text-black dark:text-white hover:bg-white dark:hover:bg-slate-800
                      transition-all active:scale-90`}
          title="Cari Wilayah"
        >
          <Search size={15} />
        </button>
      )}

      {/* ── Tombol hapus batas — muncul kalau ada highlight aktif ── */}
      {hasHighlight && !searchTerbuka && (
        <button
          onClick={clearHighlight}
          title="Hapus batas wilayah"
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