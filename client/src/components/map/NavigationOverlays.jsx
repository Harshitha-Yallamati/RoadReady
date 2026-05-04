// NavigationOverlays — pure React, no map library dependency

function getTurnArrowSvg(type, modifier) {
  const m = (modifier || '').toLowerCase();
  const t = (type || '').toString().toLowerCase();

  if (m.includes('left') || ['0', '2', '4'].includes(t)) {
    return 'M14 6v2.5L9 4.5 14 0v2.5C17.86 2.5 21 5.64 21 9.5c0 3.86-3.14 7-7 7h-4v-2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';
  }

  if (m.includes('right') || ['1', '3', '5'].includes(t)) {
    return 'M14 6v2.5L9 4.5 14 0v2.5C17.86 2.5 21 5.64 21 9.5c0 3.86-3.14 7-7 7h-4v-2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';
  }

  if (m.includes('uturn') || t === '9') {
    return 'M18 11V6c0-3.31-2.69-6-6-6S6 2.69 6 6v5H3l4 4 4-4H8V6c0-2.21 1.79-4 4-4s4 1.79 4 4v5h-3l4 4 4-4h-3z';
  }

  return 'M12 2L8 6h3v14h2V6h3L12 2z';
}

function renderVehicleIcon(type, color) {
  if (type === 'bike') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M6 17l4-7h4l4 7M10 10l2-3h3" />
      </svg>
    );
  }

  if (type === 'walk') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4.5" r="2" />
        <path d="M12 7v5l-3 3M12 12l4 3M9 21l2-4M15 21l-1.5-4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14l2-5h14l2 5v4h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

