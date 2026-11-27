import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/hudMoments.ts";
import { MESSAGE_ICONS } from "../hud/messageStrip.ts";
import { FIRING_EVENT } from "../hud/moments.ts";
import { gameFont } from "../testing/fontInk.ts";
import { PALETTE } from "../ui/palette.ts";
import { HudFeedback } from "./feedbackMoments.ts";
import type { HudWalk } from "./hudWalk.ts";
import { MessageStrip } from "./messageStripView.ts";
import { OwnerTabs } from "./ownerTabs.ts";
import { TimedGroup } from "./timedGroup.ts";
function painterFixture() {
  const views: HudMoment[] = [];
  const painter = {
    fonts: {
      body: gameFont("font-body"),
      display: gameFont("font-display"),
      title: gameFont("font-title"),
    },
    group: vi.fn(() => {
      const view = {
        art: vi.fn(),
        dispose: vi.fn(),
        panel: vi.fn(),
        state: { alpha: 1 },
        text: vi.fn(),
      } as unknown as HudMoment;
      views.push(view);
      return view;
    }),
    hasArt: () => true,
    inkWidth: () => 32,
    width: (_scale: number, text: string) => text.length * 6,
  } as unknown as HudMomentPainter;
  return { painter, views };
}
it("holds a hidden message without aging it and disposes its native drawing before showing the next line", () => {
  const { painter, views } = painterFixture();
  const strip = new MessageStrip(painter);
  strip.say({ icon: "hint", text: gameData.runText.fired });
  strip.update(0, -1, 0);
  expect(views[0]!.art).toHaveBeenCalledWith(expect.objectContaining({ key: MESSAGE_ICONS.hint }));
  strip.update(10000, -1, 0, true);
  expect(views[0]!.dispose).toHaveBeenCalledTimes(1);
  strip.update(0, -1, 0);
  expect(views).toHaveLength(2);
  expect(views[1]!.state.alpha).toBe(1);
  strip.dispose();
  expect(views[1]!.dispose).toHaveBeenCalledTimes(1);
});
it("replaces an owner tab's whole native view and cancels only its own previous tween targets", () => {
  const { painter, views } = painterFixture();
  const configs: Record<string, unknown>[] = [];
  const scene = {
    tweens: {
      add: (config: Record<string, unknown>) => {
        configs.push(config);
        return { once: vi.fn() };
      },
      killTweensOf: vi.fn(),
    },
  } as unknown as Scene;
  const tabs = new OwnerTabs(scene, { group: new TimedGroup(), painter, still: () => true });
  tabs.pop({ dog: "archie", mood: "worried", slot: 0 }, 900);
  tabs.pop({ dog: "ginger", mood: "happy", slot: 0 }, 900);
  expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(views[0]!.state);
  expect(views[0]!.dispose).toHaveBeenCalledOnce();
  expect(views[1]!.art).toHaveBeenCalledWith(
    expect.objectContaining({ clock: "now", tags: ["happy", "neutral"] }),
  );
  expect(configs[1]).toMatchObject({
    alpha: 0,
    delay: 900,
    duration: 400,
    targets: views[1]!.state,
  });
  tabs.dispose();
  expect(views[1]!.dispose).toHaveBeenCalledOnce();
});
it("paints firing UI with the native display font size and preserves its protected cover rectangles", () => {
  const { painter, views } = painterFixture();
  const events = new EventEmitter();
  const scene = {
    events: new EventEmitter(),
    time: { delayedCall: () => ({ paused: false }), now: 0 },
    tweens: { add: () => ({ once: vi.fn() }) },
  } as unknown as Scene;
  // The firing event reads only the HUD snapshot's pack; native painting never creates canvas UI.
  const run = {
    events,
    hudView: () => ({ run: { pack: [{ dog: "archie" }] } }),
    reducedMotion: () => true,
  } as unknown as Pick<HudWalk, "events" | "hudView" | "reducedMotion">;
  const shown = vi.fn();
  const feedback = new HudFeedback(scene, run, {
    effectWell: () => undefined,
    firingShown: shown,
    floatLabels: vi.fn(),
    painter,
    payTotal: vi.fn(),
    popOwner: vi.fn(),
  });
  events.emit(FIRING_EVENT, { dog: "archie", line: gameData.runText.fired, seconds: 1 });
  expect(views[0]!.art).toHaveBeenCalledWith(expect.objectContaining({ key: "fx-fired-pop" }));
  expect(views[1]!.art).toHaveBeenCalledWith(
    expect.objectContaining({ clock: "now", scale: 2, tags: ["fired", "upset"] }),
  );
  expect(views[2]!.text).toHaveBeenCalledWith(
    expect.objectContaining({
      colour: PALETTE.yellow,
      font: "display",
      lines: [gameData.runText.fired],
      scale: 1,
    }),
  );
  expect(feedback.firingRects()).toHaveLength(3);
  expect(shown).toHaveBeenCalledOnce();
});
