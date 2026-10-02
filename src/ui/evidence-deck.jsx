/* THE EVIDENCE BEHIND A READING — row assembly, refusal kinds, and the record below the fold.
 *
 * WHAT THIS FILE WAS, AND WHAT IT IS NOW. It held the evidence deck: one grid of every contract,
 * printed beneath the plate while an eight-row answer ladder beside the plate printed the same
 * rates a second time. The ledger (ledger.jsx) is that grid now, set beside the plate at the
 * ladder's measure, and the deck's matrix is gone. What stays here is everything the matrix and
 * the ledger both depend on and nothing either one draws:
 *
 *   buildGroups        the contracts, in the archive's order, with their cells, deltas, timing
 *                      and engine member sets -- the ONE row assembly every surface reads
 *   isRefusedRow /     the three tests for "is this row refused", and which refusal governs it,
 *   refusalKindOfRow   in one place so no two surfaces can disagree about a row
 *   statusWordOf       the closed status vocabulary a row may print
 *   subjectVerdicts    a selected storm's own REACHED / NO / undecided against each contract
 *   EvidenceRecord     below the fold: every governing refusal explained once, the archive's own
 *                      gap sentences, the baseline and how the two populations are related, what
 *                      the rates assume, the pathway caveat and the environment lens
 *
 * THE FOUR PANEL RULES ARE UNCHANGED, and check-evidence-deck.mjs audits the shipping ledger and
 * record against them per row: no bare percentage, a refused row renders no rate anywhere inside
 * it, an unscoreable contract states what it has against what it needs, and every status sits
 * inside the row it governs.
 */

import React from "react";
import { CATEGORY_ORDER } from "../render/palette.js";
import { regionLabel } from "../engine/cohort-language.js";
import { intensityContractKey, landfallContractKey } from "../engine/calibration.js";
import { REFUSALS } from "./refusal.jsx";
import { refusalKindOf, countsOf } from "./outcome-card.jsx";
import { Chip, CohortSpec } from "./kit.jsx";
import { WhatChanged } from "./condition-strip.jsx";
import { baselineSentence } from "../engine/cohort-language.js";
import { Refusal } from "./refusal.jsx";
import { claimText } from "./kit.jsx";

const CIRCULAR = "CONDITIONED ON -- NOT AN OUTCOME";

const CAT_LABEL = { td: "TROPICAL DEPRESSION", ts: "TROPICAL STORM", cat1: "CATEGORY 1",
  cat2: "CATEGORY 2", cat3: "CATEGORY 3", cat4: "CATEGORY 4", cat5: "CATEGORY 5" };

/* ── THE THREE MARKS ──────────────────────────────────────────────────────────────────────
 *
 * Nine treatments become three. This is a PRESENTATION grouping and nothing else: the engine's
 * six refusal kinds keep their identities, their claim ids and their wording, because
 * scripts/test-atlas-refusals.mjs proves every state the surface can print has a row a reader
 * can look it up in, and collapsing the kinds would collapse that correspondence too. What a
 * reader learns is three marks; what the record keeps is six states, and the STATUS word is
 * where the distinction stays visible.
 *
 *   ▤  refused      the sample gate, in all three of the ways it can bind
 *   ⌁  not evaluable  outside the record's era or coverage -- and an unrecorded outcome
 *   ↺  conditioned on  the variable is in the query, so it is not an outcome of it
 */
export const MARKS = {
  REFUSED: { glyph: "▤", label: "REFUSED" },
  NOT_EVALUABLE: { glyph: "⌁", label: "NOT EVALUABLE" },
  CONDITIONED_ON: { glyph: "↺", label: "CONDITIONED ON" },
};

const MARK_OF_KIND = {
  RATE_REFUSED: "REFUSED",
  BASE_RATE_ONLY: "REFUSED",
  OUT_OF_SCOPE: "REFUSED",
  NOT_EVALUABLE: "NOT_EVALUABLE",
  UNKNOWN: "NOT_EVALUABLE",
  CONDITIONED_ON: "CONDITIONED_ON",
};

export function markGroupOf(kind) { return MARK_OF_KIND[kind] || null; }

/* THE STATUS VOCABULARY, CLOSED. A status cell may print one of these and nothing else -- no
   free text, no engine string, no count. It is a label, not a sentence: the sentence lives in
   the row's refusal block where there is room to be correct rather than short.

   SELF_CONTRIBUTION is here rather than in REFUSALS because it is not a refusal. The rate is
   real and the row keeps it; what the word says is that this reader's own selected storm is

/* WHICH WORD A SCOREABLE ROW CARRIES.
 *
 * Only the comparison can put a word here, and it says exactly what engine/compare.js is
 * permitted to say -- whether the two samples separate. SUPPORTED where the intervals are
 * disjoint, MIXED where they overlap. Neither is a test and neither borrows the vocabulary of
 * one; they are the two permitted statements, shortened to a column width, with the sentence
 * itself still printed in the deck's key.
 *
 * A row with no comparison carries NO word. An empty status cell is the honest rendering of
 * "nothing has been claimed about this row": inventing a word for it would publish a
 * qualification the engine never made. */
function statusOfScoreable(delta) {
  if (!delta || delta.overlap === null || delta.baseRate === null) return null;
  return delta.overlap ? "MIXED" : "SUPPORTED";
}

export const pct1 = (x) => `${(100 * x).toFixed(1)}%`;


/* ── THE DECK ─────────────────────────────────────────────────────────────────────────── */


/* ── THE RECORD BEHIND A READING ───────────────────────────────────────────────────────────
 *
 * EVERYTHING THE DECK SAID ABOUT ITS ROWS, WITHOUT PRINTING THE ROWS A SECOND TIME. The ledger
 * beside the plate is the matrix now; what stays below the fold is what qualifies it -- each
 * governing refusal explained once, the archive's own gap sentences, the baseline and how the two
 * populations are related, what the last edit did, what the rates assume, the pathway caveat,
 * the environment lens and the citation. Same components, same words, same hooks; only the table
 * is gone, because it is beside the map.
 */
