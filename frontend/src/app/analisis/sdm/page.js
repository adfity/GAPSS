"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Play, X, Calendar, Loader2, BarChart2, Check,
  TrendingUp, Home, Activity, Heart, BookOpen, Wallet,
  Search, Save, AlertTriangle, CheckCircle2, XCircle,
  Brain, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";
import Footerauth from '@/components/layout/footerauth';
import {
  DATASET_LABELS_SDM,
  INDIKATOR_LABELS_SDM,
  INDIKATOR_COLORS_SDM,
  INDIKATOR_ICON_SDM,
  ZOOM_DEFAULT_SDM,
} from '@/components/analisis/sdm/petaSdm';
import PetaSDM from '@/components/analisis/sdm/petaSdm';
import TabsSDM from '@/components/analisis/sdm/tabSdm';

const TAHUN_BPS_AKTUAL     = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const TAHUN_ARIMA_PREDIKSI = Array.from({ length: 21 }, (_, i) => 2025 + i);

const THRESHOLD_MAP = {
  ALL:        { TINGGI: 0.70, SEDANG: 0.60 },
  KESEHATAN:  { TINGGI: 0.80, SEDANG: 0.72 },
  PENDIDIKAN: { TINGGI: 0.65, SEDANG: 0.55 },
  DAYA_BELI:  { TINGGI: 0.60, SEDANG: 0.30 },
};

const KEYS_LOADING_MAP = {
  ALL:        ['UHH', 'HLS', 'RLS', 'DAYA_BELI'],
  KESEHATAN:  ['UHH'],
  PENDIDIKAN: ['HLS', 'RLS'],
  DAYA_BELI:  ['DAYA_BELI'],
};

const getKategoriDanWarna = (nilai, indikator = 'ALL') => {
  if (nilai == null) return { kategori: '-', warna: '#cbd5e1' };
  const th = THRESHOLD_MAP[indikator] || THRESHOLD_MAP.ALL;
  if (nilai >= th.TINGGI) return { kategori: 'TINGGI', warna: '#10b981' };
  if (nilai >= th.SEDANG) return { kategori: 'SEDANG', warna: '#f59e0b' };
  return { kategori: 'RENDAH', warna: '#ef4444' };
};

export const getWarna_SDM = (fitur, indikator = 'ALL') => {
  const a = fitur?.properties?.sdm_analysis || {};
  if (a.warna_per_indikator?.[indikator]) return a.warna_per_indikator[indikator];
  const nilaiMap = {
    ALL:        a.indeks_sdm_all ?? a.indeks_sdm,
    KESEHATAN:  a.ik,
    PENDIDIKAN: a.ip,
    DAYA_BELI:  a.idb,
  };
  return getKategoriDanWarna(nilaiMap[indikator], indikator).warna;
};

