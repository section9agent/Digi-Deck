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
- Grooves: the lead-in, between-song and lead-out spirals now wind the right way (inward anticlockwise across a record that turns clockwise); the lead-in has as many turns as the record makes while the needle crosses it, and the needle is set down at its outer end

## MiniDisc player
- **New MiniDisc mode** (own `md.db`, on the main menu and the MD button): a clear-window portable with a stick remote (LCD, play/pause, prev/next, stop, volume). The disc slides in from the bottom, then its slider opens; the disc spins at 900 rpm at the start, slowing to 400 rpm toward the edge. 80 minutes a disc; longer playlists and multi-disc albums are split like CDs, and the remote's **EJECT** key (multi-disc only) puts in the next disc.
- **Disc styles** (Edit info → Disc): **retail** (black shell, printed label), **LED printed** (the picture covers the whole disc, slider included; see-through parts show the disc spinning), **standard** recordable (clear shell, paper sticker; with no label picture it gets the plain sticker with the title, artist and songs handwritten). Playlists default to standard.
- **Cases** (Edit info → Case): **retail** (3 1/3 × 4 5/16 × 5/8 in, tray card wraps it like a CD) or **slim** (2 13/16 × 3 1/8 × 5/16 in, J-card wraps it like a cassette). Artwork slots: Cover, Tray card, J-card, Disc label(s).
- **Shelf**: retail cases and slim cases on their own shelves, spines out; the preview shows the cover in the retail case.
- All MiniDisc artwork is in `assets/md` (see its README) and can be edited.
- MiniDisc: the official MiniDisc logo is used on the discs (moulded into the retail shell, printed on the recordable) and on the shelf spines
- MiniDisc adjuster: label guides now match the disc style (retail label, standard sticker, or the whole disc for LED printed with the slider outlined); the J-card guide uses the slim-case layout and the cover shape matches the case
- MiniDisc: the slider starts opening while the disc is still sliding in (as soon as half of it is in the window) and closes as it starts sliding out - one motion

### Library animations: MiniDisc
- **Retail case** works like the CD jewel case: it comes forward, the lid swings open to the left, the disc is lifted out of the tray and carried down to the bottom of the player, which slides it in and opens its slider. Putting it back: the player slides the disc out of the bottom, it is lowered back into the open case and the lid closes.
- **Slim case** works like the cassette case: the J-card wraps round it, the clear pocket tips open, the disc slides out from under the flap, turns upright and goes into the bottom of the player - and the reverse when putting it away.
- The disc keeps its 3/16 in thickness in the case.
- Vinyl: in the lead-in and the lead-out the needle now rides in the drawn groove, turn by turn, as the record spins; the platter is kept in step so the needle reaches the first song exactly as the music starts (12" and 7"), and the lead-out groove starts right where the last song ends
- MiniDisc slim case: the disc sits in the case the right way round (seen from the pocket side, slider on the left) and turns over to its label side on its way to the player (and back over again when it goes back in)
- Vinyl 12": the edge, lead-in and first song now follow your layout (lead-in starts right inside the edge bead, first song at 96% of the radius); the lead-out has about twice as many spiral turns (about 3 on a 12", 4 on a 7") and the needle takes ~6 s to run through it
- MiniDisc slim case: the disc now lies in the case label side up and upside down (slider on the left), slides straight out of the top and turns upright on its way to the player, as in your photos; a library hand-over that is interrupted can no longer leave the player without its disc showing

### Playlist building
- Opening songs while the playlist already holds songs that are not an album asks **"Making a playlist?"** - yes adds the new songs to the end instead of replacing them
- You can then save it to the library under a name; it is saved again every time you add songs or change their order
- After that it doesn't ask again; the playlist is only cleared by **Clear** or by playing an album from the library
- Drag songs in the playlist panel to change the order (playlists only, not albums)
- MiniDisc: the 80 is printed on the slider with a small "Minutes" beside it and "Recordable MD" under it; the MiniDisc logo sits higher
- Vinyl 7": new **Small centre hole** option in Edit info (7" singles pressed with an LP-size hole) - the record gets the small hole and no 45 adapter

