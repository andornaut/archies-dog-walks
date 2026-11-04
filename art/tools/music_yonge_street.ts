/**
 * Yonge Street's walk music: 16 bars of driving chiptune house at about 132 BPM in D dorian.
 *
 * A hook over Dm G C Am, the hook again climbing higher, a bridge over F C G A, then the hook with a
 * turnaround on A that leads back to the top. Four-on-the-floor kick, a noise snare on 2 and 4, a
 * pulsing octave bass in eighths, offbeat chord stabs, and a pulse lead with a dotted-eighth echo
 * that wraps around the loop so its tail lands on the start.
 */

import { concat, mix, n, parse, type Play, type Score, sox, tone, voice } from "./sounds.ts";

// One sixteenth at about 132 BPM. 256 sixteenths of 5012 samples fill 1253 whole 1024-sample AAC
// frames.
const STEP = 5012;
const BARS = 16;

const LEAD = `
D5:2 F5:2 A5:3 G5:3 F5:2 A5:4 | B5:3 A5:3 G5:2 D5:4 -:4 | E5:2 G5:2 C6:3 B5:3 G5:2 C6:4 | A5:3 G5:3 E5:2 A5:4 -:4
D5:2 F5:2 A5:3 G5:3 F5:2 A5:4 | B5:3 A5:3 G5:2 B5:2 D6:6 | E6:3 D6:3 C6:2 G5:2 C6:2 E6:4 | D6:3 C6:3 A5:2 E5:2 G5:2 A5:4
A5:4 C6:4 A5:2 G5:2 F5:4 | G5:4 E5:2 G5:2 C6:6 -:2 | B5:4 D6:4 B5:2 A5:2 G5:4 | A5:3 C#6:3 E6:2 C#6:2 A5:2 E5:4
D5:2 F5:2 A5:3 G5:3 F5:2 A5:4 | B5:3 A5:3 G5:2 D5:4 -:4 | E5:2 G5:2 C6:3 D6:3 E6:2 C6:4 | E6:3 D6:3 C#6:2 A5:3
E5:3 C#5:2
`;
// Eighths: the root jumping octaves, then two notes that walk into the next bar's root.
const BASS = `
D2 D3 D2 D3 D2 D3 C3 A2 | G2 G3 G2 G3 G2 G3 D3 B1 | C2 C3 C2 C3 C2 C3 G2 B2 | A2 A3 A2 A3 A2 A3 G2 E2
D2 D3 D2 D3 D2 D3 C3 A2 | G2 G3 G2 G3 G2 G3 D3 B1 | C2 C3 C2 C3 C2 C3 G2 B2 | A2 A3 A2 A3 A2 A3 G2 E2
F2 F3 F2 F3 F2 F3 A2 B1 | C2 C3 C2 C3 C2 C3 E2 F#2 | G2 G3 G2 G3 G2 G3 D3 B2 | A2 A3 A2 A3 A2 A3 E2 C#2
D2 D3 D2 D3 D2 D3 C3 A2 | G2 G3 G2 G3 G2 G3 D3 B1 | C2 C3 C2 C3 C2 C3 G2 B2 | A2 A3 A2 A3 A2 G2 E2 C#2
`;
const CHORDS = "Dm G C Am Dm G C Am F C G A Dm G C A";
const STABS: Readonly<Record<string, string>> = {
  A: "E4 A4 C#5",
  Am: "E4 A4 C5",
  C: "E4 G4 C5",
  Dm: "F4 A4 C5",
  F: "F4 A4 C5",
  G: "D4 G4 B4",
};
// Sixteenths: a dotted eighth.
const ECHO = 3;
// Seconds between a stab's notes, low to high.
const STRUM = 0.006;

function bassScore(): Score {
  return BASS.split(/\s+/u)
    .filter((note) => note !== "" && note !== "|")
    .map((note) => [note, 2] as const);
}

/** One note of each chord on the four offbeat eighths of its bar. */
function stabScore(index: number): Score {
  return CHORDS.split(" ").flatMap((chord) => {
    const note = (STABS[chord] ?? "").split(" ")[index] ?? "";
    return Array.from({ length: 4 }, () => [["-", 2] as const, [note, 2] as const]).flat();
  });
}

