import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getCurrentUser,
  loginUser,
  loginWithGoogleRequest,
  logoutUser,
  registerUser,
  resendVerification,
  updateProfile as updateProfileRequest,
  verifyEmailToken,
} from '../services/api';
import {
  clearAuthSession,
  getStoredToken,
  getStoredUser,
  persistAuthSession,
} from '../utils/authStorage';
import { auth as firebaseAuth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);

    if (nextToken && nextUser) {
      persistAuthSession({ token: nextToken, user: nextUser });
      return;
    }

    clearAuthSession();
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await getCurrentUser();
    const nextUser = res.data?.user || null;
    setUser(nextUser);

    const storedToken = getStoredToken();
    if (storedToken && nextUser) {
      persistAuthSession({ token: storedToken, user: nextUser });
    }

    return nextUser;
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (active) setLoading(false);
        return;
      }

      try {
        const nextUser = await refreshProfile();
        if (active) {
          setToken(storedToken);
          setUser(nextUser);
        }
      } catch {
        if (active) {
          handleSession(null, null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    bootstrap();

    const handleUnauthorized = () => {
      handleSession(null, null);
      toast.error('Your session expired. Please sign in again.');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:unauthorized', handleUnauthorized);
    }
    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:unauthorized', handleUnauthorized);
      }
    };
  }, [handleSession, refreshProfile]);

  const loginWithEmail = useCallback(async (email, password) => {
    const res = await loginUser({ email, password });
    const nextToken = res.data?.token;
    const nextUser = res.data?.user || null;

    handleSession(nextToken, nextUser);
    return nextUser;
  }, [handleSession]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await result.user.getIdToken(true);
      const res = await loginWithGoogleRequest(idToken);
      
      const nextToken = res.data?.token;
      const nextUser = res.data?.user || null;
      handleSession(nextToken, nextUser);
      return nextUser;
    } catch (err) {
      console.error('Google Signin Error:', err);
      throw err;
    }
  }, [handleSession]);

  const registerWithEmail = useCallback(async (name, email, password, photoURL = '') => {
    const res = await registerUser({ name, email, password, photoURL });
    return res.data;
  }, []);

  const verifyEmail = useCallback(async (verificationToken) => {
    const res = await verifyEmailToken(verificationToken);
    return res.data;
  }, []);

  const resendVerificationEmail = useCallback(async (email) => {
    const res = await resendVerification(email);
    return res.data;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const res = await updateProfileRequest(payload);
    const nextUser = res.data?.user || null;
    const storedToken = getStoredToken();

    setUser(nextUser);
    if (storedToken && nextUser) {
      persistAuthSession({ token: storedToken, user: nextUser });
    }

    return nextUser;
  }, []);

  const logout = useCallback(async ({ silent = false } = {}) => {
    try {
      if (getStoredToken()) {
        await logoutUser();
      }
    } catch {
      // Best effort logout.
    } finally {
      handleSession(null, null);
      if (!silent) {
        toast.success('Signed out successfully');
      }
    }
  }, [handleSession]);

  const value = {
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    loginWithEmail,
    loginWithGoogle,
    registerWithEmail,
    verifyEmail,
    resendVerificationEmail,
    refreshProfile,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
