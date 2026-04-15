"use client";
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet';
import {
  Globe, MapPin, Layers as LayersIcon,
  ChevronDown, ChevronRight, X, AlertTriangle,
  RefreshCw, Wifi, WifiOff,
} from 'lucide-react';

const BMKG_ENDPOINTS = {
  autogempa:      'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json',
  gempaterkini:   'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json',
  gempadirasakan: 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json',
};

const CUACA_KOTA_LIST = [
  { id: 'cuaca_jakarta',    label: 'Jakarta Pusat',  lat: -6.1753,  lng: 106.8271, adm4: '31.71.03.1001', color: '#0ea5e9' },
  { id: 'cuaca_surabaya',   label: 'Surabaya',       lat: -7.2575,  lng: 112.7521, adm4: '35.78.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_bandung',    label: 'Bandung',         lat: -6.9175,  lng: 107.6191, adm4: '32.73.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_medan',      label: 'Medan',           lat: 3.5952,   lng: 98.6722,  adm4: '12.71.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_makassar',   label: 'Makassar',        lat: -5.1477,  lng: 119.4327, adm4: '73.71.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_denpasar',   label: 'Denpasar',        lat: -8.6705,  lng: 115.2126, adm4: '51.71.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_yogyakarta', label: 'Yogyakarta',      lat: -7.7956,  lng: 110.3695, adm4: '34.71.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_semarang',   label: 'Semarang',        lat: -6.9932,  lng: 110.4203, adm4: '33.74.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_palembang',  label: 'Palembang',       lat: -2.9761,  lng: 104.7754, adm4: '16.71.01.1001', color: '#0ea5e9' },
  { id: 'cuaca_pontianak',  label: 'Pontianak',       lat: -0.0263,  lng: 109.3425, adm4: '61.71.01.1001', color: '#0ea5e9' },
];

const BOUNDARY_LAYERS = [
  { id: 'batas_provinsi',  label: 'Batas Provinsi',  color: '#3b82f6', desc: 'Batas administrasi tingkat provinsi' },
  { id: 'batas_kabupaten', label: 'Batas Kabupaten', color: '#f59e0b', desc: 'Batas administrasi tingkat kabupaten/kota' },
];

const WAYPOINT_PENDIDIKAN = [
  { id: 'waypoint_university',   label: 'Universitas / Institut',  category: 'university',   endpoint: '/api/waypoint/pendidikan/university/',   color: '#3b82f6', desc: 'Perguruan tinggi negeri & swasta' },
  { id: 'waypoint_college',      label: 'Politeknik / Akademi',    category: 'college',      endpoint: '/api/waypoint/pendidikan/college/',      color: '#8b5cf6', desc: 'Vokasi & akademi kejuruan' },
  { id: 'waypoint_school',       label: 'Sekolah (SD/SMP/SMA)',    category: 'school',       endpoint: '/api/waypoint/pendidikan/school/',       color: '#06b6d4', desc: 'Pendidikan dasar & menengah' },
  { id: 'waypoint_kindergarten', label: 'TK / PAUD',               category: 'kindergarten', endpoint: '/api/waypoint/pendidikan/kindergarten/', color: '#10b981', desc: 'Pendidikan anak usia dini' },
];

const WAYPOINT_KESEHATAN = [
  { id: 'waypoint_hospital',    label: 'Rumah Sakit',              category: 'hospital',    endpoint: '/api/waypoint/kesehatan/hospital/',    color: '#ef4444', desc: 'RS umum & RS khusus' },
  { id: 'waypoint_clinic',      label: 'Klinik / Puskesmas',       category: 'clinic',      endpoint: '/api/waypoint/kesehatan/clinic/',      color: '#f97316', desc: 'Fasilitas kesehatan primer' },
  { id: 'waypoint_health_post', label: 'Pos Kesehatan / Posyandu', category: 'health_post', endpoint: '/api/waypoint/kesehatan/health-post/', color: '#eab308', desc: 'Layanan kesehatan komunitas' },
  { id: 'waypoint_pharmacy',    label: 'Apotek / Farmasi',         category: 'pharmacy',    endpoint: '/api/waypoint/kesehatan/pharmacy/',    color: '#22c55e', desc: 'Apotek & toko obat' },
];

const WAYPOINT_PEMERINTAHAN = [
  { id: 'waypoint_townhall',          label: 'Kantor Walikota / Bupati / Gubernur', category: 'townhall',          endpoint: '/api/waypoint/pemerintahan/townhall/',          color: '#3b82f6', desc: 'Pemerintah kota, kab & provinsi' },
  { id: 'waypoint_village_office',    label: 'Kantor Desa / Kelurahan / Kecamatan', category: 'village_office',    endpoint: '/api/waypoint/pemerintahan/village-office/',    color: '#0ea5e9', desc: 'Pemerintahan tingkat desa & kecamatan' },
  { id: 'waypoint_government_office', label: 'Kantor Pemerintahan',                 category: 'government_office', endpoint: '/api/waypoint/pemerintahan/government-office/', color: '#38bdf8', desc: 'Dinas & badan pemerintah daerah' },
  { id: 'waypoint_ministry',          label: 'Kementerian / Direktorat',             category: 'ministry',          endpoint: '/api/waypoint/pemerintahan/ministry/',          color: '#6366f1', desc: 'Kementerian & direktorat jenderal' },
  { id: 'waypoint_police',            label: 'Kepolisian',                           category: 'police',            endpoint: '/api/waypoint/pemerintahan/police/',            color: '#1d4ed8', desc: 'Polda, Polres & Polsek' },
  { id: 'waypoint_fire_station',      label: 'Pemadam Kebakaran',                    category: 'fire_station',      endpoint: '/api/waypoint/pemerintahan/fire-station/',      color: '#dc2626', desc: 'Dinas pemadam kebakaran' },
  { id: 'waypoint_courthouse',        label: 'Pengadilan / Kejaksaan',               category: 'courthouse',        endpoint: '/api/waypoint/pemerintahan/courthouse/',        color: '#9333ea', desc: 'Pengadilan negeri & kejaksaan' },
  { id: 'waypoint_immigration',       label: 'Kantor Imigrasi',                      category: 'immigration',       endpoint: '/api/waypoint/pemerintahan/immigration/',       color: '#14b8a6', desc: 'Layanan keimigrasian' },
  { id: 'waypoint_tax_office',        label: 'Kantor Pajak',                         category: 'tax_office',        endpoint: '/api/waypoint/pemerintahan/tax-office/',        color: '#d97706', desc: 'KPP & kantor bea cukai' },
  { id: 'waypoint_legislative',       label: 'Lembaga Legislatif (DPR/DPRD)',         category: 'legislative',       endpoint: '/api/waypoint/pemerintahan/legislative/',       color: '#059669', desc: 'DPR, DPRD & MPR' },
];

