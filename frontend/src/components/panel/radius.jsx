// "use client";
// import { useState, useRef, useCallback, useMemo, memo } from 'react';
// import {
//   Circle, Marker, Popup, useMap, Polygon,
// } from 'react-leaflet';
// import {
//   Navigation, MapPin, Trash2, Target, Copy, Eye, Play, Square, Pause,
//   CheckCircle2, AlertTriangle, X, ChevronRight, Zap, TrendingUp,
//   Layers, Download, RotateCcw, Home, Trees, Waves, Route, ScanLine,
//   BarChart2, ChevronDown, ChevronUp, Search, Info, Settings, LayoutGrid,
// } from 'lucide-react';
// import L from 'leaflet';
// import { toast } from 'react-hot-toast';

// // ─── CONSTANTS ────────────────────────────────────────────────────────────────

// const CAPTURE_ZOOM = 19;
// const CAPTURE_PX   = 640;
// const YOLO_SIZE    = 640;
// const WAYPOINT_SCAN_ZOOM = 17;

// const meterToLat = (m) => m / 111320;
// const meterToLng = (m, lat) => m / (111320 * Math.cos((lat * Math.PI) / 180));

// const WAYPOINT_CATEGORY_MAP = {
//   university:        ['bangunan'],
//   college:           ['bangunan'],
//   school:            ['bangunan'],
//   kindergarten:      ['bangunan'],
//   sekolah:           ['bangunan'],
//   universitas:       ['bangunan'],
//   madrasah:          ['bangunan'],
//   hospital:          ['bangunan'],
//   clinic:            ['bangunan'],
//   health_post:       ['bangunan'],
//   pharmacy:          ['bangunan'],
//   puskesmas:         ['bangunan'],
//   rumah_sakit:       ['bangunan'],
//   klinik:            ['bangunan'],
//   townhall:          ['bangunan'],
//   village_office:    ['bangunan'],
//   government_office: ['bangunan'],
//   ministry:          ['bangunan'],
//   police:            ['bangunan'],
//   fire_station:      ['bangunan'],
//   courthouse:        ['bangunan'],
//   immigration:       ['bangunan'],
//   tax_office:        ['bangunan'],
//   legislative:       ['bangunan'],
//   kantor:            ['bangunan'],
//   community_centre:  ['bangunan'],
//   kitchen:           ['bangunan'],
//   food_centre:       ['bangunan'],
//   nutrition_centre:  ['bangunan', 'pepohonan'],
//   canteen:           ['bangunan'],
//   base:              ['bangunan'],
//   barracks:          ['bangunan'],
//   checkpoint:        ['bangunan'],
//   military_office:   ['bangunan'],
//   training_area:     ['pepohonan', 'bangunan'],
//   airfield:          ['bangunan', 'jalan'],
//   naval_base:        ['bangunan', 'perairan'],
//   taman:             ['pepohonan'],
//   hutan:             ['pepohonan'],
//   sungai:            ['perairan'],
//   danau:             ['perairan'],
//   sawah:             ['pepohonan', 'perairan'],
//   jalan:             ['jalan'],
//   jembatan:          ['jalan'],
//   default:           ['bangunan', 'pepohonan', 'perairan', 'jalan'],
// };

// const CATEGORY_META = {
//   bangunan:  { color: '#f59e0b', Icon: Home,  label: 'Bangunan'  },
//   pepohonan: { color: '#16a34a', Icon: Trees, label: 'Pepohonan' },
//   perairan:  { color: '#2563eb', Icon: Waves, label: 'Perairan'  },
//   jalan:     { color: '#64748b', Icon: Route, label: 'Jalan'     },
// };

// const SCAN_TILE_METER = 200;

// // ─── HELPERS ──────────────────────────────────────────────────────────────────

