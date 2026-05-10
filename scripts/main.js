/**
 * main.js
 * Bootstrap: wires all modules together.
 * Features: Equation Navigator, Graph Sonifier, Tactile Export,
 *           HRTF Spatial Audio, Statistical NLG, Camera OCR,
 *           Custom Timbre, Voice Commands, Braille Display,
 *           Inverse Sonification, PWA/Service Worker.
 */

import { initAccessibilityShell, announceToScreenReader, toggleHighContrast, increaseFontSize, decreaseFontSize } from './accessibility-shell.js';
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

// Camera Capture
import { initCamera, stopCamera, captureFrame, preprocessImage } from './camera-capture/camera.js';
import { ocrResultsToLatex } from './camera-capture/math-cleanup.js';
import { showCaptureFeedback, showCaptureResult } from './camera-capture/viewfinder.js';
import { runOCR, prewarmOCRWorker } from './camera-capture/ocr-worker.js';

// Tactile Export
import { buildTactileSVG, downloadAsFile } from './tactile-export/svg-generator.js';

// Voice Commands
import { initSpeechInput } from './voice-commands/speech-input.js';
import { HELP_TEXT } from './voice-commands/intent-matcher.js';

// Braille Display
import { initVirtualDisplay, updateVirtualDisplay } from './braille-display/virtual-display.js';
import { connectBrailleDisplay, sendToBrailleDisplay, isConnected, BLUETOOTH_SUPPORTED } from './braille-display/bluetooth.js';
import { nodeToBraille } from './braille-display/math-to-braille.js';

// Inverse Sonification
import { openMicrophone } from './inverse-sonification/microphone.js';
import { detectPitch, classifyBuffer } from './inverse-sonification/pitch-detect.js';
import { fitContour } from './inverse-sonification/curve-fit.js';

const DEFAULT_SAMPLE_DATA = 'assets/sample-data/linear.csv';
const DEFAULT_EQUATION = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
const STORAGE_KEYS = {
  equation: 'eq_last_equation',
  sampleSource: 'eq_last_sample_source',
};

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAccessibilityShell();
  initEquationNavigator();
  initGraphSonifier();
  initTactileExport();
  initCameraCapture();
  initVoiceCommands();
  initBraillePanel();
  initInverseSonification();
  loadDefaultWorkspace().catch(err => console.warn('Default workspace failed to load', err));
  showHeadphonesPromptIfNeeded();
  prewarmOCRWorker();
});

// ── Headphones prompt ────────────────────────────────────────────────────────

async function showHeadphonesPromptIfNeeded() {
  if (localStorage.getItem('eq_headphones_dismissed')) return;
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

// ── Default workspace ────────────────────────────────────────────────────────

async function loadDefaultWorkspace() {
  const defaultSampleSource = localStorage.getItem(STORAGE_KEYS.sampleSource) || DEFAULT_SAMPLE_DATA;
  const samplePoints = await parseCSVFromURL(defaultSampleSource).catch(() => null);
  if (samplePoints?.length) {
    applyData(samplePoints, { announce: false });
  }

  const input = document.getElementById('latex-input');
  const savedEquation = localStorage.getItem(STORAGE_KEYS.equation) || DEFAULT_EQUATION;
  if (input && !input.value.trim()) {
    input.value = savedEquation;
  }

  if ((input?.value || savedEquation).trim()) {
    await loadEquation(input?.value?.trim() || savedEquation, { announce: false, focus: false, persistEquation: false });
  }
}

// ── Equation Navigator ───────────────────────────────────────────────────────

let eqAST    = null;
let eqCursor = null;
let eqSectionFocused = false;

function initEquationNavigator() {
  document.getElementById('btn-parse-eq').addEventListener('click', () => loadEquation());
  document.getElementById('latex-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') loadEquation();
  });
  document.getElementById('btn-speak-full')?.addEventListener('click', () => {
    if (!eqAST) return;
    speak(fullEquationToSpeech(eqAST));
  });

  const section = document.getElementById('section-equation');
  section.addEventListener('focusin',  () => { eqSectionFocused = true; });
  section.addEventListener('focusout', () => { eqSectionFocused = false; });
  document.addEventListener('keydown', handleEquationKey);
}

