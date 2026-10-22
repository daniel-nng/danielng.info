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
| `npm run logs` | Traffic report from prod's CloudFront logs (`-- --days 7` for a week, `-- --raw` for every request, `-- --errors` for browser errors, `-- --visits` for each visit's path, `-- --csv` for raw analytics rows). Needs `aws login`. |

The first time, run `npx playwright install chromium`. Set `BASE_URL=https://dev.danielng.info` to point the tests at a deployed site.

## Analytics
`src/components/Analytics.astro` sends cookieless page-view beacons (`HEAD /_p?...`) that land in the CloudFront logs; `npm run logs` turns them into a Visitors report. It sets no cookies and skips browsers with Global Privacy Control or Do Not Track on; see `/privacy.html`.

The LinkedIn and Instagram apps usually strip the referrer, so tag the links you post:

```
https://danielng.info/?utm_source=linkedin&utm_campaign=<post-name>
https://danielng.info/?utm_source=instagram&utm_campaign=bio
https://danielng.info/?utm_source=substack&utm_campaign=<post-name>
```

For your own queries: `npm run logs -- --days 30 --csv > visits.csv`, then e.g. `duckdb -c "select src, count(distinct visit) from 'visits.csv' group by 1 order by 2 desc"`.

## Deploys
1. Feature branch → PR into `development`. CI runs the build and the tests.
2. Merge → deploys to https://dev.danielng.info and runs the smoke tests there. QA happens here.
3. PR `development` → `main` → merge → deploys to https://danielng.info after approval.
