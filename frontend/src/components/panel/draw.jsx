"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import {
  Pentagon, Square, Circle, Minus, Trash2, Download,
  MousePointer2, Move, Pencil, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Geoman Map Controller ───────────────────────────────────────────────────
// Initializes Geoman on the map, hides default toolbar, and manages draw state
// controlled from the DrawPanel via a shared ref.

export function GeomanController({ isActive, drawModeRef, drawnLayersRef, onLayerChange }) {
  const map = useMap();
  const isInitRef = useRef(false);

  // Initialize Geoman once
  useEffect(() => {
    if (!map || isInitRef.current) return;

    // Hide all default Geoman toolbar buttons
    map.pm.addControls({
      position: 'topleft',
      drawMarker: false, drawCircleMarker: false, drawPolyline: false,
      drawRectangle: false, drawPolygon: false, drawCircle: false,
      drawText: false, editMode: false, dragMode: false,
      cutPolygon: false, removalMode: false, rotateMode: false,
    });

    // Completely hide the Geoman toolbar
    const toolbar = document.querySelector('.leaflet-pm-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    // Set global styling
    map.pm.setGlobalOptions({
      pathOptions: {
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.15,
        weight: 3,
      },
      snappable: true,
      snapDistance: 15,
      tooltips: true,
    });

    isInitRef.current = true;
  }, [map]);

  // Listen for pm:create / pm:remove
  useEffect(() => {
    if (!map) return;

    const handleCreate = (e) => {
      if (!drawnLayersRef.current) drawnLayersRef.current = [];
      drawnLayersRef.current = [...drawnLayersRef.current, e.layer];
      onLayerChange?.();
    };

    const handleRemove = (e) => {
      if (!drawnLayersRef.current) return;
      drawnLayersRef.current = drawnLayersRef.current.filter(l => l !== e.layer);
      onLayerChange?.();
    };

    map.on('pm:create', handleCreate);
    map.on('pm:remove', handleRemove);
    return () => {
      map.off('pm:create', handleCreate);
      map.off('pm:remove', handleRemove);
    };
  }, [map, onLayerChange]);

  // Cleanup when panel is closed
  useEffect(() => {
    if (!isActive && map && isInitRef.current) {
      map.pm.disableDraw();
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.disableGlobalRemovalMode();
    }
  }, [isActive, map]);

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getShapeType(layer) {
  if (layer instanceof L.Circle) return 'Circle';
  if (layer instanceof L.Rectangle) return 'Rectangle';
  if (layer instanceof L.Polygon) return 'Polygon';
  if (layer instanceof L.Polyline) return 'Line';
  return 'Shape';
}

function formatArea(layer) {
  try {
    if (layer instanceof L.Circle) {
      const r = layer.getRadius();
      const area = Math.PI * r * r;
      return area > 1_000_000
        ? `${(area / 1_000_000).toFixed(2)} km²`
        : `${area.toFixed(0)} m²`;
    }
    const latlngs = layer.getLatLngs?.();
    if (!latlngs || !latlngs[0]) return null;
    const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    if (ring.length < 3) return null;

    // Manual geodesic area (Shoelace on lat/lng isn't perfect, but sufficient for display)
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      area += ring[i].lng * ring[j].lat;
      area -= ring[j].lng * ring[i].lat;
    }
    area = Math.abs(area / 2) * 111320 * 111320;
    return area > 1_000_000
      ? `${(area / 1_000_000).toFixed(2)} km²`
      : `${area.toFixed(0)} m²`;
  } catch {
    return null;
  }
}

// ─── Draw Panel ──────────────────────────────────────────────────────────────

export default function DrawPanel({ isDark, mapRef }) {
  const [drawMode, setDrawMode] = useState(null);
  const [layerCount, setLayerCount] = useState(0);
  const [showShapes, setShowShapes] = useState(true);
  const [, forceUpdate] = useState(0);

  // Access drawn layers from map
  const getDrawnLayers = () => {
    const map = mapRef?.current;
    if (!map) return [];
    const layers = [];
    map.eachLayer((layer) => {
      if (layer.pm && layer._path && !layer._url) {
        layers.push(layer);
      }
    });
    return layers;
  };

  const applyMode = (mode) => {
    const map = mapRef?.current;
    if (!map || !map.pm) return;

    // Disable everything first
    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalDragMode();
    map.pm.disableGlobalRemovalMode();

    if (drawMode === mode) {
      setDrawMode(null);
      return;
    }

    setDrawMode(mode);

    switch (mode) {
      case 'polygon':
        map.pm.enableDraw('Polygon');
        break;
      case 'rectangle':
        map.pm.enableDraw('Rectangle');
        break;
      case 'circle':
        map.pm.enableDraw('Circle');
        break;
      case 'line':
        map.pm.enableDraw('Line');
        break;
      case 'edit':
        map.pm.enableGlobalEditMode();
        break;
      case 'drag':
        map.pm.enableGlobalDragMode();
        break;
      case 'delete':
        map.pm.enableGlobalRemovalMode();
        break;
    }
  };

  // Auto-refresh shape list when layers change
  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return;

    const refresh = () => {
      setLayerCount(getDrawnLayers().length);
      forceUpdate(n => n + 1);
    };

    map.on('pm:create', refresh);
    map.on('pm:remove', refresh);
    map.on('pm:edit', refresh);

    // Initial count
    refresh();

    return () => {
      map.off('pm:create', refresh);
      map.off('pm:remove', refresh);
      map.off('pm:edit', refresh);
    };
  }, [mapRef]);

  const clearAll = () => {
    const layers = getDrawnLayers();
    const map = mapRef?.current;
    if (!map) return;
    layers.forEach(layer => map.removeLayer(layer));
    setLayerCount(0);
    forceUpdate(n => n + 1);
    toast.success('Semua shape dihapus');
  };

  const exportGeoJSON = () => {
    const layers = getDrawnLayers();
    if (layers.length === 0) {
      toast.error('Tidak ada shape untuk diekspor');
      return;
    }

    const features = layers.map(layer => {
      if (layer.toGeoJSON) return layer.toGeoJSON();
      return null;
    }).filter(Boolean);

    const geojson = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `draw_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${features.length} shape diekspor sebagai GeoJSON`);
  };

  const drawnLayers = getDrawnLayers();

  const btnClass = (mode) => `
    flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer
    ${drawMode === mode
      ? isDark
        ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
        : 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-300'
      : isDark
        ? 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }
  `;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-bold tracking-tight">Draw Tools</h2>
        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Gambar polygon, rectangle, atau circle secara manual di peta
        </p>
      </div>

      {/* Draw Mode Buttons */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => applyMode('polygon')} className={btnClass('polygon')}>
            <Pentagon size={18} />
            Polygon
          </button>
          <button onClick={() => applyMode('rectangle')} className={btnClass('rectangle')}>
            <Square size={18} />
            Kotak
          </button>
          <button onClick={() => applyMode('circle')} className={btnClass('circle')}>
            <Circle size={18} />
            Lingkaran
          </button>
          <button onClick={() => applyMode('line')} className={btnClass('line')}>
            <Minus size={18} />
            Garis
          </button>
        </div>
      </div>

      {/* Edit Tools */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => applyMode('edit')} className={btnClass('edit')}>
            <Pencil size={16} />
            Edit
          </button>
          <button onClick={() => applyMode('drag')} className={btnClass('drag')}>
            <Move size={16} />
            Pindah
          </button>
          <button onClick={() => applyMode('delete')} className={btnClass('delete')}>
            <Trash2 size={16} />
            Hapus
          </button>
        </div>
      </div>

      {/* Separator */}
      <div className={`mx-4 h-px ${isDark ? 'bg-slate-700/50' : 'bg-slate-200'}`} />

      {/* Shape List */}
      <div className="flex-1 overflow-y-auto px-4 pt-3">
        <button
          onClick={() => setShowShapes(!showShapes)}
          className={`w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-2 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <span>Shapes ({drawnLayers.length})</span>
          {showShapes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showShapes && (
          <div className="space-y-1.5">
            {drawnLayers.length === 0 ? (
              <div className={`text-center py-6 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <MousePointer2 size={24} className="mx-auto mb-2 opacity-40" />
                Belum ada shape. Pilih tool di atas lalu klik di peta.
              </div>
            ) : (
              drawnLayers.map((layer, idx) => {
                const type = getShapeType(layer);
                const area = formatArea(layer);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
                      isDark ? 'bg-slate-800/50' : 'bg-slate-50'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{type} #{idx + 1}</span>
                      {area && (
                        <span className={`ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {area}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className={`px-4 py-3 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
        <div className="flex gap-2">
          <button
            onClick={clearAll}
            disabled={drawnLayers.length === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors
              ${drawnLayers.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}
              ${isDark
                ? 'bg-red-900/30 text-red-300 hover:bg-red-900/50'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
          >
            <Trash2 size={13} />
            Hapus Semua
          </button>
          <button
            onClick={exportGeoJSON}
            disabled={drawnLayers.length === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors
              ${drawnLayers.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}
              ${isDark
                ? 'bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50'
                : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
              }`}
          >
            <Download size={13} />
            Export GeoJSON
          </button>
        </div>
      </div>
    </div>
  );
}
