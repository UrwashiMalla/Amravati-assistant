import {
  requireAuth,
  getUserProfile,
  saveUserProfile,
  getAuthToken,
  clearUserProfile,
} from './app-state.js';
import { initLanguageSelector, t } from './i18n.js';
import { initTheme } from './theme.js';
import {
  startListening,
  speak,
  isSpeechSupported,
  isVoiceEnabled,
  setVoiceEnabled,
  stopSpeaking,
  updateVoiceButton,
} from './voice.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { renderPlacesMap } from './maps.js';

if (!requireAuth()) throw new Error('redirect');

initTheme();
initLanguageSelector('langSelect');

let profile = getUserProfile();
let voiceEnabled = isVoiceEnabled();
let recognition = null;
let currentSessionId = null;

const messagesEl = document.getElementById('messages');
const historyEl = document.getElementById('historyList');
const chatTitle = document.getElementById('chatTitle');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const voiceToggle = document.getElementById('voiceToggle');

function renderMarkdownLite(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function appendMessage(role, content, mapMarkers = null) {
  const box = document.createElement('div');
  box.className = `message ${role}`;

  if (role === 'assistant') {
    const text = document.createElement('div');
    text.className = 'message-text';
    text.innerHTML = renderMarkdownLite(content);
    box.appendChild(text);

    const markers = (mapMarkers || []).filter((m) => m.lat != null && m.lng != null);
    if (markers.length && window.L) {
      const wrap = document.createElement('div');
      wrap.className = 'place-map-wrap';
      const label = document.createElement('div');
      label.className = 'place-map-label';
      label.textContent = t('mapLabel');
      const mapEl = document.createElement('div');
      mapEl.className = 'place-map';
      mapEl.dataset.markers = JSON.stringify(markers);
      wrap.appendChild(label);
      wrap.appendChild(mapEl);
      box.appendChild(wrap);
      messagesEl.appendChild(box);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      requestAnimationFrame(() => renderPlacesMap(mapEl, markers));
      updateQuickSearchVisibility();
      return;
    }
  } else {
    box.textContent = content;
    updateQuickSearchVisibility();
  }

  messagesEl.appendChild(box);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages() {
  messagesEl.innerHTML = '';
}

function showWelcome() {
  clearMessages();
  appendMessage('assistant', t('welcomeChat'));
  showQuickSearch();
}

function formatSessionDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderConversation(messages) {
  clearMessages();
  if (!messages?.length) {
    showWelcome();
    return;
  }
  messages.forEach((m) => {
    if (m.role === 'user' || m.role === 'assistant') {
      appendMessage(m.role, m.content, m.mapMarkers);
    }
  });
}

function setActiveSessionInSidebar(sessionId) {
  historyEl.querySelectorAll('.history-session').forEach((el) => {
    el.classList.toggle('active', el.dataset.sessionId === sessionId);
  });
}

async function loadSessionList() {
  const token = await getAuthToken();
  if (!token) return;

  try {
    const res = await fetch('/api/chat/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return;

    historyEl.innerHTML = '';
    const sessions = data.sessions || [];

    if (!sessions.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = t('noHistory');
      historyEl.appendChild(empty);
      return;
    }

    sessions.forEach((session) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history-session';
      btn.dataset.sessionId = session.id;
      if (session.id === currentSessionId) btn.classList.add('active');

      const title = document.createElement('div');
      title.className = 'history-session-title';
      title.textContent = session.title || session.preview?.slice(0, 48) || 'Chat';

      const preview = document.createElement('div');
      preview.className = 'history-session-preview';
      preview.textContent = session.preview || '';

      const date = document.createElement('div');
      date.className = 'history-session-date';
      const count = session.messageCount ? ` · ${session.messageCount} ${t('messagesCount')}` : '';
      date.textContent = formatSessionDate(session.updatedAt) + count;

      btn.appendChild(title);
      btn.appendChild(preview);
      btn.appendChild(date);

      btn.addEventListener('click', () => openSession(session.id));

      historyEl.appendChild(btn);
    });
  } catch (err) {
    console.warn('Session list failed', err);
  }
}

async function openSession(sessionId) {
  const token = await getAuthToken();
  if (!token || !sessionId) return;

  try {
    const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load');

    currentSessionId = sessionId;
    setActiveSessionInSidebar(sessionId);
    renderConversation(data.messages);

    document.getElementById('sidebar')?.classList.remove('open');
    messageInput.focus();
  } catch (err) {
    console.error(err);
    appendMessage('assistant', t('errorGeneric'));
  }
}

function startNewChat() {
  currentSessionId = null;
  setActiveSessionInSidebar(null);
  showWelcome();
  document.getElementById('sidebar')?.classList.remove('open');
  messageInput.focus();
}

function showTyping() {
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.id = 'typingIndicator';
  typing.textContent = t('thinking');
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function hideTyping() {
  document.getElementById('typingIndicator')?.remove();
}

function updateHeader() {
  profile = getUserProfile();
  const name = profile.assistantName || 'Sahayak';
  chatTitle.textContent = `${t('chatWith')} ${name}`;
}

async function sendMessage(text) {
  const msg = (text || messageInput.value).trim();
  if (!msg) return;
  messageInput.value = '';

  if (messagesEl.querySelector('.message.user')) {
    appendMessage('user', msg);
  } else {
    clearMessages();
    appendMessage('user', msg);
  }

  showTyping();

  const token = await getAuthToken();
  const lang = localStorage.getItem('lang') || 'en';

  if (!token) {
    hideTyping();
    appendMessage('assistant', t('errorAuth'));
    return;
  }

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: msg,
        language: lang,
        assistantName: profile.assistantName || 'Sahayak',
        userName: profile.username || '',
        sessionId: currentSessionId,
      }),
    });

    hideTyping();
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    if (data.sessionId) {
      currentSessionId = data.sessionId;
    }

    appendMessage('assistant', data.reply, data.mapMarkers || data.places);
    if (voiceEnabled) speak(data.reply, lang);
    await loadSessionList();
    setActiveSessionInSidebar(currentSessionId);
  } catch (err) {
    hideTyping();
    appendMessage('assistant', t('errorGeneric'));
    console.error(err);
  }
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.getElementById('newChatBtn').addEventListener('click', startNewChat);