# Digi-Deck 2.0.0

## Shaped records
- New **Shaped record** option for vinyl (Edit info). The record takes its shape from the **Side A** and **Side B** picture-disc images (PNG with a transparent background). Side B is lined up with Side A so both faces match; with no Side B picture, Side A's shape is used.
- Set **Size across (inches)** for the widest point of the shape. The grooves fill the biggest circle that fits inside the shape, so the lead-in and first song move with the shape; the lead-out, label area and centre hole stay standard.
- The needle drops on the lead-in at the shape's groove edge.
- Clear PVC sleeve with back flap (and its library animation) will follow.

## 10" records
- New **Record size** choice for vinyl (Edit info): Automatic (12", or 7" for singles), **10" record** or **10" shellac**.
- A **10" record** plays at 33⅓ (about 15 minutes a side), or at 45 when the release type is a single or maxi single (about 10 minutes a side). It has a 90 mm label and a jacket.
- A **10" shellac** plays at **78 rpm** (about 4 minutes a side), with a smaller **76 mm** label, grooves that run closer to it, and a paper sleeve.
- The turntable has a new **78** speed button; the library has a **10″ records** shelf, and the library animation uses the right size of jacket or sleeve.
- Fixed: re-scanning a folder now keeps the MiniDisc, small-hole and shaped-record settings.

