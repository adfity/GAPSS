"use client";
// ─── PUBLIK SDM PAGE ──────────────────────────────────────────────────────────
// Semua tab read-only. Header/sidebar sama dari layout.
// Tidak ada tombol analisis, simpan, usul kebijakan.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { Loader2, Info, Brain } from 'lucide-react';
import HeaderBar  from '@/components/layout/HeaderBar';
import SideBar    from '@/components/layout/sideBar';
import Footerauth from '@/components/layout/footerauth';
import PetaSDM_Publik from '@/components/analisis/sdm/petaSdm_publik';
import TabsSDM        from '@/components/analisis/sdm/tabSdm_publik';   // shared tabs, role='publik'
import {
  getWarna_SDM, getKategori_SDM,
  INDIKATOR_LABELS_SDM, ZOOM_DEFAULT_SDM,
} from '@/components/analisis/sdm/petaSdm';

const API = 'http://127.0.0.1:8000/api';

// Selector minimal: tahun & indikator dari data tersimpan
function SelectorPublik({ daftarTersimpan, tahunAktif, indikatorAktif, onPilih }) {
  const tahunList = useMemo(() =>
    [...new Set(daftarTersimpan.map(d=>d.tahun).filter(Boolean))].sort((a,b)=>b-a),
    [daftarTersimpan]);

  const indikatorList = useMemo(() =>
    [...new Set(daftarTersimpan.filter(d=>d.tahun===tahunAktif).map(d=>d.indikator||'ALL'))],
    [daftarTersimpan, tahunAktif]);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tahun</label>
        <select value={tahunAktif||''} onChange={e => onPilih(parseInt(e.target.value), indikatorAktif)}
          className="text-sm font-semibold px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 outline-none cursor-pointer shadow-sm">
          {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Indikator</label>
        <select value={indikatorAktif} onChange={e => onPilih(tahunAktif, e.target.value)}
          className="text-sm font-semibold px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 outline-none cursor-pointer shadow-sm">
          {['ALL','KESEHATAN','PENDIDIKAN','PENGELUARAN'].map(ind => {
            const tersedia = indikatorList.includes(ind);
            return <option key={ind} value={ind} disabled={!tersedia}>{INDIKATOR_LABELS_SDM[ind]}{!tersedia?' (-)':''}</option>;
          })}
        </select>
      </div>
      {daftarTersimpan.length > 0 && (
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
          {daftarTersimpan.length} analisis tersimpan
        </span>
      )}
    </div>
  );
}

