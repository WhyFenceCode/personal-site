# Distance moved ("On the move")

One block (`training` in home.yaml) showing your weekly distance for the last 26 weeks, with every activity that
has a distance added together: runs, rides, walks, hikes, swims. It also shows the total and your longest single
effort. There's deliberately no goal or target. **It hides itself when nothing was logged recently.**

The numbers come from one of two places, set in `src/config/activities.yaml`:

```yaml
training:
  source: import       # import = your Strava export (below) · static = typed by hand
  unit: km
  activeWithinDays: 30 # hide the block if the last activity is older than this
```

## Option A: your Strava export (recommended)
Strava's live API needs a subscription, but its data export is free. `pnpm strava:import` turns that export
into a small summary the site reads when it builds.

1. **Request the export** on the Strava website (not the app): open <https://www.strava.com/account>
   (profile picture → Settings → My Account), scroll to *Download or Delete Your Account*, click
   **Get Started**, then **Request Your Archive** under step 2. Strava emails a download link for a `.zip`,
   usually within a few hours.
2. **Import it**, from the project folder:
   ```bash
   pnpm strava:import ~/Downloads/export_12345678.zip
   ```
   You can also pass the unzipped folder or its `activities.csv`. Add `--miles` if your Strava units are miles
   and the export has only one Distance column.
3. **Publish:** commit `src/data/training.json` and push. The block shows "From my Strava export" with the
   import date.
4. **Delete the export** afterwards if you like. It isn't needed again, and it was never copied into the project.

Repeat whenever you want fresher numbers (monthly is plenty). The 26-week window moves with each build, so
weeks after your last import simply show as zero until the next one.

### What gets published, and what never does
- Kept: **kilometres per week** (all activities added together), your **longest effort** (distance, date and
  type, such as "Run") and the **date of your last activity**. Only the last year of weeks is stored.
- Dropped before anything is written: activity names and descriptions, IDs, times of day, routes and GPS files,
  heart rate, gear and photos. Activities without a distance (strength, yoga) add nothing.
- The export doesn't say which activities are private, so private runs count towards the weekly totals. No single
  activity is ever listed.

## Option B: by hand
```yaml
training:
  source: static
  lastActivity: 2026-10-24      # controls the hide/show rule
  weeks: [18, 22, 0, 25, ...]   # 26 weekly totals in km, oldest first
  longest: { km: 21.1, name: Half marathon, date: 2026-09-14 }   # name or type is shown beside it
```
These numbers are also the fallback when `source: import` is set but `src/data/training.json` doesn't exist yet.
Until then the block says "Sample data".

## Troubleshooting
| Problem | Fix |
| --- | --- |
| `Couldn't read activities.csv from that zip` | Unzip the export and pass the folder |
| `doesn't look like Strava's activities.csv` | Pass the export itself, not another CSV |
| Distances look 1.6× too small | Your units are miles and the export has one Distance column: add `--miles` |
| The block is missing | Nothing in the last `activeWithinDays` days. Import a newer export, or raise the number |
| Build log says `[training] … not found` | Run the import and commit `src/data/training.json` |
