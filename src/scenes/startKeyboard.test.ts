import { expect, it, vi } from "vitest";

import { StartScene } from "./StartScene.ts";

vi.mock("phaser", () => ({ Core: { Events: {} }, Scene: class {}, Scenes: { Events: {} } }));

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
