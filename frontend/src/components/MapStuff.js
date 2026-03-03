"use client";
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import { 
  GeoJSON, Polygon, Popup, useMap, useMapEvents
} from 'react-leaflet';
import { 
  Home, Map as MapIcon, Layers, LocateFixed, Search, X, Eye, EyeOff, Plus, Minus
} from 'lucide-react';
import { useBoundaryData, BoundaryLayer } from './panel/layers';
import { toast } from 'react-hot-toast';

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
    properties.Propinsi   ||
    properties.PROPINSI   ||
    properties.Provinsi   ||
    properties.provinsi   ||
    properties.NAMOBJ     ||
    properties.name       ||
    properties.NAME       ||
    properties.KAB_KOTA   ||
    properties.KABUPATEN  ||
    properties.kabupaten  ||
    ''
  );
}

function getTipeWilayah(properties = {}) {
  if (
    properties.Propinsi || properties.PROPINSI ||
    properties.Provinsi || properties.provinsi
  ) return 'Provinsi';
  return 'Kabupaten/Kota';
}

export function ZoomButtons({ modeBersih }) {
  const map = useMap();

  if (modeBersih) return null;

  return (
    <div
      className="absolute z-[1000] flex flex-col gap-2"
      style={{ top: TOP_ZOOM, left: LEFT_PX }}
    >
      <button
        onClick={() => map.zoomIn()}
        title="Zoom In"
        className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
                    text-black dark:text-white
                    hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-90`}
      >
        <Plus size={15} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        title="Zoom Out"
        className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
                    text-black dark:text-white
                    hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-90`}
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function MouseCoordinate({ modeBersih }) {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });

  useMapEvents({
    mousemove: (e) => {
      setCoords({
        lat: e.latlng.lat.toFixed(5),
        lng: e.latlng.lng.toFixed(5),
      });
    },
  });

  if (modeBersih) return null;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
      <div className={`${glass} rounded-full px-4 py-1.5 flex items-center gap-3`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="font-mono text-[11px] tracking-wide text-black dark:text-white select-none whitespace-nowrap">
          <span className="text-sky-500 font-semibold">φ</span>{" "}{coords.lat}
          <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
          <span className="text-sky-500 font-semibold">λ</span>{" "}{coords.lng}
        </span>
      </div>
    </div>
  );
}

