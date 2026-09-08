# Campaign automation: from a PDF and a brief to a live comment-to-DM campaign

This document explains how a new lead-magnet campaign is created without touching the OpenReply UI, how Google Drive is used for file hosting, how the Claude Code skill is built, and how an AI agent that is not Claude can do the same job. Read HOSTING.md first for where things run.

Last verified: 2026-09-08.

## 1. What "automation" means here

Two automations exist, at different layers:

1. **Runtime automation (OpenReply itself).** Once a campaign is active, Instagram comments and DMs containing the keyword trigger a DM with a link, a follow gate, and a public reply, with zero human involvement. This is the product working as designed.
2. **Setup automation (the agent workflow).** Creating a campaign is a short, repeatable sequence: host the file, find the post, call the campaign API, verify the link. The Claude Code skill `/openreply-campaign` encodes that sequence so a single message such as "here is the PDF, keyword PRICING, next reel" produces a live campaign.

## 2. How a live campaign behaves

For the campaign "Founder Agents Pack" (the first one, created 2026-09-08):

1. Someone comments `agents` (any casing; whole-word match) on the carousel https://www.instagram.com/p/Dc0b6TpCEpk/, or DMs the word to @shazimbuilds.
2. Meta posts the event to the webhook. OpenReply checks the keyword and the post, then enqueues a job.
3. Because the campaign has **require follow** on, the worker first sends the follow prompt with an "I followed" button. When the person taps it, the main DM is sent.
4. The main DM contains the message text with `{username}` replaced, plus a button labelled "Get the pack" that opens `https://reply.orbiqon.com/r/mhNkfTpf0Q`.
5. That tracked link records the click (hashed IP, timestamp) and 302-redirects to the Google Drive file.
6. A public reply ("Sent you a DM", one of three variants) is posted under the comment.
7. Everything is logged: `DmLog` rows with SENT or the Instagram error, visible on the DM Logs page.

The comment author's own account is ignored on purpose, so testing needs a second Instagram account.

## 3. Google Drive as the file host

**Why Drive.** OpenReply does not store files; a tracked link only needs a destination URL. Drive gives a stable, free, editable URL and the file can be replaced in place.

**The folder.** "OpenReply Files" in iamshazimkhan@gmail.com's My Drive.

- Folder id: `1_t-DZCXqojiTW6gr987rJ8HJm_yXBZYm`
- URL: https://drive.google.com/drive/folders/1_t-DZCXqojiTW6gr987rJ8HJm_yXBZYm
- General access: **Anyone with the link, Viewer**. Every file placed inside inherits this, so no per-file sharing step is needed.
- Destination URL pattern for a file: `https://drive.google.com/file/d/<FILE_ID>/view`. Drive shows a preview page with a download button; that is expected.
- Public check without cookies: `curl -sL "https://drive.google.com/uc?export=download&id=<FILE_ID>" | head -c 8` must print `%PDF`.

**How Drive is connected to the agent.** Two ways are available and both were used:

