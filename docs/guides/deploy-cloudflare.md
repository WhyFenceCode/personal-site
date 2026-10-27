# Launching on Cloudflare Pages

The site is fully static: `pnpm build` writes everything to `dist/`. Cloudflare Pages builds it from your
GitHub repo on every push to `main` and serves it on torstenyoung.com.

## 1. Put the code on GitHub
The repo has no remote yet.

1. On GitHub, create a new repository (e.g. `personal-site`). Leave it empty: no README, licence or .gitignore.
   Private or public both work.
2. In the project folder:
   ```bash
   git remote add origin https://github.com/WhyFenceCode/personal-site.git
   git push -u origin main
   ```
3. Before the first push, check that nothing secret is staged. `.env`, `.dev.vars` and `private/` are git-ignored,
   and `pnpm build` ends with a secret scan.

## 2. Create the Pages project
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**. Authorise GitHub and pick
   the repository. Only give Cloudflare access to this one repository.
2. Build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Astro |
   | Production branch | `main` |
   | Build command | `pnpm build` |
   | Build output directory | `dist` |

3. **Environment variables** (same screen, or later under Settings → Variables and Secrets):

   | Name | Value | Why |
   | --- | --- | --- |
   | `NODE_VERSION` | `24` | Astro 7 needs a current Node |
   | `PNPM_VERSION` | `11.20.0` | Matches `packageManager` in package.json |

   Add the Strava secrets here too if you use it ([running-and-cycling.md](running-and-cycling.md)), as type
   **Secret**.
4. **Save and Deploy.** The first build takes a few minutes. You get a `*.pages.dev` address to check it on.
   The build log ends with `[check-secrets] ok`. If the scan fails, the deploy stops, which is what you want.

## 3. Connect torstenyoung.com
1. The domain needs to be on Cloudflare: **Add a domain** in the dashboard and switch its nameservers at your
   registrar to the two Cloudflare gives you (skip if it's already there, which it is if photos.torstenyoung.com
   is on Cloudflare).
2. Pages project → **Custom domains → Set up a custom domain** → `torstenyoung.com`. Cloudflare adds the DNS
   record. Repeat for `www.torstenyoung.com`.
3. Send `www` to the bare domain: **Rules → Redirect Rules → Create rule → template "Redirect from WWW to root"**,
   status 301.
4. **SSL/TLS → Edge Certificates**: turn on **Always Use HTTPS**. Turn on **HSTS** only once everything works
   over HTTPS (it's hard to undo), with max-age 6 months and no preload.

`site.yaml` already has `url: https://torstenyoung.com`, which the canonical links, legal pages and the
live-preview check use. If you ever use a different domain, change it there.

## 4. Check the launch
- Open https://torstenyoung.com and click through: home, work, a project, resume, about, legal pages.
- The photo-site project page should show the live photo site in the frame. It only does that on
  torstenyoung.com (and www), because that's what photos.torstenyoung.com allows.
- Response headers come from `public/_headers` (security headers, long caching for `/_astro/*`). Check with:
  ```bash
  curl -sI https://torstenyoung.com
  ```
- In `site.yaml`, set `legal.hosting` to `Cloudflare, Inc.` so the privacy policy names the host.

## 5. After launch
- **Updates:** every push to `main` rebuilds and deploys. Pushes to other branches get preview addresses.
- **Fresh data:** GitHub, Strava and place data only update on a build. Set up the daily rebuild in
  [scheduled-rebuilds.md](scheduled-rebuilds.md).
- **Analytics (optional):** Cloudflare Web Analytics is cookieless. Enable it in the dashboard, then set
  `analytics.provider: cloudflare` in `site.yaml`; the privacy policy updates itself.
- **Rolling back:** Pages project → **Deployments** → pick an older one → **Rollback**.

## Troubleshooting
| Problem | Fix |
| --- | --- |
| Build fails with `pnpm: command not found` or a lockfile error | Check `PNPM_VERSION` is set; the lockfile must be committed |
| Build fails on Node version | Set `NODE_VERSION` to `24` |
| `[check-secrets]` fails | A secret value ended up in the output. Find it in the log message, remove it, rotate that secret |
| Photo-site frame says "refused to connect" | You're on a `*.pages.dev` address. Use torstenyoung.com, or add the pages.dev address to the photo site's `frame-ancestors` |
| Old content after a push | Wait for the deploy to finish; hard-refresh. The `/_astro/` files are cached, but their names change with each build |
