import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BarChart3, Info, History, FileText,
  CheckCircle2, XCircle, Satellite, Wheat,
  UtensilsCrossed, AlertTriangle,
} from 'lucide-react';

// Dynamic import untuk komponen Leaflet
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);

const GeoJSON = dynamic(
  () => import('react-leaflet').then(mod => mod.GeoJSON),
  { ssr: false }
);

const ScaleControl = dynamic(
  () => import('react-leaflet').then(mod => mod.ScaleControl),
  { ssr: false }
);

const useMap = dynamic(
  () => import('react-leaflet').then(mod => mod.useMap),
  { ssr: false }
);

// Import CSS di client-side only
import 'leaflet/dist/leaflet.css';


// Konstanta

export const PROVINSI_LIST = [
  'Aceh','Bali','Banten','Bengkulu',
  'Daerah Istimewa Yogyakarta','Daerah Khusus Ibukota Jakarta',
  'Gorontalo','Jambi','Jawa Barat','Jawa Tengah','Jawa Timur',
  'Kalimantan Barat','Kalimantan Selatan','Kalimantan Tengah',
  'Kalimantan Timur','Kalimantan Utara',
  'Kepulauan Bangka Belitung','Kepulauan Riau','Lampung',
  'Maluku','Maluku Utara','Nusa Tenggara Barat','Nusa Tenggara Timur',
  'Papua','Papua Barat','Papua Barat Daya','Papua Pegunungan',
  'Papua Selatan','Papua Tengah','Riau',
  'Sulawesi Barat','Sulawesi Selatan','Sulawesi Tengah',
  'Sulawesi Tenggara','Sulawesi Utara',
  'Sumatera Barat','Sumatera Selatan','Sumatera Utara',
];

export const TABS = [
  { id: 'dashboard',  label: 'Dashboard',     Icon: BarChart3 },
  { id: 'analisis',   label: 'Analisis IKPG', Icon: FileText  },
  { id: 'metodologi', label: 'Metodologi',    Icon: Info      },
  { id: 'riwayat',    label: 'Riwayat',       Icon: History   },
];

const STATUS_STYLE = {
  Tinggi: {
    bar:   '#10b981',
    text:  'text-emerald-600 dark:text-emerald-400',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/30',
  },
  Sedang: {
    bar:   '#f59e0b',
    text:  'text-amber-600 dark:text-amber-400',
    badge: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/30',
  },
  Rendah: {
    bar:   '#ef4444',
    text:  'text-red-600 dark:text-red-400',
    badge: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/30',
  },
};
const STATUS_DEFAULT = {
  bar:   '#6b7280',
  text:  'text-slate-500 dark:text-slate-400',
  badge: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-700 dark:border-slate-600',
};

export const getSt = (s) => STATUS_STYLE[s] ?? STATUS_DEFAULT;

export const barColor = (v) =>
  v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444';

/**
 * Format ton produksi padi ke satuan yang sesuai.
 * 42.38 → "42.38 ton" | 6072 → "6.07 ribu ton" | 9270435 → "9.27 juta ton"
 */
export function formatProduksi(ton) {
  if (ton == null) return null;
  if (ton >= 1_000_000) return `${(ton / 1_000_000).toFixed(2)} juta ton`;
  if (ton >= 1_000)     return `${(ton / 1_000).toFixed(2)} ribu ton`;
  return `${ton.toFixed(2)} ton`;
}

// UI Primitives

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

export function Toast({ toast: t, onClose }) {
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(onClose, 3500);
    return () => clearTimeout(id);
  }, [t, onClose]);

  if (!t) return null;
  const bg   = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600' };
  const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info;
  return (
    <div className={`fixed bottom-6 right-6 z-[1300] flex items-center gap-3 px-5 py-3 rounded-xl text-white shadow-2xl ${bg[t.type] ?? 'bg-slate-700'}`}>
      <Icon size={15} />
      <span className="text-sm font-medium">{t.message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <XCircle size={14} />
      </button>
    </div>
  );
}

