const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function env(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

module.exports = {
  GEMINI_API_KEY: env('GEMINI_API_KEY'),
  GEOAPIFY_API_KEY: env('GEOAPIFY_API_KEY'),
  GOOGLE_MAPS_API_KEY: env('GOOGLE_MAPS_API_KEY'),
  FIREBASE_API_KEY: env('VITE_FIREBASE_API_KEY'),
  FIREBASE_AUTH_DOMAIN: env('VITE_FIREBASE_AUTH_DOMAIN'),
  FIREBASE_PROJECT_ID: env('VITE_FIREBASE_PROJECT_ID'),
  FIREBASE_STORAGE_BUCKET: env('VITE_FIREBASE_STORAGE_BUCKET'),
  FIREBASE_MESSAGING_SENDER_ID: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  FIREBASE_APP_ID: env('VITE_FIREBASE_APP_ID'),
  FIREBASE_SERVICE_ACCOUNT_PATH: env('FIREBASE_SERVICE_ACCOUNT_PATH'),
  PORT: env('PORT') || '3000',
  CLIENT_URL: env('CLIENT_URL'),
};
