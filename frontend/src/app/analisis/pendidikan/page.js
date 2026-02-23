"use client";
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Play, Download, AlertCircle, Plus, Minus, ChevronDown, Filter, Save, X,
  GraduationCap, RotateCcw, Database, ChevronUp, Info, Table, FileText,
  ClipboardList, Search, Eye, EyeOff, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';

// Konfigurasi Kategori
const KATEGORI = {
  KRITIS: { warna: "#ef4444", label: "KRITIS", status: "PERLU PERHATIAN SERIUS" },
  SEDANG: { warna: "#f59e0b", label: "SEDANG", status: "PERLU PENINGKATAN" },
  BAIK:   { warna: "#10b981", label: "BAIK",   status: "KONDISI SANGAT BAIK" }
};

const PUSAT_DEFAULT = [-2.5, 118];
const ZOOM_DEFAULT = 5;

// =====================================================================
// HELPER: hitung warna & kategori berdasarkan indikator yang dipilih
// =====================================================================
function getWarnaByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') {
    return fitur.properties?.education_analysis?.warna || "#cbd5e1";
  }
  const dp = fitur.properties?.education_analysis?.data_pendidikan || {};
  if (indikatorTerpilih === 'RLS') {
    const v = dp.RLS;
    if (v == null) return "#cbd5e1";
    return v > 9.5 ? KATEGORI.BAIK.warna : v >= 8.0 ? KATEGORI.SEDANG.warna : KATEGORI.KRITIS.warna;
  }
  if (indikatorTerpilih === 'APS') {
    const v = dp.SKOR_APS;
    if (v == null) return "#cbd5e1";
    return v >= 2.4 ? KATEGORI.BAIK.warna : v >= 1.8 ? KATEGORI.SEDANG.warna : KATEGORI.KRITIS.warna;
  }
  if (indikatorTerpilih === 'RASIO') {
    const v = dp.RASIO_RATA;
    if (v == null) return "#cbd5e1";
    return v < 12 ? KATEGORI.BAIK.warna : v <= 16 ? KATEGORI.SEDANG.warna : KATEGORI.KRITIS.warna;
  }
  return fitur.properties?.education_analysis?.warna || "#cbd5e1";
}

function getKategoriByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') {
    return fitur.properties?.education_analysis?.kategori || null;
  }
  const dp = fitur.properties?.education_analysis?.data_pendidikan || {};
  if (indikatorTerpilih === 'RLS') {
    const v = dp.RLS;
    if (v == null) return null;
    return v > 9.5 ? 'BAIK' : v >= 8.0 ? 'SEDANG' : 'KRITIS';
  }
  if (indikatorTerpilih === 'APS') {
    const v = dp.SKOR_APS;
    if (v == null) return null;
    return v >= 2.4 ? 'BAIK' : v >= 1.8 ? 'SEDANG' : 'KRITIS';
  }
  if (indikatorTerpilih === 'RASIO') {
    const v = dp.RASIO_RATA;
    if (v == null) return null;
    return v < 12 ? 'BAIK' : v <= 16 ? 'SEDANG' : 'KRITIS';
  }
  return fitur.properties?.education_analysis?.kategori || null;
}

