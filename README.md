# Great Indian Company (Astro)

Pixel-faithful rebuild of [greatindiancompany.com](https://greatindiancompany.com) as a static Astro site.

The hero background video includes the brand/logo animation and the page uses minimal JavaScript (vanilla, inline) for load and entry effects.

## Stack

- Astro (static output)
- Plain global CSS (no Tailwind, no CSS modules)
- Vanilla JS (inline boot/animation sequence)
- Google Fonts (`Montserrat` 600 normal + italic)
- Inline SVG sprite icons
- Markdown content collection for blog masters
- Programmatic content generation scripts

## Quick Start

```bash
npm install
npm run dev
```

Open your local URL shown by Astro (usually `http://localhost:4321`).

## Build For Production

```bash
npm run build
npm run preview
```

Build output is generated as static files in `dist/`.

The build also generates:

- `dist/sitemap-index.xml`
- `dist/sitemap-0.xml`

## Project Structure

```text
.
├── astro.config.mjs
├── content-automation/
│   ├── config/
│   ├── generated-translations/   # 22-language corpus (not loaded by Astro collection)
│   ├── scripts/
│   └── state/
├── package.json
├── public/
│   ├── favicon.png
│   └── assets/
│       └── videos/
│           └── bg.mp4
├── scripts/
│   └── generate-sitemap.mjs
└── src/
    ├── content/
    │   └── blog/
    │       └── en/               # English master articles rendered on /blog
    ├── content.config.ts
    ├── layouts/
    │   ├── BlogLayout.astro
    │   └── Layout.astro
    ├── pages/
    │   ├── blog/
    │   │   ├── [slug].astro
    │   │   └── index.astro
    │   └── index.astro
    └── styles/
        └── global.css
```

## Content + Branding Notes

- Background video: `public/assets/videos/bg.mp4`
- Favicon: `public/favicon.png`
- Main headline + social links: `src/pages/index.astro`
- Global styling/responsive behavior: `src/styles/global.css`

## Blog System

- English blog index: `/blog`
- Article route (all languages): `/blog/<slug>`
- Current published master count target: `800`
- Translation corpus: `17,600` markdown files across `22` Indian languages
- Translation files are stored under `content-automation/generated-translations/*` and rendered as live static routes during build.

### Generation Commands

```bash
npm run content:run
npm run content:expand:800
```

## SEO + Metadata

Head tags are defined in `src/layouts/Layout.astro` and include:

- Page title + description
- Open Graph essentials
- Twitter card metadata
- Canonical URL + favicon tags

Sitemap link is exposed at `/sitemap-index.xml`.

## Deploy

This project is static and can be deployed to any static host:

- Cloudflare Pages
- Netlify
- Vercel (static output)
- GitHub Pages (with Astro static build)

Use `npm run build` and publish the `dist/` directory.
