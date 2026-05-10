/**
 * cues.js
 * Spatial + timbral audio cues for tree navigation.
 * Each MathML node type has a distinct timbre (additive synthesis)
 * AND a distinct 3D HRTF position.
 *
 * Pitch: root = 440 Hz, each depth level adds 50 Hz.
 */

import { getAudioContext, initSpatialAudio } from '../audio-engine.js';
import { composePosition } from './spatial-mapping.js';
import { playTimbredCue } from '../timbre/synthesis.js';

const BASE_FREQ = 440;
const FREQ_STEP = 50;

/**
 * @param {object} currentNode  AST node at cursor (with .parent chain)
 * @param {number} depth        Current tree depth
 * @param {'enter'|'exit'|'sibling'} direction
 */
export function playNavigationCue(currentNode, depth, direction) {
  const audioContext = getAudioContext();
  initSpatialAudio(audioContext);

  const frequency = BASE_FREQ + depth * FREQ_STEP;
  const position  = composePosition(currentNode);

  playTimbredCue(audioContext, position, frequency, currentNode.tag, direction);
}
