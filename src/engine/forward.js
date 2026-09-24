/* WHAT A COHORT DID NEXT — the archive sampled forward from genesis, at absolute instants.
 *
 * WHY THIS FILE IS PURELY HISTORICAL, and why that is structural rather than tidy. The Forward
 * Outcome View lays an official forecast against this archive. The forecast is operational; this
 * module must not be. So nothing here knows what a forecast is: `alignToGenesis` takes an array
 * of `{ validMs, kt }` — two numbers — and an archive, and returns what the archive did at those
 * instants. It imports no operational module, and `scripts/test-atlas-live-boundary.mjs` lists it
 * among the modules that may not reach one.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * THE HARD CONTRACT: ALIGNMENT IS BY ABSOLUTE VALID TIME. NEVER BY LEAD LABEL.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * An advisory's forecast hours are counted from the ADVISORY. This archive's distributions are
 * counted from GENESIS. The two are offset by the storm's age, which is not a constant — it
 * grows for the life of the system.
 *
 * Measured on the case this shipped against. Polo's derived genesis is 2026-09-20T18:00Z and its
 * advisory instant is 2026-09-21T03:00Z, so the clocks are 9 h apart:
 *
 *   the forecast point NHC labels  +69 h   is valid  2026-09-24T00:00Z
 *   that instant is                +78 h   after genesis
 *   the archive there holds        N 94    of 110 — sixteen records had ended
 *   at or above its 115 kt         6
 *
 * Reading the +69 row of a genesis-indexed table, or the +72 row because "72 is about right",
 * lands on a different population and a different count, and LOOKS like an alignment because
 * both numbers are lead hours. On a five-day-old storm the two clocks are 120 h apart and the
 * label match is not slightly wrong, it is meaningless.
 *
 * SO THE LEAD LABEL IS AN OUTPUT OF THIS MODULE AND NEVER AN INPUT. There is no parameter any
 * caller could pass a lead hour in. `elapsed_h` is computed here, from `validMs - genesisMs`,
 * and returned so a surface can print it. A caller holding an advisory's own `hr` may carry it
 * through as `label_hr` for display, and it is never read.
 */

import { MIN_SAMPLE, categoryFor } from "./stats.js";

/* THE ARCHIVE'S OWN GATE, IMPORTED RATHER THAN RESTATED. This module used to declare its own
   `MIN_SAMPLE = 10`, and so did cohort.js: three tens in three files, agreeing by coincidence.
   A quantile over three storms is not a distribution, and which threshold says so is a fact
   about the archive, not about this surface. Re-exported so callers keep one import. */
export { MIN_SAMPLE };

/* THE CLASS OF A WIND IS `categoryFor`, NOT A SECOND LADDER.
   An earlier draft read THRESHOLDS_KT here and walked it. It agreed with stats.js, which is
   the problem: two readings of one ladder agree until someone edits one of them, and the one
   that would have drifted is the one on the forecast side of a comparison whose entire claim is
   that both sides are measured the same way. Re-exported so this module's own callers have one
   import, and it is the archive's function. */
export { categoryFor as classOfKt };

function quantile(sorted, p) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * One storm's wind at a given elapsed time after its own genesis.
 *
 * THREE OUTCOMES, AND THE SECOND IS THE ONE THAT MATTERS.
 *
 *   { kt }        the archive holds a wind at or before that instant;
 *   { ended }     the storm's record STOPS before that instant — it had ceased to exist;
 *   { unknown }   the record reaches that instant and holds no wind there (rule 4).
 *
 * `ended` is not a missing measurement and must never be pooled with one. A cohort that falls
 * from 110 to 70 across a forecast horizon has not become uncertain; forty of its storms were
 * over. Reporting that as an absent value would turn "the storm dissipated" into "we do not
 * know", which is the one substitution this archive exists to refuse.
 *
 * THE WIND IS THE LAST FIX AT OR BEFORE THE INSTANT, never an interpolation between two. The
 * pack's track points are already 3-hourly with the archive's own interpolated rows among them;
 * inventing a value between them would be this surface adding a measurement to the record.
 */
export function windAtElapsed(archive, row, genesisMs, elapsedH) {
  const P = archive.points;
  const [a, b] = archive.trackRange(row);
  if (b <= a) return { unknown: true };
  const target = genesisMs + elapsedH * 3600000;

  const lastT = P.time("t", b - 1);
  if (lastT === null || lastT < target) return { ended: true, endedAt: lastT };

  let best = null;
  for (let k = a; k < b; k++) {
    const t = P.time("t", k);
    if (t === null) continue;
    if (t <= target) best = k; else break;
  }
  if (best === null) return { unknown: true };
  const kt = P.num("vmax_kt", best);
  return kt === null ? { unknown: true } : { kt, at: P.time("t", best) };
}

/**
 * The cohort's intensity distribution at one elapsed time.
 *
 * @returns {{elapsed_h, n, ended, unknown, values, p25, median, p75, min, max, at_or_above_kt,
 *            n_at_or_above, sufficient}}
 *   `n` is the EVALUABLE denominator at this instant and is the only denominator a rate here may
 *   be taken over. `ended` is published beside it because the difference between the two is the
 *   finding, not a caveat.
 */
