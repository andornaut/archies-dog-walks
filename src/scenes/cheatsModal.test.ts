import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { NEXT_WALK_OFF, startZones } from "../dev/cheats.ts";
import type { DomCheatsInput } from "../hud/dom/cheats.ts";
import type { DomQuestionPanelInput } from "../hud/dom/questionPanel.ts";
import { cents } from "../units.ts";
import { openCheatsModal } from "./cheatsModal.ts";

const fake = vi.hoisted(() => ({
  canResetSave: vi.fn(() => true),
  focusReset: vi.fn(),
  input: undefined as DomCheatsInput | undefined,
  next: undefined as typeof NEXT_WALK_OFF | undefined,
  question: undefined as DomQuestionPanelInput | undefined,
  reset: vi.fn(() => Promise.resolve(true)),
  run: {
    canFinishZone: () => true,
    cheat: vi.fn(),
    cheatsApply: () => true,
    upgradesToGrant: () => 0,
  },
  update: vi.fn(),
  useCheat: vi.fn(),
}));
vi.mock("../dev/devTools.ts", () => ({ devToolsOn: () => false }));
vi.mock("../dev/cheatsView.ts", () => ({
  cheatsView: () => ({ layout: { panel: { height: 400, width: 300, x: 30, y: 40 } } }),
}));
vi.mock("../hud/dom/cheats.ts", () => ({
  showCheats: (_layer: unknown, input: DomCheatsInput) => {
    fake.input = input;
    return {
      destroy: vi.fn(),
      focusReset: fake.focusReset,
      setDimmed: vi.fn(),
      setInert: vi.fn(),
      update: vi.fn(),
    };
  },
}));
vi.mock("../hud/dom/questionPanel.ts", () => ({
  showQuestionPanel: (_layer: unknown, input: DomQuestionPanelInput) => {
    fake.question = input;
    return { destroy: vi.fn() };
  },
}));
vi.mock("./modalMeasure.ts", () => ({ canvasPanelMeasure: () => ({}) }));
vi.mock("./questionPanel.ts", () => ({
  followScene: (_scene: unknown, panel: unknown) => panel,
  htmlPanelInput: () => ({}),
  htmlPanelPlace: () => ({ layer: {} }),
  questionView: () => ({}),
}));
vi.mock("./profileStore.ts", () => ({
  canResetSave: fake.canResetSave,
  currentSettings: () => ({ fpsCounter: false, reducedMotion: true }),
  profileSave: vi.fn(),
  resetSave: fake.reset,
  setSettings: vi.fn(),
  updateProfile: fake.update,
  walkerInUse: vi.fn(),
}));
vi.mock("./cheatSession.ts", () => ({
  CHEATS_CHANGED_EVENT: "cheats-changed",
  nextWalk: () => fake.next,
  setNextWalk: (_scene: unknown, next: typeof NEXT_WALK_OFF) => {
    fake.useCheat();
    fake.next = next;
  },
  useCheat: fake.useCheat,
}));

beforeEach(() => {
  vi.clearAllMocks();
  fake.canResetSave.mockReturnValue(true);
  fake.next = NEXT_WALK_OFF;
  fake.question = undefined;
});
afterEach(() => vi.unstubAllGlobals());

function open(inWalk: boolean) {
  const scene = {
    game: { events: new EventEmitter() },
    scene: { get: () => fake.run, isActive: () => true, isPaused: () => false },
  } as unknown as Scene;
  const close = vi.fn();
  const modal = openCheatsModal(scene, inWalk, close)!;
  return { close, input: fake.input!, modal, scene };
}

it("allows installed-app actions and seed input while retaining the cheat session boundary", () => {
  const { close, input, scene } = open(false);
  input.act({ amount: cents(100), kind: "addBank" });
  expect(fake.useCheat).toHaveBeenCalledOnce();
  expect(fake.update).toHaveBeenCalledWith(scene, expect.any(Function));
  input.seed("123");
  expect(fake.next?.seed).toBe(123);
  expect(fake.useCheat).toHaveBeenCalledTimes(2);
  input.seed("invalid");
  expect(fake.next?.seed).toBe(123);
  expect(fake.useCheat).toHaveBeenCalledTimes(2);
  expect(close).not.toHaveBeenCalled();
});

it.each([false, true])("keeps walk-only actions scoped to the invoking context (%s)", (inWalk) => {
  const { input } = open(inWalk);
  input.act({ kind: "refillHearts" });
  expect(fake.run.cheat).toHaveBeenCalledTimes(inWalk ? 1 : 0);
});

it("selects an explicit neighbourhood without changing other Next Walk choices", () => {
  const { input } = open(false);
  const zone = startZones(gameData)[1]!;
  input.act({ kind: "startAt", zone });
  expect(fake.next).toEqual({ ...NEXT_WALK_OFF, start: zone });
  expect(fake.useCheat).toHaveBeenCalledOnce();
});

it("requires Reset confirmation in an installed app and Back closes only that question", async () => {
  const replace = vi.fn();
  vi.stubGlobal("location", { href: import.meta.url, replace });
  const { close, input, modal, scene } = open(false);
  fake.canResetSave.mockReturnValue(false);
  input.act({ kind: "resetSave" });
  expect(fake.question).toBeUndefined();
  expect(fake.reset).not.toHaveBeenCalled();
  fake.canResetSave.mockReturnValue(true);
  input.act({ kind: "resetSave" });
  expect(fake.reset).not.toHaveBeenCalled();
  expect(modal.back()).toBe(true);
  expect(fake.focusReset).toHaveBeenCalledOnce();
  expect(modal.back()).toBe(false);
  expect(close).not.toHaveBeenCalled();
  input.act({ kind: "resetSave" });
  fake.question!.presses[1]!();
  await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
  expect(fake.reset).toHaveBeenCalledExactlyOnceWith(scene);
  modal.destroy();
});