// const calcDistance = (lat1, lng1, lat2, lng2) => {
//   const R = 6371000;
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLng = ((lng2 - lng1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// };

// const fmtDist = (m) =>
//   m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

// const fmtArea = (m2) => {
//   if (!m2) return '—';
//   if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
//   if (m2 >= 10_000)    return `${(m2 / 10_000).toFixed(2)} ha`;
//   return `${Math.round(m2)} m²`;
// };

// function getExpectedCategories(waypointCategory = '') {
//   const cat = waypointCategory.toLowerCase().replace(/[\s-]/g, '_');
//   for (const [key, val] of Object.entries(WAYPOINT_CATEGORY_MAP)) {
//     if (cat.includes(key)) return val;
//   }
//   return WAYPOINT_CATEGORY_MAP.default;
// }

// function findNearestWaypoint(polygonLatLng, waypoints, maxDistMeter = 500) {
//   if (!polygonLatLng?.length || !waypoints?.length) return null;
//   const sumLat = polygonLatLng.reduce((s, p) => s + p[0], 0);
//   const sumLng = polygonLatLng.reduce((s, p) => s + p[1], 0);
//   const cLat = sumLat / polygonLatLng.length;
//   const cLng = sumLng / polygonLatLng.length;
//   let nearest = null;
//   let minDist = Infinity;
//   for (const wp of waypoints) {
//     const d = calcDistance(cLat, cLng, wp.lat, wp.lng);
//     if (d < minDist) { minDist = d; nearest = { ...wp, distToPolygon: d }; }
//   }
//   if (!nearest || minDist > maxDistMeter) return null;
//   return nearest;
// }

// function crossValidatePolygon(polygon, nearestWp) {
//   if (!nearestWp) {
//     return {
//       status: 'no_waypoint',
//       label: 'Tidak ada waypoint',
//       color: '#94a3b8',
//       reason: 'Tidak ada waypoint terdekat dalam radius 500m',
//     };
//   }
//   const expected = getExpectedCategories(nearestWp.category);
//   const isMatch  = expected.includes(polygon.kategori);
//   const conf     = polygon.confidence_score || 0;
//   if (isMatch && conf >= 0.5) {
//     return {
//       status: 'valid',
//       label: 'Valid ✓',
//       color: '#22c55e',
//       reason: `Sesuai dengan ${nearestWp.name} (${nearestWp.category}) · ${Math.round(conf * 100)}%`,
//       waypointName: nearestWp.name,
//       waypointCategory: nearestWp.category,
//     };
//   }
//   if (isMatch && conf < 0.5) {
//     return {
//       status: 'low_conf',
//       label: 'Conf Rendah',
//       color: '#f59e0b',
//       reason: `Sesuai tipe tapi confidence rendah (${Math.round(conf * 100)}%)`,
//       waypointName: nearestWp.name,
//       waypointCategory: nearestWp.category,
//     };
//   }
//   return {
//     status: 'mismatch',
//     label: 'Tidak Sesuai ⚠',
//     color: '#ef4444',
//     reason: `Terdeteksi ${polygon.kategori} tapi waypoint "${nearestWp.name}" (${nearestWp.category}) berharap ${expected.join('/')}`,
//     waypointName: nearestWp.name,
//     waypointCategory: nearestWp.category,
//   };
// }

// function calcValidationStats(allPolygons) {
//   const valid    = allPolygons.filter(p => p.validation?.status === 'valid').length;
//   const mismatch = allPolygons.filter(p => p.validation?.status === 'mismatch').length;
//   const lowConf  = allPolygons.filter(p => p.validation?.status === 'low_conf').length;
//   const noWp     = allPolygons.filter(p => p.validation?.status === 'no_waypoint').length;
//   const total    = allPolygons.length;
//   const validRate = total > 0 ? Math.round((valid / total) * 100) : 0;
//   const catCounts = {};
//   allPolygons.forEach(p => {
//     catCounts[p.kategori] = (catCounts[p.kategori] || 0) + 1;
//   });
//   return { valid, mismatch, lowConf, noWp, total, validRate, catCounts };
// }

// // ─── ICONS ────────────────────────────────────────────────────────────────────

// const createCenterIcon = () =>
//   L.divIcon({
//     html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#06b6d4,#3b82f6);border-radius:50%;border:3px solid white;box-shadow:0 0 18px rgba(6,182,212,0.9);display:flex;align-items:center;justify-content:center;"><div style="width:7px;height:7px;background:white;border-radius:50%;"></div></div>`,
//     iconSize: [28, 28], iconAnchor: [14, 14],
//   });

// const createWaypointIcon = (color = '#3b82f6') =>
//   L.divIcon({
//     html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${color}80;"></div>`,
//     iconSize: [14, 14], iconAnchor: [7, 7],
//   });

// // ─── EXTRACT WAYPOINTS ────────────────────────────────────────────────────────

// function extractWaypoints(waypointData, waypointLayers, activeLayers) {
//   const waypoints = [];
//   waypointLayers
//     .filter(l => activeLayers.includes(l.id) && waypointData[l.id])
//     .forEach(layer => {
//       const raw = waypointData[layer.id];
//       const features = raw?.features || (Array.isArray(raw) ? raw : []);
//       features.forEach((feature, idx) => {
//         let lat, lng;
//         if (feature?.geometry?.coordinates) {
//           lng = feature.geometry.coordinates[0];
//           lat = feature.geometry.coordinates[1];
//         } else if (feature?.lat != null) {
//           lat = feature.lat; lng = feature.lng;
//         } else if (feature?.latitude != null) {
//           lat = feature.latitude; lng = feature.longitude;
//         }
//         if (isNaN(lat) || isNaN(lng) || lat == null || lng == null) return;
//         const props = feature.properties || feature || {};
//         waypoints.push({
//           id: `${layer.id}_${idx}`,
//           lat, lng,
//           name:       props.name || props.nama || props.NAMOBJ || 'Tanpa Nama',
//           category:   layer.category || props.kategori || props.category || props.amenity || '',
//           layerId:    layer.id,
//           layerLabel: layer.label,
//           color:      layer.color,
//         });
//       });
//     });
//   return waypoints;
// }

// // ─── TAB BAR COMPONENT ────────────────────────────────────────────────────────

// function TabBar({ activeTab, setActiveTab, scanCount, hasilCount, isDark }) {
//   const tabs = [
//     { id: 'area',   label: 'AREA',   Icon: ({ size }) => (
//       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//         <rect x="3" y="3" width="18" height="18" rx="2"/>
//       </svg>
//     )},
//     { id: 'scan',   label: 'CONFIG', Icon: ({ size }) => (
//       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//         <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
//         <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
//       </svg>
//     )},
//     { id: 'hasil',  label: 'HASIL',  Icon: ({ size }) => (
//       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//         <path d="M12 2L2 7l10 5 10-5-10-5z"/>
//         <path d="M2 17l10 5 10-5"/>
//         <path d="M2 12l10 5 10-5"/>
//       </svg>
//     )},
//   ];

//   return (
//     <div className={`flex-shrink-0 border-b ${isDark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200'}`}>
//       <div className="flex">
//         {tabs.map(tab => {
//           const isActive = activeTab === tab.id;
//           const { Icon } = tab;
//           const dot = tab.id === 'scan' && scanCount > 0
//             ? scanCount
//             : tab.id === 'hasil' && hasilCount > 0
//             ? hasilCount
//             : null;

//           return (
//             <button
//               key={tab.id}
//               onClick={() => setActiveTab(tab.id)}
//               className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 relative transition-all duration-200 ${
//                 isActive
//                   ? isDark ? 'text-cyan-400' : 'text-cyan-600'
//                   : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
//               }`}
//             >
//               <Icon size={18} />
//               <span className="text-[9px] font-black tracking-widest">{tab.label}</span>
//               {/* Active indicator dot */}
//               {isActive && (
//                 <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'}`} />
//               )}
//               {/* Badge */}
//               {dot !== null && (
//                 <span className={`absolute top-2 right-[20%] min-w-[14px] h-[14px] text-[8px] font-black rounded-full flex items-center justify-center px-1 ${
//                   isActive
//                     ? 'bg-cyan-500 text-white'
//                     : isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
//                 }`}>
//                   {dot > 99 ? '99+' : dot}
//                 </span>
//               )}
//             </button>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// // ─── SCAN PROGRESS ────────────────────────────────────────────────────────────

// function ScanProgress({ progress, currentWaypoint, isScanning, isDark }) {
//   const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
//   return (
//     <div className={`p-3 rounded-xl border-2 ${isDark ? 'bg-slate-800/70 border-cyan-500/30' : 'bg-cyan-50 border-cyan-300/50'}`}>
//       <div className="flex items-center gap-2 mb-2">
//         <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-cyan-500 animate-pulse' : 'bg-green-500'}`} />
//         <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
//           {isScanning ? `SCANNING ${pct}%` : 'SELESAI'}
//         </span>
//         <span className={`text-[9px] ml-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
//           {progress.done}/{progress.total} · {progress.objects} obj
//         </span>
//       </div>
//       <div className={`h-1.5 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-slate-700' : 'bg-cyan-200'}`}>
//         <div
//           className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
//           style={{ width: `${pct}%` }}
//         />
//       </div>
//       {isScanning && currentWaypoint && (
//         <p className={`text-[9px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
//           <ScanLine size={9} className="inline mr-1" />
//           {currentWaypoint.name} · ({currentWaypoint.lat.toFixed(4)}, {currentWaypoint.lng.toFixed(4)})
//         </p>
//       )}
//     </div>
//   );
// }

// // ─── VALIDATION SUMMARY ───────────────────────────────────────────────────────

// function ValidationSummary({ allPolygons, activeWaypoints, isDark }) {
//   const stats = useMemo(() => calcValidationStats(allPolygons), [allPolygons]);
//   return (
//     <div className={`p-3 rounded-xl border-2 ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-cyan-500/20' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-300/50'}`}>
//       <div className="flex items-center gap-2 mb-3">
//         <TrendingUp size={14} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
//         <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
//           Ringkasan Validasi
//         </h3>
//       </div>
//       <div className="grid grid-cols-2 gap-1.5 mb-3">
//         {[
//           { label: 'Total Polygon',  value: stats.total,    color: isDark ? 'text-slate-200' : 'text-slate-800' },
//           { label: 'Valid ✓',        value: stats.valid,    color: 'text-green-500' },
//           { label: 'Tidak Sesuai',   value: stats.mismatch, color: 'text-red-500' },
//           { label: 'Conf Rendah',    value: stats.lowConf,  color: 'text-amber-500' },
//           { label: 'Luar Waypoint',  value: stats.noWp,     color: 'text-violet-500' },
//           { label: 'Waypoint Aktif', value: activeWaypoints.length, color: isDark ? 'text-cyan-400' : 'text-cyan-600' },
//         ].map(s => (
//           <div key={s.label} className={`p-2 rounded-lg text-center ${isDark ? 'bg-slate-700/30' : 'bg-white/60'}`}>
//             <div className={`text-sm font-black ${s.color}`}>{s.value}</div>
//             <div className="text-[8px] font-bold uppercase text-slate-500">{s.label}</div>
//           </div>
//         ))}
//       </div>
//       {stats.total > 0 && (
//         <div className={`p-2 rounded-lg mb-3 ${isDark ? 'bg-slate-700/40' : 'bg-white/50'}`}>
//           <p className="text-[8px] font-black uppercase text-slate-400 mb-1.5">Polygon per Kategori</p>
//           <div className="flex flex-wrap gap-1.5">
//             {Object.entries(stats.catCounts).map(([cat, cnt]) => {
//               const meta = CATEGORY_META[cat] || {};
//               return (
//                 <span key={cat} className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
//                   style={{ background: `${meta.color}20`, color: meta.color }}>
//                   <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
//                   {meta.label || cat}: {cnt}
//                 </span>
//               );
//             })}
//           </div>
//         </div>
//       )}
//       <div>
//         <div className="flex justify-between items-center mb-1">
//           <span className="text-[9px] font-bold uppercase text-slate-500">Validasi Rate</span>
//           <span className={`text-sm font-black ${stats.validRate >= 70 ? 'text-green-500' : stats.validRate >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
//             {stats.validRate}%
//           </span>
//         </div>
//         <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
//           <div
//             className={`h-full rounded-full transition-all duration-700 ${
//               stats.validRate >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
//               stats.validRate >= 40 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
//               'bg-gradient-to-r from-red-500 to-red-600'
//             }`}
//             style={{ width: `${stats.validRate}%` }}
//           />
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── NO WAYPOINT CARD ─────────────────────────────────────────────────────────

// function NoWaypointCard({ polygon, isDark, onLocate, onGeocode, geocodeResult }) {
//   const meta     = CATEGORY_META[polygon.kategori] || {};
//   const catColor = meta.color || '#94a3b8';
//   const [loading, setLoading] = useState(false);

//   const cLat = polygon.polygonLatLng?.length
//     ? polygon.polygonLatLng.reduce((s, p) => s + p[0], 0) / polygon.polygonLatLng.length : 0;
//   const cLng = polygon.polygonLatLng?.length
//     ? polygon.polygonLatLng.reduce((s, p) => s + p[1], 0) / polygon.polygonLatLng.length : 0;

//   const handleGeocode = async () => {
//     if (geocodeResult || loading) return;
//     setLoading(true);
//     await onGeocode(cLat, cLng);
//     setLoading(false);
//   };

//   return (
//     <div className={`rounded-xl border-2 overflow-hidden ${isDark ? 'bg-slate-800/60 border-violet-800/40' : 'bg-slate-50 border-violet-200'}`}>
//       <div className="p-3">
//         <div className="flex items-center gap-2 mb-2">
//           <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: catColor }} />
//           <span className={`text-[11px] font-black uppercase flex-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
//             {meta.label || polygon.kategori}
//           </span>
//           <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-500">Luar WP</span>
//           <span className={`text-[9px] font-black ml-1 ${
//             polygon.confidence_score >= 0.7 ? 'text-green-500' :
//             polygon.confidence_score >= 0.5 ? 'text-amber-500' : 'text-red-500'
//           }`}>{Math.round((polygon.confidence_score || 0) * 100)}%</span>
//         </div>
//         <div className="grid grid-cols-2 gap-1.5 mb-2">
//           <div className={`p-1.5 rounded-lg text-center ${isDark ? 'bg-slate-700/40' : 'bg-white/60'}`}>
//             <div className={`text-[10px] font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{fmtArea(polygon.luas_m2)}</div>
//             <div className="text-[8px] text-slate-500 font-bold uppercase">Luas</div>
//           </div>
//           <div className={`p-1.5 rounded-lg text-center ${isDark ? 'bg-slate-700/40' : 'bg-white/60'}`}>
//             <div className={`text-[10px] font-black truncate ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
//               {polygon.waypointSource?.name
//                 ? polygon.waypointSource.name.slice(0, 10) + (polygon.waypointSource.name.length > 10 ? '…' : '')
//                 : '—'}
//             </div>
//             <div className="text-[8px] text-slate-500 font-bold uppercase">Scan dari</div>
//           </div>
//         </div>
//         {geocodeResult ? (
//           <div className={`px-2 py-1.5 rounded-lg mb-2 text-[9px] ${
//             isDark ? 'bg-violet-900/20 border border-violet-800 text-violet-300' : 'bg-violet-50 border border-violet-200 text-violet-700'
//           }`}>
//             <p className="font-black mb-0.5">📍 {geocodeResult.name}</p>
//             {geocodeResult.address?.road && (
//               <p className="opacity-70 truncate">
//                 {geocodeResult.address.road}{geocodeResult.address.suburb ? `, ${geocodeResult.address.suburb}` : ''}
//               </p>
//             )}
//           </div>
//         ) : (
//           <button onClick={handleGeocode} disabled={loading}
//             className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase mb-2 flex items-center justify-center gap-1 transition-all ${
//               loading
//                 ? isDark ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400'
//                 : isDark ? 'bg-violet-900/30 hover:bg-violet-900/50 text-violet-400 border border-violet-800' : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200'
//             }`}>
//             <Search size={10} />
//             {loading ? 'Mencari...' : 'Cari Nama via OSM'}
//           </button>
//         )}
//         <button onClick={() => onLocate(polygon)}
//           className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all ${
//             isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
//           }`}>
//           <Eye size={10} /> Lihat di Peta
//         </button>
//       </div>
//     </div>
//   );
// }

// // ─── POLYGON CARD ─────────────────────────────────────────────────────────────

// function PolygonCard({ polygon, isDark, onLocate, idx }) {
//   const [open, setOpen] = useState(false);
//   const meta       = CATEGORY_META[polygon.kategori] || {};
//   const validation = polygon.validation || {};
//   const catColor   = meta.color || '#94a3b8';

//   const statusBg = {
//     valid:    isDark ? 'bg-green-900/20 border-green-700/40' : 'bg-green-50 border-green-300',
//     mismatch: isDark ? 'bg-red-900/20 border-red-700/40'    : 'bg-red-50 border-red-200',
//     low_conf: isDark ? 'bg-amber-900/20 border-amber-700/40': 'bg-amber-50 border-amber-200',
//   }[validation.status] || (isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200');

//   const tileLabel = polygon.waypointSource?.name
//     ? polygon.waypointSource.name.slice(0, 8) + (polygon.waypointSource.name.length > 8 ? '…' : '')
//     : (polygon.tile_id?.replace('tile_', 'T') || '—');

//   return (
//     <div className={`rounded-xl border-2 overflow-hidden ${statusBg}`}>
//       <div className="p-3">
//         <div className="flex items-start gap-2 mb-2">
//           <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-1" style={{ background: catColor }} />
//           <div className="flex-1 min-w-0">
//             <div className="flex items-center gap-1.5 flex-wrap">
//               <span className={`text-[11px] font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
//                 {meta.label || polygon.kategori}
//               </span>
//               <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
//                 style={{ background: `${validation.color || '#94a3b8'}20`, color: validation.color || '#94a3b8' }}>
//                 {validation.label || '—'}
//               </span>
//             </div>
//             {validation.waypointName && (
//               <p className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
//                 WP: <b>{validation.waypointName}</b>
//                 {validation.waypointCategory ? ` (${validation.waypointCategory})` : ''}
//               </p>
//             )}
//           </div>
//           <span className={`text-[9px] font-black flex-shrink-0 ${
//             polygon.confidence_score >= 0.7 ? 'text-green-500' :
//             polygon.confidence_score >= 0.5 ? 'text-amber-500' : 'text-red-500'
//           }`}>{Math.round((polygon.confidence_score || 0) * 100)}%</span>
//         </div>
//         <div className="grid grid-cols-3 gap-1.5 mb-2">
//           {[
//             { val: tileLabel,        label: 'Sumber', col: isDark ? 'text-cyan-400' : 'text-cyan-600' },
//             { val: fmtArea(polygon.luas_m2), label: 'Luas', col: isDark ? 'text-amber-400' : 'text-amber-600' },
//             { val: polygon.nearestWp ? fmtDist(polygon.nearestWp.distToPolygon) : '—', label: 'Jarak', col: isDark ? 'text-violet-400' : 'text-violet-600' },
//           ].map(s => (
//             <div key={s.label} className={`p-1.5 rounded-lg text-center ${isDark ? 'bg-slate-700/40' : 'bg-white/60'}`}>
//               <div className={`text-[10px] font-black truncate ${s.col}`}>{s.val}</div>
//               <div className="text-[8px] text-slate-500 font-bold uppercase">{s.label}</div>
//             </div>
//           ))}
//         </div>
//         {validation.reason && (
//           <p className={`text-[9px] px-2 py-1.5 rounded-lg mb-2 ${isDark ? 'bg-slate-700/40 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
//             {validation.reason}
//           </p>
//         )}
//         {polygon.nearestWp && (
//           <button onClick={() => setOpen(v => !v)}
//             className={`w-full flex items-center justify-between text-[9px] font-black uppercase mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
//             <span>Waypoint Terdekat</span>
//             {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
//           </button>
//         )}
//         {open && polygon.nearestWp && (
//           <div className={`text-[9px] px-2 py-1.5 rounded-lg mb-2 space-y-0.5 ${isDark ? 'bg-slate-700/40 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
//             <p><b>Nama:</b> {polygon.nearestWp.name}</p>
//             <p><b>Layer:</b> {polygon.nearestWp.layerLabel}</p>
//             <p><b>Kategori:</b> {polygon.nearestWp.category}</p>
//             <p><b>Koordinat:</b> {polygon.nearestWp.lat.toFixed(5)}, {polygon.nearestWp.lng.toFixed(5)}</p>
//             <p><b>Jarak ke Polygon:</b> {fmtDist(polygon.nearestWp.distToPolygon)}</p>
//           </div>
//         )}
//         <button onClick={() => onLocate(polygon)}
//           className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all ${
//             isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
//           }`}>
//           <Eye size={10} /> Lihat di Peta
//         </button>
//       </div>
//     </div>
//   );
// }

// // ─── TAB: AREA ────────────────────────────────────────────────────────────────

// function TabArea({
//   isDark, drawing, center, radius, setRadius,
//   radiusLayers, activeRadius, setActiveRadius,
//   waypointsInRadius, activeWpLayers, waypointData, activeWaypoints,
//   handleStartDrawing, handleCancelDrawing, createRadius,
//   removeRadius, clearAll, copyCoordinates,
//   onGoToScan,
// }) {
//   const radiusOptions = [500, 1000, 2000, 5000, 10000];

//   return (
//     <div className="flex-1 overflow-y-auto p-4 space-y-3">
//       {/* Waypoint layer info */}
//       {activeWpLayers.length === 0 ? (
//         <div className={`rounded-xl border-2 border-dashed p-4 text-center ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-300 bg-slate-50'}`}>
//           <Layers size={20} className={`mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
//           <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
//             Layer waypoint belum aktif
//           </p>
//           <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
//             Buka panel <b>Layers</b> → aktifkan waypoint<br />(Sekolah, RS, Kantor, dll)
//           </p>
//         </div>
//       ) : (
//         <div className={`rounded-xl border-2 p-3 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200'}`}>
//           <div className="flex items-center justify-between mb-2">
//             <p className={`text-[9px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
//               Layer Waypoint Aktif
//             </p>
//             <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
//               {activeWaypoints.length} titik
//             </span>
//           </div>
//           <div className="space-y-1 max-h-24 overflow-y-auto">
//             {activeWpLayers.map(layer => {
//               const raw = waypointData[layer.id];
//               const cnt = raw?.features?.length || (Array.isArray(raw) ? raw.length : 0);
//               const inRad = waypointsInRadius.filter(w => w.layerId === layer.id).length;
//               return (
//                 <div key={layer.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
//                   <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layer.color }} />
//                   <span className={`text-[10px] font-medium flex-1 truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{layer.label}</span>
//                   <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cnt}</span>
//                   {activeRadius && (
//                     <span className={`text-[9px] font-black ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{inRad} dlm radius</span>
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       )}

