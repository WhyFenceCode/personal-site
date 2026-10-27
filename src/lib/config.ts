/**
 * Loads and validates the YAML files in src/config. Everything the site needs to know about
 * you (name, languages, section order, activity data) comes through here, so a typo in a YAML
 * file fails the build with a readable message instead of rendering a broken page.
 */
import { parse } from 'yaml';
import { z } from 'astro/zod';
import siteRaw from '../config/site.yaml?raw';
import heroRaw from '../config/hero.yaml?raw';
import homeRaw from '../config/home.yaml?raw';
import activitiesRaw from '../config/activities.yaml?raw';
import resumeRaw from '../config/resume.yaml?raw';

const link = z.object({ label: z.string(), url: z.string() });

const siteSchema = z.object({
  name: z.string(),
  email: z.string(),
  url: z.string(),
  location: z.object({ city: z.string(), region: z.string().default(''), country: z.string().default(''), timezone: z.string().default('auto') }),
  languages: z.array(z.string()).min(1),
  socials: z.array(link).default([]),
  github: z.object({ username: z.string().default('') }).default({ username: '' }),
  resume: z.object({ pdf: z.string().optional() }).default({}),
  features: z.object({
    loader: z.boolean().default(true),
    pageTransitions: z.boolean().default(true),
    cursorRing: z.boolean().default(true),
  }).default({ loader: true, pageTransitions: true, cursorRing: true }),
  portrait: z.object({
    enabled: z.boolean().default(true),
    src: z.string().default('/portrait.jpg'),
    alt: z.string().default(''),
  }).default({ enabled: true, src: '/portrait.jpg', alt: '' }),
  banner: z.object({
    enabled: z.boolean().default(false),
    pages: z.enum(['home', 'all']).default('home'),
    text: z.string().default(''),
    label: z.string().default(''),
    url: z.string().default(''),
    dismissible: z.boolean().default(true),
  }).default({ enabled: false, pages: 'home', text: '', label: '', url: '', dismissible: true }),
  typography: z.object({
    numbers: z.enum(['serif', 'outline']).default('serif'),
    headings: z.enum(['display', 'serif', 'outline']).default('display'),
  }).default({ numbers: 'serif', headings: 'display' }),
  analytics: z.object({
    provider: z.enum(['none', 'cloudflare', 'plausible', 'umami', 'goatcounter']).default('none'),
    consent: z.boolean().default(false),
    token: z.string().default(''),
    domain: z.string().default(''),
    src: z.string().default(''),
  }).default({ provider: 'none', consent: false, token: '', domain: '', src: '' }),
  legal: z.object({
    owner: z.string(),
    jurisdiction: z.string().default(''),
    imprint: z.boolean().default(false),
    hosting: z.string().default(''),
    address: z.array(z.string()).default([]),
    updated: z.coerce.string(),
  }),
});

const layerSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['flat', 'chrome', 'rope', 'blocks']),
  font: z.enum(['display', 'serif', 'pixel', 'mono', 'text']),
  weight: z.number().default(800),
  stretch: z.number().default(100),
  italic: z.boolean().default(false),
  case: z.enum(['upper', 'none']).default('upper'),
  ink: z.string().default('#0B0B0B'),
  paper: z.string().default('#FFFFFF'),
  outline: z.boolean().default(false),
  text: z.string().optional(),   // rope layer: the word printed on the labels
});
const heroSchema = z.object({
  dive: z.number().min(0.05).max(2).default(0.45),
  autoplay: z.object({
    mobile: z.boolean().default(true),
    desktop: z.boolean().default(true),
    intervalSeconds: z.number().default(5),
    selfDive: z.enum(['touch', 'always', 'never']).default('touch'),
    firstDiveAfter: z.number().default(8),
  }).default({ mobile: true, desktop: true, intervalSeconds: 5, selfDive: 'touch', firstDiveAfter: 8 }),
  layers: z.array(layerSchema).min(1),
});

const cta = z.object({ label: z.string(), to: z.string() });
const sectionBase = { tone: z.enum(['light', 'dark']).optional(), cta: cta.optional(), hidden: z.boolean().default(false) };
const sectionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('marquee'), items: z.array(z.string()).optional(), ...sectionBase }),
  z.object({ type: z.literal('education'), show: z.number().default(2), ...sectionBase }),
  z.object({ type: z.literal('certifications'), limit: z.number().default(6), ...sectionBase }),
  z.object({ type: z.literal('github'), weeks: z.number().default(53), ...sectionBase }),
  z.object({ type: z.literal('projects'), limit: z.number().default(4), ...sectionBase }),
  z.object({ type: z.literal('experience'), ...sectionBase }),
  z.object({ type: z.literal('activities'), blocks: z.array(z.object({ id: z.string(), size: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1) })), ...sectionBase }),
  z.object({ type: z.literal('contact'), ...sectionBase }),
]);
const homeSchema = z.object({ sections: z.array(sectionSchema) });

const resumeSchema = z.object({
  timeline: z.object({ from: z.number().optional(), to: z.number().optional() }).default({}),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.object({ name: z.string(), years: z.number() })) })),
});

function load<T extends z.ZodType>(name: string, raw: string, schema: T): z.infer<T> {
  const result = schema.safeParse(parse(raw));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`src/config/${name} is invalid:\n${issues}`);
  }
  return result.data;
}

export const site = load('site.yaml', siteRaw, siteSchema);
export const hero = load('hero.yaml', heroRaw, heroSchema);
export const home = load('home.yaml', homeRaw, homeSchema);
export const resume = load('resume.yaml', resumeRaw, resumeSchema);
/** Activity blocks are free-form per block type; each block component validates its own shape. */
export const activities = parse(activitiesRaw) as Record<string, any>;

export type Layer = z.infer<typeof layerSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Cta = z.infer<typeof cta>;
