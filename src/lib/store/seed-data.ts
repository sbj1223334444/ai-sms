import { LOCATION_FIELDS } from "@/lib/locations";
import type { Report } from "@/lib/types";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

function workflow(raisedAt: string, completedUpTo = -1) {
  const stages = [
    { key: "report-review", name: "Report Review", taskDays: 2 },
    { key: "investigation", name: "Investigation", taskDays: 10 },
    { key: "meeting-minutes", name: "Investigation Meeting Minutes", taskDays: 1 },
    { key: "findings", name: "Findings and Actions", taskDays: 1 },
    { key: "closure", name: "Closure Approval", taskDays: 7 }
  ];
  let cursor = raisedAt;
  return stages.map((s, i) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() + s.taskDays);
    cursor = d.toISOString();
    return {
      key: s.key,
      name: s.name,
      status: (i <= completedUpTo ? "complete" : i === completedUpTo + 1 ? "in_progress" : "not_started") as
        | "complete"
        | "in_progress"
        | "not_started",
      taskDays: s.taskDays,
      targetDate: cursor.slice(0, 10)
    };
  });
}

/** Three reports so the queue is not empty on first run: one untriaged, one live, one confidential. */
export function seedReports(): (Report & { indexRow: Record<string, unknown> })[] {
  const year = new Date().getFullYear();

  const a: Report = {
    id: `RPT-${year}-000001`,
    formId: "bird-strike",
    formTitle: "Wildlife (Bird Strike) Report",
    status: "new",
    confidential: false,
    submittedBy: { name: "Capt. Rohit Menon", email: "rohit.menon@demo.contrail", staffNo: "10011204", department: "Flight Operations" },
    submittedAt: day(-3),
    data: {
      aircraftOperator: "Example Airways",
      aircraftTypeSeries: "A320neo",
      aircraftRegistration: "VT-ZZA",
      flightNo: "ZZ 671",
      engineMakeModel: "CFM LEAP-1A",
      dateOfOccurrence: day(-3).slice(0, 10),
      timeOfOccurrence: "07:42",
      aerodromeDeparture: "VABB",
      aerodromeArrival: "VIDP",
      aerodromeOccurrence: "VABB",
      runwayInUse: "27",
      altitudeAgl: 400,
      speedIas: 165,
      atcInformed: "Yes",
      phaseOfFlight: "Climb",
      skyCondition: ["Some cloud"],
      wildlifeDescription: "Black kite",
      numberOfBirds: "2 to 10",
      pilotWarned: "No",
      birdSize: "Medium",
      partsStruck: ["Engine No. 1"],
      partsDamaged: ["Engine No. 1"],
      effectOnFlight: ["Precautionary landing"],
      remarks: "Bird strike on the number one engine cowling shortly after rotation. Crew reported no abnormal parameters but elected to return for inspection. Minor dent found on the cowling lip.",
      reportedByStation: "BOM",
      reportedByDate: day(-3).slice(0, 10)
    },
    attachments: [{ name: "cowling-damage.jpg", size: 842000 }],
    gatekeeperGroup: "safety-gatekeepers",
    sras: [],
    workflow: workflow(day(-3)),
    tasks: [],
    timeline: [{ at: day(-3), actor: "Capt. Rohit Menon", action: "Report submitted" }]
  };

  const b: Report = {
    id: `RPT-${year}-000002`,
    safetyRef: `SR-${year}-00001`,
    formId: "ground-incident",
    formTitle: "Ground Incident Report",
    status: "in_progress",
    confidential: false,
    submittedBy: { name: "Imran Qureshi", email: "imran.qureshi@demo.contrail", staffNo: "10055310", department: "AOD" },
    submittedAt: day(-9),
    data: {
      operatorName: "Example Airways",
      dateOfIncident: day(-9).slice(0, 10),
      timeOfOccurrence: "14:20",
      aircraftType: "A321neo",
      aircraftRegistration: "VT-ZZB",
      flightNo: "ZZ 815",
      placeOfOccurrence: "Stand 42, Terminal 3, DEL",
      description: "Belt loader made contact with the aft cargo door surround while positioning. Scuff mark and minor paint damage. Engineering cleared the aircraft after inspection.",
      damageDetails: "Scuff mark and minor paint damage on the aft cargo door surround.",
      injuryDetails: "None",
      immediateAction: "Loader withdrawn, aircraft inspected by line engineering and released."
    },
    attachments: [],
    gatekeeperGroup: "safety-gatekeepers",
    triage: {
      decision: "investigation_sra",
      operationalHazard: true,
      by: "Nandita Kulkarni",
      at: day(-8),
      investigator: "arjun.deshmukh@demo.contrail"
    },
    investigation: {
      synopsis: "Belt loader contacted the aft cargo door surround during positioning at Stand 42.",
      factual: { historyOfFlight: "Aircraft on turnaround, doors open, loading in progress." },
      findings: [{ id: "F1", text: "Loader operator positioned without a wing walker present.", state: "Present & Ineffective", sraRequired: true, rootCause: "Wing walker not rostered for the turnaround." }]
    },
    sras: [
      {
        id: "SRA-1",
        findingRef: "F1",
        title: "Loader operator positioned without a wing walker present.",
        hazards: [
          {
            id: "HZ-000002-1",
            hazard: "Ground support equipment contact with aircraft",
            description: "A belt loader was positioned without a wing walker during the turnaround.",
            rootCause: "Wing walker not rostered for the turnaround.",
            resultantRisk: "Ground support equipment strikes the fuselage during positioning.",
            worstCredibleEffect: "Aircraft damage and an out-of-service airframe.",
            controls: [
              { id: "CTL-000002-1", text: "Supervision or spot check", kind: "existing", monitoringPeriod: "3 months" },
              { id: "CTL-000002-2", text: "Wing walker mandatory for all belt loader positioning", kind: "additional", monitoringPeriod: "6 months" }
            ]
          }
        ],
        serial: 1,
        originator: "Imran Qureshi",
        source: "Ground incident report filed by the turnaround coordinator.",
        location: "VABB",
        functionalArea: "Ground Handling",
        subFunction: "Ramp handling",
        preMitigation: "4C",
        postMitigation: "2C",
        action: "Roster a wing walker for every belt loader movement and brief the ramp teams.",
        owner: "ops.head@demo.contrail",
        ownerName: "Ground Operations Head",
        department: "Ground Handling",
        deadline: day(21).slice(0, 10),
        status: "In Progress",
        approval: { required: false, status: "not_required" }
      }
    ],
    workflow: workflow(day(-9), 0),
    tasks: [],
    timeline: [
      { at: day(-9), actor: "Imran Qureshi", action: "Report submitted" },
      { at: day(-8), actor: "Nandita Kulkarni", action: "Accepted for investigation + sra", detail: `Assigned to arjun.deshmukh@demo.contrail. Safety ref SR-${year}-00001` }
    ]
  };

  const c: Report = {
    id: `RPT-${year}-000003`,
    formId: "voluntary-safety-report",
    formTitle: "Voluntary Safety Report",
    status: "new",
    confidential: true,
    submittedAt: day(-1),
    data: {
      confidential: "Yes",
      station: "BLR",
      placeOfEvent: "Crew briefing room",
      dateOfEvent: day(-1).slice(0, 10),
      flightRelated: "No",
      hazardCategory: "Flight Operations",
      hazardType: "Flight Crew Fatigue",
      concernedArea: "Flight Operations",
      description: "Consecutive early reports over the roster block are leaving very little recovery time between duties. Several colleagues have mentioned the same thing.",
      suggestion: "Review the minimum rest applied when early duties are rostered back to back."
    },
    attachments: [],
    gatekeeperGroup: "safety-gatekeepers",
    sras: [],
    workflow: workflow(day(-1)),
    tasks: [],
    timeline: [{ at: day(-1), actor: "Confidential", action: "Report submitted" }]
  };

  return [a, b, c].map((r) => ({
    ...r,
    indexRow: {
      id: r.id,
      safetyRef: r.safetyRef,
      formId: r.formId,
      formTitle: r.formTitle,
      status: r.status,
      department: r.confidential ? undefined : r.submittedBy?.department,
      station: LOCATION_FIELDS.map((k) => r.data[k]).find((v) => typeof v === "string" && v !== ""),
      raisedBy: r.confidential ? "Confidential" : r.submittedBy?.name,
      submittedAt: r.submittedAt,
      dueDate: r.workflow.find((s) => s.status !== "complete")?.targetDate,
      gatekeeperGroup: r.gatekeeperGroup,
      investigator: r.triage?.investigator
    }
  }));
}
