"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Play, X, Calendar, Loader2, BarChart2, Check,
  TrendingUp, Home, Activity, AlertTriangle, CheckCircle2, XCircle, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar  from '@/components/layout/HeaderBar';
import SideBar    from "@/components/layout/sideBar";
import Footerauth from '@/components/layout/footerauth';
import {
  TAHUN_TERSEDIA_EKON,
  DATASET_LABELS_EKON,
  ZOOM_DEFAULT_EKON,
} from '@/components/analisis/ekonomi/petaEkon';
import PetaEkon from '@/components/analisis/ekonomi/petaEkon';
import TabsEkon from '@/components/analisis/ekonomi/tabEkon';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(' ');

const getWarna_EKON = (fitur) => {
  const a = fitur?.properties?.ekon_analysis || {};
  return a.warna || '#cbd5e1';
};
const getKategori_EKON = (fitur) => {
  const a = fitur?.properties?.ekon_analysis || {};
  return a.kategori || '-';
};

const Card = ({ children, className = '' }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm', className)}>
    {children}
  </div>
);
const Btn = ({ children, variant = 'primary', className = '', ...props }) => {
  const v = {
    primary: 'bg-sky-600 hover:bg-sky-700 text-white',
    ghost:   'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
  };
  return (
    <button className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50', v[variant], className)} {...props}>
      {children}
    </button>
  );
};

// ─── DATASET KEYS UNTUK CEK ───────────────────────────────────────────────────
const KEYS_LOADING_EKON = ['PDRB_PENGELUARAN', 'PENDUDUK'];

