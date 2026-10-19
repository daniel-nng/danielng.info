import { test, expect } from '@playwright/test';
import { pages, viewports } from './pages';

const slug = (path: string) => (path === '/' ? 'index' : path.replace(/^\/|\.html$/g, ''));

for (const p of pages) {
  for (const vp of viewports) {
    test(`${p.path} @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(p.path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${slug(p.path)}-${vp.name}.png`, { fullPage: true });

      if (p.nav) {
        await page.locator('.hamburger').click();
        await page.waitForTimeout(600); // overlay height transition is 0.5s
        await expect(page).toHaveScreenshot(`${slug(p.path)}-${vp.name}-nav-open.png`);
      }
    });
  }
}
