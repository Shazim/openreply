# OpenReply hosting: where everything lives and how it is managed

This is the operator's reference for Shazim's self-hosted OpenReply instance. It is written so that a person or an AI agent with no prior context can take over. No secrets are in this file; every secret is named and its storage location is given.

Last verified: 2026-09-08.

## 1. What the system is

OpenReply is an open-source Instagram comment-to-DM tool (upstream: github.com/diwenne/openreply). When someone comments a keyword on a chosen post, Meta sends a webhook, OpenReply queues a job, and a worker sends the commenter a DM with a link. It also supports keyword DMs, follow gates, public replies, follow-up messages, and click tracking.

It runs as two processes and two datastores:

| Piece | What it does | Must be always on |
|---|---|---|
| Web app (Next.js) | Dashboard, login, OAuth callback, incoming Meta webhook, tracked-link redirects, cron endpoints | Yes, serverless |
| Worker (Node, BullMQ consumer) | Takes queued DM jobs and sends them via the Instagram API; polls for missed comments every 5 min; writes a heartbeat | Yes, long-running |
| PostgreSQL | Campaigns, accounts, encrypted tokens, DM logs, webhook events | Yes |
| Redis | The BullMQ queue and per-account rate limiter | Yes |

The web app and worker must share the same `DATABASE_URL`, `REDIS_URL`, and `ENCRYPTION_KEY`. The web app encrypts Instagram tokens; the worker decrypts them. If the keys ever differ, every DM send fails to decrypt.

## 2. The map

```
Instagram user comments "agents"
        |
        v
Meta webhook  --POST-->  https://reply.orbiqon.com/api/webhook   (Vercel)
                                   |
                                   | enqueue job
                                   v
                          Redis (Railway, internal + TCP proxy)
                                   |
                                   v
                          worker (Railway)  --sends DM-->  Instagram Graph API
                                   |
                                   v
                          Postgres (Neon): DmLog, WebhookEvent, TrackedLink...

Commenter taps DM button --> https://reply.orbiqon.com/r/<slug> --302--> Google Drive file
```

## 3. Accounts and providers

| Provider | Account | What it holds | Cost |
|---|---|---|---|
| GitHub | github.com/Shazim | Fork `Shazim/openreply` (source of truth for code + these docs) | Free |
| Vercel | iamshazimkhan@gmail.com, team "iamshazimkhangmailcom's projects" | Web app project `openreply` | Free (Hobby) |
| Railway | iamshazimkhan@gmail.com, workspace "Orbiqon's Projects" | Project `OpenReply`: services `worker` and `Redis` | Hobby plan, $5/mo flat with $5 usage credit shared with the ResubAI project |
| Neon | Muhammad Shazim org (`org-royal-field-41599817`) | Postgres project `openreply` | Free |
| Resend | orbiqon.com verified | Login magic-link emails from info@orbiqon.com | Free |
| Meta for Developers | Shazim's Facebook account | App "OpenReply Shazim", id 1267874919748781 | Free |
| Instagram | @shazimbuilds (Business account) | The connected account | Free |
| Google Drive | iamshazimkhan@gmail.com | Folder "OpenReply Files" hosting lead-magnet PDFs | Free |
| DNS for orbiqon.com | wherever orbiqon.com is registered | CNAME `reply` -> Vercel | n/a |

## 4. Domains and URLs

| URL | Purpose |
|---|---|
| https://reply.orbiqon.com | Primary public URL. `NEXTAUTH_URL` on both Vercel and Railway. |
| https://openreply-six-plum.vercel.app | Vercel's own alias. Still serves the app. Old tracked links use it. |
| https://reply.orbiqon.com/api/health | Health: database, redis, queue, worker heartbeat. Must return `status: ok`. |
| https://reply.orbiqon.com/api/webhook | Meta webhook callback (registered in the Meta app). |
| https://reply.orbiqon.com/api/instagram/callback | OAuth redirect (registered in the Meta app). |
| https://reply.orbiqon.com/privacy, /terms, /data-deletion | Policy pages Meta requires. Shipped by the app. |
| https://reply.orbiqon.com/r/<slug> | Tracked link redirect used in DMs. |
| https://reply.orbiqon.com/files/<slug> and /files/<slug>.pdf | Hosted guide page and its PDF, served from Vercel Blob (section 5a). |

