#!/usr/bin/env python3
"""Draw the four pack-level contact-debuff effects around each member's feet.

fx-debuff-muddy, -spotlight, -stinky and -zoomies are 60x36, with play frames
0 to 11 at 100ms each, played once (1200ms). Frame 4 is the reduced-motion
pose. Each member has one copy: walker and visible dogs, anchored at (30,30)
on (feetX, feetY-1), origin (0.5,5/6). Display at 1.5x (90x54), with the
displayed anchor at (45,45). Follow their feet for the whole cue.
Draw above ground shadows and below all actors and leashes (road depth 9.5),
clipped to the road viewport. These ground effects never float above a head;
the separate acquisition icon appears above the lead dog.

The broad mud splats, low gas clouds, rushing arcs and pools of light use
the exact face, shade, fill and name colours from ui.DEBUFF_LOOKS, plus
the same ink edge as the bars. No recoloured icon is baked into a sprite.
The shared roadBanners.popUpArt notification draws the native 16px HUD icon
at 2x as a bare 32x32 image, with no plate. Its bottom starts 4px above the
actual lead dog's visible head. Snapshot the position, clamp to the viewport
and fade immediately over 1000ms without rising or following the pack, in
both motion modes. Only an effect actually acquired or refreshed shows this
notification and its matching sound, played once for the pack, never per member.

Usage:
  debuffs.py preview OUT.png   every frame on the neighbourhood roads
  debuffs.py build             write art/debuffs/*.aseprite and export
                              public/art/sprites/*.png and *.json

Run from the repository root. Edit this script, not the generated sources.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fx import rim  # noqa: E402
from pixel import Grid, main  # noqa: E402
from ui import DEBUFF_LOOKS  # noqa: E402

WIDTH, HEIGHT = 60, 36
FRAME_MS = 100
PEAK = 4
ENVELOPE = (0.72, 0.86, 0.96, 1, 1, 1, 0.98, 0.94, 0.84, 0.68, 0.48, 0.28)


def point(step, x, y):
    """Expand around the ground under the feet, never up toward a head."""
    s = ENVELOPE[step]
    return 30 + (x - 30) * s, 29 + (y - 29) * s


def oval(g, step, x, y, rx, ry, fill, shade=None, light=None):
    s = ENVELOPE[step]
    g.cel(*point(step, x, y), max(1.5, rx * s), max(1.5, ry * s), fill, shade, light)


def path(g, step, points, colour, width=2):
    points = [point(step, x, y) for x, y in points]
    for a, b in zip(points, points[1:]):
        n = max(1, math.ceil(max(abs(b[0] - a[0]), abs(b[1] - a[1]))))
        for k in range(n + 1):
            x, y = (a[i] + (b[i] - a[i]) * k / n for i in (0, 1))
            g.rect(round(x - width / 2), round(y - width / 2), width, width, colour)


def part(dst, draw):
    """A thin ink edge, matching the progress bar's edge, keeps low shapes readable."""
    g = Grid(WIDTH, HEIGHT)
    draw(g)
    rim(g, "ink")
    for y, row in enumerate(g.px):
        for x, c in enumerate(row):
            if c:
                dst.px[y][x] = c


def polygon(g, step, points, colour):
    """A filled shape expands with the same ground envelope as the curved marks."""
    points = [point(step, x, y) for x, y in points]
    for y in range(HEIGHT):
        for x in range(WIDTH):
            inside = False
            for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
                if (ay > y + 0.5) != (by > y + 0.5):
                    if x + 0.5 < (bx - ax) * (y + 0.5 - ay) / (by - ay) + ax:
                        inside = not inside
            if inside:
                g.p(x, y, colour)


