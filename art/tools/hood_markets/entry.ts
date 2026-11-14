import { build as buildSprites, main } from "../pixel.ts";
import { buildCards, cardPreview } from "./cards.ts";
import { sprites } from "./registration.ts";
import { renderSounds } from "./sounds.ts";

const USAGE = `Usage:
  node art/tools/hood_markets.ts preview OUT.png   every frame of every sprite on the zone roads
  node art/tools/hood_markets.ts cards OUT.png     every card illustration inside its card frame, 3x
  node art/tools/hood_markets.ts sounds OUT_DIR    write the sounds' .ogg and .m4a files into OUT_DIR
                                                   only
  node art/tools/hood_markets.ts build             export the sprites to public/art/sprites/, then
                                                   the cards to public/art/images/, then the sounds
                                                   to public/art/sounds/`;

async function command(): Promise<void> {
  await main({
    commands: {
      build: async () => {
        await buildSprites({}, sprites());
        await buildCards();
        renderSounds("public/art/sounds");
      },
      "cards OUT.png": (out) => cardPreview(out),
      "sounds OUT_DIR": (dir) => renderSounds(dir),
    },
    doc: USAGE,
    sprites,
  });
}

export { command };
