/* STORM ATLAS -- the shell.
 *
 * What the first ten seconds have to do, in order:
 *   1. Put the archive's scale on screen. The manifest is a few kilobytes and arrives first,
 *      so the counts are legible before the track block has finished downloading.
 *   2. Draw the population. Restrained by default -- one ink at low alpha, so the shape of
 *      where storms actually go emerges from overlap rather than from 3,959 competing lines.
 *   3. Make the question obvious. Clicking open water asks it; trajectories answer it on the
 *      map, not in a dialog.
 *
 * The map is the page. Everything else explains what is on it.
 */

import React from "react";
import { loadArchive } from "../engine/archive.js";
import { methodologyMoved } from "../engine/methodology.js";
import { fetchCoastlines, fetchContext } from "../engine/coastlines.js";
import { genesisDensity, getAnalogs, pathwayDensity } from "../engine/analogs.js";
import { brushMembers, buildCellIndex, cellAt, cellIndex, cornerOfCell, genesisMembers, keyOfCell,
  maskOf, pathwayMembers } from "../engine/cells.js";
import { filterStorms, genesisBounds, seasonRange } from "../engine/query.js";
import {
  EMPTY_COHORT, cohortResult, conditionsOf, normalise, parentOf, parseQuery, sameCohort,
  toQuery,
  droppedByCleanLaunch, genesisOnlySpec,
} from "../engine/cohort.js";
/* THE ATLAS'S OWN READING OF THE QUESTION. `openQuestion` writes the unset genesis and outcome
   sides out as clauses and `questionSegmentsOf` returns the same string in the pieces the
   sentence is pressable by -- the question line renders the segments and the citation quotes
   their join, so the sentence a reader presses and the one they would paste are the same
   characters. Every other consumer of a cohort sentence keeps the closed form. */
import { openQuestion, questionSegmentsOf } from "../engine/cohort-language.js";
import { projectWorld } from "../render/atlas-layer.js";
import { previewCounts } from "../engine/preview.js";
import { changedKeyOf, compareResults } from "../engine/compare.js";
import { bridgeSpec, contributionOf, whyMatched } from "../engine/cohort-membership.js";
import { envAtGenesis, envCoverage } from "../engine/env.js";
import { loadCalibration } from "../engine/calibration.js";
/* THE OPERATIONAL LAYER. Imported by the SHELL and by nothing that computes anything: the
   join happens here, between two objects neither of which knows about the other, and the
   result is handed to the inspector and the plate. scripts/test-atlas-live-boundary.mjs
   fails the build if any engine module that does historical research ever imports it. */
import {
  LIVE_OPERATIONAL, categoryLadder, liveStateFor, loadLive, operationalLifecycle,
  operationalView, shortfall, sourceDisagreement,
  atcfResolution,
  isNewerVintage, loadForecast, officialFromForecast,
} from "../engine/live.js";
/* THE HISTORICAL HALF OF THE FORWARD VIEW, and it is on this side of the wall. `forward.js`
   imports no operational module and has no parameter a forecast could arrive through: it takes
   an archive, a cohort and a list of `{ validMs, kt }` pairs. Which means the JOIN -- an
   advisory's points meeting a genesis-conditioned population -- happens here, in the shell, and
   nowhere else. */
import { MIN_SAMPLE as FORWARD_MIN_SAMPLE, alignToGenesis, forwardDistribution,
  thresholdTiming } from "../engine/forward.js";
import { AtlasMap } from "./map.jsx";
import { haversineKm } from "../engine/geo.js";
import { LiveStrip } from "./active-systems.jsx";
import { CohortBuilder } from "./cohort-builder.jsx";
import { StormPanel } from "./storm-panel.jsx";
import { EnvLens } from "./env-lens.jsx";
/* THE INSTRUMENT'S OWN PARTS. */
import { Colophon } from "./shell.jsx";
import { QueryHead } from "./condition-strip.jsx";
import { EvidenceRecord, buildGroups, subjectVerdicts } from "./evidence-deck.jsx";
import { Ledger } from "./ledger.jsx";
import { Roster } from "./roster.jsx";
import { SealPanel, ReadingsPanel, SealCheck } from "./seal.jsx";
import { fingerprintOf, shortFingerprint } from "../engine/seal.js";
import { Transport } from "./transport.jsx";
import { PickCard } from "./pick.jsx";
import { CATEGORY_COLOR, LANDFALL_INK } from "../render/palette.js";
import { MONO, Note, TextButton, claimText } from "./kit.jsx";

/* Split out of the entry chunk. The drawer is reached by a button or the P key, never on the
   path to a first paint or a first click, so its bytes should not be in the file that has to
   arrive before the map can draw. The panels are NOT split: they open on the first click, and
   a chunk fetch there would cost more than the bytes save. */
const ProvenanceDrawer = React.lazy(() =>
  import("./provenance.jsx").then((m) => ({ default: m.ProvenanceDrawer })));

/* The ledger is a whole second surface and most visits never open it, so it is split out too.
   Its own root element carries the grid class: React.Suspense emits no DOM node, so whatever
   the lazy component renders IS the grid child. */
const CalibrationLedger = React.lazy(() =>
  import("./calibration.jsx").then((m) => ({ default: m.CalibrationLedger })));

/* SPLIT OUT TOO, AND FOR THE SAME REASON WITH A SHARPER EDGE. The forward view renders only
   after a reader has asked for an official forecast, on a cohort keyed to a live system -- which
   is a minority of visits and never the first paint. Its plate is the largest single drawing on
   this surface after the map, and a chunk fetch that happens at the same moment as the payload
   read costs nothing a reader can perceive. */
const ForwardOutcome = React.lazy(() =>
  import("./forward-outcome.jsx").then((m) => ({ default: m.ForwardOutcome })));

const DATA_BASE = "data";

/* DOES A PUBLISHED LINE CROSS ONE 2° CELL?
 *
 * The archive counts a storm as passing through a cell when one of its fixes falls in it, and its
 * fixes are six-hourly. A forecast's points are twelve to twenty-four hours apart and would step
 * straight over a cell the line plainly crosses, so a forecast line is tested along its length
 * (straight in latitude and longitude between published points, sampled every 0.2°). Nothing is
 * weighted and nothing is turned into a chance: each line crosses or it does not. */
function lineCrossesCell(pts, c, step) {
  const inside = (la, lo) => {
    const w = ((((lo + 180) % 360) + 360) % 360) - 180;
    return la >= c.lat && la < c.lat + step && w >= c.lon && w < c.lon + step;
  };
  for (let i = 0; i < pts.length; i++) {
    if (inside(pts[i][0], pts[i][1])) return true;
    if (!i) continue;
    const [a0, b0] = pts[i - 1];
    const [a1, b1] = pts[i];
    const n = Math.ceil(Math.max(Math.abs(a1 - a0), Math.abs(b1 - b0)) / 0.2);
    for (let k = 1; k < n; k++) {
      if (inside(a0 + ((a1 - a0) * k) / n, b0 + ((b1 - b0) * k) / n)) return true;
    }
  }
  return false;
}
function liveInCell(ov, corner, step) {
  if (!ov || !corner) return null;
  return {
    name: ov.name || ov.atcf_id,
    advisory: ov.advisory,
    official: ov.official.length ? lineCrossesCell(ov.official.map((p) => [p.lat, p.lon]), corner, step) : null,
    runs: ov.runs.filter((r) => lineCrossesCell(r, corner, step)).length,
    runsOf: ov.runs.length,
    cycle: ov.cycle,
    best: ov.best.length ? lineCrossesCell(ov.best.map((f) => [f.lat, f.lon]), corner, step) : false,
  };
}

/* WHAT THE LIVE CARD PRINTS ABOUT A SYSTEM'S FORECAST AND THE WATCH, as plain values.
 *
 * The forecast layer is carried, not computed: every field here is copied from
 * atlas-forecast-v1.json, and every watch verdict is the watch's own row as the runner wrote it.
 * The only thing done here is sorting the rows into what needs a reader's eye (ELEVATED and
 * above), what the watch REFUSED to judge (INSUFFICIENT, with its reason), and what is quiet. */
const WATCH_ALERT = new Set(["ELEVATED", "DISAGREEMENT", "EVIDENCE CASE"]);
function forecastSummary(layer, atcfId) {
  if (!layer) return { state: "loading" };
  if (!layer.ok) return { state: "unavailable", error: layer.error };
  const rec = Object.prototype.hasOwnProperty.call(layer.storms, atcfId) ? layer.storms[atcfId] : null;
  if (!rec) return { state: "absent" };
  if (!rec.ok) return { state: "none", error: rec.error };
  const g = rec.guidance || {};
  const ms = (z) => { const t = Date.parse(z || ""); return Number.isFinite(t) ? t : null; };
  const w = rec.watch;
  return {
    state: "ok",
    advisory: rec.advisory, issued: ms(rec.issued), firstSeen: ms(rec.source && rec.source.first_seen),
    knownAt: ms(rec.known_at), points: (rec.trackPoints || []).length,
    cone: rec.cone ? { kind: rec.cone.kind, advisory: rec.cone.advisory, matches: rec.cone.matches_tcm } : null,
    guidance: { cycle: g.cycle || null, ageH: g.age_h, runs: (g.runs || []).length,
      families: (g.runs || []).length + (g.missing || []).length, missing: g.missing || [],
      stale: g.stale || [], members: g.member_count || 0 },
    watchSupplied: !!(layer.watch && layer.watch.supplied),
    watch: w ? {
      engine: w.engine, asOf: ms(w.as_of), current: !!w.evaluated_this_state, worst: w.worst,
      alerts: w.rows.filter((r) => WATCH_ALERT.has(r.state)).map((r) => ({ id: r.geometry, label: r.label,
        state: r.state, kind: r.provenance_kind, leadH: r.lead_h,
        reasons: r.reasons.map((x) => x.text) })),
      refused: w.rows.filter((r) => r.state === "INSUFFICIENT").map((r) => ({ label: r.label,
        reason: r.reasons.length ? r.reasons[0].text : null })),
      quiet: w.rows.filter((r) => r.state === "QUIET").map((r) => r.label),
    } : null,
  };
}
const DEFAULT_RADIUS_KM = 500;

/* THE ARCHIVE'S IDENTITY IN A CITATION, AND WHY IT IS NOT THE PACK STAMP ALONE.
   `archive_stamp` moves on every ingest -- seven times over an archive that had not changed, as
   test-atlas-cohort-identity.mjs records -- so a citation carrying only the stamp said two
   identical readings came from different data. `cohort_archive_id` hashes the tables a cohort is
   answered from and moves only when they do; the stamp stays beside it because the pack is still
   the file the reader downloaded. */
export const archiveIdOf = (manifest) => {
  const id = manifest && manifest.provenance && manifest.provenance.cohort_archive_id;
  return id ? `ARCHIVE ${String(id).slice(0, 16)} · ` : "";
};

/* The radius a bridged cohort inherits: whatever the reader already chose, and otherwise the
   same default a probe click applies. Stated here rather than inside the bridge so the surface
   keeps ONE default radius -- two would eventually disagree, and the one that disagreed would be
   the one nobody was looking at. */
const radiusFor = (spec) => (spec && spec.where ? spec.where.radiusKm : DEFAULT_RADIUS_KM);

