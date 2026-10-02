/* THE ROSTER — every storm the answer counted, by name.
 *
 * WHY IT EXISTS. The surface's promise is that every number is inspectable back to the storms
 * that support it, and until this file the only way to see WHICH storms was to hold a row and
 * look at the lines it lifted on the plate. A line is not a name. An analyst who reads "145 of
 * 539 reached Category 3" and wants to know whether Patricia is one of them had no way to ask.
 *
 * WHAT IT LISTS, AND FROM WHERE. The cohort's own member rows (`result.rows`), or -- when a ledger
 * row or a plate cell is the source -- the ENGINE'S member set for that contract, the same array
 * that counted the numerator. The list never re-derives membership; it prints the set it is given
 * and says what that set is.
 *
 * IT IS AN INSPECTION. Hovering a name draws that storm alone on the plate; pressing it selects
 * it, exactly as pressing its genesis point would. Neither changes the question, a rate, or the
 * URL's cohort.
 *
 * VIRTUALISED, BECAUSE THE WHOLE ARCHIVE IS A VALID COHORT. 3,885 rows is ~20,000 nodes rendered
 * flat; the window renders the rows in view plus a margin, at a fixed row height, so the list
 * costs the same at 3,885 as at 12.
 */
import React from "react";
import { CATEGORY_COLOR } from "../render/palette.js";

const ROW_H = 30;
const CAT_SHORT = { td: "TD", ts: "TS", cat1: "C1", cat2: "C2", cat3: "C3", cat4: "C4", cat5: "C5" };
const CAT_RANK = { td: 0, ts: 1, cat1: 2, cat2: 3, cat3: 4, cat4: 5, cat5: 6 };
const REGION_SHORT = { conus: "US", mexico: "MX", caribbean: "CB", central_america: "CA",
  hawaii: "HI", unattributed: "—" };

/* ONE LIGHT RECORD PER ARCHIVE ROW, BUILT ONCE PER PACK. Name, season, basin, ATCF id, peak and
   the regions it came ashore in -- the facts a reader scans a list by. Nothing here is computed:
   each is a column the pack already carries, read once rather than per render. */
const cache = new WeakMap();
export function rosterIndex(archive) {
  if (cache.has(archive)) return cache.get(archive);
  const S = archive.storms;
  const L = archive.landfalls;
  const out = new Array(archive.nStorms);
  for (let i = 0; i < archive.nStorms; i++) {
    const regions = new Set();
    const s0 = archive.lfOffset[i];
    for (let k = s0; k < s0 + archive.lfCount[i]; k++) {
      const r = L.str("region", k);
      if (r) regions.add(r);
    }
    const name = S.str("name", i) || "UNNAMED";
    const season = S.num("season", i);
    const atcf = S.str("atcf_id", i) || "";
    out[i] = {
      row: i, name, season, atcf,
      id: S.str("storm_id", i),
      basin: S.str("basin", i) || "",
      peak: S.num("max_vmax_kt", i),
      cat: S.str("max_category", i),
      regions: [...regions],
      key: `${name} ${season} ${atcf}`.toLowerCase(),
    };
  }
  cache.set(archive, out);
  return out;
}

const SORTS = {
  season: (a, b) => (b.season - a.season) || a.name.localeCompare(b.name),
  peak: (a, b) => ((b.peak ?? -1) - (a.peak ?? -1)) || (b.season - a.season),
  name: (a, b) => a.name.localeCompare(b.name) || (b.season - a.season),
};

/**
 * @param {object}   props.archive
 * @param {number[]} props.rows       the set being listed (engine member rows)
 * @param {string}   props.label      what the set is, in words
 * @param {function} [props.onClearSource] drop a row/cell source and list the whole cohort
 * @param {number}   [props.selected] the selected pack row
 * @param {function} props.onSelect   select a storm
 * @param {function} [props.onHover]  draw one storm on the plate (row) or release (null)
 */
