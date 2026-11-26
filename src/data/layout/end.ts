import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

// End screen

export const END_SCREEN = {
  // The columns a label keeps left of its amount.
  amountGap: 8,
  // The badge strip, its bottom results.buttonGap over the return button.
  badges: { height: 92, width: 344, x: 8 },
  // The breakdown: the amounts' right edge, the labels' left edge, the line pitch, and the first
  // line's top under the panel's top.
  breakdown: { amountRight: 196, label: 40, pitch: 17, top: 42 },
  // The logo's top-left.
  logo: { x: 107, y: 2 } satisfies Point,
  // The results panel's base frame; complete owner rows fit within a bounded viewport.
  panel: { height: 301, width: 312, x: 24, y: 112 } satisfies Rect,
  // The panel's rows under the last owner's row.
  panelFoot: 8,
  // The most lines a closing line wraps onto.
  quipLines: 2,
  // An owner's row, from its top-left.
  quips: {
    // art: the bubble's frame rows; and its padding, width and left edge.
    bubble: { frame: { bottom: 3, top: 2 }, pad: 2, width: 244, x: 36 },
    // The face's top-left.
    face: { x: 291, y: 1 },
    // The gap between rows.
    gap: 2,
    // The owner's measured column and readable line pitch, and the clear rows over a line too wide
    // for the column, under the bubble.
    name: { linePitch: 20, room: 42, wideGap: 2 },
    // The name's first capitals' top.
    nameY: 37,
    // The rule over the first row: its rows above, width and left edge.
    rule: { above: 8, width: 288, x: 36 },
    // The tail's top-left.
    tail: { x: 279, y: 15 },
    // The text's right end in from the bubble's right.
    textRight: 6,
    // The text's left edge.
    textX: 42,
    // The well's side and top-left.
    well: { size: 34, x: 290, y: 0 },
  },
  // The owners' rows' top under the breakdown or the side column.
  quipsGap: 10,
  // The rows between the results and the return button, and under the returning group's feet.
  results: { buttonGap: 3, heroGap: 16 },
  // The return home: where feet end up, in pack order, and art: the lawn, path and step.
  returnHome: {
    dogs: [
      { x: 146, y: 106 },
      { x: 214, y: 105 },
      { x: 248, y: 108 },
    ],
    lawn: { height: 16, width: 360, x: 0, y: 96 },
    owners: [
      { x: 112, y: 110 },
      { x: 282, y: 110 },
      { x: 78, y: 110 },
    ],
    path: { height: 12, width: 24, x: 168, y: 100 },
    step: { height: 4, width: 32, x: 164, y: 96 },
    walker: { x: 180, y: 110 },
  },
  // The new-best ribbon's top-left.
  ribbon: { x: 144, y: 102 } satisfies Point,
  // fx-new-best's frame's offset from the ribbon.
  ribbonBurst: { dx: -12, dy: -14 },
  // The side column.
  side: {
    // TOTAL's band's padding round its ink.
    band: { padX: 4, padY: 1 },
    // The pitch between zone pips.
    pipPitch: 21,
    // The pips' top under the panel's top.
    pipsY: 60,
    // The column's right end.
    right: 320,
    // TOTAL's row's height.
    totalHeight: 12,
    // TOTAL's capitals' top under the panel's top.
    totalY: 81,
    // The column's left edge.
    x: 208,
  },
  // The title's capitals' top under the panel's top.
  titleY: 18,
} as const;
