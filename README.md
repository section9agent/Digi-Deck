# Digi-Deck

A desktop media player (Electron) that plays your music on a vinyl turntable, a CD player or a cassette deck.

## Run
Needs Node.js 22.5 or newer (any current LTS is fine). No C++ build tools are needed - the database uses SQLite built into Node/Electron.

```
npm install
npm start
```
`npm test` runs the parser / database / side-splitting tests.

**Build a Windows exe locally:** double-click `build-windows.bat` (or run `npm run dist:win`). The installer and a portable exe appear in `dist/`. `npm run dist:win:portable` builds only the portable exe, and `npm run dist:dir` makes an unpacked folder for quick testing.
Pushing a `v*` tag (or running the workflow manually) builds the Windows exe (Mac/Linux are switched off until the app is polished - see the matrix in `.github/workflows/build.yml`) and creates a **draft** GitHub release using `RELEASE_NOTES.md`.

## Using it
1. Pick a mode on launch (switch any time from the top bar).
2. **Open files / folder / playlist**, or drag & drop. Supported playlists: m3u, m3u8, pls, xspf, wpl, zpl, asx, b4s, cue, jspf, mpcpl.
3. Everything you open is filed on the **Library** shelf for that mode. Reopening from the shelf uses the stored info and art - nothing is downloaded again.
4. **Edit info** lets you change artist/title/tracks/sides, replace any art slot (front, back, J-card, label A, label B), search for another release, or paste a Discogs / MusicBrainz release URL to force the exact release.

## Databases
`vinyl.db`, `cd.db` and `cassette.db` live in the app's user-data folder (`db/`). They are fully independent. Downloaded images are cached once on disk and referenced by each database.

## Art / metadata sources
MusicBrainz + Cover Art Archive, Discogs, TheAudioDB, fanart.tv, iTunes, Deezer; also `cover.jpg`/`folder.jpg`/`back.jpg`/`label.jpg`... next to the music, and art embedded in tags.
Settings holds optional keys: **Discogs token** (needed for Discogs search + side info), fanart.tv key, TheAudioDB key (free key `123` is the default), and a contact string for MusicBrainz's User-Agent.

## Behaviour details
- **Vinyl**: 12" at 33⅓ rpm; each song is one groove band whose width is proportional to its length; original label (if found) in the middle. Sides come from Discogs positions (A1, B2...), otherwise the album is split by playing time. Single track → 7" at 45 rpm with the large-hole adapter.
- **CD**: 5" disc, 15 mm hole, spins 500 → 200 rpm across the album (constant linear velocity); single track → 3" disc. A generic "Digital Audio" badge is shown; to use the official Compact Disc logo, add your own licensed file as `assets/cd-logo.svg`.
- **Cassette**: reels turn at the speed set by the tape-pack size (constant tape speed), packs move from left to right over the side; flipping lifts and turns the cassette.
- User-made playlists or releases that can't be found get generated cover/label art with the playlist name.

## Media library folder
Settings -> **Media library folder**: pick the folder with your music, choose which formats to fill (Vinyl / CD / Cassette) and optionally scan on startup. The scanner finds every album folder (multi-disc `CD1`/`Disc 2` folders are folded into one album, folders mixing several albums are split by album tag), then files each album in the chosen libraries and downloads the info and artwork. Re-scans only look at new or changed folders. You can also start a scan from the shelf (**Scan library folder**).

Artwork is looked up per format: the vinyl library prefers the artwork of the matching LP release (Discogs / MusicBrainz), the CD library the CD release (plus CD disc art), the cassette library the cassette release. Generic digital covers (iTunes, Deezer) are only a last resort, and CD disc art is never used on records or tapes.

## Tonearm, reels, tape thickness, live meters
- Tonearm rebuilt after the SL-1200MK2 photos with the Ortofon-style blue-stylus headshell/cartridge (assets/cartridge.png); strobe dot removed.
- Cassette reels redrawn as real reels (12-hole flange, six drive teeth); tape packs have a wound-tape gradient.
- The cassette now has real thickness (edge faces, translateZ front/back) and tilts while flipping.
- Cassette VU meters follow the audio actually playing (Web Audio analyser, dB scale, peak hold). Local files are served through a `ddmedia://` protocol with CORS so the analyser works; falls back to file:// with simulated meters if that fails.

## About window, donations and auto-update
- **Help > About Digi-Deck** shows the credits ("Coded by Claude & Emmanuel Hoachlander"), the open-source software and online services used, the full licence texts (`THIRD_PARTY_NOTICES.md`, regenerate with `npm run notices`) and a PayPal donation button.
- **Auto-update** checks GitHub Releases a few seconds after start-up and installs new versions (Windows installer build). Turn it off in **Settings**, **Help > Automatically Check for Updates**, or the About window. **Help > Check for Updates…** always works.
- **One-time setup:** in `package.json` replace `YOUR-GITHUB-USERNAME` (in `repository.url` and `build.publish[0].owner`) with your GitHub user or organisation name, and keep the repo name `digi-deck` (or change it in both places). Until then the update check just says no update source is set up.
- **Releasing:** bump `version` in `package.json`, push a `v*` tag, let the workflow build, then **publish** the draft release. The updater only sees published releases and needs the `Digi-Deck-Setup-x.y.z.exe`, `.blockmap` and `latest.yml` files the workflow uploads.
- The portable `.exe` can't replace itself; it tells you a new version exists and opens the download page.
