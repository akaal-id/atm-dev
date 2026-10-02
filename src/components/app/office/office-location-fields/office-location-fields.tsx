"use client";

import styles from "./office-location-fields.module.css";

import { FormSelect } from "@/components/ui/form-select";

export const PERSONAL = "personal";

/** Where an Office file lives: a project (with optional folder) or the user's personal notes. */
export function OfficeLocationFields({
  projects,
  foldersByProject,
  location,
  folder,
  onLocationChange,
  onFolderChange,
}: {
  projects: Array<{ project_id: string; project_name: string }>;
  foldersByProject: Record<string, string[]>;
  location: string;
  folder: string;
  onLocationChange: (location: string) => void;
  onFolderChange: (folder: string) => void;
}) {
  const isProject = Boolean(location) && location !== PERSONAL;
  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>Location</span>
        <FormSelect
          name="location"
          value={location}
          onValueChange={onLocationChange}
          required
          placeholder="Choose a project or personal notes"
          options={[
            { value: PERSONAL, label: "Personal notes (only you)" },
            ...projects.map((project) => ({ value: project.project_id, label: `Project · ${project.project_name}` })),
          ]}
        />
        <p className={styles.hint}>Files must belong to a project so documentation stays organised. Personal notes are visible only to you.</p>
      </div>

      {isProject ? (
        <label className={styles.field}>
          <span className={styles.label}>Folder (optional)</span>
          <input
            className="input"
            list="office-folders"
            value={folder}
            onChange={(event) => onFolderChange(event.target.value)}
            placeholder="e.g. Reports, Budget, Content plan"
            maxLength={120}
          />
          <datalist id="office-folders">
            {(foldersByProject[location] ?? []).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      ) : null}
    </>
  );
}
