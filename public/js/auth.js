import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { saveUserProfile, getUserProfile } from './app-state.js';
import { initLanguageSelector, t, applyLanguage } from './i18n.js';
import { initTheme } from './theme.js';

let auth = null;
let db = null;

async function initFirebase() {
  if (!isFirebaseConfigured()) return false;

  const { initializeApp } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
  );
  const authMod = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
  );
  const firestoreMod = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
  );

  const app = initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = firestoreMod.getFirestore(app);
  return { auth, authMod, firestoreMod, db };
}

async function persistUser(user, username, authMod) {
  const token = await user.getIdToken();
  const profile = {
    uid: user.uid,
    email: user.email,
    username: username || user.displayName || user.email?.split('@')[0] || 'User',
    idToken: token,
    demo: false,
  };
  saveUserProfile(profile);

  if (db) {
    const { doc, setDoc } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
    );
    await setDoc(
      doc(db, 'users', user.uid),
      {
        username: profile.username,
        email: user.email,
        language: localStorage.getItem('lang') || 'en',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  if (authMod) {
    authMod.onAuthStateChanged(auth, async (u) => {
      if (u) {
        const p = getUserProfile();
        if (p) saveUserProfile({ ...p, idToken: await u.getIdToken() });
      }
    });
  }

  return profile;
}

function demoLogin(username, email) {
  saveUserProfile({
    uid: 'demo-' + Date.now(),
    email: email || 'demo@amravati.local',
    username: username || 'Guest',
    assistantName: null,
    idToken: 'demo-token',
    demo: true,
  });
  window.location.href = '/assistant-setup.html';
}

async function handleEmailAuth(mode, username, email, password, errorEl) {
  const fb = await initFirebase();

  if (!fb) {
    if (!username || !email || !password) {
      errorEl.textContent = t('errorGeneric');
      return;
    }
    demoLogin(username, email);
    return;
  }

  const { auth, authMod } = fb;
  errorEl.textContent = '';

  try {
    let user;
    if (mode === 'register') {
      const cred = await authMod.createUserWithEmailAndPassword(auth, email, password);
      user = cred.user;
      if (username && authMod.updateProfile) {
        await authMod.updateProfile(user, { displayName: username });
      }
    } else {
      const cred = await authMod.signInWithEmailAndPassword(auth, email, password);
      user = cred.user;
    }
    await persistUser(user, username, authMod);
    window.location.href = '/assistant-setup.html';
  } catch (err) {
    errorEl.textContent = err.message || t('errorAuth');
  }
}

async function handleGoogle(errorEl) {
  const fb = await initFirebase();

  if (!fb) {
    demoLogin('Google User', 'google.demo@amravati.local');
    return;
  }

  const { auth, authMod } = fb;
  try {
    const provider = new authMod.GoogleAuthProvider();
    const cred = await authMod.signInWithPopup(auth, provider);
    await persistUser(cred.user, cred.user.displayName, authMod);
    window.location.href = '/assistant-setup.html';
  } catch (err) {
    errorEl.textContent = err.message || t('errorAuth');
  }
}

function initAuthPage() {
  initTheme();
  initLanguageSelector('langSelect');

  if (getUserProfile()?.uid) {
    const p = getUserProfile();
    if (p.assistantName || p.skippedSetup) {
      window.location.href = '/chat.html';
    } else {
      window.location.href = '/assistant-setup.html';
    }
    return;
  }

  let mode = 'login';
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const usernameGroup = document.getElementById('usernameGroup');
  const form = document.getElementById('authForm');
  const errorEl = document.getElementById('authError');
  const submitBtn = document.getElementById('submitBtn');
  const formTitle = document.getElementById('formTitle');

  tabLogin.addEventListener('click', () => {
    mode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    usernameGroup.classList.add('hidden');
    submitBtn.setAttribute('data-i18n', 'login');
    formTitle.setAttribute('data-i18n', 'login');
    applyLanguage(localStorage.getItem('lang') || 'en');
  });

  tabRegister.addEventListener('click', () => {
    mode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    usernameGroup.classList.remove('hidden');
    submitBtn.setAttribute('data-i18n', 'register');
    formTitle.setAttribute('data-i18n', 'register');
    applyLanguage(localStorage.getItem('lang') || 'en');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    handleEmailAuth(mode, username, email, password, errorEl);
  });

  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  
  if (passwordToggle) {
    passwordToggle.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  document.getElementById('googleBtn').addEventListener('click', () => handleGoogle(errorEl));
}

initAuthPage();
