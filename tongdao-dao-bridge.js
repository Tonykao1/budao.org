(function installReviewedDaoBridge() {
  const adapter = window.BudaoTongdaoDaoAdapter;
  if (!adapter) return;

  const legacyRenderStory = renderStory;
  const legacyRenderWord = renderWord;
  const legacyRenderClosingPrayer = renderClosingPrayer;
  const legacyShowChosenPackIntro = showChosenPackIntro;
  let availableDaoPacks = [];

  ensureDaoBridgeStylesheet();

  startTongdao = async function startTongdaoFromReviewedPool() {
    layout({
      stage: "TODAY",
      title: "正在预备今天的同道。",
      body: "<p>只从已经查验并冻结的道中预备。</p>"
    });

    try {
      const response = await fetch("/api/routes?kind=dao", {
        method: "GET",
        headers: { "Accept": "application/json" },
        credentials: "same-origin"
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) throw new Error(payload.reason || "dao_unavailable");

      availableDaoPacks = adapter.fromApiPayload(payload);
      if (!availableDaoPacks.length) {
        renderNoReviewedDao();
        return;
      }

      if (availableDaoPacks.length === 1) {
        chooseDaoPack(0);
        return;
      }

      renderDaoChooser();
    } catch (error) {
      renderDaoUnavailable();
    }
  };

  showChosenPackIntro = function showReviewedDaoIntro(pack) {
    if (!pack || !pack.daoCode) {
      return legacyShowChosenPackIntro(pack);
    }

    state.route = "chosen";
    layout({
      stage: "TODAY",
      title: "今天，同道为我们预备了一段路。",
      body: `<p>主题：</p><div class="theme">《${escapeHtml(pack.theme)}》</div>`,
      primary: "开始这段路",
      onPrimary: function () { setRoute("initialize"); }
    });
  };

  renderStory = function renderReviewedDaoStory() {
    if (!activeConfig || !activeConfig.daoCode) return legacyRenderStory();

    layout({
      stage: "STORY",
      title: "故事",
      body: `<p>接下来，请一位同伴慢慢读出今天的故事。<br>不用急着解释。<br>只需要听见。</p>
        <div class="quiet-box dao-story-text">${escapeMultiline(activeConfig.storyText)}</div>`,
      primary: "故事完成",
      onPrimary: function () { setRoute("storyQuiet"); }
    });
  };

  renderWord = function renderReviewedDaoWord() {
    if (!activeConfig || !activeConfig.daoCode) return legacyRenderWord();

    const translation = activeConfig.scriptureTranslation
      ? `<div class="dao-translation">${escapeHtml(activeConfig.scriptureTranslation)}</div>`
      : "";

    layout({
      stage: "WORD",
      title: "圣言",
      body: `<p>现在，让我们一起安静，<br>听一听神的话。</p>
        <div class="scripture">
          ${escapeHtml(activeConfig.scriptureReference)}${translation}<br>
          ${escapeMultiline(activeConfig.scriptureText)}
        </div>`,
      primary: "请一位同伴读出经文",
      onPrimary: function () { setRoute("wordQuiet"); }
    });
  };

  renderClosingPrayer = function renderReviewedDaoClosingPrayer() {
    if (!activeConfig || !activeConfig.daoCode || !activeConfig.prayer) return legacyRenderClosingPrayer();

    layout({
      stage: "GO",
      title: "结束祷告",
      body: `<p>请一位愿意的同伴，带大家读出今天这篇道留下的祷告。</p>
        <div class="quiet-box dao-prayer-text">${escapeMultiline(activeConfig.prayer)}</div>`,
      primary: "完成今天的同道",
      onPrimary: function () { setRoute("grow"); }
    });
  };

  function renderDaoChooser() {
    layout({
      stage: "TODAY",
      title: "选择今天同行的道。",
      body: "<p>经文会在故事之后才被揭示。</p>",
      extra: `<div class="dao-choice-list">
        ${availableDaoPacks.map(function (pack, index) {
          return `<button class="dao-choice" type="button" data-dao-choice="${index}">
            <span class="dao-choice-theme">${escapeHtml(pack.theme)}</span>
            <span class="dao-choice-date">${escapeHtml(pack.devotionalDate || "")}</span>
          </button>`;
        }).join("")}
      </div>`
    });

    screen.querySelectorAll("[data-dao-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        chooseDaoPack(Number(button.dataset.daoChoice));
      });
    });
  }

  function chooseDaoPack(index) {
    const pack = availableDaoPacks[index];
    if (!pack) return renderDaoUnavailable();
    activeConfig = pack;
    showChosenPackIntro(pack);
  }

  function renderNoReviewedDao() {
    layout({
      stage: "TODAY",
      title: "今天还没有可进入同道的道。",
      body: `<p>只有经过查验、已经发布并冻结的道，才会出现在这里。</p>
        <p class="note-small">同道不会自动退回到未经查验的旧内容。</p>`
    });
  }

  function renderDaoUnavailable() {
    layout({
      stage: "TODAY",
      title: "道池暂时没有回应。",
      body: `<p>为了守住查验边界，本次不使用未确认的备用内容。</p>
        <p class="note-small">可以稍后重新开始同道。</p>`
    });
  }

  function escapeMultiline(value) {
    return escapeHtml(value || "").replace(/\n/g, "<br>");
  }

  function ensureDaoBridgeStylesheet() {
    if (document.querySelector('link[data-tongdao-dao-style="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/tongdao-dao.css?v=20260907-1";
    link.dataset.tongdaoDaoStyle = "1";
    document.head.appendChild(link);
  }

  // tongdao-app.js renders Home before this bridge loads. Re-render once so the
  // existing “开始同道” button receives the reviewed-pool start handler.
  if (state.route === "home") renderHome();
}());
