# Architecture

## The shape of it

```
 staff portal / browser
        |
        v
 Vercel (Next.js 14, App Router)
   - server components render every page
   - route handlers own every write
   - RBAC checked on the server, never only in the UI
        |
        +--> Entra ID (SSO)            identity, department, role claims
        +--> GitHub Contents API       the datastore and the audit trail
        +--> CAE CM / MM               crew and aircraft, after submission only
        +--> SMTP / Resend             notifications
```

Nothing runs on a schedule yet. Effectiveness reminders and due-date reminders need a cron —
add `vercel.json` with a cron hitting `/api/cron/reminders`, which is the one route still to write.

## Why GitHub is the store, and where that stops working

It was the brief, and it buys three real things:

1. **The audit trail is free and genuinely tamper-evident.** Every write is a commit with an
   author, a timestamp and a diff. Section 8 of the BRD wants exactly that, and here you get it
   without a second system to keep honest. Turn on branch protection and required signed commits
   and the log is stronger than an application-managed audit table.
2. **Configuration is versioned the same way as data.** Forms, workflows, the RBAC matrix and the
   risk matrix ship as JSON in `config/`. Forms and workflows can also be changed in the app
   (Administration → Forms and → Workflows, US-16 to US-18): those saves go to `data/config/` in
   the datastore and override the shipped files, so each one is a commit authored by the admin
   who made it. The RBAC matrix, risk matrix and gatekeeper groups still change only by pull request.
3. **No database to procure.** Useful for getting a pilot in front of Flight Safety this quarter.

Where it stops working, and you should plan for it:

| Limit | Effect | When it bites |
|---|---|---|
| 5,000 REST calls/hour per token | Roughly 1,000 report writes/hour | A busy day across 13 forms, or any bulk migration |
| No transactions | A write spanning report + index + counter can half-apply | Rare, but it will happen; reconcile from `data/reports/` |
| Optimistic locking only | Two people saving one SRA — second gets a conflict error | Common once two investigators share a report |
| No query engine | The queue reads one index file, so it must be small | Around 10k reports the index file gets unwieldy |
| Files are plaintext to anyone with repo access | Confidential reports must carry no identity | Now — which is why identity is dropped at submission, not masked |
| Attachments | Not implemented; file metadata is stored, bytes are not | Before any pilot with real evidence files |

**The migration path is deliberate.** Everything goes through `src/lib/store/index.ts`. Swap
`store/github.ts` for a Postgres driver (Neon or Supabase on Vercel) and nothing above it changes.
Keep writing an audit commit alongside each write if you want to keep the git trail.

For the real production system carrying DGCA-reportable data, plan on Postgres plus object storage
for attachments, with GitHub retained for configuration only.

## Data layout in the data repo

```
data/
  index.json            one row per report — what the queue reads
  counters.json         report, safety-ref, task, hazard and control sequences
  task-index.json       task ids
  reports/RPT-2026-000123.json
  tasks/TSK-000045.json
```

## Security notes

- The GitHub PAT is a fine-grained token scoped to Contents on the data repo only. It lives in
  Vercel environment variables and is never sent to the browser.
- `ALLOW_DEV_LOGIN` must be unset in production. It is the demo persona switcher.
- Role comes from the JWT. In production, map Entra ID group claims to roles in the `jwt` callback
  in `src/lib/auth.ts` — do not let a client supply its own role.
- Confidential reports never store the reporter's identity, so there is no unmask feature and
  nothing to leak. That is a stronger answer than masking, and it is worth confirming with COFS
  that no legitimate need to identify a confidential reporter exists.
