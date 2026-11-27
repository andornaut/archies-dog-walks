import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { helpPicture } from "../help/helpPictures.ts";
import { type NativeChoiceCards, showChoiceCards } from "../hud/dom/choiceCards.ts";
import { holdRule } from "../input/hold.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { cardRowIn } from "../presentation/cardLayout.ts";
import { MAX_CARD_OPTIONS } from "../rules/choices.ts";
import { read } from "../rules/units.ts";
import { gameFont } from "../testing/fontInk.ts";
import { CardScene } from "./CardScene.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { nativeSceneAccepts } from "./overlay.ts";
import { htmlArtInput, htmlPanelPlace } from "./questionPanel.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scene: class {},
  Scenes: { Events: { PAUSE: "pause", SHUTDOWN: "shutdown" } },
}));
vi.mock("../hud/dom/choiceCards.ts", () => ({ showChoiceCards: vi.fn() }));
vi.mock("../ui/phaser/displayText.ts", () => ({ displayBitmapFont: () => undefined }));
vi.mock("./rampDim.ts", () => ({ addRampDim: vi.fn() }));
vi.mock("./nativeOverlayReady.ts", () => ({ mountNativeOverlay: vi.fn() }));
vi.mock("./overlay.ts", () => ({
  nativeSceneAccepts: vi.fn(),
  onSceneEvent: (_scene: unknown, emitter: EventEmitter, type: string, callback: () => void) =>
    emitter.on(type, callback),
}));
vi.mock("./profileStore.ts", () => ({ currentSettings: () => ({ reducedMotion: false }) }));
vi.mock("./questionPanel.ts", () => ({
  followScene: (_scene: unknown, panel: unknown) => panel,
  htmlArtInput: vi.fn(),
  htmlPanelPlace: vi.fn(),
}));
vi.mock("./screenGuard.ts", () => ({ guardScreenInput: () => ({ drawn: vi.fn() }) }));

beforeEach(() => vi.clearAllMocks());
function fixture(disabled = false) {
  const original = helpPicture(gameData, "cards").card!;
  const view = disabled
    ? {
        ...original,
        options: original.options.map((option, index) =>
          index === 0
            ? {
                ...option,
                availability: { enabled: false as const, reason: "not enough money" as const },
              }
            : option,
        ),
      }
    : original;
  const scene = new CardScene();
  const time = { now: 0 };
  const events = new EventEmitter();
  const keyboard = new EventEmitter();
  const panel = {
    refuse: vi.fn(),
    setLarge: vi.fn(),
    setPressed: vi.fn(),
  } as unknown as NativeChoiceCards;
  Object.assign(scene, { events, game: { events: new EventEmitter() }, input: { keyboard }, time });
  vi.mocked(nativeSceneAccepts).mockReturnValue(true);
  vi.mocked(htmlPanelPlace).mockReturnValue({
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    layer: {},
  } as ReturnType<typeof htmlPanelPlace>);
  vi.mocked(htmlArtInput).mockReturnValue({
    toGame: (point: { x: number; y: number }) => point,
  } as ReturnType<typeof htmlArtInput>);
  vi.mocked(showChoiceCards).mockReturnValue(panel);
  const choose = vi.fn();
  scene.create({ onChoose: choose, onHeadHome: null, view });
  vi.mocked(mountNativeOverlay).mock.calls.at(-1)![1]();
  const input = vi.mocked(showChoiceCards).mock.calls.at(-1)![1];
  const rect = cardRowIn(
    SCREEN_LAYOUT.walkView,
    MAX_CARD_OPTIONS,
    view.options.length + (view.skip ? 1 : 0),
  )[0]!;
  const point = { clientX: rect.x + 1, clientY: rect.y + 1 } as PointerEvent;
  return { choose, events, input, keyboard, panel, point, scene, time, view };
}

it("requires painted admission, rejects repeat keys, and accepts one choice per presentation", () => {
  const { choose, input, keyboard, view } = fixture();
  vi.mocked(nativeSceneAccepts).mockReturnValue(false);
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  expect(choose).not.toHaveBeenCalled();
  expect(input.accepts()).toBe(false);
  vi.mocked(nativeSceneAccepts).mockReturnValue(true);
  keyboard.emit("keydown", { code: "Digit1", repeat: true });
  keyboard.emit("keydown", { code: "Digit1", repeat: false, target: { tagName: "INPUT" } });
  expect(choose).not.toHaveBeenCalled();
  expect(input.accepts()).toBe(true);
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  expect(choose).toHaveBeenCalledExactlyOnceWith(view.options[0]?.index);
  expect(input.accepts()).toBe(false);
});

it("enlarges a held card, consumes its release, and cancels a carried press when paused", () => {
  const { choose, events, input, panel, point, scene, time } = fixture();
  input.gesture?.down?.(point);
  time.now = holdRule(gameData.tuning, Number.POSITIVE_INFINITY).holdMs + 1;
  scene.update();
  expect(scene.holding()).toBe(true);
  expect(panel.setLarge).toHaveBeenLastCalledWith(0);
  expect(input.gesture?.up?.(point, false)).toBe(true);
  expect(scene.holding()).toBe(false);
  expect(choose).not.toHaveBeenCalled();
  input.gesture?.down?.(point);
  events.emit("pause");
  input.gesture?.up?.(point, false);
  expect(choose).not.toHaveBeenCalled();
  input.gesture?.down?.(point);
  input.gesture?.up?.(point, false);
  expect(choose).toHaveBeenCalledOnce();
});

// One millisecond short of the data's hold time taps the card; exactly the hold time enlarges it.
it.each([
  ["taps", -1, false],
  ["holds", 0, true],
] as const)("%s a card released %i ms from the data's hold time", (_, offset, held) => {
  const { choose, input, point, scene, time } = fixture();
  input.gesture?.down?.(point);
  time.now = read(gameData.tuning, "seconds", "holdSeconds") * 1000 + offset;
  scene.update();
  expect(scene.holding()).toBe(held);
  input.gesture?.up?.(point, false);
  expect(choose).toHaveBeenCalledTimes(held ? 0 : 1);
});

it("plays an unaffordable choice's refusal on its option for a key or a tap, choosing nothing", () => {
  const { choose, input, keyboard, panel, point } = fixture(true);
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  input.gesture?.down?.(point);
  input.gesture?.up?.(point, false);
  expect(choose).not.toHaveBeenCalled();
  expect(vi.mocked(panel.refuse).mock.calls).toEqual([[0], [0]]);
});
