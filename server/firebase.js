const path = require('path');
const {
  FIREBASE_PROJECT_ID,
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_SERVICE_ACCOUNT_PATH,
} = require('./config/env');

let db = null;
let auth = null;

async function initFirebase() {
  try {
    if (!FIREBASE_PROJECT_ID) {
      console.warn('[Firebase] No project ID configured - Firestore disabled');
      return;
    }

    const admin = require('firebase-admin');

    let serviceAccountPath;
    if (FIREBASE_SERVICE_ACCOUNT_PATH) {
      // If path starts with ./ or ../, resolve relative to this file's directory
      if (FIREBASE_SERVICE_ACCOUNT_PATH.startsWith('.')) {
        serviceAccountPath = path.resolve(__dirname, '..', FIREBASE_SERVICE_ACCOUNT_PATH.replace(/^\.\//, ''));
      } else {
        serviceAccountPath = path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH);
      }
    } else {
      serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    }

    console.log('[Firebase] Looking for service account at:', serviceAccountPath);

    let serviceAccount;
    try {
      serviceAccount = require(serviceAccountPath);
      console.log('[Firebase] Service account loaded successfully');
    } catch (err) {
      console.warn(`[Firebase] Service account not found: ${err.message}`);
      // If service account is not available, we can still initialize with web credentials
      // but will have limited server-side operations
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: FIREBASE_PROJECT_ID,
    });

    db = admin.firestore();
    console.log('[Firebase] ✅ Admin SDK initialized successfully - Firestore connected');
  } catch (err) {
    console.error('[Firebase] Initialization error:', err.message);
  }
}

function getDb() {
  return db;
}

module.exports = { initFirebase, getDb };
