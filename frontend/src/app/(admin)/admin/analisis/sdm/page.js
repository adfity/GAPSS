"use client";
// ─── ADMIN SDM PAGE ───────────────────────────────────────────────────────────
// Full akses: analisis, simpan, hapus, CRUD bank kebijakan, kelola provinsi.
// Tambahan: badge jumlah usulan pending dari user.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  X, Calendar, Loader2, BarChart2, Check,
  Home, Activity, Heart, BookOpen, Wallet,
  Search, Save, AlertTriangle, CheckCircle2, XCircle,
  Brain, Play, Trash2, Settings, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import HeaderBar  from '@/components/layout/HeaderBar';
import SideBar    from '@/components/layout/sideBar';
import Footerauth from '@/components/layout/footerauth';
import PetaSDM, {
  getWarna_SDM, getKategori_SDM,
  TAHUN_BPS_AKTUAL, TAHUN_OLS,
  INDIKATOR_LABELS_SDM, INDIKATOR_COLORS_SDM,
  DATASET_LABELS_SDM, ZOOM_DEFAULT_SDM,
} from '@/components/analisis/sdm/petaSdm';
import TabsSDM from '@/components/analisis/sdm/tabSdm';

const API = 'http://127.0.0.1:8000/api';

const KEYS_LOADING_MAP = {
  ALL:['UHH','HLS','RLS','PENGELUARAN'], KESEHATAN:['UHH'],
  PENDIDIKAN:['HLS','RLS'], PENGELUARAN:['PENGELUARAN'],
};

const cn = (...cls) => cls.filter(Boolean).join(' ');
const Card = ({ children, className='' }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm',className)}>{children}</div>
);
const Btn = ({ children, variant='primary', className='', ...props }) => {
  const v = {
    primary:'bg-indigo-600 hover:bg-indigo-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost:  'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600',
  };
  return <button className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50',v[variant],className)} {...props}>{children}</button>;
};

