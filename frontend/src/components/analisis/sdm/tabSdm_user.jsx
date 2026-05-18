"use client";
// ─── TABS SDM — USER ──────────────────────────────────────────────────────────
// Tab Info      : tabel hasil read-only + unduh
// Tab Kebijakan : lihat bank + kirim USULAN (tambah/edit/per-provinsi)
//                 tidak bisa langsung ubah — harus disetujui Admin
// Tab Metodologi: sama persis dengan versi admin/publik
// Tab Tren      : baca-saja
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Download, ChevronDown, Info, FileText, Calendar,
  BarChart2, TrendingUp, ClipboardList, BookOpen,
  AlertCircle, X, ExternalLink, Brain, Loader2,
  Plus, Pencil, Eye, ChevronUp, Layers, CheckCircle2,
  Search, AlertTriangle, Send, Clock, CheckCheck, XCircle,
  MessageSquarePlus, RefreshCw, ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  INDIKATOR_LABELS_SDM, INDIKATOR_COLORS_SDM, INDIKATOR_ICON_SDM,
  TAHUN_TERSEDIA_SDM, DATASET_LABELS_SDM,
} from './petaSdm';

const cn = (...cls) => cls.filter(Boolean).join(' ');
const API_BASE = 'http://127.0.0.1:8000/api';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TABS = [
  { id:'info',      label:'Info',       Icon:Info },
  { id:'kebijakan', label:'Kebijakan',  Icon:ClipboardList },
  { id:'metadata',  label:'Metodologi', Icon:BookOpen },
  { id:'tren',      label:'Tren',       Icon:TrendingUp },
];

