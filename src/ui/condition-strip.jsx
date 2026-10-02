/* THE QUERY, AS THE SENTENCE ITSELF — the question and the one line that sizes it.
 *
 * WHAT THIS REPLACES, AND WHY THE STRIP HAD TO GO. The query used to be three labelled zones in a
 * 38px band under the question:
 *
 *     GENESIS-SIDE  no condition on where or when these storms formed
 *     OUTCOME-SIDE  no condition on what they went on to do
 *     SCOPE         the archive's default record scope
 *
 * Everything that band said was true, and a reader still had to assemble the question out of two
 * surfaces: a sentence at the top that did not mention either side, and three headings below it
 * that named the sides in a vocabulary the sentence never used. `5c` collapses the two into one:
 * the unset sides are written INTO the sentence as clauses, and each clause is the control that
 * sets it. The sentence reads as English before any condition exists, and there is exactly one
 * place a reader looks to learn what is being asked.
 *
 * THE BOUNDARY IS STILL THE THING THIS FILE EXISTS TO CARRY, and it is carried twice.
 *
 *   IN THE GRAMMAR.  Genesis-side conditions are inside a `formed …` clause; outcome-side ones
 *                    follow `that …` or `given that they also …`. Which side a condition sits on
 *                    is a fact about the sentence, and engine/cohort-language.js is where the
 *                    grammar that guarantees it lives.
 *   IN THE INK.      A set genesis clause is ruled in the accent; a set outcome clause is ruled
 *                    in the flag ink, because an outcome-side condition COSTS a row -- a cohort
 *                    defined by "reached Cat 4" cannot report a Category 4 rate, since every
 *                    member has one by construction. An unset clause is ruled with a dotted
 *                    neutral: it is an invitation, not a condition.
 *
 * scripts/check-condition-strip.mjs asserts both, with the prose covered for the second: a reader
 * scanning a sentence reads its shapes before its words, and a boundary that only exists once you
 * have parsed a subordinate clause is a boundary that is late.
 *
 * THE COHORT LINE IS THE ONE PRIMARY HOME FOR THE POPULATION. `3,885 of 3,959 archive storms ·
 * SUFFICIENT · MIN 10`, in one neutral mono voice, immediately under the question it is the
 * denominator of. It is not repeated as a headline anywhere else on the surface -- the deck's
 * preamble used to print the same count at the figure token, and two 3,885s on one screen make a
 * reader look for the difference between them.
 */

import React from "react";

/* The three zones, in reading order, with what each would hold when it holds nothing. The
   placeholder is not filler: it is the only thing standing between an unasked question and a
   reader who cannot tell one from an unanswerable one. `empty` is the title on the control;
   the sentence carries its own words, from the engine. */
export const ZONES = [
  { key: "given", label: "GENESIS-SIDE", rule: "accent",
    empty: "no condition on where or when these storms formed" },
  { key: "outcome", label: "OUTCOME-SIDE", rule: "muted",
    empty: "no condition on what they went on to do" },
  { key: "scope", label: "SCOPE", rule: "hair",
    empty: "the archive's default record scope" },
];

const ZONE_BY_KEY = new Map(ZONES.map((z) => [z.key, z]));

/**
 * The research question, as one typeset sentence whose clauses are the query's controls.
 *
 * @param {Array}  props.segments   engine/cohort-language.js questionSegmentsOf(spec)
 * @param {func}   [props.onEdit]   opens the builder sheet for one zone
 * @param {func}   [props.onClear]  removes one condition by key
 */
export function QuestionSentence({ segments = [], onEdit, onClear }) {
  return (
    /* NOT TRUNCATED AND NOT ELLIPSISED. At 30px the question is the largest thing on the surface
       and it is allowed the two or three lines it needs; what it must never do is take its
       height from the plate, which is why the head row is `auto` and the plate row is the
       elastic one. The whole sentence is also the element's title, so a gate and a hover both
       find the text even in the states where a clause wraps. */
    /* THE QUESTION IS THE PAGE'S HEADING. It was a paragraph, and the surface had no h1 at all:
       a screen reader's heading list was empty on the one page whose whole subject is this
       sentence. */
    <h1 className="at-question-text" data-question
      title={segments.map((s) => s.text).join("")}>
      {segments.map((seg, i) => {
        if (!seg.zone) return <span key={i}>{seg.text}</span>;
        return (
          <Clause key={i} seg={seg} onEdit={onEdit} onClear={onClear} />
        );
      })}
    </h1>
  );
}

