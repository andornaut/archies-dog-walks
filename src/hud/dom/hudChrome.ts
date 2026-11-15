import type { Rect } from "@andornaut/game-kit/rect";
import { laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";

import { debuffIconKey } from "../../assets/iconKeys.ts";
import { gameData } from "../../data/index.ts";
import { SLICES } from "../../data/layout.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import type { DebuffId } from "../../data/types.ts";
import { CHARM } from "../../layout/buffLayout.ts";
import { debuffLasting } from "../../rules/durations.ts";
import { currentZone } from "../../rules/route.ts";
import { read } from "../../rules/units.ts";
import type { RunState } from "../../state/runState.ts";
import { PALETTE } from "../../ui/palette.ts";
import {
  effectIconFallback,
  type EffectItem,
  effectItems,
  effectItemsKey,
  spareTreatWell,
  walkBarIconKey,
} from "../effectIcons.ts";
import {
  DEBUFF_BAR,
  debuffBarRects,
  debuffFillWidth,
  spareTreatPipAt,
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
    }
  >
>;
const BAR = walkBarLayout(SCREEN_LAYOUT.topBar);
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
            if (painter.hasArt("ui-debuff-bar")) {
              group.art({ at: rect, key: "ui-debuff-bar", tags: [debuff] });
            } else {
              solid(group, colours[debuff].face, rect);
            }
            group.art({
              at: { x: rect.x + DEBUFF_BAR.icon.x, y: rect.y + DEBUFF_BAR.icon.y },
              image: { height: 16, width: 16 },
              key: debuffIconKey(debuff),
            });
            group.text({
              anchor: "ink",
              capTop: rect.y + DEBUFF_BAR.name.y,
              colour: colours[debuff].name,
              font: "title",
              lines: [gameData.debuffs[debuff].name],
              scale: 1,
              x: rect.x + DEBUFF_BAR.name.x,
            });
          }),
        );
      }
      const widths = bars.map(({ debuff }) => {
        const active = run.debuffs.find((entry) => entry.debuff === debuff)!;
        const { seconds } = gameData.debuffs[debuff];
        return debuffFillWidth(
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
                ...DEBUFF_BAR.fill,
                width,
                x: rect.x + DEBUFF_BAR.fill.x,
                y: rect.y + DEBUFF_BAR.fill.y,
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
            effects.forEach((item: EffectItem, index) => {
              const well = BAR.effectWells[index];
              if (well === undefined) {
                return;
              }
              const key = walkBarIconKey(item);
              if (barPainter.hasArt(key)) {
                group.art({
                  at: { x: well.x + CHARM.icon, y: well.y + CHARM.icon },
                  image: { height: 20, width: 20 },
                  key,
                });
              } else {
                group.text({
                  anchor: "centre",
                  capTop: well.y + CHARM.size / 2 - 2,
                  colour: PALETTE.cream,
                  font: "body",
                  lines: [effectIconFallback(gameData, item)],
                  scale: 1,
                  x: well.x + CHARM.size / 2,
                });
              }
            });
            const well = BAR.effectWells[spare];
            if (well !== undefined) {
              group.art({
                at: spareTreatPipAt(well),
                key: "treat@50",
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
