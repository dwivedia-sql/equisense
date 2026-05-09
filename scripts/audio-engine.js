/**
 * audio-engine.js
 * Shared AudioContext and low-level audio utilities.
 * One context for the entire app — instantiated on first user gesture.
 */

let ctx = null;

export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

/**
 * Play a short positional ping.
 * @param {number} frequency  Hz
 * @param {number} pan        -1 (left) to +1 (right)
 * @param {'sine'|'sawtooth'|'triangle'} type  oscillator waveform
 * @param {number} duration   seconds
 */
export function playPositionalCue(frequency = 440, pan = 0, type = 'sine', duration = 0.12) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  panner.pan.setValueAtTime(pan, ctx.currentTime);

  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/**
 * Create a scheduled oscillator for graph sonification.
 * Returns a { start, stop } interface.
 */
export function createScheduledOscillator() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();

  osc.type = 'sine';
  gain.gain.setValueAtTime(0.35, ctx.currentTime);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);

  return { osc, gain, panner, ctx };
}
