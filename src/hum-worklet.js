// Cancels hum that repeats at a known rate, together with its harmonics.
//
// Measured on an MS2130 "USB3 Video" card: while video streams, the audio carries a buzz at
// exactly the video frame rate (30 or 60 Hz) plus every harmonic up to about 2 kHz, 30 to 40 dB
// above the noise floor. Its phase jumps now and then, so fixed notches either miss or have to
// be wide enough to hollow out the sound.
//
// Each harmonic gets a sine/cosine pair whose weights follow the hum's amplitude and phase with
// a least-mean-squares update; the estimate is subtracted from the input. That behaves like a
// notch about 4.5 Hz wide on every harmonic that re-locks after a phase jump in roughly
// 0.1 s. Weights are kept per channel; the oscillator is shared.

const MAX_HZ = 2000;
// Adaptation step. Each harmonic acts like a notch about MU * sampleRate / (2 * PI) Hz wide.
const MU = 6e-4;

class HumCanceller extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.phase = 0;
    this.weights = [];
    this.setFundamental(options.processorOptions?.fundamental || 60);
    this.port.onmessage = (e) => this.setFundamental(e.data.fundamental);
  }

  setFundamental(hz) {
    if (!(hz > 0) || hz === this.fundamental) return;
    this.fundamental = hz;
    this.harmonics = Math.max(1, Math.floor(Math.min(MAX_HZ, sampleRate / 2 - 100) / hz));
    this.step = (2 * Math.PI * hz) / sampleRate;
    this.cos = new Float64Array(this.harmonics);
    this.sin = new Float64Array(this.harmonics);
    this.stepCos = new Float64Array(this.harmonics);
    this.stepSin = new Float64Array(this.harmonics);
    for (let k = 0; k < this.harmonics; k++) {
      this.stepCos[k] = Math.cos((k + 1) * this.step);
      this.stepSin[k] = Math.sin((k + 1) * this.step);
    }
    this.weights = [];
  }

  channelWeights(ch) {
    while (this.weights.length <= ch) {
      this.weights.push({ a: new Float64Array(this.harmonics), b: new Float64Array(this.harmonics) });
    }
    return this.weights[ch];
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    const frames = output[0]?.length || 128;
    if (!input.length) {
      for (const out of output) out.fill(0);
      return true;
    }
    const K = this.harmonics;
    const { cos, sin, stepCos, stepSin } = this;
    const channels = Math.min(input.length, output.length);
    const w = [];
    for (let ch = 0; ch < channels; ch++) w.push(this.channelWeights(ch));

    // Re-seed the oscillators from the phase every block so the rotation never drifts.
    for (let k = 0; k < K; k++) {
      cos[k] = Math.cos((k + 1) * this.phase);
      sin[k] = Math.sin((k + 1) * this.phase);
    }
    for (let i = 0; i < frames; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const { a, b } = w[ch];
        let estimate = 0;
        for (let k = 0; k < K; k++) estimate += a[k] * cos[k] + b[k] * sin[k];
        const err = input[ch][i] - estimate;
        output[ch][i] = err;
        const g = MU * err;
        for (let k = 0; k < K; k++) {
          a[k] += g * cos[k];
          b[k] += g * sin[k];
        }
      }
      for (let k = 0; k < K; k++) {
        const c = cos[k];
        cos[k] = c * stepCos[k] - sin[k] * stepSin[k];
        sin[k] = c * stepSin[k] + sin[k] * stepCos[k];
      }
    }
    this.phase = (this.phase + frames * this.step) % (2 * Math.PI);
    for (let ch = channels; ch < output.length; ch++) output[ch].set(output[0]);
    return true;
  }
}

registerProcessor('hum-canceller', HumCanceller);
