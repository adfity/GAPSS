"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Play, Download, AlertCircle, Plus, Minus, ChevronDown, Filter, Save, X, Activity, RotateCcw, Database, ChevronUp, Info, Table, FileText, ClipboardList, Search, Eye, EyeOff, Map
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';

// Konfigurasi Kategori
const KATEGORI = {
  KRITIS: { warna: "#ef4444", label: "KRITIS", status: "DARURAT" },
  WASPADA: { warna: "#f59e0b", label: "WASPADA", status: "PERLU PERHATIAN" },
  STABIL: { warna: "#10b981", label: "STABIL", status: "KONDISI BAIK" }
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

export default function KesehatanPage() {
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

  // --- Drag State untuk bottom panel ---
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

  // =====================================================================
  // DRAG HANDLER untuk bottom panel
  // =====================================================================
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
        mousemove: (e) => {
          setKoordinatCursor({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) });
        },
        zoomend: (e) => { setCurrentZoom(e.target.getZoom()); }
      });
      return null;
    };
    return <MapEventsComponent />;
  };

  // =============================================
  // FUNGSI INTI: Hitung kategori berdasarkan indikator terpilih
  // =============================================
  const hitungKategoriDariIndikator = (fitur, indikator) => {
    if (indikator === 'SEMUA') {
      return fitur.properties?.health_analysis?.kategori || 'STABIL';
    }

    const nilai = fitur.properties?.health_analysis?.data_kesehatan?.[indikator];
    if (nilai === null || nilai === undefined) return null;

    if (indikator === 'AHH') {
      if (nilai < 65) return 'KRITIS';
      if (nilai < 70) return 'WASPADA';
      return 'STABIL';
    } else if (indikator === 'IMUNISASI') {
      if (nilai < 80) return 'KRITIS';
      if (nilai < 90) return 'WASPADA';
      return 'STABIL';
    } else if (indikator === 'SANITASI') {
      if (nilai < 70) return 'KRITIS';
      if (nilai < 85) return 'WASPADA';
      return 'STABIL';
    }
    if (nilai < 60) return 'KRITIS';
    if (nilai < 80) return 'WASPADA';
    return 'STABIL';
  };

  useEffect(() => {
    if (!hasilAnalisis?.matched_features?.features || !searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }
    
    const features = hasilAnalisis.matched_features.features;
    const suggestions = features
      .filter(f => f.properties?.health_analysis?.nama_provinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(f => {
        const kategori = hitungKategoriDariIndikator(f, indikatorTerpilih);
        const warna = KATEGORI[kategori]?.warna || "#cbd5e1";
        return {
          nama: f.properties.health_analysis.nama_provinsi,
          kategori,
          warna
        };
      })
      .slice(0, 5);
    
    setSearchSuggestions(suggestions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hasilAnalisis, indikatorTerpilih]);

  const handleSearch = (namaProvinsi) => {
    const provinsiNama = namaProvinsi || searchQuery;
    if (!hasilAnalisis?.matched_features?.features || !provinsiNama.trim()) return;
    
    const fitur = hasilAnalisis.matched_features.features.find(f => 
      f.properties?.health_analysis?.nama_provinsi?.toLowerCase() === provinsiNama.toLowerCase()
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
      setProvinsiDipilih(fitur.properties.health_analysis.nama_provinsi);
      
      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <div>
            <div className="font-bold">Lokasi Ditemukan!</div>
            <div className="text-xs">{fitur.properties.health_analysis.nama_provinsi}</div>
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
    const petunjukMemuat = toast.loading(`Mengambil data dari BPS Web API...\nAnalisis: ${pilihan === 'ALL' ? 'Semua Indikator' : pilihan}`);

    try {
      const respons = await axios.post('http://127.0.0.1:8000/api/analyze-health-bps/', {
        provinces: 'ALL',
        indikator: pilihan
      });

      toast.dismiss(petunjukMemuat);
      
      if (respons.data.status === 'success') {
        setHasilAnalisis(respons.data);
        setIndikatorTerpilih(pilihan === 'ALL' ? 'SEMUA' : pilihan);
        setKategoriTerpilih('SEMUA');
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
      const respons = await axios.post('http://127.0.0.1:8000/api/save-health-analysis/', {
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

  const unduhDataset = (jenisDataset) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error("Dataset tidak tersedia");
    
    const datasets = hasilAnalisis.raw_datasets;
    const datasetsDetail = hasilAnalisis.raw_datasets_detail || {};
    const indikatorInfo = hasilAnalisis.indikator_info;
    
    setMenuDatasetTerbuka(false);

    if (jenisDataset === 'ALL') {
      const bukuKerja = XLSX.utils.book_new();
      
      if (datasetsDetail.AHH_breakdown) {
        const dataArrayAHH = Object.entries(datasetsDetail.AHH_breakdown).map(([provinsi, genderData]) => ({
          'Provinsi': provinsi,
          'Laki-laki (tahun)': genderData['Laki-laki'] || genderData['Laki-Laki'] || '-',
          'Perempuan (tahun)': genderData['Perempuan'] || '-',
          'Rata-rata (tahun)': datasets.AHH[provinsi] || '-'
        }));
        XLSX.utils.book_append_sheet(bukuKerja, XLSX.utils.json_to_sheet(dataArrayAHH), "AHH (Gender Breakdown)");
      }
      
      const dataArrayImunisasi = Object.entries(datasets.IMUNISASI || {}).map(([provinsi, nilai]) => ({
        'Provinsi': provinsi,
        'Cakupan Imunisasi Dasar Lengkap (%)': nilai
      }));
      XLSX.utils.book_append_sheet(bukuKerja, XLSX.utils.json_to_sheet(dataArrayImunisasi), "Imunisasi");
      
      const dataArraySanitasi = Object.entries(datasets.SANITASI || {}).map(([provinsi, nilai]) => ({
        'Provinsi': provinsi,
        'Akses Sanitasi Layak (%)': nilai
      }));
      XLSX.utils.book_append_sheet(bukuKerja, XLSX.utils.json_to_sheet(dataArraySanitasi), "Sanitasi");
      
      XLSX.writeFile(bukuKerja, "TERASEG_Semua_Dataset_Kesehatan_BPS.xlsx");
      toast.success('Semua dataset berhasil diunduh!');
    } else if (jenisDataset === 'AHH') {
      if (datasetsDetail.AHH_breakdown) {
        const dataArray = Object.entries(datasetsDetail.AHH_breakdown).map(([provinsi, genderData]) => ({
          'Provinsi': provinsi,
          'Laki-laki (tahun)': genderData['Laki-laki'] || genderData['Laki-Laki'] || '-',
          'Perempuan (tahun)': genderData['Perempuan'] || '-',
          'Rata-rata (tahun)': datasets.AHH[provinsi] || '-'
        }));
        const lembarKerja = XLSX.utils.json_to_sheet(dataArray);
        const bukuKerja = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(bukuKerja, lembarKerja, "AHH Gender Breakdown");
        XLSX.writeFile(bukuKerja, "TERASEG_Dataset_AHH_BPS.xlsx");
        toast.success('Dataset AHH dengan breakdown gender berhasil diunduh!');
      } else {
        toast.error('Data breakdown gender tidak tersedia');
      }
    } else {
      const dataset = datasets[jenisDataset] || {};
      const info = indikatorInfo[jenisDataset];
      const dataArray = Object.entries(dataset).map(([provinsi, nilai]) => ({
        'Provinsi': provinsi,
        [`${info.nama} (${info.satuan})`]: nilai
      }));
      const lembarKerja = XLSX.utils.json_to_sheet(dataArray);
      const bukuKerja = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(bukuKerja, lembarKerja, jenisDataset);
      XLSX.writeFile(bukuKerja, `TERASEG_Dataset_${jenisDataset}_BPS.xlsx`);
      toast.success(`Dataset ${info.nama} berhasil diunduh!`);
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
        'Indeks Kesehatan': item.health_index,
        'AHH (tahun)': item.ahh || '-',
        'Imunisasi (%)': item.imunisasi || '-',
        'Sanitasi (%)': item.sanitasi || '-'
      }));
      const lembarKerja = XLSX.utils.json_to_sheet(dataExport);
      const bukuKerja = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(bukuKerja, lembarKerja, "Analisis Kesehatan BPS");
      XLSX.writeFile(bukuKerja, "TERASEG_Kesehatan_BPS.xlsx");
      toast.success('File Excel berhasil diunduh');
    } else if (format === 'JSON') {
      const gumpalan = new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' });
      unduhBerkas(gumpalan, 'TERASEG_Kesehatan_BPS.json');
      toast.success('File JSON berhasil diunduh');
    } else if (format === 'CSV') {
      const barisCsv = [
        ["Provinsi", "Kategori", "Indeks Kesehatan", "AHH", "Imunisasi", "Sanitasi"].join(","),
        ...ringkasan.map(s => [s.provinsi, s.kategori, s.health_index, s.ahh || '-', s.imunisasi || '-', s.sanitasi || '-'].join(","))
      ].join("\n");
      const gumpalan = new Blob([barisCsv], { type: 'text/csv' });
      unduhBerkas(gumpalan, 'TERASEG_Kesehatan_BPS.csv');
      toast.success('File CSV berhasil diunduh');
    } else if (format === 'GEOJSON') {
      const gumpalan = new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' });
      unduhBerkas(gumpalan, 'TERASEG_Spasial_Kesehatan.geojson');
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

  const hitungWarnaIndikator = (fitur) => {
    if (indikatorTerpilih === 'SEMUA') {
      return fitur.properties?.health_analysis?.warna || "#cbd5e1";
    }
    const kategori = hitungKategoriDariIndikator(fitur, indikatorTerpilih);
    if (!kategori) return "#cbd5e1";
    return KATEGORI[kategori]?.warna || "#cbd5e1";
  };

  const ambilDataTabelTerfilter = () => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let fitur = hasilAnalisis.matched_features.features;

    if (indikatorTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => {
        const nilai = f.properties?.health_analysis?.data_kesehatan?.[indikatorTerpilih];
        return nilai !== null && nilai !== undefined;
      });
    }

    if (kategoriTerpilih !== 'SEMUA') {
      fitur = fitur.filter(f => {
        const kategori = hitungKategoriDariIndikator(f, indikatorTerpilih);
        return kategori === kategoriTerpilih;
      });
    }

    if (indikatorTerpilih !== 'SEMUA') {
      fitur = fitur.sort((a, b) => {
        const nilaiA = a.properties?.health_analysis?.data_kesehatan?.[indikatorTerpilih] || 0;
        const nilaiB = b.properties?.health_analysis?.data_kesehatan?.[indikatorTerpilih] || 0;
        return nilaiA - nilaiB;
      });
    }
    
    return fitur;
  };

  const getButtonText = () => {
    if (sedangMenganalisis) return 'Loading...';
    if (!pernahAnalisis) return 'Analisis';
    if (indikatorTerpilih === 'SEMUA') return 'Analisis Semua Indikator';
    if (indikatorTerpilih === 'AHH') return 'Analisis AHH';
    if (indikatorTerpilih === 'IMUNISASI') return 'Analisis Imunisasi';
    if (indikatorTerpilih === 'SANITASI') return 'Analisis Sanitasi';
    return 'Analisis';
  };

  const dataTerfilter = ambilDataTabelTerfilter();
  const adaPanelTerbuka = panelInfoTerbuka || panelTabelTerbuka || panelMetodologiTerbuka || panelKebijakanTerbuka;

  const hitungKategori = () => {
    if (!hasilAnalisis?.matched_features?.features) return { KRITIS: 0, WASPADA: 0, STABIL: 0 };
    const features = hasilAnalisis.matched_features.features;
    
    if (indikatorTerpilih === 'SEMUA') {
      return {
        KRITIS: features.filter(f => f.properties?.health_analysis?.kategori === 'KRITIS').length,
        WASPADA: features.filter(f => f.properties?.health_analysis?.kategori === 'WASPADA').length,
        STABIL: features.filter(f => f.properties?.health_analysis?.kategori === 'STABIL').length
      };
    }

    return {
      KRITIS: features.filter(f => hitungKategoriDariIndikator(f, indikatorTerpilih) === 'KRITIS').length,
      WASPADA: features.filter(f => hitungKategoriDariIndikator(f, indikatorTerpilih) === 'WASPADA').length,
      STABIL: features.filter(f => hitungKategoriDariIndikator(f, indikatorTerpilih) === 'STABIL').length
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
    if (indikatorTerpilih === 'AHH') return 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)';
    if (indikatorTerpilih === 'IMUNISASI') return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    if (indikatorTerpilih === 'SANITASI') return 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)';
    return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
  };

  // Hitung posisi bottom action buttons
  const bottomPanelEffectiveHeight = adaPanelTerbuka ? panelHeight : 48;
  const actionButtonBottom = bottomPanelEffectiveHeight + 16;

  if (!adalahClient) return null;

  const basemapConfig = BASEMAPS[basemapTerpilih];

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
              Pilih indikator yang ingin dianalisis untuk pemetaan kesehatan nasional
            </p>

            <div className="space-y-3 mb-6">
              {[
                { key: 'ALL', label: '📊 Semua Indikator', desc: 'Analisis komprehensif seluruh data kesehatan', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
                { key: 'AHH', label: '📈 Angka Harapan Hidup', desc: 'Fokus analisis pada usia harapan hidup', border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-900/20', dot: 'bg-green-500' },
                { key: 'IMUNISASI', label: '💉 Cakupan Imunisasi Dasar', desc: 'Fokus analisis pada program imunisasi', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
                { key: 'SANITASI', label: '🚰 Akses Sanitasi Layak', desc: 'Fokus analisis pada infrastruktur sanitasi', border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', dot: 'bg-purple-500' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPilihanIndikator(opt.key)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${pilihanIndikator === opt.key ? `${opt.border} ${opt.bg}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                >
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
                placeholder="contoh: Analisis Kesehatan Q1 2024"
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
          <KontainerPeta 
            center={PUSAT_DEFAULT} 
            zoom={ZOOM_DEFAULT} 
            className="h-full w-full z-0" 
            zoomControl={false}
            ref={petaRef}
          >
            <LapisanPeta
              key={basemapTerpilih}
              url={basemapConfig.url}
              attribution={basemapConfig.attribution}
            />
            <MouseTracker />
            {hasilAnalisis?.matched_features?.features && (
              <GeoJSON 
                key={JSON.stringify(hasilAnalisis.matched_features.features) + kategoriTerpilih + indikatorTerpilih + provinsiDipilih}
                data={{ type: "FeatureCollection", features: hasilAnalisis.matched_features.features }}
                style={(fitur) => {
                  const analisis = fitur.properties?.health_analysis || {};
                  const kategoriSaatIni = hitungKategoriDariIndikator(fitur, indikatorTerpilih);
                  
                  let terlihat = true;
                  if (kategoriTerpilih !== 'SEMUA') {
                    terlihat = kategoriSaatIni === kategoriTerpilih;
                  }
                  if (indikatorTerpilih !== 'SEMUA') {
                    const nilai = analisis.data_kesehatan?.[indikatorTerpilih];
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
                  const analisis = fitur.properties?.health_analysis || {};
                  const dataKesehatan = analisis.data_kesehatan || {};
                  const wawasan = analisis.insights?.map(i => `<div style="margin-bottom:3px; padding-left:6px; border-left:2px solid ${analisis.warna}; font-weight: 600; font-size: 9px;">${i}</div>`).join('') || '';
                  
                  const warna = hitungWarnaIndikator(fitur);
                  const kategoriSaatIni = hitungKategoriDariIndikator(fitur, indikatorTerpilih) || analisis.kategori;
                  
                  lapisan.bindTooltip(`
                    <div style="font-family: inherit; padding: 4px;">
                      <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">${analisis.nama_provinsi}</div>
                      <div style="font-size: 9px; font-weight: 800; color: ${warna}; margin-top:2px;">STATUS: ${kategoriSaatIni}</div>
                      <div style="font-size: 8px; font-weight: 700; color: #64748b; margin-top:2px;">Indeks: ${analisis.health_index}</div>
                    </div>
                  `, { sticky: true, opacity: 0.95 });

                  let indikatorHTML = '';
                  if (indikatorTerpilih === 'SEMUA') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #10b981;">
                        <div style="font-size: 7px; font-weight: 900; color: #14532d; text-transform: uppercase; margin-bottom: 1px;">📈 Harapan Hidup</div>
                        <div style="font-size: 11px; font-weight: 900; color: #16a34a;">${dataKesehatan.AHH ? dataKesehatan.AHH + ' th' : '-'}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #3b82f6;">
                        <div style="font-size: 7px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin-bottom: 1px;">💉 Imunisasi</div>
                        <div style="font-size: 11px; font-weight: 900; color: #2563eb;">${dataKesehatan.IMUNISASI ? dataKesehatan.IMUNISASI + '%' : '-'}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 6px; border-radius: 6px; border-left: 2px solid #a855f7;">
                        <div style="font-size: 7px; font-weight: 900; color: #581c87; text-transform: uppercase; margin-bottom: 1px;">🚰 Sanitasi</div>
                        <div style="font-size: 11px; font-weight: 900; color: #9333ea;">${dataKesehatan.SANITASI ? dataKesehatan.SANITASI + '%' : '-'}</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'AHH') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #10b981;">
                        <div style="font-size: 8px; font-weight: 900; color: #14532d; text-transform: uppercase; margin-bottom: 2px;">📈 Angka Harapan Hidup</div>
                        <div style="font-size: 16px; font-weight: 900; color: #16a34a;">${dataKesehatan.AHH ? dataKesehatan.AHH + ' tahun' : '-'}</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'IMUNISASI') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <div style="font-size: 8px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin-bottom: 2px;">💉 Cakupan Imunisasi Dasar Lengkap</div>
                        <div style="font-size: 16px; font-weight: 900; color: #2563eb;">${dataKesehatan.IMUNISASI ? dataKesehatan.IMUNISASI + '%' : '-'}</div>
                      </div>
                    `;
                  } else if (indikatorTerpilih === 'SANITASI') {
                    indikatorHTML = `
                      <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); padding: 8px; border-radius: 8px; border-left: 3px solid #a855f7;">
                        <div style="font-size: 8px; font-weight: 900; color: #581c87; text-transform: uppercase; margin-bottom: 2px;">🚰 Akses Sanitasi Layak</div>
                        <div style="font-size: 16px; font-weight: 900; color: #9333ea;">${dataKesehatan.SANITASI ? dataKesehatan.SANITASI + '%' : '-'}</div>
                      </div>
                    `;
                  }

                  const isiPopup = `
                    <div style="font-family: inherit; min-width: 280px; max-width: 280px; color: #1e293b; padding: 4px;">
                      <div style="background: linear-gradient(135deg, ${warna} 0%, ${warna}dd 100%); color: white; padding: 8px; border-radius: 8px; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-weight: 900; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">${analisis.nama_provinsi}</div>
                        <div style="background: rgba(255,255,255,0.2); border-radius: 5px; padding: 5px; margin-top: 5px;">
                          <div style="font-size: 7px; font-weight: 800; opacity: 0.9; text-transform: uppercase; margin-bottom: 2px;">INDEKS BAHAYA</div>
                          <div style="background: rgba(255,255,255,0.3); height: 12px; border-radius: 6px; overflow: hidden; position: relative;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to right, #10b981 0%, #10b981 30%, #f59e0b 30%, #f59e0b 60%, #ef4444 60%, #ef4444 100%);"></div>
                            <div style="position: absolute; top: 50%; transform: translateY(-50%); left: ${analisis.health_index}%; width: 2px; height: 16px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
                          </div>
                          <div style="text-align: center; margin-top: 3px; font-size: 10px; font-weight: 900;">Nilai: ${analisis.health_index}</div>
                        </div>
                      </div>
                      <div style="padding: 0 2px;">
                        <div style="text-align: center; margin-bottom: 6px;">
                          <span style="background: ${warna}; color: white; padding: 4px 12px; border-radius: 10px; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            ${kategoriSaatIni}
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
            <div className="text-sm font-black text-white uppercase tracking-wider">🏥 SDM Nasional Kesehatan</div>
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

        {/* TOMBOL PILIH BASEMAP */}
        {!modeBersih && (
          <div className={`absolute left-6 z-[1001] ${hasilAnalisis ? 'top-[215px]' : 'top-[170px]'}`}>
            <div className="relative">
              <button
                onClick={() => setMenuBasemapTerbuka(!menuBasemapTerbuka)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                title="Pilih Basemap"
              >
                <Map size={16} />
              </button>

              {menuBasemapTerbuka && (
                <div className="absolute left-full ml-2 top-0 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-slate-900/60 z-[1002] border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Pilih Basemap</div>
                  </div>
                  <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
                    {Object.entries(BASEMAPS).map(([key, bm]) => (
                      <button
                        key={key}
                        onClick={() => { setBasemapTerpilih(key); setMenuBasemapTerbuka(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                          basemapTerpilih === key
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 border-2 ${basemapTerpilih === key ? 'border-white/50' : 'border-slate-200 dark:border-slate-600'} ${bm.preview} overflow-hidden relative`}>
                          <div className="absolute inset-0 opacity-30" style={{
                            backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
                            backgroundSize: '4px 4px'
                          }}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[11px] font-black uppercase tracking-wider truncate ${basemapTerpilih === key ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {bm.label}
                          </div>
                        </div>
                        {basemapTerpilih === key && (
                          <div className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEARCH */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute top-[263px] left-6 z-[1000]">
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
                    {["SEMUA", "KRITIS", "WASPADA", "STABIL"].map(kat => (
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

        {/* BOTTOM ACTION BUTTONS — posisi dinamis mengikuti tinggi panel */}
        {!modeBersih && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[1002] transition-all duration-200"
            style={{ bottom: `${actionButtonBottom}px` }}
          >
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
                    {[
                      { key: 'ALL', label: '📊 Semua Indikator' },
                      { key: 'AHH', label: '📈 Angka Harapan Hidup' },
                      { key: 'IMUNISASI', label: '💉 Cakupan Imunisasi Dasar' },
                      { key: 'SANITASI', label: '🚰 Akses Sanitasi Layak' },
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

        {/* BOTTOM PANELS — dapat di-drag naik/turun */}
        {hasilAnalisis && !modeBersih && (
          <div
            ref={panelRef}
            className="absolute bottom-0 left-0 right-0 z-[1001] flex flex-col"
            style={{ height: adaPanelTerbuka ? `${panelHeight}px` : 'auto' }}
          >
            {/* INFO PANEL */}
            {panelInfoTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
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
                    Analisis data kesehatan nasional menggunakan BPS Web API dengan 3 indikator utama
                  </p>
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
                      <div className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-1">Waspada</div>
                      <div className="text-xl font-black text-yellow-700 dark:text-yellow-300">{jumlahKategori.WASPADA}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                      <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Stabil</div>
                      <div className="text-xl font-black text-green-700 dark:text-green-300">{jumlahKategori.STABIL}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TABEL PANEL */}
            {panelTabelTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Matriks Kesehatan</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1">{dataTerfilter.length} Wilayah | Indikator: {indikatorTerpilih}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => { setMenuUnduhTerbuka(!menuUnduhTerbuka); setMenuFilterTerbuka(false); }}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-[10px] font-bold hover:shadow-lg transition-all flex items-center gap-2">
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
                          {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'AHH') && <th className="px-3 py-2 text-center">AHH</th>}
                          {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'IMUNISASI') && <th className="px-3 py-2 text-center">Imunisasi</th>}
                          {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'SANITASI') && <th className="px-3 py-2 text-center">Sanitasi</th>}
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, indeks) => {
                          const data = fitur.properties.health_analysis;
                          const dataKesehatan = data.data_kesehatan || {};
                          const kategoriSaatIni = hitungKategoriDariIndikator(fitur, indikatorTerpilih) || data.kategori;
                          const warna = KATEGORI[kategoriSaatIni]?.warna || data.warna || "#cbd5e1";
                          return (
                            <tr key={indeks} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{indeks + 1}</td>
                              <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">{data.health_index}</span>
                              </td>
                              {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'AHH') && (
                                <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{dataKesehatan.AHH ? `${dataKesehatan.AHH} th` : '-'}</td>
                              )}
                              {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'IMUNISASI') && (
                                <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{dataKesehatan.IMUNISASI ? `${dataKesehatan.IMUNISASI}%` : '-'}</td>
                              )}
                              {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'SANITASI') && (
                                <td className="px-3 py-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{dataKesehatan.SANITASI ? `${dataKesehatan.SANITASI}%` : '-'}</td>
                              )}
                              <td className="px-3 py-2">
                                <span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna + '40', color: warna }}>{kategoriSaatIni}</span>
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

            {/* KEBIJAKAN PANEL */}
            {panelKebijakanTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
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
                          const data = fitur.properties.health_analysis;
                          const rekUtama = data.rekomendasi?.[0];
                          const kategoriSaatIni = hitungKategoriDariIndikator(fitur, indikatorTerpilih) || data.kategori;
                          const warna = KATEGORI[kategoriSaatIni]?.warna || data.warna || "#cbd5e1";
                          return (
                            <tr key={indeks} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{indeks + 1}</td>
                              <td className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white">{data.nama_provinsi}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-1 rounded-lg text-[10px] font-bold border-2" style={{ borderColor: warna + '40', color: warna }}>{kategoriSaatIni}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                  kategoriSaatIni === 'KRITIS' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                  kategoriSaatIni === 'WASPADA' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
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
            )}

            {/* METODOLOGI PANEL */}
            {panelMetodologiTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Metodologi Perhitungan Indeks Kesehatan Komposit (IKK)
                    </h3>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => setMenuDatasetTerbuka(!menuDatasetTerbuka)}
                          className="px-3 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold hover:shadow-lg transition-all flex items-center gap-2">
                          <Download size={12} /> Dataset
                        </button>
                        {menuDatasetTerbuka && (
                          <div className="absolute top-full mt-2 right-0 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] overflow-hidden border border-slate-200 dark:border-slate-700">
                            <button onClick={() => unduhDataset('ALL')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                              <Database size={14} className="inline mr-2 text-purple-600" /> Semua Dataset
                            </button>
                            <button onClick={() => unduhDataset('AHH')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                              📈 Dataset AHH
                            </button>
                            <button onClick={() => unduhDataset('IMUNISASI')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border-b border-slate-100 dark:border-slate-700">
                              💉 Dataset Imunisasi
                            </button>
                            <button onClick={() => unduhDataset('SANITASI')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all">
                              🚰 Dataset Sanitasi
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
                    Indeks Kesehatan Komposit (IKK) menggabungkan 3 indikator kunci kesehatan dengan pembobotan berdasarkan dampak dan relevansi terhadap kualitas hidup masyarakat.
                  </p>

                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <h4 className="text-sm font-black text-purple-900 dark:text-purple-100 mb-2 uppercase">Formula Perhitungan</h4>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-300 dark:border-purple-700">
                      <code className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        IKK = (Skor_AHH × 0.40) + (Skor_Imunisasi × 0.35) + (Skor_Sanitasi × 0.25)
                      </code>
                    </div>
                  </div>

                  {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'AHH') && (
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-4 border-2 border-cyan-200 dark:border-cyan-800">
                      <h4 className="text-sm font-black text-cyan-900 dark:text-cyan-100 mb-2 uppercase flex items-center gap-2">
                        <span>📊</span> Catatan Penting: Angka Harapan Hidup (AHH)
                      </h4>
                      <div className="text-xs text-cyan-800 dark:text-cyan-200 font-semibold mb-2">
                        <strong>Metode:</strong> Rata-rata dari AHH Laki-laki dan Perempuan
                      </div>
                      <p className="text-xs text-cyan-700 dark:text-cyan-300 mb-3 leading-relaxed">
                        AHH memiliki perbedaan biologis dan sosial antara laki-laki dan perempuan. Untuk mendapatkan gambaran populasi secara keseluruhan, digunakan rata-rata sederhana (simple average) dari kedua gender.
                      </p>
                      <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-cyan-300 dark:border-cyan-700 mb-3">
                        <div className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase mb-1">Formula</div>
                        <code className="text-xs font-mono font-bold text-cyan-900 dark:text-cyan-100">
                          AHH_Provinsi = (AHH_Laki-laki + AHH_Perempuan) / 2
                        </code>
                      </div>
                      <div className="bg-cyan-100 dark:bg-cyan-950/30 rounded-lg p-3 border border-cyan-300 dark:border-cyan-700">
                        <div className="text-[10px] font-black text-cyan-700 dark:text-cyan-300 uppercase mb-1">Contoh Perhitungan</div>
                        <code className="text-xs font-mono font-semibold text-cyan-900 dark:text-cyan-100">JAMBI: (70.09 + 74.09) / 2 = 72.09 tahun</code>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'AHH') && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border-l-4 border-green-500">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className="text-sm font-black text-green-900 dark:text-green-100 uppercase">Angka Harapan Hidup (AHH)</h5>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold rounded">Bobot: 40%</span>
                              <span className="text-xs text-green-700 dark:text-green-300 font-bold">📊 Rata-rata AHH Laki-laki dan Perempuan</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-green-200 dark:border-green-700">
                            <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">Baik (STABIL)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{'>'}70 tahun</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-green-200 dark:border-green-700">
                            <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase">Sedang (WASPADA)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">65-70 tahun</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-green-200 dark:border-green-700">
                            <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">Rendah (KRITIS)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{'<'}65 tahun</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'IMUNISASI') && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase">Cakupan Imunisasi Dasar Lengkap</h5>
                            <span className="inline-block mt-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded">Bobot: 35%</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
                            <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">Baik (STABIL)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{'>'}90%</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
                            <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase">Sedang (WASPADA)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">80-90%</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
                            <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">Rendah (KRITIS)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{'<'}80%</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {(indikatorTerpilih === 'SEMUA' || indikatorTerpilih === 'SANITASI') && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border-l-4 border-purple-500">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className="text-sm font-black text-purple-900 dark:text-purple-100 uppercase">Akses Sanitasi Layak</h5>
                            <span className="inline-block mt-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold rounded">Bobot: 25%</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                            <div className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">Baik (STABIL)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{'>'}85%</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                            <div className="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase">Sedang (WASPADA)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">70-85%</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                            <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">Rendah (KRITIS)</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{'<'}70%</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-black text-green-900 dark:text-green-100 uppercase mb-3">Kategori Hasil Analisis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-green-200 dark:border-green-700">
                        <div className="text-xs font-black text-green-600 dark:text-green-400 uppercase">STABIL</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">IKK ≥ 80</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">Kondisi kesehatan baik, sistem berfungsi optimal</div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-yellow-200 dark:border-yellow-700">
                        <div className="text-xs font-black text-yellow-600 dark:text-yellow-400 uppercase">WASPADA</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">60 ≤ IKK {'<'} 80</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">Perlu penguatan, ada area yang memerlukan perbaikan</div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-red-200 dark:border-red-700">
                        <div className="text-xs font-black text-red-600 dark:text-red-400 uppercase">KRITIS</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">IKK {'<'} 60</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">Memerlukan intervensi segera, kondisi mengkhawatirkan</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase mb-2">Validitas Metodologi</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-200 mb-3">
                      Pembobotan ini mengacu pada standar WHO dan Kemenkes RI, dengan penyesuaian konteks Indonesia. AHH mendapat bobot tertinggi karena merupakan outcome indikator yang mencerminkan efektivitas keseluruhan sistem kesehatan.
                    </p>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-blue-300 dark:border-blue-700">
                      <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1">Catatan Penting</div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Analisis ini memberikan gambaran holistik kondisi kesehatan dengan mempertimbangkan aspek outcome (AHH), preventif (imunisasi), dan infrastruktur (sanitasi) secara berimbang.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase mb-2">Sumber Data</div>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                      <li>• BPS Web API - Angka Harapan Hidup (Var: 501) - Breakdown per Gender</li>
                      <li>• BPS Web API - Cakupan Imunisasi Dasar Lengkap (Var: 2280)</li>
                      <li>• BPS Web API - Akses Sanitasi Layak (Var: 847)</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB BAR + DRAG HANDLE */}
            <div className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 shadow-2xl flex-shrink-0">
              {/* DRAG HANDLE */}
              {adaPanelTerbuka && (
                <div
                  className={`flex items-center justify-center py-1.5 cursor-row-resize select-none group ${isDragging ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} transition-colors`}
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                  title="Drag untuk mengubah tinggi panel"
                >
                  <div className={`flex flex-col gap-0.5 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'}`}>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                    <div className="w-5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto"></div>
                  </div>
                </div>
              )}

              {/* TAB BUTTONS */}
              <div className="p-3 pt-1">
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => { adaPanelTerbuka && panelInfoTerbuka ? setPanelInfoTerbuka(false) : bukaPanel(setPanelInfoTerbuka); }}
                    className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelInfoTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    <Info size={14} /> Info
                    {panelInfoTerbuka ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>

                  <button
                    onClick={() => { adaPanelTerbuka && panelTabelTerbuka ? setPanelTabelTerbuka(false) : bukaPanel(setPanelTabelTerbuka); }}
                    className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelTabelTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    <Table size={14} /> Tabel
                    {panelTabelTerbuka ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>

                  <button
                    onClick={() => { adaPanelTerbuka && panelKebijakanTerbuka ? setPanelKebijakanTerbuka(false) : bukaPanel(setPanelKebijakanTerbuka); }}
                    className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${panelKebijakanTerbuka ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    <ClipboardList size={14} /> Kebijakan
                    {panelKebijakanTerbuka ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>

                  <button
                    onClick={() => { adaPanelTerbuka && panelMetodologiTerbuka ? setPanelMetodologiTerbuka(false) : bukaPanel(setPanelMetodologiTerbuka); }}
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
          </div>
        )}
      </div>
    </div>
  );
}