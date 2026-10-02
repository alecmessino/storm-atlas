/* A SEALED READING — one cohort's answer, frozen into an object that can be checked.
 *
 * WHAT A CITATION COULD NOT DO. The citation line names the question, the methodology and the
 * archive, and a link reopens the cohort -- but nothing proved that the cohort it reopened was
 * the one that was cited. An archive rebuild that moved one storm in or out of the radius would
 * reopen a different population under an identical sentence, and nobody would know.
 *
 * WHAT THE SEAL ADDS, AND NOTHING ELSE.
 *   members.fingerprint  SHA-256 over the sorted archive storm ids of the cohort. Two readings
 *                        with the same fingerprint counted exactly the same storms; a link that
 *                        carries it can say on open whether the archive still does.
 *   seal                 SHA-256 over the canonical JSON of the whole reading, so the rows, the
 *                        question and the provenance are bound together and none can be edited
 *                        alone.
 *
 * NOTHING HERE COMPUTES A RATE. Every figure in `rows` is read off the cohort result the surface
 * already published; the seal records them, it does not produce them. It is pure and imports no
 * UI, so the command line seals the same object the browser does.
 */
import { toQuery } from "./cohort.js";
import { intensityContractKey, landfallContractKey } from "./calibration.js";
import { regionLabel } from "./cohort-language.js";

export const READING_SCHEMA = "atlas-reading/1";

/* ── SHA-256, synchronous and dependency-free ──────────────────────────────────────────────
   WebCrypto is asynchronous and absent outside a secure context; a seal that could not be
   computed while the page renders would be a seal the page cannot show. This is the FIPS 180-4
   algorithm over UTF-8, checked against the standard vectors in scripts/test-atlas-seal.mjs. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + 4 * t);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/* CANONICAL JSON: keys sorted at every depth, no whitespace. The seal is a hash of this, so two
   objects that differ only in key order seal identically and any change of value does not. */
export function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
}

/** The storm ids of a set of pack rows, sorted -- the member list a fingerprint is taken over. */
export function memberIds(archive, rows) {
  const out = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) out[i] = archive.storms.str("storm_id", rows[i]);
  return out.sort();
}

/** `sha256:<hex>` over the newline-joined sorted ids. */
export function fingerprintOf(archive, rows) {
  return `sha256:${sha256Hex(memberIds(archive, rows).join("\n"))}`;
}

/** The short form a URL carries: 16 hex characters of the fingerprint. */
export const shortFingerprint = (fp) => String(fp || "").replace(/^sha256:/, "").slice(0, 16);

/**
 * The member fingerprint a `seal=` value names, as the 16-hex short form -- or null when the value
 * is not a fingerprint at all. Accepts the short form a sealed link carries, the full 64-hex
 * fingerprint (the seal dialog, the JSON and the CLI all print it) and a "sha256:" prefix; the
 * comparison is always on the first 16 characters. A value that is none of these was never a
 * seal, and saying it names "a different set of storms" would be a false claim about the archive.
 */
export function parseSealParam(value) {
  const v = String(value ?? "").trim().toLowerCase().replace(/^sha256:/, "");
  return /^[0-9a-f]{16}([0-9a-f]{48})?$/.test(v) ? v.slice(0, 16) : null;
}

/* THE ROWS A READING PUBLISHES, IN THE LEDGER'S ORDER, WITH THE REFUSAL KIND IT PRINTS.
 *
 * The same walk the ledger's row assembly makes (buildGroups in ui/evidence-deck.jsx): the
 * intensity ladder from TS up, then every landfall region by the count the archive holds, any
 * before >=64 kt. The refusal kind is read off the same three engine facts the surface reads --
 * an unscoreable contract (out of scope, or base rate only), a contract the cohort is conditioned
 * on, a rate the sample gate refused -- so a browser seal and a command-line seal of one cohort
 * are the same object. test-atlas-seal.mjs checks the two orders agree. */
const LADDER = ["ts", "cat1", "cat2", "cat3", "cat4", "cat5"];
const CAT_LABEL = { ts: "TROPICAL STORM", cat1: "CATEGORY 1", cat2: "CATEGORY 2",
  cat3: "CATEGORY 3", cat4: "CATEGORY 4", cat5: "CATEGORY 5" };
const CIRCULAR = "CONDITIONED ON -- NOT AN OUTCOME";

function kindOf(cell, unscoreable) {
  if (unscoreable) return /^OUT OF SCOPE/.test(unscoreable.status || "") ? "OUT_OF_SCOPE" : "BASE_RATE_ONLY";
  if (cell && cell.status === CIRCULAR) return "CONDITIONED_ON";
  if (cell && cell.rate === null) return "RATE_REFUSED";
  return null;
}

