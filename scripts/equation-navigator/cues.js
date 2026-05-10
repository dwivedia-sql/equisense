/**
 * cues.js
 * HRTF spatial audio cues for tree position feedback.
 *
 * Replaces the stereo StereoPannerNode approach with a full
 * 3D PannerNode chain via audio-engine's HRTF utilities.
 *
 * Pitch: root = 440 Hz, each depth level adds 50 Hz.
 * Tone shape: entering = sine, leaving = sawtooth, sibling = triangle.
 */

import { getAudioContext, initSpatialAudio, playSpatialTone } from '../audio-engine.js';
import { composePosition } from './spatial-mapping.js';

const BASE_FREQ = 440;
const FREQ_STEP = 50;

/**
 * Play a 3D spatial navigation cue.
 *
 * @param {object} currentNode  AST node at cursor (with .parent chain)
 * @param {number} depth        Current tree depth
 * @param {'enter'|'exit'|'sibling'} direction
 */
export function playNavigationCue(currentNode, depth, direction) {
  const audioContext = getAudioContext();
  initSpatialAudio(audioContext);

  const frequency = BASE_FREQ + depth * FREQ_STEP;
  const position  = composePosition(currentNode);

  const type     = direction === 'exit'    ? 'sawtooth'
                 : direction === 'sibling' ? 'triangle'
                 : 'sine';
  const duration = direction === 'sibling' ? 0.08 : 0.13;

  playSpatialTone(audioContext, position, frequency, type, duration);
}
