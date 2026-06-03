"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import type { CurrentUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TaskModalUser {
  user_id: string;
  full_name: string;
  is_active: boolean;
}

export interface TaskModalProject {
  project_id: string;
  project_name: string;
  ticket_id_prefix: string;
}

export function CreateTaskModal({
  currentUser,
  users,
  projects,
  title = "Create ticket",
}: {
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
  title?: string;
}) {
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
        {title}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Workflow ticket</p>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">Create task ticket</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Close create task"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action="/api/resources/Tasks" method="post" className="space-y-5 p-5">
              <input type="hidden" name="assigned_by" value={currentUser.user_id} />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input name="title" required className="input" placeholder="Single deliverable title" />
                </Field>
                <Field label="Due date">
                  <input name="due_date" type="date" required className="input" />
                </Field>
              </div>

              <Field label="Description">
                <textarea name="description" required className="input min-h-24 resize-y" placeholder="Brief, references, links, and expected output" />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Project">
                  <select name="project_id" className="input">
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.project_id} value={project.project_id}>
                        {project.ticket_id_prefix ? `${project.ticket_id_prefix} - ` : ""}
                        {project.project_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select name="priority" defaultValue="Medium" className="input">
                    {["Low", "Medium", "High", "Urgent"].map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Assignees">
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                  {activeUsers.map((user) => (
                    <label
                      key={user.user_id}
                      className={cn(
                        "flex min-w-0 items-center gap-2 rounded-lg border border-white bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm",
                        user.user_id === currentUser.user_id && "border-blue-200 bg-blue-50 text-blue-700",
                      )}
                    >
                      <input name="assigned_to" type="checkbox" defaultChecked={user.user_id === currentUser.user_id} value={user.user_id} className="h-4 w-4 accent-slate-950" />
                      <span className="truncate">{user.full_name}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Subtasks">
                <textarea
                  name="checklist_titles"
                  required
                  className="input min-h-28 resize-y"
                  placeholder={"Copywriting\nDesign\nStakeholder review"}
                />
              </Field>

              <Field label="Labels">
                <input name="labels" className="input" placeholder="Design, Urgent, Client" />
              </Field>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                  <Plus className="h-4 w-4" />
                  Create ticket
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
