import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tag: z.enum(['postmortem', 'teardown', 'patch-notes', 'field-notes']),
    readingTime: z.number().optional(),
    excerpt: z.string(),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    name: z.string(),
    status: z.enum(['live', 'broken', 'wip', 'archived']),
    description: z.string(),
    tags: z.array(z.string()),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(999),
  }),
});

export const collections = { posts, projects };
