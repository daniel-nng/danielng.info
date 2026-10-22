// Traffic report from the prod CloudFront access logs in s3://logs.danielng.info/logs/.
//
//   npm run logs                 last 1 day (UTC)
//   npm run logs -- --days 7     last 7 days
//   npm run logs -- --raw        print every request (date, time, status, page, referrer) instead
//   npm run logs -- --errors     print every browser error reported by src/components/ErrorReporter.astro
//   npm run logs -- --visits     print each visit's path, from src/components/Analytics.astro beacons
//   npm run logs -- --csv        write every beacon as CSV (for DuckDB/SQL); IPs are replaced by a visit hash
//
// Needs the AWS CLI signed in (`aws login`). Log files are cached in .cf-logs/ so
// re-running only downloads new ones.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 's3://logs.danielng.info/logs/';
const DISTRIBUTION = 'E1T6OVVYEAFGQ7'; // prod: danielng.info
const CACHE = '.cf-logs';

const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 1;
const raw = args.includes('--raw');
const errorsOnly = args.includes('--errors');
const visitsOnly = args.includes('--visits');
const csv = args.includes('--csv');

// One --include per UTC day; log files are named <distribution>.<YYYY-MM-DD-HH>.<id>.gz
const dates = Array.from({ length: days + 1 }, (_, i) =>
  new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
const since = new Date(Date.now() - days * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);

mkdirSync(CACHE, { recursive: true });
console.error(`Syncing ${days} day(s) of logs into ${CACHE}/ ...`);
execFileSync('aws', ['s3', 'sync', BUCKET, CACHE, '--only-show-errors', '--exclude', '*',
  ...dates.flatMap((d) => ['--include', `${DISTRIBUTION}.${d}-*`])], { stdio: 'inherit' });

// Fields: date time x-edge-location sc-bytes c-ip cs-method cs(Host) cs-uri-stem sc-status cs(Referer) cs(User-Agent) ...
const rows = readdirSync(CACHE)
  .filter((f) => f.startsWith(`${DISTRIBUTION}.`) && dates.some((d) => f.includes(`.${d}-`)))
  .flatMap((f) => gunzipSync(readFileSync(join(CACHE, f))).toString().split('\n'))
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split('\t'))
  .map(([date, time, , , ip, , , page, status, referrer, ua, query]) =>
    ({ when: `${date} ${time}`, ip, page, status, referrer, ua: decode(ua ?? ''), query }))
  .filter((r) => r.when >= since)
  .sort((a, b) => a.when.localeCompare(b.when));

if (!rows.length) {
  console.log(`No requests logged since ${since} UTC.`);
  process.exit(0);
}

// Browser error reports: HEAD /_e?m=<message>&s=<script>&l=<line:col>&p=<page>&t=<stack>
const isError = (r) => r.page === '/_e';
const errorReport = (r) => {
  const q = new URLSearchParams(decodeOnce(r.query ?? ''));
  return { when: r.when, page: q.get('p'), message: q.get('m'), at: `${q.get('s')}:${q.get('l')}`, stack: q.get('t'), ua: r.ua };
};

if (errorsOnly) {
  const errors = rows.filter(isError).map(errorReport);
  if (!errors.length) console.log(`No browser errors reported since ${since} UTC.`);
  for (const e of errors) {
    console.log(`${e.when}  ${e.page}\n  ${e.message}\n  at ${e.at}\n  ${e.ua}`);
    if (e.stack) console.log(e.stack.replace(/^/gm, '    '));
  }
  process.exit(0);
}

const BOT = /bot|crawl|spider|headless|python|curl|go-http|wget|scan|zgrab|playwright/i;

// Page analytics beacons: HEAD /_p?e=<view|leave|out>&p=<page>&... (see Analytics.astro)
const isBeacon = (r) => r.page === '/_p';
const beacons = rows.filter((r) => isBeacon(r) && !BOT.test(r.ua)).map((r) => {
  const q = Object.fromEntries(new URLSearchParams(decodeOnce(r.query ?? '')));
  return {
    ...q,
    when: r.when,
    // Groups one person's page views within a UTC day; never leaves this script.
    visit: createHash('sha256').update(`${r.ip}|${r.ua}|${r.when.slice(0, 10)}`).digest('hex').slice(0, 12),
    src: source(q, r.ua),
    device: !q.vw ? '' : q.vw < 768 ? 'mobile' : q.vw < 1024 ? 'tablet' : 'desktop',
    browser: browser(r.ua),
    os: os(r.ua),
  };
});
const views = beacons.filter((b) => b.e === 'view');

