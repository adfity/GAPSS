"use client";
// ─── PETA SDM — PUBLIK (Read-Only) ───────────────────────────────────────────
// Versi stripped dari petaSdm.jsx:
// · Tidak ada tombol Analisis / Simpan / Reset
// · Tidak ada selector analisis (dikontrol dari parent)
// · Tetap punya: basemap switcher, legenda, zoom, koordinat, filter kategori
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect } from 'react';
import { Map, RotateCcw, Check, Filter, ChevronDown, Maximize, Minimize, Loader2 } from 'lucide-react';

export {
  getWarna_SDM, getKategori_SDM,
  TAHUN_BPS_AKTUAL, TAHUN_OLS, TAHUN_TERSEDIA_SDM,
  DATASET_LABELS_SDM, INDIKATOR_LABELS_SDM,
  INDIKATOR_COLORS_SDM, INDIKATOR_ICON_SDM,
  BASEMAPS_SDM, PUSAT_DEFAULT_SDM, ZOOM_DEFAULT_SDM,
  KATEGORI_SDM, isPrediksiYear,
} from './petaSdm';

import {
  BASEMAPS_SDM, PUSAT_DEFAULT_SDM, ZOOM_DEFAULT_SDM, KATEGORI_SDM,
  getWarna_SDM, getKategori_SDM,
} from './petaSdm';

const cn = (...cls) => cls.filter(Boolean).join(' ');

