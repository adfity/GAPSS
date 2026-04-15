"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Play, Download, ChevronDown, Filter, Save, X,
  Heart, RotateCcw, Info, FileText,
  ClipboardList, Search, Map, Calendar, Loader2,
  BarChart2, Check, TrendingUp, Shield, Droplets, Stethoscope,
  Home, AlertTriangle, ShieldCheck,
  BookOpen, Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";
import Footerauth from '@/components/layout/footerauth';
import {
  TAHUN_TERSEDIA, KATEGORI_KESEHATAN, BASEMAPS,
  PUSAT_DEFAULT, ZOOM_DEFAULT,
  DATASET_LABELS_KESEHATAN, INDIKATOR_LABELS_KESEHATAN,
  dbToUI, getWarnaByIndikatorKesehatan, getKategoriByIndikatorKesehatan,
  ModalCekDataKesehatan, ModalAlertKomboTidakAdaKesehatan,
  SelectorAnalisisKesehatan, TrendPanelKesehatan, MetadataPanelKesehatan,
} from '@/components/analisis/sdm/health';

// ─── Helpers
const cn = (...cls) => cls.filter(Boolean).join(' ');

const Card = ({ children, className = '' }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm', className)}>
    {children}
  </div>
);

const Btn = ({ children, variant = 'primary', className = '', ...props }) => {
  const v = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ghost:   'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
    danger:  'bg-slate-600 hover:bg-slate-700 text-white',
    save:    'bg-teal-600 hover:bg-teal-700 text-white',
  };
  return (
    <button className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50', v[variant], className)} {...props}>
      {children}
    </button>
  );
};

const MapBtn = ({ children, onClick, className = '' }) => (
  <button onClick={onClick} className={cn('w-9 h-9 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl flex items-center justify-center shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors', className)}>
    {children}
  </button>
);

const TABS = [
  { id: 'info',      label: 'Info',      Icon: Info          },
  { id: 'kebijakan', label: 'Kebijakan', Icon: ClipboardList },
  { id: 'metadata',  label: 'Metadata',  Icon: BookOpen      },
  { id: 'tren',      label: 'Tren',      Icon: TrendingUp    },
];