// CleanModeButton selalu render — ini satu-satunya jalan keluar dari mode bersih
export function CleanModeButton({ modeBersih, setModeBersih }) {
  return (
    <div
      className="fixed z-[1300]"
      style={{ top: TOP_CLEAN, left: LEFT_PX }}
    >
      <button
        onClick={() => setModeBersih(!modeBersih)}
        title={modeBersih ? 'Tampilkan UI' : 'Mode Bersih'}
        className={`
          w-9 h-9 flex items-center justify-center rounded-full
          transition-all duration-300 active:scale-90
          ${modeBersih
            ? 'bg-sky-500 shadow-[0_0_14px_rgba(14,165,233,0.5)] text-white'
            : `${glass} text-black dark:text-white`
          }
        `}
      >
        {modeBersih ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export function SearchLocation({ boundaryData, modeBersih }) {
  const map = useMap();
  const [searchTerbuka,     setSearchTerbuka]     = useState(false);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const highlightLayerRef = useRef(null);

  const clearHighlight = () => {
    if (highlightLayerRef.current) {
      try { map.removeLayer(highlightLayerRef.current); } catch (_) {}
      highlightLayerRef.current = null;
    }
  };

  useMapEvents({ click: () => clearHighlight() });

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const hasil = [];

    if (boundaryData?.provinsi?.features) {
      boundaryData.provinsi.features.forEach(f => {
        const nama = getNamaWilayah(f.properties);
        if (nama && nama.toLowerCase().includes(q)) {
          hasil.push({ nama, tipe: 'Provinsi', feature: f, zoom: 7 });
        }
      });
    }

    if (boundaryData?.kabupaten?.features) {
      boundaryData.kabupaten.features.forEach(f => {
        const nama = getNamaWilayah(f.properties);
        if (nama && nama.toLowerCase().includes(q)) {
          hasil.push({ nama, tipe: 'Kabupaten/Kota', feature: f, zoom: 9 });
        }
      });
    }

    setSearchSuggestions(hasil.slice(0, 8));
  }, [searchQuery, boundaryData]);

  const handleSearch = (item) => {
    let target, fitur, zoomLevel;

    if (typeof item === 'string') {
      const q = item.trim().toLowerCase();
      const fromProv = boundaryData?.provinsi?.features?.find(
        f => getNamaWilayah(f.properties).toLowerCase() === q
      );
      const fromKab  = boundaryData?.kabupaten?.features?.find(
        f => getNamaWilayah(f.properties).toLowerCase() === q
      );
      fitur     = fromProv || fromKab;
      target    = item.trim();
      zoomLevel = fromProv ? 7 : 9;
    } else {
      fitur     = item.feature;
      target    = item.nama;
      zoomLevel = item.zoom;
    }

    if (!fitur) {
      const noData = !boundaryData?.provinsi && !boundaryData?.kabupaten;
      toast.error(
        noData
          ? 'Aktifkan layer Batas Provinsi / Kabupaten dahulu'
          : 'Wilayah tidak ditemukan'
      );
      return;
    }

    const coords = fitur.geometry.coordinates;
    const ring   =
      fitur.geometry.type === 'MultiPolygon' ? coords[0][0] : coords[0];
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;

    map.setView([lat, lng], zoomLevel, { animate: true });

    clearHighlight();

    const outerGlow = L.geoJSON(fitur, {
      style: { color: '#0ea5e9', weight: 8, opacity: 0.2, fill: false },
    });

    const innerLine = L.geoJSON(fitur, {
      style: { color: '#38bdf8', weight: 2.5, opacity: 1, fillColor: '#38bdf8', fillOpacity: 0.07 },
    });

    const group = L.layerGroup([outerGlow, innerLine]);
    group.addTo(map);
    highlightLayerRef.current = group;
    setTimeout(() => clearHighlight(), 5000);

    toast.success(
      <div className="flex items-center gap-2">
        <span className="text-xl">📍</span>
        <div>
          <div className="font-bold">{target}</div>
          <div className="text-xs opacity-60">{typeof item === 'object' ? item.tipe : ''}</div>
        </div>
      </div>,
      { duration: 3000, style: { borderRadius: '14px', padding: '12px 16px' } }
    );

    setSearchTerbuka(false);
    setSearchQuery('');
    setSearchSuggestions([]);
  };

  const closeSearch = () => {
    setSearchTerbuka(false);
    setSearchQuery('');
    setSearchSuggestions([]);
  };

  const adaProvinsi  = !!boundaryData?.provinsi;
  const adaKabupaten = !!boundaryData?.kabupaten;
  const adaData      = adaProvinsi || adaKabupaten;

  if (modeBersih) return null;

  return (
    <div
      className="absolute z-[1000]"
      style={{ top: TOP_SEARCH, left: LEFT_PX }}
    >
      {searchTerbuka ? (
        <div className={`${glass} rounded-2xl overflow-hidden`} style={{ minWidth: 272 }}>
          <div className="flex items-center gap-2 p-2">
            <Search size={14} className="ml-1 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              placeholder={
                adaProvinsi && adaKabupaten
                  ? 'Cari provinsi / kab / kota…'
                  : adaProvinsi
                  ? 'Cari provinsi…'
                  : adaKabupaten
                  ? 'Cari kabupaten / kota…'
                  : 'Aktifkan layer batas dahulu…'
              }
              className="flex-1 bg-transparent text-sm text-black dark:text-white placeholder-slate-400 outline-none min-w-0"
              autoFocus
            />
            <button
              onClick={closeSearch}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700
                         text-black dark:text-white transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
            {adaProvinsi && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                ✓ Provinsi
              </span>
            )}
            {adaKabupaten && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                ✓ Kabupaten/Kota
              </span>
            )}
            {!adaData && (
              <span className="text-[10px] font-medium text-amber-500">
                ⚠️ Aktifkan layer Batas Provinsi / Kabupaten dahulu
              </span>
            )}
          </div>

          {searchSuggestions.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700/60 max-h-52 overflow-y-auto">
              {searchSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(sug)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="text-sm font-medium text-black dark:text-white truncate">
                      {sug.nama}
                    </span>
                  </div>
                  <span className={`
                    text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                    ${sug.tipe === 'Provinsi'
                      ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }
                  `}>
                    {sug.tipe === 'Provinsi' ? 'PROV' : 'KAB'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim() && searchSuggestions.length === 0 && adaData && (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/60">
              <p className="text-[11px] text-black dark:text-white">Wilayah tidak ditemukan.</p>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setSearchTerbuka(true)}
          className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
                      text-black dark:text-white
                      hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-90`}
          title="Cari Wilayah"
        >
          <Search size={15} />
        </button>
      )}
    </div>
  );
}

export function MapReset({ trigger, onDone }) {
  const map = useMap();
  useEffect(() => {
    if (!trigger) return;
    map.flyTo([-2.5, 118], 5, { animate: true, duration: 1 });
    onDone();
  }, [trigger]);
  return null;
}

export function SidebarButtons({ activePanel, setActivePanel, setGoHome, modeBersih }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isDark,   setIsDark]   = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const checkTheme  = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');

    checkMobile();
    checkTheme();
    window.addEventListener('resize', checkMobile);

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      window.removeEventListener('resize', checkMobile);
      observer.disconnect();
    };
  }, []);

  const buttons = [
    { id: 'home',    icon: <Home size={17} />,    label: 'Beranda' },
    { id: 'basemap', icon: <MapIcon size={17} />,  label: 'Basemap' },
    { id: 'layers',  icon: <Layers size={17} />,   label: 'Layer'   },
    {
      id: 'radius',
      icon: (
        <img
          src={isDark ? '/icons/Wradius.png' : '/icons/bradius.png'}
          className="w-[18px] h-[18px] object-contain"
          alt="Radius"
        />
      ),
      label: 'Radius',
    },
    {
      id: 'geoai',
      icon: (
        <img
          src={isDark ? '/icons/wgeo.png' : '/icons/bgeo.png'}
          className="w-[18px] h-[18px] object-contain"
          alt="GeoAI"
        />
      ),
      label: 'GeoAI',
    },
    { id: 'share', icon: <LocateFixed size={17} />, label: 'Lokasi' },
  ];

  const handleButtonClick = (btnId) => {
    if (btnId === 'home') {
      setGoHome(true);
      setActivePanel(null);
      toast.success('Kembali ke tampilan default');
    } else {
      setActivePanel(activePanel === btnId ? null : btnId);
    }
  };

  if (modeBersih) return null;

  /* ── Mobile: bottom bar ── */
  if (isMobile) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1100]">
        <div className={`${glass} rounded-[20px] px-2 py-2 flex items-center gap-1`}>
          {buttons.map(btn => {
            const active = activePanel === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => handleButtonClick(btn.id)}
                title={btn.label}
                className={`
                  relative w-11 h-11 rounded-[14px] flex items-center justify-center
                  transition-all duration-200 active:scale-90
                  ${active
                    ? 'bg-sky-500 text-white shadow-[0_4px_12px_rgba(14,165,233,0.4)]'
                    : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }
                `}
              >
                {/* Custom image icons: invert when active (jadi putih) */}
                {['radius', 'geoai'].includes(btn.id) && active
                  ? <img
                      src={`/icons/${btn.id === 'radius' ? 'Wradius' : 'wgeo'}.png`}
                      className="w-[18px] h-[18px] object-contain"
                      alt={btn.label}
                    />
                  : btn.icon
                }
                {active && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-sky-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Desktop: right sidebar ── */
  return (
    <div
      className="fixed z-[1100]"
      style={{ right: 16, top: '50%', transform: 'translateY(-50%)' }}
    >
      <div className={`${glass} rounded-[22px] p-1.5 flex flex-col gap-1`}>
        {buttons.map((btn, i) => {
          const active = activePanel === btn.id;
          return (
            <div key={btn.id} className="relative group">
              {/* Divider sebelum tombol terakhir */}
              {i === buttons.length - 1 && (
                <div className="w-6 h-px bg-slate-200 dark:bg-slate-700 mx-auto my-1" />
              )}

              <button
                onClick={() => handleButtonClick(btn.id)}
                className={`
                  relative w-11 h-11 rounded-[14px] flex items-center justify-center
                  transition-all duration-200 active:scale-90
                  ${active
                    ? 'bg-sky-500 text-white shadow-[0_4px_16px_rgba(14,165,233,0.35)]'
                    : 'text-black dark:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800'
                  }
                `}
              >
                {/* Custom image icons: pakai versi putih ketika active */}
                {['radius', 'geoai'].includes(btn.id) && active
                  ? <img
                      src={`/icons/${btn.id === 'radius' ? 'Wradius' : 'wgeo'}.png`}
                      className="w-[18px] h-[18px] object-contain"
                      alt={btn.label}
                    />
                  : btn.icon
                }

                {active && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[3px] w-[3px] h-5 rounded-full bg-sky-400" />
                )}
              </button>

              {/* Tooltip kiri */}
              <div className="pointer-events-none absolute right-[54px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center">
                <span className={`${glass} rounded-xl px-3 py-1.5 text-[11px] font-semibold text-black dark:text-white whitespace-nowrap tracking-wide`}>
                  {btn.label}
                </span>
                <span className="block w-2 h-2 -ml-1 rotate-45 bg-white/85 dark:bg-slate-900/85 border-r border-t border-white/70 dark:border-slate-700/60" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PreviewLayer({ previewData, setPreviewData, getCategoryColor }) {
  const map = useMap();

  const removeObject = (idx) => {
    const newData = [...previewData];
    newData.splice(idx, 1);
    setPreviewData(newData);
    map.closePopup();
    toast.success('Preview dihapus');
  };

  if (!previewData || previewData.length === 0) return null;

  return (
    <>
      {previewData.map((obj, idx) => {
        if (!obj.segmentation) return null;
        const scanCenterPixel = map.latLngToContainerPoint([obj.lat, obj.lng]);
        const halfSize = (obj.capture_size || 640) / 2;
        const polygonCoords = obj.segmentation.map(point => {
          const latLng = map.containerPointToLatLng([
            scanCenterPixel.x + (point[0] - halfSize),
            scanCenterPixel.y + (point[1] - halfSize),
          ]);
          return [latLng.lat, latLng.lng];
        });

        return (
          <Polygon
            key={`preview-${idx}`}
            positions={polygonCoords}
            pathOptions={{
              color:       getCategoryColor(obj.kategori),
              fillColor:   getCategoryColor(obj.kategori),
              fillOpacity: 0.35,
              weight:      2,
              dashArray:   '6, 8',
            }}
          >
            <Popup>
              <div className="p-3 min-w-[160px]">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: getCategoryColor(obj.kategori) }}
                  />
                  <p className="font-bold text-[13px] uppercase tracking-wide text-slate-800">
                    {obj.kategori}
                  </p>
                </div>
                {obj.luas_m2 && (
                  <p className="text-xs text-slate-500 mb-3">
                    Luas: <span className="font-bold text-sky-600">{obj.luas_m2} m²</span>
                  </p>
                )}
                <button
                  onClick={() => removeObject(idx)}
                  className="w-full text-xs font-semibold py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Batalkan
                </button>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

export function SavedDataLayer({ data, onRefreshData, getCategoryColor }) {
  const handleDelete = async (feature_id) => {
    toast.custom((t) => (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 min-w-[280px] border border-slate-100 dark:border-slate-700">
        <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Hapus data ini?</p>
        <p className="text-xs text-slate-400 mb-4">Tindakan ini tidak dapat dibatalkan.</p>
        <div className="flex gap-2">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors font-medium"
          >
            Batal
          </button>
          <button
            onClick={async () => { toast.dismiss(t.id); await performDelete(feature_id); }}
            className="flex-1 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors font-semibold"
          >
            Hapus
          </button>
        </div>
      </div>
    ));
  };

  const performDelete = async (feature_id) => {
    const id = toast.loading('Menghapus…');
    try {
      await axios.delete(`http://127.0.0.1:8000/api/features/${feature_id}/`);
      toast.success('Data berhasil dihapus', { id });
      onRefreshData();
    } catch {
      toast.error('Gagal menghapus data', { id });
    }
  };

  if (!data || !Array.isArray(data)) return null;

  return (
    <>
      {data.map((item, idx) => (
        <GeoJSON
          key={item.feature_id || idx}
          data={item.location}
          style={() => ({
            color:       getCategoryColor(item.kategori),
            fillColor:   getCategoryColor(item.kategori),
            fillOpacity: 0.35,
            weight:      2,
          })}
        >
          <Popup>
            <div className="p-3 min-w-[220px] max-w-[260px]">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: getCategoryColor(item.kategori) }}
                />
                <p className="font-bold text-sm uppercase tracking-wide text-slate-800 dark:text-slate-100">
                  {item.kategori}
                </p>
              </div>

              <div className="space-y-2">
                {item.provinsi && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5">📍</span>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Provinsi</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{item.provinsi}</p>
                    </div>
                  </div>
                )}
                {item.metadata?.luas_estimasi && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5">📐</span>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Luas Estimasi</p>
                      <p className="text-xs font-bold text-sky-600 mt-0.5">{item.metadata.luas_estimasi} m²</p>
                    </div>
                  </div>
                )}
                {item.confidence_score && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5">⭐</span>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Akurasi</p>
                      <p className="text-xs font-bold text-amber-500 mt-0.5">
                        {(item.confidence_score * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {item.created_at && (
                <p className="text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700">
                  {new Date(item.created_at).toLocaleString('id-ID')}
                </p>
              )}
              <button
                onClick={() => handleDelete(item.feature_id)}
                className="mt-2.5 w-full text-xs font-semibold py-1.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
              >
                🗑️ Hapus Data
              </button>
            </div>
          </Popup>
        </GeoJSON>
      ))}
    </>
  );
}

export function RBILayer({ activeLayers, rbiData, getCategoryColor }) {
  return (
    <>
      {Object.keys(rbiData).map(layerKey => {
        if (!activeLayers.includes(layerKey)) return null;
        const parts    = layerKey.split('_');
        const kategori = parts[0];
        const wilayah  = parts.slice(1).join('_');

        return (
          <GeoJSON
            key={`rbi-${layerKey}`}
            data={rbiData[layerKey]}
            pointToLayer={(f, latlng) =>
              L.circleMarker(latlng, {
                radius:      kategori === 'pendidikan' ? 4 : 5,
                fillColor:   getCategoryColor(kategori),
                color:       '#ffffff',
                weight:      kategori === 'kesehatan' ? 2 : 1,
                fillOpacity: 0.9,
              })
            }
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              layer.bindPopup(`
                <div style="font-size:12px; min-width:180px">
                  <b style="color:${getCategoryColor(kategori)}">${props.NAMOBJ || 'Tanpa Nama'}</b><br/>
                  <span>${props.REMARK || (kategori === 'pendidikan' ? 'Sekolah' : 'Kesehatan')}</span><br/>
                  <small>Wilayah: ${wilayah}</small>
                </div>
              `);
            }}
          />
        );
      })}
    </>
  );
}

