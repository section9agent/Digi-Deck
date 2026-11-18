## Digi-Deck 0.1.0

A media player that plays your music on a **vinyl turntable**, a **CD player** or a **cassette deck**.

### Highlights
- **Mode picker** on launch; switch between Vinyl / CD / Cassette at any time (playback position carries over)
- **Vinyl** - 33⅓ rpm 12" records with one groove band per song, sized to the song's length; sides A/B taken from Discogs (or split by time); tonearm tracks the playing song; animated record flip between sides; single songs become 7" 45 rpm records with the adapter
- **CD** - clear-lid top loader, 5" disc (3" for singles) starting at 500 rpm and slowing to 200 rpm by the end; Compact Disc Digital Audio badge
- **Cassette** - full-view deck window, tape moves between reels with realistic speed changes, cassette lifts out and flips between sides
- **Library** - record-shelf view with front covers; each mode has its **own separate database** (vinyl.db, cd.db, cassette.db) so nothing is downloaded twice
- **Playlists** - m3u/m3u8, pls, xspf, wpl, zpl, asx, b4s, cue, jspf, mpcpl, or any folder (drag & drop works)
- **Art & metadata** - MusicBrainz + Cover Art Archive, Discogs, TheAudioDB, fanart.tv, iTunes, Deezer, plus images next to your music and embedded tag art
- **Editing** - edit every field, replace any of the five art slots, and pick the exact Discogs / MusicBrainz release when the wrong one is found

### Notes
- Discogs search needs a free personal access token (Settings). Everything else works without keys.
- Builds are unsigned: macOS users may need to right-click → Open; Windows may show SmartScreen.

## Visual & format update
- Vinyl: draggable/clickable tonearm (drop it anywhere on the record to seek, lift it off the record to stop); picture-disc option with grooves drawn over the art; selectable record colour; 12" and 7" records styled after real pressings; yellow 45 adapter; Technics-style deck; record always spins clockwise, also after a flip.
- 7" rules: 10 min per side max, grooves start at the outer edge and are not filled if shorter, max 2 songs, two songs = one per side.
- Release type (album / single / maxi single, up to 6 tracks) saved per database.
- CD: portable hi-fi player look, large LCD, volume rocker, CDDA logo, 3" disc when running time is 22 min or less.
- Cassette: hi-fi deck look, opaque/clear/smoke shells in any colour, partial tape load for singles with the Cassette Single sticker.
- Editors show only the artwork slots that apply (vinyl: no J-card; CD: front, back, disc label).
- New app icon.

## Realism pass
- Tonearm redrawn after the SL-1200 style arm: silver bowl base, gimbal yoke, counterweight, anti-skate dial, knurled collar, angled headshell with finger lift.
- 45 adapter is cut from the reference photo (transparent slots show the record through it).
- Cassette redrawn after the reference shell: dark case, cream label with stripes and writing lines, side tile, cream hubs, tape-view window that follows the real tape amount, bottom recess with holes and screws.
- CD player: lid removed, disc visible in the open well.
- Gaps between songs are subtler; a lead-out groove, locked groove and run-out area follow the last song.
- New "Clear" button unloads the current playlist; library has Select / Remove selected / Clear shelf.

## Library folder + per-format art
- Media library folder scan (Settings or shelf button), automatic on startup if enabled, with progress and cancel.
- Online lookups and art are now format-specific; the editor's art search lists art from the matching release first.

## Tonearm, reels, tape thickness, live meters
- Tonearm rebuilt after the SL-1200MK2 photos with the Ortofon-style blue-stylus headshell/cartridge (assets/cartridge.png); strobe dot removed.
- Cassette reels redrawn as real reels (12-hole flange, six drive teeth); tape packs have a wound-tape gradient.
- The cassette now has real thickness (edge faces, translateZ front/back) and tilts while flipping.
- Cassette VU meters follow the audio actually playing (Web Audio analyser, dB scale, peak hold). Local files are served through a `ddmedia://` protocol with CORS so the analyser works; falls back to file:// with simulated meters if that fails.

## About, donations, auto-update
- New Help menu: About Digi-Deck (credits, open-source licences, donate button), Check for Updates, and a switch to turn automatic updates off (also in Settings).
- Automatic updates from GitHub Releases for the installer build; the portable build offers the download page.
- Installer and portable files now have distinct names (`Digi-Deck-Setup-x.y.z.exe`, `Digi-Deck-x.y.z-portable.exe`).

