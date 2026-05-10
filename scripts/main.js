/**
 * main.js
 * Bootstrap: wires all modules together.
 */

import { initAccessibilityShell, announceToScreenReader } from './accessibility-shell.js';
import { getAudioContext, initSpatialAudio, detectHeadphones } from './audio-engine.js';

// Equation Navigator
import { parseMathML } from './equation-navigator/parser.js';
import { initCursor, moveDown, moveUp, moveLeft, moveRight, currentNode, currentDepth } from './equation-navigator/walker.js';
import { nodeToSpeech, fullEquationToSpeech, speak } from './equation-navigator/speech.js';
import { playNavigationCue } from './equation-navigator/cues.js';

// Graph Sonifier
import { parseCSV, parseCSVFromURL } from './graph-sonifier/csv.js';
import { normalizeData, describeDataset } from './graph-sonifier/mapping.js';
import { buildAudioSchedule } from './graph-sonifier/scheduler.js';
import { renderChart, syncCursor, hideCursor } from './graph-sonifier/chart.js';

// Data Analysis
import { computeStats, linearRegression, detectOutliers } from './data-analysis/stats.js';
import { classifyPattern } from './data-analysis/pattern-detect.js';
import { composeDescription } from './data-analysis/nlg.js';

// Camera Capture
import { initCamera, stopCamera, captureFrame, preprocessImage } from './camera-capture/camera.js';
import { ocrResultsToLatex } from './camera-capture/math-cleanup.js';
import { showCaptureFeedback, showCaptureResult } from './camera-capture/viewfinder.js';
import { runOCR, prewarmOCRWorker } from './camera-capture/ocr-worker.js';

// Tactile Export
import { buildTactileSVG, downloadAsFile } from './tactile-export/svg-generator.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAccessibilityShell();
  initEquationNavigator();
  initGraphSonifier();
  initTactileExport();
  initCameraCapture();
  showHeadphonesPromptIfNeeded();
  prewarmOCRWorker(); // load Tesseract in background
});

// ── Headphones prompt ────────────────────────────────────────────────────────

async function showHeadphonesPromptIfNeeded() {
  const dismissed = localStorage.getItem('eq_headphones_dismissed');
  if (dismissed) return;
  const hasHeadphones = await detectHeadphones();
  if (!hasHeadphones) {
    const prompt = document.getElementById('headphones-prompt');
    if (prompt) prompt.hidden = false;
    document.getElementById('btn-dismiss-headphones')?.addEventListener('click', () => {
      prompt.hidden = true;
      localStorage.setItem('eq_headphones_dismissed', '1');
    });
  }
}

// ── Equation Navigator ───────────────────────────────────────────────────────

let eqAST    = null;
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

  const section = document.getElementById('section-equation');
  section.addEventListener('focusin',  () => { eqSectionFocused = true;  });
  section.addEventListener('focusout', () => { eqSectionFocused = false; });
  document.addEventListener('keydown', handleEquationKey);
}

async function loadEquation(latexOverride) {
  const input = document.getElementById('latex-input');
  const latex = latexOverride ?? input.value.trim();
  if (!latex) return;

  if (!latexOverride) input.value = latex; // keep field in sync when called from camera

  const display = document.getElementById('eq-rendered');
  display.innerHTML = `\\(${latex}\\)`;

  try {
    await MathJax.typesetPromise([display]);

    // Extract MathML from MathJax's internal representation
    const mathItem = MathJax.startup?.document?.getMathItemsWithin?.(display)?.[0];
    const mathmlSource = mathItem?.math?.toMathML?.() ?? buildFallbackMathML(latex);

    eqAST    = parseMathML(mathmlSource);
    eqCursor = initCursor(eqAST);

    document.getElementById('eq-controls').hidden = false;
    updateCursorDisplay();

    announceToScreenReader('Equation loaded. Use arrow keys to navigate in 3D spatial audio.');
    display.setAttribute('tabindex', '-1');
    display.focus();
  } catch (err) {
    console.error('MathJax render error', err);
    announceToScreenReader('Could not parse equation. Check your LaTeX syntax.', 'assertive');
  }
}

function buildFallbackMathML(latex) {
  return `<math><mrow><mtext>${latex}</mtext></mrow></math>`;
}

function handleEquationKey(e) {
  if (!eqAST || !eqSectionFocused) return;
  if (document.activeElement?.id === 'latex-input') return;

  let direction = 'sibling';
  let moved = false;

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
    const ctx = getAudioContext();
    initSpatialAudio(ctx); // idempotent
    const node  = currentNode(eqCursor);
    const depth = currentDepth(eqCursor);
    playNavigationCue(node, depth, direction);
    speakCurrentNode();
    updateCursorDisplay();
  }
}

