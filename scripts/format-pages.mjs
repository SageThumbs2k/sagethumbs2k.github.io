#!/usr/bin/env node
/**
 * Per-format guide pages: one page per file type people search for ("PSD thumbnails in
 * Windows Explorer"), built from scripts/format-pages.data.mjs. Writes:
 *
 *   formats/index.html          the hub, every guide grouped by kind
 *   formats/<slug>/index.html   one guide per format family
 *   formats/guides.json         extension -> guide path. The app repo's scripts/gen-site.mjs
 *                               reads it when it regenerates the homepage format wall, so
 *                               each chip that has a guide links to it and keeps doing so
 *                               after the next release regenerates the wall.
 *   sitemap.xml                 one <url> per guide; every other entry is kept as it is
 *   llms.txt                    the "## Format guides" section
 *
 * Refuses to write, and --check exits 1, when a guide names an extension the homepage wall
 * does not list (a guide must never promise a format the app does not register), when two
 * guides claim one extension, when copy breaks the site's rules (no em dashes, no paragraph
 * or list item over 40 words, no build-machine path), or, under --check, when the wall's
 * chips and guides.json disagree.
 *
 *   node scripts/format-pages.mjs            write everything
 *   node scripts/format-pages.mjs --check    verify everything is current, write nothing
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, GROUPS, SHARED_LIMITS, UPDATED } from './format-pages.data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://sagethumbs.lunarwerx.com';
const RELEASES = 'https://github.com/LunarWerxs/SageThumbs-2k/releases/latest';
const WINGET = 'winget install LunarWerxs.SageThumbs2K';
const PARA_LIMIT = 40;
const CHECK = process.argv.includes('--check');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
// Git for Windows checks these files out with CRLF; what is compared is the text, not the line ending.
const same = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const guidePath = (slug) => `/formats/${slug}/`;
const bySlug = new Map(PAGES.map((p) => [p.slug, p]));

const errors = [];
const fail = (msg) => errors.push(msg);

/** The homepage wall's chips: extension -> description. The wall is generated from
 *  `st2k formats --json` by the app repo, so it is the site's copy of what the app registers. */
function wallChips(html) {
  const chips = new Map();
  for (const m of html.matchAll(/<span class="fc" title="([^"]*)">(?:<a href="([^"]*)">)?\.([a-z0-9]+)(?:<\/a>)?<\/span>/g)) {
    chips.set(m[3], { description: unesc(m[1]), href: m[2] ?? null });
  }
  if (!chips.size) throw new Error('format-pages: no format chips found in index.html; is the wall still there?');
  return chips;
}

/** Plain text with [label](slug-or-path) links and `code`, to HTML. */
function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, target) => {
      if (!target.startsWith('/') && !target.startsWith('https://')) {
        if (!bySlug.has(target)) fail(`link to unknown guide "${target}"`);
        target = guidePath(target);
      }
      return `<a href="${target}">${label}</a>`;
    });
}

const list = (items) => `<ul>\n${items.map((t) => `      <li>${inline(t)}</li>`).join('\n')}\n    </ul>`;

/** Width and height of a lossy, lossless or extended WebP, from its header. */
function webpSize(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${file} is not a WebP`);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >>> 14) & 0x3fff) + 1]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

/** The analytics snippet the homepage carries, so the guides are measured the same way. */
function pixelSnippet(html) {
  const start = html.indexOf('<script', html.indexOf('<!-- ARGUS Analytics Pixel'));
  const end = html.indexOf('<!-- End ARGUS Analytics Pixel -->');
  if (start < 0 || end < 0 || end < start) throw new Error('format-pages: the analytics snippet was not found in index.html');
  return html.slice(start, end).trim();
}

function head({ title, description, url, crumbs, pixel }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: BASE + href })),
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0b0e13">
<script>try{var t=localStorage.getItem('st2k-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<meta property="og:type" content="article">
<meta property="og:site_name" content="SageThumbs 2K">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${BASE}/og.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&amp;family=Geist+Mono:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="/formats/format.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${pixel}
</head>
<body>
<header class="nav">
  <div class="nav-in">
    <a class="brand" href="/" aria-label="SageThumbs 2K, home"><img src="/img/logo-81.png" width="27" height="27" alt=""><span class="wm">SageThumbs<span class="k">2K</span></span></a>
    <nav class="nav-links" aria-label="Primary">
      <a href="/formats/">Format guides</a>
      <a href="/#formats">All formats</a>
      <a href="/#pricing">Pricing</a>
    </nav>
    <a class="btn btn-primary btn-sm" href="#get">Download</a>
  </div>
</header>
<main class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbs.map(([name, href], i) =>
    i === crumbs.length - 1 ? `<span aria-current="page">${esc(name)}</span>` : `<a href="${href}">${esc(name)}</a><span class="sep" aria-hidden="true">/</span>`).join('')}</nav>`;
}

