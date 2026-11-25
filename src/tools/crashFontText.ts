import { MENU_TEXT } from "../data/menuText.ts";

// Printable ASCII, U+0020 to U+007E.
export const PRINTABLE_ASCII = String.fromCharCode(
  ...Array.from({ length: 0x7f - 0x20 }, (_, index) => 0x20 + index),
);

// The text the crash screen's body font (Tiny5, subset by src/tools/crashFontPlugin.ts) keeps
// glyphs for: the crash screen's words, and printable ASCII for the kit's details words and an
// error message. The build fails when the font lacks one of them; any other character falls back
// to ui-monospace.
export const CRASH_FONT_TEXT: readonly string[] = [
  ...Object.values(MENU_TEXT.crash),
  PRINTABLE_ASCII,
];
