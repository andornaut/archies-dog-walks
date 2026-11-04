/**
 * Kensington Market's walk music: a Pedestrian Sunday hand-drum groove at about 112 BPM in D
 * mixolydian.
 *
 * 16 bars: a phrase over D C G D, its answer over D C G C, a bridge over Am D Am C with the A dorian
 * colour of the same notes, then the phrase again, closing on G C so the loop falls back onto D. A
 * reedy accordion of two detuned squares calls and a triangle marimba answers, bar by bar in the
 * phrases and half bar by half bar in the bridge, and they play the closing riff together. Under
 * them: a bouncy tresillo bass with offbeat octaves, offbeat chord stabs, low conga and high bongo
 * hits with a slap's skin noise, a soft shaker on the eighths and a light kick.
 */

import {
  decimal,
  fixed,
  hz,
  mix,
  n,
  parse,
  PEAK_DB,
  type Play,
  RATE,
  roundTo,
  type Score,
  sox,
  tone,
  voice,
} from "./sounds.ts";

// One sixteenth at about 112 BPM. 5908 is a multiple of 4, so the 256 sixteenths of the loop fill
// whole 1024-sample AAC frames.
const STEP = 5908;
// The compressor's threshold, with the summed layers peaking at PEAK_DB.
const SQUEEZE_DB = -14;
// Samples.
const LOOKAHEAD = 132;

// Notes are "name:sixteenths"; "-" is a rest. One bar per group between bars.
const ACCORDION = `
A5:3 F#5:3 A5:2 C6:2 B5:1 A5:2 F#5:1 -:2 | -:16 | B5:3 G5:3 B5:2 D6:2 C6:1 B5:2 G5:1 -:2 | -:16
A5:3 F#5:3 A5:2 C6:2 B5:1 A5:2 F#5:1 -:2 | -:16 | D6:3 B5:3 D6:2 E6:2 D6:1 B5:2 A5:1 -:2 | -:16
-:8 C6:2 A5:1 F#5:2 E5:1 -:2 | -:8 A5:2 F#5:1 E5:2 D5:1 -:2 | -:8 E6:2 C6:1 A5:2 G5:1 -:2
G5:3 E5:3 G5:2 A5:1 B5:1 C6:2 B5:1 G5:1 -:2
A5:3 F#5:3 A5:2 C6:2 B5:1 A5:2 F#5:1 -:2 | -:16 | B5:3 G5:3 B5:2 D6:2 C6:1 B5:2 G5:1 -:2
B5:2 A5:1 G5:2 A5:1 B5:2 C6:2 B5:1 G5:1 E5:2 G5:2
`;
const MARIMBA = `
-:16 | -:2 G4:1 C5:2 D5:1 E5:2 G5:2 E5:1 D5:1 C5:2 -:2 | -:16 | -:2 A4:1 D5:2 E5:1 F#5:2 A5:2 F#5:1 E5:1 D5:2 -:2
-:16 | -:2 G4:1 C5:2 D5:1 E5:2 G5:2 A5:1 G5:1 E5:2 -:2 | -:16 | -:2 G4:1 C5:2 E5:1 G5:2 E5:2 D5:1 C5:1 B4:2 -:2
A4:1 C5:1 E5:2 F#5:1 E5:2 -:1 -:8 | F#4:1 A4:1 D5:2 E5:1 F#5:2 -:1 -:8 | A4:1 C5:1 E5:2 G5:1 E5:2 -:1 -:8
-:8 E4:1 G4:1 C5:2 D5:2 -:2
-:16 | -:2 G4:1 C5:2 D5:1 E5:2 G5:2 E5:1 D5:1 C5:2 -:2 | -:16
B4:2 A4:1 G4:2 A4:1 B4:2 C5:2 B4:1 G4:1 E4:2 G4:2
`;
// Tresillo roots, offbeat octaves, then the fifth and a step into the next bar's root.
const BASS = `
D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 A2:2
G2:3 G2:2 -:1 G3:2 -:2 G3:2 D3:2 C3:2 | D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 F#3:2
D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 A2:2
G2:3 G2:2 -:1 G3:2 -:2 G3:2 D3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 B2:2
A2:3 A2:2 -:1 A3:2 -:2 G3:2 F#3:2 E3:2 | D3:3 D3:2 -:1 D4:2 -:2 C4:2 A3:2 B2:2
A2:3 A2:2 -:1 A3:2 -:2 G3:2 E3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 E3:2
D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 A2:2
G2:3 G2:2 -:1 G3:2 -:2 G3:2 D3:2 A2:2 | G2:3 G2:2 -:1 G3:2 C3:2 C4:2 G3:2 E3:2
`;
// One chord per half bar, stabbed on its two offbeat eighths.
const CHORDS = "D D C C G G D D D D C C G G C C Am Am D7 D7 Am Am C C D D C C G G G C";
const VOICINGS: Readonly<Record<string, string>> = {
  Am: "E4 A4 C5",
  C: "E4 G4 C5",
  D: "F#4 A4 D5",
  D7: "F#4 A4 C5",
  G: "D4 G4 B4",
};

