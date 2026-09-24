#!/usr/bin/env node
/* THE FORWARD OUTCOME VIEW, ON A SCREEN, AT EVERY WIDTH IT IS DRAWN AT.
 *
 * WHY THIS FILE EXISTS: TWO FAULTS THAT NO OTHER GATE COULD SEE.
 *
 * The plate is a 1600-unit viewBox at `width:100%`. Every number in it -- the geometry, the
 * gutters, the type sizes -- was chosen against that reference and verified at it. Nothing in the
 * repository looked at the bands in between.
 *
 *   1. AT 960 px THE PLATE RENDERED ITS 9 px LABELS AT 5 px. The threshold ladder, both clock
 *      rows, the attrition heading and the callout carrying the finding were all illegible, and
 *      the drawing they annotate was decoration. This is exactly the failure the purpose-built
 *      narrow layout exists to prevent, arriving through the one band above its breakpoint.
 *
 *   2. FIXING (1) MADE THE CALLOUT COLLIDE WITH A SERIES LABEL. `6 of 94 at or above 115 kt` and
 *      `NHC OFFICIAL` are both above the official trace by construction, so they compete for that
 *      band at any width where the callout is long enough. At 1600 it was not; at 960 the
 *      callout's right edge reached 1406 and the label began at 1406.
 *
 * Both were invisible to every existing check. check-atlas-dom drives one width. The responsive
 * matrix drives five, but the forward view is not on screen in any of its states -- it renders
 * only on a cohort keyed to a live system's derived genesis, after a reader asks for the
 * forecast. check-light-contrast measures colour, not rendered size. A unit test cannot see a
 * font-size that is correct in its own units and too small on the glass.
 *
 * So this gate opens the real surface, presses the real control, and asserts the two properties
 * that a number in a stylesheet cannot: that the smallest type on the plate REACHES THE SCREEN at
 * a legible size, and that no two strings on it overlap. Plus the pinned reading, at every width,
 * because a responsive rule that drops the finding is the worst of the three.
 *
 *   node scripts/check-atlas-forward-dom.mjs --require-browser
 */
import { createServer } from "node:http";
import { readFile, readdir, access } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HERMETIC } from "./lib/browser-harness.mjs";
import { parseBestTrack } from "./lib/atcf.mjs";
import { buildAtlasLive } from "./lib/atlas-live.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");

/* ── BOTH OPERATIONAL ROUTES ARE ANSWERED FROM PINNED FIXTURES ──────────────────────────────
 *
 * A GATE MUST NOT ASSERT THE WEATHER, and the first draft of this file did.
 *
 * `docs/data/latest.json` is the forecast payload, rewritten every ten minutes, and NHC issues
 * a new advisory for a live storm every six hours. `docs/storm-atlas/data/atlas-live-v1.json` is
 * rewritten on the same cadence and drops a system from `active_atcf_ids` the moment it
 * dissipates. This gate asserts a pinned reading -- 115 kt at 24 Sep 00Z, 6 of 94 -- and reads it
 * off the rendered surface. Served from the committed files, it would have gone red at the next
 * advisory and told nobody anything true: not that the code broke, only that the weather moved.
 *
 * Caught before merge, and only because main refreshed the payload mid-review. Sibling of the
 * same treatment in check-atlas-live-dom.mjs, whose header says the same thing.
 *
 * So both routes are intercepted. The live artifact is BUILT from the committed b-deck through
 * the real `buildAtlasLive`, so the fixes, the derived genesis and the active list are the
 * pipeline's own output rather than a hand-written stub. The official forecast is the same pinned
 * advisory `scripts/test-atlas-forward.mjs` runs against, wrapped in the envelope the original pipeline
 * publishes -- so the unit gate and this one are pinned to ONE forecast and cannot disagree. */
const LIVE_PATH = "/storm-atlas/data/atlas-live-v1.json";
const OFFICIAL_PATH = "/storm-atlas/data/latest.json";
const NOW = Date.parse("2026-09-21T03:36:15.434Z");   // the pinned payload's own instant