export function EvidenceRecord({ result, comparison, subject, onEvidence, environment = null,
  spec = null, pathway = null, conditions = [], onBaseline, whatChanged = null,
  citation = null, citationUrl = null, limitsRef = null, onSeal = null }) {
  if (!result) return null;
  const r = result;
  if (!r.n_cases) {
    return <div className="at-record" data-evidence-record><EmptyPool result={r} spec={spec} /></div>;
  }
  const groups = buildGroups(r, comparison, subject);
  return (
    <div className="at-record" data-evidence-record>
      <div className="at-record-col" ref={limitsRef} data-record-limits>
        <h2 className="at-record-h">WHY SOME ROWS HAVE NO RATE</h2>
        <GroupedLimits groups={groups} onEvidence={onEvidence} />
        {!groups.some((g) => g.rows.some(isRefusedRow)) ? (
          <p className="at-foot-line" data-no-refusals>Every contract in this cohort publishes a rate.</p>
        ) : null}
        <Limits result={r} />
        <GroupQualification which="landfall" result={r} />
      </div>
      <div className="at-record-col">
        <h2 className="at-record-h">WHAT THE NUMBERS ARE MEASURED AGAINST</h2>
        <DeckPreamble result={r} spec={spec} />
        {/* THE HOLD-OUT CONTROL IS THE LEDGER'S, beside the column of deltas it changes; the
            record states what the baseline is and how the two populations relate, once. */}
        <DeckFoot comparison={comparison} conditions={[]} onBaseline={onBaseline}
          whatChanged={whatChanged} groups={groups} citation={citation} citationUrl={citationUrl}
          onSeal={onSeal} />
        <RatesAssume />
        {pathway ? (
          <details className="at-deck-env" data-deck-pathway open>
            <summary>HISTORICAL PATHWAY FREQUENCY</summary>
            <div className="at-env-body">
              <p className="at-foot-line">
                <strong>THIS IS NOT A FORECAST.</strong> {claimText("atlas.pathway")}
              </p>
            </div>
          </details>
        ) : null}
      </div>
      {environment ? (
        <div className="at-record-wide">
          <details className="at-deck-env" data-deck-environment open>
            <summary>THE ENVIRONMENT THEY FORMED IN — a lens, not a filter</summary>
            <div className="at-env-body">{environment}</div>
          </details>
        </div>
      ) : null}
    </div>
  );
}

/* WHICH WORD A ROW WOULD PRINT IN STATUS, computed in one place because two things read it:
   the row that renders it, and the deck deciding whether the column exists at all. Two
   expressions that had to agree would eventually not, and the day they disagreed a refusal
   would lose its word. */
/* THE THREE TESTS, ONCE. Every reading of "is this row refused" on this surface -- the deck's
   own cells, the answer ladder beside the plate, the grouped limits below the matrix -- goes
   through this, so a row cannot be refused in one place and scoreable in another. */
export function isRefusedRow(row) {
  const { cell, unscoreable } = row;
  return !!unscoreable || !!(cell && (cell.status === CIRCULAR || cell.rate === null));
}

export function statusWordOf(row) {
  const { delta, selfContribution } = row;
  const refused = isRefusedRow(row);
  if (refused) return REFUSALS[refusalKindOfRow(row)].title;
  if (selfContribution) return "SELF-CONTRIBUTION";
  return statusOfScoreable(delta);
}

/* The refusal kind, from the same three tests, for the same reason. */
export function refusalKindOfRow(row) {
  const { cell, unscoreable } = row;
  if (unscoreable) return refusalKindOf(unscoreable);
  if (cell && cell.status === CIRCULAR) return "CONDITIONED_ON";
  if (cell && cell.rate === null) return "RATE_REFUSED";
  return null;
}

/* THE COLUMN HEADS. Uppercase at the label token, which is the only size uppercase is allowed
   at besides the stamps. The duration heading is two tracks, because MED h and P25-P75 are one
   statement about duration and a reader reads them together. */
/* ONE CONTROL, NAMING EVERYTHING IT HOLDS. The fold names its contents -- + TIMING COLUMNS --
   and opening it restores both duration tracks. Only TIMING is ever behind it: the interval is
   not a column any more and so has nothing to restore, and a control offering to bring back


   reason: it had been written out a second time, with the kind hard-coded. */
function RemedyLine({ kind }) {
  const r = REFUSALS[kind];
  if (!r) return null;
  return (
    <span className="at-say-remedy">
      {r.resolvable === "no" ? <><strong>A LIMIT OF THE RECORD.</strong> {r.irreducible}</>
        : <><strong>{r.resolvable === "partly" ? "PARTLY IN YOUR HANDS." : "YOU CAN CHANGE THIS."}</strong>{" "}
          {r.remedyShort || r.remedy}</>}
    </span>
  );
}


/* ── LIMITS & EXCLUSIONS: ONE BLOCK PER GOVERNING REFUSAL ──────────────────────────────────
 *
 * WHAT THIS REPLACES. A refusal used to be stated on the row it governed -- the archive's own
 * sentence, its counts and its way out, between two rows of the table -- with identical lines
 * hoisted to one per group. Measured on a conditioned East Pacific cohort: six OUT OF SCOPE
 * blocks, each four lines, interleaved through a sixteen-row matrix, and the reader scanning
 * rates read the prose as the table's texture rather than as its qualification.
 *
 * WHAT IS PRESERVED, EXACTLY. Every row keeps its mark, its state word and its counts -- panel
 * rule 4 is untouched, and a refused row still says so where it is. What moves is the SENTENCE.
 * Each governing refusal gets one block; inside it, every DISTINCT sentence the engine wrote is
 * printed once, verbatim, with the contracts that share it named beside it and their own counts
 * with them. Nothing is summarised, nothing is truncated and no reason speaks for a row it does
 * not describe -- which is the same rule the group-level hoist enforced, applied across the
 * matrix instead of inside one group.
 *
 * THE WAY OUT IS SAID ONCE PER KIND, and that is the whole economy: the remedy is a fact about
 * the REFUSAL, not about the contract, so twelve rows sharing a kind shared twelve copies of it.
 */
