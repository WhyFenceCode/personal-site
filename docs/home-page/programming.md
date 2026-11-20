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

## Images for your GitHub profile
The site also draws the pieces of the profile README (github.com/WhyFenceCode/WhyFenceCode) in its own style, each in
a light and a dark version. Set them in `site.yaml`:

```yaml
github:
  links:                       # a row of pills under the banner, one image (and one link) each
    - { label: Website, url: "https://torstenyoung.com" }   # the first is filled, like the site's Contact button
  intro: Engineering student at Queen's University…         # a sentence under the links
  heading: Featured work       # the section heading over the cards, with the count
  cards:                       # one card per repo: language, stars and last update come from GitHub
    - { repo: personal-site, title: Personal site, description: "…" }   # title and description are optional
```

| File (in `dist/github/` after a build) | What |
| --- | --- |
| `link-<label>-light.svg` / `-dark.svg` | One pill per link. Separate images, because GitHub can only make a whole image a link |
| `intro-light.svg` / `-dark.svg` | The intro sentence and the heading |
| `<repo>-light.svg` / `-dark.svg` | A repo card |

To update the profile: run `pnpm build`, copy `dist/github/` (and `dist/github-banner-*.svg`) into the profile repo's
`assets/`, and push it. Keep its README's images inside **one `<div>` with no blank lines in it**: GitHub's Markdown
parser otherwise splits the `<picture>` tags apart, which breaks the light/dark switch and the two-per-row layout.

```html
<div>
<a href="https://torstenyoung.com"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/link-website-dark.svg"><img alt="Website" src="assets/link-website-light.svg"></picture></a>
<a href="https://github.com/WhyFenceCode/personal-site"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/personal-site-dark.svg"><img alt="Personal site" src="assets/personal-site-light.svg" width="49%"></picture></a>
</div>
```

Re-copy them now and then so the stars and dates stay current.
