"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Download, ChevronDown, Info, FileText, Calendar,
  BarChart2, Check, TrendingUp, TrendingDown, ClipboardList, BookOpen,
  AlertCircle, CheckCircle2, XCircle,
  Search, X, Activity, ExternalLink, Brain, Loader2,
  Plus, Pencil, Trash2, Save, RefreshCw, ChevronRight,
  EyeOff, Eye, ChevronUp,
  ArrowLeftRight, Filter, Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  INDIKATOR_LABELS_SDM,
  INDIKATOR_COLORS_SDM,
  INDIKATOR_ICON_SDM,
  TAHUN_TERSEDIA_SDM,
  TAHUN_BPS_AKTUAL,
  DATASET_LABELS_SDM,
  isPrediksiYear,
} from './petaSdm';

const cn = (...cls) => cls.filter(Boolean).join(' ');
const API_BASE = 'http://127.0.0.1:8000/api';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const LABEL_INDEKS_UTAMA = { ALL: 'ISDM', KESEHATAN: 'IK', PENDIDIKAN: 'IP', DAYA_BELI: 'IDB' };

const TABS = [
  { id: 'info',      label: 'Info',       Icon: Info },
  { id: 'kebijakan', label: 'Kebijakan',  Icon: ClipboardList },
  { id: 'metadata',  label: 'Metodologi', Icon: BookOpen },
  { id: 'tren',      label: 'Tren',       Icon: TrendingUp },
];

const STATUS_LIST = ['TINGGI', 'SEDANG', 'RENDAH'];
const STATUS_COLORS = {
  TINGGI: { bg: '#10b981', light: '#ecfdf5', lightDark: '#064e3b', border: '#6ee7b7', text: '#065f46', textDark: '#a7f3d0', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  SEDANG: { bg: '#f59e0b', light: '#fffbeb', lightDark: '#451a03', border: '#fcd34d', text: '#92400e', textDark: '#fde68a', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  RENDAH: { bg: '#ef4444', light: '#fef2f2', lightDark: '#450a0a', border: '#fca5a5', text: '#991b1b', textDark: '#fecaca', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

const PILAR_LIST = [
  'Transformasi', 'Sistem Informasi', 'Kebijakan & Regulasi',
  'Intervensi Sektoral', 'Produktivitas', 'Stabilitas',
  'Perencanaan & Data', 'Kapasitas SDM', 'Infrastruktur', 'Pemberdayaan Masyarakat',
];
const PILAR_COLORS = {
  'Transformasi': '#6366f1', 'Sistem Informasi': '#3b82f6',
  'Kebijakan & Regulasi': '#10b981', 'Intervensi Sektoral': '#f59e0b',
  'Produktivitas': '#ef4444', 'Stabilitas': '#8b5cf6',
  'Perencanaan & Data': '#06b6d4', 'Kapasitas SDM': '#ec4899',
  'Infrastruktur': '#14b8a6', 'Pemberdayaan Masyarakat': '#f97316',
};
const getPilarColor = (p) => PILAR_COLORS[p] || '#6366f1';

const INDIKATOR_TERKAIT_LIST = ['IK', 'IP', 'IDB', 'ALL'];
const PRIORITAS_LABELS = {
  1: 'Perkuatan Kebijakan', 2: 'Pengembangan Kapasitas',
  3: 'Peningkatan Layanan', 4: 'Penguatan Daya Beli',
  5: 'Efektivitas Program', 6: 'Kesiapsiagaan & Inovasi',
  7: 'Pemulihan & Jaminan',
};

const EMPTY_FORM = {
  status: 'SEDANG', prioritas: 1, pilar_kebijakan: 'Transformasi',
  isu_strategis: '', kebijakan: '', rekomendasi_program: '', indikator_terkait: 'IK',
};

// BPS dataset links
const BPS_LINKS = {
  UHH:         'https://www.bps.go.id/id/statistics-table/2/NDE0IzI=/-metode-baru--umur-harapan-hidup-saat-lahir--uhh---tahun-.html',
  RLS:         'https://www.bps.go.id/id/statistics-table/2/NDE1IzI=/-metode-baru--rata-rata-lama-sekolah--tahun-.html',
  HLS:         'https://www.bps.go.id/id/statistics-table/2/NDE3IzI=/-metode-baru--harapan-lama-sekolah--tahun-.html',
  PENGELUARAN: 'https://www.bps.go.id/assets/statistics-table/2/NDE2IzI=/-metode-baru--pengeluaran-per-kapita-disesuaikan.html',
};

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useBankKebijakan() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-sdm/`)
      .then(r => { setData(r.data.results || []); setError(null); })
      .catch(e => { console.error(e); setError('Gagal memuat data.'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

function useBankISDM() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-isdm-provinsi/`)
      .then(r => setData(r.data.flat || []))
      .catch(e => console.error('gagal load bank isdm', e))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, load };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function StatusBadge({ status, size = 'sm' }) {
  const sc = STATUS_COLORS[status];
  if (!sc) return null;
  return (
    <span className={cn('inline-flex items-center font-bold rounded-full', size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5', sc.badge)}>
      {status}
    </span>
  );
}

function ArimaBadge({ skenario, size = 'sm', keys = [] }) {
  if (!skenario) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold rounded-full border', size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5')}
      style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderColor: '#a5b4fc', color: '#4f46e5' }}>
      <Brain size={size === 'xs' ? 8 : 10} />
      ARIMA · {skenario}
      {keys.length > 0 && size !== 'xs' && <span className="opacity-70 ml-0.5">({keys.join(', ')})</span>}
    </span>
  );
}

