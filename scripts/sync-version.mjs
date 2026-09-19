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
// 2026-09-16: it now owns the DOWNLOAD LINKS as well, and for the same reason.
// Every "Download" button on the page used to point at /releases/latest -- a
// GitHub page with an asset list to read and a platform to guess. The buttons now
// link straight at the file, which means a version-pinned URL, which means
// something has to keep four of them current or the site ships 404s the day after
// a release. That something is this script, and it refuses to write a URL whose
// asset the release does not actually carry -- a renamed asset fails the job
// loudly here instead of failing silently in a visitor's browser.
//
// 2026-09-17: and the FORMAT COUNT, same story a third time. The format wall is
// generated (the app repo's scripts/gen-site.mjs, from `st2k formats --json`), but
// the number was typed by hand into the meta description, the compare table,
// llms.txt, llms-full.txt and docs/ABOUT.md, so it drifted exactly like the
// version did: on 2026-09-16 the prose said 346 while the wall on the same page
// held 334. The count is now READ OFF THE WALL (one chip per format in the groups
// gen-site numbers) and every prose mention is rewritten from it, under the same
// "a marker that vanished is a hard error" rule as the version.
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

/** Every user-facing asset a release carries, keyed by the `data-dl` value the page's
 *  download links use. `-amd64.exe` is deliberately absent: it is a byte-identical
 *  copy of the plain `.exe` that only exists from 3.0.3 on, so linking the plain name
 *  keeps the same four links working back through 2.3.0. The `.sig` files are not
 *  user-facing. Adding a platform means adding a line here AND a tile in index.html;
 *  either one alone is a hard error below, which is the point. */
const DL_ASSETS = {
  'setup-x64':   (v) => `SageThumbs2K-Setup-${v}.exe`,
  'setup-arm64': (v) => `SageThumbs2K-Setup-${v}-arm64.exe`,
  'zip-x64':     (v) => `SageThumbs2K-Portable-${v}.zip`,
  'zip-arm64':   (v) => `SageThumbs2K-Portable-${v}-arm64.zip`,
};
/** The one the page offers first, and the one schema.org's downloadUrl names. */
const PRIMARY_DL = 'setup-x64';
const DL_BASE = 'https://github.com/LunarWerxs/SageThumbs-2k/releases/download';

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

/**
 * The format wall's numbers, read off the markup gen-site.mjs writes: one `.fc` chip per
 * format inside each `.fmtgroup`, under a heading that carries the group's own
 * `<span class="cnt">N</span>`. Only groups with a NUMERIC heading count are formats: the
 * hand-authored "Preview only" group (the Space-bar document kinds, whose `cnt` reads "Space")
 * is carried through gen-site verbatim and is not a thumbnail format, so it is left out.
 *
 * Throws when a numbered group's chips disagree with its own heading (the wall is then
 * inconsistent with itself, which no rewrite here should paper over) or when there is no wall
 * to read at all -- a page with no wall has no count, and "0 formats" must never be written.
 */
function wallCounts(html) {
  const groupRe =
    /<div class="fmtgroup\b[^"]*"[^>]*data-cat="([a-z]+)"[^>]*>\s*<h3 class="fgh">([\s\S]*?)<\/h3>([\s\S]*?)(?=<div class="fmtgroup\b|<\/section>)/g;
  const groups = [];
  for (const [, cat, heading, body] of html.matchAll(groupRe)) {
    const cnt = heading.match(/<span class="cnt">(\d+)<\/span>/);
    if (!cnt) continue;
    // The heading minus its count span and tags; "Ebook &amp; comics" on the page is
    // "Ebook and comics" in the text files.
    const name = heading.replace(cnt[0], '').replace(/<[^>]+>/g, '').replace(/&amp;/g, 'and').trim();
    const chips = (body.match(/<span class="fc"[^>]*>/g) || []).length;
    if (chips !== Number(cnt[1])) {
      throw new Error(
        `sync-version: the "${name}" group heading says ${cnt[1]} formats but the group holds ` +
        `${chips} chips -- the wall disagrees with itself. Re-run the app repo's ` +
        `scripts/gen-site.mjs against this file rather than editing either number.`);
    }
    groups.push({ cat, name, count: chips });
  }
  if (!groups.length) {
    throw new Error('sync-version: no numbered .fmtgroup blocks found -- is the format wall still in index.html?');
  }
  return { total: groups.reduce((n, g) => n + g.count, 0), groups };
}

