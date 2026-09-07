const QUESTION_ROLES = [
  "OPEN",
  "EXPERIENCE",
  "ENCOUNTER",
  "HEART",
  "SCRIPTURE_THRESHOLD",
  "CONFRONTATION",
  "GOSPEL_RESPONSE"
];

const BOOKS = [
  ["GEN", "创世记", ["创", "Genesis", "Gen"]],
  ["EXO", "出埃及记", ["出", "Exodus", "Exod", "Exo"]],
  ["LEV", "利未记", ["利", "Leviticus", "Lev"]],
  ["NUM", "民数记", ["民", "Numbers", "Num"]],
  ["DEU", "申命记", ["申", "Deuteronomy", "Deut", "Deu"]],
  ["JOS", "约书亚记", ["书", "Joshua", "Josh", "Jos"]],
  ["JDG", "士师记", ["士", "Judges", "Judg", "Jdg"]],
  ["RUT", "路得记", ["得", "Ruth", "Rut"]],
  ["1SA", "撒母耳记上", ["撒上", "1 Samuel", "1Sam", "1Sa"]],
  ["2SA", "撒母耳记下", ["撒下", "2 Samuel", "2Sam", "2Sa"]],
  ["1KI", "列王纪上", ["王上", "1 Kings", "1Kgs", "1Ki"]],
  ["2KI", "列王纪下", ["王下", "2 Kings", "2Kgs", "2Ki"]],
  ["1CH", "历代志上", ["代上", "1 Chronicles", "1Chr", "1Ch"]],
  ["2CH", "历代志下", ["代下", "2 Chronicles", "2Chr", "2Ch"]],
  ["EZR", "以斯拉记", ["拉", "Ezra", "Ezr"]],
  ["NEH", "尼希米记", ["尼", "Nehemiah", "Neh"]],
  ["EST", "以斯帖记", ["斯", "Esther", "Est"]],
  ["JOB", "约伯记", ["伯", "Job"]],
  ["PSA", "诗篇", ["诗", "Psalms", "Psalm", "Ps", "Psa"]],
  ["PRO", "箴言", ["箴", "Proverbs", "Prov", "Pro"]],
  ["ECC", "传道书", ["传", "Ecclesiastes", "Eccl", "Ecc"]],
  ["SNG", "雅歌", ["歌", "Song of Songs", "Song of Solomon", "Song", "Sng"]],
  ["ISA", "以赛亚书", ["赛", "Isaiah", "Isa"]],
  ["JER", "耶利米书", ["耶", "Jeremiah", "Jer"]],
  ["LAM", "耶利米哀歌", ["哀", "Lamentations", "Lam"]],
  ["EZK", "以西结书", ["结", "Ezekiel", "Ezek", "Ezk"]],
  ["DAN", "但以理书", ["但", "Daniel", "Dan"]],
  ["HOS", "何西阿书", ["何", "Hosea", "Hos"]],
  ["JOL", "约珥书", ["珥", "Joel", "Jol"]],
  ["AMO", "阿摩司书", ["摩", "Amos", "Amo"]],
  ["OBA", "俄巴底亚书", ["俄", "Obadiah", "Obad", "Oba"]],
  ["JON", "约拿书", ["拿", "Jonah", "Jon"]],
  ["MIC", "弥迦书", ["弥", "Micah", "Mic"]],
  ["NAM", "那鸿书", ["鸿", "Nahum", "Nah", "Nam"]],
  ["HAB", "哈巴谷书", ["哈", "Habakkuk", "Hab"]],
  ["ZEP", "西番雅书", ["番", "Zephaniah", "Zeph", "Zep"]],
  ["HAG", "哈该书", ["该", "Haggai", "Hag"]],
  ["ZEC", "撒迦利亚书", ["亚", "Zechariah", "Zech", "Zec"]],
  ["MAL", "玛拉基书", ["玛", "Malachi", "Mal"]],
  ["MAT", "马太福音", ["太", "Matthew", "Matt", "Mat"]],
  ["MRK", "马可福音", ["可", "Mark", "Mrk"]],
  ["LUK", "路加福音", ["路", "Luke", "Luk"]],
  ["JHN", "约翰福音", ["约", "John", "Jn", "Jhn"]],
  ["ACT", "使徒行传", ["徒", "Acts", "Act"]],
  ["ROM", "罗马书", ["罗", "Romans", "Rom"]],
  ["1CO", "哥林多前书", ["林前", "1 Corinthians", "1Cor", "1Co"]],
  ["2CO", "哥林多后书", ["林后", "2 Corinthians", "2Cor", "2Co"]],
  ["GAL", "加拉太书", ["加", "Galatians", "Gal"]],
  ["EPH", "以弗所书", ["弗", "Ephesians", "Eph"]],
  ["PHP", "腓立比书", ["腓", "Philippians", "Phil", "Php"]],
  ["COL", "歌罗西书", ["西", "Colossians", "Col"]],
  ["1TH", "帖撒罗尼迦前书", ["帖前", "1 Thessalonians", "1Thess", "1Th"]],
  ["2TH", "帖撒罗尼迦后书", ["帖后", "2 Thessalonians", "2Thess", "2Th"]],
  ["1TI", "提摩太前书", ["提前", "1 Timothy", "1Tim", "1Ti"]],
  ["2TI", "提摩太后书", ["提后", "2 Timothy", "2Tim", "2Ti"]],
  ["TIT", "提多书", ["多", "Titus", "Tit"]],
  ["PHM", "腓利门书", ["门", "Philemon", "Phlm", "Phm"]],
  ["HEB", "希伯来书", ["来", "Hebrews", "Heb"]],
  ["JAS", "雅各书", ["雅", "James", "Jas"]],
  ["1PE", "彼得前书", ["彼前", "1 Peter", "1Pet", "1Pe"]],
  ["2PE", "彼得后书", ["彼后", "2 Peter", "2Pet", "2Pe"]],
  ["1JN", "约翰一书", ["约一", "1 John", "1Jn"]],
  ["2JN", "约翰二书", ["约二", "2 John", "2Jn"]],
  ["3JN", "约翰三书", ["约三", "3 John", "3Jn"]],
  ["JUD", "犹大书", ["犹", "Jude", "Jud"]],
  ["REV", "启示录", ["启", "Revelation", "Rev"]]
];

