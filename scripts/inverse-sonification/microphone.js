/**
 * microphone.js
 * Microphone access and raw audio buffer capture for pitch detection.
 */

/**
 * Open microphone stream and return a ScriptProcessorNode that fires
 * onBuffer(Float32Array) for each audio chunk.
 *
 * @param {AudioContext} audioContext
 * @param {function} onBuffer  called with Float32Array of raw samples
 * @returns {Promise<{ stream: MediaStream, stop: function }>}
 */
export async function openMicrophone(audioContext, onBuffer) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const source = audioContext.createMediaStreamSource(stream);

  // bufferSize 2048 gives ~46ms at 44.1kHz — good pitch resolution
  const processor = audioContext.createScriptProcessor(2048, 1, 1);

  processor.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    onBuffer(new Float32Array(data)); // copy so it outlives the event
  };

  source.connect(processor);
  processor.connect(audioContext.destination); // must connect to run

  function stop() {
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach(t => t.stop());
  }

  return { stream, stop };
}
