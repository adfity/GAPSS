"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Play, Download, AlertCircle, Plus, Minus, ChevronDown, Filter, Save, X, Activity, RotateCcw, Database, ChevronUp, Info, Table, FileText, ClipboardList, Search, Eye, EyeOff, Map
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";

// Konfigurasi Kategori Ekonomi
const KATEGORI = {
  MAJU: { warna: "#10b981", label: "MAJU", status: "BERKEMBANG PESAT" },
  BERKEMBANG: { warna: "#f59e0b", label: "BERKEMBANG", status: "MENUJU MAJU" },
  TERTINGGAL: { warna: "#ef4444", label: "TERTINGGAL", status: "PERLU PERCEPATAN" }
};

// Konfigurasi Basemap
const BASEMAPS = {
  CARTO_LIGHT: {
    label: "Carto Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    preview: "bg-slate-100"
  },
  CARTO_DARK: {
    label: "Carto Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    preview: "bg-slate-800"
  },
  OSM: {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    preview: "bg-green-100"
  },
  ESRI_SATELLITE: {
    label: "Satelit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri',
    preview: "bg-stone-700"
  },
  TOPO: {
    label: "Topografi",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    preview: "bg-amber-100"
  },
  CARTO_VOYAGER: {
    label: "Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    preview: "bg-blue-50"
  }
};

const PUSAT_DEFAULT = [-2.5, 118];
const ZOOM_DEFAULT = 5;
const PANEL_HEIGHT_DEFAULT = 340;
const PANEL_HEIGHT_MIN = 48;
const PANEL_HEIGHT_MAX = 520;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: warna & kategori berdasarkan indikator
// ─────────────────────────────────────────────────────────────────────────────
function getWarnaByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') {
    return fitur.properties?.ekonomi_analysis?.warna || "#cbd5e1";
  }
  const nilai = fitur.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih];
  if (nilai === null || nilai === undefined) return "#cbd5e1";
  if (indikatorTerpilih === 'PDRB') {
    return nilai > 75000 ? KATEGORI.MAJU.warna : nilai > 50000 ? KATEGORI.BERKEMBANG.warna : KATEGORI.TERTINGGAL.warna;
  }
  if (indikatorTerpilih === 'KEMISKINAN') {
    return nilai < 7 ? KATEGORI.MAJU.warna : nilai < 12 ? KATEGORI.BERKEMBANG.warna : KATEGORI.TERTINGGAL.warna;
  }
  if (indikatorTerpilih === 'INVESTASI') {
    return nilai > 10000 ? KATEGORI.MAJU.warna : nilai > 5000 ? KATEGORI.BERKEMBANG.warna : KATEGORI.TERTINGGAL.warna;
  }
  return fitur.properties?.ekonomi_analysis?.warna || "#cbd5e1";
}

function getKategoriByIndikator(fitur, indikatorTerpilih) {
  if (indikatorTerpilih === 'SEMUA') {
    return fitur.properties?.ekonomi_analysis?.kategori || null;
  }
  const nilai = fitur.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih];
  if (nilai === null || nilai === undefined) return null;
  if (indikatorTerpilih === 'PDRB') {
    return nilai > 75000 ? 'MAJU' : nilai > 50000 ? 'BERKEMBANG' : 'TERTINGGAL';
  }
  if (indikatorTerpilih === 'KEMISKINAN') {
    return nilai < 7 ? 'MAJU' : nilai < 12 ? 'BERKEMBANG' : 'TERTINGGAL';
  }
  if (indikatorTerpilih === 'INVESTASI') {
    return nilai > 10000 ? 'MAJU' : nilai > 5000 ? 'BERKEMBANG' : 'TERTINGGAL';
  }
  return fitur.properties?.ekonomi_analysis?.kategori || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: ambil label prioritas dari struktur rekomendasi baru
// Struktur baru: rekomendasi = [{kategori, prioritas, jumlah_aksi, aksi:[{nama_aksi, detail_aksi,...}]}]
// ─────────────────────────────────────────────────────────────────────────────
function getPrioritasLabel(kategoriAktif, rekomendasi) {
  if (rekomendasi && rekomendasi.length > 0) {
    return rekomendasi[0].prioritas || '-';
  }
  if (kategoriAktif === 'MAJU') return 'PEMELIHARAAN';
  if (kategoriAktif === 'BERKEMBANG') return 'TINGGI';
  return 'DARURAT';
}