const deckText = await readFile(join(ROOT, "scripts/fixtures/bdeck-ep172026.dat"), "utf8");
const official = JSON.parse(
  await readFile(join(ROOT, "scripts/fixtures/official-ep172026.json"), "utf8"));

const ARTIFACT = buildAtlasLive({
  storms: [{ id: "EP172026", name: "Polo" }],
  intel: { byStorm: { EP172026: {
    bestTrackHistory: parseBestTrack(deckText).records,
    /* A SHIPS RUN, so the CONDITIONING row's secondary detail is exercised rather than skipped.
       tau 0, the three fields the row prints, from the product's own vocabulary. */
    ships: {
      ok: true, cycleIso: "2026-09-21T00:00:00.000Z",
      features: { shearKt: 2, sstC: 30.5, mpiKt: 169 },
      labels: { shearKt: "850-200 mb deep-layer shear", sstC: "sea-surface temperature",
        mpiKt: "maximum potential intensity the ocean supports" },
      availability: { ohc: true, ir: true },
    },
    bestTrackSource: { url: "fixture://bdeck-ep172026.dat", status: 200, bytes: deckText.length },
  } } },
  nowMs: NOW,
  previous: null,
});

/* the pipeline's envelope around the pinned advisory. `generatedAt` is the payload stamp the
   vintage row prints; the advisory's own instant is the first forecast point's, as it is in the
   real file. */
const OFFICIAL_PAYLOAD = {
  generatedAt: official.latest_json_generated_at,
  storms: [{ id: official.atcf_id, name: official.name, trackPoints: official.trackPoints }],
};

const REQUIRE_BROWSER = process.argv.includes("--require-browser")
  || process.env.ATLAS_REQUIRE_BROWSER === "1";
let chromium;
try { ({ chromium } = await import("playwright")); }
catch {
  if (REQUIRE_BROWSER) {
    console.error("[forward-dom] playwright is REQUIRED here and is not installed.");
    process.exit(2);
  }
  console.log("[forward-dom] playwright is not installed - SKIPPED, not passed.");
  process.exit(0);
}

/* THE ACCEPTANCE CASE, AND IT IS THE LAUNCHER'S OWN QUERY. Polo's derived genesis, 250 km,
   methodology 1.1.0 -- the cohort of 110 every Stage 3 figure traces to. */
const QUERY = "?v=1&w=14.5%2C-105.1%2C250&m=1.1.0";

/* THE PINNED READING. The advisory's +69 h point is valid 2026-09-24T00:00Z, which is genesis
   +78 h, where the archive holds 94 of 110 and 6 of them were at or above 115 kt. It must be the
   same four numbers at every width: a layout that folds the finding away has not adapted. */
const HERO = "NHC: 115 kt at 24 Sep 00Z. Historical placement: 6 of 94.";
const STAND = "78 h after genesis · 94 of 110 comparable storms still in the record";

/* SIX WIDTHS, EACH A REAL SIZE RATHER THAN A BREAKPOINT. A band tested only at its own pixel
   proves the rule fires, not that the layout inside it works -- which is how 960 was missed. */
const WIDTHS = [
  ["workstation", 1920], ["workstation", 1440], ["two columns", 1220],
  ["two columns", 1024], ["half screen", 960], ["just above the fold", 880],
  ["narrow", 560], ["phone", 390],
];

/* THE FLOOR, AND WHY IT IS 7.5. The plate's smallest tier is 9 px in viewBox units and renders
   at 10.3 px at a 1920 viewport -- the size it was drawn to be read at. 7.5 is the lowest this
   surface will publish a figure at: below it the mono numerals in the attrition row stop being
   countable, which was measured at 5 px and is the fault this gate was written for. */
const MIN_PLATE_PX = 7.5;

