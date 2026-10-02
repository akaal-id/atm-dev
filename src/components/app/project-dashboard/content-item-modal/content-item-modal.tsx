"use client";

import styles from "./content-item-modal.module.css";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { brandLabel } from "@/lib/content-matrix";
import { requestJson } from "@/lib/request-json";
import type { Brand, ContentItem, StrategyOption, StrategyOptionType } from "@/lib/types/project-hub";

type Draft = {
  title: string;
  brand_id: string;
  month: string;
  create_date: string;
  publication_date: string;
  theme: string;
  funnel: string;
  pillar: string;
  channel: string;
  brief_url: string;
  drive_url: string;
  publication_url: string;
};

function draftFrom(item: ContentItem | null, defaultBrand: string): Draft {
  return {
    title: item?.title ?? "",
    brand_id: item?.brand_id ?? defaultBrand,
    month: item?.month ?? "",
    create_date: item?.create_date ?? new Date().toISOString().slice(0, 10),
    publication_date: item?.publication_date ?? "",
    theme: item?.theme ?? "",
    funnel: item?.funnel ?? "",
    pillar: item?.pillar ?? "",
    channel: item?.channel ?? "",
    brief_url: item?.brief_url ?? "",
    drive_url: item?.drive_url ?? "",
    publication_url: item?.publication_url ?? "",
  };
}

/** Add or edit one content-matrix row. Mount only while open; `item = null` creates. */
export function ContentItemModal({
  projectId,
  item,
  brands,
  allBrands,
  strategy,
  nextSortOrder,
  onClose,
}: {
  projectId: string;
  item: ContentItem | null;
  /** Brands linked to the project (dropdown source). */
  brands: Brand[];
  /** Company brands, to label sub-brands with their parent. */
  allBrands: Brand[];
  strategy: StrategyOption[];
  nextSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, brands.length === 1 ? brands[0].brand_id : ""));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const optionsFor = (type: StrategyOptionType, current: string) => {
    const labels = strategy.filter((option) => option.type === type).map((option) => option.label);
    // Keep a value that was removed from the strategy selectable so editing doesn't drop it.
    if (current && !labels.includes(current)) labels.push(current);
    return [{ value: "", label: "—" }, ...labels.map((label) => ({ value: label, label }))];
  };
  const themes = strategy.filter((option) => option.type === "theme").map((option) => option.label);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      pushToast({ tone: "success", title: success });
      onClose();
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save content", description: error instanceof Error ? error.message : "Something went wrong." });
      setBusy(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || busy) return;
    const body = { ...draft, brand_id: draft.brand_id || null, month: draft.month || draft.publication_date.slice(0, 7) };
    void run(
      () =>
        item
          ? requestJson(`/api/projects/${projectId}/content/${item.item_id}`, "PATCH", body)
          : requestJson(`/api/projects/${projectId}/content`, "POST", { ...body, sort_order: nextSortOrder }),
      item ? "Content updated" : "Content added",
    );
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={item ? "Edit content" : "Add content"} eyebrow="Content matrix" className={styles.panel}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input className="input" required value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="e.g. Carousel: 5 tips memilih skincare halal" />
        </label>

        <div className={styles.grid}>
          <div className={styles.field}>
            <span className={styles.label}>Brand</span>
            <FormSelect
              name="brand_id"
              value={draft.brand_id}
              onValueChange={(value) => set("brand_id", value)}
              placeholder={brands.length ? "Select brand" : "Add brands in Edit project"}
              disabled={brands.length === 0}
              options={[{ value: "", label: "—" }, ...brands.map((brand) => ({ value: brand.brand_id, label: brandLabel(brand.brand_id, allBrands) }))]}
            />
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Month</span>
            <input className="input" type="month" value={draft.month} onChange={(event) => set("month", event.target.value)} />
          </label>
          <div className={styles.field}>
            <span className={styles.label}>Create date</span>
            <DatePickerField variant="form" value={draft.create_date} onChange={(value) => set("create_date", value)} clearable />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Publication date</span>
            <DatePickerField
              variant="form"
              value={draft.publication_date}
              onChange={(value) => setDraft((current) => ({ ...current, publication_date: value, month: value ? value.slice(0, 7) : current.month }))}
              clearable
            />
          </div>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Theme</span>
            <input className="input" list={`themes-${projectId}`} value={draft.theme} onChange={(event) => set("theme", event.target.value)} placeholder="Ramadan, product launch…" />
            <datalist id={`themes-${projectId}`}>
              {themes.map((theme) => (
                <option key={theme} value={theme} />
              ))}
            </datalist>
          </label>
          <div className={styles.field}>
            <span className={styles.label}>Funnel</span>
            <FormSelect name="funnel" value={draft.funnel} onValueChange={(value) => set("funnel", value)} options={optionsFor("funnel", draft.funnel)} placeholder="—" />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Pillar</span>
            <FormSelect name="pillar" value={draft.pillar} onValueChange={(value) => set("pillar", value)} options={optionsFor("pillar", draft.pillar)} placeholder="—" />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Channel</span>
            <FormSelect name="channel" value={draft.channel} onValueChange={(value) => set("channel", value)} options={optionsFor("channel", draft.channel)} placeholder="—" />
          </div>
        </div>

        <div className={styles.links}>
          {(
            [
              ["brief_url", "Link brief"],
              ["drive_url", "Link drive"],
              ["publication_url", "Link publication"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className={styles.field}>
              <span className={styles.label}>{label}</span>
              <input className="input" type="url" value={draft[field]} onChange={(event) => set(field, event.target.value)} placeholder="https://" />
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          {item ? (
            confirmDelete ? (
              <Button
                type="button"
                variant="destructiveSolid"
                disabled={busy}
                onClick={() => void run(() => requestJson(`/api/projects/${projectId}/content/${item.item_id}`, "DELETE"), "Content deleted")}
              >
                Confirm delete
              </Button>
            ) : (
              <Button type="button" variant="destructiveOutline" disabled={busy} onClick={() => setConfirmDelete(true)}>
                <Trash2 className={styles.icon} aria-hidden />
                Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <div className={styles.actionGroup}>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !draft.title.trim()}>
              {busy ? <Loader2 className={styles.spinner} aria-hidden /> : null}
              Save
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