/* ONE CLAUSE, WHICH IS EITHER A CONDITION OR THE INVITATION TO SET ONE.
 *
 * A REAL BUTTON, NOT A SPAN WITH A HANDLER, so it is in the tab order, answers Enter and Space,
 * and gets the focus ring the surface already draws. It is `display:inline` so it wraps with the
 * sentence rather than sitting in it as a box -- a clause that cannot break across a line turns
 * a 30px question into a horizontal scroll at 768.
 *
 * THE REMOVAL RIDES WITH THE CLAUSE THAT CARRIES THE CONDITION. It is a sibling rather than a
 * child, because a × inside the button that opens the editor would make removing one condition a
 * coin flip against editing it -- which is the same rule the strip's zones were built on. */
function Clause({ seg, onEdit, onClear }) {
  const zone = ZONE_BY_KEY.get(seg.zone) || ZONES[0];
  const set = !!seg.key;
  /* THE EDITOR OPENS ON THE CLAUSE THAT ASKED FOR IT. The element is handed up so the sheet can
     anchor itself under the words it edits -- a map-independent control belongs to the question,
     not to the plate, and an editor that opens in a fixed corner makes the reader find the
     connection between what they pressed and what appeared. */
  const open = onEdit ? (e) => onEdit(seg.zone, e.currentTarget) : undefined;
  return (
    /* THE CLAUSE AND ITS × BREAK TOGETHER. Both are buttons -- atomic boxes a line may break
       between -- and a × wrapped alone to the next line read as a stray mark before the dash. */
    <span className="at-clause-pair">
      <button type="button"
        className={`at-clause at-zone at-zone-${zone.rule}${set ? "" : " at-zone-empty"}`}
        data-zone={seg.zone} data-zone-edit={seg.zone}
        data-zone-empty={set ? undefined : ""}
        data-condition={set ? seg.key : undefined}
        data-condition-zone={set ? seg.zone : undefined}
        data-zone-hint={set ? undefined : ""}
        onClick={open}
        title={set ? `edit the ${zone.label.toLowerCase()} condition — ${seg.text}`
          : `set a ${zone.label.toLowerCase()} condition — ${zone.empty}`}>
        {seg.text}
      </button>
      {/* THE × IS DRAWN, NOT WRITTEN, AND THAT IS NOT A STYLE CHOICE.
          `[data-question]`'s text IS the question -- it is what the citation quotes, what a gate
          reads and what a screen reader announces -- and a removal control inside the sentence
          put its glyph in all three: "formed within 800 km of 12.0°N 105.0°W×, in seasons from
          1971 onwards×". The mark is a CSS pseudo-element, so it is painted and clickable and is
          in neither `textContent` nor `innerText`; the control keeps its own accessible name,
          which says what it removes rather than saying "×". */}
      {set && onClear ? (
        <button type="button" className="at-clause-x" data-condition-clear={seg.key}
          onClick={() => onClear(seg.key)} title={`remove: ${seg.text}`}
          aria-label={`remove condition ${seg.text}`} />
      ) : null}
    </span>
  );
}

/**
 * The cohort, its sufficiency and its scope — one line, one voice, directly under the question.
 *
 * ONE TYPOGRAPHIC WEIGHT UNLESS THE COHORT IS THE FINDING. The count is the denominator of every
 * rate below and it is stated once, quietly. `SUFFICIENT` and `BELOW SAMPLE` are the same size as
 * the rest of the line and differ only in ink, because whether the sample clears the gate is a
 * fact about the cohort, not a headline about it -- and BELOW SAMPLE is the one state where the
 * cohort IS the finding, which is exactly when the ink change earns its keep.
 *
 * @param {number}  props.kept        storms in the cohort
 * @param {number}  props.total       storms in the archive
 * @param {boolean} props.sufficient  whether the cohort clears the sample gate
 * @param {number}  props.minSample   the gate itself
 * @param {Array}   props.conditions  conditionsOf(spec) — only to know whether RESET applies
 * @param {Array}   [props.scope]     the scope-zone conditions, for the scope control's words
 */
