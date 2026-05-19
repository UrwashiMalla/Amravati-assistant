import { t } from './i18n.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function getSpeechLang(lang) {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'mr') return 'mr-IN';
  return 'en-IN';
}

export function isSpeechSupported() {
  return Boolean(SpeechRecognition);
}

export function isVoiceEnabled() {
  return localStorage.getItem('voiceEnabled') === 'true';
}

export function setVoiceEnabled(enabled) {
  localStorage.setItem('voiceEnabled', enabled ? 'true' : 'false');
}

export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function startListening(onResult, onError) {
  if (!SpeechRecognition) {
    onError?.(new Error('Speech recognition not supported in this browser'));
    return null;
  }

  const lang = localStorage.getItem('lang') || 'en';
  const rec = new SpeechRecognition();
  rec.lang = getSpeechLang(lang);
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    onResult(text);
  };

  rec.onerror = (e) => onError?.(e);

  rec.start();
  return rec;
}

export function speak(text, lang) {
  if (!isVoiceEnabled() || !window.speechSynthesis) return;
  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(stripMarkdown(text));
  utter.lang = getSpeechLang(lang || localStorage.getItem('lang') || 'en');
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/_/g, '');
}

export function getVoiceToggleLabel(enabled, lang) {
  return enabled ? t('voiceOn', lang) : t('voiceOff', lang);
}

export function updateVoiceButton(button, enabled) {
  if (!button) return;
  const lang = localStorage.getItem('lang') || 'en';
  button.textContent = enabled ? '🔊' : '🔇';
  button.title = getVoiceToggleLabel(enabled, lang);
  button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  button.setAttribute('aria-label', getVoiceToggleLabel(enabled, lang));
}
