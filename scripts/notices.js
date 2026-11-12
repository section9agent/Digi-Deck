// Regenerates THIRD_PARTY_NOTICES.md from the licence files of the production dependency tree.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), nm = path.join(root, 'node_modules');
const seen = new Map();
(function walk(name, from) {
  let dir = null;
  for (let d = from; ; d = path.dirname(d)) { const c = path.join(d, 'node_modules', name); if (fs.existsSync(path.join(c, 'package.json'))) { dir = c; break; } if (d === path.dirname(d)) break; }
  if (!dir && fs.existsSync(path.join(nm, name, 'package.json'))) dir = path.join(nm, name);
  if (!dir) return;
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')), key = pkg.name + '@' + pkg.version;
  if (seen.has(key)) return; seen.set(key, { pkg, dir });
  for (const d of Object.keys(pkg.dependencies || {})) walk(d, dir);
})('music-metadata', root);
walk2('electron-updater');
function walk2(n) { const before = new Set(seen.keys()); (function w(name, from) { let dir = path.join(nm, name); if (!fs.existsSync(path.join(dir, 'package.json'))) { dir = path.join(from, 'node_modules', name); if (!fs.existsSync(path.join(dir, 'package.json'))) return; } const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')), key = pkg.name + '@' + pkg.version; if (seen.has(key)) return; seen.set(key, { pkg, dir }); for (const d of Object.keys(pkg.dependencies || {})) w(d, dir); })(n, root); }
let out = '# Third-party notices\n\nDigi-Deck is built on the open-source software below. Each component keeps its own licence.\n\n' +
  '## Electron (and the Chromium and Node.js it bundles)\nMIT licence, (c) Electron contributors / GitHub Inc. https://www.electronjs.org - the full Electron, Chromium and Node.js licence notices ship with the application (LICENSE.electron.txt, LICENSES.chromium.html).\n\n' +
  '## SQLite\nThe database uses the SQLite engine built into Node.js (node:sqlite). SQLite is in the public domain. https://sqlite.org\n\n';
for (const [key, { pkg, dir }] of [...seen].sort((a, b) => a[0].localeCompare(b[0]))) {
  const lf = fs.readdirSync(dir).find(f => /^(licen[sc]e|copying)(\.|$)/i.test(f));
  const text = lf ? fs.readFileSync(path.join(dir, lf), 'utf8').trim() : `Licence: ${pkg.license || 'see package'}`;
  const home = pkg.homepage || (pkg.repository && (pkg.repository.url || pkg.repository)) || '';
  out += `## ${key}\n${pkg.license ? 'Licence: ' + pkg.license + '\n' : ''}${home ? String(home).replace(/^git\+/, '') + '\n' : ''}\n\`\`\`\n${text}\n\`\`\`\n\n`;
}
out += '## Online services\nArtwork and release information are fetched on demand from MusicBrainz and the Cover Art Archive, Discogs, TheAudioDB, fanart.tv, the iTunes Search API and Deezer. Artwork and metadata belong to their respective owners; Digi-Deck stores it locally for your personal library only.\n';
fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), out);
console.log('wrote THIRD_PARTY_NOTICES.md with', seen.size, 'packages');
