"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Play, Download, Plus, Minus, ChevronDown, Filter, Save, X,
  GraduationCap, RotateCcw, Database, ChevronUp, Info, Table, FileText,
  ClipboardList, Search, Eye, EyeOff, Activity, Map, Calendar, Loader2,
  CheckCircle2, XCircle, AlertTriangle, BarChart2, BookOpen, Users, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";

//─ Konfigurasi─
const KATEGORI = {
  KRITIS: { warna: "#ef4444", label: "KRITIS" },
  SEDANG: { warna: "#f59e0b", label: "SEDANG" },
  BAIK:   { warna: "#10b981", label: "BAIK"   },
};

const TAHUN_TERSEDIA = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

const DATASET_LABELS = {
  RLS: "Rata-rata Lama Sekolah (RLS)",
  APS: "Angka Partisipasi Sekolah (APS)",
  SD:  "Rasio Murid-Guru - SD",
  SMP: "Rasio Murid-Guru - SMP",
  SMA: "Rasio Murid-Guru - SMA",
  SMK: "Rasio Murid-Guru - SMK",
};

const INDIKATOR_LABELS = {
  ALL:   'Semua Indikator',
  RLS:   'Rata-rata Lama Sekolah',
  APS:   'Angka Partisipasi Sekolah',
  RASIO: 'Rasio Murid-Guru',
};

const INDIKATOR_ICON_MAP = {
  ALL:   <BarChart2     size={13} />,
  RLS:   <BookOpen      size={13} />,
  APS:   <GraduationCap size={13} />,
  RASIO: <Users         size={13} />,
};

