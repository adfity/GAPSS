"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Download, Save, RotateCcw, Map, Loader2, Check,
  Filter, ChevronDown, Maximize, Minimize, Calendar,
  BarChart2, Heart, BookOpen, Wallet, Search, Brain,
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const KATEGORI_SDM = {
  TINGGI: { warna: '#10b981', label: 'TINGGI' },
  SEDANG: { warna: '#f59e0b', label: 'SEDANG' },
  RENDAH: { warna: '#ef4444', label: 'RENDAH' },
};

export const TAHUN_BPS_AKTUAL  = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
export const TAHUN_ARIMA       = Array.from({ length: 21 }, (_, i) => 2025 + i);
export const TAHUN_TERSEDIA_SDM = [...new Set([...TAHUN_BPS_AKTUAL, ...TAHUN_ARIMA])].sort((a, b) => a - b);

export const DATASET_LABELS_SDM = {
  UHH:       'Umur Harapan Hidup (UHH)',
  HLS:       'Harapan Lama Sekolah (HLS)',
  RLS:       'Rata-rata Lama Sekolah (RLS)',
  DAYA_BELI: 'Pengeluaran per Kapita Disesuaikan',
};

export const INDIKATOR_LABELS_SDM = {
  ALL:        'Indeks SDM (Semua)',
  KESEHATAN:  'Indeks Kesehatan',
  PENDIDIKAN: 'Indeks Pendidikan',
  DAYA_BELI:  'Indeks Daya Beli',
};

export const INDIKATOR_ICON_SDM = {
  ALL:        <BarChart2 size={13} />,
  KESEHATAN:  <Heart size={13} />,
  PENDIDIKAN: <BookOpen size={13} />,
  DAYA_BELI:  <Wallet size={13} />,
};

export const INDIKATOR_COLORS_SDM = {
  ALL:       '#6366f1',
  KESEHATAN: '#10b981',
  PENDIDIKAN:'#3b82f6',
  DAYA_BELI: '#f59e0b',
};

