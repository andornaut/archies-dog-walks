import * as sounds from "../sounds.ts";
import { CHEESE, GREEN_BIN_SPILL } from "./drawings.ts";

// ---------- sounds ----------

// Each is a list of sounds.ts's tone() calls, [wave, seconds, freq, start seconds, options], as
// sounds.ts's EFFECTS.
const EFFECTS: sounds.Effects = {
  // a soft wooden thunk, a squish, then the cheese's rising plop and a sag as it settles
  [`sfx-hit-${CHEESE}`]: [
    ["triangle", 0.14, [320, 130], 0, { attack: 0.003, release: 0.85, vol: 0.3 }],
    [
      "square",
      0.12,
      [320, 150],
      0,
      { attack: 0.003, low: 1000, release: 0.8, shape: "h", vol: 0.6 },
    ],
    ["pinknoise", 0.05, null, 0, { attack: 0.002, high: 250, low: 1200, release: 0.9, vol: 0.2 }],
    ["pinknoise", 0.12, null, 0.14, { attack: 0.02, high: 250, low: 1400, release: 0.7, vol: 0.4 }],
    ["triangle", 0.08, [260, 700], 0.16, { attack: 0.004, release: 0.6, shape: "h", vol: 0.9 }],
    ["triangle", 0.15, [420, 200], 0.25, { attack: 0.01, release: 0.8, shape: "h" }],
    [
      "square",
      0.15,
      [420, 200],
      0.25,
      { attack: 0.01, low: 1000, release: 0.8, shape: "h", vol: 0.6 },
    ],
  ],
  // the flash whining up, the shutter's two clicks, then two bells
  "sfx-hit-wedding-photo-shoot": [
    [
      "square",
      0.12,
      [1500, 3200],
      0,
      { attack: 0.02, duty: 25, fx: sounds.DARK, low: 3500, release: 0.3, vol: 0.15 },
    ],
    [
      "pinknoise",
      0.02,
      null,
      0.12,
      { attack: 0.001, fx: ["lowpass", "4500"], high: 2000, low: 5000, release: 0.6, vol: 0.5 },
    ],
    [
      "pinknoise",
      0.025,
      null,
      0.16,
      { attack: 0.001, fx: ["lowpass", "4500"], high: 1800, low: 4500, release: 0.6, vol: 0.45 },
    ],
    ["triangle", 0.2, "E6", 0.2, { release: 0.85, vol: 0.9 }],
    ["square", 0.2, "E5", 0.2, { duty: 25, low: 2500, release: 0.85, vol: 0.15 }],
    ["triangle", 0.28, "C6", 0.3, { release: 0.9, vol: 0.9 }],
    ["square", 0.28, "C5", 0.3, { duty: 25, low: 2500, release: 0.9, vol: 0.15 }],
  ],
  // the bin's hollow plastic thunk, its lid clattering down in three shrinking knocks, then a soft
  // squelch and a gloop as the scraps settle
  [`sfx-hit-${GREEN_BIN_SPILL}`]: [
    [
      "square",
      0.12,
      [340, 160],
      0,
      { attack: 0.003, low: 1000, release: 0.8, shape: "h", vol: 0.6 },
    ],
    ["triangle", 0.12, [340, 140], 0, { attack: 0.003, release: 0.85, vol: 0.35 }],
    [
      "pinknoise",
      0.04,
      null,
      0,
      { attack: 0.001, fx: ["lowpass", "3000"], high: 600, low: 2500, release: 0.8, vol: 0.25 },
    ],
    [
      "square",
      0.035,
      [720, 560],
      0.07,
      { attack: 0.002, duty: 35, fx: ["lowpass", "3000"], low: 1600, release: 0.7, vol: 0.5 },
    ],
    [
      "square",
      0.03,
      [680, 540],
      0.12,
      { attack: 0.002, duty: 35, fx: ["lowpass", "3000"], low: 1600, release: 0.7, vol: 0.38 },
    ],
    [
      "square",
      0.025,
      [650, 520],
      0.16,
      { attack: 0.002, duty: 35, fx: ["lowpass", "3000"], low: 1600, release: 0.7, vol: 0.26 },
    ],
    [
      "pinknoise",
      0.1,
      null,
      0.23,
      { attack: 0.012, high: 300, low: 1400, release: 0.75, vol: 0.5 },
    ],
    ["triangle", 0.1, [520, 210], 0.23, { attack: 0.01, release: 0.8, shape: "h", vol: 0.8 }],
    ["triangle", 0.09, [260, 560], 0.35, { attack: 0.006, release: 0.7, shape: "h", vol: 0.6 }],
  ],
};

// Write each sound into outDir as .ogg and .m4a, as sounds.ts renders its own.
function renderSounds(outDir: string): void {
  console.log("built", sounds.renderEffects(outDir, EFFECTS).join(", "));
}

export { renderSounds };
