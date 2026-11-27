import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it, vi } from "vitest";

import { ownerFaceKey } from "../assets/spriteKeys.ts";
import { DEBUFF_BAR, gameData } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/hudMoments.ts";
import {
  MESSAGE_STRIP,
  messagePanel,
  ownerLeadLayout,
  ownerLeadPanel,
  stripLeadSlot,
} from "../hud/messageStrip.ts";
import { fillNoticeText, ownerNameText } from "../hud/noticeText.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { FakeDocument } from "../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../testing/fontInk.ts";
import type { DomTextBlock } from "../ui/dom/pixelLine.ts";
import { MessageStrip } from "./messageStripView.ts";

describe("owner-led native notices", () => {
  it("projects the HUD-sized portrait without a visible caption and retains all message rows", () => {
    const doc = new FakeDocument();
    const view = doc.createElement("div");
    const element = view as unknown as HTMLElement;
    const texts: DomTextBlock[] = [];
    const art = vi.fn(() => ({ dispose: vi.fn(), ready: Promise.resolve([]) }));
    const panels: Rect[] = [];
    const group: HudMoment = {
      art,
      dispose: vi.fn(),
      element,
      panel: (rect) => {
        panels.push(rect);
      },
      ring: vi.fn(),
      state: { alpha: 1, scale: 1, visible: true, x: 0, y: 0 },
      text: (line) => {
        texts.push(line);
      },
    };
    const body = gameFont("font-body");
    const painter: HudMomentPainter = {
      dispose: vi.fn(),
      element,
      fonts: { body, display: gameFont("font-display"), title: gameFont("font-title") },
      group: () => group,
      hasArt: () => true,
      inkWidth: vi.fn(),
      prepare: () => Promise.resolve([]),
      update: vi.fn(),
      width: bodyTextWidth,
    };
    const strip = new MessageStrip(painter);
    const owner = gameData.dogs.sequoia.owner.name;
    const text = Array.from({ length: 14 }, () => "Woof").join(" ");
    strip.say({ icon: { dog: "sequoia", kind: "owner", mood: "happy" }, text });
    strip.update(0, 1, 0);
    const metrics = fontFileMetrics("font-body");
    const lead = ownerLeadLayout(stripLeadSlot(metrics));
    const lines = texts.flatMap(({ lines }) => lines);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join(" ")).toBe(text);
    expect(view.children[0]?.className).toBe("visually-hidden");
    expect(view.children[0]?.textContent).toBe(`${owner}: `);
    expect(art).toHaveBeenCalledWith({
      at: { x: lead.frame.x + 1, y: lead.frame.y + 1 },
      clock: "now",
      key: ownerFaceKey(gameData, "sequoia"),
      loop: true,
      projection: "layout",
      tags: ["happy", "neutral"],
    });
    expect(panels[0]).toEqual(ownerLeadPanel(messagePanel(metrics, lines.length), lead));
    expect(panels[0]!.y).toBe(
      MESSAGE_STRIP.gap + SCREEN_LAYOUT.topBar.y + SCREEN_LAYOUT.topBar.height,
    );
    strip.dispose();

    const iconStrip = new MessageStrip(painter);
    const mentioned = ownerNameText(gameData, "sequoia");
    const sentence = fillNoticeText("{owner} −1♥", { owner: mentioned });
    iconStrip.say({ ...sentence, icon: "bump" });
    iconStrip.update(0, 1, 2);
    expect(art).toHaveBeenLastCalledWith(
      expect.objectContaining({
        image: { height: DEBUFF_BAR.icon.size, width: DEBUFF_BAR.icon.size },
        projection: "layout",
      }),
    );
    expect(art).toHaveBeenCalledTimes(2);
    expect(texts.at(-1)?.lines).toEqual([sentence.text]);
    iconStrip.dispose();
  });
});
