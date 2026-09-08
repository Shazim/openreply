---
name: openreply-campaign
description: Create and publish an OpenReply Instagram comment-to-DM campaign from a PDF (or any file) plus a short brief. Uploads the file to the "OpenReply Files" Google Drive folder, makes it public, creates the campaign through OpenReply's JSON API from the logged-in Chrome tab, and verifies the tracked link. Use when the user says "/openreply-campaign", "create a campaign", "new lead magnet campaign", or hands over a PDF with a keyword.
---

# OpenReply campaign from a file + brief

Owner: Shazim (iamshazimkhan@gmail.com). Instagram: @shazimbuilds.

## Fixed facts (do not rediscover)

| Thing | Value |
|---|---|
| OpenReply app | https://reply.orbiqon.com (old alias openreply-six-plum.vercel.app still serves) |
| Campaign API | `POST /api/automations` (session cookie auth, run from the logged-in Chrome tab) |
| List posts | `GET /api/instagram/posts?limit=12` (returns id, caption, media_type, permalink, timestamp) |
| List campaigns | `GET /api/automations` |
| Update campaign | `PATCH /api/automations` with `{ id, ...fields }` |
| Drive folder | "OpenReply Files", id `1_t-DZCXqojiTW6gr987rJ8HJm_yXBZYm`, shared as Anyone with the link (Viewer). Files placed inside inherit public access. |
| Meta app | OpenReply Shazim, app id 1267874919748781, Live |
| Health | https://reply.orbiqon.com/api/health must show `status: ok`, `worker.healthy: true` |

## Inputs to collect from the user (ask only for what is missing)

1. **File**: local path to the PDF or asset. Optional if the campaign links to an external URL.
2. **Target post**: one of
   - a description ("the carousel about agents", "latest reel") -> resolve via the posts endpoint by caption/date/media_type
   - `pendingNextReel: true` ("attach to my next reel")
   - `matchAnyPost: true`
3. **Keyword(s)**: 1 to 10 words. Matching is whole-word. Add the casing variants the user is likely to see (e.g. `agents, AGENTS, Agents`).
4. **DM message**: 1 to 1000 chars. `{username}` is replaced with the commenter's name. Do not put the URL in the text; the link is delivered as a button.
5. **Options** (defaults in brackets):
   - `dmTriggerEnabled` [true]: also fire when someone DMs the keyword
   - `requireFollow` [true] with `followPromptMessage` and `followPromptButtonLabel` (max 20 chars)
   - `publicReplyEnabled` [true] with 2-3 `publicReplyMessages` (picked at random)
   - `linkButtonLabel` [Get the guide] (max 20 chars)
   - `followUpEnabled` [false], `followUpMessage`, `followUpDelayMinutes` (0-1440)
   - `openingDmEnabled` [false] with `openingDmMessage` + `openingDmButtonLabel`
   - `secondaryDestinationUrl` + `secondaryButtonLabel` for a second button

## Procedure

### 1. Host the file in Drive

The Drive MCP `create_file` needs base64 in the tool call, which is too large for PDFs. Use the Chrome upload trick instead:

1. Open a Chrome tab at `https://drive.google.com/drive/folders/1_t-DZCXqojiTW6gr987rJ8HJm_yXBZYm`.
2. Run this JS to capture Drive's hidden upload input instead of opening the native picker:
   ```js
   window.__capturedInputs=[]; const orig=HTMLInputElement.prototype.click;
   HTMLInputElement.prototype.click=function(){ if(this.type==='file'){ window.__capturedInputs.push(this);
     this.setAttribute('aria-label','captured-drive-upload-'+window.__capturedInputs.length);
     this.style.cssText='display:block;position:fixed;top:0;left:0;z-index:99999;width:320px;height:40px;opacity:1;background:#fff'; return; }
     return orig.apply(this,arguments); }; 'patched'
   ```
3. Click **New** (top-left) then **File upload**. Then `find` "captured-drive-upload file input" to get its ref.
4. `file_upload` with that ref and the local path.
5. Dispatch the change event: `const i=window.__capturedInputs[0]; i.dispatchEvent(new Event('change',{bubbles:true}));`
6. Wait ~10s for "1 upload complete", then `search_files` with `parentId = '1_t-DZCXqojiTW6gr987rJ8HJm_yXBZYm'` to get the file id.
7. Destination URL: `https://drive.google.com/file/d/<FILE_ID>/view`. Verify publicly with
   `curl -sL "https://drive.google.com/uc?export=download&id=<FILE_ID>" | head -c 8` -> must start with `%PDF`.

If the folder ever loses public sharing: folder name dropdown -> Share -> Share -> General access -> Anyone with the link -> Done.

### 2. Resolve the post

In the OpenReply Chrome tab, `GET https://reply.orbiqon.com/api/instagram/posts?limit=12` and pick by caption. Use its `id` as `postId` and `permalink` as `postUrl`. If the tab is not logged in, the user must click a magic link (login is email-only, allowlisted to iamshazimkhan@gmail.com).

### 3. Create the campaign

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
  trackedDestinationUrl:'https://drive.google.com/file/d/<FILE_ID>/view',
  publicReplyEnabled:true,
  publicReplyMessages:['Sent you a DM 📩','Check your DMs 👀','Just sent it over 👇'],
  isActive:true
})}).then(r=>r.json())
```

Response includes `trackedLinks[0].slug`. The DM link is `https://reply.orbiqon.com/r/<slug>`.

Validation rules that reject a payload: must have postId or pendingNextReel or matchAnyPost; must have keywords or matchAnyWord; opening DM needs both message and button label; button labels max 20 chars; keywords max 50 chars each, max 10.

### 4. Verify

- `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' https://reply.orbiqon.com/r/<slug>` -> `302` to the file URL.
- `GET /api/automations` shows the campaign with `isActive: true`.
- Health endpoint ok.
- Tell the user: campaign name, keyword(s), post, link, and that a comment from a second account is the real test (own comments are ignored). DM Logs page shows SENT rows.

### 5. Record the brief

Append the brief as a JSON file under `/Users/apple/Orbiqon/Content/openreply/orbiqon/campaigns/briefs/<slug>.json` (template `_template.json` there), then commit and push it to `Shazim/openreply` so the record survives the machine. Full operator docs: `orbiqon/HOSTING.md` and `orbiqon/AUTOMATION.md` in that repo. Keep `orbiqon/skill/SKILL.md` in the repo in sync with this file.

## Debugging

- No DM after a comment: query Postgres (Neon, `DATABASE_URL` in the Vercel project) tables `WebhookEvent` (delivery), `DmLog` (send status), `OperationalEvent` (worker errors). No WebhookEvent row means Meta did not deliver: check the app is Live and the webhook callback is `https://reply.orbiqon.com/api/webhook`.
- Worker unhealthy: Railway project OpenReply, service `worker`; redeploy with `railway redeploy --service worker -y` from `/Users/apple/Orbiqon/Content/openreply`.
- Meta: any domain change requires updating the webhook callback, adding the OAuth redirect, and updating Basic settings URLs.