const BOOK_CHAPTER_COUNTS = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
  "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36,
  EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8,
  ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
  OBA: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
  MAT: 28, MRK: 16, LUK: 24, JHN: 21, ACT: 28, ROM: 16, "1CO": 16, "2CO": 13,
  GAL: 6, EPH: 6, PHP: 4, COL: 4, "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4,
  TIT: 3, PHM: 1, HEB: 13, JAS: 5, "1PE": 5, "2PE": 3, "1JN": 5,
  "2JN": 1, "3JN": 1, JUD: 1, REV: 22
};

const SINGLE_CHAPTER_VERSE_COUNTS = {
  OBA: 21,
  PHM: 25,
  "2JN": 13,
  "3JN": 14,
  JUD: 25
};

const BOOK_ALIASES = buildBookAliases();

function validateDaoSubmission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("invalid_dao");

  const allowed = [
    "scripture", "scriptureText", "translation", "theme", "cardIntro", "questions",
    "story", "highlights", "response", "prayer", "devotionalDate",
    "publicationTimezone", "publicationLocale"
  ];
  const unknown = Object.keys(input).find((key) => !allowed.includes(key));
  if (unknown) return fail("unknown_field");

  if (tooLong(input.scripture, 160) || tooLong(input.scriptureText, 12000) ||
      tooLong(input.translation || "和合本", 80) || tooLong(input.theme, 120) ||
      tooLong(input.cardIntro, 800) || tooLong(input.story, 12000) ||
      tooLong(input.highlights, 12000) || tooLong(input.response, 12000) ||
      tooLong(input.prayer, 12000) || tooLong(input.publicationTimezone || "Asia/Shanghai", 80) ||
      tooLong(input.publicationLocale || "zh-CN", 40)) {
    return fail("field_too_long");
  }

  const scriptureRaw = clean(input.scripture);
  const scripture = parseScriptureReference(scriptureRaw);
  if (!scripture) return fail("invalid_scripture_reference");

  const scriptureText = cleanMultiline(input.scriptureText);
  const theme = clean(input.theme);
  const cardIntro = cleanMultiline(input.cardIntro);
  const translation = clean(input.translation || "和合本");
  const devotionalDate = normalizeDate(input.devotionalDate);
  const publicationTimezone = clean(input.publicationTimezone || "Asia/Shanghai");
  const publicationLocale = clean(input.publicationLocale || "zh-CN");

  if (!scriptureText) return fail("scripture_text_required");
  if (!theme) return fail("theme_required");
  if (!cardIntro) return fail("card_intro_required");
  if (!devotionalDate) return fail("invalid_devotional_date");
  if (!validTimezone(publicationTimezone)) return fail("invalid_timezone");

  if (!Array.isArray(input.questions) || input.questions.length !== 7) return fail("seven_questions_required");
  if (input.questions.some((item) => tooLong(item, 1000))) return fail("field_too_long");
  const questionTexts = input.questions.map((item) => clean(item));
  if (questionTexts.some((item) => !item)) return fail("seven_questions_required");

  const questions = questionTexts.map((text, index) => ({
    order: index + 1,
    role: QUESTION_ROLES[index],
    text
  }));

  return {
    value: {
      scripture: {
        ...scripture,
        referenceDisplay: scriptureRaw,
        text: scriptureText,
        translation
      },
      theme,
      cardIntro,
      questions,
      story: cleanMultiline(input.story),
      highlights: cleanMultiline(input.highlights),
      response: cleanMultiline(input.response),
      prayer: cleanMultiline(input.prayer),
      devotionalDate,
      publicationTimezone,
      publicationLocale
    }
  };
}