## Cassette deck, multi-record vinyl, turntable buttons
- Cassette and tape deck are rebuilt layer-for-layer from the supplied PSDs (black, white and clear shells). Two deck faces: normal, and Cassette Single (used automatically for singles). The LCD meters, counter and keys are live overlays on the deck art.
- Vinyl releases can hold more than two sides: 1–4 records (sides A–H). Choose "Records in this release" in Edit info; each side gets its own label slot (and picture disc slot), stored in the database. Auto-split divides tracks by duration. Flip turns the record over; for sets the button becomes NEXT RECORD and swaps in the next disc.
- 7" records spin at 45 rpm and the 45 button lights.
- Turntable buttons are deeper, with bevels, travel when pressed, and lit faces.

## Fixes
- Cassette: tape amount is visible in the centre window (dark tape against a pale window backing, as in the supplied art) and the tape packs now rotate with the reels.
- Vinyl: dropping the tonearm on the record now plays from that spot (local audio is served with proper byte-range support, so seeking works).
- Releases with 1–2 tracks default to a single: 7" 45 rpm (one song per side), 3" CD, cassette single. Pick "Album" in Edit info to override.

## Capacity, sound effects, generic labels, settings
- Capacity limits: vinyl 25 min/side (override per release in Edit info), cassette 90 min/tape (45 per side), CD 80 min/disc. Longer playlists split automatically into more records, tapes or discs, each with its own label slot in Edit info; multi-disc CD albums use the same mechanism (DISC headers in the playlist, disc swap on the player).
- Cassette tape sound: saturation, head bump, softened highs, wow & flutter and a touch of hiss. Switch off in Settings.
- Vinyl sound: steady surface crackle, needle-drop thump at the start (with the needle travelling over a lead-in groove), run-out and lock-groove at the end of each side followed by an automatic flip; after the last side the needle stays in the lock groove until you press Stop. Switch off in Settings.
- CD: the moving laser under the disc is gone.
- Main menu uses realistic vinyl, CD and cassette pictures.
- Settings: "Always open in full screen" (global), tape sound, vinyl sound.
- Generic labels drawn from the supplied PSDs for 12" and 7" vinyl, 5" and 3" CD and cassette. {Artist} becomes "Various Artists" for mixed playlists. Text stays inside the label: OCR-A on vinyl, Sharpie look on CDs, thin marker on cassettes.
- Fix: right cassette reel teeth no longer doubled.

- Fix: cassette no longer vanishes or shows a mirrored label on sides A/C/E/G (the tape is drawn flat when at rest; 3D only while turning).
- New: CHANGE TAPE (cassette) and CHANGE DISC (CD) buttons for multi-tape/multi-disc releases; cassette FLIP now turns the current tape over.

## Real sound samples, run-out animation, niche formats
- Sound effects now use recorded samples (assets/sfx): the needle drop plays in full before the first song of a side (needle lowers onto the lead-in meanwhile); vinyl crackle drifts quietly at random under the music; the lead-out loop plays ~3 s at the end of a side before it flips, and loops until Stop after the last side.
- Cassette: ~5 s of tape hiss (reels turning) at the start of a side, then it drops very low under the music and comes back up for ~5 s at the end of a side before the flip.
- One "Sound effects" toggle in Settings (replaces the two separate options); it also controls the tape saturation.
- Vinyl: a full side now ends ~1/4" from the label; at the end of a side the needle spirals inward faster and faster into the locked groove beside the label.
- Main menu: greyed-out "Niche formats" (DAT, Microcassette, Reel to Reel, MiniDisc). DAT and MiniDisc logos are saved in assets/logos for when those players are built.

## Fixes
- Cassette: tape saturation toned right down (it was overdriving the music) and a safety limiter added so effects can never clip the output.
- Cassette: playlists and folders of loose songs now fill side A up to 45 min, then B, then the next tape (a 90-min tape), instead of splitting evenly.
- Vinyl: side width now reflects the side's length against the 25-minute limit (or the album's own minutes-per-side), so a short side ends well before the dead wax. A full side still ends 1/4" from the label.
- Cassette: saturation now has real headroom (the head-bump boost was pushing loud masters past full scale into the shaper, which clipped); full-volume playback should stay clean.
- Vinyl: START/STOP now truly toggles - it stops the record at any point (playing, lead-in, run-out or locked groove) and starts it when stopped.

