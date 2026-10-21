import { test, expect } from '@playwright/test';
import { pages, viewports } from './pages';

const isRemote = !!process.env.BASE_URL;

for (const p of pages) {
  test(`${p.path} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const res = await page.goto(p.path, { waitUntil: 'load' });
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(p.title);
    expect(errors).toEqual([]);
  });

  test(`${p.path} images and site assets resolve`, async ({ page, request }) => {
    await page.goto(p.path);
    const urls = await page.$$eval('img[src], link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"], link[rel="stylesheet"][href^="/"]',
      (els) => els.map((el) => (el as HTMLImageElement).src || (el as HTMLLinkElement).href));
    for (const url of new Set(urls)) {
      expect((await request.get(url)).status(), url).toBe(200);
    }
  });

  if (p.nav) {
    test(`${p.path} nav overlay opens and closes`, async ({ page }) => {
      await page.goto(p.path);
      const overlay = page.locator('#myNav');
      await expect(overlay).toHaveCSS('height', '0px');

      await page.locator('.hamburger').click();
      await expect(overlay.getByRole('link', { name: /^i am/ })).toBeVisible();

      await page.locator('.closebtn').click();
      await expect(overlay).toHaveCSS('height', '0px');
    });
  }
}

test('home page links to every section', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.$$eval('.menulayout a', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs).toHaveLength(3);
  for (const href of hrefs) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

test('thoughts filter hides entries by year and type', async ({ page }) => {
  await page.goto('/and-my-thoughts.html');
  const panel = page.locator('#filterPanel');
  const fanex = page.locator('.thoughtsEntry', { hasText: 'fanEx' });
  const site = page.locator('.thoughtsEntry', { hasText: 'danielng.info: This Site' });
  const noResults = page.locator('#noResults');

  await expect(panel).toBeHidden();
  await page.locator('.filterToggle').click();
  await expect(panel).toBeVisible();

  await panel.getByLabel('2019').uncheck();
  await expect(fanex).toBeHidden();
  await expect(site).toBeVisible();

  await panel.getByLabel('Projects').uncheck();
  await expect(site).toBeHidden();

  await panel.getByLabel('2026').uncheck();
  await expect(page.locator('.thoughtsEntry:visible')).toHaveCount(0);
  await expect(noResults).toBeVisible();

  await panel.getByRole('button', { name: 'Show everything' }).click();
  await expect(fanex).toBeVisible();
  await expect(site).toBeVisible();
  await expect(noResults).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('blog post cards link to their full post', async ({ page, request }) => {
  await page.goto('/and-my-thoughts.html');
  const hrefs = await page.$$eval('.thoughtsEntry[data-type="post"] a', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

for (const vp of viewports) {
  test(`thoughts filter icon sits left of the hamburger @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/and-my-thoughts.html');
    const filter = (await page.locator('.filterToggle').boundingBox())!;
    const hamburger = (await page.locator('.hamburger').boundingBox())!;
    expect(filter.x + filter.width).toBeLessThanOrEqual(hamburger.x);
    expect(hamburger.x - (filter.x + filter.width)).toBeLessThan(60);
  });
}

test('résumé PDF downloads', async ({ request }) => {
  const res = await request.get('/images/DNG%20Resumev8.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('pdf');
});

test('robots.txt is served', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('User-agent: *');
});

test('view-source easter egg comment is present', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain("If you're looking at this right now");
});

// The S3 ErrorDocument only exists on the deployed site, not in `astro preview`.
test('unknown URL serves the error page', async ({ page }) => {
  test.skip(!isRemote, 'only meaningful against a deployed site');
  await page.goto('/this-page-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Oops! Page Not Found' })).toBeVisible();
});
