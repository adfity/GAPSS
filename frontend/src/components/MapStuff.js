"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import L from 'leaflet';
import { 
  GeoJSON, Polygon, Popup, useMap, useMapEvents
} from 'react-leaflet';
import { 
  Home, Map as MapIcon, Layers, LocateFixed, Plus, Minus, Search, X, Eye, EyeOff
} from 'lucide-react';
import { useBoundaryData, BoundaryLayer } from './panel/layers';
import { toast } from 'react-hot-toast';

// ZOOM BUTTONS
export function ZoomButtons({ modeBersih }) {
  const map = useMap();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (modeBersih) return null;

  return (
    <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2">
      <button
        onClick={() => map.zoomIn()}
        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"
        title="Zoom In"
      >
        <Plus size={16} strokeWidth={3} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"
        title="Zoom Out"
      >
        <Minus size={16} strokeWidth={3} />
      </button>
    </div>
  );
}

// KOORDINAT PENGIKUT KURSOR
export function MouseCoordinate({ modeBersih }) {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });
  
  useMapEvents({
    mousemove: (e) => {
      setCoords({
        lat: e.latlng.lat.toFixed(4),
        lng: e.latlng.lng.toFixed(4)
      });
    },
  });

  if (modeBersih) return null;

  return (
    <div className="absolute bottom-6 right-0 z-[1000]">
      <div className="bg-white/75 dark:bg-slate-800/95 backdrop-blur-xl px-2 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
          <span className="text-blue-600 dark:text-blue-400">Lat:</span> {coords.lat} | <span className="text-blue-600 dark:text-blue-400">Lng:</span> {coords.lng}
        </div>
      </div>
    </div>
  );
}

// SEARCH LOCATION - FIXED: Search by Province Name
export function SearchLocation({ boundaryData, modeBersih }) {
  const map = useMap();
  const [searchTerbuka, setSearchTerbuka] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [provinsiDipilih, setProvinsiDipilih] = useState(null);

  useEffect(() => {
    if (!boundaryData?.provinsi?.features || !searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }
    
    // Filter berdasarkan nama provinsi
    const suggestions = boundaryData.provinsi.features
      .filter(f => f.properties?.Propinsi?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(f => ({
        nama: f.properties.Propinsi,
        geometry: f.geometry
      }))
      .slice(0, 5);
    
    setSearchSuggestions(suggestions);
  }, [searchQuery, boundaryData]);

  const handleSearch = (namaProvinsi) => {
    const provinsiNama = namaProvinsi || searchQuery;
    if (!boundaryData?.provinsi?.features || !provinsiNama.trim()) return;
    
    const fitur = boundaryData.provinsi.features.find(f => 
      f.properties?.Propinsi?.toLowerCase() === provinsiNama.toLowerCase()
    );
    
    if (fitur && map) {
      const coords = fitur.geometry.coordinates;
      let lat, lng;
      
      if (fitur.geometry.type === "MultiPolygon") {
        const polygon = coords[0][0];
        lat = polygon.reduce((sum, coord) => sum + coord[1], 0) / polygon.length;
        lng = polygon.reduce((sum, coord) => sum + coord[0], 0) / polygon.length;
      } else if (fitur.geometry.type === "Polygon") {
        const polygon = coords[0];
        lat = polygon.reduce((sum, coord) => sum + coord[1], 0) / polygon.length;
        lng = polygon.reduce((sum, coord) => sum + coord[0], 0) / polygon.length;
      }
      
      map.setView([lat, lng], 7);
      setProvinsiDipilih(fitur.properties.Propinsi);
      
      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <div>
            <div className="font-bold">Lokasi Ditemukan!</div>
            <div className="text-xs">{fitur.properties.Propinsi}</div>
          </div>
        </div>,
        {
          duration: 3000,
          style: {
            background: '#fff',
            color: '#333',
            padding: '12px',
            borderRadius: '12px'
          }
        }
      );
      
      setSearchTerbuka(false);
      setSearchQuery('');
      setSearchSuggestions([]);
    } else {
      toast.error('Provinsi tidak ditemukan');
    }
  };

  if (modeBersih) return null;

  return (
    <div className="absolute top-[220px] left-6 z-[1000]">
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
            <button 
              onClick={() => handleSearch()}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all"
            >
              <Search size={16} />
            </button>
            <button 
              onClick={() => { setSearchTerbuka(false); setSearchQuery(''); setSearchSuggestions([]); setProvinsiDipilih(null); }}
              className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
            >
              <X size={16} />
            </button>
          </div>
          
          {/* AUTOCOMPLETE SUGGESTIONS */}
          {searchSuggestions.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
              {searchSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(sug.nama)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{sug.nama}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button 
          onClick={() => setSearchTerbuka(true)}
          className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"
        >
          <Search size={16}/>
        </button>
      )}
    </div>
  );
}

