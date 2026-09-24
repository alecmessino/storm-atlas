#!/usr/bin/env node
/* Storm Atlas live refresh: one tick.
 *
 * Writes the two public live files the Atlas reads, and nothing else:
 *   docs/data/atlas-live-v1.json  the operational record per ATCF id (scripts/lib/atlas-live.mjs)
 *   docs/data/latest.json         NHC's official forecast track per active storm, WHITELISTED to
 *                                 the fields src/engine/live.js reads: generatedAt and
 *                                 storms[].{id, name, trackPoints[].{at, hr, validZ, kt, gustKt}}
 *
 * The storm list, the deck ingest, the retention read and the forecast parse are the same code
 * the original pipeline ran; only the output set is narrowed. scripts/test-public-schema.mjs
 * fails the build if either file ever carries a field outside that schema. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestIntel } from "./ingest.mjs";
import { buildAtlasLive } from "./lib/atlas-live.mjs";
import { num, parseLat, parseLon, fetchForecastFor } from "./lib/official-forecast.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dir, process.env.ATLAS_DATA_DIR || "../docs/data");
const LIVE_FILE = "atlas-live-v1.json";
const OFFICIAL_FILE = "latest.json";
export const OFFICIAL_SCHEMA = "storm-atlas-official-v1";
const UA = "StormAtlas/1.0 (research archive)";
const now = new Date();

async function getJSON(url, { timeout = 20000, headers = {} } = {}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json", ...headers }, signal: ctrl.signal });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, status: res.status, latencyMs, error: "HTTP " + res.status };
    const json = await res.json();
    return { ok: true, status: res.status, latencyMs, json };
  } catch (e) {
    return { ok: false, status: null, latencyMs: Date.now() - t0, error: String(e && e.message || e) };
  } finally { clearTimeout(to); }
}

/* The storm list: the id/name/center mapping of the original pipeline, plus the fields the
   forecast parse needs (basin, current wind, advisory time, forecast-advisory URL). */
async function fetchStormList() {
  const url = "https://www.nhc.noaa.gov/CurrentStorms.json";
  const r = await getJSON(url, { headers: { "Accept": "*/*" } });
  if (!r.ok) return { ok: false, note: r.error, storms: [] };
  const active = (r.json && (r.json.activeStorms || r.json.storms)) || [];
  const storms = active.map((s) => {
    const lat = parseLat(s.latitude ?? s.latitudeNumeric);
    const lon = parseLon(s.longitude ?? s.longitudeNumeric);
    const id = (s.id || s.binNumber || (s.name || "storm")).toString().toUpperCase();
    const basin = /^(AL|AT)/i.test(id) ? "east" : /^(EP|CP)/i.test(id) ? "west" : (lon != null && lon < -100 ? "west" : "east");
    const adv = s.publicAdvisory || {};
    const fcst = s.forecastAdvisory || {};
    return { id, name: s.name || "Unnamed", basin, center: lat != null && lon != null ? [lat, lon] : null,
      wind: num(s.intensity), advTimeZ: adv.issuance || s.lastUpdate || null,
      _fcstUrl: fcst.url || (typeof fcst === "string" ? fcst : null) };
  }).filter((s) => s.center);
  return { ok: true, storms, note: storms.length ? `${storms.length} active` : "no active tropical cyclones" };
}

/* THE WHITELIST. Only these fields leave this script in latest.json. */
export function officialPayload(storms, generatedAt) {
  const pick = (p) => ({ at: Array.isArray(p.at) ? [p.at[0], p.at[1]] : null, hr: p.hr ?? null,
    validZ: p.validZ ?? null, kt: p.kt ?? null, gustKt: p.gustKt ?? null });
  return {
    schema: OFFICIAL_SCHEMA,
    generatedAt,
    storms: storms.filter((s) => Array.isArray(s.trackPoints) && s.trackPoints.length)
      .map((s) => ({ id: s.id, name: s.name, trackPoints: s.trackPoints.map(pick) })),
  };
}

async function main() {
  const { storms, ok, note } = await fetchStormList();
  console.log(`  NHC: ${ok ? "ok" : "FAIL"} (${note})`);
  await mkdir(DATA_DIR, { recursive: true });

  /* Official forecast. A storm whose product will not parse is left out, and the Atlas says
     "no forecast for this system" rather than showing a stub. A failed storm list leaves the
     previous file in place. */
  if (ok) {
    for (const s of storms) {
      try { const f = await fetchForecastFor(s, s._fcstUrl); s.trackPoints = f.trackPoints || null; }
      catch (e) { s.trackPoints = null; console.log(`  forecast ${s.id}: FAILED — ${e && e.message || e}`); }
    }
    const off = officialPayload(storms, now.toISOString());
    await writeFile(resolve(DATA_DIR, OFFICIAL_FILE), JSON.stringify(off) + "\n");
    console.log(`  official: ${off.storms.length} forecast track(s)`);
  }

  /* Operational record: unchanged logic (ingest, retention read, build, minified write). */
  try {
    const intel = await ingestIntel(storms, { nowMs: now.getTime() });
    let prevLive = null;
    try { prevLive = JSON.parse(await readFile(resolve(DATA_DIR, LIVE_FILE), "utf8")); } catch { /* first run */ }
    const live = buildAtlasLive({ storms, intel, nowMs: now.getTime(), previous: prevLive });
    await writeFile(resolve(DATA_DIR, LIVE_FILE), JSON.stringify(live) + "\n");
    console.log(`  atlas-live: ${live.health.note}`
      + (live.health.stale_atcf_ids.length ? ` · STALE ${live.health.stale_atcf_ids.join(",")}` : ""));
  } catch (e) {
    console.log(`  atlas-live: FAILED — ${e && e.message ? e.message : e}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => { console.error("[refresh-atlas] fatal:", e); process.exit(1); });
}
