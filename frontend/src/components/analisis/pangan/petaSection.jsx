"use client";
import React, { useState, useEffect } from 'react';
import {
  Play, Save, X, RotateCcw, Search, Map, Calendar,
  Loader2, CheckCircle2, XCircle, AlertTriangle,
  Check, ChevronDown, Filter, Bot, Maximize2, Minimize2,
} from 'lucide-react';

const BASEMAPS = {
  OSM:            { label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                           attribution: '© OSM' },
  ESRI_SATELLITE: { label: 'Satelit',       url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' },
  CARTO_LIGHT:    { label: 'Carto Light',   url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                               attribution: '© CARTO' },
  CARTO_DARK:     { label: 'Carto Dark',    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                attribution: '© CARTO' },
};
const STATUS_PANGAN = {
  TINGGI: { warna: '#10b981', label: 'TINGGI' },
  SEDANG: { warna: '#f59e0b', label: 'SEDANG' },
  RENDAH: { warna: '#ef4444', label: 'RENDAH' },
};
const DATASET_LABELS = {
  PADI:       'Produksi, Luas Panen & Produktivitas Padi',
  KONSUMSI:   'Konsumsi Kalori & Protein per Kapita',
  KEMISKINAN: 'Persentase Penduduk Miskin',
  PENDUDUK:   'Jumlah Penduduk',
};

// ─── Shared helpers
export const cn = (...cls) => cls.filter(Boolean).join(' ');

export const Card = ({ children, className = '' }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm', className)}>
    {children}
  </div>
);

export const Btn = ({ children, variant = 'primary', className = '', ...props }) => {
  const v = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    ghost:   'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
    danger:  'bg-slate-600 hover:bg-slate-700 text-white',
    save:    'bg-emerald-600 hover:bg-emerald-700 text-white',
    ai:      'bg-purple-600 hover:bg-purple-700 text-white',
  };
  return (
    <button className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50', v[variant], className)} {...props}>
      {children}
    </button>
  );
};