//─ Basemap─
const BASEMAPS = {
  CARTO_LIGHT:   { label: "Carto Light",   url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",              attribution: '&copy; OpenStreetMap &copy; CARTO', preview: "bg-slate-100" },
  CARTO_DARK:    { label: "Carto Dark",    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",               attribution: '&copy; OpenStreetMap &copy; CARTO', preview: "bg-slate-800" },
  OSM:           { label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",                          attribution: '&copy; OpenStreetMap',              preview: "bg-green-100" },
  ESRI_SATELLITE:{ label: "Satelit",       url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: 'Tiles &copy; Esri', preview: "bg-stone-700" },
  TOPO:          { label: "Topografi",     url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",                            attribution: '&copy; OpenTopoMap',               preview: "bg-amber-100" },
  CARTO_VOYAGER: { label: "Voyager",       url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",    attribution: '&copy; OpenStreetMap &copy; CARTO', preview: "bg-blue-50"  },
};

const PUSAT_DEFAULT        = [-2.5, 118];
const ZOOM_DEFAULT         = 5;
const PANEL_HEIGHT_DEFAULT = 340;
const PANEL_HEIGHT_MIN     = 48;
const PANEL_HEIGHT_MAX     = 520;

//─ Helpers─
const dbToUI = (ind) => (ind === 'ALL' || !ind) ? 'SEMUA' : ind;

function getWarnaByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') return fitur.properties?.education_analysis?.warna || "#cbd5e1";
  const dp = fitur.properties?.education_analysis?.data_pendidikan || {};
  if (indikatorTerpilih === 'RLS') {
    const v = dp.RLS; if (v == null) return "#cbd5e1";
    return v > 9.5 ? KATEGORI.BAIK.warna : v >= 8.0 ? KATEGORI.SEDANG.warna : KATEGORI.KRITIS.warna;
  }
  if (indikatorTerpilih === 'APS') {
    const v = dp.SKOR_APS; if (v == null) return "#cbd5e1";
    return v >= 2.4 ? KATEGORI.BAIK.warna : v >= 1.8 ? KATEGORI.SEDANG.warna : KATEGORI.KRITIS.warna;
  }
  if (indikatorTerpilih === 'RASIO') {
    const v = dp.RASIO_RATA; if (v == null) return "#cbd5e1";
    return v < 12 ? KATEGORI.BAIK.warna : v <= 16 ? KATEGORI.SEDANG.warna : KATEGORI.KRITIS.warna;
  }
  return fitur.properties?.education_analysis?.warna || "#cbd5e1";
}

function getKategoriByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') return fitur.properties?.education_analysis?.kategori || null;
  const dp = fitur.properties?.education_analysis?.data_pendidikan || {};
  if (indikatorTerpilih === 'RLS')   { const v = dp.RLS;       if (v == null) return null; return v > 9.5 ? 'BAIK' : v >= 8.0 ? 'SEDANG' : 'KRITIS'; }
  if (indikatorTerpilih === 'APS')   { const v = dp.SKOR_APS;  if (v == null) return null; return v >= 2.4 ? 'BAIK' : v >= 1.8 ? 'SEDANG' : 'KRITIS'; }
  if (indikatorTerpilih === 'RASIO') { const v = dp.RASIO_RATA; if (v == null) return null; return v < 12 ? 'BAIK' : v <= 16 ? 'SEDANG' : 'KRITIS'; }
  return fitur.properties?.education_analysis?.kategori || null;
}

//─ MODAL: Cek Ketersediaan Data
function ModalCekData({ tahun, indikator, hasilCek, sedangCek, onTutup, onLanjut }) {
  if (!hasilCek && !sedangCek) return null;
  const { semua_kosong, ada_yang_kosong, dataset_status, kosong, bisa_dieksekusi } = hasilCek || {};
  const labelIndikator = INDIKATOR_LABELS[indikator] || 'Semua Indikator';
  const INDIKATOR_KEYS = { ALL: ['RLS','APS','SD','SMP','SMA','SMK'], RLS: ['RLS'], APS: ['APS'], RASIO: ['SD','SMP','SMA','SMK'] };
  const keysLoading = INDIKATOR_KEYS[indikator] || INDIKATOR_KEYS.ALL;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        <div className={`px-6 py-5 flex items-center gap-3 border-b ${
          sedangCek ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30' :
          semua_kosong ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30' :
          ada_yang_kosong ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30' :
          'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30'
        }`}>
          {sedangCek    ? <Loader2      size={20} className="text-blue-500 animate-spin flex-shrink-0" />
          : semua_kosong ? <XCircle     size={20} className="text-red-500 flex-shrink-0" />
          : ada_yang_kosong ? <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
          : <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />}
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {sedangCek ? `Memeriksa Data Tahun ${tahun}...`
              : semua_kosong ? `Data Tahun ${tahun} Tidak Tersedia`
              : ada_yang_kosong ? `Sebagian Data Tahun ${tahun} Tidak Tersedia`
              : `Data Tahun ${tahun} Siap`}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{labelIndikator}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-2">
          {sedangCek
            ? keysLoading.map(key => (
                <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">{DATASET_LABELS[key]}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Mengecek...</span>
                </div>
              ))
            : dataset_status && Object.entries(dataset_status).map(([key, info]) => (
                <div key={key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  info.tersedia
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                }`}>
                  {info.tersedia
                    ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                    : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">{DATASET_LABELS[key]}</span>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex-shrink-0 ${
                    info.tersedia
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}>{info.tersedia ? 'Tersedia' : 'Kosong'}</span>
                </div>
              ))
          }
          {!sedangCek && !bisa_dieksekusi && (
            <div className={`mt-2 p-3.5 rounded-lg border-l-4 ${semua_kosong ? 'bg-red-50 dark:bg-red-900/10 border-red-500' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-500'}`}>
              <p className={`text-xs leading-relaxed ${semua_kosong ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {semua_kosong
                  ? `Seluruh dataset untuk "${labelIndikator}" tahun ${tahun} tidak memiliki data di BPS. Silakan pilih tahun lain.`
                  : `Dataset tidak tersedia: ${kosong?.map(k => DATASET_LABELS[k]).join(', ')}. Pilih tahun lain.`}
              </p>
            </div>
          )}
        </div>

        {!sedangCek && (
          <div className="px-6 pb-5 flex gap-3">
            <button onClick={onTutup} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              {bisa_dieksekusi ? 'Batal' : 'Pilih Tahun Lain'}
            </button>
            {bisa_dieksekusi && (
              <button onClick={onLanjut} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                Lanjutkan Analisis
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

//─ MODAL: Alert Kombo Tidak Ada di DB
function ModalAlertKomboTidakAda({ info, onTutup, onAmbilDariBPS }) {
  if (!info) return null;
  const { tahun, indikator } = info;
  const labelInd = INDIKATOR_LABELS[indikator] || indikator;

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
              <span className="text-slate-400">{INDIKATOR_ICON_MAP[indikator]}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{labelInd}</span>
              <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
              <Calendar size={11} className="text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Tahun {tahun}</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Data untuk indikator <strong className="text-slate-800 dark:text-slate-100">{labelInd}</strong>{' '}
            tahun <strong className="text-slate-800 dark:text-slate-100">{tahun}</strong> belum pernah dianalisis dan disimpan di database.
          </p>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/40 flex items-start gap-2.5">
            <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              Klik <strong>"Ambil dari BPS"</strong> untuk mengambil data langsung dari BPS Web API dan menjalankan analisis baru.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onTutup} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Batal
          </button>
          <button onClick={() => onAmbilDariBPS(tahun, indikator)}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
            <Play size={13} /> Ambil dari BPS
          </button>
        </div>
      </div>
    </div>
  );
}

//─ KOMPONEN: Dua dropdown sejajar (model referensi)
function SelectorAnalisis({
  hasilAnalisis, daftarTersimpan, kombinasiTersedia,
  tahunTerpilih, onPilih, sedangMuatAwal,
}) {
  const [terbukaTahun, setTerbukaTahun]         = useState(false);
  const [terbukaIndikator, setTerbukaIndikator] = useState(false);
  const wrapRef = useRef(null);

  const activeInd = hasilAnalisis?.indikator || 'ALL';
  const activeThn = hasilAnalisis?.tahun || tahunTerpilih;

  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setTerbukaTahun(false);
        setTerbukaIndikator(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (sedangMuatAwal) {
    return (
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 h-10 px-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Memuat data...</span>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="flex items-stretch shadow-md rounded-lg">

      {/* Indikator */}
      <div className="relative">
        <button
          onClick={() => { setTerbukaIndikator(!terbukaIndikator); setTerbukaTahun(false); }}
          className={`
            flex items-center gap-2.5 h-10 px-4 min-w-[195px]
            bg-white dark:bg-slate-800
            border border-slate-200 dark:border-slate-700
            rounded-l-lg text-sm font-medium text-slate-800 dark:text-slate-200
            hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors select-none
            ${terbukaIndikator ? 'bg-slate-50 dark:bg-slate-700' : ''}
          `}
        >
          <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">{INDIKATOR_ICON_MAP[activeInd]}</span>
          <span className="flex-1 text-left truncate">{INDIKATOR_LABELS[activeInd]}</span>
          <ChevronDown size={13} className={`text-slate-400 flex-shrink-0 transition-transform duration-150 ${terbukaIndikator ? 'rotate-180' : ''}`} />
        </button>

        {terbukaIndikator && (
          <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-white dark:bg-slate-800 rounded-lg shadow-xl z-[1010] border border-slate-200 dark:border-slate-700 overflow-hidden py-1">
            {['ALL','RLS','APS','RASIO'].map(ind => {
              const adaUtk  = TAHUN_TERSEDIA.some(th => !!kombinasiTersedia[`${th}|${ind}`]);
              const isActive = activeInd === ind;
              return (
                <button key={ind}
                  onClick={() => { setTerbukaIndikator(false); onPilih(activeThn, ind); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                  }`}>
                  <span className={isActive ? 'text-blue-500' : 'text-slate-400'}>{INDIKATOR_ICON_MAP[ind]}</span>
                  <span className="flex-1">{INDIKATOR_LABELS[ind]}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {adaUtk && <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Ada di database" />}
                    {isActive && <Check size={13} className="text-blue-500" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

      {/* Tahun */}
      <div className="relative">
        <button
          onClick={() => { setTerbukaTahun(!terbukaTahun); setTerbukaIndikator(false); }}
          className={`
            flex items-center gap-2.5 h-10 px-4 min-w-[130px]
            bg-white dark:bg-slate-800
            border border-slate-200 dark:border-slate-700 border-l-0
            rounded-r-lg text-sm font-medium text-slate-800 dark:text-slate-200
            hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors select-none
            ${terbukaTahun ? 'bg-slate-50 dark:bg-slate-700' : ''}
          `}
        >
          <Calendar size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <span className="flex-1 text-left">Tahun {activeThn}</span>
          <ChevronDown size={13} className={`text-slate-400 flex-shrink-0 transition-transform duration-150 ${terbukaTahun ? 'rotate-180' : ''}`} />
        </button>

        {terbukaTahun && (
          <div className="absolute top-full right-0 mt-1 min-w-[160px] bg-white dark:bg-slate-800 rounded-lg shadow-xl z-[1010] border border-slate-200 dark:border-slate-700 overflow-hidden py-1">
            {TAHUN_TERSEDIA.slice().reverse().map(th => {
              const adaUtk  = ['ALL','RLS','APS','RASIO'].some(ind => !!kombinasiTersedia[`${th}|${ind}`]);
              const isActive = activeThn === th;
              return (
                <button key={th}
                  onClick={() => { setTerbukaTahun(false); onPilih(th, activeInd); }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                  }`}>
                  <span>{th}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {adaUtk && <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Ada di database" />}
                    {isActive && <Check size={13} className="text-blue-500" />}
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

//─ PAGE UTAMA─
export default function PendidikanPage() {
  const [sedangMenganalisis, setSedangMenganalisis]   = useState(false);
  const [hasilAnalisis, setHasilAnalisis]             = useState(null);
  const [kategoriTerpilih, setKategoriTerpilih]       = useState('SEMUA');
  const [indikatorTerpilih, setIndikatorTerpilih]     = useState('SEMUA');
  const [adalahClient, setAdalahClient]               = useState(false);
  const [petaSedangMemuat, setPetaSedangMemuat]       = useState(true);

  const [daftarTersimpan, setDaftarTersimpan]         = useState([]);
  const [sedangMuatAwal, setSedangMuatAwal]           = useState(true);
  const [alertKomboTidakAda, setAlertKomboTidakAda]   = useState(null);
  // true hanya saat data baru di-fetch dari BPS (belum/sudah pernah disimpan tapi di-fetch ulang)
  const [dataBaruDariBPS, setDataBaruDariBPS]         = useState(false);

  const [tahunTerpilih, setTahunTerpilih]             = useState(2024);
  const [sedangCekData, setSedangCekData]             = useState(false);
  const [hasilCekData, setHasilCekData]               = useState(null);
  const pendingAnalisisRef                             = useRef(null);

  const [menuUnduhTerbuka, setMenuUnduhTerbuka]       = useState(false);
  const [menuFilterTerbuka, setMenuFilterTerbuka]     = useState(false);
  const [menuDatasetTerbuka, setMenuDatasetTerbuka]   = useState(false);
  const [menuPilihanIndikatorTerbuka, setMenuPilihanIndikatorTerbuka] = useState(false);
  const [menuBasemapTerbuka, setMenuBasemapTerbuka]   = useState(false);
  const [basemapTerpilih, setBasemapTerpilih]         = useState('CARTO_LIGHT');

  const [panelInfoTerbuka, setPanelInfoTerbuka]       = useState(false);
  const [panelTabelTerbuka, setPanelTabelTerbuka]     = useState(false);
  const [panelMetodologiTerbuka, setPanelMetodologiTerbuka] = useState(false);
  const [panelKebijakanTerbuka, setPanelKebijakanTerbuka]   = useState(false);

  const [panelHeight, setPanelHeight]                 = useState(PANEL_HEIGHT_DEFAULT);
  const [isDragging, setIsDragging]                   = useState(false);
  const dragStartY                                     = useRef(null);
  const dragStartHeight                               = useRef(null);
  const panelRef                                       = useRef(null);

  const [koordinatCursor, setKoordinatCursor]         = useState({ lat: 0, lng: 0 });
  const [currentZoom, setCurrentZoom]                 = useState(ZOOM_DEFAULT);

  const [modalSaveTerbuka, setModalSaveTerbuka]       = useState(false);
  const [namaSimpan, setNamaSimpan]                   = useState('');
  const [sedangMenyimpan, setSedangMenyimpan]         = useState(false);

  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [pilihanIndikator, setPilihanIndikator]         = useState('ALL');
  const [pernahAnalisis, setPernahAnalisis]             = useState(false);

  const [searchQuery, setSearchQuery]                 = useState('');
  const [searchTerbuka, setSearchTerbuka]             = useState(false);
  const [searchSuggestions, setSearchSuggestions]     = useState([]);
  const [provinsiDipilih, setProvinsiDipilih]         = useState(null);

  const [modeBersih, setModeBersih]                   = useState(false);
  const [loadingDataset, setLoadingDataset]           = useState({ RLS: false, APS: false, RASIO: false });

  const petaRef = useRef(null);
  const [KontainerPeta, setKontainerPeta] = useState(null);
  const [LapisanPeta, setLapisanPeta]     = useState(null);
  const [GeoJSON, setGeoJSON]             = useState(null);
  const [useMapEvents, setUseMapEvents]   = useState(null);

  // Computed─
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

  // Init─
  useEffect(() => {
    setAdalahClient(true);
    setPetaSedangMemuat(true);
    import('react-leaflet').then((leaflet) => {
      setKontainerPeta(() => leaflet.MapContainer);
      setLapisanPeta(() => leaflet.TileLayer);
      setGeoJSON(() => leaflet.GeoJSON);
      setUseMapEvents(() => leaflet.useMapEvents);
      setPetaSedangMemuat(false);
    });
    import('leaflet/dist/leaflet.css');
  }, []);

  useEffect(() => { if (adalahClient) muatDariDB(); }, [adalahClient]);

  // DB functions─
  const refreshDaftarDB = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/education-analysis/list/');
      setDaftarTersimpan(res.data.results || []);
    } catch (e) { console.error('Gagal refresh daftar DB:', e); }
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get('http://127.0.0.1:8000/api/education-analysis/list/');
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (list.length === 0) return;
      const sorted = [...list].sort((a, b) => {
        const aIsAll = (a.indikator || 'ALL') === 'ALL' ? 0 : 1;
        const bIsAll = (b.indikator || 'ALL') === 'ALL' ? 0 : 1;
        if (aIsAll !== bIsAll) return aIsAll - bIsAll;
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
      await muatDetailDariDB(sorted[0].analysis_id, sorted[0].tahun, sorted[0].indikator || 'ALL', true);
    } catch (e) { console.error('Gagal muat dari DB:', e); }
    finally { setSedangMuatAwal(false); }
  };

  const muatDetailDariDB = async (analysisId, tahun, indikator, silent = false) => {
    const petunjuk = silent ? null : toast.loading('Memuat analisis dari database...');
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/education-analysis/${analysisId}/`);
      if (petunjuk) toast.dismiss(petunjuk);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setIndikatorTerpilih(dbToUI(indikator || res.data.indikator || 'ALL'));
      setPilihanIndikator(indikator || res.data.indikator || 'ALL');
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDariBPS(false); // data dari DB → tombol Simpan disembunyikan
      if (!silent) toast.success(`Data dimuat: ${INDIKATOR_LABELS[indikator || 'ALL']} ${tahun}`);
    } catch (e) {
      if (petunjuk) toast.dismiss(petunjuk);
      if (!silent) toast.error('Gagal memuat detail analisis');
      throw e;
    }
  };

  const handlePilihKomboSelector = async (tahun, indikator) => {
    const key = `${tahun}|${indikator}`;
    if (!kombinasiTersedia[key]) {
      setAlertKomboTidakAda({ tahun, indikator });
      return;
    }
    await muatDetailDariDB(kombinasiTersedia[key].analysis_id, tahun, indikator);
  };

  const handleAmbilDariBPS = (tahun, indikator) => {
    setAlertKomboTidakAda(null);
    setTahunTerpilih(tahun);
    setPilihanIndikator(indikator);
    cekDataLaluAnalisis(indikator, tahun);
  };

  // Drag panel─
  const handleDragStart = useCallback((e) => {
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY; dragStartHeight.current = panelHeight; setIsDragging(true);
  }, [panelHeight]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging || dragStartY.current === null) return;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    setPanelHeight(Math.max(PANEL_HEIGHT_MIN, Math.min(PANEL_HEIGHT_MAX, dragStartHeight.current + (dragStartY.current - clientY))));
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false); dragStartY.current = null;
    if (panelHeight < 100) { setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false); }
  }, [isDragging, panelHeight]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const bukaPanel = (setter) => {
    setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false);
    setter(true);
    if (panelHeight < 200) setPanelHeight(PANEL_HEIGHT_DEFAULT);
  };

  const hitungScaleKm = (zoom) => ({ 5:1000,6:500,7:200,8:100,9:50,10:25 })[Math.floor(zoom)] || 1000;

  const MouseTracker = () => {
    if (!useMapEvents) return null;
    const MapEventsComponent = () => {
      useMapEvents({
        mousemove: (e) => setKoordinatCursor({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) }),
        zoomend:   (e) => setCurrentZoom(e.target.getZoom()),
      });
      return null;
    };
    return <MapEventsComponent />;
  };

  useEffect(() => {
    if (!hasilAnalisis?.matched_features?.features || !searchQuery.trim()) { setSearchSuggestions([]); return; }
    setSearchSuggestions(
      hasilAnalisis.matched_features.features
        .filter(f => f.properties?.education_analysis?.nama_provinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(f => ({ nama: f.properties.education_analysis.nama_provinsi, kategori: getKategoriByIndikator(f, indikatorTerpilih), warna: getWarnaByIndikator(f, indikatorTerpilih) }))
        .slice(0, 5)
    );
  }, [searchQuery, hasilAnalisis, indikatorTerpilih]);

  const handleSearch = (namaProvinsi) => {
    const nama = namaProvinsi || searchQuery;
    if (!hasilAnalisis?.matched_features?.features || !nama.trim()) return;
    const fitur = hasilAnalisis.matched_features.features.find(f => f.properties?.education_analysis?.nama_provinsi?.toLowerCase() === nama.toLowerCase());
    if (fitur && petaRef.current) {
      const coords = fitur.geometry.coordinates;
      let lat, lng;
      if (fitur.geometry.type === "MultiPolygon") {
        const poly = coords[0][0]; lat = poly.reduce((s,c)=>s+c[1],0)/poly.length; lng = poly.reduce((s,c)=>s+c[0],0)/poly.length;
      } else {
        const poly = coords[0]; lat = poly.reduce((s,c)=>s+c[1],0)/poly.length; lng = poly.reduce((s,c)=>s+c[0],0)/poly.length;
      }
      petaRef.current.setView([lat, lng], 7);
      setProvinsiDipilih(fitur.properties.education_analysis.nama_provinsi);
      toast.success(`Ditemukan: ${fitur.properties.education_analysis.nama_provinsi}`, { duration: 3000 });
      setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]);
    } else toast.error('Provinsi tidak ditemukan');
  };

  // Analisis─
  const cekDataLaluAnalisis = async (indikator = null, tahun = null) => {
    const pilihan    = indikator || pilihanIndikator;
    const tahunFetch = tahun    || tahunTerpilih;
    pendingAnalisisRef.current = { pilihan, tahunFetch };
    setModalAnalisisTerbuka(false);
    setMenuPilihanIndikatorTerbuka(false);
    setSedangCekData(true);
    setHasilCekData(null);
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/check-year-data/', { tahun: tahunFetch, indikator: pilihan });
      setHasilCekData(res.data);
    } catch { toast.error('Gagal memeriksa ketersediaan data BPS'); }
    finally { setSedangCekData(false); }
  };

  const lanjutkanAnalisis = async () => {
    if (!pendingAnalisisRef.current) return;
    const { pilihan, tahunFetch } = pendingAnalisisRef.current;
    setHasilCekData(null);
    setSedangMenganalisis(true);
    setKategoriTerpilih('SEMUA');
    const petunjukMemuat = toast.loading(`Mengambil data BPS ${tahunFetch}...`);
    try {
      const respons = await axios.post('http://127.0.0.1:8000/api/analyze-education-bps/', { provinces: 'ALL', indikator: pilihan, tahun: tahunFetch });
      toast.dismiss(petunjukMemuat);
      if (respons.data.status === 'success') {
        setHasilAnalisis(respons.data);
        setIndikatorTerpilih(pilihan === 'ALL' ? 'SEMUA' : pilihan);
        setTahunTerpilih(tahunFetch);
        setPernahAnalisis(true);
        setDataBaruDariBPS(true); // data baru dari BPS → tombol Simpan muncul
        toast.success(`Berhasil menganalisis ${respons.data.total_success} provinsi (${tahunFetch})!`, { duration: 5000 });
      }
    } catch (galat) {
      toast.dismiss(petunjukMemuat);
      toast.error(galat.response?.data?.error || 'Gagal terhubung ke server');
    } finally { setSedangMenganalisis(false); }
  };

  const bukaModalAnalisis = () => {
    if (!pernahAnalisis) { setPilihanIndikator('ALL'); setModalAnalisisTerbuka(true); }
    else setMenuPilihanIndikatorTerbuka(!menuPilihanIndikatorTerbuka);
  };

  const resetAnalisis = () => {
    setHasilAnalisis(null); setKategoriTerpilih('SEMUA'); setIndikatorTerpilih('SEMUA');
    setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false);
    setProvinsiDipilih(null); setPernahAnalisis(false); setModeBersih(false);
    setDataBaruDariBPS(false);
    toast.success('Analisis berhasil direset');
  };

  const simpanAnalisis = async () => {
    if (!namaSimpan.trim()) return toast.error("Nama analisis tidak boleh kosong");
    setSedangMenyimpan(true);
    const id = toast.loading('Menyimpan analisis...');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/save-education-analysis/', { name: namaSimpan, analysis_data: hasilAnalisis });
      toast.dismiss(id);
      if (res.data.status === 'success') {
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false); setNamaSimpan('');
        setDataBaruDariBPS(false); // sudah tersimpan → sembunyikan tombol Simpan
        await refreshDaftarDB();
      }
    } catch { toast.dismiss(id); toast.error('Gagal menyimpan analisis'); }
    finally { setSedangMenyimpan(false); }
  };

  // Download─
  const unduhDataset = async (jenis) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error("Dataset tidak tersedia");
    setMenuDatasetTerbuka(false);
    if (jenis === 'ALL') { await unduhDatasetRLS(); await unduhDatasetAPS(); await unduhDatasetRasio(); return; }
    if (jenis === 'RLS')   return unduhDatasetRLS();
    if (jenis === 'APS')   return unduhDatasetAPS();
    if (jenis === 'RASIO') return unduhDatasetRasio();
  };

  const unduhBlob = (blob, nama) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; a.click(); URL.revokeObjectURL(a.href); };

  const unduhDatasetRLS = async () => {
    if (!hasilAnalisis?.raw_datasets?.RLS) return toast.error("Data RLS tidak tersedia");
    setLoadingDataset(p => ({ ...p, RLS: true }));
    const id = toast.loading('Membuat file RLS...');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/download-rls-xlsx/', { rls_data: hasilAnalisis.raw_datasets.RLS, timestamp: hasilAnalisis.raw_datasets.timestamp, tahun: hasilAnalisis.tahun || tahunTerpilih }, { responseType: 'blob' });
      unduhBlob(new Blob([res.data]), `Dataset_RLS_BPS_${hasilAnalisis.tahun || tahunTerpilih}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(id); toast.success('Dataset RLS berhasil diunduh!');
    } catch { toast.dismiss(id); toast.error('Gagal mengunduh dataset RLS'); }
    finally { setLoadingDataset(p => ({ ...p, RLS: false })); }
  };

  const unduhDatasetAPS = async () => {
    if (!hasilAnalisis?.raw_datasets?.APS) return toast.error("Data APS tidak tersedia");
    setLoadingDataset(p => ({ ...p, APS: true }));
    const id = toast.loading('Membuat file APS...');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/download-aps-xlsx/', { aps_data: hasilAnalisis.raw_datasets.APS, timestamp: hasilAnalisis.raw_datasets.timestamp, tahun: hasilAnalisis.tahun || tahunTerpilih }, { responseType: 'blob' });
      unduhBlob(new Blob([res.data]), `Dataset_APS_BPS_${hasilAnalisis.tahun || tahunTerpilih}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(id); toast.success('Dataset APS berhasil diunduh!');
    } catch { toast.dismiss(id); toast.error('Gagal mengunduh dataset APS'); }
    finally { setLoadingDataset(p => ({ ...p, APS: false })); }
  };

  const unduhDatasetRasio = async () => {
    const ds = hasilAnalisis?.raw_datasets;
    if (!ds?.RASIO_SD) return toast.error("Data Rasio tidak tersedia");
    setLoadingDataset(p => ({ ...p, RASIO: true }));
    const id = toast.loading('Membuat file Rasio...');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/download-rasio-xlsx/', { rasio_sd: ds.RASIO_SD||{}, rasio_smp: ds.RASIO_SMP||{}, rasio_sma: ds.RASIO_SMA||{}, rasio_smk: ds.RASIO_SMK||{}, timestamp: ds.timestamp, tahun: hasilAnalisis.tahun || tahunTerpilih }, { responseType: 'blob' });
      unduhBlob(new Blob([res.data]), `Dataset_Rasio_Murid_Guru_BPS_${hasilAnalisis.tahun || tahunTerpilih}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(id); toast.success('Dataset Rasio berhasil diunduh!');
    } catch { toast.dismiss(id); toast.error('Gagal mengunduh dataset Rasio'); }
    finally { setLoadingDataset(p => ({ ...p, RASIO: false })); }
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error("Data tidak tersedia");
    const r = hasilAnalisis.analysis_summary;
    setMenuUnduhTerbuka(false);
    const tgl = new Date().toISOString().split('T')[0];
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({ 'Provinsi': i.provinsi, 'Kategori': i.kategori, 'Skor Total': i.skor_total, 'RLS (tahun)': i.rls||'-', 'Skor APS': i.skor_aps||'-', 'Rasio Rata-rata': i.rasio_rata||'-' })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Analisis Pendidikan BPS");
      XLSX.writeFile(wb, `Analisis_Pendidikan_BPS_${thn}_${tgl}.xlsx`); toast.success('File Excel berhasil diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis,null,2)],{type:'application/json'}), `Analisis_Pendidikan_BPS_${thn}_${tgl}.json`); toast.success('File JSON berhasil diunduh');
    } else if (format === 'CSV') {
      const csv = [["Provinsi","Kategori","Skor Total","RLS","Skor APS","Rasio"].join(","), ...r.map(s=>[s.provinsi,s.kategori,s.skor_total,s.rls||'-',s.skor_aps||'-',s.rasio_rata||'-'].join(","))].join("\n");
      unduhBlob(new Blob([csv],{type:'text/csv'}), `Analisis_Pendidikan_BPS_${thn}_${tgl}.csv`); toast.success('File CSV berhasil diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features,null,2)],{type:'application/json'}), `Spasial_Pendidikan_BPS_${thn}_${tgl}.geojson`); toast.success('File GeoJSON berhasil diunduh');
    }
  };

  const ambilDataTabelTerfilter = () => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategoriByIndikator(x, indikatorTerpilih) === kategoriTerpilih);
    if (indikatorTerpilih !== 'SEMUA') f = f.filter(x => {
      const dp = x.properties?.education_analysis?.data_pendidikan || {};
      if (indikatorTerpilih === 'RLS')   return dp.RLS != null;
      if (indikatorTerpilih === 'APS')   return dp.SKOR_APS != null;
      if (indikatorTerpilih === 'RASIO') return dp.RASIO_RATA != null;
      return true;
    });
    return f;
  };

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Loading...';
    if (!pernahAnalisis) return 'Analisis';
    const m = { SEMUA:'Semua Indikator', RLS:'Analisis RLS', APS:'Analisis APS', RASIO:'Analisis Rasio' };
    return m[indikatorTerpilih] || 'Analisis';
  };

  const getWarnaIndikator = () => {
    const m = { SEMUA:'linear-gradient(135deg,#ef4444 0%,#f59e0b 50%,#10b981 100%)', RLS:'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)', APS:'linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)', RASIO:'linear-gradient(135deg,#10b981 0%,#059669 100%)' };
    return m[indikatorTerpilih] || m.SEMUA;
  };

  const dataTerfilter   = ambilDataTabelTerfilter();
  const adaPanelTerbuka = panelInfoTerbuka || panelTabelTerbuka || panelMetodologiTerbuka || panelKebijakanTerbuka;

  const hitungKategori = () => {
    if (!hasilAnalisis?.matched_features?.features) return { KRITIS:0, SEDANG:0, BAIK:0 };
    const f = hasilAnalisis.matched_features.features;
    return { KRITIS:f.filter(x=>getKategoriByIndikator(x,indikatorTerpilih)==='KRITIS').length, SEDANG:f.filter(x=>getKategoriByIndikator(x,indikatorTerpilih)==='SEDANG').length, BAIK:f.filter(x=>getKategoriByIndikator(x,indikatorTerpilih)==='BAIK').length };
  };
  const jumlahKategori = hitungKategori();

  const toggleAllPanels = () => { setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false); };

  const bottomPanelEffectiveHeight = adaPanelTerbuka ? panelHeight : 48;
  const actionButtonBottom          = bottomPanelEffectiveHeight + 16;

  if (!adalahClient) return null;
  const basemapConfig = BASEMAPS[basemapTerpilih];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {!modeBersih && <HeaderBar />}
      {!modeBersih && <SideBar />}

      {/* Modals */}
      <ModalAlertKomboTidakAda info={alertKomboTidakAda} onTutup={() => setAlertKomboTidakAda(null)} onAmbilDariBPS={handleAmbilDariBPS} />
      <ModalCekData tahun={pendingAnalisisRef.current?.tahunFetch || tahunTerpilih} indikator={pendingAnalisisRef.current?.pilihan || pilihanIndikator} hasilCek={hasilCekData} sedangCek={sedangCekData} onTutup={() => setHasilCekData(null)} onLanjut={lanjutkanAnalisis} />

      {/* Modal Pilihan Analisis */}
      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Data Analisis</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Calendar size={13} /> Tahun Data BPS</label>
              <div className="flex gap-2 flex-wrap">
                {TAHUN_TERSEDIA.map(th => (
                  <button key={th} onClick={() => setTahunTerpilih(th)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${tahunTerpilih === th ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}>{th}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2 mb-6">
              {[
                { key:'ALL',   label:'Semua Indikator',          desc:'Analisis komprehensif RLS + APS + Rasio',           icon:<BarChart2 size={15}/> },
                { key:'RLS',   label:'Rata-rata Lama Sekolah',    desc:'Fokus pencapaian lama sekolah per provinsi',        icon:<BookOpen size={15}/> },
                { key:'APS',   label:'Angka Partisipasi Sekolah', desc:'4 kelompok umur: 7–12, 13–15, 16–18, 19–23 tahun', icon:<GraduationCap size={15}/> },
                { key:'RASIO', label:'Rasio Murid-Guru',          desc:'Beban mengajar guru SD, SMP, SMA, SMK',            icon:<Users size={15}/> },
              ].map(opt => (
                <button key={opt.key} onClick={() => setPilihanIndikator(opt.key)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3 ${pilihanIndikator === opt.key ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                  <span className={`mt-0.5 flex-shrink-0 ${pilihanIndikator === opt.key ? 'text-blue-500' : 'text-slate-400'}`}>{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                  {pilihanIndikator === opt.key && <Check size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAnalisisTerbuka(false)} className="flex-1 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Batal</button>
              <button onClick={() => cekDataLaluAnalisis()} disabled={sedangMenganalisis}
                className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <Search size={13} /> Cek & Analisis {tahunTerpilih}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Save */}
      {modalSaveTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Simpan Analisis</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Nama Analisis</label>
              <input type="text" value={namaSimpan} onChange={(e) => setNamaSimpan(e.target.value)}
                placeholder={`contoh: Analisis Pendidikan ${hasilAnalisis?.tahun || tahunTerpilih}`}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors text-sm"
                onKeyPress={(e) => e.key === 'Enter' && simpanAnalisis()} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalSaveTerbuka(false)} className="flex-1 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Batal</button>
              <button onClick={simpanAnalisis} disabled={sedangMenyimpan || !namaSimpan.trim()}
                className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {sedangMenyimpan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ PETA ═══════════════ */}
      <div className={`fixed inset-0 bg-white dark:bg-slate-900 ${modeBersih ? 'top-0' : 'top-16'}`}>

        {sedangMuatAwal && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-blue-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Memuat data dari database...</p>
            </div>
          </div>
        )}

        {!petaSedangMemuat && KontainerPeta && (
          <KontainerPeta center={PUSAT_DEFAULT} zoom={ZOOM_DEFAULT} className="h-full w-full z-0" zoomControl={false} ref={petaRef}>
            <LapisanPeta key={basemapTerpilih} url={basemapConfig.url} attribution={basemapConfig.attribution} />
            <MouseTracker />
            {hasilAnalisis?.matched_features?.features && (
              <GeoJSON
                key={JSON.stringify(hasilAnalisis.matched_features.features)+kategoriTerpilih+indikatorTerpilih+provinsiDipilih}
                data={{ type:"FeatureCollection", features: hasilAnalisis.matched_features.features }}
                style={(fitur) => {
                  const analisis      = fitur.properties?.education_analysis || {};
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                  const warna         = getWarnaByIndikator(fitur, indikatorTerpilih);
                  let terlihat        = true;
                  if (kategoriTerpilih !== 'SEMUA' && kategoriAktif !== kategoriTerpilih) terlihat = false;
                  if (warna === "#cbd5e1") terlihat = false;
                  const isHighlighted = provinsiDipilih === analisis.nama_provinsi;
                  return { fillColor:warna, weight:isHighlighted?4:2, opacity:terlihat?1:0, color:isHighlighted?'#3b82f6':'white', fillOpacity:terlihat?0.75:0 };
                }}
                onEachFeature={(fitur, lapisan) => {
                  const analisis      = fitur.properties?.education_analysis || {};
                  const dp            = analisis.data_pendidikan || {};
                  const warna         = getWarnaByIndikator(fitur, indikatorTerpilih);
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                  const wawasan       = analisis.insights?.map(i => `<div style="margin-bottom:3px;padding-left:6px;border-left:2px solid ${warna};font-size:9px;">${i}</div>`).join('') || '';
                  lapisan.bindTooltip(`<div style="font-family:inherit;padding:4px;"><div style="font-weight:900;color:#0f172a;text-transform:uppercase;font-size:11px;">${analisis.nama_provinsi}</div><div style="font-size:9px;font-weight:800;color:${warna};margin-top:2px;">${kategoriAktif||'-'}</div><div style="font-size:8px;color:#64748b;margin-top:2px;">Skor: ${analisis.skor_total}</div></div>`,{sticky:true,opacity:0.95});
                  let indHTML = '';
                  if (indikatorTerpilih==='SEMUA') indHTML=`<div style="display:grid;grid-template-columns:1fr;gap:3px;"><div style="background:#f5f3ff;padding:5px;border-radius:5px;border-left:2px solid #8b5cf6;"><div style="font-size:7px;font-weight:700;color:#4c1d95;">LAMA SEKOLAH</div><div style="font-size:11px;font-weight:900;color:#7c3aed;">${dp.RLS?dp.RLS+' th':'-'}</div></div><div style="background:#eff6ff;padding:5px;border-radius:5px;border-left:2px solid #3b82f6;"><div style="font-size:7px;font-weight:700;color:#1e3a8a;">SKOR APS</div><div style="font-size:11px;font-weight:900;color:#2563eb;">${dp.SKOR_APS||'-'}</div></div><div style="background:#f0fdf4;padding:5px;border-radius:5px;border-left:2px solid #10b981;"><div style="font-size:7px;font-weight:700;color:#14532d;">RASIO M/G</div><div style="font-size:11px;font-weight:900;color:#059669;">${dp.RASIO_RATA||'-'}</div></div></div>`;
                  else if (indikatorTerpilih==='RLS') indHTML=`<div style="background:#f5f3ff;padding:8px;border-radius:8px;border-left:3px solid #8b5cf6;"><div style="font-size:8px;font-weight:700;color:#4c1d95;">RATA-RATA LAMA SEKOLAH</div><div style="font-size:16px;font-weight:900;color:#7c3aed;">${dp.RLS?dp.RLS+' tahun':'-'}</div></div>`;
                  else if (indikatorTerpilih==='APS') indHTML=`<div style="background:#eff6ff;padding:8px;border-radius:8px;border-left:3px solid #3b82f6;"><div style="font-size:8px;font-weight:700;color:#1e3a8a;">ANGKA PARTISIPASI SEKOLAH</div><div style="font-size:16px;font-weight:900;color:#2563eb;">${dp.SKOR_APS||'-'}</div></div>`;
                  else if (indikatorTerpilih==='RASIO') indHTML=`<div style="background:#f0fdf4;padding:8px;border-radius:8px;border-left:3px solid #10b981;"><div style="font-size:8px;font-weight:700;color:#14532d;">RASIO MURID-GURU</div><div style="font-size:16px;font-weight:900;color:#059669;">${dp.RASIO_RATA||'-'}</div></div>`;
                  lapisan.bindPopup(`<div style="font-family:inherit;min-width:260px;max-width:260px;color:#1e293b;padding:4px;"><div style="background:${warna};color:white;padding:8px;border-radius:8px;margin-bottom:6px;"><div style="font-weight:900;font-size:12px;text-transform:uppercase;">${analisis.nama_provinsi}</div><div style="background:rgba(255,255,255,.2);border-radius:5px;padding:5px;margin-top:5px;font-size:10px;font-weight:900;text-align:center;">Skor: ${analisis.skor_total} — <span>${kategoriAktif||'-'}</span></div></div><div style="padding:0 2px;"><div style="margin-bottom:6px;">${indHTML}</div><div style="font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #f1f5f9;padding-bottom:2px;">ANALISIS</div><div style="font-size:9px;color:#334155;line-height:1.4;background:#f8fafc;padding:6px;border-radius:5px;border-left:2px solid ${warna};">${wawasan}</div></div></div>`,{maxWidth:280,maxHeight:400});
                }}
              />
            )}
          </KontainerPeta>
        )}

        {/* Title badge — kiri atas */}
        {!modeBersih && (
          <div className="absolute top-6 left-6 z-[1000]">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
              <GraduationCap size={15} className="text-white flex-shrink-0" />
              <span className="text-sm font-black text-white uppercase tracking-wide">SDM Nasional Pendidikan</span>
            </div>
          </div>
        )}

        {/* Selector dua dropdown — top center */}
        {!modeBersih && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000]">
            <SelectorAnalisis
              hasilAnalisis={hasilAnalisis}
              daftarTersimpan={daftarTersimpan}
              kombinasiTersedia={kombinasiTersedia}
              tahunTerpilih={tahunTerpilih}
              onPilih={handlePilihKomboSelector}
              sedangMuatAwal={sedangMuatAwal}
            />
          </div>
        )}

        {/* Zoom controls */}
        {!modeBersih && (
          <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2">
            <button onClick={() => petaRef.current?.zoomIn()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Plus size={16}/></button>
            <button onClick={() => petaRef.current?.zoomOut()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Minus size={16}/></button>
          </div>
        )}

        {/* Mode bersih */}
        {hasilAnalisis && (
          <div className="absolute top-[170px] left-6 z-[1000]">
            <button onClick={() => setModeBersih(!modeBersih)}
              className="p-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-90 border-2 border-white dark:border-slate-700 relative overflow-hidden group"
              style={{ background: getWarnaIndikator() }}>
              {modeBersih ? <EyeOff size={16} className="text-white relative z-10" /> : <Eye size={16} className="text-white relative z-10" />}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all"></div>
            </button>
          </div>
        )}

        {/* Basemap */}
        {!modeBersih && (
          <div className={`absolute left-6 z-[1001] ${hasilAnalisis ? 'top-[215px]' : 'top-[170px]'}`}>
            <div className="relative">
              <button onClick={() => setMenuBasemapTerbuka(!menuBasemapTerbuka)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
                <Map size={16} />
              </button>
              {menuBasemapTerbuka && (
                <div className="absolute left-full ml-2 top-0 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Pilih Basemap</div>
                  <div className="p-1.5 space-y-0.5 max-h-72 overflow-y-auto">
                    {Object.entries(BASEMAPS).map(([key, bm]) => (
                      <button key={key} onClick={() => { setBasemapTerpilih(key); setMenuBasemapTerbuka(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${basemapTerpilih===key ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        <div className={`w-7 h-7 rounded flex-shrink-0 border ${basemapTerpilih===key?'border-white/40':'border-slate-200 dark:border-slate-600'} ${bm.preview}`}></div>
                        <span className={`text-xs font-medium truncate ${basemapTerpilih===key?'text-white':'text-slate-900 dark:text-white'}`}>{bm.label}</span>
                        {basemapTerpilih===key && <Check size={13} className="text-white ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        {hasilAnalisis && !modeBersih && (
          <div className={`absolute left-6 z-[1000] ${hasilAnalisis ? 'top-[263px]' : 'top-[218px]'}`}>
            {searchTerbuka ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 flex gap-2">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyPress={(e) => e.key==='Enter'&&handleSearch()}
                    placeholder="Cari provinsi..." autoFocus
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none w-48" />
                  <button onClick={() => handleSearch()} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all"><Search size={15} /></button>
                  <button onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); setProvinsiDipilih(null); }}
                    className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"><X size={15} /></button>
                </div>
                {searchSuggestions.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                    {searchSuggestions.map((sug, idx) => (
                      <button key={idx} onClick={() => handleSearch(sug.nama)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{sug.nama}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: sug.warna+'20', color: sug.warna }}>{sug.kategori}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchTerbuka(true)} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Search size={16}/></button>
            )}
          </div>
        )}

        {/* Kanan atas: koordinat, skala, legenda, filter */}
        {!modeBersih && (
          <div className="absolute top-6 right-6 z-[1000] space-y-2">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                <span className="text-blue-600 dark:text-blue-400">Lat:</span> {koordinatCursor.lat} | <span className="text-blue-600 dark:text-blue-400">Lng:</span> {koordinatCursor.lng}
              </div>
            </div>
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="h-2 bg-slate-300 dark:bg-slate-600 mb-1" style={{ width:'80px', borderLeft:'2px solid #64748b', borderRight:'2px solid #64748b', borderBottom:'2px solid #64748b' }}></div>
              <div className="text-[11px] font-medium text-center text-slate-700 dark:text-slate-300">{hitungScaleKm(currentZoom)} km</div>
            </div>
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
              <div className="space-y-2">
                {Object.entries(KATEGORI).map(([kunci, nilai]) => (
                  <div key={kunci} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nilai.warna }}></div>
                      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{nilai.label}</span>
                    </div>
                    {hasilAnalisis && <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white">{jumlahKategori[kunci]}</span>}
                  </div>
                ))}
              </div>
            </div>
            {hasilAnalisis && (
              <div className="relative">
                <button onClick={() => { setMenuFilterTerbuka(!menuFilterTerbuka); setMenuUnduhTerbuka(false); }}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-between gap-2 shadow">
                  <div className="flex items-center gap-1.5"><Filter size={13} className="text-slate-400" /> {kategoriTerpilih}</div>
                  <ChevronDown size={13} className={`text-slate-400 transition-transform ${menuFilterTerbuka ? 'rotate-180' : ''}`} />
                </button>
                {menuFilterTerbuka && (
                  <div className="absolute top-full mt-1 right-0 w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700 py-1">
                    {["SEMUA","KRITIS","SEDANG","BAIK"].map(kat => (
                      <button key={kat} onClick={() => { setKategoriTerpilih(kat); setMenuFilterTerbuka(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-all ${kategoriTerpilih===kat ? 'bg-blue-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        {kat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!modeBersih && (
          <div className="absolute left-1/2 -translate-x-1/2 z-[1002] transition-all duration-200" style={{ bottom:`${actionButtonBottom}px` }}>
            <div className="flex gap-2.5 items-center">
              <div className="relative">
                <button onClick={bukaModalAnalisis} disabled={sedangMenganalisis||sedangCekData}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold text-xs tracking-wide hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase active:scale-95 flex items-center gap-2 whitespace-nowrap">
                  {sedangCekData ? <Loader2 size={13} className="animate-spin" /> : sedangMenganalisis ? <Loader2 size={13} className="animate-pulse" /> : <Play size={13} />}
                  {sedangCekData ? 'Memeriksa...' : getButtonText()}
                </button>
                {menuPilihanIndikatorTerbuka && (
                  <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1003] overflow-hidden border border-slate-200 dark:border-slate-700 min-w-[260px]">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Calendar size={11} /> Tahun Data</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {TAHUN_TERSEDIA.map(th => (
                          <button key={th} onClick={() => setTahunTerpilih(th)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${tahunTerpilih===th ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}>{th}</button>
                        ))}
                      </div>
                    </div>
                    {[{key:'ALL',label:'Semua Indikator',icon:<BarChart2 size={13}/>},{key:'RLS',label:'Rata-rata Lama Sekolah',icon:<BookOpen size={13}/>},{key:'APS',label:'Angka Partisipasi Sekolah',icon:<GraduationCap size={13}/>},{key:'RASIO',label:'Rasio Murid-Guru',icon:<Users size={13}/>}]
                      .map((opt,i,arr) => (
                        <button key={opt.key} onClick={() => cekDataLaluAnalisis(opt.key)}
                          className={`w-full flex items-center gap-3 text-left px-4 py-2.5 text-xs font-medium transition-all text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 ${i<arr.length-1?'border-b border-slate-100 dark:border-slate-700':''}`}>
                          <span className="text-slate-400">{opt.icon}</span> {opt.label}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
              {hasilAnalisis && (
                <>
                  {dataBaruDariBPS && (
                    <button onClick={() => { if (!hasilAnalisis) return toast.error("Belum ada data untuk disimpan"); setNamaSimpan(''); setModalSaveTerbuka(true); }}
                      className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-semibold text-xs tracking-wide hover:shadow-xl hover:shadow-green-500/30 transition-all uppercase active:scale-95 flex items-center gap-2">
                      <Save size={13} /> Simpan
                    </button>
                  )}
                  <button onClick={resetAnalisis}
                    className="px-5 py-2.5 bg-gradient-to-r from-slate-600 to-slate-500 text-white rounded-xl font-semibold text-xs tracking-wide hover:shadow-xl transition-all uppercase active:scale-95 flex items-center gap-2">
                    <RotateCcw size={13} /> Reset
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bottom panels */}
        {hasilAnalisis && !modeBersih && (
          <div ref={panelRef} className="absolute bottom-0 left-0 right-0 z-[1001] flex flex-col"
            style={{ height: adaPanelTerbuka ? `${panelHeight}px` : 'auto' }}>

            {/* INFO PANEL */}
            {panelInfoTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Activity className="text-blue-500" size={22} />
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Ringkasan Analisis</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {hasilAnalisis.tahun && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800"><Calendar size={9} /> Tahun {hasilAnalisis.tahun}</span>}
                          {hasilAnalisis.indikator && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800"><BarChart2 size={9} /> {INDIKATOR_LABELS[hasilAnalisis.indikator]||hasilAnalisis.indikator}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setPanelInfoTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={17} className="text-slate-500" /></button>
                  </div>
                  {hasilAnalisis.timestamp && <div className="mb-4 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Calendar size={11} /> Waktu pengambilan data: {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}</div>}
                  {hasilAnalisis.dataset_aktif?.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest self-center">Dataset aktif:</span>
                      {hasilAnalisis.dataset_aktif.map(k => <span key={k} className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{DATASET_LABELS[k]||k}</span>)}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label:'Total Provinsi', val:hasilAnalisis.total_success, color:'blue' },
                      { label:'Kritis', val:jumlahKategori.KRITIS, color:'red' },
                      { label:'Sedang', val:jumlahKategori.SEDANG, color:'yellow' },
                      { label:'Baik',   val:jumlahKategori.BAIK,   color:'green' },
                    ].map(c => (
                      <div key={c.label} className={`bg-${c.color}-50 dark:bg-${c.color}-900/20 rounded-xl p-3 border border-${c.color}-200 dark:border-${c.color}-800`}>
                        <div className={`text-[10px] font-medium text-${c.color}-600 dark:text-${c.color}-400 uppercase mb-1`}>{c.label}</div>
                        <div className={`text-xl font-bold text-${c.color}-700 dark:text-${c.color}-300`}>{c.val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Dasar Penilaian</div>
                    {(!hasilAnalisis.indikator||hasilAnalisis.indikator==='ALL') && <p className="text-xs text-slate-600 dark:text-slate-300">Skor gabungan: RLS (30%) + APS (50%) + Rasio Murid-Guru (20%). BAIK ≥ 2.4, SEDANG ≥ 1.8, KRITIS &lt; 1.8</p>}
                    {hasilAnalisis.indikator==='RLS'   && <p className="text-xs text-slate-600 dark:text-slate-300">RLS. BAIK &gt; 9.5 tahun, SEDANG 8.0–9.5 tahun, KRITIS &lt; 8.0 tahun</p>}
                    {hasilAnalisis.indikator==='APS'   && <p className="text-xs text-slate-600 dark:text-slate-300">Rata-rata APS 4 kelompok umur. BAIK &gt; 80%, SEDANG 70–80%, KRITIS &lt; 70%</p>}
                    {hasilAnalisis.indikator==='RASIO' && <p className="text-xs text-slate-600 dark:text-slate-300">Rasio Murid-Guru rata-rata SD+SMP+SMA+SMK. BAIK &lt; 12, SEDANG 12–16, KRITIS &gt; 16</p>}
                  </div>
                </div>
              </div>
            )}

            {/* TABEL PANEL */}
            {panelTabelTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Matriks Pendidikan</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{dataTerfilter.length} Wilayah</span>
                        {hasilAnalisis?.tahun && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800"><Calendar size={9} /> {hasilAnalisis.tahun}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => { setMenuUnduhTerbuka(!menuUnduhTerbuka); setMenuFilterTerbuka(false); }}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm">
                          <Download size={12} /> Unduh
                        </button>
                        {menuUnduhTerbuka && (
                          <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700 py-1">
                            {['GEOJSON','JSON','EXCEL','CSV'].map(fmt => (
                              <button key={fmt} onClick={() => eksporData(fmt)}
                                className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
                                <Download size={11} className="text-blue-500" /> {fmt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPanelTabelTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={17} className="text-slate-500" /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                          <th className="px-3 py-2 text-center">No</th>
                          <th className="px-3 py-2">Provinsi</th>
                          <th className="px-3 py-2 text-center">Skor</th>
                          {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RLS') && <th className="px-3 py-2 text-center">RLS (thn)</th>}
                          {indikatorTerpilih==='SEMUA' && <th className="px-3 py-2 text-center">Skor APS</th>}
                          {indikatorTerpilih==='APS' && (<><th className="px-3 py-2 text-center">7–12</th><th className="px-3 py-2 text-center">13–15</th><th className="px-3 py-2 text-center">16–18</th><th className="px-3 py-2 text-center">19–23</th></>)}
                          {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RASIO') && <th className="px-3 py-2 text-center">Rasio M/G</th>}
                          {indikatorTerpilih==='RASIO' && <th className="px-3 py-2">Per Jenjang</th>}
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const data = fitur.properties.education_analysis;
                          const dp   = data.data_pendidikan || {};
                          const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                          const kat   = getKategoriByIndikator(fitur, indikatorTerpilih);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] text-slate-400">{idx+1}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">{data.skor_total}</span></td>
                              {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RLS') && <td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dp.RLS??'-'}</td>}
                              {indikatorTerpilih==='SEMUA' && <td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dp.SKOR_APS??'-'}</td>}
                              {indikatorTerpilih==='APS' && (<><td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dp.APS_7_12!=null?`${dp.APS_7_12}%`:'-'}</td><td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dp.APS_13_15!=null?`${dp.APS_13_15}%`:'-'}</td><td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dp.APS_16_18!=null?`${dp.APS_16_18}%`:'-'}</td><td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dp.APS_19_23!=null?`${dp.APS_19_23}%`:'-'}</td></>)}
                              {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RASIO') && <td className="px-3 py-2 text-center text-xs font-semibold text-slate-900 dark:text-white">{dp.RASIO_RATA??'-'}</td>}
                              {indikatorTerpilih==='RASIO' && <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{[['SD',dp.RASIO_SD,'blue'],['SMP',dp.RASIO_SMP,'green'],['SMA',dp.RASIO_SMA,'yellow'],['SMK',dp.RASIO_SMK,'purple']].map(([j,v,c])=><span key={j} className={`px-1.5 py-0.5 bg-${c}-100 dark:bg-${c}-900/30 text-${c}-700 dark:text-${c}-300 text-[9px] font-medium rounded`}>{j}:{v??'-'}</span>)}</div></td>}
                              <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-medium border" style={{ borderColor:warna+'50', color:warna }}>{kat}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* KEBIJAKAN PANEL */}
            {panelKebijakanTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="text-blue-500" size={22} />
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Rekomendasi Kebijakan</h3>
                    </div>
                    <button onClick={() => setPanelKebijakanTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={17} className="text-slate-500" /></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                          <th className="px-3 py-2 text-center">No</th><th className="px-3 py-2">Provinsi</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Prioritas</th><th className="px-3 py-2">Rekomendasi Kebijakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const data = fitur.properties.education_analysis;
                          const rek  = data.rekomendasi?.[0];
                          const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                          const kat   = getKategoriByIndikator(fitur, indikatorTerpilih);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] text-slate-400">{idx+1}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-medium border" style={{ borderColor:warna+'50', color:warna }}>{kat}</span></td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${kat==='KRITIS'?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300':kat==='SEDANG'?'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300':'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>{rek?.title||"NORMAL"}</span></td>
                              <td className="px-3 py-2 max-w-md"><ul className="space-y-0.5 text-[10px]">{rek?.actions?.map((a,i)=><li key={i} className="text-slate-600 dark:text-slate-300">• {a}</li>)||<li className="text-slate-400">Pertahankan kondisi saat ini</li>}</ul></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* METODOLOGI PANEL */}
            {panelMetodologiTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-blue-500" size={22} />
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Metodologi Penilaian</h3>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => setMenuDatasetTerbuka(!menuDatasetTerbuka)}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm">
                          <Download size={12} /> Dataset
                        </button>
                        {menuDatasetTerbuka && (
                          <div className="absolute top-full mt-1 right-0 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700 py-1">
                            <button onClick={() => unduhDataset('ALL')} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Database size={12} className="text-purple-500" /> Semua Dataset</button>
                            <button onClick={() => unduhDataset('RLS')} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><BookOpen size={12} className="text-purple-500" /> Dataset RLS {loadingDataset.RLS&&'(Memproses...)'}</button>
                            <button onClick={() => unduhDataset('APS')} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><GraduationCap size={12} className="text-blue-500" /> Dataset APS {loadingDataset.APS&&'(Memproses...)'}</button>
                            <button onClick={() => unduhDataset('RASIO')} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Users size={12} className="text-green-500" /> Dataset Rasio {loadingDataset.RASIO&&'(Memproses...)'}</button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPanelMetodologiTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={17} className="text-slate-500" /></button>
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-2 uppercase tracking-wide">
                      {(!hasilAnalisis?.indikator||hasilAnalisis.indikator==='ALL') ? 'Formula SPT (Skor Pendidikan Terintegrasi)' : hasilAnalisis.indikator==='RLS' ? 'Formula — Rata-rata Lama Sekolah' : hasilAnalisis.indikator==='APS' ? 'Formula — Angka Partisipasi Sekolah' : 'Formula — Rasio Murid-Guru'}
                    </h4>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                      {(!hasilAnalisis?.indikator||hasilAnalisis.indikator==='ALL') && <code className="text-xs font-mono text-slate-900 dark:text-white">SPT = (Skor_RLS × 0.30) + (Skor_APS × 0.50) + (Skor_Rasio × 0.20)</code>}
                      {hasilAnalisis?.indikator==='RLS'   && <code className="text-xs font-mono text-slate-900 dark:text-white">Skor = 3 jika RLS &gt; 9.5 th | 2 jika 8.0–9.5 th | 1 jika &lt; 8.0 th</code>}
                      {hasilAnalisis?.indikator==='APS'   && <code className="text-xs font-mono text-slate-900 dark:text-white">Skor = rata-rata 4 kelompok (7–12, 13–15, 16–18, 19–23) | &gt;80%→3, 70–80%→2, &lt;70%→1</code>}
                      {hasilAnalisis?.indikator==='RASIO' && <code className="text-xs font-mono text-slate-900 dark:text-white">Skor = rata-rata (SD+SMP+SMA+SMK) | &lt;12→3, 12–16→2, &gt;16→1 murid/guru</code>}
                    </div>
                    <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-2">Kategori: BAIK ≥ 2.4 · SEDANG ≥ 1.8 · KRITIS &lt; 1.8</p>
                  </div>

                  <div className="space-y-3">
                    {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RLS') && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border-l-4 border-purple-500">
                        <div className="flex items-center gap-2 mb-3"><BookOpen size={15} className="text-purple-500" /><h5 className="text-sm font-bold text-purple-900 dark:text-purple-100">Rata-rata Lama Sekolah (RLS)</h5><span className="ml-auto text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded font-medium">{indikatorTerpilih==='SEMUA'?'Bobot 30%':'Tunggal'}</span></div>
                        <div className="grid grid-cols-3 gap-2">{[{l:'BAIK',d:'> 9.5 th',c:'green'},{l:'SEDANG',d:'8.0–9.5 th',c:'yellow'},{l:'KRITIS',d:'< 8.0 th',c:'red'}].map(x=><div key={x.l} className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-purple-200 dark:border-purple-700"><div className={`text-[10px] font-bold text-${x.c}-600 dark:text-${x.c}-400`}>{x.l}</div><div className="text-xs text-slate-700 dark:text-slate-300">{x.d}</div></div>)}</div>
                      </div>
                    )}
                    {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='APS') && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 mb-3"><GraduationCap size={15} className="text-blue-500" /><h5 className="text-sm font-bold text-blue-900 dark:text-blue-100">Angka Partisipasi Sekolah (APS)</h5><span className="ml-auto text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded font-medium">{indikatorTerpilih==='SEMUA'?'Bobot 50%':'Tunggal'}</span></div>
                        <div className="grid grid-cols-3 gap-2 mb-2">{[{l:'BAIK',d:'> 80%',c:'green'},{l:'SEDANG',d:'70–80%',c:'yellow'},{l:'KRITIS',d:'< 70%',c:'red'}].map(x=><div key={x.l} className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200 dark:border-blue-700"><div className={`text-[10px] font-bold text-${x.c}-600 dark:text-${x.c}-400`}>{x.l}</div><div className="text-xs text-slate-700 dark:text-slate-300">{x.d}</div></div>)}</div>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">Rata-rata 4 kelompok umur: 7–12 | 13–15 | 16–18 | 19–23 tahun</p>
                      </div>
                    )}
                    {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RASIO') && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border-l-4 border-green-500">
                        <div className="flex items-center gap-2 mb-3"><Users size={15} className="text-green-500" /><h5 className="text-sm font-bold text-green-900 dark:text-green-100">Rasio Murid-Guru</h5><span className="ml-auto text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded font-medium">{indikatorTerpilih==='SEMUA'?'Bobot 20%':'Tunggal'}</span></div>
                        <div className="grid grid-cols-3 gap-2 mb-2">{[{l:'BAIK',d:'< 12 m/g',c:'green'},{l:'SEDANG',d:'12–16 m/g',c:'yellow'},{l:'KRITIS',d:'> 16 m/g',c:'red'}].map(x=><div key={x.l} className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-green-200 dark:border-green-700"><div className={`text-[10px] font-bold text-${x.c}-600 dark:text-${x.c}-400`}>{x.l}</div><div className="text-xs text-slate-700 dark:text-slate-300">{x.d}</div></div>)}</div>
                        <p className="text-[10px] text-green-600 dark:text-green-400">Rata-rata 4 jenjang: SD | SMP | SMA | SMK</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">Sumber Data BPS Tahun {hasilAnalisis?.tahun||tahunTerpilih}</div>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RLS')   && <li>• BPS Web API — Rata-rata Lama Sekolah (Var: 459)</li>}
                      {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='APS')   && <li>• BPS Web API — Angka Partisipasi Sekolah (Var: 2211)</li>}
                      {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='RASIO') && <li>• BPS Web API — SIMDASI Kemdikbudristek (SD, SMP, SMA, SMK)</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB BAR + DRAG HANDLE */}
            <div className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 shadow-2xl flex-shrink-0">
              {adaPanelTerbuka && (
                <div
                  className={`flex items-center justify-center py-1.5 cursor-row-resize select-none group ${isDragging ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} transition-colors`}
                  onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
                  <div className={`flex flex-col gap-0.5 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'}`}>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                    <div className="w-5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto"></div>
                  </div>
                </div>
              )}
              <div className="p-3 pt-1">
                <div className="flex justify-center gap-2">
                  {[
                    { label:'Info',       icon:<Info size={13}/>,          setter:setPanelInfoTerbuka,       state:panelInfoTerbuka },
                    { label:'Tabel',      icon:<Table size={13}/>,         setter:setPanelTabelTerbuka,      state:panelTabelTerbuka },
                    { label:'Kebijakan',  icon:<ClipboardList size={13}/>, setter:setPanelKebijakanTerbuka,  state:panelKebijakanTerbuka },
                    { label:'Metodologi', icon:<FileText size={13}/>,      setter:setPanelMetodologiTerbuka, state:panelMetodologiTerbuka },
                  ].map(tab => (
                    <button key={tab.label}
                      onClick={() => adaPanelTerbuka&&tab.state ? tab.setter(false) : bukaPanel(tab.setter)}
                      className={`px-5 py-2 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1.5 ${tab.state ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      {tab.icon} {tab.label}
                      {tab.state ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                  ))}
                  {adaPanelTerbuka && (
                    <button onClick={toggleAllPanels}
                      className="px-5 py-2 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                      <ChevronDown size={12} /> Tutup
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}