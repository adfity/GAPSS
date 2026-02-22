"use client";
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Play, Download, AlertCircle, Plus, Minus, ChevronDown, Filter, Save, X, Activity, RotateCcw, Database, ChevronUp, Info, Table, FileText, ClipboardList, Search, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';

// Konfigurasi Kategori Ekonomi - KONSISTEN WARNA
const KATEGORI = {
  MAJU: { warna: "#10b981", label: "MAJU", status: "BERKEMBANG PESAT" },           // HIJAU
  BERKEMBANG: { warna: "#f59e0b", label: "BERKEMBANG", status: "MENUJU MAJU" },    // KUNING
  TERTINGGAL: { warna: "#ef4444", label: "TERTINGGAL", status: "PERLU PERCEPATAN" } // MERAH
};

const PUSAT_DEFAULT = [-2.5, 118];
const ZOOM_DEFAULT = 5;

export default function EkonomiPage() {
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
      .filter(f => f.properties?.ekonomi_analysis?.nama_provinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(f => ({
        nama: f.properties.ekonomi_analysis.nama_provinsi,
        kategori: f.properties.ekonomi_analysis.kategori,
        warna: f.properties.ekonomi_analysis.warna
      }))
      .slice(0, 5);
    setSearchSuggestions(suggestions);
  }, [searchQuery, hasilAnalisis]);

  const handleSearch = (namaProvinsi) => {
    const provinsiNama = namaProvinsi || searchQuery;
    if (!hasilAnalisis?.matched_features?.features || !provinsiNama.trim()) return;
    
    const fitur = hasilAnalisis.matched_features.features.find(f =>
      f.properties?.ekonomi_analysis?.nama_provinsi?.toLowerCase() === provinsiNama.toLowerCase()
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
      setProvinsiDipilih(fitur.properties.ekonomi_analysis.nama_provinsi);
      
      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <div>
            <div className="font-bold">Lokasi Ditemukan!</div>
            <div className="text-xs">{fitur.properties.ekonomi_analysis.nama_provinsi}</div>
          </div>
        </div>,
        { duration: 3000, style: { background: '#fff', color: '#333', padding: '12px', borderRadius: '12px' } }
      );
      
      setSearchTerbuka(false);
      setSearchQuery('');
      setSearchSuggestions([]);
    } else {
      toast.error('❌ Provinsi tidak ditemukan');
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
    const petunjukMemuat = toast.loading(`🔄 Mengambil data dari BPS Web API...\nAnalisis: ${pilihan === 'ALL' ? 'Semua Indikator Ekonomi' : pilihan}`);

    try {
      const respons = await axios.post('http://127.0.0.1:8000/api/analyze-ekonomi-bps/', {
        provinces: 'ALL',
        indikator_terpilih: pilihan
      });

      toast.dismiss(petunjukMemuat);
      
      if (respons.data.status === 'success') {
        setHasilAnalisis(respons.data);
        setIndikatorTerpilih(pilihan === 'ALL' ? 'SEMUA' : pilihan);
        setPernahAnalisis(true);
        toast.success(`✅ Berhasil menganalisis ${respons.data.total_success} provinsi dari BPS!`, { duration: 5000 });
      }
    } catch (galat) {
      toast.dismiss(petunjukMemuat);
      if (galat.response?.data?.error) {
        toast.error(`❌ ${galat.response.data.error}`);
      } else {
        toast.error('❌ Gagal terhubung ke server. Pastikan Django running di http://127.0.0.1:8000');
      }
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
    toast.success('✅ Analisis berhasil direset');
  };

  const bukaModalSave = () => {
    if (!hasilAnalisis) return toast.error("❌ Belum ada data untuk disimpan");
    setNamaSimpan('');
    setModalSaveTerbuka(true);
  };

  const simpanAnalisis = async () => {
    if (!namaSimpan.trim()) return toast.error("❌ Nama analisis tidak boleh kosong");
    setSedangMenyimpan(true);
    const petunjukMemuat = toast.loading('💾 Menyimpan analisis...');

    try {
      const respons = await axios.post('http://127.0.0.1:8000/api/save-ekonomi-analysis/', {
        name: namaSimpan,
        analysis_data: hasilAnalisis
      });

      toast.dismiss(petunjukMemuat);
      if (respons.data.status === 'success') {
        toast.success(`✅ Analisis "${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false);
        setNamaSimpan('');
      }
    } catch (galat) {
      toast.dismiss(petunjukMemuat);
      toast.error('❌ Gagal menyimpan analisis');
      console.error(galat);
    } finally {
      setSedangMenyimpan(false);
    }
  };

  const unduhDataset = (jenisDataset) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error("❌ Dataset tidak tersedia");
    const datasets = hasilAnalisis.raw_datasets;
    const indikatorInfo = hasilAnalisis.indikator_info;
    setMenuDatasetTerbuka(false);

    if (jenisDataset === 'ALL') {
      const bukuKerja = XLSX.utils.book_new();
      
      const dataArrayPDRB = Object.entries(datasets.PDRB || {}).map(([provinsi, nilai]) => ({
        'Provinsi': provinsi, 'PDRB (Milyar Rp)': nilai
      }));
      XLSX.utils.book_append_sheet(bukuKerja, XLSX.utils.json_to_sheet(dataArrayPDRB), "PDRB");
      
      const dataArrayKemiskinan = Object.entries(datasets.KEMISKINAN || {}).map(([provinsi, nilai]) => ({
        'Provinsi': provinsi, 'Kemiskinan (%)': nilai
      }));
      XLSX.utils.book_append_sheet(bukuKerja, XLSX.utils.json_to_sheet(dataArrayKemiskinan), "Kemiskinan");
      
      const dataArrayInvestasi = Object.entries(datasets.INVESTASI || {}).map(([provinsi, nilai]) => ({
        'Provinsi': provinsi, 'Investasi PMDN (Milyar Rp)': nilai
      }));
      XLSX.utils.book_append_sheet(bukuKerja, XLSX.utils.json_to_sheet(dataArrayInvestasi), "Investasi");
      
      XLSX.writeFile(bukuKerja, "TERASEG_Semua_Dataset_Ekonomi_BPS.xlsx");
      toast.success('✅ Semua dataset berhasil diunduh!');
    } else {
      const dataset = datasets[jenisDataset] || {};
      const info = indikatorInfo?.[jenisDataset];
      const dataArray = Object.entries(dataset).map(([provinsi, nilai]) => ({
        'Provinsi': provinsi,
        [`${info?.nama || jenisDataset} (${info?.satuan || ''})`]: nilai
      }));
      const lembarKerja = XLSX.utils.json_to_sheet(dataArray);
      const bukuKerja = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(bukuKerja, lembarKerja, jenisDataset);
      XLSX.writeFile(bukuKerja, `TERASEG_Dataset_${jenisDataset}_BPS.xlsx`);
      toast.success(`✅ Dataset ${info?.nama || jenisDataset} berhasil diunduh!`);
    }
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error("❌ Data tidak tersedia");
    const ringkasan = hasilAnalisis.analysis_summary;
    setMenuUnduhTerbuka(false);

    if (format === 'EXCEL') {
      const dataExport = ringkasan.map(item => ({
        'Provinsi': item.provinsi,
        'Kategori': item.kategori,
        'Indeks Ekonomi': item.ekonomi_index,
        'PDRB (Milyar Rp)': item.pdrb || '-',
        'Kemiskinan (%)': item.kemiskinan || '-',
        'Investasi PMDN (Milyar Rp)': item.investasi || '-'
      }));
      const lembarKerja = XLSX.utils.json_to_sheet(dataExport);
      const bukuKerja = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(bukuKerja, lembarKerja, "Analisis Ekonomi BPS");
      XLSX.writeFile(bukuKerja, "TERASEG_Ekonomi_BPS.xlsx");
      toast.success('✅ File Excel berhasil diunduh');
    } else if (format === 'JSON') {
      const gumpalan = new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' });
      unduhBerkas(gumpalan, 'TERASEG_Ekonomi_BPS.json');
      toast.success('✅ File JSON berhasil diunduh');
    } else if (format === 'CSV') {
      const barisCsv = [
        ["Provinsi", "Kategori", "Indeks Ekonomi", "PDRB", "Kemiskinan", "Investasi"].join(","),
        ...ringkasan.map(s => [
          s.provinsi, s.kategori, s.ekonomi_index,
          s.pdrb || '-', s.kemiskinan || '-', s.investasi || '-'
        ].join(","))
      ].join("\n");
      const gumpalan = new Blob([barisCsv], { type: 'text/csv' });
      unduhBerkas(gumpalan, 'TERASEG_Ekonomi_BPS.csv');
      toast.success('✅ File CSV berhasil diunduh');
    } else if (format === 'GEOJSON') {
      const gumpalan = new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' });
      unduhBerkas(gumpalan, 'TERASEG_Spasial_Ekonomi.geojson');
      toast.success('✅ File GeoJSON berhasil diunduh');
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

  const hitungWarnaIndikator = (fitur) => {
    if (indikatorTerpilih === 'SEMUA') {
      return fitur.properties?.ekonomi_analysis?.warna || "#cbd5e1";
    }
    const nilai = fitur.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih];
    if (nilai === null || nilai === undefined) return "#cbd5e1";

    if (indikatorTerpilih === 'PDRB') {
      if (nilai > 75000) return KATEGORI.MAJU.warna;
      if (nilai > 50000) return KATEGORI.BERKEMBANG.warna;
      return KATEGORI.TERTINGGAL.warna;
    } else if (indikatorTerpilih === 'KEMISKINAN') {
      if (nilai < 7) return KATEGORI.MAJU.warna;
      if (nilai < 12) return KATEGORI.BERKEMBANG.warna;
      return KATEGORI.TERTINGGAL.warna;
    } else if (indikatorTerpilih === 'INVESTASI') {
      if (nilai > 10000) return KATEGORI.MAJU.warna;
      if (nilai > 5000) return KATEGORI.BERKEMBANG.warna;
      return KATEGORI.TERTINGGAL.warna;
    }
    return fitur.properties?.ekonomi_analysis?.warna || "#cbd5e1";
  };

  const ambilDataTabelTerfilter = () => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let fitur = hasilAnalisis.matched_features.features;
    
    if (kategoriTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => f.properties?.ekonomi_analysis?.kategori === kategoriTerpilih);
    }
    
    if (indikatorTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => {
        const nilai = f.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih];
        return nilai !== null && nilai !== undefined;
      });
      
      fitur = fitur.sort((a, b) => {
        const nilaiA = a.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih] || 0;
        const nilaiB = b.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih] || 0;
        if (indikatorTerpilih === 'KEMISKINAN') return nilaiB - nilaiA;
        return nilaiA - nilaiB;
      });
    }
    
    return fitur;
  };

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Loading...';
    if (!pernahAnalisis) return 'Analisis';
    if (indikatorTerpilih === 'SEMUA') return 'Analisis Semua Indikator';
    if (indikatorTerpilih === 'PDRB') return 'Analisis PDRB';
    if (indikatorTerpilih === 'KEMISKINAN') return 'Analisis Kemiskinan';
    if (indikatorTerpilih === 'INVESTASI') return 'Analisis Investasi';
    return 'Analisis';
  };

  const dataTerfilter = ambilDataTabelTerfilter();
  const adaPanelTerbuka = panelInfoTerbuka || panelTabelTerbuka || panelMetodologiTerbuka || panelKebijakanTerbuka;

  const hitungKategori = () => {
    if (!hasilAnalisis?.matched_features?.features) return { TERTINGGAL: 0, BERKEMBANG: 0, MAJU: 0 };
    const features = hasilAnalisis.matched_features.features;
    return {
      TERTINGGAL: features.filter(f => f.properties?.ekonomi_analysis?.kategori === 'TERTINGGAL').length,
      BERKEMBANG: features.filter(f => f.properties?.ekonomi_analysis?.kategori === 'BERKEMBANG').length,
      MAJU: features.filter(f => f.properties?.ekonomi_analysis?.kategori === 'MAJU').length
    };
  };

  const jumlahKategori = hitungKategori();

  const toggleAllPanels = () => {
    setPanelInfoTerbuka(false);
    setPanelTabelTerbuka(false);
    setPanelMetodologiTerbuka(false);
    setPanelKebijakanTerbuka(false);
  };

  const getWarnaIndikator = () => {
    if (indikatorTerpilih === 'SEMUA') return 'linear-gradient(135deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)';
    if (indikatorTerpilih === 'PDRB') return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    if (indikatorTerpilih === 'KEMISKINAN') return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    if (indikatorTerpilih === 'INVESTASI') return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
    return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
  };

  if (!adalahClient) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {!modeBersih && <HeaderBar />}

      {/* MODAL PILIHAN ANALISIS - 4 INDIKATOR */}
      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Pilih Indikator Analisis</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-700 mb-5">
              <div className="flex items-center gap-2">
                <span className="text-base">ℹ️</span>
                <div>
                  <div className="text-xs font-black text-blue-900 dark:text-blue-100 uppercase">Data BPS Terkini</div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Pilih indikator untuk analisis pemetaan ekonomi daerah Indonesia</div>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {/* SEMUA */}
              <button
                onClick={() => setPilihanIndikator('ALL')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  pilihanIndikator === 'ALL'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white uppercase">SEMUA INDIKATOR</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDRB + Kemiskinan + Investasi — Analisis komprehensi ekonomi</div>
                    </div>
                  </div>
                  {pilihanIndikator === 'ALL' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>

              {/* PDRB */}
              <button
                onClick={() => setPilihanIndikator('PDRB')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  pilihanIndikator === 'PDRB'
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-yellow-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💹</span>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white uppercase">PDRB SAJA</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fokus output ekonomi daerah — PDRB Atas Dasar Harga Berlaku</div>
                    </div>
                  </div>
                  {pilihanIndikator === 'PDRB' && (
                    <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>

              {/* KEMISKINAN */}
              <button
                onClick={() => setPilihanIndikator('KEMISKINAN')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  pilihanIndikator === 'KEMISKINAN'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👥</span>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white uppercase">KEMISKINAN SAJA</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fokus distribusi kesejahteraan — Persentase Penduduk Miskin</div>
                    </div>
                  </div>
                  {pilihanIndikator === 'KEMISKINAN' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>

              {/* INVESTASI */}
              <button
                onClick={() => setPilihanIndikator('INVESTASI')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  pilihanIndikator === 'INVESTASI'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💰</span>
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white uppercase">INVESTASI SAJA</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fokus kepercayaan investor — Realisasi Investasi PMDN</div>
                    </div>
                  </div>
                  {pilihanIndikator === 'INVESTASI' && (
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalAnalisisTerbuka(false)}
                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => jalankanAnalisisBPS()}
                disabled={sedangMenganalisis}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {sedangMenganalisis ? '⏳ Loading...' : '▶️ Mulai Analisis'}
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
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">💾 Simpan Analisis</h3>
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
                placeholder="contoh: Analisis Ekonomi Q1 2025"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && simpanAnalisis()}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalSaveTerbuka(false)} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Batal
              </button>
              <button
                onClick={simpanAnalisis}
                disabled={sedangMenyimpan || !namaSimpan.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {sedangMenyimpan ? '⏳ Menyimpan...' : '✅ Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN MAP */}
      <div className={`fixed inset-0 bg-white dark:bg-slate-900 ${modeBersih ? 'top-0' : 'top-16'}`}>
        {!petaSedangMemuat && KontainerPeta && (
          <KontainerPeta
            center={PUSAT_DEFAULT}
            zoom={ZOOM_DEFAULT}
            className="h-full w-full z-0"
            zoomControl={false}
            ref={petaRef}
          >
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
                  const analisis = fitur.properties?.ekonomi_analysis || {};
                  let terlihat = true;
                  if (kategoriTerpilih !== 'SEMUA' && analisis.kategori !== kategoriTerpilih) terlihat = false;
                  if (indikatorTerpilih !== 'SEMUA') {
                    const nilai = analisis.data_ekonomi?.[indikatorTerpilih];
                    if (nilai === null || nilai === undefined) terlihat = false;
                  }
                  const warna = hitungWarnaIndikator(fitur);
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
                  const analisis = fitur.properties?.ekonomi_analysis || {};
                  const dataEkonomi = analisis.data_ekonomi || {};
                  const wawasan = analisis.insights?.map(i => `<div style="margin-bottom:3px; padding-left:6px; border-left:2px solid ${analisis.warna}; font-weight: 600; font-size: 9px;">${i}</div>`).join('') || '';
                  const warna = hitungWarnaIndikator(fitur);

                  lapisan.bindTooltip(`
                    <div style="font-family: inherit; padding: 4px;">
                      <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">${analisis.nama_provinsi}</div>
                      <div style="font-size: 9px; font-weight: 800; color: ${warna}; margin-top:2px;">KATEGORI: ${analisis.kategori}</div>
                      <div style="font-size: 8px; font-weight: 700; color: #64748b; margin-top:2px;">Indeks: ${analisis.ekonomi_index}</div>
                    </div>
                  `, { sticky: true, opacity: 0.95 });

                  let indikatorHTML = '';
                  if (indikatorTerpilih === 'SEMUA') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #f59e0b;">
                        <div style="font-size: 7px; font-weight: 900; color: #92400e; text-transform: uppercase; margin-bottom: 1px;">💹 PDRB</div>
                        <div style="font-size: 11px; font-weight: 900; color: #b45309;">Rp${dataEkonomi.PDRB ? (dataEkonomi.PDRB / 1000).toFixed(1) : '-'} T</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #3b82f6;">
                        <div style="font-size: 7px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin-bottom: 1px;">👥 KEMISKINAN</div>
                        <div style="font-size: 11px; font-weight: 900; color: #1e40af;">${dataEkonomi.KEMISKINAN ? dataEkonomi.KEMISKINAN.toFixed(2) + '%' : '-'}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #6366f1;">
                        <div style="font-size: 7px; font-weight: 900; color: #312e81; text-transform: uppercase; margin-bottom: 1px;">💰 INVESTASI</div>
                        <div style="font-size: 11px; font-weight: 900; color: #3730a3;">Rp${dataEkonomi.INVESTASI ? (dataEkonomi.INVESTASI / 1000).toFixed(2) : '-'} T</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'PDRB') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                        <div style="font-size: 8px; font-weight: 900; color: #92400e; text-transform: uppercase; margin-bottom: 2px;">💹 PDRB</div>
                        <div style="font-size: 16px; font-weight: 900; color: #b45309;">Rp${dataEkonomi.PDRB ? (dataEkonomi.PDRB / 1000).toFixed(2) : '-'} T</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'KEMISKINAN') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <div style="font-size: 8px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin-bottom: 2px;">👥 Kemiskinan</div>
                        <div style="font-size: 16px; font-weight: 900; color: #1e40af;">${dataEkonomi.KEMISKINAN ? dataEkonomi.KEMISKINAN.toFixed(2) + '%' : '-'}</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'INVESTASI') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #6366f1;">
                        <div style="font-size: 8px; font-weight: 900; color: #312e81; text-transform: uppercase; margin-bottom: 2px;">💰 Investasi</div>
                        <div style="font-size: 16px; font-weight: 900; color: #3730a3;">Rp${dataEkonomi.INVESTASI ? (dataEkonomi.INVESTASI / 1000).toFixed(2) : '-'} T</div>
                      </div>
                    `;
                  }

                  const isiPopup = `
                    <div style="font-family: inherit; min-width: 300px; max-width: 300px; color: #1e293b; padding: 4px;">
                      <div style="background: linear-gradient(135deg, ${warna} 0%, ${warna}dd 100%); color: white; padding: 8px; border-radius: 8px; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-weight: 900; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">${analisis.nama_provinsi}</div>
                        <div style="background: rgba(255,255,255,0.2); border-radius: 5px; padding: 5px; margin-top: 5px;">
                          <div style="font-size: 7px; font-weight: 800; opacity: 0.9; text-transform: uppercase; margin-bottom: 2px;">INDEKS EKONOMI</div>
                          <div style="background: rgba(255,255,255,0.3); height: 12px; border-radius: 6px; overflow: hidden; position: relative;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to right, #ef4444 0%, #ef4444 33%, #f59e0b 33%, #f59e0b 66%, #10b981 66%, #10b981 100%);"></div>
                            <div style="position: absolute; top: 50%; transform: translateY(-50%); left: ${((analisis.ekonomi_index - 1) / 2) * 100}%; width: 2px; height: 16px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
                          </div>
                          <div style="text-align: center; margin-top: 3px; font-size: 10px; font-weight: 900;">IEK: ${analisis.ekonomi_index} / 3.0</div>
                        </div>
                      </div>
                      <div style="padding: 0 2px;">
                        <div style="text-align: center; margin-bottom: 6px;">
                          <span style="background: ${warna}; color: white; padding: 4px 12px; border-radius: 10px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            ${analisis.kategori}
                          </span>
                        </div>
                        <div style="font-size: 7px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px;">📊 INDIKATOR</div>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 8px;">
                          ${indikatorHTML}
                        </div>
                        <div style="font-size: 7px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">💡 WAWASAN</div>
                        <div style="font-size: 9px; color: #334155; line-height: 1.4; background: #f8fafc; padding: 6px; border-radius: 5px; border-left: 2px solid ${warna};">${wawasan}</div>
                      </div>
                    </div>
                  `;
                  lapisan.bindPopup(isiPopup, { maxWidth: 320, maxHeight: 420 });
                }}
              />
            )}
          </KontainerPeta>
        )}

        {/* TITLE */}
        {!modeBersih && (
          <div className="absolute top-6 left-6 z-[1000] bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 px-5 py-3 rounded-xl shadow-xl">
            <div className="text-sm font-black text-white uppercase tracking-wider">
              💼 Analisis Ekonomi Daerah
            </div>
          </div>
        )}

        {/* ZOOM */}
        {!modeBersih && (
          <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2">
            <button onClick={() => petaRef.current?.zoomIn()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
              <Plus size={16} />
            </button>
            <button onClick={() => petaRef.current?.zoomOut()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
              <Minus size={16} />
            </button>
          </div>
        )}

        {/* CLEAN VIEW */}
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
                  <button onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); setProvinsiDipilih(null); }} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">
                    <X size={16} />
                  </button>
                </div>
                {searchSuggestions.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                    {searchSuggestions.map((sug, idx) => (
                      <button key={idx} onClick={() => handleSearch(sug.nama)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{sug.nama}</span>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: sug.warna + '20', color: sug.warna }}>{sug.kategori}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchTerbuka(true)} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
                <Search size={16} />
              </button>
            )}
          </div>
        )}

        {/* KOORDINAT, LEGEND, FILTER - RIGHT TOP */}
        {!modeBersih && (
          <div className="absolute top-6 right-6 z-[1000] space-y-2">
            {/* KOORDINAT */}
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="text-blue-600 dark:text-blue-400">Lat:</span> {koordinatCursor.lat} | <span className="text-blue-600 dark:text-blue-400">Lng:</span> {koordinatCursor.lng}
              </div>
            </div>

            {/* SCALE */}
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

            {/* FILTER */}
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
                    {["SEMUA", "MAJU", "BERKEMBANG", "TERTINGGAL"].map(kat => (
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

        {/* BOTTOM BUTTONS */}
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

                {/* DROPDOWN */}
                {menuPilihanIndikatorTerbuka && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1003] overflow-hidden border border-slate-200 dark:border-slate-700">
                    <button onClick={() => jalankanAnalisisBPS('ALL')} className="w-full text-left px-4 py-3 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      📊 Semua Indikator
                    </button>
                    <button onClick={() => jalankanAnalisisBPS('PDRB')} className="w-full text-left px-4 py-3 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
                      💹 PDRB Saja
                    </button>
                    <button onClick={() => jalankanAnalisisBPS('KEMISKINAN')} className="w-full text-left px-4 py-3 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      👥 Kemiskinan Saja
                    </button>
                    <button onClick={() => jalankanAnalisisBPS('INVESTASI')} className="w-full text-left px-4 py-3 text-[10px] font-bold transition-all text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                      💰 Investasi Saja
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

        {/* PANELS */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute bottom-0 left-0 right-0 z-[1001]">

            {/* INFO PANEL */}
            <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-2xl ${panelInfoTerbuka ? 'h-[340px] overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Activity className="text-blue-500" size={24} />
                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Ringkasan Analisis Ekonomi
                    </h2>
                  </div>
                  <button onClick={() => setPanelInfoTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                  Analisis data ekonomi nasional menggunakan BPS Web API — Indikator: {indikatorTerpilih} | Total: {hasilAnalisis.total_success} provinsi
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Total Provinsi</div>
                    <div className="text-xl font-black text-blue-700 dark:text-blue-300">{hasilAnalisis.total_success}</div>
                    <div className="text-[9px] text-blue-500 mt-1">Teranalisis</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                    <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Tertinggal</div>
                    <div className="text-xl font-black text-red-700 dark:text-red-300">{jumlahKategori.TERTINGGAL}</div>
                    <div className="text-[9px] text-red-500 mt-1">Perlu Percepatan</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 border border-yellow-200 dark:border-yellow-800">
                    <div className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-1">Berkembang</div>
                    <div className="text-xl font-black text-yellow-700 dark:text-yellow-300">{jumlahKategori.BERKEMBANG}</div>
                    <div className="text-[9px] text-yellow-500 mt-1">Menuju Maju</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                    <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Maju</div>
                    <div className="text-xl font-black text-green-700 dark:text-green-300">{jumlahKategori.MAJU}</div>
                    <div className="text-[9px] text-green-500 mt-1">Berkembang Pesat</div>
                  </div>
                </div>

                {/* Best & Worst */}
                {hasilAnalisis.best_provinces?.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">🏆 5 Ekonomi Terkuat</div>
                      {hasilAnalisis.best_provinces.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{idx + 1}. {p.provinsi}</span>
                          <span className="text-[10px] font-black text-green-600 dark:text-green-400">IEK: {p.ekonomi_index}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">⚠️ 5 Perlu Percepatan</div>
                      {hasilAnalisis.worst_provinces.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{idx + 1}. {p.provinsi}</span>
                          <span className="text-[10px] font-black text-red-600 dark:text-red-400">IEK: {p.ekonomi_index}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TABEL PANEL */}
            <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-2xl ${panelTabelTerbuka ? 'h-[340px] overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Matriks Ekonomi Daerah</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">
                      {dataTerfilter.length} Wilayah | Indikator: {indikatorTerpilih}
                    </p>
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
                        <th className="px-3 py-2 text-center">Indeks</th>
                        {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'PDRB') && (
                          <th className="px-3 py-2 text-center">PDRB</th>
                        )}
                        {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KEMISKINAN') && (
                          <th className="px-3 py-2 text-center">Kemiskinan</th>
                        )}
                        {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'INVESTASI') && (
                          <th className="px-3 py-2 text-center">Investasi</th>
                        )}
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dataTerfilter.map((fitur, indeks) => {
                        const data = fitur.properties.ekonomi_analysis;
                        const dataEkonomi = data.data_ekonomi || {};
                        const warna = hitungWarnaIndikator(fitur);
                        return (
                          <tr key={indeks} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                            <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{indeks + 1}</td>
                            <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">{data.ekonomi_index}</span>
                            </td>
                            {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'PDRB') && (
                              <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                Rp{dataEkonomi.PDRB ? (dataEkonomi.PDRB / 1000).toFixed(1) : '-'} T
                              </td>
                            )}
                            {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KEMISKINAN') && (
                              <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                {dataEkonomi.KEMISKINAN ? dataEkonomi.KEMISKINAN.toFixed(2) + '%' : '-'}
                              </td>
                            )}
                            {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'INVESTASI') && (
                              <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                Rp{dataEkonomi.INVESTASI ? (dataEkonomi.INVESTASI / 1000).toFixed(2) : '-'} T
                              </td>
                            )}
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna + '40', color: warna }}>
                                {data.kategori}
                              </span>
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
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Rekomendasi Kebijakan Ekonomi</h3>
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
                        <th className="px-3 py-2">Kategori</th>
                        <th className="px-3 py-2">Prioritas</th>
                        <th className="px-3 py-2">Rekomendasi Utama</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dataTerfilter.map((fitur, indeks) => {
                        const data = fitur.properties.ekonomi_analysis;
                        const rekUtama = data.rekomendasi?.[0];
                        const warna = hitungWarnaIndikator(fitur);
                        return (
                          <tr key={indeks} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                            <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{indeks + 1}</td>
                            <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna + '40', color: warna }}>
                                {data.kategori}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                data.kategori === 'TERTINGGAL' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                data.kategori === 'BERKEMBANG' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              }`}>
                                {rekUtama?.priority || (data.kategori === 'MAJU' ? 'PEMELIHARAAN' : data.kategori === 'BERKEMBANG' ? 'TINGGI' : 'DARURAT')}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-md">
                              <ul className="space-y-1 text-[10px]">
                                {rekUtama?.actions?.slice(0, 3).map((action, idx) => (
                                  <li key={idx} className="text-slate-600 dark:text-slate-300 font-medium">• {action.aksi || action}</li>
                                )) || <li className="text-slate-400">Pertahankan dan tingkatkan pertumbuhan ekonomi</li>}
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

            {/* METODOLOGI PANEL - LENGKAP DENGAN RUMUS */}
            <div className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-2xl ${panelMetodologiTerbuka ? 'h-[340px] overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    📚 Metodologi Perhitungan IEK
                  </h3>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        onClick={() => { setMenuDatasetTerbuka(!menuDatasetTerbuka); }}
                        className="px-3 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        <Download size={12} /> Dataset
                      </button>
                      {menuDatasetTerbuka && (
                        <div className="absolute top-full mt-2 right-0 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                          <button onClick={() => unduhDataset('ALL')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                            <Database size={14} className="inline mr-2 text-purple-600" /> Semua Dataset
                          </button>
                          <button onClick={() => unduhDataset('PDRB')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                            💹 Dataset PDRB
                          </button>
                          <button onClick={() => unduhDataset('KEMISKINAN')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                            👥 Dataset Kemiskinan
                          </button>
                          <button onClick={() => unduhDataset('INVESTASI')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                            💰 Dataset Investasi
                          </button>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setPanelMetodologiTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <X size={18} className="text-slate-500" />
                    </button>
                  </div>
                </div>

                {/* FORMULA UTAMA */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-black text-blue-900 dark:text-blue-100 mb-3 uppercase">📐 Formula Indeks Ekonomi Komposit (IEK)</h4>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-blue-300 dark:border-blue-700 mb-3">
                    <code className="text-xs font-mono font-bold text-slate-900 dark:text-white break-words">
                      IEK = (Skor_PDRB × 0.40) + (Skor_Kemiskinan × 0.40) + (Skor_Investasi × 0.20)
                    </code>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Hasil IEK berkisar 1.0 (terendah) sampai 3.0 (tertinggi)</p>
                </div>

                {/* CARA HITUNG PDRB */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border-l-4 border-yellow-500">
                  <h5 className="text-sm font-black text-yellow-900 dark:text-yellow-100 uppercase mb-2">💹 Cara Hitung PDRB</h5>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-yellow-300 dark:border-yellow-700 mb-2">
                    <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 mb-1">Threshold Scoring:</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white space-y-1">
                      <div>✓ Jika PDRB &gt; Rp75 miliar → <span className="text-green-600">Skor 3 (MAJU)</span></div>
                      <div>◐ Jika PDRB 50-75 miliar → <span className="text-yellow-600">Skor 2 (BERKEMBANG)</span></div>
                      <div>✗ Jika PDRB &lt; Rp50 miliar → <span className="text-red-600">Skor 1 (TERTINGGAL)</span></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-yellow-700 dark:text-yellow-300">Kontribusi ke IEK = Skor_PDRB × 0.40</p>
                </div>

                {/* CARA HITUNG KEMISKINAN */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                  <h5 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase mb-2">👥 Cara Hitung Kemiskinan (REVERSE)</h5>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-300 dark:border-blue-700 mb-2">
                    <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 mb-1">Threshold Scoring:</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white space-y-1">
                      <div>✓ Jika Kemiskinan &lt; 7% → <span className="text-green-600">Skor 3 (MAJU)</span></div>
                      <div>◐ Jika Kemiskinan 7-12% → <span className="text-yellow-600">Skor 2 (BERKEMBANG)</span></div>
                      <div>✗ Jika Kemiskinan &gt; 12% → <span className="text-red-600">Skor 1 (TERTINGGAL)</span></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-700 dark:text-blue-300"><strong>Catatan REVERSE:</strong> Semakin rendah kemiskinan semakin baik (berbeda dengan PDRB)</p>
                </div>

                {/* CARA HITUNG INVESTASI */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border-l-4 border-indigo-500">
                  <h5 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase mb-2">💰 Cara Hitung Investasi</h5>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-indigo-300 dark:border-indigo-700 mb-2">
                    <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 mb-1">Threshold Scoring:</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white space-y-1">
                      <div>✓ Jika Investasi &gt; Rp10 triliun → <span className="text-green-600">Skor 3 (MAJU)</span></div>
                      <div>◐ Jika Investasi 5-10 triliun → <span className="text-yellow-600">Skor 2 (BERKEMBANG)</span></div>
                      <div>✗ Jika Investasi &lt; Rp5 triliun → <span className="text-red-600">Skor 1 (TERTINGGAL)</span></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300">Kontribusi ke IEK = Skor_Investasi × 0.20</p>
                </div>

                {/* KATEGORI HASIL */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                  <h4 className="text-sm font-black text-green-900 dark:text-green-100 uppercase mb-3">🎯 Kategori Hasil IEK</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2 border-2 border-green-200 dark:border-green-700">
                      <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">MAJU</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">IEK ≥ 2.4</div>
                      <div className="text-[9px] text-green-600 dark:text-green-400">✓ Baik</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2 border-2 border-yellow-200 dark:border-yellow-700">
                      <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase">BERKEMBANG</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">1.8-2.4</div>
                      <div className="text-[9px] text-yellow-600 dark:text-yellow-400">◐ Sedang</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2 border-2 border-red-200 dark:border-red-700">
                      <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">TERTINGGAL</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">IEK &lt; 1.8</div>
                      <div className="text-[9px] text-red-600 dark:text-red-400">✗ Rendah</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CONTROL BUTTONS */}
            <div className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 p-3 shadow-2xl">
              <div className="flex justify-center gap-2 flex-wrap">
                <button
                  onClick={() => { setPanelInfoTerbuka(!panelInfoTerbuka); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelInfoTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <Info size={14} /> Info
                </button>

                <button
                  onClick={() => { setPanelTabelTerbuka(!panelTabelTerbuka); setPanelInfoTerbuka(false); setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelTabelTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <Table size={14} /> Tabel
                </button>

                <button
                  onClick={() => { setPanelKebijakanTerbuka(!panelKebijakanTerbuka); setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelMetodologiTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelKebijakanTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <ClipboardList size={14} /> Kebijakan
                </button>

                <button
                  onClick={() => { setPanelMetodologiTerbuka(!panelMetodologiTerbuka); setPanelInfoTerbuka(false); setPanelTabelTerbuka(false); setPanelKebijakanTerbuka(false); }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelMetodologiTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <FileText size={14} /> Metodologi
                </button>

                {adaPanelTerbuka && (
                  <button
                    onClick={toggleAllPanels}
                    className="px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                  >
                    <ChevronDown size={14} /> Tutup
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