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

### Step by step on Cloudflare Pages
1. **Workers & Pages → your project → Settings → Variables and Secrets → Add.**
2. Add the three names from step 3, each with **Type: Secret** (encrypted, never shown again), for **Production**.
   Add them to **Preview** too only if you want preview deployments to show live numbers.
3. **Deployments → Retry deployment** (or push a commit) so a build runs with the new secrets.
4. Open the build log and look for `[strava]`. No line means it worked; a `[strava] falling back…` line says why not.
5. Set up the daily rebuild from [scheduled-rebuilds.md](scheduled-rebuilds.md) so the totals stay current.

### Testing on your own computer first
1. Create a file named `.env` in the project root (it's git-ignored, so it can't be committed):
   ```
   STRAVA_CLIENT_ID=12345
   STRAVA_CLIENT_SECRET=your-client-secret
   STRAVA_REFRESH_TOKEN=your-refresh-token
   ```
2. Set `training.source: strava` in `src/config/activities.yaml`.
3. Run `pnpm build`. If there's no `[strava]` warning, open `dist/en/index.html` in a browser and check the
   running block. The build also ends with the secret scan, which fails if any of these values leaked into the site.
4. Delete `.env` when you're done if you don't want the secrets on this machine.

### Troubleshooting
| Build log says | Meaning | Fix |
| --- | --- | --- |
| `token 400` or `token 401` | Client ID/secret wrong, or the refresh token was revoked or replaced | Re-check the values; repeat step 2 for a new token |
| `activities 401` | The token doesn't have `activity:read` | Repeat step 2 and make sure the URL says `scope=activity:read` |
| `activities 429` | Strava rate limit (100 requests per 15 min, 1,000 per day) | Wait; a daily rebuild uses 2–3 requests |
| No warning, but the block is missing | Nothing logged in the last `activeWithinDays` days | Expected; it reappears with your next activity |
| No warning, numbers look old | The site hasn't rebuilt since | Trigger a rebuild, or set up the daily one |

### Revoking access
Strava → **Settings → My Apps → Revoke Access**. Do this, and create a new token, if you think a secret
leaked. If Strava ever returns a different refresh token, builds will fall back to the manual numbers and log
a warning; repeat step 2.
