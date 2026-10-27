# Scheduled rebuilds

The site is static: GitHub activity, the place lookups and the "this year" reading count are
worked out when the site **builds**, not when someone visits. To keep them fresh, rebuild on a schedule.
Daily is plenty.

## Cloudflare Pages (recommended if you host there)

1. In the Cloudflare dashboard: **Workers & Pages → your project → Settings → Builds → Deploy hooks → Add**.
   Name it `daily`, branch `main`. Copy the URL.
2. **Treat that URL as a secret.** Anyone with it can trigger builds. Don't paste it into any file in the repo.
3. In GitHub: **repo → Settings → Secrets and variables → Actions → New repository secret**,
   name `CF_DEPLOY_HOOK`, value = the URL.
4. Create `.github/workflows/rebuild.yml` (this file is safe to commit: it only references the secret by name):

```yaml
name: Daily rebuild
on:
  schedule:
    - cron: "17 9 * * *"   # every day at 09:17 UTC
  workflow_dispatch: {}     # adds a "Run workflow" button
permissions: {}             # the job needs no access to the repo
jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cloudflare build
        run: curl -fsS -X POST "$HOOK" > /dev/null
        env:
          HOOK: ${{ secrets.CF_DEPLOY_HOOK }}
```

GitHub masks secret values in logs, and `curl -fsS … > /dev/null` doesn't print the response.

## Netlify or Vercel
Both have "build hooks" / "deploy hooks" in the project settings. Same workflow, different URL.

## Build secrets on the host
Any build secrets you add later go in the **host's** environment variables, not in GitHub, because the host runs
the build:

- Cloudflare Pages: **Settings → Variables and Secrets → Add**, type **Secret** (encrypted), for Production
  (and Preview if you want previews to show live data).
- Netlify: **Site configuration → Environment variables**.
- Vercel: **Settings → Environment Variables**.

`pnpm build` ends with a secret scan (`scripts/check-secrets.mjs`) that fails the deploy if any of these values
show up in the published files.
