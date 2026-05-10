/**
 * camera.js
 * Camera access, frame capture, and basic image preprocessing.
 */

/**
 * Start the camera and attach the stream to a <video> element.
 * Prefers environment-facing camera (phone rear) with fallback to any camera.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<MediaStream>}
 */
export async function initCamera(videoEl) {
  const constraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width:  { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    // Fallback: any camera
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }

  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

/** Stop all tracks on a stream (releases camera) */
export function stopCamera(stream) {
  stream?.getTracks().forEach(t => t.stop());
}

/**
 * Draw the current video frame to a canvas and return the ImageData.
 * If canvas isn't provided, creates one at the video's native resolution.
 *
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLCanvasElement} [canvas]
 * @returns {ImageData}
 */
export function captureFrame(videoEl, canvas) {
  const w = videoEl.videoWidth  || 640;
  const h = videoEl.videoHeight || 480;
  const cvs = canvas ?? document.createElement('canvas');
  cvs.width  = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Preprocess an ImageData for better OCR accuracy:
 * grayscale → contrast boost → binary threshold.
 *
 * @param {ImageData} imageData
 * @returns {ImageData} new ImageData with same dimensions
 */
export function preprocessImage(imageData) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data.length);

  // Pass 1: grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    output[i] = output[i + 1] = output[i + 2] = gray;
    output[i + 3] = 255;
  }

  // Pass 2: contrast stretch (min–max normalization)
  let lo = 255, hi = 0;
  for (let i = 0; i < output.length; i += 4) {
    lo = Math.min(lo, output[i]);
    hi = Math.max(hi, output[i]);
  }
  const range = hi - lo || 1;
  for (let i = 0; i < output.length; i += 4) {
    const v = Math.round(((output[i] - lo) / range) * 255);
    output[i] = output[i + 1] = output[i + 2] = v;
  }

  return new ImageData(output, width, height);
}

/**
 * Draw an ImageData into an existing canvas element (for preview display).
 * @param {ImageData} imageData
 * @param {HTMLCanvasElement} canvas
 */
export function drawToCanvas(imageData, canvas) {
  canvas.width  = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
}
