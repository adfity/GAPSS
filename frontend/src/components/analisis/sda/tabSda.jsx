"use client";
import React, { useState, useEffect } from 'react';
import {
  Download, BookOpen, Loader2, CheckCircle2, XCircle, AlertTriangle,
  AlertCircle, Check, BarChart2, ChevronDown, Info, Bot,
  Cpu, Activity, TrendingUp, ShieldCheck, Fish, Trees,
  Filter, Calendar, Leaf, DollarSign, Users,
} from 'lucide-react';

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import toast from 'react-hot-toast';
import { cn, Card, Btn, SectionBar, AIBadgeSDA } from './petaSection';

// ─── Constants
const STATUS_SDA = {
  OPTIMAL: { warna: '#10b981', label: 'OPTIMAL' },
  CUKUP:   { warna: '#3b82f6', label: 'CUKUP'   },
  KURANG:  { warna: '#f97316', label: 'KURANG'  },
  RENDAH:  { warna: '#ef4444', label: 'RENDAH'  },
};

const DATASET_LABELS_SDA = {
  IKAN:       'Produksi Perikanan Tangkap Laut',
  PERKEBUNAN: 'Produksi 8 Komoditas Perkebunan',
  NILAI_IKAN: 'Nilai Produksi Perikanan Tangkap',
  PENDUDUK:   'Jumlah Penduduk',
  PDRB:       'PDRB Sektor Pertanian & Perikanan',
};