Changing the primary domain again requires: Vercel domain, DNS, `NEXTAUTH_URL` on Vercel and Railway, Meta webhook callback re-verify, Meta OAuth redirect (add, keep old), Meta Basic settings app domain and policy URLs. Meta does not follow redirects, so a stale callback URL silently kills webhooks.

## 5. Vercel (web app)

- Project: `openreply` in team `team_oZSNNltkYlkmJwkvdzKqw5uW`, project id `prj_q44uCN6j4XzocExFvwanwlyoMuHK`.
- Framework: Next.js. Node 24. Build uses the repo's `vercel-build` script: `prisma generate && prisma migrate deploy && next build`. So every production deploy also applies pending Prisma migrations to Neon.
- Crons (from `vercel.json`, daily because the free plan allows one run per day per cron):
  - 05:00 UTC `/api/cron/refresh-tokens` renews Instagram long-lived tokens (60-day expiry) so connections never lapse.
  - 06:00 UTC `/api/cron/attach-next-reel` attaches "next reel" campaigns to the newest reel.
  - 07:00 UTC `/api/cron/snapshot-followers` follower count snapshots.
  - Vercel calls these with `Authorization: Bearer $CRON_SECRET`. Calling without the secret returns 401.
- Deploys are **manual from the local clone** (the GitHub integration was not connected). From the repo root:
  ```bash
  npx -y vercel@latest --prod --yes
  ```
  Use the latest CLI. The globally installed 53.x CLI rewrote `vercel.json` with an unsupported `experimentalServices` block during linking; if a deploy fails with that message, `git checkout -- vercel.json`.
- Environment variables (Production, all marked sensitive so `vercel env pull` returns them empty; edit in the dashboard or with `printf '%s' VALUE | vercel env add NAME production --force`):

| Variable | Value / where it comes from |
|---|---|
| `NEXTAUTH_URL` | `https://reply.orbiqon.com` |
| `NEXTAUTH_SECRET` | random, generated during setup |
| `CRON_SECRET` | random, generated during setup |
| `ENCRYPTION_KEY` | 64 hex chars, generated during setup. Identical on Railway. Losing it means every Instagram account must reconnect. |
| `DATABASE_URL` | Neon direct (unpooled) connection string, `sslmode=require` |
| `REDIS_URL` | Railway Redis **public** TCP proxy URL (`redis://default:...@altaria.proxy.rlwy.net:52363`). Vercel cannot reach Railway's internal hostnames. |
| `RESEND_API_KEY` | From resend.com |
| `EMAIL_FROM` | `OpenReply <info@orbiqon.com>` |
| `ALLOWED_EMAILS` | `iamshazimkhan@gmail.com` (only this address can sign in) |
| `META_GRAPH_API_VERSION` | `v25.0` |
| `INSTAGRAM_APP_ID` | `1093931093604287` (Meta app > Instagram product > API setup with Instagram login) |
| `INSTAGRAM_APP_SECRET` | Same page, click Show |
| `FACEBOOK_APP_SECRET` | Meta app > App settings > Basic > App secret (requires Facebook password to reveal) |
| `WEBHOOK_VERIFY_TOKEN` | random; the same string is saved in the Meta webhook config |
| `FILES_BLOB_BASE_URL` | `https://mtcsjrvvjkxbxpzt.public.blob.vercel-storage.com` (public base of the Blob store, used by the `/files` route; Orbiqon-specific, not upstream) |

## 5a. Vercel Blob (lead-magnet file hosting)

Guides sent in DMs are hosted as files on the app's own domain, with no deploy per file.

