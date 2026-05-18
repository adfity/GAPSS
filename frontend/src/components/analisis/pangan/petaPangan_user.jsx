"use client";
// ─── PETA IKP — USER (Read + Navigate) ───────────────────────────────────────
// Seperti petaPangan tapi TANPA tombol Analisis/Simpan/Reset.
// Selector hanya memilih dari data tersimpan.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Map, RotateCcw, Check, Filter, ChevronDown,
  Maximize, Minimize, Loader2, Search, Calendar, TrendingUp,
} from 'lucide-react';
import {
  BASEMAPS_IKP, PUSAT_DEFAULT_IKP, ZOOM_DEFAULT_IKP, KATEGORI_IKP,
  INDIKATOR_LABELS_IKP, INDIKATOR_COLORS_IKP, INDIKATOR_ICON_IKP,
  TAHUN_AKTUAL_IKP, TAHUN_OLS_IKP,
  getWarnaIKP, getKategoriIKP,
} from './petaPangan';

const cn = (...cls) => cls.filter(Boolean).join(' ');

function buildTooltipHTML(a, w, kat, indikatorTerpilih) {
  const sumber    = a.sumber || 'aktual';
  const kolomPred = a.kolom_prediksi || [];
  const katLabel  = KATEGORI_IKP[kat]?.label || kat;
  const darkBg    = ['#6e1f1f', '#e85961', '#3b703b'];
  const textColor = darkBg.includes(w) ? '#ffffff'
    : ['#f4a1a7','#c9e077','#94c945'].includes(w) ? '#1a2e00'
    : w === '#a6a6a6' ? '#475569' : '#ffffff';

  const srcBadge = (sumber === 'campuran' || sumber === 'prediksi')
    ? `<div style="margin-top:5px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:700;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;">📈 ${sumber === 'prediksi' ? 'Prediksi OLS' : 'Aktual+Prediksi'}</div>`
    : '';

  const kompHTML = (indikatorTerpilih === 'SEMUA') ? `
    <div style="margin-top:7px;display:grid;gap:3px;">
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Ketersediaan${kolomPred.includes('KETERSEDIAAN') ? ' 📈' : ''}</span>
        <span style="font-size:11px;font-weight:700;color:#ca8a04;">${a.ketersediaan != null ? a.ketersediaan.toFixed(2) : '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Keterjangkauan${kolomPred.includes('KETERJANGKAUAN') ? ' 📈' : ''}</span>
        <span style="font-size:11px;font-weight:700;color:#2563eb;">${a.keterjangkauan != null ? a.keterjangkauan.toFixed(2) : '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:10px;color:#64748b;">Pemanfaatan${kolomPred.includes('PEMANFAATAN') ? ' 📈' : ''}</span>
        <span style="font-size:11px;font-weight:700;color:#dc2626;">${a.pemanfaatan != null ? a.pemanfaatan.toFixed(2) : '—'}</span>
      </div>
    </div>` : '';

  return `
    <div style="font-family:system-ui,sans-serif;padding:10px 12px;min-width:160px;max-width:220px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${w};flex-shrink:0;border:1px solid rgba(0,0,0,0.15);"></div>
        <span style="font-weight:800;font-size:12px;color:#0f172a;">${a.nama_provinsi || ''}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-radius:6px;background:${w};border:1px solid rgba(0,0,0,0.1);">
        <span style="font-size:9px;font-weight:700;color:${textColor};text-transform:uppercase;">${katLabel}</span>
        <span style="font-size:12px;font-weight:900;color:${textColor};">${a.ikp ?? '—'}</span>
      </div>
      <div style="margin-top:5px;text-align:center;font-size:10px;color:#94a3b8;">Prioritas ${a.prioritas ?? '—'}</div>
      ${kompHTML}${srcBadge}
    </div>`;
}

