import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { listIndex, storeConfigured } from "@/lib/store";
import { canSeeReport, can } from "@/lib/rbac";
import { staffDirectory } from "@/lib/demo-users";
import { StatusBadge, PageHeader, Empty, Stat } from "@/components/ui";
import ExportPanel from "@/components/export-panel";
import { ChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "mine", label: "Assigned to me" },
  { key: "group", label: "Assigned to my group" },
  { key: "triage", label: "Awaiting triage" },
  { key: "all", label: "All reports" }
] as const;

export default async function Queue({ searchParams }: { searchParams: { view?: string; dateFrom?: string; dateTo?: string; reportType?: string; raisedBy?: string; department?: string; status?: string } }) {
  const user = (await currentUser())!;

  // Check if user has permission to access the queue (not reporters)
  if (!can(user.role, "report.viewAllNew")) {
    notFound();
  }

  if (!storeConfigured()) {
    return (
      <div className="card p-8">
        <h2 className="font-semibold">The datastore is not connected</h2>
        <p className="mt-2 max-w-prose text-sm text-slate1">
          Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_DATA_REPO in your environment, then run{" "}
          <code className="id">npm run seed</code> to create the data repository skeleton.
        </p>
      </div>
    );
  }

  let rows = (await listIndex()).filter((r) =>
    canSeeReport(
      { email: user.email, role: user.role, department: user.department, groups: user.groups, scope: user.scope },
      { investigator: r.investigator, gatekeeperGroup: r.gatekeeperGroup, department: r.department }
    )
  );

  // Apply filters
  if (searchParams.dateFrom) {
    rows = rows.filter(r => r.submittedAt >= searchParams.dateFrom!);
  }
  if (searchParams.dateTo) {
    rows = rows.filter(r => r.submittedAt <= searchParams.dateTo! + "T23:59:59");
  }
  if (searchParams.reportType && searchParams.reportType !== "all") {
    rows = rows.filter(r => r.formTitle.toLowerCase().includes(searchParams.reportType!.toLowerCase()));
  }
  if (searchParams.raisedBy) {
    rows = rows.filter(r => r.raisedBy?.toLowerCase().includes(searchParams.raisedBy!.toLowerCase()));
  }
  if (searchParams.department && searchParams.department !== "all") {
    rows = rows.filter(r => r.department === searchParams.department);
  }
  if (searchParams.status && searchParams.status !== "all") {
    rows = rows.filter(r => r.status === searchParams.status);
  }

  const today = new Date().toISOString().slice(0, 10);
  const open = rows.filter((r) => !["closed", "rejected"].includes(r.status));
  const overdue = open.filter((r) => r.dueDate && r.dueDate < today);
  const awaiting = rows.filter((r) => r.status.startsWith("pending_"));

  // A report is one person's work once it is assigned, so the queue separates what you hold from
  // what your group is carrying. Names come from the directory; the index only keeps the address.
  const names = new Map(staffDirectory(user).map((p) => [p.email, p.name]));
  const mine = rows.filter((r) => r.investigator === user.email && !["closed", "rejected"].includes(r.status));
  const myGroup = rows.filter((r) => r.investigator && r.investigator !== user.email && user.groups.some(g => r.gatekeeperGroup === g) && !["closed", "rejected"].includes(r.status));
  const triage = rows.filter((r) => r.status === "new");
  const view = VIEWS.some((v) => v.key === searchParams.view) ? (searchParams.view as string) : "all";
  const counts: Record<string, number> = { mine: mine.length, group: myGroup.length, triage: triage.length, all: rows.length };
  const shown = view === "mine" ? mine : view === "group" ? myGroup : view === "triage" ? triage : rows;
  const emptyNote =
    view === "mine"
      ? "Nothing is assigned to you. A gatekeeper hands reports over at triage."
      : view === "group"
        ? "No reports assigned to other members of your group."
        : view === "triage"
          ? "Nothing is waiting for a decision."
          : "New reports appear here as soon as they are filed.";

  return (
    <>
      <PageHeader
        eyebrow="Work"
        title="Active incident queue"
        note={
          view === "mine"
            ? "Reports assigned to you. You carry out the investigation on these."
            : view === "group"
              ? "Reports assigned to other members of your gatekeeper groups."
              : view === "triage"
                ? "Filed and waiting for a gatekeeper to accept or reject them."
                : user.scope === "all"
                  ? "Every report across the organisation."
                  : `Reports raised in ${user.department}, plus anything assigned to you.`
        }
        actions={<ExportPanel />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Assigned to me" value={mine.length} tone={mine.length ? "blue" : "default"} hint="Yours to investigate" />
        <Stat label="My group" value={myGroup.length} hint="Assigned to group members" />
        <Stat label="Awaiting triage" value={triage.length} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "red" : "default"} hint="Past the current stage's target date" />
        <Stat label="Awaiting approval" value={awaiting.length} tone="amber" />
      </div>

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Queue views">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "all" ? "/queue" : `/queue?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              view === v.key ? "bg-chart text-white shadow-sm" : "border border-line bg-white text-slate1 hover:text-ink"
            }`}
          >
            {v.label}
            <span className={`ml-2 text-[0.75rem] ${view === v.key ? "opacity-80" : "text-slate1"}`}>{counts[v.key]}</span>
          </Link>
        ))}
      </nav>

      {/* Filters */}
      <details className="mb-4 card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Filters</summary>
        <form method="get" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="view" value={view} />
          <div>
            <label className="label text-xs">Date From</label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={searchParams.dateFrom}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="label text-xs">Date To</label>
            <input
              type="date"
              name="dateTo"
              defaultValue={searchParams.dateTo}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="label text-xs">Report Type</label>
            <select name="reportType" defaultValue={searchParams.reportType} className="input text-sm">
              <option value="all">All types</option>
              <option value="voluntary">Voluntary Safety Report</option>
              <option value="occurrence">Occurrence Report</option>
              <option value="ground">Ground Incident</option>
              <option value="bird">Bird Strike</option>
              <option value="fatigue">Fatigue Report</option>
              <option value="dangerous goods">Dangerous Goods</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Raised By</label>
            <input
              type="text"
              name="raisedBy"
              defaultValue={searchParams.raisedBy}
              placeholder="Name..."
              className="input text-sm"
            />
          </div>
          <div>
            <label className="label text-xs">Department</label>
            <select name="department" defaultValue={searchParams.department} className="input text-sm">
              <option value="all">All departments</option>
              <option value="Flight Operations">Flight Operations</option>
              <option value="Cabin Crew">Cabin Crew</option>
              <option value="Engineering">Engineering</option>
              <option value="AOD">AOD</option>
              <option value="Cargo">Cargo</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Status</label>
            <select name="status" defaultValue={searchParams.status} className="input text-sm">
              <option value="all">All statuses</option>
              <option value="new">New (Awaiting triage)</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_risk_approval">Pending Risk Approval</option>
              <option value="pending_gatekeeper_approval">Pending Gatekeeper</option>
              <option value="pending_cofs_approval">Pending COFS</option>
              <option value="effectiveness_review">Effectiveness Review</option>
              <option value="closed">Closed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn-primary btn-sm">Apply Filters</button>
            <Link href={`/queue?view=${view}`} className="btn-ghost btn-sm">Clear</Link>
          </div>
        </form>
      </details>

      {shown.length === 0 ? (
        <Empty title="Nothing here" note={emptyNote} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"><input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-chart" /></th>
                  <th>Report</th>
                  <th>Type</th>
                  <th>Raised by</th>
                  <th>Assigned to</th>
                  <th>Submitted</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="w-10"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const late = r.dueDate && r.dueDate < today && !["closed", "rejected"].includes(r.status);
                  return (
                    <tr key={r.id} className="group">
                      <td><input type="checkbox" aria-label={`Select ${r.id}`} className="h-4 w-4 accent-chart" /></td>
                      <td>
                        <Link href={`/report/${r.id}`} className="id font-medium text-ink hover:text-chart">{r.safetyRef ?? r.id}</Link>
                      </td>
                      <td>
                        <p className="font-medium text-ink">{r.formTitle}</p>
                        {r.station && <p className="text-[0.75rem] text-slate1">{r.station}</p>}
                      </td>
                      <td className="text-slate1">{r.raisedBy}</td>
                      <td className="text-slate1">
                        {r.investigator ? (
                          <span className={r.investigator === user.email ? "font-medium text-ink" : ""}>
                            {r.investigator === user.email ? "You" : names.get(r.investigator) ?? r.investigator}
                          </span>
                        ) : (
                          "Not assigned"
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate1">{r.submittedAt.slice(0, 10)}</td>
                      <td className="whitespace-nowrap">
                        {r.dueDate ? (
                          <span className={late ? "font-medium text-risk-red" : "text-slate1"}>
                            {r.dueDate}
                            {late && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-risk-red">Overdue</span>}
                          </span>
                        ) : (
                          <span className="text-slate1">-</span>
                        )}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-right">
                        <Link href={`/report/${r.id}`} aria-label={`Open ${r.id}`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate1 transition group-hover:bg-white group-hover:text-chart">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