- Store: `openreply-files`, id `store_MtcsjRVvjKXbxPZt`, region iad1, public access, linked to the `openreply` project (Vercel dashboard > Storage). Free Hobby quota covers many gigabytes; guides are kilobytes.
- Public base URL: `https://mtcsjrvvjkxbxpzt.public.blob.vercel-storage.com/<pathname>`. Do not send this URL to people; send the app URL below.
- App route: `app/files/[...path]/route.ts` (Orbiqon addition, not upstream). It proxies `https://reply.orbiqon.com/files/<pathname>` to the store. An extensionless path is served as `<pathname>.html`; `.pdf` is served inline; every response has `X-Robots-Tag: noindex` and a 5-minute cache. Unknown files return 404; a missing `FILES_BLOB_BASE_URL` returns 503.
- Convention: each guide is an HTML page plus a PDF with the same slug: `/files/<slug>` (page, the DM destination) and `/files/<slug>.pdf` (download button on the page). Hosted copies are committed under `orbiqon/files/<topic>/` as the record; the store is what serves them.
- Uploading (from the repo; token lives in the gitignored `.env.local`, re-create with `vercel env pull .env.local --environment development`):
  ```bash
  TOK=$(grep '^BLOB_READ_WRITE_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')
  env -u VERCEL_OIDC_TOKEN -u BLOB_STORE_ID npx -y vercel@latest blob put orbiqon/files/<topic>/<slug>.html \
    --rw-token "$TOK" --access public --pathname <slug>.html --allow-overwrite true --cache-control-max-age 300
  ```
  Same for the PDF. `vercel blob list --rw-token "$TOK"` lists files, `vercel blob del <pathname> --rw-token "$TOK"` removes one.
- Replacing a file is the same `put` with `--allow-overwrite true`; links already sent show the new version within five minutes.

## 6. Railway (worker + Redis)

- Workspace "Orbiqon's Projects", project `OpenReply` (id `f509efec-d429-4229-a080-b223bea42e31`), environment `production` (id `ef5358a5-70e2-420e-abda-bff65be6d6a7`).
- Service `worker` (id `f043dc7e-e889-494b-a08b-8d6e2b2b769d`):
  - Built from the repo's **Dockerfile** (Railway prefers a Dockerfile when one exists). `railway.json` in the repo declares `builder: DOCKERFILE` and `startCommand: npm run worker`; the same start command is also set on the service in Railway so the image's default `next start` is overridden.
  - Source is **not** linked to GitHub (Railway refused the repo link from the CLI). Deploy from the local clone:
    ```bash
    cd /Users/apple/Orbiqon/Content/openreply
    railway up --service worker --detach
    ```
    A variable change alone does not redeploy this service. After changing a variable run `railway redeploy --service worker -y`.
  - Variables: the same set as Vercel except `REDIS_URL` is the Railway reference `${{Redis.REDIS_URL}}` (internal host `redis.railway.internal`, free of egress) and `NODE_ENV=production`.
  - `COMMENT_POLL_INTERVAL_MS=1800000` (30 min, set 2026-10-28). The upstream default of 5 min queried Neon so often that compute never suspended and used up the free plan's monthly CU-hours, which took the database down on 2026-10-28. Do not lower it.
  - Restart policy: on failure, max 10 retries.
- Service `Redis` (id `7ac866c8-3c80-435e-acd7-57843cb6ee20`): Railway's Redis template, image `redis:8.2`, with a volume. A TCP proxy (`altaria.proxy.rlwy.net:52363`, id `3186ff66-...`) was created through Railway's GraphQL API so Vercel can reach it. Password is in the service's `REDISPASSWORD` variable.
- CLI: `railway` 4.x is logged in as iamshazimkhan@gmail.com. The local clone is linked to this project/service; re-link with
  `railway link -w "Orbiqon's Projects" -p OpenReply -e production -s worker` if the folder moves.
- Cost: worker + Redis together run roughly $2/month of the $5 credit. The ResubAI project in the same workspace uses the rest. Keep other services off Railway.

## 7. Neon (PostgreSQL)

