/**
 * accessibility-shell.js
 * ARIA live regions, theme toggle, font scaling, focus trap, preferences.
 */

const PREFS_KEY = 'equisense_prefs';

export function initAccessibilityShell() {
  loadUserPreferences();
  bindThemeToggle();
  bindFontControls();
}

// ── Announce to screen reader ────────────────────────────────────────────────

/**
 * @param {string} message
 * @param {'polite'|'assertive'} priority
 */
export function announceToScreenReader(message, priority = 'polite') {
  const el = document.getElementById(priority === 'assertive' ? 'sr-alert' : 'sr-status');
  if (!el) return;
  // Clear then set forces re-announcement even if same text
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

// ── High-contrast theme ──────────────────────────────────────────────────────

export function toggleHighContrast() {
  const active = document.body.classList.toggle('high-contrast');
  const btn = document.getElementById('btn-high-contrast');
  if (btn) btn.setAttribute('aria-pressed', String(active));
  saveUserPreferences();
  announceToScreenReader(active ? 'High contrast mode on' : 'High contrast mode off');
}

function bindThemeToggle() {
  document.getElementById('btn-high-contrast')?.addEventListener('click', toggleHighContrast);
}

// ── Font scaling ─────────────────────────────────────────────────────────────

const FONT_SCALES = [1, 1.15, 1.3, 1.5];
let fontScaleIndex = 0;

export function increaseFontSize() {
  fontScaleIndex = Math.min(fontScaleIndex + 1, FONT_SCALES.length - 1);
  applyFontScale();
}

export function decreaseFontSize() {
  fontScaleIndex = Math.max(fontScaleIndex - 1, 0);
  applyFontScale();
}

function applyFontScale() {
  document.documentElement.style.setProperty('--font-scale', FONT_SCALES[fontScaleIndex]);
  saveUserPreferences();
  announceToScreenReader(`Font size: ${Math.round(FONT_SCALES[fontScaleIndex] * 100)}%`);
}

function bindFontControls() {
  document.getElementById('btn-font-increase')?.addEventListener('click', increaseFontSize);
  document.getElementById('btn-font-decrease')?.addEventListener('click', decreaseFontSize);
}

// ── Preferences persistence ──────────────────────────────────────────────────

export function saveUserPreferences() {
  const prefs = {
    highContrast: document.body.classList.contains('high-contrast'),
    fontScaleIndex
  };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

function loadUserPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs.highContrast) {
      document.body.classList.add('high-contrast');
      document.getElementById('btn-high-contrast')?.setAttribute('aria-pressed', 'true');
    }
    if (typeof prefs.fontScaleIndex === 'number') {
      fontScaleIndex = prefs.fontScaleIndex;
      applyFontScale();
    }
  } catch (_) {}
}

// ── Focus trap (for any modal that may be added) ─────────────────────────────

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab focus within modalElement.
 * Returns a cleanup function that removes the listener.
 */
export function trapFocusInModal(modalElement) {
  function getFocusable() {
    return [...modalElement.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  }

  function handler(e) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  modalElement.addEventListener('keydown', handler);
  return () => modalElement.removeEventListener('keydown', handler);
}
