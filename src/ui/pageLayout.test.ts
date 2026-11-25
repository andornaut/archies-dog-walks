import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { modalFrameRooms, placeModalFrame } from "@andornaut/game-kit/runtime/ui/modalFrame";
import { expect, it } from "vitest";

import { fontFileMetrics, gameFont } from "../testing/fontInk.ts";
import { modalTitleInk } from "./modal/titleRole.ts";
import { PAGE_FRAME, pageBack } from "./pageLayout.ts";

const MEASURE = {
  inkWidth: (_font: string, line: string) => line.length * 7,
  title: fontFileMetrics("font-title"),
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
};

// The page draws Back's face and label from pageBack's rect in the button the kit's footer
// action group places, so the two must agree for an odd and an even face width.
it.each(["Back", "Backs"])(
  "puts the %s face where the page frame's kit footer places it",
  (label) => {
    const back = pageBack(MEASURE, label);
    const frame = placeModalFrame(PAGE_FRAME.context, {
      body: 0,
      footer: back.rect.height,
      title: PAGE_FRAME.title,
    });
    const [action] = arrangeActions(
      {
        origin: frame.footer!,
        press: { margin: 0 },
        variant: "footer",
        width: modalFrameRooms(PAGE_FRAME.context).footer,
      },
      [{ key: 0, role: "primary", size: back.rect }],
    ).actions;
    expect(action).toMatchObject({
      face: back.rect,
      hidden: false,
      outset: { bottom: 0, left: 0, right: 0, top: 0 },
    });
  },
);