async function loadEquation(latexOverride, options = {}) {
  const {
    announce = true,
    focus = true,
    persistEquation = true,
  } = options;

  const input = document.getElementById('latex-input');
  const latex = typeof latexOverride === 'string' ? latexOverride : input.value.trim();
  if (!latex) return;

  input.value = latex;
  const display = document.getElementById('eq-rendered');
  display.innerHTML = `\\(${latex}\\)`;

  try {
    await MathJax.typesetPromise([display]);
    const mathItem     = MathJax.startup?.document?.getMathItemsWithin?.(display)?.[0];
    const mathmlSource = mathItem?.math?.toMathML?.() ?? `<math><mrow><mtext>${latex}</mtext></mrow></math>`;

    eqAST    = parseMathML(mathmlSource);
    eqCursor = initCursor(eqAST);

    if (persistEquation) {
      localStorage.setItem(STORAGE_KEYS.equation, latex);
    }

    document.getElementById('eq-controls').hidden = false;
    document.getElementById('braille-panel').hidden = false;
    updateCursorDisplay();

    if (announce) {
      announceToScreenReader('Equation loaded. Use arrow keys to navigate in spatial audio.');
    }
    if (focus) {
      display.setAttribute('tabindex', '-1');
      display.focus();
    }
  } catch (err) {
    console.error('MathJax error', err);
    announceToScreenReader('Could not parse equation. Check your LaTeX syntax.', 'assertive');
  }
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
    case ' ':          e.preventDefault(); speakCurrentNode(); return;
    case 'r': case 'R': speak(fullEquationToSpeech(eqAST)); return;
    default: return;
  }

  if (moved) {
    e.preventDefault();
    const ctx = getAudioContext();
    initSpatialAudio(ctx);
    const node  = currentNode(eqCursor);
    const depth = currentDepth(eqCursor);
    playNavigationCue(node, depth, direction);
    speakCurrentNode();
    updateCursorDisplay();
    updateBrailleDisplay(node, depth, eqCursor.siblingIndex);
  }
}

function speakCurrentNode() { speak(nodeToSpeech(currentNode(eqCursor))); }

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
let analysisWorker = null;

function getAnalysisWorker() {
  if (!analysisWorker) {
    analysisWorker = new Worker('workers/analysis.worker.js', { type: 'module' });
  }
  return analysisWorker;
}

function initGraphSonifier() {
  document.getElementById('csv-upload').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    await loadGraphFromFile(file);
  });

  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', async () => {
      await loadGraphFromSource(btn.dataset.file, { persistSampleSource: true });
    });
  });

  document.getElementById('playback-speed').addEventListener('input', e => {
    document.getElementById('playback-speed-value').textContent = `${e.target.value}s`;
  });

  document.getElementById('btn-play').addEventListener('click', startPlayback);
  document.getElementById('btn-stop').addEventListener('click', stopPlayback);
  document.getElementById('btn-replay').addEventListener('click', () => {
    stopPlayback(); setTimeout(startPlayback, 100);
  });
}

async function loadGraphFromFile(file, options = {}) {
  const points = await parseCSV(file).catch(err => {
    announceToScreenReader(`Error: ${err.message}`, 'assertive');
    return null;
  });
  if (points) applyData(points, options);
}

async function loadGraphFromSource(source, options = {}) {
  const points = await parseCSVFromURL(source).catch(err => {
    announceToScreenReader(`Error: ${err.message}`, 'assertive');
    return null;
  });
  if (points) applyData(points, { ...options, source });
}

function applyData(points, options = {}) {
  const {
    announce = true,
    persistSampleSource = false,
    source = '',
  } = options;

  const normalized = normalizeData(points);
  graphData   = normalized.points;
  graphBounds = normalized;

  if (persistSampleSource && source) {
    localStorage.setItem(STORAGE_KEYS.sampleSource, source);
  }

  renderChart(graphData, document.getElementById('chart-container'), graphBounds);
  document.getElementById('graph-data-summary').textContent = describeDataset(normalized);

  // Run analysis in Web Worker (Feature 9)
  const worker = getAnalysisWorker();
  worker.postMessage({ type: 'analyze', points: graphData });
  worker.onmessage = (e) => {
    if (e.data.type !== 'result') return;
    nlgDescription = e.data.nlgDescription;
    document.getElementById('graph-analysis-result').textContent = `Analysis: ${nlgDescription}`;
  };

  document.getElementById('graph-controls').hidden = false;
  document.getElementById('btn-play').disabled   = false;
  document.getElementById('btn-replay').disabled = false;
  document.getElementById('btn-export-tactile').disabled = false;

  if (announce) {
    announceToScreenReader(describeDataset(normalized));
  }
}

