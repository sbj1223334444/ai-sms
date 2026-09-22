import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listNotifications } from "@/lib/store/notifications";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = (await currentUser())!;
  const notifications = await listNotifications(user.email);

  return (
    <>
      <PageHeader
        eyebrow="Work"
        title="Notifications"
        note="Stay updated on your tasks, reports, and approvals"
      />

      {notifications.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-slate1">No notifications yet</p>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {notifications.map((notif) => (
            <Link
              key={notif.id}
              href={notif.link}
              className={`block px-6 py-4 transition hover:bg-surface ${!notif.read ? "bg-chartsoft/20" : ""}`}
            >
              <div className="flex items-start gap-4">
                {!notif.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-chart" />}
                <div className={`flex-1 ${!notif.read ? "" : "ml-6"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink">{notif.title}</p>
                      <p className="mt-1 text-sm text-slate1">{notif.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate1 whitespace-nowrap">
                      {new Date(notif.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