// One entry per visit: its page views in order, plus the longest time/scroll seen per page.
const byVisit = new Map();
for (const b of beacons) {
  if (!byVisit.has(b.visit)) byVisit.set(b.visit, { pages: [], leave: new Map() });
  const v = byVisit.get(b.visit);
  if (b.e === 'view' && !v.pages.length) Object.assign(v, b); // source, device, etc. from the landing view
  if (b.e === 'view') v.pages.push(b.p);
  if (b.e === 'leave') {
    const prev = v.leave.get(b.p) ?? { t: 0, sd: 0 };
    v.leave.set(b.p, { t: Math.max(prev.t, Number(b.t) || 0), sd: Math.max(prev.sd, Number(b.sd) || 0) });
  }
}
const sessions = [...byVisit.values()].filter((v) => v.pages.length);

if (visitsOnly) {
  if (!sessions.length) console.log(`No visits recorded since ${since} UTC.`);
  for (const v of sessions) {
    const last = v.leave.get(v.pages.at(-1));
    const left = last ? ` (left after ${duration(last.t)}, ${last.sd}% scrolled)` : '';
    const campaign = v.uc ? `/${v.uc}` : '';
    console.log(`${v.when}  ${v.src}${campaign} · ${v.device} · ${v.browser}/${v.os} · ${v.lang} · ${v.tz}`);
    console.log(`  ${v.pages.join(' → ')}${left}`);
  }
  process.exit(0);
}

