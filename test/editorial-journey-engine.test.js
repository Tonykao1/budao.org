const assert = require('node:assert/strict');
const test = require('node:test');

async function load(name){ return import(`../editorial-journey/${name}.mjs`); }

test('fingerprintImage classifies orientation deterministically and preserves safe crops only at confidence threshold', async () => {
  const { fingerprintImage } = await load('fingerprint');
  const landscape = { id:'l', width:1600, height:1000, density:0.42 };
  const portrait = { id:'p', width:900, height:1400 };
  const square = { id:'s', width:1000, height:1000 };
  assert.equal(fingerprintImage(landscape).orientation, 'landscape');
  assert.equal(fingerprintImage(portrait).orientation, 'portrait');
  assert.equal(fingerprintImage(square).orientation, 'square');
  assert.equal(fingerprintImage({ ...landscape }).orientation, fingerprintImage(landscape).orientation);
  assert.equal(fingerprintImage(landscape).safeCrop, null);
  assert.equal(fingerprintImage({ ...landscape, safeCrop:{ confidence:0.84, x:0.1, y:0.1, width:0.8, height:0.8 } }).safeCrop, null);
  const source = { ...landscape, safeCrop:{ confidence:0.85, x:0.1, y:0.1, width:0.8, height:0.8 } };
  const before = structuredClone(source);
  const fp = fingerprintImage(source);
  assert.deepEqual(fp.safeCrop, source.safeCrop);
  assert.notEqual(fp.safeCrop, source.safeCrop);
  assert.deepEqual(source, before);
});

test('fingerprintText preserves exact text and classifies density by characters', async () => {
  const { fingerprintText } = await load('fingerprint');
  const short = '感恩遇见';
  const medium = '今天的安排，很舒适又得着。一路同行，心里很安静。';
  const long = '这是一段比较长的同行者原话，它必须完整保留，不能因为版式需要而删减、摘句、截断或者拆成两个不同的场景。所有的标点与原始内容都必须保持原样。';
  const shortFp = fingerprintText(short), mediumFp = fingerprintText(medium), longFp = fingerprintText(long);
  assert.equal(shortFp.text, short);assert.equal(mediumFp.text, medium);assert.equal(longFp.text, long);
  assert.equal(shortFp.densityClass, 'short');assert.equal(mediumFp.densityClass, 'medium');assert.equal(longFp.densityClass, 'long');
  assert.equal(shortFp.characters, [...short].length);assert.equal(typeof longFp.estimatedLines, 'function');assert.ok(longFp.estimatedLines('narrow') > longFp.estimatedLines('wide'));
});

test('generateSceneCandidates exposes legal scene families without mutating text', async () => {
  const { fingerprintImage, fingerprintText } = await load('fingerprint');const { generateSceneCandidates } = await load('candidates');
  const image = fingerprintImage({ id:'img', width:1600, height:1000, safeCrop:{ confidence:0.9, x:0.05, y:0.05, width:0.9, height:0.9 } });
  const text = fingerprintText('今天的安排，很舒适又得着。');
  const candidates = generateSceneCandidates({ image, text, rhythm:{}, viewport:{ width:1440, height:900, mode:'desktop' } });
  assert.deepEqual(new Set(candidates.map(c => c.sceneType)), new Set(['image-text','image-only','text-only']));
  assert.ok(candidates.every(c => !c.text || c.text === text.text));assert.ok(candidates.some(c => c.cropSpec));
});

test('candidate generation falls back safely for long text, missing text, and unsafe crops', async () => {
  const { fingerprintImage, fingerprintText } = await load('fingerprint');const { generateSceneCandidates } = await load('candidates');
  const unsafeImage = fingerprintImage({ id:'unsafe', width:900, height:1400, safeCrop:{ confidence:0.7, x:0, y:0, width:1, height:1 } });
  const longText = fingerprintText('这是一段非常长的同行者原话，它必须完整保留，不能因为旁边还有一张图片就被压缩成无法阅读的小字，也不能删减、摘句或截断。引擎应该在必要的时候选择更加安全的纯文字幕。');
  const candidates = generateSceneCandidates({ image:unsafeImage, text:longText, rhythm:{}, viewport:{ width:1024, height:768, mode:'desktop' } });
  assert.ok(candidates.some(c => c.sceneType === 'text-only'));assert.ok(candidates.every(c => c.cropSpec == null));
  assert.ok(generateSceneCandidates({ image:unsafeImage, text:null, rhythm:{}, viewport:{ width:1024, height:768, mode:'desktop' } }).some(c => c.sceneType === 'image-only'));
});

