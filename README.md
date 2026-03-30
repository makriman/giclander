# Great Indian Company Landing Page (Astro)

Pixel-faithful rebuild of [greatindiancompany.com](https://greatindiancompany.com) as a static Astro site.

The hero background video includes the brand/logo animation and the page uses minimal JavaScript (vanilla, inline) for load and entry effects.

## Stack

- Astro (static output)
- Plain global CSS (no Tailwind, no CSS modules)
- Vanilla JS (inline boot/animation sequence)
- Google Fonts (`Montserrat` 600 normal + italic)
- Inline SVG sprite icons

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

## Project Structure

```text
.
├── astro.config.mjs
├── package.json
├── public/
│   ├── favicon.png
│   └── assets/
│       └── videos/
│           └── bg.mp4
└── src/
    ├── layouts/
    │   └── Layout.astro
    ├── pages/
    │   └── index.astro
    └── styles/
        └── global.css
```

## Content + Branding Notes

- Background video: `public/assets/videos/bg.mp4`
- Favicon: `public/favicon.png`
- Main headline + social links: `src/pages/index.astro`
- Global styling/responsive behavior: `src/styles/global.css`

## SEO + Metadata

Head tags are defined in `src/layouts/Layout.astro` and include:

- Page title + description
- Open Graph essentials
- Twitter card metadata
- Canonical URL + favicon tags

## Deploy

This project is static and can be deployed to any static host:

- Cloudflare Pages
- Netlify
- Vercel (static output)
- GitHub Pages (with Astro static build)

Use `npm run build` and publish the `dist/` directory.
