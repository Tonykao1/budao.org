/* Sync new home playlist entries into the published What's New feed.
 * Called by GitHub Actions after a commit touching home.html. Existing news is retained.
 */
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const root = path.join(__dirname, '..');
const before = process.env.BEFORE_SHA;
if (!before || !/^[0-9a-f]{40}$/i.test(before) || /^0+$/.test(before)) process.exit(0);
function tracks(html) {
  const match = html.match(/const\s+playlist\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error('Homepage playlist missing');
  return [...match[1].matchAll(/["'](music\/[^"']+\.mp3)["']/g)].map(m => m[1]);
}
const prior = cp.execFileSync('git', ['show', before + ':home.html'], {cwd:root, encoding:'utf8', maxBuffer:3e6});
const current = fs.readFileSync(path.join(root,'home.html'),'utf8');
const previousTracks = new Set(tracks(prior));
const currentTracks = tracks(current);
const additions = currentTracks.filter(t => !previousTracks.has(t));
if (!additions.length) process.exit(0);
const feedPath = path.join(root,'whats-new.json');
const feed = JSON.parse(fs.readFileSync(feedPath,'utf8'));
if (!Array.isArray(feed.items)) throw new Error('Invalid Whats New feed');
let changed = false;
for (const track of additions) {
  if (!track.startsWith('music/') || track.includes('..') || !fs.existsSync(path.join(root, track))) continue;
  const id = 'music:' + track;
  if (feed.items.some(item => item.id === id)) continue;
  const title = path.basename(track,'.mp3').replace(/^\d+(?:-\d+)?\s+/, '').trim();
  feed.items.unshift({id, type:'music', title:'同行之声 · '+title,
    description:'新曲目上线，点击即刻聆听。', url:'/home.html',track,icon:'♫',published:true});
  changed = true;
}
if (changed) {
  fs.writeFileSync(feedPath, JSON.stringify(feed,null,2)+'\n');
  process.stdout.write('Updated published music news: '+additions.join(', ')+'\n');
}