test('validateSceneCandidate rejects overflow, tiny type, unsafe crop, focus distortion, and zero-area media', async () => {
  const { validateSceneCandidate } = await load('validator');
  const base = { sceneType:'image-text', text:'完整文字', textFontPx:24, textLeft:100, textRight:500, mediaArea:100000, textBlurPx:0, textPerspective:0, cropSpec:null };
  const context = { viewport:{ width:1000, height:800 }, safeInset:40, minTextPx:18 };
  assert.equal(validateSceneCandidate(base, context).valid, true);
  assert.equal(validateSceneCandidate({ ...base, textRight:980 }, context).valid, false);assert.equal(validateSceneCandidate({ ...base, textFontPx:12 }, context).valid, false);
  assert.equal(validateSceneCandidate({ ...base, cropSpec:{ confidence:0.9, subjectSafe:false } }, context).valid, false);assert.equal(validateSceneCandidate({ ...base, textBlurPx:2 }, context).valid, false);
  assert.equal(validateSceneCandidate({ ...base, textPerspective:1 }, context).valid, false);assert.equal(validateSceneCandidate({ ...base, mediaArea:0 }, context).valid, false);
});

test('rhythm penalizes repeated heavy image-text runs and favors a lighter next scene', async () => {
  const { createRhythmState, advanceRhythm } = await load('rhythm');const { scoreSceneCandidate } = await load('solver');
  let rhythm = createRhythmState();for (let i=0;i<3;i++) rhythm = advanceRhythm(rhythm,{ id:`heavy-${i}`, sceneType:'image-text', visualWeight:0.9, sceneDepth:0.45 });
  assert.equal(rhythm.heavyRun, 3);
  const heavy = { sceneType:'image-text', visualWeight:0.9, readabilityScore:0.9, compositionScore:0.9, riskPenalty:0.05, sceneDepth:0.48 };
  const light = { sceneType:'text-only', visualWeight:0.3, readabilityScore:0.9, compositionScore:0.82, riskPenalty:0.03, sceneDepth:0.42 };
  assert.ok(scoreSceneCandidate(light,{ rhythm }) > scoreSceneCandidate(heavy,{ rhythm }));
});

test('solver prioritizes readability over crowded prettiness', async () => {
  const { createRhythmState } = await load('rhythm');const { scoreSceneCandidate } = await load('solver');const rhythm = createRhythmState();
  const readable = { sceneType:'image-text', visualWeight:0.65, readabilityScore:0.98, compositionScore:0.78, riskPenalty:0.02, sceneDepth:0.35 };
  const crowded = { sceneType:'image-text', visualWeight:0.7, readabilityScore:0.55, compositionScore:1, riskPenalty:0.2, sceneDepth:0.35 };
  assert.ok(scoreSceneCandidate(readable,{ rhythm }) > scoreSceneCandidate(crowded,{ rhythm }));
});

test('chooseSceneCandidate randomizes only within the top three-percent band', async () => {
  const { chooseSceneCandidate } = await load('solver');
  const candidates = [{ id:'top', sceneType:'text-only', score:100 },{ id:'near', sceneType:'image-only', score:98 },{ id:'far', sceneType:'image-text', score:95 }];const scorer = c => c.score;
  assert.equal(chooseSceneCandidate(candidates,{ scoreCandidate:scorer },() => 0).id,'top');assert.equal(chooseSceneCandidate(candidates,{ scoreCandidate:scorer },() => 0.999).id,'near');
  for (const r of [0,0.2,0.5,0.9,0.9999]) assert.notEqual(chooseSceneCandidate(candidates,{ scoreCandidate:scorer },() => r).id,'far');
});

function makeImages(n){ return Array.from({length:n},(_,i)=>({ id:`img-${i}`, width:i%3===0?900:1600, height:i%3===0?1400:1000 })); }
function makeMessages(n){ return Array.from({length:n},(_,i)=>`同行原话第${i+1}条，保持完整。`); }