const STATUS_LIST = ['SANGAT_TINGGI','TINGGI','SEDANG','RENDAH'];
const STATUS_COLORS = {
  SANGAT_TINGGI:    { bg:'#008cd6', badge:'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  TINGGI:           { bg:'#abcd05', badge:'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300' },
  SEDANG:           { bg:'#fff67f', badge:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  RENDAH:           { bg:'#af4284', badge:'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
  TIDAK_TERANALISIS:{ bg:'#a6a6a6', badge:'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};
const PILAR_LIST = [
  'Transformasi','Sistem Informasi','Kebijakan & Regulasi','Intervensi Sektoral',
  'Produktivitas','Stabilitas','Perencanaan & Data','Kapasitas SDM','Infrastruktur','Pemberdayaan Masyarakat',
];
const PILAR_COLORS = {
  'Transformasi':'#6366f1','Sistem Informasi':'#3b82f6','Kebijakan & Regulasi':'#10b981',
  'Intervensi Sektoral':'#f59e0b','Produktivitas':'#ef4444','Stabilitas':'#8b5cf6',
  'Perencanaan & Data':'#06b6d4','Kapasitas SDM':'#ec4899','Infrastruktur':'#14b8a6',
  'Pemberdayaan Masyarakat':'#f97316',
};
const getPilarColor = p => PILAR_COLORS[p] || '#6366f1';
const INDIKATOR_TERKAIT_LIST = ['IK','IP','IPeng','ALL'];

const EMPTY_USULAN = {
  status_kebijakan:'SEDANG', prioritas:3, pilar_kebijakan:'Transformasi',
  isu_strategis:'', kebijakan:'', rekomendasi_program:'', indikator_terkait:'IK',
  catatan_user:'',
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function StatusBadge({ status, size='sm' }) {
  const sc = STATUS_COLORS[status];
  if (!sc) return null;
  const label = { SANGAT_TINGGI:'SANGAT TINGGI',TINGGI:'TINGGI',SEDANG:'SEDANG',RENDAH:'RENDAH',TIDAK_TERANALISIS:'TIDAK TERANALISIS' }[status]||status;
  return (
    <span className={cn('inline-flex items-center font-bold rounded-full', size==='xs'?'text-[9px] px-1.5 py-0.5':'text-xs px-2 py-0.5', sc.badge)}>
      {label}
    </span>
  );
}

function UsulanStatusBadge({ status }) {
  const map = {
    PENDING:  { cls:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700',  icon:<Clock size={9}/>,     label:'Menunggu Persetujuan' },
    APPROVED: { cls:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700', icon:<CheckCheck size={9}/>, label:'Disetujui' },
    REJECTED: { cls:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700', icon:<XCircle size={9}/>,    label:'Ditolak' },
  };
  const m = map[status] || map.PENDING;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', m.cls)}>
      {m.icon} {m.label}
    </span>
  );
}

function ProyeksiBadge({ size='sm' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold rounded-full border bg-amber-50 dark:bg-amber-900/30', size==='xs'?'text-[9px] px-1.5 py-0.5':'text-[10px] px-2 py-0.5')}
      style={{ borderColor:'#fcd34d', color:'#92400e' }}>
      <AlertTriangle size={size==='xs'?7:9}/> Proyeksi OLS
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl px-4 py-3 text-sm">
      <div className="font-bold text-slate-900 dark:text-white mb-2">Tahun {label}</div>
      {payload.map((e,i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor:e.color }}/>
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── MODAL KIRIM USULAN ───────────────────────────────────────────────────────
function ModalUsulanKebijakan({ mode, kebijakanLama, onClose, onKirim, sending }) {
  // mode: 'tambah' | 'edit'
  const [form, setForm] = useState(
    mode === 'edit' && kebijakanLama
      ? {
          status_kebijakan: kebijakanLama.status,
          prioritas:        kebijakanLama.prioritas,
          pilar_kebijakan:  kebijakanLama.pilar,
          isu_strategis:    kebijakanLama.isu_strategis || '',
          kebijakan:        kebijakanLama.kebijakan || '',
          rekomendasi_program: kebijakanLama.rekomendasi || '',
          indikator_terkait: kebijakanLama.indikator || 'IK',
          catatan_user:     '',
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
      tipe: mode === 'edit' ? 'EDIT' : 'TAMBAH',
      kebijakan_id: mode === 'edit' ? kebijakanLama?.id : undefined,
      ...form,
    });
  };

  const Field = ({ label, name, type='text', options, required }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {type === 'select'
        ? <select value={form[name]} onChange={e => setForm(p=>({...p,[name]:e.target.value}))}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500">
            {options.map(o => <option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
          </select>
        : type === 'textarea'
        ? <textarea rows={3} value={form[name]} onChange={e => setForm(p=>({...p,[name]:e.target.value}))}
            className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 resize-none',
              errors[name]?'border-red-400':'border-slate-200 dark:border-slate-500')}/>
        : <input type="text" value={form[name]} onChange={e => setForm(p=>({...p,[name]:e.target.value}))}
            className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500',
              errors[name]?'border-red-400':'border-slate-200 dark:border-slate-500')}/>
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
              {mode === 'edit' ? 'Usul Perbaikan Kebijakan' : 'Usul Kebijakan Baru'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Usulan akan direview Admin sebelum diterapkan</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>

        {/* Perbandingan data lama jika EDIT */}
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
                options={STATUS_LIST.map(s=>({value:s,label:s.replace('_',' ')}))}/>
              <Field label="Prioritas" name="prioritas" type="select"
                options={[1,2,3,4,5,6,7].map(p=>({value:p,label:`P${p}`}))}/>
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
            <textarea rows={2} value={form.catatan_user} onChange={e => setForm(p=>({...p,catatan_user:e.target.value}))}
              placeholder="Jelaskan alasan atau konteks usulan Anda..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-amber-400 resize-none placeholder:text-slate-400"/>
          </div>
        </div>

        {/* Footer info */}
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

  const warna = popupFitur ? getWarna(popupFitur, indikatorTerpilih) : '#6366f1';
  const kat   = popupFitur ? getKategori(popupFitur, indikatorTerpilih) : '-';
  const toggleAksiDisabled = (pi, ai) => {
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
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0" style={{ borderLeft:`4px solid ${warna}` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{provinsiNama}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                  ✏️ Usul Perubahan
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={kat}/>
                <span className="text-sm font-mono font-black" style={{ color:warna }}>ISDM {popupData?.indeks_sdm ?? '—'}</span>
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
              Perubahan rekomendasi ini akan dikirim sebagai <strong>usulan</strong> dan baru diterapkan setelah disetujui Admin.
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
            const pc    = getPilarColor(kelompok.pilar);
            const isOpen = expanded[ki] !== false;
            const aktif  = kelompok.aksi?.filter(a=>!a.disabled).length || 0;
            return (
              <div key={ki} className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button onClick={() => setExpanded(p=>({...p,[ki]:!p[ki]}))}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left"
                  style={{ backgroundColor:pc+'15', borderBottom:isOpen?`1px solid ${pc}30`:'none' }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor:pc }}/>
                  <span className="text-sm font-bold flex-1" style={{ color:pc }}>{kelompok.pilar}</span>
                  <span className="text-xs text-slate-400">{aktif} aktif</span>
                  {isOpen ? <ChevronUp size={12} className="text-slate-400"/> : <ChevronDown size={12} className="text-slate-400"/>}
                </button>
                {isOpen && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {kelompok.aksi?.map((aksi, ai) => (
                      <div key={ai} className={cn('px-4 py-3 flex items-start gap-3',
                        aksi.disabled?'opacity-40 bg-slate-50 dark:bg-slate-800/60':'bg-white dark:bg-slate-800/20')}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-black"
                          style={{ backgroundColor:aksi.disabled?'#94a3b8':pc }}>{aksi.no_aksi||ai+1}</span>
                        <div className="flex-1 min-w-0">
                          {aksi.disabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 mr-1">NONAKTIF</span>}
                          <p className={cn('text-sm font-semibold leading-snug', aksi.disabled?'text-slate-400 line-through':'text-slate-800 dark:text-slate-100')}>
                            {aksi.nama_aksi}
                          </p>
                          {aksi.detail_aksi && <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{aksi.detail_aksi}</p>}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => toggleAksiDisabled(ki, ai)}
                            className={cn('p-1.5 rounded-lg', aksi.disabled?'hover:bg-emerald-50 text-emerald-500':'hover:bg-amber-50 text-amber-500')}>
                            {aksi.disabled ? <Eye size={11}/> : <Eye size={11} className="opacity-40"/>}
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

// ─── TAB KEBIJAKAN USER ───────────────────────────────────────────────────────
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
  const [modalUsul,   setModalUsul]   = useState(null);   // {mode:'tambah'} | {mode:'edit', data}
  const [modalProv,   setModalProv]   = useState(null);   // nama provinsi
  const [sending,     setSending]     = useState(false);
  const [daftarUsul,  setDaftarUsul]  = useState([]);
  const [usulLoading, setUsulLoading] = useState(false);
  const [toastMsg,    setToastMsg]    = useState('');

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  // Muat bank kebijakan
  useEffect(() => {
    setBankLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-sdm/`)
      .then(r => setBankData(r.data.results || []))
      .catch(() => {})
      .finally(() => setBankLoading(false));
  }, []);

  // Muat riwayat usulan user
  const muatUsulan = useCallback(() => {
    setUsulLoading(true);
    axios.get(`${API_BASE}/sdm-usulan/saya/`)
      .then(r => setDaftarUsul(r.data.results || []))
      .catch(() => {})
      .finally(() => setUsulLoading(false));
  }, []);
  useEffect(() => { if (subTab === 'usulan') muatUsulan(); }, [subTab, muatUsulan]);

  const allPilars = useMemo(() => [...new Set(bankData.map(k=>k.pilar).filter(Boolean))].sort(), [bankData]);
  const filteredBank = useMemo(() => {
    let d = bankData;
    if (fStatus !== 'SEMUA') d = d.filter(k => k.status === fStatus);
    if (fPilar  !== 'SEMUA') d = d.filter(k => k.pilar  === fPilar);
    if (searchBank.trim()) { const q = searchBank.toLowerCase(); d = d.filter(k => k.kebijakan?.toLowerCase().includes(q)||k.pilar?.toLowerCase().includes(q)||k.isu_strategis?.toLowerCase().includes(q)); }
    return d;
  }, [bankData, fStatus, fPilar, searchBank]);

  const dataTerfilter = useMemo(() => {
    const features = hasilAnalisis?.matched_features?.features || [];
    let f = features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    if (searchProv.trim()) f = f.filter(x => x.properties?.sdm_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih, searchProv, getKategori]);

  const popupFitur = modalProv
    ? (hasilAnalisis?.matched_features?.features || []).find(f => f.properties?.sdm_analysis?.nama_provinsi === modalProv)
    : null;
  const popupData = popupFitur?.properties?.sdm_analysis;

  // Kirim usulan ke backend
  const handleKirimUsulan = async (payload) => {
    setSending(true);
    try {
      await axios.post(`${API_BASE}/sdm-usulan/kirim/`, payload);
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
      {/* Modals */}
      {modalUsul && (
        <ModalUsulanKebijakan
          mode={modalUsul.mode}
          kebijakanLama={modalUsul.data}
          onClose={() => setModalUsul(null)}
          onKirim={handleKirimUsulan}
          sending={sending}
        />
      )}
      {modalProv && popupData && (
        <ModalUsulanProvinsi
          provinsiNama={modalProv}
          popupData={popupData}
          popupFitur={popupFitur}
          getWarna={getWarna}
          getKategori={getKategori}
          indikatorTerpilih={indikatorTerpilih}
          analysisId={analysisId}
          onClose={() => setModalProv(null)}
          onKirim={handleKirimUsulan}
          sending={sending}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* Sub-tab selector */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit flex-wrap">
        {[
          { id:'bank',    label:'Bank Kebijakan', icon:<FileText size={12}/> },
          { id:'provinsi',label:'Per Provinsi',   icon:<ClipboardList size={12}/> },
          { id:'usulan',  label:'Usulan Saya',    icon:<MessageSquarePlus size={12}/> },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              subTab===t.id ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Sub-tab: Bank Kebijakan (read + usul edit/tambah) ─────────────── */}
      {subTab === 'bank' && (
        <div className="space-y-4">
          {/* Banner info */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <MessageSquarePlus size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              Anda dapat <strong>mengusulkan</strong> penambahan atau perbaikan kebijakan. Semua usulan akan direview Admin sebelum diterapkan ke bank kebijakan.
            </p>
          </div>

          {bankLoading
            ? <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={17} className="animate-spin"/><span className="text-sm">Memuat...</span></div>
            : (
              <>
                {/* Filter + tombol usul tambah */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" value={searchBank} onChange={e=>setSB(e.target.value)} placeholder="Cari kebijakan..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"/>
                    {searchBank && <button onClick={()=>setSB('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}
                  </div>
                  <select value={fStatus} onChange={e=>setFS(e.target.value)}
                    className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                    <option value="SEMUA">Semua Status</option>
                    {STATUS_LIST.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                  </select>
                  <select value={fPilar} onChange={e=>setFP(e.target.value)}
                    className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                    <option value="SEMUA">Semua Pilar</option>
                    {allPilars.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => setModalUsul({ mode:'tambah' })}
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
                            <th className="px-3 py-3 text-left w-28">Pilar</th>
                            <th className="px-4 py-3 text-left">Kebijakan</th>
                            <th className="px-3 py-3 text-center w-16">Ind.</th>
                            <th className="px-3 py-3 text-center w-20">Usul</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {filteredBank.map((item, i) => {
                            const sc  = STATUS_COLORS[item.status];
                            const pc  = getPilarColor(item.pilar);
                            const isExp = expandedRow === item.id;
                            return (
                              <React.Fragment key={item.id}>
                                <tr className={cn('cursor-pointer transition-colors',
                                  i%2===0?'bg-white dark:bg-slate-800':'bg-slate-50/40 dark:bg-slate-800/60',
                                  isExp&&'bg-indigo-50/50 dark:bg-indigo-900/10','hover:bg-slate-50 dark:hover:bg-slate-700/40')}
                                  onClick={() => setExp(isExp?null:item.id)}>
                                  <td className="px-3 py-2.5">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs font-black px-2 py-0.5 rounded text-white w-fit"
                                        style={{ backgroundColor:sc?.bg||'#94a3b8', color:(sc?.bg==='#fff67f'||sc?.bg==='#abcd05')?'#1a2e00':'#fff' }}>
                                        {(item.status||'').replace('_',' ')}
                                      </span>
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">P{item.prioritas}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5"><span className="text-xs font-semibold" style={{ color:pc }}>{item.pilar}</span></td>
                                  <td className="px-4 py-2.5">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{item.kebijakan}</p>
                                    {item.isu_strategis && <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">{item.isu_strategis}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded border" style={{ borderColor:pc+'40', color:pc, backgroundColor:pc+'10' }}>{item.indikator}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
                                    <button onClick={() => setModalUsul({ mode:'edit', data:{
                                      id:item.id, status:item.status, prioritas:item.prioritas,
                                      pilar:item.pilar, isu_strategis:item.isu_strategis||'',
                                      kebijakan:item.kebijakan, rekomendasi:item.rekomendasi, indikator:item.indikator,
                                    }})}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 text-amber-600 dark:text-amber-300 rounded-lg text-xs font-semibold mx-auto">
                                      <Pencil size={10}/> Usul Edit
                                    </button>
                                  </td>
                                </tr>
                                {isExp && (
                                  <tr className="bg-indigo-50/30 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800/30">
                                    <td colSpan={5} className="px-4 py-3">
                                      <div className="flex items-start gap-2.5">
                                        <ChevronRight size={13} className="text-indigo-400 flex-shrink-0 mt-0.5"/>
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
              </>
            )}
        </div>
      )}

      {/* ── Sub-tab: Per Provinsi ────────────────────────────────────────── */}
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
                    <input type="text" value={searchProv} onChange={e=>setSP(e.target.value)} placeholder="Cari provinsi..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100"/>
                    {searchProv && <button onClick={()=>setSP('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}
                  </div>
                  <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
                    className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                    <option value="SEMUA">SEMUA</option>
                    {[...STATUS_LIST,'TIDAK_TERANALISIS'].map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                      <tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Provinsi</th>
                        <th className="px-3 py-3 text-center">ISDM</th>
                        <th className="px-3 py-3 text-center">Kategori</th>
                        <th className="px-3 py-3 text-center">Sumber</th>
                        <th className="px-3 py-3 text-center w-24">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {dataTerfilter.map((fitur, idx) => {
                        const d   = fitur.properties.sdm_analysis;
                        const w   = getWarna(fitur, indikatorTerpilih);
                        const kat = getKategori(fitur, indikatorTerpilih);
                        const isTA = kat === 'TIDAK_TERANALISIS';
                        const isDark = ['#fff67f','#abcd05'].includes(w);
                        const kp = d.kolom_prediksi || [];
                        const isPredOrMixed = d.sumber==='prediksi'||d.sumber==='campuran';
                        return (
                          <tr key={d.nama_provinsi} className={cn('hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',
                            idx%2===0?'bg-white dark:bg-slate-800':'bg-slate-50/40 dark:bg-slate-800/60')}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor:w, border:isDark?'1px solid rgba(0,0,0,0.2)':'' }}/>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                                {d.rekomendasi_edited && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">✎ Edit</span>}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-bold font-mono text-slate-800 dark:text-slate-100">{d.indeks_sdm??'—'}</td>
                            <td className="px-3 py-3 text-center"><StatusBadge status={kat}/></td>
                            <td className="px-3 py-3 text-center">
                              {isTA ? <span className="text-xs text-slate-400 italic">—</span>
                              : isPredOrMixed ? <ProyeksiBadge size="xs"/>
                              : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"><CheckCircle2 size={9}/> Aktual</span>
                              }
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

      {/* ── Sub-tab: Riwayat Usulan Saya ─────────────────────────────────── */}
      {subTab === 'usulan' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Riwayat Usulan Saya</h3>
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
                  const tipeLabel = { TAMBAH:'Usul Tambah', EDIT:'Usul Edit', PROVINSI:'Usul Rekomendasi Provinsi' }[u.tipe] || u.tipe;
                  return (
                    <div key={u.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{tipeLabel}</span>
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
                          <p className="text-[10px] text-slate-400">{new Date(u.dibuat_pada).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</p>
                          {u.diproses_pada && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {u.status==='APPROVED'?'Disetujui':'Ditolak'}: {new Date(u.diproses_pada).toLocaleDateString('id-ID')}
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

// ─── TAB INFO (read-only, sama seperti admin tapi tanpa delete) ───────────────
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
      <BarChart2 size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-base text-slate-500 dark:text-slate-400">Belum ada data analisis tersimpan.</p>
    </div>
  );

  const adaProyeksi = hasilAnalisis.ada_prediksi;
  const showUHH  = indikatorTerpilih==='ALL'||indikatorTerpilih==='KESEHATAN';
  const showRLS  = indikatorTerpilih==='ALL'||indikatorTerpilih==='PENDIDIKAN';
  const showHLS  = indikatorTerpilih==='ALL'||indikatorTerpilih==='PENDIDIKAN';
  const showPeng = indikatorTerpilih==='ALL'||indikatorTerpilih==='PENGELUARAN';

  return (
    <div className="space-y-5">
      {adaProyeksi && (
        <div className="p-3.5 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            ⚠️ Mengandung data proyeksi Regresi Linear OLS (bukan data resmi BPS). Gunakan dengan hati-hati.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label:'Teranalisis',    val:hasilAnalisis.total_success||0,          cls:'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200', valCls:'text-indigo-700 dark:text-indigo-300' },
          { label:'SANGAT TINGGI', val:jumlahKategori['SANGAT_TINGGI']??0,       cls:'bg-sky-50 dark:bg-sky-900/30 border-sky-200',         valCls:'text-sky-700 dark:text-sky-300' },
          { label:'TINGGI',        val:jumlahKategori['TINGGI']??0,              cls:'bg-lime-50 dark:bg-lime-900/30 border-lime-200',       valCls:'text-lime-700 dark:text-lime-300' },
          { label:'SEDANG',        val:jumlahKategori['SEDANG']??0,              cls:'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200', valCls:'text-yellow-700 dark:text-yellow-300' },
          { label:'RENDAH',        val:jumlahKategori['RENDAH']??0,              cls:'bg-fuchsia-50 dark:bg-fuchsia-900/30 border-fuchsia-200', valCls:'text-fuchsia-700 dark:text-fuchsia-300' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{dataTerfilter.length} provinsi · Tahun {hasilAnalisis.tahun}</p>
          <div className="flex items-center gap-2">
            <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
              className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
              <option value="SEMUA">SEMUA</option>
              {[...STATUS_LIST,'TIDAK_TERANALISIS'].map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}
            </select>
            <div className="relative">
              <button onClick={() => setMenuUnduh(!menuUnduh)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm">
                <Download size={13}/> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-600 py-1">
                  {['EXCEL','CSV','JSON','GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                      <Download size={11} className="text-indigo-500"/> {fmt}
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
                <th className="px-4 py-3 text-center">ISDM</th>
                {showUHH && <th className="px-4 py-3 text-center">AHH</th>}
                {showRLS && <th className="px-4 py-3 text-center">RLS</th>}
                {showHLS && <th className="px-4 py-3 text-center">HLS</th>}
                {showPeng&& <th className="px-4 py-3 text-center">Pengeluaran</th>}
                <th className="px-4 py-3 text-center">Kategori</th>
                <th className="px-4 py-3 text-center">Sumber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {dataTerfilter.map((fitur, idx) => {
                const d   = fitur.properties.sdm_analysis;
                const dc  = d.data_komponen || {};
                const w   = getWarna(fitur, indikatorTerpilih);
                const kat = getKategori(fitur, indikatorTerpilih);
                const isTA = kat === 'TIDAK_TERANALISIS';
                const isDark = ['#fff67f','#abcd05'].includes(w);
                const kp = d.kolom_prediksi || [];
                const isPredOrMixed = d.sumber==='prediksi'||d.sumber==='campuran';
                return (
                  <tr key={d.nama_provinsi} className={cn('hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors',
                    idx%2===0?'bg-white dark:bg-slate-800':'bg-slate-50/60 dark:bg-slate-800/60')}>
                    <td className="px-3 py-3 text-center text-xs font-medium text-slate-400">{idx+1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor:w, border:isDark?'1px solid rgba(0,0,0,0.2)':'' }}/>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA ? <span className="text-xs text-slate-400 italic">—</span>
                      : <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_sdm??'—'}</span>}
                    </td>
                    {showUHH && <td className={cn('px-4 py-3 text-center text-sm', kp.includes('UHH')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>{dc.UHH??'—'}{kp.includes('UHH')&&<span className="ml-0.5 text-[9px]">*</span>}</td>}
                    {showRLS && <td className={cn('px-4 py-3 text-center text-sm', kp.includes('RLS')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>{dc.RLS??'—'}{kp.includes('RLS')&&<span className="ml-0.5 text-[9px]">*</span>}</td>}
                    {showHLS && <td className={cn('px-4 py-3 text-center text-sm', kp.includes('HLS')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>{dc.HLS??'—'}{kp.includes('HLS')&&<span className="ml-0.5 text-[9px]">*</span>}</td>}
                    {showPeng&& <td className={cn('px-4 py-3 text-center text-sm', kp.includes('PENGELUARAN')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>{dc.PENGELUARAN?dc.PENGELUARAN.toLocaleString('id-ID'):'—'}{kp.includes('PENGELUARAN')&&<span className="ml-0.5 text-[9px]">*</span>}</td>}
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold border"
                        style={{ borderColor:isTA?'#cbd5e1':w+'60', color:isTA?'#94a3b8':isDark?'#1a2e00':w, backgroundColor:isTA?'transparent':w+'18' }}>
                        {(d.kategori_label||d.kategori||'—').replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA ? <span className="text-xs text-slate-400 italic">—</span>
                      : isPredOrMixed ? <ProyeksiBadge size="xs"/>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"><CheckCircle2 size={9}/> Aktual</span>}
                    </td>
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

// ─── TAB METODOLOGI ───────────────────────────────────────────────────────────
function MathFrac({ num, den }) {
  return (
    <span className="inline-flex flex-col items-center align-middle mx-0.5">
      <span className="text-[11px] leading-none border-b border-current px-0.5 pb-0.5">{num}</span>
      <span className="text-[11px] leading-none pt-0.5">{den}</span>
    </span>
  );
}
function MathBlock({ children, className='' }) {
  return (
    <div className={cn('font-mono text-sm text-slate-800 dark:text-slate-100 px-4 py-3 bg-slate-50 dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto', className)}>
      {children}
    </div>
  );
}
function MetSection({ accentColor, title, sub, defaultOpen=false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
      <button type="button" onClick={() => setOpen(v=>!v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-left">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor:accentColor }}/>
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
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400"/>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metodologi ISDM — IPM BPS Metode Baru</h2>
          <p className="text-sm text-slate-400 mt-0.5">Rata-rata Geometrik · 3 Dimensi · Mengacu BPS & UNDP</p>
        </div>
      </div>

      <MetSection accentColor="#6366f1" title="Formula per Dimensi" sub="Rumus resmi IPM BPS" defaultOpen>
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Kesehatan — IK</p></div>
            <MathBlock><div className="flex items-center gap-1 flex-wrap"><span className="font-bold text-emerald-600 dark:text-emerald-400">IK</span><span className="mx-1">=</span><MathFrac num="AHH − 20" den="85 − 20"/></div></MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">AHH min = 20 th (biologis), AHH maks = 85 th (target global BPS/UNDP)</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Pendidikan — IP</p></div>
            <MathBlock><div className="flex items-center gap-1 flex-wrap"><span className="font-bold text-blue-600 dark:text-blue-400">IP</span><span className="mx-1">=</span><MathFrac num={<span className="flex items-center gap-1 px-0.5"><MathFrac num="HLS" den="18"/><span>+</span><MathFrac num="RLS" den="15"/></span>} den="2"/></div></MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">HLS maks = 18 th (S2), RLS maks = 15 th (D3)</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Standar Hidup — IPeng</p></div>
            <MathBlock><div className="flex items-center gap-1 flex-wrap"><span className="font-bold text-amber-600 dark:text-amber-400">IPeng</span><span className="mx-1">=</span><MathFrac num={<span className="px-0.5">ln(Peng) − ln(1.007.436)</span>} den={<span className="px-0.5">ln(26.572.352) − ln(1.007.436)</span>}/></div></MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Min = Rp1.007.436 (Tolikara 2010), Maks = Rp26.572.352 (Jakarta Selatan 2025)</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ISDM — Rata-rata Geometrik</p></div>
            <MathBlock className="border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-base">ISDM</span>
                <span className="text-base">=</span>
                <span className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 font-bold self-start mt-0.5">3</span>
                  <span className="text-base">√</span>
                  <span className="border-t-2 border-slate-700 dark:border-slate-300 px-1">IK × IP × IPeng</span>
                </span>
                <span className="text-base mx-1">×</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-base">100</span>
              </div>
            </MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Skor 0–100. Nilai 100 adalah kondisi terbaik.</p>
          </div>
        </div>
      </MetSection>

      <MetSection accentColor="#10b981" title="Klasifikasi Status" sub="Standar BPS — 4 kelas" defaultOpen>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[{l:'SANGAT TINGGI',r:'≥ 80',bg:'#008cd6',tc:'#fff'},{l:'TINGGI',r:'70–80',bg:'#abcd05',tc:'#1a2e00'},{l:'SEDANG',r:'60–70',bg:'#fff67f',tc:'#92400e'},{l:'RENDAH',r:'< 60',bg:'#af4284',tc:'#fff'}].map(s=>(
            <div key={s.l} className="rounded-xl p-3 text-center" style={{backgroundColor:s.bg,color:s.tc}}>
              <div className="text-[10px] font-black uppercase mb-1">{s.l}</div>
              <div className="text-sm font-mono font-bold">{s.r}</div>
            </div>
          ))}
        </div>
      </MetSection>

      <MetSection accentColor="#8b5cf6" title="Justifikasi Metodologi" sub="Mengapa rata-rata geometrik?">
        <div className="space-y-3">
          {[
            {icon:'📐',title:'Non-kompensatif',desc:'Dimensi rendah tidak bisa ditutupi dimensi tinggi. Memaksa pembangunan manusia yang seimbang di semua sektor.'},
            {icon:'📈',title:'Fungsi Logaritma Natural untuk Pengeluaran',desc:'Mengoreksi distribusi menceng (skewed right) dan lebih sensitif terhadap perubahan daya beli masyarakat bawah.'},
            {icon:'🏛️',title:'Standar Resmi DAU & UNDP',desc:'IPM digunakan dalam penghitungan Dana Alokasi Umum (DAU) pemerintah pusat dan selaras dengan Human Development Index UNDP.'},
          ].map((item,i)=>(
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div><p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{item.title}</p><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p></div>
            </div>
          ))}
        </div>
      </MetSection>

      <MetSection accentColor="#14b8a6" title="Sumber Data & Link BPS" sub="Dataset resmi yang digunakan">
        <div className="space-y-2.5">
          {[
            {col:'ahh',nama:'Angka Harapan Hidup (AHH)',satuan:'Tahun',k:'IK',kCls:'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',link:'https://www.bps.go.id/id/statistics-table/2/NDE0IzI=/-metode-baru--umur-harapan-hidup-saat-lahir--uhh-.html'},
            {col:'rls',nama:'Rata-rata Lama Sekolah (RLS)',satuan:'Tahun',k:'IP',kCls:'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',link:'https://www.bps.go.id/id/statistics-table/2/NDE1IzI=/-metode-baru--rata-rata-lama-sekolah--tahun-.html'},
            {col:'hls',nama:'Harapan Lama Sekolah (HLS)',satuan:'Tahun',k:'IP',kCls:'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',link:'https://www.bps.go.id/id/statistics-table/2/NDE3IzI=/-metode-baru--harapan-lama-sekolah--tahun-.html'},
            {col:'pengeluaran',nama:'Pengeluaran per Kapita Disesuaikan',satuan:'Ribu Rp/kap/thn',k:'IPeng',kCls:'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',link:'https://www.bps.go.id/assets/statistics-table/2/NDE2IzI=/-metode-baru--pengeluaran-per-kapita-disesuaikan.html'},
          ].map(d=>(
            <div key={d.col} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono flex-shrink-0">{d.col}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama}</p>
                <p className="text-xs text-slate-400 mt-0.5">{d.satuan}</p>
              </div>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0', d.kCls)}>{d.k}</span>
              <a href={d.link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0 transition-colors" title="Buka di BPS">
                <ExternalLink size={12} className="text-slate-400"/>
              </a>
            </div>
          ))}
          <a href="https://searchengine.web.bps.go.id/filemenu/Booklet-IPM-Metode-Baru.pdf" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
            <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0"/>
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex-1">Booklet IPM Metode Baru — BPS</span>
            <ExternalLink size={12} className="text-indigo-400 flex-shrink-0"/>
          </a>
        </div>
      </MetSection>

      <MetSection accentColor="#f59e0b" title="Catatan Proyeksi — Regresi Linear OLS" sub="Fallback jika data aktual tidak tersedia">
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Apa itu Regresi Linear OLS?</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Metode statistik yang menarik garis lurus paling optimal (best-fit) di antara data historis, lalu memperpanjangnya ke masa depan. Digunakan sebagai estimasi ketika data BPS belum tersedia untuk tahun tertentu.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1.5">Keterbatasan Model</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">Proyeksi ini merupakan estimasi matematis murni berbasis tren historis 2010–2024 dengan asumsi <em>ceteris paribus</em>. Bukan data resmi BPS. Gunakan dengan hati-hati untuk pengambilan keputusan.</p>
              </div>
            </div>
          </div>
        </div>
      </MetSection>
    </div>
  );
}

// ─── TAB TREN (read-only) ─────────────────────────────────────────────────────
function TabTren({ daftarTersimpan }) {
  const [filterInd, setFI] = useState('ALL');
  const trendData = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(item => {
      const ind = item.indikator||'ALL';
      const key = `${item.tahun}|${ind}`;
      if (!map[key] || item.timestamp > map[key].timestamp) map[key] = item;
    });
    const byInd = {};
    Object.values(map).forEach(item => {
      const ind = item.indikator||'ALL';
      if (!byInd[ind]) byInd[ind] = [];
      byInd[ind].push({
        tahun: item.tahun,
        SANGAT_TINGGI: item.kategori_distribusi?.SANGAT_TINGGI??0,
        TINGGI: item.kategori_distribusi?.TINGGI??0,
        SEDANG: item.kategori_distribusi?.SEDANG??0,
        RENDAH: item.kategori_distribusi?.RENDAH??0,
      });
    });
    Object.keys(byInd).forEach(ind => byInd[ind].sort((a,b)=>a.tahun-b.tahun));
    return byInd;
  }, [daftarTersimpan]);

  const chartData = trendData[filterInd] || [];
  const indsAvailable = Object.keys(trendData).filter(k => trendData[k].length > 0);

  if (!daftarTersimpan.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <TrendingUp size={26} className="text-indigo-300 mx-auto mb-3"/>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Belum ada data tersimpan</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-wrap">
        {['ALL','KESEHATAN','PENDIDIKAN','PENGELUARAN'].map(ind => {
          const ada = indsAvailable.includes(ind);
          return (
            <button key={ind} onClick={() => ada && setFI(ind)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1',
                filterInd===ind ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                : ada ? 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed')}>
              <span style={{ color:filterInd===ind ? INDIKATOR_COLORS_SDM[ind] : undefined }}>{INDIKATOR_ICON_SDM[ind]}</span>
              {ind==='ALL' ? 'Semua' : INDIKATOR_LABELS_SDM[ind]?.replace('Indeks ','')}
            </button>
          );
        })}
      </div>

      {chartData.length === 0
        ? <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data</div>
        : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
            <div className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              {INDIKATOR_LABELS_SDM[filterInd]} · {chartData.length} titik data
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5}/>
                <XAxis dataKey="tahun" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="SANGAT_TINGGI" name="Sangat Tinggi" stackId="a" fill="#008cd6"/>
                <Bar dataKey="TINGGI"        name="Tinggi"        stackId="a" fill="#abcd05"/>
                <Bar dataKey="SEDANG"        name="Sedang"        stackId="a" fill="#fff67f"/>
                <Bar dataKey="RENDAH"        name="Rendah"        stackId="a" fill="#af4284" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function TabsSDM_User({
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
                active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30')}>
              <Icon size={14}/><span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full"/>}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {activeTab==='info'      && <TabInfo hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} eksporData={eksporData} getWarna={getWarna} getKategori={getKategori}/>}
        {activeTab==='kebijakan' && <TabKebijakanUser hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} getWarna={getWarna} getKategori={getKategori} analysisId={analysisId}/>}
        {activeTab==='metadata'  && <TabMetodologi/>}
        {activeTab==='tren'      && <TabTren daftarTersimpan={daftarTersimpan}/>}
      </div>
    </div>
  );
}