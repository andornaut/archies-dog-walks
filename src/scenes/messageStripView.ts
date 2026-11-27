import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { Scene } from "phaser";

import { ownerFaceKey } from "../assets/index.ts";
import { gameData, MESSAGE_STRIP, SLICES } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/index.ts";
import {
  EMPTY_MESSAGE_STRIP,
  type FaceText,
  faceTextWithNamePills,
  inlineFaceBox,
  isOwnerLead,
  lineAlpha,
  linePlace,
  messageIconKey,
  type MessageLine,
  messageRows,
  type MessageStripState,
  messageTiming,
  type OwnerLead,
  ownerLeadLayout,
  ownerLeadPanel,
  sayLine,
  sayLineAhead,
  stepMessageStrip,
  stripLeadSlot,
  withoutFace,
} from "../hud/index.ts";
import type { NameMark } from "../presentation/index.ts";
import { PALETTE } from "../ui/index.ts";
// A line said from the run scene, as a MessageLine: the HUD shows it on its message strip.
export const MESSAGE_EVENT = "message";
// Says a line on the walk's message strip from the run scene.
export function sayMessage(runScene: Scene, line: MessageLine): void {
  runScene.events.emit(MESSAGE_EVENT, line);
}
interface Drawn {
  bars: number;
  id: number;
  view: HudMoment;
}
// A line as drawn, led by its icon's key or an owner's portrait. id names the line.
interface StripLine extends FaceText {
  readonly id: number;
  readonly lead: OwnerLead | string;
  readonly names?: readonly NameMark[];
}
// The message strip (see hud/messageStrip.ts) as drawn in the HUD, below modal scenes
// and their scrims. Its lines keep their paused lifetime while a modal is open.
export class MessageStrip {
  private drawn: Drawn | undefined;
  private state: MessageStripState = EMPTY_MESSAGE_STRIP;
  private readonly painter: HudMomentPainter;
  constructor(painter: HudMomentPainter) {
    this.painter = painter;
  }
  // ahead: the line waits ahead of the waiting lines with its icon.
  say(line: MessageLine, ahead = false): void {
    const add = ahead ? sayLineAhead : sayLine;
    this.state = add(messageTiming(gameData), line, this.state);
  }
  // hidden: the strip draws nothing, its lines held as they are, none aged, shown or dropped.
  update(dtMs: number, depth: number, bars: number, hidden = false): void {
    if (hidden) {
      this.clear();
      return;
    }
    const shown = this.current(dtMs);
    const drawn = this.drawn;
    const stale = drawn === undefined || drawn.id !== shown?.id || drawn.bars !== bars;
    if (stale) {
      this.clear();
      this.drawn = shown === undefined ? undefined : draw(this.painter, depth, bars, shown);
    }
    if (this.drawn === undefined || shown === undefined) {
      return;
    }
    this.drawn.view.state.alpha = shown.alpha;
  }
  // The walk's shown line, aged dtMs.
  private current(dtMs: number):
    | (StripLine & {
        alpha: number;
      })
    | undefined {
    const timing = messageTiming(gameData);
    this.state = stepMessageStrip(timing, dtMs, this.state);
    const { shown } = this.state;
    if (shown === null) {
      return undefined;
    }
    return {
      alpha: lineAlpha(timing, shown),
      id: shown.id,
      lead: isOwnerLead(shown.icon) ? shown.icon : messageIconKey(shown.icon),
      ...(shown.marks === undefined ? {} : { marks: shown.marks }),
      ...(shown.names === undefined ? {} : { names: shown.names }),
      text: shown.text,
    };
  }
  dispose(): void {
    this.clear();
  }
  private clear(): void {
    this.drawn?.view.dispose();
    this.drawn = undefined;
  }
}
// The line's lead and text, its rows at 2x on a panel as tall as they are, under bars debuff
// bars. An owner's lead moves the text right, and grows a panel shorter than the lead. Each
// owner the text names has their face inline before their name, except for the leading owner.
function draw(painter: HudMomentPainter, depth: number, bars: number, line: StripLine): Drawn {
  const body = fontMetrics(painter.fonts.body);
  const owner = typeof line.lead === "string" ? undefined : line.lead;
  const slot = stripLeadSlot(body, bars);
  const lead = owner === undefined ? undefined : ownerLeadLayout(slot);
  const textX = lead?.textX ?? slot.textX;
  const said = faceTextWithNamePills(gameData, {
    ...withoutFace(owner?.dog, line),
    ...(line.names === undefined ? {} : { names: line.names }),
  });
  const box = inlineFaceBox(body, MESSAGE_STRIP.scale);
  const rows = messageRows(
    (run) => painter.width(MESSAGE_STRIP.scale, run),
    box,
    lead?.room ?? slot.room,
    owner === undefined ? "icon" : "owner",
    said,
  );
  const place = linePlace(body, bars, rows.length);
  const view = painter.group(depth);
  view.panel(lead === undefined ? place.panel : ownerLeadPanel(place.panel, lead), {
    key: "ui-panel",
    kind: "image",
    native: { height: 24, width: 24 },
    slices: SLICES["ui-panel"],
  });
  if (owner !== undefined && lead !== undefined) {
    const speaker = view.element.ownerDocument.createElement("span");
    speaker.className = "visually-hidden";
    speaker.textContent = `${gameData.dogs[owner.dog].owner.name}: `;
    view.element.append(speaker);
    view.panel(lead.frame, undefined, { border: PALETTE.ink, fill: PALETTE.tan });
    view.art({
      at: { x: lead.frame.x + 1, y: lead.frame.y + 1 },
      clock: "now",
      key: ownerFaceKey(gameData, owner.dog),
      loop: true,
      projection: "layout",
      tags: [owner.mood, "neutral"],
    });
  } else if (typeof line.lead === "string") {
    view.art({
      at: place.icon,
      image: { height: MESSAGE_STRIP.icon.size, width: MESSAGE_STRIP.icon.size },
      key: line.lead,
      projection: "layout",
    });
  }
  view.faceRows({ capsTop: place.capsTop, x: textX }, box, MESSAGE_STRIP.scale, PALETTE.plum, rows);
  return { bars, id: line.id, view };
}