## Library shelves
- Uniform thumbnails: every cover on a shelf has the same footprint (art is cropped to the jacket shape), sized from real dimensions.
- Vinyl: separate shelves for 12" records and 7" records, jackets facing front, 7" drawn at 7/12 the size of a 12".
- CD: cases stand spine-out (3/8" spine on a 4 7/8" case); separate shelf for 3" CDs (3 3/8" spine). Spines are coloured from the cover and carry artist and title; hover pulls out a larger, readable copy.
- Clicking an item opens a bigger preview (front/back, jewel-case frame for CDs) with Play, Edit info, Remove and Close.
- Fix: CSS custom properties passed through the element helper (--w etc.) were never applied.
- Cassette shelf: cases stand spine-out (standard 5/8 in spine on a 4 1/4 in case; singles 1/2 in on 4 in), hover pulls out a readable spine, separate "Cassette singles" shelf (maxi singles share the standard shelf). Preview shows a flat case with spine strip.

## Wrap-around artwork
- CD: the image in the "Back" slot is a tray card (Spine | Back | Spine). The shelf spine is cut from its edge strip (white fold lines are detected automatically); the preview "Show back" shows just the centre panel.
- Cassette: the "J-card" slot is a full J-card (Back flap | Spine | Cover). The shelf spine and the cover are cut from the right places so they line up; previews keep the card's own aspect ratio, with "Show full J-card" to see the whole thing. The redundant cassette "Back" slot is removed from Edit info.
- Handwriting fonts for tape-style labels (cassette now; DAT, microcassette, reel to reel, MiniDisc later): Segoe Print (Windows system font) with Desyrel (bundled) as fallback.

## Microcassette update
- **New Microcassette player** (Micro mode): Sanyo-style deck with a door that opens to let the tape slide out of the top; tape runs right to left at 15/16 in/s; flip and change-tape animations; EJECT button; live LED peak meters; mechanical counter.
- Own database (`micro.db`), own shelf (½ x 2 3/16 in cases, J-card spines), generic label and J-card art from the supplied layouts, MC-60 tapes (30 min per side).
- Lo-fi audio chain: 135 Hz high-pass, 6.5 kHz low-pass, +3 dB presence bell at 2 kHz, 10:1 fast-attack ALC compressor, and tape saturation from a ChowTapeModel-derived hysteresis processor. Slightly louder tape hiss than the cassette (start/end swell at half the first level).
- Wow and flutter removed from all tape players.
- About: added "Name & Logo by Tylor Hornbeck".
- **Licensing:** the bundled ChowTapeModel port is GPLv3, so Digi-Deck is now GPLv3 (see THIRD_PARTY_NOTICES.md).

## Microcassette art pass
- Tape redrawn from the supplied shell composite (true shell outline with the top notch, bottom slots and centre hole, larger reel windows, new hub/pack/label placement); black, white and clear shells are made from it, other colours tint the white shell. The tape keeps its 3D thickness for flips.
- Deck front and door use the edited artwork (assets/micro/deck-front.png, door.png).

## Tape update
- Cassette and microcassette reels stop immediately on STOP.
- Cassette hubs are see-through with black drive spindles inside; microcassette window has a soft backlight so the tape packs show.
- Microcassette shelf: albums with no J-card use the generic microcassette J-card.
- Cassette: tapes with no album information get a random generic J-card and random generic side labels (from assets/generics/cassette/{jcards,labels} or the "Cassette Generics" folder), saved in the database.

