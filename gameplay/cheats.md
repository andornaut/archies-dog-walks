# Cheats

The shared [Saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies: cheats exist only in browser tabs, never in an installed app, detected at runtime when the modal opens and again when an action runs. Settings is the only entry point; its Open Cheats button sits next to Back. The Dev panel below the game is gone.

## Modal

- **Size:** the Large width (328 px logical), clamped to the safe viewport, as tall as the viewport less its 16 px margins. The body scrolls and never pages; text stays full size.
- **Frame:** a fixed "Cheats" title with the X close control at the top, and a fixed primary Close at the bottom.
- **Order:** Run-only first (the FPS counter, This walk, then Walk setup), a divider, then Save-changing, headed "Writes your save and reloads", with Reset save last.
- **Controls:** toggles are On/Off rows like Settings; pickers are full-width rows; repeatable Add buttons are 128×48 px compact buttons, two to a row. This walk's rows are disabled, not hidden, outside a walk, so the list never shifts.

## Run-only

Run-only cheats never change the save. A walk with any gameplay cheat in use, from either list below, writes nothing to the save, as a replay does: no checkpoint, no banked earnings, no statistics, no records and no badges. Show hit boxes, Show dev stats and the FPS counter only draw, so they leave a walk's saving alone.

The **FPS counter** toggle (On or Off, Off by default) sits at the top of Run-only and applies at once. It is a device setting kept apart from the save, and shows frames per second in the bottom-right corner of the device viewport, inset from the safe area and drawn above everything, the letterbox bars included.

### This walk

Enabled only during a walk (through Pause, then Settings); none of them starts one.

- **Add $100:** adds $100 to this walk's earnings on every press.
- **Refill hearts:** sets every owner to their maximum hearts.
- **Grant upgrade:** one row per upgrade, adding it to this walk, and Grant all upgrades.
- **Apply debuff:** one row per debuff, applying it to the pack as contact would.
- **Finish this neighbourhood:** ends the current neighbourhood as if walked, at its fork or the walk's end.

### Walk setup

These apply from the next walk and last for the browser tab.

- **Start at:** the neighbourhood and route to start from.
- **Seed:** the walk's seed, with Copy run link to reproduce it.
- **Pocket item:** any Pocket item for the next walk, owned or not.
- **Invincible owners:** bumps and cards cost no hearts.
- **Movement speed:** slow, normal or fast.
- **Show hit boxes:** draws every hit box.
- **Show dev stats:** the walk overlay with the seed, neighbourhood, distance, speed, money, hearts and the neighbourhood clock.

## Save-changing

Each action writes the save at once and reloads to the Start screen. Unlocking content counts as no walk, earns no badge and marks nothing finished.

- **Add $500, Add $5,000 and Add $50,000:** add that amount to the bank on every press.
- **Unlock all walkers.**
- **Own all dogs.**
- **Own all dog slots.**
- **Own all gear.**
- **Unlock all:** all four of the above at once.
- **Show tips again:** clears the shown hints and whether Help has been seen.
- **Reset save:** after a confirmation, resets the save entirely, earned badges and every cheat grant included. Device settings stay.
