# Weekly reminder email

A small Cloudflare Worker (`workers/reminders/`) emails you every Monday at 9:00 (Kingston time) with:

- **This week's reminders** from `workers/reminders/src/reminders.js`: some every week, some every other week,
  some on the first Monday of the month. Edit the list freely.
- **Anything stale**, read from the live site's `/status.json`: an old Strava import, Listening not updated in
  a while, or a site that hasn't rebuilt in days (a sign the daily rebuild broke).

It sends through Cloudflare Email Routing, which is free and can only deliver to addresses you've verified.
The worker has no public URL, and your address is stored as an encrypted secret, never in the repo.

## Before you start
- torstenyoung.com is on Cloudflare (it is once the site is launched: [deploy-cloudflare.md](deploy-cloudflare.md)).
- **Check where contact@torstenyoung.com is delivered today.** Turning on Email Routing points the domain's
  incoming mail (MX records) at Cloudflare. If your address already works through another provider (Google
  Workspace, Zoho, iCloud…), don't enable Email Routing on top of it; ask and we'll use a different sender.
  If it isn't set up anywhere yet, Email Routing is also the easiest way to make contact@ forward to your inbox.

## 1. Turn on Email Routing (once)
1. Cloudflare dashboard → your domain → **Email → Email Routing → Get started / Enable**. Accept the DNS
   records it adds.
2. **Destination addresses → Add**: the inbox you want reminders in (e.g. your Gmail). Click the link in the
   verification email Cloudflare sends.
3. Optional, while you're here: **Routing rules → Create address** `contact@torstenyoung.com` → forward to that
   same inbox, so the address on the site actually reaches you.

## 2. Deploy the worker
From the project folder (Wrangler is Cloudflare's command-line tool; `pnpm dlx` runs it without installing):

```bash
cd workers/reminders
```
```bash
pnpm dlx wrangler@4 login
```
```bash
pnpm dlx wrangler@4 secret put REMIND_TO
```
Type the verified address from step 1 when asked. Then:
```bash
pnpm dlx wrangler@4 deploy
```

The worker appears under **Workers & Pages** as `site-reminders`, with a "Cron" trigger for Mondays.

## 3. Test it
Dashboard → **Workers & Pages → site-reminders → Settings → Trigger events**, or run it locally:

```bash
pnpm dlx wrangler@4 dev --test-scheduled
```
Then in a second terminal:
```bash
curl "http://localhost:8787/__scheduled?cron=0+13+*+*+1"
```
Locally the email isn't really sent; Wrangler prints it instead. To get a real one, deploy and wait for Monday,
or temporarily change the cron in `wrangler.jsonc` to a few minutes from now (in UTC) and redeploy.

## Changing things
| To change | Edit, then `pnpm dlx wrangler@4 deploy` |
| --- | --- |
| The reminders | `src/reminders.js` → `REMINDERS` |
| When stale warnings kick in | `src/reminders.js` → `STALE_AFTER` (days) |
| Day or time | `wrangler.jsonc` → `triggers.crons` (UTC) |
| Recipient | `pnpm dlx wrangler@4 secret put REMIND_TO` (must be a verified destination) |
| Sender address | `wrangler.jsonc` → `vars.FROM` (any address @torstenyoung.com) |

To stop the emails: dashboard → site-reminders → **Settings → Trigger events → delete the cron**, or delete
the worker.
