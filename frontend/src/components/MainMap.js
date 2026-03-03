"use client";
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';

import MapStuff from './MapStuff';
import GeoAI from './panel/geoai';
import BasemapPanel, { BASEMAP_OPTIONS } from './panel/basemap';
import LayersPanel from './panel/layers';
import RadiusPanel from './panel/radius';
import AnalysisPanel from './panel/analysis';
import SearchLocation from './panel/search';

export default function MainMap({ activePanel, setActivePanel }) {
  // ref ke instance Leaflet map
  const mapRef = useRef(null);

  // ── State utama ──────────────────────────────────────────────────────────────
  const [currentBasemap,     setCurrentBasemap]     = useState(BASEMAP_OPTIONS[0].url);
  const [activeLayers,       setActiveLayers]       = useState([]);
  const [data,               setData]               = useState(null);
  const [previewData,        setPreviewData]        = useState([]);
  const [goHome,             setGoHome]             = useState(false);
  const [activeRadius,       setActiveRadius]       = useState(null);
  const [modeBersih,         setModeBersih]         = useState(false);

  // ── State GeoAI (diangkat ke sini agar bisa dibagi ke GeoAI panel & MapStuff) 
  const [zoomLevel,          setZoomLevel]          = useState(5);
  const [showPreviewBox,     setShowPreviewBox]     = useState(true);
  const [detectionSize,      setDetectionSize]      = useState(640);

  // ── State Analysis ───────────────────────────────────────────────────────────
  const [activeAnalysisId,   setActiveAnalysisId]   = useState(null);
  const [activeAnalysisData, setActiveAnalysisData] = useState(null);

  // ── Mobile detection ─────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Reset showPreviewBox ketika panel GeoAI ditutup ──────────────────────────
  useEffect(() => {
    if (activePanel !== 'geoai') setShowPreviewBox(false);
    else setShowPreviewBox(true);
  }, [activePanel]);

  // ── Fetch data awal ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/features/');
        if (!res.ok) throw new Error('Gagal mengambil data');
        setData(await res.json());
      } catch (err) {
        console.error('Error:', err);
        toast.error('Gagal memuat data peta');
      }
    };
    fetchData();
  }, []);

  // ── Fetch analysis detail ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeAnalysisId) { setActiveAnalysisData(null); return; }
    const fetch_ = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/api/analysis/${activeAnalysisId}/`);
        setActiveAnalysisData(res.data);
        toast.success('Data analisis dimuat');
      } catch (err) {
        console.error('Error fetching analysis:', err);
        toast.error('Gagal memuat detail analisis');
        setActiveAnalysisId(null);
      }
    };
    fetch_();
  }, [activeAnalysisId]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getCategoryColor = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'bangunan':  return '#f59e0b';
      case 'pepohonan': return '#16a34a';
      case 'perairan':  return '#2563eb';
      case 'jalan':     return '#64748b';
      default:          return '#ef4444';
    }
  };

  const toggleLayer = (layerId) =>
    setActiveLayers(prev =>
      prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );

  const refreshData = () =>
    fetch('http://127.0.0.1:8000/api/features/')
      .then(r => r.json())
      .then(json => setData(json));

  const getPanelClasses = () =>
    isMobile
      ? 'fixed top-16 bottom-20 left-0 right-0 w-full rounded-none'
      : 'fixed top-20 bottom-20 right-20 w-80 rounded-2xl';

  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-900">

      {/* ── PANEL BASEMAP ── */}
      {activePanel === 'basemap' && (
        <aside className={`${getPanelClasses()} shadow-2xl z-[1050] bg-white dark:bg-slate-900 overflow-hidden`}>
          <BasemapPanel activeUrl={currentBasemap} onSelect={setCurrentBasemap} />
        </aside>
      )}

      {/* ── PANEL LAYERS ── */}
      {activePanel === 'layers' && (
        <aside className={`${getPanelClasses()} shadow-2xl z-[1050] bg-white dark:bg-slate-900 overflow-hidden`}>
          <LayersPanel activeLayers={activeLayers} onToggleLayer={toggleLayer} />
        </aside>
      )}

      {/* ── PANEL ANALYSIS ── */}
      {activePanel === 'analysis' && (
        <aside className={`${getPanelClasses()} shadow-2xl z-[1050] bg-white dark:bg-slate-900 overflow-hidden`}>
          <AnalysisPanel
            onClose={() => setActivePanel(null)}
            activeAnalysisId={activeAnalysisId}
            setActiveAnalysisId={setActiveAnalysisId}
          />
        </aside>
      )}

      {/* ── PANEL GEOAI — di luar MapContainer ─────────────────────────────────
          Scroll di panel tidak akan menggerakkan peta.                       */}
      {activePanel === 'geoai' && (
        <aside className={`${getPanelClasses()} shadow-2xl z-[1050] bg-white dark:bg-slate-900 overflow-hidden`}>
          <GeoAI
            mapRef={mapRef}
            zoomLevel={zoomLevel}
            showPreviewBox={showPreviewBox}
            setShowPreviewBox={setShowPreviewBox}
            detectionSize={detectionSize}
            setDetectionSize={setDetectionSize}
            onNewData={refreshData}
            onDetectionComplete={(res) => setPreviewData(res)}
            onClearPreview={() => setPreviewData([])}
            previewData={previewData}
            setPreviewData={setPreviewData}
          />
        </aside>
      )}

      {/* ── SEARCH — di luar MapContainer ── */}
      <SearchLocation mapRef={mapRef} modeBersih={modeBersih} />

      {/* ── PETA UTAMA ── */}
      <MapContainer
        ref={mapRef}
        center={[-2.5, 118]}
        zoom={5}
        minZoom={3}
        maxZoom={22}
        className="h-full w-full z-0"
        zoomControl={false}
        doubleClickZoom={false}
      >
        <TileLayer
          url={currentBasemap}
          attribution='&copy; OpenStreetMap'
          maxZoom={22}
        />

        <MapStuff
          activePanel={activePanel}
          activeLayers={activeLayers}
          data={data}
          previewData={previewData}
          goHome={goHome}
          activeAnalysisData={activeAnalysisData}
          modeBersih={modeBersih}
          setModeBersih={setModeBersih}
          showPreviewBox={showPreviewBox}
          detectionSize={detectionSize}
          onZoomChange={setZoomLevel}

          setGoHome={setGoHome}
          setPreviewData={setPreviewData}
          setActivePanel={setActivePanel}
          getCategoryColor={getCategoryColor}
          onRefreshData={refreshData}
        />

        {/* PANEL RADIUS — tetap di dalam karena butuh useMap */}
        {activePanel === 'radius' && (
          <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none' }}>
            <aside
              className={`${getPanelClasses()} shadow-2xl z-[1050] bg-white dark:bg-slate-900 overflow-hidden`}
              style={{ pointerEvents: 'auto' }}
            >
              <RadiusPanel
                activeRadius={activeRadius}
                setActiveRadius={setActiveRadius}
                onRadiusCreated={(r) => console.log('Radius dibuat:', r)}
                onRadiusCleared={(id) => console.log('Radius dihapus:', id)}
              />
            </aside>
          </div>
        )}

        <ScaleControl position="bottomleft" />
      </MapContainer>
    </div>
  );
}