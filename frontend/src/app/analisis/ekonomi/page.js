"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Play, Download, Plus, Minus, ChevronDown, Filter, Save, X,
  Activity, RotateCcw, Database, ChevronUp, Info, Table,
  FileText, ClipboardList, Search, Eye, EyeOff, Map,
  TrendingUp, RefreshCw, Calendar, AlertTriangle, CheckCircle,
  BookOpen, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";

const KATEGORI = {
  MAJU:       { warna: "#10b981", label: "MAJU",       status: "BERKEMBANG PESAT" },
  BERKEMBANG: { warna: "#f59e0b", label: "BERKEMBANG", status: "MENUJU MAJU" },
  TERTINGGAL: { warna: "#ef4444", label: "TERTINGGAL", status: "PERLU PERCEPATAN" },
};

const BASEMAPS = {
  CARTO_LIGHT: {
    label: "Carto Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    preview: "bg-slate-100",
  },
  CARTO_DARK: {
    label: "Carto Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    preview: "bg-slate-800",
  },
  OSM: {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap',
    preview: "bg-green-100",
  },
  ESRI_SATELLITE: {
    label: "Satelit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri',
    preview: "bg-stone-700",
  },
  TOPO: {
    label: "Topografi",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenTopoMap',
    preview: "bg-amber-100",
  },
  CARTO_VOYAGER: {
    label: "Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    preview: "bg-blue-50",
  },
};

const PUSAT_DEFAULT   = [-2.5, 118];
const ZOOM_DEFAULT    = 5;
const API_BASE        = 'http://127.0.0.1:8000/api';

// Mapping BPS th_code ke tahun kalender — diperluas hingga 2010
const BPS_TAHUN_MAP = {
  "130": 2030, "129": 2029, "128": 2028, "127": 2027, "126": 2026,
  "125": 2025, "124": 2024, "123": 2023, "122": 2022, "121": 2021,
  "120": 2020, "119": 2019, "118": 2018, "117": 2017, "116": 2016,
  "115": 2015, "114": 2014, "113": 2013, "112": 2012, "111": 2011,
  "110": 2010,
};
// th_code urut dari terbaru ke terlama
const BPS_TAHUN_URUT = [
  "130","129","128","127","126","125","124","123","122","121",
  "120","119","118","117","116","115","114","113","112","111","110"
];

// ── Helper warna & kategori ───────────────────────────────────────────────────
function getWarnaByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') return fitur.properties?.ekonomi_analysis?.warna || "#cbd5e1";
  const nilai = fitur.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih];
  if (nilai == null) return "#cbd5e1";
  if (indikatorTerpilih === 'PDRB')
    return nilai > 75000 ? KATEGORI.MAJU.warna : nilai > 50000 ? KATEGORI.BERKEMBANG.warna : KATEGORI.TERTINGGAL.warna;
  if (indikatorTerpilih === 'KEMISKINAN')
    return nilai < 7 ? KATEGORI.MAJU.warna : nilai < 12 ? KATEGORI.BERKEMBANG.warna : KATEGORI.TERTINGGAL.warna;
  if (indikatorTerpilih === 'INVESTASI')
    return nilai > 10000 ? KATEGORI.MAJU.warna : nilai > 5000 ? KATEGORI.BERKEMBANG.warna : KATEGORI.TERTINGGAL.warna;
  return fitur.properties?.ekonomi_analysis?.warna || "#cbd5e1";
}

function getKategoriByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') return fitur.properties?.ekonomi_analysis?.kategori || null;
  const nilai = fitur.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih];
  if (nilai == null) return null;
  if (indikatorTerpilih === 'PDRB')
    return nilai > 75000 ? 'MAJU' : nilai > 50000 ? 'BERKEMBANG' : 'TERTINGGAL';
  if (indikatorTerpilih === 'KEMISKINAN')
    return nilai < 7 ? 'MAJU' : nilai < 12 ? 'BERKEMBANG' : 'TERTINGGAL';
  if (indikatorTerpilih === 'INVESTASI')
    return nilai > 10000 ? 'MAJU' : nilai > 5000 ? 'BERKEMBANG' : 'TERTINGGAL';
  return fitur.properties?.ekonomi_analysis?.kategori || null;
}