## Library & editor update
- **Image adjuster** (with a label guide that darkens what will not show: disc + spindle hole for vinyl/CD, real label outline for cassette/microcassette) – every album-info editor (vinyl, CD, cassette, microcassette) now has an **Adjust…** button under each image slot: drag to move, scroll/slider to zoom, arrow keys to nudge, choose a frame shape. The adjusted image is saved as its own file and stored in that database slot.
- **J-card adjust** – for J-cards the adjuster only lines up the spine + cover used on the shelf (stored as a small setting, `jcard_adj`); the full J-card image is kept untouched for "show full image" and the art viewer.
- **Metallic colours** – Gold, Silver, Bronze and Copper added to the vinyl record colours and the cassette/microcassette shell colours (all editors). Vinyl gets a metallic sheen.
- **Edit info from the library** no longer opens the album or starts playing it.
- **Unidentified playlists** – playlists/folders with no album info are no longer filed automatically. When one is cleared or replaced you're asked *Save / Don't save / Cancel* (with "remember my choice"). Settings → General: Ask / Always save / Never save.
- **Microcassette pre-built database** – `assets/micro/prebuilt/albums.json` (from Microcassettes_images.xlsx) + the images you copy into that folder are imported into the microcassette library automatically; missing images are picked up on a later run and edits are never overwritten.

## Reel to reel deck, premade database options
- **New Reel mode** (own `reel.db`): a Digi-Deck RD-7 style open-reel deck. 7" reel goes onto the left spindle, tape feeds through the path onto the empty take-up reel on the right. Tape at 7½ ips, instant stop, only audio effect is tape warmth (no hiss). Same multi-reel, flip and change-reel behaviour as the other tapes.
- **Generic reel** (1,800 ft, 48 min a side) and **retail reel** (1,200 ft, 32 min a side); choose per album in Edit info. This sets the tape pack size and how sides are split. Albums with release info default to retail, playlists to generic.
- **Reel shelf**: boxes stand spine-out. Cover, Spine, Back of box, Label A/B (more for multi-reel). No J-card, no wrap.
- **Microcassette spreadsheet** now imports the Color column.
- **Build** writes `missing-images.txt` listing prebuilt images not found.
- **Installer** has an option not to install the premade microcassette database.
- **Reel flip**: going to side B, D, F... the full reel is lifted off, turned over and set on the left spindle while the empty album reel turns to its other side and moves to the right; the tape is threaded again. Changing to the next reel still rewinds and loads a fresh one.

