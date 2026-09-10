# SageThumbs 2K site

> Marketing and download site for SageThumbs 2K, a Windows Explorer thumbnail extension for 334 file formats.

<!-- odin:about HAND-OWNED above the GENERATED marker. Edit freely; `odin codex about --ingest` carries it back into Odin's Codex. -->

## What it is

Marketing and documentation site for SageThumbs 2K, a Windows shell extension that adds File Explorer thumbnails for hundreds of file types (RAW, PSD, HEIC, video, ebooks, etc.). The site hosts feature descriptions, format support details, licensing information, and direct download links to the application.

## Things not to forget

_The intricacies worth remembering: the gotchas, the half-built parts, the decisions whose
reason lives nowhere else. Odin never overwrites this section._

- The version number baked into index.html's JSON-LD is a generated fallback for anything that does not run JavaScript (search crawlers, AI answer engines, link unfurlers, rate-limited visitors); it once sat six releases stale (1.8.2 while v2.3.0 shipped) before scripts/sync-version.mjs was written to keep it honest, so removing that automation quietly breaks SEO/AI visibility rather than the visible page. anchors: `scripts/sync-version.mjs:8`
- sync-version.mjs cross-checks the format wall's 'N categories' eyebrow text against the actual count of .fmtgroup data-cat blocks and throws (refusing to write) if they disagree, so adding or removing a format category without updating that eyebrow text breaks the version-sync job. anchors: `scripts/sync-version.mjs:56`
- The FAQ content is maintained by hand in two separate places, the FAQPage JSON-LD (9 Question/Answer entries) and the visible <details> FAQ section (also 9 entries) - editing one without the other leaves structured data and the visible page silently out of sync. anchors: `index.html:147`
- Several copy blocks (pricing section, FAQ answer, and a post-purchase confirmation banner script) already describe an unshipped 'version 3.0' feature - an installer 'Business' prompt and a Settings > Licence redemption screen - and promise that a licence key bought today stays valid until that version ships, so the copy is ahead of the current app release by design. anchors: `index.html:1611`
- llms.txt, llms-full.txt and pricing.md are served at the site root as machine-readable product/pricing summaries for AI agents and answer engines, but nothing in index.html links to them, so they are easy to forget exist or to leave stale after a copy change. anchors: `llms.txt:1`
- The theme-preference read is an inline, render-blocking script placed in <head> before any stylesheet specifically so a stored light/dark choice never flashes the other theme on load; moving or deferring it reintroduces the flash. anchors: `index.html:15`
- sync-version.mjs only needs a GITHUB_TOKEN to lift GitHub's 60-requests/hour anonymous API limit when run frequently in Actions; running it locally without one is fine since it is only an occasional manual check. anchors: `scripts/sync-version.mjs:73`

<!-- odin:about GENERATED BEGIN - rewritten by `odin codex about --publish`; edit the Codex, not this -->

## What Odin knows about this project

Everything from here down is generated from this project's Codex dossier
(`codex/projects/sagethumbs2k-github-io.md` in the Odin clone) and is **rewritten on every publish** -
edit the dossier, not this block. Everything ABOVE the marker is yours.

### At a glance

- **Ships as:** static site, deployed to GitHub Pages (https://sagethumbs.lunarwerx.com/)
- **Live at:** https://sagethumbs.lunarwerx.com/
- **Written in:** JavaScript (1 files)
- **Entry points:** `site_root`
- **CI:** `sync-version.yml`
- **Deploys via:** github-pages
- **Domain:** Windows shell extension, file thumbnails, image viewer, file format support, RAW photos, Photoshop, video preview, OCR, free software, commercial licensing
- **Remote:** https://github.com/SageThumbs2k/sagethumbs2k.github.io.git

### Architecture

- `index.html` - Single-page marketing site with hero, format coverage, feature showcase, FAQ, and licensing CTAs
- `scripts/` - Automation: sync-version.mjs keeps the version baked into index.html equal to the latest published release
- `img/` - Product screenshots and masonry wall of thumbnail examples
- `.github/` - GitHub Pages deployment config and version sync workflow

### Features

8 recorded - 8 shipped, 0 partial, 0 planned. Each `path:line` is where the feature is DEFINED, checked by `odin codex check`.

**Shipped**

- **Hero section with download CTA** - Headline and call-to-action promoting SageThumbs 2K with Download and GitHub links, plus meta about free personal use and commercial licensing - `index.html:844`
- **Format coverage visualization** - Stacked bar chart and filterable format wall showing supported image, RAW, document, video, audio, ebook and archive categories with counts - `index.html:881`
- **Features showcase with screenshots** - Card grid and wide-format cards describing key capabilities: thumbnails, Quick Look, right-click toolkit, screen OCR, MCP server, metadata stripping, 3D preview, email preview - `index.html:1308`, `index.html:1374`, `index.html:1461`
- **Licensing and pricing information** - Displays free personal license terms under PolyForm Noncommercial 1.0.0 and commercial license pricing (USD 49 per installation, one-time, perpetual with 12 months of updates, then USD 29 for another 12 months) via Connections checkout - `index.html:1594`
- **FAQ section** - Eight Q&A items covering free vs commercial licensing, safety, performance, offline capability, SmartScreen warning, Windows versions, format list, and tool replacement value - `index.html:1626`
- **Theme toggle (light/dark mode)** - User-controllable light/dark mode toggle in navbar with localStorage persistence; follows OS preference by default via light-dark() CSS - `index.html:19`
- **Version sync automation** - Background GitHub Actions workflow runs sync-version.mjs to keep the version string in index.html equal to the latest published release tag - `scripts/sync-version.mjs:71`
- **Machine-readable AI agent briefs (llms.txt / pricing.md)** - Serves llms.txt, llms-full.txt and pricing.md at the site root as structured, machine-readable product and pricing summaries for AI agents, answer engines and comparison tools; not cross-linked from index.html itself but present in every deploy - `llms.txt:1`, `pricing.md:1`

### Where to add a new one

- **new feature card in the showcase** - add a new .ecard div to the .exp-bento grid in the features section, following the existing card structure with .ehead, .ebody, .evisual, or use .ecard.wide for full-width cards anchors: `index.html:534`
- **additional format category** - add a new .fmtgroup[data-cat='...'] div in the .fmtwall section, define its --c color variable, and populate with .fc format chips anchors: `index.html:449`
- **new FAQ entry** - add a new Question/Answer pair object to the mainEntity array in the ld+json FAQ schema, and update the structured data anchors: `index.html:145`

### Gaps and wants

_Withheld: this repository is public, and the gap list is not published outside the private index._
_Read it with `python odin.py codex brief sagethumbs2k-github-io` in the Odin clone._

---

_Generated by `odin codex about --publish sagethumbs2k-github-io` on 2026-09-09 from a Codex dossier stamped 2026-09-04. Regenerate after the product moves; `odin codex about` reports drift._
<!-- odin:about GENERATED END sha=3a64b8a312fb -->
