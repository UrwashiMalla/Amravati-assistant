import { t } from './i18n.js';

const STORAGE_KEY = 'theme';

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'light';
}

export function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.setAttribute('data-theme', next);
  updateThemeToggleButton();
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: next }));
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function updateThemeToggleButton() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = getTheme() === 'dark';
  const lang = localStorage.getItem('lang') || 'en';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? t('lightMode', lang) : t('darkMode', lang);
  btn.setAttribute('aria-label', btn.title);
}

export function initTheme() {
  document.documentElement.setAttribute('data-theme', getTheme());
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
    updateThemeToggleButton();
  }
  window.addEventListener('languageChanged', updateThemeToggleButton);
}
