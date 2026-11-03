// يقرأ إعدادات Firebase من متغيرات البيئة وقت البناء (ملف .env).
// إذا لم تكتمل الإعدادات — أو أُضيف ?mode=local للرابط — يعمل الوضع التجريبي المحلي.
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured() {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('mode') === 'local') return false;
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}
