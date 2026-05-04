import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Navigation, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const radius = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const lambda = toRad(lon2 - lon1);

  const y = Math.sin(lambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);

  const angle = toDeg(Math.atan2(y, x));
  return (angle + 360) % 360;
}

function projectToSegment(point, start, end) {
  const scaleX = Math.max(1, 111320 * Math.cos((point.lat * Math.PI) / 180));
  const scaleY = 110540;

  const px = point.lon * scaleX;
  const py = point.lat * scaleY;
  const ax = start.lon * scaleX;
  const ay = start.lat * scaleY;
  const bx = end.lon * scaleX;
  const by = end.lat * scaleY;

  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;

  if (ab2 <= 0.000001) {
    const dx = px - ax;
    const dy = py - ay;
    return { t: 0, distance: Math.hypot(dx, dy) };
  }

  const apx = px - ax;
  const apy = py - ay;
  const rawT = (apx * abx + apy * aby) / ab2;
  const t = Math.min(1, Math.max(0, rawT));

  const cx = ax + abx * t;
  const cy = ay + aby * t;

  return {
    t,
    distance: Math.hypot(px - cx, py - cy),
  };
}

function fmtDist(meters = 0) {
  if (!Number.isFinite(meters)) return '--';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(meters))} m`;
}

function fmtTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return '--';
  const totalMin = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
}

export default function NavigationPanel({ route, onPositionUpdate, onClose, assistantSlot = null }) {
  const [isTracking, setIsTracking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [navMode, setNavMode] = useState('sim');
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedDistance, setElapsedDistance] = useState(0);
  const [remainDistance, setRemainDistance] = useState(0);
  const [remainTimeSeconds, setRemainTimeSeconds] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [eta, setEta] = useState('--:--');
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [simDist, setSimDist] = useState(0);
  const [panelTab, setPanelTab] = useState('details');

  const watchIdRef = useRef(null);
  const prevPointRef = useRef(null);
  const lastSpokenStepRef = useRef(-1);

  const directions = route?.directions || [];
  const totalDistance = route?.distance || 0;
  const totalDuration = route?.adjustedDuration || route?.duration || 0;

  const polyline = useMemo(() => {
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    const segments = [];
    let cumulative = 0;

    for (let i = 1; i < coords.length; i += 1) {
      const start = { lon: coords[i - 1][0], lat: coords[i - 1][1] };
      const end = { lon: coords[i][0], lat: coords[i][1] };
      const length = haversineMeters(start.lat, start.lon, end.lat, end.lon);
      segments.push({ start, end, length, cumulativeStart: cumulative });
      cumulative += length;
    }

    return { segments, total: cumulative };
  }, [route?.geometry?.coordinates]);

  const directionCumulative = useMemo(() => {
    const values = [];
    let running = 0;
    for (const step of directions) {
      running += Number(step?.distance) || 0;
      values.push(running);
    }
    return values;
  }, [directions]);

  const updateNavigationState = useCallback((coords) => {
    if (!polyline || polyline.segments.length === 0) return;

    const point = { lat: coords.latitude, lon: coords.longitude };

    let bestMatch = null;
    for (const segment of polyline.segments) {
      const projection = projectToSegment(point, segment.start, segment.end);
      if (!bestMatch || projection.distance < bestMatch.distance) {
        bestMatch = { ...projection, segment };
      }
    }

    if (!bestMatch) return;

    const traveled = bestMatch.segment.cumulativeStart + bestMatch.segment.length * bestMatch.t;
    const progressValue = polyline.total > 0 ? Math.min(1, Math.max(0, traveled / polyline.total)) : 0;
    const remaining = Math.max(0, polyline.total - traveled);
    const remainingTime =
      totalDistance > 0 && totalDuration > 0
        ? Math.round((remaining / totalDistance) * totalDuration)
        : Math.max(0, Math.round((1 - progressValue) * totalDuration));

    let heading = computeBearing(
      bestMatch.segment.start.lat,
      bestMatch.segment.start.lon,
      bestMatch.segment.end.lat,
      bestMatch.segment.end.lon,
    );

    const speedFromSensor = Number(coords.speed);
    let speed = Number.isFinite(speedFromSensor) && speedFromSensor >= 0
      ? Math.round(speedFromSensor * 3.6)
      : 0;

    const previous = prevPointRef.current;
    if (previous) {
      const deltaDistance = haversineMeters(previous.lat, previous.lon, point.lat, point.lon);
      const deltaSeconds = Math.max(0.001, (Date.now() - previous.time) / 1000);
      if (speed === 0) speed = Math.round((deltaDistance / deltaSeconds) * 3.6);
      if (deltaDistance >= 3) {
        heading = computeBearing(previous.lat, previous.lon, point.lat, point.lon);
      }
    }
    prevPointRef.current = { ...point, time: Date.now() };

    let stepIdx = 0;
    while (stepIdx < directionCumulative.length && traveled > directionCumulative[stepIdx]) {
      stepIdx += 1;
    }
    stepIdx = Math.min(stepIdx, Math.max(0, directions.length - 1));

    const distToNext =
      directionCumulative.length > 0
        ? Math.max(
            0,
            (directionCumulative[stepIdx] || directionCumulative[directionCumulative.length - 1]) - traveled,
          )
        : 0;

    const arrival = new Date(Date.now() + remainingTime * 1000);
    const etaText = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setCurrentStepIdx(stepIdx);
    setProgress(progressValue);
    setElapsedDistance(traveled);
    setRemainDistance(remaining);
    setRemainTimeSeconds(remainingTime);
    setSpeedKmh(Math.max(0, speed));
    setEta(etaText);
    setDistanceToTurn(distToNext);

    onPositionUpdate?.({
      lat: point.lat,
      lon: point.lon,
      bearing: heading,
      progress: progressValue,
      currentStepIdx: stepIdx,
      distToNextTurn: distToNext,
      elapsedDistance: traveled,
      speedKmh: Math.max(0, speed),
      remainDist: remaining,
      remainTimeSeconds: remainingTime,
      eta: etaText,
      currentInstruction: directions[stepIdx] || null,
      nextInstruction: directions[stepIdx + 1] || null,
    });
  }, [polyline, totalDistance, totalDuration, directionCumulative, directions, onPositionUpdate]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (navMode === 'sim') {
      setIsTracking(true);
      return;
    }
    if (!navigator.geolocation) {
      setGpsError('GPS is not supported in this browser.');
      return;
    }
    if (watchIdRef.current != null) return;

    setGpsError('');
    const id = navigator.geolocation.watchPosition(
      (position) => {
        updateNavigationState(position.coords);
        setIsTracking(true);
      },
      (error) => {
        if (error.code === 1) {
          setGpsError('Location permission denied. Please allow GPS access.');
        } else if (error.code === 2) {
          setGpsError('Unable to read current location.');
        } else if (error.code === 3) {
          setGpsError('Location request timed out.');
        } else {
          setGpsError('GPS update failed.');
        }
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
    );

    watchIdRef.current = id;
  }, [updateNavigationState, navMode]);

  useEffect(() => {
    if (navMode !== 'sim' || !isTracking || !polyline) return undefined;

    const interval = setInterval(() => {
      setSimDist((prev) => {
        const next = prev + (40 / 3.6);
        if (next >= polyline.total) {
          clearInterval(interval);
          return polyline.total;
        }

        for (const segment of polyline.segments) {
          if (next >= segment.cumulativeStart && next <= segment.cumulativeStart + segment.length) {
            const segmentT = segment.length > 0 ? (next - segment.cumulativeStart) / segment.length : 0;
            const lat = segment.start.lat + (segment.end.lat - segment.start.lat) * segmentT;
            const lon = segment.start.lon + (segment.end.lon - segment.start.lon) * segmentT;
            updateNavigationState({ latitude: lat, longitude: lon, speed: 11.1 });
            break;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navMode, isTracking, polyline, updateNavigationState]);

  useEffect(() => {
    startTracking();
    return () => {
      stopTracking();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [startTracking, stopTracking]);

  useEffect(() => {
    if (!assistantSlot && panelTab === 'assistant') {
      setPanelTab('details');
    }
  }, [assistantSlot, panelTab]);

  useEffect(() => {
    if (isMuted || !isTracking || !directions[currentStepIdx]) return;
    if (currentStepIdx === lastSpokenStepRef.current) return;

    lastSpokenStepRef.current = currentStepIdx;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(directions[currentStepIdx].instruction || 'Continue on route');
      utter.rate = 1;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
    }
  }, [currentStepIdx, directions, isMuted, isTracking]);

  const currentStep = directions[currentStepIdx];
  const nextStep = directions[currentStepIdx + 1];
  const completionPercent = Math.round(progress * 100);
  const visibleSteps = directions.slice(currentStepIdx);

  if (!route?.geometry?.coordinates || route.geometry.coordinates.length < 2) {
    return (
      <div style={{ padding: 16, color: 'var(--text-dim)' }}>
        No route geometry available for navigation.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: 16,
          background: 'linear-gradient(180deg, rgba(24, 76, 149, 0.95), rgba(16, 48, 101, 0.92))',
          color: '#fff',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Navigation style={{ width: 18, height: 18 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>Navigation</div>
              <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.8)' }}>
                {route.summary || 'Current route'}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              stopTracking();
              onClose?.();
            }}
            title="Close navigation"
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              borderRadius: 10,
              width: 34,
              height: 34,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: '#dbeafe' }}>
            {currentStep?.instruction || 'Waiting for GPS update...'}
          </div>

          <div style={{ display: 'inline-flex', borderRadius: 10, background: 'rgba(0,0,0,0.24)', padding: 3, flexShrink: 0 }}>
            <button
              onClick={() => { stopTracking(); setNavMode('sim'); setSimDist(0); }}
              style={{
                padding: '7px 12px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                background: navMode === 'sim' ? '#fff' : 'transparent',
                color: navMode === 'sim' ? '#111' : '#fff',
              }}
            >
              Simulate
            </button>
            <button
              onClick={() => { stopTracking(); setNavMode('live'); }}
              style={{
                padding: '7px 12px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                background: navMode === 'live' ? '#fff' : 'transparent',
                color: navMode === 'live' ? '#111' : '#fff',
              }}
            >
              Live GPS
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'details', label: 'Route Details' },
          { id: 'directions', label: 'Directions' },
          ...(assistantSlot ? [{ id: 'assistant', label: 'AI Assistant' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPanelTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: panelTab === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
              color: panelTab === tab.id ? 'var(--blue)' : 'var(--text-muted)',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            minHeight: 0,
            display: panelTab === 'details' ? 'flex' : 'none',
            flexDirection: 'column',
          }}
        >
          <div className="planner-navigation-scroll" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                border: '1px solid rgba(59,130,246,0.18)',
                background: 'linear-gradient(180deg, rgba(37,99,235,0.14), rgba(15,23,42,0.82))',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#93c5fd' }}>
                Current maneuver
              </div>
              <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45 }}>
                {currentStep?.instruction || 'Waiting for GPS update...'}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
                Next turn in {fmtDist(distanceToTurn)}
              </div>
              {nextStep && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
                  Then: {nextStep.instruction}
                </div>
              )}
            </div>

            {gpsError && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>{gpsError}</span>
              </div>
            )}

            <div className="planner-navigation-metrics">
              {[
                { label: 'Remaining', value: fmtDist(remainDistance), meta: route.summary || 'Current route' },
                { label: 'ETA', value: fmtTime(remainTimeSeconds), meta: eta },
                { label: 'Speed', value: `${speedKmh} km/h`, meta: navMode === 'live' ? 'Sensor/GPS' : 'Simulation' },
                { label: 'Traveled', value: fmtDist(elapsedDistance), meta: `${completionPercent}% complete` },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: 'var(--panel-alt)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
                  <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{item.value}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>{item.meta}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Trip progress</div>
                <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>{completionPercent}%</div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  width: '100%',
                  height: 10,
                  borderRadius: 999,
                  background: 'rgba(148,163,184,0.14)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, completionPercent))}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #2563eb, #0ea5e9)',
                  }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {fmtDist(totalDistance)} total distance • {fmtTime(totalDuration)} total duration
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {isTracking ? (
                <button
                  onClick={stopTracking}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: '#f59e0b',
                    color: '#111827',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Pause style={{ width: 16, height: 16 }} /> Pause GPS
                </button>
              ) : (
                <button
                  onClick={startTracking}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: '#22c55e',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Play style={{ width: 16, height: 16 }} /> Start GPS
                </button>
              )}

              <button
                onClick={() => {
                  setIsMuted((prev) => !prev);
                  if (!isMuted && typeof window !== 'undefined' && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                }}
                title={isMuted ? 'Unmute voice' : 'Mute voice'}
                style={{
                  width: 48,
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  background: 'var(--panel-alt)',
                  color: isMuted ? '#f87171' : 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isMuted ? <VolumeX style={{ width: 16, height: 16 }} /> : <Volume2 style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            height: '100%',
            minHeight: 0,
            display: panelTab === 'directions' ? 'flex' : 'none',
            flexDirection: 'column',
          }}
        >
          <div className="planner-navigation-scroll">
            <div
              style={{
                margin: 18,
                padding: 16,
                borderRadius: 18,
                border: '1px solid rgba(148,163,184,0.12)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(15,23,42,0.58))',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#60a5fa' }}>
                Current step
              </div>
              <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: '#f8fafc', lineHeight: 1.45 }}>
                {currentStep?.instruction || 'Waiting for guidance'}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
                {fmtDist(currentStep?.distance || 0)} remaining in this maneuver
              </div>
            </div>

            <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleSteps.map((step, idx) => (
                <div
                  key={`${step.instruction}-${currentStepIdx + idx}`}
                  className={`planner-navigation-step${idx === 0 ? ' planner-navigation-step--current' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: idx === 0 ? 'rgba(37,99,235,0.18)' : 'rgba(148,163,184,0.12)',
                            color: idx === 0 ? '#93c5fd' : '#cbd5e1',
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          {idx === 0 ? 'Now' : idx === 1 ? 'Next' : `Step ${currentStepIdx + idx + 1}`}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: idx === 0 ? 700 : 600, color: '#f8fafc', lineHeight: 1.55 }}>
                        {step.instruction}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                      {fmtDist(step.distance)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            height: '100%',
            minHeight: 0,
            display: panelTab === 'assistant' ? 'flex' : 'none',
            flexDirection: 'column',
          }}
        >
          {assistantSlot ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              {assistantSlot}
            </div>
          ) : (
            <div className="planner-navigation-scroll" style={{ padding: 18, color: 'var(--text-muted)' }}>
              Assistant unavailable for this route.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
