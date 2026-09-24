/* HASHED BLOCK-TERMS.
 *
 * Some blocked substrings are specific enough that listing them in plain text would advertise
 * what they protect. They are stored as a salted SHA-256 plus their length, and matched the same
 * way the plain terms are: case-insensitive substrings of the scanned text, including inside
 * longer words. A Rabin-Karp rolling hash picks candidate windows; SHA-256 confirms each one.
 *
 * This is not secrecy (short terms can be brute-forced); it keeps the scanner from naming them.
 * The rule a term enforces is tested with a synthetic canary term (see the self-tests). */
import { createHash } from "node:crypto";

const SALT = "storm-atlas-term:";
const BASE = 257, MOD = 2147483647;

export const sha = (s) => createHash("sha256").update(SALT + s).digest("hex");
export function rk(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * BASE + s.charCodeAt(i)) % MOD; return h; }

/* id, length, rolling hash, salted sha256. Add a term with makeTerm("<id>", "<text>") offline. */
export const HASHED_TERMS = [
  { id: "hashed-term-1", len: 6, rk: 1004698842, sha: "b7aa7e7723ed2445c796b7ddd96258b35703033896d518519725a2568e89a783" },
  { id: "hashed-term-2", len: 7, rk: 1279739339, sha: "ad2b6761b27f181321635aa86cdcca47aa7707a2ae748c04f74c1ce8be1385d4" },
];

export const makeTerm = (id, text) => ({ id, len: text.length, rk: rk(text.toLowerCase()), sha: sha(text.toLowerCase()) });

/* Every match: { id, index } over the lowercased text. */
export function findHashedTerms(text, terms = HASHED_TERMS) {
  const t = String(text).toLowerCase(), out = [];
  for (const len of [...new Set(terms.map((x) => x.len))]) {
    if (t.length < len) continue;
    const group = terms.filter((x) => x.len === len);
    let pow = 1; for (let i = 1; i < len; i++) pow = (pow * BASE) % MOD;
    let h = 0; for (let i = 0; i < len; i++) h = (h * BASE + t.charCodeAt(i)) % MOD;
    for (let i = 0; ; i++) {
      for (const g of group) if (g.rk === h && sha(t.slice(i, i + len)) === g.sha) out.push({ id: g.id, index: i });
      if (i + len >= t.length) break;
      h = (h - (t.charCodeAt(i) * pow) % MOD + MOD) % MOD;
      h = (h * BASE + t.charCodeAt(i + len)) % MOD;
    }
  }
  return out;
}
