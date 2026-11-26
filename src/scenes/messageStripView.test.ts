import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/hudMoments.ts";
import type { FaceRow } from "../hud/faceText.ts";
import {
  MESSAGE_STRIP,
  messagePanel,
  ownerLeadLayout,
  ownerLeadPanel,
  stripLeadSlot,
} from "../hud/messageStrip.ts";
import { SCREEN_LAYOUT } from "../layout/screen.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { FakeDocument } from "../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../testing/fontInk.ts";
import type { DomTextBlock } from "../ui/dom/pixelLine.ts";
import { lineInk } from "../ui/lineInk.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { MessageStrip } from "./messageStripView.ts";

describe("owner-led native notices", () => {
  it("projects full-size name ink, its measured panel and all message rows together", () => {
    const doc = new FakeDocument();
    const element = doc.createElement("div") as unknown as HTMLElement;
    const texts: DomTextBlock[] = [];
    const panels: Rect[] = [];
    const rows: FaceRow[][] = [];
    const group: HudMoment = {
      art: () => ({ dispose: vi.fn(), ready: Promise.resolve([]) }),
      dispose: vi.fn(),
      element,
      faceRows: (_at, _box, _scale, _colour, lines) => rows.push([...lines]),
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
    const ink = lineInk(body, owner);
    const metrics = fontFileMetrics("font-body");
    const lead = ownerLeadLayout(stripLeadSlot(metrics), ink);
    expect(rows[0]!.length).toBeGreaterThan(2);
    expect(rows[0]!.flatMap((row) => row.texts.map((part) => part.text)).join(" ")).toBe(text);
    expect(texts[0]).toMatchObject({
      capTop: lead.name.y,
      lines: [owner],
      scale: TEXT_SCALE,
      x: lead.name.x - ink.left,
    });
    expect(panels[0]).toEqual(ownerLeadPanel(messagePanel(metrics, rows[0]!.length), lead));
    expect(panels[0]!.y).toBe(
      MESSAGE_STRIP.gap + SCREEN_LAYOUT.topBar.y + SCREEN_LAYOUT.topBar.height,
    );
    strip.dispose();
  });
});
