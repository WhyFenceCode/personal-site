# Running and cycling

Two blocks (`running`, `cycling`) showing weekly distance for the last 26 weeks, the total and your longest
effort. **Each one hides itself when nothing was logged recently**, so an off-season simply disappears.

## Option A: by hand (default)
`src/config/activities.yaml`:

```yaml
training:
  source: static
  unit: km
  activeWithinDays: 30          # hide a block if its last activity is older than this
  running:
    goal: 1200                  # optional, shown as "Yearly goal"
    lastActivity: 2026-10-24    # controls the hide/show rule
    weeks: [18, 22, 0, 25, ...] # 26 numbers, oldest first
    longest: { km: 21.1, name: Half marathon, date: 2026-09-14 }
  cycling:
    ...
```

## Option B: Strava (automatic)

### What gets published, and what never does
- Used: the **distance** and **date** of each activity, summed per week.
- Never read or published: routes, maps, GPS, start/end points, times of day, activity names, photos,
  heart rate, devices, followers.
- Private activities and "Only me" ones are excluded (by the permission scope and again in the code).
- Credentials live only in your host's build environment and are scanned for after every build.

### Before you start
Strava's API agreement (tightened in late 2024) restricts showing Strava data to other people. A personal
site showing your own weekly totals is a grey area. Read the current agreement at
<https://www.strava.com/legal/api> and decide for yourself; the manual option above avoids the question.
If you enable it, the block shows "Data from Strava" as attribution.

### 1. Create the API application
1. Go to <https://www.strava.com/settings/api> and create an app.
2. **Authorization Callback Domain:** `localhost`
3. Note the **Client ID** and **Client Secret**.

### 2. Get a refresh token with read-only access
1. Open this URL in your browser (replace `YOUR_CLIENT_ID`):
   ```
   https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read
   ```
   The scope must be **`activity:read`**. Do not use `activity:read_all`; that includes private activities.
2. Approve. The browser goes to a `http://localhost/?...&code=XXXX...` page that fails to load. That's expected:
   copy the `code` value from the address bar. It expires in a few minutes.
3. Exchange it for a refresh token (in a terminal, replacing the three values):
   ```bash
   curl -X POST https://www.strava.com/oauth/token -d client_id=YOUR_CLIENT_ID -d client_secret=YOUR_CLIENT_SECRET -d code=THE_CODE -d grant_type=authorization_code
   ```
4. From the JSON response, copy `refresh_token`. Don't share the response; it also contains an access token.

### 3. Store the three values as build secrets
On your host (see [scheduled-rebuilds.md](scheduled-rebuilds.md#build-secrets-on-the-host)):

| Name | Value |
| --- | --- |
| `STRAVA_CLIENT_ID` | from step 1 |
| `STRAVA_CLIENT_SECRET` | from step 1 |
| `STRAVA_REFRESH_TOKEN` | from step 2 |

For a local test, put them in a `.env` file in the project root. It's git-ignored; never rename it.

### 4. Switch it on
```yaml
training:
  source: strava
```
Keep the manual numbers in place: they're the fallback if Strava is down during a build.

### 5. Rebuild daily
[scheduled-rebuilds.md](scheduled-rebuilds.md). Totals update once per build.

### Revoking access
Strava → **Settings → My Apps → Revoke Access**. Do this, and create a new token, if you think a secret
leaked. If Strava ever returns a different refresh token, builds will fall back to the manual numbers and log
a warning; repeat step 2.
