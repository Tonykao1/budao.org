const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('MANNA first screen uses one-line declaration without Bible citation or duplicate large logo',()=>{
 const html=read('manna/index.html'),css=read('manna/assets/manna.css');
 const hero=html.slice(html.indexOf('<section class="portal"'),html.indexOf('</section>',html.indexOf('<section class="portal"'))+10);
 assert.ok(hero.includes('<h1 id="gate-title" class="hero-declaration">一切供应，皆从祂而来。</h1>'));
 assert.ok(!hero.includes('hero-brand-logo'));assert.ok(!hero.includes('hero-logo-stage'));
 for(const forbidden of ['罗马书','雅各书','11:36','1:17','参《','经文出处'])assert.ok(!hero.includes(forbidden),forbidden);
 assert.ok(html.includes('class="nav-brand-logo" src="/manna/assets/manna-logo-transparent.png"'));
 assert.ok(hero.includes('href="#table"')&&hero.includes('href="/manna/about/"'));
 assert.ok(css.includes('.portal .hero-declaration{'));
 assert.ok(css.includes('white-space:nowrap'));
 assert.ok(css.includes('@media(max-width:380px){.portal .hero-declaration'));
 const actions=hero.slice(hero.indexOf('<div class="portal-actions">'),hero.indexOf('</div>',hero.indexOf('<div class="portal-actions">')));
 assert.ok(!actions.includes('↘')&&!actions.includes('↗'));
});