function GroupedLimits({ groups, onEvidence }) {
  const byKind = new Map();
  for (const g of groups) {
    for (const row of g.rows) {
      const kind = refusalKindOfRow(row);
      if (!kind) continue;
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push(row);
    }
  }
  if (!byKind.size) return null;
  return (
    <section className="at-deck-limitgroups" data-limit-groups>
      <div className="at-limitgroups-head">
        <span className="at-foot-k">LIMITS &amp; EXCLUSIONS</span>
        <span className="at-limitgroups-note">
          one explanation per governing refusal — every row above carries its own state and count
        </span>
      </div>
      {[...byKind].map(([kind, rows]) => (
        <LimitBlock key={kind} kind={kind} rows={rows} onEvidence={onEvidence} />
      ))}
    </section>
  );
}

function LimitBlock({ kind, rows, onEvidence }) {
  const r = REFUSALS[kind];
  /* DISTINCT SENTENCES, IN THE ORDER THE ROWS APPEAR, each with the contracts it speaks for.
   *
   * ONE LINE REPLACES N, SO THE KEY IS EVERYTHING THOSE N LINES WOULD HAVE PRINTED -- and this
   * line prints three things, of which the block already fixes one:
   *
   *   kind    which way out there is. It is the BLOCK, so every line inside one is already
   *           agreed on it. Keyed on the sentence alone and grouped across kinds, the shared
   *           line hard-coded RATE_REFUSED -- so ?i=cat4, where five contracts refuse
   *           CONDITIONED_ON because the cohort was defined by the outcome, was told "a wider
   *           cohort would carry a rate: drop a condition, widen the radius, or extend the
   *           seasons". None of those three moves a circular contract.
   *   counts  the scope/archive/required triple, published on this line and not derivable from
   *           the sentence. A BASE RATE ONLY reason names only the ARCHIVE-WIDE total, so two
   *           regions with the same total and different in-scope counts write the same sentence
   *           and publish different numbers. Not reachable in today's archive -- hawaii:hurricane
   *           is the only contract under the archive-wide gate -- which is exactly why it belongs
   *           in the key rather than in a comment about why it cannot happen yet.
   *   reason  the sentence itself, which is what grouping was always about.
   *
   * Joined on NUL, the one character neither can contain, so no two distinct pairs collide. */
  const byReason = new Map();
  for (const row of rows) {
    const counts = countsOf(row.unscoreable) || "";
    const reason = reasonOf(row) || "";
    const key = `${counts}\u0000${reason}`;
    if (!byReason.has(key)) byReason.set(key, { counts, reason, labels: [] });
    byReason.get(key).labels.push(row.label);
  }
  const first = rows.find((row) => row.contractKey);
  return (
    <div className="at-limit" data-refusal={r.kind} data-limit-kind={r.kind}>
      <div className="at-limit-head">
        <span className="at-mark" data-mark={markGroupOf(kind)} aria-hidden="true">
          {MARKS[markGroupOf(kind)].glyph}
        </span>
        <span className="at-limit-title">{r.title}</span>
        <span className="at-limit-count">
          {rows.length} CONTRACT{rows.length === 1 ? "" : "S"}
        </span>
      </div>
      {/* THE SAME SENTENCE WITH DIFFERENT NUMBERS IS SAID ONCE IN FULL. Nine OUT OF SCOPE contracts
          wrote nine copies of one sentence that differed only in their counts, and the block
          the pointer calls "explained once" read as a wall. The first line of each sentence
          shape prints it whole; the rest print their contract and counts -- the numbers the
          sentence would have carried -- with their own sentence, verbatim, one press away. */}
      {[...byReason.values()].map((b, i, all) => {
        const shape = (t) => String(t || "").replace(/\d[\d,.]*/g, "#");
        const firstOfShape = b.reason
          ? all.slice(0, i).find((x) => shape(x.reason) === shape(b.reason)) : null;
        /* ONLY WHERE THE COUNTS ARE ON THE LINE. The summary says "with the counts on this line";
           a RATE_REFUSED line carries no counts field (its numbers live only in its sentence), so
           collapsing it would hide the numbers behind a summary that says they are visible. */
        const repeat = !!firstOfShape && !!b.counts;
        return (
        /* THE LABELS ARE PUBLISHED TWICE: joined for the reader, enumerated for a machine.
           A contract label can itself contain the separator -- `Hawaii · ≥64 KT` is one
           contract, not two -- so anything that needs the list back has to read the array
           rather than split the rendered line. check-atlas-published-values did split it,
           and reported the Hawaii hurricane contract as unrefused and a phantom `Hawaii`
           as refused. */
        <div className="at-limit-line" key={i} data-contracts={JSON.stringify(b.labels)}>
          <span className="at-limit-which">{b.labels.join(" · ")}</span>
          {b.counts ? (
            <span className="at-need" title="events in scope · archive-wide · required">
              {b.counts}
            </span>
          ) : null}
          {repeat ? (
            <details className="at-say-more" data-same-reason>
              <summary>Refused for the same reason as {firstOfShape.labels[0]}, with the counts
                on this line.</summary>
              <span className="at-say-text">{b.reason}</span>
            </details>
          ) : <span className="at-say-text">{b.reason}</span>}
        </div>
        );
      })}
      <RemedyLine kind={kind} />
      {onEvidence && first ? (
        <button type="button" className="at-say-link" data-evidence-link
          onClick={() => onEvidence(first.contractKey)}>SEE THE EVIDENCE →</button>
      ) : null}
    </div>
  );
}


