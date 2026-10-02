/* What changed between two methodology versions, in words a reader of an old link can use.
 *
 * WHY THIS IS AN ENGINE MODULE AND NOT A PARAGRAPH IN THE UI. The notice a shared link gets
 * when it was made under an older methodology (ui/atlas.jsx, MethodologyMoved) was written for
 * the one bump that existed, 1.0.0 -> 1.1.0, and hard-codes its effect: "the cohort is unchanged
 * and so are its counts -- what may differ is which contracts are refused". Under 1.1.1 that
 * sentence is false in both halves. Counts DO move (a >=64 kt landfall denominator loses its
 * unknowns) and NO refusal moves. A notice whose whole job is to say what moved under a link
 * cannot be a fixed sentence once there are two releases, so the release history lives here,
 * beside the engine that implements it, and the notice asks for the span it needs.
 *
 * Each entry says what a READER of an old link would see differently, not what the code did.
 * The authoritative account of each release is the comment block above METHODOLOGY_VERSION in
 * scripts/genesis/provenance.py, with figure-by-figure errata for 1.1.1.
 */

/** Every release after 1.0.0, oldest first. `counts` says whether a published count or rate can
 *  differ under an old link; `refusals` whether a contract's refused/scoreable status can. */
export const METHODOLOGY_RELEASES = Object.freeze([
  Object.freeze({
    version: "1.1.0",
    counts: false,
    refusals: true,
    summary:
      "1.1.0 stopped counting the refusal gate over the whole archive and started counting it " +
      "over the population a query can actually draw from, so some contracts that published a " +
      "rate under {was} now refuse as OUT OF SCOPE.",
  }),
  Object.freeze({
    version: "1.1.1",
    counts: true,
    refusals: false,
    summary:
      "1.1.1 stopped scoring an unrecorded landfall class as a crossing below hurricane " +
      "strength: those storms now leave the ≥64 kt landfall denominators and are counted as " +
      "unknown, so some of those rates and intervals moved. The pre-1971 warning now counts only " +
      "East Pacific storms and is no longer silenced by a season floor below 1971, and the " +
      "calibration ledger was re-scored with a back-test that admits a storm only once its " +
      "outcome was known. No refusal changed.",
  }),
]);

/** "1.1.0" -> [1, 1, 0]; anything else -> null. Strictly three integers. */
export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? ""));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

/**
 * What moved between the version a link was made under and the one this build publishes.
 *
 * @returns {null | {was, now, direction, releases, countsMoved, refusalsMoved, sentences}}
 *   null when nothing moved (same version, or either side missing). `direction` is "older"
 *   for a link made before this build, "newer" for one made by a LATER build (this build cannot
 *   say what that release changed and says so), "unknown" when either version is unparseable.
 *   `sentences` are complete and ready to print, in release order.
 */
export function methodologyMoved(was, now) {
  if (!was || !now || was === now) return null;
  const a = parseVersion(was);
  const b = parseVersion(now);
  if (!a || !b) {
    return { was, now, direction: "unknown", releases: [], countsMoved: true, refusalsMoved: true,
      sentences: [`This link names methodology ${was}, which this build does not recognise; ` +
        `the archive publishes under ${now}. Any figure under the link may differ.`] };
  }
  if (cmp(a, b) > 0) {
    return { was, now, direction: "newer", releases: [], countsMoved: true, refusalsMoved: true,
      sentences: [`This link was made under methodology ${was}, which is newer than the ${now} ` +
        "this build publishes. This build cannot say what that release changed."] };
  }
  const releases = METHODOLOGY_RELEASES.filter((r) => {
    const v = parseVersion(r.version);
    return cmp(v, a) > 0 && cmp(v, b) <= 0;
  });
  const countsMoved = releases.some((r) => r.counts);
  const refusalsMoved = releases.some((r) => r.refusals);
  const lead = `This link was made under methodology ${was}; the archive now publishes under ` +
    `${now}. The cohort is unchanged` +
    (countsMoved
      ? " — which storms are in it is the same, but some published counts and rates may differ."
      : " and so are its counts — what may differ is which contracts are refused.");
  return {
    was, now, direction: "older", releases, countsMoved, refusalsMoved,
    sentences: [lead, ...releases.map((r) => r.summary.replaceAll("{was}", was))],
  };
}
