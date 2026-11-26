import { ROAD_FAR_SCALE, SCREEN_CONFIG } from "../data/index.ts";
import { TUNING } from "../data/tuning.ts";
import { roadCameraFor } from "./projection.ts";
import { screenLayout, walkerFootY } from "./screenLayout.ts";

// The screen's regions, laid out for SCREEN_CONFIG.
export const SCREEN_LAYOUT = screenLayout(SCREEN_CONFIG);

// The pseudo-3D road's camera: the screen row the road's vanishing point sits on, and the
// ground's screen speed at the walker's feet relative to sprite scale there. The road's far
// edge, on the backdrop band's bottom edge, is at scale ROAD_FAR_SCALE whatever the speed. The
// rest of the camera derives from the band's bottom edge and the walker's feet.
const { road } = SCREEN_LAYOUT;
export const ROAD_CAMERA = roadCameraFor({
  farScale: ROAD_FAR_SCALE,
  farY: road.y,
  footY: walkerFootY(road),
  visibleDistance: TUNING.seconds.lookAheadSeconds * TUNING.pixels.roadScrollSpeed,
});