- Plan: **Launch** (pay per use, billed monthly in arrears) since 2026-10-28, after the Free plan's 100 CU-hours/month ran out. With the 30-minute poll the database suspends between sweeps; moving back to Free is an option once a month's usage is confirmed well under 100 CU-hours.
- Project `openreply`, id `delicate-forest-69537865`, region `aws-us-east-1`, Postgres 18, default database `neondb`, role `neondb_owner`. Compute autosuspends when idle; that is fine for this workload.
- Both direct and pooled hosts exist. The app uses the **direct** host (`ep-rapid-tooth-auymru63.c-10.us-east-1.aws.neon.tech`). Prisma migrations need the direct host.
- Migrations: applied automatically on every Vercel production deploy. To run by hand:
  ```bash
  DATABASE_URL="<neon direct url>" npm run db:migrate
  ```
- CLI: `npx -y neonctl` is authenticated via browser OAuth; pass `--org-id org-royal-field-41599817`.
- The password was printed during setup and should be rotated in the Neon console (Roles > reset password), then updated on Vercel and Railway.
- Useful tables when debugging: `WebhookEvent` (did Meta deliver), `DmLog` (send status and Instagram errors), `OperationalEvent` (worker crashes, poll sweeps), `TrackedLink` and `LinkClick` (link analytics).

## 8. Resend (login email)

Login is magic-link only. Auth.js provider id is `resend`. Domain orbiqon.com is verified in Resend; sender is info@orbiqon.com. The API key pasted during setup should be rotated: create a new key in Resend, set `RESEND_API_KEY` on Vercel and Railway, redeploy Vercel.

## 9. Meta app

- App: **OpenReply Shazim**, Business type, id `1267874919748781`, status **Live** (published 2026-09-08). Use case: "Manage messaging and content on Instagram" (Instagram Login flow, not Facebook Login).
- Permissions with Standard Access: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`. Standard Access covers only accounts with a role on the app. No App Review was done; adding another Instagram account means inviting it as an Instagram Tester and accepting the invite inside the Instagram app (Settings > Apps and websites > Tester invites).
- Instagram product > API setup with Instagram login:
  - Instagram app ID `1093931093604287`; the secret is on the same page.
  - Webhook callback `https://reply.orbiqon.com/api/webhook`, verify token = `WEBHOOK_VERIFY_TOKEN`. Subscribed fields include `comments` and `messages` (both required).
  - Business login settings: OAuth redirect URIs `https://reply.orbiqon.com/api/instagram/callback` and the old `https://openreply-six-plum.vercel.app/api/instagram/callback`. Data deletion URL `https://reply.orbiqon.com/data-deletion`.
- App settings > Basic: app domain `reply.orbiqon.com`; privacy, terms, data-deletion URLs on that domain; category Business and pages; contact iamshazimkhan@gmail.com. The Facebook App secret lives here (Show requires the Facebook password).
- App roles: @shazimbuilds is an Instagram Tester (accepted).
- Tokens: each connected account gets a 60-day long-lived token, stored encrypted in Postgres and refreshed daily by the Vercel cron.

## 9a. Orbiqon changes to the upstream code

The fork carries a few deliberate deviations from upstream OpenReply. Keep this list current so upstream merges are reviewed with them in mind.

| Change | Files | Why |
|---|---|---|
| Branded one-section landing page | `app/page.tsx` (one-line render), `components/orbiqon-landing.tsx`, `lib/orbiqon/latest-guide.ts` | Upstream's root is a product marketing page for OpenReply; this domain is @shazimbuilds' own. The "Latest guide" button is read from the database (newest active **@shazimbuilds** campaign pointing at `/files/<slug>`, label = campaign name, cached 5 min), so new campaigns update the site with no deploy. Campaigns of other connected accounts (@orbiqon) never appear there. |
| Site title and description | `app/layout.tsx` metadata | Browser tab and share previews say shazimbuilds, not "Open source Instagram comment-to-DM automation". |
| Removed upstream SEO pages | deleted `app/manychat-alternative`, `app/comment-link-automation`, `app/instagram-comment-to-dm-templates`, `app/instagram-dm-automation-agencies`, `app/templates`, `lib/seo-pages.ts`, `components/seo-page-shell.tsx`, `components/public-site-header.tsx` | So nothing ranks under reply.orbiqon.com except what we choose. Privacy, terms, data-deletion and meta-review pages are kept for Meta. |
| File hosting route | `app/files/[...path]/route.ts`, `railway.json` | Serves guides from Vercel Blob on our domain (section 5a); Railway config for the worker. |