document.getElementById('settingsBtn').addEventListener('click', () => {
  openModal('settingsModal');
});

document.getElementById('changeAssistantBtn').addEventListener('click', () => {
  closeModal('settingsModal');
  document.getElementById('assistantNameInput').value = profile.assistantName || '';
  openModal('assistantModal');
});

document.getElementById('changeUsernameBtn').addEventListener('click', () => {
  closeModal('settingsModal');
  document.getElementById('usernameInput').value = profile.username || '';
  openModal('usernameModal');
});

document.getElementById('saveAssistant').addEventListener('click', async () => {
  const name = document.getElementById('assistantNameInput').value.trim() || 'Sahayak';
  saveUserProfile({ assistantName: name });
  await syncFirestore({ assistantName: name });
  updateHeader();
  closeModal('assistantModal');
});

document.getElementById('saveUsername').addEventListener('click', async () => {
  const name = document.getElementById('usernameInput').value.trim();
  if (!name) return;
  saveUserProfile({ username: name });
  await syncFirestore({ username: name });
  closeModal('usernameModal');
});

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  clearUserProfile();
  if (isFirebaseConfigured()) {
    try {
      const { initializeApp } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
      );
      const { getAuth, signOut } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
      );
      const app = initializeApp(firebaseConfig);
      await signOut(getAuth(app));
    } catch (_) {}
  }
  window.location.href = '/index.html';
});

voiceToggle.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  setVoiceEnabled(voiceEnabled);
  if (!voiceEnabled) stopSpeaking();
  updateVoiceButton(voiceToggle, voiceEnabled);
});

sendBtn.addEventListener('click', () => sendMessage());
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
messageInput.addEventListener('input', (e) => {
  if (e.target.value.trim()) {
    hideQuickSearch();
  }
});

if (isSpeechSupported()) {
  micBtn.addEventListener('click', () => {
    if (recognition) {
      recognition.stop();
      recognition = null;
      micBtn.classList.remove('listening');
      return;
    }
    micBtn.classList.add('listening');
    recognition = startListening(
      (text) => {
        micBtn.classList.remove('listening');
        recognition = null;
        messageInput.value = text;
        sendMessage(text);
      },
      () => {
        micBtn.classList.remove('listening');
        recognition = null;
      }
    );
  });
} else {
  micBtn.disabled = true;
  micBtn.title = 'Speech not supported';
}

document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

window.addEventListener('languageChanged', () => {
  updateHeader();
  updateVoiceButton(voiceToggle, voiceEnabled);
  loadSessionList();
  updateQuickSearchVisibility();
});

// Quick Search Functionality
const quickSearchContainer = document.getElementById('quickSearchContainer');
const quickSearchQueries = {
  searchHospitals: { en: 'searchHospitals', hi: 'searchHospitals', mr: 'searchHospitals' },
  searchCafes: { en: 'searchCafes', hi: 'searchCafes', mr: 'searchCafes' },
  searchVegRestaurants: { en: 'searchVegRestaurants', hi: 'searchVegRestaurants', mr: 'searchVegRestaurants' },
  searchTouristPlaces: { en: 'searchTouristPlaces', hi: 'searchTouristPlaces', mr: 'searchTouristPlaces' },
  searchHotels: { en: 'searchHotels', hi: 'searchHotels', mr: 'searchHotels' },
};

function showQuickSearch() {
  quickSearchContainer.classList.remove('hidden');
  quickSearchContainer.classList.remove('fade-out');
}

function hideQuickSearch() {
  quickSearchContainer.classList.add('fade-out');
  setTimeout(() => {
    quickSearchContainer.classList.add('hidden');
  }, 400);
}

function updateQuickSearchVisibility() {
  const hasMessages = messagesEl.querySelectorAll('.message.user').length > 0;
  if (hasMessages) {
    hideQuickSearch();
  } else {
    showQuickSearch();
  }
}

function handleQuickSearch(searchId) {
  const lang = localStorage.getItem('lang') || 'en';
  const translationKey = quickSearchQueries[searchId][lang] || quickSearchQueries[searchId].en;
  const query = t(translationKey, lang);
  
  messageInput.focus();
  sendMessage(query);
  hideQuickSearch();
}

// Attach event listeners to quick search buttons
Object.keys(quickSearchQueries).forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', () => handleQuickSearch(id));
  }
});

async function syncFirestore(fields) {
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
    await setDoc(doc(db, 'users', profile.uid), fields, { merge: true });
  } catch (err) {
    console.warn(err);
  }
}

updateHeader();
if (localStorage.getItem('voiceEnabled') === null) setVoiceEnabled(true);
voiceEnabled = isVoiceEnabled();
updateVoiceButton(voiceToggle, voiceEnabled);
showWelcome();
loadSessionList();
