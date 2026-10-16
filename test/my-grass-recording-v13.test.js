const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..','pasture-preview');
const app=()=>fs.readFileSync(path.join(base,'my-grass-v1.js'),'utf8');
const css=()=>fs.readFileSync(path.join(base,'my-grass-immersive-v04.css'),'utf8');

test('V1.3 recording restores the compact physical recorder console instead of generic form buttons',()=>{
 const src=app();
 assert.match(src,/gs-recorder-console/);
 assert.match(src,/gs-recorder-key[\s\S]*data-action="record"/);
 assert.match(src,/data-action="play"[\s\S]*播放\/暂停/);
 assert.match(src,/data-action="rerecord"[\s\S]*重录/);
 assert.match(src,/gs-recorder-screen/);
 assert.match(src,/data-action="link-audio"/);
 assert.doesNotMatch(src,/data-field="audioVerified"/);
 assert.doesNotMatch(src,/gs-voice-mark/);
});

test('recording cannot start until the scripture reading selection is explicitly completed',()=>{
 const src=app();
 assert.match(src,/function recordingSelectionReady\(\)/);
 assert.match(src,/gsReadingDoneBadge/);
 assert.match(src,/if\(!recordingSelectionReady\(\)\)[\s\S]{0,220}请先完成左侧经文的阅读选择/);
});

test('recorded audio must be linked to the selected scripture before playback or save',()=>{
 const src=app();
 assert.match(src,/function linkRecording\(/);
 assert.match(src,/confirm\([\s\S]{0,220}建立绑定/);
 assert.match(src,/verifiedAgainstRecording=true/);
 assert.match(src,/function togglePlayback\(/);
 assert.match(src,/if\(!draft\.scripture\.verifiedAgainstRecording\)[\s\S]{0,220}先.*链接/);
 assert.match(src,/function saveEntry\([\s\S]*draft\.reading\.audioId&&!draft\.scripture\.verifiedAgainstRecording/);
});

test('re-recording has a remorse confirmation and clears the previous binding',()=>{
 const src=app();
 assert.match(src,/function rerecordAudio\(/);
 assert.match(src,/confirm\([\s\S]{0,220}放弃这次录音/);
 assert.match(src,/deleteAudio\(/);
 assert.match(src,/verifiedAgainstRecording=false/);
});

test('physical recorder styling stays compact and uses a screen-plus-key layout',()=>{
 const style=css();
 assert.match(style,/\.gs-recorder-console\{/);
 assert.match(style,/\.gs-recorder-keys\{/);
 assert.match(style,/\.gs-recorder-key\{/);
 assert.match(style,/\.gs-recorder-screen\{/);
 assert.match(style,/\.gs-recorder-link\{/);
 assert.match(style,/data-state="recording"/);
});
