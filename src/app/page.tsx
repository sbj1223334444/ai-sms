import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  redirect(user.role === "reporter" ? "/report/new" : "/queue");
}
