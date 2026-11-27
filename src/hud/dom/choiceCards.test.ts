import { readFileSync } from "node:fs";

import { afterEach, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { helpPicture } from "../../help/helpPictures.ts";
import { SCREEN_LAYOUT } from "../../layout/screen.ts";
import { cardRowIn } from "../../presentation/cardLayout.ts";
import { cardFor, MAX_CARD_OPTIONS } from "../../rules/cardViews.ts";
import { read } from "../../rules/units.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import type { NativeGesture } from "../../ui/dom/modalLifecycle.ts";
import { REFUSAL_RED } from "../../ui/dom/refusal.ts";
import { domScale } from "../../ui/domScale.ts";
import { REFUSE } from "../../ui/refuse.ts";
import { showChoiceCards } from "./choiceCards.ts";

afterEach(() => vi.useRealTimers());

async function mount(
  kind: "cards" | "zones",
  {
    gesture,
    hallPass = false,
    picture = false,
    refused = 1,
  }: { gesture?: NativeGesture; hallPass?: boolean; picture?: boolean; refused?: number } = {},
) {
  vi.useFakeTimers();
  const help = helpPicture(gameData, kind);
  const source = help.card!.source;
  const original =
    hallPass && source.kind === "encounter"
      ? cardFor(
          gameData,
          { ...help.walk.run, skipPass: { gear: "hallPass", kind: "gear" } },
          source,
        )
      : help.card!;
  // The first refused options are ones the walk cannot afford.
  const view = {
    ...original,
    options: original.options.map((option, index) =>
      index < refused
        ? {
            ...option,
            availability: { enabled: false as const, reason: "not enough money" as const },
          }
        : option,
    ),
  };
  const doc = new FakeDocument();
  Object.assign(doc.defaultView, {
    clearTimeout: globalThis.clearTimeout,
    performance: { now: () => Date.now() },
    setTimeout: globalThis.setTimeout,
  });
  const { element, layer } = fakeLayer(doc, domScale(1, SCREEN_LAYOUT.screen));
  const choose = vi.fn();
  const accepts = vi.fn(() => true);
  const requests = new Map<string, Promise<unknown>>();
  const shown = showChoiceCards(layer, {
    accepts,
    artUrl: (path) => path,
    choose,
    closeLabel: gameData.menuText.common,
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
    ...(gesture === undefined ? {} : { gesture }),
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
    picture,
    pillColours: () => undefined,
    reduced: true,
    reducedMotion: () => true,
    subtitle: gameData.runText.card.pickOne,
    toGame: (point) => point,
    view,
  });
  await vi.runAllTimersAsync();
  const groups = element.all().filter((node) => node.className === "adw-choice-group");
  const options = groups.map((group) => group.children.at(-1)!);
  const dialog = element.all().find((node) => node.getAttribute("role") === "dialog")!;
  return { accepts, choose, dialog, doc, element, groups, layer, options, requests, shown, view };
}

it.each(["cards", "zones"] as const)(
  "mounts %s with original metadata, Kit options and a reversible held view",
  async (kind) => {
    const { choose, element, groups, layer, options, requests, shown, view } = await mount(kind);
    expect(groups.length).toBe(view.options.length + (view.skip ? 1 : 0));
    expect(options.every((option) => option.tagName === "button")).toBe(true);
    expect(options.map((option) => option.getAttribute("aria-disabled"))).toEqual(
      options.map((_, index) => (index === 0 ? "true" : null)),
    );
    expect(layer.input.accepts()).toBe(false);
    const pressed = groups[1]!;
    expect(
      pressed.children.some((part) => part.classList.contains("adw-choice-refusal-band")),
    ).toBe(true);
    shown.setPressed(1);
    expect(groups.filter((group) => group.classList.contains("adw-choice-pressed"))).toEqual([
      pressed,
    ]);
    shown.setPressed(undefined);
    expect(groups.some((group) => group.classList.contains("adw-choice-pressed"))).toBe(false);
    shown.setLarge(0);
    expect(groups.every((group) => group.hidden)).toBe(true);
    const held = element
      .all()
      .find(
        (node) => node.classList.contains("adw-choice-held-outline") && !node.parentElement?.hidden,
      )!;
    const x = Number.parseFloat(held.style.getPropertyValue("left"));
    const y = Number.parseFloat(held.style.getPropertyValue("top"));
    const width = Number.parseFloat(held.style.getPropertyValue("width"));
    const height = Number.parseFloat(held.style.getPropertyValue("height"));
    expect(held.getAttribute("aria-hidden")).toBe("true");
    expect(x - 2).toBeGreaterThanOrEqual(0);
    expect(y - 2).toBeGreaterThanOrEqual(0);
    expect(x + width + 2).toBeLessThanOrEqual(SCREEN_LAYOUT.screen.width);
    expect(y + height + 2).toBeLessThanOrEqual(SCREEN_LAYOUT.screen.height);
    shown.setLarge(undefined);
    expect(groups.every((group) => !group.hidden)).toBe(true);
    options[1]!.fire("click", { detail: 0 });
    expect(choose).toHaveBeenCalledExactlyOnceWith(1);
    expect([...requests.keys()].some((path) => path.includes("-grey.json"))).toBe(false);
    shown.destroy();
    expect(layer.input.accepts()).toBe(true);
  },
);

it("starts on the first displayed option, cycles focus, and leaves confirmation to its button", async () => {
  const { accepts, choose, dialog, doc, options, shown, view } = await mount("cards", {
    hallPass: true,
  });
  expect(view.skip).toBe(true);
  for (const option of options) {
    const matches = option.matches.bind(option);
    vi.spyOn(option, "matches").mockImplementation((selector) =>
      selector === ":focus-visible" ? doc.activeElement === option : matches(selector),
    );
  }
  const key = (code: string, repeat = false, target = doc.activeElement) => {
    const event = {
      code,
      preventDefault: vi.fn(),
      repeat,
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
      target,
    };
    const owner = code === "Escape" ? doc : dialog;
    owner.fire("keydown", event);
    return event;
  };
  expect(doc.activeElement).toBe(dialog);
  accepts.mockReturnValue(false);
  key("ArrowLeft");
  expect(doc.activeElement).toBe(dialog);
  accepts.mockReturnValue(true);
  const editing = doc.createElement("input");
  key("ArrowLeft", false, editing);
  expect(doc.activeElement).toBe(dialog);

  expect(key("ArrowLeft").stopPropagation).toHaveBeenCalledOnce();
  expect(doc.activeElement).toBe(options[0]);
  key("ArrowUp", true);
  const skip = options.at(-1)!;
  expect(doc.activeElement).toBe(skip);
  expect(skip.getAttribute("aria-label")).toContain(gameData.runText.card.skip);
  for (const repeat of [false, true]) {
    const escape = key("Escape", repeat);
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(escape.stopImmediatePropagation).toHaveBeenCalledOnce();
  }
  expect(doc.activeElement).toBe(skip);
  expect(choose).not.toHaveBeenCalled();
  key("KeyJ");
  expect(doc.activeElement).toBe(options[0]);
  key("KeyL");
  expect(doc.activeElement).toBe(options[1]);
  shown.setLarge(1);
  key("ArrowRight");
  expect(doc.activeElement).toBe(options[1]);
  shown.setLarge(undefined);
  expect(choose).not.toHaveBeenCalled();
  const focused = options[1]!;
  Object.assign(focused, { click: () => focused.fire("click", { detail: 0 }) });
  focused.fire("keydown", { code: "KeyE", repeat: true, target: focused });
  expect(choose).not.toHaveBeenCalled();
  focused.fire("keydown", { code: "KeyF", repeat: false, target: focused });
  expect(choose).toHaveBeenCalledExactlyOnceWith(view.options[1]!.index);
  shown.destroy();
});

it("keeps help pictures inert when a directional key is sent to their dialog", async () => {
  const { choose, dialog, doc, element, options, shown } = await mount("zones", { picture: true });
  expect(options.every((option) => option.tagName === "span")).toBe(true);
  const active = doc.activeElement;
  dialog.fire("keydown", { code: "ArrowLeft", target: dialog });
  expect(doc.activeElement).toBe(active);
  expect(choose).not.toHaveBeenCalled();
  expect(element.all().some((node) => node.classList.contains("adw-choice-held-outline"))).toBe(
    false,
  );
  shown.destroy();
});

it("fits two outer pixels around each choice at every supported card count", () => {
  for (let count = 1; count <= MAX_CARD_OPTIONS; count += 1) {
    const rects = cardRowIn(SCREEN_LAYOUT.walkView, MAX_CARD_OPTIONS, count);
    for (const [index, rect] of rects.entries()) {
      expect(rect.x - 2).toBeGreaterThanOrEqual(0);
      expect(rect.y - 2).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width + 2).toBeLessThanOrEqual(SCREEN_LAYOUT.screen.width);
      expect(rect.y + rect.height + 2).toBeLessThanOrEqual(SCREEN_LAYOUT.screen.height);
      if (index > 0) {
        const previous = rects[index - 1]!;
        expect(previous.x + previous.width + 2).toBeLessThan(rect.x - 2);
      }
    }
  }
});

