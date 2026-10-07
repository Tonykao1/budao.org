const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root=path.join(__dirname,'..');
const theme=fs.readFileSync(path.join(root,'yhzd-editorial.css'),'utf8');
const shared=fs.readFileSync(path.join(root,'editorial-journey/editorial-journey.css'),'utf8');
test('journey reading layer preserves a viewport-safe crisp focus state',()=>{assert.match(theme,/\.yhzd-hero\s*\{[^}]*min-height:\s*calc\(100svh\s*-\s*56px\)/s);assert.match(shared,/\.ej-journey\{[^}]*width:min\(88vw,1280px\)/s);assert.match(shared,/\.ej-reading\{[^}]*min-width:0[^}]*overflow-wrap:anywhere/s);assert.match(shared,/\.ej-reading\.is-reading-locked\{[^}]*filter:none!important[^}]*transform:none!important/s);assert.match(shared,/@media\(max-width:980px\)/);assert.doesNotMatch(shared,/scroll-snap/);});
test('prefers-reduced-motion disables depth transforms instead of only shortening animation',()=>{const reduced=shared.match(/@media\(prefers-reduced-motion:reduce\)\{([\s\S]*)\}\s*$/)?.[1]||'';assert.match(reduced,/\.ej-spatial,\.ej-reading\s*\{[^}]*filter:none!important[^}]*transform:none!important[^}]*opacity:1!important/s);assert.match(reduced,/\.ej-journey\s*\{[^}]*perspective:none/s);});