// ── Grafik Tren — TIDAK reload otomatis, hanya load saat user minta ──────────
function GrafikTren({ hasilAnalisis }) {
  const [trenData, setTrenData]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [provinsiGrafik, setProvinsiGrafik] = useState('NASIONAL');
  const [indikatorGrafik, setIndikatorGrafik] = useState('pdrb');
  const [inputProvinsi, setInputProvinsi] = useState('');
  const [sudahDimuat, setSudahDimuat] = useState(false); // ← TIDAK auto-load

  const daftarProvinsi = hasilAnalisis?.analysis_summary?.map((s) => s.provinsi) || [];

  const muatTren = useCallback(async (namaProvinsi = '') => {
    setLoading(true);
    try {
      const params = namaProvinsi
        ? { provinsi: namaProvinsi, tahun_mulai: 2010, tahun_akhir: 2024 }
        : { tahun_mulai: 2010, tahun_akhir: 2024 };
      const res = await axios.get(`${API_BASE}/historis-ekonomi/`, { params });
      if (res.data.status === 'success') {
        setTrenData(res.data.tren);
        setProvinsiGrafik(namaProvinsi || 'NASIONAL');
        setSudahDimuat(true);
      }
    } catch {
      toast.error('Gagal memuat data tren');
    } finally {
      setLoading(false);
    }
  }, []);

  const labelMap = {
    pdrb:       { label: 'PDRB (Milyar Rp)', color: '#f59e0b', satuan: 'Milyar Rp' },
    kemiskinan: { label: 'Kemiskinan (%)',    color: '#3b82f6', satuan: '%' },
    investasi:  { label: 'Investasi (Milyar Rp)', color: '#6366f1', satuan: 'Milyar Rp' },
  };
  const cfg = labelMap[indikatorGrafik];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-blue-500" size={22} />
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Tren Pertumbuhan Ekonomi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Data BPS 2010–2024 · {provinsiGrafik}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(labelMap).map(([k, v]) => (
            <button key={k} onClick={() => setIndikatorGrafik(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                indikatorGrafik === k ? 'text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
              style={indikatorGrafik === k ? { backgroundColor: v.color } : {}}>
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Cari provinsi */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            list="daftar-provinsi-grafik"
            value={inputProvinsi}
            onChange={e => setInputProvinsi(e.target.value)}
            placeholder="Cari provinsi atau kosongkan untuk nasional..."
            className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none"
          />
          <datalist id="daftar-provinsi-grafik">
            {daftarProvinsi.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
        <button onClick={() => muatTren(inputProvinsi.trim().toUpperCase())}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all">
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
          Tampilkan
        </button>
        {provinsiGrafik !== 'NASIONAL' && (
          <button onClick={() => { setInputProvinsi(''); muatTren(''); }}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-300 transition-all">
            Nasional
          </button>
        )}
      </div>

      {/* State: belum dimuat */}
      {!sudahDimuat && !loading && (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp size={40} className="mx-auto mb-3 text-blue-300 opacity-60" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Klik "Tampilkan" untuk memuat data tren</p>
            <p className="text-xs text-slate-400 mt-1">Pilih provinsi atau biarkan kosong untuk data nasional</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span className="text-sm text-slate-500 font-medium">Memuat data tren...</span>
          </div>
        </div>
      )}

      {/* Grafik */}
      {!loading && sudahDimuat && (
        trenData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle size={32} className="mx-auto mb-2 text-yellow-400" />
              <p className="text-sm font-bold text-slate-500">Data tidak tersedia</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Line chart */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
              <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {cfg.label} — Tren {provinsiGrafik}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trenData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tahun" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: '12px' }}
                    formatter={(v) => [v != null ? v.toLocaleString('id-ID') : '-', cfg.label]}
                  />
                  <Line type="monotone" dataKey={indikatorGrafik} stroke={cfg.color} strokeWidth={3}
                    dot={{ fill: cfg.color, r: 5, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart kemiskinan */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
              <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Perbandingan Tingkat Kemiskinan per Tahun (%)
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={trenData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tahun" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar dataKey="kemiskinan" name="Kemiskinan (%)" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabel data tren */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-500 uppercase">
                    <th className="px-3 py-2">Tahun</th>
                    <th className="px-3 py-2 text-right">PDRB (Milyar Rp)</th>
                    <th className="px-3 py-2 text-right">Kemiskinan (%)</th>
                    <th className="px-3 py-2 text-right">Investasi (Milyar Rp)</th>
                    <th className="px-3 py-2 text-center">Pertumbuhan PDRB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trenData.map((row, idx) => {
                    const prev = idx > 0 ? trenData[idx - 1] : null;
                    const growth = prev?.pdrb && row.pdrb
                      ? (((row.pdrb - prev.pdrb) / prev.pdrb) * 100).toFixed(1)
                      : null;
                    return (
                      <tr key={row.tahun} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-black text-slate-900 dark:text-white text-sm">{row.tahun}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 text-sm">
                          {row.pdrb ? row.pdrb.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 text-sm">
                          {row.kemiskinan ? `${row.kemiskinan.toFixed(2)}%` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 text-sm">
                          {row.investasi ? row.investasi.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {growth !== null ? (
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                              parseFloat(growth) > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700'
                            }`}>
                              {parseFloat(growth) > 0 ? '+' : ''}{growth}%
                            </span>
                          ) : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ── Modal Daftar Tersimpan ────────────────────────────────────────────────────
function ModalDaftarTersimpan({ onClose }) {
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dipilih, setDipilih] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/ekonomi-analysis/`)
      .then(res => { if (res.data.status === 'success') setDaftar(res.data.results); })
      .catch(() => toast.error('Gagal memuat riwayat'))
      .finally(() => setLoading(false));
  }, []);

  const hapus = async (id) => {
    try {
      await axios.delete(`${API_BASE}/ekonomi-analysis/${id}/`);
      setDaftar(prev => prev.filter(d => d.analysis_id !== id));
      toast.success('Dihapus');
    } catch { toast.error('Gagal menghapus'); }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Riwayat Analisis Tersimpan</h3>
            <p className="text-xs text-slate-500 mt-1">{daftar.length} analisis ditemukan</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><X size={20} className="text-slate-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
            </div>
          ) : daftar.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Database size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Belum ada analisis tersimpan</p>
            </div>
          ) : dipilih ? (
            <div>
              <button onClick={() => setDipilih(null)} className="mb-4 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                ← Kembali ke daftar
              </button>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5">
                <h4 className="text-base font-black text-slate-900 dark:text-white mb-1">{dipilih.name}</h4>
                <p className="text-xs text-slate-500 mb-4">{new Date(dipilih.timestamp).toLocaleString('id-ID')}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label:'Total', val: dipilih.total_matched||'-', color:'blue' },
                    { label:'Maju', val: dipilih.kategori_distribusi?.MAJU||0, color:'green' },
                    { label:'Berkembang', val: dipilih.kategori_distribusi?.BERKEMBANG||0, color:'yellow' },
                    { label:'Tertinggal', val: dipilih.kategori_distribusi?.TERTINGGAL||0, color:'red' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 bg-${s.color}-50 dark:bg-${s.color}-900/20 border border-${s.color}-200`}>
                      <div className={`text-xs font-bold text-${s.color}-600 uppercase mb-1`}>{s.label}</div>
                      <div className={`text-2xl font-black text-${s.color}-700`}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 font-medium">ID: {dipilih.analysis_id}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {daftar.map((item) => (
                <div key={item.analysis_id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDipilih(item)}>
                    <div className="text-sm font-black text-slate-900 dark:text-white truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(item.timestamp).toLocaleString('id-ID')}</div>
                    {item.kategori_distribusi && (
                      <div className="flex gap-2 mt-2">
                        {item.kategori_distribusi.MAJU > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold">✅ {item.kategori_distribusi.MAJU} Maju</span>}
                        {item.kategori_distribusi.BERKEMBANG > 0 && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold">📊 {item.kategori_distribusi.BERKEMBANG} Berkembang</span>}
                        {item.kategori_distribusi.TERTINGGAL > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold">⚠️ {item.kategori_distribusi.TERTINGGAL} Tertinggal</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => hapus(item.analysis_id)}
                    className="ml-3 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-all">
                    <X size={16}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function EkonomiPage() {
  const [sedangMenganalisis, setSedangMenganalisis] = useState(false);
  const [hasilAnalisis, setHasilAnalisis]           = useState(null);
  const [kategoriTerpilih, setKategoriTerpilih]     = useState('SEMUA');
  const [indikatorTerpilih, setIndikatorTerpilih]   = useState('SEMUA');
  const [adalahClient, setAdalahClient]             = useState(false);
  const [petaSedangMemuat, setPetaSedangMemuat]     = useState(true);

  // Tahun
  const [tahunTerpilih, setTahunTerpilih]       = useState(null);
  const [menuTahunTerbuka, setMenuTahunTerbuka] = useState(false);
  // Alert data tidak ada
  const [alertTidakAda, setAlertTidakAda]       = useState(null);

  const [menuUnduhTerbuka, setMenuUnduhTerbuka]     = useState(false);
  const [menuFilterTerbuka, setMenuFilterTerbuka]   = useState(false);
  const [menuDatasetTerbuka, setMenuDatasetTerbuka] = useState(false);
  const [menuBasemapTerbuka, setMenuBasemapTerbuka] = useState(false);
  const [basemapTerpilih, setBasemapTerpilih]       = useState('CARTO_LIGHT');

  const [panelInfoTerbuka, setPanelInfoTerbuka]               = useState(false);
  const [panelTabelTerbuka, setPanelTabelTerbuka]             = useState(false);
  const [panelMetodologiTerbuka, setPanelMetodologiTerbuka]   = useState(false);
  const [panelKebijakanTerbuka, setPanelKebijakanTerbuka]     = useState(false);
  const [panelGrafikTerbuka, setPanelGrafikTerbuka]           = useState(false);

  const [provinsiKebijakanDipilih, setProvinsiKebijakanDipilih] = useState(null);

  const [koordinatCursor, setKoordinatCursor] = useState({ lat: 0, lng: 0 });
  const [currentZoom, setCurrentZoom]         = useState(ZOOM_DEFAULT);

  const [modalSaveTerbuka, setModalSaveTerbuka]   = useState(false);
  const [modalRiwayatTerbuka, setModalRiwayatTerbuka] = useState(false);
  const [namaSimpan, setNamaSimpan]               = useState('');
  const [sedangMenyimpan, setSedangMenyimpan]     = useState(false);

  const [searchQuery, setSearchQuery]             = useState('');
  const [searchTerbuka, setSearchTerbuka]         = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [provinsiDipilih, setProvinsiDipilih]     = useState(null);

  const [modeBersih, setModeBersih] = useState(false);

  const petaRef = useRef(null);

  // Leaflet lazy-load
  const [KontainerPeta, setKontainerPeta] = useState(null);
  const [LapisanPeta, setLapisanPeta]     = useState(null);
  const [GeoJSON, setGeoJSON]             = useState(null);
  const [useMapEvents, setUseMapEvents]   = useState(null);

  // ── Init: load leaflet + auto analisis ────────────────────────────────────
  useEffect(() => {
    setAdalahClient(true);
    setPetaSedangMemuat(true);
    import('react-leaflet').then((leaflet) => {
      setKontainerPeta(() => leaflet.MapContainer);
      setLapisanPeta(() => leaflet.TileLayer);
      setGeoJSON(() => leaflet.GeoJSON);
      setUseMapEvents(() => leaflet.useMapEvents);
      setPetaSedangMemuat(false);
    });
    import('leaflet/dist/leaflet.css');
  }, []);

  useEffect(() => {
    if (!petaSedangMemuat && !hasilAnalisis && !sedangMenganalisis) {
      jalankanAnalisisBPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petaSedangMemuat]);

  // ── Panel management ──────────────────────────────────────────────────────
  const bukaPanel = (setter) => {
    setPanelInfoTerbuka(false);
    setPanelTabelTerbuka(false);
    setPanelMetodologiTerbuka(false);
    setPanelKebijakanTerbuka(false);
    setPanelGrafikTerbuka(false);
    setter(true);
  };

  const toggleAllPanels = () => {
    setPanelInfoTerbuka(false);
    setPanelTabelTerbuka(false);
    setPanelMetodologiTerbuka(false);
    setPanelKebijakanTerbuka(false);
    setPanelGrafikTerbuka(false);
  };

  const adaPanelTerbuka = panelInfoTerbuka || panelTabelTerbuka || panelMetodologiTerbuka || panelKebijakanTerbuka || panelGrafikTerbuka;

  // ── Map tracker ───────────────────────────────────────────────────────────
  const MouseTracker = () => {
    if (!useMapEvents) return null;
    const MapEventsComponent = () => {
      useMapEvents({
        mousemove: (e) => setKoordinatCursor({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) }),
        zoomend:   (e) => setCurrentZoom(e.target.getZoom()),
      });
      return null;
    };
    return <MapEventsComponent />;
  };

  // ── Search suggestions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasilAnalisis?.matched_features?.features || !searchQuery.trim()) {
      setSearchSuggestions([]); return;
    }
    const suggestions = hasilAnalisis.matched_features.features
      .filter((f) => f.properties?.ekonomi_analysis?.nama_provinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((f) => ({
        nama:     f.properties.ekonomi_analysis.nama_provinsi,
        kategori: getKategoriByIndikator(f, indikatorTerpilih),
        warna:    getWarnaByIndikator(f, indikatorTerpilih),
      }))
      .slice(0, 5);
    setSearchSuggestions(suggestions);
  }, [searchQuery, hasilAnalisis, indikatorTerpilih]);

  const handleSearch = (namaProvinsi) => {
    const nama = namaProvinsi || searchQuery;
    if (!hasilAnalisis?.matched_features?.features || !nama.trim()) return;
    const fitur = hasilAnalisis.matched_features.features.find((f) =>
      f.properties?.ekonomi_analysis?.nama_provinsi?.toLowerCase() === nama.toLowerCase()
    );
    if (fitur && petaRef.current) {
      const coords = fitur.geometry.coordinates;
      let lat, lng;
      if (fitur.geometry.type === "MultiPolygon") {
        const polygon = coords[0][0];
        lat = polygon.reduce((s, c) => s + c[1], 0) / polygon.length;
        lng = polygon.reduce((s, c) => s + c[0], 0) / polygon.length;
      } else {
        const polygon = coords[0];
        lat = polygon.reduce((s, c) => s + c[1], 0) / polygon.length;
        lng = polygon.reduce((s, c) => s + c[0], 0) / polygon.length;
      }
      petaRef.current.setView([lat, lng], 7);
      setProvinsiDipilih(fitur.properties.ekonomi_analysis.nama_provinsi);
      toast.success(`📍 ${fitur.properties.ekonomi_analysis.nama_provinsi}`, { duration: 2500 });
      setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]);
    } else {
      toast.error('Provinsi tidak ditemukan');
    }
  };

  // ── Analisis utama ────────────────────────────────────────────────────────
  const jalankanAnalisisBPS = async (thCode = null) => {
    setSedangMenganalisis(true);
    setKategoriTerpilih('SEMUA');
    setProvinsiKebijakanDipilih(null);
    setAlertTidakAda(null);
    const tid = toast.loading('Mengambil data terbaru dari BPS...');
    try {
      const body = { provinces: 'ALL', indikator_terpilih: 'ALL' };
      if (thCode) body.th_code = thCode;

      const res = await axios.post(`${API_BASE}/analyze-ekonomi-bps/`, body);
      toast.dismiss(tid);
      if (res.data.status === 'success') {
        // Cek apakah tahun yang diminta berbeda dengan yang dikembalikan (fallback)
        if (thCode && res.data.th_code !== thCode) {
          const tahunDiminta = BPS_TAHUN_MAP[thCode] || thCode;
          setAlertTidakAda(`⚠️ Data tahun ${tahunDiminta} tidak tersedia di BPS. Menampilkan data tahun ${res.data.tahun} sebagai gantinya.`);
        }
        setHasilAnalisis(res.data);
        setTahunTerpilih(res.data.th_code);
        setIndikatorTerpilih('SEMUA');
        toast.success(`✅ Data tahun ${res.data.tahun} — ${res.data.total_success} provinsi`, { duration: 4000 });
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal terhubung ke server.');
    } finally {
      setSedangMenganalisis(false);
    }
  };

  const resetAnalisis = () => {
    setHasilAnalisis(null);
    setKategoriTerpilih('SEMUA');
    setIndikatorTerpilih('SEMUA');
    toggleAllPanels();
    setProvinsiDipilih(null);
    setProvinsiKebijakanDipilih(null);
    setTahunTerpilih(null);
    setModeBersih(false);
    setAlertTidakAda(null);
    toast.success('Analisis direset');
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const bukaModalSave = () => {
    if (!hasilAnalisis) return toast.error("Belum ada data");
    setNamaSimpan(''); setModalSaveTerbuka(true);
  };

  const simpanAnalisis = async () => {
    if (!namaSimpan.trim()) return toast.error("Nama tidak boleh kosong");
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const res = await axios.post(`${API_BASE}/save-ekonomi-analysis/`, {
        name: namaSimpan, analysis_data: hasilAnalisis,
      });
      toast.dismiss(tid);
      if (res.data.status === 'success') {
        toast.success(`"${namaSimpan}" disimpan!`);
        setModalSaveTerbuka(false);
        setNamaSimpan('');
        // Otomatis buka modal riwayat
        setTimeout(() => setModalRiwayatTerbuka(true), 500);
      }
    } catch { toast.dismiss(tid); toast.error('Gagal menyimpan'); }
    finally { setSedangMenyimpan(false); }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error("Data tidak tersedia");
    const ringkasan = hasilAnalisis.analysis_summary;
    setMenuUnduhTerbuka(false);
    if (format === 'EXCEL') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ringkasan.map((item) => ({
        Provinsi: item.provinsi, Kategori: item.kategori,
        'Indeks Ekonomi': item.ekonomi_index, Tahun: hasilAnalisis.tahun,
        'PDRB (Milyar Rp)': item.pdrb || '-',
        'Kemiskinan (%)': item.kemiskinan || '-',
        'Investasi PMDN (Milyar Rp)': item.investasi || '-',
      }))), "Analisis Ekonomi BPS");
      XLSX.writeFile(wb, `TERASEG_Ekonomi_${hasilAnalisis.tahun}.xlsx`);
      toast.success('Excel diunduh');
    } else if (format === 'JSON') {
      unduhBerkas(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }),
        `TERASEG_Ekonomi_${hasilAnalisis.tahun}.json`);
      toast.success('JSON diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ["Provinsi","Kategori","IEK","Tahun","PDRB","Kemiskinan","Investasi"].join(","),
        ...ringkasan.map((s) => [s.provinsi,s.kategori,s.ekonomi_index,hasilAnalisis.tahun,
          s.pdrb||'-',s.kemiskinan||'-',s.investasi||'-'].join(","))
      ].join("\n");
      unduhBerkas(new Blob([csv], { type: 'text/csv' }), `TERASEG_Ekonomi_${hasilAnalisis.tahun}.csv`);
      toast.success('CSV diunduh');
    } else if (format === 'GEOJSON') {
      unduhBerkas(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)],
        { type: 'application/json' }), `TERASEG_Spasial_Ekonomi_${hasilAnalisis.tahun}.geojson`);
      toast.success('GeoJSON diunduh');
    }
  };

  const unduhBerkas = (gumpalan, nama) => {
    const url = URL.createObjectURL(gumpalan);
    const a = document.createElement('a');
    a.href = url; a.download = nama; a.click();
    URL.revokeObjectURL(url);
  };

  const unduhDataset = (jenisDataset) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error("Dataset tidak tersedia");
    setMenuDatasetTerbuka(false);
    const datasets = hasilAnalisis.raw_datasets;
    const info     = hasilAnalisis.indikator_info;
    if (jenisDataset === 'ALL') {
      const wb = XLSX.utils.book_new();
      ['PDRB','KEMISKINAN','INVESTASI'].forEach(k => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
          Object.entries(datasets[k]||{}).map(([p,v]) => ({ Provinsi: p, [`${k}`]: v }))
        ), k);
      });
      XLSX.writeFile(wb, `TERASEG_Semua_Dataset_${hasilAnalisis.tahun}.xlsx`);
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        Object.entries(datasets[jenisDataset]||{}).map(([p,v]) => ({ Provinsi: p, [`${info?.[jenisDataset]?.nama||jenisDataset}`]: v }))
      ), jenisDataset);
      XLSX.writeFile(wb, `TERASEG_${jenisDataset}_${hasilAnalisis.tahun}.xlsx`);
    }
    toast.success('Dataset diunduh');
  };

  // ── Data terfilter ────────────────────────────────────────────────────────
  const ambilDataTabelTerfilter = () => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let fitur = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA')
      fitur = fitur.filter((f) => getKategoriByIndikator(f, indikatorTerpilih) === kategoriTerpilih);
    return fitur;
  };
  const dataTerfilter = ambilDataTabelTerfilter();

  const hitungKategori = () => {
    if (!hasilAnalisis?.matched_features?.features) return { TERTINGGAL: 0, BERKEMBANG: 0, MAJU: 0 };
    const features = hasilAnalisis.matched_features.features;
    return {
      TERTINGGAL: features.filter((f) => getKategoriByIndikator(f, indikatorTerpilih) === 'TERTINGGAL').length,
      BERKEMBANG: features.filter((f) => getKategoriByIndikator(f, indikatorTerpilih) === 'BERKEMBANG').length,
      MAJU:       features.filter((f) => getKategoriByIndikator(f, indikatorTerpilih) === 'MAJU').length,
    };
  };
  const jumlahKategori = hitungKategori();

  const getWarnaIndikator = () => {
    if (indikatorTerpilih === 'SEMUA')      return 'linear-gradient(135deg,#ef4444,#f59e0b,#10b981)';
    if (indikatorTerpilih === 'PDRB')       return 'linear-gradient(135deg,#f59e0b,#d97706)';
    if (indikatorTerpilih === 'KEMISKINAN') return 'linear-gradient(135deg,#3b82f6,#2563eb)';
    if (indikatorTerpilih === 'INVESTASI')  return 'linear-gradient(135deg,#6366f1,#4f46e5)';
    return 'linear-gradient(135deg,#64748b,#475569)';
  };

  // ── Detail kebijakan ──────────────────────────────────────────────────────
  const fiturKebijakanDipilih = provinsiKebijakanDipilih
    ? hasilAnalisis?.matched_features?.features?.find(
        (f) => f.properties?.ekonomi_analysis?.nama_provinsi === provinsiKebijakanDipilih
      )
    : null;
  const rekomendasiDipilih = fiturKebijakanDipilih?.properties?.ekonomi_analysis?.rekomendasi || [];
  const kategoriApplied    = fiturKebijakanDipilih?.properties?.ekonomi_analysis?.kategori_applied || [];

  // Tahun tersedia (dari BPS_TAHUN_MAP, tampilkan semua dari 2010-sekarang)
  const tahunTersediaList = hasilAnalisis?.tahun_tersedia || BPS_TAHUN_URUT
    .filter(k => BPS_TAHUN_MAP[k] >= 2010 && BPS_TAHUN_MAP[k] <= 2025)
    .map(k => ({ th_code: k, tahun: BPS_TAHUN_MAP[k], label: String(BPS_TAHUN_MAP[k]) }))
    .sort((a, b) => b.tahun - a.tahun);

  if (!adalahClient) return null;
  const basemapConfig = BASEMAPS[basemapTerpilih ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {!modeBersih && <HeaderBar />}
      {!modeBersih && <SideBar />}

      {/* ── MODAL SAVE ───────────────────────────────────────────────────── */}
      {modalSaveTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">Simpan Analisis</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><X size={20} className="text-slate-500" /></button>
            </div>
            <input type="text" value={namaSimpan} onChange={e => setNamaSimpan(e.target.value)}
              placeholder={`Analisis Ekonomi ${hasilAnalisis?.tahun || ''}`}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none mb-6 text-sm"
              onKeyDown={e => e.key === 'Enter' && simpanAnalisis()} />
            <div className="flex gap-3">
              <button onClick={() => setModalSaveTerbuka(false)} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm">Batal</button>
              <button onClick={simpanAnalisis} disabled={sedangMenyimpan || !namaSimpan.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:shadow-lg text-sm">
                {sedangMenyimpan ? 'Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RIWAYAT TERSIMPAN ──────────────────────────────────────── */}
      {modalRiwayatTerbuka && <ModalDaftarTersimpan onClose={() => setModalRiwayatTerbuka(false)} />}

      {/* ── MODAL DETAIL KEBIJAKAN ───────────────────────────────────────── */}
      {provinsiKebijakanDipilih && fiturKebijakanDipilih && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">
                    {fiturKebijakanDipilih.properties.ekonomi_analysis.nama_provinsi}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {kategoriApplied.map((kat, i) => {
                      const wMap = { MAJU:'#10b981',BERKEMBANG:'#f59e0b',TERTINGGAL:'#ef4444',PDRB_RENDAH:'#f59e0b',KEMISKINAN_TINGGI:'#ef4444',INVESTASI_RENDAH:'#6366f1' };
                      const w = wMap[kat] || '#64748b';
                      return (
                        <span key={i} className="px-2 py-1 rounded-lg text-xs font-black border-2"
                          style={{ borderColor: w+'40', color: w, backgroundColor: w+'10' }}>
                          {kat.replace('_',' ')}
                        </span>
                      );
                    })}
                    <span className="px-2 py-1 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      IEK: {fiturKebijakanDipilih.properties.ekonomi_analysis.ekonomi_index}
                    </span>
                  </div>
                </div>
                <button onClick={() => setProvinsiKebijakanDipilih(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex-shrink-0">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {rekomendasiDipilih.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Belum ada data rekomendasi.</p>
                </div>
              ) : rekomendasiDipilih.map((kelompok, ki) => {
                const wMap = { MAJU:'#10b981',BERKEMBANG:'#f59e0b',TERTINGGAL:'#ef4444',PDRB_RENDAH:'#f59e0b',KEMISKINAN_TINGGI:'#ef4444',INVESTASI_RENDAH:'#6366f1' };
                const wKat = wMap[kelompok.kategori] || '#64748b';
                return (
                  <div key={ki} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between"
                      style={{ backgroundColor: wKat+'15', borderLeft: `4px solid ${wKat}` }}>
                      <div>
                        <div className="text-sm font-black uppercase tracking-wider" style={{ color: wKat }}>
                          {kelompok.kategori.replace('_',' ')}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {kelompok.jumlah_aksi} aksi tersedia
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-lg text-xs font-black text-white" style={{ backgroundColor: wKat }}>
                        {kelompok.prioritas}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {kelompok.aksi.map((aksi, ai) => (
                        <div key={ai} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-xs font-black"
                              style={{ backgroundColor: wKat }}>
                              {aksi.no_aksi || ai+1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-black text-slate-900 dark:text-white">{aksi.nama_aksi}</div>
                              {aksi.detail_aksi && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{aksi.detail_aksi}</div>}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {aksi.timeline && <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-xs font-bold">⏱ {aksi.timeline}</span>}
                                {aksi.budget_est && <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md text-xs font-bold">💰 {aksi.budget_est}</span>}
                                {aksi.sub_sektor && <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold">{aksi.sub_sektor}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PETA ─────────────────────────────────────────────────────────── */}
      <div className={`fixed inset-0 bg-white dark:bg-slate-900 ${modeBersih ? 'top-0' : 'top-16'}`}>

        {/* Loading overlay */}
        {sedangMenganalisis && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <RefreshCw size={28} className="text-white animate-spin" />
              </div>
              <p className="text-base font-black text-slate-900 dark:text-white">Memuat Data BPS...</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Mengambil data ekonomi dari BPS Web API</p>
            </div>
          </div>
        )}

        {!petaSedangMemuat && KontainerPeta && (
          <KontainerPeta center={PUSAT_DEFAULT} zoom={ZOOM_DEFAULT} className="h-full w-full z-0" zoomControl={false} ref={petaRef}>
            <LapisanPeta key={basemapTerpilih} url={basemapConfig.url} attribution={basemapConfig.attribution} />
            <MouseTracker />
            {hasilAnalisis?.matched_features?.features && (
              <GeoJSON
                key={JSON.stringify(hasilAnalisis.matched_features.features) + kategoriTerpilih + indikatorTerpilih + provinsiDipilih}
                data={{ type: "FeatureCollection", features: hasilAnalisis.matched_features.features }}
                style={(fitur) => {
                  const analisis  = fitur.properties?.ekonomi_analysis || {};
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                  const warna     = getWarnaByIndikator(fitur, indikatorTerpilih);
                  let terlihat    = true;
                  if (kategoriTerpilih !== 'SEMUA' && kategoriAktif !== kategoriTerpilih) terlihat = false;
                  if (warna === "#cbd5e1") terlihat = false;
                  const isHL = provinsiDipilih === analisis.nama_provinsi;
                  return {
                    fillColor: warna, weight: isHL ? 4 : 2, opacity: terlihat ? 1 : 0,
                    color: isHL ? '#3b82f6' : 'white', fillOpacity: terlihat ? 0.75 : 0,
                  };
                }}
                onEachFeature={(fitur, lapisan) => {
                  const analisis    = fitur.properties?.ekonomi_analysis || {};
                  const dataEkonomi = analisis.data_ekonomi || {};
                  const warna       = getWarnaByIndikator(fitur, indikatorTerpilih);
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                  lapisan.bindTooltip(`
                    <div style="font-family:inherit;padding:4px;">
                      <div style="font-weight:900;color:#0f172a;text-transform:uppercase;font-size:12px;">${analisis.nama_provinsi}</div>
                      <div style="font-size:10px;font-weight:800;color:${warna};margin-top:2px;">STATUS: ${kategoriAktif||'-'}</div>
                      <div style="font-size:9px;font-weight:700;color:#64748b;margin-top:2px;">IEK: ${analisis.ekonomi_index}</div>
                    </div>
                  `, { sticky: true, opacity: 0.95 });
                  const pdrb = dataEkonomi.PDRB;
                  const kem  = dataEkonomi.KEMISKINAN;
                  const inv  = dataEkonomi.INVESTASI;
                  lapisan.bindPopup(`
                    <div style="font-family:inherit;min-width:270px;max-width:270px;color:#1e293b;padding:4px;">
                      <div style="background:linear-gradient(135deg,${warna},${warna}dd);color:white;padding:8px;border-radius:8px;margin-bottom:6px;">
                        <div style="font-weight:900;font-size:13px;text-transform:uppercase;">${analisis.nama_provinsi}</div>
                        <div style="font-size:9px;opacity:.8;margin-top:2px;">Data BPS ${hasilAnalisis?.tahun || ''}</div>
                        <div style="background:rgba(255,255,255,0.2);border-radius:5px;padding:5px;margin-top:5px;">
                          <div style="font-size:8px;font-weight:800;opacity:.9;text-transform:uppercase;margin-bottom:2px;">INDEKS EKONOMI</div>
                          <div style="text-align:center;font-size:12px;font-weight:900;">IEK: ${analisis.ekonomi_index} / 3.0</div>
                        </div>
                      </div>
                      <div style="padding:0 2px;">
                        <div style="text-align:center;margin-bottom:6px;">
                          <span style="background:${warna};color:white;padding:4px 12px;border-radius:10px;font-size:9px;font-weight:900;text-transform:uppercase;">${kategoriAktif||'-'}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr;gap:4px;margin-bottom:8px;">
                          <div style="background:#fef3c7;padding:6px;border-radius:6px;border-left:2px solid #f59e0b;">
                            <div style="font-size:8px;font-weight:900;color:#92400e;">💹 PDRB</div>
                            <div style="font-size:12px;font-weight:900;color:#b45309;">Rp${pdrb?(pdrb/1000).toFixed(1):'-'} T</div>
                          </div>
                          <div style="background:#dbeafe;padding:6px;border-radius:6px;border-left:2px solid #3b82f6;">
                            <div style="font-size:8px;font-weight:900;color:#1e3a8a;">👥 KEMISKINAN</div>
                            <div style="font-size:12px;font-weight:900;color:#1e40af;">${kem?kem.toFixed(2)+'%':'-'}</div>
                          </div>
                          <div style="background:#ede9fe;padding:6px;border-radius:6px;border-left:2px solid #6366f1;">
                            <div style="font-size:8px;font-weight:900;color:#312e81;">💰 INVESTASI</div>
                            <div style="font-size:12px;font-weight:900;color:#3730a3;">Rp${inv?(inv/1000).toFixed(2):'-'} T</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  `, { maxWidth: 290 });
                }}
              />
            )}
          </KontainerPeta>
        )}

        {/* ── ALERT: data tahun tidak ada ─────────────────────────────── */}
        {alertTidakAda && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] max-w-md w-full px-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-lg">
              <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium flex-1">{alertTidakAda}</p>
              <button onClick={() => setAlertTidakAda(null)} className="text-yellow-500 hover:text-yellow-700 flex-shrink-0"><X size={14}/></button>
            </div>
          </div>
        )}

        {/* ── JUDUL + BADGE TAHUN ──────────────────────────────────────── */}
        {!modeBersih && (
          <div className="absolute top-6 left-6 z-[1000] flex items-center gap-2">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 rounded-xl shadow-xl">
              <div className="text-sm font-black text-white uppercase tracking-wider">💼 SDM Nasional Ekonomi</div>
            </div>
            {hasilAnalisis?.tahun && (
              <div className="bg-white dark:bg-slate-800 px-3 py-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Calendar size={13} className="text-blue-500" />
                <span className="text-sm font-black text-slate-900 dark:text-white">{hasilAnalisis.tahun}</span>
              </div>
            )}
          </div>
        )}

        {/* ── ZOOM ─────────────────────────────────────────────────────── */}
        {!modeBersih && (
          <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2">
            <button onClick={() => petaRef.current?.zoomIn()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 active:scale-90 border border-slate-200 dark:border-slate-700"><Plus size={16}/></button>
            <button onClick={() => petaRef.current?.zoomOut()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 active:scale-90 border border-slate-200 dark:border-slate-700"><Minus size={16}/></button>
          </div>
        )}

        {/* ── MODE BERSIH ──────────────────────────────────────────────── */}
        {hasilAnalisis && (
          <div className="absolute top-[170px] left-6 z-[1000]">
            <button onClick={() => setModeBersih(!modeBersih)}
              className="p-2.5 rounded-lg shadow-lg active:scale-90 border-2 border-white dark:border-slate-700"
              style={{ background: getWarnaIndikator() }}>
              {modeBersih ? <EyeOff size={16} className="text-white" /> : <Eye size={16} className="text-white" />}
            </button>
          </div>
        )}

        {/* ── BASEMAP ───────────────────────────────────────────────────── */}
        {!modeBersih && (
          <div className={`absolute left-6 z-[1001] ${hasilAnalisis ? 'top-[215px]' : 'top-[170px]'}`}>
            <div className="relative">
              <button onClick={() => setMenuBasemapTerbuka(!menuBasemapTerbuka)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 active:scale-90 border border-slate-200 dark:border-slate-700">
                <Map size={16} />
              </button>
              {menuBasemapTerbuka && (
                <div className="absolute left-full ml-2 top-0 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-[1002] border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Basemap</div>
                  </div>
                  <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
                    {Object.entries(BASEMAPS).map(([key, bm]) => (
                      <button key={key} onClick={() => { setBasemapTerpilih(key); setMenuBasemapTerbuka(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${basemapTerpilih===key ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 border-2 ${basemapTerpilih===key?'border-white/50':'border-slate-200 dark:border-slate-600'} ${bm.preview}`}></div>
                        <span className="text-xs font-black uppercase">{bm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SEARCH ───────────────────────────────────────────────────── */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute top-[263px] left-6 z-[1000]">
            {searchTerbuka ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 flex gap-2">
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && handleSearch()} placeholder="Cari provinsi..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none w-48" autoFocus />
                  <button onClick={() => handleSearch()} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Search size={16}/></button>
                  <button onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); setProvinsiDipilih(null); }}
                    className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-lg"><X size={16}/></button>
                </div>
                {searchSuggestions.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                    {searchSuggestions.map((sug, idx) => (
                      <button key={idx} onClick={() => handleSearch(sug.nama)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{sug.nama}</span>
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: sug.warna+'20', color: sug.warna }}>{sug.kategori}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchTerbuka(true)} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 active:scale-90 border border-slate-200 dark:border-slate-700">
                <Search size={16}/>
              </button>
            )}
          </div>
        )}

        {/* ── KANAN ATAS ───────────────────────────────────────────────── */}
        {!modeBersih && (
          <div className="absolute top-6 right-6 z-[1000] space-y-2">
            {/* Koordinat */}
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="text-blue-600">Lat:</span> {koordinatCursor.lat} | <span className="text-blue-600">Lng:</span> {koordinatCursor.lng}
              </div>
            </div>

            {/* Legenda */}
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
              <div className="space-y-2">
                {Object.entries(KATEGORI).map(([kunci, nilai]) => (
                  <div key={kunci} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nilai.warna }}></div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{nilai.label}</span>
                    </div>
                    {hasilAnalisis && (
                      <span className="text-xs font-black bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white">
                        {jumlahKategori[kunci ]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Filter kategori */}
            {hasilAnalisis && (
              <div className="relative">
                <button onClick={() => setMenuFilterTerbuka(!menuFilterTerbuka)}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold hover:border-blue-400 flex items-center justify-between gap-2 shadow-lg">
                  <div className="flex items-center gap-2"><Filter size={14}/> {kategoriTerpilih}</div>
                  <ChevronDown size={14} className={menuFilterTerbuka?'rotate-180':''} />
                </button>
                {menuFilterTerbuka && (
                  <div className="absolute top-full mt-2 right-0 w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                    {["SEMUA","MAJU","BERKEMBANG","TERTINGGAL"].map(kat => (
                      <button key={kat} onClick={() => { setKategoriTerpilih(kat); setMenuFilterTerbuka(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-bold transition-all border-b border-slate-100 dark:border-slate-700 last:border-0 ${kategoriTerpilih===kat?'bg-blue-500 text-white':'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        {kat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SELECTOR TAHUN — horizontal grid, tidak memanjang ke bawah ── */}
            {tahunTersediaList.length > 0 && (
              <div className="relative">
                <button onClick={() => setMenuTahunTerbuka(!menuTahunTerbuka)}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold hover:border-blue-500 flex items-center justify-between gap-2 shadow-lg">
                  <div className="flex items-center gap-2"><Calendar size={13}/> Data {hasilAnalisis?.tahun || '...'}</div>
                  <ChevronDown size={14} className={menuTahunTerbuka?'rotate-180':''} />
                </button>
                {menuTahunTerbuka && (
                  <div className="absolute top-full mt-2 right-0 z-[1003] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3" style={{ width: '260px' }}>
                    <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Pilih Tahun Data</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {tahunTersediaList.map((t) => (
                        <button key={t.th_code}
                          onClick={() => { setMenuTahunTerbuka(false); jalankanAnalisisBPS(t.th_code); }}
                          className={`py-1.5 px-1 rounded-lg text-xs font-black transition-all text-center ${
                            tahunTerpilih === t.th_code
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700'
                          }`}>
                          {t.tahun}
                          {tahunTerpilih === t.th_code && <div className="text-[8px] opacity-80 mt-0.5">✓</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── BOTTOM ACTION BUTTONS ────────────────────────────────────── */}
        {!modeBersih && (
          <div className="absolute left-1/2 -translate-x-1/2 z-[1002]"
            style={{ bottom: adaPanelTerbuka ? 'calc(100% - 64px - 48px)' : '72px' }}>
            <div className="flex gap-3">
              <button onClick={() => jalankanAnalisisBPS(tahunTerpilih)} disabled={sedangMenganalisis}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-black text-sm tracking-wide hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 transition-all uppercase active:scale-95 flex items-center gap-2">
                <RefreshCw size={14} className={sedangMenganalisis?"animate-spin":""} />
                {sedangMenganalisis ? 'Memuat...' : `Perbarui Data ${hasilAnalisis?.tahun||''}`}
              </button>
              {hasilAnalisis && (
                <>
                  <button onClick={bukaModalSave} className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-black text-sm hover:shadow-xl hover:shadow-green-500/30 transition-all uppercase active:scale-95 flex items-center gap-2">
                    <Save size={14}/> Simpan
                  </button>
                  <button onClick={() => setModalRiwayatTerbuka(true)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-black text-sm hover:shadow-xl hover:shadow-purple-500/30 transition-all uppercase active:scale-95 flex items-center gap-2">
                    <Database size={14}/> Riwayat
                  </button>
                  <button onClick={resetAnalisis} className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-500 text-white rounded-xl font-black text-sm hover:shadow-xl transition-all uppercase active:scale-95 flex items-center gap-2">
                    <RotateCcw size={14}/> Reset
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            BOTTOM PANELS — Full layar, menutupi header bar
        ═══════════════════════════════════════════════════════════════════ */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute bottom-0 left-0 right-0 z-[1001] flex flex-col"
            style={{ height: adaPanelTerbuka ? '100%' : 'auto' }}>

            {/* ── PANEL INFO ─────────────────────────────────────────────── */}
            {panelInfoTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <Activity className="text-blue-500" size={22} />
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ringkasan Analisis Ekonomi</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">BPS Web API · Data {hasilAnalisis.tahun} · {hasilAnalisis.total_success} provinsi</p>
                      </div>
                    </div>
                    <button onClick={() => setPanelInfoTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} className="text-slate-500"/></button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                      { label:'Total Provinsi', val:hasilAnalisis.total_success, cls:'bg-blue-50 dark:bg-blue-900/20 border-blue-200', tc:'text-blue-700 dark:text-blue-300' },
                      { label:'Tertinggal',      val:jumlahKategori.TERTINGGAL,    cls:'bg-red-50 dark:bg-red-900/20 border-red-200',   tc:'text-red-700 dark:text-red-300' },
                      { label:'Berkembang',      val:jumlahKategori.BERKEMBANG,    cls:'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200', tc:'text-yellow-700 dark:text-yellow-300' },
                      { label:'Maju',            val:jumlahKategori.MAJU,          cls:'bg-green-50 dark:bg-green-900/20 border-green-200', tc:'text-green-700 dark:text-green-300' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-4 border ${s.cls}`}>
                        <div className={`text-xs font-bold uppercase mb-1 ${s.tc}`}>{s.label}</div>
                        <div className={`text-3xl font-black ${s.tc}`}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                  {hasilAnalisis.best_provinces?.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <div className="text-xs font-black text-green-600 uppercase tracking-wider mb-3">🏆 5 Ekonomi Terkuat</div>
                        {hasilAnalisis.best_provinces.map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{i+1}. {p.provinsi}</span>
                            <span className="text-xs font-black text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">IEK: {p.ekonomi_index}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-xs font-black text-red-600 uppercase tracking-wider mb-3">⚠️ 5 Perlu Percepatan</div>
                        {hasilAnalisis.worst_provinces.map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{i+1}. {p.provinsi}</span>
                            <span className="text-xs font-black text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">IEK: {p.ekonomi_index}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PANEL TABEL ───────────────────────────────────────────── */}
            {panelTabelTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Matriks Ekonomi Daerah</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">{dataTerfilter.length} Wilayah · Data BPS {hasilAnalisis.tahun}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => setMenuUnduhTerbuka(!menuUnduhTerbuka)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-xs font-bold hover:shadow-lg flex items-center gap-2">
                          <Download size={12}/> UNDUH
                        </button>
                        {menuUnduhTerbuka && (
                          <div className="absolute top-full mt-2 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                            {['GEOJSON','JSON','EXCEL','CSV'].map(f => (
                              <button key={f} onClick={() => eksporData(f)}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                <Download size={12} className="inline mr-2 text-blue-500"/>{f}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPanelTabelTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} className="text-slate-500"/></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs font-black text-slate-500 uppercase">
                          <th className="px-3 py-3 text-center">No</th>
                          <th className="px-3 py-3">Provinsi</th>
                          <th className="px-3 py-3 text-center">IEK</th>
                          <th className="px-3 py-3 text-center">PDRB (T Rp)</th>
                          <th className="px-3 py-3 text-center">Kemiskinan</th>
                          <th className="px-3 py-3 text-center">Investasi (T Rp)</th>
                          <th className="px-3 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const data  = fitur.properties.ekonomi_analysis;
                          const de    = data.data_ekonomi || {};
                          const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                          const kat   = getKategoriByIndikator(fitur, indikatorTerpilih);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2.5 text-center text-sm font-bold text-slate-400">{idx+1}</td>
                              <td className="px-3 py-2.5 text-sm font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2.5 text-center"><span className="px-2 py-1 rounded-lg text-sm font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">{data.ekonomi_index}</span></td>
                              <td className="px-3 py-2.5 text-center text-sm font-bold text-slate-600 dark:text-slate-400">{de.PDRB?(de.PDRB/1000).toFixed(1):'-'}</td>
                              <td className="px-3 py-2.5 text-center text-sm font-bold text-slate-600 dark:text-slate-400">{de.KEMISKINAN?de.KEMISKINAN.toFixed(2)+'%':'-'}</td>
                              <td className="px-3 py-2.5 text-center text-sm font-bold text-slate-600 dark:text-slate-400">{de.INVESTASI?(de.INVESTASI/1000).toFixed(2):'-'}</td>
                              <td className="px-3 py-2.5"><span className="px-2 py-1 rounded-lg text-sm font-bold border-2" style={{ borderColor:warna+'40', color:warna }}>{kat}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── PANEL KEBIJAKAN ──────────────────────────────────────── */}
            {panelKebijakanTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="text-blue-500" size={22} />
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Rekomendasi Kebijakan</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Klik "Lihat Aksi" untuk detail rekomendasi per provinsi</p>
                      </div>
                    </div>
                    <button onClick={() => setPanelKebijakanTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} className="text-slate-500"/></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs font-black text-slate-500 uppercase">
                          <th className="px-3 py-3 text-center">No</th>
                          <th className="px-3 py-3">Provinsi</th>
                          <th className="px-3 py-3">Status Ekonomi</th>
                          <th className="px-3 py-3">Aksi Unggulan</th>
                          <th className="px-3 py-3 text-center">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const data        = fitur.properties.ekonomi_analysis;
                          const rekomendasi = data.rekomendasi || [];
                          const warna       = getWarnaByIndikator(fitur, indikatorTerpilih);
                          const kat         = getKategoriByIndikator(fitur, indikatorTerpilih);
                          const aksiPertama = rekomendasi[0]?.aksi?.[0];
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2.5 text-center text-sm font-bold text-slate-400">{idx+1}</td>
                              <td className="px-3 py-2.5 text-sm font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2.5">
                                <span className="px-2 py-1 rounded-lg text-sm font-bold border-2" style={{ borderColor:warna+'40', color:warna }}>{kat}</span>
                              </td>
                              <td className="px-3 py-2.5 max-w-xs">
                                <div className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-tight">
                                  {aksiPertama ? `• ${aksiPertama.nama_aksi}` : <span className="text-slate-400">-</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button onClick={() => setProvinsiKebijakanDipilih(data.nama_provinsi)}
                                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-black hover:bg-blue-100 transition-colors">
                                  Lihat Aksi →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── PANEL GRAFIK TREN ─────────────────────────────────────── */}
            {panelGrafikTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
                <div className="flex justify-end p-4 pb-0">
                  <button onClick={() => setPanelGrafikTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} className="text-slate-500"/></button>
                </div>
                <GrafikTren hasilAnalisis={hasilAnalisis} />
              </div>
            )}

            {/* ── PANEL METODOLOGI — PENJELASAN ORANG AWAM ─────────────── */}
            {panelMetodologiTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BookOpen className="text-blue-500" size={22} />
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Cara Kerja & Metodologi IEK</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Penjelasan mudah untuk semua kalangan</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => setMenuDatasetTerbuka(!menuDatasetTerbuka)}
                          className="px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:shadow-lg flex items-center gap-2">
                          <Download size={12}/> Dataset
                        </button>
                        {menuDatasetTerbuka && (
                          <div className="absolute top-full mt-2 right-0 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                            {[
                              { key:'ALL', label:'Semua Dataset' },
                              { key:'PDRB', label:'💹 Dataset PDRB' },
                              { key:'KEMISKINAN', label:'👥 Dataset Kemiskinan' },
                              { key:'INVESTASI', label:'💰 Dataset Investasi' },
                            ].map(opt => (
                              <button key={opt.key} onClick={() => unduhDataset(opt.key)}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPanelMetodologiTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} className="text-slate-500"/></button>
                    </div>
                  </div>

                  {/* Penjelasan singkat */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <HelpCircle size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-black text-blue-900 dark:text-blue-100 mb-2">📌 Apa itu IEK dan bagaimana cara bacanya?</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                          <strong>IEK (Indeks Ekonomi Kewilyahan)</strong> adalah sebuah angka antara 1 sampai 3 yang menggambarkan 
                          seberapa kuat perekonomian suatu provinsi. Semakin tinggi angkanya, semakin bagus kondisi ekonominya.
                        </p>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          {[
                            { range:'2.4 – 3.0', label:'MAJU', color:'#10b981', desc:'Ekonomi kuat & stabil' },
                            { range:'1.8 – 2.4', label:'BERKEMBANG', color:'#f59e0b', desc:'Sedang tumbuh, perlu dorongan' },
                            { range:'1.0 – 1.8', label:'TERTINGGAL', color:'#ef4444', desc:'Perlu perhatian khusus' },
                          ].map(k => (
                            <div key={k.label} className="bg-white dark:bg-slate-800 rounded-xl p-3 text-center shadow-sm">
                              <div className="text-xs font-black" style={{ color: k.color }}>{k.label}</div>
                              <div className="text-xs font-bold text-slate-500 mt-1">{k.range}</div>
                              <div className="text-xs text-slate-500 mt-1 leading-tight">{k.desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Formula */}
                  <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 border border-slate-700">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">🧮 Formula Perhitungan</div>
                    <code className="text-sm font-mono font-bold text-green-400">
                      IEK = (Skor_PDRB × 0.40) + (Skor_Kemiskinan × 0.40) + (Skor_Investasi × 0.20)
                    </code>
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      Setiap indikator diberi skor 1–3. Kemudian dikalikan dengan bobotnya masing-masing, lalu dijumlahkan. 
                      Hasil akhirnya adalah IEK yang merepresentasikan kondisi ekonomi secara menyeluruh.
                    </p>
                  </div>

                  {/* Penjelasan 3 indikator */}
                  <div className="space-y-4">
                    {/* PDRB */}
                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-5 border-l-4 border-amber-500">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">💹</span>
                        <div>
                          <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase">PDRB — Bobot 40%</h5>
                          <p className="text-xs text-slate-500 font-medium">Produk Domestik Regional Bruto</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                        <strong>Bayangkan PDRB seperti "total penghasilan" suatu provinsi dalam setahun.</strong> Ini menghitung 
                        semua nilai barang dan jasa yang diproduksi di provinsi tersebut — mulai dari hasil pertanian, 
                        produksi pabrik, hingga jasa perbankan dan perdagangan. Semakin besar PDRB, semakin besar 
                        "kue ekonomi" yang bisa dibagi kepada masyarakat.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-green-700 dark:text-green-300">SKOR 3 (MAJU)</div>
                          <div className="text-sm font-black text-green-800 dark:text-green-200 mt-1">&gt; Rp75 Miliar</div>
                          <div className="text-xs text-green-600 mt-1">Ekonomi besar & produktif</div>
                        </div>
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-yellow-700 dark:text-yellow-300">SKOR 2 (BERKEMBANG)</div>
                          <div className="text-sm font-black text-yellow-800 dark:text-yellow-200 mt-1">Rp50–75 Miliar</div>
                          <div className="text-xs text-yellow-600 mt-1">Sedang tumbuh</div>
                        </div>
                        <div className="bg-red-100 dark:bg-red-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-red-700 dark:text-red-300">SKOR 1 (TERTINGGAL)</div>
                          <div className="text-sm font-black text-red-800 dark:text-red-200 mt-1">&lt; Rp50 Miliar</div>
                          <div className="text-xs text-red-600 mt-1">Perlu percepatan</div>
                        </div>
                      </div>
                    </div>

                    {/* KEMISKINAN */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-5 border-l-4 border-blue-500">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">👥</span>
                        <div>
                          <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase">Kemiskinan — Bobot 40% (Terbalik)</h5>
                          <p className="text-xs text-slate-500 font-medium">Persentase penduduk di bawah garis kemiskinan</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                        <strong>Ini adalah satu-satunya indikator yang "terbalik" — semakin kecil angkanya, semakin bagus.</strong> Kemiskinan 
                        dihitung dari persentase warga yang penghasilannya tidak mencukupi kebutuhan dasar seperti makan, 
                        pakaian, dan tempat tinggal. Provinsi dengan kemiskinan rendah berarti lebih banyak warganya 
                        yang bisa memenuhi kebutuhan hidupnya dengan layak.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-green-700 dark:text-green-300">SKOR 3 (BAIK)</div>
                          <div className="text-sm font-black text-green-800 dark:text-green-200 mt-1">&lt; 7%</div>
                          <div className="text-xs text-green-600 mt-1">Kemiskinan rendah</div>
                        </div>
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-yellow-700 dark:text-yellow-300">SKOR 2 (SEDANG)</div>
                          <div className="text-sm font-black text-yellow-800 dark:text-yellow-200 mt-1">7%–12%</div>
                          <div className="text-xs text-yellow-600 mt-1">Masih perlu ditekan</div>
                        </div>
                        <div className="bg-red-100 dark:bg-red-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-red-700 dark:text-red-300">SKOR 1 (PERHATIAN)</div>
                          <div className="text-sm font-black text-red-800 dark:text-red-200 mt-1">&gt; 12%</div>
                          <div className="text-xs text-red-600 mt-1">Kemiskinan tinggi</div>
                        </div>
                      </div>
                    </div>

                    {/* INVESTASI */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl p-5 border-l-4 border-indigo-500">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">💰</span>
                        <div>
                          <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase">Investasi PMDN — Bobot 20%</h5>
                          <p className="text-xs text-slate-500 font-medium">Penanaman Modal Dalam Negeri</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                        <strong>Investasi adalah "modal masa depan" — uang yang ditanam sekarang untuk tumbuh nanti.</strong> PMDN 
                        mengukur berapa banyak pengusaha dan perusahaan Indonesia yang menanamkan modalnya di suatu 
                        provinsi. Investasi tinggi berarti para pebisnis percaya bahwa provinsi itu punya potensi 
                        untuk berkembang — yang nantinya menciptakan lapangan kerja baru bagi warga setempat.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-green-700 dark:text-green-300">SKOR 3 (TINGGI)</div>
                          <div className="text-sm font-black text-green-800 dark:text-green-200 mt-1">&gt; Rp10 T</div>
                          <div className="text-xs text-green-600 mt-1">Sangat menarik investor</div>
                        </div>
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-yellow-700 dark:text-yellow-300">SKOR 2 (SEDANG)</div>
                          <div className="text-sm font-black text-yellow-800 dark:text-yellow-200 mt-1">Rp5–10 T</div>
                          <div className="text-xs text-yellow-600 mt-1">Cukup diminati</div>
                        </div>
                        <div className="bg-red-100 dark:bg-red-900/30 rounded-xl p-3 text-center">
                          <div className="text-xs font-black text-red-700 dark:text-red-300">SKOR 1 (RENDAH)</div>
                          <div className="text-sm font-black text-red-800 dark:text-red-200 mt-1">&lt; Rp5 T</div>
                          <div className="text-xs text-red-600 mt-1">Perlu daya tarik lebih</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contoh perhitungan */}
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" /> Contoh Perhitungan Nyata
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg">
                        <span className="text-amber-500 font-bold w-32">💹 PDRB:</span>
                        <span className="text-slate-600 dark:text-slate-300">Rp80 Miliar → Skor 3 × bobot 0.40 = <strong className="text-amber-600">1.20</strong></span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg">
                        <span className="text-blue-500 font-bold w-32">👥 Kemiskinan:</span>
                        <span className="text-slate-600 dark:text-slate-300">8% → Skor 2 × bobot 0.40 = <strong className="text-blue-600">0.80</strong></span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg">
                        <span className="text-indigo-500 font-bold w-32">💰 Investasi:</span>
                        <span className="text-slate-600 dark:text-slate-300">Rp3 Triliun → Skor 1 × bobot 0.20 = <strong className="text-indigo-600">0.20</strong></span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-blue-600 rounded-xl text-white">
                        <span className="font-bold w-32">🏆 Total IEK:</span>
                        <span className="font-black text-lg">1.20 + 0.80 + 0.20 = 2.20 → BERKEMBANG</span>
                      </div>
                    </div>
                  </div>

                  {/* Sumber data */}
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4">
                    <div className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase mb-2">📦 Sumber Data</div>
                    <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <li>• <strong>BPS Web API</strong> — PDRB Atas Dasar Harga Berlaku Menurut Pengeluaran (Data {hasilAnalisis.tahun})</li>
                      <li>• <strong>BPS Web API</strong> — Persentase Penduduk Miskin (Data {hasilAnalisis.tahun})</li>
                      <li>• <strong>BPS Web API</strong> — Realisasi Investasi PMDN (Data {hasilAnalisis.tahun})</li>
                      <li>• <strong>Bank Kebijakan Internal</strong> — 300+ Aksi Pembangunan (PostgreSQL)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB BAR ───────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 shadow-2xl flex-shrink-0">
              <div className="p-3">
                <div className="flex justify-center gap-2 flex-wrap">
                  {[
                    { setter:setPanelInfoTerbuka,       open:panelInfoTerbuka,       icon:<Info size={14}/>,         label:'Info' },
                    { setter:setPanelTabelTerbuka,       open:panelTabelTerbuka,       icon:<Table size={14}/>,        label:'Tabel' },
                    { setter:setPanelKebijakanTerbuka,   open:panelKebijakanTerbuka,   icon:<ClipboardList size={14}/>,label:'Kebijakan' },
                    { setter:setPanelGrafikTerbuka,      open:panelGrafikTerbuka,      icon:<TrendingUp size={14}/>,   label:'Tren' },
                    { setter:setPanelMetodologiTerbuka,  open:panelMetodologiTerbuka,  icon:<BookOpen size={14}/>,     label:'Metodologi' },
                  ].map(tab => (
                    <button key={tab.label}
                      onClick={() => adaPanelTerbuka && tab.open ? tab.setter(false) : bukaPanel(tab.setter)}
                      className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${tab.open ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      {tab.icon} {tab.label}
                      {tab.open ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                    </button>
                  ))}
                  {adaPanelTerbuka && (
                    <button onClick={toggleAllPanels}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 flex items-center gap-2">
                      <X size={14}/> Tutup
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}