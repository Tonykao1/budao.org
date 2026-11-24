/* BUDAO 时辰赞美 — browser-local, source-note-based SID-inspired oscillator.
 * This module never changes the pasture landscape, flock, weather or registration.
 * It synthesizes the complete source note events, not encoded MP3 masters.
 * Not a cycle-accurate MOS 6581 emulator.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BudaoHourlyHymns = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const STORAGE = 'budao:pasture-hourly-hymns:v1';
  const SR = 32000;
  const AMPS = [.095, .073, .082, .086];
  const ALPHAS = [.22, .35, .20, .18];
  const ATTACKS = [.075, .034, .045, .020];
  const WAVES = ['pulse', 'triangle', 'saw', 'pulse'];
  function songIndex(d) { return d.getHours() % 12; }
  function isQuietHour(d) { const h = d.getHours(); return h >= 22 || h < 7; }
  function nextLocalHour(date) {
    const d = new Date(date.getTime());
    d.setMinutes(0,0,0);
    d.setHours(d.getHours()+1);
    return d;
  }
  function normalizeSettings(obj) {
    const a = obj && typeof obj === 'object' ? obj : {};
    return {volume:Number.isFinite(Number(a.volume)) ? Math.max(0,Math.min(1,Number(a.volume))) : .32,
      quiet:a.quiet !== false};
  }
  function decodeVoice(str) {
    const s=atob(str);
    if (s.length % 6) throw Error('Invalid hymn score');
    const out=[];
    let cursor=0;
    for(let i=0;i<s.length;i+=6){
      const delta=s.charCodeAt(i)+256*s.charCodeAt(i+1);
      const duration=s.charCodeAt(i+2)+256*s.charCodeAt(i+3);
      const pitch=s.charCodeAt(i+4),velocity=s.charCodeAt(i+5);
      if(!duration||pitch>127||velocity>127) throw Error('Invalid note');
      cursor+=delta;
      out.push({tick:cursor,duration,pitch,velocity});
    }
    return out;
  }
  function cycleSeconds(s){return s.cycleTicks*s.tempo/(s.ticks*1000000);}
  function renderOnePass(ctx,song){
    if(!song||![2,4].includes(song.parts?.length))throw Error('Incomplete source hymn');
    const seconds=cycleSeconds(song);
    if(seconds<2||seconds>180)throw Error('Hymn duration out of range');
    const buffer=new Float32Array(Math.ceil(SR*seconds));
    const isTwo= song.scoreType==='MIDI-2-part';
    let totalNotes=0;
    for(let p=0;p<song.parts.length;p++){
      const part=decodeVoice(song.parts[p]); totalNotes+=part.length;
      for(const note of part){
        const startSeconds=note.tick*song.tempo/(song.ticks*1000000);
        const duration=note.duration*song.tempo/(song.ticks*1000000);
        const start=Math.round(SR*startSeconds);
        const samples=Math.min(Math.round(SR*duration),buffer.length-start);
        if(samples<=0)continue;
        const frequency=440*Math.pow(2,(note.pitch-69)/12);
        const mode=isTwo?(p===0?'pulse':note.pitch<53?'triangle':'saw'):WAVES[p];
        const amp=isTwo?(p===0?.10:.09)*(note.velocity/95):AMPS[p];
        const alpha=isTwo?(p===0?.22:.20):ALPHAS[p];
        const attack=isTwo?(p===0?.075:.045):ATTACKS[p];
        const release=Math.min(.09,Math.max(.06,.20*duration));
        let filtered=0;
        for(let n=0;n<samples;n++){
          const t=n/SR,phase=(t*frequency)%1;
          let raw;
          if(mode==='pulse'){
            const width=(p===0?.28:.44)+.015*Math.sin(2*Math.PI*.65*t);
            raw=phase<width?1:-1;
          } else if(mode==='triangle') raw=4*Math.abs(phase-.5)-1;
          else raw=2*phase-1;
          const envelope=Math.min(1,t/attack)*(.8+.2*Math.exp(-t/.15))*Math.max(0,Math.min(1,(duration-t)/release));
          const input=isTwo?raw:raw*envelope;
          filtered=alpha*input+(1-alpha)*filtered;
          buffer[start+n]+=amp*(isTwo?filtered*envelope:filtered);
        }
      }
    }
    if(!totalNotes)throw Error('Empty hymn');
    for(let n=0;n<buffer.length;n++) buffer[n]=Math.tanh(buffer[n]*1.45);
    const audio=ctx.createBuffer(1,buffer.length,SR);
    audio.copyToChannel(buffer,0);
    return audio;
  }
  function init(options){
    const cfg=options||{};
    const win=cfg.window||window, doc=cfg.document||document;
    const scores=cfg.scores||win.BudaoPastureHymnScores;
    if(!Array.isArray(scores)||scores.length!==12)throw Error('Expected twelve validated source hymns');
    const area=doc.getElementById('pastureHymnControl');
    if(!area)throw Error('Missing hourly hymn controls');
    const toggle=area.querySelector('[data-hourly-toggle]');
    const panel=area.querySelector('[data-hourly-panel]');
    const arm=area.querySelector('[data-hourly-arm]');
    const preview=area.querySelector('[data-hourly-preview]');
    const stop=area.querySelector('[data-hourly-stop]');
    const volume=area.querySelector('[data-hourly-volume]');
    const quiet=area.querySelector('[data-hourly-quiet]');
    const next=area.querySelector('[data-hourly-next]');
    const status=area.querySelector('[data-hourly-status]');
    let settings;
    try{settings=normalizeSettings(JSON.parse(win.localStorage.getItem(STORAGE)));}catch(_){settings=normalizeSettings(null);}
    let context=null,enabled=false,active=null,prepared=null,scheduling=null;
    let lastHour=null,timer=null,busy=false,disposed=false;
    const say=t=>{status.textContent=t;};
    function save(){try{win.localStorage.setItem(STORAGE,JSON.stringify(settings));}catch(_){}}
    function emit(kind,detail){
      try{win.dispatchEvent(new CustomEvent('budao:hourly-hymn:'+kind,{detail}));}catch(_){}
    }
    function refresh(){
      const date=nextLocalHour(new Date());
      const score=scores[songIndex(date)];
      next.textContent=String(date.getHours()).padStart(2,'0')+':00 · '+score.zh+(settings.quiet&&isQuietHour(date)?'（静默）':'');
      arm.textContent=enabled?'关闭整点赞美':'开启整点赞美';
      toggle.setAttribute('aria-label',enabled?'时辰赞美，已开启':'时辰赞美，未开启');
      volume.value=String(Math.round(settings.volume*100));
      quiet.checked=settings.quiet;
    }
    function stopNow(reason){
      if(!active)return;
      const old=active;active=null;
      try{old.source.stop();old.source.disconnect();old.gain.disconnect();}catch(_){}
      stop.hidden=true;
      emit('stop',{reason,index:old.index});
      if(enabled)say('等待下一个整点');
    }
    function schedule(){
      if(timer!==null){win.clearTimeout(timer);timer=null;}
      if(disposed)return;
      const now=new Date(),hour=nextLocalHour(now);
      scheduling=hour.getTime();
      timer=win.setTimeout(()=>{
        timer=null;
        const current=scheduling;
        if(Date.now()-current>=-120&&Date.now()-current<=1500)playHour(new Date(current),false);
        schedule();
        win.setTimeout(prepareUpcoming,10);
      },Math.max(50,hour.getTime()-now.getTime()));
      refresh();
    }
    function prepareUpcoming(){
      if(!enabled||disposed||busy||!context)return;
      const index=songIndex(nextLocalHour(new Date()));
      if(prepared?.index===index)return;
      busy=true;
      try{prepared={index,buffer:renderOnePass(context,scores[index])};}
      catch(_){prepared=null;say('音乐准备失败，请重新开启');}
      finally{busy=false;}
    }
    function playHour(hour,manual){
      if(!enabled||disposed||doc.hidden||!context)return;
      if(!manual&&settings.quiet&&isQuietHour(hour))return;
      if(!manual&&lastHour===hour.getTime())return;
      if(!manual)lastHour=hour.getTime();
      if(context.state!=='running'){
        enabled=false;stopNow('suspended');say('浏览器暂停了声音，请点击重新开启');refresh();return;
      }
      const index=songIndex(hour),song=scores[index];
      let buffer;
      try{buffer=prepared?.index===index?prepared.buffer:renderOnePass(context,song);}
      catch(_){say('无法解析音乐数据，请稍后重试');return;}
      prepared=null;
      stopNow('next-song');
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(context.destination);
      const at=context.currentTime+.02,duration=cycleSeconds(song)*song.stanzas;
      gain.gain.setValueAtTime(0,at);
      gain.gain.linearRampToValueAtTime(settings.volume,at+Math.min(2,duration/4));
      gain.gain.setValueAtTime(settings.volume,at+Math.max(2,duration-2));
      gain.gain.linearRampToValueAtTime(0,at+duration);
      source.start(at);source.stop(at+duration);
      active={source,gain,index};
      source.onended=()=>{
        if(active?.source===source){active=null;stop.hidden=true;emit('stop',{reason:'ended',index});say('等待下一个整点');}
        try{source.disconnect();gain.disconnect();}catch(_){}
      };
      stop.hidden=false;
      say((manual?'试听：':'整点：')+song.zh+' · '+song.stanzas+'节');
      emit('start',{index,title:song.zh,duration});
    }
    async function enable(){
      if(enabled){enabled=false;stopNow('disabled');say('已关闭，点击可重新开启');refresh();return;}
      const Ctor=win.AudioContext||win.webkitAudioContext;
      if(!Ctor){say('当前浏览器不支持声音合成');return;}
      try{
        if(!context)context=new Ctor({sampleRate:SR});
        await context.resume();
        if(context.state!=='running')throw Error('Suspended');
        enabled=true;say('已开启，等待下一个整点');refresh();win.setTimeout(prepareUpcoming,0);
      }catch(_){enabled=false;say('浏览器禁止自动播放，请再次点击开启');}
    }
    function openPanel(value){panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));if(value)refresh();}
    toggle.addEventListener('click',()=>openPanel(panel.hidden));
    arm.addEventListener('click',enable);
    preview.addEventListener('click',async()=>{if(!enabled)await enable();if(enabled)playHour(new Date(),true);});
    stop.addEventListener('click',()=>stopNow('user'));
    volume.addEventListener('input',()=>{
      settings.volume=Number(volume.value)/100;
      if(active&&context)active.gain.gain.setTargetAtTime(settings.volume,context.currentTime,.12);
      save();
    });
    quiet.addEventListener('change',()=>{settings.quiet=quiet.checked;save();refresh();});
    doc.addEventListener('visibilitychange',()=>{
      if(doc.hidden){stopNow('hidden');return;}
      schedule();if(enabled)prepareUpcoming();
    });
    win.addEventListener('pageshow',schedule);
    win.addEventListener('pagehide',()=>stopNow('pagehide'));
    doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){openPanel(false);toggle.focus();}});
    schedule();say('默认静音 · 点击开启整点赞美');
    return Object.freeze({
      get state(){return{enabled,volume:settings.volume,quiet:settings.quiet,playing:!!active,nextHour:scheduling};},
      disable(){enabled=false;stopNow('disabled');refresh();},
      dispose(){disposed=true;if(timer!==null)win.clearTimeout(timer);stopNow('disposed');if(context)context.close();}
    });
  }
  return Object.freeze({songIndex,isQuietHour,nextLocalHour,normalizeSettings,decodeVoice,cycleSeconds,renderOnePass,init});
});
if(typeof window!=='undefined'&&typeof document!=='undefined'){
  window.addEventListener('DOMContentLoaded',()=>{
    if(!document.getElementById('pastureHymnControl'))return;
    try{window.__budaoPastureHourlyHymns=window.BudaoHourlyHymns.init();}
    catch(err){console.warn('[BUDAO] Hourly hymn disabled:',err.message);}
  });
}
