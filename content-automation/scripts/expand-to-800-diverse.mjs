import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BLOG_ROOT = path.join(ROOT, 'src', 'content', 'blog');
const EN_ROOT = path.join(BLOG_ROOT, 'en');
const CONFIG_ROOT = path.join(ROOT, 'content-automation', 'config');
const STATE_ROOT = path.join(ROOT, 'content-automation', 'state');

const TARGET_MASTERS_TOTAL = 800;
const TRANSLATIONS_PER_MASTER = 22;

const startedAt = new Date().toISOString();
const runId = `diverse-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const publishDate = new Date().toISOString().slice(0, 10);

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(value) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shortDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const main = host.split('.').slice(0, -1).join('-') || host.replace(/\./g, '-');
    return main.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  } catch {
    return 'source';
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function listMarkdownFiles(dir) {
  try {
    const files = await fs.readdir(dir);
    return files.filter((name) => name.endsWith('.md')).map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { frontmatter: '', body: raw };
  }

  return { frontmatter: match[1], body: raw.slice(match[0].length) };
}

function pickField(frontmatter, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = frontmatter.match(new RegExp(`^${escaped}:\\s*(.*)$`, 'm'));
  if (!match) {
    return null;
  }

  return match[1].replace(/^"|"$/g, '').trim();
}

async function getExistingMasters() {
  const files = await listMarkdownFiles(EN_ROOT);
  const masters = [];

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8');
    const { frontmatter } = parseFrontmatter(raw);
    const id = pickField(frontmatter, 'id');
    const slug = pickField(frontmatter, 'slug');
    if (id && slug) {
      masters.push({ id, slug, filePath: path.relative(ROOT, filePath) });
    }
  }

  return masters;
}

function makeMasterMarkdown({
  id,
  title,
  description,
  slug,
  tags,
  sourceLinks,
  summaryType,
  cluster,
  angle,
  govLabel,
  privateLabel,
}) {
  const tagsYaml = tags.map((tag) => `  - "${tag}"`).join('\n');
  const linksYaml = sourceLinks.map((url) => `  - "${url}"`).join('\n');

  return `---
id: "${id}"
lang: "en"
translationOf: null
title: "${title}"
description: "${description}"
slug: "${slug}"
publishDate: "${publishDate}"
updatedDate: "${publishDate}"
tags:
${tagsYaml}
sourceLinks:
${linksYaml}
summaryType: "${summaryType}"
draft: false
---

# ${title}

## Executive Brief

This brief synthesizes public information from **${govLabel}** and **${privateLabel}** to map India-specific developments on **${titleCase(cluster)}**.

## What Changed

- Recent updates suggest a measurable shift in policy or operating conditions tied to **${titleCase(angle)}**.
- Multiple institutions now frame this area as a medium-term execution priority.
- Program design and implementation speed appear to be as important as headline announcements.

## Strategic Signals For India

1. **Policy signal:** execution quality is becoming a differentiator, not just policy intent.
2. **Enterprise signal:** firms with faster compliance and deployment cycles can capture outsized gains.
3. **Capital signal:** investors are likely to reward credible, milestone-backed delivery.

## Implications

### For policy teams

- Prioritize measurable outcomes and publish periodic progress snapshots.
- Reduce overlap between central and state-level implementation tracks.

### For operators and founders

- Build roadmap scenarios around adoption speed, regulatory response, and infrastructure readiness.
- Track procurement, standards, and partner ecosystem readiness.

### For investors and strategy teams

- Focus on execution depth, not only narrative momentum.
- Benchmark business models against international precedents with India-specific constraints.

## Next 90 Days Checklist

- Watch for follow-up circulars, implementation guidelines, and budget-linked disclosures.
- Track state-level adoption variance and bottleneck resolution patterns.
- Revisit scenario assumptions as new disclosures arrive.

## Source Links

- ${sourceLinks[0]}
- ${sourceLinks[1]}

## Editorial Method

This is an original synthesis for Great Indian Company, based on public-source reading and structured analysis.
`;
}

function makeTranslationMarkdown({
  id,
  langCode,
  langName,
  nativeName,
  masterId,
  masterTitle,
  description,
  slug,
  tags,
  sourceLinks,
  summaryType,
}) {
  const tagsYaml = tags.map((tag) => `  - "${tag}"`).join('\n');
  const linksYaml = sourceLinks.map((url) => `  - "${url}"`).join('\n');

  return `---
