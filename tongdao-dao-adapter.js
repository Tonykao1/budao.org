(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BudaoTongdaoDaoAdapter = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const QUESTION_ROLES = [
    "OPEN",
    "EXPERIENCE",
    "ENCOUNTER",
    "HEART",
    "SCRIPTURE_THRESHOLD",
    "CONFRONTATION",
    "GOSPEL_RESPONSE"
  ];

  function isEligibleDao(dao) {
    if (!dao || dao.status !== "PUBLISHED" || dao.frozen !== true) return false;
    if (!dao.tongdao || dao.tongdao.available !== true) return false;
    if (!dao.theme || !dao.scripture || !dao.scripture.referenceDisplay || !dao.scripture.text) return false;
    if (!String(dao.story || "").trim()) return false;
    if (!Array.isArray(dao.questions) || dao.questions.length !== 7) return false;

    return dao.questions.every(function (question, index) {
      return question && question.role === QUESTION_ROLES[index] && String(question.text || "").trim();
    });
  }

  function toTongdaoPack(dao) {
    if (!isEligibleDao(dao)) return null;

    const topics = {};
    dao.questions.forEach(function (question, index) {
      topics["topic" + (index + 1)] = String(question.text || "").trim();
    });

    return {
      id: "dao-" + dao.daoCode,
      daoCode: dao.daoCode,
      source: "DAO",
      devotionalDate: dao.devotionalDate || "",
      publishedAt: dao.publishedAt || "",
      publisherName: dao.publisherName || "",
      theme: String(dao.theme || "").trim(),
      cardIntro: String(dao.cardIntro || "").trim(),
      storyTitle: "今天的故事",
      storyText: String(dao.story || "").trim(),
      storyVideoUrl: "",
      scriptureReference: String(dao.scripture.referenceDisplay || "").trim(),
      scriptureText: String(dao.scripture.text || "").trim(),
      scriptureTranslation: String(dao.scripture.translation || "").trim(),
      topics: topics,
      growthChallenge: String(dao.response || "").trim() || "把今天领受的带回真实生活，在这一周走出一个具体回应。",
      prayer: String(dao.prayer || "").trim(),
      highlights: String(dao.highlights || "").trim(),
      questionRoles: QUESTION_ROLES.slice()
    };
  }

  function fromApiPayload(payload) {
    const items = payload && Array.isArray(payload.items) ? payload.items : [];
    return items.map(toTongdaoPack).filter(Boolean);
  }

  return {
    QUESTION_ROLES: QUESTION_ROLES,
    fromApiPayload: fromApiPayload,
    isEligibleDao: isEligibleDao,
    toTongdaoPack: toTongdaoPack
  };
}));
