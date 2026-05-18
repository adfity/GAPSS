"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  X, Calendar, Loader2, BarChart2, Check,
  Home, Wheat, BookOpen, ShoppingCart, Heart,
  Search, Save, AlertTriangle, CheckCircle2, XCircle,
  Brain, Play, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar  from '@/components/layout/HeaderBar';
import SideBar    from '@/components/layout/sideBar';
import Footerauth from '@/components/layout/footerauth';
import PetaPangan, {
  getWarnaIKP, getKategoriIKP,
  TAHUN_AKTUAL_IKP, TAHUN_OLS_IKP,
  INDIKATOR_LABELS_IKP, INDIKATOR_COLORS_IKP, INDIKATOR_ICON_IKP,
  DATASET_LABELS_IKP, ZOOM_DEFAULT_IKP, KATEGORI_IKP,
} from '@/components/analisis/pangan/petaPangan';
import TabsPangan from '@/components/analisis/pangan/tabPangan';

// Mapping keys yang dicek per indikator
const KEYS_LOADING_MAP = {
  SEMUA:          ['KETERSEDIAAN', 'KETERJANGKAUAN', 'PEMANFAATAN'],
  KETERSEDIAAN:   ['KETERSEDIAAN'],
  KETERJANGKAUAN: ['KETERJANGKAUAN'],
  PEMANFAATAN:    ['PEMANFAATAN'],
};

const cn = (...cls) => cls.filter(Boolean).join(' ');

const Card = ({ children, className = '' }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm', className)}>{children}</div>
);

const Btn = ({ children, variant = 'primary', className = '', ...props }) => {
  const v = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    ghost:   'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600',
  };
  return (
    <button className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50', v[variant], className)} {...props}>
      {children}
    </button>
  );
};

