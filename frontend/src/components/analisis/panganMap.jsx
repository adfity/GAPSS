'use client';
import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function ikpgFill(ikpg) {
  if (ikpg == null) return '#1e293b';
  if (ikpg >= 70)   return '#10b981';
  if (ikpg >= 55)   return '#34d399';
  if (ikpg >= 40)   return '#f59e0b';
  if (ikpg >= 25)   return '#fb923c';
  return '#ef4444';
}

function MapLegend() {
  const map = useMap();
  useEffect(() => {
    const L = require('leaflet');
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
  }, [map]);
  return null;
}

function ProvinceLayer({ geojson, onProvinceClick }) {
  const map      = useMap();
  const layerRef = useRef(null);

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

export default function PanganMap({ geojson, onProvinceClick }) {
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