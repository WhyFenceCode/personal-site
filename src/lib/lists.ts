/**
 * Plain-text lists you edit by hand (src/data/*.txt). One entry per line, fields separated by "|",
 * lines starting with # ignored. Kept deliberately forgiving: a malformed line is skipped with a warning.
 */
import readingRaw from '../data/reading.txt?raw';
import placesRaw from '../data/places.txt?raw';
import { geocode, type Point } from './geo';

const lines = (raw: string) => raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const fields = (s: string) => s.split('|').map((f) => f.trim());

export type Book = { title: string; author: string; finished?: string; page?: number; pages?: number };
export function reading() {
  const now: Book[] = [], finished: Book[] = [], want: Book[] = [];
  for (const line of lines(readingRaw)) {
    const m = line.match(/^(\S+)\s+(.*)$/);
    if (!m) { console.warn(`[reading] skipped: "${line}"`); continue; }
    const [tag, rest] = [m[1].toLowerCase(), m[2]];
    const [title, author = '', progress] = fields(rest);
    const book: Book = { title, author };
    if (tag === 'now') {
      const p = progress?.match(/(\d+)\s*\/\s*(\d+)/);
      if (p) { book.page = +p[1]; book.pages = +p[2]; }
      now.push(book);
    } else if (tag === 'want') want.push(book);
    else if (/^\d{4}(-\d{2})?$/.test(tag)) finished.push({ ...book, finished: tag });
    else console.warn(`[reading] unknown tag "${tag}" in: "${line}"`);
  }
  finished.sort((a, b) => (b.finished! > a.finished! ? 1 : -1));
  const year = String(new Date().getFullYear());
  return { current: now[0], thisYear: finished.filter((b) => b.finished!.startsWith(year)), finished, want };
}

export type Place = { name: string; city: string; year?: string; note?: string } & Point;
export async function places(): Promise<Place[]> {
  const out: Place[] = [];
  for (const line of lines(placesRaw)) {
    const [name, ...rest] = fields(line);
    const pin = rest.find((r) => r.startsWith('@'));
    const year = rest.find((r) => /^\d{4}$/.test(r));
    const note = rest.find((r) => r !== pin && r !== year);
    let p: Point | null = null;
    if (pin) { const [lat, lng] = pin.slice(1).split(',').map(Number); if (isFinite(lat) && isFinite(lng)) p = { lat, lng }; }
    p ??= await geocode(name);
    if (!p) continue;
    out.push({ name, city: name.split(',')[0], year, note, ...p });
  }
  return out;
}
