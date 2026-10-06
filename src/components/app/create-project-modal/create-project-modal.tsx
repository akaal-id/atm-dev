"use client";

import styles from "./create-project-modal.module.css";



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

      <Button type="button" size="lg" className={styles.button} onClick={() => setOpen(true)}>

        <Plus className={styles.icon} />

        Create project

      </Button>



      {open ? (

        <ModalPortal>

        <div className={styles.overlay}>

          <div className={styles.panel}>

            <div className={styles.header}>

              <div>

                <p className={styles.eyebrow}>Project workspace</p>

                <h2 className={styles.heading}>Create project</h2>

              </div>

              <Button type="button" variant="outline" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close create project">

                <X className={styles.icon} />

              </Button>

            </div>



            <form action="/api/resources/Projects" method="post" className={styles.form}>

              <div className={styles.fieldsGrid}>

                <Field label="Project name">

                  <input name="project_name" required className="input" placeholder="Halal Expo Indonesia" />

                </Field>

                <Field label="Ticket ID code">

                  <input name="ticket_id_prefix" className="input" placeholder="HEI" maxLength={5} />

                </Field>

              </div>



              <Field label="Description">

                <textarea name="description" required className={cn("input", styles.textarea)} placeholder="Scope, goals, and deliverables" />

              </Field>

              <Field label="Objective">
                <textarea name="objective" className={cn("input", styles.textarea)} placeholder="What this project must achieve, e.g. grow awareness of the brand among Gen Z in Jakarta" />
              </Field>

              <div className={styles.fieldsGrid}>
                <Field label="Project type">
                  <FormSelect
                    name="project_type"
                    defaultValue="general"
                    options={[
                      { value: "general", label: "General" },
                      { value: "social_media", label: "Social media" },
                    ]}
                  />
                </Field>
                <Field label="Person in charge">
                  <FormSelect
                    name="pic_user_id"
                    defaultValue={currentUser.user_id}
                    options={activeUsers.map((user) => ({ value: user.user_id, label: user.full_name }))}
                  />
                </Field>
              </div>

              <div className={styles.fieldsGrid}>
                <Field label="Period start">
                  <DatePickerField name="period_start" variant="form" />
                </Field>
                <Field label="Period end">
                  <DatePickerField name="period_end" variant="form" />
                </Field>
              </div>


              <div className={styles.fieldsGrid}>

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



              <div className={styles.fieldsGrid}>

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

                <div className={styles.memberGrid}>

                  {activeUsers.map((user) => (

                    <label

                      key={user.user_id}

                      className={cn(

                        styles.member,

                        user.user_id === currentUser.user_id && styles.memberChecked,

                      )}

                    >

                      <input name="members" type="checkbox" value={user.user_id} defaultChecked={user.user_id === currentUser.user_id} className={styles.checkbox} />

                      <span className={styles.memberName}>{user.full_name}</span>

                    </label>

                  ))}

                </div>

              </Field>



              <Field label="Links">

                <input name="links" className="input" placeholder="https://brief.url, https://drive.url" />

              </Field>



              <Field label="Notes">

                <textarea name="notes" className={cn("input", styles.textarea)} placeholder="Internal notes, risks, or client context" />

              </Field>



              <div className={styles.actions}>

                <Button type="button" variant="outline" size="xl" onClick={() => setOpen(false)}>

                  Cancel

                </Button>

                <Button type="submit" size="xl">

                  <FolderKanban className={styles.icon} />

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

    <label className={styles.labelField}>

      <span className={styles.field}>{label}</span>

      {children}

    </label>

  );

}


