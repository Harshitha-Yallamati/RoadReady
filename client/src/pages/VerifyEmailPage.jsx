import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailWarning, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const { verifyEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing a token.');
      return;
    }

    let active = true;

    const runVerification = async () => {
      try {
        const res = await verifyEmail(token);
        if (!active) return;
        setStatus('success');
        setMessage(res.message || 'Your email has been verified.');
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setMessage(err.response?.data?.error || err.message || 'Could not verify this email.');
      }
    };

    runVerification();
    return () => {
      active = false;
    };
  }, [searchParams, verifyEmail]);

  const isSuccess = status === 'success';
  const isVerifying = status === 'verifying';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 40%), #0f172a',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 28,
          padding: 28,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.14)',
          boxShadow: '0 30px 60px rgba(2, 6, 23, 0.5)',
          color: '#e2e8f0',
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isSuccess
              ? 'rgba(34, 197, 94, 0.12)'
              : isVerifying
                ? 'rgba(59, 130, 246, 0.12)'
                : 'rgba(248, 113, 113, 0.12)',
            color: isSuccess ? '#4ade80' : isVerifying ? '#60a5fa' : '#fda4af',
          }}
        >
          {isVerifying ? <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} /> : isSuccess ? <ShieldCheck size={28} /> : <MailWarning size={28} />}
        </div>

        <h1 style={{ marginTop: 18, fontSize: '2rem', fontWeight: 800 }}>
          {isSuccess ? 'Email Verified' : isVerifying ? 'Checking your link' : 'Verification failed'}
        </h1>
        <p style={{ marginTop: 10, color: '#94a3b8', lineHeight: 1.7 }}>{message}</p>

        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Link
            to="/login"
            style={{
              padding: '12px 18px',
              borderRadius: 14,
              background: '#2563eb',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Go to Login
          </Link>
          <Link
            to="/signup"
            style={{
              padding: '12px 18px',
              borderRadius: 14,
              border: '1px solid rgba(148, 163, 184, 0.18)',
              color: '#cbd5e1',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Back to Sign Up
          </Link>
        </div>

        {isSuccess && (
          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 16,
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.18)',
              color: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CheckCircle2 size={18} />
            Your account is ready for secure sign-in.
          </div>
        )}
      </div>
    </div>
  );
}
