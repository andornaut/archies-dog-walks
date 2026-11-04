/**
 * The Beaches walk music: a breezy calypso on the boardwalk in F major at 110 BPM.
 *
 * 16 bars: a hook phrase over F Dm Bb C, the same hook answered and resolved, a bridge that steps
 * down over Bb Am Gm C, and the hook again with a climb to F6 and a turnaround that leads back to
 * the top. A steel pan lead (a triangle struck with a quick attack and a long fall, a softened
 * triangle octave that fades first, and a short pulse ping for the stick), a bouncing triangle bass
 * on the calypso dotted rhythm, plucked pulse chords on the offbeat eighths, a soft kick, hand drum
 * taps and a band-limited shaker on the eighths.
 */

import { hz, mix, n, parse, type Play, type Score, tone, voice } from "./sounds.ts";

// One sixteenth at about 110 BPM. 6012 is a multiple of 4, so the 256 sixteenths of the loop fill
// whole 1024-sample AAC frames.
const STEP = 6012;

// Notes are "name:sixteenths"; "-" is a rest. A# is B flat. Four bars to a phrase.
const LEAD = `
A5:3 C6:3 A5:2 F5:2 G5:2 A5:4 | F5:3 A5:3 F5:2 D5:4 -:2 C5:2 |
D5:3 F5:3 A#5:2 A5:2 G5:2 F5:4 | E5:3 G5:3 C6:4 -:2 G5:2 A#5:2
A5:3 C6:3 A5:2 F5:2 G5:2 A5:4 | D6:3 C6:3 A5:2 F5:4 -:2 D5:2 |
D5:2 F5:2 A#5:4 C6:2 A#5:2 G5:4 | A5:6 G5:2 F5:4 -:4
D6:6 C6:2 A#5:4 F5:4 | C6:6 A#5:2 A5:4 E5:4 |
A#5:3 A5:3 G5:2 D5:2 F5:2 A#5:4 | C6:3 A#5:3 G5:2 E5:4 -:2 G5:2
A5:3 C6:3 A5:2 F5:2 G5:2 A5:4 | F5:3 A5:3 F5:2 D5:4 -:2 C5:2 |
D5:2 F5:2 A#5:4 C6:2 D6:2 E6:4 | F6:6 C6:2 E5:2 G5:2 -:2 G5:2
`;
const BASS = `
F2:6 C3:2 F3:4 C3:4 | D3:6 A2:2 D3:4 A2:4 | A#2:6 F2:2 A#2:4 D3:4 | C3:6 G2:2 C3:4 E3:4
F2:6 C3:2 F3:4 C3:4 | D3:6 A2:2 D3:4 F3:4 | A#2:4 D3:4 C3:4 E3:4 | F2:6 C3:2 F3:4 A2:4
A#2:6 F2:2 A#2:4 D3:4 | A2:6 E3:2 A2:4 C3:4 | G2:6 D3:2 G2:4 A#2:4 | C3:6 G2:2 C3:4 E3:4
F2:6 C3:2 F3:4 C3:4 | D3:6 A2:2 D3:4 A2:4 | A#2:4 F2:4 C3:4 G2:4 | F2:4 A2:4 C3:4 E2:4
`;
// One chord per bar, or two joined by "+" for a half bar each.
const CHORDS = "F Dm Bb C F Dm Bb+C F Bb Am Gm C7 F Dm Bb+C F+C7";
const VOICINGS: Readonly<Record<string, string>> = {
  Am: "A3 C4 E4",
  Bb: "A#3 D4 F4",
  C: "G3 C4 E4",
  C7: "A#3 C4 E4",
  Dm: "A3 D4 F4",
  F: "A3 C4 F4",
  Gm: "G3 A#3 D4",
};

/** One voice of the offbeat stabs: chord tone part (0 is the lowest) on each offbeat eighth. */
function chordScore(part: number): Score {
  return CHORDS.split(" ").flatMap((bar) => {
    const halves = bar.split("+");
    return [0, 1, 2, 3].flatMap((beat) => {
      const chord = halves[Math.floor((beat * halves.length) / 4)] ?? "";
      return [["-", 2] as const, [(VOICINGS[chord] ?? "").split(" ")[part] ?? "", 2] as const];
    });
  });
}

