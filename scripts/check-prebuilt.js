// Lists every image named in assets/micro/prebuilt/albums.json that is not in the prebuilt folder.
// Runs automatically before `npm run dist*` (see "predist" in package.json); writes missing-images.txt next to package.json.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dir = path.join(root, 'assets', 'micro', 'prebuilt');
const extra = process.env.DIGIDECK_PREBUILT_DIR ? [process.env.DIGIDECK_PREBUILT_DIR] : [];
let list = [];
try { list = JSON.parse(fs.readFileSync(path.join(dir, 'albums.json'), 'utf8')); } catch (e) { console.log('[prebuilt] no albums.json - nothing to check'); process.exit(0); }
const have = d => { try { return new Set(fs.readdirSync(d).map(f => f.toLowerCase())); } catch { return new Set(); } };
const sets = [dir, ...extra].map(have);
const exists = f => sets.some(s => s.has(f.toLowerCase()));
const missing = [], used = new Map();
for (const e of list) {
  const slots = [['J-card', e.jcard], ...(e.labels || []).map((f, i) => ['Side ' + 'ABCD'[i], f])];
  for (const [slot, f] of slots) {
    if (!f) continue;
    if (!used.has(f.toLowerCase())) used.set(f.toLowerCase(), []);
    used.get(f.toLowerCase()).push(`${e.artist} - ${e.title} (${slot})`);
    if (!exists(f)) missing.push(`${f}\t${e.artist} - ${e.title}\t${slot}`);
  }
}
const missingFiles = new Set(missing.map(m => m.split('\t')[0].toLowerCase()));
const dups = [...used].filter(([, v]) => v.length > 1);
const out = [`Microcassette pre-built database - image check (${new Date().toISOString().slice(0, 10)})`, `${list.length} albums, ${used.size} different image files named, ${missingFiles.size} missing (${missing.length} album slots)`, '',
  'MISSING (file<TAB>album<TAB>slot):', ...(missing.length ? missing : ['  none - every image is in assets/micro/prebuilt']), '',
  'SAME FILE USED BY MORE THAN ONE ALBUM (check for a copy/paste mistake in the spreadsheet):', ...(dups.length ? dups.map(([f, v]) => `${f}\n    ${v.join('\n    ')}`) : ['  none'])];
fs.writeFileSync(path.join(root, 'missing-images.txt'), out.join('\n') + '\n');
console.log(`[prebuilt] ${missingFiles.size} of ${used.size} image files missing${missing.length ? ' - see missing-images.txt' : ''}${dups.length ? `; ${dups.length} file(s) used by several albums` : ''}`);
if (missing.length) missing.slice(0, 15).forEach(m => console.log('   missing: ' + m.replace(/\t/g, '  |  '))), missing.length > 15 && console.log(`   ... and ${missing.length - 15} more`);