const GET = `  <section class="get" id="get">
    <h2>Get SageThumbs 2K</h2>
    <p>Install it with winget:</p>
    <pre><code>${WINGET}</code></pre>
    <p>Or download the installer from GitHub and run it.</p>
    <p><a class="btn btn-primary" href="${RELEASES}" rel="noopener">Download the installer</a></p>
    <p class="note">Windows 11 and 10, 64-bit, on x64 and Arm. The same page has a portable zip that needs no installing.</p>
    <h3>Free for personal use</h3>
    <p>Home, hobby and other non-commercial use is free: every format and every tool. A company, a shop or anyone doing paid work needs a business licence for each PC.</p>
    <p>A business licence is US$49 per PC once, with 12 months of updates, or US$2.99 per PC a month. <a href="/#pricing">See business licence pricing</a></p>
  </section>`;

const TROUBLE = [
  'Windows caches thumbnails, and a file it failed on once stays failed. In SageThumbs, Settings ▸ Advanced ▸ Rebuild thumbnail cache clears the cache and restarts Explorer.',
  'Make sure File Explorer\'s "Always show icons, never thumbnails" option is off, and that the format is ticked in SageThumbs Settings ▸ File types.',
  'Run `st2k doctor` in a terminal. It only reads, checks the whole chain, and prints a fix under anything that is wrong.',
];

const FOOT = `<footer>
  <div class="wrap foot">
    <span>© 2026 LunarWerx. Licensed <a href="https://github.com/LunarWerxs/SageThumbs-2k/blob/main/.github/LICENSE.md" rel="noopener">PolyForm Noncommercial 1.0.0</a>: free at home, paid at work.</span>
    <span><a href="/">Home</a> · <a href="/formats/">Format guides</a> · <a href="https://github.com/LunarWerxs/SageThumbs-2k" rel="noopener">GitHub</a> · <a href="${RELEASES}" rel="noopener">Releases</a></span>
  </div>
</footer>
</body>
</html>
`;

const card = (p) => `<li><a href="${guidePath(p.slug)}"><b>${esc(p.name)}</b><span>${esc(p.blurb)}</span></a></li>`;

function guideHtml(p, chips, pixel) {
  const url = BASE + guidePath(p.slug);
  const title = p.h1.length + 16 <= 66 ? `${p.h1} | SageThumbs 2K` : p.h1;
  let figure = '';
  if (p.image) {
    const file = join(ROOT, 'img', 'gallery', p.image.src);
    if (!existsSync(file)) fail(`${p.slug}: image ${p.image.src} is not in img/gallery`);
    else {
      const [w, h] = webpSize(file);
      figure = `\n  <figure class="shot"><img src="/img/gallery/${p.image.src}" width="${w}" height="${h}" alt="${esc(p.image.alt)}"></figure>`;
    }
  }
  const sections = [
    ['What you see', p.shows],
    ['Limits', [...(p.limits ?? []), ...SHARED_LIMITS]],
    ['More you can do', p.more],
  ].filter(([, items]) => items?.length)
    .map(([h, items]) => `  <section>\n    <h2>${h}</h2>\n    ${list(items)}\n  </section>`).join('\n');
  const extChips = p.exts.map((e) => `<span class="chip" title="${esc(chips.get(e)?.description ?? '')}">.${e}</span>`).join(' ');
  const related = (p.related ?? []).map((s) => bySlug.get(s) ?? (fail(`${p.slug}: related guide "${s}" does not exist`), null)).filter(Boolean);
  return `${head({ title, description: p.description, url, crumbs: [['SageThumbs 2K', '/'], ['Format guides', '/formats/'], [p.name, guidePath(p.slug)]], pixel })}
  <h1>${esc(p.h1)}</h1>
  <p class="lead">${inline(p.lead)}</p>${figure}
${sections}
  <section>
    <h2>Extensions this covers</h2>
    <div class="chips">${extChips}</div>
    <p class="note"><a href="/#formats">See every format SageThumbs 2K supports</a> or <a href="/formats/">browse all format guides</a>.</p>
  </section>
${GET}
  <section>
    <h2>Thumbnails not showing?</h2>
    ${list(TROUBLE)}
  </section>
  <section>
    <h2>Related guides</h2>
    <ul class="cards">${related.map(card).join('')}</ul>
  </section>
</main>
${FOOT}`;
}

