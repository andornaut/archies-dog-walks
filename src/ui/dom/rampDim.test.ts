import { describe, expect, it } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { dimColour } from "../dimArt.ts";
import { PALETTE } from "../palette.ts";
import { DIM_ART_ATTRIBUTE, dimCss, followModalUnderlay, setRampDimmed } from "./rampDim.ts";

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

describe("HTML dimmed under the pause menu", () => {
  it.each([
    [hex(PALETTE.yellow), hex(dimColour(PALETTE.yellow))],
    ["rgb(255, 255, 255)", hex(dimColour(0xffffff))],
    ["", ""],
    ["inherit", "inherit"],
  ])("dims the colour %s to %s", (css, dimmed) => {
    expect(dimCss(css)).toBe(dimmed);
  });

  it("dims a subtree's colours and pictures down the ramp, and puts them back", () => {
    const doc = new FakeDocument();
    const root = doc.createElement("div");
    const text = doc.createElement("span");
    text.style.color = hex(PALETTE.forest);
    const pill = doc.createElement("span");
    pill.style.backgroundColor = hex(PALETTE.cream);
    const art = doc.createElement("span");
    art.style.backgroundImage = 'url("/art/images/ui-quip-tail-up.png")';
    art.setAttribute(DIM_ART_ATTRIBUTE, "/art/images/ui-quip-tail-up-dim.png");
    root.append(text, pill, art);
    const element = root as unknown as HTMLElement;
    setRampDimmed(element, true);
    // A second call leaves what is dimmed as it is.
    setRampDimmed(element, true);
    expect([text.style.color, pill.style.backgroundColor, art.style.backgroundImage]).toEqual([
      hex(dimColour(PALETTE.forest)),
      hex(dimColour(PALETTE.cream)),
      'url("/art/images/ui-quip-tail-up-dim.png")',
    ]);
    setRampDimmed(element, false);
    expect([text.style.color, pill.style.backgroundColor, art.style.backgroundImage]).toEqual([
      hex(PALETTE.forest),
      hex(PALETTE.cream),
      'url("/art/images/ui-quip-tail-up.png")',
    ]);
  });
});

it("dims and blocks a registered native underlay once, then restores its own accessibility state", () => {
  const doc = new FakeDocument();
  const root = doc.createElement("div");
  root.style.color = hex(PALETTE.cream);
  root.setAttribute("aria-hidden", "false");
  let covered = false;
  let sync: () => void = () => undefined;
  let stopped = false;
  const stop = followModalUnderlay(
    {
      accepts: () => !covered,
      subscribe: (listener) => {
        sync = listener;
        sync();
        return () => {
          stopped = true;
        };
      },
    },
    root as unknown as HTMLElement,
  );
  covered = true;
  sync();
  expect(root.inert).toBe(true);
  expect(root.getAttribute("aria-hidden")).toBe("true");
  expect(root.style.color).toBe(hex(dimColour(PALETTE.cream)));
  sync();
  expect(root.style.color).toBe(hex(dimColour(PALETTE.cream)));
  covered = false;
  sync();
  expect(root.inert).toBe(false);
  expect(root.getAttribute("aria-hidden")).toBe("false");
  expect(root.style.color).toBe(hex(PALETTE.cream));
  stop();
  expect(stopped).toBe(true);
});
