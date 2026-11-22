# Library animations (src/renderer/transit.js)

When **Play** is pressed in a library preview, the album comes out of its packaging and is carried to the player.
When the playlist is **cleared after Stop** (albums that are in the library), it goes back and the package leaves toward the Library button.
Timing: about 5 s out, about 4 s back (`T.begin(k)` scales every step). Click / Esc skips. Settings → General can turn them off.

## Common rules
- Real sizes, real thickness. Package and medium are 3D (CSS preserve-3d), seen at a slight angle so the edges show.
- The medium never "appears": it is lifted straight up / slid out in 3D first, then handed to a flat on-screen copy at the
  same on-screen rectangle (so there is no jump); on the way back it is carried to that same lifted spot and then lowered/slid in.
- The flat copy stays in front of the package (appended after it).
- Never fade a 3D holder directly (it flattens and back faces show through); `run.anim` moves holder opacity onto a `.tr-fade` wrapper.
- Players expose `recordRect()`, `recordCanvas()`, `hideRecord(h)` (opacity, not visibility). Decks with their own loading animation
  also take `quiet = true` before `setAlbum` and provide `prepArrive/finishArrive` and `prepTake/finishTake`.

## Per format
| Format | Package | Opening | Out | Back |
|---|---|---|---|---|
| Vinyl 12" | jacket, 4 mm | — | record slides out the right side | slides back in, jacket exits |
| Vinyl 7" | paper sleeve | — | out the top | in the top |
| CD 5" | jewel case 142 x 125 x 10.2 mm, disc 1.2 mm | lid swings open to the left on its hinge (booklet left, tray right) | disc rises off the hub, case closes and drops away | disc lowered onto the hub, lid closes |
| CD 3" | sleeve, no case overlay | — | out the top | in the top |
| Cassette | Norelco case 109 x 70 x 17 mm (tape 100.4 x 63.8 x 12) | shown **portrait**: J-card cover on the front, spine on the hinge edge, back flap on the back (short strip along the spine edge, or the whole back). Turns over, turns on its side, the clear pocket tips open on its hinge | **the back flap and the tape stay put** when the pocket opens; then the tape slides out from under the flap | tape slides back under the flap, pocket closes, case turns back to portrait |
| Microcassette | case 2 3/16 x 1 1/2 x 1/2 in (tape 2 x 1 5/16 x 5/16 in) | same as cassette | same; lands lifted above the open compartment, deck slides it in and closes the door | deck opens the door and lifts the tape, then as cassette |
| MiniDisc, retail case | 3 1/3 x 4 5/16 x 5/8 in, opens like the CD jewel case (hinge left); disc (2 13/16 x 2 11/16 x 3/16 in) in the tray on the right | disc lifted out of the tray, case closes and drops away | the player slides the disc out of its bottom; it is lowered back into the tray |
| MiniDisc, slim case | 2 13/16 x 3 1/8 x 5/16 in, works like the cassette case (J-card wrapped round, pocket tips open, flap and disc stay put, disc slides out) | disc carried (turned upright) down to the bottom of the player, which slides it in and opens the slider | reverse |
| DAT | (to do) same as cassette with its own case | | | |
| Reel to reel | square card box 7.5 in square, 0.85 in deep (as the shelf); reel 178 mm, ~9 mm thick | full-depth lid with flaps over the top, right and bottom of the tray, hinged at the spine (left), opens to the left; reel lies in the right half | reel lifted straight up, box closes, reel set on the left spindle, then threaded | slack wound onto the album reel, tape off the guides, reel lifted off and lowered into the box |
