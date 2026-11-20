# Sections and blocks

Everything below the name on the home page comes from `src/config/home.yaml`, top to bottom. Every block works with
sample data until you give it your own.

## The sections

| Section (`type:`) | Data comes from | Updates by itself | Guide |
| --- | --- | --- | --- |
| `marquee` | the `items` list in home.yaml | no | |
| `education`, `certifications` | Markdown in `src/content/education/` | no | [projects-and-resume.md](../writing/projects-and-resume.md) |
| `github` (Programming) | GitHub public data | yes, on each build | [programming.md](programming.md) |
| `projects` | Markdown in `src/content/projects/` | no | [projects-and-resume.md](../writing/projects-and-resume.md) |
| `experience` | Markdown in `src/content/experience/` | no | [projects-and-resume.md](../writing/projects-and-resume.md) |
| `activities` (Hobbies) | the blocks below | depends on the block | below |
| `places` | `src/data/places.txt` (the dot globe) | OpenStreetMap lookup on build | [places.md](places.md) |
| `contact` | `site.yaml` (email, socials) | no | |

## The hobby blocks (inside `activities`)

| Block (`id:`) | Data comes from | Guide |
| --- | --- | --- |
| `reading` | `src/data/reading.txt` | [reading.md](reading.md) |
| `listening` | `activities.yaml`, by hand | [listening.md](listening.md) |
| `training` (On the move) | a Strava export via `pnpm strava:import`, or by hand | [running-and-cycling.md](running-and-cycling.md) |
| `photography` | `activities.yaml` + the banner in `site.yaml` | [photography.md](photography.md) |
| `languages` | `activities.yaml` | [languages.md](languages.md) |

## Reordering, hiding, repeating

Move, delete or repeat entries in `home.yaml`. Sections alternate dark and light automatically; set `tone: light` or
`tone: dark` to pin one. Each section can take a link underneath, `cta: { label: <i18n key>, to: <page> }`, where the
page is `home`, `projects`, `blog`, `resume`, `about`, `contact` or a full URL. `hidden: true` keeps an entry but
doesn't show it.

Hobby blocks are listed under the `activities` section:

```yaml
- type: activities
  blocks:
    - { id: reading, size: 1 }     # size: 1 or 2 columns, 4 = a full row
    - { id: training, size: 2 }
    # - { id: listening, size: 1 } # commented out = hidden
```

**Anything with a live source only refreshes when the site is rebuilt**, so keep the daily rebuild running:
[scheduled-rebuilds.md](../site/scheduled-rebuilds.md).

## Adding a section type
Create a component in `src/sections/`, register it in `src/sections/index.ts`, and add its schema to `sectionSchema`
in `src/lib/config.ts`.
