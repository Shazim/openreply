---
name: openreply-campaign
description: Create and publish an OpenReply Instagram comment-to-DM campaign from a guide (HTML page plus PDF, or any file) and a short brief. Hosts the files on reply.orbiqon.com/files/<name> via Vercel Blob (no deploy needed), creates the campaign through OpenReply's JSON API from the logged-in Chrome tab, and verifies the tracked link. Use when the user says "/openreply-campaign", "create a campaign", "new lead magnet campaign", or hands over a guide/PDF with a keyword.
---

# OpenReply campaign from a guide + brief

Owner: Shazim (iamshazimkhan@gmail.com). Instagram: @shazimbuilds.
Repo and docs: `/Users/apple/Orbiqon/Content/openreply` (GitHub `Shazim/openreply`), see `orbiqon/HOSTING.md` and `orbiqon/AUTOMATION.md`. Keep `orbiqon/skill/SKILL.md` in that repo in sync with this file.

## Fixed facts (do not rediscover)

| Thing | Value |
|---|---|
| OpenReply app | https://reply.orbiqon.com (old alias openreply-six-plum.vercel.app still serves) |
| File hosting | Vercel Blob store `openreply-files` (`store_MtcsjRVvjKXbxPZt`), public base `https://mtcsjrvvjkxbxpzt.public.blob.vercel-storage.com`, served by the app at `https://reply.orbiqon.com/files/<pathname>` (route `app/files/[...path]/route.ts`). Extensionless path = `.html`. `.pdf` served inline. Uploads need no deploy. |
| Blob token | `BLOB_READ_WRITE_TOKEN` in `/Users/apple/Orbiqon/Content/openreply/.env.local` (gitignored; re-create with `vercel env pull .env.local --environment development` in the repo) |
| Campaign API | `POST /api/automations` (session cookie auth, run from the logged-in Chrome tab) |
| List posts | `GET /api/instagram/posts?limit=12` (id, caption, media_type, media_product_type, permalink, timestamp) |
| List / update campaigns | `GET /api/automations`, `PATCH /api/automations` with `{ id, ...fields }` |
| Google Drive (backup only) | Folder "OpenReply Files", id `1_t-DZCXqojiTW6gr987rJ8HJm_yXBZYm`, public viewer link. No longer the DM destination. |
| Meta app | OpenReply Shazim, app id 1267874919748781, Live |
| Health | https://reply.orbiqon.com/api/health must show `status: ok`, `worker.healthy: true` |

## Inputs to collect from the user (ask only for what is missing)

1. **Files**: the guide's HTML and PDF (the carousel-lab generator produces both, e.g. `.../posts/<topic>/guide/guide.html` and `guide.pdf`). HTML is the DM destination; PDF is the download. A PDF-only or external-URL campaign is fine too.
2. **Slug**: short kebab-case name for the URL, e.g. `agents-pack` -> `https://reply.orbiqon.com/files/agents-pack` and `/files/agents-pack.pdf`.
3. **Target post**: a description ("the carousel about agents", "latest reel") resolved via the posts endpoint, or `pendingNextReel: true`, or `matchAnyPost: true`.
4. **Keyword(s)**: 1 to 10 words, whole-word match. Add casing variants (e.g. `agents, AGENTS, Agents`).
5. **DM message**: 1 to 1000 chars. `{username}` is replaced. No URL in the text; the link is a button.
6. **Options** (defaults in brackets): `dmTriggerEnabled` [true], `requireFollow` [true] with `followPromptMessage` + `followPromptButtonLabel` (<=20), `publicReplyEnabled` [true] with 2-3 `publicReplyMessages`, `linkButtonLabel` [Get the guide] (<=20), `followUpEnabled` [false] + `followUpMessage` + `followUpDelayMinutes` (0-1440), `openingDmEnabled` [false], `secondaryDestinationUrl` + `secondaryButtonLabel`.

## Procedure

### 1. Prepare the hosted HTML copy

Do not edit the generator's source file. Write a copy to `orbiqon/files/<topic>/<slug>.html` in the repo and copy the PDF next to it as `<slug>.pdf`. Apply two edits to the copy:

- Insert `<meta name="robots" content="noindex, nofollow">` before the viewport meta.
- Add a download button at the end of the footer: `<a class="download" href="/files/<slug>.pdf">Download as PDF</a>` plus the CSS
  `.download { display:inline-block; margin-top:22px; padding:12px 22px; background:#C96442; color:#fff; border-radius:999px; text-decoration:none; font-weight:700; font-size:15px; }`.

Check the HTML is self-contained (inline CSS, no local image or script paths; Google Fonts links are fine).

### 2. Upload to Vercel Blob (no deploy)