export function sealRowsOf(result) {
  const rows = [];
  const un = result.unscoreable || {};
  for (const cat of LADDER) {
    const cell = result.intensity ? result.intensity[cat] : null;
    rows.push({ contractKey: intensityContractKey(cat), key: `int:${cat}`, label: CAT_LABEL[cat],
      cell, unscoreable: un[cat], refusal: kindOf(cell, un[cat]) });
  }
  const regions = Object.entries(result.landfall || {})
    .sort((a, b) => b[1].any.count - a[1].any.count || a[0].localeCompare(b[0]));
  for (const [region, kinds] of regions) {
    for (const kind of ["any", "hurricane"]) {
      const cell = kinds[kind];
      const u = un[`${region}:${kind}`];
      rows.push({ contractKey: landfallContractKey(region, kind), key: `lf:${region}:${kind}`,
        label: `${regionLabel(region)}${kind === "hurricane" ? " · ≥64 KT" : ""}`,
        cell, unscoreable: u, refusal: kindOf(cell, u) });
    }
  }
  return rows;
}

const r4 = (x) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 1e6) / 1e6);

/**
 * Seal one reading.
 *
 * @param archive   the loaded archive
 * @param spec      the cohort spec
 * @param result    cohortResult(archive, spec) -- the published answer
 * @param opts.question   the sentence the surface printed (the citation's words)
 * @param opts.baseline   { noun, result } when a comparison is on screen -- recorded, not sealed:
 *                        which condition a baseline holds out is a reading choice, not the answer
 * @param opts.withIds    include the member id list itself (the download does; a URL does not)
 */
export function sealReading(archive, spec, result, { question = null, baseline = null,
  withIds = true } = {}) {
  const rows = sealRowsOf(result);
  const m = archive.manifest;
  const p = m.provenance || {};
  const ids = memberIds(archive, result.rows);
  const fingerprint = `sha256:${sha256Hex(ids.join("\n"))}`;
  const reading = {
    schema: READING_SCHEMA,
    question,
    query: toQuery(spec).toString(),
    methodology: m.methodology_version,
    archive: {
      cohort_archive_id: p.cohort_archive_id || null,
      pack: p.archive_stamp || null,
      built_utc: p.archive_built_utc || null,
      storms: m.counts.storms,
    },
    cohort: {
      n: result.kept,
      sufficient: !!result.sufficient,
      min_sample: result.min_sample,
    },
    members: { count: ids.length, fingerprint, ids: withIds ? ids : undefined },
    baseline: baseline && baseline.result ? {
      without: baseline.noun || null,
      n: baseline.result.kept,
      fingerprint: fingerprintOf(archive, baseline.result.rows),
    } : null,
    rows: rows.map((row) => {
      const c = row.cell || null;
      const refused = !!row.unscoreable || !c || c.rate === null || c.status;
      return {
        contract: row.contractKey || row.key,
        label: row.label,
        count: c ? c.count : null,
        n: c ? c.n_storms : null,
        rate: refused ? null : r4(c.rate),
        ci95: refused || !c.ci95 ? null : [r4(c.ci95[0]), r4(c.ci95[1])],
        /* The refusal KIND is the surface's (refusalKindOfRow), passed in; a caller without it
           still records that the row refused. */
        refused: refused ? (row.refusal || "REFUSED") : null,
      };
    }),
  };
  /* WHAT THE SEAL BINDS. Everything a reader would cite -- the question, the query, the
     methodology, the archive's identity, the members' fingerprint and every row's figures --
     and NOT the two stamps that move without the data moving: the pack stamp and the build
     time change on every ingest of an unchanged archive, and a seal over them would make the
     same reading re-seal differently next week. `cohort_archive_id` is the archive's identity
     and moves only when the cohort tables do. The id list's presence is also left out: a
     reading downloaded with its ids and one carried without them seal identically, because
     the fingerprint binds the ids. */
  const body = {
    ...reading,
    archive: { cohort_archive_id: reading.archive.cohort_archive_id, storms: reading.archive.storms },
    members: { count: ids.length, fingerprint },
    baseline: undefined,
  };
  reading.seal = `sha256:${sha256Hex(canonical(body))}`;
  return reading;
}

/** Rows as CSV, one contract per line, figures exactly as sealed. */
export function readingCsv(reading) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["contract", "label", "count", "n", "rate", "ci95_lo", "ci95_hi", "refused"];
  const lines = [head.join(",")];
  for (const r of reading.rows) {
    lines.push([r.contract, r.label, r.count, r.n, r.rate,
      r.ci95 ? r.ci95[0] : null, r.ci95 ? r.ci95[1] : null, r.refused].map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}