function speakCurrentNode() {
  speak(nodeToSpeech(currentNode(eqCursor)));
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

let graphData    = null;
let graphBounds  = null;
let schedule     = null;
let nlgDescription = '';

function initGraphSonifier() {
  document.getElementById('csv-upload').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    await loadAndRenderData(file);
  });

  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', () => loadAndRenderDataFromURL(btn.dataset.file));
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

  renderChart(graphData, document.getElementById('chart-container'), graphBounds);

  const summary = describeDataset(normalized);
  document.getElementById('graph-data-summary').textContent = summary;

  // Statistical pre-analysis
  const stats      = computeStats(graphData);
  const regression = linearRegression(graphData);
  const outliers   = detectOutliers(graphData);
  const { pattern, ...patternDetail } = classifyPattern(graphData, stats, regression);
  nlgDescription = composeDescription(graphData, pattern, stats, regression, outliers, patternDetail);

  document.getElementById('graph-analysis-result').textContent = `Analysis: ${nlgDescription}`;
  announceToScreenReader(summary);

  document.getElementById('graph-controls').hidden = false;
  document.getElementById('btn-play').disabled   = false;
  document.getElementById('btn-replay').disabled = false;
  document.getElementById('btn-export-tactile').disabled = false;
}

function startPlayback() {
  if (!graphData) return;
  getAudioContext(); // wake context on user gesture

  document.getElementById('btn-play').disabled = true;
  document.getElementById('btn-stop').disabled = false;

  // Speak NLG description first, then start audio when TTS finishes
  if (nlgDescription && 'speechSynthesis' in window) {
    const utt = new SpeechSynthesisUtterance(nlgDescription);
    utt.rate = 0.95;
    utt.onend = () => playAudio();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  } else {
    playAudio();
  }
}

function playAudio() {
  const duration = Number(document.getElementById('playback-speed').value);
  schedule = buildAudioSchedule(graphData, graphBounds, duration);
  schedule.play(
    progress => syncCursor(progress, graphBounds),
    () => {
      hideCursor();
      document.getElementById('btn-play').disabled = false;
      document.getElementById('btn-stop').disabled = true;
      announceToScreenReader('Playback complete.');
    }
  );
}

function stopPlayback() {
  window.speechSynthesis?.cancel();
  schedule?.stop();
  hideCursor();
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = true;
}

// ── Camera Capture ───────────────────────────────────────────────────────────

let cameraStream = null;

function initCameraCapture() {
  document.getElementById('btn-start-camera').addEventListener('click', startCameraFlow);
  document.getElementById('btn-stop-camera').addEventListener('click', stopCameraFlow);
  document.getElementById('btn-capture').addEventListener('click', captureAndOCR);

  document.getElementById('image-upload')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await fileToImageData(file);
    await runOCROnImageData(img);
  });

  // Wire result buttons via delegation (buttons are created dynamically)
  document.getElementById('camera-result')?.addEventListener('click', e => {
    if (e.target.id === 'btn-use-captured') useCapturedEquation();
    if (e.target.id === 'btn-retry-capture') retryCapture();
  });
}

async function startCameraFlow() {
  const videoEl = document.getElementById('camera-video');
  showCaptureFeedback('capturing');
  try {
    cameraStream = await initCamera(videoEl);
    showCaptureFeedback('active');
    document.getElementById('btn-capture').disabled = false;
  } catch (err) {
    showCaptureFeedback('error', `Camera not available: ${err.message}. Try the image upload option.`);
  }
}

function stopCameraFlow() {
  stopCamera(cameraStream);
  cameraStream = null;
  showCaptureFeedback('idle');
  document.getElementById('btn-capture').disabled = true;
}

async function captureAndOCR() {
  const videoEl  = document.getElementById('camera-video');
  const canvas   = document.getElementById('camera-preview-canvas');

  showCaptureFeedback('capturing');
  const rawFrame  = captureFrame(videoEl, canvas);
  canvas.hidden   = false;

  showCaptureFeedback('processing');
  await runOCROnImageData(rawFrame);
}

async function runOCROnImageData(imageData) {
  showCaptureFeedback('processing');
  try {
    const processed = preprocessImage(imageData);
    const { words }  = await runOCR(processed);
    const { latex, confidence } = ocrResultsToLatex(words, processed);

    if (!latex) {
      showCaptureFeedback('error', 'No text detected. Try better lighting or a clearer photo.');
      return;
    }

    showCaptureFeedback('success', `Captured: ${latex}`);
    showCaptureResult(confidence, latex);

    // Store for "Load into Navigator" button
    document.getElementById('camera-result').dataset.capturedLatex = latex;

    // Wire buttons after render
    document.getElementById('btn-use-captured')?.addEventListener('click', useCapturedEquation);
    document.getElementById('btn-retry-capture')?.addEventListener('click', retryCapture);

  } catch (err) {
    showCaptureFeedback('error', `OCR failed: ${err.message}`);
  }
}

function useCapturedEquation() {
  const latex = document.getElementById('camera-result')?.dataset.capturedLatex;
  if (!latex) return;
  document.getElementById('latex-input').value = latex;
  loadEquation(latex);
  document.getElementById('section-equation').scrollIntoView({ behavior: 'smooth' });
  announceToScreenReader('Equation loaded into navigator. Scroll to Equation Navigator section.');
}

function retryCapture() {
  document.getElementById('camera-result').hidden = true;
  showCaptureFeedback('active');
}

async function fileToImageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
