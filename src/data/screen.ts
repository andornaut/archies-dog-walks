import { HUD_REGIONS, TOP_BAR_HEIGHT } from "./layout.ts";

export interface ScreenConfig {
  backdropHeight: number;
  dogCardHeight: number;
  dogRowHeight: number;
  dogSlotCount: number;
  height: number;
  junctionRows: number;
  roadIntoBand: number;
  roadWidth: number;
  topBarHeight: number;
  width: number;
  zoneProgressHeight: number;
}

// Internal render resolution: portrait, scaled to the window without smoothing. The walk bar,
// the dog card row and the progress line take their sizes from src/data/layout.ts.
// The backdrop band ends backdropHeight rows under the walk bar, and its bottom rows,
// roadIntoBand, are the approach the backdrop paints; the camera derives from the band. Over the
// approach, the junctionRows rows up to the cross street are the near corners' curb and sidewalk,
// which the road crosses to meet the cross street (the cross street's near lane ends on the row
// above them, CROSS_STREET.nearLane in src/layout/crossStreet.ts). The
// neighbourhood's progress line takes the screen's last zoneProgressHeight rows: its borders
// and a row per fill colour (ZONE_PROGRESS in src/hud/walkHud.ts).
export const SCREEN_CONFIG: ScreenConfig = {
  backdropHeight: 158,
  dogCardHeight: HUD_REGIONS.dogCardHeight,
  dogRowHeight: HUD_REGIONS.dogRowHeight,
  dogSlotCount: HUD_REGIONS.dogSlotCount,
  height: 560,
  junctionRows: 5,
  roadIntoBand: 19,
  roadWidth: 320,
  topBarHeight: TOP_BAR_HEIGHT,
  width: 360,
  zoneProgressHeight: HUD_REGIONS.zoneProgressHeight,
};

export const LANE_COUNT = 5;

// The scale of the pseudo-3D road's far edge, on the backdrop band's bottom edge, whatever the
// speed, so the backdrops, drawn to continue the road at their bottom row, keep their join
// (ROAD_CAMERA in src/layout/screen.ts).
export const ROAD_FAR_SCALE = 0.5;
