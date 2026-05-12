"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import L from 'leaflet';
import { GeoJSON, Polygon, Popup, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import {
  Home, Map as MapIcon, Layers, LocateFixed,
  Eye, EyeOff, Plus, Minus, Grid, Maximize, Minimize, PenLine
} from 'lucide-react';
import { useBoundaryData, BoundaryLayer } from './panel/layers';
import { toast } from 'react-hot-toast';

const glass = [
  "bg-white/30 dark:bg-slate-900/30",
  "backdrop-blur-md",
  "border border-white/20 dark:border-slate-700/30",
  "shadow-[0_4px_20px_rgba(0,0,0,0.12)]",
].join(" ");

const NAVBAR_H = 60;
const LEFT_PX = 12;
const TOP_ZOOM = NAVBAR_H + 10;
const TOP_CLEAN = TOP_ZOOM + 90;
const TOP_FULLSCREEN = TOP_CLEAN + 36 + 8 + 36 + 8;

// ─── Detection Preview Box ────────────────────────────────────────────────────

export function DetectionPreviewBox({ show, size }) {
  const map = useMap();
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    if (!show) { setBounds(null); return; }

    const updateBounds = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const mpp = (40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)))
        / (256 * Math.pow(2, zoom));
      const half = (size / 2) * mpp;
      const latOff = half / 111320;
      const lngOff = half / (111320 * Math.cos(center.lat * Math.PI / 180));
      setBounds([
        [center.lat - latOff, center.lng - lngOff],
        [center.lat + latOff, center.lng + lngOff],
      ]);
    };

    updateBounds();
    map.on('move', updateBounds);
    map.on('zoom', updateBounds);
    return () => { map.off('move', updateBounds); map.off('zoom', updateBounds); };
  }, [map, size, show]);

  if (!show || !bounds) return null;
  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        color: '#06b6d4',
        weight: 3,
        fillColor: '#06b6d4',
        fillOpacity: 0.1,
        dashArray: '10, 10',
      }}
    />
  );
}

// ─── Zoom Watcher ─────────────────────────────────────────────────────────────

export function ZoomWatcher({ onZoomChange }) {
  useMapEvents({
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  });
  return null;
}

// ─── Zoom Buttons ─────────────────────────────────────────────────────────────

export function ZoomButtons({ modeBersih }) {
  const map = useMap();
  if (modeBersih) return null;
  return (
    <div className="absolute z-[1000] flex flex-col gap-2" style={{ top: TOP_ZOOM, left: LEFT_PX }}>
      <button
        onClick={() => map.zoomIn()}
        title="Zoom In"
        className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
            text-white hover:!bg-white/10 dark:hover:!bg-slate-700/40 transition-all active:scale-90`}
      >
        <Plus size={15} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        title="Zoom Out"
        className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
            text-white hover:!bg-white/10 dark:hover:!bg-slate-700/40 transition-all active:scale-90`}
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── Mouse Coordinate + Zoom Level ────────────────────────────────────────────
// Tanpa background — menyatu dengan style map lain

export function MouseCoordinate({ modeBersih, zoomLevel }) {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });
  useMapEvents({
    mousemove: (e) => setCoords({ lat: e.latlng.lat.toFixed(5), lng: e.latlng.lng.toFixed(5) }),
  });
  if (modeBersih) return null;
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
      <div className="flex items-center gap-2.5 px-3 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="font-mono text-[11px] tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] select-none whitespace-nowrap flex items-center gap-1.5">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Lat</span>
          <span className="text-sky-300 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{coords.lat}</span>
          <span className="mx-1 text-slate-400">|</span>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Lng</span>
          <span className="text-sky-300 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{coords.lng}</span>
          <span className="mx-1 text-slate-400">|</span>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Z</span>
          <span className="text-amber-300 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{zoomLevel}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Clean Mode Button ────────────────────────────────────────────────────────

