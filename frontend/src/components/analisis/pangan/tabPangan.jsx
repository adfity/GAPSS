"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Download, ChevronDown, Info, FileText, Calendar,
  BarChart2, TrendingUp, ClipboardList, BookOpen,
  AlertCircle, X, ExternalLink, Brain, Loader2,
  Plus, Pencil, Trash2, Save, RefreshCw, ChevronRight,
  EyeOff, Eye, ChevronUp, ArrowLeftRight, Layers,
  CheckCircle2, Search, AlertTriangle, Wheat, ShoppingCart, Heart,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  KATEGORI_IKP, INDIKATOR_LABELS_IKP, INDIKATOR_COLORS_IKP, INDIKATOR_ICON_IKP,
  TAHUN_TERSEDIA_IKP, DATASET_LABELS_IKP,
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

const STATUS_LIST = ['SANGAT_RENTAN', 'RENTAN', 'AGAK_RENTAN', 'AGAK_TAHAN', 'TAHAN', 'SANGAT_TAHAN'];

const STATUS_COLORS = {
  SANGAT_RENTAN: { bg: '#6e1f1f', border: '#b45309', badge: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200' },
  RENTAN:        { bg: '#e85961', border: '#fca5a5', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
  AGAK_RENTAN:   { bg: '#f4a1a7', border: '#fda4af', badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' },
  AGAK_TAHAN:    { bg: '#c9e077', border: '#bef264', badge: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300' },
  TAHAN:         { bg: '#94c945', border: '#86efac', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  SANGAT_TAHAN:  { bg: '#3b703b', border: '#166534', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  TIDAK_TERANALISIS: { bg: '#a6a6a6', border: '#cbd5e1', badge: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

const PILAR_LIST = [
  'Ketersediaan Pangan', 'Keterjangkauan Pangan', 'Pemanfaatan Pangan',
  'Distribusi Pangan', 'Stabilitas Pangan', 'Kebijakan & Regulasi',
  'Infrastruktur Pangan', 'Pemberdayaan Masyarakat',
];

const PILAR_COLORS = {
  'Ketersediaan Pangan': '#ca8a04',
  'Keterjangkauan Pangan': '#2563eb',
  'Pemanfaatan Pangan': '#dc2626',
  'Distribusi Pangan': '#7c3aed',
  'Stabilitas Pangan': '#0d9488',
  'Kebijakan & Regulasi': '#16a34a',
  'Infrastruktur Pangan': '#ea580c',
  'Pemberdayaan Masyarakat': '#0284c7',
};
const getPilarColor = (p) => PILAR_COLORS[p] || '#16a34a';

const EMPTY_FORM = {
  status: 'AGAK_RENTAN', prioritas: 3, pilar_kebijakan: 'Ketersediaan Pangan',
  isu_strategis: '', kebijakan: '', rekomendasi_program: '', indikator_terkait: 'KETERSEDIAAN',
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
      .catch(() => setError('Gagal memuat data.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}

function useBankIKPProvinsi() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);
  const load = useCallback(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-ikp-provinsi/`)
      .then(r => setData(r.data.flat || []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading, load };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function StatusBadge({ status, size = 'sm' }) {
  const sc = STATUS_COLORS[status];
  if (!sc) return null;
  const label = (status || '').replace(/_/g, ' ');
  // teks putih untuk background gelap
  const isDark = ['#6e1f1f', '#e85961', '#3b703b'].includes(sc.bg);
  return (
    <span className={cn(
      'inline-flex items-center font-bold rounded-full',
      size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5',
      sc.badge
    )}>
      {label}
    </span>
  );
}

function ProyeksiBadge({ size = 'sm', kolomProyeksi = [] }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold rounded-full border bg-amber-50 dark:bg-amber-900/30',
      size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5')}
      style={{ borderColor: '#fcd34d', color: '#92400e' }}>
      <AlertTriangle size={size === 'xs' ? 7 : 9}/>
      Prediksi OLS
      {kolomProyeksi.length > 0 && size !== 'xs' && (
        <span className="opacity-70 ml-0.5">({kolomProyeksi.join(', ')})</span>
      )}
    </span>
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
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }}/>
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── MODAL PILIH BANK ─────────────────────────────────────────────────────────
function ModalPilihBank({ onClose, onPilih, bankData, loading, statusHint = '' }) {
  const [search, setSearch] = useState('');
  const [fStatus, setFS]    = useState(statusHint || 'SEMUA');
  const [fPilar, setFP]     = useState('SEMUA');
  const allPilars = useMemo(() => [...new Set(bankData.map(d => d.pilar).filter(Boolean))].sort(), [bankData]);
  const filtered  = useMemo(() => {
    let d = bankData;
    if (fStatus !== 'SEMUA') d = d.filter(x => x.status === fStatus);
    if (fPilar  !== 'SEMUA') d = d.filter(x => x.pilar === fPilar);
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(x => x.kebijakan?.toLowerCase().includes(q) || x.isu_strategis?.toLowerCase().includes(q) || x.pilar?.toLowerCase().includes(q));
    }
    return d;
  }, [bankData, fStatus, fPilar, search]);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center"><Layers size={13} className="text-green-600"/></div>
            <div><p className="font-bold text-slate-900 dark:text-white text-sm">Pilih dari Bank Kebijakan IKP</p><p className="text-xs text-slate-400 mt-0.5">{filtered.length} kebijakan</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={14} className="text-slate-500"/></button>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-green-400"/>
          </div>
          <select value={fStatus} onChange={e => setFS(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            <option value="SEMUA">Semua Status</option>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={fPilar} onChange={e => setFP(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            <option value="SEMUA">Semua Pilar</option>
            {allPilars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading
            ? <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={17} className="animate-spin"/><span className="text-sm">Memuat…</span></div>
            : filtered.length === 0
            ? <div className="py-12 text-center text-slate-400 text-sm">Tidak ada kebijakan cocok</div>
            : <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map(item => {
                  const sc = STATUS_COLORS[item.status];
                  const pc = getPilarColor(item.pilar);
                  const isDark = ['#6e1f1f', '#e85961', '#3b703b'].includes(sc?.bg);
                  return (
                    <button key={item.id} onClick={() => onPilih(item)}
                      className="w-full text-left px-5 py-3.5 hover:bg-green-50/60 dark:hover:bg-green-900/20 transition-colors flex items-start gap-3">
                      <div className="flex flex-col gap-1 mt-0.5 flex-shrink-0">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: sc?.bg || '#94a3b8', color: isDark ? '#fff' : '#1a2e00' }}>
                          {(item.status || '').replace(/_/g, ' ')}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: pc, backgroundColor: pc + '18' }}>
                          P{item.prioritas}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold mb-0.5" style={{ color: pc }}>{item.pilar}</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{item.kebijakan}</p>
                        {item.isu_strategis && <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">Isu: {item.isu_strategis}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DETAIL PROVINSI ────────────────────────────────────────────────────
function ModalDetailProvinsi({ provinsiNama, popupData, popupFitur, getWarna, getKategori, indikatorTerpilih, analysisId, onClose, onRekomendasiSaved }) {
  const { data: bankData, loading: bankLoading, load: loadBank } = useBankIKPProvinsi();
  const [rekLocal, setRekLocal]   = useState(() => JSON.parse(JSON.stringify(popupData?.rekomendasi || [])));
  const [isDirty, setIsDirty]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [bankModal, setBankModal] = useState(null);
  const [expanded, setExpanded]   = useState({});

  const markDirty = () => setIsDirty(true);
  const togglePilar = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));
  const toggleDisabled = (pi, ai) => {
    setRekLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const aksi = next[pi]?.aksi?.[ai];
      if (aksi) aksi.disabled = !aksi.disabled;
      return next;
    });
    markDirty();
  };
  const removeAksi = (pi, ai) => {
    setRekLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[pi].aksi.splice(ai, 1);
      next[pi].jumlah_aksi = next[pi].aksi.length;
      if (next[pi].aksi.length === 0) next.splice(pi, 1);
      return next;
    });
    markDirty();
  };
  const bankToAksi = (item, no = 1) => ({
    no_aksi: no, bank_id: item.id, isu_strategis: item.isu_strategis || '',
    nama_aksi: item.kebijakan || '', detail_aksi: item.rekomendasi || '',
    indikator_terkait: item.indikator_terkait || '', sub_sektor: item.pilar || '', disabled: false,
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
          const nA = bankToAksi(item, aksi.no_aksi);
          if (item.pilar && item.pilar !== next[pilarIdx].pilar) {
            next[pilarIdx].aksi.splice(aksiIdx, 1);
            next[pilarIdx].jumlah_aksi = next[pilarIdx].aksi.length;
            const ep = next.findIndex(p => p.pilar === item.pilar);
            if (ep >= 0) { next[ep].aksi.push({ ...nA, no_aksi: next[ep].aksi.length + 1 }); next[ep].jumlah_aksi = next[ep].aksi.length; }
            else next.push({ pilar: item.pilar, prioritas: item.prioritas || 3, jumlah_aksi: 1, aksi: [{ ...nA, no_aksi: 1 }] });
            if (next[pilarIdx].aksi.length === 0) next.splice(pilarIdx, 1);
          } else next[pilarIdx].aksi[aksiIdx] = nA;
        }
      } else if (mode === 'add_to_pilar') {
        const p = next[pilarIdx];
        if (p) { p.aksi.push(bankToAksi(item, p.aksi.length + 1)); p.jumlah_aksi = p.aksi.length; }
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
    if (!analysisId) { setSaveMsg('⚠️ Simpan analisis dulu.'); setTimeout(() => setSaveMsg(''), 4000); return; }
    setSaving(true); setSaveMsg('');
    try {
      await axios.patch(`${API_BASE}/ikp-analysis/${analysisId}/provinsi-kebijakan/`, { nama_provinsi: provinsiNama, rekomendasi: rekLocal });
      setSaveMsg('✅ Tersimpan!'); setIsDirty(false); onRekomendasiSaved?.(provinsiNama, rekLocal);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) { setSaveMsg(`❌ ${e.response?.data?.error || e.message}`); }
    finally { setSaving(false); }
  };

  const warna = popupFitur ? getWarna(popupFitur, indikatorTerpilih) : '#16a34a';
  const kat   = popupFitur ? getKategori(popupFitur, indikatorTerpilih) : '-';
  const kolomProyeksi = popupData?.kolom_prediksi || [];

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
                  {kolomProyeksi.length > 0 && <ProyeksiBadge kolomProyeksi={kolomProyeksi}/>}
                  {isDirty && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">● Belum disimpan</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={kat}/>
                  <span className="text-sm font-mono font-black" style={{ color: warna }}>IKP {popupData?.ikp ?? '—'}</span>
                  <span className="text-xs text-slate-400">Prioritas {popupData?.prioritas ?? '—'}</span>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex-shrink-0"><X size={16} className="text-slate-500"/></button>
            </div>
          </div>
          <div className="px-6 py-2.5 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => { loadBank(); setBankModal({ mode: 'add_new' }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm">
                <Plus size={11}/> Tambah
              </button>
              <span className="text-xs text-slate-400">{rekLocal.reduce((s, p) => s + (p.aksi?.filter(a => !a.disabled).length || 0), 0)} aktif</span>
            </div>
            <div className="flex items-center gap-2">
              {saveMsg && <span className="text-xs font-semibold">{saveMsg}</span>}
              <button onClick={handleSave} disabled={!isDirty || saving}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold',
                  isDirty ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed')}>
                {saving ? <Loader2 size={11} className="animate-spin"/> : <Save size={11}/>} {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {rekLocal.length === 0
              ? <div className="text-center py-10 text-slate-400">
                  <AlertCircle size={26} className="mx-auto mb-2 opacity-40"/>
                  <p className="text-sm mb-3">Belum ada rekomendasi.</p>
                  <button onClick={() => { loadBank(); setBankModal({ mode: 'add_new' }); }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold">+ Tambah</button>
                </div>
              : rekLocal.map((kelompok, ki) => {
                  const pc = getPilarColor(kelompok.pilar);
                  const isOpen = expanded[ki] !== false;
                  const aktif = kelompok.aksi?.filter(a => !a.disabled).length || 0;
                  const nonaktif = kelompok.aksi?.filter(a => a.disabled).length || 0;
                  return (
                    <div key={ki} className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                      <button onClick={() => togglePilar(ki)} className="flex items-center gap-3 px-4 py-2.5 w-full text-left"
                        style={{ backgroundColor: pc + '15', borderBottom: isOpen ? `1px solid ${pc}30` : 'none' }}>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pc }}/>
                        <span className="text-sm font-bold flex-1" style={{ color: pc }}>{kelompok.pilar}</span>
                        <span className="text-xs text-slate-400">{aktif} aktif{nonaktif > 0 ? ` · ${nonaktif} nonaktif` : ''}</span>
                        {isOpen ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
                      </button>
                      {isOpen && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {kelompok.aksi?.map((aksi, ai) => (
                            <div key={ai} className={cn('px-4 py-3 flex items-start gap-3',
                              aksi.disabled ? 'opacity-40 bg-slate-50 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800/20')}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-black"
                                style={{ backgroundColor: aksi.disabled ? '#94a3b8' : pc }}>{aksi.no_aksi || ai + 1}</span>
                              <div className="flex-1 min-w-0">
                                {aksi.disabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 mr-1">NONAKTIF</span>}
                                {aksi.isu_strategis && <p className="text-xs italic text-slate-400 mb-0.5">Isu: {aksi.isu_strategis}</p>}
                                <p className={cn('text-sm font-semibold leading-snug', aksi.disabled ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{aksi.nama_aksi}</p>
                                {aksi.detail_aksi && <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{aksi.detail_aksi}</p>}
                                {aksi.indikator_terkait && <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 rounded font-semibold">{aksi.indikator_terkait}</span>}
                              </div>
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <button onClick={() => { loadBank(); setBankModal({ mode: 'replace', pilarIdx: ki, aksiIdx: ai }); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500"><ArrowLeftRight size={11}/></button>
                                <button onClick={() => toggleDisabled(ki, ai)} className={cn('p-1.5 rounded-lg', aksi.disabled ? 'hover:bg-emerald-50 text-emerald-500' : 'hover:bg-amber-50 text-amber-500')}>{aksi.disabled ? <Eye size={11}/> : <EyeOff size={11}/>}</button>
                                <button onClick={() => removeAksi(ki, ai)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><X size={11}/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </div>
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-slate-400 italic">💡 Nonaktifkan = tandai. Hapus = hilangkan.</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold">Tutup</button>
          </div>
        </div>
      </div>
      {bankModal && <ModalPilihBank onClose={() => setBankModal(null)} onPilih={handlePilihBank} bankData={bankData} loading={bankLoading} statusHint={kat !== 'TIDAK_TERANALISIS' ? kat : ''}/>}
    </>
  );
}

// ─── TAB INFO ─────────────────────────────────────────────────────────────────
function TabInfo({ hasilAnalisis, jumlahKategori, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, eksporData, getWarna, getKategori }) {
  const [menuUnduh, setMenuUnduh] = useState(false);
  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih, getKategori]);

  if (!hasilAnalisis) return (
    <div className="py-16 text-center">
      <Wheat size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-base text-slate-500 dark:text-slate-400">Belum ada data. Klik <strong>Analisis IKP</strong> di peta.</p>
    </div>
  );

  const tahun       = hasilAnalisis.tahun;
  const adaProyeksi = hasilAnalisis.ada_prediksi;
  const totalTA     = hasilAnalisis.total_tidak_teranalisis || 0;

  const showKets = indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KETERSEDIAAN';
  const showKetj = indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KETERJANGKAUAN';
  const showPmnf = indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'PEMANFAATAN';

  return (
    <div className="space-y-5">
      {/* Header badges */}
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
            <Calendar size={11}/> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
          <Calendar size={11}/> Tahun {tahun}
        </span>
        {adaProyeksi && <ProyeksiBadge/>}
      </div>

      {/* Keterangan skor */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
        <Info size={14} className="text-green-500 flex-shrink-0"/>
        <p className="text-xs font-semibold text-green-700 dark:text-green-300">
          IKP bernilai <span className="font-black">0 – 100</span>. Skor <span className="font-black">100</span> adalah ketahanan pangan terbaik.
        </p>
      </div>

      {/* Peringatan proyeksi */}
      {adaProyeksi && (
        <div className="p-3.5 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">⚠️ Mengandung Data Prediksi (Regresi Linear OLS)</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
              Sebagian data tidak tersedia di database aktual Bapanas sehingga digantikan hasil prediksi OLS.
              <strong> Bukan data resmi Bapanas.</strong> Gunakan dengan hati-hati.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards — 6 kategori + total */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Teranalisis',   val: hasilAnalisis.total_success || 0,          cls: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700', valCls: 'text-green-700 dark:text-green-300' },
          { label: 'Sangat Rentan', val: jumlahKategori['SANGAT_RENTAN'] ?? 0,      cls: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700', valCls: 'text-red-800 dark:text-red-300' },
          { label: 'Rentan',        val: jumlahKategori['RENTAN'] ?? 0,             cls: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700', valCls: 'text-rose-700 dark:text-rose-300' },
          { label: 'Agak Rentan',   val: jumlahKategori['AGAK_RENTAN'] ?? 0,        cls: 'bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700', valCls: 'text-pink-700 dark:text-pink-300' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Agak Tahan',  val: jumlahKategori['AGAK_TAHAN'] ?? 0,  cls: 'bg-lime-50 dark:bg-lime-900/30 border-lime-200 dark:border-lime-700', valCls: 'text-lime-700 dark:text-lime-300' },
          { label: 'Tahan',       val: jumlahKategori['TAHAN'] ?? 0,        cls: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700', valCls: 'text-green-700 dark:text-green-300' },
          { label: 'Sangat Tahan',val: jumlahKategori['SANGAT_TAHAN'] ?? 0, cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700', valCls: 'text-emerald-700 dark:text-emerald-300' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>
      {totalTA > 0 && <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#a6a6a6' }}/><span>{totalTA} provinsi tidak teranalisis</span></div>}

      {/* Worst & Best */}
      {hasilAnalisis.worst_provinces?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
            <p className="text-xs font-bold text-red-700 dark:text-red-300 mb-2">🚨 5 Paling Rentan</p>
            <div className="space-y-1.5">
              {hasilAnalisis.worst_provinces.slice(0, 5).map((p, i) => (
                <div key={p.provinsi} className="flex items-center justify-between">
                  <span className="text-xs text-slate-700 dark:text-slate-200"><span className="font-bold text-red-500 mr-1">{i + 1}.</span>{p.provinsi}</span>
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">{p.ikp}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">✅ 5 Paling Tahan</p>
            <div className="space-y-1.5">
              {hasilAnalisis.best_provinces?.slice(0, 5).map((p, i) => (
                <div key={p.provinsi} className="flex items-center justify-between">
                  <span className="text-xs text-slate-700 dark:text-slate-200"><span className="font-bold text-emerald-500 mr-1">{i + 1}.</span>{p.provinsi}</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{p.ikp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabel */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{dataTerfilter.length} provinsi · {tahun}</p>
          <div className="flex items-center gap-2">
            <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
              className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
              <option value="SEMUA">SEMUA</option>
              {[...STATUS_LIST, 'TIDAK_TERANALISIS'].map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
            </select>
            <div className="relative">
              <button onClick={() => setMenuUnduh(!menuUnduh)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm shadow-sm">
                <Download size={13}/> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-600 py-1">
                  {['EXCEL', 'CSV', 'JSON', 'GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                      <Download size={11} className="text-green-500"/> {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
              <tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="px-3 py-3 text-center w-10">No</th>
                <th className="px-4 py-3 text-left">Provinsi</th>
                <th className="px-4 py-3 text-center">IKP</th>
                {showKets && <th className="px-3 py-3 text-center">Ketersediaan</th>}
                {showKetj && <th className="px-3 py-3 text-center">Keterjangkauan</th>}
                {showPmnf && <th className="px-3 py-3 text-center">Pemanfaatan</th>}
                <th className="px-3 py-3 text-center">Prioritas</th>
                <th className="px-4 py-3 text-center">Kategori</th>
                <th className="px-4 py-3 text-center">Sumber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {dataTerfilter.map((fitur, idx) => {
                const d   = fitur.properties.ikp_analysis;
                const w   = getWarna(fitur, indikatorTerpilih);
                const kat = getKategori(fitur, indikatorTerpilih);
                const isTA = kat === 'TIDAK_TERANALISIS';
                const kp  = d.kolom_prediksi || [];
                const isCampuran = d.sumber === 'campuran';
                const isProyeksi = d.sumber === 'prediksi';
                const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/60';
                const cellPred = (k) => kp.includes(k);
                return (
                  <tr key={d.nama_provinsi} className={cn('hover:bg-green-50/40 dark:hover:bg-green-900/10 transition-colors', rowBg)}>
                    <td className="px-3 py-3 text-center text-xs font-medium text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w }}/>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                        {d.rekomendasi_edited && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 border border-violet-200">✎ Edit</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA
                        ? <span className="text-xs text-slate-400 italic">—</span>
                        : <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.ikp ?? '—'}</span>}
                    </td>
                    {showKets && <td className={cn('px-3 py-3 text-center text-sm', cellPred('KETERSEDIAAN') ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                      {d.ketersediaan != null ? d.ketersediaan.toFixed(2) : '—'}{cellPred('KETERSEDIAAN') && <span className="ml-0.5 text-[9px]">*</span>}
                    </td>}
                    {showKetj && <td className={cn('px-3 py-3 text-center text-sm', cellPred('KETERJANGKAUAN') ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                      {d.keterjangkauan != null ? d.keterjangkauan.toFixed(2) : '—'}{cellPred('KETERJANGKAUAN') && <span className="ml-0.5 text-[9px]">*</span>}
                    </td>}
                    {showPmnf && <td className={cn('px-3 py-3 text-center text-sm', cellPred('PEMANFAATAN') ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                      {d.pemanfaatan != null ? d.pemanfaatan.toFixed(2) : '—'}{cellPred('PEMANFAATAN') && <span className="ml-0.5 text-[9px]">*</span>}
                    </td>}
                    <td className="px-3 py-3 text-center">
                      {d.prioritas ? <span className="text-xs font-black px-2 py-0.5 rounded-full border" style={{ borderColor: w + '80', color: w, backgroundColor: w + '18' }}>P{d.prioritas}</span> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={kat} size="xs"/>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA
                        ? <span className="text-xs text-slate-400 italic">—</span>
                        : (isProyeksi || isCampuran)
                        ? <ProyeksiBadge size="xs" kolomProyeksi={kp}/>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={9}/> Aktual
                          </span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 flex flex-wrap items-center gap-4">
            {adaProyeksi && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={10}/> * = data prediksi Regresi Linear OLS (bukan data resmi Bapanas)
              </p>
            )}
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-400"/><span className="text-[10px] text-slate-500">Aktual Bapanas</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400"/><span className="text-[10px] text-slate-500">Prediksi OLS</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB KEBIJAKAN ────────────────────────────────────────────────────────────
function TabKebijakan({ hasilAnalisis, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, getWarna, getKategori, analysisId }) {
  const { data: bankRaw, loading: bankLoading, error: bankError, refresh } = useBankKebijakanIKP();
  const [subTab, setSubTab]         = useState('bank');
  const [fStatus, setFS]            = useState('SEMUA');
  const [fPilar, setFP]             = useState('SEMUA');
  const [searchBank, setSB]         = useState('');
  const [searchProv, setSP]         = useState('');
  const [modal, setModal]           = useState(null);
  const [deletingId, setDelId]      = useState(null);
  const [expandedRow, setExp]       = useState(null);
  const [provinsiPopup, setPP]      = useState(null);
  const [featuresLocal, setFL]      = useState(null);

  useEffect(() => { if (hasilAnalisis?.matched_features?.features) setFL(hasilAnalisis.matched_features.features); }, [hasilAnalisis]);

  const dataTerfilter = useMemo(() => {
    const features = featuresLocal || hasilAnalisis?.matched_features?.features || [];
    let f = features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    if (searchProv.trim()) f = f.filter(x => x.properties?.ikp_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [featuresLocal, hasilAnalisis, kategoriTerpilih, indikatorTerpilih, searchProv, getKategori]);

  const allPilars    = useMemo(() => [...new Set(bankRaw.map(k => k.pilar).filter(Boolean))].sort(), [bankRaw]);
  const filteredBank = useMemo(() => {
    let d = bankRaw;
    if (fStatus !== 'SEMUA') d = d.filter(k => k.status === fStatus);
    if (fPilar  !== 'SEMUA') d = d.filter(k => k.pilar === fPilar);
    if (searchBank.trim()) { const q = searchBank.toLowerCase(); d = d.filter(k => k.kebijakan?.toLowerCase().includes(q) || k.pilar?.toLowerCase().includes(q) || k.isu_strategis?.toLowerCase().includes(q)); }
    return d;
  }, [bankRaw, fStatus, fPilar, searchBank]);

  const statsPerStatus = useMemo(() => {
    const c = { SANGAT_RENTAN: 0, RENTAN: 0, AGAK_RENTAN: 0, AGAK_TAHAN: 0, TAHAN: 0, SANGAT_TAHAN: 0 };
    bankRaw.forEach(k => { if (k.status && c[k.status] !== undefined) c[k.status]++; });
    return c;
  }, [bankRaw]);

  const handleDelete = async (id) => {
    if (!confirm('Hapus?')) return;
    setDelId(id);
    try { await axios.delete(`${API_BASE}/bank-kebijakan-ikp/${id}/delete/`); refresh(); }
    catch (e) { alert(e.response?.data?.error || 'Gagal'); }
    finally { setDelId(null); }
  };
  const handleRekSaved = useCallback((nm, nr) => {
    setFL(prev => {
      if (!prev) return prev;
      return prev.map(feat => {
        const ikp = feat.properties?.ikp_analysis;
        if (ikp?.nama_provinsi?.toUpperCase().trim() === nm.toUpperCase().trim())
          return { ...feat, properties: { ...feat.properties, ikp_analysis: { ...ikp, rekomendasi: nr, rekomendasi_edited: true } } };
        return feat;
      });
    });
  }, []);

  const popupFitur = provinsiPopup ? (featuresLocal || hasilAnalisis?.matched_features?.features || []).find(f => f.properties?.ikp_analysis?.nama_provinsi === provinsiPopup) : null;
  const popupData  = popupFitur?.properties?.ikp_analysis;

  return (
    <div className="space-y-4">
      {modal && <ModalKebijakan mode={modal.mode} data={modal.data} onClose={() => setModal(null)} onSaved={refresh}/>}
      {provinsiPopup && popupData && (
        <ModalDetailProvinsi provinsiNama={provinsiPopup} popupData={popupData} popupFitur={popupFitur}
          getWarna={getWarna} getKategori={getKategori} indikatorTerpilih={indikatorTerpilih}
          analysisId={analysisId} onClose={() => setPP(null)} onRekomendasiSaved={handleRekSaved}/>
      )}

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {[{ id: 'bank', label: 'Bank Kebijakan', icon: <FileText size={12}/> }, { id: 'provinsi', label: 'Per Provinsi', icon: <ClipboardList size={12}/> }].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              subTab === t.id ? 'bg-white dark:bg-slate-700 shadow text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {subTab === 'bank' && (
        <div className="space-y-4">
          {bankLoading
            ? <div className="flex items-center justify-center py-16 gap-3"><Loader2 size={22} className="text-green-500 animate-spin"/><span className="text-slate-500">Memuat...</span></div>
            : bankError
            ? <div className="flex items-center gap-2.5 p-4 bg-red-50 rounded-xl border border-red-200"><AlertCircle size={15} className="text-red-500"/><p className="text-sm text-red-700">{bankError}</p></div>
            : (
              <>
                {/* Stats per status (6 kolom) */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {STATUS_LIST.map(st => {
                    const sc = STATUS_COLORS[st];
                    const count = statsPerStatus[st] || 0;
                    const active = fStatus === st;
                    const isDark = ['#6e1f1f', '#e85961', '#3b703b'].includes(sc.bg);
                    return (
                      <button key={st} onClick={() => setFS(active ? 'SEMUA' : st)}
                        className={cn('p-2.5 rounded-xl border-2 text-center transition-all hover:scale-[1.02]', active ? 'shadow-lg' : '')}
                        style={{ borderColor: active ? sc.bg : sc.border, backgroundColor: active ? sc.bg : 'transparent' }}>
                        <div className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: active ? (isDark ? '#fff' : '#1a2e00') : sc.bg }}>{st.replace(/_/g, ' ')}</div>
                        <div className="text-xl font-black" style={{ color: active ? (isDark ? '#fff' : '#1a2e00') : sc.bg }}>{count}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" value={searchBank} onChange={e => setSB(e.target.value)} placeholder="Cari kebijakan..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-green-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"/>
                    {searchBank && <button onClick={() => setSB('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}
                  </div>
                  <select value={fPilar} onChange={e => setFP(e.target.value)}
                    className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                    <option value="SEMUA">Semua Pilar</option>
                    {allPilars.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button onClick={() => setModal({ mode: 'add' })} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm"><Plus size={12}/> Tambah</button>
                    <button onClick={refresh} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg"><RefreshCw size={12} className="text-slate-600 dark:text-slate-300"/></button>
                  </div>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">{filteredBank.length} kebijakan</span>
                {filteredBank.length === 0
                  ? <div className="py-12 text-center text-slate-400 text-sm">Tidak ada kebijakan</div>
                  : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                          <tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            <th className="px-3 py-3 text-left w-28">Status · P</th>
                            <th className="px-3 py-3 text-left w-36">Pilar</th>
                            <th className="px-4 py-3 text-left">Kebijakan</th>
                            <th className="px-3 py-3 text-center w-24">Indikator</th>
                            <th className="px-3 py-3 text-center w-20">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {filteredBank.map((item, i) => {
                            const sc = STATUS_COLORS[item.status];
                            const pc = getPilarColor(item.pilar);
                            const isDark = ['#6e1f1f', '#e85961', '#3b703b'].includes(sc?.bg);
                            const isExp = expandedRow === item.id;
                            return (
                              <React.Fragment key={item.id}>
                                <tr className={cn('cursor-pointer transition-colors',
                                  i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60',
                                  isExp && 'bg-green-50/50 dark:bg-green-900/10', 'hover:bg-slate-50 dark:hover:bg-slate-700/40')}
                                  onClick={() => setExp(isExp ? null : item.id)}>
                                  <td className="px-3 py-2.5">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white w-fit"
                                        style={{ backgroundColor: sc?.bg || '#94a3b8', color: isDark ? '#fff' : '#1a2e00' }}>
                                        {(item.status || '').replace(/_/g, ' ')}
                                      </span>
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">P{item.prioritas}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5"><span className="text-xs font-semibold" style={{ color: pc }}>{item.pilar}</span></td>
                                  <td className="px-4 py-2.5">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{item.kebijakan}</p>
                                    {item.isu_strategis && <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">{item.isu_strategis}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: pc + '40', color: pc, backgroundColor: pc + '10' }}>
                                      {item.indikator_terkait || '—'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => setModal({ mode: 'edit', data: { id: item.id, status: item.status, prioritas: item.prioritas, pilar_kebijakan: item.pilar, isu_strategis: item.isu_strategis || '', kebijakan: item.kebijakan, rekomendasi_program: item.rekomendasi, indikator_terkait: item.indikator_terkait } })}
                                        className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Pencil size={11} className="text-blue-500"/></button>
                                      <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50">
                                        {deletingId === item.id ? <Loader2 size={11} className="text-red-400 animate-spin"/> : <Trash2 size={11} className="text-red-400"/>}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {isExp && (
                                  <tr className="bg-green-50/30 dark:bg-green-900/10 border-b border-green-100 dark:border-green-800/30">
                                    <td colSpan={5} className="px-4 py-3">
                                      <div className="flex items-start gap-2.5">
                                        <ChevronRight size={13} className="text-green-400 flex-shrink-0 mt-0.5"/>
                                        <div>
                                          <p className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">Rekomendasi Program:</p>
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
                  )
                }
              </>
            )
          }
        </div>
      )}

      {subTab === 'provinsi' && (
        <div className="space-y-4">
          {!hasilAnalisis
            ? <div className="py-16 text-center"><ClipboardList size={34} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-500">Jalankan analisis peta terlebih dahulu.</p></div>
            : (
              <>
                {!analysisId && (
                  <div className="flex items-start gap-2.5 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-200 dark:border-sky-700">
                    <AlertCircle size={13} className="text-sky-500 flex-shrink-0 mt-0.5"/>
                    <p className="text-sm text-sky-700 dark:text-sky-300">Simpan analisis terlebih dahulu agar perubahan tersimpan permanen.</p>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" value={searchProv} onChange={e => setSP(e.target.value)} placeholder="Cari provinsi..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-green-400 text-slate-800 dark:text-slate-100"/>
                    {searchProv && <button onClick={() => setSP('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}
                  </div>
                  <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
                    className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                    <option value="SEMUA">SEMUA</option>
                    {[...STATUS_LIST, 'TIDAK_TERANALISIS'].map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                  </select>
                  <span className="text-sm text-slate-400 dark:text-slate-500">{dataTerfilter.length} provinsi</span>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                      <tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Provinsi</th>
                        <th className="px-3 py-3 text-center">IKP</th>
                        <th className="px-3 py-3 text-center">Prioritas</th>
                        <th className="px-3 py-3 text-center">Kategori</th>
                        <th className="px-3 py-3 text-center">Sumber</th>
                        <th className="px-3 py-3 text-center w-24">Kelola</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {dataTerfilter.map((fitur, idx) => {
                        const d   = fitur.properties.ikp_analysis;
                        const w   = getWarna(fitur, indikatorTerpilih);
                        const kat = getKategori(fitur, indikatorTerpilih);
                        const isTA = kat === 'TIDAK_TERANALISIS';
                        const kp  = d.kolom_prediksi || [];
                        const isPredOrMixed = d.sumber === 'prediksi' || d.sumber === 'campuran';
                        return (
                          <tr key={d.nama_provinsi} className={cn('hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors', idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60')}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w }}/>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                                {d.rekomendasi_edited && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 border border-violet-200">✎ Edit</span>}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-bold font-mono text-slate-800 dark:text-slate-100">{d.ikp ?? '—'}</td>
                            <td className="px-3 py-3 text-center">
                              {d.prioritas ? <span className="text-xs font-black px-2 py-0.5 rounded-full border" style={{ borderColor: w + '80', color: w, backgroundColor: w + '18' }}>P{d.prioritas}</span> : <span className="text-xs text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center"><StatusBadge status={kat}/></td>
                            <td className="px-3 py-3 text-center">
                              {isTA ? <span className="text-xs text-slate-400 italic">—</span>
                                : isPredOrMixed ? <ProyeksiBadge size="xs" kolomProyeksi={kp}/>
                                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 border border-emerald-200"><CheckCircle2 size={9}/> Aktual</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {!isTA && (
                                <button onClick={() => setPP(d.nama_provinsi)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-600 dark:text-green-300 rounded-lg text-xs font-semibold mx-auto">
                                  <Pencil size={10}/> Kelola
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          }
        </div>
      )}
    </div>
  );
}

// ─── MODAL KEBIJAKAN ──────────────────────────────────────────────────────────
function ModalKebijakan({ mode, data, onClose, onSaved }) {
  const [form, setForm]     = useState(mode === 'edit' ? { ...data } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.kebijakan?.trim()) e.kebijakan = 'Wajib';
    if (!form.rekomendasi_program?.trim()) e.rekomendasi_program = 'Wajib';
    if (!form.isu_strategis?.trim()) e.isu_strategis = 'Wajib';
    return e;
  };
  const handleSave = async () => {
    const e = validate(); if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      if (mode === 'edit') await axios.put(`${API_BASE}/bank-kebijakan-ikp/${data.id}/update/`, form);
      else await axios.post(`${API_BASE}/bank-kebijakan-ikp/add/`, form);
      onSaved(); onClose();
    } catch (err) { alert(err.response?.data?.error || 'Gagal'); }
    finally { setSaving(false); }
  };

  const Field = ({ label, name, type = 'text', options, required }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {type === 'select'
        ? <select value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-green-500">{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>
        : type === 'textarea'
        ? <textarea rows={3} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-green-500 resize-none', errors[name] ? 'border-red-400' : 'border-slate-200 dark:border-slate-500')}/>
        : <input type="text" value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-green-500', errors[name] ? 'border-red-400' : 'border-slate-200 dark:border-slate-500')}/>
      }
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">{mode === 'edit' ? <Pencil size={13} className="text-green-600"/> : <Plus size={13} className="text-green-600"/>}</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{mode === 'edit' ? 'Edit' : 'Tambah'} Kebijakan IKP</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={15} className="text-slate-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status" name="status" type="select" options={STATUS_LIST.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}/>
            <Field label="Prioritas" name="prioritas" type="select" options={[1,2,3,4,5,6].map(p => ({ value: p, label: `P${p}` }))}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pilar" name="pilar_kebijakan" type="select" options={PILAR_LIST}/>
            <Field label="Indikator" name="indikator_terkait" type="select" options={['KETERSEDIAAN', 'KETERJANGKAUAN', 'PEMANFAATAN', 'ALL']}/>
          </div>
          <Field label="Isu Strategis" name="isu_strategis" required/>
          <Field label="Kebijakan" name="kebijakan" type="textarea" required/>
          <Field label="Rekomendasi Program" name="rekomendasi_program" type="textarea" required/>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Batal</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}{saving ? 'Menyimpan...' : mode === 'edit' ? 'Simpan' : 'Tambah'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB METODOLOGI ───────────────────────────────────────────────────────────
function MetSection({ accentColor, title, sub, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-left">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }}/>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
            {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
          </div>
        </div>
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform flex-shrink-0', open && 'rotate-180')}/>
      </button>
      {open && <div className="border-t border-slate-100 dark:border-slate-700 px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

function MathBlock({ children, className = '' }) {
  return (
    <div className={cn('font-mono text-sm text-slate-800 dark:text-slate-100 px-4 py-3 bg-slate-50 dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto', className)}>
      {children}
    </div>
  );
}

function TabMetodologi() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-1">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0"><Wheat size={16} className="text-green-600 dark:text-green-400"/></div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metodologi IKP — Badan Pangan Nasional (Bapanas)</h2>
          <p className="text-sm text-slate-400 mt-0.5">Indeks Komposit · 3 Aspek · 12 Indikator · FSVA</p>
        </div>
      </div>

      {/* FORMULA UTAMA */}
      <MetSection accentColor="#16a34a" title="Formula Utama IKP" sub="Rata-rata tertimbang tiga aspek ketahanan pangan" defaultOpen>
        <MathBlock className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-green-700 dark:text-green-300 text-base">IKP</span>
            <span className="text-base">=</span>
            <span className="text-slate-700 dark:text-slate-200">(I_Ketersediaan × 0,335)</span>
            <span>+</span>
            <span className="text-slate-700 dark:text-slate-200">(I_Keterjangkauan × 0,330)</span>
            <span>+</span>
            <span className="text-slate-700 dark:text-slate-200">(I_Pemanfaatan × 0,335)</span>
          </div>
        </MathBlock>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
          Skor tiap aspek (0–100) diambil langsung dari publikasi resmi Bapanas. Bapanas telah menjalankan standarisasi dan pembobotan indikator secara internal. Total bobot = 33,5% + 33,0% + 33,5% = 100%.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: 'Ketersediaan', bobot: '33,5%', warna: '#ca8a04' },
            { label: 'Keterjangkauan', bobot: '33,0%', warna: '#2563eb' },
            { label: 'Pemanfaatan', bobot: '33,5%', warna: '#dc2626' },
          ].map(item => (
            <div key={item.label} className="text-center p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <div className="text-xs text-slate-400 mb-1">{item.label}</div>
              <div className="text-lg font-black" style={{ color: item.warna }}>{item.bobot}</div>
            </div>
          ))}
        </div>
      </MetSection>

      {/* ASPEK KETERSEDIAAN */}
      <MetSection accentColor="#ca8a04" title="Aspek Ketersediaan Pangan (33,5%)" sub="Kecukupan pasokan pangan domestik">
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
          <table className="w-full text-xs">
            <thead className="bg-amber-50 dark:bg-amber-900/20">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-amber-800 dark:text-amber-200">Indikator</th>
                <th className="px-3 py-2.5 text-center font-bold text-amber-800 dark:text-amber-200 w-20">Bobot (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {[
                { ind: 'Rasio konsumsi normatif per kapita terhadap ketersediaan pangan (padi, jagung, ubi kayu, ubi jalar, sagu, pisang)', bobot: 9.5 },
                { ind: 'Rasio ketersediaan energi per kapita per hari terhadap standar kebutuhan', bobot: 8.0 },
                { ind: 'Rasio ketersediaan protein hewani per kapita per hari terhadap standar kebutuhan', bobot: 8.0 },
                { ind: 'Rasio CBPD terhadap CBPD berdasarkan peraturan perundang-undangan', bobot: 8.0 },
              ].map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60'}>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.ind}</td>
                  <td className="px-3 py-2 text-center font-bold text-amber-700 dark:text-amber-300">{r.bobot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MetSection>

      {/* ASPEK KETERJANGKAUAN */}
      <MetSection accentColor="#2563eb" title="Aspek Keterjangkauan Pangan (33,0%)" sub="Kemampuan ekonomi dan fisik mengakses pangan">
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
          <table className="w-full text-xs">
            <thead className="bg-blue-50 dark:bg-blue-900/20">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-blue-800 dark:text-blue-200">Indikator</th>
                <th className="px-3 py-2.5 text-center font-bold text-blue-800 dark:text-blue-200 w-20">Bobot (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {[
                { ind: 'Persentase penduduk hidup di bawah garis kemiskinan', bobot: 11.8 },
                { ind: 'Koefisien variasi harga (beras medium, daging ayam, telur, minyak goreng)', bobot: 11.3 },
                { ind: 'Prevalence of Undernourishment (PoU)', bobot: 9.9 },
              ].map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60'}>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.ind}</td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-300">{r.bobot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MetSection>

      {/* ASPEK PEMANFAATAN */}
      <MetSection accentColor="#dc2626" title="Aspek Pemanfaatan Pangan (33,5%)" sub="Kemampuan tubuh menyerap & memanfaatkan pangan">
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
          <table className="w-full text-xs">
            <thead className="bg-red-50 dark:bg-red-900/20">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold text-red-800 dark:text-red-200">Indikator</th>
                <th className="px-3 py-2.5 text-center font-bold text-red-800 dark:text-red-200 w-20">Bobot (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {[
                { ind: 'Rata-rata lama sekolah perempuan umur di atas 15 tahun', bobot: 5.0 },
                { ind: 'Persentase rumah tangga tanpa akses ke air bersih', bobot: 7.5 },
                { ind: 'Persentase keamanan pangan yang memenuhi standar terhadap total sampel', bobot: 6.0 },
                { ind: 'Skor Pola Pangan Harapan (PPH) konsumsi', bobot: 7.8 },
                { ind: 'Prevalensi balita dengan tinggi badan di bawah standar (stunting)', bobot: 7.2 },
              ].map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60'}>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.ind}</td>
                  <td className="px-3 py-2 text-center font-bold text-red-700 dark:text-red-300">{r.bobot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MetSection>

      {/* KLASIFIKASI */}
      <MetSection accentColor="#16a34a" title="Klasifikasi Status IKP" sub="6 prioritas berdasarkan ambang batas Bapanas" defaultOpen>
        <div className="space-y-2">
          {[
            { label: 'SANGAT RENTAN', range: '< 45,59', warna: '#6e1f1f', tc: '#fff', prio: 1 },
            { label: 'RENTAN',        range: '45,60 – 53,42', warna: '#e85961', tc: '#fff', prio: 2 },
            { label: 'AGAK RENTAN',   range: '53,43 – 61,47', warna: '#f4a1a7', tc: '#7f1d1d', prio: 3 },
            { label: 'AGAK TAHAN',    range: '61,48 – 69,52', warna: '#c9e077', tc: '#1a2e00', prio: 4 },
            { label: 'TAHAN',         range: '69,53 – 77,35', warna: '#94c945', tc: '#1a2e00', prio: 5 },
            { label: 'SANGAT TAHAN',  range: '> 77,35', warna: '#3b703b', tc: '#fff', prio: 6 },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: s.warna + '15', border: `1px solid ${s.warna}40` }}>
              <span className="text-xs font-black w-5 text-center" style={{ color: s.warna }}>P{s.prio}</span>
              <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: s.warna }}/>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{s.label}</span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{s.range}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#a6a6a6' }}/>
          <span>TIDAK TERANALISIS — data tidak tersedia di database</span>
        </div>
      </MetSection>

      {/* CATATAN PREDIKSI */}
      <MetSection accentColor="#f59e0b" title="Catatan Prediksi — Regresi Linear OLS" sub="Digunakan sebagai fallback jika data aktual Bapanas tidak tersedia">
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">Prediksi adalah Estimasi — Bukan Data Resmi Bapanas</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                Ketika data aktual skor aspek IKP tidak tersedia di database untuk tahun yang dipilih, sistem menggunakan model Regresi Linear OLS sebagai fallback. Model ini memprediksi nilai berdasarkan tren historis data Bapanas 2010–2024.
              </p>
            </div>
          </div>
          <MathBlock>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-600 dark:text-amber-400">ŷ</span>
              <span>=</span>
              <span className="text-slate-700 dark:text-slate-200">β₀ + β₁ · x</span>
            </div>
          </MathBlock>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: 'Metode', v: 'Linear OLS' },
              { l: 'Data Training', v: '2010–2024' },
              { l: 'Wilayah', v: '34 Provinsi' },
              { l: 'Tahun Proyeksi', v: '2025–2045' },
            ].map(item => (
              <div key={item.l} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                <div className="text-xs text-slate-400 mb-1">{item.l}</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.v}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sistem selalu mengambil data aktual Bapanas terlebih dahulu. Jika tidak tersedia, menggunakan prediksi OLS sebagai fallback. Kolom prediksi ditandai <span className="font-bold text-amber-600">⚠️</span>.
          </p>
        </div>
      </MetSection>
    </div>
  );
}

// ─── TAB TREN ─────────────────────────────────────────────────────────────────
function TabTren({ daftarTersimpan }) {
  const [chartMode, setCM] = useState('distribusi');

  const trendData = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(item => {
      const key = `${item.tahun}`;
      if (!map[key] || item.timestamp > map[key].timestamp) map[key] = item;
    });
    return Object.values(map).sort((a, b) => a.tahun - b.tahun).map(item => ({
      tahun: item.tahun,
      SANGAT_RENTAN:    item.kategori_distribusi?.SANGAT_RENTAN ?? 0,
      RENTAN:           item.kategori_distribusi?.RENTAN ?? 0,
      AGAK_RENTAN:      item.kategori_distribusi?.AGAK_RENTAN ?? 0,
      AGAK_TAHAN:       item.kategori_distribusi?.AGAK_TAHAN ?? 0,
      TAHAN:            item.kategori_distribusi?.TAHAN ?? 0,
      SANGAT_TAHAN:     item.kategori_distribusi?.SANGAT_TAHAN ?? 0,
      TIDAK_TERANALISIS:item.kategori_distribusi?.TIDAK_TERANALISIS ?? 0,
      adaPrediksi:      item.ada_prediksi || false,
    }));
  }, [daftarTersimpan]);

  const tahunCovered = [...new Set(daftarTersimpan.map(d => d.tahun).filter(Boolean))].sort();
  const latestData   = trendData[trendData.length - 1];

  if (!daftarTersimpan.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-4"><TrendingUp size={26} className="text-green-400"/></div>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Belum ada data tersimpan</p>
    </div>
  );

  const bars6 = [
    { key: 'SANGAT_RENTAN', color: '#6e1f1f', name: 'Sangat Rentan' },
    { key: 'RENTAN',        color: '#e85961', name: 'Rentan' },
    { key: 'AGAK_RENTAN',   color: '#f4a1a7', name: 'Agak Rentan' },
    { key: 'AGAK_TAHAN',    color: '#c9e077', name: 'Agak Tahan' },
    { key: 'TAHAN',         color: '#94c945', name: 'Tahan' },
    { key: 'SANGAT_TAHAN',  color: '#3b703b', name: 'Sangat Tahan' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-green-500" size={20}/>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Panel Tren IKP</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{daftarTersimpan.length} analisis · {tahunCovered.length} tahun</p>
        </div>
      </div>

      {/* Stats ringkas */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {bars6.map(({ key, color, name }) => (
          <div key={key} className="rounded-xl p-2.5 text-center border border-slate-200 dark:border-slate-600">
            <div className="text-[9px] font-bold uppercase mb-1" style={{ color }}>{name.replace(' ', '\n')}</div>
            <div className="text-xl font-black" style={{ color }}>{latestData?.[key] ?? '-'}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm text-slate-500">{trendData.length} titik data</span>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {[['distribusi', 'Bar'], ['area', 'Area']].map(([key, lbl]) => (
            <button key={key} onClick={() => setCM(key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold', chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400')}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {trendData.length === 0
        ? <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data</div>
        : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
            {chartMode === 'distribusi' && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5}/>
                  <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  {bars6.map(({ key, color, name }) => (
                    <Bar key={key} dataKey={key} name={name} stackId="a" fill={color}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartMode === 'area' && (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    {bars6.map(({ key, color }) => (
                      <linearGradient key={key} id={`g${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5}/>
                  <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  {bars6.map(({ key, color, name }) => (
                    <Area key={key} type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} fill={`url(#g${key})`} dot={{ r: 3, fill: color }}/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )
      }

      {/* Cakupan tahun */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cakupan Tahun Tersimpan</div>
        <div className="flex flex-wrap gap-1.5">
          {TAHUN_TERSEDIA_IKP.map(thn => {
            const ada = tahunCovered.includes(thn);
            const mungkinPrediksi = thn > 2024;
            return (
              <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border',
                ada ? (mungkinPrediksi
                  ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300')
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

// ─── MAIN TABS ─────────────────────────────────────────────────────────────────
export default function TabsPangan({
  activeTab, setActiveTab, hasilAnalisis, jumlahKategori,
  indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
  tahunTerpilih, daftarTersimpan, eksporData, getWarna, getKategori, analysisId,
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold transition-all relative flex-1 whitespace-nowrap',
                active ? 'text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-900/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30')}>
              <Icon size={14}/><span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-t-full"/>}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {activeTab === 'info'      && <TabInfo hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} eksporData={eksporData} getWarna={getWarna} getKategori={getKategori}/>}
        {activeTab === 'kebijakan' && <TabKebijakan hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} getWarna={getWarna} getKategori={getKategori} analysisId={analysisId}/>}
        {activeTab === 'metadata'  && <TabMetodologi/>}
        {activeTab === 'tren'      && <TabTren daftarTersimpan={daftarTersimpan}/>}
      </div>
    </div>
  );
}