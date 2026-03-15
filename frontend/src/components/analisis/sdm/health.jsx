"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronDown, X, Heart, Info, Table, FileText, ClipboardList,
  Calendar, Loader2, CheckCircle2, XCircle, AlertTriangle, BarChart2,
  Activity, Check, TrendingUp, TrendingDown, Play,
  Download, Database, Droplets, Shield, Stethoscope,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ─── CONSTANTS ───────────────────────────────────────────────
export const TAHUN_TERSEDIA = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

export const KATEGORI_KESEHATAN = {
  KRITIS:  { warna: "#ef4444", label: "KRITIS"  },
  WASPADA: { warna: "#f59e0b", label: "WASPADA" },
  STABIL:  { warna: "#10b981", label: "STABIL"  },
};

export const DATASET_LABELS_KESEHATAN = {
  AHH:       "Angka Harapan Hidup (AHH)",
  IMUNISASI: "Cakupan Imunisasi Dasar Lengkap",
  SANITASI:  "Akses Sanitasi Layak",
};

export const INDIKATOR_LABELS_KESEHATAN = {
  ALL:       "Semua Indikator",
  AHH:       "Angka Harapan Hidup",
  IMUNISASI: "Cakupan Imunisasi",
  SANITASI:  "Akses Sanitasi",
};

export const INDIKATOR_ICON_MAP_KESEHATAN = {
  ALL:       <Stethoscope size={13} />,
  AHH:       <Heart size={13} />,
  IMUNISASI: <Shield size={13} />,
  SANITASI:  <Droplets size={13} />,
};

export const INDIKATOR_COLORS_KESEHATAN = {
  ALL:       '#10b981',
  AHH:       '#ef4444',
  IMUNISASI: '#3b82f6',
  SANITASI:  '#14b8a6',
};

