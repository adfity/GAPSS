"use client";
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Search, Calendar, Loader2, Home,
  Info, ShieldCheck, BookOpen, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";
import Footerauth from '@/components/layout/footerauth';

import PetaSDA, { cn, Card, Btn, Modal, ModalCekDataSDA } from '@/components/analisis/sda/petaSection';
import { TabInfoSDA, TabKebijakanSDA, TabMetadataSDA, TabTrendSDA } from '@/components/analisis/sda/tabSda';

// ─── Constants
const API            = 'http://127.0.0.1:8000/api';
const TAHUN_TERSEDIA = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
const TABS = [
  { id: 'info',      label: 'Info',      Icon: Info        },
  { id: 'kebijakan', label: 'Kebijakan', Icon: ShieldCheck },
  { id: 'metadata',  label: 'Metadata',  Icon: BookOpen    },
  { id: 'trend',     label: 'Tren',      Icon: Activity    },
];

export default function SDAPage() {
  const [hasilAnalisis,       setHasilAnalisis]       = useState(null);
  const [statusTerpilih,      setStatusTerpilih]      = useState('SEMUA');
  const [isClient,            setIsClient]            = useState(false);
  const [activeTab,           setActiveTab]           = useState('info');
  const [daftarTersimpan,     setDaftarTersimpan]     = useState([]);
  const [trendData,           setTrendData]           = useState(null);
  const [trendLoading,        setTrendLoading]        = useState(false);
  const [trendError,          setTrendError]          = useState(null);
  const [sedangMuatAwal,      setSedangMuatAwal]      = useState(true);
  const [dataBaruDariBPS,     setDataBaruDariBPS]     = useState(false);
  const [tahunTerpilih,       setTahunTerpilih]       = useState(2024);
  const [sedangMenganalisis,  setSedangMenganalisis]  = useState(false);
  const [sedangCekData,       setSedangCekData]       = useState(false);
  const [hasilCekData,        setHasilCekData]        = useState(null);
  const [modalAnalisis,       setModalAnalisis]       = useState(false);
  const [modalSave,           setModalSave]           = useState(false);
  const [namaSimpan,          setNamaSimpan]          = useState('');
  const [sedangMenyimpan,     setSedangMenyimpan]     = useState(false);
  const [pernahAnalisis,      setPernahAnalisis]      = useState(false);
  const [basemap,             setBasemap]             = useState('OSM');
  const [koordinat,           setKoordinat]           = useState({ lat: '0.0000', lng: '0.0000' });
  const [provinsiHL,          setProvinsiHL]          = useState(null);
  const [searchOpen,          setSearchOpen]          = useState(false);
  const [searchQuery,         setSearchQuery]         = useState('');
  const [suggestions,         setSuggestions]         = useState([]);
  const [loadingDataset,      setLoadingDataset]      = useState({
    IKAN: false, PERKEBUNAN: false, NILAI_IKAN: false, IPSDA: false,
  });
  const [leafletReady, setLeafletReady] = useState(false);
  const [MapCont,      setMapCont]      = useState(null);
  const [TileLay,      setTileLay]      = useState(null);
  const [GeoComp,      setGeoComp]      = useState(null);

  const petaRef    = useRef(null);
  const pendingRef = useRef(null);

  // ── Init Leaflet (SSR-safe) ───────────────────────────────────────────────
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

  // ── Load Trend Data ───────────────────────────────────────────────────────
  const loadTrendData = async (list) => {
    if (!list?.length) return;
    setTrendLoading(true);
    setTrendError(null);
    const sorted = [...list].sort((a, b) => a.tahun - b.tahun);
    try {
      const results = await Promise.all(
        sorted.map(item =>
          axios.get(`${API}/sda-analysis/${item.analysis_id}/`)
            .then(r => ({
              tahun:       r.data.tahun,
              is_ai:       r.data.is_ai_prediction,
              analysis_id: item.analysis_id,
              name:        item.name,
              status_dist: r.data.status_distribusi || {},
              summary:     (r.data.analysis_summary || []).filter(p => p.ipsda != null),
            }))
            .catch(() => null)
        )
      );
      const valid = results.filter(Boolean).sort((a, b) => a.tahun - b.tahun);
      setTrendData(valid);
    } catch {
      setTrendError('Gagal memuat data tren');
    } finally {
      setTrendLoading(false);
    }
  };

  const refreshDB = async () => {
    try {
      const r    = await axios.get(`${API}/sda-analysis/list/`);
      const list = r.data.results || [];
      setDaftarTersimpan(list);
      loadTrendData(list);
    } catch {}
  };

  // ── Load dari DB saat pertama kali ───────────────────────────────────────
  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const r    = await axios.get(`${API}/sda-analysis/list/`);
      const list = r.data.results || [];
      setDaftarTersimpan(list);
      loadTrendData(list);
      if (!list.length) return;
      const bpsOnly = list.filter(item => !item.is_ai_prediction);
      const target  = bpsOnly.length > 0 ? bpsOnly : list;
      const sorted  = [...target].sort((a, b) =>
        b.tahun !== a.tahun
          ? b.tahun - a.tahun
          : (b.timestamp || '').localeCompare(a.timestamp || '')
      );
      await muatDetail(sorted[0].analysis_id, sorted[0].tahun, true);
    } catch {}
    finally { setSedangMuatAwal(false); }
  };

  // ── Muat detail analisis dari DB ─────────────────────────────────────────
  const muatDetail = async (id, tahun, silent = false) => {
    const tid = silent ? null : toast.loading('Memuat analisis SDA...');
    try {
      const r = await axios.get(`${API}/sda-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(r.data);
      setTahunTerpilih(tahun || r.data.tahun || 2024);
      setStatusTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiHL(null);
      setDataBaruDariBPS(false);
      if (!silent) toast.success(`Data SDA dimuat: Tahun ${tahun}`);
    } catch (e) {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error('Gagal memuat detail analisis SDA');
      throw e;
    }
  };

  // ── Cek ketersediaan data BPS ─────────────────────────────────────────────
  const cekDanAnalisis = async (tahun = null) => {
    const t = tahun || tahunTerpilih;
    pendingRef.current = { t };
    setModalAnalisis(false);
    setSedangCekData(true);
    setHasilCekData(null);
    try {
      const r = await axios.post(`${API}/check-year-data-sda/`, { tahun: t });
      setHasilCekData(r.data);
    } catch {
      toast.error('Gagal memeriksa ketersediaan data SDA');
    } finally {
      setSedangCekData(false);
    }
  };

  // ── Lanjutkan dengan BPS ──────────────────────────────────────────────────
  const lanjutkanBPS = async () => {
    if (!pendingRef.current) return;
    const { t } = pendingRef.current;
    setHasilCekData(null);
    setSedangMenganalisis(true);
    setStatusTerpilih('SEMUA');
    const tid = toast.loading(`Mengambil data BPS SDA ${t}...`);
    try {
      const r = await axios.post(`${API}/analyze-sda-bps/`, { tahun: t, mode: 'bps' });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setTahunTerpilih(t);
        setPernahAnalisis(true);
        setDataBaruDariBPS(true);
        setActiveTab('info');
        if (r.data.ada_data_kosong)
          toast(`${r.data.total_data_kosong} provinsi data tidak lengkap`, { icon: '⚠️', duration: 6000 });
        toast.success(
          `Berhasil: ${r.data.total_provinsi || r.data.total_success} provinsi (${t})`,
          { duration: 5000 }
        );
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal terhubung ke server');
    } finally {
      setSedangMenganalisis(false);
    }
  };

  // ── Lanjutkan dengan AI ───────────────────────────────────────────────────
  const lanjutkanAI = async () => {
    if (!pendingRef.current) return;
    const { t } = pendingRef.current;
    setHasilCekData(null);
    setSedangMenganalisis(true);
    setStatusTerpilih('SEMUA');
    const tid = toast.loading(`🤖 Memprediksi IPSDA ${t} dengan AI...`);
    try {
      const r = await axios.post(`${API}/analyze-sda-bps/`, {
        tahun: t,
        mode: 'ai',
        historical_data: hasilAnalisis || {},
      });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setTahunTerpilih(t);
        setPernahAnalisis(true);
        setDataBaruDariBPS(false);
        setActiveTab('info');
        toast.success(
          `Prediksi AI selesai: ${r.data.total_dipetakan} provinsi (${t})`,
          { icon: '🤖', duration: 5000 }
        );
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error(e.response?.data?.error || 'Gagal prediksi AI SDA');
    } finally {
      setSedangMenganalisis(false);
    }
  };

  // ── Simpan ke DB ──────────────────────────────────────────────────────────
  const simpan = async () => {
    if (!namaSimpan.trim()) return toast.error('Nama tidak boleh kosong');
    setSedangMenyimpan(true);
    const tid = toast.loading('Menyimpan...');
    try {
      const r = await axios.post(`${API}/save-sda-analysis/`, {
        name: namaSimpan,
        analysis_data: hasilAnalisis,
      });
      toast.dismiss(tid);
      if (r.data.status === 'success') {
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSave(false);
        setNamaSimpan('');
        setDataBaruDariBPS(false);
        await refreshDB();
      }
    } catch {
      toast.dismiss(tid);
      toast.error('Gagal menyimpan analisis SDA');
    } finally {
      setSedangMenyimpan(false);
    }
  };

  // ── Unduh helpers ────────────────────────────────────────────────────────
  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: nama,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  // Dataset key → endpoint → nama file
  const makeUnduhSDA = (key, endpoint, namaFile) => async () => {
    const data = hasilAnalisis?.raw_datasets?.[key];
    if (!data) return toast.error(`Data ${key} tidak tersedia`);
    setLoadingDataset(p => ({ ...p, [key]: true }));
    const tid = toast.loading(`Membuat file ${key}...`);
    try {
      const r = await axios.post(
        `${API}/${endpoint}/`,
        {
          [`${key.toLowerCase()}_data`]: data,
          timestamp: hasilAnalisis.raw_datasets.timestamp,
          tahun:     hasilAnalisis.tahun || tahunTerpilih,
        },
        { responseType: 'blob' }
      );
      unduhBlob(
        new Blob([r.data]),
        `${namaFile}_${hasilAnalisis.tahun || tahunTerpilih}_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      toast.dismiss(tid);
      toast.success(`${key} berhasil diunduh!`);
    } catch {
      toast.dismiss(tid);
      toast.error(`Gagal unduh ${key}`);
    } finally {
      setLoadingDataset(p => ({ ...p, [key]: false }));
    }
  };

  const unduhFns = {
    ikan:      makeUnduhSDA('IKAN',      'download-ikan-xlsx',       'Dataset_Ikan_BPS'),
    perkebunan: makeUnduhSDA('PERKEBUNAN','download-perkebunan-xlsx', 'Dataset_Perkebunan_BPS'),
    nilaiIkan: makeUnduhSDA('NILAI_IKAN','download-nilai-ikan-xlsx',  'Dataset_NilaiIkan_BPS'),
    ipsda:     makeUnduhSDA('IPSDA',     'download-ipsda-xlsx',       'IPSDA_SDA'),
  };

  // ── Export data ──────────────────────────────────────────────────────────
  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r    = hasilAnalisis.analysis_summary || [];
    const tgl  = new Date().toISOString().split('T')[0];
    const thn  = hasilAnalisis.tahun || tahunTerpilih;
    const isAI = hasilAnalisis.is_ai_prediction;

    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi:              i.provinsi,
        'Status IPSDA':        i.status,
        IPSDA:                 i.ipsda ?? '-',
        'RPP Ikan (ton/jiwa)': i.rpp_ikan ?? '-',
        'RPP Kebun (ton/jiwa)':i.rpp_kebun ?? '-',
        'NPI (Rp/jiwa)':       i.npi ?? '-',
        'KPS (rasio)':         i.kps ?? '-',
        'Data Lengkap':        i.has_complete_data ? 'Ya' : 'Tidak',
        Sumber: isAI
          ? `Prediksi AI (${hasilAnalisis.model_version || 'sda_rf_v1.0'})`
          : 'BPS Web API',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'IPSDA SDA');
      XLSX.writeFile(wb, `IPSDA_SDA_${thn}_${tgl}${isAI ? '_AI' : ''}.xlsx`);
      toast.success('Excel berhasil diunduh');
    } else if (format === 'JSON') {
      unduhBlob(
        new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }),
        `IPSDA_${thn}_${tgl}${isAI ? '_AI' : ''}.json`
      );
      toast.success('JSON berhasil diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi','Status','IPSDA','RPP_Ikan','RPP_Kebun','NPI','KPS','Data Lengkap','Sumber'].join(','),
        ...r.map(s => [
          s.provinsi, s.status, s.ipsda??'-', s.rpp_ikan??'-', s.rpp_kebun??'-',
          s.npi??'-', s.kps??'-',
          s.has_complete_data?'Ya':'Tidak',
          isAI?'Prediksi AI':'BPS Web API',
        ].join(',')),
      ].join('\n');
      unduhBlob(new Blob([csv], { type: 'text/csv' }), `IPSDA_${thn}_${tgl}${isAI?'_AI':''}.csv`);
      toast.success('CSV berhasil diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(
        new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' }),
        `Spasial_SDA_${thn}_${tgl}${isAI?'_AI':''}.geojson`
      );
      toast.success('GeoJSON berhasil diunduh');
    }
  };

  // ── Hitung distribusi status IPSDA ───────────────────────────────────────
  const hitungStatus = () => {
    const f = hasilAnalisis?.matched_features?.features || [];
    const count = s => f.filter(x => x.properties?.sda_analysis?.status === s).length;
    return {
      OPTIMAL: count('OPTIMAL'),
      CUKUP:   count('CUKUP'),
      KURANG:  count('KURANG'),
      RENDAH:  count('RENDAH'),
    };
  };

  // ── Search suggestions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasilAnalisis?.matched_features?.features || !searchQuery.trim()) {
      setSuggestions([]); return;
    }
    setSuggestions(
      hasilAnalisis.matched_features.features
        .filter(f =>
          f.properties?.sda_analysis?.nama_provinsi
            ?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map(f => ({
          nama:   f.properties.sda_analysis.nama_provinsi,
          status: f.properties.sda_analysis.status,
          warna:  f.properties.sda_analysis.warna,
        }))
        .slice(0, 5)
    );
  }, [searchQuery, hasilAnalisis]);

  // ── Fly-to provinsi di peta ───────────────────────────────────────────────
  const handleSearch = (nama) => {
    const n = nama || searchQuery;
    if (!n.trim()) return;
    const f = hasilAnalisis?.matched_features?.features?.find(
      feat => feat.properties?.sda_analysis?.nama_provinsi?.toLowerCase() === n.toLowerCase()
    );
    if (f && petaRef.current) {
      const coords = f.geometry.coordinates;
      let lat, lng;
      if (f.geometry.type === 'MultiPolygon') {
        const poly = coords[0][0];
        lat = poly.reduce((s, c) => s + c[1], 0) / poly.length;
        lng = poly.reduce((s, c) => s + c[0], 0) / poly.length;
      } else {
        const poly = coords[0];
        lat = poly.reduce((s, c) => s + c[1], 0) / poly.length;
        lng = poly.reduce((s, c) => s + c[0], 0) / poly.length;
      }
      petaRef.current.setView([lat, lng], 7);
      setProvinsiHL(f.properties.sda_analysis.nama_provinsi);
      toast.success(`Ditemukan: ${n}`, { duration: 3000 });
      setSearchOpen(false); setSearchQuery(''); setSuggestions([]);
    } else {
      toast.error('Provinsi tidak ditemukan');
    }
  };

  const jumlahStatus = hitungStatus();
  if (!isClient) return null;

  const petaProps = {
    hasilAnalisis, tahunTerpilih, statusTerpilih, setStatusTerpilih,
    sedangMenganalisis, sedangCekData, pernahAnalisis, dataBaruDariBPS,
    onAnalisis: () => pernahAnalisis ? cekDanAnalisis() : setModalAnalisis(true),
    onSimpan:   () => { setNamaSimpan(''); setModalSave(true); },
    onReset:    () => {
      setHasilAnalisis(null); setStatusTerpilih('SEMUA'); setProvinsiHL(null);
      setPernahAnalisis(false); setDataBaruDariBPS(false);
      toast.success('Analisis SDA direset');
    },
    onPilihTahunDenganTahun: (th) => { setTahunTerpilih(th); setModalAnalisis(true); },
    leafletReady, MapCont, TileLay, GeoComp,
    petaRef, basemap, setBasemap,
    koordinat, setKoordinat,
    provinsiHL, setProvinsiHL,
    searchOpen, setSearchOpen, searchQuery, setSearchQuery, suggestions, handleSearch,
    daftarTersimpan, onMuatTahun: muatDetail,
    TAHUN_TERSEDIA,
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar />
      <SideBar />

      <ModalCekDataSDA
        tahun={pendingRef.current?.t || tahunTerpilih}
        hasilCek={hasilCekData}
        sedangCek={sedangCekData}
        onTutup={() => setHasilCekData(null)}
        onLanjutBPS={lanjutkanBPS}
        onLanjutAI={lanjutkanAI}
      />

      {/* Modal pilih tahun */}
      <Modal show={modalAnalisis} onClose={() => setModalAnalisis(false)} title="Pilih Tahun Analisis SDA">
        <div className="mb-6">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            <Calendar size={13} /> Tahun Data
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TAHUN_TERSEDIA.map(th => (
              <button key={th} onClick={() => setTahunTerpilih(th)}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all',
                  tahunTerpilih === th
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                )}>
                {th}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
            Sistem akan cek ketersediaan data BPS terlebih dahulu. Jika tidak tersedia, akan ada opsi Prediksi AI.
          </p>
        </div>
        <div className="flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setModalAnalisis(false)}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={() => cekDanAnalisis()} disabled={sedangMenganalisis}>
            <Search size={13} /> Cek Ketersediaan Data
          </Btn>
        </div>
      </Modal>

      {/* Modal simpan */}
      <Modal show={modalSave} onClose={() => setModalSave(false)} title="Simpan Analisis SDA">
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Nama Analisis</label>
          <input
            type="text" value={namaSimpan} onChange={e => setNamaSimpan(e.target.value)}
            placeholder={`IPSDA Pemerataan SDA ${hasilAnalisis?.tahun || tahunTerpilih}`}
            onKeyPress={e => e.key === 'Enter' && simpan()}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 outline-none text-sm"
          />
        </div>
        <div className="flex gap-3">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setModalSave(false)}>Batal</Btn>
          <Btn variant="primary" className="flex-1 justify-center" onClick={simpan} disabled={sedangMenyimpan || !namaSimpan.trim()}>
            {sedangMenyimpan ? 'Menyimpan...' : 'Simpan'}
          </Btn>
        </div>
      </Modal>

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">
          <div className="flex items-start justify-between pt-7 pb-5">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Indeks Pemerataan Sumber Kekayaan Alam
            </h1>
            <nav className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Home size={12} /> <span>›</span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold">Pemerataan SDA</span>
            </nav>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-blue-500 animate-spin" />
                <p className="text-sm text-slate-500">Memuat data SDA...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaSDA {...petaProps} />
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-100 dark:border-slate-700">
                  {TABS.map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button key={id} onClick={() => setActiveTab(id)}
                        className={cn(
                          'flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all relative flex-1',
                          active
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                        )}>
                        <Icon size={15} />
                        <span className="hidden sm:inline">{label}</span>
                        {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
                      </button>
                    );
                  })}
                </div>
                <div className="p-5">
                  {activeTab === 'info'      && <TabInfoSDA      hasilAnalisis={hasilAnalisis} jumlahStatus={jumlahStatus} eksporData={eksporData} />}
                  {activeTab === 'kebijakan' && <TabKebijakanSDA hasilAnalisis={hasilAnalisis} statusTerpilih={statusTerpilih} setStatusTerpilih={setStatusTerpilih} />}
                  {activeTab === 'metadata'  && <TabMetadataSDA  hasilAnalisis={hasilAnalisis} unduhFns={unduhFns} loadingDataset={loadingDataset} />}
                  {activeTab === 'trend'     && <TabTrendSDA     trendData={trendData} trendLoading={trendLoading} trendError={trendError} />}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footerauth />
    </div>
  );
}