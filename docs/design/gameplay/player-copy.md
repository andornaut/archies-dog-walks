# Player copy

Exact text and names live in [game data](../../../src/data/). Use [home text](../../../src/data/homeText.ts) for picker, shop and detail copy, [menu text](../../../src/data/menuText.ts) for navigation and Settings, and [walk text](../../../src/data/runText.ts) for walk and results messages. [Quips](../../../src/data/quips.ts) and [walkers](../../../src/data/walkers.ts) hold their authored lines. [Help](../../../src/data/help.ts) and [hints](../../../src/data/hints.ts) supply teaching copy.

## Voice

- **Tone:** cozy, gentle and kid-friendly; the chaos is charming, the owners are dramatic, and no line mocks the player. Canadian spelling (colour, favourite, grey, neighbour), one name per thing (the walk's money is "cash"), spelled one way everywhere and never shortened in one place (a name shows whole at full size wherever it appears; one that fits nowhere it shows is renamed everywhere), ♥ right after its number ("+1♥", "{hearts}♥"), and no em dashes. Plain ASCII only, apart from ♥, · and the characters `src/ui/pixelFont.ts` maps (−, × and curly quotes): the pixel font has no other glyphs
- **Fit:** text never shrinks to fit. Every string is written to fit its box at that box's one text size; where a string can't be cut to fit, its box grows. Nothing steps a font down for a long line
- **Lengths:** icon-led message strip lines and first-time hints fit the strip's 2 rows at full size, with or without a debuff bar (312 px a row at 2×, about 36 characters); owner-led lines retain the same full-size text and grow to their measured row count; the walker's bubble about 30 characters a line, growing to fit its lines, with walker's lines, owner parting lines and notices at 2; card option names 1 to 4 words; hit labels one or two uppercase words with "!"
- **Walkers:** Ada calm and precise, Casey warm and encouraging, Mr. B easygoing, Trista sporty and quick
- **Owners** (each with 2 lines for each of happier, upset, fired and parting):
  - **Clare** (Lady): psychologist, quiet and friendly, gentle observations, a little shy
  - **Eve** (Ginger): YouTuber, everything is a video (vlog, views, subscribers)
  - **Gadget** (Penny): nervous but kind, double-checks everything, apologizes even when firing you
  - **Jason** (Buddy): lawn care pro, laid-back, yard talk (mowing, edging, weeds)
  - **Aunt Judy** (Sequoia): tennis star, older and athletic, tennis talk (aces, faults, match point)
  - **Kiwi** (Archie): unflappable grandmother, "dear" and "pet", offers cookies and tea
  - **Ralph** (Kilo): retired pilot, big and gruff, few words, flying talk (turbulence, landings, mayday)
  - **Ryan** (Reggie): engineer, practical, specs, structures and drawing boards
  - **Ms. Tara** (Pepe): dog-show judge, curt and formal, scores and deductions, a little French

## Lane-change wording

Players never see the word agility, only a percentage against the base, amount first, in the same words everywhere: walker cards say "+40% lane change speed" (Ada) or "+10% lane change speed" (Casey), Running shoes "+100% lane change speed", a small dog "+10% lane change speed" and a large dog "−10% lane change speed"; a walker at the base speed (Mr. B) shows no lane-change line.

## Card text

- **Card text:** effect text is generated from the effects, so a numeric value edit updates it with no text edit. Authored strings that state an amount in words (for example "a spare treat" or "First card") assume their tuning value, so changing that value needs a text edit too. Check the result in the [data export](../../../shared/export/game-data.json).

The authored options are in [encounters](../../../src/data/encounters.ts) and [upgrades](../../../src/data/upgrades.ts).
