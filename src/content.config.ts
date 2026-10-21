import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Project cards on and-my-thoughts.html: a short "what is it" summary per project.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    image: z.string(),
    imageAlt: z.string(),
  }),
});

// Long-form posts: a preview card on and-my-thoughts.html, full text at /thoughts/<id>.html.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    // Drafts render in `npm run dev` only and are left out of every build.
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, posts };