/* WHICH SENTENCE A ROW WOULD PRINT, so repetition can be counted before anything is rendered. */
function reasonOf(row) {
  if (row.unscoreable) return row.unscoreable.reason || null;
  const c = row.cell;
  if (!c) return null;
  if (c.status === CIRCULAR) return c.reason || null;
  return c.rate === null ? (c.refused_reason || null) : null;
}


/* THE BOUND IS ON THE STATEMENT, NOT ON THE ARGUMENT. Eighteen words is what fits in the deck
   without pushing the next row off the screen; the whole reason is one click away and is never
   rewritten. Truncation stops at a word and says it has, so a reader is never left believing


/* ── WHAT THE READER NEEDS BEFORE THE FIRST RATE ─────────────────────────────────────────
 *
 * THE COUNT AND THE GATE ARE ONE FACT -- how much evidence is there, and is it enough -- so they
 * read as one line. The effective sample size keeps its own, because it carries a statement
 * neither of the others makes: every storm in a cohort counts once, membership being decided by
 * hard conditions rather than by a weight, so the ESS IS the count and no storm is standing in
 * for another. A distance-weighted analog pool does not have that property.
 *
 * AND THE ASSUMPTIONS TRAVEL WITH THE NUMBERS. This is the fourth panel rule, and it is the one
 * a table makes easiest to lose: the rates are GENESIS-CONDITIONED, landfall does not decompose
 * as a product of marginals, and a variable used to define a cohort is not reported as an
 * outcome of it. None of that is standing methodology a reader can be assumed to carry -- it is
 * a statement about how the numbers on THIS screen were computed.
 *
 * EVERY SENTENCE COMES FROM docs/app/claims.js, through claimText, and none is written here. The
 * registry is the one authorship site for a capability claim; a second copy in a component is
 * exactly the drift the claim audit exists to catch. */
function DeckPreamble({ result, spec }) {
  const r = result;
  return (
    <div className="at-deck-pre" data-deck-preamble>
      {/* THE COHORT COUNT AND THE SAMPLE GATE ARE NOT HERE ANY MORE, AND THAT IS THE POINT.
       *
       * `3,885` used to be printed three times on one screen: a 22px numeral beside the question,
       * a 26px numeral here, and again in the plate's head band. Three renderings of one number
       * make a reader look for the difference between them, and the frozen frame gives cohort
       * identity ONE primary home -- the 11.5px line directly under the question, where it is the
       * denominator of everything below it. `SUFFICIENT · 3885 ≥ 10` went with it, to the same
       * line, in the same words.
       *
       * WHAT STAYED IS THE STATEMENT, NOT A SECOND NUMBER. Every storm counts once -- membership
       * is decided by hard conditions, never a weight -- so the effective sample size IS the
       * count, and it is printed as the integer it is. The line stays because it says exactly
       * that, which a distance-weighted analog pool could not. `count · rate · 95% Wilson` did go: the column heads now say exactly that, one
       * line below, in the table it describes. */}
      <div className="at-pre-line">
        <span className="at-foot-k">EFFECTIVE SAMPLE SIZE</span>
        <span className="at-val">{Math.round(Number(r.effective_sample_size)).toLocaleString()}</span>
      </div>

      <div className="at-pre-line at-pre-prose">
        Distinct storms reaching each threshold, over the storms whose outcome the archive
        actually recorded.
      </div>

      {/* WHY NO WEIGHTED RATE, SAID RATHER THAN SILENTLY OMITTED -- AND SAID IN ONE LINE.
          Distance is already a condition of membership, so weighting by it again would count the
          same variable twice and the weighted rate would equal the unweighted one. Printed only
          when a location condition is what makes it true.

          FOUR LINES OF PROSE BETWEEN THE QUESTION AND THE TABLE IS WHERE THIS WAS, and a reader
          arriving to read a ladder scrolls past a paragraph. The SURFACE now carries the claim in
          one line -- which is the whole of what changes an interpretation: these are storms, not
          storm-kilometres -- and the ARGUMENT for it sits one disclosure below, in the wording it
          always had. Nothing was shortened away: `at-pre-more` holds the same sentences, and the
          summary states the finding rather than promising "more information".

          IT IS A COLLAPSE, NOT A MOVE. The note is still adjacent to the evidence it qualifies,
          still inside the deck, and still above the first rate -- a caveat that changes how a
          number is read may be made shorter and may not be made further away. */}
      {spec && spec.where ? (
        <details className="at-pre-line at-pre-prose at-pre-more" data-weighting-note>
          <summary>
            Every storm here counts once — distance is a condition of membership, not a weight.
          </summary>
          <p>
            Distance is already a condition of membership — within {spec.where.radiusKm} km — so
            it is not also used as a weight; weighting by it again would count the same variable
            twice. The weighted rate would equal the unweighted rate, and is not printed twice
            under two names.
          </p>
        </details>
      ) : null}

    </div>
  );
}

/* WHAT THE RATES ARE AND WHAT THEY ASSUME — BELOW THE TABLE, NOT ABOVE IT.
 *
 * This is standing methodology: genesis-conditioned rates, landfall not decomposing as a product
 * of marginals, a variable used to define a cohort not being reported as an outcome of it. All
 * three are true of every cohort and none is a fact about THIS one.
 *
 * It sat above the table for one draft and cost the acceptance test: three claim paragraphs of
 * fifty words each pushed the outcome rows and their qualification off the first screen, and
 * answer density fell from five of five to four. Below the table it is still rendered, still in
 * the page's text, still one scroll from the rates it governs -- and the first screen is the
 * question, the cohort, the map, the rates and what qualifies them, which is what the density
 * target is measuring.
 *
 * NOT COLLAPSED TO ACHIEVE THAT. A closed disclosure would have bought the same pixels and hidden
 * a statement about how every number above was computed; moving it is not hiding it. */