if (csv) {
  const cols = ['when', 'visit', 'e', 'p', 'src', 'r', 'us', 'um', 'uc', 'ux', 'device', 'browser', 'os', 'sw', 'vw', 'dpr', 'lang', 'tz', 'cs', 't', 'sd', 'to'];
  const cell = (x) => (/[",\n]/.test(x) ? `"${x.replaceAll('"', '""')}"` : x);
  console.log(cols.join(','));
  for (const b of beacons) {
    // Every row carries its visit's source and device, so SQL can group leave/out rows too.
    const v = byVisit.get(b.visit), row = { ...b, src: v.src ?? b.src, device: v.device ?? b.device };
    console.log(cols.map((c) => cell(String(row[c] ?? ''))).join(','));
  }
  process.exit(0);
}

if (raw) {
  for (const r of rows) console.log([r.when, r.status, r.page, r.referrer].join('\t'));
  process.exit(0);
}

// CloudFront %-encodes the query string once more on top of the browser's encoding.
function decodeOnce(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// Where a visitor came from: a tagged link wins, then an in-app browser, then the referrer.
function source(q, ua) {
  if (q.us) return q.us.toLowerCase();
  if (/Instagram/.test(ua)) return 'instagram';
  if (/LinkedInApp/.test(ua)) return 'linkedin';
  if (/FBAN|FBAV/.test(ua)) return 'facebook';
  let host;
  try {
    host = new URL(q.r).host.replace(/^www\./, '');
  } catch {
    return 'direct'; // no referrer, or an internal path
  }
  const known = [[/linkedin\.com$|^lnkd\.in$/, 'linkedin'], [/instagram\.com$/, 'instagram'], [/substack\.com$/, 'substack'],
    [/^google\./, 'google'], [/bing\.com$/, 'bing'], [/duckduckgo\.com$/, 'duckduckgo'], [/github\.com$/, 'github'],
    [/^(t\.co|x\.com|twitter\.com)$/, 'x'], [/facebook\.com$/, 'facebook']];
  return known.find(([re]) => re.test(host))?.[1] ?? host;
}

function browser(ua) {
  const apps = [[/Instagram/, 'Instagram app'], [/LinkedInApp/, 'LinkedIn app'], [/FBAN|FBAV/, 'Facebook app'], [/Edg\//, 'Edge'],
    [/OPR\//, 'Opera'], [/SamsungBrowser/, 'Samsung'], [/CriOS|Chrome\//, 'Chrome'], [/FxiOS|Firefox\//, 'Firefox'], [/Safari\//, 'Safari']];
  return apps.find(([re]) => re.test(ua))?.[1] ?? 'other';
}

function os(ua) {
  const systems = [[/iPhone|iPad|iPod/, 'iOS'], [/Android/, 'Android'], [/CrOS/, 'ChromeOS'], [/Mac OS X/, 'macOS'], [/Windows/, 'Windows'], [/Linux/, 'Linux']];
  return systems.find(([re]) => re.test(ua))?.[1] ?? 'other';
}

function duration(s) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}`;
}

function decode(s) {
  try {
    return decodeURIComponent(decodeURIComponent(s));
  } catch {
    return s; // scanners send malformed %-escapes
  }
}

const isPage = (r) => r.page === '/' || r.page.endsWith('.html');
const visits = rows.filter((r) => isPage(r) && r.status === '200' && !BOT.test(r.ua));

const top = (list, key, n = 8) => {
  const counts = new Map();
  for (const r of list) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n);
};
const print = (title, entries) => {
  console.log(`\n${title}`);
  if (!entries.length) console.log('  (none)');
  for (const [k, n] of entries) console.log(`  ${String(n).padStart(6)}  ${k}`);
};

console.log(`danielng.info traffic, ${rows[0].when} -> ${rows.at(-1).when} UTC`);
console.log(`  requests:            ${rows.length}`);
console.log(`  page views (people): ${visits.length} from ${new Set(visits.map((r) => r.ip)).size} unique IPs`);
console.log(`  bot/scanner share:   ${Math.round((100 * rows.filter((r) => BOT.test(r.ua)).length) / rows.length)}%`);

print('Pages (people)', top(visits, (r) => r.page));
print('External referrers (people)', top(visits.filter((r) => r.referrer !== '-' && !r.referrer.includes('danielng.info')), (r) => r.referrer, 5));
print('Status codes', top(rows, (r) => r.status));
print('Most-requested missing URLs (mostly scanners)', top(rows.filter((r) => !isError(r) && !isBeacon(r) && (r.status === '404' || r.status === '403')), (r) => r.page));
print('Browser errors (details: npm run logs -- --errors)', top(rows.filter(isError).map(errorReport), (e) => `${e.page}  ${e.message}`, 5));

// Visitors: only browsers that ran Analytics.astro, so scanners and most crawlers drop out.
const avg = (list, key) => {
  const sums = new Map();
  for (const x of list) {
    const [n, total] = sums.get(x.p) ?? [0, 0];
    sums.set(x.p, [n + 1, total + key(x)]);
  }
  return [...sums].map(([p, [n, total]]) => [p, Math.round(total / n)]).sort((a, b) => b[1] - a[1]);
};
const leaves = sessions.flatMap((v) => [...v.leave].map(([p, l]) => ({ p, ...l })));

console.log(`\n== Visitors (page beacons; details: --visits, raw data: --csv)`);
console.log(`  visits:     ${sessions.length}`);
console.log(`  page views: ${views.length}`);
print('Sources', top(sessions, (v) => v.src));
print('Campaigns', top(sessions.filter((v) => v.uc), (v) => `${v.src}/${v.uc}`));
print('Pages', top(views, (b) => b.p));
print('Entry pages', top(sessions, (v) => v.pages[0], 5));
print('Exit pages', top(sessions, (v) => v.pages.at(-1), 5));
print('Flows (page → next page)', top(views.filter((b) => b.r?.startsWith('/')), (b) => `${b.r} → ${b.p}`));
print('Devices', top(sessions, (v) => v.device));
print('Browsers', top(sessions, (v) => `${v.browser} / ${v.os}`));
print('Languages', top(sessions, (v) => v.lang, 5));
print('Time zones', top(sessions, (v) => v.tz, 5));
print('Average time on page', avg(leaves, (l) => l.t).map(([p, t]) => [p, duration(t)]));
print('Average scroll depth (%)', avg(leaves, (l) => l.sd));
print('Outbound clicks', top(beacons.filter((b) => b.e === 'out'), (b) => b.to));
