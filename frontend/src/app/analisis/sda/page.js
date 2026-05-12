"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Play, X, Calendar, Loader2, BarChart2, Check,
  TrendingUp, Home, Activity, Fish, Trees, DollarSign,
  Search, Save, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";
import Footerauth from '@/components/layout/footerauth';
import {
  TAHUN_TERSEDIA_SDA,
  DATASET_LABELS_SDA,
  INDIKATOR_LABELS_SDA,
  INDIKATOR_COLORS_SDA,
  INDIKATOR_ICON_SDA,
  ZOOM_DEFAULT_SDA,
  THRESHOLD_MAP_SDA,
} from '@/components/analisis/sda/petaSda';
import PetaSDA  from '@/components/analisis/sda/petaSda';
import TabsSDA  from '@/components/analisis/sda/tabSda';

const cn = (...cls) => cls.filter(Boolean).join(' ');

// ─── THRESHOLD (sama dengan BE) ───────────────────────────────────────────────
const getKategoriDanWarna = (nilai, indikator = 'ALL') => {
  if (nilai == null) return { kategori: '-', warna: '#cbd5e1' };
  const th = THRESHOLD_MAP_SDA[indikator] || THRESHOLD_MAP_SDA.ALL;
  if (nilai >= th.TINGGI) return { kategori: 'TINGGI', warna: '#10b981' };
  if (nilai >= th.SEDANG) return { kategori: 'SEDANG', warna: '#f59e0b' };
  return { kategori: 'RENDAH', warna: '#ef4444' };
};

const getWarna_SDA = (fitur, indikator = 'ALL') => {
  const a = fitur?.properties?.sda_analysis || {};
  if (a.warna_per_indikator?.[indikator]) return a.warna_per_indikator[indikator];
  const nilaiMap = {
    ALL:  a.ipsda,
    IKAN: a.indeks_ikan,
    KEBUN:a.indeks_kebun,
    PDRB: a.indeks_pdrb,
  };
  return getKategoriDanWarna(nilaiMap[indikator], indikator).warna;
};

const getKategori_SDA = (fitur, indikator = 'ALL') => {
  const a = fitur?.properties?.sda_analysis || {};
  if (a.kategori_per_indikator?.[indikator]) return a.kategori_per_indikator[indikator];
  const nilaiMap = {
    ALL:  a.ipsda,
    IKAN: a.indeks_ikan,
    KEBUN:a.indeks_kebun,
    PDRB: a.indeks_pdrb,
  };
  return getKategoriDanWarna(nilaiMap[indikator], indikator).kategori;
};

const Card = ({ children, className = '' }) => (
  <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm', className)}>
    {children}
  </div>
);
const Btn = ({ children, variant = 'primary', className = '', ...props }) => {
  const v = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ghost:   'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
  };
  return (
    <button className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50', v[variant], className)} {...props}>
      {children}
    </button>
  );
};

const KEYS_LOADING_MAP = {
  ALL:   ['IKAN', 'KEBUN', 'PDRB'],
  IKAN:  ['IKAN'],
  KEBUN: ['KEBUN'],
  PDRB:  ['PDRB'],
};