//       {/* Titik Pusat */}
//       <div className={`rounded-xl border-2 p-3.5 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200'}`}>
//         <p className={`text-[9px] font-black uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
//           1. Tentukan Titik Pusat
//         </p>
//         <div className={`p-3 rounded-lg mb-3 border-2 ${
//           drawing
//             ? isDark ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-300'
//             : center
//               ? isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-300'
//               : isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-300'
//         }`}>
//           <div className="flex items-center gap-2">
//             <Target size={14} className={drawing ? 'text-amber-500' : center ? 'text-green-500' : 'text-slate-400'} />
//             <p className={`text-[11px] font-bold flex-1 ${
//               drawing ? 'text-amber-600 dark:text-amber-400' :
//               center  ? 'text-green-600 dark:text-green-400' :
//               isDark  ? 'text-slate-400' : 'text-slate-500'
//             }`}>
//               {drawing ? '📍 Klik lokasi di peta' : center ? `✓ ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : 'Belum ada titik pusat'}
//             </p>
//             {center && !drawing && (
//               <button onClick={copyCoordinates} className="text-slate-400 hover:text-cyan-500"><Copy size={10} /></button>
//             )}
//           </div>
//         </div>

//         {!drawing ? (
//           <button onClick={handleStartDrawing}
//             className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 shadow-md transition-all mb-3">
//             <MapPin size={13} /> PILIH TITIK DI PETA
//           </button>
//         ) : (
//           <button onClick={handleCancelDrawing}
//             className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 mb-3 ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
//             <X size={13} /> BATALKAN
//           </button>
//         )}