export default function PendidikanPage() {
  const [sedangMenganalisis, setSedangMenganalisis] = useState(false);
  const [hasilAnalisis, setHasilAnalisis] = useState(null);
  const [kategoriTerpilih, setKategoriTerpilih] = useState('SEMUA');
  const [indikatorTerpilih, setIndikatorTerpilih] = useState('SEMUA');
  const [adalahClient, setAdalahClient] = useState(false);
  const [petaSedangMemuat, setPetaSedangMemuat] = useState(true);

  const [menuUnduhTerbuka, setMenuUnduhTerbuka] = useState(false);
  const [menuFilterTerbuka, setMenuFilterTerbuka] = useState(false);
  const [menuDatasetTerbuka, setMenuDatasetTerbuka] = useState(false);
  const [menuPilihanIndikatorTerbuka, setMenuPilihanIndikatorTerbuka] = useState(false);

  const [panelInfoTerbuka, setPanelInfoTerbuka] = useState(false);
  const [panelTabelTerbuka, setPanelTabelTerbuka] = useState(false);
  const [panelMetodologiTerbuka, setPanelMetodologiTerbuka] = useState(false);
  const [panelKebijakanTerbuka, setPanelKebijakanTerbuka] = useState(false);

  const [koordinatCursor, setKoordinatCursor] = useState({ lat: 0, lng: 0 });
  const [currentZoom, setCurrentZoom] = useState(ZOOM_DEFAULT);

  const [modalSaveTerbuka, setModalSaveTerbuka] = useState(false);
  const [namaSimpan, setNamaSimpan] = useState('');
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);

  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [pilihanIndikator, setPilihanIndikator] = useState('ALL');
  const [pernahAnalisis, setPernahAnalisis] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchTerbuka, setSearchTerbuka] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [provinsiDipilih, setProvinsiDipilih] = useState(null);

  const [modeBersih, setModeBersih] = useState(false);

  const [loadingDataset, setLoadingDataset] = useState({ RLS: false, APS: false, RASIO: false });

  const petaRef = useRef(null);

  const [KontainerPeta, setKontainerPeta] = useState(null);
  const [LapisanPeta, setLapisanPeta] = useState(null);
  const [GeoJSON, setGeoJSON] = useState(null);
  const [Skala, setSkala] = useState(null);
  const [useMapEvents, setUseMapEvents] = useState(null);

  useEffect(() => {
    setAdalahClient(true);
    setPetaSedangMemuat(true);
    import('react-leaflet').then((leaflet) => {
      setKontainerPeta(() => leaflet.MapContainer);
      setLapisanPeta(() => leaflet.TileLayer);
      setGeoJSON(() => leaflet.GeoJSON);
      setSkala(() => leaflet.ScaleControl);
      setUseMapEvents(() => leaflet.useMapEvents);
      setPetaSedangMemuat(false);
    });
    import('leaflet/dist/leaflet.css');
  }, []);

  const hitungScaleKm = (zoom) => {
    const scales = { 5: 1000, 6: 500, 7: 200, 8: 100, 9: 50, 10: 25 };
    return scales[Math.floor(zoom)] || scales[5];
  };

  const MouseTracker = () => {
    if (!useMapEvents) return null;
    const MapEventsComponent = () => {
      useMapEvents({
        mousemove: (e) => {
          setKoordinatCursor({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) });
        },
        zoomend: (e) => { setCurrentZoom(e.target.getZoom()); }
      });
      return null;
    };
    return <MapEventsComponent />;
  };

  useEffect(() => {
    if (!hasilAnalisis?.matched_features?.features || !searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const suggestions = hasilAnalisis.matched_features.features
      .filter(f => f.properties?.education_analysis?.nama_provinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(f => ({
        nama: f.properties.education_analysis.nama_provinsi,
        kategori: getKategoriByIndikator(f, indikatorTerpilih),
        warna: getWarnaByIndikator(f, indikatorTerpilih)
      }))
      .slice(0, 5);
    setSearchSuggestions(suggestions);
  }, [searchQuery, hasilAnalisis, indikatorTerpilih]);

  const handleSearch = (namaProvinsi) => {
    const provinsiNama = namaProvinsi || searchQuery;
    if (!hasilAnalisis?.matched_features?.features || !provinsiNama.trim()) return;

    const fitur = hasilAnalisis.matched_features.features.find(f =>
      f.properties?.education_analysis?.nama_provinsi?.toLowerCase() === provinsiNama.toLowerCase()
    );

    if (fitur && petaRef.current) {
      const coords = fitur.geometry.coordinates;
      let lat, lng;
      if (fitur.geometry.type === "MultiPolygon") {
        const polygon = coords[0][0];
        lat = polygon.reduce((sum, coord) => sum + coord[1], 0) / polygon.length;
        lng = polygon.reduce((sum, coord) => sum + coord[0], 0) / polygon.length;
      } else {
        const polygon = coords[0];
        lat = polygon.reduce((sum, coord) => sum + coord[1], 0) / polygon.length;
        lng = polygon.reduce((sum, coord) => sum + coord[0], 0) / polygon.length;
      }
      petaRef.current.setView([lat, lng], 7);
      setProvinsiDipilih(fitur.properties.education_analysis.nama_provinsi);
      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <div>
            <div className="font-bold">Lokasi Ditemukan!</div>
            <div className="text-xs">{fitur.properties.education_analysis.nama_provinsi}</div>
          </div>
        </div>,
        { duration: 3000, style: { background: '#fff', color: '#333', padding: '12px', borderRadius: '12px' } }
      );
      setSearchTerbuka(false);
      setSearchQuery('');
      setSearchSuggestions([]);
    } else {
      toast.error('Provinsi tidak ditemukan');
    }
  };

  const bukaModalAnalisis = () => {
    if (!pernahAnalisis) {
      setPilihanIndikator('ALL');
      setModalAnalisisTerbuka(true);
    } else {
      setMenuPilihanIndikatorTerbuka(!menuPilihanIndikatorTerbuka);
    }
  };

  const jalankanAnalisisBPS = async (indikator = null) => {
    const pilihan = indikator || pilihanIndikator;
    setModalAnalisisTerbuka(false);
    setMenuPilihanIndikatorTerbuka(false);
    setSedangMenganalisis(true);
    // Reset filter kategori setiap kali analisis baru dijalankan
    setKategoriTerpilih('SEMUA');
    const petunjukMemuat = toast.loading(`Mengambil data dari BPS Web API...\nAnalisis: ${pilihan === 'ALL' ? 'Semua Indikator' : pilihan}`);

    try {
      const respons = await axios.post('http://127.0.0.1:8000/api/analyze-education-bps/', {
        provinces: 'ALL',
        indikator: pilihan
      });
      toast.dismiss(petunjukMemuat);
      if (respons.data.status === 'success') {
        setHasilAnalisis(respons.data);
        setIndikatorTerpilih(pilihan === 'ALL' ? 'SEMUA' : pilihan);
        setPernahAnalisis(true);
        toast.success(`Berhasil menganalisis ${respons.data.total_success} provinsi dari BPS!`, { duration: 5000 });
      }
    } catch (galat) {
      toast.dismiss(petunjukMemuat);
      if (galat.response?.data?.error) toast.error(galat.response.data.error);
      else toast.error('Gagal terhubung ke server');
      console.error(galat);
    } finally {
      setSedangMenganalisis(false);
    }
  };

  const resetAnalisis = () => {
    setHasilAnalisis(null);
    setKategoriTerpilih('SEMUA');
    setIndikatorTerpilih('SEMUA');
    setPanelInfoTerbuka(false);
    setPanelTabelTerbuka(false);
    setPanelMetodologiTerbuka(false);
    setPanelKebijakanTerbuka(false);
    setProvinsiDipilih(null);
    setPernahAnalisis(false);
    setModeBersih(false);
    toast.success('Analisis berhasil direset');
  };

  const bukaModalSave = () => {
    if (!hasilAnalisis) return toast.error("Belum ada data untuk disimpan");
    setNamaSimpan('');
    setModalSaveTerbuka(true);
  };

  const simpanAnalisis = async () => {
    if (!namaSimpan.trim()) return toast.error("Nama analisis tidak boleh kosong");
    setSedangMenyimpan(true);
    const petunjukMemuat = toast.loading('Menyimpan analisis...');
    try {
      const respons = await axios.post('http://127.0.0.1:8000/api/save-education-analysis/', {
        name: namaSimpan,
        analysis_data: hasilAnalisis
      });
      toast.dismiss(petunjukMemuat);
      if (respons.data.status === 'success') {
        toast.success(`Analisis "${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false);
        setNamaSimpan('');
      }
    } catch (galat) {
      toast.dismiss(petunjukMemuat);
      toast.error('Gagal menyimpan analisis');
      console.error(galat);
    } finally {
      setSedangMenyimpan(false);
    }
  };

  const unduhDataset = async (jenisDataset) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error("Dataset tidak tersedia");
    setMenuDatasetTerbuka(false);
    if (jenisDataset === 'ALL') {
      await unduhDatasetRLS();
      await unduhDatasetAPS();
      await unduhDatasetRasio();
      return;
    }
    if (jenisDataset === 'RLS')   return unduhDatasetRLS();
    if (jenisDataset === 'APS')   return unduhDatasetAPS();
    if (jenisDataset === 'RASIO') return unduhDatasetRasio();
  };

  const unduhDatasetRLS = async () => {
    if (!hasilAnalisis?.raw_datasets?.RLS) return toast.error("Data RLS tidak tersedia");
    setLoadingDataset(p => ({ ...p, RLS: true }));
    const toastId = toast.loading('Membuat file RLS...');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/download-rls-xlsx/', {
        rls_data: hasilAnalisis.raw_datasets.RLS,
        timestamp: hasilAnalisis.raw_datasets.timestamp
      }, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([res.data]));
      a.download = `Dataset_RLS_BPS_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      toast.dismiss(toastId);
      toast.success('Dataset RLS berhasil diunduh!');
    } catch {
      toast.dismiss(toastId);
      toast.error('Gagal mengunduh dataset RLS');
    } finally {
      setLoadingDataset(p => ({ ...p, RLS: false }));
    }
  };

  const unduhDatasetAPS = async () => {
    if (!hasilAnalisis?.raw_datasets?.APS) return toast.error("Data APS tidak tersedia");
    setLoadingDataset(p => ({ ...p, APS: true }));
    const toastId = toast.loading('Membuat file APS...');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/download-aps-xlsx/', {
        aps_data: hasilAnalisis.raw_datasets.APS,
        timestamp: hasilAnalisis.raw_datasets.timestamp
      }, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([res.data]));
      a.download = `Dataset_APS_BPS_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      toast.dismiss(toastId);
      toast.success('Dataset APS berhasil diunduh!');
    } catch {
      toast.dismiss(toastId);
      toast.error('Gagal mengunduh dataset APS');
    } finally {
      setLoadingDataset(p => ({ ...p, APS: false }));
    }
  };

  const unduhDatasetRasio = async () => {
    const ds = hasilAnalisis?.raw_datasets;
    if (!ds?.RASIO_SD) return toast.error("Data Rasio tidak tersedia");
    setLoadingDataset(p => ({ ...p, RASIO: true }));
    const toastId = toast.loading('Membuat file Rasio Murid-Guru...');
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/download-rasio-xlsx/', {
        rasio_sd:  ds.RASIO_SD  || {},
        rasio_smp: ds.RASIO_SMP || {},
        rasio_sma: ds.RASIO_SMA || {},
        rasio_smk: ds.RASIO_SMK || {},
        timestamp: ds.timestamp
      }, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([res.data]));
      a.download = `Dataset_Rasio_Murid_Guru_BPS_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      toast.dismiss(toastId);
      toast.success('Dataset Rasio berhasil diunduh!');
    } catch {
      toast.dismiss(toastId);
      toast.error('Gagal mengunduh dataset Rasio');
    } finally {
      setLoadingDataset(p => ({ ...p, RASIO: false }));
    }
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error("Data tidak tersedia");
    const ringkasan = hasilAnalisis.analysis_summary;
    setMenuUnduhTerbuka(false);

    if (format === 'EXCEL') {
      const dataExport = ringkasan.map(item => ({
        'Provinsi': item.provinsi,
        'Kategori': item.kategori,
        'Skor Total': item.skor_total,
        'RLS (tahun)': item.rls || '-',
        'Skor APS': item.skor_aps || '-',
        'Rasio Rata-rata': item.rasio_rata || '-'
      }));
      const lembarKerja = XLSX.utils.json_to_sheet(dataExport);
      const bukuKerja = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(bukuKerja, lembarKerja, "Analisis Pendidikan BPS");
      XLSX.writeFile(bukuKerja, `Analisis_Pendidikan_BPS_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('File Excel berhasil diunduh');
    } else if (format === 'JSON') {
      const gumpalan = new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' });
      unduhBerkas(gumpalan, `Analisis_Pendidikan_BPS_${new Date().toISOString().split('T')[0]}.json`);
      toast.success('File JSON berhasil diunduh');
    } else if (format === 'CSV') {
      const barisCsv = [
        ["Provinsi","Kategori","Skor Total","RLS","Skor APS","Rasio"].join(","),
        ...ringkasan.map(s => [s.provinsi, s.kategori, s.skor_total, s.rls||'-', s.skor_aps||'-', s.rasio_rata||'-'].join(","))
      ].join("\n");
      const gumpalan = new Blob([barisCsv], { type: 'text/csv' });
      unduhBerkas(gumpalan, `Analisis_Pendidikan_BPS_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('File CSV berhasil diunduh');
    } else if (format === 'GEOJSON') {
      const gumpalan = new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' });
      unduhBerkas(gumpalan, `Spasial_Pendidikan_BPS_${new Date().toISOString().split('T')[0]}.geojson`);
      toast.success('File GeoJSON berhasil diunduh');
    }
  };

  const unduhBerkas = (gumpalan, namaBerkas) => {
    const tautan = URL.createObjectURL(gumpalan);
    const elemen = document.createElement('a');
    elemen.href = tautan;
    elemen.download = namaBerkas;
    elemen.click();
    URL.revokeObjectURL(tautan);
  };

  // ============================================================
  // FIX: Gunakan helper getKategoriByIndikator untuk filter tabel
  // ============================================================
  const ambilDataTabelTerfilter = () => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let fitur = hasilAnalisis.matched_features.features;

    if (kategoriTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => getKategoriByIndikator(f, indikatorTerpilih) === kategoriTerpilih);
    }

    // Hanya tampilkan data yang punya nilai untuk indikator yang dipilih
    if (indikatorTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => {
        const dp = f.properties?.education_analysis?.data_pendidikan || {};
        if (indikatorTerpilih === 'RLS') return dp.RLS != null;
        if (indikatorTerpilih === 'APS') return dp.SKOR_APS != null;
        if (indikatorTerpilih === 'RASIO') return dp.RASIO_RATA != null;
        return true;
      });
    }

    return fitur;
  };

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Loading...';
    if (!pernahAnalisis) return 'Analisis';
    if (indikatorTerpilih === 'SEMUA') return 'Analisis Semua Indikator';
    if (indikatorTerpilih === 'RLS')   return 'Analisis RLS';
    if (indikatorTerpilih === 'APS')   return 'Analisis APS';
    if (indikatorTerpilih === 'RASIO') return 'Analisis Rasio';
    return 'Analisis';
  };

  const getWarnaIndikator = () => {
    if (indikatorTerpilih === 'SEMUA')  return 'linear-gradient(135deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)';
    if (indikatorTerpilih === 'RLS')    return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
    if (indikatorTerpilih === 'APS')    return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    if (indikatorTerpilih === 'RASIO')  return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
  };

  const dataTerfilter = ambilDataTabelTerfilter();
  const adaPanelTerbuka = panelInfoTerbuka || panelTabelTerbuka || panelMetodologiTerbuka || panelKebijakanTerbuka;

  // ============================================================
  // FIX: Hitung jumlah kategori berdasarkan indikator aktif
  // ============================================================
  const hitungKategori = () => {
    if (!hasilAnalisis?.matched_features?.features) return { KRITIS: 0, SEDANG: 0, BAIK: 0 };
    const f = hasilAnalisis.matched_features.features;
    return {
      KRITIS: f.filter(x => getKategoriByIndikator(x, indikatorTerpilih) === 'KRITIS').length,
      SEDANG: f.filter(x => getKategoriByIndikator(x, indikatorTerpilih) === 'SEDANG').length,
      BAIK:   f.filter(x => getKategoriByIndikator(x, indikatorTerpilih) === 'BAIK').length
    };
  };
  const jumlahKategori = hitungKategori();

  const toggleAllPanels = () => {
    setPanelInfoTerbuka(false);
    setPanelTabelTerbuka(false);
    setPanelMetodologiTerbuka(false);
    setPanelKebijakanTerbuka(false);
  };

  if (!adalahClient) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {!modeBersih && <HeaderBar />}

      {/* MODAL PILIHAN ANALISIS */}
      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Pilih Data Analisis</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Pilih indikator yang ingin dianalisis untuk pemetaan pendidikan nasional
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setPilihanIndikator('ALL')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${pilihanIndikator === 'ALL' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase">📊 Semua Indikator</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Analisis komprehensif seluruh data pendidikan</div>
                  </div>
                  {pilihanIndikator === 'ALL' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setPilihanIndikator('RLS')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${pilihanIndikator === 'RLS' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase">📚 Rata-rata Lama Sekolah</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fokus analisis pada pencapaian lama sekolah per provinsi</div>
                  </div>
                  {pilihanIndikator === 'RLS' && (
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setPilihanIndikator('APS')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${pilihanIndikator === 'APS' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase">🎓 Angka Partisipasi Sekolah</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fokus 4 kelompok umur: 7–12, 13–15, 16–18, 19–23 tahun</div>
                  </div>
                  {pilihanIndikator === 'APS' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setPilihanIndikator('RASIO')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${pilihanIndikator === 'RASIO' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-green-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase">👥 Rasio Murid-Guru</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fokus beban mengajar guru SD, SMP, SMA, SMK</div>
                  </div>
                  {pilihanIndikator === 'RASIO' && (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalAnalisisTerbuka(false)} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Batal
              </button>
              <button onClick={() => jalankanAnalisisBPS()} disabled={sedangMenganalisis}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Mulai Analisis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SAVE */}
      {modalSaveTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Simpan Analisis</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Nama Analisis</label>
              <input
                type="text"
                value={namaSimpan}
                onChange={(e) => setNamaSimpan(e.target.value)}
                placeholder="contoh: Analisis Pendidikan Q1 2025"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && simpanAnalisis()}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalSaveTerbuka(false)} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Batal
              </button>
              <button onClick={simpanAnalisis} disabled={sedangMenyimpan || !namaSimpan.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {sedangMenyimpan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`fixed inset-0 bg-white dark:bg-slate-900 ${modeBersih ? 'top-0' : 'top-16'}`}>
        {!petaSedangMemuat && KontainerPeta && (
          <KontainerPeta center={PUSAT_DEFAULT} zoom={ZOOM_DEFAULT} className="h-full w-full z-0" zoomControl={false} ref={petaRef}>
            <LapisanPeta
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MouseTracker />
            {hasilAnalisis?.matched_features?.features && (
              <GeoJSON
                key={JSON.stringify(hasilAnalisis.matched_features.features) + kategoriTerpilih + indikatorTerpilih + provinsiDipilih}
                data={{ type: "FeatureCollection", features: hasilAnalisis.matched_features.features }}
                style={(fitur) => {
                  const analisis = fitur.properties?.education_analysis || {};
                  // FIX: gunakan kategori yang dihitung berdasarkan indikator aktif
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                  const warna = getWarnaByIndikator(fitur, indikatorTerpilih);

                  let terlihat = true;
                  // Filter berdasarkan kategori yang relevan dengan indikator saat ini
                  if (kategoriTerpilih !== 'SEMUA' && kategoriAktif !== kategoriTerpilih) terlihat = false;
                  // Sembunyikan jika tidak ada data untuk indikator yang dipilih
                  if (warna === "#cbd5e1") terlihat = false;

                  const isHighlighted = provinsiDipilih === analisis.nama_provinsi;
                  return {
                    fillColor: warna,
                    weight: isHighlighted ? 4 : 2,
                    opacity: terlihat ? 1 : 0,
                    color: isHighlighted ? '#3b82f6' : 'white',
                    fillOpacity: terlihat ? 0.75 : 0
                  };
                }}
                onEachFeature={(fitur, lapisan) => {
                  const analisis = fitur.properties?.education_analysis || {};
                  const dp = analisis.data_pendidikan || {};
                  const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                  const wawasan = analisis.insights?.map(i => `<div style="margin-bottom:3px; padding-left:6px; border-left:2px solid ${warna}; font-weight:600; font-size:9px;">${i}</div>`).join('') || '';

                  lapisan.bindTooltip(`
                    <div style="font-family: inherit; padding: 4px;">
                      <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">${analisis.nama_provinsi}</div>
                      <div style="font-size: 9px; font-weight: 800; color: ${warna}; margin-top:2px;">STATUS: ${kategoriAktif || '-'}</div>
                      <div style="font-size: 8px; font-weight: 700; color: #64748b; margin-top:2px;">Skor: ${analisis.skor_total}</div>
                    </div>
                  `, { sticky: true, opacity: 0.95 });

                  let indikatorHTML = '';
                  if (indikatorTerpilih === 'SEMUA') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #8b5cf6;">
                        <div style="font-size: 7px; font-weight: 900; color: #4c1d95; text-transform: uppercase; margin-bottom: 1px;">📚 Lama Sekolah</div>
                        <div style="font-size: 11px; font-weight: 900; color: #7c3aed;">${dp.RLS ? dp.RLS + ' th' : '-'}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #3b82f6;">
                        <div style="font-size: 7px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin-bottom: 1px;">🎓 Skor APS</div>
                        <div style="font-size: 11px; font-weight: 900; color: #2563eb;">${dp.SKOR_APS || '-'}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #10b981;">
                        <div style="font-size: 7px; font-weight: 900; color: #14532d; text-transform: uppercase; margin-bottom: 1px;">👥 Rasio Murid-Guru</div>
                        <div style="font-size: 11px; font-weight: 900; color: #059669;">${dp.RASIO_RATA || '-'}</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'RLS') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #8b5cf6;">
                        <div style="font-size: 8px; font-weight: 900; color: #4c1d95; text-transform: uppercase; margin-bottom: 2px;">📚 Rata-rata Lama Sekolah</div>
                        <div style="font-size: 16px; font-weight: 900; color: #7c3aed;">${dp.RLS ? dp.RLS + ' tahun' : '-'}</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'APS') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <div style="font-size: 8px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin-bottom: 2px;">🎓 Angka Partisipasi Sekolah</div>
                        <div style="font-size: 16px; font-weight: 900; color: #2563eb;">${dp.SKOR_APS || '-'}</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'RASIO') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #10b981;">
                        <div style="font-size: 8px; font-weight: 900; color: #14532d; text-transform: uppercase; margin-bottom: 2px;">👥 Rasio Murid-Guru</div>
                        <div style="font-size: 16px; font-weight: 900; color: #059669;">${dp.RASIO_RATA || '-'}</div>
                      </div>
                    `;
                  }

                  const isiPopup = `
                    <div style="font-family: inherit; min-width: 280px; max-width: 280px; color: #1e293b; padding: 4px;">
                      <div style="background: linear-gradient(135deg, ${warna} 0%, ${warna}dd 100%); color: white; padding: 8px; border-radius: 8px; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-weight: 900; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">${analisis.nama_provinsi}</div>
                        <div style="background: rgba(255,255,255,0.2); border-radius: 5px; padding: 5px; margin-top: 5px;">
                          <div style="font-size: 7px; font-weight: 800; opacity: 0.9; text-transform: uppercase; margin-bottom: 2px;">SKOR TOTAL</div>
                          <div style="background: rgba(255,255,255,0.3); height: 12px; border-radius: 6px; overflow: hidden; position: relative;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to right, #ef4444 0%, #f59e0b 50%, #10b981 100%);"></div>
                            <div style="position: absolute; top: 50%; transform: translateY(-50%); left: ${analisis.skor_total * 33}%; width: 2px; height: 16px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
                          </div>
                          <div style="text-align: center; margin-top: 3px; font-size: 10px; font-weight: 900;">Nilai: ${analisis.skor_total}</div>
                        </div>
                      </div>
                      <div style="padding: 0 2px;">
                        <div style="text-align: center; margin-bottom: 6px;">
                          <span style="background: ${warna}; color: white; padding: 4px 12px; border-radius: 10px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            ${kategoriAktif || '-'}
                          </span>
                        </div>
                        <div style="font-size: 7px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px;">📊 INDIKATOR</div>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 8px;">${indikatorHTML}</div>
                        <div style="font-size: 7px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">💡 ANALISIS</div>
                        <div style="font-size: 9px; color: #334155; line-height: 1.4; background: #f8fafc; padding: 6px; border-radius: 5px; border-left: 2px solid ${warna};">${wawasan}</div>
                      </div>
                    </div>
                  `;
                  lapisan.bindPopup(isiPopup, { maxWidth: 300, maxHeight: 400 });
                }}
              />
            )}
          </KontainerPeta>
        )}

        {/* JUDUL HALAMAN - KIRI ATAS */}
        {!modeBersih && (
          <div className="absolute top-6 left-6 z-[1000] bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 px-5 py-3 rounded-xl shadow-xl">
            <div className="text-sm font-black text-white uppercase tracking-wider">
              🎓 SDM Nasional Pendidikan
            </div>
          </div>
        )}

        {/* ZOOM CONTROLS */}
        {!modeBersih && (
          <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2">
            <button onClick={() => petaRef.current?.zoomIn()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
              <Plus size={16}/>
            </button>
            <button onClick={() => petaRef.current?.zoomOut()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
              <Minus size={16}/>
            </button>
          </div>
        )}

        {/* TOMBOL MODE BERSIH */}
        {hasilAnalisis && (
          <div className="absolute top-[170px] left-6 z-[1000]">
            <button
              onClick={() => setModeBersih(!modeBersih)}
              className="p-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-90 border-2 border-white dark:border-slate-700 relative overflow-hidden group"
              style={{ background: getWarnaIndikator() }}
            >
              {modeBersih ? <EyeOff size={16} className="text-white relative z-10" /> : <Eye size={16} className="text-white relative z-10" />}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all"></div>
            </button>
          </div>
        )}

        {/* SEARCH */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute top-[215px] left-6 z-[1000]">
            {searchTerbuka ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Cari provinsi..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none w-48"
                    autoFocus
                  />
                  <button onClick={() => handleSearch()} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all">
                    <Search size={16} />
                  </button>
                  <button onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); setProvinsiDipilih(null); }}
                    className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">
                    <X size={16} />
                  </button>
                </div>
                {searchSuggestions.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                    {searchSuggestions.map((sug, idx) => (
                      <button key={idx} onClick={() => handleSearch(sug.nama)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{sug.nama}</span>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: sug.warna + '20', color: sug.warna }}>{sug.kategori}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchTerbuka(true)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
                <Search size={16}/>
              </button>
            )}
          </div>
        )}

        {/* KOORDINAT & SCALE - KANAN ATAS */}
        {!modeBersih && (
          <div className="absolute top-6 right-6 z-[1000] space-y-2">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="text-blue-600 dark:text-blue-400">Lat:</span> {koordinatCursor.lat} | <span className="text-blue-600 dark:text-blue-400">Lng:</span> {koordinatCursor.lng}
              </div>
            </div>

            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="flex flex-col gap-1">
                <div className="h-2 bg-slate-300 dark:bg-slate-600" style={{ width: '80px', borderLeft: '2px solid #64748b', borderRight: '2px solid #64748b', borderBottom: '2px solid #64748b' }}></div>
                <div className="text-[11px] font-bold text-center text-slate-700 dark:text-slate-300">{hitungScaleKm(currentZoom)} km</div>
              </div>
            </div>

            {/* LEGEND */}
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
              <div className="space-y-2">
                {Object.entries(KATEGORI).map(([kunci, nilai]) => (
                  <div key={kunci} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: nilai.warna }}></div>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{nilai.label}</span>
                    </div>
                    {hasilAnalisis && (
                      <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white">
                        {jumlahKategori[kunci]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* FILTER KATEGORI */}
            {hasilAnalisis && (
              <div className="relative">
                <button
                  onClick={() => { setMenuFilterTerbuka(!menuFilterTerbuka); setMenuUnduhTerbuka(false); }}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-[10px] font-bold hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center justify-between gap-2 tracking-wider shadow-lg"
                >
                  <div className="flex items-center gap-2"><Filter size={14} /> {kategoriTerpilih}</div>
                  <ChevronDown size={14} className={`transition-transform ${menuFilterTerbuka ? 'rotate-180' : ''}`} />
                </button>
                {menuFilterTerbuka && (
                  <div className="absolute top-full mt-2 right-0 w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl dark:shadow-slate-900/50 z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                    {["SEMUA", "KRITIS", "SEDANG", "BAIK"].map(kat => (
                      <button key={kat} onClick={() => { setKategoriTerpilih(kat); setMenuFilterTerbuka(false); }}
                        className={`w-full text-left px-4 py-2 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 last:border-0 ${kategoriTerpilih === kat ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        {kat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BOTTOM ACTION BUTTONS */}
        {!modeBersih && (
          <div className={`absolute left-1/2 -translate-x-1/2 z-[1002] transition-all duration-300 ${adaPanelTerbuka ? 'bottom-[380px]' : 'bottom-16'}`}>
            <div className="flex gap-3">
              <div className="relative">
                <button
                  onClick={bukaModalAnalisis}
                  disabled={sedangMenganalisis}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl font-black text-xs tracking-wider hover:shadow-xl hover:shadow-blue-500/30 dark:hover:shadow-blue-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase active:scale-95 flex items-center gap-2 whitespace-nowrap"
                >
                  <Play size={14} className={sedangMenganalisis ? "animate-pulse" : ""} />
                  {getButtonText()}
                </button>

                {menuPilihanIndikatorTerbuka && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1003] overflow-hidden border border-slate-200 dark:border-slate-700">
                    <button onClick={() => jalankanAnalisisBPS('ALL')} className="w-full text-left px-4 py-2 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      📊 Semua Indikator
                    </button>
                    <button onClick={() => jalankanAnalisisBPS('RLS')} className="w-full text-left px-4 py-2 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                      📚 Rata-rata Lama Sekolah
                    </button>
                    <button onClick={() => jalankanAnalisisBPS('APS')} className="w-full text-left px-4 py-2 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      🎓 Angka Partisipasi Sekolah
                    </button>
                    <button onClick={() => jalankanAnalisisBPS('RASIO')} className="w-full text-left px-4 py-2 text-[10px] font-bold transition-all text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20">
                      👥 Rasio Murid-Guru
                    </button>
                  </div>
                )}
              </div>

              {hasilAnalisis && (
                <>
                  <button onClick={bukaModalSave} className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600 text-white rounded-xl font-black text-xs tracking-wider hover:shadow-xl hover:shadow-green-500/30 dark:hover:shadow-green-400/20 transition-all uppercase active:scale-95 flex items-center gap-2">
                    <Save size={14} /> Simpan
                  </button>
                  <button onClick={resetAnalisis} className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-500 dark:from-slate-500 dark:to-slate-600 text-white rounded-xl font-black text-xs tracking-wider hover:shadow-xl hover:shadow-slate-500/30 dark:hover:shadow-slate-400/20 transition-all uppercase active:scale-95 flex items-center gap-2">
                    <RotateCcw size={14} /> Reset
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM PANELS */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute bottom-0 left-0 right-0 z-[1001]">

            {/* INFO PANEL */}
            <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-2xl ${panelInfoTerbuka ? 'h-[340px] overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Activity className="text-blue-500" size={24} />
                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ringkasan Analisis</h2>
                  </div>
                  <button onClick={() => setPanelInfoTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                  Analisis data pendidikan nasional menggunakan BPS Web API dengan 3 indikator utama: RLS, APS, dan Rasio Murid-Guru
                </p>
                {hasilAnalisis.timestamp && (
                  <div className="mb-4 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400">
                    📅 Waktu Pengambilan Data: {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Total Provinsi</div>
                    <div className="text-xl font-black text-blue-700 dark:text-blue-300">{hasilAnalisis.total_success}</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                    <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Kritis</div>
                    <div className="text-xl font-black text-red-700 dark:text-red-300">{jumlahKategori.KRITIS}</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 border border-yellow-200 dark:border-yellow-800">
                    <div className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-1">Sedang</div>
                    <div className="text-xl font-black text-yellow-700 dark:text-yellow-300">{jumlahKategori.SEDANG}</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                    <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Baik</div>
                    <div className="text-xl font-black text-green-700 dark:text-green-300">{jumlahKategori.BAIK}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL PANEL */}
            <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-2xl ${panelTabelTerbuka ? 'h-[340px] overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Matriks Pendidikan</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">{dataTerfilter.length} Wilayah</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        onClick={() => { setMenuUnduhTerbuka(!menuUnduhTerbuka); setMenuFilterTerbuka(false); }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-[10px] font-bold hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        <Download size={12} /> UNDUH
                      </button>
                      {menuUnduhTerbuka && (
                        <div className="absolute top-full mt-2 right-0 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                          {['GEOJSON', 'JSON', 'EXCEL', 'CSV'].map(format => (
                            <button key={format} onClick={() => eksporData(format)}
                              className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-b border-slate-100 dark:border-slate-700 last:border-0">
                              <Download size={12} className="inline mr-2 text-blue-500" /> {format}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setPanelTabelTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <X size={18} className="text-slate-500" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
                        <th className="px-3 py-2 text-center">No</th>
                        <th className="px-3 py-2">Provinsi</th>
                        <th className="px-3 py-2 text-center">Skor</th>
                        {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'RLS') && <th className="px-3 py-2 text-center">RLS</th>}
                        {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'APS') && <th className="px-3 py-2 text-center">Skor APS</th>}
                        {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'RASIO') && <th className="px-3 py-2 text-center">Rasio</th>}
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dataTerfilter.map((fitur, indeks) => {
                        const data = fitur.properties.education_analysis;
                        const dp = data.data_pendidikan || {};
                        const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                        const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                        return (
                          <tr key={indeks} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                            <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{indeks + 1}</td>
                            <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">{data.skor_total}</span>
                            </td>
                            {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'RLS') && (
                              <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{dp.RLS ? `${dp.RLS} th` : '-'}</td>
                            )}
                            {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'APS') && (
                              <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{dp.SKOR_APS || '-'}</td>
                            )}
                            {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'RASIO') && (
                              <td className="px-3 py-2 text-center">
                                <div className="text-xs font-bold text-slate-900 dark:text-white">{dp.RASIO_RATA || '-'}</div>
                                {dp.RASIO_SD && (
                                  <div className="flex flex-wrap gap-1 justify-center mt-1">
                                    {[['SD', dp.RASIO_SD, 'blue'], ['SMP', dp.RASIO_SMP, 'green'], ['SMA', dp.RASIO_SMA, 'yellow'], ['SMK', dp.RASIO_SMK, 'purple']].map(([j, v, c]) => (
                                      <span key={j} className={`px-1.5 py-0.5 bg-${c}-100 dark:bg-${c}-900/30 text-${c}-700 dark:text-${c}-300 text-[9px] font-bold rounded`}>{j}:{v || '-'}</span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            )}
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna + '40', color: warna }}>{kategoriAktif}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* KEBIJAKAN PANEL */}
            <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-2xl ${panelKebijakanTerbuka ? 'h-[340px] overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="text-blue-500" size={24} />
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Rekomendasi Kebijakan</h3>
                  </div>
                  <button onClick={() => setPanelKebijakanTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
                        <th className="px-3 py-2 text-center">No</th>
                        <th className="px-3 py-2">Provinsi</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Prioritas</th>
                        <th className="px-3 py-2">Rekomendasi Kebijakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dataTerfilter.map((fitur, indeks) => {
                        const data = fitur.properties.education_analysis;
                        const rekUtama = data.rekomendasi?.[0];
                        const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                        const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                        return (
                          <tr key={indeks} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                            <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{indeks + 1}</td>
                            <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna + '40', color: warna }}>{kategoriAktif}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                kategoriAktif === 'KRITIS' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                kategoriAktif === 'SEDANG' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              }`}>
                                {rekUtama?.title || "NORMAL"}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-md">
                              <ul className="space-y-1 text-[10px]">
                                {rekUtama?.actions?.map((action, idx) => (
                                  <li key={idx} className="text-slate-600 dark:text-slate-300 font-medium">• {action}</li>
                                )) || <li className="text-slate-400">Pertahankan kondisi saat ini</li>}
                              </ul>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* METODOLOGI PANEL */}
            <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-2xl ${panelMetodologiTerbuka ? 'h-[340px] overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Metodologi Perhitungan Skor Pendidikan Terintegrasi (SPT)
                  </h3>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setMenuDatasetTerbuka(!menuDatasetTerbuka)}
                        className="px-3 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        <Download size={12} /> Dataset
                      </button>
                      {menuDatasetTerbuka && (
                        <div className="absolute top-full mt-2 right-0 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                          <button onClick={() => unduhDataset('ALL')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                            <Database size={14} className="inline mr-2 text-purple-600" /> Semua Dataset
                          </button>
                          <button onClick={() => unduhDataset('RLS')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                            {loadingDataset.RLS ? '⏳' : '📚'} Dataset RLS {loadingDataset.RLS && '(Memproses...)'}
                          </button>
                          <button onClick={() => unduhDataset('APS')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                            {loadingDataset.APS ? '⏳' : '🎓'} Dataset APS {loadingDataset.APS && '(Memproses...)'}
                          </button>
                          <button onClick={() => unduhDataset('RASIO')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
                            {loadingDataset.RASIO ? '⏳' : '👥'} Dataset Rasio Murid-Guru {loadingDataset.RASIO && '(Memproses...)'}
                          </button>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setPanelMetodologiTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <X size={18} className="text-slate-500" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Skor Pendidikan Terintegrasi (SPT) menggabungkan 3 indikator kunci pendidikan dengan pembobotan berdasarkan dampak dan relevansi terhadap kualitas SDM nasional.
                </p>

                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-black text-purple-900 dark:text-purple-100 mb-2 uppercase">Formula Perhitungan</h4>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-300 dark:border-purple-700">
                    <code className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                      SPT = (Skor_RLS × 0.30) + (Skor_APS_Gabungan × 0.50) + (Skor_Rasio × 0.20)
                    </code>
                  </div>
                </div>

                {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'APS') && (
                  <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-4 border-2 border-cyan-200 dark:border-cyan-800">
                    <h4 className="text-sm font-black text-cyan-900 dark:text-cyan-100 mb-2 uppercase flex items-center gap-2">
                      <span>📊</span> Catatan: Angka Partisipasi Sekolah (APS)
                    </h4>
                    <div className="text-xs text-cyan-800 dark:text-cyan-200 font-semibold mb-2">
                      <strong>Metode:</strong> Rata-rata skor dari 4 kelompok umur
                    </div>
                    <p className="text-xs text-cyan-700 dark:text-cyan-300 mb-3 leading-relaxed">
                      Skor APS Gabungan dihitung dengan merata-ratakan skor dari 4 kelompok umur: 7–12 tahun (SD), 13–15 tahun (SMP), 16–18 tahun (SMA/K), dan 19–23 tahun (Perguruan Tinggi).
                    </p>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-cyan-300 dark:border-cyan-700 mb-3">
                      <div className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase mb-1">Formula</div>
                      <code className="text-xs font-mono font-bold text-cyan-900 dark:text-cyan-100">
                        Skor_APS = (Skor_7-12 + Skor_13-15 + Skor_16-18 + Skor_19-23) / 4
                      </code>
                    </div>
                    <div className="bg-cyan-100 dark:bg-cyan-950/30 rounded-lg p-3 border border-cyan-300 dark:border-cyan-700">
                      <div className="text-[10px] font-black text-cyan-700 dark:text-cyan-300 uppercase mb-1">Aturan Skor per Kelompok</div>
                      <code className="text-xs font-mono font-semibold text-cyan-900 dark:text-cyan-100">{'>'}80% → Skor 3 | 70–80% → Skor 2 | {'<'}70% → Skor 1</code>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'RLS') && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border-l-4 border-purple-500">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-black text-purple-900 dark:text-purple-100 uppercase">Rata-rata Lama Sekolah (RLS)</h5>
                          <span className="inline-block mt-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold rounded">Bobot: 30%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                          <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">Tinggi</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{'>'}9.5 tahun (Skor 3)</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                          <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase">Sedang</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">8.0–9.5 tahun (Skor 2)</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                          <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">Rendah</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{'<'}8.0 tahun (Skor 1)</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'APS') && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase">Angka Partisipasi Sekolah (APS)</h5>
                          <span className="inline-block mt-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded">Bobot: 50%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
                          <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">Tinggi</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{'>'}80% (Skor 3)</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
                          <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase">Sedang</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">70–80% (Skor 2)</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
                          <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">Rendah</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{'<'}70% (Skor 1)</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'RASIO') && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border-l-4 border-green-500">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-black text-green-900 dark:text-green-100 uppercase">Rasio Murid-Guru (SD, SMP, SMA, SMK)</h5>
                          <span className="inline-block mt-1 px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold rounded">Bobot: 20%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-green-200 dark:border-green-700">
                          <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">Ringan</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{'<'}12 murid/guru (Skor 3)</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-green-200 dark:border-green-700">
                          <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase">Sedang</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">12–16 murid/guru (Skor 2)</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-green-200 dark:border-green-700">
                          <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">Berat</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{'>'}16 murid/guru (Skor 1)</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                  <h4 className="text-sm font-black text-green-900 dark:text-green-100 uppercase mb-3">Kategori Hasil Analisis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-green-200 dark:border-green-700">
                      <div className="text-xs font-black text-green-600 dark:text-green-400 uppercase">BAIK</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">Skor ≥ 2.4</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">Sistem pendidikan berkinerja sangat baik</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-yellow-200 dark:border-yellow-700">
                      <div className="text-xs font-black text-yellow-600 dark:text-yellow-400 uppercase">SEDANG</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">1.8 ≤ Skor {'<'} 2.4</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">Perlu peningkatan bertahap</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-red-200 dark:border-red-700">
                      <div className="text-xs font-black text-red-600 dark:text-red-400 uppercase">KRITIS</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">Skor {'<'} 1.8</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">Memerlukan intervensi segera</div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase mb-2">Validitas Metodologi</h4>
                  <p className="text-xs text-blue-800 dark:text-blue-200 mb-3">
                    Pembobotan mengacu pada standar Kemendikbudristek dan UNESCO. APS mendapat bobot tertinggi (50%) karena merepresentasikan akses pendidikan secara langsung.
                  </p>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-blue-300 dark:border-blue-700">
                    <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1">Catatan Penting</div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Analisis memberikan gambaran holistik kondisi pendidikan dengan mempertimbangkan aspek outcome (RLS), aksesibilitas (APS), dan kapasitas pengajar (Rasio) secara berimbang.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase mb-2">Sumber Data</div>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    <li>• BPS Web API — Rata-rata Lama Sekolah (Var: 459) — Tahun 2024</li>
                    <li>• BPS Web API — Angka Partisipasi Sekolah (Var: 2211) — Tahun 2025</li>
                    <li>• BPS Web API — SIMDASI Kemdikbudristek (SD/SMP/SMA/SMK) — Tahun 2024</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CONTROL BUTTONS BAR */}
            <div className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 p-3 shadow-2xl">
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => { setPanelInfoTerbuka(!panelInfoTerbuka); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelInfoTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <Info size={14} /> Info
                  {panelInfoTerbuka ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                <button
                  onClick={() => { setPanelTabelTerbuka(!panelTabelTerbuka); setPanelInfoTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelTabelTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <Table size={14} /> Tabel
                  {panelTabelTerbuka ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                <button
                  onClick={() => { setPanelKebijakanTerbuka(!panelKebijakanTerbuka); setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelKebijakanTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <ClipboardList size={14} /> Kebijakan
                  {panelKebijakanTerbuka ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                <button
                  onClick={() => { setPanelMetodologiTerbuka(!panelMetodologiTerbuka); setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelKebijakanTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelMetodologiTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <FileText size={14} /> Metodologi
                  {panelMetodologiTerbuka ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                {adaPanelTerbuka && (
                  <button
                    onClick={toggleAllPanels}
                    className="px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                  >
                    <ChevronDown size={14} /> Tutup Semua
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}