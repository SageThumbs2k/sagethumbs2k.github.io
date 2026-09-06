// Keep the version baked into index.html equal to the latest published release.
//
// WHY THIS EXISTS. The page already corrects itself in the browser: a small
// script fetches /releases/latest and rewrites the pills and the JSON-LD after
// load. That is genuinely enough for a human with a working network, and it is
// why nobody noticed the static file rotting. It is not enough for anyone else.
//
// On 2026-08-21 the shipped release was v2.3.0 and the STATIC html still said
// 1.8.2 -- six releases behind. Everything that does not run JavaScript saw
// 1.8.2: search crawlers, the AI answer engines this site has schema.org markup
// for in the first place, link unfurlers, and every visitor whose request landed
// on GitHub's unauthenticated 60-per-hour API limit and silently fell back.
// A fallback that is wrong for months is not a fallback, it is a second claim.
//
// So the fallback is now generated rather than remembered. This runs on a
// schedule and on demand, rewrites both places the version appears, and commits
// only when something actually changed.
//
//   node scripts/sync-version.mjs           # rewrite if stale
//   node scripts/sync-version.mjs --check   # exit 1 if stale, write nothing
//
// AUDIT F24 (P3): rewrite() used to replace-and-return without ever checking whether either
// regex matched anything, so a template edit that renamed or removed a marker (js-app-version
// class, softwareVersion key) made `before === after` for the WRONG reason -- indistinguishable
// from "already current" -- and this script would report success while quietly no longer
// tracking the version at all. It now counts matches before replacing and throws (a real
// failure, both in --check and in write mode) when a marker it expects is not found.
// Also validates the "N categories" eyebrow against the number of .fmtgroup blocks the page
// actually has, since that pair drifted silently once already (index.html said 6, the wall
// itself had 7) with nothing here or in the wall's own generator (gen-site.mjs, app repo)
// catching it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'index.html');
const RELEASES = 'https://api.github.com/repos/LunarWerxs/SageThumbs-2k/releases/latest';

const check = process.argv.includes('--check');

function countMatches(html, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  return (html.match(g) || []).length;
}

/** Cross-checks the coverage section's "hundreds of formats, N categories" prose against the
 *  number of .fmtgroup blocks actually present in the format wall below it. The two are
 *  independent pieces of markup (one hand-written prose string, one generated block) and
 *  nothing enforced they agree -- which is exactly how the page shipped claiming 6 categories
 *  while the wall itself had 7. Throws rather than warns: a drifted count is wrong content on
 *  a public page, not a style nit. */
function validateCategoryCount(html) {
  const eyebrow = html.match(/hundreds of formats, (\d+) categories/);
  if (!eyebrow) throw new Error('sync-version: could not find the "N categories" eyebrow marker to validate');
  const claimed = Number(eyebrow[1]);
  const groups = html.match(/<div class="fmtgroup\b[^"]*"[^>]*data-cat="[a-z]+"/g) || [];
  const present = new Set(groups.map((g) => (g.match(/data-cat="([a-z]+)"/) || [])[1])).size;
  if (present !== claimed) {
    throw new Error(
      `sync-version: eyebrow claims ${claimed} categories but the page has ${present} distinct ` +
      `.fmtgroup data-cat blocks -- the prose and the format wall have drifted. Re-run the app ` +
      `repo's scripts/gen-site.mjs against this file, or fix the eyebrow text by hand.`);
  }
}

/** The tag, as a bare `2.3.0`. Refuses anything that is not a version, because
 *  writing a draft name or an empty string into the page would be worse than
 *  leaving yesterday's number there. */
async function latestVersion() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'sagethumbs-site-sync' };
  // GITHUB_TOKEN in Actions lifts the 60/hour anonymous limit; absent locally,
  // which is fine for a once-a-day job.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(RELEASES, { headers });
  if (!res.ok) throw new Error(`releases/latest -> HTTP ${res.status}`);
  const tag = String((await res.json()).tag_name ?? '').trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+/.test(tag)) throw new Error(`tag_name is not a version: ${tag || '(empty)'}`);
  return tag;
}

/**
 * Both places the version is written, and they are different shapes on purpose.
 *
 * `.js-app-version` is what a reader sees; it carries the `v`. `softwareVersion`
 * is schema.org and must be bare, because that is what the vocabulary says and
 * what the answer engines parse. The runtime script in the page rewrites exactly
 * these two, so keeping to the same pair means the static file and the live
 * correction can never disagree about WHERE the version lives.
 */
function rewrite(html, version) {
  const pillRe = /(<[^>]*class="[^"]*\bjs-app-version\b[^"]*"[^>]*>)v?\d+\.\d+\.\d+[^<]*(<\/)/g;
  const schemaRe = /("softwareVersion"\s*:\s*")\d+\.\d+\.\d+[^"]*(")/g;
  const pillCount = countMatches(html, pillRe);
  const schemaCount = countMatches(html, schemaRe);
  if (pillCount === 0 || schemaCount === 0) {
    throw new Error(
      `sync-version: expected version markers not found (js-app-version pills: ${pillCount}, ` +
      `softwareVersion: ${schemaCount}). Refusing to treat a missing marker as "already ` +
      `current" -- the template likely changed shape. Fix the regex or the markup.`);
  }
  let out = html.replace(pillRe, `$1v${version}$2`);
  out = out.replace(schemaRe, `$1${version}$2`);
  return out;
}

const version = await latestVersion();
const before = fs.readFileSync(PAGE, 'utf8');
validateCategoryCount(before);
const after = rewrite(before, version);

// NOTHING here calls `process.exit()`, and that is deliberate rather than
// stylistic. Calling it from inside a top-level await tears the event loop down
// mid-flight, and on Windows Node aborts with a libuv assertion and exit code
// 127 -- so a gate meant to report "stale" with a 1, and a happy path meant to
// report success with a 0, both came back as a crash. Setting `exitCode` and
// letting the process end on its own gives the codes the script promises.
if (before === after) {
  console.log(`site version already ${version}; nothing to do`);
} else {
  // Say what moved. A silent "updated" tells nobody whether the regex still
  // matches what the page looks like today.
  const was = [...before.matchAll(/"softwareVersion"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  console.log(`site version ${[...new Set(was)].join(', ') || '(unknown)'} -> ${version}`);

  if (check) {
    console.error('STALE: run `node scripts/sync-version.mjs` to fix');
    process.exitCode = 1;
  } else {
    fs.writeFileSync(PAGE, after);
    console.log('index.html updated');
  }
}
