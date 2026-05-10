/**
 * ocr.worker.js
 * Web Worker — runs Tesseract.js OCR off the main thread.
 * Loaded as a classic worker so importScripts is available.
 */

importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');

let tesseractWorker = null;

async function initTesseract() {
  if (tesseractWorker) return tesseractWorker;
  tesseractWorker = await Tesseract.createWorker('eng', 1, {
    // Tune for printed math
    tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/=()[]{}^_.,<>πΣ∫√±×÷',
    tessedit_pageseg_mode: '6', // assume uniform block of text
  });
  return tesseractWorker;
}

// Pre-warm on worker load
initTesseract().catch(() => {});

self.onmessage = async (e) => {
  const { type, width, height, buffer } = e.data;

  if (type !== 'recognize') return;

  try {
    const worker = await initTesseract();

    // Reconstruct ImageData-like object for Tesseract
    const pixels = new Uint8ClampedArray(buffer);
    const canvas = new OffscreenCanvas(width, height);
    const ctx    = canvas.getContext('2d');
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

    const blob     = await canvas.convertToBlob({ type: 'image/png' });
    const url      = URL.createObjectURL(blob);
    const { data } = await worker.recognize(url);
    URL.revokeObjectURL(url);

    // Return words with bounding boxes and confidence
    const words = data.words.map(w => ({
      text:       w.text,
      confidence: w.confidence,
      bbox: {
        x0: w.bbox.x0, y0: w.bbox.y0,
        x1: w.bbox.x1, y1: w.bbox.y1,
      },
    }));

    self.postMessage({ type: 'result', payload: { words, text: data.text } });

  } catch (err) {
    self.postMessage({ type: 'error', payload: err.message });
  }
};
