"use client";
import { useState, useMemo } from 'react';
import {
  Download, ChevronDown, Info, BookOpen, TrendingUp, TrendingDown,
  ClipboardList, BarChart2, Check, Calendar, AlertCircle,
  Search, X, Activity, ExternalLink, ShoppingCart, Building2,
  ArrowLeftRight, DollarSign,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { TAHUN_TERSEDIA_EKON, KATEGORI_EKON } from './petaEkon';

const cn = (...cls) => cls.filter(Boolean).join(' ');

const fmtRp  = (v) => v != null ? Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-';
const fmt4   = (v) => v != null ? Number(v).toFixed(4) : '-';

const TABS = [
  { id: 'info',      label: 'Info',       Icon: Info          },
  { id: 'kebijakan', label: 'Kebijakan',  Icon: ClipboardList },
  { id: 'metadata',  label: 'Metodologi', Icon: BookOpen      },
  { id: 'tren',      label: 'Tren',       Icon: TrendingUp    },
];

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-4 py-3 text-xs">
      <div className="font-bold text-slate-900 dark:text-white mb-2">Tahun {label}</div>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── TREND PANEL ──────────────────────────────────────────────────────────────
export function TrendPanel_EKON({ daftarTersimpan }) {
  const [chartMode, setChartMode] = useState('distribusi');

  const trendData = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(item => {
      const key = `${item.tahun}`;
      if (!map[key] || item.timestamp > map[key].timestamp) map[key] = item;
    });
    return Object.values(map)
      .sort((a, b) => a.tahun - b.tahun)
      .map(item => ({
        tahun:  item.tahun,
        TINGGI: item.kategori_distribusi?.TINGGI ?? 0,
        SEDANG: item.kategori_distribusi?.SEDANG ?? 0,
        RENDAH: item.kategori_distribusi?.RENDAH ?? 0,
        TOTAL:  item.total_success ?? 0,
      }));
  }, [daftarTersimpan]);

  const tahunCovered = [...new Set(daftarTersimpan.map(d => d.tahun).filter(Boolean))].sort();
  const latestData   = trendData[trendData.length - 1];
  const delta = trendData.length >= 2
    ? { TINGGI: trendData.at(-1).TINGGI - trendData.at(-2).TINGGI, RENDAH: trendData.at(-1).RENDAH - trendData.at(-2).RENDAH }
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

  const radarData = ['TINGGI', 'SEDANG', 'RENDAH'].map(kat => ({
    kategori: kat,
    'Indeks Ekonomi': latestData?.[kat] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-sky-500" size={20} />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Panel Tren Aktivitas Ekonomi</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {daftarTersimpan.length} analisis · {tahunCovered.length} tahun ({tahunCovered.join(', ')})
          </p>
        </div>
      </div>

      {daftarTersimpan.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center mb-4">
            <TrendingUp size={28} className="text-sky-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada data tersimpan</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Jalankan analisis dan simpan untuk melihat tren</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label:'Total Analisis', val: daftarTersimpan.length,    color:'sky'   },
              { label:'Tahun Tercakup', val: tahunCovered.length,       color:'blue'  },
              { label:'TINGGI Terbaru', val: latestData?.TINGGI ?? '-', color:'green', delta: delta?.TINGGI, positif: true  },
              { label:'RENDAH Terbaru', val: latestData?.RENDAH ?? '-', color:'red',   delta: delta?.RENDAH, positif: false },
            ].map(c => (
              <div key={c.label} className={`bg-${c.color}-50 dark:bg-${c.color}-900/20 rounded-xl p-3 border border-${c.color}-100 dark:border-${c.color}-800/30`}>
                <div className={`text-[10px] font-semibold text-${c.color}-600 dark:text-${c.color}-400 mb-1`}>{c.label}</div>
                <div className={`text-2xl font-black text-${c.color}-700 dark:text-${c.color}-300`}>{c.val}</div>
                {c.delta != null && <DeltaBadge val={c.delta} positif={c.positif} />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit ml-auto">
            {[['distribusi','Bar',<BarChart2 size={11}/>],['area','Area',<TrendingUp size={11}/>],['radar','Radar',<Activity size={11}/>]].map(([key,lbl,icon]) => (
              <button key={key} onClick={() => setChartMode(key)}
                className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1',
                  chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400')}>
                {icon} {lbl}
              </button>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
            {trendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {chartMode === 'distribusi' && 'Distribusi Kategori Ekonomi per Tahun'}
                    {chartMode === 'area'        && 'Tren Kumulatif Kategori Ekonomi'}
                    {chartMode === 'radar'       && 'Distribusi Terakhir'}
                  </div>
                  <div className="flex items-center gap-2">
                    {[['bg-emerald-400','T'],['bg-amber-400','S'],['bg-red-400','R']].map(([cls,lbl]) => (
                      <div key={lbl} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${cls}`}/><span className="text-[10px] text-slate-500 dark:text-slate-400">{lbl}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {chartMode === 'distribusi' && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trendData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                      <XAxis dataKey="tahun" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="TINGGI" name="TINGGI" stackId="a" fill="#10b981" />
                      <Bar dataKey="SEDANG" name="SEDANG" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="RENDAH" name="RENDAH" stackId="a" fill="#ef4444" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {chartMode === 'area' && (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                      <defs>
                        {[['gT','#10b981'],['gS','#f59e0b'],['gR','#ef4444']].map(([id,clr]) => (
                          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={clr} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={clr} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                      <XAxis dataKey="tahun" tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      {[['TINGGI','#10b981','gT'],['SEDANG','#f59e0b','gS'],['RENDAH','#ef4444','gR']].map(([key,clr,grad]) => (
                        <Area key={key} type="monotone" dataKey={key} name={key} stroke={clr} strokeWidth={2} fill={`url(#${grad})`} dot={{ r:3, fill:clr }} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {chartMode === 'radar' && (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top:10, right:20, left:20, bottom:10 }}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="kategori" tick={{ fontSize:10, fill:'#94a3b8' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 34]} tick={{ fontSize:9, fill:'#94a3b8' }} />
                      <Radar name="Indeks Ekonomi" dataKey="Indeks Ekonomi" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} strokeWidth={2} />
                      <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize:'10px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Cakupan Tahun</div>
            <div className="flex flex-wrap gap-1.5">
              {TAHUN_TERSEDIA_EKON.map(thn => {
                const ada = tahunCovered.includes(thn);
                return (
                  <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-[10px] font-semibold border',
                    ada ? 'bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400')}>
                    {thn}{ada && ' ✓'}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── METADATA PANEL ───────────────────────────────────────────────────────────
export function MetadataPanel_EKON({ hasilAnalisis, tahunTerpilih }) {
  const [openSections, setOpenSections] = useState({ formula: true, komponen: true, norm: false, klasif: false, dataset: false, ref: false });
  const toggle = (k) => setOpenSections(prev => ({ ...prev, [k]: !prev[k] }));
  const thn = hasilAnalisis?.tahun || tahunTerpilih || 2024;

  const Section = ({ id, title, sub, color, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
      style={{ overflowAnchor: 'none' }}>
      <div role="button" tabIndex={0}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
        onClick={() => toggle(id)} onKeyDown={(e) => e.key === 'Enter' && toggle(id)}>
        <div className="flex items-center gap-3">
          <div className={cn('w-1 h-5 rounded-full', color)} />
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800 dark:text-white">{title}</div>
            {sub && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
          </div>
        </div>
        <ChevronDown size={14} className={cn('text-slate-400 transition-transform flex-shrink-0', openSections[id] && 'rotate-180')}/>
      </div>
      {openSections[id] && (
        <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3" style={{ overflowAnchor: 'none' }}>
      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-sky-600 dark:text-sky-400"/>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">Metodologi & Formula IEKON</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            PDRB Pengeluaran BPS · 4 Komponen · 3 Kelas Status
          </p>
        </div>
      </div>

      {/* Formula Utama */}
      <Section id="formula" color="bg-sky-500" title="Formula Indeks Aktivitas Ekonomi" sub="Rata-rata 4 komponen PDRB Pengeluaran">
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40 rounded-xl p-4 border border-sky-200 dark:border-sky-800">
            <div className="text-[9px] font-bold text-sky-500 uppercase tracking-widest mb-2">Formula Utama</div>
            <code className="block text-base font-mono font-black text-slate-900 dark:text-white">IEKON = (KR_norm + I_norm + EN_norm + P_norm) / 4</code>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Rata-rata sederhana dari 4 komponen PDRB pengeluaran yang telah dinormalisasi. Pendekatan ini mengikuti metodologi BPS dan literatur analisis ekonomi regional.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              { label:'KR — Konsumsi Rumah Tangga per Kapita', formula:'Konsumsi RT (Milyar Rp) / Penduduk (Ribu Jiwa)', color:'emerald', badge:'KR', alasan:'Berkontribusi ~53% terhadap PDB Indonesia (BPS, 2025). Indikator utama daya beli masyarakat.' },
              { label:'I — Investasi (PMTB) per Kapita',       formula:'PMTB (Milyar Rp) / Penduduk (Ribu Jiwa)',       color:'violet',  badge:'I',  alasan:'Pembentukan Modal Tetap Bruto mencerminkan ekspansi kapasitas produksi. Berkontribusi ~29% terhadap PDB.' },
              { label:'EN — Ekspor Neto per Kapita',           formula:'Net Ekspor (Milyar Rp) / Penduduk (Ribu Jiwa)', color:'amber',   badge:'EN', alasan:'Net ekspor mencerminkan daya saing perekonomian daerah di pasar domestik/internasional.' },
              { label:'P — PDRB per Kapita',                   formula:'PDRB (Milyar Rp) / Penduduk (Ribu Jiwa)',       color:'sky',     badge:'P',  alasan:'Indikator paling umum untuk mengukur tingkat kemakmuran suatu daerah (Weya, USU, 2024).' },
            ].map(k => (
              <div key={k.badge} className={`rounded-xl border-2 border-${k.color}-200 dark:border-${k.color}-800/50 bg-${k.color}-50 dark:bg-${k.color}-950/20 p-4`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-${k.color}-100 dark:bg-${k.color}-900/50 text-${k.color}-700 dark:text-${k.color}-300`}>{k.label}</span>
                </div>
                <code className={`text-sm font-mono font-black text-${k.color}-700 dark:text-${k.color}-300`}>{k.formula}</code>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{k.alasan}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Normalisasi */}
      <Section id="norm" color="bg-violet-500" title="Normalisasi Min-Max" sub="Skala 0–1 antar provinsi">
        <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800/50">
          <code className="block text-base font-mono font-black text-slate-900 dark:text-white mb-3">X_norm = (X − X_min) / (X_max − X_min)</code>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Setiap komponen dinormalisasi secara <strong>independen</strong> antar 34 provinsi. Nilai 0 = provinsi terendah, nilai 1 = provinsi tertinggi. Min-Max dipilih karena mampu mengakomodasi rentang nilai yang sangat bervariasi antar daerah (Ji et al., 2016).
          </p>
        </div>
      </Section>

      {/* Klasifikasi */}
      <Section id="klasif" color="bg-rose-500" title="Klasifikasi Status IEKON" sub="3 kelas aktivitas ekonomi">
        <div className="space-y-3">
          {[
            { label:'TINGGI', range:'IEKON > 0.70',          color:'#10b981', colorBg:'bg-emerald-50 dark:bg-emerald-950/20', colorBorder:'border-emerald-200 dark:border-emerald-800/50', desc:'Aktivitas ekonomi tinggi; konsumsi, investasi, dan PDRB kuat. Intervensi bersifat pemeliharaan dan peningkatan daya saing.' },
            { label:'SEDANG', range:'0.40 ≤ IEKON ≤ 0.70',  color:'#f59e0b', colorBg:'bg-amber-50 dark:bg-amber-950/20',   colorBorder:'border-amber-200 dark:border-amber-800/50',   desc:'Aktivitas cukup; masih ada ruang peningkatan. Dorong investasi dan ekspor untuk naik ke kelas TINGGI.' },
            { label:'RENDAH', range:'IEKON < 0.40',          color:'#ef4444', colorBg:'bg-red-50 dark:bg-red-950/20',       colorBorder:'border-red-200 dark:border-red-800/50',       desc:'Aktivitas terbatas; perlu intervensi kebijakan komprehensif di semua komponen PDRB.' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl border-2 p-4', s.colorBg, s.colorBorder)}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ backgroundColor: s.color + '20', color: s.color }}>{s.label}</span>
                <code className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{s.range}</code>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Dataset */}
      <Section id="dataset" color="bg-teal-500" title="Dataset Sumber BPS" sub={`Tahun ${thn} — var=533 & var=958`}>
        <div className="space-y-3">
          {[
            {
              var: '533', nama: 'PDRB Atas Dasar Harga Konstan Menurut Pengeluaran',
              satuan: 'Milyar Rupiah',
              link: 'https://www.bps.go.id/id/statistics-table/2/NTMzIzI=/-seri-2010--2--pdrb-atas-dasar-harga-konstan-menurut-pengeluaran--2010-100---milyar-rupiah-.html',
              sub: 'turvar: 1544 (KR), 1547 (PMTB), 1549 (Net Ekspor), 1550 (PDRB)',
              alasan: 'Dataset utama PDRB pengeluaran per provinsi. Mengandung 4 komponen yang diperlukan untuk menghitung IEKON.',
            },
            {
              var: '958', nama: 'Jumlah Penduduk Menurut Provinsi',
              satuan: 'Ribu Jiwa',
              link: 'https://sulut.bps.go.id/id/statistics-table/2/OTU4IzI=/jumlah-penduduk-menurut-provinsi-di-indonesia.html',
              sub: 'domain=0000, data tahunan',
              alasan: 'Pembagi untuk menghitung nilai per kapita setiap komponen PDRB. Satuan Ribu Jiwa konsisten dengan PDRB dalam Milyar Rupiah.',
            },
          ].map(d => (
            <div key={d.var} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded">Var {d.var}</span>
                  <a href={d.link} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-sky-600 underline underline-offset-2 flex items-center gap-1">
                    {d.nama} <ExternalLink size={10} className="opacity-60"/>
                  </a>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mb-1">{d.sub}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{d.alasan}</p>
              <div className="mt-2 text-[9px] text-slate-400">Satuan: {d.satuan}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Referensi */}
      <Section id="ref" color="bg-purple-500" title="Referensi Ilmiah" sub="5 sumber utama">
        <div className="space-y-3">
          {[
            { badge:'BPS · 2024', title:'PDRB Kabupaten Kolaka Timur menurut Pengeluaran 2019-2023', journal:'Badan Pusat Statistik', color:'#0ea5e9', doi:'https://www.bps.go.id', note:'Mendokumentasikan metodologi PDRB pengeluaran sebagai alat evaluasi kinerja pembangunan ekonomi regional.' },
            { badge:'Bisnis.com · Nov 2025', title:'Kinerja Ekonomi Kuartal III/2025', journal:'Bisnis.com / Sumber BPS', color:'#10b981', doi:'https://bisnis.com', note:'Melaporkan kontribusi KR (~53%) dan PMTB (~29%) terhadap PDB, memvalidasi bobot kedua komponen dalam IEKON.' },
            { badge:'Univ. Riau · 2024', title:'Pengaruh PDRB Per Kapita, PAD, dan IPM terhadap Ketimpangan Pembangunan', journal:'Suci Lapena Anggun Salita', color:'#f59e0b', doi:'https://unri.ac.id', note:'Menggunakan PMTB sebagai proksi investasi yang mencerminkan ekspansi kapasitas produksi.' },
            { badge:'Univ. Sumatera Utara · 2024', title:'Analisis Pengaruh IPM, Infrastruktur, dan PDRB Perkapita terhadap Ketimpangan Ekonomi', journal:'Ince Weya, USU', color:'#ef4444', doi:'https://usu.ac.id', note:'PDRB per kapita adalah indikator paling umum untuk tingkat kemakmuran suatu daerah.' },
            { badge:'Economy and Management Journal · 2016', title:'Using Min-Max Normalization to Measure Regional Economic Growth', journal:'Ji Xiaojiang et al.', color:'#8b5cf6', doi:'https://doi.org', note:'Memvalidasi Min-Max normalization untuk mengakomodasi rentang nilai yang sangat bervariasi antar daerah dalam satu indeks komposit.' },
          ].map((r, i) => (
            <div key={i} className="rounded-xl border p-4 dark:border-slate-700" style={{ borderColor: r.color + '40', backgroundColor: r.color + '08' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block" style={{ backgroundColor: r.color + '20', color: r.color }}>{r.badge}</span>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1.5">{r.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 italic">{r.journal}</div>
                </div>
                <a href={r.doi} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <ExternalLink size={13} className="text-slate-400" />
                </a>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{r.note}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── TAB INFO ─────────────────────────────────────────────────────────────────
function TabInfo({ hasilAnalisis, jumlahKategori, kategoriTerpilih, setKategoriTerpilih, eksporData, getWarna, getKategori }) {
  const [menuUnduh, setMenuUnduh] = useState(false);

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA')
      f = f.filter(x => getKategori(x) === kategoriTerpilih);
    return f;
  }, [hasilAnalisis, kategoriTerpilih]);

  if (!hasilAnalisis) return (
    <div className="py-12 text-center">
      <BarChart2 size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada data. Klik <strong>Analisis Ekonomi</strong> di peta untuk memulai.</p>
    </div>
  );

  const statsConfig = [
    { label:'Total Provinsi', val: hasilAnalisis.total_success || 0,  colorClass:'bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/30 text-sky-700 dark:text-sky-300' },
    { label:'TINGGI',         val: jumlahKategori['TINGGI'] ?? 0,     colorClass:'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300' },
    { label:'SEDANG',         val: jumlahKategori['SEDANG'] ?? 0,     colorClass:'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30 text-amber-700 dark:text-amber-300' },
    { label:'RENDAH',         val: jumlahKategori['RENDAH'] ?? 0,     colorClass:'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30 text-red-700 dark:text-red-300' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
            <Calendar size={9}/> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        {hasilAnalisis.tahun && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
            <Calendar size={9}/> Tahun {hasilAnalisis.tahun}
          </span>
        )}
      </div>

      {/* Formula ringkas */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Formula IEKON</div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
          KR = KonsumsiRT/Penduduk · I = PMTB/Penduduk · EN = NetEkspor/Penduduk · P = PDRB/Penduduk
          <br/>Normalisasi Min-Max → IEKON = (KR_n + I_n + EN_n + P_n) / 4
          <br/>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">TINGGI</span> &gt;0.70 ·{' '}
          <span className="font-bold text-amber-600 dark:text-amber-400">SEDANG</span> 0.40–0.70 ·{' '}
          <span className="font-bold text-red-600 dark:text-red-400">RENDAH</span> &lt;0.40
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
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {dataTerfilter.length} provinsi · Tahun {hasilAnalisis.tahun}
          </p>
          <div className="flex items-center gap-2">
            <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
              {['SEMUA','TINGGI','SEDANG','RENDAH'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="relative">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-xs transition-all shadow-sm" onClick={() => setMenuUnduh(!menuUnduh)}>
                <Download size={12}/> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-700 py-1">
                  {['EXCEL','CSV','JSON','GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                      <Download size={10} className="text-sky-500"/> {fmt}
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
                <th className="px-4 py-3 text-center">IEKON</th>
                <th className="px-4 py-3 text-center">KR/kap</th>
                <th className="px-4 py-3 text-center">PMTB/kap</th>
                <th className="px-4 py-3 text-center">Net/kap</th>
                <th className="px-4 py-3 text-center">PDRB/kap</th>
                <th className="px-4 py-3 text-center">KR_n</th>
                <th className="px-4 py-3 text-center">I_n</th>
                <th className="px-4 py-3 text-center">EN_n</th>
                <th className="px-4 py-3 text-center">P_n</th>
                <th className="px-4 py-3 text-center">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {dataTerfilter.map((fitur, idx) => {
                const d   = fitur.properties.ekon_analysis;
                const dc  = d.data_komponen || {};
                const w   = getWarna(fitur);
                const kat = getKategori(fitur);
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
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_ekonomi ?? '-'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-[10px] text-slate-500 dark:text-slate-400">{fmtRp(dc.kr_per_kapita)}</td>
                    <td className="px-4 py-2.5 text-center text-[10px] text-slate-500 dark:text-slate-400">{fmtRp(dc.pmtb_per_kapita)}</td>
                    <td className="px-4 py-2.5 text-center text-[10px] text-slate-500 dark:text-slate-400">{fmtRp(dc.net_per_kapita)}</td>
                    <td className="px-4 py-2.5 text-center text-[10px] text-slate-500 dark:text-slate-400">{fmtRp(dc.pdrb_per_kapita)}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{d.kr_norm   ?? '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-violet-600 dark:text-violet-400 font-semibold">{d.pmtb_norm ?? '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-amber-600  dark:text-amber-400  font-semibold">{d.net_norm  ?? '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-sky-600    dark:text-sky-400    font-semibold">{d.pdrb_norm ?? '-'}</td>
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
  'Transformasi':              '#6366f1',
  'Sistem Informasi':          '#3b82f6',
  'Kebijakan & Regulasi':      '#10b981',
  'Intervensi Sektoral':       '#f59e0b',
  'Produktivitas':             '#ef4444',
  'Stabilitas':                '#8b5cf6',
  'Perencanaan & Data':        '#06b6d4',
  'Kapasitas SDM':             '#ec4899',
  'Infrastruktur':             '#14b8a6',
  'Pemberdayaan Masyarakat':   '#f97316',
};
const getPilarColor = (pilar) => PILAR_COLORS[pilar] || '#0ea5e9';

function TabKebijakan({ hasilAnalisis, kategoriTerpilih, setKategoriTerpilih, getWarna, getKategori }) {
  const [provinsiPopup, setProvinsiPopup] = useState(null);
  const [searchProv,    setSearchProv]    = useState('');
  const [openPilar,     setOpenPilar]     = useState({});

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA')
      f = f.filter(x => getKategori(x) === kategoriTerpilih);
    if (searchProv.trim())
      f = f.filter(x => x.properties?.ekon_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [hasilAnalisis, kategoriTerpilih, searchProv]);

  if (!hasilAnalisis) return (
    <div className="py-12 text-center">
      <ClipboardList size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada data analisis.</p>
    </div>
  );

  const popupFitur = provinsiPopup
    ? hasilAnalisis.matched_features.features.find(f => f.properties?.ekon_analysis?.nama_provinsi === provinsiPopup)
    : null;
  const popupData = popupFitur?.properties?.ekon_analysis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-sky-500" size={15}/>
            Rekomendasi Kebijakan Ekonomi
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {dataTerfilter.length} provinsi · Tahun {hasilAnalisis.tahun}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={searchProv} onChange={e => setSearchProv(e.target.value)}
              placeholder="Cari provinsi..."
              className="pl-7 pr-7 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-sky-400 w-40"/>
            {searchProv && (
              <button onClick={() => setSearchProv('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={10}/>
              </button>
            )}
          </div>
          <select value={kategoriTerpilih} onChange={e => setKategoriTerpilih(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
            {['SEMUA','TINGGI','SEDANG','RENDAH'].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        {dataTerfilter.map(fitur => {
          const d     = fitur.properties.ekon_analysis;
          const w     = getWarna(fitur);
          const kat   = getKategori(fitur);
          const rekom = d.rekomendasi || [];
          return (
            <div key={d.nama_provinsi}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderLeft: `3px solid ${w}` }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{d.nama_provinsi}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                      style={{ borderColor: w + '60', color: w, backgroundColor: w + '15' }}>{kat}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] font-mono font-bold" style={{ color: w }}>IEKON {d.indeks_ekonomi ?? '-'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">KR {d.kr_norm ?? '-'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">INV {d.pmtb_norm ?? '-'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">EN {d.net_norm ?? '-'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">P {d.pdrb_norm ?? '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {rekom.length > 0 && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                      {rekom.length} pilar
                    </span>
                  )}
                  <button onClick={() => setProvinsiPopup(d.nama_provinsi)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-semibold transition-colors">
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
                    <span className="text-[9px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">P{rekom[0].prioritas}</span>
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
              style={{ borderLeft: `4px solid ${getWarna(popupFitur)}` }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{popupData.nama_provinsi}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                      style={{ borderColor: getWarna(popupFitur) + '60', color: getWarna(popupFitur), backgroundColor: getWarna(popupFitur) + '15' }}>
                      {getKategori(popupFitur)}
                    </span>
                    <span className="text-[10px] font-mono font-black" style={{ color: getWarna(popupFitur) }}>IEKON {popupData.indeks_ekonomi ?? '-'}</span>
                    {[['kr_norm','KR','emerald'],['pmtb_norm','INV','violet'],['net_norm','EN','amber'],['pdrb_norm','P','sky']].map(([k,lbl]) => (
                      <span key={k} className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
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
                <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                  <AlertCircle size={28} className="mx-auto mb-2 opacity-40"/>
                  <p className="text-sm font-medium">Belum ada rekomendasi kebijakan.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                    {popupData.rekomendasi.length} Pilar Kebijakan
                  </div>
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
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">{kelompok.jumlah_aksi} aksi</span>
                          </div>
                          <ChevronDown size={13} className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')}/>
                        </button>
                        {isOpen && (
                          <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                            {kelompok.aksi.map((aksi, ai) => (
                              <div key={ai} className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30">
                                <div className="flex items-start gap-2.5">
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[9px] font-black" style={{ backgroundColor: pc }}>
                                    {aksi.no_aksi || ai + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    {aksi.isu_strategis && <div className="text-[9px] italic text-slate-400 mb-0.5">Isu: {aksi.isu_strategis}</div>}
                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{aksi.nama_aksi}</div>
                                    {aksi.detail_aksi && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{aksi.detail_aksi}</p>}
                                    {aksi.indikator_terkait && (
                                      <span className="inline-block mt-1 text-[9px] px-2 py-0.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded font-semibold">
                                        {aksi.indikator_terkait}
                                      </span>
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

// ─── MAIN TABS WRAPPER (DEFAULT EXPORT) ───────────────────────────────────────
export default function TabsEkon({
  activeTab, setActiveTab,
  hasilAnalisis, jumlahKategori,
  kategoriTerpilih, setKategoriTerpilih,
  tahunTerpilih, daftarTersimpan,
  eksporData,
  getWarna, getKategori,
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-100 dark:border-slate-700">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all relative flex-1',
                active
                  ? 'text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-900/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              )}>
              <Icon size={14}/>
              <span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-t-full"/>}
            </button>
          );
        })}
      </div>
      <div className="p-5" style={{ overflowAnchor: 'none' }}>
        {activeTab === 'info' && (
          <TabInfo
            hasilAnalisis={hasilAnalisis}
            jumlahKategori={jumlahKategori}
            kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih}
            eksporData={eksporData}
            getWarna={getWarna}
            getKategori={getKategori}
          />
        )}
        {activeTab === 'kebijakan' && (
          <TabKebijakan
            hasilAnalisis={hasilAnalisis}
            kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih}
            getWarna={getWarna}
            getKategori={getKategori}
          />
        )}
        {activeTab === 'metadata' && (
          <MetadataPanel_EKON
            hasilAnalisis={hasilAnalisis}
            tahunTerpilih={tahunTerpilih}
          />
        )}
        {activeTab === 'tren' && (
          <TrendPanel_EKON daftarTersimpan={daftarTersimpan} />
        )}
      </div>
    </div>
  );
}