export function NavigationHeader({ currentInstruction, nextInstruction, distToNextTurn, isMobile = false }) {
  if (!currentInstruction) return null;

  const isUrgent = distToNextTurn < 150;
  const formattedDist = distToNextTurn >= 1000
    ? `${(distToNextTurn / 1000).toFixed(1)} km`
    : `${Math.max(0, Math.floor(distToNextTurn / 10) * 10)} m`;
  const isLeft = (currentInstruction.modifier || '').toLowerCase().includes('left');
  const inset = isMobile ? 10 : 14;
  const iconBox = isMobile ? 40 : 44;
  const arrowSize = isMobile ? 36 : 40;

  return (
    <div
      style={{
        position: 'absolute',
        top: inset,
        left: inset,
        right: inset,
        zIndex: 1300,
        maxWidth: 1180,
        margin: '0 auto',
        background: 'linear-gradient(180deg, #17A968 0%, #109958 100%)',
        borderRadius: isMobile ? 14 : 16,
        boxShadow: '0 6px 18px rgba(0,0,0,0.24)',
        color: 'white',
        padding: isMobile ? '10px 12px' : '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 8 : 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14 }}>
        <div
          style={{
            width: iconBox,
            height: iconBox,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isUrgent ? 'turnPulse 1.5s infinite' : 'none',
          }}
        >
            <svg
            viewBox="0 0 24 24"
            width={arrowSize}
            height={arrowSize}
            fill="#fff"
            style={{
              transform: isLeft ? 'scale(-1, 1)' : 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
            }}
          >
            <path d={getTurnArrowSvg(currentInstruction.type, currentInstruction.modifier)} />
          </svg>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: isMobile ? (isUrgent ? 24 : 22) : (isUrgent ? 28 : 24),
              fontWeight: 800,
              lineHeight: 1,
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            {formattedDist}
          </div>
          <div
            style={{
              fontSize: isMobile ? 14 : 15,
              fontWeight: 600,
              marginTop: 3,
              opacity: 0.95,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentInstruction.instruction}
          </div>
        </div>
      </div>

      {nextInstruction && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.2)',
            paddingTop: isMobile ? 8 : 9,
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: isMobile ? 12 : 13,
            fontWeight: 500,
            opacity: 0.9,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={isMobile ? 15 : 16}
            height={isMobile ? 15 : 16}
            fill="#fff"
            style={{
              transform: (nextInstruction.modifier || '').toLowerCase().includes('left') ? 'scale(-1, 1)' : 'none',
              flexShrink: 0,
            }}
          >
            <path d={getTurnArrowSvg(nextInstruction.type, nextInstruction.modifier)} />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Then {nextInstruction.instruction}
          </span>
        </div>
      )}
    </div>
  );
}

export function NavigationFooter({
  remainDist,
  remainTimeSeconds,
  eta,
  onExit,
  vehicleType = 'car',
  vehicleOptions = [],
  onVehicleChange,
  isMobile = false,
}) {
  const formattedRemain = remainDist >= 1000
    ? `${(remainDist / 1000).toFixed(1)} km`
    : `${Math.round(remainDist)} m`;
  const mins = Math.ceil((remainTimeSeconds || 0) / 60);
  const formattedETA = mins > 60
    ? `${Math.floor(mins / 60)} hr ${mins % 60} min`
    : `${mins} min`;
  const iconSize = isMobile ? 34 : 40;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isMobile ? 6 : 8,
        left: isMobile ? 8 : 10,
        right: isMobile ? 8 : 10,
        zIndex: 1200,
        background: '#fff',
        maxWidth: 1260,
        margin: '0 auto',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
        padding: isMobile ? '10px 10px 12px' : '12px 14px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: isMobile ? 102 : 124 }}>
        {vehicleOptions.map((option) => {
          const selected = option.id === vehicleType;
          return (
            <button
              key={option.id}
              onClick={() => onVehicleChange?.(option.id)}
              title={option.label}
              style={{
                width: iconSize,
                height: iconSize,
                borderRadius: '50%',
                border: selected ? '2px solid #1a73e8' : '1px solid rgba(0,0,0,0.12)',
                background: selected ? '#E8F0FE' : '#F1F3F4',
                color: selected ? '#1a73e8' : '#3c4043',
                fontSize: isMobile ? 16 : 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {renderVehicleIcon(option.id, selected ? '#1a73e8' : '#3c4043')}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        <div
          style={{
            fontSize: isMobile ? 30 : 34,
            fontWeight: 700,
            color: mins < 5 ? '#0F9D58' : mins > 60 ? '#EA4335' : '#E37400',
            lineHeight: 1,
            letterSpacing: '-0.4px',
          }}
        >
          {formattedETA}
        </div>
        <div style={{ fontSize: isMobile ? 13 : 14, color: '#5F6368', fontWeight: 500, marginTop: 2 }}>
          {formattedRemain} - {eta || '--:--'}
        </div>
      </div>

      <div style={{ minWidth: isMobile ? 38 : 44, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onExit}
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: '50%',
            background: '#F1F3F4',
            border: '1px solid rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#3C4043',
          }}
          title="Route overview"
        >
          <svg viewBox="0 0 24 24" width={isMobile ? 20 : 22} height={isMobile ? 20 : 22} fill="currentColor">
            <path d="M17.5,10.5L14,7V9.5C12.39,9.5 10.16,9.9 8.28,10.9L6.81,9.43C8.42,8.04 10.66,7.5 14,7.5V5L17.5,8.5L14,12V10.5M10.42,13.06C11.45,12.55 12.6,12.33 14,12.33V14.5L17.5,11L16.27,9.77L14.77,11.27L15,11.5L15.23,11.27C14.07,11.47 12.63,11.75 11.29,12.5C9.6,13.46 8.24,14.93 7.31,16.89C7.4,17.41 7.6,17.91 7.9,18.36L6.5,19.76C6.18,19 6,18.17 6,17.29C6,16.5 6.13,15.75 6.36,15.05L7.76,16.45C7.62,16.71 7.5,17 7.5,17.3C7.5,18.12 7.74,18.88 8.16,19.5L9.63,18.03C9.37,17.65 9.2,17.22 9.12,16.74L10.42,13.06Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function FloatingTurnLabel({ instruction, isVisible }) {
  // This component is intentionally kept minimal — the map handles turn overlays
  // via GeoJSON layers. This label is shown in the navigation header instead.
  if (!isVisible || !instruction) return null;
  return null;
}

export function SpeedPanel({ speedKmh, isMobile = false }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: isMobile ? 96 : 108,
        left: isMobile ? 10 : 16,
        zIndex: 1190,
        background: 'white',
        borderRadius: 10,
        border: '1.5px solid #ccc',
        boxShadow: '0 3px 7px rgba(0,0,0,0.18)',
        width: isMobile ? 48 : 52,
        height: isMobile ? 54 : 58,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: '#333', lineHeight: 1.1 }}>
        {speedKmh}
      </div>
      <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, color: '#666' }}>km/h</div>
    </div>
  );
}
