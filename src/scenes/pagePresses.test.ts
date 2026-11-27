import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { listenPagePresses } from "./pagePresses.ts";

vi.mock("../pwa/index.ts", () => ({ pageFrameTurn: () => 0 }));

it("allows primary page presses and cancels rather than activating on a final secondary release", () => {
  const bare = {};
  const doc = Object.assign(new EventTarget(), { body: bare, documentElement: {} });
  const scene = {
    events: new EventEmitter(),
    game: {
      canvas: {
        getBoundingClientRect: () => ({ height: 560, left: 0, top: 0, width: 360 }),
        parentElement: null,
      },
    },
    input: { enabled: true },
    scale: { gameSize: { height: 560, width: 360 } },
    sys: { isActive: () => true },
  } as unknown as Scene;
  const handlers = { cancel: vi.fn(), down: vi.fn(), move: vi.fn(), up: vi.fn() };
  const send = (type: string, button: number, buttons: number) => {
    const event = Object.assign(new Event(type), {
      button,
      buttons,
      clientX: 6,
      clientY: 8,
      pointerId: 1,
      pointerType: "mouse",
    });
    Object.defineProperty(event, "target", { value: bare });
    doc.dispatchEvent(event);
  };
  vi.stubGlobal("document", doc);
  try {
    listenPagePresses(scene, handlers);
    send("pointerdown", 2, 2);
    send("pointerup", 2, 0);
    expect(handlers.down).not.toHaveBeenCalled();
    expect(handlers.up).not.toHaveBeenCalled();

    send("pointerdown", 0, 1);
    send("pointermove", -1, 1);
    send("pointerup", 0, 0);
    expect(handlers.down).toHaveBeenCalledOnce();
    expect(handlers.move).toHaveBeenCalledOnce();
    expect(handlers.up).toHaveBeenCalledOnce();

    send("pointerdown", 0, 1);
    send("pointermove", 0, 2);
    send("pointerup", 2, 0);
    expect(handlers.move).toHaveBeenCalledOnce();
    expect(handlers.up).toHaveBeenCalledOnce();
    expect(handlers.cancel).toHaveBeenCalledOnce();

    send("pointerdown", 0, 1);
    send("pointercancel", -1, 0);
    expect(handlers.cancel).toHaveBeenCalledTimes(2);
  } finally {
    scene.events.emit("shutdown");
    vi.unstubAllGlobals();
  }
});
