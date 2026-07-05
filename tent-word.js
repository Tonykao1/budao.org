(function () {
  const form = document.querySelector(".word-form");
  const message = document.querySelector(".word-message");
  const publishButton = document.querySelector(".word-send");
  const storageKey = "budao.tent.word";

  if (!form) {
    return;
  }

  function valueOf(name) {
    const field = form.elements[name];
    return field ? field.value.trim() : "";
  }

  function setValue(name, value) {
    if (form.elements[name]) {
      form.elements[name].value = value || "";
    }
  }

  function collectWordRecord() {
    return {
      scripture: valueOf("scripture"),
      scriptureText: valueOf("scriptureText"),
      theme: valueOf("theme"),
      questions: Array.from({ length: 7 }, function (_, index) {
        return valueOf("question" + (index + 1));
      }),
      story: valueOf("story"),
      highlights: valueOf("highlights"),
      response: valueOf("response"),
      prayer: valueOf("prayer")
    };
  }

  function readSavedWordRecord() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function fillWordForm(record) {
    if (!record) {
      return;
    }

    setValue("scripture", record.scripture);
    setValue("scriptureText", record.scriptureText);
    setValue("theme", record.theme);
    setValue("story", record.story);
    setValue("highlights", record.highlights);
    setValue("response", record.response);
    setValue("prayer", record.prayer);

    const questions = Array.isArray(record.questions) ? record.questions : [];
    questions.slice(0, 7).forEach(function (question, index) {
      setValue("question" + (index + 1), question);
    });
  }

  function placeWord(text) {
    window.localStorage.setItem(storageKey, JSON.stringify(collectWordRecord()));
    if (message) {
      message.textContent = text;
    }
  }

  document.querySelectorAll('[data-tent-path="word"]').forEach(function (button) {
    button.addEventListener("click", function () {
      fillWordForm(readSavedWordRecord());
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    placeWord("这一程，已经暂时安放。");
  });

  if (publishButton) {
    publishButton.addEventListener("click", function () {
      placeWord("这一程，已经被安静预备。");
    });
  }

  window.BudaoTentWord = {
    collect: collectWordRecord,
    load: readSavedWordRecord
  };
}());