const WAYPOINT_MBG = [
  { id: 'waypoint_mbg_community',   label: 'Pusat Komunitas / MBG',   category: 'community_centre', endpoint: '/api/waypoint/mbg/community-centre/', color: '#16a34a', desc: 'Titik distribusi MBG komunitas' },
  { id: 'waypoint_mbg_kitchen',     label: 'Dapur Umum',              category: 'kitchen',          endpoint: '/api/waypoint/mbg/kitchen/',          color: '#f97316', desc: 'Dapur produksi makan bergizi' },
  { id: 'waypoint_mbg_food_centre', label: 'Pusat Makan Bergizi',     category: 'food_centre',      endpoint: '/api/waypoint/mbg/food-centre/',      color: '#ef4444', desc: 'Pusat distribusi MBG' },
  { id: 'waypoint_mbg_nutrition',   label: 'Pusat Gizi / Kebun Gizi', category: 'nutrition_centre', endpoint: '/api/waypoint/mbg/nutrition-centre/', color: '#22c55e', desc: 'Kebun & pusat nutrisi lokal' },
  { id: 'waypoint_mbg_canteen',     label: 'Kantin / Warung MBG',     category: 'canteen',          endpoint: '/api/waypoint/mbg/canteen/',          color: '#ca8a04', desc: 'Kantin & warung mitra MBG' },
];

const WAYPOINT_PERTAHANAN = [
  { id: 'waypoint_mil_base',       label: 'Markas / Pangkalan Militer',  category: 'base',            endpoint: '/api/waypoint/pertahanan/base/',          color: '#16a34a', desc: 'Markas besar & pangkalan TNI' },
  { id: 'waypoint_mil_barracks',   label: 'Batalyon / Asrama Militer',   category: 'barracks',        endpoint: '/api/waypoint/pertahanan/barracks/',      color: '#15803d', desc: 'Batalyon & asrama prajurit' },
  { id: 'waypoint_mil_checkpoint', label: 'Pos Pemeriksaan / Penjagaan', category: 'checkpoint',      endpoint: '/api/waypoint/pertahanan/checkpoint/',    color: '#92400e', desc: 'Pos jaga & pemeriksaan militer' },
  { id: 'waypoint_mil_office',     label: 'Kantor / Staf Militer',       category: 'military_office', endpoint: '/api/waypoint/pertahanan/office/',        color: '#4d7c0f', desc: 'Kantor staf & administrasi TNI' },
  { id: 'waypoint_mil_training',   label: 'Area Latihan Militer',        category: 'training_area',   endpoint: '/api/waypoint/pertahanan/training-area/', color: '#65a30d', desc: 'Pusdiklat & area latihan TNI' },
  { id: 'waypoint_mil_airfield',   label: 'Pangkalan Udara (TNI AU)',    category: 'airfield',        endpoint: '/api/waypoint/pertahanan/airfield/',      color: '#0284c7', desc: 'Lanud & fasilitas TNI AU' },
  { id: 'waypoint_mil_naval',      label: 'Pangkalan Laut (TNI AL)',     category: 'naval_base',      endpoint: '/api/waypoint/pertahanan/naval-base/',    color: '#1e40af', desc: 'Lanal & fasilitas TNI AL' },
];

export const BMKG_LAYER_IDS = {
  GEMPA_TERKINI:   'bmkg_gempa_terkini',
  GEMPA_DIRASAKAN: 'bmkg_gempa_dirasakan',
  CUACA_KOTA:      'bmkg_cuaca_kota',
};

const BMKG_LAYERS_DEF = [
  { id: BMKG_LAYER_IDS.GEMPA_TERKINI,   label: 'Gempa M5+ Terkini',             color: '#ef4444', desc: 'Gempa signifikan magnitudo 5+ dari BMKG' },
  { id: BMKG_LAYER_IDS.GEMPA_DIRASAKAN, label: 'Gempa Dirasakan (15 terakhir)', color: '#f97316', desc: '15 gempa terakhir yang dirasakan masyarakat' },
  { id: BMKG_LAYER_IDS.CUACA_KOTA,      label: 'Prakiraan Cuaca Kota',          color: '#0ea5e9', desc: 'Cuaca terkini 10 kota besar via api.bmkg.go.id' },
];

export const WAYPOINT_LAYERS = [
  ...WAYPOINT_PENDIDIKAN,
  ...WAYPOINT_KESEHATAN,
  ...WAYPOINT_PEMERINTAHAN,
  ...WAYPOINT_MBG,
  ...WAYPOINT_PERTAHANAN,
];