```bash
cd /Users/apple/Orbiqon/Content/openreply
TOK=$(grep '^BLOB_READ_WRITE_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')
for f in <slug>.html <slug>.pdf; do
  env -u VERCEL_OIDC_TOKEN -u BLOB_STORE_ID npx -y vercel@latest blob put "orbiqon/files/<topic>/$f" \
    --rw-token "$TOK" --access public --pathname "$f" --allow-overwrite true --cache-control-max-age 300
done
```

Verify:
```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://reply.orbiqon.com/files/<slug>
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://reply.orbiqon.com/files/<slug>.pdf
```
Expect `200 text/html` and `200 application/pdf`. Replacing a file later is the same command; the page updates within 5 minutes (cache).

### 3. Resolve the post

In the OpenReply Chrome tab, `GET https://reply.orbiqon.com/api/instagram/posts?limit=12` and pick by caption/type/date. Use `id` as `postId` and `permalink` as `postUrl`. If the tab is not logged in, the user must click a magic link (email-only login, allowlisted to iamshazimkhan@gmail.com). If several Chrome browsers are connected, ask which one before acting.

### 4. Create the campaign

From the OpenReply tab (any page on reply.orbiqon.com) run:

```js
await fetch('/api/automations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  name:'<Campaign name>',
  goal:'<one line>',
  postId:'<id>', postUrl:'<permalink>',          // or pendingNextReel:true, or matchAnyPost:true
  keywords:['word','WORD','Word'], wholeWordMatch:true,
  dmTriggerEnabled:true,
  requireFollow:true,
  followPromptMessage:'Hey {username}! Follow @shazimbuilds first, then tap below 👇',
  followPromptButtonLabel:'I followed',
  dmMessage:'Here you go {username}: ... Tap below to open it 👇',
  linkButtonLabel:'Get the guide',
  trackedDestinationUrl:'https://reply.orbiqon.com/files/<slug>',
  publicReplyEnabled:true,
  publicReplyMessages:['Sent you a DM 📩','Check your DMs 👀','Just sent it over 👇'],
  isActive:true
})}).then(r=>r.json())
```

Response includes `trackedLinks[0].slug`; the DM link is `https://reply.orbiqon.com/r/<slug>`.

Validation rules: must have postId or pendingNextReel or matchAnyPost; must have keywords or matchAnyWord; opening DM needs both message and button label; button labels max 20 chars; keywords max 50 chars each, max 10.

To change the destination of an existing campaign: `PATCH /api/automations` with `{ id, trackedDestinationUrl }`.

### 5. Verify

- `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' https://reply.orbiqon.com/r/<slug>` -> `302` to the `/files/...` page.
- `GET /api/automations` shows the campaign with `isActive: true`.
- Health endpoint ok.
- Tell the user: campaign name, keywords, post, the page and PDF URLs, and that a comment from a second account that does not already follow is the real test (own comments are ignored; followers skip the follow prompt). DM Logs page shows SENT rows.

### 6. Record and push

Save the brief as `orbiqon/campaigns/briefs/<slug>.json` (template `_template.json`), then commit `orbiqon/files/<topic>/` and the brief and push to `Shazim/openreply`. No deploy is needed for files; a deploy is only needed if app code changed.

## Landing page button is automatic

The root page https://reply.orbiqon.com shows a button "Latest guide: <campaign name>" pointing at the newest **active** campaign whose destination is a `/files/<slug>` page (lib/orbiqon/latest-guide.ts, re-read every 5 minutes). So:

- The campaign `name` is public. Use a reader-facing name ("Founder Agents Pack"), not an internal one ("test 3").
- Nothing to edit or deploy when a campaign goes live; the button updates within 5 minutes.
- Pausing a campaign (`isActive:false`) makes the button fall back to the previous active one.

## Follow gate behaviour

The worker asks Instagram whether the commenter already follows the account. Followers get the link immediately; non-followers get the follow prompt and the "I followed" button re-checks. If the check is unverifiable the link is sent (fail-open).

## Debugging

- No DM after a comment: query Neon Postgres tables `WebhookEvent` (delivery), `DmLog` (send status), `OperationalEvent` (worker errors). No WebhookEvent row means Meta did not deliver: check the app is Live and the webhook callback is `https://reply.orbiqon.com/api/webhook`.
- `/files/<slug>` returns 503: `FILES_BLOB_BASE_URL` missing on Vercel. 404: pathname mismatch, run `vercel blob list --rw-token "$TOK"`.
- Worker unhealthy: Railway project OpenReply, service `worker`; `railway redeploy --service worker -y` from the repo.
- Meta: any domain change requires updating the webhook callback, adding the OAuth redirect, and updating Basic settings URLs.
