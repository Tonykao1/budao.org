"use strict";

// Keep route publication confined to the reviewed production deployment.
// Client-side button disabling is only a UX safeguard, not authorization.
function routeWriteBlockReason(targetBranch, env = process.env) {
  const vercelEnvironment = String(env.VERCEL_ENV || "").trim().toLowerCase();
  const isVercel = Boolean(env.VERCEL || env.VERCEL_ENV);
  if (vercelEnvironment && vercelEnvironment !== "production") return "preview_write_disabled";
  if (isVercel && !vercelEnvironment) return "preview_write_disabled";
  if (vercelEnvironment === "production" &&
      (targetBranch !== "main" ||
       (env.VERCEL_GIT_COMMIT_REF && env.VERCEL_GIT_COMMIT_REF !== "main"))) {
    return "publish_target_mismatch";
  }
  return "";
}

module.exports = { routeWriteBlockReason };