// ─── SELECTOR (tahun + indikator dari data tersimpan) ─────────────────────────
function SelectorUser({ hasilAnalisis, kombinasiTersedia, tahunTerpilih, onPilih,
  allProvinces, onPilihProvinsi, provinsiTerpilih }) {
  const [openProvinsi,  setOpenProvinsi]  = useState(false);
  const [openIndikator, setOpenIndikator] = useState(false);
  const [openTahun,     setOpenTahun]     = useState(false);
  const [searchProv,    setSearchProv]    = useState('');
  const wrapRef = useRef(null);

  const activeInd = hasilAnalisis?.indikator || 'SEMUA';
  const activeThn = hasilAnalisis?.tahun     || tahunTerpilih;
  const mungkinPrediksi = activeThn > 2024;

  useEffect(() => {
    const h = e => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpenProvinsi(false); setOpenIndikator(false); setOpenTahun(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredProvinces = allProvinces?.filter(
    p => p.toLowerCase().includes(searchProv.toLowerCase())
  ) || [];

  const dropdownBase = "absolute top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1010] border border-slate-200 dark:border-slate-600 overflow-hidden py-1";
  const btnBase      = "flex items-center gap-1.5 h-10 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors select-none";
  const itemBase     = "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
  const itemActive   = "bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300";

  // Tahun tersedia dari data tersimpan
  const tahunTersedia = [...new Set(
    Object.keys(kombinasiTersedia).map(k => parseInt(k.split('|')[0]))
  )].sort((a, b) => b - a);

  return (
    <div ref={wrapRef} className="flex items-stretch shadow-lg rounded-xl overflow-visible">
      {/* Provinsi */}
      <div className="relative">
        <button onClick={() => { setOpenProvinsi(v => !v); setOpenIndikator(false); setOpenTahun(false); }}
          className={cn(btnBase, "min-w-[120px] sm:min-w-[140px] rounded-l-xl border-r-0")}>
          <Search size={11} className="text-slate-400 flex-shrink-0"/>
          <span className="flex-1 text-left truncate max-w-[80px] sm:max-w-[100px]">
            {provinsiTerpilih || 'All Provinsi'}
          </span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openProvinsi && 'rotate-180')}/>
        </button>
        {openProvinsi && (
          <div className={cn(dropdownBase, "left-0 w-52")}>
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)}
                  placeholder="Cari provinsi..." autoFocus
                  className="w-full pl-6 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-green-400 outline-none"/>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button onClick={() => { onPilihProvinsi(null); setOpenProvinsi(false); setSearchProv(''); }}
                className={cn(itemBase, !provinsiTerpilih && itemActive)}>
                <span className="flex-1">All Provinsi</span>
                {!provinsiTerpilih && <Check size={11} className="text-green-500"/>}
              </button>
              {filteredProvinces.map(prov => (
                <button key={prov} onClick={() => { onPilihProvinsi(prov); setOpenProvinsi(false); setSearchProv(''); }}
                  className={cn(itemBase, provinsiTerpilih === prov && itemActive)}>
                  <span className="flex-1">{prov}</span>
                  {provinsiTerpilih === prov && <Check size={11} className="text-green-500"/>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-600 flex-shrink-0"/>

      {/* Indikator */}
      <div className="relative hidden sm:block">
        <button onClick={() => { setOpenIndikator(v => !v); setOpenProvinsi(false); setOpenTahun(false); }}
          className={cn(btnBase, "min-w-[160px] border-r-0")}>
          <span style={{ color: INDIKATOR_COLORS_IKP[activeInd] }}>{INDIKATOR_ICON_IKP[activeInd]}</span>
          <span className="flex-1 text-left truncate">{INDIKATOR_LABELS_IKP[activeInd]}</span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openIndikator && 'rotate-180')}/>
        </button>
        {openIndikator && (
          <div className={cn(dropdownBase, "left-0 min-w-[200px]")}>
            {['SEMUA', 'KETERSEDIAAN', 'KETERJANGKAUAN', 'PEMANFAATAN'].map(ind => {
              const tersedia = Object.keys(kombinasiTersedia).some(
                k => k.endsWith(`|${ind}`) && k.startsWith(`${activeThn}|`)
              );
              return (
                <button key={ind}
                  onClick={() => { setOpenIndikator(false); if (tersedia) onPilih(activeThn, ind); }}
                  className={cn(itemBase, activeInd === ind && itemActive, !tersedia && 'opacity-40 cursor-not-allowed')}>
                  <span style={{ color: INDIKATOR_COLORS_IKP[ind] }}>{INDIKATOR_ICON_IKP[ind]}</span>
                  <span className="flex-1">{INDIKATOR_LABELS_IKP[ind]}</span>
                  {activeInd === ind && <Check size={11} className="text-green-500"/>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-600 flex-shrink-0 hidden sm:block"/>

      {/* Tahun */}
      <div className="relative">
        <button onClick={() => { setOpenTahun(v => !v); setOpenProvinsi(false); setOpenIndikator(false); }}
          className={cn(btnBase, "min-w-[100px] rounded-r-xl")}>
          <Calendar size={11} className={cn('flex-shrink-0', mungkinPrediksi ? 'text-amber-400' : 'text-slate-400')}/>
          <span className={cn('flex-1 text-left', mungkinPrediksi && 'text-amber-600 dark:text-amber-400 font-semibold')}>
            {activeThn}
            {mungkinPrediksi && <span className="ml-1 text-[8px] bg-amber-100 dark:bg-amber-900/60 text-amber-600 px-1 py-0.5 rounded">?</span>}
          </span>
          <ChevronDown size={11} className={cn('text-slate-400 flex-shrink-0 transition-transform', openTahun && 'rotate-180')}/>
        </button>
        {openTahun && (
          <div className={cn(dropdownBase, "right-0 min-w-[160px] max-h-64 overflow-y-auto")}>
            <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-700/60 sticky top-0">
              Data Tersimpan
            </div>
            {tahunTersedia.length === 0 && (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">Belum ada data</div>
            )}
            {tahunTersedia.map(th => {
              const isPred = th > 2024;
              return (
                <button key={th}
                  onClick={() => { setOpenTahun(false); onPilih(th, activeInd); }}
                  className={cn(itemBase, activeThn === th && itemActive, "justify-between")}>
                  <span className={isPred ? 'text-amber-600 dark:text-amber-400' : ''}>{th}</span>
                  {activeThn === th && <Check size={11} className="text-green-500"/>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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
  return <Inner/>;
}

const MapBtn = ({ children, onClick, title = '' }) => (
  <button onClick={onClick} title={title}
    className="w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg flex items-center justify-center shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-700 dark:text-slate-100">
    {children}
  </button>
);

// ─── KOMPONEN UTAMA ────────────────────────────────────────────────────────────
export default function PetaPangan_User({
  hasilAnalisis, indikatorTerpilih = 'SEMUA', kategoriTerpilih, setKategoriTerpilih,
  leafletReady, MapCont, TileLay, GeoComp,
  petaRef, basemap, setBasemap, koordinatCursor, setKoordinatCursor,
  currentZoom, setCurrentZoom, provinsiDipilih, setProvinsiDipilih,
  kombinasiTersedia, onPilihKombo, tahunTerpilih,
  jumlahKategori, sedangMuatAwal, getWarna, getKategori,
}) {
  const [showBasemap,  setShowBasemap]  = useState(false);
  const [menuFilter,   setMenuFilter]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const adaPrediksi = hasilAnalisis?.ada_prediksi;

  const allProvinces = hasilAnalisis?.matched_features?.features
    ?.map(f => f.properties?.ikp_analysis?.nama_provinsi)
    .filter(Boolean).sort() || [];

  const handlePilihProvinsi = useCallback((prov) => {
    setProvinsiDipilih(prov);
    if (prov && petaRef?.current) {
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

  const geoKey = `${hasilAnalisis?.tahun}-${indikatorTerpilih}-${kategoriTerpilih}-${provinsiDipilih}`;

  const geoProps = hasilAnalisis?.matched_features?.features ? {
    data: { type: 'FeatureCollection', features: hasilAnalisis.matched_features.features },
    style: (fitur) => {
      const a   = fitur?.properties?.ikp_analysis || {};
      const kat = getKategori(fitur, indikatorTerpilih);
      const w   = getWarna(fitur, indikatorTerpilih);
      const vis = kategoriTerpilih === 'SEMUA' || kat === kategoriTerpilih;
      const hl  = provinsiDipilih === a.nama_provinsi;
      const isTA = kat === 'TIDAK_TERANALISIS';
      return {
        fillColor:   w || '#a6a6a6',
        weight:      hl ? 3 : 1,
        opacity:     vis ? 1 : 0.2,
        color:       hl ? '#ffffff' : 'rgba(255,255,255,0.6)',
        fillOpacity: vis ? (hl ? 0.95 : isTA ? 0.35 : 0.80) : 0.08,
      };
    },
    onEachFeature: (fitur, lapisan) => {
      const a   = fitur.properties?.ikp_analysis || {};
      const w   = getWarna(fitur, indikatorTerpilih);
      const kat = getKategori(fitur, indikatorTerpilih);
      lapisan.bindTooltip(buildTooltipHTML(a, w, kat, indikatorTerpilih), {
        sticky: true, opacity: 1, className: 'leaflet-tooltip-ikp',
      });
      lapisan.on('mouseover', function () { this.setStyle({ weight: 2.5, fillOpacity: 0.95, color: '#ffffff' }); });
      lapisan.on('mouseout',  function () {
        const sel = provinsiDipilih === a.nama_provinsi;
        this.setStyle({ weight: sel ? 3 : 1, fillOpacity: sel ? 0.95 : 0.80, color: sel ? '#ffffff' : 'rgba(255,255,255,0.6)' });
      });
    },
  } : null;

  const legendaKategori = ['SANGAT_RENTAN', 'RENTAN', 'AGAK_RENTAN', 'AGAK_TAHAN', 'TAHAN', 'SANGAT_TAHAN'];
  const filterOptions   = ['SEMUA', 'SANGAT_RENTAN', 'RENTAN', 'AGAK_RENTAN', 'AGAK_TAHAN', 'TAHAN', 'SANGAT_TAHAN', 'TIDAK_TERANALISIS'];

  const renderMap = (keyPrefix) => (
    <>
      {leafletReady && MapCont && (
        <MapCont center={PUSAT_DEFAULT_IKP} zoom={ZOOM_DEFAULT_IKP}
          style={{ height: '100%', width: '100%' }} zoomControl={false} ref={petaRef} className="z-0">
          <TileLay key={basemap} url={BASEMAPS_IKP[basemap].url} attribution={BASEMAPS_IKP[basemap].attribution}/>
          <MapEventHandler setKoordinatCursor={setKoordinatCursor} setCurrentZoom={setCurrentZoom}/>
          {geoProps && <GeoComp key={`${keyPrefix}-${geoKey}`} {...geoProps}/>}
        </MapCont>
      )}

      <style>{`
        .leaflet-tooltip-ikp { background:white !important; border:1px solid #e2e8f0 !important;
          border-radius:12px !important; box-shadow:0 8px 24px rgba(0,0,0,0.12) !important; padding:0 !important; }
        .leaflet-tooltip-ikp::before { display:none !important; }
      `}</style>

      {/* Kiri: zoom + basemap */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        <MapBtn onClick={() => petaRef?.current?.zoomIn()}><span className="font-bold text-lg leading-none">+</span></MapBtn>
        <MapBtn onClick={() => petaRef?.current?.zoomOut()}><span className="font-bold text-lg leading-none">−</span></MapBtn>
        <div className="relative">
          <MapBtn onClick={() => setShowBasemap(v => !v)} title="Basemap"><Map size={13}/></MapBtn>
          {showBasemap && (
            <div className="absolute left-full ml-2 top-0 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[500] border border-slate-200 dark:border-slate-600 py-1">
              <div className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Basemap</div>
              {Object.entries(BASEMAPS_IKP).map(([k, bm]) => (
                <button key={k} onClick={() => { setBasemap(k); setShowBasemap(false); }}
                  className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700',
                    basemap === k ? 'text-green-600 font-semibold' : 'text-slate-700 dark:text-slate-200')}>
                  {bm.label} {basemap === k && <Check size={11}/>}
                </button>
              ))}
            </div>
          )}
        </div>
        <MapBtn onClick={() => petaRef?.current?.setView(PUSAT_DEFAULT_IKP, ZOOM_DEFAULT_IKP)} title="Reset View">
          <RotateCcw size={12}/>
        </MapBtn>
      </div>

      {/* Selector tengah */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] w-max max-w-[calc(100%-120px)]">
        <SelectorUser
          hasilAnalisis={hasilAnalisis}
          kombinasiTersedia={kombinasiTersedia}
          tahunTerpilih={tahunTerpilih}
          onPilih={onPilihKombo}
          allProvinces={allProvinces}
          onPilihProvinsi={handlePilihProvinsi}
          provinsiTerpilih={provinsiDipilih}
        />
      </div>

      {/* Kanan: koordinat + badge prediksi + legenda */}
      <div className={cn('absolute top-3 z-[400] flex flex-col gap-2 items-end', isFullscreen ? 'right-8' : 'right-3')}>
        <div className="bg-white/95 dark:bg-slate-800/95 px-2 py-1 rounded-lg shadow border border-slate-200 dark:border-slate-600 backdrop-blur-sm">
          <div className="text-[9px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className="text-green-500 font-bold">Lat:</span> {koordinatCursor?.lat} &nbsp;
            <span className="text-green-500 font-bold">Lng:</span> {koordinatCursor?.lng}
          </div>
        </div>

        {adaPrediksi && (
          <div className="bg-white/97 dark:bg-slate-800/97 p-2.5 rounded-xl shadow-lg border backdrop-blur-sm max-w-[175px]" style={{ borderColor: '#fcd34d' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={11} className="text-amber-500 flex-shrink-0"/>
              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300">Ada Prediksi OLS</span>
            </div>
            <p className="text-[9px] text-amber-600 dark:text-amber-400 leading-relaxed">
              Sebagian data menggunakan prediksi Regresi Linear (OLS)
            </p>
          </div>
        )}

        {/* Legenda */}
        <div className="bg-white/95 dark:bg-slate-800/95 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 backdrop-blur-sm min-w-[145px]">
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Klasifikasi IKP</div>
          <div className="flex h-2 rounded-full overflow-hidden mb-1">
            {legendaKategori.map(k => (
              <div key={k} className="flex-1" style={{ backgroundColor: KATEGORI_IKP[k].warna }} title={KATEGORI_IKP[k].label}/>
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-slate-400 mb-2 px-0.5">
            <span>P1</span><span>P2</span><span>P3</span><span>P4</span><span>P5</span><span>P6</span>
          </div>
          {legendaKategori.map(k => (
            <div key={k} className="flex items-center justify-between gap-2 mb-1 last:mb-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KATEGORI_IKP[k].warna }}/>
                <span className="text-[9px] font-semibold text-slate-800 dark:text-slate-100">{KATEGORI_IKP[k].label}</span>
              </div>
              {hasilAnalisis && (
                <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">
                  {jumlahKategori[k] ?? 0}
                </span>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#a6a6a6' }}/>
              <span className="text-[9px] text-slate-400">Tdk teranalisis</span>
            </div>
            {hasilAnalisis && (
              <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                {jumlahKategori['TIDAK_TERANALISIS'] ?? 0}
              </span>
            )}
          </div>

          {/* Filter kategori */}
          {hasilAnalisis && (
            <div className="relative mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setMenuFilter(v => !v)}
                className="w-full flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200">
                <Filter size={9}/>
                <span className="truncate flex-1 text-left">
                  {kategoriTerpilih === 'SEMUA' ? 'SEMUA' : (KATEGORI_IKP[kategoriTerpilih]?.label || kategoriTerpilih)}
                </span>
                <ChevronDown size={9}/>
              </button>
              {menuFilter && (
                <div className="absolute bottom-full mb-1 right-0 w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 z-[500] py-1">
                  {filterOptions.map(k => (
                    <button key={k} onClick={() => { setKategoriTerpilih(k); setMenuFilter(false); }}
                      className={cn('w-full text-left px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5',
                        kategoriTerpilih === k ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200')}>
                      {k !== 'SEMUA' && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: KATEGORI_IKP[k]?.warna || '#a6a6a6' }}/>}
                      {k === 'SEMUA' ? 'SEMUA' : (KATEGORI_IKP[k]?.label || k)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isFullscreen) return (
    <div className="fixed inset-0 z-[9999] bg-slate-950" style={{ height: '100dvh', width: '100vw' }}>
      <div className="relative h-full">
        {renderMap('fs')}
        <button onClick={() => setIsFullscreen(false)}
          className="absolute bottom-4 left-4 z-[400] flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 rounded-xl shadow-lg hover:bg-red-50 hover:border-red-400 transition-all font-semibold text-slate-800 dark:text-white">
          <Minimize size={12}/><span className="text-[10px] font-bold">Minimize</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="relative" style={{ height: 480 }}>
        {sedangMuatAwal && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-green-500 animate-spin"/>
              <p className="text-sm font-medium text-slate-600">Memuat data...</p>
            </div>
          </div>
        )}
        {renderMap('normal')}
        <button onClick={() => setIsFullscreen(true)}
          className="absolute bottom-4 left-4 z-[400] flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 rounded-xl shadow-lg hover:bg-green-50 hover:border-green-500 transition-all font-semibold text-slate-800 dark:text-white">
          <Maximize size={12}/><span className="text-[10px] font-bold">Maximize</span>
        </button>
      </div>
    </div>
  );
}