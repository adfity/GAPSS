'use client';
import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import HeaderBar from '@/components/layout/HeaderBar';
import Footerauth from '@/components/layout/footerauth';
import {
  BarChart3,
  Map,
  Info,
  History,
  RefreshCw,
  Play,
  Search,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Satellite,
  Wheat,
  UtensilsCrossed,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Save,
  RotateCcw,
  Building2,
  Trees,
  Waves,
  Route,
  FileText,
} from 'lucide-react';

// Leaflet hanya di sisi client
const PanganMap = dynamic(
  () => import('@/components/analisis/panganMap'),
  { ssr: false }
);

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const PROVINSI_LIST = [
  'Aceh','Bali','Banten','Bengkulu',
  'Daerah Istimewa Yogyakarta','Daerah Khusus Ibukota Jakarta',
  'Gorontalo','Jambi','Jawa Barat','Jawa Tengah','Jawa Timur',
  'Kalimantan Barat','Kalimantan Selatan','Kalimantan Tengah',
  'Kalimantan Timur','Kalimantan Utara',
  'Kepulauan Bangka Belitung','Kepulauan Riau','Lampung',
  'Maluku','Maluku Utara','Nusa Tenggara Barat','Nusa Tenggara Timur',
  'Papua','Papua Barat','Papua Barat Daya','Papua Pegunungan',
  'Papua Selatan','Papua Tengah','Riau',
  'Sulawesi Barat','Sulawesi Selatan','Sulawesi Tengah',
  'Sulawesi Tenggara','Sulawesi Utara',
  'Sumatera Barat','Sumatera Selatan','Sumatera Utara',
];

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',     Icon: BarChart3  },
  { id: 'analisis',   label: 'Analisis IKPG', Icon: FileText   },
  { id: 'metodologi', label: 'Metodologi',    Icon: Info       },
  { id: 'riwayat',    label: 'Riwayat',       Icon: History    },
];

// Status color maps
const STATUS_STYLE = {
  Tinggi: {
    bar:   '#10b981',
    text:  'text-emerald-600 dark:text-emerald-400',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/30',
  },
  Sedang: {
    bar:   '#f59e0b',
    text:  'text-amber-600 dark:text-amber-400',
    badge: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/30',
  },
  Rendah: {
    bar:   '#ef4444',
    text:  'text-red-600 dark:text-red-400',
    badge: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/30',
  },
};
const STATUS_DEFAULT = {
  bar:   '#6b7280',
  text:  'text-slate-500 dark:text-slate-400',
  badge: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-700 dark:border-slate-600',
};
const getSt = (s) => STATUS_STYLE[s] ?? STATUS_DEFAULT;

const barColor = (v) =>
  v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444';


// Primitives

