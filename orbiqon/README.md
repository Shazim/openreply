# Shazim's OpenReply: start here

This folder documents Shazim's self-hosted instance of OpenReply, the open-source Instagram comment-to-DM tool, running at **https://reply.orbiqon.com** for the account **@shazimbuilds**. It exists so that anyone, including a fresh AI agent session in Claude Code, Codex, Cursor, or a human, can operate the system without prior context.

Everything in this folder is Orbiqon-specific and lives alongside the upstream code in this fork (`Shazim/openreply`). The upstream project's own docs are in `../docs/` and `../README.md`.

## Read in this order

| Document | What it answers |
|---|---|
| [HOSTING.md](HOSTING.md) | Where every piece runs (Vercel, Railway, Neon, Resend, Meta, Drive), every id and URL, every variable name and where its secret is stored, how to deploy, and what to do when something breaks. |
| [AUTOMATION.md](AUTOMATION.md) | How a campaign works end to end, how Google Drive hosts the files, the campaign API, how the Claude Code skill is built, and how to run the same workflow from another agent or by hand. |
| [skill/SKILL.md](skill/SKILL.md) | The executable playbook. Copy to `~/.claude/skills/openreply-campaign/SKILL.md` to enable `/openreply-campaign` in Claude Code. |
| [campaigns/briefs/](campaigns/briefs/) | One JSON per campaign plus `_template.json`. Edit and hand to the agent to clone or change a campaign. |

## The system in one paragraph

Instagram sends a webhook to the Next.js web app on Vercel when someone comments a keyword. The app queues a job in Redis on Railway. A worker on Railway sends the DM through the Instagram API, using tokens stored encrypted in a Neon Postgres database. DM buttons point at tracked links on reply.orbiqon.com that redirect to files in the "OpenReply Files" Google Drive folder. Login is a magic link from Resend, limited to iamshazimkhan@gmail.com. The Meta app "OpenReply Shazim" is Live with Standard Access, which covers Shazim's own tester accounts and needs no App Review.

## Quick health check

```bash
curl -s https://reply.orbiqon.com/api/health
```

Expect `"status":"ok"` and `"worker":{"healthy":true,...}`.

## Quick start for a new agent session

1. Read HOSTING.md sections 3 to 6.
2. Confirm health (above).
3. To create a campaign: follow `skill/SKILL.md`. You need a browser logged in to reply.orbiqon.com and access to the Drive folder.
4. To deploy code: `npx -y vercel@latest --prod --yes` for the web app, `railway up --service worker --detach` for the worker, both from the repo root.

## Prompt to paste into a new AI session

```
You are taking over operation of my self-hosted OpenReply instance (Instagram
comment-to-DM automation). The repository is github.com/Shazim/openreply, local
clone at /Users/apple/Orbiqon/Content/openreply. Read orbiqon/README.md,
orbiqon/HOSTING.md and orbiqon/AUTOMATION.md before doing anything. Do not
regenerate any secret; they live in Vercel and Railway variables. Then help me
with: <task>
```

## Timeline

- 2026-09-07: forked repo, created Neon database, Railway Redis and worker, Vercel web app, Resend login.
- 2026-09-08: created and published the Meta app, connected @shazimbuilds, moved to reply.orbiqon.com, created the Google Drive folder and the first campaign "Founder Agents Pack", wrote the skill and these docs, moved the clone from Downloads to Orbiqon/Content.
