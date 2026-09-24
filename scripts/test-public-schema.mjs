#!/usr/bin/env node
/* PUBLIC-SCHEMA GATE for the two live files this repo publishes.
 *
 * Whitelist, not blacklist: every key in docs/data/atlas-live-v1.json and docs/data/latest.json
 * must appear in the approved schema below, at the path where it appears. Anything else fails:
 * a new field is a publication decision, and it has to be made here, in review.
 *
 * It also fails on market / terminal-only keys anywhere, and on string values that carry
 * contact strings, internal routes, repository links or source-map references.
 *
 *   node scripts/test-public-schema.mjs              check the committed files
 *   node scripts/test-public-schema.mjs --self-test  prove the gate rejects what it must */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { officialPayload } from "./refresh-atlas.mjs";
import { findHashedTerms, HASHED_TERMS } from "./lib/term-hash.mjs";
/* The value rule for the organisation term, kept exactly as before (now hashed, not named). */
const VALUE_TERMS = HASHED_TERMS.filter((t) => t.id === "hashed-term-2");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ATCF = /^[A-Z]{2}\d{6}$/;
const IDENT = /^[A-Za-z][A-Za-z0-9]*$/;

/* Approved schema. `{}` = object with exactly these optional keys; `[x]` = array of x;
   "*" = scalar (string, number, boolean or null); { $map: KEYRE, $of: x } = keyed object. */
const FIX = { t: "*", lat: "*", lon: "*", kt: "*", mslp: "*", stage: "*" };
const SOURCE = { name: "*", kind: "*", url: "*", note: "*", status: "*", bytes: "*" };
const SHIPS = {
  source: "*", product: "*", tau: "*", valid_time: "*", fetched_at: "*", age_hours: "*",
  lat: "*", lon: "*", availability: { ohc: "*", ir: "*" },
  fields: { $map: IDENT, $of: { value: "*", label: "*" } },
  field_count: "*", not_comparable_with: "*", note: "*",
};
const RECORD = {
  atcf_id: "*", season: "*", basin: "*", name: "*", name_source: "*", fetched_at: "*",
  first_valid_time: "*", latest_valid_time: "*", age_hours: "*", fix_count: "*",
  fixes: [FIX], latest: FIX, stage: "*", stage_label: "*", peak_wind_kt: "*", peak_wind_at: "*",
  min_mslp_mb: "*", min_mslp_at: "*", fixes_with_wind: "*", fixes_with_pressure: "*",
  ships_rt: SHIPS, source: SOURCE, active: "*",
};
const IDS = ["*"];
export const SCHEMAS = {
  "atlas-live-v1.json": {
    schema: "*", generated_at: "*",
    source: { name: "*", url: "*", kind: "*", note: "*" },
    freshness: { active_stale_hours: "*", retention_days: "*", note: "*" },
    health: { ok: "*", note: "*", active_atcf_ids: IDS, expected_atcf_ids: IDS, emitted_atcf_ids: IDS,
      missing_atcf_ids: IDS, retained_atcf_ids: IDS, stale_atcf_ids: IDS },
    storms: { $map: ATCF, $of: RECORD },
  },
  "latest.json": {
    schema: "*", generatedAt: "*",
    storms: [{ id: "*", name: "*", trackPoints: [{ at: ["*"], hr: "*", validZ: "*", kt: "*", gustKt: "*" }] }],
  },
};
export const FIXED = { "atlas-live-v1.json": { schema: "atlas-live-v1" }, "latest.json": { schema: "storm-atlas-official-v1" } };

/* Keys that must never appear anywhere, whatever the schema says. */
const FORBIDDEN_KEY = /(kalshi|market|contract|edge|kelly|stake|odds|price|bet|terminal|polymarket|ticker|position|pnl|wager)/i;
/* String values that must never appear. */
const FORBIDDEN_VALUE = [
  /kalshi/i, /polymarket/i, /\bmarkets?\b/i, /\bedge\b/i, /terminal/i, /\/briefs\//i, /\/chats\//i,
  /OUTBOUND/, /EXTERNAL-USER/, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /github\.com\/alecmessino\/category-alpha/i, /category-alpha/i, /sourceMappingURL/i,
  /\/home\//, /\/tmp\//, /scratchpad/i,
];