async function findChromium() {
  if (process.env.ATLAS_DOM_CHROMIUM) return process.env.ATLAS_DOM_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base) return null;
  let dirs = [];
  try { dirs = (await readdir(base)).filter((d) => d.startsWith("chromium-")).sort(); }
  catch { return null; }
  for (const d of dirs.reverse()) {
    const exe = join(base, d, "chrome-linux", "chrome");
    try { await access(exe); return exe; } catch { /* next */ }
  }
  return null;
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".gz": "application/gzip" };
const MISSING = [];
const server = await new Promise((r) => {
  const s = createServer(async (req, res) => {
    let p = "/";
    try {
      p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      if (p === LIVE_PATH || p === OFFICIAL_PATH) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(p === LIVE_PATH ? ARTIFACT : OFFICIAL_PAYLOAD));
        return;
      }
      const b = await readFile(join(DOCS, p));
      res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
      res.end(b);
    } catch {
      if (/^\/favicon\.ico$|^\/\.well-known\//.test(p)) { res.writeHead(204); res.end(); return; }
      MISSING.push(p); res.writeHead(404); res.end("not found");
    }
  });
  s.listen(0, () => r(s));
});
const port = server.address().port;

let failures = 0;
const ok = (label, cond, detail = "") => {
  if (cond) { console.log(`  ok    ${label}`); return; }
  failures++;
  console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: (await findChromium()) || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });

console.log("\n[forward-dom] the forward outcome view at every width it is drawn at");

