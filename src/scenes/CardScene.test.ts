import { EventEmitter } from "node:events";

import { beforeEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { helpPicture } from "../help/helpPictures.ts";
import { type NativeChoiceCards, showChoiceCards } from "../hud/dom/choiceCards.ts";
import { holdRule } from "../input/hold.ts";
import { cardRowIn } from "../layout/cardLayout.ts";
import { MAX_CARD_OPTIONS } from "../rules/choices.ts";
import { gameFont } from "../testing/fontInk.ts";
import { CardScene } from "./CardScene.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { nativeSceneAccepts } from "./overlay.ts";
import { htmlArtInput, htmlPanelPlace } from "./questionPanel.ts";
import { refuseMotion } from "./refuseMotion.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scene: class {},
  Scenes: { Events: { PAUSE: "pause", SHUTDOWN: "shutdown" } },
}));
vi.mock("../hud/dom/choiceCards.ts", () => ({ showChoiceCards: vi.fn() }));
vi.mock("../ui/phaser/displayText.ts", () => ({ displayBitmapFont: () => undefined }));
vi.mock("../ui/phaser/rampDim.ts", () => ({ addRampDim: vi.fn() }));
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
vi.mock("./refuseMotion.ts", () => ({ refuseMotion: vi.fn() }));
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
    setLarge: vi.fn(),
    setPressed: vi.fn(),
    setRefusal: vi.fn(),
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
  const { choose, keyboard, view } = fixture();
  vi.mocked(nativeSceneAccepts).mockReturnValue(false);
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  expect(choose).not.toHaveBeenCalled();
  vi.mocked(nativeSceneAccepts).mockReturnValue(true);
  keyboard.emit("keydown", { code: "Digit1", repeat: true });
  expect(choose).not.toHaveBeenCalled();
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  expect(choose).toHaveBeenCalledExactlyOnceWith(view.options[0]?.index);
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

it("keeps a disabled choice actionable for one refusal cue without choosing it", () => {
  const { choose, keyboard } = fixture(true);
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  keyboard.emit("keydown", { code: "Digit1", repeat: false });
  expect(choose).not.toHaveBeenCalled();
  expect(refuseMotion).toHaveBeenCalledOnce();
});
