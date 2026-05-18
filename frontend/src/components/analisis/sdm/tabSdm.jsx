"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Download, ChevronDown, Info, FileText, Calendar,
  BarChart2, TrendingUp, ClipboardList, BookOpen,
  AlertCircle, X, ExternalLink, Brain, Loader2,
  Plus, Pencil, Trash2, Save, RefreshCw, ChevronRight,
  EyeOff, Eye, ChevronUp, ArrowLeftRight, Layers,
  CheckCircle2, Search, AlertTriangle, TrendingDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  INDIKATOR_LABELS_SDM, INDIKATOR_COLORS_SDM, INDIKATOR_ICON_SDM,
  TAHUN_TERSEDIA_SDM, DATASET_LABELS_SDM, isPrediksiYear,
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
  SANGAT_TINGGI:    { bg:'#008cd6', border:'#7dd3fc', badge:'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  TINGGI:           { bg:'#abcd05', border:'#bef264', badge:'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300' },
  SEDANG:           { bg:'#fff67f', border:'#fde047', badge:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  RENDAH:           { bg:'#af4284', border:'#e879f9', badge:'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
  TIDAK_TERANALISIS:{ bg:'#a6a6a6', border:'#cbd5e1', badge:'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
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
const getPilarColor = (p) => PILAR_COLORS[p] || '#6366f1';
const INDIKATOR_TERKAIT_LIST = ['IK','IP','IPeng','ALL'];
const EMPTY_FORM = { status:'SEDANG', prioritas:1, pilar_kebijakan:'Transformasi', isu_strategis:'', kebijakan:'', rekomendasi_program:'', indikator_terkait:'IK' };


// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useBankKebijakan() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const refresh = useCallback(() => {
    setLoading(true);
    axios.get(`${API_BASE}/bank-kebijakan-sdm/`)
      .then(r => { setData(r.data.results||[]); setError(null); })
      .catch(() => setError('Gagal memuat data.'))
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
      .then(r => setData(r.data.flat||[]))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading, load };
}


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

// Badge proyeksi — menggantikan "Prediksi Kasar Holt"
function ProyeksiBadge({ size='sm', kolomProyeksi=[] }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold rounded-full border bg-amber-50 dark:bg-amber-900/30', size==='xs'?'text-[9px] px-1.5 py-0.5':'text-[10px] px-2 py-0.5')}
      style={{ borderColor:'#fcd34d', color:'#92400e' }}>
      <AlertTriangle size={size==='xs'?7:9}/>
      Proyeksi Regresi Linear
      {kolomProyeksi.length>0 && size!=='xs' && (
        <span className="opacity-70 ml-0.5">({kolomProyeksi.join(', ')})</span>
      )}
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


// ─── MODAL PILIH BANK ─────────────────────────────────────────────────────────
function ModalPilihBank({ onClose, onPilih, bankData, loading, statusHint='' }) {
  const [search,setSearch]=useState('');
  const [fStatus,setFS]=useState(statusHint||'SEMUA');
  const [fPilar,setFP]=useState('SEMUA');
  const allPilars=useMemo(()=>[...new Set(bankData.map(d=>d.pilar).filter(Boolean))].sort(),[bankData]);
  const filtered=useMemo(()=>{
    let d=bankData;
    if(fStatus!=='SEMUA')d=d.filter(x=>x.status===fStatus);
    if(fPilar!=='SEMUA')d=d.filter(x=>x.pilar===fPilar);
    if(search.trim()){const q=search.toLowerCase();d=d.filter(x=>x.kebijakan?.toLowerCase().includes(q)||x.isu_strategis?.toLowerCase().includes(q)||x.pilar?.toLowerCase().includes(q));}
    return d;
  },[bankData,fStatus,fPilar,search]);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center"><Layers size={13} className="text-indigo-600"/></div>
            <div><p className="font-bold text-slate-900 dark:text-white text-sm">Pilih dari Bank Kebijakan ISDM</p><p className="text-xs text-slate-400 mt-0.5">{filtered.length} kebijakan</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={14} className="text-slate-500"/></button>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari…" className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400"/>
          </div>
          <select value={fStatus} onChange={e=>setFS(e.target.value)} className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            <option value="SEMUA">Semua Status</option>
            {STATUS_LIST.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
          <select value={fPilar} onChange={e=>setFP(e.target.value)} className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            <option value="SEMUA">Semua Pilar</option>
            {allPilars.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={17} className="animate-spin"/><span className="text-sm">Memuat…</span></div>
          ) : filtered.length===0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">Tidak ada kebijakan cocok</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.map(item=>{
                const sc=STATUS_COLORS[item.status]; const pc=getPilarColor(item.pilar);
                return (
                  <button key={item.id} onClick={()=>onPilih(item)} className="w-full text-left px-5 py-3.5 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 transition-colors flex items-start gap-3">
                    <div className="flex flex-col gap-1 mt-0.5 flex-shrink-0">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{backgroundColor:sc?.bg||'#94a3b8',color:(sc?.bg==='#fff67f'||sc?.bg==='#abcd05')?'#1a2e00':'#fff'}}>{(item.status||'').replace('_',' ')}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{color:pc,backgroundColor:pc+'18'}}>P{item.prioritas}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold mb-0.5" style={{color:pc}}>{item.pilar}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{item.kebijakan}</p>
                      {item.isu_strategis&&<p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">Isu: {item.isu_strategis}</p>}
                    </div>
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


// ─── MODAL DETAIL PROVINSI ────────────────────────────────────────────────────
function ModalDetailProvinsi({ provinsiNama,popupData,popupFitur,getWarna,getKategori,indikatorTerpilih,analysisId,onClose,onRekomendasiSaved }) {
  const {data:bankData,loading:bankLoading,load:loadBank}=useBankISDM();
  const [rekLocal,setRekLocal]=useState(()=>JSON.parse(JSON.stringify(popupData?.rekomendasi||[])));
  const [isDirty,setIsDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');
  const [bankModal,setBankModal]=useState(null);
  const [expanded,setExpanded]=useState({});
  const markDirty=()=>setIsDirty(true);
  const togglePilar=(i)=>setExpanded(p=>({...p,[i]:!p[i]}));
  const toggleDisabled=(pi,ai)=>{setRekLocal(prev=>{const next=JSON.parse(JSON.stringify(prev));const aksi=next[pi]?.aksi?.[ai];if(aksi)aksi.disabled=!aksi.disabled;return next;});markDirty();};
  const removeAksi=(pi,ai)=>{setRekLocal(prev=>{const next=JSON.parse(JSON.stringify(prev));next[pi].aksi.splice(ai,1);next[pi].jumlah_aksi=next[pi].aksi.length;if(next[pi].aksi.length===0)next.splice(pi,1);return next;});markDirty();};
  const bankToAksi=(item,no=1)=>({no_aksi:no,bank_id:item.id,isu_strategis:item.isu_strategis||'',nama_aksi:item.kebijakan||'',detail_aksi:item.rekomendasi||'',indikator_terkait:item.indikator_terkait||'',sub_sektor:item.pilar||'',disabled:false});
  const handlePilihBank=(item)=>{if(!bankModal)return;setBankModal(null);setRekLocal(prev=>{const next=JSON.parse(JSON.stringify(prev));const{mode,pilarIdx,aksiIdx}=bankModal;if(mode==='replace'){const aksi=next[pilarIdx]?.aksi?.[aksiIdx];if(aksi){const nA=bankToAksi(item,aksi.no_aksi);if(item.pilar&&item.pilar!==next[pilarIdx].pilar){next[pilarIdx].aksi.splice(aksiIdx,1);next[pilarIdx].jumlah_aksi=next[pilarIdx].aksi.length;const ep=next.findIndex(p=>p.pilar===item.pilar);if(ep>=0){next[ep].aksi.push({...nA,no_aksi:next[ep].aksi.length+1});next[ep].jumlah_aksi=next[ep].aksi.length;}else next.push({pilar:item.pilar,prioritas:item.prioritas||5,jumlah_aksi:1,aksi:[{...nA,no_aksi:1}]});if(next[pilarIdx].aksi.length===0)next.splice(pilarIdx,1);}else next[pilarIdx].aksi[aksiIdx]=nA;}}else if(mode==='add_to_pilar'){const p=next[pilarIdx];if(p){p.aksi.push(bankToAksi(item,p.aksi.length+1));p.jumlah_aksi=p.aksi.length;}}else{const ep=next.findIndex(p=>p.pilar===item.pilar);if(ep>=0){next[ep].aksi.push(bankToAksi(item,next[ep].aksi.length+1));next[ep].jumlah_aksi=next[ep].aksi.length;}else next.push({pilar:item.pilar,prioritas:item.prioritas||5,jumlah_aksi:1,aksi:[bankToAksi(item,1)]});}return next;});markDirty();};
  const handleSave=async()=>{if(!analysisId){setSaveMsg('⚠️ Simpan analisis dulu.');setTimeout(()=>setSaveMsg(''),4000);return;}setSaving(true);setSaveMsg('');try{await axios.patch(`${API_BASE}/sdm-analysis/${analysisId}/provinsi-kebijakan/`,{nama_provinsi:provinsiNama,rekomendasi:rekLocal});setSaveMsg('✅ Tersimpan!');setIsDirty(false);onRekomendasiSaved?.(provinsiNama,rekLocal);setTimeout(()=>setSaveMsg(''),3000);}catch(e){setSaveMsg(`❌ ${e.response?.data?.error||e.message}`);}finally{setSaving(false);}};
  const warna=popupFitur?getWarna(popupFitur,indikatorTerpilih):'#6366f1';
  const kat=popupFitur?getKategori(popupFitur,indikatorTerpilih):'-';
  const kolomProyeksi=popupData?.kolom_prediksi||[];

  return (
    <>
      <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e=>e.target===e.currentTarget&&!isDirty&&onClose()}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0" style={{borderLeft:`4px solid ${warna}`}}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{popupData?.nama_provinsi}</h3>
                  {kolomProyeksi.length>0 && <ProyeksiBadge kolomProyeksi={kolomProyeksi}/>}
                  {isDirty&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">● Belum disimpan</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={kat}/>
                  <span className="text-sm font-mono font-black" style={{color:warna}}>ISDM {popupData?.indeks_sdm??'—'}</span>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex-shrink-0"><X size={16} className="text-slate-500"/></button>
            </div>
          </div>
          <div className="px-6 py-2.5 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={()=>{loadBank();setBankModal({mode:'add_new'});}} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm"><Plus size={11}/> Tambah</button>
              <span className="text-xs text-slate-400">{rekLocal.reduce((s,p)=>s+(p.aksi?.filter(a=>!a.disabled).length||0),0)} aktif</span>
            </div>
            <div className="flex items-center gap-2">
              {saveMsg&&<span className="text-xs font-semibold">{saveMsg}</span>}
              <button onClick={handleSave} disabled={!isDirty||saving} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold',isDirty?'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm':'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed')}>
                {saving?<Loader2 size={11} className="animate-spin"/>:<Save size={11}/>} {saving?'Menyimpan…':'Simpan'}
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {rekLocal.length===0?(
              <div className="text-center py-10 text-slate-400"><AlertCircle size={26} className="mx-auto mb-2 opacity-40"/><p className="text-sm mb-3">Belum ada rekomendasi.</p><button onClick={()=>{loadBank();setBankModal({mode:'add_new'});}} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold">+ Tambah</button></div>
            ):rekLocal.map((kelompok,ki)=>{
              const pc=getPilarColor(kelompok.pilar);const isOpen=expanded[ki]!==false;const aktif=kelompok.aksi?.filter(a=>!a.disabled).length||0;const nonaktif=kelompok.aksi?.filter(a=>a.disabled).length||0;
              return (
                <div key={ki} className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <button onClick={()=>togglePilar(ki)} className="flex items-center gap-3 px-4 py-2.5 w-full text-left" style={{backgroundColor:pc+'15',borderBottom:isOpen?`1px solid ${pc}30`:'none'}}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:pc}}/><span className="text-sm font-bold flex-1" style={{color:pc}}>{kelompok.pilar}</span>
                    <span className="text-xs text-slate-400">{aktif} aktif{nonaktif>0?` · ${nonaktif} nonaktif`:''}</span>
                    {isOpen?<ChevronUp size={12} className="text-slate-400"/>:<ChevronDown size={12} className="text-slate-400"/>}
                  </button>
                  {isOpen&&(
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {kelompok.aksi?.map((aksi,ai)=>(
                        <div key={ai} className={cn('px-4 py-3 flex items-start gap-3',aksi.disabled?'opacity-40 bg-slate-50 dark:bg-slate-800/60':'bg-white dark:bg-slate-800/20')}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-black" style={{backgroundColor:aksi.disabled?'#94a3b8':pc}}>{aksi.no_aksi||ai+1}</span>
                          <div className="flex-1 min-w-0">
                            {aksi.disabled&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 mr-1">NONAKTIF</span>}
                            {aksi.isu_strategis&&<p className="text-xs italic text-slate-400 mb-0.5">Isu: {aksi.isu_strategis}</p>}
                            <p className={cn('text-sm font-semibold leading-snug',aksi.disabled?'text-slate-400 line-through':'text-slate-800 dark:text-slate-100')}>{aksi.nama_aksi}</p>
                            {aksi.detail_aksi&&<p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{aksi.detail_aksi}</p>}
                            {aksi.indikator_terkait&&<span className="inline-block mt-1 text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded font-semibold">{aksi.indikator_terkait}</span>}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={()=>{loadBank();setBankModal({mode:'replace',pilarIdx:ki,aksiIdx:ai});}} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500"><ArrowLeftRight size={11}/></button>
                            <button onClick={()=>toggleDisabled(ki,ai)} className={cn('p-1.5 rounded-lg',aksi.disabled?'hover:bg-emerald-50 text-emerald-500':'hover:bg-amber-50 text-amber-500')}>{aksi.disabled?<Eye size={11}/>:<EyeOff size={11}/>}</button>
                            <button onClick={()=>removeAksi(ki,ai)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><X size={11}/></button>
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
            <p className="text-xs text-slate-400 italic">💡 Nonaktifkan = tandai. Hapus = hilangkan.</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold">Tutup</button>
          </div>
        </div>
      </div>
      {bankModal&&<ModalPilihBank onClose={()=>setBankModal(null)} onPilih={handlePilihBank} bankData={bankData} loading={bankLoading} statusHint={kat!=='TIDAK_TERANALISIS'?kat:''}/>}
    </>
  );
}


// ─── TAB INFO ─────────────────────────────────────────────────────────────────
function TabInfo({ hasilAnalisis,jumlahKategori,indikatorTerpilih,kategoriTerpilih,setKategoriTerpilih,eksporData,getWarna,getKategori }) {
  const [menuUnduh,setMenuUnduh]=useState(false);
  const dataTerfilter=useMemo(()=>{
    if(!hasilAnalisis?.matched_features?.features)return[];
    let f=hasilAnalisis.matched_features.features;
    if(kategoriTerpilih!=='SEMUA')f=f.filter(x=>getKategori(x,indikatorTerpilih)===kategoriTerpilih);
    return f;
  },[hasilAnalisis,kategoriTerpilih,indikatorTerpilih,getKategori]);

  if(!hasilAnalisis) return (
    <div className="py-16 text-center"><BarChart2 size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/><p className="text-base text-slate-500 dark:text-slate-400">Belum ada data. Klik <strong>Analisis ISDM</strong> di peta.</p></div>
  );

  const tahun=hasilAnalisis.tahun;
  const adaProyeksi=hasilAnalisis.ada_prediksi;
  const totalTA=hasilAnalisis.total_tidak_teranalisis||0;
  const showUHH=indikatorTerpilih==='ALL'||indikatorTerpilih==='KESEHATAN';
  const showRLS=indikatorTerpilih==='ALL'||indikatorTerpilih==='PENDIDIKAN';
  const showHLS=indikatorTerpilih==='ALL'||indikatorTerpilih==='PENDIDIKAN';
  const showPeng=indikatorTerpilih==='ALL'||indikatorTerpilih==='PENGELUARAN';

  return (
    <div className="space-y-5">
      {/* Header badges */}
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp&&(
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
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700">
        <Info size={14} className="text-indigo-500 flex-shrink-0"/>
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          Skor bernilai <span className="font-black">0 – 100</span>. Skor <span className="font-black">100</span> adalah terbaik.
        </p>
      </div>

      {/* Peringatan proyeksi */}
      {adaProyeksi && (
        <div className="p-3.5 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">⚠️ Mengandung Data Proyeksi (Regresi Linear OLS)</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
              Sebagian data tidak tersedia di database aktual BPS sehingga digantikan oleh hasil proyeksi model Regresi Linear OLS.
              Proyeksi ini merupakan estimasi matematis berdasarkan tren historis — <strong>bukan data resmi BPS</strong>.
              Gunakan dengan hati-hati untuk pengambilan keputusan.
            </p>
          </div>
        </div>
      )}


      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {label:'Teranalisis',    val:hasilAnalisis.total_success||0, cls:'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700', valCls:'text-indigo-700 dark:text-indigo-300'},
          {label:'SANGAT TINGGI', val:jumlahKategori['SANGAT_TINGGI']??0, cls:'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700', valCls:'text-sky-700 dark:text-sky-300'},
          {label:'TINGGI',        val:jumlahKategori['TINGGI']??0,        cls:'bg-lime-50 dark:bg-lime-900/30 border-lime-200 dark:border-lime-700', valCls:'text-lime-700 dark:text-lime-300'},
          {label:'SEDANG',        val:jumlahKategori['SEDANG']??0,        cls:'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700', valCls:'text-yellow-700 dark:text-yellow-300'},
          {label:'RENDAH',        val:jumlahKategori['RENDAH']??0,        cls:'bg-fuchsia-50 dark:bg-fuchsia-900/30 border-fuchsia-200 dark:border-fuchsia-700', valCls:'text-fuchsia-700 dark:text-fuchsia-300'},
        ].map(s=>(
          <div key={s.label} className={cn('border rounded-xl p-3',s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black',s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>
      {totalTA>0&&<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:'#a6a6a6'}}/><span>{totalTA} provinsi tidak teranalisis (data tidak tersedia)</span></div>}

      {/* Tabel */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">{dataTerfilter.length} provinsi · {tahun}</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={kategoriTerpilih} onChange={e=>setKategoriTerpilih(e.target.value)} className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
              <option value="SEMUA">SEMUA</option>
              {[...STATUS_LIST,'TIDAK_TERANALISIS'].map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}
            </select>
            <div className="relative">
              <button onClick={()=>setMenuUnduh(!menuUnduh)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm"><Download size={13}/> Unduh</button>
              {menuUnduh&&(
                <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-600 py-1">
                  {['EXCEL','CSV','JSON','GEOJSON'].map(fmt=>(
                    <button key={fmt} onClick={()=>{eksporData(fmt);setMenuUnduh(false);}} className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Download size={11} className="text-indigo-500"/> {fmt}</button>
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
                {showUHH &&<th className="px-4 py-3 text-center">AHH</th>}
                {showRLS &&<th className="px-4 py-3 text-center">RLS</th>}
                {showHLS &&<th className="px-4 py-3 text-center">HLS</th>}
                {showPeng&&<th className="px-4 py-3 text-center">Pengeluaran</th>}
                {indikatorTerpilih==='ALL'&&<>
                  <th className="px-3 py-3 text-center">IK×100</th>
                  <th className="px-3 py-3 text-center">IP×100</th>
                  <th className="px-3 py-3 text-center">IPeng×100</th>
                </>}
                <th className="px-4 py-3 text-center">Kategori</th>
                <th className="px-4 py-3 text-center">Sumber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {dataTerfilter.map((fitur,idx)=>{
                const d=fitur.properties.sdm_analysis;
                const dc=d.data_komponen||{};
                const w=getWarna(fitur,indikatorTerpilih);
                const kat=getKategori(fitur,indikatorTerpilih);
                const isTA=kat==='TIDAK_TERANALISIS';
                const isDark=['#fff67f','#abcd05'].includes(w);
                const kp=d.kolom_prediksi||[];
                const isCampuran=d.sumber==='campuran';
                const isProyeksi=d.sumber==='prediksi';
                const cellPred=(k)=>kp.includes(k);
                const rowBg = idx%2===0
                  ? 'bg-white dark:bg-slate-800'
                  : 'bg-slate-50/60 dark:bg-slate-800/60';
                return (
                  <tr key={d.nama_provinsi} className={cn('hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors', rowBg)}>
                    <td className="px-3 py-3 text-center text-xs font-medium text-slate-400 dark:text-slate-500">{idx+1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:w,border:isDark?'1px solid rgba(0,0,0,0.2)':''}}/>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                        {d.rekomendasi_edited&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">✎ Edit</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA
                        ? <span className="text-xs text-slate-400 dark:text-slate-500 italic">—</span>
                        : <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_sdm??'—'}</span>
                      }
                    </td>
                    {showUHH&&<td className={cn('px-4 py-3 text-center text-sm',cellPred('UHH')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                      {dc.UHH??'—'}{cellPred('UHH')&&<span className="ml-0.5 text-[9px]">*</span>}
                    </td>}
                    {showRLS&&<td className={cn('px-4 py-3 text-center text-sm',cellPred('RLS')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                      {dc.RLS??'—'}{cellPred('RLS')&&<span className="ml-0.5 text-[9px]">*</span>}
                    </td>}
                    {showHLS&&<td className={cn('px-4 py-3 text-center text-sm',cellPred('HLS')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                      {dc.HLS??'—'}{cellPred('HLS')&&<span className="ml-0.5 text-[9px]">*</span>}
                    </td>}
                    {showPeng&&<td className={cn('px-4 py-3 text-center text-sm',cellPred('PENGELUARAN')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                      {dc.PENGELUARAN?dc.PENGELUARAN.toLocaleString('id-ID'):'—'}{cellPred('PENGELUARAN')&&<span className="ml-0.5 text-[9px]">*</span>}
                    </td>}
                    {indikatorTerpilih==='ALL'&&<>
                      <td className="px-3 py-3 text-center text-sm font-semibold text-sky-600 dark:text-sky-400">{d.ik!=null?(d.ik*100).toFixed(1):'—'}</td>
                      <td className="px-3 py-3 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">{d.ip!=null?(d.ip*100).toFixed(1):'—'}</td>
                      <td className="px-3 py-3 text-center text-sm font-semibold text-amber-600 dark:text-amber-400">{d.ipeng!=null?(d.ipeng*100).toFixed(1):'—'}</td>
                    </>}
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold border"
                        style={{
                          borderColor:isTA?'#cbd5e1':w+'60',
                          color:isTA?'#94a3b8':isDark?'#1a2e00':w,
                          backgroundColor:isTA?'transparent':w+'18'
                        }}>
                        {(d.kategori_label||d.kategori||'—').replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA
                        ? <span className="text-xs text-slate-400 dark:text-slate-500 italic">—</span>
                        : (isProyeksi||isCampuran)
                        ? <ProyeksiBadge size="xs" kolomProyeksi={kp}/>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                            <CheckCircle2 size={9}/> Aktual
                          </span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer tabel */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 flex flex-wrap items-center gap-4">
            {adaProyeksi&&(
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={10}/> * = data proyeksi Regresi Linear OLS (bukan data resmi BPS)
              </p>
            )}
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400"/>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Data Aktual BPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-400"/>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Proyeksi Regresi Linear</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600"/>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Tidak Teranalisis</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── TAB KEBIJAKAN ────────────────────────────────────────────────────────────
function TabKebijakan({ hasilAnalisis,indikatorTerpilih,kategoriTerpilih,setKategoriTerpilih,getWarna,getKategori,analysisId }) {
  const {data:bankRaw,loading:bankLoading,error:bankError,refresh}=useBankKebijakan();
  const [subTab,setSubTab]=useState('bank');
  const [fStatus,setFS]=useState('SEMUA');
  const [fPilar,setFP]=useState('SEMUA');
  const [searchBank,setSB]=useState('');
  const [searchProv,setSP]=useState('');
  const [modal,setModal]=useState(null);
  const [deletingId,setDelId]=useState(null);
  const [expandedRow,setExp]=useState(null);
  const [provinsiPopup,setPP]=useState(null);
  const [featuresLocal,setFL]=useState(null);

  useEffect(()=>{if(hasilAnalisis?.matched_features?.features)setFL(hasilAnalisis.matched_features.features);},[hasilAnalisis]);

  const dataTerfilter=useMemo(()=>{
    const features=featuresLocal||hasilAnalisis?.matched_features?.features||[];
    let f=features;
    if(kategoriTerpilih!=='SEMUA')f=f.filter(x=>getKategori(x,indikatorTerpilih)===kategoriTerpilih);
    if(searchProv.trim())f=f.filter(x=>x.properties?.sdm_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  },[featuresLocal,hasilAnalisis,kategoriTerpilih,indikatorTerpilih,searchProv,getKategori]);

  const allPilars=useMemo(()=>[...new Set(bankRaw.map(k=>k.pilar).filter(Boolean))].sort(),[bankRaw]);
  const filteredBank=useMemo(()=>{
    let d=bankRaw;
    if(fStatus!=='SEMUA')d=d.filter(k=>k.status===fStatus);
    if(fPilar!=='SEMUA')d=d.filter(k=>k.pilar===fPilar);
    if(searchBank.trim()){const q=searchBank.toLowerCase();d=d.filter(k=>k.kebijakan?.toLowerCase().includes(q)||k.pilar?.toLowerCase().includes(q)||k.isu_strategis?.toLowerCase().includes(q));}
    return d;
  },[bankRaw,fStatus,fPilar,searchBank]);

  const statsPerStatus=useMemo(()=>{const c={SANGAT_TINGGI:0,TINGGI:0,SEDANG:0,RENDAH:0};bankRaw.forEach(k=>{if(k.status&&c[k.status]!==undefined)c[k.status]++;});return c;},[bankRaw]);

  const handleDelete=async(id)=>{if(!confirm('Hapus?'))return;setDelId(id);try{await axios.delete(`${API_BASE}/bank-kebijakan-sdm/${id}/delete/`);refresh();}catch(e){alert(e.response?.data?.error||'Gagal');}finally{setDelId(null);}};
  const handleRekSaved=useCallback((nm,nr)=>{setFL(prev=>{if(!prev)return prev;return prev.map(feat=>{const sdm=feat.properties?.sdm_analysis;if(sdm?.nama_provinsi?.toUpperCase().trim()===nm.toUpperCase().trim())return{...feat,properties:{...feat.properties,sdm_analysis:{...sdm,rekomendasi:nr,rekomendasi_edited:true}}};return feat;});});},[]);

  const popupFitur=provinsiPopup?(featuresLocal||hasilAnalisis?.matched_features?.features||[]).find(f=>f.properties?.sdm_analysis?.nama_provinsi===provinsiPopup):null;
  const popupData=popupFitur?.properties?.sdm_analysis;

  return (
    <div className="space-y-4">
      {modal&&<ModalKebijakan mode={modal.mode} data={modal.data} onClose={()=>setModal(null)} onSaved={refresh}/>}
      {provinsiPopup&&popupData&&<ModalDetailProvinsi provinsiNama={provinsiPopup} popupData={popupData} popupFitur={popupFitur} getWarna={getWarna} getKategori={getKategori} indikatorTerpilih={indikatorTerpilih} analysisId={analysisId} onClose={()=>setPP(null)} onRekomendasiSaved={handleRekSaved}/>}

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {[{id:'bank',label:'Bank Kebijakan',icon:<FileText size={12}/>},{id:'provinsi',label:'Per Provinsi',icon:<ClipboardList size={12}/>}].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',subTab===t.id?'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400':'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {subTab==='bank'&&(
        <div className="space-y-4">
          {bankLoading?<div className="flex items-center justify-center py-16 gap-3"><Loader2 size={22} className="text-indigo-500 animate-spin"/><span className="text-slate-500">Memuat...</span></div>
           :bankError?<div className="flex items-center gap-2.5 p-4 bg-red-50 rounded-xl border border-red-200"><AlertCircle size={15} className="text-red-500"/><p className="text-sm text-red-700">{bankError}</p></div>
           :(
            <>
              <div className="grid grid-cols-5 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-center"><div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Total</div><div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bankRaw.length}</div></div>
                {STATUS_LIST.map(st=>{const sc=STATUS_COLORS[st];const count=statsPerStatus[st]||0;const active=fStatus===st;return(
                  <button key={st} onClick={()=>setFS(active?'SEMUA':st)} className={cn('p-3 rounded-xl border-2 text-center transition-all hover:scale-[1.02]',active?'shadow-lg':'')} style={{borderColor:active?sc.bg:sc.border,backgroundColor:active?sc.bg:'transparent'}}>
                    <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{color:active?'#fff':(sc.bg==='#fff67f'||sc.bg==='#abcd05'?'#1a2e00':'#fff')}}>{st.replace('_',' ')}</div>
                    <div className="text-2xl font-black" style={{color:active?'#fff':sc.bg}}>{count}</div>
                  </button>
                );})}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]"><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" value={searchBank} onChange={e=>setSB(e.target.value)} placeholder="Cari kebijakan..." className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"/>{searchBank&&<button onClick={()=>setSB('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}</div>
                <select value={fPilar} onChange={e=>setFP(e.target.value)} className="text-sm px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer"><option value="SEMUA">Semua Pilar</option>{allPilars.map(p=><option key={p} value={p}>{p}</option>)}</select>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button onClick={()=>setModal({mode:'add'})} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm"><Plus size={12}/> Tambah</button>
                  <button onClick={refresh} className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg" title="Refresh"><RefreshCw size={12} className="text-slate-600 dark:text-slate-300"/></button>
                </div>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">{filteredBank.length} kebijakan</span>
              {filteredBank.length===0?<div className="py-12 text-center text-slate-400 text-sm">Tidak ada kebijakan</div>:(
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0"><tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"><th className="px-3 py-3 text-left w-28">Status · P</th><th className="px-3 py-3 text-left w-28">Pilar</th><th className="px-4 py-3 text-left">Kebijakan</th><th className="px-3 py-3 text-center w-16">Ind.</th><th className="px-3 py-3 text-center w-20">Aksi</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredBank.map((item,i)=>{const sc=STATUS_COLORS[item.status];const pc=getPilarColor(item.pilar);const isExp=expandedRow===item.id;return(
                        <React.Fragment key={item.id}>
                          <tr className={cn('cursor-pointer transition-colors',i%2===0?'bg-white dark:bg-slate-800':'bg-slate-50/40 dark:bg-slate-800/60',isExp&&'bg-indigo-50/50 dark:bg-indigo-900/10','hover:bg-slate-50 dark:hover:bg-slate-700/40')} onClick={()=>setExp(isExp?null:item.id)}>
                            <td className="px-3 py-2.5"><div className="flex flex-col gap-1"><span className="text-xs font-black px-2 py-0.5 rounded text-white w-fit" style={{backgroundColor:sc?.bg||'#94a3b8',color:(sc?.bg==='#fff67f'||sc?.bg==='#abcd05')?'#1a2e00':'#fff'}}>{(item.status||'').replace('_',' ')}</span><span className="text-xs font-bold text-slate-500 dark:text-slate-400">P{item.prioritas}</span></div></td>
                            <td className="px-3 py-2.5"><span className="text-xs font-semibold" style={{color:pc}}>{item.pilar}</span></td>
                            <td className="px-4 py-2.5"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{item.kebijakan}</p>{item.isu_strategis&&<p className="text-xs text-slate-400 dark:text-slate-500 italic mt-0.5 line-clamp-1">{item.isu_strategis}</p>}</td>
                            <td className="px-3 py-2.5 text-center"><span className="text-xs font-bold px-1.5 py-0.5 rounded border" style={{borderColor:pc+'40',color:pc,backgroundColor:pc+'10'}}>{item.indikator}</span></td>
                            <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-center gap-1"><button onClick={()=>setModal({mode:'edit',data:{id:item.id,status:item.status,prioritas:item.prioritas,pilar_kebijakan:item.pilar,isu_strategis:item.isu_strategis||'',kebijakan:item.kebijakan,rekomendasi_program:item.rekomendasi,indikator_terkait:item.indikator}})} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Pencil size={11} className="text-blue-500"/></button><button onClick={()=>handleDelete(item.id)} disabled={deletingId===item.id} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50">{deletingId===item.id?<Loader2 size={11} className="text-red-400 animate-spin"/>:<Trash2 size={11} className="text-red-400"/>}</button></div></td>
                          </tr>
                          {isExp&&<tr className="bg-indigo-50/30 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800/30"><td colSpan={5} className="px-4 py-3"><div className="flex items-start gap-2.5"><ChevronRight size={13} className="text-indigo-400 flex-shrink-0 mt-0.5"/><div><p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">Rekomendasi Program:</p><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.rekomendasi}</p></div></div></td></tr>}
                        </React.Fragment>
                      );})}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subTab==='provinsi'&&(
        <div className="space-y-4">
          {!hasilAnalisis?<div className="py-16 text-center"><ClipboardList size={34} className="text-slate-300 mx-auto mb-3"/><p className="text-slate-500">Jalankan analisis peta terlebih dahulu.</p></div>:(
            <>
              {!analysisId&&<div className="flex items-start gap-2.5 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-200 dark:border-sky-700"><AlertCircle size={13} className="text-sky-500 flex-shrink-0 mt-0.5"/><p className="text-sm text-sky-700 dark:text-sky-300">Simpan analisis terlebih dahulu agar perubahan tersimpan permanen.</p></div>}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]"><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" value={searchProv} onChange={e=>setSP(e.target.value)} placeholder="Cari provinsi..." className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100"/>{searchProv&&<button onClick={()=>setSP('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}</div>
                <select value={kategoriTerpilih} onChange={e=>setKategoriTerpilih(e.target.value)} className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer"><option value="SEMUA">SEMUA</option>{[...STATUS_LIST,'TIDAK_TERANALISIS'].map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}</select>
                <span className="text-sm text-slate-400 dark:text-slate-500">{dataTerfilter.length} provinsi</span>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-700"><tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"><th className="px-4 py-3 text-left">Provinsi</th><th className="px-3 py-3 text-center">ISDM</th><th className="px-3 py-3 text-center">Kategori</th><th className="px-3 py-3 text-center">Sumber</th><th className="px-3 py-3 text-center w-24">Kelola</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {dataTerfilter.map((fitur,idx)=>{const d=fitur.properties.sdm_analysis;const w=getWarna(fitur,indikatorTerpilih);const kat=getKategori(fitur,indikatorTerpilih);const isTA=kat==='TIDAK_TERANALISIS';const isDark=['#fff67f','#abcd05'].includes(w);const kp=d.kolom_prediksi||[];const isPredOrMixed=d.sumber==='prediksi'||d.sumber==='campuran';return(
                      <tr key={d.nama_provinsi} className={cn('hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',idx%2===0?'bg-white dark:bg-slate-800':'bg-slate-50/40 dark:bg-slate-800/60')}>
                        <td className="px-4 py-3"><div className="flex items-center gap-2 flex-wrap"><div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:w,border:isDark?'1px solid rgba(0,0,0,0.2)':''}}/><span className="font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>{d.rekomendasi_edited&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">✎ Edit</span>}</div></td>
                        <td className="px-3 py-3 text-center font-bold font-mono text-slate-800 dark:text-slate-100">{d.indeks_sdm??'—'}</td>
                        <td className="px-3 py-3 text-center"><StatusBadge status={kat}/></td>
                        <td className="px-3 py-3 text-center">{isTA?<span className="text-xs text-slate-400 dark:text-slate-500 italic">—</span>:isPredOrMixed?<ProyeksiBadge size="xs" kolomProyeksi={kp}/>:<span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"><CheckCircle2 size={9}/> Aktual</span>}</td>
                        <td className="px-3 py-3 text-center">{!isTA&&<button onClick={()=>setPP(d.nama_provinsi)} className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-semibold mx-auto"><Pencil size={10}/> Kelola</button>}</td>
                      </tr>
                    );})}
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


// ─── MODAL KEBIJAKAN ──────────────────────────────────────────────────────────
function ModalKebijakan({ mode,data,onClose,onSaved }) {
  const [form,setForm]=useState(mode==='edit'?{...data}:{...EMPTY_FORM});
  const [saving,setSaving]=useState(false);
  const [errors,setErrors]=useState({});
  const validate=()=>{const e={};if(!form.kebijakan?.trim())e.kebijakan='Wajib';if(!form.rekomendasi_program?.trim())e.rekomendasi_program='Wajib';if(!form.isu_strategis?.trim())e.isu_strategis='Wajib';return e;};
  const handleSave=async()=>{const e=validate();if(Object.keys(e).length){setErrors(e);return;}setSaving(true);try{if(mode==='edit')await axios.put(`${API_BASE}/bank-kebijakan-sdm/${data.id}/update/`,form);else await axios.post(`${API_BASE}/bank-kebijakan-sdm/add/`,form);onSaved();onClose();}catch(err){alert(err.response?.data?.error||'Gagal');}finally{setSaving(false);}};
  const Field=({label,name,type='text',options,required})=>(<div><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}{required&&<span className="text-red-500 ml-0.5">*</span>}</label>{type==='select'?(<select value={form[name]} onChange={e=>setForm(p=>({...p,[name]:e.target.value}))} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-500 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500">{options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}</select>):type==='textarea'?(<textarea rows={3} value={form[name]} onChange={e=>setForm(p=>({...p,[name]:e.target.value}))} className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 resize-none',errors[name]?'border-red-400':'border-slate-200 dark:border-slate-500')}/>):(<input type="text" value={form[name]} onChange={e=>setForm(p=>({...p,[name]:e.target.value}))} className={cn('w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500',errors[name]?'border-red-400':'border-slate-200 dark:border-slate-500')}/>)}{errors[name]&&<p className="text-xs text-red-500 mt-1">{errors[name]}</p>}</div>);
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">{mode==='edit'?<Pencil size={13} className="text-indigo-600"/>:<Plus size={13} className="text-indigo-600"/>}</div><h3 className="text-base font-bold text-slate-900 dark:text-white">{mode==='edit'?'Edit':'Tambah'} Kebijakan</h3></div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={15} className="text-slate-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4"><Field label="Status" name="status" type="select" options={STATUS_LIST.map(s=>({value:s,label:s.replace('_',' ')}))} /><Field label="Prioritas" name="prioritas" type="select" options={[1,2,3,4,5,6,7].map(p=>({value:p,label:`P${p}`}))} /></div>
          <div className="grid grid-cols-2 gap-4"><Field label="Pilar" name="pilar_kebijakan" type="select" options={PILAR_LIST} /><Field label="Indikator" name="indikator_terkait" type="select" options={INDIKATOR_TERKAIT_LIST} /></div>
          <Field label="Isu Strategis" name="isu_strategis" required/><Field label="Kebijakan" name="kebijakan" type="textarea" required/><Field label="Rekomendasi Program" name="rekomendasi_program" type="textarea" required/>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Batal</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">{saving?<Loader2 size={13} className="animate-spin"/>:<Save size={13}/>}{saving?'Menyimpan...':mode==='edit'?'Simpan':'Tambah'}</button>
        </div>
      </div>
    </div>
  );
}


// ─── TAB METODOLOGI ───────────────────────────────────────────────────────────

// Komponen formula matematika — menampilkan ekspresi dengan fraction yang proper
function MathFrac({ num, den, className='' }) {
  return (
    <span className={cn('inline-flex flex-col items-center align-middle mx-0.5', className)}>
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

function MetSection({ accentColor,title,sub,defaultOpen=false,children }) {
  const [open,setOpen]=useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
      <button type="button" onClick={()=>setOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-left">
        <div className="flex items-center gap-3"><div className="w-1 h-5 rounded-full flex-shrink-0" style={{backgroundColor:accentColor}}/><div><div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>{sub&&<div className="text-xs text-slate-400 mt-0.5">{sub}</div>}</div></div>
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform flex-shrink-0',open&&'rotate-180')}/>
      </button>
      {open&&<div className="border-t border-slate-100 dark:border-slate-700 px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

// ─── TAB Metodologi ─────────────────────────────────────────────────────────────────
function TabMetodologi() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0"><BookOpen size={16} className="text-indigo-600 dark:text-indigo-400"/></div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metodologi ISDM — IPM BPS Metode Baru</h2>
          <p className="text-sm text-slate-400 mt-0.5">Rata-rata Geometrik · 3 Dimensi · Mengacu BPS & UNDP</p>
        </div>
      </div>

      {/* FORMULA PER DIMENSI */}
      <MetSection accentColor="#6366f1" title="Formula per Dimensi" sub="Rumus resmi IPM BPS — ditulis secara matematis" defaultOpen>
        <div className="space-y-5">

          {/* Dimensi Kesehatan */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0"/>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Kesehatan — Indeks Kesehatan (IK)</p>
            </div>
            <MathBlock>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">IK</span>
                <span className="mx-1">=</span>
                <MathFrac num="AHH − 20" den="85 − 20"/>
              </div>
            </MathBlock>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                ['AHH_min','20 tahun','Batas bawah biologis bertahan hidup (BPS/UNDP)'],
                ['AHH_maks','85 tahun','Target tertinggi capaian global (BPS/UNDP)'],
              ].map(([p,v,d])=>(
                <div key={p} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                  <div className="text-[10px] text-slate-400 font-mono mb-0.5">{p}</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{v}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-snug">{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dimensi Pendidikan */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"/>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Pengetahuan — Indeks Pendidikan (IP)</p>
            </div>
            <MathBlock>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-blue-600 dark:text-blue-400">IP</span>
                <span className="mx-1">=</span>
                <MathFrac
                  num={
                    <span className="flex items-center gap-1 px-0.5">
                      <MathFrac num="HLS" den="18"/>
                      <span>+</span>
                      <MathFrac num="RLS" den="15"/>
                    </span>
                  }
                  den="2"
                />
              </div>
            </MathBlock>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                ['HLS_maks','18 tahun','Setara harapan menempuh pendidikan hingga Pascasarjana (S2)'],
                ['RLS_maks','15 tahun','Mencerminkan rata-rata penduduk lulus pendidikan tinggi (D3)'],
                ['Nilai Min','0 tahun','Kondisi ekstrim tidak memiliki akses pendidikan formal'],
              ].map(([p,v,d])=>(
                <div key={p} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                  <div className="text-[10px] text-slate-400 font-mono mb-0.5">{p}</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{v}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-snug">{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dimensi Pengeluaran */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0"/>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Standar Hidup Layak — Indeks Pengeluaran (IPeng)</p>
            </div>
            <MathBlock>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-amber-600 dark:text-amber-400">IPeng</span>
                <span className="mx-1">=</span>
                <MathFrac
                  num={<span className="px-0.5">ln(Peng) − ln(1.007.436)</span>}
                  den={<span className="px-0.5">ln(26.572.352) − ln(1.007.436)</span>}
                />
              </div>
            </MathBlock>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['Peng_min','Rp 1.007.436','Garis kemiskinan terendah kabupaten (Tolikara, 2010)'],
                ['Peng_maks','Rp 26.572.352','Proyeksi pengeluaran tertinggi kabupaten (Jak-Sel s/d 2025)'],
              ].map(([p,v,d])=>(
                <div key={p} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                  <div className="text-[10px] text-slate-400 font-mono mb-0.5">{p}</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{v}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-snug">{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ISDM Final */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0"/>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Indeks SDM (ISDM) — Rata-rata Geometrik</p>
            </div>
            <MathBlock className="border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-base">ISDM</span>
                <span className="text-base">=</span>
                {/* Akar pangkat 3 dengan notasi teks yang jelas */}
                <span className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold self-start mt-0.5">3</span>
                  <span className="text-base">√</span>
                  <span className="border-t-2 border-slate-700 dark:border-slate-300 px-1">
                    IK × IP × IPeng
                  </span>
                </span>
                <span className="text-base mx-1">×</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-base">100</span>
              </div>
            </MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Ketiga indeks (IK, IP, IPeng) masing-masing bernilai antara 0 dan 1. Hasil akar kubik dikali 100 menghasilkan skor ISDM dengan rentang <strong className="text-slate-700 dark:text-slate-200">0 – 100</strong>, di mana <strong className="text-slate-700 dark:text-slate-200">100 adalah kondisi terbaik</strong>.
            </p>
          </div>
        </div>
      </MetSection>

      {/* KLASIFIKASI */}
      <MetSection accentColor="#10b981" title="Klasifikasi Status" sub="Standar BPS — 4 kelas berdasarkan ambang batas IPM" defaultOpen>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            {l:'SANGAT TINGGI', r:'≥ 80', bg:'#008cd6', tc:'#fff'},
            {l:'TINGGI',        r:'70 ≤ x < 80', bg:'#abcd05', tc:'#1a2e00'},
            {l:'SEDANG',        r:'60 ≤ x < 70', bg:'#fff67f', tc:'#92400e'},
            {l:'RENDAH',        r:'< 60',         bg:'#af4284', tc:'#fff'},
          ].map(s=>(
            <div key={s.l} className="rounded-xl p-3 text-center" style={{backgroundColor:s.bg,color:s.tc}}>
              <div className="text-[10px] font-black uppercase mb-1">{s.l}</div>
              <div className="text-sm font-mono font-bold">{s.r}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:'#a6a6a6'}}/>
          <span>TIDAK TERANALISIS — data tidak tersedia di database (aktual maupun proyeksi)</span>
        </div>
      </MetSection>

      {/* JUSTIFIKASI */}
      <MetSection accentColor="#8b5cf6" title="Justifikasi Metodologi" sub="Mengapa menggunakan IPM BPS Metode Baru?">
        <div className="space-y-3">
          {[
            {
              icon:'📐',
              title:'Rata-rata Geometrik (Non-kompensatif)',
              desc:'Berbeda dengan metode lama (aritmatik), metode ini memastikan dimensi yang rendah tidak bisa ditutupi oleh dimensi yang tinggi. Hal ini memaksa kebijakan pembangunan manusia yang seimbang di semua sektor — dimensi kesehatan, pendidikan, dan daya beli harus tumbuh bersama.',
            },
            {
              icon:'📈',
              title:'Fungsi Logaritma Natural (ln) untuk Pengeluaran',
              desc:'Digunakan pada pengeluaran karena nilai manfaat dari pendapatan cenderung menurun seiring bertambahnya kekayaan (marginal utility). Logaritma membuat indikator lebih sensitif terhadap perubahan daya beli masyarakat bawah serta mengoreksi distribusi data yang menceng (skewed right).',
            },
            {
              icon:'🏛️',
              title:'Legalitas DAU & Standar Resmi',
              desc:'IPM merupakan variabel resmi yang digunakan pemerintah pusat dalam penghitungan Dana Alokasi Umum (DAU) untuk daerah, sehingga kepatuhan terhadap rumus BPS bersifat wajib secara administratif. Metodologi ini juga selaras dengan UNDP Human Development Index secara internasional.',
            },
          ].map((item,i)=>(
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </MetSection>

      {/* SUMBER DATA */}
      <MetSection accentColor="#14b8a6" title="Sumber Data & Link BPS" sub="Dataset resmi yang digunakan">
        <div className="space-y-2.5">
          {[
            {col:'ahh',        nama:'Angka Harapan Hidup (AHH)',              satuan:'Tahun',           k:'IK',    kCls:'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', link:'https://www.bps.go.id/id/statistics-table/2/NDE0IzI=/-metode-baru--umur-harapan-hidup-saat-lahir--uhh-.html'},
            {col:'rls',        nama:'Rata-rata Lama Sekolah (RLS)',           satuan:'Tahun',           k:'IP',    kCls:'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',           link:'https://www.bps.go.id/id/statistics-table/2/NDE1IzI=/-metode-baru--rata-rata-lama-sekolah--tahun-.html'},
            {col:'hls',        nama:'Harapan Lama Sekolah (HLS)',             satuan:'Tahun',           k:'IP',    kCls:'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',           link:'https://www.bps.go.id/id/statistics-table/2/NDE3IzI=/-metode-baru--harapan-lama-sekolah--tahun-.html'},
            {col:'pengeluaran',nama:'Pengeluaran per Kapita Disesuaikan',     satuan:'Ribu Rp/kap/thn', k:'IPeng', kCls:'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',       link:'https://www.bps.go.id/assets/statistics-table/2/NDE2IzI=/-metode-baru--pengeluaran-per-kapita-disesuaikan.html'},
          ].map(d=>(
            <div key={d.col} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono flex-shrink-0">{d.col}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{d.satuan}</p>
              </div>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0',d.kCls)}>{d.k}</span>
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

      {/* CATATAN PROYEKSI — REGRESI LINEAR OLS */}
      <MetSection accentColor="#f59e0b" title="Catatan Proyeksi Data — Regresi Linear OLS" sub="Digunakan sebagai fallback jika data aktual tidak tersedia">
        <div className="space-y-4">

          {/* Penjelasan utama */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 flex items-start gap-3">
            <TrendingDown size={20} className="text-indigo-500 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Apa itu Regresi Linear OLS?</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Regresi Linear (Ordinary Least Squares) adalah metode statistik untuk mencari hubungan antara variabel waktu (tahun) dengan nilai data. Metode ini bekerja dengan menarik satu <strong>garis lurus paling optimal (best-fit line)</strong> di antara titik-data historis yang ada, lalu memperpanjang garis tersebut ke masa depan untuk membaca arah trennya — apakah cenderung naik, turun, atau stabil.
              </p>
            </div>
          </div>

          {/* Persamaan */}
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Persamaan Regresi Linear</p>
            <MathBlock>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">ŷ</span>
                <span>=</span>
                <span className="text-slate-700 dark:text-slate-200">β₀</span>
                <span>+</span>
                <span className="text-slate-700 dark:text-slate-200">β₁ · x</span>
              </div>
            </MathBlock>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                ['ŷ','Nilai proyeksi (AHH / RLS / HLS / Pengeluaran)'],
                ['x','Variabel tahun (2010, 2011, ..., 2045)'],
                ['β₀','Konstanta intercept (titik potong garis dengan sumbu-y)'],
                ['β₁','Koefisien slope (laju perubahan nilai per tahun)'],
              ].map(([v,d])=>(
                <div key={v} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm flex-shrink-0 w-6">{v}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alasan pemilihan */}
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Alasan Pemilihan Metode</p>
            <div className="space-y-2">
              {[
                {
                  icon:'📊',
                  title:'Fokus Tren Jangka Panjang',
                  desc:'Sangat stabil dalam memetakan arah pertumbuhan makro (tren naik/turun) hingga tahun 2045 tanpa terganggu oleh fluktuasi jangka pendek yang ekstrem.',
                },
                {
                  icon:'🛡️',
                  title:'Adaptasi Data Terbatas',
                  desc:'Pendekatan statistik paling aman untuk mencegah overfitting (kesalahan prediksi akibat model terlalu sensitif) pada data historis yang memiliki keterbatasan jumlah sampel tahunan.',
                },
              ].map((r,i)=>(
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                  <span className="text-lg flex-shrink-0">{r.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 mb-0.5">{r.title}</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spesifikasi teknis */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {l:'Metode',        v:'Linear OLS'},
              {l:'Data Training', v:'2010–2024 (15 titik)'},
              {l:'Wilayah',       v:'34 Provinsi'},
              {l:'Tahun Proyeksi',v:'2025–2045'},
            ].map(item=>(
              <div key={item.l} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">{item.l}</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.v}</div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1.5">Keterbatasan Model (Disclaimer)</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  Proyeksi ini merupakan <strong>estimasi matematis murni</strong> berdasarkan tren masa lalu dengan asumsi kondisi berjalan konstan (<em>ceteris paribus</em>). Model ini <strong>tidak memperhitungkan</strong> anomali faktor eksternal di masa depan seperti:
                </p>
                <ul className="mt-2 space-y-1">
                  {[
                    'Bencana alam / perubahan iklim ekstrem',
                    'Perubahan kebijakan tata ruang (alih fungsi lahan)',
                    'Dinamika ekonomi global',
                    'Lompatan teknologi yang masif',
                  ].map((item,i)=>(
                    <li key={i} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0"/>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Sistem selalu mencoba mengambil data dari (aktual BPS) terlebih dahulu. Jika kolom tertentu tidak tersedia, baru mengambil dari tabel proyeksi sebagai fallback . Kolom yang menggunakan proyeksi ditandai dengan <span className="font-bold text-amber-600">⚠️ Proyeksi Regresi Linear</span>.
          </p>
        </div>
      </MetSection>
    </div>
  );
}


// ─── TAB TREN ─────────────────────────────────────────────────────────────────
function TabTren({ daftarTersimpan }) {
  const [filterInd,setFI]=useState('ALL');
  const [chartMode,setCM]=useState('distribusi');
  const trendData=useMemo(()=>{
    const map={};
    daftarTersimpan.forEach(item=>{const ind=item.indikator||'ALL';const key=`${item.tahun}|${ind}`;if(!map[key]||item.timestamp>map[key].timestamp)map[key]=item;});
    const byInd={};
    Object.values(map).forEach(item=>{const ind=item.indikator||'ALL';if(!byInd[ind])byInd[ind]=[];byInd[ind].push({tahun:item.tahun,SANGAT_TINGGI:item.kategori_distribusi?.SANGAT_TINGGI??0,TINGGI:item.kategori_distribusi?.TINGGI??0,SEDANG:item.kategori_distribusi?.SEDANG??0,RENDAH:item.kategori_distribusi?.RENDAH??0,TIDAK_TERANALISIS:item.kategori_distribusi?.TIDAK_TERANALISIS??0,adaProyeksi:item.ada_prediksi||false});});
    Object.keys(byInd).forEach(ind=>byInd[ind].sort((a,b)=>a.tahun-b.tahun));
    return byInd;
  },[daftarTersimpan]);

  const chartData=trendData[filterInd]||[];
  const indsAvailable=Object.keys(trendData).filter(k=>trendData[k].length>0);
  const tahunCovered=[...new Set(daftarTersimpan.map(d=>d.tahun).filter(Boolean))].sort();
  const latestData=chartData[chartData.length-1];

  if(!daftarTersimpan.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4"><TrendingUp size={26} className="text-indigo-400"/></div>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Belum ada data tersimpan</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><TrendingUp className="text-indigo-500" size={20}/><div><h3 className="text-base font-bold text-slate-900 dark:text-white">Panel Tren ISDM</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{daftarTersimpan.length} analisis · {tahunCovered.length} tahun</p></div></div>
      <div className="grid grid-cols-5 gap-3">
        {[
          {label:'Total',        val:daftarTersimpan.length, cls:'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700', valCls:'text-indigo-700 dark:text-indigo-300'},
          {label:'Sangat Tinggi',val:latestData?.SANGAT_TINGGI??'-', cls:'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700', valCls:'text-sky-700 dark:text-sky-300'},
          {label:'Tinggi',       val:latestData?.TINGGI??'-',        cls:'bg-lime-50 dark:bg-lime-900/30 border-lime-200 dark:border-lime-700', valCls:'text-lime-700 dark:text-lime-300'},
          {label:'Sedang',       val:latestData?.SEDANG??'-',        cls:'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700', valCls:'text-yellow-700 dark:text-yellow-300'},
          {label:'Rendah',       val:latestData?.RENDAH??'-',        cls:'bg-fuchsia-50 dark:bg-fuchsia-900/30 border-fuchsia-200 dark:border-fuchsia-700', valCls:'text-fuchsia-700 dark:text-fuchsia-300'},
        ].map(c=>(
          <div key={c.label} className={cn('rounded-xl p-3 border',c.cls)}><div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{c.label}</div><div className={cn('text-2xl font-black',c.valCls)}>{c.val}</div></div>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {['ALL','KESEHATAN','PENDIDIKAN','PENGELUARAN'].map(ind=>{const ada=indsAvailable.includes(ind);return(
            <button key={ind} onClick={()=>ada&&setFI(ind)} className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1',filterInd===ind?'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white':ada?'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200':'text-slate-300 dark:text-slate-600 cursor-not-allowed')}>
              <span style={{color:filterInd===ind?INDIKATOR_COLORS_SDM[ind]:undefined}}>{INDIKATOR_ICON_SDM[ind]}</span>
              {ind==='ALL'?'Semua':INDIKATOR_LABELS_SDM[ind]?.replace('Indeks ','')}
            </button>
          );})}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 ml-auto">
          {[['distribusi','Bar'],['area','Area']].map(([key,lbl])=>(
            <button key={key} onClick={()=>setCM(key)} className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold',chartMode===key?'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400':'text-slate-500 dark:text-slate-400')}>{lbl}</button>
          ))}
        </div>
      </div>
      {chartData.length===0?<div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data</div>:(
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{INDIKATOR_LABELS_SDM[filterInd]} · {chartData.length} titik</div>
            {chartData.some(d=>d.adaProyeksi)&&<span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle size={10}/> Beberapa titik mengandung data proyeksi</span>}
          </div>
          {chartMode==='distribusi'&&(
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{top:4,right:8,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5}/>
                <XAxis dataKey="tahun" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="SANGAT_TINGGI" name="Sangat Tinggi" stackId="a" fill="#008cd6"/>
                <Bar dataKey="TINGGI"        name="Tinggi"        stackId="a" fill="#abcd05"/>
                <Bar dataKey="SEDANG"        name="Sedang"        stackId="a" fill="#fff67f"/>
                <Bar dataKey="RENDAH"        name="Rendah"        stackId="a" fill="#af4284" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartMode==='area'&&(
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{top:4,right:8,left:-20,bottom:0}}>
                <defs>{[['gST','#008cd6'],['gT','#abcd05'],['gS','#fff67f'],['gR','#af4284']].map(([id,clr])=><linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={clr} stopOpacity={0.3}/><stop offset="95%" stopColor={clr} stopOpacity={0}/></linearGradient>)}</defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5}/>
                <XAxis dataKey="tahun" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                {[['SANGAT_TINGGI','#008cd6','gST'],['TINGGI','#abcd05','gT'],['SEDANG','#fff67f','gS'],['RENDAH','#af4284','gR']].map(([key,clr,grad])=>(
                  <Area key={key} type="monotone" dataKey={key} name={key.replace('_',' ')} stroke={clr} strokeWidth={2} fill={`url(#${grad})`} dot={{r:3,fill:clr}}/>
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cakupan Tahun Tersimpan</div>
        <div className="flex flex-wrap gap-1.5">
          {TAHUN_TERSEDIA_SDM.map(thn=>{const ada=tahunCovered.includes(thn);const mungkinProyeksi=thn>2024;return(
            <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border',ada?(mungkinProyeksi?'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300':'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'):'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500')}>
              {thn}{ada&&' ✓'}
            </div>
          );})}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700"/><span>Aktual BPS</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700"/><span>Hasil Prediksi Regresi Linear OLS</span></div>
        </div>
      </div>
    </div>
  );
}


// ─── MAIN TABS WRAPPER ─────────────────────────────────────────────────────────
export default function TabsSDM({
  activeTab,setActiveTab,hasilAnalisis,jumlahKategori,
  indikatorTerpilih,kategoriTerpilih,setKategoriTerpilih,
  tahunTerpilih,daftarTersimpan,eksporData,getWarna,getKategori,analysisId,
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
        {TABS.map(({id,label,Icon})=>{const active=activeTab===id;return(
          <button key={id} onClick={()=>setActiveTab(id)} className={cn('flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold transition-all relative flex-1 whitespace-nowrap',active?'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20':'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30')}>
            <Icon size={14}/><span className="hidden sm:inline">{label}</span>
            {active&&<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full"/>}
          </button>
        );})}
      </div>
      <div className="p-5">
        {activeTab==='info'      && <TabInfo hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} eksporData={eksporData} getWarna={getWarna} getKategori={getKategori}/>}
        {activeTab==='kebijakan' && <TabKebijakan hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} getWarna={getWarna} getKategori={getKategori} analysisId={analysisId}/>}
        {activeTab==='metadata'  && <TabMetodologi/>}
        {activeTab==='tren'      && <TabTren daftarTersimpan={daftarTersimpan}/>}
      </div>
    </div>
  );
}