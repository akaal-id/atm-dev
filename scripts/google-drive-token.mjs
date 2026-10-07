#!/usr/bin/env node
/**
 * One-time: get a fresh Google Drive refresh token for the upload account and store it.
 *
 *   node --env-file=.env.local scripts/google-drive-token.mjs [--vercel] [--no-open]
 *
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a "Web application" OAuth client whose
 * authorized redirect URIs include http://localhost:3333/oauth2callback).
 * Opens Google's consent screen; sign in as the Drive owner and allow access. The token is
 * written to .env.local (and to Vercel production with --vercel) — it is never printed.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const EXPECTED_ACCOUNT = process.env.GOOGLE_DRIVE_ACCOUNT || "asiakaryalumina@gmail.com";
// Full Drive scope: uploads go into an existing folder, which the narrower drive.file scope can't see.
const SCOPE = "https://www.googleapis.com/auth/drive";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline",
  prompt: "consent",
  login_hint: EXPECTED_ACCOUNT,
}).toString();

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    if (url.pathname !== "/oauth2callback") return void res.writeHead(404).end();
    const error = url.searchParams.get("error");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(error ? `<p>Google returned: ${error}. You can close this tab.</p>` : "<p>Done — you can close this tab and go back to the terminal.</p>");
    server.close();
    error ? reject(new Error(`Google returned: ${error}`)) : resolve(url.searchParams.get("code"));
  });
  server.listen(PORT, () => {
    // --no-open: just print the URL, e.g. to paste into a browser signed in to the Drive account.
    if (!process.argv.includes("--no-open")) spawnSync("open", [authUrl.toString()]);
    console.log(`Sign in as ${EXPECTED_ACCOUNT} and allow Drive access. Keep this terminal running until it finishes.`);
    console.log("Open this URL in the browser you want to use:\n\n" + authUrl.toString() + "\n");
  });
});

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
});
const tokens = await tokenResponse.json();
if (!tokenResponse.ok || !tokens.refresh_token) {
  console.error("Token exchange failed:", tokens.error, tokens.error_description ?? "(no refresh token returned)");
  process.exit(1);
}

// Verify: right account, and the upload folder is reachable and writable.
const auth = { Authorization: `Bearer ${tokens.access_token}` };
const about = await (await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers: auth })).json();
const email = about.user?.emailAddress ?? "(unknown)";
console.log(`Authorized as ${email}${email === EXPECTED_ACCOUNT ? "" : `  ⚠ expected ${EXPECTED_ACCOUNT}`}`);
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
if (folderId) {
  const folder = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name,trashed,capabilities(canAddChildren)&supportsAllDrives=true`, { headers: auth });
  const info = await folder.json();
  console.log(folder.ok ? `Upload folder "${info.name}": ${info.capabilities?.canAddChildren ? "writable ✓" : "NOT writable ✗"}${info.trashed ? " (in trash!)" : ""}` : `Upload folder not reachable (${folder.status}) — check GOOGLE_DRIVE_FOLDER_ID.`);
}

// Store it without printing it.
const envPath = ".env.local";
const env = readFileSync(envPath, "utf8");
const line = `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`;
writeFileSync(envPath, /^GOOGLE_REFRESH_TOKEN=.*$/m.test(env) ? env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line) : `${env.trimEnd()}\n${line}\n`);
console.log("Saved GOOGLE_REFRESH_TOKEN to .env.local");

if (process.argv.includes("--vercel")) {
  const vercel = ["vercel", "env", "--project", "atm-dev", "--scope", "akaals-projects"];
  spawnSync("npx", [...vercel.slice(0, 2), "rm", "GOOGLE_REFRESH_TOKEN", "production", "--yes", ...vercel.slice(2)], { stdio: "ignore" });
  execFileSync("npx", [...vercel.slice(0, 2), "add", "GOOGLE_REFRESH_TOKEN", "production", ...vercel.slice(2)], { input: tokens.refresh_token, stdio: ["pipe", "ignore", "inherit"] });
  console.log("Saved GOOGLE_REFRESH_TOKEN to Vercel (production). Redeploy for it to take effect.");
}