test('journey generates a small frontier, freezes walked scenes, and only appends unseen frontier', async () => {
  const { createJourneyEngine } = await load('journey');const engine = createJourneyEngine({ images:makeImages(12), messages:makeMessages(12), viewport:{width:1440,height:900,mode:'desktop'}, random:()=>0.17 });
  assert.ok(engine.getScenes().length > 0 && engine.getScenes().length <= 2);const first = engine.getScenes()[0];engine.markViewed(first.id);const frozenSnapshot = structuredClone(first);engine.ensureAhead(3);
  assert.deepEqual(engine.getScenes()[0], frozenSnapshot);assert.equal(Object.isFrozen(engine.getScenes()[0]), true);const before = engine.getScenes().map(s=>structuredClone(s));engine.markViewed(first.id);engine.ensureAhead(3);assert.deepEqual(engine.getScenes().slice(0,before.length), before);
});

test('journey suppresses same-journey duplicates and uses the surviving pool as pure scenes', async () => {
  const { createJourneyEngine } = await load('journey');const engine = createJourneyEngine({ images:makeImages(1), messages:makeMessages(10), viewport:{width:1280,height:800,mode:'desktop'}, random:()=>0 });
  while (engine.getScenes().length < 6 && !engine.isClosed()) {const last=engine.getScenes().at(-1); if(last) engine.markViewed(last.id);engine.ensureAhead(2);}
  const scenes=engine.getScenes();const imageIds=scenes.map(s=>s.imageId).filter(Boolean);assert.equal(new Set(imageIds).size, imageIds.length);assert.ok(scenes.some(s=>s.sceneType==='text-only'));
  const opposite=createJourneyEngine({ images:makeImages(10), messages:makeMessages(1), viewport:{width:1280,height:800,mode:'desktop'}, random:()=>0 });
  while (opposite.getScenes().length < 6 && !opposite.isClosed()) {const last=opposite.getScenes().at(-1); if(last) opposite.markViewed(last.id);opposite.ensureAhead(2);}assert.ok(opposite.getScenes().some(s=>s.sceneType==='image-only'));
});

test('journey keeps image and text selection independent', async () => {
  const { createJourneyEngine } = await load('journey');const images=[{id:'A',width:1600,height:1000},{id:'B',width:1600,height:1000}];const messages=['alpha','beta'];
  const engine=createJourneyEngine({images,messages,viewport:{width:1440,height:900,mode:'desktop'},random:(()=>{const xs=[0.9,0.1,0.8,0.2];let i=0;return()=>xs[(i++)%xs.length];})()});
  const first=engine.getScenes()[0];assert.ok(first.imageId || first.messageId);const state=engine.getState();assert.ok(Array.isArray(state.usedImageIds));assert.ok(Array.isArray(state.usedMessageIds));
});

test('natural closure never happens before 8 and always happens by 15', async () => {
  const { createJourneyEngine } = await load('journey');const engine=createJourneyEngine({images:makeImages(30),messages:makeMessages(30),viewport:{width:1440,height:900,mode:'desktop'},random:()=>0,minScenes:8,maxScenes:15});
  while(!engine.isClosed() && engine.getScenes().length<20){const last=engine.getScenes().at(-1); if(last) engine.markViewed(last.id);engine.ensureAhead(2);}const count=engine.getScenes().length;assert.ok(count>=8,`count ${count}`);assert.ok(count<=15,`count ${count}`);assert.equal(engine.isClosed(),true);
});

test('sceneMotionState makes focus crisp and distant/receding scenes spatial', async () => {
  const { sceneMotionState } = await load('renderer');const distant=sceneMotionState(0,'desktop'), focus=sceneMotionState(0.5,'desktop'), recede=sceneMotionState(1,'desktop');
  assert.ok(distant.scale < focus.scale);assert.ok(distant.brightness < focus.brightness);assert.ok(distant.blurPx > focus.blurPx);assert.equal(focus.blurPx,0);assert.equal(focus.readingLocked,true);assert.equal(focus.textPerspective,0);assert.ok(recede.translateZ < focus.translateZ);assert.ok(recede.blurPx > 0);assert.ok(recede.opacity > 0,'receding is spatial, not a hard fade to zero');
});