export const getKategori_SDM = (fitur, indikator = 'ALL') => {
  const a = fitur?.properties?.sdm_analysis || {};
  if (a.kategori_per_indikator?.[indikator]) return a.kategori_per_indikator[indikator];
  const nilaiMap = {
    ALL:        a.indeks_sdm_all ?? a.indeks_sdm,
    KESEHATAN:  a.ik,
    PENDIDIKAN: a.ip,
    DAYA_BELI:  a.idb,
  };
  return getKategoriDanWarna(nilaiMap[indikator], indikator).kategori;
};

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
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
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
        📊 Skor Akurasi Model ARIMA v4.0
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
                {DATASET_LABELS_SDM[key] || key}
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
            {q.desc && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{q.desc}</p>
            )}
            {m.n_wilayah && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dilatih pada {m.n_wilayah} wilayah · ARIMA v4.0
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

function ModalSkenarioArima({ info, onTutup, onLanjut }) {
  const [skenario, setSkenario] = useState('moderat');
  if (!info) return null;

  const { tahun, indikator, arimaKeys = [], arimaMetrics = {} } = info;
  const isPrediksiYear = tahun > 2026;

  const SKENARIO_LIST = [
    { key: 'optimis', label: 'Optimis', desc: 'Nilai atas prediksi (+1σ growth). Asumsi kondisi terbaik.', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', activeBorder: 'border-emerald-400', icon: '📈' },
    { key: 'moderat', label: 'Moderat', desc: 'Nilai tengah forecast ARIMA (base prediction). Estimasi paling realistis.', color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-900/20', activeBorder: 'border-indigo-500', icon: '📊', recommended: true },
    { key: 'pesimis', label: 'Pesimis', desc: 'Nilai bawah prediksi (−1σ growth). Asumsi kondisi terburuk.', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20', activeBorder: 'border-amber-400', icon: '📉' },
  ];

  return (
    <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-indigo-100 dark:border-indigo-800/40 flex-shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
              <Brain size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white text-sm">Prediksi AI — Model ARIMA v4.0</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {INDIKATOR_LABELS_SDM[indikator]} · Tahun {tahun}
                {isPrediksiYear && <span className="ml-1 text-indigo-500 font-semibold">(Tahun Prediksi)</span>}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {arimaKeys.map(k => (
                  <span key={k} className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                    {DATASET_LABELS_SDM[k] || k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {isPrediksiYear
              ? `Tahun ${tahun} adalah tahun prediksi. Model ARIMA v4.0 dilatih pada data historis BPS.`
              : `Data BPS untuk variabel di atas belum tersedia. Model ARIMA v4.0 akan memprediksi nilainya.`}
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
                  {s.recommended && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">Direkomendasikan</span>}
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
              Nilai prediksi bukan data resmi BPS. Akan ditandai label <strong>"⚙️ AI ARIMA v4.0 ({skenario})"</strong>.
            </p>
          </div>
        </div>

        <div className="px-5 pb-4 pt-3 flex gap-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <button
            onClick={() => onLanjut(skenario)}
            className="flex-1 px-4 py-2.5 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 bg-indigo-600 hover:bg-indigo-700 shadow-lg"
          >
            <Brain size={14} /> Lanjut Prediksi
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCekData_SDM({ tahun, indikator, hasilCek, sedangCek, onTutup, onLanjut, onGunakaArima }) {
  if (!hasilCek && !sedangCek) return null;

  const {
    semua_kosong, ada_yang_kosong, dataset_status, kosong,
    bisa_dieksekusi, bisa_pakai_arima, arima_keys = [],
    is_prediction_year, arima_metrics = {},
  } = hasilCek || {};

  const keysLoading   = KEYS_LOADING_MAP[indikator] || KEYS_LOADING_MAP.ALL;
  const adaKosongArima = (semua_kosong || ada_yang_kosong || is_prediction_year) && bisa_pakai_arima;

  const headerCls = sedangCek ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
    : is_prediction_year ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700'
    : semua_kosong ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'
    : ada_yang_kosong ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
    : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700';

  const headerIcon = sedangCek ? <Loader2 size={18} className="text-blue-500 animate-spin flex-shrink-0" />
    : is_prediction_year ? <Brain size={18} className="text-indigo-500 flex-shrink-0" />
    : semua_kosong ? <XCircle size={18} className="text-red-500 flex-shrink-0" />
    : ada_yang_kosong ? <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
    : <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />;

  const headerTitle = sedangCek ? `Memeriksa Data Tahun ${tahun}...`
    : is_prediction_year ? `Tahun ${tahun} — Mode Prediksi ARIMA`
    : semua_kosong ? `Data ${tahun} Tidak Tersedia`
    : ada_yang_kosong ? `Sebagian Data ${tahun} Tidak Tersedia`
    : `Data ${tahun} Siap Dianalisis`;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden">
        <div className={`px-5 py-4 flex items-center gap-3 border-b ${headerCls}`}>
          {headerIcon}
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">{headerTitle}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{INDIKATOR_LABELS_SDM[indikator] || 'Semua Indikator'}</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-2">
          {sedangCek
            ? keysLoading.map(k => (
                <div key={k} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{DATASET_LABELS_SDM[k] || k}</span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase">Mengecek...</span>
                </div>
              ))
            : dataset_status && Object.entries(dataset_status).map(([k, info]) => {
                const isArimaKey = arima_keys.includes(k);
                return (
                  <div key={k} className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg border',
                    info.tersedia ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                      : isArimaKey ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  )}>
                    {info.tersedia ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                      : isArimaKey ? <Brain size={13} className="text-indigo-400 flex-shrink-0" />
                      : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">{DATASET_LABELS_SDM[k] || k}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isArimaKey && arima_metrics[k]?.quality && <QualityBadge quality={arima_metrics[k].quality} />}
                      <span className={cn(
                        'text-xs font-semibold uppercase px-2 py-0.5 rounded',
                        info.tersedia ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                          : isArimaKey ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
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
            <div className="mt-2 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50">
              <div className="flex items-start gap-2.5">
                <Brain size={15} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-indigo-800 dark:text-indigo-200">Model ARIMA v4.0 Tersedia!</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-0.5 leading-relaxed">
                    {is_prediction_year
                      ? `Tahun ${tahun} di luar data BPS. Model ARIMA akan memproyeksikan nilai hingga 2045.`
                      : `Model ARIMA dapat mengisi data kosong berdasarkan tren historis.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!sedangCek && (
          <div className="px-5 pb-5 flex flex-col gap-2">
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>
                {bisa_dieksekusi ? 'Batal' : 'Pilih Tahun Lain'}
              </Btn>
              {bisa_dieksekusi && (
                <button
                  onClick={onLanjut}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
                >
                  Lanjutkan Analisis
                </button>
              )}
            </div>
            {adaKosongArima && (
              <button
                onClick={() => onGunakaArima({ tahun, indikator, arimaKeys: arima_keys, arimaMetrics: arima_metrics })}
                className="w-full px-4 py-2.5 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 bg-indigo-600 hover:bg-indigo-700 shadow-lg"
              >
                <Brain size={14} />
                Gunakan Prediksi AI ARIMA v4.0
                <span className="text-xs font-normal opacity-80 ml-1">({arima_keys.join(', ')})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModalAlertKombo_SDM({ info, onTutup, onAmbilDariBPS }) {
  if (!info) return null;
  const { tahun, indikator } = info;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 bg-amber-50 dark:bg-amber-900/30 flex items-center gap-3 border-b border-amber-200 dark:border-amber-700">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">Data Belum Tersedia di Database</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400">{INDIKATOR_LABELS_SDM[indikator]}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Tahun {tahun}</span>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Data <strong className="text-slate-800 dark:text-slate-100">{INDIKATOR_LABELS_SDM[indikator]}</strong> tahun{' '}
            <strong className="text-slate-800 dark:text-slate-100">{tahun}</strong> belum pernah dianalisis.
          </p>
          {tahun > 2026 && (
            <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700 flex items-start gap-2.5">
              <Brain size={14} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                Tahun {tahun} adalah tahun prediksi. Klik <strong>"Analisis dengan ARIMA"</strong> untuk menggunakan model AI.
              </p>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onTutup}>Batal</Btn>
          <button
            onClick={() => onAmbilDariBPS(tahun, indikator)}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            <Play size={13} />
            {tahun > 2026 ? 'Analisis dengan ARIMA' : 'Ambil dari BPS'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Pilih Indikator & Tahun — RESPONSIVE FIX ──────────────────────────
function ModalAnalisis({ terbuka, onTutup, tahunTerpilih, setTahunTerpilih, pilihanIndikator, setPilihanIndikator, onCek, sedangMenganalisis }) {
  if (!terbuka) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Overlay klik tutup */}
      <div className="absolute inset-0" onClick={onTutup} />

      {/* Panel — bottom-sheet di mobile, centered modal di sm+ */}
      <div className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Pilih Indeks SDM</h3>
          <button onClick={onTutup} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={16} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Pilih tahun */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              <Calendar size={13} /> Tahun Data
            </label>

            {/* Data Aktual BPS */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Data Aktual BPS</p>
              <div className="grid grid-cols-4 gap-1.5">
                {TAHUN_BPS_AKTUAL.map(th => (
                  <button
                    key={th}
                    onClick={() => setTahunTerpilih(th)}
                    className={cn(
                      'px-2 py-2.5 rounded-xl text-sm font-bold border-2 transition-all',
                      tahunTerpilih === th
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600'
                    )}>
                    {th}
                  </button>
                ))}
              </div>
            </div>

            {/* Prediksi ARIMA */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Prediksi AI ARIMA v4.0</p>
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">2025–2045</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 max-h-28 overflow-y-auto pr-1">
                {TAHUN_ARIMA_PREDIKSI.map(th => (
                  <button
                    key={th}
                    onClick={() => setTahunTerpilih(th)}
                    className={cn(
                      'px-1 py-2 rounded-lg text-xs font-bold border-2 transition-all',
                      tahunTerpilih === th
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                    )}>
                    {th}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pilih indikator */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 block">
              Indikator
            </label>
            <div className="space-y-2">
              {[
                { key: 'ALL',        label: 'SDM Gabungan',      desc: 'IK + IP + IDB',               icon: <BarChart2 size={15} /> },
                { key: 'KESEHATAN',  label: 'Indeks Kesehatan',  desc: 'IK = UHH/85',                 icon: <Heart size={15} /> },
                { key: 'PENDIDIKAN', label: 'Indeks Pendidikan', desc: 'IP = (RLS/15+HLS/18)/2',      icon: <BookOpen size={15} /> },
                { key: 'DAYA_BELI',  label: 'Indeks Daya Beli',  desc: 'IDB = MinMax(Pengeluaran)',   icon: <Wallet size={15} /> },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPilihanIndikator(opt.key)}
                  className={cn(
                    'w-full p-3.5 rounded-xl border-2 transition-all text-left flex items-center gap-3',
                    pilihanIndikator === opt.key
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'
                  )}>
                  <span className="flex-shrink-0" style={{ color: pilihanIndikator === opt.key ? INDIKATOR_COLORS_SDM[opt.key] : '#94a3b8' }}>
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{opt.desc}</p>
                  </div>
                  {pilihanIndikator === opt.key && <Check size={15} className="text-indigo-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer sticky */}
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

function ModalSimpan({ terbuka, onTutup, namaSimpan, setNamaSimpan, onSimpan, sedangMenyimpan, hasilAnalisis, arimaSkenario, tahunTerpilih }) {
  if (!terbuka) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Simpan Analisis SDM</h3>
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
          placeholder={`SDM ${INDIKATOR_LABELS_SDM[hasilAnalisis?.indikator || 'ALL']} ${hasilAnalisis?.tahun || tahunTerpilih}${arimaSkenario ? ` · ARIMA ${arimaSkenario}` : ''}`}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 outline-none text-sm mb-5"
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
export default function SdmPage() {
  const API = 'http://127.0.0.1:8000/api';

  const [hasilAnalisis,      setHasilAnalisis]      = useState(null);
  const [kategoriTerpilih,   setKategoriTerpilih]   = useState('SEMUA');
  const [indikatorTerpilih,  setIndikatorTerpilih]  = useState('ALL');
  const [isClient,           setIsClient]           = useState(false);
  const [activeTab,          setActiveTab]          = useState('info');
  const [daftarTersimpan,    setDaftarTersimpan]    = useState([]);
  const [sedangMuatAwal,     setSedangMuatAwal]     = useState(true);
  const [dataBaruDariBPS,    setDataBaruDariBPS]    = useState(false);
  const [tahunTerpilih,      setTahunTerpilih]      = useState(2024);
  const [sedangMenganalisis, setSedangMenganalisis] = useState(false);
  const [sedangCekData,      setSedangCekData]      = useState(false);
  const [hasilCekData,       setHasilCekData]       = useState(null);
  const [pilihanIndikator,   setPilihanIndikator]   = useState('ALL');
  const [pernahAnalisis,     setPernahAnalisis]     = useState(false);
  const [alertKomboTidakAda, setAlertKomboTidakAda] = useState(null);
  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [modalSaveTerbuka,   setModalSaveTerbuka]   = useState(false);
  const [namaSimpan,         setNamaSimpan]         = useState('');
  const [sedangMenyimpan,    setSedangMenyimpan]    = useState(false);
  const [basemap,            setBasemap]            = useState('OSM');
  const [koordinatCursor,    setKoordinatCursor]    = useState({ lat: '0.0000', lng: '0.0000' });
  const [currentZoom,        setCurrentZoom]        = useState(ZOOM_DEFAULT_SDM);
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

  const kombinasiTersedia = useMemo(() => {
    const map = {};
    daftarTersimpan.forEach(a => {
      const ind = a.indikator || 'ALL';
      const key = `${a.tahun}|${ind}`;
      if (!map[key] || a.timestamp > map[key].timestamp)
        map[key] = { timestamp: a.timestamp, analysis_id: a.analysis_id };
    });
    return map;
  }, [daftarTersimpan]);

  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return {};
    const f = hasilAnalisis.matched_features.features;
    return {
      TINGGI: f.filter(x => getKategori_SDM(x, indikatorTerpilih) === 'TINGGI').length,
      SEDANG: f.filter(x => getKategori_SDM(x, indikatorTerpilih) === 'SEDANG').length,
      RENDAH: f.filter(x => getKategori_SDM(x, indikatorTerpilih) === 'RENDAH').length,
    };
  }, [hasilAnalisis, indikatorTerpilih]);

  const refreshDB = async () => {
    try {
      const r = await axios.get(`${API}/sdm-analysis/list/`);
      setDaftarTersimpan(r.data.results || []);
    } catch {}
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/sdm-analysis/list/`);
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => {
        const ai = (a.indikator || 'ALL') === 'ALL' ? 0 : 1;
        const bi = (b.indikator || 'ALL') === 'ALL' ? 0 : 1;
        if (ai !== bi) return ai - bi;
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
      await muatDetail(sorted[0].analysis_id, sorted[0].tahun, sorted[0].indikator || 'ALL', true);
    } catch (e) { console.error(e); }
    finally { setSedangMuatAwal(false); }
  };

  const muatDetail = async (id, tahun, indikator, silent = false) => {
    const tid = silent ? null : toast.loading('Memuat analisis...');
    try {
      const res = await axios.get(`${API}/sdm-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setIndikatorTerpilih(indikator || res.data.indikator || 'ALL');
      setPilihanIndikator(indikator || res.data.indikator || 'ALL');
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDariBPS(false);
      setArimaSkenario(res.data.use_arima && res.data.skenario ? res.data.skenario : null);
      setActiveAnalysisId(id);
      if (!silent) toast.success(`Data dimuat: ${INDIKATOR_LABELS_SDM[indikator || 'ALL']} ${tahun}`);
    } catch (e) {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error('Gagal memuat detail analisis');
      throw e;
    }
  };

  const handlePilihKombo = async (tahun, indikator) => {
    const key = `${tahun}|${indikator}`;
    if (!kombinasiTersedia[key]) { setAlertKomboTidakAda({ tahun, indikator }); return; }
    await muatDetail(kombinasiTersedia[key].analysis_id, tahun, indikator);
  };

  const handleAmbilDariBPS = (tahun, indikator) => {
    setAlertKomboTidakAda(null);
    setTahunTerpilih(tahun);
    setPilihanIndikator(indikator);
    cekDanAnalisis(indikator, tahun);
  };

  const cekDanAnalisis = async (indikator = null, tahun = null) => {
    const pilihan = indikator || pilihanIndikator;
    const thn     = tahun    || tahunTerpilih;
    pendingRef.current = { pilihan, tahunFetch: thn };
    setModalAnalisisTerbuka(false);
    setSedangCekData(true);
    setHasilCekData(null);
    try {
      const r = await axios.post(`${API}/check-sdm-data/`, { tahun: thn, indikator: pilihan });
      setHasilCekData(r.data);
    } catch {
      toast.error('Gagal memeriksa ketersediaan data BPS');
    } finally {
      setSedangCekData(false);
    }
  };

  const lanjutkanAnalisis = async () => {
    if (!pendingRef.current) return;
    const { pilihan, tahunFetch } = pendingRef.current;
    setHasilCekData(null);
    setSedangMenganalisis(true);
    setKategoriTerpilih('SEMUA');
    setArimaSkenario(null);
    setActiveAnalysisId(null);
    const tid = toast.loading(`Mengambil data BPS SDM ${tahunFetch}...`);
    try {
      const r = await axios.post(`${API}/analyze-sdm-bps/`, { indikator: pilihan, tahun: tahunFetch });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setIndikatorTerpilih(pilihan);
        setTahunTerpilih(tahunFetch);
        setPernahAnalisis(true);
        setDataBaruDariBPS(true);
        setActiveTab('info');
        toast.success(`Berhasil: ${r.data.total_success} provinsi (${tahunFetch})!`, { duration: 5000 });
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
    const { tahun: thn, indikator: ind, arimaKeys } = modalSkenarioArima;
    setModalSkenarioArima(null);
    setSedangMenganalisis(true);
    setKategoriTerpilih('SEMUA');
    setArimaSkenario(skenario);
    setActiveAnalysisId(null);
    const tid = toast.loading(`Memproses ARIMA v4.0 (${skenario}) untuk ${thn}...`);
    try {
      const r = await axios.post(`${API}/analyze-sdm-bps/`, {
        indikator:  ind,
        tahun:      thn,
        use_arima:  true,
        skenario:   skenario,
        arima_keys: arimaKeys,
      });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setIndikatorTerpilih(ind);
        setTahunTerpilih(thn);
        setPernahAnalisis(true);
        setDataBaruDariBPS(true);
        setActiveTab('info');
        toast.success(`Berhasil: ${r.data.total_success} provinsi · ⚙️ ARIMA v4.0 (${skenario})`, { duration: 5000 });
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal analisis dengan ARIMA');
    } finally {
      setSedangMenganalisis(false);
    }
  };

  const simpan = async () => {
    if (!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const r = await axios.post(`${API}/save-sdm-analysis/`, { name: namaSimpan, analysis_data: hasilAnalisis });
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
      toast.error('Gagal menyimpan');
    } finally {
      setSedangMenyimpan(false);
    }
  };

  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nama });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const LABEL_INDEKS = { ALL: 'ISDM', KESEHATAN: 'IK', PENDIDIKAN: 'IP', DAYA_BELI: 'IDB' };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r       = hasilAnalisis.analysis_summary || [];
    const thn     = hasilAnalisis.tahun || tahunTerpilih;
    const ind     = hasilAnalisis.indikator || 'ALL';
    const tgl     = new Date().toISOString().split('T')[0];
    const labelIdx = LABEL_INDEKS[ind] || 'ISDM';
    const aiSuffix = hasilAnalisis.use_arima ? `_ARIMA_${hasilAnalisis.skenario}` : '';

    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi: i.provinsi, Kategori: i.kategori, [labelIdx]: i.indeks_sdm,
        'ISDM Gabungan': i.indeks_sdm_all || '-',
        'UHH (tahun)': i.uhh || '-', 'RLS (tahun)': i.rls || '-',
        'HLS (tahun)': i.hls || '-', 'Pengeluaran (Kb Rp)': i.pengeluaran || '-',
        IK: i.ik, IP: i.ip, IDB: i.idb,
        'Sumber Data': i.use_arima ? `AI ARIMA v4.0 (${hasilAnalisis.skenario})` : 'BPS',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SDM');
      XLSX.writeFile(wb, `Analisis_SDM_BPS_${ind}_${thn}${aiSuffix}_${tgl}.xlsx`);
      toast.success('Excel diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }), `Analisis_SDM_BPS_${ind}_${thn}${aiSuffix}_${tgl}.json`);
      toast.success('JSON diunduh');
    } else if (format === 'CSV') {
      const csv = [
        [`Provinsi`, `Kategori`, labelIdx, `ISDM_Gabungan`, `UHH`, `RLS`, `HLS`, `Pengeluaran`, `IK`, `IP`, `IDB`, `Sumber`].join(','),
        ...r.map(s => [s.provinsi, s.kategori, s.indeks_sdm, s.indeks_sdm_all || '-', s.uhh || '-', s.rls || '-', s.hls || '-', s.pengeluaran || '-', s.ik, s.ip, s.idb, s.use_arima ? `ARIMA_${hasilAnalisis.skenario}` : 'BPS'].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv], { type: 'text/csv' }), `Analisis_SDM_BPS_${ind}_${thn}${aiSuffix}_${tgl}.csv`);
      toast.success('CSV diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' }), `Spasial_SDM_BPS_${ind}_${thn}${aiSuffix}_${tgl}.geojson`);
      toast.success('GeoJSON diunduh');
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar />
      <SideBar />

      <ModalAlertKombo_SDM
        info={alertKomboTidakAda}
        onTutup={() => setAlertKomboTidakAda(null)}
        onAmbilDariBPS={handleAmbilDariBPS}
      />
      <ModalCekData_SDM
        tahun={pendingRef.current?.tahunFetch || tahunTerpilih}
        indikator={pendingRef.current?.pilihan || pilihanIndikator}
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
      <ModalAnalisis
        terbuka={modalAnalisisTerbuka}
        onTutup={() => setModalAnalisisTerbuka(false)}
        tahunTerpilih={tahunTerpilih}
        setTahunTerpilih={setTahunTerpilih}
        pilihanIndikator={pilihanIndikator}
        setPilihanIndikator={setPilihanIndikator}
        onCek={cekDanAnalisis}
        sedangMenganalisis={sedangMenganalisis}
      />
      <ModalSimpan
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-7 pb-5 gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Activity size={22} className="text-indigo-500" />
                Indeks SDM
              </h1>
              {arimaSkenario && hasilAnalisis?.use_arima && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                  style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', borderColor: '#a5b4fc', color: '#4f46e5' }}
                >
                  <Brain size={12} />
                  ARIMA v4.0 · {arimaSkenario}
                  {hasilAnalisis?.is_prediction_year && (
                    <span className="ml-1 text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">Prediksi</span>
                  )}
                </span>
              )}
            </div>
            <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-400">
              <Home size={12} /> <span>›</span> <span>SDN Nasional</span> <span>›</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">SDM</span>
            </nav>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={30} className="text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaSDM
                hasilAnalisis={hasilAnalisis}
                tahunTerpilih={tahunTerpilih}
                indikatorTerpilih={indikatorTerpilih}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                sedangMenganalisis={sedangMenganalisis}
                sedangCekData={sedangCekData}
                dataBaruDariBPS={dataBaruDariBPS}
                pernahAnalisis={pernahAnalisis}
                onAnalisis={() => pernahAnalisis
                  ? cekDanAnalisis()
                  : (setPilihanIndikator('ALL'), setModalAnalisisTerbuka(true))
                }
                onSimpan={() => { setNamaSimpan(''); setModalSaveTerbuka(true); }}
                onReset={() => {
                  setHasilAnalisis(null);
                  setKategoriTerpilih('SEMUA');
                  setIndikatorTerpilih('ALL');
                  setProvinsiDipilih(null);
                  setPernahAnalisis(false);
                  setDataBaruDariBPS(false);
                  setArimaSkenario(null);
                  setActiveAnalysisId(null);
                  toast.success('Analisis SDM direset');
                }}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef} basemap={basemap} setBasemap={setBasemap}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                kombinasiTersedia={kombinasiTersedia} onPilihKombo={handlePilihKombo}
                sedangMuatAwal={false}
                jumlahKategori={jumlahKategori}
                getWarna={getWarna_SDM}
                getKategori={getKategori_SDM}
              />
              <TabsSDM
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis}
                jumlahKategori={jumlahKategori}
                indikatorTerpilih={indikatorTerpilih}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunTerpilih}
                daftarTersimpan={daftarTersimpan}
                eksporData={eksporData}
                getWarna={getWarna_SDM}
                getKategori={getKategori_SDM}
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