function RatesAssume() {
  return (
    <details className="at-pre-assume" data-rates-assume open>
      <summary>WHAT THESE RATES ARE, AND WHAT THEY ASSUME</summary>
      <p className="at-foot-line">{claimText("atlas.subject")}</p>
      <p className="at-foot-line">{claimText("atlas.rates")}</p>
      <p className="at-foot-line">{claimText("atlas.conditioning")}</p>
    </details>
  );
}

/* THE EMPTY POOL. Its words are the panel's own, because they are the only correct ones: the
   per-condition counts are taken IN THE ORDER THE FILTERS RUN, so the largest is not necessarily
   the condition that emptied the cohort -- and a reader told otherwise will remove the wrong one.
   The genesis-only paragraph appears only with a location condition, which is the only state it
   is true of. */
function EmptyPool({ result, spec }) {
  return (
    <div className="at-deck-empty" data-empty-pool>
      <div className="at-empty-k">[ NO STORMS MATCHED THIS COHORT ]</div>
      <p className="at-foot-line">
        There is no sample here, so there are no rates. Every condition you set is listed above
        with what it removed — but those counts are taken in the order the filters run, and a
        storm rejected by two conditions is counted only against the first. The largest number is
        therefore not necessarily the condition that emptied the cohort. Remove them one at a
        time to find out which one did.
      </p>
      {spec && spec.where ? (
        <>
          <p className="at-foot-line">
            Matching is on GENESIS LOCATION ONLY: where a storm formed, not where it went. A point
            along a common track will usually match nothing, because storms arrive at those
            positions rather than forming there.
          </p>
          <p className="at-foot-line">
            Widen the radius only if that is a question you actually mean to ask — a wider circle
            answers a different question, it does not find a missing sample.
          </p>
        </>
      ) : null}
      {result.gaps && result.gaps.length ? (
        <div data-archive-gaps className="at-foot-block">
          <span className="at-foot-k">GAPS THE ARCHIVE RECORDED</span>
          {result.gaps.map((g, i) => <span className="at-foot-line" key={i}>{g}</span>)}
        </div>
      ) : null}
    </div>
  );
}

/* ── WHAT QUALIFIES THE ROWS, DIRECTLY BENEATH THE ROWS IT QUALIFIES ──────────────────────
 *
 * These are not refusals and they do not belong to any single row. They are the archive's own
 * statements about the evidence, and leaving them out was the most expensive omission in the
 * first draft of this deck: with no conditions set nothing refuses, every status cell is empty,
 * and the surface published thirteen confident rates with NOTHING qualifying them. The
 * answer-density criterion that caught it -- "material evidence qualification visible" --
 * measured zero, correctly.
 *
 * PLACED PER GROUP, WHICH IS BOTH A LEGIBILITY FIX AND A CORRECTNESS ONE.
 *
 * The first version put all of it at the deck's foot, below eighteen rows. It was present and it
 * required scrolling to reach, which for an acceptance test measured at 0px scroll is the same
 * as absent. But moving it UP to the head was not available either: the archive's own sentence
 * reads "Intensity rates above are therefore biased LOW", so a block above the rates would make
 * the engine's text wrong about the page, and rewording a measured finding to suit a layout is
 * how a finding stops being one.
 *
 * Directly under the INTENSITY group satisfies both: "above" stays true, and it lands inside the
 * first screen. That is also exactly where the panel this replaces put it, for the same reason.
 *
 * `data-archive-gaps` lets the DOM gate exempt the percentages quoted INSIDE these sentences --
 * "1.7% Cat 3 in the 1960s" -- from the no-bare-percentage rule by identity rather than by
 * position on the page.
 */
function Limits({ result }) {
  const gaps = result.gaps || [];
  const unknown = unknownOf(result);
  if (!gaps.length && !unknown) return null;
  return (
    <div className="at-deck-limits" data-deck-limits data-deck-qualification="intensity">
      {gaps.length ? (
        <div data-archive-gaps className="at-foot-block">
          {/* THE HEADING IS THE ONE IT ALWAYS WAS. The block moved and its typesetting changed;
              its words did not, and a published string is not something a layout gets to
              rewrite on its way past. */}
          <span className="at-foot-k">GAPS THE ARCHIVE RECORDED</span>
          {gaps.map((g, i) => <span className="at-foot-line" key={i}>{g}</span>)}
        </div>
      ) : null}
      {/* RENDERED THROUGH Refusal, NOT RE-DRAWN. UNKNOWN is one of the six states the Epistemic
          Key documents, and test-atlas-refusals proves every state the surface can print has a
          row a reader can look it up in. A hand-drawn copy here would carry the words without
          the hook -- present on screen and invisible to the gate that checks the correspondence,
          which is the worst of both. */}
      {unknown > 0 ? (
        <div className="at-foot-block" data-unknown-note>
          <Refusal kind="UNKNOWN" compact
            counts={`${unknown.toLocaleString()} storm${unknown === 1 ? "" : "s"}`} />
        </div>
      ) : null}
    </div>
  );
}

function GroupQualification({ which, result }) {
  /* THE LANDFALL DENOMINATOR, when a condition has changed what these rates are rates OF. Not a
     refusal -- they are real -- but "43.8% made landfall in Mexico" means something different
     one condition later, and the difference is a factor of three. */
  if (which === "landfall" && result.landfall_note) {
    return (
      <div className="at-deck-foot" data-deck-qualification={which}>
        <div className="at-foot-block" data-landfall-note>
          <span className="at-foot-k">LANDFALL DENOMINATOR</span>
          <span className="at-foot-line">{result.landfall_note}</span>
        </div>
      </div>
    );
  }
  return null;
}

/* THE UNKNOWNS ARE ONE SET, NOT ONE PER ROW. Every intensity contract shares a denominator, so
   the largest n_unknown across them IS the count of storms the archive never recorded an outcome
   for. Taken as a max rather than a sum for exactly that reason: summing would count the same
   storms once per contract. Same derivation the panel used. */