export function CohortLine({ kept, total, sufficient, minSample, conditions = [], scope = [],
  lastEdit = null, onEdit, onReset, add = null, children }) {
  const narrowed = total !== undefined && total !== null && kept !== total;
  const scopeWords = scope.length
    ? scope.map((c) => c.value || c.sentence).join(" · ")
    : "archive default";
  return (
    <div className="at-cohort" data-cohort-line>
      <span className="at-cohort-n">
        <em data-cohort-size>{kept.toLocaleString()}</em>
        {narrowed ? <> of {total.toLocaleString()} archive storms</> : <> archive storms</>}
        {" · "}
        <b className={sufficient ? "at-cohort-ok" : "at-cohort-no"}>
          {sufficient ? "SUFFICIENT" : "BELOW SAMPLE"}
        </b>
        <span className="at-cohort-min"> · MIN {minSample}</span>
      </span>

      {/* SCOPE IS NEITHER OF THE OTHER TWO SIDES, AND IT IS NOT IN THE SENTENCE'S HEAD.
          Named-only and provisional-season handling change WHICH RECORDS ARE ELIGIBLE, not which
          storms qualify — they are properties of the archive being consulted rather than of the
          question being asked. So the third zone lives here, on the line that says how big the
          record is, where it qualifies the count rather than the question. */}
      <button type="button"
        className={`at-zone at-zone-hair at-cohort-scope${scope.length ? "" : " at-zone-empty"}`}
        data-zone="scope" data-zone-edit="scope"
        data-zone-empty={scope.length ? undefined : ""}
        data-zone-hint={scope.length ? undefined : ""}
        onClick={onEdit ? (e) => onEdit("scope", e.currentTarget) : undefined}
        title={`edit the record scope — ${scope.length ? scopeWords : ZONE_BY_KEY.get("scope").empty}`}>
        scope · {scopeWords}
      </button>

      <LastEdit lastEdit={lastEdit} />

      {/* THE CONDITIONS STILL TO ADD SHARE THIS LINE. They were a row of their own under it --
          thirty pixels of the first screen spent on a row the count line had room for. */}
      {add}

      <span className="at-cohort-acts">
        {children}
        {/* RESET QUERY — ONE OF THREE WAYS OUT, AND THE ONLY ONE THAT TOUCHES THE QUESTION.
            It clears the conditions and nothing else: not the camera, not the selection's
            history, not the layers. Present only with something to clear, because a permanent
            RESET on an unqueried archive is a control that does nothing, and a control that does
            nothing teaches a reader to ignore the row it lives on. */}
        {conditions.length && onReset ? (
          <button type="button" className="at-strip-reset" data-reset-query onClick={onReset}
            title={`clear ${conditions.length === 1 ? "this condition" : `all ${conditions.length} conditions`} — the camera and the selection are not touched`}>
            RESET QUERY
          </button>
        ) : null}
      </span>
    </div>
  );
}

/* THE CONDITIONS A READER CAN STILL ADD, NAMED AS WHAT THEY ASK.
 *
 * "+ condition" was one control that opened the editor at the genesis side; everything else the
 * archive can be asked -- months, basin, ever-entered, peak intensity, landfall, record scope --
 * was reachable only by knowing that a clause of the sentence opens an editor with six sections.
 * Each is named here, on the line under the question, and opens the editor AT its own section.
 * A condition already set is not offered again: its clause in the sentence is its control.
 * Outcome-side conditions carry the flag ink, because each one costs the ledger a row. */