export function check(obj, spec, path = "$", errs = []) {
  if (spec === "*") {
    if (obj !== null && typeof obj === "object") errs.push(`${path}: expected a scalar`);
    else if (typeof obj === "string") for (const re of FORBIDDEN_VALUE) if (re.test(obj)) errs.push(`${path}: value matches ${re}`);
    if (typeof obj === "string" && findHashedTerms(obj, VALUE_TERMS).length) errs.push(`${path}: value contains a hashed blocked term`);
    return errs;
  }
  if (Array.isArray(spec)) {
    if (!Array.isArray(obj)) { errs.push(`${path}: expected an array`); return errs; }
    obj.forEach((v, i) => check(v, spec[0], `${path}[${i}]`, errs));
    return errs;
  }
  if (obj === null) return errs;                       // an absent sub-record is allowed
  if (typeof obj !== "object" || Array.isArray(obj)) { errs.push(`${path}: expected an object`); return errs; }
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEY.test(k)) { errs.push(`${path}.${k}: forbidden key`); continue; }
    if (spec.$map) {
      if (!spec.$map.test(k)) errs.push(`${path}.${k}: key not allowed by ${spec.$map}`);
      else check(v, spec.$of, `${path}.${k}`, errs);
    } else if (!(k in spec)) errs.push(`${path}.${k}: field outside the approved schema`);
    else check(v, spec[k], `${path}.${k}`, errs);
  }
  return errs;
}

function checkFile(name, obj) {
  const errs = check(obj, SCHEMAS[name]);
  for (const [k, v] of Object.entries(FIXED[name])) if (obj[k] !== v) errs.push(`$.${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(obj[k])}`);
  return errs;
}

function selfTest() {
  const live = JSON.parse(readFileSync(resolve(ROOT, "docs/data/atlas-live-v1.json"), "utf8"));
  const off = JSON.parse(readFileSync(resolve(ROOT, "docs/data/latest.json"), "utf8"));
  const id = Object.keys(live.storms)[0];
  const mut = (o, f) => { const c = structuredClone(o); f(c); return c; };
  const cases = [
    ["live: clean", "atlas-live-v1.json", live, 0],
    ["official: clean", "latest.json", off, 0],
    ["official: top-level contracts", "latest.json", mut(off, (c) => { c.contracts = []; }), 1],
    ["official: extra storm field (cone)", "latest.json", mut(off, (c) => { c.storms[0].cone = [[1, 2]]; }), 1],
    ["official: marketCat4 on a storm", "latest.json", mut(off, (c) => { c.storms[0].marketCat4 = 0.4; }), 1],
    ["official: point carries ktFrom", "latest.json", mut(off, (c) => { c.storms[0].trackPoints[0].ktFrom = "x"; }), 1],
    ["official: terminal schema tag", "latest.json", mut(off, (c) => { c.schema = "millibar-terminal/1"; }), 1],
    ["live: new record field", "atlas-live-v1.json", mut(live, (c) => { c.storms[id].edge = 1; }), 1],
    ["live: bad storm key", "atlas-live-v1.json", mut(live, (c) => { c.storms.polo = c.storms[id]; }), 1],
    ["live: email in a note", "atlas-live-v1.json", mut(live, (c) => { c.source.note = "ask someone@example.invalid"; }), 1],
    ["live: repo link in a url", "atlas-live-v1.json", mut(live, (c) => { c.source.url = "https://github.com/alecmessino/category-alpha"; }), 1],
    ["live: internal route", "atlas-live-v1.json", mut(live, (c) => { c.source.note = "see /briefs/ledger"; }), 1],
  ];
  let bad = 0;
  for (const [n, f, o, want] of cases) {
    const got = checkFile(f, o).length ? 1 : 0;
    if (got !== want) bad++;
    console.log(`${got === want ? "PASS" : "WRONG"}  ${n} (want ${want ? "reject" : "accept"})`);
  }
  /* The producer's own whitelist drops what it is handed. */
  const noisy = [{ id: "EP172026", name: "POLO", marketCat4: 0.9, cone: [[0, 0]],
    trackPoints: [{ at: [1, 2], hr: 0, validZ: "2026-09-23T18:00:00.000Z", kt: 125, gustKt: 150, ktFrom: "x", extra: 1 }] }];
  const produced = officialPayload(noisy, "2026-09-23T18:00:00.000Z");
  const pe = checkFile("latest.json", produced);
  console.log(`${pe.length ? "WRONG" : "PASS"}  producer whitelist strips unapproved fields`);
  if (pe.length) { bad++; console.log("   ", pe.join("\n    ")); }
  console.log(bad ? `\n${bad} case(s) wrong` : "\nself-test: every case as required");
  return bad;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && process.argv.includes("--self-test")) process.exit(selfTest() ? 1 : 0);
if (isMain) main();
function main() {
let failed = 0;
for (const name of Object.keys(SCHEMAS)) {
  const obj = JSON.parse(readFileSync(resolve(ROOT, "docs/data", name), "utf8"));
  const errs = checkFile(name, obj);
  console.log(`${errs.length ? "FAIL" : "PASS"}  docs/data/${name}`);
  for (const e of errs.slice(0, 40)) console.log("   ", e);
  if (errs.length) failed++;
}
process.exit(failed ? 1 : 0);
}