test('mobile motion keeps depth identity with lower spatial intensity', async () => {const { sceneMotionState } = await load('renderer');const desktop=sceneMotionState(0.1,'desktop'),mobile=sceneMotionState(0.1,'mobile');assert.ok(Math.abs(mobile.translateZ) < Math.abs(desktop.translateZ));assert.ok(Math.abs(mobile.lateralShift) < Math.abs(desktop.lateralShift));assert.ok(mobile.scale < 1);assert.ok(mobile.blurPx > 0);});

test('soft magnetism stabilizes only slow movement near focus', async () => {const { computeSoftMagnetism } = await load('renderer');const gentle=computeSoftMagnetism({focusDistance:0.03,velocity:120,delta:8,mode:'desktop'});assert.ok(gentle>0 && gentle<0.5);assert.equal(computeSoftMagnetism({focusDistance:0.03,velocity:1200,delta:8,mode:'desktop'}),0);assert.equal(computeSoftMagnetism({focusDistance:0.4,velocity:80,delta:4,mode:'desktop'}),0);assert.equal(computeSoftMagnetism({focusDistance:0.02,velocity:90,delta:140,mode:'desktop'}),0);});

test('memory tier planning keeps only adjacent scenes full and preserves stored SceneSpecs exactly', async () => {const { planMemoryTiers } = await load('renderer');const specs=Array.from({length:10},(_,i)=>Object.freeze({id:`s${i}`,sceneType:'text-only',text:`t${i}`,sceneLength:0.8}));const plan=planMemoryTiers(specs,'s5');assert.deepEqual(plan.filter(x=>x.tier==='near').map(x=>x.sceneId),['s4','s5','s6']);assert.ok(plan.filter(x=>x.tier!=='near').every(x=>x.fullDetail===false));const stored=plan.find(x=>x.sceneId==='s0');assert.equal(stored.tier,'stored');assert.equal(stored.spec,specs[0]);const back=planMemoryTiers(specs,'s1');assert.equal(back.find(x=>x.sceneId==='s0').spec,specs[0]);assert.equal(back.find(x=>x.sceneId==='s0').tier,'near');});

test('depth mode switches at the exact 980px mobile boundary', async () => {const { depthModeForViewport } = await load('renderer');assert.equal(depthModeForViewport(981),'desktop');assert.equal(depthModeForViewport(980),'mobile');assert.equal(depthModeForViewport(430),'mobile');});

test('validator forces very long intact text away from an image-text composition when vertical reading space is insufficient',async()=>{const { fingerprintImage,fingerprintText }=await load('fingerprint');const { generateSceneCandidates }=await load('candidates');const { validateSceneCandidate }=await load('validator');const image=fingerprintImage({id:'wide',width:1600,height:1000});const original='这段原话必须完整保留，不能拆开。'.repeat(22);const text=fingerprintText(original);const viewport={width:1200,height:760,mode:'desktop'};const candidates=generateSceneCandidates({image,text,rhythm:{},viewport});const imageText=candidates.filter(c=>c.sceneType==='image-text'),textOnly=candidates.filter(c=>c.sceneType==='text-only');assert.ok(imageText.length>0&&textOnly.length>0);assert.ok(imageText.every(c=>validateSceneCandidate(c,{viewport,safeInset:48,minTextPx:18}).valid===false));assert.ok(textOnly.some(c=>validateSceneCandidate(c,{viewport,safeInset:48,minTextPx:18}).valid===true));assert.ok(candidates.every(c=>!c.text||c.text===original));});

test('image-text candidate geometry reserves breathing room instead of relying on flex shrink',async()=>{const {fingerprintImage,fingerprintText}=await load('fingerprint');const {generateSceneCandidates}=await load('candidates');const image=fingerprintImage({id:'landscape',width:2048,height:1365,safeCrop:{confidence:0.9,x:0.05,y:0.05,width:0.9,height:0.9}});const text=fingerprintText('今天的安排，很舒适又得着。');const candidates=generateSceneCandidates({image,text,rhythm:{},viewport:{width:1440,height:900,mode:'desktop'}}).filter(c=>c.sceneType==='image-text');assert.ok(candidates.length>0);assert.ok(candidates.every(c=>(c.imageScale+c.textWidth)<=0.94),candidates.map(c=>c.imageScale+c.textWidth).join(','));});
