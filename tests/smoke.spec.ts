import { test, expect } from '@playwright/test';
import { pages } from './pages';

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

test('résumé PDF downloads', async ({ request }) => {
  const res = await request.get('/images/DNG%20Resumev8.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('pdf');
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