//         {center && !drawing && (
//           <>
//             <p className={`text-[9px] font-black uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
//               2. Ukuran Radius
//             </p>
//             <div className="grid grid-cols-5 gap-1.5 mb-3">
//               {radiusOptions.map(opt => (
//                 <button key={opt} onClick={() => setRadius(opt)}
//                   className={`py-1.5 rounded-lg text-[9px] font-black transition-all ${
//                     radius === opt
//                       ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
//                       : isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
//                   }`}>
//                   {opt >= 1000 ? `${opt / 1000}km` : `${opt}m`}
//                 </button>
//               ))}
//             </div>
//             <div className={`px-3 py-2 rounded-lg mb-3 ${isDark ? 'bg-slate-700/40' : 'bg-slate-100'}`}>
//               <p className={`text-[9px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
//                 ~{waypointsInRadius.length} waypoint dalam radius ini
//               </p>
//             </div>
//             <button onClick={createRadius}
//               className="w-full py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-md transition-all">
//               BUAT RADIUS → LANJUT CONFIG
//             </button>
//           </>
//         )}
//       </div>

//       {/* Radius list */}
//       {radiusLayers.length > 0 && (
//         <div className={`rounded-xl border-2 p-3 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200'}`}>
//           <div className="flex items-center justify-between mb-2">
//             <p className={`text-[9px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
//               Radius Tersimpan
//             </p>
//             <button onClick={clearAll}
//               className={`text-[9px] font-bold flex items-center gap-1 ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}>
//               <Trash2 size={10} /> Hapus Semua
//             </button>
//           </div>
//           <div className="space-y-1.5">
//             {radiusLayers.map(r => (
//               <div key={r.id}
//   className={`rounded-lg border-2 overflow-hidden transition-all ${
//     activeRadius === r.id
//       ? isDark ? 'bg-cyan-900/30 border-cyan-500' : 'bg-cyan-50 border-cyan-500'
//       : isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-100 border-slate-300'
//   }`}>
//   {/* Baris atas: klik untuk set aktif */}
//   <div onClick={() => setActiveRadius(r.id)}
//     className="flex items-center justify-between px-3 py-2 cursor-pointer">
//     <div className="flex items-center gap-2">
//       {activeRadius === r.id && <CheckCircle2 size={11} className="text-cyan-500" />}
//       <span className={`text-xs font-bold ${
//         activeRadius === r.id
//           ? isDark ? 'text-cyan-400' : 'text-cyan-600'
//           : isDark ? 'text-slate-400' : 'text-slate-600'
//       }`}>
//         {r.radius >= 1000 ? `${r.radius / 1000}km` : `${r.radius}m`}
//       </span>
//     </div>
//     <button onClick={e => { e.stopPropagation(); removeRadius(r.id); }}
//       className="text-red-400 hover:text-red-600 p-0.5"><X size={10} /></button>
//   </div>

//   {/* Tombol Scan muncul hanya jika radius ini aktif */}
//   {activeRadius === r.id && (
//     <div className={`px-2 pb-2`}>
//       <button
//         onClick={() => onGoToScan()}
//         className="w-full py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-all">
//         <Play size={10} /> Scan Radius Ini
//       </button>
//     </div>
//   )}
// </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Empty state */}
//       {radiusLayers.length === 0 && (
//         <div className={`py-8 text-center rounded-xl border-2 border-dashed ${isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-300/50 bg-slate-100/30'}`}>
//           <Target size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
//           <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Mulai dengan membuat radius</p>
//           <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
//             Aktifkan waypoint → pilih titik → set radius
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── TAB: SCAN (CONFIG) ───────────────────────────────────────────────────────

// function TabScan({
//   isDark, activeRadius, radiusLayers, activeWpLayers,
//   waypointsInRadius, scanCategories, setScanCategories,
//   isScanning, isPaused, scanProgress, currentScanWp, allPolygons,
//   startScan, handlePauseResume, handleAbort,
//   setActiveTab,
// }) {
//   const activeRadiusLayer = radiusLayers.find(r => r.id === activeRadius);
//   const stats = useMemo(() => calcValidationStats(allPolygons), [allPolygons]);

//   if (!activeRadius) {
//     return (
//       <div className="flex-1 flex items-center justify-center p-6">
//         <div className="text-center">
//           <AlertTriangle size={28} className={`mx-auto mb-3 ${isDark ? 'text-amber-500' : 'text-amber-400'}`} />
//           <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Belum ada radius aktif</p>
//           <p className={`text-[10px] mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Buat radius di tab AREA terlebih dahulu</p>
//           <button onClick={() => setActiveTab('area')}
//             className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
//             Ke Tab AREA
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex-1 overflow-y-auto p-4 space-y-3">
//       {/* Info radius aktif */}
//       <div className={`rounded-xl border-2 p-3 ${isDark ? 'bg-cyan-900/20 border-cyan-700/50' : 'bg-cyan-50 border-cyan-300'}`}>
//         <div className="flex items-center gap-2">
//           <div className={`w-2 h-2 rounded-full bg-cyan-500`} />
//           <p className={`text-[10px] font-black ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
//             Radius aktif: {activeRadiusLayer?.radius >= 1000
//               ? `${activeRadiusLayer.radius / 1000}km`
//               : `${activeRadiusLayer?.radius}m`}
//             {' · '}{waypointsInRadius.length} waypoint
//           </p>
//         </div>
//       </div>

//       {/* Progress saat scanning */}
//       {isScanning && (
//         <>
//           <ScanProgress
//             progress={scanProgress}
//             currentWaypoint={currentScanWp}
//             isScanning={isScanning}
//             isDark={isDark}
//           />
//           {allPolygons.length > 0 && (
//             <div className={`rounded-xl border-2 p-3 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200'}`}>
//               <p className={`text-[9px] font-black uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
//                 Deteksi Live
//               </p>
//               <div className="flex flex-wrap gap-1.5 mb-2">
//                 {Object.entries(
//                   allPolygons.reduce((acc, p) => { acc[p.kategori] = (acc[p.kategori] || 0) + 1; return acc; }, {})
//                 ).map(([cat, cnt]) => {
//                   const meta = CATEGORY_META[cat] || {};
//                   return (
//                     <span key={cat} className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
//                       style={{ background: `${meta.color}25`, color: meta.color }}>
//                       {meta.label || cat}: {cnt}
//                     </span>
//                   );
//                 })}
//               </div>
//               <div className="flex gap-3 flex-wrap">
//                 {[
//                   { label: `${stats.valid} valid`,      color: 'text-green-500' },
//                   { label: `${stats.mismatch} mismatch`,color: 'text-red-500' },
//                   { label: `${stats.noWp} luar WP`,     color: 'text-violet-500' },
//                 ].map(s => (
//                   <span key={s.label} className={`text-[9px] font-bold ${s.color}`}>{s.label}</span>
//                 ))}
//               </div>
//             </div>
//           )}
//           <div className="grid grid-cols-2 gap-2">
//             <button onClick={handlePauseResume}
//               className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
//                 isPaused ? 'bg-cyan-500 text-white' : isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
//               }`}>
//               {isPaused ? <><Play size={12} /> Lanjut</> : <><Pause size={12} /> Jeda</>}
//             </button>
//             <button onClick={handleAbort}
//               className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${isDark ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
//               <Square size={12} /> Stop
//             </button>
//           </div>
//         </>
//       )}

