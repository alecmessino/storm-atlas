/* Official-forecast parse: verbatim extraction of the forecast-advisory reader used by the original pipeline. */
const UA = "StormAtlas/1.0 (research archive)";
async function getText(url, { timeout = 30000 } = {}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "*/*" }, signal: ctrl.signal });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, status: res.status, latencyMs, error: "HTTP " + res.status };
    return { ok: true, status: res.status, latencyMs, text: await res.text() };
  } catch (e) {
    return { ok: false, status: null, latencyMs: Date.now() - t0, error: String(e && e.message || e) };
  } finally { clearTimeout(to); }
}
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function parseLat(s) { if (s == null) return null; const m = /(-?[\d.]+)\s*([NS])?/i.exec(String(s)); if (!m) return null; let v = Number(m[1]); if (/S/i.test(m[2] || "")) v = -v; return Number.isFinite(v) ? v : null; }
function parseLon(s) { if (s == null) return null; const m = /(-?[\d.]+)\s*([EW])?/i.exec(String(s)); if (!m) return null; let v = Number(m[1]); if (/W/i.test(m[2] || "")) v = -v; return Number.isFinite(v) ? v : null; }
const CONE_NM = {
  east: { 12: 26, 24: 41, 36: 55, 48: 70, 60: 85, 72: 100, 96: 139, 120: 175 }, // Atlantic
  west: { 12: 24, 24: 38, 36: 51, 48: 64, 60: 77, 72: 90, 96: 120, 120: 150 },  // E/C Pacific
};
function coneRadiusNm(basin, hr) {
  const tbl = CONE_NM[basin] || CONE_NM.east;
  const keys = Object.keys(tbl).map(Number).sort((a, b) => a - b);
  if (hr <= 0) return 0;
  if (hr <= keys[0]) return tbl[keys[0]] * (hr / keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (hr <= keys[i]) {
      const a = keys[i - 1], b = keys[i];
      return tbl[a] + (tbl[b] - tbl[a]) * ((hr - a) / (b - a));
    }
  }
  return tbl[keys[keys.length - 1]];
}
function sampleTCM(raw) {
  const t = String(raw || "").replace(/\r/g, "");
  const at = t.search(/(CENTER\s+LOCATED|FORECAST\s+VALID|INITIAL)/i);
  const vis = (x) => x.replace(/\n/g, " \u23ce ").replace(/[ \t]{2,}/g, (m) => "\u00b7".repeat(Math.min(m.length, 6)));
  return {
    bytes: t.length,
    hasMaxWind: /MAX\s+WIND/i.test(t),
    hasForecastValid: /FORECAST\s+VALID/i.test(t),
    hasInitial: /^\s*INITIAL\s/mi.test(t),
    hasCenterLocated: /CENTER\s+LOCATED\s+NEAR/i.test(t),
    hasMaxSustained: /MAX\s+SUSTAINED\s+WINDS/i.test(t),
    maxWindCount: (t.match(/MAX\s+WIND/gi) || []).length,
    window: at > -1 ? vis(t.slice(at, at + 420)) : vis(t.slice(0, 420)),
  };
}
function parseAdvisoryNow(text) {
  const t = String(text || "").replace(/\r/g, "");
  const pos = /CENTER\s+LOCATED\s+NEAR\s+([\d.]+)\s*([NS])\s+([\d.]+)\s*([EW])\s+AT\s+(\d{2})\/(\d{2})(\d{2})Z/i.exec(t);
  if (!pos) return null;
  let lat = Number(pos[1]); if (/S/i.test(pos[2])) lat = -lat;
  let lon = Number(pos[3]); if (/W/i.test(pos[4])) lon = -lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const w = /MAX\s+SUSTAINED\s+WINDS\s+(\d+)\s*KT(?:[\s.]*WITH\s+GUSTS\s+TO\s+(\d+)\s*KT)?/i.exec(t);
  return {
    lat, lon,
    day: Number(pos[5]), hh: Number(pos[6]), mm: Number(pos[7]),
    kt: w ? Number(w[1]) : null,
    gustKt: w && w[2] != null ? Number(w[2]) : null,
  };
}
function parseForecastAdvisory(text, baseIso) {
  const pts = [];
  /* Position and intensity together. The MAX WIND line is optional so a product that
     omits it still yields a track rather than nothing; wind then stays null and every
     consumer treats it as absent instead of as zero. */
  /* Two layouts are in service and the INITIAL line usually uses the other one:

       INITIAL        14/1500Z 16.7N 149.5W    50 KT  60 MPH      <- intensity same line
       FORECAST VALID 15/0000Z 17.2N 151.2W
       MAX WIND  55 KT...GUSTS  65 KT.                            <- intensity next line

     Reading only the MAX WIND form left hr 0 with a null intensity on every storm while
     every forecast hour parsed fine — invisible, because the peak drives P(hurricane)
     and the peak is never at hour zero. Both forms are read; the MAX WIND line wins when
     both are present, since that is the one that carries gusts. */
  const re = new RegExp(
    "(INITIAL|FORECAST\\s+VALID|OUTLOOK\\s+VALID)\\s+(\\d{2})\\/(\\d{2})(\\d{2})Z\\s+([\\d.]+)\\s*([NS])\\s+([\\d.]+)\\s*([EW])" +
    "(?:[ \\t]+(\\d+)[ \\t]*KT)?" +
    "(?:[^\\n]*\\n\\s*MAX\\s+WIND\\s+(\\d+)\\s*KT(?:[.\\s]*GUSTS\\s+(\\d+)\\s*KT)?)?",
    "gi");
  const base = baseIso ? new Date(baseIso) : new Date();
  let m;
  while ((m = re.exec(text))) {
    let lat = Number(m[5]); if (/S/i.test(m[6])) lat = -lat;
    let lon = Number(m[7]); if (/W/i.test(m[8])) lon = -lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // Valid times are day-of-month + HHMM; roll the month forward if it wrapped.
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), Number(m[2]), Number(m[3]), Number(m[4])));
    if (d.getTime() < base.getTime() - 3 * 3600e3) d.setUTCMonth(d.getUTCMonth() + 1);
    const hr = Math.round((d.getTime() - base.getTime()) / 3600e3);
    if (hr < 0 || hr > 168) continue;
    const ktRaw = m[10] != null ? m[10] : m[9];
    const kt = ktRaw != null ? Number(ktRaw) : null;
    pts.push({ lat, lon, hr, validZ: d.toISOString(),
      kt: Number.isFinite(kt) ? kt : null,
      gustKt: m[11] != null && Number.isFinite(Number(m[11])) ? Number(m[11]) : null,
      initial: /^INITIAL/i.test(m[1]),
      outlook: /^OUTLOOK/i.test(m[1]) });
  }
  return pts.sort((a, b) => a.hr - b.hr);
}
function buildCone(points, basin) {
  if (!points || points.length < 2) return null;
  const rad = (x) => (x * Math.PI) / 180;
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const cosLat = Math.max(0.2, Math.cos(rad(p.lat)));
    const brg = Math.atan2((b.lon - a.lon) * cosLat, b.lat - a.lat); // radians from north
    const rNm = coneRadiusNm(basin, p.hr);
    const dLat = -Math.sin(brg) * (rNm / 60);
    const dLon = (Math.cos(brg) * (rNm / 60)) / cosLat;
    right.push([p.lat + dLat, p.lon + dLon]);
    left.push([p.lat - dLat, p.lon - dLon]);
  }
  // rounded cap at the final forecast point
  const last = points[points.length - 1];
  const cosLat = Math.max(0.2, Math.cos(rad(last.lat)));
  const rNm = coneRadiusNm(basin, last.hr);
  const prev = points[points.length - 2];
  const brg = Math.atan2((last.lon - prev.lon) * cosLat, last.lat - prev.lat);
  const cap = [];
  for (let k = 1; k <= 7; k++) {
    const th = brg - Math.PI / 2 + (Math.PI * k) / 8;
    cap.push([last.lat + Math.cos(th) * (rNm / 60), last.lon + (Math.sin(th) * (rNm / 60)) / cosLat]);
  }
  return right.concat(cap, left.reverse());
}
async function fetchForecastFor(storm, rawAdvisoryUrl) {
  if (!rawAdvisoryUrl) return { track: null, cone: null, note: "no forecast-advisory link in feed" };
  const r = await getText(rawAdvisoryUrl);
  if (!r.ok) return { track: null, cone: null, note: "advisory fetch " + r.error };
  const pts = parseForecastAdvisory(r.text, storm.advTimeZ);
  if (!pts.length) return { track: null, cone: null, note: "no FORECAST VALID lines parsed", diag: sampleTCM(r.text) };
  /* Positions parsed but no intensity: the MAX WIND line is there in every real product,
     so a miss means the shape is not what the regex expects. Capture the bytes around the
     first position rather than guessing at the format for a second cycle. */
  let kt = pts.filter((p) => Number.isFinite(p.kt));
  /* The hour-zero point used to be SYNTHESIZED from CurrentStorms.json and prepended
     unconditionally, so the product's own current state was invisible and hour-zero
     intensity was null on every storm.

     Prefer what the product says, in this order: an INITIAL line if it has one, then
     CENTER LOCATED NEAR + MAX SUSTAINED WINDS, then the feed position labelled with its
     source. The middle one is what this product actually uses; that was established by
     the diagnostic below rather than assumed, after assuming it once already. */
  let parsedInitial = pts.find((p) => p.hr === 0) || null;
  if (!parsedInitial || !Number.isFinite(parsedInitial.kt)) {
    const nowPt = parseAdvisoryNow(r.text);
    if (nowPt) {
      const base = storm.advTimeZ ? new Date(storm.advTimeZ) : new Date();
      const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), nowPt.day, nowPt.hh, nowPt.mm));
      if (d.getTime() - base.getTime() > 3 * 86400e3) d.setUTCMonth(d.getUTCMonth() - 1);
      const p0 = { lat: nowPt.lat, lon: nowPt.lon, hr: 0, validZ: d.toISOString(),
                   kt: nowPt.kt, gustKt: nowPt.gustKt, initial: true, ktFrom: "forecast advisory" };
      if (parsedInitial) pts[pts.indexOf(parsedInitial)] = p0; else pts.unshift(p0);
      parsedInitial = p0;
    }
  }
  /* Recomputed AFTER the recovery above, so the diagnostic describes the state that
     actually shipped rather than the state before the fallback ran. It fires on "forecast
     hours have intensities but hour zero does not", which is precisely the condition that
     went unnoticed, and it reports which of the three layouts the product contains. */
  kt = pts.filter((p) => Number.isFinite(p.kt));
  const diag = kt.length ? (parsedInitial && Number.isFinite(parsedInitial.kt) ? null
    : { reason: "no hour-zero intensity", ...sampleTCM(r.text) })
    : sampleTCM(r.text);
  /* When the product's INITIAL line gives a position but no intensity, the current wind
     is taken from CurrentStorms.json. That is not a substitute number — it is the SAME
     advisory's intensity, published by the same centre in the sibling product — but the
     point records where it came from so the two sources never blur together. */
  const withNow = parsedInitial
    ? pts.map((p) => (p.hr === 0 && !Number.isFinite(p.kt) && Number.isFinite(storm.wind)
        ? { ...p, kt: storm.wind, ktFrom: "CurrentStorms.json" } : p))
    : [{ lat: storm.center[0], lon: storm.center[1], hr: 0, kt: storm.wind ?? null,
         ktFrom: Number.isFinite(storm.wind) ? "CurrentStorms.json" : null, initial: false }, ...pts];
  return {
    diag,
    track: withNow.map((p) => [p.lat, p.lon]),
    trackPoints: withNow.map((p) => ({ at: [p.lat, p.lon], hr: p.hr, validZ: p.validZ || storm.advTimeZ,
      kt: p.kt ?? null, gustKt: p.gustKt ?? null, ktFrom: p.ktFrom || null })),
    cone: buildCone(withNow, storm.basin),
    note: `${pts.length} forecast positions · cone reconstructed from NHC track-error radii`,
  };
}
export { getText, num, parseLat, parseLon, parseAdvisoryNow, parseForecastAdvisory, fetchForecastFor };
