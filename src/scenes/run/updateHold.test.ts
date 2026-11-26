import { expect, it, vi } from "vitest";

import { UpdateHold } from "./updateHold.ts";

it("releases only the pause menu that it opened and returns Back before closing it", () => {
  let closed = true;
  const open = vi.fn(() => {
    expect(hold.takesBack).toBe(true);
    closed = false;
  });
  const close = vi.fn(() => {
    expect(hold.takesBack).toBe(false);
    closed = true;
  });
  const hold = new UpdateHold({ close, isClosed: () => closed, open });

  const created = hold.hold();
  expect(created.opened).toBe(true);
  expect(hold.takesBack).toBe(true);
  created.release();
  expect(open).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();

  closed = false;
  const existing = hold.hold();
  expect(existing.opened).toBe(false);
  expect(hold.takesBack).toBe(true);
  existing.release();
  expect(hold.takesBack).toBe(false);
  expect(closed).toBe(false);
  expect(open).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});

it("owns Back even when the pause request does not open a menu", () => {
  const close = vi.fn();
  const open = vi.fn();
  const hold = new UpdateHold({ close, isClosed: () => true, open });

  const waiting = hold.hold();
  expect(open).toHaveBeenCalledOnce();
  expect(waiting.opened).toBe(false);
  expect(hold.takesBack).toBe(true);
  waiting.release();
  expect(hold.takesBack).toBe(false);
  expect(close).not.toHaveBeenCalled();
});
