// "use client";
// import { useState } from 'react';
// import html2canvas from 'html2canvas';
// import { Scan, Save, Trash2, Maximize2, ZoomIn, Home, Waves, Trees, Route } from 'lucide-react';
// import axios from 'axios';
// import { toast } from 'react-hot-toast';

// // ─── Tidak ada useMap / useMapEvents di sini ──────────────────────────────────
// // Semua operasi map dilakukan via mapRef.current yang diterima dari MainMap

// const CATEGORIES = [
//   { id: 'bangunan',  label: 'Bangunan',  color: '#f59e0b', Icon: Home  },
//   { id: 'perairan',  label: 'Perairan',  color: '#2563eb', Icon: Waves },
//   { id: 'pepohonan', label: 'Pepohonan', color: '#16a34a', Icon: Trees },
//   { id: 'jalan',     label: 'Jalan',     color: '#64748b', Icon: Route },
// ];

// const PRESET_SIZES = [
//   { label: 'Kecil',   value: 480 },
//   { label: 'Standar', value: 640 },
//   { label: 'Besar',   value: 800 },
// ];

// export default function GeoDetectionPanel({
//   mapRef,
//   zoomLevel,           // dikirim dari MapStuff via state di MainMap
//   onNewData,
//   onDetectionComplete,
//   onClearPreview,
//   previewData,
//   setPreviewData,
//   showPreviewBox,      // dikontrol dari MainMap → diteruskan ke DetectionPreviewBox di MapStuff
//   setShowPreviewBox,
//   detectionSize,
//   setDetectionSize,
// }) {
//   const [selectedCats, setSelectedCats] = useState([]);
//   const [tempResults,  setTempResults]  = useState(null);
//   const [loading,      setLoading]      = useState(false);

//   // ── Helpers ──────────────────────────────────────────────────────────────────
//   const handleSizeChange = (value) => {
//     setDetectionSize(Math.min(1280, Math.max(360, parseInt(value) || 640)));
//   };

//   const handleToggleCat = (id) => {
//     setSelectedCats(prev =>
//       prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
//     );
//   };

//   // ── Detect ───────────────────────────────────────────────────────────────────
//   const handleDetect = async () => {
//     const map = mapRef?.current;
//     if (!map) return;

//     if (zoomLevel < 18) {
//       toast.error('Harap zoom lebih dekat (Minimal Level 18)!');
//       return;
//     }
//     if (selectedCats.length === 0) {
//       toast.error('Silakan pilih minimal satu kategori!');
//       return;
//     }

//     setLoading(true);
//     if (onClearPreview) onClearPreview();
//     setShowPreviewBox(false);

//     const detectToast = toast.loading('Memproses deteksi...');

//     try {
//       const center  = map.getCenter();
//       const scanLat = center.lat;
//       const scanLng = center.lng;

//       const mapElement = document.querySelector('.leaflet-container');
//       const rect       = mapElement.getBoundingClientRect();

//       const captureSize = Math.min(detectionSize, rect.width, rect.height);
//       const startX      = (rect.width  - captureSize) / 2;
//       const startY      = (rect.height - captureSize) / 2;

//       const canvas = await html2canvas(mapElement, {
//         useCORS:     true,
//         allowTaint:  true,
//         x:           startX,
//         y:           startY,
//         width:       captureSize,
//         height:      captureSize,
//         scale:       1,
//         logging:     false,
//         ignoreElements: (el) => (
//           el.tagName === 'BUTTON' ||
//           el.tagName === 'ASIDE'  ||
//           el.classList.contains('leaflet-control') ||
//           el.classList.contains('absolute') ||
//           el.classList.contains('fixed') ||
//           el.classList.contains('lucide')
//         ),
//       });

//       const blob     = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
//       const formData = new FormData();
//       formData.append('image',       blob, 'map_capture.png');
//       formData.append('lat',         scanLat);
//       formData.append('lng',         scanLng);
//       formData.append('capture_size', captureSize);
//       formData.append('categories',  selectedCats.join(','));

//       const res  = await fetch('http://127.0.0.1:8000/api/run-detection/', { method: 'POST', body: formData });
//       const data = await res.json();

//       if (data.results && data.results.length > 0) {
//         const resultsWithCoords = data.results.map(obj => ({
//           ...obj,
//           lat:          scanLat,
//           lng:          scanLng,
//           capture_size: captureSize,
//         }));
//         setTempResults(resultsWithCoords);
//         if (onDetectionComplete) onDetectionComplete(resultsWithCoords);
//         toast.success(`Berhasil mendeteksi ${data.results.length} objek!`, { id: detectToast, duration: 3000 });
//       } else {
//         toast.error('Tidak ada objek ditemukan.', { id: detectToast });
//       }
//     } catch (err) {
//       console.error('Error:', err);
//       toast.error(`Terjadi kesalahan: ${err.message}`, { id: detectToast });
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Save ─────────────────────────────────────────────────────────────────────
//   const handleSave = async () => {
//     const map = mapRef?.current;
//     if (!map || !previewData?.length) {
//       toast.error('Tidak ada data untuk disimpan');
//       return;
//     }

//     const saveToast = toast.loading('Menyimpan data...');

//     try {
//       const dataToSave = previewData.map(obj => {
//         const scanCenterPixel = map.latLngToContainerPoint([obj.lat, obj.lng]);
//         const halfSize        = (obj.capture_size || 640) / 2;

//         const wktPoints = obj.segmentation.map(pt => {
//           const latLng = map.containerPointToLatLng([
//             scanCenterPixel.x + (pt[0] - halfSize),
//             scanCenterPixel.y + (pt[1] - halfSize),
//           ]);
//           return `${latLng.lng} ${latLng.lat}`;
//         });
//         wktPoints.push(wktPoints[0]);

