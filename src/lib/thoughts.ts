import { getCollection } from 'astro:content';

/** Posts that should be on the site: everything in dev, only non-drafts in a build. */
export function getPublishedPosts() {
  return getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
}

/** "November 2019". Dates come from frontmatter as UTC midnight, so format in UTC. */
export function formatMonthYear(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
