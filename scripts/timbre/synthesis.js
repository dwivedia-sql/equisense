/**
 * synthesis.js
 * Additive synthesis engine — each MathML node type has a distinct timbre.
 *
 * Timbre map (harmonics as [frequency_multiplier, relative_amplitude]):
 *   mfrac  (fraction)  → odd harmonics 1,3,5 — clarinet-like
 *   msqrt  (root)      → harmonics 1,2,4 with sharp attack — bright, airy
 *   msup   (power)     → sawtooth approximation (all harmonics, 1/n fall)
 *   msub   (subscript) → triangle (odd harmonics, 1/n² fall)
 *   mn/mi  (variable)  → pure sine (harmonic 1 only)
 *   mo     (operator)  → slight 5th overtone — bell-like
 *   mrow   (group)     → soft two-harmonic tone
 *   default            → pure sine
 */

import { createSpatialCue } from '../audio-engine.js';

const TIMBRE_MAP = {
  mfrac:  [ [1, 0.6], [3, 0.3], [5, 0.1] ],                               // clarinet (odd only)
  msqrt:  [ [1, 0.5], [2, 0.35], [4, 0.15] ],                             // bright, airy
  mroot:  [ [1, 0.5], [2, 0.35], [4, 0.15] ],
  msup:   [ [1, 0.5], [2, 0.25], [3, 0.17], [4, 0.08] ],                  // sawtooth-ish
  msub:   [ [1, 0.56], [3, 0.06], [5, 0.02] ],                            // triangle-ish
  mn:     [ [1, 1.0] ],                                                    // pure sine
  mi:     [ [1, 1.0] ],
  mo:     [ [1, 0.7], [1.5, 0.2], [2, 0.1] ],                             // bell (inharmonic)
  mrow:   [ [1, 0.7], [2, 0.3] ],
  mfenced:[ [1, 0.6], [2, 0.25], [3, 0.15] ],
};

/**
 * Play a spatially positioned tone with timbre determined by MathML node type.
 *
 * @param {AudioContext} audioContext
 * @param {{ x, y, z }} position   HRTF 3D position
 * @param {number} baseFreq        fundamental frequency (Hz)
 * @param {string} tag             MathML element tag
 * @param {'enter'|'exit'|'sibling'} direction
 */
export function playTimbredCue(audioContext, position, baseFreq, tag, direction) {
  const harmonics = TIMBRE_MAP[tag] ?? TIMBRE_MAP.mn;
  const duration  = direction === 'sibling' ? 0.10 : 0.18;

  const panner  = createSpatialCue(audioContext, position.x, position.y, position.z);
  const masterGain = audioContext.createGain();

  // Envelope shape: sharp attack, quick exponential decay
  const attackTime = direction === 'enter' ? 0.008 : 0.003;
  masterGain.gain.setValueAtTime(0, audioContext.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.45, audioContext.currentTime + attackTime);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  masterGain.connect(panner);
  panner.connect(audioContext.destination);

  for (const [mult, amp] of harmonics) {
    const osc      = audioContext.createOscillator();
    const oscGain  = audioContext.createGain();

    // msup uses sawtooth for the higher harmonics, others use sine
    osc.type = (tag === 'msup' && mult > 1) ? 'sawtooth' : 'sine';

    // Low-pass filter for subscripts/sawtooth to soften them
    if (tag === 'msub' || tag === 'msup') {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = baseFreq * mult * 3;
      osc.connect(filter);
      filter.connect(oscGain);
    } else {
      osc.connect(oscGain);
    }

    osc.frequency.setValueAtTime(baseFreq * mult, audioContext.currentTime);
    oscGain.gain.setValueAtTime(amp, audioContext.currentTime);
    oscGain.connect(masterGain);

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duration + 0.01);
  }
}