export function forwardDistribution(archive, cases, elapsedH, { atOrAboveKt = null } = {}) {
  const vals = [];
  let ended = 0;
  let unknown = 0;
  for (const c of cases) {
    const t0 = archive.storms.time("genesis_t", c.row);
    if (t0 === null) { unknown++; continue; }
    const w = windAtElapsed(archive, c.row, t0, elapsedH);
    if (w.ended) { ended++; continue; }
    if (w.kt === undefined) { unknown++; continue; }
    vals.push(w.kt);
  }
  const sorted = [...vals].sort((x, y) => x - y);
  return {
    elapsed_h: elapsedH,
    n: vals.length,
    ended,
    unknown,
    values: vals,
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    min: sorted.length ? sorted[0] : null,
    max: sorted.length ? sorted[sorted.length - 1] : null,
    /* A COUNT, NOT A RATE, AND DELIBERATELY NOT DIVIDED HERE. `n_at_or_above / n` is a share of
       a historical population; printed as a percentage beside a live storm's name it reads as
       that storm's chance of reaching the value, which is a forecast this archive has not
       earned. The numerator and the denominator are published; the division is not performed. */
    at_or_above_kt: atOrAboveKt,
    n_at_or_above: atOrAboveKt === null ? null : vals.filter((v) => v >= atOrAboveKt).length,
    sufficient: vals.length >= MIN_SAMPLE,
  };
}

/**
 * ALIGN A REFERENCE SERIES TO THIS ARCHIVE BY ABSOLUTE VALID TIME.
 *
 * @param {object} archive
 * @param {Array}  cases        the cohort's own case list, from `cohortResult`
 * @param {object} arg
 * @param {number} arg.genesisMs  the subject's derived genesis instant, in ms
 * @param {Array}  arg.points     `[{ validMs, kt, label_hr? }]` — ABSOLUTE instants. `label_hr`
 *                                is carried through for display and is NEVER read.
 * @returns {Array} one row per point, in input order
 *
 * There is deliberately no parameter through which a lead hour could arrive. `elapsed_h` is
 * derived, and a point whose `validMs` is not finite is refused rather than positioned.
 */
export function alignToGenesis(archive, cases, { genesisMs, points } = {}) {
  if (!archive || !Array.isArray(cases) || !Number.isFinite(genesisMs)) return [];
  return (points || []).map((p) => {
    const validMs = p && p.validMs;
    if (!Number.isFinite(validMs)) {
      return { valid_ms: null, elapsed_h: null, kt: p ? p.kt : null, refused: "no valid time" };
    }
    /* THE ONE LINE THE WHOLE CONTRACT RESTS ON. */
    const elapsedH = (validMs - genesisMs) / 3600000;
    const dist = forwardDistribution(archive, cases, elapsedH, { atOrAboveKt: p.kt });
    return {
      valid_ms: validMs,
      /* Carried for display so a surface can print BOTH clocks, which is what stops a reader
         taking one for the other. `label_hr` is whatever the source called this point; it took
         no part in the arithmetic above. */
      label_hr: p.label_hr === undefined ? null : p.label_hr,
      elapsed_h: elapsedH,
      kt: p.kt,
      klass: categoryFor(p.kt),
      ...dist,
    };
  });
}

/**
 * Time-to-threshold over the cohort, from the pack's own crossing columns.
 *
 * All six thresholds: the archive publishes hours_to_ts / cat1 / cat3 and the pack derives
 * cat2 / cat4 / cat5 at build time by replaying the same crossing rule, so the ladder is
 * complete and nothing here re-derives one.
 *
 * REFUSED BELOW MIN_SAMPLE, and the count is still published. Three storms reaching Category 5
 * is a real observation; the median of three is not a distribution. So `n` and `count` survive
 * and the quantiles are null with `refused` set — the same shape every other refusal on this
 * surface takes.
 */
export function thresholdTiming(archive, cases) {
  const out = {};
  for (const key of ["ts", "cat1", "cat2", "cat3", "cat4", "cat5"]) {
    const hs = [];
    for (const c of cases) {
      const v = archive.storm(c.row)[`hours_to_${key}`];
      if (Number.isFinite(v)) hs.push(v);
    }
    const sorted = hs.sort((a, b) => a - b);
    const enough = sorted.length >= MIN_SAMPLE;
    out[key] = {
      n: sorted.length,
      of: cases.length,
      refused: !enough,
      median: enough ? quantile(sorted, 0.5) : null,
      p25: enough ? quantile(sorted, 0.25) : null,
      p75: enough ? quantile(sorted, 0.75) : null,
    };
  }
  return out;
}

/* WHY THERE IS NO LANDFALL TIMING HERE, and the finding that decided it.
 *
 * This module carried a `landfallTiming` for a while: first landfall per STORM, hours from
 * genesis, refused under MIN_SAMPLE. It was removed unrendered, because the evidence deck one
 * screen below already publishes landfall timing for the same cohort out of
 * `analogs.js:timeToEvent` -- and it publishes a DIFFERENT number. That function appends one
 * value per LANDFALL, so a storm ashore twice contributes both transits, and it applies no sample
 * gate at all. On the cohort this shipped against, the deck's Hawaii row is n 5 with a median of
 * 300 h; the per-storm reading is n 2, which this archive's own gate refuses.
 *
 * Two medians for "how long to a Hawaii landfall" on one page is not extra evidence, it is a
 * reconciliation a reader cannot perform and should not be handed. So the surface publishes one,
 * the deck's, and the disagreement is reported rather than rendered: the deck answering a
 * five-transit question with an ungated median is a real gap, and it is the deck's to close.
 */
