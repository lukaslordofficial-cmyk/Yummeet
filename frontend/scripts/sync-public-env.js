#!/usr/bin/env node
/** Sync EXPO_PUBLIC_* from .env into src/lib/publicEnv.ts and eas.json build env. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const url = env.EXPO_PUBLIC_SUPABASE_URL || "";
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
if (!url || !key) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

fs.writeFileSync(
  path.join(root, "src/lib/publicEnv.ts"),
  [
    "/** Public client config (anon key is safe in the app binary). Auto-synced from .env for EAS builds. */",
    `export const PUBLIC_SUPABASE_URL = ${JSON.stringify(url)};`,
    `export const PUBLIC_SUPABASE_ANON_KEY = ${JSON.stringify(key)};`,
    "",
  ].join("\n"),
);

const easPath = path.join(root, "eas.json");
const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
const envBlock = {
  EXPO_PUBLIC_SUPABASE_URL: url,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: key,
};
for (const profile of Object.keys(eas.build || {})) {
  eas.build[profile].env = { ...(eas.build[profile].env || {}), ...envBlock };
}
fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + "\n");
console.log("Synced publicEnv.ts + eas.json env");