for (const [band, W] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 1200 }, ...HERMETIC });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${port}/storm-atlas/${QUERY}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__ATLAS && globalThis.__ATLAS.archive, { timeout: 90000 });
  await page.waitForTimeout(500);

  console.log(`\n  ── ${W}px · ${band}`);

  /* THE OFFER IS PRESENT AND THE FORECAST IS NOT ALREADY READ. The payload is 80 KB of the
     pipeline's, and taking it without being asked is the cost this design refused. */
  const offer = await page.$("[data-forward-load]");
  ok("the forward view offers the read rather than taking it",
    !!offer && !(await page.$("[data-forward-outcome]")));
  if (!offer) { await ctx.close(); continue; }
  const before = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await offer.click();
  await page.waitForSelector("[data-forward-outcome]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(900);
  ok("and the placement renders on the press", !!(await page.$("[data-forward-outcome]")));
  ok("with nothing thrown", errors.length === 0, errors.join(" · "));

  /* THE FINDING SURVIVES THE WIDTH. */
  const hero = await page.$eval("[data-forward-outcome] .at-fo-hero",
    (n) => n.innerText.replace(/\s+/g, " ").trim()).catch(() => null);
  const stand = await page.$eval("[data-forward-outcome] .at-fo-stand",
    (n) => n.innerText.replace(/\s+/g, " ").trim()).catch(() => null);
  ok("the pinned reading is the hero, unchanged", hero === HERO, `${hero}`);
  ok("and the two-clock standfirst is beneath it", stand === STAND, `${stand}`);

  /* EXACTLY ONE LAYOUT IS DRAWN. Neither is the other scaled, so both on screen at once would
     mean a reader comparing two renderings of one instant. */
  const which = await page.evaluate(() => ({
    plate: getComputedStyle(document.querySelector("svg.at-fo-plate")).display,
    narrow: getComputedStyle(document.querySelector(".at-fo-narrow")).display,
  }));
  ok("exactly one of the two layouts is drawn",
    (which.plate === "none") !== (which.narrow === "none"),
    `plate ${which.plate} · narrow ${which.narrow}`);

  /* THE PAGE DOES NOT SCROLL SIDEWAYS BECAUSE OF THIS VIEW, and it is the DIFFERENCE that is
     asserted rather than the absolute. The Atlas already overflows by 8 px at 390 -- the evidence
     deck's status cell, which predates this work and is not this view's to fix -- so an absolute
     bound would either fail on someone else's defect or carry a slack big enough to hide a real
     one. `before` is measured on the same page, at the same width, one press earlier. The audit
     tables scroll themselves precisely so this number stays zero. */
  const grew = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("the view adds no sideways page scroll of its own", grew <= before,
    `${before}px before the press, ${grew}px after, at a ${W}px viewport`);

  if (which.plate !== "none") {
    /* ── THE TWO PLATE PROPERTIES A STYLESHEET CANNOT ASSERT ── */
    const plate = await page.evaluate(() => {
      const svg = document.querySelector("svg.at-fo-plate");
      const scale = svg.getBoundingClientRect().width / 1600;
      const texts = [...svg.querySelectorAll("text")];
      let min = Infinity, minWhat = "";
      const boxes = [];
      for (const n of texts) {
        const s = (n.textContent || "").trim();
        if (!s) continue;
        const px = parseFloat(getComputedStyle(n).fontSize) * scale;
        if (px < min) { min = px; minWhat = s.slice(0, 34); }
        const b = n.getBBox();
        boxes.push({ s: s.slice(0, 40), x: b.x, r: b.x + b.width, y: b.y, bot: b.y + b.height });
      }
      /* PAIRWISE, ON THE VIEWBOX'S OWN UNITS, because an overlap is an overlap at any scale.
         Two units of slack: adjacent glyph boxes on one baseline are not a collision. */
      const hits = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.r <= b.x + 2 || b.r <= a.x + 2) continue;
          if (a.bot <= b.y + 2 || b.bot <= a.y + 2) continue;
          hits.push(`"${a.s}" over "${b.s}"`);
        }
      }
      return { scale: +scale.toFixed(3), min: +min.toFixed(1), minWhat, hits, n: boxes.length };
    });
    ok(`the plate's smallest type reaches the screen at ${plate.min}px, not below ${MIN_PLATE_PX}`,
      plate.min >= MIN_PLATE_PX, `"${plate.minWhat}" at scale ${plate.scale}`);
    ok(`no two of the plate's ${plate.n} strings overlap`,
      plate.hits.length === 0, plate.hits.slice(0, 6).join("\n        "));
  } else {
    /* ── THE NARROW LAYOUT'S OWN TWO PROPERTIES ── */
    const narrow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".at-fo-nrow")];
      const head = document.querySelector(".at-fo-nrow.at-fo-nhead");
      const say = document.querySelector(".at-fo-nsay");
      const cw = document.documentElement.clientWidth;
      let widest = 0;
      for (const n of document.querySelectorAll(".at-fo-narrow *")) {
        const r = n.getBoundingClientRect();
        if (r.width > 0) widest = Math.max(widest, r.right);
      }
      return { rows: rows.length, head: !!head,
        say: say ? say.innerText.replace(/\s+/g, " ").trim() : null,
        widest: Math.round(widest), cw };
    });
    ok("the row stack shows the selected instants", narrow.rows >= 3 && narrow.rows <= 5,
      String(narrow.rows));
    ok("the emphasised instant is one of them, and carries the count",
      narrow.head && narrow.say === "6 of 94 at or above 115 kt", String(narrow.say));
    /* THE PRIMARY CHART IS READABLE WITHOUT HORIZONTAL SCROLLING. The audit table below may
       scroll itself; the row stack may not, because it is the whole point of this layout. */
    ok("and nothing in it runs off the side",
      narrow.widest <= narrow.cw + 1, `${narrow.widest} against ${narrow.cw}`);
  }

  /* THE VINTAGE IS ON SCREEN AT EVERY WIDTH. A placement without the advisory it was computed
     under is a number whose subject has already changed. */
  const vint = await page.$eval("[data-forward-vintage-row]",
    (n) => n.innerText.replace(/\s+/g, " ")).catch(() => null);
  ok("the advisory vintage travels with the placement",
    !!vint && /NHC ADVISORY 2026-09-21 03:00Z/.test(vint), String(vint).slice(0, 120));
  ok("and so does the control that can supersede it",
    !!(await page.$("[data-forward-refresh]")));

  await ctx.close();
}