## Reel deck art, meters, tape path; adjustment export
- Reel deck uses your edited deck-front.png (assets/reel/deck-front.png, meters removed from the image and drawn live) and the reel size from your PSD (3½" flange = 298 units on a 2000-unit deck).
- VU meters lie on their sides: left turned to the left, right to the right.
- Tape leaves the edge of the pack on the supply reel and lands on the edge of the pack on the take-up reel, following both as they empty / fill.
- Settings > General > "Export microcassette adjustments...": writes albums.json (with each album's shelf spine/cover adjustment and colour), adjusted-images/ (adjusted J-cards and labels under their supplied file names) and adjustments.json to a folder. Copy them into assets/micro/prebuilt and build. The importer now applies `jcard_adj` from albums.json.
- Prebuilt albums.json regenerated from the corrected spreadsheet.
- Shelf: pop-up zoom on the top shelf is now the same size as on the lower shelves (it shifts down instead of shrinking).

## Reel deck: your meters, capstans, idler wheels, tape layering
- VU meters use your faces (assets/reel/vu-left.png, vu-right.png - the baked needles were removed and the left red zone restored) with a live needle pivoting at the outer edge and sweeping up and down the scale, like the Pioneer reference photos.
- Idler wheels turn clockwise and the two capstans (new, from your PSD) turn anticlockwise while tape runs; a small mark on each capstan shows the turning.
- The tape is drawn above the deck and below the reels, so it passes behind the flanges and shows through the clear left reel and the cut-outs in the take-up reel.
- Reel deck: meters, counter and wheels are shown (needles resting) before anything is loaded; the black wells now hold reel tables - a machined platter with the three-prong drive hub, turning with the reel.

### Adjuster, CD case, reel colours and thickness
- **Image adjuster**: nudge buttons for zoom and a new **rotate** control (same nudge); labels open zoomed and centred on the visible (mask) part of the guide
- **CD**: the library preview uses the new jewel-case art (cover sits in the marked square, overlay on top without dimming it); the tray card wraps the shelf spine again, and the adjuster shows the spine | back | spine layout
- **Reel to reel**: pick a reel colour; optional **full reel label**; labels are cropped to the label shape; no side-B label when that slot is empty; reels have real thickness when turned over (two flanges, hollow down to the hub, tape pack visible)
- **Colours**: black is properly black; new **tan** for cassettes and reels
- **Microcassette**: removed the square rim that showed around the shell; the pre-made database now matches any edition of an album (deluxe, special, anniversary, remaster...); album list rebuilt from the updated spreadsheet
- **Release URL / ID**: images from the release fill empty (generic) slots and never replace artwork you already set

### Library animations (vinyl first)
- **Play from the library**: the jacket comes forward to full size, the record slides out (12" from the right, 7" from the top), and is carried to the turntable. 12" jackets have their 4 mm thickness; 7" sleeves are paper-thin
- **Clear after Stop** (albums that are in the library): the record lifts off, slides back into its jacket, and the jacket leaves toward the Library button
- Click anywhere (or Esc) to skip an animation; Settings → General has a switch to turn them off
- Fixed: the spindle no longer shows on top of the record while it flips

### New look: brushed metal & blue
- The whole interface is now steel-blue with brushed-metal bars; the shelves are brushed steel instead of wood
- Toolbar, transport, library and dialog buttons are raised metal keys that press down when clicked; selected and main buttons glow blue

### CD player face-lift
- New portable look modelled on the late-90s flat Discmans: gloss-black top with the disc in a round smoked well, brushed-silver control strip that dips around the disc (still no lid)
- Big round STOP key, half-moon key cluster (previous / volume − / volume + / next around a domed play-pause key), same green LCD
- The old library key is now an **EJECT** key that puts in the next disc; it only appears on multi-disc albums and replaces the floating CHANGE DISC button

### Library animations: CD
- **Play from the library**: the jewel case comes forward, the lid swings open on its hinge (booklet on the left, disc on the tray on the right), the disc is lifted off the hub and floats up while the case closes and drops away, then it settles into the player (about 5 s)
- **Clear after Stop**: the disc lifts out of the player, the open case comes up under it, the disc goes back on the hub, the lid closes and the case leaves toward the Library button (about 4 s)
- **3" CDs** come in a sleeve (no case overlay): the disc slides out of the top and back in

### Library animations: cassette
- **Play from the library**: the case comes forward upright (portrait) showing its J-card cover, turns over to the back (tape and back flap), is turned on its side, the pocket tips open on its hinge, the tape is lifted out standing up, the case closes and drops away, and the tape drops into the deck (about 5 s)
- **Clear after Stop**: the tape lifts out of the deck, the open case comes up under it, the tape is lowered back into the pocket, the pocket closes, the case turns back to its J-card and leaves toward the Library button (about 4 s)
- The J-card wraps the case: cover on the front, spine on the hinge edge, back flap on the back (the flap and the tape stay put when the pocket tips open; then the tape slides out from under the flap) - a short flap is a strip along the spine edge, a full-back J-card covers the whole back
- Case and tape are their real sizes (case 109 × 70 × 17 mm, tape 100 × 64 × 12 mm) and in your tape's shell colour

### Library animations: microcassette and reel to reel
- **Microcassette**: same as the cassette with the microcassette case (2 3/16 × 1 1/2 × 1/2 in) and tape; the tape is handed to the deck above its open compartment and the deck slides it in and closes the door (and the reverse when putting it away)
- **Reel to reel**: the square box comes forward, the lid opens to the left, the reel is lifted out of the right half and set on the left spindle, then threaded. Putting it away: the slack is wound up, the tape comes off the guides, the reel is lifted off and lowered into the box, the lid closes and the box goes back to the library
- Fixed: on the cassette and microcassette the tape could still show in the deck while it was being carried away
- How the animations work is written up in docs/library-animations.md
- Reel box: now the shelf's 7.5 in square × 0.85 in deep, with a full-depth lid whose flaps close over the top, right and bottom of the tray (spine on the hinge side); seen at more of an angle so the depth shows
- Microcassette: removed the square box that showed around the tape while it came out of / went into its case

### More realistic record grooves
- Raised, glossy bead round the edge; a smooth landing band, then the **lead-in groove spirals in** (about two turns) to the first song - that's also where the needle is dropped now
- Songs have a fine, even groove texture whose sheen follows a loudness-like curve (quiet starts and ends, light and dark rings through the song) instead of evenly spaced lines
- Between songs: a glossy band with the groove crossing it in one turn
- **Lead-out**: a glossy run-out area with the groove spiralling inward in ever wider turns to the **locked groove**, then the dead wax with a hand-etched matrix number and the raised ring that guards the label
