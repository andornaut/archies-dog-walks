/**
 * Synthesize the sound effects and the walks' music loops with sox, and encode them with ffmpeg.
 * Soft chiptune: square and triangle waves through gentle low-pass filters, short envelopes, and
 * every note fading to silence in its slot.
 *
 * sfx-tip            0.35s  coin chime: a square B5 hopping up to a ringing E6
 * sfx-treat          0.40s  bubbly triangle arpeggio up C6 E6 G6 C7
 * sfx-bump           0.26s  soft cushioned thud: a falling filtered square over a light triangle, with a puff
 *                           of noise
 * sfx-bark           0.20s  one "wuf": a falling square with a triangle body
 * sfx-dodge          0.23s  near miss: a swell of filtered noise and two light rising triangle skips
 * sfx-card           0.44s  paper swish, then a triangle chime G5 D6
 * sfx-gear-found     0.55s  sparkle: a narrow-pulse glissando D5 up to D6 into a shimmering D major chord
 * sfx-lost-wallet    0.45s  ka-ching: a drawer click, a shimmering C#7 E7 bell, then a jingle of two coins
 * sfx-friendly-neighbour 0.52s warm "aww": a triangle rising C5 to E5 with vibrato, then a soft G5 C6 chime
 * sfx-heart-lost     0.32s  soft sigh: a triangle falling E5 to C5 over a muted square
 * sfx-debuff-muddy    0.34s  wet squelch and two muddy plops
 * sfx-debuff-spotlight 0.37s soft switch click opening a short focus chime
 * sfx-debuff-stinky   0.44s  airy, warbling spray hiss with a low falling body
 * sfx-debuff-zoomies  0.38s  rushing air and a quick rising pulse with two light skips
 * sfx-fired          1.80s  sad "wah wah wah waaah" down G4 F#4 F4 E4, muted square
 * sfx-hit-skunk      0.50s  spray hiss: pink noise stepping down three bands over a falling "pfff"
 * sfx-hit-puddle     0.50s  splash: a pink noise burst and low plop, then rising triangle bubbles
 * sfx-hit-pothole    0.36s  clunk and splash: a wheel dropping into the hole, a dull falling square thud
 *                           and a knock, then a short pink noise splash and two rising triangle bubbles
 * sfx-hit-thief      0.60s  coin scatter: seven fading triangle pings between F#6 and E7
 * sfx-hit-squirrel   0.40s  chitter: seven quick falling square chirps near 2kHz, three then four
 * sfx-hit-other-dog  0.40s  friendly woof: a soft low "boof", then a rising yip
 * sfx-badge          1.00s  jingle: square D6 F#6 A6 up to a ringing D7, then a sparkle A7 F#7 D7 A7
 * sfx-new-best       1.50s  fanfare: G4 C5 E5 G5, E5 G5 over a triangle bass, warm square
 * sfx-zone-done      1.23s  arrival: square D6 D6 D6 then a held, shimmering G6 over B5, a pulse bass D5
 *                           to G4
 * music-cabbagetown  31.28s 12 bars at about 92 BPM in F, loops seamlessly: triangle music-box
 *                           lead, fingerpicked pulse guitar, triangle walking bass, brushed tick
 * music-distillery-district 35.53s 16 bars swung at about 108 BPM in F, loops seamlessly: muted
 *                           square lead with vibrato, triangle walking bass, rolled seventh chords, brushes
 * music-high-park    30.72s 24 bars of 6/8 at about 94 BPM in F, loops seamlessly: breathy triangle
 *                           flute, narrow-pulse oboe, triangle harp and bass, birdsong trills, wooden tick
 * music-kensington-market 34.30s 16 bars at about 112 BPM in D mixolydian, loops seamlessly:
 *                           accordion calls and marimba answers over a tresillo bass and hand drums
 * music-the-beaches  34.90s 16 bars at about 110 BPM in F, loops seamlessly: calypso steel pan lead,
 *                           bouncing triangle bass, offbeat pulse strums, kick, hand drums and shaker
 * music-yonge-street 29.09s 16 bars at about 132 BPM in D dorian, loops seamlessly: pulse lead
 *                           with a dotted-eighth echo, octave square bass, offbeat stabs, kick and snare
 *
 * Each effect is levelled to the same loudness on a phone speaker (EFFECT_LUFS), with sfx-badge,
 * sfx-fired, sfx-new-best and sfx-zone-done 2 LU louder, sfx-bump and sfx-dodge 3 LU quieter and
 * sfx-heart-lost 1 LU quieter, and padded with silence at both ends; the times above are the sounding
 * lengths. Each neighbourhood's loop is levelled to one phone loudness (MUSIC_LUFS). Each sound ships
 * as mono 44.1kHz Ogg Vorbis plus AAC (.m4a), since iOS Safari cannot play Ogg, and a build stops if
 * either file decodes to a peak at or over -1 dBFS.
 *
 * Usage:
 *   node art/tools/sounds.ts preview OUT_DIR   write the .ogg and .m4a files into OUT_DIR only
 *   node art/tools/sounds.ts one KEY OUT_DIR   write one sound's .ogg and .m4a into OUT_DIR
 *   node art/tools/sounds.ts build             write public/art/sounds/*.ogg and *.m4a, and flag
 *                                              the music as looping in public/art/manifest.extra.json
 *
 * Run from the repository root. Needs sox and ffmpeg. Every run is identical: sox runs in
 * repeatable mode (fixed noise seed, no dither) and ffmpeg in bitexact mode, so a rebuild only
 * changes files when this script changes.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const USAGE = `Usage:
  node art/tools/sounds.ts preview OUT_DIR   write the .ogg and .m4a files into OUT_DIR only
  node art/tools/sounds.ts one KEY OUT_DIR   write one sound's .ogg and .m4a into OUT_DIR
  node art/tools/sounds.ts build             write public/art/sounds/*.ogg and *.m4a, and flag
                                             the music as looping in public/art/manifest.extra.json`;

export const RATE = 44100;
// Leaves room for the lossy encoders to overshoot and still peak below -1 dBFS.
export const PEAK_DB = -4;
// One sixteenth note at about 100 BPM. 6608 is a multiple of 16, so the 192 sixteenths of a loop
// fill whole 1024-sample AAC frames and decoders that keep the encoder's end padding still loop
// without a gap.
export const STEP = 6608;
// Effects are levelled by their loudness on a phone speaker: the loudest momentary (400 ms)
// loudness of the sound high-passed at 300 Hz, as ffmpeg's ebur128 filter measures it, in LUFS. A
// phone speaker plays little below 300 Hz, so a thud's low body does not count toward it. Every
// effect reaches its level at or under PEAK_DB.
const EFFECT_LUFS = -17;
// The walk's big moments sit this many LU above the other effects.
const LOUDER: Readonly<Record<string, number>> = {
  "sfx-badge": 2,
  "sfx-fired": 2,
  "sfx-new-best": 2,
  "sfx-zone-done": 2,
};
// A frequent or minor cue sits this many LU under the other effects.
const QUIETER: Readonly<Record<string, number>> = {
  "sfx-bump": 3,
  "sfx-dodge": 3,
  "sfx-heart-lost": 1,
};
// Silence before and after every effect, in samples: AAC overshoots an onset inside the file's
// first 1024-sample frame, and the encoders' ringing dies out before the file ends.
const EFFECT_LEAD = 1024;
const EFFECT_TAIL = 882;
// An effect whose peak reaches PEAK_DB first may sit up to this many LU under its level.
const EFFECT_BAND = 1;
// The highest peak a decoded file may reach.
const CEILING_DB = -1;
// Neighbourhood loops are levelled by their integrated loudness on a phone speaker, after the same
// 300 Hz high-pass as the effects, so switching neighbourhoods doesn't jump on a phone.
const MUSIC_LUFS = -19;
const NOTES: Readonly<Record<string, number>> = { A: 0, B: 2, C: -9, D: -7, E: -5, F: -4, G: -2 };

export type Wave = "pinknoise" | "square" | "triangle";
/** A note name such as "F#4", a frequency in Hz, or [from, to] for an exponential sweep. */
export type Pitch = number | string;
export type Freq = Pitch | readonly [Pitch, Pitch] | null;

