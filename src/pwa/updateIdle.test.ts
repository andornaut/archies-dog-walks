import { afterEach, expect, it, vi } from "vitest";

import { PHONE_EVENTS } from "./events.ts";
import { createUpdateIdle } from "./updateIdle.ts";

afterEach(() => vi.useRealTimers());

it("wakes a sleeping required-update view when resources settle and disposes every owned wake", () => {
  vi.useFakeTimers();
  const events = new EventTarget();
  const loop = { sleep: vi.fn(), wake: vi.fn() };
  const bar = { destroy: vi.fn(), setShown: vi.fn() };
  let required = true;
  const idle = createUpdateIdle({ bar, events, required: () => required, timer: globalThis }, loop);
  idle.home(true);
  vi.advanceTimersByTime(1000);
  expect(loop.sleep).toHaveBeenCalledOnce();
  idle.invalidate();
  expect(loop.wake).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(999);
  expect(loop.sleep).toHaveBeenCalledOnce();
  required = false;
  events.dispatchEvent(new Event(PHONE_EVENTS.requiredUpdate));
  vi.advanceTimersByTime(1000);
  expect(loop.sleep).toHaveBeenCalledOnce();
  expect(bar.setShown).toHaveBeenLastCalledWith(false);
  idle.dispose();
  idle.dispose();
  events.dispatchEvent(new Event("pointerdown"));
  idle.invalidate();
  expect(loop.wake).toHaveBeenCalledTimes(3);
  expect(bar.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