// ─── MODAL HAPUS ──────────────────────────────────────────────────────────────
function ModalHapus({ terbuka, onTutup, onKonfirmasi, namaItem, sedangHapus }) {
  if (!terbuka) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <Trash2 size={16} className="text-red-600"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hapus Analisis</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tindakan ini tidak dapat dibatalkan</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">Hapus <strong>"{namaItem}"</strong>?</p>
        <div className="flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <Btn variant="danger" className="flex-1 justify-center" onClick={onKonfirmasi} disabled={sedangHapus}>
            {sedangHapus ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
            {sedangHapus ? 'Menghapus...' : 'Hapus'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── MODAL CEK DATA ───────────────────────────────────────────────────────────
function ModalCekData({ tahun, indikator, hasilCek, sedangCek, onTutup, onLanjutAktual, onLanjutProyeksi, onGantiTahun }) {
  if (!hasilCek && !sedangCek) return null;
  const { dataset_status={}, kolom_kosong=[], ada_prediksi, semua_aktual, bisa_dieksekusi, pesan_peringatan, ols_metrics={} } = hasilCek || {};
  const keysLoading = KEYS_LOADING_MAP[indikator] || KEYS_LOADING_MAP.ALL;
  const semuaAktual = !sedangCek && semua_aktual && bisa_dieksekusi;
  const adaProyeksi = !sedangCek && ada_prediksi && bisa_dieksekusi;
  const adaKosong   = !sedangCek && kolom_kosong.length > 0 && !bisa_dieksekusi;
  const headerCls   = sedangCek?'bg-blue-50 dark:bg-blue-900/30 border-blue-200':semuaAktual?'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200':adaProyeksi?'bg-amber-50 dark:bg-amber-900/30 border-amber-200':'bg-red-50 dark:bg-red-900/30 border-red-200';
  const headerTitle = sedangCek?`Memeriksa data tahun ${tahun}...`:semuaAktual?`✅ Semua data aktual tersedia (${tahun})`:adaProyeksi?`⚠️ Ada data yang perlu proyeksi (${tahun})`:`❌ Data tidak tersedia (${tahun})`;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className={`px-5 py-4 flex items-center gap-3 border-b ${headerCls} flex-shrink-0`}>
          {sedangCek?<Loader2 size={18} className="text-blue-500 animate-spin flex-shrink-0"/>:semuaAktual?<CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0"/>:adaProyeksi?<AlertTriangle size={18} className="text-amber-500 flex-shrink-0"/>:<XCircle size={18} className="text-red-500 flex-shrink-0"/>}
          <p className="font-bold text-slate-900 dark:text-white text-sm">{headerTitle}</p>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {sedangCek
            ? keysLoading.map(k=>(
                <div key={k} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0"/>
                  <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{DATASET_LABELS_SDM[k]||k}</span>
                  <span className="text-xs text-slate-400 font-semibold">Mengecek...</span>
                </div>
              ))
            : Object.entries(dataset_status).map(([k,info])=>{
                const isA=info.sumber==='aktual'; const isP=info.sumber==='prediksi'; const isN=!info.tersedia;
                return (
                  <div key={k} className={cn('flex items-start gap-3 px-3 py-3 rounded-xl border',isA?'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700':isP?'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700':'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700')}>
                    {isA?<CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5"/>:isP?<Brain size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>:<XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5"/>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{info.label||DATASET_LABELS_SDM[k]||k}</span>
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',isA?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300':isP?'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300':'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300')}>
                          {isA?`✓ Aktual (${info.jumlah_aktual} prov)`:isP?'📈 Proyeksi OLS':'Tidak Ada'}
                        </span>
                      </div>
                      {isP && ols_metrics[k]?.mape_pct!=null && <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">MAPE {ols_metrics[k].mape_pct.toFixed(2)}%</p>}
                    </div>
                  </div>
                );
              })
          }
          {!sedangCek&&adaProyeksi&&(
            <div className="p-3.5 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{pesan_peringatan||'Data akan dilengkapi proyeksi Regresi Linear OLS.'}</p>
            </div>
          )}
          {!sedangCek&&semuaAktual&&(
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0"/>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Semua data aktual BPS tersedia.</p>
            </div>
          )}
        </div>
        {!sedangCek&&(
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2.5 flex-shrink-0">
            {semuaAktual&&(<div className="flex gap-2"><Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn><button onClick={onLanjutAktual} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"><Play size={13}/> Mulai Analisis</button></div>)}
            {adaProyeksi&&(<><button onClick={onLanjutProyeksi} className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Brain size={14}/> Lanjutkan dengan Proyeksi OLS</button><button onClick={onGantiTahun} className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"><Calendar size={13}/> Pilih Tahun Lain</button></>)}
            {adaKosong&&(<button onClick={onGantiTahun} className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"><Calendar size={13}/> Pilih Tahun Lain</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL ANALISIS ───────────────────────────────────────────────────────────
function ModalAnalisis({ terbuka, onTutup, tahunTerpilih, setTahunTerpilih, pilihanIndikator, setPilihanIndikator, onCek, sedangMenganalisis }) {
  if (!terbuka) return null;
  const SEMUA_TAHUN = [...TAHUN_BPS_AKTUAL, ...TAHUN_OLS].sort((a,b)=>a-b);
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onTutup}/>
      <div className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Pilih Tahun & Indikator</h3>
          <button onClick={onTutup} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} className="text-slate-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"><Calendar size={13}/> Tahun</label>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {SEMUA_TAHUN.map(th=>{
                const isP=th>2026;
                return (<button key={th} onClick={()=>setTahunTerpilih(th)} className={cn('px-1 py-2 rounded-lg text-xs font-bold border-2 transition-all text-center',tahunTerpilih===th?'bg-indigo-600 border-indigo-600 text-white':isP?'border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-400':'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-300')}>{th}{isP&&<div className="text-[7px] opacity-60">proj</div>}</button>);
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Indikator</label>
            <div className="space-y-2">
              {[
                {key:'ALL',label:'SDM Gabungan',desc:'³√(IK × IP × IPeng) × 100',icon:<BarChart2 size={15}/>},
                {key:'KESEHATAN',label:'Indeks Kesehatan',desc:'IK = (AHH-20) / 65',icon:<Heart size={15}/>},
                {key:'PENDIDIKAN',label:'Indeks Pendidikan',desc:'IP = (HLS/18 + RLS/15) / 2',icon:<BookOpen size={15}/>},
                {key:'PENGELUARAN',label:'Indeks Pengeluaran',desc:'IPeng = ln(Peng) normalisasi',icon:<Wallet size={15}/>},
              ].map(opt=>(
                <button key={opt.key} onClick={()=>setPilihanIndikator(opt.key)}
                  className={cn('w-full p-3.5 rounded-xl border-2 transition-all text-left flex items-center gap-3',pilihanIndikator===opt.key?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30':'border-slate-200 dark:border-slate-600 hover:border-slate-300 bg-white dark:bg-slate-800')}>
                  <span className="flex-shrink-0" style={{color:pilihanIndikator===opt.key?INDIKATOR_COLORS_SDM[opt.key]:'#94a3b8'}}>{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">{opt.desc}</p>
                  </div>
                  {pilihanIndikator===opt.key&&<Check size={15} className="text-indigo-500 flex-shrink-0"/>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 flex gap-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={()=>onCek()} disabled={sedangMenganalisis}><Search size={13}/> Cek Data {tahunTerpilih}</Btn>
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
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Simpan Analisis ISDM</h3>
          <button onClick={onTutup} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} className="text-slate-500"/></button>
        </div>
        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Nama Analisis</label>
        <input type="text" value={namaSimpan} onChange={e=>setNamaSimpan(e.target.value)}
          onKeyPress={e=>e.key==='Enter'&&onSimpan()}
          placeholder={`ISDM ${INDIKATOR_LABELS_SDM[hasilAnalisis?.indikator||'ALL']} ${hasilAnalisis?.tahun||tahunTerpilih}`}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 outline-none text-sm mb-5"/>
        <div className="flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={onSimpan} disabled={sedangMenyimpan||!namaSimpan.trim()}>
            {sedangMenyimpan?'Menyimpan...':<><Save size={13}/> Simpan</>}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── PAGE UTAMA ───────────────────────────────────────────────────────────────
export default function AdminSdmPage() {
  const router = useRouter();

  const [hasilAnalisis,       setHasilAnalisis]       = useState(null);
  const [kategoriTerpilih,    setKategoriTerpilih]    = useState('SEMUA');
  const [indikatorTerpilih,   setIndikatorTerpilih]   = useState('ALL');
  const [isClient,            setIsClient]            = useState(false);
  const [activeTab,           setActiveTab]           = useState('info');
  const [daftarTersimpan,     setDaftarTersimpan]     = useState([]);
  const [sedangMuatAwal,      setSedangMuatAwal]      = useState(true);
  const [dataBaruDianalisis,  setDataBaruDianalisis]  = useState(false);
  const [tahunTerpilih,       setTahunTerpilih]       = useState(2024);
  const [sedangMenganalisis,  setSedangMenganalisis]  = useState(false);
  const [sedangCekData,       setSedangCekData]       = useState(false);
  const [hasilCekData,        setHasilCekData]        = useState(null);
  const [pilihanIndikator,    setPilihanIndikator]    = useState('ALL');
  const [pernahAnalisis,      setPernahAnalisis]      = useState(false);
  const [modalAnalisisTerbuka,setModalAnalisisTerbuka]= useState(false);
  const [modalSaveTerbuka,    setModalSaveTerbuka]    = useState(false);
  const [modalHapusTerbuka,   setModalHapusTerbuka]   = useState(false);
  const [targetHapus,         setTargetHapus]         = useState(null);
  const [sedangHapus,         setSedangHapus]         = useState(false);
  const [namaSimpan,          setNamaSimpan]          = useState('');
  const [sedangMenyimpan,     setSedangMenyimpan]     = useState(false);
  const [basemap,             setBasemap]             = useState('OSM');
  const [koordinatCursor,     setKoordinatCursor]     = useState({ lat:'0.0000', lng:'0.0000' });
  const [currentZoom,         setCurrentZoom]         = useState(ZOOM_DEFAULT_SDM);
  const [provinsiDipilih,     setProvinsiDipilih]     = useState(null);
  const [leafletReady,        setLeafletReady]        = useState(false);
  const [MapCont,             setMapCont]             = useState(null);
  const [TileLay,             setTileLay]             = useState(null);
  const [GeoComp,             setGeoComp]             = useState(null);
  const [activeAnalysisId,    setActiveAnalysisId]    = useState(null);
  const [pendingCount,        setPendingCount]        = useState(0);

  const petaRef    = useRef(null);
  const pendingRef = useRef(null);

  useEffect(()=>{
    setIsClient(true);
    import('leaflet/dist/leaflet.css');
    import('react-leaflet').then(rl=>{
      setMapCont(()=>rl.MapContainer);
      setTileLay(()=>rl.TileLayer);
      setGeoComp(()=>rl.GeoJSON);
      setLeafletReady(true);
    });
  },[]);
  useEffect(()=>{ if(isClient){ muatDariDB(); muatPendingCount(); }},[isClient]);

  // Poll pending count tiap 60 detik
  useEffect(()=>{
    if (!isClient) return;
    const interval = setInterval(muatPendingCount, 60000);
    return () => clearInterval(interval);
  },[isClient]);

  const muatPendingCount = async () => {
    try {
      const r = await axios.get(`${API}/sdm-usulan/admin/pending-count/`);
      setPendingCount(r.data.pending || 0);
    } catch {}
  };

  const kombinasiTersedia = useMemo(()=>{
    const map={};
    daftarTersimpan.forEach(a=>{
      const ind=a.indikator||'ALL'; const key=`${a.tahun}|${ind}`;
      if(!map[key]||a.timestamp>map[key].timestamp) map[key]={timestamp:a.timestamp,analysis_id:a.analysis_id};
    });
    return map;
  },[daftarTersimpan]);

  const jumlahKategori = useMemo(()=>{
    if(!hasilAnalisis?.matched_features?.features) return {};
    const counts={SANGAT_TINGGI:0,TINGGI:0,SEDANG:0,RENDAH:0,TIDAK_TERANALISIS:0};
    hasilAnalisis.matched_features.features.forEach(f=>{
      const k=getKategori_SDM(f,indikatorTerpilih);
      if(counts[k]!==undefined) counts[k]++;
    });
    return counts;
  },[hasilAnalisis,indikatorTerpilih]);

  const refreshDB = async()=>{ try{ const r=await axios.get(`${API}/sdm-analysis/list/`); setDaftarTersimpan(r.data.results||[]); }catch{} };

  const muatDariDB = async()=>{
    setSedangMuatAwal(true);
    try{
      const res=await axios.get(`${API}/sdm-analysis/list/`);
      const list=res.data.results||[];
      setDaftarTersimpan(list);
      if(!list.length) return;
      const sorted=[...list].sort((a,b)=>{
        const ai=(a.indikator||'ALL')==='ALL'?0:1; const bi=(b.indikator||'ALL')==='ALL'?0:1;
        if(ai!==bi) return ai-bi;
        if(b.tahun!==a.tahun) return b.tahun-a.tahun;
        return (b.timestamp||'').localeCompare(a.timestamp||'');
      });
      await muatDetail(sorted[0].analysis_id,sorted[0].tahun,sorted[0].indikator||'ALL',true);
    }catch(e){console.error(e);}
    finally{setSedangMuatAwal(false);}
  };

  const muatDetail = async(id,tahun,indikator,silent=false)=>{
    const tid=silent?null:toast.loading('Memuat analisis...');
    try{
      const res=await axios.get(`${API}/sdm-analysis/${id}/`);
      if(tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun||res.data.tahun||2024);
      setIndikatorTerpilih(indikator||res.data.indikator||'ALL');
      setPilihanIndikator(indikator||res.data.indikator||'ALL');
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDianalisis(false);
      setActiveAnalysisId(id);
      if(!silent) toast.success(`Dimuat: ${INDIKATOR_LABELS_SDM[indikator||'ALL']} ${tahun}`);
    }catch(e){
      if(tid) toast.dismiss(tid);
      if(!silent) toast.error('Gagal memuat analisis');
      throw e;
    }
  };

  const handlePilihKombo = async(tahun,indikator)=>{
    const key=`${tahun}|${indikator}`;
    if(!kombinasiTersedia[key]){ setTahunTerpilih(tahun); setPilihanIndikator(indikator); cekDanAnalisis(indikator,tahun); return; }
    await muatDetail(kombinasiTersedia[key].analysis_id,tahun,indikator);
  };

  const cekDanAnalisis = async(indikator=null,tahun=null)=>{
    const pilihan=indikator||pilihanIndikator; const thn=tahun||tahunTerpilih;
    pendingRef.current={pilihan,tahunFetch:thn};
    setModalAnalisisTerbuka(false); setSedangCekData(true); setHasilCekData(null);
    try{ const r=await axios.post(`${API}/check-sdm-data/`,{tahun:thn,indikator:pilihan}); setHasilCekData(r.data); }
    catch{ toast.error('Gagal memeriksa ketersediaan data'); }
    finally{ setSedangCekData(false); }
  };

  const jalankanAnalisis = async(gunakan_proyeksi=false)=>{
    if(!pendingRef.current) return;
    const {pilihan,tahunFetch}=pendingRef.current;
    setHasilCekData(null); setSedangMenganalisis(true); setKategoriTerpilih('SEMUA'); setActiveAnalysisId(null);
    const tid=toast.loading(`Menganalisis ISDM tahun ${tahunFetch}...`);
    try{
      const r=await axios.post(`${API}/analyze-sdm-bps/`,{indikator:pilihan,tahun:tahunFetch,gunakan_prediksi:gunakan_proyeksi});
      toast.dismiss(tid);
      if(r.data.status==='success'){
        setHasilAnalisis(r.data); setIndikatorTerpilih(pilihan); setTahunTerpilih(tahunFetch);
        setPernahAnalisis(true); setDataBaruDianalisis(true); setActiveTab('info');
        toast.success(`Berhasil: ${r.data.total_success} provinsi (${tahunFetch})`,{duration:5000});
      }
    }catch(e){ toast.dismiss(tid); toast.error(e.response?.data?.error||'Gagal terhubung ke server'); }
    finally{ setSedangMenganalisis(false); }
  };

  const simpan = async()=>{
    if(!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true); const tid=toast.loading('Menyimpan...');
    try{
      const r=await axios.post(`${API}/save-sdm-analysis/`,{name:namaSimpan,analysis_data:hasilAnalisis});
      toast.dismiss(tid);
      if(r.data.status==='success'){
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false); setNamaSimpan(''); setDataBaruDianalisis(false);
        setActiveAnalysisId(r.data.analysis_id); await refreshDB();
      }
    }catch{ toast.dismiss(tid); toast.error('Gagal menyimpan'); }
    finally{ setSedangMenyimpan(false); }
  };

  const konfirmasiHapus = async()=>{
    if(!targetHapus) return;
    setSedangHapus(true); const tid=toast.loading('Menghapus...');
    try{
      await axios.delete(`${API}/sdm-analysis/${targetHapus.analysis_id}/delete/`);
      toast.dismiss(tid); toast.success(`"${targetHapus.name}" dihapus.`);
      setModalHapusTerbuka(false); setTargetHapus(null);
      if(activeAnalysisId===targetHapus.analysis_id){ setHasilAnalisis(null); setActiveAnalysisId(null); setPernahAnalisis(false); }
      await refreshDB();
    }catch{ toast.dismiss(tid); toast.error('Gagal menghapus'); }
    finally{ setSedangHapus(false); }
  };

  const unduhBlob=(blob,nama)=>{ const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:nama}); a.click(); URL.revokeObjectURL(a.href); };
  const eksporData=(format)=>{
    if(!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r=hasilAnalisis.analysis_summary||[]; const thn=hasilAnalisis.tahun||tahunTerpilih;
    const ind=hasilAnalisis.indikator||'ALL'; const tgl=new Date().toISOString().split('T')[0];
    const src=hasilAnalisis.ada_prediksi?'_AktualPlusProyeksi':'_AktualDB';
    if(format==='EXCEL'){
      const ws=XLSX.utils.json_to_sheet(r.map(i=>({Provinsi:''+i.provinsi,Kategori:i.kategori_label||i.kategori,'ISDM (0-100)':i.indeks_sdm,'IK (×100)':i.ik!=null?+(i.ik*100).toFixed(2):'-','IP (×100)':i.ip!=null?+(i.ip*100).toFixed(2):'-','IPeng (×100)':i.ipeng!=null?+(i.ipeng*100).toFixed(2):'-','AHH':i.uhh||'-','RLS':i.rls||'-','HLS':i.hls||'-','Pengeluaran (Rb Rp)':i.pengeluaran||'-',Sumber:i.sumber||'-'})));
      const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'ISDM');
      XLSX.writeFile(wb,`Analisis_ISDM_${ind}_${thn}${src}_${tgl}.xlsx`); toast.success('Excel diunduh');
    } else if(format==='JSON'){ unduhBlob(new Blob([JSON.stringify(hasilAnalisis,null,2)],{type:'application/json'}),`Analisis_ISDM_${ind}_${thn}${src}_${tgl}.json`); toast.success('JSON diunduh');
    } else if(format==='CSV'){
      const csv=[['Provinsi','Kategori','ISDM_100','IK_x100','IP_x100','IPeng_x100','AHH','RLS','HLS','Pengeluaran_RbRp','Sumber'].join(','),...r.map(s=>[s.provinsi,s.kategori_label||s.kategori,s.indeks_sdm,s.ik!=null?(s.ik*100).toFixed(2):'-',s.ip!=null?(s.ip*100).toFixed(2):'-',s.ipeng!=null?(s.ipeng*100).toFixed(2):'-',s.uhh||'-',s.rls||'-',s.hls||'-',s.pengeluaran||'-',s.sumber||'-'].join(','))].join('\n');
      unduhBlob(new Blob([csv],{type:'text/csv'}),`Analisis_ISDM_${ind}_${thn}${src}_${tgl}.csv`); toast.success('CSV diunduh');
    } else if(format==='GEOJSON'){ unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features,null,2)],{type:'application/json'}),`Spasial_ISDM_${ind}_${thn}${src}_${tgl}.geojson`); toast.success('GeoJSON diunduh'); }
  };

  if(!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>

      <ModalCekData
        tahun={pendingRef.current?.tahunFetch||tahunTerpilih}
        indikator={pendingRef.current?.pilihan||pilihanIndikator}
        hasilCek={hasilCekData} sedangCek={sedangCekData}
        onTutup={()=>setHasilCekData(null)}
        onLanjutAktual={()=>jalankanAnalisis(false)}
        onLanjutProyeksi={()=>jalankanAnalisis(true)}
        onGantiTahun={()=>{ setHasilCekData(null); setPilihanIndikator(pendingRef.current?.pilihan||'ALL'); setModalAnalisisTerbuka(true); }}
      />
      <ModalAnalisis terbuka={modalAnalisisTerbuka} onTutup={()=>setModalAnalisisTerbuka(false)} tahunTerpilih={tahunTerpilih} setTahunTerpilih={setTahunTerpilih} pilihanIndikator={pilihanIndikator} setPilihanIndikator={setPilihanIndikator} onCek={cekDanAnalisis} sedangMenganalisis={sedangMenganalisis}/>
      <ModalSimpan terbuka={modalSaveTerbuka} onTutup={()=>setModalSaveTerbuka(false)} namaSimpan={namaSimpan} setNamaSimpan={setNamaSimpan} onSimpan={simpan} sedangMenyimpan={sedangMenyimpan} hasilAnalisis={hasilAnalisis} tahunTerpilih={tahunTerpilih}/>
      <ModalHapus terbuka={modalHapusTerbuka} onTutup={()=>setModalHapusTerbuka(false)} onKonfirmasi={konfirmasiHapus} namaItem={targetHapus?.name||''} sedangHapus={sedangHapus}/>

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-7 pb-5 gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Activity size={22} className="text-indigo-500"/> Indeks SDM (ISDM)
              </h1>
              {hasilAnalisis?.ada_prediksi && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                  style={{background:'linear-gradient(135deg,#fffbeb,#fef3c7)',borderColor:'#fcd34d',color:'#92400e'}}>
                  <Brain size={12}/> Ada Data Proyeksi
                </span>
              )}
            </div>

            {/* Nav kanan admin */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Badge usulan pending */}
              <button onClick={() => router.push('/admin/sdm/usulan')}
                className="relative flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors shadow-sm">
                <Bell size={13}/>
                Usulan Masuk
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>

              {/* Kelola analisis tersimpan */}
              {daftarTersimpan.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm">
                    <Settings size={12}/> Kelola ({daftarTersimpan.length})
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 z-50 py-1 hidden group-hover:block">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Analisis Tersimpan</div>
                    <div className="max-h-64 overflow-y-auto">
                      {daftarTersimpan.map(item=>(
                        <div key={item.analysis_id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                          <button onClick={()=>muatDetail(item.analysis_id,item.tahun,item.indikator||'ALL')} className="flex-1 text-left text-xs text-slate-700 dark:text-slate-200 truncate font-medium">
                            {item.name||`ISDM ${item.tahun}`} <span className="text-slate-400">({item.tahun})</span>
                          </button>
                          <button onClick={()=>{ setTargetHapus(item); setModalHapusTerbuka(true); }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-400 flex-shrink-0" title="Hapus">
                            <Trash2 size={11}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-400">
                <Home size={12}/> <span>›</span> <span className="text-slate-700 dark:text-slate-200 font-semibold">SDM</span>
              </nav>
            </div>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={30} className="text-indigo-500 animate-spin"/>
                <p className="text-sm text-slate-500">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaSDM
                hasilAnalisis={hasilAnalisis} tahunTerpilih={tahunTerpilih}
                indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                sedangMenganalisis={sedangMenganalisis} sedangCekData={sedangCekData}
                dataBaruDariBPS={dataBaruDianalisis} pernahAnalisis={pernahAnalisis}
                onAnalisis={()=>pernahAnalisis?cekDanAnalisis():(setPilihanIndikator('ALL'),setModalAnalisisTerbuka(true))}
                onSimpan={()=>{ setNamaSimpan(''); setModalSaveTerbuka(true); }}
                onReset={()=>{ setHasilAnalisis(null); setKategoriTerpilih('SEMUA'); setIndikatorTerpilih('ALL'); setProvinsiDipilih(null); setPernahAnalisis(false); setDataBaruDianalisis(false); setActiveAnalysisId(null); toast.success('Analisis direset'); }}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef} basemap={basemap} setBasemap={setBasemap}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                kombinasiTersedia={kombinasiTersedia} onPilihKombo={handlePilihKombo}
                sedangMuatAwal={false} jumlahKategori={jumlahKategori}
                getWarna={getWarna_SDM} getKategori={getKategori_SDM}
              />
              <TabsSDM
                activeTab={activeTab} setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori}
                indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunTerpilih} daftarTersimpan={daftarTersimpan}
                eksporData={eksporData} getWarna={getWarna_SDM} getKategori={getKategori_SDM}
                analysisId={activeAnalysisId}
                role="admin"
              />
            </div>
          )}
        </div>
      </main>
      <Footerauth/>
    </div>
  );
}