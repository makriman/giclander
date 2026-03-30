import { promises as fs } from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://greatindiancompany.com';
const ROOT = process.cwd();
const MASTER_ROOT = path.join(ROOT, 'src', 'content', 'blog', 'en');
const TRANSLATION_ROOT = path.join(ROOT, 'content-automation', 'generated-translations');
const DIST_ROOT = path.join(ROOT, 'dist');

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function field(frontmatter, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = frontmatter.match(new RegExp(`^${escaped}:\\s*(.*)$`, 'm'));
  if (!match) {
    return null;
  }

  return match[1].replace(/^"|"$/g, '').trim();
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  return match ? match[1] : '';
}

function normalizeDate(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

async function listMasterFiles(dir) {
  try {
    const names = await fs.readdir(dir);
    return names.filter((name) => name.endsWith('.md')).map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

async function listTranslationFiles(root) {
  const out = [];
  let dirs = [];
  try {
    dirs = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      continue;
    }

    const dirPath = path.join(root, dir.name);
    let names = [];
    try {
      names = await fs.readdir(dirPath);
    } catch {
      continue;
    }

    for (const name of names) {
      if (name.endsWith('.md')) {
        out.push(path.join(dirPath, name));
      }
    }
  }

  return out;
}

function buildUrlset(urlEntries) {
  const nodes = urlEntries
    .map(
      (entry) => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${nodes}
</urlset>
`;
}

function buildSitemapIndex(sitemapLoc) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${xmlEscape(sitemapLoc)}</loc>
    <lastmod>${xmlEscape(now)}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

async function main() {
  const masterFiles = await listMasterFiles(MASTER_ROOT);
  const translationFiles = await listTranslationFiles(TRANSLATION_ROOT);
  const pages = [
    { loc: `${SITE_URL}/`, lastmod: new Date().toISOString().slice(0, 10) },
    { loc: `${SITE_URL}/blog`, lastmod: new Date().toISOString().slice(0, 10) },
  ];

  for (const filePath of masterFiles) {
    const raw = await fs.readFile(filePath, 'utf8');
    const frontmatter = parseFrontmatter(raw);
    const slug = field(frontmatter, 'slug');
    if (!slug) {
      continue;
    }

    const updatedDate = normalizeDate(field(frontmatter, 'updatedDate') || field(frontmatter, 'publishDate'));
    pages.push({
      loc: `${SITE_URL}/blog/${slug}`,
      lastmod: updatedDate,
    });
  }

  for (const filePath of translationFiles) {
    const raw = await fs.readFile(filePath, 'utf8');
    const frontmatter = parseFrontmatter(raw);
    const slug = field(frontmatter, 'slug');
    if (!slug) {
      continue;
    }

    const updatedDate = normalizeDate(field(frontmatter, 'updatedDate') || field(frontmatter, 'publishDate'));
    pages.push({
      loc: `${SITE_URL}/blog/${slug}`,
      lastmod: updatedDate,
    });
  }

  await fs.mkdir(DIST_ROOT, { recursive: true });

  const sitemapPath = path.join(DIST_ROOT, 'sitemap-0.xml');
  const indexPath = path.join(DIST_ROOT, 'sitemap-index.xml');

  await fs.writeFile(sitemapPath, buildUrlset(pages), 'utf8');
  await fs.writeFile(indexPath, buildSitemapIndex(`${SITE_URL}/sitemap-0.xml`), 'utf8');

  console.log(`Sitemap generated: ${pages.length} URLs`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
