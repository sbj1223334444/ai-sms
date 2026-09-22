# AI SMS — Air India Safety Management System

The Air India Safety Management System (AI SMS): a complete safety reporting platform where reports from
Air India employees are triaged, investigated, risk-assessed, drive tasks, pass two-stage approvals, and
move into effectiveness monitoring. All thirteen regulatory and voluntary forms are implemented.

Built on Next.js, deployable to Vercel. Demo mode with ten test accounts for evaluation.
Runs with **no configuration** — clone, install, start.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

That is the whole setup. No environment file, no database, no SSO. The store is in-memory and
comes pre-loaded with three reports so the queue is not empty: an untriaged bird strike, a ground
incident already under investigation, and a confidential fatigue report.

```bash
npm run check        # 49 checks: risk, workflow, closure, RBAC, assignment, forms, stages, edits, tasks
npm run build        # production build
```

## The ten accounts

Click any card on the sign-in page, or use the user ID with the password **`airindia2026`**.
Once you are in, your name at the bottom of the sidebar is a menu — switch to any other account
from there without signing out, and the page you are on re-renders as that person.

| User ID | Name | Role | Department | What they are for |
|---|---|---|---|---|
| `rohit.menon` | Capt. Rohit Menon | Reporter | Flight Operations | Files any of the 9 pilot forms |
| `priya.nair` | Priya Nair | Reporter | Cabin Crew | Fatigue, unruly passenger, death on board |
| `rahul.mehta` | Rahul Mehta | Reporter | Engineering | Ground incident, fatigue |
| `imran.qureshi` | Imran Qureshi | Reporter | AOD | Ground incident, dangerous goods, unruly passenger |
| `meera.pillai` | Meera Pillai | Reporter | Cargo | Dangerous goods, ground incident |
| `s.rangan` | Suresh Rangan | Gatekeeper | Corporate Safety | Triages the flight ops queue |
| `n.kulkarni` | Nandita Kulkarni | Gatekeeper | Corporate Safety | Triages the ground and cabin queues |
| `arjun.deshmukh` | Arjun Deshmukh | Investigator | Flight Operations | Flight Safety — sees every report |
| `m.fernandes` | Maria Fernandes | Investigator | Engineering | SMS nodal — Engineering reports only |
| `d.pahwa` | Capt. Dinesh Pahwa | COFS | Corporate Safety | The only role that can approve closure |
| `sms.admin` | System Administrator | System Admin | Corporate Safety | Permissions, config and the audit log |

There is also **Sign in as yourself** on the sign-in page: type any name, pick a department and a
role, and you are in. Useful for handing the link to someone without briefing them first.

## A five-minute walkthrough

1. **`rohit.menon`** — Report an incident → Voluntary Safety Report. Set *Confidential* to Yes and
   watch the identity block disappear. Submit, and you get a report ID.
2. Switch to **`s.rangan`** from the account menu at the bottom of the sidebar. The report is in his queue. Accept it for
   investigation and SRA, and pick Arjun Deshmukh from the searchable investigator list (gatekeepers
   are listed too). A safety reference number is issued — rejected reports never get one.
3. Switch to **`arjun.deshmukh`**. Open the report. Add crew and aircraft by hand on the Report
   details tab. Write findings on the Investigation tab and tick *Needs a safety risk assessment* —
   an SRA tab appears named after the finding. On Report details, *Edit answers* corrects what the
   reporter entered (every change lands on the Timeline). On the Workflow tab, *Ask for information*
   sends a task to the reporter, and *Add task* assigns one to anyone, picked from the staff
   directory, optionally with edit access to chosen sections of the report.
4. On the SRA tab, click a pre-mitigation cell in the 5×5, then try to make the post-mitigation
   rating worse. It refuses. Try lowering severity — it asks you to confirm. Pick a red cell and it
   leaves your hands entirely and routes to COFS.
5. Complete the workflow stages, then send for closure. The gate lists exactly what is missing.
6. Switch to **`n.kulkarni`** or **`s.rangan`** to approve as gatekeeper, then **`d.pahwa`** to
   approve as COFS. Controls with a monitoring period move into effectiveness review.
7. **`m.fernandes`** is worth a look: an SMS nodal who can only see Engineering reports.
8. **`sms.admin`** — Administration → Forms. Create a form, show it to one department only, and
   switch to a reporter in that department to file it. Edit a shipped form and the version goes up.
   Under Workflows, give a report type its own stages. On any report in progress, the Workflow tab
   has *Edit stages* for adding, removing and reordering the stages that have not started.

## The forms

All thirteen, built field by field from BRD section 6: every field in the BRD's order, grouped into
the BRD's sections (A to R where the BRD letters them), with conditional questions shown right
after the answer that opens them. Each is a JSON Schema plus a uiSchema in `config/forms/`, rendered
by react-jsonschema-form with the app's own section layout (`src/components/sms-form.tsx`). Fields
the BRD marks as filled from CAE after submission are not asked of the reporter; the section says
so instead. Those are the shipped forms. Admin and System Admin can also create forms,
change their questions and decide which departments see them from **Administration → Forms**, and
edit the default workflow for each report type from **Administration → Workflows**. See
[docs/USER-STORIES-FORMS-AND-WORKFLOWS.md](docs/USER-STORIES-FORMS-AND-WORKFLOWS.md) (US-16 to US-19).