// ─── MODAL CEK DATA ───────────────────────────────────────────────────────────
function ModalCekData_SDA({ tahun, indikator, hasilCek, sedangCek, onTutup, onLanjut }) {
  if (!hasilCek && !sedangCek) return null;
  const { semua_kosong, ada_yang_kosong, dataset_status, kosong, bisa_dieksekusi } = hasilCek || {};
  const labelInd = INDIKATOR_LABELS_SDA[indikator] || 'Semua Indikator';
  const keysLoading = KEYS_LOADING_MAP[indikator] || KEYS_LOADING_MAP.ALL;

  const headerColor = sedangCek
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100'
    : semua_kosong ? 'bg-red-50 dark:bg-red-900/20 border-red-100'
    : ada_yang_kosong ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100'
    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100';

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        <div className={`px-6 py-5 flex items-center gap-3 border-b ${headerColor}`}>
          {sedangCek ? <Loader2 size={20} className="text-blue-500 animate-spin flex-shrink-0"/>
           : semua_kosong ? <XCircle size={20} className="text-red-500 flex-shrink-0"/>
           : ada_yang_kosong ? <AlertTriangle size={20} className="text-amber-500 flex-shrink-0"/>
           : <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0"/>}
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {sedangCek ? `Memeriksa Data Tahun ${tahun}...`
               : semua_kosong ? `Data ${tahun} Tidak Tersedia`
               : ada_yang_kosong ? `Sebagian Data ${tahun} Tidak Tersedia`
               : `Data ${tahun} Siap Dianalisis`}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{labelInd}</p>
          </div>
        </div>
        <div className="px-6 py-4 space-y-2">
          {sedangCek
            ? keysLoading.map(k => (
                <div key={k} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0"/>
                  <span className="text-xs text-slate-500 flex-1">{DATASET_LABELS_SDA[k] || k}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Mengecek...</span>
                </div>
              ))
            : dataset_status && Object.entries(dataset_status).map(([k, info]) => (
                <div key={k} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${info.tersedia ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200' : 'bg-red-50 dark:bg-red-900/10 border-red-200'}`}>
                  {info.tersedia ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0"/> : <XCircle size={13} className="text-red-400 flex-shrink-0"/>}
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">{DATASET_LABELS_SDA[k] || k}</span>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${info.tersedia ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {info.tersedia ? 'Tersedia' : 'Kosong'}
                  </span>
                </div>
              ))
          }
          {!sedangCek && !bisa_dieksekusi && (
            <div className={`mt-2 p-3.5 rounded-lg border-l-4 ${semua_kosong ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'}`}>
              <p className={`text-xs leading-relaxed ${semua_kosong ? 'text-red-700' : 'text-amber-700'}`}>
                {semua_kosong ? `Seluruh dataset tahun ${tahun} tidak tersedia.`
                  : `Dataset kosong: ${kosong?.map(k => DATASET_LABELS_SDA[k] || k).join(', ')}.`}
              </p>
            </div>
          )}
        </div>
        {!sedangCek && (
          <div className="px-6 pb-5 flex gap-3">
            <button onClick={onTutup} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">
              {bisa_dieksekusi ? 'Batal' : 'Pilih Tahun Lain'}
            </button>
            {bisa_dieksekusi && (
              <button onClick={onLanjut} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                Lanjutkan Analisis
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL KOMBO TIDAK ADA ────────────────────────────────────────────────────
function ModalAlertKombo_SDA({ info, onTutup, onAmbilDariBPS }) {
  if (!info) return null;
  const { tahun, indikator } = info;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 bg-amber-50 dark:bg-amber-900/20 flex items-center gap-3 border-b border-amber-100">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={17} className="text-amber-500"/>
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">Data Belum Tersedia di Database</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-slate-500">{INDIKATOR_LABELS_SDA[indikator]} · Tahun {tahun}</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Data <strong>{INDIKATOR_LABELS_SDA[indikator]}</strong> tahun <strong>{tahun}</strong> belum pernah dianalisis.
          </p>
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
              Klik <strong>"Ambil dari BPS"</strong> untuk mengambil data langsung dari BPS Web API.
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onTutup} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Batal</button>
          <button onClick={() => onAmbilDariBPS(tahun, indikator)} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
            <Play size={13}/> Ambil dari BPS
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function SdaPage() {
  const API = 'http://127.0.0.1:8000/api';

  const [hasilAnalisis,        setHasilAnalisis]        = useState(null);
  const [kategoriTerpilih,     setKategoriTerpilih]     = useState('SEMUA');
  const [indikatorTerpilih,    setIndikatorTerpilih]    = useState('ALL');
  const [isClient,             setIsClient]             = useState(false);
  const [activeTab,            setActiveTab]            = useState('info');
  const [daftarTersimpan,      setDaftarTersimpan]      = useState([]);
  const [sedangMuatAwal,       setSedangMuatAwal]       = useState(true);
  const [dataBaruDariBPS,      setDataBaruDariBPS]      = useState(false);
  const [tahunTerpilih,        setTahunTerpilih]        = useState(2023);
  const [sedangMenganalisis,   setSedangMenganalisis]   = useState(false);
  const [sedangCekData,        setSedangCekData]        = useState(false);
  const [hasilCekData,         setHasilCekData]         = useState(null);
  const [pilihanIndikator,     setPilihanIndikator]     = useState('ALL');
  const [pernahAnalisis,       setPernahAnalisis]       = useState(false);
  const [alertKomboTidakAda,   setAlertKomboTidakAda]  = useState(null);
  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [modalSaveTerbuka,     setModalSaveTerbuka]     = useState(false);
  const [namaSimpan,           setNamaSimpan]           = useState('');
  const [sedangMenyimpan,      setSedangMenyimpan]      = useState(false);
  const [basemap,              setBasemap]              = useState('OSM');
  const [koordinatCursor,      setKoordinatCursor]      = useState({ lat: '0.0000', lng: '0.0000' });
  const [currentZoom,          setCurrentZoom]          = useState(ZOOM_DEFAULT_SDA);
  const [provinsiDipilih,      setProvinsiDipilih]      = useState(null);
  const [leafletReady,         setLeafletReady]         = useState(false);
  const [MapCont,              setMapCont]              = useState(null);
  const [TileLay,              setTileLay]              = useState(null);
  const [GeoComp,              setGeoComp]              = useState(null);

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
      'TINGGI': f.filter(x => getKategori_SDA(x, indikatorTerpilih) === 'TINGGI').length,
      'SEDANG': f.filter(x => getKategori_SDA(x, indikatorTerpilih) === 'SEDANG').length,
      'RENDAH': f.filter(x => getKategori_SDA(x, indikatorTerpilih) === 'RENDAH').length,
    };
  }, [hasilAnalisis, indikatorTerpilih]);

  const refreshDB = async () => {
    try { const r = await axios.get(`${API}/sda-analysis/list/`); setDaftarTersimpan(r.data.results || []); } catch {}
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/sda-analysis/list/`);
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
      const res = await axios.get(`${API}/sda-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2023);
      setIndikatorTerpilih(indikator || res.data.indikator || 'ALL');
      setPilihanIndikator(indikator || res.data.indikator || 'ALL');
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDariBPS(false);
      if (!silent) toast.success(`Data dimuat: ${INDIKATOR_LABELS_SDA[indikator || 'ALL']} ${tahun}`);
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
    setSedangCekData(true); setHasilCekData(null);
    try {
      const r = await axios.post(`${API}/check-sda-data/`, { tahun: thn, indikator: pilihan });
      setHasilCekData(r.data);
    } catch { toast.error('Gagal memeriksa ketersediaan data BPS'); }
    finally { setSedangCekData(false); }
  };

  const lanjutkanAnalisis = async () => {
    if (!pendingRef.current) return;
    const { pilihan, tahunFetch } = pendingRef.current;
    setHasilCekData(null); setSedangMenganalisis(true); setKategoriTerpilih('SEMUA');
    const tid = toast.loading(`Mengambil data BPS SDA ${tahunFetch}...`);
    try {
      const r = await axios.post(`${API}/analyze-sda-bps/`, { indikator: pilihan, tahun: tahunFetch });
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
    } finally { setSedangMenganalisis(false); }
  };

  const simpan = async () => {
    if (!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const r = await axios.post(`${API}/save-sda-analysis/`, { name: namaSimpan, analysis_data: hasilAnalisis });
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

  const LABEL_INDEKS_UTAMA = { ALL: 'IPSDA', IKAN: 'I.Ikan', KEBUN: 'I.Kebun', PDRB: 'I.PDRB' };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r   = hasilAnalisis.analysis_summary || [];
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const ind = hasilAnalisis.indikator || 'ALL';
    const tgl = new Date().toISOString().split('T')[0];
    const labelIdx = LABEL_INDEKS_UTAMA[ind] || 'IPSDA';

    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi:              i.provinsi,
        Kategori:              i.kategori,
        [labelIdx]:            i.indeks_utama,
        'IPSDA Gabungan':      i.ipsda || '-',
        'Indeks Ikan':         i.indeks_ikan ?? '-',
        'Indeks Kebun':        i.indeks_kebun ?? '-',
        'Indeks PDRB':         i.indeks_pdrb ?? '-',
        'Prod Ikan (Ton)':     i.produksi_ikan_ton ?? '-',
        'Rata Kebun (Ton)':    i.rata_kebun_ton ?? '-',
        'PDRB Rasio':          i.pdrb_rasio ?? '-',
        'Penduduk (Rb Jiwa)':  i.penduduk_ribu_jiwa ?? '-',
      })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'SDA');
      XLSX.writeFile(wb, `Analisis_SDA_BPS_${ind}_${thn}_${tgl}.xlsx`); toast.success('Excel diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }), `Analisis_SDA_BPS_${ind}_${thn}_${tgl}.json`); toast.success('JSON diunduh');
    } else if (format === 'CSV') {
      const csv = [`Provinsi,Kategori,${labelIdx},IPSDA,IndeksIkan,IndeksKebun,IndeksPDRB,ProdIkanTon,RataKebunTon,PDRBrasio,Penduduk`,
        ...r.map(s => [s.provinsi, s.kategori, s.indeks_utama, s.ipsda ?? '-', s.indeks_ikan ?? '-', s.indeks_kebun ?? '-', s.indeks_pdrb ?? '-', s.produksi_ikan_ton ?? '-', s.rata_kebun_ton ?? '-', s.pdrb_rasio ?? '-', s.penduduk_ribu_jiwa ?? '-'].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv], { type: 'text/csv' }), `Analisis_SDA_BPS_${ind}_${thn}_${tgl}.csv`); toast.success('CSV diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' }), `Spasial_SDA_BPS_${ind}_${thn}_${tgl}.geojson`); toast.success('GeoJSON diunduh');
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>

      <ModalAlertKombo_SDA info={alertKomboTidakAda} onTutup={() => setAlertKomboTidakAda(null)} onAmbilDariBPS={handleAmbilDariBPS}/>
      <ModalCekData_SDA
        tahun={pendingRef.current?.tahunFetch || tahunTerpilih}
        indikator={pendingRef.current?.pilihan || pilihanIndikator}
        hasilCek={hasilCekData} sedangCek={sedangCekData}
        onTutup={() => setHasilCekData(null)} onLanjut={lanjutkanAnalisis}
      />

      {/* Modal Pilih Analisis */}
      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Indeks SDA</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={18} className="text-slate-500"/></button>
            </div>
            <div className="mb-6">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3"><Calendar size={13}/> Tahun Data BPS</label>
              <div className="grid grid-cols-4 gap-2">
                {TAHUN_TERSEDIA_SDA.map(th => (
                  <button key={th} onClick={() => setTahunTerpilih(th)}
                    className={cn('px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all',
                      tahunTerpilih === th ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300')}>
                    {th}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 mb-6">
              {[
                { key: 'ALL',   label: 'IPSDA Gabungan',         desc: 'Ikan + Kebun + PDRB — TINGGI >0.70 | SEDANG 0.40–0.70 | RENDAH <0.40', icon: <BarChart2 size={15}/> },
                { key: 'IKAN',  label: 'Indeks Produksi Ikan',   desc: 'Prod. Tangkap / Penduduk (MinMax) — TINGGI ≥0.60 | SEDANG 0.25–0.60', icon: <Fish size={15}/> },
                { key: 'KEBUN', label: 'Indeks Produksi Kebun',  desc: '8 Komoditas / Penduduk (MinMax) — TINGGI ≥0.60 | SEDANG 0.25–0.60', icon: <Trees size={15}/> },
                { key: 'PDRB',  label: 'Indeks Kontribusi SDA',  desc: 'PDRB Sektor A / Total (MinMax) — TINGGI ≥0.60 | SEDANG 0.25–0.60', icon: <DollarSign size={15}/> },
              ].map(opt => (
                <button key={opt.key} onClick={() => setPilihanIndikator(opt.key)}
                  className={cn('w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3',
                    pilihanIndikator === opt.key ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300')}>
                  <span className="mt-0.5 shrink-0" style={{ color: pilihanIndikator === opt.key ? INDIKATOR_COLORS_SDA[opt.key] : '#94a3b8' }}>{opt.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                  {pilihanIndikator === opt.key && <Check size={15} className="text-emerald-500 mt-0.5"/>}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setModalAnalisisTerbuka(false)}>Batal</Btn>
              <Btn variant="primary" className="flex-1 justify-center" onClick={() => cekDanAnalisis()} disabled={sedangMenganalisis}>
                <Search size={13}/> Cek & Analisis {tahunTerpilih}
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
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Simpan Analisis SDA</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={18} className="text-slate-500"/></button>
            </div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Nama Analisis</label>
            <input type="text" value={namaSimpan} onChange={e => setNamaSimpan(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && simpan()}
              placeholder={`SDA ${INDIKATOR_LABELS_SDA[hasilAnalisis?.indikator || 'ALL']} ${hasilAnalisis?.tahun || tahunTerpilih}`}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm mb-6"/>
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
              <Activity size={22} className="text-emerald-500"/>
              Indeks Pemerataan Sumber Kekayaan Alam (SDA)
            </h1>
            <nav className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Home size={12}/> <span>›</span> <span>SDN Nasional</span> <span>›</span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold">SDA</span>
            </nav>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-emerald-500 animate-spin"/>
                <p className="text-sm text-slate-500">Memuat data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaSDA
                hasilAnalisis={hasilAnalisis}
                tahunTerpilih={tahunTerpilih}
                indikatorTerpilih={indikatorTerpilih}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                sedangMenganalisis={sedangMenganalisis}
                sedangCekData={sedangCekData}
                dataBaruDariBPS={dataBaruDariBPS}
                pernahAnalisis={pernahAnalisis}
                onAnalisis={() => pernahAnalisis ? cekDanAnalisis() : (setPilihanIndikator('ALL'), setModalAnalisisTerbuka(true))}
                onSimpan={() => { setNamaSimpan(''); setModalSaveTerbuka(true); }}
                onReset={() => {
                  setHasilAnalisis(null); setKategoriTerpilih('SEMUA'); setIndikatorTerpilih('ALL');
                  setProvinsiDipilih(null); setPernahAnalisis(false); setDataBaruDariBPS(false);
                  toast.success('Analisis SDA direset');
                }}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef} basemap={basemap} setBasemap={setBasemap}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                kombinasiTersedia={kombinasiTersedia} onPilihKombo={handlePilihKombo}
                sedangMuatAwal={false}
                jumlahKategori={jumlahKategori}
                getWarna={getWarna_SDA}
                getKategori={getKategori_SDA}
              />
              <TabsSDA
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
                getWarna={getWarna_SDA}
                getKategori={getKategori_SDA}
              />
            </div>
          )}
        </div>
      </main>
      <Footerauth/>
    </div>
  );
}