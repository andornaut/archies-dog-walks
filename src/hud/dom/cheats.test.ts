import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { NEXT_WALK_OFF } from "../../dev/cheats.ts";
import { cheatsView } from "../../dev/cheatsView.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { showCheats } from "./cheats.ts";

it("keeps Cheats actions guarded and disposable while the seed remains an editable control", async () => {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const view = cheatsView(
    {
      body: fontFileMetrics("font-body"),
      inkWidth: (_font, line) => line.length * 12,
      title: fontFileMetrics("font-title"),
      titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
      wrapNote: (_width, text) => [text],
    },
    { data: gameData, screen: SCREEN_CONFIG, words: gameData.menuText },
    {
      fpsCounter: false,
      linkCopied: false,
      next: NEXT_WALK_OFF,
      walk: undefined,
    },
  );
  const act = vi.fn();
  const seed = vi.fn();
  const shown = showCheats(layer, {
    act,
    artUrl: (path) => path,
    close: vi.fn(),
    closeLabel: gameData.menuText.common.close,
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: async (path) => ownArtFrames(path),
    reducedMotion: () => true,
    seed,
    toGame: (point) => point,
    view,
  });
  await vi.waitFor(() => expect(shown.accepts()).toBe(true));
  const action = view.rows
    .flatMap((row) => row.buttons)
    .find((button) => button.available !== false)!;
  const button = element.all().find((node) => node.getAttribute("aria-label") === action.label)!;
  expect(button.classList.contains("adw-standard-button")).toBe(true);
  shown.setInert(true);
  button.fire("click");
  expect(act).not.toHaveBeenCalled();
  shown.setInert(false);
  button.fire("click");
  expect(act).toHaveBeenCalledExactlyOnceWith(action.action);
  const unavailable = view.rows
    .flatMap((row) => row.buttons)
    .find((button) => button.available === false)!;
  const refused = element
    .all()
    .find((node) => node.getAttribute("aria-label") === unavailable.label)!;
  refused.fire("click");
  expect(act).toHaveBeenCalledTimes(1);
  expect(refused.getAttribute("aria-disabled")).toBe("true");
  expect(refused.classList.contains("adw-refusing-still")).toBe(true);
  const field = element.all().find((node) => node.tagName === "input")!;
  Object.assign(field, { value: "314" });
  field.fire("change");
  expect(seed).toHaveBeenCalledExactlyOnceWith("314");
  shown.destroy();
  button.fire("click");
  expect(act).toHaveBeenCalledTimes(1);
});
