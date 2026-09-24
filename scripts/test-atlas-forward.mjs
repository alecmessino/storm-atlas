#!/usr/bin/env node
/* ALIGNMENT BY ABSOLUTE VALID TIME — the Forward Outcome View's hard contract.
 *
 * WHAT THIS GATE EXISTS TO STOP. An advisory's forecast hours are counted from the ADVISORY.
 * This archive's distributions are counted from GENESIS. The offset is the storm's age, and it
 * grows for the life of the system. Two rows both labelled "+72 h" are therefore not the same
 * instant, and laying one against the other LOOKS like an alignment because both numbers are
 * lead hours.
 *
 * THE PINNED CASE, measured on Polo (EP172026):
 *
 *   NHC's forecast point labelled  +69 h   valid  2026-09-24T00:00Z   115 kt   CAT 4
 *   that instant is                +78 h   after the derived genesis of 2026-09-20T18:00Z
 *   the archive holds there          N 94  of 110 — sixteen records had ended
 *   at or above 115 kt                  6
 *
 * Had the surface matched on the label — reading +69, or +72 because it is close — it would have
 * landed on a different population and a different count with nothing on screen to say so.
 *
 * AND THE CONTRACT IS STRUCTURAL, NOT ONLY ARITHMETIC. §3 below asserts that `alignToGenesis`
 * has NO PARAMETER a lead hour could arrive through, and §4 proves a deliberately mislabelled
 * point is placed by its instant and not by its label. An arithmetic-only gate would pass over
 * an implementation that had quietly started trusting the label.
 *
 * OFFLINE. The b-deck and the official forecast are both committed fixtures, so this says the
 * same thing in five years; a gate that fetched the live advisory would go green the day NHC
 * revised it and tell nobody. The shipped payloads are then checked for SHAPE only.
 *
 * Run: node scripts/test-atlas-forward.mjs
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { openArchive, openLive } from "../docs/storm-atlas/src/engine/node-io.js";
import { cohortResult, genesisOnlySpec, toQuery } from "../docs/storm-atlas/src/engine/cohort.js";
import {
  MIN_SAMPLE, alignToGenesis, classOfKt, forwardDistribution, thresholdTiming,
  windAtElapsed,
} from "../docs/storm-atlas/src/engine/forward.js";
import * as FWD from "../docs/storm-atlas/src/engine/forward.js";
import {
  OFFICIAL_FILE, categoryLadder, isNewerVintage, officialPoints, operationalLifecycle,
} from "../docs/storm-atlas/src/engine/live.js";
import { ROOT } from "./lib/atlas-verify.mjs";

const DATA = join(ROOT, "docs/storm-atlas/data");
const BDECK = join(ROOT, "scripts/fixtures/bdeck-ep172026.dat");
const OFFICIAL = join(ROOT, "scripts/fixtures/official-ep172026.json");

let failed = 0;
let checks = 0;
const ok = (label, cond, detail = "") => {
  checks++;
  if (cond) { console.log("  ok    " + label); return; }
  failed++;
  console.log("  FAIL  " + label + (detail ? "\n        " + detail : ""));
};

const archive = await openArchive(DATA);
const ladder = categoryLadder(archive.manifest);

/* ---- the subject, from the committed b-deck --------------------------------------------- */
const { parseBestTrack } = await import("./lib/atcf.mjs");
const { operationalRecord } = await import("./lib/atlas-live.mjs");
const deck = parseBestTrack(await readFile(BDECK, "utf8"));
const rec = operationalRecord({
  atcfId: "EP172026", name: "Polo", records: deck.records, fetchedAt: "2026-09-21T03:17:12.772Z",
});
const lc = operationalLifecycle(rec.fixes, ladder);
const GEN_MS = lc.genesis;
const g = lc.genesis_position;

/* ---- the cohort: the LAUNCHER'S, and only the launcher's -------------------------------- */
const RADIUS = 250;
const spec = genesisOnlySpec({ lat: g.lat, lon: g.lon, radiusKm: RADIUS });
const cohort = cohortResult(archive, spec, { members: true });

