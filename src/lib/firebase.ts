import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC9eHq91iR-8R1cohaK5Mb5qx9p-p6D2Ok",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rotulado-nutricional.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rotulado-nutricional",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rotulado-nutricional.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "371812479175",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:371812479175:web:b892932b955242e3be4ee2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
