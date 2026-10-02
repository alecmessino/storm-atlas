/* THE LEDGER — the one table of the answer, beside the plate.
 *
 * WHAT THIS REPLACES. Two tables said the same thing: an eight-row "answer ladder" beside the
 * plate, and the complete matrix one screen below it, with the eight underscored so a reader
 * could find them again. Every rate on the ladder was printed twice, in two typesettings, and the
 * ten contracts the ladder left out were only reachable by scrolling past the map. This is the
 * matrix, set at the ladder's measure: every contract the cohort can be asked, in the archive's
 * order, in one column that scrolls inside the inspector while the plate stays put.
 *
 * THE FOUR PANEL RULES HOLD HERE UNCHANGED, AND THE HOOKS ARE THE MATRIX'S. `[data-outcome]`
 * names a row and `.at-dc-count` / `.at-dc-rate` / `.at-dc-int` / `.at-dc-status` carry its four
 * values, each with its figure in `.at-val` -- so check-atlas-published-values reads the same
 * digits off the same selectors it always did, and check-evidence-deck audits this component's
 * rows against the same four rules:
 *
 *   1. NO BARE PERCENTAGE -- the rate never renders without its count and its interval.
 *   2. A REFUSED ROW RENDERS NO RATE ANYWHERE INSIDE IT. The count stands in the rate's place,
 *      at the rate's size, because the count is the finding; `.at-dc-rate` holds the dash.
 *   3. AN UNSCOREABLE CONTRACT STATES WHAT IT HAS AGAINST WHAT IT NEEDS (in the limits below).
 *   4. EVERY STATUS SITS INSIDE THE ROW IT GOVERNS -- one `.at-dc-status` per row.
 *
 * EVERY NUMBER IS ONE PRESS FROM ITS STORMS. Holding a row draws the storms it counted on the
 * plate (the lens -- view state, never a rate or a URL), and the held row opens a line directly
 * beneath it that lists them in the roster. The count a reader is looking at is the list they
 * get.
 */
import React from "react";
import { buildGroups, statusWordOf, refusalKindOfRow, isRefusedRow, pct1, subjectReached,
  markGroupOf, MARKS } from "./evidence-deck.jsx";

/* ── the synthesis ──────────────────────────────────────────────────────────────────────────
 *
 * TWO LINES AT MOST, AND EVERY CLAUSE IS COUNTED. This is the one place that says something
 * ABOUT the rows rather than printing them, so it counts by the ENGINE'S VERDICT -- compare.js
 * permits exactly two statements, the samples separate the two rates or they do not -- and never
 * by the sign of a point estimate. A row whose intervals overlap is not "higher" because its point
 * estimate is.
 */
export function primaryLandfall(groups) {
  const landfall = (groups.find((g) => g.key === "landfall") || { rows: [] }).rows;
  const scoreable = landfall.filter((row) => row.cell && row.cell.rate !== null && !row.unscoreable);
  return (scoreable.length >= 2 ? scoreable : landfall).slice(0, 2);
}

