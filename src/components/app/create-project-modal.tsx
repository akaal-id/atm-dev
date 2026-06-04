"use client";

import { FolderKanban, Plus, X } from "lucide-react";
import { useState } from "react";

import type { CurrentUser, Priority, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ProjectModalUser {
  user_id: string;
  full_name: string;
  is_active: boolean;
}

const priorities: Priority[] = ["Low", "Medium", "High", "Urgent"];
const statuses: ProjectStatus[] = ["Not Started", "In Progress", "Waiting for Review", "Revision", "Approved", "Completed", "On Hold", "Cancelled"];

export function CreateProjectModal({ currentUser, users }: { currentUser: CurrentUser; users: ProjectModalUser[] }) {
  const [open, setOpen] = useState(false);
  const activeUsers = users.filter((user) => user.is_active);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" />
        Create project
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Project workspace</p>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">Create project</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Close create project"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action="/api/resources/Projects" method="post" className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Project name">
                  <input name="project_name" required className="input" placeholder="Halal Expo Indonesia" />
                </Field>
                <Field label="Ticket ID code">
                  <input name="ticket_id_prefix" className="input" placeholder="HEI" maxLength={5} />
                </Field>
              </div>

              <Field label="Description">
                <textarea name="description" required className="input min-h-24 resize-y" placeholder="Scope, goals, and deliverables" />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Owner">
                  <select name="owner_user_id" className="input" defaultValue={currentUser.user_id}>
                    {activeUsers.map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Deadline">
                  <input name="deadline" type="date" required className="input" />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Priority">
                  <select name="priority" defaultValue="Medium" className="input">
                    {priorities.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue="Not Started" className="input">
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Members">
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                  {activeUsers.map((user) => (
                    <label
                      key={user.user_id}
                      className={cn(
                        "flex min-w-0 items-center gap-2 rounded-lg border border-white bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm",
                        user.user_id === currentUser.user_id && "border-blue-200 bg-blue-50 text-blue-700",
                      )}
                    >
                      <input name="members" type="checkbox" value={user.user_id} defaultChecked={user.user_id === currentUser.user_id} className="h-4 w-4 accent-slate-950" />
                      <span className="truncate">{user.full_name}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Links">
                <input name="links" className="input" placeholder="https://brief.url, https://drive.url" />
              </Field>

              <Field label="Notes">
                <textarea name="notes" className="input min-h-24 resize-y" placeholder="Internal notes, risks, or client context" />
              </Field>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                  <FolderKanban className="h-4 w-4" />
                  Create project
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
