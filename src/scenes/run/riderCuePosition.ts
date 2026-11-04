import type { Point } from "@andornaut/game-kit/rect";

// A pre-entry rider's cue stays visible in its lane until its body-following cue clears the road edge.
export function riderCuePosition(junctureY: number, lane: Point, body: Point | undefined): Point {
  const point = body !== undefined && body.y >= junctureY ? body : lane;
  return { x: Math.round(point.x), y: Math.max(junctureY, Math.round(point.y)) };
}
