// Page-speed benchmark against a running server (use a production build: `next build && next start -p 3100`).
// Read-only: logs in and opens pages; never submits forms.
//
//   BENCH_EMAIL=… BENCH_PASSWORD=… node scripts/perf-bench.mjs [baseUrl] [label] [runs]
//
// For each route it reports the median of:
//   nav  — client-navigation request (RSC payload) time, what a link click waits for
//   load — full document load (cold page load / refresh)
//   kb   — RSC payload size sent to the browser
import { writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const label = process.argv[3] ?? "run";
const runs = Number(process.argv[4] ?? 3);
const email = process.env.BENCH_EMAIL;
const password = process.env.BENCH_PASSWORD;
if (!email || !password) throw new Error("Set BENCH_EMAIL and BENCH_PASSWORD.");

const routes = [
  "/dashboard",
  "/tasks/my",
  "/tasks/team",
  `/tasks/${process.env.BENCH_TASK_ID ?? "AKL-024"}`,
  "/projects",
  `/projects/${process.env.BENCH_PROJECT_ID ?? "prj_33d5fb6f"}`,
  "/workflows",
  "/calendar",
  "/attendance",
  "/announcements",
  "/employees",
  "/leaderboard",
  "/notifications",
  "/office",
  "/chat",
  "/admin",
];

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(180_000);
page.setDefaultTimeout(180_000);
await page.goto(`${base}/login`);
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
const tenantPrefix = new URL(page.url()).pathname.replace(/\/dashboard.*$/, "");

const results = [];
for (const route of routes) {
  const url = `${base}${tenantPrefix}${route}`;
  // Warm-up (first compile / first cache fill) is excluded from the median.
  await page.goto(url, { waitUntil: "load" }).catch(() => null);
  const nav = [];
  const load = [];
  let kb = 0;
  let status = 0;
  for (let i = 0; i < runs; i += 1) {
    const rsc = await page.evaluate(async (target) => {
      const started = performance.now();
      // Same request shape as a router navigation: RSC header + unique _rsc cache-buster, no HTTP cache.
      const busted = `${target}${target.includes("?") ? "&" : "?"}_rsc=${Math.random().toString(36).slice(2)}`;
      const response = await fetch(busted, { headers: { RSC: "1" }, cache: "no-store" });
      const body = await response.text();
      return { ms: performance.now() - started, bytes: body.length, status: response.status };
    }, url);
    nav.push(rsc.ms);
    kb = Math.round(rsc.bytes / 1024);
    status = rsc.status;
    const started = Date.now();
    await page.goto(url, { waitUntil: "load" });
    load.push(Date.now() - started);
  }
  const row = { route, status, nav: Math.round(median(nav)), load: Math.round(median(load)), kb };
  results.push(row);
  console.log(`${route.padEnd(28)} nav ${String(row.nav).padStart(5)} ms   load ${String(row.load).padStart(5)} ms   ${String(row.kb).padStart(5)} KB   (${status})`);
}

const total = (key) => results.reduce((sum, row) => sum + row[key], 0);
console.log(`\n${label}: median nav ${median(results.map((r) => r.nav))} ms, median load ${median(results.map((r) => r.load))} ms, total RSC ${total("kb")} KB`);
writeFileSync(`perf-${label}.json`, JSON.stringify({ label, base, runs, at: new Date().toISOString(), results }, null, 2));
await browser.close();