/* ---- the official forecast, from the committed fixture ---------------------------------- */
const fixture = JSON.parse(await readFile(OFFICIAL, "utf8"));
const parsed = officialPoints({ trackPoints: fixture.trackPoints, name: fixture.name },
  { generatedAt: fixture.latest_json_generated_at });

console.log("\n[1] the cohort is the launcher's, unchanged");
{
  ok("derived genesis is 14.5N 105.1W at 2026-09-20T18:00Z, TD",
    g.lat === 14.5 && g.lon === -105.1 && new Date(GEN_MS).toISOString() === "2026-09-20T18:00:00.000Z"
      && lc.genesis_stage === "TD",
    `${g.lat},${g.lon} ${new Date(GEN_MS).toISOString()} ${lc.genesis_stage}`);
  ok("the cohort query carries exactly v and w",
    [...new URLSearchParams(toQuery(spec)).keys()].sort().join(",") === "v,w", toQuery(spec));
  ok("N is 110 and clears the sample gate",
    cohort.n_cases === 110 && cohort.sufficient, `N ${cohort.n_cases}`);
  console.log(`  note  ?${toQuery(spec)} · pack ${archive.manifest.provenance.archive_stamp}`);
}

console.log("\n[2] THE PINNED CONTRACT — +69 h label, +78 h elapsed, N 94, 6 at or above 115 kt");
{
  const aligned = alignToGenesis(archive, cohort.cases, { genesisMs: GEN_MS, points: parsed.points });
  const row = aligned.find((r) => r.label_hr === 69);

  ok("the advisory's +69 h point exists in the fixture", !!row);
  ok("it is valid at 2026-09-24T00:00:00.000Z",
    new Date(row.valid_ms).toISOString() === "2026-09-24T00:00:00.000Z",
    new Date(row.valid_ms).toISOString());
  ok("its official intensity is 115 kt, class cat4",
    row.kt === 115 && row.klass === "cat4", `${row.kt} ${row.klass}`);

  /* THE FOUR NUMBERS THE CONTRACT IS. */
  ok("the label is 69 and the ELAPSED time is 78 h — the clocks differ by the storm's age",
    row.label_hr === 69 && row.elapsed_h === 78, `label ${row.label_hr} elapsed ${row.elapsed_h}`);
  ok("the archive holds N = 94 at that instant", row.n === 94, `n ${row.n}`);
  ok("and 16 records had ENDED, which is what the shortfall from 110 is",
    row.ended === 16 && row.n + row.ended === cohort.n_cases,
    `n ${row.n} ended ${row.ended} of ${cohort.n_cases}`);
  ok("6 members were at or above 115 kt", row.n_at_or_above === 6, String(row.n_at_or_above));
  ok("the count is published and the DIVISION is not performed",
    row.at_or_above_kt === 115 && row.n_at_or_above === 6 && !("rate" in row)
      && !("probability" in row) && !("p" in row),
    Object.keys(row).join(","));

  console.log(`  note  NHC +${row.label_hr} h @ ${new Date(row.valid_ms).toISOString()} `
    + `= genesis +${row.elapsed_h} h = N ${row.n} = ${row.n_at_or_above} at or above ${row.kt} kt`);

  /* AND THE WRONG ROW, NAMED. This is the number the label match would have produced. */
  const naive = forwardDistribution(archive, cohort.cases, 69, { atOrAboveKt: 115 });
  ok("reading the +69 ELAPSED row instead would have given a different population",
    naive.n !== row.n || naive.n_at_or_above !== row.n_at_or_above,
    `label-matched n ${naive.n} / ${naive.n_at_or_above} vs aligned n ${row.n} / ${row.n_at_or_above}`);
  console.log(`  note  the label match would have read N ${naive.n}, `
    + `${naive.n_at_or_above} at or above — off the wrong distribution`);
}

