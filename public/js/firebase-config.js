/**
 * Firebase web app configuration from .env file
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAp2gsoBpJrOIdxZU0nVGepGHPNcFUUPCo',
  authDomain: 'amravati-sahayak.firebaseapp.com',
  projectId: 'amravati-sahayak',
  storageBucket: 'amravati-sahayak.firebasestorage.app',
  messagingSenderId: '174252341734',
  appId: '1:174252341734:web:338b7ce62454f3e948fe27',
};

/** Firebase is properly configured */
export const isFirebaseConfigured = () =>
  firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');
