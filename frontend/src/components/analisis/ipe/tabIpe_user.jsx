"use client";
// ─── TABS IPE — USER ──────────────────────────────────────────────────────────
// Tab Info      : tabel hasil read-only + unduh
// Tab Metodologi: metodologi IPE (sama dengan admin)
// Tab Tren      : baca-saja dari data tersimpan
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import {
  Download, ChevronDown, Info, BookOpen, TrendingUp,
  AlertCircle, ExternalLink, Loader2, AlertTriangle,
  CheckCircle2, TrendingDown, Calendar, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  INDIKATOR_LABELS_IPE, INDIKATOR_COLORS_IPE, INDIKATOR_ICON_IPE,
  TAHUN_TERSEDIA_IPE, isPrediksiYearIPE,
} from './petaIpe';

const cn = (...cls) => cls.filter(Boolean).join(' ');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'info',     label: 'Info',       Icon: Info },
  { id: 'metadata', label: 'Metodologi', Icon: BookOpen },
  { id: 'tren',     label: 'Tren',       Icon: TrendingUp },
];

const STATUS_LIST = ['SANGAT_TINGGI', 'TINGGI', 'SEDANG', 'RENDAH'];
const STATUS_COLORS = {
  SANGAT_TINGGI:     { bg: '#008cd6', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  TINGGI:            { bg: '#abcd05', badge: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300' },
  SEDANG:            { bg: '#fff67f', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  RENDAH:            { bg: '#af4284', badge: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
  TIDAK_TERANALISIS: { bg: '#a6a6a6', badge: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function ProyeksiBadge({ size = 'sm', kolomProyeksi = [] }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-bold rounded-full border bg-amber-50 dark:bg-amber-900/30',
        size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5')}
      style={{ borderColor: '#fcd34d', color: '#92400e' }}
    >
      <AlertTriangle size={size === 'xs' ? 7 : 9} />
      Proyeksi Regresi Linear
      {kolomProyeksi.length > 0 && size !== 'xs' && (
        <span className="opacity-70 ml-0.5">({kolomProyeksi.join(', ')})</span>
      )}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl px-4 py-3 text-sm">
      <div className="font-bold text-slate-900 dark:text-white mb-2">Tahun {label}</div>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── TAB INFO (read-only) ─────────────────────────────────────────────────────
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
      <BarChart2 size={34} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
      <p className="text-base text-slate-500 dark:text-slate-400">
        Belum ada data analisis tersimpan.
      </p>
    </div>
  );

  const tahun        = hasilAnalisis.tahun;
  const adaProyeksi  = hasilAnalisis.ada_prediksi;
  const totalTA      = hasilAnalisis.total_tidak_teranalisis || 0;

  return (
    <div className="space-y-5">
      {/* Header badges */}
      <div className="flex flex-wrap gap-2 items-center">
        {hasilAnalisis.timestamp && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
            <Calendar size={11} /> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
          <Calendar size={11} /> Tahun {tahun}
        </span>
        {adaProyeksi && <ProyeksiBadge />}
      </div>

      {/* Keterangan skor */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700">
        <Info size={14} className="text-indigo-500 flex-shrink-0" />
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          Skor IPE bernilai <span className="font-black">0 – 100</span>. Skor <span className="font-black">100</span> adalah terbaik (relatif terhadap provinsi lain di tahun yang sama).
        </p>
      </div>

      {/* Peringatan proyeksi */}
      {adaProyeksi && (
        <div className="p-3.5 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">⚠️ Mengandung Data Proyeksi (Regresi Linear OLS)</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
              Sebagian data tidak tersedia di database aktual BPS sehingga digantikan oleh proyeksi model Regresi Linear OLS.
              Proyeksi ini merupakan estimasi matematis berdasarkan tren historis — <strong>bukan data resmi BPS</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Teranalisis',    val: hasilAnalisis.total_success || 0, cls: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700', valCls: 'text-indigo-700 dark:text-indigo-300' },
          { label: 'SANGAT TINGGI', val: jumlahKategori['SANGAT_TINGGI'] ?? 0, cls: 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700', valCls: 'text-sky-700 dark:text-sky-300' },
          { label: 'TINGGI',        val: jumlahKategori['TINGGI'] ?? 0, cls: 'bg-lime-50 dark:bg-lime-900/30 border-lime-200 dark:border-lime-700', valCls: 'text-lime-700 dark:text-lime-300' },
          { label: 'SEDANG',        val: jumlahKategori['SEDANG'] ?? 0, cls: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700', valCls: 'text-yellow-700 dark:text-yellow-300' },
          { label: 'RENDAH',        val: jumlahKategori['RENDAH'] ?? 0, cls: 'bg-fuchsia-50 dark:bg-fuchsia-900/30 border-fuchsia-200 dark:border-fuchsia-700', valCls: 'text-fuchsia-700 dark:text-fuchsia-300' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-3', s.cls)}>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1 text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className={cn('text-2xl font-black', s.valCls)}>{s.val}</div>
          </div>
        ))}
      </div>
      {totalTA > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#a6a6a6' }} />
          <span>{totalTA} provinsi tidak teranalisis</span>
        </div>
      )}

      {/* Tabel */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{dataTerfilter.length} provinsi · {tahun}</p>
          <div className="flex items-center gap-2">
            <select
              value={kategoriTerpilih}
              onChange={e => setKategoriTerpilih(e.target.value)}
              className="text-sm font-semibold px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="SEMUA">SEMUA</option>
              {[...STATUS_LIST, 'TIDAK_TERANALISIS'].map(k => (
                <option key={k} value={k}>{k.replace('_', ' ')}</option>
              ))}
            </select>
            <div className="relative">
              <button
                onClick={() => setMenuUnduh(!menuUnduh)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm"
              >
                <Download size={13} /> Unduh
              </button>
              {menuUnduh && (
                <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-20 border border-slate-200 dark:border-slate-600 py-1">
                  {['EXCEL', 'CSV', 'JSON', 'GEOJSON'].map(fmt => (
                    <button key={fmt} onClick={() => { eksporData(fmt); setMenuUnduh(false); }}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                      <Download size={11} className="text-indigo-500" /> {fmt}
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
                <th className="px-4 py-3 text-center">IPE</th>
                <th className="px-4 py-3 text-center">S1 (Laju PE)</th>
                <th className="px-4 py-3 text-center">S2 (PDRB/Kap)</th>
                <th className="px-4 py-3 text-center">Laju PE (%)</th>
                <th className="px-4 py-3 text-center">PDRB/Kapita (rb Rp)</th>
                <th className="px-4 py-3 text-center">Kategori</th>
                <th className="px-4 py-3 text-center">Sumber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {dataTerfilter.map((fitur, idx) => {
                const d   = fitur.properties.ipe_analysis;
                const dc  = d.data_komponen || {};
                const w   = getWarna(fitur, indikatorTerpilih);
                const kat = getKategori(fitur, indikatorTerpilih);
                const isTA    = kat === 'TIDAK_TERANALISIS';
                const isDark  = ['#fff67f', '#abcd05'].includes(w);
                const kp      = d.kolom_prediksi || [];
                const isProyeksi = d.sumber === 'prediksi' || d.sumber === 'campuran';
                const cellPred = (k) => kp.includes(k);
                const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/60';
                return (
                  <tr key={d.nama_provinsi} className={cn('hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors', rowBg)}>
                    <td className="px-3 py-3 text-center text-xs font-medium text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w, border: isDark ? '1px solid rgba(0,0,0,0.2)' : '' }} />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama_provinsi}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA
                        ? <span className="text-xs text-slate-400 dark:text-slate-500 italic">—</span>
                        : <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">{d.indeks_ipe ?? '—'}</span>
                      }
                    </td>
                    <td className={cn('px-4 py-3 text-center text-sm font-semibold', cellPred('LAJU_PE') ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {d.s1 != null ? d.s1.toFixed(1) : '—'}{cellPred('LAJU_PE') && <span className="ml-0.5 text-[9px]">*</span>}
                    </td>
                    <td className={cn('px-4 py-3 text-center text-sm font-semibold', cellPred('PDRB_KAPITA') ? 'text-amber-600 dark:text-amber-400' : 'text-amber-600 dark:text-amber-400')}>
                      {d.s2 != null ? d.s2.toFixed(1) : '—'}{cellPred('PDRB_KAPITA') && <span className="ml-0.5 text-[9px]">*</span>}
                    </td>
                    <td className={cn('px-4 py-3 text-center text-sm', cellPred('LAJU_PE') ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                      {dc.LAJU_PE != null ? dc.LAJU_PE + '%' : '—'}{cellPred('LAJU_PE') && <span className="ml-0.5 text-[9px]">*</span>}
                    </td>
                    <td className={cn('px-4 py-3 text-center text-sm', cellPred('PDRB_KAPITA') ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300')}>
                      {dc.PDRB_KAPITA != null ? dc.PDRB_KAPITA.toLocaleString('id-ID') : '—'}{cellPred('PDRB_KAPITA') && <span className="ml-0.5 text-[9px]">*</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold border"
                        style={{
                          borderColor: isTA ? '#cbd5e1' : w + '60',
                          color:       isTA ? '#94a3b8' : isDark ? '#1a2e00' : w,
                          backgroundColor: isTA ? 'transparent' : w + '18',
                        }}>
                        {(d.kategori_label || d.kategori || '—').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isTA
                        ? <span className="text-xs text-slate-400 dark:text-slate-500 italic">—</span>
                        : isProyeksi
                        ? <ProyeksiBadge size="xs" kolomProyeksi={kp} />
                        : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                            <CheckCircle2 size={9} /> Aktual
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
            {adaProyeksi && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={10} /> * = data proyeksi Regresi Linear OLS (bukan data resmi BPS)
              </p>
            )}
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-400" /><span className="text-[10px] text-slate-500 dark:text-slate-400">Data Aktual BPS</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400" /><span className="text-[10px] text-slate-500 dark:text-slate-400">Proyeksi Regresi Linear</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" /><span className="text-[10px] text-slate-500 dark:text-slate-400">Tidak Teranalisis</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB METODOLOGI ───────────────────────────────────────────────────────────
function MathFrac({ num, den, className = '' }) {
  return (
    <span className={cn('inline-flex flex-col items-center align-middle mx-0.5', className)}>
      <span className="text-[11px] leading-none border-b border-current px-0.5 pb-0.5">{num}</span>
      <span className="text-[11px] leading-none pt-0.5">{den}</span>
    </span>
  );
}

function MathBlock({ children, className = '' }) {
  return (
    <div className={cn('font-mono text-sm text-slate-800 dark:text-slate-100 px-4 py-3 bg-slate-50 dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto', className)}>
      {children}
    </div>
  );
}

function MetSection({ accentColor, title, sub, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-left">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
            {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
          </div>
        </div>
        <ChevronDown size={13} className={cn('text-slate-400 transition-transform flex-shrink-0', open && 'rotate-180')} />
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
          <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Metodologi IPE — Indeks Pertumbuhan Ekonomi</h2>
          <p className="text-sm text-slate-400 mt-0.5">Min-Max Normalisasi · 2 Dimensi · Berdasarkan Data Resmi BPS ADHK 2010</p>
        </div>
      </div>

      <MetSection accentColor="#6366f1" title="Konsep Dasar IPE" sub="Indeks komposit kinerja pertumbuhan ekonomi provinsi, skala 0–100" defaultOpen>
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            IPE (Indeks Pertumbuhan Ekonomi) adalah indeks komposit terstandarisasi yang mengukur kinerja pertumbuhan ekonomi wilayah provinsi pada skala <strong className="text-slate-800 dark:text-white">0 – 100</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '📈', color: '#10b981', label: 'Dimensi 1 — Dinamika', nama: 'Laju Pertumbuhan PDRB ADHK (%)', desc: 'Mengukur kecepatan tumbuh ekonomi riil (flow). Basis ADHK 2010 mengeliminasi pengaruh inflasi.', bobot: '50%', skor: 'S1' },
              { icon: '💰', color: '#f59e0b', label: 'Dimensi 2 — Kapasitas', nama: 'PDRB per Kapita ADHK (Ribu Rp)', desc: 'Mengukur output ekonomi per penduduk (stock proxy). Mencerminkan kemampuan produktif wilayah.', bobot: '50%', skor: 'S2' },
            ].map(d => (
              <div key={d.skor} className="p-4 rounded-xl border-2 flex items-start gap-3" style={{ borderColor: d.color + '40', backgroundColor: d.color + '08' }}>
                <span className="text-2xl flex-shrink-0">{d.icon}</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: d.color }}>{d.label} · Skor {d.skor} · Bobot {d.bobot}</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{d.nama}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-800 dark:text-white">Catatan:</strong> Nilai min dan max dihitung secara <strong>dinamis</strong> dari seluruh 38 provinsi Indonesia pada tahun perhitungan yang sama — bukan nilai tetap. Artinya skor IPE bersifat <em>relatif</em> antar provinsi, bukan absolut.
            </p>
          </div>
        </div>
      </MetSection>

      <MetSection accentColor="#10b981" title="Formula Normalisasi Min-Max & Penghitungan IPE" sub="Rumus resmi yang digunakan sistem" defaultOpen>
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" /><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Langkah 1a — Normalisasi Laju PE (S1)</p></div>
            <MathBlock>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">S1</span>
                <span className="mx-1">=</span>
                <MathFrac num="g − g_min" den="g_max − g_min" />
                <span className="mx-1">×</span>
                <span className="font-bold">100</span>
              </div>
            </MathBlock>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" /><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Langkah 1b — Normalisasi PDRB/Kapita (S2)</p></div>
            <MathBlock>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-amber-600 dark:text-amber-400">S2</span>
                <span className="mx-1">=</span>
                <MathFrac num="y − y_min" den="y_max − y_min" />
                <span className="mx-1">×</span>
                <span className="font-bold">100</span>
              </div>
            </MathBlock>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3"><span className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0" /><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Langkah 2 — Hitung IPE (Equal Weight 50:50)</p></div>
            <MathBlock className="border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-base">IPE</span>
                <span className="text-base">=</span>
                <span className="text-slate-700 dark:text-slate-200">(0,50 × S1)</span>
                <span>+</span>
                <span className="text-slate-700 dark:text-slate-200">(0,50 × S2)</span>
              </div>
            </MathBlock>
          </div>
        </div>
      </MetSection>

      <MetSection accentColor="#10b981" title="Klasifikasi Nilai IPE" sub="4 kelas berdasarkan rentang skor">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { l: 'SANGAT TINGGI', r: '75 – 100', bg: '#008cd6', tc: '#fff',    desc: 'Pertumbuhan sangat kuat & output/kapita tinggi' },
            { l: 'TINGGI',        r: '50 – 74',  bg: '#abcd05', tc: '#1a2e00', desc: 'Pertumbuhan baik, output di atas rata-rata' },
            { l: 'SEDANG',        r: '25 – 49',  bg: '#fff67f', tc: '#92400e', desc: 'Pertumbuhan moderat, perlu akselerasi kebijakan' },
            { l: 'RENDAH',        r: '0 – 24',   bg: '#af4284', tc: '#fff',    desc: 'Pertumbuhan lemah, perlu intervensi kebijakan' },
          ].map(s => (
            <div key={s.l} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
              <div className="py-3 text-center" style={{ backgroundColor: s.bg, color: s.tc }}>
                <div className="text-[10px] font-black uppercase mb-0.5">{s.l}</div>
                <div className="text-sm font-mono font-bold">{s.r}</div>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug text-center">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </MetSection>

      <MetSection accentColor="#14b8a6" title="Sumber Data & Link BPS" sub="Dataset resmi yang digunakan">
        <div className="space-y-2.5">
          {[
            {
              col: 'laju_pe', nama: 'Laju Pertumbuhan PDRB ADHK 2010 Menurut Provinsi [Seri 2010]', satuan: 'Persen (%)', k: 'S1 (Laju PE)',
              kCls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
              link: 'https://www.bps.go.id/id/statistics-table/2/NDQyIzI=/-seri-2010--laju-pertumbuhan-pdrb-atas-dasar-harga-konstan-2010-menurut-provinsi.html',
            },
            {
              col: 'pdrb_kapita', nama: 'PDRB per Kapita ADHK 2010 Menurut Provinsi', satuan: 'Ribu Rupiah / Kapita / Tahun', k: 'S2 (PDRB/Kap)',
              kCls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
              link: 'https://www.bps.go.id/id/statistics-table/2/NDUwIzI=/-seri-2010--pdrb-per-kapita-atas-dasar-harga-konstan-2010-menurut-provinsi.html',
            },
          ].map(d => (
            <div key={d.col} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono flex-shrink-0">{d.col}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.nama}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{d.satuan}</p>
              </div>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0', d.kCls)}>{d.k}</span>
              <a href={d.link} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0 transition-colors" title="Buka di BPS">
                <ExternalLink size={12} className="text-slate-400" />
              </a>
            </div>
          ))}
          <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 flex items-start gap-3">
            <AlertCircle size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
              Kedua indikator menggunakan basis <strong>ADHK 2010</strong> (Atas Dasar Harga Konstan) untuk mengeliminasi pengaruh inflasi, sehingga mencerminkan pertumbuhan ekonomi <strong>riil</strong>.
            </p>
          </div>
        </div>
      </MetSection>

      <MetSection accentColor="#f59e0b" title="Catatan Proyeksi Data — Regresi Linear OLS" sub="Digunakan sebagai fallback jika data aktual tidak tersedia">
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 flex items-start gap-3">
            <TrendingDown size={20} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Apa itu Regresi Linear OLS?</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Regresi Linear (Ordinary Least Squares) adalah metode statistik untuk mencari hubungan antara variabel waktu (tahun) dengan nilai data. Metode ini bekerja dengan menarik satu <strong>garis lurus paling optimal (best-fit line)</strong> di antara titik-data historis yang ada, lalu memperpanjang garis tersebut ke masa depan untuk membaca arah tren.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: 'Metode',         v: 'Linear OLS' },
              { l: 'Data Training',  v: '2010–2024 (15 titik)' },
              { l: 'Wilayah',        v: '38 Provinsi' },
              { l: 'Tahun Proyeksi', v: '2025–2045' },
            ].map(item => (
              <div key={item.l} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
                <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">{item.l}</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.v}</div>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1.5">Keterbatasan Model (Disclaimer)</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  Proyeksi ini merupakan <strong>estimasi matematis murni</strong> berdasarkan tren masa lalu dengan asumsi kondisi berjalan konstan. Model ini <strong>tidak memperhitungkan</strong> guncangan ekonomi global, perubahan kebijakan fiskal besar, bencana alam, atau lompatan teknologi masif.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MetSection>

      <MetSection accentColor="#8b5cf6" title="Justifikasi Metodologi" sub="Mengapa Min-Max dengan bobot equal weight?">
        <div className="space-y-3">
          {[
            { icon: '⚖️', title: 'Equal Weight (50:50)',          desc: 'Tidak ada rujukan resmi yang menetapkan bobot berbeda. Kedua dimensi dianggap setara: laju pertumbuhan (kecepatan) dan kapasitas output (kekuatan) sama-sama krusial.' },
            { icon: '📐', title: 'Min-Max Normalisasi',           desc: 'Menghasilkan skor 0–100 yang intuitif. Berbeda dengan standardisasi Z-score, Min-Max mempertahankan distribusi asli data tanpa asumsi normalitas.' },
            { icon: '🏛️', title: 'ADHK 2010 sebagai Basis',      desc: 'Penggunaan harga konstan 2010 mengikuti standar BPS dan SNA 2008, sehingga perbandingan antar tahun bebas dari distorsi inflasi.' },
          ].map((item, i) => (
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
    </div>
  );
}

// ─── TAB TREN (read-only) ─────────────────────────────────────────────────────
function TabTren({ daftarTersimpan }) {
  const [filterInd, setFI]  = useState('ALL');
  const [chartMode, setCM]  = useState('distribusi');

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
        tahun:         item.tahun,
        SANGAT_TINGGI: item.kategori_distribusi?.SANGAT_TINGGI ?? 0,
        TINGGI:        item.kategori_distribusi?.TINGGI ?? 0,
        SEDANG:        item.kategori_distribusi?.SEDANG ?? 0,
        RENDAH:        item.kategori_distribusi?.RENDAH ?? 0,
        adaProyeksi:   item.ada_prediksi || false,
      });
    });
    Object.keys(byInd).forEach(ind => byInd[ind].sort((a, b) => a.tahun - b.tahun));
    return byInd;
  }, [daftarTersimpan]);

  const chartData       = trendData[filterInd] || [];
  const indsAvailable   = Object.keys(trendData).filter(k => trendData[k].length > 0);
  const tahunCovered    = [...new Set(daftarTersimpan.map(d => d.tahun).filter(Boolean))].sort();
  const latestData      = chartData[chartData.length - 1];

  if (!daftarTersimpan.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
        <TrendingUp size={26} className="text-indigo-400" />
      </div>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">Belum ada data tersimpan</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-indigo-500" size={20} />
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Panel Tren IPE</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{daftarTersimpan.length} analisis · {tahunCovered.length} tahun tersimpan</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',         val: daftarTersimpan.length,           cls: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700', valCls: 'text-indigo-700 dark:text-indigo-300' },
          { label: 'Sangat Tinggi', val: latestData?.SANGAT_TINGGI ?? '-', cls: 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700',             valCls: 'text-sky-700 dark:text-sky-300' },
          { label: 'Tinggi',        val: latestData?.TINGGI ?? '-',        cls: 'bg-lime-50 dark:bg-lime-900/30 border-lime-200 dark:border-lime-700',         valCls: 'text-lime-700 dark:text-lime-300' },
          { label: 'Sedang',        val: latestData?.SEDANG ?? '-',        cls: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700', valCls: 'text-yellow-700 dark:text-yellow-300' },
          { label: 'Rendah',        val: latestData?.RENDAH ?? '-',        cls: 'bg-fuchsia-50 dark:bg-fuchsia-900/30 border-fuchsia-200 dark:border-fuchsia-700', valCls: 'text-fuchsia-700 dark:text-fuchsia-300' },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl p-3 border', c.cls)}>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{c.label}</div>
            <div className={cn('text-2xl font-black', c.valCls)}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filter indikator + chart mode */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {['ALL', 'LAJU_PE', 'PDRB_KAPITA'].map(ind => {
            const ada = indsAvailable.includes(ind);
            return (
              <button key={ind} onClick={() => ada && setFI(ind)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1',
                  filterInd === ind ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                  : ada ? 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed')}>
                <span style={{ color: filterInd === ind ? INDIKATOR_COLORS_IPE[ind] : undefined }}>{INDIKATOR_ICON_IPE[ind]}</span>
                {ind === 'ALL' ? 'Semua' : INDIKATOR_LABELS_IPE[ind]?.replace('Skor ', '')}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 ml-auto">
          {[['distribusi', 'Bar'], ['area', 'Area']].map(([key, lbl]) => (
            <button key={key} onClick={() => setCM(key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold',
                chartMode === key ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0
        ? <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data untuk indikator ini</div>
        : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-900 dark:text-white">{INDIKATOR_LABELS_IPE[filterInd]} · {chartData.length} titik</div>
              {chartData.some(d => d.adaProyeksi) && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={10} /> Beberapa titik mengandung data proyeksi
                </span>
              )}
            </div>
            {chartMode === 'distribusi' && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="SANGAT_TINGGI" name="Sangat Tinggi" stackId="a" fill="#008cd6" />
                  <Bar dataKey="TINGGI"        name="Tinggi"        stackId="a" fill="#abcd05" />
                  <Bar dataKey="SEDANG"        name="Sedang"        stackId="a" fill="#fff67f" />
                  <Bar dataKey="RENDAH"        name="Rendah"        stackId="a" fill="#af4284" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartMode === 'area' && (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    {[['gST', '#008cd6'], ['gT', '#abcd05'], ['gS', '#fff67f'], ['gR', '#af4284']].map(([id, clr]) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={clr} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={clr} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {[['SANGAT_TINGGI', '#008cd6', 'gST'], ['TINGGI', '#abcd05', 'gT'], ['SEDANG', '#fff67f', 'gS'], ['RENDAH', '#af4284', 'gR']].map(([key, clr, grad]) => (
                    <Area key={key} type="monotone" dataKey={key} name={key.replace('_', ' ')} stroke={clr} strokeWidth={2} fill={`url(#${grad})`} dot={{ r: 3, fill: clr }} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )
      }

      {/* Cakupan tahun */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cakupan Tahun Tersimpan</div>
        <div className="flex flex-wrap gap-1.5">
          {TAHUN_TERSEDIA_IPE.map(thn => {
            const ada = tahunCovered.includes(thn);
            const mungkinProyeksi = thn > 2024;
            return (
              <div key={thn} className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border',
                ada
                  ? mungkinProyeksi
                    ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500')}>
                {thn}{ada && ' ✓'}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700" /><span>Aktual BPS</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700" /><span>Proyeksi OLS</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function TabsIPE_User({
  activeTab, setActiveTab,
  hasilAnalisis, jumlahKategori,
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
                active
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30')}>
              <Icon size={14} /><span className="hidden sm:inline">{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {activeTab === 'info'     && (
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
        {activeTab === 'metadata' && <TabMetodologi />}
        {activeTab === 'tren'     && <TabTren daftarTersimpan={daftarTersimpan} />}
      </div>
    </div>
  );
}