// Hand drums, one character per sixteenth: L open low conga, H high bongo, S slap. The fourth bar
// of each phrase ends in a bongo run.
const GROOVE = "...HS.L...HLS.LL";
const FILL = "...HS.L.L.HLHHLL";
const KICK = "k.......k.......";
// Eighths, accented on the offbeats.
const SHAKER = "m.a.m.a.m.a.m.a.";

// Kind: [from Hz, to Hz, seconds, volume].
const CONGA: Readonly<Record<string, readonly [number, number, number, number]>> = {
  H: [680, 587, 0.12, 0.6],
  L: [262, 220, 0.2, 0.9],
  S: [700, 587, 0.06, 0.7],
};
const SKIN: Readonly<Record<string, readonly [number, number]>> = {
  H: [0.01, 0.2],
  L: [0.012, 0.2],
  S: [0.035, 0.7],
};
const SHAKE: Readonly<Record<string, number>> = { a: 0.5, m: 0.3 };

/** A drum pattern as [kind, sixteenths]: each hit lasts until the next. */
function hits(bars: readonly string[]): Score {
  const score: [string, number][] = [];
  for (const c of bars.join("")) {
    const last = score.at(-1);
    if (c !== "." || !last) {
      score.push([c === "." ? "-" : c, 1]);
    } else {
      last[1] += 1;
    }
  }
  return score;
}

/** Sound play(path, samples, note, tail) for at most seconds, then silence to fill the slot. */
function capped(
  seconds: number,
  play: (path: string, length: number, note: string, tail: number) => void,
): Play {
  return (path, length, note) => {
    const sound = Math.min(length, n(seconds));
    play(path, sound, note, length - sound);
  };
}

/** The ith note of each chord's voicing, on the offbeat eighths of its half bar. */
function compScore(i: number): Score {
  return CHORDS.split(" ").flatMap((chord) => {
    const note = (VOICINGS[chord] ?? "").split(" ")[i] ?? "";
    return [["-", 2] as const, [note, 2] as const, ["-", 2] as const, [note, 2] as const];
  });
}

/**
 * One accordion reed, cents sharp. A sharp reed starts half a cycle late, so the pair begins out of
 * phase instead of doubling the onset's peak.
 */
function reed(cents: number): Play {
  return (path, length, note) => {
    const freq = hz(note) * 2 ** (cents / 1200);
    const late = cents ? roundTo(0, RATE / freq / 2) : 0;
    tone(path, length - late, "square", freq, {
      attack: 0.02,
      duty: 35,
      low: 2200,
      release: 0.3,
      shape: "h",
      start: late,
      vol: 0.5,
    });
  };
}

/**
 * Compress 4:1 above SQUEEZE_DB with a short look-ahead, holding down the onsets where the voices
 * coincide, then normalize the peak to PEAK_DB. It runs over three copies of the loop and keeps the
 * middle one, so the compressor's state at the end flows into the start.
 */
