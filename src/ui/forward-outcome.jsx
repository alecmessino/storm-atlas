/* THE FORWARD OUTCOME VIEW — an official forecast laid against what this cohort actually did.
 *
 * WHAT IT IS FOR. The archive answers questions about storms that have finished. A reader
 * looking at a live system wants one more thing, and only one: given that NHC says this storm
 * will be at some intensity at some instant, what did comparable storms turn out to be at that
 * same instant? That is a historical question with a historical answer, and this surface's whole
 * job is to publish it without letting it be read as a forecast.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * THE TWO LAYERS ARE NEVER ONE LAYER.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * NHC's forecast is CARRIED AND ATTRIBUTED — achromatic, one trajectory, open rings, drawn as a
 * line because it is one storm's single path. The archive's outcome is COMPUTED — one cool hue,
 * a p25–p75 body with a median rule, drawn as a distribution because it is 110 storms and has no
 * path. A reader who cannot tell in five seconds which marks are the forecast and which are the
 * history has been handed a forecast cone with extra steps, so the two forms differ in EVERY
 * channel available: hue, geometry, stroke and a direct label. Nothing here is identified by
 * colour alone.
 *
 * AND THE COUNT IS NEVER DIVIDED. The claim this surface makes is `6 of 94` — a numerator and a
 * denominator, side by side. `6.4%` printed beside a live storm's name is that storm's chance of
 * reaching the value, which is a forecast, and this archive has not earned one. The division is
 * not performed here and there is no field carrying it.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * THE AXIS IS TWO CLOCKS, AND THAT IS THE POINT.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * An advisory's forecast hours run from the ADVISORY. Every distribution the archive publishes
 * runs from GENESIS. The offset is the storm's age and it grows for the life of the system. On
 * the case this shipped against, NHC's `+69 h` point is genesis `+78 h`; on a five-day-old storm
 * the two are 120 h apart. So every tick carries BOTH figures, stacked, each labelled in the
 * gutter — because a reader who takes one for the other is off by the storm's whole life and the
 * mistake looks like an alignment.
 *
 * The arithmetic is not done here. `engine/forward.js` derives elapsed time from absolute
 * instants and has no parameter a lead label could arrive through; this file receives the rows
 * it produced and prints them.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * ATTRITION IS DRAWN AS DEPLETION, NOT AS A SHORT BAR.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The cohort falls from 110 to 74 across the horizon. A bar proportional to N reads as "a
 * slightly weaker outcome", and the storms that left are records that ENDED — they had ceased to
 * exist, which is not a missing measurement and not a low value. So each slot is the FULL cohort:
 * the storms still in the record fill from the bottom and the ones that are gone are an outlined
 * VOID above them, with the count of what left inside it. The void is the finding.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * TWO LAYOUTS, NEITHER ONE THE OTHER SCALED.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Below 860 px the plate is hidden outright and a row stack takes over. This is not
 * responsiveness applied to one drawing: at 600 px the plate's 1600-unit viewBox shrinks
 * uniformly and its 9 px labels render at about 3 px, which makes the chart decoration. A time
 * series read ACROSS is the wrong form at that width. The narrow layout is a row per instant read
 * DOWN with intensity read ACROSS, because the axis that has room is the horizontal one and
 * narrow screens have vertical room to spare. Five of the nine instants are shown, chosen where
 * the official class CHANGES plus the emphasised instant and the end of the horizon; the rest are
 * folded into the table below, never hidden.
 *
 * THIS COMPONENT IMPORTS NO ENGINE MODULE. The join between an operational forecast and a
 * historical population happens in the shell — the one place it is allowed (ATLAS-LIVE.md §5) —
 * and everything below is handed plain numbers.
 */

import React from "react";

import { Note, TextButton } from "./kit.jsx";

/* ── the plate's geometry, frozen ──────────────────────────────────────────────────────────
 *
 * PL is wide enough for the two right-set clock labels and PR for the threshold labels and the
 * two direct series labels. PT/PB are the minimum the marks need: an earlier draft reserved
 * 236/268 and rendered a quarter-page of empty plate above the chart. PL 190 because 132 ran
 * "VALID · UTC" straight into the first tick's "21/03Z", and PB 214 keeps the attrition heading
 * clear of the GENESIS +h tick row. */
const W = 1600, H = 660;
const PL = 190, PR = 208, PT = 34, PB = 214;
const PW = W - PL - PR, PH = H - PT - PB;
/* The attrition strip, below the axis' two label rows. */
const AY = PT + PH + 96, ABH = 62;
/* One slot width for both the distribution body and the attrition bar, so a reader reads down
   the same column. */