export function Atlas() {
  const [archive, setArchive] = React.useState(null);
  const [manifest, setManifest] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [world, setWorld] = React.useState(null);
  const [coast, setCoast] = React.useState(null);
  /* The context tier: Natural Earth 110m land, 20 KB, fetched after the archive's own rings.
     It replaces the tile service the plate used to draw South America, Africa and Canada from. */
  const [contextLand, setContextLand] = React.useState(null);

  /* THE SINGLE SOURCE OF TRUTH. One object decides which storms are drawn, which are counted,
     what the outcome cards say, what the URL carries and what a saved scenario is. The rail
     writes to it; nothing else holds query state. */
  const [cohort, setCohortState] = React.useState(() => parseQuery(location.search).spec);
  /* WHAT THE READER LAST CHANGED, which is what the comparison is against by default.
     A fixed position in the lifecycle order would be the wrong default: a reader who narrows to
     Aug-Sep wants to see what the months did, not what the season floor did, and "last in
     lifecycle order" happens to be the season. Tracked here because only the shell knows which
     click produced the current cohort. `baselinePin` overrides it when the reader picks a
     different condition to hold out -- which is the what-if control. */
  const [lastChanged, setLastChanged] = React.useState(null);
  const [baselinePin, setBaselinePin] = React.useState(null);

  /* `changedKey` IS AN OVERRIDE, AND THE LAUNCHER IS WHY IT EXISTS.
   *
   * `changedKeyOf` reports the FIRST condition that differs in lifecycle order, which is the
   * right answer for every gesture that moves one condition -- a chip click, a radius, a drag.
   * It is the wrong answer for a transition that removes SEVERAL at once.
   *
   * MEASURED: launching from a cohort carrying months, a season floor, an intensity condition
   * and a landfall region reported `months` as the key that changed. The launched cohort has no
   * months, so `parentOf(cohort, "months")` dropped a condition that was not there, returned a
   * baseline IDENTICAL to the cohort, and the comparison column printed 0.0 pp on all eight rows
   * with "110 shared storms" -- on the same screen as a verdict sentence reading "All 6 intensity
   * thresholds run higher than the baseline", which is computed from the rates rather than from
   * the comparison and was still right. A dead column beside a live sentence disagreeing with it.
   *
   * `RESET QUERY` escapes this only by accident: it clears every condition, so `parentOf` finds
   * an empty list and returns null, and no comparison renders at all. A launch is the first
   * transition that lands on EXACTLY ONE condition, which is where the no-op baseline appears.
   *
   * So a caller that knows what it changed says so, rather than having it inferred from a diff
   * that cannot express "all of them". `changedKeyOf` is untouched -- it is gated and correct for
   * what it claims. */
  const setCohort = React.useCallback((next, { changedKey } = {}) => {
    setCohortState((prev) => {
      const n = typeof next === "function" ? next(prev) : next;
      const k = changedKey === undefined ? changedKeyOf(n, prev) : changedKey;
      if (k) { setLastChanged(k); setBaselinePin(null); }
      return n;
    });
  }, []);
  const [urlVersion] = React.useState(() => parseQuery(location.search).versionMismatch);
  /* WHICH SURFACE. Read from the URL on mount so the calibration ledger is addressable -- the
     home page links straight to it and every refusal deep-links to its own contract row.
     Named `surface` and not `view`: `view` below is the map viewport, and reusing the word
     would make this diff read as a rename of something unrelated.
     The tactical surface stays the default. The DOM and bench harnesses load a bare
     /storm-atlas/ and immediately reach for __ATLAS_MAP, which only exists while the map is
     mounted, so a calibration default would break both. */
  const [surface, setSurface] = React.useState(
    () => (new URLSearchParams(location.search).get("view") === "calibration"
      ? "calibration" : "tactical"));
  const [ledgerAnchor, setLedgerAnchor] = React.useState(
    () => new URLSearchParams(location.search).get("contract") || null);
  /* THE OPERATIONAL LAYER'S STATE. `null` means "not attempted yet"; a Live object with ok=false
     means "attempted and failed", which is the state that makes a provisional storm fail closed.
     The two are deliberately different values, because a panel that cannot tell them apart is a
     panel that would show a stub as current truth during the second the file is in flight. */
  const [live, setLive] = React.useState(null);
  /* THE FORECAST LAYER (atlas-forecast-v1.json): the advisory, cone, guidance and watch verdict
     per active system, from the capture. Same null-vs-failed distinction as `live`. */
  const [forecast, setForecast] = React.useState(null);
  /* THIS BROWSER'S CLOCK, for one purpose: how old the feed is. Ticked every five minutes so a
     page left open does not keep saying LIVE over a file that has stopped being rewritten. */
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 300000);
    return () => clearInterval(t);
  }, []);
  const [cal, setCal] = React.useState(null);
  const [calError, setCalError] = React.useState(null);
  /* THE METHODOLOGY A SHARED LINK WAS MADE UNDER. A cohort URL carries `v`, which versions the
     SPEC SHAPE, and until 1.1.0 nothing carried the methodology at all -- so a bump silently
     re-answered every link anyone had shared, with different refusals and no notice. A change
     no reader can detect is a silent one from their side, whatever the commit log says. */
  const [urlMethodology] = React.useState(
    () => new URLSearchParams(location.search).get("m"));
  const [layers, setLayers] = React.useState({
    colorBy: "uniform", genesis: true, landfalls: true,
  });
  const [selected, setSelected] = React.useState(null);
  /* THE CAMERA'S HANDLE, filled by the map. H and F are bound to the same two functions the
     plate's own controls call, so a keystroke and a click cannot come to mean different things. */
  const cameraRef = React.useRef(null);
  /* HAS THIS READER DONE ANYTHING YET. One bit, set by the first probe, the first selection or
     the first condition, and never cleared -- it is what retires the plate's click instruction.
     An instruction that keeps repeating after the gesture has been used is not guidance.
     
     A SHARED LINK ARRIVES ALREADY-INTERACTED, but only if it actually carries a question or a
     storm. Any non-empty query string would have been the easy test and the wrong one: a URL
     carrying nothing but `?m=1.1.0` -- which this surface writes on its own, into the address bar
     of a reader who has done nothing -- would have retired the instruction before it was ever
     shown. */
  const [interacted, setInteracted] = React.useState(() => {
    const p = new URLSearchParams(location.search);
    return !!p.get("storm") || !!p.get("atcf") || conditionsOf(parseQuery(location.search).spec).length > 0;
  });
  /* THE STORM A SHARED LINK WAS LOOKING AT. Read once on mount and resolved after the pack lands
     -- the URL carries the archive's own `storm_id`, never the pack row, because a row is
     pack-order and a rebuild would silently point the same link at a different storm. */
  const [urlStorm] = React.useState(
    () => new URLSearchParams(location.search).get("storm"));
  /* the pipeline's bridge names the storm by ATCF id; resolved through the same join the
     operational layer uses (engine/live.js rowOfAtcfId), and dropped when the pack does not hold it. */
  const [urlAtcf] = React.useState(
    () => new URLSearchParams(location.search).get("atcf"));
  const [urlStormResolved, setUrlStormResolved] = React.useState(false);
  /* What became of the bridge's id: "resolved" (the row is selected), "missing" (the pack does
     not hold it yet — IBTrACS publishes a live storm with a lag of days), or null (no bridge). */
  const [urlAtcfState, setUrlAtcfState] = React.useState(null);
  /* THE PLATE'S MODE, AND IT RESTS ON PATHWAY COUNTS. Three readings of the same storms:
     PATHWAY counts the distinct storms through each 2-degree cell, GENESIS counts the storms that
     formed in each, TRACKS is the trajectories alone -- the reading the plate used to rest on,
     kept whole. The tracks stay under either density surface at a reduced alpha (see
     population-layer.js), because the surface IS those storms counted and a reader must be able
     to see that the shading sits on real trajectories. A map-dependent control, so it lives on
     the plate head rather than in the clause editor. */
  const [plateMode, setPlateMode] = React.useState("pathway");
  const showPathway = plateMode === "pathway";
  const showGenesisDensity = plateMode === "genesis";
  /* THE STORM'S OWN CLOCK. The archive replay that shared this flag is gone; the transport is
     the one clock on the surface and it belongs to the selected storm. */
  const [stormPlaying, setStormPlaying] = React.useState(false);
  const [cursorMs, setCursorMs] = React.useState(null);
  /* THE INSPECTOR'S THREE VIEWS OF ONE ANSWER. OUTCOMES is the ledger; STORMS is the roster of
     the storms behind it; RECORD is the selected storm's own record. View state only: which tab
     is showing changes nothing a reader could cite. */
  const [tab, setTab] = React.useState("outcomes");
  /* WHAT THE ROSTER LISTS WHEN IT IS NOT THE WHOLE COHORT: a ledger row's members, or the storms
     through one plate cell. Always an engine member set, never re-derived here. */
  const [rosterSource, setRosterSource] = React.useState(null);
  /* ONE STORM LIFTED FROM THE ROSTER, WHILE THE POINTER IS ON ITS NAME. */
  const [hoverStorm, setHoverStorm] = React.useState(null);
  /* A STORM LIFTED FROM THE ROSTER OR THE PICK CARD IS A HOVER, AND A HOVER ENDS WITH ITS SOURCE.
     It used to survive a keyboard lift and a tab switch, and since it outranks the ledger's lens
     the plate then drew one unrelated storm while a held row said "N storms drawn on the plate". */
  React.useEffect(() => { setHoverStorm(null); }, [tab]);
  /* THE PICK: where the reader clicked open water, and what is there. */
  const [pick, setPick] = React.useState(null);
  React.useEffect(() => { if (!pick) setHoverStorm(null); }, [pick]);
  const [sealOpen, setSealOpen] = React.useState(false);
  const [readingsOpen, setReadingsOpen] = React.useState(false);
  /* WHAT THE LEDGER'S RIGHT-HAND COLUMN CARRIES: the difference from the baseline, or hours. */
  const [ledgerColumn, setLedgerColumn] = React.useState("delta");
  const [urlSeal] = React.useState(() => new URLSearchParams(location.search).get("seal"));
  const [provOpen, setProvOpen] = React.useState(false);
  const [view, setView] = React.useState(null);

  /* THE LENS. One row of the answer, held or hovered, and the storms it counted drawn on the
     plate. HOLDS ARE VIEW STATE: they never write a rate, the cohort, the citation or the URL --
     the two states are kept apart so a hover cannot outlive the pointer and a hold cannot be
     cleared by one. Inspection changes the view; commit changes the answer. */
  const [heldRow, setHeldRow] = React.useState(null);
  const [hoverRow, setHoverRow] = React.useState(null);
  /* THE BRUSHED AREA. Geographic inspection: which storms of this cohort went through here. It
     is view state in exactly the sense a held row is -- no rate, no denominator, no condition
     and no URL -- and it is deliberately NOT a cohort condition: the canonical spec conditions
     on GENESIS within a radius, and a rectangle that published would be answering a question the
     engine cannot be asked. */
  const [brush, setBrush] = React.useState(null);
  const onLens = React.useCallback((key, { transient = false } = {}) => {
    if (transient) setHoverRow(key);
    else { setHeldRow(key); setHoverRow(null); }
  }, []);


  /* The builder is a summoned sheet in the stacked shell rather than a resident rail. */
  /* WHICH ZONE IS BEING EDITED, AND WHERE THE CLAUSE THAT OPENED IT SITS. The anchor is
     measured at press time, in the shell's own coordinates, so the popover can be placed under
     the words it edits without becoming part of the layout -- it is absolutely positioned, so
     the plate's rectangle is a function of the viewport and the composition and of nothing else,
     which scripts/check-atlas-stability.mjs measures through this exact transition. */
  const [sheetZone, setSheetZone] = React.useState(null);
  const [sheetAt, setSheetAt] = React.useState(null);
  const shellRef = React.useRef(null);
  const anchorRef = React.useRef(null);
  /* WHERE THE POPOVER HANGS, AND WHY IT IS NOT SIMPLY UNDER THE CLAUSE.
   *
   * It is RANGED LEFT TO THE CLAUSE, so a reader never has to work out what they pressed, and it
   * DROPS FROM THE QUESTION AS A BLOCK rather than from the pressed line. Measured at 1440x900
   * with the first clause open, hanging from the clause's own bottom put the sheet at y=76 over
   * a question running 30 to 144: it covered 68 of its 114 pixels -- the second and third lines
   * of the sentence being edited, which is the one thing on the surface that must stay readable
   * while it is edited. Hanging from the question's bottom edge costs nothing: what it lands on
   * instead is the cohort line, and the sheet's own head restates that line in full (the count,
   * the archive total, SAMPLE GATE and the minimum).
   *
   * AND IT ENDS WHERE THE PLATE ENDS. The stylesheet's ceiling is min(62vh, 540px), which is the
   * right height beside a full-height plate and too tall stacked: at 1056x816 a 506px sheet from
   * y=76 reached 582 over an answer column starting at 546 -- the ledger, which the locked rules
   * say it may never occupy. Bounded by the plate's own bottom it is 376 there and clears the
   * ledger entirely, while at 1440 and 1920 the ceiling still binds and nothing changes.
   *
   * Both are read off the rendered boxes rather than written as constants, so neither can go
   * stale: the sheet is placed against the question and the plate a reader is actually looking
   * at. It stays absolutely positioned and moves neither. */
  const [sheetSection, setSheetSection] = React.useState(null);
  const openEditor = React.useCallback((zone, el, section = null) => {
    anchorRef.current = el || null;
    setSheetSection(section);
    const shell = shellRef.current;
    const q = document.querySelector("[data-question]");
    const plate = document.querySelector(".at-plate");
    if (el && shell) {
      const a = el.getBoundingClientRect();
      const b = shell.getBoundingClientRect();
      const top = Math.round((q ? q.getBoundingClientRect().bottom : a.bottom) - b.top + 8);
      /* AND IT STOPS AT THE PLATE'S RIGHT EDGE, WHICH IS THE LEDGER'S LEFT. The locked rule is
         that the editor may overlap the plate and may never occupy the ledger or hide a row: at
         1280x800 the fourth clause sits at x=439 and a 333px sheet from there reached 772 over
         an answer column starting at 657, hiding six published rows. Ranged left to the clause
         until that would cross the plate's edge, and held at the edge after -- so the sheet is
         over cartography in every case and over the answer in none. Stacked, the plate spans
         the width and the clamp never binds. */
      const sheetW = Math.min(420, Math.max(320, innerWidth * 0.26));
      const bound = (plate ? plate.getBoundingClientRect().right : b.right) - b.left;
      const left = Math.round(Math.max(0, Math.min(a.left - b.left, bound - sheetW)));
      const maxHeight = plate
        ? Math.max(240, Math.round(plate.getBoundingClientRect().bottom - b.top - top))
        : null;
      setSheetAt({ left, top, maxHeight });
    } else setSheetAt(null);
    setSheetZone(zone);
  }, []);
  /* CLOSING RETURNS THE READER TO THE CLAUSE THEY PRESSED. A dialog that drops focus at the top
     of the document costs a keyboard reader their place in the sentence. */
  const closeEditor = React.useCallback(() => {
    setSheetZone(null);
    setSheetSection(null);
    const el = anchorRef.current;
    anchorRef.current = null;
    if (el && el.isConnected) el.focus();
  }, []);

  /* THE EDITOR TAKES FOCUS WHEN IT OPENS. It is a dialog, and focus left on the clause that
     opened it meant a keyboard reader's next Tab walked the question instead of the editor. A
     section request focuses its own first control (CohortBuilder); otherwise the first control
     in the sheet takes it. */
  React.useEffect(() => {
    if (!sheetZone || sheetSection) return undefined;
    const t = setTimeout(() => {
      const b = document.querySelector("[data-builder-sheet] .at-sheet-body button");
      if (b) b.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [sheetZone, sheetSection]);

  /* THE TWO DURATION COLUMNS FOLD BELOW 1440, and the fold is measured rather than assumed:
     the deck asks the viewport directly instead of a breakpoint guess, because the columns it
     is deciding about are the ones a narrower workstation cannot hold. */
  const [vw, setVw] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [timingOpen, setTimingOpen] = React.useState(false);


  /* The manifest lands first so the scale line can paint while the 972 KB track block is still
     in flight; the two packs are then fetched in parallel. */
  React.useEffect(() => {
    let cancelled = false;
    loadArchive(DATA_BASE, {
      onProgress: (p) => { if (!cancelled && p.manifest) setManifest(p.manifest); },
    }).then((a) => {
      if (cancelled) return;
      const w = projectWorld(a);
      setWorld(w);
      setArchive(a);
      globalThis.__ATLAS = { archive: a, world: w, getAnalogs, pathwayDensity, genesisDensity };
      /* The cell index and its readers, for the cell-semantics and lens gates and the bench. */
      globalThis.__ATLAS_CELLS = { cellIndex, buildCellIndex, cellAt, keyOfCell, maskOf,
        pathwayMembers, genesisMembers, brushMembers };
      globalThis.__ATLAS_QUERY = { filterStorms, seasonRange, genesisBounds };
      globalThis.__ATLAS_COHORT = { cohortResult, previewCounts, normalise, parentOf, toQuery,
        whyMatched, contributionOf, bridgeSpec };
      globalThis.__ATLAS_PROJECT = projectWorld;
      /* THE COASTLINE COMES AFTER THE TRACKS, DELIBERATELY. It is the geometry the landfall
         rule tests against and it is the plate's authoritative line, but it is 226 KB and the
         map is legible without it. Requesting it here rather than in parallel with the pack
         keeps the critical path exactly what it was. Nothing is substituted while it is in
         flight: the contextual tier draws, and the modelled regions arrive when they arrive. */
      fetchCoastlines(`${DATA_BASE}/atlas-coastlines-v1.bin.gz`).then((c) => {
        if (cancelled) return;
        setCoast(c);
        globalThis.__ATLAS_COASTLINES = c;
      }).catch((e) => {
        /* A missing coastline is not a missing archive. The plate keeps its contextual tier
           and says so in the foot band rather than claiming a contrast it does not have. */
        if (!cancelled) setCoast({ failed: String(e && e.message ? e.message : e) });
      });
      /* THE CONTEXT LAND, LAST. It is the least of the three geometries -- context and only
         context -- so it queues behind the rings the landfall rule tested against. A failure
         here costs the plate its silhouette of South America and nothing else. */
      fetchContext(`${DATA_BASE}/atlas-context-v1.bin.gz`).then((c) => {
        if (cancelled) return;
        setContextLand(c);
        globalThis.__ATLAS_CONTEXT = c;
      }).catch(() => { /* the plate draws without context rather than from a third party */ });
    }).catch((e) => { if (!cancelled) setError(e); });

    /* THE OPERATIONAL ARTIFACT, IN PARALLEL AND OFF THE CRITICAL PATH.
     *
     * Roughly 20 KB of JSON against the pack's 1.4 MB, so it is requested alongside rather than
     * after -- but it is deliberately NOT awaited with the archive. It cannot delay a first paint
     * and it cannot fail one: `loadLive` resolves to an UNAVAILABLE layer instead of rejecting,
     * because a broken live file must degrade the selected-storm panel and nothing else. */
    loadLive(DATA_BASE).then((l) => {
      if (cancelled) return;
      setLive(l);
      globalThis.__ATLAS_LIVE = l;
    });
    /* THE FORECAST LAYER, ALSO IN PARALLEL AND NEVER AWAITED. About 17 KB gzipped. It is read
       up front rather than on a press because a DISAGREEMENT the watch has found must be on the
       top bar without anyone asking for it. It cannot fail the archive: `loadForecast` resolves
       to an object that says it failed. */
    loadForecast(DATA_BASE).then((f) => {
      if (cancelled) return;
      setForecast(f);
      globalThis.__ATLAS_FORECAST = f;
    });
    return () => { cancelled = true; };
  }, []);

  /* storm_id -> pack row. Built once per archive: 3,959 string reads, and the only thing that
     can turn a shared link back into a selection. */
  const rowOfStormId = React.useMemo(() => {
    if (!archive) return null;
    const m = new Map();
    for (let i = 0; i < archive.nStorms; i++) m.set(archive.storms.str("storm_id", i), i);
    return m;
  }, [archive]);

  React.useEffect(() => {
    if (!archive || !rowOfStormId || urlStormResolved) return;
    setUrlStormResolved(true);
    if (urlStorm) {
      const row = rowOfStormId.get(urlStorm);
      /* An id this pack does not hold is dropped rather than guessed at. The cohort in the same
         URL still opens, which is the half of the link that carries the question. */
      if (row !== undefined) { setSelected(row); setTab("record"); return; }
    }
    if (urlAtcf) {
      const res = atcfResolution(archive, urlAtcf);
      if (res.row !== null) { setSelected(res.row); setTab("record"); }
      setUrlAtcfState(res.reason);
    }
  }, [archive, rowOfStormId, urlStorm, urlAtcf, urlStormResolved]);

  const bounds = React.useMemo(() => (archive ? seasonRange(archive) : [1851, 2026]), [archive]);
  const home = React.useMemo(() => (archive ? coreFrame(archive) : null), [archive]);
  const homeAnchor = React.useMemo(() => (archive ? coreAnchor(archive) : null), [archive]);
  /* ONE COHORT, ONE ANSWER. Membership and outcomes come from the same object now: the storms
     drawn on the map ARE the storms in every denominator. Until 3.2 these were two calls -- one
     deciding what was drawn, another deciding what was scored -- and keeping them from
     disagreeing was the shell's job rather than the engine's. */
  /* MEMBERS ARE ASKED FOR HERE AND NOWHERE ELSE. The lens draws the storms of one published
     contract, and the only honest source for that set is the loop that counted the numerator --
     see scoreCases. Measured at 6.8 ms on a 2,181-storm cohort against 6.0 without. */
  const result = React.useMemo(
    () => (archive ? cohortResult(archive, cohort, { members: true }) : null), [archive, cohort]);

  /* THE BASELINE IS ONE OBJECT, USED TWICE. It is the population drawn behind the cohort on the
     map AND the reference every delta is measured against -- and those must be the same thing,
     or the picture and the numbers are answering different questions, which is the exact failure
     3.2 existed to end. The condition it holds out is the one the reader pinned, else the one
     they last changed, else the last in lifecycle order. */
  const baselineKey = baselinePin || lastChanged;
  const baselineSpec = React.useMemo(
    () => parentOf(cohort, baselineKey || undefined), [cohort, baselineKey]);
  const context = React.useMemo(
    () => (archive && baselineSpec ? cohortResult(archive, baselineSpec) : null),
    [archive, baselineSpec]);

  const comparison = React.useMemo(
    () => (result && context ? compareResults(result, context) : null), [result, context]);

  /* ---- THE ACTIVE SYSTEM LAUNCHER ---------------------------------------------------------
   *
   * THE JOIN IS HERE, which is the one place ATLAS-LIVE.md §5 permits it. Two objects that know
   * nothing about each other -- the operational artifact and the archive's manifest -- produce a
   * THIRD, and only that third object reaches the UI. `active-systems.jsx` imports no engine
   * module and receives plain numbers, so the wall needs no new opening and the boundary gate's
   * three permitted importers of engine/live.js are unchanged.
   *
   * ONLY THE SYSTEMS NHC CURRENTLY LISTS. `health.active_atcf_ids` is the feed's own answer to
   * "what is being tracked right now"; a retained record is a storm that has already dissipated
   * and belongs in the inspector's history, not in a launcher headed ACTIVE.
   *
   * EVERY DERIVED VALUE COMES FROM `operationalLifecycle`, which replays the ARCHIVE'S crossing
   * rule over the operational fixes. Nothing here re-implements genesis: a second reading of
   * that rule, in a UI file, is exactly how the b-deck's first row -- a disturbance 900 km away
   * -- becomes "where it formed".
   */
  const activeSystems = React.useMemo(() => {
    if (!archive || !live || !live.ok) return [];
    const ladder = categoryLadder(archive.manifest);
    const ids = (live.health && live.health.active_atcf_ids) || [];
    const drops = droppedByCleanLaunch(cohort);
    const out = [];
    for (const id of ids) {
      const rec = live.record(id);
      if (!rec || !rec.fixes || !rec.fixes.length || !rec.latest) continue;
      const lc = operationalLifecycle(rec.fixes, ladder);
      const g = lc.genesis_position && lc.genesis !== null
        ? { lat: lc.genesis_position.lat, lon: lc.genesis_position.lon,
            t: lc.genesis, stage: lc.genesis_stage, kt: lc.genesis_kt }
        : null;
      const latestT = Date.parse(rec.latest.t);
      /* The separation a reader is being warned about. With a genesis it is genesis -> now --
         how far a coordinate off the latest advisory would have misdirected the query. WITHOUT
         one it is first fix -> now, because that is the distance to the position the record does
         hold and the one a naive launcher would have reached for. */
      const from = g || lc.first_position;
      const fromT = g ? lc.genesis : lc.first_fix;
      out.push({
        atcf_id: rec.atcf_id,
        name: rec.name,
        basin: rec.basin,
        stage_label: rec.stage_label,
        stale: live.stale.has(id),
        ageHours: rec.age_hours,
        latest: { lat: rec.latest.lat, lon: rec.latest.lon, kt: rec.latest.kt,
                  t: latestT, stage: rec.latest.stage },
        genesis: g,
        firstFix: { lat: lc.first_position.lat, lon: lc.first_position.lon,
                    t: lc.first_fix, stage: lc.first_stage },
        separationKm: haversineKm(from.lat, from.lon, rec.latest.lat, rec.latest.lon),
        separationHours: (latestT - fromT) / 3600000,
        cohortRadiusKm: radiusFor(cohort),
        drops,
        fc: forecastSummary(forecast, rec.atcf_id),
      });
    }
    return out;
  }, [archive, live, cohort, forecast]);

  /* WHICH SYSTEM THE COHORT ON SCREEN IS ALREADY KEYED TO, so the launcher can say so rather
     than offering a click that changes nothing. Compared on the DERIVED GENESIS point at the
     precision the URL round-trips at (3 dp, from toQuery) -- comparing floats exactly would
     report "not on it" for a cohort that had just been launched and then reloaded. */
  const launchedSystem = React.useMemo(() => {
    if (!cohort.where) return null;
    const near = (a, b) => Math.abs(a - b) < 5e-4;
    const hit = activeSystems.find((sys) => sys.genesis
      && near(sys.genesis.lat, cohort.where.lat) && near(sys.genesis.lon, cohort.where.lon));
    return hit ? hit.atcf_id : null;
  }, [activeSystems, cohort]);

  /* THE ENVIRONMENT LENS. Coverage is answered from the core pack -- `env_at_genesis_row` is a
     core index -- so how many of this cohort can be evaluated at all, and the NOT EVALUABLE
     refusal that follows, cost nothing and are honest on first paint. The 991 KB environment
     block is fetched only when a reader asks to see the distributions, and `envEpoch` exists
     so the lens recomputes once it lands: the archive object is mutated in place by
     loadEnvironment, which React has no way to notice. */
  /* WHAT THE LAST EDIT COST, IN POPULATION. One number to one number, recorded when the spec
     changes and replaced by the next edit -- never accumulated, because a running list of
     deltas is a narrative and this is an orientation aid. Held in a ref rather than derived,
     since the PREVIOUS population is not recoverable from the current spec. */
  const [openGroups, setOpenGroups] = React.useState({});
  const [lastEdit, setLastEdit] = React.useState(null);
  const lastChangedRef = React.useRef(null);
  lastChangedRef.current = lastChanged;
  const keptRef = React.useRef(null);
  const specRef = React.useRef(null);
  React.useEffect(() => {
    if (!result) return;
    const key = JSON.stringify(cohort);
    /* EVERY SPEC CHANGE IS AN EDIT, INCLUDING ONE THAT MOVED NO STORM, and the edit carries
       the key that made it. Updating only when the count moved let a no-op NAMED toggle inherit
       the previous edit's "121 → 24" under its own name. */
    if (specRef.current !== null && specRef.current !== key && keptRef.current !== null) {
      setLastEdit({ from: keptRef.current, to: result.kept, key: lastChangedRef.current });
    }
    specRef.current = key;
    keptRef.current = result.kept;
  }, [cohort, result]);

  /* THE EDIT, NAMED, FOR THE DECK'S FOOT. The condition strip prints the population move on its
     own -- 964 → 847 -- and the foot needs the same move WITH the name of what moved it, since
     a reading aid that says only "847" is an aid to nothing. Null until the reader has actually
     changed something: WhatChanged renders nothing without an edit, which is the correct first
     state rather than a block explaining that nothing has happened yet. */
  const whatChanged = React.useMemo(() => {
    if (!lastEdit || lastEdit.from === null || lastEdit.to === null) return null;
    const cond = conditionsOf(cohort).find((x) => x.key === lastEdit.key);
    return {
      edit: `${cond ? cond.label : "THE COHORT"} · `
        + (lastEdit.from === lastEdit.to
          ? `no storm changed · ${lastEdit.to.toLocaleString()} storms`
          : `${lastEdit.from.toLocaleString()} → ${lastEdit.to.toLocaleString()} storms`),
    };
  }, [lastEdit, cohort]);

  const [envLoading, setEnvLoading] = React.useState(false);
  const [envEpoch, setEnvEpoch] = React.useState(0);
  const envCov = React.useMemo(
    () => (archive && result ? envCoverage(archive, result.rows) : null), [archive, result]);
  const envLens = React.useMemo(
    () => (archive && result && envEpoch ? envAtGenesis(archive, result.rows) : null),
    [archive, result, envEpoch]);
  const loadEnv = React.useCallback(() => {
    if (!archive || archive.env) { setEnvEpoch((n) => n + 1); return; }
    setEnvLoading(true);
    archive.loadEnvironment(`${DATA_BASE}/atlas-env-v1.bin.gz`)
      .then(() => { setEnvEpoch((n) => n + 1); })
      .finally(() => setEnvLoading(false));
  }, [archive]);

  /* What each chip would cost, computed once per cohort -- five filter passes and five scans.
     Measured: 2.9 ms on a 65-storm cohort, 3.9 ms on 539, 6.9 ms over the whole archive. That
     is what makes a live count on every control affordable rather than aspirational. */
  const preview = React.useMemo(
    () => (archive ? previewCounts(archive, cohort) : null), [archive, cohort]);
  /* THE QUESTION, IN ONE READING AND TWO RENDERINGS. `segments` is what the head prints and
     `sentence` is what the citation quotes; the second is the join of the first, from one
     assembler, so they cannot disagree about a single character. */
  const segments = React.useMemo(() => questionSegmentsOf(cohort), [cohort]);
  const sentence = React.useMemo(() => openQuestion(cohort), [cohort]);

  const contextRows = context ? context.rows : (result ? result.rows : null);
  const emphasis = context ? result.rows : null;

  /* WHAT IS HELD, AND WHAT IT PUBLISHES: nothing. The label and the two figures below are the
     row's OWN already-published values, read back out of the same result the ladder printed
     them from -- the plate echoes them, it does not compute them. */
  /* THE BRUSH'S MEMBERS, FROM THE CELL INDEX -- the same index the hover readout counts with,
     so the number stated on the foot is the number of storms in those cells and nothing else. */
  const brushLens = React.useMemo(() => {
    if (!brush || !archive || !result) return null;
    const index = cellIndex(archive, 2.0);
    const { rows, cells } = brushMembers(index, maskOf(archive.nStorms, result.rows), brush);
    return { key: "__brush__", label: "BRUSHED AREA", rows, count: rows.length,
      denom: result.kept, held: true, cells };
  }, [brush, archive, result]);

  const lens = React.useMemo(() => {
    /* ONE STORM FROM THE ROSTER OR THE PICK CARD, WHILE THE POINTER IS ON ITS NAME. The same lens
       a ledger row uses, holding one row -- so the plate draws that storm alone over its cohort
       exactly the way it draws a contract's members. */
    if (hoverStorm !== null && archive) {
      const nm = archive.storms.str("name", hoverStorm) || "UNNAMED";
      return { key: "__storm__", label: `${nm} ${archive.storms.num("season", hoverStorm)}`,
        rows: [hoverStorm], count: null, denom: null, held: false, ink: "#ffffff", single: true };
    }
    const key = hoverRow || heldRow;
    if (!key || !result) return brushLens;
    for (const g of buildGroups(result, comparison, null)) {
      for (const row of g.rows) {
        if (row.key !== key) continue;
        if (!row.memberRows || !row.memberRows.length) return null;
        return { key, label: row.label, rows: row.memberRows, ink: lensInkOf(key),
          count: row.cell ? row.cell.count : row.memberRows.length,
          denom: row.cell ? row.cell.n_storms : null, held: key === heldRow };
      }
    }
    return brushLens;
  }, [hoverRow, heldRow, result, comparison, brushLens, hoverStorm, archive]);

  /* A COHORT EDIT RELEASES THE HOLD. The row a reader held is a row of the previous answer; a new
     cohort re-publishes every contract, and keeping the key would lift a set the ladder is no
     longer showing. The camera, the selection and the mode are untouched. */
  React.useEffect(() => {
    setHeldRow(null); setHoverRow(null); setBrush(null);
    setRosterSource(null); setPick(null); setHoverStorm(null);
  }, [cohort]);

  /* MEMOISED, and that is not a micro-optimisation. `Archive.storm(i)` allocates -- it is marked
     "not for hot loops" where it is defined -- and everything the operational join derives hangs
     off this object's identity. Recomputed every render it would hand the plate a new track
     object sixty times a second, and the layer would re-project and repaint each one. */
  const storm = React.useMemo(
    () => (selected === null ? null : archive.storm(selected)), [archive, selected]);

  /* ================= THE JOIN, AND THE ONLY PLACE IT HAPPENS =================
   *
   * `archive.storm(selected)` above is untouched and is what every research surface on this page
   * reads. This block builds a SECOND object beside it, from the operational artifact, and hands
   * both to the inspector and the plate. Nothing merges them, and no value computed here is
   * passed to cohortResult, getAnalogs, filterStorms, compareResults, envCoverage, envAtGenesis,
   * buildTimeline, loadCalibration, whyMatched, contributionOf or bridgeSpec -- every one of
   * those still takes exactly the arguments it took before this change, so there is no call site
   * that could pass one.
   *
   * `liveState` is computed even when `live` is still null, because "not loaded yet" and "loaded
   * and says nothing is expected" are different answers and the panel has to be able to tell.
   * While the artifact is in flight a provisional storm reads as LIVE CONTINUATION UNAVAILABLE,
   * which is the correct thing to say about a record whose continuation has not arrived. */
  const liveState = React.useMemo(
    () => (archive && selected !== null ? liveStateFor(archive, selected, live) : null),
    [archive, selected, live]);

  const liveBundle = React.useMemo(() => {
    if (!liveState || !storm) return null;
    if (liveState.state !== LIVE_OPERATIONAL) {
      return { state: liveState.state, reason: liveState.reason, view: null, lifecycle: null,
        disagreement: [], shortfall: null };
    }
    const view = operationalView(liveState.record, { manifest: archive.manifest });
    return {
      state: liveState.state,
      reason: null,
      view,
      lifecycle: operationalLifecycle(view.fixes, categoryLadder(archive.manifest)),
      disagreement: sourceDisagreement(storm, view),
      shortfall: shortfall(storm, view),
    };
  }, [liveState, storm, archive]);

  /* THE TRACK THE PLATE DRAWS FOR A CURRENT STORM, and null for every other storm on the surface.
     `archiveGenesis` travels with it because the genesis point a cohort matches on is the
     ARCHIVE's, and it has to stay visible on an operational track. */
  const operationalTrack = React.useMemo(() => {
    const v = liveBundle && liveBundle.view;
    if (!v || !v.fixes.length) return null;
    const ladder = categoryLadder(archive.manifest) || [];
    /* CATEGORY_ORDER's own order, ascending in knots, so the renderer can index straight into it
       without carrying a second copy of the class names. */
    const byName = Object.fromEntries(ladder);
    return {
      fixes: v.fixes,
      genesisMs: liveBundle.lifecycle ? liveBundle.lifecycle.genesis : null,
      archiveGenesis: { lat: storm.genesis_lat, lon: storm.genesis_lon, t: storm.genesis_t },
      ladderKt: ["td", "ts", "cat1", "cat2", "cat3", "cat4", "cat5"]
        .map((k) => (byName[k] === undefined ? Infinity : byName[k])),
    };
  }, [liveBundle, storm, archive]);

  /* WHAT FIT WOULD FRAME, AND WHAT SELECTING A STORM WOULD.
   *
   * FIT takes the LIFTED evidence when there is any and the drawn population otherwise, which is
   * the same thing the plate head counts as COHORT: the control frames what the caption says is
   * there. It is recomputed per cohort rather than per render because it walks track points, and
   * NOTHING CONSUMES IT AUTOMATICALLY -- it is handed to the map as a target the reader may ask
   * for, never as a camera instruction. That distinction is the persistence rule in one line. */
  const evidenceFrame = React.useMemo(
    () => (archive ? rowsFrame(archive, emphasis || contextRows) : null),
    [archive, emphasis, contextRows]);
  /* THE FRAME SELECTING A STORM ASKS FOR.
   *
   * It has to cover the track that is actually DRAWN. For a current storm that is the operational
   * one, and CP012026's runs from 137W to 176E while its archive stub stops at 160W -- so a frame
   * taken from the archive alone would put half the visible track off the plate and look, to a
   * reader, exactly like a map that had cut the storm short. */
  const subjectFrame = React.useMemo(
    () => (archive && selected !== null
      ? rowsFrame(archive, [selected], { stride: 1, extra: operationalTrack
        ? operationalTrack.fixes.map((f) => [f.lat, f.lon]) : null })
      : null),
    [archive, selected, operationalTrack]);

  /* THE DENSITY SURFACES ARE NOT TIED TO A PROBE. With a probe they show the matched pool --
     where those storms went. Without one they show the current filter over the whole archive,
     which is what makes "all storms · TS+ · Cat 3+ · Mexico · CONUS · Hawaii" reachable: every
     one of those is a filter that already exists. Measured at 7.9 ms for all 3,885 storms. */
  const pathway = React.useMemo(() => {
    if (!archive || !result || !showPathway) return null;
    return pathwayDensity(archive, result.rows, 2.0);
  }, [archive, result, showPathway]);

  const genesisGrid = React.useMemo(() => {
    if (!archive || !result || !showGenesisDensity) return null;
    return genesisDensity(archive, result.rows, 2.0);
  }, [archive, result, showGenesisDensity]);

  /* THE COHORT IS THE ADDRESS BAR, AND BACK UNDOES A QUESTION.
     A scenario is a URL in this architecture -- shareable, bookmarkable and diffable with no
     server at all -- so the spec is written back on every change. A change to the COHORT is a
     history entry (pushState): it is a committed question, and a reader who removed a condition
     by accident gets it back with Back. Everything else the bar carries -- the selection, the
     surface, the ledger anchor -- replaces the current entry, because looking at a storm is not a
     new question. The year box drafts and commits on blur, so typing is one entry, not four. */
  const lastCohortQ = React.useRef(null);
  const fromPop = React.useRef(false);
  const [initialCohortQ] = React.useState(() => toQuery(parseQuery(location.search).spec).toString());
  const sealLive = !!urlSeal && toQuery(cohort).toString() === initialCohortQ;
  const liveFp = React.useMemo(
    () => (archive && result ? shortFingerprint(fingerprintOf(archive, result.rows)) : ""),
    [archive, result]);
  React.useEffect(() => {
    const onPop = () => {
      fromPop.current = true;
      setCohort(parseQuery(location.search).spec);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [setCohort]);
  React.useEffect(() => {
    /* NOT BEFORE THE PACK LANDS. `storm` and `m` are both guarded on `archive`, so running this
       on the first commit rewrote the address bar WITHOUT them -- the shared link's storm id was
       erased from the bar for the whole length of the pack download, and permanently if the pack
       never arrived, with no history entry to go back to because every write here is a
       replaceState. The URL a reader arrived with is the only copy of that id; the surface has
       nothing to say about it until it can read the archive. */
    if (!archive) return;
    /* MERGED, NOT REPLACED. toQuery builds a fresh URLSearchParams from the spec alone, so
       writing it straight back would silently drop ?view= and ?contract= on the next chip
       click -- a deep link into the ledger that survives exactly until the reader touches
       anything. The cohort still owns every key it knows about; the surface owns the rest. */
    const p = new URLSearchParams(toQuery(cohort));
    if (surface !== "tactical") p.set("view", surface);
    if (ledgerAnchor) p.set("contract", ledgerAnchor);
    /* Stamped ALONGSIDE the cohort, never inside toQuery: the methodology is not part of a
       cohort's identity, and folding it in would make two identical cohorts built under
       different versions stop comparing equal.
       `m` IS A SURFACE KEY AND THE COHORT MAY NOT USE IT. It did: months were also `m`, and
       because this line writes last it deleted the reader's month selection from every link
       and re-read the version back as a January condition on the way in. The cohort's months
       are `mo` now, the reservation is declared in engine/cohort.js as RESERVED_QUERY_KEYS,
       and test-atlas-cohort.mjs fails if a cohort key ever takes one of these back. */
    if (archive) p.set("m", archive.manifest.methodology_version);
    /* The selection travels with the link, so a bridged view can be sent to another analyst as
       the thing it is: this storm, against this cohort. */
    if (archive && selected !== null) p.set("storm", archive.storms.str("storm_id", selected));
    /* THE BRIDGE'S ID SURVIVES THE FIRST WRITE. `atcf` is a reserved surface key, and when it did
       not resolve to a row it is the only thing in the link that says which live storm the
       reader came from -- erasing it made a copied link lose the storm and its notice. A resolved
       id travels as `storm=` instead, which names the archive's own row. */
    if (urlAtcf && urlAtcfState && urlAtcfState !== "resolved") p.set("atcf", urlAtcf);
    /* THE SEAL TRAVELS WHILE IT STILL DESCRIBES THE COHORT ON SCREEN, and not a moment longer:
       a fingerprint left on a link after its cohort changed would check the wrong population. */
    if (sealLive) p.set("seal", urlSeal);
    const q = p.toString();
    const next = q ? `?${q}` : location.pathname;
    const cq = toQuery(cohort).toString();
    const push = lastCohortQ.current !== null && lastCohortQ.current !== cq && !fromPop.current;
    lastCohortQ.current = cq;
    fromPop.current = false;
    if (location.search.replace(/^\?/, "") === q) return;
    if (push) history.pushState(null, "", next);
    else history.replaceState(null, "", next);
  }, [cohort, surface, ledgerAnchor, archive, selected, urlAtcf, urlAtcfState, sealLive, urlSeal]);

  /* The ledger's 16 KB is fetched only when the ledger is opened. Nothing on the tactical
     surface needs it, and a reader who never asks the question should not pay for the answer. */
  React.useEffect(() => {
    if (surface !== "calibration" || cal || calError) return;
    let cancelled = false;
    loadCalibration(DATA_BASE)
      .then((c) => { if (!cancelled) setCal(c); })
      .catch((e) => { if (!cancelled) setCalError(e); });
    return () => { cancelled = true; };
  }, [surface, cal, calError]);

  /* THE CITATION. Priority A of the brief, and the thing the `m` collision had quietly broken:
     an analyst could not send another analyst the exact empirical question, because the link
     they copied described a different cohort from the one on their screen.
     Built from the SAME parameters the address bar is written from, in one place, rather than
     read back out of location.href -- that effect runs after this render, so reading the bar
     here would cite the previous cohort by one paint on every change. The methodology version
     and the pack stamp travel WITH it: a cohort is only reproducible against the definitions
     and the data it was answered under, and both move. */
  const scenarioURL = React.useCallback(({ withStorm = false } = {}) => {
    const p = new URLSearchParams(toQuery(cohort));
    if (surface !== "tactical") p.set("view", surface);
    if (ledgerAnchor) p.set("contract", ledgerAnchor);
    if (archive) p.set("m", archive.manifest.methodology_version);
    /* OPT-IN, because the two citations are citations of different things. A cohort is a
       question and its link should reproduce the question and nothing else -- a storm that
       happened to be selected is not part of it. The STORM's citation is the bridged view, and
       that one does carry the selection, because the pairing is the thing being cited. */
    if (withStorm && archive && selected !== null) {
      p.set("storm", archive.storms.str("storm_id", selected));
    }
    const q = p.toString();
    return `${location.origin}${location.pathname}${q ? `?${q}` : ""}`;
  }, [cohort, surface, ledgerAnchor, archive, selected]);

  const stormCitation = React.useMemo(() => {
    if (!archive || selected === null || !result) return null;
    const m = archive.manifest;
    const s = archive.storms;
    return `STORM ATLAS · ${s.str("name", selected) || "UNNAMED"} ${s.num("season", selected)} `
      + `(${s.str("storm_id", selected)}) · AGAINST ${openQuestion(cohort).replace(/ — what happened next\?$/, "")} `
      + `· ${result.kept.toLocaleString()} of ${m.counts.storms.toLocaleString()} storms · `
      + `METHODOLOGY ${m.methodology_version} · ${archiveIdOf(m)}PACK ${(m.provenance || {}).archive_stamp}`;
  }, [archive, selected, result, cohort]);

  const citation = React.useMemo(() => {
    if (!archive || !result) return null;
    const m = archive.manifest;
    return `STORM ATLAS · ${openQuestion(cohort).replace(/ — what happened next\?$/, "")} · `
      + `${result.kept.toLocaleString()} of ${m.counts.storms.toLocaleString()} storms · `
      + `METHODOLOGY ${m.methodology_version} · ${archiveIdOf(m)}PACK ${(m.provenance || {}).archive_stamp}`;
  }, [archive, result, cohort]);

  /* THE BRIDGE'S OWN FACTS, memoised on (storm, cohort) because whyMatched runs one filter pass
     per condition -- 6.4 ms on a three-condition cohort, which is affordable once and is the
     most expensive thing on the surface if it runs per render. */
  const bridge = React.useMemo(() => {
    if (!archive || selected === null || !result) return null;
    return {
      why: whyMatched(archive, cohort, selected),
      contribution: contributionOf(result, selected),
      proposed: bridgeSpec(archive, cohort, selected, { radiusKm: radiusFor(cohort) }),
    };
  }, [archive, selected, cohort, result]);

  /* WHICH BASINS THE READER'S COHORT ACTUALLY DRAWS ON, for the ledger to compare against the
     one it replayed. Computed from the cohort's own rows rather than from the basin CONDITION,
     because most cohorts set none: a click at 14.7N 113.9W names no basin and is east-Pacific by
     geography, and a ledger that only noticed a declared basin would stay silent for exactly the
     readers who most need the comparison. Only computed while the ledger is open -- it is a
     string read per storm and nothing on the tactical surface asks the question. */
  const cohortBasins = React.useMemo(() => {
    if (!archive || !result || surface !== "calibration") return null;
    const set = new Set();
    for (const row of result.rows) {
      const b = archive.storms.str("basin", row);
      if (b) set.add(b);
    }
    return [...set].sort();
  }, [archive, result, surface]);

  /* A refusal on the tactical surface asks for its evidence. */
  const openLedger = React.useCallback((contractKey) => {
    setLedgerAnchor(contractKey || null);
    setSurface("calibration");
    setSelected(null);
  }, []);

  /* SELECTING A STORM OPENS ITS RECORD -- unless the reader is working down the roster, where
     the list is the thing they are using and the record is one press away on the strip above it. */
  const selectStorm = React.useCallback((row, { keepTab = false } = {}) => {
    setSelected(row);
    if (!keepTab && row !== null) setTab("record");
    setPick(null);
    setHoverStorm(null);
    setCursorMs(null);
    setStormPlaying(false);
    setInteracted(true);
  }, []);

  // Handles for the interaction checks, alongside __ATLAS_MAP. Nothing in the app reads them.
  React.useEffect(() => { globalThis.__ATLAS_SELECT = selectStorm; }, [selectStorm]);
  /* WHICH ROWS ARE LIFTED, which is what FIT frames and what the plate head counts as COHORT.
     Exposed so the camera gate can assert containment against the same rows the layer drew,
     rather than against its own re-derivation of what the cohort ought to be. */
  React.useEffect(() => {
    globalThis.__ATLAS_DRAWN_ROWS = emphasis || contextRows || [];
  }, [emphasis, contextRows]);
  React.useEffect(() => { globalThis.__ATLAS_SET_CURSOR = setCursorMs; }, []);
  /* The lens's own handle, for the coordination gate: what is lifted, and from which row. */
  React.useEffect(() => {
    globalThis.__ATLAS_LENS = lens
      ? { key: lens.key, label: lens.label, count: lens.count, denom: lens.denom,
          rows: lens.rows, held: lens.held }
      : null;
  }, [lens]);

  /* THE BRIDGE: build the cohort around where THIS storm formed, and keep the storm.
   *
   * `onProbe` below clears the selection, which is right for a click on open water -- the reader
   * has asked about a place, not a storm. It is exactly wrong here: the whole feature is that
   * the storm and the cohort built from its genesis are legible at the same time, and routing
   * the bridge through onProbe would have destroyed the subject to answer the question about it.
   *
   * THE GENESIS POINT, NEVER THE CURSOR. `bridgeSpec` takes the storm's genesis coordinates; a
   * position part-way along the track is where the storm WAS at an instant, and every rate a
   * cohort publishes is conditioned on where storms FORMED. Matching on a mid-track position
   * would quietly ask a question this archive does not answer.
   *
   * EVERY OTHER CONDITION SURVIVES. The spec keeps its months, seasons, basin and outcome-side
   * conditions and replaces only the location, so the bridge narrows the reader's own question
   * rather than substituting a different one. What it added or replaced is named on the panel. */
  const onBridge = React.useCallback((row) => {
    if (!archive || row === null) return;
    const b = bridgeSpec(archive, cohort, row, { radiusKm: radiusFor(cohort) });
    if (!b) return;
    setStormPlaying(false);
    setCursorMs(null);
    setCohort(b.spec);
  }, [archive, cohort, setCohort]);

  /* LAUNCHING FROM AN ACTIVE SYSTEM. A CLEAN question, and the difference from `onBridge` is
   * the whole point of having two handlers.
   *
   * `onBridge` NARROWS the question already on screen: a reader looking at a cohort asks "and
   * around this storm's genesis", so every other condition they set survives, because they set
   * it and it is still their question.
   *
   * A LAUNCH IS NOT THAT GESTURE. The reader has named a live storm and asked what the archive
   * says about storms that formed where it formed. Carrying their previous conditions across
   * that gesture writes the most dangerous sentence this surface could publish: a cohort still
   * conditioned on `landfall: mexico` from ten minutes ago, now labelled with a live storm's
   * name, publishing a Mexico landfall rate that is 100% by construction and reading as a
   * forecast for that storm. So `genesisOnlySpec` starts from EMPTY_COHORT.
   *
   * THE RADIUS SURVIVES AND NOTHING ELSE DOES. It is the aperture of the question rather than a
   * condition on the storms -- 250 km and 500 km are two readings of one question -- and it is
   * the control a reader actually works. The policy is applied HERE, at the call site, and the
   * launcher prints it above the button before the click.
   *
   * THE SELECTION IS CLEARED. A launch is a question about a place, not about the archive storm
   * that happened to be open; leaving an unrelated storm selected beside a freshly launched
   * cohort is the same category error in miniature. */
  const onLaunchSystem = React.useCallback((sys) => {
    if (!sys || !sys.genesis) return;
    const spec = genesisOnlySpec({
      lat: sys.genesis.lat, lon: sys.genesis.lon, radiusKm: sys.cohortRadiusKm,
    });
    if (!spec) return;
    setSelected(null);
    setStormPlaying(false);
    setCursorMs(null);
    setInteracted(true);
    /* THE BASELINE IS THE ARCHIVE, SAID EXPLICITLY. A launched cohort carries exactly one
       condition -- where it formed -- so the only baseline that means anything is the archive
       without that condition. Naming `where` as what changed is what makes `parentOf` produce
       it; leaving it to be inferred produces a baseline equal to the cohort. See setCohort. */
    setCohort(spec, { changedKey: "where" });
  }, [setCohort]);

  /* ─────────────────────────────────────────────────────────────────────────────────────────
   * THE FORWARD OUTCOME VIEW'S JOIN, AND IT IS THE ONLY PLACE IT HAPPENS.
   * ─────────────────────────────────────────────────────────────────────────────────────────
   *
   * An official forecast is operational. Every distribution it is laid against is historical.
   * `engine/forward.js` cannot reach the operational layer and has no parameter a forecast could
   * arrive through; `engine/live.js` knows nothing about a cohort. So the two meet here, and what
   * crosses between them is a list of `{ validMs, kt }` pairs -- two numbers per point, one of
   * them an absolute instant.
   *
   * READ UP FRONT, LAID ON THE LAUNCH. The forecast file (atlas-forecast-v1.json, from the
   * capture) is about 17 KB gzipped and is loaded beside the live artifact, off the
   * critical path. A launch keyed to a live system's derived genesis lays that system's advisory
   * against the cohort with no further press. It fails open: the archive is complete without it
   * and must not grow a hole where it would have been.
   */
  const [official, setOfficial] = React.useState(null);
  const [officialLoading, setOfficialLoading] = React.useState(false);
  const [supersededAt, setSupersededAt] = React.useState(null);

  /* A LAUNCH ELSEWHERE INVALIDATES THIS PLACEMENT. The forecast held is one system's; a cohort
     keyed to a different one must not keep it, because the plate would then lay EP172026's
     forecast over a population built around another storm's genesis and every figure on it would
     be a join between two unrelated things. */
  React.useEffect(() => {
    if (official && official.atcf_id !== launchedSystem) {
      setOfficial(null);
      setSupersededAt(null);
    }
  }, [launchedSystem, official]);

  /**
   * READ THE OFFICIAL FORECAST, AND ACCEPT IT ONLY IF IT IS NOT OLDER THAN WHAT IS HELD.
   *
   * THE STALE-VINTAGE RULE IS THE WHOLE REASON THIS IS NOT A PLAIN setState. The forecast file's
   * payload is regenerated every ten minutes and its `generatedAt` moves every time; the forecast
   * inside it changes only when NHC issues an advisory. A payload rebuilt from a STALE advisory
   * therefore looks newer than the advisory it carries, and accepting it would walk a reader's
   * placement backwards to a superseded forecast while the stamp beside it said the read was
   * fresh. `isNewerVintage` decides on the ADVISORY'S valid time and uses the payload stamp only
   * to break a tie between two reads of the same advisory, where the later read is the one more
   * likely to carry a revision.
   *
   * When a newer advisory IS accepted, nothing recomputes by hand: the alignment below is a memo
   * over these points, so the placement recomputes and the surface says it was superseded.
   */
  const acceptOfficial = React.useCallback((next) => {
    if (!next) return;
    setOfficial((prev) => {
      if (!next.ok) return prev && prev.ok && prev.atcf_id === next.atcf_id ? prev : next;
      if (prev && prev.ok && prev.atcf_id === next.atcf_id
          && !isNewerVintage(prev.vintage, next.vintage)) {
        return prev;
      }
      if (prev && prev.ok && prev.atcf_id === next.atcf_id) {
        setSupersededAt(next.vintage && next.vintage.advisory_valid_at);
      }
      return next;
    });
  }, []);

  /* NO PRESS BETWEEN A LAUNCH AND ITS FORECAST. The forecast layer is already in memory (it is
     read up front so the watch can surface on the top bar), so a cohort keyed to a live system's
     derived genesis gets that system's advisory laid against it at once. The vintage rule above
     still decides whether a re-read replaces what is held. */
  React.useEffect(() => {
    if (!launchedSystem || !forecast) return;
    acceptOfficial(officialFromForecast(forecast, launchedSystem));
  }, [launchedSystem, forecast, acceptOfficial]);

  /* THE ONE CONTROL THAT CAN CHANGE THE VINTAGE: re-read the forecast file. A newer advisory
     replaces the placement through the effect above; an equal-or-older one is refused. */
  const readOfficial = React.useCallback(() => {
    setOfficialLoading(true);
    loadForecast(DATA_BASE).then((f) => {
      setOfficialLoading(false);
      if (f && f.ok) { setForecast(f); globalThis.__ATLAS_FORECAST = f; }
      else if (launchedSystem) acceptOfficial(officialFromForecast(f, launchedSystem));
    }).catch(() => setOfficialLoading(false));
  }, [launchedSystem, acceptOfficial]);

  /* THE ALIGNMENT. One call, one contract: elapsed time is derived from `validMs - genesisMs`
     inside `alignToGenesis`, and the advisory's own `hr` travels as `label_hr` where nothing
     reads it. Recomputes when the forecast changes -- which is what makes a superseded advisory
     a new placement rather than a new stamp over an old one -- and when the cohort changes. */
  const forwardView = React.useMemo(() => {
    if (!archive || !result || !official || !official.ok || !official.points.length) return null;
    const sys = activeSystems.find((s) => s.atcf_id === official.atcf_id);
    if (!sys || !sys.genesis || !Number.isFinite(sys.genesis.t)) return null;

    const aligned = alignToGenesis(archive, result.cases, {
      genesisMs: sys.genesis.t,
      points: official.points.map((p) => ({ validMs: p.validMs, kt: p.kt, label_hr: p.label_hr })),
    });

    /* WHERE THE SUBJECT'S OWN GENESIS WIND SITS IN THIS POPULATION. `forwardDistribution` at
       elapsed 0 IS the cohort's genesis-wind distribution, taken through the same function that
       produced every other row, so the median a reader is told their storm matches is the median
       of the same population and not a second calculation of it. */
    const atGenesis = forwardDistribution(archive, result.cases, 0);
    const rec = live && live.ok ? live.record(official.atcf_id) : null;
    const ships = rec && rec.ships_rt ? rec.ships_rt : null;
    const f = (k) => (ships && ships.fields && ships.fields[k]
      ? ships.fields[k].value : null);

    return {
      system: { name: sys.name, atcf_id: sys.atcf_id, stage_label: sys.stage_label,
        latestKt: sys.latest.kt },
      cohort: {
        N: result.n_cases,
        lat: cohort.where ? cohort.where.lat : null,
        lon: cohort.where ? cohort.where.lon : null,
        radiusKm: cohort.where ? cohort.where.radiusKm : null,
        url: scenarioURL(),
        minSample: FORWARD_MIN_SAMPLE,
        pack: archive.manifest.archive_stamp || null,
        methodology: archive.manifest.methodology_version || null,
      },
      clocks: {
        genesisMs: sys.genesis.t,
        advisoryMs: official.vintage ? official.vintage.advisory_valid_ms : null,
        ageAtAdvisoryH: official.vintage && Number.isFinite(official.vintage.advisory_valid_ms)
          ? (official.vintage.advisory_valid_ms - sys.genesis.t) / 3600000 : 0,
      },
      aligned,
      vintage: official.vintage,
      dropped: official.dropped,
      timing: thresholdTiming(archive, result.cases),
      env: ships ? { shearKt: f("shearKt"), sstC: f("sstC"), mpiKt: f("mpiKt"),
        validTime: ships.valid_time, product: ships.product } : null,
      genesisKt: sys.genesis.kt,
      cohortGenesisMedianKt: atGenesis.median,
    };
  }, [archive, result, official, activeSystems, cohort, live, scenarioURL]);


  /* Clicking the ocean sets the cohort's LOCATION CONDITION -- it does not open a separate
     probe with its own query. That separation was the two-surface problem in miniature. */
  const onProbe = React.useCallback((lat, lon) => {
    setSelected(null);
    setStormPlaying(false);
    setInteracted(true);
    setCohort((c) => normalise({
      ...c, where: { lat, lon, radiusKm: c.where ? c.where.radiusKm : DEFAULT_RADIUS_KM },
    }));
  }, []);

  /* RESET QUERY — ONE OF THREE WAYS OUT, AND THE ONLY ONE THAT TOUCHES THE QUESTION.
   *
   * It clears the CONDITIONS. It does not move the camera, and it does not put the plate's click
   * instruction back: a reader who has used the gesture has used it, and re-teaching them
   * because they cleared a filter would be the surface forgetting what it already knew.
   *
   * The selection goes with the conditions, and that is deliberate rather than incidental: a
   * selected storm is shown against a cohort -- the inspector's bridge is a statement about
   * membership -- so leaving one docked beside a cohort that has just ceased to exist would
   * leave the membership verdict describing nothing. HOME and FIT, which do move the camera,
   * leave both the query and the selection exactly where they were. */
  const onResetQuery = React.useCallback(() => {
    setCohort(normalise(EMPTY_COHORT));
    setSelected(null);
  }, [setCohort]);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      /* ESCAPE DISMISSES ONE THING, AND NEVER THE QUERY.
       *
       * All three of these fired unconditionally, so the key the provenance drawer advertises
       * as its own close key ALSO deleted the reader's genesis-location condition -- and the
       * URL is written with replaceState, so Back could not bring it back. An analyst closing a
       * drawer lost the probe they had spent the session building, with no undo and no notice.
       * Dismissal is now most-recent-first with an early return at each step, and the cohort is
       * not in the chain at all: a condition is removed by its own ✕ or by RESET, both of which
       * are visible, deliberate and next to the thing they remove. */
      if (e.key === "Escape") {
        if (sheetZone) { closeEditor(); return; }
        if (pick) { setPick(null); return; }
        if (provOpen) { setProvOpen(false); return; }
        /* THE HOLD IS DISMISSED BEFORE THE SELECTION, on the same most-recent-first rule the
           drawer and the inspector already follow, and the cohort is still not in the chain. */
        if (heldRow) { setHeldRow(null); setHoverRow(null); return; }
        if (brush) { setBrush(null); return; }
        if (selected !== null) { setSelected(null); return; }
      }
      if (e.key === "p" || e.key === "P") setProvOpen((v) => !v);
      /* THE TWO CAMERA KEYS, ROUTED THROUGH THE MAP'S OWN HANDLE so a keystroke and a click on
         the plate's controls are literally the same call. Neither touches the query. */
      if ((e.key === "h" || e.key === "H") && cameraRef.current) cameraRef.current.home();
      if ((e.key === "f" || e.key === "F") && cameraRef.current) cameraRef.current.fit();
      if (e.key === " " && selected !== null && !(e.target && e.target.closest
        && e.target.closest("button,[role=button]"))) {
        e.preventDefault(); setStormPlaying((v) => !v);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [selected, provOpen, heldRow, brush, sheetZone, closeEditor, pick]);

  /* ── THE INSPECTOR'S ROSTER, THE PICK, THE FRAME AND THE SEAL ──────────────────────────── */

  /* WHAT THE ROSTER LISTS. A ledger row's members are the ENGINE'S member set for that contract
     -- the array that counted its numerator -- and a plate cell's are the cell index's; the
     roster prints the set it is handed and says in words what the set is. */
  const rosterSet = React.useMemo(() => {
    if (!result) return null;
    if (rosterSource && rosterSource.kind === "row") {
      for (const g of buildGroups(result, comparison, null)) {
        for (const row of g.rows) {
          if (row.key !== rosterSource.key || !row.memberRows) continue;
          const what = row.key.startsWith("int:") ? `counted as reaching ${row.label}`
            : `counted in the ${row.label} landfall row`;
          return { rows: row.memberRows, label: what,
            note: row.cell ? `${row.cell.count.toLocaleString()} of ${row.cell.n_storms.toLocaleString()} — the numerator of that row` : null };
        }
      }
    }
    if (rosterSource && rosterSource.kind === "cell") {
      return { rows: rosterSource.rows, label: `through the 2° cell at ${rosterSource.where}`,
        note: "every storm of this cohort with a fix in that cell" };
    }
    return { rows: result.rows, label: "in this cohort", whole: true };
  }, [result, comparison, rosterSource]);

  const onShowMembers = React.useCallback((key) => {
    setRosterSource({ kind: "row", key });
    setTab("storms");
  }, []);

  /* THE LAUNCHED LIVE SYSTEM, FOR THE PLATE: its operational track from derived genesis, the
     official forecast, NHC's cone, the guidance runs and any exposure the watch flagged -- all
     copied from the two operational files, none of it computed here (render/forecast-layer.js).
     Null unless the cohort on screen is keyed to a live system. */
  const forecastOverlay = React.useMemo(() => {
    if (!launchedSystem || !live || !live.ok) return null;
    const rec = live.record(launchedSystem);
    const sys = activeSystems.find((x) => x.atcf_id === launchedSystem);
    const fixes = rec && rec.fixes ? rec.fixes : [];
    const g0 = sys && sys.genesis ? sys.genesis.t : null;
    const best = fixes.filter((f) => g0 === null || Date.parse(f.t) >= g0)
      .map((f) => ({ lat: f.lat, lon: f.lon, kt: f.kt }));
    const fr = forecast && forecast.ok && forecast.storms[launchedSystem] && forecast.storms[launchedSystem].ok
      ? forecast.storms[launchedSystem] : null;
    return {
      atcf_id: launchedSystem,
      name: sys ? sys.name : null,
      advisory: fr ? fr.advisory : null,
      cycle: fr && fr.guidance && fr.guidance.cycle
        ? `${fr.guidance.cycle.slice(6, 8)}/${fr.guidance.cycle.slice(8, 10)}Z cycle` : null,
      best,
      official: fr ? fr.trackPoints.map((p) => ({ lat: p.at[0], lon: p.at[1], kt: p.kt, hr: p.hr })) : [],
      cone: fr && fr.cone ? fr.cone.rings : null,
      runs: fr && fr.guidance ? fr.guidance.runs.map((r) => r.track) : [],
      alerts: fr && fr.watch ? fr.watch.rows.filter((r) => r.outline).map((r) => ({ state: r.state, outline: r.outline })) : [],
    };
  }, [launchedSystem, live, forecast, activeSystems]);

  /* THE PICK, COUNTED FROM THE SAME CELL INDEX THE PLATE'S READOUT USES. */
  const plateBox = React.useRef({ w: 800, h: 500 });
  const onPick = React.useCallback((lat, lon, pt) => {
    if (!archive || !result) return;
    const el = document.querySelector(".at-plate");
    if (el) { const r = el.getBoundingClientRect(); plateBox.current = { w: r.width, h: r.height }; }
    const index = cellIndex(archive, 2.0);
    const cell = cellAt(index, lat, lon);
    const ok = cell >= 0 && cell < index.starts.length - 1;
    const through = ok ? pathwayMembers(index, cell, maskOf(archive.nStorms, result.rows)) : [];
    const formed = ok ? genesisMembers(archive, index, cell, result.rows) : [];
    /* THE SAME CELL, ASKED OF THE LIVE SYSTEM. With a cohort keyed to a live storm, the reader's
       cell is answered twice in one card: how many of the cohort's storms passed through it
       (history) and which of the storm's published lines cross it (forecast). Counts both. */
    const liveHere = ok && forecastOverlay && selected === null
      ? liveInCell(forecastOverlay, cornerOfCell(index, cell), index.step) : null;
    setPick({ lat, lon, x: pt.x, y: pt.y, through, formed, live: liveHere });
    setInteracted(true);
  }, [archive, result, forecastOverlay, selected]);

  /* THE FRAME A COMMITTED QUESTION ASKS FOR -- see autoFrame in map.jsx.
     ONLY A QUESTION ABOUT PLACE MOVES THE MAP. "Formed near here", "formed in this basin" and
     "entered this sub-basin" name a geography, and the plate going there is the answer being
     shown. An intensity, season, month, landfall or scope condition names no place: its cohort
     is spread over the same ocean as the archive, and framing it would move the camera for a
     question that did not ask to look anywhere new. Those leave the plate where it is. */
  const autoFrame = React.useMemo(() => {
    if (!archive || !result) return null;
    /* KEYED ON THE PLACE ALONE, so adding "reached cat 3" to "formed in the NA" does not
       re-frame the Atlantic on a slightly different subset of it. */
    const placed = conditionsOf(cohort).filter((c) => GEOGRAPHIC_KEYS.has(c.key));
    const key = JSON.stringify(placed.map((c) => [c.key, c.sentence]));
    if (!placed.length) return { key, frame: null };
    const extra = forecastOverlay ? [...forecastOverlay.best, ...forecastOverlay.official]
      .map((p) => [p.lat, p.lon]) : null;
    return { key: forecastOverlay ? `${key}|${forecastOverlay.atcf_id}` : key,
      frame: cohortFrame(archive, result.rows, cohort.where, { extra }) };
  }, [archive, result, cohort, forecastOverlay]);

  React.useEffect(() => { globalThis.__ATLAS_AUTOFRAME = autoFrame; }, [autoFrame]);
  const limitsRef = React.useRef(null);
  const toLimits = React.useCallback(() => {
    if (limitsRef.current) limitsRef.current.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);

  /* A SELECTED STORM ADDS THE RECORD TAB; CLEARING IT TAKES THE TAB AWAY AND NEVER LEAVES THE
     INSPECTOR ON A TAB THAT NO LONGER EXISTS. */
  React.useEffect(() => { if (selected === null && tab === "record") setTab("outcomes"); },
    [selected, tab]);

  if (error) return <BootError error={error} />;
  if (!archive || !world || !result) return <Boot manifest={manifest} />;

  const conditions = conditionsOf(cohort);
  const unasked = !interacted && !conditions.length && selected === null;

  /* THE PLATE. */
  const plate = (
    <AtlasMap
      archive={archive} world={world} coast={coast} contextLand={contextLand} rows={contextRows}
      emphasis={emphasis}
      selected={selected} home={home} homeClamp={NA_EP} homeAnchor={homeAnchor}
      evidenceFrame={evidenceFrame} subjectFrame={subjectFrame} cameraApi={cameraRef}
      autoFrame={autoFrame ? { ...autoFrame, suspended: selected !== null } : null}
      onSelect={selectStorm} onProbe={onProbe} onPick={onPick} probe={cohort.where}
      operationalTrack={operationalTrack}
      forecastOverlay={forecastOverlay}
      replayMs={selected !== null && cursorMs !== null ? cursorMs : undefined}
      colorBy={layers.colorBy} dimPopulation={selected !== null || !!forecastOverlay}
      softenEmphasis={showPathway || showGenesisDensity}
      underDensity={showPathway || showGenesisDensity}
      lens={lens}
      brush={brush} onBrush={setBrush}
      plateMode={plateMode} onPlateMode={(m) => { setPlateMode(m); setInteracted(true); }}
      layerControls={<LayerToggles layers={layers} setLayers={setLayers} />}
      showGenesis={layers.genesis} showLandfalls={layers.landfalls}
      showPathway={showPathway} pathway={pathway}
      showGenesisDensity={showGenesisDensity} genesisDensity={genesisGrid}
      pathwayStep={2.0} onViewChange={setView}
      kept={emphasis ? emphasis.length : (contextRows ? contextRows.length : result.kept)}
      context={contextRows ? contextRows.length : 0}
      baselineNoun={comparison && comparison.changed ? comparison.changed.noun : null}
      selectedCount={selected === null ? 0 : 1}
      hint={!unasked && selected === null && !pick
        ? "CLICK THE MAP TO SEE WHAT PASSES THERE · SHIFT-DRAG TO BRUSH" : undefined}
      overlay={pick ? (
        <PickCard pick={pick} archive={archive} where={cohort.where} radiusKm={radiusFor(cohort)}
          plateW={plateBox.current.w} plateH={plateBox.current.h}
          onAsk={() => { const p = pick; setPick(null); onProbe(p.lat, p.lon); }}
          onSelect={selectStorm}
          onHover={setHoverStorm}
          onList={() => {
            const p = pick;
            setRosterSource({ kind: "cell", rows: p.through,
              where: `${Math.abs(p.lat).toFixed(0)}°${p.lat < 0 ? "S" : "N"} ${Math.abs(((p.lon + 540) % 360) - 180).toFixed(0)}°${(((p.lon + 540) % 360) - 180) < 0 ? "W" : "E"}` });
            setTab("storms"); setPick(null);
          }}
          onClose={() => { setPick(null); setHoverStorm(null); }} />
      ) : null}
    >
      {unasked ? <Invitation /> : null}
      <Legend colorBy={layers.colorBy} showPathway={showPathway} probe={!!cohort.where}
        live={selected === null && forecastOverlay ? forecastOverlay : null}
        showGenesisDensity={showGenesisDensity} />
    </AtlasMap>
  );

  /* THE LEDGER IS A SURFACE, NOT A PANEL. It replaces the working surface rather than opening
     beside it: a page that answers "is any of this any good" while the thing being judged is
     still on screen invites the reader to skim it. */
  if (surface === "calibration") {
    return (
      <div data-surface="calibration" data-view="calibration" data-atlas className="atlas-shell" style={{
        position: "fixed", inset: 0,
        background: "var(--surface-app)", color: "var(--text-1)", overflow: "hidden",
      }}>
        <Header archive={archive} onProvenance={() => setProvOpen(true)} />
        <React.Suspense fallback={<LedgerBoot />}>
          {calError ? <LedgerError error={calError} onBack={() => setSurface("tactical")} />
            : cal ? (
              <CalibrationLedger cal={cal} anchor={ledgerAnchor} cohortBasins={cohortBasins}
                onBack={() => { setSurface("tactical"); setLedgerAnchor(null); }}
                onClearAnchor={() => setLedgerAnchor(null)} />
            ) : <LedgerBoot />}
        </React.Suspense>
        <React.Suspense fallback={null}>
          {provOpen ? (
            <ProvenanceDrawer archive={archive} coast={coast} open={provOpen}
              onClose={() => setProvOpen(false)} frame={null} />
          ) : null}
        </React.Suspense>
      </div>
    );
  }

  /* The subject's own verdicts, derived from fields the pack already holds. Membership comes
     from the bridge, which is the one place it is decided. */
  const subject = storm ? {
    id: storm.storm_id,
    name: storm.name,
    inCohort: !!(bridge && bridge.contribution && bridge.contribution.isMember),
    reached: subjectVerdicts(storm),
  } : null;

  /* ── THE INSTRUMENT ──────────────────────────────────────────────────────────────────────
   *
   * FOUR BANDS, AND THE MAP IS THE LARGEST THING IN EVERY ONE OF THEM THAT HOLDS IT.
   *
   *   TOP        the instrument's name, the live systems on the water now, and the three ways
   *              out: the reader's sealed readings, the calibration ledger and provenance.
   *   QUESTION   the question as a sentence whose clauses are its controls, the cohort line,
   *              and every condition a reader can still add, each named as what it asks.
   *   WORK       the plate, as wide as the viewport allows, and the inspector beside it: the
   *              ledger, the roster of storms behind it and -- with a storm selected -- that
   *              storm's record. Selecting a storm takes nothing from the plate.
   *   RECORD     below the fold: why rows have no rate, what the numbers are measured against,
   *              what they assume, the environment. Explained once, in one place.
   *
   * THE SEAL IS ON THE INSPECTOR'S FOOT AT EVERY SCROLL POSITION, because citing a reading is
   * the last thing a reader does with it and should never need finding. */
  const storms = result.kept;
  return (
    <div data-surface="tactical" data-view="tactical" data-atlas ref={shellRef}
      className="atlas-shell atlas-v2" data-tab={tab} style={{
        background: "var(--surface-app)", color: "var(--text-1)",
      }}>
      <a className="v2-skip" href="#atlas-answer">Skip to the answer</a>

      <header className="v2-top" data-topbar>
        <div className="v2-brand">
          <span className="v2-back"><span className="v2-back-w">Millibar</span></span>
          <span className="v2-word">STORM ATLAS</span>
          <span className="v2-scope" title="every storm in the archive formed in these basins">
            {archive.manifest.counts.storms.toLocaleString()} storms · North Atlantic + East Pacific
            {" · "}{bounds[0]}–{bounds[1]}
          </span>
        </div>
        <LiveStrip systems={activeSystems} generatedAt={live ? live.generatedAt : null}
          feed={live && live.ok ? live.feedAge(nowMs) : null}
          currentId={launchedSystem} onLaunch={onLaunchSystem} />
        <nav className="v2-tools" aria-label="the archive's own records">
          <button type="button" className="v2-tool" data-open-readings
            onClick={() => setReadingsOpen(true)}
            title="the readings you sealed in this browser">Readings</button>
          <button type="button" className="v2-tool" data-open-ledger
            onClick={() => openLedger(null)}
            title="how well has the archive's method done? its own backtest">Calibration</button>
          <button type="button" className="v2-tool" onClick={() => setProvOpen(true)}
            title="provenance — every source, stamp and gap (P)">Provenance</button>
        </nav>
      </header>

      <main className="v2-main" id="atlas-main">
        <div className="v2-q atlas-above">
          <QueryHead segments={segments} conditions={conditions}
            scope={conditions.filter((c) => c.zone === "scope")}
            kept={result.kept} total={archive.manifest.counts.storms}
            sufficient={result.sufficient} minSample={result.min_sample}
            lastEdit={lastEdit} spec={cohort}
            notice={<>
              <SealCheck archive={archive} result={result} sealParam={sealLive ? urlSeal : null} />
              <MethodologyMoved was={urlMethodology} now={archive.manifest.methodology_version} />
              <BridgeNotice atcfId={urlAtcf} state={urlAtcfState} cohort={cohort} />
            </>}
            onEdit={(zone, el, section) => { setInteracted(true); openEditor(zone, el, section); }}
            onClear={(key) => setCohort(clearCondition(cohort, key))}
            onReset={onResetQuery} />
        </div>

        <div className="v2-work atlas-plate-row">
          <div className="v2-plate atlas-stage-col">
            {plate}
            {selected !== null ? (
              <div className="v2-transport atlas-transport">
                <Transport archive={archive} row={selected} playing={stormPlaying}
                  setPlaying={setStormPlaying} cursorMs={cursorMs} setCursorMs={setCursorMs}
                  operational={operationalTrack} />
              </div>
            ) : null}
          </div>

          <aside className="v2-insp atlas-answer" id="atlas-answer" data-answer-col
            aria-label="the answer">
            {storm && tab !== "record" ? (
              <SubjectStrip storm={storm} subject={subject} live={liveBundle}
                recordOpen={tab === "record"}
                onRecord={() => setTab(tab === "record" ? "outcomes" : "record")}
                onBridge={() => onBridge(selected)}
                proposed={bridge && bridge.proposed}
                onClear={() => setSelected(null)} />
            ) : null}
            <div className="v2-tabs" role="tablist" aria-label="the answer, three ways">
              <button type="button" role="tab" aria-selected={tab === "outcomes"}
                data-tab-btn="outcomes" onClick={() => setTab("outcomes")}>
                Outcomes
              </button>
              <button type="button" role="tab" aria-selected={tab === "storms"}
                data-tab-btn="storms" onClick={() => setTab("storms")}>
                Storms <span className="v2-tabn">{(rosterSet && !rosterSet.whole
                  ? rosterSet.rows.length : storms).toLocaleString()}</span>
              </button>
              {/* THE THIRD STEP IS ALWAYS NAMED. Without a storm it is disabled and says how to
                  get one, so the workflow -- outcomes, the storms behind them, one storm's record
                  -- is visible before it is needed. */}
              <button type="button" role="tab" aria-selected={tab === "record"}
                data-tab-btn="record" disabled={!storm}
                title={storm ? `${storm.name || "Unnamed"} ${storm.season} — the storm's whole record`
                  : "select a storm on the map or in STORMS to open its record"}
                onClick={() => storm && setTab("record")}>
                {storm ? (storm.name || "Unnamed") : "Record"}
              </button>
            </div>
            <div className="v2-tabbody" role="tabpanel">
              {tab === "outcomes" ? (
                <Ledger result={result} comparison={comparison} subject={subject}
                  archiveTotal={archive.manifest.counts.storms}
                  lensKey={heldRow} onLens={onLens} onShowMembers={onShowMembers}
                  column={ledgerColumn} onColumn={setLedgerColumn}
                  conditions={conditions} onBaseline={setBaselinePin} onLimits={toLimits} />
              ) : tab === "storms" && rosterSet ? (
                <Roster archive={archive} rows={rosterSet.rows} label={rosterSet.label}
                  sourceNote={rosterSet.note || null}
                  onClearSource={rosterSet.whole ? null : () => setRosterSource(null)}
                  cohortSize={result.kept}
                  selected={selected} onSelect={(r) => selectStorm(r, { keepTab: true })}
                  onHover={setHoverStorm} />
              ) : tab === "record" && storm ? (
                <div className="v2-record-tab" data-inspector-dock>
                  <StormPanel storm={storm} archive={archive} onClose={() => setSelected(null)}
                    recordFirst
                    onReplay={() => setStormPlaying((v) => !v)} replaying={stormPlaying}
                    spec={stormCitation} specUrl={scenarioURL({ withStorm: true })}
                    bridge={bridge} cohortSentence={sentence} result={result}
                    onBridge={() => onBridge(selected)}
                    live={liveBundle}
                    cursorLive={cursorMs !== null || stormPlaying} />
                </div>
              ) : null}
            </div>
            <div className="v2-sealbar" data-seal-bar>
              <button type="button" className="v2-seal" data-open-seal
                onClick={() => setSealOpen(true)}
                title="seal this reading: fingerprint its storms, bind its figures, download it">
                <SealGlyph /> SEAL THIS READING
              </button>
              {/* THE FINGERPRINT IS ALREADY ON SCREEN BEFORE THE PRESS. It is the storms' own
                  identity and it changes with every edit, so the reader sees that the seal is a
                  property of THIS set of storms -- and, on a sealed link, that it still matches. */}
              <span className="v2-sealnote" data-seal-preview>
                <span>
                  {sealLive && urlSeal && liveFp === String(urlSeal).toLowerCase()
                    ? <b className="v2-seal-ok">✓ LINK VERIFIED · </b> : null}
                  {result.kept.toLocaleString()} storms · method {archive.manifest.methodology_version}
                </span>
                <span>fingerprint <b>{liveFp}</b></span>
              </span>
            </div>
          </aside>
        </div>
      </main>

      <MobileNav tab={tab} setTab={setTab} storms={(rosterSet && !rosterSet.whole
        ? rosterSet.rows.length : storms)} onSeal={() => setSealOpen(true)} />

      {launchedSystem ? (
        <div className="atlas-forward v2-forward" data-forward-row>
          {forwardView ? (
            <React.Suspense fallback={null}>
              <ForwardOutcome {...forwardView}
                onRefresh={() => readOfficial()}
                refreshing={officialLoading}
                supersededAt={supersededAt} />
            </React.Suspense>
          ) : official && !official.ok ? (
            <Note hook="data-forward-unavailable">
              <b>NO OFFICIAL FORECAST LAID AGAINST THIS COHORT.</b> The forecast could not be
              read — {official.error}. Every figure below is the archive&rsquo;s own and is
              unaffected: the forward view is a reference layer over it, not a part of it.
            </Note>
          ) : (
            <div className="at-fo-offer" data-forward-offer>
              <TextButton onClick={() => readOfficial()}
                hook="data-forward-load"
                title="re-reads the forecast file the capture feeds (about 17 KB) and places each
                       of its points against this cohort by absolute valid time">
                {officialLoading || !forecast ? "READING THE ADVISORY…"
                  : `RE-READ THE OFFICIAL ${launchedSystem} FORECAST →`}
              </TextButton>
              <span>Places each forecast point against this population by <b>absolute valid
                time</b>, never by matching lead-hour labels.</span>
            </div>
          )}
        </div>
      ) : null}

      <section className="v2-below atlas-evidence" data-evidence-row aria-label="the record behind this reading">
        <EvidenceRecord result={result} comparison={comparison} subject={subject}
          onEvidence={openLedger} limitsRef={limitsRef}
          conditions={conditions} onBaseline={setBaselinePin}
          whatChanged={whatChanged}
          citation={citation} citationUrl={scenarioURL()} onSeal={() => setSealOpen(true)}
          spec={cohort} pathway
          environment={<EnvLens archive={archive} coverage={envCov} lens={envLens}
            loading={envLoading} onLoad={loadEnv} />} />
      </section>

      {sheetZone ? (
        <div className="at-sheet" data-builder-sheet data-sheet-anchored={sheetAt ? "" : undefined}
          role="dialog" aria-label="edit conditions" aria-modal="false"
          style={sheetAt ? { left: sheetAt.left, top: sheetAt.top,
            ...(sheetAt.maxHeight ? { maxHeight: sheetAt.maxHeight } : {}) } : undefined}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); closeEditor(); } }}>
          <div className="at-sheet-hd">
            <span>EDIT CONDITIONS</span>
            <button type="button" className="at-sheet-x" data-sheet-close
              onClick={closeEditor} aria-label="close">×</button>
          </div>
          <div className="at-sheet-body">
            <CohortBuilder archive={archive} cohort={cohort}
              setCohort={(f) => setCohort(normalise(f))}
              result={result} preview={preview} bounds={bounds}
              sentence={sentence} conditions={conditions}
              envCoverage={envCov} focusSection={sheetSection}
              onReset={() => { setCohort(normalise(EMPTY_COHORT)); setSelected(null); }} />
          </div>
        </div>
      ) : null}

      <Colophon archive={archive} citation={citation} citationUrl={scenarioURL()}
        onProvenance={() => setProvOpen(true)} onLedger={() => openLedger(null)} />

      <React.Suspense fallback={null}>
        {provOpen ? (
          <ProvenanceDrawer archive={archive} coast={coast} open={provOpen}
            onClose={() => setProvOpen(false)} frame={view ? view.frame : null} />
        ) : null}
      </React.Suspense>

      {sealOpen ? (
        <SealPanel archive={archive} spec={cohort} result={result} question={sentence}
          baseline={comparison && context ? { noun: comparison.changed ? comparison.changed.noun : null, result: context } : null}
          citation={citation} url={scenarioURL()}
          onClose={() => setSealOpen(false)} />
      ) : null}
      {readingsOpen ? <ReadingsPanel onClose={() => setReadingsOpen(false)} /> : null}
    </div>
  );
}


/* THE OPENING VIEW.
 *
 * WHY NOT THE ARCHIVE'S FULL EXTENT. `genesisBounds` returns the min/max of every genesis
 * coordinate, and this archive holds 343 storms with a West Pacific genesis -- IBTrACS keeps
 * dateline crossers in the loaded basin files -- so its longitude range runs -179.8 to +180.0.
 * That is 359.8 degrees, and fitting it opened the plate on the entire planet at the minimum
 * zoom: measured, latitude -88.5 to +89.4 on a 1920x1742 workstation, Antarctica and the Arctic
 * both on screen and 13.7% of the plate carrying any track ink. The reader met a dark void with
 * a band in it.
 *
 * WHAT THIS FRAMES INSTEAD. The archive's own mass, in three measured steps and nothing else:
 *
 *   1. THE DOMINANT LOBE. Longitude is bimodal here -- a North Atlantic / East Pacific lobe and
 *      a West Pacific tail of 343 storms, with 128 degrees of empty longitude between them:
 *      from 14W to 114E this archive holds not one genesis. The lobe is taken as every genesis
 *      within LOBE_DEG of the archive's MEDIAN genesis longitude, measured the short way round.
 *      Measured on this pack: 3,588 of 3,905 storms, 91.9%, which is precisely the North
 *      Atlantic plus East Pacific the plate is titled for.
 *   2. ITS CORE LONGITUDE, at the 1st and 99th percentile of that lobe. Percentiles rather than
 *      extremes because one storm at 179.8W should not widen the opening view by 15 degrees.
 *   3. ITS LATITUDE BAND -- a TROPICAL/RECURVATURE band rather than the full extent of the ink.
 *      The floor comes from the lobe's GENESIS latitudes at q0.5 (7.2N on this pack): nothing
 *      forms below the deep tropics, and the archive's single 1.9N genesis should not pull the
 *      band down five degrees on its own. The ceiling comes from the lobe's TRACK latitudes at
 *      q97.5 (47.4N): the plate draws whole trajectories, and a storm that forms at 12N and
 *      recurves to 45N occupies all of that -- but the last 2.5% of fixes are extratropical
 *      tails running to 66N, and framing for them opens the plate on the Labrador Sea.
 *
 * WHAT IT COMES OUT AS, on this pack: 7.2N to 47.4N, 166.3W to 17.4W. That is 148.9 degrees of
 * longitude against 40.2 of latitude -- in Web Mercator a band 3.19 times wider than it is tall,
 * which is within a hundredth of the plate's own 3.2 ceiling. That is the point of the band:
 * FRAME AND PLATE ARE THE SAME SHAPE, so at a workstation width the fit is nearly exact in both
 * axes and neither a crop nor a margin of empty ocean is doing any work. 98.6% of the lobe's
 * track fixes are inside it.
 *
 * AND IT IS CLAMPED, WHICH IS THE PART A PERCENTILE CANNOT DO. Percentiles bound the FRAME; they
 * do not bound the VIEW, and the view is what a reader sees. Measured on the previous model at
 * 1920x1080: the frame was 2.14 wide against a 3.04 plate, so the contain fit bound on latitude
 * and opened 253 degrees of longitude -- 141E to 34E, the whole West Pacific and half of Asia,
 * on a plate captioned NORTH ATLANTIC + EAST PACIFIC. NA_EP below is the research geography the
 * plate declares, and applyFrame in map.jsx will not open a view outside it.
 *
 * NOTHING HERE IS A CLAIM. It is a camera position, derived from coordinates the pack already
 * holds, and it changes only where the map opens: pan, zoom and every filter behave exactly as
 * before, and the West Pacific is one drag away. The percentiles are stated here rather than
 * tuned by eye so the framing moves with the archive if the archive moves.
 */
const LOBE_DEG = 110;      // half-width of the dominant-lobe window, in degrees of longitude
const CORE_Q = 0.01;       // the lobe's core longitude, at q1..q99
const GENESIS_Q = 0.005;   // the band's south edge, at q0.5 of the lobe's genesis latitudes
const RECURVE_Q = 0.975;   // the band's north edge, at q97.5 of the lobe's track latitudes

/* THE RESEARCH GEOGRAPHY, STATED ONCE, AS A BOX.
 *
 * The plate is captioned NA + EP and every rate on the surface is computed over storms that
 * formed in those two basins. This is that caption as coordinates: the equator south, 65N north
 * (past which the archive holds only extratropical remnants), the antimeridian west (past which
 * is the West Pacific, and the 371 dateline crossers IBTrACS keeps in the loaded basin files are
 * the reason the percentiles above are taken over a LOBE rather than over everything), and the
 * prime meridian east (the archive's easternmost genesis is 9.5W).
 *
 * It is a CAMERA bound and nothing else. No storm is filtered by it, no rate is computed from
 * it, and a reader who drags west finds the West Pacific tail exactly where it always was. What
 * it forbids is the surface OPENING on geography it does not research. */
export const NA_EP = [[0, -180], [65, 0]];

/* WHERE THE APERTURE IS CENTRED, WHICH IS NOT THE MIDDLE OF WHAT IT FRAMES.
 *
 * `coreFrame` returns a RANGE -- the lobe's 1st to 99th percentile of genesis longitude -- and a
 * range has two ends. On this pack those ends are 164W and 17W, so its midpoint is 91W: twelve
 * degrees west of where the storms are, because the East Pacific tail is longer than the
 * Atlantic one. That costs nothing while the plate is wide enough to show the whole range, and
 * it costs the Atlantic main development region the moment the plate is not.
 *
 * The instrument's plate is 777px beside the answer at 1440 under the contract's split, and the
 * research clamp allows about 133 of the frame's 149 degrees at that shape -- so sixteen degrees
 * are cropped and WHICH sixteen is a decision somebody has to make. Centred on the median it is the sparse ends of both tails;
 * centred on the midpoint it was eight degrees off the east, which is the densest genesis
 * region in the archive.
 *
 * A MEDIAN, NOT A MIDPOINT, AND THE DIFFERENCE IS THE WHOLE ARGUMENT: a midpoint moves when one
 * storm forms further west, a median does not. Measured on this pack: 79.4W, 15.5N. Nothing here
 * is typed -- it is read from the same genesis columns `coreFrame` frames -- so it moves with the
 * archive rather than needing to be re-measured by hand when the archive grows. */
export function coreAnchor(archive) {
  const glat = archive.genesisLat;
  const glon = archive.genesisLon;
  const lats = [];
  const lons = [];
  for (let i = 0; i < archive.nStorms; i++) {
    if (Number.isNaN(glat[i])) continue;
    lats.push(glat[i]);
    lons.push(glon[i]);
  }
  if (!lons.length) return null;
  lats.sort(asc);
  lons.sort(asc);
  return [quantile(lats, 0.5), quantile(lons, 0.5)];
}

export function coreFrame(archive) {
  const glat = archive.genesisLat;
  const glon = archive.genesisLon;

  const lons = [];
  for (let i = 0; i < archive.nStorms; i++) {
    if (!Number.isNaN(glat[i])) lons.push(glon[i]);
  }
  if (!lons.length) return genesisBounds(archive);
  const median = quantile(lons.slice().sort(asc), 0.5);

  /* Short-way separation, so a lobe that straddles the antimeridian is still one lobe. */
  const near = (lon) => {
    const d = Math.abs(lon - median) % 360;
    return (d > 180 ? 360 - d : d) <= LOBE_DEG;
  };

  const lobeLon = [];
  const lobeLat = [];
  const rows = [];
  for (let i = 0; i < archive.nStorms; i++) {
    if (Number.isNaN(glat[i]) || !near(glon[i])) continue;
    lobeLon.push(glon[i]);
    lobeLat.push(glat[i]);
    rows.push(i);
  }
  if (lobeLon.length < 2) return genesisBounds(archive);
  lobeLon.sort(asc);
  lobeLat.sort(asc);

  /* The latitude the plate has to hold at the TOP is the one the TRACKS reach, not the one they
     start at -- a storm that forms at 12N and recurves to 45N occupies all of it. At the BOTTOM
     it is the one they start at: nothing forms below the deep tropics, and a track that dips a
     degree south of its own genesis is not a reason to open the plate on the equator. Sampled
     every third fix: the band is a framing decision, not a measurement anyone cites. */
  const lat = [];
  for (const i of rows) {
    const [s, e] = archive.trackRange(i);
    for (let k = s; k < e; k += 3) lat.push(archive.ptLat[k] / 100);
  }
  if (!lat.length) return genesisBounds(archive);
  lat.sort(asc);

  const south = quantile(lobeLat, GENESIS_Q);
  const north = quantile(lat, RECURVE_Q);
  return [[south, quantile(lobeLon, CORE_Q)], [north, quantile(lobeLon, 1 - CORE_Q)]];
}

/* THE BOUNDING BOX OF A SET OF DRAWN TRACKS, which is what FIT frames and what selecting a
 * storm frames.
 *
 * LONGITUDE IS UNWRAPPED BEFORE IT IS BOUNDED, and without that this function is wrong in
 * exactly the case it matters. This archive holds 371 storms whose tracks cross the
 * antimeridian, so a naive min/max over their longitudes returns -180 and +180 -- a "bounding
 * box" spanning the entire planet for a cohort occupying forty degrees of it. The fixes are
 * shifted by whole turns to sit within 180 degrees of the set's own median first, so the span is
 * measured the short way round and the resulting box may legitimately run past ±180. Leaflet
 * accepts that and the map is not world-wrapped, so the camera lands where the storms are.
 *
 * SAMPLED, because this is a camera position and not a measurement anyone cites: every third fix
 * for a population, every fix for a single storm, where the difference between a track's true
 * extreme and a sampled one is a few pixels of margin.
 */
export function rowsFrame(archive, rows, { stride = 3, extra = null } = {}) {
  if (!archive) return null;
  if ((!rows || !rows.length) && !(extra && extra.length)) return null;
  const lats = [];
  const lons = [];
  for (const i of rows || []) {
    const [a, b] = archive.trackRange(i);
    for (let k = a; k < b; k += stride) {
      lats.push(archive.ptLat[k] / 100);
      lons.push(archive.ptLon[k] / 100);
    }
  }
  /* POSITIONS THAT ARE NOT IN THE PACK. The operational track is the only caller: its fixes are
     drawn on the plate and must therefore be inside what FIT frames, but they belong to no pack
     row. Unioned in BEFORE the median is taken, so the unwrapping below measures the span of what
     is actually on screen rather than of the archive half of it. */
  for (const [la, lo] of extra || []) {
    if (la === null || lo === null || la === undefined || lo === undefined) continue;
    lats.push(la);
    lons.push(lo);
  }
  if (!lats.length) return null;
  const mid = quantile(lons.slice().sort(asc), 0.5);
  let s = Infinity;
  let n = -Infinity;
  let w = Infinity;
  let e = -Infinity;
  for (let k = 0; k < lats.length; k++) {
    const la = lats[k];
    let lo = lons[k];
    while (lo - mid > 180) lo -= 360;
    while (mid - lo > 180) lo += 360;
    if (la < s) s = la;
    if (la > n) n = la;
    if (lo < w) w = lo;
    if (lo > e) e = lo;
  }
  /* A single fix, or a storm that never moved, is a degenerate box no fit can use. Padded to a
     degree so the camera lands on a place rather than dividing by zero. */
  if (n - s < 0.5) { s -= 0.5; n += 0.5; }
  if (e - w < 0.5) { w -= 0.5; e += 0.5; }
  return [[s, w], [n, e]];
}

/* THE FRAME A COHORT ASKS FOR, WHICH IS ITS CORE AND NOT ITS EXTREMES.
 *
 * `rowsFrame` is FIT's frame and it is right for FIT: a reader who presses FIT is asking to see
 * everything drawn, extratropical tails to 60N included. A camera that follows a question needs
 * the opposite -- where the storms of this cohort actually are -- or one storm that recurved to
 * Newfoundland frames a 500 km East Pacific cohort as the whole North Atlantic. So this is the
 * box of the cohort's fixes at q3..q97, unioned with the location condition's own circle so the
 * circle a reader drew is always inside what they are shown. A camera position, not a claim. */
/* THE SEAL'S MARK: a ring with a keyed centre, drawn in the button's own ink. */
function SealGlyph() {
  return (
    <svg className="v2-seal-g" width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="6.5" cy="6.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="0.8"
        strokeDasharray="1.2 1.1" />
      <circle cx="6.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

/* THE PHONE'S WAY THROUGH THE ANSWER. On a 390px screen the question, the map and the ledger are
   three screens apart, and nothing said the outcomes and the storms were below the map. This bar
   is fixed at the foot of the screen and names the four places a reader goes: the map, the
   outcomes, the storms, and the seal. It says where the reader is, and each press is one move --
   the tab is set and the page scrolls to it. Hidden above 760px, where all four are on screen. */
function MobileNav({ tab, setTab, storms, onSeal }) {
  const [where, setWhere] = React.useState("map");
  React.useEffect(() => {
    const plate = document.querySelector(".v2-plate");
    const insp = document.querySelector("#atlas-answer");
    if (!plate || !insp || typeof IntersectionObserver === "undefined") return undefined;
    const seen = new Map();
    const io = new IntersectionObserver((es) => {
      for (const e of es) seen.set(e.target, e.intersectionRatio);
      setWhere((seen.get(insp) || 0) > (seen.get(plate) || 0) ? "answer" : "map");
    }, { threshold: [0, 0.15, 0.35, 0.6, 1] });
    io.observe(plate); io.observe(insp);
    return () => io.disconnect();
  }, []);
  const go = (sel, t) => {
    if (t) setTab(t);
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const on = (k) => (k === "map" ? where === "map" : where === "answer" && tab === k);
  return (
    <nav className="v2-mnav" data-mobile-nav aria-label="jump to">
      <button type="button" aria-current={on("map") ? "true" : undefined}
        onClick={() => go(".v2-plate")}>Map</button>
      <button type="button" aria-current={on("outcomes") ? "true" : undefined}
        onClick={() => go("#atlas-answer", "outcomes")}>Outcomes</button>
      <button type="button" aria-current={on("storms") ? "true" : undefined}
        onClick={() => go("#atlas-answer", "storms")}>Storms <span>{Number(storms).toLocaleString()}</span></button>
      <button type="button" className="v2-mnav-seal" onClick={onSeal}>Seal</button>
    </nav>
  );
}

/* THE HELD ROW'S STORMS ARE DRAWN IN THE ROW'S OWN INK -- the class colour its ledger bar
   already carries, or the landfall pink -- so the eye can go from the row to its storms on the
   plate without a legend, and the lifted set cannot be mistaken for the cohort's blue. */
function lensInkOf(key) {
  const m = /^int:(\w+)$/.exec(String(key || ""));
  if (m && CATEGORY_COLOR[m[1]]) return CATEGORY_COLOR[m[1]];
  if (/^lf:/.test(String(key || ""))) return LANDFALL_INK;
  return null;
}

const GEOGRAPHIC_KEYS = new Set(["where", "basins", "subbasinsEntered"]);

export function cohortFrame(archive, rows, where = null, { lo = 0.03, hi = 0.97, extra = null } = {}) {
  if (!archive) return null;
  const lats = [];
  const lons = [];
  const total = rows ? rows.length : 0;
  const stride = total > 1500 ? 4 : total > 400 ? 3 : 2;
  for (const i of rows || []) {
    const [a, b] = archive.trackRange(i);
    for (let k = a; k < b; k += stride) {
      lats.push(archive.ptLat[k] / 100);
      lons.push(archive.ptLon[k] / 100);
    }
  }
  let s = Infinity; let n = -Infinity; let w = Infinity; let e = -Infinity;
  if (lats.length) {
    const mid = quantile(lons.slice().sort(asc), 0.5);
    const un = lons.map((lo0) => {
      let v = lo0;
      while (v - mid > 180) v -= 360;
      while (mid - v > 180) v += 360;
      return v;
    }).sort(asc);
    const la = lats.slice().sort(asc);
    s = quantile(la, lo); n = quantile(la, hi);
    w = quantile(un, lo); e = quantile(un, hi);
  }
  if (where) {
    const dLat = where.radiusKm / 111.2;
    const dLon = where.radiusKm / (111.2 * Math.max(0.2, Math.cos(where.lat * Math.PI / 180)));
    s = Math.min(s, where.lat - dLat); n = Math.max(n, where.lat + dLat);
    w = Math.min(w, where.lon - dLon); e = Math.max(e, where.lon + dLon);
  }
  /* A LAUNCHED LIVE SYSTEM'S OWN TRACK AND FORECAST, so the storm the cohort is keyed to is on
     the plate with it. Unwrapped next to the frame's centre, as the cohort's longitudes are. */
  if (extra && extra.length && Number.isFinite(s) && Number.isFinite(w)) {
    const mid = (w + e) / 2;
    for (const [la, lo0] of extra) {
      let v = lo0;
      while (v - mid > 180) v -= 360;
      while (mid - v > 180) v += 360;
      s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, v); e = Math.max(e, v);
    }
  }
  if (!Number.isFinite(s) || !Number.isFinite(w)) return null;
  if (n - s < 4) { const c = (n + s) / 2; s = c - 2; n = c + 2; }
  if (e - w < 6) { const c = (e + w) / 2; w = c - 3; e = c + 3; }
  return [[s, w], [n, e]];
}

function asc(a, b) { return a - b; }

function quantile(sorted, p) {
  const i = Math.round(p * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(sorted.length - 1, i))];
}

/* WHAT CHANGED UNDER A LINK SOMEONE ALREADY HAD.
 *
 * Shown only when a URL carries a methodology version other than this build's. It does not
 * refuse to answer -- the cohort is the same cohort and the counts are the same counts -- it
 * says which definitions moved, because the one thing a reader of a shared scenario cannot do
 * is notice that the refusals were recomputed. 1.1.0 is named specifically: it is the only bump
 * so far and the only one whose effect a reader would see. */
/* THE BRIDGE, ACKNOWLEDGED. A reader who arrived from the original pipeline asked two things of this URL:
   the cohort (genesis neighbourhood, month) and the storm itself. The cohort always opens. The
   storm opens only when the pack holds it, and the pack is IBTrACS, which publishes a live storm
   days after it forms — so the common case for a storm that is on the live board RIGHT NOW is that
   it is not here yet, and that has to be said rather than left as a selection that silently did
   not happen. Nothing about the cohort's answer changes either way. */
function BridgeNotice({ atcfId, state, cohort }) {
  if (!atcfId || !state) return null;
  const id = String(atcfId).toUpperCase();
  const ok = state === "resolved";
  /* WHAT THE COHORT ON SCREEN ACTUALLY IS, read from the spec rather than assumed. The notice
     used to assert "the storm's genesis neighbourhood and the month it formed in" whenever an
     id was present -- over a whole-archive cohort, and over a bridge that never sets a month. */
  const keyed = cohort && cohort.where;
  const withMonth = keyed && cohort.months && cohort.months.length;
  const cohortLine = keyed
    ? `The cohort is keyed to where it formed${withMonth ? " and the month it formed in" : ""}; every count in it is a storm that already happened, and none of them is a forecast for this one.`
    : "This link carries no genesis condition, so the cohort is whatever the rest of the link asked for — not a neighbourhood of this storm.";
  const HEAD = {
    resolved: `OPENED BY LINK · ${id} SELECTED`,
    pending: `OPENED BY LINK · ${id} IS NOT IN THIS ARCHIVE PACK YET`,
    past: `OPENED FROM A LINK · ${id} IS NOT IN THIS ARCHIVE`,
    invest: `OPENED FROM A LINK · ${id} IS AN INVEST NUMBER`,
    ambiguous: `OPENED FROM A LINK · ${id} IS AMBIGUOUS IN THIS PACK`,
    malformed: `OPENED FROM A LINK · “${atcfId}” IS NOT AN ATCF ID`,
  };
  const WHY = {
    resolved: "The storm's own record is selected on the plate. ",
    pending: "The archive is IBTrACS, which publishes a running season with a lag of days; the live storm joins by ATCF id only once its row exists. ",
    past: "Its season is already in the pack and no row carries this id, so waiting will not bring it. ",
    invest: "Numbers 90–99 designate disturbances, and this archive holds storms only. ",
    ambiguous: "Two rows claim this id, and a join that could land on either is refused rather than resolved to the first. ",
    malformed: "An ATCF id for these basins is AL, EP or CP, a two-digit number and a four-digit season — EP162026. Nothing was selected. ",
  };
  const warn = !ok;
  return (
    <div data-atlas-bridge-notice={state === "pending" ? "missing" : state} data-bridge-reason={state}
      className="at-notice" style={{
      borderLeft: "var(--bw-signal) solid " + (warn ? "var(--warn)" : "var(--accent)"),
      background: "color-mix(in srgb, " + (warn ? "var(--warn)" : "var(--accent)") + " 6%, transparent)",
    }}>
      <div className="at-notice-hd" style={{ color: warn ? "var(--warn)" : "var(--accent)" }}>
        {HEAD[state] || HEAD.pending}
      </div>
      <div className="at-notice-bd">{(WHY[state] || WHY.pending) + cohortLine}</div>
    </div>
  );
}

/* THE METHODOLOGY MOVED UNDER A LINK. What moved is said by release, from engine/methodology.js,
   so a link made under 1.1.0 and opened under 1.1.1 is told that counts may differ (1.1.1 changed
   which storms have a known outcome), not the 1.1.0 refusal story it used to hear whatever the
   versions were. */
function MethodologyMoved({ was, now }) {
  const moved = methodologyMoved(was, now);
  if (!moved) return null;
  return (
    <div className="at-notice" data-methodology-moved={moved.direction} style={{
      borderLeft: "var(--bw-signal, 3px) solid var(--warn)",
      background: "color-mix(in srgb, var(--warn) 6%, transparent)",
    }}>
      <div className="at-notice-hd" style={{ color: "var(--warn)" }}>
        THE METHODOLOGY MOVED SINCE THIS LINK WAS MADE · {was} → {now}
      </div>
      <div className="at-notice-bd">
        {moved.sentences.map((t, i) => <p key={i} style={{ margin: i ? "4px 0 0" : 0 }}>{t}</p>)}
      </div>
    </div>
  );
}

function LedgerBoot() {
  return (
    <div className="atlas-calibration" style={{ display: "flex", alignItems: "center",
      justifyContent: "center", color: "var(--text-2)", ...MONO,
      fontSize: "var(--fs-mono-sm)" }}>
      reading the calibration ledger…
    </div>
  );
}

/* A ledger that will not load says so and offers the way back. It does NOT fall through to an
   empty page: a calibration surface that renders nothing reads exactly like a calibration
   surface with nothing to report. */
function LedgerError({ error, onBack }) {
  return (
    <div className="atlas-calibration" style={{ display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "var(--sp-4)",
      padding: "var(--sp-8)", textAlign: "center" }}>
      <div style={{ ...MONO, fontSize: "var(--fs-mono-md)", color: "var(--neg)",
        letterSpacing: "var(--track-label)" }}>[ THE LEDGER COULD NOT BE READ ]</div>
      <div style={{ ...MONO, fontSize: "var(--fs-mono-xs)", color: "var(--text-2)",
        maxWidth: "60ch", lineHeight: "var(--lh-body)" }}>
        {String(error && error.message ? error.message : error)}
        <br /><br />
        No calibration figures are shown rather than stale ones. The scores this page reports
        are the archive's; without the file there is nothing to report.
      </div>
      <button type="button" onClick={onBack} style={{
        ...MONO, fontSize: "var(--fs-mono-xs)", padding: "5px 10px", background: "transparent",
        border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
        color: "var(--text-2)", cursor: "pointer",
      }}>← BACK TO THE MAP</button>
    </div>
  );
}

/* The archive's scale, on screen before anything is interactive. Counts come from the pack that
   was actually loaded -- not from a constant, and not from MANIFEST.json, which is stale for
   two of these tables. */
function ScaleLine({ manifest, dim }) {
  if (!manifest) return null;
  const c = manifest.counts;
  const items = [
    [c.storms, "STORMS"],
    [c.track_points, "TRACK POINTS"],
    [c.genesis_events, "GENESIS EVENTS"],
    [c.landfalls, "LANDFALLS"],
    [c.environment, "ENVIRONMENT OBS"],
  ];
  /* THE LADDER FOR THIS STRIP IS ALREADY WRITTEN, AND NOTHING WAS MATCHING IT.
     atlas.css declares `.at-ledger` and `.at-fig` with a measured degradation ladder -- drop the
     fifth figure at 1560, the fourth at 1400, the third at 1240, the rest at 1040 -- under the
     rule that a caption band gives up whole items rather than half a word. This element carried
     no classes at all, so none of it applied and the strip wrapped to a second line inside a
     54px header instead. Using the classes switches on the behaviour the stylesheet was written
     and commented for. The `dim` boot variant keeps its inline opacity: it is a state of this
     component, not of the band. */
  return (
    <div className="at-ledger" style={dim ? { opacity: 0.75 } : undefined}>
      {items.map(([n, label]) => (
        <span className="at-fig" key={label}>
          <b>{n.toLocaleString()}</b>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

function Header({ archive, onProvenance, onLedger }) {
  const m = archive.manifest;
  const p = m.provenance || {};
  return (
    <header className="at-header">
      <div className="at-brand">
        <h1>Storm Atlas</h1>
        {/* The tagline ellipsises before the rail's floor does, so the whole of it is carried
            as the element's own title as well as its text. */}
        <div className="at-sub" title="Millibar · genesis-to-intensity archive">
          <span>Millibar</span>
          {" · genesis-to-intensity archive"}
        </div>
      </div>
      <ScaleLine manifest={m} />
      <div className="at-sys">
        <div className="at-stack">
          <div title={`METHODOLOGY ${m.methodology_version} · ${archiveIdOf(m)}PACK ${p.archive_stamp}`}>
            METHODOLOGY <em>{m.methodology_version}</em> · PACK <em>{p.archive_stamp}</em>
          </div>
          <div title={`BUILT ${p.archive_built_utc || ""}`}>
            BUILT <em>{(p.archive_built_utc || "").replace("T", " ").replace(/:\d\dZ?$/, "Z")}</em>
          </div>
        </div>
        {/* NOT BEHIND A TOGGLE. The ledger is how a reader checks whether anything else on this
            site is worth believing, so it sits in the masthead beside provenance rather than
            inside a panel someone has to know to open. */}
        {onLedger ? (
          <TextButton onClick={onLedger} hook="data-open-ledger"
            title="how well calibrated is this? the archive's own backtest">Calibration</TextButton>
        ) : null}
        <TextButton onClick={onProvenance} title="provenance (P)">Provenance</TextButton>
      </div>
    </header>
  );
}

/* The one instruction the surface gives, placed where the gesture happens. */
function Invitation() {
  /* THE STYLESHEET'S OWN PLACEMENT, AT THE HEAD OF THE PLATE. atlas.css declares `.at-invite`
     -- top-centred, hanging off the head rule, with the gutter that keeps it clear of the
     camera controls -- and records why: at the foot the instruction landed on the longitude
     labels, the attribution and the density legend, and centred over the band it sat on the
     Gulf of Mexico, which is the one stretch of water a reader of this plate looks at first.
     The head of the plate is empty at rest. The component used to restate all of this inline,
     as a bordered, rounded box, and the rule sat dead beside it. */
  return (
    <div className="at-invite" data-invitation>
      <em>Click the map</em> — the storms that pass there, and a button to ask what formed near
      it · <em>click a genesis point</em> for one storm · <em>+ add</em> a condition above
    </div>
  );
}

/* Every density surface on screen has to name what its shading COUNTS. A coloured grid over a
   map is read as a probability unless it says otherwise, and neither of these is one. */
function Legend({ colorBy, showPathway, showGenesisDensity, probe, live = null }) {
  const items = [["ts", "TS"], ["cat1", "1"], ["cat2", "2"], ["cat3", "3"], ["cat4", "4"],
    ["cat5", "5"]];
  const surfaces = [];
  /* THE LABELS ARE THE MODE'S OWN: Pathway counts, Genesis counts. A count of distinct storms
     per cell, deduped by storm id, and never a probability -- said beside the shading, because a
     shaded ocean is read as a forecast cone unless it says otherwise. */
  if (showPathway) {
    surfaces.push(["79, 195, 247", "PATHWAY COUNTS",
      probe ? "matched storms per 2° cell · not a forecast"
        : "cohort storms per 2° cell · not a forecast"]);
  }
  if (showGenesisDensity) {
    surfaces.push(["155, 123, 240", "GENESIS COUNTS",
      "storms formed per 2° cell · a count, not a rate"]);
  }
  if (colorBy !== "intensity" && !surfaces.length && !live) return null;
  /* THE LIVE SYSTEM'S MARKS, NAMED. They are the only achromatic marks on the plate, and each
     says what it is and whose it is: none of them is the archive's. */
  const swatch = (dash, w = 1.6, op = 1) => (
    <svg width="18" height="6" aria-hidden="true" style={{ flex: "none" }}>
      <line x1="0" y1="3" x2="18" y2="3" stroke="#e6e8eb" strokeOpacity={op} strokeWidth={w}
        strokeDasharray={dash || undefined} />
    </svg>);
  const liveRows = live ? [
    [swatch(null, 2), `${live.name || live.atcf_id} · track since derived genesis`],
    live.official.length ? [swatch("5 4"), `NHC #${live.advisory} forecast · NHC's own cone`] : null,
    live.runs.length ? [swatch(null, 1, 0.55), `${live.runs.length} guidance runs · ${live.cycle || "—"}`] : null,
    live.alerts.length ? [swatch(null, 3, 1), "exposure the watch flagged"] : null,
  ].filter(Boolean) : [];
  /* THE STYLESHEET ALREADY HAD THIS, AND IT WAS UNREACHABLE.
     atlas.css declares `.at-legend` with `.at-lrow`, `.at-sw` and `.at-d` -- including
     `bottom: calc(var(--at-plate-gutter) + 22px)`, a value chosen to clear Leaflet's
     attribution, with a comment recording the overlap that produced it. The component matched
     none of it: it was inline-styled at `bottom: 14`, which is exactly the overlap the rule was
     written to end, and the rule sat dead beside it. Using the class is both the fix and one
     less place the legend's appearance is decided. */
  return (
    <div className="at-legend">
      {liveRows.map(([sw, text]) => (
        <div className="at-lrow at-lrow-live" key={text} data-legend-live>{sw}<span>{text}</span></div>
      ))}
      {surfaces.map(([hue, title, note]) => (
        <div className="at-lrow" key={title}>
          <span className="at-sw">
            {[0.18, 0.38, 0.62].map((a) => (
              <i key={a} style={{ background: `rgba(${hue}, ${a})` }} />
            ))}
          </span>
          <span>{title}<span className="at-d"> · {note}</span></span>
        </div>
      ))}
      {colorBy === "intensity" ? (
        <div className="at-lrow" style={{ gap: "var(--sp-4)" }}>
          {items.map(([k, label]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 2, flex: "none",
                background: `var(--atlas-${k}, ${CAT_HEX[k]})` }} />
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const CAT_HEX = { ts: "#7fb2e6", cat1: "#38bdf8", cat2: "#fbbf24", cat3: "#f59e0b",
  cat4: "#ef4444", cat5: "#8b5cf6" };

/* WHAT THE RUN IS DOING TO TIME, AND WHY IT HAS TO BE SAID BEFORE IT HAPPENS.
 *
 * The clock skips off-season stretches. That is a real distortion of pace -- a reader watching
 * 174 years unfold in a minute is watching 43 of them -- and a jump announced only as it flashes
 * past on a 40px transport is a jump nobody reads. So the whole statement is made once, where
 * the reader enters replay, and the transport's announcement is the reminder rather than the
 * disclosure.
 *
 * IT LIVED IN THE PANEL AND THE PANEL IS GONE. Rebuilt on the deck's own classes rather than
 * ported with its inline styles: the panel's `--warn` amber was written for a near-black chrome
 * and this surface is paper. The words are unchanged. */
/* THE PLATE'S LAYERS, ON THE PLATE HEAD. Three toggles that change the ink and nothing else. */
function LayerToggles({ layers, setLayers }) {
  const t = (k, label, on, next, title) => (
    <button type="button" key={k} className="at-plate-modebtn at-layer-btn" data-layer={k}
      aria-pressed={on ? "true" : "false"} onClick={() => setLayers(next)} title={title}>
      {label}
    </button>
  );
  return (
    <span className="at-plate-modes at-layers" role="group" aria-label="layers drawn on the plate"
      data-layer-controls>
      {t("class", "CLASS INK", layers.colorBy === "intensity",
        { ...layers, colorBy: layers.colorBy === "intensity" ? "uniform" : "intensity" },
        "colour each track segment by the Saffir-Simpson class of the fix it leaves")}
      {t("genesis", "GENESIS", layers.genesis, { ...layers, genesis: !layers.genesis },
        "draw each storm's genesis point")}
      {t("landfalls", "LANDFALLS", layers.landfalls, { ...layers, landfalls: !layers.landfalls },
        "draw each detected landfall crossing")}
    </span>
  );
}

/* THE SELECTED STORM, AS A STRIP ABOVE THE ANSWER -- NEVER INSTEAD OF IT.
 *
 * The locked rule for a selection is a minimum strip that does not replace the ledger. The dock
 * that held it was a third of the plate's width laid over the map; this is one band on the
 * inspector: who the storm is, its peak by the record that is speaking, whether it is a member
 * of this cohort, and the three things a reader does next -- read its record, build the cohort
 * around where it formed, or let it go. The ledger below it keeps every row and marks which
 * contracts this storm reached. */
function SubjectStrip({ storm, subject, live, recordOpen, onRecord, onBridge, proposed, onClear }) {
  const view = live && live.state === LIVE_OPERATIONAL ? live.view : null;
  const peak = view ? view.peak_wind_kt : storm.max_vmax_kt;
  const cat = view ? view.peak_category : storm.max_category;
  const member = subject && subject.inCohort;
  const unavailable = live && live.state === "unavailable";
  return (
    <div className="sj" data-subject-strip data-inspector>
      <div className="sj-who">
        <span className="sj-name">{storm.name || "UNNAMED"}</span>
        <span className="sj-season">{storm.season}</span>
        <span className="sj-meta">{storm.basin}{storm.atcf_id ? ` · ${storm.atcf_id}` : ""}</span>
        <button type="button" className="sj-x" data-clear-selection onClick={onClear}
          aria-label="clear the selected storm" title="clear the selection (Esc)">✕</button>
      </div>
      <div className="sj-facts">
        <span className="sj-peak" title={view ? "operational to date — not post-analysed" : "the archive's peak wind"}>
          <i style={{ background: CATEGORY_COLOR[cat] || "var(--t4)" }} aria-hidden="true" />
          {peak === null || peak === undefined ? "—" : `${Math.round(peak)} kt`}
          <span className="sj-src">{view ? "OPERATIONAL" : unavailable ? "PROVISIONAL" : "ARCHIVE PEAK"}</span>
        </span>
        <span className={member ? "sj-mem" : "sj-mem sj-out"} data-subject-member={member ? "in" : "out"}>
          {member ? "IN THIS COHORT" : "NOT IN THIS COHORT"}
        </span>
      </div>
      <div className="sj-acts">
        {/* No RECORD button here: the RECORD tab directly below is that control. */}
        {proposed ? (
          <button type="button" data-bridge-build onClick={onBridge}
            title="keep every other condition and replace the location with this storm's genesis point">
            COHORT AROUND ITS GENESIS
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Boot({ manifest }) {
  return (
    <div data-surface="tactical" data-atlas style={{
      position: "fixed", inset: 0, background: "var(--surface-app)", color: "var(--text-1)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "var(--sp-7)", padding: "var(--sp-8)",
    }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-title)",
        fontWeight: "var(--fw-black)", letterSpacing: "var(--track-caps)",
        textTransform: "uppercase" }}>STORM ATLAS</div>
      {manifest ? <ScaleLine manifest={manifest} dim /> : null}
      <div style={{ ...MONO, fontSize: "var(--fs-mono-xs)", color: "var(--text-2)",
        letterSpacing: "var(--track-label)" }}>
        {manifest ? "[ READING THE HISTORICAL ARCHIVE… ]" : "[ OPENING THE ARCHIVE… ]"}
      </div>
    </div>
  );
}

function BootError({ error }) {
  return (
    <div data-surface="tactical" data-atlas style={{
      position: "fixed", inset: 0, background: "var(--surface-app)", color: "var(--text-1)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "var(--sp-5)", padding: "var(--sp-8)", textAlign: "center",
    }}>
      <div style={{ ...MONO, fontSize: "var(--fs-mono-md)", color: "var(--neg)",
        letterSpacing: "var(--track-label)" }}>[ THE ARCHIVE COULD NOT BE READ ]</div>
      <div style={{ ...MONO, fontSize: "var(--fs-mono-xs)", color: "var(--text-2)",
        maxWidth: 520, lineHeight: "var(--lh-body)" }}>
        {String(error && error.message ? error.message : error)}
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-caption)",
        color: "var(--text-2)", maxWidth: 520, lineHeight: "var(--lh-body)" }}>
        Nothing is shown rather than something approximate. The Storm Atlas has no fallback
        dataset, because a map drawn from anything but the archive would not be this archive.
      </div>
    </div>
  );
}

/** Busiest cell in a density grid. The grid is now computed by the shell rather than carried
 *  inside an analog result, so this takes the Map directly. */
function peakOf(grid) {
  let peak = 0;
  if (grid) for (const v of grid.values()) if (v > peak) peak = v;
  return peak;
}

/* REMOVING ONE CONDITION, BY THE KEY THE STRIP PRINTS.
 *
 * The mapping is from a CONDITION key -- what conditionsOf() names -- back to the spec fields
 * that produced it, and the two are not one-to-one: "season" is a range and clears two fields.
 * Written as data rather than a switch so the strip and the spec cannot drift about what a chip
 * removes, and so an unrecognised key is a no-op rather than a silent reset of the whole cohort.
 *
 * EVERY RESET VALUE IS EMPTY_COHORT'S OWN. Writing `false` or `null` here by hand would be a
 * second declaration of the defaults, and the first time the two disagreed the strip would
 * "clear" a condition into a state the builder never produces. */
export function clearCondition(spec, key) {
  const FIELDS = {
    where: ["where"],
    months: ["months"],
    season: ["seasonFrom", "seasonTo"],
    basins: ["basins"],
    subbasinsEntered: ["subbasinsEntered"],
    namedOnly: ["namedOnly"],
    includeProvisional: ["includeProvisional"],
    intensity: ["intensity"],
    landfall: ["landfall"],
  };
  const fields = FIELDS[key];
  if (!fields) return spec;
  const next = { ...spec };
  for (const f of fields) next[f] = EMPTY_COHORT[f];
  return normalise(next);
}
