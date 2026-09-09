/*
 * Tongdao direct journey extension.
 *
 * The complete Tongdao flow remains the default. Experienced Budao leaders
 * can bypass facilitation mechanics and move directly through the current
 * journey content. This intentionally models content as journey nodes rather
 * than exposing a "seven questions" mode.
 */

(function installTongdaoDirectJourney() {
  const DIRECT_ROUTE = "directJourney";
  const originalRenderInitialize = renderInitialize;
  const originalRenderRoute = renderRoute;
  let directNodeIndex = 0;

  const directStyle = document.createElement("style");
  directStyle.textContent = `
    .direct-entry-wrap {
      display: grid;
      gap: 8px;
      padding-top: 2px;
      text-align: center;
    }

    .direct-entry {
      justify-self: center;
      min-height: 38px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #4d463d;
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      letter-spacing: 0.08em;
      text-decoration: underline;
      text-decoration-color: rgba(77, 70, 61, 0.28);
      text-underline-offset: 5px;
      transition: opacity 0.2s ease;
    }

    .direct-entry:hover,
    .direct-entry:active {
      opacity: 0.58;
    }

    .direct-entry-note {
      color: #9d968b;
      font-size: 12px;
      line-height: 1.8;
      letter-spacing: 0.04em;
    }

    .direct-context {
      color: #8f8679;
      font-size: 12px;
      line-height: 1.8;
      letter-spacing: 0.08em;
    }
  `;
  document.head.appendChild(directStyle);

  function getDirectJourneyNodes() {
    if (!activeConfig) return [];

    const topics = activeConfig.topics || {};
    const nodes = [];
    const walkTitles = ["", "同行①", "同行②", "同行③", "同行④", "同行⑤"];

    for (let index = 1; index <= 5; index += 1) {
      const text = topics[`topic${index}`];
      if (!text) continue;
      nodes.push({
        kind: "prompt",
        stage: "WALK",
        title: walkTitles[index] || "同行",
        text
      });
    }

    if (activeConfig.storyTitle) {
      nodes.push({ kind: "story", stage: "STORY", title: "故事" });
    }

    if (activeConfig.scriptureReference || activeConfig.scriptureText) {
      nodes.push({ kind: "word", stage: "WORD", title: "圣言" });
    }

    if (topics.topic6) {
      nodes.push({
        kind: "prompt",
        stage: "RESPOND",
        title: "回应",
        text: topics.topic6
      });
    }

    if (topics.topic7) {
      nodes.push({
        kind: "prompt",
        stage: "GO",
        title: "带着它继续走",
        text: topics.topic7
      });
    }

    return nodes;
  }

  function addDirectEntry() {
    if (!activeConfig || document.querySelector("[data-action='direct-journey']")) return;

    const actions = screen.querySelector(".actions");
    if (!actions) return;

    const wrap = document.createElement("div");
    wrap.className = "direct-entry-wrap";
    wrap.innerHTML = `
      <button class="direct-entry" type="button" data-action="direct-journey">熟悉步道？直接同行！</button>
      <div class="direct-entry-note">适合熟悉流程的带领人；安全与现场安排由带领人自行完成。</div>
    `;

    wrap.querySelector("[data-action='direct-journey']").addEventListener("click", () => {
      directNodeIndex = 0;
      setRoute(DIRECT_ROUTE);
    });

    actions.parentNode.insertBefore(wrap, actions);
  }

  function renderDirectPrompt(node) {
    layout({
      stage: node.stage,
      title: node.title,
      body: `<div class="question">${escapeHtml(node.text)}</div>`,
      extra: `<div class="direct-context">直接同行 · 现场节奏由带领人掌握</div>`,
      primary: "继续",
      onPrimary: advanceDirectJourney
    });
  }

  function renderDirectStory() {
    const storyMediaId = activeConfig.storyMediaId || "";
    const storyMediaType = activeConfig.storyMediaType || "";
    const mediaData = storyMediaId && storyMediaType
      ? ` data-story-media-id="${escapeAttribute(storyMediaId)}" data-story-media-type="${escapeAttribute(storyMediaType)}"`
      : "";

    layout({
      stage: "STORY",
      title: "故事",
      body: `<p>接下来，请进入今天的故事。</p>
        <div class="quiet-box"${mediaData}>
          <p>今天的故事：<br>《${escapeHtml(activeConfig.storyTitle)}》</p>
          <p>${activeConfig.storyVideoUrl ? "请播放今天的故事视频。" : `请由一位同伴简单读出或讲述今天的故事：《${escapeHtml(activeConfig.storyTitle)}》。`}</p>
        </div>`,
      extra: `<div class="direct-context">故事之后，再进入经文。</div>`,
      primary: "继续",
      onPrimary: advanceDirectJourney
    });
  }

  function renderDirectWord() {
    layout({
      stage: "WORD",
      title: "圣言",
      body: `<p>现在，让我们听一听神的话。</p>
        <div class="scripture">
          ${escapeHtml(activeConfig.scriptureReference || "")}<br><br>
          ${escapeHtml(activeConfig.scriptureText || "")}
        </div>`,
      extra: `<div class="direct-context">经文在故事之后首次披露。</div>`,
      primary: "继续",
      onPrimary: advanceDirectJourney
    });
  }

  function decorateDirectBackButton() {
    const backButton = screen.querySelector('[data-action="back"]');
    if (!backButton || directNodeIndex <= 0) return;

    const previousButton = backButton.cloneNode(true);
    previousButton.textContent = "上一段";
    previousButton.addEventListener("click", () => {
      directNodeIndex = Math.max(0, directNodeIndex - 1);
      renderDirectJourney();
    });
    backButton.replaceWith(previousButton);
  }

  function renderDirectJourney() {
    const nodes = getDirectJourneyNodes();
    if (!nodes.length) {
      setRoute("initialize", false);
      return;
    }

    directNodeIndex = Math.max(0, Math.min(directNodeIndex, nodes.length - 1));
    const node = nodes[directNodeIndex];
    const isLast = directNodeIndex === nodes.length - 1;

    if (node.kind === "story") {
      renderDirectStory();
    } else if (node.kind === "word") {
      renderDirectWord();
    } else {
      renderDirectPrompt(node);
    }

    const primaryButton = screen.querySelector('[data-action="primary"]');
    if (primaryButton && isLast) {
      const finishButton = primaryButton.cloneNode(true);
      finishButton.textContent = "完成同行";
      finishButton.addEventListener("click", () => setRoute("grow"));
      primaryButton.replaceWith(finishButton);
    }

    decorateDirectBackButton();
  }

  function advanceDirectJourney() {
    const nodes = getDirectJourneyNodes();
    if (!nodes.length) return;

    if (directNodeIndex < nodes.length - 1) {
      directNodeIndex += 1;
      renderDirectJourney();
      return;
    }

    setRoute("grow");
  }

  renderInitialize = function renderInitializeWithDirectJourney() {
    originalRenderInitialize();
    addDirectEntry();
  };

  renderRoute = function renderRouteWithDirectJourney() {
    if (state.route === DIRECT_ROUTE) {
      renderDirectJourney();
      return;
    }
    originalRenderRoute();
  };
})();
