import { randomBytes } from "node:crypto";

// Development sessions expire on server restart unless AUTH_SECRET is configured.
const developmentSecret = randomBytes(32).toString("hex");
export function authConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const secret = env.AUTH_SECRET;
  if (production && (!secret || secret.length < 32 || secret.startsWith("CHANGE-ME") || secret === "profinhl-dev-secret-change-me")) {
    throw new Error("Set AUTH_SECRET to a random secret of at least 32 characters before starting production.");
  }
  // Keep the existing salt when upgrading: changing it invalidates stored hashes.
  // Password hashing will be migrated separately; never silently change its salt.
  if (production && (!env.AUTH_SALT || env.AUTH_SALT.startsWith("CHANGE-ME"))) {
    throw new Error("Set AUTH_SALT to the existing password salt before starting production.");
  }
  return { secret: secret || developmentSecret, salt: env.AUTH_SALT || "profinhl-salt" };
}
