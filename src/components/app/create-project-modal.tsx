"use client";



import { FolderKanban, Plus, X } from "lucide-react";

import { useState } from "react";



import { Button } from "@/components/ui/button";

import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";

import { ModalPortal } from "@/components/ui/modal-portal";

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

      <Button type="button" size="lg" className="h-10 gap-2 px-3 font-semibold" onClick={() => setOpen(true)}>

        <Plus className="h-4 w-4" />

        Create project

      </Button>



      {open ? (

        <ModalPortal>

        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">

          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Project workspace</p>

                <h2 className="text-lg font-semibold tracking-normal text-slate-950">Create project</h2>

              </div>

              <Button type="button" variant="outline" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close create project">

                <X className="h-4 w-4" />

              </Button>

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
                  <FormSelect
                    name="owner_user_id"
                    defaultValue={currentUser.user_id}
                    options={activeUsers.map((user) => ({ value: user.user_id, label: user.full_name }))}
                  />
                </Field>

                <Field label="Deadline">

                  <DatePickerField name="deadline" required variant="form" />

                </Field>

              </div>



              <div className="grid gap-4 md:grid-cols-2">

                <Field label="Priority">
                  <FormSelect
                    name="priority"
                    defaultValue="Medium"
                    options={priorities.map((priority) => ({ value: priority, label: priority }))}
                  />
                </Field>

                <Field label="Status">
                  <FormSelect
                    name="status"
                    defaultValue="Not Started"
                    options={statuses.map((status) => ({ value: status, label: status }))}
                  />
                </Field>

              </div>



              <Field label="Members">

                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">

                  {activeUsers.map((user) => (

                    <label

                      key={user.user_id}

                      className={cn(

                        "flex min-w-0 items-center gap-2 rounded-lg border border-white bg-white px-3 py-2 text-sm font-semibold text-slate-700",

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

                <Button type="button" variant="outline" size="xl" onClick={() => setOpen(false)}>

                  Cancel

                </Button>

                <Button type="submit" size="xl">

                  <FolderKanban className="h-4 w-4" />

                  Create project

                </Button>

              </div>

            </form>

          </div>

        </div>

        </ModalPortal>

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