export function synthesise({ result, comparison, groups }) {
  const intensity = (groups.find((g) => g.key === "intensity") || { rows: [] }).rows;
  const landfall = primaryLandfall(groups);
  const min = result.min_sample;

  if (!result.sufficient) {
    return `No rate is published: ${result.kept.toLocaleString()} storms is below the archive's `
      + `gate of ${min}, so every contract refuses. The counts are real; the rates do not exist.`;
  }

  if (comparison) {
    if (comparison.relation && comparison.relation.kind === "the two populations are the same storms") {
      return `No comparison: removing ${comparison.changed ? comparison.changed.noun : "that condition"} `
        + `changes no storm, so the baseline is this cohort.${landfallClause(landfall)}`;
    }
    const scored = intensity.filter((r) => r.delta && r.delta.deltaPp !== null && r.delta.verdict);
    if (!scored.length) {
      return "No intensity threshold in this cohort carries a rate the baseline can be "
        + "compared against.";
    }
    const sep = scored.filter((r) => r.delta.verdict === "SAMPLES SEPARATE" && r.delta.deltaPp !== 0);
    const up = sep.filter((r) => r.delta.deltaPp > 0);
    const down = sep.filter((r) => r.delta.deltaPp < 0);
    const n = scored.length;
    const of = n === 1 ? "the one intensity threshold" : n === 2 ? "both intensity thresholds"
      : `the ${n} intensity thresholds`;
    let first;
    if (!sep.length) {
      first = `The samples do not separate this cohort from the baseline on ${of}.`;
    } else {
      const dir = !down.length ? "all higher" : !up.length ? "all lower"
        : `${up.length} higher, ${down.length} lower`;
      const rest = n - sep.length;
      const lead = sep.length === n ? (n === 2 ? "Both" : n === 1 ? "The one" : `All ${n}`)
        : `${sep.length} of ${n}`;
      first = `${lead} intensity threshold${sep.length === 1 && n === 1 ? "" : "s"} `
        + `separate from the baseline (${dir})`
        + (rest ? `; the samples do not separate the other ${rest}.` : ".");
    }
    return `${first}${landfallClause(landfall)}`;
  }

  const cat1 = intensity.find((r) => r.key === "int:cat1");
  const hurricane = cat1 && cat1.cell && cat1.cell.rate !== null
    ? ` ${pct1(cat1.cell.rate)} of them reach hurricane strength.` : "";
  return `The archive's own base rates — what every conditioned cohort here is measured `
    + `against.${hurricane}`;
}

/** Named only when the two leading contracts agree on a region. Never a possessive, and never
    the unattributed bucket. */
function landfallClause(rows) {
  const scoreable = rows.filter((r) => r.cell && r.cell.rate !== null && !r.unscoreable
    && !/^unattributed/i.test(r.label));
  if (!scoreable.length) return "";
  const region = (r) => r.label.split(" · ")[0];
  if (scoreable.length === 2 && region(scoreable[0]) === region(scoreable[1])) {
    return ` Both leading landfall rows are ${region(scoreable[0])}.`;
  }
  return ` The leading landfall row is ${scoreable[0].label}, at ${pct1(scoreable[0].cell.rate)}.`;
}

const signed = (pp) => {
  const mag = Math.abs(pp);
  if (mag < 0.05) return "<0.1";
  return `${pp > 0 ? "+" : "−"}${mag.toFixed(1)}`;
};

/* ── the ledger ─────────────────────────────────────────────────────────────────────────── */

/**
 * @param {object}   props.result        the cohort result (with members)
 * @param {object}   [props.comparison]  compareResults output, or null
 * @param {object}   [props.subject]     the selected storm's membership and verdicts
 * @param {number}   props.archiveTotal  the archive's own storm count
 * @param {string}   [props.lensKey]     the held row, if any
 * @param {function} [props.onLens]      hold / hover a row's storms on the plate
 * @param {function} [props.onShowMembers] list a row's storms in the roster
 * @param {string}   props.column        "delta" or "timing": what the right-hand column carries
 * @param {function} props.onColumn
 */
