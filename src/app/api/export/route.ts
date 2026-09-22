import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { currentUser } from "@/lib/session";
import { listIndex, getReport } from "@/lib/store";
import { can, canSeeReport } from "@/lib/rbac";
import { LOCATION_FIELDS } from "@/lib/locations";

/** The first answer a report has for any of these questions; forms name the same thing differently. */
const first = (data: Record<string, unknown> | undefined, keys: string[]) => {
  const k = keys.find((key) => data?.[key] !== undefined && data?.[key] !== "");
  const v = k ? data![k] : "";
  return Array.isArray(v) ? v.join(", ") : String(v ?? "");
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ROWS = 10000;

/** BRD section 10. Column order is fixed by the regulator-facing template. */
const COLUMNS = [
  { header: "S/N", key: "sn", width: 18 },
  { header: "Date", key: "date", width: 12 },
  { header: "Airport/Place of occurrence", key: "place", width: 26 },
  { header: "Operator", key: "operator", width: 12 },
  { header: "Aircraft Type", key: "acType", width: 14 },
  { header: "Registration", key: "reg", width: 14 },
  { header: "Flight No.", key: "flightNo", width: 12 },
  { header: "Sector", key: "sector", width: 12 },
  { header: "Phase of flight", key: "phase", width: 16 },
  { header: "Brief description", key: "description", width: 60 },
  { header: "Classification of occurrence", key: "classification", width: 26 },
  { header: "CICTT", key: "cictt", width: 12 },
  { header: "ATA chapter", key: "ata", width: 12 },
  { header: "Findings in investigation report", key: "findings", width: 50 },
  { header: "Probable cause as per investigation report", key: "cause", width: 50 },
  { header: "Recommendations made in the investigation report", key: "recommendations", width: 50 },
  { header: "ATR of the recommendations", key: "atr", width: 30 },
  { header: "Status of investigation", key: "status", width: 18 }
];

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "report.export")) return NextResponse.json({ error: "You do not hold the export permission." }, { status: 403 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "Both a from and a to date are required." }, { status: 422 });
  if (to < from) return NextResponse.json({ error: "The to date must be on or after the from date." }, { status: 422 });

  const types = req.nextUrl.searchParams.getAll("type");
  const statuses = req.nextUrl.searchParams.getAll("status");
  const departments = req.nextUrl.searchParams.getAll("department");

  let rows = (await listIndex()).filter((r) => {
    const d = r.submittedAt.slice(0, 10);
    if (d < from || d > to) return false;
    if (types.length && !types.includes(r.formId)) return false;
    if (statuses.length && !statuses.includes(r.status)) return false;
    if (departments.length && !departments.includes(r.department ?? "")) return false;
    return canSeeReport(
      { email: user.email, role: user.role, department: user.department, groups: user.groups, scope: user.scope },
      { investigator: r.investigator, gatekeeperGroup: r.gatekeeperGroup, department: r.department }
    );
  });

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `This range returns ${rows.length} reports. The limit is ${MAX_ROWS} - narrow the date range or add filters.` },
      { status: 413 }
    );
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "AI SMS";
  const ws = wb.addWorksheet("Incident reports");
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C3A5B" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) {
    const full = await getReport(row.id);
    const r = full?.data;
    const findings = r?.investigation?.findings ?? [];
    ws.addRow({
      sn: r?.safetyRef ?? row.id,
      date: row.submittedAt.slice(0, 10),
      place: first(r?.data, LOCATION_FIELDS) || row.station || "",
      operator: first(r?.data, ["aircraftOperator", "operator", "operatorName", "miscOperator"]),
      acType: r?.cae?.aircraft?.type ?? first(r?.data, ["aircraftType", "aircraftTypeSeries", "miscAircraftType"]),
      reg: r?.cae?.aircraft?.registration ?? first(r?.data, ["aircraftRegistration", "registration", "aircraftIdentification", "miscRegistration"]),
      flightNo: first(r?.data, ["flightNo", "ac1FlightNo"]),
      sector: (r?.data.sector as string) ?? "",
      phase: first(r?.data, ["phaseOfFlight", "flightPhase"]),
      // Confidential reports carry no identity anywhere, including here.
      description: (r?.data.description as string) ?? "",
      classification: r?.formTitle ?? row.formTitle,
      cictt: (r?.data.cictt as string) ?? "",
      ata: (r?.data.ataChapter as string) ?? "",
      findings: findings.map((f, i) => `${i + 1}. ${f.text}`).join("\n"),
      cause: findings.map((f) => f.rootCause).filter(Boolean).join("\n"),
      recommendations: r?.investigation?.recommendations ?? "",
      atr: r?.sras.flatMap((s) => s.hazards.flatMap((h) => h.controls.map((c) => `${c.text}${s.status ? ` (${s.status})` : ""}`))).join("\n") ?? "",
      status: row.status === "closed" ? "Closed" : row.status === "rejected" ? "Rejected" : "Open"
    });
  }
  ws.eachRow((r) => { r.alignment = { vertical: "top", wrapText: true }; });

  const buf = await wb.xlsx.writeBuffer();
  console.log(`[audit] export by ${user.email} rows=${rows.length} range=${from}..${to}`);
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ai-sms-reports-${from}-to-${to}.xlsx"`
    }
  });
}