/* ── AND THE REFUSAL, WHICH IS A STATE AND NOT AN ERROR ─────────────────────────────────────
 * A cohort that is NOT keyed to a live system's derived genesis gets no forward view at all --
 * not an empty one, not a disabled control. The offer is the claim that this population is about
 * that storm, and on a coordinate a reader typed near one it is not a claim this surface can
 * make. */
{
  console.log("\n  ── a cohort that is not keyed to a live system's genesis");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...HERMETIC });
  const page = await ctx.newPage();
  /* 60 km off Polo's genesis: near enough that the cohort overlaps heavily, far enough that it is
     not the derived-genesis point and therefore not this system's question. */
  await page.goto(`http://127.0.0.1:${port}/storm-atlas/?v=1&w=15.0%2C-105.6%2C250&m=1.1.0`,
    { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__ATLAS && globalThis.__ATLAS.archive, { timeout: 90000 });
  await page.waitForTimeout(700);
  ok("no forward view is offered", !(await page.$("[data-forward-row]")));
  ok("and none is rendered", !(await page.$("[data-forward-outcome]")));
  await ctx.close();
}

/* ── AND THE GUARD IS MADE TO FIRE ──────────────────────────────────────────────────────────
 *
 * Two assertions above are the whole reason this file exists, and both of them passed on the
 * BROKEN surface before it was fixed -- because neither existed. A gate written after the fact is
 * worth nothing unless it can be shown to catch the fault it was written for, so each is run
 * again against the surface with its fix undone, in the page, and has to fail.
 *
 * Nothing touches disk. The CSS variable is overridden and the label is moved back to its old y
 * inside the live document; the assertions are then re-evaluated over that mutation.
 */
if (process.argv.includes("--self-test")) {
  console.log("\n  ── the two faults this gate was written for, restored, must both be caught");
  const ctx = await browser.newContext({ viewport: { width: 960, height: 1200 }, ...HERMETIC });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/storm-atlas/${QUERY}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__ATLAS && globalThis.__ATLAS.archive, { timeout: 90000 });
  await page.waitForTimeout(500);
  await (await page.$("[data-forward-load]")).click();
  await page.waitForSelector("svg.at-fo-plate", { timeout: 30000 });
  await page.waitForTimeout(800);

  /* FAULT 1 · the type scale removed, which is the surface as it was measured at 5 px. */
  const seededMin = await page.evaluate(() => {
    const svg = document.querySelector("svg.at-fo-plate");
    svg.style.setProperty("--at-fo-ts", "1");
    const scale = svg.getBoundingClientRect().width / 1600;
    let min = Infinity;
    for (const n of svg.querySelectorAll("text")) {
      if (!(n.textContent || "").trim()) continue;
      min = Math.min(min, parseFloat(getComputedStyle(n).fontSize) * scale);
    }
    svg.style.removeProperty("--at-fo-ts");
    return +min.toFixed(1);
  });
  ok(`without the type scale the plate's smallest type is ${seededMin}px — CAUGHT`,
    seededMin < MIN_PLATE_PX, `${seededMin}px would have passed a floor of ${MIN_PLATE_PX}`);

  /* FAULT 2 · the series label back on the trace's own line, where it met the callout. */
  const seededHits = await page.evaluate(() => {
    const svg = document.querySelector("svg.at-fo-plate");
    const lab = svg.querySelector(".at-fo-series-off");
    const call = svg.querySelector(".at-fo-callout");
    lab.setAttribute("y", String(call.getBBox().y + call.getBBox().height));  // its former line
    const a = call.getBBox(), b = lab.getBBox();
    const over = !(a.r <= b.x + 2 || b.x + b.width <= a.x + 2)
      && !(a.y + a.height <= b.y + 2 || b.y + b.height <= a.y + 2);
    return { over: !!over, callR: +(a.x + a.width).toFixed(0), labX: +b.x.toFixed(0) };
  });
  ok("with the series label back on the callout's line the overlap is CAUGHT",
    seededHits.over,
    `callout ends ${seededHits.callR}, label starts ${seededHits.labX} — no overlap detected`);
  await ctx.close();
}

await browser.close();
server.close();

ok("no same-origin asset 404ed", MISSING.length === 0, MISSING.join(", "));

console.log(failures
  ? `\n${failures} failed`
  : "\nthe plate is legible and uncollided at every width it is drawn at, and the finding survives all of them");
process.exit(failures ? 1 : 0);
