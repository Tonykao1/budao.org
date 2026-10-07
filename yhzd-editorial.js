(function(root, factory){
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YHZDEditorial = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const IMAGE_KEY = 'budao:yhzd:imageHistory:v2';
  const MESSAGE_KEY = 'budao:yhzd:messageHistory:v2';
  const HISTORY_LIMIT = 24;
  const SCENE_PREFS = ['landscape','landscape','portrait','landscape','landscape'];
  const MESSAGE_CAPS = [28,36,28,44,36];
  const MESSAGES = [
    '一路上都悬念不断......','如此用心，细致又丰富的预备和带领，我们度过了一个美好又丰盛的徒步之旅！','还有整体节奏，何时走动何时休息都计划得很精准啊。','恩典多多，收获满满','今天和弟兄姊妹们一起，感觉特别美好，感受到有祂的同在。感恩！','7—88岁的徒步团太壮观了！','今天无论是身体还是灵里，都收获满满，感恩弟兄姐妹们的陪伴和分享。','很巧妙的设计','一个老少咸宜，充满喜乐的身心灵快乐之旅！','有幸参加了这次活动，都是意外的惊喜。','感谢弟兄们搭建的信心之道。','经过这一天，傍晚回来走在城市的水泥路上感觉特别轻盈和踏实。','可以看漫山的花，还能直接退回小学生作息九点睡觉，真的太好了！','认识和不认识人的都在认真听故事。','感恩遇见','用心带领，详尽的总结复盘，感恩。','感恩祂。','很棒的经历','今天的安排，很舒适又得着。','感恩弟兄姐妹们彼此敞开的分享和陪伴！','很棒的体验，很有趣的经历','当天去时候怕迟到，超速百分之十被罚。','强度一点都不大，感觉还没缓过来。','113层，2034个台阶，300米......','活动太有意义了，身心被滋养，还结识了更多同路人。','非常被安慰','大家建立了信任而且让这份关系延续。','我期待未来步道同赏京城。','顺利找到包了','我居然是第一个到的','我都期待好久了，哎！祷告我明天生龙活虎！','我相信人与人的每一次相遇都是奇迹。','感恩这段相遇与安排，拆掉心墙，看见光。','Grateful for this.'
  ];

  function safeReadHistory(storage, key){
    try{
      if (!storage || typeof storage.getItem !== 'function') return [];
      const parsed = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
    }catch(_){ return []; }
  }

  function safeRemember(storage, key, id, limit = HISTORY_LIMIT){
    if (!id) return;
    try{
      if (!storage || typeof storage.setItem !== 'function') return;
      const next = safeReadHistory(storage, key).filter(x => x !== id);
      next.push(String(id));
      storage.setItem(key, JSON.stringify(next.slice(-limit)));
    }catch(_){}
  }

  function selectFresh(items, count, recentIds, idOf, excludeIds = []){
    const recent = new Set(recentIds || []);
    const excluded = new Set(excludeIds || []);
    const available = (items || []).filter(item => !excluded.has(idOf(item)));
    const fresh = available.filter(item => !recent.has(idOf(item)));
    const old = available.filter(item => recent.has(idOf(item)));
    return fresh.concat(old).slice(0, Math.max(0, count || 0));
  }

  function selectMessages(messages, caps, recentMessages){
    const recent = new Set(recentMessages || []);
    const used = new Set();
    const result = [];
    for (const cap of caps || []){
      const available = (messages || []).filter(message => !used.has(message));
      if (!available.length) break;
      const fresh = available.filter(message => !recent.has(message));
      const old = available.filter(message => recent.has(message));
      const ordered = fresh.concat(old);
      const fitting = ordered.filter(message => message.length <= cap);
      const choice = fitting[0] || ordered.slice().sort((a,b) => a.length - b.length)[0];
      if (choice){ used.add(choice); result.push(choice); }
    }
    return result;
  }

  function selectImages(images, scenePrefs, recentIds){
    const recent = new Set(recentIds || []);
    const used = new Set();
    const result = [];
    for (const pref of scenePrefs || []){
      const available = (images || []).filter(image => !used.has(image.id));
      if (!available.length) break;
      const fresh = available.filter(image => !recent.has(image.id));
      const old = available.filter(image => recent.has(image.id));
      const choice = fresh.find(image => image.orientation === pref)
        || fresh[0]
        || old.find(image => image.orientation === pref)
        || old[0];
      if (choice){ used.add(choice.id); result.push(choice); }
    }
    return result;
  }

  function shuffle(items, random = Math.random){
    const copy = (items || []).slice();
    for (let i = copy.length - 1; i > 0; i--){
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getStorage(win){
    try{ return win && win.localStorage ? win.localStorage : null; }
    catch(_){ return null; }
  }

  function createImage(doc, item, index){
    const small = item && item['480'];
    const large = item && item['960'];
    const source = index === 0 ? (large || small) : (small || large);
    if (!source || !source.src) return null;
    const img = doc.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.loading = index === 0 ? 'eager' : 'lazy';
    if (index === 0){ img.fetchPriority = 'high'; img.setAttribute('fetchpriority','high'); }
    if (Number.isFinite(item.width) && Number.isFinite(item.height)){ img.width = item.width; img.height = item.height; }
    img.src = source.src;
    if (small && large && small.src && large.src){
      img.srcset = small.src + ' 480w, ' + large.src + ' 960w';
      img.sizes = index === 0 ? '(max-width: 980px) 90vw, 54vw' : '(max-width: 980px) 90vw, 48vw';
    }
    return img;
  }

  async function initEditorialPage(doc, win){
    if (!doc || !win || typeof win.fetch !== 'function') return;
    const scenes = Array.from(doc.querySelectorAll('.editorial-scene'));
    if (!scenes.length) return;
    const storage = getStorage(win);
    let manifest;
    try{
      const response = await win.fetch('/images/yhzd/manifest.json', { cache:'no-cache' });
      if (!response || ('ok' in response && !response.ok)) return;
      manifest = await response.json();
    }catch(_){ return; }
    const images = Array.isArray(manifest && manifest.images) ? manifest.images : [];
    if (!images.length) return;

    const selectedImages = selectImages(shuffle(images), SCENE_PREFS.slice(0, scenes.length), safeReadHistory(storage, IMAGE_KEY));
    const selectedMessages = selectMessages(shuffle(MESSAGES), MESSAGE_CAPS.slice(0, scenes.length), safeReadHistory(storage, MESSAGE_KEY));

    scenes.forEach((scene, index) => {
      const media = scene.querySelector('.editorial-media');
      const quote = scene.querySelector('.editorial-quote');
      const text = quote && quote.querySelector('.editorial-quote-text');
      const item = selectedImages[index];
      const message = selectedMessages[index];
      if (media && item){
        const img = createImage(doc, item, index);
        if (img){
          media.replaceChildren(img);
          media.dataset.imageId = item.id;
          media.dataset.orientation = item.orientation || ((item.height || 0) > (item.width || 0) ? 'portrait' : 'landscape');
        }
      }
      if (quote && text && message){ text.textContent = message; quote.dataset.message = message; }
    });

    if (typeof win.IntersectionObserver === 'function'){
      const observer = new win.IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting || entry.intersectionRatio < .42) return;
          const node = entry.target;
          if (node.classList && node.classList.contains('editorial-media')) safeRemember(storage, IMAGE_KEY, node.dataset.imageId);
          if (node.classList && node.classList.contains('editorial-quote')) safeRemember(storage, MESSAGE_KEY, node.dataset.message);
          observer.unobserve(node);
        });
      }, { threshold:[.42] });
      scenes.forEach(scene => {
        const media = scene.querySelector('.editorial-media');
        const quote = scene.querySelector('.editorial-quote');
        if (media && media.dataset.imageId) observer.observe(media);
        if (quote && quote.dataset.message) observer.observe(quote);
      });
    }
  }

  return { selectFresh, selectMessages, selectImages, safeReadHistory, safeRemember, initEditorialPage };
}));