export function AnalysisLayer({ activeAnalysisData }) {
  if (!activeAnalysisData?.matched_features?.features) return null;

  return (
    <GeoJSON
      key={activeAnalysisData.analysis_id}
      data={activeAnalysisData.matched_features}
      style={(feature) => {
        const analysis = feature.properties?.analysis || {};
        return {
          fillColor:   analysis.warna || '#cbd5e1',
          weight:      2,
          opacity:     1,
          color:       'white',
          fillOpacity: 0.7,
        };
      }}
      onEachFeature={(feature, layer) => {
        const analysis = feature.properties?.analysis || {};
        const dataAps  = analysis.aps_data || {};

        layer.bindTooltip(`
          <div style="font-family:inherit; padding:6px;">
            <div style="font-weight:900; color:#0f172a; text-transform:uppercase; letter-spacing:0.1em;">
              ${analysis.nama_provinsi}
            </div>
            <div style="font-size:10px; font-weight:800; color:${analysis.warna}; margin-top:2px;">
              STATUS: ${analysis.kategori}
            </div>
          </div>
        `, { sticky: true, opacity: 0.95 });

        const wawasan = analysis.insights?.map(i =>
          `<div style="margin-bottom:6px; padding-left:10px; border-left:3px solid ${analysis.warna}; font-weight:600;">${i}</div>`
        ).join('') || '';

        layer.bindPopup(`
          <div style="font-family:inherit; min-width:280px; color:#1e293b; padding:5px;">
            <div style="background:${analysis.warna}; color:white; padding:15px; border-radius:12px 12px 4px 4px; margin-bottom:10px;">
              <div style="font-weight:900; font-size:16px; text-transform:uppercase; letter-spacing:0.1em;">${analysis.nama_provinsi}</div>
              <div style="font-size:10px; font-weight:800; opacity:0.9; text-transform:uppercase; margin-top:4px;">Analisis Strategis Wilayah</div>
            </div>
            <div style="padding:10px;">
              <div style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; border-bottom:2px solid #f1f5f9; padding-bottom:4px;">Wawasan Utama</div>
              <div style="font-size:12px; color:#334155; line-height:1.5; margin-bottom:15px;">${wawasan}</div>
              <div style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; border-bottom:2px solid #f1f5f9; padding-bottom:4px;">Matriks Partisipasi</div>
              <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;">
                <div style="background:#f8fafc; padding:10px; border-radius:8px; text-align:center; border:1px solid #f1f5f9;">
                  <div style="font-size:9px; font-weight:900; color:#0369a1; text-transform:uppercase;">SD</div>
                  <div style="font-size:13px; font-weight:900;">${dataAps.APS_7_12 || '-'}%</div>
                </div>
                <div style="background:#f8fafc; padding:10px; border-radius:8px; text-align:center; border:1px solid #f1f5f9;">
                  <div style="font-size:9px; font-weight:900; color:#a16207; text-transform:uppercase;">SMP</div>
                  <div style="font-size:13px; font-weight:900;">${dataAps.APS_13_15 || '-'}%</div>
                </div>
              </div>
            </div>
          </div>
        `);
      }}
    />
  );
}

