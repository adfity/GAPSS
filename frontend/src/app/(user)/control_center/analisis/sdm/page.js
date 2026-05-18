"use client";
// ─── USER SDM PAGE ────────────────────────────────────────────────────────────
// Akses: lihat peta tersimpan + ganti tahun/indikator + usul kebijakan
// TIDAK BISA: jalankan analisis baru, simpan, hapus, CRUD bank kebijakan langsung
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Brain } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import HeaderBar  from '@/components/layout/HeaderBar';
import SideBar    from '@/components/layout/sideBar';
import Footerauth from '@/components/layout/footerauth';
import PetaSDM_User  from '@/components/analisis/sdm/petaSdm_user';
import TabsSDM_User  from '@/components/analisis/sdm/tabSdm_user';
import {
  getWarna_SDM, getKategori_SDM,
  INDIKATOR_LABELS_SDM, ZOOM_DEFAULT_SDM,
} from '@/components/analisis/sdm/petaSdm';

const API = 'http://127.0.0.1:8000/api';

export default function UserSdmPage() {
  const [hasilAnalisis,     setHasilAnalisis]     = useState(null);
  const [kategoriTerpilih,  setKategoriTerpilih]  = useState('SEMUA');
  const [indikatorTerpilih, setIndikatorTerpilih] = useState('ALL');
  const [isClient,          setIsClient]          = useState(false);
  const [activeTab,         setActiveTab]          = useState('info');
  const [daftarTersimpan,   setDaftarTersimpan]   = useState([]);
  const [sedangMuatAwal,    setSedangMuatAwal]    = useState(true);
  const [tahunTerpilih,     setTahunTerpilih]     = useState(2024);
  const [basemap,           setBasemap]           = useState('OSM');
  const [koordinatCursor,   setKoordinatCursor]   = useState({ lat:'0.0000', lng:'0.0000' });
  const [currentZoom,       setCurrentZoom]       = useState(ZOOM_DEFAULT_SDM);
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
      const ind = a.indikator || 'ALL';
      const key = `${a.tahun}|${ind}`;
      if (!map[key] || a.timestamp > map[key].timestamp)
        map[key] = { timestamp: a.timestamp, analysis_id: a.analysis_id };
    });
    return map;
  }, [daftarTersimpan]);

  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return {};
    const counts = { SANGAT_TINGGI:0, TINGGI:0, SEDANG:0, RENDAH:0, TIDAK_TERANALISIS:0 };
    hasilAnalisis.matched_features.features.forEach(f => {
      const k = getKategori_SDM(f, indikatorTerpilih);
      if (counts[k] !== undefined) counts[k]++;
    });
    return counts;
  }, [hasilAnalisis, indikatorTerpilih]);

  const muatDariDB = async () => {
    setSedangMuatAwal(true);
    try {
      const res  = await axios.get(`${API}/sdm-analysis/list/`);
      const list = res.data.results || [];
      setDaftarTersimpan(list);
      if (!list.length) return;
      const sorted = [...list].sort((a, b) => {
        const ai = (a.indikator||'ALL') === 'ALL' ? 0 : 1;
        const bi = (b.indikator||'ALL') === 'ALL' ? 0 : 1;
        if (ai !== bi) return ai - bi;
        if (b.tahun !== a.tahun) return b.tahun - a.tahun;
        return (b.timestamp||'').localeCompare(a.timestamp||'');
      });
      await muatDetail(sorted[0].analysis_id, sorted[0].tahun, sorted[0].indikator||'ALL', true);
    } catch {}
    finally { setSedangMuatAwal(false); }
  };

  const muatDetail = async (id, tahun, indikator, silent = false) => {
    const tid = silent ? null : toast.loading('Memuat...');
    try {
      const res = await axios.get(`${API}/sdm-analysis/${id}/`);
      if (tid) toast.dismiss(tid);
      setHasilAnalisis(res.data);
      setTahunTerpilih(tahun || res.data.tahun || 2024);
      setIndikatorTerpilih(indikator || res.data.indikator || 'ALL');
      setKategoriTerpilih('SEMUA');
      setProvinsiDipilih(null);
      setActiveAnalysisId(id);
      if (!silent) toast.success(`Dimuat: ${INDIKATOR_LABELS_SDM[indikator||'ALL']} ${tahun}`);
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
    const ind = hasilAnalisis.indikator || 'ALL';
    const tgl = new Date().toISOString().split('T')[0];
    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i => ({
        Provinsi:''+i.provinsi, Kategori:i.kategori_label||i.kategori,
        'ISDM (0-100)':i.indeks_sdm,
        'AHH':i.uhh||'-', 'RLS':i.rls||'-', 'HLS':i.hls||'-',
        'Pengeluaran (Rb Rp)':i.pengeluaran||'-', Sumber:i.sumber||'-',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ISDM');
      XLSX.writeFile(wb, `ISDM_${ind}_${thn}_${tgl}.xlsx`);
      toast.success('Excel diunduh');
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi','Kategori','ISDM','AHH','RLS','HLS','Pengeluaran','Sumber'].join(','),
        ...r.map(s => [s.provinsi,s.kategori_label||s.kategori,s.indeks_sdm,s.uhh||'-',s.rls||'-',s.hls||'-',s.pengeluaran||'-',s.sumber||'-'].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv],{type:'text/csv'}),`ISDM_${ind}_${thn}_${tgl}.csv`);
      toast.success('CSV diunduh');
    } else if (format === 'JSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis,null,2)],{type:'application/json'}),`ISDM_${ind}_${thn}_${tgl}.json`);
      toast.success('JSON diunduh');
    } else if (format === 'GEOJSON') {
      unduhBlob(new Blob([JSON.stringify(hasilAnalisis.matched_features,null,2)],{type:'application/json'}),`ISDM_spatial_${ind}_${thn}_${tgl}.geojson`);
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
          <div className="pt-7 pb-5 flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Indeks Sumber Daya Alam (ISDM)
            </h1>
            {hasilAnalisis?.ada_prediksi && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', borderColor:'#fcd34d', color:'#92400e' }}>
                <Brain size={12}/> Ada Data Proyeksi
              </span>
            )}
          </div>

          {sedangMuatAwal ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={30} className="text-indigo-500 animate-spin"/>
                <p className="text-sm text-slate-500">Memuat data...</p>
              </div>
            </div>
          ) : daftarTersimpan.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <p className="text-slate-500 dark:text-slate-400">Belum ada analisis yang tersimpan.</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Hubungi Admin untuk menjalankan analisis baru.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <PetaSDM_User
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
              />
              <TabsSDM_User
                activeTab={activeTab} setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori}
                indikatorTerpilih={indikatorTerpilih}
                kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunTerpilih} daftarTersimpan={daftarTersimpan}
                eksporData={eksporData}
                getWarna={getWarna_SDM} getKategori={getKategori_SDM}
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