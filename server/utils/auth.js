import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULES = {
  minLength: 8,
  requiresUppercase: true,
  requiresLowercase: true,
  requiresNumber: true,
};

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email = '') {
  return EMAIL_REGEX.test(normalizeEmail(email));
}

export function validatePassword(password = '') {
  const value = String(password || '');
  if (value.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters long`;
  }
  if (PASSWORD_RULES.requiresUppercase && !/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter';
  }
  if (PASSWORD_RULES.requiresLowercase && !/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter';
  }
  if (PASSWORD_RULES.requiresNumber && !/\d/.test(value)) {
    return 'Password must include at least one number';
  }
  return null;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function createVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  };
}

export function createAuthToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      emailVerified: Boolean(user.emailVerified),
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

export function verifyAuthToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.verify(token, secret);
}

export function buildVerificationUrl(token) {
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  return `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
}

export function serializeUser(user, extra = {}) {
  if (!user) return null;
  if (typeof user.toSafeObject === 'function') {
    return user.toSafeObject(extra);
  }

  return {
    id: user._id?.toString?.() || user.id,
    name: user.name,
    email: user.email,
    photoURL: user.photoURL || '',
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null,
    ...extra,
  };
}

export default {
  normalizeEmail,
  isValidEmail,
  validatePassword,
  hashToken,
  createVerificationToken,
  createAuthToken,
  verifyAuthToken,
  buildVerificationUrl,
  serializeUser,
};
