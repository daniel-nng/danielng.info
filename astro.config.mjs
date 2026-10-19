// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://danielng.info',
  // Keep whitespace and HTML comments exactly as written so the port renders
  // identically to the old hand-written pages (Astro 7 defaults to JSX rules).
  compressHTML: false,
  build: {
    // src/pages/i-am.astro -> dist/i-am.html, so existing URLs keep working.
    format: 'preserve',
  },
});