export function CleanModeButton({ modeBersih, setModeBersih }) {
  return (
    <div className="fixed z-[1300]" style={{ top: TOP_CLEAN, left: LEFT_PX }}>
      <button
        onClick={() => setModeBersih(!modeBersih)}
        title={modeBersih ? 'Tampilkan UI' : 'Mode Bersih'}
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90
          ${modeBersih
            ? 'bg-sky-500 shadow-[0_0_14px_rgba(14,165,233,0.5)] text-white'
            : `${glass} text-white hover:!bg-white/10 dark:hover:!bg-slate-700/40`
          }`}
      >
        {modeBersih ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ─── Fullscreen Button ────────────────────────────────────────────────────────

export function FullscreenButton({ modeBersih }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  if (modeBersih) return null;
  return (
    <div className="fixed z-[1300]" style={{ top: TOP_FULLSCREEN, left: LEFT_PX }}>
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Keluar Fullscreen (F)' : 'Fullscreen (F)'}
        className={`${glass} w-9 h-9 flex items-center justify-center rounded-full
          text-white hover:!bg-white/10 dark:hover:!bg-slate-700/40 transition-all active:scale-90`}
      >
        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
      </button>
    </div>
  );
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

export function KeyboardShortcuts({ activePanel, setActivePanel, modeBersih, setModeBersih, setGoHome }) {
  useEffect(() => {
    const handler = (e) => {
      // Jangan aktifkan shortcut saat user mengetik di input/textarea
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          setActivePanel(prev => prev === 'basemap' ? null : 'basemap');
          break;
        case 'l':
          e.preventDefault();
          setActivePanel(prev => prev === 'layers' ? null : 'layers');
          break;
        case 'c':
          e.preventDefault();
          setModeBersih(prev => !prev);
          break;
        case 'f':
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
          } else {
            document.exitFullscreen().catch(() => { });
          }
          break;
        case 'h':
          e.preventDefault();
          setGoHome(true);
          setActivePanel(null);
          break;
        case 'escape':
          setActivePanel(null);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActivePanel, setModeBersih, setGoHome]);

  return null;
}

// ─── MiniMap ──────────────────────────────────────────────────────────────────

export function MiniMap({ modeBersih }) {
  const parentMap = useMap();
  const miniMapRef = useRef(null);
  const containerRef = useRef(null);
  const rectRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (modeBersih || isMobile || !containerRef.current) {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
      return;
    }

    if (miniMapRef.current) return; // already created

    const miniMap = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(miniMap);

    miniMapRef.current = miniMap;

    // Initial sync
    const center = parentMap.getCenter();
    const zoom = Math.max(parentMap.getZoom() - 5, 1);
    miniMap.setView(center, zoom);

    // Rectangle showing main viewport
    const bounds = parentMap.getBounds();
    rectRef.current = L.rectangle(bounds, {
      color: '#06b6d4',
      weight: 2,
      fillColor: '#06b6d4',
      fillOpacity: 0.15,
    }).addTo(miniMap);

    // Sync on move/zoom
    const syncMiniMap = () => {
      if (!miniMapRef.current) return;
      const c = parentMap.getCenter();
      const z = Math.max(parentMap.getZoom() - 5, 1);
      miniMapRef.current.setView(c, z, { animate: false });
      if (rectRef.current) {
        rectRef.current.setBounds(parentMap.getBounds());
      }
    };

    parentMap.on('move', syncMiniMap);
    parentMap.on('zoom', syncMiniMap);

    return () => {
      parentMap.off('move', syncMiniMap);
      parentMap.off('zoom', syncMiniMap);
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    };
  }, [parentMap, modeBersih, isMobile]);

  if (modeBersih || isMobile) return null;

  return (
    <div
      ref={containerRef}
      className="absolute z-[900] rounded-xl overflow-hidden border-2 border-white/20 dark:border-slate-700/40 shadow-lg"
      style={{
        top: 100,
        right: 20,
        width: 160,
        height: 110,
        opacity: 0.85,
      }}
    />
  );
}

// ─── Map Reset ────────────────────────────────────────────────────────────────

export function MapReset({ trigger, onDone }) {
  const map = useMap();
  useEffect(() => {
    if (!trigger) return;
    map.flyTo([-2.5, 118], 5, { animate: true, duration: 1 });
    onDone();
  }, [trigger]);
  return null;
}

// ─── Sidebar Buttons ──────────────────────────────────────────────────────────

export function SidebarButtons({ activePanel, setActivePanel, setGoHome, modeBersih }) {
  const map = useMap();
  const [isMobile, setIsMobile] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const checkTheme = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    checkMobile();
    checkTheme();
    window.addEventListener('resize', checkMobile);
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { window.removeEventListener('resize', checkMobile); observer.disconnect(); };
  }, []);

  const buttons = [
    { id: 'home', icon: <Home size={17} />, label: 'Beranda' },
    { id: 'basemap', icon: <MapIcon size={17} />, label: 'Basemap' },
    { id: 'layers', icon: <Layers size={17} />, label: 'Layer' },
    //     {
    //   id: 'radius',
    //   icon: <img src="/icons/Wradius.png" className="w-[18px] h-[18px] object-contain" alt="Radius" />,
    //   label: 'Radius',
    // },
    {
      id: 'areascan',
      icon: <img src="/icons/wgeo.png" className="w-[18px] h-[18px] object-contain" alt="GeoAI" />,
      label: 'GeoAI',
    },
    { id: 'draw', icon: <PenLine size={17} />, label: 'Draw' },
    { id: 'share', icon: <LocateFixed size={17} />, label: 'Lokasi' },
  ];


  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung geolokasi');
      return;
    }
    const id = toast.loading('Mencari lokasi...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        // setActivePanel(null) dulu supaya panel tidak terbuka
        setActivePanel(null);
        // Akses map via ref — kita butuh prop mapRef
        map.flyTo([latitude, longitude], 16, { animate: true, duration: 1.2 });
        toast.success(
          `📍 Lokasi ditemukan · akurasi ±${Math.round(accuracy)}m`,
          { id, duration: 3000 }
        );
      },
      (err) => {
        const msg = {
          1: 'Izin lokasi ditolak',
          2: 'Lokasi tidak tersedia',
          3: 'Waktu habis',
        }[err.code] || 'Gagal mendapatkan lokasi';
        toast.error(msg, { id });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleButtonClick = (btnId) => {
    if (btnId === 'home') {
      setGoHome(true);
      setActivePanel(null);
      toast.success('Kembali ke tampilan default');
    } else if (btnId === 'share') {
      handleLocateMe();
    } else {
      setActivePanel(activePanel === btnId ? null : btnId);
    }
  };

  if (modeBersih) return null;

  const activeIcon = (btn) => {
    if (btn.id === 'radius') return <img src="/icons/Wradius.png" className="w-[18px] h-[18px] object-contain" alt="Radius" />;
    return btn.icon;
  };

  /* Mobile */
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
                className={`relative w-11 h-11 rounded-[14px] flex items-center justify-center transition-all duration-200 active:scale-90
                  ${active ? 'bg-sky-500 text-white shadow-[0_4px_12px_rgba(14,165,233,0.4)]' : 'text-white hover:bg-white/10 dark:hover:bg-slate-700/50'}`}
              >
                {active ? activeIcon(btn) : btn.icon}
                {active && <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-sky-400" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* Desktop */
  return (
    <div className="fixed z-[1100]" style={{ right: 16, top: '50%', transform: 'translateY(-50%)' }}>
      <div className={`${glass} rounded-[22px] p-1.5 flex flex-col gap-1`}>
        {buttons.map((btn, i) => {
          const active = activePanel === btn.id;
          const isLast = i === buttons.length - 1;
          return (
            <div key={btn.id} className="relative group">
              {isLast && (
                <div className="w-6 h-px bg-slate-200 dark:bg-slate-700 mx-auto my-1" />
              )}
              <button
                onClick={() => handleButtonClick(btn.id)}
                className={`relative w-11 h-11 rounded-[14px] flex items-center justify-center transition-all duration-200 active:scale-90
                  ${active ? 'bg-sky-500 text-white shadow-[0_4px_16px_rgba(14,165,233,0.35)]' : 'text-white hover:bg-white/10 dark:hover:bg-slate-700/50'}`}
              >
                {active ? activeIcon(btn) : btn.icon}
                {active && <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[3px] w-[3px] h-5 rounded-full bg-sky-400" />}
              </button>
              <div className="pointer-events-none absolute right-[54px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center">
                <span className={`${glass} rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap tracking-wide`}>
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

// ─── Preview Layer ────────────────────────────────────────────────────────────

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
              color: getCategoryColor(obj.kategori),
              fillColor: getCategoryColor(obj.kategori),
              fillOpacity: 0.35,
              weight: 2,
              dashArray: '6, 8',
            }}
          >
            <Popup>
              <div className="p-3 min-w-[160px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getCategoryColor(obj.kategori) }} />
                  <p className="font-bold text-[13px] uppercase tracking-wide text-slate-800">{obj.kategori}</p>
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

// ─── Saved Data Layer ─────────────────────────────────────────────────────────

export function SavedDataLayer({ data, onRefreshData, getCategoryColor }) {
  const handleDelete = (feature_id) => {
    toast.custom((t) => (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 min-w-[280px] border border-slate-100 dark:border-slate-700">
        <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Hapus data ini?</p>
        <p className="text-xs text-slate-400 mb-4">Tindakan ini tidak dapat dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={() => toast.dismiss(t.id)} className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors font-medium">Batal</button>
          <button onClick={async () => { toast.dismiss(t.id); await performDelete(feature_id); }} className="flex-1 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors font-semibold">Hapus</button>
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
            color: getCategoryColor(item.kategori),
            fillColor: getCategoryColor(item.kategori),
            fillOpacity: 0.35,
            weight: 2,
          })}
        >
          <Popup>
            <div className="p-3 min-w-[220px] max-w-[260px]">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getCategoryColor(item.kategori) }} />
                <p className="font-bold text-sm uppercase tracking-wide text-slate-800 dark:text-slate-100">{item.kategori}</p>
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
                      <p className="text-xs font-bold text-amber-500 mt-0.5">{(item.confidence_score * 100).toFixed(1)}%</p>
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

// ─── Analysis Layer ───────────────────────────────────────────────────────────

export function AnalysisLayer({ activeAnalysisData }) {
  if (!activeAnalysisData?.matched_features?.features) return null;

  return (
    <GeoJSON
      key={activeAnalysisData.analysis_id}
      data={activeAnalysisData.matched_features}
      style={(feature) => {
        const analysis = feature.properties?.analysis || {};
        return { fillColor: analysis.warna || '#cbd5e1', weight: 2, opacity: 1, color: 'white', fillOpacity: 0.7 };
      }}
      onEachFeature={(feature, layer) => {
        const analysis = feature.properties?.analysis || {};
        const dataAps = analysis.aps_data || {};
        layer.bindTooltip(`
          <div style="font-family:inherit;padding:6px;">
            <div style="font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.1em;">${analysis.nama_provinsi}</div>
            <div style="font-size:10px;font-weight:800;color:${analysis.warna};margin-top:2px;">STATUS: ${analysis.kategori}</div>
          </div>
        `, { sticky: true, opacity: 0.95 });

        const wawasan = analysis.insights?.map(i =>
          `<div style="margin-bottom:6px;padding-left:10px;border-left:3px solid ${analysis.warna};font-weight:600;">${i}</div>`
        ).join('') || '';

        layer.bindPopup(`
          <div style="font-family:inherit;min-width:280px;color:#1e293b;padding:5px;">
            <div style="background:${analysis.warna};color:white;padding:15px;border-radius:12px 12px 4px 4px;margin-bottom:10px;">
              <div style="font-weight:900;font-size:16px;text-transform:uppercase;letter-spacing:0.1em;">${analysis.nama_provinsi}</div>
              <div style="font-size:10px;font-weight:800;opacity:0.9;text-transform:uppercase;margin-top:4px;">Analisis Strategis Wilayah</div>
            </div>
            <div style="padding:10px;">
              <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;border-bottom:2px solid #f1f5f9;padding-bottom:4px;">Wawasan Utama</div>
              <div style="font-size:12px;color:#334155;line-height:1.5;margin-bottom:15px;">${wawasan}</div>
              <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;border-bottom:2px solid #f1f5f9;padding-bottom:4px;">Matriks Partisipasi</div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                <div style="background:#f8fafc;padding:10px;border-radius:8px;text-align:center;border:1px solid #f1f5f9;">
                  <div style="font-size:9px;font-weight:900;color:#0369a1;text-transform:uppercase;">SD</div>
                  <div style="font-size:13px;font-weight:900;">${dataAps.APS_7_12 || '-'}%</div>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:8px;text-align:center;border:1px solid #f1f5f9;">
                  <div style="font-size:9px;font-weight:900;color:#a16207;text-transform:uppercase;">SMP</div>
                  <div style="font-size:13px;font-weight:900;">${dataAps.APS_13_15 || '-'}%</div>
                </div>
              </div>
            </div>
          </div>
        `);
      }}
    />
  );
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default function MapStuff(props) {
  const { boundaryData, getBoundaryStyle, onEachBoundary } = useBoundaryData(props.activeLayers);
  const modeBersih = props.modeBersih;
  const setModeBersih = props.setModeBersih;

  useEffect(() => {
    document.documentElement.setAttribute('data-clean', modeBersih ? 'true' : 'false');
    const header = document.querySelector('header');
    if (header) {
      header.style.transition = 'opacity 0.2s, transform 0.2s';
      header.style.opacity = modeBersih ? '0' : '';
      header.style.transform = modeBersih ? 'translateY(-100%)' : '';
      header.style.pointerEvents = modeBersih ? 'none' : '';
    }
    return () => {
      document.documentElement.setAttribute('data-clean', 'false');
      const h = document.querySelector('header');
      if (h) { h.style.opacity = ''; h.style.transform = ''; h.style.pointerEvents = ''; }
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

      <DetectionPreviewBox show={props.showPreviewBox} size={props.detectionSize || 640} />
      <ZoomWatcher onZoomChange={props.onZoomChange || (() => { })} />
      <ZoomButtons modeBersih={modeBersih} />
      <CleanModeButton modeBersih={modeBersih} setModeBersih={setModeBersih} />
      <FullscreenButton modeBersih={modeBersih} />
      <MouseCoordinate modeBersih={modeBersih} zoomLevel={props.zoomLevel} />

      <KeyboardShortcuts
        activePanel={props.activePanel}
        setActivePanel={props.setActivePanel}
        modeBersih={modeBersih}
        setModeBersih={setModeBersih}
        setGoHome={props.setGoHome}
      />

      <MapReset trigger={props.goHome} onDone={() => props.setGoHome(false)} />
      <SidebarButtons
        activePanel={props.activePanel}
        setActivePanel={props.setActivePanel}
        setGoHome={props.setGoHome}
        modeBersih={modeBersih}
        mapRef={props.mapRef}
      />
    </>
  );
}