const LEGEND_MAP = {
  batas_provinsi:             { label: 'Batas Provinsi',                      color: '#3b82f6', type: 'dashed' },
  batas_kabupaten:            { label: 'Batas Kabupaten',                     color: '#f59e0b', type: 'dashed' },
  waypoint_university:        { label: 'Universitas / Institut',              color: '#3b82f6', type: 'dot' },
  waypoint_college:           { label: 'Politeknik / Akademi',               color: '#8b5cf6', type: 'dot' },
  waypoint_school:            { label: 'Sekolah',                             color: '#06b6d4', type: 'dot' },
  waypoint_kindergarten:      { label: 'TK / PAUD',                          color: '#10b981', type: 'dot' },
  waypoint_hospital:          { label: 'Rumah Sakit',                         color: '#ef4444', type: 'dot' },
  waypoint_clinic:            { label: 'Klinik / Puskesmas',                 color: '#f97316', type: 'dot' },
  waypoint_health_post:       { label: 'Pos Kesehatan / Posyandu',           color: '#eab308', type: 'dot' },
  waypoint_pharmacy:          { label: 'Apotek / Farmasi',                    color: '#22c55e', type: 'dot' },
  waypoint_townhall:          { label: 'Kantor Walikota / Bupati / Gubernur', color: '#3b82f6', type: 'dot' },
  waypoint_village_office:    { label: 'Kantor Desa / Kelurahan',            color: '#0ea5e9', type: 'dot' },
  waypoint_government_office: { label: 'Kantor Pemerintahan',                color: '#38bdf8', type: 'dot' },
  waypoint_ministry:          { label: 'Kementerian / Direktorat',           color: '#6366f1', type: 'dot' },
  waypoint_police:            { label: 'Kepolisian',                          color: '#1d4ed8', type: 'dot' },
  waypoint_fire_station:      { label: 'Pemadam Kebakaran',                  color: '#dc2626', type: 'dot' },
  waypoint_courthouse:        { label: 'Pengadilan / Kejaksaan',             color: '#9333ea', type: 'dot' },
  waypoint_immigration:       { label: 'Kantor Imigrasi',                    color: '#14b8a6', type: 'dot' },
  waypoint_tax_office:        { label: 'Kantor Pajak',                       color: '#d97706', type: 'dot' },
  waypoint_legislative:       { label: 'Lembaga Legislatif',                 color: '#059669', type: 'dot' },
  waypoint_mbg_community:     { label: 'Pusat Komunitas / MBG',              color: '#16a34a', type: 'dot' },
  waypoint_mbg_kitchen:       { label: 'Dapur Umum',                         color: '#f97316', type: 'dot' },
  waypoint_mbg_food_centre:   { label: 'Pusat Makan Bergizi',                color: '#ef4444', type: 'dot' },
  waypoint_mbg_nutrition:     { label: 'Pusat Gizi / Kebun Gizi',           color: '#22c55e', type: 'dot' },
  waypoint_mbg_canteen:       { label: 'Kantin / Warung MBG',               color: '#ca8a04', type: 'dot' },
  waypoint_mil_base:          { label: 'Markas / Pangkalan Militer',         color: '#16a34a', type: 'dot' },
  waypoint_mil_barracks:      { label: 'Batalyon / Asrama Militer',          color: '#15803d', type: 'dot' },
  waypoint_mil_checkpoint:    { label: 'Pos Pemeriksaan / Penjagaan',        color: '#92400e', type: 'dot' },
  waypoint_mil_office:        { label: 'Kantor / Staf Militer',              color: '#4d7c0f', type: 'dot' },
  waypoint_mil_training:      { label: 'Area Latihan Militer',               color: '#65a30d', type: 'dot' },
  waypoint_mil_airfield:      { label: 'Pangkalan Udara (TNI AU)',            color: '#0284c7', type: 'dot' },
  waypoint_mil_naval:         { label: 'Pangkalan Laut (TNI AL)',            color: '#1e40af', type: 'dot' },
  bmkg_gempa_terkini:         { label: 'Gempa M5+ Terkini',                 color: '#ef4444', type: 'dot' },
  bmkg_gempa_dirasakan:       { label: 'Gempa Dirasakan',                   color: '#f97316', type: 'dot' },
  bmkg_cuaca_kota:            { label: 'Prakiraan Cuaca Kota',              color: '#0ea5e9', type: 'dot' },
};