export function Roster({ archive, rows, label, sourceNote = null, onClearSource = null,
  selected = null, onSelect, onHover = null, cohortSize = null }) {
  const index = React.useMemo(() => rosterIndex(archive), [archive]);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState("season");
  const [scrollTop, setScrollTop] = React.useState(0);
  const [height, setHeight] = React.useState(480);
  const box = React.useRef(null);

  React.useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight || 480));
    ro.observe(el);
    setHeight(el.clientHeight || 480);
    return () => ro.disconnect();
  }, []);

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const out = [];
    for (const r of rows) {
      const rec = index[r];
      if (terms.length && !terms.every((t) => rec.key.includes(t))) continue;
      out.push(rec);
    }
    out.sort(SORTS[sort]);
    return out;
  }, [rows, index, query, sort]);

  /* A NEW SET STARTS AT THE TOP. Scrolling position is a fact about the list that was showing. */
  React.useEffect(() => {
    if (box.current) box.current.scrollTop = 0;
    setScrollTop(0);
  }, [rows, query, sort]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 8);
  const last = Math.min(list.length, Math.ceil((scrollTop + height) / ROW_H) + 8);
  const [cursor, setCursor] = React.useState(-1);

  const onKey = (e) => {
    if (!list.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, Math.min(list.length - 1, cursor + (e.key === "ArrowDown" ? 1 : -1)));
      setCursor(next);
      if (onHover) onHover(list[next].row);
      const el = box.current;
      if (el) {
        const top = next * ROW_H;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_H - el.clientHeight;
      }
    } else if (e.key === "Enter" && cursor >= 0 && list[cursor]) {
      e.preventDefault();
      onSelect(list[cursor].row);
    }
  };

  return (
    <section className="ro" data-roster aria-label="storms in this set">
      <div className="ro-head">
        <div className="ro-what">
          <b data-roster-count>{list.length.toLocaleString()}</b>
          {query ? <> of {rows.length.toLocaleString()}</> : null}
          <span className="ro-label"> {label}</span>
          {onClearSource ? (
            <button type="button" className="ro-clear" data-roster-clear onClick={onClearSource}
              title={`list all ${cohortSize === null ? "" : cohortSize.toLocaleString() + " "}storms in the cohort`}>
              ✕ ALL {cohortSize === null ? "" : cohortSize.toLocaleString()}
            </button>
          ) : null}
        </div>
        {sourceNote ? <div className="ro-note">{sourceNote}</div> : null}
        <div className="ro-tools">
          <input type="search" className="ro-search" data-roster-search value={query}
            placeholder="name, season or ATCF id" aria-label="search storms by name, season or ATCF id"
            onChange={(e) => { setQuery(e.target.value); setCursor(-1); }} onKeyDown={onKey}
            onBlur={() => onHover && onHover(null)} />
          <span className="ro-sort" role="group" aria-label="sort by">
            {[["season", "SEASON"], ["peak", "PEAK"], ["name", "NAME"]].map(([k, l]) => (
              <button type="button" key={k} aria-pressed={sort === k ? "true" : "false"}
                data-roster-sort={k} onClick={() => setSort(k)}>{l}</button>
            ))}
          </span>
        </div>
      </div>
      <div className="ro-cols" aria-hidden="true">
        <span>STORM</span><span>BASIN</span><span>PEAK</span><span>LANDFALL</span>
      </div>
      <div className="ro-list" ref={box} tabIndex={-1}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onMouseLeave={() => onHover && onHover(null)}>
        {!list.length ? (
          <div className="ro-empty">
            {rows.length ? `No storm in this set matches “${query}”.` : "This set holds no storms."}
          </div>
        ) : (
          <div style={{ height: list.length * ROW_H, position: "relative" }}>
            {list.slice(first, last).map((rec, j) => {
              const i = first + j;
              const sel = selected === rec.row;
              return (
                <button type="button" key={rec.row} className="ro-row" data-roster-row={rec.id}
                  data-selected={sel ? "" : undefined} data-cursor={cursor === i ? "" : undefined}
                  style={{ top: i * ROW_H }}
                  onMouseEnter={() => onHover && onHover(rec.row)}
                  onFocus={() => onHover && onHover(rec.row)}
                  onBlur={() => onHover && onHover(null)}
                  onClick={() => onSelect(rec.row)}
                  title={`${rec.name} ${rec.season}${rec.atcf ? ` · ${rec.atcf}` : ""} — select`}>
                  <span className="ro-name">
                    <b>{rec.name}</b> <span className="ro-season">{rec.season}</span>
                  </span>
                  <span className="ro-basin">{rec.basin}</span>
                  <span className="ro-peak">
                    {rec.cat ? <i style={{ background: CATEGORY_COLOR[rec.cat] || "var(--t4)" }} /> : <i className="ro-nocat" />}
                    {rec.cat ? CAT_SHORT[rec.cat] : "—"}
                    <span className="ro-kt">{rec.peak === null ? "" : ` ${Math.round(rec.peak)}`}</span>
                  </span>
                  <span className="ro-lf">
                    {rec.regions.length ? rec.regions.map((r) => REGION_SHORT[r] || r.slice(0, 2).toUpperCase()).join(" ") : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export { CAT_RANK };
