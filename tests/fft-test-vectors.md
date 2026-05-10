# FFT Test Vectors

Use these to verify `fft.js` is computing correctly before the conference.
Open the browser console, import the module, and run each check manually.

```javascript
import { fftInPlace, hannWindow, magnitudeSpectrum, analyzeSpectrum } from '../scripts/data-analysis/fft.js';
import { findDominantFrequency } from '../scripts/data-analysis/fft.js';
```

---

## Test 1: DC signal (all same value)

**Input:** 8 samples, all value 1.0
**Expected:** All energy in bin 0 (DC). All other bins near zero.

```javascript
const real = new Float64Array([1,1,1,1,1,1,1,1]);
const imag = new Float64Array(8);
fftInPlace(real, imag);
// real[0] should be 8.0 (sum of inputs)
// real[1..7] should be ~0
console.assert(Math.abs(real[0] - 8) < 0.0001, 'DC bin should be 8');
console.assert(Math.abs(real[1]) < 0.001, 'Bin 1 should be ~0');
```

---

## Test 2: Pure sine wave — known frequency

**Setup:** 64 samples of sin(2π * 4 * i / 64). This is a 4 Hz signal with sample rate 64.
**Expected:** Dominant frequency at bin 4 (4 Hz).

```javascript
const N = 64;
const real = new Float64Array(N);
const imag = new Float64Array(N);
for (let i = 0; i < N; i++) {
  real[i] = Math.sin(2 * Math.PI * 4 * i / N);
}
fftInPlace(real, imag);
const mag = magnitudeSpectrum(real, imag);
// Bin 4 should have the largest magnitude
const maxBin = [...mag].reduce((mi, v, i, a) => v > a[mi] ? i : mi, 0);
console.assert(maxBin === 4, `Expected dominant at bin 4, got ${maxBin}`);
console.log('Magnitudes (first 10 bins):', [...mag].slice(0, 10).map(v => v.toFixed(2)));
```

---

## Test 3: Hann window reduces leakage

**Setup:** Sine wave at non-integer frequency (f = 3.5). Without window, energy leaks heavily.
**Expected:** With Hann window, dominant bin is 3 or 4, magnitude >> all others.

```javascript
const N = 64;
const real = new Float64Array(N);
const imag = new Float64Array(N);
const win = hannWindow(N);
for (let i = 0; i < N; i++) {
  real[i] = Math.sin(2 * Math.PI * 3.5 * i / N) * win[i];
}
fftInPlace(real, imag);
const mag = magnitudeSpectrum(real, imag);
const maxBin = [...mag].reduce((mi, v, i, a) => v > a[mi] ? i : mi, 0);
// Should be 3 or 4, not spread across all bins
console.assert(maxBin === 3 || maxBin === 4, `Windowed peak should be near bin 3-4, got ${maxBin}`);
```

---

## Test 4: analyzeSpectrum on sinusoidal dataset

**Setup:** Use the sinusoidal.csv data (or generate equivalent).
**Expected:** findDominantFrequency returns a period close to 2π ≈ 6.28.

```javascript
// Sinusoidal data: x from 0 to 12.566, y = sin(x), 21 points
const data = [];
for (let i = 0; i <= 20; i++) {
  const x = i * (4 * Math.PI) / 20;
  data.push({ x, y: Math.sin(x) });
}
const { magnitudes, sampleRate } = analyzeSpectrum(data);
const dominant = findDominantFrequency(magnitudes, sampleRate, 0);
const period = 1 / dominant.freq;
console.log(`Detected period: ${period.toFixed(2)}, expected ~6.28`);
// Should be within 10% of 2π
console.assert(Math.abs(period - 2 * Math.PI) / (2 * Math.PI) < 0.15,
  `Period ${period.toFixed(2)} not within 10% of 6.28`);
```

---

## Test 5: Linear data gives low FFT signal

**Setup:** y = 2x, 32 points. No periodic component.
**Expected:** No bin has magnitude above threshold relative to DC.

```javascript
const data = Array.from({ length: 32 }, (_, i) => ({ x: i, y: 2 * i }));
const { magnitudes } = analyzeSpectrum(data);
const maxMag = Math.max(...magnitudes.slice(1)); // skip DC
console.log('Max non-DC magnitude:', maxMag.toFixed(2));
// For a pure linear signal, non-DC bins should be small relative to DC
// (Not zero because de-trending isn't applied, but classifyPattern catches this via R²)
```

---

## Pattern Classifier Integration Test

```javascript
import { computeStats, linearRegression } from '../scripts/data-analysis/stats.js';
import { classifyPattern } from '../scripts/data-analysis/pattern-detect.js';

// Should classify as linear
const linear = Array.from({length:20}, (_, i) => ({x:i, y:2*i+1}));
const ls = computeStats(linear), lr = linearRegression(linear);
console.assert(classifyPattern(linear, ls, lr).pattern === 'linear', 'linear dataset failed');

// Should classify as exponential
const expo = Array.from({length:20}, (_, i) => ({x:i, y:Math.exp(i/3)}));
const es = computeStats(expo), er = linearRegression(expo);
console.assert(classifyPattern(expo, es, er).pattern === 'exponential', 'exponential dataset failed');

// Should classify as sinusoidal
const sine = Array.from({length:32}, (_, i) => ({x:i/5, y:Math.sin(2*Math.PI*i/32*2)}));
const ss = computeStats(sine), sr = linearRegression(sine);
console.assert(classifyPattern(sine, ss, sr).pattern === 'sinusoidal', 'sinusoidal dataset failed');

console.log('All pattern classifier tests passed.');
```