function Card({ children, className = '' }) {
  return (
    <div
      className={`bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function Toast({ toast: t, onClose }) {
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(onClose, 3500);
    return () => clearTimeout(id);
  }, [t, onClose]);
  if (!t) return null;
  const bg = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600' };
  const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info;
  return (
    <div
      className={`fixed bottom-6 right-6 z-[1300] flex items-center gap-3 px-5 py-3 rounded-xl text-white shadow-2xl ${bg[t.type] ?? 'bg-slate-700'}`}
    >
      <Icon size={15} />
      <span className="text-sm font-medium">{t.message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <XCircle size={14} />
      </button>
    </div>
  );
}

function StatCard({ label, value, Icon, sub, colorCls }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon size={18} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-full">
          {sub}
        </span>
      </div>
      <div className={`text-2xl font-bold ${colorCls ?? 'text-slate-800 dark:text-slate-100'}`}>
        {value ?? '-'}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </Card>
  );
}

function ScoreBar({ label, Icon, score, weight, detail, noDataMsg }) {
  const pct   = score != null ? Math.min(score, 100) : 0;
  const color = score != null ? barColor(pct) : '#94a3b8';
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
      <div className="flex justify-between items-start mb-2 gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Icon size={15} className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{label}</div>
            {detail && (
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{detail}</div>
            )}
            {noDataMsg && score == null && (
              <div className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">{noDataMsg}</div>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold" style={{ color }}>
            {score != null ? score.toFixed(1) : '-'}
            <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">/100</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            Bobot {(weight * 100).toFixed(0)}%
          </div>
        </div>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ProporsiBar({ label, Icon, pct, color }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={13} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500 dark:text-slate-400">{label}</span>
          <span className="text-slate-700 dark:text-slate-300 font-mono">{pct?.toFixed(1) ?? 0}%</span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(pct ?? 0, 100)}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function IkpgGauge({ ikpg, status }) {
  const bar = getSt(status).bar;
  const pct = ikpg ?? 0;
  const r = 54, cx = 64, cy = 64, a0 = 140, a1 = 400;
  const fill = (pct / 100) * (a1 - a0);
  const arc = (s, e) => {
    const sr = (s * Math.PI) / 180, er = (e * Math.PI) / 180;
    return `M ${cx + r * Math.cos(sr)} ${cy + r * Math.sin(sr)} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${cx + r * Math.cos(er)} ${cy + r * Math.sin(er)}`;
  };
  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <path
          d={arc(a0, a1)}
          fill="none"
          stroke="#e2e8f0"
          className="dark:[stroke:#1e293b]"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {ikpg != null && (
          <path
            d={arc(a0, a0 + fill)}
            fill="none"
            stroke={bar}
            strokeWidth="10"
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        )}
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-black text-slate-800 dark:text-white leading-none">
          {ikpg ?? '-'}
        </div>
        <div className={`text-xs font-semibold mt-1 ${getSt(status).text}`}>{status ?? '-'}</div>
      </div>
    </div>
  );
}

function FormulaBox({ accent = 'indigo', children }) {
  const variants = {
    indigo: 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/5',
    amber:  'border-amber-200  dark:border-amber-500/30  bg-amber-50/60  dark:bg-amber-500/5',
    cyan:   'border-cyan-200   dark:border-cyan-500/30   bg-cyan-50/60   dark:bg-cyan-500/5',
    emerald:'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5',
    pink:   'border-pink-200   dark:border-pink-500/30   bg-pink-50/60   dark:bg-pink-500/5',
  };
  return (
    <div
      className={`rounded-xl border p-4 font-mono text-sm leading-relaxed overflow-x-auto text-slate-700 dark:text-slate-200 ${variants[accent]}`}
    >
      {children}
    </div>
  );
}

function MetSection({ title, Icon, children }) {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
        <Icon size={17} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
        {title}
      </h3>
      {children}
    </Card>
  );
}


// Mai
export default function PanganPage() {
  const [tab,             setTab]             = useState('dashboard');
  const [toast,           setToast]           = useState(null);
  const [analisisProv,    setAnalisisProv]    = useState('');
  const [analisisResult,  setAnalisisResult]  = useState(null);
  const [analisisLoading, setAnalisisLoading] = useState(false);
  const [dashData,        setDashData]        = useState(null);
  const [dashLoading,     setDashLoading]     = useState(false);
  const [history,         setHistory]         = useState([]);
  const [histLoading,     setHistLoading]     = useState(false);
  const [searchProv,      setSearchProv]      = useState('');
  const [sortCol,         setSortCol]         = useState('ikpg');
  const [sortDir,         setSortDir]         = useState('asc');

  const showToast = (message, type = 'info') => setToast({ message, type });

  // Data loaders
  // NOT called on mount — user must click the run button
  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await axios.post(`${API}/analyze-all-provinces-bps/`);
      setDashData(res.data);
      showToast('Data nasional berhasil dimuat', 'success');
    } catch (e) {
      showToast('Gagal memuat: ' + (e.response?.data?.error ?? e.message), 'error');
    } finally {
      setDashLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await axios.get(`${API}/food-security-analysis/list/?limit=50`);
      setHistory(res.data.results ?? []);
    } catch {
      showToast('Gagal memuat riwayat', 'error');
    } finally {
      setHistLoading(false);
    }
  }, []);

  // Auto-load hanya riwayat saat tab aktif
  useEffect(() => {
    if (tab === 'riwayat') loadHistory();
  }, [tab, loadHistory]);

  const runAnalisis = async () => {
    if (!analisisProv) return showToast('Pilih provinsi terlebih dahulu', 'error');
    setAnalisisLoading(true);
    setAnalisisResult(null);
    try {
      const res = await axios.post(`${API}/analyze-food-security-bps/`, { provinsi: analisisProv });
      setAnalisisResult(res.data);
      showToast(`IKPG ${analisisProv}: ${res.data.ikpg} (${res.data.status})`, 'success');
    } catch (e) {
      showToast('Gagal: ' + (e.response?.data?.error ?? e.message), 'error');
    } finally {
      setAnalisisLoading(false);
    }
  };

  const saveAnalisis = async () => {
    if (!analisisResult) return;
    try {
      await axios.post(`${API}/save-food-security-analysis/`, analisisResult);
      showToast('Analisis berhasil disimpan', 'success');
    } catch {
      showToast('Gagal menyimpan', 'error');
    }
  };

  const deleteHistory = async (id) => {
    try {
      await axios.delete(`${API}/food-security-analysis/${id}/delete/`);
      setHistory((h) => h.filter((x) => x.analysis_id !== id));
      showToast('Data dihapus', 'info');
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  // Sorted province table
  const provTable = (() => {
    const src      = dashData?.summary ?? [];
    const filtered = searchProv
      ? src.filter((p) => p.nama_provinsi.toLowerCase().includes(searchProv.toLowerCase()))
      : src;
    return [...filtered].sort((a, b) => {
      const g = (obj, col) => {
        if (col === 'prov')  return obj.nama_provinsi ?? '';
        if (col === 'ikpg')  return obj.ikpg ?? -1;
        if (col === 'geoai') return obj.komponen?.geoai_weighted ?? -1;
        if (col === 'prod')  return obj.komponen?.production_score ?? -1;
        if (col === 'kal')   return obj.komponen?.calorie_score ?? -1;
        if (col === 'insec') return obj.komponen?.insecurity_score ?? -1;
        return 0;
      };
      const va = g(a, sortCol), vb = g(b, sortCol);
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  })();

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortTh = ({ col, label }) => (
    <th
      onClick={() => toggleSort(col)}
      className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={9}
          className={sortCol === col ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'}
        />
      </span>
    </th>
  );


  // DASHBOARD
  const renderDashboard = () => {
    const d    = dashData;
    const dist = d?.status_distribusi ?? {};

    return (
      <div className="space-y-6">

        {/* Run-button state — prominent when no data loaded yet */}
        {!d && !dashLoading && (
          <Card className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-5">
              <Play size={26} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
              Mulai Analisis Nasional
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
              Klik tombol di bawah untuk mengambil data BPS dan menghitung IKPG
              seluruh provinsi Indonesia. Proses memerlukan beberapa saat.
            </p>
            <button
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              <Play size={15} />
              Jalankan Analisis
            </button>
          </Card>
        )}

        {dashLoading && (
          <Card className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <RefreshCw size={26} className="text-indigo-400 animate-spin" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mengambil data BPS dan menghitung IKPG...
            </p>
          </Card>
        )}

        {d && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Rata-rata IKPG Nasional"
                value={d.national_avg_ikpg}
                Icon={BarChart3}
                sub="Seluruh Provinsi"
                colorCls="text-indigo-600 dark:text-indigo-400"
              />
              <StatCard
                label="Ketahanan Tinggi"
                value={dist.Tinggi ?? '-'}
                Icon={TrendingUp}
                sub="IKPG >= 70"
                colorCls="text-emerald-600 dark:text-emerald-400"
              />
              <StatCard
                label="Perlu Perhatian"
                value={dist.Sedang ?? '-'}
                Icon={BarChart3}
                sub="IKPG 40-69"
                colorCls="text-amber-600 dark:text-amber-400"
              />
              <StatCard
                label="Kerawanan Rendah"
                value={dist.Rendah ?? '-'}
                Icon={TrendingDown}
                sub="IKPG < 40"
                colorCls="text-red-600 dark:text-red-400"
              />
            </div>

            {/* Formula strip */}
            <Card className="p-5">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                Formula IKPG — 4 Kelas YOLO
              </p>
              <p className="font-mono text-sm text-slate-700 dark:text-slate-300 leading-loose">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">IKPG</span>
                {' = (0.5 x '}
                <span className="text-cyan-600 dark:text-cyan-400">GeoAI</span>
                {') + (0.3 x '}
                <span className="text-emerald-600 dark:text-emerald-400">Produksi</span>
                {') + (0.1 x '}
                <span className="text-amber-600 dark:text-amber-400">Kalori</span>
                {') + (0.1 x '}
                <span className="text-pink-600 dark:text-pink-400">Insecurity</span>
                {')'}
              </p>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-500 mt-1.5">
                <span className="text-cyan-600 dark:text-cyan-400">GeoAI</span>
                {' = clamp((+0.40 x Pepohonan%) + (+0.30 x Perairan%) - (0.20 x Bangunan%) - (0.10 x Jalan%) + 30, 0, 100)'}
              </p>
            </Card>

            {/* Map */}
            <Card className="overflow-hidden">
              <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Map size={15} className="text-slate-400 dark:text-slate-500" />
                  Peta Ketahanan Pangan per Provinsi
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  {[
                    ['#10b981', 'Tinggi >=70'],
                    ['#f59e0b', 'Sedang 40-69'],
                    ['#ef4444', 'Rendah <40'],
                  ].map(([c, l]) => (
                    <span key={l} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: c }}
                      />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ height: 420 }}>
                <PanganMap
                  geojson={d.geojson}
                  onProvinceClick={(prov) => {
                    setAnalisisProv(prov);
                    setTab('analisis');
                  }}
                />
              </div>
            </Card>

            {/* Province table */}
            <Card className="overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <FileText size={15} className="text-slate-400 dark:text-slate-500" />
                  Tabel Semua Provinsi
                </div>
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Cari provinsi..."
                    value={searchProv}
                    onChange={(e) => setSearchProv(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 w-52 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase w-8">
                        #
                      </th>
                      <SortTh col="prov"  label="Provinsi"   />
                      <SortTh col="ikpg"  label="IKPG"       />
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <SortTh col="geoai" label="GeoAI"      />
                      <SortTh col="prod"  label="Produksi"   />
                      <SortTh col="kal"   label="Kalori"     />
                      <SortTh col="insec" label="Insecurity" />
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        Data
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {provTable.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm"
                        >
                          Tidak ada data.
                        </td>
                      </tr>
                    ) : (
                      provTable.map((p, i) => {
                        const k  = p.komponen ?? {};
                        const sc = getSt(p.status);
                        return (
                          <tr
                            key={p.nama_provinsi}
                            onClick={() => {
                              setAnalisisProv(p.nama_provinsi);
                              setTab('analisis');
                            }}
                            className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3 text-slate-400 dark:text-slate-600 text-xs">
                              {i + 1}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {p.nama_provinsi}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${p.ikpg}%`, backgroundColor: p.warna }}
                                  />
                                </div>
                                <span
                                  className="font-bold font-mono text-sm"
                                  style={{ color: p.warna }}
                                >
                                  {p.ikpg}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.badge}`}
                              >
                                {p.status}
                              </span>
                            </td>
                            {[
                              k.geoai_weighted,
                              k.production_score,
                              k.calorie_score,
                              k.insecurity_score,
                            ].map((v, vi) => (
                              <td
                                key={vi}
                                className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-xs"
                              >
                                {v != null ? (
                                  v.toFixed(1)
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-xs">
                              {p.has_geoai_data ? (
                                <span className="text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-400/10 px-2 py-0.5 rounded-full font-medium">
                                  GeoAI
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                                Detail
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {provTable.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 text-xs text-slate-400 dark:text-slate-500">
                  Menampilkan {provTable.length} dari {dashData?.summary?.length ?? 0} provinsi
                  {searchProv && (
                    <>
                      {' — filter: '}
                      <span className="text-slate-600 dark:text-slate-300">{searchProv}</span>
                    </>
                  )}
                </div>
              )}
            </Card>

            {/* Refresh button — shown after first load */}
            <div className="flex justify-end">
              <button
                onClick={loadDashboard}
                disabled={dashLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
              >
                <RefreshCw size={12} className={dashLoading ? 'animate-spin' : ''} />
                Perbarui Data
              </button>
            </div>
          </>
        )}
      </div>
    );
  };


  // ANALISIS
  const renderAnalisis = () => {
    const r   = analisisResult;
    const k   = r?.komponen ?? {};
    const b   = r?.bobot_used ?? {};
    const p   = r?.proporsi_lahan ?? {};
    const raw = r?.bps_raw ?? {};
    const sc  = getSt(r?.status);

    return (
      <div className="space-y-5">
        <Card className="p-5">
          <SectionLabel>Pilih Provinsi</SectionLabel>
          <div className="flex gap-3">
            <select
              value={analisisProv}
              onChange={(e) => {
                setAnalisisProv(e.target.value);
                setAnalisisResult(null);
              }}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
            >
              <option value="">-- Pilih Provinsi --</option>
              {PROVINSI_LIST.map((pv) => (
                <option key={pv} value={pv}>{pv}</option>
              ))}
            </select>
            <button
              onClick={runAnalisis}
              disabled={analisisLoading || !analisisProv}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {analisisLoading ? (
                <><RefreshCw size={14} className="animate-spin" /> Menganalisis...</>
              ) : (
                <><Play size={14} /> Analisis</>
              )}
            </button>
          </div>
        </Card>

        {r && (
          <div className="space-y-5">
            {/* Hero gauge */}
            <Card className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <IkpgGauge ikpg={r.ikpg} status={r.status} />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                      Indeks Ketahanan Pangan Gabungan
                    </p>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {r.provinsi}
                    </h2>
                    <span
                      className={`inline-flex items-center mt-2 px-3 py-1 rounded-full border text-sm font-semibold ${sc.badge}`}
                    >
                      {r.status}
                    </span>
                    {!r.has_geoai_data && (
                      <div className="mt-2 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-lg px-3 py-2">
                        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                        Tanpa data GeoAI — bobot: Produksi 60%, Kalori 20%, Insecurity 20%
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${r.ikpg}%`, backgroundColor: sc.bar }}
                      />
                      <div className="absolute top-0 h-full w-px bg-amber-400/60" style={{ left: '40%' }} />
                      <div className="absolute top-0 h-full w-px bg-emerald-400/60" style={{ left: '70%' }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 dark:text-slate-600 mt-1">
                      <span>0</span>
                      <span className="text-amber-500">40</span>
                      <span className="text-emerald-500">70</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Score breakdown + proporsi */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <SectionLabel>Komponen Skor</SectionLabel>
                <ScoreBar
                  label="GeoAI Weighted (4 kelas)"
                  Icon={Satellite}
                  score={k.geoai_weighted}
                  weight={b.geoai ?? 0.5}
                  detail={r.has_geoai_data ? 'pepohonan · perairan · bangunan · jalan' : null}
                  noDataMsg={!r.has_geoai_data ? 'Data GeoAI tidak tersedia' : null}
                />
                <ScoreBar
                  label="Produksi Padi"
                  Icon={Wheat}
                  score={k.production_score}
                  weight={b.produksi ?? 0.3}
                  detail={
                    raw.produksi_padi_ton
                      ? `${(raw.produksi_padi_ton / 1e6).toFixed(2)} juta ton (2024)`
                      : null
                  }
                />
                <ScoreBar
                  label="Konsumsi Kalori"
                  Icon={UtensilsCrossed}
                  score={k.calorie_score}
                  weight={b.kalori ?? 0.1}
                  detail={
                    raw.kalori_kkal_perhari
                      ? `${raw.kalori_kkal_perhari} kkal/kapita/hari (2025)`
                      : null
                  }
                />
                <ScoreBar
                  label="Ketahanan Pangan"
                  Icon={AlertTriangle}
                  score={k.insecurity_score}
                  weight={b.insecurity ?? 0.1}
                  detail={
                    raw.prevalensi_insecurity_persen != null
                      ? `Prevalensi: ${raw.prevalensi_insecurity_persen}% (2025)`
                      : null
                  }
                />
              </div>

              <div>
                <SectionLabel>Proporsi Tutupan (4 Kelas GeoAI)</SectionLabel>
                {r.has_geoai_data && Object.keys(p).length > 0 ? (
                  <Card className="p-4 space-y-3">
                    <ProporsiBar label="Pepohonan / Vegetasi" Icon={Trees}     pct={p.pepohonan} color="#22c55e" />
                    <ProporsiBar label="Perairan"             Icon={Waves}     pct={p.perairan}  color="#3b82f6" />
                    <ProporsiBar label="Bangunan"             Icon={Building2} pct={p.bangunan}  color="#ef4444" />
                    <ProporsiBar label="Jalan"                Icon={Route}     pct={p.jalan}     color="#8b5cf6" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700 leading-relaxed font-mono">
                      GeoAI = (+0.40 x {p.pepohonan?.toFixed(1)}%) + (+0.30 x {p.perairan?.toFixed(1)}%)
                      {' - '}(0.20 x {p.bangunan?.toFixed(1)}%) - (0.10 x {p.jalan?.toFixed(1)}%)
                      {' + 30 = '}
                      <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                        {k.geoai_weighted?.toFixed(1)}
                      </span>
                    </p>
                  </Card>
                ) : (
                  <Card className="p-8 flex flex-col items-center justify-center text-center gap-3 min-h-48">
                    <Satellite size={32} className="text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      Belum ada data GeoAI untuk provinsi ini.
                      <br />
                      Simpan hasil deteksi ke{' '}
                      <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">
                        ai_features
                      </code>{' '}
                      terlebih dahulu.
                    </p>
                  </Card>
                )}
              </div>
            </div>

            {/* Rekomendasi */}
            {r.rekomendasi?.length > 0 && (
              <div>
                <SectionLabel>Rekomendasi Kebijakan</SectionLabel>
                <div className="grid md:grid-cols-2 gap-3">
                  {r.rekomendasi.map((rek, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Info size={12} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {rek.kategori}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {rek.pesan}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={saveAnalisis}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <Save size={14} /> Simpan Analisis
              </button>
              <button
                onClick={() => { setAnalisisResult(null); setAnalisisProv(''); }}
                className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm transition-colors"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };


  // METODOLOGI
  const renderMetodologi = () => (
    <div className="space-y-6">

      <MetSection title="Indeks Ketahanan Pangan Gabungan (IKPG)" Icon={Info}>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          IKPG adalah indeks komposit yang menggabungkan{' '}
          <strong className="text-slate-800 dark:text-slate-200">
            data spasial dari model YOLO custom (4 kelas)
          </strong>{' '}
          dengan{' '}
          <strong className="text-slate-800 dark:text-slate-200">statistik BPS</strong>
          {' '}untuk penilaian ketahanan pangan per provinsi.
          Nilai berkisar 0–100; semakin tinggi semakin baik.
        </p>
        <div className="grid grid-cols-3 gap-3 text-xs text-center">
          {[
            { label: 'Tinggi', range: 'IKPG >= 70', st: 'Tinggi' },
            { label: 'Sedang', range: '40 <= IKPG < 70', st: 'Sedang' },
            { label: 'Rendah', range: 'IKPG < 40',  st: 'Rendah' },
          ].map((c) => {
            const sc = getSt(c.st);
            return (
              <div key={c.label} className={`rounded-xl border p-3 ${sc.badge}`}>
                <div className={`font-bold text-sm mb-0.5 ${sc.text}`}>{c.label}</div>
                <div className="text-slate-500 dark:text-slate-400">{c.range}</div>
              </div>
            );
          })}
        </div>
      </MetSection>

      <MetSection title="Formula Utama IKPG" Icon={BarChart3}>
        <FormulaBox accent="indigo">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block mb-2">
            Dengan data GeoAI:
          </span>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">IKPG</span>
          {' = (0.50 x '}
          <span className="text-cyan-600 dark:text-cyan-400">GeoAI</span>
          {') + (0.30 x '}
          <span className="text-emerald-600 dark:text-emerald-400">Production</span>
          {') + (0.10 x '}
          <span className="text-amber-600 dark:text-amber-400">Calorie</span>
          {') + (0.10 x '}
          <span className="text-pink-600 dark:text-pink-400">Insecurity</span>
          {')'}
        </FormulaBox>
        <FormulaBox accent="amber">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block mb-2">
            Fallback — tanpa data GeoAI:
          </span>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">IKPG</span>
          {' = (0.60 x '}
          <span className="text-emerald-600 dark:text-emerald-400">Production</span>
          {') + (0.20 x '}
          <span className="text-amber-600 dark:text-amber-400">Calorie</span>
          {') + (0.20 x '}
          <span className="text-pink-600 dark:text-pink-400">Insecurity</span>
          {')'}
        </FormulaBox>
        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Rasionalisasi bobot:</strong>
          {' '}GeoAI mendapat bobot terbesar (50%) karena mencerminkan kondisi tutupan lahan aktual.
          Produksi padi 30% sebagai output utama. Kalori dan insecurity masing-masing 10%.
          Tanpa GeoAI, bobot diredistribusi ke komponen BPS.
        </p>
      </MetSection>

      <MetSection title="Formula GeoAI Weighted — 4 Kelas YOLO Custom" Icon={Satellite}>
        <p className="text-xs text-slate-500 dark:text-slate-400 bg-cyan-50 dark:bg-cyan-500/5 border border-cyan-200 dark:border-cyan-500/20 rounded-xl p-3 leading-relaxed">
          Model YOLO dilatih sendiri dengan{' '}
          <strong className="text-slate-700 dark:text-slate-300">4 kelas</strong>:
          pepohonan, perairan, bangunan, jalan.
          Tidak ada kelas "lahan pertanian" — sistem menggunakan proxy ekologis.
        </p>
        <FormulaBox accent="cyan">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block mb-2">
            Raw score kemudian dinormalisasi ke [0, 100]:
          </span>
          <span className="text-slate-500 dark:text-slate-400">raw = </span>
          <span className="text-emerald-600 dark:text-emerald-400">(+0.40 x Pepohonan%)</span>
          {' + '}
          <span className="text-blue-600 dark:text-blue-400">(+0.30 x Perairan%)</span>
          {' - '}
          <span className="text-red-600 dark:text-red-400">(0.20 x Bangunan%)</span>
          {' - '}
          <span className="text-purple-600 dark:text-purple-400">(0.10 x Jalan%)</span>
          <br />
          <span className="text-cyan-600 dark:text-cyan-400 font-bold">GeoAI</span>
          <span className="text-slate-500 dark:text-slate-400"> = clamp(raw + 30, 0, 100)</span>
          <br />
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans block mt-2">
            Offset +30: terburuk (100% bangunan, raw=-20) = skor 10.
            Terbaik (100% pepohonan, raw=40) = skor 70.
          </span>
        </FormulaBox>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {[
            {
              Icon: Trees, label: 'Pepohonan', bobot: '+40%',
              colorCls: 'text-emerald-600 dark:text-emerald-400',
              desc: 'Tutupan vegetasi = ekosistem sehat, siklus air terjaga.',
            },
            {
              Icon: Waves, label: 'Perairan', bobot: '+30%',
              colorCls: 'text-blue-600 dark:text-blue-400',
              desc: 'Sumber air dan irigasi — krusial untuk produktivitas lahan.',
            },
            {
              Icon: Building2, label: 'Bangunan (Penalti)', bobot: '-20%',
              colorCls: 'text-red-600 dark:text-red-400',
              desc: 'Alih fungsi lahan produktif. Penalti besar.',
            },
            {
              Icon: Route, label: 'Jalan (Penalti)', bobot: '-10%',
              colorCls: 'text-purple-600 dark:text-purple-400',
              desc: 'Fragmentasi lahan. Penalti kecil karena juga mendukung distribusi.',
            },
          ].map((item) => (
            <Card key={item.label} className="p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <item.Icon size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                <span className={`ml-auto font-mono font-bold ${item.colorCls}`}>{item.bobot}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </Card>
          ))}
        </div>
      </MetSection>

      <MetSection title="Komponen BPS" Icon={BarChart3}>
        <div className="space-y-4">
          {[
            {
              Icon: Wheat, label: 'Produksi Padi — Production_Score', bobot: '30%', accent: 'emerald',
              colorCls: 'text-emerald-600 dark:text-emerald-400',
              formula: (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400">Production_Score</span>
                  {' = (Produksi_Prov - Min) / (Max - Min) x 100'}
                </>
              ),
              desc: 'Min-Max Normalisasi. Produksi padi (ton) dipetakan ke skala 0-100 relatif terhadap seluruh provinsi.',
              src: 'BPS Web API — mms/557, Tahun 2024',
            },
            {
              Icon: UtensilsCrossed, label: 'Konsumsi Kalori — Calorie_Score', bobot: '10%', accent: 'amber',
              colorCls: 'text-amber-600 dark:text-amber-400',
              formula: (
                <>
                  <span className="text-amber-600 dark:text-amber-400">Calorie_Score</span>
                  {' = min( (Kalori / 2100) x 100, 100 )'}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans block mt-1">
                    AKG = 2100 kkal/kapita/hari (Permenkes 2019)
                  </span>
                </>
              ),
              desc: 'Rasio terhadap Angka Kecukupan Gizi. Skor 100 jika konsumsi memenuhi atau melebihi AKG.',
              src: 'BPS Web API — Var 951, Tahun 2025',
            },
            {
              Icon: AlertTriangle, label: 'Ketidakcukupan Pangan — Insecurity_Score', bobot: '10%', accent: 'pink',
              colorCls: 'text-pink-600 dark:text-pink-400',
              formula: (
                <>
                  <span className="text-pink-600 dark:text-pink-400">Insecurity_Score</span>
                  {' = max(100 - Prevalensi_Persen, 0)'}
                </>
              ),
              desc: 'Inversi prevalensi: makin tinggi prevalensi ketidakcukupan, skor makin rendah.',
              src: 'BPS Web API — Var 1473, Tahun 2025',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/20"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <item.Icon size={14} className="text-slate-400 dark:text-slate-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                    {item.label}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ${item.colorCls}`}
                >
                  Bobot {item.bobot}
                </span>
              </div>
              <FormulaBox accent={item.accent}>{item.formula}</FormulaBox>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{item.desc}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                <strong className="text-slate-500 dark:text-slate-400">Sumber:</strong> {item.src}
              </p>
            </div>
          ))}
        </div>
      </MetSection>
    </div>
  );


  // RIWAYAT
  const renderRiwayat = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Riwayat Analisis IKPG</SectionLabel>
        <button
          onClick={loadHistory}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {histLoading && (
        <Card className="p-10 text-center">
          <RefreshCw size={22} className="text-slate-300 dark:text-slate-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Memuat riwayat...</p>
        </Card>
      )}

      {!histLoading && history.length === 0 && (
        <Card className="p-14 text-center">
          <History size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada analisis tersimpan.</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {history.map((item) => {
          const k  = item.komponen ?? {};
          const b  = item.bobot_used ?? {};
          const sc = getSt(item.status);
          return (
            <Card key={item.analysis_id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.provinsi}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {item.timestamp
                      ? new Date(item.timestamp).toLocaleString('id-ID')
                      : ''}
                  </div>
                </div>
                <button
                  onClick={() => deleteHistory(item.analysis_id)}
                  className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                >
                  <XCircle size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-2xl font-black ${sc.text}`}>{item.ikpg}</div>
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.ikpg}%`, backgroundColor: sc.bar }}
                    />
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.badge}`}>
                  {item.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'GeoAI',      val: k.geoai_weighted,   bobot: b.geoai,      Icon: Satellite },
                  { label: 'Produksi',   val: k.production_score, bobot: b.produksi,   Icon: Wheat },
                  { label: 'Kalori',     val: k.calorie_score,    bobot: b.kalori,     Icon: UtensilsCrossed },
                  { label: 'Insecurity', val: k.insecurity_score, bobot: b.insecurity, Icon: AlertTriangle },
                ].map(({ label, val, bobot, Icon: Ic }) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/40 rounded-lg px-2 py-1.5"
                  >
                    <Ic size={11} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    <div>
                      <div className="text-slate-400 dark:text-slate-500">{label}</div>
                      <div className="font-mono text-slate-700 dark:text-slate-300">
                        {val != null ? val.toFixed(1) : '-'}
                        <span className="text-slate-400 dark:text-slate-600">
                          {' '}({((bobot ?? 0) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {item.has_geoai_data && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-400/10 rounded-lg px-2 py-1">
                  <Satellite size={10} /> Data GeoAI tersedia
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );


  // LAYOUT

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Fixed top bar — z-[1200] — provided by HeaderBar itself */}
      <HeaderBar />

      {/*
        Sub-header: sticky, sits just below the fixed HeaderBar.
        top-16 = 64px = height of HeaderBar
        z-[100] keeps it below HeaderBar (z-[1200]) but above page content
      */}
      <div className="sticky top-16 z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          {/* Title row */}
          <div className="flex items-center justify-between py-3">
            <div>
              <h1 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
                Ketahanan Pangan Nasional
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                IKPG &middot; BPS Web API &middot; Hasil Deteksi Citra 4 Kelas
              </p>
            </div>
            {/* Show refresh only after data is loaded */}
            {dashData && tab === 'dashboard' && (
              <button
                onClick={loadDashboard}
                disabled={dashLoading}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
              >
                <RefreshCw size={11} className={dashLoading ? 'animate-spin' : ''} />
                {dashLoading ? 'Memuat...' : 'Refresh Data'}
              </button>
            )}
          </div>

          {/* Tab row — no bottom padding, border from parent */}
          <div className="flex gap-0.5 overflow-x-auto">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                  tab === id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page content — pt-6 is enough since sticky sub-header handles own space */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {tab === 'dashboard'  && renderDashboard()}
        {tab === 'analisis'   && renderAnalisis()}
        {tab === 'metodologi' && renderMetodologi()}
        {tab === 'riwayat'    && renderRiwayat()}
      </main>

      <Footerauth />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}