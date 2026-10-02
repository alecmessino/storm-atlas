/* THE PICK CARD — what a click on open water finds, before it asks anything.
 *
 * WHAT THE CLICK USED TO DO. It moved the reader's genesis condition to wherever they clicked:
 * the question, every rate, the comparison and the URL changed on a gesture a reader also uses to
 * look at a map. A click meant to ask "which storm is this line?" rewrote the answer instead.
 *
 * WHAT IT DOES NOW. It answers the looking question first, from the cell index the plate already
 * counts with: how many of the cohort's storms pass through this 2° cell, how many formed in it,
 * and the storms themselves, each one a press away from being selected. Asking about the place is
 * a button, and the button says exactly what it will ask -- so the one gesture that changes the
 * answer is a deliberate one.
 *
 * NOTHING HERE IS A RATE. Two counts and a list, all of them this cohort's members.
 */
import React from "react";
import { rosterIndex } from "./roster.jsx";
import { CATEGORY_COLOR } from "../render/palette.js";

const fmtPos = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat < 0 ? "S" : "N"} `
  + `${Math.abs(((lon + 540) % 360) - 180).toFixed(1)}°${((lon + 540) % 360) - 180 < 0 ? "W" : "E"}`;

/**
 * @param {object}   props.pick      { lat, lon, x, y, through: rows[], formed: rows[], cellLabel }
 * @param {object}   props.archive
 * @param {object}   props.where     the cohort's current location condition, or null
 * @param {number}   props.radiusKm  the radius a new location condition would carry
 * @param {function} props.onAsk     commit a location condition here
 * @param {function} props.onSelect  select one storm
 * @param {function} props.onList    list every storm through the cell in the roster
 * @param {function} props.onHover   lift one storm on the plate
 * @param {function} props.onClose
 */
export function PickCard({ pick, archive, where, radiusKm, onAsk, onSelect, onList, onHover,
  onClose, plateW = 800, plateH = 500 }) {
  const idx = React.useMemo(() => rosterIndex(archive), [archive]);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const b = ref.current && ref.current.querySelector("[data-pick-ask]");
    if (b) b.focus({ preventScroll: true });
  }, [pick.lat, pick.lon]);
  const top = pick.through.slice().sort((a, b) => (idx[b].peak ?? -1) - (idx[a].peak ?? -1)).slice(0, 6);
  /* PLACED BESIDE THE CLICK, INSIDE THE PLATE. Right of the point unless that would run off the
     plate, then left; clamped vertically. The point itself stays visible either way. */
  const W = 300;
  const left = pick.x + 16 + W > plateW ? Math.max(8, pick.x - 16 - W) : pick.x + 16;
  /* CLAMPED BY ITS MEASURED HEIGHT, not a guess at it: a guessed 330px let the ASK button -- the
     one control on the card that changes the answer -- fall off the foot of the plate. */
  const [cardH, setCardH] = React.useState(330);
  React.useLayoutEffect(() => {
    if (ref.current) setCardH(ref.current.offsetHeight);
  }, [pick.lat, pick.lon, pick.through.length]);
  const topPx = Math.max(8, Math.min(pick.y - 40, plateH - cardH - 8));
  return (
    <div className="pk" ref={ref} role="dialog" aria-label="what is here" data-pick-card
      style={{ left, top: topPx, width: W, maxHeight: Math.max(160, plateH - 16), overflowY: "auto" }}
      onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <div className="pk-hd">
        <span>{fmtPos(pick.lat, pick.lon)}</span>
        <button type="button" className="pk-x" onClick={onClose} aria-label="close">×</button>
      </div>
      <div className="pk-counts">
        <span><b>{pick.through.length.toLocaleString()}</b> of this cohort&rsquo;s storms pass through
          this 2° cell</span>
        <span><b>{pick.formed.length.toLocaleString()}</b> formed in it</span>
      </div>
      {/* THE SAME CELL, ASKED OF THE LIVE SYSTEM THE COHORT IS KEYED TO. Operational lines, each
          crossing the cell or not: counted, never turned into a chance. */}
      {pick.live ? (
        <div className="pk-live" data-pick-live>
          <span className="pk-live-h">{pick.live.name} · ITS PUBLISHED LINES HERE</span>
          {pick.live.official !== null ? (
            <span data-pick-live-official={pick.live.official ? "enters" : "misses"}>
              NHC #{pick.live.advisory} forecast track <b>{pick.live.official ? "crosses this cell" : "does not cross it"}</b>
            </span>
          ) : null}
          {pick.live.runsOf ? (
            <span data-pick-live-runs={pick.live.runs}>
              <b>{pick.live.runs} of {pick.live.runsOf}</b> guidance family runs cross it{pick.live.cycle ? ` · ${pick.live.cycle}` : ""}
            </span>
          ) : null}
          {pick.live.best ? <span>{pick.live.name} has already passed through it</span> : null}
          <em>Lines counted, not probabilities. NHC&rsquo;s cone is not a count and is not used here.</em>
        </div>
      ) : null}
      {top.length ? (
        <ul className="pk-list">
          {top.map((r) => {
            const x = idx[r];
            return (
              <li key={r}>
                <button type="button" data-pick-storm={x.id}
                  onMouseEnter={() => onHover(r)} onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(r)} onBlur={() => onHover(null)}
                  onClick={() => onSelect(r)}>
                  <i style={{ background: CATEGORY_COLOR[x.cat] || "var(--t4)" }} />
                  <b>{x.name}</b> {x.season}
                  <span className="pk-peak">{x.peak === null ? "—" : `${Math.round(x.peak)} kt`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="pk-none">No storm of this cohort passes through this cell.</p>}
      {pick.through.length > top.length ? (
        <button type="button" className="pk-more" data-pick-list onClick={onList}>
          LIST ALL {pick.through.length.toLocaleString()} →
        </button>
      ) : null}
      <div className="pk-ask">
        <button type="button" data-pick-ask onClick={onAsk}
          title="sets the cohort's location condition: storms whose GENESIS falls within this radius of here">
          {where ? "MOVE THE GENESIS CONDITION HERE" : "ASK: STORMS THAT FORMED NEAR HERE"}
        </button>
        <span>within {radiusKm.toLocaleString()} km · matches where a storm <em>formed</em>, not
          where it went</span>
      </div>
    </div>
  );
}
