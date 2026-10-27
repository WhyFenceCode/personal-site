# Shipping (GitHub commit tracker)

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
  cta: { label: cta.allProjects, to: work }   # the link under the section
```

## Freshness
Updates on every build. See [scheduled-rebuilds.md](scheduled-rebuilds.md) for a daily rebuild.
GitHub's unauthenticated API allows 60 requests an hour per IP; a build uses 2, so this is never an issue.