//       {/* Config scan */}
//       {!isScanning && (
//         <>
//           {/* Penjelasan alur */}
//           <div className={`px-3 py-2.5 rounded-xl text-[10px] space-y-1.5 ${isDark ? 'bg-slate-700/40' : 'bg-blue-50'}`}>
//             {[
//               { icon: '📍', text: `Zoom ke tiap waypoint (zoom ${WAYPOINT_SCAN_ZOOM}× ≈ ~150m)` },
//               { icon: '🔍', text: 'AI deteksi objek → polygon per waypoint' },
//               { icon: '🗺️', text: 'Cocokkan centroid polygon dengan waypoint terdekat (≤500m)' },
//               { icon: '✅', text: 'Validasi kategori polygon ↔ tipe waypoint' },
//               { icon: '🟣', text: 'Tanpa waypoint → tab Luar Waypoint + cari OSM' },
//             ].map((step, i) => (
//               <div key={i} className="flex items-start gap-2">
//                 <span>{step.icon}</span>
//                 <span className={isDark ? 'text-slate-300' : 'text-blue-700'}>{step.text}</span>
//               </div>
//             ))}
//           </div>

//           {/* Kategori */}
// <div className={`rounded-xl border-2 p-3.5 transition-all duration-300 ${
//   scanCategories.length === 0
//     ? isDark
//       ? 'bg-slate-800/70 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
//       : 'bg-white border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
//     : isDark
//       ? 'bg-slate-800/70 border-slate-700'
//       : 'bg-white border-slate-200'
// }`}>
//   {/* Label + arrow hint */}
//   <div className="flex items-center justify-between mb-2">
//     <p className={`text-[9px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
//       Kategori yang Dideteksi
//     </p>
//     {scanCategories.length === 0 && (
//       <span className="flex items-center gap-1 animate-bounce text-amber-500">
//         <span className="text-[9px] font-black">Pilih dulu!</span>
//         <span className="text-[11px]">👆</span>
//       </span>
//     )}
//   </div>

//   <div className="grid grid-cols-2 gap-1.5">
//     {Object.entries(CATEGORY_META).map(([id, meta]) => {
//       const Icon    = meta.Icon;
//       const checked = scanCategories.includes(id);
//       return (
//         <button key={id}
//           onClick={() => setScanCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])}
//           className={`p-2 rounded-lg border-2 text-[10px] font-bold flex items-center gap-1.5 transition-all ${
//             checked ? 'text-white shadow-sm' : isDark ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
//           }`}
//           style={checked ? { backgroundColor: meta.color, borderColor: meta.color } : {}}>
//           <Icon size={11} />
//           {meta.label}
//           {checked && <CheckCircle2 size={9} className="ml-auto opacity-80" />}
//         </button>
//       );
//     })}
//   </div>

//   {/* Hint text bawah */}
//   {scanCategories.length === 0 && (
//     <p className={`text-[9px] text-center mt-2 font-semibold text-amber-500 animate-pulse`}>
//       ⚠ Pilih minimal satu kategori untuk mulai scan
//     </p>
//   )}
// </div>

//           {/* Warning jika tidak ada waypoint */}
//           {waypointsInRadius.length === 0 && activeWpLayers.length > 0 && (
//             <div className={`px-3 py-2 rounded-lg flex items-start gap-2 ${isDark ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
//               <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
//               <p className={`text-[10px] ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
//                 Tidak ada waypoint dalam radius. Perbesar radius di tab AREA.
//               </p>
//             </div>
//           )}

//           {waypointsInRadius.length > 0 ? (
//             <div className={`px-3 py-2 rounded-lg flex items-center gap-2 ${isDark ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-emerald-50 border border-emerald-200'}`}>
//               <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
//               <p className={`text-[10px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
//                 {waypointsInRadius.length} waypoint siap di-scan
//               </p>
//             </div>
//           ) : null}

//           {/* Tombol scan */}
//           {activeWpLayers.length > 0 && waypointsInRadius.length > 0 ? (
//             <button onClick={startScan} disabled={scanCategories.length === 0}
//               className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white shadow-lg transition-all">
//               <Play size={15} />
//               SCAN {waypointsInRadius.length} WAYPOINT ({fmtDist(activeRadiusLayer?.radius || 0)})
//             </button>
//           ) : (
//             <div className={`px-3 py-2.5 rounded-xl text-[10px] text-center ${isDark ? 'bg-slate-700/40 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
//               {activeWpLayers.length === 0
//                 ? 'Aktifkan layer waypoint di panel Layers'
//                 : 'Tidak ada waypoint dalam radius — perbesar radius di tab AREA'}
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }

// // ─── TAB: HASIL ───────────────────────────────────────────────────────────────

// function TabHasil({
//   isDark, allPolygons, waypointsInRadius, geocodeCache,
//   reverseGeocode, map, exportCSV, handleReset,
//   setActiveTab,
// }) {
//   const [filterStatus,  setFilterStatus]  = useState('all');
//   const [activeSubTab,  setActiveSubTab]  = useState('with_waypoint');
//   const [showDetail,    setShowDetail]    = useState(true);

//   const stats = useMemo(() => calcValidationStats(allPolygons), [allPolygons]);

//   const withWpPolygons = useMemo(() => allPolygons.filter(p => p.validation?.status !== 'no_waypoint'), [allPolygons]);
//   const noWpPolygons   = useMemo(() => allPolygons.filter(p => p.validation?.status === 'no_waypoint'), [allPolygons]);

//   const filteredPolygons = useMemo(() => {
//     const byTab = activeSubTab === 'no_waypoint' ? noWpPolygons : withWpPolygons;
//     if (filterStatus === 'all') return byTab;
//     return byTab.filter(p => p.validation?.status === filterStatus);
//   }, [allPolygons, filterStatus, activeSubTab, withWpPolygons, noWpPolygons]);

//   if (allPolygons.length === 0) {
//     return (
//       <div className="flex-1 flex items-center justify-center p-6">
//         <div className="text-center">
//           <BarChart2 size={28} className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
//           <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Belum ada hasil scan</p>
//           <p className={`text-[10px] mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Jalankan scan di tab CONFIG terlebih dahulu</p>
//           <button onClick={() => setActiveTab('scan')}
//             className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
//             Ke Tab CONFIG
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex-1 overflow-y-auto p-4 space-y-3">
//       <ValidationSummary allPolygons={allPolygons} activeWaypoints={waypointsInRadius} isDark={isDark} />

//       {/* Export + Reset */}
//       <div className="grid grid-cols-3 gap-2">
//         <button onClick={exportCSV}
//           className={`py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 col-span-2 ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>
//           <Download size={11} /> Export CSV
//         </button>
//         <button onClick={handleReset}
//           className={`py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 ${isDark ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
//           <RotateCcw size={11} /> Reset
//         </button>
//       </div>

//       {/* Sub-tab: Ada Waypoint / Luar Waypoint */}
//       <div className={`flex rounded-xl overflow-hidden border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
//         {[
//           { id: 'with_waypoint', label: 'Ada Waypoint', count: withWpPolygons.length, grad: 'from-cyan-500 to-blue-600' },
//           { id: 'no_waypoint',   label: 'Luar Waypoint', count: noWpPolygons.length,   grad: 'from-violet-500 to-purple-600' },
//         ].map(tab => (
//           <button key={tab.id} onClick={() => { setActiveSubTab(tab.id); setFilterStatus('all'); }}
//             className={`flex-1 py-2.5 text-[10px] font-black uppercase transition-all ${
//               activeSubTab === tab.id
//                 ? `bg-gradient-to-r ${tab.grad} text-white`
//                 : isDark ? 'bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 hover:text-slate-700'
//             }`}>
//             {tab.label}
//             <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] ${
//               activeSubTab === tab.id ? 'bg-white/20' : isDark ? 'bg-slate-700' : 'bg-slate-100'
//             }`}>{tab.count}</span>
//           </button>
//         ))}
//       </div>

//       {/* Filter (hanya tab Ada Waypoint) */}
//       {activeSubTab === 'with_waypoint' && (
//         <div className="flex gap-1.5 flex-wrap">
//           {[
//             { id: 'all',      label: `Semua (${withWpPolygons.length})` },
//             { id: 'valid',    label: `Valid (${stats.valid})` },
//             { id: 'mismatch', label: `Mismatch (${stats.mismatch})` },
//             { id: 'low_conf', label: `Low Conf (${stats.lowConf})` },
//           ].map(f => (
//             <button key={f.id} onClick={() => setFilterStatus(f.id)}
//               className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all ${
//                 filterStatus === f.id
//                   ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
//                   : isDark ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
//               }`}>
//               {f.label}
//             </button>
//           ))}
//         </div>
//       )}