export function StatCard({ label, value, Icon, sub, colorCls }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon size={18} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-full">
          {sub}
        </span>
      </div>
      <div className={`text-2xl font-bold ${colorCls ?? 'text-slate-800 dark:text-slate-100'}`}>
        {value ?? '-'}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </Card>
  );
}

export function ScoreBar({ label, Icon, score, weight, detail, noDataMsg }) {
  const pct   = score != null ? Math.min(score, 100) : 0;
  const color = score != null ? barColor(pct) : '#94a3b8';
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
      <div className="flex justify-between items-start mb-2 gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Icon size={15} className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{label}</div>
            {detail && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{detail}</div>}
            {noDataMsg && score == null && (
              <div className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">{noDataMsg}</div>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold" style={{ color }}>
            {score != null ? score.toFixed(1) : '-'}
            <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">/100</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">
            Bobot {(weight * 100).toFixed(0)}%
          </div>
        </div>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function ProporsiBar({ label, Icon, pct, color }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={13} className="flex-shrink-0 text-slate-400 dark:text-slate-500" />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500 dark:text-slate-400">{label}</span>
          <span className="text-slate-700 dark:text-slate-300 font-mono">{pct?.toFixed(1) ?? 0}%</span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(pct ?? 0, 100)}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

export function IkpgGauge({ ikpg, status }) {
  const bar  = getSt(status).bar;
  const pct  = ikpg ?? 0;
  const r = 54, cx = 64, cy = 64, a0 = 140, a1 = 400;
  const fill = (pct / 100) * (a1 - a0);
  const arc  = (s, e) => {
    const sr = (s * Math.PI) / 180, er = (e * Math.PI) / 180;
    return `M ${cx + r * Math.cos(sr)} ${cy + r * Math.sin(sr)} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${cx + r * Math.cos(er)} ${cy + r * Math.sin(er)}`;
  };
  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <path d={arc(a0, a1)} fill="none" stroke="#e2e8f0" className="dark:[stroke:#1e293b]" strokeWidth="10" strokeLinecap="round" />
        {ikpg != null && (
          <path d={arc(a0, a0 + fill)} fill="none" stroke={bar} strokeWidth="10" strokeLinecap="round" className="transition-all duration-1000" />
        )}
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-black text-slate-800 dark:text-white leading-none">{ikpg ?? '-'}</div>
        <div className={`text-xs font-semibold mt-1 ${getSt(status).text}`}>{status ?? '-'}</div>
      </div>
    </div>
  );
}

export function FormulaBox({ accent = 'indigo', children }) {
  const variants = {
    indigo:  'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/5',
    amber:   'border-amber-200  dark:border-amber-500/30  bg-amber-50/60  dark:bg-amber-500/5',
    cyan:    'border-cyan-200   dark:border-cyan-500/30   bg-cyan-50/60   dark:bg-cyan-500/5',
    emerald: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5',
    pink:    'border-pink-200   dark:border-pink-500/30   bg-pink-50/60   dark:bg-pink-500/5',
  };
  return (
    <div className={`rounded-xl border p-4 font-mono text-sm leading-relaxed overflow-x-auto text-slate-700 dark:text-slate-200 ${variants[accent]}`}>
      {children}
    </div>
  );
}

export function MetSection({ title, Icon, children }) {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
        <Icon size={17} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
        {title}
      </h3>
      {children}
    </Card>
  );
}

// Riwayat Card─

export function RiwayatCard({ item, onDelete }) {
  const k  = item.komponen ?? {};
  const b  = item.bobot_used ?? {};
  const sc = getSt(item.status);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{item.provinsi}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : ''}
          </div>
        </div>
        <button onClick={() => onDelete(item.analysis_id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors">
          <XCircle size={16} />
        </button>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className={`text-2xl font-black ${sc.text}`}>{item.ikpg}</div>
        <div className="flex-1">
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${item.ikpg}%`, backgroundColor: sc.bar }} />
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.badge}`}>{item.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { label: 'GeoAI',      val: k.geoai_weighted,   bobot: b.geoai,      Icon: Satellite      },
          { label: 'Produksi',   val: k.production_score, bobot: b.produksi,   Icon: Wheat          },
          { label: 'Kalori',     val: k.calorie_score,    bobot: b.kalori,     Icon: UtensilsCrossed},
          { label: 'Insecurity', val: k.insecurity_score, bobot: b.insecurity, Icon: AlertTriangle  },
        ].map(({ label, val, bobot, Icon: Ic }) => (
          <div key={label} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/40 rounded-lg px-2 py-1.5">
            <Ic size={11} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <div>
              <div className="text-slate-400 dark:text-slate-500">{label}</div>
              <div className="font-mono text-slate-700 dark:text-slate-300">
                {val != null ? val.toFixed(1) : '-'}
                <span className="text-slate-400 dark:text-slate-600"> ({((bobot ?? 0) * 100).toFixed(0)}%)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {item.has_geoai_data && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-400/10 rounded-lg px-2 py-1">
          <Satellite size={10} /> Data GeoAI tersedia
        </div>
      )}
    </Card>
  );
}



// ISI PANGAN MAP (intinya handle map di page pangan)

function ikpgFill(ikpg) {
  if (ikpg == null) return '#1e293b';
  if (ikpg >= 70)   return '#10b981';
  if (ikpg >= 55)   return '#34d399';
  if (ikpg >= 40)   return '#f59e0b';
  if (ikpg >= 25)   return '#fb923c';
  return '#ef4444';
}

function MapLegend() {
  const [isClient, setIsClient] = useState(false);
  const map = useMap();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!map || !isClient) return;

    // Dynamic import untuk leaflet
    const loadLegend = async () => {
      const L = await import('leaflet');
      
      const ctrl = L.control({ position: 'bottomleft' });
      ctrl.onAdd = () => {
        const isDark =
          typeof document !== 'undefined' &&
          document.documentElement.getAttribute('data-theme') === 'dark';
        const bg     = isDark ? '#0f172a' : '#ffffff';
        const border = isDark ? '#1e293b' : '#e2e8f0';
        const txt    = isDark ? '#94a3b8' : '#475569';
        const head   = isDark ? '#64748b' : '#94a3b8';

        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div style="background:${bg};border:1px solid ${border};border-radius:10px;
            padding:10px 12px;font-size:11px;font-family:system-ui,sans-serif;
            min-width:145px;box-shadow:0 4px 16px rgba(0,0,0,0.15);">
            <div style="font-weight:700;color:${head};font-size:9px;
              text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">
              Skala IKPG
            </div>
            ${[
              ['#10b981', '>= 70  (Tinggi)'],
              ['#34d399', '55 - 69'],
              ['#f59e0b', '40 - 54  (Sedang)'],
              ['#fb923c', '25 - 39'],
              ['#ef4444', '< 25  (Rendah)'],
              ['#94a3b8', 'Tidak ada data'],
            ]
              .map(
                ([c, l]) => `
                <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
                  <span style="width:12px;height:12px;border-radius:3px;background:${c};
                    display:inline-block;flex-shrink:0;"></span>
                  <span style="color:${txt};">${l}</span>
                </div>`
              )
              .join('')}
          </div>`;
        return div;
      };
      ctrl.addTo(map);
      return () => ctrl.remove();
    };

    loadLegend();
  }, [map, isClient]);

  return null;
}

// Modifikasi komponen ProvinceLayer
function ProvinceLayer({ geojson, onProvinceClick }) {
  const map      = useMap();
  const layerRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fix untuk ikon marker Leaflet
  useEffect(() => {
    if (!isClient) return;
    
    const fixLeafletIcons = async () => {
      const L = await import('leaflet');
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    };
    
    fixLeafletIcons();
  }, [isClient]);

  const style = (feat) => ({
    fillColor:   ikpgFill(feat?.properties?.food_analysis?.ikpg),
    fillOpacity: 0.78,
    color:       '#0f172a',
    weight:      1,
  });

  const onEach = (feat, layer) => {
    const fa   = feat.properties?.food_analysis ?? {};
    const name = feat.properties?.name ?? fa.nama_provinsi ?? '?';
    const ikpg = fa.ikpg ?? '-';
    const st   = fa.status ?? '-';
    const c    = fa.warna ?? '#94a3b8';
    const k    = fa.komponen ?? {};

    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'dark';
    const bg     = isDark ? '#0f172a' : '#ffffff';
    const border = isDark ? '#1e293b' : '#e2e8f0';
    const txt    = isDark ? '#e2e8f0' : '#1e293b';
    const sub    = isDark ? '#94a3b8' : '#64748b';
    const rowlb  = isDark ? '#475569' : '#94a3b8';
    const divider= isDark ? '#1e293b' : '#f1f5f9';

    layer.bindTooltip(
      `<div style="background:${bg};border:1px solid ${border};border-radius:10px;
        padding:10px 13px;min-width:175px;font-family:system-ui,sans-serif;
        box-shadow:0 8px 24px rgba(0,0,0,0.2);">
        <div style="font-weight:700;color:${txt};font-size:13px;margin-bottom:5px;">
          ${name}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:22px;font-weight:900;color:${c};line-height:1;">${ikpg}</span>
          <div>
            <div style="font-size:9px;color:${sub};text-transform:uppercase;
              letter-spacing:.5px;">IKPG</div>
            <div style="font-size:11px;font-weight:700;color:${c};">${st}</div>
          </div>
        </div>
        <div style="border-top:1px solid ${divider};padding-top:5px;
          display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:10px;">
          <span style="color:${rowlb};">Produksi</span>
          <span style="color:${sub};text-align:right;">
            ${k.production_score?.toFixed(1) ?? '-'}
          </span>
          <span style="color:${rowlb};">Kalori</span>
          <span style="color:${sub};text-align:right;">
            ${k.calorie_score?.toFixed(1) ?? '-'}
          </span>
          <span style="color:${rowlb};">Insecurity</span>
          <span style="color:${sub};text-align:right;">
            ${k.insecurity_score?.toFixed(1) ?? '-'}
          </span>
          ${
            k.geoai_weighted != null
              ? `<span style="color:${rowlb};">GeoAI</span>
                 <span style="color:${sub};text-align:right;">
                   ${k.geoai_weighted.toFixed(1)}
                 </span>`
              : ''
          }
        </div>
        <div style="margin-top:5px;font-size:9px;color:${sub};text-align:center;">
          Klik untuk analisis detail
        </div>
      </div>`,
      { sticky: true, direction: 'auto', className: 'pangan-tip', offset: [8, 0] }
    );

    layer.on({
      mouseover(e) {
        e.target.setStyle({ weight: 2.5, color: '#38bdf8', fillOpacity: 0.92 });
        e.target.bringToFront();
      },
      mouseout(e) {
        if (layerRef.current) layerRef.current.resetStyle(e.target);
      },
      click() {
        const nm = fa.nama_provinsi ?? feat.properties?.name ?? '';
        if (nm && onProvinceClick) onProvinceClick(nm);
        try {
          map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 8 });
        } catch (_) {}
      },
    });
  };

  return (
    <GeoJSON
      ref={layerRef}
      data={geojson}
      style={style}
      onEachFeature={onEach}
    />
  );
}

// Komponen PanganMap utama
export function PanganMap({ geojson, onProvinceClick }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Memuat peta...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .pangan-tip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .pangan-tip::before { display: none !important; }
        .leaflet-container { font-family: system-ui, sans-serif; }
      `}</style>

      <MapContainer
        center={[-2.5, 118]}
        zoom={4}
        minZoom={3}
        maxZoom={12}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
          subdomains="abcd"
          maxZoom={19}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          attribution=""
          subdomains="abcd"
          maxZoom={19}
          pane="shadowPane"
        />

        {geojson?.features?.length > 0 && (
          <ProvinceLayer geojson={geojson} onProvinceClick={onProvinceClick} />
        )}

        <MapLegend />
        <ScaleControl position="bottomright" />
      </MapContainer>
    </>
  );
}