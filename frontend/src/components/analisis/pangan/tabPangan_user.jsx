"use client";
// ─── TABS IKP — USER ──────────────────────────────────────────────────────────
// Tab Info      : tabel hasil read-only + unduh
// Tab Kebijakan : lihat bank IKP + kirim USULAN (tambah/edit/per-provinsi)
// Tab Metodologi: sama seperti admin
// Tab Tren      : baca-saja
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Download, ChevronDown, Info, FileText, Calendar,
  TrendingUp, ClipboardList, BookOpen, AlertCircle, X,
  Brain, Loader2, Plus, Pencil, Eye, ChevronUp, ChevronRight,
  CheckCircle2, Search, AlertTriangle, Send, Clock, CheckCheck,
  XCircle, MessageSquarePlus, RefreshCw, Layers, BarChart2,
  Wheat, ShoppingCart, Heart,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
  SANGAT_RENTAN: { bg: '#6e1f1f', badge: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200' },
  RENTAN:        { bg: '#e85961', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
  AGAK_RENTAN:   { bg: '#f4a1a7', badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' },
  AGAK_TAHAN:    { bg: '#c9e077', badge: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300' },
  TAHAN:         { bg: '#94c945', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  SANGAT_TAHAN:  { bg: '#3b703b', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  TIDAK_TERANALISIS: { bg: '#a6a6a6', badge: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
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
const getPilarColor = p => PILAR_COLORS[p] || '#16a34a';
const INDIKATOR_TERKAIT_LIST = ['KETERSEDIAAN', 'KETERJANGKAUAN', 'PEMANFAATAN', 'ALL'];

const EMPTY_USULAN = {
  status_kebijakan: 'AGAK_RENTAN', prioritas: 3, pilar_kebijakan: 'Ketersediaan Pangan',
  isu_strategis: '', kebijakan: '', rekomendasi_program: '', indikator_terkait: 'KETERSEDIAAN',
  catatan_user: '',
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function StatusBadge({ status, size = 'sm' }) {
  const sc = STATUS_COLORS[status];
  if (!sc) return null;
  const isDark = ['#6e1f1f', '#e85961', '#3b703b'].includes(sc.bg);
  return (
    <span className={cn('inline-flex items-center font-bold rounded-full',
      size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5', sc.badge)}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}

function UsulanStatusBadge({ status }) {
  const map = {
    PENDING:  { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200',  icon: <Clock size={9}/>,     label: 'Menunggu Persetujuan' },
    APPROVED: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200', icon: <CheckCheck size={9}/>, label: 'Disetujui' },
    REJECTED: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200', icon: <XCircle size={9}/>, label: 'Ditolak' },
  };
  const m = map[status] || map.PENDING;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', m.cls)}>
      {m.icon} {m.label}
    </span>
  );
}

function ProyeksiBadge({ size = 'sm', kolomProyeksi = [] }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold rounded-full border bg-amber-50 dark:bg-amber-900/30',
      size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5')}
      style={{ borderColor: '#fcd34d', color: '#92400e' }}>
      <AlertTriangle size={size === 'xs' ? 7 : 9}/> Prediksi OLS
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

// ─── MODAL USULAN KEBIJAKAN ────────────────────────────────────────────────────
function ModalUsulanKebijakan({ mode, kebijakanLama, onClose, onKirim, sending }) {
  const [form, setForm] = useState(
    mode === 'edit' && kebijakanLama
      ? {
          status_kebijakan:    kebijakanLama.status,
          prioritas:           kebijakanLama.prioritas,
          pilar_kebijakan:     kebijakanLama.pilar || kebijakanLama.pilar_kebijakan,
          isu_strategis:       kebijakanLama.isu_strategis || '',
          kebijakan:           kebijakanLama.kebijakan || '',
          rekomendasi_program: kebijakanLama.rekomendasi || kebijakanLama.rekomendasi_program || '',
          indikator_terkait:   kebijakanLama.indikator_terkait || 'KETERSEDIAAN',
          catatan_user:        '',
        }
      : { ...EMPTY_USULAN }
  );
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.kebijakan?.trim()) e.kebijakan = 'Wajib';
    if (!form.rekomendasi_program?.trim()) e.rekomendasi_program = 'Wajib';
    if (!form.isu_strategis?.trim()) e.isu_strategis = 'Wajib';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onKirim({
      indeks:       'IKP',
      tipe:         mode === 'edit' ? 'EDIT' : 'TAMBAH',
      kebijakan_id: mode === 'edit' ? kebijakanLama?.id : undefined,
      ...form,
    });
  };

  const Field = ({ label, name, type = 'text', options, required }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === 'select'
        ? <select value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-green-500">
            {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
          </select>
        : type === 'textarea'
        ? <textarea rows={3} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
            className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-green-500 resize-none',
              errors[name] ? 'border-red-400' : 'border-slate-200 dark:border-slate-500')}/>
        : <input type="text" value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
            className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-green-500',
              errors[name] ? 'border-red-400' : 'border-slate-200 dark:border-slate-500')}/>
      }
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <MessageSquarePlus size={15} className="text-amber-600"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {mode === 'edit' ? 'Usul Perbaikan Kebijakan IKP' : 'Usul Kebijakan IKP Baru'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Usulan akan direview Admin sebelum diterapkan</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>

        {mode === 'edit' && kebijakanLama && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data saat ini (yang akan diubah)</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 line-clamp-2">{kebijakanLama.kebijakan}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 italic line-clamp-1">{kebijakanLama.isu_strategis}</p>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {mode === 'tambah' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status" name="status_kebijakan" type="select"
                options={STATUS_LIST.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}/>
              <Field label="Prioritas" name="prioritas" type="select"
                options={[1,2,3,4,5,6].map(p => ({ value: p, label: `P${p}` }))}/>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pilar" name="pilar_kebijakan" type="select" options={PILAR_LIST}/>
            <Field label="Indikator" name="indikator_terkait" type="select" options={INDIKATOR_TERKAIT_LIST}/>
          </div>
          <Field label="Isu Strategis" name="isu_strategis" required/>
          <Field label="Kebijakan yang Diusulkan" name="kebijakan" type="textarea" required/>
          <Field label="Rekomendasi Program" name="rekomendasi_program" type="textarea" required/>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Catatan untuk Admin <span className="text-slate-400 font-normal">(opsional)</span>
            </label>
            <textarea rows={2} value={form.catatan_user} onChange={e => setForm(p => ({ ...p, catatan_user: e.target.value }))}
              placeholder="Jelaskan alasan atau konteks usulan Anda..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-amber-400 resize-none placeholder:text-slate-400"/>
          </div>
        </div>

        <div className="mx-5 mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-center gap-2">
          <Clock size={11} className="text-amber-500 flex-shrink-0"/>
          <p className="text-[10px] text-amber-700 dark:text-amber-300">
            Usulan akan masuk ke antrian review Admin. Bank kebijakan tidak berubah sampai disetujui.
          </p>
        </div>

        <div className="px-6 pb-5 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={sending}
            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {sending ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
            {sending ? 'Mengirim...' : 'Kirim Usulan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL USULAN REKOMENDASI PROVINSI ────────────────────────────────────────
function ModalUsulanProvinsi({ provinsiNama, popupData, popupFitur, getWarna, getKategori,
  indikatorTerpilih, analysisId, onClose, onKirim, sending }) {
  const [rekLocal, setRekLocal] = useState(() => JSON.parse(JSON.stringify(popupData?.rekomendasi || [])));
  const [catatan,  setCatatan]  = useState('');
  const [expanded, setExpanded] = useState({});

  const warna = popupFitur ? getWarna(popupFitur, indikatorTerpilih) : '#16a34a';
  const kat   = popupFitur ? getKategori(popupFitur, indikatorTerpilih) : '-';

  const toggleAksi = (pi, ai) => {
    setRekLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const aksi = next[pi]?.aksi?.[ai];
      if (aksi) aksi.disabled = !aksi.disabled;
      return next;
    });
  };
  const removeAksi = (pi, ai) => {
    setRekLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[pi].aksi.splice(ai, 1);
      if (next[pi].aksi.length === 0) next.splice(pi, 1);
      return next;
    });
  };

  const handleKirim = () => {
    onKirim({
      indeks:               'IKP',
      tipe:                 'PROVINSI',
      analysis_id:          analysisId,
      nama_provinsi:        provinsiNama,
      rekomendasi_provinsi: rekLocal,
      catatan_user:         catatan,
    });
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0" style={{ borderLeft: `4px solid ${warna}` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{provinsiNama}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">✏️ Usul Perubahan</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={kat}/>
                <span className="text-sm font-mono font-black" style={{ color: warna }}>IKP {popupData?.ikp ?? '—'}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex-shrink-0">
              <X size={16} className="text-slate-500"/>
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-amber-500 flex-shrink-0"/>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Perubahan rekomendasi ini dikirim sebagai <strong>usulan</strong> dan baru diterapkan setelah disetujui Admin.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {rekLocal.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle size={24} className="mx-auto mb-2 opacity-40"/>
              <p className="text-sm">Belum ada rekomendasi untuk diusulkan.</p>
            </div>
          ) : rekLocal.map((kelompok, ki) => {
            const pc     = getPilarColor(kelompok.pilar);
            const isOpen = expanded[ki] !== false;
            const aktif  = kelompok.aksi?.filter(a => !a.disabled).length || 0;
            return (
              <div key={ki} className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button onClick={() => setExpanded(p => ({ ...p, [ki]: !p[ki] }))}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left"
                  style={{ backgroundColor: pc + '15', borderBottom: isOpen ? `1px solid ${pc}30` : 'none' }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pc }}/>
                  <span className="text-sm font-bold flex-1" style={{ color: pc }}>{kelompok.pilar}</span>
                  <span className="text-xs text-slate-400">{aktif} aktif</span>
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
                          <p className={cn('text-sm font-semibold leading-snug', aksi.disabled ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>
                            {aksi.nama_aksi}
                          </p>
                          {aksi.detail_aksi && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{aksi.detail_aksi}</p>}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => toggleAksi(ki, ai)}
                            className={cn('p-1.5 rounded-lg', aksi.disabled ? 'hover:bg-emerald-50 text-emerald-500' : 'hover:bg-amber-50 text-amber-500')}>
                            <Eye size={11}/>
                          </button>
                          <button onClick={() => removeAksi(ki, ai)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400">
                            <X size={11}/>
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

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 space-y-3 flex-shrink-0">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Catatan untuk Admin <span className="text-slate-400 font-normal">(opsional)</span>
            </label>
            <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)}
              placeholder="Jelaskan alasan perubahan rekomendasi..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-amber-400 resize-none placeholder:text-slate-400"/>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold">
              Batal
            </button>
            <button onClick={handleKirim} disabled={sending}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
              {sending ? 'Mengirim...' : 'Kirim Usulan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB KEBIJAKAN USER ────────────────────────────────────────────────────────
function TabKebijakanUser({ hasilAnalisis, indikatorTerpilih, kategoriTerpilih,
  setKategoriTerpilih, getWarna, getKategori, analysisId }) {
  const [subTab,      setSubTab]      = useState('bank');
  const [bankData,    setBankData]    = useState([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [fStatus,     setFS]          = useState('SEMUA');
  const [fPilar,      setFP]          = useState('SEMUA');
  const [searchBank,  setSB]          = useState('');
  const [searchProv,  setSP]          = useState('');
  const [expandedRow, setExp]         = useState(null);
  const [modalUsul,   setModalUsul]   = useState(null);
  const [modalProv,   setModalProv]   = useState(null);
  const [sending,     setSending]     = useState(false);
  const [daftarUsul,  setDaftarUsul]  = useState([]);
  const [usulLoading, setUsulLoading] = useState(false);
  const [toastMsg,    setToastMsg]    = useState('');

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  useEffect(() => {
    setBankLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-ikp/`)
      .then(r => setBankData(r.data.results || []))
      .catch(() => {})
      .finally(() => setBankLoading(false));
  }, []);

  const muatUsulan = useCallback(() => {
    setUsulLoading(true);
    axios.get(`${API_BASE}/ikp-usulan/saya/`)
      .then(r => setDaftarUsul(r.data.results || []))
      .catch(() => {})
      .finally(() => setUsulLoading(false));
  }, []);
  useEffect(() => { if (subTab === 'usulan') muatUsulan(); }, [subTab, muatUsulan]);

  const allPilars    = useMemo(() => [...new Set(bankData.map(k => k.pilar).filter(Boolean))].sort(), [bankData]);
  const filteredBank = useMemo(() => {
    let d = bankData;
    if (fStatus !== 'SEMUA') d = d.filter(k => k.status === fStatus);
    if (fPilar  !== 'SEMUA') d = d.filter(k => k.pilar  === fPilar);
    if (searchBank.trim()) {
      const q = searchBank.toLowerCase();
      d = d.filter(k => k.kebijakan?.toLowerCase().includes(q) || k.pilar?.toLowerCase().includes(q) || k.isu_strategis?.toLowerCase().includes(q));
    }
    return d;
  }, [bankData, fStatus, fPilar, searchBank]);

  const dataTerfilter = useMemo(() => {
    const features = hasilAnalisis?.matched_features?.features || [];
    let f = features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    if (searchProv.trim()) f = f.filter(x => x.properties?.ikp_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih, searchProv, getKategori]);

  const popupFitur = modalProv
    ? (hasilAnalisis?.matched_features?.features || []).find(f => f.properties?.ikp_analysis?.nama_provinsi === modalProv)
    : null;
  const popupData = popupFitur?.properties?.ikp_analysis;

  const handleKirimUsulan = async (payload) => {
    setSending(true);
    try {
      await axios.post(`${API_BASE}/ikp-usulan/kirim/`, payload);
      setModalUsul(null);
      setModalProv(null);
      showToast('✅ Usulan berhasil dikirim! Menunggu persetujuan Admin.');
      if (subTab === 'usulan') muatUsulan();
    } catch (e) {
      showToast(`❌ ${e.response?.data?.error || 'Gagal mengirim usulan'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {modalUsul && (
        <ModalUsulanKebijakan
          mode={modalUsul.mode} kebijakanLama={modalUsul.data}
          onClose={() => setModalUsul(null)} onKirim={handleKirimUsulan} sending={sending}/>
      )}
      {modalProv && popupData && (
        <ModalUsulanProvinsi
          provinsiNama={modalProv} popupData={popupData} popupFitur={popupFitur}
          getWarna={getWarna} getKategori={getKategori} indikatorTerpilih={indikatorTerpilih}
          analysisId={analysisId} onClose={() => setModalProv(null)}
          onKirim={handleKirimUsulan} sending={sending}/>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* Sub-tab selector */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit flex-wrap">
        {[
          { id: 'bank',    label: 'Bank Kebijakan', icon: <FileText size={12}/> },
          { id: 'provinsi',label: 'Per Provinsi',   icon: <ClipboardList size={12}/> },
          { id: 'usulan',  label: 'Usulan Saya',    icon: <MessageSquarePlus size={12}/> },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              subTab === t.id ? 'bg-white dark:bg-slate-700 shadow text-green-600 dark:text-green-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Bank Kebijakan ─────────────────────────────────────────────────── */}
      {subTab === 'bank' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <MessageSquarePlus size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              Anda dapat <strong>mengusulkan</strong> penambahan atau perbaikan kebijakan IKP. Semua usulan akan direview Admin sebelum diterapkan.
            </p>
          </div>

          {bankLoading
            ? <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={17} className="animate-spin"/><span className="text-sm">Memuat...</span></div>
            : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" value={searchBank} onChange={e => setSB(e.target.value)} placeholder="Cari kebijakan..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-green-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"/>
                    {searchBank && <button onClick={() => setSB('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}
                  </div>
                  <select value={fStatus} onChange={e => setFS(e.target.value)}
                    className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                    <option value="SEMUA">Semua Status</option>
                    {STATUS_LIST.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                  <select value={fPilar} onChange={e => setFP(e.target.value)}
                    className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                    <option value="SEMUA">Semua Pilar</option>
                    {allPilars.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => setModalUsul({ mode: 'tambah' })}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm ml-auto">
                    <Plus size={12}/> Usul Tambah
                  </button>
                </div>

                <span className="text-sm text-slate-500 dark:text-slate-400">{filteredBank.length} kebijakan</span>

                {filteredBank.length === 0
                  ? <div className="py-10 text-center text-slate-400 text-sm">Tidak ada kebijakan</div>
                  : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                          <tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            <th className="px-3 py-3 text-left w-28">Status · P</th>
                            <th className="px-3 py-3 text-left w-36">Pilar</th>
                            <th className="px-4 py-3 text-left">Kebijakan</th>
                            <th className="px-3 py-3 text-center w-24">Indikator</th>
                            <th className="px-3 py-3 text-center w-20">Usul</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {filteredBank.map((item, i) => {
                            const sc    = STATUS_COLORS[item.status];
                            const pc    = getPilarColor(item.pilar);
                            const isDark = ['#6e1f1f', '#e85961', '#3b703b'].includes(sc?.bg);
                            const isExp  = expandedRow === item.id;
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
                                  <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => setModalUsul({ mode: 'edit', data: {
                                      id: item.id, status: item.status, prioritas: item.prioritas,
                                      pilar: item.pilar, pilar_kebijakan: item.pilar,
                                      isu_strategis: item.isu_strategis || '',
                                      kebijakan: item.kebijakan, rekomendasi: item.rekomendasi,
                                      indikator_terkait: item.indikator_terkait,
                                    }})}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 text-amber-600 dark:text-amber-300 rounded-lg text-xs font-semibold mx-auto">
                                      <Pencil size={10}/> Usul Edit
                                    </button>
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
                  )}
              </>
            )}
        </div>
      )}

      {/* ── Per Provinsi ────────────────────────────────────────────────────── */}
      {subTab === 'provinsi' && (
        <div className="space-y-4">
          {!hasilAnalisis
            ? <div className="py-16 text-center"><ClipboardList size={34} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-500">Belum ada data analisis.</p></div>
            : (
              <>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                  <MessageSquarePlus size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Klik <strong>Usul Edit</strong> untuk mengajukan perubahan rekomendasi per provinsi. Perubahan berlaku setelah disetujui Admin.
                  </p>
                </div>
                {!analysisId && (
                  <div className="flex items-start gap-2.5 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-200 dark:border-sky-700">
                    <AlertCircle size={13} className="text-sky-500 flex-shrink-0 mt-0.5"/>
                    <p className="text-sm text-sky-700 dark:text-sky-300">Analisis belum tersimpan — usulan provinsi memerlukan analysis_id yang valid.</p>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[160px]">
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
                        <th className="px-3 py-3 text-center w-24">Aksi</th>
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
                          <tr key={d.nama_provinsi} className={cn('hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',
                            idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/40 dark:bg-slate-800/60')}>
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
                                <button onClick={() => setModalProv(d.nama_provinsi)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 text-amber-600 dark:text-amber-300 rounded-lg text-xs font-semibold mx-auto">
                                  <Pencil size={10}/> Usul Edit
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
            )}
        </div>
      )}

      {/* ── Riwayat Usulan ──────────────────────────────────────────────────── */}
      {subTab === 'usulan' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Riwayat Usulan Saya (IKP)</h3>
            <button onClick={muatUsulan} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg" title="Refresh">
              <RefreshCw size={12} className="text-slate-600 dark:text-slate-300"/>
            </button>
          </div>
          {usulLoading
            ? <div className="flex items-center justify-center py-10 gap-2 text-slate-400"><Loader2 size={17} className="animate-spin"/><span className="text-sm">Memuat...</span></div>
            : daftarUsul.length === 0
            ? <div className="py-12 text-center">
                <MessageSquarePlus size={30} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Belum ada usulan yang dikirim.</p>
                <p className="text-xs text-slate-400 mt-1">Gunakan tab <strong>Bank Kebijakan</strong> untuk mengusulkan perubahan.</p>
              </div>
            : (
              <div className="space-y-2.5">
                {daftarUsul.map(u => {
                  const tipeLabel = { TAMBAH: 'Usul Tambah', EDIT: 'Usul Edit', PROVINSI: 'Usul Rekomendasi Provinsi' }[u.tipe] || u.tipe;
                  return (
                    <div key={u.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">{tipeLabel}</span>
                            <UsulanStatusBadge status={u.status}/>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                            {u.tipe === 'PROVINSI' ? `Rekomendasi: ${u.nama_provinsi}` : (u.kebijakan || '—')}
                          </p>
                          {u.isu_strategis && <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">{u.isu_strategis}</p>}
                          {u.catatan_admin && u.status === 'REJECTED' && (
                            <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                              <p className="text-xs text-red-700 dark:text-red-300"><strong>Alasan penolakan:</strong> {u.catatan_admin}</p>
                            </div>
                          )}
                          {u.catatan_admin && u.status === 'APPROVED' && (
                            <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                              <p className="text-xs text-emerald-700 dark:text-emerald-300"><strong>Catatan Admin:</strong> {u.catatan_admin}</p>
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] text-slate-400">{new Date(u.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          {u.diproses_pada && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {u.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}: {new Date(u.diproses_pada).toLocaleDateString('id-ID')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ─── TAB INFO (read-only) ─────────────────────────────────────────────────────
function TabInfo({ hasilAnalisis, jumlahKategori, indikatorTerpilih, kategoriTerpilih,
  setKategoriTerpilih, eksporData, getWarna, getKategori }) {
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
      <p className="text-base text-slate-500 dark:text-slate-400">Belum ada data analisis tersimpan.</p>
    </div>
  );

  const adaPrediksi = hasilAnalisis.ada_prediksi;
  const showKets = indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KETERSEDIAAN';
  const showKetj = indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KETERJANGKAUAN';
  const showPmnf = indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'PEMANFAATAN';

  return (
    <div className="space-y-5">
      {adaPrediksi && (
        <div className="p-3.5 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            ⚠️ Mengandung data prediksi Regresi Linear OLS (bukan data resmi Bapanas). Gunakan dengan hati-hati.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Teranalisis',   val: hasilAnalisis.total_success || 0,     cls: 'bg-green-50 dark:bg-green-900/30 border-green-200',  valCls: 'text-green-700 dark:text-green-300' },
          { label: 'Sangat Rentan', val: jumlahKategori['SANGAT_RENTAN'] ?? 0, cls: 'bg-red-50 dark:bg-red-900/30 border-red-200',        valCls: 'text-red-800 dark:text-red-300' },
          { label: 'Rentan',        val: jumlahKategori['RENTAN'] ?? 0,        cls: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200',     valCls: 'text-rose-700 dark:text-rose-300' },
          { label: 'Agak Rentan',   val: jumlahKategori['AGAK_RENTAN'] ?? 0,   cls: 'bg-pink-50 dark:bg-pink-900/30 border-pink-200',     valCls: 'text-pink-700 dark:text-pink-300' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Agak Tahan',  val: jumlahKategori['AGAK_TAHAN'] ?? 0,  cls: 'bg-lime-50 dark:bg-lime-900/30 border-lime-200',         valCls: 'text-lime-700 dark:text-lime-300' },
          { label: 'Tahan',       val: jumlahKategori['TAHAN'] ?? 0,        cls: 'bg-green-50 dark:bg-green-900/30 border-green-200',      valCls: 'text-green-700 dark:text-green-300' },
          { label: 'Sangat Tahan',val: jumlahKategori['SANGAT_TAHAN'] ?? 0, cls: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200', valCls: 'text-emerald-700 dark:text-emerald-300' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabel */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{dataTerfilter.length} provinsi · Tahun {hasilAnalisis.tahun}</p>
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
                const d    = fitur.properties.ikp_analysis;
                const w    = getWarna(fitur, indikatorTerpilih);
                const kat  = getKategori(fitur, indikatorTerpilih);
                const isTA = kat === 'TIDAK_TERANALISIS';
                const kp   = d.kolom_prediksi || [];
                const isPredOrMixed = d.sumber === 'prediksi' || d.sumber === 'campuran';
                const cellPred = k => kp.includes(k);
                return (
                  <tr key={d.nama_provinsi} className={cn('hover:bg-green-50/40 dark:hover:bg-green-900/10 transition-colors',
                    idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/60')}>
                    <td className="px-3 py-3 text-center text-xs font-medium text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w }}/>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                        {d.rekomendasi_edited && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 border border-violet-200">✎ Edit</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA ? <span className="text-xs text-slate-400 italic">—</span>
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
                    <td className="px-4 py-3 text-center"><StatusBadge status={kat} size="xs"/></td>
                    <td className="px-4 py-3 text-center">
                      {isTA ? <span className="text-xs text-slate-400 italic">—</span>
                      : (isPredOrMixed) ? <ProyeksiBadge size="xs" kolomProyeksi={kp}/>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 border border-emerald-200"><CheckCircle2 size={9}/> Aktual</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {adaPrediksi && (
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={10}/> * = data prediksi Regresi Linear OLS (bukan data resmi Bapanas)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB METODOLOGI (sama dengan admin, disederhanakan) ───────────────────────
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

function TabMetodologi() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-1">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
          <Wheat size={16} className="text-green-600 dark:text-green-400"/>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metodologi IKP — Badan Pangan Nasional (Bapanas)</h2>
          <p className="text-sm text-slate-400 mt-0.5">Indeks Komposit · 3 Aspek · FSVA</p>
        </div>
      </div>

      <MetSection accentColor="#16a34a" title="Formula Utama IKP" sub="Rata-rata tertimbang tiga aspek ketahanan pangan" defaultOpen>
        <div className="font-mono text-sm text-slate-800 dark:text-slate-100 px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
          <span className="font-bold text-green-700 dark:text-green-300">IKP</span> = (Ketersediaan × 0,335) + (Keterjangkauan × 0,330) + (Pemanfaatan × 0,335)
        </div>
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

      <MetSection accentColor="#16a34a" title="Klasifikasi Status IKP" sub="6 prioritas berdasarkan ambang batas Bapanas" defaultOpen>
        <div className="space-y-2">
          {[
            { label: 'SANGAT RENTAN', range: '< 45,59',       warna: '#6e1f1f', tc: '#fff', prio: 1 },
            { label: 'RENTAN',        range: '45,60 – 53,42', warna: '#e85961', tc: '#fff', prio: 2 },
            { label: 'AGAK RENTAN',   range: '53,43 – 61,47', warna: '#f4a1a7', tc: '#7f1d1d', prio: 3 },
            { label: 'AGAK TAHAN',    range: '61,48 – 69,52', warna: '#c9e077', tc: '#1a2e00', prio: 4 },
            { label: 'TAHAN',         range: '69,53 – 77,35', warna: '#94c945', tc: '#1a2e00', prio: 5 },
            { label: 'SANGAT TAHAN',  range: '> 77,35',       warna: '#3b703b', tc: '#fff', prio: 6 },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: s.warna + '15', border: `1px solid ${s.warna}40` }}>
              <span className="text-xs font-black w-5 text-center" style={{ color: s.warna }}>P{s.prio}</span>
              <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: s.warna }}/>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{s.label}</span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{s.range}</span>
            </div>
          ))}
        </div>
      </MetSection>

      <MetSection accentColor="#f59e0b" title="Catatan Prediksi — Regresi Linear OLS">
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            Ketika data aktual tidak tersedia, sistem menggunakan prediksi Regresi Linear OLS berdasarkan tren historis 2010–2024. <strong>Bukan data resmi Bapanas.</strong>
          </p>
        </div>
      </MetSection>
    </div>
  );
}

// ─── TAB TREN (read-only) ─────────────────────────────────────────────────────
function TabTren({ daftarTersimpan }) {
  const bars6 = [
    { key: 'SANGAT_RENTAN', color: '#6e1f1f', name: 'Sangat Rentan' },
    { key: 'RENTAN',        color: '#e85961', name: 'Rentan' },
    { key: 'AGAK_RENTAN',   color: '#f4a1a7', name: 'Agak Rentan' },
    { key: 'AGAK_TAHAN',    color: '#c9e077', name: 'Agak Tahan' },
    { key: 'TAHAN',         color: '#94c945', name: 'Tahan' },
    { key: 'SANGAT_TAHAN',  color: '#3b703b', name: 'Sangat Tahan' },
  ];

  const trendData = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(item => {
      const key = `${item.tahun}`;
      if (!map[key] || item.timestamp > map[key].timestamp) map[key] = item;
    });
    return Object.values(map).sort((a, b) => a.tahun - b.tahun).map(item => ({
      tahun: item.tahun,
      SANGAT_RENTAN: item.kategori_distribusi?.SANGAT_RENTAN ?? 0,
      RENTAN:        item.kategori_distribusi?.RENTAN ?? 0,
      AGAK_RENTAN:   item.kategori_distribusi?.AGAK_RENTAN ?? 0,
      AGAK_TAHAN:    item.kategori_distribusi?.AGAK_TAHAN ?? 0,
      TAHAN:         item.kategori_distribusi?.TAHAN ?? 0,
      SANGAT_TAHAN:  item.kategori_distribusi?.SANGAT_TAHAN ?? 0,
    }));
  }, [daftarTersimpan]);

  if (!daftarTersimpan.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <TrendingUp size={26} className="text-green-300 mx-auto mb-3"/>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Belum ada data tersimpan</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-green-500" size={20}/>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Tren IKP</h3>
          <p className="text-sm text-slate-500 mt-0.5">{trendData.length} titik data tersimpan</p>
        </div>
      </div>

      {trendData.length === 0
        ? <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data</div>
        : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
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
          </div>
        )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function TabsPangan_User({
  activeTab, setActiveTab, hasilAnalisis, jumlahKategori,
  indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
  tahunTerpilih, daftarTersimpan, eksporData,
  getWarna, getKategori, analysisId,
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold transition-all relative flex-1 whitespace-nowrap',
                active ? 'text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-900/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30')}>
              <Icon size={14}/><span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-t-full"/>}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {activeTab === 'info'      && <TabInfo hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} eksporData={eksporData} getWarna={getWarna} getKategori={getKategori}/>}
        {activeTab === 'kebijakan' && <TabKebijakanUser hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} getWarna={getWarna} getKategori={getKategori} analysisId={analysisId}/>}
        {activeTab === 'metadata'  && <TabMetodologi/>}
        {activeTab === 'tren'      && <TabTren daftarTersimpan={daftarTersimpan}/>}
      </div>
    </div>
  );
}