"use client";
// ─── ADMIN SDM — HALAMAN KELOLA USULAN ───────────────────────────────────────
// Admin melihat semua usulan dari User (TAMBAH / EDIT / PROVINSI)
// Bisa: approve (langsung diterapkan) atau reject (dengan alasan)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Loader2, CheckCheck, XCircle, Clock, ChevronDown,
  ChevronUp, RefreshCw, X, ArrowLeft, Filter,
  Search, AlertCircle, CheckCircle2, MessageSquare,
  FileText, ClipboardList, MapPin, ChevronRight,
  Bell,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import HeaderBar  from '@/components/layout/HeaderBar';
import SideBar    from '@/components/layout/sideBar';
import Footerauth from '@/components/layout/footerauth';

const API = 'http://127.0.0.1:8000/api';
const cn  = (...cls) => cls.filter(Boolean).join(' ');

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  PENDING:  { label:'Menunggu',  cls:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700',   icon:<Clock size={10}/> },
  APPROVED: { label:'Disetujui', cls:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700', icon:<CheckCheck size={10}/> },
  REJECTED: { label:'Ditolak',   cls:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700', icon:<XCircle size={10}/> },
};

const TIPE_CFG = {
  TAMBAH:   { label:'Usul Tambah',              icon:<FileText size={12}/>,      cls:'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300' },
  EDIT:     { label:'Usul Edit',                icon:<ChevronRight size={12}/>,  cls:'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300' },
  PROVINSI: { label:'Usul Rekomendasi Provinsi',icon:<MapPin size={12}/>,        cls:'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300' },
};

// ─── KOMPONEN BADGE ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.PENDING;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.cls)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TipeBadge({ tipe }) {
  const cfg = TIPE_CFG[tipe] || TIPE_CFG.TAMBAH;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg', cfg.cls)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── MODAL APPROVE ────────────────────────────────────────────────────────────
function ModalApprove({ usulan, onClose, onKonfirmasi, sending }) {
  const [catatan, setCatatan] = useState('');
  if (!usulan) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <CheckCheck size={15} className="text-emerald-600"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Setujui Usulan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Perubahan akan langsung diterapkan</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>

        {/* Preview usulan */}
        <div className="px-6 py-4 space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <TipeBadge tipe={usulan.tipe}/>
              <StatusBadge status={usulan.status}/>
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
              {usulan.tipe === 'PROVINSI'
                ? `Rekomendasi Provinsi: ${usulan.nama_provinsi}`
                : usulan.kebijakan || '—'}
            </p>
            {usulan.catatan_user && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 italic">
                Catatan User: "{usulan.catatan_user}"
              </p>
            )}
          </div>

          {/* Peringatan tipe */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
              {usulan.tipe === 'TAMBAH' && '✅ Kebijakan baru akan ditambahkan ke bank kebijakan.'}
              {usulan.tipe === 'EDIT'   && '✅ Kebijakan yang ada akan diperbarui sesuai usulan.'}
              {usulan.tipe === 'PROVINSI' && '✅ Rekomendasi provinsi di analisis terkait akan diperbarui.'}
            </p>
          </div>

          {/* Catatan admin (opsional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Catatan Admin <span className="text-slate-400 font-normal">(opsional)</span>
            </label>
            <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)}
              placeholder="Tambahkan catatan untuk User (opsional)..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-400 resize-none placeholder:text-slate-400"/>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            Batal
          </button>
          <button onClick={() => onKonfirmasi(catatan)} disabled={sending}
            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {sending ? <Loader2 size={13} className="animate-spin"/> : <CheckCheck size={13}/>}
            {sending ? 'Menyetujui...' : 'Setujui & Terapkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL REJECT ─────────────────────────────────────────────────────────────
function ModalReject({ usulan, onClose, onKonfirmasi, sending }) {
  const [catatan, setCatatan] = useState('');
  if (!usulan) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <XCircle size={15} className="text-red-600"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tolak Usulan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Wajib sertakan alasan penolakan</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={14} className="text-slate-500"/>
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
            <TipeBadge tipe={usulan.tipe}/>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-2 line-clamp-2">
              {usulan.tipe === 'PROVINSI' ? `Rekomendasi: ${usulan.nama_provinsi}` : usulan.kebijakan || '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Alasan Penolakan <span className="text-red-500">*</span>
            </label>
            <textarea rows={3} value={catatan} onChange={e => setCatatan(e.target.value)}
              placeholder="Jelaskan alasan penolakan agar User dapat memperbaiki usulannya..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-red-400 resize-none placeholder:text-slate-400"/>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            Batal
          </button>
          <button onClick={() => onKonfirmasi(catatan)} disabled={sending || !catatan.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {sending ? <Loader2 size={13} className="animate-spin"/> : <XCircle size={13}/>}
            {sending ? 'Menolak...' : 'Tolak Usulan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CARD DETAIL USULAN ───────────────────────────────────────────────────────
function CardUsulan({ usulan, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const isPending  = usulan.status === 'PENDING';
  const isApproved = usulan.status === 'APPROVED';
  const isRejected = usulan.status === 'REJECTED';

  const tanggal = (iso) => iso
    ? new Date(iso).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '—';

  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden transition-all',
      isPending  ? 'border-amber-200 dark:border-amber-700'
      : isApproved? 'border-emerald-200 dark:border-emerald-700'
      : 'border-red-200 dark:border-red-700')}>

      {/* Header card */}
      <div className="px-5 py-4 flex items-start gap-4">
        {/* Tipe icon */}
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
          usulan.tipe==='TAMBAH'   ? 'bg-indigo-100 dark:bg-indigo-900/40'
          : usulan.tipe==='EDIT'  ? 'bg-blue-100 dark:bg-blue-900/40'
          : 'bg-violet-100 dark:bg-violet-900/40')}>
          {TIPE_CFG[usulan.tipe]?.icon}
        </div>

        {/* Konten utama */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TipeBadge tipe={usulan.tipe}/>
            <StatusBadge status={usulan.status}/>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">#{usulan.id}</span>
          </div>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
            {usulan.tipe === 'PROVINSI'
              ? `Rekomendasi Provinsi: ${usulan.nama_provinsi}`
              : usulan.kebijakan || '—'}
          </p>

          {usulan.isu_strategis && (
            <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">{usulan.isu_strategis}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {usulan.pilar_kebijakan && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Pilar: <strong>{usulan.pilar_kebijakan}</strong>
              </span>
            )}
            {usulan.indikator_terkait && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Ind: <strong>{usulan.indikator_terkait}</strong>
              </span>
            )}
            {usulan.analysis_id && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Analysis ID: <span className="font-mono">{usulan.analysis_id.slice(0,8)}...</span>
              </span>
            )}
          </div>

          <p className="text-[10px] text-slate-400 mt-1.5">
            Dikirim oleh <strong>{usulan.dibuat_oleh}</strong> · {tanggal(usulan.dibuat_pada)}
          </p>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(v=>!v)}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
        </button>
      </div>

      {/* Detail expanded */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4 space-y-3 bg-slate-50 dark:bg-slate-800/60">

          {/* Perbandingan data lama vs baru (untuk EDIT) */}
          {usulan.tipe === 'EDIT' && usulan.data_lama && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Data Saat Ini</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 line-clamp-3">{usulan.data_lama.kebijakan}</p>
                <p className="text-[10px] text-slate-400 italic mt-1 line-clamp-2">{usulan.data_lama.rekomendasi_program}</p>
              </div>
              <div className="p-3 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Usulan Perubahan</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-3">{usulan.kebijakan}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-1 line-clamp-2">{usulan.rekomendasi_program}</p>
              </div>
            </div>
          )}

          {/* Detail untuk TAMBAH */}
          {usulan.tipe === 'TAMBAH' && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 space-y-2">
              {[
                ['Status Kebijakan', usulan.status_kebijakan?.replace('_',' ')],
                ['Pilar',            usulan.pilar_kebijakan],
                ['Isu Strategis',    usulan.isu_strategis],
                ['Rekomendasi',      usulan.rekomendasi_program],
              ].map(([label, val]) => val ? (
                <div key={label}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">{val}</p>
                </div>
              ) : null)}
            </div>
          )}

          {/* Detail untuk PROVINSI */}
          {usulan.tipe === 'PROVINSI' && usulan.rekomendasi_provinsi && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Rekomendasi Diusulkan ({Array.isArray(usulan.rekomendasi_provinsi) ? usulan.rekomendasi_provinsi.length : 0} pilar)
              </p>
              {Array.isArray(usulan.rekomendasi_provinsi) && usulan.rekomendasi_provinsi.slice(0, 3).map((k, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0"/>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{k.pilar}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{k.jumlah_aksi} aksi</span>
                </div>
              ))}
              {Array.isArray(usulan.rekomendasi_provinsi) && usulan.rekomendasi_provinsi.length > 3 && (
                <p className="text-[10px] text-slate-400 mt-1">+{usulan.rekomendasi_provinsi.length - 3} pilar lainnya</p>
              )}
            </div>
          )}

          {/* Catatan user */}
          {usulan.catatan_user && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare size={11} className="text-blue-500"/>
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Catatan dari User</p>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">"{usulan.catatan_user}"</p>
            </div>
          )}

          {/* Catatan admin (jika sudah diproses) */}
          {usulan.catatan_admin && !isPending && (
            <div className={cn('p-3 rounded-xl border',
              isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700')}>
              <p className={cn('text-[10px] font-bold mb-1', isApproved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                Catatan Admin
              </p>
              <p className={cn('text-xs leading-relaxed', isApproved ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                "{usulan.catatan_admin}"
              </p>
              {usulan.diproses_pada && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Diproses: {tanggal(usulan.diproses_pada)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons (hanya untuk PENDING) */}
      {isPending && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-white dark:bg-slate-800">
          <button onClick={() => onReject(usulan)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-900/30 hover:bg-red-100 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-700 transition-colors">
            <XCircle size={13}/> Tolak
          </button>
          <button onClick={() => onApprove(usulan)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors ml-auto">
            <CheckCheck size={13}/> Setujui & Terapkan
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PAGE UTAMA ───────────────────────────────────────────────────────────────
export default function AdminSdmUsulanPage() {
  const router = useRouter();
  const [data,         setData]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [fStatus,      setFStatus]      = useState('PENDING');
  const [fTipe,        setFTipe]        = useState('SEMUA');
  const [search,       setSearch]       = useState('');
  const [modalApprove, setModalApprove] = useState(null);
  const [modalReject,  setModalReject]  = useState(null);
  const [sending,      setSending]      = useState(false);
  const [toastMsg,     setToastMsg]     = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  const muatData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { indeks: 'ISDM', status: fStatus };
      if (fTipe !== 'SEMUA') params.tipe = fTipe;
      const r = await axios.get(`${API}/sdm-usulan/admin/list/`, { params });
      setData(r.data.results || []);
      setPendingCount(r.data.pending_count ?? 0);
    } catch { showToast('❌ Gagal memuat data'); }
    finally { setLoading(false); }
  }, [fStatus, fTipe]);

  useEffect(() => { muatData(); }, [muatData]);

  // Filter lokal (search)
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(u =>
      u.kebijakan?.toLowerCase().includes(q) ||
      u.isu_strategis?.toLowerCase().includes(q) ||
      u.nama_provinsi?.toLowerCase().includes(q) ||
      u.pilar_kebijakan?.toLowerCase().includes(q) ||
      String(u.id).includes(q)
    );
  }, [data, search]);

  const handleApprove = async (catatan) => {
    if (!modalApprove) return;
    setSending(true);
    try {
      await axios.post(`${API}/sdm-usulan/${modalApprove.id}/approve/`, { catatan_admin: catatan });
      showToast('✅ Usulan disetujui dan diterapkan!');
      setModalApprove(null);
      muatData();
    } catch (e) {
      showToast(`❌ ${e.response?.data?.error || 'Gagal menyetujui'}`);
    } finally { setSending(false); }
  };

  const handleReject = async (catatan) => {
    if (!modalReject) return;
    setSending(true);
    try {
      await axios.post(`${API}/sdm-usulan/${modalReject.id}/reject/`, { catatan_admin: catatan });
      showToast('✅ Usulan ditolak.');
      setModalReject(null);
      muatData();
    } catch (e) {
      showToast(`❌ ${e.response?.data?.error || 'Gagal menolak'}`);
    } finally { setSending(false); }
  };

  const statCounts = useMemo(() => {
    const c = { PENDING:0, APPROVED:0, REJECTED:0 };
    // Gunakan pendingCount dari API untuk PENDING
    c.PENDING = pendingCount;
    return c;
  }, [pendingCount]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* Modals */}
      {modalApprove && (
        <ModalApprove usulan={modalApprove} onClose={()=>setModalApprove(null)} onKonfirmasi={handleApprove} sending={sending}/>
      )}
      {modalReject && (
        <ModalReject usulan={modalReject} onClose={()=>setModalReject(null)} onKonfirmasi={handleReject} sending={sending}/>
      )}

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">

          {/* Breadcrumb + judul */}
          <div className="pt-7 pb-5">
            <button onClick={() => router.push('/admin/sdm')}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-3 transition-colors">
              <ArrowLeft size={14}/> Kembali ke SDM
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Bell size={22} className="text-amber-500"/>
                Kelola Usulan Kebijakan
              </h1>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-red-500 text-white">
                  {pendingCount} Menunggu
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review dan setujui/tolak usulan tambah/edit kebijakan dari User.
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label:'Menunggu',  val:pendingCount, status:'PENDING',
                cls:'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
                valCls:'text-amber-700 dark:text-amber-300' },
              { label:'Disetujui', val:'—', status:'APPROVED',
                cls:'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
                valCls:'text-emerald-700 dark:text-emerald-300' },
              { label:'Ditolak',   val:'—', status:'REJECTED',
                cls:'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
                valCls:'text-red-700 dark:text-red-300' },
            ].map(s => (
              <button key={s.status}
                onClick={() => setFStatus(s.status)}
                className={cn('border rounded-xl p-3 text-left transition-all hover:scale-[1.02]',
                  s.cls, fStatus === s.status && 'ring-2 ring-offset-1 ring-indigo-400')}>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{s.label}</div>
                <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari kebijakan, provinsi, pilar..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"/>
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X size={11} className="text-slate-400"/>
                </button>
              )}
            </div>

            {/* Filter tipe */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              {[['SEMUA','Semua'],['TAMBAH','Tambah'],['EDIT','Edit'],['PROVINSI','Provinsi']].map(([val,lbl]) => (
                <button key={val} onClick={() => setFTipe(val)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    fTipe === val
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button onClick={muatData} disabled={loading}
              className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors" title="Refresh">
              <RefreshCw size={14} className={cn('text-slate-600 dark:text-slate-300', loading && 'animate-spin')}/>
            </button>

            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
              {filtered.length} usulan
            </span>
          </div>

          {/* List usulan */}
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3">
              <Loader2 size={24} className="text-indigo-500 animate-spin"/>
              <span className="text-slate-500">Memuat usulan...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <ClipboardList size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {fStatus === 'PENDING' ? 'Tidak ada usulan yang menunggu persetujuan.' : `Tidak ada usulan dengan status "${fStatus}".`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(u => (
                <CardUsulan
                  key={u.id}
                  usulan={u}
                  onApprove={setModalApprove}
                  onReject={setModalReject}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footerauth/>
    </div>
  );
}