//         return {
//           nama:             obj.kategori,
//           kategori:         obj.kategori,
//           confidence_score: obj.confidence_score,
//           polygon_coords:   wktPoints.join(', '),
//           metadata: {
//             capture_size: obj.capture_size,
//             zoom_level:   zoomLevel,
//             timestamp:    new Date().toISOString(),
//             luas_m2:      obj.luas_m2,
//           },
//         };
//       });

//       const res = await axios.post('http://127.0.0.1:8000/api/save-detection/', { features: dataToSave });

//       if (res.status === 201) {
//         toast.success('Berhasil menyimpan data!', { id: saveToast, duration: 3000 });
//         setTempResults(null);
//         setPreviewData([]);
//         if (onNewData) onNewData();
//       }
//     } catch (err) {
//       toast.error(`Gagal simpan: ${err.response?.data?.message || err.message}`, { id: saveToast });
//     }
//   };

//   const handleCancel = () => {
//     setTempResults(null);
//     setPreviewData([]);
//     if (onClearPreview) onClearPreview();
//   };

//   // ── Render ───────────────────────────────────────────────────────────────────
//   return (
//     <div
//       className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
//       onWheel={(e) => e.stopPropagation()}
//     >
//       {/* HEADER */}
//       <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
//         <h3 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
//           <Scan size={22} /> GeoAI Detection
//         </h3>
//         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
//           AI-powered object detection dengan provinsi otomatis
//         </p>
//       </div>

//       {/* CONTENT */}
//       <div className="flex-1 overflow-y-auto p-4 space-y-4">

//         {/* Ukuran Deteksi */}
//         <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
//           <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 block uppercase tracking-wide flex items-center gap-2">
//             <Maximize2 size={14} /> Ukuran Area Deteksi
//           </label>

//           <div className="grid grid-cols-3 gap-2 mb-3">
//             {PRESET_SIZES.map(preset => (
//               <button
//                 key={preset.value}
//                 onClick={() => setDetectionSize(preset.value)}
//                 className={`p-3 rounded-xl border-2 transition-all font-bold text-xs ${
//                   detectionSize === preset.value
//                     ? 'bg-gradient-to-r from-cyan-500 to-blue-600 border-cyan-500 text-white shadow-lg'
//                     : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-cyan-300'
//                 }`}
//               >
//                 {preset.label}
//                 <div className="text-[10px] opacity-70 mt-1">{preset.value}px</div>
//               </button>
//             ))}
//           </div>

//           <div className="mb-3">
//             <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">Custom (Manual)</label>
//             <input
//               type="number"
//               min="360"
//               max="1280"
//               value={detectionSize}
//               onChange={(e) => handleSizeChange(e.target.value)}
//               className="w-full px-3 py-2 text-sm font-bold text-center rounded-xl border-2 border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-800 outline-none"
//               placeholder="360-1280"
//             />
//             <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-center">Min: 360px | Max: 1280px</p>
//           </div>

//           <button
//             onClick={() => setShowPreviewBox(v => !v)}
//             className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
//               showPreviewBox
//                 ? 'bg-cyan-600 text-white'
//                 : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
//             }`}
//           >
//             <Maximize2 size={14} />
//             {showPreviewBox ? 'Sembunyikan' : 'Tampilkan'} Preview
//           </button>
//         </div>

//         {/* Kategori */}
//         <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
//           <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 block uppercase tracking-wide flex items-center gap-2">
//             <Scan size={14} /> Objek Deteksi
//           </label>
//           <div className="grid grid-cols-2 gap-2">
//             {CATEGORIES.map(({ id, label, color, Icon }) => (
//               <button
//                 key={id}
//                 onClick={() => handleToggleCat(id)}
//                 className={`p-3 rounded-xl border-2 transition-all font-bold text-xs flex flex-col items-center gap-2 ${
//                   selectedCats.includes(id)
//                     ? 'text-white shadow-lg'
//                     : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'
//                 }`}
//                 style={selectedCats.includes(id) ? { backgroundColor: color, borderColor: color } : {}}
//               >
//                 <Icon size={20} />
//                 {label}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Info & Action */}
//         <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
//           <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700">
//             <ZoomIn size={16} className={zoomLevel >= 18 ? 'text-green-600' : 'text-red-500'} />
//             <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
//               Zoom: <span className={zoomLevel >= 18 ? 'text-green-600' : 'text-red-500'}>{zoomLevel}</span>
//             </span>
//           </div>

//           {!tempResults ? (
//             <button
//               onClick={handleDetect}
//               disabled={loading || zoomLevel < 18}
//               className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
//             >
//               {loading ? (
//                 <>
//                   <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                   Menganalisis...
//                 </>
//               ) : (
//                 <><Scan size={16} /> Jalankan Deteksi</>
//               )}
//             </button>
//           ) : (
//             <div className="space-y-2">
//               <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
//                 <span className="font-bold text-green-700 dark:text-green-400 text-sm block">
//                   ✓ {tempResults.length} Objek Terdeteksi
//                 </span>
//               </div>
//               <div className="grid grid-cols-2 gap-2">
//                 <button
//                   onClick={handleSave}
//                   className="bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-2"
//                 >
//                   <Save size={14} /> Simpan
//                 </button>
//                 <button
//                   onClick={handleCancel}
//                   className="bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-red-600 border border-red-200 dark:border-red-800 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
//                 >
//                   <Trash2 size={14} /> Batal
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }