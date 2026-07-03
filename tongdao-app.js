let activeConfig = null;



const state = {
  route: "home",
  history: [],
  peopleCount: 1,
  participants: [],
  estimatedMinutes: 90,
  place: "",
  weather: "",
  safetyConfirmed: false,
  groupMode: "natural",
  groupWarning: "",
  groups: [],
  pairHistory: new Set(),
  walkIndex: 1,
  timer: null,
  timerRemaining: 0,
  nextAfterGroups: "walk",
  warmupTimer: null,
  warmupPartIndex: 0,
  warmupRound: 1,
  warmupBeat: 0,
  warmupStarted: false,
  audioContext: null
};

const screen = document.getElementById("screen");

function pickRandomPack(packs) {
  return packs[Math.floor(Math.random() * packs.length)];
}

function startTongdao() {
  activeConfig = pickRandomPack(tongdaoPacks);
  showChosenPackIntro(activeConfig);
}

function setRoute(route, push = true) {
  stopTimer();
  stopWarmup();
  if (push && state.route !== route) {
    state.history.push(state.route);
  }
  state.route = route;
  renderRoute();
}

function goBack() {
  const previous = state.history.pop();
  if (previous) {
    setRoute(previous, false);
  }
}

function resetTongdao() {
  stopTimer();
  stopWarmup();
  activeConfig = null;
  state.route = "home";
  state.history = [];
  state.peopleCount = 1;
  state.participants = [];
  state.estimatedMinutes = 90;
  state.place = "";
  state.weather = "";
  state.safetyConfirmed = false;
  state.groupMode = "natural";
  state.groupWarning = "";
  state.groups = [];
  state.pairHistory = new Set();
  state.walkIndex = 1;
  state.nextAfterGroups = "walk";
  state.warmupPartIndex = 0;
  state.warmupRound = 1;
  state.warmupBeat = 0;
  state.warmupStarted = false;
  renderRoute();
}

function renderRoute() {
  const renderers = {
    home: renderHome,
    chosen: () => showChosenPackIntro(activeConfig),
    initialize: renderInitialize,
    welcome: renderWelcome,
    icebreaker: renderIcebreaker,
    warmup: renderWarmup,
    prayer: renderPrayer,
    groups: renderGroupsScreen,
    walk: renderWalk,
    story: renderStory,
    storyQuiet: () => renderQuietTimer("STORY", "请安静30秒", "不用急着解释。<br>让刚刚看见的，先安静留下。", 30, "继续", () => setRoute("word")),
    word: renderWord,
    wordQuiet: () => renderQuietTimer("WORD", "安静", "经文已经读完。<br>请不要急着解释。<br>安静一分钟。", 60, "继续", () => setRoute("wordAgain")),
    wordAgain: renderWordAgain,
    respond: renderRespond,
    go: renderGo,
    blessing: renderBlessing,
    hug: renderHug,
    closingPrayer: renderClosingPrayer,
    grow: renderGrow
  };
  renderers[state.route]();
}

function layout({ stage, title, body = "", extra = "", primary = "", onPrimary = null }) {
  screen.innerHTML = `
    <div>
      ${stage ? `<div class="stage">${stage}</div>` : ""}
      <h1 class="title">${title}</h1>
    </div>
    ${body ? `<div class="body">${body}</div>` : ""}
    ${extra}
    <div class="actions">
      <button class="plain" type="button" data-action="reset">重置同道</button>
      <div>
        ${state.history.length ? `<button class="secondary" type="button" data-action="back">返回上一步</button>` : ""}
        ${primary ? `<button class="primary" type="button" data-action="primary">${primary}</button>` : ""}
      </div>
    </div>
  `;

  screen.querySelector('[data-action="reset"]').addEventListener("click", resetTongdao);
  screen.querySelector('[data-action="back"]')?.addEventListener("click", goBack);
  if (typeof onPrimary === "function") {
    screen.querySelector('[data-action="primary"]')?.addEventListener("click", onPrimary);
  }
}

function renderHome() {
  layout({
    stage: "TONGDAO",
    title: `<span class="title-word"><span class="title-tong">同</span><span class="title-dao">道</span></span>`,
    body: `<p class="home-kicker">随时随地，一同步道</p>`,
    primary: "开始同道",
    onPrimary: startTongdao
  });
}

function showChosenPackIntro(pack) {
  state.route = "chosen";
  layout({
    stage: "TODAY",
    title: "今天，同道为我们预备了一段路。",
    body: `<p>主题：</p><div class="theme">《${escapeHtml(pack.theme)}》</div>`,
    primary: "开始这段路",
    onPrimary: () => setRoute("initialize")
  });
}

function renderInitialize() {
  const people = Array.from({ length: state.peopleCount }, (_, index) => {
    const person = state.participants[index] || { name: "", gender: "" };
    return `
      <div class="participant-row">
        <label class="field-line">
          <span>第${index + 1}位同伴</span>
          <input data-name="${index}" value="${escapeAttribute(person.name)}" placeholder="姓名">
        </label>
        <label class="field-line">
          <span>性别</span>
          <select data-gender="${index}">
            <option value="" ${person.gender === "" ? "selected" : ""}>不填写</option>
            <option value="男" ${person.gender === "男" ? "selected" : ""}>男</option>
            <option value="女" ${person.gender === "女" ? "selected" : ""}>女</option>
          </select>
        </label>
      </div>
    `;
  }).join("");

  layout({
    stage: "INITIALIZE",
    title: "开始之前",
    body: `<p class="init-call">请一位同伴拿起手机，发起今天的同道。</p>`,
    extra: `
      <div class="field-stack">
        <label class="field-line">
          <span>预计时间（分钟）</span>
          <input id="estimatedMinutes" type="number" min="1" value="${state.estimatedMinutes}" placeholder="90">
        </label>
        <label class="field-line">
          <span>人数</span>
          <input id="peopleCount" type="number" min="1" value="${state.peopleCount}" placeholder="8">
        </label>
        <div class="participant-list">${people}</div>
        <label class="field-line">
          <span>地点</span>
          <input id="place" value="${escapeAttribute(state.place)}" placeholder="奥克兰 East Ridge Loop / 北京某公园">
        </label>
        <label class="field-line">
          <span>天气</span>
          <input id="weather" value="${escapeAttribute(state.weather)}" placeholder="晴，有风，22°C">
        </label>
        <div class="group-mode">
          <div class="group-mode-title">分组方式</div>
          <div class="group-mode-options">
            <label>
              <input type="radio" name="groupMode" value="natural" ${state.groupMode === "natural" ? "checked" : ""}>
              <span>自然分组</span>
            </label>
            <label>
              <input type="radio" name="groupMode" value="sameGender" ${state.groupMode === "sameGender" ? "checked" : ""}>
              <span>同性分组</span>
            </label>
          </div>
        </div>
        <label class="check-line safety-covenant">
          <input id="safetyConfirmed" type="checkbox" ${state.safetyConfirmed ? "checked" : ""}>
          <span>我承诺：使用手机时双脚站定，行进中不看手机。</span>
        </label>
        <div class="message" id="message"></div>
      </div>
    `,
    primary: "开始",
    onPrimary: finishInitialize
  });

  document.getElementById("peopleCount").addEventListener("change", () => {
    collectInitialize();
    state.peopleCount = Math.max(1, Number(document.getElementById("peopleCount").value || 1));
    renderInitialize();
  });
}

function collectInitialize() {
  state.estimatedMinutes = Number(document.getElementById("estimatedMinutes")?.value || 90);
  state.peopleCount = Math.max(1, Number(document.getElementById("peopleCount")?.value || 1));
  state.place = document.getElementById("place")?.value.trim() || "";
  state.weather = document.getElementById("weather")?.value.trim() || "";
  state.safetyConfirmed = Boolean(document.getElementById("safetyConfirmed")?.checked);
  state.groupMode = document.querySelector('input[name="groupMode"]:checked')?.value || "natural";
  state.participants = Array.from({ length: state.peopleCount }, (_, index) => ({
    name: document.querySelector(`[data-name="${index}"]`)?.value.trim() || "",
    gender: document.querySelector(`[data-gender="${index}"]`)?.value || ""
  }));
}

function finishInitialize() {
  collectInitialize();
  if (!state.safetyConfirmed) {
    document.getElementById("message").textContent = "请先确认安全须知，然后我们再开始。";
    return;
  }
  state.participants = Array.from({ length: state.peopleCount }, (_, index) => ({
    name: state.participants[index]?.name || `同伴${index + 1}`,
    gender: state.participants[index]?.gender || ""
  }));
  setRoute("welcome");
}

function renderWelcome() {
  layout({
    stage: "ENTER",
    title: "欢迎来到同道。",
    body: `<div class="welcome-poem">
      今天，我们一路同行步道，<br>
      带领我们的，<br>
      不是手机，<br>
      不是网页，<br>
      也不是任何一个人。<br><br>
      就让我们<br>
      一步一步，<br>
      行走道中，<br>
      去往祂的同在。
    </div>`,
    primary: "继续",
    onPrimary: () => setRoute("icebreaker")
  });
}

function renderIcebreaker() {
  const icebreakers = getIcebreakers();
  layout({
    stage: "ENTER",
    title: "三问破冰",
    body: `<p>请每个人依次分享。<br>每人简短即可。</p>
      <div class="quiet-box">
        <ol class="icebreaker-list">
          ${icebreakers.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}
        </ol>
      </div>`,
    primary: "完成破冰",
    onPrimary: () => setRoute("warmup")
  });
}

function getIcebreakers() {
  const fallback = [
    "你的名字？",
    "今天来到这里，你带着怎样的期待？",
    "最近有什么让你印象深刻的小事？"
  ];
  return Array.isArray(activeConfig?.icebreakers) && activeConfig.icebreakers.length === 3
    ? activeConfig.icebreakers
    : fallback;
}

function renderWarmup() {
  const parts = getWarmupParts();
  layout({
    stage: "ENTER",
    title: "七步热身",
    body: `<p>请跟随节拍完成七步热身。<br>每一组动作 4 个 8 拍。</p>
      <div class="warmup-list">
        ${parts.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}
      </div>`,
    extra: `<div class="warmup-status" id="warmupStatus"></div>`,
    primary: state.warmupStarted ? "继续热身" : "开始热身",
    onPrimary: startWarmup
  });
  addSkipWarmupButton();
  renderWarmupProgress();
}

function getWarmupParts() {
  return ["头颈", "肩背", "腰", "胯", "腿", "膝", "脚踝手腕"];
}

function startWarmup() {
  stopWarmup();
  state.warmupStarted = true;
  state.warmupPartIndex = 0;
  state.warmupRound = 1;
  state.warmupBeat = 0;
  renderWarmupProgress();
  const button = screen.querySelector('[data-action="primary"]');
  if (button) button.disabled = true;
  state.warmupTimer = window.setInterval(tickWarmup, 500);
  tickWarmup();
}

function addSkipWarmupButton() {
  const actionGroup = screen.querySelector(".actions > div");
  const primaryButton = screen.querySelector('[data-action="primary"]');
  if (!actionGroup || !primaryButton) return;
  const skipButton = document.createElement("button");
  skipButton.className = "secondary";
  skipButton.type = "button";
  skipButton.textContent = "跳过热身";
  skipButton.addEventListener("click", skipWarmup);
  actionGroup.insertBefore(skipButton, primaryButton);
}

function skipWarmup() {
  stopWarmup();
  state.warmupStarted = false;
  setRoute("prayer");
}

function tickWarmup() {
  state.warmupBeat += 1;
  if (state.warmupBeat > 8) {
    state.warmupBeat = 1;
    state.warmupRound += 1;
  }
  if (state.warmupRound > 4) {
    state.warmupRound = 1;
    state.warmupPartIndex += 1;
  }
  if (state.warmupPartIndex >= getWarmupParts().length) {
    finishWarmup();
    return;
  }
  playBeat(state.warmupBeat === 1);
  renderWarmupProgress();
}

function renderWarmupProgress() {
  const status = document.getElementById("warmupStatus");
  if (!status) return;
  const parts = getWarmupParts();
  const current = parts[state.warmupPartIndex] || parts[0];
  status.innerHTML = `
    <div class="warmup-current">当前：${escapeHtml(current)}</div>
    <div class="warmup-round">第 ${state.warmupRound} 组 / 4 组</div>
    <div class="beat-row">
      ${Array.from({ length: 8 }, (_, index) => {
        const beat = index + 1;
        return `<span class="beat ${beat === state.warmupBeat ? "is-active" : ""}">${beat}</span>`;
      }).join("")}
    </div>
  `;
}

function finishWarmup() {
  stopWarmup();
  state.warmupStarted = false;
  state.warmupPartIndex = getWarmupParts().length - 1;
  state.warmupRound = 4;
  state.warmupBeat = 8;
  renderWarmupProgress();
  const button = screen.querySelector('[data-action="primary"]');
  if (button) {
    const nextButton = button.cloneNode(true);
    nextButton.disabled = false;
    nextButton.textContent = "热身完成";
    nextButton.addEventListener("click", () => setRoute("prayer"));
    button.replaceWith(nextButton);
  }
  if (navigator.vibrate) navigator.vibrate(250);
}

function stopWarmup() {
  if (state.warmupTimer) {
    window.clearInterval(state.warmupTimer);
    state.warmupTimer = null;
  }
}

function playBeat(strong) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!state.audioContext) state.audioContext = new AudioContext();
    const ctx = state.audioContext;
    if (ctx.state === "suspended") ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = strong ? 760 : 560;
    gain.gain.setValueAtTime(strong ? 0.12 : 0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.09);
  } catch (error) {
    // Visual beat continues if audio is unavailable.
  }
}

function renderPrayer() {
  renderQuietTimer(
    "ENTER",
    "摩西祷告",
    `<div class="prayer-figure" aria-hidden="true">
      <svg viewBox="0 0 160 180" role="img">
        <path d="M42 164H118" opacity="0.36"></path>
        <circle cx="80" cy="45" r="13"></circle>
        <path d="M80 58V104"></path>
        <path d="M78 70C62 58 53 43 47 27"></path>
        <path d="M82 70C98 58 107 43 113 27"></path>
        <path d="M80 104L60 146"></path>
        <path d="M80 104L100 146"></path>
      </svg>
    </div>
    请安静站立。<br><br>
    双腿分开，<br>
    缓缓屈膝，<br>
    上身尽量挺直。<br><br>
    双手打开，<br>
    从前向上，<br>
    举过头顶。<br><br>
    抬头仰望，<br>
    开声祷告，<br>
    或在心里说：<br><br>
    我在这里。<br>
    愿你带领我们今天的路。`,
    60,
    "祷告完成",
    () => startGroupRound("walk")
  );
}

function startGroupRound(nextRoute) {
  state.nextAfterGroups = nextRoute;
  generateGroups();
  setRoute("groups");
}

function renderGroupsScreen() {
  const solo = isSolo();
  const label = state.nextAfterGroups === "respond" ? "进入回应" : state.nextAfterGroups === "go" ? "继续" : "开始同行";
  layout({
    stage: "PAIR",
    title: solo ? "安静默想" : "同行伙伴",
    body: solo ? "<p>今天进入独行模式。<br>请安静默想，也可以轻声说出来。</p>" : "<p>请按照手机上的名字，寻找这一轮的同行者。</p>",
    extra: solo ? "" : `${state.groupWarning ? `<div class="message">${escapeHtml(state.groupWarning)}</div>` : ""}<div class="groups">${renderGroupList()}</div>`,
    primary: label,
    onPrimary: () => setRoute(state.nextAfterGroups)
  });
}

function renderWalk() {
  const topic = activeConfig.topics[`topic${state.walkIndex}`];
  renderShareTimer({
    stage: "WALK",
    title: `同行${["", "①", "②", "③", "④", "⑤"][state.walkIndex]}`,
    question: topic,
    prompt: isSolo()
      ? "请安静默想，也可以轻声说出来。"
      : "请轮流分享。<br>不用评价。<br>不用给答案。<br>只需要认真听。",
    doneText: isSolo()
      ? "刚刚的话，可以留在路上。现在，请继续默想。"
      : "刚刚的话，可以留在路上。现在，请寻找新的同行者。",
    doneButton: isSolo() ? "继续" : "重新配对",
    onDone: () => {
      state.walkIndex += 1;
      if (state.walkIndex <= 5) {
        startGroupRound("walk");
      } else {
        setRoute("story");
      }
    }
  });
}

function renderStory() {
  layout({
    stage: "STORY",
    title: "故事",
    body: `<p>接下来，请一起观看今天的故事。<br>不用急着解释。<br>只需要观看。</p>
      <div class="quiet-box">
        <p>今天的故事：<br>《${escapeHtml(activeConfig.storyTitle)}》</p>
        <p>${activeConfig.storyVideoUrl ? "请播放今天的故事视频。" : `请由一位同伴简单读出或讲述今天的故事：《${escapeHtml(activeConfig.storyTitle)}》。`}</p>
      </div>`,
    primary: "故事完成",
    onPrimary: () => setRoute("storyQuiet")
  });
}

function renderWord() {
  layout({
    stage: "WORD",
    title: "圣言",
    body: `<p>现在，让我们一起安静，<br>听一听神的话。</p>
      <div class="scripture">
        ${escapeHtml(activeConfig.scriptureReference)}<br><br>
        ${escapeHtml(activeConfig.scriptureText)}
      </div>`,
    primary: "请一位同伴读出经文",
    onPrimary: () => setRoute("wordQuiet")
  });
}

function renderWordAgain() {
  layout({
    stage: "WORD",
    title: "再次读经",
    body: "<p>请换一位同伴，<br>再读一遍这段经文。</p>",
    primary: "读完了",
    onPrimary: () => startGroupRound("respond")
  });
}

function renderRespond() {
  renderShareTimer({
    stage: "RESPOND",
    title: "回应",
    question: activeConfig.topics.topic6,
    prompt: isSolo()
      ? "这不是答题。<br>这是回应。<br><br>请安静默想，也可以轻声说出来。"
      : "这不是答题。<br>这是回应。<br><br>请分享：<br>今天，神是否借着路、故事、经文，提醒你什么？",
    doneText: "谢谢你愿意真实分享。",
    doneButton: isSolo() ? "继续" : "重新配对",
    onDone: () => startGroupRound("go")
  });
}

function renderGo() {
  renderShareTimer({
    stage: "GO",
    title: "带着它继续走",
    question: activeConfig.topics.topic7,
    prompt: isSolo() ? "请安静默想，也可以轻声说出来。" : "请轮流分享。<br>不用评价。<br>不用给答案。",
    doneText: "刚刚领受的，可以慢慢带回生活里。",
    doneButton: "继续",
    onDone: () => setRoute("blessing")
  });
}

function renderBlessing() {
  layout({
    stage: "GO",
    title: "彼此祝福",
    body: `<p>请两三个人为一组。可以选择：</p>
      <div class="quiet-box">
        <p>1. 为彼此做一个简短祷告；</p>
        <p>2. 给对方一句祝福；</p>
        <p>3. 如果你还不习惯祷告，可以说：愿你平安。</p>
      </div>`,
    primary: "完成祝福",
    onPrimary: () => setRoute("hug")
  });
}

function renderHug() {
  layout({
    stage: "GO",
    title: "彼此拥抱",
    body: `<p>弟兄之间，<br>
      姊妹之间，<br>
      彼此拥抱告别。</p>
      <p>未来的重逢，<br>
      让我们以拥抱开始。</p>
      <p class="note-small">若不方便拥抱，可以用握手、点头或一句祝福代替。</p>`,
    primary: "完成拥抱",
    onPrimary: () => setRoute("closingPrayer")
  });
}

function renderClosingPrayer() {
  layout({
    stage: "GO",
    title: "结束祷告",
    body: `<p>请一位愿意的同伴，带大家做简短结束祷告。</p>
      <p>如果没有人愿意，可以一起读：</p>
      <div class="quiet-box">
        <p>主啊，<br>谢谢你今天与我们同行。<br>求你把我们带回真实的生活里，<br>也把今天领受的提醒，<br>放在我们心里。<br>阿们。</p>
      </div>`,
    primary: "完成今天的同道",
    onPrimary: () => setRoute("grow")
  });
}

function renderGrow() {
  layout({
    stage: "GROW",
    title: "本周同行挑战",
    body: `<div class="challenge">${escapeHtml(activeConfig.growthChallenge)}</div>
      <p>请截图保存。<br>同行没有结束，<br>只是今天的路走到这里。</p>`,
    primary: "返回步道首页",
    onPrimary: () => {
      window.location.href = "/home.html";
    }
  });
}

function renderQuietTimer(stage, title, text, seconds, buttonText, onDone) {
  layout({
    stage,
    title,
    body: `<div>${text}</div>`,
    extra: `<div class="timer" id="timer">${formatTime(seconds)}</div>`,
    primary: buttonText,
    onPrimary: onDone
  });
  const button = screen.querySelector('[data-action="primary"]');
  button.disabled = true;
  startTimer(seconds, () => {
    button.disabled = false;
    if (navigator.vibrate) navigator.vibrate(300);
  });
}

function renderShareTimer({ stage, title, question, prompt, doneText, doneButton, onDone }) {
  layout({
    stage,
    title,
    body: `<div class="question">${escapeHtml(question)}</div><p>${prompt}</p>`,
    extra: `<div class="timer" id="timer">5:00</div><div class="message" id="timerMessage"></div>`,
    primary: "开始计时",
    onPrimary: null
  });

  const button = screen.querySelector('[data-action="primary"]');
  button.addEventListener("click", () => {
    button.textContent = "可以提前结束";
    startTimer(300, () => finishShareTimer(button, doneText, doneButton, onDone));
    button.onclick = () => {
      stopTimer();
      document.getElementById("timer").textContent = "0:00";
      finishShareTimer(button, doneText, doneButton, onDone);
    };
  }, { once: true });
}

function finishShareTimer(button, doneText, doneButton, onDone) {
  document.getElementById("timerMessage").textContent = doneText;
  button.textContent = doneButton;
  button.onclick = onDone;
  if (navigator.vibrate) navigator.vibrate(300);
}

function startTimer(seconds, onDone) {
  stopTimer();
  state.timerRemaining = seconds;
  updateTimer();
  state.timer = window.setInterval(() => {
    state.timerRemaining -= 1;
    updateTimer();
    if (state.timerRemaining <= 0) {
      stopTimer();
      onDone();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = null;
  }
}

function updateTimer() {
  const timer = document.getElementById("timer");
  if (timer) {
    timer.textContent = formatTime(Math.max(0, state.timerRemaining));
  }
}

function formatTime(seconds) {
  const minute = Math.floor(seconds / 60);
  const second = String(seconds % 60).padStart(2, "0");
  return `${minute}:${second}`;
}

function isSolo() {
  return state.participants.length <= 1;
}

function generateGroups() {
  state.groupWarning = "";
  if (isSolo()) {
    state.groups = [];
    return;
  }

  if (state.groupMode === "sameGender") {
    state.groups = generateSameGenderGroups(state.participants);
  } else {
    state.groups = buildBestGroups(state.participants);
  }

  addPairHistory(state.groups);
}

function generateSameGenderGroups(participants) {
  const men = participants.filter((person) => person.gender === "男");
  const women = participants.filter((person) => person.gender === "女");
  const others = participants.filter((person) => person.gender !== "男" && person.gender !== "女");
  const groups = [];
  const leftovers = [];

  [men, women, others].forEach((bucket) => {
    if (bucket.length === 1) {
      leftovers.push(bucket[0]);
      return;
    }
    const bucketGroups = buildBestGroups(bucket);
    bucketGroups.forEach((group) => {
      if (group.length === 1) {
        leftovers.push(group[0]);
      } else {
        groups.push(group);
      }
    });
  });

  if (leftovers.length) {
    state.groupWarning = "现场人数暂时无法完全同性分组，系统将尽量安排。";
    if (leftovers.length === 1 && groups.length) {
      groups[groups.length - 1].push(leftovers[0]);
    } else {
      buildBestGroups(leftovers).forEach((group) => groups.push(group));
    }
  }

  return groups;
}

function buildBestGroups(participants) {
  if (participants.length <= 1) return participants.length ? [participants] : [];

  let bestGroups = [];
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const groups = createCandidateGroups(shuffle([...participants]));
    const score = scoreGroups(groups);
    if (score < bestScore) {
      bestGroups = groups;
      bestScore = score;
    }
    if (score === 0) break;
  }
  return bestGroups;
}

function createCandidateGroups(shuffled) {
  const groups = [];
  let index = 0;
  while (index < shuffled.length) {
    const remaining = shuffled.length - index;
    if (remaining === 3) {
      groups.push(shuffled.slice(index, index + 3));
      break;
    }
    groups.push(shuffled.slice(index, index + 2));
    index += 2;
  }
  return groups;
}

function scoreGroups(groups) {
  return pairSignatures(groups).reduce((score, signature) => {
    return score + (state.pairHistory.has(signature) ? 1 : 0);
  }, 0);
}

function addPairHistory(groups) {
  pairSignatures(groups).forEach((signature) => state.pairHistory.add(signature));
}

function pairSignatures(groups) {
  const signatures = [];
  groups.forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        signatures.push([group[i].name, group[j].name].sort().join("|"));
      }
    }
  });
  return signatures;
}

function renderGroupList() {
  return state.groups.map((group, index) => `
    <div class="group">
      <small>第${index + 1}组</small>
      ${group.map((person) => escapeHtml(person.name)).join(" + ")}
    </div>
  `).join("");
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

renderRoute();