it("keeps a refused option focusable and silent, and refuses its keys one card at a time", async () => {
  const { accepts, choose, groups, options, shown } = await mount("cards", { refused: 2 });
  const refused = options[0] as FakeElement;
  expect(options[1]!.getAttribute("aria-disabled")).toBe("true");
  expect(refused.tabIndex).toBe(0);
  expect(refused.getAttribute("aria-description")).toBeNull();
  refused.removeAttribute("aria-disabled");
  accepts.mockReturnValueOnce(false);
  refused.fire("click", { detail: 0 });
  expect(refused.getAttribute("aria-disabled")).toBe("true");
  expect(groups[0]!.hasAttribute(REFUSAL_RED)).toBe(false);
  refused.fire("click", { detail: 0 });
  expect(choose).not.toHaveBeenCalled();
  expect(groups[0]!.hasAttribute(REFUSAL_RED)).toBe(true);
  expect(groups[0]!.classList.contains("adw-refusing-still")).toBe(true);
  options[1]!.fire("click", { detail: 0 });
  shown.refuse(1);
  expect(groups[1]!.hasAttribute(REFUSAL_RED)).toBe(false);
  vi.advanceTimersByTime(REFUSE.flashMs * REFUSE.flashes);
  expect(groups[0]!.hasAttribute(REFUSAL_RED)).toBe(false);
  expect(groups[0]!.classList.contains("adw-refusing-still")).toBe(false);
  shown.refuse(0);
  expect(groups[0]!.hasAttribute(REFUSAL_RED)).toBe(true);
  shown.destroy();
});

