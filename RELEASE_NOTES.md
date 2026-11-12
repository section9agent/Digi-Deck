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
