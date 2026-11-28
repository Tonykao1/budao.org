"use strict";
const { isSteward } = require("./auth");
function canEdit(actor, album) {
 return !!(actor && actor.id && album && album.state === "draft" && actor.id === album.owner_id);
}
function transition(actor, album, assets, action) {
 if (!actor || !actor.id || !album || !Array.isArray(assets)) return null;
 const owner = actor.id === album.owner_id;
 const steward = isSteward(actor);
 const allConsented = assets.length > 0 && assets.every(a => a.consent_confirmed === true);
 const allApproved = allConsented && assets.every(a => a.approved === true);
 const state = album.state;
 if (action === "submit" && owner && state === "draft" && allConsented) return "submitted";
 if (action === "return" && steward && state === "submitted") return "draft";
 if (action === "approve" && steward && state === "submitted" && allApproved) return "approved";
 if (action === "withdraw" && steward && ["submitted","approved","published"].includes(state)) return "withdrawn";
 // Publishing is intentionally unavailable until private storage, atomic release and verification are connected.
 return null;
}
module.exports = { canEdit, transition };