export default function PublikSdmPage() {
  const [hasilAnalisis,     setHasilAnalisis]     = useState(null);
  const [daftarTersimpan,   setDaftarTersimpan]   = useState([]);
  const [sedangMuat,        setSedangMuat]         = useState(true);
  const [tahunAktif,        setTahunAktif]         = useState(null);
  const [indikatorAktif,    setIndikatorAktif]     = useState('ALL');
  const [kategoriTerpilih,  setKategoriTerpilih]   = useState('SEMUA');
  const [activeTab,         setActiveTab]           = useState('info');
  const [isClient,          setIsClient]           = useState(false);
  const [leafletReady,      setLeafletReady]       = useState(false);
  const [MapCont,           setMapCont]            = useState(null);
  const [TileLay,           setTileLay]            = useState(null);
  const [GeoComp,           setGeoComp]            = useState(null);
  const [koordinatCursor,   setKoordinatCursor]    = useState({ lat:'0.0000', lng:'0.0000' });
  const [currentZoom,       setCurrentZoom]        = useState(ZOOM_DEFAULT_SDM);
  const [provinsiDipilih,   setProvinsiDipilih]    = useState(null);
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

  useEffect(() => {
    if (!isClient) return;
    setSedangMuat(true);
    axios.get(`${API}/sdm-analysis/list/`)
      .then(res => {
        const list = res.data.results || [];
        setDaftarTersimpan(list);
        if (!list.length) return;
        const best = list
          .filter(d=>(d.indikator||'ALL')==='ALL')
          .sort((a,b)=>b.tahun-a.tahun||((b.timestamp||'').localeCompare(a.timestamp||'')))[0]
          || list.sort((a,b)=>b.tahun-a.tahun)[0];
        if (best) muatAnalisis(best.analysis_id, best.tahun, best.indikator||'ALL', true);
      })
      .catch(()=>{})
      .finally(()=>setSedangMuat(false));
  }, [isClient]);

  const muatAnalisis = useCallback(async (id, tahun, indikator, silent=false) => {
    if (!silent) setSedangMuat(true);
    try {
      const res = await axios.get(`${API}/sdm-analysis/${id}/`);
      setHasilAnalisis(res.data);
      setTahunAktif(tahun || res.data.tahun);
      setIndikatorAktif(indikator || res.data.indikator || 'ALL');
      setKategoriTerpilih('SEMUA');
      setProvinsiDipilih(null);
    } catch {}
    finally { if (!silent) setSedangMuat(false); }
  }, []);

  const handlePilih = useCallback((tahun, indikator) => {
    const target = daftarTersimpan
      .filter(d => d.tahun===tahun && (d.indikator||'ALL')===indikator)
      .sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''))[0];
    if (target) muatAnalisis(target.analysis_id, tahun, indikator);
  }, [daftarTersimpan, muatAnalisis]);

  const jumlahKategori = useMemo(() => {
    if (!hasilAnalisis?.matched_features?.features) return {};
    const counts = { SANGAT_TINGGI:0, TINGGI:0, SEDANG:0, RENDAH:0, TIDAK_TERANALISIS:0 };
    hasilAnalisis.matched_features.features.forEach(f => {
      const k = getKategori_SDM(f, indikatorAktif);
      if (counts[k] !== undefined) counts[k]++;
    });
    return counts;
  }, [hasilAnalisis, indikatorAktif]);

  // eksporData publik: Excel + CSV saja
  const eksporData = (format) => {
    if (!hasilAnalisis) return;
    const r   = hasilAnalisis.analysis_summary || [];
    const thn = hasilAnalisis.tahun;
    const ind = hasilAnalisis.indikator || 'ALL';
    const tgl = new Date().toISOString().split('T')[0];
    const unduhBlob = (blob, nama) => {
      const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:nama});
      a.click(); URL.revokeObjectURL(a.href);
    };
    if (format === 'EXCEL') {
      const ws = XLSX.utils.json_to_sheet(r.map(i=>({
        Provinsi:''+i.provinsi, Kategori:i.kategori_label||i.kategori,
        'ISDM (0-100)':i.indeks_sdm,
        'AHH':i.uhh||'-','RLS':i.rls||'-','HLS':i.hls||'-',
        'Pengeluaran (Rb Rp)':i.pengeluaran||'-', Sumber:i.sumber||'-',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ISDM');
      XLSX.writeFile(wb, `ISDM_Publik_${ind}_${thn}_${tgl}.xlsx`);
    } else if (format === 'CSV') {
      const csv = [
        ['Provinsi','Kategori','ISDM','AHH','RLS','HLS','Pengeluaran','Sumber'].join(','),
        ...r.map(s=>[s.provinsi,s.kategori_label||s.kategori,s.indeks_sdm,s.uhh||'-',s.rls||'-',s.hls||'-',s.pengeluaran||'-',s.sumber||'-'].join(','))
      ].join('\n');
      unduhBlob(new Blob([csv],{type:'text/csv'}),`ISDM_Publik_${ind}_${thn}_${tgl}.csv`);
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <HeaderBar/>
      <SideBar/>

      <main className="pt-[60px] pb-16 min-h-screen">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-2">

          {/* Header section */}
          <div className="pt-7 pb-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Indeks SDM (ISDM)
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Visualisasi IPM Metode Baru BPS · 34 Provinsi Indonesia
                </p>
              </div>
              {hasilAnalisis?.ada_prediksi && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border self-start"
                  style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', borderColor:'#fcd34d', color:'#92400e' }}>
                  <Brain size={12}/> Ada Data Proyeksi OLS
                </span>
              )}
            </div>

            {/* Selector tahun & indikator */}
            {!sedangMuat && daftarTersimpan.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm px-4 py-3">
                <SelectorPublik
                  daftarTersimpan={daftarTersimpan}
                  tahunAktif={tahunAktif}
                  indikatorAktif={indikatorAktif}
                  onPilih={handlePilih}
                />
              </div>
            )}
          </div>

          {/* Loading */}
          {sedangMuat && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={30} className="text-indigo-500 animate-spin"/>
                <p className="text-sm text-slate-500">Memuat data...</p>
              </div>
            </div>
          )}

          {/* Kosong */}
          {!sedangMuat && daftarTersimpan.length === 0 && (
            <div className="py-20 text-center">
              <Info size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
              <p className="text-slate-500 dark:text-slate-400">Belum ada data yang dipublikasikan.</p>
            </div>
          )}

          {/* Konten utama */}
          {!sedangMuat && daftarTersimpan.length > 0 && (
            <div className="space-y-4">
              {/* Peta */}
              <PetaSDM_Publik
                hasilAnalisis={hasilAnalisis}
                indikatorTerpilih={indikatorAktif}
                kategoriTerpilih={kategoriTerpilih}
                setKategoriTerpilih={setKategoriTerpilih}
                leafletReady={leafletReady} MapCont={MapCont} TileLay={TileLay} GeoComp={GeoComp}
                petaRef={petaRef}
                koordinatCursor={koordinatCursor} setKoordinatCursor={setKoordinatCursor}
                currentZoom={currentZoom} setCurrentZoom={setCurrentZoom}
                provinsiDipilih={provinsiDipilih} setProvinsiDipilih={setProvinsiDipilih}
                jumlahKategori={jumlahKategori}
                tinggi={460}
              />

              {/* Tabs — pakai TabsSDM shared dengan role='publik' agar:
                  · tab kebijakan disembunyikan
                  · eksporData hanya CSV/Excel
                  · tidak ada tombol edit/simpan di mana pun              */}
              <TabsSDM
                activeTab={activeTab} setActiveTab={setActiveTab}
                hasilAnalisis={hasilAnalisis} jumlahKategori={jumlahKategori}
                indikatorTerpilih={indikatorAktif}
                kategoriTerpilih={kategoriTerpilih} setKategoriTerpilih={setKategoriTerpilih}
                tahunTerpilih={tahunAktif} daftarTersimpan={daftarTersimpan}
                eksporData={eksporData}
                getWarna={getWarna_SDM} getKategori={getKategori_SDM}
                analysisId={null}
                role="publik"   // TabsSDM: sembunyikan tab kebijakan & semua tombol edit
              />
            </div>
          )}
        </div>
      </main>
      <Footerauth/>
    </div>
  );
}