function startPlayback() {
  if (!graphData) return;
  getAudioContext();

  document.getElementById('btn-play').disabled = true;
  document.getElementById('btn-stop').disabled = false;

  if (nlgDescription && 'speechSynthesis' in window) {
    const utt = new SpeechSynthesisUtterance(nlgDescription);
    utt.rate = 0.95;
    utt.onend = playAudio;
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
  document.getElementById('btn-start-camera').addEventListener('click', async () => {
    showCaptureFeedback('capturing');
    try {
      cameraStream = await initCamera(document.getElementById('camera-video'));
      showCaptureFeedback('active');
      document.getElementById('btn-capture').disabled = false;
    } catch (err) {
      showCaptureFeedback('error', `Camera unavailable: ${err.message}`);
    }
  });

  document.getElementById('btn-stop-camera').addEventListener('click', () => {
    stopCamera(cameraStream); cameraStream = null;
    showCaptureFeedback('idle');
    document.getElementById('btn-capture').disabled = true;
  });

  document.getElementById('btn-capture').addEventListener('click', async () => {
    const videoEl = document.getElementById('camera-video');
    const canvas  = document.getElementById('camera-preview-canvas');
    showCaptureFeedback('capturing');
    const rawFrame = captureFrame(videoEl, canvas);
    canvas.hidden  = false;
    await runOCRAndLoad(rawFrame);
  });

  document.getElementById('image-upload')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await fileToImageData(file);
    await runOCRAndLoad(img);
  });

  document.getElementById('camera-result')?.addEventListener('click', e => {
    if (e.target.id === 'btn-use-captured') {
      const latex = document.getElementById('camera-result')?.dataset.capturedLatex;
      if (latex) { loadEquation(latex); document.getElementById('section-equation').scrollIntoView({ behavior: 'smooth' }); }
    }
    if (e.target.id === 'btn-retry-capture') {
      document.getElementById('camera-result').hidden = true;
      showCaptureFeedback('active');
    }
  });
}

async function runOCRAndLoad(imageData) {
  showCaptureFeedback('processing');
  try {
    const processed = preprocessImage(imageData);
    const { words }  = await runOCR(processed);
    const { latex, confidence } = ocrResultsToLatex(words, processed);
    if (!latex) { showCaptureFeedback('error', 'No text detected. Try better lighting.'); return; }
    showCaptureFeedback('success', `Captured: ${latex}`);
    showCaptureResult(confidence, latex);
    document.getElementById('camera-result').dataset.capturedLatex = latex;
  } catch (err) {
    showCaptureFeedback('error', `OCR failed: ${err.message}`);
  }
}

async function fileToImageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const cvs = document.createElement('canvas');
        cvs.width = img.width; cvs.height = img.height;
        cvs.getContext('2d').drawImage(img, 0, 0);
        resolve(cvs.getContext('2d').getImageData(0, 0, img.width, img.height));
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

// ── Voice Commands (Feature 8) ───────────────────────────────────────────────

let voiceController = null;

function initVoiceCommands() {
  const startBtn = document.getElementById('btn-voice-start');
  const stopBtn  = document.getElementById('btn-voice-stop');
  const bar      = document.getElementById('voice-status-bar');

  voiceController = initSpeechInput(
    handleVoiceIntent,
    (msg) => {
      const el = document.getElementById('voice-status-text');
      if (el) el.textContent = msg;
    }
  );

  startBtn?.addEventListener('click', () => {
    voiceController.start();
    bar.hidden = false;
    startBtn.textContent = 'Voice Commands On';
  });

  stopBtn?.addEventListener('click', () => {
    voiceController.stop();
    bar.hidden = true;
    startBtn.textContent = 'Enable Voice Commands';
  });
}

function handleVoiceIntent(intent, params) {
  announceToScreenReader(`Command: ${intent}`);

  switch (intent) {
    case 'navigate':
      if (!eqAST) break;
      const direction = params.dir;
      eqSectionFocused = true; // temporarily allow navigation
      const keyMap = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: keyMap[direction], bubbles: true }));
      setTimeout(() => { eqSectionFocused = false; }, 200);
      break;
    case 'read_equation':   if (eqAST) speak(fullEquationToSpeech(eqAST)); break;
    case 'describe_node':   if (eqAST) speakCurrentNode(); break;
    case 'play':            startPlayback(); break;
    case 'stop':            stopPlayback(); break;
    case 'replay':          stopPlayback(); setTimeout(startPlayback, 100); break;
    case 'speed':
      const slider = document.getElementById('playback-speed');
      if (slider) {
        slider.value = Math.max(2, Math.min(15, Number(slider.value) + params.delta));
        document.getElementById('playback-speed-value').textContent = `${slider.value}s`;
        announceToScreenReader(`Playback speed: ${slider.value} seconds`);
      }
      break;
    case 'load_sample':
      document.querySelector(`.btn-sample[data-file="assets/sample-data/${params.name}.csv"]`)?.click();
      break;
    case 'describe_outliers':
      if (nlgDescription) speak(nlgDescription); break;
    case 'describe_data':
      if (nlgDescription) speak(nlgDescription); break;
    case 'toggle_contrast': toggleHighContrast(); break;
    case 'font_up':         increaseFontSize(); break;
    case 'font_down':       decreaseFontSize(); break;
    case 'start_inverse':   document.getElementById('btn-hum-start')?.click(); break;
    case 'stop_inverse':    document.getElementById('btn-hum-stop')?.click(); break;
    case 'help':            speak(HELP_TEXT); break;
  }
}

