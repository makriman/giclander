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
      href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;1,600&family=Newsreader:opsz,wght@6..72,600;6..72,700;6..72,800&display=swap"
    />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --paper: #f6f2e7;
        --paper-strong: #efe8d7;
        --ink: #1d1914;
        --ink-soft: #5b5146;
        --line: #d9ccb2;
        --brand: #99561a;
        --brand-strong: #72390b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: 'Montserrat', sans-serif;
        background:
          radial-gradient(1000px 340px at 50% -5%, #f3d9b2 0%, #f8f4ea 52%, transparent 100%),
          linear-gradient(180deg, #f7f3e8 0%, #f6f2e7 42%, #f4efdf 100%);
        color: var(--ink);
        line-height: 1.68;
      }
      a { color: var(--brand); text-decoration: none; }
      a:hover { color: var(--brand-strong); }
      .shell { width: min(1120px, 94vw); margin: 0 auto; padding: 2rem 0 3.5rem; }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.8rem 0 1.2rem;
        margin-bottom: 1.4rem;
        border-bottom: 1px solid var(--line);
        gap: 1rem;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.8rem;
        color: inherit;
      }
      .brand:hover { color: inherit; }
      .brand-badge {
        border: 1px solid var(--line);
        background: #fffdf7;
        border-radius: 0.75rem;
        width: 2.4rem;
        height: 2.4rem;
        display: grid;
        place-items: center;
        font-family: 'Newsreader', serif;
        font-weight: 800;
        font-size: 1rem;
        color: var(--brand-strong);
      }
      .brand-copy { display: grid; gap: 0.05rem; }
      .brand-title {
        font-family: 'Newsreader', serif;
        font-size: 1.24rem;
        letter-spacing: 0.01em;
        line-height: 1;
      }
      .brand-sub {
        font-size: 0.72rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }
      .topbar nav {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }
      .nav-link {
        border: 1px solid var(--line);
        background: rgba(255, 251, 241, 0.88);
        color: var(--ink-soft);
        border-radius: 999px;
        padding: 0.46rem 0.85rem;
        font-size: 0.79rem;
        font-weight: 600;
      }
      .nav-link:hover {
        background: #fff;
        border-color: #c9b38f;
        color: var(--ink);
      }
      .card {
        background: linear-gradient(180deg, #fffaf0 0%, #fdf8ee 100%);
        border: 1px solid var(--line);
        border-radius: 1.2rem;
        padding: 1.35rem;
        box-shadow:
          0 24px 55px -40px rgba(95, 62, 21, 0.3),
          0 10px 24px -24px rgba(95, 62, 21, 0.24);
      }
      h1, h2, h3 { font-family: 'Newsreader', serif; line-height: 1.2; }
      h1 { margin: 0 0 0.5rem; font-size: clamp(1.75rem, 3vw, 3rem); }
      .eyebrow {
        margin: 0 0 0.45rem;
        text-transform: uppercase;
        letter-spacing: 0.13em;
        font-size: 0.72rem;
        color: #8f6f4f;
        font-weight: 700;
      }
      .meta { color: var(--ink-soft); margin-top: 0; }
      .lead { margin: 0; max-width: 70ch; }
      .meta-pills,
      .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
      .tag {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.2rem 0.7rem;
        font-size: 0.75rem;
        color: var(--ink-soft);
        background: #fff;
      }
      .pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.2rem 0.7rem;
        font-size: 0.74rem;
        color: var(--ink-soft);
        background: #fff;
      }
      .divider { margin: 1.25rem 0 0.3rem; border-top: 1px solid #dbc8ad; }
      .post-body { margin-top: 1.5rem; }
      .post-body p, .post-body li { color: var(--ink); }
      .post-body p { margin: 0.75rem 0; }
      .post-body h2, .post-body h3 { margin-top: 1.75rem; margin-bottom: 0.55rem; }
      .post-body h2 { font-size: 1.5rem; }
      .post-body h3 { font-size: 1.21rem; }
      .post-body ul, .post-body ol { padding-left: 1.25rem; margin: 0.75rem 0; }
      .post-body code {
        background: #f4ead9;
        border: 1px solid #ddc6a2;
        border-radius: 4px;
        padding: 0.1rem 0.35rem;
      }
      .sources { margin-top: 1.75rem; }
      .sources h2 { margin: 0 0 0.65rem; font-size: 1.45rem; }
      .source-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.65rem;
      }
      .source-list li a {
        display: block;
        border: 1px solid var(--line);
        border-radius: 0.85rem;
        background: #fff;
        padding: 0.68rem 0.82rem;
        font-size: 0.9rem;
        overflow-wrap: anywhere;
      }
      .source-list li a:hover { border-color: #c69a65; }
      .article-foot {
        margin-top: 1.3rem;
        border-top: 1px solid #dbc8ad;
        padding-top: 0.9rem;
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        border: 1px solid #c8a371;
        border-radius: 999px;
        background: #fff;
        padding: 0.45rem 0.78rem;
        font-size: 0.82rem;
        font-weight: 700;
        color: #7e4310;
      }
      .back-link:hover { background: #fff3e3; }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <a class="brand" href="/blog">
          <span class="brand-badge">G</span>
          <span class="brand-copy">
            <span class="brand-title">Great Indian Company</span>
            <span class="brand-sub">Research Desk</span>
          </span>
        </a>
        <nav>
          <a class="nav-link" href="/">Home</a>
          <a class="nav-link" href="/blog">All Briefs</a>
          <a class="nav-link" href="/sitemap-index.xml">Sitemap</a>
        </nav>
      </header>
      <article class="card">
        <p class="eyebrow">Localized Brief</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta lead">${escapeHtml(description)}</p>
        <div class="meta-pills">
          <span class="pill">Published: ${escapeHtml(publishDate)}</span>
          <span class="pill">Language: ${escapeHtml(lang)}</span>
          <span class="pill">Master: ${escapeHtml(translationOf)}</span>
        </div>
        <div class="tags">${tagsHtml}</div>
        <div class="divider"></div>
        <div class="post-body">
          ${bodyHtml}
        </div>
        <section class="sources">
          <h2>Primary Sources</h2>
          <ul class="source-list">
          ${sourcesHtml}
          </ul>
        </section>
        <div class="article-foot">
          <a class="back-link" href="/blog">Browse all briefs</a>
        </div>
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