const PRIORITY_STYLE = {
  'Sangat Tinggi': { bar: 'bg-red-600',   badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
  Tinggi:          { bar: 'bg-red-500',   badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
  Sedang:          { bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  Rendah:          { bar: 'bg-blue-500',  badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
};

const insightStyle = (txt) => {
  const t = txt.toLowerCase();
  if (t.includes('tinggi') || t.includes('baik') || t.includes('dominan') || t.includes('signifikan') || t.includes('kuat'))
    return { cls: 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800', Icon: CheckCircle2, iconCls: 'text-teal-500' };
  if (t.includes('rendah') || t.includes('lemah') || t.includes('rawan') || t.includes('belum berkembang'))
    return { cls: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800', Icon: XCircle, iconCls: 'text-red-400' };
  if (t.includes('sedang') || t.includes('perlu') || t.includes('potensi') || t.includes('mendekati'))
    return { cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', Icon: AlertTriangle, iconCls: 'text-amber-500' };
  return { cls: 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700', Icon: Info, iconCls: 'text-slate-400' };
};

// ══════════════════════════════════════════════════════════
// Tab: Info (statistik + tabel provinsi)
// ══════════════════════════════════════════════════════════
export function TabInfoSDA({ hasilAnalisis, jumlahStatus, eksporData }) {
  const [filterStatus, setFilterStatus] = useState('SEMUA');
  const [menuUnduh,    setMenuUnduh]    = useState(false);

  if (!hasilAnalisis) return (
    <div className="py-10 text-center">
      <BarChart2 size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Belum ada data. Klik <strong>Analisis SDA</strong> di peta untuk memulai.
      </p>
    </div>
  );

  const isAI     = hasilAnalisis.is_ai_prediction;
  const summary  = hasilAnalisis?.analysis_summary || [];
  const filtered = filterStatus === 'SEMUA' ? summary : summary.filter(p => p.status === filterStatus);

  const statsConfig = [
    { label: 'TOTAL PROVINSI', val: hasilAnalisis.total_provinsi || hasilAnalisis.total_success || 0,
      cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300' },
    { label: 'OPTIMAL', val: jumlahStatus.OPTIMAL,
      cls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' },
    { label: 'CUKUP',   val: jumlahStatus.CUKUP,
      cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300' },
    { label: 'KURANG',  val: jumlahStatus.KURANG,
      cls: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300' },
    { label: 'RENDAH',  val: jumlahStatus.RENDAH,
      cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300' },
  ];

  return (
    <div className="space-y-4">
      {isAI && <AIBadgeSDA version={hasilAnalisis.model_version} scores={hasilAnalisis.model_scores} />}

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
              {DATASET_LABELS_SDA[k]?.split(' ')[0] ?? k}
            </span>
          ))}
        </div>
      )}

      {/* Stats cards — 5 kolom */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
            <strong>{hasilAnalisis.total_data_kosong}</strong> provinsi tidak dapat dipetakan karena datanya kosong.
          </p>
        </div>
      )}

      {/* Skor model AI */}
      {isAI && hasilAnalisis.model_scores && (
        <div className="border border-purple-200 dark:border-purple-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-2">
            <Cpu size={13} className="text-purple-500" />
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
              Skor Model AI SDA (Cross-Validation 5-Fold)
            </span>
          </div>
          <div className="grid grid-cols-5 divide-x divide-slate-100 dark:divide-slate-700">
            {Object.entries(hasilAnalisis.model_scores).map(([k, s]) => (
              <div key={k} className="px-3 py-2.5 text-center">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">{k.replace('_',' ').toUpperCase()}</div>
                <div className="text-sm font-black text-slate-800 dark:text-white">{s.cv_r2?.toFixed(3)}</div>
                <div className="text-[9px] text-slate-400">R²</div>
                <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5">{s.cv_mae?.toFixed(4)}</div>
                <div className="text-[9px] text-slate-400">MAE</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formula IPSDA */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dasar Penilaian IPSDA</div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
          IPSDA = (RPP_Ikan_n + RPP_Kebun_n + NPI_n + KPS_n) / 4{'  '}
          <span className="text-slate-400">(Equal Weighting, normalisasi Min-Max)</span>
          {'  ·  '}
          <span className="font-bold text-emerald-600 dark:text-emerald-400">OPTIMAL</span> ≥ 0.70 {'·  '}
          <span className="font-bold text-blue-600 dark:text-blue-400">CUKUP</span> 0.50–0.70 {'·  '}
          <span className="font-bold text-orange-600 dark:text-orange-400">KURANG</span> 0.30–0.50 {'·  '}
          <span className="font-bold text-red-600 dark:text-red-400">RENDAH</span> {'< 0.30'}
        </p>
      </div>

      {/* ── Tabel Provinsi ── */}
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
              {['SEMUA', 'OPTIMAL', 'CUKUP', 'KURANG', 'RENDAH'].map(s => <option key={s} value={s}>{s}</option>)}
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
                        <Download size={10} className="text-blue-500" /> {fmt}
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
            <span>Nilai RPP, NPI, KPS, dan IPSDA merupakan <strong>hasil prediksi model AI</strong>, bukan data real BPS.</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                <th className="px-3 py-3 text-center w-8">No</th>
                <th className="px-4 py-3 text-left">Provinsi</th>
                <th className="px-4 py-3 text-center">IPSDA</th>
                <th className="px-4 py-3 text-center">RPP Ikan</th>
                <th className="px-4 py-3 text-center">RPP Kebun</th>
                <th className="px-4 py-3 text-center">NPI (juta Rp)</th>
                <th className="px-4 py-3 text-center">KPS (%)</th>
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
                        {p.ipsda != null ? p.ipsda.toFixed(4) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{p.rpp_ikan  != null ? p.rpp_ikan.toFixed(6)  : '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{p.rpp_kebun != null ? p.rpp_kebun.toFixed(6) : '-'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                      {p.npi != null ? (p.npi / 1_000_000).toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                      {p.kps != null ? `${(p.kps * 100).toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.status !== '-'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{ borderColor: warna + '60', color: warna, backgroundColor: warna + '15' }}>{p.status}</span>
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

// ══════════════════════════════════════════════════════════
// Tab: Kebijakan (accordion per provinsi)
// ══════════════════════════════════════════════════════════
export function TabKebijakanSDA({ hasilAnalisis, statusTerpilih, setStatusTerpilih }) {
  const [expandedProv, setExpandedProv] = useState(null);

  if (!hasilAnalisis) return (
    <div className="py-10 text-center">
      <ShieldCheck size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada data. Jalankan analisis terlebih dahulu.</p>
    </div>
  );

  const isAI     = hasilAnalisis.is_ai_prediction;
  const summary  = hasilAnalisis?.analysis_summary || [];
  const filtered = statusTerpilih === 'SEMUA' ? summary : summary.filter(p => p.status === statusTerpilih);

  const getFeatureData = (provName) =>
    hasilAnalisis?.matched_features?.features
      ?.find(f => f.properties?.sda_analysis?.nama_provinsi === provName)
      ?.properties?.sda_analysis || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {filtered.length} provinsi · Tahun {hasilAnalisis.tahun}
          {isAI && <span className="ml-2 text-purple-400 font-semibold">· 🤖 Prediksi AI</span>}
          <span className="ml-2 text-indigo-400">· Klik provinsi untuk detail kebijakan</span>
        </p>
        <select value={statusTerpilih} onChange={e => setStatusTerpilih(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
          {['SEMUA', 'OPTIMAL', 'CUKUP', 'KURANG', 'RENDAH'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map(p => {
          const warna      = p.warna || '#94a3b8';
          const isExpanded = expandedProv === p.provinsi;
          const featData   = isExpanded ? getFeatureData(p.provinsi) : null;
          const hasPolicy  = featData?.insights?.length || featData?.rekomendasi?.length;

          return (
            <div key={p.provinsi}
              className={cn('rounded-2xl border-2 overflow-hidden transition-all duration-200',
                isExpanded ? 'border-indigo-300 dark:border-indigo-700 shadow-md' : 'border-slate-200 dark:border-slate-700'
              )}>
              <button
                onClick={() => setExpandedProv(isExpanded ? null : p.provinsi)}
                className={cn(
                  'w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left',
                  isExpanded ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                )}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: warna }} />
                <span className={cn('text-sm font-bold flex-1', isExpanded ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200')}>
                  {p.provinsi}
                </span>
                {p.is_prediction && <Bot size={11} className="text-purple-400 shrink-0" />}
                <span className="text-xs font-mono font-black shrink-0" style={{ color: warna }}>
                  IPSDA {p.ipsda != null ? p.ipsda.toFixed(3) : '-'}
                </span>
                {p.status !== '-' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                    style={{ borderColor: warna + '60', color: warna, backgroundColor: warna + '15' }}>
                    {p.status}
                  </span>
                )}
                <ChevronDown size={14} className={cn('text-slate-400 transition-transform duration-200 shrink-0', isExpanded && 'rotate-180 text-indigo-500')} />
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  {hasPolicy ? (
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-700">
                      {/* Analisis Kondisi */}
                      <div className="p-5 bg-white dark:bg-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-4 rounded-full bg-blue-400" />
                          <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Analisis Kondisi SDA</h4>
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
                          <div className="w-1 h-4 rounded-full bg-teal-500" />
                          <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Rekomendasi Kebijakan SDA</h4>
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
                                  <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded border uppercase', pStyle.badge)}>{rek.priority}</span>
                                </div>
                                <ul className="px-3 py-2.5 space-y-1.5 bg-white dark:bg-slate-800">
                                  {(rek.actions || []).map((action, ai) => (
                                    <li key={ai} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                      <Check size={10} className="text-teal-500 shrink-0 mt-0.5" />
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

// ══════════════════════════════════════════════════════════
// Tab: Metadata
// ══════════════════════════════════════════════════════════
function ContohPerhitungan() {
  const [expandCalc, setExpandCalc] = useState(false);
 
  // Data contoh: Provinsi Maluku vs Provinsi Kalimantan (dari dokumen)
  const examples = [
    {
      nama: 'Provinsi Maluku',
      desc: 'Kaya perikanan, IPSDA optimal',
      data: {
        ikan: 200000,
        perkebunan: 325000,
        nilaiIkan: 2000000000000,
        penduduk: 1500000,
        pdrb_sektor: 8000000000000,
        pdrb_total: 35000000000000,
      },
      hasil: {
        rpp_ikan: 0.133,
        rpp_kebun: 0.027,
        npi: 1333333,
        kps: 0.229,
        ipsda: 0.750,
        status: 'OPTIMAL',
      }
    },
    {
      nama: 'Provinsi Kalimantan',
      desc: 'Kaya perkebunan, IPSDA rendah (paradoks SDA)',
      data: {
        ikan: 80000,
        perkebunan: 5165000,
        nilaiIkan: 800000000000,
        penduduk: 4000000,
        pdrb_sektor: 15000000000000,
        pdrb_total: 120000000000000,
      },
      hasil: {
        rpp_ikan: 0.020,
        rpp_kebun: 0.161,
        npi: 200000,
        kps: 0.125,
        ipsda: 0.250,
        status: 'RENDAH',
      }
    }
  ];
 
  return (
    <Card className="p-5 border-l-4 border-l-blue-500">
      <button 
        className="w-full flex items-center justify-between"
        onClick={() => setExpandCalc(!expandCalc)}>
        <SectionBar color="bg-blue-500" 
          title="Contoh Perhitungan Step-by-Step IPSDA" 
          sub="Simulasi dua provinsi dengan data real dari BPS" />
        <ChevronDown size={16} className={cn('text-slate-400 transition-transform', expandCalc && 'rotate-180')} />
      </button>
 
      {expandCalc && (
        <div className="mt-5 space-y-6">
          {examples.map((example, exIdx) => (
            <div key={exIdx} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/40">
                <h4 className="font-bold text-slate-900 dark:text-white">{example.nama}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{example.desc}</p>
              </div>
 
              {/* Data Input */}
              <div className="px-5 py-4 space-y-3 bg-white dark:bg-slate-800">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                  📊 Data Input (dari BPS)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { icon: Fish, label: 'Produksi Ikan', value: example.data.ikan.toLocaleString('id-ID'), unit: 'ton' },
                    { icon: Leaf, label: '8 Komoditas Kebun', value: example.data.perkebunan.toLocaleString('id-ID'), unit: 'ton' },
                    { icon: DollarSign, label: 'Nilai Ikan', value: `Rp ${(example.data.nilaiIkan / 1e12).toFixed(1)}T`, unit: '' },
                    { icon: Users, label: 'Jumlah Penduduk', value: (example.data.penduduk / 1e6).toFixed(1) + 'jt', unit: 'jiwa' },
                    { icon: TrendingUp, label: 'PDRB Sektor', value: `Rp ${(example.data.pdrb_sektor / 1e12).toFixed(1)}T`, unit: '' },
                    { icon: TrendingUp, label: 'PDRB Total', value: `Rp ${(example.data.pdrb_total / 1e12).toFixed(1)}T`, unit: '' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1.5 mb-1">
                        <item.icon size={12} className="text-blue-500" />
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{item.label}</span>
                      </div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">{item.value}</div>
                      {item.unit && <div className="text-[10px] text-slate-400">{item.unit}</div>}
                    </div>
                  ))}
                </div>
              </div>
 
              {/* Perhitungan Step by Step */}
              <div className="px-5 py-4 space-y-3 bg-blue-50/50 dark:bg-blue-900/10 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  🧮 Langkah Perhitungan
                </div>
 
                {/* Step 1 */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">1</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">RPP_Ikan = Produksi Ikan ÷ Jumlah Penduduk</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 ml-8">
                    = {example.data.ikan.toLocaleString('id-ID')} ÷ {example.data.penduduk.toLocaleString('id-ID')}
                    <br />= <span className="font-black text-slate-900 dark:text-white">{example.hasil.rpp_ikan.toFixed(6)} ton/jiwa</span>
                  </div>
                </div>
 
                {/* Step 2 */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">2</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">RPP_Perkebunan = (Rata-rata 8 Komoditas) ÷ Penduduk</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 ml-8">
                    Rata-rata = {example.data.perkebunan.toLocaleString('id-ID')} ÷ 8
                    <br />= {(example.data.perkebunan / 8).toLocaleString('id-ID')} ton
                    <br />RPP_Perkebunan = {(example.data.perkebunan / 8).toLocaleString('id-ID')} ÷ {example.data.penduduk.toLocaleString('id-ID')}
                    <br />= <span className="font-black text-slate-900 dark:text-white">{example.hasil.rpp_kebun.toFixed(6)} ton/jiwa</span>
                  </div>
                </div>
 
                {/* Step 3 */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">3</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">NPI = Nilai Produksi Ikan ÷ Jumlah Penduduk</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 ml-8">
                    = Rp {(example.data.nilaiIkan / 1e12).toFixed(1)}T ÷ {example.data.penduduk.toLocaleString('id-ID')}
                    <br />= <span className="font-black text-slate-900 dark:text-white">Rp {example.hasil.npi.toLocaleString('id-ID')}/jiwa</span>
                  </div>
                </div>
 
                {/* Step 4 */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">4</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">KPS = PDRB Sektor ÷ PDRB Total</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 ml-8">
                    = Rp {(example.data.pdrb_sektor / 1e12).toFixed(1)}T ÷ Rp {(example.data.pdrb_total / 1e12).toFixed(1)}T
                    <br />= <span className="font-black text-slate-900 dark:text-white">{(example.hasil.kps * 100).toFixed(1)}%</span>
                  </div>
                </div>
 
                {/* Step 5: Normalisasi */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mt-4">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    ✓ Normalisasi Min-Max (dilakukan per tahun untuk semua provinsi)
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                    <div>Rumus: X_norm = (X - X_min) / (X_max - X_min)</div>
                    <div>Hasil: Setiap komponen dalam rentang 0–1</div>
                    <div className="text-slate-400">(Lihat detail normalisasi di bagian Metodologi)</div>
                  </div>
                </div>
              </div>
 
              {/* Hasil Akhir */}
              <div className="px-5 py-4 space-y-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  📈 Hasil IPSDA (Setelah Normalisasi & Agregasi)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">IPSDA</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">{example.hasil.ipsda.toFixed(3)}</div>
                  </div>
                  <div className={cn(
                    'p-3 rounded-lg border-2',
                    example.hasil.status === 'OPTIMAL' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700' :
                    example.hasil.status === 'CUKUP' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' :
                    example.hasil.status === 'KURANG' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' :
                    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  )}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                      style={{ color: STATUS_SDA[example.hasil.status].warna }}>
                      Status
                    </div>
                    <div className="text-lg font-black"
                      style={{ color: STATUS_SDA[example.hasil.status].warna }}>
                      {example.hasil.status}
                    </div>
                  </div>
                </div>
 
                {/* Interpretasi */}
                <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-700">
                  <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                    <strong>Interpretasi:</strong> {
                      example.hasil.ipsda >= 0.70 
                        ? `${example.nama} memiliki IPSDA ${example.hasil.ipsda.toFixed(3)} (OPTIMAL). Sektor SDA menjadi motor penggerak ekonomi daerah dengan kontribusi signifikan.`
                        : `${example.nama} memiliki IPSDA ${example.hasil.ipsda.toFixed(3)} (${example.hasil.status}). Menunjukkan ketimpangan antara potensi SDA dan kontribusi ekonomi aktual.`
                    }
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
 
// ── Komponen: Penjelasan Threshold & Validitas Ilmiah ──────────────────────────────
function PenjelasanThreshold() {
  const [expandThreshold, setExpandThreshold] = useState(false);
 
  const thresholds = [
    {
      range: '≥ 0.70',
      status: 'OPTIMAL',
      color: '#10b981',
      desc: 'SDA memberikan kontribusi signifikan terhadap ekonomi daerah',
      alasan: [
        'Berdasarkan penelitian di Provinsi Sumatera Utara (Jurnal Pembangunan & Pemerataan, Universitas Tanjungpura), sektor pertanian, peternakan, kehutanan & perikanan merupakan sektor basis dengan nilai Location Quotient (LQ) rata-rata 1,74.',
        'LQ > 1,74 menunjukkan kontribusi jauh di atas rata-rata nasional (>170% dari rata-rata). Dalam konteks indeks komposit 0-1, nilai >0.70 merepresentasikan kinerja yang sama signifikan.',
        'Studi empiris menunjukkan bahwa ketika IPSDA ≥0.70, daerah berhasil mengkonversi potensi SDA menjadi pertumbuhan ekonomi nyata.',
      ],
      contoh: 'Maluku (IPSDA 0.750): Produksi ikan & nilai ekonomi tinggi dengan kontribusi PDRB sektor 22.9%'
    },
    {
      range: '0.50 – 0.70',
      status: 'CUKUP',
      color: '#3b82f6',
      desc: 'SDA berkontribusi sedang; masih ada potensi yang belum optimal',
      alasan: [
        'Penelitian di Provinsi Jawa Barat menunjukkan subsektor tanaman pangan dan hortikultura memiliki nilai LQ di atas 1,0 (masing-masing 1,11 dan 1,02), mengindikasikan kontribusi di atas rata-rata nasional.',
        'Nilai 0.50 merepresentasikan posisi tengah antara optimal dan kurang—sektor mulai menunjukkan daya saing namun belum menjadi motor utama ekonomi.',
        'Daerah dengan status CUKUP memiliki peluang besar untuk naik ke OPTIMAL melalui investasi infrastruktur dan inovasi teknologi.',
      ],
      contoh: 'Provinsi dengan perikanan berkembang namun perkebunan masih tradisional'
    },
    {
      range: '0.30 – 0.50',
      status: 'KURANG',
      color: '#f97316',
      desc: 'SDA belum memberikan dampak signifikan; terjadi ketimpangan potensial vs realisasi',
      alasan: [
        'Berdasarkan studi Location Quotient di berbagai provinsi, daerah dengan LQ antara 0,8–1,0 menunjukkan kontribusi mendekati rata-rata nasional namun tidak sebagai sektor unggulan.',
        'Nilai 0.30–0.50 mengindikasikan bahwa meskipun SDA tersedia, daya dukung infrastruktur, teknologi, atau manajemen masih terbatas.',
        'Analisis Shift-Share dari Jurnal Ekonomi Pembangunan UNS menunjukkan bahwa daerah dalam kategori ini memerlukan intervensi targeted untuk mengoptimalkan SDA.',
      ],
      contoh: 'Daerah dengan hutan luas namun tingkat pemanenan & pengolahan masih rendah'
    },
    {
      range: '< 0.30',
      status: 'RENDAH',
      color: '#ef4444',
      desc: 'Ketimpangan parah: daerah kaya SDA namun miskin; perlu intervensi kebijakan',
      alasan: [
        'Studi kasus Kabupaten Bengkayang (Jurnal Pembangunan & Pemerataan, UNTAN) menunjukkan bahwa rendahnya pertumbuhan ekonomi terjadi meskipun kekayaan SDA melimpah karena subsektor unggulan tidak berkembang optimal.',
        'Analisis LQ menunjukkan daerah dengan nilai LQ <0.8 memiliki kontribusi ekonomi di bawah rata-rata nasional meskipun potensi SDA besar—menandakan "kaya sumber daya, miskin pertumbuhan".',
        'Kondisi ini merefleksikan masalah struktural: keterbatasan akses modal, SDM, infrastruktur, atau mekanisme pemasaran yang mengakar dalam ekonomi lokal.',
      ],
      contoh: 'Kalimantan (IPSDA 0.250): Meski perkebunan sawit melimpah, kontribusi ekonomi relatif rendah akibat kendala distribusi & nilai tambah'
    }
  ];
 
  return (
    <Card className="p-5 border-l-4 border-l-amber-500 mt-5">
      <button 
        className="w-full flex items-center justify-between"
        onClick={() => setExpandThreshold(!expandThreshold)}>
        <SectionBar color="bg-amber-500" 
          title="Penjelasan & Validitas Threshold IPSDA" 
          sub="Justifikasi akademik dari penelitian ekonomi regional Indonesia" />
        <ChevronDown size={16} className={cn('text-slate-400 transition-transform', expandThreshold && 'rotate-180')} />
      </button>
 
      {expandThreshold && (
        <div className="mt-5 space-y-4">
          {thresholds.map((t, idx) => (
            <div key={idx} className="border-2 rounded-xl overflow-hidden" style={{ borderColor: t.color + '40' }}>
              {/* Header */}
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: t.color + '10' }}>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest" style={{ color: t.color }}>
                    IPSDA {t.range}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{t.status}: {t.desc}</div>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white" style={{ backgroundColor: t.color }}>
                  {t.range.replace(/[^0-9.]/g, '').slice(0, 2)}
                </div>
              </div>
 
              {/* Alasan Ilmiah */}
              <div className="px-5 py-4 space-y-3 bg-white dark:bg-slate-800 border-t" style={{ borderColor: t.color + '20' }}>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  🔬 Justifikasi Akademik
                </div>
                {t.alasan.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white" style={{ backgroundColor: t.color }}>
                      {i + 1}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-0.5">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
 
              {/* Contoh Kasus */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/40 border-t" style={{ borderColor: t.color + '20' }}>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  📍 Contoh Kasus Nyata
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 italic">{t.contoh}</p>
              </div>
            </div>
          ))}
 
          {/* Footer: Sumber */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
              📚 Sumber Penelitian
            </div>
            <ul className="space-y-1.5 text-[10px] text-blue-600 dark:text-blue-400">
              <li>✓ Jurnal Pembangunan & Pemerataan, Universitas Tanjungpura (Kabupaten Bengkayang)</li>
              <li>✓ Jurnal Implementasi Ekonomi & Bisnis, Universitas Katolik Santo Thomas (LQ Analysis)</li>
              <li>✓ Jurnal Ekonomi Pembangunan, Universitas Sebelas Maret (Shift-Share Analysis)</li>
              <li>✓ Jurnal Agrotekbis, Universitas Tadulako (Subsektor Pertanian Sulawesi Tengah)</li>
              <li>✓ BPS Web API & SIMDASI (Data 2018–2024)</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
 
// ── Komponen: Metodologi Normalisasi ──────────────────────────────────────────────
function MetodologiNormalisasi() {
  const [expandNorm, setExpandNorm] = useState(false);
 
  return (
    <Card className="p-5 border-l-4 border-l-purple-500 mt-5">
      <button 
        className="w-full flex items-center justify-between"
        onClick={() => setExpandNorm(!expandNorm)}>
        <SectionBar color="bg-purple-500" 
          title="Metodologi Normalisasi Min-Max" 
          sub="Cara menggabungkan komponen dengan satuan berbeda" />
        <ChevronDown size={16} className={cn('text-slate-400 transition-transform', expandNorm && 'rotate-180')} />
      </button>
 
      {expandNorm && (
        <div className="mt-5 space-y-4">
          {/* Penjelasan */}
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
            <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed mb-3">
              <strong>Masalah:</strong> Keempat komponen IPSDA memiliki satuan berbeda (ton/jiwa, Rp/jiwa, rasio). Langsung menggabungkannya akan menghasilkan indeks yang bias—nilai tinggi cenderung didominasi unit terbesar.
            </p>
            <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
              <strong>Solusi:</strong> Min-Max Normalization mengubah semua komponen ke rentang 0–1, memastikan setiap dimensi memberikan kontribusi setara terhadap IPSDA akhir.
            </p>
          </div>
 
          {/* Rumus */}
          <div className="p-4 bg-slate-900 dark:bg-slate-800 rounded-xl">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Rumus</div>
            <div className="font-mono text-sm text-yellow-300 whitespace-pre-wrap break-words">
              X_normalized = (X - X_min) / (X_max - X_min)
            </div>
            <div className="text-[10px] text-slate-400 mt-2 space-y-1">
              <div><strong>X</strong> = nilai komponen untuk provinsi tertentu</div>
              <div><strong>X_min</strong> = nilai minimum komponen (antar semua provinsi dalam 1 tahun)</div>
              <div><strong>X_max</strong> = nilai maksimum komponen (antar semua provinsi dalam 1 tahun)</div>
              <div><strong>Hasil</strong> = selalu berada dalam rentang 0 hingga 1</div>
            </div>
          </div>
 
          {/* Contoh */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Contoh: Normalisasi RPP_Ikan 5 Provinsi
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-100 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Provinsi</th>
                    <th className="px-3 py-2 text-right font-bold">RPP_Ikan</th>
                    <th className="px-3 py-2 text-center font-bold">Rumus</th>
                    <th className="px-3 py-2 text-right font-bold">Normalized</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { p: 'Maluku (MAX)', v: 0.133, n: '(0.133-0.020)/(0.133-0.020)', nv: 1.000 },
                    { p: 'Sulawesi', v: 0.087, n: '(0.087-0.020)/(0.133-0.020)', nv: 0.591 },
                    { p: 'Jawa Barat', v: 0.052, n: '(0.052-0.020)/(0.133-0.020)', nv: 0.282 },
                    { p: 'DKI Jakarta', v: 0.035, n: '(0.035-0.020)/(0.133-0.020)', nv: 0.133 },
                    { p: 'Kalimantan (MIN)', v: 0.020, n: '(0.020-0.020)/(0.133-0.020)', nv: 0.000 },
                  ].map((row, i) => (
                    <tr key={i} className={i === 4 ? 'bg-red-50 dark:bg-red-900/20' : i === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-slate-800'}>
                      <td className="px-3 py-2 text-left font-semibold">{row.p}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.v.toFixed(6)}</td>
                      <td className="px-3 py-2 text-center text-[9px] font-mono text-slate-500">{row.n}</td>
                      <td className="px-3 py-2 text-right font-black text-blue-600">{row.nv.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-2">
              ✓ Proses yang sama diterapkan untuk RPP_Perkebunan, NPI, dan KPS masing-masing dengan X_min & X_max-nya sendiri
            </p>
          </div>
 
          {/* Justifikasi */}
          <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-700">
            <div className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wide mb-2">
              ✓ Justifikasi Ilmiah
            </div>
            <ul className="space-y-1.5 text-[10px] text-teal-700 dark:text-teal-300">
              <li>✓ <strong>Jurnal Implementasi Ekonomi & Bisnis (UNIKA Santo Thomas):</strong> Normalisasi data adalah prasyarat dalam analisis Location Quotient untuk membandingkan sektor dengan karakteristik berbeda.</li>
              <li>✓ <strong>Standar Metodologi:</strong> Min-Max Normalization adalah teknik yang established dalam analisis ekonomi regional (ESDA, GIS-based analysis).</li>
              <li>✓ <strong>Efek:</strong> Mencegah variabel dengan skala besar (PDRB dalam triliun) mendominasi hasil akhir.</li>
            </ul>
          </div>
 
          {/* Aggregasi */}
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700">
            <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-2">
              📊 Agregasi Equal Weighting
            </div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 mb-2">
              Setelah normalisasi, keempat komponen diagregasi dengan bobot sama:
            </div>
            <div className="font-mono text-sm bg-slate-900 dark:bg-slate-800 text-yellow-300 p-3 rounded mb-2">
              IPSDA = (RPP_Ikan_n + RPP_Kebun_n + NPI_n + KPS_n) / 4
            </div>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
              <strong>Alasan Equal Weighting:</strong> Penelitian di Sulawesi Tengah & Jawa Barat menunjukkan bahwa setiap dimensi (produksi, nilai ekonomi, kontribusi PDRB) memiliki kepentingan setara dalam mendeskripsikan pemerataan SDA. Tidak ada prioritas a priori kepada satu dimensi.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
 
// ── Komponen Utama: TabMetadataSDA (Improved) ──────────────────────────────────────
export function TabMetadataSDA({ hasilAnalisis, unduhFns, loadingDataset }) {
  const [menuDataset, setMenuDataset] = useState(false);
  const isAI = hasilAnalisis?.is_ai_prediction;
  const scores = hasilAnalisis?.model_scores;
 
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <BookOpen size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metadata, Metodologi & Contoh Perhitungan IPSDA</h2>
        </div>
        {hasilAnalisis && !isAI && (
          <div className="relative">
            <Btn variant="primary" onClick={() => setMenuDataset(!menuDataset)}>
              <Download size={14} /> Download Dataset
            </Btn>
            {menuDataset && (
              <div className="absolute top-full mt-1 right-0 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-700 py-1">
                {[
                  { key: 'IKAN',       label: 'Dataset Ikan Tangkap',  Icon: Fish,       fn: unduhFns.ikan,       cls: 'text-blue-500'    },
                  { key: 'PERKEBUNAN', label: 'Dataset Perkebunan',    Icon: Leaf,       fn: unduhFns.perkebunan, cls: 'text-green-500'   },
                  { key: 'NILAI_IKAN', label: 'Dataset Nilai Ikan',    Icon: TrendingUp, fn: unduhFns.nilaiIkan,  cls: 'text-teal-500'    },
                  { key: 'IPSDA',      label: 'Hasil IPSDA',           Icon: Activity,   fn: unduhFns.ipsda,      cls: 'text-emerald-500' },
                ].map(d => (
                  <button key={d.key} onClick={() => { d.fn?.(); setMenuDataset(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors">
                    <d.Icon size={12} className={d.cls} /> {d.label}
                    {loadingDataset?.[d.key] && <Loader2 size={10} className="animate-spin ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
 
      {/* AI Badge */}
      {isAI && (
        <AIBadgeSDA version={hasilAnalisis.model_version} scores={hasilAnalisis.model_scores} />
      )}
 
      {/* MAIN SECTIONS */}
      <ContohPerhitungan />
      <PenjelasanThreshold />
      <MetodologiNormalisasi />
 
      {/* Sumber Data BPS (tetap) */}
      <Card className="p-5 border-l-4 border-l-teal-500">
        <SectionBar color="bg-teal-500" title="Sumber Data BPS" sub="Endpoint dan ketersediaan dataset" />
        <div className="space-y-2 mt-4">
          {[
            { ds: 'Produksi Perikanan Tangkap',      src: 'BPS /list var=1054 (Ton)',                update: 'Tahunan (2018-2019, 2023-2024)' },
            { ds: 'Produksi 8 Komoditas Perkebunan', src: 'BPS /list var=132 (Ribu Ton)',           update: 'Tahunan (2018-2023)' },
            { ds: 'Nilai Produksi Perikanan',        src: 'BPS SIMDASI id_tabel perikanan',        update: 'Tahunan (2023-2024)' },
            { ds: 'Jumlah Penduduk',                 src: 'BPS /list var=958 domain=7100',          update: 'Tahunan (34 provinsi)' },
            { ds: 'PDRB Lapangan Usaha',             src: 'BPS /list var=2268 turvar=2005 & 2022', update: 'Tahunan' },
          ].map(d => (
            <div key={d.ds} className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{d.ds}</div>
              <div className="text-[10px] text-slate-400">{d.src}</div>
              <div className="text-[10px] text-teal-500 font-semibold mt-0.5">Update: {d.update}</div>
            </div>
          ))}
        </div>
      </Card>
 
      {/* Klasifikasi (tetap) */}
      <Card className="p-5 border-l-4 border-l-rose-500">
        <SectionBar color="bg-rose-500" title="Klasifikasi Status IPSDA" sub="Interpretasi nilai index" />
        <div className="space-y-2 mt-4">
          {[
            { label: 'OPTIMAL', range: 'IPSDA ≥ 0.70', color: '#10b981', desc: 'SDA menjadi motor penggerak ekonomi daerah.' },
            { label: 'CUKUP',   range: '0.50 – 0.70',  color: '#3b82f6', desc: 'Potensi SDA mulai dirasakan, masih belum optimal.' },
            { label: 'KURANG',  range: '0.30 – 0.50',  color: '#f97316', desc: 'Daerah kaya SDA tapi dampak ekonomi terbatas.' },
            { label: 'RENDAH',  range: 'IPSDA < 0.30',  color: '#ef4444', desc: 'Ketimpangan parah — perlu intervensi khusus.' },
          ].map(s => (
            <div key={s.label} className="flex gap-3 p-2.5 rounded-lg border" style={{ borderColor: s.color + '40', backgroundColor: s.color + '08' }}>
              <div className="shrink-0 text-center">
                <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ backgroundColor: s.color + '20', color: s.color }}>{s.label}</span>
                <div className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">{s.range}</div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
 
export default TabMetadataSDA;

// ══════════════════════════════════════════════════════════
// Tab: Tren
// ══════════════════════════════════════════════════════════
const PALETTE = [
  '#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#84cc16','#14b8a6',
  '#a855f7','#0ea5e9','#fb923c','#e879f9','#4ade80',
];

const VIEW_BTNS = [
  { id: 'distribusi', label: 'Distribusi Status', Icon: BarChart2   },
  { id: 'ipsda',      label: 'Tren IPSDA Provinsi', Icon: TrendingUp },
  { id: 'ranking',    label: 'Top & Bottom',        Icon: ShieldCheck},
  { id: 'heatmap',    label: 'Heatmap',             Icon: Activity   },
];

const IPSDATooltip = ({ active, payload, label }) => {
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

const DistribTooltipSDA = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 min-w-[150px]">
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
      <div className="border-t border-slate-100 dark:border-slate-700 mt-1.5 pt-1.5 text-[10px] text-slate-400">Total: {total} provinsi</div>
    </div>
  );
};

export function TabTrendSDA({ trendData, trendLoading, trendError }) {
  const [viewMode,       setViewMode]       = useState('distribusi');
  const [selectedProvs,  setSelectedProvs]  = useState([]);
  const [provSearch,     setProvSearch]     = useState('');
  const [showProvPicker, setShowProvPicker] = useState(false);
  const [metrik,         setMetrik]         = useState('ipsda');

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
      <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mb-1">Belum ada analisis SDA tersimpan</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Simpan setidaknya 2 analisis dari tahun berbeda untuk melihat tren IPSDA.</p>
    </div>
  );

  if (trendLoading) return (
    <div className="py-14 text-center">
      <Loader2 size={28} className="text-blue-500 animate-spin mx-auto mb-3" />
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

  const tahunList     = [...new Set(trendData.map(d => d.tahun))].sort();
  const allProvs      = [...new Set(trendData.flatMap(d => d.summary.map(p => p.provinsi)))].sort();
  const filteredProvs = allProvs.filter(p => p.toLowerCase().includes(provSearch.toLowerCase()));

  const distribusiData = trendData.map(d => ({
    tahun:   String(d.tahun),
    OPTIMAL: d.status_dist.OPTIMAL || 0,
    CUKUP:   d.status_dist.CUKUP   || 0,
    KURANG:  d.status_dist.KURANG  || 0,
    RENDAH:  d.status_dist.RENDAH  || 0,
    isAI:    d.is_ai,
  }));

  const METRIK_LABEL = {
    ipsda:    'IPSDA',
    rpp_ikan: 'RPP Ikan (norm)',
    rpp_kebun:'RPP Kebun (norm)',
    npi:      'NPI (norm)',
    kps:      'KPS (norm)',
  };

  const ipsdaTrendData = tahunList.map(th => {
    const snap = trendData.find(d => d.tahun === th);
    const row  = { tahun: String(th) };
    if (snap) {
      selectedProvs.forEach(pn => {
        const p = snap.summary.find(s => s.provinsi === pn);
        row[pn] = p ? Number((p[metrik] ?? p.ipsda)?.toFixed(4)) : null;
      });
    }
    return row;
  });

  const rankingData = allProvs.map(pn => {
    const vals = trendData.flatMap(d => {
      const p = d.summary.find(s => s.provinsi === pn);
      return p?.ipsda != null ? [p.ipsda] : [];
    });
    const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const last = (() => { for (let i = trendData.length - 1; i >= 0; i--) { const p = trendData[i].summary.find(s => s.provinsi === pn); if (p?.ipsda != null) return p; } return null; })();
    return { provinsi: pn, avg: avg ? +avg.toFixed(4) : null, count: vals.length, warna: last?.warna || '#94a3b8', status: last?.status || '-' };
  }).filter(d => d.avg != null).sort((a, b) => b.avg - a.avg);

  const top5         = rankingData.slice(0, 5);
  const bottom5      = rankingData.slice(-5).reverse();
  const heatmapProvs = rankingData.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Tren dari <span className="text-blue-600 dark:text-blue-400">{trendData.length} analisis tersimpan</span>
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
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
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
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Distribusi Status IPSDA per Tahun</h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribusiData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <RTooltip content={<DistribTooltipSDA />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="OPTIMAL" stackId="a" fill="#10b981" />
                <Bar dataKey="CUKUP"   stackId="a" fill="#3b82f6" />
                <Bar dataKey="KURANG"  stackId="a" fill="#f97316" />
                <Bar dataKey="RENDAH"  stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {['OPTIMAL', 'CUKUP', 'KURANG', 'RENDAH'].map(s => {
              const latest = distribusiData[distribusiData.length - 1]?.[s] || 0;
              const prev   = distribusiData[distribusiData.length - 2]?.[s];
              const delta  = prev != null ? latest - prev : null;
              const { warna } = STATUS_SDA[s];
              return (
                <div key={s} className="p-3 rounded-xl border" style={{ borderColor: warna + '40', backgroundColor: warna + '08' }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: warna }}>{s}</div>
                  <div className="text-xl font-black text-slate-800 dark:text-white">{latest}</div>
                  <div className="text-[10px] text-slate-400">provinsi</div>
                  {delta != null && (
                    <div className={cn('text-[10px] font-semibold mt-1', delta > 0 ? 'text-teal-500' : delta < 0 ? 'text-red-400' : 'text-slate-400')}>
                      {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tren IPSDA per Provinsi ── */}
      {viewMode === 'ipsda' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Tren Metrik SDA per Provinsi</h3>
            </div>
            <div className="flex items-center gap-2">
              <select value={metrik} onChange={e => setMetrik(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
                {Object.entries(METRIK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="relative">
                <button onClick={() => setShowProvPicker(!showProvPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-blue-300 transition-colors">
                  <Filter size={11} /> Provinsi ({selectedProvs.length})
                  <ChevronDown size={11} className={cn('transition-transform', showProvPicker && 'rotate-180')} />
                </button>
                {showProvPicker && (
                  <div className="absolute top-full mt-1 right-0 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-20 max-h-72 flex flex-col">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                      <input type="text" value={provSearch} onChange={e => setProvSearch(e.target.value)}
                        placeholder="Cari provinsi..." autoFocus
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 outline-none" />
                    </div>
                    <div className="flex gap-1 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
                      <button onClick={() => setSelectedProvs(allProvs.slice(0, 8))} className="text-[10px] px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded font-semibold hover:bg-blue-100 transition-colors">Semua (maks 8)</button>
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
                              sel ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            )}>
                            <div className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0', sel ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600')}>
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
            <div className="py-10 text-center text-sm text-slate-400">Pilih minimal 1 provinsi</div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={ipsdaTrendData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 1]} />
                  <RTooltip content={<IPSDATooltip />} />
                  <ReferenceLine y={0.70} stroke="#10b981" strokeDasharray="5 3" strokeOpacity={0.6} label={{ value: 'OPTIMAL', fontSize: 9, fill: '#10b981', position: 'right' }} />
                  <ReferenceLine y={0.50} stroke="#3b82f6" strokeDasharray="5 3" strokeOpacity={0.6} label={{ value: 'CUKUP',   fontSize: 9, fill: '#3b82f6', position: 'right' }} />
                  <ReferenceLine y={0.30} stroke="#f97316" strokeDasharray="5 3" strokeOpacity={0.6} label={{ value: 'KURANG',  fontSize: 9, fill: '#f97316', position: 'right' }} />
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
                      return p?.[metrik] ?? p?.ipsda ?? null;
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
                              <span className="font-mono font-bold" style={{ color: v >= 0.7 ? '#10b981' : v >= 0.5 ? '#3b82f6' : v >= 0.3 ? '#f97316' : '#ef4444' }}>
                                {v.toFixed(3)}
                              </span>
                            ) : <span className="text-slate-300 dark:text-slate-600">-</span>}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center font-black text-slate-800 dark:text-slate-100">{avg != null ? avg.toFixed(3) : '-'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {trendDir != null ? (
                            <span className={cn('text-xs font-bold', trendDir > 0.01 ? 'text-teal-500' : trendDir < -0.01 ? 'text-red-400' : 'text-slate-400')}>
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
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Peringkat Rata-rata IPSDA</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[{ data: top5, title: 'Top 5 — IPSDA Tertinggi', Icon: CheckCircle2, clr: 'text-teal-500' },
              { data: bottom5, title: 'Bottom 5 — IPSDA Terendah', Icon: AlertTriangle, clr: 'text-red-400' }]
              .map(({ data, title, Icon, clr }) => (
                <div key={title} className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon size={14} className={clr} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">{title}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barSize={18}>
                      <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="provinsi" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} width={110} />
                      <RTooltip formatter={(v) => [v.toFixed(4), 'Rata² IPSDA']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} />
                      <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                        {data.map((entry, i) => <Cell key={i} fill={entry.warna || '#3b82f6'} fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-3 py-2.5 text-center w-10">Rank</th>
                  <th className="px-4 py-2.5 text-left">Provinsi</th>
                  <th className="px-4 py-2.5 text-center">Rata² IPSDA</th>
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
                        i < 3 ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400'
                              : i >= rankingData.length - 3 ? 'bg-red-100 dark:bg-red-900/40 text-red-500'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
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
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Heatmap IPSDA — Top 20 Provinsi × Tahun</h3>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800 min-w-[130px]">Provinsi</th>
                  {tahunList.map(th => (
                    <th key={th} className="px-3 py-3 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap min-w-[70px]">
                      {th}{trendData.find(d => d.tahun === th)?.is_ai && <span className="ml-1 text-[8px] text-purple-400">AI</span>}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-400 min-w-[70px]">Rata²</th>
                </tr>
              </thead>
              <tbody>
                {heatmapProvs.map((d, ri) => {
                  const cells   = tahunList.map(th => { const snap = trendData.find(dd => dd.tahun === th); return snap?.summary.find(s => s.provinsi === d.provinsi) || null; });
                  const nonNull = cells.filter(Boolean);
                  const avg     = nonNull.length ? nonNull.reduce((s, p) => s + (p.ipsda || 0), 0) / nonNull.length : null;
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
                              {(p.ipsda || 0).toFixed(3)}
                            </div>
                          ) : (
                            <div className="mx-auto w-14 py-1.5 rounded-lg text-[10px] text-slate-300 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-700">-</div>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        {avg != null ? <div className="font-black text-[11px]" style={{ color: d.warna }}>{avg.toFixed(3)}</div> : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 px-2">
            <span className="text-[10px] text-slate-400 font-semibold">Legenda:</span>
            {Object.entries(STATUS_SDA).map(([s, v]) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: v.warna + '30', border: `1px solid ${v.warna}60` }} />
                <span className="text-[10px] font-semibold" style={{ color: v.warna }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}