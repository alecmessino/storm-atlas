#!/usr/bin/env node
/* LIVE VERIFICATION of the deployed Storm Atlas, over the public internet.
 *
 * CI checks the code and the committed files. This checks what visitors actually get:
 *   1. Pages serves THIS checkout: index.html, dist/*.js, claims.js and the archive manifest
 *      byte-match (sha256), polling while a deploy propagates.
 *   2. The live files are fresh: atlas-live-v1.json and latest.json were generated within
 *      --max-age-min, and both pass the public-schema whitelist as served.
 *   3. The served site carries no forbidden string (the same scan the build runs).
 *   4. The page boots in Chromium: no console or page errors, no failed requests, and no
 *      request leaves the site's own origin and path.
 *
 *   node scripts/verify-live.mjs [--url https://alecmessino.github.io/storm-atlas/]
 *                                [--wait-min 12] [--max-age-min 90] [--no-hash] */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, SCHEMAS, FIXED } from "./test-public-schema.mjs";
import { scanText } from "./scan-public.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const URL0 = arg("--url", process.env.ATLAS_LIVE_URL || "https://alecmessino.github.io/storm-atlas/");
const WAIT_MIN = Number(arg("--wait-min", 12));
const MAX_AGE_MIN = Number(arg("--max-age-min", 90));
const base = URL0.endsWith("/") ? URL0 : URL0 + "/";
let failed = 0;
const ok = (name, cond, detail = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); if (!cond) failed++; };
const sha = (b) => createHash("sha256").update(b).digest("hex");
const get = async (p) => { const r = await fetch(new URL(p, base) + `?nocache=${process.hrtime.bigint()}`, { cache: "no-store" }); return { status: r.status, buf: Buffer.from(await r.arrayBuffer()) }; };

// 1. Pages serves this checkout
if (!process.argv.includes("--no-hash")) {
  const files = ["index.html", "claims.js", "data/atlas-manifest.json", ...readdirSync(join(ROOT, "docs/dist")).map((f) => "dist/" + f)];
  const deadline = Date.now() + WAIT_MIN * 60e3;
  let mismatched;
  for (;;) {
    mismatched = [];
    for (const f of files) {
      const r = await get(f);
      if (r.status !== 200 || sha(r.buf) !== sha(readFileSync(join(ROOT, "docs", f)))) mismatched.push(`${f} (${r.status})`);
    }
    if (!mismatched.length || Date.now() > deadline) break;
    console.log(`  waiting for deploy: ${mismatched.length} file(s) differ`);
    await new Promise((r) => setTimeout(r, 30e3));
  }
  ok(`served build byte-matches the checkout (${files.length} files)`, !mismatched.length, mismatched.join(", "));
}

// 2. live files fresh and schema-clean as served
for (const [name, stampKey] of [["atlas-live-v1.json", "generated_at"], ["latest.json", "generatedAt"]]) {
  const r = await get("data/" + name);
  let obj = null; try { obj = JSON.parse(r.buf.toString("utf8")); } catch {}
  ok(`data/${name} is served and parses`, r.status === 200 && !!obj, `HTTP ${r.status}`);
  if (!obj) continue;
  const errs = check(obj, SCHEMAS[name]);
  for (const [k, v] of Object.entries(FIXED[name])) if (obj[k] !== v) errs.push(`$.${k} = ${JSON.stringify(obj[k])}`);
  ok(`data/${name} passes the public-schema whitelist as served`, !errs.length, errs.slice(0, 5).join("; "));
  const ageMin = (Date.now() - Date.parse(obj[stampKey])) / 60e3;
  ok(`data/${name} is fresh (≤ ${MAX_AGE_MIN} min)`, ageMin <= MAX_AGE_MIN, `${obj[stampKey]}, ${ageMin.toFixed(0)} min old`);
}

// 3 + 4. boot in Chromium; scan everything actually served
const { chromium } = await import("playwright");
const browser = await chromium.launch();
/* ATLAS_BEHIND_TLS_PROXY=1 only for a sandbox whose egress proxy re-signs TLS (Chromium does not
   read its CA). CI never sets it; the byte-match and data checks above verify TLS normally. */
const page = await browser.newPage({ viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: process.env.ATLAS_BEHIND_TLS_PROXY === "1" });
const errors = [], failedReq = [], offsite = [], served = [];
if (process.env.ATLAS_BEHIND_TLS_PROXY === "1") {
  /* Sandbox only: Chromium cannot traverse the egress proxy, so every request is fetched by Node
     (which can) and handed to the page unchanged. The page still renders production's bytes. */
  await page.route("**/*", async (route) => {
    try {
      const r = await fetch(route.request().url(), { headers: { "User-Agent": "storm-atlas-verify" } });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
    } catch (e) { await route.abort(); }
  });
}
const origin = new URL(base).origin, prefix = new URL(base).pathname;
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("requestfailed", (r) => failedReq.push(r.url()));
page.on("request", (r) => { const u = new URL(r.url()); if (u.protocol.startsWith("http") && (u.origin !== origin || !u.pathname.startsWith(prefix))) offsite.push(r.url()); });
page.on("response", async (r) => { try { if (r.url().startsWith(origin + prefix) && r.status() === 200) served.push([new URL(r.url()).pathname.slice(prefix.length) || "index.html", await r.body()]); } catch {} });
await page.goto(base, { waitUntil: "networkidle", timeout: 120e3 });
await page.waitForSelector("[data-atlas]", { timeout: 60e3 });
await page.waitForTimeout(4000);
const title = await page.title();
const text = await page.evaluate(() => document.body.innerText);
await page.screenshot({ path: process.env.ATLAS_SHOT || "/tmp/atlas-live.png" });
await browser.close();
ok("page boots: title is Storm Atlas", title === "Storm Atlas", title);
ok("the archive renders (cohort sample shown)", /EFFECTIVE SAMPLE/i.test(text));
ok("no console or page errors", !errors.length, errors.slice(0, 3).join(" | "));
ok("no failed requests", !failedReq.length, failedReq.slice(0, 3).join(" | "));
ok("no request leaves the site", !offsite.length, offsite.slice(0, 3).join(" | "));
const hits = [];
for (const [p, b] of served) {
  let t = b; if (p.endsWith(".gz")) { try { t = (await import("node:zlib")).gunzipSync(b); } catch {} }
  hits.push(...scanText("docs/" + p.split("?")[0], t.toString("utf8")));
}
hits.push(...scanText("docs/__rendered_text__", text));
ok(`served files and rendered text carry no forbidden string (${served.length} files)`, !hits.length,
  hits.slice(0, 5).map((h) => `${h.path}:${h.term}:${h.word}`).join(", "));
console.log(failed ? `\n${failed} check(s) failed` : "\nlive verification: all checks passed");
process.exit(failed ? 1 : 0);
