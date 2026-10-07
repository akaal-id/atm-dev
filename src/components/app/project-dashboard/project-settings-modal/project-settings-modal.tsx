"use client";

import styles from "./project-settings-modal.module.css";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { requestJson } from "@/lib/request-json";
import type { Brand, ProjectHubData, ProjectUserSummary } from "@/lib/types/project-hub";
import { projectStatuses } from "@/lib/permissions";
import type { Project, ProjectStatus, ProjectType } from "@/lib/types";

type Draft = {
  status: ProjectStatus;
  project_type: ProjectType;
  period_start: string;
  period_end: string;
  objective: string;
  pic_user_id: string;
};

function draftFrom(project: Project): Draft {
  return {
    status: project.status,
    project_type: project.project_type ?? "general",
    period_start: project.period_start ?? "",
    period_end: project.period_end ?? "",
    objective: project.objective ?? "",
    pic_user_id: project.pic_user_id ?? "",
  };
}

/** Brands ordered parent-first, each followed by its sub-brands. */
function brandTree(brands: Brand[]) {
  const parents = brands.filter((brand) => !brand.parent_brand_id);
  const known = new Set(parents.map((brand) => brand.brand_id));
  const orphans = brands.filter((brand) => brand.parent_brand_id && !known.has(brand.parent_brand_id));
  return [
    ...parents.flatMap((parent) => [
      { brand: parent, depth: 0 },
      ...brands.filter((child) => child.parent_brand_id === parent.brand_id).map((child) => ({ brand: child, depth: 1 })),
    ]),
    ...orphans.map((brand) => ({ brand, depth: 0 })),
  ];
}

/** Mount only while open: form state is initialised from the latest server data on mount. */
export function ProjectSettingsModal({
  onClose,
  project,
  users,
  hub,
  hubUnavailable,
}: {
  onClose: () => void;
  project: Project;
  users: ProjectUserSummary[];
  hub: ProjectHubData;
  hubUnavailable: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(project));
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() => hub.brands.map((brand) => brand.brand_id));
  const [newBrand, setNewBrand] = useState({ name: "", parent: "" });
  const [busy, setBusy] = useState(false);

  const activeUsers = users.filter((user) => user.is_active || user.user_id === draft.pic_user_id);
  const originalBrands = hub.brands.map((brand) => brand.brand_id).sort().join(",");

  function toggleBrand(brandId: string) {
    setSelectedBrands((current) => (current.includes(brandId) ? current.filter((id) => id !== brandId) : [...current, brandId]));
  }

  async function addBrand() {
    const name = newBrand.name.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const brand = await requestJson<Brand>(`/api/projects/${project.project_id}/brands`, "POST", {
        name,
        parent_brand_id: newBrand.parent || null,
      });
      setSelectedBrands((current) => (current.includes(brand.brand_id) ? current : [...current, brand.brand_id]));
      setNewBrand({ name: "", parent: newBrand.parent });
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not add brand", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (draft.period_start && draft.period_end && draft.period_end < draft.period_start) {
      pushToast({ tone: "error", title: "Period end must be on or after period start" });
      return;
    }

    setBusy(true);
    try {
      await requestJson(`/api/projects/${project.project_id}`, "PATCH", draft);
      if (!hubUnavailable && [...selectedBrands].sort().join(",") !== originalBrands) {
        await requestJson(`/api/projects/${project.project_id}/brands`, "PUT", { brand_ids: selectedBrands });
      }
      pushToast({ tone: "success", title: "Project updated" });
      onClose();
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not update project", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title="Edit project" eyebrow={project.project_name} className={styles.panel}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Objective</span>
          <textarea
            className="input"
            rows={3}
            value={draft.objective}
            onChange={(event) => setDraft({ ...draft, objective: event.target.value })}
            placeholder="What this project must achieve"
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Status</span>
          <FormSelect
            name="status"
            value={draft.status}
            onValueChange={(value) => setDraft({ ...draft, status: value as ProjectStatus })}
            options={projectStatuses.map((status) => ({ value: status, label: status }))}
          />
          <span className={styles.hint}>Completed projects move to the Completed tab on Projects.</span>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.label}>Project type</span>
            <FormSelect
              name="project_type"
              value={draft.project_type}
              onValueChange={(value) => setDraft({ ...draft, project_type: value === "social_media" ? "social_media" : "general" })}
              options={[
                { value: "general", label: "General" },
                { value: "social_media", label: "Social media" },
              ]}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Person in charge</span>
            <FormSelect
              name="pic_user_id"
              value={draft.pic_user_id}
              onValueChange={(value) => setDraft({ ...draft, pic_user_id: value })}
              placeholder="Select PIC"
              options={activeUsers.map((user) => ({ value: user.user_id, label: user.full_name }))}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.label}>Period start</span>
            <DatePickerField variant="form" value={draft.period_start} onChange={(value) => setDraft({ ...draft, period_start: value })} clearable />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Period end</span>
            <DatePickerField variant="form" value={draft.period_end} onChange={(value) => setDraft({ ...draft, period_end: value })} clearable />
          </div>
        </div>

        {hubUnavailable ? null : (
          <fieldset className={styles.brands}>
            <legend className={styles.label}>Brands & sub-brands</legend>
            {hub.companyBrands.length === 0 ? <p className={styles.empty}>No brands yet — add the first one below.</p> : null}
            <div className={styles.brandList}>
              {brandTree(hub.companyBrands).map(({ brand, depth }) => (
                <label key={brand.brand_id} className={depth ? styles.subBrand : styles.brand}>
                  <input type="checkbox" checked={selectedBrands.includes(brand.brand_id)} onChange={() => toggleBrand(brand.brand_id)} />
                  {brand.name}
                </label>
              ))}
            </div>
            <div className={styles.addBrand}>
              <input
                className="input"
                placeholder="New brand or sub-brand"
                value={newBrand.name}
                onChange={(event) => setNewBrand({ ...newBrand, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addBrand();
                  }
                }}
              />
              <FormSelect
                name="parent_brand_id"
                value={newBrand.parent}
                onValueChange={(parent) => setNewBrand({ ...newBrand, parent })}
                fullWidth={false}
                options={[
                  { value: "", label: "Top-level brand" },
                  ...hub.companyBrands.filter((brand) => !brand.parent_brand_id).map((brand) => ({ value: brand.brand_id, label: `Sub-brand of ${brand.name}` })),
                ]}
              />
              <Button type="button" variant="outline" onClick={() => void addBrand()} disabled={busy || !newBrand.name.trim()}>
                <Plus className={styles.icon} aria-hidden />
                Add
              </Button>
            </div>
          </fieldset>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className={styles.spinner} aria-hidden /> : null}
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
