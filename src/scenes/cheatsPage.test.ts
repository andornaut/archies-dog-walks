import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NEXT_WALK_OFF, startZones } from "../cheats/cheats.ts";
import type { CheatsState } from "../cheats/cheatsView.ts";
import { gameData } from "../data/index.ts";
import type { ZoneId } from "../data/types.ts";
import type { DomCheatsInput } from "../hud/dom/cheats.ts";
import type { DomQuestionPanelInput } from "../ui/dom/index.ts";
import { cents } from "../units.ts";
import { openCheatsPage } from "./cheatsPage.ts";

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
vi.mock("../cheats/dom/browserTools.ts", () => ({ browserToolsOn: () => false }));
vi.mock("../cheats/cheatsView.ts", () => ({
  cheatsView: (_measure: unknown, _input: unknown, state: CheatsState) => {
    fake.projection(state);
    return { layout: {} };
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
vi.mock("./nativeModalShade.ts", () => ({
  nativeModalShade: (_scene: unknown, panel: unknown) => panel,
}));
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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function open(inWalk: boolean) {
  const scene = {
    game: { events: new EventEmitter() },
    scene: { get: () => fake.run, isActive: () => true, isPaused: () => false },
  } as unknown as Scene;
  const close = vi.fn();
  const modal = openCheatsPage(scene, inWalk, close)!;
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

// Queued frame callbacks run on paint(), and the timeouts they start run on the fake clock.
function frames() {
  const queued: FrameRequestCallback[] = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queued.push(callback));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queued[id - 1] = () => undefined;
  });
  return {
    paint: () => {
      queued.splice(0).forEach((callback) => callback(0));
      vi.runAllTimers();
    },
  };
}

it("applies live invincibility without closing Cheats or staging choices", () => {
  const { close, input } = open(true);
  fake.run.toggleInvincible.mockImplementation(() => {
    fake.run.activeCheats.mockReturnValue({ invincible: true, zone: startZones(gameData)[0]! });
  });
  input.act({ kind: "invincible" });
  expect(fake.run.toggleInvincible).toHaveBeenCalledOnce();
  expect(fake.projection).toHaveBeenLastCalledWith(
    expect.objectContaining({ walk: { invincible: true, zone: startZones(gameData)[0]! } }),
  );
  expect(fake.next).toEqual(NEXT_WALK_OFF);
  expect(close).not.toHaveBeenCalled();
});

it("shows a live neighbourhood selected on the press and switches the walk after that paint", () => {
  const { paint } = frames();
  const { close, input } = open(true);
  const [, second, third] = startZones(gameData);
  fake.run.jumpToZone.mockImplementation((zone: ZoneId) => {
    fake.run.activeCheats.mockReturnValue({ invincible: false, zone });
  });
  input.act({ kind: "startAt", zone: second! });
  expect(fake.render).toHaveBeenCalledOnce();
  expect(fake.projection).toHaveBeenLastCalledWith(
    expect.objectContaining({ walk: { invincible: false, zone: second } }),
  );
  expect(fake.run.jumpToZone).not.toHaveBeenCalled();
  // A second press before the paint replaces the first: one switch, to the last choice.
  input.act({ kind: "startAt", zone: third! });
  expect(fake.projection).toHaveBeenLastCalledWith(
    expect.objectContaining({ walk: { invincible: false, zone: third } }),
  );
  paint();
  expect(fake.run.jumpToZone).toHaveBeenCalledExactlyOnceWith(third);
  expect(fake.projection).toHaveBeenLastCalledWith(
    expect.objectContaining({ walk: { invincible: false, zone: third } }),
  );
  expect(fake.next).toEqual(NEXT_WALK_OFF);
  expect(close).not.toHaveBeenCalled();
});

it.each([
  ["another cheat", (modal: ReturnType<typeof open>) => modal.input.act({ kind: "refillHearts" })],
  ["closing Cheats", (modal: ReturnType<typeof open>) => modal.modal.destroy()],
])("applies a pending neighbourhood switch before %s", (_name, then) => {
  const { paint } = frames();
  const modal = open(true);
  const zone = startZones(gameData)[1]!;
  modal.input.act({ kind: "startAt", zone });
  then(modal);
  expect(fake.run.jumpToZone).toHaveBeenCalledExactlyOnceWith(zone);
  const order = fake.run.jumpToZone.mock.invocationCallOrder[0]!;
  expect(fake.run.cheat.mock.invocationCallOrder.every((call) => call > order)).toBe(true);
  paint();
  expect(fake.run.jumpToZone).toHaveBeenCalledOnce();
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
