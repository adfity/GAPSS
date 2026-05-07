"use client";
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import MapStuff from './MapStuff';
import GeoAI from './panel/geoai';
import BasemapPanel, { BASEMAP_OPTIONS } from './panel/basemap';
import LayersPanel, { useLocalLayers, LocalGeoLayer, RenameModal } from './panel/layers';
import RadiusPanel from './panel/radius';
import AnalysisPanel from './panel/analysis';
import SearchLocation from './panel/search';
import GeoAreaScanPanel, { AreaScanOverlay, KabupatenMapOverlay } from './panel/GeoAreaScanPanel';
import {
  useWaypointData,
  WaypointLayer,
  useBmkgData,
  useAutoGempa,
  BmkgLayer,
  BmkgAlertBanner,
  WAYPOINT_LAYERS,
} from './panel/layers';

// ─── Panel Wrapper ─────────────────────────────────────────────────────────────

function PanelWrapper({ isMobile, onClose, children, isDark, hidden = false }) {
  const base = isMobile
    ? 'fixed top-[60px] bottom-20 left-0 right-0 w-full rounded-none'
    : 'fixed top-[68px] bottom-6 right-20 w-80 rounded-2xl';

  const bgColor     = isDark ? 'bg-slate-900' : 'bg-white';
  const borderColor = isDark ? 'border-slate-700/50' : 'border-slate-200/50';
  const textColor   = isDark ? 'text-slate-100' : 'text-slate-900';

  return (
    <>
      <aside
        className={`
          ${base}
          z-[1050] overflow-hidden flex flex-col
          ${bgColor} border ${borderColor} ${textColor}
        `}
        style={{
          display: hidden ? 'none' : undefined,
          boxShadow: isDark
            ? '0 8px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 8px 30px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 z-10 rounded-t-2xl pointer-events-none" />

        {/* Tombol Close — FIX #1: pakai <div> bukan <button> di dalam elemen yang
            mungkin sudah di-render sebagai <button> oleh komponen parent,
            sehingga tidak ada nested <button> di DOM. */}
        <div
          role="button"
          tabIndex={0}
          onClick={onClose}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
          className={`absolute top-3 right-3 z-20 p-2 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="Tutup panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        {children}
      </aside>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MainMap({ activePanel, setActivePanel }) {
  const mapRef = useRef(null);

  // ── Dark mode ─────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const initial = document.documentElement.getAttribute('data-theme');
    setIsDark(initial === 'dark');
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // ── State ─────────────────────────────────────────────────────────────────
  const [currentBasemap,     setCurrentBasemap]     = useState(BASEMAP_OPTIONS[0]);
  const [activeLayers,       setActiveLayers]       = useState([]);
  const [data,               setData]               = useState(null);
  const [previewData,        setPreviewData]        = useState([]);
  const [goHome,             setGoHome]             = useState(false);
  const [activeRadius,       setActiveRadius]       = useState(null);
  const [modeBersih,         setModeBersih]         = useState(false);
  const [zoomLevel,          setZoomLevel]          = useState(5);
  const [showPreviewBox,     setShowPreviewBox]     = useState(true);
  const [detectionSize,      setDetectionSize]      = useState(640);
  const [activeAnalysisId,   setActiveAnalysisId]   = useState(null);
  const [activeAnalysisData, setActiveAnalysisData] = useState(null);

  // Area Scan
  const [isDrawingArea,   setIsDrawingArea]   = useState(false);
  const [drawnBounds,     setDrawnBounds]     = useState(null);
  const [tileGrid,        setTileGrid]        = useState([]);
  const [scanningTileIdx, setScanningTileIdx] = useState(-1);
  const [previewResults,  setPreviewResults]  = useState([]);
  const [tileStats,       setTileStats]       = useState({ total: 0, done: 0, objects: 0 });
  const [isScanning,      setIsScanning]      = useState(false);

  // Kabupaten overlay
  const [kabState, setKabState] = useState({
  scanMode: 'manual', kabupatenList: [], selectedKabupaten: null,
  isKabupatenClickMode: false, handleSelect: null,
});

//  state untuk radius dari GeoAreaScanPanel
const [radiusMapState, setRadiusMapState] = useState({
  radiusLayers: [], activeRadius: null, radiusCenter: null,
  waypointsInRadius: [], allRadiusPolygons: [], isRadiusMode: false,
});

  // ── Responsive ────────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Panel lifecycle ────────────────────────────────────────────────────────
  const prevPanelRef = useRef(activePanel);
  useEffect(() => {
    const wasAreaScan = prevPanelRef.current === 'areascan';
    const isAreaScan  = activePanel === 'areascan';
    prevPanelRef.current = activePanel;
    if (wasAreaScan && !isAreaScan && !isScanning) {
      setIsDrawingArea(false); setDrawnBounds(null); setTileGrid([]);
      setPreviewResults([]); setScanningTileIdx(-1);
      setTileStats({ total: 0, done: 0, objects: 0 });
      setKabState({
        scanMode: 'manual', kabupatenList: [], selectedKabupaten: null,
        isKabupatenClickMode: false, handleSelect: null,
      });
    }
    if (!isAreaScan) setIsDrawingArea(false);
  }, [activePanel, isScanning]);

  useEffect(() => {
    setShowPreviewBox(activePanel === 'geoai');
  }, [activePanel]);

  // ── Toast style ───────────────────────────────────────────────────────────
  const toastStyle = {
    style: isDark
      ? { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' }
      : {},
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/features/')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(json => setData(json))
      .catch(() => toast.error('Gagal memuat data peta', toastStyle));
  }, []);

  useEffect(() => {
    if (!activeAnalysisId) { setActiveAnalysisData(null); return; }
    axios.get(`http://127.0.0.1:8000/api/analysis/${activeAnalysisId}/`)
      .then(res => { setActiveAnalysisData(res.data); toast.success('Data analisis dimuat', toastStyle); })
      .catch(() => { toast.error('Gagal memuat analisis', toastStyle); setActiveAnalysisId(null); });
  }, [activeAnalysisId]);

  // ── BMKG Hooks ────────────────────────────────────────────────────────────
  const { bmkgData, bmkgStatus, refetchBmkg } = useBmkgData(activeLayers);
  const { autoGempa, dismissed, dismiss }      = useAutoGempa();

  // Toast saat ada gempa baru yang cukup besar
  const prevAutoGempaRef = useRef(null);
  useEffect(() => {
    if (!autoGempa) return;
    const id = `${autoGempa.Tanggal}-${autoGempa.Jam}-${autoGempa.Magnitude}`;
    if (id === prevAutoGempaRef.current) return;
    prevAutoGempaRef.current = id;
    const mag = parseFloat(autoGempa.Magnitude) || 0;
    if (mag >= 5.0) {
      toast(
        `Gempa M${autoGempa.Magnitude} — ${autoGempa.Wilayah || 'Indonesia'}`,
        {
          icon:     mag >= 6 ? '🔴' : '🟠',
          duration: 6000,
          style:    isDark
            ? { background: '#1e293b', color: '#f1f5f9', border: '1px solid #ef4444' }
            : { border: '1px solid #ef4444' },
        }
      );
    }
  }, [autoGempa, isDark]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCategoryColor = (cat) => ({
    bangunan:  '#f59e0b',
    pepohonan: '#16a34a',
    perairan:  '#2563eb',
    jalan:     '#64748b',
  }[cat?.toLowerCase()] ?? '#ef4444');

  // FIX #2: waypointData sudah di-declare di sini (sebelumnya sudah ada tapi
  // tidak di-pass ke RadiusPanel). Sekarang kita pastikan ter-pass dengan benar.
  const { waypointData } = useWaypointData(activeLayers);
  const { localLayers, addLayer, updateLayer, removeLayer, toggleVisible } = useLocalLayers();

  const handleEditFeature = (layerId, featureIndex, key, newValue) => {
  const layer = localLayers.find(l => l.id === layerId);
  if (!layer) return;

  updateLayer(layerId, {
    geojson: {
      ...layer.geojson,
      features: layer.geojson.features.map((f, i) =>
        i === featureIndex
          ? { ...f, properties: { ...f.properties, [key]: newValue } }
          : f
      ),
    },
  });

  const input = document.querySelector(
    `input[data-layer="${layerId}"][data-fidx="${featureIndex}"][data-key="${key}"]`
  );
  if (input) {
    input.style.borderColor = '#10b981';
    input.style.background  = 'rgba(16,185,129,0.15)';
    setTimeout(() => {
      input.style.borderColor = 'transparent';
      input.style.background  = 'rgba(255,255,255,0.05)';
    }, 1000);
  }
};

  const [renamingLayerId, setRenamingLayerId] = useState(null);
const renamingLayer = localLayers.find(l => l.id === renamingLayerId) || null;

  const toggleLayer = (id) =>
    setActiveLayers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const refreshData = () =>
    fetch('http://127.0.0.1:8000/api/features/').then(r => r.json()).then(setData);

  const handleTileClick = (tile) => {
    mapRef.current?.flyTo([tile.centerLat, tile.centerLng], 19, { animate: true, duration: 0.6 });
  };

  const closePanel = () => setActivePanel(null);

  // Radius panel style helpers
  const radiusPanelCls    = isMobile
    ? 'fixed top-[60px] bottom-20 left-0 right-0 w-full rounded-none'
    : 'fixed top-[68px] bottom-6 right-20 w-80 rounded-2xl';
  const radiusBgColor     = isDark ? 'bg-slate-900' : 'bg-white';
  const radiusBorderColor = isDark ? 'border-slate-700/50' : 'border-slate-200/50';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-screen w-full relative overflow-hidden ${isDark ? 'dark' : ''} bg-slate-950`}>

      {/* ─── Panels ──────────────────────────────────────────────────────── */}

      {activePanel === 'layers' && (
        <PanelWrapper isMobile={isMobile} onClose={closePanel} isDark={isDark}>
          <LayersPanel
            activeLayers={activeLayers}
            onToggleLayer={toggleLayer}
            isDark={isDark}
            bmkgStatus={bmkgStatus}
            refetchBmkg={refetchBmkg}
            localLayers={localLayers}
            addLayer={addLayer}
            updateLayer={updateLayer}
            removeLayer={removeLayer}
            toggleVisible={toggleVisible}
          />
        </PanelWrapper>
      )}

      {activePanel === 'basemap' && (
  <PanelWrapper isMobile={isMobile} onClose={closePanel} isDark={isDark}>
    <BasemapPanel
      currentBasemap={currentBasemap}
      onSelect={(bm) => {
        setCurrentBasemap(bm);
        closePanel();
      }}
      isDark={isDark}
    />
  </PanelWrapper>
)}

      {activePanel === 'analysis' && (
        <PanelWrapper isMobile={isMobile} onClose={closePanel} isDark={isDark}>
          <AnalysisPanel
            onClose={closePanel}
            activeAnalysisId={activeAnalysisId}
            setActiveAnalysisId={setActiveAnalysisId}
            isDark={isDark}
          />
        </PanelWrapper>
      )}

      {activePanel === 'geoai' && (
        <PanelWrapper isMobile={isMobile} onClose={closePanel} isDark={isDark}>
          <GeoAI
            mapRef={mapRef} zoomLevel={zoomLevel}
            showPreviewBox={showPreviewBox} setShowPreviewBox={setShowPreviewBox}
            detectionSize={detectionSize} setDetectionSize={setDetectionSize}
            onNewData={refreshData}
            onDetectionComplete={(res) => setPreviewData(res)}
            onClearPreview={() => setPreviewData([])}
            previewData={previewData} setPreviewData={setPreviewData}
            isDark={isDark}
          />
        </PanelWrapper>
      )}

      {activePanel === 'areascan' && (
  <PanelWrapper
    isMobile={isMobile}
    onClose={closePanel}
    isDark={isDark}
    hidden={isScanning && kabState.scanMode === 'kabupaten'}
  >
    <GeoAreaScanPanel
      mapRef={mapRef} zoomLevel={zoomLevel} onNewData={refreshData}
      isDrawingArea={isDrawingArea}     setIsDrawingArea={setIsDrawingArea}
      drawnBounds={drawnBounds}         setDrawnBounds={setDrawnBounds}
      tileGrid={tileGrid}               setTileGrid={setTileGrid}
      previewResults={previewResults}   setPreviewResults={setPreviewResults}
      scanningTileIdx={scanningTileIdx} setScanningTileIdx={setScanningTileIdx}
      tileStats={tileStats}             setTileStats={setTileStats}
      isScanning={isScanning}           setIsScanning={setIsScanning}
      onKabupatenStateChange={setKabState}
      isDark={isDark}
      waypointData={waypointData}
      waypointLayers={WAYPOINT_LAYERS}
      activeLayers={activeLayers}
      onRadiusStateChange={setRadiusMapState}
    />
  </PanelWrapper>
)}

      {/* Search */}
      <SearchLocation
        mapRef={mapRef}
        modeBersih={modeBersih}
        activeLayers={activeLayers}
        isDark={isDark}
      />

      {/* ─── BMKG Realtime Alert Banner */}
      <BmkgAlertBanner
        autoGempa={autoGempa}
        dismissed={dismissed}
        onDismiss={dismiss}
        isDark={isDark}
        modeBersih={modeBersih}
      />

      {/* ─── Map ─────────────────────────────────────────────────────────── */}
      <MapContainer
        ref={mapRef}
        center={[-2.5, 118]} zoom={5} minZoom={3} maxZoom={22}
        className="h-full w-full z-0"
        zoomControl={false}
        doubleClickZoom={false}
      >
        <TileLayer
          key={currentBasemap.url}
          url={currentBasemap.url}
          attribution={currentBasemap.attribution}
          maxZoom={currentBasemap.maxZoom ?? 22}
          maxNativeZoom={currentBasemap.maxZoom ?? 19}
        />

        <MapStuff
          activePanel={activePanel}   activeLayers={activeLayers}
          data={data}                 previewData={previewData}
          goHome={goHome}             activeAnalysisData={activeAnalysisData}
          modeBersih={modeBersih}     setModeBersih={setModeBersih}
          showPreviewBox={showPreviewBox} detectionSize={detectionSize}
          onZoomChange={setZoomLevel} setGoHome={setGoHome}
          setPreviewData={setPreviewData} setActivePanel={setActivePanel}
          getCategoryColor={getCategoryColor} onRefreshData={refreshData}
          isDark={isDark}
        />

        <AreaScanOverlay
  isActive={activePanel === 'areascan'}
  isDrawing={isDrawingArea}   onBoundsSet={setDrawnBounds}
  drawnBounds={drawnBounds}   tileGrid={tileGrid}
  scanningTileIdx={scanningTileIdx} previewResults={previewResults}
  onTileClick={handleTileClick}     isScanning={isScanning}
  isDark={isDark}
  isRadiusMode={radiusMapState.isRadiusMode}
  radiusLayers={radiusMapState.radiusLayers}
  activeRadius={radiusMapState.activeRadius}
  radiusCenter={radiusMapState.radiusCenter}
  waypointsInRadius={radiusMapState.waypointsInRadius}
  allRadiusPolygons={radiusMapState.allRadiusPolygons}
/>

        {activePanel === 'areascan' && kabState.scanMode === 'kabupaten' && (
          <KabupatenMapOverlay
            kabupatenList={kabState.kabupatenList}
            selectedKabupaten={kabState.selectedKabupaten}
            isClickMode={kabState.isKabupatenClickMode}
            isActive={true}
            onSelect={kabState.handleSelect}
            isDark={isDark}
          />
        )}

        {/* BMKG Layer */}
        <BmkgLayer activeLayers={activeLayers} bmkgData={bmkgData} />

        {/* Waypoint layers */}
        <WaypointLayer activeLayers={activeLayers} waypointData={waypointData} />

        {/* Local layers (upload lokal) */}
        <LocalGeoLayer
  localLayers={localLayers}
  onRenameLayer={(id) => setRenamingLayerId(id)}
  onEditFeature={handleEditFeature}
/>

        {/* ScaleControl */}
        {!modeBersih && <ScaleControl position="bottomright" imperial={true} metric={true} />}

        {activePanel === 'radius' && (
          <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none' }}>
            <aside
              className={`
                ${radiusPanelCls} z-[1050] overflow-hidden flex flex-col
                ${radiusBgColor} border ${radiusBorderColor}
                ${isDark ? 'text-slate-100' : 'text-slate-900'}
              `}
              style={{
                pointerEvents: 'auto',
                boxShadow: isDark
                  ? '0 8px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
                  : '0 8px 30px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 z-10 rounded-t-2xl" />

              {/* FIX #1 — Tombol Close: pakai <div role="button"> bukan <button>
                  untuk menghindari nested button / HTML hydration error */}
              <div
                role="button"
                tabIndex={0}
                onClick={closePanel}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && closePanel()}
                className={`absolute top-3 right-3 z-20 p-2 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title="Tutup panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              {/* FIX #2 — Pass waypointData, waypointLayers, activeLayers ke
                  RadiusPanel agar RadiusValidationPanel bisa mendeteksi waypoint
                  yang aktif dari LayersPanel */}
              <RadiusPanel
                activeRadius={activeRadius}
                setActiveRadius={setActiveRadius}
                onRadiusCreated={(r) => console.log('Radius dibuat:', r)}
                onRadiusCleared={(id) => console.log('Radius dihapus:', id)}
                isDark={isDark}
                /* ↓ Props baru untuk integrasi waypoint validation */
                waypointData={waypointData}
                waypointLayers={WAYPOINT_LAYERS}
                activeLayers={activeLayers}
                mapRef={mapRef}
              />
            </aside>
          </div>
        )}
      </MapContainer>

          {renamingLayer && (
  <RenameModal
    layer={renamingLayer}
    onClose={() => setRenamingLayerId(null)}
    onApply={(newGeojson) => {
      updateLayer(renamingLayer.id, { geojson: newGeojson });
      setRenamingLayerId(null);

      // Force close semua popup Leaflet yang terbuka
      // agar saat diklik lagi, popup re-render dengan data terbaru
      setTimeout(() => {
        const map = mapRef.current;
        if (map) map.closePopup();
      }, 50);
    }}
    isDark={isDark}
  />
)}

    </div>
  );
}