function unknownOf(r) {
  let n = 0;
  for (const c of CATEGORY_ORDER) {
    const cell = r.intensity[c];
    if (cell && cell.n_unknown > n) n = cell.n_unknown;
  }
  return n;
}

/* ── ROW ASSEMBLY ─────────────────────────────────────────────────────────────────────────
 *
 * Groups never interleave, because a landfall rate and an intensity rate do not share a
 * denominator and a sort that mixed them would put two different questions on one axis. Within a
 * group the archive's own ladder order is the default; landfall regions order by evidence, which
 * is what the panel already did -- alphabetical order buried the one region these storms reached
 * under four they did not. */
export function buildGroups(r, comparison, subject) {
  const groups = [];
  const tte = r.time_to_event || {};
  /* THE MEMBERS ARE THE ENGINE'S, OR THERE ARE NONE. `result.members` is present only when the
     surface asked cohortResult for it; every other consumer of buildGroups -- the deck's own
     fixtures, the gates -- gets rows with `memberRows: null` and behaves exactly as before. The
     renderer never derives membership: a row's lifted set is the set the engine counted. */
  const mem = r.members || null;

  /* INTENSITY. TD is not a rung: the ladder starts where the archive's own thresholds start. */
  const intensityRows = CATEGORY_ORDER.filter((c) => c !== "td").map((cat) => {
    const cell = r.intensity[cat];
    const key = intensityContractKey(cat);
    return {
      key: `int:${cat}`,
      label: CAT_LABEL[cat],
      tone: cat,
      cell,
      unscoreable: r.unscoreable ? r.unscoreable[cat] : undefined,
      delta: comparison ? comparison.intensity[cat] : null,
      timing: tte[cat],
      contractKey: key,
      memberRows: mem && mem.intensity ? mem.intensity[cat] || null : null,
      selfContribution: isSelfContribution(cell, subject, key, r.min_sample),
    };
  });
  groups.push({
    key: "intensity", label: "INTENSITY",
    denom: intensityRows.length && intensityRows[0].cell ? intensityRows[0].cell.n_storms : null,
    note: "storms whose peak the archive recorded",
    rows: intensityRows,
  });

  /* LANDFALL. Two contracts per region -- any, and >=64 kt -- on their own rows rather than
     packed into one, because they have different numerators and a shared row would have to pick
     one of them to draw. */
  const allRegions = Object.entries(r.landfall || {})
    .sort((a, b) => b[1].any.count - a[1].any.count || a[0].localeCompare(b[0]));

  /* BELOW 1440 THE LOW-EVIDENCE REGIONS COLLAPSE TO ONE ROW, and which ones is decided by the
     archive rather than by the alphabet: the list is already ordered by evidence, so the ones
     that fold are the ones a reader scanning from the top reaches last. The summary states how
     many regions it holds AND how many of their contracts refused -- a fold that hid four
     refusals behind the word "more" would be hiding exactly what a reader needs to know is
     there. One click brings them all back, which is the rule for every fold on this surface.

     AND ABOVE 1440 NOTHING FOLDS, INCLUDING THE REGIONS WITH NO EVIDENCE. That was tried and
     reverted, and the reason is worth keeping.

     The case for folding them looks strong. On a 500 km cohort around CP012026's genesis the
     deck holds 26 storms, ONE observed crossing -- in Hawaii -- and eight further rows reading 0
     for Caribbean, Central America, CONUS and Mexico, four regions those storms never
     approached. Eight rows of zero under the one row that answers the question reads as the
     answer competing with four non-answers for the same eye, and folding them behind the summary
     put Hawaii and the intensity ladder alone above the fold.

     IT ALSO HID THE REFUSALS, WHICH ARE THE POINT. Six of those eight contracts publish no rate
     at all: they publish OUT OF SCOPE or BASE RATE ONLY. Methodology 1.1.0 split those two apart
     precisely so a zero could never be read as an empirical never -- the Florida click, where an
     Atlantic cohort was told its Hawaii landfall rate was 0.0% [0.0-3.2%] as a scoreable
     contract on the strength of eleven Pacific storms it could never contain. A fold keyed on
     "no evidence" folds exactly the rows whose whole content is the explanation of why there is
     none, and scripts/check-atlas-dom.mjs [4g] fails when it does.

     The prioritisation the fold was reaching for is already here and costs none of that: the
     list is ORDERED BY EVIDENCE, so Hawaii leads a Hawaii cohort and the four zeros follow it.
     Order demotes. Hiding deletes. */
  const regions = allRegions;
  if (allRegions.length) {
    const rows = [];
    for (const [region, kinds] of regions) {
      for (const kind of ["any", "hurricane"]) {
        const cell = kinds[kind];
        const key = landfallContractKey(region, kind);
        rows.push({
          key: `lf:${region}:${kind}`,
          label: `${regionLabel(region)}${kind === "hurricane" ? " · ≥64 KT" : ""}`,
          tone: kind === "hurricane" ? "cat1" : "ts",
          cell,
          unscoreable: r.unscoreable ? r.unscoreable[`${region}:${kind}`] : undefined,
          delta: comparison ? comparison.landfall[region][kind] : null,
          /* ITS OWN CONTRACT'S TIMING. Both rows read `landfall_${region}` until the engine grew
             a series per contract; the hurricane row was therefore showing the any-strength
             timing, early by up to 51 h, beside a rate counting a different population. */
          timing: tte[kind === "hurricane" ? `landfall_${region}_hurricane`
            : `landfall_${region}`],
          contractKey: key,
          memberRows: mem && mem.landfall ? mem.landfall[`${region}:${kind}`] || null : null,
          selfContribution: isSelfContribution(cell, subject, key, r.min_sample),
        });
      }
    }
    groups.push({
      key: "landfall", label: "LANDFALL",
      denom: rows.length && rows[0].cell ? rows[0].cell.n_storms : null,
      note: r.landfall_note ? "denominator changed by a condition" : null,
      rows,
    });
  }

  return groups;
}

