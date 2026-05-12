"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Play, X, Calendar, Loader2, BarChart2, Check,
  Wheat, Home, Activity, Search, Save, AlertTriangle,
  CheckCircle2, XCircle, Brain, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";
import Footerauth from '@/components/layout/footerauth';
import PetaPangan, {
  TAHUN_BPS_AKTUAL_PANGAN,
  TAHUN_ARIMA_PANGAN,
  DATASET_LABELS_PANGAN,
  ZOOM_DEFAULT_PANGAN,
  getWarna_IKP,
  getKategori_IKP,
} from '@/components/analisis/pangan/petaPangan';
import TabsPangan from '@/components/analisis/pangan/tabPangan';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const API = 'http://127.0.0.1:8000/api';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(' ');

const Card = ({ children, className = '' }) => (
  <div className={cn(
    'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm',
    className
  )}>
    {children}
  </div>
);

const Btn = ({ children, variant = 'primary', className = '', ...props }) => {
  const v = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ghost:   'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600',
  };
  return (
    <button
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm',
        'transition-all active:scale-95 disabled:opacity-50',
        v[variant], className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

// ─── QUALITY BADGE ────────────────────────────────────────────────────────────
function QualityBadge({ quality }) {
  if (!quality) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border"
      style={{ borderColor: quality.color + '60', color: quality.color, backgroundColor: quality.color + '15' }}
    >
      {quality.grade} {quality.label}
    </span>
  );
}

