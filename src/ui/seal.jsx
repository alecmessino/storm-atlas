/* SEAL THIS READING — the citation, made checkable.
 *
 * ONE CONTROL, ALWAYS ON SCREEN. The citation used to live at the foot of a table two screens
 * down, as a line of text and a COPY button. A reader who wanted to send a colleague "this answer"
 * had to know it was there. The seal is on the inspector's foot at every scroll position, and it
 * does four things the line could not:
 *
 *   - it FINGERPRINTS the members, so the link it copies can tell whoever opens it whether the
 *     archive still gives exactly these storms (see SealCheck);
 *   - it SEALS the reading -- question, methodology, archive identity, members and every row's
 *     figures -- into one hash, so the downloaded file cannot be edited in one place alone;
 *   - it DOWNLOADS the reading as JSON and as CSV, and the members as CSV, so the storms behind
 *     every number leave with the numbers;
 *   - it LOGS the reading in this browser, so an analyst's own readings can be reopened.
 *
 * NOTHING HERE COMPUTES A RATE. engine/seal.js records the published answer; it does not produce
 * one, and the command line seals the same object (scripts/atlas-seal.mjs).
 */
import React from "react";
import { readingCsv, sealReading, shortFingerprint, fingerprintOf, parseSealParam } from "../engine/seal.js";
import { rosterIndex } from "./roster.jsx";
import { CohortSpec } from "./kit.jsx";

const LOG_KEY = "storm-atlas.readings.v1";

/* THE LOCAL LOG, AND ITS LIMITS SAID PLAINLY. It is this browser's list of what this reader
   sealed -- a convenience, not a record: it is not shared, not backed up, and a private window
   has none. Every read and write is guarded, because storage can be absent or refuse. */
export function readLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const v = raw ? JSON.parse(raw) : [];
    /* ENTRIES ARE CHECKED, NOT TRUSTED. Storage is shared with anything else on this origin; one
       malformed entry used to throw while the list rendered and blank the whole page. */
    return Array.isArray(v)
      ? v.filter((e) => e && typeof e === "object" && typeof e.seal === "string"
        && /^sha256:[0-9a-f]{12,}$/.test(e.seal))
      : [];
  } catch { return []; }
}
function appendLog(entry) {
  try {
    const cur = readLog().filter((e) => e.seal !== entry.seal);
    cur.unshift(entry);
    localStorage.setItem(LOG_KEY, JSON.stringify(cur.slice(0, 200)));
    return true;
  } catch { return false; }
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function membersCsv(archive, rows) {
  const idx = rosterIndex(archive);
  const lines = ["storm_id,atcf_id,name,season,basin,peak_kt,peak_class,landfall_regions"];
  const sorted = [...rows].sort((a, b) => (idx[a].id < idx[b].id ? -1 : 1));
  for (const r of sorted) {
    const x = idx[r];
    lines.push([x.id, x.atcf, x.name, x.season, x.basin, x.peak === null ? "" : Math.round(x.peak),
      x.cat || "", x.regions.join(" ")].map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","));
  }
  return lines.join("\n") + "\n";
}

/* THE SEAL AS AN OBJECT. Sixteen hex characters are hard to hold in the head, so the id is set in
   groups of four, the way a reader would say it aloud. */
const grouped = (hex) => (String(hex).match(/.{1,4}/g) || []).join(" ");

/**
 * The seal dialog. Rendered only when opened; the reading is sealed on open, which is the act of
 * sealing, and logged then.
 *
 * IN THE ORDER A READER USES IT. The stamp first -- the thing they will quote -- then exactly what
 * it binds, each line a fact from the reading itself, then the one action most readers came for
 * (copy the sealed link) ahead of the files, and last how to reproduce it without a browser.
 */
