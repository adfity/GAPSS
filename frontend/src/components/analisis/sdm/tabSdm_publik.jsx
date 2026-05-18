"use client";
// ─── TABS SDM — PUBLIK (Read-Only) ───────────────────────────────────────────
// Tab Info      : tabel hasil + unduh (Excel/CSV saja)
// Tab Metodologi: penjelasan lengkap rumus IPM BPS
// Tab Tren      : grafik distribusi dari data tersimpan
// Tidak ada Tab Kebijakan.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import {
  Download, Info, BookOpen, TrendingUp, ChevronDown,
  BarChart2, AlertTriangle, CheckCircle2, ExternalLink,
  X, Search, Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  INDIKATOR_LABELS_SDM, INDIKATOR_COLORS_SDM, INDIKATOR_ICON_SDM,
  TAHUN_TERSEDIA_SDM,
} from './petaSdm';

const cn = (...cls) => cls.filter(Boolean).join(' ');

const TABS = [
  { id:'info',      label:'Data & Tabel', Icon:BarChart2 },
  { id:'metadata',  label:'Metodologi',   Icon:BookOpen  },
  { id:'tren',      label:'Tren',         Icon:TrendingUp },
];

const STATUS_COLORS = {
  SANGAT_TINGGI:    { badge:'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  TINGGI:           { badge:'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300' },
  SEDANG:           { badge:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  RENDAH:           { badge:'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
  TIDAK_TERANALISIS:{ badge:'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

// ─── MATEMATIKA ───────────────────────────────────────────────────────────────
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

// ─── TAB INFO ─────────────────────────────────────────────────────────────────
function TabInfo({ hasilAnalisis, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, getWarna, getKategori }) {
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [search,    setSearch]    = useState('');

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    if (search.trim()) f = f.filter(x => (x.properties?.sdm_analysis?.nama_provinsi||'').toLowerCase().includes(search.toLowerCase()));
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih, search, getKategori]);

  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:nama });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return;
    const r   = hasilAnalisis.analysis_summary || [];
    const thn = hasilAnalisis.tahun;
    const ind = hasilAnalisis.indikator || 'ALL';
    const tgl = new Date().toISOString().split('T')[0];
    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi:''+i.provinsi, Kategori:i.kategori_label||i.kategori,
        'ISDM (0-100)':i.indeks_sdm,
        'AHH':i.uhh||'-','RLS':i.rls||'-','HLS':i.hls||'-',
        'Pengeluaran (Rb Rp)':i.pengeluaran||'-', Sumber:i.sumber||'-',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ISDM');
      XLSX.writeFile(wb, `ISDM_${ind}_${thn}_${tgl}.xlsx`);
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi','Kategori','ISDM','AHH','RLS','HLS','Pengeluaran','Sumber'].join(','),
        ...r.map(s => [s.provinsi,s.kategori_label||s.kategori,s.indeks_sdm,s.uhh||'-',s.rls||'-',s.hls||'-',s.pengeluaran||'-',s.sumber||'-'].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv],{type:'text/csv'}),`ISDM_${ind}_${thn}_${tgl}.csv`);
    }
    setMenuUnduh(false);
  };

  if (!hasilAnalisis) return (
    <div className="py-16 text-center">
      <BarChart2 size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-slate-500 dark:text-slate-400">Pilih tahun dan indikator untuk melihat data.</p>
    </div>
  );

  const adaProyeksi = hasilAnalisis.ada_prediksi;
  const dist = hasilAnalisis.kategori_distribusi || {};

  return (
    <div className="space-y-4">
      {adaProyeksi && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            Sebagian data menggunakan <strong>proyeksi Regresi Linear OLS</strong> (bukan data resmi BPS). Ditandai dengan *.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label:'Teranalisis',   val:hasilAnalisis.total_success||0,  cls:'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200', valCls:'text-indigo-700 dark:text-indigo-300' },
          { label:'Sangat Tinggi', val:dist.SANGAT_TINGGI??0,           cls:'bg-sky-50 dark:bg-sky-900/30 border-sky-200',          valCls:'text-sky-700 dark:text-sky-300' },
          { label:'Tinggi',        val:dist.TINGGI??0,                  cls:'bg-lime-50 dark:bg-lime-900/30 border-lime-200',       valCls:'text-lime-700 dark:text-lime-300' },
          { label:'Sedang',        val:dist.SEDANG??0,                  cls:'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200', valCls:'text-yellow-700 dark:text-yellow-300' },
          { label:'Rendah',        val:dist.RENDAH??0,                  cls:'bg-fuchsia-50 dark:bg-fuchsia-900/30 border-fuchsia-200', valCls:'text-fuchsia-700 dark:text-fuchsia-300' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filter + unduh */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari provinsi..."
            className="w-full pl-8 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"/>
          {search && <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400"/></button>}
        </div>
        <select value={kategoriTerpilih} onChange={e=>setKategoriTerpilih(e.target.value)}
          className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
          <option value="SEMUA">SEMUA</option>
          {['SANGAT_TINGGI','TINGGI','SEDANG','RENDAH','TIDAK_TERANALISIS'].map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}
        </select>
        <span className="text-sm text-slate-400">{dataTerfilter.length} provinsi</span>
        <div className="relative ml-auto">
          <button onClick={()=>setMenuUnduh(!menuUnduh)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm">
            <Download size={13}/> Unduh
          </button>
          {menuUnduh && (
            <div className="absolute top-full mt-1 right-0 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-600 py-1">
              {['EXCEL','CSV'].map(fmt=>(
                <button key={fmt} onClick={()=>eksporData(fmt)}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                  <Download size={11} className="text-indigo-500"/> {fmt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
            <tr className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <th className="px-3 py-3 text-center w-10">No</th>
              <th className="px-4 py-3 text-left">Provinsi</th>
              <th className="px-4 py-3 text-center">ISDM</th>
              <th className="px-4 py-3 text-center">AHH</th>
              <th className="px-4 py-3 text-center">RLS</th>
              <th className="px-4 py-3 text-center">HLS</th>
              <th className="px-4 py-3 text-center">Pengeluaran</th>
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
              const sc = STATUS_COLORS[kat];
              return (
                <tr key={d.nama_provinsi}
                  className={cn('hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors',
                    idx%2===0?'bg-white dark:bg-slate-800':'bg-slate-50/60 dark:bg-slate-800/60')}>
                  <td className="px-3 py-3 text-center text-xs font-medium text-slate-400">{idx+1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:w,border:isDark?'1px solid rgba(0,0,0,0.2)':''}}/>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isTA ? <span className="text-xs text-slate-400 italic">—</span>
                    : <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_sdm??'—'}</span>}
                  </td>
                  <td className={cn('px-4 py-3 text-center text-sm',kp.includes('UHH')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                    {dc.UHH??'—'}{kp.includes('UHH')&&<span className="ml-0.5 text-[9px]">*</span>}
                  </td>
                  <td className={cn('px-4 py-3 text-center text-sm',kp.includes('RLS')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                    {dc.RLS??'—'}{kp.includes('RLS')&&<span className="ml-0.5 text-[9px]">*</span>}
                  </td>
                  <td className={cn('px-4 py-3 text-center text-sm',kp.includes('HLS')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                    {dc.HLS??'—'}{kp.includes('HLS')&&<span className="ml-0.5 text-[9px]">*</span>}
                  </td>
                  <td className={cn('px-4 py-3 text-center text-sm',kp.includes('PENGELUARAN')?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-700 dark:text-slate-300')}>
                    {dc.PENGELUARAN?dc.PENGELUARAN.toLocaleString('id-ID'):'—'}{kp.includes('PENGELUARAN')&&<span className="ml-0.5 text-[9px]">*</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold', sc?.badge||'bg-slate-100 text-slate-500')}>
                      {(d.kategori_label||d.kategori||'—').replace('_',' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isTA ? <span className="text-xs text-slate-400 italic">—</span>
                    : isPredOrMixed
                    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200">
                        <AlertTriangle size={8}/> Proyeksi OLS
                      </span>
                    : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                        <CheckCircle2 size={8}/> Aktual
                      </span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {adaProyeksi && (
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle size={9}/> * = data proyeksi Regresi Linear OLS (bukan data resmi BPS)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB METODOLOGI ───────────────────────────────────────────────────────────
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
          {/* IK */}
          <div>
            <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Kesehatan — IK</p></div>
            <MathBlock><div className="flex items-center gap-1 flex-wrap"><span className="font-bold text-emerald-600 dark:text-emerald-400">IK</span><span className="mx-1">=</span><MathFrac num="AHH − 20" den="85 − 20"/></div></MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">AHH min = 20 th (biologis), AHH maks = 85 th (target global BPS/UNDP)</p>
          </div>
          {/* IP */}
          <div>
            <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Pendidikan — IP</p></div>
            <MathBlock><div className="flex items-center gap-1 flex-wrap"><span className="font-bold text-blue-600 dark:text-blue-400">IP</span><span className="mx-1">=</span><MathFrac num={<span className="flex items-center gap-1 px-0.5"><MathFrac num="HLS" den="18"/><span>+</span><MathFrac num="RLS" den="15"/></span>} den="2"/></div></MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">HLS maks = 18 th (S2), RLS maks = 15 th (D3)</p>
          </div>
          {/* IPeng */}
          <div>
            <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dimensi Standar Hidup — IPeng</p></div>
            <MathBlock><div className="flex items-center gap-1 flex-wrap"><span className="font-bold text-amber-600 dark:text-amber-400">IPeng</span><span className="mx-1">=</span><MathFrac num={<span className="px-0.5">ln(Peng) − ln(1.007.436)</span>} den={<span className="px-0.5">ln(26.572.352) − ln(1.007.436)</span>}/></div></MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Min = Rp1.007.436 (Tolikara 2010), Maks = Rp26.572.352 (Jakarta Selatan 2025)</p>
          </div>
          {/* ISDM */}
          <div>
            <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0"/><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ISDM — Rata-rata Geometrik</p></div>
            <MathBlock className="border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-base">ISDM</span>
                <span>=</span>
                <span className="flex items-center gap-1"><span className="text-xs text-slate-500 font-bold self-start mt-0.5">3</span><span className="text-base">√</span><span className="border-t-2 border-slate-700 dark:border-slate-300 px-1">IK × IP × IPeng</span></span>
                <span>× 100</span>
              </div>
            </MathBlock>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Skor 0–100. Nilai 100 = kondisi terbaik.</p>
          </div>
        </div>
      </MetSection>

      <MetSection accentColor="#10b981" title="Klasifikasi Status" sub="Standar BPS — 4 kelas" defaultOpen>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[{l:'SANGAT TINGGI',r:'≥ 80',bg:'#008cd6',tc:'#fff'},{l:'TINGGI',r:'70–80',bg:'#abcd05',tc:'#1a2e00'},{l:'SEDANG',r:'60–70',bg:'#fff67f',tc:'#92400e'},{l:'RENDAH',r:'< 60',bg:'#af4284',tc:'#fff'}].map(s=>(
            <div key={s.l} className="rounded-xl p-3 text-center" style={{backgroundColor:s.bg,color:s.tc}}>
              <div className="text-[10px] font-black uppercase mb-1">{s.l}</div>
              <div className="text-sm font-mono font-bold">{s.r}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor:'#a6a6a6'}}/>
          <span>TIDAK TERANALISIS — data tidak tersedia</span>
        </div>
      </MetSection>

      <MetSection accentColor="#8b5cf6" title="Justifikasi Metodologi" sub="Mengapa rata-rata geometrik?">
        <div className="space-y-3">
          {[
            {icon:'📐',title:'Non-kompensatif',desc:'Dimensi rendah tidak bisa ditutupi dimensi tinggi. Memaksa pembangunan manusia yang seimbang di semua sektor.'},
            {icon:'📈',title:'Fungsi Logaritma Natural untuk Pengeluaran',desc:'Mengoreksi distribusi menceng (skewed right) dan lebih sensitif terhadap perubahan daya beli masyarakat bawah.'},
            {icon:'🏛️',title:'Standar Resmi DAU & UNDP',desc:'IPM digunakan dalam penghitungan Dana Alokasi Umum (DAU) dan selaras dengan Human Development Index UNDP.'},
          ].map((item,i)=>(
            <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div><p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{item.title}</p><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p></div>
            </div>
          ))}
        </div>
      </MetSection>

      <MetSection accentColor="#14b8a6" title="Sumber Data BPS" sub="Dataset resmi yang digunakan">
        <div className="space-y-2.5">
          {[
            {col:'AHH',nama:'Angka Harapan Hidup',link:'https://www.bps.go.id/id/statistics-table/2/NDE0IzI=/-metode-baru--umur-harapan-hidup-saat-lahir--uhh-.html'},
            {col:'RLS',nama:'Rata-rata Lama Sekolah',link:'https://www.bps.go.id/id/statistics-table/2/NDE1IzI=/-metode-baru--rata-rata-lama-sekolah--tahun-.html'},
            {col:'HLS',nama:'Harapan Lama Sekolah',link:'https://www.bps.go.id/id/statistics-table/2/NDE3IzI=/-metode-baru--harapan-lama-sekolah--tahun-.html'},
            {col:'Pengeluaran',nama:'Pengeluaran per Kapita Disesuaikan',link:'https://www.bps.go.id/assets/statistics-table/2/NDE2IzI=/-metode-baru--pengeluaran-per-kapita-disesuaikan.html'},
          ].map(d=>(
            <div key={d.col} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono flex-shrink-0">{d.col}</span>
              <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{d.nama}</span>
              <a href={d.link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="Lihat di BPS">
                <ExternalLink size={12} className="text-slate-400"/>
              </a>
            </div>
          ))}
          <a href="https://searchengine.web.bps.go.id/filemenu/Booklet-IPM-Metode-Baru.pdf" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
            <BookOpen size={14} className="text-indigo-600 flex-shrink-0"/>
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex-1">Booklet IPM Metode Baru — BPS</span>
            <ExternalLink size={12} className="text-indigo-400"/>
          </a>
        </div>
      </MetSection>

      <MetSection accentColor="#f59e0b" title="Catatan Data Proyeksi — Regresi Linear OLS">
        <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">Proyeksi bukan data resmi BPS</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                Untuk tahun yang datanya belum tersedia di BPS, sistem menggunakan proyeksi Regresi Linear OLS berdasarkan tren historis 2010–2024.
                Proyeksi ini merupakan estimasi matematis dan <strong>tidak memperhitungkan faktor eksternal</strong> seperti bencana, perubahan kebijakan, atau dinamika ekonomi global.
                Data bertanda * pada tabel adalah data proyeksi.
              </p>
            </div>
          </div>
        </div>
      </MetSection>
    </div>
  );
}

// ─── TAB TREN ─────────────────────────────────────────────────────────────────
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
          <span className="font-bold">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

function TabTren({ daftarTersimpan }) {
  const [filterInd, setFI] = useState('ALL');
  const trendData = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(item => {
      const ind = item.indikator||'ALL'; const key = `${item.tahun}|${ind}`;
      if (!map[key] || item.timestamp > map[key].timestamp) map[key] = item;
    });
    const byInd = {};
    Object.values(map).forEach(item => {
      const ind = item.indikator||'ALL';
      if (!byInd[ind]) byInd[ind] = [];
      byInd[ind].push({ tahun:item.tahun, SANGAT_TINGGI:item.kategori_distribusi?.SANGAT_TINGGI??0, TINGGI:item.kategori_distribusi?.TINGGI??0, SEDANG:item.kategori_distribusi?.SEDANG??0, RENDAH:item.kategori_distribusi?.RENDAH??0 });
    });
    Object.keys(byInd).forEach(ind => byInd[ind].sort((a,b)=>a.tahun-b.tahun));
    return byInd;
  }, [daftarTersimpan]);

  const chartData = trendData[filterInd] || [];
  const indsAvailable = Object.keys(trendData).filter(k => trendData[k].length > 0);
  const tahunCovered = [...new Set(daftarTersimpan.map(d=>d.tahun).filter(Boolean))].sort();

  if (!daftarTersimpan.length) return (
    <div className="py-16 text-center">
      <TrendingUp size={26} className="text-indigo-300 mx-auto mb-3"/>
      <p className="text-slate-500 dark:text-slate-400">Belum ada data tersimpan</p>
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
              <span style={{ color:filterInd===ind?INDIKATOR_COLORS_SDM[ind]:undefined }}>{INDIKATOR_ICON_SDM[ind]}</span>
              {ind==='ALL'?'Semua':INDIKATOR_LABELS_SDM[ind]?.replace('Indeks ','')}
            </button>
          );
        })}
      </div>

      {chartData.length === 0
        ? <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data untuk indikator ini</div>
        : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
            <div className="text-sm font-bold text-slate-900 dark:text-white mb-3">{INDIKATOR_LABELS_SDM[filterInd]} · {chartData.length} titik</div>
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
          </div>
        )
      }

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cakupan Tahun Tersimpan</div>
        <div className="flex flex-wrap gap-1.5">
          {TAHUN_TERSEDIA_SDM.map(thn => {
            const ada = tahunCovered.includes(thn);
            const mungkinProyeksi = thn > 2024;
            return (
              <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border',
                ada ? (mungkinProyeksi
                  ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300')
                : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500')}>
                {thn}{ada && ' ✓'}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300"/><span>Aktual BPS</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300"/><span>Mungkin ada proyeksi</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function TabsSDM_Publik({
  activeTab, setActiveTab, hasilAnalisis,
  indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
  daftarTersimpan, getWarna, getKategori,
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
              <Icon size={14}/><span>{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full"/>}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {activeTab==='info'     && <TabInfo hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih} getWarna={getWarna} getKategori={getKategori}/>}
        {activeTab==='metadata' && <TabMetodologi/>}
        {activeTab==='tren'     && <TabTren daftarTersimpan={daftarTersimpan}/>}
      </div>
    </div>
  );
}