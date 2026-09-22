import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { readJson, writeJson } from "@/lib/store/driver";

export const dynamic = "force-dynamic";

interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  createdAt: string;
  createdBy: string;
}

const GROUPS_KEY = "groups";

export async function GET() {
  const user = await currentUser();
  if (!user || !can(user.role, "admin.manageGroups")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    let groups = await readJson<Group[]>(GROUPS_KEY).catch(() => []) as Group[];

    // Seed default groups if none exist
    if (groups.length === 0) {
      const defaultGroup: Group = {
        id: "grp-default-001",
        name: "safety-gatekeepers",
        description: "Default gatekeeper group for all safety reports",
        members: ["s.rangan@demo.contrail", "n.kulkarni@demo.contrail"],
        createdAt: new Date().toISOString(),
        createdBy: "system"
      };
      groups = [defaultGroup];
      await writeJson(GROUPS_KEY, groups, "Create default gatekeeper group", { name: user.name, email: user.email });
    }

    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !can(user.role, "admin.manageGroups")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { action, ...data } = await req.json();

    const groups = await readJson<Group[]>(GROUPS_KEY).catch(() => []) as Group[];

    if (action === "create") {
      const newGroup: Group = {
        id: `grp-${Date.now()}`,
        name: data.name,
        description: data.description || "",
        members: data.members || [],
        createdAt: new Date().toISOString(),
        createdBy: user.email
      };
      await writeJson(GROUPS_KEY, [...groups, newGroup], `Create group: ${data.name}`, { name: user.name, email: user.email });
      return NextResponse.json({ group: newGroup });
    }

    if (action === "update") {
      const updated = groups.map(g => g.id === data.id ? { ...g, ...data } : g);
      await writeJson(GROUPS_KEY, updated, `Update group: ${data.name}`, { name: user.name, email: user.email });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const filtered = groups.filter(g => g.id !== data.id);
      await writeJson(GROUPS_KEY, filtered, `Delete group: ${data.id}`, { name: user.name, email: user.email });
      return NextResponse.json({ success: true });
    }

    if (action === "add-member") {
      const updated = groups.map(g => {
        if (g.id === data.groupId && !g.members.includes(data.email)) {
          return { ...g, members: [...g.members, data.email] };
        }
        return g;
      });
      await writeJson(GROUPS_KEY, updated, `Add member to group`, { name: user.name, email: user.email });
      return NextResponse.json({ success: true });
    }

    if (action === "remove-member") {
      const updated = groups.map(g => {
        if (g.id === data.groupId) {
          return { ...g, members: g.members.filter(m => m !== data.email) };
        }
        return g;
      });
      await writeJson(GROUPS_KEY, updated, `Remove member from group`, { name: user.name, email: user.email });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Group management error:", error);
    return NextResponse.json({ error: "Failed to manage groups" }, { status: 500 });
  }
}
