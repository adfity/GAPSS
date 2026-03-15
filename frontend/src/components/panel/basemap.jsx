"use client";
import { MapIcon } from 'lucide-react';

export const BASEMAP_OPTIONS = [
    // ── SATELIT ───────────────────────────────────────────────────────────────
    {
        id: 'satellite',
        name: 'Citra Satelit',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        thumbnail: '/icons/basemaps/satelit.png',
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        group: 'Satelit',
    },

    // ── INDONESIA / RBI ───────────────────────────────────────────────────────
    {
        id: 'big-rbi',
        name: 'Rupa Bumi Indonesia',
        url: 'https://geoservices.big.go.id/rbi/rest/services/BASEMAP/Rupabumi_Indonesia/MapServer/tile/{z}/{y}/{x}',
        thumbnail: '/icons/basemaps/rbi.png',
        attribution: '&copy; Badan Informasi Geospasial (BIG)',
        group: 'Indonesia',
    },

    // ── JALAN / NAVIGASI ──────────────────────────────────────────────────────
    {
        id: 'osm',
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        thumbnail: '/icons/basemaps/osm.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        group: 'Jalan',
    },
    {
        id: 'esri-streets',
        name: 'Esri Street Map',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        thumbnail: '/icons/basemaps/esri-streets.png',
        attribution: '&copy; Esri, HERE, Garmin',
        group: 'Jalan',
    },
    {
        id: 'hot-osm',
        name: 'OSM Humanitarian',
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        thumbnail: '/icons/basemaps/hot-osm.png',
        attribution: '&copy; OpenStreetMap contributors, HOT',
        group: 'Jalan',
    },

    // ── TOPOGRAFI ─────────────────────────────────────────────────────────────
    {
        id: 'esri-topo',
        name: 'Esri Topografi',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        thumbnail: '/icons/basemaps/esri-topo.png',
        attribution: '&copy; Esri, USGS, NOAA',
        group: 'Topografi',
    },
    {
        id: 'opentopomap',
        name: 'OpenTopoMap',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        thumbnail: '/icons/basemaps/opentopomap.png',
        attribution: '&copy; OpenTopoMap (CC-BY-SA)',
        group: 'Topografi',
    },

    // ── MINIMALIS / DESAIN ────────────────────────────────────────────────────
    {
        id: 'carto-light',
        name: 'CartoDB Light',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        thumbnail: '/icons/basemaps/carto-light.png',
        attribution: '&copy; CartoDB',
        group: 'Minimalis',
    },
    {
        id: 'carto-dark',
        name: 'CartoDB Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        thumbnail: '/icons/basemaps/carto-dark.png',
        attribution: '&copy; CartoDB',
        group: 'Minimalis',
    },
    {
        id: 'esri-gray',
        name: 'Esri Gray Canvas',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        thumbnail: '/icons/basemaps/esri-gray.png',
        attribution: '&copy; Esri, HERE, Garmin',
        group: 'Minimalis',
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GROUPS = [...new Set(BASEMAP_OPTIONS.map((b) => b.group))];

const GROUP_COLORS = {
    Satelit:   'from-indigo-500 to-purple-600',
    Indonesia: 'from-red-500 to-rose-600',
    Jalan:     'from-emerald-500 to-teal-600',
    Topografi: 'from-amber-500 to-orange-600',
    Minimalis: 'from-slate-400 to-slate-600',
};

export default function BasemapPanel({ onSelect, activeUrl }) {
    return (
        <div
            className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
            onWheel={(e) => e.stopPropagation()}
        >
            {/* HEADER */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
                <h3 className="font-black text-lg uppercase tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <MapIcon size={20} />
                    Basemap
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {BASEMAP_OPTIONS.length} peta dasar tersedia
                </p>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {GROUPS.map((group) => {
                    const items = BASEMAP_OPTIONS.filter((b) => b.group === group);
                    const gradientClass = GROUP_COLORS[group] ?? 'from-cyan-500 to-blue-600';
                    return (
                        <div key={group}>
                            {/* Group Label */}
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${gradientClass}`} />
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    {group}
                                </span>
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                                {items.map((map) => {
                                    const isActive = activeUrl === map.url;
                                    return (
                                        <button
                                            key={map.id}
                                            onClick={() => onSelect(map)}
                                            className={`group w-full p-3 rounded-2xl transition-all border-2 flex items-center gap-3 text-left ${
                                                isActive
                                                    ? 'border-cyan-500 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 shadow-lg shadow-cyan-500/20'
                                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-cyan-300 hover:shadow-md'
                                            }`}
                                        >
                                            {/* Thumbnail */}
                                            <div className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                                                isActive
                                                    ? 'border-cyan-400 shadow-lg shadow-cyan-500/30'
                                                    : 'border-slate-200 dark:border-slate-600 group-hover:border-cyan-300'
                                            }`}>
                                                <img
                                                    src={map.thumbnail}
                                                    alt={map.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = `https://placehold.co/56x56/94a3b8/ffffff?text=${map.id.slice(0, 3).toUpperCase()}`;
                                                    }}
                                                />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                    <span className={`text-sm font-bold truncate ${
                                                        isActive
                                                            ? 'text-cyan-700 dark:text-cyan-400'
                                                            : 'text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {map.name}
                                                    </span>
                                                    {map.badge && (
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r ${gradientClass} text-white leading-none`}>
                                                            {map.badge}
                                                        </span>
                                                    )}
                                                    {map.maxZoom && map.maxZoom < 18 && (
                                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 leading-none">
                                                            max z{map.maxZoom}
                                                        </span>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-[10px] text-slate-400 dark:text-slate-500 truncate"
                                                    dangerouslySetInnerHTML={{ __html: map.attribution }}
                                                />
                                            </div>

                                            {/* Active dot */}
                                            {isActive && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/50 animate-pulse flex-shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* FOOTER */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white/30 dark:bg-slate-900/30">
                <p className="text-[10px] text-center text-slate-400 dark:text-slate-600">
                    RBI BIG • geoservices.big.go.id • max zoom 16
                </p>
            </div>
        </div>
    );
}