it("gives secondary activation only to an available option without a primary contact", async () => {
  const gesture = { down: vi.fn(), up: vi.fn(() => true) };
  const { choose, dialog, doc, options, shown } = await mount("cards", { gesture });
  const refused = options[0]!;
  const available = options[1]!;
  for (const option of [refused, available]) {
    Object.assign(option, { click: () => option.fire("click", { detail: 0 }) });
  }
  const secondaryOn = (target: FakeElement) => {
    const event = {
      button: 2,
      isPrimary: true,
      pointerId: 7,
      preventDefault: vi.fn(),
      target,
    };
    dialog.fire("pointerdown", { ...event, type: "pointerdown" });
    doc.fire("pointerup", { ...event, type: "pointerup" });
    target.fire("contextmenu", { ...event, type: "contextmenu" });
    return event;
  };
  expect(secondaryOn(dialog).preventDefault).not.toHaveBeenCalled();
  expect(secondaryOn(refused).preventDefault).not.toHaveBeenCalled();
  expect(choose).not.toHaveBeenCalled();
  expect(secondaryOn(available).preventDefault).toHaveBeenCalledOnce();
  expect(choose).toHaveBeenCalledExactlyOnceWith(1);
  expect(gesture.down).not.toHaveBeenCalled();
  expect(gesture.up).not.toHaveBeenCalled();
  shown.destroy();
});

it.each([false, true])(
  "gives the scene every pointer press that starts on an option (scene handled: %s)",
  async (handled) => {
    const { choose, dialog, doc, options, shown } = await mount("cards", {
      gesture: { up: () => handled },
    });
    const pointer = (type: string) => ({
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
      clientX: 10,
      clientY: 10,
      detail: 1,
      isPrimary: true,
      pointerId: 7,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
      target: options[1],
      timeStamp: Date.now(),
      type,
    });
    // The shared hold handling claims no hold on the option.
    dialog.fire("pointerdown", pointer("pointerdown"));
    vi.advanceTimersByTime(read(gameData.tuning, "seconds", "holdSeconds") * 1000);
    expect(choose).not.toHaveBeenCalled();
    // Its click reaches no option action, whether or not the scene took the press.
    doc.fire("pointerup", pointer("pointerup"));
    const click = pointer("click");
    dialog.fire("click", click);
    expect(click.stopImmediatePropagation).toHaveBeenCalled();
    shown.destroy();
  },
);
