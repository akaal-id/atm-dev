"use client";

import styles from "./doc-page-setup-modal.module.css";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { Modal } from "@/components/ui/modal";
import { pagelessWidths, paperSizes, type PageSetup, type PagelessWidth, type PaperKey } from "@/lib/office-doc";
import { cn } from "@/lib/utils";

const marginPresets: Array<{ label: string; margins: PageSetup["margins"] }> = [
  { label: "Normal (2.54 cm)", margins: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 } },
  { label: "Narrow (1.27 cm)", margins: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 } },
  { label: "Moderate", margins: { top: 2.54, bottom: 2.54, left: 1.91, right: 1.91 } },
  { label: "Indonesian thesis (4-3-3-3)", margins: { top: 3, bottom: 3, left: 4, right: 3 } },
];

/** Pages / pageless format, paper size, orientation, and margins. Mount only while open. */
export function DocPageSetupModal({
  initial,
  applyToAllTabs,
  onApply,
  onClose,
}: {
  initial: PageSetup;
  applyToAllTabs: boolean;
  onApply: (setup: PageSetup, allTabs: boolean) => void;
  onClose: () => void;
}) {
  const [setup, setSetup] = useState<PageSetup>(initial);
  const [allTabs, setAllTabs] = useState(applyToAllTabs);
  const margin = (side: keyof PageSetup["margins"], value: string) =>
    setSetup((current) => ({ ...current, margins: { ...current.margins, [side]: Math.max(0, Math.min(10, Number(value) || 0)) } }));

  return (
    <Modal open onClose={onClose} title="Page setup" eyebrow="Layout" className={styles.panel}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onApply(setup, allTabs);
        }}
      >
        <div className={styles.field}>
          <span className={styles.label}>Format</span>
          <div className={styles.orientations} role="radiogroup" aria-label="Format">
            {(
              [
                ["pages", "Pages", "Paginated, like a printed document"],
                ["pageless", "Pageless", "One continuous page, no page breaks"],
              ] as const
            ).map(([mode, label, hint]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={setup.mode === mode}
                className={cn(styles.orientation, styles.format, setup.mode === mode && styles.orientationActive)}
                onClick={() => setSetup({ ...setup, mode })}
              >
                <span className={styles.formatLabel}>{label}</span>
                <span className={styles.hint}>{hint}</span>
              </button>
            ))}
          </div>
        </div>

        {setup.mode === "pageless" ? (
          <div className={styles.field}>
            <span className={styles.label}>Content width</span>
            <div className={styles.presets} role="radiogroup" aria-label="Content width">
              {Object.entries(pagelessWidths).map(([key, option]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={setup.pagelessWidth === key}
                  className={cn(styles.preset, setup.pagelessWidth === key && styles.presetActive)}
                  onClick={() => setSetup({ ...setup, pagelessWidth: key as PagelessWidth })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className={styles.hint}>The paper settings below are still used when you download DOCX or PDF.</p>
          </div>
        ) : null}

        <div className={styles.field}>
          <span className={styles.label}>{setup.mode === "pageless" ? "Paper size for download" : "Paper size"}</span>
          <FormSelect
            name="paper"
            value={setup.paper}
            onValueChange={(paper) => setSetup({ ...setup, paper: paper as PaperKey })}
            options={Object.entries(paperSizes).map(([value, paper]) => ({ value, label: paper.label }))}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Orientation</span>
          <div className={styles.orientations} role="radiogroup" aria-label="Orientation">
            {(["portrait", "landscape"] as const).map((orientation) => (
              <button
                key={orientation}
                type="button"
                role="radio"
                aria-checked={setup.orientation === orientation}
                className={cn(styles.orientation, setup.orientation === orientation && styles.orientationActive)}
                onClick={() => setSetup({ ...setup, orientation })}
              >
                <span className={orientation === "portrait" ? styles.pagePortrait : styles.pageLandscape} aria-hidden />
                {orientation === "portrait" ? "Portrait" : "Landscape"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Margins (cm)</span>
          <div className={styles.presets}>
            {marginPresets.map((preset) => (
              <button key={preset.label} type="button" className={styles.preset} onClick={() => setSetup({ ...setup, margins: preset.margins })}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className={styles.margins}>
            {(["top", "bottom", "left", "right"] as const).map((side) => (
              <label key={side} className={styles.marginField}>
                <span className={styles.marginLabel}>{side[0].toUpperCase() + side.slice(1)}</span>
                <input className="input" type="number" min="0" max="10" step="0.01" value={setup.margins[side]} onChange={(event) => margin(side, event.target.value)} />
              </label>
            ))}
          </div>
        </div>

        <label className={styles.checkbox}>
          <input type="checkbox" checked={allTabs} onChange={(event) => setAllTabs(event.target.checked)} />
          Apply to all tabs
        </label>

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Apply</Button>
        </div>
      </form>
    </Modal>
  );
}
