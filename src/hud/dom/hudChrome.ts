import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics, laidGlyphs } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { debuffIconKey } from "../../assets/iconKeys.ts";
import { gameData } from "../../data/index.ts";
import { SLICES } from "../../data/layout.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import type { DebuffId } from "../../data/types.ts";
import { debuffLasting } from "../../rules/durations.ts";
import { currentZone } from "../../rules/route.ts";
import { read } from "../../rules/units.ts";
import type { RunState } from "../../state/runState.ts";
import { PALETTE } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import {
  effectIconFallback,
  type EffectItem,
  effectItems,
  effectItemsKey,
  hudEffectIconKey,
  spareTreatWell,
} from "../effectIcons.ts";
import {
  DEBUFF_BAR,
  debuffBarFill,
  debuffBarRects,
  debuffFillWidth,
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
  const inkWidth = (text: string) => {
    const ink = laidGlyphs(painter.fonts.body, 1, text).flatMap(({ ink }) =>
      ink === null ? [] : [ink],
    );
    return ink.length === 0
      ? 0
      : Math.max(...ink.map((rect) => rect.right)) - Math.min(...ink.map((rect) => rect.left));
  };
  const body = painter.fonts.body;
  const names = Object.values(gameData.debuffs).map(({ name }) => name);
  const nameWidth = Math.max(
    0,
    ...names.map((name) => {
      const ink = laidGlyphs(body, TEXT_SCALE, name).flatMap(({ ink }) =>
        ink === null ? [] : [ink],
      );
      return ink.length === 0
        ? 0
        : Math.max(...ink.map(({ right }) => right)) - Math.min(...ink.map(({ left }) => left));
    }),
  );
  const capitalsTop = (name: string, bar: Rect) => {
    const glyphs = [...name].flatMap((char) => {
      const glyph = body.glyphs.get(char);
      return glyph === undefined || glyph.height === 0 ? [] : [glyph];
    });
    const top =
      glyphs.length === 0 ? 0 : Math.min(...glyphs.map(({ yOffset }) => yOffset)) * TEXT_SCALE;
    const bottom =
      glyphs.length === 0
        ? 0
        : Math.max(...glyphs.map(({ height, yOffset }) => yOffset + height)) * TEXT_SCALE;
    return (
      bar.y +
      Math.round((DEBUFF_BAR.faceHeight - (bottom - top)) / 2) +
      fontMetrics(body).capTop * TEXT_SCALE -
      top
    );
  };
  return {
    bars: () => bars,
    dispose: () => {
      groups.forEach((group) => group.dispose());
      groups.clear();
    },
    update(run: RunState) {
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
            const fill = debuffBarFill(nameWidth, rect);
            solid(group, colours[debuff].face, { ...rect, height: DEBUFF_BAR.faceHeight });
            solid(group, colours[debuff].shade, {
              ...rect,
              height: rim,
              y: rect.y + DEBUFF_BAR.faceHeight,
            });
            solid(group, PALETTE.ink, { ...rect, height: rim, y: rect.y + rect.height - rim });
            solid(group, PALETTE.ink, { ...fill, height: fill.height + 2 * rim, y: fill.y - rim });
            solid(group, PALETTE.ink, { ...fill, width: fill.width + 2 * rim, x: fill.x - rim });
            solid(group, colours[debuff].shade, fill);
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
      const widths = bars.map(({ debuff, rect }) => {
        const active = run.debuffs.find((entry) => entry.debuff === debuff)!;
        const { seconds } = gameData.debuffs[debuff];
        return debuffFillWidth(
          debuffBarFill(nameWidth, rect),
          active.secondsLeft,
          Math.max(
            read(gameData.tuning, "seconds", seconds),
            debuffLasting(gameData.tuning, seconds, run).secondsLeft,
          ),
        );
      });
      const fillKey = `${barsKey}:${widths.join()}`;
      if (fillsKey !== fillKey) {
        fillsKey = fillKey;
        replace("fills", 1, (group) =>
          bars.forEach(({ debuff, rect }, i) => {
            const width = widths[i] ?? 0;
            if (width > 0) {
              solid(group, colours[debuff].fill, {
                ...debuffBarFill(nameWidth, rect),
                width,
              });
            }
          }),
        );
      }
      const currentZoneKey = `${run.zoneIndex}:${run.debuffs.length}`;
      if (zoneKey !== currentZoneKey) {
        zoneKey = currentZoneKey;
        const name = currentZone(gameData, run).name,
          count = zoneProgressText(gameData, run.zoneIndex);
        const layout = zonePillLayout(SCREEN_LAYOUT.topBar, SCREEN_LAYOUT.screen, debuffs.length, {
          count: inkWidth(count),
          name: inkWidth(name),
        });
        replace("zone", -3, (group) => {
          group.panel(layout.pill, {
            key: "ui-zone-pill",
            kind: "image",
            native: { height: 13, width: 13 },
            slices: SLICES["ui-zone-pill"],
          });
          group.text({
            anchor: "ink",
            capTop: layout.capsY,
            colour: PALETTE.cream,
            font: "body",
            lines: [name],
            scale: 1,
            x: layout.nameLeft,
          });
          group.text({
            anchor: "inkRight",
            capTop: layout.capsY,
            colour: PALETTE.lightGrey,
            font: "body",
            lines: [count],
            scale: 1,
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
      const key = `${effectItemsKey(effects)}:${spare}`;
      if (effectsKey !== key) {
        effectsKey = key;
        replace(
          "effects",
          0,
          (group) => {
            const { effectWells } = walkBarLayout(SCREEN_LAYOUT.topBar, effects.length);
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
