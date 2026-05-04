import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, CheckCircle2, Clock3, Mail, MapPin, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, refreshProfile, updateProfile, resendVerificationEmail } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    photoURL: user?.photoURL || '',
  });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || '',
      photoURL: user?.photoURL || '',
    });
  }, [user?.name, user?.photoURL]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
      toast.success('Profile refreshed');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not refresh profile');
    } finally {
      setRefreshing(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await resendVerificationEmail(user.email);
      if (res.verificationPreviewUrl) {
        window.open(res.verificationPreviewUrl, '_blank', 'noopener,noreferrer');
      }
      toast.success('Verification email sent');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not resend verification email');
    } finally {
      setResending(false);
    }
  };

  const stats = user?.stats || {};

  return (
    <div style={{ minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1020, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div
          style={{
            display: 'grid',
            gap: 18,
            padding: 22,
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(15,23,42,0.92))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  background: user?.photoURL
                    ? `center / cover no-repeat url(${user.photoURL})`
                    : 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 28,
                }}
              >
                {!user?.photoURL ? (user?.name || 'U').slice(0, 1).toUpperCase() : null}
              </div>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: '#93c5fd' }}>Profile</div>
                <h1 style={{ marginTop: 6, fontSize: '2rem', fontWeight: 800 }}>{user?.name || 'Your account'}</h1>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#cbd5e1' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={14} />
                    {user?.email}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: user?.emailVerified ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)',
                      color: user?.emailVerified ? '#86efac' : '#fcd34d',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    {user?.emailVerified ? 'Email verified' : 'Verification pending'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                height: 'fit-content',
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.06)',
                color: '#dbeafe',
                fontWeight: 700,
                cursor: refreshing ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RefreshCw size={16} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
              Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <StatCard icon={<Bookmark size={18} />} label="Saved Places" value={stats.savedPlacesCount ?? 0} />
            <StatCard icon={<MapPin size={18} />} label="Route History" value={stats.historyCount ?? 0} />
            <StatCard
              icon={<Clock3 size={18} />}
              label="Joined"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '--'}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }}>
          <form
            onSubmit={handleSave}
            style={{
              padding: 22,
              borderRadius: 22,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              display: 'grid',
              gap: 16,
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>Edit Profile</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Update your visible profile info across the planner.</p>
            </div>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Full Name</span>
              <input
                className="input-field"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your full name"
              />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Photo URL</span>
              <input
                className="input-field"
                value={form.photoURL}
                onChange={(e) => setForm((prev) => ({ ...prev, photoURL: e.target.value }))}
                placeholder="https://example.com/avatar.jpg"
              />
            </label>

            <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content' }}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div
            style={{
              padding: 22,
              borderRadius: 22,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              display: 'grid',
              gap: 14,
              alignContent: 'start',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>Quick Actions</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Jump straight into the parts of the app you use most.</p>
            </div>

            <ActionLink to="/planner" icon={<MapPin size={16} />} label="Open Planner" />
            <ActionLink to="/saved" icon={<Bookmark size={16} />} label="Manage Saved Places" />
            <ActionLink to="/history" icon={<Clock3 size={16} />} label="Browse Route History" />

            {!user?.emailVerified && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  color: '#fde68a',
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: resending ? 'default' : 'pointer',
                }}
              >
                {resending ? 'Sending verification...' : 'Resend Verification Email'}
              </button>
            )}

            <div
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.16)',
                color: '#bfdbfe',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Your saved places, route history, and chat experience now follow your signed-in account instead of a temporary browser session.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: 'rgba(15, 23, 42, 0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'inline-flex', color: '#93c5fd' }}>{icon}</div>
      <div style={{ marginTop: 10, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>{value}</div>
      <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 13 }}>{label}</div>
    </div>
  );
}

function ActionLink({ to, icon, label }) {
  return (
    <Link
      to={to}
      style={{
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'var(--panel-alt)',
        color: 'var(--text)',
        textDecoration: 'none',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ color: '#93c5fd' }}>{icon}</span>
      {label}
    </Link>
  );
}
