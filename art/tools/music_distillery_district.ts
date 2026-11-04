/**
 * The Distillery District's walk music: a swung, brushed small-band tune in F for cobblestones and
 * brick warehouses at sunset.
 *
 * 16 bars at about 108 BPM in a 32-bar-song shape cut to four-bar sections, A A' B A'': a phrase
 * over Fmaj7 D7 Gm7 C7, its answer cadencing on F6, a bridge through Bbmaj7 and the minor iv (Bbm6)
 * back to Gm7 C7, and the phrase again with a turnaround into the top. A muted square lead with a
 * late vibrato, a triangle walking bass in quarters, rootless seventh chords comped in the
 * Charleston rhythm, and brushes: a swish on 2 and 4, a soft sweep on 1 and 3, a quiet ride and a
 * feathered kick.
 *
 * Scores count in triplet eighths: 3 to the beat and 12 to the bar, so a swung eighth pair is 2 + 1.
 */

import {
  mix,
  n,
  parse,
  type Play,
  RATE,
  type Score,
  tone,
  type ToneOptions,
  voice,
} from "./sounds.ts";

// A third of a beat at about 108 BPM. 16 bars of 12 make 192 steps, and 192 x 8160 samples is
// exactly 1530 AAC frames of 1024, so the loop ends on a frame boundary.
const STEP = 8160;

const LEAD = `
A4:2 C5:1 E5:3 D5:2 C5:4 | -:2 D5:1 C5:2 A4:4 F#4:3 | G4:2 Bb4:1 D5:3 F5:2 E5:1 D5:3 | E5:5 D5:1 Bb4:3 -:3
A4:2 C5:1 E5:3 D5:2 C5:4 | -:2 D5:1 F#5:2 A5:4 F#5:3 | G5:3 F5:2 D5:1 E5:2 C5:1 Bb4:3 | A4:2 C5:1 D5:2 F5:7
F5:6 D5:2 C5:1 D5:3 | Db5:6 C5:2 Bb4:1 G4:3 | E5:3 G5:2 E5:1 F#5:3 A5:3 | G5:5 F5:1 E5:2 D5:1 Bb4:3
A4:2 C5:1 E5:3 D5:2 C5:4 | -:2 D5:1 C5:2 A4:4 F#4:3 | G4:2 Bb4:1 D5:3 F5:2 E5:1 C5:3 | F4:6 -:5 G4:1
`;
// Quarter notes, with chromatic and scale steps into each next chord's root.
const BASS = `
F2:3 A2:3 C3:3 E3:3 | D3:3 C3:3 A2:3 F#2:3 | G2:3 Bb2:3 D3:3 Db3:3 | C3:3 Bb2:3 G2:3 E2:3
F2:3 A2:3 C3:3 E3:3 | D3:3 C3:3 A2:3 F#2:3 | G2:3 Bb2:3 C3:3 E2:3 | F2:3 C3:3 D3:3 A2:3
Bb2:3 C3:3 D3:3 F3:3 | Bb2:3 F2:3 G2:3 Ab2:3 | A2:3 C3:3 D3:3 F#2:3 | G2:3 Bb2:3 C3:3 E2:3
F2:3 A2:3 C3:3 E3:3 | D3:3 C3:3 A2:3 F#2:3 | G2:3 Bb2:3 C3:3 E2:3 | F2:3 A2:3 G2:3 E2:3
`;
// Each bar's chord on beat 1, then the chord pushed onto the swung "and" of 2.
const CHORDS = `
Fmaj7 Fmaj7 | D7 D7 | Gm7 Gm7 | C7 C7 | Fmaj7 Fmaj7 | D7 D7 | Gm7 C7 | F6 F6
Bbmaj7 Bbmaj7 | Bbm6 Bbm6 | Am7 D7 | Gm7 C7 | Fmaj7 Fmaj7 | D7 D7 | Gm7 C7 | F6 C7
`;
const BARS = CHORDS.replaceAll("\n", "|")
  .split("|")
  .filter((bar) => bar.trim() !== "")
  .map((bar) => bar.trim().split(/\s+/u));
// Rootless four-note voicings between F3 and A4, each a step or two from the next.
const VOICINGS: Readonly<Record<string, string>> = {
  Am7: "G3 A3 C4 E4",
  Bbm6: "G3 Bb3 Db4 F4",
  Bbmaj7: "A3 C4 D4 F4",
  C7: "E3 A3 Bb3 D4",
  D7: "F#3 A3 C4 E4",
  F6: "A3 C4 D4 G4",
  Fmaj7: "A3 C4 E4 G4",
  Gm7: "F3 A3 Bb3 D4",
};
// hz() reads sharps only, so the scores' flats are respelled.
const FLATS: Readonly<Record<string, string>> = {
  Ab: "G#",
  Bb: "A#",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
};

/** The sharp spelling of a flat note name such as "Bb4"; others pass through. */
function sharp(note: string): string {
  const name = note.slice(0, 2);
  return `${FLATS[name] ?? name}${note.slice(2)}`;
}

function score(text: string): Score {
  return parse(text).map(([note, steps]) => [sharp(note), steps]);
}

function voicing(chord: string, k: number): string {
  return sharp((VOICINGS[chord] ?? "").split(" ")[k] ?? "");
}