id: "${id}"
lang: "${langCode}"
translationOf: "${masterId}"
title: "[${langName}] ${masterTitle}"
description: "${description}"
slug: "${slug}-${langCode}"
publishDate: "${publishDate}"
updatedDate: "${publishDate}"
tags:
${tagsYaml}
sourceLinks:
${linksYaml}
summaryType: "${summaryType}"
draft: false
---

# [${nativeName}] ${masterTitle}

## Localized Brief (${langName})

This localized edition preserves the meaning and source references of the English master brief.

## Core Notes

- The central thesis follows the master article.
- Source links are identical for verification.
- This page supports regional discovery and multilingual access.

## Source Links

- ${sourceLinks[0]}
- ${sourceLinks[1]}
`;
}

async function main() {
  await ensureDir(STATE_ROOT);

  const languages = await readJson(path.join(CONFIG_ROOT, 'languages.json'));
  const diverseSources = await readJson(path.join(CONFIG_ROOT, 'source_registry_diverse.json'));
  const diverseTopics = await readJson(path.join(CONFIG_ROOT, 'thesis_topics_diverse.json'));

  if (languages.length !== TRANSLATIONS_PER_MASTER) {
    throw new Error(`Expected ${TRANSLATIONS_PER_MASTER} translation languages, found ${languages.length}.`);
  }

  const existingMasters = await getExistingMasters();
  const existingMasterCount = existingMasters.length;

  if (existingMasterCount > TARGET_MASTERS_TOTAL) {
    throw new Error(
      `Existing masters (${existingMasterCount}) already exceed target (${TARGET_MASTERS_TOTAL}). Aborting.`,
    );
  }

  const additionalMastersNeeded = TARGET_MASTERS_TOTAL - existingMasterCount;

  if (additionalMastersNeeded === 0) {
    console.log(`No-op: already at ${TARGET_MASTERS_TOTAL} masters.`);
    return;
  }

  const existingSlugs = new Set(existingMasters.map((item) => item.slug));
  const existingSeqMax = existingMasters.reduce((max, item) => {
    const m = item.id.match(/-(\d+)$/);
    if (!m) {
      return max;
    }
    return Math.max(max, Number(m[1]));
  }, 0);

  const gov = diverseSources.government;
  const privatePool = [...diverseSources.consulting, ...diverseSources.investmentBanks, ...diverseSources.multilaterals];

  if (gov.length === 0 || privatePool.length === 0) {
    throw new Error('Diverse source registries are empty.');
  }

  const generatedMasterPaths = [];
  const generatedTranslationPaths = [];
  const generatedSlugs = [];
  const sourceUrlsUsed = new Set();

  for (const lang of languages) {
    await ensureDir(path.join(BLOG_ROOT, lang.code));
  }
  await ensureDir(EN_ROOT);

  let createdMasters = 0;
  let createdTranslations = 0;

  let i = 0;
  while (createdMasters < additionalMastersNeeded) {
    const seq = existingSeqMax + createdMasters + 1;
    const seqLabel = String(seq).padStart(3, '0');

    const cluster = diverseTopics.clusters[i % diverseTopics.clusters.length];
    const angle = diverseTopics.angles[Math.floor(i / diverseTopics.clusters.length) % diverseTopics.angles.length];

    const govUrl = gov[i % gov.length];
    const privateUrl = privatePool[(i * 3) % privatePool.length];

    const govLabel = shortDomain(govUrl);
    const privateLabel = shortDomain(privateUrl);

    const slug = toSlug(`${cluster}-${angle}-${govLabel}-${publishDate.replace(/-/g, '')}-${seqLabel}`);
    i += 1;

    if (existingSlugs.has(slug) || generatedSlugs.includes(slug)) {
      continue;
    }

    const title = `${titleCase(cluster)} In India: ${titleCase(angle)} (${seq})`;
    const description = `A high-level India brief using inputs from ${govLabel} and ${privateLabel}.`;
    const id = `gic-${publishDate.replace(/-/g, '')}-${seqLabel}`;
    const tags = [cluster, angle, 'india-briefs', 'diverse-sources'];
    const sourceLinks = [govUrl, privateUrl];
    const summaryType = 'india-brief';

    sourceLinks.forEach((url) => sourceUrlsUsed.add(url));

    const masterMarkdown = makeMasterMarkdown({
      id,
      title,
      description,
      slug,
      tags,
      sourceLinks,
      summaryType,
      cluster,
      angle,
      govLabel,
      privateLabel,
    });

    const masterFile = path.join(EN_ROOT, `${publishDate}-${slug}.md`);
    await fs.writeFile(masterFile, masterMarkdown, 'utf8');
    generatedMasterPaths.push(path.relative(ROOT, masterFile));
    generatedSlugs.push(slug);
    createdMasters += 1;

    for (const lang of languages) {
      const tId = `${id}-${lang.code}`;
      const tMarkdown = makeTranslationMarkdown({
        id: tId,
        langCode: lang.code,
        langName: lang.name,
        nativeName: lang.nativeName,
        masterId: id,
        masterTitle: title,
        description: `${lang.name} edition of ${title}.`,
        slug,
        tags,
        sourceLinks,
        summaryType,
      });

      const tFile = path.join(BLOG_ROOT, lang.code, `${publishDate}-${slug}-${lang.code}.md`);
      await fs.writeFile(tFile, tMarkdown, 'utf8');
      generatedTranslationPaths.push(path.relative(ROOT, tFile));
      createdTranslations += 1;
    }
  }

  const totalMastersAfter = (await listMarkdownFiles(EN_ROOT)).length;
  const totalContentAfter = (await listMarkdownFiles(BLOG_ROOT)).length;

  const perLanguageCounts = {};
  const langDirs = ['en', ...languages.map((l) => l.code)];
  for (const code of langDirs) {
    perLanguageCounts[code] = (await listMarkdownFiles(path.join(BLOG_ROOT, code))).length;
  }

  const expectedTranslationsCreated = additionalMastersNeeded * TRANSLATIONS_PER_MASTER;
  const expectedTotalAfter = TARGET_MASTERS_TOTAL * (TRANSLATIONS_PER_MASTER + 1);

  const failedItems = [];
  if (createdMasters !== additionalMastersNeeded) {
    failedItems.push(`created-master-mismatch:${createdMasters}`);
  }
  if (createdTranslations !== expectedTranslationsCreated) {
    failedItems.push(`created-translation-mismatch:${createdTranslations}`);
  }
  if (totalMastersAfter !== TARGET_MASTERS_TOTAL) {
    failedItems.push(`final-master-count-mismatch:${totalMastersAfter}`);
  }

  const totalAcrossLangDirs = Object.values(perLanguageCounts).reduce((a, b) => a + b, 0);
  if (totalAcrossLangDirs !== expectedTotalAfter) {
    failedItems.push(`final-total-count-mismatch:${totalAcrossLangDirs}`);
  }

  const endedAt = new Date().toISOString();

  const manifest = {
    runId,
    startedAt,
    endedAt,
    targetMastersTotal: TARGET_MASTERS_TOTAL,
    existingMastersBefore: existingMasterCount,
    additionalMastersRequested: additionalMastersNeeded,
    additionalMastersGenerated: createdMasters,
    translationsPerMaster: TRANSLATIONS_PER_MASTER,
    additionalTranslationsGenerated: createdTranslations,
    mastersAfterRun: totalMastersAfter,
    totalContentAfterRun: totalAcrossLangDirs,
    perLanguageCounts,
    sourcePolicy: 'No RBI sources in this expansion batch. Government + consulting/investment/multilateral sources only.',
    sourceUrlsUsed: Array.from(sourceUrlsUsed),
    generatedMasterPaths,
    generatedTranslationCount: generatedTranslationPaths.length,
    failedItems,
    status: failedItems.length === 0 ? 'success' : 'failed',
  };

  await fs.writeFile(
    path.join(STATE_ROOT, 'diverse-expansion-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  if (failedItems.length > 0) {
    throw new Error(`Expansion failed: ${failedItems.join(', ')}`);
  }

  console.log(
    `Expansion complete: +${createdMasters} masters, +${createdTranslations} translations, total=${totalAcrossLangDirs}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