export const BASEMAPS = {
  CARTO_LIGHT:    { label: "Carto Light",   url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",              attribution: '&copy; OpenStreetMap &copy; CARTO', preview: "bg-slate-100"  },
  CARTO_DARK:     { label: "Carto Dark",    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",               attribution: '&copy; OpenStreetMap &copy; CARTO', preview: "bg-slate-800"  },
  OSM:            { label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",                          attribution: '&copy; OpenStreetMap',              preview: "bg-green-100"  },
  ESRI_SATELLITE: { label: "Satelit",       url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri', preview: "bg-stone-700" },
  TOPO:           { label: "Topografi",     url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",                            attribution: '&copy; OpenTopoMap',               preview: "bg-amber-100"  },
  CARTO_VOYAGER:  { label: "Voyager",       url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",    attribution: '&copy; OpenStreetMap &copy; CARTO', preview: "bg-blue-50"    },
};

export const PUSAT_DEFAULT        = [-2.5, 118];
export const ZOOM_DEFAULT         = 5;
export const PANEL_HEIGHT_DEFAULT = 340;
export const PANEL_HEIGHT_MIN     = 48;
export const PANEL_HEIGHT_MAX     = 520;

// ─── HELPERS ─────────────────────────────────────────────────
export const dbToUI = (ind) => (ind === 'ALL' || !ind) ? 'SEMUA' : ind;

export function getWarnaByIndikatorKesehatan(fitur, ind) {
  const a  = fitur.properties?.health_analysis || {};
  const dk = a.data_kesehatan || {};

  if (ind === 'SEMUA') return a.warna || "#cbd5e1";

  // Threshold inline (harus konsisten dengan backend)
  if (ind === 'AHH') {
    const v = dk.AHH;
    if (v == null) return "#cbd5e1";
    return v >= 72 ? KATEGORI_KESEHATAN.STABIL.warna : v >= 68 ? KATEGORI_KESEHATAN.WASPADA.warna : KATEGORI_KESEHATAN.KRITIS.warna;
  }
  if (ind === 'IMUNISASI') {
    const v = dk.IMUNISASI;
    if (v == null) return "#cbd5e1";
    return v >= 90 ? KATEGORI_KESEHATAN.STABIL.warna : v >= 80 ? KATEGORI_KESEHATAN.WASPADA.warna : KATEGORI_KESEHATAN.KRITIS.warna;
  }
  if (ind === 'SANITASI') {
    const v = dk.SANITASI;
    if (v == null) return "#cbd5e1";
    return v >= 85 ? KATEGORI_KESEHATAN.STABIL.warna : v >= 70 ? KATEGORI_KESEHATAN.WASPADA.warna : KATEGORI_KESEHATAN.KRITIS.warna;
  }
  return a.warna || "#cbd5e1";
}

export function getKategoriByIndikatorKesehatan(fitur, ind) {
  const a  = fitur.properties?.health_analysis || {};
  const dk = a.data_kesehatan || {};

  if (ind === 'SEMUA') return a.kategori || null;

  if (ind === 'AHH') {
    const v = dk.AHH;
    if (v == null) return null;
    return v >= 72 ? 'STABIL' : v >= 68 ? 'WASPADA' : 'KRITIS';
  }
  if (ind === 'IMUNISASI') {
    const v = dk.IMUNISASI;
    if (v == null) return null;
    return v >= 90 ? 'STABIL' : v >= 80 ? 'WASPADA' : 'KRITIS';
  }
  if (ind === 'SANITASI') {
    const v = dk.SANITASI;
    if (v == null) return null;
    return v >= 85 ? 'STABIL' : v >= 70 ? 'WASPADA' : 'KRITIS';
  }
  return a.kategori || null;
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-4 py-3 text-xs">
      <div className="font-bold text-slate-900 dark:text-white mb-2">Tahun {label}</div>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── MODAL: CEK DATA ─────────────────────────────────────────
export function ModalCekDataKesehatan({ tahun, indikator, hasilCek, sedangCek, onTutup, onLanjut }) {
  if (!hasilCek && !sedangCek) return null;

  const { semua_kosong, ada_yang_kosong, dataset_status, kosong, bisa_dieksekusi } = hasilCek || {};
  const labelInd = INDIKATOR_LABELS_KESEHATAN[indikator] || 'Semua Indikator';

  const KEYS_LOADING = {
    ALL: ['AHH', 'IMUNISASI', 'SANITASI'],
    AHH: ['AHH'], IMUNISASI: ['IMUNISASI'], SANITASI: ['SANITASI'],
  };
  const keysLoading = KEYS_LOADING[indikator] || KEYS_LOADING.ALL;

  const headerColor = sedangCek
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30'
    : semua_kosong
    ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30'
    : ada_yang_kosong
    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30'
    : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30';

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        <div className={`px-6 py-5 flex items-center gap-3 border-b ${headerColor}`}>
          {sedangCek ? <Loader2 size={20} className="text-blue-500 animate-spin flex-shrink-0" />
           : semua_kosong ? <XCircle size={20} className="text-red-500 flex-shrink-0" />
           : ada_yang_kosong ? <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
           : <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />}
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {sedangCek
                ? `Memeriksa Data Tahun ${tahun}...`
                : semua_kosong
                ? `Data Tahun ${tahun} Tidak Tersedia`
                : ada_yang_kosong
                ? `Sebagian Data Tahun ${tahun} Tidak Tersedia`
                : `Data Tahun ${tahun} Siap`}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{labelInd}</p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-2">
          {sedangCek
            ? keysLoading.map(k => (
                <div key={k} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
                  <span className="text-xs text-slate-500 flex-1">{DATASET_LABELS_KESEHATAN[k]}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Mengecek...</span>
                </div>
              ))
            : dataset_status && Object.entries(dataset_status).map(([k, info]) => (
                <div key={k} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${info.tersedia ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                  {info.tersedia ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" /> : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">{DATASET_LABELS_KESEHATAN[k] || info.nama}</span>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${info.tersedia ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {info.tersedia ? 'Tersedia' : 'Kosong'}
                  </span>
                </div>
              ))
          }
          {!sedangCek && !bisa_dieksekusi && (
            <div className={`mt-2 p-3.5 rounded-lg border-l-4 ${semua_kosong ? 'bg-red-50 dark:bg-red-900/10 border-red-500' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-500'}`}>
              <p className={`text-xs leading-relaxed ${semua_kosong ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {semua_kosong
                  ? `Seluruh dataset "${labelInd}" tahun ${tahun} tidak tersedia di BPS.`
                  : `Dataset kosong: ${kosong?.map(k => DATASET_LABELS_KESEHATAN[k]).join(', ')}.`}
              </p>
            </div>
          )}
        </div>

        {!sedangCek && (
          <div className="px-6 pb-5 flex gap-3">
            <button onClick={onTutup} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">
              {bisa_dieksekusi ? 'Batal' : 'Pilih Tahun Lain'}
            </button>
            {bisa_dieksekusi && (
              <button onClick={onLanjut} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                Lanjutkan Analisis
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL: KOMBO TIDAK ADA ───────────────────────────────────
export function ModalAlertKomboTidakAdaKesehatan({ info, onTutup, onAmbilDariBPS }) {
  if (!info) return null;
  const { tahun, indikator } = info;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 bg-amber-50 dark:bg-amber-900/20 flex items-center gap-3 border-b border-amber-100 dark:border-amber-800/30">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={17} className="text-amber-500" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">Data Belum Tersedia di Database</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-slate-400">{INDIKATOR_ICON_MAP_KESEHATAN[indikator]}</span>
              <span className="text-xs text-slate-500">{INDIKATOR_LABELS_KESEHATAN[indikator]}</span>
              <span className="text-slate-300 text-xs">·</span>
              <Calendar size={11} className="text-slate-400" />
              <span className="text-xs text-slate-500">Tahun {tahun}</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Data <strong className="text-slate-800 dark:text-slate-100">{INDIKATOR_LABELS_KESEHATAN[indikator]}</strong> tahun{' '}
            <strong className="text-slate-800 dark:text-slate-100">{tahun}</strong> belum pernah dianalisis dan disimpan di database.
          </p>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/40 flex items-start gap-2.5">
            <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              Klik <strong>"Ambil dari BPS"</strong> untuk mengambil data langsung dari BPS Web API.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onTutup} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Batal</button>
          <button onClick={() => onAmbilDariBPS(tahun, indikator)}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
            <Play size={13} /> Ambil dari BPS
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SELECTOR ANALISIS KESEHATAN ──────────────────────────────
export function SelectorAnalisisKesehatan({ hasilAnalisis, kombinasiTersedia, tahunTerpilih, onPilih, sedangMuatAwal }) {
  const [terbukaTahun, setTerbukaTahun]         = useState(false);
  const [terbukaIndikator, setTerbukaIndikator] = useState(false);
  const wrapRef = useRef(null);

  const activeInd = hasilAnalisis?.indikator || 'ALL';
  const activeThn = hasilAnalisis?.tahun      || tahunTerpilih;

  useEffect(() => {
    const h = (e) => { if (!wrapRef.current?.contains(e.target)) { setTerbukaTahun(false); setTerbukaIndikator(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (sedangMuatAwal) return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 h-10 px-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
      <Loader2 size={13} className="text-emerald-400 animate-spin" />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Memuat data...</span>
    </div>
  );

  return (
    <div ref={wrapRef} className="flex items-stretch shadow-md rounded-lg">
      {/* Indikator */}
      <div className="relative">
        <button onClick={() => { setTerbukaIndikator(!terbukaIndikator); setTerbukaTahun(false); }}
          className={`flex items-center gap-2.5 h-10 px-4 min-w-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-l-lg text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 transition-colors select-none ${terbukaIndikator ? 'bg-slate-50' : ''}`}>
          <span className="text-slate-400 flex-shrink-0">{INDIKATOR_ICON_MAP_KESEHATAN[activeInd]}</span>
          <span className="flex-1 text-left truncate">{INDIKATOR_LABELS_KESEHATAN[activeInd]}</span>
          <ChevronDown size={13} className={`text-slate-400 flex-shrink-0 transition-transform duration-150 ${terbukaIndikator ? 'rotate-180' : ''}`} />
        </button>
        {terbukaIndikator && (
          <div className="absolute top-full left-0 mt-1 min-w-[230px] bg-white dark:bg-slate-800 rounded-lg shadow-xl z-[1010] border border-slate-200 dark:border-slate-700 overflow-hidden py-1">
            {['ALL','AHH','IMUNISASI','SANITASI'].map(ind => {
              const ada      = TAHUN_TERSEDIA.some(th => !!kombinasiTersedia[`${th}|${ind}`]);
              const isActive = activeInd === ind;
              return (
                <button key={ind} onClick={() => { setTerbukaIndikator(false); onPilih(activeThn, ind); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>
                  <span className={isActive ? 'text-emerald-500' : 'text-slate-400'}>{INDIKATOR_ICON_MAP_KESEHATAN[ind]}</span>
                  <span className="flex-1">{INDIKATOR_LABELS_KESEHATAN[ind]}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {ada && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {isActive && <Check size={13} className="text-emerald-500" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

      {/* Tahun */}
      <div className="relative">
        <button onClick={() => { setTerbukaTahun(!terbukaTahun); setTerbukaIndikator(false); }}
          className={`flex items-center gap-2.5 h-10 px-4 min-w-[130px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-0 rounded-r-lg text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 transition-colors select-none ${terbukaTahun ? 'bg-slate-50' : ''}`}>
          <Calendar size={13} className="text-slate-400 flex-shrink-0" />
          <span className="flex-1 text-left">Tahun {activeThn}</span>
          <ChevronDown size={13} className={`text-slate-400 flex-shrink-0 transition-transform duration-150 ${terbukaTahun ? 'rotate-180' : ''}`} />
        </button>
        {terbukaTahun && (
          <div className="absolute top-full right-0 mt-1 min-w-[160px] bg-white dark:bg-slate-800 rounded-lg shadow-xl z-[1010] border border-slate-200 dark:border-slate-700 overflow-hidden py-1">
            {TAHUN_TERSEDIA.slice().reverse().map(th => {
              const ada      = ['ALL','AHH','IMUNISASI','SANITASI'].some(ind => !!kombinasiTersedia[`${th}|${ind}`]);
              const isActive = activeThn === th;
              return (
                <button key={th} onClick={() => { setTerbukaTahun(false); onPilih(th, activeInd); }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}>
                  <span>{th}</span>
                  <span className="flex items-center gap-1.5">
                    {ada && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {isActive && <Check size={13} className="text-emerald-500" />}
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

// ─── PANEL TREND ─────────────────────────────────────────────
export function TrendPanelKesehatan({ daftarTersimpan, onTutup }) {
  const [filterInd, setFilterInd] = useState('ALL');
  const [chartMode, setChartMode] = useState('distribusi');

  const trendData = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(item => {
      const ind = item.indikator || 'ALL';
      const key = `${item.tahun}|${ind}`;
      if (!map[key] || item.timestamp > map[key].timestamp) map[key] = item;
    });
    const byInd = {};
    Object.values(map).forEach(item => {
      const ind = item.indikator || 'ALL';
      if (!byInd[ind]) byInd[ind] = [];
      byInd[ind].push({
        tahun:   item.tahun,
        STABIL:  item.kategori_distribusi?.STABIL  ?? 0,
        WASPADA: item.kategori_distribusi?.WASPADA ?? 0,
        KRITIS:  item.kategori_distribusi?.KRITIS  ?? 0,
        TOTAL:   item.total_success ?? 0,
      });
    });
    Object.keys(byInd).forEach(ind => byInd[ind].sort((a, b) => a.tahun - b.tahun));
    return byInd;
  }, [daftarTersimpan]);

  const chartData     = trendData[filterInd] || [];
  const indsAvailable = Object.keys(trendData).filter(k => trendData[k].length > 0);
  const tahunCovered  = [...new Set(daftarTersimpan.map(d => d.tahun).filter(Boolean))].sort();
  const latestData    = chartData[chartData.length - 1];
  const delta         = chartData.length >= 2
    ? { STABIL: chartData.at(-1).STABIL - chartData.at(-2).STABIL, KRITIS: chartData.at(-1).KRITIS - chartData.at(-2).KRITIS }
    : null;

  const radarData = useMemo(() => ['STABIL','WASPADA','KRITIS'].map(kat => {
    const obj = { kategori: kat };
    indsAvailable.forEach(ind => {
      const s = trendData[ind];
      if (s?.length) obj[INDIKATOR_LABELS_KESEHATAN[ind]] = s.at(-1)[kat] ?? 0;
    });
    return obj;
  }), [trendData, indsAvailable]);

  const DeltaBadge = ({ val, positif = true }) => {
    if (val == null || val === 0) return <span className="text-[9px] text-slate-400">—</span>;
    const good = (val > 0 && positif) || (val < 0 && !positif);
    return (
      <span className={`flex items-center gap-0.5 text-[9px] font-bold ${good ? 'text-green-600' : 'text-red-500'}`}>
        {val > 0 ? <TrendingUp size={9}/> : <TrendingDown size={9}/>} {val > 0 ? `+${val}` : val}
      </span>
    );
  };

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-emerald-500" size={22} />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Panel Tren Kesehatan</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {daftarTersimpan.length} analisis · {tahunCovered.length} tahun ({tahunCovered.join(', ')})
              </p>
            </div>
          </div>
          <button onClick={onTutup} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={17} className="text-slate-500" /></button>
        </div>

        {daftarTersimpan.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4"><TrendingUp size={28} className="text-emerald-400" /></div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada data tersimpan</p>
            <p className="text-xs text-slate-400 mt-1">Jalankan analisis dan simpan untuk melihat tren</p>
          </div>
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label:'Total Analisis',  val: daftarTersimpan.length,     color:'emerald' },
                { label:'Tahun Tercakup',  val: tahunCovered.length,        color:'blue'    },
                { label:'STABIL Terbaru',  val: latestData?.STABIL  ?? '-', color:'green',  delta: delta?.STABIL,  positif: true  },
                { label:'KRITIS Terbaru',  val: latestData?.KRITIS  ?? '-', color:'red',    delta: delta?.KRITIS,  positif: false },
              ].map(c => (
                <div key={c.label} className={`bg-${c.color}-50 dark:bg-${c.color}-900/20 rounded-xl p-3 border border-${c.color}-200 dark:border-${c.color}-800`}>
                  <div className={`text-[10px] font-semibold text-${c.color}-600 dark:text-${c.color}-400 mb-1`}>{c.label}</div>
                  <div className={`text-2xl font-black text-${c.color}-700 dark:text-${c.color}-300`}>{c.val}</div>
                  {c.delta != null && <DeltaBadge val={c.delta} positif={c.positif} />}
                </div>
              ))}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {['ALL','AHH','IMUNISASI','SANITASI'].map(ind => {
                  const ada = indsAvailable.includes(ind);
                  return (
                    <button key={ind} onClick={() => ada && setFilterInd(ind)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${filterInd === ind ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : ada ? 'text-slate-500 hover:text-slate-700' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}>
                      <span style={{ color: filterInd === ind ? INDIKATOR_COLORS_KESEHATAN[ind] : undefined }}>
                        {INDIKATOR_ICON_MAP_KESEHATAN[ind]}
                      </span>
                      {ind === 'ALL' ? 'Semua' : ind}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 ml-auto">
                {[['distribusi','Bar',<BarChart2 size={12}/>],['area','Area',<TrendingUp size={12}/>],['radar','Radar',<Activity size={12}/>],['table','Tabel',<Table size={12}/>]].map(([key,lbl,icon]) => (
                  <button key={key} onClick={() => setChartMode(key)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700'}`}>
                    {icon} {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Charts + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                {chartData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data untuk indikator ini</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {chartMode === 'distribusi' && 'Distribusi Kategori per Tahun'}
                          {chartMode === 'area'       && 'Tren Kumulatif Kategori'}
                          {chartMode === 'radar'      && 'Perbandingan Lintas Indikator'}
                          {chartMode === 'table'      && 'Riwayat Analisis Tersimpan'}
                        </div>
                        <div className="text-[10px] text-slate-500">{INDIKATOR_LABELS_KESEHATAN[filterInd]} · {chartData.length} titik data</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {[['bg-green-400','STABIL'],['bg-amber-400','WASPADA'],['bg-red-400','KRITIS']].map(([cls,lbl]) => (
                          <div key={lbl} className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${cls}`}/><span className="text-[10px] text-slate-500">{lbl}</span></div>
                        ))}
                      </div>
                    </div>

                    {chartMode === 'distribusi' && (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                          <XAxis dataKey="tahun" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="STABIL"  name="STABIL"  stackId="a" fill="#10b981" />
                          <Bar dataKey="WASPADA" name="WASPADA" stackId="a" fill="#f59e0b" />
                          <Bar dataKey="KRITIS"  name="KRITIS"  stackId="a" fill="#ef4444" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    {chartMode === 'area' && (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                          <defs>
                            {[['gStabil','#10b981'],['gWaspada','#f59e0b'],['gKritis','#ef4444']].map(([id,clr]) => (
                              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={clr} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={clr} stopOpacity={0}/>
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                          <XAxis dataKey="tahun" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          {[['STABIL','#10b981','gStabil'],['WASPADA','#f59e0b','gWaspada'],['KRITIS','#ef4444','gKritis']].map(([key,clr,grad]) => (
                            <Area key={key} type="monotone" dataKey={key} name={key} stroke={clr} strokeWidth={2} fill={`url(#${grad})`} dot={{ r:3, fill:clr }} />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                    {chartMode === 'radar' && (
                      <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={radarData} margin={{ top:10, right:20, left:20, bottom:10 }}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="kategori" tick={{ fontSize:10, fill:'#94a3b8' }} />
                          <PolarRadiusAxis angle={90} domain={[0,34]} tick={{ fontSize:9, fill:'#94a3b8' }} />
                          {indsAvailable.map(ind => (
                            <Radar key={ind} name={INDIKATOR_LABELS_KESEHATAN[ind]} dataKey={INDIKATOR_LABELS_KESEHATAN[ind]}
                              stroke={INDIKATOR_COLORS_KESEHATAN[ind]} fill={INDIKATOR_COLORS_KESEHATAN[ind]} fillOpacity={0.15} strokeWidth={2} />
                          ))}
                          <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize:'10px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    )}
                    {chartMode === 'table' && (
                      <div className="overflow-x-auto max-h-52 overflow-y-auto">
                        <table className="w-full text-left min-w-[400px]">
                          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700">
                            <tr className="text-[10px] font-semibold text-slate-500 uppercase">
                              {['Tahun','Indikator','STABIL','WASPADA','KRITIS','Total'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {chartData.map((row, i) => (
                              <tr key={i} className="hover:bg-white dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-3 py-2 text-xs font-bold text-slate-900 dark:text-white">{row.tahun}</td>
                                <td className="px-3 py-2"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: INDIKATOR_COLORS_KESEHATAN[filterInd]+'20', color: INDIKATOR_COLORS_KESEHATAN[filterInd] }}>{filterInd}</span></td>
                                <td className="px-3 py-2 text-xs font-bold text-green-600">{row.STABIL}</td>
                                <td className="px-3 py-2 text-xs font-bold text-amber-600">{row.WASPADA}</td>
                                <td className="px-3 py-2 text-xs font-bold text-red-600">{row.KRITIS}</td>
                                <td className="px-3 py-2 text-xs font-semibold text-slate-600">{row.TOTAL}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sidebar */}
              <div className="flex flex-col gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">% Provinsi STABIL (Terbaru)</div>
                  <div className="space-y-2.5">
                    {indsAvailable.map(ind => {
                      const last  = trendData[ind].at(-1);
                      const total = (last.STABIL + last.WASPADA + last.KRITIS) || 1;
                      const pct   = Math.round((last.STABIL / total) * 100);
                      return (
                        <div key={ind}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span style={{ color: INDIKATOR_COLORS_KESEHATAN[ind] }}>{INDIKATOR_ICON_MAP_KESEHATAN[ind]}</span>
                              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{ind}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-900 dark:text-white">{pct}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width:`${pct}%`, background:'linear-gradient(90deg,#10b981,#34d399)' }} />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-400 mt-0.5"><span>{last.STABIL} STABIL</span><span>{last.KRITIS} KRITIS</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {delta && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800">
                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-2.5">Perubahan vs Periode Sebelumnya</div>
                    {[['Prov. STABIL', delta.STABIL, true],['Prov. KRITIS', -delta.KRITIS, true]].map(([lbl,val,pos]) => (
                      <div key={lbl} className="flex items-center justify-between py-1.5 border-b border-emerald-100 dark:border-emerald-800/40 last:border-0">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{lbl}</span>
                        <DeltaBadge val={val} positif={pos} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cakupan Tahun</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TAHUN_TERSEDIA.map(thn => {
                      const ada = tahunCovered.includes(thn);
                      return (
                        <div key={thn} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${ada ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                          {thn}{ada && ' ✓'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Total line chart */}
            {chartData.length >= 2 && (
              <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">Total Provinsi Teranalisis per Tahun</div>
                <div className="text-[10px] text-slate-500 mb-3">{INDIKATOR_LABELS_KESEHATAN[filterInd]}</div>
                <ResponsiveContainer width="100%" height={90}>
                  <LineChart data={chartData} margin={{ top:4, right:16, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                    <XAxis dataKey="tahun" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} domain={['dataMin-2','dataMax+2']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="TOTAL" name="Total Provinsi" stroke={INDIKATOR_COLORS_KESEHATAN[filterInd]} strokeWidth={2.5}
                      dot={{ r:4, fill:INDIKATOR_COLORS_KESEHATAN[filterInd], strokeWidth:2, stroke:'#fff' }} activeDot={{ r:6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── PANEL METADATA ──────────────────────────────────────────
export function MetadataPanelKesehatan({
  hasilAnalisis, indikatorTerpilih, tahunTerpilih,
  loadingDataset, onTutup, onUnduhDataset,
  menuDatasetTerbuka, setMenuDatasetTerbuka,
}) {
  const ind = hasilAnalisis?.indikator || 'ALL';

  const ScoreBox = ({ label, range, score, color }) => (
    <div className={`bg-white dark:bg-slate-900 rounded-lg p-3 border border-${color}-200 dark:border-${color}-700`}>
      <div className={`text-[10px] font-bold text-${color}-600 dark:text-${color}-400 mb-0.5`}>{label}</div>
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{range}</div>
      <div className={`mt-1 text-[10px] font-black text-${color}-600`}>Skor {score}</div>
    </div>
  );

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="text-emerald-500" size={22} />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Metadata & Metode Analisis Kesehatan</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Penjelasan lengkap indikator, bobot, dan cara perhitungan</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button onClick={() => setMenuDatasetTerbuka(!menuDatasetTerbuka)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm">
                <Download size={12} /> Dataset
              </button>
              {menuDatasetTerbuka && (
                <div className="absolute top-full mt-1 right-0 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700 py-1">
                  {[
                    ['ALL',       'Semua Dataset',      <Database size={12} className="text-emerald-500"/>],
                    ['AHH',       'Dataset AHH',        <Heart size={12} className="text-red-500"/>],
                    ['IMUNISASI', 'Dataset Imunisasi',  <Shield size={12} className="text-blue-500"/>],
                    ['SANITASI',  'Dataset Sanitasi',   <Droplets size={12} className="text-teal-500"/>],
                  ].map(([k, lbl, icon]) => (
                    <button key={k} onClick={() => onUnduhDataset(k)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                      {icon} {lbl} {loadingDataset?.[k] && '(Memproses...)'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onTutup} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={17} className="text-slate-500" /></button>
          </div>
        </div>

        {/* Sumber Data */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5"><Database size={13} className="text-slate-500"/> Sumber Data — BPS Web API Tahun {hasilAnalisis?.tahun || tahunTerpilih}</div>
          <div className="space-y-1.5">
            {(ind === 'ALL' || ind === 'AHH')       && <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0"/><span><strong>AHH</strong> — BPS Susenas, Variabel 501. Angka harapan hidup saat lahir (laki-laki & perempuan) per provinsi, dirata-rata.</span></div>}
            {(ind === 'ALL' || ind === 'IMUNISASI') && <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"/><span><strong>Imunisasi</strong> — BPS Susenas, Variabel 2280. Persentase balita imunisasi dasar lengkap per provinsi.</span></div>}
            {(ind === 'ALL' || ind === 'SANITASI')  && <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0"/><span><strong>Sanitasi</strong> — BPS, Variabel 847. Persentase rumah tangga dengan akses sanitasi layak per provinsi.</span></div>}
          </div>
        </div>

        {/* Alasan Pembobotan (hanya ALL) */}
        {ind === 'ALL' && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-1.5"><BarChart2 size={13}/> Mengapa Bobot 40% · 35% · 25%?</div>
            <div className="space-y-3">
              {[
                { label:'AHH — Bobot 40%', color:'red', alasan:'AHH mendapat bobot terbesar karena merupakan outcome indikator paling komprehensif, mencerminkan efektivitas keseluruhan sistem kesehatan. AHH juga menjadi komponen IPM (Indeks Pembangunan Manusia) nasional sehingga paling relevan untuk kebijakan makro.' },
                { label:'Imunisasi — Bobot 35%', color:'blue', alasan:'Imunisasi adalah intervensi preventif paling cost-effective. Cakupan tinggi mencegah KLB dan melindungi herd immunity. Bobot tinggi karena mencerminkan kualitas program preventif dengan dampak jangka panjang terhadap generasi mendatang.' },
                { label:'Sanitasi — Bobot 25%', color:'teal', alasan:'Sanitasi merupakan indikator infrastruktur (input) dasar. Bobotnya lebih kecil karena merupakan prasyarat, bukan outcome langsung, meski tetap krusial untuk pencegahan penyakit menular dan kesehatan lingkungan jangka panjang.' },
              ].map(({ label, color, alasan }) => (
                <div key={label} className={`flex gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border-l-4 border-${color}-400`}>
                  <div className="flex-1">
                    <div className={`text-[11px] font-bold text-${color}-700 dark:text-${color}-300 mb-1`}>{label}</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{alasan}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono font-semibold">IKK = (AHH × 0.40) + (Imunisasi × 0.35) + (Sanitasi × 0.25)</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Skor tiap indikator: 3=STABIL · 2=WASPADA · 1=KRITIS &nbsp;|&nbsp; STABIL ≥ 2.4 · WASPADA ≥ 1.8 · KRITIS &lt; 1.8</p>
            </div>
          </div>
        )}

        {/* Detail per indikator */}
        <div className="space-y-4">
          {(ind === 'ALL' || ind === 'AHH') && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border-l-4 border-red-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Heart size={15} className="text-red-500"/><h5 className="text-sm font-bold text-red-900 dark:text-red-100">Angka Harapan Hidup (AHH)</h5></div>
                <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded font-semibold">{ind === 'ALL' ? 'Bobot 40%' : 'Indikator Tunggal'}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 mb-3 border border-red-200 dark:border-red-700">
                <div className="text-[10px] font-bold text-red-600 mb-1.5">📐 CARA HITUNG</div>
                <ol className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li><span className="font-semibold">1.</span> Ambil AHH laki-laki dan perempuan dari BPS Susenas per provinsi.</li>
                  <li><span className="font-semibold">2.</span> Rata-rata: <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded text-red-700 dark:text-red-300">(AHH_L + AHH_P) / 2</code></li>
                  <li><span className="font-semibold">3.</span> Konversi ke skor 1–3 berdasarkan threshold.</li>
                </ol>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreBox label="STABIL"  range="> 72 tahun"  score={3} color="green"/>
                <ScoreBox label="WASPADA" range="68–72 tahun" score={2} color="yellow"/>
                <ScoreBox label="KRITIS"  range="< 68 tahun"  score={1} color="red"/>
              </div>
              <p className="text-[10px] text-red-600 dark:text-red-400 mt-2">🎯 Acuan: target nasional AHH ≥ 72 tahun (SDGs Goal 3).</p>
            </div>
          )}

          {(ind === 'ALL' || ind === 'IMUNISASI') && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Shield size={15} className="text-blue-500"/><h5 className="text-sm font-bold text-blue-900 dark:text-blue-100">Cakupan Imunisasi Dasar Lengkap</h5></div>
                <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded font-semibold">{ind === 'ALL' ? 'Bobot 35%' : 'Indikator Tunggal'}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 mb-3 border border-blue-200 dark:border-blue-700">
                <div className="text-[10px] font-bold text-blue-600 mb-1.5">📐 CARA HITUNG</div>
                <ol className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li><span className="font-semibold">1.</span> Ambil persentase balita imunisasi dasar lengkap dari BPS Susenas per provinsi.</li>
                  <li><span className="font-semibold">2.</span> Bandingkan dengan threshold: &gt;90%→3, 80–90%→2, &lt;80%→1.</li>
                </ol>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreBox label="STABIL"  range="> 90%"  score={3} color="green"/>
                <ScoreBox label="WASPADA" range="80–90%" score={2} color="yellow"/>
                <ScoreBox label="KRITIS"  range="< 80%"  score={1} color="red"/>
              </div>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">🎯 Target WHO: cakupan imunisasi ≥ 95% untuk herd immunity optimal.</p>
            </div>
          )}

          {(ind === 'ALL' || ind === 'SANITASI') && (
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border-l-4 border-teal-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Droplets size={15} className="text-teal-500"/><h5 className="text-sm font-bold text-teal-900 dark:text-teal-100">Akses Sanitasi Layak</h5></div>
                <span className="text-[10px] px-2 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded font-semibold">{ind === 'ALL' ? 'Bobot 25%' : 'Indikator Tunggal'}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 mb-3 border border-teal-200 dark:border-teal-700">
                <div className="text-[10px] font-bold text-teal-600 mb-1.5">📐 CARA HITUNG</div>
                <ol className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li><span className="font-semibold">1.</span> Ambil persentase rumah tangga dengan akses sanitasi layak dari BPS per provinsi.</li>
                  <li><span className="font-semibold">2.</span> Bandingkan dengan threshold: &gt;85%→3, 70–85%→2, &lt;70%→1.</li>
                </ol>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreBox label="STABIL"  range="> 85%"  score={3} color="green"/>
                <ScoreBox label="WASPADA" range="70–85%" score={2} color="yellow"/>
                <ScoreBox label="KRITIS"  range="< 70%"  score={1} color="red"/>
              </div>
            </div>
          )}
        </div>

        {/* Catatan Validitas */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-1.5"><AlertTriangle size={13}/> Catatan Validitas & Keterbatasan</div>
          <ul className="space-y-1 text-[11px] text-amber-700 dark:text-amber-300">
            <li>• Data BPS Susenas diambil melalui API resmi; nilai dapat berbeda jika BPS merilis revisi di luar siklus tahunan.</li>
            <li>• AHH menggunakan rata-rata sederhana laki-laki dan perempuan, sesuai standar BPS dan praktik internasional.</li>
            <li>• Pembobotan IKK bersifat normatif dan dapat disesuaikan dengan kebijakan masing-masing instansi.</li>
            <li>• Tahun data mengikuti TAHUN_BPS_MAP (2020–2026); ketersediaan data aktual tergantung pada publikasi BPS.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}