export interface ToneOptions {
  /** Seconds of rise. */
  readonly attack?: number;
  /** A square's duty cycle, in percent. */
  readonly duty?: number;
  /** Extra sox effects after the filters. */
  readonly fx?: readonly string[];
  /** High-pass corner in Hz. */
  readonly high?: number;
  /** Low-pass corner in Hz. */
  readonly low?: number;
  /** The fraction of the note its decay takes. */
  readonly release?: number;
  /** The sox fade shape of the envelope. */
  readonly shape?: string;
  /** Samples of silence before the note. */
  readonly start?: number;
  /** Samples of silence after the note. */
  readonly tail?: number;
  readonly vol?: number;
}

/** One tone() call of an effect: wave, seconds, freq, start seconds and options. */
export type EffectNote = readonly [
  wave: Wave,
  seconds: number,
  freq: Freq,
  start: number,
  options: Omit<ToneOptions, "start">,
];
export type Effects = Readonly<Record<string, readonly EffectNote[]>>;
/** One note of a score: a note name, "-" for a rest, or a voice's own word, and its length in steps. */
export type Score = readonly (readonly [string, number])[];
/** Renders one note of a score into path, length samples long. */
export type Play = (path: string, length: number, note: string) => void;
/** Renders a neighbourhood's loop into out, using tmp for its parts. */
export type Music = (tmp: string, out: string) => void;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** A number's exact binary value as a sign and a fraction of non-negative integers. */
function exact(x: number): { denominator: bigint; negative: boolean; numerator: bigint } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const negative = bits >> 63n === 1n;
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const mantissa = bits & 0xfffffffffffffn;
  const significand = exponent === 0 ? mantissa : mantissa | (1n << 52n);
  const shift = (exponent === 0 ? 1 : exponent) - 1075;
  return shift >= 0
    ? { denominator: 1n, negative, numerator: significand << BigInt(shift) }
    : { denominator: 1n << BigInt(-shift), negative, numerator: significand };
}

/** x with digits decimals, rounding the exact binary value half to even, keeping a negative sign. */
export function fixed(digits: number, x: number): string {
  const { denominator, negative, numerator } = exact(x);
  const scaled = numerator * 10n ** BigInt(digits);
  let whole = scaled / denominator;
  const twice = (scaled % denominator) * 2n;
  if (twice > denominator || (twice === denominator && whole % 2n === 1n)) {
    whole += 1n;
  }
  const text = whole.toString().padStart(digits + 1, "0");
  const point = text.length - digits;
  return `${negative ? "-" : ""}${text.slice(0, point)}${digits > 0 ? `.${text.slice(point)}` : ""}`;
}

/** x rounded to digits decimals, half to even on its exact binary value. */
export function roundTo(digits: number, x: number): number {
  return Number(fixed(digits, x));
}

/** A number written as a decimal with at least one fractional digit, as "1.0" or "-0.55". */
export function decimal(x: number): string {
  if (Object.is(x, -0)) {
    return "-0.0";
  }
  const text = String(x);
  return /[.e]/u.test(text) ? text : `${text}.0`;
}

