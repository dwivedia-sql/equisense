/**
 * speech-input.js
 * Continuous Web Speech API recognition wrapper.
 * Calls onIntent(intentName, params) for every matched command.
 */

let recognition = null;
let active = false;

/**
 * Initialize continuous speech recognition.
 * @param {function} onIntent  Called with (intentName: string, params: object)
 * @param {function} onStatus  Called with status string for UI
 * @returns {{ start, stop, isActive }}
 */
export function initSpeechInput(onIntent, onStatus) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onStatus('Voice commands not supported in this browser. Use Chrome.');
    return { start: () => {}, stop: () => {}, isActive: () => false };
  }

  recognition = new SpeechRecognition();
  recognition.continuous    = true;
  recognition.interimResults = false;
  recognition.lang          = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onresult = (e) => {
    const transcript = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
    const match = matchIntent(transcript);
    if (match) {
      onIntent(match.intent, match.params);
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') return; // normal timeout, restart
    if (e.error === 'not-allowed') { onStatus('Microphone permission denied for voice commands.'); return; }
    onStatus(`Voice error: ${e.error}`);
  };

  recognition.onend = () => {
    // Auto-restart to keep continuous listening
    if (active) { try { recognition.start(); } catch (_) {} }
  };

  return {
    start() {
      active = true;
      try { recognition.start(); onStatus('Listening for voice commands…'); }
      catch (_) {}
    },
    stop() {
      active = false;
      try { recognition.stop(); onStatus('Voice commands off.'); }
      catch (_) {}
    },
    isActive: () => active,
  };
}

/** Import intent-matcher inline to avoid circular dep */
import { matchIntent } from './intent-matcher.js';
