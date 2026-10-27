/**
 * Languages come from site.yaml; strings come from src/i18n/<lang>.yaml.
 * A language listed in site.yaml without a matching YAML file is ignored, and any key
 * missing from a translation falls back to the default language.
 */
import { parse } from 'yaml';
import { site } from './config';

const files = import.meta.glob('../i18n/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const dictionaries: Record<string, any> = {};
for (const [path, raw] of Object.entries(files)) {
  const code = path.split('/').pop()!.replace('.yaml', '');
  dictionaries[code] = parse(raw);
}

export const languages = site.languages.filter((l) => dictionaries[l]);
export const defaultLang = languages[0];
export type Lang = string;

const lookup = (dict: any, key: string) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);

/** Translate a dotted key, e.g. t('de', 'nav.work'). `{name}` placeholders are filled from vars. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): any {
  let value = lookup(dictionaries[lang], key) ?? lookup(dictionaries[defaultLang], key) ?? key;
  if (typeof value === 'string') value = value.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  return value;
}

export const useT = (lang: Lang) => (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);

/** Pages that CTAs and nav can point at. */
const PAGES: Record<string, string> = { home: '', work: 'work/', resume: 'resume/', about: 'about/', contact: '#contact' };

/** Build a localised URL. `to` is a page key, a page key with a slug ("work/orbit"), or a full URL. */
export function href(lang: Lang, to: string): string {
  if (/^(https?:|mailto:|\/)/.test(to)) return to;
  if (to === 'contact') return `/${lang}/#contact`;
  if (PAGES[to] !== undefined) return `/${lang}/${PAGES[to]}`;
  return `/${lang}/${to.replace(/^\/|\/$/g, '')}/`;
}

/** Swap the language prefix of the current path, keeping the rest. */
export function switchPath(pathname: string, to: Lang): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length && languages.includes(parts[0])) parts[0] = to;
  else parts.unshift(to);
  return `/${parts.join('/')}/`;
}

export const langStaticPaths = () => languages.map((lang) => ({ params: { lang } }));
