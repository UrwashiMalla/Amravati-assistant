const STORAGE_KEY = 'amravati_user';

export function getUserProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveUserProfile(profile) {
  const current = getUserProfile() || {};
  const merged = { ...current, ...profile };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export function clearUserProfile() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function getAuthToken() {
  const profile = getUserProfile();
  if (!profile) return null;
  if (profile.demo) return 'demo-token';

  // Refresh Firebase ID token if available
  if (profile.uid && !profile.demo) {
    try {
      const { firebaseConfig, isFirebaseConfigured } = await import('./firebase-config.js');
      if (isFirebaseConfigured()) {
        const { initializeApp, getApps } = await import(
          'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
        );
        const { getAuth } = await import(
          'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
        );
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        const user = getAuth(app).currentUser;
        if (user) {
          const fresh = await user.getIdToken();
          saveUserProfile({ idToken: fresh });
          return fresh;
        }
      }
    } catch {
      /* fall through to stored token */
    }
  }

  if (profile.idToken) return profile.idToken;
  if (profile.uid) return 'demo-token';
  return null;
}

export function requireAuth(redirectTo = '/index.html') {
  const profile = getUserProfile();
  if (!profile?.uid) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}