console.log("\n[3] STRUCTURAL — there is no parameter a lead hour could arrive through");
{
  const src = await readFile(join(ROOT, "docs/storm-atlas/src/engine/forward.js"), "utf8");
  const sig = /export function alignToGenesis\s*\(([^)]*)\)/.exec(src);
  ok("alignToGenesis is exported", !!sig);
  const params = sig[1].replace(/\s+/g, " ").trim();
  ok(`alignToGenesis(${params}) takes no lead/hour/tau input`,
    !/\b(lead|leadH|hour|hours|hr|tau)\b/i.test(params), params);
  ok("it requires genesisMs and points", /genesisMs/.test(params) && /points/.test(params), params);
  ok("engine/forward.js does not import the operational layer",
    !/from\s+["']\.\/live\.js["']/.test(src));
  /* The label must be carried as an opaque passthrough, never read into arithmetic. */
  ok("label_hr is assigned from the input and never used in a computation",
    /label_hr:\s*p\.label_hr/.test(src)
      && !/label_hr\s*\*|\*\s*label_hr|label_hr\s*[-+]\s*\d|3600000\s*\*\s*[^;]*label_hr/.test(src));
}

console.log("\n[4] A DELIBERATELY MISLABELLED POINT IS PLACED BY ITS INSTANT");
{
  /* Same instant as the real +69 point, labelled +12. If the implementation ever trusted the
     label, this row would move; it must not. */
  const truth = alignToGenesis(archive, cohort.cases, {
    genesisMs: GEN_MS, points: [{ validMs: Date.parse("2026-09-24T00:00:00.000Z"), kt: 115, label_hr: 69 }],
  })[0];
  const lied = alignToGenesis(archive, cohort.cases, {
    genesisMs: GEN_MS, points: [{ validMs: Date.parse("2026-09-24T00:00:00.000Z"), kt: 115, label_hr: 12 }],
  })[0];
  ok("a point relabelled +12 at the same instant aligns identically",
    lied.elapsed_h === truth.elapsed_h && lied.n === truth.n
      && lied.n_at_or_above === truth.n_at_or_above,
    `truth +${truth.elapsed_h}h n${truth.n}/${truth.n_at_or_above} vs lied +${lied.elapsed_h}h n${lied.n}/${lied.n_at_or_above}`);
  ok("and it still reports the label it was given, for display",
    lied.label_hr === 12, String(lied.label_hr));

  /* Two points with the SAME label at DIFFERENT instants must not collapse together. */
  const pair = alignToGenesis(archive, cohort.cases, {
    genesisMs: GEN_MS,
    points: [
      { validMs: Date.parse("2026-09-22T00:00:00.000Z"), kt: 60, label_hr: 24 },
      { validMs: Date.parse("2026-09-25T00:00:00.000Z"), kt: 115, label_hr: 24 },
    ],
  });
  ok("two points sharing a label at different instants align to different elapsed times",
    pair[0].elapsed_h !== pair[1].elapsed_h,
    `${pair[0].elapsed_h} vs ${pair[1].elapsed_h}`);
  ok("...and to different populations", pair[0].n !== pair[1].n, `${pair[0].n} vs ${pair[1].n}`);

  ok("a point with no valid time is REFUSED, not positioned",
    alignToGenesis(archive, cohort.cases,
      { genesisMs: GEN_MS, points: [{ validMs: NaN, kt: 115, label_hr: 69 }] })[0].refused === "no valid time");
}

console.log("\n[5] ENDED IS NOT UNKNOWN, and the attrition is the finding");
{
  const leads = [0, 24, 48, 72, 96, 120].map((h) =>
    forwardDistribution(archive, cohort.cases, h));
  ok("every lead's evaluable n plus its ended count is the cohort",
    leads.every((d) => d.n + d.ended + d.unknown === cohort.n_cases),
    leads.map((d) => `${d.n}+${d.ended}+${d.unknown}`).join(" "));
  ok("the denominator falls monotonically across the horizon",
    leads.every((d, i) => i === 0 || d.n <= leads[i - 1].n), leads.map((d) => d.n).join(" → "));
  ok("and the shortfall is ENDED records, not unknown winds",
    leads[leads.length - 1].ended > 0 && leads.every((d) => d.unknown === 0),
    leads.map((d) => `${d.ended}/${d.unknown}`).join(" "));
  console.log(`  note  N ${leads.map((d) => d.n).join(" → ")} · ended ${leads.map((d) => d.ended).join(" → ")}`);

  /* A storm whose record ends before the instant must report ended, never a stale last wind. */
  const short = cohort.cases.find((c) => {
    const t0 = archive.storms.time("genesis_t", c.row);
    return windAtElapsed(archive, c.row, t0, 240).ended === true;
  });
  ok("a storm whose record ends before the instant reports ended", !!short);
}

console.log("\n[6] CAT5 TIMING IS REFUSED AT n = 3");
{
  const t = thresholdTiming(archive, cohort.cases);
  ok("cat5 carries 3 storms", t.cat5.n === 3, String(t.cat5.n));
  ok("cat5 is refused under MIN_SAMPLE " + MIN_SAMPLE, t.cat5.refused === true);
  ok("and publishes NO quantiles",
    t.cat5.median === null && t.cat5.p25 === null && t.cat5.p75 === null,
    JSON.stringify(t.cat5));
  ok("the count survives the refusal — the observation is real",
    t.cat5.n === 3 && t.cat5.of === 110);
  for (const k of ["ts", "cat1", "cat2", "cat3", "cat4"]) {
    ok(`${k} clears the gate and publishes a median`,
      t[k].n >= MIN_SAMPLE && !t[k].refused && Number.isFinite(t[k].median),
      `n ${t[k].n} median ${t[k].median}`);
  }
  console.log("  note  " + ["ts", "cat1", "cat2", "cat3", "cat4", "cat5"]
    .map((k) => `${k} ${t[k].n}${t[k].refused ? " REFUSED" : "@" + t[k].median + "h"}`).join(" · "));

  /* AND THE MODULE PUBLISHES NO LANDFALL TIMING, which is an assertion rather than an omission.
     It did, briefly: first landfall per STORM, refused under MIN_SAMPLE. The evidence deck
     already publishes landfall timing for this same cohort, from a different reading -- one value
     per TRANSIT, with no sample gate -- so on this cohort the deck's Hawaii row is n 5 with a
     median of 300 h where the per-storm reading is n 2 and refuses. Shipping both would hand a
     reader two medians for one question. The gap is the deck's; this module's job is to not be
     the second answer. */
  ok("engine/forward.js publishes no second landfall timing", !("landfallTiming" in FWD),
    Object.keys(FWD).join(", "));
}

console.log("\n[7] THE VINTAGE TRAVELS, AND A NEWER ONE SUPERSEDES");
{
  ok("the parsed forecast carries a vintage", !!parsed.vintage);
  ok("the vintage names the advisory instant, not only the payload",
    parsed.vintage.advisory_valid_at === "2026-09-21T03:00:00.000Z"
      && Number.isFinite(parsed.vintage.advisory_valid_ms),
    JSON.stringify(parsed.vintage.advisory_valid_at));
  ok("it carries the payload stamp too", !!parsed.vintage.payload_generated_at);
  ok("nine points, none dropped", parsed.points.length === 9 && parsed.dropped === 0,
    `${parsed.points.length} / dropped ${parsed.dropped}`);

  /* THE ADVISORY'S VALID TIME DECIDES, NOT THE PAYLOAD'S. */
  const a = parsed.vintage;
  const sameAdvisoryLaterPayload = { ...a, payload_generated_at: "2026-09-21T09:99:99.000Z" };
  const newerAdvisory = { ...a, advisory_valid_at: "2026-09-21T09:00:00.000Z",
    advisory_valid_ms: Date.parse("2026-09-21T09:00:00.000Z") };
  const olderAdvisory = { ...a, advisory_valid_at: "2026-09-20T21:00:00.000Z",
    advisory_valid_ms: Date.parse("2026-09-20T21:00:00.000Z") };
  ok("a newer ADVISORY is a newer vintage", isNewerVintage(a, newerAdvisory) === true);
  ok("an older advisory is NOT, whatever its payload stamp",
    isNewerVintage(a, olderAdvisory) === false);
  ok("the same advisory re-read is not a new vintage on the advisory test alone",
    isNewerVintage(a, { ...a }) === false);
  ok("no vintage at all is never newer", isNewerVintage(a, null) === false);
  ok("and anything supersedes nothing", isNewerVintage(null, a) === true);

  /* RECOMPUTATION: a newer vintage with a different forecast must move the placement. */
  const revised = parsed.points.map((p) =>
    p.label_hr === 69 ? { ...p, kt: 75 } : p);
  const before = alignToGenesis(archive, cohort.cases,
    { genesisMs: GEN_MS, points: parsed.points }).find((r) => r.label_hr === 69);
  const after = alignToGenesis(archive, cohort.cases,
    { genesisMs: GEN_MS, points: revised }).find((r) => r.label_hr === 69);
  ok("a revised intensity at the same instant moves the placement and not the population",
    after.n === before.n && after.elapsed_h === before.elapsed_h
      && after.n_at_or_above !== before.n_at_or_above,
    `before ${before.n_at_or_above}/${before.n} at ${before.kt} kt · `
    + `after ${after.n_at_or_above}/${after.n} at ${after.kt} kt`);
  console.log(`  note  115 kt -> ${before.n_at_or_above}/${before.n} · `
    + `75 kt -> ${after.n_at_or_above}/${after.n} at the same instant`);
}

console.log("\n[8] the SHIPPED payloads still have the shape the view reads");
{
  const live = await openLive(DATA);
  ok("the live layer loads", live.ok, String(live.error));
  /* THE PATH THE SHELL WILL ACTUALLY FETCH, RESOLVED THE WAY A BROWSER RESOLVES IT.
     `OFFICIAL_FILE` is relative to the Atlas's own data base, and the file it names is the
     forecast payload one directory further up. The first draft climbed once instead of twice
     and resolved to `storm-atlas/data/latest.json`, which does not exist: the fetch 404'd, the
     surface reported "the forecast payload could not be read", and nothing in the code looked
     wrong. So the string is resolved here, against the base the shell passes, and the file has
     to be on disk where it lands. */
  const PAGE_DIR = "/storm-atlas/";
  const DATA_BASE = "data";                        // as ui/atlas.jsx declares it
  const resolved = new URL(`${DATA_BASE}/${OFFICIAL_FILE}`, `http://x${PAGE_DIR}`).pathname;
  ok("the official-forecast path resolves out of the Atlas and onto the forecast payload",
    resolved === "/storm-atlas/data/latest.json", `${DATA_BASE}/${OFFICIAL_FILE} -> ${resolved}`);
  const onDisk = join(ROOT, "docs", resolved.replace(/^\//, ""));
  ok("and a file is actually shipped at that path", existsSync(onDisk), onDisk);

  const latest = JSON.parse(await readFile(onDisk, "utf8"));
  ok("the forecast payload declares a generatedAt", !!latest.generatedAt);
  ok("and carries a storms array", Array.isArray(latest.storms) && latest.storms.length > 0);

  for (const id of (live.health && live.health.active_atcf_ids) || []) {
    const r = live.record(id);
    const l = operationalLifecycle(r.fixes, ladder);
    const storm = latest.storms.find((s) => String(s.id || "").toUpperCase() === id);
    if (!storm) { console.log(`  note  ${id} (${r.name}) — no official forecast in the payload`); continue; }
    const pp = officialPoints(storm, latest);
    ok(`${id}: every official point carries a parseable absolute valid time`,
      pp.dropped === 0 && pp.points.every((p) => Number.isFinite(p.validMs)),
      `dropped ${pp.dropped}`);
    if (l.genesis === null) { console.log(`  note  ${id} has no derived genesis — no alignment`); continue; }
    const rows = alignToGenesis(archive, cohort.cases, { genesisMs: l.genesis, points: pp.points });
    ok(`${id}: every aligned row derives elapsed from the instant`,
      rows.every((row) => row.elapsed_h === (row.valid_ms - l.genesis) / 3600000));
    console.log(`  note  ${id} (${r.name}) advisory ${pp.vintage.advisory_valid_at} · `
      + `age at advisory ${((pp.vintage.advisory_valid_ms - l.genesis) / 3600000).toFixed(0)} h · `
      + `${pp.points.length} points`);
  }
}

console.log(`\n${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
