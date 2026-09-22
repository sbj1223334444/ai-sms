import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listIndex, storeConfigured } from "@/lib/store";
import { StatusBadge, PageHeader, Empty } from "@/components/ui";
import { PlusCircle } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function MySubmissions() {
  const user = (await currentUser())!;
  const rows = storeConfigured() ? (await listIndex()).filter((r) => r.raisedBy === user.name) : [];

  return (
    <>
      <PageHeader
        eyebrow="Report"
        title="My submissions"
        note="Reports you have filed. Confidential reports are not listed here, because nothing links them back to you."
        actions={
          <Link href="/report/new" className="btn-primary">
            <PlusCircle className="h-4 w-4" /> New report
          </Link>
        }
      />
      {rows.length === 0 ? (
        <Empty title="You have not filed a report yet" note="Everything you file shows up here with its status." action="Report an incident" href="/report/new" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Type</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="id font-medium">{r.id}</td>
                    <td className="font-medium">{r.formTitle}</td>
                    <td className="text-slate1">{r.submittedAt.slice(0, 10)}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