const ADDABLE = [
  { section: "where", zone: "given", label: "where it formed", set: (s) => !!s.where },
  { section: "season", zone: "given", label: "seasons", set: (s) => s.seasonFrom !== null || s.seasonTo !== null },
  { section: "months", zone: "given", label: "months", set: (s) => !!(s.months && s.months.length) },
  { section: "basin", zone: "given", label: "basin", set: (s) => !!(s.basins && s.basins.length) },
  { section: "entered", zone: "given", label: "ever entered", set: (s) => !!(s.subbasinsEntered && s.subbasinsEntered.length) },
  { section: "intensity", zone: "outcome", label: "peak intensity", set: (s) => s.intensity && s.intensity !== "all" },
  { section: "landfall", zone: "outcome", label: "landfall", set: (s) => !!s.landfall },
  /* No "+ record scope": the cohort line's own "scope · …" control is that condition, one
     inch to the left, and two controls for one thing is one too many. */
];

export function AddConditions({ spec, onEdit }) {
  if (!onEdit || !spec) return null;
  const open = ADDABLE.filter((a) => !a.set(spec));
  if (!open.length) return null;
  return (
    <div className="at-addc" data-add-conditions role="group" aria-label="add a condition">
      <span className="at-addc-k">ADD</span>
      {open.map((a) => (
        <button type="button" key={a.section} className={`at-addc-b at-addc-${a.zone}`}
          data-add-condition={a.section}
          onClick={(e) => onEdit(a.zone, e.currentTarget, a.section)}
          title={a.zone === "outcome"
            ? `condition on ${a.label} — an outcome-side condition: the ledger stops reporting it as an outcome`
            : `condition on ${a.label}`}>
          + {a.label}
        </button>
      ))}
    </div>
  );
}

/* WHAT THE LAST EDIT COST, IN POPULATION. One number to one number, and nothing else: it is an
   orientation aid, not a history, and it is cleared by the next edit rather than accumulated
   into a panel nobody reads. */
function LastEdit({ lastEdit }) {
  if (!lastEdit || lastEdit.from === null || lastEdit.to === null) return null;
  return (
    <span className="at-lastedit" data-last-edit>
      <span className="at-lastedit-k">LAST EDIT</span>
      <span className="at-lastedit-v">
        {lastEdit.from === lastEdit.to
          ? <>no storm changed · {lastEdit.to.toLocaleString()}</>
          : <>{lastEdit.from.toLocaleString()} → {lastEdit.to.toLocaleString()}</>}
      </span>
    </span>
  );
}

/**
 * The question and its cohort line, as the one head of the instrument.
 *
 * `data-condition-strip` survives the rewrite deliberately: it is the hook every gate that asks
 * "where is the query on this surface" reads, and the answer is still one element — it is simply
 * a sentence now rather than a band of zones.
 */
export function QueryHead({ segments, conditions = [], scope = [], kept, total,
  sufficient, minSample, lastEdit = null, onEdit, onClear, onReset, notice = null,
  spec = null, children }) {
  return (
    <div className="at-head" data-condition-strip>
      {notice}
      <QuestionSentence segments={segments} onEdit={onEdit} onClear={onClear} />
      <CohortLine kept={kept} total={total} sufficient={sufficient} minSample={minSample}
        conditions={conditions} scope={scope} lastEdit={lastEdit}
        onEdit={onEdit} onReset={onReset} add={<AddConditions spec={spec} onEdit={onEdit} />}>
        {children}
      </CohortLine>
    </div>
  );
}

/* WHAT CHANGED — two to three lines at the deck's foot, and never more.
 *
 * LABELLED A READING AID, NOT AN ATTRIBUTION, in as many words. The distinction is the whole
 * reason the block is allowed to exist: "the Cat 3 rate rose 11 points when you added this
 * condition" is a true statement about two numbers and NOT a statement that the condition caused
 * the rise. Cohorts are not experiments, nothing here is randomised, and a surface that let a
 * delta read as an effect would be publishing causal language the archive cannot support.
 *
 * Cleared on the next edit. Never accumulated into a history panel -- a running list of deltas
 * is a narrative, and a narrative is exactly the thing this label is denying. */
export function WhatChanged({ edit, deltas = [] }) {
  if (!edit) return null;
  const shown = deltas.slice(0, 2);
  return (
    <div className="at-changed" data-what-changed>
      <span className="at-changed-label">A READING AID, NOT AN ATTRIBUTION</span>
      <span className="at-changed-line">{edit}</span>
      {shown.map((d, i) => <span className="at-changed-line" key={i}>{d}</span>)}
    </div>
  );
}
