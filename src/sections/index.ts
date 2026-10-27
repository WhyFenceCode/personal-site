/**
 * Section registry: maps the `type` used in home.yaml to a component.
 * To add a new section type, create the component in this folder, register it here,
 * and add its schema to `sectionSchema` in lib/config.ts.
 */
import Marquee from './Marquee.astro';
import Education from './Education.astro';
import GitHub from './GitHub.astro';
import Projects from './Projects.astro';
import Experience from './Experience.astro';
import Activities from './Activities.astro';
import Contact from './Contact.astro';

export const SECTIONS = {
  marquee: Marquee,
  education: Education,
  github: GitHub,
  projects: Projects,
  experience: Experience,
  activities: Activities,
  contact: Contact,
} as const;
