const LEADERS_ONLY = "LEADERS_ONLY";
const TRUSTED_TEAM = "TRUSTED_TEAM";
const PRAYER_STATUSES = Object.freeze(["NEW", "PRAYING", "COMPLETED"]);
const PRAYER_VISIBILITIES = Object.freeze([LEADERS_ONLY, TRUSTED_TEAM]);

function normalizeText(value) {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

function validatePrayerSubmission(input) {
  const source = input && typeof input === "object" ? input : {};
  const body = normalizeText(source.body);
  const bodyLength = Array.from(body).length;
  if (bodyLength < 1 || bodyLength > 1000 || body.includes("\u0000")) {
    throw new Error("invalid_prayer_body");
  }

  const visibility = source.visibility === undefined || source.visibility === "" ?
    LEADERS_ONLY : source.visibility;
  if (!PRAYER_VISIBILITIES.includes(visibility)) {
    throw new Error("invalid_prayer_visibility");
  }

  const wantsReply = source.wantsReply === true;
  const contact = wantsReply ? normalizeText(source.contact) : "";
  if (wantsReply && (contact.length < 1 || Array.from(contact).length > 500 || contact.includes("\u0000"))) {
    throw new Error("invalid_prayer_contact");
  }

  return { body, visibility, wantsReply, contact };
}

module.exports = {
  LEADERS_ONLY,
  TRUSTED_TEAM,
  PRAYER_STATUSES,
  PRAYER_VISIBILITIES,
  validatePrayerSubmission
};
