import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { readJson, writeJson } from "@/lib/store/driver";

export const dynamic = "force-dynamic";

interface FormGatekeeperMapping {
  formId: string;
  gatekeeperGroup: string;
}

const FORM_GATEKEEPER_KEY = "form-gatekeeper-mappings";

export async function GET() {
  const user = await currentUser();
  if (!user || !can(user.role, "admin.manageForms")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    let mappings = await readJson<FormGatekeeperMapping[]>(FORM_GATEKEEPER_KEY).catch(() => []) as FormGatekeeperMapping[];

    // Seed default mappings if none exist
    if (mappings.length === 0) {
      const defaultMappings: FormGatekeeperMapping[] = [
        { formId: "voluntary-safety-report", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "bird-strike", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "occurrence-report", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "ground-incident", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "ra-report", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "dg-occurrence", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "air-traffic-incident", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "fatigue-report", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "laser-interference", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "gps-interference", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "unruly-passenger", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "runway-incursion", gatekeeperGroup: "safety-gatekeepers" },
        { formId: "death-on-board", gatekeeperGroup: "safety-gatekeepers" }
      ];
      mappings = defaultMappings;
      await writeJson(FORM_GATEKEEPER_KEY, mappings, "Create default form-gatekeeper mappings", { name: user.name, email: user.email });
    }

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Failed to fetch form-gatekeeper mappings:", error);
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !can(user.role, "admin.manageForms")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { formId, gatekeeperGroup } = await req.json();

    const mappings = await readJson<FormGatekeeperMapping[]>(FORM_GATEKEEPER_KEY).catch(() => []) as FormGatekeeperMapping[];

    // Update or add mapping
    const existingIndex = mappings.findIndex(m => m.formId === formId);
    if (existingIndex >= 0) {
      mappings[existingIndex].gatekeeperGroup = gatekeeperGroup;
    } else {
      mappings.push({ formId, gatekeeperGroup });
    }

    await writeJson(FORM_GATEKEEPER_KEY, mappings, `Update gatekeeper for ${formId}`, { name: user.name, email: user.email });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update form-gatekeeper mapping:", error);
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }
}