//       {activeSubTab === 'no_waypoint' && noWpPolygons.length > 0 && (
//         <div className={`px-3 py-2 rounded-xl flex items-start gap-2 text-[10px] ${isDark ? 'bg-violet-900/20 border border-violet-800 text-violet-300' : 'bg-violet-50 border border-violet-200 text-violet-700'}`}>
//           <Info size={11} className="flex-shrink-0 mt-0.5" />
//           <span>Klik <b>Cari Nama via OSM</b> untuk mendapatkan informasi lokasi dari OpenStreetMap.</span>
//         </div>
//       )}

//       {/* Detail cards */}
//       <div className={`rounded-xl border-2 p-3 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200'}`}>
//         <button onClick={() => setShowDetail(v => !v)}
//           className={`w-full flex items-center justify-between py-1 mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
//           <span className="text-[10px] font-black uppercase tracking-wider">
//             Detail Polygon ({filteredPolygons.length})
//           </span>
//           <ChevronRight size={12} className={`transition-transform ${showDetail ? 'rotate-90' : ''}`} />
//         </button>

//         {showDetail && (
//           <div className="space-y-2 max-h-[600px] overflow-y-auto">
//             {filteredPolygons.length === 0 ? (
//               <p className={`text-[10px] text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
//                 Tidak ada polygon dengan filter ini
//               </p>
//             ) : filteredPolygons.map((polygon, idx) => {
//               const cLat = polygon.polygonLatLng?.length
//                 ? polygon.polygonLatLng.reduce((s, p) => s + p[0], 0) / polygon.polygonLatLng.length : 0;
//               const cLng = polygon.polygonLatLng?.length
//                 ? polygon.polygonLatLng.reduce((s, p) => s + p[1], 0) / polygon.polygonLatLng.length : 0;
//               const gcKey = `${cLat.toFixed(5)}_${cLng.toFixed(5)}`;
//               const locateFn = () => {
//                 if (polygon.polygonLatLng?.length) {
//                   map.flyTo([cLat, cLng], 18, { animate: true, duration: 0.8 });
//                 }
//               };
//               return activeSubTab === 'no_waypoint' ? (
//                 <NoWaypointCard key={`nwp_${idx}`} polygon={polygon} isDark={isDark}
//                   geocodeResult={geocodeCache[gcKey]}
//                   onGeocode={(lat, lng) => reverseGeocode(lat, lng)}
//                   onLocate={locateFn} />
//               ) : (
//                 <PolygonCard key={`${polygon.tile_id}_${idx}`} polygon={polygon} idx={idx}
//                   isDark={isDark} onLocate={locateFn} />
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ─── MAIN PANEL ───────────────────────────────────────────────────────────────

// export default function RadiusValidationPanel({
//   onRadiusCreated, onRadiusCleared,
//   activeRadius, setActiveRadius,
//   waypointData = {}, waypointLayers = [], activeLayers = [],
//   isDark = false, mapRef = null,
// }) {
//   const map = useMap();

//   // Active panel tab
//   const [activeTab, setActiveTab] = useState('area');

//   // Radius state
//   const [center,       setCenter]       = useState(null);
//   const [radius,       setRadius]       = useState(1000);
//   const [drawing,      setDrawing]      = useState(false);
//   const [radiusLayers, setRadiusLayers] = useState([]);
//   const clickHandlerRef = useRef(null);

//   // Scan state
//   const [isScanning,   setIsScanning]   = useState(false);
//   const [currentWpIdx, setCurrentWpIdx] = useState(-1);
//   const [allPolygons,  setAllPolygons]  = useState([]);
//   const [scanProgress, setScanProgress] = useState({ total: 0, done: 0, objects: 0 });
//   const [isPaused,     setIsPaused]     = useState(false);
//   const [geocodeCache, setGeocodeCache] = useState({});
//   const [scanCategories, setScanCategories] = useState([]);

//   const pauseRef = useRef(false);
//   const abortRef = useRef(false);

//   const activeWaypoints = useMemo(
//     () => extractWaypoints(waypointData, waypointLayers, activeLayers),
//     [waypointData, waypointLayers, activeLayers]
//   );

//   const activeWpLayers = useMemo(
//     () => waypointLayers.filter(l => activeLayers.includes(l.id) && l.id.startsWith('waypoint_')),
//     [waypointLayers, activeLayers]
//   );

//   const waypointsInRadius = useMemo(() => {
//     const rl = radiusLayers.find(r => r.id === activeRadius);
//     if (!rl) return [];
//     return activeWaypoints.filter(
//       wp => calcDistance(wp.lat, wp.lng, rl.center[0], rl.center[1]) <= rl.radius
//     );
//   }, [activeWaypoints, radiusLayers, activeRadius]);

//   const stats = useMemo(() => calcValidationStats(allPolygons), [allPolygons]);

//   // ── Reverse Geocode ────────────────────────────────────────────────────────

//   const reverseGeocode = useCallback(async (lat, lng) => {
//     const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
//     if (geocodeCache[key]) return geocodeCache[key];
//     try {
//       const res = await fetch(
//         `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
//         { headers: { 'Accept-Language': 'id', 'User-Agent': 'RadiusValidator/1.0' } }
//       );
//       const data = await res.json();
//       const name =
//         data.address?.building  || data.address?.amenity  || data.address?.shop ||
//         data.address?.office    || data.address?.road     ||
//         data.display_name?.split(',')[0] || 'Tidak diketahui';
//       const result = { name, full: data.display_name, address: data.address || {} };
//       setGeocodeCache(prev => ({ ...prev, [key]: result }));
//       return result;
//     } catch {
//       return { name: 'Gagal geocode', full: '', address: {} };
//     }
//   }, [geocodeCache]);

//   // ── Radius drawing ─────────────────────────────────────────────────────────

//   const handleStartDrawing = useCallback(() => {
//     if (drawing) { handleCancelDrawing(); return; }
//     if (isScanning) { toast.error('Hentikan scan terlebih dahulu'); return; }
//     setDrawing(true);
//     map.dragging.disable();
//     map.doubleClickZoom.disable();
//     map.getContainer().style.cursor = 'crosshair';
//     setCenter(null);
//     const handler = (e) => {
//       setCenter(e.latlng);
//       map.dragging.enable();
//       map.doubleClickZoom.enable();
//       map.getContainer().style.cursor = '';
//       map.off('click', handler);
//       setDrawing(false);
//       map.flyTo(e.latlng, Math.max(map.getZoom(), 14), { animate: true, duration: 1.2 });
//     };
//     clickHandlerRef.current = handler;
//     map.on('click', handler);
//   }, [drawing, isScanning, map]);

//   const handleCancelDrawing = useCallback(() => {
//     if (clickHandlerRef.current) {
//       map.off('click', clickHandlerRef.current);
//       clickHandlerRef.current = null;
//     }
//     map.dragging.enable();
//     map.doubleClickZoom.enable();
//     map.getContainer().style.cursor = '';
//     setDrawing(false);
//   }, [map]);

//   const createRadius = useCallback(() => {
//     if (!center) { toast.error('Pilih titik pusat terlebih dahulu!'); return; }
//     const newR = { id: Date.now(), center: [center.lat, center.lng], radius, color: '#06b6d4' };
//     setRadiusLayers(prev => [...prev, newR]);
//     setActiveRadius(newR.id);
//     setAllPolygons([]);
//     if (onRadiusCreated) onRadiusCreated(newR);
//     toast.success(`✓ Radius ${radius >= 1000 ? `${radius / 1000}km` : `${radius}m`} dibuat!`);
//     setActiveTab('scan');
//   }, [center, radius, onRadiusCreated, setActiveRadius, setActiveTab]);

//   const removeRadius = useCallback((id) => {
//     setRadiusLayers(prev => prev.filter(r => r.id !== id));
//     if (activeRadius === id) {
//       setActiveRadius(null);
//       setAllPolygons([]);
//     }
//     if (onRadiusCleared) onRadiusCleared(id);
//   }, [activeRadius, onRadiusCleared, setActiveRadius]);

//   const clearAll = useCallback(() => {
//     setRadiusLayers([]);
//     setActiveRadius(null);
//     setAllPolygons([]);
//     if (onRadiusCleared) onRadiusCleared('all');
//     toast.success('Semua radius dihapus');
//   }, [onRadiusCleared, setActiveRadius]);

//   const copyCoordinates = useCallback(() => {
//     if (!center) return;
//     navigator.clipboard.writeText(`${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`)
//       .then(() => toast.success('✓ Koordinat disalin!'))
//       .catch(() => toast.error('Gagal menyalin'));
//   }, [center]);