export function useBmkgData(activeLayers) {
  const [bmkgData, setBmkgData] = useState({
    gempa_terkini:   null,
    gempa_dirasakan: null,
    cuaca_kota:      {},
  });
  const [bmkgStatus, setBmkgStatus] = useState({ loading: false, lastUpdate: null, error: null });
  const intervalRef = useRef(null);

  const fetchBmkg = async (force = false) => {
    const anyActive = Object.values(BMKG_LAYER_IDS).some(id => activeLayers.includes(id));
    if (!anyActive && !force) return;

    setBmkgStatus(s => ({ ...s, loading: true, error: null }));
    try {
      const fetches = [];

      if (activeLayers.includes(BMKG_LAYER_IDS.GEMPA_TERKINI)) {
        fetches.push(
          fetch(BMKG_ENDPOINTS.gempaterkini)
            .then(r => r.json()).then(d => ({ key: 'gempa_terkini', data: d }))
            .catch(() => ({ key: 'gempa_terkini', data: null }))
        );
      }

      if (activeLayers.includes(BMKG_LAYER_IDS.GEMPA_DIRASAKAN)) {
        fetches.push(
          fetch(BMKG_ENDPOINTS.gempadirasakan)
            .then(r => r.json()).then(d => ({ key: 'gempa_dirasakan', data: d }))
            .catch(() => ({ key: 'gempa_dirasakan', data: null }))
        );
      }

      if (activeLayers.includes(BMKG_LAYER_IDS.CUACA_KOTA)) {
        const cuacaFetches = CUACA_KOTA_LIST.map(kota =>
          fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${kota.adm4}`)
            .then(r => r.json())
            .then(d => ({ kotaId: kota.id, data: d }))
            .catch(() => ({ kotaId: kota.id, data: null }))
        );
        fetches.push(
          Promise.all(cuacaFetches).then(results => ({ key: 'cuaca_kota', data: results }))
        );
      }

      const results = await Promise.all(fetches);

      setBmkgData(prev => {
        const next = { ...prev };
        results.forEach(({ key, data }) => {
          if (key === 'cuaca_kota') {
            const cuacaMap = {};
            data.forEach(({ kotaId, data: d }) => { cuacaMap[kotaId] = d; });
            next.cuaca_kota = cuacaMap;
          } else {
            next[key] = data;
          }
        });
        return next;
      });

      setBmkgStatus({ loading: false, lastUpdate: new Date(), error: null });
    } catch (err) {
      setBmkgStatus(s => ({ ...s, loading: false, error: 'Gagal fetch data BMKG' }));
    }
  };

  useEffect(() => { fetchBmkg(); }, [activeLayers.join(',')]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchBmkg(), 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [activeLayers.join(',')]);

  return { bmkgData, bmkgStatus, refetchBmkg: () => fetchBmkg(true) };
}

export function useAutoGempa() {
  const [autoGempa, setAutoGempa] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const prevIdRef = useRef(null);

  const fetchAuto = async () => {
    try {
      const res  = await fetch(BMKG_ENDPOINTS.autogempa);
      const json = await res.json();
      const g    = json?.Infogempa?.gempa;
      if (!g) return;
      const id = `${g.Tanggal}-${g.Jam}-${g.Magnitude}`;
      if (id !== prevIdRef.current) {
        prevIdRef.current = id;
        setDismissed(false);
        setAutoGempa(g);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchAuto();
    const t = setInterval(fetchAuto, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return { autoGempa, dismissed, dismiss: () => setDismissed(true) };
}

function parseGempaList(data) {
  const raw = data?.Infogempa?.gempa;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(g => {
    const [latStr, lngStr] = (g.Coordinates || '').split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { ...g, lat, lng };
  }).filter(Boolean);
}

/**
 * Response api.bmkg.go.id/publik/prakiraan-cuaca?adm4=xxx:
 * {
 *   "data": [
 *     {
 *       "lokasi": { "adm1","adm2","adm3","adm4","provinsi","kotkab","kecamatan","desa","lon","lat","timezone" },
 *       "cuaca": [
 *         [ { "datetime","t","tmax","tmin","hu","humax","humin","ws","wd","wd_deg","weather","weather_desc","weather_desc_en","image","utc_datetime","local_datetime" }, ... ],
 *         ...
 *       ]
 *     }
 *   ]
 * }
 *
 * FIX: data dibungkus dalam response.data[0], bukan langsung response.
 */
function parseCuacaKota(cuacaMap) {
  if (!cuacaMap || typeof cuacaMap !== 'object') return [];
  return CUACA_KOTA_LIST.map(kota => {
    const raw = cuacaMap[kota.id];
    if (!raw) return { ...kota, cuaca: null };

    // Response BMKG: { data: [ { lokasi, cuaca } ] }
    // Coba berbagai kemungkinan struktur response
    let lokasi = {};
    let cuacaSlots = [];

    if (raw?.data?.[0]) {
      // Format baru: { data: [{ lokasi, cuaca }] }
      lokasi      = raw.data[0]?.lokasi || {};
      cuacaSlots  = (raw.data[0]?.cuaca || []).flat();
    } else if (raw?.lokasi) {
      // Format lama: { lokasi, cuaca }
      lokasi      = raw.lokasi || {};
      cuacaSlots  = (raw.cuaca || []).flat();
    } else if (Array.isArray(raw?.cuaca)) {
      cuacaSlots  = raw.cuaca.flat();
    }

    if (!cuacaSlots.length) return { ...kota, cuaca: null };

    // Ambil slot cuaca terdekat dengan waktu sekarang
    const now = new Date();
    const nearest = cuacaSlots.reduce((prev, cur) => {
      if (!prev) return cur;
      const diffPrev = Math.abs(new Date(prev.local_datetime || prev.utc_datetime || prev.datetime) - now);
      const diffCur  = Math.abs(new Date(cur.local_datetime  || cur.utc_datetime  || cur.datetime)  - now);
      return diffCur < diffPrev ? cur : prev;
    }, null);

    return {
      ...kota,
      lat:         parseFloat(lokasi.lat) || kota.lat,
      lng:         parseFloat(lokasi.lon) || kota.lng,
      namaLengkap: [lokasi.desa, lokasi.kecamatan, lokasi.kotkab, lokasi.provinsi].filter(Boolean).join(', '),
      cuaca:       nearest,
    };
  });
}

function gempaRadius(mag) {
  const m = parseFloat(mag) || 0;
  if (m >= 7) return 18;
  if (m >= 6) return 14;
  if (m >= 5) return 10;
  return 7;
}

function gempaColor(mag) {
  const m = parseFloat(mag) || 0;
  if (m >= 7) return '#ef4444';
  if (m >= 6) return '#f97316';
  if (m >= 5) return '#eab308';
  return '#22c55e';
}

function cuacaBgColor(code) {
  const c = parseInt(code) || 0;
  if (c === 0)            return '#fbbf24';
  if (c === 1 || c === 2) return '#60a5fa';
  if (c === 3)            return '#3b82f6';
  if (c === 4)            return '#64748b';
  if (c === 5)            return '#94a3b8';
  if (c >= 60 && c < 65)  return '#38bdf8';
  if (c >= 65 && c < 70)  return '#0ea5e9';
  if (c >= 80)            return '#0284c7';
  return '#0ea5e9';
}

function formatLuas(m2) {
  if (m2 == null) return null;
  return `${(m2 / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} km²`;
}
function formatCoord(val, isLat) {
  if (val == null) return '-';
  const dir = isLat ? (val >= 0 ? 'LU' : 'LS') : (val >= 0 ? 'BT' : 'BB');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
}

const POPUP_BASE = `
  font-family: 'Inter', 'Segoe UI', sans-serif;
  min-width: 220px;
  background: #0f172a;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
`;
const ROW_S = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);';
const LBL_S = 'font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;';
const VAL_S = 'font-size:12px;font-weight:700;color:#e2e8f0;text-align:right;max-width:150px;';

function popupRow(label, value, color = '') {
  if (!value && value !== 0) return '';
  return `<div style="${ROW_S}"><span style="${LBL_S}">${label}</span><span style="${VAL_S}${color ? `color:${color};` : ''}">${value}</span></div>`;
}

function buildProvinsiPopup(props) {
  const name  = props.name || props.NAMOBJ || 'Tanpa Nama';
  const code  = props.code || props.KODE   || '';
  const luas  = formatLuas(props.luas_wilayah_m2);
  const pulau = props.jumlah_pulau != null ? `${Number(props.jumlah_pulau).toLocaleString('id-ID')} pulau` : null;
  const lat   = props.latitude ?? props.LAT;
  const lng   = props.longitude ?? props.LNG;
  const coord = lat != null ? `${formatCoord(lat, true)},&nbsp;${formatCoord(lng, false)}` : null;
  return `<div style="${POPUP_BASE}">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:12px 14px;">
      <div style="font-size:9px;font-weight:800;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.14em;margin-bottom:4px;">Provinsi</div>
      <div style="font-size:16px;font-weight:900;color:#fff;">${name}</div>
    </div>
    <div style="padding:8px 12px 10px;">
      ${popupRow('Kode Wilayah', code)}
      ${popupRow('Luas Wilayah', luas, '#38bdf8')}
      ${popupRow('Jumlah Pulau', pulau, '#a78bfa')}
      ${popupRow('Koordinat', coord)}
    </div>
  </div>`;
}

function buildKabupatenPopup(props) {
  const name = props.name || props.NAMOBJ || props.KAB_KOTA || 'Tanpa Nama';
  const code = props.code || props.KODE || '';
  const prov = props.provinsi || props.PROPINSI || '';
  const tipe = props.type_wilayah || props.TIPE || '';
  return `<div style="${POPUP_BASE}">
    <div style="background:linear-gradient(135deg,#92400e,#f59e0b);padding:12px 14px;">
      <div style="font-size:9px;font-weight:800;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.14em;margin-bottom:4px;">Kabupaten / Kota</div>
      <div style="font-size:16px;font-weight:900;color:#fff;">${name}</div>
    </div>
    <div style="padding:8px 12px 10px;">
      ${popupRow('Kode Wilayah', code)}
      ${popupRow('Tipe', tipe)}
      ${popupRow('Provinsi', prov, '#34d399')}
    </div>
  </div>`;
}

export function useBoundaryData(activeLayers) {
  const [boundaryData, setBoundaryData] = useState({ provinsi: null, kabupaten: null });

  const fetchBoundaryData = async (type) => {
    try {
      const endpoint = type === 'provinsi' ? '/api/batas-provinsi/' : '/api/batas-kabupaten/';
      const res = await axios.get(`http://127.0.0.1:8000${endpoint}`);
      setBoundaryData(prev => ({ ...prev, [type]: res.data }));
    } catch (err) { console.error(`Gagal fetch batas ${type}:`, err); }
  };

  useEffect(() => {
    if (activeLayers.includes('batas_provinsi')  && !boundaryData.provinsi)  fetchBoundaryData('provinsi');
    if (activeLayers.includes('batas_kabupaten') && !boundaryData.kabupaten) fetchBoundaryData('kabupaten');
  }, [activeLayers, boundaryData]);

  const getBoundaryStyle = (type) =>
    type === 'provinsi'
      ? { color: '#3b82f6', weight: 2, fillColor: 'transparent', fillOpacity: 0, dashArray: '8,8', opacity: 0.8 }
      : { color: '#f59e0b', weight: 2, fillColor: 'transparent', fillOpacity: 0, dashArray: '4,4', opacity: 0.7 };

  const onEachBoundary = (feature, layer, type) => {
    const props   = feature.properties || {};
    const content = type === 'provinsi' ? buildProvinsiPopup(props) : buildKabupatenPopup(props);
    layer.bindPopup(content, { maxWidth: 290, className: 'terra-popup' });
    layer.on({
      mouseover: (e) => e.target.setStyle({ weight: 3, dashArray: '0', opacity: 1 }),
      mouseout:  (e) => e.target.setStyle(getBoundaryStyle(type)),
    });
  };

  return { boundaryData, getBoundaryStyle, onEachBoundary };
}

export function useWaypointData(activeLayers) {
  const [waypointData, setWaypointData] = useState(
    Object.fromEntries(WAYPOINT_LAYERS.map(l => [l.id, null]))
  );

  useEffect(() => {
    WAYPOINT_LAYERS.forEach(async (layer) => {
      if (activeLayers.includes(layer.id) && !waypointData[layer.id]) {
        try {
          const res = await axios.get(`http://127.0.0.1:8000${layer.endpoint}`);
          setWaypointData(prev => ({ ...prev, [layer.id]: res.data }));
        } catch (err) { console.error(`Gagal fetch waypoint ${layer.id}:`, err); }
      }
    });
  }, [activeLayers]);

  return { waypointData };
}

export function BoundaryLayer({ activeLayers, boundaryData, getBoundaryStyle, onEachBoundary }) {
  if (!boundaryData) return null;
  return (
    <>
      {activeLayers.includes('batas_provinsi') && boundaryData.provinsi && (
        <GeoJSON key="batas-provinsi" data={boundaryData.provinsi}
          style={getBoundaryStyle('provinsi')}
          onEachFeature={(f, l) => onEachBoundary(f, l, 'provinsi')} />
      )}
      {activeLayers.includes('batas_kabupaten') && boundaryData.kabupaten && (
        <GeoJSON key="batas-kabupaten" data={boundaryData.kabupaten}
          style={getBoundaryStyle('kabupaten')}
          onEachFeature={(f, l) => onEachBoundary(f, l, 'kabupaten')} />
      )}
    </>
  );
}

export function WaypointLayer({ activeLayers, waypointData }) {
  return (
    <>
      {WAYPOINT_LAYERS.map((layer) => {
        if (!activeLayers.includes(layer.id)) return null;
        const fc = waypointData[layer.id];
        const features = fc?.features || (Array.isArray(fc) ? fc : null);
        if (!features?.length) return null;
        return features.map((feature, i) => {
          let lat, lng;
          if (feature?.geometry?.coordinates) {
            lng = feature.geometry.coordinates[0];
            lat = feature.geometry.coordinates[1];
          } else if (feature?.lat != null && feature?.lng != null) {
            lat = feature.lat;
            lng = feature.lng;
          } else if (feature?.latitude != null && feature?.longitude != null) {
            lat = feature.latitude;
            lng = feature.longitude;
          } else {
            return null;
          }
          if (isNaN(lat) || isNaN(lng)) return null;
          const props = feature.properties || feature || {};
          return (
            <CircleMarker
              key={`${layer.id}-${i}`}
              center={[lat, lng]}
              radius={6}
              pathOptions={{ color: layer.color, fillColor: layer.color, fillOpacity: 0.9, weight: 1.5 }}
            >
              <Popup className="terra-popup">
                <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 200, background: '#0f172a', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ background: layer.color, padding: '9px 12px', borderRadius: '10px 10px 0 0' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3 }}>
                      {props.type_label || layer.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{props.name || props.nama || 'Tanpa Nama'}</div>
                  </div>
                  <div style={{ padding: '8px 10px', background: '#0f172a', borderRadius: '0 0 10px 10px', fontSize: 11, color: '#94a3b8' }}>
                    {props.amenity       && <p style={{ margin: '3px 0' }}>{props.amenity}</p>}
                    {props['addr:city']  && <p style={{ margin: '3px 0' }}>{props['addr:city']}</p>}
                    {props.operator      && <p style={{ margin: '3px 0' }}>{props.operator}</p>}
                    {props.opening_hours && <p style={{ margin: '3px 0' }}>{props.opening_hours}</p>}
                    {props.phone         && <p style={{ margin: '3px 0' }}>{props.phone}</p>}
                    {props.website && (
                      <p style={{ margin: '3px 0' }}>
                        <a href={props.website} target="_blank" rel="noopener noreferrer" style={{ color: layer.color }}>{props.website}</a>
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        });
      })}
    </>
  );
}

export function BmkgLayer({ activeLayers, bmkgData }) {
  const gempaList     = parseGempaList(bmkgData.gempa_terkini);
  const dirasakanList = parseGempaList(bmkgData.gempa_dirasakan);
  const cuacaKotaList = parseCuacaKota(bmkgData.cuaca_kota);

  const renderGempa = (list, layerId, colorFn, key) =>
    activeLayers.includes(layerId) && list.map((g, i) => {
      const mag    = parseFloat(g.Magnitude) || 0;
      const color  = colorFn(mag);
      const radius = gempaRadius(mag);
      return (
        <CircleMarker
          key={`${key}-${i}`}
          center={[g.lat, g.lng]}
          radius={radius}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2 }}
        >
          <Popup className="terra-popup">
            <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 230, background: '#0f172a', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ background: `linear-gradient(135deg, ${color}cc, ${color})`, padding: '10px 13px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>BMKG — Gempa Bumi</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>M {g.Magnitude}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{g.Wilayah || '-'}</div>
              </div>
              <div style={{ padding: '8px 12px 10px', fontSize: 11, color: '#94a3b8' }}>
                {g.Tanggal   && <p style={{ margin: '3px 0' }}><b style={{ color: '#e2e8f0' }}>Tanggal:</b> {g.Tanggal} {g.Jam}</p>}
                {g.Kedalaman && <p style={{ margin: '3px 0' }}><b style={{ color: '#e2e8f0' }}>Kedalaman:</b> {g.Kedalaman}</p>}
                {g.Potensi   && <p style={{ margin: '3px 0', color: '#fbbf24' }}><b>Potensi:</b> {g.Potensi}</p>}
                {g.Dirasakan && <p style={{ margin: '3px 0' }}><b style={{ color: '#e2e8f0' }}>Dirasakan:</b> {g.Dirasakan}</p>}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      );
    });

  return (
    <>
      {renderGempa(gempaList,     BMKG_LAYER_IDS.GEMPA_TERKINI,   gempaColor, 'gempa-terkini')}
      {renderGempa(dirasakanList, BMKG_LAYER_IDS.GEMPA_DIRASAKAN, gempaColor, 'gempa-dirasakan')}

      {activeLayers.includes(BMKG_LAYER_IDS.CUACA_KOTA) && cuacaKotaList.map((kota, i) => {
        if (!kota.lat || !kota.lng) return null;
        const c         = kota.cuaca;
        const bgColor   = c ? cuacaBgColor(c.weather) : '#0ea5e9';
        const suhu      = c?.t  != null ? `${c.t}°C`      : '-';
        const kelembab  = c?.hu != null ? `${c.hu}%`      : '-';
        const angin     = c?.ws != null ? `${c.ws} km/j`  : '-';
        const arahAngin = c?.wd_deg != null
          ? `${c.wd_deg}° ${c.wd || ''}`
          : (c?.wd || '-');
        const deskripsi = c?.weather_desc || (c ? 'Data tersedia' : 'Tidak ada data');
        const waktuStr  = c?.local_datetime
          ? new Date(c.local_datetime).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
          : '';

        return (
          <CircleMarker
            key={`cuaca-kota-${i}`}
            center={[kota.lat, kota.lng]}
            radius={10}
            pathOptions={{ color: bgColor, fillColor: bgColor, fillOpacity: 0.75, weight: 2 }}
          >
            <Popup className="terra-popup">
              <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 240, background: '#0f172a', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ background: `linear-gradient(135deg, ${bgColor}cc, ${bgColor})`, padding: '10px 13px' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>
                    ☁ BMKG — Prakiraan Cuaca
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c?.image && (
                      <img src={c.image} alt={deskripsi} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{kota.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{deskripsi}</div>
                    </div>
                  </div>
                  {waktuStr && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 5 }}>
                      Prakiraan: {waktuStr} WIB
                    </div>
                  )}
                </div>
                <div style={{ padding: '8px 12px 10px', fontSize: 11, color: '#94a3b8' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                    <div><span style={{ color: '#64748b', fontSize: 10 }}>SUHU</span><br /><b style={{ color: '#fde68a', fontSize: 15 }}>{suhu}</b></div>
                    <div><span style={{ color: '#64748b', fontSize: 10 }}>KELEMBABAN</span><br /><b style={{ color: '#7dd3fc', fontSize: 15 }}>{kelembab}</b></div>
                    <div style={{ marginTop: 4 }}><span style={{ color: '#64748b', fontSize: 10 }}>KECEPATAN ANGIN</span><br /><b style={{ color: '#a5f3fc' }}>{angin}</b></div>
                    <div style={{ marginTop: 4 }}><span style={{ color: '#64748b', fontSize: 10 }}>ARAH ANGIN</span><br /><b style={{ color: '#a5f3fc' }}>{arahAngin}</b></div>
                  </div>
                  {kota.namaLengkap && (
                    <div style={{ marginTop: 7, fontSize: 9, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 5 }}>
                      {kota.namaLengkap}
                    </div>
                  )}
                  <div style={{ marginTop: 3, fontSize: 9, color: '#334155' }}>
                    Sumber: BMKG · api.bmkg.go.id
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function BmkgAlertBanner({ autoGempa, dismissed, onDismiss, isDark, modeBersih }) {
  if (!autoGempa || dismissed || modeBersih) return null;

  const mag        = parseFloat(autoGempa.Magnitude) || 0;
  const isHighMag  = mag >= 6.0;
  const isTsunami  = (autoGempa.Potensi || '').toLowerCase().includes('tsunami');

  const accentColor = isTsunami ? '#7c3aed' : isHighMag ? '#ef4444' : '#f97316';
  const bgGrad      = isTsunami
    ? 'linear-gradient(135deg, rgba(76,29,149,0.97), rgba(109,40,217,0.97))'
    : isHighMag
      ? 'linear-gradient(135deg, rgba(127,29,29,0.97), rgba(185,28,28,0.97))'
      : 'linear-gradient(135deg, rgba(120,53,15,0.97), rgba(194,65,12,0.97))';

  return (
    <div
      style={{
        position:     'fixed',
        bottom:       '3rem',
        left:         '1rem',
        zIndex:       1200,
        maxWidth:     340,
        borderRadius: 14,
        overflow:     'hidden',
        boxShadow:    `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}40`,
        fontFamily:   "'Inter', 'Segoe UI', sans-serif",
        animation:    'bmkgSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <style>{`
        @keyframes bmkgSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bmkgPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      <div style={{ height: 3, background: accentColor, animation: isTsunami || isHighMag ? 'bmkgPulse 1.2s infinite' : 'none' }} />

      <div style={{ background: bgGrad, padding: '10px 13px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor, animation: 'bmkgPulse 1s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.14em' }}>
                BMKG — {isTsunami ? 'POTENSI TSUNAMI' : 'Gempa Bumi Terbaru'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>M {autoGempa.Magnitude}</span>
              {autoGempa.Kedalaman && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>kedalaman {autoGempa.Kedalaman}</span>
              )}
            </div>
            {autoGempa.Wilayah && (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4, lineHeight: 1.3 }}>
                {autoGempa.Wilayah}
              </div>
            )}
            {autoGempa.Tanggal && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                {autoGempa.Tanggal} — {autoGempa.Jam}
              </div>
            )}
            {autoGempa.Potensi && (
              <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: isTsunami ? '#c4b5fd' : '#fde68a', background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '3px 7px', display: 'inline-block' }}>
                {autoGempa.Potensi}
              </div>
            )}
          </div>
          <button
            onClick={onDismiss}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: 'rgba(255,255,255,0.7)', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '4px 13px', fontSize: 9, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Wifi size={8} />
        Sumber: BMKG · Otomatis diperbarui setiap 1 menit
      </div>
    </div>
  );
}

function LayerGroup({ label, dotColor, children, defaultOpen = true, isDark }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = Array.isArray(children) ? children.length : (children ? 1 : 0);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors duration-150 group ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-transparent transition-transform group-hover:scale-110" style={{ backgroundColor: dotColor }} />
        <span className={`flex-1 text-left text-[10px] font-black uppercase tracking-[0.12em] leading-none transition-colors ${isDark ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-600 group-hover:text-slate-700'}`}>
          {label}
        </span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-300/50 text-slate-600'}`}>
          {count}
        </span>
        <ChevronRight size={11} className={`flex-shrink-0 transition-transform duration-200 ${isDark ? 'text-slate-500' : 'text-slate-400'} ${open ? 'rotate-90' : ''}`} />
      </button>

      <div className={`h-px mx-3 mb-1.5 bg-gradient-to-r from-transparent to-transparent ${isDark ? 'via-slate-700/50' : 'via-slate-300/50'}`} />

      <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: open ? '2000px' : '0px', opacity: open ? 1 : 0 }}>
        <div className="px-1 pb-2 space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
}

function LayerCard({ layer, checked, onToggle, isDark, badge }) {
  return (
    <label
      onClick={onToggle}
      className="flex items-center gap-3 w-full cursor-pointer rounded-xl px-3 py-2.5 border transition-all duration-150 select-none group relative overflow-hidden"
      style={{
        borderColor:     checked ? `${layer.color}50` : (isDark ? 'rgb(51 65 85 / 0.6)' : 'rgb(209 213 219 / 0.6)'),
        backgroundColor: checked ? `${layer.color}0d` : 'transparent',
        boxShadow:       checked ? `0 0 0 1px ${layer.color}20` : 'none',
      }}
    >
      {checked && (
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: `radial-gradient(ellipse at left, ${layer.color}, transparent 70%)` }} />
      )}
      <span
        className="w-4 h-4 rounded-[5px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-150 relative z-10"
        style={checked
          ? { borderColor: layer.color, backgroundColor: layer.color, boxShadow: `0 0 8px ${layer.color}60` }
          : { borderColor: isDark ? 'rgb(71 85 105)' : 'rgb(156 163 175)', backgroundColor: 'transparent' }
        }
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4l1.8 1.8L6.5 2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-1.5">
          <p className={`text-[12px] font-semibold leading-tight truncate transition-colors duration-150 ${checked ? (isDark ? 'text-slate-100' : 'text-slate-900') : (isDark ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-700 group-hover:text-slate-900')}`}>
            {layer.label}
          </p>
          {badge && (
            <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: `${layer.color}25`, color: layer.color, border: `1px solid ${layer.color}40`, flexShrink: 0, letterSpacing: '.04em' }}>
              {badge}
            </span>
          )}
        </div>
        {layer.desc && (
          <p className={`text-[10px] leading-tight mt-0.5 truncate transition-colors ${isDark ? 'text-slate-500 group-hover:text-slate-400' : 'text-slate-500 group-hover:text-slate-600'}`}>
            {layer.desc}
          </p>
        )}
      </div>
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 relative z-10 transition-all duration-300 ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
        style={{ backgroundColor: layer.color, boxShadow: `0 0 6px ${layer.color}` }}
      />
    </label>
  );
}

function LegendBar({ activeLayers, isOpen, onToggle, isDark }) {
  const items = activeLayers.filter(id => LEGEND_MAP[id]);

  return (
    <div className={`border-t flex-shrink-0 ${isDark ? 'border-slate-700/50 bg-slate-900/80' : 'border-slate-200/50 bg-slate-50/80'} backdrop-blur-sm`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors duration-150 ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 rounded-full bg-gradient-to-b from-blue-400 to-violet-500" />
          <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Legenda</span>
          {items.length > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{items.length}</span>
          )}
        </div>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isDark ? 'text-slate-500' : 'text-slate-400'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: isOpen ? '160px' : '0px', opacity: isOpen ? 1 : 0 }}>
        <div className="overflow-y-auto px-4 pb-3 space-y-1.5" style={{ maxHeight: 140 }}>
          {items.length === 0 ? (
            <p className={`text-[10px] italic py-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Belum ada layer yang diaktifkan.</p>
          ) : (
            items.map(id => {
              const leg = LEGEND_MAP[id];
              return (
                <div key={id} className="flex items-center gap-2.5">
                  {leg.type === 'dot' ? (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: leg.color, boxShadow: `0 0 4px ${leg.color}80` }} />
                  ) : (
                    <span className="flex-shrink-0" style={{ display: 'inline-block', width: 18, height: 0, borderTop: `2px dashed ${leg.color}` }} />
                  )}
                  <span className={`text-[11px] leading-tight ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{leg.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function BmkgStatusBar({ bmkgStatus, refetchBmkg, activeLayers, isDark }) {
  const anyBmkgActive = Object.values(BMKG_LAYER_IDS).some(id => activeLayers.includes(id));
  if (!anyBmkgActive) return null;

  return (
    <div className={`px-3 py-2 flex items-center justify-between border-t flex-shrink-0 ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200/50 bg-slate-50/50'}`}>
      <div className="flex items-center gap-2">
        {bmkgStatus.loading ? (
          <RefreshCw size={10} className="text-blue-400 animate-spin" />
        ) : bmkgStatus.error ? (
          <WifiOff size={10} className="text-red-400" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
        <span className={`text-[9px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {bmkgStatus.loading
            ? 'Memuat data BMKG...'
            : bmkgStatus.error
              ? bmkgStatus.error
              : bmkgStatus.lastUpdate
                ? `BMKG · ${bmkgStatus.lastUpdate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                : 'BMKG realtime'
          }
        </span>
      </div>
      <button
        onClick={refetchBmkg}
        className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-500 hover:text-slate-300' : 'hover:bg-black/10 text-slate-400 hover:text-slate-600'}`}
        title="Refresh data BMKG"
      >
        <RefreshCw size={10} />
      </button>
    </div>
  );
}

export default function LayersPanel({ activeLayers, onToggleLayer, isDark, bmkgStatus, refetchBmkg }) {
  const [legendOpen, setLegendOpen] = useState(true);
  const totalActive = activeLayers.filter(id => LEGEND_MAP[id]).length;

  return (
    <div
      className={`flex flex-col h-full ${isDark ? 'bg-slate-900' : 'bg-white'}`}
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={`px-4 pt-4 pb-3 flex-shrink-0 border-b ${isDark ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700/50' : 'bg-gradient-to-b from-slate-100 to-slate-50 border-slate-200/50'}`}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500 rounded-t-2xl" />
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-violet-500/20 border-blue-500/20' : 'bg-gradient-to-br from-blue-500/10 to-violet-500/10 border-blue-500/15'}`}>
              <LayersIcon size={14} strokeWidth={2.5} className="text-blue-400" />
            </div>
            <div>
              <h2 className={`text-[13px] font-black uppercase tracking-wide leading-none ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Layer Services</h2>
              <p className={`text-[10px] font-medium mt-0.5 leading-none ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                {totalActive > 0
                  ? <span className="text-blue-400">{totalActive} layer aktif</span>
                  : 'Pilih layer untuk ditampilkan'}
              </p>
            </div>
          </div>
          {totalActive > 0 && (
            <span className={`text-[10px] font-black px-2 py-1 rounded-lg border flex-shrink-0 ${isDark ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/15'}`}>
              {totalActive}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
        <div className="px-2 py-3 space-y-1">

          <LayerGroup label="Batas Wilayah" dotColor="#3b82f6" defaultOpen={true} isDark={isDark}>
            {BOUNDARY_LAYERS.map(layer => (
              <LayerCard key={layer.id} layer={layer} checked={activeLayers.includes(layer.id)} onToggle={() => onToggleLayer(layer.id)} isDark={isDark} />
            ))}
          </LayerGroup>

          <LayerGroup label="Bencana Alam & Cuaca (BMKG)" dotColor="#ef4444" defaultOpen={true} isDark={isDark}>
            {BMKG_LAYERS_DEF.map(layer => (
              <LayerCard
                key={layer.id}
                layer={layer}
                checked={activeLayers.includes(layer.id)}
                onToggle={() => onToggleLayer(layer.id)}
                isDark={isDark}
                badge="LIVE"
              />
            ))}
          </LayerGroup>

          <LayerGroup label="Sarana Pendidikan" dotColor="#3b82f6" defaultOpen={false} isDark={isDark}>
            {WAYPOINT_PENDIDIKAN.map(layer => (
              <LayerCard key={layer.id} layer={layer} checked={activeLayers.includes(layer.id)} onToggle={() => onToggleLayer(layer.id)} isDark={isDark} />
            ))}
          </LayerGroup>

          <LayerGroup label="Sarana Kesehatan" dotColor="#ef4444" defaultOpen={false} isDark={isDark}>
            {WAYPOINT_KESEHATAN.map(layer => (
              <LayerCard key={layer.id} layer={layer} checked={activeLayers.includes(layer.id)} onToggle={() => onToggleLayer(layer.id)} isDark={isDark} />
            ))}
          </LayerGroup>

          <LayerGroup label="Kantor Pemerintahan" dotColor="#6366f1" defaultOpen={false} isDark={isDark}>
            {WAYPOINT_PEMERINTAHAN.map(layer => (
              <LayerCard key={layer.id} layer={layer} checked={activeLayers.includes(layer.id)} onToggle={() => onToggleLayer(layer.id)} isDark={isDark} />
            ))}
          </LayerGroup>

          <LayerGroup label="Makan Bergizi Gratis" dotColor="#16a34a" defaultOpen={false} isDark={isDark}>
            {WAYPOINT_MBG.map(layer => (
              <LayerCard key={layer.id} layer={layer} checked={activeLayers.includes(layer.id)} onToggle={() => onToggleLayer(layer.id)} isDark={isDark} />
            ))}
          </LayerGroup>

          <LayerGroup label="Pertahanan / Militer" dotColor="#166534" defaultOpen={false} isDark={isDark}>
            {WAYPOINT_PERTAHANAN.map(layer => (
              <LayerCard key={layer.id} layer={layer} checked={activeLayers.includes(layer.id)} onToggle={() => onToggleLayer(layer.id)} isDark={isDark} />
            ))}
          </LayerGroup>

        </div>
      </div>

      <BmkgStatusBar
        bmkgStatus={bmkgStatus || { loading: false, lastUpdate: null, error: null }}
        refetchBmkg={refetchBmkg || (() => {})}
        activeLayers={activeLayers}
        isDark={isDark}
      />

      <LegendBar activeLayers={activeLayers} isOpen={legendOpen} onToggle={() => setLegendOpen(v => !v)} isDark={isDark} />
    </div>
  );
}