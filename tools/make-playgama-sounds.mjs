// Makes the sound files for the Playgama build: a few short effects and a calm music loop, written as mp3 files.
//
//   node tools/make-playgama-sounds.mjs        ->  dist/playgama-sounds/*.mp3
//
// Playgama wants real compressed sound files in the archive (not tones made at run time), so the sounds are
// rendered here once and encoded with ffmpeg. Everything is original: simple bell, pad and pluck tones.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'playgama-sounds');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const RATE = 44100;
mkdirSync(out, { recursive: true });

const hz = n => 440 * Math.pow(2, (n - 69) / 12);        // MIDI note number -> frequency
const NOTE = { C4: 60, D4: 62, E4: 64, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, G5: 79, A5: 81, C6: 84, E6: 88, F4: 65, F3: 53, C3: 48, G3: 55, A3: 57, E3: 52, B3: 59, D3: 50 };

class Track {
  constructor(seconds, wrap = false) { this.n = Math.round(seconds * RATE); this.buf = new Float32Array(this.n); this.wrap = wrap; }
  // add one sampled note. shape(t) returns the sample at time t seconds into the note.
  add(at, dur, gain, shape) {
    const start = Math.round(at * RATE), len = Math.round(dur * RATE);
    for (let i = 0; i < len; i++) {
      let j = start + i;
      if (j >= this.n) { if (!this.wrap) break; j %= this.n; }
      this.buf[j] += gain * shape(i / RATE);
    }
  }
  // a soft bell: a few sine partials with an exponential decay and a very short attack
  bell(at, midi, dur, gain, decay = 5) {
    const f = hz(midi);
    this.add(at, dur, gain, t => {
      const env = Math.min(1, t / 0.004) * Math.exp(-t * decay);
      return env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 3) + 0.12 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 6));
    });
  }
  // a slow pad: sines with a long fade in and out
  pad(at, midi, dur, gain, fade = 0.9) {
    const f = hz(midi);
    this.add(at, dur, gain, t => {
      const env = Math.min(1, t / fade) * Math.min(1, (dur - t) / fade);
      return env * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2 * t + 0.6) + 0.15 * Math.sin(2 * Math.PI * f * 0.5 * t));
    });
  }
  tone(at, midi, dur, gain, { decay = 8, shape = 'sine', glideTo = null } = {}) {
    const f0 = hz(midi), f1 = glideTo ? hz(glideTo) : f0;
    let phase = 0;
    this.add(at, dur, gain, t => {
      const f = f0 + (f1 - f0) * (t / dur);
      phase += 2 * Math.PI * f / RATE;
      const env = Math.min(1, t / 0.005) * Math.exp(-t * decay);
      return env * (shape === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase));
    });
  }
  // normalise to a peak, then write a 16-bit mono WAV
  wav(file, peak = 0.8) {
    let max = 0; for (const v of this.buf) max = Math.max(max, Math.abs(v));
    const k = max ? peak / max : 1;
    const data = Buffer.alloc(this.n * 2);
    for (let i = 0; i < this.n; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(this.buf[i] * k * 32767))), i * 2);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(data.length, 40);
    writeFileSync(file, Buffer.concat([h, data]));
  }
}

// ---------- effects ----------
const fx = {};
fx.tick = (() => { const t = new Track(0.06); t.tone(0, 100, 0.05, 1, { decay: 70 }); return t; })();
fx.lock = (() => { const t = new Track(0.4); t.tone(0, 55, 0.3, 1, { decay: 14, glideTo: 45 }); t.bell(0.02, NOTE.A5, 0.3, 0.35, 12); return t; })();
fx.next = (() => { const t = new Track(0.18); t.tone(0, 84, 0.15, 1, { decay: 30, glideTo: 90 }); return t; })();
fx.great = (() => { const t = new Track(1.2); [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((n, i) => t.bell(i * 0.09, n, 0.9, 0.6, 4.5)); return t; })();
fx.good = (() => { const t = new Track(0.8); [NOTE.E5, NOTE.G5].forEach((n, i) => t.bell(i * 0.1, n, 0.6, 0.6, 6)); return t; })();
fx.ok = (() => { const t = new Track(0.6); t.bell(0, NOTE.G4, 0.5, 0.7, 7); return t; })();
fx.miss = (() => { const t = new Track(0.6); t.tone(0, 69, 0.45, 0.8, { decay: 5, shape: 'tri', glideTo: 62 }); return t; })();
fx.win = (() => {
  const t = new Track(2.4);
  [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6].forEach((n, i) => t.bell(i * 0.12, n, 1.6, 0.5, 2.6));
  [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach(n => t.bell(0.72, n, 1.6, 0.35, 2.4));
  return t;
})();

// ---------- music: 8 bars, a calm loop that wraps around without a click ----------
const BPM = 84, BEAT = 60 / BPM, BAR = BEAT * 4, BARS = 8;
const music = new Track(BAR * BARS, true);
const chords = [
  [NOTE.C4, NOTE.E4, NOTE.G4], [NOTE.A4 - 12, NOTE.C4, NOTE.E4], [NOTE.F3, NOTE.A3, NOTE.C4 + 0], [NOTE.G3, NOTE.B3, NOTE.D4]
];
for (let bar = 0; bar < BARS; bar++) {
  const c = chords[bar % 4], at = bar * BAR;
  c.forEach(n => music.pad(at, n, BAR + 1.2, 0.30, 1.1));                 // overlaps the next bar for a smooth change
  music.pad(at, c[0] - 12, BAR + 1.2, 0.34, 1.1);                         // bass
  // plucked eighth notes from the chord and its pentatonic neighbours
  const pat = [0, 2, 1, 2, 0, 1, 2, 1];
  const pool = [c[0] + 12, c[1] + 12, c[2] + 12, c[0] + 24];
  pat.forEach((p, i) => { if (bar % 2 === 1 || i % 2 === 0) music.bell(at + i * BEAT / 2, pool[p % pool.length], 1.6, 0.16, 3.2); });
}

mkdirSync(out, { recursive: true });
const jobs = { ...fx, music };
for (const [name, track] of Object.entries(jobs)) {
  const wav = join(out, `${name}.wav`), mp3 = join(out, `${name}.mp3`);
  track.wav(wav, name === 'music' ? 0.5 : 0.8);
  // a tiny fade-out on every effect stops end clicks; the loop has none, it must stay seamless
  const fade = name === 'music' ? [] : ['-af', `afade=t=out:st=${Math.max(0, track.n / RATE - 0.03).toFixed(3)}:d=0.03`];
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, ...fade, '-c:a', 'libmp3lame', '-q:a', '4', '-ar', '44100', mp3]);
  rmSync(wav);
  console.log(mp3);
}
