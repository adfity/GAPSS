"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Play, Download, Plus, Minus, ChevronDown, Filter, Save, X,
  Heart, RotateCcw, ChevronUp, Info, Table, FileText,
  ClipboardList, Search, Eye, EyeOff, Activity, Map, Loader2,
  BarChart2, Check, TrendingUp, Shield, Droplets, Stethoscope, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar from '@/components/layout/HeaderBar';
import SideBar from "@/components/layout/sideBar";
import {
  TAHUN_TERSEDIA, KATEGORI_KESEHATAN, BASEMAPS,
  PUSAT_DEFAULT, ZOOM_DEFAULT, PANEL_HEIGHT_DEFAULT, PANEL_HEIGHT_MIN, PANEL_HEIGHT_MAX,
  DATASET_LABELS_KESEHATAN, INDIKATOR_LABELS_KESEHATAN, INDIKATOR_ICON_MAP_KESEHATAN,
  INDIKATOR_COLORS_KESEHATAN,
  dbToUI, getWarnaByIndikatorKesehatan, getKategoriByIndikatorKesehatan,
  ModalCekDataKesehatan, ModalAlertKomboTidakAdaKesehatan,
  SelectorAnalisisKesehatan, TrendPanelKesehatan, MetadataPanelKesehatan,
} from '@/components/analisis/sdm/health';

