"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Download, Save, X, RotateCcw, Map,
  Loader2, Check, Filter, ChevronDown, Maximize, Minimize,
  Calendar, BarChart2, Search, TrendingUp, DollarSign,
  ShoppingCart, Building2, ArrowLeftRight,
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const KATEGORI_EKON = {
  TINGGI: { warna: '#10b981', label: 'TINGGI' },
  SEDANG: { warna: '#f59e0b', label: 'SEDANG' },
  RENDAH: { warna: '#ef4444', label: 'RENDAH' },
};

export const TAHUN_TERSEDIA_EKON = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

export const DATASET_LABELS_EKON = {
  PDRB_PENGELUARAN: 'PDRB Pengeluaran (KR, PMTB, Net Ekspor, PDRB)',
  PENDUDUK:         'Jumlah Penduduk (Ribu Jiwa)',
};

export const INDIKATOR_LABELS_EKON = {
  ALL: 'Indeks Aktivitas Ekonomi',
};

export const INDIKATOR_COLORS_EKON = {
  ALL: '#0ea5e9',
};

export const BASEMAPS_EKON = {
  OSM:            { label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                          attribution: '&copy; OpenStreetMap' },
  CARTO_LIGHT:    { label: 'Carto Light',   url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',              attribution: '&copy; OpenStreetMap &copy; CARTO' },
  CARTO_DARK:     { label: 'Carto Dark',    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',               attribution: '&copy; OpenStreetMap &copy; CARTO' },
  ESRI_SATELLITE: { label: 'Satelit',       url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
  CARTO_VOYAGER:  { label: 'Voyager',       url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',    attribution: '&copy; OpenStreetMap &copy; CARTO' },
};

export const PUSAT_DEFAULT_EKON = [-2.5, 118];
export const ZOOM_DEFAULT_EKON  = 5;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(' ');

const fmt = (val, decimals = 4) =>
  val !== null && val !== undefined ? Number(val).toFixed(decimals) : '-';

const fmtRp = (val) =>
  val !== null && val !== undefined
    ? Number(val).toLocaleString('id-ID', { maximumFractionDigits: 2 })
    : '-';

// ─── SELECTOR ─────────────────────────────────────────────────────────────────
export function SelectorAnalisis_EKON({
  hasilAnalisis, kombinasiTersedia, tahunTerpilih, onPilih, sedangMuatAwal,
  allProvinces, onPilihProvinsi, provinsiTerpilih,
}) {
  const [openProvinsi, setOpenProvinsi] = useState(false);
  const [openTahun,    setOpenTahun]    = useState(false);
  const [searchProv,   setSearchProv]   = useState('');
  const wrapRef = useRef(null);

  const activeThn       = hasilAnalisis?.tahun || tahunTerpilih;
  const activeProvLabel = provinsiTerpilih || 'All Provinsi';

  useEffect(() => {
    const h = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpenProvinsi(false);
        setOpenTahun(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredProvinces = allProvinces?.filter(p =>
    p.toLowerCase().includes(searchProv.toLowerCase())
  ) || [];

  if (sedangMuatAwal) return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 h-10 px-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
      <Loader2 size={13} className="text-sky-400 animate-spin" />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Memuat data...</span>
    </div>
  );

  const dropdownBase = "absolute top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1010] border border-slate-200 dark:border-slate-700 overflow-hidden py-1";
  const btnBase      = "flex items-center gap-2 h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors select-none";
  const itemBase     = "w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-left transition-colors text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700";
  const itemActive   = "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300";

  return (
    <div ref={wrapRef} className="flex items-stretch shadow-lg rounded-xl overflow-visible">

      {/* ── Provinsi ── */}
      <div className="relative">
        <button onClick={() => { setOpenProvinsi(v => !v); setOpenTahun(false); }}
          className={cn(btnBase, "min-w-[140px] rounded-l-xl border-r-0")}>
          <Search size={12} className="text-slate-400 flex-shrink-0" />
          <span className="flex-1 text-left truncate text-xs">{activeProvLabel}</span>
          <ChevronDown size={12} className={cn('text-slate-400 flex-shrink-0 transition-transform duration-150', openProvinsi && 'rotate-180')} />
        </button>
        {openProvinsi && (
          <div className={cn(dropdownBase, "left-0 w-56")}>
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)}
                  placeholder="Cari provinsi..." autoFocus
                  className="w-full pl-6 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-sky-400 outline-none"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              <button
                onClick={() => { onPilihProvinsi(null); setOpenProvinsi(false); setSearchProv(''); }}
                className={cn(itemBase, !provinsiTerpilih && itemActive)}>
                <span className="flex-1">All Provinsi</span>
                {!provinsiTerpilih && <Check size={12} className="text-sky-500" />}
              </button>
              {filteredProvinces.map(prov => (
                <button key={prov}
                  onClick={() => { onPilihProvinsi(prov); setOpenProvinsi(false); setSearchProv(''); }}
                  className={cn(itemBase, provinsiTerpilih === prov && itemActive)}>
                  <span className="flex-1 text-xs">{prov}</span>
                  {provinsiTerpilih === prov && <Check size={12} className="text-sky-500" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

      {/* ── Indikator (fixed: Indeks Ekonomi) ── */}
      <div className="flex items-center gap-2 h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-r-0 min-w-[180px]">
        <TrendingUp size={12} className="text-sky-500 flex-shrink-0" />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex-1">Indeks Aktivitas Ekonomi</span>
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

      {/* ── Tahun ── */}
      <div className="relative">
        <button onClick={() => { setOpenTahun(v => !v); setOpenProvinsi(false); }}
          className={cn(btnBase, "min-w-[120px] rounded-r-xl")}>
          <Calendar size={12} className="text-slate-400 flex-shrink-0" />
          <span className="flex-1 text-left text-xs">Tahun {activeThn}</span>
          <ChevronDown size={12} className={cn('text-slate-400 flex-shrink-0 transition-transform duration-150', openTahun && 'rotate-180')} />
        </button>
        {openTahun && (
          <div className={cn(dropdownBase, "right-0 min-w-[140px]")}>
            {TAHUN_TERSEDIA_EKON.slice().reverse().map(th => {
              const ada      = !!kombinasiTersedia[`${th}`];
              const isActive = activeThn === th;
              return (
                <button key={th}
                  onClick={() => { setOpenTahun(false); onPilih(th); }}
                  className={cn(itemBase, isActive && itemActive, "justify-between")}>
                  <span className="text-xs">{th}</span>
                  <span className="flex items-center gap-1.5">
                    {ada && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                    {isActive && <Check size={12} className="text-sky-500" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CARD & BTN ───────────────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm', className)}>
    {children}
  </div>
);

const Btn = ({ children, variant = 'primary', className = '', ...props }) => {
  const v = {
    primary: 'bg-sky-600 hover:bg-sky-700 text-white',
    ghost:   'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
    danger:  'bg-slate-600 hover:bg-slate-700 text-white',
    save:    'bg-emerald-600 hover:bg-emerald-700 text-white',
  };
  return (
    <button className={cn('flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 shadow-lg', v[variant], className)} {...props}>
      {children}
    </button>
  );
};

const MapBtn = ({ children, onClick, className = '', title = '' }) => (
  <button onClick={onClick} title={title}
    className={cn('w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg flex items-center justify-center shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-200', className)}>
    {children}
  </button>
);

function MapEventHandler({ setKoordinatCursor, setCurrentZoom }) {
  const [rl, setRl] = useState(null);
  useEffect(() => { import('react-leaflet').then(m => setRl(m)); }, []);
  if (!rl) return null;
  const { useMapEvents } = rl;
  const Inner = () => {
    useMapEvents({
      mousemove: e => setKoordinatCursor({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) }),
      zoomend:   e => setCurrentZoom(e.target.getZoom()),
    });
    return null;
  };
  return <Inner />;
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
function buildTooltipHTML_EKON(a, w, kat) {
  const dc = a.data_komponen || {};
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;padding:10px 12px;min-width:170px;max-width:210px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${w};flex-shrink:0;"></div>
        <span style="font-weight:800;font-size:12px;color:#0f172a;line-height:1.2;">${a.nama_provinsi || ''}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-radius:6px;background:${w}18;border:1px solid ${w}40;">
        <span style="font-size:10px;font-weight:700;color:${w};text-transform:uppercase;">${kat || '-'}</span>
        <span style="font-size:12px;font-weight:900;color:#0f172a;">${a.indeks_ekonomi ?? '-'}</span>
      </div>
      <div style="margin-top:8px;display:grid;gap:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;color:#64748b;">KR/kapita</span>
          <span style="font-size:11px;font-weight:700;color:#10b981;">${fmtRp(dc.kr_per_kapita)} Mlrd/Rb jiwa</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;color:#64748b;">PMTB/kapita</span>
          <span style="font-size:11px;font-weight:700;color:#6366f1;">${fmtRp(dc.pmtb_per_kapita)} Mlrd/Rb jiwa</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;color:#64748b;">Net Ekspor/kap</span>
          <span style="font-size:11px;font-weight:700;color:#f59e0b;">${fmtRp(dc.net_per_kapita)} Mlrd/Rb jiwa</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;color:#64748b;">PDRB/kapita</span>
          <span style="font-size:11px;font-weight:700;color:#0ea5e9;">${fmtRp(dc.pdrb_per_kapita)} Mlrd/Rb jiwa</span>
        </div>
      </div>
      <div style="margin-top:6px;display:flex;gap:6px;">
        <div style="text-align:center;flex:1;padding:3px;background:#f8fafc;border-radius:4px;">
          <div style="font-size:8px;color:#94a3b8;font-weight:600;">KR</div>
          <div style="font-size:10px;font-weight:700;color:#10b981;">${a.kr_norm ?? '-'}</div>
        </div>
        <div style="text-align:center;flex:1;padding:3px;background:#f8fafc;border-radius:4px;">
          <div style="font-size:8px;color:#94a3b8;font-weight:600;">INV</div>
          <div style="font-size:10px;font-weight:700;color:#6366f1;">${a.pmtb_norm ?? '-'}</div>
        </div>
        <div style="text-align:center;flex:1;padding:3px;background:#f8fafc;border-radius:4px;">
          <div style="font-size:8px;color:#94a3b8;font-weight:600;">NET</div>
          <div style="font-size:10px;font-weight:700;color:#f59e0b;">${a.net_norm ?? '-'}</div>
        </div>
        <div style="text-align:center;flex:1;padding:3px;background:#f8fafc;border-radius:4px;">
          <div style="font-size:8px;color:#94a3b8;font-weight:600;">PDRB</div>
          <div style="font-size:10px;font-weight:700;color:#0ea5e9;">${a.pdrb_norm ?? '-'}</div>
        </div>
      </div>
    </div>`;
}

function buildGeoProps_EKON(hasilAnalisis, kategoriTerpilih, provinsiDipilih, getWarna, getKategori) {
  return {
    data: { type: 'FeatureCollection', features: hasilAnalisis.matched_features.features },
    style: (fitur) => {
      const a   = fitur?.properties?.ekon_analysis || {};
      const kat = getKategori(fitur);
      const w   = getWarna(fitur);
      const vis = kategoriTerpilih === 'SEMUA' || kat === kategoriTerpilih;
      const hl  = provinsiDipilih === a.nama_provinsi;
      return {
        fillColor:   w,
        weight:      hl ? 3 : 1,
        opacity:     (vis && w !== '#cbd5e1') ? 1 : 0,
        color:       hl ? '#ffffff' : 'rgba(255,255,255,0.5)',
        fillOpacity: (vis && w !== '#cbd5e1') ? (hl ? 0.95 : 0.78) : 0,
      };
    },
    onEachFeature: (fitur, lapisan) => {
      const a   = fitur.properties?.ekon_analysis || {};
      const w   = getWarna(fitur);
      const kat = getKategori(fitur);

      lapisan.bindTooltip(buildTooltipHTML_EKON(a, w, kat), {
        sticky: true, opacity: 1,
        className: 'leaflet-tooltip-ekon',
      });

      lapisan.on('mouseover', function() {
        this.setStyle({ weight: 2.5, fillOpacity: 0.95, color: '#ffffff' });
      });
      lapisan.on('mouseout', function() {
        const isSelected = provinsiDipilih === a.nama_provinsi;
        this.setStyle({
          weight:      isSelected ? 3 : 1,
          fillOpacity: isSelected ? 0.95 : 0.78,
          color:       isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)',
        });
      });
    },
  };
}

// ─── PETA EKON (DEFAULT EXPORT) ───────────────────────────────────────────────
export default function PetaEkon({
  hasilAnalisis, tahunTerpilih, kategoriTerpilih, setKategoriTerpilih,
  sedangMenganalisis, sedangCekData, dataBaruDariBPS, pernahAnalisis,
  onAnalisis, onSimpan, onReset,
  leafletReady, MapCont, TileLay, GeoComp,
  petaRef, basemap, setBasemap,
  koordinatCursor, setKoordinatCursor, currentZoom, setCurrentZoom,
  provinsiDipilih, setProvinsiDipilih,
  kombinasiTersedia, onPilihTahun, sedangMuatAwal,
  jumlahKategori,
  getWarna, getKategori,
}) {
  const [showBasemap,  setShowBasemap]  = useState(false);
  const [menuFilter,   setMenuFilter]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hitungScaleKm = (zoom) => ({ 5:1000, 6:500, 7:200, 8:100, 9:50, 10:25 })[Math.floor(zoom)] || 1000;

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Memproses...';
    if (sedangCekData)      return 'Memeriksa...';
    if (!pernahAnalisis)    return 'Analisis Ekonomi';
    return 'Analisis Ekonomi';
  };

  const allProvinces = hasilAnalisis?.matched_features?.features
    ?.map(f => f.properties?.ekon_analysis?.nama_provinsi)
    .filter(Boolean)
    .sort() || [];

  const handlePilihProvinsi = useCallback((prov) => {
    setProvinsiDipilih(prov);
    if (prov && petaRef.current) {
      const f = hasilAnalisis?.matched_features?.features?.find(
        feat => feat.properties?.ekon_analysis?.nama_provinsi === prov
      );
      if (f) {
        const coords = f.geometry.coordinates;
        let lat, lng;
        if (f.geometry.type === 'MultiPolygon') {
          const p = coords[0][0]; lat = p.reduce((s,c)=>s+c[1],0)/p.length; lng = p.reduce((s,c)=>s+c[0],0)/p.length;
        } else {
          const p = coords[0]; lat = p.reduce((s,c)=>s+c[1],0)/p.length; lng = p.reduce((s,c)=>s+c[0],0)/p.length;
        }
        petaRef.current.setView([lat, lng], 7);
      }
    }
  }, [setProvinsiDipilih, petaRef, hasilAnalisis]);

  const geoKey   = `${hasilAnalisis?.tahun}-${kategoriTerpilih}-${provinsiDipilih}`;
  const geoProps = hasilAnalisis?.matched_features?.features
    ? buildGeoProps_EKON(hasilAnalisis, kategoriTerpilih, provinsiDipilih, getWarna, getKategori)
    : null;

  const renderMapContent = (keyPrefix) => (
    <>
      {leafletReady && MapCont && (
        <MapCont center={PUSAT_DEFAULT_EKON} zoom={ZOOM_DEFAULT_EKON}
          style={{ height: '100%', width: '100%' }} zoomControl={false} ref={petaRef}
          className="z-0">
          <TileLay key={basemap} url={BASEMAPS_EKON[basemap].url} attribution={BASEMAPS_EKON[basemap].attribution}/>
          <MapEventHandler setKoordinatCursor={setKoordinatCursor} setCurrentZoom={setCurrentZoom}/>
          {geoProps && <GeoComp key={`${keyPrefix}-${geoKey}`} {...geoProps} />}
        </MapCont>
      )}

      <style>{`
        .leaflet-tooltip-ekon {
          background: white !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
          padding: 0 !important;
          font-family: system-ui, sans-serif !important;
        }
        .leaflet-tooltip-ekon::before { display: none !important; }
      `}</style>

      {/* ── Kontrol Kiri ── */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        <MapBtn onClick={() => petaRef.current?.zoomIn()} title="Zoom In" className="font-bold text-lg leading-none">+</MapBtn>
        <MapBtn onClick={() => petaRef.current?.zoomOut()} title="Zoom Out" className="font-bold text-lg leading-none">−</MapBtn>
        <div className="relative">
          <MapBtn onClick={() => setShowBasemap(v => !v)} title="Pilih Basemap">
            <Map size={13}/>
          </MapBtn>
          {showBasemap && (
            <div className="absolute left-full ml-2 top-0 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[500] border border-slate-200 dark:border-slate-700 py-1">
              <div className="px-3 py-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Basemap</div>
              {Object.entries(BASEMAPS_EKON).map(([k, bm]) => (
                <button key={k} onClick={() => { setBasemap(k); setShowBasemap(false); }}
                  className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
                    basemap === k ? 'text-sky-600 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                  {bm.label} {basemap === k && <Check size={11}/>}
                </button>
              ))}
            </div>
          )}
        </div>
        <MapBtn onClick={() => petaRef.current?.setView(PUSAT_DEFAULT_EKON, ZOOM_DEFAULT_EKON)} title="Reset View">
          <RotateCcw size={12}/>
        </MapBtn>
      </div>

      {/* ── Nav Tengah (Selector) ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400]">
        <SelectorAnalisis_EKON
          hasilAnalisis={hasilAnalisis}
          kombinasiTersedia={kombinasiTersedia}
          tahunTerpilih={tahunTerpilih}
          onPilih={onPilihTahun}
          sedangMuatAwal={sedangMuatAwal}
          allProvinces={allProvinces}
          onPilihProvinsi={handlePilihProvinsi}
          provinsiTerpilih={provinsiDipilih}
        />
      </div>

      {/* ── Legenda & Koordinat Kanan ── */}
      <div className={cn(
        "absolute top-3 z-[400] flex flex-col gap-2 items-end",
        isFullscreen ? "right-8" : "right-3"
      )}>
        {/* Koordinat */}
        <div className="bg-white/95 dark:bg-slate-800/95 px-2.5 py-1.5 rounded-lg shadow border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
          <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span className="text-sky-500 font-bold">Lat:</span> {koordinatCursor.lat} &nbsp;
            <span className="text-sky-500 font-bold">Lng:</span> {koordinatCursor.lng}
          </div>
        </div>

        {/* Legenda */}
        <div className="bg-white/95 dark:bg-slate-800/95 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm min-w-[120px]">
          <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Status IEKON</div>
          {Object.entries(KATEGORI_EKON).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 mb-1.5 last:mb-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.warna }}/>
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{v.label}</span>
              </div>
              {hasilAnalisis && (
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">
                  {jumlahKategori[k] ?? 0}
                </span>
              )}
            </div>
          ))}

          {/* Skala */}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="h-1 bg-slate-300 dark:bg-slate-600 mb-1" style={{ width:'56px', borderLeft:'2px solid #64748b', borderRight:'2px solid #64748b', borderBottom:'2px solid #64748b' }}/>
            <div className="text-[9px] font-medium text-slate-500 dark:text-slate-400">{hitungScaleKm(currentZoom)} km</div>
          </div>

          {hasilAnalisis && (
            <div className="relative mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setMenuFilter(v => !v)}
                className="w-full flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <Filter size={9}/> {kategoriTerpilih} <ChevronDown size={9}/>
              </button>
              {menuFilter && (
                <div className="absolute bottom-full mb-1 right-0 w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-[500] py-1">
                  {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(k => (
                    <button key={k} onClick={() => { setKategoriTerpilih(k); setMenuFilter(false); }}
                      className={cn('w-full text-left px-3 py-1.5 text-[10px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
                        kategoriTerpilih === k ? 'text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-200')}>
                      {k}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] flex gap-2">
        <Btn onClick={onAnalisis} disabled={sedangMenganalisis || sedangCekData} variant="primary"
          className="uppercase tracking-wider shadow-xl whitespace-nowrap"
          style={{ boxShadow: '0 8px 24px rgba(14,165,233,0.35)' }}>
          {(sedangCekData || sedangMenganalisis) ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
          {getButtonText()}
        </Btn>
        {dataBaruDariBPS && hasilAnalisis && (
          <Btn variant="save" onClick={onSimpan} className="uppercase tracking-wider shadow-xl">
            <Save size={12}/> Simpan
          </Btn>
        )}
        {hasilAnalisis && (
          <Btn variant="ghost" onClick={onReset} className="uppercase tracking-wider shadow-xl">
            <RotateCcw size={12}/> Reset
          </Btn>
        )}
      </div>
    </>
  );

  // ── FULLSCREEN ─────────────────────────────────────────────────────────────
  if (isFullscreen) return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col" style={{ height:'100dvh', width:'100vw', top:0, left:0 }}>
      <div className="relative flex-1 min-h-0">
        {renderMapContent('fs')}
        <div className="absolute bottom-4 left-4 z-[400]">
          <button onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 transition-all active:scale-95 group">
            <Minimize size={12} className="text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors">Minimize</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ── NORMAL ─────────────────────────────────────────────────────────────────
  return (
    <Card className="overflow-hidden border-2 dark:border-slate-700">
      <div className="relative" style={{ height: 520 }}>
        {sedangMuatAwal && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-sky-500 animate-spin"/>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Memuat data dari database...</p>
            </div>
          </div>
        )}
        {renderMapContent('normal')}
        <div className="absolute bottom-4 left-4 z-[400]">
          <button onClick={() => setIsFullscreen(true)} title="Fullscreen"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:border-sky-400 transition-all active:scale-95 group">
            <Maximize size={12} className="text-slate-600 dark:text-slate-300 group-hover:text-sky-600 transition-colors" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-sky-600 transition-colors">Maximize</span>
          </button>
        </div>
      </div>
    </Card>
  );
}