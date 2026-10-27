/**
 * Section registry: maps the `type` used in home.yaml to a component.
 * To add a new section type, create the component in this folder, register it here,
 * and add its schema to `sectionSchema` in lib/config.ts.
 */
import Marquee from './Marquee.astro';
import Education from './Education.astro';
import Certifications from './Certifications.astro';
import GitHub from './GitHub.astro';
import Projects from './Projects.astro';
import Experience from './Experience.astro';
import Activities from './Activities.astro';
import Contact from './Contact.astro';

import { educationFor, isCertification } from '../lib/content';

/** Sections that render nothing without content. They're skipped before light/dark tones are assigned,
    so an empty section never breaks the alternation. */
export const IS_EMPTY: Partial<Record<keyof typeof SECTIONS, (lang: string) => Promise<boolean>>> = {
  certifications: async (lang) => !(await educationFor(lang)).some((e) => isCertification(e.data.kind)),
};

export const SECTIONS = {
  marquee: Marquee,
  education: Education,
  certifications: Certifications,
  github: GitHub,
  projects: Projects,
  experience: Experience,
  activities: Activities,
  contact: Contact,
} as const;
