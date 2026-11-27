import { expect, it, vi } from "vitest";

import { StartScene } from "./StartScene.ts";

vi.mock("phaser", () => ({ Core: { Events: {} }, Scene: class {}, Scenes: { Events: {} } }));

const methods = StartScene.prototype as unknown as {
  onKey(event: { code: string; shiftKey: boolean }): void;
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
