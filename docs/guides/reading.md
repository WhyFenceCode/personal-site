# Reading

For physical books: you keep a plain text file, the site does the rest.

## The file: `src/data/reading.txt`
One book per line. Lines starting with `#` are ignored. Fields are separated by `|`.

```text
now      The Shape of Design | Frank Chimero | 120/220
2026-09  Piranesi | Susanna Clarke
2026-07  Thinking with Type | Ellen Lupton
want     The Timeless Way of Building | Christopher Alexander
```

| Start of line | Meaning |
| --- | --- |
| `now` | What you're reading. Page progress (`120/220`) is optional and drives the progress bar. |
| `2026-09` | Finished, with year and month (or just `2026`). |
| `want` | On the pile. Stored but not shown yet. |

Only the first `now` line is used. Finished books are sorted by date automatically, so add lines anywhere.

## What the block shows
- Spines of books finished this year (falls back to your most recent if none yet this year), up to 8.
- "X of Y books this year", where Y is the goal.
- The current book with its progress bar.

## The goal
In `src/config/activities.yaml`:
```yaml
reading:
  goal: 24
```

## Workflow tip
Update the page number when you sit down to read and the site is current. With a daily rebuild
([scheduled-rebuilds.md](scheduled-rebuilds.md)) you can even edit the file on GitHub from your phone.

A badly formatted line is skipped and named in the build log; it never breaks the build.
