import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, History, LogOut, Map, Navigation2, Sparkles, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const displayName = user?.name || user?.email || 'U';
  const initials = displayName.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();

  const photoURL = user?.photoURL;
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <nav
        style={{
          width: 84,
          height: '100%',
          background: 'var(--panel)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 0',
          zIndex: 1000,
          position: 'relative',
          boxShadow: '2px 0 12px rgba(0,0,0,0.1)',
        }}
      >
        <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', marginBottom: 32, gap: 4 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 18px rgba(37,99,235,0.35)',
            }}
          >
            <Navigation2 style={{ width: 20, height: 20, color: 'white' }} />
          </div>
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', alignItems: 'center', flex: 1 }}>
          {[
            { path: '/planner', label: 'Planner', icon: Map },
            { path: '/history', label: 'History', icon: History },
            { path: '/saved', label: 'Saved', icon: Bookmark },
            { path: '/profile', label: 'Profile', icon: UserCircle2 },
            { path: '/ai-suggestions', label: 'AI', icon: Sparkles },
          ].map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                title={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 7,
                  padding: '12px 0',
                  width: 64,
                  borderRadius: 18,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  background: active ? 'linear-gradient(180deg, rgba(59,130,246,0.2), rgba(14,165,233,0.1))' : 'transparent',
                  color: active ? '#93c5fd' : 'var(--text-dim)',
                  border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                }}
              >
                <Icon style={{ width: 21, height: 21 }} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{label}</span>
              </Link>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 4 }}>
          <div
            title={displayName}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: photoURL ? 'transparent' : 'linear-gradient(135deg,#1d4ed8,#0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: `2px solid ${user?.emailVerified ? 'rgba(74,222,128,0.35)' : 'rgba(251,191,36,0.35)'}`,
              fontSize: 14,
              fontWeight: 800,
              color: '#fff',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {photoURL
              ? <img src={photoURL} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
            <span
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: user?.emailVerified ? '#4ade80' : '#fbbf24',
                boxShadow: '0 0 0 2px rgba(15,23,42,0.95)',
              }}
            />
          </div>

          <button
            onClick={() => setConfirmingLogout(true)}
            title="Sign out"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-dim)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <LogOut style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </nav>

      {confirmingLogout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.72)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 24,
              padding: 22,
              color: 'var(--text)',
              boxShadow: '0 30px 60px rgba(2,6,23,0.45)',
            }}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>Sign out?</div>
            <p style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Your current session will end on this device. Your saved places and route history will still be available when you sign back in.
            </p>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setConfirmingLogout(false)}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--panel-alt)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#fda4af',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
