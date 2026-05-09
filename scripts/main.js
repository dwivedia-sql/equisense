/**
 * main.js
 * Bootstrap: wires all modules together.
 * Owns no logic beyond initialization and event binding.
 */

import { initAccessibilityShell, announceToScreenReader } from './accessibility-shell.js';
import { getAudioContext } from './audio-engine.js';

// Equation Navigator
import { parseMathML } from './equation-navigator/parser.js';
import { initCursor, moveDown, moveUp, moveLeft, moveRight, currentNode, currentDepth } from './equation-navigator/walker.js';
import { nodeToSpeech, fullEquationToSpeech, speak, stopSpeaking } from './equation-navigator/speech.js';
import { playNavigationCue } from './equation-navigator/cues.js';

// Graph Sonifier
import { parseCSV, parseCSVFromURL } from './graph-sonifier/csv.js';
import { normalizeData, describeDataset } from './graph-sonifier/mapping.js';
import { buildAudioSchedule } from './graph-sonifier/scheduler.js';
import { renderChart, syncCursor, hideCursor } from './graph-sonifier/chart.js';

// Tactile Export
import { buildTactileSVG, downloadAsFile } from './tactile-export/svg-generator.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAccessibilityShell();
  initEquationNavigator();
  initGraphSonifier();
  initTactileExport();
});

// ── Equation Navigator ───────────────────────────────────────────────────────

let eqAST = null;
let eqCursor = null;
let eqSectionFocused = false;

function initEquationNavigator() {
  document.getElementById('btn-parse-eq').addEventListener('click', loadEquation);
  document.getElementById('latex-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') loadEquation();
  });
  document.getElementById('btn-speak-full')?.addEventListener('click', () => {
    if (!eqAST) return;
    speak(fullEquationToSpeech(eqAST));
  });

  // Keyboard navigation — only when focus is inside the equation section
  const section = document.getElementById('section-equation');
  section.addEventListener('focusin', () => { eqSectionFocused = true; });
  section.addEventListener('focusout', () => { eqSectionFocused = false; });
  document.addEventListener('keydown', handleEquationKey);
}

async function loadEquation() {
  const input = document.getElementById('latex-input');
  const latex = input.value.trim();
  if (!latex) return;

  const display = document.getElementById('eq-rendered');
  display.innerHTML = `\\(${latex}\\)`;

  // Let MathJax render, then parse the MathML it produced
  try {
    await MathJax.typesetPromise([display]);
    const mathEl = display.querySelector('mjx-container')?.querySelector('svg') ?? display;

    // MathJax exposes the MathML source via its internal API
    const mathmlSource = MathJax.startup.document.getMathItemsWithin(display)?.[0]
      ?.math?.toMathML?.() ?? buildFallbackMathML(latex);

    eqAST = parseMathML(mathmlSource);
    eqCursor = initCursor(eqAST);

    document.getElementById('eq-controls').hidden = false;
    updateCursorDisplay();

    announceToScreenReader('Equation loaded. Use arrow keys to navigate.');
    display.setAttribute('tabindex', '-1');
    display.focus();
  } catch (err) {
    console.error('MathJax render error', err);
    announceToScreenReader('Could not parse equation. Check your LaTeX syntax.', 'assertive');
  }
}

/** Minimal fallback if MathJax MathML API isn't available in this version */
function buildFallbackMathML(latex) {
  return `<math><mrow><mtext>${latex}</mtext></mrow></math>`;
}

function handleEquationKey(e) {
  if (!eqAST || !eqSectionFocused) return;
  // Don't steal keys when focus is in the text input
  if (document.activeElement?.id === 'latex-input') return;

  let moved = false;
  let direction = 'sibling';

  switch (e.key) {
    case 'ArrowDown':  eqCursor = moveDown(eqCursor);  direction = 'enter';   moved = true; break;
    case 'ArrowUp':    eqCursor = moveUp(eqCursor);    direction = 'exit';    moved = true; break;
    case 'ArrowRight': eqCursor = moveRight(eqCursor); direction = 'sibling'; moved = true; break;
    case 'ArrowLeft':  eqCursor = moveLeft(eqCursor);  direction = 'sibling'; moved = true; break;
    case ' ':
      e.preventDefault();
      speakCurrentNode();
      return;
    case 'r': case 'R':
      speak(fullEquationToSpeech(eqAST));
      return;
    default: return;
  }

  if (moved) {
    e.preventDefault();
    getAudioContext(); // ensure context is running after user gesture
    const node = currentNode(eqCursor);
    const depth = currentDepth(eqCursor);
    playNavigationCue(depth, node.tag, direction);
    speakCurrentNode();
    updateCursorDisplay();
  }
}