export function Ledger({ result, comparison, subject, archiveTotal, lensKey = null,
  onLens = null, onShowMembers = null, column = "delta", onColumn = null,
  conditions = [], onBaseline = null, onLimits = null }) {
  if (!result) return null;

  /* AN EMPTY COHORT IS AN ANSWER, NOT A BLANK COLUMN. */
  if (!result.n_cases) {
    return (
      <section className="lg" data-answer data-empty-cohort>
        <div className="lg-top">
          <div className="lg-head">
            <span className="lg-n" data-ledger-n>0</span>
            <span className="lg-l">STORMS IN THE COHORT<br />OF {archiveTotal.toLocaleString()} ARCHIVE STORMS</span>
            <span className="lg-state" data-sample-state>NO MEMBERS</span>
          </div>
          <p className="lg-syn" data-synthesis>
            No storm in the archive meets these conditions — 0 of {archiveTotal.toLocaleString()}.
            There is no rate and nothing to count. Widen a condition, or remove one with its ✕.
          </p>
        </div>
      </section>
    );
  }

  const groups = buildGroups(result, comparison, subject);
  const all = groups.flatMap((g) => g.rows);
  const refused = all.filter(isRefusedRow).length;
  const timing = column === "timing";
  const intensityDenom = groups[0] && groups[0].denom;
  const landfallGroup = groups.find((g) => g.key === "landfall");

  return (
    <section className="lg" data-answer data-ledger data-ledger-column={column}>
      <div className="lg-top">
        <div className="lg-head">
          <span className="lg-n" data-ledger-n>{result.kept.toLocaleString()}</span>
          <span className="lg-l">STORMS IN THE COHORT<br />
            OF {archiveTotal.toLocaleString()} ARCHIVE STORMS
            {intensityDenom !== null && intensityDenom !== undefined ? (
              <span className="lg-denoms" data-outcome-denominators
                title="the rates below are taken over two populations: the storms whose peak the archive recorded, and every storm in the cohort">
                {" · "}{intensityDenom.toLocaleString()} INTENSITY
                {landfallGroup && landfallGroup.denom !== null
                  ? <> · {landfallGroup.denom.toLocaleString()} LANDFALL</> : null}
              </span>
            ) : null}
          </span>
          <span className={"lg-state" + (result.sufficient ? "" : " lg-state-no")} data-sample-state>
            {result.sufficient ? "SUFFICIENT" : "BELOW SAMPLE"}
          </span>
        </div>
        <p className="lg-syn" data-synthesis>{synthesise({ result, comparison, groups })}</p>
        {/* THE QUALIFICATION IS ON THE FIRST SCREEN, WITH THE ANSWER IT QUALIFIES. At the foot of
            a column that scrolls it was below every rate it governs and, for a reader who does
            not scroll, absent. */}
        <button type="button" className="lg-pointer" data-limits-pointer onClick={onLimits}
          disabled={!onLimits}>
          {refused ? `${refused} OF ${all.length} CONTRACTS REFUSED — WHY, BELOW ↓`
            : `ALL ${all.length} CONTRACTS PUBLISH A RATE — WHAT THEY ASSUME, BELOW ↓`}
        </button>
      </div>

      <div className="lg-key" role="row">
        <span className="lg-key-l">OUTCOME</span>
        <span className="lg-key-r">
          {result.sufficient ? "RATE · n / N · 95% WILSON" : "COUNT · n / N"}
        </span>
        {onColumn ? (
          <span className="lg-colswitch" role="group" aria-label="what the right-hand column shows">
            <button type="button" aria-pressed={!timing ? "true" : "false"} data-ledger-col="delta"
              onClick={() => onColumn("delta")}
              title={comparison ? "the signed difference from the baseline, in percentage points"
                : "no condition is set, so this cohort is the baseline"}>
              Δ BASELINE
            </button>
            <button type="button" aria-pressed={timing ? "true" : "false"} data-ledger-col="timing"
              data-timing-fold onClick={() => onColumn("timing")}
              title="the median and interquartile hours from genesis to each outcome">
              HOURS
            </button>
          </span>
        ) : null}
      </div>

      <div className="lg-rows" data-evidence-deck
        data-deck-mode={comparison || subject ? "cohort" : "archive"}>
        {groups.map((g) => (
          <React.Fragment key={g.key}>
            <div className="lg-group" data-deck-group={g.label} role="row">
              <span className="lg-group-l">{g.label}</span>
              <span className="lg-group-r" title={g.note || undefined}>
                {g.denom !== null ? <>of {g.denom.toLocaleString()}</> : null}
                {g.note && g.key !== "intensity"
                  ? <span className="lg-group-note" data-group-note={g.key}> · {g.note}</span> : null}
              </span>
            </div>
            {g.rows.map((row) => (
              <LedgerRow key={row.key} row={row} comparison={comparison} subject={subject}
                timing={timing} lensKey={lensKey} onLens={onLens}
                onShowMembers={onShowMembers} />
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="lg-foot">
        {!result.sufficient ? null : comparison ? (
          <div className="lg-cmp" data-comparison-note>
            <span className="lg-cmp-k">Δ IS AGAINST</span>{" "}
            {comparison.changed ? <>the same cohort without <b>{comparison.changed.noun}</b></>
              : "the archive"}
            {" · "}
            {comparison.relation && comparison.relation.kind === "the two populations are the same storms"
              ? "removing it changes no storm"
              : comparison.relation && comparison.relation.shared !== undefined
                ? <>{comparison.relation.shared.toLocaleString()} shared storms, not independent samples</>
                : "not independent samples"}
            {conditions.length > 1 && onBaseline ? (
              <span className="lg-holdout" role="group" aria-label="which condition the baseline holds out">
                <span className="lg-cmp-k">HOLD OUT</span>
                {conditions.map((c) => (
                  <button type="button" key={c.key} data-chip={`baseline-${c.key}`}
                    aria-pressed={comparison.changed && comparison.changed.key === c.key ? "true" : "false"}
                    onClick={() => onBaseline(c.key)}
                    title={`compare against the same cohort without ${c.noun || c.label}`}>
                    without {c.label}
                  </button>
                ))}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="lg-cmp" data-comparison-note>
            <span className="lg-cmp-k">NO CONDITION SET</span> this cohort is the archive, and every
            conditioned cohort is measured against these rates
          </div>
        )}
      </div>
    </section>
  );
}

/* THE INTERVAL, AS A MARK, ON A COMMON 0-100 TRACK. A hairline whisker from the Wilson lower
   bound to the upper, a dot at the rate, and a tick at the baseline rate where one exists. It
   publishes nothing new -- every figure it draws is printed in type on the same row -- and is
   aria-hidden for exactly that reason. */
function IntervalMark({ cell, delta, tone, nonmember }) {
  if (!cell || cell.rate === null || !cell.ci95) return <span className="at-ans-int" aria-hidden="true" />;
  const clamp = (v) => Math.max(0, Math.min(100, 100 * v));
  const base = delta && delta.baseRate !== null && delta.baseRate !== undefined
    ? delta.baseRate : null;
  return (
    <span className="at-ans-int" aria-hidden="true" data-interval-mark
      data-bar-class={tone} data-nonmember={nonmember ? "" : undefined}>
      <i className="at-ans-track" />
      <i className="at-ans-whisk" style={{ left: `${clamp(cell.ci95[0])}%`, right: `${100 - clamp(cell.ci95[1])}%` }} />
      {base !== null ? <i className="at-ans-base" style={{ left: `${clamp(base)}%` }} /> : null}
      <i className="at-ans-dot" style={{ left: `${clamp(cell.rate)}%` }} />
    </span>
  );
}

function LedgerRow({ row, comparison, subject, timing, lensKey, onLens, onShowMembers }) {
  const { label, cell, delta } = row;
  const refused = isRefusedRow(row);
  const status = statusWordOf(row);
  const kind = refusalKindOfRow(row);
  const mark = kind ? markGroupOf(kind) : null;
  const members = row.memberRows;
  const canLens = !!(onLens && members && members.length);
  const held = canLens && lensKey === row.key;
  /* THE FIFTH RULE, ON THE SUBJECT TAG. A contract the cohort is conditioned on was reached by
     every member by construction, so REACHED there is vacuous and would read as evidence. */
  const reached = subject && kind !== "CONDITIONED_ON"
    ? subjectReached(subject, row.contractKey) : undefined;
  const nonmember = reached === false;
  const press = canLens ? () => onLens(held ? null : row.key) : undefined;
  const lift = canLens ? () => onLens(row.key, { transient: true }) : undefined;
  const drop = canLens ? () => onLens(null, { transient: true }) : undefined;
  const t = row.timing;

  return (
    <>
      <div className="lg-row" data-outcome={label} data-contract-row={row.contractKey || undefined}
        data-finding data-refused={refused ? "" : undefined}
        data-refusal-state={kind || undefined}
        data-nonmember={nonmember ? "" : undefined}
        data-self-contribution={row.selfContribution ? "" : undefined}
        data-lens-row={canLens ? row.key : undefined}
        data-held={held ? "" : undefined}
        role={canLens ? "button" : undefined} tabIndex={canLens ? 0 : undefined}
        aria-pressed={canLens ? (held ? "true" : "false") : undefined}
        title={canLens
          ? `${held ? "release" : "hold"} — draw the ${members.length.toLocaleString()} storms of this contract on the plate. The question, the rates and the URL do not change.`
          : undefined}
        onClick={press} onMouseEnter={lift} onMouseLeave={drop} onFocus={lift} onBlur={drop}
        onKeyDown={canLens ? (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(); }
        } : undefined}>
        <span className="lg-name">
          <i className="at-dc-tick" data-bar-class={row.tone} aria-hidden="true" />
          {mark ? <span className="at-mark" data-mark={mark} aria-hidden="true">{MARKS[mark].glyph}</span> : null}
          <span className="at-dc-name at-ans-label" title={label}>{label}</span>
          {reached === true ? <span className="lg-subj at-reached" data-subject-verdict="reached">
            {row.selfContribution ? "IS THE COUNT" : "REACHED"}</span>
            : reached === false ? <span className="lg-subj at-notreached" data-subject-verdict="no">NO</span>
              : null}
        </span>
        <IntervalMark cell={cell} delta={delta} tone={row.tone} nonmember={nonmember} />
        <span className="lg-rate">
          {refused ? (
            <span className="lg-bigcount" title="the count is published; the rate is not">
              {cell ? cell.count.toLocaleString() : "—"}
              <span className="lg-bigof">{cell && cell.n_storms ? ` OF ${cell.n_storms.toLocaleString()}` : ""}</span>
            </span>
          ) : null}
          <span className="at-dc-rate" data-rate-cell>
            {refused ? <span className="at-slot" aria-hidden="true">—</span>
              : <span className="at-val">{pct1(cell.rate)}</span>}
          </span>
        </span>
        {timing ? (
          <span className="lg-right at-dc-med" data-timing-refused={t && t.n && t.refused ? "under the sample gate" : undefined}>
            {t === undefined || t === null
              ? <span className="at-slot at-nottimed" data-not-timed
                  title="the archive publishes time-to-threshold for TS, Cat 1, Cat 3 and landfall only">NOT TIMED</span>
              : t.n === 0 ? <span className="at-slot">—</span>
                : t.refused
                  ? <span className="at-slot" title={`${t.n} storm${t.n === 1 ? "" : "s"} carried this outcome — fewer than the ${t.min_sample} required before the archive will describe when.`}>REFUSED</span>
                  : <span className="at-val">{Math.round(t.median)} h</span>}
          </span>
        ) : (
          <span className="lg-right at-dc-vs">
            {!refused && comparison && delta && delta.deltaPp !== null
              ? <span className="at-val">{signed(delta.deltaPp)} pp</span>
              : !refused && comparison && delta && delta.baseRate === null ? null : null}
          </span>
        )}
        <span className="lg-sup">
          <span className="at-dc-count">
            {cell ? <span className="at-val">{cell.count.toLocaleString()}{cell.n_storms ? <> / {cell.n_storms.toLocaleString()}</> : null}</span> : null}
          </span>
          <span className="at-dc-int">
            {!refused && cell && cell.ci95 ? (
              <>{" · "}<span className="at-val">
                {(100 * cell.ci95[0]).toFixed(1)}–{(100 * cell.ci95[1]).toFixed(1)}%
              </span></>
            ) : null}
          </span>
          {timing && t && t.n && !t.refused ? (
            <span className="at-dc-iqr">{" · "}<span className="at-val">{Math.round(t.p25)}–{Math.round(t.p75)} h</span></span>
          ) : null}
        </span>
        <span className="lg-st at-dc-status" data-status={status || undefined}>{status || null}</span>
      </div>
      {held && onShowMembers ? (
        <div className="lg-held" data-lens-echo-row>
          <span>{members.length.toLocaleString()} storm{members.length === 1 ? "" : "s"} drawn on the plate</span>
          <button type="button" data-show-members={row.key}
            onClick={() => onShowMembers(row.key)}>LIST THEM →</button>
          <button type="button" className="lg-held-x" onClick={() => onLens(null)}>RELEASE</button>
        </div>
      ) : null}
    </>
  );
}
