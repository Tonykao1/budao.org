const {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  check,
  index,
  uniqueIndex
} = require("drizzle-orm/pg-core");
const { sql } = require("drizzle-orm");

const stewardshipUsers = pgTable("stewardship_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  stewardCode: text("steward_code").notNull(),
  displayName: text("display_name").notNull(),
  city: text("city"),
  introduction: text("introduction"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  stewardCodeUnique: uniqueIndex("stewardship_users_steward_code_uq").on(table.stewardCode),
  statusIndex: index("stewardship_users_status_idx").on(table.status)
}));

const passkeyCredentials = pgTable("passkey_credentials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => stewardshipUsers.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").notNull().default(sql`'[]'::jsonb`),
  deviceType: text("device_type"),
  backedUp: boolean("backed_up").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true })
}, (table) => ({
  credentialIdUnique: uniqueIndex("passkey_credentials_credential_id_uq").on(table.credentialId),
  userIndex: index("passkey_credentials_user_id_idx").on(table.userId)
}));

const webauthnChallenges = pgTable("webauthn_challenges", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeHash: text("challenge_hash").notNull(),
  purpose: text("purpose").notNull(),
  provisionalUserId: uuid("provisional_user_id"),
  userId: uuid("user_id").references(() => stewardshipUsers.id, { onDelete: "cascade" }),
  intentId: uuid("intent_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  activeIndex: index("webauthn_challenges_active_idx").on(table.purpose, table.expiresAt, table.consumedAt),
  userIndex: index("webauthn_challenges_user_id_idx").on(table.userId)
}));

const stewardshipSessions = pgTable("stewardship_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => stewardshipUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userAgentSummary: text("user_agent_summary")
}, (table) => ({
  tokenHashUnique: uniqueIndex("stewardship_sessions_token_hash_uq").on(table.tokenHash),
  userIndex: index("stewardship_sessions_user_id_idx").on(table.userId)
}));

const pendingIntents = pgTable("pending_intents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nonceHash: text("nonce_hash").notNull(),
  intendedAction: text("intended_action").notNull(),
  targetId: text("target_id"),
  returnPath: text("return_path").notNull().default("/contact.html"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  nonceHashUnique: uniqueIndex("pending_intents_nonce_hash_uq").on(table.nonceHash),
  activeIndex: index("pending_intents_active_idx").on(table.intendedAction, table.expiresAt, table.consumedAt)
}));

const recoveryContacts = pgTable("recovery_contacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => stewardshipUsers.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  lookupHmac: text("lookup_hmac").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  lookupHmacIndex: index("recovery_contacts_lookup_hmac_idx").on(table.lookupHmac),
  userIndex: index("recovery_contacts_user_id_idx").on(table.userId)
}));

const recoveryCodes = pgTable("recovery_codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => stewardshipUsers.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  codeHashUnique: uniqueIndex("recovery_codes_code_hash_uq").on(table.codeHash),
  userIndex: index("recovery_codes_user_id_idx").on(table.userId)
}));

const stewardshipAuditEvents = pgTable("stewardship_audit_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => stewardshipUsers.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => stewardshipUsers.id, { onDelete: "set null" }),
  targetId: text("target_id"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  eventTypeIndex: index("stewardship_audit_events_event_type_idx").on(table.eventType),
  userIndex: index("stewardship_audit_events_user_id_idx").on(table.userId)
}));

const prayerRequests = pgTable("prayer_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bodyCiphertext: text("body_ciphertext").notNull(),
  bodyNonce: text("body_nonce").notNull(),
  bodyTag: text("body_tag").notNull(),
  contactCiphertext: text("contact_ciphertext"),
  contactNonce: text("contact_nonce"),
  contactTag: text("contact_tag"),
  visibility: text("visibility").notNull().default("LEADERS_ONLY"),
  wantsReply: boolean("wants_reply").notNull().default(false),
  status: text("status").notNull().default("NEW"),
  assignedSlot: text("assigned_slot"),
  claimedBy: text("claimed_by"),
  idempotencyKeyHash: text("idempotency_key_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deleteAfter: timestamp("delete_after", { withTimezone: true })
}, (table) => ({
  idempotencyKeyUnique: uniqueIndex("prayer_requests_idempotency_key_hash_uq").on(table.idempotencyKeyHash),
  queueIndex: index("prayer_requests_queue_idx").on(table.status, table.createdAt),
  slotIndex: index("prayer_requests_assigned_slot_idx").on(table.assignedSlot, table.status),
  visibilityCheck: check("prayer_requests_visibility_check", sql`${table.visibility} in ('LEADERS_ONLY', 'TRUSTED_TEAM')`),
  statusCheck: check("prayer_requests_status_check", sql`${table.status} in ('NEW', 'PRAYING', 'COMPLETED')`),
  contactCheck: check("prayer_requests_contact_check", sql`(
    ${table.wantsReply} = false and ${table.contactCiphertext} is null and ${table.contactNonce} is null and ${table.contactTag} is null
  ) or (
    ${table.wantsReply} = true and ${table.contactCiphertext} is not null and ${table.contactNonce} is not null and ${table.contactTag} is not null
  )`)
}));

const prayerAuditEvents = pgTable("prayer_audit_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  prayerId: uuid("prayer_id").notNull().references(() => prayerRequests.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actorId: text("actor_id"),
  actorSlot: text("actor_slot"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  prayerIndex: index("prayer_audit_events_prayer_id_idx").on(table.prayerId, table.createdAt),
  eventTypeIndex: index("prayer_audit_events_event_type_idx").on(table.eventType)
}));

const prayerRateLimits = pgTable("prayer_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1)
});

const pastureUsers = pgTable("pasture_users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  emailHash: text("email_hash").notNull(),
  emailMasked: text("email_masked").notNull(),
  emailCiphertext: text("email_ciphertext"),
  emailNonce: text("email_nonce"),
  emailTag: text("email_tag"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  emailHashUnique: uniqueIndex("pasture_users_email_hash_uq").on(table.emailHash),
  statusIndex: index("pasture_users_status_idx").on(table.status)
}));

const pastureEmailVerifications = pgTable("pasture_email_verifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  emailHash: text("email_hash").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  lookupIndex: index("pasture_email_verifications_lookup_idx").on(table.emailHash, table.createdAt)
}));

const pastureSessions = pgTable("pasture_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => pastureUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userAgentSummary: text("user_agent_summary")
}, (table) => ({
  tokenHashUnique: uniqueIndex("pasture_sessions_token_hash_uq").on(table.tokenHash),
  userIndex: index("pasture_sessions_user_id_idx").on(table.userId)
}));

const pastureSheep = pgTable("pasture_sheep", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => pastureUsers.id, { onDelete: "cascade" }),
  bodyColor: text("body_color").notNull(),
  headColor: text("head_color").notNull(),
  marking: text("marking").notNull().default("NONE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userUnique: uniqueIndex("pasture_sheep_user_id_uq").on(table.userId)
}));

const pastureRateLimits = pgTable("pasture_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1)
});

module.exports = {
  stewardshipUsers,
  passkeyCredentials,
  webauthnChallenges,
  stewardshipSessions,
  pendingIntents,
  recoveryContacts,
  recoveryCodes,
  stewardshipAuditEvents,
  prayerRequests,
  prayerAuditEvents,
  prayerRateLimits,
  pastureUsers,
  pastureEmailVerifications,
  pastureSessions,
  pastureSheep,
  pastureRateLimits
};