## Shaped records: sized by the playable area
- Shaped picture discs are usually listed by their playable area (a "7 inch" shaped disc has a 7" groove circle, and the shape around it is bigger). The size can now be measured across the **playable area** (new default) or the **whole shape**.
- New preview in Edit info shows side A with the **groove circle** in blue. Move it (↑ ↓ ← →) and make it **smaller / bigger** to line it up with the circle printed on the picture; **Reset** goes back to the biggest circle that fits.
- The playing time per side follows the playable size (about 6 minutes for a 7", 12 for a 10").
- Shaped records have a **Speed** choice: Automatic (33⅓ for albums, 45 for singles), 33⅓, 45 or 78 rpm. The platter, speed light and grooves follow it.

## Multi-colour records
- New **Multi-colour** choice under Record colour (Edit info, vinyl):
  - **Half & half** (2 colours), **Tri-colour** (3), **Quad colour** (4) and **Pinwheel** (2): fixed sections. "Turn the split" / "New pinwheel" changes the angle or the petals.
  - **Starburst**, **Cloudy**, **Smoke**, **Splatter** and **Marble**: random patterns from 2-5 colours. "New pattern" makes another; every record of a multi-record set gets its own.
- Pick each colour from the record swatches or a custom colour. A preview shows side A and side B (the back of the record is the front mirrored).
- The grooves, lead-in/out and label are drawn on top as usual; picture discs still use their picture.
- **Starburst** reworked from more examples: the first colour blooms out from the label in big soft lobes, and the other colours wrap round it in wavy, rippled bands that also drift round the record.
- **Cloudy** reworked: soft clouds streaked outward, with lots of raised droplets (rounded heads pointing outward, tails toward the centre).
- Multi-colour patterns are laid out over the playing area, so 7" records show them properly too.
- **Marble** reworked from more examples: mostly the first colour, with faint clouds of the others and lots of fine, wispy veins at several sizes that fade in and out, with a soft smoky glow. Veins take the other colours and a pale tint of the first.
- **Starburst**: colours can also break up into separate puddles round a ring (instead of a full ring), and edges get combed, radial fringes in places.
- **Splatter** reworked from a big set of examples: jagged radial streaks bursting from the label, irregular chips and flakes (denser toward the centre) and soft blurred smears, over the base colour with an optional glow. Each pattern is more bursty or more chippy at random.
- Removed the **Smoke** style (it looked too much like Marble). Records saved with Smoke now show as Marble.
- **Starburst** tuned from a big set of examples: colours blend into each other more, edges are softer, and fine marbled swirls run round the record.
- MiniDisc: the logo on the standard (recordable) disc shell moved left, inside the shell's top-right corner.
- MiniDisc: new **Shell colour** in Edit info (the same colours as tapes, including Transparent, Smoke and the metallics). Coloured plastic is see-through; black, white and metallic shells are nearly solid. The printed logo keeps its ink (white on black and smoke shells). LED printed discs are all picture, so they don't use it.
- MiniDisc: the **generic label** was redrawn at four times the resolution, with clean lines, a crisp "Title" and the MiniDisc logo; handwriting on it is sharper too.
- MiniDisc player: new **player body** and **retail disc shell** artwork.
- MiniDisc player: the works behind the window were redrawn from photos of clear-window portables, at twice the resolution: a brushed perforated plate with stamped rows of holes and tabs, the spindle motor with its turntable, magnet clips and hub, the optical pickup (lens in a metal housing, gold board with a dot code) on guide rails with a lead screw, the amber flex cable, a circuit board with parts, the brass sled motor, a blue connector, screws and rivets.

## Stability
- **Only one copy runs at a time.** Opening Digi-Deck again brings the running window forward instead of starting another copy in the background.
- If the window **stops responding**, Digi-Deck now asks whether to **reload the window** (your library is kept), wait, or quit, instead of needing Task Manager. If the window crashes, it reloads by itself.
- If Digi-Deck **can't start** (for example because the library is locked by a stuck copy), it now shows what went wrong and quits, instead of staying invisible in the background.
- The library databases wait briefly for a lock instead of failing at once.
- A library animation that hasn't finished after 30 seconds is skipped, and the album still plays.
- New **log file**: Help > **Open Log Folder**. Start-ups, errors, crashes and "not responding" moments are written to `digi-deck.log`.

## Blue metal
- The silver metal on every player (turntable plinth, platter and tonearm, CD control strip and keys, cassette, microcassette and reel-to-reel faces, knobs and keys) is now a vivid light blue. The MiniDisc player is unchanged. The original silver art is kept in `assets/_silver/`, and `tools/blue-metal.py` tints new artwork the same way.

## Turntable
- Metallic-blue **strobe dots** and platter rim, and a new **slipmat** (`assets/slipmat.png`).
- The **pitch fader** works: +10 % at the top, −10 % at the bottom, a detent at 0. Drag it, click along it, or scroll (Shift for bigger steps); double-click resets. The record and the music speed up or slow down together, and a small display shows the setting.
- The 78 button is gone. A **78** bracket is printed over the 33 and 45 keys, and both light up for 78 rpm.

## DAT deck (new)
- New **DAT** player, in the style of a Sony DTC-59ES / DTC-700 / DTC-670: a black brushed front, a cassette door with a smoked window and the DAT logo, a red fluorescent display and a full row of transport keys. No audio filter.
- The tape sits tilted back a little behind the door window and is lit by an **LED** (brighter while it plays), so you can see the white hubs turning and the tape moving from the left reel to the right. DAT plays one way only: there is no flip.
- Opening a tape: the door swings out, the tape drops into the holder and the door closes. Changing tapes reverses it. **OPEN/CLOSE** puts in the next tape on multi-tape albums.
- The display shows the programme number, ABS time, 48 kHz / SP, L/R level bars, and the **track title in 5 × 8 dot-matrix characters**, scrolling when it is long.
- Keys: stop, play, pause, AMS previous / next, review / cue (10 s), and a volume knob.
- Tapes are **black** or **deep blue**. A DT-120 holds 120 minutes; longer playlists use more tapes. Artwork: front, J-card (back flap · spine · cover, landscape cover) and a label per tape; without a label the tape shows a printed generic face with the title.
- DAT has its own library and shelf. The case animation from the library comes next.

## MiniDisc remote
- Restyled after a Sony RM-D29M: long black remote with EJECT, a green power key, MENU/YES/CLEAR, DISPLAY/SCROLL/FADER, NAME IN, number keys with letters, CD-SYNC and CD PLAYER rows, a big play key, record, stop, AMS, search, repeat and a LEVEL rocker.
- Its display is an amber fluorescent panel like an MD deck's: TRACK NO., L/R level bars with the dB scale, the **title in 5 × 8 dot-matrix characters**, the time (DISPLAY switches elapsed / remaining / total) and the numbered track boxes. Number keys 1-10 play that track.

## Microcassette
- The transport icons and names are now on the keys themselves.
- DAT: the door's DAT logo is sized to fit between the door lip and the window (and drawn sharper); the window is a letterbox onto the tape's hub window, as on the real decks, and the tape sits tilted further back, shaded toward the top.
- DAT: J-cards use the real DAT layout (back flap 200 · spine 121 · cover 638 of 959 × 860, a portrait cover). The shelf, the preview and the J-card adjuster follow it. A tape with no J-card gets a generated one in the same style: the songs on the back flap, the title on the spine, the picture on the cover with the title, the songs and DIGITAL AUDIO TAPE below.
- Fixed: the library preview card in DAT mode filled the whole window.
- Fixed: saving an album that was opened from files while the same album was already in the library failed with "UNIQUE constraint failed: albums.key". It now updates the library entry.
- Shaped records: the groove circle in Edit info can be **dragged** to move it; drag its edge or scroll to resize it. The arrow and Smaller / Bigger buttons take bigger steps, and the circle can now be made up to 30 % bigger than the largest circle that fits (the grooves are still cut to the shape's outline).
- Vinyl shelf: **Shaped records** get their own shelf. The extra shelves (10″, 7″, shaped; 3″ CDs, cassette singles, MiniDisc slim cases …) only show once something is on them.
- **Die-cut jackets and company sleeves:** a front or back picture with a see-through hole in the middle shows the record's label through the hole - on the shelf, in the preview, in the playlist and in the library animation, where the label slides out with the record (and the record's other side shows through a holed back). The inside of the jacket shows through the hole once the record is out.
- DAT: the tape now runs the real way - up from the left pack, across the top of the window and down to the right hub.
- DAT: the **whole tape** is tilted back in the door (a larger window shows all of it), not just the hubs.
- DAT: skipping a track **searches** first - the hubs race for about 1.5 s with "▶▶ AMS" (or "◀◀ AMS") on the display, then play starts.
- DAT: more metallic - brushed-aluminium front with a soft sheen, and metal-finish keys and knobs.
- New **Theme** setting (Settings › General): Metal & blue (default), Cyberpunk, Synthwave and Vaporwave. Themes restyle the app around the players (toolbar, playlist, buttons, panels, background); the players themselves keep their look.
- **LCD numbers:** the CD, cassette, DAT and MiniDisc remote displays now show their numbers as real 7-segment digits, with the unlit segments faintly visible behind them like a real display (DSEG7 font, SIL Open Font Licence, in assets/fonts).
- **Metallic finish on every player** (MiniDisc left as it was): the cassette deck, microcassette deck, reel-to-reel, turntable and CD player get the same brushed-aluminium grain, streaks and sheen as the DAT deck, including their keys and knobs. `tools/brushed-metal.py` rebuilds the art (the plain blue-tinted versions are kept in assets/_tinted/).
- **More themes** (Settings › General › Theme): Original, Cyberpunk, Synthwave, Vaporwave, 80s, 90s, Steampunk, Forest, Midnight, Winamp and Windows XP.
- New `tools/bigboppa-sleeves.js` (+ `download-bigboppa-sleeves.bat`): downloads the company-sleeve pictures from sleeves.bigboppa.co.uk into 45 / 78 / unsorted folders named "Label - year". It follows the site's robots.txt, waits between requests, skips the shop pages, and picks up where it left off.
- Windows XP theme: text boxes and drop-downs are white with black text (they were turning black).
- DAT: the transport keys now sit inside the black key strip under the display.
- BigBoppa sleeve script reworked for how the site is actually laid out (one page per label and country, e.g. /USA/dot/dot-us.htm): it follows frame and menu links, takes every sleeve picture on a label page (the full-size one when the thumbnail links to it), reads the caption beside each picture for the year and 45/78, and names files "Label (country) - year". It now writes `download-log.txt` (every page visited and why any picture was skipped) and `start-page.html` to the output folder, and says plainly if the site can't be reached or its robots.txt says no.
- Windows XP theme: the original Bliss wallpaper is now the background (assets/themes/bliss.jpg).
- Winamp theme rebuilt to look like the classic Winamp 2 skin:
  - gunmetal windows with gold-ridged title bars ("DIGI-DECK", "DIGI-DECK PLAYLIST", "WINAMP");
  - light-grey bevelled transport keys;
  - dark toggle keys with small green LEDs that light for the selected player (like EQ / PL);
  - black LCD time boxes with green digits;
  - the gold position slider and the green-to-red volume bar;
  - a black playlist with green Arial text and the playing track in white;
  - black LCD-style text boxes in dialogs.
- **The players now follow the theme** (`src/renderer/skin.js`):
  - The metal of the turntable, CD player, cassette deck, microcassette deck and reel-to-reel is recoloured for every theme except Original, with a texture to match:
    - Cyberpunk: black chrome with neon trim;
    - Synthwave: sunset chrome;
    - Vaporwave: pastel;
    - 80s: champagne silver;
    - 90s: teal plastic;
    - Steampunk: polished brass with scratches and patina;
    - Forest: walnut grain;
    - Midnight: navy anodised with metal flake;
    - Winamp: gunmetal;
    - Windows XP: Luna blue and silver-white.
  - The wooden cassette-deck sides change with the theme. On the dark themes, printed labels on the metal are lightened so they stay readable.
  - Displays take the theme's colour.
  - The recolouring runs in a background worker and is cached, so switching themes doesn't freeze the app.
- **A slipmat for each theme:**
  - Original: a simple charcoal felt mat with fine silver rings.
  - Cyberpunk: the circuit mat.
  - Synthwave: the sunset grid with palms (first made for Vaporwave).
  - Vaporwave: your sun, checkerboard floor and Relax.jpg window picture.
  - 80s: an 8-ball.
  - 90s: arcade carpet.
  - Steampunk: a brass gear.
  - Forest: the fairy-forest picture.
  - Midnight: a moon and stars.
  - Winamp: the llama.
  - Windows XP: the Windows orb.
- **Forest theme:** a misty forest background with fireflies, plus bark and moss trim, a moss playlist and walnut players.
- **Steampunk theme:** an oxblood workshop wall with brass gears and copper pipes, a parchment playlist, riveted brass bars, parchment dialogs and brass players.
- **Midnight theme:** the players get a navy anodised finish with fine metal flake.

## Create art, album lists, backups and more
- **Create art** (new button next to Clear): design any artwork slot for the loaded album - front, back, J-card, tray card, labels, picture discs - at the slot's exact shape.
  - Guides show the folds and spines, the disc / label circle and hole, and the label outlines.
  - Pictures can be moved, resized (corners), stretched (edges), rotated (the round handle), skewed, flipped and cropped. Drop picture files onto the design to add them.
  - Text boxes can use any font installed on your computer, with bold, italic, alignment, size, spacing, line height, outline and shadow.
  - Shapes, layers (order, hide), undo / redo, duplicate, nudging with the arrow keys, and Export PNG.
  - **Save** puts the picture straight into the slot and updates the library. The design is kept, so opening Create art on that slot again lets you carry on editing it.
- The **Art** button is now **View Art**.
- **Album list** (new button): line up whole albums from the player's library to play one after another, in order or shuffled. Lists are saved per player. When an album ends, the next one comes out of its packaging and plays, including after the last side of a record, instead of the locked groove.
- **Library backup / restore** (Settings > General, replacing "Export microcassette adjustments"):
  - A backup is a folder with every player's library and all of its pictures, so it can also move to another computer.
  - Restore replaces the libraries with the backup's, after first saving your current ones so it can be undone.
  - Music files are not copied.
- **Switching players** no longer carries the album across:
  - If the new player's library has the same album, it is loaded and keeps playing from the same song and time.
  - If not, the player is left empty and you're asked whether to make the album in that format as well. Saying yes also adds it to that player's library.
- **Discogs / MusicBrainz IDs** in Edit info: typing or pasting a release ID (or link) into either box looks the release up and applies it straight away.
- **Apple Lossless .m4a** files now play: they are converted once to FLAC (lossless, cached) using a bundled FFmpeg. AAC .m4a already played. The misleading "play() request was interrupted" message no longer appears.
- **Strobe dots** on the turntable platter:
  - Outermost row 33⅓, middle 45, innermost 78, each with the right number of dots.
  - The row for the speed you're playing stands still, as under mains light. The others crawl or race, and pitch changes make the steady row drift.
- **DAT:**
  - The tape is modelled on a Sony DT-60: lid with brand, arrow, lock slot and gold DT-120; a 58 mm label strip; a big smoked window with "C" guide rings, white toothed hubs and the striped gold DAT logo; a ribbed foot.
  - Opening the door raises the tape up out of it; closing lowers it back in.
  - **Library animation**: the tape comes out of its clamshell case (with your J-card), is lifted into the open door, and the door closes.
- **Shaped records:**
  - They come in a **clear PVC sleeve** the size of the record, with a fold-over flap at the back.
  - Without cover art the record shows through it. With cover art, the card sits under the PVC and the record slides out from behind it (and back in), like a 10".
- **Slipmats:**
  - Every mat has a felt texture and the fine silver edge rings.
  - Synthwave now uses the sunset-grid mat, without the text.
  - Vaporwave uses your sun / checkerboard / Relax.jpg picture.
- **Animated backgrounds** (subtle; they stop if Windows is set to reduce motion):
  - Cyberpunk: neon rain and a scan line.
  - Synthwave: a rolling neon grid floor and a breathing sun glow.
  - Vaporwave: drifting pastel clouds.
  - 80s: a scrolling arcade starfield.
  - 90s: tumbling Memphis confetti.
  - Steampunk: a turning gear and rising steam.
  - Midnight: twinkling stars and the odd shooting star.
- The toolbar keeps its labels on one line and tightens up on narrower windows.
- BigBoppa sleeves:
  - The site refuses download programs (HTTP 403), so the script now says so plainly.
  - It also has a `--local` mode: save the label pages from your browser (Ctrl+S, "Web page, complete") into a folder, then drag the folder onto `tools\sort-saved-bigboppa-pages.bat`.
- **Shaped records, side B:**
  - Side B's picture now lines itself up on side A automatically. The app matches the two outlines (side B mirrored), at any rotation, size or position in the picture, so the edges, hole and grooves line up on both sides.
  - Edit info shows a side B preview with side A's outline shaded over it, and buttons to turn it (1° / 15°), mirror it, or go back to the automatic line-up.
- **Groove circle:** it can now grow up to 4 times the biggest circle that fits inside the shape, past the edges of the shape (the grooves only show on the record itself). Bigger / Smaller now step by 6% each time.
- **Shaped records on the shelf:**
  - Each one sits in a clear PVC sleeve sized to the record (a 10" shape is bigger than a 7"), with the record showing through it, or the cover art behind the PVC when there is one.
  - The same sleeve shows in the preview and the playlist header.
- Shaped records: the size you enter is always the **playable area** (inches across the groove circle), and the whole shape is scaled to match. The "whole shape" option is gone. Edit info shows how wide the whole shape comes out. If that would be wider than a 12" platter, it says so and shows the record at the biggest size that fits; growing the blue circle to match the ring printed on the picture fixes that.
- **Builds for Linux and macOS too:** the GitHub Actions workflow (`.github/workflows/build.yml`) now builds:
  - Windows: installer and portable .exe;
  - Linux: AppImage and .deb;
  - macOS: .dmg and .zip, for both Apple Silicon and Intel Macs.

  Everything goes into one draft release. The Mac builds are unsigned, so they need right-click > Open the first time. New `npm run dist:mac` / `npm run dist:linux` scripts do the same builds locally.