When merging upstream (`git fetch upstream && git merge upstream/main`): expect conflicts on `app/page.tsx` and `app/layout.tsx` (keep ours), and re-delete any SEO page upstream re-adds. Nothing else should collide.

## 10. Local development clone

- Path: `/Users/apple/Orbiqon/Content/openreply` (moved from Downloads on 2026-09-08).
- Remotes: `origin` = git@github.com:Shazim/openreply.git (push here), `upstream` = git@github.com:diwenne/openreply.git (pull updates with `git fetch upstream && git merge upstream/main`).
- `.vercel/project.json` (gitignored) links the folder to the Vercel project. Railway link is stored in `~/.railway/config.json` keyed by folder path.
- `npm ci` then `npm run dev` for the web app and `npm run worker` for the worker; local Postgres/Redis via `docker-compose up -d`. See upstream `docs/setup.md`.

## 11. Routine operations

| Task | Command / place |
|---|---|
| Check everything is up | `curl https://reply.orbiqon.com/api/health` |
| Deploy web app | `npx -y vercel@latest --prod --yes` in the repo |
| Deploy worker | `railway up --service worker --detach` in the repo |
| Restart worker after a variable change | `railway redeploy --service worker -y` |
| Change a Vercel variable | `printf '%s' VALUE \| vercel env add NAME production --force`, then deploy |
| Change a Railway variable | `railway variables --service worker --set "NAME=VALUE"`, then redeploy |
| Worker logs | `railway logs --service worker` |
| Vercel logs | Vercel dashboard > project > Logs |
| Force a token refresh | `curl -H "Authorization: Bearer $CRON_SECRET" https://reply.orbiqon.com/api/cron/refresh-tokens` |
| Publish or replace a guide file (no deploy) | `vercel blob put <file> --rw-token "$TOK" --access public --pathname <slug>.html --allow-overwrite true` (section 5a) |
| Pull upstream code updates | `git fetch upstream && git merge upstream/main`, then deploy both |

## 12. Failure playbook

- **Health shows `worker.healthy: false`**: worker is down or cannot reach Redis. `railway logs --service worker`; if it is running `next start` instead of the worker, the start command override was lost; set it to `npm run worker` in the service settings and redeploy.
- **Comment does nothing, no `WebhookEvent` row**: Meta did not deliver. Check the app is Live, the callback URL matches the primary domain exactly, and `comments` is subscribed. Use the Test button in the Meta webhook config to send a sample.
- **`WebhookEvent` row exists, no `DmLog` row**: queue or worker issue; check Redis reachable from Vercel (health) and worker heartbeat.
- **`DmLog` row with an Instagram error `Unsupported request ... code=100`**: the commenting/connected account has no role on the app. Add it as an Instagram Tester and accept the invite.
- **Login email never arrives**: Resend key or sender domain problem; the sign-in POST redirecting to `/api/auth/verify-request` means Resend accepted the request, `error=EmailSignin` means it did not.
- **"Insufficient Developer Role" on Connect Instagram**: tester invite not accepted in the Instagram app.
- **Every DM fails to decrypt**: `ENCRYPTION_KEY` differs between Vercel and Railway.

## 13. Secrets inventory (names only)

Generated at setup and stored only in Vercel/Railway variables: `NEXTAUTH_SECRET`, `CRON_SECRET`, `ENCRYPTION_KEY`, `WEBHOOK_VERIFY_TOKEN`. Provider-issued: Neon password (inside `DATABASE_URL`), Railway `REDISPASSWORD`, `RESEND_API_KEY`, `INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_SECRET`. If any is lost, read it from the Vercel dashboard (Settings > Environment Variables > reveal) or Railway (service > Variables); `ENCRYPTION_KEY` in particular must never be regenerated without reconnecting every account.