export const BASEMAPS_SDM = {
  OSM:            { label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                           attribution: '&copy; OpenStreetMap' },
  CARTO_LIGHT:    { label: 'Carto Light',   url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                               attribution: '&copy; CARTO' },
  CARTO_DARK:     { label: 'Carto Dark',    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                attribution: '&copy; CARTO' },
  ESRI_SATELLITE: { label: 'Satelit',       url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
  CARTO_VOYAGER:  { label: 'Voyager',       url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',                     attribution: '&copy; CARTO' },
};

export const PUSAT_DEFAULT_SDM = [-2.5, 118];
export const ZOOM_DEFAULT_SDM  = 5;
export const isPrediksiYear    = (tahun) => tahun > 2026;

const cn = (...cls) => cls.filter(Boolean).join(' ');

// ─── SELECTOR ─────────────────────────────────────────────────────────────────
export function SelectorAnalisis_SDM({ hasilAnalisis, kombinasiTersedia, tahunTerpilih, onPilih, sedangMuatAwal, allProvinces, onPilihProvinsi, provinsiTerpilih }) {
  const [openProvinsi,  setOpenProvinsi]  = useState(false);
  const [openIndikator, setOpenIndikator] = useState(false);
  const [openTahun,     setOpenTahun]     = useState(false);
  const [searchProv,    setSearchProv]    = useState('');
  const wrapRef = useRef(null);

  const activeInd  = hasilAnalisis?.indikator || 'ALL';
  const activeThn  = hasilAnalisis?.tahun     || tahunTerpilih;
  const isPrediksi = isPrediksiYear(activeThn);

  useEffect(() => {
    const h = (e) => { if (!wrapRef.current?.contains(e.target)) { setOpenProvinsi(false); setOpenIndikator(false); setOpenTahun(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredProvinces = allProvinces?.filter(p => p.toLowerCase().includes(searchProv.toLowerCase())) || [];

  if (sedangMuatAwal) return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 h-10 px-4 rounded-lg shadow border border-slate-200 dark:border-slate-600">
      <Loader2 size={13} className="text-indigo-400 animate-spin" />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Memuat...</span>
    </div>
  );

  const dropdownBase = "absolute top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1010] border border-slate-200 dark:border-slate-600 overflow-hidden py-1";
  const btnBase      = "flex items-center gap-1.5 h-10 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors select-none";
  const itemBase     = "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
  const itemActive   = "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300";

  return (
    <div ref={wrapRef} className="flex items-stretch shadow-lg rounded-xl overflow-visible">
      {/* Provinsi */}
      <div className="relative">
        <button onClick={() => { setOpenProvinsi(v => !v); setOpenIndikator(false); setOpenTahun(false); }}
          className={cn(btnBase, "min-w-[120px] sm:min-w-[140px] rounded-l-xl border-r-0")}>
          <Search size={11} className="text-slate-400 flex-shrink-0" />
          <span className="flex-1 text-left truncate max-w-[80px] sm:max-w-[100px]">{provinsiTerpilih || 'All Provinsi'}</span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openProvinsi && 'rotate-180')} />
        </button>
        {openProvinsi && (
          <div className={cn(dropdownBase, "left-0 w-52")}>
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)} placeholder="Cari provinsi..." autoFocus
                  className="w-full pl-6 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-400 outline-none" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button onClick={() => { onPilihProvinsi(null); setOpenProvinsi(false); setSearchProv(''); }} className={cn(itemBase, !provinsiTerpilih && itemActive)}>
                <span className="flex-1">All Provinsi</span>
                {!provinsiTerpilih && <Check size={11} className="text-indigo-500" />}
              </button>
              {filteredProvinces.map(prov => (
                <button key={prov} onClick={() => { onPilihProvinsi(prov); setOpenProvinsi(false); setSearchProv(''); }} className={cn(itemBase, provinsiTerpilih === prov && itemActive)}>
                  <span className="flex-1">{prov}</span>
                  {provinsiTerpilih === prov && <Check size={11} className="text-indigo-500" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-600 flex-shrink-0" />

      {/* Indikator */}
      <div className="relative hidden sm:block">
        <button onClick={() => { setOpenIndikator(v => !v); setOpenProvinsi(false); setOpenTahun(false); }}
          className={cn(btnBase, "min-w-[150px] border-r-0")}>
          <span style={{ color: INDIKATOR_COLORS_SDM[activeInd] }}>{INDIKATOR_ICON_SDM[activeInd]}</span>
          <span className="flex-1 text-left truncate">{INDIKATOR_LABELS_SDM[activeInd]}</span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openIndikator && 'rotate-180')} />
        </button>
        {openIndikator && (
          <div className={cn(dropdownBase, "left-0 min-w-[190px]")}>
            {['ALL', 'KESEHATAN', 'PENDIDIKAN', 'DAYA_BELI'].map(ind => (
              <button key={ind} onClick={() => { setOpenIndikator(false); onPilih(activeThn, ind); }} className={cn(itemBase, activeInd === ind && itemActive)}>
                <span style={{ color: INDIKATOR_COLORS_SDM[ind] }}>{INDIKATOR_ICON_SDM[ind]}</span>
                <span className="flex-1">{INDIKATOR_LABELS_SDM[ind]}</span>
                {activeInd === ind && <Check size={11} className="text-indigo-500" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-600 flex-shrink-0 hidden sm:block" />

      {/* Tahun */}
      <div className="relative">
        <button onClick={() => { setOpenTahun(v => !v); setOpenProvinsi(false); setOpenIndikator(false); }}
          className={cn(btnBase, "min-w-[100px] rounded-r-xl")}>
          <Calendar size={11} className={cn("flex-shrink-0", isPrediksi ? "text-indigo-400" : "text-slate-400")} />
          <span className={cn("flex-1 text-left", isPrediksi && "text-indigo-600 dark:text-indigo-400 font-semibold")}>
            {activeThn}
            {isPrediksi && <span className="ml-1 text-[9px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 px-1 py-0.5 rounded font-bold">AI</span>}
          </span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openTahun && 'rotate-180')} />
        </button>
        {openTahun && (
          <div className={cn(dropdownBase, "right-0 min-w-[150px] max-h-64 overflow-y-auto")}>
            <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-700/60 sticky top-0">
              Data Aktual BPS
            </div>
            {TAHUN_BPS_AKTUAL.slice().reverse().map(th => (
              <button key={th} onClick={() => { setOpenTahun(false); onPilih(th, activeInd); }} className={cn(itemBase, activeThn === th && itemActive, "justify-between")}>
                <span>{th}</span>
                {activeThn === th && <Check size={11} className="text-indigo-500" />}
              </button>
            ))}
            <div className="px-3 py-1.5 text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 sticky top-0">
              ⚙️ Prediksi ARIMA
            </div>
            {TAHUN_ARIMA.filter(t => t > 2026).map(th => (
              <button key={th} onClick={() => { setOpenTahun(false); onPilih(th, activeInd); }} className={cn(itemBase, activeThn === th && itemActive, "justify-between")}>
                <span className="text-indigo-600 dark:text-indigo-400">{th}</span>
                {activeThn === th && <Check size={11} className="text-indigo-500" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────
function buildTooltipHTML(a, w, kat, indikatorTerpilih) {
  const dc         = a.data_komponen || {};
  const isArima    = a.use_arima;
  const arimaKeys  = a.arima_keys_used || [];
  const skenarioAI = a.skenario_arima || '';
  const metrics    = a.arima_metrics || {};

  let bestWmape = null;
  if (isArima) arimaKeys.forEach(k => { const w = metrics[k]?.cv_wmape; if (w != null && (bestWmape === null || w < bestWmape)) bestWmape = w; });
  const qualityGrade = bestWmape != null ? (bestWmape < 2 ? '🥇' : bestWmape < 5 ? '✅' : bestWmape < 10 ? '⚠️' : '❌') : '';

  const arimaBadge = isArima ? `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700;background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #a5b4fc;color:#4f46e5;">⚙️ ARIMA v4.0 · ${skenarioAI}${bestWmape != null ? ` <span style="opacity:.8">${qualityGrade} ${bestWmape.toFixed(1)}%</span>` : ''}</div>` : '';

  const mkAI = k => isArima && arimaKeys.includes(k) ? ' <span style="color:#6366f1;font-size:8px;">⚙️</span>' : '';

  let kompHTML = '';
  if (indikatorTerpilih === 'ALL') {
    kompHTML = `<div style="margin-top:8px;display:grid;gap:4px;">
      <div style="display:flex;justify-content:space-between;"><span style="font-size:10px;color:#64748b;">UHH${mkAI('UHH')}</span><span style="font-size:11px;font-weight:700;color:#047857;">${dc.UHH ?? '-'} th</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="font-size:10px;color:#64748b;">RLS${mkAI('RLS')} / HLS${mkAI('HLS')}</span><span style="font-size:11px;font-weight:700;color:#1e40af;">${dc.RLS ?? '-'} / ${dc.HLS ?? '-'} th</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="font-size:10px;color:#64748b;">Pengeluaran${mkAI('DAYA_BELI')}</span><span style="font-size:11px;font-weight:700;color:#b45309;">Rp${dc.DAYA_BELI ? dc.DAYA_BELI.toLocaleString('id-ID') : '-'}rb</span></div>
    </div>`;
  }

  return `<div style="font-family:system-ui,sans-serif;padding:10px 12px;min-width:160px;max-width:220px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${w};flex-shrink:0;"></div>
      <span style="font-weight:800;font-size:12px;color:#0f172a;">${a.nama_provinsi || ''}</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-radius:6px;background:${w}18;border:1px solid ${w}40;">
      <span style="font-size:10px;font-weight:700;color:${w};text-transform:uppercase;">${kat || '-'}</span>
      <span style="font-size:12px;font-weight:900;color:#0f172a;">${a.indeks_sdm ?? '-'}</span>
    </div>
    <div style="margin-top:6px;display:flex;gap:6px;">
      ${[['IK',a.ik,'#10b981'],['IP',a.ip,'#3b82f6'],['IDB',a.idb,'#f59e0b']].map(([l,v,c]) => `<div style="text-align:center;flex:1;padding:3px;background:#f8fafc;border-radius:4px;"><div style="font-size:8px;color:#94a3b8;font-weight:600;">${l}</div><div style="font-size:10px;font-weight:700;color:${c};">${v ?? '-'}</div></div>`).join('')}
    </div>
    ${kompHTML}${arimaBadge}
  </div>`;
}

function buildGeoProps(hasilAnalisis, indikatorTerpilih, kategoriTerpilih, provinsiDipilih, getWarna, getKategori) {
  return {
    data: { type: 'FeatureCollection', features: hasilAnalisis.matched_features.features },
    style: (fitur) => {
      const a   = fitur?.properties?.sdm_analysis || {};
      const kat = getKategori(fitur, indikatorTerpilih);
      const w   = getWarna(fitur, indikatorTerpilih);
      const vis = kategoriTerpilih === 'SEMUA' || kat === kategoriTerpilih;
      const hl  = provinsiDipilih === a.nama_provinsi;
      return { fillColor: w, weight: hl ? 3 : 1, opacity: (vis && w !== '#cbd5e1') ? 1 : 0, color: hl ? '#ffffff' : 'rgba(255,255,255,0.5)', fillOpacity: (vis && w !== '#cbd5e1') ? (hl ? 0.95 : 0.78) : 0 };
    },
    onEachFeature: (fitur, lapisan) => {
      const a   = fitur.properties?.sdm_analysis || {};
      const w   = getWarna(fitur, indikatorTerpilih);
      const kat = getKategori(fitur, indikatorTerpilih);
      lapisan.bindTooltip(buildTooltipHTML(a, w, kat, indikatorTerpilih), { sticky: true, opacity: 1, className: 'leaflet-tooltip-sdm' });
      lapisan.on('mouseover', function () { this.setStyle({ weight: 2.5, fillOpacity: 0.95, color: '#ffffff' }); });
      lapisan.on('mouseout',  function () {
        const sel = provinsiDipilih === a.nama_provinsi;
        this.setStyle({ weight: sel ? 3 : 1, fillOpacity: sel ? 0.95 : 0.78, color: sel ? '#ffffff' : 'rgba(255,255,255,0.5)' });
      });
    },
  };
}

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

// ─── MAP BUTTON ───────────────────────────────────────────────────────────────
const MapBtn = ({ children, onClick, className = '', title = '' }) => (
  <button onClick={onClick} title={title}
    className={cn('w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg flex items-center justify-center shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-100', className)}>
    {children}
  </button>
);

const ActionBtn = ({ children, variant = 'primary', className = '', disabled, onClick }) => {
  const v = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30',
    save:    'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30',
    ghost:   'bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 shadow-lg uppercase tracking-wider', v[variant], className)}>
      {children}
    </button>
  );
};

// ─── PETA SDM ─────────────────────────────────────────────────────────────────
export default function PetaSDM({
  hasilAnalisis, tahunTerpilih, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
  sedangMenganalisis, sedangCekData, dataBaruDariBPS, pernahAnalisis,
  onAnalisis, onSimpan, onReset,
  leafletReady, MapCont, TileLay, GeoComp,
  petaRef, basemap, setBasemap,
  koordinatCursor, setKoordinatCursor, currentZoom, setCurrentZoom,
  provinsiDipilih, setProvinsiDipilih,
  kombinasiTersedia, onPilihKombo, sedangMuatAwal,
  jumlahKategori, getWarna, getKategori,
}) {
  const [showBasemap,  setShowBasemap]  = useState(false);
  const [menuFilter,   setMenuFilter]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const useArima      = hasilAnalisis?.use_arima;
  const skenarioArima = hasilAnalisis?.skenario;
  const arimaKeysList = hasilAnalisis?.arima_keys || [];
  const arimaMetrics  = hasilAnalisis?.arima_metrics || {};
  const isPrediksi    = hasilAnalisis?.is_prediction_year;

  const bestMetric = Object.values(arimaMetrics).reduce((best, m) => (!m?.cv_wmape ? best : (!best || m.cv_wmape < best.cv_wmape ? m : best)), null);

  const allProvinces = hasilAnalisis?.matched_features?.features?.map(f => f.properties?.sdm_analysis?.nama_provinsi).filter(Boolean).sort() || [];

  const handlePilihProvinsi = useCallback((prov) => {
    setProvinsiDipilih(prov);
    if (prov && petaRef.current) {
      const f = hasilAnalisis?.matched_features?.features?.find(feat => feat.properties?.sdm_analysis?.nama_provinsi === prov);
      if (f) {
        const coords = f.geometry.coordinates;
        let lat, lng;
        if (f.geometry.type === 'MultiPolygon') {
          const p = coords[0][0]; lat = p.reduce((s, c) => s + c[1], 0) / p.length; lng = p.reduce((s, c) => s + c[0], 0) / p.length;
        } else {
          const p = coords[0];    lat = p.reduce((s, c) => s + c[1], 0) / p.length; lng = p.reduce((s, c) => s + c[0], 0) / p.length;
        }
        petaRef.current.setView([lat, lng], 7);
      }
    }
  }, [setProvinsiDipilih, petaRef, hasilAnalisis]);

  const geoKey   = `${hasilAnalisis?.tahun}-${indikatorTerpilih}-${kategoriTerpilih}-${provinsiDipilih}`;
  const geoProps = hasilAnalisis?.matched_features?.features ? buildGeoProps(hasilAnalisis, indikatorTerpilih, kategoriTerpilih, provinsiDipilih, getWarna, getKategori) : null;

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Memproses...';
    if (sedangCekData)      return 'Memeriksa...';
    if (!pernahAnalisis)    return 'Analisis SDM';
    return ({ ALL: 'SDM Gabungan', KESEHATAN: 'Kesehatan', PENDIDIKAN: 'Pendidikan', DAYA_BELI: 'Daya Beli' })[indikatorTerpilih] || 'Analisis';
  };

  const renderMapContent = (keyPrefix) => (
    <>
      {leafletReady && MapCont && (
        <MapCont center={PUSAT_DEFAULT_SDM} zoom={ZOOM_DEFAULT_SDM} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={petaRef} className="z-0">
          <TileLay key={basemap} url={BASEMAPS_SDM[basemap].url} attribution={BASEMAPS_SDM[basemap].attribution} />
          <MapEventHandler setKoordinatCursor={setKoordinatCursor} setCurrentZoom={setCurrentZoom} />
          {geoProps && <GeoComp key={`${keyPrefix}-${geoKey}`} {...geoProps} />}
        </MapCont>
      )}

      <style>{`
        .leaflet-tooltip-sdm { background: white !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; padding: 0 !important; }
        .leaflet-tooltip-sdm::before { display: none !important; }
      `}</style>

      {/* Kontrol Kiri */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        <MapBtn onClick={() => petaRef.current?.zoomIn()}  title="Zoom In"  className="font-bold text-lg leading-none">+</MapBtn>
        <MapBtn onClick={() => petaRef.current?.zoomOut()} title="Zoom Out" className="font-bold text-lg leading-none">−</MapBtn>
        <div className="relative">
          <MapBtn onClick={() => setShowBasemap(v => !v)} title="Basemap"><Map size={13} /></MapBtn>
          {showBasemap && (
            <div className="absolute left-full ml-2 top-0 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[500] border border-slate-200 dark:border-slate-600 py-1">
              <div className="px-3 py-2 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Basemap</div>
              {Object.entries(BASEMAPS_SDM).map(([k, bm]) => (
                <button key={k} onClick={() => { setBasemap(k); setShowBasemap(false); }}
                  className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-700', basemap === k ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-200')}>
                  {bm.label} {basemap === k && <Check size={11} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <MapBtn onClick={() => petaRef.current?.setView(PUSAT_DEFAULT_SDM, ZOOM_DEFAULT_SDM)} title="Reset View"><RotateCcw size={12} /></MapBtn>
      </div>

      {/* Selector tengah */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] w-max max-w-[calc(100%-120px)]">
        <SelectorAnalisis_SDM
          hasilAnalisis={hasilAnalisis} kombinasiTersedia={kombinasiTersedia}
          tahunTerpilih={tahunTerpilih} onPilih={onPilihKombo} sedangMuatAwal={sedangMuatAwal}
          allProvinces={allProvinces} onPilihProvinsi={handlePilihProvinsi} provinsiTerpilih={provinsiDipilih}
        />
      </div>

      {/* Panel kanan */}
      <div className={cn('absolute top-3 z-[400] flex flex-col gap-2 items-end', isFullscreen ? 'right-8' : 'right-3')}>
        {/* Koordinat */}
        <div className="bg-white/95 dark:bg-slate-800/95 px-2 py-1 rounded-lg shadow border border-slate-200 dark:border-slate-600 backdrop-blur-sm">
          <div className="text-[9px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className="text-indigo-500 font-bold">Lat:</span> {koordinatCursor.lat} &nbsp;
            <span className="text-indigo-500 font-bold">Lng:</span> {koordinatCursor.lng}
          </div>
        </div>

        {/* ARIMA info */}
        {useArima && skenarioArima && (
          <div className="bg-white/97 dark:bg-slate-800/97 p-2.5 rounded-xl shadow-lg border backdrop-blur-sm max-w-[180px]" style={{ borderColor: '#a5b4fc' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Brain size={11} className="text-indigo-500 flex-shrink-0" />
              <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300">ARIMA v4.0</span>
              <span className="text-[8px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">{skenarioArima}</span>
              {isPrediksi && <span className="text-[8px] bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold">Prediksi</span>}
            </div>
            {arimaKeysList.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {arimaKeysList.map(k => <span key={k} className="text-[8px] font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded">{k}</span>)}
              </div>
            )}
            {bestMetric?.cv_wmape != null && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400">WMAPE:</span>
                <span className="text-[9px] font-black" style={{ color: bestMetric.quality?.color || '#6366f1' }}>
                  {bestMetric.cv_wmape.toFixed(2)}% {bestMetric.quality?.grade}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Legenda */}
        <div className="bg-white/95 dark:bg-slate-800/95 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 backdrop-blur-sm min-w-[110px]">
          <div className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Status ISDM</div>
          {Object.entries(KATEGORI_SDM).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 mb-1.5 last:mb-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.warna }} />
                <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-100">{v.label}</span>
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
            <div className="h-1 bg-slate-300 dark:bg-slate-600 mb-1" style={{ width: '56px', borderLeft: '2px solid #64748b', borderRight: '2px solid #64748b', borderBottom: '2px solid #64748b' }} />
            <div className="text-[9px] text-slate-600 dark:text-slate-400">{{ 5: '1000', 6: '500', 7: '200', 8: '100', 9: '50', 10: '25' }[Math.floor(currentZoom)] || '1000'} km</div>
          </div>
          {/* Filter */}
          {hasilAnalisis && (
            <div className="relative mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setMenuFilter(v => !v)}
                className="w-full flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <Filter size={9} /> {kategoriTerpilih} <ChevronDown size={9} />
              </button>
              {menuFilter && (
                <div className="absolute bottom-full mb-1 right-0 w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 z-[500] py-1">
                  {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(k => (
                    <button key={k} onClick={() => { setKategoriTerpilih(k); setMenuFilter(false); }}
                      className={cn('w-full text-left px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors', kategoriTerpilih === k ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200')}>
                      {k}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] flex flex-wrap gap-2 justify-center">
        <ActionBtn onClick={onAnalisis} disabled={sedangMenganalisis || sedangCekData} variant="primary"
          style={{ boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
          {(sedangCekData || sedangMenganalisis) ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {getButtonText()}
        </ActionBtn>
        {dataBaruDariBPS && hasilAnalisis && (
          <ActionBtn variant="save" onClick={onSimpan}><Save size={12} /> Simpan</ActionBtn>
        )}
        {hasilAnalisis && (
          <ActionBtn variant="ghost" onClick={onReset}><RotateCcw size={12} /> Reset</ActionBtn>
        )}
      </div>
    </>
  );

  if (isFullscreen) return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col" style={{ height: '100dvh', width: '100vw' }}>
      <div className="relative flex-1 min-h-0">
        {renderMapContent('fs')}
        <div className="absolute bottom-4 left-4 z-[400]">
          <button onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-400 rounded-xl shadow-lg hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-900/50 dark:hover:border-red-400 transition-all active:scale-95 text-slate-800 dark:text-white font-semibold">
            <Minimize size={12} /><span className="text-[10px] font-bold">Minimize</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="relative" style={{ height: 480 }}>
        {sedangMuatAwal && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Memuat data...</p>
            </div>
          </div>
        )}
        {renderMapContent('normal')}
        <div className="absolute bottom-4 left-4 z-[400]">
          <button onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-400 rounded-xl shadow-lg hover:bg-indigo-50 hover:border-indigo-500 dark:hover:bg-indigo-900/60 dark:hover:border-indigo-400 transition-all active:scale-95 text-slate-800 dark:text-white font-semibold">
            <Maximize size={12} /><span className="text-[10px] font-bold">Maximize</span>
          </button>
        </div>
      </div>
    </div>
  );
} 