/** A short pulse stab, each higher note a little later so the chord strums. */
function stab(index: number): Play {
  return (path, length, note) => {
    const offset = n(STRUM * index);
    tone(path, length - offset, "square", note, {
      attack: 0.003,
      duty: 25,
      low: 1800,
      release: 0.85,
      start: offset,
      vol: 0.5,
    });
  };
}

function kickScore(): Score {
  return Array.from({ length: BARS * 4 }, () => ["kick", 4] as const);
}

/** Snare on 2 and 4, with a four-sixteenth roll closing bars 8 and 16. */
function snareScore(): Score {
  const bar: Score = [
    ["-", 4],
    ["snare", 4],
    ["-", 4],
    ["snare", 4],
  ];
  const roll: Score = [
    ["-", 4],
    ["snare", 4],
    ["-", 4],
    ["snare", 1],
    ["snare", 1],
    ["snare", 1],
    ["snare", 1],
  ];
  return Array.from({ length: BARS }, (_, i) => (i % 8 === 7 ? roll : bar)).flat();
}

const kick: Play = (path, length) => {
  tone(path, n(0.11), "triangle", [165, 45], {
    attack: 0.002,
    release: 0.9,
    tail: length - n(0.11),
  });
};

/** A burst of band-passed noise over a short falling triangle body. */
const snare: Play = (path, length) => {
  const size = Math.min(n(0.09), length);
  const body = `${path}-body.wav`;
  const hiss = `${path}-hiss.wav`;
  tone(body, size, "triangle", [230, 150], { attack: 0.002, release: 0.9 });
  tone(hiss, size, "pinknoise", null, { attack: 0.002, high: 450, low: 3000, release: 0.85 });
  sox(
    "-m",
    "-v",
    "0.45",
    body,
    "-v",
    "0.9",
    hiss,
    "-e",
    "floating-point",
    "-b",
    "32",
    path,
    "pad",
    "0",
    `${length - size}s`,
  );
};

/** Move the last samples of a loop to its start, so a delayed copy wraps around the seam. */
function rotate(tmp: string, name: string, path: string, samples: number): string {
  const total = BARS * 16 * STEP;
  const head = `${tmp}/${name}-head.wav`;
  const tail = `${tmp}/${name}-tail.wav`;
  sox(path, tail, "trim", `${total - samples}s`);
  sox(path, head, "trim", "0", `${total - samples}s`);
  const out = `${tmp}/${name}.wav`;
  concat([tail, head], out);
  return out;
}

export function music(tmp: string, out: string): void {
  const lead = voice(
    tmp,
    "ys-lead",
    parse(LEAD),
    (p, length, note) => {
      tone(p, length, "square", note, {
        attack: 0.006,
        duty: 30,
        low: 2500,
        release: 0.5,
        vol: 0.5,
      });
    },
    STEP,
  );
  const body = voice(
    tmp,
    "ys-body",
    parse(LEAD),
    (p, length, note) => {
      tone(p, length, "triangle", note, { attack: 0.006, release: 0.5, vol: 0.5 });
    },
    STEP,
  );
  const echo = rotate(
    tmp,
    "ys-echo",
    voice(
      tmp,
      "ys-echo-dry",
      parse(LEAD),
      (p, length, note) => {
        tone(p, length, "square", note, {
          attack: 0.01,
          duty: 30,
          low: 1600,
          release: 0.7,
          vol: 0.5,
        });
      },
      STEP,
    ),
    ECHO * STEP,
  );
  const bass = voice(
    tmp,
    "ys-bass",
    bassScore(),
    (p, length, note) => {
      tone(p, length, "square", note, { attack: 0.004, low: 800, release: 0.4, vol: 0.8 });
    },
    STEP,
  );
  const stabs = [0, 1, 2].map((i) => voice(tmp, `ys-stab${i}`, stabScore(i), stab(i), STEP));
  const kicks = voice(tmp, "ys-kick", kickScore(), kick, STEP);
  const snares = voice(tmp, "ys-snare", snareScore(), snare, STEP);
  mix(
    [
      [lead, 1.1],
      [body, 0.45],
      [echo, 0.35],
      [bass, 0.5],
      ...stabs.map((s) => [s, 0.4] as const),
      [kicks, 0.5],
      [snares, 0.8],
    ],
    out,
  );
}