const SLOT = 15;

/* The ladder, with the labels this surface prints. `CAT 5 · 137` is listed even when it sits
   above the frame: a threshold a reader can name and cannot see is still the scale they are
   reading against. */
const THRESH = [["TS", 34], ["CAT 1", 64], ["CAT 2", 83], ["CAT 3", 96],
  ["CAT 4", 113], ["CAT 5", 137]];
const CLASS_LABEL = { td: "TD", ts: "TS", cat1: "CAT 1", cat2: "CAT 2", cat3: "CAT 3",
  cat4: "CAT 4", cat5: "CAT 5" };
const TIMING_LABEL = [["ts", "TROPICAL STORM"], ["cat1", "CATEGORY 1"], ["cat2", "CATEGORY 2"],
  ["cat3", "CATEGORY 3"], ["cat4", "CATEGORY 4"], ["cat5", "CATEGORY 5"]];

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* COMPACT AND HUMAN, WITH THE ISO STRING ONE HOVER AWAY.
 *
 * `2026-09-24T00:00:00.000Z` is 24 characters. In the narrow layout's 82 px lead column, and in
 * the aligned table at half-screen, it wrapped across three lines and turned a timestamp column
 * into a paragraph. `24 Sep 00Z` is nine and reads at a glance. The full instant is not lost: it
 * is the `title` on every cell that prints the short form, so the audit detail survives in the
 * accessible layer where a reader who wants it can get it and a reader who does not is not
 * paying a column for it. */
const zHuman = (ms) => {
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}Z`;
};
const zISO = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
/* DD/HH for the axis tick, where the month is already established by the label above it. */
const zTick = (ms) => {
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${
    String(d.getUTCHours()).padStart(2, "0")}Z`;
};
const zStamp = (iso) => (iso ? `${String(iso).slice(0, 10)} ${String(iso).slice(11, 16)}Z` : "—");
const deg1 = (v) => (Number.isFinite(v) ? Math.abs(v).toFixed(1) : "—");

/**
 * THE EMPHASISED INSTANT: the first instant the official forecast reaches its own peak.
 *
 * The prototype emphasised Polo's Category 4 instant. That was not a choice about that storm —
 * it is the instant the forecast commits to its highest intensity, which is the one a reader is
 * actually asking about and the one the historical placement is most worth publishing at. Taking
 * the FIRST such instant matters when a forecast holds its peak for three points, as this one
 * does: the earliest is when the forecast says it gets there.
 *
 * Derived rather than pinned, so a revised advisory moves the emphasis instead of stranding it.
 */
export function headRowOf(aligned) {
  const usable = (aligned || []).filter((r) => r && !r.refused && Number.isFinite(r.kt));
  if (!usable.length) return null;
  const peak = Math.max(...usable.map((r) => r.kt));
  return usable.find((r) => r.kt === peak) || null;
}

/**
 * WHICH FIVE INSTANTS THE NARROW LAYOUT SHOWS.
 *
 * Always the first, the emphasised one and the last — the start of the forecast, the claim, and
 * the end of the horizon. The remaining slots go to instants where the official CLASS changes,
 * because that is where the forecast is saying something new. When there are more class changes
 * than slots the most redundant is dropped first: the one whose neighbours are closest together,
 * earliest on a tie, so the survivors stay spread across the horizon rather than bunching.
 *
 * Nothing is hidden by this. Every instant is in the aligned table below, and the layout says so.
 */
export function narrowPicks(aligned, max = 5) {
  const rows = (aligned || []).filter((r) => r && !r.refused && Number.isFinite(r.elapsed_h));
  if (rows.length <= max) return rows;
  const head = headRowOf(rows);
  const fixed = new Set([rows[0], rows[rows.length - 1], head].filter(Boolean));
  const changes = rows.filter((r, i) => i > 0 && r.klass !== rows[i - 1].klass && !fixed.has(r));
  const keep = [...fixed, ...changes];
  while (keep.length > max) {
    let worst = null, worstSpan = Infinity;
    for (const r of keep) {
      if (fixed.has(r)) continue;
      const ordered = keep.slice().sort((a, b) => a.elapsed_h - b.elapsed_h);
      const i = ordered.indexOf(r);
      const prev = ordered[i - 1], next = ordered[i + 1];
      const span = (next ? next.elapsed_h : r.elapsed_h) - (prev ? prev.elapsed_h : r.elapsed_h);
      if (span < worstSpan) { worstSpan = span; worst = r; }
    }
    if (!worst) break;
    keep.splice(keep.indexOf(worst), 1);
  }
  return keep.sort((a, b) => a.elapsed_h - b.elapsed_h);
}

