"use client";
import { useState, useMemo } from 'react';
import {
  Download, ChevronDown, Info, BookOpen,
  BarChart2, Check, TrendingUp, TrendingDown, ClipboardList,
  AlertCircle, Search, X, Activity, ExternalLink, Fish, Trees, DollarSign,
  Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import {
  INDIKATOR_LABELS_SDA,
  INDIKATOR_COLORS_SDA,
  INDIKATOR_ICON_SDA,
  TAHUN_TERSEDIA_SDA,
  LABEL_INDEKS_UTAMA_SDA,
  THRESHOLD_DESC_SDA,
  THRESHOLD_MAP_SDA,
} from './petaSda';

const cn = (...cls) => cls.filter(Boolean).join(' ');

const TABS = [
  { id: 'info',      label: 'Info',      Icon: Info       },
  { id: 'kebijakan', label: 'Kebijakan', Icon: ClipboardList },
  { id: 'metadata',  label: 'Metodologi',Icon: BookOpen   },
  { id: 'tren',      label: 'Tren',      Icon: TrendingUp },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-4 py-3 text-xs">
      <div className="font-bold text-slate-900 dark:text-white mb-2">Tahun {label}</div>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }}/>
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── TREND PANEL ─────────────────────────────────────────────────────────────
export function TrendPanel_SDA({ daftarTersimpan }) {
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
        tahun:  item.tahun,
        TINGGI: item.kategori_distribusi?.TINGGI ?? 0,
        SEDANG: item.kategori_distribusi?.SEDANG ?? 0,
        RENDAH: item.kategori_distribusi?.RENDAH ?? 0,
      });
    });
    Object.keys(byInd).forEach(ind => byInd[ind].sort((a, b) => a.tahun - b.tahun));
    return byInd;
  }, [daftarTersimpan]);

  const chartData    = trendData[filterInd] || [];
  const indsAvail    = Object.keys(trendData).filter(k => trendData[k].length > 0);
  const tahunCovered = [...new Set(daftarTersimpan.map(d => d.tahun).filter(Boolean))].sort();
  const latestData   = chartData[chartData.length - 1];
  const delta = chartData.length >= 2
    ? { TINGGI: chartData.at(-1).TINGGI - chartData.at(-2).TINGGI, RENDAH: chartData.at(-1).RENDAH - chartData.at(-2).RENDAH }
    : null;

  const DeltaBadge = ({ val, positif = true }) => {
    if (val == null || val === 0) return <span className="text-[9px] text-slate-400">-</span>;
    const good = (val > 0 && positif) || (val < 0 && !positif);
    return (
      <span className={cn('flex items-center gap-0.5 text-[9px] font-bold', good ? 'text-emerald-600' : 'text-red-500')}>
        {val > 0 ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
        {val > 0 ? `+${val}` : val}
      </span>
    );
  };

  const radarData = useMemo(() => ['TINGGI','SEDANG','RENDAH'].map(kat => {
    const obj = { kategori: kat };
    indsAvail.forEach(ind => {
      const s = trendData[ind];
      if (s?.length) obj[INDIKATOR_LABELS_SDA[ind] || ind] = s.at(-1)[kat] ?? 0;
    });
    return obj;
  }), [trendData, indsAvail]);

  if (daftarTersimpan.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
        <TrendingUp size={28} className="text-emerald-400"/>
      </div>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada data tersimpan</p>
      <p className="text-xs text-slate-400 mt-1">Jalankan analisis dan simpan untuk melihat tren</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-emerald-500" size={20}/>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Panel Tren SDA</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">{daftarTersimpan.length} analisis · {tahunCovered.length} tahun ({tahunCovered.join(', ')})</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label:'Total Analisis', val: daftarTersimpan.length,    color:'emerald' },
          { label:'Tahun Tercakup', val: tahunCovered.length,       color:'blue'   },
          { label:'TINGGI Terbaru', val: latestData?.TINGGI ?? '-', color:'green',  delta: delta?.TINGGI, positif: true  },
          { label:'RENDAH Terbaru', val: latestData?.RENDAH ?? '-', color:'red',    delta: delta?.RENDAH, positif: false },
        ].map(c => (
          <div key={c.label} className={`bg-${c.color}-50 dark:bg-${c.color}-900/20 rounded-xl p-3 border border-${c.color}-100 dark:border-${c.color}-800/30`}>
            <div className={`text-[10px] font-semibold text-${c.color}-600 dark:text-${c.color}-400 mb-1`}>{c.label}</div>
            <div className={`text-2xl font-black text-${c.color}-700 dark:text-${c.color}-300`}>{c.val}</div>
            {c.delta != null && <DeltaBadge val={c.delta} positif={c.positif}/>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {['ALL','IKAN','KEBUN','PDRB'].map(ind => {
            const ada = indsAvail.includes(ind);
            return (
              <button key={ind} onClick={() => ada && setFilterInd(ind)}
                className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1',
                  filterInd === ind ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                  : ada ? 'text-slate-500 hover:text-slate-700' : 'text-slate-300 cursor-not-allowed')}>
                <span style={{ color: filterInd === ind ? INDIKATOR_COLORS_SDA[ind] : undefined }}>{INDIKATOR_ICON_SDA[ind]}</span>
                {ind === 'ALL' ? 'Semua' : INDIKATOR_LABELS_SDA[ind].replace('Indeks ', '')}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 ml-auto">
          {[['distribusi','Bar',<BarChart2 size={11}/>],['area','Area',<TrendingUp size={11}/>],['radar','Radar',<Activity size={11}/>]].map(([key,lbl,icon]) => (
            <button key={key} onClick={() => setChartMode(key)}
              className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1',
                chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>
              {icon} {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data</div>
        ) : (
          <>
            <div className="text-xs font-bold text-slate-900 dark:text-white mb-3">{INDIKATOR_LABELS_SDA[filterInd]} · {chartData.length} titik data</div>
            {chartMode === 'distribusi' && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5}/>
                  <XAxis dataKey="tahun" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="TINGGI" name="TINGGI" stackId="a" fill="#10b981"/>
                  <Bar dataKey="SEDANG" name="SEDANG" stackId="a" fill="#f59e0b"/>
                  <Bar dataKey="RENDAH" name="RENDAH" stackId="a" fill="#ef4444" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartMode === 'area' && (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <defs>
                    {[['gT','#10b981'],['gS','#f59e0b'],['gR','#ef4444']].map(([id,clr]) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={clr} stopOpacity={0.3}/><stop offset="95%" stopColor={clr} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5}/>
                  <XAxis dataKey="tahun" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  {[['TINGGI','#10b981','gT'],['SEDANG','#f59e0b','gS'],['RENDAH','#ef4444','gR']].map(([key,clr,grad]) => (
                    <Area key={key} type="monotone" dataKey={key} name={key} stroke={clr} strokeWidth={2} fill={`url(#${grad})`} dot={{ r:3, fill:clr }}/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
            {chartMode === 'radar' && (
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData} margin={{ top:10, right:20, left:20, bottom:10 }}>
                  <PolarGrid stroke="#e2e8f0"/>
                  <PolarAngleAxis dataKey="kategori" tick={{ fontSize:10, fill:'#94a3b8' }}/>
                  <PolarRadiusAxis angle={90} domain={[0,34]} tick={{ fontSize:9, fill:'#94a3b8' }}/>
                  {indsAvail.map(ind => (
                    <Radar key={ind} name={INDIKATOR_LABELS_SDA[ind]} dataKey={INDIKATOR_LABELS_SDA[ind]}
                      stroke={INDIKATOR_COLORS_SDA[ind]} fill={INDIKATOR_COLORS_SDA[ind]} fillOpacity={0.15} strokeWidth={2}/>
                  ))}
                  <Tooltip/><Legend iconSize={8} wrapperStyle={{ fontSize:'10px' }}/>
                </RadarChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cakupan Tahun</div>
        <div className="flex flex-wrap gap-1.5">
          {TAHUN_TERSEDIA_SDA.map(thn => {
            const ada = tahunCovered.includes(thn);
            return (
              <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-[10px] font-semibold border',
                ada ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-400')}>
                {thn}{ada && ' ✓'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── METADATA PANEL ───────────────────────────────────────────────────────────
export function MetadataPanel_SDA({ hasilAnalisis, indikatorTerpilih, tahunTerpilih }) {
  const [openSections, setOpenSections] = useState({ formula: true, klasif: false, dataset: false, ref: false });
  const toggle = (k) => setOpenSections(prev => ({ ...prev, [k]: !prev[k] }));
  const ind = hasilAnalisis?.indikator || indikatorTerpilih || 'ALL';
  const thn = hasilAnalisis?.tahun     || tahunTerpilih     || 2023;

  const Section = ({ id, title, sub, color, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm" style={{ overflowAnchor:'none' }}>
      <div role="button" tabIndex={0} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
        onClick={() => toggle(id)} onKeyDown={(e) => e.key==='Enter' && toggle(id)}>
        <div className="flex items-center gap-3">
          <div className={cn('w-1 h-5 rounded-full', color)}/>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800 dark:text-white">{title}</div>
            {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
          </div>
        </div>
        <ChevronDown size={14} className={cn('text-slate-400 transition-transform flex-shrink-0', openSections[id] && 'rotate-180')}/>
      </div>
      {openSections[id] && (
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4">{children}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-3" style={{ overflowAnchor:'none' }}>
      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-emerald-600 dark:text-emerald-400"/>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">Metodologi & Formula IPSDA</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">3 Komponen · MinMax Normalisasi · 3 Kelas · Threshold berbeda per indikator</p>
        </div>
      </div>

      <Section id="formula" color="bg-emerald-500" title="Formula IPSDA" sub="3 komponen, MinMax normalisasi">
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
            <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Formula Utama (ALL)</div>
            <code className="block text-base font-mono font-black text-slate-900 dark:text-white">IPSDA = (I.Ikan + I.Kebun + I.PDRB) / 3</code>
            <p className="text-[10px] text-slate-500 mt-2">Semua komponen dinormalisasi MinMax ke rentang 0–1 antar provinsi sebelum digabungkan.</p>
          </div>

          {[
            { label:'I.Ikan — Indeks Produksi Ikan', formula:'ProdIkan(Ton) / Penduduk(RibuJiwa) → MinMax', color:'border-blue-200 bg-blue-50 dark:bg-blue-950/20', badge:'bg-blue-100 text-blue-700', threshold:'TINGGI ≥0.60 · SEDANG 0.25–0.60 · RENDAH <0.25', note:'Produksi Perikanan Tangkap laut (Ton) dibagi Penduduk untuk mendapatkan produktivitas per kapita.' },
            { label:'I.Kebun — Indeks Produksi Kebun', formula:'(Σ8Komoditas/8)(Ton) / Penduduk(RibuJiwa) → MinMax', color:'border-green-200 bg-green-50 dark:bg-green-950/20', badge:'bg-green-100 text-green-700', threshold:'TINGGI ≥0.60 · SEDANG 0.25–0.60 · RENDAH <0.25', note:'Rata-rata produksi 8 komoditas (Sawit, Kelapa, Karet, Kopi, Kakao, Tebu, Teh, Tembakau) dalam Ton, dibagi Penduduk.' },
            { label:'I.PDRB — Kontribusi SDA', formula:'PDRB Sektor A / Total PDRB → MinMax', color:'border-amber-200 bg-amber-50 dark:bg-amber-950/20', badge:'bg-amber-100 text-amber-700', threshold:'TINGGI ≥0.60 · SEDANG 0.25–0.60 · RENDAH <0.25', note:'Rasio PDRB Pertanian, Kehutanan & Perikanan (Sektor A) terhadap Total PDRB. Mencerminkan ketergantungan ekonomi pada SDA.' },
          ].map((c, i) => (
            <div key={i} className={cn('rounded-xl border-2 p-4', c.color)}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className={cn('text-[10px] font-black px-2 py-0.5 rounded', c.badge)}>{c.label}</span>
                <code className="text-xs font-mono font-black text-slate-600 dark:text-slate-300 flex-shrink-0 text-right">{c.formula}</code>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{c.note}</p>
              <div className="mt-2 p-2 bg-white/60 rounded-lg">
                <span className="text-[9px] font-bold text-slate-600">{c.threshold}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="klasif" color="bg-rose-500" title="Klasifikasi Status IPSDA" sub="Threshold berbeda per indikator">
        <div className="space-y-3">
          {[
            { ind:'ALL',   label:'IPSDA Gabungan', t:'>0.70',  s:'0.40–0.70', desc:'IPSDA gabungan 3 komponen. TINGGI = SDA berkontribusi signifikan; SEDANG = masih ada potensi belum dimaksimalkan; RENDAH = ketimpangan potensi SDA.' },
            { ind:'IKAN',  label:'I.Ikan (MinMax)', t:'≥0.60', s:'0.25–0.60', desc:'Produktivitas ikan per kapita. Distribusi nilai aktual relatif antar provinsi.' },
            { ind:'KEBUN', label:'I.Kebun (MinMax)', t:'≥0.60', s:'0.25–0.60', desc:'Produktivitas perkebunan 8 komoditas per kapita.' },
            { ind:'PDRB',  label:'I.PDRB (MinMax)', t:'≥0.60', s:'0.25–0.60', desc:'Proporsi PDRB SDA. Setelah MinMax, nilai tinggi = kontribusi SDA besar relatif antar provinsi.' },
          ].map(s => (
            <div key={s.ind} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800/50">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700">{s.label}</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">TINGGI {s.t}</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">SEDANG {s.s}</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">RENDAH sisanya</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="dataset" color="bg-teal-500" title="Dataset Sumber" sub={`5 Dataset BPS — Tahun ${thn}`}>
        <div className="space-y-3">
          {[
            { nama:'Produksi Perikanan Tangkap (Ton)', satuan:'Ton', komponen:'I.Ikan', sumber:'KKP via BPS Simdasi', note:'2017-2022: endpoint lama (satuan Ton). 2023-2024: endpoint baru (satuan Kg, dikonversi /1000).' },
            { nama:'Produksi Tanaman Perkebunan', satuan:'Ribu Ton', komponen:'I.Kebun', sumber:'BPS var/132 (2023), var/2566 (2024)', note:'8 komoditas: Sawit, Kelapa, Karet, Kopi, Kakao, Tebu, Teh, Tembakau. Rata-rata sederhana 8 komoditas → Ton.' },
            { nama:'PDRB Sektor A (Pertanian, Kehutanan, Perikanan)', satuan:'Miliar Rp', komponen:'I.PDRB', sumber:'BPS var/2268 turtahun=Tahunan', note:'Sektor A mencakup perkebunan sesuai KBLI BPS. Rasio = Sektor A / Total PDRB.' },
            { nama:'PDRB Total', satuan:'Miliar Rp', komponen:'I.PDRB', sumber:'BPS var/2268 turvar=2022', note:'Total semua 17 sektor A–R,S,T,U sebagai denominator.' },
            { nama:'Jumlah Penduduk', satuan:'Ribu Jiwa', komponen:'Denominator', sumber:'BPS var/958', note:'Sebagai pembagi untuk Indeks Ikan & Kebun. Data tersedia s/d 2022; tahun 2023-2024 menggunakan data 2022 sebagai proxy.' },
          ].map((d, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{d.nama}</span>
                <span className="text-[9px] font-bold px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 flex-shrink-0">{d.komponen}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{d.note}</p>
              <div className="mt-2 flex gap-2 text-[9px] text-slate-400">
                <span>Satuan: {d.satuan}</span>
                <span>·</span>
                <span>Sumber: {d.sumber}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="ref" color="bg-purple-500" title="Referensi Ilmiah" sub="4 sumber pendukung metodologi">
        <div className="space-y-3">
          {[
            { badge:'Jurnal Ekonomi Regional · 2024', title:'Analisis Kontribusi Subsektor Perikanan dan Perkebunan Terhadap PDRB Provinsi Kepulauan Riau', color:'#3b82f6', note:'Memvalidasi subsektor perikanan dan perkebunan sebagai penyumbang terbesar PDRB di daerah kepulauan.' },
            { badge:'Jurnal Ekonomi-Qu · 2019', title:'Analisis Location Quotient dan Shift-Share Sub Sektor Pertanian di Kabupaten Pekalongan', color:'#84cc16', note:'Pendekatan agregat terhadap 8 komoditas perkebunan unggulan untuk menghitung kontribusi sektor.' },
            { badge:'Skripsi UIN Bukittinggi · 2025', title:'Analisis Sektor Unggulan terhadap Pertumbuhan Ekonomi Wilayah di Kabupaten Dharmasraya', color:'#f59e0b', note:'Sektor Pertanian, Kehutanan dan Perikanan (KBLI BPS) secara eksplisit mencakup perkebunan.' },
            { badge:'Prosiding SainTek UT · 2025', title:'Analisis Perekonomian Daerah Berbasis Sektor Unggulan', color:'#10b981', note:'Nilai kontribusi <40% mengindikasikan kontribusi terbatas; 0.70 sebagai batas kinerja optimal.' },
          ].map((r, i) => (
            <div key={i} className="rounded-xl border p-4 dark:border-slate-700" style={{ borderColor: r.color + '40', backgroundColor: r.color + '08' }}>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5" style={{ backgroundColor: r.color + '20', color: r.color }}>{r.badge}</span>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">{r.title}</div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{r.note}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── TAB INFO ─────────────────────────────────────────────────────────────────
function TabInfo({ hasilAnalisis, jumlahKategori, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, eksporData, getWarna, getKategori }) {
  const [menuUnduh, setMenuUnduh] = useState(false);

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA')
      f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih]);

  if (!hasilAnalisis) return (
    <div className="py-12 text-center">
      <BarChart2 size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-sm text-slate-400">Belum ada data. Klik <strong>Analisis SDA</strong> di peta untuk memulai.</p>
    </div>
  );

  const labelIdx   = LABEL_INDEKS_UTAMA_SDA[indikatorTerpilih] ?? 'IPSDA';
  const statsConfig = [
    { label:'Total Provinsi', val: hasilAnalisis.total_success || 0, colorClass:'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 text-emerald-700 dark:text-emerald-300' },
    { label:'TINGGI',         val: jumlahKategori['TINGGI'] ?? 0,    colorClass:'bg-green-50  dark:bg-green-900/20  border-green-100  text-green-700  dark:text-green-300'  },
    { label:'SEDANG',         val: jumlahKategori['SEDANG'] ?? 0,    colorClass:'bg-amber-50  dark:bg-amber-900/20  border-amber-100  text-amber-700  dark:text-amber-300'  },
    { label:'RENDAH',         val: jumlahKategori['RENDAH'] ?? 0,    colorClass:'bg-red-50    dark:bg-red-900/20    border-red-100    text-red-700    dark:text-red-300'    },
  ];

  const showIkan  = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'IKAN';
  const showKebun = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'KEBUN';
  const showPdrb  = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'PDRB';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
            <Calendar size={9}/> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        {hasilAnalisis.tahun && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-200">
            <Calendar size={9}/> Tahun {hasilAnalisis.tahun}
          </span>
        )}
      </div>

      {/* Formula ringkas */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          {indikatorTerpilih === 'ALL' ? 'Formula IPSDA Gabungan' : `Formula ${labelIdx} — ${INDIKATOR_LABELS_SDA[indikatorTerpilih]}`}
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
          {indikatorTerpilih === 'ALL' && 'I.Ikan=ProdTon/Penduduk·I.Kebun=RataKebun/Penduduk·I.PDRB=SekA/Total → MinMax · IPSDA=(I.Ikan+I.Kebun+I.PDRB)/3'}
          {indikatorTerpilih === 'IKAN'  && 'I.Ikan = Produksi Tangkap (Ton) / Penduduk (Ribu Jiwa) → MinMax antar provinsi'}
          {indikatorTerpilih === 'KEBUN' && 'I.Kebun = Rata-rata 8 Komoditas (Ton) / Penduduk (Ribu Jiwa) → MinMax antar provinsi'}
          {indikatorTerpilih === 'PDRB'  && 'I.PDRB = PDRB Sektor A / Total PDRB → MinMax antar provinsi'}
        </p>
        <p className="text-[11px] font-mono mt-1">
          <span className="font-bold text-emerald-600">TINGGI</span>
          {indikatorTerpilih === 'ALL'   && ' >0.70 · '}
          {indikatorTerpilih !== 'ALL'   && ' ≥0.60 · '}
          <span className="font-bold text-amber-600">SEDANG</span>
          {indikatorTerpilih === 'ALL'   && ' 0.40–0.70 · '}
          {indikatorTerpilih !== 'ALL'   && ' 0.25–0.60 · '}
          <span className="font-bold text-red-600">RENDAH</span>
          {indikatorTerpilih === 'ALL'   && ' <0.40'}
          {indikatorTerpilih !== 'ALL'   && ' <0.25'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsConfig.map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.colorClass)}>
            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-70 mb-1">{s.label}</div>
            <div className="text-2xl font-black">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-slate-400">{dataTerfilter.length} provinsi · Tahun {hasilAnalisis.tahun}</p>
          <div className="flex items-center gap-2">
            <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
              {['SEMUA','TINGGI','SEDANG','RENDAH'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="relative">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs transition-all shadow-sm" onClick={() => setMenuUnduh(!menuUnduh)}>
                <Download size={12}/> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-700 py-1">
                  {['EXCEL','CSV','JSON','GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                      <Download size={10} className="text-emerald-500"/> {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                <th className="px-3 py-3 text-center w-8">No</th>
                <th className="px-4 py-3 text-left">Provinsi</th>
                <th className="px-4 py-3 text-center">{labelIdx}</th>
                {showIkan  && <th className="px-4 py-3 text-center">I.Ikan</th>}
                {showKebun && <th className="px-4 py-3 text-center">I.Kebun</th>}
                {showPdrb  && <th className="px-4 py-3 text-center">I.PDRB</th>}
                <th className="px-4 py-3 text-center">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {dataTerfilter.map((fitur, idx) => {
                const d   = fitur.properties.sda_analysis;
                const w   = getWarna(fitur, indikatorTerpilih);
                const kat = getKategori(fitur, indikatorTerpilih);
                return (
                  <tr key={d.nama_provinsi} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-3 py-2.5 text-center text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w }}/>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{d.nama_provinsi}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_utama ?? d.ipsda ?? '-'}</span>
                    </td>
                    {showIkan  && <td className="px-4 py-2.5 text-center text-xs text-blue-600   dark:text-blue-400   font-semibold">{d.indeks_ikan  ?? '-'}</td>}
                    {showKebun && <td className="px-4 py-2.5 text-center text-xs text-green-600  dark:text-green-400  font-semibold">{d.indeks_kebun ?? '-'}</td>}
                    {showPdrb  && <td className="px-4 py-2.5 text-center text-xs text-amber-600  dark:text-amber-400  font-semibold">{d.indeks_pdrb  ?? '-'}</td>}
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{ borderColor: w + '60', color: w, backgroundColor: w + '15' }}>{kat}</span>
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

// ─── TAB KEBIJAKAN ────────────────────────────────────────────────────────────
const PILAR_COLORS = {
  'Transformasi': '#6366f1', 'Sistem Informasi': '#3b82f6', 'Kebijakan & Regulasi': '#10b981',
  'Intervensi Sektoral': '#f59e0b', 'Produktivitas': '#ef4444', 'Stabilitas': '#8b5cf6',
  'Perencanaan & Data': '#06b6d4', 'Kapasitas SDA': '#ec4899', 'Infrastruktur': '#14b8a6',
};
const getPilarColor = (pilar) => PILAR_COLORS[pilar] || '#10b981';

function TabKebijakan({ hasilAnalisis, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, getWarna, getKategori }) {
  const [provinsiPopup, setProvinsiPopup] = useState(null);
  const [searchProv,    setSearchProv]    = useState('');
  const [openPilar,     setOpenPilar]     = useState({});
  const labelIdx = LABEL_INDEKS_UTAMA_SDA[indikatorTerpilih] ?? 'IPSDA';

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    if (searchProv.trim())            f = f.filter(x => x.properties?.sda_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih, searchProv]);

  if (!hasilAnalisis) return (
    <div className="py-12 text-center">
      <ClipboardList size={32} className="text-slate-300 mx-auto mb-3"/>
      <p className="text-sm text-slate-400">Belum ada data analisis.</p>
    </div>
  );

  const popupFitur = provinsiPopup ? hasilAnalisis.matched_features.features.find(f => f.properties?.sda_analysis?.nama_provinsi === provinsiPopup) : null;
  const popupData  = popupFitur?.properties?.sda_analysis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-emerald-500" size={15}/> Rekomendasi Kebijakan SDA
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">{dataTerfilter.length} provinsi · {INDIKATOR_LABELS_SDA[indikatorTerpilih]} · {THRESHOLD_DESC_SDA[indikatorTerpilih]}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)} placeholder="Cari provinsi..."
              className="pl-7 pr-7 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-400 w-40"/>
            {searchProv && <button onClick={() => setSearchProv('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={10}/></button>}
          </div>
          <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            {['SEMUA','TINGGI','SEDANG','RENDAH'].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        {dataTerfilter.map(fitur => {
          const d   = fitur.properties.sda_analysis;
          const w   = getWarna(fitur, indikatorTerpilih);
          const kat = getKategori(fitur, indikatorTerpilih);
          const rekom = d.rekomendasi || [];
          return (
            <div key={d.nama_provinsi} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-all overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderLeft: `3px solid ${w}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{d.nama_provinsi}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                      style={{ borderColor: w+'60', color: w, backgroundColor: w+'15' }}>{kat}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] font-mono font-bold" style={{ color: w }}>{labelIdx} {d.indeks_utama ?? d.ipsda ?? '-'}</span>
                    {indikatorTerpilih === 'ALL' && <>
                      <span className="text-[10px] text-slate-400">I.Ikan {d.indeks_ikan ?? '-'}</span>
                      <span className="text-[10px] text-slate-400">I.Kebun {d.indeks_kebun ?? '-'}</span>
                      <span className="text-[10px] text-slate-400">I.PDRB {d.indeks_pdrb ?? '-'}</span>
                    </>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {rekom.length > 0 && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">{rekom.length} pilar</span>}
                  <button onClick={() => setProvinsiPopup(d.nama_provinsi)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold transition-colors">
                    Detail →
                  </button>
                </div>
              </div>
              {rekom.length > 0 && rekom[0]?.aksi?.[0] && (
                <div className="px-4 pb-3 pt-0" style={{ borderLeft: `3px solid ${w}` }}>
                  <div className="flex items-start gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: getPilarColor(rekom[0].pilar) }}/>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: getPilarColor(rekom[0].pilar) }}>{rekom[0].pilar}</span>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug mt-0.5 line-clamp-1">{rekom[0].aksi[0].nama_aksi}</p>
                    </div>
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-800 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">P{rekom[0].prioritas}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Popup Detail */}
      {provinsiPopup && popupData && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0"
              style={{ borderLeft: `4px solid ${getWarna(popupFitur, indikatorTerpilih)}` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{popupData.nama_provinsi}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                      style={{ borderColor: getWarna(popupFitur, indikatorTerpilih)+'60', color: getWarna(popupFitur, indikatorTerpilih), backgroundColor: getWarna(popupFitur, indikatorTerpilih)+'15' }}>
                      {getKategori(popupFitur, indikatorTerpilih)}
                    </span>
                    <span className="text-[10px] font-mono font-black" style={{ color: getWarna(popupFitur, indikatorTerpilih) }}>IPSDA {popupData.ipsda ?? '-'}</span>
                    {[['indeks_ikan','I.Ikan','#3b82f6'],['indeks_kebun','I.Kebun','#84cc16'],['indeks_pdrb','I.PDRB','#f59e0b']].map(([k,lbl,clr]) => (
                      <span key={k} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded" style={{ color: clr }}>
                        {lbl} {popupData[k] ?? '-'}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => setProvinsiPopup(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0">
                  <X size={17} className="text-slate-500"/>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {!popupData.rekomendasi?.length ? (
                <div className="text-center py-10 text-slate-400">
                  <AlertCircle size={28} className="mx-auto mb-2 opacity-40"/>
                  <p className="text-sm font-medium">Belum ada rekomendasi kebijakan.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">{popupData.rekomendasi.length} Pilar Kebijakan</div>
                  {popupData.rekomendasi.map((kelompok, ki) => {
                    const pc     = getPilarColor(kelompok.pilar);
                    const isOpen = openPilar[ki] !== false;
                    return (
                      <div key={ki} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          onClick={() => setOpenPilar(prev => ({ ...prev, [ki]: !isOpen }))}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pc }}/>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{kelompok.pilar}</span>
                            <span className="text-[9px] font-semibold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: pc }}>P{kelompok.prioritas}</span>
                            <span className="text-[9px] text-slate-400">{kelompok.jumlah_aksi} aksi</span>
                          </div>
                          <ChevronDown size={13} className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')}/>
                        </button>
                        {isOpen && (
                          <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                            {kelompok.aksi.map((aksi, ai) => (
                              <div key={ai} className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30">
                                <div className="flex items-start gap-2.5">
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[9px] font-black" style={{ backgroundColor: pc }}>{aksi.no_aksi || ai+1}</span>
                                  <div className="flex-1 min-w-0">
                                    {aksi.isu_strategis && <div className="text-[9px] italic text-slate-400 mb-0.5">Isu: {aksi.isu_strategis}</div>}
                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{aksi.nama_aksi}</div>
                                    {aksi.detail_aksi && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{aksi.detail_aksi}</p>}
                                    {aksi.indikator_terkait && (
                                      <span className="inline-block mt-1 text-[9px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded font-semibold">{aksi.indikator_terkait}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN TABS WRAPPER ────────────────────────────────────────────────────────
export default function TabsSDA({
  activeTab, setActiveTab,
  hasilAnalisis, jumlahKategori,
  indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
  tahunTerpilih, daftarTersimpan,
  eksporData, getWarna, getKategori,
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100 dark:border-slate-700">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all relative flex-1',
                active ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30')}>
              <Icon size={14}/>
              <span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"/>}
            </button>
          );
        })}
      </div>
      <div className="p-5" style={{ overflowAnchor:'none' }}>
        {activeTab === 'info' && (
          <TabInfo hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori}
            indikatorTerpilih={indikatorTerpilih} kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih} eksporData={eksporData}
            getWarna={getWarna} getKategori={getKategori}/>
        )}
        {activeTab === 'kebijakan' && (
          <TabKebijakan hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih}
            kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih}
            getWarna={getWarna} getKategori={getKategori}/>
        )}
        {activeTab === 'metadata' && (
          <MetadataPanel_SDA hasilAnalisis={hasilAnalisis} indikatorTerpilih={indikatorTerpilih} tahunTerpilih={tahunTerpilih}/>
        )}
        {activeTab === 'tren' && (
          <TrendPanel_SDA daftarTersimpan={daftarTersimpan}/>
        )}
      </div>
    </div>
  );
}