export default function MapStuff(props) {
  const { boundaryData, getBoundaryStyle, onEachBoundary } = useBoundaryData(props.activeLayers);
  const [modeBersih, setModeBersih] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-clean', modeBersih ? 'true' : 'false');

    const header = document.querySelector('header');
    if (header) {
      header.style.transition    = 'opacity 0.2s, transform 0.2s';
      header.style.opacity       = modeBersih ? '0' : '';
      header.style.transform     = modeBersih ? 'translateY(-100%)' : '';
      header.style.pointerEvents = modeBersih ? 'none' : '';
    }

    return () => {
      document.documentElement.setAttribute('data-clean', 'false');
      const h = document.querySelector('header');
      if (h) {
        h.style.opacity       = '';
        h.style.transform     = '';
        h.style.pointerEvents = '';
      }
    };
  }, [modeBersih]);

  return (
    <>
      <BoundaryLayer
        activeLayers={props.activeLayers}
        boundaryData={boundaryData}
        getBoundaryStyle={getBoundaryStyle}
        onEachBoundary={onEachBoundary}
      />
      <AnalysisLayer activeAnalysisData={props.activeAnalysisData} />
      <RBILayer
        activeLayers={props.activeLayers}
        rbiData={props.rbiData}
        getCategoryColor={props.getCategoryColor}
      />
      <PreviewLayer
        previewData={props.previewData}
        setPreviewData={props.setPreviewData}
        getCategoryColor={props.getCategoryColor}
      />
      <SavedDataLayer
        data={props.data}
        onRefreshData={props.onRefreshData}
        getCategoryColor={props.getCategoryColor}
      />

      <ZoomButtons     modeBersih={modeBersih} />
      <CleanModeButton modeBersih={modeBersih} setModeBersih={setModeBersih} />
      <SearchLocation  boundaryData={boundaryData} modeBersih={modeBersih} />
      <MouseCoordinate modeBersih={modeBersih} />

      <MapReset trigger={props.goHome} onDone={() => props.setGoHome(false)} />
      <SidebarButtons
        activePanel={props.activePanel}
        setActivePanel={props.setActivePanel}
        setGoHome={props.setGoHome}
        modeBersih={modeBersih}
      />
    </>
  );
}