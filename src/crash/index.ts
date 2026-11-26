// The public entry of src/crash/, which installs the page's crash screen as it loads.
// src/startup.ts imports this module first: modules run in import order, a module's own imports
// first, so the crash screen listens before any game module runs, and an error thrown while one
// loads shows it rather than a blank page. The modules the screen imports, and every module their
// area entries re-export, run before it installs; they only declare values.
export { CRASH_SCREEN } from "./crashScreen.ts";
