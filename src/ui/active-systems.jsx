/* THE ACTIVE SYSTEM LAUNCHER — a live storm, and the historical question it can open.
 *
 * WHAT THIS FIXES. Opening the archive on a current storm meant reading a coordinate off an
 * advisory and typing it into a map. That worked, and it quietly asked the wrong question. An
 * advisory's LOCATION line is where the storm is NOW; every rate this archive publishes is
 * conditioned on where storms FORMED. For a system named an hour ago the two are within 50 km
 * of each other and the answer looks right. Two days later they are 900 km apart and the same
 * habit produces a cohort with nothing to do with the storm — under a sentence that says it has.
 *
 * MEASURED ON EP172026, the first system this shipped against:
 *
 *   DERIVED GENESIS   14.5N 105.1W   first TROPICAL fix, 20 Sep 18:00Z, TD    ->  110 storms
 *   CURRENT POSITION  15.1N 104.8W   latest fix, 21 Sep 00:00Z, TS 35 kt      ->  116 storms
 *   B-DECK FIRST FIX   7.0N 102.7W   the invest, 17 Sep 12:00Z, DB            ->    3 storms
 *
 * The third row is why this component exists rather than a two-line handler. The b-deck carries
 * the disturbance history, so a launcher that reached for `fixes[0]` — the obvious, wrong,
 * reading of "where it started" — would open a three-storm cohort, refuse every contract in it,
 * and give no hint that it had answered a different question. `scripts/test-atlas-live-bridge.mjs`
 * pins that distance and that cohort count so the trap cannot be walked into again.
 *
 * THE GENESIS THIS USES IS THE ARCHIVE'S OWN RULE, replayed over operational fixes by
 * `operationalLifecycle` (engine/live.js) — genesis is the FIRST TROPICAL FIX by the archive's
 * own status vocabulary, transcribed from build_atlas_pack.py. It is therefore marked derived,
 * with the same `·d` this repository uses everywhere else, because ATCF publishes a stage and
 * not a genesis and pretending otherwise would be inventing a column.
 *
 * AND IT REFUSES RATHER THAN GUESSES. A system with no tropical fix — an invest under a b-deck,
 * which NHC tracks and this artifact carries — has no derived genesis at all. There is a
 * position in the record and it is the wrong one, so the row publishes no launch and says why.
 * That is the invest-origin trap as a product state rather than as a silent number.
 *
 * NOTHING OPERATIONAL CROSSES INTO THE HISTORICAL ANSWER. This component imports no engine
 * module. Every value it renders is handed to it by the shell — the one place the join is
 * allowed to happen (ATLAS-LIVE.md §5) — as plain numbers, and the only thing it ever sends
 * back is a latitude, a longitude and a radius.
 */

import React from "react";

import { Drv, Head, Note, fmtUTC } from "./kit.jsx";

const DEG = (lat, lon) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
};

/* A LABELLED READING, NOT A LEADER-DOT ROW.
 *
 * `Row` sets a short label against a right-aligned figure across a leader, which is the right
 * shape for `peak wind ......... 115 kt` and the wrong one for a position. A position is three
 * facts -- where, when, what stage -- and forcing them into one right-aligned cell inside a
 * 320 px sheet crushed the label to `DERIVED GEN...` and pushed the stage off the edge. The
 * label then said nothing and the value was incomplete, which between them is every failure
 * this surface's typography exists to avoid.
 *
 * So the label gets its own line with its qualification beside it, and the reading sits under it
 * in mono at full width. It wraps instead of truncating, and the qualification -- THE COHORT IS
 * KEYED HERE / NOT USED FOR MATCHING -- travels with the label rather than being a tooltip,
 * because which of the two points the population is keyed to is the entire point of the block.
 */
function Reading({ label, qualifier, value, derived, dim, title }) {
  return (
    <div className={dim ? "at-live-rd at-live-rd-dim" : "at-live-rd"} title={title}>
      <div className="at-live-rd-k">
        <span>{label}{derived ? <Drv title={derived} /> : null}</span>
        {qualifier ? <em>{qualifier}</em> : null}
      </div>
      <div className="at-live-rd-v">{value}</div>
    </div>
  );
}

/**
 * One tracked system, and the launch it can offer.
 *
 * @param {object} sys  shaped by the shell: { atcf_id, name, basin, stage_label, active, stale,
 *   latest: {lat, lon, kt, t, stage}, genesis: {lat, lon, t, stage}|null, separationKm,
 *   separationHours, firstFix: {lat, lon, t, stage}, ageHours, cohortRadiusKm, drops: [] }
 */