/** The kth note of each voicing in the Charleston rhythm: 3 steps on, 2 off, 4 on, 3 off. */
function compScore(k: number): Score {
  return BARS.flatMap(([first = "", second = ""]) => [
    [voicing(first, k), 3] as const,
    ["-", 2] as const,
    [voicing(second, k), 4] as const,
    ["-", 3] as const,
  ]);
}

/**
 * sox bend effects that hold the pitch for delay seconds, then wave it cents either side at rate Hz
 * until the note's last 30 ms; none for a note too short to reach a full cycle.
 */
function vibrato(length: number, delay = 0.22, rate = 5.5, cents = 12): string[] {
  const half = 1 / rate / 2;
  const end = length / RATE - 0.03;
  if (end < delay + 2.5 * half) {
    return [];
  }
  const bends = [`${delay.toFixed(3)},${cents},${(half / 2).toFixed(4)}`];
  let at = delay + half / 2;
  let sign = -1;
  while (at + half <= end) {
    bends.push(`0,${sign * 2 * cents},${half.toFixed(4)}`);
    at += half;
    sign = -sign;
  }
  return ["bend", "-f", "80", ...bends];
}

/** A muted, clarinet-like square: odd harmonics only, darkened twice, with a breathy rise. */
const lead: Play = (path, length, note) => {
  tone(path, length, "square", note, {
    attack: 0.03,
    fx: ["lowpass", "2400", ...vibrato(length)],
    low: 1700,
    release: length <= 2 * STEP ? 0.4 : 0.3,
    shape: "q",
    vol: 0.5,
  });
};

const bass: Play = (path, length, note) => {
  tone(path, length, "triangle", note, { attack: 0.006, release: 0.55, vol: 0.9 });
};

/** A low square under the triangle, so the walking line carries on small speakers. */
const bassEdge: Play = (path, length, note) => {
  tone(path, length, "square", note, { attack: 0.006, low: 420, release: 0.55, vol: 0.2 });
};

/** The kth voice of the comp: a soft mallet, a triangle that rings down, rolled upward 20 ms a voice. */
function comp(k: number): Play {
  const roll = k * n(0.02);
  return (path, length, note) => {
    tone(path, length - roll, "triangle", note, {
      attack: 0.02,
      release: 0.85,
      start: roll,
      vol: 0.5,
    });
  };
}

// A second low-pass for the noise voices, so their hiss falls away steeply above 4 kHz.
const DARK = ["lowpass", "3600"] as const;

const KINDS: Readonly<Record<string, readonly [number, ToneOptions]>> = {
  // The ride's beat and its quieter swung skip note.
  ride: [0.18, { attack: 0.002, fx: DARK, high: 1800, low: 3600, release: 0.9, vol: 0.5 }],
  skip: [0.12, { attack: 0.002, fx: DARK, high: 1800, low: 3600, release: 0.9, vol: 0.3 }],
  // A soft circular sweep on 1 and 3.
  sweep: [0.5, { attack: 0.22, high: 250, low: 1600, release: 0.55, shape: "h", vol: 0.45 }],
  // A swish across the snare head on 2 and 4.
  swish: [
    0.24,
    { attack: 0.035, fx: DARK, high: 500, low: 3000, release: 0.75, shape: "h", vol: 0.9 },
  ],
};

/** One brush or cymbal hit, with silence to the end of its slot. */
const drum: Play = (path, length, kind) => {
  if (kind === "kick") {
    tone(path, n(0.14), "triangle", [110, 48], {
      attack: 0.004,
      release: 0.9,
      tail: length - n(0.14),
      vol: 0.8,
    });
    return;
  }
  const [seconds, options] = KINDS[kind] ?? [0, {}];
  tone(path, n(seconds), "pinknoise", null, { ...options, tail: length - n(seconds) });
};

function repeat(bars: number, pattern: Score): Score {
  return Array.from({ length: bars }, () => pattern).flat();
}

export function music(tmp: string, out: string): void {
  const bars = BARS.length;
  const layers = [
    [voice(tmp, "dd-lead", score(LEAD), lead, STEP), 0.6],
    [voice(tmp, "dd-bass", score(BASS), bass, STEP), 0.45],
    [voice(tmp, "dd-bass-edge", score(BASS), bassEdge, STEP), 0.6],
    ...[0, 1, 2, 3].map(
      (k) => [voice(tmp, `dd-comp${k}`, compScore(k), comp(k), STEP), 0.34] as const,
    ),
    [
      voice(
        tmp,
        "dd-brush",
        repeat(bars, [
          ["sweep", 3],
          ["swish", 3],
          ["sweep", 3],
          ["swish", 3],
        ]),
        drum,
        STEP,
      ),
      1.65,
    ],
    [
      voice(
        tmp,
        "dd-ride",
        repeat(bars, [
          ["ride", 3],
          ["ride", 2],
          ["skip", 1],
          ["ride", 3],
          ["ride", 2],
          ["skip", 1],
        ]),
        drum,
        STEP,
      ),
      5,
    ],
    [
      voice(
        tmp,
        "dd-kick",
        repeat(bars, [
          ["kick", 3],
          ["-", 3],
          ["kick", 3],
          ["-", 3],
        ]),
        drum,
        STEP,
      ),
      0.5,
    ],
  ] as const;
  mix(layers, out);
}
