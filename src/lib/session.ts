import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Role } from "@/lib/types";

export interface Actor {
  name: string;
  email: string;
  staffNo: string;
  department: string;
  role: Role;
  groups: string[];
  scope: "all" | "department";
}

export async function currentUser(): Promise<Actor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session.user as Actor;
}

/** The git author on every commit. This is what makes the audit trail attributable. */
export function commitAuthor(a: Actor) {
  return { name: `${a.name} (${a.staffNo})`, email: a.email };
}
