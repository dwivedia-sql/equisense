/**
 * cues.js
 * Spatial audio cues for tree position feedback.
 *
 * Pan mapping:
 *   msup (superscript) → pans right (+0.6)
 *   msub (subscript)   → pans left  (-0.6)
 *   all others         → neutral     (0)
 *
 * Pitch mapping:
 *   root = 440 Hz, each level deeper adds 50 Hz
 *
 * Tone shape:
 *   entering a structure → sine (smooth)
 *   leaving (moving up)  → sawtooth (edgy)
 */

import { playPositionalCue } from '../audio-engine.js';

const BASE_FREQ  = 440;
const FREQ_STEP  = 50;

const TAG_PAN = {
  msup: 0.65,
  msub: -0.65,
};

/**
 * @param {number} depth      Tree depth of current node (0 = root)
 * @param {string} tag        MathML tag of current node
 * @param {'enter'|'exit'|'sibling'} direction  Movement type
 */
export function playNavigationCue(depth, tag, direction) {
  const frequency = BASE_FREQ + depth * FREQ_STEP;
  const pan       = TAG_PAN[tag] ?? 0;
  const type      = direction === 'exit' ? 'sawtooth' : 'sine';
  const duration  = direction === 'sibling' ? 0.08 : 0.12;

  playPositionalCue(frequency, pan, type, duration);
}