export default function KesehatanPage() {
  const [sedangMenganalisis, setSedangMenganalisis] = useState(false);
  const [hasilAnalisis, setHasilAnalisis]           = useState(null);
  const [kategoriTerpilih, setKategoriTerpilih]     = useState('SEMUA');
  const [indikatorTerpilih, setIndikatorTerpilih]   = useState('SEMUA');
  const [adalahClient, setAdalahClient]             = useState(false);
  const [petaSedangMemuat, setPetaSedangMemuat]     = useState(true);

  const [daftarTersimpan, setDaftarTersimpan]       = useState([]);
  const [sedangMuatAwal, setSedangMuatAwal]         = useState(true);
  const [alertKomboTidakAda, setAlertKomboTidakAda] = useState(null);
  const [dataBaruDariBPS, setDataBaruDariBPS]       = useState(false);

  const [tahunTerpilih, setTahunTerpilih]           = useState(2024);
  const [sedangCekData, setSedangCekData]           = useState(false);
  const [hasilCekData, setHasilCekData]             = useState(null);
  const pendingAnalisisRef                           = useRef(null);

  const [menuUnduhTerbuka, setMenuUnduhTerbuka]     = useState(false);
  const [menuFilterTerbuka, setMenuFilterTerbuka]   = useState(false);
  const [menuDatasetTerbuka, setMenuDatasetTerbuka] = useState(false);
  const [menuBasemapTerbuka, setMenuBasemapTerbuka] = useState(false);
  const [basemapTerpilih, setBasemapTerpilih]       = useState('CARTO_LIGHT');

  const [panelInfoTerbuka, setPanelInfoTerbuka]         = useState(false);
  const [panelTabelTerbuka, setPanelTabelTerbuka]       = useState(false);
  const [panelMetadataTerbuka, setPanelMetadataTerbuka] = useState(false);
  const [panelKebijakanTerbuka, setPanelKebijakanTerbuka] = useState(false);
  const [panelTrendTerbuka, setPanelTrendTerbuka]       = useState(false);

  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT_DEFAULT);
  const [isDragging, setIsDragging]   = useState(false);
  const dragStartY                     = useRef(null);
  const dragStartHeight               = useRef(null);
  const panelRef                       = useRef(null);

  const [koordinatCursor, setKoordinatCursor] = useState({ lat: 0, lng: 0 });
  const [currentZoom, setCurrentZoom]         = useState(ZOOM_DEFAULT);
  const [modalSaveTerbuka, setModalSaveTerbuka] = useState(false);
  const [namaSimpan, setNamaSimpan]           = useState('');
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [modalAnalisisTerbuka, setModalAnalisisTerbuka] = useState(false);
  const [pilihanIndikator, setPilihanIndikator] = useState('ALL');
  const [pernahAnalisis, setPernahAnalisis]   = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchTerbuka, setSearchTerbuka]     = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [provinsiDipilih, setProvinsiDipilih] = useState(null);
  const [modeBersih, setModeBersih]           = useState(false);
  const [loadingDataset, setLoadingDataset]   = useState({ AHH: false, IMUNISASI: false, SANITASI: false });

  const petaRef = useRef(null);
  const [KontainerPeta, setKontainerPeta] = useState(null);
  const [LapisanPeta, setLapisanPeta]     = useState(null);
  const [GeoJSON, setGeoJSON]             = useState(null);
  const [useMapEvents, setUseMapEvents]   = useState(null);

  // ── Computed ──
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

  const dataTerfilter = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return [];
    let f = hasilAnalisis.matched_features.features;
    if (kategoriTerpilih !== 'SEMUA') {
      f = f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === kategoriTerpilih);
    }
    if (indikatorTerpilih !== 'SEMUA') {
      f = f.filter(x => {
        const dk = x.properties?.health_analysis?.data_kesehatan || {};
        if (indikatorTerpilih === 'AHH')       return dk.AHH       != null;
        if (indikatorTerpilih === 'IMUNISASI') return dk.IMUNISASI != null;
        if (indikatorTerpilih === 'SANITASI')  return dk.SANITASI  != null;
        return true;
      });
    }
    return f;
  }, [hasilAnalisis, kategoriTerpilih, indikatorTerpilih]);

  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return { KRITIS:0, WASPADA:0, STABIL:0 };
    const f = hasilAnalisis.matched_features.features;
    return {
      KRITIS:  f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === 'KRITIS').length,
      WASPADA: f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === 'WASPADA').length,
      STABIL:  f.filter(x => getKategoriByIndikatorKesehatan(x, indikatorTerpilih) === 'STABIL').length,
    };
  }, [hasilAnalisis, indikatorTerpilih]);

  const adaPanelTerbuka = panelInfoTerbuka || panelTabelTerbuka || panelMetadataTerbuka || panelKebijakanTerbuka || panelTrendTerbuka;
  const bottomPanelH    = adaPanelTerbuka ? panelHeight : 48;
  const actionBtnBottom = bottomPanelH + 16;

  // ── Init ──
  useEffect(() => {
    setAdalahClient(true);
    setPetaSedangMemuat(true);
    import('react-leaflet').then(l => {
      setKontainerPeta(() => l.MapContainer);
      setLapisanPeta(() => l.TileLayer);
      setGeoJSON(() => l.GeoJSON);
      setUseMapEvents(() => l.useMapEvents);
      setPetaSedangMemuat(false);
    });
    import('leaflet/dist/leaflet.css');
  }, []);

  useEffect(() => { if (adalahClient) muatDariDB(); }, [adalahClient]);

  // ── DB ──
  const refreshDaftarDB = async () => {
    try {
      const r = await axios.get('http://127.0.0.1:8000/api/health-analysis/list/');
      setDaftarTersimpan(r.data.results || []);
    } catch (e) { console.error(e); }
  };

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get('http://127.0.0.1:8000/api/health-analysis/list/');
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => {
        const ai = (a.indikator||'ALL')==='ALL'?0:1, bi = (b.indikator||'ALL')==='ALL'?0:1;
        if (ai !== bi) return ai - bi;
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp||'').localeCompare(a.timestamp||'');
      });
      await muatDetailDariDB(sorted[0].analysis_id, sorted[0].tahun, sorted[0].indikator||'ALL', true);
    } catch (e) { console.error(e); }
    finally { setSedangMuatAwal(false); }
  };

  const muatDetailDariDB = async (analysisId, tahun, indikator, silent = false) => {
    const t = silent ? null : toast.loading('Memuat analisis...');
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/health-analysis/${analysisId}/`);
      if (t) toast.dismiss(t);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setIndikatorTerpilih(dbToUI(indikator || res.data.indikator || 'ALL'));
      setPilihanIndikator(indikator || res.data.indikator || 'ALL');
      setKategoriTerpilih('SEMUA');
      setPernahAnalisis(true);
      setProvinsiDipilih(null);
      setDataBaruDariBPS(false);
      if (!silent) toast.success(`Data dimuat: ${INDIKATOR_LABELS_KESEHATAN[indikator||'ALL']} ${tahun}`);
    } catch (e) {
      if (t) toast.dismiss(t);
      if (!silent) toast.error('Gagal memuat detail analisis');
      throw e;
    }
  };

  const handlePilihKomboSelector = async (tahun, indikator) => {
    const key = `${tahun}|${indikator}`;
    if (!kombinasiTersedia[key]) { setAlertKomboTidakAda({ tahun, indikator }); return; }
    await muatDetailDariDB(kombinasiTersedia[key].analysis_id, tahun, indikator);
  };

  const handleAmbilDariBPS = (tahun, indikator) => {
    setAlertKomboTidakAda(null);
    setTahunTerpilih(tahun);
    setPilihanIndikator(indikator);
    cekDataLaluAnalisis(indikator, tahun);
  };

  // ── Drag panel ──
  const handleDragStart = useCallback((e) => {
    const y = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y; dragStartHeight.current = panelHeight; setIsDragging(true);
  }, [panelHeight]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging || dragStartY.current === null) return;
    const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    setPanelHeight(Math.max(PANEL_HEIGHT_MIN, Math.min(PANEL_HEIGHT_MAX, dragStartHeight.current + (dragStartY.current - y))));
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false); dragStartY.current = null;
    if (panelHeight < 100) toggleAllPanels();
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
    [setPanelInfoTerbuka, setPanelTabelTerbuka, setPanelMetadataTerbuka, setPanelKebijakanTerbuka, setPanelTrendTerbuka].forEach(s => s(false));
    setter(true);
    if (panelHeight < 200) setPanelHeight(PANEL_HEIGHT_DEFAULT);
  };

  const toggleAllPanels = () => {
    [setPanelInfoTerbuka, setPanelTabelTerbuka, setPanelMetadataTerbuka, setPanelKebijakanTerbuka, setPanelTrendTerbuka].forEach(s => s(false));
  };

  // ── Search ──
  useEffect(() => {
    if (!hasilAnalisis?.matched_features?.features || !searchQuery.trim()) { setSearchSuggestions([]); return; }
    setSearchSuggestions(
      hasilAnalisis.matched_features.features
        .filter(f => f.properties?.health_analysis?.nama_provinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(f => ({
          nama:     f.properties.health_analysis.nama_provinsi,
          kategori: getKategoriByIndikatorKesehatan(f, indikatorTerpilih),
          warna:    getWarnaByIndikatorKesehatan(f, indikatorTerpilih),
        }))
        .slice(0, 5)
    );
  }, [searchQuery, hasilAnalisis, indikatorTerpilih]);

  const handleSearch = (namaProvinsi) => {
    const nama = namaProvinsi || searchQuery;
    if (!hasilAnalisis?.matched_features?.features || !nama.trim()) return;
    const fitur = hasilAnalisis.matched_features.features.find(
      f => f.properties?.health_analysis?.nama_provinsi?.toLowerCase() === nama.toLowerCase()
    );
    if (fitur && petaRef.current) {
      const coords = fitur.geometry.coordinates;
      let lat, lng;
      if (fitur.geometry.type === "MultiPolygon") {
        const p = coords[0][0]; lat = p.reduce((s,c)=>s+c[1],0)/p.length; lng = p.reduce((s,c)=>s+c[0],0)/p.length;
      } else {
        const p = coords[0];    lat = p.reduce((s,c)=>s+c[1],0)/p.length; lng = p.reduce((s,c)=>s+c[0],0)/p.length;
      }
      petaRef.current.setView([lat, lng], 7);
      setProvinsiDipilih(fitur.properties.health_analysis.nama_provinsi);
      toast.success(`Ditemukan: ${nama}`, { duration: 3000 });
      setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]);
    } else toast.error('Provinsi tidak ditemukan');
  };

  // ── Analisis ──
  const cekDataLaluAnalisis = async (indikator = null, tahun = null) => {
    const pilihan    = indikator || pilihanIndikator;
    const thn        = tahun    || tahunTerpilih;
    pendingAnalisisRef.current = { pilihan, tahunFetch: thn };
    setModalAnalisisTerbuka(false);
    setSedangCekData(true); setHasilCekData(null);
    try {
      const r = await axios.post('http://127.0.0.1:8000/api/check-health-data/', { tahun: thn, indikator: pilihan });
      setHasilCekData(r.data);
    } catch { toast.error('Gagal memeriksa ketersediaan data BPS'); }
    finally { setSedangCekData(false); }
  };

  const lanjutkanAnalisis = async () => {
    if (!pendingAnalisisRef.current) return;
    const { pilihan, tahunFetch } = pendingAnalisisRef.current;
    setHasilCekData(null); setSedangMenganalisis(true); setKategoriTerpilih('SEMUA');
    const t = toast.loading(`Mengambil data BPS kesehatan ${tahunFetch}...`);
    try {
      const r = await axios.post('http://127.0.0.1:8000/api/analyze-health-bps/', { tahun: tahunFetch, indikator: pilihan });
      toast.dismiss(t);
      if (r.data.status === 'success') {
        setHasilAnalisis(r.data);
        setIndikatorTerpilih(pilihan === 'ALL' ? 'SEMUA' : pilihan);
        setTahunTerpilih(tahunFetch); setPernahAnalisis(true); setDataBaruDariBPS(true);
        toast.success(`Berhasil: ${r.data.total_success} provinsi (${tahunFetch})!`, { duration: 5000 });
      }
    } catch (e) { toast.dismiss(t); toast.error(e.response?.data?.error || 'Gagal terhubung ke server'); }
    finally { setSedangMenganalisis(false); }
  };

  const resetAnalisis = () => {
    setHasilAnalisis(null); setKategoriTerpilih('SEMUA'); setIndikatorTerpilih('SEMUA');
    toggleAllPanels(); setProvinsiDipilih(null); setPernahAnalisis(false);
    setModeBersih(false); setDataBaruDariBPS(false);
    toast.success('Analisis berhasil direset');
  };

  const simpanAnalisis = async () => {
    if (!namaSimpan.trim()) return toast.error("Nama analisis tidak boleh kosong");
    setSedangMenyimpan(true);
    const t = toast.loading('Menyimpan...');
    try {
      const r = await axios.post('http://127.0.0.1:8000/api/save-health-analysis/', {
        name: namaSimpan, analysis_data: hasilAnalisis,
      });
      toast.dismiss(t);
      if (r.data.status === 'success') {
        toast.success(`"${namaSimpan}" berhasil disimpan!`);
        setModalSaveTerbuka(false); setNamaSimpan(''); setDataBaruDariBPS(false);
        await refreshDaftarDB();
      }
    } catch { toast.dismiss(t); toast.error('Gagal menyimpan'); }
    finally { setSedangMenyimpan(false); }
  };

  // ── Download ──
  const unduhBlob = (blob, nama) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = nama; a.click(); URL.revokeObjectURL(a.href);
  };

  const unduhDataset = async (jenis) => {
    if (!hasilAnalisis?.raw_datasets) return toast.error("Dataset tidak tersedia");
    setMenuDatasetTerbuka(false);
    const ds  = hasilAnalisis.raw_datasets;
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const tgl = new Date().toISOString().split('T')[0];

    const doAHH = async () => {
      if (!ds?.AHH || !Object.keys(ds.AHH).length) return toast.error("Data AHH tidak tersedia");
      setLoadingDataset(p => ({ ...p, AHH: true }));
      const t = toast.loading('Membuat file AHH...');
      try {
        const r = await axios.post('http://127.0.0.1:8000/api/download-ahh-xlsx/',
          { ahh_data: ds.AHH, timestamp: ds.timestamp, tahun: thn }, { responseType: 'blob' });
        unduhBlob(new Blob([r.data]), `Dataset_AHH_BPS_${thn}_${tgl}.xlsx`);
        toast.dismiss(t); toast.success('Dataset AHH diunduh!');
      } catch { toast.dismiss(t); toast.error('Gagal unduh AHH'); }
      finally { setLoadingDataset(p => ({ ...p, AHH: false })); }
    };
    const doImunisasi = async () => {
      if (!ds?.IMUNISASI || !Object.keys(ds.IMUNISASI).length) return toast.error("Data Imunisasi tidak tersedia");
      setLoadingDataset(p => ({ ...p, IMUNISASI: true }));
      const t = toast.loading('Membuat file Imunisasi...');
      try {
        const r = await axios.post('http://127.0.0.1:8000/api/download-imunisasi-xlsx/',
          { imunisasi_data: ds.IMUNISASI, timestamp: ds.timestamp, tahun: thn }, { responseType: 'blob' });
        unduhBlob(new Blob([r.data]), `Dataset_Imunisasi_BPS_${thn}_${tgl}.xlsx`);
        toast.dismiss(t); toast.success('Dataset Imunisasi diunduh!');
      } catch { toast.dismiss(t); toast.error('Gagal unduh Imunisasi'); }
      finally { setLoadingDataset(p => ({ ...p, IMUNISASI: false })); }
    };
    const doSanitasi = async () => {
      if (!ds?.SANITASI || !Object.keys(ds.SANITASI).length) return toast.error("Data Sanitasi tidak tersedia");
      setLoadingDataset(p => ({ ...p, SANITASI: true }));
      const t = toast.loading('Membuat file Sanitasi...');
      try {
        const r = await axios.post('http://127.0.0.1:8000/api/download-sanitasi-xlsx/',
          { sanitasi_data: ds.SANITASI, timestamp: ds.timestamp, tahun: thn }, { responseType: 'blob' });
        unduhBlob(new Blob([r.data]), `Dataset_Sanitasi_BPS_${thn}_${tgl}.xlsx`);
        toast.dismiss(t); toast.success('Dataset Sanitasi diunduh!');
      } catch { toast.dismiss(t); toast.error('Gagal unduh Sanitasi'); }
      finally { setLoadingDataset(p => ({ ...p, SANITASI: false })); }
    };

    if (jenis === 'ALL') { await doAHH(); await doImunisasi(); await doSanitasi(); }
    else if (jenis === 'AHH')       doAHH();
    else if (jenis === 'IMUNISASI') doImunisasi();
    else if (jenis === 'SANITASI')  doSanitasi();
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error("Data tidak tersedia");
    setMenuUnduhTerbuka(false);
    const r   = hasilAnalisis.analysis_summary;
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const tgl = new Date().toISOString().split('T')[0];
    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi: i.provinsi, Kategori: i.kategori, 'Skor Total': i.skor_total,
        'AHH (tahun)': i.ahh||'-', 'Imunisasi (%)': i.imunisasi||'-', 'Sanitasi (%)': i.sanitasi||'-',
      })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Analisis");
      XLSX.writeFile(wb, `Analisis_Kesehatan_BPS_${thn}_${tgl}.xlsx`); toast.success('Excel diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis,null,2)],{type:'application/json'}), `Analisis_Kesehatan_BPS_${thn}_${tgl}.json`);
      toast.success('JSON diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi','Kategori','Skor Total','AHH','Imunisasi','Sanitasi'].join(','),
        ...r.map(s=>[s.provinsi,s.kategori,s.skor_total,s.ahh||'-',s.imunisasi||'-',s.sanitasi||'-'].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv],{type:'text/csv'}), `Analisis_Kesehatan_BPS_${thn}_${tgl}.csv`);
      toast.success('CSV diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features,null,2)],{type:'application/json'}), `Spasial_Kesehatan_BPS_${thn}_${tgl}.geojson`);
      toast.success('GeoJSON diunduh');
    }
  };

  // ── Misc ──
  const hitungScaleKm = (zoom) => ({5:1000,6:500,7:200,8:100,9:50,10:25})[Math.floor(zoom)] || 1000;
  const getButtonText = () => {
    if (sedangMenganalisis) return 'Loading...';
    if (!pernahAnalisis) return 'Analisis';
    return {
      SEMUA:     'Semua Indikator',
      AHH:       'Analisis AHH',
      IMUNISASI: 'Analisis Imunisasi',
      SANITASI:  'Analisis Sanitasi',
    }[indikatorTerpilih] || 'Analisis';
  };

  const MouseTracker = () => {
    if (!useMapEvents) return null;
    const C = () => {
      useMapEvents({
        mousemove: (e) => setKoordinatCursor({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) }),
        zoomend:   (e) => setCurrentZoom(e.target.getZoom()),
      });
      return null;
    };
    return <C />;
  };

  if (!adalahClient) return null;
  const basemapConfig = BASEMAPS[basemapTerpilih];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {!modeBersih && <HeaderBar />}
      {!modeBersih && <SideBar />}

      {/* ── MODALS ── */}
      <ModalAlertKomboTidakAdaKesehatan
        info={alertKomboTidakAda}
        onTutup={() => setAlertKomboTidakAda(null)}
        onAmbilDariBPS={handleAmbilDariBPS}
      />
      <ModalCekDataKesehatan
        tahun={pendingAnalisisRef.current?.tahunFetch || tahunTerpilih}
        indikator={pendingAnalisisRef.current?.pilihan || pilihanIndikator}
        hasilCek={hasilCekData} sedangCek={sedangCekData}
        onTutup={() => setHasilCekData(null)} onLanjut={lanjutkanAnalisis}
      />

      {/* Modal Pilih Analisis */}
      {modalAnalisisTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Data Analisis</h3>
              <button onClick={() => setModalAnalisisTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} className="text-slate-500" /></button>
            </div>
            {/* Pilih tahun */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Calendar size={13}/> Tahun Data BPS</label>
              <div className="flex gap-2 flex-wrap">
                {TAHUN_TERSEDIA.map(th => (
                  <button key={th} onClick={() => setTahunTerpilih(th)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${tahunTerpilih===th?'bg-emerald-600 border-emerald-600 text-white':'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300'}`}>
                    {th}
                  </button>
                ))}
              </div>
            </div>
            {/* Pilih indikator */}
            <div className="space-y-2 mb-6">
              {[
                { key:'ALL',       label:'Semua Indikator',              desc:'AHH + Imunisasi + Sanitasi',          icon:<BarChart2 size={15}/>   },
                { key:'AHH',       label:'Angka Harapan Hidup',          desc:'Rata-rata AHH laki-laki & perempuan', icon:<Heart size={15}/>       },
                { key:'IMUNISASI', label:'Cakupan Imunisasi Dasar',      desc:'Persentase balita imunisasi lengkap', icon:<Shield size={15}/>      },
                { key:'SANITASI',  label:'Akses Sanitasi Layak',         desc:'Persentase RT sanitasi layak',        icon:<Droplets size={15}/>    },
              ].map(opt => (
                <button key={opt.key} onClick={() => setPilihanIndikator(opt.key)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3 ${pilihanIndikator===opt.key?'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20':'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                  <span className={`mt-0.5 flex-shrink-0 ${pilihanIndikator===opt.key?'text-emerald-500':'text-slate-400'}`}>{opt.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                  {pilihanIndikator===opt.key && <Check size={15} className="text-emerald-500 flex-shrink-0 mt-0.5"/>}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAnalisisTerbuka(false)} className="flex-1 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={() => cekDataLaluAnalisis()} disabled={sedangMenganalisis}
                className="flex-1 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                <Search size={13}/> Cek & Analisis {tahunTerpilih}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Save */}
      {modalSaveTerbuka && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Simpan Analisis</h3>
              <button onClick={() => setModalSaveTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} className="text-slate-500"/></button>
            </div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Nama Analisis</label>
            <input type="text" value={namaSimpan} onChange={e => setNamaSimpan(e.target.value)}
              onKeyPress={e => e.key==='Enter' && simpanAnalisis()}
              placeholder={`contoh: Analisis Kesehatan ${hasilAnalisis?.tahun||tahunTerpilih}`}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm mb-6" />
            <div className="flex gap-3">
              <button onClick={() => setModalSaveTerbuka(false)} className="flex-1 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Batal</button>
              <button onClick={simpanAnalisis} disabled={sedangMenyimpan || !namaSimpan.trim()}
                className="flex-1 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50">
                {sedangMenyimpan ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PETA ── */}
      <div className={`fixed inset-0 bg-white dark:bg-slate-900 ${modeBersih ? 'top-0' : 'top-16'}`}>

        {sedangMuatAwal && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-emerald-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Memuat data dari database...</p>
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
                data={{ type:"FeatureCollection", features: hasilAnalisis.matched_features.features }}
                style={(fitur) => {
                  const a   = fitur.properties?.health_analysis || {};
                  const kat = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
                  const w   = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
                  const vis = kategoriTerpilih === 'SEMUA' || kat === kategoriTerpilih;
                  const hl  = provinsiDipilih === a.nama_provinsi;
                  return { fillColor:w, weight:hl?4:2, opacity:(vis&&w!=='#cbd5e1')?1:0, color:hl?'#10b981':'white', fillOpacity:(vis&&w!=='#cbd5e1')?0.75:0 };
                }}
                onEachFeature={(fitur, lapisan) => {
                  const a   = fitur.properties?.health_analysis || {};
                  const dk  = a.data_kesehatan || {};
                  const w   = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
                  const kat = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
                  const wawasan = a.insights?.map(i => `<div style="margin-bottom:3px;padding-left:6px;border-left:2px solid ${w};font-size:9px;">${i}</div>`).join('') || '';

                  lapisan.bindTooltip(
                    `<div style="font-family:inherit;padding:4px;">
                      <div style="font-weight:900;color:#0f172a;text-transform:uppercase;font-size:11px;">${a.nama_provinsi}</div>
                      <div style="font-size:9px;font-weight:800;color:${w};margin-top:2px;">${kat||'-'}</div>
                      <div style="font-size:8px;color:#64748b;margin-top:2px;">Skor: ${a.skor_total}</div>
                    </div>`,
                    { sticky:true, opacity:0.95 }
                  );

                  let indHTML = '';
                  if (indikatorTerpilih==='SEMUA') {
                    indHTML = `<div style="display:grid;gap:3px;">
                      <div style="background:#fef2f2;padding:5px;border-radius:5px;border-left:2px solid #ef4444;"><div style="font-size:7px;font-weight:700;color:#7f1d1d;">AHH</div><div style="font-size:11px;font-weight:900;color:#dc2626;">${dk.AHH!=null?dk.AHH+' th':'-'}</div></div>
                      <div style="background:#eff6ff;padding:5px;border-radius:5px;border-left:2px solid #3b82f6;"><div style="font-size:7px;font-weight:700;color:#1e3a8a;">IMUNISASI</div><div style="font-size:11px;font-weight:900;color:#2563eb;">${dk.IMUNISASI!=null?dk.IMUNISASI+'%':'-'}</div></div>
                      <div style="background:#f0fdf4;padding:5px;border-radius:5px;border-left:2px solid #10b981;"><div style="font-size:7px;font-weight:700;color:#14532d;">SANITASI</div><div style="font-size:11px;font-weight:900;color:#059669;">${dk.SANITASI!=null?dk.SANITASI+'%':'-'}</div></div>
                    </div>`;
                  } else if (indikatorTerpilih==='AHH') {
                    indHTML = `<div style="background:#fef2f2;padding:8px;border-radius:8px;border-left:3px solid #ef4444;"><div style="font-size:8px;font-weight:700;color:#7f1d1d;">ANGKA HARAPAN HIDUP</div><div style="font-size:16px;font-weight:900;color:#dc2626;">${dk.AHH!=null?dk.AHH+' tahun':'-'}</div></div>`;
                  } else if (indikatorTerpilih==='IMUNISASI') {
                    indHTML = `<div style="background:#eff6ff;padding:8px;border-radius:8px;border-left:3px solid #3b82f6;"><div style="font-size:8px;font-weight:700;color:#1e3a8a;">CAKUPAN IMUNISASI</div><div style="font-size:16px;font-weight:900;color:#2563eb;">${dk.IMUNISASI!=null?dk.IMUNISASI+'%':'-'}</div></div>`;
                  } else if (indikatorTerpilih==='SANITASI') {
                    indHTML = `<div style="background:#f0fdf4;padding:8px;border-radius:8px;border-left:3px solid #10b981;"><div style="font-size:8px;font-weight:700;color:#14532d;">AKSES SANITASI</div><div style="font-size:16px;font-weight:900;color:#059669;">${dk.SANITASI!=null?dk.SANITASI+'%':'-'}</div></div>`;
                  }

                  lapisan.bindPopup(
                    `<div style="font-family:inherit;min-width:260px;max-width:260px;color:#1e293b;padding:4px;">
                      <div style="background:${w};color:white;padding:8px;border-radius:8px;margin-bottom:6px;">
                        <div style="font-weight:900;font-size:12px;text-transform:uppercase;">${a.nama_provinsi}</div>
                        <div style="background:rgba(255,255,255,.2);border-radius:5px;padding:5px;margin-top:5px;font-size:10px;font-weight:900;text-align:center;">Skor: ${a.skor_total} — ${kat||'-'}</div>
                      </div>
                      <div style="padding:0 2px;">
                        <div style="margin-bottom:6px;">${indHTML}</div>
                        <div style="font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #f1f5f9;padding-bottom:2px;">ANALISIS</div>
                        <div style="font-size:9px;color:#334155;line-height:1.4;background:#f8fafc;padding:6px;border-radius:5px;border-left:2px solid ${w};">${wawasan}</div>
                      </div>
                    </div>`,
                    { maxWidth:280, maxHeight:400 }
                  );
                }}
              />
            )}
          </KontainerPeta>
        )}

        {/* Title */}
        {!modeBersih && (
          <div className="absolute top-6 left-6 z-[1000]">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
              <Stethoscope size={15} className="text-white flex-shrink-0" />
              <span className="text-sm font-black text-white uppercase tracking-wide">SDM Nasional Kesehatan</span>
            </div>
          </div>
        )}

        {/* Selector */}
        {!modeBersih && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000]">
            <SelectorAnalisisKesehatan
              hasilAnalisis={hasilAnalisis}
              kombinasiTersedia={kombinasiTersedia}
              tahunTerpilih={tahunTerpilih}
              onPilih={handlePilihKomboSelector}
              sedangMuatAwal={sedangMuatAwal}
            />
          </div>
        )}

        {/* Zoom */}
        {!modeBersih && (
          <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2">
            <button onClick={() => petaRef.current?.zoomIn()}  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Plus size={16}/></button>
            <button onClick={() => petaRef.current?.zoomOut()} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Minus size={16}/></button>
          </div>
        )}

        {/* Mode bersih */}
        {hasilAnalisis && (
          <div className="absolute top-[170px] left-6 z-[1000]">
            <button onClick={() => setModeBersih(!modeBersih)}
              className="p-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-90 border-2 border-white dark:border-slate-700 bg-gradient-to-br from-emerald-600 to-emerald-500">
              {modeBersih ? <EyeOff size={16} className="text-white"/> : <Eye size={16} className="text-white"/>}
            </button>
          </div>
        )}

        {/* Basemap */}
        {!modeBersih && (
          <div className={`absolute left-6 z-[1001] ${hasilAnalisis ? 'top-[215px]' : 'top-[170px]'}`}>
            <div className="relative">
              <button onClick={() => setMenuBasemapTerbuka(!menuBasemapTerbuka)} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Map size={16}/></button>
              {menuBasemapTerbuka && (
                <div className="absolute left-full ml-2 top-0 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Pilih Basemap</div>
                  <div className="p-1.5 space-y-0.5 max-h-72 overflow-y-auto">
                    {Object.entries(BASEMAPS).map(([key, bm]) => (
                      <button key={key} onClick={() => { setBasemapTerpilih(key); setMenuBasemapTerbuka(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${basemapTerpilih===key?'bg-emerald-500 text-white':'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        <div className={`w-7 h-7 rounded flex-shrink-0 border ${basemapTerpilih===key?'border-white/40':'border-slate-200 dark:border-slate-600'} ${bm.preview}`}/>
                        <span className="text-xs font-medium truncate">{bm.label}</span>
                        {basemapTerpilih===key && <Check size={13} className="text-white ml-auto flex-shrink-0"/>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        {hasilAnalisis && !modeBersih && (
          <div className="absolute top-[263px] left-6 z-[1000]">
            {searchTerbuka ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 flex gap-2">
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onKeyPress={e => e.key==='Enter' && handleSearch()}
                    placeholder="Cari provinsi..." autoFocus
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none w-48"/>
                  <button onClick={() => handleSearch()} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700"><Search size={15}/></button>
                  <button onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); setProvinsiDipilih(null); }} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300"><X size={15}/></button>
                </div>
                {searchSuggestions.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                    {searchSuggestions.map((s, i) => (
                      <button key={i} onClick={() => handleSearch(s.nama)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{s.nama}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: s.warna+'20', color: s.warna }}>{s.kategori}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchTerbuka(true)} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"><Search size={16}/></button>
            )}
          </div>
        )}

        {/* Kanan atas */}
        {!modeBersih && (
          <div className="absolute top-6 right-6 z-[1000] space-y-2">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400">Lat:</span> {koordinatCursor.lat} | <span className="text-emerald-600 dark:text-emerald-400">Lng:</span> {koordinatCursor.lng}
              </div>
            </div>
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="h-2 bg-slate-300 dark:bg-slate-600 mb-1" style={{ width:'80px', borderLeft:'2px solid #64748b', borderRight:'2px solid #64748b', borderBottom:'2px solid #64748b' }}/>
              <div className="text-[11px] font-medium text-center text-slate-700 dark:text-slate-300">{hitungScaleKm(currentZoom)} km</div>
            </div>
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
              {Object.entries(KATEGORI_KESEHATAN).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 mb-1.5 last:mb-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.warna }}/>
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{v.label}</span>
                  </div>
                  {hasilAnalisis && (
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white">
                      {jumlahKategori[k]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {hasilAnalisis && (
              <div className="relative">
                <button onClick={() => { setMenuFilterTerbuka(!menuFilterTerbuka); setMenuUnduhTerbuka(false); }}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-medium hover:bg-slate-50 transition-all flex items-center justify-between gap-2 shadow">
                  <div className="flex items-center gap-1.5"><Filter size={13} className="text-slate-400"/> {kategoriTerpilih}</div>
                  <ChevronDown size={13} className={`text-slate-400 transition-transform ${menuFilterTerbuka?'rotate-180':''}`}/>
                </button>
                {menuFilterTerbuka && (
                  <div className="absolute top-full mt-1 right-0 w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] border border-slate-200 dark:border-slate-700 py-1">
                    {["SEMUA","KRITIS","WASPADA","STABIL"].map(kat => (
                      <button key={kat} onClick={() => { setKategoriTerpilih(kat); setMenuFilterTerbuka(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-all ${kategoriTerpilih===kat?'bg-emerald-500 text-white':'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        {kat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!modeBersih && (
          <div className="absolute left-1/2 -translate-x-1/2 z-[1002] transition-all duration-200" style={{ bottom:`${actionBtnBottom}px` }}>
            <div className="flex gap-2.5 items-center">
              <div className="relative">
                <button
                  onClick={() => !pernahAnalisis
                    ? (setPilihanIndikator('ALL'), setModalAnalisisTerbuka(true))
                    : setModalAnalisisTerbuka(true)
                  }
                  disabled={sedangMenganalisis || sedangCekData}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-semibold text-xs tracking-wide hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50 transition-all uppercase active:scale-95 flex items-center gap-2 whitespace-nowrap">
                  {sedangCekData ? <Loader2 size={13} className="animate-spin"/> : sedangMenganalisis ? <Loader2 size={13} className="animate-pulse"/> : <Play size={13}/>}
                  {sedangCekData ? 'Memeriksa...' : getButtonText()}
                </button>
              </div>
              {hasilAnalisis && (
                <>
                  {dataBaruDariBPS && (
                    <button onClick={() => { setNamaSimpan(''); setModalSaveTerbuka(true); }}
                      className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-semibold text-xs tracking-wide hover:shadow-xl hover:shadow-teal-500/30 transition-all uppercase active:scale-95 flex items-center gap-2">
                      <Save size={13}/> Simpan
                    </button>
                  )}
                  <button onClick={resetAnalisis} className="px-5 py-2.5 bg-gradient-to-r from-slate-600 to-slate-500 text-white rounded-xl font-semibold text-xs tracking-wide hover:shadow-xl transition-all uppercase active:scale-95 flex items-center gap-2">
                    <RotateCcw size={13}/> Reset
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── BOTTOM PANELS ── */}
        {hasilAnalisis && !modeBersih && (
          <div ref={panelRef} className="absolute bottom-0 left-0 right-0 z-[1001] flex flex-col"
            style={{ height: adaPanelTerbuka ? `${panelHeight}px` : 'auto' }}>

            {/* INFO */}
            {panelInfoTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Activity className="text-emerald-500" size={22}/>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Ringkasan Analisis Kesehatan</h2>
                        <div className="flex items-center gap-2 mt-1">
                          {hasilAnalisis.tahun && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"><Calendar size={9}/> Tahun {hasilAnalisis.tahun}</span>}
                          {hasilAnalisis.indikator && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800"><BarChart2 size={9}/> {INDIKATOR_LABELS_KESEHATAN[hasilAnalisis.indikator]||hasilAnalisis.indikator}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setPanelInfoTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={17} className="text-slate-500"/></button>
                  </div>
                  {hasilAnalisis.timestamp && <div className="mb-4 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Calendar size={11}/> {new Date(hasilAnalisis.timestamp).toLocaleString('id-ID')}</div>}
                  {hasilAnalisis.dataset_aktif?.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest self-center">Dataset aktif:</span>
                      {hasilAnalisis.dataset_aktif.map(k => <span key={k} className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">{DATASET_LABELS_KESEHATAN[k]||k}</span>)}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { l:'Total Provinsi', v:hasilAnalisis.total_success, c:'emerald' },
                      { l:'Kritis',  v:jumlahKategori.KRITIS,  c:'red'    },
                      { l:'Waspada', v:jumlahKategori.WASPADA, c:'yellow' },
                      { l:'Stabil',  v:jumlahKategori.STABIL,  c:'green'  },
                    ].map(x => (
                      <div key={x.l} className={`bg-${x.c}-50 dark:bg-${x.c}-900/20 rounded-xl p-3 border border-${x.c}-200 dark:border-${x.c}-800`}>
                        <div className={`text-[10px] font-medium text-${x.c}-600 dark:text-${x.c}-400 uppercase mb-1`}>{x.l}</div>
                        <div className={`text-xl font-bold text-${x.c}-700 dark:text-${x.c}-300`}>{x.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TABEL */}
            {panelTabelTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Matriks Kesehatan</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 font-medium">{dataTerfilter.length} Wilayah</span>
                        {hasilAnalisis?.tahun && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"><Calendar size={9}/> {hasilAnalisis.tahun}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <button onClick={() => { setMenuUnduhTerbuka(!menuUnduhTerbuka); setMenuFilterTerbuka(false); }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm">
                          <Download size={12}/> Unduh
                        </button>
                        {menuUnduhTerbuka && (
                          <div className="absolute top-full mt-1 right-0 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-[1002] border border-slate-200 dark:border-slate-700 py-1">
                            {['GEOJSON','JSON','EXCEL','CSV'].map(fmt => (
                              <button key={fmt} onClick={() => eksporData(fmt)} className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                <Download size={11} className="text-emerald-500"/> {fmt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPanelTabelTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={17} className="text-slate-500"/></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold text-slate-500 uppercase">
                          <th className="px-3 py-2 text-center">No</th>
                          <th className="px-3 py-2">Provinsi</th>
                          <th className="px-3 py-2 text-center">Skor</th>
                          {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='AHH')       && <th className="px-3 py-2 text-center">AHH (thn)</th>}
                          {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='IMUNISASI') && <th className="px-3 py-2 text-center">Imunisasi (%)</th>}
                          {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='SANITASI')  && <th className="px-3 py-2 text-center">Sanitasi (%)</th>}
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const d   = fitur.properties.health_analysis;
                          const dk  = d.data_kesehatan || {};
                          const w   = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
                          const kat = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] text-slate-400">{idx+1}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">{d.nama_provinsi}</td>
                              <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">{d.skor_total}</span></td>
                              {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='AHH')       && <td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dk.AHH??'-'}</td>}
                              {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='IMUNISASI') && <td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dk.IMUNISASI!=null?`${dk.IMUNISASI}%`:'-'}</td>}
                              {(indikatorTerpilih==='SEMUA'||indikatorTerpilih==='SANITASI')  && <td className="px-3 py-2 text-center text-xs text-slate-600 dark:text-slate-400">{dk.SANITASI!=null?`${dk.SANITASI}%`:'-'}</td>}
                              <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-medium border" style={{ borderColor:w+'50', color:w }}>{kat}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* KEBIJAKAN */}
            {panelKebijakanTerbuka && (
              <div className="flex-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3"><ClipboardList className="text-emerald-500" size={22}/><h3 className="text-base font-bold text-slate-900 dark:text-white">Rekomendasi Kebijakan</h3></div>
                    <button onClick={() => setPanelKebijakanTerbuka(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={17} className="text-slate-500"/></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold text-slate-500 uppercase">
                          <th className="px-3 py-2 text-center">No</th><th className="px-3 py-2">Provinsi</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Prioritas</th><th className="px-3 py-2">Rekomendasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dataTerfilter.map((fitur, idx) => {
                          const d   = fitur.properties.health_analysis;
                          const rek = d.rekomendasi?.[0];
                          const w   = getWarnaByIndikatorKesehatan(fitur, indikatorTerpilih);
                          const kat = getKategoriByIndikatorKesehatan(fitur, indikatorTerpilih);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                              <td className="px-3 py-2 text-center text-[10px] text-slate-400">{idx+1}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">{d.nama_provinsi}</td>
                              <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[10px] font-medium border" style={{ borderColor:w+'50', color:w }}>{kat}</span></td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${kat==='KRITIS'?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300':kat==='WASPADA'?'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300':'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>{rek?.priority||'Normal'}</span></td>
                              <td className="px-3 py-2 max-w-md"><ul className="space-y-0.5 text-[10px]">{rek?.actions?.map((a,i) => <li key={i} className="text-slate-600 dark:text-slate-300">• {a}</li>) || <li className="text-slate-400">Pertahankan kondisi saat ini</li>}</ul></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* METADATA */}
            {panelMetadataTerbuka && (
              <MetadataPanelKesehatan
                hasilAnalisis={hasilAnalisis}
                indikatorTerpilih={indikatorTerpilih}
                tahunTerpilih={tahunTerpilih}
                loadingDataset={loadingDataset}
                onTutup={() => setPanelMetadataTerbuka(false)}
                onUnduhDataset={unduhDataset}
                menuDatasetTerbuka={menuDatasetTerbuka}
                setMenuDatasetTerbuka={setMenuDatasetTerbuka}
              />
            )}

            {/* TREND */}
            {panelTrendTerbuka && (
              <TrendPanelKesehatan daftarTersimpan={daftarTersimpan} onTutup={() => setPanelTrendTerbuka(false)} />
            )}

            {/* TAB BAR */}
            <div className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 shadow-2xl flex-shrink-0">
              {adaPanelTerbuka && (
                <div className={`flex items-center justify-center py-1.5 cursor-row-resize select-none group ${isDragging?'bg-emerald-50 dark:bg-emerald-900/10':'hover:bg-slate-50 dark:hover:bg-slate-800/50'} transition-colors`}
                  onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
                  <div className={`flex flex-col gap-0.5 transition-opacity ${isDragging?'opacity-100':'opacity-40 group-hover:opacity-80'}`}>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"/>
                    <div className="w-8 h-0.5 rounded-full bg-slate-400 dark:bg-slate-500"/>
                    <div className="w-5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto"/>
                  </div>
                </div>
              )}
              <div className="p-3 pt-1">
                <div className="flex justify-center gap-2 flex-wrap">
                  {[
                    { label:'Info',     icon:<Info size={13}/>,         setter:setPanelInfoTerbuka,     state:panelInfoTerbuka      },
                    { label:'Tabel',    icon:<Table size={13}/>,        setter:setPanelTabelTerbuka,    state:panelTabelTerbuka     },
                    { label:'Kebijakan',icon:<ClipboardList size={13}/>,setter:setPanelKebijakanTerbuka,state:panelKebijakanTerbuka },
                    { label:'Metadata', icon:<FileText size={13}/>,     setter:setPanelMetadataTerbuka, state:panelMetadataTerbuka  },
                    { label:'Tren',     icon:<TrendingUp size={13}/>,   setter:setPanelTrendTerbuka,    state:panelTrendTerbuka, activeColor:'bg-emerald-600' },
                  ].map(tab => (
                    <button key={tab.label}
                      onClick={() => adaPanelTerbuka && tab.state ? tab.setter(false) : bukaPanel(tab.setter)}
                      className={`px-5 py-2 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1.5 ${tab.state ? (tab.activeColor||'bg-emerald-500') + ' text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      {tab.icon} {tab.label}
                      {tab.state ? <ChevronDown size={12}/> : <ChevronUp size={12}/>}
                    </button>
                  ))}
                  {adaPanelTerbuka && (
                    <button onClick={toggleAllPanels} className="px-5 py-2 rounded-xl text-[10px] font-medium transition-all flex items-center gap-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
                      <ChevronDown size={12}/> Tutup
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