function squeeze(path: string, out: string): void {
  const length = 16 * 16 * STEP;
  sox(
    path,
    path,
    path,
    out,
    "compand",
    "0.001,0.08",
    `6:-70,-70,${SQUEEZE_DB},${SQUEEZE_DB},0,${decimal((SQUEEZE_DB * 3) / 4)}`,
    "0",
    "0",
    fixed(6, LOOKAHEAD / RATE),
    "trim",
    `${length}s`,
    `${length}s`,
    "gain",
    "-n",
    String(PEAK_DB),
  );
}

export function music(tmp: string, out: string): void {
  const v = (name: string, score: Score, play: Play): string => voice(tmp, name, score, play, STEP);

  const phrase = [GROOVE, GROOVE, GROOVE, FILL];
  const drums = hits(Array.from({ length: 4 }, () => phrase).flat());

  const reeds = [0, 6].map((cents, i) => v(`km-reed${i}`, parse(ACCORDION), reed(cents)));
  const marimba = v(
    "km-marimba",
    parse(MARIMBA),
    capped(0.32, (p, s, note, tail) => {
      tone(p, s, "triangle", note, { attack: 0.002, release: 0.97, shape: "q", tail });
    }),
  );
  const mallet = v(
    "km-mallet",
    parse(MARIMBA),
    capped(0.05, (p, s, note, tail) => {
      tone(p, s, "triangle", hz(note) * 4, {
        attack: 0.001,
        low: 3500,
        release: 0.95,
        tail,
        vol: 0.25,
      });
    }),
  );
  const bass = v(
    "km-bass",
    parse(BASS),
    capped(0.36, (p, s, note, tail) => {
      tone(p, s, "triangle", note, { attack: 0.004, release: 0.5, tail });
    }),
  );
  // A quiet filtered square on the bass line, so it still carries on a phone speaker.
  const growl = v(
    "km-growl",
    parse(BASS),
    capped(0.2, (p, s, note, tail) => {
      tone(p, s, "square", note, {
        attack: 0.004,
        duty: 25,
        low: 500,
        release: 0.7,
        tail,
        vol: 0.5,
      });
    }),
  );
  const comp = [0, 1, 2].map((i) =>
    v(`km-comp${i}`, compScore(i), (p, length, note) => {
      tone(p, length, "square", note, { attack: 0.01, low: 1200, release: 0.5, shape: "h" });
    }),
  );
  const congas = v("km-conga", drums, (p, length, kind) => {
    const [from, to, seconds, vol] = CONGA[kind] ?? [0, 0, 0, 0];
    tone(p, Math.min(length, n(seconds)), "triangle", [from, to], {
      attack: 0.002,
      release: 0.9,
      tail: length - Math.min(length, n(seconds)),
      vol,
    });
  });
  const skin = v("km-skin", drums, (p, length, kind) => {
    const [seconds, vol] = SKIN[kind] ?? [0, 0];
    tone(p, n(seconds), "pinknoise", null, {
      attack: 0.001,
      high: 900,
      low: 3500,
      release: 0.8,
      tail: length - n(seconds),
      vol,
    });
  });
  const kick = v("km-kick", hits(Array.from({ length: 16 }, () => KICK)), (p, length) => {
    tone(p, n(0.12), "triangle", [150, 45], {
      attack: 0.002,
      release: 0.9,
      tail: length - n(0.12),
    });
  });
  const shaker = v(
    "km-shaker",
    hits(Array.from({ length: 16 }, () => SHAKER)),
    (p, length, kind) => {
      tone(p, n(0.05), "pinknoise", null, {
        attack: 0.015,
        high: 2000,
        low: 4500,
        release: 0.6,
        shape: "h",
        tail: length - n(0.05),
        vol: SHAKE[kind] ?? 0,
      });
    },
  );
  const summed = `${tmp}/km-mix.wav`;
  mix(
    [
      [reeds[0] ?? "", 0.96],
      [reeds[1] ?? "", 0.4],
      [marimba, 0.48],
      [mallet, 0.48],
      [bass, 0.36],
      [growl, 0.24],
      ...comp.map((c) => [c, 0.1] as const),
      [congas, 0.24],
      [skin, 0.48],
      [kick, 0.2],
      [shaker, 0.64],
    ],
    summed,
  );
  squeeze(summed, out);
}