// ─── ARIMA METRICS PANEL ─────────────────────────────────────────────────────
function ArimaMetricsPanel({ metrics }) {
  if (!metrics || Object.keys(metrics).length === 0) return null;
  const WMAPE_SCALE = [
    { max: 2,   label: 'Sangat Baik',     color: '#10b981' },
    { max: 5,   label: 'Baik',            color: '#3b82f6' },
    { max: 10,  label: 'Cukup',           color: '#f59e0b' },
    { max: 999, label: 'Perlu Perhatian', color: '#ef4444' },
  ];
  const getScale = (w) => WMAPE_SCALE.find(s => w <= s.max) || WMAPE_SCALE.at(-1);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        📊 Skor Akurasi Model ARIMA v1.0
      </p>
      {Object.entries(metrics).map(([key, m]) => {
        if (!m) return null;
        const q      = m.quality || {};
        const wmape  = m.cv_wmape;
        const scale  = wmape != null ? getScale(wmape) : null;
        const pctBar = wmape != null ? Math.min(100, (wmape / 10) * 100) : 0;
        return (
          <div key={key} className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {DATASET_LABELS_PANGAN[key] || key}
              </span>
              {q.grade && <QualityBadge quality={q} />}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { label: 'CV-MAE',   val: m.cv_mae   != null ? `${m.cv_mae.toFixed(4)}`   : '-' },
                { label: 'CV-RMSE',  val: m.cv_rmse  != null ? `${m.cv_rmse.toFixed(4)}`  : '-' },
                { label: 'CV-WMAPE', val: wmape       != null ? `${wmape.toFixed(2)}%`      : '-' },
              ].map(s => (
                <div key={s.label} className="text-center bg-slate-50 dark:bg-slate-700 rounded-lg py-2">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{s.label}</div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100">{s.val}</div>
                </div>
              ))}
            </div>
            {wmape != null && scale && (
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pctBar}%`, backgroundColor: scale.color }} />
                </div>
                <span className="text-xs font-bold" style={{ color: scale.color }}>
                  {wmape.toFixed(2)}% / 10%
                </span>
              </div>
            )}
            {m.n_wilayah && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dilatih pada {m.n_wilayah} wilayah · ARIMA v1.0
                {m.tahun_historis && Array.isArray(m.tahun_historis) &&
                  ` · Historis ${Math.min(...m.tahun_historis)}–${Math.max(...m.tahun_historis)}`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MODAL SKENARIO ARIMA ─────────────────────────────────────────────────────
function ModalSkenarioArima({ info, onTutup, onLanjut }) {
  const [skenario, setSkenario] = useState('moderat');
  if (!info) return null;

  const { tahun, arimaKeys = [], arimaMetrics = {} } = info;
  const isPrediksiYear = tahun > 2025;

  const SKENARIO_LIST = [
    {
      key: 'optimis', label: 'Optimis',
      desc: 'Nilai atas prediksi (+1σ). Asumsi kondisi produksi dan konsumsi terbaik.',
      color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      activeBorder: 'border-emerald-400', icon: '📈',
    },
    {
      key: 'moderat', label: 'Moderat',
      desc: 'Nilai tengah forecast ARIMA (base prediction). Estimasi paling realistis.',
      color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      activeBorder: 'border-indigo-500', icon: '📊', recommended: true,
    },
    {
      key: 'pesimis', label: 'Pesimis',
      desc: 'Nilai bawah prediksi (−1σ). Asumsi kondisi pangan terburuk.',
      color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20',
      activeBorder: 'border-amber-400', icon: '📉',
    },
  ];

  return (
    <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-100 dark:border-emerald-800/40 flex-shrink-0 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
              <Brain size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white text-sm">Prediksi AI — Model ARIMA v1.0 IKP</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tahun {tahun}
                {isPrediksiYear && <span className="ml-1 text-emerald-500 font-semibold">(Tahun Prediksi)</span>}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {arimaKeys.map(k => (
                  <span key={k} className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                    {DATASET_LABELS_PANGAN[k] || k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {isPrediksiYear
              ? `Tahun ${tahun} adalah tahun prediksi. Model ARIMA v1.0 dilatih pada data historis BPS produksi padi, kemiskinan, konsumsi, dan penduduk.`
              : `Data BPS untuk variabel di atas belum tersedia. Model ARIMA v1.0 akan memprediksi nilainya.`}
            {' '}Pilih skenario:
          </p>

          {SKENARIO_LIST.map(s => (
            <button key={s.key} onClick={() => setSkenario(s.key)}
              className={cn(
                'w-full p-3.5 rounded-xl border-2 transition-all text-left flex items-start gap-3',
                skenario === s.key ? `${s.activeBorder} ${s.bg}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800'
              )}>
              <span className="text-xl flex-shrink-0 mt-0.5">{s.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{s.label}</span>
                  {s.recommended && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">Direkomendasikan</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
              {skenario === s.key && <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: s.color }} />}
            </button>
          ))}

          {Object.keys(arimaMetrics).length > 0 && <ArimaMetricsPanel metrics={arimaMetrics} />}

          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              Nilai prediksi bukan data resmi BPS. Akan ditandai label{' '}
              <strong>⚙️ ARIMA v1.0 ({skenario})</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-3 flex gap-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <button
            onClick={() => onLanjut(skenario)}
            className="flex-1 px-4 py-2.5 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 bg-emerald-600 hover:bg-emerald-700 shadow-lg"
          >
            <Brain size={14} /> Lanjut Prediksi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL CEK DATA IKP ───────────────────────────────────────────────────────
