/**
 * The resume PDF link, or null when there isn't a real one. Download buttons only render when this
 * returns a value: a full https:// URL, or a path to a file that actually exists in /public.
 * An empty value, a placeholder like "/#", or a file that hasn't been added yet all hide them.
 */
import { existsSync, statSync } from 'node:fs';
import { site } from './config';

export function resumePdf(): string | null {
  const pdf = site.resume.pdf?.trim();
  if (!pdf) return null;
  if (/^https?:\/\//.test(pdf)) return pdf;
  const file = `public/${pdf.replace(/^\/+/, '').split(/[?#]/)[0]}`;
  try { return existsSync(file) && statSync(file).isFile() ? pdf : null; } catch { return null; }
}
