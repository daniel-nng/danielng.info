// Traffic report from the prod CloudFront access logs in s3://logs.danielng.info/logs/.
//
//   npm run logs                 last 1 day (UTC)
//   npm run logs -- --days 7     last 7 days
//   npm run logs -- --raw        print every request (date, time, status, page, referrer) instead
//
// Needs the AWS CLI signed in (`aws login`). Log files are cached in .cf-logs/ so
// re-running only downloads new ones.
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 's3://logs.danielng.info/logs/';
const DISTRIBUTION = 'E1T6OVVYEAFGQ7'; // prod: danielng.info
const CACHE = '.cf-logs';

const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 1;
const raw = args.includes('--raw');

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
  .map(([date, time, , , ip, , , page, status, referrer, ua]) =>
    ({ when: `${date} ${time}`, ip, page, status, referrer, ua: decode(ua ?? '') }))
  .filter((r) => r.when >= since)
  .sort((a, b) => a.when.localeCompare(b.when));

if (!rows.length) {
  console.log(`No requests logged since ${since} UTC.`);
  process.exit(0);
}

if (raw) {
  for (const r of rows) console.log([r.when, r.status, r.page, r.referrer].join('\t'));
  process.exit(0);
}

function decode(s) {
  try {
    return decodeURIComponent(decodeURIComponent(s));
  } catch {
    return s; // scanners send malformed %-escapes
  }
}

const BOT = /bot|crawl|spider|headless|python|curl|go-http|wget|scan|zgrab|playwright/i;
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
print('Most-requested missing URLs (mostly scanners)', top(rows.filter((r) => r.status === '404' || r.status === '403'), (r) => r.page));