export const SectionBar = ({ color, title, sub }) => (
  <div className="flex items-center gap-2 mb-1">
    <div className={`w-1 h-5 rounded-full ${color}`} />
    <div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wide">{title}</h3>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export const AIBadge = ({ version, scores }) => (
  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700">
    <Bot size={15} className="text-purple-500 shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="text-xs font-bold text-purple-700 dark:text-purple-300">
        Data Prediksi AI Penuh — Random Forest {version || 'rf_v1.0'}
      </div>
      <div className="text-[10px] mt-0.5 text-purple-500 dark:text-purple-400">
        Seluruh nilai dihitung dari model ML yang dilatih data historis BPS 2018–2024.
        {scores?.ikp && (
          <span className="ml-1 font-semibold">
            CV R²={scores.ikp.cv_r2?.toFixed(3)} · MAE={scores.ikp.cv_mae?.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  </div>
);

const MapBtn = ({ children, onClick, className = '' }) => (
  <button onClick={onClick} className={cn('w-9 h-9 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl flex items-center justify-center shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors', className)}>
    {children}
  </button>
);

// ─── Modal generik
export function Modal({ show, onClose, title, children }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}

// ─── Modal cek data BPS
export function ModalCekData({ tahun, hasilCek, sedangCek, onTutup, onLanjutBPS, onLanjutAI }) {
  if (!hasilCek && !sedangCek) return null;
  const { semua_kosong, ada_yang_kosong, dataset_status, bisa_dieksekusi,
          ai_tersedia, ai_model_ready, ai_model_version, kosong } = hasilCek || {};
  const hasAlert   = semua_kosong || ada_yang_kosong;
  const HeaderIcon = sedangCek ? Loader2 : hasAlert ? AlertTriangle : CheckCircle2;
  const headerCls  = sedangCek
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
    : hasAlert
      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'
      : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800';
  const iconCls = sedangCek ? 'text-blue-500 animate-spin' : hasAlert ? 'text-amber-500' : 'text-green-500';
  const title = sedangCek ? `Memeriksa Data BPS Tahun ${tahun}...`
    : semua_kosong    ? `Data BPS Tahun ${tahun} Tidak Tersedia`
    : ada_yang_kosong ? `Sebagian Data BPS Tahun ${tahun} Tidak Tersedia`
    : `Data BPS Tahun ${tahun} Siap`;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className={cn('px-6 py-4 flex items-center gap-3 border-b', headerCls)}>
          <HeaderIcon size={20} className={iconCls} />
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">{title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Pengecekan dataset BPS untuk IKP</div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-2">
          {sedangCek
            ? Object.keys(DATASET_LABELS).map(k => (
                <div key={k} className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Loader2 size={12} className="text-green-400 animate-spin" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{DATASET_LABELS[k]}</span>
                </div>
              ))
            : dataset_status && Object.entries(dataset_status).map(([k, info]) => (
                <div key={k} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg border',
                  info.tersedia ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700')}>
                  {info.tersedia ? <CheckCircle2 size={13} className="text-green-500" /> : <XCircle size={13} className="text-red-400" />}
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">{DATASET_LABELS[k] || info.nama}</span>
                  <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded',
                    info.tersedia ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                                  : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400')}>
                    {info.tersedia ? 'Tersedia' : 'Kosong'}
                  </span>
                </div>
              ))
          }
        </div>
        {!sedangCek && hasAlert && (
          <div className="mx-6 mb-3 px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                  {semua_kosong
                    ? `Semua dataset BPS untuk tahun ${tahun} belum tersedia.`
                    : `Dataset ${kosong?.map(k => DATASET_LABELS[k] || k).join(', ')} tidak tersedia di BPS tahun ${tahun}.`}
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                  Silakan <strong>pilih tahun lain</strong> yang datanya lengkap, atau gunakan{' '}
                  <strong>Prediksi AI</strong> (Random Forest) yang dilatih dari data historis BPS 2018–2024.
                  {ai_model_version && <span className="ml-1 font-semibold">Versi: {ai_model_version}</span>}
                </p>
                {!ai_model_ready && (
                  <p className="text-[11px] text-red-500 mt-1 font-semibold">⚠ Model AI tidak ditemukan — pastikan file .pkl ada di folder ai_models/pangan/</p>
                )}
              </div>
            </div>
          </div>
        )}
        {!sedangCek && (
          <div className="px-6 pb-5 flex gap-2 flex-wrap">
            <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>
              {bisa_dieksekusi ? 'Batal' : 'Pilih Tahun Lain'}
            </Btn>
            {bisa_dieksekusi && (
              <Btn variant="primary" className="flex-1 justify-center" onClick={onLanjutBPS}>
                <Play size={13} /> Lanjutkan BPS
              </Btn>
            )}
            {hasAlert && ai_tersedia && (
              <Btn variant="ai" className="flex-1 justify-center" onClick={onLanjutAI}>
                <Bot size={13} /> Prediksi AI Penuh
              </Btn>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── MapEventHandler (lazy-load untuk SSR)
function MapEventHandler({ setKoordinat }) {
  const [rl, setRl] = useState(null);
  useEffect(() => { import('react-leaflet').then(m => setRl(m)); }, []);
  if (!rl) return null;
  const { useMapEvents } = rl;
  const Inner = () => { useMapEvents({ mousemove: e => setKoordinat({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) }) }); return null; };
  return <Inner />;
}

// ─── Reusable GeoJSON layer props builder (key dipass langsung di JSX, bukan dari sini)
function buildGeoProps(hasilAnalisis, statusTerpilih, provinsiHL) {
  return {
    data: { type: 'FeatureCollection', features: hasilAnalisis.matched_features.features },
    style: feat => {
      const a   = feat.properties?.pangan_analysis || {};
      const vis = statusTerpilih === 'SEMUA' || a.status === statusTerpilih;
      const hl  = provinsiHL === a.nama_provinsi;
      return { fillColor: a.warna || '#cbd5e1', weight: hl ? 3 : 1.5, opacity: vis ? 1 : 0, color: hl ? '#fff' : 'rgba(255,255,255,0.6)', fillOpacity: vis ? 0.82 : 0 };
    },
    onEachFeature: (feat, layer) => {
      const a  = feat.properties?.pangan_analysis || {};
      const dp = a.data_pangan || {};
      const c  = a.warna || '#cbd5e1';
      const aiTag = a.is_prediction ? ' 🤖' : '';
      layer.bindTooltip(
        `<div style="font-family:inherit;padding:3px;min-width:140px;">
          <div style="font-weight:900;font-size:11px;text-transform:uppercase;color:#0f172a;">${a.nama_provinsi || ''}${aiTag}</div>
          <div style="font-size:9px;font-weight:700;color:${c};margin-top:2px;">${a.status || '-'}</div>
          <div style="font-size:8px;color:#64748b;margin-top:1px;">IKP: <strong>${a.ikp ?? '-'}</strong></div>
        </div>`, { sticky: true, opacity: 0.96 }
      );
      layer.bindPopup(
        `<div style="font-family:inherit;min-width:240px;">
          <div style="background:${c};color:white;padding:8px 10px;border-radius:8px 8px 0 0;margin:-1px -1px 8px -1px;">
            <div style="font-weight:900;font-size:12px;">${a.nama_provinsi || ''}${aiTag}</div>
            <div style="font-size:10px;font-weight:700;opacity:0.9;">${a.status || '-'} · IKP: ${a.ikp ?? '-'}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:0 4px 4px;">
            ${[['RPP', dp.rpp], ['PL', dp.pl], ['IK', dp.ik], ['IA', dp.ia]].map(([lbl, val]) => `
              <div style="background:#f8fafc;padding:5px;border-radius:6px;border-left:2px solid ${c};">
                <div style="font-size:7px;color:#94a3b8;font-weight:600;">${lbl}</div>
                <div style="font-size:11px;font-weight:800;color:#1e293b;">${val != null ? Number(val).toFixed(4) : '-'}</div>
              </div>`).join('')}
          </div>
          ${a.is_prediction ? '<div style="font-size:8px;color:#7c3aed;text-align:center;padding:4px;">🤖 Nilai Prediksi AI</div>' : ''}
        </div>`, { maxWidth: 260 }
      );
    },
  };
}

// ─── PetaSection
export default function PetaSection({
  hasilAnalisis, tahunTerpilih, statusTerpilih, setStatusTerpilih,
  sedangMenganalisis, sedangCekData, dataBaruDariBPS,
  onAnalisis, onSimpan, onReset, onPilihTahunDenganTahun,
  leafletReady, MapCont, TileLay, GeoComp,
  petaRef, basemap, setBasemap,
  koordinat, setKoordinat,
  provinsiHL, setProvinsiHL,
  searchOpen, setSearchOpen, searchQuery, setSearchQuery,
  suggestions, handleSearch,
  daftarTersimpan, onMuatTahun,
  TAHUN_TERSEDIA,
}) {
  const [showBasemap,  setShowBasemap]  = useState(false);
  const [menuFilter,   setMenuFilter]   = useState(false);
  const [showTahunNav, setShowTahunNav] = useState(false);
  const [isMaximize, setIsMaximize] = useState(false);
  const isAI = hasilAnalisis?.is_ai_prediction;

  // ─── Kontrol Kiri (Zoom + Basemap + Search) — dipakai di kedua mode
  const KontrolKiri = () => (
    <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
      <MapBtn onClick={() => petaRef.current?.zoomIn()} className="font-bold text-xl text-slate-700 dark:text-slate-200 leading-none">+</MapBtn>
      <MapBtn onClick={() => petaRef.current?.zoomOut()} className="font-bold text-xl text-slate-700 dark:text-slate-200 leading-none">−</MapBtn>
      <div className="relative">
        <MapBtn onClick={() => setShowBasemap(!showBasemap)}>
          <Map size={14} className="text-slate-600 dark:text-slate-300" />
        </MapBtn>
        {showBasemap && (
          <div className="absolute left-full ml-2 top-0 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl z-[500] border border-slate-200 dark:border-slate-700 py-1">
            <div className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Basemap</div>
            {Object.entries(BASEMAPS).map(([k, bm]) => (
              <button key={k} onClick={() => { setBasemap(k); setShowBasemap(false); }}
                className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors', basemap === k ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                {bm.label} {basemap === k && <Check size={12} />}
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
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-green-500 outline-none" />
                <button onClick={() => handleSearch()} className="bg-green-600 hover:bg-green-700 text-white px-2 rounded-lg transition-colors"><Search size={12} /></button>
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); setProvinsiHL(null); }} className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-2 rounded-lg hover:bg-slate-300 transition-colors"><X size={12} /></button>
              </div>
              {suggestions.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 max-h-36 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => handleSearch(s.nama)}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between text-xs transition-colors">
                      <span className="text-slate-900 dark:text-slate-200">{s.nama}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold ml-2" style={{ backgroundColor: s.warna + '20', color: s.warna }}>{s.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <MapBtn onClick={() => setSearchOpen(true)}><Search size={13} className="text-slate-600 dark:text-slate-300" /></MapBtn>
          )}
        </div>
      )}
    </div>
  );

  // ─── Navigator Tahun tengah atas — dipakai di kedua mode
  const NavTahun = () => (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400]">
      <div className="relative">
        <button onClick={() => setShowTahunNav(!showTahunNav)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
          <Calendar size={12} className="text-slate-400" />
          {hasilAnalisis ? `Tahun ${hasilAnalisis.tahun || tahunTerpilih}` : `Tahun ${tahunTerpilih}`}
          <ChevronDown size={11} className={cn('text-slate-400 transition-transform', showTahunNav && 'rotate-180')} />
        </button>
        {showTahunNav && (
          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[500] overflow-hidden py-1">
            {(TAHUN_TERSEDIA || []).slice().reverse().map(th => {
              const savedBPS = daftarTersimpan.filter(item => item.tahun === th && !item.is_ai_prediction);
              const hasSaved = savedBPS.length > 0;
              const isActive = hasilAnalisis?.tahun === th;
              return (
                <button key={th}
                  onClick={() => { setShowTahunNav(false); hasSaved ? onMuatTahun(savedBPS[0].analysis_id, savedBPS[0].tahun) : onPilihTahunDenganTahun(th); }}
                  className={cn('w-full flex items-center justify-between px-4 py-2 text-sm transition-colors', isActive ? 'bg-slate-100 dark:bg-slate-700 font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                  <span>{th}</span>
                  {hasSaved && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ─── Action Buttons tengah bawah — dipakai di kedua mode
  const ActionButtons = () => (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] flex gap-2">
      <Btn onClick={onAnalisis} disabled={sedangMenganalisis || sedangCekData} variant="primary"
        className="px-5 uppercase tracking-wider text-xs shadow-xl whitespace-nowrap"
        style={{ boxShadow: '0 10px 30px rgba(22,163,74,0.30)' }}>
        {(sedangCekData || sedangMenganalisis) ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {sedangCekData ? 'Memeriksa...' : sedangMenganalisis ? 'Memproses...' : 'Analisis Pangan'}
      </Btn>
      {dataBaruDariBPS && hasilAnalisis && (
        <Btn variant="save" onClick={onSimpan} className="px-5 uppercase tracking-wider text-xs shadow-xl shadow-emerald-600/30">
          <Save size={13} /> Simpan
        </Btn>
      )}
      {hasilAnalisis?.is_ai_prediction && (
        <Btn variant="ai" onClick={onSimpan} className="px-5 uppercase tracking-wider text-xs shadow-xl shadow-purple-600/30">
          <Save size={13} /> Simpan AI
        </Btn>
      )}
      {hasilAnalisis && (
        <Btn variant="danger" onClick={onReset} className="px-5 uppercase tracking-wider text-xs shadow-xl">
          <RotateCcw size={13} /> Reset
        </Btn>
      )}
    </div>
  );

  // ─── Legenda + Filter kanan atas — dipakai di kedua mode
  const LegendaKanan = () => (
    <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2 items-end">
      {/* Koordinat */}
      <div className="bg-white/95 dark:bg-slate-800/90 px-3 py-1.5 rounded-lg shadow border border-slate-200 dark:border-slate-600">
        <div className="text-[10px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <span className="text-green-600 dark:text-green-400 font-bold">Lat:</span> {koordinat.lat} |{' '}
          <span className="text-green-600 dark:text-green-400 font-bold">Lng:</span> {koordinat.lng}
        </div>
      </div>

      {/* Legenda status */}
      <div className="bg-white/95 dark:bg-slate-800/90 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 min-w-[110px]">
        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status IKP</div>
        {Object.entries(STATUS_PANGAN).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.warna }} />
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{v.label}</span>
          </div>
        ))}
        <div className="relative mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <button onClick={() => setMenuFilter(!menuFilter)}
            className="w-full flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <Filter size={9} /> {statusTerpilih} <ChevronDown size={9} />
          </button>
          {menuFilter && (
            <div className="absolute bottom-full mb-1 right-0 w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-[500] py-1">
              {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(s => (
                <button key={s} onClick={() => { setStatusTerpilih(s); setMenuFilter(false); }}
                  className={cn('w-full text-left px-3 py-1.5 text-[10px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-700', statusTerpilih === s ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300')}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ════════════════════════════════════════════
          Maximize OVERLAY
      ════════════════════════════════════════════ */}
      {isMaximize && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col overflow-hidden"
          style={{ height: '100dvh', width: '100vw', top: 0, left: 0 }}
        >
          {/* Peta — flex-1 min-h-0 agar tidak overflow */}
          <div className="relative flex-1 min-h-0">
            {leafletReady && MapCont && (
              <MapCont center={[-2.5, 118]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={petaRef}>
                <TileLay key={basemap} url={BASEMAPS[basemap].url} attribution={BASEMAPS[basemap].attribution} />
                <MapEventHandler setKoordinat={setKoordinat} />
                {hasilAnalisis?.matched_features?.features && (
                  <GeoComp key={`fs-${hasilAnalisis.tahun}-${statusTerpilih}-${provinsiHL}`} {...buildGeoProps(hasilAnalisis, statusTerpilih, provinsiHL)} />
                )}
              </MapCont>
            )}

            <KontrolKiri />
            <NavTahun />

            {/* Kanan atas: Koordinat + Legenda */}
            <LegendaKanan />

            {/* ── Tombol Restore — pojok kiri bawah ── */}
            <div className="absolute bottom-4 left-4 z-[400]">
              <button
                onClick={() => setIsMaximize(false)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-400 transition-all active:scale-95 group"
              >
                <Minimize2 size={13} className="text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors" />
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
      <Card className={cn('overflow-hidden', isAI ? 'border-2 border-purple-300 dark:border-purple-700' : 'border-2')}>
        {isAI && (
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-700">
            <Bot size={13} className="text-purple-500" />
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Prediksi AI — {hasilAnalisis?.source}</span>
            <span className="ml-auto text-[10px] text-purple-400">
              CV R²={hasilAnalisis?.model_scores?.ikp?.cv_r2?.toFixed(3)} · MAE={hasilAnalisis?.model_scores?.ikp?.cv_mae?.toFixed(4)}
            </span>
          </div>
        )}
        <div className="relative" style={{ height: isAI ? 496 : 520 }}>
          {leafletReady && MapCont && (
            <MapCont center={[-2.5, 118]} zoom={5} className="h-full w-full" zoomControl={false} ref={petaRef}>
              <TileLay key={basemap} url={BASEMAPS[basemap].url} attribution={BASEMAPS[basemap].attribution} />
              <MapEventHandler setKoordinat={setKoordinat} />
              {hasilAnalisis?.matched_features?.features && (
                <GeoComp key={`${hasilAnalisis.tahun}-${statusTerpilih}-${provinsiHL}`} {...buildGeoProps(hasilAnalisis, statusTerpilih, provinsiHL)} />
              )}
            </MapCont>
          )}

          <KontrolKiri />
          <NavTahun />

          {/* Kanan atas: Koordinat + Legenda (tanpa tombol keluar) */}
          <LegendaKanan />

          {/* ── Tombol Maximize — pojok kiri bawah ── */}
          <div className="absolute bottom-4 left-4 z-[400]">
            <button
              onClick={() => setIsMaximize(true)}
              title="Buka peta Maximize"
              className="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-400 transition-all active:scale-95 group"
            >
              <Maximize2 size={13} className="text-slate-600 dark:text-slate-300 group-hover:text-green-600 transition-colors" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-green-600 transition-colors">Maximize</span>
            </button>
          </div>

          <ActionButtons />
        </div>
      </Card>
    </>
  );
}