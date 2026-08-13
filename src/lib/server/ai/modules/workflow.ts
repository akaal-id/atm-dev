import { tool } from "ai";
import { z } from "zod";

import type {
  MutationPreview,
  MutationResult,
  WorkflowCreateDraft,
  WorkflowDeleteDraft,
  WorkflowListItem,
  WorkflowOption,
  WorkflowUpdateDraft,
} from "@/lib/ai/mutation";
import { getMockWorkflowTemplate } from "@/lib/data/workflow-templates-mock";
import { hasAnyPermission } from "@/lib/permissions";
import type { AiToolContext } from "@/lib/server/ai/context";
import { resolveRoleTier } from "@/lib/server/ai/rules";
import { nextTicketIds } from "@/lib/server/ai/ticket-id";
import { createResource, deleteResource, getResourceById, listResource, updateResource } from "@/lib/server/store";
import type { Project, Task, Workflow, WorkflowColumn } from "@/lib/types";
import { makeId } from "@/lib/utils";
import { normalizeWorkflowColumns } from "@/lib/workflow-normalize";

const PRESET_IDS = {
  akaal: "wft_default_akaal",
  creative: "wft_creative_sprint",
  ops: "wft_ops_simple",
} as const;

type PresetKey = keyof typeof PRESET_IDS;

function canWriteWorkflow(roleId: AiToolContext["user"]["role_id"]) {
  return hasAnyPermission(roleId, ["tasks:manage", "projects:manage"]);
}

function clonePresetColumns(preset: PresetKey): WorkflowColumn[] {
  const template = getMockWorkflowTemplate(PRESET_IDS[preset]);
  return template.columns.map((column, order_index) => ({
    id: makeId("wfc"),
    name: column.name,
    order_index,
    is_2stage_approval_trigger: column.is_2stage_approval_trigger,
  }));
}

function columnsFromNames(names: string[]): WorkflowColumn[] {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, order_index) => ({
      id: makeId("wfc"),
      name,
      order_index,
      is_2stage_approval_trigger: false,
    }));
}

function presetLabel(preset: PresetKey) {
  return getMockWorkflowTemplate(PRESET_IDS[preset]).name;
}

export async function listAccessibleWorkflows(ctx: AiToolContext): Promise<WorkflowOption[]> {
  const [workflows, projects] = await Promise.all([
    listResource("Workflows", { select: "workflow_id,name,project_id,company_id" }),
    listResource("Projects", { select: "project_id,project_name,company_id" }),
  ]);
  const { isSuperAdmin } = resolveRoleTier(ctx.user.role_id);
  const projectName = new Map((projects as Project[]).map((row) => [row.project_id, row.project_name]));

  return (workflows as Workflow[])
    .filter((workflow) => {
      if (isSuperAdmin) return true;
      const scoped = (workflow.company_id ?? "").trim();
      return !scoped || scoped === ctx.companyId;
    })
    .map((workflow) => ({
      workflow_id: workflow.workflow_id,
      name: workflow.name,
      project_id: workflow.project_id || null,
      project_name: workflow.project_id ? projectName.get(workflow.project_id) : undefined,
    }));
}

async function listWorkflowCards(ctx: AiToolContext): Promise<WorkflowListItem[]> {
  const [workflows, projects] = await Promise.all([listResource("Workflows"), listResource("Projects")]);
  const { isSuperAdmin } = resolveRoleTier(ctx.user.role_id);
  const projectName = new Map((projects as Project[]).map((row) => [row.project_id, row.project_name]));

  return (workflows as Workflow[])
    .filter((workflow) => {
      if (isSuperAdmin) return true;
      const scoped = (workflow.company_id ?? "").trim();
      return !scoped || scoped === ctx.companyId;
    })
    .map((workflow) => ({
      workflow_id: workflow.workflow_id,
      name: workflow.name,
      project_id: workflow.project_id || null,
      project_name: workflow.project_id ? projectName.get(workflow.project_id) : undefined,
      column_names: normalizeWorkflowColumns(workflow.columns).map((column) => column.name),
    }));
}

export const workflowRules = `Modul workflow:
Tools: listWorkflows, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow.
- list/get: tampil sebagai kartu. Jangan tulis daftar board sebagai markdown.
- create/update/delete: panggil TANPA confirmed dulu. UI kartu konfirmasi. Jangan set confirmed=true sendiri.
- Membuat task BARU wajib punya workflow. Kalau user belum menyebut board, panggil createTask tanpa workflowId ATAU listWorkflows, jangan menebak.
- Kalau user minta board baru, createWorkflow (preview). Default preset akaal (Akaal Standard) kecuali user minta lain.
- Jangan mutasi status board (Not Started/In Progress/Completed) — itu dihitung dari task.`;

