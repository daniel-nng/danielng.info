// Visual regression: screenshot the baseline site, then compare the candidate against it.
//
//   BASELINE_URL  site to treat as "correct"  (default: https://danielng.info, i.e. prod)
//   BASE_URL      site under test             (default: local `astro preview` of dist/)
//
// Both captures run on this machine in the same browser, so differences come from
// the markup/CSS, not from fonts or OS rendering.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const baseline = process.env.BASELINE_URL ?? 'https://danielng.info';
const snapshotDir = '.visual-baseline';

rmSync(snapshotDir, { recursive: true, force: true });

const run = (label, env, extraArgs = []) => {
  console.log(`\n== ${label}`);
  const res = spawnSync('npx', ['playwright', 'test', '--project=visual', ...extraArgs, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, VISUAL_SNAPSHOT_DIR: snapshotDir, ...env },
  });
  return res.status ?? 1;
};

if (run(`capturing baseline from ${baseline}`, { BASE_URL: baseline }, ['--update-snapshots=all']) !== 0) {
  console.error('Baseline capture failed.');
  process.exit(1);
}
process.exit(run(`comparing ${process.env.BASE_URL ?? 'local build'} against baseline`, {}));