/* THE TRIGGER, STATED ONCE, AND READ LITERALLY.
 *
 * Four things, all of them: a storm is selected, it is a member of this cohort, it reached this
 * contract, and it is A MAJORITY OF a numerator that sits below the sample gate.
 *
 * One storm is a majority of n only when 1 > n/2 -- which is n = 1, and the specification's own
 * wording for the SUBJECT cell settles it independently: the column is to read IS THE COUNT, not
 * "is most of the count". So the trigger is the storm being the entire numerator. That is
 * narrow, and deliberately so: a disclosure that fired on "a noticeable share" would need a
 * threshold, and a threshold here would be a new epistemic rule rather than a disclosure of an
 * existing one. */
export function isSelfContribution(cell, subject, contractKey, minSample) {
  if (!subject || !subject.inCohort || !cell || cell.rate === null) return false;
  if (subjectReached(subject, contractKey) !== true) return false;
  const n = cell.count;
  if (!n || !minSample || n >= minSample) return false;
  return n === 1;
}

/* ── THE SUBJECT'S OWN VERDICTS ───────────────────────────────────────────────────────────
 *
 * A PRESENTATION READ, AND NOTHING MORE. Every value here comes from fields the pack already
 * holds on the storm -- `max_category` and the landfall rows -- compared against the same
 * contract keys the ledger uses. Nothing is computed that the engine does not already compute,
 * no threshold is introduced, and the archive's own answer is never overridden.
 *
 * THREE STATES, NOT TWO, AND THE THIRD IS THE WHOLE POINT. A contract this storm did not reach
 * gets NO. A contract the archive cannot answer FOR THIS STORM -- an unrecorded peak intensity,
 * a track with no landfall record at all -- gets NOTHING, and the deck renders the slot dash.
 * Printing NO there would publish a judgement the record does not contain: "this storm did not
 * reach Category 3" and "nobody recorded how strong this storm got" are different statements,
 * and the second one is not evidence of the first.
 *
 * A KEY IS ABSENT RATHER THAN FALSE for the undecidable case, which is what makes the
 * distinction survive: `reached[key] === true` is REACHED, `=== false` is NO, and `undefined`
 * is the slot. A default of false anywhere in this function would quietly convert every
 * unrecorded storm into a failed one.
 */
export function subjectVerdicts(storm) {
  if (!storm) return null;
  const out = {};

  /* INTENSITY. The ladder is ordered, so reaching cat4 means reaching everything below it --
     the same monotonic reading the archive's own thresholds carry. An unrecorded peak leaves
     EVERY intensity contract undecided rather than defaulting them to NO. */
  const peak = storm.max_category;
  const at = peak ? CATEGORY_ORDER.indexOf(peak) : -1;
  if (at >= 0) {
    for (const cat of CATEGORY_ORDER) {
      if (cat === "td") continue;
      const key = intensityContractKey(cat);
      if (key) out[key] = at >= CATEGORY_ORDER.indexOf(cat);
    }
  }

  /* LANDFALL. `storm.landfalls` is the archive's own detection, so an empty array is a real
     answer -- this storm came ashore nowhere the archive recognises -- while a missing array is
     no answer at all. Only the first case may produce a NO. */
  if (Array.isArray(storm.landfalls)) {
    const byRegion = new Map();
    for (const l of storm.landfalls) {
      if (!l || !l.region) continue;
      const seen = byRegion.get(l.region) || { any: false, hurricane: false };
      seen.any = true;
      if (l.hurricane_at_landfall === true) seen.hurricane = true;
      byRegion.set(l.region, seen);
    }
    /* Regions the deck will ask about are not known here, so every region the storm touched is
       answered TRUE and the deck's own rows supply the FALSE for the rest -- see below. */
    for (const [region, seen] of byRegion) {
      out[landfallContractKey(region, "any")] = seen.any;
      out[landfallContractKey(region, "hurricane")] = seen.hurricane;
    }
    out.__landfallsKnown = true;
  }
  return out;
}

/* The deck asks about regions this storm may never have touched, and an absent key would render
   a slot where the archive has a real NO. Given a known landfall record, any region not in it is
   a genuine "did not come ashore here" -- so the deck fills the gap at read time rather than
   this function enumerating every region the archive has. */
export function subjectReached(subject, contractKey) {
  if (!subject || !subject.reached) return undefined;
  const v = subject.reached[contractKey];
  if (v !== undefined) return v;
  if (subject.reached.__landfallsKnown && /^landfall_/.test(contractKey)) return false;
  return undefined;
}

/* ── THE TABLE'S FOOT ──────────────────────────────────────────────────────────────────────
 *
 * TWO BLOCKS THAT THE DELETED PANEL CARRIED AND THE DECK MUST NOT LOSE.
 *
 * The redesign folds thirteen comparison CARDS into one column of signed percentage points, and
 * that is the intended trade: the per-row question "by how much" is answered in the cell, and
 * "do the samples separate" is answered by the STATUS word. But two things a card carried are
 * not per-row at all, and deleting cohort-panel.jsx deleted them with it:
 *
 *   WHAT IS THE BASELINE   every "+5.1 pp" on this page is relative to something, and a reader
 *                          must not be able to scroll into a column of deltas without having
 *                          passed the sentence that names what they are deltas FROM.
 *   HOW ARE THE TWO POPULATIONS RELATED  the baseline CONTAINS the cohort, so the same storms
 *                          are on both sides and the two rates are not independent estimates.
 *                          engine/compare.js measures the relation and writes the sentence; the
 *                          surface's only job is to print it where the deltas are.
 *
 * Both are stated once, in the foot, because both are facts about the whole table. The HOLD OUT
 * control comes with them -- "what if I had not restricted the season" is one click rather than
 * a re-entry, and it is the control that makes the baseline a choice rather than a default. */
