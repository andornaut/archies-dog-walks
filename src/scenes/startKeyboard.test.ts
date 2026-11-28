import { expect, it, vi } from "vitest";

import type { HomeLoadout } from "../home/index.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { type Target, targetId } from "./start/targets.ts";
import { StartScene } from "./StartScene.ts";

vi.mock("phaser", () => ({ Core: { Events: {} }, Scene: class {}, Scenes: { Events: {} } }));

vi.mock("./profileStore.ts", async (original) => ({
  ...(await original<typeof import("./profileStore.ts")>()),
  updateProfile: vi.fn(() => Promise.resolve()),
}));

const methods = StartScene.prototype as unknown as {
  onKey(event: { code: string; shiftKey: boolean }): void;
  onContextMenu(event: unknown): void;
};

it("uses S/L for navigation and confirms the new loadout target once instead of opening their former shortcuts", () => {
  const rows = [[{ kind: "petShop" }, { kind: "slotSign" }], [{ kind: "start" }]];
  const state = {
    act: vi.fn(),
    actAfterDip: vi.fn(),
    focus: { column: 0, row: 0 },
    focusAction: () => ({ kind: "none" }),
    focused() {
      return rows[this.focus.row]![this.focus.column];
    },
    keyboardRows: () => rows,
    nativeHome: { accepts: () => true, element: { focus: vi.fn() } },
    nativeReady: true,
    overlay: undefined,
    render: vi.fn(),
    time: { now: 0 },
  };
  methods.onKey.call(state, { code: "KeyL", shiftKey: false });
  expect(state.focus).toEqual({ column: 1, row: 0 });
  methods.onKey.call(state, { code: "KeyS", shiftKey: false });
  expect(state.focus).toEqual({ column: 0, row: 1 });
  expect(state.act).not.toHaveBeenCalled();
  methods.onKey.call(state, { code: "Space", shiftKey: false });
  expect(state.actAfterDip).toHaveBeenCalledExactlyOnceWith({ kind: "start" });
  expect(state.nativeHome.element.focus).toHaveBeenCalledTimes(2);
});

it("keeps the legacy Start shortcut without making an unfocused E or F start a walk", () => {
  const state = {
    actAfterDip: vi.fn(),
    focused: () => undefined,
    nativeHome: { accepts: () => true },
    nativeReady: true,
    time: { now: 0 },
  };
  for (const code of ["KeyE", "KeyF"]) {
    methods.onKey.call(state, { code, shiftKey: false });
  }
  expect(state.actAfterDip).not.toHaveBeenCalled();
  methods.onKey.call(state, { code: "Enter", shiftKey: false });
  expect(state.actAfterDip).toHaveBeenCalledExactlyOnceWith({ kind: "start" });
});

vi.mock("./questionPanel.ts", async (original) => ({
  ...(await original<typeof import("./questionPanel.ts")>()),
  htmlPanelInput: () => ({
    toGame: ({ x, y }: { x: number; y: number }) => ({ x: x / 2, y: y / 2 }),
  }),
  htmlPanelPlace: () => ({}),
}));

it("admits a canvas right click only for existing foreground Shop and gate-bubble targets", () => {
  const state = {
    act: vi.fn(),
    input: { enabled: true },
    nativeHome: { accepts: () => true },
    overlay: undefined as unknown,
    sys: { isActive: () => true },
    targetAt: vi.fn(() => ({ kind: "petShop" })),
  };
  const event = () => ({
    button: 2,
    cancelBubble: false,
    clientX: 120,
    clientY: 160,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  });
  const shop = event();
  methods.onContextMenu.call(state, shop);
  expect(state.targetAt).toHaveBeenLastCalledWith(60, 80);
  expect(state.act).toHaveBeenCalledExactlyOnceWith({ kind: "petShop" });
  expect(shop.preventDefault).toHaveBeenCalledOnce();
  state.targetAt.mockReturnValue({ kind: "bubble" });
  methods.onContextMenu.call(state, event());
  expect(state.act).toHaveBeenLastCalledWith({ kind: "bubble" });
  for (const extra of [{ button: 0 }, { defaultPrevented: true }, { cancelBubble: true }]) {
    const ignored = { ...event(), ...extra };
    methods.onContextMenu.call(state, ignored);
    expect(ignored.preventDefault).not.toHaveBeenCalled();
  }
  state.targetAt.mockReturnValue({ kind: "dog" });
  const other = event();
  methods.onContextMenu.call(state, other);
  expect(other.preventDefault).not.toHaveBeenCalled();
  state.overlay = {};
  methods.onContextMenu.call(state, event());
  state.overlay = undefined;
  state.input.enabled = false;
  methods.onContextMenu.call(state, event());
  expect(state.act).toHaveBeenCalledTimes(2);
});

it.each(["pointer", "keyboard"])(
  "shows a steady dog pick on %s activation without waiting for the press dip",
  (input) => {
    const dog = newPlayerSave.owned.dogs[0]!;
    const target = { dog, kind: "dog" } as const;
    const id = targetId(target);
    const delayedCall = vi.fn();
    const render = vi.fn();
    const scene = Object.assign(
      Object.create(StartScene.prototype) as {
        actAfterDip(target: Target): void;
        homePressUp(point: { x: number; y: number }, cancelled: boolean, native: boolean): boolean;
        loadout: HomeLoadout;
        onKey(event: { code: string; shiftKey: boolean }): void;
        press: { held: boolean; id: string; startedMs: number } | undefined;
        purchasePops: Map<string, number>;
      },
      {
        drawQuip: vi.fn(),
        focused: () => target,
        loadout: { dogs: [], gear: null },
        nativeHome: { accepts: () => true },
        nativeReady: true,
        press: { held: true, id, startedMs: 99 },
        pressedTarget: target,
        purchasePops: new Map([[id, 0]]),
        render,
        save: () => newPlayerSave,
        targetAt: () => target,
        time: { delayedCall, now: 100 },
      },
    );
    if (input === "pointer") {
      expect(scene.homePressUp({ x: 50, y: 50 }, false, true)).toBe(false);
      scene.actAfterDip(target);
    } else {
      scene.onKey({ code: "Enter", shiftKey: false });
    }
    expect(scene.loadout.dogs).toEqual([dog]);
    expect(scene.press).toBeUndefined();
    expect(scene.purchasePops.has(id)).toBe(false);
    expect(delayedCall).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledOnce();
  },
);

it("opens the existing Menu action with Escape only on the ready uncovered Start", () => {
  const state = {
    act: vi.fn(),
    closeOverlay: vi.fn(),
    nativeHome: { accepts: () => true },
    nativeReady: true,
    overlay: undefined as object | undefined,
  };
  methods.onKey.call(state, { code: "Escape", shiftKey: false });
  expect(state.act).toHaveBeenCalledExactlyOnceWith({ kind: "menu" });
  state.act.mockClear();
  state.overlay = {};
  methods.onKey.call(state, { code: "Escape", shiftKey: false });
  expect(state.closeOverlay).toHaveBeenCalledOnce();
  expect(state.act).not.toHaveBeenCalled();
  state.overlay = undefined;
  state.nativeReady = false;
  methods.onKey.call(state, { code: "Escape", shiftKey: false });
  state.nativeReady = true;
  state.nativeHome.accepts = () => false;
  methods.onKey.call(state, { code: "Escape", shiftKey: false });
  expect(state.act).not.toHaveBeenCalled();
  expect(state.closeOverlay).toHaveBeenCalledOnce();
});
