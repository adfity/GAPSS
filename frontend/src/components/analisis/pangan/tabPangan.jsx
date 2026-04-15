"use client";
import React, { useState, useEffect } from 'react';
import {
  Download, BookOpen, Loader2, CheckCircle2, XCircle, AlertTriangle,
  AlertCircle, Check, BarChart2, ChevronDown, Info, Bot,
  Cpu, Activity, TrendingUp, ShieldCheck, Sprout, Users,
  Filter, Calendar,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import toast from 'react-hot-toast';
import { cn, Card, Btn, SectionBar, AIBadge } from './petaSection';

// ─── Constants
const STATUS_PANGAN = {
  TINGGI: { warna: '#10b981', label: 'TINGGI' },
  SEDANG: { warna: '#f59e0b', label: 'SEDANG' },
  RENDAH: { warna: '#ef4444', label: 'RENDAH' },
};

const DATASET_LABELS = {
  PADI:       'Produksi, Luas Panen & Produktivitas Padi',
  KONSUMSI:   'Konsumsi Kalori & Protein per Kapita',
  KEMISKINAN: 'Persentase Penduduk Miskin',
  PENDUDUK:   'Jumlah Penduduk',
};

const PRIORITY_STYLE = {
  Tinggi: { bar: 'bg-red-500',   badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
  Sedang: { bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  Rendah: { bar: 'bg-green-500', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' },
};

const insightStyle = (txt) => {
  const t = txt.toLowerCase();
  if (t.includes('baik') || t.includes('cukup') || t.includes('terpenuhi') || t.includes('tinggi'))
    return { cls: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800', Icon: CheckCircle2, iconCls: 'text-green-500' };
  if (t.includes('rendah') || t.includes('bawah') || t.includes('lemah') || t.includes('rawan'))
    return { cls: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800', Icon: XCircle, iconCls: 'text-red-400' };
  if (t.includes('sedang') || t.includes('mendekati') || t.includes('perlu'))
    return { cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', Icon: AlertTriangle, iconCls: 'text-amber-500' };
  return { cls: 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700', Icon: Info, iconCls: 'text-slate-400' };
};

// ─── Tab: Info (dengan tabel provinsi)
export function TabInfo({ hasilAnalisis, jumlahStatus, eksporData }) {
  const [filterStatus, setFilterStatus] = useState('SEMUA');
  const [menuUnduh, setMenuUnduh]       = useState(false);

  if (!hasilAnalisis) return (
    <div className="py-10 text-center">
      <BarChart2 size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Belum ada data. Klik <strong>Analisis Pangan</strong> di peta untuk memulai.
      </p>
    </div>
  );

  const isAI    = hasilAnalisis.is_ai_prediction;
  const summary = hasilAnalisis?.analysis_summary || [];
  const filtered = filterStatus === 'SEMUA' ? summary : summary.filter(p => p.status === filterStatus);

  const statsConfig = [
    { label: 'TOTAL PROVINSI', val: hasilAnalisis.total_provinsi || hasilAnalisis.total_success || 0, cls: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300' },
    { label: 'TINGGI',         val: jumlahStatus.TINGGI, cls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' },
    { label: 'SEDANG',         val: jumlahStatus.SEDANG, cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300' },
    { label: 'RENDAH',         val: jumlahStatus.RENDAH, cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300' },
  ];

  return (
    <div className="space-y-4">
      {isAI && <AIBadge version={hasilAnalisis.model_version} scores={hasilAnalisis.model_scores} />}

      {hasilAnalisis.timestamp && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Calendar size={11} />
          {isAI ? 'Waktu prediksi:' : 'Waktu pengambilan data:'}{' '}
          {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
        </div>
      )}

      {!isAI && hasilAnalisis.dataset_aktif?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dataset Aktif:</span>
          {hasilAnalisis.dataset_aktif.map(k => (
            <span key={k} className="text-[10px] font-medium px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-600">
              {DATASET_LABELS[k]?.split(' & ')[0].split(',')[0] ?? k}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsConfig.map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-60 mb-1">{s.label}</div>
            <div className="text-2xl font-black">{s.val}</div>
          </div>
        ))}
      </div>

      {!isAI && hasilAnalisis.ada_data_kosong && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            <strong>{hasilAnalisis.total_data_kosong}</strong> provinsi tidak dapat dieksekusi karena datanya kosong.
          </p>
        </div>
      )}

      {isAI && hasilAnalisis.model_scores && (
        <div className="border border-purple-200 dark:border-purple-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-2">
            <Cpu size={13} className="text-purple-500" />
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
              Skor Model AI (Cross-Validation 5-Fold)
            </span>
          </div>
          <div className="grid grid-cols-5 divide-x divide-slate-100 dark:divide-slate-700">
            {Object.entries(hasilAnalisis.model_scores).map(([k, s]) => (
              <div key={k} className="px-3 py-2.5 text-center">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">{k.toUpperCase()}</div>
                <div className="text-sm font-black text-slate-800 dark:text-white">{s.cv_r2?.toFixed(3)}</div>
                <div className="text-[9px] text-slate-400">R²</div>
                <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5">{s.cv_mae?.toFixed(4)}</div>
                <div className="text-[9px] text-slate-400">MAE</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formula */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dasar Penilaian IKP</div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
          IKP = 0.4×(RPP + PL)/2 + 0.3×IK + 0.3×IA {'(setelah normalisasi Min-Max). '}
          <span className="font-bold text-emerald-600 dark:text-emerald-400">TINGGI</span> ≥ 0.70 ·{' '}
          <span className="font-bold text-amber-600 dark:text-amber-400">SEDANG</span> 0.50–0.70 ·{' '}
          <span className="font-bold text-red-600 dark:text-red-400">RENDAH</span> {'< 0.50'}
        </p>
      </div>

      {/* ─── Tabel Provinsi ─── */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {filtered.length} provinsi · Tahun {hasilAnalisis.tahun}
            {isAI && <span className="ml-2 text-purple-400 font-semibold">· 🤖 Prediksi AI</span>}
            {!isAI && hasilAnalisis.ada_data_kosong && (
              <span className="ml-2 text-amber-500">· {hasilAnalisis.total_data_kosong} data kosong</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
              {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {eksporData && (
              <div className="relative">
                <Btn variant="primary" className="px-3 py-1.5 text-xs" onClick={() => setMenuUnduh(!menuUnduh)}>
                  <Download size={12} /> Unduh
                </Btn>
                {menuUnduh && (
                  <div className="absolute top-full mt-1 right-0 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-700 py-1">
                    {['EXCEL', 'CSV', 'JSON', 'GEOJSON'].map(fmt => (
                      <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                        <Download size={10} className="text-green-500" /> {fmt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isAI && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700 text-xs text-purple-700 dark:text-purple-300">
            <Bot size={12} className="shrink-0" />
            <span>Nilai RPP, PL, IK, IA, dan IKP merupakan <strong>hasil prediksi model AI</strong>, bukan data real BPS.</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                <th className="px-3 py-3 text-center w-8">No</th>
                <th className="px-4 py-3 text-left">Provinsi</th>
                <th className="px-4 py-3 text-center">IKP</th>
                <th className="px-4 py-3 text-center">RPP</th>
                <th className="px-4 py-3 text-center">PL</th>
                <th className="px-4 py-3 text-center">IK</th>
                <th className="px-4 py-3 text-center">IA</th>
                <th className="px-4 py-3 text-center">% Miskin</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const noData   = !p.has_complete_data && p.status === '-';
                const partData = !p.has_complete_data && p.status !== '-';
                const warna    = p.warna || '#94a3b8';
                return (
                  <tr key={p.provinsi}
                    className={cn(
                      'border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors',
                      noData ? 'opacity-40' : partData ? 'opacity-70' : ''
                    )}>
                    <td className="px-2 py-2.5 text-center text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: warna }} />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{p.provinsi}</span>
                        {p.is_prediction && <Bot size={9} className="text-purple-400 shrink-0" title="Prediksi AI" />}
                        {partData && <span className="text-[8px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded font-medium">Parsial</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                        {p.ikp != null ? p.ikp.toFixed(4) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{p.rpp != null ? p.rpp.toFixed(4) : '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{p.pl  != null ? p.pl.toFixed(2)  : '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{p.ik  != null ? p.ik.toFixed(4)  : '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{p.ia  != null ? p.ia.toFixed(4)  : '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                      {p.ia != null ? `${((1 - p.ia) * 100).toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.status !== '-'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ borderColor: warna + '60', color: warna, backgroundColor: warna + '15' }}>{p.status}</span>
                        : <span className="text-xs text-slate-400">-</span>
                      }
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

// ─── Tab: Kebijakan (accordion provinsi)
export function TabKebijakan({ hasilAnalisis, statusTerpilih, setStatusTerpilih }) {
  const [expandedProv, setExpandedProv] = useState(null);

  if (!hasilAnalisis) return (
    <div className="py-10 text-center">
      <ShieldCheck size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Belum ada data. Jalankan analisis terlebih dahulu.
      </p>
    </div>
  );

  const isAI    = hasilAnalisis.is_ai_prediction;
  const summary = hasilAnalisis?.analysis_summary || [];
  const filtered = statusTerpilih === 'SEMUA' ? summary : summary.filter(p => p.status === statusTerpilih);

  const getFeatureData = (provName) =>
    hasilAnalisis?.matched_features?.features
      ?.find(f => f.properties?.pangan_analysis?.nama_provinsi === provName)
      ?.properties?.pangan_analysis || null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {filtered.length} provinsi · Tahun {hasilAnalisis.tahun}
          {isAI && <span className="ml-2 text-purple-400 font-semibold">· 🤖 Prediksi AI</span>}
          <span className="ml-2 text-indigo-400">· Klik provinsi untuk detail kebijakan</span>
        </p>
        <select value={statusTerpilih} onChange={e => setStatusTerpilih(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
          {['SEMUA', 'TINGGI', 'SEDANG', 'RENDAH'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Accordion list */}
      <div className="space-y-2">
        {filtered.map(p => {
          const warna      = p.warna || '#94a3b8';
          const isExpanded = expandedProv === p.provinsi;
          const featData   = isExpanded ? getFeatureData(p.provinsi) : null;
          const hasPolicy  = featData?.insights?.length || featData?.rekomendasi?.length;

          return (
            <div key={p.provinsi}
              className={cn('rounded-2xl border-2 overflow-hidden transition-all duration-200',
                isExpanded
                  ? 'border-indigo-300 dark:border-indigo-700 shadow-md'
                  : 'border-slate-200 dark:border-slate-700'
              )}>
              {/* Header baris */}
              <button
                onClick={() => setExpandedProv(isExpanded ? null : p.provinsi)}
                className={cn(
                  'w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left',
                  isExpanded
                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                )}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: warna }} />
                <span className={cn('text-sm font-bold flex-1',
                  isExpanded ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'
                )}>
                  {p.provinsi}
                </span>
                {p.is_prediction && <Bot size={11} className="text-purple-400 shrink-0" title="Prediksi AI" />}
                <span className="text-xs font-mono font-black shrink-0" style={{ color: warna }}>
                  IKP {p.ikp != null ? p.ikp.toFixed(3) : '-'}
                </span>
                {p.status !== '-' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                    style={{ borderColor: warna + '60', color: warna, backgroundColor: warna + '15' }}>
                    {p.status}
                  </span>
                )}
                <ChevronDown size={14} className={cn(
                  'text-slate-400 transition-transform duration-200 shrink-0',
                  isExpanded && 'rotate-180 text-indigo-500'
                )} />
              </button>

              {/* Konten expanded */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  {hasPolicy ? (
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-700">
                      {/* Analisis Kondisi */}
                      <div className="p-5 bg-white dark:bg-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-4 rounded-full bg-blue-400" />
                          <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            Analisis Kondisi
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {(featData.insights || []).map((insight, idx) => {
                            const { cls, Icon: IIcon, iconCls } = insightStyle(insight);
                            const cleanText = insight.replace(/^[\u{1F300}-\u{1FFFF}\u2600-\u26FF\u2700-\u27BF\s]+/u, '').trim();
                            return (
                              <div key={idx} className={cn('flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs text-slate-700 dark:text-slate-300 leading-relaxed', cls)}>
                                <IIcon size={12} className={cn('shrink-0 mt-0.5', iconCls)} />
                                <span>{cleanText}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Rekomendasi Kebijakan */}
                      <div className="p-5 bg-white dark:bg-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-4 rounded-full bg-green-500" />
                          <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            Rekomendasi Kebijakan
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {(featData.rekomendasi || []).map((rek, ri) => {
                            const pStyle = PRIORITY_STYLE[rek.priority] || PRIORITY_STYLE['Sedang'];
                            return (
                              <div key={ri} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/50">
                                  <div className="flex items-center gap-2">
                                    <div className={cn('w-1 h-3.5 rounded-full', pStyle.bar)} />
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">{rek.title}</span>
                                  </div>
                                  <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border uppercase', pStyle.badge)}>
                                    {rek.priority}
                                  </span>
                                </div>
                                <ul className="px-3 py-2.5 space-y-1.5 bg-white dark:bg-slate-800">
                                  {(rek.actions || []).map((action, ai) => (
                                    <li key={ai} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                      <Check size={10} className="text-green-500 shrink-0 mt-0.5" />
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-4 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800">
                      <AlertCircle size={14} className="text-slate-400 shrink-0" />
                      Rekomendasi tidak tersedia — data dimensi provinsi ini kosong.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Metadata
const METRIC_EXPLAIN = {
  cv_r2:  { label: 'CV R²',    desc: 'Koefisien determinasi (Cross-Validation). Semakin mendekati 1.0, semakin baik. Nilai ≥ 0.90 dianggat sangat baik.' },
  cv_mae: { label: 'CV MAE',   desc: 'Mean Absolute Error (Cross-Validation). Rata-rata kesalahan prediksi dalam satuan IKP (0–1). Nilai 0.024 artinya rata-rata selisih hanya 2.4 poin.' },
  r2:     { label: 'Train R²', desc: 'R² pada data training. Nilai tinggi wajar; yang penting adalah CV R² untuk generalisasi ke data baru.' },
};

// Referensi jurnal & regulasi yang mendukung metodologi IKP
const JURNAL_REFS = [
  {
    id: 'fao',
    warna: '#0ea5e9',
    badge: 'FAO · 1996–2015',
    judul: 'Food Security Definition: Availability, Access, Utilization, Stability',
    penulis: 'FAO, IFAD, WFP',
    tahun: '1996–2015',
    relevansi: 'Mendefinisikan ketahanan pangan melalui 4 dimensi (Ketersediaan/Availability, Akses/Access, Pemanfaatan/Utilization, Stabilitas/Stability) yang menjadi kerangka utama konstruksi IKP dalam sistem ini. Keempat dimensi ini menjadi dasar pemilihan variabel RPP, PL, IK, dan IA.',
    doi: null,
    tags: ['4 Dimensi FAO', 'Definisi Ketahanan Pangan', 'Kerangka Global'],
  },
  {
    id: 'rochmah2020',
    warna: '#10b981',
    badge: 'Jurnal Sains & Seni ITS · 2020',
    judul: 'Pemodelan Ketahanan Pangan di Jawa Timur Menggunakan Metode Geographically Weighted Ordinal Logistic Regression (GWOLR)',
    penulis: 'V.F. Rochmah & V. Ratnasari',
    tahun: '2020',
    doi: 'https://doi.org/10.12962/j23373520.v8i2.47021',
    relevansi: 'Penelitian ini menggunakan variabel yang tersedia di BPS — produksi padi, konsumsi kalori, dan persentase penduduk miskin — untuk memodelkan ketahanan pangan dengan pendekatan spasial di Jawa Timur. Variabel-variabel tersebut identik dengan komponen RPP (produksi padi per kapita), IK (konsumsi kalori/protein), dan IA (proksi kemiskinan) dalam sistem ini, memvalidasi relevansi data BPS untuk analisis ketahanan pangan tingkat provinsi.',
    tags: ['Komponen RPP', 'Komponen IA', 'Komponen IK', 'Pemodelan Spasial BPS'],
  },
  {
    id: 'permenkes2019',
    warna: '#f59e0b',
    badge: 'Regulasi Nasional · 2019',
    judul: 'Angka Kecukupan Gizi (AKG) untuk Masyarakat Indonesia',
    penulis: 'Peraturan Menteri Kesehatan No. 28 Tahun 2019',
    tahun: '2019',
    doi: null,
    relevansi: 'Menetapkan standar kecukupan protein sebesar 57 gram per kapita per hari dan standar kalori 2.100 kkal per kapita per hari sebagai denominator baku dalam perhitungan Indeks Konsumsi (IK). Nilai 57 g digunakan sebagai target normalisasi sehingga IK = 1.0 berarti konsumsi protein telah memenuhi standar nasional. Standar ini juga merupakan acuan resmi WNPG (Widyakarya Nasional Pangan dan Gizi) X.',
    tags: ['Standar 57 g Protein/hari', 'Standar 2100 kkal/hari', 'Komponen IK', 'WNPG X'],
  },
  {
    id: 'djirimu2025',
    warna: '#8b5cf6',
    badge: 'Jurnal Mantik · 2025',
    judul: 'Analysis of the Determinants of Food Security in Central Sulawesi, Indonesia',
    penulis: 'M. Djirimu',
    tahun: '2025',
    doi: null,
    relevansi: 'Menggunakan data BPS dan membuktikan secara empiris bahwa produksi padi berpengaruh signifikan terhadap nilai IKP di Indonesia. Temuan ini mendukung validitas pemilihan komponen Ketersediaan (RPP = produksi padi per kapita, dan PL = produktivitas lahan padi ton/ha) sebagai determinan utama dimensi ketersediaan pangan dalam sistem ini.',
    tags: ['Komponen RPP', 'Komponen PL', 'Validasi Empiris', 'Data BPS'],
  },
  {
    id: 'ardakani2017',
    warna: '#ef4444',
    badge: 'Intl. J. Agriculture Mgmt. · 2017',
    judul: 'Food Security and Its Multidimensionality: A TOPSIS-Based Approach',
    penulis: 'Ardakani et al.',
    tahun: '2017',
    doi: null,
    relevansi: 'Menggunakan teknik TOPSIS untuk normalisasi dan agregasi multidimensi indeks ketahanan pangan. Pendekatan ini secara konseptual setara dengan Min-Max Normalization yang diterapkan dalam sistem ini — kedua metode bertujuan menyetarakan skala variabel yang berbeda satuan (ton/jiwa, ton/ha, rasio) agar dapat diagregasi menjadi satu skor tunggal IKP.',
    tags: ['Normalisasi Min-Max', 'Agregasi Multidimensi', 'TOPSIS', 'Indeks Komposit'],
  },
];

export function TabMetadata({ hasilAnalisis, unduhFns, loadingDataset }) {
  const [menuDataset,   setMenuDataset]   = useState(false);
  const [expandFormula, setExpandFormula] = useState(false);
  const [expandAI,      setExpandAI]      = useState(false);
  const [expandRef,     setExpandRef]     = useState(false);
  const [expandNorm,    setExpandNorm]    = useState(false);
  const [expandKlasif,  setExpandKlasif]  = useState(false);
  const [activeRefId,   setActiveRefId]   = useState(null);
  const isAI   = hasilAnalisis?.is_ai_prediction;
  const scores = hasilAnalisis?.model_scores;

  return (
    <div className="space-y-4">

      {/* ── Header + Download ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <BookOpen size={16} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Metadata & Metodologi IKP</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Indeks Ketahanan Pangan · 4 Dimensi FAO · Data BPS Indonesia
            </p>
          </div>
        </div>
        {hasilAnalisis && !isAI && (
          <div className="relative">
            <Btn variant="primary" onClick={() => setMenuDataset(!menuDataset)}>
              <Download size={14} /> Download Dataset
            </Btn>
            {menuDataset && (
              <div className="absolute top-full mt-1 right-0 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-700 py-1">
                {[
                  { key: 'PADI',     label: 'Dataset Padi (Produksi & LP)',  Icon: Sprout,      fn: unduhFns.padi,     cls: 'text-green-500'   },
                  { key: 'KONSUMSI', label: 'Dataset Konsumsi Kalori',        Icon: TrendingUp,  fn: unduhFns.konsumsi, cls: 'text-blue-500'    },
                  { key: 'PENDUDUK', label: 'Dataset Jumlah Penduduk',        Icon: Users,       fn: unduhFns.penduduk, cls: 'text-amber-500'   },
                  { key: 'IKP',      label: 'Hasil IKP Lengkap',              Icon: ShieldCheck, fn: unduhFns.ikp,      cls: 'text-emerald-500' },
                ].map(d => (
                  <button key={d.key} onClick={() => { d.fn(); setMenuDataset(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors">
                    <d.Icon size={12} className={d.cls} /> {d.label}
                    {loadingDataset[d.key] && <Loader2 size={10} className="animate-spin ml-auto text-green-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Model AI ── */}
      {isAI && (
        <Card className="overflow-hidden border border-purple-200 dark:border-purple-700">
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
            onClick={() => setExpandAI(!expandAI)}>
            <SectionBar color="bg-purple-500" title="Model AI — Random Forest Regressor"
              sub={`Versi: ${hasilAnalisis?.model_version || 'rf_v1.0'} · Dilatih data historis BPS 2018–2024`} />
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', expandAI && 'rotate-180')} />
          </button>
          {scores && (
            <div className="px-5 pb-4 grid grid-cols-5 gap-2">
              {Object.entries(scores).map(([k, s]) => (
                <div key={k} className="text-center p-2 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800">
                  <div className="text-[9px] font-bold uppercase text-purple-400 mb-1">{k.toUpperCase()}</div>
                  <div className="text-sm font-black text-purple-700 dark:text-purple-300">{s.cv_r2?.toFixed(3)}</div>
                  <div className="text-[8px] text-slate-400">CV R²</div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{s.cv_mae?.toFixed(4)}</div>
                  <div className="text-[8px] text-slate-400">MAE</div>
                </div>
              ))}
            </div>
          )}
          {expandAI && (
            <div className="px-5 pb-5 space-y-3 text-xs text-slate-600 dark:text-slate-300 border-t border-purple-100 dark:border-purple-800 pt-4">
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { title: 'Algoritma', body: 'Random Forest Regressor (scikit-learn) — ensemble pohon keputusan yang merata-ratakan prediksi untuk mengurangi overfitting.' },
                  { title: 'Data Training', body: '7 tahun × 34 provinsi = 238 baris. Fitur: lag-1, lag-2, delta YoY, rolling mean 2-tahun, rolling std, encoding provinsi & pulau.' },
                  { title: 'Prediksi Rolling', body: 'Untuk 2025+, output prediksi tahun sebelumnya dipakai sebagai input tahun berikutnya (cascading/autoregressive prediction).' },
                ].map(item => (
                  <div key={item.title} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                    <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1">{item.title}</div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Interpretasi Metrik Evaluasi</div>
                {Object.entries(METRIC_EXPLAIN).map(([k, m]) => (
                  <div key={k} className="flex gap-3 p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                    <code className="text-[10px] font-black text-purple-600 dark:text-purple-400 w-16 shrink-0">{m.label}</code>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Formula & Komponen ── */}
      <Card className="overflow-hidden">
        <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
          onClick={() => setExpandFormula(!expandFormula)}>
          <SectionBar color="bg-green-500" title="Formula & Bobot IKP" sub="Indeks Ketahanan Pangan — 4 Dimensi FAO" />
          <ChevronDown size={14} className={cn('text-slate-400 transition-transform', expandFormula && 'rotate-180')} />
        </button>

        <div className="px-5 pb-2">
          {/* Formula utama */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 mb-4">
            <div className="text-[9px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-2">Formula Utama (IKP)</div>
            <code className="block text-sm font-mono font-black text-slate-900 dark:text-white">
              IKP = 0.4×(RPP_n + PL_n)/2 + 0.3×IK_n + 0.3×IA_n
            </code>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
              Semua variabel dinormalisasi ke skala 0–1 menggunakan{' '}
              <strong>Min-Max Normalization</strong>:{' '}
              <code className="bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded text-[10px] text-green-700 dark:text-green-300">
                X_norm = (X − X_min) / (X_max − X_min)
              </code>
            </p>
          </div>

          {/* Alasan bobot */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
            <div className="flex items-start gap-2">
              <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 mb-1">Justifikasi Pembobotan (0.4 dan 0.3)</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
                  Mengacu pada <strong>FAO Food Security Framework</strong> (FAO, IFAD, WFP, 1996–2015) dan adaptasi
                  FSVA Indonesia (BPS & WFP). Dimensi Ketersediaan (RPP+PL) mendapat bobot lebih besar{' '}
                  <strong>(40%)</strong> sebagai prasyarat utama — tanpa ketersediaan pangan yang cukup, dimensi lain
                  tidak relevan. Komponen Pemanfaatan (IK) dan Akses (IA) masing-masing <strong>30%</strong>,
                  selaras dengan penelitian Rochmah & Ratnasari (2020) yang menggunakan variabel yang sama.
                </p>
              </div>
            </div>
          </div>

          {/* Tabel komponen detail */}
          <div className="space-y-3 mb-4">
            {[
              {
                k: 'RPP', dim: 'Ketersediaan', dimEn: 'Availability', bobot: '20%', color: '#10b981',
                rumus: 'Produksi Padi (ton) ÷ Jumlah Penduduk (jiwa)',
                satuan: 'ton/jiwa',
                why: 'Mengukur ketersediaan pangan per kapita dari produksi lokal. Semakin tinggi RPP, semakin besar pasokan padi per jiwa penduduk di suatu provinsi.',
                sumber: 'BPS SIMDASI (id_tabel PADI)',
                ref: 'Rochmah & Ratnasari (2020); Djirimu (2025)',
              },
              {
                k: 'PL', dim: 'Ketersediaan', dimEn: 'Availability', bobot: '20%', color: '#10b981',
                rumus: 'Produksi Padi (ton) ÷ Luas Panen (ha)',
                satuan: 'ton/ha',
                why: 'Mengukur produktivitas & efisiensi lahan pertanian. Nilai PL yang tinggi menunjukkan teknologi pertanian yang baik dan potensi peningkatan produksi.',
                sumber: 'BPS SIMDASI (id_tabel PADI)',
                ref: 'Djirimu (2025) — produksi padi berpengaruh signifikan terhadap IKP',
              },
              {
                k: 'IK', dim: 'Pemanfaatan', dimEn: 'Utilization', bobot: '30%', color: '#3b82f6',
                rumus: 'Konsumsi Protein (g/kap/hari) ÷ 57 g',
                satuan: '0–1',
                why: '57 g/hari = standar kecukupan protein per kapita per hari (Permenkes No. 28 Tahun 2019 / WNPG X). IK = 1.0 berarti konsumsi protein sudah memenuhi standar nasional sepenuhnya.',
                sumber: 'BPS Susenas — Tabel Statis 951',
                ref: 'Permenkes No. 28/2019; Rochmah & Ratnasari (2020)',
              },
              {
                k: 'IA', dim: 'Akses', dimEn: 'Access', bobot: '30%', color: '#f59e0b',
                rumus: '1 − (% Penduduk Miskin ÷ 100)',
                satuan: '0–1',
                why: 'Menggunakan tingkat kemiskinan sebagai proksi ketidakmampuan ekonomi dalam mengakses pangan. Nilai IA = 1.0 berarti tidak ada penduduk miskin; semakin rendah kemiskinan, semakin tinggi akses pangan.',
                sumber: 'BPS — /api/list var=192 (% Penduduk Miskin)',
                ref: 'Rochmah & Ratnasari (2020) — % kemiskinan sebagai variabel akses pangan',
              },
            ].map(v => (
              <div key={v.k} className="rounded-xl border-2 overflow-hidden" style={{ borderColor: v.color + '30' }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: v.color + '10' }}>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <code className="text-sm font-black" style={{ color: v.color }}>{v.k}</code>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: v.color + '20', color: v.color }}>
                      {v.dim} / {v.dimEn}
                    </span>
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded">
                      Bobot {v.bobot}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 shrink-0">satuan: {v.satuan}</span>
                </div>
                <div className="px-4 py-3 bg-white dark:bg-slate-800 space-y-2">
                  <p className="text-[11px] font-mono font-bold text-slate-800 dark:text-white">{v.rumus}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{v.why}</p>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <span className="text-[9px] px-2 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded border border-teal-200 dark:border-teal-700 font-semibold">
                      📊 {v.sumber}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-600">
                      📚 {v.ref}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {expandFormula && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">Validitas & Keterbatasan Metodologi</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
                    Formula diadaptasi dari metodologi <strong>FSVA Indonesia</strong> (BPS & WFP, sejak 2005) dan
                    kerangka FAO 4 dimensi. Pendekatan agregasi dengan normalisasi Min-Max juga digunakan dalam
                    penelitian Ardakani et al. (2017) menggunakan TOPSIS untuk indeks ketahanan pangan multidimensi.
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed mt-1.5">
                    ⚠ <strong>Keterbatasan:</strong> Normalisasi Min-Max sensitif terhadap outlier dan bersifat
                    relatif antar tahun — nilai IKP dari tahun berbeda tidak langsung komparabel tanpa standarisasi eksternal.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Normalisasi & Klasifikasi ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Normalisasi */}
        <Card className="overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
            onClick={() => setExpandNorm(!expandNorm)}>
            <SectionBar color="bg-blue-500" title="Normalisasi Data" sub="Min-Max Normalization (Ardakani et al., 2017)" />
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', expandNorm && 'rotate-180')} />
          </button>
          <div className="px-5 pb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-700 mb-3">
              <code className="text-xs font-mono font-black text-slate-900 dark:text-white">
                X_norm = (X − X_min) / (X_max − X_min)
              </code>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Semua komponen (RPP, PL, IK, IA) dinormalisasi ke rentang <strong>0–1</strong> agar dapat
              diagregasi meskipun memiliki satuan berbeda. Metode ini setara dengan pendekatan yang digunakan
              Ardakani et al. (2017) dalam indeks multidimensi ketahanan pangan berbasis TOPSIS.
            </p>
            {expandNorm && (
              <div className="mt-3 space-y-2">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Interpretasi Nilai Ternormalisasi</div>
                {[
                  { val: '0.00', arti: 'Nilai terendah di antara semua provinsi pada tahun tersebut (titik minimum distribusi)' },
                  { val: '0.50', arti: 'Berada di tengah-tengah distribusi provinsi — kinerja rata-rata' },
                  { val: '1.00', arti: 'Nilai tertinggi di antara semua provinsi pada tahun tersebut (titik maksimum distribusi)' },
                ].map(i => (
                  <div key={i.val} className="flex gap-3 text-[10px] p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                    <code className="font-black text-blue-600 dark:text-blue-400 w-8 shrink-0">{i.val}</code>
                    <span className="text-slate-500 dark:text-slate-400 leading-relaxed">{i.arti}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Klasifikasi */}
        <Card className="overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
            onClick={() => setExpandKlasif(!expandKlasif)}>
            <SectionBar color="bg-rose-500" title="Klasifikasi Status IKP" sub="3 Kelas — ambang batas FAO/FSVA/BPS" />
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', expandKlasif && 'rotate-180')} />
          </button>
          <div className="px-5 pb-4 space-y-2">
            {[
              {
                label: 'TINGGI', range: 'IKP ≥ 0.70', color: '#10b981',
                desc: 'Semua 4 dimensi FAO terpenuhi dengan baik. Produksi padi mencukupi, akses ekonomi tinggi, dan konsumsi protein di atas standar Permenkes.',
              },
              {
                label: 'SEDANG', range: '0.50 ≤ IKP < 0.70', color: '#f59e0b',
                desc: 'Ketahanan pangan moderat — masih ada satu atau lebih dimensi yang lemah dan memerlukan perhatian kebijakan pangan.',
              },
              {
                label: 'RENDAH', range: 'IKP < 0.50', color: '#ef4444',
                desc: 'Rawan pangan — perlu intervensi prioritas pada produksi pertanian, pengentasan kemiskinan, atau perbaikan gizi masyarakat.',
              },
            ].map(s => (
              <div key={s.label} className="rounded-xl border p-3" style={{ borderColor: s.color + '40', backgroundColor: s.color + '08' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded"
                    style={{ backgroundColor: s.color + '25', color: s.color }}>{s.label}</span>
                  <code className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">{s.range}</code>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
            {expandKlasif && (
              <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Ambang 0.70 dan 0.50 diadaptasi dari klasifikasi IPM BPS (Tinggi ≥ 70, Sedang 60–70,
                  Rendah &lt; 60 dalam skala 0–100) yang dikonversi ke skala 0–1, serta mengacu pada distribusi
                  riil nilai IKP antar provinsi berdasarkan FSVA (Food Security and Vulnerability Atlas) BPS & WFP Indonesia.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Sumber Data BPS ── */}
      <Card className="p-5">
        <SectionBar color="bg-teal-500" title="Sumber Data BPS" sub="Dataset resmi yang digunakan dalam perhitungan IKP" />
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {[
            {
              ds: 'Produksi & Luas Panen Padi',
              src: 'BPS SIMDASI (id_tabel PADI)',
              update: 'Tahunan',
              desc: 'Digunakan untuk menghitung RPP (ton/jiwa) dan PL (ton/ha). Mencakup data per provinsi yang dapat diagregasi.',
              color: '#10b981',
            },
            {
              ds: 'Konsumsi Kalori & Protein per Kapita',
              src: 'BPS Susenas — Tabel Statis 951',
              update: 'Tahunan (tersedia hingga 2025)',
              desc: 'Untuk menghitung IK. Pembagi baku: 57 g protein/hari per Permenkes No. 28/2019 (WNPG X).',
              color: '#3b82f6',
            },
            {
              ds: 'Persentase Penduduk Miskin',
              src: 'BPS — /api/list var=192',
              update: 'Tahunan (Maret & September)',
              desc: 'Proksi akses ekonomi terhadap pangan. Digunakan sebagai komponen IA = 1 − (% miskin/100).',
              color: '#f59e0b',
            },
            {
              ds: 'Jumlah Penduduk',
              src: 'BPS SIMDASI (proyeksi penduduk)',
              update: 'Tahunan',
              desc: 'Denominator untuk menghitung RPP per kapita (ton padi dibagi jumlah penduduk jiwa).',
              color: '#8b5cf6',
            },
          ].map(d => (
            <div key={d.ds} className="p-3 rounded-xl border-2 bg-white dark:bg-slate-800/80"
              style={{ borderColor: d.color + '30' }}>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: d.color }} />
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-0.5">{d.ds}</div>
                  <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mb-1">{d.src}</div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{d.desc}</p>
                  <div className="text-[9px] font-semibold mt-1.5" style={{ color: d.color }}>
                    🔄 Frekuensi update: {d.update}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Referensi Jurnal & Regulasi ── */}
      <Card className="overflow-hidden">
        <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
          onClick={() => setExpandRef(!expandRef)}>
          <SectionBar color="bg-indigo-500"
            title="Referensi Ilmiah & Landasan Metodologi"
            sub="FAO framework · jurnal nasional & internasional · regulasi Permenkes" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full">
              {JURNAL_REFS.length} referensi
            </span>
            <ChevronDown size={14} className={cn('text-slate-400 transition-transform', expandRef && 'rotate-180')} />
          </div>
        </button>

        {expandRef && (
          <div className="px-5 pb-5 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Klik referensi untuk melihat detail relevansinya terhadap metodologi IKP dalam sistem ini.
            </p>
            {JURNAL_REFS.map(ref => (
              <div key={ref.id}
                className={cn(
                  'rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-200',
                  activeRefId === ref.id ? 'shadow-md' : 'hover:shadow-sm'
                )}
                style={{ borderColor: activeRefId === ref.id ? ref.warna + '70' : ref.warna + '25' }}
                onClick={() => setActiveRefId(activeRefId === ref.id ? null : ref.id)}>

                {/* Header referensi */}
                <div className="flex items-start gap-3 px-4 py-3.5 transition-colors"
                  style={{ backgroundColor: activeRefId === ref.id ? ref.warna + '12' : ref.warna + '06' }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: ref.warna }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: ref.warna + '20', color: ref.warna }}>
                        {ref.badge}
                      </span>
                      {ref.tags.map(t => (
                        <span key={t} className="text-[8px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">{ref.judul}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 italic">{ref.penulis} · {ref.tahun}</p>
                  </div>
                  <ChevronDown size={13} className={cn('transition-transform shrink-0 mt-1.5', activeRefId === ref.id && 'rotate-180')}
                    style={{ color: ref.warna }} />
                </div>

                {/* Detail relevansi */}
                {activeRefId === ref.id && (
                  <div className="px-5 py-4 border-t bg-white dark:bg-slate-800"
                    style={{ borderColor: ref.warna + '20' }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: ref.warna }}>
                      Relevansi untuk Metodologi IKP
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      {ref.relevansi}
                    </p>
                    {ref.doi ? (
                      <a href={ref.doi} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-75"
                        style={{ backgroundColor: ref.warna + '15', color: ref.warna }}
                        onClick={e => e.stopPropagation()}>
                        🔗 DOI: {ref.doi.replace('https://doi.org/', '')}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400">
                        📄 Regulasi / Dokumen Resmi Nasional
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Catatan penutup */}
            <div className="mt-2 p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">📋 Ringkasan Metodologi</div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Rumus IKP dalam sistem ini merupakan adaptasi dari kerangka <strong>FAO 4 dimensi</strong> (1996–2015)
                yang diimplementasikan menggunakan data BPS yang tersedia secara publik via API. Standar gizi mengacu
                pada <strong>Permenkes No. 28/2019</strong>. Pendekatan spasial dan pemilihan variabel divalidasi oleh
                penelitian <strong>Rochmah & Ratnasari (2020)</strong> dan <strong>Djirimu (2025)</strong>.
                Teknik normalisasi selaras dengan <strong>Ardakani et al. (2017)</strong>.
                Klasifikasi 3 kelas mengacu pada distribusi empiris FSVA (BPS & WFP Indonesia).
              </p>
            </div>
          </div>
        )}
      </Card>

    </div>
  );
}

// ─── Tab: Tren
const PALETTE = [
  '#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#84cc16','#14b8a6',
  '#a855f7','#0ea5e9','#fb923c','#e879f9','#4ade80',
];

const VIEW_BTNS = [
  { id: 'distribusi', label: 'Distribusi Status', Icon: BarChart2   },
  { id: 'ikp',        label: 'Tren IKP Provinsi', Icon: TrendingUp  },
  { id: 'ranking',    label: 'Top & Bottom',       Icon: ShieldCheck },
  { id: 'heatmap',    label: 'Heatmap',            Icon: Activity    },
];

const IKPTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 min-w-[160px]">
      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Tahun {label}</div>
      {payload.sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[110px]">{p.dataKey}</span>
          </div>
          <span className="text-[11px] font-black text-slate-900 dark:text-white">{p.value ?? '-'}</span>
        </div>
      ))}
    </div>
  );
};

const DistribTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 min-w-[140px]">
      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Tahun {label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-[11px] text-slate-600 dark:text-slate-300">{p.dataKey}</span>
          </div>
          <span className="text-[11px] font-black" style={{ color: p.fill }}>{p.value}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 dark:border-slate-700 mt-1.5 pt-1.5 text-[10px] text-slate-400">
        Total: {total} provinsi
      </div>
    </div>
  );
};

export function TabTrend({ trendData, trendLoading, trendError }) {
  const [viewMode,       setViewMode]       = useState('distribusi');
  const [selectedProvs,  setSelectedProvs]  = useState([]);
  const [provSearch,     setProvSearch]     = useState('');
  const [showProvPicker, setShowProvPicker] = useState(false);
  const [metrik,         setMetrik]         = useState('ikp');

  useEffect(() => {
    if (!trendData?.length || selectedProvs.length > 0) return;
    const allProvs  = [...new Set(trendData.flatMap(d => d.summary.map(p => p.provinsi)))];
    const provCount = {};
    trendData.forEach(d => d.summary.forEach(p => { provCount[p.provinsi] = (provCount[p.provinsi] || 0) + 1; }));
    const top5 = allProvs.sort((a, b) => (provCount[b] || 0) - (provCount[a] || 0)).slice(0, 5);
    setSelectedProvs(top5);
  }, [trendData]);

  if (!trendData && !trendLoading) return (
    <div className="py-14 text-center">
      <Activity size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mb-1">Belum ada analisis tersimpan</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Simpan setidaknya 2 analisis dari tahun berbeda untuk melihat tren.</p>
    </div>
  );

  if (trendLoading) return (
    <div className="py-14 text-center">
      <Loader2 size={28} className="text-green-500 animate-spin mx-auto mb-3" />
      <p className="text-sm text-slate-500">Memuat data analisis tersimpan...</p>
    </div>
  );

  if (trendError) return (
    <div className="py-10 text-center">
      <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
      <p className="text-sm text-red-500">{trendError}</p>
    </div>
  );

  if (!trendData?.length) return null;

  const tahunList      = [...new Set(trendData.map(d => d.tahun))].sort();
  const allProvs       = [...new Set(trendData.flatMap(d => d.summary.map(p => p.provinsi)))].sort();
  const filteredProvs  = allProvs.filter(p => p.toLowerCase().includes(provSearch.toLowerCase()));

  const distribusiData = trendData.map(d => ({
    tahun:  String(d.tahun),
    TINGGI: d.status_dist.TINGGI || 0,
    SEDANG: d.status_dist.SEDANG || 0,
    RENDAH: d.status_dist.RENDAH || 0,
    isAI:   d.is_ai,
  }));

  const METRIK_LABEL = { ikp: 'IKP', rpp: 'RPP (norm)', pl: 'PL (norm)', ik: 'IK (norm)', ia: 'IA (norm)' };

  const ikpTrendData = tahunList.map(th => {
    const snap = trendData.find(d => d.tahun === th);
    const row  = { tahun: String(th) };
    if (snap) {
      selectedProvs.forEach(pn => {
        const p = snap.summary.find(s => s.provinsi === pn);
        row[pn] = p ? Number((p[metrik] ?? p.ikp)?.toFixed(4)) : null;
      });
    }
    return row;
  });

  const rankingData = allProvs.map(pn => {
    const vals = trendData.flatMap(d => {
      const p = d.summary.find(s => s.provinsi === pn);
      return p?.ikp != null ? [p.ikp] : [];
    });
    const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const last = (() => { for (let i = trendData.length - 1; i >= 0; i--) { const p = trendData[i].summary.find(s => s.provinsi === pn); if (p?.ikp != null) return p; } return null; })();
    return { provinsi: pn, avg: avg ? +avg.toFixed(4) : null, count: vals.length, warna: last?.warna || '#94a3b8', status: last?.status || '-' };
  }).filter(d => d.avg != null).sort((a, b) => b.avg - a.avg);

  const top5        = rankingData.slice(0, 5);
  const bottom5     = rankingData.slice(-5).reverse();
  const heatmapProvs = rankingData.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Tren dari <span className="text-green-600 dark:text-green-400">{trendData.length} analisis tersimpan</span>
            {' '}· Tahun {tahunList[0]}–{tahunList[tahunList.length - 1]}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {trendData.filter(d => d.is_ai).length > 0 && (
              <span className="text-purple-400 font-semibold">
                {trendData.filter(d => d.is_ai).length} prediksi AI ·{' '}
              </span>
            )}
            {trendData.filter(d => !d.is_ai).length} data BPS riil
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {VIEW_BTNS.map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                viewMode === v.id
                  ? 'bg-green-600 border-green-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-green-300'
              )}>
              <v.Icon size={12} />{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Distribusi Status ── */}
      {viewMode === 'distribusi' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-blue-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Distribusi Status IKP per Tahun</h3>
            <span className="text-[10px] text-slate-400">(dari analisis tersimpan)</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribusiData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <RTooltip content={<DistribTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="TINGGI" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="SEDANG" stackId="a" fill="#f59e0b" />
                <Bar dataKey="RENDAH" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['TINGGI', 'SEDANG', 'RENDAH'].map(s => {
              const latest = distribusiData[distribusiData.length - 1]?.[s] || 0;
              const prev   = distribusiData[distribusiData.length - 2]?.[s];
              const delta  = prev != null ? latest - prev : null;
              const { warna } = STATUS_PANGAN[s];
              return (
                <div key={s} className="p-4 rounded-xl border" style={{ borderColor: warna + '40', backgroundColor: warna + '08' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: warna }}>{s}</div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white">{latest}</div>
                  <div className="text-[10px] text-slate-400">provinsi (terakhir)</div>
                  {delta != null && (
                    <div className={cn('text-[11px] font-semibold mt-1', delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-400' : 'text-slate-400')}>
                      {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)} dari periode lalu
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tren IKP per Provinsi ── */}
      {viewMode === 'ikp' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-green-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Tren Metrik per Provinsi</h3>
            </div>
            <div className="flex items-center gap-2">
              <select value={metrik} onChange={e => setMetrik(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
                {Object.entries(METRIK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="relative">
                <button onClick={() => setShowProvPicker(!showProvPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-green-300 transition-colors">
                  <Filter size={11} /> Provinsi ({selectedProvs.length})
                  <ChevronDown size={11} className={cn('transition-transform', showProvPicker && 'rotate-180')} />
                </button>
                {showProvPicker && (
                  <div className="absolute top-full mt-1 right-0 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-20 max-h-72 flex flex-col">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                      <input type="text" value={provSearch} onChange={e => setProvSearch(e.target.value)}
                        placeholder="Cari provinsi..." autoFocus
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-green-500 outline-none" />
                    </div>
                    <div className="flex gap-1 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
                      <button onClick={() => setSelectedProvs(allProvs.slice(0, 8))} className="text-[10px] px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 rounded font-semibold hover:bg-green-100 transition-colors">Semua (maks 8)</button>
                      <button onClick={() => setSelectedProvs([])} className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded font-semibold hover:bg-slate-200 transition-colors">Kosongkan</button>
                    </div>
                    <div className="overflow-y-auto flex-1 py-1">
                      {filteredProvs.map(pn => {
                        const sel = selectedProvs.includes(pn);
                        return (
                          <button key={pn} onClick={() => {
                            if (sel) setSelectedProvs(p => p.filter(x => x !== pn));
                            else if (selectedProvs.length < 10) setSelectedProvs(p => [...p, pn]);
                            else toast('Maks 10 provinsi sekaligus', { icon: '⚠️' });
                          }}
                            className={cn('w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors',
                              sel ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-semibold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            )}>
                            <div className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
                              sel ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600')}>
                              {sel && <Check size={9} className="text-white" />}
                            </div>
                            {pn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedProvs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Pilih minimal 1 provinsi di atas</div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={ikpTrendData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 1]} />
                  <RTooltip content={<IKPTooltip />} />
                  <ReferenceLine y={0.7} stroke="#10b981" strokeDasharray="5 3" strokeOpacity={0.6} label={{ value: 'TINGGI ≥0.70', fontSize: 9, fill: '#10b981', position: 'right' }} />
                  <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="5 3" strokeOpacity={0.6} label={{ value: 'SEDANG ≥0.50', fontSize: 9, fill: '#f59e0b', position: 'right' }} />
                  {selectedProvs.map((pn, i) => (
                    <Line key={pn} type="monotone" dataKey={pn} stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2.5} dot={{ r: 4, fill: PALETTE[i % PALETTE.length], strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6 }} connectNulls={false} />
                  ))}
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {selectedProvs.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60">
                  <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-4 py-2.5 text-left">Provinsi</th>
                    {tahunList.map(th => <th key={th} className="px-4 py-2.5 text-center">{th}</th>)}
                    <th className="px-4 py-2.5 text-center">Rata²</th>
                    <th className="px-4 py-2.5 text-center">Tren</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProvs.map(pn => {
                    const vals = tahunList.map(th => {
                      const snap = trendData.find(d => d.tahun === th);
                      const p    = snap?.summary.find(s => s.provinsi === pn);
                      return p?.[metrik] ?? p?.ikp ?? null;
                    });
                    const nonNull  = vals.filter(v => v != null);
                    const avg      = nonNull.length ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : null;
                    const trendDir = nonNull.length > 1 ? nonNull[nonNull.length - 1] - nonNull[0] : null;
                    return (
                      <tr key={pn} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{pn}</td>
                        {vals.map((v, i) => (
                          <td key={i} className="px-4 py-2.5 text-center">
                            {v != null ? (
                              <span className="font-mono font-bold" style={{ color: v >= 0.7 ? '#10b981' : v >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                                {v.toFixed(3)}
                              </span>
                            ) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center font-black text-slate-800 dark:text-slate-100">
                          {avg != null ? avg.toFixed(3) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {trendDir != null ? (
                            <span className={cn('text-xs font-bold', trendDir > 0.01 ? 'text-green-500' : trendDir < -0.01 ? 'text-red-400' : 'text-slate-400')}>
                              {trendDir > 0.01 ? '▲ Naik' : trendDir < -0.01 ? '▼ Turun' : '→ Stabil'}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Top & Bottom Ranking ── */}
      {viewMode === 'ranking' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-rose-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Peringkat Rata-rata IKP (Semua Periode Tersimpan)</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Top 5 — IKP Tertinggi</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={top5} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barSize={18}>
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="provinsi" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                  <RTooltip formatter={(v) => [v.toFixed(4), 'Rata² IKP']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {top5.map((entry, i) => <Cell key={i} fill={entry.warna || '#10b981'} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Bottom 5 — IKP Terendah</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bottom5} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barSize={18}>
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="provinsi" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                  <RTooltip formatter={(v) => [v.toFixed(4), 'Rata² IKP']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {bottom5.map((entry, i) => <Cell key={i} fill={entry.warna || '#ef4444'} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-3 py-2.5 text-center w-10">Rank</th>
                  <th className="px-4 py-2.5 text-left">Provinsi</th>
                  <th className="px-4 py-2.5 text-center">Rata² IKP</th>
                  <th className="px-4 py-2.5 text-center">Periode</th>
                  <th className="px-4 py-2.5 text-center">Status Terakhir</th>
                  <th className="px-4 py-2.5 text-left w-40">Bar</th>
                </tr>
              </thead>
              <tbody>
                {rankingData.map((d, i) => (
                  <tr key={d.provinsi} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                    <td className="px-3 py-2 text-center">
                      <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded',
                        i < 3 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                              : i >= rankingData.length - 3 ? 'bg-red-100 dark:bg-red-900/40 text-red-500'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      )}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">{d.provinsi}</td>
                    <td className="px-4 py-2 text-center font-black" style={{ color: d.warna }}>{d.avg.toFixed(4)}</td>
                    <td className="px-4 py-2 text-center text-slate-400">{d.count}×</td>
                    <td className="px-4 py-2 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ borderColor: d.warna + '60', color: d.warna, backgroundColor: d.warna + '15' }}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden w-full">
                        <div className="h-full rounded-full" style={{ width: `${(d.avg * 100).toFixed(1)}%`, backgroundColor: d.warna, opacity: 0.8 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Heatmap ── */}
      {viewMode === 'heatmap' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Heatmap IKP — Top 20 Provinsi × Tahun</h3>
            <span className="text-[10px] text-slate-400">(warna = status IKP)</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide sticky left-0 bg-slate-50 dark:bg-slate-800 min-w-[130px]">Provinsi</th>
                  {tahunList.map(th => (
                    <th key={th} className="px-3 py-3 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap min-w-[70px]">
                      {th}
                      {trendData.find(d => d.tahun === th)?.is_ai && (
                        <span className="ml-1 text-[8px] text-purple-400 font-bold">AI</span>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-400 min-w-[70px]">Rata²</th>
                </tr>
              </thead>
              <tbody>
                {heatmapProvs.map((d, ri) => {
                  const cells = tahunList.map(th => {
                    const snap = trendData.find(dd => dd.tahun === th);
                    return snap?.summary.find(s => s.provinsi === d.provinsi) || null;
                  });
                  const nonNull = cells.filter(Boolean);
                  const avg = nonNull.length ? nonNull.reduce((s, p) => s + (p.ikp || 0), 0) / nonNull.length : null;
                  return (
                    <tr key={d.provinsi} className="border-b border-slate-100 dark:border-slate-700/40">
                      <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-400 w-5 shrink-0">{ri + 1}</span>
                          {d.provinsi}
                        </div>
                      </td>
                      {cells.map((p, ci) => (
                        <td key={ci} className="px-2 py-2 text-center">
                          {p ? (
                            <div className="mx-auto w-14 py-1.5 rounded-lg font-black text-[10px]"
                              style={{ backgroundColor: (p.warna || '#94a3b8') + '25', color: p.warna || '#94a3b8', border: `1px solid ${(p.warna || '#94a3b8')}40` }}>
                              {(p.ikp || 0).toFixed(3)}
                            </div>
                          ) : (
                            <div className="mx-auto w-14 py-1.5 rounded-lg text-[10px] text-slate-300 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-700">-</div>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        {avg != null ? (
                          <div className="font-black text-[11px]" style={{ color: d.warna }}>{avg.toFixed(3)}</div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 px-2">
            <span className="text-[10px] text-slate-400 font-semibold">Legenda:</span>
            {Object.entries(STATUS_PANGAN).map(([s, v]) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: v.warna + '30', border: `1px solid ${v.warna}60` }} />
                <span className="text-[10px] font-semibold" style={{ color: v.warna }}>{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded border border-dashed border-slate-300" />
              <span className="text-[10px] text-slate-400">Tidak ada data</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}