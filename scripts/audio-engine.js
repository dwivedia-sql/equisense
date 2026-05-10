/**
 * audio-engine.js
 * Shared AudioContext and low-level audio utilities.
 * One context for the entire app — instantiated on first user gesture.
 */

let ctx = null;
let spatialInitialized = false;

export function getAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Configure the AudioListener for HRTF use.
 * Listener at origin, facing -Z, up +Y.
 * Call once after first user gesture.
 */
export function initSpatialAudio(audioContext) {
  if (spatialInitialized) return;
  const l = audioContext.listener;
  // Modern AudioParam API
  if (l.positionX) {
    l.positionX.setValueAtTime(0, audioContext.currentTime);
    l.positionY.setValueAtTime(0, audioContext.currentTime);
    l.positionZ.setValueAtTime(0, audioContext.currentTime);
    l.forwardX.setValueAtTime(0, audioContext.currentTime);
    l.forwardY.setValueAtTime(0, audioContext.currentTime);
    l.forwardZ.setValueAtTime(-1, audioContext.currentTime);
    l.upX.setValueAtTime(0, audioContext.currentTime);
    l.upY.setValueAtTime(1, audioContext.currentTime);
    l.upZ.setValueAtTime(0, audioContext.currentTime);
  } else {
    // Legacy Safari fallback
    l.setPosition(0, 0, 0);
    l.setOrientation(0, 0, -1, 0, 1, 0);
  }
  spatialInitialized = true;
}

/**
 * Create a PannerNode positioned at (x, y, z) with HRTF.
 * Falls back to stereo panning if HRTF is unsupported.
 *
 * @param {AudioContext} audioContext
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {PannerNode}
 */
export function createSpatialCue(audioContext, x, y, z) {
  const panner = audioContext.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 10;
  panner.rolloffFactor = 1;

  if (panner.positionX) {
    panner.positionX.setValueAtTime(x, audioContext.currentTime);
    panner.positionY.setValueAtTime(y, audioContext.currentTime);
    panner.positionZ.setValueAtTime(z, audioContext.currentTime);
  } else {
    panner.setPosition(x, y, z);
  }

  return panner;
}

/**
 * Play a full spatial tone: oscillator → gain envelope → HRTF panner → destination.
 *
 * @param {AudioContext} audioContext
 * @param {{ x, y, z }} position
 * @param {number} frequency  Hz
 * @param {'sine'|'sawtooth'|'triangle'} type
 * @param {number} duration   seconds
 */
export function playSpatialTone(audioContext, position, frequency, type = 'sine', duration = 0.12) {
  const osc   = audioContext.createOscillator();
  const gain  = audioContext.createGain();
  const panner = createSpatialCue(audioContext, position.x, position.y, position.z);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audioContext.currentTime);

  gain.gain.setValueAtTime(0.45, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioContext.destination);

  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + duration);
}

/**
 * Stereo ping — kept for graph sonifier which uses StereoPannerNode intentionally.
 */
export function playPositionalCue(frequency = 440, pan = 0, type = 'sine', duration = 0.12) {
  const audioContext = getAudioContext();
  const osc    = audioContext.createOscillator();
  const gain   = audioContext.createGain();
  const panner = audioContext.createStereoPanner();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
  panner.pan.setValueAtTime(pan, audioContext.currentTime);
  gain.gain.setValueAtTime(0.4, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioContext.destination);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + duration);
}

/**
 * Detect whether stereo headphones are connected.
 * Returns true if an audio output other than the built-in speaker is found.
 * @returns {Promise<boolean>}
 */
export async function detectHeadphones() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    return outputs.some(d => d.label && !/built.?in|internal|speaker/i.test(d.label));
  } catch {
    return false; // permission denied or API unavailable
  }
}