function buildTooltipHTML(a, w, kat) {
  const dc       = a.data_komponen || {};
  const katLabel = KATEGORI_SDM[kat]?.label || kat;
  const isDark   = ['#fff67f', '#abcd05'].includes(w);
  const tc       = isDark ? '#1a2e00' : (w === '#a6a6a6' ? '#475569' : '#ffffff');
  return `
    <div style="font-family:system-ui,sans-serif;padding:10px 12px;min-width:150px;max-width:210px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${w};flex-shrink:0;border:1px solid rgba(0,0,0,0.15);"></div>
        <span style="font-weight:800;font-size:12px;color:#0f172a;">${a.nama_provinsi || ''}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-radius:6px;background:${w};border:1px solid rgba(0,0,0,0.1);">
        <span style="font-size:9px;font-weight:700;color:${tc};text-transform:uppercase;">${katLabel}</span>
        <span style="font-size:12px;font-weight:900;color:${tc};">${a.indeks_sdm ?? '—'}</span>
      </div>
      <div style="margin-top:6px;display:grid;gap:3px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:10px;color:#64748b;">AHH</span>
          <span style="font-size:11px;font-weight:700;color:#047857;">${dc.UHH ?? '—'} th</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:10px;color:#64748b;">RLS / HLS</span>
          <span style="font-size:11px;font-weight:700;color:#1e40af;">${dc.RLS ?? '—'} / ${dc.HLS ?? '—'} th</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:10px;color:#64748b;">Pengeluaran</span>
          <span style="font-size:11px;font-weight:700;color:#b45309;">Rp${dc.PENGELUARAN ? (dc.PENGELUARAN * 1000).toLocaleString('id-ID') : '—'}</span>
        </div>
      </div>
    </div>`;
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

export default function PetaSDM_Publik({
  hasilAnalisis, indikatorTerpilih = 'ALL', kategoriTerpilih, setKategoriTerpilih,
  leafletReady, MapCont, TileLay, GeoComp,
  petaRef, koordinatCursor, setKoordinatCursor, currentZoom, setCurrentZoom,
  provinsiDipilih, setProvinsiDipilih, jumlahKategori,
  tinggi = 460,
}) {
  const [basemap,      setBasemap]      = useState('CARTO_LIGHT');
  const [showBasemap,  setShowBasemap]  = useState(false);
  const [menuFilter,   setMenuFilter]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const geoKey = `${hasilAnalisis?.tahun}-${indikatorTerpilih}-${kategoriTerpilih}-${provinsiDipilih}`;

  const geoProps = hasilAnalisis?.matched_features?.features ? {
    data: { type: 'FeatureCollection', features: hasilAnalisis.matched_features.features },
    style: (fitur) => {
      const a   = fitur?.properties?.sdm_analysis || {};
      const kat = getKategori_SDM(fitur, indikatorTerpilih);
      const w   = getWarna_SDM(fitur, indikatorTerpilih);
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
      const a   = fitur.properties?.sdm_analysis || {};
      const w   = getWarna_SDM(fitur, indikatorTerpilih);
      const kat = getKategori_SDM(fitur, indikatorTerpilih);
      lapisan.bindTooltip(buildTooltipHTML(a, w, kat), {
        sticky: true, opacity: 1, className: 'leaflet-tooltip-sdm',
      });
      lapisan.on('mouseover', function () { this.setStyle({ weight: 2.5, fillOpacity: 0.95, color: '#ffffff' }); });
      lapisan.on('mouseout',  function () {
        const sel = provinsiDipilih === a.nama_provinsi;
        this.setStyle({ weight: sel?3:1, fillOpacity: sel?0.95:0.80, color: sel?'#ffffff':'rgba(255,255,255,0.6)' });
      });
      lapisan.on('click', () => {
        setProvinsiDipilih?.(prev => prev === a.nama_provinsi ? null : a.nama_provinsi);
      });
    },
  } : null;

  const filterOptions = ['SEMUA','SANGAT_TINGGI','TINGGI','SEDANG','RENDAH','TIDAK_TERANALISIS'];

  const renderMap = (keyPrefix) => (
    <>
      {leafletReady && MapCont && (
        <MapCont center={PUSAT_DEFAULT_SDM} zoom={ZOOM_DEFAULT_SDM}
          style={{ height:'100%', width:'100%' }} zoomControl={false} ref={petaRef} className="z-0">
          <TileLay key={basemap} url={BASEMAPS_SDM[basemap].url} attribution={BASEMAPS_SDM[basemap].attribution}/>
          <MapEventHandler setKoordinatCursor={setKoordinatCursor} setCurrentZoom={setCurrentZoom}/>
          {geoProps && <GeoComp key={`${keyPrefix}-${geoKey}`} {...geoProps}/>}
        </MapCont>
      )}

      <style>{`
        .leaflet-tooltip-sdm { background:white !important; border:1px solid #e2e8f0 !important;
          border-radius:12px !important; box-shadow:0 8px 24px rgba(0,0,0,0.12) !important; padding:0 !important; }
        .leaflet-tooltip-sdm::before { display:none !important; }
      `}</style>

      {/* Zoom controls kiri */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        <MapBtn onClick={() => petaRef?.current?.zoomIn()}  title="Zoom In"><span className="font-bold text-lg leading-none">+</span></MapBtn>
        <MapBtn onClick={() => petaRef?.current?.zoomOut()} title="Zoom Out"><span className="font-bold text-lg leading-none">−</span></MapBtn>
        <div className="relative">
          <MapBtn onClick={() => setShowBasemap(v => !v)} title="Basemap"><Map size={13}/></MapBtn>
          {showBasemap && (
            <div className="absolute left-full ml-2 top-0 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[500] border border-slate-200 dark:border-slate-600 py-1">
              <div className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Basemap</div>
              {Object.entries(BASEMAPS_SDM).map(([k, bm]) => (
                <button key={k} onClick={() => { setBasemap(k); setShowBasemap(false); }}
                  className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700',
                    basemap===k ? 'text-indigo-600 font-semibold' : 'text-slate-700 dark:text-slate-200')}>
                  {bm.label} {basemap===k && <Check size={11}/>}
                </button>
              ))}
            </div>
          )}
        </div>
        <MapBtn onClick={() => petaRef?.current?.setView(PUSAT_DEFAULT_SDM, ZOOM_DEFAULT_SDM)} title="Reset View">
          <RotateCcw size={12}/>
        </MapBtn>
      </div>

      {/* Koordinat & legenda kanan */}
      <div className={cn('absolute top-3 z-[400] flex flex-col gap-2 items-end', isFullscreen ? 'right-8' : 'right-3')}>
        <div className="bg-white/95 dark:bg-slate-800/95 px-2 py-1 rounded-lg shadow border border-slate-200 dark:border-slate-600 backdrop-blur-sm">
          <div className="text-[9px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className="text-indigo-500 font-bold">Lat:</span> {koordinatCursor?.lat} &nbsp;
            <span className="text-indigo-500 font-bold">Lng:</span> {koordinatCursor?.lng}
          </div>
        </div>

        {/* Legenda */}
        <div className="bg-white/95 dark:bg-slate-800/95 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 backdrop-blur-sm min-w-[135px]">
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Klasifikasi ISDM</div>
          <div className="flex h-2 rounded-full overflow-hidden mb-1">
            {[['#af4284','RENDAH'],['#fff67f','SEDANG'],['#abcd05','TINGGI'],['#008cd6','SANGAT TINGGI']].map(([c,l]) => (
              <div key={l} className="flex-1" style={{ backgroundColor:c }} title={l}/>
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-slate-400 mb-2 px-0.5">
            <span>0</span><span>60</span><span>70</span><span>80</span><span>100</span>
          </div>
          {Object.entries(KATEGORI_SDM).filter(([k]) => k !== 'TIDAK_TERANALISIS').map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                  backgroundColor: v.warna,
                  border: ['#fff67f','#abcd05'].includes(v.warna) ? '1px solid rgba(0,0,0,0.2)' : '',
                }}/>
                <span className="text-[9px] font-semibold text-slate-800 dark:text-slate-100">{v.label}</span>
              </div>
              {hasilAnalisis && (
                <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">
                  {jumlahKategori?.[k] ?? 0}
                </span>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor:'#a6a6a6' }}/>
              <span className="text-[9px] text-slate-400">Tdk teranalisis</span>
            </div>
            {hasilAnalisis && (
              <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                {jumlahKategori?.['TIDAK_TERANALISIS'] ?? 0}
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
                  {kategoriTerpilih === 'SEMUA' ? 'SEMUA' : (KATEGORI_SDM[kategoriTerpilih]?.label || kategoriTerpilih)}
                </span>
                <ChevronDown size={9}/>
              </button>
              {menuFilter && (
                <div className="absolute bottom-full mb-1 right-0 w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 z-[500] py-1">
                  {filterOptions.map(k => (
                    <button key={k} onClick={() => { setKategoriTerpilih(k); setMenuFilter(false); }}
                      className={cn('w-full text-left px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5',
                        kategoriTerpilih===k ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200')}>
                      {k !== 'SEMUA' && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                        backgroundColor: KATEGORI_SDM[k]?.warna || '#a6a6a6',
                        border: ['#fff67f','#abcd05'].includes(KATEGORI_SDM[k]?.warna) ? '1px solid rgba(0,0,0,0.2)' : '',
                      }}/>}
                      {k === 'SEMUA' ? 'SEMUA' : (KATEGORI_SDM[k]?.label || k)}
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
    <div className="fixed inset-0 z-[9999] bg-slate-950" style={{ height:'100dvh', width:'100vw' }}>
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
      <div className="relative" style={{ height: tinggi }}>
        {!hasilAnalisis && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="text-center">
              <Loader2 size={28} className="text-indigo-300 animate-spin mx-auto mb-2"/>
              <p className="text-sm text-slate-400">Memuat peta...</p>
            </div>
          </div>
        )}
        {renderMap('normal')}
        <button onClick={() => setIsFullscreen(true)}
          className="absolute bottom-4 left-4 z-[400] flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 rounded-xl shadow-lg hover:bg-indigo-50 hover:border-indigo-500 transition-all font-semibold text-slate-800 dark:text-white">
          <Maximize size={12}/><span className="text-[10px] font-bold">Maximize</span>
        </button>
      </div>
    </div>
  );
}