// ─── ARIMA METRICS DETAIL ────────────────────────────────────────────────────
function ArimaMetricsDetail({ metrics, skenario, tahun }) {
  const [open, setOpen] = useState(false);
  if (!metrics || !Object.values(metrics).some(m => m?.cv_wmape != null)) return null;

  const getLevel = (w) => {
    if (w == null) return null;
    if (w < 2)  return { grade: '🥇', label: 'Sangat Baik',     color: '#10b981' };
    if (w < 5)  return { grade: '✅', label: 'Baik',            color: '#3b82f6' };
    if (w < 10) return { grade: '⚠️', label: 'Cukup',           color: '#f59e0b' };
    return              { grade: '❌', label: 'Perlu Perhatian', color: '#ef4444' };
  };

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 dark:border-indigo-700 overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Brain size={14} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
          <div className="text-left">
            <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Performa Model ARIMA v4.0</div>
            <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">Skenario {skenario} · Proyeksi {tahun}</div>
          </div>
        </div>
        <ChevronDown size={13} className={cn('text-indigo-400 dark:text-indigo-500 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-100 dark:border-indigo-800/60">
          {Object.entries(metrics).map(([key, m]) => {
            if (!m) return null;
            const lv = getLevel(m.cv_wmape);
            const pctBar = m.cv_wmape != null ? Math.min(100, (m.cv_wmape / 10) * 100) : 0;
            return (
              <div key={key} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 mt-3">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {DATASET_LABELS_SDM[key] || key}
                  </span>
                  {lv && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full border"
                      style={{ color: lv.color, backgroundColor: lv.color + '18', borderColor: lv.color + '50' }}
                    >
                      {lv.grade} {lv.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    ['CV-MAE',   m.cv_mae?.toFixed(4)  ?? '-'],
                    ['CV-RMSE',  m.cv_rmse?.toFixed(4) ?? '-'],
                    ['CV-WMAPE', m.cv_wmape != null ? `${m.cv_wmape.toFixed(2)}%` : '-'],
                  ].map(([label, val]) => (
                    <div key={label} className="text-center rounded-lg py-2 bg-slate-50 dark:bg-slate-700">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</div>
                      <div className="text-sm font-black mt-0.5 text-slate-800 dark:text-slate-100">{val}</div>
                    </div>
                  ))}
                </div>
                {m.cv_wmape != null && lv && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pctBar}%`, backgroundColor: lv.color }}
                      />
                    </div>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: lv.color }}>
                      {m.cv_wmape.toFixed(2)}%
                    </span>
                  </div>
                )}
                {m.n_wilayah && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Dilatih {m.n_wilayah} wilayah · ARIMA v4.0
                    {m.tahun_historis && Array.isArray(m.tahun_historis) &&
                      ` · ${Math.min(...m.tahun_historis)}–${Math.max(...m.tahun_historis)}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl px-4 py-3 text-sm">
      <div className="font-bold text-slate-900 dark:text-white mb-2">Tahun {label}</div>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODAL PILIH DARI BANK KEBIJAKAN ISDM
// ══════════════════════════════════════════════════════════════════════════════
function ModalPilihBank({ onClose, onPilih, bankData, loading, statusHint = '' }) {
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState(statusHint || 'SEMUA');
  const [filterPilar, setPilar]   = useState('SEMUA');

  const allPilars = useMemo(() => [...new Set(bankData.map(d => d.pilar).filter(Boolean))].sort(), [bankData]);

  const filtered = useMemo(() => {
    let d = bankData;
    if (filterStatus !== 'SEMUA') d = d.filter(x => x.status === filterStatus);
    if (filterPilar  !== 'SEMUA') d = d.filter(x => x.pilar  === filterPilar);
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(x => x.kebijakan?.toLowerCase().includes(q) || x.isu_strategis?.toLowerCase().includes(q) || x.pilar?.toLowerCase().includes(q));
    }
    return d;
  }, [bankData, filterStatus, filterPilar, search]);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Layers size={13} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm">Pilih dari Bank Kebijakan ISDM</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{filtered.length} kebijakan tersedia</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={14} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kebijakan…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
          </div>
          <select value={filterStatus} onChange={e => setFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            <option value="SEMUA">Semua Status</option>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPilar} onChange={e => setPilar(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            <option value="SEMUA">Semua Pilar</option>
            {allPilars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 size={17} className="animate-spin" />
              <span className="text-sm">Memuat bank kebijakan…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">Tidak ada kebijakan cocok</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.map(item => {
                const sc = STATUS_COLORS[item.status];
                const pc = getPilarColor(item.pilar);
                return (
                  <button key={item.id} onClick={() => onPilih(item)}
                    className="w-full text-left px-5 py-3.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors flex items-start gap-3">
                    <div className="flex flex-col gap-1 mt-0.5 flex-shrink-0">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: sc?.bg || '#94a3b8' }}>{item.status}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: pc, backgroundColor: pc + '18' }}>P{item.prioritas}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold mb-0.5" style={{ color: pc }}>{item.pilar}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{item.kebijakan}</p>
                      {item.isu_strategis && <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-0.5 line-clamp-1">Isu: {item.isu_strategis}</p>}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{item.rekomendasi}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5"
                      style={{ borderColor: pc + '50', color: pc, backgroundColor: pc + '10' }}>{item.indikator_terkait}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL DETAIL PROVINSI
// ══════════════════════════════════════════════════════════════════════════════
function ModalDetailProvinsi({
  provinsiNama, popupData, popupFitur,
  getWarna, getKategori, indikatorTerpilih, labelIdx,
  analysisId, onClose, onRekomendasiSaved,
}) {
  const { data: bankData, loading: bankLoading, load: loadBank } = useBankISDM();

  const [rekLocal, setRekLocal]       = useState(() => JSON.parse(JSON.stringify(popupData?.rekomendasi || [])));
  const [isDirty, setIsDirty]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');
  const [bankModal, setBankModal]     = useState(null);
  const [expandedPilars, setExpanded] = useState({});

  const togglePilar = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));
  const markDirty = () => setIsDirty(true);

  const toggleDisabled = (pilarIdx, aksiIdx) => {
    setRekLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const aksi = next[pilarIdx]?.aksi?.[aksiIdx];
      if (aksi) aksi.disabled = !aksi.disabled;
      return next;
    });
    markDirty();
  };

  const removeAksi = (pilarIdx, aksiIdx) => {
    setRekLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[pilarIdx].aksi.splice(aksiIdx, 1);
      next[pilarIdx].jumlah_aksi = next[pilarIdx].aksi.length;
      if (next[pilarIdx].aksi.length === 0) next.splice(pilarIdx, 1);
      return next;
    });
    markDirty();
  };

  const bankToAksi = (item, noAksi = 1) => ({
    no_aksi:           noAksi,
    bank_id:           item.id,
    isu_strategis:     item.isu_strategis || '',
    nama_aksi:         item.kebijakan || '',
    detail_aksi:       item.rekomendasi || '',
    indikator_terkait: item.indikator_terkait || '',
    sub_sektor:        item.pilar || '',
    disabled:          false,
  });

  const handlePilihBank = (item) => {
    if (!bankModal) return;
    setBankModal(null);
    setRekLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const { mode, pilarIdx, aksiIdx } = bankModal;
      if (mode === 'replace') {
        const aksi = next[pilarIdx]?.aksi?.[aksiIdx];
        if (aksi) {
          const newAksi = bankToAksi(item, aksi.no_aksi);
          next[pilarIdx].aksi[aksiIdx] = newAksi;
          if (item.pilar && item.pilar !== next[pilarIdx].pilar) {
            next[pilarIdx].aksi.splice(aksiIdx, 1);
            next[pilarIdx].jumlah_aksi = next[pilarIdx].aksi.length;
            const existingPilarIdx = next.findIndex(p => p.pilar === item.pilar);
            if (existingPilarIdx >= 0) {
              next[existingPilarIdx].aksi.push({ ...newAksi, no_aksi: next[existingPilarIdx].aksi.length + 1 });
              next[existingPilarIdx].jumlah_aksi = next[existingPilarIdx].aksi.length;
            } else {
              next.push({ pilar: item.pilar, prioritas: item.prioritas || 5, jumlah_aksi: 1, aksi: [{ ...newAksi, no_aksi: 1 }] });
            }
            if (next[pilarIdx].aksi.length === 0) next.splice(pilarIdx, 1);
          }
        }
      } else if (mode === 'add_to_pilar') {
        const pilar = next[pilarIdx];
        if (pilar) {
          pilar.aksi.push(bankToAksi(item, pilar.aksi.length + 1));
          pilar.jumlah_aksi = pilar.aksi.length;
        }
      } else {
        const existingPilarIdx = next.findIndex(p => p.pilar === item.pilar);
        if (existingPilarIdx >= 0) {
          next[existingPilarIdx].aksi.push(bankToAksi(item, next[existingPilarIdx].aksi.length + 1));
          next[existingPilarIdx].jumlah_aksi = next[existingPilarIdx].aksi.length;
        } else {
          next.push({ pilar: item.pilar, prioritas: item.prioritas || 5, jumlah_aksi: 1, aksi: [bankToAksi(item, 1)] });
        }
      }
      return next;
    });
    markDirty();
  };

  const handleSave = async () => {
    if (!analysisId) {
      setSaveMsg('⚠️ Simpan analisis dulu lewat tombol "Simpan" di peta.');
      setTimeout(() => setSaveMsg(''), 4000);
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      await axios.patch(`${API_BASE}/sdm-analysis/${analysisId}/provinsi-kebijakan/`, {
        nama_provinsi: provinsiNama,
        rekomendasi:   rekLocal,
      });
      setSaveMsg('✅ Berhasil disimpan!');
      setIsDirty(false);
      onRekomendasiSaved?.(provinsiNama, rekLocal);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      console.error(e);
      setSaveMsg(`❌ Gagal: ${e.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const warna = popupFitur ? getWarna(popupFitur, indikatorTerpilih) : '#6366f1';
  const kat   = popupFitur ? getKategori(popupFitur, indikatorTerpilih) : '-';

  return (
    <>
      <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={e => e.target === e.currentTarget && !isDirty && onClose()}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0" style={{ borderLeft: `4px solid ${warna}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{popupData?.nama_provinsi}</h3>
                  {popupData?.use_arima && <ArimaBadge skenario={popupData?.skenario_arima} keys={popupData?.arima_keys_used} />}
                  {isDirty && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      ● Ada perubahan belum disimpan
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={kat} />
                  <span className="text-sm font-mono font-black" style={{ color: warna }}>
                    {labelIdx} {popupData?.indeks_sdm ?? '-'}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex-shrink-0">
                <X size={16} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>

          <div className="px-6 py-2.5 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => { loadBank(); setBankModal({ mode: 'add_new' }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
                <Plus size={11} /> Tambah Kebijakan
              </button>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {rekLocal.reduce((s, p) => s + (p.aksi?.filter(a => !a.disabled).length || 0), 0)} aktif
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saveMsg && <span className="text-xs font-semibold">{saveMsg}</span>}
              <button onClick={handleSave} disabled={!isDirty || saving}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  isDirty ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed')}>
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {rekLocal.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <AlertCircle size={26} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm mb-3">Belum ada rekomendasi kebijakan.</p>
                <button onClick={() => { loadBank(); setBankModal({ mode: 'add_new' }); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold">
                  + Tambah dari Bank Kebijakan
                </button>
              </div>
            ) : rekLocal.map((kelompok, ki) => {
              const pc      = getPilarColor(kelompok.pilar);
              const isOpen  = expandedPilars[ki] !== false;
              const aktif   = kelompok.aksi?.filter(a => !a.disabled).length || 0;
              const nonaktif = kelompok.aksi?.filter(a => a.disabled).length  || 0;
              return (
                <div key={ki} className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <button onClick={() => togglePilar(ki)} className="flex items-center gap-3 px-4 py-2.5 w-full text-left" style={{ backgroundColor: pc + '15', borderBottom: isOpen ? `1px solid ${pc}30` : 'none' }}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pc }} />
                    <span className="text-sm font-bold flex-1" style={{ color: pc }}>{kelompok.pilar}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{aktif} aktif{nonaktif > 0 ? ` · ${nonaktif} nonaktif` : ''}</span>
                    {isOpen ? <ChevronUp size={12} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {kelompok.aksi?.map((aksi, ai) => (
                        <div key={ai} className={cn('px-4 py-3 flex items-start gap-3 transition-colors', aksi.disabled ? 'opacity-40 bg-slate-50 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800/20')}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-black"
                            style={{ backgroundColor: aksi.disabled ? '#94a3b8' : pc }}>{aksi.no_aksi || ai + 1}</span>
                          <div className="flex-1 min-w-0">
                            {aksi.disabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 mr-1">NONAKTIF</span>}
                            {aksi.isu_strategis && <p className="text-xs italic text-slate-400 dark:text-slate-500 mb-0.5">Isu: {aksi.isu_strategis}</p>}
                            <p className={cn('text-sm font-semibold leading-snug', aksi.disabled ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{aksi.nama_aksi}</p>
                            {aksi.detail_aksi && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{aksi.detail_aksi}</p>}
                            {aksi.indikator_terkait && (
                              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded font-semibold">{aksi.indikator_terkait}</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={() => { loadBank(); setBankModal({ mode: 'replace', pilarIdx: ki, aksiIdx: ai }); }}
                              title="Ganti" className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-blue-500">
                              <ArrowLeftRight size={11} />
                            </button>
                            <button onClick={() => toggleDisabled(ki, ai)}
                              title={aksi.disabled ? 'Aktifkan' : 'Nonaktifkan'}
                              className={cn('p-1.5 rounded-lg transition-colors', aksi.disabled ? 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500' : 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-500')}>
                              {aksi.disabled ? <Eye size={11} /> : <EyeOff size={11} />}
                            </button>
                            <button onClick={() => removeAksi(ki, ai)}
                              title="Hapus" className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-400">
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">
              💡 <span className="not-italic font-semibold">Nonaktifkan</span> = tandai tidak dipakai. <span className="not-italic font-semibold">Hapus</span> = hilangkan dari daftar.
            </p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors">
              Tutup
            </button>
          </div>
        </div>
      </div>

      {bankModal && (
        <ModalPilihBank
          onClose={() => setBankModal(null)}
          onPilih={handlePilihBank}
          bankData={bankData}
          loading={bankLoading}
          statusHint={popupData ? getKategori(popupFitur, indikatorTerpilih) : ''}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB INFO
// ══════════════════════════════════════════════════════════════════════════════
function TabInfo({ hasilAnalisis, jumlahKategori, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, eksporData, getWarna, getKategori, arimaSkenario }) {
  const [menuUnduh, setMenuUnduh] = useState(false);

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih, getKategori]);

  if (!hasilAnalisis) return (
    <div className="py-16 text-center">
      <BarChart2 size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-base text-slate-500 dark:text-slate-400">Belum ada data. Klik <strong className="text-slate-700 dark:text-slate-200">Analisis SDM</strong> di peta untuk memulai.</p>
    </div>
  );

  const labelIdx   = LABEL_INDEKS_UTAMA[indikatorTerpilih] ?? 'ISDM';
  const showUHH    = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'KESEHATAN';
  const showRLS    = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'PENDIDIKAN';
  const showHLS    = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'PENDIDIKAN';
  const showPeng   = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'DAYA_BELI';
  const useArima   = hasilAnalisis.use_arima;
  const arimaKeys  = hasilAnalisis.arima_keys || [];
  const arimaM     = hasilAnalisis.arima_metrics || {};
  const tahun      = hasilAnalisis.tahun;
  const isPrediksi = hasilAnalisis.is_prediction_year;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
            <Calendar size={11} /> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        {tahun && (
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border',
            isPrediksi
              ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700'
              : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600')}>
            <Calendar size={11} /> Tahun {tahun}
            {isPrediksi && <span className="ml-1 text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold">Prediksi</span>}
          </span>
        )}
        {useArima && arimaSkenario && <ArimaBadge skenario={arimaSkenario} keys={arimaKeys} />}
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
          {indikatorTerpilih === 'ALL' ? 'Formula ISDM Gabungan' : `Formula ${labelIdx}`}
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 font-mono leading-relaxed">
          {indikatorTerpilih === 'ALL'        && 'IK = UHH/85 · IP = (RLS/15+HLS/18)/2 · IDB = MinMax(Pengeluaran) · ISDM = (IK+IP+IDB)/3'}
          {indikatorTerpilih === 'KESEHATAN'  && 'IK = UHH / 85'}
          {indikatorTerpilih === 'PENDIDIKAN' && 'IP = (RLS/15 + HLS/18) / 2'}
          {indikatorTerpilih === 'DAYA_BELI'  && 'IDB = (Pengeluaran - min) / (max - min)'}
        </p>
      </div>

      {useArima && Object.keys(arimaM).length > 0 && (
        <ArimaMetricsDetail metrics={arimaM} skenario={arimaSkenario} tahun={tahun} />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Provinsi', val: hasilAnalisis.total_success || 0, cls: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800', valCls: 'text-indigo-700 dark:text-indigo-200' },
          { label: 'TINGGI', val: jumlahKategori['TINGGI'] ?? 0, cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800', valCls: 'text-emerald-700 dark:text-emerald-200' },
          { label: 'SEDANG', val: jumlahKategori['SEDANG'] ?? 0, cls: 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800', valCls: 'text-amber-700 dark:text-amber-200' },
          { label: 'RENDAH', val: jumlahKategori['RENDAH'] ?? 0, cls: 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800', valCls: 'text-red-700 dark:text-red-200' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-4', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-3xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{dataTerfilter.length} provinsi · Tahun {tahun}</p>
          <div className="flex items-center gap-2">
            <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
              className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
              {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="relative">
              <button onClick={() => setMenuUnduh(!menuUnduh)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-colors">
                <Download size={13} /> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-600 py-1">
                  {['EXCEL', 'CSV', 'JSON', 'GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                      <Download size={11} className="text-indigo-500" /> {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-center w-10">No</th>
                <th className="px-4 py-3 text-left">Provinsi</th>
                <th className="px-4 py-3 text-center">{labelIdx}</th>
                {showUHH  && <th className="px-4 py-3 text-center">UHH</th>}
                {showRLS  && <th className="px-4 py-3 text-center">RLS</th>}
                {showHLS  && <th className="px-4 py-3 text-center">HLS</th>}
                {showPeng && <th className="px-4 py-3 text-center">Pengeluaran</th>}
                {indikatorTerpilih === 'ALL' && <>
                  <th className="px-4 py-3 text-center">IK</th>
                  <th className="px-4 py-3 text-center">IP</th>
                  <th className="px-4 py-3 text-center">IDB</th>
                </>}
                <th className="px-4 py-3 text-center">Kategori</th>
                {useArima && <th className="px-4 py-3 text-center">Sumber</th>}
              </tr>
            </thead>
            <tbody>
              {dataTerfilter.map((fitur, idx) => {
                const d       = fitur.properties.sdm_analysis;
                const dc      = d.data_komponen || {};
                const w       = getWarna(fitur, indikatorTerpilih);
                const kat     = getKategori(fitur, indikatorTerpilih);
                const rowArima = d.use_arima;
                const rowKeys  = d.arima_keys_used || [];
                const aiCell   = (k) => rowArima && rowKeys.includes(k);
                return (
                  <tr key={d.nama_provinsi}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-3 py-3 text-center text-sm text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w }} />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                        {d.rekomendasi_edited && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">✎ Diedit</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_sdm ?? '-'}</span>
                    </td>
                    {showUHH  && <td className="px-4 py-3 text-center text-sm"><span className={cn(aiCell('UHH') ? 'text-indigo-500 dark:text-indigo-300 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{dc.UHH ?? '-'}{aiCell('UHH') && <span className="ml-0.5 text-xs">⚙️</span>}</span></td>}
                    {showRLS  && <td className="px-4 py-3 text-center text-sm"><span className={cn(aiCell('RLS') ? 'text-indigo-500 dark:text-indigo-300 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{dc.RLS ?? '-'}{aiCell('RLS') && <span className="ml-0.5 text-xs">⚙️</span>}</span></td>}
                    {showHLS  && <td className="px-4 py-3 text-center text-sm"><span className={cn(aiCell('HLS') ? 'text-indigo-500 dark:text-indigo-300 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{dc.HLS ?? '-'}{aiCell('HLS') && <span className="ml-0.5 text-xs">⚙️</span>}</span></td>}
                    {showPeng && <td className="px-4 py-3 text-center text-sm"><span className={cn(aiCell('DAYA_BELI') ? 'text-indigo-500 dark:text-indigo-300 font-semibold' : 'text-slate-600 dark:text-slate-300')}>{dc.DAYA_BELI ? dc.DAYA_BELI.toLocaleString('id-ID') : '-'}{aiCell('DAYA_BELI') && <span className="ml-0.5 text-xs">⚙️</span>}</span></td>}
                    {indikatorTerpilih === 'ALL' && <>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">{d.ik ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">{d.ip ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-amber-600 dark:text-amber-400">{d.idb ?? '-'}</td>
                    </>}
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold border" style={{ borderColor: w + '60', color: w, backgroundColor: w + '15' }}>{kat}</span>
                    </td>
                    {useArima && (
                      <td className="px-4 py-3 text-center">
                        {rowArima ? <ArimaBadge skenario={d.skenario_arima} size="xs" />
                          : <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">BPS</span>}
                      </td>
                    )}
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

// ══════════════════════════════════════════════════════════════════════════════
// MODAL TAMBAH / EDIT KEBIJAKAN
// ══════════════════════════════════════════════════════════════════════════════
function ModalKebijakan({ mode, data, onClose, onSaved }) {
  const [form, setForm]     = useState(mode === 'edit' ? { ...data } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.kebijakan.trim())           e.kebijakan = 'Wajib diisi';
    if (!form.rekomendasi_program.trim()) e.rekomendasi_program = 'Wajib diisi';
    if (!form.isu_strategis.trim())       e.isu_strategis = 'Wajib diisi';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      if (mode === 'edit') await axios.put(`${API_BASE}/bank-kebijakan-sdm/${data.id}/update/`, form);
      else await axios.post(`${API_BASE}/bank-kebijakan-sdm/add/`, form);
      onSaved(); onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const Field = ({ label, name, type = 'text', options, required }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === 'select' ? (
        <select value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500">
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea rows={3} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 resize-none',
            errors[name] ? 'border-red-400' : 'border-slate-200 dark:border-slate-500')} />
      ) : (
        <input type="text" value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500',
            errors[name] ? 'border-red-400' : 'border-slate-200 dark:border-slate-500')} />
      )}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              {mode === 'edit' ? <Pencil size={13} className="text-indigo-600 dark:text-indigo-400" /> : <Plus size={13} className="text-indigo-600 dark:text-indigo-400" />}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {mode === 'edit' ? 'Edit Kebijakan' : 'Tambah Kebijakan'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={15} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status" name="status" type="select" options={STATUS_LIST.map(s => ({ value: s, label: s }))} />
            <Field label="Prioritas" name="prioritas" type="select"
              options={[1, 2, 3, 4, 5, 6, 7].map(p => ({ value: p, label: `P${p} · ${PRIORITAS_LABELS[p]}` }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pilar" name="pilar_kebijakan" type="select" options={PILAR_LIST} />
            <Field label="Indikator" name="indikator_terkait" type="select" options={INDIKATOR_TERKAIT_LIST} />
          </div>
          <Field label="Isu Strategis" name="isu_strategis" required />
          <Field label="Kebijakan" name="kebijakan" type="textarea" required />
          <Field label="Rekomendasi Program" name="rekomendasi_program" type="textarea" required />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600">
            Batal
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Menyimpan...' : mode === 'edit' ? 'Simpan' : 'Tambah'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB KEBIJAKAN
// ══════════════════════════════════════════════════════════════════════════════
function TabKebijakan({ hasilAnalisis, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, getWarna, getKategori, analysisId }) {
  const { data: bankRaw, loading: bankLoading, error: bankError, refresh } = useBankKebijakan();

  const [subTab, setSubTab]             = useState('bank');
  const [filterStatus, setFilterStatus] = useState('SEMUA');
  const [filterPilar, setFilterPilar]   = useState('SEMUA');
  const [filterIndikator, setFilterIndikator] = useState('SEMUA');
  const [searchBank, setSearchBank]     = useState('');
  const [searchProv, setSearchProv]     = useState('');
  const [modal, setModal]               = useState(null);
  const [deletingId, setDeletingId]     = useState(null);
  const [expandedRow, setExpandedRow]   = useState(null);
  const [provinsiPopup, setProvinsiPopup] = useState(null);
  const [featuresLocal, setFeaturesLocal] = useState(null);

  useEffect(() => {
    if (hasilAnalisis?.matched_features?.features) {
      setFeaturesLocal(hasilAnalisis.matched_features.features);
    }
  }, [hasilAnalisis]);

  const labelIdx = LABEL_INDEKS_UTAMA[indikatorTerpilih] ?? 'ISDM';

  const dataTerfilter = useMemo(() => {
    const features = featuresLocal || hasilAnalisis?.matched_features?.features || [];
    let f = features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    if (searchProv.trim()) f = f.filter(x => x.properties?.sdm_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [featuresLocal, hasilAnalisis, kategoriTerpilih, indikatorTerpilih, searchProv, getKategori]);

  const allPilars = useMemo(() => [...new Set(bankRaw.map(k => k.pilar).filter(Boolean))].sort(), [bankRaw]);

  const filteredBank = useMemo(() => {
    let d = bankRaw.filter(k => k.status && STATUS_LIST.includes(k.status));
    if (filterStatus !== 'SEMUA') d = d.filter(k => k.status === filterStatus);
    if (filterPilar !== 'SEMUA') d = d.filter(k => k.pilar === filterPilar);
    if (filterIndikator !== 'SEMUA') d = d.filter(k => k.indikator === filterIndikator);
    if (searchBank.trim()) {
      const q = searchBank.toLowerCase();
      d = d.filter(k => k.kebijakan?.toLowerCase().includes(q) || k.pilar?.toLowerCase().includes(q) || k.isu_strategis?.toLowerCase().includes(q));
    }
    return d;
  }, [bankRaw, filterStatus, filterPilar, filterIndikator, searchBank]);

  const statsPerStatus = useMemo(() => {
    const c = { TINGGI: 0, SEDANG: 0, RENDAH: 0 };
    bankRaw.forEach(k => { if (k.status && c[k.status] !== undefined) c[k.status]++; });
    return c;
  }, [bankRaw]);

  const handleDelete = async (id) => {
    if (!confirm('Hapus kebijakan ini?')) return;
    setDeletingId(id);
    try {
      await axios.delete(`${API_BASE}/bank-kebijakan-sdm/${id}/delete/`);
      refresh();
    } catch (e) { alert(e.response?.data?.error || 'Gagal menghapus'); }
    finally { setDeletingId(null); }
  };

  const handleRekomendasiSaved = useCallback((namaProv, newRekomendasi) => {
    setFeaturesLocal(prev => {
      if (!prev) return prev;
      return prev.map(feat => {
        const sdm = feat.properties?.sdm_analysis;
        if (sdm?.nama_provinsi?.toUpperCase().trim() === namaProv.toUpperCase().trim()) {
          return { ...feat, properties: { ...feat.properties, sdm_analysis: { ...sdm, rekomendasi: newRekomendasi, rekomendasi_edited: true } } };
        }
        return feat;
      });
    });
  }, []);

  const popupFitur = provinsiPopup
    ? (featuresLocal || hasilAnalisis?.matched_features?.features || [])
        .find(f => f.properties?.sdm_analysis?.nama_provinsi === provinsiPopup)
    : null;
  const popupData = popupFitur?.properties?.sdm_analysis;

  return (
    <div className="space-y-4">
      {modal && <ModalKebijakan mode={modal.mode} data={modal.data} onClose={() => setModal(null)} onSaved={refresh} />}

      {provinsiPopup && popupData && (
        <ModalDetailProvinsi
          provinsiNama={provinsiPopup}
          popupData={popupData}
          popupFitur={popupFitur}
          getWarna={getWarna}
          getKategori={getKategori}
          indikatorTerpilih={indikatorTerpilih}
          labelIdx={labelIdx}
          analysisId={analysisId}
          onClose={() => setProvinsiPopup(null)}
          onRekomendasiSaved={handleRekomendasiSaved}
        />
      )}

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {[
          { id: 'bank',     label: 'Bank Kebijakan', icon: <FileText size={12} /> },
          { id: 'provinsi', label: 'Per Provinsi',   icon: <ClipboardList size={12} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              subTab === t.id ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'bank' && (
        <div className="space-y-4">
          {bankLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 size={22} className="text-indigo-500 animate-spin" />
              <span className="text-slate-500 dark:text-slate-400">Memuat bank kebijakan...</span>
            </div>
          ) : bankError ? (
            <div className="flex items-center gap-2.5 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{bankError}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-center">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Total</div>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bankRaw.length}</div>
                </div>
                {STATUS_LIST.map(st => {
                  const sc    = STATUS_COLORS[st];
                  const count = statsPerStatus[st] || 0;
                  const active = filterStatus === st;
                  return (
                    <button key={st} onClick={() => setFilterStatus(active ? 'SEMUA' : st)}
                      className={cn('p-3 rounded-xl border-2 text-center transition-all hover:scale-[1.02] active:scale-100', active ? 'shadow-lg' : '')}
                      style={{ borderColor: active ? sc.bg : sc.border, backgroundColor: active ? sc.bg : 'transparent' }}>
                      <div className="text-xs font-bold uppercase tracking-wide mb-1"
                        style={{ color: active ? '#fff' : sc.text }}>
                        {st}
                      </div>
                      <div className="text-2xl font-black" style={{ color: active ? '#fff' : sc.bg }}>{count}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchBank} onChange={e => setSearchBank(e.target.value)}
                    placeholder="Cari kebijakan atau isu..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                  {searchBank && <button onClick={() => setSearchBank('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400" /></button>}
                </div>
                <select value={filterPilar} onChange={e => setFilterPilar(e.target.value)}
                  className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                  <option value="SEMUA">Semua Pilar</option>
                  {allPilars.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterIndikator} onChange={e => setFilterIndikator(e.target.value)}
                  className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                  <option value="SEMUA">Semua Indikator</option>
                  {INDIKATOR_TERKAIT_LIST.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button onClick={() => setModal({ mode: 'add' })}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors">
                    <Plus size={12} /> Tambah
                  </button>
                  <button onClick={refresh} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors" title="Refresh">
                    <RefreshCw size={12} className="text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">{filteredBank.length} kebijakan ditemukan</span>
                {(filterStatus !== 'SEMUA' || filterPilar !== 'SEMUA' || filterIndikator !== 'SEMUA' || searchBank) && (
                  <button onClick={() => { setFilterStatus('SEMUA'); setFilterPilar('SEMUA'); setFilterIndikator('SEMUA'); setSearchBank(''); }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                    <X size={10} /> Reset filter
                  </button>
                )}
              </div>

              {filteredBank.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <AlertCircle size={22} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Tidak ada kebijakan ditemukan</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                      <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="px-3 py-3 text-left w-24">Status · P</th>
                        <th className="px-3 py-3 text-left w-28">Pilar</th>
                        <th className="px-4 py-3 text-left">Kebijakan</th>
                        <th className="px-3 py-3 text-center w-16">Ind.</th>
                        <th className="px-3 py-3 text-center w-20">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBank.map((item, i) => {
                        const sc = STATUS_COLORS[item.status];
                        const pc = getPilarColor(item.pilar);
                        const isExpanded = expandedRow === item.id;
                        return (
                          <React.Fragment key={item.id}>
                            <tr
                              className={cn(
                                'border-b border-slate-100 dark:border-slate-700/50 transition-colors cursor-pointer',
                                i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60',
                                isExpanded && 'bg-indigo-50/50 dark:bg-indigo-900/10',
                                'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                              )}
                              onClick={() => setExpandedRow(isExpanded ? null : item.id)}>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-black px-2 py-0.5 rounded text-white w-fit" style={{ backgroundColor: sc.bg }}>{item.status}</span>
                                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">P{item.prioritas}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-semibold leading-tight block" style={{ color: pc }}>{item.pilar}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{item.kebijakan}</p>
                                {item.isu_strategis && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic line-clamp-1">{item.isu_strategis}</p>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: pc + '40', color: pc, backgroundColor: pc + '10' }}>{item.indikator}</span>
                              </td>
                              <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => setModal({ mode: 'edit', data: { id: item.id, status: item.status, prioritas: item.prioritas, pilar_kebijakan: item.pilar, isu_strategis: item.isu_strategis || '', kebijakan: item.kebijakan, rekomendasi_program: item.rekomendasi, indikator_terkait: item.indikator } })}
                                    className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                    <Pencil size={11} className="text-blue-500" />
                                  </button>
                                  <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50">
                                    {deletingId === item.id ? <Loader2 size={11} className="text-red-400 animate-spin" /> : <Trash2 size={11} className="text-red-400" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${item.id}-detail`} className="bg-indigo-50/30 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800/30">
                                <td colSpan={5} className="px-4 py-3">
                                  <div className="flex items-start gap-2.5">
                                    <ChevronRight size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">Rekomendasi Program:</p>
                                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.rekomendasi}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Klik baris untuk melihat detail rekomendasi program</p>
            </>
          )}
        </div>
      )}

      {subTab === 'provinsi' && (
        <div className="space-y-4">
          {!hasilAnalisis ? (
            <div className="py-16 text-center">
              <ClipboardList size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">Jalankan analisis peta terlebih dahulu.</p>
            </div>
          ) : (
            <>
              {!analysisId && (
                <div className="flex items-start gap-2.5 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-200 dark:border-sky-700">
                  <AlertCircle size={13} className="text-sky-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-sky-700 dark:text-sky-300">
                    Belum ada analisis tersimpan. Setelah simpan analisis, perubahan kebijakan per provinsi akan ikut tersimpan secara permanen.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)}
                    placeholder="Cari provinsi..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                  {searchProv && <button onClick={() => setSearchProv('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400" /></button>}
                </div>
                <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
                  className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                  {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <span className="text-sm text-slate-400 dark:text-slate-500">{dataTerfilter.length} provinsi</span>
              </div>

              {dataTerfilter.length === 0 ? (
                <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">Tidak ada provinsi yang cocok</div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Provinsi</th>
                        <th className="px-3 py-3 text-center">{labelIdx}</th>
                        <th className="px-3 py-3 text-center">Kategori</th>
                        <th className="px-3 py-3 text-center">Pilar</th>
                        <th className="px-3 py-3 text-center w-24">Kelola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataTerfilter.map((fitur, idx) => {
                        const d     = fitur.properties.sdm_analysis;
                        const w     = getWarna(fitur, indikatorTerpilih);
                        const kat   = getKategori(fitur, indikatorTerpilih);
                        const rekom = d.rekomendasi || [];
                        const totalAksiAktif    = rekom.reduce((s, p) => s + (p.aksi?.filter(a => !a.disabled).length || 0), 0);
                        const totalAksiNonAktif = rekom.reduce((s, p) => s + (p.aksi?.filter(a => a.disabled).length  || 0), 0);
                        const topPilar = rekom.sort((a, b) => a.prioritas - b.prioritas).slice(0, 2).map(r => r.pilar).join(', ');
                        return (
                          <tr key={d.nama_provinsi}
                            className={cn('border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',
                              idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60')}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w }} />
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                                {d.use_arima && <ArimaBadge skenario={d.skenario_arima} size="xs" />}
                                {d.rekomendasi_edited && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">✎ Diedit</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{d.indeks_sdm ?? '-'}</span>
                            </td>
                            <td className="px-3 py-3 text-center"><StatusBadge status={kat} /></td>
                            <td className="px-3 py-3 text-center">
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {rekom.length > 0 ? (
                                  <>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{totalAksiAktif} aktif</span>
                                    {totalAksiNonAktif > 0 && <span className="text-slate-400"> · {totalAksiNonAktif} nonaktif</span>}
                                    {topPilar && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic line-clamp-1">{topPilar}</p>}
                                  </>
                                ) : '-'}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button onClick={() => setProvinsiPopup(d.nama_provinsi)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors mx-auto">
                                <Pencil size={10} /> Kelola
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB METODOLOGI — DARK MODE FIXED
// ══════════════════════════════════════════════════════════════════════════════

// Collapsible section wrapper
function MetSection({ accentColor, title, sub, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
            {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
          </div>
        </div>
        <ChevronDown
          size={13}
          className={cn('text-slate-400 dark:text-slate-500 transition-transform flex-shrink-0', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// Formula card per komponen
const COMP_META = {
  IK: {
    label: 'IK — Indeks Kesehatan',
    formula: 'UHH / 85',
    borderColor: '#10b981',
    badgeCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    formulaCls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    desc: 'UHH dibagi konstanta 85 tahun (benchmark World Bank HCI). Mencerminkan kualitas lingkungan, layanan kesehatan, dan keberhasilan pengendalian penyakit.',
  },
  IP: {
    label: 'IP — Indeks Pendidikan',
    formula: '(RLS/15 + HLS/18) / 2',
    borderColor: '#3b82f6',
    badgeCls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    formulaCls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    desc: 'Rata-rata RLS (target 15 th, setara D3) dan HLS (target 18 th, setara S2) — mengikuti standar BPS dalam perhitungan IPM.',
  },
  IDB: {
    label: 'IDB — Indeks Daya Beli',
    formula: '(X − min) / (max − min)',
    borderColor: '#f59e0b',
    badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    formulaCls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    desc: 'Pengeluaran per Kapita dinormalisasi Min-Max antar provinsi agar setara skala 0–1 dengan dua indeks lainnya.',
  },
};

function FormulaCard({ compKey }) {
  const m = COMP_META[compKey];
  return (
    <div
      className="rounded-xl p-4 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600"
      style={{ borderLeftWidth: 3, borderLeftColor: m.borderColor }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5 flex-wrap">
        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', m.badgeCls)}>
          {m.label}
        </span>
        <code className={cn('text-sm font-mono font-bold px-2.5 py-1 rounded-lg', m.formulaCls)}>
          {m.formula}
        </code>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{m.desc}</p>
    </div>
  );
}

// Klasifikasi status
const STATUS_META_MET = [
  {
    label: 'TINGGI', val: '> 0.70',
    cls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
    titleCls: 'text-emerald-700 dark:text-emerald-300',
    desc: 'Kualitas SDM baik, di atas rata-rata nasional',
  },
  {
    label: 'SEDANG', val: '0.40 – 0.70',
    cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    titleCls: 'text-amber-700 dark:text-amber-300',
    desc: 'Kualitas cukup, masih ada ruang perbaikan signifikan',
  },
  {
    label: 'RENDAH', val: '< 0.40',
    cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    titleCls: 'text-red-700 dark:text-red-300',
    desc: 'Prioritas intervensi khusus diperlukan segera',
  },
];

// Data justifikasi per komponen
const JUSTIF_DATA = [
  {
    dotColor: '#10b981',
    title: 'Indeks Kesehatan (IK) — UHH / 85',
    rows: [
      { q: 'Mengapa UHH?',           a: 'Indikator komposit yang secara tidak langsung mencerminkan kualitas lingkungan, layanan kesehatan, dan keberhasilan pengendalian penyakit di suatu wilayah.' },
      { q: 'Mengapa target 85 th?',  a: 'Target maksimal 85 tahun adalah benchmark "full health" yang ditetapkan World Bank dalam HCI. Nilai ini mewakili standar global usia harapan hidup ideal.' },
      { q: 'Landasan ilmiah',        a: 'World Bank HCI (2018) mendefinisikan "full health" dengan target 85 tahun, sejalan dengan dimensi pertama IPM BPS "umur panjang dan sehat".' },
    ],
    refs: [
      { badge: 'World Bank · 2018',  badgeCls: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',       title: 'The Human Capital Project',                  journal: 'World Bank Group',           link: 'https://www.worldbank.org/en/publication/human-capital' },
      { badge: 'BPS · 2025',         badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', title: 'Indeks Pembangunan Manusia Indonesia',        journal: 'Badan Pusat Statistik',      link: 'https://www.bps.go.id' },
    ],
  },
  {
    dotColor: '#3b82f6',
    title: 'Indeks Pendidikan (IP) — (RLS/15 + HLS/18) / 2',
    rows: [
      { q: 'Mengapa RLS + HLS?',         a: 'RLS mencerminkan stok pendidikan penduduk dewasa (≥25 th); HLS memprediksi potensi generasi mendatang. Keduanya saling melengkapi untuk gambaran lengkap.' },
      { q: 'Mengapa target 15 & 18 th?', a: 'Standar BPS dalam IPM: 15 tahun setara lulus D3, 18 tahun setara lulus S2. Lebih ambisius dari target World Bank (14 tahun berkualitas).' },
      { q: 'Landasan ilmiah',            a: 'Sari & Tiwari (2024) menemukan perbedaan learning outcomes menyumbang variasi human capital terbesar di Indonesia — membenarkan urgensi kedua indikator ini.' },
    ],
    refs: [
      { badge: 'BPS · 2025',              badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',   title: 'Metodologi IPM — Dimensi Pengetahuan',                    journal: 'Badan Pusat Statistik',        link: 'https://www.bps.go.id' },
      { badge: 'Social Indicators · 2024', badgeCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', title: 'The Geography of Human Capital: Subnational HCI Indonesia', journal: 'Sari & Tiwari — Vol. 172', link: 'https://doi.org/10.1007/s11205-024-03322-x' },
    ],
  },
  {
    dotColor: '#f59e0b',
    title: 'Indeks Daya Beli (IDB) — Min-Max Normalisasi',
    rows: [
      { q: 'Mengapa Pengeluaran per Kapita?', a: 'Indikator paling akurat dari Susenas BPS untuk standar hidup layak — menggantikan pendapatan yang sulit diukur secara akurat di tingkat rumah tangga.' },
      { q: 'Mengapa normalisasi Min-Max?',    a: 'Nilai absolut sangat bervariasi antar provinsi (puluhan juta Rp). Min-Max mengubahnya ke skala 0–1 agar dapat diagregasi proporsional dengan IK dan IP.' },
      { q: 'Landasan ilmiah',                a: 'BPS menempatkan "Pengeluaran Riil per Kapita Disesuaikan" sebagai komponen standar hidup layak dalam IPM. Rahman (Garuda Kemdikbud, 2017) menggunakan proksi serupa.' },
    ],
    refs: [
      { badge: 'BPS · 2025',              badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',   title: 'IPM — Komponen Standar Hidup Layak',             journal: 'Badan Pusat Statistik',           link: 'https://www.bps.go.id' },
      { badge: 'Garuda Kemdikbud · 2017', badgeCls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300', title: 'Faktor Pengaruh Daya Beli Wilayah III Cirebon', journal: 'Rahman — Jurnal Kemdikbud',          link: 'https://garuda.kemdikbud.go.id' },
    ],
  },
  {
    dotColor: '#6366f1',
    title: 'Agregasi Setara — (IK + IP + IDB) / 3',
    rows: [
      { q: 'Mengapa bobot sama?',  a: 'Model agregasi dengan pembobotan setara digunakan secara resmi BPS dalam IPM, dan diadopsi dalam Subnational HCI Indonesia oleh Sari & Tiwari (2024).' },
      { q: 'Mengapa 3 pilar ini?', a: 'Ketiganya merepresentasikan pilar pembangunan manusia: Kesehatan (modal fisik produktivitas), Pendidikan (kapasitas kognitif), dan Daya Beli (akses sumber daya).' },
      { q: 'Landasan ilmiah',      a: 'Sari & Tiwari (2024) menegaskan agregat human capital Indonesia hanya 53% dari potensi penuh dengan variasi spasial tinggi — membenarkan penggunaan ketiga komponen ini.' },
    ],
    refs: [
      { badge: 'BPS · 2025',               badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',   title: 'Metodologi Indeks Pembangunan Manusia',                    journal: 'Badan Pusat Statistik',   link: 'https://www.bps.go.id' },
      { badge: 'Social Indicators · 2024', badgeCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', title: 'The Geography of Human Capital: Subnational HCI Indonesia', journal: 'Sari & Tiwari — Vol. 172', link: 'https://doi.org/10.1007/s11205-024-03322-x' },
    ],
  },
];

// Justifikasi item (collapsible)
function JustifItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
      >
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.dotColor }} />
        <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{item.title}</span>
        <ChevronDown size={12} className={cn('text-slate-400 dark:text-slate-500 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3 space-y-3">
          {/* Q&A rows */}
          <div className="space-y-2.5">
            {item.rows.map((row, i) => (
              <div key={i} className="flex gap-3">
                <div className="min-w-[140px] max-w-[160px] flex-shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed pt-0.5">{row.q}</div>
                <div className="flex-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{row.a}</div>
              </div>
            ))}
          </div>

          {/* Referensi terkait */}
          {item.refs.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Referensi</p>
              <div className="space-y-2">
                {item.refs.map((ref, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                    <div className="flex-1 min-w-0">
                      <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5', ref.badgeCls)}>{ref.badge}</span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug">{ref.title}</p>
                      <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-0.5">{ref.journal}</p>
                    </div>
                    <a href={ref.link} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0 transition-colors">
                      <ExternalLink size={12} className="text-slate-400 dark:text-slate-500" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabMetodologi() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metodologi &amp; Formula ISDM</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Diadaptasi dari IPM BPS · 3 Komponen · 3 Kelas Status</p>
        </div>
      </div>

      {/* ── SECTION 1: FORMULA ── */}
      <MetSection accentColor="#6366f1" title="Formula Indeks SDM" sub="Rata-rata 3 komponen IPM BPS" defaultOpen>
        <div className="space-y-4">
          {/* Formula utama */}
          <div className="rounded-xl p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700">
            <div className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-2">Formula Utama (ALL)</div>
            <code className="block text-base font-mono font-bold text-indigo-800 dark:text-indigo-200">
              ISDM = (IK + IP + IDB) / 3
            </code>
          </div>

          {/* 3 komponen */}
          <div className="grid gap-3">
            <FormulaCard compKey="IK" />
            <FormulaCard compKey="IP" />
            <FormulaCard compKey="IDB" />
          </div>

          {/* Klasifikasi status */}
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">Klasifikasi Status Kualitas SDM</p>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_META_MET.map(s => (
                <div key={s.label} className={cn('rounded-xl p-3 border', s.cls)}>
                  <div className={cn('text-xs font-black uppercase tracking-wide mb-1', s.titleCls)}>{s.label}</div>
                  <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 mb-1">{s.val}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{s.desc}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
              Ambang batas mengacu pada temuan Sari &amp; Tiwari (2024) tentang disparitas HCI subnasional Indonesia.
            </p>
          </div>
        </div>
      </MetSection>

      {/* ── SECTION 2: DATASET ── */}
      <MetSection accentColor="#14b8a6" title="Dataset Sumber BPS" sub="4 Variabel IPM" defaultOpen>
        <div className="space-y-2.5">
          {[
            { var: '414', nama: 'Umur Harapan Hidup (UHH)',          satuan: 'Tahun',              periode: '2010–2024', k: 'IK',  kCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', link: BPS_LINKS.UHH },
            { var: '415', nama: 'Rata-rata Lama Sekolah (RLS)',       satuan: 'Tahun',              periode: '2010–2025', k: 'IP',  kCls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',             link: BPS_LINKS.RLS },
            { var: '417', nama: 'Harapan Lama Sekolah (HLS)',         satuan: 'Tahun',              periode: '2010–2025', k: 'IP',  kCls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',             link: BPS_LINKS.HLS },
            { var: '416', nama: 'Pengeluaran per Kapita Disesuaikan', satuan: 'Ribu Rp/Orang/Thn', periode: '2010–2025', k: 'IDB', kCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',         link: BPS_LINKS.PENGELUARAN },
          ].map(d => (
            <div key={d.var} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex-shrink-0 font-mono">
                {d.var}
              </span>
              <div className="flex-1 min-w-0">
                <a href={d.link} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-300 inline-flex items-center gap-1 transition-colors">
                  {d.nama} <ExternalLink size={10} className="opacity-50 flex-shrink-0" />
                </a>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{d.satuan} · {d.periode}</p>
              </div>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0', d.kCls)}>{d.k}</span>
            </div>
          ))}
        </div>
      </MetSection>

      {/* ── SECTION 3: JUSTIFIKASI ── */}
      <MetSection accentColor="#8b5cf6" title="Justifikasi Ilmiah per Komponen" sub="Dasar pemilihan & referensi tiap indeks">
        <div className="space-y-2.5">
          {JUSTIF_DATA.map((item, i) => (
            <JustifItem key={i} item={item} />
          ))}
        </div>
      </MetSection>

      {/* ── SECTION 4: REFERENSI UTAMA ── */}
      <MetSection accentColor="#ec4899" title="Referensi Utama" sub="3 publikasi ilmiah">
        <div className="space-y-2.5">
          {[
            {
              badge: 'World Bank · 2018',
              badgeCls: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
              title: 'The Human Capital Project',
              journal: 'World Bank Group',
              link: 'https://www.worldbank.org/en/publication/human-capital',
            },
            {
              badge: 'Social Indicators · 2024',
              badgeCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
              title: 'The Geography of Human Capital: Subnational HCI Indonesia',
              journal: 'Sari & Tiwari — Vol. 172',
              link: 'https://doi.org/10.1007/s11205-024-03322-x',
            },
            {
              badge: 'BPS Indonesia · 2025',
              badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
              title: 'Indeks Pembangunan Manusia (IPM) Indonesia 2025',
              journal: 'Badan Pusat Statistik',
              link: 'https://www.bps.go.id',
            },
          ].map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <div className="flex-1 min-w-0">
                <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2', r.badgeCls)}>
                  {r.badge}
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{r.title}</p>
                <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-0.5">{r.journal}</p>
              </div>
              <a href={r.link} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0 transition-colors">
                <ExternalLink size={13} className="text-slate-400 dark:text-slate-500" />
              </a>
            </div>
          ))}
        </div>
      </MetSection>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB TREN
// ══════════════════════════════════════════════════════════════════════════════
function TabTren({ daftarTersimpan }) {
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
        tahun: item.tahun,
        TINGGI: item.kategori_distribusi?.TINGGI ?? 0,
        SEDANG: item.kategori_distribusi?.SEDANG ?? 0,
        RENDAH: item.kategori_distribusi?.RENDAH ?? 0,
        TOTAL:  item.total_success ?? 0,
        useArima: item.use_arima || false,
        skenario: item.skenario || null,
        isPrediksi: item.is_prediction_year || false,
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
    ? { TINGGI: chartData.at(-1).TINGGI - chartData.at(-2).TINGGI, RENDAH: chartData.at(-1).RENDAH - chartData.at(-2).RENDAH }
    : null;

  const DeltaBadge = ({ val, positif = true }) => {
    if (!val) return <span className="text-xs text-slate-400">-</span>;
    const good = (val > 0 && positif) || (val < 0 && !positif);
    return (
      <span className={cn('flex items-center gap-0.5 text-xs font-bold', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
        {val > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {val > 0 ? `+${val}` : val}
      </span>
    );
  };

  if (!daftarTersimpan.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
        <TrendingUp size={26} className="text-indigo-400" />
      </div>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Belum ada data tersimpan</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Jalankan analisis dan simpan untuk melihat tren</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-indigo-500" size={20} />
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Panel Tren SDM</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{daftarTersimpan.length} analisis · {tahunCovered.length} tahun</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Analisis',   val: daftarTersimpan.length,   cls: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800',   valCls: 'text-indigo-700 dark:text-indigo-200' },
          { label: 'Tahun Tercakup',   val: tahunCovered.length,       cls: 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800',           valCls: 'text-blue-700 dark:text-blue-200' },
          { label: 'TINGGI Terakhir',  val: latestData?.TINGGI ?? '-', cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800', valCls: 'text-emerald-700 dark:text-emerald-200', delta: delta?.TINGGI, positif: true },
          { label: 'RENDAH Terakhir',  val: latestData?.RENDAH ?? '-', cls: 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800',               valCls: 'text-red-700 dark:text-red-200', delta: delta?.RENDAH, positif: false },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl p-3 border', c.cls)}>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{c.label}</div>
            <div className={cn('text-2xl font-black', c.valCls)}>{c.val}</div>
            {c.delta != null && <DeltaBadge val={c.delta} positif={c.positif} />}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-wrap">
          {['ALL', 'KESEHATAN', 'PENDIDIKAN', 'DAYA_BELI'].map(ind => {
            const ada = indsAvailable.includes(ind);
            return (
              <button key={ind} onClick={() => ada && setFilterInd(ind)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1',
                  filterInd === ind ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                    : ada ? 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed')}>
                <span style={{ color: filterInd === ind ? INDIKATOR_COLORS_SDM[ind] : undefined }}>{INDIKATOR_ICON_SDM[ind]}</span>
                {ind === 'ALL' ? 'Semua' : INDIKATOR_LABELS_SDM[ind].replace('Indeks ', '')}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 ml-auto">
          {[['distribusi', 'Bar'], ['area', 'Area']].map(([key, lbl]) => (
            <button key={key} onClick={() => setChartMode(key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold',
                chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Tidak ada data untuk indikator ini</div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
          <div className="text-sm font-bold text-slate-900 dark:text-white mb-3">{INDIKATOR_LABELS_SDM[filterInd]} · {chartData.length} titik data</div>
          {chartMode === 'distribusi' && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="TINGGI" name="TINGGI" stackId="a" fill="#10b981" />
                <Bar dataKey="SEDANG" name="SEDANG" stackId="a" fill="#f59e0b" />
                <Bar dataKey="RENDAH" name="RENDAH" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartMode === 'area' && (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  {[['gT', '#10b981'], ['gS', '#f59e0b'], ['gR', '#ef4444']].map(([id, clr]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={clr} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={clr} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                {[['TINGGI', '#10b981', 'gT'], ['SEDANG', '#f59e0b', 'gS'], ['RENDAH', '#ef4444', 'gR']].map(([key, clr, grad]) => (
                  <Area key={key} type="monotone" dataKey={key} name={key} stroke={clr} strokeWidth={2} fill={`url(#${grad})`} dot={{ r: 3, fill: clr }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cakupan Tahun</div>
        <div className="flex flex-wrap gap-1.5">
          {TAHUN_TERSEDIA_SDM.map(thn => {
            const ada    = tahunCovered.includes(thn);
            const isPred = isPrediksiYear(thn);
            return (
              <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-sm font-semibold border',
                ada ? isPred
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500')}>
                {thn}{ada && ' ✓'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN TABS WRAPPER
// ══════════════════════════════════════════════════════════════════════════════
export default function TabsSDM({
  activeTab, setActiveTab,
  hasilAnalisis, jumlahKategori,
  indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
  tahunTerpilih, daftarTersimpan,
  eksporData,
  getWarna, getKategori,
  arimaSkenario,
  analysisId,
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold transition-all relative flex-1 whitespace-nowrap',
                active
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              )}>
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {activeTab === 'info' && (
          <TabInfo
            hasilAnalisis={hasilAnalisis}
            jumlahKategori={jumlahKategori}
            indikatorTerpilih={indikatorTerpilih}
            kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih}
            eksporData={eksporData}
            getWarna={getWarna}
            getKategori={getKategori}
            arimaSkenario={arimaSkenario}
          />
        )}
        {activeTab === 'kebijakan' && (
          <TabKebijakan
            hasilAnalisis={hasilAnalisis}
            indikatorTerpilih={indikatorTerpilih}
            kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih}
            getWarna={getWarna}
            getKategori={getKategori}
            analysisId={analysisId}
          />
        )}
        {activeTab === 'metadata' && <TabMetodologi />}
        {activeTab === 'tren'     && <TabTren daftarTersimpan={daftarTersimpan} />}
      </div>
    </div>
  );
}