function hubHtml(pixel) {
  const groups = GROUPS.map(([id, label]) => {
    const pages = PAGES.filter((p) => p.group === id);
    if (!pages.length) fail(`group "${id}" has no guides`);
    return `  <section>\n    <h2>${esc(label)}</h2>\n    <ul class="cards">${pages.map(card).join('')}</ul>\n  </section>`;
  }).join('\n');
  for (const p of PAGES) if (!GROUPS.some(([id]) => id === p.group)) fail(`${p.slug}: unknown group "${p.group}"`);
  return `${head({
    title: 'Thumbnail guides by file format | SageThumbs 2K',
    description: 'What SageThumbs 2K shows in Windows File Explorer for PSD, Blender, STL, EPUB, HEIC, camera RAW, MKV and more, with the limits of each.',
    url: `${BASE}/formats/`,
    crumbs: [['SageThumbs 2K', '/'], ['Format guides', '/formats/']],
    pixel,
  })}
  <h1>Thumbnail guides by file format</h1>
  <p class="lead">Pick your file type to see what SageThumbs 2K shows for it in Windows File Explorer, how it does it, and where it stops. The home page lists <a href="/#formats">every supported format</a>.</p>
${groups}
${GET}
</main>
${FOOT}`;
}

/** Every rule the homepage's copy gate enforces, applied to one generated page. */
function checkCopy(rel, html) {
  const body = html.slice(html.indexOf('<body'))
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  if (/—|&mdash;/.test(body) || /—/.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, ''))) fail(`${rel}: em dash in visitor-facing copy`);
  for (const m of body.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const n = text ? text.split(' ').length : 0;
    if (n > PARA_LIMIT) fail(`${rel}: ${n}-word paragraph (limit ${PARA_LIMIT}): ${text.slice(0, 70)}`);
  }
  const local = html.match(/\b[A-Za-z]:[\\/](?!Program Files|Windows[\\/])[^\s"'<>]{2,}|\/(?:home|Users)\/[A-Za-z][^\s"'<>]*/);
  if (local) fail(`${rel}: build-machine path in the page: ${local[0].slice(0, 60)}`);
}

function sitemapXml(current) {
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const kept = [...current.matchAll(/ {2}<url>[\s\S]*?<\/url>/g)].map((m) => m[0])
    .filter((u) => !u.includes(`<loc>${BASE}/formats/`));
  const entry = (loc, priority) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${UPDATED}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  const ours = [entry(`${BASE}/formats/`, '0.8'), ...PAGES.map((p) => entry(BASE + guidePath(p.slug), '0.7'))];
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...kept.map((u) => u.replace(/\r\n/g, '\n')), ...ours, '</urlset>', ''].join('\n').replace(/\n/g, eol);
}

