/* Storm Atlas — CLAIM REGISTRY (Atlas subset). Extracted verbatim from the shared registry:
   the claim() lookup, the atlas.* claims and the refusal registry. */
(function () {
  const REG = {};
  function state(ctx) {
    if (ctx && ctx.feeds) return ctx;
    const M = window.MT || {};
    return { feeds: M._feeds || {}, evidence: M.evidence || [], generatedAt: M._generatedAt || null,
             verify: M._verify || null, enso: M._enso || null, outlook: M._outlook || [] };
  }
  function define(id, owner, fn) { REG[id] = { id, owner, fn }; }

  function claim(id, ctx) {
    const c = REG[id];
    if (!c) return { id, owner: "none", text: "UNREGISTERED CLAIM (" + id + ")", ok: false };
    try {
      const r = c.fn(state(ctx)) || {};
      return Object.assign({ id, owner: c.owner }, r);
    } catch (e) {
      return { id, owner: c.owner, text: "CLAIM ERROR", ok: false };
    }
  }


  /* ------------------------------------------------------------------------------------
     STORM ATLAS. A second surface, at docs/storm-atlas/, over the historical archive rather
     than the live feeds. Its capability statements are registered HERE for the same reason
     every other one is: components read claims, they never write them, and a sentence about
     what a surface can answer is exactly the kind that drifts when it lives inside a
     component. These take no feed state -- the Atlas reads a committed pack, not a poll --
     so they are constants, and the archive's own numbers reach the screen from the pack's
     manifest rather than from here.  */
  define("atlas.subject", "none", () => ({
    text: "The historical record, queried. Not a forecast, not a live feed, and not a weather "
        + "map: every line is a storm that happened, and every number is a count of them.",
    ok: true,
  }));
  define("atlas.rates", "none", () => ({
    text: "These are GENESIS-CONDITIONED rates: they assume a tropical cyclone forms. To "
        + "combine with a formation probability, multiply — P(reaches X) = P(forms) × "
        + "P(reaches X | forms). Landfall does NOT decompose that way and is counted jointly "
        + "here, never as a product of two marginals. Every rate is computed in the browser by "
        + "a transliteration of the archive's own Python, compared field by field against it "
        + "on every build; a rate the sample cannot support is refused rather than shown.",
    ok: true,
  }));
  define("atlas.conditioning", "none", () => ({
    text: "A variable used to define a cohort is not reported as an outcome of it. Narrow to "
        + "storms that reached Category 3 and the Category 3 row shows its count and then "
        + "declines to give a rate, because that rate would be 100% by construction rather "
        + "than by evidence. Thresholds above the condition are still real outcomes and are "
        + "still reported, and time-to-event is never suppressed — when those storms got there "
        + "remains a genuine distribution.",
    ok: true,
  }));
  define("atlas.pathway", "none", () => ({
    text: "Historical pathway frequency counts the distinct storms that passed through each "
        + "cell — the matched pool when a point has been probed, otherwise the storms the "
        + "current filter selects. It is not a forecast cone, it carries no probability, "
        + "and it says nothing about a storm that has not formed.",
    ok: true,
  }));
  define("atlas.genesis_density", "none", () => ({
    text: "Genesis count shades each cell by how many storms of the current filter formed in "
        + "it. It is a count, not a rate: filtering to Cat 3 and above shows where the storms "
        + "that became majors formed, which is not the probability that a storm forming there "
        + "becomes one. Storms with no genesis point in the archive are absent rather than "
        + "placed at an assumed position.",
    ok: true,
  }));
  define("atlas.replay", "none", () => ({
    text: "Replay reveals every storm the filter selects, once, in the order it happened, over "
        + "its whole observed span. The cursor is a real UTC instant and only moves forward. "
        + "Stretches where no selected storm is active are skipped and each jump is reported "
        + "on the transport; nothing else about the record's order or content is altered. "
        + "Speeds are stated in archive days per second rather than as a multiplier.",
    ok: true,
  }));
  define("atlas.environment", "none", () => ({
    text: "Environmental variables are held by the archive and are not drawn by this build. "
        + "Whether a record exists within twelve hours of a storm's genesis is reported; "
        + "SHIPS begins in 1982 and its developmental file ends in 2023, so most of the "
        + "record has none.",
    ok: false,
  }));
  /* THE OPERATIONAL LAYER. The one Atlas claim that is about a LIVE file rather than the committed
     archive, and the one that most needs an owner: it is a statement about what a current storm's
     numbers are and are not, printed beside numbers that look exactly like archive columns. */
  define("atlas.operational", "none", () => ({
    text: "For a storm whose archive row is PROVISIONAL, the selected-storm figures above come "
        + "from the operational ATCF best track rather than from IBTrACS. That record is revised "
        + "while the storm is live and has not been post-analysed. It is used HERE and nowhere "
        + "else: no cohort draws on it, no analog matches against it, no rate, interval, "
        + "effective sample size, calibration or archive comparison contains it, and no refusal "
        + "is decided by it. The two records are never concatenated and never averaged; where "
        + "they disagree both are printed. When the season is post-analysed the archive record "
        + "becomes the record and this layer stops being used.",
    ok: true,
  }));
  define("atlas.geometry", "none", () => ({
    text: "Track positions are drawn at the archive's own published precision. Genesis, "
        + "threshold-crossing and landfall coordinates -- the ones distances are computed "
        + "from -- are carried at full precision and are not quantised.",
    ok: true,
  }));
  define("atlas.selection", "none", () => ({
    text: "Genesis points are the click targets for a storm, and only where one is clearly "
        + "nearer than the next. Where they are packed together a click asks what formed "
        + "there instead, because picking one of forty co-located storms would be arbitrary.",
    ok: true,
  }));

  /* ------------------------------------------------------------------------------------
     THE REFUSAL REGISTRY. One object declares the MARK, the STATUS WORDING and the KEY GLOSS
     together, so a panel cannot print a status the Epistemic Key does not define and the key
     cannot drift from what panels print. It lives here for exactly the reason every claim
     does: this is the one file where wording is authored.

     THE STATUS STRINGS ARE THE ENGINE'S, NOT THIS FILE'S OPINION. Three of the five are
     produced by code -- `UNSCOREABLE_REQUIRES_CANONICAL` and the archive-scarcity refusal in
     docs/storm-atlas/src/engine/analogs.js, and the withheld Saffir-Simpson class the archive
     itself publishes -- and are reproduced verbatim. scripts/test-atlas-refusals.mjs compares
     them against the engine and fails when they diverge, which is the only thing that makes a
     second copy of a string safe. The design handoff proposed shorter wording for some of
     these; production's strings win, because they are what the archive says.

     The two documented overrides are qualifications of a registry entry, never new statuses:
     `NO ANALOGS — 0 STORMS MATCHED` qualifies `unk`, and the region/kind suffix qualifies
     `base`. */
  var REFUSALS = {
    refused: {
      mark: "refused",
      status: "UNSCOREABLE -- REQUIRES CANONICAL COMPUTATION",
      gloss: "A rate the archive can compute and this build has not proven at parity with it. "
           + "Withheld, not zero.",
    },
    cond: {
      mark: "cond",
      status: "CONDITIONED ON",
      gloss: "An answer that holds only under a stated conditioning set. The set is printed "
           + "with it.",
    },
    base: {
      mark: "base",
      status: "BASE RATE ONLY -- unscoreable",
      gloss: "Too few events of this kind exist archive-wide to score a probability, so the "
           + "population base rate is all that is honest. The counts above are the evidence, "
           + "not the answer.",
    },
    oos: {
      mark: "oos",
      status: "OUT OF SCOPE -- unscoreable here",
      gloss: "The events exist in this archive, outside the population the query asked about. "
           + "Widening the basin or the era makes the contract scoreable; the record is not "
           + "empty, the reachable part of it is.",
    },
    unk: {
      mark: "unk",
      status: "— UNKNOWN",
      gloss: "The archive holds no value. Never rendered as zero, never as blank.",
    },
    notev: {
      mark: "notev",
      status: "WITHHELD",
      gloss: "A value the archive could have interpolated and refused to. The bracketing fixes "
           + "disagreed, so no class is published rather than a plausible one.",
    },
  };
  function refusal(kind) {
    var r = REFUSALS[kind];
    if (!r) throw new Error("unregistered refusal: " + kind);
    return r;
  }
  window.MTC = { claim, registered: () => Object.keys(REG),
                 refusal, refusals: () => Object.keys(REFUSALS).map(refusal) };
})();
