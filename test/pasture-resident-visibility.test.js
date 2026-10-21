'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('resident sheep is composited AFTER night overlay rather than before full-screen tint',()=>{
 const core=read('tonglu-core.html'),engine=read('pasture-resident-core.js');
 const start=core.indexOf('function draw(){'),end=core.indexOf('\nfunction build(',start);
 assert.ok(start>0&&end>start,'final pasture draw function');
 const draw=core.slice(start,end);
 assert.ok(draw.indexOf('weatherFx(kind(c.weatherCode),cloud)')>=0);
 assert.ok(draw.lastIndexOf('window.__tongluCoreResidentPaintV1?.();')>draw.indexOf('weatherFx(kind(c.weatherCode),cloud)'));
 assert.match(draw,/if\(!state\)\{window\.__tongluCoreResidentPaintV1\?\.\(\);return\}/);
 assert.match(engine,/window\.__tongluCoreResidentPaintV1=\(\)=>paintResident\(performance\.now\(\)\)/);
 assert.doesNotMatch(engine,/ctx\.fillRect=function|ctx\.clearRect=function|isSceneTintFill/);
 assert.match(engine,/if\(!resident\?\.appearance\|\|canvas\.style\.display==='none'\|\|arrivalStart\)return/);
 assert.match(engine,/Renderer\.draw\(ctx,x,y,s,pos\.flip,resident\.appearance\)/);
 assert.match(engine,/window\.__tongluResidentPaintCount/);
});
test('sheep locator is read-only and exposes actual pixels without changing location',()=>{
 const engine=read('pasture-resident-core.js');
 const diagnostics=read('pasture-preview/pasture-sheep-check.js');
 const exposed=engine.slice(engine.indexOf('window.BudaoResidentSheepLocator='),engine.indexOf('\ncanvas.addEventListener',engine.indexOf('window.BudaoResidentSheepLocator=')));
 assert.match(exposed,/Object\.freeze/);
 assert.match(exposed,/position:\(\)=>resident\?\.appearance/);
 assert.match(exposed,/x:pos\.x\+10\.5\*scaleAtY\(pos\.y\)/);
 assert.match(exposed,/visible:canvas\.style\.display!=='none'/);
 assert.doesNotMatch(exposed,/localStorage\.setItem|pos\.x=|pos\.y=/);
 assert.match(diagnostics,/id="pastureSheepCheckLocate"/);
 assert.match(diagnostics,/BudaoResidentSheepLocator\?\.position/);
 assert.match(diagnostics,/data-pasture-location-ring/);
 assert.match(diagnostics,/getBoundingClientRect/);
 assert.match(diagnostics,/setTimeout\(\(\)=>marker\?\.remove\(\),6500\)/);
 assert.doesNotMatch(diagnostics,/localStorage\.getItem|saveSheep|activateCard/);
});
test('all modified visualization and diagnostic JavaScript parse',()=>{
 const engine=read('pasture-resident-core.js');
 const diag=read('pasture-preview/pasture-sheep-check.js');
 const core=read('tonglu-core.html');
 assert.doesNotThrow(()=>new vm.Script(engine));
 assert.doesNotThrow(()=>new vm.Script(diag));
 const scripts=[...core.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const m of scripts)assert.doesNotThrow(()=>new vm.Script(m[1]));
});
