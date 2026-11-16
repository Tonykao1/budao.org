'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('replay is opt-in and available only with an existing sheep and valid pasture session',()=>{
 const shell=read('tonglu.html'),live=read('pasture-live.js');
 assert.match(shell,/id="pastureArrivalReviewControls".*hidden/);
 assert.match(shell,/id="pastureArrivalReplayButton".*disabled/);
 assert.match(live,/function wantsArrivalReview\(\)\{return new URLSearchParams\(location\.search\)\.get\('sheepArrivalReview'\)==='1'/);
 assert.match(live,/arrivalReviewEligible=!!resident\?\.sheep/);
 assert.match(live,/replayControls\.hidden=!\(wantsArrivalReview\(\)&&arrivalReviewEligible&&resident\?\.sheep\)/);
 assert.match(live,/replayButton\.disabled=!coreEngineReady\|\|replayBusy/);
 assert.match(live,/if\(!wantsArrivalReview\(\)\|\|!arrivalReviewEligible\|\|!resident\?\.sheep\|\|!coreEngineReady\|\|replayBusy\)return/);
 assert.match(live,/function wantsAutoArrivalPreview\(\)/);
});
test('the replay button sends only the resident ID, not an issuance or persistence request',()=>{
 const live=read('pasture-live.js'),core=read('pasture-resident-core.js');
 assert.match(live,/postMessage\(\{type:'tonglu-resident-replay-arrival-v1',residentId:resident\.id\},location\.origin\)/);
 assert.match(core,/if\(e\.origin!==location\.origin\|\|e\.source!==window\.parent\)return/);
 assert.match(core,/if\(e\.data\?\.type==='tonglu-resident-replay-arrival-v1'\)/);
 assert.match(core,/!resident\?\.appearance\|\|arrivalStart\|\|String\(e\.data\.residentId\)!==String\(resident\.id\)/);
 const replayBranch=core.split("if(e.data?.type==='tonglu-resident-replay-arrival-v1'){")[1]?.split("if(e.data?.type!=='tonglu-resident-v1')return;")[0]||'';
 assert.match(replayBranch,/startArrivalCinematic\(\)/);
 assert.doesNotMatch(replayBranch,/initialPosition\(|savePosition\(|localStorage|fetch\(|saveSheep|activateCard|issueCard/);
 assert.doesNotMatch(live,/action:'saveSheep'.*sheepArrivalReview/);
});
test('approved 4.2-second first-entry animation is reused with no changes to registration or card art',()=>{
 const core=read('pasture-resident-core.js'),live=read('pasture-live.js');
 assert.match(core,/const ARRIVAL_DURATION_MS=4200;/);
 assert.match(core,/const ARRIVAL_IMPACT_AT=\.72;/);
 assert.match(core,/const BLEAT_URL='\/pasture-assets\/baaa01\.mp3';/);
 assert.match(live,/function showMaker\(review=false\)/);
 assert.match(live,/if\(data\.needsSheep\|\|!resident\?\.sheep\)showMaker\(false\)/);
 const html=read('tonglu.html');
 assert.match(html,/id="budaoCardBtn"/);
 assert.match(html,/id="grassBookBtn" aria-disabled="true"/);
 for(const path of ['pasture-live.js','pasture-resident-core.js'])assert.doesNotThrow(()=>new vm.Script(read(path),{filename:path}));
});
