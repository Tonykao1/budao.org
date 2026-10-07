const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.join(__dirname,'..');
const html = fs.readFileSync(path.join(root,'yhzd.html'),'utf8');
const themeCss = fs.readFileSync(path.join(root,'yhzd-editorial.css'),'utf8');
const sharedCss = fs.readFileSync(path.join(root,'editorial-journey/editorial-journey.css'),'utf8');

test('萤火之地 uses one live journey root instead of five fixed scenes',()=>{assert.equal((html.match(/data-yhzd-journey/g)||[]).length,1);assert.equal((html.match(/class="editorial-scene/g)||[]).length,0);assert.match(html,/editorial-journey\/editorial-journey\.css/);assert.match(html,/yhzd-depth-return\.mjs/);assert.doesNotMatch(html,/yhzd-editorial\.js/);});
test('hero and night field remain while the ending has no CTA copy',()=>{assert.match(html,/class="yhzd-stars"/);assert.match(html,/class="yhzd-glow"/);assert.match(html,/<h1>萤火之地<\/h1>/);assert.match(html,/有些话，<br>只有走过的人才会说出来。/);assert.doesNotMatch(html,/yhzd-ending|再走一程|再次归回|这次走到这里/);assert.match(themeCss,/\.yhzd-hero/);assert.match(sharedCss,/\.ej-journey/);});
test('adapter preserves long original messages exactly and exports integration entrypoint',async()=>{const mod=await import('../yhzd-depth-return.mjs');const long='今天无论是身体还是灵里，都收获满满，感恩弟兄姐妹们的陪伴和分享。';assert.equal(typeof mod.initYhzdDepthReturn,'function');assert.ok(mod.YHZD_MESSAGES.includes(long));assert.equal(mod.YHZD_MESSAGES.find(x=>x===long),long);});
test('shared journey CSS has no hard scroll snap and keeps focus text flat',()=>{assert.doesNotMatch(sharedCss,/scroll-snap/);assert.match(sharedCss,/\.ej-reading\.is-reading-locked\s*\{[^}]*filter:none!important[^}]*transform:none!important/s);assert.match(sharedCss,/@media\(max-width:980px\)/);});
test('renderer consumes continuous solver geometry instead of reverting to fixed grid templates',()=>{assert.match(sharedCss,/\.ej-media\s*\{[^}]*width:calc\(var\(--ej-image-scale[^)]*\)\s*\*\s*100%\)/s);assert.match(sharedCss,/\.ej-reading\s*\{[^}]*width:calc\(var\(--ej-text-ratio[^)]*\)\s*\*\s*100%\)/s);assert.doesNotMatch(sharedCss,/grid-column:\s*\d+\s*\/\s*span\s*\d+/);});
