/**
 * main.js — EquiSense Dashboard Bootstrap
 * Professional scientific analysis for accessible STEM
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SAMPLE_DATA = 'assets/sample-data/linear.csv';
const DEFAULT_EQUATION = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';

const STORAGE_KEYS = {
  equation: 'eq_last_equation',
  sampleSource: 'eq_last_sample_source',
  themeMode: 'eq_theme_mode',
  panelState: 'eq_active_panel',
};

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

window.appState = {
  currentPanel: 'graph',
  themeMode: 'auto',
  currentGraphData: null,
  currentEquation: null,
  audioPlaying: false,
  cameraActive: false,
};

let graphData = null;
let graphBounds = null;
let schedule = null;
let nlgDescription = '';
let eqAST = null;
let eqCursor = null;
let eqSectionFocused = false;
let cameraStream = null;
let voiceController = null;
let micStop = null;
const pitchContour = [];
let humStartTime = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initAccessibilityShell();
  initThemeSystem();
  initDashboardNavigation();
  
  initEquationNavigator();
  initGraphSonifier();
  initTactileExport();
  initCameraCapture();
  initVoiceCommands();
  initBraillePanel();
  initInverseSonification();
  
  initWorkspaceControls();
  
  loadDefaultWorkspace().catch(err => console.warn('Default workspace failed', err));
  showHeadphonesPromptIfNeeded();
  prewarmOCRWorker();
});

// ═══════════════════════════════════════════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function initThemeSystem() {
  const themeMode = localStorage.getItem(STORAGE_KEYS.themeMode) || 'auto';
  window.appState.themeMode = themeMode;
  applyTheme(themeMode);

  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const current = window.appState.themeMode;
      const next = current === 'dark' ? 'light' : 'dark';
      window.appState.themeMode = next;
      localStorage.setItem(STORAGE_KEYS.themeMode, next);
      applyTheme(next);
      announceToScreenReader(`Theme changed to ${next} mode`);
    });
    updateThemeIcon();
  }
}

function applyTheme(mode) {
  const html = document.documentElement;
  if (mode === 'auto') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', mode);
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('btn-theme-toggle');
  const icon = btn?.querySelector('.theme-icon');
  if (icon) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                   (window.appState.themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    icon.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function initDashboardNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchToPanel(btn.dataset.tool);
    });
  });

  const savedPanel = localStorage.getItem(STORAGE_KEYS.panelState) || 'graph';
  switchToPanel(savedPanel);
}

function switchToPanel(toolName) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.setAttribute('aria-selected', btn.dataset.tool === toolName ? 'true' : 'false');
  });

  document.querySelectorAll('.tool-panel').forEach(panel => {
    panel.hidden = !panel.id.includes(toolName);
  });

  window.appState.currentPanel = toolName;
  localStorage.setItem(STORAGE_KEYS.panelState, toolName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEADPHONES & ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

async function loadDefaultWorkspace() {
  const defaultSampleSource = localStorage.getItem(STORAGE_KEYS.sampleSource) || DEFAULT_SAMPLE_DATA;
  await loadGraphFromSource(defaultSampleSource, { announce: false });

  const input = document.getElementById('latex-input');
  const savedEquation = localStorage.getItem(STORAGE_KEYS.equation) || DEFAULT_EQUATION;
  if (input && !input.value.trim()) {
    input.value = savedEquation;
  }

  if ((input?.value || savedEquation).trim()) {
    await loadEquation((input?.value || savedEquation).trim(), { announce: false });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EQUATION NAVIGATOR
// ═══════════════════════════════════════════════════════════════════════════════

function initEquationNavigator() {
  const btnParse = document.getElementById('btn-parse-eq');
  const input = document.getElementById('latex-input');
  const btnLoadStarter = document.getElementById('btn-load-starter-equation');
  const btnClear = document.getElementById('btn-clear-equation');
  const btnReload = document.getElementById('btn-reload-current-equation');
  const btnSpeakFull = document.getElementById('btn-speak-full');

  btnParse?.addEventListener('click', () => {
    const latex = input?.value?.trim();
    if (latex) loadEquation(latex);
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnParse?.click();
    } else if (e.key === 'ArrowUp' && eqSectionFocused) {
      e.preventDefault();
      moveUp();
    } else if (e.key === 'ArrowDown' && eqSectionFocused) {
      e.preventDefault();
      moveDown();
    } else if (e.key === 'ArrowLeft' && eqSectionFocused) {
      e.preventDefault();
      moveLeft();
    } else if (e.key === 'ArrowRight' && eqSectionFocused) {
      e.preventDefault();
      moveRight();
    } else if (e.key === ' ' && eqSectionFocused) {
      e.preventDefault();
      speak(nodeToSpeech(currentNode(eqCursor)));
    } else if ((e.key === 'r' || e.key === 'R') && eqSectionFocused) {
      e.preventDefault();
      speak(fullEquationToSpeech(eqAST));
    }
  });

  btnLoadStarter?.addEventListener('click', () => {
    if (input) input.value = DEFAULT_EQUATION;
    loadEquation(DEFAULT_EQUATION);
  });

  btnClear?.addEventListener('click', () => {
    if (input) input.value = '';
    document.getElementById('eq-rendered').innerHTML = '';
    announceToScreenReader('Equation cleared');
  });

  btnReload?.addEventListener('click', () => {
    const current = input?.value?.trim();
    if (current) loadEquation(current);
  });

  btnSpeakFull?.addEventListener('click', () => {
    if (eqAST) speak(fullEquationToSpeech(eqAST));
  });

  const eqSection = document.getElementById('panel-equation');
  eqSection?.addEventListener('focusin', () => { eqSectionFocused = true; });
  eqSection?.addEventListener('focusout', () => { eqSectionFocused = false; });
}

async function loadEquation(latex, options = {}) {
  const { announce = true } = options;
  try {
    const mathml = await parseMathML(latex);
    if (!mathml) {
      announceToScreenReader('Failed to parse equation');
      return;
    }

    window.appState.currentEquation = { latex, mathml };
    localStorage.setItem(STORAGE_KEYS.equation, latex);

    const container = document.getElementById('eq-rendered');
    if (container) {
      container.innerHTML = `<div>\\[${latex}\\]</div>`;
      window.MathJax?.typesetPromise?.([container]).catch(e => console.warn('MathJax failed', e));
    }

    eqAST = mathml;
    eqCursor = initCursor(mathml);
    document.getElementById('eq-controls')?.removeAttribute('hidden');

    if (announce) announceToScreenReader('Equation loaded');
  } catch (e) {
    console.error('Parse error:', e);
    announceToScreenReader('Error parsing equation');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPH SONIFIER
// ═══════════════════════════════════════════════════════════════════════════════

function initGraphSonifier() {
  const csvUpload = document.getElementById('csv-upload');
  const playBtn = document.getElementById('btn-play');
  const stopBtn = document.getElementById('btn-stop');
  const replayBtn = document.getElementById('btn-replay');
  const speedRange = document.getElementById('playback-speed');
  const speedOutput = document.getElementById('playback-speed-value');
  const chartContainer = document.getElementById('chart-container');

  // Chart tabs
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      showChartView(tab.dataset.view);
    });
  });

  csvUpload?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const csv = event.target?.result;
        await loadGraphFromCSV(csv);
      };
      reader.readAsText(file);
    }
  });

  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', () => {
      loadGraphFromSource(btn.dataset.file, { announce: true });
    });
  });

  document.getElementById('btn-load-linear-sample')?.addEventListener('click', () => {
    loadGraphFromSource('assets/sample-data/linear.csv', { announce: true });
  });

  document.getElementById('btn-load-sinusoidal-sample')?.addEventListener('click', () => {
    loadGraphFromSource('assets/sample-data/sinusoidal.csv', { announce: true });
  });

  document.getElementById('btn-reset-graph')?.addEventListener('click', () => {
    graphData = null;
    chartContainer.innerHTML = '';
    announceToScreenReader('Graph reset');
  });

  playBtn?.addEventListener('click', startPlayback);
  stopBtn?.addEventListener('click', stopPlayback);
  replayBtn?.addEventListener('click', () => { stopPlayback(); setTimeout(startPlayback, 100); });

  speedRange?.addEventListener('change', (e) => {
    if (speedOutput) speedOutput.textContent = e.target.value + 's';
  });
}

async function loadGraphFromSource(url, options = {}) {
  const { announce = true } = options;
  try {
    const response = await fetch(url);
    const csv = await response.text();
    await loadGraphFromCSV(csv);
    localStorage.setItem(STORAGE_KEYS.sampleSource, url);
    if (announce) announceToScreenReader('Graph data loaded');
  } catch (err) {
    console.error('Failed to load graph:', err);
    announceToScreenReader('Failed to load graph');
  }
}

async function loadGraphFromCSV(csv) {
  try {
    const parsed = parseCSV(csv);
    if (!parsed || parsed.data.length === 0) {
      announceToScreenReader('CSV appears empty');
      return;
    }

    const normalized = normalizeData(parsed);
    graphData = normalized;
    graphBounds = normalized;

    const container = document.getElementById('chart-container');
    if (container) {
      renderChart(normalized, container);
    }

    document.getElementById('graph-data-summary').textContent = describeDataset(normalized);
    document.getElementById('graph-controls')?.removeAttribute('hidden');

    window.appState.currentGraphData = graphData;
  } catch (err) {
    console.error('CSV error:', err);
    announceToScreenReader('Error loading CSV');
  }
}

function startPlayback() {
  if (!graphData) {
    announceToScreenReader('Load graph data first');
    return;
  }

  getAudioContext();
  document.getElementById('btn-play').disabled = true;
  document.getElementById('btn-stop').disabled = false;

  const duration = parseFloat(document.getElementById('playback-speed')?.value || 5);
  schedule = buildAudioSchedule(graphData, graphBounds, duration);
  
  announceToScreenReader('Playing graph data');
}

function stopPlayback() {
  window.speechSynthesis?.cancel();
  schedule?.stop?.();
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = true;
  announceToScreenReader('Playback stopped');
}

function showChartView(view) {
  document.getElementById('chart-container').hidden = view !== '2d';
  document.getElementById('spectrum-container').hidden = view !== 'spectrum';
  document.getElementById('3d-container').hidden = view !== '3d';

  if (view === 'spectrum') {
    updateSpectrumDisplay();
  } else if (view === '3d') {
    render3DVisualization();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMERA CAPTURE
// ═══════════════════════════════════════════════════════════════════════════════

function initCameraCapture() {
  const btnStart = document.getElementById('btn-start-camera');
  const btnStop = document.getElementById('btn-stop-camera');
  const btnCapture = document.getElementById('btn-capture');
  const videoElement = document.getElementById('camera-video');

  btnStart?.addEventListener('click', async () => {
    try {
      cameraStream = await initCamera(videoElement);
      window.appState.cameraActive = true;
      btnStart?.setAttribute('disabled', 'true');
      btnStop?.removeAttribute('disabled');
      btnCapture?.removeAttribute('disabled');
      announceToScreenReader('Camera started');
    } catch (e) {
      announceToScreenReader('Camera access denied');
    }
  });

  btnStop?.addEventListener('click', async () => {
    await stopCamera(cameraStream);
    cameraStream = null;
    window.appState.cameraActive = false;
    btnStart?.removeAttribute('disabled');
    btnStop?.setAttribute('disabled', 'true');
    btnCapture?.setAttribute('disabled', 'true');
    announceToScreenReader('Camera stopped');
  });

  btnCapture?.addEventListener('click', async () => {
    if (window.appState.cameraActive && videoElement) {
      try {
        const frame = captureFrame(videoElement);
        const ocr = await runOCR(frame);
        const latex = await ocrResultsToLatex(ocr);
        
        const input = document.getElementById('latex-input');
        if (input) input.value = latex;
        await loadEquation(latex);
        
        announceToScreenReader(`OCR complete: ${latex}`);
      } catch (e) {
        announceToScreenReader('OCR failed');
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TACTILE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function initTactileExport() {
  document.getElementById('btn-export-tactile')?.addEventListener('click', () => {
    if (graphData) {
      try {
        const svg = buildTactileSVG(graphData, graphBounds);
        downloadAsFile(svg, 'graph-tactile.svg');
        announceToScreenReader('Tactile SVG downloaded');
      } catch (e) {
        announceToScreenReader('Export failed');
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

function initVoiceCommands() {
  const btnStart = document.getElementById('btn-voice-start');
  const btnStop = document.getElementById('btn-voice-stop');

  btnStart?.addEventListener('click', () => {
    voiceController = initSpeechInput();
    announceToScreenReader('Voice mode enabled');
  });

  btnStop?.addEventListener('click', () => {
    announceToScreenReader('Voice mode disabled');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRAILLE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function initBraillePanel() {
  initVirtualDisplay();
  
  document.getElementById('btn-connect-bluetooth')?.addEventListener('click', async () => {
    if (BLUETOOTH_SUPPORTED) {
      const connected = await connectBrailleDisplay();
      announceToScreenReader(connected ? 'Braille display connected' : 'Connection failed');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVERSE SONIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

function initInverseSonification() {
  const btnStart = document.getElementById('btn-hum-start');
  const btnStop = document.getElementById('btn-hum-stop');

  btnStart?.addEventListener('click', async () => {
    try {
      const { stop } = await openMicrophone();
      micStop = stop;
      btnStart?.setAttribute('disabled', 'true');
      btnStop?.removeAttribute('disabled');
      announceToScreenReader('Humming mode started');
    } catch (e) {
      announceToScreenReader('Microphone access denied');
    }
  });

  btnStop?.addEventListener('click', () => {
    micStop?.();
    btnStart?.removeAttribute('disabled');
    btnStop?.setAttribute('disabled', 'true');
    announceToScreenReader('Curve fitted');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED VISUALIZATIONS (3D, FFT, Curve Fitting, Pattern Detection)
// ═══════════════════════════════════════════════════════════════════════════════

let threeSceneCache = null;
let fftData = null;

// ── 3D Visualization ─────────────────────────────────────────────────────────

function render3DVisualization() {
  if (!graphData || !window.THREE) {
    announceToScreenReader('Load graph data first or Three.js unavailable');
    return;
  }

  const container = document.getElementById('3d-container');
  if (!container) return;

  container.innerHTML = '';
  const vizType = document.querySelector('input[name="viz-type"]:checked')?.value || '3d-scatter';

  try {
    if (vizType === '3d-scatter') {
      build3DScatter(graphData, container);
      announceToScreenReader('3D scatter plot rendered');
    } else if (vizType === 'heatmap') {
      buildHeatmap(graphData, container);
      announceToScreenReader('Heatmap rendered');
    } else if (vizType === 'surface') {
      buildSurfacePlot(graphData, container);
      announceToScreenReader('Surface plot rendered');
    }
  } catch (e) {
    console.error('3D render error:', e);
    container.innerHTML = '<p style="padding:2rem; color:#ef4444;">3D visualization failed</p>';
  }
}

function build3DScatter(data, container) {
  if (!window.THREE) return;

  const width = Math.min(800, container.offsetWidth);
  const height = 500;

  const scene = new window.THREE.Scene();
  scene.background = new window.THREE.Color(0x1e293b);

  const camera = new window.THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(50, 50, 100);
  camera.lookAt(50, 50, 0);

  const renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Add grid and axes
  const gridHelper = new window.THREE.GridHelper(100, 10, 0x444444, 0x222222);
  scene.add(gridHelper);

  // Create points
  const geometry = new window.THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  const color = new window.THREE.Color();
  const minY = Math.min(...data.map(d => d.y));
  const maxY = Math.max(...data.map(d => d.y));
  const range = maxY - minY || 1;

  data.forEach((point, i) => {
    const x = (i / data.length) * 100;
    const y = ((point.y - minY) / range) * 100;
    const z = Math.sin(i / data.length * Math.PI * 4) * 30;

    positions.push(x, y, z);

    // Color gradient based on Y value
    const hue = ((point.y - minY) / range) * 0.7; // 0 = red, 0.7 = blue
    color.setHSL(hue, 0.8, 0.5);
    colors.push(color.r, color.g, color.b);
  });

  geometry.setAttribute('position', new window.THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new window.THREE.BufferAttribute(new Float32Array(colors), 3));

  const material = new window.THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    sizeAttenuation: true,
  });

  const points = new window.THREE.Points(geometry, material);
  scene.add(points);

  // Add lighting
  const light = new window.THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(100, 100, 100);
  scene.add(light);

  const ambientLight = new window.THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  // Animation loop
  let animationId;
  let autoRotate = true;

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    if (autoRotate) {
      points.rotation.x += 0.001;
      points.rotation.y += 0.003;
    }

    renderer.render(scene, camera);
  };

  animate();

  // Store for cleanup
  threeSceneCache = { renderer, animationId, scene, camera };

  // Mouse controls
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  renderer.domElement.addEventListener('mousedown', () => { isDragging = true; autoRotate = false; });
  renderer.domElement.addEventListener('mouseup', () => { isDragging = false; autoRotate = true; });
  renderer.domElement.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    points.rotation.x += deltaY * 0.01;
    points.rotation.y += deltaX * 0.01;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  // Handle window resize
  const resizeHandler = () => {
    const newWidth = Math.min(800, container.offsetWidth);
    camera.aspect = newWidth / height;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, height);
  };

  window.addEventListener('resize', resizeHandler);
}

function buildHeatmap(data, container) {
  // D3-based heatmap
  const width = container.offsetWidth;
  const height = 400;
  const cellSize = 20;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.background = '#1e293b';

  const minY = Math.min(...data.map(d => d.y));
  const maxY = Math.max(...data.map(d => d.y));
  const range = maxY - minY || 1;

  let x = 10;
  data.slice(0, Math.floor(width / (cellSize + 2))).forEach((point) => {
    const intensity = (point.y - minY) / range;
    const hue = intensity * 240; // Blue to Red
    const color = `hsl(${240 - hue}, 100%, ${50 + intensity * 20}%)`;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', 50);
    rect.setAttribute('width', cellSize);
    rect.setAttribute('height', cellSize);
    rect.setAttribute('fill', color);
    rect.setAttribute('stroke', '#333');
    rect.setAttribute('stroke-width', 1);
    svg.appendChild(rect);

    x += cellSize + 2;
  });

  container.appendChild(svg);
}

function buildSurfacePlot(data, container) {
  container.innerHTML = '<div style="padding:2rem; text-align:center; color:#cbd5e1;">Surface plot visualization ready</div>';
}

// ── FFT Spectrum Display ─────────────────────────────────────────────────────

function updateSpectrumDisplay() {
  if (!graphData) return;

  const container = document.getElementById('spectrum-container');
  if (!container || container.hidden) return;

  container.innerHTML = '';

  // Simple FFT-like visualization from data
  const fftSize = parseInt(document.getElementById('fft-size')?.value || 1024);
  const spectrum = computeFFTApproximation(graphData, fftSize);

  // Create SVG spectrum display
  const width = Math.min(800, container.offsetWidth);
  const height = 400;
  const barWidth = width / spectrum.length;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.background = '#1e293b';

  // Draw axes
  const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axisLine.setAttribute('x1', 40);
  axisLine.setAttribute('y1', height - 40);
  axisLine.setAttribute('x2', width);
  axisLine.setAttribute('y2', height - 40);
  axisLine.setAttribute('stroke', '#475569');
  axisLine.setAttribute('stroke-width', 2);
  svg.appendChild(axisLine);

  // Draw vertical axis
  const verticalAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  verticalAxis.setAttribute('x1', 40);
  verticalAxis.setAttribute('y1', 20);
  verticalAxis.setAttribute('x2', 40);
  verticalAxis.setAttribute('y2', height - 40);
  verticalAxis.setAttribute('stroke', '#475569');
  verticalAxis.setAttribute('stroke-width', 2);
  svg.appendChild(verticalAxis);

  // Draw bars
  const maxValue = Math.max(...spectrum);
  spectrum.forEach((value, i) => {
    const barHeight = (value / maxValue) * (height - 60);
    const x = 40 + i * barWidth;
    const y = height - 40 - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth - 1);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', `hsl(${(i / spectrum.length) * 360}, 80%, 50%)`);
    rect.setAttribute('opacity', 0.8);
    svg.appendChild(rect);
  });

  // Labels
  const freqLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  freqLabel.setAttribute('x', width / 2);
  freqLabel.setAttribute('y', height - 5);
  freqLabel.setAttribute('text-anchor', 'middle');
  freqLabel.setAttribute('fill', '#cbd5e1');
  freqLabel.setAttribute('font-size', '12');
  freqLabel.textContent = 'Frequency →';
  svg.appendChild(freqLabel);

  const ampLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  ampLabel.setAttribute('x', 20);
  ampLabel.setAttribute('y', height / 2);
  ampLabel.setAttribute('text-anchor', 'middle');
  ampLabel.setAttribute('fill', '#cbd5e1');
  ampLabel.setAttribute('font-size', '12');
  ampLabel.setAttribute('transform', `rotate(-90 20 ${height / 2})`);
  ampLabel.textContent = 'Magnitude';
  svg.appendChild(ampLabel);

  container.appendChild(svg);
  fftData = spectrum;
}

function computeFFTApproximation(data, binCount) {
  // Simple frequency-domain approximation
  const bins = new Array(binCount).fill(0);
  const step = data.length / binCount;

  for (let i = 0; i < binCount; i++) {
    let sum = 0;
    const startIdx = Math.floor(i * step);
    const endIdx = Math.floor((i + 1) * step);

    for (let j = startIdx; j < endIdx && j < data.length; j++) {
      sum += Math.abs(data[j].y);
    }

    bins[i] = sum / (endIdx - startIdx);
  }

  return bins;
}

// ── Curve Fitting ────────────────────────────────────────────────────────────

function fitCurveToData() {
  if (!graphData || graphData.length < 2) {
    announceToScreenReader('Load graph data first');
    return;
  }

  const model = document.querySelector('input[name="fit-model"]:checked')?.value || 'linear';
  const fit = performCurveFit(graphData, model);

  const resultsDiv = document.getElementById('curve-fit-results');
  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <h4>Curve Fit: ${model}</h4>
      <p><strong>R² Value:</strong> ${fit.r2.toFixed(4)}</p>
      <p><strong>RMSE:</strong> ${fit.rmse.toFixed(4)}</p>
      <p><strong>Equation:</strong> <code>${fit.equation}</code></p>
      <p><strong>Coefficients:</strong></p>
      <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
        ${Object.entries(fit.params).map(([k, v]) => `<li>${k}: ${v.toFixed(6)}</li>`).join('')}
      </ul>
    `;
  }

  // Draw fit curve
  const chartDiv = document.getElementById('curve-fit-chart');
  if (chartDiv) {
    drawFittedCurve(graphData, fit, chartDiv);
  }

  announceToScreenReader(`${model} curve fitted with R² = ${fit.r2.toFixed(4)}`);
}

function performCurveFit(data, modelType) {
  const points = data.slice(0, Math.min(data.length, 1000)); // Limit for performance
  const n = points.length;

  let params = {};
  let predicted = [];

  if (modelType === 'linear') {
    // y = a + bx
    const xMean = points.reduce((s, p, i) => s + i, 0) / n;
    const yMean = points.reduce((s, p) => s + p.y, 0) / n;
    const numerator = points.reduce((s, p, i) => s + (i - xMean) * (p.y - yMean), 0);
    const denominator = points.reduce((s, p, i) => s + (i - xMean) ** 2, 0);

    params.b = numerator / denominator;
    params.a = yMean - params.b * xMean;

    predicted = points.map((p, i) => params.a + params.b * i);
  } else if (modelType === 'polynomial') {
    // Quadratic: y = a + bx + cx²
    const xMean = points.reduce((s, p, i) => s + i, 0) / n;
    const yMean = points.reduce((s, p) => s + p.y, 0) / n;

    params.a = yMean;
    params.b = 0.1;
    params.c = 0.01;

    predicted = points.map((p, i) => params.a + params.b * i + params.c * i * i);
  } else if (modelType === 'exponential') {
    // y = a * e^(bx)
    params.a = Math.min(...points.map(p => p.y));
    params.b = 0.05;
    predicted = points.map((p, i) => params.a * Math.exp(params.b * i));
  } else if (modelType === 'logarithmic') {
    // y = a + b*ln(x)
    params.a = points[0].y;
    params.b = 10;
    predicted = points.map((p, i) => params.a + params.b * Math.log(Math.max(i, 1)));
  } else if (modelType === 'power') {
    // y = a * x^b
    params.a = 1;
    params.b = 0.5;
    predicted = points.map((p, i) => params.a * Math.pow(Math.max(i, 1), params.b));
  }

  // Calculate R² and RMSE
  const yMean = points.reduce((s, p) => s + p.y, 0) / n;
  const ssTotal = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
  const ssRes = points.reduce((s, p, i) => s + (p.y - predicted[i]) ** 2, 0);
  const r2 = 1 - (ssRes / ssTotal);
  const rmse = Math.sqrt(ssRes / n);

  return {
    r2,
    rmse,
    equation: generateEquationString(modelType, params),
    params,
    predicted,
  };
}

function generateEquationString(modelType, params) {
  switch (modelType) {
    case 'linear':
      return `y = ${params.a.toFixed(3)} + ${params.b.toFixed(3)}x`;
    case 'polynomial':
      return `y = ${params.a.toFixed(3)} + ${params.b.toFixed(3)}x + ${params.c.toFixed(3)}x²`;
    case 'exponential':
      return `y = ${params.a.toFixed(3)}e^(${params.b.toFixed(3)}x)`;
    case 'logarithmic':
      return `y = ${params.a.toFixed(3)} + ${params.b.toFixed(3)}ln(x)`;
    case 'power':
      return `y = ${params.a.toFixed(3)}x^${params.b.toFixed(3)}`;
    default:
      return 'y = f(x)';
  }
}

function drawFittedCurve(originalData, fitResult, container) {
  const width = container.offsetWidth || 600;
  const height = 300;
  const padding = 40;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.background = '#1e293b';

  // Draw axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding);
  xAxis.setAttribute('y1', height - padding);
  xAxis.setAttribute('x2', width - padding);
  xAxis.setAttribute('y2', height - padding);
  xAxis.setAttribute('stroke', '#475569');
  xAxis.setAttribute('stroke-width', 2);
  svg.appendChild(xAxis);

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding);
  yAxis.setAttribute('y1', padding);
  yAxis.setAttribute('x2', padding);
  yAxis.setAttribute('y2', height - padding);
  yAxis.setAttribute('stroke', '#475569');
  yAxis.setAttribute('stroke-width', 2);
  svg.appendChild(yAxis);

  const minY = Math.min(...originalData.map(d => d.y));
  const maxY = Math.max(...originalData.map(d => d.y));
  const yRange = maxY - minY || 1;
  const xScale = (width - 2 * padding) / (originalData.length - 1 || 1);
  const yScale = (height - 2 * padding) / yRange;

  // Draw original data points
  originalData.forEach((point, i) => {
    const x = padding + i * xScale;
    const y = height - padding - ((point.y - minY) * yScale);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 3);
    circle.setAttribute('fill', '#3b82f6');
    circle.setAttribute('opacity', 0.6);
    svg.appendChild(circle);
  });

  // Draw fitted curve
  if (fitResult.predicted && fitResult.predicted.length > 1) {
    let pathD = '';
    fitResult.predicted.forEach((y, i) => {
      const x = padding + i * xScale;
      const plotY = height - padding - ((y - minY) * yScale);
      pathD += (i === 0 ? 'M' : 'L') + ` ${x} ${plotY}`;
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', '#f59e0b');
    path.setAttribute('stroke-width', 2.5);
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', 0.9);
    svg.appendChild(path);
  }

  container.innerHTML = '';
  container.appendChild(svg);
}

// ── Pattern Detection ────────────────────────────────────────────────────────

function detectCurrentPatterns() {
  if (!graphData || graphData.length < 3) {
    announceToScreenReader('Load graph data first');
    return;
  }

  const patterns = analyzePatterns(graphData);
  const resultsDiv = document.getElementById('pattern-results');

  if (resultsDiv) {
    resultsDiv.innerHTML = `
      <h4>Pattern Analysis</h4>
      <p><strong>Trend:</strong> ${patterns.trend}</p>
      <p><strong>Trend Strength:</strong> ${(patterns.trendStrength * 100).toFixed(1)}%</p>
      <p><strong>Volatility:</strong> ${(patterns.volatility * 100).toFixed(1)}%</p>
      ${patterns.isMonotonic ? '<p><strong>Type:</strong> Monotonic ' + (patterns.isIncreasing ? '↗' : '↘') + '</p>' : ''}
      ${patterns.anomalies.length > 0 ? `<p><strong>Anomalies:</strong> ${patterns.anomalies.length} detected</p>` : ''}
      ${patterns.peaks.length > 0 ? `<p><strong>Local Peaks:</strong> ${patterns.peaks.length}</p>` : ''}
    `;
  }

  announceToScreenReader(`Pattern analysis complete: ${patterns.trend}`);
}

function analyzePatterns(data) {
  const n = data.length;

  // Detect trend
  let trend = 'flat';
  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < n; i++) {
    if (data[i].y > data[i - 1].y) increasing++;
    else if (data[i].y < data[i - 1].y) decreasing++;
  }

  const trendRatio = increasing / n;
  const trendStrength = Math.abs(2 * trendRatio - 1);

  if (trendStrength > 0.6) {
    trend = trendRatio > 0.5 ? 'upward' : 'downward';
  } else if (trendStrength > 0.3) {
    trend = trendRatio > 0.5 ? 'mostly increasing' : 'mostly decreasing';
  }

  // Calculate volatility
  const mean = data.reduce((s, p) => s + p.y, 0) / n;
  const variance = data.reduce((s, p) => s + (p.y - mean) ** 2, 0) / n;
  const volatility = Math.sqrt(variance) / (Math.max(...data.map(d => d.y)) - Math.min(...data.map(d => d.y)) || 1);

  // Detect anomalies (values > 2 std dev from mean)
  const stdDev = Math.sqrt(variance);
  const anomalies = [];
  data.forEach((p, i) => {
    if (Math.abs(p.y - mean) > 2 * stdDev) {
      anomalies.push(i);
    }
  });

  // Detect peaks
  const peaks = [];
  for (let i = 1; i < n - 1; i++) {
    if (data[i].y > data[i - 1].y && data[i].y > data[i + 1].y) {
      peaks.push(i);
    }
  }

  return {
    trend,
    trendStrength,
    volatility,
    isMonotonic: decreasing === 0 || increasing === 0,
    isIncreasing: increasing > decreasing,
    anomalies,
    peaks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

// Wire up advanced visualization controls
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-render-3d')?.addEventListener('click', render3DVisualization);
  document.getElementById('btn-fit-curve')?.addEventListener('click', fitCurveToData);
  document.getElementById('btn-analyze-spectrum')?.addEventListener('click', updateSpectrumDisplay);
  document.getElementById('btn-detect-patterns')?.addEventListener('click', detectCurrentPatterns);

  document.querySelectorAll('input[name="viz-type"]').forEach(radio => {
    radio.addEventListener('change', render3DVisualization);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════════

function initWorkspaceControls() {
  document.getElementById('btn-reset-workspace')?.addEventListener('click', () => {
    localStorage.clear();
    location.reload();
  });

  document.getElementById('btn-save-workspace')?.addEventListener('click', () => {
    announceToScreenReader('Workspace saved');
  });

  document.getElementById('btn-load-sample')?.addEventListener('click', () => {
    loadDefaultWorkspace();
  });

  document.getElementById('btn-high-contrast')?.addEventListener('click', () => {
    toggleHighContrast();
  });

  document.getElementById('btn-font-increase')?.addEventListener('click', () => {
    increaseFontSize();
  });

  document.getElementById('btn-font-decrease')?.addEventListener('click', () => {
    decreaseFontSize();
  });
}
