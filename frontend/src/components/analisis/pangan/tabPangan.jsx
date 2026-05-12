"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Download, ChevronDown, Info, FileText, Calendar,
  Check, TrendingUp, TrendingDown, ClipboardList, BookOpen,
  AlertCircle, CheckCircle2,
  Search, X, Brain, Loader2,
  Plus, Pencil, Trash2, Save, RefreshCw, ChevronRight,
  EyeOff, Eye, ChevronUp,
  ArrowLeftRight, Layers, Wheat,
  ExternalLink,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  TAHUN_TERSEDIA_PANGAN, TAHUN_BPS_AKTUAL_PANGAN,
  DATASET_LABELS_PANGAN, isPrediksiYearPangan,
  getWarna_IKP, getKategori_IKP,
} from './petaPangan';

const cn = (...cls) => cls.filter(Boolean).join(' ');
const API_BASE = 'http://127.0.0.1:8000/api';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'info',      label: 'Info',       Icon: Info },
  { id: 'kebijakan', label: 'Kebijakan',  Icon: ClipboardList },
  { id: 'metadata',  label: 'Metodologi', Icon: BookOpen },
  { id: 'tren',      label: 'Tren',       Icon: TrendingUp },
];

const STATUS_LIST   = ['TINGGI', 'SEDANG', 'RENDAH'];
const STATUS_COLORS = {
  TINGGI: { bg: '#10b981', light: '#ecfdf5', border: '#6ee7b7', text: '#065f46', textDark: '#a7f3d0', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  SEDANG: { bg: '#f59e0b', light: '#fffbeb', border: '#fcd34d', text: '#92400e', textDark: '#fde68a', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  RENDAH: { bg: '#ef4444', light: '#fef2f2', border: '#fca5a5', text: '#991b1b', textDark: '#fecaca', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

const PILAR_LIST_IKP = [
  'Produktivitas', 'Stabilitas', 'Transformasi', 'Kebijakan & Regulasi',
  'Intervensi Sektoral', 'Sistem Informasi', 'Perencanaan & Data',
  'Pemberdayaan Masyarakat', 'Infrastruktur',
];
const PILAR_COLORS_IKP = {
  'Produktivitas': '#10b981', 'Stabilitas': '#6366f1', 'Transformasi': '#f59e0b',
  'Kebijakan & Regulasi': '#3b82f6', 'Intervensi Sektoral': '#ef4444',
  'Sistem Informasi': '#06b6d4', 'Perencanaan & Data': '#8b5cf6',
  'Pemberdayaan Masyarakat': '#f97316', 'Infrastruktur': '#14b8a6',
};
const getPilarColorIKP = (p) => PILAR_COLORS_IKP[p] || '#10b981';

const INDIKATOR_IKP_LIST = ['IKv', 'IA', 'IPm', 'IS'];
const EMPTY_FORM_IKP = {
  status: 'SEDANG', prioritas: 3, pilar_kebijakan: 'Produktivitas',
  isu_strategis: '', kebijakan: '', rekomendasi_program: '', indikator_terkait: 'IKv',
};

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useBankKebijakanIKP() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-ikp/`)
      .then(r => { setData(r.data.results || []); setError(null); })
      .catch(e => { console.error(e); setError('Gagal memuat data.'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

function useBankIKPForProvinsi() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-ikp-provinsi/`)
      .then(r => setData(r.data.flat || []))
      .catch(e => console.error('gagal load bank ikp', e))
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

function ArimaBadgePangan({ skenario, size = 'sm', keys = [] }) {
  if (!skenario) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold rounded-full border', size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5')}
      style={{ background: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', borderColor: '#6ee7b7', color: '#065f46' }}>
      <Brain size={size === 'xs' ? 8 : 10} />
      ARIMA · {skenario}
      {keys.length > 0 && size !== 'xs' && <span className="opacity-70 ml-0.5">({keys.join(', ')})</span>}
    </span>
  );
}

function ArimaMetricsDetail_IKP({ metrics, skenario, tahun }) {
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
    <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-700 overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
        <div className="flex items-center gap-2.5">
          <Brain size={14} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
          <div className="text-left">
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Performa Model ARIMA v1.0</div>
            <div className="text-xs text-emerald-500 dark:text-emerald-400 mt-0.5">Skenario {skenario} · Proyeksi {tahun}</div>
          </div>
        </div>
        <ChevronDown size={13} className={cn('text-emerald-400 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-emerald-100 dark:border-emerald-800/60">
          {Object.entries(metrics).map(([key, m]) => {
            if (!m) return null;
            const lv     = getLevel(m.cv_wmape);
            const pctBar = m.cv_wmape != null ? Math.min(100, (m.cv_wmape / 10) * 100) : 0;
            return (
              <div key={key} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 mt-3">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {DATASET_LABELS_PANGAN[key] || key}
                  </span>
                  {lv && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
                      style={{ color: lv.color, backgroundColor: lv.color + '18', borderColor: lv.color + '50' }}>
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
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctBar}%`, backgroundColor: lv.color }} />
                    </div>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: lv.color }}>{m.cv_wmape.toFixed(2)}%</span>
                  </div>
                )}
                {m.n_wilayah && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Dilatih {m.n_wilayah} wilayah · ARIMA v1.0
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

const CustomTooltipPangan = ({ active, payload, label }) => {
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
// MODAL PILIH DARI BANK KEBIJAKAN IKP
// ══════════════════════════════════════════════════════════════════════════════
function ModalPilihBankIKP({ onClose, onPilih, bankData, loading, statusHint = '' }) {
  const [search,       setSearch]  = useState('');
  const [filterStatus, setFilter]  = useState(statusHint || 'SEMUA');
  const [filterPilar,  setPilar]   = useState('SEMUA');

  const allPilars = useMemo(() =>
    [...new Set(bankData.map(d => d.pilar).filter(Boolean))].sort(), [bankData]);

  const filtered = useMemo(() => {
    let d = bankData;
    if (filterStatus !== 'SEMUA') d = d.filter(x => x.status === filterStatus);
    if (filterPilar  !== 'SEMUA') d = d.filter(x => x.pilar  === filterPilar);
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(x =>
        x.kebijakan?.toLowerCase().includes(q) ||
        x.isu_strategis?.toLowerCase().includes(q) ||
        x.pilar?.toLowerCase().includes(q)
      );
    }
    return d;
  }, [bankData, filterStatus, filterPilar, search]);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Layers size={13} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm">Pilih dari Bank Kebijakan IKP</p>
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
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
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
                const pc = getPilarColorIKP(item.pilar);
                return (
                  <button key={item.id} onClick={() => onPilih(item)}
                    className="w-full text-left px-5 py-3.5 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20 transition-colors flex items-start gap-3">
                    <div className="flex flex-col gap-1 mt-0.5 flex-shrink-0">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: sc?.bg || '#94a3b8' }}>{item.status}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: pc, backgroundColor: pc + '18' }}>P{item.prioritas}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold mb-0.5" style={{ color: pc }}>{item.pilar}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{item.kebijakan}</p>
                      {item.isu_strategis && <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-0.5 line-clamp-1">Isu: {item.isu_strategis}</p>}
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5"
                      style={{ borderColor: pc + '50', color: pc, backgroundColor: pc + '10' }}>{item.indikator}</span>
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
// MODAL DETAIL PROVINSI (KEBIJAKAN IKP)
// ══════════════════════════════════════════════════════════════════════════════
function ModalDetailProvinsiIKP({ provinsiNama, popupData, popupFitur, analysisId, onClose, onRekomendasiSaved }) {
  const { data: bankData, loading: bankLoading, load: loadBank } = useBankIKPForProvinsi();

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
            const ep = next.findIndex(p => p.pilar === item.pilar);
            if (ep >= 0) { next[ep].aksi.push({ ...newAksi, no_aksi: next[ep].aksi.length + 1 }); next[ep].jumlah_aksi = next[ep].aksi.length; }
            else next.push({ pilar: item.pilar, prioritas: item.prioritas || 3, jumlah_aksi: 1, aksi: [{ ...newAksi, no_aksi: 1 }] });
            if (next[pilarIdx]?.aksi?.length === 0) next.splice(pilarIdx, 1);
          }
        }
      } else if (mode === 'add_to_pilar') {
        const pilar = next[pilarIdx];
        if (pilar) { pilar.aksi.push(bankToAksi(item, pilar.aksi.length + 1)); pilar.jumlah_aksi = pilar.aksi.length; }
      } else {
        const ep = next.findIndex(p => p.pilar === item.pilar);
        if (ep >= 0) { next[ep].aksi.push(bankToAksi(item, next[ep].aksi.length + 1)); next[ep].jumlah_aksi = next[ep].aksi.length; }
        else next.push({ pilar: item.pilar, prioritas: item.prioritas || 3, jumlah_aksi: 1, aksi: [bankToAksi(item, 1)] });
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
    setSaving(true); setSaveMsg('');
    try {
      await axios.patch(`${API_BASE}/pangan-analysis/${analysisId}/provinsi-kebijakan/`, {
        nama_provinsi: provinsiNama,
        rekomendasi:   rekLocal,
      });
      setSaveMsg('✅ Berhasil disimpan!');
      setIsDirty(false);
      onRekomendasiSaved?.(provinsiNama, rekLocal);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg(`❌ Gagal: ${e.response?.data?.error || e.message}`);
    } finally { setSaving(false); }
  };

  const warna = popupFitur ? getWarna_IKP(popupFitur) : '#10b981';
  const kat   = popupFitur ? getKategori_IKP(popupFitur) : '-';

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
                  {popupData?.use_arima && <ArimaBadgePangan skenario={popupData?.skenario_arima} keys={popupData?.arima_keys_used} />}
                  {isDirty && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      ● Ada perubahan belum disimpan
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={kat} />
                  <span className="text-sm font-mono font-black" style={{ color: warna }}>
                    IKP {popupData?.ikp ?? '-'}
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
                  + Tambah dari Bank Kebijakan
                </button>
              </div>
            ) : rekLocal.map((kelompok, ki) => {
              const pc     = getPilarColorIKP(kelompok.pilar);
              const isOpen = expandedPilars[ki] !== false;
              const aktif  = kelompok.aksi?.filter(a => !a.disabled).length || 0;
              const non    = kelompok.aksi?.filter(a => a.disabled).length  || 0;
              return (
                <div key={ki} className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <button onClick={() => togglePilar(ki)} className="flex items-center gap-3 px-4 py-2.5 w-full text-left"
                    style={{ backgroundColor: pc + '15', borderBottom: isOpen ? `1px solid ${pc}30` : 'none' }}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pc }} />
                    <span className="text-sm font-bold flex-1" style={{ color: pc }}>{kelompok.pilar}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{aktif} aktif{non > 0 ? ` · ${non} nonaktif` : ''}</span>
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
                              <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded font-semibold">{aksi.indikator_terkait}</span>
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
        <ModalPilihBankIKP
          onClose={() => setBankModal(null)}
          onPilih={handlePilihBank}
          bankData={bankData}
          loading={bankLoading}
          statusHint={popupData ? getKategori_IKP(popupData) : ''}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB INFO — TABEL PANGAN
// ══════════════════════════════════════════════════════════════════════════════
function TabInfoPangan({ hasilAnalisis, jumlahKategori, kategoriTerpilih, setKategoriTerpilih, eksporData, arimaSkenario }) {
  const [menuUnduh, setMenuUnduh] = useState(false);

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori_IKP(x) === kategoriTerpilih);
    return f;
  }, [hasilAnalisis, kategoriTerpilih]);

  if (!hasilAnalisis) return (
    <div className="py-16 text-center">
      <Wheat size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-base text-slate-500 dark:text-slate-400">Belum ada data. Klik <strong className="text-slate-700 dark:text-slate-200">Analisis Pangan</strong> di peta untuk memulai.</p>
    </div>
  );

  const useArima  = hasilAnalisis.use_arima;
  const arimaKeys = hasilAnalisis.arima_keys || [];
  const arimaM    = hasilAnalisis.arima_metrics || {};
  const tahun     = hasilAnalisis.tahun;
  const isPred    = hasilAnalisis.is_prediction_year;

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
            <Calendar size={11} /> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        {tahun && (
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border',
            isPred
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700'
              : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600')}>
            <Calendar size={11} /> Tahun {tahun}
            {isPred && <span className="ml-1 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">Prediksi</span>}
          </span>
        )}
        {useArima && arimaSkenario && <ArimaBadgePangan skenario={arimaSkenario} keys={arimaKeys} />}
      </div>

      {/* Formula box */}
      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Formula IKP</div>
        <p className="text-sm text-slate-700 dark:text-slate-200 font-mono leading-relaxed">
          IKv = Prod.Padi(Ton)/Penduduk(Rb) · IA = 1−(%Miskin/100) · IPm = (Protein/57)+(Kalori/2100) cap 2.0 · IS = 1/CV(Padi 5thn)
        </p>
        <p className="text-sm text-emerald-700 dark:text-emerald-300 font-mono font-bold mt-1.5">
          IKP = (IKv_norm + IA_norm + IPm_norm + IS_norm) / 4
        </p>
      </div>

      {/* ARIMA metrics */}
      {useArima && Object.keys(arimaM).length > 0 && (
        <ArimaMetricsDetail_IKP metrics={arimaM} skenario={arimaSkenario} tahun={tahun} />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Provinsi', val: hasilAnalisis.total_success || 0, cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800', valCls: 'text-emerald-700 dark:text-emerald-200' },
          { label: 'TINGGI', val: jumlahKategori['TINGGI'] ?? 0, cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800', valCls: 'text-emerald-700 dark:text-emerald-200' },
          { label: 'SEDANG', val: jumlahKategori['SEDANG'] ?? 0, cls: 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800',     valCls: 'text-amber-700 dark:text-amber-200' },
          { label: 'RENDAH', val: jumlahKategori['RENDAH'] ?? 0, cls: 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800',             valCls: 'text-red-700 dark:text-red-200' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-4', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-3xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabel data */}
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
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-colors">
                <Download size={13} /> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-600 py-1">
                  {['EXCEL', 'CSV', 'JSON', 'GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                      <Download size={11} className="text-emerald-500" /> {fmt}
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
                <th className="px-3 py-3 text-center w-8">No</th>
                <th className="px-4 py-3 text-left">Provinsi</th>
                <th className="px-3 py-3 text-center">IKP</th>
                {/* Dataset mentah */}
                <th className="px-3 py-3 text-center">Prod. Padi (ton)</th>
                <th className="px-3 py-3 text-center">% Miskin</th>
                <th className="px-3 py-3 text-center">Protein (gr)</th>
                <th className="px-3 py-3 text-center">Kalori (kkal)</th>
                <th className="px-3 py-3 text-center">Penduduk (rb)</th>
                {/* Hasil indeks */}
                <th className="px-3 py-3 text-center">IKv</th>
                <th className="px-3 py-3 text-center">IA</th>
                <th className="px-3 py-3 text-center">IPm</th>
                <th className="px-3 py-3 text-center">IS</th>
                <th className="px-3 py-3 text-center">Kategori</th>
                {useArima && <th className="px-3 py-3 text-center">Sumber</th>}
              </tr>
            </thead>
            <tbody>
              {dataTerfilter.map((fitur, idx) => {
                const d       = fitur.properties.ikp_analysis;
                const w       = getWarna_IKP(fitur);
                const kat     = getKategori_IKP(fitur);
                const rowArima = d.use_arima;
                const rowKeys  = d.arima_keys_used || [];
                const aiCell   = (k) => rowArima && rowKeys.includes(k);

                const fmtNum   = (v, dec = 0) => v != null ? Number(v).toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '-';
                const aiMark   = (k) => aiCell(k) ? <span className="ml-0.5 text-[9px] text-emerald-500">⚙️</span> : null;

                return (
                  <tr key={d.nama_provinsi}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-3 py-2.5 text-center text-xs text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w }} />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                        {d.rekomendasi_edited && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">✎</span>
                        )}
                      </div>
                    </td>
                    {/* IKP */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-1 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-mono">{d.ikp ?? '-'}</span>
                    </td>
                    {/* Dataset mentah */}
                    <td className="px-3 py-2.5 text-center text-xs">
                      <span className={cn(aiCell('PADI') ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300')}>
                        {fmtNum(d.padi_ton)}{aiMark('PADI')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      <span className={cn(aiCell('KEMISKINAN') ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300')}>
                        {fmtNum(d.persen_miskin, 2)}%{aiMark('KEMISKINAN')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      <span className={cn(aiCell('PROTEIN') ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300')}>
                        {fmtNum(d.protein, 1)}{aiMark('PROTEIN')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      <span className={cn(aiCell('KALORI') ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300')}>
                        {fmtNum(d.kalori, 0)}{aiMark('KALORI')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs">
                      <span className={cn(aiCell('PENDUDUK') ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300')}>
                        {fmtNum(d.penduduk_ribu, 0)}{aiMark('PENDUDUK')}
                      </span>
                    </td>
                    {/* Indeks ternormalisasi */}
                    <td className="px-3 py-2.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">{d.ikv_norm ?? '-'}</td>
                    <td className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 dark:text-blue-400">{d.ia_norm ?? '-'}</td>
                    <td className="px-3 py-2.5 text-center text-xs font-semibold text-purple-600 dark:text-purple-400">{d.ipm_norm ?? '-'}</td>
                    <td className="px-3 py-2.5 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">{d.is_norm ?? '-'}</td>
                    {/* Kategori */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold border"
                        style={{ borderColor: w + '60', color: w, backgroundColor: w + '15' }}>{kat}</span>
                    </td>
                    {/* Sumber (hanya muncul kalau ada ARIMA) */}
                    {useArima && (
                      <td className="px-3 py-2.5 text-center">
                        {rowArima
                          ? <ArimaBadgePangan skenario={d.skenario_arima} size="xs" />
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
// MODAL TAMBAH/EDIT KEBIJAKAN IKP
// ══════════════════════════════════════════════════════════════════════════════
function ModalKebijakanIKP({ mode, data, onClose, onSaved }) {
  const [form, setForm]     = useState(mode === 'edit' ? { ...data } : { ...EMPTY_FORM_IKP });
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
      if (mode === 'edit') await axios.put(`${API_BASE}/bank-kebijakan-ikp/${data.id}/update/`, form);
      else await axios.post(`${API_BASE}/bank-kebijakan-ikp/add/`, form);
      onSaved(); onClose();
    } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const FieldInput = ({ label, name, type = 'text', options, required }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === 'select' ? (
        <select value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea rows={3} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 resize-none',
            errors[name] ? 'border-red-400' : 'border-slate-200 dark:border-slate-500')} />
      ) : (
        <input type="text" value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500',
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
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              {mode === 'edit' ? <Pencil size={13} className="text-emerald-600 dark:text-emerald-400" /> : <Plus size={13} className="text-emerald-600 dark:text-emerald-400" />}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {mode === 'edit' ? 'Edit Kebijakan IKP' : 'Tambah Kebijakan IKP'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={15} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FieldInput label="Status" name="status" type="select" options={STATUS_LIST.map(s => ({ value: s, label: s }))} />
            <FieldInput label="Prioritas" name="prioritas" type="select"
              options={[1,2,3,4,5,6,7].map(p => ({ value: p, label: `P${p}` }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldInput label="Pilar" name="pilar_kebijakan" type="select" options={PILAR_LIST_IKP} />
            <FieldInput label="Indikator Terkait" name="indikator_terkait" type="select" options={INDIKATOR_IKP_LIST} />
          </div>
          <FieldInput label="Isu Strategis" name="isu_strategis" required />
          <FieldInput label="Kebijakan" name="kebijakan" type="textarea" required />
          <FieldInput label="Rekomendasi Program" name="rekomendasi_program" type="textarea" required />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Menyimpan...' : mode === 'edit' ? 'Simpan' : 'Tambah'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB KEBIJAKAN IKP
// ══════════════════════════════════════════════════════════════════════════════
function TabKebijakanIKP({ hasilAnalisis, kategoriTerpilih, setKategoriTerpilih, analysisId }) {
  const { data: bankRaw, loading: bankLoading, error: bankError, refresh } = useBankKebijakanIKP();

  const [subTab,          setSubTab]        = useState('bank');
  const [filterStatus,    setFilterStatus]  = useState('SEMUA');
  const [filterPilar,     setFilterPilar]   = useState('SEMUA');
  const [filterIndikator, setFilterInd]     = useState('SEMUA');
  const [searchBank,      setSearchBank]    = useState('');
  const [searchProv,      setSearchProv]    = useState('');
  const [modal,           setModal]         = useState(null);
  const [deletingId,      setDeletingId]    = useState(null);
  const [expandedRow,     setExpandedRow]   = useState(null);
  const [provinsiPopup,   setProvinsiPopup] = useState(null);
  const [featuresLocal,   setFeaturesLocal] = useState(null);

  useEffect(() => {
    if (hasilAnalisis?.matched_features?.features) setFeaturesLocal(hasilAnalisis.matched_features.features);
  }, [hasilAnalisis]);

  const dataTerfilter = useMemo(() => {
    const features = featuresLocal || hasilAnalisis?.matched_features?.features || [];
    let f = features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori_IKP(x) === kategoriTerpilih);
    if (searchProv.trim()) f = f.filter(x => x.properties?.ikp_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [featuresLocal, hasilAnalisis, kategoriTerpilih, searchProv]);

  const allPilars = useMemo(() => [...new Set(bankRaw.map(k => k.pilar).filter(Boolean))].sort(), [bankRaw]);

  const filteredBank = useMemo(() => {
    let d = bankRaw;
    if (filterStatus !== 'SEMUA') d = d.filter(k => k.status === filterStatus);
    if (filterPilar  !== 'SEMUA') d = d.filter(k => k.pilar  === filterPilar);
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
    try { await axios.delete(`${API_BASE}/bank-kebijakan-ikp/${id}/delete/`); refresh(); }
    catch (e) { alert(e.response?.data?.error || 'Gagal'); }
    finally { setDeletingId(null); }
  };

  const handleRekomendasiSaved = useCallback((namaProv, newRek) => {
    setFeaturesLocal(prev => {
      if (!prev) return prev;
      return prev.map(feat => {
        const ikp = feat.properties?.ikp_analysis;
        if (ikp?.nama_provinsi?.toUpperCase().trim() === namaProv.toUpperCase().trim()) {
          return { ...feat, properties: { ...feat.properties, ikp_analysis: { ...ikp, rekomendasi: newRek, rekomendasi_edited: true } } };
        }
        return feat;
      });
    });
  }, []);

  const popupFitur = provinsiPopup
    ? (featuresLocal || hasilAnalisis?.matched_features?.features || []).find(f => f.properties?.ikp_analysis?.nama_provinsi === provinsiPopup)
    : null;
  const popupData = popupFitur?.properties?.ikp_analysis;

  return (
    <div className="space-y-4">
      {modal && <ModalKebijakanIKP mode={modal.mode} data={modal.data} onClose={() => setModal(null)} onSaved={refresh} />}
      {provinsiPopup && popupData && (
        <ModalDetailProvinsiIKP
          provinsiNama={provinsiPopup}
          popupData={popupData}
          popupFitur={popupFitur}
          analysisId={analysisId}
          onClose={() => setProvinsiPopup(null)}
          onRekomendasiSaved={handleRekomendasiSaved}
        />
      )}

      {/* Sub-tab selector */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {[
          { id: 'bank',     label: 'Bank Kebijakan', icon: <FileText size={12} /> },
          { id: 'provinsi', label: 'Per Provinsi',   icon: <ClipboardList size={12} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              subTab === t.id ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── BANK TAB ── */}
      {subTab === 'bank' && (
        <div className="space-y-4">
          {bankLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 size={22} className="text-emerald-500 animate-spin" />
              <span className="text-slate-500 dark:text-slate-400">Memuat bank kebijakan...</span>
            </div>
          ) : bankError ? (
            <div className="flex items-center gap-2.5 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{bankError}</p>
            </div>
          ) : (
            <>
              {/* Status cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-center">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Total</div>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bankRaw.length}</div>
                </div>
                {STATUS_LIST.map(st => {
                  const sc     = STATUS_COLORS[st];
                  const count  = statsPerStatus[st] || 0;
                  const active = filterStatus === st;
                  return (
                    <button key={st} onClick={() => setFilterStatus(active ? 'SEMUA' : st)}
                      className={cn('p-3 rounded-xl border-2 text-center transition-all hover:scale-[1.02] active:scale-100', active ? 'shadow-lg' : '')}
                      style={{ borderColor: active ? sc.bg : sc.border, backgroundColor: active ? sc.bg : 'transparent' }}>
                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: active ? '#fff' : sc.text }}>{st}</div>
                      <div className="text-2xl font-black" style={{ color: active ? '#fff' : sc.bg }}>{count}</div>
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchBank} onChange={e => setSearchBank(e.target.value)}
                    placeholder="Cari kebijakan atau isu..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-emerald-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400" />
                  {searchBank && <button onClick={() => setSearchBank('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400" /></button>}
                </div>
                <select value={filterPilar} onChange={e => setFilterPilar(e.target.value)}
                  className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                  <option value="SEMUA">Semua Pilar</option>
                  {allPilars.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterIndikator} onChange={e => setFilterInd(e.target.value)}
                  className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                  <option value="SEMUA">Semua Indikator</option>
                  {INDIKATOR_IKP_LIST.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button onClick={() => setModal({ mode: 'add' })}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors">
                    <Plus size={12} /> Tambah
                  </button>
                  <button onClick={refresh} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors" title="Refresh">
                    <RefreshCw size={12} className="text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">{filteredBank.length} kebijakan ditemukan</p>

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
                        const pc = getPilarColorIKP(item.pilar);
                        const isExpanded = expandedRow === item.id;
                        return (
                          <React.Fragment key={item.id}>
                            <tr
                              className={cn('border-b border-slate-100 dark:border-slate-700/50 transition-colors cursor-pointer',
                                i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60',
                                isExpanded && 'bg-emerald-50/50 dark:bg-emerald-900/10',
                                'hover:bg-slate-50 dark:hover:bg-slate-700/40')}
                              onClick={() => setExpandedRow(isExpanded ? null : item.id)}>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-black px-2 py-0.5 rounded text-white w-fit" style={{ backgroundColor: sc.bg }}>{item.status}</span>
                                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">P{item.prioritas}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-semibold" style={{ color: pc }}>{item.pilar}</span>
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
                              <tr key={`${item.id}-detail`} className="bg-emerald-50/30 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-800/30">
                                <td colSpan={5} className="px-4 py-3">
                                  <div className="flex items-start gap-2.5">
                                    <ChevronRight size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">Rekomendasi Program:</p>
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

      {/* ── PROVINSI TAB ── */}
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
                  <p className="text-sm text-sky-700 dark:text-sky-300">Belum ada analisis tersimpan. Simpan analisis agar perubahan kebijakan per provinsi tersimpan permanen.</p>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)}
                    placeholder="Cari provinsi..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-emerald-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400" />
                  {searchProv && <button onClick={() => setSearchProv('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400" /></button>}
                </div>
                <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
                  className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                  {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <span className="text-sm text-slate-400 dark:text-slate-500">{dataTerfilter.length} provinsi</span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Provinsi</th>
                      <th className="px-3 py-3 text-center">IKP</th>
                      <th className="px-3 py-3 text-center">Kategori</th>
                      <th className="px-3 py-3 text-center">Pilar Aktif</th>
                      <th className="px-3 py-3 text-center w-24">Kelola</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataTerfilter.map((fitur, idx) => {
                      const d    = fitur.properties.ikp_analysis;
                      const w    = getWarna_IKP(fitur);
                      const kat  = getKategori_IKP(fitur);
                      const rek  = d.rekomendasi || [];
                      const totalAktif = rek.reduce((s, p) => s + (p.aksi?.filter(a => !a.disabled).length || 0), 0);
                      const topPilar   = rek.sort((a, b) => a.prioritas - b.prioritas).slice(0, 2).map(r => r.pilar).join(', ');
                      return (
                        <tr key={d.nama_provinsi}
                          className={cn('border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',
                            idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60')}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w }} />
                              <span className="font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                              {d.use_arima && <ArimaBadgePangan skenario={d.skenario_arima} size="xs" />}
                              {d.rekomendasi_edited && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">✎ Diedit</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-slate-800 dark:text-slate-100 font-mono">{d.ikp ?? '-'}</td>
                          <td className="px-3 py-3 text-center"><StatusBadge status={kat} /></td>
                          <td className="px-3 py-3 text-center">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {rek.length > 0 ? (
                                <>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{totalAktif} aktif</span>
                                  {topPilar && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic line-clamp-1">{topPilar}</p>}
                                </>
                              ) : '-'}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => setProvinsiPopup(d.nama_provinsi)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 rounded-lg text-xs font-semibold transition-colors mx-auto">
                              <Pencil size={10} /> Kelola
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB METODOLOGI IKP
// ══════════════════════════════════════════════════════════════════════════════
function MetSectionIKP({ accentColor, title, sub, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
            {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
          </div>
        </div>
        <ChevronDown size={13} className={cn('text-slate-400 dark:text-slate-500 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-slate-100 dark:border-slate-700 px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

const INDEKS_META = [
  {
    key: 'IKv', label: 'Indeks Ketersediaan (IKv)',
    formula: 'Prod. Padi (ton) / Penduduk (ribu jiwa)',
    borderColor: '#10b981',
    badgeCls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    formulaCls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    desc: 'Padi sebagai komoditas pangan pokok utama Indonesia. Satuan ton/ribu jiwa membandingkan antar provinsi secara adil.',
  },
  {
    key: 'IA', label: 'Indeks Akses (IA)',
    formula: '1 − (% Penduduk Miskin / 100)',
    borderColor: '#3b82f6',
    badgeCls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    formulaCls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    desc: 'Kemiskinan = indikator utama ketidakmampuan mengakses pangan. Rumus invers agar nilai tinggi = akses baik.',
  },
  {
    key: 'IPm', label: 'Indeks Pemanfaatan (IPm)',
    formula: '(Protein/57) + (Kalori/2100) — cap 2.0',
    borderColor: '#8b5cf6',
    badgeCls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    formulaCls: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    desc: 'Protein (57 gr) & Kalori (2100 kkal) = standar AKG Permenkes No.28/2019. Nilai cap 2.0 agar tidak melebihi batas rasional.',
  },
  {
    key: 'IS', label: 'Indeks Stabilitas (IS)',
    formula: '1 / CV Produksi Padi 5 tahun — cap 20',
    borderColor: '#f59e0b',
    badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    formulaCls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    desc: 'CV = std/mean (fluktuasi produksi). IS = invers CV: fluktuasi kecil → stabilitas tinggi. Mengacu praktik FSVA Kementan.',
  },
];

function TabMetodologiIKP() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-1">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
          <Wheat size={16} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metodologi Indeks Ketahanan Pangan (IKP)</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">4 Indeks FAO · Normalisasi Min-Max · 3 Kelas Status</p>
        </div>
      </div>

      {/* Formula utama */}
      <MetSectionIKP accentColor="#10b981" title="Formula IKP" sub="Rata-rata 4 indeks ternormalisasi" defaultOpen>
        <div className="space-y-4">
          <div className="rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
            <div className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-2">Formula Utama</div>
            <code className="block text-base font-mono font-bold text-emerald-800 dark:text-emerald-200">
              IKP = (IKv_norm + IA_norm + IPm_norm + IS_norm) / 4
            </code>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1.5">Normalisasi Min-Max ke [0,1]: X_norm = (X − X_min) / (X_max − X_min)</p>
          </div>

          {/* 4 komponen */}
          <div className="grid gap-3">
            {INDEKS_META.map(m => (
              <div key={m.key} className="rounded-xl p-4 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600"
                style={{ borderLeftWidth: 3, borderLeftColor: m.borderColor }}>
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', m.badgeCls)}>{m.label}</span>
                  <code className={cn('text-xs font-mono font-bold px-2.5 py-1 rounded-lg', m.formulaCls)}>{m.formula}</code>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          {/* Klasifikasi */}
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">Klasifikasi Status</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'TINGGI', val: '> 0.70',      cls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700', titleCls: 'text-emerald-700 dark:text-emerald-300', desc: 'Ketahanan pangan baik; semua indeks terpenuhi' },
                { label: 'SEDANG', val: '0.40 – 0.70', cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',       titleCls: 'text-amber-700 dark:text-amber-300',   desc: 'Ketahanan pangan cukup; ada indeks yang lemah' },
                { label: 'RENDAH', val: '< 0.40',      cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',               titleCls: 'text-red-700 dark:text-red-300',       desc: 'Rawan pangan; perlu intervensi prioritas' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-xl p-3 border', s.cls)}>
                  <div className={cn('text-xs font-black uppercase tracking-wide mb-1', s.titleCls)}>{s.label}</div>
                  <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 mb-1">{s.val}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MetSectionIKP>

      {/* Dataset */}
      <MetSectionIKP accentColor="#14b8a6" title="Dataset Sumber BPS" sub="5 variabel dari BPS SIMDASI & Susenas" defaultOpen>
        <div className="space-y-2.5">
          {[
            { nama: 'Produksi Padi (Ton)',              satuan: 'ton',                 sumber: 'BPS SIMDASI id_tabel ZjZ6...', ind: 'IKv + IS', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
            { nama: 'Persentase Penduduk Miskin',       satuan: '%',                   sumber: 'BPS var/192 · Semester 2',     ind: 'IA',       cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
            { nama: 'Konsumsi Kalori per Kapita',       satuan: 'kkal/kapita/hari',    sumber: 'BPS Static Table 951 (Susenas)', ind: 'IPm',     cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
            { nama: 'Konsumsi Protein per Kapita',      satuan: 'gram/kapita/hari',    sumber: 'BPS Static Table 951 (Susenas)', ind: 'IPm',     cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
            { nama: 'Jumlah Penduduk',                  satuan: 'ribu jiwa',           sumber: 'BPS SIMDASI id_tabel WVRl...', ind: 'IKv',      cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
          ].map(d => (
            <div key={d.nama} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{d.satuan} · {d.sumber}</p>
              </div>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0', d.cls)}>{d.ind}</span>
            </div>
          ))}
        </div>
      </MetSectionIKP>

      {/* Referensi */}
      <MetSectionIKP accentColor="#ec4899" title="Justifikasi & Referensi" sub="Landasan ilmiah IKP">
        <div className="space-y-2.5">
          {[
            { badge: 'FAO · 1996/2006/2015', cls: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300', title: '4 Pilar Ketahanan Pangan (Availability, Access, Utilization, Stability)', journal: 'Food and Agriculture Organization', link: 'https://www.fao.org/food-security' },
            { badge: 'Permenkes No.28/2019', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', title: 'Angka Kecukupan Gizi (AKG) — 57 gram protein & 2100 kkal', journal: 'Kementerian Kesehatan RI', link: 'https://peraturan.bpk.go.id' },
            { badge: 'FSVA · Kementan', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', title: 'Food Security and Vulnerability Atlas — Fluktuasi Produksi sebagai Indikator Stabilitas', journal: 'Kementerian Pertanian RI', link: 'https://www.pertanian.go.id' },
            { badge: 'Kajian Fiskal Regional · 2024', cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300', title: 'Tiga Pilar Ketahanan Pangan & Bobot Indikator Resmi', journal: 'Kementerian Keuangan RI', link: 'https://www.kemenkeu.go.id' },
          ].map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <div className="flex-1 min-w-0">
                <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2', r.cls)}>{r.badge}</span>
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
      </MetSectionIKP>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB TREN IKP
// ══════════════════════════════════════════════════════════════════════════════
function TabTrenIKP({ daftarTersimpan }) {
  const [chartMode, setChartMode] = useState('distribusi');

  const chartData = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(item => {
      const key = item.tahun;
      if (!map[key] || item.timestamp > map[key].timestamp) map[key] = item;
    });
    return Object.values(map)
      .sort((a, b) => a.tahun - b.tahun)
      .map(item => ({
        tahun:     item.tahun,
        TINGGI:    item.kategori_distribusi?.TINGGI ?? 0,
        SEDANG:    item.kategori_distribusi?.SEDANG ?? 0,
        RENDAH:    item.kategori_distribusi?.RENDAH ?? 0,
        isPrediksi: item.is_prediction_year || false,
      }));
  }, [daftarTersimpan]);

  const tahunCovered = [...new Set(daftarTersimpan.map(d => d.tahun).filter(Boolean))].sort();
  const latestData   = chartData[chartData.length - 1];
  const delta = chartData.length >= 2
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
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
        <TrendingUp size={26} className="text-emerald-400" />
      </div>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Belum ada data tersimpan</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Jalankan analisis dan simpan untuk melihat tren IKP</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-emerald-500" size={20} />
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Panel Tren IKP</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{daftarTersimpan.length} analisis · {tahunCovered.length} tahun tercakup</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Analisis', val: daftarTersimpan.length, cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800', valCls: 'text-emerald-700 dark:text-emerald-200' },
          { label: 'Tahun Tercakup', val: tahunCovered.length,    cls: 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800',             valCls: 'text-teal-700 dark:text-teal-200' },
          { label: 'TINGGI Terakhir', val: latestData?.TINGGI ?? '-', cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800', valCls: 'text-emerald-700 dark:text-emerald-200', delta: delta?.TINGGI, positif: true },
          { label: 'RENDAH Terakhir', val: latestData?.RENDAH ?? '-', cls: 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800',               valCls: 'text-red-700 dark:text-red-200',         delta: delta?.RENDAH, positif: false },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl p-3 border', c.cls)}>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{c.label}</div>
            <div className={cn('text-2xl font-black', c.valCls)}>{c.val}</div>
            {c.delta != null && <DeltaBadge val={c.delta} positif={c.positif} />}
          </div>
        ))}
      </div>

      {/* Chart mode */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit ml-auto">
        {[['distribusi', 'Bar'], ['area', 'Area']].map(([key, lbl]) => (
          <button key={key} onClick={() => setChartMode(key)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold',
              chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')}>
            {lbl}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Tidak ada data untuk ditampilkan</div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
          <div className="text-sm font-bold text-slate-900 dark:text-white mb-3">Distribusi IKP per Tahun · {chartData.length} titik</div>
          {chartMode === 'distribusi' && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltipPangan />} />
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
                <Tooltip content={<CustomTooltipPangan />} />
                {[['TINGGI', '#10b981', 'gT'], ['SEDANG', '#f59e0b', 'gS'], ['RENDAH', '#ef4444', 'gR']].map(([key, clr, grad]) => (
                  <Area key={key} type="monotone" dataKey={key} name={key} stroke={clr} strokeWidth={2} fill={`url(#${grad})`} dot={{ r: 3, fill: clr }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Cakupan tahun */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cakupan Tahun</div>
        <div className="flex flex-wrap gap-1.5">
          {TAHUN_TERSEDIA_PANGAN.map(thn => {
            const ada    = tahunCovered.includes(thn);
            const isPred = isPrediksiYearPangan(thn);
            return (
              <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-sm font-semibold border',
                ada ? isPred
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                  : 'bg-teal-100 dark:bg-teal-900/40 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300'
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
export default function TabsPangan({
  activeTab, setActiveTab,
  hasilAnalisis, jumlahKategori,
  kategoriTerpilih, setKategoriTerpilih,
  tahunTerpilih, daftarTersimpan,
  eksporData,
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
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              )}>
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full" />}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {activeTab === 'info' && (
          <TabInfoPangan
            hasilAnalisis={hasilAnalisis}
            jumlahKategori={jumlahKategori}
            kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih}
            eksporData={eksporData}
            arimaSkenario={arimaSkenario}
          />
        )}
        {activeTab === 'kebijakan' && (
          <TabKebijakanIKP
            hasilAnalisis={hasilAnalisis}
            kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih}
            analysisId={analysisId}
          />
        )}
        {activeTab === 'metadata' && <TabMetodologiIKP />}
        {activeTab === 'tren'     && <TabTrenIKP daftarTersimpan={daftarTersimpan} />}
      </div>
    </div>
  );
}