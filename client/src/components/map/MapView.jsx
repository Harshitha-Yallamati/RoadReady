/**
 * MapView.jsx — MapLibre GL JS (WebGL, GPU-accelerated)
 * Replaces react-leaflet with maplibre-gl for smooth 60fps rendering.
 * All prior features preserved: routes, traffic, markers, right-click
 * context menu, draggable pins, navigation, layers, camera tracking.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRoute } from '../../context/RouteContext';
import {
  NavigationHeader,
  NavigationFooter,
  SpeedPanel,
} from './NavigationOverlays';
import toast from 'react-hot-toast';
import { addSavedPlace } from '../../services/api';

/* ══════════════════════════════════════════════
   TILE STYLES (MapLibre GL vector / raster)
   ══════════════════════════════════════════════ */
const MAP_STYLES = {
  standard: {
    label: 'Standard',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
    },
  },
  dark: {
    label: 'Dark',
    style: {
      version: 8,
      sources: {
        carto: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap © CARTO',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'carto-dark', type: 'raster', source: 'carto' }],
    },
  },
  satellite: {
    label: 'Satellite',
    style: {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'sat-tiles', type: 'raster', source: 'satellite' }],
    },
  },
  voyager: {
    label: 'Voyager',
    style: {
      version: 8,
      sources: {
        voyager: {
          type: 'raster',
          tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors © CARTO',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'voyager-tiles', type: 'raster', source: 'voyager' }],
    },
  },
};

const TRAFFIC_COLORS = {
  heavy: '#ea4335',
  moderate: '#fbbc04',
  light: '#34a853',
  clear: '#4285f4',
};

const VEHICLE_OPTIONS = [
  { id: 'car', label: 'Car' },
  { id: 'bike', label: 'Bike' },
  { id: 'walk', label: 'Walk' },
];

/* ══════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════ */
function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coordsToGeoJSON(positions) {
  // positions = [[lat,lon], ...]  → GeoJSON [[lon,lat], ...]
  return positions.map(([lat, lon]) => [lon, lat]);
}

function createCirclePolygon(lon, lat, radiusKm, steps = 48) {
  const points = [];
  const angularDistance = radiusKm / 6371;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  for (let step = 0; step <= steps; step += 1) {
    const bearing = (step / steps) * Math.PI * 2;
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const destLon = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLat),
    );

    points.push([
      ((destLon * 180) / Math.PI + 540) % 360 - 180,
      (destLat * 180) / Math.PI,
    ]);
  }

  return points;
}

function zoneToFeature(zone) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [createCirclePolygon(zone.lon, zone.lat, zone.radiusKm)],
    },
    properties: {
      ...zone,
      fillOpacity: zone.opacity || 0.18,
    },
  };
}

function makePinHTML(color, label = '') {
  return `
    <div style="width:${label ? 28 : 18}px;height:${label ? 28 : 18}px;
      border-radius:50% 50% 50% 0;background:${color};
      transform:rotate(-45deg);border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;
        font-size:${label ? 11 : 0}px;font-weight:700;">${label}</span>
    </div>`;
}

function makeNavVehicleHTML(bearing = 0) {
  return `
    <div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;position:relative;">
      <svg width="40" height="40" viewBox="0 0 40 40"
        style="transform:rotate(${bearing}deg);transition:transform 0.3s ease;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4)) drop-shadow(0 0 12px rgba(66,133,244,0.4));">
        <defs>
          <linearGradient id="navGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#5B9EF4"/>
            <stop offset="100%" style="stop-color:#2A6FDB"/>
          </linearGradient>
        </defs>
        <path d="M20 4 L32 30 L20 24 L8 30 Z" fill="url(#navGrad)"
          stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
      <div style="position:absolute;width:52px;height:52px;border-radius:50%;
        border:2px solid rgba(66,133,244,0.25);animation:navPulse 2s infinite;"></div>
    </div>`;
}

function makeGPSHTML() {
  return `<div style="width:18px;height:18px;background:#4285f4;border-radius:50%;
    border:3px solid #fff;
    box-shadow:0 0 0 2px rgba(66,133,244,0.3),0 0 16px rgba(66,133,244,0.4);"></div>`;
}

