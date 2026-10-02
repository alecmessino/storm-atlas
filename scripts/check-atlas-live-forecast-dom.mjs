#!/usr/bin/env node
/* THE LIVE SURFACE, END TO END: storm -> history -> forecast -> the reader's cell, and the watch.
 *
 * What this holds, in the browser, on the pages a reader actually gets:
 *   [1] A watch verdict at ELEVATED or above is on the top bar WITHOUT ANY PRESS; a QUIET system
 *       carries no mark.
 *   [2] One press on a system, with no condition set, keys the cohort to its derived genesis, opens
 *       its card (forecast now + the watch's own rows and reasons) and lays the official
 *       forecast against the cohort -- no second press. The map names the live marks.
 *   [3] The reader's cell: the pick card counts the cohort's storms through it AND which of the
 *       system's published lines cross it, and the line count equals an independent count.
 *   [4] LIVE is a claim about the feed measured on the browser's clock: past the artifact's own
 *       bound the word is withdrawn and the age printed instead.
 *   [5] A watch that was not supplied is said to be missing -- never shown as QUIET.
 *   [6] With a condition set, the press opens the card and says what a launch would discard; it
 *       does not launch.
 *   [7] A forecast file that 404s degrades to a stated refusal; the archive is untouched.
 *   and throughout: nothing reads the old forecast payload, and nothing is thrown.
 *
 * SERVED FROM PINNED FIXTURES, NOT THE COMMITTED FILES: scripts/fixtures/atlas-feed/ is the feed's
 * own replay of the capture at 2026-10-01T01:08:55Z (the feed's own test
 * proves the feed reproduces it byte for byte). The capture held no DISAGREEMENT, so for [1]-[3]
 * ONE row is rewritten in memory, here, to DISAGREEMENT, with a reason that says it is a fixture.
 *
 *   node scripts/check-atlas-live-forecast-dom.mjs --require-browser
 */
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HERMETIC } from "./lib/browser-harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const FX = join(ROOT, "scripts/fixtures/atlas-feed");
const LIVE_PATH = "/storm-atlas/data/atlas-live-v1.json";
const FC_PATH = "/storm-atlas/data/atlas-forecast-v1.json";
const LIVE = JSON.parse(await readFile(join(FX, "atlas-live-20261001T0108Z.json"), "utf8"));
const FC = JSON.parse(await readFile(join(FX, "atlas-forecast-20261001T0108Z.json"), "utf8"));
const FIXTURE_REASON = "TEST FIXTURE: this row was rewritten to DISAGREEMENT by the gate; the capture held none.";

/* [1]-[3]: RACHEL's first watch row rewritten to DISAGREEMENT (with an outline, as the feed writes
   one for any row at ELEVATED or above). Everything else is the capture's own. */
const FC_DIS = JSON.parse(JSON.stringify(FC));
{
  const w = FC_DIS.storms.EP182026.watch;
  const r = w.rows.find((x) => x.geometry === "coast-mexico-pacific") || w.rows[0];
  Object.assign(r, { state: "DISAGREEMENT", reasons: [{ code: "FIXTURE", text: FIXTURE_REASON }],
    outline: { kind: "circle", lat: 19.05, lon: -104.32, r_km: 100 } });
  w.rows.sort((a, b) => (a.state === "DISAGREEMENT" ? -1 : b.state === "DISAGREEMENT" ? 1 : 0));
  w.worst = "DISAGREEMENT";
}
const FC_NOWATCH = JSON.parse(JSON.stringify(FC));
FC_NOWATCH.watch = { supplied: false };
for (const s of Object.values(FC_NOWATCH.storms)) if (s.ok) s.watch = null;

