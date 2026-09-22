import type { Assignee, Role } from "./types";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  staffNo: string;
  department: string;
  role: Role;
  groups: string[];
  scope: "all" | "department";
  blurb: string;
}

/**
 * Ten accounts covering every role in the RBAC matrix. Password for all of them is below.
 * Hand these out for a walkthrough: between them they can file, triage, investigate, assess risk,
 * hold tasks and approve closure.
 */
export const DEMO_PASSWORD = "airindia2026";

export const DEMO_USERS: DemoUser[] = [
  {
    id: "rohit.menon", name: "Capt. Rohit Menon", email: "rohit.menon@airindia.com", staffNo: "10011204",
    department: "Flight Operations", role: "reporter", groups: [], scope: "department",
    blurb: "Line captain. Sees the eight pilot forms."
  },
  {
    id: "priya.nair", name: "Priya Nair", email: "priya.nair@airindia.com", staffNo: "10044821",
    department: "Cabin Crew", role: "reporter", groups: [], scope: "department",
    blurb: "Cabin supervisor. Sees fatigue, unruly passenger and death on board."
  },
  {
    id: "rahul.mehta", name: "Rahul Mehta", email: "rahul.mehta@airindia.com", staffNo: "10033715",
    department: "Engineering", role: "reporter", groups: [], scope: "department",
    blurb: "Line maintenance engineer. Sees ground incident and fatigue."
  },
  {
    id: "imran.qureshi", name: "Imran Qureshi", email: "imran.qureshi@airindia.com", staffNo: "10055310",
    department: "AOD", role: "reporter", groups: [], scope: "department",
    blurb: "Airport operations ramp supervisor. Sees ground incident, dangerous goods and unruly passenger."
  },
  {
    id: "meera.pillai", name: "Meera Pillai", email: "meera.pillai@airindia.com", staffNo: "10061902",
    department: "Cargo", role: "reporter", groups: [], scope: "department",
    blurb: "Cargo acceptance. Sees dangerous goods and ground incident."
  },
  {
    id: "s.rangan", name: "Suresh Rangan", email: "s.rangan@airindia.com", staffNo: "10002233",
    department: "Corporate Safety", role: "gatekeeper", groups: ["safety-gatekeepers"], scope: "all",
    blurb: "Safety office lead. Triages and assigns all safety reports."
  },
  {
    id: "n.kulkarni", name: "Nandita Kulkarni", email: "n.kulkarni@airindia.com", staffNo: "10002244",
    department: "Corporate Safety", role: "gatekeeper", groups: ["safety-gatekeepers"], scope: "all",
    blurb: "Safety office lead. Triages and assigns all safety reports."
  },
  {
    id: "arjun.deshmukh", name: "Arjun Deshmukh", email: "arjun.deshmukh@airindia.com", staffNo: "10007788",
    department: "Flight Operations", role: "investigator", groups: ["safety-flight-ops"], scope: "all",
    blurb: "Flight Safety investigator. Sees every report in the organisation."
  },
  {
    id: "m.fernandes", name: "Maria Fernandes", email: "m.fernandes@airindia.com", staffNo: "10009911",
    department: "Engineering", role: "investigator", groups: [], scope: "department",
    blurb: "SMS nodal for Engineering. Sees Engineering reports only — good for testing scoping."
  },
  {
    id: "d.pahwa", name: "Capt. Dinesh Pahwa", email: "d.pahwa@airindia.com", staffNo: "10000001",
    department: "Corporate Safety", role: "cofs", groups: [], scope: "all",
    blurb: "Chief of Flight Safety. The only role that can approve closure."
  },
  {
    id: "sms.admin", name: "System Administrator", email: "sms.admin@airindia.com", staffNo: "10000002",
    department: "Corporate Safety", role: "system_admin", groups: [], scope: "all",
    blurb: "Configuration, permissions and the audit log."
  }
];

export function findDemoUser(id: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.id === id.trim().toLowerCase() || u.email === id.trim().toLowerCase());
}

/** Directory order: the safety team first, then everyone else in the organisation. */
const DIRECTORY_ORDER: Role[] = ["investigator", "gatekeeper", "cofs", "system_admin", "admin", "reporter"];

/**
 * The staff directory a task can be assigned from (US-08 criterion 4: anyone in the organisation). Here
 * that is every demo account, plus the signed-in person if they signed in as themselves.
 */
export function staffDirectory(me?: Assignee): Assignee[] {
  const people: Assignee[] = DEMO_USERS.map(({ name, email, role, department, scope }) => ({ name, email, role, department, scope }));
  if (me && !people.some((p) => p.email === me.email)) {
    const { name, email, role, department, scope } = me;
    people.push({ name, email, role, department, scope });
  }
  return people.sort(
    (a, b) => DIRECTORY_ORDER.indexOf(a.role) - DIRECTORY_ORDER.indexOf(b.role) || a.name.localeCompare(b.name)
  );
}

/** Roles a report can be assigned to. Gatekeepers hold every investigator permission, so they count. */
export const ASSIGNABLE_ROLES: Role[] = ["investigator", "gatekeeper"];

/**
 * Who the triage picker offers, and the only people the triage API accepts: every investigator and
 * gatekeeper in the directory, plus the person triaging if they signed in as themselves with one of
 * those roles. Investigators first, then gatekeepers, each by name.
 */
export function assignableInvestigators(me?: Assignee): Assignee[] {
  const people: Assignee[] = DEMO_USERS.filter((u) => ASSIGNABLE_ROLES.includes(u.role)).map(
    ({ name, email, role, department, scope }) => ({ name, email, role, department, scope })
  );
  if (me && ASSIGNABLE_ROLES.includes(me.role) && !people.some((p) => p.email === me.email)) {
    const { name, email, role, department, scope } = me;
    people.push({ name, email, role, department, scope });
  }
  return people.sort(
    (a, b) => ASSIGNABLE_ROLES.indexOf(a.role) - ASSIGNABLE_ROLES.indexOf(b.role) || a.name.localeCompare(b.name)
  );
}