function makeDroppedPinHTML() {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#6366f1;
        transform:rotate(-45deg);border:2.5px solid #fff;
        box-shadow:0 3px 12px rgba(99,102,241,0.5);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:10px;font-weight:700;color:#fff;">P</span>
      </div>
      <div style="width:2px;height:6px;background:rgba(99,102,241,0.4);margin-top:-2px;"></div>
    </div>`;
}

/* ══════════════════════════════════════════════
   CONTROL BUTTON
   ══════════════════════════════════════════════ */
function ControlButton({ onClick, title, children, active = false, size = 50 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      title={title}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: active ? '1px solid rgba(66,133,244,0.45)' : '1px solid rgba(255,255,255,0.18)',
        background: active ? 'rgba(66,133,244,0.18)' : 'rgba(255,255,255,0.94)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? '#1a73e8' : '#3c4043',
        transition: 'all 0.2s ease', backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
      }}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════
   LAYER SIDE PANEL
   ══════════════════════════════════════════════ */
function LayerSidePanel({ open, currentLayer, onLayerChange, trafficEnabled, onToggleTraffic, onLocate, locating, isMobile }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', top: isMobile ? '66%' : '64%', right: isMobile ? 84 : 102,
      transform: 'translateY(-50%)', zIndex: 1110,
      width: isMobile ? 192 : 220,
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
      boxShadow: '0 12px 30px rgba(0,0,0,0.2)', padding: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#5f6368', marginBottom: 8 }}>Map layers</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(MAP_STYLES).map(([key, val]) => (
          <button key={key} onClick={() => onLayerChange(key)}
            style={{
              border: 'none', borderRadius: 10, padding: '10px 12px', textAlign: 'left',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
              fontWeight: currentLayer === key ? 700 : 500,
              background: currentLayer === key ? '#e8f0fe' : '#f7f8f9',
              color: currentLayer === key ? '#1a73e8' : '#3c4043',
            }}>
            {val.label}
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '12px 2px' }} />

      <button onClick={onToggleTraffic}
        style={{
          width: '100%', border: 'none', borderRadius: 10, padding: '10px 12px',
          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
          fontWeight: 600, marginBottom: 8,
          background: trafficEnabled ? '#e6f4ea' : '#f1f3f4',
          color: trafficEnabled ? '#137333' : '#3c4043',
        }}>
        {trafficEnabled ? 'Traffic colors: ON' : 'Traffic colors: OFF'}
      </button>

      <button onClick={onLocate}
        style={{
          width: '100%', border: 'none', borderRadius: 10, padding: '10px 12px',
          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
          fontWeight: 600, background: '#f1f3f4',
          color: locating ? '#1a73e8' : '#3c4043',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
        Use my location
        <span style={{ fontSize: 11, fontWeight: 700 }}>{locating ? 'Locating...' : 'GPS'}</span>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   RIGHT CONTROL STACK
   ══════════════════════════════════════════════ */
function RightControlStack({
  isMobile, layersOpen, trafficEnabled, isFollowing, navigating,
  onToggleLayers, onToggleTraffic, onRecenter, onZoomIn, onZoomOut,
}) {
  const size = isMobile ? 46 : 50;
  const icon = isMobile ? 18 : 20;
  return (
    <div style={{
      position: 'absolute', right: isMobile ? 12 : 20, top: isMobile ? '66%' : '64%',
      transform: 'translateY(-50%)', zIndex: 1100,
      display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10,
    }}>
      <ControlButton onClick={onToggleLayers} title="Map layers" active={layersOpen} size={size}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <polygon points="12 2 22 8.5 12 15 2 8.5" />
          <polyline points="2 15.5 12 22 22 15.5" />
        </svg>
      </ControlButton>
      <ControlButton onClick={onToggleTraffic} title={trafficEnabled ? 'Hide traffic' : 'Show traffic'} active={trafficEnabled} size={size}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 18l5-8 4 5 3-3 4 6" />
          <circle cx="7" cy="18" r="1.5" fill="currentColor" />
          <circle cx="14" cy="15" r="1.5" fill="currentColor" />
        </svg>
      </ControlButton>
      <ControlButton
        onClick={onRecenter}
        title={navigating ? (isFollowing ? 'Disable auto-follow' : 'Enable auto-follow') : 'Re-center'}
        active={isFollowing}
        size={size}
      >
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="3.5" />
          <line x1="12" y1="2.5" x2="12" y2="5.5" />
          <line x1="12" y1="18.5" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5.5" y2="12" />
          <line x1="18.5" y1="12" x2="21.5" y2="12" />
        </svg>
      </ControlButton>
      <ControlButton onClick={onZoomIn} title="Zoom in" size={size}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </ControlButton>
      <ControlButton onClick={onZoomOut} title="Zoom out" size={size}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </ControlButton>
    </div>
  );
}

/* ══════════════════════════════════════════════
   CONTEXT MENU
   ══════════════════════════════════════════════ */
function ContextMenu({ position, coords, address, loading, onDirectionsFrom, onDirectionsTo, onAddStop, onSavePlace, onClose }) {
  useEffect(() => {
    const h = () => onClose();
    const timer = setTimeout(() => document.addEventListener('click', h, { once: true }), 50);
    return () => { clearTimeout(timer); document.removeEventListener('click', h); };
  }, [onClose]);

  if (!position) return null;

  const coordStr = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
  const item = (label, accent, onClick) => (
    <button
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        fontSize: 13, color: '#e4e6ed', cursor: 'pointer', border: 'none',
        background: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = `rgba(${accent},0.15)`}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
      onClick={() => { onClick(); onClose(); }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute', left: position.x, top: position.y, zIndex: 2000,
        background: 'rgba(26,29,39,0.97)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12,
        padding: '4px 0', minWidth: 220,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'ctxMenuIn 0.15s ease-out',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e4e6ed', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? 'Loading location...' : address || coordStr}
        </div>
        <div style={{ fontSize: 10, color: '#5c6078', marginTop: 2 }}>{coordStr}</div>
      </div>
      {item(<><span style={{ fontSize: 12, fontWeight: 700, color: '#34a853' }}>FROM</span>&nbsp;Directions from here</>, '52,168,83', onDirectionsFrom)}
      {item(<><span style={{ fontSize: 12, fontWeight: 700, color: '#ea4335' }}>TO</span>&nbsp;Directions to here</>, '234,67,53', onDirectionsTo)}
      {item(<><span style={{ fontSize: 12, fontWeight: 700, color: '#fbbc04' }}>STOP</span>&nbsp;Add as stop</>, '251,188,4', onAddStop)}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />
      {item(<><span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>SAVE</span>&nbsp;Save to Favorites</>, '99,102,241', onSavePlace)}
      {item(
        <><span style={{ fontSize: 12, fontWeight: 700 }}>COPY</span>&nbsp;Copy coordinates</>,
        '255,255,255',
        () => navigator.clipboard.writeText(coordStr)
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   DROPPED PIN TOOLTIP
   ══════════════════════════════════════════════ */
function DroppedPinTooltip({ lat, lon, x, y, onFrom, onTo, onStop, onSave, onClose }) {
  const [addr, setAddr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/routes/reverse-geocode?lat=${lat}&lon=${lon}`);
        const d = await r.json();
        setAddr(d.result?.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } catch {
        setAddr(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      }
    })();
  }, [lat, lon]);

  const btn = (label, bg, color, onClick) => (
    <button onClick={() => { onClick(); onClose(); }}
      style={{
        padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontSize: 11, fontWeight: 600, fontFamily: 'inherit', flex: 1,
        background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%) translateY(-12px)',
      zIndex: 1900, background: 'rgba(26,29,39,0.97)', border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 12, padding: 12, minWidth: 200,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
      animation: 'ctxMenuIn 0.12s ease-out',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e6ed', marginBottom: 2, lineHeight: 1.3 }}>
        {addr || 'Loading...'}
      </div>
      <div style={{ fontSize: 10, color: '#5c6078', marginBottom: 8 }}>{lat.toFixed(5)}, {lon.toFixed(5)}</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {btn('From', 'rgba(52,168,83,0.2)', '#34a853', onFrom)}
        {btn('To', 'rgba(234,67,53,0.2)', '#ea4335', onTo)}
        {btn('Stop', 'rgba(251,188,4,0.2)', '#fbbc04', onStop)}
      </div>
      <button onClick={() => { onSave(); onClose(); }}
        style={{
          width: '100%', padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          background: 'rgba(99,102,241,0.2)', color: '#6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
        }}>
        ★ Save to Favorites
      </button>
      <button onClick={onClose}
        style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: '#5c6078', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>
        ×
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN MAP VIEW
   ══════════════════════════════════════════════ */
export default function MapView({
  stops = [], multiResult, navPosition, navigating,
  onMapSetSource, onMapSetDestination, onMapAddStop,
  onDragSource, onDragDestination, onDragStop,
  userLocation, poiResults = []
}) {
  const { state, dispatch } = useRoute();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});      // key → maplibregl.Marker
  const popupRef = useRef(null);       // active popup
  const dragStateRef = useRef({});     // track drag info per marker

  const [mapLayer, setMapLayer] = useState('standard');
  const [locating, setLocating] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const [vehicleType, setVehicleType] = useState('car');
  const [contextMenu, setContextMenu] = useState(null);   // { x, y, lat, lng, address, loading }
  const [droppedPin, setDroppedPin] = useState(null);     // { lat, lon, x, y }
  const prevBearingRef = useRef(0);
  const lastCameraRef = useRef(0);

  const isMobile = useMemo(() => typeof window !== 'undefined' && (window.innerWidth < 768 || navigator.hardwareConcurrency <= 4), []);

  // ── Reset follow on navigation start ──
  useEffect(() => { if (navigating) setIsFollowing(true); }, [navigating]);

  /* ══════════════════════════════════════════════
     INIT MAP — once on mount
     ══════════════════════════════════════════════ */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.standard.style,
      center: [78.9629, 20.5937],   // [lon, lat] India centre
      zoom: 5,
      attributionControl: false,
      // ── 🔥 SMOOTHNESS PHYSICS ──
      dragPan: {
        inertia: 1200,
        deceleration: 2500,
        linearity: 0.2,
        maxSpeed: 1400,
      },
      pitchWithRotate: false,
      dragRotate: false,
      fadeDuration: 300,
      zoomSnap: 0,              // 🔥 continuous zoom (no snapping)
      scrollZoom: {
        speed: 0.02,
        smooth: true,
      },
    });

    mapRef.current = map;

    map.on('load', () => {
      // ── Add empty GeoJSON sources for routes ──
      map.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('completed-path', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('turn-highlight', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('traffic-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // ── Unselected route layer ──
      map.addLayer({
        id: 'route-unselected',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'selected'], false],
        paint: {
          'line-color': '#9aa0a6',
          'line-width': 6,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ── Selected route — border glow ──
      map.addLayer({
        id: 'route-selected-glow',
        type: 'line',
        source: 'routes',
        filter: ['all', ['==', ['get', 'selected'], true], ['==', ['get', 'completed'], false]],
        paint: {
          'line-color': '#1a73e8',
          'line-width': 18,
          'line-opacity': 0.3,
          'line-blur': 4,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ── Selected route — white base ──
      map.addLayer({
        id: 'route-selected-white',
        type: 'line',
        source: 'routes',
        filter: ['all', ['==', ['get', 'selected'], true], ['==', ['get', 'completed'], false]],
        paint: {
          'line-color': '#ffffff',
          'line-width': 14,
          'line-opacity': 1,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ── Selected route — traffic colour core ──
      map.addLayer({
        id: 'route-selected-core',
        type: 'line',
        source: 'routes',
        filter: ['all', ['==', ['get', 'selected'], true], ['==', ['get', 'completed'], false]],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 10,
          'line-opacity': 0.95,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ── Completed path (faded) ──
      map.addLayer({
        id: 'completed-path-layer',
        type: 'line',
        source: 'completed-path',
        paint: {
          'line-color': '#7BAAF7',
          'line-width': 8,
          'line-opacity': 0.3,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ── Turn highlight ──
      map.addLayer({
        id: 'turn-highlight-glow',
        type: 'line',
        source: 'turn-highlight',
        paint: {
          'line-color': '#ffffff',
          'line-width': 14,
          'line-opacity': 0.3,
          'line-blur': 3,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      map.addLayer({
        id: 'turn-highlight-core',
        type: 'line',
        source: 'turn-highlight',
        paint: {
          'line-color': '#ffffff',
          'line-width': 8,
          'line-opacity': 0.9,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // ── Traffic Zones ──
      map.addLayer({
        id: 'traffic-zones-fill',
        type: 'fill',
        source: 'traffic-zones',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            3, 0.02,
            6, ['*', ['get', 'fillOpacity'], 0.35],
            10, ['*', ['get', 'fillOpacity'], 0.75],
            14, ['get', 'fillOpacity'],
          ],
        },
      });
      map.addLayer({
        id: 'traffic-zones-outline',
        type: 'line',
        source: 'traffic-zones',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.5,
            9, 1,
            14, 2,
          ],
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.15,
            9, 0.3,
            14, 0.55,
          ],
        },
      });

      // ── Click handler ──
      map.on('click', (e) => {
        setShowLayerPanel(false);
        setContextMenu(null);
        const pt = { lat: e.lngLat.lat, lon: e.lngLat.lng };
        const pixel = e.point;
        setDroppedPin({ ...pt, x: pixel.x, y: pixel.y });
      });

      // ── Right-click / context menu ──
      map.on('contextmenu', async (e) => {
        e.preventDefault?.();
        setDroppedPin(null);
        setShowLayerPanel(false);
        const { lat, lng } = e.lngLat;
        const pixel = e.point;

        setContextMenu({ x: pixel.x, y: pixel.y, lat, lng, address: '', loading: true });

        try {
          const r = await fetch(`/api/routes/reverse-geocode?lat=${lat}&lon=${lng}`);
          const d = await r.json();
          setContextMenu(prev => prev ? { ...prev, address: d.result?.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, loading: false } : null);
        } catch {
          setContextMenu(prev => prev ? { ...prev, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, loading: false } : null);
        }
      });

      // ── Drag → stop following ──
      map.on('dragstart', () => {
        setShowLayerPanel(false);
        setIsFollowing(false);
      });

      // ── Route line click ──
      ['route-unselected', 'route-selected-core', 'route-selected-white'].forEach(layer => {
        map.on('click', layer, (e) => {
          const props = e.features?.[0]?.properties;
          if (props && props.routeIndex != null) {
            dispatch({ type: 'SELECT_ROUTE', payload: props.routeIndex });
            e.stopPropagation?.();
          }
        });
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      });
    });

    return () => {
      // clean up all markers
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ══════════════════════════════════════════════
     LAYER SWITCH
     ══════════════════════════════════════════════ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setStyle(MAP_STYLES[mapLayer]?.style || MAP_STYLES.standard.style);
    // Re-add sources/layers after style change
    map.once('styledata', () => {
      const addIfMissing = (id, config) => { if (!map.getSource(id)) map.addSource(id, config); };
      addIfMissing('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      addIfMissing('completed-path', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      addIfMissing('turn-highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      const addLayerIfMissing = (layerConfig) => { if (!map.getLayer(layerConfig.id)) map.addLayer(layerConfig); };
      addLayerIfMissing({ id: 'route-unselected', type: 'line', source: 'routes', filter: ['==', ['get', 'selected'], false], paint: { 'line-color': '#9aa0a6', 'line-width': 6, 'line-opacity': 0.5, 'line-dasharray': [2, 2] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      addLayerIfMissing({ id: 'route-selected-glow', type: 'line', source: 'routes', filter: ['all', ['==', ['get', 'selected'], true], ['==', ['get', 'completed'], false]], paint: { 'line-color': '#1a73e8', 'line-width': 18, 'line-opacity': 0.3, 'line-blur': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      addLayerIfMissing({ id: 'route-selected-white', type: 'line', source: 'routes', filter: ['all', ['==', ['get', 'selected'], true], ['==', ['get', 'completed'], false]], paint: { 'line-color': '#ffffff', 'line-width': 14, 'line-opacity': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      addLayerIfMissing({ id: 'route-selected-core', type: 'line', source: 'routes', filter: ['all', ['==', ['get', 'selected'], true], ['==', ['get', 'completed'], false]], paint: { 'line-color': ['get', 'color'], 'line-width': 10, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      addLayerIfMissing({ id: 'completed-path-layer', type: 'line', source: 'completed-path', paint: { 'line-color': '#7BAAF7', 'line-width': 8, 'line-opacity': 0.3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      addLayerIfMissing({ id: 'turn-highlight-glow', type: 'line', source: 'turn-highlight', paint: { 'line-color': '#ffffff', 'line-width': 14, 'line-opacity': 0.3, 'line-blur': 3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      addLayerIfMissing({ id: 'turn-highlight-core', type: 'line', source: 'turn-highlight', paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      
      addIfMissing('traffic-zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      addLayerIfMissing({
        id: 'traffic-zones-fill',
        type: 'fill',
        source: 'traffic-zones',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            3, 0.02,
            6, ['*', ['get', 'fillOpacity'], 0.35],
            10, ['*', ['get', 'fillOpacity'], 0.75],
            14, ['get', 'fillOpacity'],
          ],
        }
      });
      addLayerIfMissing({
        id: 'traffic-zones-outline',
        type: 'line',
        source: 'traffic-zones',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.5,
            9, 1,
            14, 2,
          ],
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4, 0.15,
            9, 0.3,
            14, 0.55,
          ],
        }
      });
    });
  }, [mapLayer]);

  /* ══════════════════════════════════════════════
     ROUTE LINES — update GeoJSON source
     ══════════════════════════════════════════════ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getSource('routes')) return;

    const features = [];

    state.routes.forEach(route => {
      if (!route.geometry?.coordinates) return;
      const coords = route.geometry.coordinates; // [[lon,lat],...]
      const selected = route.index === state.selectedRouteIndex;

      if (!selected) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { selected: false, completed: false, color: '#9aa0a6', routeIndex: route.index },
        });
        return;
      }

      // Traffic segmentation for selected route
      const zones = state.trafficZones || [];
      if (zones.length === 0 || !trafficEnabled) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { selected: true, completed: false, color: '#4285f4', routeIndex: route.index },
        });
        return;
      }

      // Segment by traffic zone
      let currentChunk = [coords[0]];
      let currentColor = '#4285f4';
      for (let i = 1; i < coords.length; i++) {
        const [lon1, lat1] = coords[i - 1];
        const [lon2, lat2] = coords[i];
        const midLat = (lat1 + lat2) / 2;
        const midLon = (lon1 + lon2) / 2;
        let segColor = '#4285f4';
        let maxDelay = 1;
        for (const zone of zones) {
          const dist = getDistanceKM(midLat, midLon, zone.lat, zone.lon);
          if (dist <= zone.radiusKm && zone.delayMultiplier > maxDelay) {
            maxDelay = zone.delayMultiplier;
            segColor = TRAFFIC_COLORS[zone.congestionLevel] || '#ea4335';
          }
        }
        if (segColor === currentColor) {
          currentChunk.push(coords[i]);
        } else {
          features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: currentChunk }, properties: { selected: true, completed: false, color: currentColor, routeIndex: route.index } });
          currentChunk = [coords[i - 1], coords[i]];
          currentColor = segColor;
        }
      }
      if (currentChunk.length >= 2) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: currentChunk }, properties: { selected: true, completed: false, color: currentColor, routeIndex: route.index } });
      }
    });

    map.getSource('routes').setData({ type: 'FeatureCollection', features });

    // Update traffic zones
    if (map.getSource('traffic-zones')) {
      const zoneFeatures = trafficEnabled ? (state.trafficZones || []).map(zoneToFeature) : [];
      map.getSource('traffic-zones').setData({ type: 'FeatureCollection', features: zoneFeatures });
    }

    // ── Completed path ──
    const selRoute = state.routes.find(r => r.index === state.selectedRouteIndex);
    if (navigating && navPosition?.progress > 0 && selRoute?.geometry?.coordinates) {
      const allCoords = selRoute.geometry.coordinates;
      const cutoff = Math.floor(navPosition.progress * allCoords.length);
      const doneCoords = allCoords.slice(0, cutoff + 1);
      if (doneCoords.length >= 2 && map.getSource('completed-path')) {
        map.getSource('completed-path').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: doneCoords }, properties: {} }] });
      }
    } else if (map.getSource('completed-path')) {
      map.getSource('completed-path').setData({ type: 'FeatureCollection', features: [] });
    }
  }, [state.routes, state.selectedRouteIndex, state.trafficZones, trafficEnabled, navigating, navPosition?.progress]);

  /* ══════════════════════════════════════════════
     FIT BOUNDS when routes found (non-navigation)
     ══════════════════════════════════════════════ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || navigating) return;

    const pts = [];
    if (state.source) pts.push([state.source.lon, state.source.lat]);
    if (state.destination) pts.push([state.destination.lon, state.destination.lat]);
    stops.forEach(s => pts.push([s.lon, s.lat]));
    state.routes.forEach(r => r.geometry?.coordinates?.forEach(c => pts.push(c)));

    if (pts.length >= 2) {
      const lons = pts.map(p => p[0]);
      const lats = pts.map(p => p[1]);
      const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 900 });
    } else if (pts.length === 1) {
      map.flyTo({ center: pts[0], zoom: 14, duration: 900 });
    }
  }, [state.routes, state.source?.lat, state.source?.lon, state.destination?.lat, state.destination?.lon]);

  /* ══════════════════════════════════════════════
     SMART CAMERA — navigation tracking
     ══════════════════════════════════════════════ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navigating || !navPosition || !isFollowing) return;

    const now = Date.now();
    if (now - lastCameraRef.current < 300) return;
    lastCameraRef.current = now;

    const speedKmh = navPosition.speedKmh ?? 40;
    let baseZoom = speedKmh <= 20 ? 18 : speedKmh <= 50 ? 18 - ((speedKmh - 20) / 30) * 2 : speedKmh <= 80 ? 16 - ((speedKmh - 50) / 30) * 2 : 14;
    const distToTurn = navPosition.distToNextTurn ?? Infinity;
    if (distToTurn < 100) baseZoom = Math.min(19, baseZoom + (1 - distToTurn / 100) ** 2 * 2);
    const currentZoom = map.getZoom();
    const targetZoom = Math.min(19, Math.max(13, baseZoom));
    const easedZoom = currentZoom + (targetZoom - currentZoom) * 0.15;

    const bearing = navPosition.bearing || 0;
    let bearingDiff = bearing - prevBearingRef.current;
    if (bearingDiff > 180) bearingDiff -= 360;
    if (bearingDiff < -180) bearingDiff += 360;
    const smoothBearing = prevBearingRef.current + bearingDiff * 0.2;
    prevBearingRef.current = smoothBearing;

    const bearingRad = (smoothBearing * Math.PI) / 180;
    const lookAhead = 0.0015 / Math.pow(2, easedZoom - 15);
    const targetLon = navPosition.lon + Math.sin(bearingRad) * lookAhead;
    const targetLat = navPosition.lat + Math.cos(bearingRad) * lookAhead;

    map.easeTo({ center: [targetLon, targetLat], zoom: Math.round(easedZoom * 10) / 10, duration: 350, easing: t => t });
  }, [navigating, navPosition, isFollowing]);

  /* ══════════════════════════════════════════════
     MARKERS — managed imperatively
     ══════════════════════════════════════════════ */
  const reverseGeocode = useCallback(async (lat, lon) => {
    try {
      const r = await fetch(`/api/routes/reverse-geocode?lat=${lat}&lon=${lon}`);
      const d = await r.json();
      return d.result || { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
    } catch {
      return { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
    }
  }, []);

  // Helper to get/create a marker
  const upsertMarker = useCallback((key, { lat, lon, html, anchor = 'bottom', draggable = false, onDragEnd, zIndex = 0 }) => {
    const map = mapRef.current;
    if (!map) return;

    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.cssText = `display:flex;align-items:center;justify-content:center;z-index:${zIndex + 1000};`;

    if (markersRef.current[key]) {
      markersRef.current[key].remove();
    }

    const marker = new maplibregl.Marker({ element: el, anchor, draggable })
      .setLngLat([lon, lat])
      .addTo(map);

    if (draggable && onDragEnd) {
      marker.on('dragend', async () => {
        const { lat: newLat, lng: newLon } = marker.getLngLat();
        const result = await reverseGeocode(newLat, newLon);
        onDragEnd({ ...result, lat: newLat, lon: newLon });
      });
    }

    markersRef.current[key] = marker;
    return marker;
  }, [reverseGeocode]);

  const removeMarker = useCallback((key) => {
    if (markersRef.current[key]) {
      markersRef.current[key].remove();
      delete markersRef.current[key];
    }
  }, []);

  // Source marker
  useEffect(() => {
    if (state.source && !navigating) {
      upsertMarker('source', { lat: state.source.lat, lon: state.source.lon, html: makePinHTML('#34a853', 'S'), anchor: 'bottom', draggable: true, onDragEnd: onDragSource, zIndex: 5 });
    } else {
      removeMarker('source');
    }
  }, [state.source, navigating]);

  // Destination marker
  useEffect(() => {
    if (state.destination) {
      upsertMarker('destination', { lat: state.destination.lat, lon: state.destination.lon, html: makePinHTML('#ea4335', 'E'), anchor: 'bottom', draggable: true, onDragEnd: onDragDestination, zIndex: 5 });
    } else {
      removeMarker('destination');
    }
  }, [state.destination]);

  // Stop markers
  useEffect(() => {
    const activeKeys = new Set();
    stops.forEach((s, i) => {
      const key = `stop_${i}`;
      activeKeys.add(key);
      upsertMarker(key, { lat: s.lat, lon: s.lon, html: makePinHTML('#fbbc04', `${i + 1}`), anchor: 'bottom', draggable: true, onDragEnd: (loc) => onDragStop?.(i, loc), zIndex: 4 });
    });
    Object.keys(markersRef.current).filter(k => k.startsWith('stop_') && !activeKeys.has(k)).forEach(removeMarker);
  }, [stops]);

  // GPS user location
  useEffect(() => {
    if (userLocation) {
      upsertMarker('gps', { lat: userLocation.lat, lon: userLocation.lon, html: makeGPSHTML(), anchor: 'center', zIndex: 8 });
    } else {
      removeMarker('gps');
    }
  }, [userLocation]);

  // Navigation vehicle marker
  useEffect(() => {
    if (navigating && navPosition) {
      upsertMarker('vehicle', { lat: navPosition.lat, lon: navPosition.lon, html: makeNavVehicleHTML(navPosition.bearing || 0), anchor: 'center', zIndex: 10 });
    } else {
      removeMarker('vehicle');
    }
  }, [navigating, navPosition?.lat, navPosition?.lon, navPosition?.bearing]);

  // Dropped pin marker
  useEffect(() => {
    if (droppedPin && !contextMenu) {
      upsertMarker('dropped', { lat: droppedPin.lat, lon: droppedPin.lon, html: makeDroppedPinHTML(), anchor: 'bottom', zIndex: 7 });
    } else {
      removeMarker('dropped');
    }
  }, [droppedPin, contextMenu]);

  // Temporary POI markers for category search
  useEffect(() => {
    const activeKeys = new Set();
    poiResults.forEach((place, i) => {
      if (!place.lat || !place.lon) return;
      const key = `poi_${i}`;
      activeKeys.add(key);
      upsertMarker(key, { 
        lat: place.lat, lon: place.lon, 
        html: makePinHTML('#00c853', ''), // small green pin without label
        anchor: 'bottom', 
        zIndex: 3 
      });
    });
    // Remove stale POI
    Object.keys(markersRef.current)
      .filter(k => k.startsWith('poi_') && !activeKeys.has(k))
      .forEach(removeMarker);
      
    // Fit bounds if POI > 0
    if (poiResults.length > 0 && mapRef.current) {
      const lons = poiResults.map(p => p.lon);
      const lats = poiResults.map(p => p.lat);
      const map = mapRef.current;
      map.fitBounds([
         [Math.min(...lons), Math.min(...lats)],
         [Math.max(...lons), Math.max(...lats)]
      ], { padding: 80, maxZoom: 15, duration: 800 });
    }
  }, [poiResults, upsertMarker, removeMarker]);

  /* ══════════════════════════════════════════════
     CONTROLS
     ══════════════════════════════════════════════ */
  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn({ duration: 300 }), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut({ duration: 300 }), []);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // In navigation, this acts as an explicit follow-mode toggle.
    if (navigating) {
      setIsFollowing((prev) => {
        const next = !prev;
        if (next && navPosition) {
          map.flyTo({ center: [navPosition.lon, navPosition.lat], zoom: map.getZoom(), duration: 550 });
        }
        return next;
      });
      return;
    }

    if (userLocation) {
      map.flyTo({ center: [userLocation.lon, userLocation.lat], zoom: 15, duration: 550 });
    } else if (state.source) {
      map.flyTo({ center: [state.source.lon, state.source.lat], zoom: 14, duration: 550 });
    } else if (state.destination) {
      map.flyTo({ center: [state.destination.lon, state.destination.lat], zoom: 14, duration: 550 });
    }
  }, [navigating, navPosition, userLocation, state.source, state.destination]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const result = await reverseGeocode(latitude, longitude);
      onMapSetSource?.({ ...result, lat: latitude, lon: longitude });
      setLocating(false);
    }, () => setLocating(false), { enableHighAccuracy: true, timeout: 10000 });
  }, [reverseGeocode, onMapSetSource]);

  const handleLayerChange = useCallback((layer) => { setMapLayer(layer); setShowLayerPanel(false); }, []);

  /* ══════════════════════════════════════════════
     CONTEXT MENU ACTIONS
     ══════════════════════════════════════════════ */
  const handleDirectionsFrom = useCallback(async () => {
    if (!contextMenu) return;
    const result = await reverseGeocode(contextMenu.lat, contextMenu.lng);
    onMapSetSource?.({ ...result, lat: contextMenu.lat, lon: contextMenu.lng });
    setDroppedPin(null);
  }, [contextMenu, reverseGeocode, onMapSetSource]);

  const handleDirectionsTo = useCallback(async () => {
    if (!contextMenu) return;
    const result = await reverseGeocode(contextMenu.lat, contextMenu.lng);
    onMapSetDestination?.({ ...result, lat: contextMenu.lat, lon: contextMenu.lng });
    setDroppedPin(null);
  }, [contextMenu, reverseGeocode, onMapSetDestination]);

  const handleAddStop = useCallback(async () => {
    if (!contextMenu) return;
    const result = await reverseGeocode(contextMenu.lat, contextMenu.lng);
    onMapAddStop?.({ ...result, lat: contextMenu.lat, lon: contextMenu.lng });
    setDroppedPin(null);
  }, [contextMenu, reverseGeocode, onMapAddStop]);

  const handleSavePlace = useCallback(async (lat, lon, addr) => {
    try {
      const address = addr || (await reverseGeocode(lat, lon)).name;
      const name = address.split(',')[0] || 'Saved Place';
      await addSavedPlace({ name, lat, lon, lng: lon, address });
      toast.success(`Saved: ${name}`);
    } catch {
      toast.error('Failed to save place');
    }
  }, [reverseGeocode]);

  /* ══════════════════════════════════════════════
     DROPPED PIN ACTIONS
     ══════════════════════════════════════════════ */
  const handlePinFrom = useCallback(async () => {
    if (!droppedPin) return;
    const result = await reverseGeocode(droppedPin.lat, droppedPin.lon);
    onMapSetSource?.({ ...result, lat: droppedPin.lat, lon: droppedPin.lon });
    setDroppedPin(null);
  }, [droppedPin, reverseGeocode, onMapSetSource]);

  const handlePinTo = useCallback(async () => {
    if (!droppedPin) return;
    const result = await reverseGeocode(droppedPin.lat, droppedPin.lon);
    onMapSetDestination?.({ ...result, lat: droppedPin.lat, lon: droppedPin.lon });
    setDroppedPin(null);
  }, [droppedPin, reverseGeocode, onMapSetDestination]);

  const handlePinStop = useCallback(async () => {
    if (!droppedPin) return;
    const result = await reverseGeocode(droppedPin.lat, droppedPin.lon);
    onMapAddStop?.({ ...result, lat: droppedPin.lat, lon: droppedPin.lon });
    setDroppedPin(null);
  }, [droppedPin, reverseGeocode, onMapAddStop]);

  /* ══════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════ */
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* MapLibre GL container */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Overlays */}
      <LayerSidePanel
        open={showLayerPanel}
        currentLayer={mapLayer}
        onLayerChange={handleLayerChange}
        trafficEnabled={trafficEnabled}
        onToggleTraffic={() => setTrafficEnabled(p => !p)}
        onLocate={handleLocateMe}
        locating={locating}
        isMobile={isMobile}
      />

      <RightControlStack
        isMobile={isMobile}
        layersOpen={showLayerPanel}
        trafficEnabled={trafficEnabled}
        isFollowing={navigating && isFollowing}
        navigating={navigating}
        onToggleLayers={() => setShowLayerPanel(p => !p)}
        onToggleTraffic={() => setTrafficEnabled(p => !p)}
        onRecenter={handleRecenter}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          coords={{ lat: contextMenu.lat, lng: contextMenu.lng }}
          address={contextMenu.address}
          loading={contextMenu.loading}
          onDirectionsFrom={handleDirectionsFrom}
          onDirectionsTo={handleDirectionsTo}
          onAddStop={handleAddStop}
          onSavePlace={() => handleSavePlace(contextMenu.lat, contextMenu.lng, contextMenu.address)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Dropped pin tooltip */}
      {droppedPin && !contextMenu && (
        <DroppedPinTooltip
          lat={droppedPin.lat}
          lon={droppedPin.lon}
          x={droppedPin.x}
          y={droppedPin.y}
          onFrom={handlePinFrom}
          onTo={handlePinTo}
          onStop={handlePinStop}
          onSave={() => handleSavePlace(droppedPin.lat, droppedPin.lon, '')}
          onClose={() => setDroppedPin(null)}
        />
      )}

      {/* Navigation HUD */}
      {navigating && navPosition && (
        <>
          <NavigationHeader
            currentInstruction={navPosition.currentInstruction}
            nextInstruction={navPosition.nextInstruction}
            distToNextTurn={navPosition.distToNextTurn}
            isMobile={isMobile}
          />
          <SpeedPanel speedKmh={navPosition.speedKmh} isMobile={isMobile} />
          <NavigationFooter
            remainDist={navPosition.remainDist}
            remainTimeSeconds={navPosition.remainTimeSeconds}
            eta={navPosition.eta}
            onExit={() => setIsFollowing(false)}
            vehicleType={vehicleType}
            vehicleOptions={VEHICLE_OPTIONS}
            onVehicleChange={setVehicleType}
            isMobile={isMobile}
          />
        </>
      )}
    </div>
  );
}
