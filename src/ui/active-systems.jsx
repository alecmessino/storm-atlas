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

const ageText = (h) => (!Number.isFinite(h) ? "age unknown"
  : h < 1 ? `${Math.max(0, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`);

/* THE WATCH'S STATES, AS THE WATCH NAMES THEM. Only the three that need a reader's eye get a
   mark on the top bar; QUIET is the absence of a mark, and INSUFFICIENT is a refusal that is
   printed inside the card with its reason rather than dressed up as a signal. */
const WATCH_CLASS = { ELEVATED: "lv-w-elev", DISAGREEMENT: "lv-w-dis", "EVIDENCE CASE": "lv-w-case" };

function WatchMark({ fc }) {
  const w = fc && fc.state === "ok" ? fc.watch : null;
  if (!w || !w.alerts.length) return null;
  const top = w.alerts[0];
  return (
    <span className={`lv-w ${WATCH_CLASS[top.state] || ""}`} data-live-watch={top.state}
      title={`${top.state} on ${top.label}${w.alerts.length > 1 ? ` and ${w.alerts.length - 1} more exposure(s)` : ""} — the disagreement watch's own verdict`}>
      {top.state}{w.alerts.length > 1 ? ` +${w.alerts.length - 1}` : ""}
    </span>
  );
}

/* FORECAST NOW, AND WHAT THE WATCH MADE OF IT.
 *
 * Everything here is CARRIED: the advisory as the capture first saw it, the guidance cycle the
 * watch evaluated, and the watch's own newest row per registered exposure, copied as written.
 * Nothing is computed in this file, nothing here enters the cohort, and a count of runs is never
 * turned into a chance. A missing watch is said to be missing -- never shown as QUIET. */
