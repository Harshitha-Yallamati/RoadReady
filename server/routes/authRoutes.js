import { Router } from 'express';
import User from '../models/User.js';
import SavedPlace from '../models/SavedPlace.js';
import RouteHistory from '../models/RouteHistory.js';
import auth from '../middleware/auth.js';
import { sendVerificationEmail } from '../services/emailService.js';
import {
  normalizeEmail,
  isValidEmail,
  validatePassword,
  createVerificationToken,
  createAuthToken,
  hashToken,
  buildVerificationUrl,
  serializeUser,
} from '../utils/auth.js';
import { firebaseAuth } from '../config/firebase.js';

const router = Router();

async function sendVerificationForUser(user) {
  const { token, tokenHash, expiresAt } = createVerificationToken();
  user.verificationTokenHash = tokenHash;
  user.verificationTokenExpiresAt = expiresAt;
  await user.save();

  const verificationUrl = buildVerificationUrl(token);
  const delivery = await sendVerificationEmail({
    email: user.email,
    name: user.name,
    verificationUrl,
  });

  return {
    verificationUrl,
    delivery,
  };
}

async function buildStats(userId) {
  const [savedPlacesCount, historyCount] = await Promise.all([
    SavedPlace.countDocuments({ userId }),
    RouteHistory.countDocuments({ userId }),
  ]);

  return {
    savedPlacesCount,
    historyCount,
  };
}

router.post('/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const photoURL = String(req.body?.photoURL || '').trim();

    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'Name must be at least 2 characters long' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      photoURL,
    });

    const { delivery } = await sendVerificationForUser(user);

    return res.status(201).json({
      success: true,
      message: 'Account created. Verify your email to continue.',
      user: serializeUser(user),
      requiresVerification: true,
      verificationPreviewUrl: delivery.previewUrl || null,
    });
  } catch (error) {
    console.error('[Auth] Register error:', error.message);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Verify your email before logging in',
        requiresVerification: true,
        email: user.email,
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createAuthToken(user);
    const stats = await buildStats(user._id);

    return res.json({
      success: true,
      token,
      user: serializeUser(user, { stats }),
    });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Identity token is missing' });
    }

    // Verify token using Firebase Admin SDK
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    
    if (!decodedToken || !decodedToken.email) {
      return res.status(401).json({ success: false, error: 'Invalid Google Identity token' });
    }

    const email = normalizeEmail(decodedToken.email);
    let user = await User.findOne({ email }).select('+password');

    // Create user if they don't exist
    if (!user) {
      user = await User.create({
        name: decodedToken.name || 'Google User',
        email,
        // Since they signed up with Google, their email is inherently verified
        emailVerified: true,  
        photoURL: decodedToken.picture || '',
        // Use a securely random string for password since they authenticate via Google
        password: Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + 'A1!'
      });
    } else {
      // If user exists but didn't have emailVerified true, we can mark it true 
      // since Google guaranteed this email.
      if (!user.emailVerified) {
        user.emailVerified = true;
      }
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = createAuthToken(user);
    const stats = await buildStats(user._id);

    return res.json({
      success: true,
      token,
      user: serializeUser(user, { stats }),
    });
  } catch (error) {
    console.error('[Auth] Google Login verification error:', error.message);
    return res.status(500).json({ success: false, error: 'Google Signup/Login failed: ' + error.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const rawToken = String(req.body?.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ success: false, error: 'Verification token is required' });
    }

    const tokenHash = hashToken(rawToken);
    const user = await User.findOne({
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: { $gt: new Date() },
    }).select('+verificationTokenHash +verificationTokenExpiresAt');

    if (!user) {
      return res.status(400).json({ success: false, error: 'This verification link is invalid or expired' });
    }

    user.emailVerified = true;
    user.verificationTokenHash = null;
    user.verificationTokenExpiresAt = null;
    await user.save();

    return res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    console.error('[Auth] Verify email error:', error.message);
    return res.status(500).json({ success: false, error: 'Email verification failed' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'A valid email is required' });
    }

    const user = await User.findOne({ email }).select('+verificationTokenHash +verificationTokenExpiresAt');
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found for this email' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, error: 'This email is already verified' });
    }

    const { delivery } = await sendVerificationForUser(user);

    return res.json({
      success: true,
      message: 'Verification email sent',
      verificationPreviewUrl: delivery.previewUrl || null,
    });
  } catch (error) {
    console.error('[Auth] Resend verification error:', error.message);
    return res.status(500).json({ success: false, error: 'Could not resend verification email' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const stats = await buildStats(req.user._id);
    return res.json({
      success: true,
      user: serializeUser(req.user, { stats }),
    });
  } catch (error) {
    console.error('[Auth] Current user error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to load current user' });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const photoURL = String(req.body?.photoURL || '').trim();

    if (name.length < 2) {
      return res.status(400).json({ success: false, error: 'Name must be at least 2 characters long' });
    }

    req.user.name = name;
    req.user.photoURL = photoURL;
    await req.user.save();

    const stats = await buildStats(req.user._id);

    return res.json({
      success: true,
      message: 'Profile updated',
      user: serializeUser(req.user, { stats }),
    });
  } catch (error) {
    console.error('[Auth] Update profile error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

router.post('/logout', auth, async (req, res) => {
  return res.json({ success: true, message: 'Logged out' });
});

export default router;
