/**
 * High Park's walk music: a lilting 6/8 pastoral in F major for a leafy park with oaks and a pond.
 *
 * 24 bars at about 94 dotted-quarter beats a minute. A breathy triangle flute sings the tune (A), a
 * narrow-pulse oboe takes a contrasting phrase (B), and the flute returns over an oboe counter-line
 * (A'), closing on C so the loop turns back to the top. Under them a triangle harp rolls up open and
 * sus voicings and lets the top note ring, a gentle triangle bass moves on the dotted quarters, and a
 * soft wooden tick keeps time. A few short birdsong trills and calls fill the held notes.
 *
 * Notes are "name:sixteenths"; "-" is a rest, "Bb" spells a flat, and "G5>A5" plays a quick G5 grace
 * into A5.
 */

import {
  concat,
  fixed,
  type Freq,
  mix,
  n,
  parse,
  type Play,
  type Score,
  sox,
  tone,
  voice,
} from "./sounds.ts";

// One sixteenth in samples: 12 to the 6/8 bar, so a dotted quarter lasts 6 x 4704 samples, about
// 94 BPM. 4704 is a multiple of 32, so the 288 sixteenths of the loop fill whole 1024-sample AAC
// frames.
const STEP = 4704;
const BARS = 24;

const FLUTE = `
F5:4 A5:2 C6:6 | Bb5:4 A5:2 G5:6 | G5>A5:4 F5:2 D5:4 F5:2 | F5:4 G5:2 E5:6
F5:4 A5:2 C6:4 D6:2 | G6>F6:4 D6:2 Bb5:6 | D6:4 C6:2 Bb5:2 A5:2 G5:2 | F5:8 -:4
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
F5:4 A5:2 C6:6 | Bb5:4 A5:2 G5:6 | G5>A5:4 F5:2 D5:4 F5:2 | F5:4 G5:2 E5:6
F5:4 A5:2 C6:4 D6:2 | G6>F6:4 D6:2 Bb5:6 | D6:4 C6:2 Bb5:2 A5:2 G5:2 | G5:4 F5:2 E5:4 C5:2
`;
const OBOE = `
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
D5:6 C5:4 D5:2 | E5:6 G5:6 | G5:4 E5:2 C5:4 E5:2 | F5:4 E5:2 D5:6
Bb4:4 D5:2 F5:4 G5:2 | A5:4 B5:2 D6:6 | C6:4 Bb5:2 A5:4 G5:2 | F5:6 E5:6
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
`;
// The oboe's counter-line under the returning tune, quieter than its own phrase.
const COUNTER = `
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
C5:12 | C5:6 Bb4:6 | A4:12 | G4:12
A4:12 | Bb4:6 D5:6 | Bb4:6 C5:6 | Bb4:6 G4:4 -:2
`;
const BASS = `
F2:6 C3:6 | E2:6 G2:6 | D2:6 A2:6 | C3:6 G2:4 E2:2
F2:6 A2:6 | Bb2:6 F2:6 | G2:6 C3:6 | F2:6 C3:4 A2:2
Bb2:6 D3:6 | C3:6 G2:6 | A2:6 E2:6 | D2:6 F2:4 A2:2
G2:6 D3:6 | G2:6 B2:6 | Bb2:6 C3:6 | C3:6 G2:4 E2:2
F2:6 C3:6 | E2:6 G2:6 | D2:6 A2:6 | C3:6 G2:4 E2:2
F2:6 A2:6 | Bb2:6 F2:6 | G2:6 C3:6 | C3:6 G2:4 E2:2
`;
const CHORDS = `
F:12 | C:12 | Dm:12 | Csus4:6 C:6 | F:12 | Bb:12 | Gm7:6 C:6 | F:12
Bb:12 | C:12 | Am:12 | Dm:12 | Gm7:12 | G:12 | Bb:6 C:6 | Csus4:6 C:6
F:12 | C:12 | Dm:12 | Csus4:6 C:6 | F:12 | Bb:12 | Gm7:6 C:6 | Csus4:6 C:6
`;
// Each chord's open voicing, low to high: root, fifth (the fourth in Csus4), then octave or seventh,
// then ninth.
const VOICINGS: Readonly<Record<string, string>> = {
  Am: "A3 E4 A4 B4",
  Bb: "Bb3 F4 Bb4 C5",
  C: "C4 G4 C5 D5",
  Csus4: "C4 F4 G4 C5",
  Dm: "D3 A3 D4 E4",
  F: "F3 C4 F4 G4",
  G: "G3 D4 G4 A4",
  Gm7: "G3 D4 F4 A4",
};
// Birdsong, as [sixteenth it starts on, call, sixteenths]: over the held notes at phrase ends.
const BIRDS = [
  [42, "trill:D6:E6", 4],
  [89, "call:A6:E6", 6],
  [139, "chirp:G6", 4],
  [186, "call:G6:D6", 6],
  [234, "trill:C6:D6", 4],
] as const;
// A soft thump on the downbeat, the wooden tick on the second dotted quarter, and a quieter tick
// before the bar.
const DRUMS: Score = [
  ["thump", 6],
  ["tick", 4],
  ["ghost", 2],
];

