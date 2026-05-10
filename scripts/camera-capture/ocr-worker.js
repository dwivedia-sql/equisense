/**
 * ocr-worker.js
 * Client-side wrapper for the OCR Web Worker.
 * Handles worker lifecycle, message passing, and error recovery.
 */

let worker = null;
let pendingResolve = null;
let pendingReject  = null;

function getWorker() {
  if (worker) return worker;

  worker = new Worker('workers/ocr.worker.js');

  worker.onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'result' && pendingResolve) {
      pendingResolve(payload);
    } else if (type === 'error' && pendingReject) {
      pendingReject(new Error(payload));
    }
    pendingResolve = null;
    pendingReject  = null;
  };

  worker.onerror = (err) => {
    pendingReject?.(new Error(`OCR worker error: ${err.message}`));
    pendingResolve = null;
    pendingReject  = null;
    worker = null; // force re-init on next call
  };

  return worker;
}

/**
 * Send an ImageData to the OCR worker and await results.
 *
 * @param {ImageData} imageData
 * @returns {Promise<{ words: Array, text: string }>}
 */
export function runOCR(imageData) {
  return new Promise((resolve, reject) => {
    if (pendingResolve) {
      reject(new Error('OCR already in progress'));
      return;
    }
    pendingResolve = resolve;
    pendingReject  = reject;

    const w = getWorker();
    // Transfer the pixel buffer to avoid copying
    const buffer = imageData.data.buffer.slice(0);
    w.postMessage(
      { type: 'recognize', width: imageData.width, height: imageData.height, buffer },
      [buffer]
    );
  });
}

/** Pre-warm the worker so first capture isn't slow */
export function prewarmOCRWorker() {
  getWorker(); // instantiates the worker, which loads Tesseract
}