// ─── MODAL: CEK DATA ──────────────────────────────────────────────────────────
function ModalCekData_EKON({ tahun, hasilCek, sedangCek, onTutup, onLanjut }) {
  if (!hasilCek && !sedangCek) return null;
  const { semua_kosong, ada_yang_kosong, dataset_status, kosong, bisa_dieksekusi } = hasilCek || {};

  const headerColor = sedangCek
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30'
    : semua_kosong
    ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30'
    : ada_yang_kosong
    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30'
    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30';

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        <div className={`px-6 py-5 flex items-center gap-3 border-b ${headerColor}`}>
          {sedangCek          ? <Loader2       size={20} className="text-blue-500 animate-spin flex-shrink-0" />
           : semua_kosong     ? <XCircle       size={20} className="text-red-500 flex-shrink-0" />
           : ada_yang_kosong  ? <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
           :                    <CheckCircle2  size={20} className="text-emerald-500 flex-shrink-0" />}
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {sedangCek          ? `Memeriksa Data Tahun ${tahun}...`
               : semua_kosong     ? `Data ${tahun} Tidak Tersedia`
               : ada_yang_kosong  ? `Sebagian Data ${tahun} Tidak Tersedia`
               :                    `Data ${tahun} Siap Dianalisis`}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Indeks Aktivitas Ekonomi Daerah</p>
          </div>
        </div>
        <div className="px-6 py-4 space-y-2">
          {sedangCek
            ? KEYS_LOADING_EKON.map(k => (
                <div key={k} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">{DATASET_LABELS_EKON[k] || k}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Mengecek...</span>
                </div>
              ))
            : dataset_status && Object.entries(dataset_status).map(([k, info]) => (
                <div key={k} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${info.tersedia ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'}`}>
                  {info.tersedia
                    ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                    : <XCircle      size={13} className="text-red-400 flex-shrink-0" />}
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">{DATASET_LABELS_EKON[k] || info.nama || k}</span>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${info.tersedia ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {info.tersedia ? 'Tersedia' : 'Kosong'}
                  </span>
                </div>
              ))
          }
          {!sedangCek && !bisa_dieksekusi && (
            <div className={`mt-2 p-3.5 rounded-lg border-l-4 ${semua_kosong ? 'bg-red-50 dark:bg-red-900/10 border-red-500' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-500'}`}>
              <p className={`text-xs leading-relaxed ${semua_kosong ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {semua_kosong
                  ? `Seluruh dataset Ekonomi tahun ${tahun} tidak tersedia di BPS.`
                  : `Dataset kosong: ${kosong?.map(k => DATASET_LABELS_EKON[k] || k).join(', ')}.`}
              </p>
            </div>
          )}
        </div>
        {!sedangCek && (
          <div className="px-6 pb-5 flex gap-3">
            <button onClick={onTutup}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              {bisa_dieksekusi ? 'Batal' : 'Pilih Tahun Lain'}
            </button>
            {bisa_dieksekusi && (
              <button onClick={onLanjut}
                className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                Lanjutkan Analisis
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL: KOMBO TIDAK ADA ───────────────────────────────────────────────────
function ModalAlertKombo_EKON({ info, onTutup, onAmbilDariBPS }) {
  if (!info) return null;
  const { tahun } = info;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 bg-amber-50 dark:bg-amber-900/20 flex items-center gap-3 border-b border-amber-100 dark:border-amber-800/30">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={17} className="text-amber-500" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">Data Belum Tersedia di Database</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <BarChart2 size={11} className="text-sky-500"/>
              <span className="text-xs text-slate-500 dark:text-slate-400">Indeks Aktivitas Ekonomi</span>
              <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
              <Calendar size={11} className="text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Tahun {tahun}</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Data <strong>Indeks Aktivitas Ekonomi</strong> tahun{' '}
            <strong>{tahun}</strong> belum pernah dianalisis dan disimpan.
          </p>
          <div className="mt-4 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-100 dark:border-sky-800/30 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-sky-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
              Klik <strong>"Ambil dari BPS"</strong> untuk mengambil data PDRB Pengeluaran dan Penduduk langsung dari BPS Web API.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onTutup}
            className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Batal
          </button>
          <button onClick={() => onAmbilDariBPS(tahun)}
            className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
            <Play size={13} /> Ambil dari BPS
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE (DEFAULT EXPORT)
// ══════════════════════════════════════════════════════════════════════════════
export default function EkonPage() {
  const API = 'http://127.0.0.1:8000/api';

  const [hasilAnalisis,         setHasilAnalisis]         = useState(null);
  const [kategoriTerpilih,      setKategoriTerpilih]      = useState('SEMUA');
  const [isClient,              setIsClient]              = useState(false);
  const [activeTab,             setActiveTab]             = useState('info');
  const [daftarTersimpan,       setDaftarTersimpan]       = useState([]);
  const [sedangMuatAwal,        setSedangMuatAwal]        = useState(true);
  const [dataBaruDariBPS,       setDataBaruDariBPS]       = useState(false);
  const [tahunTerpilih,         setTahunTerpilih]         = useState(2024);
  const [sedangMenganalisis,    setSedangMenganalisis]    = useState(false);
  const [sedangCekData,         setSedangCekData]         = useState(false);
  const [hasilCekData,          setHasilCekData]          = useState(null);
  const [pernahAnalisis,        setPernahAnalisis]        = useState(false);
  const [alertKomboTidakAda,    setAlertKomboTidakAda]   = useState(null);
  const [modalAnalisisTerbuka,  setModalAnalisisTerbuka]  = useState(false);
  const [modalSaveTerbuka,      setModalSaveTerbuka]      = useState(false);
  const [namaSimpan,            setNamaSimpan]            = useState('');
  const [sedangMenyimpan,       setSedangMenyimpan]       = useState(false);
  const [basemap,               setBasemap]               = useState('OSM');
  const [koordinatCursor,       setKoordinatCursor]       = useState({ lat: '0.0000', lng: '0.0000' });
  const [currentZoom,           setCurrentZoom]           = useState(ZOOM_DEFAULT_EKON);
  const [provinsiDipilih,       setProvinsiDipilih]       = useState(null);
  const [leafletReady,          setLeafletReady]          = useState(false);
  const [MapCont,               setMapCont]               = useState(null);
  const [TileLay,               setTileLay]               = useState(null);
  const [GeoComp,               setGeoComp]               = useState(null);

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

  // Map tahun → analysis_id (latest per tahun)
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
      'TINGGI': f.filter(x => getKategori_EKON(x) === 'TINGGI').length,
      'SEDANG': f.filter(x => getKategori_EKON(x) === 'SEDANG').length,
      'RENDAH': f.filter(x => getKategori_EKON(x) === 'RENDAH').length,
    };
  }, [hasilAnalisis]);

  const refreshDB = async () => {
    try {
      const r = await axios.get(`${API}/ekon-analysis/list/`);
      setDaftarTersimpan(r.data.results || []);
    } catch {}
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/ekon-analysis/list/`);
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
      const res = await axios.get(`${API}/ekon-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDariBPS(false);
      if (!silent) toast.success(`Data dimuat: Ekonomi ${tahun}`);
    } catch (e) {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error('Gagal memuat detail analisis');
      throw e;
    }
  };

  const handlePilihTahun = async (tahun) => {
    const key = `${tahun}`;
    if (!kombinasiTersedia[key]) {
      setAlertKomboTidakAda({ tahun });
      return;
    }
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
    setSedangCekData(true); setHasilCekData(null);
    try {
      const r = await axios.post(`${API}/check-ekon-data/`, { tahun: thn });
      setHasilCekData(r.data);
    } catch { toast.error('Gagal memeriksa ketersediaan data BPS'); }
    finally { setSedangCekData(false); }
  };

  const lanjutkanAnalisis = async () => {
    if (!pendingRef.current) return;
    const { tahunFetch } = pendingRef.current;
    setHasilCekData(null); setSedangMenganalisis(true); setKategoriTerpilih('SEMUA');
    const tid = toast.loading(`Mengambil data BPS Ekonomi ${tahunFetch}...`);
    try {
      const r = await axios.post(`${API}/analyze-ekon-bps/`, { tahun: tahunFetch });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setTahunTerpilih(tahunFetch);
        setPernahAnalisis(true);
        setDataBaruDariBPS(true);
        setActiveTab('info');
        toast.success(`Berhasil: ${r.data.total_success} provinsi (${tahunFetch})!`, { duration: 5000 });
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal terhubung ke server');
    } finally { setSedangMenganalisis(false); }
  };

  const simpan = async () => {
    if (!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const r = await axios.post(`${API}/save-ekon-analysis/`, { name: namaSimpan, analysis_data: hasilAnalisis });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false); setNamaSimpan(''); setDataBaruDariBPS(false);
        await refreshDB();
      }
    } catch { toast.dismiss(tid); toast.error('Gagal menyimpan'); }
    finally { setSedangMenyimpan(false); }
  };

  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nama });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r   = hasilAnalisis.analysis_summary || [];
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const tgl = new Date().toISOString().split('T')[0];

    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi:              i.provinsi,
        Kategori:              i.kategori,
        'IEKON':               i.indeks_ekonomi,
        'KR/kapita (Mlrd/Rb jiwa)':   i.kr_per_kapita   || '-',
        'PMTB/kapita (Mlrd/Rb jiwa)': i.pmtb_per_kapita || '-',
        'Net/kapita (Mlrd/Rb jiwa)':  i.net_per_kapita  || '-',
        'PDRB/kapita (Mlrd/Rb jiwa)': i.pdrb_per_kapita || '-',
        'KR_norm':             i.kr_norm,
        'PMTB_norm':           i.pmtb_norm,
        'Net_norm':            i.net_norm,
        'PDRB_norm':           i.pdrb_norm,
        'Penduduk (Rb jiwa)':  i.penduduk || '-',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ekonomi');
      XLSX.writeFile(wb, `Analisis_Ekonomi_BPS_${thn}_${tgl}.xlsx`);
      toast.success('Excel diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type:'application/json' }), `Analisis_Ekonomi_BPS_${thn}_${tgl}.json`);
      toast.success('JSON diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi','Kategori','IEKON','KR/kap','PMTB/kap','Net/kap','PDRB/kap','KR_n','I_n','EN_n','P_n'].join(','),
        ...r.map(s => [s.provinsi,s.kategori,s.indeks_ekonomi,s.kr_per_kapita||'-',s.pmtb_per_kapita||'-',s.net_per_kapita||'-',s.pdrb_per_kapita||'-',s.kr_norm,s.pmtb_norm,s.net_norm,s.pdrb_norm].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv], { type:'text/csv' }), `Analisis_Ekonomi_BPS_${thn}_${tgl}.csv`);
      toast.success('CSV diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type:'application/json' }), `Spasial_Ekonomi_BPS_${thn}_${tgl}.geojson`);
      toast.success('GeoJSON diunduh');
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>

      {/* ── Modals ── */}
      <ModalAlertKombo_EKON
        info={alertKomboTidakAda}
        onTutup={() => setAlertKomboTidakAda(null)}
        onAmbilDariBPS={handleAmbilDariBPS}
      />
      <ModalCekData_EKON
        tahun={pendingRef.current?.tahunFetch || tahunTerpilih}
        hasilCek={hasilCekData}
        sedangCek={sedangCekData}
        onTutup={() => setHasilCekData(null)}
        onLanjut={lanjutkanAnalisis}
      />

      {/* Modal Pilih Tahun Analisis */}
      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Tahun Analisis</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={18} className="text-slate-500"/>
              </button>
            </div>
            <div className="mb-6">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                <Calendar size={13}/> Tahun Data BPS
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TAHUN_TERSEDIA_EKON.map(th => (
                  <button key={th} onClick={() => setTahunTerpilih(th)}
                    className={cn('px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all',
                      tahunTerpilih === th
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-300 dark:hover:border-sky-600')}>
                    {th}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-800/30 mb-6">
              <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-1.5">Dataset yang akan diambil</div>
              <ul className="space-y-1">
                <li className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>PDRB Pengeluaran (var=533): KR, PMTB, Net Ekspor, PDRB
                </li>
                <li className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"/>Jumlah Penduduk (var=958): Per provinsi (Ribu Jiwa)
                </li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setModalAnalisisTerbuka(false)}>Batal</Btn>
              <Btn variant="primary" className="flex-1 justify-center" onClick={() => cekDanAnalisis()} disabled={sedangMenganalisis}>
                Cek & Analisis {tahunTerpilih}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Simpan */}
      {modalSaveTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Simpan Analisis Ekonomi</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={18} className="text-slate-500"/>
              </button>
            </div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Nama Analisis</label>
            <input type="text" value={namaSimpan} onChange={e => setNamaSimpan(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && simpan()}
              placeholder={`Ekonomi ${hasilAnalisis?.tahun || tahunTerpilih}`}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-sky-500 outline-none text-sm mb-6"/>
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setModalSaveTerbuka(false)}>Batal</Btn>
              <Btn variant="primary" className="flex-1 justify-center" onClick={simpan} disabled={sedangMenyimpan || !namaSimpan.trim()}>
                {sedangMenyimpan ? 'Menyimpan...' : <><Save size={13}/> Simpan</>}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">
          <div className="flex items-start justify-between pt-7 pb-5">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp size={22} className="text-sky-500"/>
              Indeks Aktivitas Ekonomi Daerah
            </h1>
            <nav className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Home size={12}/> <span>›</span> <span>SDN Nasional</span> <span>›</span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold">Ekonomi</span>
            </nav>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-sky-500 animate-spin"/>
                <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaEkon
                hasilAnalisis={hasilAnalisis}
                tahunTerpilih={tahunTerpilih}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                sedangMenganalisis={sedangMenganalisis}
                sedangCekData={sedangCekData}
                dataBaruDariBPS={dataBaruDariBPS}
                pernahAnalisis={pernahAnalisis}
                onAnalisis={() => pernahAnalisis ? cekDanAnalisis() : (setTahunTerpilih(2024), setModalAnalisisTerbuka(true))}
                onSimpan={() => { setNamaSimpan(''); setModalSaveTerbuka(true); }}
                onReset={() => {
                  setHasilAnalisis(null); setKategoriTerpilih('SEMUA');
                  setProvinsiDipilih(null); setPernahAnalisis(false); setDataBaruDariBPS(false);
                  toast.success('Analisis Ekonomi direset');
                }}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef} basemap={basemap} setBasemap={setBasemap}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                kombinasiTersedia={kombinasiTersedia}
                onPilihTahun={handlePilihTahun}
                sedangMuatAwal={false}
                jumlahKategori={jumlahKategori}
                getWarna={getWarna_EKON}
                getKategori={getKategori_EKON}
              />

              <TabsEkon
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis}
                jumlahKategori={jumlahKategori}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunTerpilih}
                daftarTersimpan={daftarTersimpan}
                eksporData={eksporData}
                getWarna={getWarna_EKON}
                getKategori={getKategori_EKON}
              />
            </div>
          )}
        </div>
      </main>

      <Footerauth/>
    </div>
  );
}