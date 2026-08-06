const {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
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

module.exports = {
  stewardshipUsers,
  passkeyCredentials,
  webauthnChallenges,
  stewardshipSessions,
  pendingIntents,
  recoveryContacts,
  recoveryCodes,
  stewardshipAuditEvents
};