function speakCurrentNode() {
  const node = currentNode(eqCursor);
  speak(nodeToSpeech(node));
}

function updateCursorDisplay() {
  const node  = currentNode(eqCursor);
  const depth = currentDepth(eqCursor);
  const text  = nodeToSpeech(node);
  const desc  = document.getElementById('eq-cursor-description');
  if (desc) desc.textContent = `Depth ${depth}: ${text}`;
  announceToScreenReader(text);
}

// ── Graph Sonifier ───────────────────────────────────────────────────────────

let graphData   = null;
let graphBounds = null;
let schedule    = null;

function initGraphSonifier() {
  document.getElementById('csv-upload').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    await loadAndRenderData(file);
  });

  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.file;
      await loadAndRenderDataFromURL(url);
    });
  });

  document.getElementById('playback-speed').addEventListener('input', e => {
    document.getElementById('playback-speed-value').textContent = `${e.target.value}s`;
  });

  document.getElementById('btn-play').addEventListener('click', startPlayback);
  document.getElementById('btn-stop').addEventListener('click', stopPlayback);
  document.getElementById('btn-replay').addEventListener('click', () => {
    stopPlayback();
    setTimeout(startPlayback, 100);
  });
}

async function loadAndRenderData(file) {
  try {
    const points = await parseCSV(file);
    applyData(points);
  } catch (err) {
    announceToScreenReader(`Error: ${err.message}`, 'assertive');
  }
}

async function loadAndRenderDataFromURL(url) {
  try {
    const points = await parseCSVFromURL(url);
    applyData(points);
  } catch (err) {
    announceToScreenReader(`Error loading sample: ${err.message}`, 'assertive');
  }
}

function applyData(points) {
  const normalized = normalizeData(points);
  graphData   = normalized.points;
  graphBounds = normalized;

  const container = document.getElementById('chart-container');
  renderChart(graphData, container, graphBounds);

  const summary = describeDataset(normalized);
  document.getElementById('graph-data-summary').textContent = summary;
  announceToScreenReader(summary);

  document.getElementById('graph-controls').hidden = false;
  document.getElementById('btn-play').disabled  = false;
  document.getElementById('btn-replay').disabled = false;

  // Enable tactile export
  document.getElementById('btn-export-tactile').disabled = false;
}

function startPlayback() {
  if (!graphData) return;
  getAudioContext(); // wake AudioContext on user gesture
  const duration = Number(document.getElementById('playback-speed').value);

  schedule = buildAudioSchedule(graphData, graphBounds, duration);

  document.getElementById('btn-play').disabled  = true;
  document.getElementById('btn-stop').disabled  = false;

  schedule.play(
    progress => syncCursor(progress, graphBounds),
    () => {
      hideCursor();
      document.getElementById('btn-play').disabled  = false;
      document.getElementById('btn-stop').disabled  = true;
      announceToScreenReader('Playback complete.');
    }
  );
  announceToScreenReader('Playing dataset as audio. Low pitch = low value, high pitch = high value, left to right follows x-axis.');
}

function stopPlayback() {
  schedule?.stop();
  hideCursor();
  document.getElementById('btn-play').disabled  = false;
  document.getElementById('btn-stop').disabled  = true;
}

// ── Tactile Export ───────────────────────────────────────────────────────────

function initTactileExport() {
  document.getElementById('btn-export-tactile').addEventListener('click', () => {
    if (!graphData || !graphBounds) return;
    const svg = buildTactileSVG(graphData, graphBounds, { title: 'EquiSense Data', xLabel: 'x', yLabel: 'y' });
    downloadAsFile(svg, 'equisense-tactile.svg');
    announceToScreenReader('Tactile SVG downloaded.');
  });
}