/** Kick on 1 and 3, a high hand drum on the "and" of 2 and 4, a low one just before beat 4. */
function drumScore(): Score {
  const bar: Score = [
    ["kick", 6],
    ["hi", 2],
    ["kick", 3],
    ["lo", 3],
    ["hi", 2],
  ];
  return Array.from({ length: 16 }, () => bar).flat();
}

/** A shake on every eighth, leaning on the offbeats. */
function shakerScore(): Score {
  return Array.from({ length: 16 * 4 }, () =>
    ["soft", "loud"].map((accent) => [accent, 2] as const),
  ).flat();
}

/** The pan's body: a struck triangle that fades through the note, rolled on the long notes. */
const leadBody: Play = (path, length, note) => {
  tone(path, length, "triangle", note, {
    attack: 0.003,
    fx: length >= 6 * STEP ? ["tremolo", "11", "35"] : [],
    release: 0.97,
    shape: "q",
    vol: 0.9,
  });
};

/**
 * The bright overtone: a triangle an octave up, low-passed near its fundamental, that fades before
 * the body does.
 */
const leadOctave: Play = (path, length, note) => {
  const ring = Math.min(length, n(0.22));
  tone(path, ring, "triangle", 2 * hz(note), {
    attack: 0.008,
    low: 3000,
    release: 0.9,
    shape: "t",
    tail: length - ring,
    vol: 0.35,
  });
};

/** The stick: a short, soft pulse at the note's pitch. */
const leadPing: Play = (path, length, note) => {
  const ring = Math.min(length, n(0.05));
  tone(path, ring, "square", note, {
    attack: 0.001,
    duty: 25,
    low: 3000,
    release: 0.9,
    tail: length - ring,
    vol: 0.15,
  });
};

/** A bouncing triangle that lets go before the next note. */
const bass: Play = (path, length, note) => {
  tone(path, length, "triangle", note, { attack: 0.006, release: 0.5, shape: "q", vol: 0.9 });
};

/** A plucked chord tone that rings for about a sixteenth, each higher tone a little later, like a strum. */
function stab(part: number): Play {
  const delay = part * n(0.012);
  return (path, length, note) => {
    const ring = Math.min(length - delay, n(0.16));
    tone(path, ring, "square", note, {
      attack: 0.008,
      duty: 30,
      low: 1500,
      release: 0.8,
      start: delay,
      tail: length - ring - delay,
      vol: 0.5,
    });
  };
}

const drum: Play = (path, length, kind) => {
  if (kind === "kick") {
    const ring = n(0.11);
    tone(path, ring, "triangle", [130, 45], {
      attack: 0.002,
      release: 0.9,
      tail: length - ring,
      vol: 0.4,
    });
  } else {
    const ring = n(0.09);
    tone(path, ring, "triangle", kind === "hi" ? [420, 330] : [300, 230], {
      attack: 0.002,
      release: 0.9,
      tail: length - ring,
      vol: 0.35,
    });
  }
};

const shake: Play = (path, length, accent) => {
  const ring = n(0.06);
  tone(path, ring, "pinknoise", null, {
    attack: 0.015,
    high: 2200,
    low: 4200,
    release: 0.7,
    shape: "h",
    tail: length - ring,
    vol: accent === "loud" ? 1 : 0.5,
  });
};

export function music(tmp: string, out: string): void {
  mix(
    [
      [voice(tmp, "pan", parse(LEAD), leadBody, STEP), 0.6],
      [voice(tmp, "pan-octave", parse(LEAD), leadOctave, STEP), 0.8],
      [voice(tmp, "pan-ping", parse(LEAD), leadPing, STEP), 0.5],
      [voice(tmp, "bass", parse(BASS), bass, STEP), 0.6],
      ...[0, 1, 2].map(
        (part) => [voice(tmp, `chord${part}`, chordScore(part), stab(part), STEP), 0.3] as const,
      ),
      [voice(tmp, "drums", drumScore(), drum, STEP), 0.5],
      [voice(tmp, "shaker", shakerScore(), shake, STEP), 0.7],
    ],
    out,
  );
}
