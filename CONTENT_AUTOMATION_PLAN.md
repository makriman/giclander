# CONTENT_AUTOMATION_PLAN.md

## 1) Objective

Build a deterministic, automated content engine that:

1. Scans existing blog content in GitHub to understand what already exists.
2. Creates exactly **100 new master (English) articles** per run.
3. Creates exactly **22 language versions** for each new master article.
4. Publishes content as `.md` files in this repository.

### Run Output Contract (Hard Requirement)

Each successful run must output:

- `100` new English master articles
- `2,200` translated articles (`100 x 22`)
- `2,300` total new `.md` files. SPAWM 2300 AGENTS for this  

If these counts are not met, the run is considered failed and must not partially publish.

---

## 2) Scope and Principles

### In Scope

- Programmatic content generation from thesis-aligned sources (RBI + Government of India first).
- Markdown-based publishing pipeline.
- GitHub scan + dedupe + coverage mapping.
- Multilingual generation for 22 official Indian languages.
- Daily scheduled run by cron (default).

### in Scope

- Direct copying of third-party blog text.
- Publishing without source attribution.

### Content Principle

- Content is original synthesis with citations to primary sources.
- Every article must include source links.

---

## 3) Repository Layout (Planned)

```text
/
├── CONTENT_AUTOMATION_PLAN.md
├── content-automation/
│   ├── config/
│   │   ├── languages.json
│   │   ├── source_registry.json
│   │   └── thesis_topics.json
│   ├── state/
│   │   ├── content-index.json
│   │   ├── coverage-map.json
│   │   └── last-run-manifest.json
│   ├── logs/
│   └── scripts/
│       ├── run-content-pipeline.mjs
│       ├── scan-existing-content.mjs
│       ├── generate-masters.mjs
│       ├── generate-translations.mjs
│       └── validate-run.mjs
└── src/
    └── content/
        └── blog/
            ├── en/
            ├── as/
            ├── bn/
            ├── brx/
            ├── doi/
            ├── gu/
            ├── hi/
            ├── kn/
            ├── kok/
            ├── ks/
            ├── mai/
            ├── ml/
            ├── mni/
            ├── mr/
            ├── ne/
            ├── or/
            ├── pa/
            ├── sa/
            ├── sat/
            ├── sd/
            ├── ta/
            ├── te/
            └── ur/
```

Notes:

- `src/content/blog/en/` holds master articles.
- Each language folder contains translated variants of those masters.
- Path naming is deterministic for traceability.

---

## 4) Run Architecture

## 4.1 Trigger

- Default cadence: once daily (cron).
- Optional manual trigger for backfill or failed rerun.

## 4.2 Single-Run Lifecycle

1. Load config and previous state.
2. Phase 1: Scan GitHub content and build current blog index.
3. Phase 2: Generate and accept exactly 100 new master articles.
4. Phase 3: Generate 22 language versions per accepted master.
5. Validate all files + counts + schema.
6. Publish atomically (all-or-nothing).
7. Emit run manifest.

---

## 5) Phase 1: Scan Existing Blogs from GitHub

Goal: Understand existing content inventory and avoid duplicates.

## 5.1 Discovery

1. Pull `main` branch tree from GitHub.
2. Enumerate all `*.md` and `*.mdx` files in known content paths.
3. Parse frontmatter + markdown body.

## 5.2 Extracted Fields

For each discovered article:

- `path`
- `slug`
- `lang`
- `canonicalId` (or derived)
- `title`
- `description`
- `publishDate`
- `updatedDate`
- `tags`
- `sourceLinks[]`

## 5.3 Fingerprinting and Deduplication Signals

Compute and store:

- `titleHash` (normalized title hash)
- `semanticHash` (embedding/simhash representation)
- `sourceHash` (sorted source-link hash)
- `topicCluster` (assigned cluster)
- `status` (`active`, `draft`, `archived`)

## 5.4 Coverage Map

Build `coverage-map.json` that classifies:

- Saturated topics (high article density)
- Under-covered opportunities (high-interest, low coverage)
- Freshness gaps (topics with stale updates)

---

## 6) Phase 2: Generate Exactly 100 New Master Articles

Goal: Produce 100 accepted English masters each run.

## 6.1 Topic Candidate Pool

Candidate topics come from:

1. RBI reports/notifications/bulletins.
2. Government of India ministry reports and releases.
3. Thesis topic bank (`thesis_topics.json`).
4. Coverage gap candidates from Phase 1.

## 6.2 Topic Scoring Model

Score each candidate with weighted factors:

- `freshnessScore`
- `searchIntentScore`
- `sourceAuthorityScore`
- `coverageGapScore`
- `duplicationRiskPenalty`

Select top-ranked candidates for generation.

## 6.3 Generation Strategy

- Generate an initial batch larger than target (example: 140 candidates).
- Run quality gates and reject failures.
- Regenerate until exactly 100 pass.

## 6.4 Master Article Frontmatter (Required)

Each English master must include:

- `id`
- `lang: en`
- `translationOf: null`
- `title`
- `description`
- `slug`
- `publishDate`
- `updatedDate`
- `tags[]`
- `sourceLinks[]`
- `summaryType` (for example: `report-summary`, `policy-explainer`)
- `draft: false`

## 6.5 Quality Gates for Acceptance

Article is accepted only if all pass:

1. Schema valid frontmatter.
2. Source links present and reachable format.
3. Duplicate check below threshold vs existing + in-run generated set.
4. Originality threshold pass.
5. Factual consistency check against cited source excerpts.
6. Length and structure requirements pass.

If fail: reject + regenerate candidate.

---

## 7) Phase 3: Generate 22 Language Versions per Master

Goal: For each accepted master, create 22 localized versions.

## 7.1 Required Language Set

Use the 22 official Indian languages:

1. Assamese (`as`)
2. Bengali (`bn`)
3. Bodo (`brx`)
4. Dogri (`doi`)
5. Gujarati (`gu`)
6. Hindi (`hi`)
7. Kannada (`kn`)
8. Konkani (`kok`)
9. Kashmiri (`ks`)
10. Maithili (`mai`)
11. Malayalam (`ml`)
12. Manipuri/Meitei (`mni`)
13. Marathi (`mr`)
14. Nepali (`ne`)
15. Odia (`or`)
16. Punjabi (`pa`)
17. Sanskrit (`sa`)
18. Santali (`sat`)
19. Sindhi (`sd`)
20. Tamil (`ta`)
21. Telugu (`te`)
22. Urdu (`ur`)

English remains the master generation language.

## 7.2 Translation Rules

For each language version:

1. Preserve factual meaning of master article.
2. Localize phrasing naturally (not literal robotic translation).
3. Keep source links intact.
4. Include `translationOf` pointing to English `id`.
5. Use language-specific slug.

## 7.3 Translation Validation

Each translated article must pass:

- Frontmatter schema validity.
- Correct `lang` and `translationOf`.
- No missing sections.
- No invalid script encoding.
- Language-quality threshold (fluency/consistency checks).

If any variant fails, regenerate only failed variants until all 22 pass.

---

## 8) Markdown Output Specification

## 8.1 File Naming

Master article path:

`src/content/blog/en/<publishDate>-<slug>.md`

Translation path:

`src/content/blog/<lang>/<publishDate>-<slug>-<id>.md`

## 8.2 Canonical and Cross-Language Linkage

Every markdown file includes frontmatter references:

- `id`
- `lang`
- `translationOf`

This enables Astro rendering of alternate language links and hreflang sets.

## 8.3 Example Master Frontmatter

```yaml
---
id: "gic-2026-03-30-rbi-liquidity-001"
lang: "en"
translationOf: null
title: "RBI Liquidity Update: What Changed and Why It Matters"
description: "A plain-language summary of RBI liquidity actions and implications."
slug: "rbi-liquidity-update-what-changed"
publishDate: "2026-03-30"
updatedDate: "2026-03-30"
tags: ["rbi", "liquidity", "india-economy"]
sourceLinks:
  - "https://www.rbi.org.in/..."
summaryType: "report-summary"
draft: false
---
```

## 8.4 Example Translation Frontmatter

```yaml
---
id: "gic-2026-03-30-rbi-liquidity-001-hi"
lang: "hi"
translationOf: "gic-2026-03-30-rbi-liquidity-001"
title: "आरबीआई तरलता अपडेट: क्या बदला और इसका मतलब क्या है"
description: "आरबीआई की हालिया तरलता कार्रवाइयों का सरल सारांश।"
slug: "rbi-liquidity-update-kya-badla"
publishDate: "2026-03-30"
updatedDate: "2026-03-30"
tags: ["rbi", "liquidity", "india-economy"]
sourceLinks:
  - "https://www.rbi.org.in/..."
summaryType: "report-summary"
draft: false
---
```