function ForecastNow({ fc }) {
  if (!fc || fc.state === "loading") {
    return <Note style={{ marginTop: 9 }} hook="data-live-forecast-loading">Reading the forecast file…</Note>;
  }
  if (fc.state !== "ok") {
    return (
      <Note style={{ marginTop: 9 }} hook="data-live-forecast-none">
        <b>NO FORECAST ON FILE.</b> {fc.error || "This system has no advisory in the capture's newest state."}{" "}
        The historical cohort is unaffected.
      </Note>
    );
  }
  const g = fc.guidance;
  const cyc = g.cycle ? `${g.cycle.slice(6, 8)}/${g.cycle.slice(8, 10)}Z` : "no cycle";
  const w = fc.watch;
  return (
    <div className="at-live-fc" data-live-forecast>
      <div className="at-live-fc-h"><span>FORECAST NOW</span><em>OPERATIONAL · CARRIED, NOT COMPUTED</em></div>
      <Reading label="NHC ADVISORY" qualifier={fc.firstSeen ? `FIRST SEEN ${fmtUTC(fc.firstSeen)}` : null}
        title="The forecast advisory (TCM) in force at the capture's newest instant, and when the capture first saw it."
        value={`#${fc.advisory} · issued ${fmtUTC(fc.issued)} · ${fc.points} forecast points`} />
      <Reading label="GUIDANCE" qualifier={g.missing.length ? `MISSING ${g.missing.join(", ")}` : "ALL FAMILIES"}
        dim={g.runs === 0}
        title="Family runs from the newest early-guidance cycle the capture had first seen. An absent family stays absent: an older cycle is never substituted."
        value={`${g.runs} of ${g.families} families · ${cyc} cycle · ${Number.isFinite(g.ageH) ? `${g.ageH} h` : "—"} old at capture`} />
      <Reading label="CONE" dim
        value={fc.cone ? `${fc.cone.kind === "OFFICIAL_GIS" ? "NHC's own GIS polygon" : fc.cone.kind} · adv ${fc.cone.advisory}${fc.cone.matches === false ? " · NOT THIS ADVISORY" : ""}` : "none on file"} />

      <div className="at-live-fc-h at-live-fc-wh"><span>DISAGREEMENT WATCH</span>
        <em>{w ? `${w.engine} · as of ${fmtUTC(w.asOf)}` : "—"}</em></div>
      {!fc.watchSupplied ? (
        <Note hook="data-live-watch-absent"><b>THE WATCH WAS NOT SUPPLIED TO THIS FEED.</b> No verdict
          is shown, which is not the same as quiet.</Note>
      ) : !w ? (
        <Note hook="data-live-watch-absent">The watch has written no row for this system yet.</Note>
      ) : (
        <>
          {!w.current ? (
            <Note hook="data-live-watch-behind"><b>THE WATCH IS BEHIND THIS ADVISORY.</b> Its newest
              rows are from {fmtUTC(w.asOf)}; the advisory above is newer.</Note>
          ) : null}
          {w.alerts.map((a) => (
            <div key={a.id} className={`at-live-w ${WATCH_CLASS[a.state] || ""}`} data-live-watch-row={a.state}>
              <div className="at-live-w-k"><b>{a.state}</b><span>{a.label}</span><em>{a.kind}</em></div>
              {a.reasons.slice(0, 2).map((t, i) => <p key={i}>{t}</p>)}
            </div>
          ))}
          {w.refused.length ? (
            <div className="at-live-w at-live-w-ref" data-live-watch-row="INSUFFICIENT">
              <div className="at-live-w-k"><b>INSUFFICIENT</b><span>{w.refused.length} exposure{w.refused.length > 1 ? "s" : ""} — the watch refused to judge</span></div>
              {w.refused[0].reason ? <p>{w.refused[0].reason}</p> : null}
            </div>
          ) : null}
          {w.quiet.length ? (
            <div className="at-live-w-q" data-live-watch-row="QUIET" title={w.quiet.join(" · ")}>
              <b>QUIET</b> {w.quiet.length} of {w.quiet.length + w.alerts.length + w.refused.length} registered exposures
            </div>
          ) : null}
          <p className="at-live-w-foot">Registered exposures only, each row naming its provenance.
            Counts of runs, never probabilities.</p>
        </>
      )}
    </div>
  );
}

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
export function System({ sys, onLaunch, current }) {
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

          <ForecastNow fc={sys.fc} />

          {current ? (
            <Note style={{ marginTop: 7 }} hook="data-launch-current">
              <b>This cohort is already keyed to this system&rsquo;s derived genesis.</b>
              {sys.fc && sys.fc.state === "ok" ? (
                <>{" "}<button type="button" className="at-live-jump" data-live-jump
                  onClick={() => { const el = document.querySelector("[data-forward-row]");
                    if (el) el.scrollIntoView({ block: "start", behavior: "auto" }); }}>
                  ITS FORECAST AGAINST THIS COHORT ↓</button></>
              ) : null}
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
          <ForecastNow fc={sys.fc} />
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

/* THE LIVE STRIP — the same systems, at the top of the instrument instead of inside an editor.
 *
 * WHY IT MOVED. The launcher sat in the clause editor's sheet, under THE QUESTION and above the
 * condition stack -- the right place in the editor and the wrong place in the product: a reader
 * who came to the Atlas because a storm is on the water right now had to know that pressing a
 * clause of a sentence would reveal it. The strip names every tracked system on the top bar, and
 * pressing one opens exactly the card the editor held -- both positions, their separation, what
 * a clean launch discards -- so nothing it said is lost and nothing is launched without it.
 */
export function LiveStrip({ systems, generatedAt, onLaunch, currentId, feed = null }) {
  const [open, setOpen] = React.useState(null);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(null); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey, true); };
  }, [open]);
  if (!systems || !systems.length) return null;
  const sys = open ? systems.find((x) => x.atcf_id === open) : null;
  return (
    <div className="lv" data-live-strip ref={ref}>
      {/* LIVE IS A CLAIM ABOUT THE FEED, MEASURED ON THIS BROWSER'S CLOCK. Past the artifact's own
          freshness bound the word is replaced by the feed's age, so a file nobody has rewritten
          cannot keep a green LIVE over storms last read days ago. */}
      <span className={feed && feed.stale ? "lv-k lv-k-stale" : "lv-k"} data-live-feed={feed && feed.stale ? "stale" : "live"}
        title={`operational records read ${generatedAt ? fmtUTC(Date.parse(generatedAt)) : "at an unknown time"}${
          feed && Number.isFinite(feed.hours) ? ` · ${ageText(feed.hours)} ago by this browser's clock` : ""}`}>
        <i className={feed && feed.stale ? "lv-dot lv-dot-stale" : "lv-dot"} aria-hidden="true" />
        {feed && feed.stale ? `FEED ${ageText(feed.hours)} OLD` : "LIVE"}
      </span>
      {systems.map((x) => (
        <button type="button" key={x.atcf_id} className="lv-sys" data-live-system={x.atcf_id}
          aria-expanded={open === x.atcf_id ? "true" : "false"}
          aria-pressed={currentId === x.atcf_id ? "true" : "false"}
          onClick={() => {
            /* ONE PRESS, WHEN NOTHING IS LOST BY IT. With no condition set, a clean launch
               discards nothing, so the press both keys the cohort and opens the card. With
               conditions set, the card opens first and says what the launch would discard. */
            if (open !== x.atcf_id && x.genesis && !x.drops.length && currentId !== x.atcf_id) onLaunch(x);
            setOpen(open === x.atcf_id ? null : x.atcf_id);
          }}
          title={`${x.name} ${x.atcf_id} — ${x.stage_label}.${x.genesis && !x.drops.length ? " Keys the cohort to its derived genesis and opens its card." : " Open the launch card."}`}>
          <b>{x.name}</b>
          <span className="lv-meta">{x.atcf_id.slice(0, 4)} · {x.latest.kt === null || x.latest.kt === undefined ? "—" : `${x.latest.kt} kt`}</span>
          <WatchMark fc={x.fc} />
          {currentId === x.atcf_id ? <span className="lv-on">KEYED</span> : null}
        </button>
      ))}
      {sys ? (
        <div className="lv-pop" role="dialog" aria-label={`${sys.name} — launch a historical cohort`} data-live-card>
          <Note hook="data-active-systems-scope">
            An <b>operational</b> record — NHC&rsquo;s ATCF best track, revised while the storm is
            live. Launching builds a cohort from the <b>historical archive</b>; no operational
            value enters it, and this system is not one of its members.
          </Note>
          {feed && feed.stale ? (
            <Note hook="data-live-feed-stale">
              <b>THIS FEED IS {ageText(feed.hours).toUpperCase()} OLD.</b> Every operational value
              below was last read {generatedAt ? fmtUTC(Date.parse(generatedAt)) : "at an unknown time"}
              and has not been refreshed since.
            </Note>
          ) : null}
          <System sys={sys} current={currentId === sys.atcf_id}
            onLaunch={(s) => { onLaunch(s); }} />
        </div>
      ) : null}
    </div>
  );
}