const REQUIRE_BROWSER = process.argv.includes("--require-browser") || process.env.ATLAS_REQUIRE_BROWSER === "1";
let chromium;
try { ({ chromium } = await import("playwright")); } catch {
  if (REQUIRE_BROWSER) { console.error("[live-forecast-dom] playwright is REQUIRED here and is not installed."); process.exit(2); }
  console.log("[live-forecast-dom] playwright is not installed - SKIPPED, not passed."); process.exit(0);
}
async function findChromium() {
  if (process.env.ATLAS_DOM_CHROMIUM) return process.env.ATLAS_DOM_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH; if (!base) return null;
  let dirs = []; try { dirs = (await readdir(base)).filter((d) => d.startsWith("chromium-")).sort(); } catch { return null; }
  for (const d of dirs.reverse()) return join(base, d, "chrome-linux", "chrome");
  return null;
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".gz": "application/gzip" };
let serve = { live: LIVE, fc: FC_DIS };
const REQUESTS = [];
const server = await new Promise((r) => {
  const s = createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html");
    REQUESTS.push(p);
    if (p === LIVE_PATH || p === FC_PATH) {
      const body = p === LIVE_PATH ? serve.live : serve.fc;
      if (!body) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(body)); return;
    }
    try { const b = await readFile(join(DOCS, p)); res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }); res.end(b); }
    catch { res.writeHead(404); res.end("not found"); }
  });
  s.listen(0, () => r(s));
});
const port = server.address().port;
let failures = 0;
const ok = (label, cond, detail = "") => { if (cond) { console.log(`  ok    ${label}`); return; } failures++; console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`); };
const browser = await chromium.launch({ executablePath: (await findChromium()) || undefined, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

async function open({ clock, query = "", width = 1440 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, ...HERMETIC });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(clock) });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${port}/storm-atlas/${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__ATLAS && globalThis.__ATLAS.archive && globalThis.__ATLAS_LIVE && globalThis.__ATLAS_FORECAST, { timeout: 90000 });
  await page.waitForSelector("[data-live-strip]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}
const txt = (page, sel) => page.$eval(sel, (n) => n.innerText.replace(/\s+/g, " ").trim()).catch(() => null);

console.log("\n[live-forecast-dom] storm -> history -> forecast -> your cell, and the watch");

/* ---- [1] [2] [3] fresh feed, one DISAGREEMENT ---------------------------------------------- */
{
  serve = { live: LIVE, fc: FC_DIS };
  const { ctx, page, errors } = await open({ clock: "2026-10-01T02:00:00Z" });
  console.log("\n  ── a fresh feed, one system in DISAGREEMENT");
  ok("[1] the DISAGREEMENT is on the top bar with no press", !!(await page.$('[data-live-system="EP182026"] [data-live-watch="DISAGREEMENT"]')));
  ok("[1] the capture's own ELEVATED row is marked too", !!(await page.$('[data-live-system="EP152026"] [data-live-watch="ELEVATED"]')));
  ok("[1] a QUIET system carries no mark", !(await page.$('[data-live-system="EP192026"] [data-live-watch]')));
  ok("[4] a fresh feed reads LIVE", (await page.$eval("[data-live-feed]", (n) => n.dataset.liveFeed)) === "live" && /^LIVE$/.test(await txt(page, "[data-live-feed]")));

  await page.click('[data-live-system="EP182026"]');
  await page.waitForSelector("[data-forward-outcome]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  const url = await page.evaluate(() => location.search);
  ok("[2] one press keys the cohort to the derived genesis", /[?&]w=/.test(url) && !!(await page.$('[data-live-system="EP182026"] .lv-on')), url);
  const card = await txt(page, "[data-live-card]");
  ok("[2] the card opens on the same press, with the advisory and the guidance", !!card && card.includes(`#${FC.storms.EP182026.advisory}`) && /GUIDANCE/.test(card), String(card).slice(0, 200));
  const dis = await txt(page, '[data-live-card] [data-live-watch-row="DISAGREEMENT"]');
  ok("[2] the watch's row is printed with its own reason", !!dis && dis.includes(FIXTURE_REASON), String(dis));
  const plain = card.replace(/(never|not) probabilities/g, "");
  ok("[2] the card never speaks in percentages or chances", !/\d\s*%|probabilit|chance|likel|odds/i.test(plain), plain.match(/.{0,30}(%|probabilit|chance|likel|odds).{0,30}/i)?.[0]);
  ok("[2] the official forecast is laid against the cohort with no second press", !!(await page.$("[data-forward-outcome]")));
  const vint = await txt(page, "[data-forward-vintage-row]");
  ok("[2] the placement names the advisory and when the capture first saw it", !!vint && vint.includes(`#${FC.storms.EP182026.advisory}`) && /FIRST SEEN/.test(vint), String(vint));
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const legend = await page.$$eval("[data-legend-live]", (ns) => ns.map((n) => n.innerText));
  ok("[2] the map names every live mark it draws: track, forecast, runs, flagged exposure", legend.length === 4 && /RACHEL/.test(legend[0]) && /NHC #/.test(legend[1]) && /guidance runs/.test(legend[2]) && /watch flagged/.test(legend[3]), legend.join(" | "));

  /* [3] the reader's cell: one of the official forecast points, and an independent count */
  const s = FC.storms.EP182026, p = s.trackPoints[4];
  const c = { lat: Math.floor(p.at[0] / 2) * 2, lon: Math.floor(p.at[1] / 2) * 2 };
  const inside = (la, lo) => la >= c.lat && la < c.lat + 2 && lo >= c.lon && lo < c.lon + 2;
  const crosses = (pts) => pts.some((q, i) => inside(q[0], q[1]) || (i && (() => { const [a0, b0] = pts[i - 1], n = Math.ceil(Math.max(Math.abs(q[0] - a0), Math.abs(q[1] - b0)) / 0.2);
    for (let k = 1; k < n; k++) if (inside(a0 + ((q[0] - a0) * k) / n, b0 + ((q[1] - b0) * k) / n)) return true; return false; })()));
  const expectRuns = s.guidance.runs.filter((r) => crosses(r.track)).length;
  const xy = await page.evaluate(([la, lo]) => { const m = globalThis.__ATLAS_MAP, q = m.latLngToContainerPoint([la, lo]), r = m.getContainer().getBoundingClientRect(); return [r.x + q.x, r.y + q.y]; }, [c.lat + 1, c.lon + 1]);
  await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(800);
  const pk = await txt(page, "[data-pick-live]");
  const runs = await page.$eval("[data-pick-live-runs]", (n) => +n.dataset.pickLiveRuns).catch(() => null);
  ok("[3] the reader's cell is answered for history and for the forecast in one card", !!(await page.$("[data-pick-card]")) && !!pk && /crosses this cell/.test(pk), String(pk));
  ok("[3] the guidance-run count equals an independent count over the same cell", runs === expectRuns, `page ${runs}, independent ${expectRuns}`);
  ok("[3] the card counts lines and says they are not probabilities", /not probabilities/.test(pk || ""));
  ok("nothing thrown", errors.length === 0, errors.join(" · "));
  await ctx.close();
}

/* ---- [4] the same feed, a week later by the browser's clock --------------------------------- */
{
  serve = { live: LIVE, fc: FC_DIS };
  const { ctx, page, errors } = await open({ clock: "2026-10-08T02:00:00Z" });
  console.log("\n  ── the same feed, seven days later");
  const k = await txt(page, "[data-live-feed]");
  ok("[4] LIVE is withdrawn and the feed's age printed instead", (await page.$eval("[data-live-feed]", (n) => n.dataset.liveFeed)) === "stale" && /^FEED 7 d OLD$/.test(k), String(k));
  await page.click('[data-live-system="EP192026"]'); await page.waitForTimeout(500);
  ok("[4] the card says how old every value in it is", /THIS FEED IS 7 D OLD/.test((await txt(page, "[data-live-feed-stale]")) || ""));
  ok("nothing thrown", errors.length === 0, errors.join(" · "));
  await ctx.close();
}

/* ---- [5] no watch supplied ------------------------------------------------------------------- */
{
  serve = { live: LIVE, fc: FC_NOWATCH };
  const { ctx, page, errors } = await open({ clock: "2026-10-01T02:00:00Z" });
  console.log("\n  ── a feed built without the watch");
  ok("[5] no chip carries a verdict", !(await page.$("[data-live-watch]")));
  await page.click('[data-live-system="EP152026"]'); await page.waitForTimeout(600);
  ok("[5] the card says the watch was not supplied", /NOT SUPPLIED/.test((await txt(page, "[data-live-watch-absent]")) || ""));
  ok("[5] and never shows QUIET in its place", !(await page.$('[data-live-watch-row="QUIET"]')));
  ok("nothing thrown", errors.length === 0, errors.join(" · "));
  await ctx.close();
}

/* ---- [6] a condition set: the press does not launch ------------------------------------------- */
{
  serve = { live: LIVE, fc: FC_DIS };
  const { ctx, page, errors } = await open({ clock: "2026-10-01T02:00:00Z", query: "?v=1&i=cat3&m=1.1.0" });
  console.log("\n  ── a reader's condition is set");
  await page.click('[data-live-system="EP182026"]'); await page.waitForTimeout(600);
  const url = await page.evaluate(() => location.search);
  ok("[6] the press opens the card and does not launch", !!(await page.$("[data-live-card]")) && !/[?&]w=/.test(url) && /i=cat3/.test(url), url);
  ok("[6] the card says what a launch would discard", /discards/.test((await txt(page, "[data-launch-drops]")) || ""));
  ok("nothing thrown", errors.length === 0, errors.join(" · "));
  await ctx.close();
}

/* ---- [7] the forecast file 404s -------------------------------------------------------------- */
{
  serve = { live: LIVE, fc: null };
  const { ctx, page, errors } = await open({ clock: "2026-10-01T02:00:00Z" });
  console.log("\n  ── the forecast file cannot be read");
  await page.click('[data-live-system="EP182026"]'); await page.waitForTimeout(800);
  ok("[7] the card says there is no forecast on file", /NO FORECAST ON FILE/.test((await txt(page, "[data-live-forecast-none]")) || ""));
  ok("[7] the cohort still launches, and the forward view states its refusal", /[?&]w=/.test(await page.evaluate(() => location.search)) && !!(await page.$("[data-forward-unavailable]")));
  ok("nothing thrown", errors.length === 0, errors.join(" · "));
  await ctx.close();
}

ok("the old forecast payload is never requested", !REQUESTS.some((p) => /\/latest\.json$/.test(p)), REQUESTS.filter((p) => /latest/.test(p)).join(", "));
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILED` : "\nthe live surface: storm, history, forecast, cell and watch hold together");
process.exit(failures ? 1 : 0);
