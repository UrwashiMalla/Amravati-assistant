import { requireAuth, getUserProfile, saveUserProfile } from './app-state.js';
import { initLanguageSelector, t } from './i18n.js';
import { initTheme } from './theme.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

if (!requireAuth()) throw new Error('redirect');

initTheme();
initLanguageSelector('langSelect');

const profile = getUserProfile();

document.getElementById('continueBtn').addEventListener('click', async () => {
  const name =
    document.getElementById('assistantName').value.trim() || 'Sahayak';
  await saveAssistantName(name);
  window.location.href = '/chat.html';
});

document.getElementById('skipBtn').addEventListener('click', async () => {
  saveUserProfile({ assistantName: 'Sahayak', skippedSetup: true });
  await saveAssistantName('Sahayak');
  window.location.href = '/chat.html';
});

async function saveAssistantName(name) {
  saveUserProfile({ assistantName: name });

  if (!isFirebaseConfigured() || profile.demo) return;

  try {
    const { initializeApp } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
    );
    const { getFirestore, doc, setDoc } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
    );
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    await setDoc(
      doc(db, 'users', profile.uid),
      { assistantName: name, language: localStorage.getItem('lang') || 'en' },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore update skipped', err);
  }
}
