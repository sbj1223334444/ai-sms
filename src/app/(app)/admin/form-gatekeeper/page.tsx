"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

interface FormGatekeeperMapping {
  formId: string;
  gatekeeperGroup: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
}

export default function FormGatekeeperPage() {
  const [mappings, setMappings] = useState<FormGatekeeperMapping[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [mappingsRes, groupsRes] = await Promise.all([
        fetch("/api/admin/form-gatekeeper"),
        fetch("/api/admin/groups")
      ]);

      if (mappingsRes.ok) {
        const data = await mappingsRes.json();
        setMappings(data.mappings || []);
      }

      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateMapping(formId: string, gatekeeperGroup: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/form-gatekeeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId, gatekeeperGroup })
      });

      if (res.ok) {
        setMappings(prev => {
          const existing = prev.find(m => m.formId === formId);
          if (existing) {
            return prev.map(m => m.formId === formId ? { ...m, gatekeeperGroup } : m);
          }
          return [...prev, { formId, gatekeeperGroup }];
        });
      }
    } catch (error) {
      console.error("Failed to update mapping:", error);
    } finally {
      setSaving(false);
    }
  }

  const formTypes = [
    { id: "voluntary-safety-report", name: "Voluntary Safety Report" },
    { id: "bird-strike", name: "Bird/Wildlife Strike" },
    { id: "occurrence-report", name: "Occurrence Report" },
    { id: "ground-incident", name: "Ground Incident" },
    { id: "ra-report", name: "Resolution Advisory (RA) Report" },
    { id: "dg-occurrence", name: "Dangerous Goods Occurrence" },
    { id: "air-traffic-incident", name: "Air Traffic Incident" },
    { id: "fatigue-report", name: "Fatigue Report" },
    { id: "laser-interference", name: "Laser Interference" },
    { id: "gps-interference", name: "GPS Interference" },
    { id: "unruly-passenger", name: "Unruly Passenger" },
    { id: "runway-incursion", name: "Runway Incursion" },
    { id: "death-on-board", name: "Death on Board" }
  ];

  if (loading) {
    return <div className="card p-8 text-center">Loading...</div>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Form Gatekeeper Assignment"
        note="Assign default gatekeeper groups for each report type"
      />

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Report Type</th>
              <th>Gatekeeper Group</th>
            </tr>
          </thead>
          <tbody>
            {formTypes.map((form) => {
              const mapping = mappings.find(m => m.formId === form.id);
              return (
                <tr key={form.id}>
                  <td className="font-medium text-ink">{form.name}</td>
                  <td>
                    <select
                      value={mapping?.gatekeeperGroup || ""}
                      onChange={(e) => updateMapping(form.id, e.target.value)}
                      disabled={saving}
                      className="input text-sm"
                    >
                      <option value="">Select group...</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.name}>
                          {group.name} ({group.members.length} members)
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
