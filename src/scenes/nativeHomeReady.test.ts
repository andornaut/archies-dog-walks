import { EventEmitter } from "node:events";

import { expect, it, vi } from "vitest";

import { NATIVE_HOME_READY, waitForNativeHome } from "./nativeHomeReady.ts";

it.each(["home", "load"])(
  "keeps Boot until native home and background load settle, %s first",
  (first) => {
    const events = new EventEmitter();
    const done = { loaded: vi.fn(), shown: vi.fn() };
    const waiting = waitForNativeHome(events, done);
    if (first === "home") {
      events.emit(NATIVE_HOME_READY);
      expect(done.shown).toHaveBeenCalledOnce();
      expect(done.loaded).not.toHaveBeenCalled();
      waiting.loaded();
    } else {
      waiting.loaded();
      expect(done.shown).not.toHaveBeenCalled();
      expect(done.loaded).not.toHaveBeenCalled();
      events.emit(NATIVE_HOME_READY);
    }
    events.emit(NATIVE_HOME_READY);
    waiting.loaded();
    expect(done.shown).toHaveBeenCalledOnce();
    expect(done.loaded).toHaveBeenCalledOnce();
    expect(events.listenerCount(NATIVE_HOME_READY)).toBe(0);
  },
);

it("drops late home and loading callbacks after Boot shuts down", () => {
  const events = new EventEmitter();
  const done = { loaded: vi.fn(), shown: vi.fn() };
  const waiting = waitForNativeHome(events, done);
  waiting.dispose();
  waiting.dispose();
  waiting.loaded();
  events.emit(NATIVE_HOME_READY);
  expect(done.shown).not.toHaveBeenCalled();
  expect(done.loaded).not.toHaveBeenCalled();
  expect(events.listenerCount(NATIVE_HOME_READY)).toBe(0);
});