export function workflowTools(ctx: AiToolContext) {
  const { user, companyId } = ctx;

  return {
    listWorkflows: tool({
      description: "Daftar workflow/board yang tersedia. Pakai sebelum membuat task atau saat user minta lihat board.",
      inputSchema: z.object({}),
      execute: async () => {
        const workflows = await listWorkflowCards(ctx);
        return { workflows };
      },
    }),
    getWorkflow: tool({
      description: "Detail satu workflow/board (nama, project, kolom).",
      inputSchema: z.object({
        workflowId: z.string().min(1),
      }),
      execute: async ({ workflowId }) => {
        const cards = await listWorkflowCards(ctx);
        const workflow = cards.find((row) => row.workflow_id === workflowId);
        if (!workflow) return { ok: false as const, error: `Workflow ${workflowId} tidak ditemukan.` };
        return { ok: true as const, workflow };
      },
    }),
    createWorkflow: tool({
      description:
        "Siapkan atau buat board baru. Tanpa confirmed=true hanya preview. Jangan set confirmed sendiri.",
      inputSchema: z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        projectId: z.string().optional(),
        preset: z.enum(["akaal", "creative", "ops"]).optional(),
        customColumns: z.array(z.string().min(1)).min(2).optional(),
        ticketPrefix: z.string().optional(),
        sprintStart: z.string().optional(),
        sprintEnd: z.string().optional(),
        backlogTitles: z.array(z.string().min(1)).optional(),
        confirmed: z.boolean().optional(),
      }),
      execute: async ({
        name,
        description,
        projectId,
        preset,
        customColumns,
        ticketPrefix,
        sprintStart,
        sprintEnd,
        backlogTitles,
        confirmed,
      }): Promise<MutationPreview<WorkflowCreateDraft> | MutationResult<{ workflow_id: string; name: string }>> => {
        if (!canWriteWorkflow(user.role_id)) {
          return { kind: "result", action: "create", entity: "workflow", ok: false, error: "Anda tidak punya izin membuat workflow." };
        }

        const resolvedPreset: PresetKey = preset ?? "akaal";
        const projects = (await listResource("Projects")) as Project[];
        const project = projects.find((row) => row.project_id === String(projectId ?? "").trim());
        const columns = customColumns && customColumns.length >= 2 ? columnsFromNames(customColumns) : clonePresetColumns(resolvedPreset);
        const prefix =
          String(ticketPrefix ?? "").trim().toUpperCase() || String(project?.ticket_id_prefix ?? "").trim().toUpperCase();

        const draft: WorkflowCreateDraft = {
          name: name.trim(),
          description: description?.trim() ?? "",
          projectId: project?.project_id ?? "",
          projectName: project?.project_name ?? "No project",
          preset: resolvedPreset,
          presetLabel: customColumns && customColumns.length >= 2 ? "Custom" : presetLabel(resolvedPreset),
          column_names: columns.map((column) => column.name),
          ticketPrefix: prefix,
          sprintStart: sprintStart?.trim() ?? "",
          sprintEnd: sprintEnd?.trim() ?? "",
          backlogTitles: (backlogTitles ?? []).map((title) => title.trim()).filter(Boolean),
          customColumns: customColumns && customColumns.length >= 2 ? columns.map((column) => column.name) : undefined,
        };

        if (!confirmed) {
          return { kind: "preview", action: "create", entity: "workflow", draft };
        }

        const created = await createResource("Workflows", {
          name: draft.name,
          description: draft.description,
          status: "Not Started",
          project_id: draft.projectId,
          company_id: companyId,
          columns,
          sprint_start: draft.sprintStart,
          sprint_end: draft.sprintEnd,
          ticket_id_prefix: draft.ticketPrefix,
          template_id: customColumns && customColumns.length >= 2 ? "" : PRESET_IDS[resolvedPreset],
          template_name: draft.presetLabel,
          inherit_project_tasks: false,
        });

        if (draft.backlogTitles.length > 0) {
          const ids = await nextTicketIds(draft.projectId, draft.name, draft.backlogTitles.length);
          const dueDate = draft.sprintEnd || "";
          await Promise.all(
            draft.backlogTitles.map((title, index) =>
              createResource("Tasks", {
                task_id: ids[index],
                title,
                description: "",
                project_id: draft.projectId,
                workflow_id: created.workflow_id,
                company_id: companyId,
                assigned_by: user.user_id,
                assigned_to: [user.user_id],
                priority: "Medium",
                status: "To Do",
                due_date: dueDate,
                progress: 0,
                labels: [],
              }),
            ),
          );
        }

        return {
          kind: "result",
          action: "create",
          entity: "workflow",
          ok: true,
          record: { workflow_id: created.workflow_id, name: created.name },
        };
      },
    }),
    updateWorkflow: tool({
      description:
        "Siapkan atau simpan perubahan nama/deskripsi board. Tanpa confirmed=true hanya preview. Jangan set confirmed sendiri.",
      inputSchema: z.object({
        workflowId: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        confirmed: z.boolean().optional(),
      }),
      execute: async ({
        workflowId,
        name,
        description,
        confirmed,
      }): Promise<MutationPreview<WorkflowUpdateDraft> | MutationResult<{ workflow_id: string; name: string }>> => {
        if (!canWriteWorkflow(user.role_id)) {
          return { kind: "result", action: "update", entity: "workflow", ok: false, error: "Anda tidak punya izin mengubah workflow." };
        }

        const existing = (await getResourceById("Workflows", workflowId)) as Workflow | undefined;
        if (!existing) {
          return { kind: "result", action: "update", entity: "workflow", ok: false, error: `Workflow ${workflowId} tidak ditemukan.` };
        }

        const { isSuperAdmin } = resolveRoleTier(user.role_id);
        const scoped = (existing.company_id ?? "").trim();
        if (!isSuperAdmin && scoped && scoped !== companyId) {
          return { kind: "result", action: "update", entity: "workflow", ok: false, error: "Workflow ini di luar perusahaan aktif." };
        }

        const draft: WorkflowUpdateDraft = {
          workflowId,
          name: name?.trim() || existing.name,
          description: description !== undefined ? description.trim() : existing.description || "",
        };

        if (!confirmed) {
          return { kind: "preview", action: "update", entity: "workflow", draft };
        }

        const updated = await updateResource("Workflows", workflowId, {
          name: draft.name,
          description: draft.description,
        });
        return {
          kind: "result",
          action: "update",
          entity: "workflow",
          ok: true,
          record: { workflow_id: workflowId, name: String(updated?.name ?? draft.name) },
        };
      },
    }),
    deleteWorkflow: tool({
      description:
        "Siapkan atau hapus board. Tanpa confirmed=true hanya preview. Task di board tidak ikut terhapus. Jangan set confirmed sendiri.",
      inputSchema: z.object({
        workflowId: z.string().min(1),
        confirmed: z.boolean().optional(),
      }),
      execute: async ({
        workflowId,
        confirmed,
      }): Promise<MutationPreview<WorkflowDeleteDraft> | MutationResult<{ workflow_id: string; name: string }>> => {
        if (!canWriteWorkflow(user.role_id)) {
          return { kind: "result", action: "delete", entity: "workflow", ok: false, error: "Anda tidak punya izin menghapus workflow." };
        }

        const existing = (await getResourceById("Workflows", workflowId)) as Workflow | undefined;
        if (!existing) {
          return { kind: "result", action: "delete", entity: "workflow", ok: false, error: `Workflow ${workflowId} tidak ditemukan.` };
        }

        const { isSuperAdmin } = resolveRoleTier(user.role_id);
        const scoped = (existing.company_id ?? "").trim();
        if (!isSuperAdmin && scoped && scoped !== companyId) {
          return { kind: "result", action: "delete", entity: "workflow", ok: false, error: "Workflow ini di luar perusahaan aktif." };
        }

        const tasks = (await listResource("Tasks")) as Task[];
        const taskCount = tasks.filter((task) => task.workflow_id === workflowId).length;
        const draft: WorkflowDeleteDraft = {
          workflowId,
          name: existing.name,
          taskCount,
        };
        const warnings =
          taskCount > 0
            ? [`${taskCount} task masih terhubung. Menghapus board tidak menghapus task — mereka jadi tanpa board.`]
            : undefined;

        if (!confirmed) {
          return { kind: "preview", action: "delete", entity: "workflow", draft, warnings };
        }

        const deleted = await deleteResource("Workflows", workflowId);
        if (!deleted) {
          return { kind: "result", action: "delete", entity: "workflow", ok: false, error: "Gagal menghapus workflow." };
        }
        return {
          kind: "result",
          action: "delete",
          entity: "workflow",
          ok: true,
          record: { workflow_id: workflowId, name: existing.name },
        };
      },
    }),
  };
}
