// Generates the original sound effects used by Abandonment (deterministic; seeded PRNG).
// Usage: npm run sounds:generate    -> writes public/sounds/*.wav
// All output is original work released under CC0-1.0 (see public/sounds/manifest.json).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SR = 22050;
const OUT = path.resolve("public", "sounds");
mkdirSync(OUT, { recursive: true });

let seed = 0x1badf00d;
const rand = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0xffffffff;
};
const noise = () => rand() * 2 - 1;
const buf = (sec) => new Float32Array(Math.floor(sec * SR));

/** One-pole low-pass. */
function lowpass(x, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  return x.map((v) => (y += a * (v - y)));
}
function highpass(x, cutoff) {
  const lp = lowpass(x, cutoff);
  return x.map((v, i) => v - lp[i]);
}
function normalise(x, peak = 0.8) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  return m === 0 ? x : x.map((v) => (v / m) * peak);
}
function fadeEdges(x, ms = 20) {
  const n = Math.floor((ms / 1000) * SR);
  for (let i = 0; i < n && i < x.length; i++) {
    const g = i / n;
    x[i] *= g;
    x[x.length - 1 - i] *= g;
  }
  return x;
}

function wav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767 | 0, i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path.join(OUT, name), Buffer.concat([h, data]));
  console.log(`${name}  ${(samples.length / SR).toFixed(2)}s  ${((44 + data.length) / 1024).toFixed(0)} KiB`);
}

// --- wind ambience (seamless 8s loop) ------------------------------------
{
  const loop = 8, fade = 1;
  const total = buf(loop + fade);
  for (let i = 0; i < total.length; i++) total[i] = noise();
  let y = lowpass(total, 700);
  y = highpass(y, 80);
  y = y.map((v, i) => {
    const t = i / SR;
    const swell = 0.55 + 0.25 * Math.sin((2 * Math.PI * t) / 4) + 0.2 * Math.sin((2 * Math.PI * t) / 8 + 1);
    return v * swell;
  });
  const out = buf(loop);
  const f = Math.floor(fade * SR);
  for (let i = 0; i < out.length; i++) {
    out[i] = i < f ? y[i] * (i / f) + y[out.length + i] * (1 - i / f) : y[i];
  }
  wav("wind.wav", normalise(Array.from(out), 0.5));
}

// --- ghost whoosh (airy, short) ------------------------------------------
{
  const x = buf(1.3);
  const n = Array.from(x, noise);
  const lp = lowpass(n, 2600);
  const bp = highpass(lp, 400);
  const out = bp.map((v, i) => {
    const t = i / SR;
    const env = Math.sin(Math.PI * Math.min(1, t / 1.3)) ** 2;
    const sweep = 0.5 + 0.5 * Math.sin(2 * Math.PI * (0.7 + t * 0.6) * t);
    return v * env * (0.6 + 0.4 * sweep);
  });
  wav("whoosh.wav", fadeEdges(normalise(out, 0.6)));
}

// --- bell strike (inharmonic partials, exponential decay) ------------------
function bell(sec, f0 = 196) {
  const partials = [[1, 1, 3.2], [2.0, 0.6, 3.8], [2.76, 0.45, 4.6], [5.4, 0.25, 6], [8.93, 0.12, 9]];
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [ratio, amp, decay] of partials) v += amp * Math.exp(-t * decay) * Math.sin(2 * Math.PI * f0 * ratio * t);
    x[i] = v * Math.min(1, t / 0.004);
  }
  return x;
}

// --- three distant midnight chimes ----------------------------------------
{
  const gap = 2.2, total = buf(gap * 2 + 3.2);
  for (let k = 0; k < 3; k++) {
    const b = bell(3.2);
    const off = Math.floor(k * gap * SR);
    for (let i = 0; i < b.length; i++) total[off + i] += b[i];
  }
  const soft = lowpass(Array.from(total), 1800); // "distant": rolled-off highs
  wav("midnight-chimes.wav", fadeEdges(normalise(soft, 0.55), 30));
}

// --- whisper (breathy, formant-ish, brief) ---------------------------------
{
  const x = buf(1.1);
  const n = Array.from(x, noise);
  const a = highpass(lowpass(n, 3800), 1200);
  const b = highpass(lowpass(n.map((v) => v * 0.8), 1600), 500);
  const out = a.map((v, i) => {
    const t = i / SR;
    const syll = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3.1 * t - 1.2);
    const env = Math.sin(Math.PI * Math.min(1, t / 1.1)) ** 1.5;
    return (v * 0.6 + b[i] * 0.5) * env * (0.35 + 0.65 * syll);
  });
  wav("whisper.wav", fadeEdges(normalise(out, 0.35)));
}

// --- completion chime (gentle fading two-note) -----------------------------
{
  const x = buf(1.8);
  const notes = [[659.25, 0], [987.77, 0.18]];
  for (const [f, start] of notes) {
    for (let i = Math.floor(start * SR); i < x.length; i++) {
      const t = i / SR - start;
      x[i] += Math.exp(-t * 2.6) * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t)) * Math.min(1, t / 0.01);
    }
  }
  wav("complete.wav", fadeEdges(normalise(Array.from(x), 0.5), 30));
}

// --- release (soft descending tone) -----------------------------------------
{
  const x = buf(1.5);
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = 392 * Math.exp(-t * 0.55);
    phase += (2 * Math.PI * f) / SR;
    x[i] = Math.sin(phase) * Math.exp(-t * 1.9) * Math.min(1, t / 0.03) * 0.8 + Math.sin(phase * 0.5) * Math.exp(-t * 2.4) * 0.3;
  }
  wav("release.wav", fadeEdges(normalise(Array.from(x), 0.5), 30));
}