const PRIORITY_STYLE = {
  Tinggi: { bar: 'bg-red-500',   badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
  Sedang: { bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  Rendah: { bar: 'bg-green-500', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' },
};

// ── MapEventHandler
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

// ── GeoJSON props builder (key dipass langsung di JSX)
function buildGeoProps(hasilAnalisis, indikatorTerpilih, kategoriTerpilih, provinsiDipilih) {
  return {
    data: { type: 'FeatureCollection', features: hasilAnalisis.matched_features.features },
    style: (fitur) => {
      const a   = fitur.properties?.health_analysis || {};
      const kat = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
      const w   = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
      const vis = kategoriTerpilih === 'SEMUA' || kat === kategoriTerpilih;
      const hl  = provinsiDipilih === a.nama_provinsi;
      return { fillColor: w, weight: hl ? 3 : 1.5, opacity: (vis && w !== '#cbd5e1') ? 1 : 0, color: hl ? '#fff' : 'rgba(255,255,255,0.6)', fillOpacity: (vis && w !== '#cbd5e1') ? 0.82 : 0 };
    },
    onEachFeature: (fitur, lapisan) => {
      const a   = fitur.properties?.health_analysis || {};
      const dk  = a.data_kesehatan || {};
      const w   = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
      const kat = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
      const wawasan = a.insights?.map(i => `<div style="margin-bottom:3px;padding-left:6px;border-left:2px solid ${w};font-size:9px;">${i}</div>`).join('') || '';

      lapisan.bindTooltip(
        `<div style="font-family:inherit;padding:3px;min-width:140px;">
           <div style="font-weight:900;font-size:11px;text-transform:uppercase;color:#0f172a;">${a.nama_provinsi || ''}</div>
           <div style="font-size:9px;font-weight:700;color:${w};margin-top:2px;">${kat || '-'}</div>
           <div style="font-size:8px;color:#64748b;margin-top:1px;">Skor: <strong>${a.skor_total ?? '-'}</strong></div>
         </div>`, { sticky: true, opacity: 0.96 }
      );

      let indHTML = '';
      if (indikatorTerpilih === 'SEMUA') {
        indHTML = `<div style="display:grid;gap:3px;">
          <div style="background:#fef2f2;padding:5px;border-radius:5px;border-left:2px solid #ef4444;"><div style="font-size:7px;font-weight:700;color:#7f1d1d;">AHH</div><div style="font-size:11px;font-weight:900;color:#dc2626;">${dk.AHH != null ? dk.AHH + ' th' : '-'}</div></div>
          <div style="background:#eff6ff;padding:5px;border-radius:5px;border-left:2px solid #3b82f6;"><div style="font-size:7px;font-weight:700;color:#1e3a8a;">IMUNISASI</div><div style="font-size:11px;font-weight:900;color:#2563eb;">${dk.IMUNISASI != null ? dk.IMUNISASI + '%' : '-'}</div></div>
          <div style="background:#f0fdf4;padding:5px;border-radius:5px;border-left:2px solid #10b981;"><div style="font-size:7px;font-weight:700;color:#14532d;">SANITASI</div><div style="font-size:11px;font-weight:900;color:#059669;">${dk.SANITASI != null ? dk.SANITASI + '%' : '-'}</div></div>
        </div>`;
      } else if (indikatorTerpilih === 'AHH') {
        indHTML = `<div style="background:#fef2f2;padding:8px;border-radius:8px;border-left:3px solid #ef4444;"><div style="font-size:8px;font-weight:700;color:#7f1d1d;">ANGKA HARAPAN HIDUP</div><div style="font-size:16px;font-weight:900;color:#dc2626;">${dk.AHH != null ? dk.AHH + ' tahun' : '-'}</div></div>`;
      } else if (indikatorTerpilih === 'IMUNISASI') {
        indHTML = `<div style="background:#eff6ff;padding:8px;border-radius:8px;border-left:3px solid #3b82f6;"><div style="font-size:8px;font-weight:700;color:#1e3a8a;">CAKUPAN IMUNISASI</div><div style="font-size:16px;font-weight:900;color:#2563eb;">${dk.IMUNISASI != null ? dk.IMUNISASI + '%' : '-'}</div></div>`;
      } else if (indikatorTerpilih === 'SANITASI') {
        indHTML = `<div style="background:#f0fdf4;padding:8px;border-radius:8px;border-left:3px solid #10b981;"><div style="font-size:8px;font-weight:700;color:#14532d;">AKSES SANITASI</div><div style="font-size:16px;font-weight:900;color:#059669;">${dk.SANITASI != null ? dk.SANITASI + '%' : '-'}</div></div>`;
      }

      lapisan.bindPopup(
        `<div style="font-family:inherit;min-width:240px;">
           <div style="background:${w};color:white;padding:8px 10px;border-radius:8px 8px 0 0;margin:-1px -1px 8px -1px;">
             <div style="font-weight:900;font-size:12px;">${a.nama_provinsi || ''}</div>
             <div style="font-size:10px;font-weight:700;opacity:0.9;">${kat || '-'} · Skor: ${a.skor_total ?? '-'}</div>
           </div>
           <div style="padding:0 4px 4px;">
             <div style="margin-bottom:6px;">${indHTML}</div>
             <div style="font-size:9px;color:#334155;line-height:1.4;background:#f8fafc;padding:6px;border-radius:5px;">${wawasan}</div>
           </div>
         </div>`, { maxWidth: 280, maxHeight: 400 }
      );
    },
  };
}

// ══════════════════════════════════════════
// PETA SECTION
// ══════════════════════════════════════════
function PetaSection({
  hasilAnalisis, tahunTerpilih, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
  sedangMenganalisis, sedangCekData, dataBaruDariBPS, pernahAnalisis,
  onAnalisis, onSimpan, onReset,
  leafletReady, MapCont, TileLay, GeoComp,
  petaRef, basemap, setBasemap,
  koordinatCursor, setKoordinatCursor, currentZoom, setCurrentZoom,
  provinsiDipilih, setProvinsiDipilih,
  searchOpen, setSearchOpen, searchQuery, setSearchQuery,
  suggestions, handleSearch,
  kombinasiTersedia, onPilihKombo, sedangMuatAwal,
  jumlahKategori,
}) {
  const [showBasemap,  setShowBasemap]  = useState(false);
  const [menuFilter,   setMenuFilter]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hitungScaleKm = (zoom) => ({5:1000,6:500,7:200,8:100,9:50,10:25})[Math.floor(zoom)] || 1000;

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Memproses...';
    if (sedangCekData)      return 'Memeriksa...';
    if (!pernahAnalisis)    return 'Analisis';
    return { SEMUA:'Semua Indikator', AHH:'Analisis AHH', IMUNISASI:'Analisis Imunisasi', SANITASI:'Analisis Sanitasi' }[indikatorTerpilih] || 'Analisis';
  };

  const geoKey   = `${hasilAnalisis?.tahun}-${indikatorTerpilih}-${kategoriTerpilih}-${provinsiDipilih}`;
  const geoKeyFs = `fs-${geoKey}`;
  const geoProps = hasilAnalisis?.matched_features?.features
    ? buildGeoProps(hasilAnalisis, indikatorTerpilih, kategoriTerpilih, provinsiDipilih)
    : null;

  // ── Sub-komponen reusable ──────────────────────────────────────────────────
  const KontrolKiri = () => (
    <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
      <MapBtn onClick={() => petaRef.current?.zoomIn()} className="font-bold text-xl text-slate-700 dark:text-slate-200 leading-none">+</MapBtn>
      <MapBtn onClick={() => petaRef.current?.zoomOut()} className="font-bold text-xl text-slate-700 dark:text-slate-200 leading-none">−</MapBtn>
      <div className="relative">
        <MapBtn onClick={() => setShowBasemap(!showBasemap)}>
          <Map size={14} className="text-slate-600 dark:text-slate-300"/>
        </MapBtn>
        {showBasemap && (
          <div className="absolute left-full ml-2 top-0 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl z-[500] border border-slate-200 dark:border-slate-700 py-1">
            <div className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Basemap</div>
            {Object.entries(BASEMAPS).map(([k, bm]) => (
              <button key={k} onClick={() => { setBasemap(k); setShowBasemap(false); }}
                className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
                  basemap === k ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                {bm.label} {basemap === k && <Check size={12}/>}
              </button>
            ))}
          </div>
        )}
      </div>
      {hasilAnalisis && (
        <div className="relative">
          {searchOpen ? (
            <div className="absolute left-full ml-2 top-0 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 w-56">
              <div className="p-2 flex gap-1.5">
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSearch()} placeholder="Cari provinsi..." autoFocus
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 outline-none"/>
                <button onClick={() => handleSearch()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 rounded-lg"><Search size={12}/></button>
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); setProvinsiDipilih(null); }} className="bg-slate-200 dark:bg-slate-600 px-2 rounded-lg text-slate-700 dark:text-slate-200"><X size={12}/></button>
              </div>
              {suggestions.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 max-h-36 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => handleSearch(s.nama)}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between text-xs">
                      <span className="text-slate-900 dark:text-slate-200">{s.nama}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold ml-2" style={{ backgroundColor: s.warna + '20', color: s.warna }}>{s.kategori}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <MapBtn onClick={() => setSearchOpen(true)}><Search size={13} className="text-slate-600 dark:text-slate-300"/></MapBtn>
          )}
        </div>
      )}
    </div>
  );

  const NavTengah = () => (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400]">
      <SelectorAnalisisKesehatan
        hasilAnalisis={hasilAnalisis}
        kombinasiTersedia={kombinasiTersedia}
        tahunTerpilih={tahunTerpilih}
        onPilih={onPilihKombo}
        sedangMuatAwal={sedangMuatAwal}
      />
    </div>
  );

  const LegendaKanan = () => (
    <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2 items-end">
      <div className="bg-white/95 dark:bg-slate-800/90 px-3 py-1.5 rounded-lg shadow border border-slate-200 dark:border-slate-600">
        <div className="text-[10px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Lat:</span> {koordinatCursor.lat} |{' '}
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Lng:</span> {koordinatCursor.lng}
        </div>
      </div>
      <div className="bg-white/95 dark:bg-slate-800/90 px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="h-1.5 bg-slate-300 dark:bg-slate-600 mb-1" style={{ width: '64px', borderLeft: '2px solid #64748b', borderRight: '2px solid #64748b', borderBottom: '2px solid #64748b' }}/>
        <div className="text-[10px] font-medium text-center text-slate-700 dark:text-slate-300">{hitungScaleKm(currentZoom)} km</div>
      </div>
      <div className="bg-white/95 dark:bg-slate-800/90 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 min-w-[110px]">
        <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Status IKK</div>
        {Object.entries(KATEGORI_KESEHATAN).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 mb-1.5 last:mb-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.warna }}/>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{v.label}</span>
            </div>
            {hasilAnalisis && (
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded">
                {jumlahKategori[k]}
              </span>
            )}
          </div>
        ))}
        {hasilAnalisis && (
          <div className="relative mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button onClick={() => setMenuFilter(!menuFilter)}
              className="w-full flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <Filter size={9}/> {kategoriTerpilih} <ChevronDown size={9}/>
            </button>
            {menuFilter && (
              <div className="absolute bottom-full mb-1 right-0 w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-[500] py-1">
                {['SEMUA','KRITIS','WASPADA','STABIL'].map(k => (
                  <button key={k} onClick={() => { setKategoriTerpilih(k); setMenuFilter(false); }}
                    className={cn('w-full text-left px-3 py-1.5 text-[10px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
                      kategoriTerpilih === k ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300')}>
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const ActionButtons = () => (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] flex gap-2">
      <Btn onClick={onAnalisis} disabled={sedangMenganalisis || sedangCekData} variant="primary"
        className="px-5 uppercase tracking-wider text-xs shadow-xl whitespace-nowrap"
        style={{ boxShadow: '0 10px 30px rgba(5,150,105,0.30)' }}>
        {(sedangCekData || sedangMenganalisis) ? <Loader2 size={13} className="animate-spin"/> : <Play size={13}/>}
        {getButtonText()}
      </Btn>
      {dataBaruDariBPS && hasilAnalisis && (
        <Btn variant="save" onClick={onSimpan} className="px-5 uppercase tracking-wider text-xs shadow-xl">
          <Save size={13}/> Simpan
        </Btn>
      )}
      {hasilAnalisis && (
        <Btn variant="danger" onClick={onReset} className="px-5 uppercase tracking-wider text-xs shadow-xl">
          <RotateCcw size={13}/> Reset
        </Btn>
      )}
    </div>
  );

  return (
    <>
      {/* ════════════════════════════════════════════
          FULLSCREEN OVERLAY
      ════════════════════════════════════════════ */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col overflow-hidden"
          style={{ height: '100dvh', width: '100vw', top: 0, left: 0 }}
        >
          <div className="relative flex-1 min-h-0">
            {leafletReady && MapCont && (
              <MapCont center={PUSAT_DEFAULT} zoom={ZOOM_DEFAULT} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={petaRef}>
                <TileLay key={basemap} url={BASEMAPS[basemap].url} attribution={BASEMAPS[basemap].attribution}/>
                <MapEventHandler setKoordinatCursor={setKoordinatCursor} setCurrentZoom={setCurrentZoom}/>
                {geoProps && <GeoComp key={geoKeyFs} {...geoProps} />}
              </MapCont>
            )}
            <KontrolKiri />
            <NavTengah />
            <LegendaKanan />
            {/* Tombol Restore — pojok kiri bawah */}
            <div className="absolute bottom-4 left-4 z-[400]">
              <button onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-400 transition-all active:scale-95 group">
                <Minimize2 size={13} className="text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors"/>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors">Restore</span>
              </button>
            </div>
            <ActionButtons />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          CARD NORMAL
      ════════════════════════════════════════════ */}
      <Card className="overflow-hidden border-2">
        <div className="relative" style={{ height: 520 }}>
          {sedangMuatAwal && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-emerald-500 animate-spin"/>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Memuat data dari database...</p>
              </div>
            </div>
          )}
          {leafletReady && MapCont && (
            <MapCont center={PUSAT_DEFAULT} zoom={ZOOM_DEFAULT} className="h-full w-full z-0" zoomControl={false} ref={petaRef}>
              <TileLay key={basemap} url={BASEMAPS[basemap].url} attribution={BASEMAPS[basemap].attribution}/>
              <MapEventHandler setKoordinatCursor={setKoordinatCursor} setCurrentZoom={setCurrentZoom}/>
              {geoProps && <GeoComp key={geoKey} {...geoProps} />}
            </MapCont>
          )}
          <KontrolKiri />
          <NavTengah />
          <LegendaKanan />
          {/* Tombol Maximize — pojok kiri bawah */}
          <div className="absolute bottom-4 left-4 z-[400]">
            <button onClick={() => setIsFullscreen(true)} title="Buka peta fullscreen"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-400 transition-all active:scale-95 group">
              <Maximize2 size={13} className="text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 transition-colors"/>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 transition-colors">Maximize</span>
            </button>
          </div>
          <ActionButtons />
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════
// TAB INFO
// ══════════════════════════════════════════
function TabInfo({ hasilAnalisis, jumlahKategori, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, eksporData }) {
  const [menuUnduh, setMenuUnduh] = useState(false);

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === kategoriTerpilih);
    if (indikatorTerpilih !== 'SEMUA') f = f.filter(x => {
      const dk = x.properties?.health_analysis?.data_kesehatan || {};
      if (indikatorTerpilih === 'AHH')       return dk.AHH       != null;
      if (indikatorTerpilih === 'IMUNISASI') return dk.IMUNISASI != null;
      if (indikatorTerpilih === 'SANITASI')  return dk.SANITASI  != null;
      return true;
    });
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih]);

  if (!hasilAnalisis) return (
    <div className="py-10 text-center">
      <BarChart2 size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada data. Klik <strong>Analisis</strong> di peta untuk memulai.</p>
    </div>
  );

  const statsConfig = [
    { label: 'Total Provinsi', val: hasilAnalisis.total_success || 0, cls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' },
    { label: 'Stabil',         val: jumlahKategori.STABIL,            cls: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'     },
    { label: 'Waspada',        val: jumlahKategori.WASPADA,           cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'     },
    { label: 'Kritis',         val: jumlahKategori.KRITIS,            cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'                 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <Calendar size={9}/> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        {hasilAnalisis.tahun && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <Calendar size={9}/> Tahun {hasilAnalisis.tahun}
          </span>
        )}
        {hasilAnalisis.indikator && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
            <BarChart2 size={9}/> {INDIKATOR_LABELS_KESEHATAN[hasilAnalisis.indikator] || hasilAnalisis.indikator}
          </span>
        )}
      </div>
      {hasilAnalisis.dataset_aktif?.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Dataset aktif:</span>
          {hasilAnalisis.dataset_aktif.map(k => (
            <span key={k} className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700">
              {DATASET_LABELS_KESEHATAN[k] || k}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsConfig.map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-70 mb-1">{s.label}</div>
            <div className="text-2xl font-black">{s.val}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dasar Penilaian IKK Kesehatan</div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
          Skor gabungan: AHH + Imunisasi + Sanitasi (normalisasi per indikator).{' '}
          <span className="font-bold text-green-600 dark:text-green-400">STABIL</span> ≥ 0.70 ·{' '}
          <span className="font-bold text-amber-600 dark:text-amber-400">WASPADA</span> 0.50–0.70 ·{' '}
          <span className="font-bold text-red-600 dark:text-red-400">KRITIS</span> {'< 0.50'}
        </p>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{dataTerfilter.length} provinsi · Tahun {hasilAnalisis.tahun}</p>
          <div className="flex items-center gap-2">
            <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
              {['SEMUA','KRITIS','WASPADA','STABIL'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="relative">
              <Btn variant="primary" className="px-3 py-1.5 text-xs" onClick={() => setMenuUnduh(!menuUnduh)}>
                <Download size={12}/> Unduh
              </Btn>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-700 py-1">
                  {['EXCEL','CSV','JSON','GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                      <Download size={10} className="text-emerald-500"/> {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                <th className="px-3 py-3 text-center w-8">No</th>
                <th className="px-4 py-3 text-left">Provinsi</th>
                <th className="px-4 py-3 text-center">Skor</th>
                {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'AHH')       && <th className="px-4 py-3 text-center">AHH (thn)</th>}
                {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'IMUNISASI') && <th className="px-4 py-3 text-center">Imunisasi (%)</th>}
                {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'SANITASI')  && <th className="px-4 py-3 text-center">Sanitasi (%)</th>}
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {dataTerfilter.map((fitur, idx) => {
                const d   = fitur.properties.health_analysis;
                const dk  = d.data_kesehatan || {};
                const w   = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
                const kat = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
                return (
                  <tr key={d.nama_provinsi} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-3 py-2.5 text-center text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w }}/>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{d.nama_provinsi}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.skor_total ?? '-'}</span>
                    </td>
                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'AHH')       && <td className="px-4 py-2.5 text-center text-xs text-slate-500">{dk.AHH ?? '-'}</td>}
                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'IMUNISASI') && <td className="px-4 py-2.5 text-center text-xs text-slate-500">{dk.IMUNISASI != null ? `${dk.IMUNISASI}%` : '-'}</td>}
                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'SANITASI')  && <td className="px-4 py-2.5 text-center text-xs text-slate-500">{dk.SANITASI  != null ? `${dk.SANITASI}%`  : '-'}</td>}
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{ borderColor: w + '60', color: w, backgroundColor: w + '15' }}>{kat}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// TAB KEBIJAKAN
// ══════════════════════════════════════════
function TabKebijakan({ hasilAnalisis, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih }) {
  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === kategoriTerpilih);
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih]);

  if (!hasilAnalisis) return (
    <div className="py-10 text-center">
      <ClipboardList size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada data analisis.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="text-emerald-500" size={18}/>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rekomendasi Kebijakan</h3>
            <p className="text-xs text-slate-400 mt-0.5">{dataTerfilter.length} provinsi · Tahun {hasilAnalisis.tahun}</p>
          </div>
        </div>
        <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
          {['SEMUA','KRITIS','WASPADA','STABIL'].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              <th className="px-3 py-3 text-center w-8">No</th>
              <th className="px-4 py-3 text-left">Provinsi</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Prioritas</th>
              <th className="px-4 py-3 text-left">Rekomendasi Kebijakan</th>
            </tr>
          </thead>
          <tbody>
            {dataTerfilter.map((fitur, idx) => {
              const d    = fitur.properties.health_analysis;
              const rek  = d.rekomendasi?.[0];
              const w    = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
              const kat  = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
              const pStyle = PRIORITY_STYLE[rek?.priority] || PRIORITY_STYLE['Sedang'];
              return (
                <tr key={d.nama_provinsi} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-3 py-2.5 text-center text-xs text-slate-400 dark:text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w }}/>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{d.nama_provinsi}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                      style={{ borderColor: w + '60', color: w, backgroundColor: w + '15' }}>{kat}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {rek?.priority ? (
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold border uppercase', pStyle.badge)}>{rek.priority}</span>
                    ) : <span className="text-[10px] text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-2.5 max-w-md">
                    <ul className="space-y-0.5">
                      {rek?.actions?.map((action, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                          <Check size={10} className="text-emerald-400 shrink-0 mt-0.5"/>{action}
                        </li>
                      )) || <li className="text-[10px] text-slate-400 italic">Pertahankan kondisi saat ini</li>}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════
export default function KesehatanPage() {
  const API = 'http://127.0.0.1:8000/api';

  const [hasilAnalisis,        setHasilAnalisis]        = useState(null);
  const [kategoriTerpilih,     setKategoriTerpilih]     = useState('SEMUA');
  const [indikatorTerpilih,    setIndikatorTerpilih]    = useState('SEMUA');
  const [isClient,             setIsClient]             = useState(false);
  const [activeTab,            setActiveTab]            = useState('info');
  const [daftarTersimpan,      setDaftarTersimpan]      = useState([]);
  const [sedangMuatAwal,       setSedangMuatAwal]       = useState(true);
  const [dataBaruDariBPS,      setDataBaruDariBPS]      = useState(false);
  const [tahunTerpilih,        setTahunTerpilih]        = useState(2024);
  const [sedangMenganalisis,   setSedangMenganalisis]   = useState(false);
  const [sedangCekData,        setSedangCekData]        = useState(false);
  const [hasilCekData,         setHasilCekData]         = useState(null);
  const [pilihanIndikator,     setPilihanIndikator]     = useState('ALL');
  const [pernahAnalisis,       setPernahAnalisis]       = useState(false);
  const [alertKomboTidakAda,   setAlertKomboTidakAda]  = useState(null);
  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [modalSaveTerbuka,     setModalSaveTerbuka]     = useState(false);
  const [namaSimpan,           setNamaSimpan]           = useState('');
  const [sedangMenyimpan,      setSedangMenyimpan]      = useState(false);
  const [basemap,              setBasemap]              = useState('CARTO_LIGHT');
  const [koordinatCursor,      setKoordinatCursor]      = useState({ lat: '0.0000', lng: '0.0000' });
  const [currentZoom,          setCurrentZoom]          = useState(ZOOM_DEFAULT);
  const [provinsiDipilih,      setProvinsiDipilih]      = useState(null);
  const [searchOpen,           setSearchOpen]           = useState(false);
  const [searchQuery,          setSearchQuery]          = useState('');
  const [suggestions,          setSuggestions]          = useState([]);
  const [loadingDataset,       setLoadingDataset]       = useState({ AHH: false, IMUNISASI: false, SANITASI: false });
  const [menuDatasetTerbuka,   setMenuDatasetTerbuka]   = useState(false);
  const [leafletReady,         setLeafletReady]         = useState(false);
  const [MapCont,              setMapCont]              = useState(null);
  const [TileLay,              setTileLay]              = useState(null);
  const [GeoComp,              setGeoComp]              = useState(null);

  const petaRef    = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
    import('leaflet/dist/leaflet.css');
    import('react-leaflet').then(rl => {
      setMapCont(() => rl.MapContainer);
      setTileLay(() => rl.TileLayer);
      setGeoComp(() => rl.GeoJSON);
      setLeafletReady(true);
    });
  }, []);
  useEffect(() => { if (isClient) muatDariDB(); }, [isClient]);

  const kombinasiTersedia = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(a => {
      const ind = a.indikator || 'ALL';
      const key = `${a.tahun}|${ind}`;
      if (!map[key] || a.timestamp > map[key].timestamp)
        map[key] = { timestamp: a.timestamp, analysis_id: a.analysis_id };
    });
    return map;
  }, [daftarTersimpan]);

  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return { KRITIS: 0, WASPADA: 0, STABIL: 0 };
    const f = hasilAnalisis.matched_features.features;
    return {
      KRITIS:  f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === 'KRITIS').length,
      WASPADA: f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === 'WASPADA').length,
      STABIL:  f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === 'STABIL').length,
    };
  }, [hasilAnalisis, indikatorTerpilih]);

  const refreshDB = async () => {
    try { const r = await axios.get(`${API}/health-analysis/list/`); setDaftarTersimpan(r.data.results || []); } catch {}
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/health-analysis/list/`);
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => {
        const ai = (a.indikator || 'ALL') === 'ALL' ? 0 : 1;
        const bi = (b.indikator || 'ALL') === 'ALL' ? 0 : 1;
        if (ai !== bi) return ai - bi;
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
      await muatDetail(sorted[0].analysis_id, sorted[0].tahun, sorted[0].indikator || 'ALL', true);
    } catch (e) { console.error(e); }
    finally { setSedangMuatAwal(false); }
  };

  const muatDetail = async (id, tahun, indikator, silent = false) => {
    const tid = silent ? null : toast.loading('Memuat analisis...');
    try {
      const res = await axios.get(`${API}/health-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setIndikatorTerpilih(dbToUI(indikator || res.data.indikator || 'ALL'));
      setPilihanIndikator(indikator || res.data.indikator || 'ALL');
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDariBPS(false);
      if (!silent) toast.success(`Data dimuat: ${INDIKATOR_LABELS_KESEHATAN[indikator || 'ALL']} ${tahun}`);
    } catch (e) {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error('Gagal memuat detail analisis');
      throw e;
    }
  };

  const handlePilihKombo = async (tahun, indikator) => {
    const key = `${tahun}|${indikator}`;
    if (!kombinasiTersedia[key]) { setAlertKomboTidakAda({ tahun, indikator }); return; }
    await muatDetail(kombinasiTersedia[key].analysis_id, tahun, indikator);
  };

  const handleAmbilDariBPS = (tahun, indikator) => {
    setAlertKomboTidakAda(null);
    setTahunTerpilih(tahun);
    setPilihanIndikator(indikator);
    cekDanAnalisis(indikator, tahun);
  };

  useEffect(() => {
    if (!hasilAnalisis?.matched_features?.features || !searchQuery.trim()) { setSuggestions([]); return; }
    setSuggestions(
      hasilAnalisis.matched_features.features
        .filter(f => f.properties?.health_analysis?.nama_provinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(f => ({ nama: f.properties.health_analysis.nama_provinsi, kategori: getKategoriByIndikatorKesehatan(f, indikatorTerpilih), warna: getWarnaByIndikatorKesehatan(f, indikatorTerpilih) }))
        .slice(0, 5)
    );
  }, [searchQuery, hasilAnalisis, indikatorTerpilih]);

  const handleSearch = (nama) => {
    const n = nama || searchQuery;
    if (!n.trim()) return;
    const f = hasilAnalisis?.matched_features?.features?.find(feat => feat.properties?.health_analysis?.nama_provinsi?.toLowerCase() === n.toLowerCase());
    if (f && petaRef.current) {
      const coords = f.geometry.coordinates;
      let lat, lng;
      if (f.geometry.type === 'MultiPolygon') { const p = coords[0][0]; lat = p.reduce((s,c)=>s+c[1],0)/p.length; lng = p.reduce((s,c)=>s+c[0],0)/p.length; }
      else { const p = coords[0]; lat = p.reduce((s,c)=>s+c[1],0)/p.length; lng = p.reduce((s,c)=>s+c[0],0)/p.length; }
      petaRef.current.setView([lat, lng], 7);
      setProvinsiDipilih(f.properties.health_analysis.nama_provinsi);
      toast.success(`Ditemukan: ${n}`, { duration: 3000 });
      setSearchOpen(false); setSearchQuery(''); setSuggestions([]);
    } else toast.error('Provinsi tidak ditemukan');
  };

  const cekDanAnalisis = async (indikator = null, tahun = null) => {
    const pilihan = indikator || pilihanIndikator;
    const thn     = tahun    || tahunTerpilih;
    pendingRef.current = { pilihan, tahunFetch: thn };
    setModalAnalisisTerbuka(false);
    setSedangCekData(true); setHasilCekData(null);
    try {
      const r = await axios.post(`${API}/check-health-data/`, { tahun: thn, indikator: pilihan });
      setHasilCekData(r.data);
    } catch { toast.error('Gagal memeriksa ketersediaan data BPS'); }
    finally { setSedangCekData(false); }
  };

  const lanjutkanAnalisis = async () => {
    if (!pendingRef.current) return;
    const { pilihan, tahunFetch } = pendingRef.current;
    setHasilCekData(null); setSedangMenganalisis(true); setKategoriTerpilih('SEMUA');
    const tid = toast.loading(`Mengambil data BPS kesehatan ${tahunFetch}...`);
    try {
      const r = await axios.post(`${API}/analyze-health-bps/`, { tahun: tahunFetch, indikator: pilihan });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setIndikatorTerpilih(pilihan === 'ALL' ? 'SEMUA' : pilihan);
        setTahunTerpilih(tahunFetch); setPernahAnalisis(true); setDataBaruDariBPS(true);
        setActiveTab('info');
        toast.success(`Berhasil: ${r.data.total_success} provinsi (${tahunFetch})!`, { duration: 5000 });
      }
    } catch (e) { toast.dismiss(tid); toast.error(e.response?.data?.error || 'Gagal terhubung ke server'); }
    finally { setSedangMenganalisis(false); }
  };

  const simpan = async () => {
    if (!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const r = await axios.post(`${API}/save-health-analysis/`, { name: namaSimpan, analysis_data: hasilAnalisis });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false); setNamaSimpan(''); setDataBaruDariBPS(false);
        await refreshDB();
      }
    } catch { toast.dismiss(tid); toast.error('Gagal menyimpan'); }
    finally { setSedangMenyimpan(false); }
  };

  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nama });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const unduhDataset = async (jenis) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error('Dataset tidak tersedia');
    const ds  = hasilAnalisis.raw_datasets;
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const tgl = new Date().toISOString().split('T')[0];
    const doAHH = async () => {
      if (!ds?.AHH || !Object.keys(ds.AHH).length) return toast.error('Data AHH tidak tersedia');
      setLoadingDataset(p => ({ ...p, AHH: true }));
      const tid = toast.loading('Membuat file AHH...');
      try {
        const r = await axios.post(`${API}/download-ahh-xlsx/`, { ahh_data: ds.AHH, timestamp: ds.timestamp, tahun: thn }, { responseType: 'blob' });
        unduhBlob(new Blob([r.data]), `Dataset_AHH_BPS_${thn}_${tgl}.xlsx`);
        toast.dismiss(tid); toast.success('Dataset AHH diunduh!');
      } catch { toast.dismiss(tid); toast.error('Gagal unduh AHH'); }
      finally { setLoadingDataset(p => ({ ...p, AHH: false })); }
    };
    const doImunisasi = async () => {
      if (!ds?.IMUNISASI || !Object.keys(ds.IMUNISASI).length) return toast.error('Data Imunisasi tidak tersedia');
      setLoadingDataset(p => ({ ...p, IMUNISASI: true }));
      const tid = toast.loading('Membuat file Imunisasi...');
      try {
        const r = await axios.post(`${API}/download-imunisasi-xlsx/`, { imunisasi_data: ds.IMUNISASI, timestamp: ds.timestamp, tahun: thn }, { responseType: 'blob' });
        unduhBlob(new Blob([r.data]), `Dataset_Imunisasi_BPS_${thn}_${tgl}.xlsx`);
        toast.dismiss(tid); toast.success('Dataset Imunisasi diunduh!');
      } catch { toast.dismiss(tid); toast.error('Gagal unduh Imunisasi'); }
      finally { setLoadingDataset(p => ({ ...p, IMUNISASI: false })); }
    };
    const doSanitasi = async () => {
      if (!ds?.SANITASI || !Object.keys(ds.SANITASI).length) return toast.error('Data Sanitasi tidak tersedia');
      setLoadingDataset(p => ({ ...p, SANITASI: true }));
      const tid = toast.loading('Membuat file Sanitasi...');
      try {
        const r = await axios.post(`${API}/download-sanitasi-xlsx/`, { sanitasi_data: ds.SANITASI, timestamp: ds.timestamp, tahun: thn }, { responseType: 'blob' });
        unduhBlob(new Blob([r.data]), `Dataset_Sanitasi_BPS_${thn}_${tgl}.xlsx`);
        toast.dismiss(tid); toast.success('Dataset Sanitasi diunduh!');
      } catch { toast.dismiss(tid); toast.error('Gagal unduh Sanitasi'); }
      finally { setLoadingDataset(p => ({ ...p, SANITASI: false })); }
    };
    if (jenis === 'ALL') { await doAHH(); await doImunisasi(); await doSanitasi(); }
    else if (jenis === 'AHH')       doAHH();
    else if (jenis === 'IMUNISASI') doImunisasi();
    else if (jenis === 'SANITASI')  doSanitasi();
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r   = hasilAnalisis.analysis_summary || [];
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const tgl = new Date().toISOString().split('T')[0];
    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({ Provinsi: i.provinsi, Kategori: i.kategori, 'Skor Total': i.skor_total, 'AHH (tahun)': i.ahh||'-', 'Imunisasi (%)': i.imunisasi||'-', 'Sanitasi (%)': i.sanitasi||'-' })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Analisis');
      XLSX.writeFile(wb, `Analisis_Kesehatan_BPS_${thn}_${tgl}.xlsx`); toast.success('Excel diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis,null,2)],{type:'application/json'}), `Analisis_Kesehatan_BPS_${thn}_${tgl}.json`); toast.success('JSON diunduh');
    } else if (format === 'CSV') {
      const csv = [['Provinsi','Kategori','Skor Total','AHH','Imunisasi','Sanitasi'].join(','), ...r.map(s=>[s.provinsi,s.kategori,s.skor_total,s.ahh||'-',s.imunisasi||'-',s.sanitasi||'-'].join(','))].join('\n');
      unduhBlob(new Blob([csv],{type:'text/csv'}), `Analisis_Kesehatan_BPS_${thn}_${tgl}.csv`); toast.success('CSV diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features,null,2)],{type:'application/json'}), `Spasial_Kesehatan_BPS_${thn}_${tgl}.geojson`); toast.success('GeoJSON diunduh');
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>
      <ModalAlertKomboTidakAdaKesehatan info={alertKomboTidakAda} onTutup={() => setAlertKomboTidakAda(null)} onAmbilDariBPS={handleAmbilDariBPS}/>
      <ModalCekDataKesehatan
        tahun={pendingRef.current?.tahunFetch || tahunTerpilih}
        indikator={pendingRef.current?.pilihan || pilihanIndikator}
        hasilCek={hasilCekData} sedangCek={sedangCekData}
        onTutup={() => setHasilCekData(null)} onLanjut={lanjutkanAnalisis}
      />

      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Data Analisis</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={18} className="text-slate-500 dark:text-slate-400"/></button>
            </div>
            <div className="mb-6">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3"><Calendar size={13}/> Tahun Data BPS</label>
              <div className="grid grid-cols-4 gap-2">
                {TAHUN_TERSEDIA.map(th => (
                  <button key={th} onClick={() => setTahunTerpilih(th)}
                    className={cn('px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all',
                      tahunTerpilih === th ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-600')}>
                    {th}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 mb-6">
              {[
                { key:'ALL',       label:'Semua Indikator',         desc:'AHH + Imunisasi + Sanitasi',          icon:<BarChart2 size={15}/> },
                { key:'AHH',       label:'Angka Harapan Hidup',     desc:'Rata-rata AHH laki-laki & perempuan', icon:<Heart size={15}/>     },
                { key:'IMUNISASI', label:'Cakupan Imunisasi Dasar', desc:'Persentase balita imunisasi lengkap',  icon:<Shield size={15}/>    },
                { key:'SANITASI',  label:'Akses Sanitasi Layak',    desc:'Persentase RT sanitasi layak',         icon:<Droplets size={15}/>  },
              ].map(opt => (
                <button key={opt.key} onClick={() => setPilihanIndikator(opt.key)}
                  className={cn('w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3',
                    pilihanIndikator === opt.key ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600')}>
                  <span className={cn('mt-0.5 shrink-0', pilihanIndikator === opt.key ? 'text-emerald-500' : 'text-slate-400')}>{opt.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                  {pilihanIndikator === opt.key && <Check size={15} className="text-emerald-500 mt-0.5"/>}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setModalAnalisisTerbuka(false)}>Batal</Btn>
              <Btn variant="primary" className="flex-1 justify-center" onClick={() => cekDanAnalisis()} disabled={sedangMenganalisis}>
                <Search size={13}/> Cek & Analisis {tahunTerpilih}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {modalSaveTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Simpan Analisis</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={18} className="text-slate-500 dark:text-slate-400"/></button>
            </div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Nama Analisis</label>
            <input type="text" value={namaSimpan} onChange={e => setNamaSimpan(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && simpan()}
              placeholder={`Analisis Kesehatan ${hasilAnalisis?.tahun || tahunTerpilih}`}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm mb-6"/>
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setModalSaveTerbuka(false)}>Batal</Btn>
              <Btn variant="primary" className="flex-1 justify-center" onClick={simpan} disabled={sedangMenyimpan || !namaSimpan.trim()}>
                {sedangMenyimpan ? 'Menyimpan...' : 'Simpan'}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">
          <div className="flex items-start justify-between pt-7 pb-5">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Stethoscope size={22} className="text-emerald-500"/>
              Indeks Kesehatan Kewilayahan
            </h1>
            <nav className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Home size={12}/> <span>›</span> <span>SDM Nasional</span> <span>›</span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold">Kesehatan</span>
            </nav>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-emerald-500 animate-spin"/>
                <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaSection
                hasilAnalisis={hasilAnalisis} tahunTerpilih={tahunTerpilih}
                indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih}
                sedangMenganalisis={sedangMenganalisis} sedangCekData={sedangCekData}
                dataBaruDariBPS={dataBaruDariBPS} pernahAnalisis={pernahAnalisis}
                onAnalisis={() => pernahAnalisis ? cekDanAnalisis() : (setPilihanIndikator('ALL'), setModalAnalisisTerbuka(true))}
                onSimpan={() => { setNamaSimpan(''); setModalSaveTerbuka(true); }}
                onReset={() => { setHasilAnalisis(null); setKategoriTerpilih('SEMUA'); setIndikatorTerpilih('SEMUA'); setProvinsiDipilih(null); setPernahAnalisis(false); setDataBaruDariBPS(false); toast.success('Analisis direset'); }}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef} basemap={basemap} setBasemap={setBasemap}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                searchOpen={searchOpen} setSearchOpen={setSearchOpen}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                suggestions={suggestions} handleSearch={handleSearch}
                kombinasiTersedia={kombinasiTersedia} onPilihKombo={handlePilihKombo}
                sedangMuatAwal={false} jumlahKategori={jumlahKategori}
              />

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-100 dark:border-slate-700">
                  {TABS.map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button key={id} onClick={() => setActiveTab(id)}
                        className={cn('flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all relative flex-1',
                          active ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                                 : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30')}>
                        <Icon size={15}/>
                        <span className="hidden sm:inline">{label}</span>
                        {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"/>}
                      </button>
                    );
                  })}
                </div>
                <div className="p-5">
                  {activeTab === 'info'      && <TabInfo hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} eksporData={eksporData}/>}
                  {activeTab === 'kebijakan' && <TabKebijakan hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih}/>}
                  {activeTab === 'metadata'  && <MetadataPanelKesehatan hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} tahunTerpilih={tahunTerpilih} loadingDataset={loadingDataset} onTutup={null} onUnduhDataset={unduhDataset} menuDatasetTerbuka={menuDatasetTerbuka} setMenuDatasetTerbuka={setMenuDatasetTerbuka} embedded={true}/>}
                  {activeTab === 'tren'      && <TrendPanelKesehatan daftarTersimpan={daftarTersimpan} onTutup={null} embedded={true}/>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footerauth/>
    </div>
  );
}