function getAksiUtama(rekomendasi) {
  // Ambil 3 aksi pertama dari kelompok rekomendasi pertama
  if (!rekomendasi || rekomendasi.length === 0) return [];
  const kelompokPertama = rekomendasi[0];
  if (!kelompokPertama?.aksi || kelompokPertama.aksi.length === 0) return [];
  return kelompokPertama.aksi.slice(0, 3);
}

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
  const [menuBasemapTerbuka, setMenuBasemapTerbuka] = useState(false);
  const [basemapTerpilih, setBasemapTerpilih] = useState('CARTO_LIGHT');
  
  const [panelInfoTerbuka, setPanelInfoTerbuka] = useState(false);
  const [panelTabelTerbuka, setPanelTabelTerbuka] = useState(false);
  const [panelMetodologiTerbuka, setPanelMetodologiTerbuka] = useState(false);
  const [panelKebijakanTerbuka, setPanelKebijakanTerbuka] = useState(false);

  // State untuk detail kebijakan per provinsi
  const [provinsiKebijakanDipilih, setProvinsiKebijakanDipilih] = useState(null);

  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(null);
  const dragStartHeight = useRef(null);
  const panelRef = useRef(null);

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

  // ─── Drag handler ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e) => {
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = panelHeight;
    setIsDragging(true);
  }, [panelHeight]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging || dragStartY.current === null) return;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const delta = dragStartY.current - clientY;
    const newHeight = Math.max(PANEL_HEIGHT_MIN, Math.min(PANEL_HEIGHT_MAX, dragStartHeight.current + delta));
    setPanelHeight(newHeight);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartY.current = null;
    if (panelHeight < 100) {
      setPanelInfoTerbuka(false);
      setPanelTabelTerbuka(false);
      setPanelMetodologiTerbuka(false);
      setPanelKebijakanTerbuka(false);
    }
  }, [isDragging, panelHeight]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const bukaPanel = (setter) => {
    setPanelInfoTerbuka(false);
    setPanelTabelTerbuka(false);
    setPanelMetodologiTerbuka(false);
    setPanelKebijakanTerbuka(false);
    setter(true);
    if (panelHeight < 200) setPanelHeight(PANEL_HEIGHT_DEFAULT);
  };

  const hitungScaleKm = (zoom) => {
    const scales = { 5: 1000, 6: 500, 7: 200, 8: 100, 9: 50, 10: 25 };
    return scales[Math.floor(zoom)] || scales[5];
  };

  const MouseTracker = () => {
    if (!useMapEvents) return null;
    const MapEventsComponent = () => {
      useMapEvents({
        mousemove: (e) => setKoordinatCursor({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) }),
        zoomend: (e) => setCurrentZoom(e.target.getZoom())
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
      f.properties?.ekonomi_analysis?.nama_provinsi?.toLowerCase() === provinsiNama.toLowerCase()
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
    setKategoriTerpilih('SEMUA');
    setProvinsiKebijakanDipilih(null);
    const petunjukMemuat = toast.loading(`Mengambil data dari BPS Web API...`);
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
        toast.success(`Berhasil menganalisis ${respons.data.total_success} provinsi dari BPS!`, { duration: 5000 });
      }
    } catch (galat) {
      toast.dismiss(petunjukMemuat);
      toast.error(galat.response?.data?.error || 'Gagal terhubung ke server.');
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
    setProvinsiKebijakanDipilih(null);
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
      const respons = await axios.post('http://127.0.0.1:8000/api/save-ekonomi-analysis/', {
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
    } finally {
      setSedangMenyimpan(false);
    }
  };

  const unduhDataset = (jenisDataset) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error("Dataset tidak tersedia");
    const datasets = hasilAnalisis.raw_datasets;
    const indikatorInfo = hasilAnalisis.indikator_info;
    setMenuDatasetTerbuka(false);
    if (jenisDataset === 'ALL') {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(datasets.PDRB || {}).map(([p, v]) => ({ 'Provinsi': p, 'PDRB (Milyar Rp)': v }))), "PDRB");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(datasets.KEMISKINAN || {}).map(([p, v]) => ({ 'Provinsi': p, 'Kemiskinan (%)': v }))), "Kemiskinan");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(datasets.INVESTASI || {}).map(([p, v]) => ({ 'Provinsi': p, 'Investasi PMDN (Milyar Rp)': v }))), "Investasi");
      XLSX.writeFile(wb, "TERASEG_Semua_Dataset_Ekonomi_BPS.xlsx");
      toast.success('Semua dataset berhasil diunduh!');
    } else {
      const dataset = datasets[jenisDataset] || {};
      const info = indikatorInfo?.[jenisDataset];
      const dataArray = Object.entries(dataset).map(([p, v]) => ({ 'Provinsi': p, [`${info?.nama || jenisDataset} (${info?.satuan || ''})`]: v }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataArray), jenisDataset);
      XLSX.writeFile(wb, `TERASEG_Dataset_${jenisDataset}_BPS.xlsx`);
      toast.success(`Dataset ${info?.nama || jenisDataset} berhasil diunduh!`);
    }
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error("Data tidak tersedia");
    const ringkasan = hasilAnalisis.analysis_summary;
    setMenuUnduhTerbuka(false);
    if (format === 'EXCEL') {
      const dataExport = ringkasan.map(item => ({
        'Provinsi': item.provinsi, 'Kategori': item.kategori, 'Indeks Ekonomi': item.ekonomi_index,
        'PDRB (Milyar Rp)': item.pdrb || '-', 'Kemiskinan (%)': item.kemiskinan || '-', 'Investasi PMDN (Milyar Rp)': item.investasi || '-'
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataExport), "Analisis Ekonomi BPS");
      XLSX.writeFile(wb, "TERASEG_Ekonomi_BPS.xlsx");
      toast.success('File Excel berhasil diunduh');
    } else if (format === 'JSON') {
      unduhBerkas(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }), 'TERASEG_Ekonomi_BPS.json');
      toast.success('File JSON berhasil diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ["Provinsi", "Kategori", "Indeks Ekonomi", "PDRB", "Kemiskinan", "Investasi"].join(","),
        ...ringkasan.map(s => [s.provinsi, s.kategori, s.ekonomi_index, s.pdrb || '-', s.kemiskinan || '-', s.investasi || '-'].join(","))
      ].join("\n");
      unduhBerkas(new Blob([csv], { type: 'text/csv' }), 'TERASEG_Ekonomi_BPS.csv');
      toast.success('File CSV berhasil diunduh');
    } else if (format === 'GEOJSON') {
      unduhBerkas(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' }), 'TERASEG_Spasial_Ekonomi.geojson');
      toast.success('File GeoJSON berhasil diunduh');
    }
  };

  const unduhBerkas = (gumpalan, namaBerkas) => {
    const url = URL.createObjectURL(gumpalan);
    const a = document.createElement('a');
    a.href = url; a.download = namaBerkas; a.click();
    URL.revokeObjectURL(url);
  };

  const ambilDataTabelTerfilter = () => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let fitur = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => getKategoriByIndikator(f, indikatorTerpilih) === kategoriTerpilih);
    }
    if (indikatorTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => {
        const nilai = f.properties?.ekonomi_analysis?.data_ekonomi?.[indikatorTerpilih];
        return nilai !== null && nilai !== undefined;
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
      TERTINGGAL: features.filter(f => getKategoriByIndikator(f, indikatorTerpilih) === 'TERTINGGAL').length,
      BERKEMBANG: features.filter(f => getKategoriByIndikator(f, indikatorTerpilih) === 'BERKEMBANG').length,
      MAJU: features.filter(f => getKategoriByIndikator(f, indikatorTerpilih) === 'MAJU').length
    };
  };

  const jumlahKategori = hitungKategori();
  const toggleAllPanels = () => {
    setPanelInfoTerbuka(false); setPanelTabelTerbuka(false);
    setPanelMetodologiTerbuka(false); setPanelKebijakanTerbuka(false);
  };

  const getWarnaIndikator = () => {
    if (indikatorTerpilih === 'SEMUA') return 'linear-gradient(135deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)';
    if (indikatorTerpilih === 'PDRB') return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    if (indikatorTerpilih === 'KEMISKINAN') return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    if (indikatorTerpilih === 'INVESTASI') return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
    return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
  };

  const bottomPanelEffectiveHeight = adaPanelTerbuka ? panelHeight : 48;
  const actionButtonBottom = bottomPanelEffectiveHeight + 16;

  if (!adalahClient) return null;
  const basemapConfig = BASEMAPS[basemapTerpilih];

  // ─── DATA untuk panel kebijakan detail ────────────────────────────────────
  const fiturKebijakanDipilih = provinsiKebijakanDipilih
    ? hasilAnalisis?.matched_features?.features?.find(
        f => f.properties?.ekonomi_analysis?.nama_provinsi === provinsiKebijakanDipilih
      )
    : null;
  const rekomendasiDipilih = fiturKebijakanDipilih?.properties?.ekonomi_analysis?.rekomendasi || [];
  const kategoriApplied = fiturKebijakanDipilih?.properties?.ekonomi_analysis?.kategori_applied || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {!modeBersih && <HeaderBar />}
      {!modeBersih && <SideBar />}


      {/* ─── MODAL PILIHAN ANALISIS ─────────────────────────────────────────── */}
      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Pilih Data Analisis</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Pilih indikator yang ingin dianalisis untuk pemetaan ekonomi daerah Indonesia</p>
            <div className="space-y-3 mb-6">
              {[
                { key: 'ALL', label: '📊 Semua Indikator', desc: 'PDRB + Kemiskinan + Investasi — Analisis komprehensif ekonomi', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
                { key: 'PDRB', label: '💹 PDRB Saja', desc: 'Fokus output ekonomi daerah — PDRB Atas Dasar Harga Berlaku', border: 'border-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-500' },
                { key: 'KEMISKINAN', label: '👥 Kemiskinan Saja', desc: 'Fokus distribusi kesejahteraan — Persentase Penduduk Miskin', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
                { key: 'INVESTASI', label: '💰 Investasi Saja', desc: 'Fokus kepercayaan investor — Realisasi Investasi PMDN', border: 'border-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', dot: 'bg-indigo-500' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setPilihanIndikator(opt.key)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${pilihanIndikator === opt.key ? `${opt.border} ${opt.bg}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white uppercase">{opt.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</div>
                    </div>
                    {pilihanIndikator === opt.key && (
                      <div className={`w-5 h-5 rounded-full ${opt.dot} flex items-center justify-center`}>
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAnalisisTerbuka(false)} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Batal</button>
              <button onClick={() => jalankanAnalisisBPS()} disabled={sedangMenganalisis} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 transition-all">Mulai Analisis</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL SAVE ─────────────────────────────────────────────────────── */}
      {modalSaveTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Simpan Analisis</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Nama Analisis</label>
              <input type="text" value={namaSimpan} onChange={(e) => setNamaSimpan(e.target.value)} placeholder="contoh: Analisis Ekonomi Q1 2025"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && simpanAnalisis()} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalSaveTerbuka(false)} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={simpanAnalisis} disabled={sedangMenyimpan || !namaSimpan.trim()} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 transition-all">
                {sedangMenyimpan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DETAIL KEBIJAKAN PROVINSI ──────────────────────────────── */}
      {provinsiKebijakanDipilih && fiturKebijakanDipilih && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Header modal */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {fiturKebijakanDipilih.properties.ekonomi_analysis.nama_provinsi}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {kategoriApplied.map((kat, i) => {
                      const warnaMap = { MAJU: '#10b981', BERKEMBANG: '#f59e0b', TERTINGGAL: '#ef4444', PDRB_RENDAH: '#f59e0b', KEMISKINAN_TINGGI: '#ef4444', INVESTASI_RENDAH: '#6366f1' };
                      const w = warnaMap[kat] || '#64748b';
                      return (
                        <span key={i} className="px-2 py-1 rounded-lg text-[10px] font-black border-2"
                          style={{ borderColor: w + '40', color: w, backgroundColor: w + '10' }}>
                          {kat.replace('_', ' ')}
                        </span>
                      );
                    })}
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      IEK: {fiturKebijakanDipilih.properties.ekonomi_analysis.ekonomi_index}
                    </span>
                  </div>
                </div>
                <button onClick={() => setProvinsiKebijakanDipilih(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex-shrink-0">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body modal — scrollable */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {rekomendasiDipilih.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Belum ada data rekomendasi.</p>
                  <p className="text-xs mt-1">Pastikan migrasi bank kebijakan sudah dijalankan.</p>
                </div>
              ) : (
                rekomendasiDipilih.map((kelompok, ki) => {
                  const warnaKat = { MAJU: '#10b981', BERKEMBANG: '#f59e0b', TERTINGGAL: '#ef4444', PDRB_RENDAH: '#f59e0b', KEMISKINAN_TINGGI: '#ef4444', INVESTASI_RENDAH: '#6366f1' };
                  const wKat = warnaKat[kelompok.kategori] || '#64748b';
                  return (
                    <div key={ki} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                      {/* Header kelompok */}
                      <div className="px-4 py-3 flex items-center justify-between"
                        style={{ backgroundColor: wKat + '15', borderLeft: `4px solid ${wKat}` }}>
                        <div>
                          <div className="text-xs font-black uppercase tracking-wider" style={{ color: wKat }}>
                            {kelompok.kategori.replace('_', ' ')}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            {kelompok.jumlah_aksi} aksi tersedia
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-lg text-[10px] font-black text-white"
                          style={{ backgroundColor: wKat }}>
                          {kelompok.prioritas}
                        </span>
                      </div>

                      {/* List aksi */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {kelompok.aksi.map((aksi, ai) => (
                          <div key={ai} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[10px] font-black"
                                style={{ backgroundColor: wKat }}>
                                {aksi.no_aksi || ai + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-black text-slate-900 dark:text-white">{aksi.nama_aksi}</div>
                                {aksi.detail_aksi && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{aksi.detail_aksi}</div>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {aksi.timeline && (
                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold">
                                      ⏱ {aksi.timeline}
                                    </span>
                                  )}
                                  {aksi.budget_est && (
                                    <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md text-[10px] font-bold">
                                      💰 {aksi.budget_est}
                                    </span>
                                  )}
                                  {aksi.sub_sektor && (
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[10px] font-bold">
                                      {aksi.sub_sektor}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── PETA ─────────────────────────────────────────────────────────── */}
      <div className={`fixed inset-0 bg-white dark:bg-slate-900 ${modeBersih ? 'top-0' : 'top-16'}`}>
        {!petaSedangMemuat && KontainerPeta && (
          <KontainerPeta center={PUSAT_DEFAULT} zoom={ZOOM_DEFAULT} className="h-full w-full z-0" zoomControl={false} ref={petaRef}>
            <LapisanPeta key={basemapTerpilih} url={basemapConfig.url} attribution={basemapConfig.attribution} />
            <MouseTracker />
            {hasilAnalisis?.matched_features?.features && (
              <GeoJSON
                key={JSON.stringify(hasilAnalisis.matched_features.features) + kategoriTerpilih + indikatorTerpilih + provinsiDipilih}
                data={{ type: "FeatureCollection", features: hasilAnalisis.matched_features.features }}
                style={(fitur) => {
                  const analisis = fitur.properties?.ekonomi_analysis || {};
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);
                  const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                  let terlihat = true;
                  if (kategoriTerpilih !== 'SEMUA' && kategoriAktif !== kategoriTerpilih) terlihat = false;
                  if (warna === "#cbd5e1") terlihat = false;
                  const isHighlighted = provinsiDipilih === analisis.nama_provinsi;
                  return {
                    fillColor: warna, weight: isHighlighted ? 4 : 2, opacity: terlihat ? 1 : 0,
                    color: isHighlighted ? '#3b82f6' : 'white', fillOpacity: terlihat ? 0.75 : 0
                  };
                }}
                onEachFeature={(fitur, lapisan) => {
                  const analisis = fitur.properties?.ekonomi_analysis || {};
                  const dataEkonomi = analisis.data_ekonomi || {};
                  const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                  const kategoriAktif = getKategoriByIndikator(fitur, indikatorTerpilih);

                  lapisan.bindTooltip(`
                    <div style="font-family: inherit; padding: 4px;">
                      <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 11px;">${analisis.nama_provinsi}</div>
                      <div style="font-size: 9px; font-weight: 800; color: ${warna}; margin-top:2px;">STATUS: ${kategoriAktif || '-'}</div>
                      <div style="font-size: 8px; font-weight: 700; color: #64748b; margin-top:2px;">IEK: ${analisis.ekonomi_index}</div>
                    </div>
                  `, { sticky: true, opacity: 0.95 });

                  let indikatorHTML = '';
                  if (indikatorTerpilih === 'SEMUA') {
                    indikatorHTML = `
                      <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);padding:6px;border-radius:6px;border-left:2px solid #f59e0b;">
                        <div style="font-size:7px;font-weight:900;color:#92400e;text-transform:uppercase;margin-bottom:1px;">💹 PDRB</div>
                        <div style="font-size:11px;font-weight:900;color:#b45309;">Rp${dataEkonomi.PDRB ? (dataEkonomi.PDRB/1000).toFixed(1) : '-'} T</div>
                      </div>
                      <div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);padding:6px;border-radius:6px;border-left:2px solid #3b82f6;">
                        <div style="font-size:7px;font-weight:900;color:#1e3a8a;text-transform:uppercase;margin-bottom:1px;">👥 KEMISKINAN</div>
                        <div style="font-size:11px;font-weight:900;color:#1e40af;">${dataEkonomi.KEMISKINAN ? dataEkonomi.KEMISKINAN.toFixed(2)+'%' : '-'}</div>
                      </div>
                      <div style="background:linear-gradient(135deg,#ede9fe,#c4b5fd);padding:6px;border-radius:6px;border-left:2px solid #6366f1;">
                        <div style="font-size:7px;font-weight:900;color:#312e81;text-transform:uppercase;margin-bottom:1px;">💰 INVESTASI</div>
                        <div style="font-size:11px;font-weight:900;color:#3730a3;">Rp${dataEkonomi.INVESTASI ? (dataEkonomi.INVESTASI/1000).toFixed(2) : '-'} T</div>
                      </div>`;
                  } else if (indikatorTerpilih === 'PDRB') {
                    indikatorHTML = `<div style="background:linear-gradient(135deg,#fef3c7,#fde68a);padding:8px;border-radius:8px;border-left:3px solid #f59e0b;">
                      <div style="font-size:8px;font-weight:900;color:#92400e;text-transform:uppercase;margin-bottom:2px;">💹 PDRB</div>
                      <div style="font-size:16px;font-weight:900;color:#b45309;">Rp${dataEkonomi.PDRB ? (dataEkonomi.PDRB/1000).toFixed(2) : '-'} T</div></div>`;
                  } else if (indikatorTerpilih === 'KEMISKINAN') {
                    indikatorHTML = `<div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);padding:8px;border-radius:8px;border-left:3px solid #3b82f6;">
                      <div style="font-size:8px;font-weight:900;color:#1e3a8a;text-transform:uppercase;margin-bottom:2px;">👥 Kemiskinan</div>
                      <div style="font-size:16px;font-weight:900;color:#1e40af;">${dataEkonomi.KEMISKINAN ? dataEkonomi.KEMISKINAN.toFixed(2)+'%' : '-'}</div></div>`;
                  } else if (indikatorTerpilih === 'INVESTASI') {
                    indikatorHTML = `<div style="background:linear-gradient(135deg,#ede9fe,#c4b5fd);padding:8px;border-radius:8px;border-left:3px solid #6366f1;">
                      <div style="font-size:8px;font-weight:900;color:#312e81;text-transform:uppercase;margin-bottom:2px;">💰 Investasi</div>
                      <div style="font-size:16px;font-weight:900;color:#3730a3;">Rp${dataEkonomi.INVESTASI ? (dataEkonomi.INVESTASI/1000).toFixed(2) : '-'} T</div></div>`;
                  }

                  const wawasan = analisis.insights?.map(i => `<div style="margin-bottom:3px;padding-left:6px;border-left:2px solid ${warna};font-weight:600;font-size:9px;">${i}</div>`).join('') || '';
                  lapisan.bindPopup(`
                    <div style="font-family:inherit;min-width:280px;max-width:280px;color:#1e293b;padding:4px;">
                      <div style="background:linear-gradient(135deg,${warna},${warna}dd);color:white;padding:8px;border-radius:8px;margin-bottom:6px;">
                        <div style="font-weight:900;font-size:12px;text-transform:uppercase;">${analisis.nama_provinsi}</div>
                        <div style="background:rgba(255,255,255,0.2);border-radius:5px;padding:5px;margin-top:5px;">
                          <div style="font-size:7px;font-weight:800;opacity:.9;text-transform:uppercase;margin-bottom:2px;">INDEKS EKONOMI</div>
                          <div style="background:rgba(255,255,255,0.3);height:12px;border-radius:6px;overflow:hidden;position:relative;">
                            <div style="position:absolute;inset:0;background:linear-gradient(to right,#ef4444 0%,#ef4444 33%,#f59e0b 33%,#f59e0b 66%,#10b981 66%,#10b981 100%);"></div>
                            <div style="position:absolute;top:50%;transform:translateY(-50%);left:${((analisis.ekonomi_index-1)/2)*100}%;width:2px;height:16px;background:white;box-shadow:0 1px 3px rgba(0,0,0,.3);"></div>
                          </div>
                          <div style="text-align:center;margin-top:3px;font-size:10px;font-weight:900;">IEK: ${analisis.ekonomi_index} / 3.0</div>
                        </div>
                      </div>
                      <div style="padding:0 2px;">
                        <div style="text-align:center;margin-bottom:6px;">
                          <span style="background:${warna};color:white;padding:4px 12px;border-radius:10px;font-size:8px;font-weight:900;text-transform:uppercase;">${kategoriAktif || '-'}</span>
                        </div>
                        <div style="font-size:7px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:5px;border-bottom:1px solid #f1f5f9;padding-bottom:3px;">📊 INDIKATOR</div>
                        <div style="display:grid;grid-template-columns:1fr;gap:4px;margin-bottom:8px;">${indikatorHTML}</div>
                        <div style="font-size:7px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #f1f5f9;padding-bottom:2px;">💡 WAWASAN</div>
                        <div style="font-size:9px;color:#334155;line-height:1.4;background:#f8fafc;padding:6px;border-radius:5px;border-left:2px solid ${warna};">${wawasan}</div>
                      </div>
                    </div>
                  `, { maxWidth: 300, maxHeight: 400 });
                }}
              />
            )}
          </KontainerPeta>
        )}

        {/* ─── JUDUL ──────────────────────────────────────────────────────── */}
        {!modeBersih && (
          <div className="absolute top-6 left-6 z-[1000] bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 rounded-xl shadow-xl">
            <div className="text-sm font-black text-white uppercase tracking-wider">💼 SDM Nasional Ekonomi</div>
          </div>
        )}

        {/* ─── ZOOM CONTROLS ──────────────────────────────────────────────── */}
        {!modeBersih && (
          <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2">
            <button onClick={() => petaRef.current?.zoomIn()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Plus size={16}/></button>
            <button onClick={() => petaRef.current?.zoomOut()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Minus size={16}/></button>
          </div>
        )}

        {/* ─── TOMBOL MODE BERSIH ─────────────────────────────────────────── */}
        {hasilAnalisis && (
          <div className="absolute top-[170px] left-6 z-[1000]">
            <button onClick={() => setModeBersih(!modeBersih)}
              className="p-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-90 border-2 border-white dark:border-slate-700 relative overflow-hidden group"
              style={{ background: getWarnaIndikator() }}>
              {modeBersih ? <EyeOff size={16} className="text-white relative z-10" /> : <Eye size={16} className="text-white relative z-10" />}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all"></div>
            </button>
          </div>
        )}

        {/* ─── BASEMAP PICKER ─────────────────────────────────────────────── */}
        {!modeBersih && (
          <div className={`absolute left-6 z-[1001] ${hasilAnalisis ? 'top-[215px]' : 'top-[170px]'}`}>
            <div className="relative">
              <button onClick={() => setMenuBasemapTerbuka(!menuBasemapTerbuka)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"
                title="Pilih Basemap">
                <Map size={16} />
              </button>
              {menuBasemapTerbuka && (
                <div className="absolute left-full ml-2 top-0 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-[1002] border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Pilih Basemap</div>
                  </div>
                  <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
                    {Object.entries(BASEMAPS).map(([key, bm]) => (
                      <button key={key} onClick={() => { setBasemapTerpilih(key); setMenuBasemapTerbuka(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${basemapTerpilih === key ? 'bg-blue-500 text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 border-2 ${basemapTerpilih === key ? 'border-white/50' : 'border-slate-200 dark:border-slate-600'} ${bm.preview} overflow-hidden relative`}>
                          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.1) 1px,transparent 1px)', backgroundSize: '4px 4px' }}></div>
                        </div>
                        <div className={`text-[11px] font-black uppercase tracking-wider truncate ${basemapTerpilih === key ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{bm.label}</div>
                        {basemapTerpilih === key && <div className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center ml-auto flex-shrink-0"><div className="w-2 h-2 rounded-full bg-white"></div></div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SEARCH ─────────────────────────────────────────────────────── */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute top-[263px] left-6 z-[1000]">
            {searchTerbuka ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 flex gap-2">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()} placeholder="Cari provinsi..."
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none w-48" autoFocus />
                  <button onClick={() => handleSearch()} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all"><Search size={16} /></button>
                  <button onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); setProvinsiDipilih(null); }}
                    className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"><X size={16} /></button>
                </div>
                {searchSuggestions.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                    {searchSuggestions.map((sug, idx) => (
                      <button key={idx} onClick={() => handleSearch(sug.nama)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{sug.nama}</span>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: sug.warna + '20', color: sug.warna }}>{sug.kategori}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchTerbuka(true)} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700">
                <Search size={16}/>
              </button>
            )}
          </div>
        )}

        {/* ─── KOORDINAT & KANAN ATAS ─────────────────────────────────────── */}
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
            {hasilAnalisis && (
              <div className="relative">
                <button onClick={() => { setMenuFilterTerbuka(!menuFilterTerbuka); setMenuUnduhTerbuka(false); }}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-[10px] font-bold hover:border-blue-400 transition-all flex items-center justify-between gap-2 tracking-wider shadow-lg">
                  <div className="flex items-center gap-2"><Filter size={14} /> {kategoriTerpilih}</div>
                  <ChevronDown size={14} className={`transition-transform ${menuFilterTerbuka ? 'rotate-180' : ''}`} />
                </button>
                {menuFilterTerbuka && (
                  <div className="absolute top-full mt-2 right-0 w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                    {["SEMUA", "MAJU", "BERKEMBANG", "TERTINGGAL"].map(kat => (
                      <button key={kat} onClick={() => { setKategoriTerpilih(kat); setMenuFilterTerbuka(false); }}
                        className={`w-full text-left px-4 py-2 text-[10px] font-bold transition-all border-b border-slate-100 dark:border-slate-700 last:border-0 ${kategoriTerpilih === kat ? 'bg-blue-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        {kat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── BOTTOM ACTION BUTTONS ──────────────────────────────────────── */}
        {!modeBersih && (
          <div className="absolute left-1/2 -translate-x-1/2 z-[1002] transition-all duration-200" style={{ bottom: `${actionButtonBottom}px` }}>
            <div className="flex gap-3">
              <div className="relative">
                <button onClick={bukaModalAnalisis} disabled={sedangMenganalisis}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-black text-xs tracking-wider hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 transition-all uppercase active:scale-95 flex items-center gap-2 whitespace-nowrap">
                  <Play size={14} className={sedangMenganalisis ? "animate-pulse" : ""} />
                  {getButtonText()}
                </button>
                {menuPilihanIndikatorTerbuka && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1003] overflow-hidden border border-slate-200 dark:border-slate-700">
                    {[
                      { key: 'ALL', label: '📊 Semua Indikator' },
                      { key: 'PDRB', label: '💹 PDRB Saja' },
                      { key: 'KEMISKINAN', label: '👥 Kemiskinan Saja' },
                      { key: 'INVESTASI', label: '💰 Investasi Saja' },
                    ].map((opt, i, arr) => (
                      <button key={opt.key} onClick={() => jalankanAnalisisBPS(opt.key)}
                        className={`w-full text-left px-4 py-2 text-[10px] font-bold transition-all text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 ${i < arr.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {hasilAnalisis && (
                <>
                  <button onClick={bukaModalSave} className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-black text-xs tracking-wider hover:shadow-xl hover:shadow-green-500/30 transition-all uppercase active:scale-95 flex items-center gap-2">
                    <Save size={14} /> Simpan
                  </button>
                  <button onClick={resetAnalisis} className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-500 text-white rounded-xl font-black text-xs tracking-wider hover:shadow-xl transition-all uppercase active:scale-95 flex items-center gap-2">
                    <RotateCcw size={14} /> Reset
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            BOTTOM PANELS
        ───────────────────────────────────────────────────────────────────── */}
        {hasilAnalisis && !modeBersih && (
          <div ref={panelRef} className="absolute bottom-0 left-0 right-0 z-[1001] flex flex-col"
            style={{ height: adaPanelTerbuka ? `${panelHeight}px` : 'auto' }}>

            {/* INFO PANEL */}
            {panelInfoTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Activity className="text-blue-500" size={24} />
                      <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ringkasan Analisis Ekonomi</h2>
                    </div>
                    <button onClick={() => setPanelInfoTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">BPS Web API · Indikator: {indikatorTerpilih} · {hasilAnalisis.total_success} provinsi</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Total Provinsi', val: hasilAnalisis.total_success, cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300', lbl: 'text-blue-600 dark:text-blue-400' },
                      { label: 'Tertinggal', val: jumlahKategori.TERTINGGAL, cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300', lbl: 'text-red-600 dark:text-red-400' },
                      { label: 'Berkembang', val: jumlahKategori.BERKEMBANG, cls: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300', lbl: 'text-yellow-600 dark:text-yellow-400' },
                      { label: 'Maju', val: jumlahKategori.MAJU, cls: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300', lbl: 'text-green-600 dark:text-green-400' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-3 border ${s.cls}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${s.lbl}`}>{s.label}</div>
                        <div className={`text-xl font-black ${s.cls.includes('blue') ? 'text-blue-700 dark:text-blue-300' : s.cls.includes('red') ? 'text-red-700 dark:text-red-300' : s.cls.includes('yellow') ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}`}>{s.val}</div>
                      </div>
                    ))}
                  </div>
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
            )}

            {/* TABEL PANEL */}
            {panelTabelTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Matriks Ekonomi Daerah</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">{dataTerfilter.length} Wilayah · {indikatorTerpilih}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => { setMenuUnduhTerbuka(!menuUnduhTerbuka); setMenuFilterTerbuka(false); }}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-[10px] font-bold hover:shadow-lg transition-all flex items-center gap-2">
                          <Download size={12} /> UNDUH
                        </button>
                        {menuUnduhTerbuka && (
                          <div className="absolute top-full mt-2 right-0 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                            {['GEOJSON', 'JSON', 'EXCEL', 'CSV'].map(f => (
                              <button key={f} onClick={() => eksporData(f)} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-b border-slate-100 dark:border-slate-700 last:border-0">
                                <Download size={12} className="inline mr-2 text-blue-500" />{f}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPanelTabelTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
                          <th className="px-3 py-2 text-center">No</th>
                          <th className="px-3 py-2">Provinsi</th>
                          <th className="px-3 py-2 text-center">Indeks</th>
                          {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'PDRB') && <th className="px-3 py-2 text-center">PDRB</th>}
                          {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KEMISKINAN') && <th className="px-3 py-2 text-center">Kemiskinan</th>}
                          {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'INVESTASI') && <th className="px-3 py-2 text-center">Investasi</th>}
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const data = fitur.properties.ekonomi_analysis;
                          const de = data.data_ekonomi || {};
                          const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                          const kat = getKategoriByIndikator(fitur, indikatorTerpilih);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2 text-center"><span className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">{data.ekonomi_index}</span></td>
                              {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'PDRB') && <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">Rp{de.PDRB ? (de.PDRB/1000).toFixed(1) : '-'} T</td>}
                              {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KEMISKINAN') && <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{de.KEMISKINAN ? de.KEMISKINAN.toFixed(2)+'%' : '-'}</td>}
                              {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'INVESTASI') && <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">Rp{de.INVESTASI ? (de.INVESTASI/1000).toFixed(2) : '-'} T</td>}
                              <td className="px-3 py-2"><span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna+'40', color: warna }}>{kat}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── KEBIJAKAN PANEL ── DIPERBARUI untuk struktur baru ─────────── */}
            {panelKebijakanTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="text-blue-500" size={24} />
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Rekomendasi Kebijakan</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Klik nama provinsi untuk lihat detail aksi kebijakan dari bank data</p>
                      </div>
                    </div>
                    <button onClick={() => setPanelKebijakanTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
                          <th className="px-3 py-2 text-center">No</th>
                          <th className="px-3 py-2">Provinsi</th>
                          <th className="px-3 py-2">Kategori IEK</th>
                          <th className="px-3 py-2">Prioritas</th>
                          <th className="px-3 py-2">Kelompok Kebijakan</th>
                          <th className="px-3 py-2 text-center">Total Aksi</th>
                          <th className="px-3 py-2">Aksi Unggulan</th>
                          <th className="px-3 py-2 text-center">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const data = fitur.properties.ekonomi_analysis;
                          const rekomendasi = data.rekomendasi || [];
                          const warna = getWarnaByIndikator(fitur, indikatorTerpilih);
                          const kat = getKategoriByIndikator(fitur, indikatorTerpilih);

                          // Hitung total aksi dari semua kelompok
                          const totalAksi = rekomendasi.reduce((sum, k) => sum + (k.jumlah_aksi || k.aksi?.length || 0), 0);

                          // Kelompok pertama untuk preview
                          const kelompokPertama = rekomendasi[0];
                          const aksiUnggulan = kelompokPertama?.aksi?.[0];

                          // Label prioritas dari kelompok pertama
                          const prioritasLabel = getPrioritasLabel(kat, rekomendasi);

                          const prioritasStyle = kat === 'TERTINGGAL'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : kat === 'BERKEMBANG'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';

                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna+'40', color: warna }}>{kat}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${prioritasStyle}`}>{prioritasLabel}</span>
                              </td>
                              <td className="px-3 py-2">
                                {/* Tags semua kelompok kebijakan */}
                                <div className="flex flex-wrap gap-1">
                                  {rekomendasi.slice(0, 3).map((k, ki) => {
                                    const wKat = { MAJU: '#10b981', BERKEMBANG: '#f59e0b', TERTINGGAL: '#ef4444', PDRB_RENDAH: '#f59e0b', KEMISKINAN_TINGGI: '#ef4444', INVESTASI_RENDAH: '#6366f1' }[k.kategori] || '#64748b';
                                    return (
                                      <span key={ki} className="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                                        style={{ borderColor: wKat+'40', color: wKat, backgroundColor: wKat+'10' }}>
                                        {k.kategori?.replace('_', ' ')}
                                      </span>
                                    );
                                  })}
                                  {rekomendasi.length > 3 && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                      +{rekomendasi.length - 3}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="text-xs font-black text-slate-900 dark:text-white">{totalAksi}</span>
                              </td>
                              <td className="px-3 py-2 max-w-xs">
                                {aksiUnggulan ? (
                                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-medium leading-tight">
                                    <span className="font-black">•</span> {aksiUnggulan.nama_aksi}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => {
                                    setProvinsiKebijakanDipilih(data.nama_provinsi);
                                    if (panelHeight < 200) setPanelHeight(PANEL_HEIGHT_DEFAULT);
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-[10px] font-black hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap"
                                >
                                  Lihat Semua →
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

            {/* METODOLOGI PANEL */}
            {panelMetodologiTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Metodologi IEK</h3>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => setMenuDatasetTerbuka(!menuDatasetTerbuka)} className="px-3 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold hover:shadow-lg transition-all flex items-center gap-2">
                          <Download size={12} /> Dataset
                        </button>
                        {menuDatasetTerbuka && (
                          <div className="absolute top-full mt-2 right-0 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                            {[
                              { key: 'ALL', label: 'Semua Dataset', icon: <Database size={14} className="inline mr-2 text-purple-600" /> },
                              { key: 'PDRB', label: '💹 Dataset PDRB' },
                              { key: 'KEMISKINAN', label: '👥 Dataset Kemiskinan' },
                              { key: 'INVESTASI', label: '💰 Dataset Investasi' },
                            ].map(opt => (
                              <button key={opt.key} onClick={() => unduhDataset(opt.key)}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-b border-slate-100 dark:border-slate-700 last:border-0">
                                {opt.icon}{opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPanelMetodologiTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-black text-blue-900 dark:text-blue-100 mb-2 uppercase">Formula Perhitungan</h4>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-blue-300 dark:border-blue-700">
                      <code className="text-xs font-mono font-bold text-slate-900 dark:text-white">IEK = (Skor_PDRB × 0.40) + (Skor_Kemiskinan × 0.40) + (Skor_Investasi × 0.20)</code>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'PDRB') && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border-l-4 border-yellow-500">
                        <h5 className="text-sm font-black text-yellow-900 dark:text-yellow-100 uppercase mb-1">💹 PDRB — Bobot: 40%</h5>
                        <div className="text-xs font-bold text-slate-900 dark:text-white space-y-1">
                          <div>✓ &gt; Rp75 miliar → <span className="text-green-600">MAJU</span></div>
                          <div>◐ 50–75 miliar → <span className="text-yellow-600">BERKEMBANG</span></div>
                          <div>✗ &lt; Rp50 miliar → <span className="text-red-600">TERTINGGAL</span></div>
                        </div>
                      </div>
                    )}
                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'KEMISKINAN') && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                        <h5 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase mb-1">👥 Kemiskinan (REVERSE) — Bobot: 40%</h5>
                        <div className="text-xs font-bold text-slate-900 dark:text-white space-y-1">
                          <div>✓ &lt; 7% → <span className="text-green-600">MAJU</span></div>
                          <div>◐ 7–12% → <span className="text-yellow-600">BERKEMBANG</span></div>
                          <div>✗ &gt; 12% → <span className="text-red-600">TERTINGGAL</span></div>
                        </div>
                      </div>
                    )}
                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'INVESTASI') && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border-l-4 border-indigo-500">
                        <h5 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase mb-1">💰 Investasi PMDN — Bobot: 20%</h5>
                        <div className="text-xs font-bold text-slate-900 dark:text-white space-y-1">
                          <div>✓ &gt; Rp10 triliun → <span className="text-green-600">MAJU</span></div>
                          <div>◐ 5–10 triliun → <span className="text-yellow-600">BERKEMBANG</span></div>
                          <div>✗ &lt; Rp5 triliun → <span className="text-red-600">TERTINGGAL</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-black text-green-900 dark:text-green-100 uppercase mb-3">Kategori Hasil</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { label: 'MAJU', range: 'IEK ≥ 2.4', color: 'border-green-200 dark:border-green-700', textColor: 'text-green-600 dark:text-green-400', desc: 'Ekonomi berkembang pesat' },
                        { label: 'BERKEMBANG', range: '1.8 ≤ IEK < 2.4', color: 'border-yellow-200 dark:border-yellow-700', textColor: 'text-yellow-600 dark:text-yellow-400', desc: 'Menuju kemajuan ekonomi' },
                        { label: 'TERTINGGAL', range: 'IEK < 1.8', color: 'border-red-200 dark:border-red-700', textColor: 'text-red-600 dark:text-red-400', desc: 'Perlu percepatan pembangunan' },
                      ].map(cat => (
                        <div key={cat.label} className={`bg-white dark:bg-slate-900 rounded-xl p-3 border ${cat.color}`}>
                          <div className={`text-xs font-black uppercase ${cat.textColor}`}>{cat.label}</div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{cat.range}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">{cat.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase mb-2">Sumber Data</div>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                      <li>• BPS Web API — PDRB Atas Dasar Harga Berlaku</li>
                      <li>• BPS Web API — Persentase Penduduk Miskin</li>
                      <li>• BPS Web API — Realisasi Investasi PMDN</li>
                      <li>• Bank Kebijakan Ekonomi — 300 Aksi (PostgreSQL → MongoDB)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB BAR + DRAG HANDLE ──────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 shadow-2xl flex-shrink-0">
              {adaPanelTerbuka && (
                <div
                  className={`flex items-center justify-center py-1.5 cursor-row-resize select-none group ${isDragging ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} transition-colors`}
                  onMouseDown={handleDragStart} onTouchStart={handleDragStart} title="Drag untuk mengubah tinggi panel">
                  <div className={`flex flex-col gap-0.5 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'}`}>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                    <div className="w-5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto"></div>
                  </div>
                </div>
              )}
              <div className="p-3 pt-1">
                <div className="flex justify-center gap-2">
                  {[
                    { setter: setPanelInfoTerbuka, open: panelInfoTerbuka, icon: <Info size={14} />, label: 'Info' },
                    { setter: setPanelTabelTerbuka, open: panelTabelTerbuka, icon: <Table size={14} />, label: 'Tabel' },
                    { setter: setPanelKebijakanTerbuka, open: panelKebijakanTerbuka, icon: <ClipboardList size={14} />, label: 'Kebijakan' },
                    { setter: setPanelMetodologiTerbuka, open: panelMetodologiTerbuka, icon: <FileText size={14} />, label: 'Metodologi' },
                  ].map((tab) => (
                    <button key={tab.label}
                      onClick={() => { adaPanelTerbuka && tab.open ? tab.setter(false) : bukaPanel(tab.setter); }}
                      className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${tab.open ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      {tab.icon} {tab.label}
                      {tab.open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                  ))}
                  {adaPanelTerbuka && (
                    <button onClick={toggleAllPanels} className="px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                      <ChevronDown size={14} /> Tutup
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