function DeckFoot({ comparison, conditions, onBaseline, whatChanged, groups,
  citation, citationUrl, onSeal = null }) {
  const c = comparison;
  return (
    <div className="at-deck-foot-block" data-deck-foot>
      {/* WHAT CHANGED, AND WHAT IT IS NOT. Written to the specification's bound -- the edit, the
          population delta, and at most two rate deltas -- and labelled in as many words as
          A READING AID, NOT AN ATTRIBUTION. */}
      <WhatChanged edit={whatChanged ? whatChanged.edit : null}
        deltas={c ? topDeltas(groups) : []} />
      {c ? (
        <Baseline c={c} conditions={conditions} onBaseline={onBaseline} groups={groups} />
      ) : null}

      {/* CITE THIS COHORT — THE THIRD THING THE PANEL CARRIED AND THE DECK HAD DROPPED.
          It closes the answer rather than opening it, which is where the deleted panel put it
          and for the reason it gave: a reader cites a result AFTER reading it, and five lines of
          stamps above the table push the first outcome rate off a 1280 viewport. It computes
          nothing and asserts nothing the conditions have not already applied -- its whole point
          is that the analyst it is sent to opens the identical cohort. `citation` went on being
          computed in atlas.jsx after cohort-panel.jsx was deleted, with nothing consuming it:
          a live wire ending in air, which is exactly how a provenance surface disappears
          without a single gate going red. */}
      {citation ? (
        <div className="at-deck-cite" data-cohort-citation>
          <span className="at-foot-k">CITE THIS COHORT</span>
          <CohortSpec text={citation} url={citationUrl} />
          {/* THE STRONGER CITATION IS ONE PRESS AWAY, AND SAID TO BE. This line reopens the same
              question; a seal also proves, to whoever opens it, that the storms are the same. */}
          {onSeal ? (
            <p className="at-deck-cite-seal">
              This line reopens the question. A <b>sealed</b> link also tells whoever opens it
              whether the archive still gives the same storms, and fixes every figure.{" "}
              <button type="button" className="at-say-link" onClick={onSeal}>SEAL THIS READING →</button>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* AT MOST TWO, AND THE ENGINE WRITES BOTH OF THEM.
 *
 * `delta.statement` is compare.js's own sentence -- the magnitude, the direction word, and which
 * of the two permitted interval readings applies -- and it is printed verbatim. What this adds
 * is the row's name and the baseline RATE, because a statement that says "5.1 points higher"
 * without saying higher than what is the exact omission the baseline block exists to prevent.
 *
 * Ordered by magnitude rather than by ladder position: two lines is the whole budget, so they
 * go to the two rows where the cohort and its baseline differ most. */
function topDeltas(groups) {
  const out = [];
  for (const g of groups) {
    for (const row of g.rows) {
      const d = row.delta;
      if (!d || d.baseRate === null || d.deltaPp === null || !d.statement) continue;
      out.push({ label: row.label, d });
    }
  }
  out.sort((a, b) => Math.abs(b.d.deltaPp) - Math.abs(a.d.deltaPp));
  return out.slice(0, 2).map(({ label, d }) =>
    `${label} — baseline ${(100 * d.baseRate).toFixed(1)}%, ${d.statement}`);
}

/* THE BASELINE, ABOVE NOTHING AND BELOW EVERYTHING IT QUALIFIES.
 *
 * In the panel this block sat above the cards, on the reasoning that a reader must not reach a
 * "+5.1 points" without having passed the sentence naming what it is relative to. In the deck
 * the deltas are a COLUMN, and a block above the table is a block between the question and the
 * evidence -- so it moves to the foot, and the column head carries the short form. The words are
 * the same words and the relation note is still the engine's. */
function Baseline({ c, conditions, onBaseline, groups }) {
  const b = c.baseline;
  const comparable = groups.some((g) => g.rows.some(
    (row) => row.delta && row.delta.deltaPp !== null));
  return (
    <div className="at-deck-baseline" data-baseline>
      <span className="at-foot-k">COMPARED WITH</span>
      <p className="at-foot-line">
        {c.changed
          ? <>the same cohort without <strong>{c.changed.noun}</strong></>
          : baselineSentence(null)}
      </p>
      <p className="at-foot-fig">
        {b.n_cases.toLocaleString()} storms · effective sample{" "}
        {Math.round(b.effective_sample_size).toLocaleString()}
        {" · "}{b.sufficient ? "SUFFICIENT" : `BELOW SAMPLE · ${b.n_cases} < ${b.min_sample}`}
      </p>
      {/* THE NOTE POINTS AT A COMPARISON, AND SOMETIMES THERE IS NONE. compareResults returns an
          object even when every contract short-circuits, so on a below-gate cohort the block
          would promise a comparison over a ladder in which every rung is refused. The engine's
          words are unchanged; what is added is the state they were written without. */}
      {!comparable ? (
        <p className="at-foot-none" data-no-comparison>
          ⊘ NO CONTRACT IN THIS COHORT HAS A RATE TO COMPARE — every one of them is refused
          above, so there is no delta on this page. The baseline&rsquo;s own figures stand.
        </p>
      ) : null}
      <p className="at-foot-note">{c.relation.note}</p>
      {/* THE KEY THE STATUS WORDS PROMISED. The header of this file says the sentence behind
          SUPPORTED and MIXED is "still printed in the deck's key"; it was printed nowhere. */}
      <p className="at-foot-note" data-status-key>
        <b>SUPPORTED</b> — the two 95% intervals do not overlap: the samples separate the rates.{" "}
        <b>MIXED</b> — they overlap: the samples do not separate them. Neither is a test.
      </p>

      {conditions && conditions.length > 1 ? (
        <div className="at-foot-holdout">
          <span className="at-foot-k">HOLD OUT</span>
          {conditions.map((cond) => (
            <Chip key={cond.key} chipKey={`baseline-${cond.key}`}
              active={!!(c.changed && c.changed.key === cond.key)}
              onClick={() => onBaseline && onBaseline(cond.key)}>{cond.label}</Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