function parseScriptureReference(value) {
  const raw = String(value || "").trim().replace(/：/g, ":").replace(/[–—]/g, "-");
  if (!raw) return null;

  const alias = Object.keys(BOOK_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => raw.toLowerCase().startsWith(candidate.toLowerCase()));
  if (!alias) return null;

  const book = BOOK_ALIASES[alias.toLowerCase()];
  const tail = raw.slice(alias.length).trim();
  const match = tail.match(/^(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*-\s*(?:(\d{1,3})\s*:\s*)?(\d{1,3}))?)?$/);
  if (!match) return null;

  const maxChapter = BOOK_CHAPTER_COUNTS[book.code];
  const chapterStart = numberInRange(match[1], 1, maxChapter);
  const verseStart = match[2] ? numberInRange(match[2], 1, 176) : null;
  const chapterEnd = match[3] ? numberInRange(match[3], 1, maxChapter) : chapterStart;
  const verseEnd = match[4] ? numberInRange(match[4], 1, 176) : verseStart;
  if (!chapterStart || (match[2] && !verseStart) || !chapterEnd || (match[4] && !verseEnd)) return null;
  if (chapterEnd < chapterStart) return null;
  if (chapterEnd === chapterStart && verseStart && verseEnd && verseEnd < verseStart) return null;

  const singleChapterMax = SINGLE_CHAPTER_VERSE_COUNTS[book.code];
  if (singleChapterMax && ((verseStart && verseStart > singleChapterMax) || (verseEnd && verseEnd > singleChapterMax))) {
    return null;
  }

  return {
    bookCode: book.code,
    bookName: book.name,
    chapterStart,
    verseStart,
    chapterEnd,
    verseEnd
  };
}

function daoCodeFor(devotionalDate, scripture) {
  const datePart = String(devotionalDate || "").replace(/-/g, "");
  const chapterPart = pad(scripture.chapterStart, 3);
  let versePart = "";

  if (scripture.verseStart) {
    versePart += pad(scripture.verseStart, 3);
    if (scripture.chapterEnd !== scripture.chapterStart) {
      versePart += pad(scripture.chapterEnd, 3);
      if (scripture.verseEnd) versePart += pad(scripture.verseEnd, 3);
    } else if (scripture.verseEnd && scripture.verseEnd !== scripture.verseStart) {
      versePart += pad(scripture.verseEnd, 3);
    }
  }

  return "BD" + datePart + scripture.bookCode + chapterPart + versePart;
}

function buildBookAliases() {
  const result = {};
  BOOKS.forEach(([code, name, aliases]) => {
    [name].concat(aliases).forEach((alias) => {
      result[String(alias).toLowerCase()] = { code, name };
    });
  });
  return result;
}

function tooLong(value, max) {
  return String(value || "").length > max;
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function cleanMultiline(value) {
  return String(value || "").trim().replace(/\r\n/g, "\n");
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(text + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return "";
  return text;
}

function validTimezone(value) {
  try {
    Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return true;
  } catch (error) {
    return false;
  }
}

function numberInRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function pad(value, width) {
  return String(value).padStart(width, "0");
}

function fail(error) {
  return { error };
}

module.exports = {
  BOOK_CHAPTER_COUNTS,
  QUESTION_ROLES,
  daoCodeFor,
  parseScriptureReference,
  validateDaoSubmission
};
