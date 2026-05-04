import { startTransition, useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, MapPin, Plus, X, Loader2, Navigation, ChevronRight, Clock, Route as RouteIcon, ArrowRight, CornerDownRight, CornerUpRight, TrendingUp, RotateCcw, Play, Crosshair, Grip } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoute } from '../context/RouteContext';
import { optimizeRoute, refreshRoute, optimizeMultiStop, geocodePlace, saveHistory, getHistory } from '../services/api';
import MapView from '../components/map/MapView';
import NavigationPanel from '../components/NavigationPanel';
import AIAssistantPanel from '../components/AIAssistantPanel';
import useNavigationAI from '../hooks/useNavigationAI';
import { useAIChat } from '../context/AIChatContext';

/* ══════════════════════════════════════════════
   Location Input Component
   ══════════════════════════════════════════════ */
function LocationInput({ placeholder, value, onChange, onClear, color = 'var(--blue)', onLocateMe }) {
  const [query, setQuery] = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const ref = useRef(null);

  useEffect(() => { if (value?.name && value.name !== query) setQuery(value.name); }, [value]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.length >= 3) {
      setLoading(true);
      timer.current = setTimeout(async () => {
        try {
          const res = await geocodePlace(v);
          setSuggestions(res.data.results || []);
          setShow(true);
        } catch { setSuggestions([]); }
        setLoading(false);
      }, 400);
    } else { setSuggestions([]); setShow(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 10, width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}40` }} />
        <input className="input-field" style={{ paddingLeft: 28, paddingRight: value ? 56 : onLocateMe ? 36 : 12 }}
          placeholder={placeholder} value={query} onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setShow(true)} />
        {loading && <Loader2 style={{ position: 'absolute', right: value ? 32 : onLocateMe ? 32 : 10, width: 14, height: 14, color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />}
        {!value && onLocateMe && (
          <button onClick={onLocateMe} title="Use my location"
            style={{ position: 'absolute', right: 6, padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#8ab4f8'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--blue)'}>
            <Crosshair style={{ width: 14, height: 14 }} />
          </button>
        )}
        {value && onClear && (
          <button onClick={() => { setQuery(''); onChange(null); if (onClear) onClear(); }}
            style={{ position: 'absolute', right: 6, padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
      {show && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--panel)',
          border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { setQuery(s.name); onChange(s); setShow(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', textAlign: 'left', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', transition: 'background 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(66,133,244,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <MapPin style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Direction Step Component
   ══════════════════════════════════════════════ */
function DirectionStep({ step, idx, isLast }) {
  const getIcon = (type, modifier) => {
    if (type === 'depart') return '🚗';
    if (type === 'arrive') return '🏁';
    if (type === 'turn' && modifier?.includes('left')) return '↰';
    if (type === 'turn' && modifier?.includes('right')) return '↱';
    if (type === 'roundabout') return '🔄';
    if (type === 'fork') return '⑂';
    return '→';
  };
  const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;

  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)', fontSize: 12 }}>
      <span style={{ width: 22, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>
        {getIcon(step.type, step.modifier)}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--text)', lineHeight: 1.4 }}>{step.instruction}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
          {fmtDist(step.distance)} · {step.remainingDistance != null ? `${fmtDist(step.remainingDistance)} left` : ''}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   AI Assistant Panel Wrapper — connects hook to UI
   ══════════════════════════════════════════════ */
function AIAssistantPanelWrapper({
  source, destination, currentRoute, navigating, weather, allRoutes,
  latestSwitchSuggestion, onAcceptSwitch, onDismissSwitch,
  variant = 'grid',
}) {
  const ai = useNavigationAI({
    source,
    destination,
    currentRoute,
    navigating,
    trafficLevel: currentRoute?.trafficLevel || null,
    trafficScore: currentRoute?.trafficScore || 0,
    weather,
    switchSuggestion: latestSwitchSuggestion,
    allRoutes,
  });

  const handleAccept = useCallback(() => {
    const suggestion = ai.acceptSuggestion();
    if (suggestion && onAcceptSwitch) onAcceptSwitch(suggestion);
  }, [ai, onAcceptSwitch]);

  const handleDismiss = useCallback(() => {
    ai.dismissSuggestion();
    if (onDismissSwitch) onDismissSwitch();
  }, [ai, onDismissSwitch]);

  return (
    <AIAssistantPanel
      messages={ai.messages}
      images={ai.images}
      isThinking={ai.isThinking}
      pendingSuggestion={ai.pendingSuggestion}
      imagesLoading={ai.imagesLoading}
      imageError={ai.imageError}
      historyLoading={ai.historyLoading}
      historyError={ai.historyError}
      onSendMessage={ai.sendMessage}
      onAcceptSwitch={handleAccept}
      onDismissSwitch={handleDismiss}
      variant={variant}
      source={source}
      destination={destination}
      currentRoute={currentRoute}
      weather={weather}
      navigating={navigating}
    />
  );
}

/* ══════════════════════════════════════════════
   PLANNER PAGE — MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function PlannerPage() {
  const { state, dispatch } = useRoute();
  const { images: routeImages, imagesLoading: routeImagesLoading, imageError: routeImageError } = useAIChat();
  const { routeId } = useParams(); // Dynamic routing: /planner/:routeId
  const [stops, setStops] = useState([]);
  const [multiResult, setMultiResult] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [tab, setTab] = useState('routes');
  const [directionsRoute, setDirectionsRoute] = useState(null);
  // Navigation state
  const [navigating, setNavigating] = useState(false);
  const [navPosition, setNavPosition] = useState(null);
  // GPS location
  const [userLocation, setUserLocation] = useState(null);
  // Panel collapsed on mobile
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // Auto-recalculate flag
  const autoRecalcRef = useRef(false);
  // Dynamic refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshIntervalRef = useRef(null);
  const [latestSwitchSuggestion, setLatestSwitchSuggestion] = useState(null);

  const isMultiStop = stops.length > 0;
  const selectedRoute = state.routes.find((route) => route.index === state.selectedRouteIndex) || null;
  const activeRoute = directionsRoute || selectedRoute || state.routes[0] || null;

  // ── Dynamic Route Loading: restore route from history via URL param ──
  useEffect(() => {
    if (!routeId) return;

    const loadRouteFromHistory = async () => {
      try {
        const res = await getHistory();
        const history = res.data?.history || [];
        const entry = history.find((h) => h._id === routeId);
        if (!entry) { return; }

        // Restore source/destination from history entry
        if (entry.source) dispatch({ type: 'SET_SOURCE', payload: entry.source });
        if (entry.destination) dispatch({ type: 'SET_DESTINATION', payload: entry.destination });
        if (entry.preference) dispatch({ type: 'SET_PREFERENCE', payload: entry.preference });

        // Auto-calculate after restoring
        if (entry.source && entry.destination) {
          autoRecalcRef.current = true;
        }

        toast.success('Route loaded from history 📍', { duration: 2500 });
      } catch {
        // Silently ignore — route might not exist yet
      }
    };

    loadRouteFromHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // ── Dynamic Refresh (every 20 sec) ──
  useEffect(() => {
    if (autoRefresh && state.source && state.destination && state.routes.length > 0 && !isMultiStop) {
      refreshIntervalRef.current = setInterval(async () => {
        try {
          const res = await refreshRoute({
            source: state.source,
            destination: state.destination,
            preference: state.preference,
            currentRouteIndex: state.selectedRouteIndex,
          });
          const routes = Array.isArray(res.data?.routes) ? res.data.routes : [];
          const selectedRouteIndex = routes.some((route) => route.index === state.selectedRouteIndex)
            ? state.selectedRouteIndex
            : res.data?.bestRouteIndex ?? routes[0]?.index ?? null;
          dispatch({
            type: 'SET_RESULTS',
            payload: {
              ...res.data,
              selectedRouteIndex,
            },
          });
          const refreshedRoute = routes.find((route) => route.index === selectedRouteIndex) || routes[0] || null;
          setDirectionsRoute(refreshedRoute);
          setLatestSwitchSuggestion(res.data?.switchSuggestion || null);
          toast.success('🔄 Route refreshed (traffic updated)', { duration: 2000 });
        } catch {}
      }, 20000);
      return () => clearInterval(refreshIntervalRef.current);
    } else {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    }
  }, [autoRefresh, state.source, state.destination, state.preference, state.routes.length, state.selectedRouteIndex, isMultiStop, dispatch]);
  const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  const fmtTime = (s) => { const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m} min`; };
  const preferenceLabels = {
    fastest: 'Fastest',
    shortest: 'Shortest',
    avoid_tolls: 'No Tolls',
    avoid_highways: 'No Highways',
  };

  const applyRouteResponse = useCallback((data, { selectBest = false } = {}) => {
    const routes = Array.isArray(data?.routes) ? data.routes : [];
    const nextSelectedIndex = selectBest
      ? data?.bestRouteIndex ?? routes[0]?.index ?? null
      : routes.some((route) => route.index === state.selectedRouteIndex)
        ? state.selectedRouteIndex
        : data?.bestRouteIndex ?? routes[0]?.index ?? null;

    dispatch({
      type: 'SET_RESULTS',
      payload: {
        ...data,
        selectedRouteIndex: nextSelectedIndex,
      },
    });

    const nextRoute = routes.find((route) => route.index === nextSelectedIndex) || routes[0] || null;
    setDirectionsRoute(nextRoute);
    setLatestSwitchSuggestion(data?.switchSuggestion || null);
    return nextRoute;
  }, [dispatch, state.selectedRouteIndex]);

  const persistRouteHistory = useCallback(async (data, preference, selectedRoute) => {
    if (!state.source || !state.destination || !selectedRoute) {
      return;
    }

    try {
      await saveHistory({
        source: state.source,
        destination: state.destination,
        preference,
        selectedRoute,
        alternativeRoutes: Array.isArray(data?.routes) ? data.routes.slice(1, 3) : [],
        weatherCondition: data?.weather?.condition || '',
        aiExplanation: data?.explanation?.summary || '',
      });
    } catch {
      // History sync should not block the planner.
    }
  }, [state.source, state.destination]);

  const handlePositionUpdate = useCallback((pos) => { setNavPosition(pos); }, []);

  const handleAssistantAccept = useCallback((suggestion) => {
    const nextRoute = state.routes.find((route) => route.index === suggestion?.proposedRouteIndex);
    if (nextRoute) {
      dispatch({ type: 'SELECT_ROUTE', payload: suggestion.proposedRouteIndex });
      setDirectionsRoute(nextRoute);
      toast.success('Switched to faster route!');
    }
    setLatestSwitchSuggestion(null);
  }, [dispatch, state.routes]);

  const handleAssistantDismiss = useCallback(() => {
    setLatestSwitchSuggestion(null);
  }, []);

  const startNavigation = useCallback(() => {
    const route = activeRoute;
    if (!route?.geometry?.coordinates) return toast.error('Find a route first');
    setDirectionsRoute(route);
    setNavigating(true);
  }, [activeRoute]);

  // ── Find Route (A → B) ──
  const handleFindRoute = useCallback(async () => {
    if (!state.source || !state.destination) return toast.error('Enter source and destination');
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await optimizeRoute({
        source: state.source,
        destination: state.destination,
        preference: state.preference,
        currentRouteIndex: null,
      });
      const selectedRoute = applyRouteResponse(res.data, { selectBest: true });
      setTab('routes');
      setNavigating(false);
      setNavPosition(null);
      toast.success(`${res.data.routes.length} route${res.data.routes.length > 1 ? 's' : ''} found`);
      await persistRouteHistory(res.data, state.preference, selectedRoute);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || err.message });
      toast.error(err.response?.data?.error || 'Failed to find routes');
    }
  }, [state.source, state.destination, state.preference, dispatch, applyRouteResponse, persistRouteHistory]);

  const handlePreferenceChange = useCallback(async (nextPreference) => {
    if (state.preference === nextPreference) {
      return;
    }

    startTransition(() => {
      dispatch({ type: 'SET_PREFERENCE', payload: nextPreference });
    });

    if (!state.source || !state.destination || isMultiStop) {
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const res = await optimizeRoute({
        source: state.source,
        destination: state.destination,
        preference: nextPreference,
        currentRouteIndex: null,
      });
      const selectedRoute = applyRouteResponse(res.data, { selectBest: true });
      setTab('routes');
      setNavigating(false);
      setNavPosition(null);
      toast.success(`Updated routes for ${preferenceLabels[nextPreference] || nextPreference}`);
      await persistRouteHistory(res.data, nextPreference, selectedRoute);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || err.message });
      toast.error(err.response?.data?.error || 'Failed to update route preference');
    }
  }, [
    state.preference,
    state.source,
    state.destination,
    isMultiStop,
    dispatch,
    applyRouteResponse,
    preferenceLabels,
    persistRouteHistory,
  ]);

  // ── Optimize Multi-Stop ──
  const handleMultiOptimize = useCallback(async () => {
    if (!state.source) return toast.error('Enter start location');
    if (!state.destination) return toast.error('Enter end location');
    const valid = stops.filter(s => s.lat);
    if (valid.length === 0) return toast.error('Add at least 1 intermediate stop');
    setMultiLoading(true); setMultiResult(null);
    try {
      const res = await optimizeMultiStop({ source: state.source, destination: state.destination, stops: valid });
      setMultiResult(res.data);
      if (res.data.geometry) {
        const routeObj = { index: 0, distance: res.data.totalDistance, duration: res.data.totalDuration,
          estimatedCost: Math.round(res.data.totalDistance / 1000 * 6.5), score: 0, isBest: true,
          summary: 'Optimized Route', geometry: res.data.geometry, adjustedDuration: res.data.totalDuration,
          directions: res.data.directions || [] };
        dispatch({ type: 'SET_RESULTS', payload: {
          routes: [routeObj], bestRouteIndex: 0,
          explanation: { summary: res.data.explanation?.summary || '' },
        }});
        setDirectionsRoute(routeObj);
      }
      setTab('multi');
      setNavigating(false);
      setNavPosition(null);
      toast.success(`Optimized! Saved ${fmtDist(res.data.distanceSaved)}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Optimization failed'); }
    setMultiLoading(false);
  }, [state.source, state.destination, stops, dispatch]);

  // ── Auto-recalculate when source/destination changes via map interaction ──
  useEffect(() => {
    if (autoRecalcRef.current && state.source && state.destination) {
      autoRecalcRef.current = false;
      const timer = setTimeout(() => {
        if (isMultiStop) {
          const valid = stops.filter(s => s.lat);
          if (valid.length > 0) handleMultiOptimize();
          else handleFindRoute();
        } else {
          handleFindRoute();
        }
      }, 600); // Small debounce
      return () => clearTimeout(timer);
    }
  }, [state.source, state.destination]);

  // ── GPS: Get My Location ──
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return toast.error('GPS not supported');
    toast.loading('Getting your location...', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const resp = await fetch(`/api/routes/reverse-geocode?lat=${latitude}&lon=${longitude}`);
          const data = await resp.json();
          const loc = { ...data.result, lat: latitude, lon: longitude };
          dispatch({ type: 'SET_SOURCE', payload: loc });
          setUserLocation({ lat: latitude, lon: longitude });
          toast.success('Location set as start', { id: 'gps' });
        } catch {
          const loc = { name: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, lat: latitude, lon: longitude };
          dispatch({ type: 'SET_SOURCE', payload: loc });
          setUserLocation({ lat: latitude, lon: longitude });
          toast.success('Location set', { id: 'gps' });
        }
      },
      () => toast.error('Could not get location', { id: 'gps' }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [dispatch]);

  // ── Swap source/destination ──
  const handleSwapLocations = useCallback(() => {
    const src = state.source;
    const dst = state.destination;
    dispatch({ type: 'SET_SOURCE', payload: dst });
    dispatch({ type: 'SET_DESTINATION', payload: src });
    if (src && dst) {
      autoRecalcRef.current = true;
    }
  }, [state.source, state.destination, dispatch]);

  // ── Map Interaction Callbacks ──
  const handleMapSetSource = useCallback((loc) => {
    dispatch({ type: 'SET_SOURCE', payload: loc });
    autoRecalcRef.current = !!state.destination;
    toast.success(`Start: ${loc.name?.split(',').slice(0, 2).join(',') || 'Set'}`, { duration: 2000 });
  }, [dispatch, state.destination]);

  const handleMapSetDestination = useCallback((loc) => {
    dispatch({ type: 'SET_DESTINATION', payload: loc });
    autoRecalcRef.current = !!state.source;
    toast.success(`End: ${loc.name?.split(',').slice(0, 2).join(',') || 'Set'}`, { duration: 2000 });
  }, [dispatch, state.source]);

  const handleMapAddStop = useCallback((loc) => {
    if (stops.length >= 8) return toast.error('Maximum 8 stops');
    setStops(prev => [...prev, loc]);
    toast.success(`Stop added: ${loc.name?.split(',').slice(0, 2).join(',') || 'New stop'}`, { duration: 2000 });
  }, [stops.length]);

  const handleDragSource = useCallback((loc) => {
    dispatch({ type: 'SET_SOURCE', payload: loc });
    autoRecalcRef.current = !!state.destination;
    toast('Start point moved', { icon: '📍', duration: 1500 });
  }, [dispatch, state.destination]);

  const handleDragDestination = useCallback((loc) => {
    dispatch({ type: 'SET_DESTINATION', payload: loc });
    autoRecalcRef.current = !!state.source;
    toast('End point moved', { icon: '📍', duration: 1500 });
  }, [dispatch, state.source]);

  const handleDragStop = useCallback((idx, loc) => {
    setStops(prev => {
      const ns = [...prev];
      ns[idx] = loc;
      return ns;
    });
    toast(`Stop ${idx + 1} moved`, { icon: '📍', duration: 1500 });
  }, []);

  return (
    <div className="planner-layout" style={{ height: 'calc(100vh - 48px)', display: 'flex', minHeight: 0 }}>
      {/* ══════════════════════════════════════════════
          LEFT PANEL
         ══════════════════════════════════════════════ */}
      <div className="planner-side-panel" style={{
        width: panelCollapsed ? 0 : navigating ? 'min(420px, 100%)' : undefined, flexShrink: 0, background: 'var(--panel)',
        borderRight: panelCollapsed ? 'none' : '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* If navigating, show tabbed navigation panel */}
        {navigating && activeRoute ? (
          <NavigationPanel
            route={activeRoute}
            onPositionUpdate={handlePositionUpdate}
            onClose={() => { setNavigating(false); setNavPosition(null); }}
            assistantSlot={(
              <AIAssistantPanelWrapper
                source={state.source}
                destination={state.destination}
                currentRoute={activeRoute}
                navigating={navigating}
                weather={state.weather}
                allRoutes={state.routes}
                latestSwitchSuggestion={latestSwitchSuggestion}
                variant="compact"
                onAcceptSwitch={handleAssistantAccept}
                onDismissSwitch={handleAssistantDismiss}
              />
            )}
          />
        ) : (
          <>
            {/* Search Section */}
            <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
                  {/* Locations column */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <LocationInput placeholder="Start location..." value={state.source}
                      onChange={(v) => dispatch({ type: 'SET_SOURCE', payload: v })}
                      onClear={() => dispatch({ type: 'SET_SOURCE', payload: null })}
                      color="#34a853" onLocateMe={handleLocateMe} />

                    {stops.map((stop, i) => (
                      <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <LocationInput placeholder={`Stop ${i + 1}...`} value={stop.lat ? stop : null} color="#fbbc04"
                            onChange={(v) => { const ns = [...stops]; ns[i] = v || { name: '', lat: null, lon: null }; setStops(ns); }}
                            onClear={() => setStops(stops.filter((_, j) => j !== i))} />
                        </div>
                      </div>
                    ))}

                    <LocationInput placeholder="Destination..." value={state.destination}
                      onChange={(v) => dispatch({ type: 'SET_DESTINATION', payload: v })}
                      onClear={() => dispatch({ type: 'SET_DESTINATION', payload: null })}
                      color="#ea4335" />
                  </div>

                  {/* Swap button */}
                  {(state.source || state.destination) && (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                      <button onClick={handleSwapLocations} title="Swap locations"
                        style={{
                          width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
                          background: 'var(--panel-alt)', color: 'var(--text-muted)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s', fontSize: 14,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        ⇅
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={() => { if (stops.length < 8) setStops([...stops, { name: '', lat: null, lon: null }]); }}
                  style={{ width: '100%', padding: '8px', marginTop: 8, background: 'none', border: '1px dashed var(--border)',
                    borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.2s', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  <Plus style={{ width: 14, height: 14 }} /> Add stop
                </button>

                {/* Route Preference Pills */}
                {!isMultiStop && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {[
                      { v: 'fastest', l: '⚡ Fastest' }, { v: 'shortest', l: '📏 Shortest' },
                      { v: 'avoid_tolls', l: '🚫 No Tolls' }, { v: 'avoid_highways', l: '🛣️ No Highways' },
                    ].map(p => (
                      <button key={p.v} onClick={() => handlePreferenceChange(p.v)} disabled={state.loading}
                        style={{ flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: 'none',
                          cursor: state.loading ? 'default' : 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                          opacity: state.loading && state.preference !== p.v ? 0.6 : 1,
                          background: state.preference === p.v ? 'var(--blue-dim)' : 'var(--panel-alt)',
                          color: state.preference === p.v ? 'var(--blue)' : 'var(--text-muted)' }}>
                        {state.loading && state.preference === p.v ? 'Updating...' : p.l}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  {isMultiStop ? (
                    <button className="btn-green" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={handleMultiOptimize} disabled={multiLoading || !state.source || !state.destination}>
                      {multiLoading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Optimizing...</>
                       : <><RouteIcon style={{ width: 14, height: 14 }} /> Optimize {stops.filter(s=>s.lat).length + 2}-Stop Route</>}
                    </button>
                  ) : (
                    <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={handleFindRoute} disabled={state.loading || !state.source || !state.destination}>
                      {state.loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Finding routes...</>
                       : <><Navigation style={{ width: 14, height: 14 }} /> Find Route</>}
                    </button>
                  )}
                  {state.routes.length > 0 && (
                    <button onClick={startNavigation} title="Start Navigation"
                      style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#34a853',
                        color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                      <Play style={{ width: 14, height: 14 }} /> Navigate
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center', opacity: 0.7 }}>
                  💡 Right-click on map to set points · Drag pins to move
                </div>
              </div>

            {/* Results Tabs */}
            {true && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {[
                  { id: 'routes', label: 'Routes' },
                  { id: 'directions', label: 'Directions' },
                  ...(multiResult ? [{ id: 'multi', label: 'Optimization' }] : []),
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 500, border: 'none', background: 'none',
                      cursor: 'pointer', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                      color: tab === t.id ? 'var(--blue)' : 'var(--text-muted)', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tab Content */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
              {state.error && (
                <div style={{
                  marginBottom: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.28)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#fca5a5',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}>
                  {state.error}
                </div>
              )}

              {/* Routes Tab */}
              {tab === 'routes' && state.routes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {state.routes.map((route, idx) => (
                    <div key={idx} onClick={() => { dispatch({ type: 'SELECT_ROUTE', payload: route.index }); setDirectionsRoute(route); }}
                      style={{ padding: 12, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                        background: state.selectedRouteIndex === route.index ? 'var(--blue-dim)' : 'var(--panel-alt)',
                        border: `1px solid ${state.selectedRouteIndex === route.index ? 'var(--blue)' : 'var(--border)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{route.summary || `Route ${idx + 1}`}</span>
                          {route.isBest && (
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                              background: 'var(--green-dim)', color: 'var(--green)' }}>Best</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Distance</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtDist(route.distance)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Time</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtTime(route.adjustedDuration || route.duration)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cost</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>₹{route.estimatedCost}</div>
                        </div>
                      </div>
                      {/* Traffic indicator */}
                      {route.trafficLevel && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%',
                            background: route.trafficLevel === 'heavy' ? '#ef4444' : route.trafficLevel === 'moderate' ? '#f59e0b' : '#22c55e' }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {route.trafficLevel} traffic
                            {route.trafficDelay > 0 && ` (+${Math.round(route.trafficDelay / 60)} min)`}
                          </span>
                          {route.dataSource && (
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto', opacity: 0.6 }}>
                              {route.dataSource}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {state.explanation?.summary && (
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', border: '1px solid var(--border)', marginTop: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>AI Analysis</div>
                      <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{state.explanation.summary}</p>
                    </div>
                  )}

                  {(routeImagesLoading || routeImages.length > 0 || routeImageError) && (
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', border: '1px solid var(--border)', marginTop: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Street-Level Images
                      </div>

                      {routeImagesLoading && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading nearby route imagery...</div>
                      )}

                      {!routeImagesLoading && routeImages.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {routeImages.slice(0, 4).map((image) => (
                            <a key={image.id || image.url} href={image.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                              <img
                                src={image.url}
                                alt="Route street view"
                                loading="lazy"
                                style={{
                                  width: '100%',
                                  height: 92,
                                  objectFit: 'cover',
                                  borderRadius: 10,
                                  border: '1px solid rgba(148,163,184,0.16)',
                                }}
                              />
                            </a>
                          ))}
                        </div>
                      )}

                      {!routeImagesLoading && routeImages.length === 0 && routeImageError && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{routeImageError}</div>
                      )}
                    </div>
                  )}

                  {/* Dynamic Refresh Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px',
                    borderRadius: 8, background: autoRefresh ? 'rgba(34,197,94,0.08)' : 'var(--panel-alt)',
                    border: `1px solid ${autoRefresh ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, marginTop: 6 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: autoRefresh ? '#22c55e' : 'var(--text-dim)' }}>
                        🔄 Dynamic Refresh {autoRefresh ? 'ON' : 'OFF'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Auto-updates route every 20s</div>
                    </div>
                    <button onClick={() => setAutoRefresh(!autoRefresh)}
                      style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                        background: autoRefresh ? '#22c55e' : 'var(--border)', color: autoRefresh ? '#fff' : 'var(--text-muted)' }}>
                      {autoRefresh ? 'Stop' : 'Start'}
                    </button>
                  </div>
                </div>
              )}

              {/* Directions Tab */}
              {tab === 'directions' && activeRoute?.directions && (
                <div>
                  <div style={{ padding: 10, borderRadius: 8, background: 'var(--blue-dim)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmtTime(activeRoute.duration)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDist(activeRoute.distance)}</div>
                    </div>
                    <button onClick={startNavigation}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#34a853',
                        color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Play style={{ width: 12, height: 12 }} /> Start
                    </button>
                  </div>
                  <div>
                    {activeRoute.directions.map((step, i) => (
                      <DirectionStep key={i} step={step} idx={i} isLast={i === activeRoute.directions.length - 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-Stop Optimization Tab */}
              {tab === 'multi' && multiResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {multiResult.distanceSaved > 0 && (
                    <div style={{ padding: 12, borderRadius: 8, background: 'var(--green-dim)', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>Saved {fmtDist(multiResult.distanceSaved)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                        {multiResult.improvement}% shorter · {fmtTime(multiResult.timeSaved)} faster · {multiResult.method}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Distance</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtDist(multiResult.totalDistance)}</div>
                    </div>
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Time</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtTime(multiResult.totalDuration)}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Optimized Visit Order</div>
                    {multiResult.optimizedSequence?.map((stop, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}>
                        {i < multiResult.optimizedSequence.length - 1 && (
                          <div style={{ position: 'absolute', left: 9, top: 22, width: 2, height: 'calc(100% - 4px)', background: 'var(--border)' }} />
                        )}
                        <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, zIndex: 1,
                          background: stop.isStart ? 'var(--green)' : stop.isEnd ? 'var(--red)' : 'var(--amber)',
                          color: stop.isStart || stop.isEnd ? 'white' : '#1a1d27' }}>
                          {stop.isStart ? 'S' : stop.isEnd ? 'E' : i}
                        </div>
                        <div style={{ flex: 1, paddingBottom: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{stop.name?.split(',').slice(0, 2).join(',')}</div>
                          {stop.distToNext > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>↓ {fmtDist(stop.distToNext)} · {fmtTime(stop.timeToNext)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {multiResult.algorithmComparison && (
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Algorithm Comparison</div>
                      {[
                        { label: 'Your order', val: multiResult.algorithmComparison.original, c: 'var(--text-muted)' },
                        { label: 'Nearest Neighbor', val: multiResult.algorithmComparison.nearestNeighbor, c: 'var(--amber)' },
                        { label: '2-opt Optimized', val: multiResult.algorithmComparison.twoOpt, c: 'var(--green)' },
                        ...(multiResult.algorithmComparison.osrm ? [{ label: 'OSRM TSP', val: multiResult.algorithmComparison.osrm, c: 'var(--blue)' }] : []),
                      ].map((a, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                          <span style={{ color: a.c }}>{a.label}</span>
                          <span style={{ color: 'var(--text-dim)' }}>{fmtDist(a.val.distance)} · {fmtTime(a.val.duration)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {multiResult.explanation?.summary && (
                    <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>🧠 Why this order?</div>
                      <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{multiResult.explanation.summary}</p>
                      {multiResult.explanation.moves?.map((m, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 6 }}>
                          <span style={{ color: 'var(--amber)' }}>→</span> <span>{m.stop}: {m.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {state.routes.length === 0 && !multiResult && !state.loading && !multiLoading && (
                <div style={{ textAlign: 'center', paddingTop: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>Plan your route</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
                    Type locations above<br />
                    or <strong style={{ color: 'var(--blue)' }}>right-click the map</strong> to drop pins
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20, padding: '0 12px' }}>
                    {[
                      { icon: '📍', text: 'Click map to drop a pin' },
                      { icon: '🖱️', text: 'Right-click for quick actions' },
                      { icon: '✋', text: 'Drag markers to reposition' },
                      { icon: '🛰️', text: 'Switch map layers (satellite, terrain)' },
                    ].map((tip, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                        background: 'var(--panel-alt)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                        <span style={{ fontSize: 16 }}>{tip.icon}</span>
                        <span>{tip.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              Routes: OpenRouteService · Maps: OpenStreetMap · AI: Weighted Scoring · Live
            </div>
          </>
        )}
      </div>

      {/* Panel toggle (for when collapsed) */}
      {panelCollapsed && (
        <button onClick={() => setPanelCollapsed(false)}
          style={{ position: 'absolute', top: 60, left: 10, zIndex: 800,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(26,29,39,0.92)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#e4e6ed', fontSize: 18 }}>
          ☰
        </button>
      )}

      {/* ══════════════════════════════════════════════
          MAP AREA
         ══════════════════════════════════════════════ */}
      <div className="planner-map-column" style={{ flex: 1, position: 'relative' }}>
        <MapView
          stops={stops.filter(s => s.lat)}
          multiResult={multiResult}
          navPosition={navPosition}
          navigating={navigating}
          onMapSetSource={handleMapSetSource}
          onMapSetDestination={handleMapSetDestination}
          onMapAddStop={handleMapAddStop}
          onDragSource={handleDragSource}
          onDragDestination={handleDragDestination}
          onDragStop={handleDragStop}
          userLocation={userLocation}
        />
      </div>

      {!navigating && (
        <aside className="planner-assistant-column">
          <div className="planner-assistant-column__content">
            <AIAssistantPanelWrapper
              source={state.source}
              destination={state.destination}
              currentRoute={activeRoute}
              navigating={navigating}
              weather={state.weather}
              allRoutes={state.routes}
              latestSwitchSuggestion={latestSwitchSuggestion}
              variant="grid"
              onAcceptSwitch={handleAssistantAccept}
              onDismissSwitch={handleAssistantDismiss}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
