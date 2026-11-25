import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { NEXT_WALK_OFF, startZones } from "../dev/cheats.ts";
import type { CheatsState } from "../dev/cheatsView.ts";
import type { DomCheatsInput } from "../hud/dom/cheats.ts";
import type { DomQuestionPanelInput } from "../hud/dom/questionPanel.ts";
import { cents } from "../units.ts";
import { openCheatsModal } from "./cheatsModal.ts";

const fake = vi.hoisted(() => ({
  canResetSave: vi.fn(() => true),
  focusReset: vi.fn(),
  input: undefined as DomCheatsInput | undefined,
  next: undefined as typeof NEXT_WALK_OFF | undefined,
  projection: vi.fn(),
  question: undefined as DomQuestionPanelInput | undefined,
  render: vi.fn(),
  reset: vi.fn(() => Promise.resolve(true)),
  run: {
    activeCheats: vi.fn(),
    cheat: vi.fn(),
    cheatsApply: vi.fn(() => true),
    jumpToZone: vi.fn(),
    toggleInvincible: vi.fn(),
  },
  update: vi.fn(),
}));
vi.mock("../dev/devTools.ts", () => ({ devToolsOn: () => false }));
vi.mock("../dev/cheatsView.ts", () => ({
  cheatsView: (_measure: unknown, _input: unknown, state: CheatsState) => {
    fake.projection(state);
    return { layout: { panel: { height: 400, width: 300, x: 30, y: 40 } } };
  },
}));
vi.mock("../hud/dom/cheats.ts", () => ({
  showCheats: (_layer: unknown, input: DomCheatsInput) => {
    fake.input = input;
    return {
      destroy: vi.fn(),
      focusReset: fake.focusReset,
      setDimmed: vi.fn(),
      setInert: vi.fn(),
      update: fake.render,
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
vi.mock("./cheatChoices.ts", () => ({
  CHEATS_CHANGED_EVENT: "cheats-changed",
  nextWalk: () => fake.next,
  setNextWalk: (_scene: unknown, next: typeof NEXT_WALK_OFF) => {
    fake.next = next;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  fake.canResetSave.mockReturnValue(true);
  fake.next = NEXT_WALK_OFF;
  fake.question = undefined;
  fake.run.activeCheats.mockReturnValue({ invincible: false, zone: startZones(gameData)[0]! });
  fake.run.cheatsApply.mockReturnValue(true);
  fake.run.jumpToZone.mockReset();
  fake.run.toggleInvincible.mockReset();
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

it("applies a bank grant to the save and keeps a valid seed for the next walk", () => {
  const { close, input, scene } = open(false);
  input.act({ amount: cents(100), kind: "addBank" });
  expect(fake.update).toHaveBeenCalledWith(scene, expect.any(Function));
  input.seed("123");
  expect(fake.next?.seed).toBe(123);
  input.seed("invalid");
  expect(fake.next?.seed).toBe(123);
  expect(close).not.toHaveBeenCalled();
});

it.each([false, true])("keeps walk-only actions scoped to the invoking context (%s)", (inWalk) => {
  const { input } = open(inWalk);
  input.act({ kind: "refillHearts" });
  expect(fake.run.cheat).toHaveBeenCalledTimes(inWalk ? 1 : 0);
});

it("selects a Start neighbourhood without changing other setup choices", () => {
  const { input } = open(false);
  const zone = startZones(gameData)[1]!;
  input.act({ kind: "startAt", zone });
  expect(fake.next).toEqual({ ...NEXT_WALK_OFF, start: zone });
});

it("applies live invincibility and neighbourhood changes without closing Cheats or staging choices", () => {
  const { close, input } = open(true);
  const zone = startZones(gameData)[2]!;
  fake.run.toggleInvincible.mockImplementation(() => {
    fake.run.activeCheats.mockReturnValue({ invincible: true, zone: startZones(gameData)[0]! });
  });
  input.act({ kind: "invincible" });
  expect(fake.run.toggleInvincible).toHaveBeenCalledOnce();
  expect(fake.projection).toHaveBeenLastCalledWith(
    expect.objectContaining({ walk: { invincible: true, zone: startZones(gameData)[0]! } }),
  );
  fake.run.jumpToZone.mockImplementation(() => {
    fake.run.activeCheats.mockReturnValue({ invincible: true, zone });
  });
  input.act({ kind: "startAt", zone });
  expect(fake.run.jumpToZone).toHaveBeenCalledExactlyOnceWith(zone);
  expect(fake.projection).toHaveBeenLastCalledWith(
    expect.objectContaining({ walk: { invincible: true, zone } }),
  );
  expect(fake.next).toEqual(NEXT_WALK_OFF);
  expect(fake.render).toHaveBeenCalledTimes(2);
  expect(close).not.toHaveBeenCalled();
});

it("does not stage later changes when the invoking walk has ended", () => {
  const { input } = open(true);
  fake.run.cheatsApply.mockReturnValue(false);
  input.act({ kind: "invincible" });
  input.act({ kind: "startAt", zone: startZones(gameData)[1]! });
  expect(fake.run.toggleInvincible).not.toHaveBeenCalled();
  expect(fake.run.jumpToZone).not.toHaveBeenCalled();
  expect(fake.next).toEqual(NEXT_WALK_OFF);
});

it("applies bank and ownership grants immediately while Cheats remains over the walk", () => {
  const { close, input, scene } = open(true);
  input.act({ amount: cents(100), kind: "addBank" });
  input.act({ grant: "dogs", kind: "own" });
  expect(fake.update).toHaveBeenNthCalledWith(1, scene, expect.any(Function));
  expect(fake.update).toHaveBeenNthCalledWith(2, scene, expect.any(Function));
  expect(fake.render).toHaveBeenCalledTimes(2);
  expect(close).not.toHaveBeenCalled();
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
