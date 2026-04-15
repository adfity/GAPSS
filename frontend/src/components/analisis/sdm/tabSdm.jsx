"use client";
import { useState, useMemo, useRef } from 'react';
import {
  Download, ChevronDown, Info, FileText, Calendar,
  BarChart2, Check, TrendingUp, TrendingDown, ClipboardList, BookOpen,
  AlertCircle, CheckCircle2, XCircle, AlertTriangle,
  Search, X, Activity, ExternalLink,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  INDIKATOR_LABELS_SDM,
  INDIKATOR_COLORS_SDM,
  INDIKATOR_ICON_SDM,
  TAHUN_TERSEDIA_SDM,
} from './petaSdm';

const cn = (...cls) => cls.filter(Boolean).join(' ');

const TABS = [
  { id: 'info',      label: 'Info',      Icon: Info          },
  { id: 'kebijakan', label: 'Kebijakan', Icon: ClipboardList },
  { id: 'metadata',  label: 'Metodologi',Icon: BookOpen      },
  { id: 'tren',      label: 'Tren',      Icon: TrendingUp    },
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

// ─── TREND PANEL SDM ──────────────────────────────────────────────────────────
export function TrendPanel_SDM({ daftarTersimpan, onTutup, embedded = false }) {
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
        TOTAL:  item.total_success ?? 0,
      });
    });
    Object.keys(byInd).forEach(ind => byInd[ind].sort((a, b) => a.tahun - b.tahun));
    return byInd;
  }, [daftarTersimpan]);

  const chartData     = trendData[filterInd] || [];
  const indsAvailable = Object.keys(trendData).filter(k => trendData[k].length > 0);
  const tahunCovered  = [...new Set(daftarTersimpan.map(d => d.tahun).filter(Boolean))].sort();
  const latestData    = chartData[chartData.length - 1];
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

  const radarData = useMemo(() => ['TINGGI', 'SEDANG', 'RENDAH'].map(kat => {
    const obj = { kategori: kat };
    indsAvailable.forEach(ind => {
      const s = trendData[ind];
      if (s?.length) obj[INDIKATOR_LABELS_SDM[ind] || ind] = s.at(-1)[kat] ?? 0;
    });
    return obj;
  }), [trendData, indsAvailable]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-indigo-500" size={20} />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Panel Tren SDM</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {daftarTersimpan.length} analisis · {tahunCovered.length} tahun ({tahunCovered.join(', ')})
            </p>
          </div>
        </div>
      </div>

      {daftarTersimpan.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
            <TrendingUp size={28} className="text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada data tersimpan</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Jalankan analisis dan simpan untuk melihat tren</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label:'Total Analisis', val: daftarTersimpan.length,    color:'indigo' },
              { label:'Tahun Tercakup', val: tahunCovered.length,       color:'blue'   },
              { label:'TINGGI Terbaru', val: latestData?.TINGGI ?? '-', color:'green',  delta: delta?.TINGGI, positif: true  },
              { label:'RENDAH Terbaru', val: latestData?.RENDAH ?? '-', color:'red',    delta: delta?.RENDAH, positif: false },
            ].map(c => (
              <div key={c.label} className={`bg-${c.color}-50 dark:bg-${c.color}-900/20 rounded-xl p-3 border border-${c.color}-100 dark:border-${c.color}-800/30`}>
                <div className={`text-[10px] font-semibold text-${c.color}-600 dark:text-${c.color}-400 mb-1`}>{c.label}</div>
                <div className={`text-2xl font-black text-${c.color}-700 dark:text-${c.color}-300`}>{c.val}</div>
                {c.delta != null && <DeltaBadge val={c.delta} positif={c.positif} />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              {['ALL', 'KESEHATAN', 'PENDIDIKAN', 'DAYA_BELI'].map(ind => {
                const ada = indsAvailable.includes(ind);
                return (
                  <button key={ind} onClick={() => ada && setFilterInd(ind)}
                    className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1',
                      filterInd === ind ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                      : ada ? 'text-slate-500 dark:text-slate-400 hover:text-slate-700' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed')}>
                    <span style={{ color: filterInd === ind ? INDIKATOR_COLORS_SDM[ind] : undefined }}>{INDIKATOR_ICON_SDM[ind]}</span>
                    {ind === 'ALL' ? 'Semua' : INDIKATOR_LABELS_SDM[ind].replace('Indeks ', '')}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 ml-auto">
              {[['distribusi','Bar',<BarChart2 size={11}/>],['area','Area',<TrendingUp size={11}/>],['radar','Radar',<Activity size={11}/>]].map(([key,lbl,icon]) => (
                <button key={key} onClick={() => setChartMode(key)}
                  className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1',
                    chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')}>
                  {icon} {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              {chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Tidak ada data</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {chartMode === 'distribusi' && 'Distribusi Kategori SDM per Tahun'}
                        {chartMode === 'area'        && 'Tren Kumulatif Kategori SDM'}
                        {chartMode === 'radar'       && 'Perbandingan Lintas Indikator'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{INDIKATOR_LABELS_SDM[filterInd]} · {chartData.length} titik data</div>
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
                      <BarChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
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
                      <AreaChart data={chartData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
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
                        {indsAvailable.map(ind => (
                          <Radar key={ind} name={INDIKATOR_LABELS_SDM[ind]} dataKey={INDIKATOR_LABELS_SDM[ind]}
                            stroke={INDIKATOR_COLORS_SDM[ind]} fill={INDIKATOR_COLORS_SDM[ind]} fillOpacity={0.15} strokeWidth={2} />
                        ))}
                        <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize:'10px' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">% Provinsi TINGGI</div>
                <div className="space-y-2.5">
                  {indsAvailable.map(ind => {
                    const last  = trendData[ind].at(-1);
                    const total = (last.TINGGI + last.SEDANG + last.RENDAH) || 1;
                    const pct   = Math.round((last.TINGGI / total) * 100);
                    return (
                      <div key={ind}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span style={{ color: INDIKATOR_COLORS_SDM[ind] }}>{INDIKATOR_ICON_SDM[ind]}</span>
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{INDIKATOR_LABELS_SDM[ind].replace('Indeks ', '')}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-900 dark:text-white">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: INDIKATOR_COLORS_SDM[ind] }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                          <span>{last.TINGGI} Tinggi</span><span>{last.RENDAH} Rendah</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Cakupan Tahun</div>
                <div className="flex flex-wrap gap-1.5">
                  {TAHUN_TERSEDIA_SDM.map(thn => {
                    const ada = tahunCovered.includes(thn);
                    return (
                      <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-[10px] font-semibold border',
                        ada ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400')}>
                        {thn}{ada && ' ✓'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// METADATA / METODOLOGI PANEL
// Perbaikan:
//  - Accordion tidak lagi menyebabkan scroll ke atas (overflow-anchor: none)
//  - Var ID disesuaikan dengan BE (414=UHH, 415=RLS, 417=HLS, 416=DAYA_BELI)
//  - Link langsung ke dataset BPS
//  - Formula menggunakan UHH bukan AHH
// ══════════════════════════════════════════════════════════════════════════════
export function MetadataPanel_SDM({ hasilAnalisis, indikatorTerpilih, tahunTerpilih, onTutup, embedded = false }) {
  const [openSections, setOpenSections] = useState({ formula: true, komponen: true, norm: false, klasif: false, dataset: false, ref: false });

  const toggle = (k) => setOpenSections(prev => ({ ...prev, [k]: !prev[k] }));

  const ind = hasilAnalisis?.indikator || indikatorTerpilih || 'ALL';
  const thn = hasilAnalisis?.tahun     || tahunTerpilih     || 2024;

  // Section accordion - TIDAK scroll ke atas saat expand
  // Menggunakan div + onClick (bukan button submit) dan overflow-anchor: none
  const Section = ({ id, title, sub, color, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
      style={{ overflowAnchor: 'none' }}>
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
        onClick={() => toggle(id)}
        onKeyDown={(e) => e.key === 'Enter' && toggle(id)}>
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
    // overflow-anchor: none pada kontainer luar mencegah browser scroll saat konten mengembang
    <div className="space-y-3" style={{ overflowAnchor: 'none' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400"/>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">Metodologi & Formula ISDM</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Diadaptasi dari IPM BPS · 3 Komponen · 3 Kelas Status
          </p>
        </div>
      </div>

      {/* ── Formula Utama ── */}
      <Section id="formula" color="bg-indigo-500" title="Formula Indeks SDM" sub="Rata-rata 3 komponen IPM BPS">
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
            <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Formula Utama</div>
            <code className="block text-base font-mono font-black text-slate-900 dark:text-white">ISDM = (IK + IP + IDB) / 3</code>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Indeks SDM merupakan rata-rata sederhana dari tiga sub-indeks: Kesehatan (IK), Pendidikan (IP), dan Daya Beli (IDB). Pendekatan ini konsisten dengan metodologi Indeks Pembangunan Manusia (IPM) BPS.
            </p>
          </div>

          <div className="grid gap-3">
            {/* IK */}
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">IK - Indeks Kesehatan</span>
                <code className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-300 flex-shrink-0">UHH / 85</code>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Umur Harapan Hidup (UHH) dibagi konstanta <strong>85 tahun</strong> sebagai batas atas (benchmark World Bank HCI). Hasilnya adalah nilai 0–1.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-semibold">
                  BPS Var 414 - UHH
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                  Target: 85 tahun (World Bank HCI)
                </span>
              </div>
            </div>

            {/* IP */}
            <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/20 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">IP - Indeks Pendidikan</span>
                <code className="text-sm font-mono font-black text-blue-700 dark:text-blue-300 flex-shrink-0">(RLS/15 + HLS/18) / 2</code>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">RLS/15 :</span>
                  <span>Rata-rata Lama Sekolah dibagi <strong>15 tahun</strong> (setara lulus SMA+). BPS Var 415.</span>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">HLS/18 :</span>
                  <span>Harapan Lama Sekolah dibagi <strong>18 tahun</strong> (setara lulus S2). BPS Var 417.</span>
                </div>
              </div>
            </div>

            {/* IDB */}
            <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">IDB - Indeks Daya Beli</span>
                <code className="text-sm font-mono font-black text-amber-700 dark:text-amber-300 flex-shrink-0">(X − X_min) / (X_max − X_min)</code>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Pengeluaran per Kapita Disesuaikan (BPS Var 416) dinormalisasi dengan metode <strong>Min-Max</strong> antar provinsi. Nilai 0 = provinsi terendah, nilai 1 = provinsi tertinggi dalam dataset.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Klasifikasi ── */}
      <Section id="klasif" color="bg-rose-500" title="Klasifikasi Status ISDM" sub="3 kelas - selaras dengan bank_kebijakan">
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            Ambang batas 0.70 dan 0.60 diadaptasi dari kategori IPM BPS (skala 0–100 dikonversi ke 0–1). Tiga kelas ini konsisten dengan kolom <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">status</code> pada tabel <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">bank_kebijakan</code>.
          </p>
          {[
            { label:'TINGGI', range:'ISDM ≥ 0.70', color:'#10b981', colorBg:'bg-emerald-50 dark:bg-emerald-950/20', colorBorder:'border-emerald-200 dark:border-emerald-800/50',
              desc:'Provinsi dengan kualitas SDM baik. Intervensi kebijakan bersifat pemeliharaan dan peningkatan daya saing regional.',
              contoh: 'DKI Jakarta, DI Yogyakarta, Kepulauan Riau, Kalimantan Timur' },
            { label:'SEDANG', range:'0.60 ≤ ISDM < 0.70', color:'#f59e0b', colorBg:'bg-amber-50 dark:bg-amber-950/20', colorBorder:'border-amber-200 dark:border-amber-800/50',
              desc:'SDM moderat. Perlu intervensi terarah pada komponen terlemah (IK, IP, atau IDB). Prioritaskan kebijakan yang memberikan dampak multiplier terbesar.',
              contoh: 'Sebagian besar provinsi di Sumatera dan Jawa' },
            { label:'RENDAH', range:'ISDM < 0.60', color:'#ef4444', colorBg:'bg-red-50 dark:bg-red-950/20', colorBorder:'border-red-200 dark:border-red-800/50',
              desc:'SDM rendah - prioritas utama kebijakan nasional. Memerlukan intervensi komprehensif di semua komponen.',
              contoh: 'Sebagian besar provinsi di Papua dan Nusa Tenggara' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl border-2 p-4', s.colorBg, s.colorBorder)}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ backgroundColor: s.color + '20', color: s.color }}>{s.label}</span>
                <code className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{s.range}</code>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{s.desc}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 italic">Contoh: {s.contoh}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Dataset ── */}
      <Section id="dataset" color="bg-teal-500" title="Dataset Sumber BPS" sub={`4 Variabel IPM - Tahun ${thn}`}>
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Seluruh dataset diambil dari BPS Web API. Klik nama dataset untuk membuka tabel di situs BPS.
          </p>
          {[
            {
              var: '414',
              nama: 'Umur Harapan Hidup (UHH)',
              satuan: 'Tahun',
              komponen: 'IK',
              target: '/ 85',
              link: 'https://www.bps.go.id/id/statistics-table/2/NDE0IzI=/-metode-baru--umur-harapan-hidup-saat-lahir--uhh---tahun-.html',
              alasan: 'UHH adalah proxy terbaik untuk mengukur kesehatan populasi subnasional. Target 85 tahun mengikuti World Bank HCI 2018.',
            },
            {
              var: '415',
              nama: 'Rata-rata Lama Sekolah (RLS)',
              satuan: 'Tahun',
              komponen: 'IP',
              target: '/ 15',
              link: 'https://www.bps.go.id/id/statistics-table/2/NDE1IzI=/-metode-baru--rata-rata-lama-sekolah--tahun-.html',
              alasan: 'RLS mengukur stok pendidikan penduduk dewasa (≥25 tahun). Target 15 tahun = setara lulus SMA + 1 tahun pendidikan tinggi.',
            },
            {
              var: '417',
              nama: 'Harapan Lama Sekolah (HLS)',
              satuan: 'Tahun',
              komponen: 'IP',
              target: '/ 18',
              link: 'https://www.bps.go.id/id/statistics-table/2/NDE3IzI=/-metode-baru--harapan-lama-sekolah--tahun-.html',
              alasan: 'HLS mengukur prospek pendidikan generasi mendatang. Melengkapi RLS yang bersifat backward-looking. Target 18 tahun = setara lulus S2.',
            },
            {
              var: '416',
              nama: 'Pengeluaran per Kapita Disesuaikan',
              satuan: 'Ribu Rp/Orang/Tahun',
              komponen: 'IDB',
              target: 'Min-Max',
              link: 'https://www.bps.go.id/assets/statistics-table/2/NDE2IzI=/-metode-baru--pengeluaran-per-kapita-disesuaikan.html',
              alasan: 'Proksi standar hidup yang mencerminkan daya beli riil. Menggunakan paritas daya beli (PPP). Normalisasi Min-Max karena satuan Rupiah.',
            },
          ].map(d => (
            <div key={d.var} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">Var {d.var}</span>
                  <a href={d.link} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2 transition-colors flex items-center gap-1">
                    {d.nama}
                    <ExternalLink size={10} className="opacity-60"/>
                  </a>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{d.komponen}</span>
                  <code className="text-[9px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">{d.target}</code>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{d.alasan}</p>
              <div className="mt-2 text-[9px] text-slate-400 dark:text-slate-500">Satuan: {d.satuan}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Referensi ── */}
      <Section id="ref" color="bg-purple-500" title="Referensi Ilmiah" sub="3 sumber utama - World Bank, BPS, Sari & Tiwari (2024)">
        <div className="space-y-3">
          {[
            {
              badge:'World Bank · 2018',
              title:'The Human Capital Project',
              journal:'World Bank Group',
              color:'#0ea5e9',
              doi:'https://www.worldbank.org/en/publication/human-capital',
              note:'Menetapkan target UHH 85 tahun sebagai denominator IK. Framework HCI World Bank menjadi acuan global dalam pengukuran kapital manusia subnasional.',
            },
            {
              badge:'Social Indicators Research · 2024',
              title:'The Geography of Human Capital: Subnational HCI in Indonesia',
              journal:'Sari & Tiwari - Vol. 172',
              color:'#10b981',
              doi:'https://doi.org/10.1007/s11205-024-03322-x',
              note:'Memvalidasi penggunaan UHH, RLS, dan HLS sebagai komponen ISDM di level provinsi Indonesia. Menemukan bahwa potensi kapital manusia generasi muda hanya mencapai 53% dari benchmark penuh.',
            },
            {
              badge:'BPS Indonesia · 2025',
              title:'Indeks Pembangunan Manusia (IPM) Indonesia 2025',
              journal:'Badan Pusat Statistik',
              color:'#f59e0b',
              doi:'https://www.bps.go.id',
              note:'Sumber utama metodologi perhitungan: denominator RLS/15, HLS/18, dan Pengeluaran per Kapita diadopsi dari metodologi IPM BPS. Klasifikasi 4 kategori IPM BPS disederhanakan menjadi 3 kelas ISDM.',
            },
          ].map((r, i) => (
            <div key={i} className="rounded-xl border p-4 dark:border-slate-700" style={{ borderColor: r.color + '40', backgroundColor: r.color + '08' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block" style={{ backgroundColor: r.color + '20', color: r.color }}>{r.badge}</span>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1.5">{r.title}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic">{r.journal}</div>
                </div>
                <a href={r.doi} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Buka referensi">
                  <ExternalLink size={13} className="text-slate-400 dark:text-slate-500" />
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

// ══════════════════════════════════════════════════════════════════════════════
// TAB INFO - UHH bukan AHH, DAYA_BELI bukan PENGELUARAN
// ══════════════════════════════════════════════════════════════════════════════
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
      <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada data. Klik <strong>Analisis SDM</strong> di peta untuk memulai.</p>
    </div>
  );

  const statsConfig = [
    { label:'Total Provinsi', val: hasilAnalisis.total_success || 0, colorClass:'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-300' },
    { label:'TINGGI',         val: jumlahKategori['TINGGI'] ?? 0,    colorClass:'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300' },
    { label:'SEDANG',         val: jumlahKategori['SEDANG'] ?? 0,    colorClass:'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30 text-amber-700 dark:text-amber-300' },
    { label:'RENDAH',         val: jumlahKategori['RENDAH'] ?? 0,    colorClass:'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30 text-red-700 dark:text-red-300' },
  ];

  // Sesuai BE: UHH, HLS, RLS, DAYA_BELI
  const showUHH  = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'KESEHATAN';
  const showRLS  = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'PENDIDIKAN';
  const showHLS  = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'PENDIDIKAN';
  const showPeng = indikatorTerpilih === 'ALL' || indikatorTerpilih === 'DAYA_BELI';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
            <Calendar size={9}/> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        {hasilAnalisis.tahun && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <Calendar size={9}/> Tahun {hasilAnalisis.tahun}
          </span>
        )}
      </div>

      {/* Formula ringkas - UHH/85 */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Formula ISDM</div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
          IK = UHH/85 · IP = (RLS/15 + HLS/18)/2 · IDB = MinMax(Pengeluaran) · ISDM = (IK+IP+IDB)/3
          <br/>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">TINGGI</span> ≥0.70 ·{' '}
          <span className="font-bold text-amber-600 dark:text-amber-400">SEDANG</span> 0.60–0.70 ·{' '}
          <span className="font-bold text-red-600 dark:text-red-400">RENDAH</span> &lt;0.60
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
              <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-all shadow-sm" onClick={() => setMenuUnduh(!menuUnduh)}>
                <Download size={12}/> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-700 py-1">
                  {['EXCEL','CSV','JSON','GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                      <Download size={10} className="text-indigo-500"/> {fmt}
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
                <th className="px-4 py-3 text-center">ISDM</th>
                {/* Sesuai BE: UHH, RLS, HLS, DAYA_BELI */}
                {showUHH  && <th className="px-4 py-3 text-center">UHH</th>}
                {showRLS  && <th className="px-4 py-3 text-center">RLS</th>}
                {showHLS  && <th className="px-4 py-3 text-center">HLS</th>}
                {showPeng && <th className="px-4 py-3 text-center">Pengeluaran</th>}
                <th className="px-4 py-3 text-center">IK</th>
                <th className="px-4 py-3 text-center">IP</th>
                <th className="px-4 py-3 text-center">IDB</th>
                <th className="px-4 py-3 text-center">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {dataTerfilter.map((fitur, idx) => {
                const d   = fitur.properties.sdm_analysis;
                const dc  = d.data_komponen || {};
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
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_sdm ?? '-'}</span>
                    </td>
                    {/* Sesuai BE: dc.UHH, dc.RLS, dc.HLS, dc.DAYA_BELI */}
                    {showUHH  && <td className="px-4 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400">{dc.UHH       ?? '-'}</td>}
                    {showRLS  && <td className="px-4 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400">{dc.RLS       ?? '-'}</td>}
                    {showHLS  && <td className="px-4 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400">{dc.HLS       ?? '-'}</td>}
                    {showPeng && <td className="px-4 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
                      {dc.DAYA_BELI ? dc.DAYA_BELI.toLocaleString('id-ID') : '-'}
                    </td>}
                    <td className="px-4 py-2.5 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{d.ik  ?? '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-blue-600   dark:text-blue-400   font-semibold">{d.ip  ?? '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-amber-600  dark:text-amber-400  font-semibold">{d.idb ?? '-'}</td>
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

// ══════════════════════════════════════════════════════════════════════════════
// TAB KEBIJAKAN
// ══════════════════════════════════════════════════════════════════════════════
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
const getPilarColor = (pilar) => PILAR_COLORS[pilar] || '#6366f1';

function TabKebijakan({ hasilAnalisis, indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih, getWarna, getKategori }) {
  const [provinsiPopup, setProvinsiPopup] = useState(null);
  const [searchProv,    setSearchProv]    = useState('');
  const [openPilar,     setOpenPilar]     = useState({});

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA')
      f = f.filter(x => getKategori(x, indikatorTerpilih) === kategoriTerpilih);
    if (searchProv.trim())
      f = f.filter(x => x.properties?.sdm_analysis?.nama_provinsi?.toLowerCase().includes(searchProv.toLowerCase()));
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih, searchProv]);

  if (!hasilAnalisis) return (
    <div className="py-12 text-center">
      <ClipboardList size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
      <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada data analisis.</p>
    </div>
  );

  const popupFitur = provinsiPopup
    ? hasilAnalisis.matched_features.features.find(f => f.properties?.sdm_analysis?.nama_provinsi === provinsiPopup)
    : null;
  const popupData  = popupFitur?.properties?.sdm_analysis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-indigo-500" size={15}/>
            Rekomendasi Kebijakan SDM
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
              className="pl-7 pr-7 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-400 w-40"/>
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
          const d     = fitur.properties.sdm_analysis;
          const w     = getWarna(fitur, indikatorTerpilih);
          const kat   = getKategori(fitur, indikatorTerpilih);
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
                    <span className="text-[10px] font-mono font-bold" style={{ color: w }}>ISDM {d.indeks_sdm ?? '-'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">IK {d.ik ?? '-'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">IP {d.ip ?? '-'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">IDB {d.idb ?? '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {rekom.length > 0 && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                      {rekom.length} pilar
                    </span>
                  )}
                  <button onClick={() => setProvinsiPopup(d.nama_provinsi)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold transition-colors">
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

      {/* Detail Modal */}
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
                      style={{ borderColor: getWarna(popupFitur, indikatorTerpilih) + '60', color: getWarna(popupFitur, indikatorTerpilih), backgroundColor: getWarna(popupFitur, indikatorTerpilih) + '15' }}>
                      {getKategori(popupFitur, indikatorTerpilih)}
                    </span>
                    <span className="text-[10px] font-mono font-black" style={{ color: getWarna(popupFitur, indikatorTerpilih) }}>ISDM {popupData.indeks_sdm ?? '-'}</span>
                    {['ik','ip','idb'].map(k => (
                      <span key={k} className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {k.toUpperCase()} {popupData[k] ?? '-'}
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
                                    {aksi.isu_strategis && (
                                      <div className="text-[9px] italic text-slate-400 dark:text-slate-500 mb-0.5">Isu: {aksi.isu_strategis}</div>
                                    )}
                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{aksi.nama_aksi}</div>
                                    {aksi.detail_aksi && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{aksi.detail_aksi}</p>
                                    )}
                                    {aksi.indikator_terkait && (
                                      <span className="inline-block mt-1 text-[9px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded font-semibold">
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN TABS WRAPPER (DEFAULT EXPORT)
// ══════════════════════════════════════════════════════════════════════════════
export default function TabsSDM({
  activeTab, setActiveTab,
  hasilAnalisis, jumlahKategori,
  indikatorTerpilih, kategoriTerpilih, setKategoriTerpilih,
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
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              )}>
              <Icon size={14}/>
              <span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full"/>}
            </button>
          );
        })}
      </div>
      <div className="p-5" style={{ overflowAnchor: 'none' }}>
        {activeTab === 'info' && (
          <TabInfo
            hasilAnalisis={hasilAnalisis}
            jumlahKategori={jumlahKategori}
            indikatorTerpilih={indikatorTerpilih}
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
            indikatorTerpilih={indikatorTerpilih}
            kategoriTerpilih={kategoriTerpilih}
            setKategoriTerpilih={setKategoriTerpilih}
            getWarna={getWarna}
            getKategori={getKategori}
          />
        )}
        {activeTab === 'metadata' && (
          <MetadataPanel_SDM
            hasilAnalisis={hasilAnalisis}
            indikatorTerpilih={indikatorTerpilih}
            tahunTerpilih={tahunTerpilih}
            onTutup={null}
            embedded={true}
          />
        )}
        {activeTab === 'tren' && (
          <TrendPanel_SDM daftarTersimpan={daftarTersimpan} onTutup={null} embedded={true}/>
        )}
      </div>
    </div>
  );
}