/** Equal-tempered frequency of a note name such as "F#4"; a number passes through. */
export function hz(note: Pitch): number {
  if (typeof note === "number") {
    return note;
  }
  const semis =
    (NOTES[note.charAt(0)] ?? fail(`unknown note ${note}`)) +
    note.split("#").length -
    1 +
    (Number.parseInt(note.slice(-1), 10) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

/** Seconds in samples, rounded half to even. */
export function n(seconds: number): number {
  return roundTo(0, seconds * RATE);
}

function run(tool: string, args: readonly string[]): void {
  const result = spawnSync(tool, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    fail(`${tool} exited with ${result.status ?? result.signal}`);
  }
}

/** ffmpeg's log for a filter run over path, which it writes to stderr. */
function ffmpegLog(filters: string, path: string): string {
  const result = spawnSync("ffmpeg", ["-nostats", "-i", path, "-af", filters, "-f", "null", "-"], {
    encoding: "utf8",
    maxBuffer: 1 << 30,
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    fail(`ffmpeg exited with ${result.status ?? result.signal}: ${result.stderr}`);
  }
  return result.stderr;
}

export function sox(...args: readonly string[]): void {
  run("sox", ["-R", "-D", ...args]);
}

/**
 * One enveloped note, length samples long, with start samples of silence before it and tail after.
 *
 * freq is a note name, a frequency, or [from, to] for an exponential sweep. The envelope rises over
 * attack seconds and decays over the last release fraction of the note, then a last 64-sample
 * linear fade lands it exactly on zero.
 */
export function tone(
  path: string,
  length: number,
  wave: Wave,
  freq: Freq,
  {
    attack = 0.005,
    duty = 50,
    fx = [],
    high,
    low,
    release = 0.6,
    shape = "l",
    start = 0,
    tail = 0,
    vol = 1.0,
  }: ToneOptions = {},
): void {
  const chain = ["synth", `${length}s`, wave];
  if (wave !== "pinknoise") {
    // "-" sweeps exponentially; sox's smoother "/" sweep outputs a flat line when the pitch falls.
    const pitch =
      Array.isArray(freq) && freq.length === 2
        ? `${fixed(3, hz(freq[0]))}-${fixed(3, hz(freq[1]))}`
        : fixed(3, hz((freq ?? fail("a tone needs a pitch")) as Pitch));
    // sox's bias both shifts and shrinks the wave; this much centres a pulse of the given duty on zero.
    const bias = wave === "square" ? (100 * (1 - duty / 50)) / (2 - duty / 50) : 0;
    chain.push(pitch, fixed(4, bias), "0", String(duty));
  }
  // synth writes at full scale; filters overshoot it.
  chain.push("vol", "0.5");
  if (high) {
    chain.push("highpass", String(high));
  }
  if (low) {
    chain.push("lowpass", String(low));
  }
  chain.push(...fx);
  chain.push("fade", shape, `${Math.max(1, n(attack))}s`, `${length}s`);
  chain.push(`${Math.trunc(length * release)}s`);
  chain.push("fade", "t", "0", `${length}s`, "64s", "vol", decimal(vol));
  chain.push("pad", `${start}s`, `${tail}s`);
  sox("-r", String(RATE), "-c", "1", "-n", "-e", "floating-point", "-b", "32", path, ...chain);
}

export function rest(path: string, length: number): void {
  sox(
    "-r",
    String(RATE),
    "-c",
    "1",
    "-n",
    "-e",
    "floating-point",
    "-b",
    "32",
    path,
    "trim",
    "0",
    `${length}s`,
  );
}

/** Sum [path, volume] layers and normalize the peak to PEAK_DB. */
export function mix(layers: readonly (readonly [string, number])[], out: string): void {
  const inputs = layers.flatMap(([path, vol]) => ["-v", fixed(4, vol), path]);
  sox(
    ...(layers.length > 1 ? ["-m"] : []),
    ...inputs,
    "-e",
    "floating-point",
    "-b",
    "32",
    out,
    "gain",
    "-n",
    String(PEAK_DB),
  );
}

export function concat(paths: readonly string[], out: string): void {
  sox(...paths, out);
}

// A second low-pass for a bright voice, so it falls away steeply above 4 kHz instead of ringing on
// a phone speaker.
export const DARK = ["lowpass", "3000"] as const;

// Effects: each is a list of tone() calls, [wave, seconds, freq, start seconds, options].
export const EFFECTS: Effects = {
  "sfx-badge": [
    ["square", 0.08, "D6", 0, { duty: 25, fx: DARK, low: 3000, release: 0.4, vol: 0.5 }],
    ["square", 0.08, "F#6", 0.08, { duty: 25, fx: DARK, low: 3000, release: 0.4, vol: 0.5 }],
    ["square", 0.08, "A6", 0.16, { duty: 25, fx: DARK, low: 3000, release: 0.4, vol: 0.5 }],
    [
      "square",
      0.5,
      "D7",
      0.24,
      { duty: 25, fx: ["tremolo", "9", "30", ...DARK], low: 3000, release: 0.9, vol: 0.6 },
    ],
    ["triangle", 0.5, "D5", 0.24, { release: 0.9, vol: 0.6 }],
    ["triangle", 0.06, "A7", 0.5, { attack: 0.002, low: 4000, release: 0.8, vol: 0.35 }],
    ["triangle", 0.06, "F#7", 0.58, { attack: 0.002, low: 4000, release: 0.8, vol: 0.3 }],
    ["triangle", 0.06, "D7", 0.66, { attack: 0.002, low: 4000, release: 0.8, vol: 0.25 }],
    ["triangle", 0.26, "A7", 0.74, { attack: 0.002, low: 4000, release: 0.9, vol: 0.2 }],
  ],
  "sfx-bark": [
    [
      "square",
      0.18,
      [680, 300],
      0.02,
      { attack: 0.012, duty: 35, low: 1800, release: 0.55, shape: "h" },
    ],
    ["triangle", 0.18, [460, 220], 0.02, { attack: 0.012, release: 0.55, shape: "h", vol: 0.4 }],
    [
      "pinknoise",
      0.05,
      null,
      0.015,
      { attack: 0.006, high: 600, low: 2500, release: 0.8, vol: 0.12 },
    ],
  ],
  // A minor bump: a soft thud with little low body, quieter than a card obstacle's hit.
  "sfx-bump": [
    ["triangle", 0.26, [360, 150], 0, { attack: 0.006, release: 0.85, shape: "h", vol: 0.2 }],
    ["square", 0.22, [360, 170], 0, { attack: 0.008, low: 1000, release: 0.75, shape: "h" }],
    [
      "pinknoise",
      0.08,
      null,
      0,
      { attack: 0.003, high: 250, low: 1400, release: 0.9, shape: "h", vol: 0.6 },
    ],
  ],
  "sfx-card": [
    [
      "pinknoise",
      0.16,
      null,
      0,
      { attack: 0.07, high: 900, low: 3500, release: 0.55, shape: "h", vol: 0.3 },
    ],
    ["triangle", 0.1, "G5", 0.1, { release: 0.5 }],
    ["triangle", 0.25, "D6", 0.19, { release: 0.9 }],
    ["square", 0.25, "D5", 0.19, { duty: 25, low: 2000, release: 0.9, vol: 0.12 }],
  ],
  // Material onsets and short tonal signatures identify the four contact debuffs.
  "sfx-debuff-muddy": [
    [
      "pinknoise",
      0.17,
      null,
      0,
      { attack: 0.008, high: 500, low: 2300, release: 0.6, shape: "h", vol: 0.75 },
    ],
    [
      "triangle",
      0.17,
      [900, 420],
      0,
      { attack: 0.008, low: 2400, release: 0.6, shape: "h", vol: 0.7 },
    ],
    [
      "triangle",
      0.08,
      [780, 1200],
      0.12,
      { attack: 0.008, low: 2400, release: 0.6, shape: "h", vol: 0.6 },
    ],
    [
      "triangle",
      0.09,
      [650, 1000],
      0.23,
      { attack: 0.008, low: 2400, release: 0.6, shape: "h", vol: 0.55 },
    ],
    [
      "square",
      0.16,
      [600, 360],
      0.18,
      { attack: 0.008, duty: 25, low: 1400, release: 0.6, shape: "h", vol: 0.25 },
    ],
  ],
  "sfx-debuff-spotlight": [
    [
      "pinknoise",
      0.045,
      null,
      0,
      { attack: 0.008, high: 800, low: 2600, release: 0.6, shape: "h", vol: 0.35 },
    ],
    [
      "triangle",
      0.24,
      "D6",
      0.025,
      { attack: 0.008, low: 2400, release: 0.6, shape: "h", vol: 0.75 },
    ],
    [
      "triangle",
      0.25,
      "A6",
      0.12,
      { attack: 0.008, low: 2700, release: 0.6, shape: "h", vol: 0.35 },
    ],
    [
      "square",
      0.25,
      "D5",
      0.08,
      { attack: 0.008, duty: 25, low: 1600, release: 0.6, shape: "h", vol: 0.18 },
    ],
  ],
  "sfx-debuff-stinky": [
    [
      "pinknoise",
      0.38,
      null,
      0,
      {
        attack: 0.008,
        fx: ["lowpass", "3000", "tremolo", "12", "35"],
        high: 700,
        low: 2400,
        release: 0.4,
        shape: "h",
      },
    ],
    [
      "square",
      0.32,
      [780, 420],
      0.04,
      { attack: 0.008, duty: 20, low: 1400, release: 0.6, shape: "h", vol: 0.25 },
    ],
    [
      "pinknoise",
      0.24,
      null,
      0.2,
      { attack: 0.008, high: 500, low: 1600, release: 0.6, shape: "h", vol: 0.5 },
    ],
  ],
  "sfx-debuff-zoomies": [
    [
      "pinknoise",
      0.28,
      null,
      0,
      {
        attack: 0.035,
        fx: ["lowpass", "3000"],
        high: 900,
        low: 2800,
        release: 0.6,
        shape: "h",
        vol: 0.5,
      },
    ],
    [
      "square",
      0.29,
      [600, 1600],
      0.035,
      { attack: 0.008, duty: 20, low: 2200, release: 0.6, shape: "h", vol: 0.35 },
    ],
    [
      "triangle",
      0.09,
      "A5",
      0.07,
      { attack: 0.008, low: 2400, release: 0.6, shape: "h", vol: 0.65 },
    ],
    [
      "triangle",
      0.12,
      "D6",
      0.18,
      { attack: 0.008, low: 2400, release: 0.6, shape: "h", vol: 0.7 },
    ],
    [
      "triangle",
      0.1,
      "A6",
      0.28,
      { attack: 0.008, low: 2600, release: 0.6, shape: "h", vol: 0.35 },
    ],
  ],
  // A near miss: the air swells past and the dog skips up out of the way, with no thud.
  "sfx-dodge": [
    [
      "pinknoise",
      0.2,
      null,
      0,
      { attack: 0.05, fx: DARK, high: 900, low: 3200, release: 0.6, shape: "h", vol: 0.4 },
    ],
    ["triangle", 0.08, [520, 880], 0.07, { attack: 0.003, release: 0.6 }],
    ["triangle", 0.08, [700, 1180], 0.15, { attack: 0.003, release: 0.6, vol: 0.7 }],
  ],
  "sfx-fired": [
    ["square", 0.32, "G4", 0, { attack: 0.03, low: 1100, release: 0.5, shape: "h", vol: 0.5 }],
    ["square", 0.32, "F#4", 0.33, { attack: 0.03, low: 1100, release: 0.5, shape: "h", vol: 0.5 }],
    ["square", 0.32, "F4", 0.66, { attack: 0.03, low: 1100, release: 0.5, shape: "h", vol: 0.5 }],
    [
      "square",
      0.81,
      ["E4", "D#4"],
      0.99,
      { attack: 0.03, fx: ["tremolo", "5", "45"], low: 1100, release: 0.6, shape: "h", vol: 0.5 },
    ],
    ["triangle", 0.32, "G3", 0, { attack: 0.03, release: 0.5, shape: "h", vol: 0.6 }],
    ["triangle", 0.32, "F#3", 0.33, { attack: 0.03, release: 0.5, shape: "h", vol: 0.6 }],
    ["triangle", 0.32, "F3", 0.66, { attack: 0.03, release: 0.5, shape: "h", vol: 0.6 }],
    ["triangle", 0.81, ["E3", "D#3"], 0.99, { attack: 0.03, release: 0.6, shape: "h", vol: 0.6 }],
  ],
  // Warm and low where the treat is bright and quick: one voice rising a third, then a soft chime.
  "sfx-friendly-neighbour": [
    [
      "triangle",
      0.4,
      ["C5", "E5"],
      0,
      { attack: 0.03, fx: ["tremolo", "6", "20"], release: 0.6, shape: "h", vol: 0.9 },
    ],
    [
      "square",
      0.4,
      ["C5", "E5"],
      0,
      { attack: 0.03, duty: 25, low: 1800, release: 0.6, shape: "h", vol: 0.25 },
    ],
    ["triangle", 0.22, "G5", 0.24, { release: 0.9, vol: 0.6 }],
    ["triangle", 0.22, "C6", 0.3, { release: 0.9, vol: 0.35 }],
  ],
  // Rarer than a tip: a glissando up an octave lands on a ringing chord, its top voice shimmering.
  "sfx-gear-found": [
    [
      "square",
      0.14,
      ["D5", "D6"],
      0,
      { attack: 0.004, duty: 25, fx: DARK, low: 2600, release: 0.3, vol: 0.6 },
    ],
    [
      "square",
      0.42,
      "D6",
      0.13,
      {
        attack: 0.004,
        duty: 25,
        fx: ["tremolo", "11", "30", ...DARK],
        low: 3000,
        release: 0.9,
        vol: 0.5,
      },
    ],
    ["triangle", 0.4, "A6", 0.15, { attack: 0.004, release: 0.9, vol: 0.3 }],
    [
      "square",
      0.42,
      "F#5",
      0.13,
      { attack: 0.004, duty: 25, fx: DARK, low: 2200, release: 0.9, vol: 0.3 },
    ],
  ],
  // A card choice costs a heart: two notes falling a third, soft at both ends.
  "sfx-heart-lost": [
    ["triangle", 0.13, "E5", 0, { attack: 0.02, release: 0.5, shape: "h" }],
    ["triangle", 0.2, ["D5", "C5"], 0.12, { attack: 0.02, release: 0.8, shape: "h" }],
    [
      "square",
      0.13,
      "E5",
      0,
      { attack: 0.02, duty: 25, low: 1500, release: 0.5, shape: "h", vol: 0.2 },
    ],
    [
      "square",
      0.2,
      ["D5", "C5"],
      0.12,
      { attack: 0.02, duty: 25, low: 1500, release: 0.8, shape: "h", vol: 0.2 },
    ],
  ],
  "sfx-hit-other-dog": [
    ["triangle", 0.18, [320, 160], 0.01, { attack: 0.02, release: 0.7, shape: "h", vol: 0.5 }],
    ["square", 0.18, [320, 160], 0.01, { attack: 0.02, low: 1000, release: 0.7, shape: "h" }],
    ["pinknoise", 0.08, null, 0.01, { attack: 0.01, high: 250, low: 1400, release: 0.8, vol: 0.2 }],
    [
      "square",
      0.18,
      [700, 1400],
      0.22,
      { attack: 0.01, duty: 35, low: 2500, release: 0.6, vol: 0.6 },
    ],
    ["triangle", 0.18, [350, 700], 0.22, { attack: 0.01, release: 0.6, vol: 0.6 }],
  ],
  // The wheel drops in with a dull thud kept above 300 Hz, then the water splashes up round it.
  "sfx-hit-pothole": [
    [
      "square",
      0.11,
      [600, 360],
      0,
      { attack: 0.004, low: 1400, release: 0.7, shape: "h", vol: 0.7 },
    ],
    ["triangle", 0.12, [520, 340], 0, { attack: 0.004, release: 0.7, shape: "h", vol: 0.45 }],
    [
      "pinknoise",
      0.04,
      null,
      0,
      { attack: 0.002, high: 350, low: 1600, release: 0.8, shape: "h", vol: 0.5 },
    ],
    ["pinknoise", 0.22, null, 0.08, { attack: 0.01, high: 500, low: 3000, release: 0.8, vol: 0.8 }],
    ["triangle", 0.05, [480, 1000], 0.2, { attack: 0.003, release: 0.6, vol: 0.6 }],
    ["triangle", 0.06, [400, 860], 0.3, { attack: 0.003, release: 0.6, vol: 0.45 }],
  ],
  "sfx-hit-puddle": [
    ["pinknoise", 0.3, null, 0, { attack: 0.004, high: 250, low: 3000, release: 0.85, vol: 0.6 }],
    ["triangle", 0.3, [300, 110], 0, { attack: 0.004, release: 0.8, vol: 0.3 }],
    ["square", 0.2, [300, 140], 0, { attack: 0.004, low: 900, release: 0.8, shape: "h", vol: 0.6 }],
    ["triangle", 0.05, [420, 900], 0.12, { attack: 0.003, release: 0.6, vol: 0.7 }],
    ["triangle", 0.05, [560, 1200], 0.19, { attack: 0.003, release: 0.6, vol: 0.6 }],
    ["triangle", 0.05, [360, 780], 0.26, { attack: 0.003, release: 0.6, vol: 0.6 }],
    ["triangle", 0.05, [640, 1350], 0.34, { attack: 0.003, release: 0.6, vol: 0.5 }],
    ["triangle", 0.06, [480, 1000], 0.44, { attack: 0.003, release: 0.6, vol: 0.4 }],
  ],
  // Each band of hiss is lower than the last, so the spray falls without a swept filter.
  "sfx-hit-skunk": [
    [
      "pinknoise",
      0.22,
      null,
      0,
      { attack: 0.02, fx: DARK, high: 1800, low: 3800, release: 0.5, shape: "h", vol: 0.6 },
    ],
    [
      "pinknoise",
      0.25,
      null,
      0.12,
      { attack: 0.04, fx: DARK, high: 1000, low: 2600, release: 0.6, shape: "h", vol: 0.8 },
    ],
    [
      "pinknoise",
      0.3,
      null,
      0.2,
      {
        attack: 0.05,
        fx: ["tremolo", "18", "60"],
        high: 450,
        low: 1600,
        release: 0.7,
        shape: "h",
        vol: 0.8,
      },
    ],
    [
      "square",
      0.42,
      [900, 220],
      0.06,
      { attack: 0.03, duty: 25, low: 1400, release: 0.7, vol: 0.12 },
    ],
  ],
  "sfx-hit-squirrel": [
    [
      "square",
      0.03,
      [2200, 1450],
      0.01,
      { attack: 0.002, duty: 35, fx: DARK, low: 2600, release: 0.6, vol: 0.6 },
    ],
    [
      "square",
      0.03,
      [2350, 1500],
      0.055,
      { attack: 0.002, duty: 35, fx: DARK, low: 2600, release: 0.6, vol: 0.6 },
    ],
    [
      "square",
      0.03,
      [2100, 1400],
      0.1,
      { attack: 0.002, duty: 35, fx: DARK, low: 2600, release: 0.6, vol: 0.6 },
    ],
    [
      "square",
      0.03,
      [2300, 1500],
      0.2,
      { attack: 0.002, duty: 35, fx: DARK, low: 2600, release: 0.6, vol: 0.6 },
    ],
    [
      "square",
      0.03,
      [2450, 1600],
      0.245,
      { attack: 0.002, duty: 35, fx: DARK, low: 2600, release: 0.6, vol: 0.6 },
    ],
    [
      "square",
      0.03,
      [2200, 1450],
      0.29,
      { attack: 0.002, duty: 35, fx: DARK, low: 2600, release: 0.6, vol: 0.6 },
    ],
    [
      "square",
      0.065,
      [2500, 1400],
      0.335,
      { attack: 0.002, duty: 35, fx: DARK, low: 2600, release: 0.7, vol: 0.6 },
    ],
    [
      "pinknoise",
      0.38,
      null,
      0.01,
      {
        attack: 0.002,
        fx: ["tremolo", "22", "100", ...DARK],
        high: 1200,
        low: 3000,
        release: 0.3,
        vol: 0.2,
      },
    ],
  ],
  // Coins bounce apart: uneven gaps and pitches, each ping quieter than the last.
  "sfx-hit-thief": [
    ["triangle", 0.12, "B6", 0, { low: 3500, release: 0.9 }],
    ["triangle", 0.12, "E7", 0.06, { low: 3500, release: 0.9, vol: 0.95 }],
    ["triangle", 0.12, "G#6", 0.13, { low: 3500, release: 0.9, vol: 0.9 }],
    ["triangle", 0.12, "D7", 0.19, { low: 3500, release: 0.9, vol: 0.85 }],
    ["triangle", 0.12, "F#6", 0.28, { low: 3500, release: 0.9, vol: 0.75 }],
    ["triangle", 0.12, "C#7", 0.36, { low: 3500, release: 0.9, vol: 0.65 }],
    ["triangle", 0.12, "A6", 0.48, { low: 3500, release: 0.9, vol: 0.55 }],
    ["square", 0.08, "B5", 0, { duty: 25, low: 3000, release: 0.9, vol: 0.3 }],
    ["square", 0.08, "E6", 0.06, { duty: 25, low: 3000, release: 0.9, vol: 0.25 }],
  ],
  // A till's drawer clicks open on a bell, above the tip's coin in pitch, and two coins jingle after.
  "sfx-lost-wallet": [
    [
      "pinknoise",
      0.025,
      null,
      0,
      { attack: 0.001, fx: DARK, high: 1500, low: 3500, release: 0.8, vol: 0.6 },
    ],
    [
      "square",
      0.04,
      [640, 420],
      0,
      { attack: 0.002, low: 1600, release: 0.8, shape: "h", vol: 0.5 },
    ],
    [
      "square",
      0.34,
      "C#7",
      0.05,
      {
        attack: 0.003,
        duty: 25,
        fx: ["tremolo", "14", "40", ...DARK],
        low: 3000,
        release: 0.9,
        vol: 0.5,
      },
    ],
    [
      "triangle",
      0.3,
      "E7",
      0.05,
      { attack: 0.003, fx: ["tremolo", "14", "40"], low: 3500, release: 0.9, vol: 0.3 },
    ],
    [
      "square",
      0.3,
      "A6",
      0.05,
      { attack: 0.003, duty: 25, fx: DARK, low: 3000, release: 0.9, vol: 0.3 },
    ],
    ["triangle", 0.06, "A6", 0.24, { attack: 0.002, low: 3500, release: 0.8, vol: 0.5 }],
    ["triangle", 0.06, "C#7", 0.3, { attack: 0.002, low: 3500, release: 0.8, vol: 0.4 }],
  ],
  "sfx-new-best": [
    ["square", 0.1, "G4", 0, { attack: 0.008, low: 2200, release: 0.4, vol: 0.5 }],
    ["square", 0.1, "C5", 0.11, { attack: 0.008, low: 2200, release: 0.4, vol: 0.5 }],
    ["square", 0.1, "E5", 0.22, { attack: 0.008, low: 2200, release: 0.4, vol: 0.5 }],
    ["square", 0.35, "G5", 0.33, { attack: 0.008, low: 2200, release: 0.5, vol: 0.5 }],
    ["square", 0.12, "E5", 0.7, { attack: 0.008, low: 2200, release: 0.4, vol: 0.5 }],
    [
      "square",
      0.66,
      "G5",
      0.84,
      { attack: 0.008, fx: ["tremolo", "6", "25"], low: 2200, release: 0.8, vol: 0.5 },
    ],
    ["square", 0.66, "E5", 0.84, { attack: 0.008, duty: 25, low: 1800, release: 0.8, vol: 0.3 }],
    ["triangle", 0.33, "C4", 0, { release: 0.6, vol: 0.8 }],
    ["triangle", 0.35, "E4", 0.33, { release: 0.6, vol: 0.8 }],
    ["triangle", 0.12, "G3", 0.7, { release: 0.5, vol: 0.8 }],
    ["triangle", 0.66, "C4", 0.84, { release: 0.8, vol: 0.8 }],
  ],
  "sfx-tip": [
    ["square", 0.08, "B5", 0, { low: 3500, release: 0.3, vol: 0.6 }],
    ["square", 0.27, "E6", 0.08, { low: 3500, release: 0.9, vol: 0.6 }],
    ["triangle", 0.27, "E5", 0.08, { release: 0.9, vol: 0.5 }],
  ],
  "sfx-treat": [
    ["triangle", 0.07, "C6", 0, { release: 0.4 }],
    ["triangle", 0.07, "E6", 0.06, { release: 0.4 }],
    ["triangle", 0.07, "G6", 0.12, { release: 0.4 }],
    ["triangle", 0.22, "C7", 0.18, { release: 0.9 }],
    ["square", 0.22, "C6", 0.18, { duty: 25, low: 2500, release: 0.9, vol: 0.15 }],
  ],
  // A zone is done: three quick repeated notes and a long one, short-short-short-long, unlike the new best's arpeggio.
  "sfx-zone-done": [
    [
      "square",
      0.09,
      "D6",
      0,
      { attack: 0.004, duty: 25, fx: DARK, low: 3000, release: 0.4, vol: 0.5 },
    ],
    [
      "square",
      0.09,
      "D6",
      0.11,
      { attack: 0.004, duty: 25, fx: DARK, low: 3000, release: 0.4, vol: 0.5 },
    ],
    [
      "square",
      0.09,
      "D6",
      0.22,
      { attack: 0.004, duty: 25, fx: DARK, low: 3000, release: 0.4, vol: 0.5 },
    ],
    [
      "square",
      0.9,
      "G6",
      0.33,
      {
        attack: 0.004,
        duty: 25,
        fx: ["tremolo", "7", "25", ...DARK],
        low: 3000,
        release: 0.6,
        vol: 0.55,
      },
    ],
    [
      "square",
      0.9,
      "B5",
      0.33,
      { attack: 0.004, duty: 25, fx: DARK, low: 2200, release: 0.6, vol: 0.3 },
    ],
    ["square", 0.3, "D5", 0, { duty: 25, low: 1400, release: 0.6, vol: 0.3 }],
    ["square", 0.9, "G4", 0.33, { duty: 25, low: 1400, release: 0.6, vol: 0.3 }],
  ],
};

/** A score's "name:steps" notes, skipping the bar lines. */
export function parse(score: string): Score {
  return score
    .split(/\s+/u)
    .filter((token) => token !== "" && token !== "|")
    .map((token) => {
      const [note = "", steps = ""] = token.split(":");
      return [note, Number.parseInt(steps, 10)] as const;
    });
}

/**
 * Render a score of [note, sixteenths] through play(path, samples, note), step samples to the
 * sixteenth, and join the notes into one file.
 */
export function voice(tmp: string, name: string, score: Score, play: Play, step = STEP): string {
  const paths = score.map(([note, steps], i) => {
    const path = `${tmp}/${name}-${String(i).padStart(3, "0")}.wav`;
    if (note === "-") {
      rest(path, steps * step);
    } else {
      play(path, steps * step, note);
    }
    return path;
  });
  const out = `${tmp}/${name}.wav`;
  concat(paths, out);
  return out;
}

// Each neighbourhood's walk music, by art id. Its loop is music-<art id>, rendered by music(tmp,
// out) in art/tools/music_<art id with underscores>.ts.
export const ZONE_MUSIC = [
  "cabbagetown",
  "distillery-district",
  "high-park",
  "kensington-market",
  "the-beaches",
  "yonge-street",
] as const;
export const MUSIC: readonly string[] = ZONE_MUSIC.map((zone) => `music-${zone}`);

/** The function that renders a music key into a wav: music(tmp, out). */
export async function track(key: string): Promise<Music> {
  const name = key.replace(/^music-/u, "").replaceAll("-", "_");
  const module = (await import(`./music_${name}.ts`)) as { music: Music };
  return module.music;
}

/**
 * The loudest momentary loudness of a sound on a phone speaker, in LUFS (see EFFECT_LUFS). Silence
 * pads both ends, so a sound shorter than the 400 ms window still fills one.
 */
function phoneLoudness(path: string): number {
  const log = ffmpegLog("adelay=400,apad=pad_dur=0.4,highpass=f=300,ebur128=framelog=info", path);
  return Math.max(
    ...[...log.matchAll(/ M:\s*(-?[\d.]+)/gu)].map((m) => Number.parseFloat(m[1] ?? "")),
  );
}

/** A loop's integrated loudness on a phone speaker, in LUFS (see MUSIC_LUFS). */
function musicPhoneLoudness(path: string): number {
  const matches = [...ffmpegLog("highpass=f=300,ebur128", path).matchAll(/I:\s+(-?[\d.]+) LUFS/gu)];
  return Number.parseFloat(matches.at(-1)?.[1] ?? fail(`no integrated loudness for ${path}`));
}

/** Gain a rendered loop to MUSIC_LUFS. One gain over the whole loop keeps it seamless. */
function levelMusic(path: string, out: string): void {
  const gain = roundTo(2, MUSIC_LUFS - musicPhoneLoudness(path));
  sox(path, "-e", "floating-point", "-b", "32", out, "gain", decimal(gain));
}

/**
 * Mix an effect's tone() calls, level it to its phone loudness and pad it with EFFECT_LEAD and
 * EFFECT_TAIL of silence.
 */
function effect(tmp: string, key: string, notes: readonly EffectNote[], out: string): void {
  const layers = notes.map(([wave, seconds, freq, start, options], i) => {
    const path = `${tmp}/${key}-${i}.wav`;
    tone(path, n(seconds), wave, freq, { ...options, start: n(start) });
    return path;
  });
  const mixed = `${tmp}/${key}-mix.wav`;
  mix(
    layers.map((path) => [path, 1 / layers.length] as const),
    mixed,
  );
  const level = EFFECT_LUFS + (LOUDER[key] ?? 0) - (QUIETER[key] ?? 0);
  const gain = roundTo(1, level - phoneLoudness(mixed));
  if (gain > EFFECT_BAND) {
    fail(
      `${key} is ${decimal(gain)} LU under its phone loudness at its ${PEAK_DB} dBFS peak: move ` +
        "its energy above 300 Hz or soften its loudest onset",
    );
  }
  sox(
    mixed,
    "-e",
    "floating-point",
    "-b",
    "32",
    out,
    "gain",
    gain > 0 ? "0" : decimal(gain),
    "pad",
    `${EFFECT_LEAD}s`,
    `${EFFECT_TAIL}s`,
  );
}

/** A decoded file's peak in dBFS. */
function peakDb(path: string): number {
  const match = /max_volume: (-?[\d.]+) dB/u.exec(ffmpegLog("volumedetect", path));
  return Number.parseFloat(match?.[1] ?? fail(`no peak for ${path}`));
}

/**
 * Ogg Vorbis and AAC, mono 44.1kHz, with no timestamps or random stream serials. Stops the build if
 * either decodes to a peak at or over CEILING_DB.
 */
function encode(wav: string, outDir: string, key: string): void {
  const common = [
    "-v",
    "error",
    "-y",
    "-i",
    wav,
    "-ac",
    "1",
    "-ar",
    String(RATE),
    "-map_metadata",
    "-1",
    "-fflags",
    "+bitexact",
    "-flags:a",
    "+bitexact",
  ];
  const loop = key.startsWith("music-");
  run("ffmpeg", [...common, "-c:a", "libvorbis", "-q:a", loop ? "3" : "2", `${outDir}/${key}.ogg`]);
  run("ffmpeg", [...common, "-c:a", "aac", "-b:a", loop ? "64k" : "96k", `${outDir}/${key}.m4a`]);
  for (const ext of ["ogg", "m4a"]) {
    const peak = peakDb(`${outDir}/${key}.${ext}`);
    if (peak >= CEILING_DB) {
      fail(`${key}.${ext} peaks at ${decimal(peak)} dBFS, at or over ${CEILING_DB}`);
    }
  }
}

function withTmp<T>(work: (tmp: string) => T): T {
  const tmp = mkdtempSync(join(tmpdir(), "sounds-"));
  try {
    return work(tmp);
  } finally {
    rmSync(tmp, { force: true, recursive: true });
  }
}

/** Write each effect in effects, {key: tone() calls}, into outDir as .ogg and .m4a; return the keys. */
export function renderEffects(outDir: string, effects: Effects): string[] {
  mkdirSync(outDir, { recursive: true });
  withTmp((tmp) => {
    for (const [key, notes] of Object.entries(effects)) {
      const wav = `${tmp}/${key}.wav`;
      effect(tmp, key, notes, wav);
      encode(wav, outDir, key);
    }
  });
  return Object.keys(effects);
}

/** Write each sound in keys into outDir as .ogg and .m4a; return the keys. */
export async function render(
  outDir: string,
  keys: readonly string[] = [...Object.keys(EFFECTS), ...MUSIC],
): Promise<string[]> {
  mkdirSync(outDir, { recursive: true });
  renderEffects(
    outDir,
    Object.fromEntries(keys.flatMap((key) => (EFFECTS[key] ? [[key, EFFECTS[key]]] : []))),
  );
  const loops = keys.filter((key) => MUSIC.includes(key));
  const tracks = await Promise.all(loops.map(track));
  withTmp((tmp) => {
    loops.forEach((key, i) => {
      const wav = `${tmp}/${key}.wav`;
      const raw = `${tmp}/${key}-raw.wav`;
      tracks[i]?.(tmp, raw);
      levelMusic(raw, wav);
      encode(wav, outDir, key);
    });
  });
  return [...keys];
}

/**
 * Flag each music key as looping in the manifest sidecar, keeping every other entry: the game build
 * reads the flags from there, since a sound file cannot say it loops.
 */
export function markLoops(keys: readonly string[], path = "public/art/manifest.extra.json"): void {
  const extra = (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {}) as {
    sounds?: Record<string, Record<string, unknown>>;
  };
  extra.sounds ??= {};
  for (const key of keys.filter((k) => k.startsWith("music-"))) {
    extra.sounds[key] = { ...extra.sounds[key], loop: true };
  }
  writeFileSync(path, `${JSON.stringify(extra, null, 2)}\n`);
}

async function build(): Promise<void> {
  const keys = await render("public/art/sounds");
  markLoops(keys);
  console.log("built", keys.join(", "));
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, ...args] = argv;
  if (command === "preview" && args.length === 1) {
    console.log("wrote", (await render(args[0] ?? "")).join(", "));
  } else if (command === "one" && args.length === 2) {
    console.log("wrote", (await render(args[1] ?? "", [args[0] ?? ""])).join(", "));
  } else if (command === "build" && args.length === 0) {
    await build();
  } else {
    fail(USAGE);
  }
}

// Not awaited at the top level: a music module imports this one, so this module must finish
// evaluating before track() imports it.
if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