def muddy(step):
    """A low wet pool and two outward splash fans leave the soles visible."""
    face, shade, light, _ = DEBUFF_LOOKS["muddy"]
    g = Grid(WIDTH, HEIGHT)
    lift = (0, 1, 2, 3, 3, 2, 1, 0, -1, -1, 0, 0)[step]

    def splash(p):
        oval(p, step, 30, 30, 26, 4, face, shade)
        for side in (-1, 1):
            x = 30 + side * 17
            oval(p, step, x, 28, 10, 5.5, face, shade)
            fan = [(x - side * 8, 30), (x - side * 5, 23),
                   (x - side * 3, 25), (x, 18 - lift),
                   (x + side * 3, 25), (x + side * 8, 21 - lift / 2),
                   (x + side * 6, 30)]
            polygon(p, step, fan, face)
            path(p, step, [(x - side * 6, 28), (x, 25),
                          (x + side * 5, 26)], light, 3)
            path(p, step, [(x, 23), (x, 20 - lift)], light, 2)
        path(p, step, [(14, 31), (22, 30), (38, 30), (46, 31)], light, 2)

    part(g, splash)
    for side in (-1, 1):
        x = 30 + side * 25
        part(g, lambda p, x=x: oval(p, step, x, 20 - lift, 2, 2.5, light, face))
    return g


def stinky(step):
    """Broad low mauve clouds carry pink curls beside the feet, never above a head."""
    face, shade, light, name = DEBUFF_LOOKS["stinky"]
    g = Grid(WIDTH, HEIGHT)
    rise = (0, 0, 1, 2, 2, 2, 3, 3, 3, 2, 1, 0)[step]
    for side in (-1, 1):
        x = 30 + side * 17
        sway = (0, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, 0)[step] * side

        def cloud(p):
            oval(p, step, x, 28, 10, 5, face, shade)
            oval(p, step, x + side * 5, 24 - rise / 2, 5, 5, face, shade, light)
            oval(p, step, x - side * 3, 23, 6, 5, face, shade, light)
            pts = [(x - side * 5, 28), (x - side * 7, 25),
                   (x - side * 4 + sway, 22), (x + side * 2 + sway, 22),
                   (x + side * 4 + sway, 19 - rise),
                   (x + side * 1 + sway, 16 - rise)]
            path(p, step, pts, light, 3)
            path(p, step, [(x - side * 1, 29), (x + side * 4, 28)], light, 2)
            if 2 <= step <= 7:
                path(p, step, [(x - side * 5, 25), (x - side * 3, 23)], name, 1)

        part(g, cloud)
    return g


def zoomies(step):
    """Broad green rushing crescents and yellow arrow tips turn around the ground footprint."""
    face, shade, light, _ = DEBUFF_LOOKS["zoomies"]
    g = Grid(WIDTH, HEIGHT)
    turn = -65 + step * 17
    for offset in (0, 180):
        angles = range(round(turn + offset), round(turn + offset + 112), 6)
        pts = [(30 + math.cos(math.radians(a)) * 24, 24 + math.sin(math.radians(a)) * 6)
               for a in angles]

        def rush(p):
            path(p, step, pts, shade, 6)
            path(p, step, [(x, y - 1) for x, y in pts], face, 4)
            path(p, step, [(x, y - 2) for x, y in pts[3:]], light, 2)
            x, y = pts[-1]
            a = math.radians(turn + offset + 112)
            dx, dy = -math.sin(a), math.cos(a)
            polygon(p, step, [(x + dx * 4, y + dy * 3),
                              (x - dx * 4 - dy * 4, y - dy * 3 + dx * 4),
                              (x - dx * 4 + dy * 4, y - dy * 3 - dx * 4)], light)

        part(g, rush)
    return g


def spotlight(step):
    """A broad blue pool with a yellow rim and low white light marks sits beneath the feet."""
    face, shade, light, name = DEBUFF_LOOKS["spotlight"]
    g = Grid(WIDTH, HEIGHT)

    def pool(p):
        oval(p, step, 30, 28, 27, 6.5, face, shade)
        oval(p, step, 30, 27, 22, 4.5, light)
        oval(p, step, 30, 26.5, 15, 2.5, face)
    part(g, pool)
    slide = (0, 2, 4, 6, 7, 7, 6, 4, 2, 0, -1, 0)[step]
    for side in (-1, 1):
        x = 30 + side * (16 + slide / 2)
        part(g, lambda p, x=x, side=side: path(p, step, [(x, 24), (x + side * 3, 18)], name, 3))
    return g


DEBUFFS = {"muddy": muddy, "spotlight": spotlight, "stinky": stinky, "zoomies": zoomies}


def sprites():
    for name, draw in DEBUFFS.items():
        yield f"fx-debuff-{name}", [("play", [draw(i).outlined(False) for i in range(len(ENVELOPE))], FRAME_MS)]


if __name__ == "__main__":
    main(sys.argv, sprites, "art/debuffs", __doc__)
