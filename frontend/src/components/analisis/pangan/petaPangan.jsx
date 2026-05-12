"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Download, Save, RotateCcw, Map, Loader2, Check,
  Filter, ChevronDown, Maximize, Minimize, Calendar,
  Wheat, Search, Brain, TrendingUp,
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const KATEGORI_IKP = {
  TINGGI: { warna: '#10b981', label: 'TINGGI' },
  SEDANG: { warna: '#f59e0b', label: 'SEDANG' },
  RENDAH: { warna: '#ef4444', label: 'RENDAH' },
};

export const TAHUN_BPS_AKTUAL_PANGAN  = [2020, 2021, 2022, 2023, 2024, 2025];
export const TAHUN_ARIMA_PANGAN       = Array.from({ length: 20 }, (_, i) => 2026 + i);
export const TAHUN_TERSEDIA_PANGAN    = [...new Set([...TAHUN_BPS_AKTUAL_PANGAN, ...TAHUN_ARIMA_PANGAN])].sort((a, b) => a - b);

export const DATASET_LABELS_PANGAN = {
  PADI:       'Produksi Padi (Ton)',
  KEMISKINAN: 'Kemiskinan (%)',
  KALORI:     'Konsumsi Kalori (kkal/kapita/hari)',
  PROTEIN:    'Konsumsi Protein (gram/kapita/hari)',
  PENDUDUK:   'Jumlah Penduduk (Ribu Jiwa)',
};