// TOMBOL MODE BERSIH
export function CleanModeButton({ modeBersih, setModeBersih }) {
  return (
    <div className="absolute top-[170px] left-6 z-[1000]">
      <button 
        onClick={() => setModeBersih(!modeBersih)}
        className="p-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-90 border-2 border-white dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600"
      >
        {modeBersih ? (
          <EyeOff size={16} className="text-white" />
        ) : (
          <Eye size={16} className="text-white" />
        )}
      </button>
    </div>
  );
}

// MAP RESET
export function MapReset({ trigger, onDone }) {
  const map = useMap();
  useEffect(() => {
    if (!trigger) return;
    map.flyTo([-2.5, 118], 5, { animate: true, duration: 1 });
    onDone();
  }, [trigger]);
  return null;
}

// SIDEBAR BUTTONS - Dynamic icons untuk light/dark mode
export function SidebarButtons({ activePanel, setActivePanel, setGoHome, modeBersih }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDark(theme === 'dark');
    };
    
    checkMobile();
    checkTheme();
    
    window.addEventListener('resize', checkMobile);
    
    // Observer untuk theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      observer.disconnect();
    };
  }, []);

  const buttons = [
    { id: 'home', icon: <Home size={18} />, label: 'Home' },
    { id: 'basemap', icon: <MapIcon size={18} />, label: 'Basemap' },
    { id: 'layers', icon: <Layers size={18} />, label: 'Layers' },
    { 
      id: 'radius', 
      icon: <div className="w-6 h-6">
        <img src={isDark ? "/icons/Wradius.png" : "/icons/bradius.png"} className="w-full h-full" alt="Radius" />
      </div>, 
      label: 'Radius' 
    },
    { 
      id: 'geoai', 
      icon: <div className="w-6 h-6">
        <img src={isDark ? "/icons/wgeo.png" : "/icons/bgeo.png"} className="w-full h-full" alt="GeoAI" />
      </div>, 
      label: 'GeoAI' 
    },
    { 
      id: 'analysis', 
      icon: <div className="w-6 h-6">
        <img src={isDark ? "/icons/wanalis.png" : "/icons/banalis.png"} className="w-full h-full" alt="Analisis" />
      </div>, 
      label: 'Analisis' 
    },
    { id: 'share', icon: <LocateFixed size={18} />, label: 'Lokasi' },
  ];

  const handleButtonClick = (btnId) => {
    if (btnId === 'home') {
      setGoHome(true);
      setActivePanel(null);
      toast.success('Kembali ke tampilan default');
    } else {
      setActivePanel(activePanel === btnId ? null : btnId);
    }
  };

  if (modeBersih) return null;

  if (isMobile) {
    // MOBILE: Footer tengah horizontal
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1100]">
        <div className="flex flex-row items-center gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-3 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xl">
          {buttons.map(btn => (
            <button 
              key={btn.id} 
              onClick={() => handleButtonClick(btn.id)} 
              className={`
                w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300
                ${activePanel === btn.id 
                  ? 'bg-cyan-500 text-white scale-110 shadow-lg' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                }
              `}
            >
              {activePanel === btn.id ? <span className="text-base font-bold">≫</span> : btn.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // DESKTOP: Sidebar kanan vertikal
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[1100]">
      <div className="flex flex-col space-y-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-xl">
        {buttons.map(btn => (
          <button 
            key={btn.id} 
            onClick={() => handleButtonClick(btn.id)} 
            className={`
              group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
              ${activePanel === btn.id 
                ? 'bg-cyan-500 text-white scale-110' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }
            `}
          >
            <div className="transition-transform duration-300 group-hover:scale-110">
              {activePanel === btn.id ? <span className="text-xl font-bold">≫</span> : btn.icon}
            </div>
            <span className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-800 dark:bg-slate-700 text-white text-[11px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              {btn.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// PREVIEW LAYER - Popup dengan LUAS
export function PreviewLayer({ previewData, setPreviewData, getCategoryColor }) {
  const map = useMap();
  
  const removeObject = (idx) => {
    const newData = [...previewData];
    newData.splice(idx, 1);
    setPreviewData(newData);
    
    // Force close all popups
    map.closePopup();
    
    toast.success('Preview dihapus');
  };

  if (!previewData || previewData.length === 0) return null;

  return (
    <>
      {previewData.map((obj, idx) => {
        if (!obj.segmentation) return null;
        
        const scanCenterPixel = map.latLngToContainerPoint([obj.lat, obj.lng]);
        const halfSize = (obj.capture_size || 640) / 2;
        
        const polygonCoords = obj.segmentation.map(point => {
          const latLng = map.containerPointToLatLng([
            scanCenterPixel.x + (point[0] - halfSize),
            scanCenterPixel.y + (point[1] - halfSize)
          ]);
          return [latLng.lat, latLng.lng];
        });

        return (
          <Polygon 
            key={`preview-${idx}`} 
            positions={polygonCoords}
            pathOptions={{ 
              color: getCategoryColor(obj.kategori),
              fillColor: getCategoryColor(obj.kategori),
              fillOpacity: 0.5,
              dashArray: '5, 10' 
            }}
          >
            <Popup>
              <div className="p-1">
                <p className="font-bold text-sm uppercase">{obj.kategori}</p>
                {obj.luas_m2 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Luas: <span className="font-bold text-blue-600">{obj.luas_m2} m²</span>
                  </p>
                )}
                <button 
                  onClick={() => removeObject(idx)} 
                  className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white text-[10px] py-1 rounded transition"
                >
                  Batalkan
                </button>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

// ✅ SAVED DATA LAYER - DENGAN PROVINSI & INFO LENGKAP
export function SavedDataLayer({ data, onRefreshData, getCategoryColor }) {
  const handleDelete = async (feature_id) => {
    toast.custom((t) => (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-4 min-w-[300px]">
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Hapus data ini?</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              toast.dismiss(t.id);
            }}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Batal
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              await performDelete(feature_id);
            }}
            className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg"
          >
            Hapus
          </button>
        </div>
      </div>
    ));
  };

  const performDelete = async (feature_id) => {
    const deleteToast = toast.loading('Menghapus data...');
  
    try {
      await axios.delete(`http://127.0.0.1:8000/api/features/${feature_id}/`);
      toast.success('Data berhasil dihapus', { id: deleteToast });
      onRefreshData();
    } catch (err) {
      toast.error('Gagal menghapus data', { id: deleteToast });
    }
  };

  if (!data || !Array.isArray(data)) return null;

  return (
    <>
      {data.map((item, idx) => (
        <GeoJSON key={item.feature_id || idx} data={item.location}
          style={() => ({
            color: getCategoryColor(item.kategori),
            fillColor: getCategoryColor(item.kategori),
            fillOpacity: 0.4,
            weight: 2
          })}
        >
          <Popup>
            <div className="p-2 text-left max-w-xs">
              {/* KATEGORI */}
              <p className="font-bold text-sm uppercase text-blue-700 mb-3">
                {item.kategori}
              </p>

              {/* ✅ NEW: PROVINSI */}
              {item.provinsi && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 dark:bg-slate-700 rounded">
                  <span className="text-lg">📍</span>
                  <div className="text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-300 block">
                      Provinsi
                    </span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold">
                      {item.provinsi}
                    </span>
                  </div>
                </div>
              )}

              {/* LUAS */}
              {item.metadata?.luas_estimasi && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <span className="text-lg">📏</span>
                  <div className="text-xs">
                    <span className="font-bold text-green-600 dark:text-green-400 block">
                      Luas Estimasi
                    </span>
                    <span className="text-green-700 dark:text-green-300 font-bold">
                      {item.metadata.luas_estimasi} m²
                    </span>
                  </div>
                </div>
              )}

              {/* ✅ NEW: CONFIDENCE SCORE */}
              {item.confidence_score && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                  <span className="text-lg">⭐</span>
                  <div className="text-xs">
                    <span className="font-bold text-orange-600 dark:text-orange-400 block">
                      Akurasi
                    </span>
                    <span className="text-orange-700 dark:text-orange-300 font-bold">
                      {(item.confidence_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* ✅ NEW: CREATED DATE */}
              {item.created_at && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  {new Date(item.created_at).toLocaleString('id-ID')}
                </div>
              )}

              {/* TOMBOL HAPUS */}
              <button 
                onClick={() => handleDelete(item.feature_id)} 
                className="mt-3 w-full text-red-600 dark:text-red-400 text-xs font-bold hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 py-1.5 rounded transition-colors"
              >
                🗑️ HAPUS
              </button>
            </div>
          </Popup>
        </GeoJSON>
      ))}
    </>
  );
}

// RBI LAYER
export function RBILayer({ activeLayers, rbiData, getCategoryColor }) {
  return (
    <>
      {Object.keys(rbiData).map(layerKey => {
        if (!activeLayers.includes(layerKey)) return null;
        const parts = layerKey.split('_');
        const kategori = parts[0];
        const wilayah = parts.slice(1).join('_');
        
        return (
          <GeoJSON key={`rbi-${layerKey}`} data={rbiData[layerKey]}
            pointToLayer={(f, latlng) => L.circleMarker(latlng, {
              radius: kategori === 'pendidikan' ? 4 : 5,
              fillColor: getCategoryColor(kategori),
              color: "#ffffff",
              weight: kategori === 'kesehatan' ? 2 : 1,
              fillOpacity: 0.9
            })}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              layer.bindPopup(`
                <div style="font-size:12px; min-width:180px">
                  <b style="color:${getCategoryColor(kategori)}">${props.NAMOBJ || 'Tanpa Nama'}</b><br/>
                  <span>${props.REMARK || (kategori === 'pendidikan' ? 'Sekolah' : 'Kesehatan')}</span><br/>
                  <small>Wilayah: ${wilayah}</small>
                </div>
              `);
            }}
          />
        );
      })}
    </>
  );
}

// ANALYSIS LAYER
export function AnalysisLayer({ activeAnalysisData }) {
  if (!activeAnalysisData?.matched_features?.features) return null;

  return (
    <GeoJSON
      key={activeAnalysisData.analysis_id}
      data={activeAnalysisData.matched_features}
      style={(feature) => {
        const analysis = feature.properties?.analysis || {};
        return {
          fillColor: analysis.warna || '#cbd5e1',
          weight: 2,
          opacity: 1,
          color: 'white',
          fillOpacity: 0.7
        };
      }}
      onEachFeature={(feature, layer) => {
        const analysis = feature.properties?.analysis || {};
        const dataAps = analysis.aps_data || {};
        
        layer.bindTooltip(`
          <div style="font-family: inherit; padding: 6px;">
            <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.1em;">
              ${analysis.nama_provinsi}
            </div>
            <div style="font-size: 10px; font-weight: 800; color: ${analysis.warna}; margin-top:2px;">
              STATUS: ${analysis.kategori}
            </div>
          </div>
        `, { sticky: true, opacity: 0.95 });

        const wawasan = analysis.insights?.map(i => 
          `<div style="margin-bottom:6px; padding-left:10px; border-left:3px solid ${analysis.warna}; font-weight: 600;">${i}</div>`
        ).join('') || '';

        layer.bindPopup(`
          <div style="font-family: inherit; min-width: 280px; color: #1e293b; padding: 5px;">
            <div style="background: ${analysis.warna}; color: white; padding: 15px; border-radius: 12px 12px 4px 4px; margin-bottom: 10px;">
              <div style="font-weight: 900; font-size: 16px; text-transform: uppercase; letter-spacing: 0.1em;">
                ${analysis.nama_provinsi}
              </div>
              <div style="font-size: 10px; font-weight: 800; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">
                Analisis Strategis Wilayah
              </div>
            </div>
            <div style="padding: 10px;">
              <div style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">
                Wawasan Utama
              </div>
              <div style="font-size: 12px; color: #334155; line-height: 1.5; margin-bottom: 15px;">
                ${wawasan}
              </div>
              <div style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">
                Matriks Partisipasi
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align:center; border: 1px solid #f1f5f9;">
                  <div style="font-size: 9px; font-weight: 900; color: #0369a1; text-transform: uppercase;">SD</div>
                  <div style="font-size: 13px; font-weight: 900;">${dataAps.APS_7_12 || '-'}%</div>
                </div>
                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align:center; border: 1px solid #f1f5f9;">
                  <div style="font-size: 9px; font-weight: 900; color: #a16207; text-transform: uppercase;">SMP</div>
                  <div style="font-size: 13px; font-weight: 900;">${dataAps.APS_13_15 || '-'}%</div>
                </div>
              </div>
            </div>
          </div>
        `);
      }}
    />
  );
}

// MAIN COMPONENT
export default function MapStuff(props) {
  const { boundaryData, getBoundaryStyle, onEachBoundary } = useBoundaryData(props.activeLayers);
  const [modeBersih, setModeBersih] = useState(false);
  
  return (
    <>
      {/* 1. Base Boundary Layer */}
      <BoundaryLayer 
        activeLayers={props.activeLayers}
        boundaryData={boundaryData}
        getBoundaryStyle={getBoundaryStyle}
        onEachBoundary={onEachBoundary}
      />
      
      {/* 2. Analysis & GeoAI Layers */}
      <AnalysisLayer activeAnalysisData={props.activeAnalysisData} />
      
      {/* 3. RBI Point Layers (Pendidikan, Kesehatan, dll) */}
      <RBILayer 
        activeLayers={props.activeLayers}
        rbiData={props.rbiData}
        getCategoryColor={props.getCategoryColor}
      />
      
      {/* 4. Real-time Preview Layer (Segmentation) */}
      <PreviewLayer 
        previewData={props.previewData}
        setPreviewData={props.setPreviewData}
        getCategoryColor={props.getCategoryColor}
      />
      
      {/* 5. Persistence Layer (Data dari MongoDB) - DENGAN PROVINSI */}
      <SavedDataLayer 
        data={props.data}
        onRefreshData={props.onRefreshData}
        getCategoryColor={props.getCategoryColor}
      />
      
      {/* 6. Map UI Controls */}
      <ZoomButtons modeBersih={modeBersih} />
      <MouseCoordinate modeBersih={modeBersih} />
      <CleanModeButton modeBersih={modeBersih} setModeBersih={setModeBersih} />
      <SearchLocation boundaryData={boundaryData} modeBersih={modeBersih} />
      
      {/* 7. Map Utilities */}
      <MapReset trigger={props.goHome} onDone={() => props.setGoHome(false)} />
      <SidebarButtons 
        activePanel={props.activePanel}
        setActivePanel={props.setActivePanel}
        setGoHome={props.setGoHome}
        modeBersih={modeBersih}
      />
    </>
  );
}