// ─── MODAL CEK DATA ────────────────────────────────────────────────────────────
function ModalCekData_IKP({ tahun, indikator, hasilCek, sedangCek, onTutup, onLanjutAktual, onLanjutPrediksi, onGantiTahun }) {
  if (!hasilCek && !sedangCek) return null;

  const {
    dataset_status = {}, kolom_aktual = [], kolom_prediksi = [],
    kolom_kosong = [], ada_prediksi, semua_aktual, bisa_dieksekusi,
    pesan_peringatan, ols_metrics = {},
  } = hasilCek || {};

  const keysLoading = KEYS_LOADING_MAP[indikator] || KEYS_LOADING_MAP.SEMUA;

  const semuaAktual = !sedangCek && semua_aktual && bisa_dieksekusi;
  const adaPrediksi = !sedangCek && ada_prediksi && bisa_dieksekusi;
  const adaKosong   = !sedangCek && kolom_kosong.length > 0 && !bisa_dieksekusi;

  const headerCls = sedangCek
    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200'
    : semuaAktual
    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200'
    : adaPrediksi
    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200'
    : 'bg-red-50 dark:bg-red-900/30 border-red-200';

  const headerIcon = sedangCek
    ? <Loader2 size={18} className="text-blue-500 animate-spin flex-shrink-0"/>
    : semuaAktual
    ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0"/>
    : adaPrediksi
    ? <AlertTriangle size={18} className="text-amber-500 flex-shrink-0"/>
    : <XCircle size={18} className="text-red-500 flex-shrink-0"/>;

  const headerTitle = sedangCek
    ? `Memeriksa ketersediaan data tahun ${tahun}...`
    : semuaAktual
    ? `✅ Semua data aktual tersedia Tahun ${tahun}`
    : adaPrediksi
    ? `⚠️ Ada data yang perlu prediksi Tahun ${tahun}`
    : `❌ Data tidak tersedia Tahun ${tahun}`;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className={`px-5 py-4 flex items-center gap-3 border-b ${headerCls} flex-shrink-0`}>
          {headerIcon}
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">{headerTitle}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{INDIKATOR_LABELS_IKP[indikator] || 'Semua Aspek'}</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {sedangCek
            ? keysLoading.map(k => (
                <div key={k} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0"/>
                  <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{DATASET_LABELS_IKP[k] || k}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">Mengecek...</span>
                </div>
              ))
            : Object.entries(dataset_status).map(([k, info]) => {
                const isAktual   = info.sumber === 'aktual';
                const isPrediksi = info.sumber === 'prediksi';
                const isTidakAda = !info.tersedia;
                return (
                  <div key={k} className={cn('flex items-start gap-3 px-3 py-3 rounded-xl border',
                    isAktual     ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                    : isPrediksi ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700')}>
                    {isAktual     ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
                     : isPrediksi ? <Brain size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                     : <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5"/>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{info.label || DATASET_LABELS_IKP[k] || k}</span>
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                          isAktual     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : isPrediksi ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300')}>
                          {isAktual ? `✓ Aktual (${info.jumlah_aktual} prov)` : isPrediksi ? '📈 Prediksi Regresi Linear' : 'Tidak Ada'}
                        </span>
                      </div>
                      {isPrediksi && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Tidak tersedia di aktual Bapanas → akan diisi prediksi Regresi Linear OLS
                          {ols_metrics[k]?.mape_pct != null && (
                            <span className="ml-1 font-semibold">· MAPE {ols_metrics[k].mape_pct.toFixed(2)}%</span>
                          )}
                        </p>
                      )}
                      {isTidakAda && (
                        <p className="text-xs text-red-600 dark:text-red-300 mt-1">Tidak tersedia di aktual maupun prediksi.</p>
                      )}
                    </div>
                  </div>
                );
              })
          }

          {/* Kotak peringatan prediksi */}
          {!sedangCek && adaPrediksi && (
            <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">
                    Beberapa data tidak tersedia di database aktual Bapanas
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    {pesan_peringatan || 'Data akan dilengkapi menggunakan prediksi Regresi Linear OLS berdasarkan tren historis.'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {kolom_prediksi.map(k => (
                      <span key={k} className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600">
                        📈 {DATASET_LABELS_IKP[k] || k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!sedangCek && adaKosong && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
              <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                Data tidak tersedia di aktual Bapanas maupun prediksi. Coba pilih tahun yang berbeda.
              </p>
            </div>
          )}

          {!sedangCek && semuaAktual && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0"/>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Semua data tersedia dari aktual Bapanas. Analisis siap dijalankan.
              </p>
            </div>
          )}
        </div>

        {/* Footer tombol */}
        {!sedangCek && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2.5 flex-shrink-0">
            {semuaAktual && (
              <div className="flex gap-2">
                <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
                <button onClick={onLanjutAktual}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
                  <Play size={13}/> Mulai Analisis
                </button>
              </div>
            )}

            {adaPrediksi && (
              <>
                <button onClick={onLanjutPrediksi}
                  className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
                  <Brain size={14}/> Lanjutkan dengan Prediksi OLS
                  <span className="text-xs opacity-80 ml-1">({kolom_prediksi.join(', ')} → Prediksi)</span>
                </button>
                <button onClick={onGantiTahun}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
                  <Calendar size={13}/> Pilih Tahun Lain (Data Aktual)
                </button>
              </>
            )}

            {adaKosong && (
              <button onClick={onGantiTahun}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
                <Calendar size={13}/> Pilih Tahun Lain
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL ANALISIS ────────────────────────────────────────────────────────────
function ModalAnalisis({ terbuka, onTutup, tahunTerpilih, setTahunTerpilih, pilihanIndikator, setPilihanIndikator, onCek, sedangMenganalisis }) {
  if (!terbuka) return null;
  const SEMUA_TAHUN = [...TAHUN_AKTUAL_IKP, ...TAHUN_OLS_IKP].sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onTutup}/>
      <div className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[92dvh]">
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"/>
        </div>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Pilih Tahun & Aspek IKP</h3>
          <button onClick={onTutup} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X size={16} className="text-slate-500"/>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Pilih Tahun */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              <Calendar size={13}/> Pilih Tahun
            </label>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
              Sistem akan mengecek data aktual Bapanas terlebih dahulu. Jika kosong, ada opsi prediksi OLS.
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {SEMUA_TAHUN.map(th => {
                const isPrediksi = th > 2024;
                return (
                  <button key={th} onClick={() => setTahunTerpilih(th)}
                    className={cn('px-1 py-2 rounded-lg text-xs font-bold border-2 transition-all text-center',
                      tahunTerpilih === th
                        ? 'bg-green-600 border-green-600 text-white'
                        : isPrediksi
                        ? 'border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-400'
                        : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-green-300')}>
                    {th}
                    {isPrediksi && <div className="text-[7px] opacity-60">pred</div>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 dark:text-slate-500">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"/><span>Aktual Bapanas</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"/><span>Mungkin ada prediksi</span></div>
            </div>
          </div>

          {/* Pilih Aspek/Indikator */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Aspek IKP</label>
            <div className="space-y-2">
              {[
                { key: 'SEMUA',          label: 'IKP Gabungan',        desc: '(Ketersediaan × 0,335) + (Keterjangkauan × 0,330) + (Pemanfaatan × 0,335)', icon: <BarChart2 size={15}/> },
                { key: 'KETERSEDIAAN',   label: 'Ketersediaan Pangan', desc: 'Skor Ketersediaan (dari Bapanas, skala 0–100)', icon: <Wheat size={15}/> },
                { key: 'KETERJANGKAUAN', label: 'Keterjangkauan',      desc: 'Skor Keterjangkauan (dari Bapanas, skala 0–100)', icon: <ShoppingCart size={15}/> },
                { key: 'PEMANFAATAN',    label: 'Pemanfaatan Pangan',  desc: 'Skor Pemanfaatan (dari Bapanas, skala 0–100)', icon: <Heart size={15}/> },
              ].map(opt => (
                <button key={opt.key} onClick={() => setPilihanIndikator(opt.key)}
                  className={cn('w-full p-3.5 rounded-xl border-2 transition-all text-left flex items-center gap-3',
                    pilihanIndikator === opt.key
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 bg-white dark:bg-slate-800')}>
                  <span className="flex-shrink-0" style={{ color: pilihanIndikator === opt.key ? INDIKATOR_COLORS_IKP[opt.key] : '#94a3b8' }}>
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">{opt.desc}</p>
                  </div>
                  {pilihanIndikator === opt.key && <Check size={15} className="text-green-500 flex-shrink-0"/>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex gap-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={() => onCek()} disabled={sedangMenganalisis}>
            <Search size={13}/> Cek Data {tahunTerpilih}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL SIMPAN ─────────────────────────────────────────────────────────────
function ModalSimpan({ terbuka, onTutup, namaSimpan, setNamaSimpan, onSimpan, sedangMenyimpan, hasilAnalisis, tahunTerpilih }) {
  if (!terbuka) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Simpan Analisis IKP</h3>
          <button onClick={onTutup} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} className="text-slate-500"/></button>
        </div>
        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Nama Analisis</label>
        <input type="text" value={namaSimpan} onChange={e => setNamaSimpan(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && onSimpan()}
          placeholder={`IKP ${INDIKATOR_LABELS_IKP[hasilAnalisis?.indikator || 'SEMUA']} ${hasilAnalisis?.tahun || tahunTerpilih}`}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-green-500 outline-none text-sm mb-5"/>
        <div className="flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={onSimpan} disabled={sedangMenyimpan || !namaSimpan.trim()}>
            {sedangMenyimpan ? 'Menyimpan...' : <><Save size={13}/> Simpan</>}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── PAGE UTAMA ────────────────────────────────────────────────────────────────
export default function PanganPage() {
  const API = 'http://127.0.0.1:8000/api';

  const [hasilAnalisis,        setHasilAnalisis]        = useState(null);
  const [kategoriTerpilih,     setKategoriTerpilih]     = useState('SEMUA');
  const [indikatorTerpilih,    setIndikatorTerpilih]    = useState('SEMUA');
  const [isClient,             setIsClient]             = useState(false);
  const [activeTab,            setActiveTab]            = useState('info');
  const [daftarTersimpan,      setDaftarTersimpan]      = useState([]);
  const [sedangMuatAwal,       setSedangMuatAwal]       = useState(true);
  const [dataBaruDianalisis,   setDataBaruDianalisis]   = useState(false);
  const [tahunTerpilih,        setTahunTerpilih]        = useState(2024);
  const [sedangMenganalisis,   setSedangMenganalisis]   = useState(false);
  const [sedangCekData,        setSedangCekData]        = useState(false);
  const [hasilCekData,         setHasilCekData]         = useState(null);
  const [pilihanIndikator,     setPilihanIndikator]     = useState('SEMUA');
  const [pernahAnalisis,       setPernahAnalisis]       = useState(false);
  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [modalSaveTerbuka,     setModalSaveTerbuka]     = useState(false);
  const [namaSimpan,           setNamaSimpan]           = useState('');
  const [sedangMenyimpan,      setSedangMenyimpan]      = useState(false);
  const [basemap,              setBasemap]              = useState('OSM');
  const [koordinatCursor,      setKoordinatCursor]      = useState({ lat: '0.0000', lng: '0.0000' });
  const [currentZoom,          setCurrentZoom]          = useState(ZOOM_DEFAULT_IKP);
  const [provinsiDipilih,      setProvinsiDipilih]      = useState(null);
  const [leafletReady,         setLeafletReady]         = useState(false);
  const [MapCont,              setMapCont]              = useState(null);
  const [TileLay,              setTileLay]              = useState(null);
  const [GeoComp,              setGeoComp]              = useState(null);
  const [activeAnalysisId,     setActiveAnalysisId]     = useState(null);

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

  // Hitung kombinasi unik yang tersimpan (tahun + indikator)
  const kombinasiTersedia = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(a => {
      const ind = a.indikator || 'SEMUA';
      const key = `${a.tahun}|${ind}`;
      if (!map[key] || a.timestamp > map[key].timestamp)
        map[key] = { timestamp: a.timestamp, analysis_id: a.analysis_id };
    });
    return map;
  }, [daftarTersimpan]);

  // Hitung jumlah per kategori IKP (6 + tidak teranalisis)
  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return {};
    const counts = {
      SANGAT_RENTAN: 0, RENTAN: 0, AGAK_RENTAN: 0,
      AGAK_TAHAN: 0, TAHAN: 0, SANGAT_TAHAN: 0, TIDAK_TERANALISIS: 0,
    };
    hasilAnalisis.matched_features.features.forEach(fitur => {
      const kat = getKategoriIKP(fitur, indikatorTerpilih);
      if (counts[kat] !== undefined) counts[kat]++;
    });
    return counts;
  }, [hasilAnalisis, indikatorTerpilih]);

  const refreshDB = async () => {
    try {
      const r = await axios.get(`${API}/ikp-analysis/list/`);
      setDaftarTersimpan(r.data.results || []);
    } catch {}
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/ikp-analysis/list/`);
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (!list.length) return;
      // Prioritas: IKP Gabungan (SEMUA) → tahun terbaru
      const sorted = [...list].sort((a, b) => {
        const ai = (a.indikator || 'SEMUA') === 'SEMUA' ? 0 : 1;
        const bi = (b.indikator || 'SEMUA') === 'SEMUA' ? 0 : 1;
        if (ai !== bi) return ai - bi;
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
      await muatDetail(sorted[0].analysis_id, sorted[0].tahun, sorted[0].indikator || 'SEMUA', true);
    } catch (e) { console.error(e); }
    finally { setSedangMuatAwal(false); }
  };

  const muatDetail = async (id, tahun, indikator, silent = false) => {
    const tid = silent ? null : toast.loading('Memuat analisis...');
    try {
      const res = await axios.get(`${API}/ikp-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setIndikatorTerpilih(indikator || res.data.indikator || 'SEMUA');
      setPilihanIndikator(indikator || res.data.indikator || 'SEMUA');
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDianalisis(false);
      setActiveAnalysisId(id);
      if (!silent) toast.success(`Data dimuat: ${INDIKATOR_LABELS_IKP[indikator || 'SEMUA']} ${tahun}`);
    } catch (e) {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error('Gagal memuat analisis');
      throw e;
    }
  };

  const handlePilihKombo = async (tahun, indikator) => {
    const key = `${tahun}|${indikator}`;
    if (!kombinasiTersedia[key]) {
      setTahunTerpilih(tahun);
      setPilihanIndikator(indikator);
      cekDanAnalisis(indikator, tahun);
      return;
    }
    await muatDetail(kombinasiTersedia[key].analysis_id, tahun, indikator);
  };

  const cekDanAnalisis = async (indikator = null, tahun = null) => {
    const pilihan = indikator || pilihanIndikator;
    const thn     = tahun    || tahunTerpilih;
    pendingRef.current = { pilihan, tahunFetch: thn, gunakan_prediksi: false };
    setModalAnalisisTerbuka(false);
    setSedangCekData(true);
    setHasilCekData(null);
    try {
      const r = await axios.post(`${API}/check-ikp-data/`, { tahun: thn });
      setHasilCekData(r.data);
    } catch {
      toast.error('Gagal memeriksa ketersediaan data');
    } finally {
      setSedangCekData(false);
    }
  };

  const jalankanAnalisis = async (gunakan_prediksi = false) => {
    if (!pendingRef.current) return;
    const { pilihan, tahunFetch } = pendingRef.current;
    setHasilCekData(null);
    setSedangMenganalisis(true);
    setKategoriTerpilih('SEMUA');
    setActiveAnalysisId(null);
    const tid = toast.loading(`Menganalisis IKP tahun ${tahunFetch}...`);
    try {
      const r = await axios.post(`${API}/analyze-ikp/`, {
        tahun:             tahunFetch,
        gunakan_prediksi:  gunakan_prediksi,
      });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setIndikatorTerpilih(pilihan);
        setTahunTerpilih(tahunFetch);
        setPernahAnalisis(true);
        setDataBaruDianalisis(true);
        setActiveTab('info');
        const src = r.data.ada_prediksi ? '📈 Aktual+Prediksi' : '✅ Aktual Bapanas';
        toast.success(`Berhasil: ${r.data.total_success} provinsi (${tahunFetch}) · ${src}`, { duration: 5000 });
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal terhubung ke server');
    } finally {
      setSedangMenganalisis(false);
    }
  };

  const simpan = async () => {
    if (!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const r = await axios.post(`${API}/save-ikp-analysis/`, {
        name: namaSimpan,
        analysis_data: hasilAnalisis,
      });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false);
        setNamaSimpan('');
        setDataBaruDianalisis(false);
        setActiveAnalysisId(r.data.analysis_id);
        await refreshDB();
      }
    } catch {
      toast.dismiss(tid);
      toast.error('Gagal menyimpan');
    } finally {
      setSedangMenyimpan(false);
    }
  };

  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nama });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r   = hasilAnalisis.analysis_summary || [];
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const tgl = new Date().toISOString().split('T')[0];
    const src = hasilAnalisis.ada_prediksi ? '_AktualPlusPrediksi' : '_AktualBapanas';

    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi:         '' + i.provinsi,
        Kategori:         i.kategori_label || i.kategori,
        'IKP (0-100)':    i.ikp,
        Prioritas:        i.prioritas,
        Ketersediaan:     i.ketersediaan != null ? i.ketersediaan.toFixed(2) : '-',
        Keterjangkauan:   i.keterjangkauan != null ? i.keterjangkauan.toFixed(2) : '-',
        Pemanfaatan:      i.pemanfaatan != null ? i.pemanfaatan.toFixed(2) : '-',
        Sumber:           i.sumber || '-',
        'Kolom Prediksi': (i.kolom_prediksi || []).join(', ') || '-',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'IKP');
      XLSX.writeFile(wb, `Analisis_IKP_${thn}${src}_${tgl}.xlsx`);
      toast.success('Excel diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }), `Analisis_IKP_${thn}${src}_${tgl}.json`);
      toast.success('JSON diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi', 'Kategori', 'IKP', 'Prioritas', 'Ketersediaan', 'Keterjangkauan', 'Pemanfaatan', 'Sumber', 'Kolom_Prediksi'].join(','),
        ...r.map(s => [
          s.provinsi, s.kategori_label || s.kategori, s.ikp, s.prioritas,
          s.ketersediaan != null ? s.ketersediaan.toFixed(2) : '-',
          s.keterjangkauan != null ? s.keterjangkauan.toFixed(2) : '-',
          s.pemanfaatan != null ? s.pemanfaatan.toFixed(2) : '-',
          s.sumber || '-', (s.kolom_prediksi || []).join(';') || '-',
        ].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv], { type: 'text/csv' }), `Analisis_IKP_${thn}${src}_${tgl}.csv`);
      toast.success('CSV diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' }), `Spasial_IKP_${thn}${src}_${tgl}.geojson`);
      toast.success('GeoJSON diunduh');
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>

      {/* Modal Cek Data */}
      <ModalCekData_IKP
        tahun={pendingRef.current?.tahunFetch || tahunTerpilih}
        indikator={pendingRef.current?.pilihan || pilihanIndikator}
        hasilCek={hasilCekData}
        sedangCek={sedangCekData}
        onTutup={() => setHasilCekData(null)}
        onLanjutAktual={() => jalankanAnalisis(false)}
        onLanjutPrediksi={() => jalankanAnalisis(true)}
        onGantiTahun={() => {
          setHasilCekData(null);
          setPilihanIndikator(pendingRef.current?.pilihan || 'SEMUA');
          setModalAnalisisTerbuka(true);
        }}
      />

      {/* Modal Analisis */}
      <ModalAnalisis
        terbuka={modalAnalisisTerbuka}
        onTutup={() => setModalAnalisisTerbuka(false)}
        tahunTerpilih={tahunTerpilih}
        setTahunTerpilih={setTahunTerpilih}
        pilihanIndikator={pilihanIndikator}
        setPilihanIndikator={setPilihanIndikator}
        onCek={cekDanAnalisis}
        sedangMenganalisis={sedangMenganalisis}
      />

      {/* Modal Simpan */}
      <ModalSimpan
        terbuka={modalSaveTerbuka}
        onTutup={() => setModalSaveTerbuka(false)}
        namaSimpan={namaSimpan}
        setNamaSimpan={setNamaSimpan}
        onSimpan={simpan}
        sedangMenyimpan={sedangMenyimpan}
        hasilAnalisis={hasilAnalisis}
        tahunTerpilih={tahunTerpilih}
      />

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">
          {/* Header halaman */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-7 pb-5 gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Wheat size={22} className="text-green-500"/>
                Indeks Ketahanan Pangan (IKP)
              </h1>
              {hasilAnalisis?.ada_prediksi && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                  style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderColor: '#fcd34d', color: '#92400e' }}>
                  <Brain size={12}/> Ada Data Prediksi
                </span>
              )}
            </div>
            <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-400">
              <Home size={12}/> <span>›</span> <span>Analisis</span> <span>›</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">Ketahanan Pangan</span>
            </nav>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={30} className="text-green-500 animate-spin"/>
                <p className="text-sm text-slate-500">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaPangan
                hasilAnalisis={hasilAnalisis}
                tahunTerpilih={tahunTerpilih}
                indikatorTerpilih={indikatorTerpilih}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                sedangMenganalisis={sedangMenganalisis}
                sedangCekData={sedangCekData}
                dataBaruDianalisis={dataBaruDianalisis}
                pernahAnalisis={pernahAnalisis}
                onAnalisis={() => pernahAnalisis ? cekDanAnalisis() : (setPilihanIndikator('SEMUA'), setModalAnalisisTerbuka(true))}
                onSimpan={() => { setNamaSimpan(''); setModalSaveTerbuka(true); }}
                onReset={() => {
                  setHasilAnalisis(null); setKategoriTerpilih('SEMUA'); setIndikatorTerpilih('SEMUA');
                  setProvinsiDipilih(null); setPernahAnalisis(false); setDataBaruDianalisis(false); setActiveAnalysisId(null);
                  toast.success('Analisis IKP direset');
                }}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef} basemap={basemap} setBasemap={setBasemap}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                kombinasiTersedia={kombinasiTersedia} onPilihKombo={handlePilihKombo}
                sedangMuatAwal={false}
                jumlahKategori={jumlahKategori}
                getWarna={getWarnaIKP}
                getKategori={getKategoriIKP}
              />

              <TabsPangan
                activeTab={activeTab} setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori}
                indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunTerpilih} daftarTersimpan={daftarTersimpan}
                eksporData={eksporData}
                getWarna={getWarnaIKP} getKategori={getKategoriIKP}
                analysisId={activeAnalysisId}
              />
            </div>
          )}
        </div>
      </main>
      <Footerauth/>
    </div>
  );
}