| Code | Form | Sections | Who sees it (BRD persona mapping) |
|---|---|---|---|
| VSR-001 | Voluntary Safety Report | 4 | Everyone |
| OCC-001 | Occurrence Report (DGCA Format) | A to G | Flight Operations |
| GIR-001 | Ground Incident Report | 3 | Engineering, AOD, Cargo |
| AIR-001 | Air Traffic Incident Report (Airprox) | A to K | Flight Operations |
| WLD-001 | Wildlife (Bird Strike) Report | 7 | Flight Operations |
| FAT-001 | Confidential Human Factor Incident Report: Fatigue | 7 | Cabin Crew, Flight Operations, Engineering |
| DOB-001 | Death on Board Report | 6 | Cabin Crew |
| DG-001 | Dangerous Goods Occurrence Report | 6 | Cargo, AOD |
| GPS-001 | GPS RFI Interference Report | 5 | Flight Operations |
| LAS-001 | Laser Beam Interference Report | 6 | Flight Operations |
| RA-001 | Pilot / Observer RA Report | 6 | Flight Operations |
| RWI-001 | Runway Incursion Initial Report | A to R | Flight Operations |
| UNR-001 | Unruly Passenger Incident Report | 7 | Cabin Crew, AOD |

A form outside your department is not shown and is not reachable by typing its URL.

## What it does

**Reporting.** Department decides which forms you see. A confidential report is stored with no
name, staff number, email or department on it at all — there is nothing to unmask, which is a
stronger answer than masking. Report ID on submission.

**Triage.** The report lands in the gatekeeper group mapped to its type. Four outcomes; rejection
needs a comment; the safety reference series covers accepted reports only.

**Investigation.** Five tabs for Investigation + SRA, four when it is SRA only. All of BRD
section 9, capped at 15 findings. Flag a finding for risk assessment and it grows its own SRA tab,
which then refuses to disappear once it holds risk data.

**Crew and aircraft are typed in, not fetched.** There is no CAE access on this build, so the
integration is not wired up. The investigator records the aircraft and crew on the Report details
tab and it is stamped as manually entered. `src/lib/cae.ts` holds the shape and the rules for
switching it on later — fetch only after submission, never block when the API fails.

**Risk.** A 5×5 matrix you click rather than two dropdowns. Probability can only come down.
Severity cannot go up, and bringing it down asks you to confirm, because controls usually change
how likely something is, not how bad it would be. Residual risk above your tolerance stops being
yours and routes to the configured approver.

**Closure.** The gate lists what is still outstanding. Gatekeeper, then COFS. Rejection at either
step reopens and can reassign. Monitored controls move the report into effectiveness review; an
ineffective control reopens the investigation.

**Getting data out.** Excel export in the BRD section 10 column order, permission-checked and
capped at 10,000 rows. A printable extract covering report, investigation, SRA, workflow, tasks and
timeline.

## Deploy to Vercel

```bash
gh repo create <you>/ai-sms --private --source=. --push
```

Import at vercel.com and set one environment variable before deploying: `NEXTAUTH_SECRET`
(any random string, e.g. `openssl rand -base64 32`). Without it every signed-in page returns a
500. Set `NEXTAUTH_URL` to your production URL too, so sign-in redirects stay on that domain.
Nothing else needs configuring — it runs in demo mode and anyone with the link can sign in.

**Connect a Redis store on Vercel.** In-memory demo mode is not enough there: Vercel runs pages and
API routes as separate serverless functions, each with its own memory, so a triage saved by the API
never reaches the report page. In the Vercel project, open **Storage → Create Database → Upstash
for Redis** (free plan), connect it to this project for all environments, and redeploy. Vercel sets
`KV_REST_API_URL` and `KV_REST_API_TOKEN`; the app picks them up, loads the demo reports once, and
every function then reads the same data. The demo-mode notice disappears when it is connected.

**Or keep every change as a commit**: create a second private repo for data, generate a
fine-grained PAT with Contents read & write on it, set `GITHUB_TOKEN`, `GITHUB_OWNER` and
`GITHUB_DATA_REPO` in the Vercel project, and run `npm run seed` once. Every write then becomes a
commit, and `git log` is the audit trail. GitHub wins if both are configured.

## Layout

```
config/                 everything that is policy rather than code
  forms/*.json          all 13 forms as JSON Schema + uiSchema
  rbac-matrix.json      BRD section 8, enforced server-side
  risk-matrix.json      5x5 cells, zones, tolerances, approvers
  workflows.json        the shipped default workflow stages
  persona-form-map.json which department sees which form
src/lib/                store, rbac, risk, workflow, forms, auth, demo users
src/lib/store/          memory driver, github driver, one interface over both
src/app/api/            one route per resource
src/app/(app)/          queue, workspace, tasks, admin, reporting
docs/ARCHITECTURE.md    the storage trade-off, in detail
docs/BRD-COVERAGE.md    story by story: built, partly built, not started
```

## Not built yet

Attachment bytes (file names are captured, the files are not stored), the in-app notification bell,
scheduled reminders for effectiveness reviews, the DMS repository, legacy data migration, and the
dashboard APIs. `docs/BRD-COVERAGE.md` has the detail.
