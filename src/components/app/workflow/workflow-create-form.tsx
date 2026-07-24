"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { useTenant } from "@/components/app/tenant-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { DateRangePickerField } from "@/components/ui/date-range-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_WORKFLOW_COLUMNS,
  getMockWorkflowTemplate,
  mockWorkflowTemplates,
  type MockWorkflowColumn,
} from "@/lib/data/workflow-templates-mock";
import { cn } from "@/lib/utils";
import styles from "./workflow-create-form.module.css";

type ProjectOption = {
  project_id: string;
  project_name: string;
  ticket_id_prefix: string;
};

type WorkflowCreateFormProps = {
  projects: ProjectOption[];
};

type WizardStep = 1 | 2 | 3;
type KanbanMode = "preset" | "custom";

type BacklogRow = { id: string; title: string };

const STEPS: Array<{ id: WizardStep; label: string; title: string }> = [
  { id: 1, label: "Details", title: "General information" },
  { id: 2, label: "Board", title: "Kanban format" },
  { id: 3, label: "Tickets", title: "Quick backlog" },
];

function nextLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function cloneColumns(columns: MockWorkflowColumn[]): MockWorkflowColumn[] {
  return columns.map((column) => ({ ...column }));
}

export function WorkflowCreateForm({ projects }: WorkflowCreateFormProps) {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();

  const [step, setStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("__none__");
  const [sprintRange, setSprintRange] = useState({ from: "", to: "" });
  const [ticketPrefix, setTicketPrefix] = useState("");

  // Step 2
  const [kanbanMode, setKanbanMode] = useState<KanbanMode>("preset");
  const [presetId, setPresetId] = useState(getMockWorkflowTemplate().id);
  const [customTemplateName, setCustomTemplateName] = useState("");
  const [customColumns, setCustomColumns] = useState<MockWorkflowColumn[]>(() =>
    cloneColumns(DEFAULT_WORKFLOW_COLUMNS),
  );

  // Step 3
  const [backlogRows, setBacklogRows] = useState<BacklogRow[]>([{ id: nextLocalId("bl"), title: "" }]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.project_id === projectId) ?? null,
    [projectId, projects],
  );

  const resolvedPrefix = (ticketPrefix.trim() || selectedProject?.ticket_id_prefix || "").trim();

  const boardColumns = useMemo(() => {
    if (kanbanMode === "custom") return customColumns;
    return cloneColumns(getMockWorkflowTemplate(presetId).columns);
  }, [customColumns, kanbanMode, presetId]);

  function canGoNextFromStep1() {
    return Boolean(name.trim());
  }

  function canGoNextFromStep2() {
    if (kanbanMode === "preset") return Boolean(presetId);
    return Boolean(customTemplateName.trim()) && customColumns.filter((column) => column.name.trim()).length >= 2;
  }

  function renameCustomColumn(columnId: string, nextName: string) {
    setCustomColumns((current) => current.map((column) => (column.id === columnId ? { ...column, name: nextName } : column)));
  }

  function toggleApproval(columnId: string) {
    setCustomColumns((current) =>
      current.map((column) => ({
        ...column,
        is_2stage_approval_trigger: column.id === columnId ? !column.is_2stage_approval_trigger : false,
      })),
    );
  }

  function moveCustomColumn(columnId: string, direction: -1 | 1) {
    setCustomColumns((current) => {
      const sorted = [...current].sort((left, right) => left.order_index - right.order_index);
      const index = sorted.findIndex((column) => column.id === columnId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sorted.length) return current;
      const next = [...sorted];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((column, order_index) => ({ ...column, order_index }));
    });
  }

  function removeCustomColumn(columnId: string) {
    setCustomColumns((current) => {
      if (current.length <= 2) return current;
      return current
        .filter((column) => column.id !== columnId)
        .map((column, order_index) => ({ ...column, order_index }));
    });
  }

  function addCustomColumn() {
    setCustomColumns((current) => [
      ...current,
      {
        id: nextLocalId("wfc"),
        name: `Column ${current.length + 1}`,
        order_index: current.length,
        is_2stage_approval_trigger: false,
      },
    ]);
  }

  function updateBacklogTitle(rowId: string, title: string) {
    setBacklogRows((current) => current.map((row) => (row.id === rowId ? { ...row, title } : row)));
  }

  function addBacklogRow() {
    setBacklogRows((current) => [...current, { id: nextLocalId("bl"), title: "" }]);
  }

  function removeBacklogRow(rowId: string) {
    setBacklogRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== rowId)));
  }

  function onBacklogPaste(rowId: string, text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      updateBacklogTitle(rowId, text);
      return;
    }
    setBacklogRows((current) => {
      const index = current.findIndex((row) => row.id === rowId);
      if (index < 0) return current;
      const next = [...current];
      next[index] = { ...next[index], title: lines[0] };
      const extras = lines.slice(1).map((title) => ({ id: nextLocalId("bl"), title }));
      next.splice(index + 1, 0, ...extras);
      return next;
    });
  }

  async function finishCreate(includeBacklog: boolean) {
    if (saving || !canGoNextFromStep1() || !canGoNextFromStep2()) return;
    setSaving(true);

    const titles = includeBacklog
      ? backlogRows.map((row) => row.title.trim()).filter(Boolean)
      : [];

    const template = kanbanMode === "preset" ? getMockWorkflowTemplate(presetId) : null;
    const templateLabel =
      kanbanMode === "custom" ? customTemplateName.trim() : (template?.name ?? "Board");
    const columns =
      kanbanMode === "custom"
        ? customColumns
            .filter((column) => column.name.trim())
            .map((column, order_index) => ({
              ...column,
              name: column.name.trim(),
              order_index,
            }))
        : boardColumns;
    const projectResolved = projectId === "__none__" ? "" : projectId;

    try {
      const response = await fetch("/api/resources/Workflows", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          project_id: projectResolved,
          columns,
          sprint_start: sprintRange.from || "",
          sprint_end: sprintRange.to || "",
          ticket_id_prefix: resolvedPrefix || "",
          template_id: template?.id ?? "",
          template_name: templateLabel,
          inherit_project_tasks: false,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to create workflow");
      }

      const body = (await response.json()) as { data?: { workflow_id?: string; name?: string } };
      const createdId = String(body.data?.workflow_id ?? "");
      if (!createdId) throw new Error("Workflow created without an id");

      const dueDate = sprintRange.to || new Date().toISOString().slice(0, 10);
      for (const title of titles) {
        await fetch("/api/resources/Tasks", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: "",
            project_id: projectResolved,
            workflow_id: createdId,
            priority: "Medium",
            due_date: dueDate,
            assigned_to: [],
            labels: [],
            need_leader_approval: false,
            checklist_titles: [],
          }),
        });
      }

      pushToast({
        tone: "success",
        title: "Workflow created",
        description:
          titles.length > 0
            ? `"${name.trim()}" · ${templateLabel} · ${titles.length} backlog ticket(s).`
            : `"${name.trim()}" · ${templateLabel}${resolvedPrefix ? ` · prefix ${resolvedPrefix}` : ""}.`,
      });

      router.push(tenant.href(`/workflows/${createdId}`));
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Could not create workflow",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
      setSaving(false);
    }
  }

  function goNext() {
    if (step === 1 && !canGoNextFromStep1()) return;
    if (step === 2 && !canGoNextFromStep2()) return;
    if (step < 3) setStep((current) => (current + 1) as WizardStep);
  }

  function goBack() {
    if (step > 1) setStep((current) => (current - 1) as WizardStep);
  }

  return (
    <div className={styles.shell}>
      <div className={styles.wizard}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Task boards</p>
          <h1 className={styles.title}>New workflow</h1>
          <p className={styles.description}>Name the board, choose Kanban columns, then optionally seed a backlog.</p>
        </header>

        <div className={styles.progress} aria-label="Workflow creation progress">
          <ol className={styles.progressTrack}>
            {STEPS.map((item) => (
              <li
                key={item.id}
                className={cn(
                  styles.progressSegment,
                  item.id < step && styles.progressSegmentDone,
                  item.id === step && styles.progressSegmentActive,
                )}
                aria-current={item.id === step ? "step" : undefined}
              />
            ))}
          </ol>
          <ol className={styles.progressLabels} aria-hidden>
            {STEPS.map((item) => (
              <li
                key={item.id}
                className={cn(
                  styles.progressLabel,
                  item.id === step && styles.progressLabelActive,
                  item.id < step && styles.progressLabelDone,
                )}
              >
                {item.label}
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.panel}>
          {step === 1 ? (
          <div className={styles.stepBody}>
            <label className={styles.field}>
              <span className={styles.label}>Workflow name</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. HEI Website Sprint"
                required
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                Description <span className={styles.optional}>optional</span>
              </span>
              <textarea
                className="input"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What work belongs on this board?"
              />
            </label>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <span className={styles.label}>
                  Project <span className={styles.optional}>optional</span>
                </span>
                <FormSelect
                  name="project_id"
                  value={projectId}
                  onValueChange={(value) => {
                    setProjectId(value);
                    if (!ticketPrefix.trim()) {
                      const project = projects.find((item) => item.project_id === value);
                      if (project?.ticket_id_prefix) setTicketPrefix(project.ticket_id_prefix);
                    }
                  }}
                  placeholder="No project"
                  options={[
                    { value: "__none__", label: "No project" },
                    ...projects.map((project) => ({
                      value: project.project_id,
                      label: project.ticket_id_prefix
                        ? `${project.ticket_id_prefix} — ${project.project_name}`
                        : project.project_name,
                    })),
                  ]}
                />
              </div>

              <label className={styles.field}>
                <span className={styles.label}>
                  Ticket prefix <span className={styles.optional}>optional</span>
                </span>
                <input
                  className="input"
                  value={ticketPrefix}
                  onChange={(event) => setTicketPrefix(event.target.value.toUpperCase().slice(0, 5))}
                  placeholder={selectedProject?.ticket_id_prefix || "e.g. HEI"}
                  maxLength={5}
                />
                <span className={styles.hint}>
                  Empty → uses project prefix
                  {selectedProject?.ticket_id_prefix ? ` (${selectedProject.ticket_id_prefix})` : ""}.
                </span>
              </label>
            </div>

            <div className={styles.field}>
              <DateRangePickerField
                label="Sprint dates"
                value={sprintRange}
                onChange={setSprintRange}
                placeholder="Optional sprint range"
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className={styles.stepBody}>
            <div className={styles.modeTabs} role="tablist" aria-label="Kanban format">
              <button
                type="button"
                role="tab"
                aria-selected={kanbanMode === "preset"}
                className={cn(styles.modeTab, kanbanMode === "preset" && styles.modeTabActive)}
                onClick={() => setKanbanMode("preset")}
              >
                Use template
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={kanbanMode === "custom"}
                className={cn(styles.modeTab, kanbanMode === "custom" && styles.modeTabActive)}
                onClick={() => setKanbanMode("custom")}
              >
                Custom
              </button>
            </div>

            {kanbanMode === "preset" ? (
              <div className={styles.templateGrid}>
                {mockWorkflowTemplates.map((template) => {
                  const selected = presetId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={cn(styles.templateCard, selected && styles.templateCardSelected)}
                      onClick={() => setPresetId(template.id)}
                    >
                      <span className={styles.templateName}>
                        {template.name}
                        {template.is_default ? <span className={styles.templateBadge}>Default</span> : null}
                      </span>
                      <span className={styles.templateDesc}>{template.description}</span>
                      <span className={styles.templateColumns}>
                        {template.columns
                          .slice()
                          .sort((left, right) => left.order_index - right.order_index)
                          .map((column) => (
                            <span
                              key={column.id}
                              className={cn(
                                styles.columnChip,
                                column.is_2stage_approval_trigger && styles.columnChipApproval,
                              )}
                            >
                              {column.name}
                            </span>
                          ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.customEditor}>
                <label className={styles.field}>
                  <span className={styles.label}>Template name</span>
                  <input
                    className="input"
                    value={customTemplateName}
                    onChange={(event) => setCustomTemplateName(event.target.value)}
                    placeholder="e.g. HEI Content Flow"
                    required
                  />
                </label>

                <div className={styles.columnList}>
                  {customColumns
                    .slice()
                    .sort((left, right) => left.order_index - right.order_index)
                    .map((column, index) => (
                      <div key={column.id} className={styles.columnRow}>
                        <span className={styles.columnIndex}>{index + 1}</span>
                        <input
                          className={cn("input", styles.columnNameInput)}
                          value={column.name}
                          onChange={(event) => renameCustomColumn(column.id, event.target.value)}
                          aria-label={`Column ${index + 1} name`}
                        />
                        <label className={styles.approvalToggle}>
                          <input
                            type="checkbox"
                            checked={column.is_2stage_approval_trigger}
                            onChange={() => toggleApproval(column.id)}
                          />
                          Approval
                        </label>
                        <div className={styles.columnActions}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Move up"
                            disabled={index === 0}
                            onClick={() => moveCustomColumn(column.id, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Move down"
                            disabled={index === customColumns.length - 1}
                            onClick={() => moveCustomColumn(column.id, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove column"
                            disabled={customColumns.length <= 2}
                            onClick={() => removeCustomColumn(column.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>

                <div className={styles.inlineActions}>
                  <Button type="button" variant="outline" size="lg" className="h-10 w-fit font-normal" onClick={addCustomColumn}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Add column
                  </Button>
                  <span className={styles.hint}>Min. 2 columns. One may be the approval gate.</span>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.stepBody}>
            <p className={styles.hint}>
              One title per row. Paste multiple lines to split into tickets. Starts in{" "}
              <strong>{boardColumns[0]?.name || "first column"}</strong> · Medium priority.
            </p>

            <div className={styles.backlogList}>
              {backlogRows.map((row, index) => (
                <div key={row.id} className={styles.backlogRow}>
                  <span className={styles.columnIndex}>{index + 1}</span>
                  <input
                    className="input"
                    value={row.title}
                    onChange={(event) => updateBacklogTitle(row.id, event.target.value)}
                    onPaste={(event) => {
                      const text = event.clipboardData.getData("text");
                      if (text.includes("\n")) {
                        event.preventDefault();
                        onBacklogPaste(row.id, text);
                      }
                    }}
                    placeholder="Ticket title"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove row"
                    disabled={backlogRows.length <= 1}
                    onClick={() => removeBacklogRow(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" size="lg" className="h-10 w-fit font-normal" onClick={addBacklogRow}>
              <Plus className="h-4 w-4" aria-hidden />
              Add ticket
            </Button>
          </div>
        ) : null}

        <div className={styles.actions}>
          <Link href={tenant.href("/workflows")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 font-normal")}>
            Cancel
          </Link>
          <div className={styles.actionsRight}>
            {step > 1 ? (
              <Button type="button" variant="outline" size="lg" className="h-10 font-normal" onClick={goBack}>
                Back
              </Button>
            ) : null}

            {step < 3 ? (
              <Button
                type="button"
                size="lg"
                className="h-10 font-normal"
                disabled={step === 1 ? !canGoNextFromStep1() : !canGoNextFromStep2()}
                onClick={goNext}
              >
                Next
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-10 font-normal"
                  disabled={saving}
                  onClick={() => void finishCreate(false)}
                >
                  Skip backlog
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="h-10 font-normal"
                  disabled={saving}
                  onClick={() => void finishCreate(true)}
                >
                  {saving ? "Saving…" : "Create workflow"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