export const BASEMAPS_PANGAN = {
  OSM:            { label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                           attribution: '&copy; OpenStreetMap' },
  CARTO_LIGHT:    { label: 'Carto Light',   url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                               attribution: '&copy; CARTO' },
  CARTO_DARK:     { label: 'Carto Dark',    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                attribution: '&copy; CARTO' },
  ESRI_SATELLITE: { label: 'Satelit',       url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
  CARTO_VOYAGER:  { label: 'Voyager',       url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',                     attribution: '&copy; CARTO' },
};

export const PUSAT_DEFAULT_PANGAN = [-2.5, 118];
export const ZOOM_DEFAULT_PANGAN  = 5;
export const isPrediksiYearPangan = (tahun) => tahun > 2025;

const cn = (...cls) => cls.filter(Boolean).join(' ');

// ─── HELPER: warna & kategori dari feature ───────────────────────────────────
export const getWarna_IKP = (fitur) => {
  const a = fitur?.properties?.ikp_analysis || {};
  if (a.warna) return a.warna;
  const ikp = a.ikp;
  if (ikp == null) return '#cbd5e1';
  if (ikp > 0.70) return '#10b981';
  if (ikp >= 0.40) return '#f59e0b';
  return '#ef4444';
};

export const getKategori_IKP = (fitur) => {
  const a = fitur?.properties?.ikp_analysis || {};
  if (a.kategori) return a.kategori;
  const ikp = a.ikp;
  if (ikp == null) return '-';
  if (ikp > 0.70) return 'TINGGI';
  if (ikp >= 0.40) return 'SEDANG';
  return 'RENDAH';
};

// ─── SELECTOR ─────────────────────────────────────────────────────────────────
export function SelectorAnalisis_IKP({
  hasilAnalisis, kombinasiTersedia, tahunTerpilih,
  onPilih, sedangMuatAwal, allProvinces, onPilihProvinsi, provinsiTerpilih,
}) {
  const [openProvinsi, setOpenProvinsi] = useState(false);
  const [openTahun,    setOpenTahun]    = useState(false);
  const [searchProv,   setSearchProv]   = useState('');
  const wrapRef = useRef(null);

  const activeThn  = hasilAnalisis?.tahun || tahunTerpilih;
  const isPrediksi = isPrediksiYearPangan(activeThn);

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

  const filteredProvinces = allProvinces?.filter(
    p => p.toLowerCase().includes(searchProv.toLowerCase())
  ) || [];

  if (sedangMuatAwal) return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 h-10 px-4 rounded-lg shadow border border-slate-200 dark:border-slate-600">
      <Loader2 size={13} className="text-emerald-400 animate-spin" />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Memuat...</span>
    </div>
  );

  const dropdownBase = "absolute top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1010] border border-slate-200 dark:border-slate-600 overflow-hidden py-1";
  const btnBase      = "flex items-center gap-1.5 h-10 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors select-none";
  const itemBase     = "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
  const itemActive   = "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";

  return (
    <div ref={wrapRef} className="flex items-stretch shadow-lg rounded-xl overflow-visible">
      {/* Provinsi */}
      <div className="relative">
        <button
          onClick={() => { setOpenProvinsi(v => !v); setOpenTahun(false); }}
          className={cn(btnBase, "min-w-[120px] sm:min-w-[140px] rounded-l-xl border-r-0")}
        >
          <Search size={11} className="text-slate-400 flex-shrink-0" />
          <span className="flex-1 text-left truncate max-w-[80px] sm:max-w-[100px]">
            {provinsiTerpilih || 'All Provinsi'}
          </span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openProvinsi && 'rotate-180')} />
        </button>
        {openProvinsi && (
          <div className={cn(dropdownBase, "left-0 w-52")}>
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)}
                  placeholder="Cari provinsi..." autoFocus
                  className="w-full pl-6 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-400 outline-none"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={() => { onPilihProvinsi(null); setOpenProvinsi(false); setSearchProv(''); }}
                className={cn(itemBase, !provinsiTerpilih && itemActive)}
              >
                <span className="flex-1">All Provinsi</span>
                {!provinsiTerpilih && <Check size={11} className="text-emerald-500" />}
              </button>
              {filteredProvinces.map(prov => (
                <button key={prov}
                  onClick={() => { onPilihProvinsi(prov); setOpenProvinsi(false); setSearchProv(''); }}
                  className={cn(itemBase, provinsiTerpilih === prov && itemActive)}
                >
                  <span className="flex-1">{prov}</span>
                  {provinsiTerpilih === prov && <Check size={11} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-600 flex-shrink-0" />

      {/* Tahun */}
      <div className="relative">
        <button
          onClick={() => { setOpenTahun(v => !v); setOpenProvinsi(false); }}
          className={cn(btnBase, "min-w-[110px] rounded-r-xl")}
        >
          <Calendar size={11} className={cn("flex-shrink-0", isPrediksi ? "text-emerald-400" : "text-slate-400")} />
          <span className={cn("flex-1 text-left", isPrediksi && "text-emerald-600 dark:text-emerald-400 font-semibold")}>
            {activeThn}
            {isPrediksi && (
              <span className="ml-1 text-[9px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 px-1 py-0.5 rounded font-bold">AI</span>
            )}
          </span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openTahun && 'rotate-180')} />
        </button>
        {openTahun && (
          <div className={cn(dropdownBase, "right-0 min-w-[150px] max-h-64 overflow-y-auto")}>
            <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-700/60 sticky top-0">
              Data Aktual BPS
            </div>
            {TAHUN_BPS_AKTUAL_PANGAN.slice().reverse().map(th => (
              <button key={th}
                onClick={() => { setOpenTahun(false); onPilih(th); }}
                className={cn(itemBase, activeThn === th && itemActive, "justify-between")}
              >
                <span>{th}</span>
                {activeThn === th && <Check size={11} className="text-emerald-500" />}
              </button>
            ))}
            <div className="px-3 py-1.5 text-[9px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/30 sticky top-0">
              ⚙️ Prediksi ARIMA
            </div>
            {TAHUN_ARIMA_PANGAN.map(th => (
              <button key={th}
                onClick={() => { setOpenTahun(false); onPilih(th); }}
                className={cn(itemBase, activeThn === th && itemActive, "justify-between")}
              >
                <span className="text-emerald-600 dark:text-emerald-400">{th}</span>
                {activeThn === th && <Check size={11} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOOLTIP HTML ─────────────────────────────────────────────────────────────
function buildTooltipHTML_IKP(a, w, kat) {
  const isArima   = a.use_arima;
  const skenario  = a.skenario_arima || '';
  const metrics   = a.arima_metrics || {};
  const arimaKeys = a.arima_keys_used || [];

  let bestWmape = null;
  if (isArima) {
    arimaKeys.forEach(k => {
      const wm = metrics[k]?.cv_wmape;
      if (wm != null && (bestWmape === null || wm < bestWmape)) bestWmape = wm;
    });
  }
  const qualGrade = bestWmape != null ? (bestWmape < 2 ? '🥇' : bestWmape < 5 ? '✅' : bestWmape < 10 ? '⚠️' : '❌') : '';
  const arimaBadge = isArima
    ? `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700;background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid #6ee7b7;color:#065f46;">⚙️ ARIMA v1.0 · ${skenario}${bestWmape != null ? ` <span style="opacity:.8">${qualGrade} ${bestWmape.toFixed(1)}%</span>` : ''}</div>`
    : '';

  const padi     = a.padi_ton     != null ? `${(a.padi_ton / 1000).toFixed(0)}k ton`    : '-';
  const penduduk = a.penduduk_ribu != null ? `${a.penduduk_ribu.toFixed(0)} rb jiwa`    : '-';
  const miskin   = a.persen_miskin != null ? `${a.persen_miskin.toFixed(2)}%`           : '-';
  const kalori   = a.kalori        != null ? `${a.kalori.toFixed(0)} kkal`              : '-';
  const protein  = a.protein       != null ? `${a.protein.toFixed(1)} gr`               : '-';

  const mkAI = (k) => isArima && arimaKeys.includes(k) ? ' <span style="color:#059669;font-size:8px;">⚙️</span>' : '';

  return `<div style="font-family:system-ui,sans-serif;padding:10px 12px;min-width:170px;max-width:230px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${w};flex-shrink:0;"></div>
      <span style="font-weight:800;font-size:12px;color:#0f172a;">${a.nama_provinsi || ''}</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-radius:6px;background:${w}18;border:1px solid ${w}40;">
      <span style="font-size:10px;font-weight:700;color:${w};text-transform:uppercase;">${kat || '-'}</span>
      <span style="font-size:12px;font-weight:900;color:#0f172a;">IKP ${a.ikp ?? '-'}</span>
    </div>
    <div style="margin-top:8px;display:grid;gap:4px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#64748b;">IKv${mkAI('PADI')} / IA${mkAI('KEMISKINAN')}</span>
        <span style="font-size:11px;font-weight:700;color:#0f172a;">${a.ikv_norm ?? '-'} / ${a.ia_norm ?? '-'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#64748b;">IPm${mkAI('KALORI')} / IS${mkAI('PADI')}</span>
        <span style="font-size:11px;font-weight:700;color:#0f172a;">${a.ipm_norm ?? '-'} / ${a.is_norm ?? '-'}</span>
      </div>
      <div style="border-top:1px solid #f1f5f9;padding-top:4px;margin-top:2px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;">
          <span>Padi${mkAI('PADI')}</span><span style="color:#0f172a;font-weight:600;">${padi}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;">
          <span>Miskin${mkAI('KEMISKINAN')}</span><span style="color:#0f172a;font-weight:600;">${miskin}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;">
          <span>Kalori${mkAI('KALORI')} / Protein${mkAI('PROTEIN')}</span><span style="color:#0f172a;font-weight:600;">${kalori} / ${protein}</span>
        </div>
      </div>
    </div>
    ${arimaBadge}
  </div>`;
}

function buildGeoProps_IKP(hasilAnalisis, kategoriTerpilih, provinsiDipilih) {
  return {
    data: { type: 'FeatureCollection', features: hasilAnalisis.matched_features.features },
    style: (fitur) => {
      const a   = fitur?.properties?.ikp_analysis || {};
      const kat = getKategori_IKP(fitur);
      const w   = getWarna_IKP(fitur);
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
      const a   = fitur.properties?.ikp_analysis || {};
      const w   = getWarna_IKP(fitur);
      const kat = getKategori_IKP(fitur);
      lapisan.bindTooltip(buildTooltipHTML_IKP(a, w, kat), {
        sticky: true, opacity: 1, className: 'leaflet-tooltip-ikp',
      });
      lapisan.on('mouseover', function () {
        this.setStyle({ weight: 2.5, fillOpacity: 0.95, color: '#ffffff' });
      });
      lapisan.on('mouseout', function () {
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

const MapBtn = ({ children, onClick, className = '', title = '' }) => (
  <button onClick={onClick} title={title}
    className={cn('w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg flex items-center justify-center shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-100', className)}>
    {children}
  </button>
);

const ActionBtn = ({ children, variant = 'primary', className = '', disabled, onClick }) => {
  const v = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30',
    save:    'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/30',
    ghost:   'bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 shadow-lg uppercase tracking-wider', v[variant], className)}>
      {children}
    </button>
  );
};

// ─── PETA IKP (MAIN COMPONENT) ────────────────────────────────────────────────
export default function PetaPangan({
  hasilAnalisis, tahunTerpilih, kategoriTerpilih, setKategoriTerpilih,
  sedangMenganalisis, sedangCekData, dataBaruDariBPS, pernahAnalisis,
  onAnalisis, onSimpan, onReset,
  leafletReady, MapCont, TileLay, GeoComp,
  petaRef, basemap, setBasemap,
  koordinatCursor, setKoordinatCursor, currentZoom, setCurrentZoom,
  provinsiDipilih, setProvinsiDipilih,
  kombinasiTersedia, onPilihKombo, sedangMuatAwal,
  jumlahKategori,
}) {
  const [showBasemap,  setShowBasemap]  = useState(false);
  const [menuFilter,   setMenuFilter]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const useArima      = hasilAnalisis?.use_arima;
  const skenarioArima = hasilAnalisis?.skenario;
  const arimaKeysList = hasilAnalisis?.arima_keys || [];
  const arimaMetrics  = hasilAnalisis?.arima_metrics || {};
  const isPrediksi    = hasilAnalisis?.is_prediction_year;

  const bestMetric = Object.values(arimaMetrics).reduce(
    (best, m) => (!m?.cv_wmape ? best : (!best || m.cv_wmape < best.cv_wmape ? m : best)), null
  );

  const allProvinces = hasilAnalisis?.matched_features?.features
    ?.map(f => f.properties?.ikp_analysis?.nama_provinsi)
    .filter(Boolean).sort() || [];

  const handlePilihProvinsi = useCallback((prov) => {
    setProvinsiDipilih(prov);
    if (prov && petaRef.current) {
      const f = hasilAnalisis?.matched_features?.features?.find(
        feat => feat.properties?.ikp_analysis?.nama_provinsi === prov
      );
      if (f) {
        const coords = f.geometry.coordinates;
        let lat, lng;
        if (f.geometry.type === 'MultiPolygon') {
          const p = coords[0][0];
          lat = p.reduce((s, c) => s + c[1], 0) / p.length;
          lng = p.reduce((s, c) => s + c[0], 0) / p.length;
        } else {
          const p = coords[0];
          lat = p.reduce((s, c) => s + c[1], 0) / p.length;
          lng = p.reduce((s, c) => s + c[0], 0) / p.length;
        }
        petaRef.current.setView([lat, lng], 7);
      }
    }
  }, [setProvinsiDipilih, petaRef, hasilAnalisis]);

  const geoKey   = `${hasilAnalisis?.tahun}-${kategoriTerpilih}-${provinsiDipilih}`;
  const geoProps = hasilAnalisis?.matched_features?.features
    ? buildGeoProps_IKP(hasilAnalisis, kategoriTerpilih, provinsiDipilih)
    : null;

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Memproses...';
    if (sedangCekData)      return 'Memeriksa...';
    if (!pernahAnalisis)    return 'Analisis Pangan';
    return 'Analisis IKP';
  };

  const renderMapContent = (keyPrefix) => (
    <>
      {leafletReady && MapCont && (
        <MapCont
          center={PUSAT_DEFAULT_PANGAN} zoom={ZOOM_DEFAULT_PANGAN}
          style={{ height: '100%', width: '100%' }} zoomControl={false} ref={petaRef} className="z-0"
        >
          <TileLay key={basemap} url={BASEMAPS_PANGAN[basemap].url} attribution={BASEMAPS_PANGAN[basemap].attribution} />
          <MapEventHandler setKoordinatCursor={setKoordinatCursor} setCurrentZoom={setCurrentZoom} />
          {geoProps && <GeoComp key={`${keyPrefix}-${geoKey}`} {...geoProps} />}
        </MapCont>
      )}

      <style>{`
        .leaflet-tooltip-ikp { background: white !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; padding: 0 !important; }
        .leaflet-tooltip-ikp::before { display: none !important; }
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
              {Object.entries(BASEMAPS_PANGAN).map(([k, bm]) => (
                <button key={k} onClick={() => { setBasemap(k); setShowBasemap(false); }}
                  className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
                    basemap === k ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-slate-200')}>
                  {bm.label} {basemap === k && <Check size={11} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <MapBtn onClick={() => petaRef.current?.setView(PUSAT_DEFAULT_PANGAN, ZOOM_DEFAULT_PANGAN)} title="Reset View">
          <RotateCcw size={12} />
        </MapBtn>
      </div>

      {/* Selector tengah */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] w-max max-w-[calc(100%-120px)]">
        <SelectorAnalisis_IKP
          hasilAnalisis={hasilAnalisis}
          kombinasiTersedia={kombinasiTersedia}
          tahunTerpilih={tahunTerpilih}
          onPilih={onPilihKombo}
          sedangMuatAwal={sedangMuatAwal}
          allProvinces={allProvinces}
          onPilihProvinsi={handlePilihProvinsi}
          provinsiTerpilih={provinsiDipilih}
        />
      </div>

      {/* Panel kanan */}
      <div className={cn('absolute top-3 z-[400] flex flex-col gap-2 items-end', isFullscreen ? 'right-8' : 'right-3')}>
        {/* Koordinat */}
        <div className="bg-white/95 dark:bg-slate-800/95 px-2 py-1 rounded-lg shadow border border-slate-200 dark:border-slate-600 backdrop-blur-sm">
          <div className="text-[9px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className="text-emerald-500 font-bold">Lat:</span> {koordinatCursor.lat} &nbsp;
            <span className="text-emerald-500 font-bold">Lng:</span> {koordinatCursor.lng}
          </div>
        </div>

        {/* ARIMA info badge */}
        {useArima && skenarioArima && (
          <div className="bg-white/97 dark:bg-slate-800/97 p-2.5 rounded-xl shadow-lg border backdrop-blur-sm max-w-[180px]"
            style={{ borderColor: '#6ee7b7' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Brain size={11} className="text-emerald-500 flex-shrink-0" />
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300">ARIMA v1.0</span>
              <span className="text-[8px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">{skenarioArima}</span>
              {isPrediksi && <span className="text-[8px] bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold">Prediksi</span>}
            </div>
            {arimaKeysList.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {arimaKeysList.map(k => (
                  <span key={k} className="text-[8px] font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                    {k}
                  </span>
                ))}
              </div>
            )}
            {bestMetric?.cv_wmape != null && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400">WMAPE:</span>
                <span className="text-[9px] font-black" style={{ color: bestMetric.quality?.color || '#10b981' }}>
                  {bestMetric.cv_wmape.toFixed(2)}% {bestMetric.quality?.grade}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Legenda */}
        <div className="bg-white/95 dark:bg-slate-800/95 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 backdrop-blur-sm min-w-[110px]">
          <div className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Status IKP</div>
          {Object.entries(KATEGORI_IKP).map(([k, v]) => (
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
          {/* Threshold info */}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-0.5">
            <div className="text-[8px] text-emerald-600 dark:text-emerald-400 font-semibold">{'>'} 0.70 = TINGGI</div>
            <div className="text-[8px] text-amber-600 dark:text-amber-400 font-semibold">0.40–0.70 = SEDANG</div>
            <div className="text-[8px] text-red-500 dark:text-red-400 font-semibold">{'<'} 0.40 = RENDAH</div>
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
                    <button key={k}
                      onClick={() => { setKategoriTerpilih(k); setMenuFilter(false); }}
                      className={cn('w-full text-left px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
                        kategoriTerpilih === k ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200')}>
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
          style={{ boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>
          {(sedangCekData || sedangMenganalisis) ? <Loader2 size={12} className="animate-spin" /> : <Wheat size={12} />}
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
              <Loader2 size={28} className="text-emerald-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Memuat data pangan...</p>
            </div>
          </div>
        )}
        {renderMapContent('normal')}
        <div className="absolute bottom-4 left-4 z-[400]">
          <button onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-400 rounded-xl shadow-lg hover:bg-emerald-50 hover:border-emerald-500 dark:hover:bg-emerald-900/60 dark:hover:border-emerald-400 transition-all active:scale-95 text-slate-800 dark:text-white font-semibold">
            <Maximize size={12} /><span className="text-[10px] font-bold">Maximize</span>
          </button>
        </div>
      </div>
    </div>
  );
}