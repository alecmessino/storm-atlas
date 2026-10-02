/* THE LAUNCHED LIVE SYSTEM ON THE PLATE: where it has been, where NHC says it is going, how wide
 * NHC's own cone is, where the guidance runs go, and which registered exposure the watch flagged.
 *
 * WHY IT EXISTS. A cohort keyed to a live system's derived genesis put the historical population
 * on the plate and nothing of the storm it was keyed to: the current systems are not in the
 * IBTrACS pack, so no archive row selected them, and the operational layer only draws a SELECTED
 * row. A reader was asked to compare history against a storm they could not see.
 *
 * WHAT IS DRAWN, AND HOW IT IS KEPT APART FROM THE ARCHIVE. The archive is drawn in colour: the
 * category ramp, the pathway cyan, the genesis violet. Everything here is OPERATIONAL and
 * CARRIED, so it is achromatic -- white and greys -- and each form differs in stroke as well:
 *   - the operational best track to date: solid white, ending at a square (here now, not ended);
 *   - NHC's official forecast: dashed white with OPEN rings at each forecast point, labelled with
 *     the advisory's own lead hour and wind, because it is one published path;
 *   - NHC's GIS cone: a faint fill under a dashed outline -- NHC's polygon, not reconstructed;
 *   - the guidance family runs: hairlines, because they are a set and are counted, never averaged;
 *   - a registered exposure the watch put at ELEVATED or above: its outline, in the watch's ink.
 * Nothing here is interpolated or computed; every vertex is a published one.
 */

import { AtlasLayer, worldOffsets } from "./atlas-layer.js";
import { drawMark } from "./selection-layer.js";
import { SELECTION_INK } from "./palette.js";

const DEG = Math.PI / 180;
const MAX_LAT = 85.0511287798;
const wy = (lat) => {
  const la = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + (la * DEG) / 2)) / (2 * Math.PI);
};
/* A longitude onto the unwrapped world next to `ref`, so a system near 180 is one shape. */
const wxNear = (lon, ref) => {
  let x = (lon + 180) / 360;
  while (x - ref > 0.5) x -= 1;
  while (x - ref < -0.5) x += 1;
  return x;
};

const FORECAST_INK = "#e6e8eb";
const RUN_INK = "rgba(214,220,230,0.55)";
const CONE_FILL = "rgba(230,232,235,0.13)";
const CONE_LINE = "rgba(230,232,235,0.75)";
export const WATCH_INK = { ELEVATED: "#8ea3b8", DISAGREEMENT: "#f2b233", "EVIDENCE CASE": "#f4746f" };

export const ForecastLayer = AtlasLayer.extend({
  options: { padding: 0.25, pane: "overlayPane", zIndexOffset: 4 },

  /**
   * @param {object|null} d  { best:[{lat,lon}], official:[{lat,lon,kt,hr}], cone:[[[lon,lat]]],
   *   runs:[[[lat,lon]]], alerts:[{state, outline}] } or null to draw nothing.
   */
  setData(d) {
    this._d = d || null;
    this.redraw();
    return this;
  },

  draw(ctx, view) {
    const d = this._d;
    if (!d) return;
    const { scale, ox, oy } = view;
    const anchor = (d.best && d.best.length ? d.best[d.best.length - 1]
      : d.official && d.official.length ? d.official[0] : null);
    if (!anchor) return;
    const ref = (anchor.lon + 180) / 360;
    /* One offset for the whole system, chosen like the operational layer's: the copy of the world
       on which the system's anchor is visible. */
    const offs = worldOffsets(ref, ref, scale, ox, view.width);
    const shift = (offs.length ? offs[0] : 0) * scale;
    const P = (lat, lon) => [wxNear(lon, ref) * scale - ox + shift, wy(lat) * scale - oy];
    const line = (pts) => {
      ctx.beginPath();
      pts.forEach(([la, lo], i) => { const [x, y] = P(la, lo); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    };

    // 1. the cone: NHC's polygon, faint fill, dashed edge
    if (d.cone && d.cone.length) {
      ctx.save();
      ctx.beginPath();
      for (const ring of d.cone) {
        ring.forEach(([lo, la], i) => { const [x, y] = P(la, lo); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath();
      }
      ctx.fillStyle = CONE_FILL;
      ctx.fill("evenodd");
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = CONE_LINE;
      ctx.stroke();
      ctx.restore();
    }

    // 2. the watch's flagged exposures, under the tracks
    for (const a of d.alerts || []) {
      const o = a.outline;
      if (!o) continue;
      ctx.save();
      ctx.strokeStyle = WATCH_INK[a.state] || FORECAST_INK;
      ctx.globalAlpha = 0.9;
      if (o.kind === "circle") {
        const [x, y] = P(o.lat, o.lon);
        const [, y2] = P(o.lat + o.r_km / 111.2, o.lon);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, Math.abs(y - y2), 0, Math.PI * 2);
        ctx.stroke();
      } else if (o.kind === "coast_buffer") {
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (const l of o.lines) { line(l.map(([lo, la]) => [la, lo])); ctx.stroke(); }
      }
      ctx.restore();
    }

    // 3. guidance family runs: hairlines
    ctx.save();
    ctx.strokeStyle = RUN_INK;
    ctx.lineWidth = 1;
    for (const r of d.runs || []) { if (r.length > 1) { line(r); ctx.stroke(); } }
    ctx.restore();

    // 4. the operational best track to date
    if (d.best && d.best.length > 1) {
      ctx.save();
      ctx.strokeStyle = SELECTION_INK;
      ctx.lineWidth = 2;
      line(d.best.map((f) => [f.lat, f.lon]));
      ctx.stroke();
      ctx.restore();
    }

    // 5. the official forecast: dashed, open rings, labelled with the advisory's own hours
    if (d.official && d.official.length) {
      ctx.save();
      ctx.strokeStyle = FORECAST_INK;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      const pts = d.official.map((p) => [p.lat, p.lon]);
      if (d.best && d.best.length) pts.unshift([anchor.lat, anchor.lon]);
      if (pts.length > 1) { line(pts); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textBaseline = "middle";
      const last = d.official.length - 1;
      const boxes = [];
      const free = (bx) => !boxes.some((o) => bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]);
      d.official.forEach((p, i) => {
        const [x, y] = P(p.lat, p.lon);
        ctx.fillStyle = "#0d131d";
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        /* Every other point and the last, labelled with the advisory's own lead hour: enough
           to read the path's timing without burying the plate in text. */
        if (Number.isFinite(p.hr) && i > 0 && (i % 2 === 0 || i === last)) {
          const t = `+${p.hr}h${p.kt !== null && p.kt !== undefined ? ` ${p.kt}kt` : ""}`;
          const w = ctx.measureText(t).width;
          const bx = [x + 6, y - 6, x + 12 + w, y + 6];
          if (!free(bx)) return;
          boxes.push(bx);
          ctx.fillStyle = "rgba(13,19,29,0.78)";
          ctx.fillRect(x + 6, y - 6, w + 6, 12);
          ctx.fillStyle = FORECAST_INK;
          ctx.fillText(t, x + 9, y);
        }
      });
      ctx.restore();
    }

    // 6. here now
    if (d.best && d.best.length) {
      const [x, y] = P(anchor.lat, anchor.lon);
      drawMark(ctx, { x, y, kind: "latest", color: SELECTION_INK });
    }
  },
});
