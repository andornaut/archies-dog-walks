import { readFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { helpPicture } from "../../help/helpPictures.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { domScale } from "../../ui/domScale.ts";
import { showChoiceCards } from "./choiceCards.ts";

it.each(["cards", "zones"] as const)(
  "mounts %s with original metadata, native controls and a reversible held view",
  async (kind) => {
    const view = helpPicture(gameData, kind).card!;
    const doc = new FakeDocument();
    const { element, layer } = fakeLayer(doc, domScale(1, SCREEN_LAYOUT.screen));
    const choose = vi.fn();
    const requests = new Map<string, Promise<unknown>>();
    const shown = showChoiceCards(layer, {
      artUrl: (path) => path,
      choose,
      closeLabel: gameData.menuText.common.close,
      data: gameData,
      entries: [
        ...view.options.map((option) => ({
          choice: option.index,
          enabled: option.availability.enabled,
          option,
        })),
        ...(view.skip ? [{ choice: "skip" as const, enabled: true }] : []),
      ],
      everyFrame: () => () => {},
      fonts: {
        body: gameFont("font-body"),
        display: gameFont("font-display"),
        title: gameFont("font-title"),
      },
      headHome: kind === "zones" ? vi.fn() : null,
      imageSize: (key) => {
        const png = readFileSync(new URL(`../../../public/art/images/${key}.png`, import.meta.url));
        return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
      },
      keyed: true,
      loadSheet: (path) => {
        let request = requests.get(path);
        if (request === undefined) {
          request = Promise.resolve(ownArtFrames(path));
          requests.set(path, request);
        }
        return request;
      },
      now: () => 0,
      pillColours: () => undefined,
      reduced: true,
      subtitle: gameData.runText.card.pickOne,
      toGame: (point) => point,
      view,
    });
    await Promise.all(requests.values());
    const groups = element.all().filter((node) => node.className === "adw-choice-group");
    expect(groups.length).toBe(view.options.length + (view.skip ? 1 : 0));
    expect(layer.input.accepts()).toBe(false);
    const enabled = groups.findIndex(
      (group) => group.children.at(-1)?.getAttribute("aria-disabled") === "false",
    );
    const pressed = groups[enabled]!;
    expect(pressed.children.some((part) => part.classList.contains("adw-choice-press-band"))).toBe(
      true,
    );
    shown.setPressed(enabled);
    expect(groups.filter((group) => group.classList.contains("adw-choice-pressed"))).toEqual([
      pressed,
    ]);
    shown.setPressed(undefined);
    expect(groups.some((group) => group.classList.contains("adw-choice-pressed"))).toBe(false);
    shown.setLarge(0);
    expect(groups.every((group) => group.hidden)).toBe(true);
    shown.setLarge(undefined);
    expect(groups.every((group) => !group.hidden)).toBe(true);
    const first = groups[0]!.children.at(-1)!;
    expect(first.tagName).toBe("button");
    first.fire("click", { detail: 0 });
    expect(choose).toHaveBeenCalledExactlyOnceWith(0);
    expect([...requests.keys()].some((path) => path.includes("-grey.json"))).toBe(false);
    shown.destroy();
    expect(layer.input.accepts()).toBe(true);
  },
);
