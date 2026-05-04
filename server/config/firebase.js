// ============================================================
// Firebase Admin SDK — Server-side initializer
// ============================================================
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp;

/**
 * Initialize Firebase Admin using env-provided service-account credentials.
 * Falls back to the FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY triplet
 * that you can set directly in .env (no JSON file required).
 */
function initFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0];

  const projectId  = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Newlines in .env private keys are stored as \n strings — restore them
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    console.log('✅ Firebase Admin initialised with service-account credentials');
  } else {
    // Fallback: Ensure Project ID is available for token verification
    adminApp = initializeApp({
      projectId: projectId || 'readyroad-d837b'
    });
    console.log('⚠️  Firebase Admin initialised with fallback/Application Default Credentials');
  }

  return adminApp;
}

initFirebaseAdmin();

export const firebaseAuth = getAuth();
export default firebaseAuth;