- *Google Drive MCP connector* (Claude.ai connector, authorised for iamshazimkhan@gmail.com). Good for creating folders, searching files, reading metadata. Its `create_file` needs base64 in the tool call, which is impractical for a 200 KB PDF, and its `share_file` can only share with a named email, not "anyone with the link".
- *Claude in Chrome* (the Chrome extension driving Shazim's logged-in browser). Used for the actual upload and for the public-sharing toggle. Drive builds its upload `<input type=file>` on the fly and clicks it, which opens a native picker an agent cannot see. The trick that works: patch `HTMLInputElement.prototype.click` to capture file inputs instead of clicking them, click New > File upload, then feed the captured input with the extension's file-upload tool and dispatch a `change` event. Exact snippet is in the skill file.

An agent without either tool can simply ask the user to drop the file into the folder and paste the file link.

## 4. The OpenReply API used for campaigns

There is no API key. Every route is authenticated by the browser session cookie of a logged-in user, so calls are made from a Chrome tab that is signed in to https://reply.orbiqon.com (login is a magic link to iamshazimkhan@gmail.com). From that tab, `fetch('/api/...')` carries the cookie automatically.

| Route | Purpose |
|---|---|
| `GET /api/instagram/posts?limit=12` | Recent posts and reels: `id`, `caption`, `media_type` (VIDEO, CAROUSEL_ALBUM, IMAGE), `media_product_type` (REELS, FEED), `permalink`, `timestamp`. Used to resolve "the carousel about X" to a `postId`. |
| `GET /api/automations` | List campaigns. |
| `POST /api/automations` | Create a campaign. Body below. Returns the campaign including `trackedLinks[0].slug`. |
| `PATCH /api/automations` | Update: `{ id, ...fields }`. Use to pause (`isActive:false`), change the file URL, edit copy. |
| `DELETE /api/automations` | Delete. |
| `GET /api/health` | Sanity check before and after. |

Create body (fields and limits, from `app/api/automations/route.ts`):

```json
{
  "name": "string, 1-100",
  "goal": "string, <=120, optional",
  "postId": "Instagram media id",            // or "pendingNextReel": true, or "matchAnyPost": true
  "postUrl": "permalink, optional",
  "keywords": ["up to 10, each <=50"],        // or "matchAnyWord": true
  "wholeWordMatch": true,
  "dmTriggerEnabled": true,                    // also fire on DMs containing a keyword
  "dmMessage": "1-1000 chars, {username} allowed",
  "linkButtonLabel": "<=20 chars",
  "trackedDestinationUrl": "https://...",      // "" for no link
  "secondaryDestinationUrl": "https://...", "secondaryButtonLabel": "<=20",
  "requireFollow": true,
  "followPromptMessage": "<=1000", "followPromptButtonLabel": "<=20",
  "openingDmEnabled": false, "openingDmMessage": "<=1000", "openingDmButtonLabel": "<=64",
  "followUpEnabled": false, "followUpMessage": "<=1000", "followUpDelayMinutes": 0,   // 0-1440
  "publicReplyEnabled": true,
  "publicReplyMessages": ["up to 10, each <=1000"],   // one picked at random per reply
  "isActive": true
}
```

Rejections to expect: no post target, no keywords without `matchAnyWord`, opening DM without both message and button label, labels over 20 characters.

## 5. The Claude Code skill

File: `~/.claude/skills/openreply-campaign/SKILL.md` on Shazim's Mac. A copy is kept in this repo at `orbiqon/skill/SKILL.md`; if the home copy is lost, copy it back:

```bash
mkdir -p ~/.claude/skills/openreply-campaign && cp orbiqon/skill/SKILL.md ~/.claude/skills/openreply-campaign/SKILL.md
```

How it is built:

- YAML front matter with `name` and a `description` that lists trigger phrases. Claude Code reads the description to decide when to load the skill; the user can also type `/openreply-campaign` directly.
- A **fixed facts** table so the agent never rediscovers URLs, ids, or the Drive folder.
- An **inputs** list with defaults, so the agent asks only for what is missing.
- A **procedure** with the exact JS snippets for the Drive upload capture and the API call.
- A **verify** step and a **record the brief** step.
- A **debugging** section pointing at the Postgres tables.

Briefs: every campaign is saved as JSON in `orbiqon/campaigns/briefs/<slug>.json` (template `_template.json`). A brief is the human-readable source of a campaign and can be edited and re-sent to the agent to clone or update a campaign.

## 6. Running it with a different AI agent (Codex, Cursor, a human)

The skill is plain Markdown; any agent can follow it. Minimum requirements:

1. A browser session logged in to https://reply.orbiqon.com as iamshazimkhan@gmail.com, and a way to run `fetch` in that tab (DevTools console works for a human).
2. A way to put the file in the Drive folder (drag and drop in the browser is fine) and to read the file id from its share link.
3. The procedure in `orbiqon/skill/SKILL.md`.

Manual fallback without any agent: upload the PDF to the Drive folder, copy its link, and create the campaign in the OpenReply dashboard at Campaigns > New. All fields in the API map one-to-one to the form.

## 7. Example brief and the resulting campaign

Input given by Shazim: the PDF `guide.pdf`, "the carousel I added", keyword "Agents", reply to DMs too, follower restriction, then the DM message.

What the agent did:

1. Created the Drive folder and uploaded `guide.pdf` -> file id `1x1Iv5q5lMma2M6Ur9hBLTOD9sO7A2aXZ`; set folder to Anyone with the link.
2. Listed posts, matched the caption "Most founders use claude like a chatbot..." (CAROUSEL_ALBUM) -> `postId 18121609250294069`.
3. POSTed the campaign with keywords `agents, AGENTS, Agents`, DM trigger on, follow gate on, button "Get the pack", three public replies.
4. Verified `https://reply.orbiqon.com/r/mhNkfTpf0Q` returns 302 to the Drive file, and the file is publicly downloadable.
5. Saved `orbiqon/campaigns/briefs/founder-agents-pack.json`.

Elapsed: about three minutes of agent time.

## 8. Extending

- **Attach to the next reel automatically**: send `pendingNextReel: true` instead of a `postId`; the 06:00 UTC Vercel cron attaches it to the newest reel.
- **One keyword across all posts**: `matchAnyPost: true`.
- **Follow-up nudge**: `followUpEnabled: true`, `followUpMessage`, `followUpDelayMinutes` up to 1440.
- **Second button**: `secondaryDestinationUrl` + `secondaryButtonLabel`, for example a booking link.
- **Direct file links instead of Drive preview**: put the PDF in the repo's `public/files/` and deploy; the URL `https://reply.orbiqon.com/files/<name>.pdf` opens the PDF immediately. Trade-off: files are tied to git commits.
