let cachedDatabase;

function getDatabaseUrl(env = process.env) {
  const url = env.DATABASE_URL;
  if (!url || typeof url !== "string" || !url.trim()) {
    const error = new Error("Database is not configured.");
    error.code = "DATABASE_NOT_CONFIGURED";
    throw error;
  }
  return url;
}

function loadDatabaseModules() {
  try {
    return {
      neon: require("@neondatabase/serverless").neon,
      drizzle: require("drizzle-orm/neon-http").drizzle
    };
  } catch (error) {
    const wrapped = new Error("Database dependencies are not installed.");
    wrapped.code = "DATABASE_DEPENDENCIES_MISSING";
    wrapped.cause = error;
    throw wrapped;
  }
}

function getDb(env = process.env) {
  if (cachedDatabase) return cachedDatabase;
  const databaseUrl = getDatabaseUrl(env);
  const { neon, drizzle } = loadDatabaseModules();
  const sql = neon(databaseUrl);
  cachedDatabase = drizzle(sql, { schema: require("./schema") });
  return cachedDatabase;
}

function resetDbForTests() {
  cachedDatabase = undefined;
}

function sanitizeDatabaseError(error) {
  return {
    ok: false,
    error: error && error.code === "DATABASE_NOT_CONFIGURED"
      ? "database_not_configured"
      : "database_unavailable"
  };
}

module.exports = {
  getDatabaseUrl,
  getDb,
  resetDbForTests,
  sanitizeDatabaseError
};
