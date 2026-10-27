# Setup guides

One guide per block. Every block works out of the box with sample data; these explain how to make it yours
and, where there is one, how to connect a live source.

| Block | Data comes from | Live source | Guide |
| --- | --- | --- | --- |
| Education | Markdown files | none | [content-sections.md](content-sections.md) |
| Projects | Markdown files | none | [content-sections.md](content-sections.md) |
| Experience | Markdown files | none | [content-sections.md](content-sections.md) |
| Shipping (GitHub) | GitHub public data | yes, automatic | [github.md](github.md) |
| Reading | `src/data/reading.txt` | none (physical books) | [reading.md](reading.md) |
| Listening | `activities.yaml` | none yet (Last.fm possible) | [listening.md](listening.md) |
| On the move (distance) | `activities.yaml` or a Strava export | `pnpm strava:import`, by hand | [running-and-cycling.md](running-and-cycling.md) |
| Places | `src/data/places.txt` | OpenStreetMap lookup at build | [places.md](places.md) |
| Photography | `activities.yaml` + `site.yaml` banner | none | [photography.md](photography.md) |
| Languages | `activities.yaml` | none | [languages-and-uses.md](languages-and-uses.md) |
| Uses (optional) | `activities.yaml` | none | [languages-and-uses.md](languages-and-uses.md) |

**Going live:** [deploy-cloudflare.md](deploy-cloudflare.md). **Weekly reminders:** [reminders.md](reminders.md).

**Anything with a live source only refreshes when the site is rebuilt.** Set up a scheduled rebuild once
your host is chosen: [scheduled-rebuilds.md](scheduled-rebuilds.md).

## Turning blocks on, off, and reordering
All in `src/config/home.yaml`, under the `activities` section:

```yaml
blocks:
  - { id: reading, size: 1 }     # size: 1 or 2 columns, 4 = full row
  - { id: running, size: 2 }
  # - { id: uses, size: 2 }      # commented out = hidden
```

Whole sections (education, github, projects…) are reordered or removed the same way, one level up.
