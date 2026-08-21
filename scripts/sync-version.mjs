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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'index.html');
const RELEASES = 'https://api.github.com/repos/LunarWerxs/SageThumbs-2k/releases/latest';

const check = process.argv.includes('--check');

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
  let out = html.replace(
    /(<[^>]*class="[^"]*\bjs-app-version\b[^"]*"[^>]*>)v?\d+\.\d+\.\d+[^<]*(<\/)/g,
    `$1v${version}$2`,
  );
  out = out.replace(/("softwareVersion"\s*:\s*")\d+\.\d+\.\d+[^"]*(")/g, `$1${version}$2`);
  return out;
}

const version = await latestVersion();
const before = fs.readFileSync(PAGE, 'utf8');
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