export function SealPanel({ archive, spec, result, question, baseline, citation, url,
  onClose }) {
  const reading = React.useMemo(
    () => sealReading(archive, spec, result, { question, baseline }),
    [archive, spec, result, question, baseline]);
  const fp16 = shortFingerprint(reading.members.fingerprint);
  const sealHex = reading.seal.replace(/^sha256:/, "");
  const sealId = sealHex.slice(0, 12);
  const sealedUrl = `${url}${url.includes("?") ? "&" : "?"}seal=${fp16}`;
  const [logged, setLogged] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [at] = React.useState(() => new Date().toISOString());
  const box = React.useRef(null);

  React.useEffect(() => {
    setLogged(appendLog({
      seal: reading.seal, fingerprint: reading.members.fingerprint, question,
      n: reading.cohort.n, url: sealedUrl, methodology: reading.methodology,
      archive: reading.archive.cohort_archive_id, at,
    }));
  }, [reading.seal]);

  /* FOCUS IS PLACED ONCE, WHEN THE DIALOG OPENS. The close handler arrives as a new function on
     every render of the Atlas -- every transport tick during a replay -- and an effect keyed on it
     pulled focus back to COPY every 320ms, so a keyboard reader could not reach the downloads. */
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    const el = box.current && box.current.querySelector("[data-seal-copy]");
    if (el) el.focus();
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  React.useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  /* THE BUTTON SAYS WHAT HAPPENED. A failed clipboard write used to report success, and a reader
     would paste whatever was there before -- possibly an older sealed link. */
  const copyLink = () => {
    const text = `${citation} · SEAL ${sealId}\n${sealedUrl}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => setCopied("ok"), () => setCopied("fail"));
    } else setCopied("fail");
  };

  const base = `storm-atlas-reading-${sealId}`;
  const nRows = reading.rows.length;
  const refused = reading.rows.filter((r) => r.rate === null || r.rate === undefined).length;
  const archiveId = reading.archive.cohort_archive_id || "";
  return (
    <div className="sl-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sl" role="dialog" aria-modal="true" aria-labelledby="sl-title" ref={box}
        data-seal-panel>
        <div className="sl-hd">
          <span id="sl-title">SEALED READING</span>
          <button type="button" className="sl-x" onClick={onClose} aria-label="close">×</button>
        </div>

        <div className="sl-body">
          <div className="sl-stamp" data-seal-stamp>
            <span className="sl-stamp-k">STORM ATLAS · SEAL</span>
            <b className="sl-stamp-id" data-seal-id title={reading.seal}>{grouped(sealId)}</b>
            <span className="sl-stamp-at">{at.replace("T", " ").slice(0, 16)}Z</span>
            <span className="sl-stamp-m">method {reading.methodology}</span>
          </div>

          <ul className="sl-binds" aria-label="what the seal binds">
            <li><i aria-hidden="true">✓</i><span className="sl-k">QUESTION</span>
              <span className="sl-v sl-q">{question}</span></li>
            <li><i aria-hidden="true">✓</i><span className="sl-k">STORMS</span>
              <span className="sl-v" data-seal-fingerprint title={reading.members.fingerprint}>
                {reading.members.count.toLocaleString()} · fingerprint {fp16}</span></li>
            <li><i aria-hidden="true">✓</i><span className="sl-k">FIGURES</span>
              <span className="sl-v">{nRows} rows · {nRows - refused} rates, {refused} refusals</span></li>
            <li><i aria-hidden="true">✓</i><span className="sl-k">ARCHIVE</span>
              <span className="sl-v" title={archiveId}>{archiveId.slice(0, 16) || "—"}</span></li>
            <li><i aria-hidden="true">✓</i><span className="sl-k">METHOD</span>
              <span className="sl-v">{reading.methodology}</span></li>
          </ul>
        </div>

        <p className="sl-what">
          Change any one of these and the seal changes. The link carries the storms&rsquo;
          fingerprint, so whoever opens it is told whether this archive still gives exactly
          these {reading.members.count.toLocaleString()} storms.
        </p>

        <div className="sl-primary">
          <button type="button" className="sl-copy" data-seal-copy onClick={copyLink}>
            {copied === "ok" ? "✓ COPIED — CITATION AND SEALED LINK"
              : copied === "fail" ? "COPY FAILED — SELECT THE LINK BESIDE" : "COPY SEALED LINK"}
          </button>
          <code className="sl-url" title={sealedUrl}>{sealedUrl}</code>
        </div>

        <div className="sl-acts">
          <button type="button" data-seal-json
            onClick={() => download(`${base}.json`, JSON.stringify(reading, null, 2) + "\n", "application/json")}>
            ↓ READING · JSON
          </button>
          <button type="button" data-seal-csv
            onClick={() => download(`${base}-rows.csv`, readingCsv(reading), "text/csv")}>
            ↓ ROWS · CSV
          </button>
          <button type="button" data-seal-members
            onClick={() => download(`${base}-members.csv`, membersCsv(archive, result.rows), "text/csv")}>
            ↓ {reading.members.count.toLocaleString()} STORMS · CSV
          </button>
        </div>

        <details className="sl-more">
          <summary>Citation text and reproducing it without a browser</summary>
          <div data-cohort-citation>
            <CohortSpec text={`${citation} · SEAL ${sealId}`} url={sealedUrl} />
          </div>
          <p className="sl-cli">
            <code>node scripts/atlas-seal.mjs &quot;{reading.query}&quot;</code>
            {" "}prints the same seal from the same archive.
          </p>
        </details>
        <p className="sl-log">
          {logged === false ? "This browser refused local storage, so the reading was not logged."
            : "Logged in this browser’s reading list (top bar · READINGS). The list stays on this device."}
        </p>
      </div>
    </div>
  );
}

function CopyLink({ url }) {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 1400);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button type="button" className="rd-copy" onClick={() => {
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => setDone("ok"), () => setDone("fail"));
      else setDone("fail");
    }}>{done === "ok" ? "COPIED" : done === "fail" ? "COPY FAILED" : "COPY LINK"}</button>
  );
}

/* THE READINGS LIST — what this reader sealed, newest first, each one link away. */
export function ReadingsPanel({ onClose }) {
  const [log, setLog] = React.useState(() => readLog());
  const box = React.useRef(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener("keydown", onKey, true);
    const b = box.current && box.current.querySelector("button");
    if (b) b.focus();
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  return (
    <div className="sl-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sl" role="dialog" aria-modal="true" aria-labelledby="rd-title" ref={box}
        data-readings-panel>
        <div className="sl-hd">
          <span id="rd-title">YOUR SEALED READINGS · THIS BROWSER</span>
          <button type="button" className="sl-x" onClick={onClose} aria-label="close">×</button>
        </div>
        {!log.length ? (
          <p className="sl-what">
            Nothing sealed yet. Press <b>SEAL</b> under the ledger to seal the reading on screen;
            it is listed here, with its link, for as long as this browser keeps it.
          </p>
        ) : (
          <ol className="rd-list">
            {log.map((e) => {
              const id = String(e.seal).replace(/^sha256:/, "").slice(0, 12);
              return (
                <li key={e.seal} className="rd-item" data-reading={id}>
                  <span className="rd-stamp" title={e.seal}>{grouped(id)}</span>
                  <span className="rd-main">
                    <a href={e.url}>{e.question || e.url}</a>
                    <span className="rd-meta">
                      {Number(e.n).toLocaleString()} storms · method {e.methodology}
                      {" · "}sealed {String(e.at || "").replace("T", " ").slice(0, 16)}Z
                    </span>
                  </span>
                  <span className="rd-acts">
                    <a className="rd-open" href={e.url}>OPEN</a>
                    <CopyLink url={e.url} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {log.length ? (
          <div className="sl-acts">
            <button type="button" onClick={() => { try { localStorage.removeItem(LOG_KEY); } catch { /* */ } setLog([]); }}>
              CLEAR THIS LIST
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* THE CHECK A SEALED LINK EARNS ON OPEN. The link carries sixteen hex characters of the member
   fingerprint; the archive on screen is fingerprinted the same way and the two are compared. A
   match says the storms are the same storms. A mismatch says so in as many words, with both
   counts -- the question is identical and the population is not, which is exactly the thing an
   unsealed citation could never reveal. */
export function SealCheck({ archive, result, sealParam }) {
  if (!sealParam || !result) return null;
  const now = shortFingerprint(fingerprintOf(archive, result.rows));
  const want = parseSealParam(sealParam);
  if (!want) {
    return (
      <div className="at-seal-ok" data-seal-check="invalid" style={{ borderLeftColor: "var(--t3)" }}>
        <b style={{ color: "var(--t2)" }}>SEAL NOT CHECKED</b> This link&rsquo;s seal value is not a
        member fingerprint, so nothing about these storms was verified.
      </div>
    );
  }
  const match = now === want;
  /* A MATCH IS ONE QUIET LINE; A MISMATCH IS A NOTICE. The good case should not cost the question
     its place on the first screen -- the seal bar repeats it -- and the bad case must be seen. */
  if (match) {
    return (
      <div className="at-seal-ok" data-seal-check="match">
        <b>✓ SEAL VERIFIED · {want}</b> This archive still gives exactly the{" "}
        {result.kept.toLocaleString()} storms this link was sealed over.
      </div>
    );
  }
  return (
    <div className="at-notice" data-seal-check={match ? "match" : "mismatch"} style={{
      borderLeft: `var(--bw-signal, 3px) solid ${match ? "var(--pos)" : "var(--warn)"}`,
      background: `color-mix(in srgb, ${match ? "var(--pos)" : "var(--warn)"} 6%, transparent)`,
    }}>
      <div className="at-notice-hd" style={{ color: match ? "var(--pos)" : "var(--warn)" }}>
        {match ? `SEAL VERIFIED · ${want}` : `SEAL DOES NOT MATCH · ${want}`}
      </div>
      <div className="at-notice-bd">
        {match
          ? `This archive still gives exactly the ${result.kept.toLocaleString()} storms this link was sealed over.`
          : `This link was sealed over a different set of storms. The archive now gives ${result.kept.toLocaleString()} (fingerprint ${now}) under the same question — the words are the same and the population is not.`}
      </div>
    </div>
  );
}
