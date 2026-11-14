// Draw the Distillery District's and Kensington Market's own road art: their card obstacles with
// the hit bursts, hit sounds and card illustrations that go with them, and their minor obstacles.
//
// Distillery District:
//
// cheese-crates       48x48   card obstacle, 1 lane, in Kensington Market too: a cheesemonger's slatted
//                             crate set out at the shop door, two golden wheels stacked at the back left,
//                             a cut wheel stood on its edge at the right showing its yellow paste, a blue
//                             cheese wedge in front and a chalk price tag hung on the crate. idle (4
//                             frames, 350ms): three stink wisps rise a quarter wave a frame
// wedding-photo-shoot 112x72  card obstacle, 2 lanes: a bride posing in a white gown and veil with a
//                             bouquet in the left lane; in the right lane a photographer in black
//                             kneels facing her, a camera with a flash on top raised to his eye, a
//                             silver reflector on a stand behind him. idle (4 frames, 400ms): the
//                             bride breathes on frames 1 and 3, the flash fires on frame 2
// velvet-rope         112x36  minor, 2 lanes: three brass stanchions on round bases, a red velvet rope
//                             swagged between them. idle (4 frames, 400ms): a glint runs down the left
//                             post's highlight on frames 2 and 3
// rolling-barrel      48x48   minor dart, 1 lane: a whisky barrel on its side rolling across the lanes,
//                             seen end-on, its dark oak staves, pale repair plank and bung turning inside
//                             an iron hoop; rolls right, the game mirrors it for left. idle (2 frames,
//                             400ms): resting, rocking 15 degrees; run (8 frames, 60ms): a full turn, 45
//                             degrees a frame, a puff of dust kicked up behind it
// barrel-stack        48x48   minor, 1 lane: three whisky barrels stacked as a pyramid on a tan pallet,
//                             lying on their sides with their plank-built oak heads to the camera, each
//                             in a silver hoop over a recessed dark chime, the brown bodies showing
//                             above the heads, bark wedges chocking the bottom two. idle (4 frames,
//                             400ms): a glint runs down the top barrel's hoop on frames 2 and 3
// art-sculpture       48x48   minor, 1 lane: three closed wooden shipping crates, two wide boxes at the
//                             base and one centred above, with broad light tops, brown plank fronts,
//                             dark side planes and bold timber braces. idle (4 frames, 400ms): a
//                             restrained glint crosses the top crate's metal corner on frames 2 and 3
//
// Kensington Market:
//
// green-bin-spill     48x48   card obstacle, 1 lane: a Toronto green bin knocked over onto its front,
//                             seen side on, its lid propped open up and back off the mouth, a wheel up
//                             in the air at the bottom's back corner, scraps, a lettuce leaf and a
//                             banana peel spilling out across the road. idle (4 frames, 350ms): the lid
//                             rocks up 1px on frame 2
// produce-crates      48x48   minor, 1 lane: three blue plastic crates set down in the road, two stacked
//                             on the left with tomatoes heaped on top and one on the right of upright
//                             bok choy, with no awning, posts or wheels. idle (4 frames, 400ms): the
//                             middle bok choy lifts 1px on frame 2
// clothing-rack       48x48   minor, 1 lane: a rolling rack of vintage clothes on chrome uprights and
//                             casters: a mustard corduroy jacket, a plain lilac dress, a denim jacket
//                             and a striped tee. idle (4 frames, 450ms): the dress sways 1px on frame 2
// market-stall-2      112x48  minor, 2 lanes: a flea market's folding tables, one per lane, under a
//                             faded teal and cream striped awning with a deep scalloped hem on thin
//                             coal poles, open air between the hem and the goods; each clay table
//                             stands on crossed legs, laid with chunky goods: a crate of records with a
//                             black record stood up (lilac label, left out at @69 and smaller, where it
//                             would fill the disc), folded clothes, book spines, glass jars and a lidded
//                             box. idle (4 frames, 500ms): the hem's middle half lifts 1px on frame 2
// market-stall-3      176x48  minor, 3 lanes: the same stall, a table wider
// cargo-bike          48x72   minor mover, 1 lane by 2 rows: a cargo bike riding down a lane at the
//                             pack, facing it: a wooden box of sunflowers and pink tulips out front over
//                             a small front wheel with a lit headlamp on its fork, its rider behind in a
//                             rust beanie and a turquoise jacket; the box hides the legs. ride (4
//                             frames, 100ms): the rider sways 1px over the bars, the flowers jiggle and
//                             a tread line rolls down the tire
//
// fx-hit-cheese-crates 77x77  play (8 frames, 70ms): a gold impact star, then a puff of lime stink
//                             swelling up and shrinking away as the cut wheel bounces up out of it and
//                             rolls off right, a quarter turn a frame, crumbs flying and wisps rising
// fx-hit-wedding-photo-shoot 77x77  play (8 frames, 70ms): a lilac impact star, then a camera flash
//                             flaring and fading while the bouquet flies up out of it, tumbling, and
//                             petals scatter and drift down
// fx-hit-green-bin-spill 77x77  play (8 frames, 70ms): a green impact star, then a comic splat of olive
//                             slop swelling and shrinking, drops flying off its arms, the banana peel
//                             flung up out of it tumbling over, scraps thrown out either side
// sfx-hit-cheese-crates 0.40s a soft wooden thunk, a squish, then a rising plop that sags as it settles
// sfx-hit-wedding-photo-shoot 0.58s a flash charging up, the shutter's double click, then a triangle
//                             "ding dong" of wedding bells
// sfx-hit-green-bin-spill 0.44s  a hollow plastic thunk, the lid clattering down in three shrinking
//                             knocks, then a soft squelch and a gloop
//
// Cards (75x56), one per option, composed from the sprites above and the pack's exports:
// card-cheese-crates-sniff, -buy and -hurry-on at a brick shopfront's wooden door, which fits both the
// neighbourhoods it stands in; card-wedding-photo-shoot-pose, -walk-around and -reshoot on the
// Distillery District's road; card-green-bin-spill-hurry-past, -pay and -wade-through on Kensington
// Market's, the last with Archie wading through the bin's slop, the banana peel on his head. The paid
// options show a bill (icon-bill) changing hands: the photographer reaching out to take it, the
// cheesemonger in an ochre shirt and white apron and the shopkeeper in a lilac shirt and cream apron,
// broom in hand, holding it up.
//
// The road sprites take the road outline rule (pixel.ts's roadEdge) and road.ts's LIT rim on their
// dark colours, so their silhouettes hold 3:1 on every road. People, movers and the card obstacles are
// laid out on the 32-unit design grid (the wedding photo shoot on 224/3 x 48 units, two lanes) and
// drawn road.ts's SCALE (1.5) times bigger on a mini.ts Mini; the minor obstacles are laid out in
// obstacles.ts's layout pixels (40 for one lane, 30 rows for a lane-spanning one, 40 for the market
// stall) and drawn obstacles.ts's SCALE (1.2) times bigger. Each has <key>@<step> for every depth
// step in mini.ts's STEPS, redrawn the same way at its scale times the step, with the original's
// tags, frames and durations and a full outline. 1px motions are in drawn pixels, so they stay 1px at
// every step. The hit bursts follow hits.ts: a 64-unit design drawn 77/64 times bigger, a plum rim
// round each part.
//
// Run from the repository root. A build overwrites the exports, so hand edits to them belong in
// this file instead. Shared tooling is in pixel.ts.
import { command } from "./hood_markets/entry.ts";

if (import.meta.main) {
  await command();
}