/**
 * THE INTENSITY CEILING THE PLATE IS DRAWN AGAINST.
 *
 * Not a constant. The prototype's 148 came from this cohort and this advisory — p25 bottoms near
 * 25 kt and the official peak is 115, so a 165 ceiling spent a fifth of the plot height on air.
 * The rule that produced it: take the first ladder threshold strictly above everything drawn, and
 * add a little headroom so the topmost mark is not welded to the frame. A forecast above Category
 * 5 has no threshold above it, so that case scales off the data instead.
 */
export function ceilingOf(aligned) {
  let top = 0;
  for (const r of aligned || []) {
    if (!r || r.refused) continue;
    if (Number.isFinite(r.kt)) top = Math.max(top, r.kt);
    if (Number.isFinite(r.p75)) top = Math.max(top, r.p75);
    if (Number.isFinite(r.median)) top = Math.max(top, r.median);
  }
  if (!(top > 0)) return 148;
  const above = THRESH.map(([, kt]) => kt).find((kt) => kt > top);
  return above ? above + 11 : Math.round(top * 1.08);
}

/* ── the desktop plate ─────────────────────────────────────────────────────────────────── */

function Plate({ aligned, head, cohortN, subjectName, genesisKt, genesisIsMedian }) {
  const ktMax = ceilingOf(aligned);
  const n = aligned.length;
  const x = (i) => (n > 1 ? PL + (PW / (n - 1)) * i : PL + PW / 2);
  const y = (kt) => PT + PH - (kt / ktMax) * PH;
  const headIndex = aligned.indexOf(head);
  const line = aligned.map((r, i) => `${x(i)},${y(r.kt)}`).join(" ");

  return (
    <svg className="at-fo-plate" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`NHC official forecast intensity against the historical intensity distribution of ${
        cohortN} comparable storms, aligned by absolute valid time`}>

      {/* the ladder, recessive — a scale, not a series */}
      {THRESH.map(([label, kt]) => (
        <g key={label}>
          <line className="at-fo-grid" x1={PL} y1={y(kt)} x2={PL + PW} y2={y(kt)} />
          <text className="at-fo-gridlab" x={PL + PW + 12} y={y(kt) + 3.5}>{label} · {kt}</text>
        </g>
      ))}
      <text className="at-fo-axlab" x={PL - 20} y={PT + 4} textAnchor="start">KNOTS · ONE AXIS</text>

      {/* the emphasised instant, run the full height of both strips so the two read as one column */}
      {headIndex >= 0 ? (
        <line className="at-fo-headrule" x1={x(headIndex)} y1={PT - 4}
          x2={x(headIndex)} y2={AY + ABH} />
      ) : null}

      {/* HISTORY: one cool hue, p25–p75 body, median rule. A distribution, so no path. */}
      {aligned.map((r, i) => {
        const top = y(r.p75), bot = y(r.p25), med = y(r.median);
        return (
          <g className={r === head ? "at-fo-hist at-fo-head" : "at-fo-hist"} key={`h${i}`}>
            <title>{`archive · genesis +${r.elapsed_h} h · N ${r.n} · p25 ${r.p25} · median ${
              r.median} · p75 ${r.p75} kt`}</title>
            <rect className="at-fo-hbody" x={x(i) - SLOT / 2} y={top} width={SLOT}
              height={Math.max(bot - top, 2)} rx={3} />
            <rect className="at-fo-hmed" x={x(i) - SLOT / 2 - 3} y={med - 1}
              width={SLOT + 6} height={2} />
          </g>
        );
      })}

      {/* OFFICIAL: achromatic, one trajectory, thin line and open rings. One storm, so a path. */}
      <polyline className="at-fo-oline" points={line} />
      {aligned.map((r, i) => (
        <g className={r === head ? "at-fo-off at-fo-head" : "at-fo-off"} key={`o${i}`}>
          <title>{`NHC official · valid ${zISO(r.valid_ms)} · ${r.kt} kt ${
            CLASS_LABEL[r.klass] || ""}`}</title>
          <circle className="at-fo-oring" cx={x(i)} cy={y(r.kt)} r={r === head ? 8 : 5.5} />
        </g>
      ))}

      {/* DIRECT LABELS AT FIXED y, NOT AT THE DATA'S y. Deriving them from the last point put
          "ARCHIVE p25–p75" on top of the TS · 34 gridline label, and a legend that collides with
          an axis label is worse than no direct label at all. These sit in the gutters between
          gridlines, chosen once, so identity is never colour-alone.

          AND `NHC OFFICIAL` SITS AT THE TOP OF THE GUTTER RATHER THAN BESIDE THE LINE IT NAMES.
          It was level with the trace, which is where a direct label belongs -- and which put it on
          the same baseline as the callout carrying the finding. Measured: at 960 px the callout's
          right edge reaches 1406 and this label starts at 1406, so `... at or above 115 kt` ran
          straight into `NHC OFFICIAL`. The two are above the official trace by construction, so
          they will always compete for that band; the collision was invisible at 1600 only because
          the callout was shorter there. Lifting this one to the frame's top edge is a slot nothing
          else can reach: the only other text up here is KNOTS · ONE AXIS, at the far left. */}
      <text className="at-fo-serieslab at-fo-series-off" x={PL + PW + 14} y={PT - 6}>
        NHC OFFICIAL</text>
      <text className="at-fo-serieslab at-fo-series-pop" x={PL + PW + 14} y={y(ktMax * 0.331)}>
        ARCHIVE p25–p75</text>

      {/* the claim, at the instant it is about */}
      {head ? (
        <text className="at-fo-callout" x={x(headIndex) + 20} y={y(head.kt) - 26}>
          <tspan className="at-fo-cf">{head.n_at_or_above} of {head.n}</tspan>
          <tspan> at or above </tspan>
          <tspan className="at-fo-cb">{head.kt} kt</tspan>
        </text>
      ) : null}

      {/* the subject's own genesis wind, as context for where in this population it started */}
      {Number.isFinite(genesisKt) ? (
        <text className="at-fo-callout" x={PL + 14} y={y(genesisKt) + 34}>
          <tspan>{subjectName} at genesis </tspan>
          <tspan className="at-fo-cb">{genesisKt} kt</tspan>
          {genesisIsMedian ? <tspan> — the cohort&rsquo;s median</tspan> : null}
        </text>
      ) : null}

      {/* THE AXIS IS TWO CLOCKS ON ONE TICK. */}
      <line className="at-fo-axis" x1={PL} y1={PT + PH} x2={PL + PW} y2={PT + PH} />
      {aligned.map((r, i) => (
        <g className={r === head ? "at-fo-tick at-fo-head" : "at-fo-tick"} key={`t${i}`}>
          <line x1={x(i)} y1={PT + PH} x2={x(i)} y2={PT + PH + 7} />
          <text className="at-fo-tz" x={x(i)} y={PT + PH + 26}>{zTick(r.valid_ms)}</text>
          <text className="at-fo-tg" x={x(i)} y={PT + PH + 48}>+{r.elapsed_h}</text>
        </g>
      ))}
      {/* CLEAR OF THE FIRST TICK. The tick strings are CENTRED on their x, so the first spans
          PL−22..PL+22; a right-set label ending at PL−20 still collided with it and read
          "VALID · UTC21/03Z". Anchored to clear the half-width plus a gap. */}
      <text className="at-fo-clocklab" x={PL - 52} y={PT + PH + 26}>VALID · UTC</text>
      <text className="at-fo-clocklab" x={PL - 52} y={PT + PH + 48}>GENESIS +h</text>

      {/* ATTRITION AS DEPLETION. Each slot is all of the cohort; the void is what left. */}
      <text className="at-fo-axlab" x={PL - 20} y={AY - 20} textAnchor="start">
        STORMS STILL IN THE RECORD — each slot is all {cohortN}; the void is records that ENDED,
        not weak outcomes</text>
      {aligned.map((r, i) => {
        const h = (r.n / cohortN) * ABH;
        return (
          <g className={r === head ? "at-fo-att at-fo-head" : "at-fo-att"} key={`a${i}`}>
            <title>{`${r.n} of ${cohortN} still in the record at genesis +${r.elapsed_h} h — ${
              r.ended} record(s) had ended`}</title>
            <rect className="at-fo-avoid" x={x(i) - SLOT / 2} y={AY} width={SLOT}
              height={ABH} rx={3} />
            <rect className="at-fo-abar" x={x(i) - SLOT / 2} y={AY + ABH - h} width={SLOT}
              height={Math.max(h, 1)} rx={3} />
            {r.ended ? (
              <text className="at-fo-aend" x={x(i)} y={AY + 12}>&minus;{r.ended}</text>
            ) : null}
            <text className="at-fo-an" x={x(i)} y={AY + ABH + 20}>{r.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── the narrow layout ─────────────────────────────────────────────────────────────────── */

/* Four rungs, not six: at this width six labels collide, and TS / C1 / C3 / C4 are the ones the
   forecast and the distribution actually cross. */
const NTHRESH = [["TS", 34], ["C1", 64], ["C3", 96], ["C4", 113]];
const NKT = 130;

function NarrowStack({ aligned, head, cohortN }) {
  const picks = narrowPicks(aligned);
  const pct = (kt) => Math.max(0, Math.min(100, (kt / NKT) * 100));
  return (
    <section className="at-fo-narrow" aria-label="forward outcome, narrow layout">
      <div className="at-fo-nkey">
        <span><i className="at-fo-kn" />NHC</span>
        <span><i className="at-fo-kb" />ARCHIVE p25–p75</span>
        <span><i className="at-fo-km" />MEDIAN</span>
        <span className="at-fo-kr">N · STORMS LEFT</span>
      </div>
      <div className="at-fo-nscale">
        {NTHRESH.map(([label, kt]) => (
          <b key={label} style={{ left: `${pct(kt)}%` }}>{label}</b>
        ))}
      </div>
      {picks.map((r) => {
        const isHead = r === head;
        const L = pct(r.p25), R = pct(r.p75);
        return (
          <React.Fragment key={r.elapsed_h}>
            <div className={isHead ? "at-fo-nrow at-fo-nhead" : "at-fo-nrow"}>
              <div className="at-fo-nlead">
                <b>+{r.elapsed_h} h</b>
                <span title={zISO(r.valid_ms) || undefined}>{zHuman(r.valid_ms)}</span>
              </div>
              <div className="at-fo-ntrack">
                {NTHRESH.map(([label, kt]) => (
                  <i className="at-fo-ntick" key={label} style={{ left: `${pct(kt)}%` }} />
                ))}
                <i className="at-fo-nbox"
                  style={{ left: `${L}%`, width: `${Math.max(R - L, 1.2)}%` }} />
                <i className="at-fo-nmed" style={{ left: `${pct(r.median)}%` }} />
                <i className="at-fo-nnhc" style={{ left: `${pct(r.kt)}%` }} />
                <b className="at-fo-nnhclab" style={{ left: `${pct(r.kt)}%` }}>{r.kt}</b>
              </div>
              <div className="at-fo-nden">
                <b>{r.n}</b>
                {r.ended ? <em>&minus;{r.ended}</em> : <em className="at-fo-nz">&mdash;</em>}
              </div>
            </div>
            {isHead ? (
              <div className="at-fo-nsay">
                <b>{r.n_at_or_above} of {r.n}</b> at or above <b>{r.kt} kt</b>
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
      <div className="at-fo-nfoot">
        Each row is one instant, aligned by absolute valid time. <b>N</b> is the storms still in
        the record there; the second figure is how many records had ended.{" "}
        {picks.length} of {aligned.length} instants shown — all {aligned.length} are in the table
        below.
      </div>
    </section>
  );
}

/* ── the surface ───────────────────────────────────────────────────────────────────────── */

/**
 * @param {object}  props
 * @param {object}  props.system    { name, atcf_id, stage_label, latestKt }
 * @param {object}  props.cohort    { N, lat, lon, radiusKm, url, minSample, methodology, pack }
 * @param {object}  props.clocks    { genesisMs, advisoryMs, ageAtAdvisoryH }
 * @param {Array}   props.aligned   rows from `alignToGenesis`, in advisory order
 * @param {object}  props.vintage   from `officialPoints` — the advisory this placement is under
 * @param {object}  props.timing    from `thresholdTiming`
 * @param {object}  props.env       { shearKt, sstC, mpiKt, validTime, product } or null
 * @param {number}  props.genesisKt the subject's own wind at its derived genesis
 * @param {number}  props.cohortGenesisMedianKt  the cohort's median wind at genesis
 * @param {number}  props.dropped   forecast points with no parseable valid time
 * @param {Function} props.onRefresh  re-read the payload and supersede on a newer advisory
 */
export function ForwardOutcome({ system, cohort, clocks, aligned, vintage, timing, env,
  genesisKt, cohortGenesisMedianKt, dropped = 0, onRefresh, refreshing = false,
  supersededAt = null }) {
  const usable = (aligned || []).filter((r) => r && !r.refused);
  const head = headRowOf(usable);
  if (!usable.length || !head) {
    return (
      <div data-forward-outcome data-forward-refused="no placeable forecast point">
        <Note hook="data-forward-refused-why">
          <b>NO PLACEMENT.</b> The official forecast carried no point with a parseable absolute
          valid time, and this surface aligns on the instant and nothing else. A point whose
          instant cannot be read cannot be placed against the archive at all, so none of them
          were.
        </Note>
      </div>
    );
  }

  /* THE HEADLINE IS A COUNT OVER A POPULATION, AND IT REFUSES LIKE EVERY OTHER ONE HERE. Under
     the archive's own sample gate there is no distribution to place anything in, and the count
     survives while the placement does not. */
  const enough = head.sufficient;
  const genesisIsMedian = Number.isFinite(genesisKt)
    && Number.isFinite(cohortGenesisMedianKt) && genesisKt === cohortGenesisMedianKt;

  return (
    <div data-forward-outcome data-forward-vintage={vintage && vintage.advisory_valid_at
      ? vintage.advisory_valid_at : undefined}>

      <div className="at-fo-kick">
        <span>FORWARD OUTCOME · OFFICIAL FORECAST AGAINST THE ARCHIVE</span>
        <span>{system.name} · {system.atcf_id} · {system.stage_label}
          {Number.isFinite(system.latestKt) ? ` ${system.latestKt} KT` : ""}</span>
      </div>

      {/* THE HERO IS THE CLAIM AND NOTHING ELSE — an intensity, an instant, and where that
          lands in the record. Everything qualifying it is beneath it, in rank order. */}
      <h2 className="at-fo-hero">
        NHC: <b>{head.kt} kt</b> at <b title={zISO(head.valid_ms) || undefined}>
          {zHuman(head.valid_ms)}</b>.{" "}
        {enough ? <>Historical placement: <b>{head.n_at_or_above} of {head.n}</b>.</>
          : <>Historical placement <b>REFUSED</b>.</>}
      </h2>

      <div className="at-fo-stand">
        {head.elapsed_h} h after genesis · {head.n} of {cohort.N} comparable storms still in the
        record
        {enough ? null : ` · under the archive's gate of ${cohort.minSample}`}
      </div>

      {/* SUBORDINATE, NOT ABSENT. It has to survive a skim without competing with the hero. */}
      <div className="at-fo-qual">
        A count over a historical population — <b>not a probability for {system.name}</b>.
        <code>{cohort.url}</code>
      </div>

      {/* ONE STATEMENT, NOT A COMPETING PROSE BLOCK. What the plate owes the reader is what the
          COHORT does and does not condition on. The measured values stay as secondary detail:
          they are the reader's to weigh, and this surface does not weigh them. */}
      <div className="at-fo-cond">
        <span className="at-fo-ck">CONDITIONING</span>
        <span className="at-fo-cv">The historical cohort conditions on <b>genesis location
          only</b>; it does not condition on {system.name}&rsquo;s current shear, SST or potential
          intensity.</span>
        {env ? (
          <span className="at-fo-cd"
            title={`${env.product || "operational SHIPS"}, tau 0, valid ${env.validTime || "unknown"}`}>
            shear <b>{env.shearKt} kt</b> · SST <b>{env.sstC} °C</b> · MPI <b>{env.mpiKt} kt</b>
            <span className="at-fo-cdim">ships_rt τ0</span>
          </span>
        ) : null}
      </div>

      {/* THE TWO-LAYER LEGEND — the five-second read, and the only place the two series are
          declared as different KINDS of thing rather than different marks. */}
      <div className="at-fo-layers">
        <div className="at-fo-layer">
          <svg className="at-fo-sw" viewBox="0 0 44 16" aria-hidden="true">
            <line x1="2" y1="8" x2="42" y2="8" className="at-fo-swline" />
            <circle cx="14" cy="8" r="4.5" className="at-fo-swring" />
            <circle cx="30" cy="8" r="4.5" className="at-fo-swring" />
          </svg>
          <span>
            <span className="at-fo-nm">NHC OFFICIAL FORECAST</span>
            <span className="at-fo-ds">Carried and attributed. <em>Not produced by Storm
              Atlas.</em> One trajectory, {aligned.length} point{aligned.length === 1 ? "" : "s"},
              read from the advisory of {zStamp(vintage && vintage.advisory_valid_at)}.
              {dropped ? ` ${dropped} point(s) had no readable valid time and were dropped.` : ""}
            </span>
          </span>
        </div>
        <div className="at-fo-layer">
          <svg className="at-fo-sw" viewBox="0 0 44 16" aria-hidden="true">
            <rect x="4" y="3" width="9" height="11" rx="2" className="at-fo-swbox" />
            <rect x="1" y="8" width="15" height="2" className="at-fo-swmed" />
            <rect x="19" y="1" width="9" height="14" rx="2" className="at-fo-swbox" />
            <rect x="16" y="7" width="15" height="2" className="at-fo-swmed" />
            <rect x="34" y="5" width="9" height="10" rx="2" className="at-fo-swbox" />
            <rect x="31" y="10" width="15" height="2" className="at-fo-swmed" />
          </svg>
          <span>
            <span className="at-fo-nm">HISTORICAL OUTCOME · {cohort.N} STORMS</span>
            <span className="at-fo-ds">Computed from the archive. <em>Storms that formed within{" "}
              {cohort.radiusKm} km of {deg1(cohort.lat)}°N {deg1(cohort.lon)}°W.</em> Box is
              p25–p75, rule is the median.</span>
          </span>
        </div>
      </div>

      <Plate aligned={usable} head={head} cohortN={cohort.N} subjectName={system.name}
        genesisKt={genesisKt} genesisIsMedian={genesisIsMedian} />

      <NarrowStack aligned={usable} head={head} cohortN={cohort.N} />

      <div className="at-fo-grouprule" />
      <h3 className="at-fo-h">ALIGNED BY ABSOLUTE VALID TIME
        <span>the official forecast&rsquo;s clock and the archive&rsquo;s are offset by{" "}
          {Math.round(clocks.ageAtAdvisoryH)} h — {system.name}&rsquo;s age at the advisory</span>
      </h3>
      {/* THE AUDIT TABLE SCROLLS ITSELF, AND NOTHING ABOVE IT DOES.
          Ten columns do not fit 390 px, and the two ways out are both worse than this one:
          dropping columns hides rows of the audit a reader came here for, and letting the table
          push the PAGE sideways breaks the chart above it -- which is the one thing the narrow
          layout exists to keep readable. So the table gets its own horizontal scroll, keyboard
          focusable because a scroll region a keyboard cannot reach is a region a keyboard reader
          cannot read. At any width where the columns fit, this box does nothing. */}
      <div className="at-fo-scroll" tabIndex={0} role="region"
        aria-label="aligned forecast and archive detail, scrolls horizontally">
      <table className="at-fo-tbl">
        <thead><tr>
          <th>NHC hr</th><th>VALID</th><th className="at-fo-r">kt</th><th>CLASS</th>
          <th className="at-fo-r">GENESIS +h</th><th className="at-fo-r">N</th>
          <th className="at-fo-r">ENDED</th><th className="at-fo-r">n ≥ kt</th>
          <th className="at-fo-r">p25–p75</th><th className="at-fo-r">MEDIAN</th>
        </tr></thead>
        <tbody>
          {usable.map((r) => (
            <tr key={r.valid_ms} className={r === head ? "at-fo-hl" : undefined}>
              <td className="at-fo-m">{r.label_hr === null ? "—" : r.label_hr}</td>
              {/* COMPACT IN THE COLUMN, COMPLETE IN THE TITLE. */}
              <td className="at-fo-m" title={zISO(r.valid_ms) || undefined}>
                {zHuman(r.valid_ms)}</td>
              <td className="at-fo-m at-fo-r">{r.kt}</td>
              <td>{CLASS_LABEL[r.klass] || "—"}</td>
              <td className="at-fo-m at-fo-r">+{r.elapsed_h}</td>
              <td className="at-fo-m at-fo-r">{r.n}</td>
              <td className="at-fo-m at-fo-r at-fo-dim">{r.ended}</td>
              <td className="at-fo-m at-fo-r at-fo-b">
                {r.sufficient ? r.n_at_or_above : `${r.n_at_or_above} †`}</td>
              <td className="at-fo-m at-fo-r at-fo-dim">{r.p25}–{r.p75}</td>
              <td className="at-fo-m at-fo-r at-fo-dim">{r.median}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <Note hook="data-forward-clocks">
        <b>NHC hr {head.label_hr === null ? "—" : head.label_hr} is genesis +{head.elapsed_h} h,
        not genesis +{head.label_hr === null ? "—" : head.label_hr} h.</b> The forecast is
        indexed from the advisory instant ({zStamp(vintage && vintage.advisory_valid_at)}); the
        archive is indexed from genesis ({zStamp(zISO(clocks.genesisMs))}). Every row above was
        aligned by matching absolute valid time and then converting that instant to elapsed hours
        since genesis — never by matching the two clocks&rsquo; hour labels. The offset is the
        storm&rsquo;s age and it grows for the life of the system.
        {usable.some((r) => !r.sufficient)
          ? ` † the count is published and the distribution is refused: fewer than ${
            cohort.minSample} of the cohort are still in the record there.` : ""}
      </Note>

      <div className="at-fo-grouprule" />
      <h3 className="at-fo-h">TIME TO THRESHOLD
        <span>same cohort · N {cohort.N} · hours from genesis · MIN_SAMPLE {cohort.minSample}</span>
      </h3>
      <div className="at-fo-scroll" tabIndex={0} role="region"
        aria-label="time to threshold, scrolls horizontally">
      <table className="at-fo-tbl">
        <thead><tr>
          <th>OUTCOME</th><th className="at-fo-r">n / N</th><th className="at-fo-r">MEDIAN</th>
          <th className="at-fo-r">p25–p75</th>
        </tr></thead>
        <tbody>
          {TIMING_LABEL.map(([key, label]) => {
            const t = (timing || {})[key];
            if (!t) return null;
            return (
              <tr key={key} className={t.refused ? "at-fo-ref" : undefined}
                data-timing-refused={t.refused ? "under MIN_SAMPLE" : undefined}>
                <td>{label}</td>
                <td className="at-fo-m at-fo-r">{t.n}/{cohort.N}</td>
                <td className="at-fo-m at-fo-r">
                  {t.refused ? "—" : `${Math.round(t.median)} h`}</td>
                <td className="at-fo-m at-fo-r at-fo-dim">
                  {t.refused ? `REFUSED · n ${t.n} < ${cohort.minSample}`
                    : `${Math.round(t.p25)}–${Math.round(t.p75)} h`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {timing && timing.cat5 && timing.cat5.refused ? (
        <Note hook="data-forward-timing-refusal">
          <b>Category 5 timing publishes no quantiles.</b> {timing.cat5.n} of {cohort.N} storms
          reached it — below the archive&rsquo;s own gate of {cohort.minSample}. The count is
          real; the distribution does not exist, and a median of {timing.cat5.n} would be a number
          with nothing behind it.
        </Note>
      ) : null}

      {/* THE VINTAGE, AND THE ONE CONTROL THAT CAN CHANGE IT.
          A forecast is superseded every few hours, so a placement is a statement about ONE
          advisory and has to name it. The control re-reads the payload; a newer advisory replaces
          the placement and an equal-or-older one is refused rather than accepted, so a payload
          rebuilt from a stale advisory cannot walk this surface backwards. */}
      <div className="at-fo-vintage" data-forward-vintage-row>
        <span><b>NHC ADVISORY</b> {zStamp(vintage && vintage.advisory_valid_at)}</span>
        <span><b>PAYLOAD</b> {zStamp(vintage && vintage.payload_generated_at)}</span>
        <span><b>COHORT</b> N {cohort.N} · {deg1(cohort.lat)}°N {deg1(cohort.lon)}°W ·{" "}
          {cohort.radiusKm} km · genesis-conditioned</span>
        {cohort.pack ? <span><b>PACK</b> {cohort.pack}</span> : null}
        {cohort.methodology ? <span><b>METHODOLOGY</b> {cohort.methodology}</span> : null}
        {onRefresh ? (
          <span className="at-fo-vgo">
            <TextButton onClick={onRefresh} hook="data-forward-refresh"
              title="re-read the official forecast; a newer advisory recomputes the placement">
              {refreshing ? "CHECKING…" : "CHECK FOR A NEWER ADVISORY"}
            </TextButton>
          </span>
        ) : null}
      </div>
      {supersededAt ? (
        <Note hook="data-forward-superseded">
          <b>SUPERSEDED AND RECOMPUTED.</b> A newer advisory was read at{" "}
          {zStamp(supersededAt)} and every placement above was recomputed against it. The cohort
          did not change — the forecast did.
        </Note>
      ) : null}
    </div>
  );
}
