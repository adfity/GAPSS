"use client";
// ─── USER IKP PAGE ────────────────────────────────────────────────────────────
// Akses: lihat peta tersimpan + ganti tahun/indikator + usul kebijakan
// TIDAK BISA: jalankan analisis baru, simpan, hapus, CRUD bank kebijakan langsung
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Brain, Wheat, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar  from '@/components/layout/HeaderBar';
import SideBar    from '@/components/layout/sideBar';
import Footerauth from '@/components/layout/footerauth';
import PetaPangan_User  from '@/components/analisis/pangan/petaPangan_user';
import TabsPangan_User  from '@/components/analisis/pangan/tabPangan_user';
import {
  getWarnaIKP, getKategoriIKP,
  INDIKATOR_LABELS_IKP, ZOOM_DEFAULT_IKP,
} from '@/components/analisis/pangan/petaPangan';

const API = 'http://127.0.0.1:8000/api';

export default function UserPanganPage() {
  const [hasilAnalisis,     setHasilAnalisis]     = useState(null);
  const [kategoriTerpilih,  setKategoriTerpilih]  = useState('SEMUA');
  const [indikatorTerpilih, setIndikatorTerpilih] = useState('SEMUA');
  const [isClient,          setIsClient]          = useState(false);
  const [activeTab,         setActiveTab]         = useState('info');
  const [daftarTersimpan,   setDaftarTersimpan]   = useState([]);
  const [sedangMuatAwal,    setSedangMuatAwal]    = useState(true);
  const [tahunTerpilih,     setTahunTerpilih]     = useState(2024);
  const [basemap,           setBasemap]           = useState('OSM');
  const [koordinatCursor,   setKoordinatCursor]   = useState({ lat: '0.0000', lng: '0.0000' });
  const [currentZoom,       setCurrentZoom]       = useState(ZOOM_DEFAULT_IKP);
  const [provinsiDipilih,   setProvinsiDipilih]   = useState(null);
  const [leafletReady,      setLeafletReady]      = useState(false);
  const [MapCont,           setMapCont]           = useState(null);
  const [TileLay,           setTileLay]           = useState(null);
  const [GeoComp,           setGeoComp]           = useState(null);
  const [activeAnalysisId,  setActiveAnalysisId]  = useState(null);
  const petaRef = useRef(null);

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
      const ind = a.indikator || 'SEMUA';
      const key = `${a.tahun}|${ind}`;
      if (!map[key] || a.timestamp > map[key].timestamp)
        map[key] = { timestamp: a.timestamp, analysis_id: a.analysis_id };
    });
    return map;
  }, [daftarTersimpan]);

  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return {};
    const counts = {
      SANGAT_RENTAN: 0, RENTAN: 0, AGAK_RENTAN: 0,
      AGAK_TAHAN: 0, TAHAN: 0, SANGAT_TAHAN: 0, TIDAK_TERANALISIS: 0,
    };
    hasilAnalisis.matched_features.features.forEach(f => {
      const k = getKategoriIKP(f, indikatorTerpilih);
      if (counts[k] !== undefined) counts[k]++;
    });
    return counts;
  }, [hasilAnalisis, indikatorTerpilih]);

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/ikp-analysis/list/`);
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => {
        const ai = (a.indikator || 'SEMUA') === 'SEMUA' ? 0 : 1;
        const bi = (b.indikator || 'SEMUA') === 'SEMUA' ? 0 : 1;
        if (ai !== bi) return ai - bi;
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
      await muatDetail(sorted[0].analysis_id, sorted[0].tahun, sorted[0].indikator || 'SEMUA', true);
    } catch {}
    finally { setSedangMuatAwal(false); }
  };

  const muatDetail = async (id, tahun, indikator, silent = false) => {
    const tid = silent ? null : toast.loading('Memuat...');
    try {
      const res = await axios.get(`${API}/ikp-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setIndikatorTerpilih(indikator || res.data.indikator || 'SEMUA');
      setKategoriTerpilih('SEMUA');
      setProvinsiDipilih(null);
      setActiveAnalysisId(id);
      if (!silent) toast.success(`Dimuat: ${INDIKATOR_LABELS_IKP[indikator || 'SEMUA']} ${tahun}`);
    } catch {
      if (tid) toast.dismiss(tid);
      if (!silent) toast.error('Gagal memuat analisis');
    }
  };

  const handlePilihKombo = useCallback(async (tahun, indikator) => {
    const key = `${tahun}|${indikator}`;
    if (!kombinasiTersedia[key]) { toast.error('Data belum tersedia.'); return; }
    await muatDetail(kombinasiTersedia[key].analysis_id, tahun, indikator);
  }, [kombinasiTersedia]);

  const unduhBlob = (blob, nama) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nama });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const eksporData = (format) => {
    if (!hasilAnalisis) return toast.error('Data tidak tersedia');
    const r   = hasilAnalisis.analysis_summary || [];
    const thn = hasilAnalisis.tahun || tahunTerpilih;
    const ind = hasilAnalisis.indikator || 'SEMUA';
    const tgl = new Date().toISOString().split('T')[0];
    const src = hasilAnalisis.ada_prediksi ? '_AktualPlusPrediksi' : '_AktualBapanas';

    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi:         '' + i.provinsi,
        Kategori:         i.kategori_label || i.kategori,
        'IKP (0-100)':    i.ikp,
        Prioritas:        i.prioritas,
        Ketersediaan:     i.ketersediaan != null ? i.ketersediaan.toFixed(2) : '-',
        Keterjangkauan:   i.keterjangkauan != null ? i.keterjangkauan.toFixed(2) : '-',
        Pemanfaatan:      i.pemanfaatan != null ? i.pemanfaatan.toFixed(2) : '-',
        Sumber:           i.sumber || '-',
        'Kolom Prediksi': (i.kolom_prediksi || []).join(', ') || '-',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'IKP');
      XLSX.writeFile(wb, `IKP_${ind}_${thn}${src}_${tgl}.xlsx`);
      toast.success('Excel diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi','Kategori','IKP','Prioritas','Ketersediaan','Keterjangkauan','Pemanfaatan','Sumber','Kolom_Prediksi'].join(','),
        ...r.map(s => [
          s.provinsi, s.kategori_label || s.kategori, s.ikp, s.prioritas,
          s.ketersediaan != null ? s.ketersediaan.toFixed(2) : '-',
          s.keterjangkauan != null ? s.keterjangkauan.toFixed(2) : '-',
          s.pemanfaatan != null ? s.pemanfaatan.toFixed(2) : '-',
          s.sumber || '-', (s.kolom_prediksi || []).join(';') || '-',
        ].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv], { type: 'text/csv' }), `IKP_${ind}_${thn}${src}_${tgl}.csv`);
      toast.success('CSV diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis, null, 2)], { type: 'application/json' }), `IKP_${ind}_${thn}${src}_${tgl}.json`);
      toast.success('JSON diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features, null, 2)], { type: 'application/json' }), `IKP_spatial_${ind}_${thn}${src}_${tgl}.geojson`);
      toast.success('GeoJSON diunduh');
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>
      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-7 pb-5 gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Wheat size={22} className="text-green-500"/>
                Indeks Ketahanan Pangan (IKP)
              </h1>
              {hasilAnalisis?.ada_prediksi && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                  style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderColor: '#fcd34d', color: '#92400e' }}>
                  <Brain size={12}/> Ada Data Prediksi
                </span>
              )}
            </div>
            <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-400">
              <Home size={12}/> <span>›</span> <span>Analisis</span> <span>›</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">Ketahanan Pangan</span>
            </nav>
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={30} className="text-green-500 animate-spin"/>
                <p className="text-sm text-slate-500">Memuat data...</p>
              </div>
            </div>
          ) : daftarTersimpan.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Wheat size={40} className="text-slate-300 dark:text-slate-600 mx-auto"/>
              <p className="text-slate-500 dark:text-slate-400">Belum ada analisis yang tersimpan.</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Hubungi Admin untuk menjalankan analisis baru.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaPangan_User
                hasilAnalisis={hasilAnalisis}
                indikatorTerpilih={indikatorTerpilih}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef} basemap={basemap} setBasemap={setBasemap}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                kombinasiTersedia={kombinasiTersedia} onPilihKombo={handlePilihKombo}
                tahunTerpilih={tahunTerpilih} jumlahKategori={jumlahKategori}
                sedangMuatAwal={false}
                getWarna={getWarnaIKP} getKategori={getKategoriIKP}
              />
              <TabsPangan_User
                activeTab={activeTab} setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori}
                indikatorTerpilih={indikatorTerpilih}
                kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunTerpilih} daftarTersimpan={daftarTersimpan}
                eksporData={eksporData}
                getWarna={getWarnaIKP} getKategori={getKategoriIKP}
                analysisId={activeAnalysisId}
              />
            </div>
          )}
        </div>
      </main>
      <Footerauth/>
    </div>
  );
}