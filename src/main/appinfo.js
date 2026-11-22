const pkg = require('../../package.json');
const pub = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
const repo = { owner: pub.owner || '', repo: pub.repo || '' };
repo.configured = !!repo.owner && !/^YOUR-/i.test(repo.owner);
repo.url = `https://github.com/${repo.owner}/${repo.repo}`;

const DONATE_URL = 'https://www.paypal.com/donate/?business=section9agent%40hotmail.com&no_recurring=0&currency_code=USD&item_name=Digi-Deck+donation';

const CREDITS = {
  software: [
    { name: 'Electron', what: 'Desktop app framework (includes Chromium and Node.js)', license: 'MIT', url: 'https://www.electronjs.org' },
    { name: 'music-metadata', what: 'Reads tags, cover art and durations from audio files', license: 'MIT', url: 'https://github.com/Borewit/music-metadata' },
    { name: 'FFmpeg (via ffmpeg-static)', what: 'Converts Apple Lossless (ALAC) files to FLAC so they can play', license: 'GPL-3.0 (FFmpeg build); ffmpeg-static is GPL-3.0', url: 'https://ffmpeg.org' },
    { name: 'DSEG7 font', what: '7-segment LCD digits', license: 'SIL Open Font License 1.1', url: 'https://www.keshikan.net/fonts-e.html' },
    { name: 'electron-updater / electron-builder', what: 'Auto-update and Windows packaging', license: 'MIT', url: 'https://www.electron.build' },
    { name: 'SQLite', what: 'Database engine (built into Node.js)', license: 'Public domain', url: 'https://sqlite.org' }
  ],
  services: [
    { name: 'MusicBrainz & Cover Art Archive', what: 'Release data and cover art', url: 'https://musicbrainz.org' },
    { name: 'Discogs', what: 'Release data, side splits and images', url: 'https://www.discogs.com' },
    { name: 'TheAudioDB', what: 'Artist and album art', url: 'https://www.theaudiodb.com' },
    { name: 'fanart.tv', what: 'Covers and disc art', url: 'https://fanart.tv' },
    { name: 'iTunes Search API', what: 'Album artwork', url: 'https://performance-partners.apple.com/search-api' },
    { name: 'Deezer API', what: 'Album artwork', url: 'https://developers.deezer.com' }
  ]
};
const allowedUrls = () => new Set([DONATE_URL, repo.url, repo.url + '/releases', ...CREDITS.software.map(c => c.url), ...CREDITS.services.map(c => c.url)]);
module.exports = { pkg, repo, DONATE_URL, CREDITS, allowedUrls };
