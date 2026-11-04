/**
 * Cabbagetown's walk music: a music-box tune over a fingerpicked guitar and a walking bass, 12 bars
 * at about 92 BPM in F major.
 *
 * Form A B A': a phrase over F Dm Bb C that stops on the dominant, a contrasting phrase over Bb F/A
 * Gm C7 that climbs to F6, and the first phrase again, resolving through Gm C to F with a pickup back
 * to the top. Notes are "name:sixteenths"; "-" is a rest.
 */

import {
  mix,
  n,
  parse,
  type Play,
  type Score,
  tone,
  type ToneOptions,
  voice,
  type Wave,
} from "./sounds.ts";

// One sixteenth at about 92 BPM. 7184 is a multiple of 16, so the 192 sixteenths of the loop fill
// whole 1024-sample AAC frames.
const STEP = 7184;

const LEAD = `
C6:3 A5:1 F5:4 G5:2 A5:2 C6:4 | D6:6 C6:2 A5:4 F5:4 | D6:3 C6:1 A#5:4 A5:2 A#5:2 D6:4 | C6:8 A#5:2 A5:2 G5:4
F5:2 A#5:2 D6:4 D6:2 C6:2 A#5:4 | A5:2 C6:2 F6:4 F6:2 E6:2 C6:4 | A#5:4 D6:4 G5:2 A5:2 A#5:4 | A#5:4 A5:2 G5:2 E5:4 G5:4
C6:3 A5:1 F5:4 G5:2 A5:2 C6:4 | D6:6 E6:2 F6:4 D6:4 | C6:4 A#5:4 A5:2 A#5:2 G5:4 | F5:8 -:4 A5:2 A#5:2
`;
const BASS = `
F2:4 A2:4 C3:4 E3:4 | D3:4 A2:4 F2:4 A2:4 | A#2:4 D3:4 F3:4 D3:4 | C3:4 E3:4 G2:4 A2:4
A#2:4 D3:4 F3:4 A#2:4 | A2:4 C3:4 F3:4 A2:4 | G2:4 A#2:4 D3:4 A#2:4 | C3:4 A#2:4 G2:4 E2:4
F2:4 A2:4 C3:4 E3:4 | D3:4 C3:4 A#2:4 A2:4 | G2:4 A#2:4 C3:4 E2:4 | F2:4 A2:4 C3:4 E2:4
`;
// One chord per half bar.
const CHORDS = "F F Dm Dm Bb Bb C C Bb Bb F F Gm Gm C7 C7 F F Dm Dm Gm C F F";
const VOICINGS: Readonly<Record<string, string>> = {
  Bb: "A#3 D4 F4 A#4",
  C: "C4 E4 G4 C5",
  C7: "C4 E4 A#4 C5",
  Dm: "D4 F4 A4 D5",
  F: "C4 F4 A4 C5",
  Gm: "D4 G4 A#4 D5",
};
// A fingerpicked pattern over a half bar's four eighths: low, middle, high, top as indices into the
// voicing.
const PICK = [0, 2, 1, 3] as const;

function octaveUp(score: Score): Score {
  return score.map(([note, steps]) => [
    note === "-" ? note : `${note.slice(0, -1)}${Number.parseInt(note.slice(-1), 10) + 1}`,
    steps,
  ]);
}

function guitarScore(): Score {
  return CHORDS.split(" ").flatMap((chord) =>
    PICK.map((i) => [(VOICINGS[chord] ?? "").split(" ")[i] ?? "", 2] as const),
  );
}

/** A brushed tick on beats 2 and 4. */
function brushScore(): Score {
  return Array.from({ length: 12 }, () =>
    ["-", "tick", "-", "tick"].map((v) => [v, 4] as const),
  ).flat();
}

/**
 * A note that starts at once and decays through its whole length, as a plucked string or a
 * music-box tine does. shape is the sox fade: "t" linear, "h" a half sine that keeps more of the
 * body, "l" logarithmic for a ping that dies away fast.
 */
function pluck(
  wave: Wave,
  vol: number,
  low: number,
  { release = 0.97, shape = "t", ...options }: ToneOptions = {},
): Play {
  return (path, length, note) => {
    tone(path, length, wave, note, { ...options, attack: 0.003, low, release, shape, vol });
  };
}

const brush: Play = (path, length) => {
  tone(path, n(0.06), "pinknoise", null, {
    attack: 0.012,
    high: 1800,
    low: 4000,
    release: 0.8,
    shape: "h",
    tail: length - n(0.06),
    vol: 0.3,
  });
};

export function music(tmp: string, out: string): void {
  const tine = voice(
    tmp,
    "tine",
    parse(LEAD),
    pluck("triangle", 0.9, 3500, { release: 0.9, shape: "h" }),
    STEP,
  );
  const shimmer = voice(
    tmp,
    "shimmer",
    octaveUp(parse(LEAD)),
    pluck("triangle", 0.9, 3800, { shape: "l" }),
    STEP,
  );
  const guitar = voice(
    tmp,
    "guitar",
    guitarScore(),
    pluck("square", 0.5, 1400, { duty: 25 }),
    STEP,
  );
  const bass = voice(
    tmp,
    "bass",
    parse(BASS),
    (path, length, note) => {
      tone(path, length, "triangle", note, { attack: 0.01, release: 0.6, vol: 0.9 });
    },
    STEP,
  );
  const brushes = voice(tmp, "brush", brushScore(), brush, STEP);
  // The bass and brushes mix with their polarity inverted, so their attacks partly cancel the
  // tine's instead of stacking on them: the lower peak leaves headroom when the loop is levelled to
  // MUSIC_LUFS.
  mix(
    [
      [tine, 0.5],
      [shimmer, 0.1],
      [guitar, 0.55],
      [bass, -0.55],
      [brushes, -2.5],
    ],
    out,
  );
}
