import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { debuffIconKey } from "../../assets/index.ts";
import type { DebuffId } from "../../data/ids.ts";
import { gameData, SLICES } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../layout/index.ts";
import {
  effectIconFallback,
  type EffectItem,
  effectItems,
  effectItemsKey,
  hudEffectIconKey,
  spareTreatWell,
} from "../../presentation/effectIcons.ts";
import { currentZone, debuffLasting, read } from "../../rules/index.ts";
import type { RunState } from "../../state/index.ts";
import { lineInk } from "../../ui/lineInk.ts";
import { PALETTE } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { pressedEffectWells } from "../../ui/topSection.ts";
import {
  DEBUFF_BAR,
  debuffBarRects,
  debuffTrackLayout,
  debuffTrackStyle,
  spareTreatPipAt,
  WALK_BAR,
  walkBarLayout,
  zoneProgressLayout,
  zoneProgressText,
  zoneShare,
} from "../walkHud.ts";
import { zonePillLayout } from "../zonePill.ts";
import type { HudMoment, HudMomentPainter } from "./hudMoments.ts";
type DebuffColours = Readonly<
  Record<
    DebuffId,
    {
      face: number;
      fill: number;
      name: number;
      shade: number;
    }
  >
>;
// Persistent native chrome reads existing HUD layouts; scene clocks own animated feedback.
export function createHudChrome(
  painter: HudMomentPainter,
  // The walk bar's own marks: its effect icons.
  barPainter: HudMomentPainter,
  colours: DebuffColours,
) {
  const groups = new Map<string, HudMoment>();
  const replace = (key: string, depth: number, draw: (group: HudMoment) => void, onBar = false) => {
    groups.get(key)?.dispose();
    const group = (onBar ? barPainter : painter).group(depth, "now");
    groups.set(key, group);
    draw(group);
    return group;
  };
  const solid = (group: HudMoment, colour: number, rect: Rect) =>
    group.panel(rect, undefined, { border: colour, fill: colour });
  const band = SCREEN_LAYOUT.dogRow;
  replace("band", 0, (group) => {
    if (painter.hasArt("ui-dog-card-band")) {
      group.art({
        at: { x: band.x, y: band.y + band.height - 76 },
        image: { height: 76, width: 360 },
        key: "ui-dog-card-band",
        projection: "layout",
      });
    } else {
      solid(group, PALETTE.darkBrown, band);
    }
  });
  let barsKey = "",
    fillsKey = "",
    zoneKey = "",
    effectsKey = "",
    progressWidth = -1;
  let bars: {
    debuff: DebuffId;
    rect: Rect;
  }[] = [];
  const body = painter.fonts.body;
  const inkOf = (text: string) => {
    const { bottom, left, right, top } = lineInk(body, text);
    return { bottom, top, width: right - left };
  };
  const nameWidth = Math.max(
    0,
    ...Object.values(gameData.debuffs).map(({ name }) => inkOf(name).width),
  );
  const capitalsTop = (name: string, bar: Rect) => {
    const ink = inkOf(name);
    return bar.y + Math.round((DEBUFF_BAR.faceHeight - (ink.bottom - ink.top)) / 2) - ink.top;
  };
  return {
    bars: () => bars,
    dispose: () => {
      groups.forEach((group) => group.dispose());
      groups.clear();
    },
    // pressedEffect: the effect well a press is down on, whose icon and pip dip with it.
    update(pressedEffect: number | undefined, run: RunState) {
      const debuffs = run.debuffs.map(({ debuff }) => debuff);
      if (debuffs.join() !== barsKey) {
        barsKey = debuffs.join();
        const rects = debuffBarRects(SCREEN_LAYOUT.topBar, debuffs.length);
        bars = debuffs.flatMap((debuff, i) =>
          rects[i] === undefined ? [] : [{ debuff, rect: rects[i]! }],
        );
        replace("bars", 0, (group) =>
          bars.forEach(({ debuff, rect }) => {
            const rim = DEBUFF_BAR.rim;
            const style = debuffTrackStyle(colours[debuff]);
            const { frame, track } = debuffTrackLayout(style, nameWidth, rect, 0);
            solid(group, colours[debuff].face, { ...rect, height: DEBUFF_BAR.faceHeight });
            solid(group, colours[debuff].shade, {
              ...rect,
              height: rim,
              y: rect.y + DEBUFF_BAR.faceHeight,
            });
            solid(group, PALETTE.ink, { ...rect, height: rim, y: rect.y + rect.height - rim });
            // The track's rim leaves its corners out.
            solid(group, style.frame, { ...track, height: frame.height, y: frame.y });
            solid(group, style.frame, { ...track, width: frame.width, x: frame.x });
            solid(group, style.track, track);
            group.art({
              at: { x: rect.x + DEBUFF_BAR.icon.x, y: rect.y + DEBUFF_BAR.icon.y },
              image: { height: DEBUFF_BAR.icon.size, width: DEBUFF_BAR.icon.size },
              key: debuffIconKey(debuff),
              projection: "layout",
            });
            group.text({
              anchor: "ink",
              capTop: capitalsTop(gameData.debuffs[debuff].name, rect),
              colour: colours[debuff].name,
              font: "body",
              lines: [gameData.debuffs[debuff].name],
              scale: TEXT_SCALE,
              x: rect.x + DEBUFF_BAR.name.x,
            });
          }),
        );
      }
      const tracks = bars.map(({ debuff, rect }) => {
        const active = run.debuffs.find((entry) => entry.debuff === debuff)!;
        const { seconds } = gameData.debuffs[debuff];
        const lasting = Math.max(
          read(gameData.tuning, "seconds", seconds),
          debuffLasting(gameData.tuning, seconds, run).secondsLeft,
        );
        const style = debuffTrackStyle(colours[debuff]);
        const share = lasting > 0 ? active.secondsLeft / lasting : 0;
        return { layout: debuffTrackLayout(style, nameWidth, rect, share), style };
      });
      const fillKey = `${barsKey}:${tracks.map(({ layout }) => layout.fills[0]?.width).join()}`;
      if (fillsKey !== fillKey) {
        fillsKey = fillKey;
        replace("fills", 1, (group) =>
          tracks.forEach(({ layout, style }) =>
            layout.fills.forEach((fill, i) => {
              if (fill.width > 0) {
                solid(group, style.fills[i]!, fill);
              }
            }),
          ),
        );
      }
      // Keyed on the texts drawn, so a live neighbourhood switch, which keeps the slot, renames it.
      const name = currentZone(gameData, run).name,
        count = zoneProgressText(gameData, run.zoneIndex);
      const currentZoneKey = `${name}:${count}:${run.debuffs.length}`;
      if (zoneKey !== currentZoneKey) {
        zoneKey = currentZoneKey;
        const ink = { count: inkOf(count), name: inkOf(name) };
        const layout = zonePillLayout(
          SCREEN_LAYOUT.topBar,
          SCREEN_LAYOUT.screen,
          debuffs.length,
          ink,
        );
        replace("zone", -3, (group) => {
          group.panel(layout.pill, {
            key: "ui-zone-pill",
            kind: "image",
            native: { height: 13, width: 13 },
            slices: SLICES["ui-zone-pill"],
          });
          // Each text's ink is centred on its part of the pill (backing).
          group.text({
            anchor: "ink",
            backing: {
              height: layout.pill.height,
              width: ink.name.width,
              x: layout.nameLeft,
              y: layout.pill.y,
            },
            capTop: layout.pill.y,
            colour: PALETTE.cream,
            font: "body",
            lines: [name],
            scale: TEXT_SCALE,
            x: layout.nameLeft,
          });
          group.text({
            anchor: "inkRight",
            backing: {
              height: layout.pill.height,
              width: ink.count.width,
              x: layout.countRight - ink.count.width,
              y: layout.pill.y,
            },
            capTop: layout.pill.y,
            colour: PALETTE.lightGrey,
            font: "body",
            lines: [count],
            scale: TEXT_SCALE,
            x: layout.countRight,
          });
        });
      }
      const progress = zoneProgressLayout(SCREEN_LAYOUT.zoneProgress, zoneShare(gameData, run));
      const width = progress.fills[0]?.width ?? 0;
      if (width !== progressWidth) {
        progressWidth = width;
        replace("progress", 0, (group) => {
          solid(group, PALETTE.ink, progress.frame);
          solid(group, PALETTE.darkSlate, progress.track);
          progress.fills.forEach(({ colour, ...rect }) => solid(group, PALETTE[colour], rect));
        });
      }
      const effects = effectItems(gameData, run),
        spare = spareTreatWell(effects, run);
      const key = `${effectItemsKey(effects)}:${spare}:${pressedEffect}`;
      if (effectsKey !== key) {
        effectsKey = key;
        replace(
          "effects",
          0,
          (group) => {
            const effectWells = pressedEffectWells(
              walkBarLayout(SCREEN_LAYOUT.topBar, effects.length).effectWells,
              pressedEffect,
            );
            effects.forEach((item: EffectItem, index) => {
              const well = effectWells[index];
              if (well === undefined) {
                return;
              }
              const key = hudEffectIconKey(item);
              if (barPainter.hasArt(key)) {
                group.art({
                  at: { x: well.x + WALK_BAR.effects.icon, y: well.y + WALK_BAR.effects.icon },
                  image: { height: WALK_BAR.effects.iconSize, width: WALK_BAR.effects.iconSize },
                  key,
                  projection: "layout",
                });
              } else {
                group.text({
                  anchor: "centre",
                  backing: well,
                  capTop: well.y,
                  colour: PALETTE.cream,
                  font: "body",
                  lines: [effectIconFallback(gameData, item)],
                  scale: 1,
                  x: well.x + well.width / 2,
                });
              }
            });
            const well = effectWells[spare];
            if (well !== undefined) {
              group.art({
                at: spareTreatPipAt(well),
                key: "treat@50",
                projection: "layout",
                still: true,
                tags: ["idle"],
              });
            }
          },
          true,
        );
      }
    },
  };
}