//   // ── Fly & Capture ──────────────────────────────────────────────────────────

//   const flyAndCapture = useCallback(async (centerLat, centerLng, radiusMeter, overrideZoom = null) => {
//     const getZoomForRadius = (r) => {
//       if (r <= 500)  return 15;
//       if (r <= 1000) return 14;
//       if (r <= 2000) return 13;
//       if (r <= 5000) return 12;
//       return 11;
//     };
//     const zoom = overrideZoom ?? getZoomForRadius(radiusMeter);
//     await new Promise(resolve => {
//       map.flyTo([centerLat, centerLng], zoom, { animate: true, duration: 0.8 });
//       map.once('moveend', resolve);
//     });
//     await new Promise(r => setTimeout(r, 700));
//     const scanCenter  = map.getCenter();
//     const mapEl       = document.querySelector('.leaflet-container');
//     const rect        = mapEl.getBoundingClientRect();
//     const captureSize = Math.min(CAPTURE_PX, rect.width, rect.height);
//     const html2canvas = (await import('html2canvas')).default;
//     const canvas = await html2canvas(mapEl, {
//       useCORS: true, allowTaint: true,
//       x: (rect.width  - captureSize) / 2,
//       y: (rect.height - captureSize) / 2,
//       width: captureSize, height: captureSize,
//       scale: 1, logging: false,
//       ignoreElements: el =>
//         el.tagName === 'BUTTON' || el.tagName === 'ASIDE' ||
//         el.classList.contains('leaflet-control') ||
//         el.classList.contains('fixed') || el.classList.contains('absolute'),
//     });
//     const scanCenterPixel = map.latLngToContainerPoint(scanCenter);
//     const halfSize = captureSize / 2;
//     const pixelsToLatLng = (segmentation) =>
//       segmentation.map(pt => {
//         const latLng = map.containerPointToLatLng([
//           scanCenterPixel.x + (pt[0] - halfSize),
//           scanCenterPixel.y + (pt[1] - halfSize),
//         ]);
//         return [latLng.lat, latLng.lng];
//       });
//     const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
//     return { blob, scanLat: scanCenter.lat, scanLng: scanCenter.lng, captureSize, pixelsToLatLng };
//   }, [map]);

//   // ── Scan ──────────────────────────────────────────────────────────────────

//   const startScan = useCallback(async () => {
//     if (!activeRadius) { toast.error('Pilih atau buat radius terlebih dahulu'); return; }
//     const rl = radiusLayers.find(r => r.id === activeRadius);
//     if (!rl) return;
//     if (scanCategories.length === 0) { toast.error('Pilih minimal satu kategori!'); return; }
//     const wpsInRadius = activeWaypoints.filter(
//       wp => calcDistance(wp.lat, wp.lng, rl.center[0], rl.center[1]) <= rl.radius
//     );
//     if (wpsInRadius.length === 0) { toast.error('Tidak ada waypoint dalam radius!'); return; }

//     setIsScanning(true);
//     setAllPolygons([]);
//     setGeocodeCache({});
//     abortRef.current = false;
//     pauseRef.current = false;
//     setIsPaused(false);
//     setCurrentWpIdx(-1);
//     setScanProgress({ total: wpsInRadius.length, done: 0, objects: 0 });

//     // Auto switch ke tab scan saat mulai
//     setActiveTab('scan');

//     const allDetected = [];
//     for (let i = 0; i < wpsInRadius.length; i++) {
//       if (abortRef.current) break;
//       while (pauseRef.current) {
//         await new Promise(r => setTimeout(r, 300));
//         if (abortRef.current) break;
//       }
//       if (abortRef.current) break;
//       const wp = wpsInRadius[i];
//       setCurrentWpIdx(i);
//       const scanToast = toast.loading(`(${i + 1}/${wpsInRadius.length}) Scanning: ${wp.name}`, { duration: Infinity });
//       try {
//         const { blob, scanLat, scanLng, captureSize, pixelsToLatLng } =
//           await flyAndCapture(wp.lat, wp.lng, rl.radius, WAYPOINT_SCAN_ZOOM);
//         const form = new FormData();
//         form.append('image', blob, 'wp_capture.png');
//         form.append('lat', scanLat);
//         form.append('lng', scanLng);
//         form.append('capture_size', captureSize);
//         form.append('categories', scanCategories.join(','));
//         const res  = await fetch('http://127.0.0.1:8000/api/run-detection/', { method: 'POST', body: form });
//         const data = await res.json();
//         const raw  = data.results || [];
//         const enriched = raw
//           .filter(obj => obj.segmentation?.length >= 3)
//           .map(obj => {
//             const polygonLatLng = pixelsToLatLng(obj.segmentation);
//             if (!polygonLatLng || polygonLatLng.length < 3) return null;
//             const nearestWp  = findNearestWaypoint(polygonLatLng, activeWaypoints, 500);
//             const validation = crossValidatePolygon(obj, nearestWp);
//             return { ...obj, tile_id: `wp_${wp.id}`, waypointSource: wp, scanLat, scanLng, captureSize, polygonLatLng, nearestWp, validation };
//           })
//           .filter(Boolean);
//         allDetected.push(...enriched);
//         setAllPolygons([...allDetected]);
//         setScanProgress({ total: wpsInRadius.length, done: i + 1, objects: allDetected.length });
//         toast.success(`✓ ${wp.name}: ${enriched.length} obj`, { id: scanToast, duration: 2000 });
//       } catch (err) {
//         console.error(`Error scan ${wp.name}:`, err);
//         toast.error(`✗ ${wp.name}: ${err.message}`, { id: scanToast, duration: 2000 });
//         setScanProgress(prev => ({ ...prev, done: i + 1 }));
//       }
//       await new Promise(r => setTimeout(r, 400));
//     }

//     const finalStats = calcValidationStats(allDetected);
//     toast.success(
//       allDetected.length > 0
//         ? `Selesai! ${allDetected.length} polygon · ${finalStats.valid} valid · ${finalStats.mismatch} mismatch`
//         : 'Scan selesai. Tidak ada objek terdeteksi.',
//       { duration: 5000 }
//     );

//     setCurrentWpIdx(-1);
//     setIsScanning(false);
//     if (map) { map.dragging.enable(); map.scrollWheelZoom.enable(); }
//     // Auto-navigate ke hasil
//     if (allDetected.length > 0) setActiveTab('hasil');
//   }, [activeRadius, radiusLayers, activeWaypoints, scanCategories, flyAndCapture, map]);

//   const handlePauseResume = useCallback(() => {
//     const n = !pauseRef.current;
//     pauseRef.current = n;
//     setIsPaused(n);
//     toast(n ? '⏸ Dijeda' : '▶ Dilanjutkan', { duration: 1200 });
//   }, []);

//   const handleAbort = useCallback(() => {
//     abortRef.current = true;
//     setIsScanning(false);
//     setIsPaused(false);
//     toast.error('Scan dihentikan');
//   }, []);

//   const handleReset = useCallback(() => {
//     abortRef.current = true;
//     setIsScanning(false);
//     setIsPaused(false);
//     setAllPolygons([]);
//     setScanProgress({ total: 0, done: 0, objects: 0 });
//     setCurrentWpIdx(-1);
//     setGeocodeCache({});
//     if (map) { map.dragging.enable(); map.scrollWheelZoom.enable(); }
//   }, [map]);

//   const exportCSV = useCallback(() => {
//     if (!allPolygons.length) { toast.error('Tidak ada hasil'); return; }
//     const rows = allPolygons.map(p => {
//       const cLat = p.polygonLatLng?.length
//         ? p.polygonLatLng.reduce((s, x) => s + x[0], 0) / p.polygonLatLng.length : 0;
//       const cLng = p.polygonLatLng?.length
//         ? p.polygonLatLng.reduce((s, x) => s + x[1], 0) / p.polygonLatLng.length : 0;
//       const gcKey = `${cLat.toFixed(5)}_${cLng.toFixed(5)}`;
//       const gc = geocodeCache[gcKey];
//       return [
//         p.kategori,
//         Math.round((p.confidence_score || 0) * 100),
//         fmtArea(p.luas_m2),
//         p.validation?.status || '',
//         p.validation?.label  || '',
//         p.nearestWp?.name    || '',
//         p.nearestWp?.category|| '',
//         p.nearestWp ? Math.round(p.nearestWp.distToPolygon) : '',
//         p.waypointSource?.name || '',
//         gc?.name  || '',
//         gc?.address?.road || '',
//         new Date().toLocaleString('id-ID'),
//       ];
//     });
//     const header = ['Kategori','Conf%','Luas','Status','Label','WaypointTerdekat','KatWaypoint','JarakWp(m)','ScanDariWP','NamaOSM','JalanOSM','Waktu'];
//     const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
//     const a = document.createElement('a');
//     a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
//     a.download = `radius-scan-${new Date().toISOString().slice(0, 10)}.csv`;
//     a.click();
//     toast.success('✓ CSV exported');
//   }, [allPolygons, geocodeCache]);

