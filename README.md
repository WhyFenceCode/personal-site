# Personal site

Astro + React + Tailwind + Three.js. Static output, two languages, everything editable from YAML and Markdown.
Uses pnpm (version pinned in `package.json` → `packageManager`; `corepack enable` picks it up).

```bash
pnpm install
pnpm dev         # http://localhost:4321
pnpm build       # static site in dist/
pnpm check       # type check
```

## Where things live

| What | File |
| --- | --- |
| Name, email, socials, languages, GitHub user, features, legal address | `src/config/site.yaml` |
| The name block: layers you dive through, autoplay | `src/config/hero.yaml` |
| **Home page order** (everything below the name) | `src/config/home.yaml` |
| Hobby blocks (listening, running/cycling, photography link, languages, uses) | `src/config/activities.yaml` |
| Books (plain text, one per line) | `src/data/reading.txt` |
| Places visited (plain text, one per line) | `src/data/places.txt` |
| Resume timeline range and skills | `src/config/resume.yaml` |
| Interface text per language | `src/i18n/<lang>.yaml` |
| Projects | `src/content/projects/<lang>/<slug>.md` |
| Roles | `src/content/experience/<lang>/<slug>.md` |
| Education (set `featured: true` for the home page) | `src/content/education/<lang>/<slug>.md` |
| About page | `src/content/pages/<lang>/about.md` |
| Privacy, cookies, imprint, accessibility | `src/content/legal/<lang>/*.md` |
| Portrait | `public/portrait.jpg`; turn on/off under `portrait` in `site.yaml` |
| Top banner (e.g. link to your photo site) | `banner` in `site.yaml` |
| Resume PDF | `public/resume.pdf` |

Every YAML file is validated at build time; a typo fails the build with the file and key named.

### Reordering the home page
Move, delete or repeat entries in `src/config/home.yaml`. Sections alternate dark/light automatically;
set `tone: light|dark` to pin one. Each section takes an optional `cta: { label, to }`.

### Adding a language
Add the code to `languages` in `site.yaml` and create `src/i18n/<code>.yaml`. Missing strings and
untranslated Markdown fall back to the first language. Two languages show a toggle, three or more a dropdown.

### Adding a project image
Put the image next to the Markdown file and set `cover: ./cover.jpg` in its frontmatter. Without a cover,
generated placeholder art is shown.

### Adding a section type
Create a component in `src/sections/`, register it in `src/sections/index.ts`, and add its schema to
`sectionSchema` in `src/lib/config.ts`.

## Setup guides
Step-by-step guides for every block (including Strava and scheduled rebuilds) are in
[docs/guides/](docs/guides/README.md).

## GitHub activity
Set `github.username` in `site.yaml`. Public data only, fetched at build time, no token. If your GitHub
profile has "Include private contributions" switched on, those anonymous counts appear in the public graph too;
switch it off on GitHub to show strictly public work. Rebuild regularly to keep it current.

## Places and time zone
Places in `src/data/places.txt` and your city (for the hero clock, when `timezone: auto`) are looked up once on
OpenStreetMap at build time and cached in `src/data/places.cache.json`. Commit that file. Pin a place with
`@lat,lng` if a lookup is wrong.

## Strava (running and cycling)
Off by default (`training.source: static` uses the numbers in `activities.yaml`). To switch on:
1. Create an API application at strava.com/settings/api.
2. Authorise it for your own account with the **`activity:read`** scope only (not `activity:read_all`), and keep
   the refresh token it returns.
3. Add `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` and `STRAVA_REFRESH_TOKEN` as **build secrets** on your host.
   Never commit them; `.env*` files are git-ignored for local testing.
4. Set `training.source: strava`.

Only distance and date are used; routes, maps, start points, times and names are never read or published.
Each block hides itself when nothing was logged in `activeWithinDays`. Check Strava's current API agreement
before enabling: it restricts how Strava data may be shown to other people.

## Analytics
`analytics.provider` in `site.yaml`: `none`, `cloudflare`, `plausible`, `umami` or `goatcounter`.
All four supported providers are cookieless. Set `consent: true` to show the banner and load nothing until
the visitor allows it.

## Accessibility & privacy
- System cursor is never hidden; the circle only appears over interactive elements.
- All motion (ink, 3D, transitions, intro, marquee) respects `prefers-reduced-motion` and the footer "Motion" toggle.
- Fonts, Three.js and all scripts are bundled and served from the site; pages make no third-party requests
  unless you enable an analytics provider.
- Legal texts are templates: fill in your details and have them checked.