function ModalCekDataIKP({ tahun, hasilCek, sedangCek, onTutup, onLanjut, onGunakaArima }) {
  if (!hasilCek && !sedangCek) return null;

  const {
    semua_kosong, ada_yang_kosong, dataset_status, kosong,
    bisa_dieksekusi, bisa_pakai_arima, arima_keys = [],
    is_prediction_year, arima_metrics = {},
  } = hasilCek || {};

  const keysLoading = ['PADI', 'KONSUMSI', 'KEMISKINAN', 'PENDUDUK'];
  const adaKosongArima = (semua_kosong || ada_yang_kosong || is_prediction_year) && bisa_pakai_arima;

  const headerCls = sedangCek
    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
    : is_prediction_year
      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700'
      : semua_kosong
        ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'
        : ada_yang_kosong
          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
          : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700';

  const headerIcon = sedangCek
    ? <Loader2 size={18} className="text-blue-500 animate-spin flex-shrink-0" />
    : is_prediction_year
      ? <Brain size={18} className="text-emerald-500 flex-shrink-0" />
      : semua_kosong
        ? <XCircle size={18} className="text-red-500 flex-shrink-0" />
        : ada_yang_kosong
          ? <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
          : <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />;

  const headerTitle = sedangCek
    ? `Memeriksa Ketersediaan Data Tahun ${tahun}...`
    : is_prediction_year
      ? `Tahun ${tahun} — Mode Prediksi ARIMA`
      : semua_kosong
        ? `Data ${tahun} Tidak Tersedia`
        : ada_yang_kosong
          ? `Sebagian Data ${tahun} Tidak Tersedia`
          : `Data ${tahun} Siap Dianalisis`;

  // Label tampilan per key
  const DISPLAY_LABELS = {
    PADI:       'Produksi Padi (SIMDASI)',
    KONSUMSI:   'Konsumsi Kalori & Protein (Susenas)',
    KEMISKINAN: 'Kemiskinan % (BPS)',
    PENDUDUK:   'Jumlah Penduduk (SIMDASI)',
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className={`px-5 py-4 flex items-center gap-3 border-b ${headerCls}`}>
          {headerIcon}
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">{headerTitle}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Indeks Ketahanan Pangan (IKP)</p>
          </div>
        </div>

        {/* Dataset status */}
        <div className="px-5 py-4 space-y-2">
          {sedangCek
            ? keysLoading.map(k => (
                <div key={k} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{DISPLAY_LABELS[k] || k}</span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">Mengecek...</span>
                </div>
              ))
            : dataset_status && Object.entries(dataset_status).map(([k, info]) => {
                const isArimaKey = arima_keys.includes(k);
                return (
                  <div key={k} className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg border',
                    info.tersedia
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                      : isArimaKey
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  )}>
                    {info.tersedia
                      ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                      : isArimaKey
                        ? <Brain size={13} className="text-emerald-400 flex-shrink-0" />
                        : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">
                      {DISPLAY_LABELS[k] || k}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isArimaKey && arima_metrics[k]?.quality && <QualityBadge quality={arima_metrics[k].quality} />}
                      <span className={cn(
                        'text-xs font-semibold uppercase px-2 py-0.5 rounded',
                        info.tersedia
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                          : isArimaKey
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300'
                      )}>
                        {info.tersedia ? 'Tersedia' : isArimaKey ? 'ARIMA ⚙️' : 'Tidak Ada'}
                      </span>
                    </div>
                  </div>
                );
              })
          }

          {!sedangCek && adaKosongArima && (
            <div className="mt-2 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50">
              <div className="flex items-start gap-2.5">
                <Brain size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Model ARIMA v1.0 Pangan Tersedia!</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-0.5 leading-relaxed">
                    {is_prediction_year
                      ? `Tahun ${tahun} di luar data BPS. Model ARIMA akan memproyeksikan IKP hingga 2045.`
                      : `Model ARIMA dapat mengisi data komponen IKP yang kosong berdasarkan tren historis.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!sedangCek && (
          <div className="px-5 pb-5 flex flex-col gap-2">
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>
                {bisa_dieksekusi ? 'Batal' : 'Pilih Tahun Lain'}
              </Btn>
              {bisa_dieksekusi && (
                <button
                  onClick={onLanjut}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
                >
                  Lanjutkan Analisis
                </button>
              )}
            </div>
            {adaKosongArima && (
              <button
                onClick={() => onGunakaArima({ tahun, arimaKeys: arima_keys, arimaMetrics: arima_metrics })}
                className="w-full px-4 py-2.5 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 bg-emerald-600 hover:bg-emerald-700 shadow-lg"
              >
                <Brain size={14} />
                Gunakan Prediksi AI ARIMA v1.0
                <span className="text-xs font-normal opacity-80 ml-1">({arima_keys.join(', ')})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL ALERT KOMBO TIDAK ADA ──────────────────────────────────────────────
function ModalAlertKomboIKP({ info, onTutup, onAmbilDariBPS }) {
  if (!info) return null;
  const { tahun } = info;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 bg-amber-50 dark:bg-amber-900/30 flex items-center gap-3 border-b border-amber-200 dark:border-amber-700">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">Data Belum Tersedia di Database</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">IKP · Tahun {tahun}</span>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Data IKP tahun <strong className="text-slate-800 dark:text-slate-100">{tahun}</strong> belum pernah dianalisis.
          </p>
          {tahun > 2025 && (
            <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-700 flex items-start gap-2.5">
              <Brain size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Tahun {tahun} adalah tahun prediksi. Klik <strong>"Analisis dengan ARIMA"</strong> untuk menggunakan model AI pangan.
              </p>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <button
            onClick={() => onAmbilDariBPS(tahun)}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            <Play size={13} />
            {tahun > 2025 ? 'Analisis dengan ARIMA' : 'Ambil dari BPS'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL PILIH TAHUN ────────────────────────────────────────────────────────
function ModalAnalisisPangan({ terbuka, onTutup, tahunTerpilih, setTahunTerpilih, onCek, sedangMenganalisis }) {
  if (!terbuka) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onTutup} />
      <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[80vh]">

        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Wheat size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Analisis Ketahanan Pangan</h3>
          </div>
          <button onClick={onTutup} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={16} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              <Calendar size={13} /> Tahun Data
            </label>

            {/* BPS Aktual */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Data Aktual BPS (2020–2025)</p>
              <div className="grid grid-cols-3 gap-1.5">
                {TAHUN_BPS_AKTUAL_PANGAN.map(th => (
                  <button key={th} onClick={() => setTahunTerpilih(th)}
                    className={cn(
                      'px-2 py-2.5 rounded-xl text-sm font-bold border-2 transition-all',
                      tahunTerpilih === th
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-600'
                    )}>
                    {th}
                  </button>
                ))}
              </div>
            </div>

            {/* Prediksi ARIMA */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Prediksi AI ARIMA v1.0</p>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">2026–2045</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 max-h-28 overflow-y-auto pr-1">
                {TAHUN_ARIMA_PANGAN.map(th => (
                  <button key={th} onClick={() => setTahunTerpilih(th)}
                    className={cn(
                      'px-1 py-2 rounded-lg text-xs font-bold border-2 transition-all',
                      tahunTerpilih === th
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-300 hover:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
                    )}>
                    {th}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info formula */}
          <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Formula IKP yang akan dihitung:</p>
            <div className="space-y-1">
              {[
                ['IKv', 'Produksi Padi / Penduduk'],
                ['IA',  '1 − (% Miskin / 100)'],
                ['IPm', '(Protein/57) + (Kalori/2100)'],
                ['IS',  '1 / CV Produksi Padi 5 thn'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 w-8">{k}</span>
                  <span className="text-slate-600 dark:text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
              IKP = (IKv_norm + IA_norm + IPm_norm + IS_norm) / 4
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={() => onCek()} disabled={sedangMenganalisis}>
            <Search size={13} /> Cek & Analisis {tahunTerpilih}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL SIMPAN ─────────────────────────────────────────────────────────────
function ModalSimpanPangan({ terbuka, onTutup, namaSimpan, setNamaSimpan, onSimpan, sedangMenyimpan, hasilAnalisis, arimaSkenario, tahunTerpilih }) {
  if (!terbuka) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Simpan Analisis IKP</h3>
          <button onClick={onTutup} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={16} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Nama Analisis</label>
        <input
          type="text"
          value={namaSimpan}
          onChange={e => setNamaSimpan(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && onSimpan()}
          placeholder={`IKP ${hasilAnalisis?.tahun || tahunTerpilih}${arimaSkenario ? ` · ARIMA ${arimaSkenario}` : ''}`}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 outline-none text-sm mb-5"
        />
        <div className="flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={onSimpan} disabled={sedangMenyimpan || !namaSimpan.trim()}>
            {sedangMenyimpan ? 'Menyimpan...' : <><Save size={13} /> Simpan</>}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE UTAMA
// ══════════════════════════════════════════════════════════════════════════════
export default function PanganPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [hasilAnalisis,      setHasilAnalisis]      = useState(null);
  const [kategoriTerpilih,   setKategoriTerpilih]   = useState('SEMUA');
  const [isClient,           setIsClient]           = useState(false);
  const [activeTab,          setActiveTab]          = useState('info');
  const [daftarTersimpan,    setDaftarTersimpan]    = useState([]);
  const [sedangMuatAwal,     setSedangMuatAwal]     = useState(true);
  const [dataBaruDariBPS,    setDataBaruDariBPS]    = useState(false);
  const [tahunTerpilih,      setTahunTerpilih]      = useState(2025);
  const [sedangMenganalisis, setSedangMenganalisis] = useState(false);
  const [sedangCekData,      setSedangCekData]      = useState(false);
  const [hasilCekData,       setHasilCekData]       = useState(null);
  const [pernahAnalisis,     setPernahAnalisis]     = useState(false);
  const [alertKomboTidakAda, setAlertKomboTidakAda] = useState(null);
  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [modalSaveTerbuka,   setModalSaveTerbuka]   = useState(false);
  const [namaSimpan,         setNamaSimpan]         = useState('');
  const [sedangMenyimpan,    setSedangMenyimpan]    = useState(false);
  const [basemap,            setBasemap]            = useState('OSM');
  const [koordinatCursor,    setKoordinatCursor]    = useState({ lat: '0.0000', lng: '0.0000' });
  const [currentZoom,        setCurrentZoom]        = useState(ZOOM_DEFAULT_PANGAN);
  const [provinsiDipilih,    setProvinsiDipilih]    = useState(null);
  const [leafletReady,       setLeafletReady]       = useState(false);
  const [MapCont,            setMapCont]            = useState(null);
  const [TileLay,            setTileLay]            = useState(null);
  const [GeoComp,            setGeoComp]            = useState(null);
  const [modalSkenarioArima, setModalSkenarioArima] = useState(null);
  const [arimaSkenario,      setArimaSkenario]      = useState(null);
  const [activeAnalysisId,   setActiveAnalysisId]   = useState(null);

  const petaRef    = useRef(null);
  const pendingRef = useRef(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsClient(true);
    import('leaflet/dist/leaflet.css');
    import('react-leaflet').then(rl => {
      setMapCont(() => rl.MapContainer);
      setTileLay(() => rl.TileLayer);
      setGeoComp(() => rl.GeoJSON);
      setLeafletReady(true);
    });
  }, []);

  useEffect(() => { if (isClient) muatDariDB(); }, [isClient]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const kombinasiTersedia = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(a => {
      const key = `${a.tahun}`;
      if (!map[key] || a.timestamp > map[key].timestamp)
        map[key] = { timestamp: a.timestamp, analysis_id: a.analysis_id };
    });
    return map;
  }, [daftarTersimpan]);

  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return {};
    const f = hasilAnalisis.matched_features.features;
    return {
      TINGGI: f.filter(x => getKategori_IKP(x) === 'TINGGI').length,
      SEDANG: f.filter(x => getKategori_IKP(x) === 'SEDANG').length,
      RENDAH: f.filter(x => getKategori_IKP(x) === 'RENDAH').length,
    };
  }, [hasilAnalisis]);

  // ── DB Helpers ─────────────────────────────────────────────────────────────
  const refreshDB = async () => {
    try {
      const r = await axios.get(`${API}/pangan-analysis/list/`);
      setDaftarTersimpan(r.data.results || []);
    } catch {}
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/pangan-analysis/list/`);
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => {
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
      await muatDetail(sorted[0].analysis_id, sorted[0].tahun, true);
    } catch (e) { console.error(e); }
    finally { setSedangMuatAwal(false); }
  };

  const muatDetail = async (id, tahun, silent = false) => {
    const tid = silent ? null : toast.loading('Memuat analisis...');
    try {
      const res = await axios.get(`${API}/pangan-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2025);
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDariBPS(false);
      setArimaSkenario(res.data.use_arima && res.data.skenario ? res.data.skenario : null);
      setActiveAnalysisId(id);
      if (!silent) toast.success(`Data IKP dimuat: Tahun ${tahun}`);
    } catch (e) {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error('Gagal memuat detail analisis');
      throw e;
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePilihKombo = async (tahun) => {
    const key = `${tahun}`;
    if (!kombinasiTersedia[key]) { setAlertKomboTidakAda({ tahun }); return; }
    await muatDetail(kombinasiTersedia[key].analysis_id, tahun);
  };

  const handleAmbilDariBPS = (tahun) => {
    setAlertKomboTidakAda(null);
    setTahunTerpilih(tahun);
    cekDanAnalisis(tahun);
  };

  const cekDanAnalisis = async (tahun = null) => {
    const thn = tahun || tahunTerpilih;
    pendingRef.current = { tahunFetch: thn };
    setModalAnalisisTerbuka(false);
    setSedangCekData(true);
    setHasilCekData(null);
    try {
      const r = await axios.post(`${API}/check-pangan-data/`, { tahun: thn });
      setHasilCekData(r.data);
    } catch {
      toast.error('Gagal memeriksa ketersediaan data BPS pangan');
    } finally {
      setSedangCekData(false);
    }
  };

  const lanjutkanAnalisis = async () => {
    if (!pendingRef.current) return;
    const { tahunFetch } = pendingRef.current;
    setHasilCekData(null);
    setSedangMenganalisis(true);
    setKategoriTerpilih('SEMUA');
    setArimaSkenario(null);
    setActiveAnalysisId(null);
    const tid = toast.loading(`Mengambil data BPS IKP ${tahunFetch}...`);
    try {
      const r = await axios.post(`${API}/analyze-pangan-bps/`, { tahun: tahunFetch });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setTahunTerpilih(tahunFetch);
        setPernahAnalisis(true);
        setDataBaruDariBPS(true);
        setActiveTab('info');
        toast.success(`Berhasil: ${r.data.total_success} provinsi IKP (${tahunFetch})!`, { duration: 5000 });
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal terhubung ke server');
    } finally {
      setSedangMenganalisis(false);
    }
  };

  const handleGunakaArima = (info) => {
    setHasilCekData(null);
    setModalSkenarioArima(info);
  };

  const lanjutkanDenganArima = async (skenario) => {
    if (!modalSkenarioArima) return;
    const { tahun: thn, arimaKeys } = modalSkenarioArima;
    setModalSkenarioArima(null);
    setSedangMenganalisis(true);
    setKategoriTerpilih('SEMUA');
    setArimaSkenario(skenario);
    setActiveAnalysisId(null);
    const tid = toast.loading(`Memproses ARIMA v1.0 IKP (${skenario}) untuk ${thn}...`);
    try {
      const r = await axios.post(`${API}/analyze-pangan-bps/`, {
        tahun:      thn,
        use_arima:  true,
        skenario:   skenario,
        arima_keys: arimaKeys,
      });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setTahunTerpilih(thn);
        setPernahAnalisis(true);
        setDataBaruDariBPS(true);
        setActiveTab('info');
        toast.success(`Berhasil: ${r.data.total_success} provinsi · ⚙️ ARIMA v1.0 IKP (${skenario})`, { duration: 5000 });
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal analisis IKP dengan ARIMA');
    } finally {
      setSedangMenganalisis(false);
    }
  };

  const simpan = async () => {
    if (!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const r = await axios.post(`${API}/save-pangan-analysis/`, {
        name: namaSimpan,
        analysis_data: hasilAnalisis,
      });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false);
        setNamaSimpan('');
        setDataBaruDariBPS(false);
        setActiveAnalysisId(r.data.analysis_id);
        await refreshDB();
      }
    } catch {
      toast.dismiss(tid);
      toast.error('Gagal menyimpan analisis IKP');
    } finally {
      setSedangMenyimpan(false);
    }
  };

  // ── Ekspor ─────────────────────────────────────────────────────────────────
  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nama });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const summary  = hasilAnalisis.analysis_summary || [];
    const thn      = hasilAnalisis.tahun || tahunTerpilih;
    const tgl      = new Date().toISOString().split('T')[0];
    const aiSuffix = hasilAnalisis.use_arima ? `_ARIMA_${hasilAnalisis.skenario}` : '';

    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(summary.map(i => ({
        Provinsi:              i.provinsi,
        Kategori:              i.kategori,
        IKP:                   i.ikp,
        'Produksi Padi (ton)': i.padi_ton ?? '-',
        '% Miskin':            i.persen_miskin ?? '-',
        'Protein (gr)':        i.protein ?? '-',
        'Kalori (kkal)':       i.kalori ?? '-',
        'Penduduk (rb jiwa)':  i.penduduk_ribu ?? '-',
        'IKv (norm)':          i.ikv_norm ?? '-',
        'IA (norm)':           i.ia_norm ?? '-',
        'IPm (norm)':          i.ipm_norm ?? '-',
        'IS (norm)':           i.is_norm ?? '-',
        'Sumber Data':         i.use_arima ? `AI ARIMA v1.0 (${hasilAnalisis.skenario})` : 'BPS',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'IKP');
      XLSX.writeFile(wb, `Analisis_IKP_${thn}${aiSuffix}_${tgl}.xlsx`);
      toast.success('Excel diunduh');

    } else if (format === 'CSV') {
      const header = ['Provinsi', 'Kategori', 'IKP', 'Prod.Padi(ton)', '%Miskin', 'Protein(gr)', 'Kalori(kkal)', 'Penduduk(rb)', 'IKv_norm', 'IA_norm', 'IPm_norm', 'IS_norm', 'Sumber'].join(',');
      const rows = summary.map(s => [
        s.provinsi, s.kategori, s.ikp,
        s.padi_ton ?? '-', s.persen_miskin ?? '-', s.protein ?? '-', s.kalori ?? '-', s.penduduk_ribu ?? '-',
        s.ikv_norm ?? '-', s.ia_norm ?? '-', s.ipm_norm ?? '-', s.is_norm ?? '-',
        s.use_arima ? `ARIMA_${hasilAnalisis.skenario}` : 'BPS',
      ].join(','));
      unduhBlob(new Blob([[header, ...rows].join('\n')], { type: 'text/csv' }), `Analisis_IKP_${thn}${aiSuffix}_${tgl}.csv`);
      toast.success('CSV diunduh');

    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }), `Analisis_IKP_${thn}${aiSuffix}_${tgl}.json`);
      toast.success('JSON diunduh');

    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' }), `Spasial_IKP_${thn}${aiSuffix}_${tgl}.geojson`);
      toast.success('GeoJSON diunduh');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar />
      <SideBar />

      {/* Modals */}
      <ModalAlertKomboIKP
        info={alertKomboTidakAda}
        onTutup={() => setAlertKomboTidakAda(null)}
        onAmbilDariBPS={handleAmbilDariBPS}
      />
      <ModalCekDataIKP
        tahun={pendingRef.current?.tahunFetch || tahunTerpilih}
        hasilCek={hasilCekData}
        sedangCek={sedangCekData}
        onTutup={() => setHasilCekData(null)}
        onLanjut={lanjutkanAnalisis}
        onGunakaArima={handleGunakaArima}
      />
      <ModalSkenarioArima
        info={modalSkenarioArima}
        onTutup={() => setModalSkenarioArima(null)}
        onLanjut={lanjutkanDenganArima}
      />
      <ModalAnalisisPangan
        terbuka={modalAnalisisTerbuka}
        onTutup={() => setModalAnalisisTerbuka(false)}
        tahunTerpilih={tahunTerpilih}
        setTahunTerpilih={setTahunTerpilih}
        onCek={cekDanAnalisis}
        sedangMenganalisis={sedangMenganalisis}
      />
      <ModalSimpanPangan
        terbuka={modalSaveTerbuka}
        onTutup={() => setModalSaveTerbuka(false)}
        namaSimpan={namaSimpan}
        setNamaSimpan={setNamaSimpan}
        onSimpan={simpan}
        sedangMenyimpan={sedangMenyimpan}
        hasilAnalisis={hasilAnalisis}
        arimaSkenario={arimaSkenario}
        tahunTerpilih={tahunTerpilih}
      />

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-7 pb-5 gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Wheat size={22} className="text-emerald-500" />
                Indeks Ketahanan Pangan
              </h1>
              {arimaSkenario && hasilAnalisis?.use_arima && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                  style={{ background: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', borderColor: '#6ee7b7', color: '#065f46' }}
                >
                  <Brain size={12} />
                  ARIMA v1.0 · {arimaSkenario}
                  {hasilAnalisis?.is_prediction_year && (
                    <span className="ml-1 text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Prediksi</span>
                  )}
                </span>
              )}
            </div>
            <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-400">
              <Home size={12} /> <span>›</span>
              <span>Analisis Nasional</span> <span>›</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">Ketahanan Pangan</span>
            </nav>
          </div>

          {/* Loading awal */}
          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={30} className="text-emerald-500 animate-spin" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data ketahanan pangan...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Peta */}
              <PetaPangan
                hasilAnalisis={hasilAnalisis}
                tahunTerpilih={tahunTerpilih}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                sedangMenganalisis={sedangMenganalisis}
                sedangCekData={sedangCekData}
                dataBaruDariBPS={dataBaruDariBPS}
                pernahAnalisis={pernahAnalisis}
                onAnalisis={() => {
                  if (pernahAnalisis) cekDanAnalisis();
                  else setModalAnalisisTerbuka(true);
                }}
                onSimpan={() => { setNamaSimpan(''); setModalSaveTerbuka(true); }}
                onReset={() => {
                  setHasilAnalisis(null);
                  setKategoriTerpilih('SEMUA');
                  setProvinsiDipilih(null);
                  setPernahAnalisis(false);
                  setDataBaruDariBPS(false);
                  setArimaSkenario(null);
                  setActiveAnalysisId(null);
                  toast.success('Analisis IKP direset');
                }}
                leafletReady={leafletReady}
                MapCont={MapCont}
                TileLay={TileLay}
                GeoComp={GeoComp}
                petaRef={petaRef}
                basemap={basemap}
                setBasemap={setBasemap}
                koordinatCursor={koordinatCursor}
                setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom}
                setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih}
                setProvinsiDipilih={setProvinsiDipilih}
                kombinasiTersedia={kombinasiTersedia}
                onPilihKombo={handlePilihKombo}
                sedangMuatAwal={false}
                jumlahKategori={jumlahKategori}
              />

              {/* Tabs */}
              <TabsPangan
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis}
                jumlahKategori={jumlahKategori}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunTerpilih}
                daftarTersimpan={daftarTersimpan}
                eksporData={eksporData}
                arimaSkenario={arimaSkenario}
                analysisId={activeAnalysisId}
              />
            </div>
          )}
        </div>
      </main>

      <Footerauth />
    </div>
  );
}