/** parse() with "Bb" spelled as the A# that hz() reads. */
function score(text: string): Score {
  return parse(text).map(([note, steps]) => [note.replaceAll("Bb", "A#"), steps]);
}

/** Sum [path, volume] layers of equal length into out, without normalizing. */
function soxMix(layers: readonly (readonly [string, number])[], out: string): void {
  const inputs = layers.flatMap(([path, vol]) => ["-v", fixed(4, vol), path]);
  sox("-m", ...inputs, "-e", "floating-point", "-b", "32", out);
}

/** A breathy triangle: soft attack, a breath vibrato, and a puff of filtered noise at the onset. */
const flute: Play = (path, length, note) => {
  if (note.includes(">")) {
    const [grace = "", main = ""] = note.split(">");
    const glen = n(0.055);
    tone(`${path}-g.wav`, glen, "triangle", grace, {
      attack: 0.006,
      low: 3500,
      release: 0.5,
      shape: "h",
    });
    flute(`${path}-m.wav`, length - glen, main);
    concat([`${path}-g.wav`, `${path}-m.wav`], path);
    return;
  }
  tone(`${path}-t.wav`, length, "triangle", note, {
    attack: 0.035,
    fx: ["tremolo", "5.2", "14"],
    low: 3500,
    release: 0.45,
    shape: "h",
  });
  tone(`${path}-n.wav`, length, "pinknoise", null, {
    attack: 0.01,
    high: 1400,
    low: 3200,
    release: 0.9,
    shape: "h",
  });
  soxMix(
    [
      [`${path}-t.wav`, 1],
      [`${path}-n.wav`, 0.18],
    ],
    path,
  );
};

/** A reedy narrow pulse, filtered soft, with a slow swell and a light vibrato. */
const oboe: Play = (path, length, note) => {
  tone(path, length, "square", note, {
    attack: 0.04,
    duty: 18,
    fx: ["tremolo", "4.8", "12"],
    high: 200,
    low: 1900,
    release: 0.4,
    shape: "h",
  });
};

const bass: Play = (path, length, note) => {
  tone(path, length, "triangle", note, { attack: 0.012, release: 0.55, shape: "h" });
};

/** A plucked triangle that rings down within its note. */
const harp: Play = (path, length, note) => {
  tone(path, length, "triangle", note, { attack: 0.004, low: 2500, release: 0.92, shape: "q" });
};

/**
 * Roll each chord up in eighths: over a whole bar, three eighths and then the top note ringing for
 * the second dotted quarter; over a half bar, root, fifth and top.
 */