function llmsTxt(current) {
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const text = current.replace(/\r\n/g, '\n');
  const section = ['## Format guides',
    'One page per file type: what SageThumbs 2K shows for it in File Explorer, how, and its limits.',
    `- All guides: ${BASE}/formats/`,
    ...PAGES.map((p) => `- ${p.name}: ${BASE}${guidePath(p.slug)}`), '', ''].join('\n');
  const without = text.replace(/## Format guides\n[\s\S]*?(?=\n## |$)/, '').replace(/\n{3,}/g, '\n\n');
  const at = without.indexOf('## Links');
  if (at < 0) throw new Error('format-pages: llms.txt has no "## Links" section to put the guides before');
  return (without.slice(0, at) + section + without.slice(at)).replace(/\n/g, eol);
}

const index = read('index.html');
const chips = wallChips(index);
const pixel = pixelSnippet(index);

const owner = new Map();
for (const p of PAGES) {
  if (!/^[a-z0-9-]+$/.test(p.slug)) fail(`bad slug "${p.slug}"`);
  if (!p.h1.includes('Windows Explorer')) fail(`${p.slug}: the H1 must name Windows Explorer`);
  if (p.description.length > 165) fail(`${p.slug}: meta description is ${p.description.length} characters (max 165)`);
  for (const e of p.exts) {
    if (!chips.has(e)) fail(`${p.slug}: .${e} is not on the homepage format wall, so the app does not register it`);
    if (owner.has(e)) fail(`.${e} is claimed by both ${owner.get(e)} and ${p.slug}`);
    owner.set(e, p.slug);
  }
}

const outputs = new Map();
outputs.set('formats/index.html', hubHtml(pixel));
for (const p of PAGES) outputs.set(`formats/${p.slug}/index.html`, guideHtml(p, chips, pixel));
for (const [rel, html] of outputs) checkCopy(rel, html);
const guides = Object.fromEntries([...owner].sort(([a], [b]) => a.localeCompare(b)).map(([e, s]) => [e, guidePath(s)]));
outputs.set('formats/guides.json', JSON.stringify(guides, null, 2) + '\n');
outputs.set('sitemap.xml', sitemapXml(read('sitemap.xml')));
outputs.set('llms.txt', llmsTxt(read('llms.txt')));

// A guide folder with no guide behind it would stay live and unlinked.
const dirs = existsSync(join(ROOT, 'formats'))
  ? readdirSync(join(ROOT, 'formats'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
const orphans = dirs.filter((d) => !bySlug.has(d));

if (errors.length) {
  console.error(`format-pages: ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}

if (CHECK) {
  const stale = [...outputs].filter(([rel, text]) => !existsSync(join(ROOT, rel)) || !same(read(rel), text)).map(([rel]) => rel);
  // The wall is written by the app repo's gen-site.mjs from guides.json; this proves it was run.
  const unlinked = Object.entries(guides).filter(([e, href]) => chips.get(e)?.href !== href).map(([e]) => '.' + e);
  const strayLinks = [...chips].filter(([e, c]) => c.href && !guides[e]).map(([e]) => '.' + e);
  const problems = [];
  if (stale.length) problems.push(`stale or missing (run node scripts/format-pages.mjs): ${stale.join(', ')}`);
  if (orphans.length) problems.push(`guide folders with no guide in the data: ${orphans.map((d) => `formats/${d}/`).join(', ')}`);
  if (unlinked.length) problems.push(`${unlinked.length} wall chip(s) do not link their guide, e.g. ${unlinked.slice(0, 5).join(' ')}. Run the app repo's gen-site.mjs with --site pointing at this index.html.`);
  if (strayLinks.length) problems.push(`wall chips link a guide that does not exist: ${strayLinks.join(' ')}`);
  if (problems.length) {
    console.error('format-pages --check FAILED:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log(`format-pages --check: ${PAGES.length} guides, ${owner.size} extensions linked, everything current.`);
  process.exit(0);
}

for (const d of orphans) rmSync(join(ROOT, 'formats', d), { recursive: true });
let wrote = 0;
for (const [rel, text] of outputs) {
  const file = join(ROOT, rel);
  if (existsSync(file) && same(readFileSync(file, 'utf8'), text)) continue;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  wrote++;
}
console.log(`format-pages: ${PAGES.length} guides, ${owner.size} extensions; ${wrote} file(s) written${orphans.length ? `, removed ${orphans.join(', ')}` : ''}.`);
