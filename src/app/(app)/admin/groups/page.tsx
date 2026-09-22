"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { Users } from "@/components/icons";

interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  createdAt: string;
  createdBy: string;
}

export default function GroupManagementPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      const res = await fetch("/api/admin/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createGroup(name: string, description: string) {
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name, description })
      });
      if (res.ok) {
        fetchGroups();
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("Are you sure you want to delete this group?")) return;
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: groupId })
      });
      if (res.ok) {
        fetchGroups();
      }
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  }

  async function addMember(groupId: string, email: string) {
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-member", groupId, email })
      });
      if (res.ok) {
        fetchGroups();
      }
    } catch (error) {
      console.error("Failed to add member:", error);
    }
  }

  async function removeMember(groupId: string, email: string) {
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-member", groupId, email })
      });
      if (res.ok) {
        fetchGroups();
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  }

  if (loading) {
    return <div className="card p-8 text-center">Loading...</div>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Gatekeeper Groups"
        note="Manage gatekeeper groups and their members"
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Group
          </button>
        }
      />

      {groups.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-slate1" />
          <p className="mt-4 font-medium text-ink">No groups yet</p>
          <p className="mt-1 text-sm text-slate1">Create your first gatekeeper group to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-ink">{group.name}</h3>
                  {group.description && (
                    <p className="mt-1 text-sm text-slate1">{group.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteGroup(group.id)}
                  className="text-sm text-risk-red hover:text-red-700"
                >
                  Delete
                </button>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-ink">Members ({group.members.length})</p>
                <div className="mt-2 space-y-1">
                  {group.members.map((email) => (
                    <div key={email} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                      <span className="text-sm text-ink">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeMember(group.id, email)}
                        className="text-xs text-slate1 hover:text-risk-red"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <input
                    type="email"
                    placeholder="Add member by email..."
                    className="input text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const email = e.currentTarget.value.trim();
                        if (email) {
                          addMember(group.id, email);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink">Create Group</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createGroup(
                  formData.get("name") as string,
                  formData.get("description") as string
                );
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="label">Group Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g., safety-flight-ops"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  name="description"
                  placeholder="Optional description..."
                  className="input"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
