import type { Scene, Tweens } from "phaser";
import { expect, it, vi } from "vitest";

import type { HudMoment } from "../hud/dom/index.ts";
import { type ChangeLabel, FEEDBACK, MONEY_LABEL } from "../hud/index.ts";
import { amountText } from "../rules/index.ts";
import { gameFont, phaserFontData } from "../testing/fontInk.ts";
import { HudChangeLabels } from "./hudChangeLabels.ts";
import type { TimedGroup } from "./timedGroup.ts";

const BODY = "font-body";

it("restarts the tip hold on merge and credits the combined amount only when the chip lands", () => {
  const scene = {
    cache: { bitmapFont: { exists: () => true, get: () => ({ data: phaserFontData(BODY) }) } },
  } as unknown as Scene;
  const timers: (() => void)[] = [];
  const flights: Parameters<TimedGroup["tween"]>[1][] = [];
  const after = vi.fn<TimedGroup["after"]>((_scene, _ms, callback) => {
    timers.push(callback);
  });
  const tween: TimedGroup["tween"] = (_scene, config) => {
    flights.push(config);
    return {} as Tweens.Tween;
  };
  const dispose = vi.fn();
  const text = vi.fn<HudMoment["text"]>();
  const body = gameFont(BODY);
  const labels = new HudChangeLabels(scene, {
    labels: { after, tween },
    painter: {
      fonts: { body, display: body, title: body },
      group: () =>
        ({ dispose, panel: () => undefined, state: { x: 0, y: 0 }, text }) as unknown as HudMoment,
      hasArt: () => false,
    },
    reducedMotion: () => false,
  });
  const tip = (amount: number): ChangeLabel => ({
    amount,
    gain: true,
    target: { kind: "cash", tip: true },
    text: amountText("money", amount),
  });

  labels.showMoneyChanges([tip(100)]);
  labels.showMoneyChanges([tip(250)]);

  expect(after.mock.calls.map(([, delay]) => delay)).toEqual([
    MONEY_LABEL.holdMs,
    MONEY_LABEL.holdMs,
  ]);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(text.mock.lastCall?.[0].lines).toEqual([tip(350).text]);
  expect(labels.inFlight).toBe(350);
  timers[0]!();
  expect(flights).toHaveLength(0);
  timers[1]!();
  expect(flights).toHaveLength(1);
  expect(flights[0]?.duration).toBe(FEEDBACK.heart.flyMs);
  expect(labels.inFlight).toBe(350);
  flights[0]?.onComplete?.({} as Tweens.Tween, []);
  expect(labels.inFlight).toBe(0);
  expect(dispose).toHaveBeenCalledTimes(2);
});
