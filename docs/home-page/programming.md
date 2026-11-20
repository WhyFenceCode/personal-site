# Programming (GitHub commit tracker)

Shows your contribution calendar, current and longest streak, three recently pushed repositories and your
latest pushes. Public data only: no token, nothing private.

## Setup
1. In `src/config/site.yaml`:
   ```yaml
   github:
     username: your-handle
   ```
2. Rebuild. Without a username (or if GitHub can't be reached during the build), sample data is shown with a
   note saying so.

## Where the data comes from
- **Calendar:** `github-contributions-api.jogruber.de`, a public mirror of the graph on your GitHub profile.
- **Repositories and pushes:** GitHub's public REST API (your own non-fork repos, sorted by last push).

All fetched once per build, from the build server. Visitors' browsers never contact GitHub.

## Keeping it strictly public
Your profile graph can include anonymous counts from private repos if
**GitHub → Settings → Public profile → Contributions & activity → Include private contributions** is ticked.
Untick it if you want the calendar to show public work only. Private repo names are never shown either way.

## Options (`src/config/home.yaml`)
```yaml
- type: github
  weeks: 53                                   # how many weeks of calendar
  cta: { label: cta.allProjects, to: projects }   # the link under the section
```

## Freshness
Updates on every build. See [scheduled-rebuilds.md](../site/scheduled-rebuilds.md) for a daily rebuild.
GitHub's unauthenticated API allows 60 requests an hour per IP. This block uses 2 per build, and each code viewer
([embeds.md](../writing/embeds.md)) 2 more, so it's never an issue in practice.

## Not to be confused with
The **code viewer** shows one repository's files on a project page or in a post: [embeds.md](../writing/embeds.md).

## Repo cards for your GitHub profile
The site also draws link cards for your key repositories, in its own style, for the profile README
(github.com/WhyFenceCode/WhyFenceCode). Pick the repos in `site.yaml`:

```yaml
github:
  cards:
    - { repo: personal-site, title: Personal site, description: "…" }   # title and description are optional
    - { repo: extracurricular-api, title: Extracurricular API }
```

Each becomes `/github/<repo>-light.svg` and `/github/<repo>-dark.svg`, with the language, stars and last update taken
from GitHub when the site builds. Like the banner, GitHub needs the files in the profile repo itself:

1. Run `pnpm build` (or `pnpm dev`) and save each card from `dist/github/` (or `http://localhost:4321/github/…`) into
   the profile repo's `assets/` folder.
2. In its README, two cards per row, each a link to its repo:

```html
<a href="https://github.com/WhyFenceCode/personal-site"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/personal-site-dark.svg">
  <img alt="Personal site" src="assets/personal-site-light.svg" width="49%">
</picture></a>
<a href="https://github.com/WhyFenceCode/extracurricular-api"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/extracurricular-api-dark.svg">
  <img alt="Extracurricular API" src="assets/extracurricular-api-light.svg" width="49%">
</picture></a>
```

Re-copy them now and then so the stars and dates stay current.