---

## 9) Run Manifest Specification

At the end of each run, write:

`content-automation/state/last-run-manifest.json`

Required fields:

- `runId`
- `startedAt`
- `endedAt`
- `mastersRequested` (always 100)
- `mastersPublished`
- `translationsPerMaster` (always 22)
- `translationsPublished`
- `failedItems[]`
- `retryCounts`
- `sourceUrlsUsed[]`
- `generatedSlugs[]`

A run is successful only if:

- `mastersPublished === 100`
- `translationsPublished === 2200`
- `schemaInvalidCount === 0`

---

## 10) Retry, Failure, and Atomic Publish Rules

## 10.1 Retry Policy

- Master generation retries per failed candidate: configurable (default `3`).
- Translation retries per language per article: configurable (default `3`).
- Dedup/quality failures trigger regeneration.

## 10.2 Hard Failure Conditions

Fail whole run if:

1. Cannot reach 100 accepted masters after max retries.
2. Any master lacks full 22 validated translations.
3. Any schema-invalid file remains.
4. Manifest counts mismatch.

## 10.3 Atomic Publish

1. Write generated files to staging area first.
2. Run all validations.
3. Move to final content paths only after full pass.
4. If failed, discard staging changes; do not publish partial output.

---

## 11) CI/CD and Cron Execution

## 11.1 Scheduler

- Use GitHub Actions scheduled workflow (`cron`) once daily by default.
- Support manual `workflow_dispatch`.

## 11.2 Pipeline Steps

1. Checkout repository.
2. Install dependencies.
3. Execute content pipeline script.
4. Run validations and Astro build check.
5. Create commit/PR only if run passes full contract.

## 11.3 Commit Policy

- One commit per successful run containing all generated `.md` files + manifest update.
- No commit if run fails.

---

## 12) Test Plan (Implementation Acceptance)

## 12.1 Scan Tests

- Detect all blog `.md`/`.mdx` files in configured paths.
- Parse frontmatter/body without schema loss.

## 12.2 Dedup Tests

- Reject new masters above duplicate similarity threshold vs existing index.
- Reject in-run collisions.

## 12.3 Count Contract Tests

- Confirm exactly 100 accepted masters.
- Confirm exactly 22 translations per master.
- Confirm total exactly 2,300 generated markdown files per successful run.

## 12.4 Integrity Tests

- Every translated article has valid `translationOf` master id.
- Every master has complete translation set.

## 12.5 Citation Tests

- Every article includes at least one valid source link.
- Source links follow approved-domain policy for thesis categories.

## 12.6 Build Tests

- Astro content loading passes for all generated markdown.
- `astro build` succeeds after generation.

## 12.7 Acceptance Criteria (Hard Gate)

Run is accepted only when all below are true:

1. `mastersPublished = 100`
2. `translationsPublished = 2200`
3. `totalNewMarkdownFiles = 2300`
4. `schemaInvalidCount = 0`
5. All tests pass

---

## 13) Operational Metrics

Track per run:

- generation pass rate
- dedupe rejection rate
- translation regeneration rate
- source utilization distribution
- build pass/fail
- runtime duration

Track weekly:

- indexed pages
- impressions/click growth
- non-branded query count
- top topic-cluster performance

---

## 14) Assumptions and Defaults

1. 22-language output refers to the 22 official Indian languages listed above.
2. English is the master language for generation.
3. Content strategy uses original synthesis + source citation only.
4. Source priority starts with RBI and Government of India publications.
5. Default run cadence is daily via cron.
6. No partial publish is permitted.

---

## 15) Implementation Checklist (Engineer-Ready)

1. Create folder structure under `content-automation/` and `src/content/blog/`.
2. Implement GitHub scan script and content index writer.
3. Implement topic scoring and master generation engine.
4. Implement translation engine for the 22-language set.
5. Implement validators (schema, dedupe, integrity, citation, count contract).
6. Implement staging + atomic publish flow.
7. Implement run manifest output.
8. Add GitHub Actions daily cron workflow.
9. Add build/test gates.
10. Dry-run in test mode, then enable production run.

This checklist is complete and decision-ready for implementation.
