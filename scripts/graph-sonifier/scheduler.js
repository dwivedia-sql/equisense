/**
 * scheduler.js
 * Schedules Web Audio events to sonify a dataset.
 * Uses AudioContext.currentTime as the single source of truth for timing.
 */

import { getAudioContext } from '../audio-engine.js';
import { mapY, mapIndexToPan } from './mapping.js';

/**
 * Build and return playback controls for a dataset.
 *
 * @param {{x:number,y:number}[]} points
 * @param {{ yMin:number, yMax:number }} bounds
 * @param {number} duration  total playback time in seconds
 * @returns {{ play: Function, stop: Function }}
 */
export function buildAudioSchedule(points, bounds, duration) {
  const { yMin, yMax } = bounds;
  let osc = null;
  let panner = null;
  let playing = false;

  function play(onProgress, onEnd) {
    if (playing) return;
    playing = true;

    const ctx = getAudioContext();
    const startTime = ctx.currentTime + 0.05;

    osc    = ctx.createOscillator();
    panner = ctx.createStereoPanner();
    const gain = ctx.createGain();

    osc.type = 'sine';
    gain.gain.setValueAtTime(0.35, ctx.currentTime);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    const N = points.length;

    // Schedule frequency and pan ramps for every data point
    points.forEach((point, i) => {
      const t   = startTime + (i / (N - 1 || 1)) * duration;
      const freq = mapY(point.y, yMin, yMax);
      const pan  = mapIndexToPan(i, N);

      osc.frequency.linearRampToValueAtTime(freq, t);
      panner.pan.linearRampToValueAtTime(pan, t);
    });

    // Fade out at the end
    gain.gain.setValueAtTime(0.35, startTime + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);

    // Progress callback — fires roughly every animation frame
    let rafId;
    function tick() {
      if (!playing) return;
      const elapsed = ctx.currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      onProgress?.(progress);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        playing = false;
        onEnd?.();
      }
    }
    rafId = requestAnimationFrame(tick);

    osc.onended = () => {
      cancelAnimationFrame(rafId);
      playing = false;
      onEnd?.();
    };
  }

  function stop() {
    if (!playing) return;
    try { osc?.stop(); } catch (_) {}
    playing = false;
  }

  return { play, stop, isPlaying: () => playing };
}
