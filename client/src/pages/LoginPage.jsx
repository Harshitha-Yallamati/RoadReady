import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, CheckCircle2, Lock, Mail, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithEmail, loginWithGoogle, resendVerificationEmail } = useAuth();

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [needsVerification, setNeedsVerification] = useState(false);
  const [previewLink, setPreviewLink] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/planner');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNeedsVerification(false);
    setPreviewLink('');

    try {
      const user = await loginWithEmail(formData.email.trim(), formData.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/planner');
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Login failed';
      const requiresVerification = Boolean(err.response?.data?.requiresVerification);

      if (requiresVerification) {
        setNeedsVerification(true);
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/planner');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      const res = await resendVerificationEmail(formData.email.trim());
      setPreviewLink(res.verificationPreviewUrl || '');
      toast.success('Verification email sent');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-sidebar">
        <motion.div
          className="login-card-wrapper"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="login-card">
            <div className="login-header">
              <div className="login-logo">
                <div className="logo-icon-wrap">
                  <Brain className="logo-icon" />
                  <div className="logo-ring" />
                </div>
                <h1>AI SMART <span>ROUTER</span></h1>
              </div>
              <p className="login-subtitle">Sign in with your verified email to restore your routes and saved places.</p>
            </div>

            <button 
              type="button" 
              onClick={handleGoogleLogin} 
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#fff',
                color: '#3c4043',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                marginBottom: '1.25rem',
                transition: 'all 0.2s',
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18, height: 18 }} />
              Sign in with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ padding: '0 12px' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Email Address</label>
                <div className="input-row">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Password</label>
                <div className="input-row">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Enter your password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <div className="btn-loader" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {needsVerification && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.95rem 1rem',
                  borderRadius: 16,
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.18)',
                  color: '#cbd5f5',
                }}
              >
                <div style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 6 }}>Email verification still pending</div>
                <div style={{ fontSize: '0.83rem', lineHeight: 1.5, color: '#a5b4fc' }}>
                  Open the verification link we sent before signing in. If you need a fresh one, resend it below.
                </div>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    padding: '0.8rem 1rem',
                    borderRadius: 14,
                    border: '1px solid rgba(129, 140, 248, 0.28)',
                    background: 'rgba(129, 140, 248, 0.12)',
                    color: '#e0e7ff',
                    fontWeight: 700,
                    cursor: resending ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {resending ? <div className="btn-loader" /> : <RefreshCw size={16} />}
                  Resend Verification Email
                </button>
                {previewLink && (
                  <a
                    href={previewLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', marginTop: 12, color: '#93c5fd', fontSize: '0.8rem', wordBreak: 'break-word' }}
                  >
                    Open development verification link
                  </a>
                )}
              </div>
            )}

            <div className="login-footer">
              <p>
                New to RoadReady?
                <Link to="/signup" className="toggle-auth-btn" style={{ display: 'inline', marginLeft: 6, fontWeight: 700 }}>
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="login-right-pane">
        <div className="login-bg-grid" />
        <div className="login-glow login-glow-1" />
        <div className="login-glow login-glow-2" />

        <div className="right-pane-content">
          <div className="login-features">
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginBottom: '1.5rem' }}>
              Smarter navigation<br />with a persistent account
            </h2>
            <div className="feature-item">
              <CheckCircle2 size={20} className="feature-icon" />
              <span>JWT sessions that survive refreshes</span>
            </div>
            <div className="feature-item">
              <CheckCircle2 size={20} className="feature-icon" />
              <span>MongoDB-backed saved places and route history</span>
            </div>
            <div className="feature-item">
              <CheckCircle2 size={20} className="feature-icon" />
              <span>Verified email login with secure password hashing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