function harpScore(): Score {
  return parse(CHORDS).flatMap(([chord, steps]) => {
    const v = (VOICINGS[chord] ?? "").replaceAll("Bb", "A#").split(" ");
    const at = (i: number): string => v[i] ?? "";
    return steps === 12
      ? [[at(0), 2] as const, [at(1), 2] as const, [at(2), 2] as const, [at(3), 6] as const]
      : [0, 1, 3].map((i) => [at(i), 2] as const);
  });
}

/** One part of a bird figure: start seconds, seconds, freq and volume. */
type BirdPart = readonly [start: number, seconds: number, freq: Freq, vol: number];

function birdParts(call: string): BirdPart[] {
  const [kind, a = "", b = ""] = call.split(":");
  if (kind === "trill") {
    return Array.from({ length: 8 }, (_, i) => [i * 0.052, 0.05, i % 2 ? b : a, 1 - i * 0.07]);
  }
  if (kind === "call") {
    return [
      [0, 0.09, [b, a], 1],
      [0.13, 0.26, [a, b], 0.85],
    ];
  }
  if (kind === "chirp") {
    const low = `${a.charAt(0)}${Number.parseInt(a.slice(-1), 10) - 1}`;
    return Array.from({ length: 3 }, (_, i) => [i * 0.11, 0.07, [low, a], 1 - i * 0.15]);
  }
  return [];
}

/** A short birdsong figure, quiet and filtered below 4 kHz, filling length samples. */
const bird: Play = (path, length, call) => {
  const layers = birdParts(call).map(([start, seconds, freq, vol], i) => {
    const p = `${path}-${i}.wav`;
    tone(p, n(seconds), "triangle", freq, {
      attack: 0.006,
      low: 4000,
      release: 0.6,
      start: n(start),
      tail: length - n(start) - n(seconds),
      vol,
    });
    return [p, 1] as const;
  });
  soxMix(layers, path);
};

function birdScore(): Score {
  const notes: [string, number][] = [];
  let at = 0;
  for (const [start, call, steps] of BIRDS) {
    notes.push(["-", start - at], [call, steps]);
    at = start + steps;
  }
  return [...notes, ["-", BARS * 12 - at]];
}

const drum: Play = (path, length, kind) => {
  if (kind === "thump") {
    tone(path, n(0.1), "triangle", [130, 55], {
      attack: 0.003,
      release: 0.9,
      tail: length - n(0.1),
      vol: 0.8,
    });
    return;
  }
  // A hollow wooden knock: a falling mid triangle and a short band of noise.
  const vol = kind === "tick" ? 1 : 0.55;
  tone(`${path}-k.wav`, n(0.035), "triangle", [1150, 900], {
    attack: 0.002,
    low: 3000,
    release: 0.9,
    shape: "q",
    tail: length - n(0.035),
    vol,
  });
  tone(`${path}-n.wav`, n(0.02), "pinknoise", null, {
    attack: 0.002,
    high: 1200,
    low: 3000,
    release: 0.9,
    tail: length - n(0.02),
    vol: vol * 0.5,
  });
  soxMix(
    [
      [`${path}-k.wav`, 1],
      [`${path}-n.wav`, 1],
    ],
    path,
  );
};

export function music(tmp: string, out: string): void {
  // Volumes keep the sum below full scale, so sox never clips it before mix() normalizes the peak.
  mix(
    [
      [voice(tmp, "hp-flute", score(FLUTE), flute, STEP), 0.6],
      [voice(tmp, "hp-oboe", score(OBOE), oboe, STEP), 0.75],
      [voice(tmp, "hp-counter", score(COUNTER), oboe, STEP), 0.27],
      [voice(tmp, "hp-bass", score(BASS), bass, STEP), 0.42],
      [voice(tmp, "hp-harp", harpScore(), harp, STEP), 0.24],
      [voice(tmp, "hp-birds", birdScore(), bird, STEP), 0.18],
      [voice(tmp, "hp-drums", Array.from({ length: BARS }, () => DRUMS).flat(), drum, STEP), 0.18],
    ],
    out,
  );
}
