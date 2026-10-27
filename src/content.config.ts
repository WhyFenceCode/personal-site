/**
 * Content collections. Every entry is a Markdown file inside a language folder:
 *   src/content/<collection>/<lang>/<slug>.md
 * A translation is optional; pages fall back to the default language (see lib/content.ts).
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const md = (base: string) => glob({ pattern: '**/*.md', base: `./src/content/${base}` });

const projects = defineCollection({
  loader: md('projects'),
  schema: ({ image }) => z.object({
    title: z.string(),
    year: z.number(),
    kind: z.string(),                       // shown as a label, e.g. "Web app"
    category: z.string(),                   // used by the filter on the work page
    role: z.string(),
    stack: z.array(z.string()).default([]),
    summary: z.string(),
    cover: image().optional(),              // falls back to a `pnpm shots` screenshot, then to placeholder art
    live: z.url().optional(),      // the live site: "Visit the site" button, screenshot cover, live preview
    preview: z.boolean().default(true),     // false = never offer the interactive live preview
    client: z.string().optional(),
    services: z.array(z.string()).default([]),
    metrics: z.array(z.object({ value: z.union([z.string(), z.number()]), label: z.string() })).default([]),
    art: z.string().default('orbit'),       // placeholder art when there is no cover
    featured: z.boolean().default(false),   // featured projects show on the home page first
    order: z.number().default(100),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  }),
});

const experience = defineCollection({
  loader: md('experience'),
  schema: z.object({
    company: z.string(),
    role: z.string(),
    location: z.string().optional(),
    start: z.coerce.string(),               // "2023" or "2023-04"
    end: z.coerce.string().optional(),      // leave out for "now"
    tags: z.array(z.string()).default([]),
  }),
});

const education = defineCollection({
  loader: md('education'),
  schema: z.object({
    title: z.string(),                      // degree or certificate name
    institution: z.string(),
    kind: z.enum(['degree', 'exchange', 'certificate', 'course']).default('degree'),
    start: z.coerce.string().optional(),
    end: z.coerce.string(),
    grade: z.string().optional(),
    highlight: z.string().optional(),       // the one line that shows on the home page
    courses: z.array(z.string()).default([]), // relevant courses, shown as chips
    url: z.string().optional(),             // certificates: link to verify the credential
    expires: z.coerce.string().optional(),  // certificates: when it runs out ("2027" or "2027-02"); end is when it was attained
    featured: z.boolean().default(false),   // featured entries are the ones on the home page
    order: z.number().default(100),
  }),
});

const pages = defineCollection({
  loader: md('pages'),
  schema: z.object({ title: z.string(), description: z.string().optional(), lead: z.string().optional() }),
});

const legal = defineCollection({
  loader: md('legal'),
  schema: z.object({ title: z.string(), order: z.number().default(0) }),
});

export const collections = { projects, experience, education, pages, legal };
