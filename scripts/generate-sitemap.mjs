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

function pickArray(frontmatter, key) {
  const lines = frontmatter.split('\n');
  const out = [];
  let inBlock = false;

  for (const line of lines) {
    if (!inBlock) {
      if (line.startsWith(`${key}:`)) {
        inBlock = true;
      }
      continue;
    }

    if (line.startsWith('  - ')) {
      out.push(line.slice(4).trim().replace(/^"|"$/g, ''));
      continue;
    }

    if (line.trim() === '') {
      continue;
    }

    if (!line.startsWith(' ')) {
      break;
    }
  }

  return out;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  return match ? match[1] : '';
}

function splitFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { frontmatter: '', body: raw };
  }
  return {
    frontmatter: match[1],
    body: raw.slice(match[0].length),
  };
}

function normalizeDate(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  const escaped = escapeHtml(text);
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return withBold.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

function renderSimpleMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    html.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flushList();
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.*)$/);
    if (h1) {
      flushList();
      html.push(`<h1>${renderInline(h1[1])}</h1>`);
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.*)$/);
    if (h2) {
      flushList();
      html.push(`<h2>${renderInline(h2[1])}</h2>`);
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.*)$/);
    if (h3) {
      flushList();
      html.push(`<h3>${renderInline(h3[1])}</h3>`);
      continue;
    }

    const li = trimmed.match(/^- (.*)$/);
    if (li) {
      listItems.push(`<li>${renderInline(li[1])}</li>`);
      continue;
    }

    flushList();
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }

  flushList();
  return html.join('\n');
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

function renderTranslationPage({
  title,
  description,
  canonical,
  publishDate,
  lang,
  translationOf,
  tags,
  sourceLinks,
  bodyHtml,
}) {
  const tagsHtml = tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');
  const sourcesHtml = sourceLinks
    .map(
      (url) =>
        `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></li>`,
    )
    .join('');

  return `<!doctype html>
<html lang="${escapeHtml(lang)}" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta property="og:site_name" content="Great Indian Company" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:type" content="article" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,500;0,600;1,600&display=swap"
    />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #0a0a0a;
        --fg: #f4f4f4;
        --muted: #bdbdbd;
        --card: #151515;
        --line: #2d2d2d;
        --accent: #f2d08c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: 'Montserrat', sans-serif;
        background: radial-gradient(circle at top, #161616, var(--bg) 55%);
        color: var(--fg);
        line-height: 1.6;
      }
      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      .shell { width: min(980px, 92vw); margin: 0 auto; padding: 2.25rem 0 4rem; }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--line);
        padding-bottom: 1rem;
        margin-bottom: 1.5rem;
      }
      .brand { font-weight: 600; letter-spacing: 0.02em; }
      .home-link { color: var(--muted); }
      .card {
        background: linear-gradient(180deg, #1a1a1a, var(--card));
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 1.5rem;
      }
      h1, h2, h3 { line-height: 1.2; }
      h1 { margin: 0 0 0.5rem; font-size: clamp(1.5rem, 3vw, 2.3rem); }
      .meta { color: var(--muted); margin-top: 0; }
      .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
      .tag {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.15rem 0.6rem;
        font-size: 0.75rem;
        color: var(--muted);
      }
      .post-body { margin-top: 1.5rem; }
      .post-body p, .post-body li { color: #e9e9e9; }
      .post-body h2, .post-body h3 { margin-top: 1.75rem; }
      .post-body ul, .post-body ol { padding-left: 1.25rem; }
      .post-body code {
        background: #1f1f1f;
        border: 1px solid #2f2f2f;
        border-radius: 4px;
        padding: 0.1rem 0.35rem;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div class="brand">Great Indian Company</div>
        <a class="home-link" href="/">Home</a>
      </header>
      <article class="card">
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Published: ${escapeHtml(publishDate)} | Language: ${escapeHtml(lang)} | Master: ${escapeHtml(translationOf)}</p>
        <div class="tags">${tagsHtml}</div>
        <div class="post-body">
          ${bodyHtml}
        </div>
        <hr style="border:0; border-top:1px solid #2d2d2d; margin:1.75rem 0;" />
        <h2 style="margin:0 0 0.6rem; font-size:1.1rem;">Primary Sources</h2>
        <ul style="margin:0; padding-left:1.2rem;">
          ${sourcesHtml}
        </ul>
      </article>
    </main>
  </body>
</html>
`;
}

async function main() {
  const masterFiles = await listMasterFiles(MASTER_ROOT);
  const translationFiles = await listTranslationFiles(TRANSLATION_ROOT);
  const pages = [
    { loc: `${SITE_URL}/`, lastmod: new Date().toISOString().slice(0, 10) },
    { loc: `${SITE_URL}/blog`, lastmod: new Date().toISOString().slice(0, 10) },
  ];
  let translationPagesWritten = 0;

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
    const { frontmatter, body } = splitFrontmatter(raw);
    const slug = field(frontmatter, 'slug');
    if (!slug) {
      continue;
    }

    const updatedDate = normalizeDate(field(frontmatter, 'updatedDate') || field(frontmatter, 'publishDate'));
    pages.push({
      loc: `${SITE_URL}/blog/${slug}`,
      lastmod: updatedDate,
    });

    const title = field(frontmatter, 'title') || slug;
    const description = field(frontmatter, 'description') || '';
    const publishDate = normalizeDate(field(frontmatter, 'publishDate') || updatedDate);
    const lang = field(frontmatter, 'lang') || 'unknown';
    const translationOf = field(frontmatter, 'translationOf') || '';
    const tags = pickArray(frontmatter, 'tags');
    const sourceLinks = pickArray(frontmatter, 'sourceLinks');

    const pagePath = path.join(DIST_ROOT, 'blog', slug, 'index.html');
    await fs.mkdir(path.dirname(pagePath), { recursive: true });
    await fs.writeFile(
      pagePath,
      renderTranslationPage({
        title,
        description,
        canonical: `${SITE_URL}/blog/${slug}`,
        publishDate,
        lang,
        translationOf,
        tags,
        sourceLinks,
        bodyHtml: renderSimpleMarkdown(body),
      }),
      'utf8',
    );
    translationPagesWritten += 1;
  }

  await fs.mkdir(DIST_ROOT, { recursive: true });

  const sitemapPath = path.join(DIST_ROOT, 'sitemap-0.xml');
  const indexPath = path.join(DIST_ROOT, 'sitemap-index.xml');

  await fs.writeFile(sitemapPath, buildUrlset(pages), 'utf8');
  await fs.writeFile(indexPath, buildSitemapIndex(`${SITE_URL}/sitemap-0.xml`), 'utf8');

  console.log(`Sitemap generated: ${pages.length} URLs | translation pages written: ${translationPagesWritten}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