//   const getPolyColor = (poly) => poly.validation?.color || CATEGORY_META[poly.kategori]?.color || '#ef4444';

//   const activeRadiusLayer = radiusLayers.find(r => r.id === activeRadius);

//   const currentScanWp = useMemo(() => {
//     if (!isScanning || currentWpIdx < 0) return null;
//     const rl = radiusLayers.find(r => r.id === activeRadius);
//     if (!rl) return null;
//     const wps = activeWaypoints.filter(
//       wp => calcDistance(wp.lat, wp.lng, rl.center[0], rl.center[1]) <= rl.radius
//     );
//     return wps[currentWpIdx] || null;
//   }, [isScanning, currentWpIdx, activeWaypoints, radiusLayers, activeRadius]);

//   // ── Render ────────────────────────────────────────────────────────────────

//   return (
//     <>
//       {/* ── MAP ELEMENTS ── */}

//       {radiusLayers.map(rl => (
//         <Circle key={rl.id} center={rl.center} radius={rl.radius}
//           pathOptions={{
//             color:       activeRadius === rl.id ? '#06b6d4' : '#3b82f6',
//             fillColor:   activeRadius === rl.id ? '#06b6d4' : '#3b82f6',
//             fillOpacity: activeRadius === rl.id ? 0.08 : 0.03,
//             weight:      activeRadius === rl.id ? 2.5 : 1.5,
//             dashArray:   activeRadius === rl.id ? undefined : '6,5',
//           }}>
//           <Popup>
//             <div className="p-3 min-w-[180px]">
//               <p className="font-bold text-cyan-600 mb-1">
//                 RADIUS {rl.radius >= 1000 ? `${rl.radius / 1000}km` : `${rl.radius}m`}
//               </p>
//               <button onClick={() => removeRadius(rl.id)}
//                 className="mt-1 w-full bg-red-100 text-red-700 text-xs py-1 rounded font-bold">
//                 Hapus
//               </button>
//             </div>
//           </Popup>
//         </Circle>
//       ))}

//       {center && (
//         <Marker position={center} icon={createCenterIcon()}>
//           <Popup>
//             <div className="p-2 min-w-[160px]">
//               <p className="font-bold text-cyan-600 text-xs mb-1">TITIK PUSAT</p>
//               <p className="text-[10px] text-slate-500">{center.lat.toFixed(6)}, {center.lng.toFixed(6)}</p>
//             </div>
//           </Popup>
//         </Marker>
//       )}

//       {waypointsInRadius.map(wp => (
//         <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={createWaypointIcon(wp.color)}>
//           <Popup>
//             <div className="p-2 min-w-[170px] text-xs">
//               <div className="flex items-center gap-1.5 mb-1">
//                 <span className="w-2.5 h-2.5 rounded-full" style={{ background: wp.color }} />
//                 <span className="font-bold text-slate-700">{wp.name}</span>
//               </div>
//               <p className="text-slate-500">{wp.layerLabel}</p>
//               <p className="text-slate-400 text-[10px]">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</p>
//             </div>
//           </Popup>
//         </Marker>
//       ))}

//       {allPolygons.map((poly, idx) => {
//         if (!poly.polygonLatLng || poly.polygonLatLng.length < 3) return null;
//         const color  = getPolyColor(poly);
//         const meta   = CATEGORY_META[poly.kategori] || {};
//         const isDashed = poly.validation?.status === 'mismatch' || poly.validation?.status === 'no_waypoint';
//         return (
//           <Polygon key={`poly-${idx}`} positions={poly.polygonLatLng}
//             pathOptions={{
//               color, fillColor: color,
//               fillOpacity: poly.validation?.status === 'valid' ? 0.55 : 0.65,
//               weight:      poly.validation?.status === 'valid' ? 2 : 1.5,
//               dashArray:   isDashed ? '5,4' : undefined,
//             }}>
//             <Popup>
//               <div className="p-2 min-w-[200px] text-xs">
//                 <div className="flex items-center gap-1.5 mb-1.5">
//                   <span className="w-2.5 h-2.5 rounded-sm" style={{ background: meta.color || color }} />
//                   <span className="font-bold uppercase">{meta.label || poly.kategori}</span>
//                   <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full"
//                     style={{ background: `${color}20`, color }}>
//                     {poly.validation?.label || '—'}
//                   </span>
//                 </div>
//                 {poly.nearestWp && <p className="text-slate-500 mb-1">WP: <b>{poly.nearestWp.name}</b></p>}
//                 {poly.validation?.reason && <p className="text-slate-400 text-[9px] italic mb-1">{poly.validation.reason}</p>}
//                 {poly.luas_m2 && <p className="text-slate-500">Luas: <b className="text-sky-600">{fmtArea(poly.luas_m2)}</b></p>}
//                 <p className="text-slate-400">Conf: {Math.round((poly.confidence_score || 0) * 100)}%</p>
//               </div>
//             </Popup>
//           </Polygon>
//         );
//       })}

//       {/* ── PANEL UI ── */}
//       <div className={`h-full flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-slate-100'}`}
//         onWheel={e => e.stopPropagation()}>

//         {/* HEADER */}
//         <div className={`p-3 border-b flex-shrink-0 flex items-center justify-between ${isDark ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white/50 border-slate-200/50'}`}>
//           <div className="flex items-center gap-2.5 flex-1">
//             <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-500/10'}`}>
//               <Navigation size={14} className="text-cyan-500" />
//             </div>
//             <div>
//               <h3 className={`font-black text-xs uppercase tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
//                 Radius Validator
//               </h3>
//               <p className={`text-[8px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
//                 {radiusLayers.length} radius · {waypointsInRadius.length} wp · {allPolygons.length} polygon
//               </p>
//             </div>
//           </div>
//           {/* Scanning badge */}
//           {isScanning && (
//             <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30">
//               <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
//               <span className="text-[9px] font-black text-cyan-500 uppercase">Scanning</span>
//             </div>
//           )}
//         </div>

//         {/* TAB BAR */}
//         <TabBar
//           activeTab={activeTab}
//           setActiveTab={setActiveTab}
//           scanCount={isScanning ? scanProgress.done : 0}
//           hasilCount={allPolygons.length}
//           isDark={isDark}
//         />

//         {/* TAB CONTENT */}
//         {activeTab === 'area' && (
//           <TabArea
//             isDark={isDark}
//             drawing={drawing}
//             center={center}
//             radius={radius}
//             setRadius={setRadius}
//             radiusLayers={radiusLayers}
//             activeRadius={activeRadius}
//             setActiveRadius={setActiveRadius}
//             waypointsInRadius={waypointsInRadius}
//             activeWpLayers={activeWpLayers}
//             waypointData={waypointData}
//             activeWaypoints={activeWaypoints}
//             handleStartDrawing={handleStartDrawing}
//             handleCancelDrawing={handleCancelDrawing}
//             createRadius={createRadius}
//             removeRadius={removeRadius}
//             clearAll={clearAll}
//             copyCoordinates={copyCoordinates}
//             onGoToScan={() => setActiveTab('scan')}
//           />
//         )}

//         {activeTab === 'scan' && (
//           <TabScan
//             isDark={isDark}
//             activeRadius={activeRadius}
//             radiusLayers={radiusLayers}
//             activeWpLayers={activeWpLayers}
//             waypointsInRadius={waypointsInRadius}
//             scanCategories={scanCategories}
//             setScanCategories={setScanCategories}
//             isScanning={isScanning}
//             isPaused={isPaused}
//             scanProgress={scanProgress}
//             currentScanWp={currentScanWp}
//             allPolygons={allPolygons}
//             startScan={startScan}
//             handlePauseResume={handlePauseResume}
//             handleAbort={handleAbort}
//             setActiveTab={setActiveTab}
//           />
//         )}

//         {activeTab === 'hasil' && (
//           <TabHasil
//             isDark={isDark}
//             allPolygons={allPolygons}
//             waypointsInRadius={waypointsInRadius}
//             geocodeCache={geocodeCache}
//             reverseGeocode={reverseGeocode}
//             map={map}
//             exportCSV={exportCSV}
//             handleReset={handleReset}
//             setActiveTab={setActiveTab}
//           />
//         )}

//         {/* FOOTER */}
//         <div className={`flex-shrink-0 px-4 py-1.5 border-t text-center ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
//           <p className={`text-[8px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
//             {allPolygons.length > 0
//               ? `${stats.valid} valid · ${stats.mismatch} mismatch · ${stats.noWp} luar WP`
//               : `Scan per waypoint · zoom ${WAYPOINT_SCAN_ZOOM}× per titik`}
//           </p>
//         </div>
//       </div>
//     </>
//   );
// }