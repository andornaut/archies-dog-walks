import { fontMetrics } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { END_LAYOUT } from "../../home/endLayout.ts";
import { endScreenView, QUIP_TAIL_KEY } from "../../home/endScreenView.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { artPixel, domScale, frameRect } from "../../ui/domScale.ts";
import { showEndScreen } from "./endScreen.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const ART = { [QUIP_TAIL_KEY]: { height: 8, width: 10 } } as Record<
  string,
  { height: number; width: number }
>;
const MEASURE = {
  art: (key: string) => ART[key],
  body: fontMetrics(fonts.body),
  bodyWidth: () => 40,
  fitQuip: (_style: unknown, text: string) => ({ lines: [text], scale: 2 }),
  hasTag: () => false,
  inkWidth: () => 40,
  span: () => ({ left: 0, right: 40, width: 41 }),
  title: fontMetrics(fonts.title),
  wrapBody: (_width: number, text: string) => [text],
  wrapNote: (_width: number, text: string) => [text],
};
const VIEW = endScreenView(gameData, MEASURE, {
  closing: [{ dog: "archie", fired: false, text: "Look at him go! Lovely." }],
  earned: [],
  lines: [],
  stripNames: () => [],
  walk: {
    dogs: ["archie"],
    earnedCents: 900,
    firings: [],
    outcome: "wentHome",
    route: [],
    zonesFinished: 1,
  } as never,
});

function endScreen(width: number) {
  const doc = new FakeDocument();
  const scale = domScale(3, { height: (width * 560) / 360, width, x: 0, y: 0 });
  const { element, layer } = fakeLayer(doc, scale);
  const shown = showEndScreen(layer, {
    artUrl: (path) => path,
    closeLabel: gameData.menuText.common.close,
    display: fonts.title,
    fonts,
    loadSheet: () => Promise.resolve({}),
    pillColours: () => undefined,
    toGame: (point) => point,
    view: VIEW,
  });
  const nodes = element.children[0]?.all() ?? [];
  return { nodes, scale, shown };
}

describe("the HTML End screen", () => {
  it("takes no presses and shows Back to title pressed or bobbing whole art pixels as told", () => {
    const { nodes, scale, shown } = endScreen(393);
    expect(nodes.some((node) => node.tagName === "button")).toBe(false);
    const button = nodes.find((node) => node.className === "adw-button adw-go");
    shown.setButton(false, -1);
    expect(button?.style.transform).toBe(`translateY(${-artPixel(scale)}px)`);
    shown.setButton(true, 0);
    expect(button?.attributes.has("data-pressed")).toBe(true);
    expect(button?.style.transform).toBe("");
  });

  it.each([360, 393])(
    "hangs each tail flipped off its bubble's snapped right edge at %ipx",
    (width) => {
      const { nodes, scale } = endScreen(width);
      const tail = nodes.find((node) => node.style.backgroundImage?.includes(QUIP_TAIL_KEY));
      const bubble = VIEW.results.bubbles[0];
      expect(tail?.style.transform).toBe("scaleX(-1)");
      if (bubble === undefined) {
        throw new Error("no bubble");
      }
      const frame = frameRect(scale, { ...bubble, y: bubble.y + VIEW.offsetY });
      const inFromRight = frame.left + frame.width - Number.parseFloat(tail?.style.left ?? "");
      expect(inFromRight).toBe(
        (bubble.x + bubble.width - END_LAYOUT.quips.tail.x) * artPixel(scale),
      );
    },
  );
});
