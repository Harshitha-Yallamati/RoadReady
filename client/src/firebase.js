// ============================================================
// Firebase Client SDK — initializer
// ============================================================
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            "AIzaSyD8HooGuxRzjWlKOHFLHQfzvTROgj6aMA0",
  authDomain:        "readyroad-d837b.firebaseapp.com",
  projectId:         "readyroad-d837b",
  storageBucket:     "readyroad-d837b.firebasestorage.app",
  messagingSenderId: "969475004929",
  appId:             "1:969475004929:web:a94a6c7489ac58ed383e00",
  measurementId:     "G-BN902QPNJF",
};

const app  = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