/** Greedy word wrap for the hand-wrapped text files: continuation lines indented two spaces. */
function wrapLine(line, width, eol) {
  const out = [];
  let cur = '';
  for (const word of line.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && next.length > width) {
      out.push(cur);
      cur = `  ${word}`;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out.join(eol);
}

/**
 * One prose mention of the format count per rule: `re` finds it with the number in the
 * middle, `render` writes it back from the wall. `between` keeps whatever surrounds the number
 * and swaps the number; `keyFacts` regenerates the whole "N supported formats across K
 * categories: ..." sentence, per-category counts included, because that sentence IS the wall
 * in prose and every number in it comes from the same place.
 */
const between = (re) => ({ re, render: (wall, _eol, _m, a, b) => `${a}${wall.total}${b}` });
const keyFacts = (wrap) => ({
  re: /- \d+ supported formats across \d+ categories:[\s\S]*?\.(?=\r?\n)/,
  render: (wall, eol) => {
    const line =
      `- ${wall.total} supported formats across ${wall.groups.length} categories: ` +
      wall.groups.map((g) => `${g.name} (${g.count})`).join(', ') + '.';
    return wrap ? wrapLine(line, 88, eol) : line;
  },
});

/** Every file that states the count, and every sentence in it that does. A sentence missing
 *  from here is caught by assertNoStrayCounts below; a rule whose sentence vanished is caught
 *  by rewriteCounts. Between them, a count can be neither hand-typed nor silently orphaned. */
const COUNT_RULES = {
  'index.html': [
    between(/(<meta name="description" content="File Explorer thumbnails for )\d+( file types)/),
    between(/(<td>Yes, )\d+( formats<\/td>)/),
  ],
  'llms.txt': [
    between(/(thumbnails for )\d+( file types Windows can't preview)/),
    keyFacts(false),
    between(/(view any of the )\d+( formats as a real image)/),
  ],
  'llms-full.txt': [
    between(/(Explorer thumbnails for )\d+( file types Windows can't preview)/),
    keyFacts(true),
    between(/(view any of the )\d+( formats as a real image)/),
    between(/(maintained successor with )\d+( formats plus the toolkit)/),
  ],
  'docs/ABOUT.md': [
    between(/(thumbnail extension for )\d+( file formats)/),
  ],
  // pricing.md said "346 supported formats" from 2026-09-16 until 2026-09-18 while the wall
  // held 349: it was the one counted file outside this table.
  'pricing.md': [
    between(/(All )\d+( supported formats)/),
  ],
  // The install manifest's description said 316 from the day it was written until 2026-09-19:
  // nothing counted it (audit F24).
  'site.webmanifest': [
    between(/(thumbnails for )\d+( file types Windows can't read)/),
  ],
};

/**
 * The version and "last updated" lines outside index.html. RELEASE-SECURITY.md used to say to
 * bump these by hand on release day, and on 2026-09-18 they were found three releases stale
 * (llms-full said 3.0.0, pricing said 3.0.5, the published release was 3.1.1). They ride the
 * same pass as the counts now. `date` is the release's publish date (UTC), which is when the
 * content these files describe last changed.
 */
const VERSION_RULES = {
  'llms-full.txt': [
    { re: /(Last updated: )\d{4}-\d{2}-\d{2}(\. Current version: )\d+\.\d+\.\d+/,
      render: (v, d, _m, a, b) => `${a}${d}${b}${v}` },
  ],
  'pricing.md': [
    { re: /(Last updated: )\d{4}-\d{2}-\d{2}/, render: (_v, d, _m, a) => `${a}${d}` },
    { re: /(current_version: )\d+\.\d+\.\d+/, render: (v, _d, _m, a) => `${a}${v}` },
  ],
};

function rewriteVersions(text, rules, version, date, file) {
  let out = text;
  for (const rule of rules || []) {
    if (countMatches(out, rule.re) === 0) {
      throw new Error(
        `sync-version: ${file}: the version marker ${rule.re} was not found. Refusing to treat a ` +
        `missing marker as "already current" -- the copy changed shape; fix the rule in ` +
        `VERSION_RULES or the text.`);
    }
    out = out.replace(new RegExp(rule.re.source, 'g'), (...m) => rule.render(version, date, ...m));
  }
  return out;
}

function rewriteCounts(text, rules, wall, file) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let out = text;
  for (const rule of rules) {
    if (countMatches(out, rule.re) === 0) {
      throw new Error(
        `sync-version: ${file}: the format-count sentence ${rule.re} was not found. Refusing to ` +
        `treat a missing marker as "already current" -- the copy changed shape; fix the rule ` +
        `in COUNT_RULES or the text.`);
    }
    out = out.replace(new RegExp(rule.re.source, 'g'), (...m) => rule.render(wall, eol, ...m));
  }
  return out;
}

/** After the rules ran, no three-digit "N formats" / "N file types" may still disagree with
 *  the wall: a new hand-typed count that no rule owns is precisely the drift this script exists
 *  to end, so it fails here rather than shipping. */
function assertNoStrayCounts(text, total, file) {
  const stray = [...text.matchAll(/\b(\d{3})\+?\s+(?:file types|file formats|supported formats|formats)\b/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n !== total);
  if (stray.length) {
    throw new Error(
      `sync-version: ${file} still says ${[...new Set(stray)].join(', ')} formats where the wall ` +
      `has ${total}. Add that sentence to COUNT_RULES, or take the number out of it.`);
  }
}

/** The tag, as a bare `2.3.0`, plus the names of every asset the release actually
 *  published. Refuses anything that is not a version, because writing a draft name
 *  or an empty string into the page would be worse than leaving yesterday's number
 *  there. The asset names are what lets rewriteDownloads() prove a link before it
 *  writes it rather than trusting a filename convention to have held. */
async function latestRelease() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'sagethumbs-site-sync' };
  // GITHUB_TOKEN in Actions lifts the 60/hour anonymous limit; absent locally,
  // which is fine for a once-a-day job.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(RELEASES, { headers });
  if (!res.ok) throw new Error(`releases/latest -> HTTP ${res.status}`);
  const body = await res.json();
  const tag = String(body.tag_name ?? '').trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+/.test(tag)) throw new Error(`tag_name is not a version: ${tag || '(empty)'}`);
  const assets = new Set((body.assets ?? []).map((a) => String(a.name ?? '')));
  // The publish date, for the "Last updated" lines VERSION_RULES owns. Refused when it is
  // not a date for the same reason the tag is: a blank in the page is worse than last time's.
  const date = String(body.published_at ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`published_at is not a date: ${date || '(empty)'}`);
  return { version: tag, assets, date };
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

/**
 * Repoint every download link, and schema.org's downloadUrl, at the files in this
 * release.
 *
 * Matches the whole `<a ... data-dl="key" ...>` tag and rewrites the href inside it,
 * so it does not care what order the attributes are written in -- a cheap property to
 * have, given the next person to touch that markup will not have read this file.
 *
 * Three ways this throws, all of them deliberate:
 *   - the page has a `data-dl` key this script does not know  -> new platform, no URL rule
 *   - this script has a key the page no longer has a link for -> tile deleted, link silently lost
 *   - the release does not contain the file a key resolves to -> the link would 404
 * The third is the one that matters: a download button that 404s looks exactly like a
 * working site until someone clicks it.
 */
function rewriteDownloads(html, version, assets) {
  const seen = new Set();
  const out = html.replace(/<a\b[^>]*\sdata-dl="([a-z0-9-]+)"[^>]*>/gi, (tag, key) => {
    const name = DL_ASSETS[key];
    if (!name) {
      throw new Error(
        `sync-version: index.html has data-dl="${key}", which is not a known release ` +
        `asset. Add it to DL_ASSETS (with the filename that release publishes) or fix the markup.`);
    }
    const file = name(version);
    if (assets.size && !assets.has(file)) {
      throw new Error(
        `sync-version: release v${version} does not contain "${file}", the asset behind ` +
        `data-dl="${key}". Refusing to write a download button that 404s -- either the release ` +
        `job renamed that asset (update DL_ASSETS) or this release did not publish that platform ` +
        `(remove its tile from index.html). Published: ${[...assets].join(', ') || '(none)'}`);
    }
    if (!/\shref="/.test(tag)) throw new Error(`sync-version: the data-dl="${key}" link has no href to rewrite`);
    seen.add(key);
    return tag.replace(/(\shref=")[^"]*(")/, (_m, a, b) => `${a}${DL_BASE}/v${version}/${file}${b}`);
  });

  const missing = Object.keys(DL_ASSETS).filter((k) => !seen.has(k));
  if (missing.length) {
    throw new Error(
      `sync-version: index.html has no download link for ${missing.join(', ')}. Every asset in ` +
      `DL_ASSETS is supposed to be offered on the page; a platform that quietly stops being ` +
      `linked is a platform nobody can download. Restore the tile, or drop the key here.`);
  }

  // schema.org downloadUrl: what crawlers and the AI answer engines this page carries
  // markup for actually follow. It pointed at the releases page for the same reason the
  // buttons did, and is worth no less than they are.
  const ldRe = /("downloadUrl"\s*:\s*")[^"]*(")/g;
  if (countMatches(html, ldRe) === 0) {
    throw new Error('sync-version: JSON-LD "downloadUrl" not found. Refusing to treat a missing marker as already current.');
  }
  const primary = `${DL_BASE}/v${version}/${DL_ASSETS[PRIMARY_DL](version)}`;
  return out.replace(ldRe, (_m, a, b) => `${a}${primary}${b}`);
}

async function main() {
  const { version, assets, date } = await latestRelease();
  const page = fs.readFileSync(PAGE, 'utf8');
  validateCategoryCount(page);
  const wall = wallCounts(page);

  // Every file the count lives in, index.html first (it also carries the version and the
  // download links). A file is written only when something in it actually moved.
  const changed = [];
  for (const [rel, rules] of Object.entries(COUNT_RULES)) {
    const file = path.join(ROOT, rel);
    const before = fs.readFileSync(file, 'utf8');
    let after = rel === 'index.html' ? rewriteDownloads(rewrite(before, version), version, assets) : before;
    after = rewriteCounts(after, rules, wall, rel);
    after = rewriteVersions(after, VERSION_RULES[rel], version, date, rel);
    assertNoStrayCounts(after, wall.total, rel);
    if (before === after) continue;
    // Say what moved. A silent "updated" tells nobody whether the rules still match what the
    // files look like today.
    const versionsWere = [...before.matchAll(/(?:"softwareVersion"\s*:\s*"|Current version: |current_version: )(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
    const countsWere = [...before.matchAll(/\b(\d{3})\s+(?:file types|file formats|supported formats|formats)\b/g)].map((m) => m[1]);
    const notes = [];
    if (versionsWere.length) notes.push(`version ${[...new Set(versionsWere)].join(', ')} -> ${version}`);
    if (countsWere.length) notes.push(`format count ${[...new Set(countsWere)].join(', ')} -> ${wall.total}`);
    console.log(`${rel}: ${notes.join('; ') || 'download links'}`);
    changed.push(rel);
    if (!check) fs.writeFileSync(file, after);
  }

  if (!changed.length) {
    console.log(`site version ${version}, download links and format count ${wall.total} already current; nothing to do`);
  } else if (check) {
    console.error(`STALE (${changed.join(', ')}): run \`node scripts/sync-version.mjs\` to fix`);
    process.exitCode = 1;
  } else {
    console.log(`${changed.join(', ')} updated`);
  }
}

// NOTHING here calls `process.exit()`, and no error escapes the top-level await either;
// both are deliberate rather than stylistic. Calling exit() from inside a top-level await
// tears the event loop down mid-flight, and on Windows Node aborts with a libuv assertion
// and exit code 127 -- so a gate meant to report "stale" with a 1, and a happy path meant
// to report success with a 0, both came back as a crash. A throw that reaches the top level
// after the fetch does the same (`!(handle->flags & UV_HANDLE_CLOSING)`, seen 2026-09-17), so
// every failure is caught here, printed as one line, and reported through `exitCode`.
try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
