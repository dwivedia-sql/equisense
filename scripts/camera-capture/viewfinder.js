/**
 * viewfinder.js
 * Camera viewfinder UI — button states, status messages, overlay.
 */

import { announceToScreenReader } from '../accessibility-shell.js';

/**
 * @param {'idle'|'active'|'capturing'|'processing'|'success'|'error'} state
 * @param {string} [detail]  extra message for error/success states
 */
export function showCaptureFeedback(state, detail = '') {
  const statusEl  = document.getElementById('camera-status');
  const btnCapture = document.getElementById('btn-capture');
  const btnStart  = document.getElementById('btn-start-camera');
  const btnStop   = document.getElementById('btn-stop-camera');
  const overlay   = document.getElementById('camera-overlay');

  const messages = {
    idle:       'Camera ready. Position the equation in the frame and tap Capture.',
    active:     'Camera active.',
    capturing:  'Capturing frame…',
    processing: 'Running OCR — this may take a few seconds…',
    success:    detail || 'Equation captured successfully.',
    error:      detail || 'Could not capture equation. Please try again.',
  };

  if (statusEl) {
    statusEl.textContent = messages[state] ?? state;
    statusEl.dataset.state = state;
  }
  if (overlay) overlay.dataset.state = state;

  if (btnCapture) btnCapture.disabled = !['idle', 'active'].includes(state);
  if (btnStart)   btnStart.disabled   = state !== 'idle';
  if (btnStop)    btnStop.disabled    = ['idle', 'error'].includes(state);

  announceToScreenReader(
    messages[state] ?? state,
    state === 'error' ? 'assertive' : 'polite'
  );
}

/**
 * Show or hide the camera section UI.
 * @param {boolean} visible
 */
export function showViewfinder(visible = true) {
  const section = document.getElementById('camera-viewfinder');
  if (!section) return;
  section.hidden = !visible;
  if (visible) {
    document.getElementById('btn-start-camera')?.focus();
  }
}

/**
 * Display the confidence badge on the captured result.
 * @param {'high'|'medium'|'low'} confidence
 * @param {string} latex
 */
export function showCaptureResult(confidence, latex) {
  const resultEl = document.getElementById('camera-result');
  if (!resultEl) return;
  resultEl.hidden = false;
  const badge = confidence === 'high' ? '✓ High confidence'
              : confidence === 'medium' ? '~ Medium confidence — review the equation'
              : '⚠ Low confidence — results may be inaccurate';
  resultEl.innerHTML = `
    <p class="capture-badge capture-badge--${confidence}">${badge}</p>
    <p class="capture-latex"><code>${escapeHtml(latex)}</code></p>
    <button id="btn-use-captured">Load into Equation Navigator</button>
    <button id="btn-retry-capture">Retry Capture</button>
  `;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
