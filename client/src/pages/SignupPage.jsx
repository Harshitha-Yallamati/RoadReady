import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Brain, CheckCircle2, Eye, EyeOff, Lock, Mail, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';
import './SignupPage.css';

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, registerWithEmail, loginWithGoogle } = useAuth();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState(1);
  const [createdAccount, setCreatedAccount] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [strength, setStrength] = useState(0);

  useEffect(() => {
    if (isAuthenticated) navigate('/planner');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const password = formData.password;
    let nextStrength = 0;
    if (password.length >= 8) nextStrength += 1;
    if (password.length >= 12) nextStrength += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) nextStrength += 1;
    if (/\d/.test(password)) nextStrength += 1;
    setStrength(nextStrength);
  }, [formData.password]);

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    setStep(2);
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast.success('Successfully registered via Google!');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Google registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await registerWithEmail(
        formData.name.trim(),
        formData.email.trim(),
        formData.password,
      );

      setCreatedAccount({
        email: formData.email.trim(),
        previewUrl: result.verificationPreviewUrl || '',
      });
      toast.success('Account created. Verify your email to continue.');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (createdAccount) {
    return (
      <div className="login-container">
        <div className="login-sidebar">
          <motion.div
            className="login-card-wrapper signup-wrapper"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="login-card">
              <div className="login-header">
                <div className="login-logo">
                  <div className="logo-icon-wrap">
                    <Brain className="logo-icon" />
                    <div className="logo-ring" />
                  </div>
                  <h1>VERIFY <span>YOUR EMAIL</span></h1>
                </div>
                <p className="login-subtitle">One quick verification step and your new account is ready.</p>
              </div>

              <div
                style={{
                  padding: '1rem',
                  borderRadius: 18,
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: '#dcfce7',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>Verification sent to</div>
                <div style={{ marginTop: 6, fontSize: '0.92rem', color: '#bbf7d0' }}>{createdAccount.email}</div>
                <p style={{ marginTop: 12, fontSize: '0.84rem', color: '#d1fae5', lineHeight: 1.6 }}>
                  Open the email link to activate your account, then sign in normally.
                </p>
                {createdAccount.previewUrl && (
                  <a
                    href={createdAccount.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', marginTop: 10, color: '#93c5fd', fontSize: '0.82rem', wordBreak: 'break-word' }}
                  >
                    Open development verification link
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: '1.1rem' }}>
                <button
                  type="button"
                  className="login-submit-btn"
                  style={{ marginTop: 0 }}
                  onClick={() => navigate('/login')}
                >
                  Go to Login
                  <ArrowRight size={18} />
                </button>
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
                Your account is almost<br />ready to navigate
              </h2>
              <div className="feature-item"><CheckCircle2 size={20} className="feature-icon" /><span>Protected with hashed passwords</span></div>
              <div className="feature-item"><CheckCircle2 size={20} className="feature-icon" /><span>Verified email before first login</span></div>
              <div className="feature-item"><CheckCircle2 size={20} className="feature-icon" /><span>Session restore across page refreshes</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-sidebar">
        <motion.div
          className="login-card-wrapper signup-wrapper"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="login-card">
            <div className="login-header">
              <div className="login-logo">
                <div className="logo-icon-wrap">
                  <Brain className="logo-icon" />
                  <div className="logo-ring" />
                </div>
                <h1>JOIN AI SMART <span>ROUTER</span></h1>
              </div>
              <p className="login-subtitle">Create your account and keep your routes, saved places, and profile in sync.</p>
            </div>

            <div className="signup-steps">
              {[1, 2].map((currentStep) => (
                <div key={currentStep} className={`signup-step ${step >= currentStep ? 'active' : ''}`}>
                  <div className="step-dot">{step > currentStep ? '✓' : currentStep}</div>
                  <span>{currentStep === 1 ? 'Your Info' : 'Secure Access'}</span>
                </div>
              ))}
              <div className="step-line" style={{ width: step === 2 ? '100%' : '0%' }} />
            </div>

            <button 
              type="button" 
              onClick={handleGoogleSignup} 
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
              Sign up with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ padding: '0 12px' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.form
                  key="step1"
                  className="login-form"
                  onSubmit={handleStep1}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="input-group">
                    <label>Full Name</label>
                    <div className="input-row">
                      <User size={18} className="input-icon" />
                      <input
                        type="text"
                        placeholder="Alex Johnson"
                        required
                        autoFocus
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                  </div>

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

                  <button type="submit" className="login-submit-btn">
                    Continue
                    <ArrowRight size={18} />
                  </button>
                </motion.form>
              )}

              {step === 2 && (
                <motion.form
                  key="step2"
                  className="login-form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className="input-group">
                    <label>Password</label>
                    <div className="input-row">
                      <Lock size={18} className="input-icon" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 chars, with upper/lowercase and a number"
                        required
                        autoFocus
                        value={formData.password}
                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                        style={{ paddingRight: '2.8rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim, #64748b)', padding: 4 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {formData.password && (
                      <div className="strength-bar-wrap">
                        {[1, 2, 3, 4].map((idx) => (
                          <div
                            key={idx}
                            className="strength-segment"
                            style={{ background: idx <= strength ? strengthColor[strength] : 'rgba(255,255,255,0.08)' }}
                          />
                        ))}
                        <span style={{ fontSize: 11, color: strengthColor[strength] }}>
                          {strengthLabel[strength]}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label>Confirm Password</label>
                    <div className="input-row">
                      <Shield size={18} className="input-icon" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat your password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        style={{
                          paddingRight: '2.8rem',
                          borderColor: formData.confirmPassword && formData.password !== formData.confirmPassword
                            ? '#ef4444'
                            : formData.confirmPassword && formData.password === formData.confirmPassword
                              ? '#22c55e'
                              : undefined,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((prev) => !prev)}
                        style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim, #64748b)', padding: 4 }}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={{
                        padding: '0.875rem',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      ←
                    </button>
                    <button type="submit" className="login-submit-btn" style={{ flex: 1, marginTop: 0 }} disabled={loading}>
                      {loading ? <div className="btn-loader" /> : <>Create Account <ArrowRight size={18} /></>}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="login-footer">
              <p>
                Already have an account?
                <Link to="/login" className="toggle-auth-btn" style={{ display: 'inline', marginLeft: 6, fontWeight: 700 }}>
                  Sign in
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
              Join the future of<br />navigation with <span style={{ color: '#6366f1' }}>AI</span>
            </h2>
            <div className="feature-item"><CheckCircle2 size={20} className="feature-icon" /><span>Email-verified account security</span></div>
            <div className="feature-item"><CheckCircle2 size={20} className="feature-icon" /><span>JWT sessions that persist cleanly</span></div>
            <div className="feature-item"><CheckCircle2 size={20} className="feature-icon" /><span>Saved places and history tied to your profile</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
