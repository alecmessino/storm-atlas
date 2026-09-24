#!/usr/bin/env node
/* FORBIDDEN-STRING SCAN of what this repository publishes.
 *
 * Every match of a term below is a HARD FAIL unless scripts/scan-allowlist.json names it
 * explicitly: the file (regex), the term, and the exact enclosing word it matched in, with a
 * reason. Matching is case-insensitive and on substrings, so "edge" inside "ledger" is a match
 * and has to be allowlisted by name; nothing is waved through by a word-boundary rule.
 *
 *   node scripts/scan-public.mjs            docs/ (the Pages site), .gz packs decompressed
 *   node scripts/scan-public.mjs --repo     every tracked file in the repository
 *   node scripts/scan-public.mjs --self-test */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findHashedTerms, HASHED_TERMS, makeTerm } from "./lib/term-hash.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TERMS = [
  "kalshi", "market", "edge", "terminal", "/briefs/", "/chats/", "outbound", "external-user",
  "github.com/alecmessino/category-alpha",
  // added: same families
  "category-alpha", "polymarket", "kelly", "sourcemappingurl", "briefs/", "chats/", "ledger.md",
  "scratchpad", "/home/user", "claude-session", "dossier", "outreach", "prospect",
];
const ALLOW = JSON.parse(readFileSync(join(ROOT, "scripts/scan-allowlist.json"), "utf8")).allow
  .map((a) => ({ ...a, re: new RegExp(a.path) }));
const isWordCh = (c) => /[a-z0-9_-]/.test(c);

/* Plain TERMS above, plus the hashed terms in lib/term-hash.mjs (same substring rule; the
   specific terms are not named in this file). */
export function scanText(path, text, allow = ALLOW, hashed = HASHED_TERMS) {
  const t = text.toLowerCase(), out = [];
  for (const h of findHashedTerms(t, hashed)) {
    let s = h.index, e = h.index + (hashed.find((x) => x.id === h.id) || {}).len;
    while (s > 0 && isWordCh(t[s - 1])) s--;
    while (e < t.length && isWordCh(t[e])) e++;
    const word = t.slice(s, e);
    if (!allow.some((a) => a.term === h.id && a.word === word && a.re.test(path)))
      out.push({ path, term: h.id, word: "(hashed term)", at: "(context withheld)" });
  }
  for (const term of TERMS) {
    let i = t.indexOf(term);
    while (i !== -1) {
      let s = i, e = i + term.length;
      while (s > 0 && isWordCh(t[s - 1])) s--;
      while (e < t.length && isWordCh(t[e])) e++;
      const word = t.slice(s, e);
      const ok = allow.some((a) => a.term === term && a.word === word && a.re.test(path));
      if (!ok) out.push({ path, term, word, at: t.slice(Math.max(0, i - 50), i + term.length + 50).replace(/\s+/g, " ") });
      i = t.indexOf(term, i + 1);
    }
  }
  return out;
}

function files(scope) {
  if (scope === "repo") return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: ROOT }).toString().trim().split("\n").filter(Boolean);
  const walk = (d) => readdirSync(join(ROOT, d)).flatMap((f) => { const p = join(d, f); return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
  return walk("docs");
}

function read(p) {
  let b = readFileSync(join(ROOT, p));
  if (p.endsWith(".gz")) b = gunzipSync(b);
  return b.toString("utf8");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && process.argv.includes("--self-test")) {
  const bad = [
    ["docs/data/latest.json", '{"contracts":[{"venue":"KALSHI"}]}'],
    ["docs/index.html", '<a href="../">back to Millibar Terminal</a>'],
    ["docs/dist/atlas.js", "//# sourceMappingURL=atlas.js.map"],
    ["docs/x.html", "mailto:person@example.invalid · CONTACT"],   // hashed-rule canary below
    ["docs/x.html", "note from zq-canary-org"],
    ["docs/x.html", "https://github.com/alecmessino/category-alpha/blob/main/briefs/OUTBOUND-LEDGER.md"],
    ["docs/data/latest.json", "an edge case"],
  ];
  let wrong = 0;
  /* The hashed rule is exercised with synthetic canary terms, built the same way as the real
     ones: an address-like prefix and an organisation-like word, matched inside longer words too. */
  const CANARY = [...HASHED_TERMS, makeTerm("canary-contact", "person@"), makeTerm("canary-org", "zq-canary-org")];
  for (const [p, s] of bad) { const h = scanText(p, s, ALLOW, CANARY); if (!h.length) wrong++; console.log(`${h.length ? "PASS" : "WRONG"}  rejects ${JSON.stringify(s).slice(0, 70)}`); }
  for (const s of ["write to XPERSON@example.invalid", "the ZQ-CANARY-ORGs report"]) {
    const h = scanText("docs/data/latest.json", s, ALLOW, CANARY); if (!h.length) wrong++;
    console.log(`${h.length ? "PASS" : "WRONG"}  hashed rule rejects (case/infix) ${JSON.stringify(s)}`);
  }
  const shape = HASHED_TERMS.every((x) => x.len > 0 && /^[0-9a-f]{64}$/.test(x.sha) && Number.isInteger(x.rk));
  if (!shape || HASHED_TERMS.length < 2) wrong++;
  console.log(`${shape && HASHED_TERMS.length >= 2 ? "PASS" : "WRONG"}  production hashed terms present and well-formed (${HASHED_TERMS.length})`);
  const good = scanText("docs/atlas.css", ".at-ledger{}");
  if (good.length) wrong++; console.log(`${good.length ? "WRONG" : "PASS"}  accepts an allowlisted word (at-ledger in atlas.css)`);
  console.log(wrong ? `\n${wrong} wrong` : "\nself-test: every case as required");
  process.exit(wrong ? 1 : 0);
}

if (isMain) main();
function main() {
const scope = process.argv.includes("--repo") ? "repo" : "site";
const all = [];
for (const p of files(scope)) {
  if (p === "scripts/scan-public.mjs" || p === "scripts/scan-allowlist.json" || p === "scripts/test-public-schema.mjs") continue; // the gates name the terms
  if (/\.(woff2|png|ico)$/.test(p)) continue;
  if (!statSync(join(ROOT, p)).isFile()) continue;                                   // symlinks to dirs, etc.                                        // binary faces/images
  all.push(...scanText(p, read(p)));
}
const byKey = new Map();
for (const h of all) { const k = `${h.path} | ${h.term} | ${h.word}`; if (!byKey.has(k)) byKey.set(k, { n: 0, at: h.at }); byKey.get(k).n++; }
for (const [k, v] of byKey) console.log(`FAIL  ${k}  x${v.n}  …${v.at}…`);
console.log(all.length ? `\n${all.length} forbidden match(es) in ${scope} scope` : `scan (${scope}): 0 forbidden matches`);
process.exit(all.length ? 1 : 0);
}