function System({ sys, onLaunch, current }) {
  const g = sys.genesis;
  const l = sys.latest;
  const kt = l.kt === null || l.kt === undefined ? "\u2014" : `${l.kt} kt`;

  return (
    <div className="at-live-row" data-active-system={sys.atcf_id}>
      <div className="at-live-id">
        <span className="at-live-name">{sys.name}</span>
        <span className="at-live-meta">
          {sys.atcf_id} · {sys.basin} · {sys.stage_label}
          {sys.stale ? <span className="at-live-stale"> · PAST FRESHNESS BOUND</span> : null}
        </span>
      </div>

      {/* BOTH POSITIONS, ALWAYS, AND THEIR SEPARATION.
          The reader is about to key a historical population to ONE of these two points. Printing
          only the one used would be correct and would still leave them unable to tell whether it
          mattered; printing only the current one is the mistake this whole component is here to
          stop. The separation is the number that says which of those two situations they are in. */}
      {g ? (
        <>
          <Reading
            label="DERIVED GENESIS" qualifier="THE COHORT IS KEYED HERE"
            derived="genesis is the FIRST TROPICAL FIX, by the archive's own status vocabulary,
                     replayed over the operational fixes. ATCF publishes a stage, not a genesis."
            title="The archive matches cohorts on where a storm FORMED. This is that point."
            value={`${DEG(g.lat, g.lon)} · ${fmtUTC(g.t)} · ${g.stage}`} />
          <Reading
            label="LATEST FIX" qualifier="NOT USED FOR MATCHING" dim
            title="Where the storm is now, from the operational best track. No cohort is ever
                   built from it."
            value={`${DEG(l.lat, l.lon)} · ${fmtUTC(l.t)} · ${kt}`} />
          <Reading
            label="SEPARATION" dim
            title="How far the storm has travelled since it formed. The larger this is, the more
                   a coordinate read off the latest advisory would have misdirected the query."
            value={`${Math.round(sys.separationKm)} km in ${
              Math.round(sys.separationHours)} h since genesis`} />

          {current ? (
            <Note style={{ marginTop: 7 }} hook="data-launch-current">
              <b>This cohort is already keyed to this system&rsquo;s derived genesis.</b>
            </Note>
          ) : (
            <>
              {/* WHAT THE CLICK THROWS AWAY, BEFORE IT IS CLICKED. A launch is a CLEAN question,
                  so the reader's outcome-side conditions do not survive it — and a gesture that
                  dropped them silently would be no better than one that kept them silently. */}
              {sys.drops.length ? (
                <Note style={{ marginTop: 7 }} hook="data-launch-drops">
                  A clean launch <b>discards</b> every condition now set —{" "}
                  <b>{sys.drops.map((d) => d.value).join(", ")}</b> — and asks only what the
                  archive says about storms that formed near this point. Your radius of{" "}
                  <b>{sys.cohortRadiusKm} km</b> is kept: it is the aperture of the question, not
                  a condition on the storms.
                </Note>
              ) : (
                <Note style={{ marginTop: 7 }} hook="data-launch-drops">
                  Opens a clean genesis-conditioned cohort at your radius of{" "}
                  <b>{sys.cohortRadiusKm} km</b>. No other condition is set or carried.
                </Note>
              )}
              <button type="button" className="at-tbtn at-wide at-live-go"
                data-launch-system={sys.atcf_id}
                onClick={() => onLaunch(sys)}
                style={{ marginTop: 8, width: "100%" }}>
                BUILD CLEAN COHORT AROUND DERIVED GENESIS →
              </button>
            </>
          )}
        </>
      ) : (
        /* NO TROPICAL FIX, NO GENESIS, NO LAUNCH. The record holds a position and it is the
           invest's, not the storm's. Offering it would be the 3-storm cohort. */
        <>
          <Reading label="DERIVED GENESIS" qualifier="NONE" dim
            value="— this system has no tropical fix" />
          <Reading label="LATEST FIX" dim
            value={`${DEG(l.lat, l.lon)} · ${fmtUTC(l.t)}`} />
          <Note style={{ marginTop: 7 }} hook="data-launch-refused">
            <b>NO LAUNCH — THIS SYSTEM HAS NOT FORMED.</b> Its record begins as a disturbance and
            holds no tropical fix, so it has no genesis under the archive&rsquo;s own rule. The
            first position in the record is the disturbance&rsquo;s, {Math.round(sys.separationKm)}{" "}
            km from where the system is now; keying a cohort to it would answer a question about
            a different stretch of ocean.
          </Note>
        </>
      )}
    </div>
  );
}

/**
 * The block. Renders nothing at all when the operational layer is absent or empty — the archive
 * is complete without it and must not grow a hole where it would have been.
 */
export function ActiveSystems({ systems, generatedAt, onLaunch, currentId }) {
  if (!systems || !systems.length) return null;
  return (
    <div data-active-systems>
      <Head right={`${systems.length} tracked · ${
        generatedAt ? `${fmtUTC(Date.parse(generatedAt))}` : "vintage unknown"}`}>
        ACTIVE SYSTEMS
      </Head>
      {/* THE SCOPE, SAID ONCE, ABOVE EVERY LAUNCH IT APPLIES TO. The reader is one click from a
          population that contains none of the storms named here. */}
      <Note hook="data-active-systems-scope">
        These are <b>operational</b> records — NHC&rsquo;s ATCF best track, revised while the
        storm is live, not post-analysed. Launching one builds a cohort from the{" "}
        <b>historical archive</b>: IBTrACS storms, matched on the archive&rsquo;s own genesis
        rule. <b>No operational value enters that cohort</b>, and the system named here is not
        one of its members.
      </Note>
      {systems.map((sys) => (
        <System key={sys.atcf_id} sys={sys} onLaunch={onLaunch}
          current={currentId === sys.atcf_id} />
      ))}
    </div>
  );
}
