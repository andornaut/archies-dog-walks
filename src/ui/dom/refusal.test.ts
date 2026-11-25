import { expect, it } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { refusalRed, REFUSE } from "../refuse.ts";
import { REFUSAL_RED, refuse } from "./refusal.ts";

const { flashMs, flashes } = REFUSE;
const total = flashMs * flashes;

// A moment of a refusal: the cue class the control holds then, and whether its face is red then,
// as a scene-clocked control's is (refusalRed).
it.each([
  { at: 0, red: false, reducedMotion: false, refusing: "adw-refusing" },
  { at: flashMs - 1, red: false, reducedMotion: false, refusing: "adw-refusing" },
  { at: flashMs, red: true, reducedMotion: false, refusing: "adw-refusing" },
  { at: 2 * flashMs, red: false, reducedMotion: false, refusing: "adw-refusing" },
  { at: 3 * flashMs, red: true, reducedMotion: false, refusing: "adw-refusing" },
  { at: total, red: false, reducedMotion: false, refusing: undefined },
  { at: 0, red: true, reducedMotion: true, refusing: "adw-refusing-still" },
  { at: total - 1, red: true, reducedMotion: true, refusing: "adw-refusing-still" },
  { at: total, red: false, reducedMotion: true, refusing: undefined },
])(
  "refuses $at ms in, reduced motion $reducedMotion: $refusing, red $red",
  ({ at, red, reducedMotion, refusing }) => {
    const doc = new FakeDocument();
    const timers: { callback: () => void; delay: number }[] = [];
    doc.defaultView.setTimeout = (callback: () => void, delay = 0) => {
      timers.push({ callback, delay });
      return 0;
    };
    const element = doc.createElement("button") as unknown as HTMLElement;
    const label = doc.createElement("span") as unknown as HTMLElement;
    refuse(reducedMotion, element, [label]);
    // A refusal under way plays on, whatever the second one asks.
    refuse(!reducedMotion, element, [label]);
    expect(timers.map(({ delay }) => delay)).toEqual(
      Array.from({ length: flashes }, (_, i) => (i + 1) * flashMs),
    );
    timers.filter(({ delay }) => delay <= at).forEach(({ callback }) => callback());
    const held = ["adw-refusing", "adw-refusing-still"].filter((name) =>
      label.classList.contains(name),
    );
    expect(held).toEqual(refusing === undefined ? [] : [refusing]);
    expect(element.hasAttribute(REFUSAL_RED)).toBe(red);
    expect(refusalRed(reducedMotion, at)).toBe(red);
  },
);