// ── Braille Display (Feature 6) ──────────────────────────────────────────────

function initBraillePanel() {
  const container = document.getElementById('braille-container');
  if (container) initVirtualDisplay(container);

  const btBtn = document.getElementById('btn-connect-bluetooth');
  if (btBtn) {
    if (!BLUETOOTH_SUPPORTED) {
      btBtn.disabled = true;
      btBtn.title = 'Web Bluetooth not supported in this browser';
    }
    btBtn.addEventListener('click', async () => {
      const connected = await connectBrailleDisplay();
      const status = document.getElementById('bluetooth-status');
      if (status) status.textContent = connected ? 'Physical display connected.' : 'No device selected.';
      announceToScreenReader(connected ? 'Braille display connected.' : 'No Braille display connected.');
    });
  }
}

function updateBrailleDisplay(node, depth, siblingIndex) {
  updateVirtualDisplay(node, depth, siblingIndex ?? 0);
  if (isConnected()) {
    const braille = nodeToBraille(node);
    sendToBrailleDisplay(braille);
  }
}

// ── Inverse Sonification (Feature 4) ─────────────────────────────────────────

let micStop = null;
const pitchContour = [];
let humStartTime   = 0;

function initInverseSonification() {
  document.getElementById('btn-hum-start')?.addEventListener('click', startHumming);
  document.getElementById('btn-hum-stop')?.addEventListener('click', stopHumming);
}

async function startHumming() {
  const ctx = getAudioContext();
  pitchContour.length = 0;
  humStartTime = ctx.currentTime;

  const statusEl = document.getElementById('hum-status');
  const resultEl = document.getElementById('hum-result');
  if (statusEl) statusEl.textContent = 'Recording — hum a rising or falling curve…';
  if (resultEl) resultEl.textContent = '';

  try {
    const { stop } = await openMicrophone(ctx, (buffer) => {
      const type = classifyBuffer(buffer);
      if (type !== 'voiced') return;
      const hz = detectPitch(buffer, ctx.sampleRate);
      if (hz > 0) {
        pitchContour.push({ t: ctx.currentTime - humStartTime, hz });
      }
    });
    micStop = stop;

    document.getElementById('btn-hum-start').disabled = true;
    document.getElementById('btn-hum-stop').disabled  = false;
    announceToScreenReader('Recording started. Hum a curve, then press Stop and Fit.');
  } catch (err) {
    if (statusEl) statusEl.textContent = `Microphone error: ${err.message}`;
    announceToScreenReader(`Microphone error: ${err.message}`, 'assertive');
  }
}

function stopHumming() {
  micStop?.();
  micStop = null;

  document.getElementById('btn-hum-start').disabled = false;
  document.getElementById('btn-hum-stop').disabled  = true;

  const statusEl = document.getElementById('hum-status');
  const resultEl = document.getElementById('hum-result');

  if (pitchContour.length < 8) {
    if (statusEl) statusEl.textContent = 'Not enough data. Try humming for at least 2 seconds.';
    return;
  }

  if (statusEl) statusEl.textContent = `Fitting equation to ${pitchContour.length} pitch samples…`;

  const fit = fitContour(pitchContour);
  const msg = fit.latex
    ? `Best fit (R²=${fit.r2.toFixed(2)}): ${fit.type} — ${fit.latex}`
    : 'Could not fit a clean curve. Try a smoother hum.';

  if (resultEl) resultEl.textContent = msg;
  announceToScreenReader(msg);

  if (fit.latex) {
    // Load into equation navigator
    document.getElementById('latex-input').value = fit.latex;
    loadEquation(fit.latex, { persistEquation: true });
    if (statusEl) statusEl.textContent += ' — Loaded into Equation Navigator.';
  }
}
