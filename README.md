# __ danielng.info __
The code for my personal site, built with [Astro](https://astro.build) as static HTML and hosted on S3 + CloudFront.

## Layout
- `src/layouts/BaseLayout.astro`: shared `<head>`, nav overlay and scripts
- `src/components/`: favicons and the nav overlay
- `src/pages/`: one `.astro` file per page (`i-am.astro` builds `i-am.html`)
- `public/`: CSS, JS, images and other files copied to the site unchanged

## Commands
| Command | What it does |
|---|---|
| `npm ci` | Install dependencies |
| `npm run dev` | Local dev server with live reload at http://localhost:4321 |
| `npm run build` | Build the site into `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm test` | Smoke tests (pages, nav overlay, assets, JS errors) |
| `npm run test:links` | Check internal links in `dist/` |
| `npm run test:visual` | Screenshot `BASELINE_URL` (default https://danielng.info) and compare the local build against it |
| `npm run test:all` | All of the above |

The first time, run `npx playwright install chromium`. Set `BASE_URL=https://dev.danielng.info` to point the tests at a deployed site.

## Deploys
1. Feature branch → PR into `development`. CI runs the build and the tests.
2. Merge → deploys to https://dev.danielng.info and runs the smoke tests there. QA happens here.
3. PR `development` → `main` → merge → deploys to https://danielng.info after approval.
