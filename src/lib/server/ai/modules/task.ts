import { tool } from "ai";
import { z } from "zod";

import type { MutationPreview, MutationResult, NeedsWorkflowResult, TaskCreateDraft, TaskUpdateDraft } from "@/lib/ai/mutation";
import type { AiTaskDetail, AiTaskPickItem } from "@/lib/ai/task-detail";
import { activeTasks, isTaskOverdue, jakartaToday, visibleTasksForUser } from "@/lib/metrics";
import { canApproveTaskAsLeader } from "@/lib/permissions";
import type { AiToolContext } from "@/lib/server/ai/context";
import { listAccessibleWorkflows } from "@/lib/server/ai/modules/workflow";
import { resolveRoleTier } from "@/lib/server/ai/rules";
import { nextTicketId } from "@/lib/server/ai/ticket-id";
import { DEFAULT_COMPANY_ID } from "@/lib/server/company-context";
import { createResource, getResourceById, listResource, updateResource } from "@/lib/server/store";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { Project, Task, TaskChecklist, TaskComment, User, Workflow } from "@/lib/types";
import { progressForWorkflowStatus } from "@/lib/workflow";

function taskBelongsToCompany(task: Task, companyId: string) {
  const scoped = (task.company_id ?? "").trim();
  if (!scoped) return companyId === DEFAULT_COMPANY_ID;
  return scoped === companyId;
}

function display(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function userName(users: User[], userId: string) {
  return users.find((row) => row.user_id === userId)?.full_name || userId || "—";
}

function canReadTask(
  task: Task,
  ctx: { userId: string; companyId: string; isSuperAdmin: boolean; isAdminOrLeader: boolean },
) {
  if (ctx.isSuperAdmin) return true;
  if (!taskBelongsToCompany(task, ctx.companyId)) return false;
  if (ctx.isAdminOrLeader) return true;
  const assigned = Array.isArray(task.assigned_to) && task.assigned_to.includes(ctx.userId);
  return assigned || task.assigned_by === ctx.userId;
}

async function buildTaskDetail(task: Task): Promise<AiTaskDetail> {
  const [projects, workflows, users, checklists, comments] = await Promise.all([
    listResource("Projects"),
    listResource("Workflows"),
    listResource("Users"),
    listResource("Task_Checklists"),
    listResource("Task_Comments"),
  ]);

  const project = (projects as Project[]).find((row) => row.project_id === task.project_id);
  const workflow = (workflows as Workflow[]).find((row) => row.workflow_id === (task.workflow_id ?? ""));
  const userRows = users as User[];

  const taskComments = (comments as TaskComment[])
    .filter((row) => row.task_id === task.task_id)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 3);

  return {
    task_id: task.task_id,
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    due_date: task.due_date || "",
    is_due_today: task.due_date === jakartaToday(),
    is_overdue: isTaskOverdue(task),
    progress: Number(task.progress ?? 0),
    project_name: project?.project_name ?? "No project",
    workflow_name: workflow?.name ?? "",
    assignees: (Array.isArray(task.assigned_to) ? task.assigned_to : []).map((id) => userName(userRows, id)),
    assigned_by: userName(userRows, task.assigned_by),
    labels: Array.isArray(task.labels) ? task.labels : [],
    report: task.report?.trim() ?? "",
    created_at: task.created_at,
    checklist: (checklists as TaskChecklist[])
      .filter((row) => row.task_id === task.task_id)
      .map((row) => ({
        checklist_id: row.checklist_id,
        title: row.title,
        is_completed: Boolean(row.is_completed || row.assignee_completed),
      })),
    comments: taskComments.map((row) => ({
      comment_id: row.comment_id,
      author: userName(userRows, row.user_id),
      comment: row.comment,
      created_at: row.created_at,
    })),
  };
}

export const taskRules = `Modul task:
Tools: getMyTasks, getTask, updateTask, createTask.
- Filter daftar ≠ hak akses. getMyTasks default scope=assigned (task yang assigned ke user ini), termasuk Super Admin.
- "Task saya", "pekerjaan saya", overdue saya → scope=assigned.
- "Semua task", "task tim", "yang bisa saya akses" → scope=accessible (staff tetap assigned).
- Memory/preferensi user mengalahkan asumsi role.
- JANGAN menulis daftar task sebagai markdown/bullet/nomor saat getMyTasks — UI sudah menampilkan kartu klikabel.
- Detail satu task: panggil getTask (taskId atau query judul). JANGAN dump detail sebagai markdown — UI kartu detail.
- createTask / updateTask: panggil TANPA confirmed dulu. UI menampilkan kartu konfirmasi. JANGAN set confirmed=true sendiri.
- createTask WAJIB workflowId. Kalau belum ada, panggil tanpa workflowId (kind=needsWorkflow). Jangan tebak board.
- Kalau user minta task baru tapi belum ada board cocok, tawarkan buat workflow dulu (createWorkflow preview), baru createTask.`;

export function taskTools(ctx: AiToolContext) {
  const { user, companyId } = ctx;
  const { isSuperAdmin, isAdminOrLeader } = resolveRoleTier(user.role_id);

  return {
    getMyTasks: tool({
      description:
        "Daftar task aktif. Default assigned ke user ini. Pakai scope=accessible hanya jika user minta semua task / task tim / yang bisa diakses.",
      inputSchema: z.object({
        scope: z
          .enum(["assigned", "accessible"])
          .optional()
          .describe("assigned = milik saya (default). accessible = semua yang role boleh lihat."),
      }),
      execute: async ({ scope }) => {
        const filter = scope === "accessible" && (isSuperAdmin || isAdminOrLeader) ? "accessible" : "assigned";
        const allTasks = await listResource("Tasks");
        const scoped =
          filter === "assigned"
            ? visibleTasksForUser(allTasks, user.user_id).filter((task) => taskBelongsToCompany(task, companyId) || isSuperAdmin)
            : isSuperAdmin
              ? allTasks
              : allTasks.filter((task) => taskBelongsToCompany(task, companyId));

        return activeTasks(scoped).map((task) => ({
          task_id: task.task_id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          is_due_today: task.due_date === jakartaToday(),
          is_overdue: isTaskOverdue(task),
        }));
      },
    }),
    getTask: tool({
      description:
        "Detail satu task untuk ditampilkan sebagai kartu di chat. Pakai taskId (AKL-008) atau query judul. Jangan tulis ulang sebagai markdown.",
      inputSchema: z.object({
        taskId: z.string().min(1).optional().describe("ID task, misal AKL-008"),
        query: z.string().min(1).optional().describe("Cari dari judul kalau ID tidak diketahui"),
      }),
      execute: async ({
        taskId,
        query,
      }): Promise<
        | { ok: true; task: AiTaskDetail }
        | { ok: false; error: string }
        | { ok: false; pick: true; tasks: AiTaskPickItem[] }
      > => {
        const access = {
          userId: user.user_id,
          companyId,
          isSuperAdmin,
          isAdminOrLeader,
        };
        const allTasks = (await listResource("Tasks")) as Task[];
        const readable = allTasks.filter((task) => canReadTask(task, access));
        const id = String(taskId ?? "").trim();
        const needle = String(query ?? "").trim().toLowerCase();

        let matches: Task[] = [];
        if (id) {
          const exact = readable.find((task) => task.task_id.toLowerCase() === id.toLowerCase());
          if (exact) matches = [exact];
        }
        if (matches.length === 0 && needle) {
          matches = readable.filter(
            (task) =>
              task.task_id.toLowerCase().includes(needle) || task.title.toLowerCase().includes(needle),
          );
        }

        if (matches.length === 0) {
          return { ok: false, error: id || query ? "Task tidak ditemukan atau tidak bisa diakses." : "Berikan taskId atau judul." };
        }
        if (matches.length > 1) {
          return {
            ok: false,
            pick: true,
            tasks: matches.slice(0, 8).map((task) => ({
              task_id: task.task_id,
              title: task.title,
              status: task.status,
            })),
          };
        }

        return { ok: true, task: await buildTaskDetail(matches[0]) };
      },
    }),
    updateTask: tool({
      description:
        "Siapkan atau terapkan update task. Tanpa confirmed=true hanya preview kartu. Jangan set confirmed sendiri.",
      inputSchema: z.object({
        taskId: z.string().min(1).describe("ID task (misal AKL-008 atau UUID)"),
        status: z
          .enum([
            "To Do",
            "In Progress",
            "Waiting Approval",
            "Ready",
            "Finished",
            "Need Revision",
            "Approved",
            "Done",
            "Late",
            "Overdue",
            "Cancelled",
          ])
          .optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
        due_date: z.string().optional().describe("Format YYYY-MM-DD"),
        report: z.string().optional(),
        confirmed: z.boolean().optional().describe("Hanya true setelah user tap Konfirmasi di kartu."),
      }),
      execute: async ({ taskId, confirmed, ...patch }): Promise<MutationPreview<TaskUpdateDraft> | MutationResult<{ task_id: string; title: string }>> => {
        const existing = await getResourceById("Tasks", taskId);
        if (!existing) return { kind: "result", action: "update", entity: "task", ok: false, error: `Task #${taskId} tidak ditemukan.` };

        const isAssigned = Array.isArray(existing.assigned_to) && existing.assigned_to.includes(user.user_id);

        if (!isSuperAdmin && !isAdminOrLeader && !isAssigned) {
          return { kind: "result", action: "update", entity: "task", ok: false, error: `Anda tidak memiliki hak akses untuk meng-update task #${taskId}.` };
        }

        if (patch.status === "Finished" || patch.status === "Done") {
          const needsApproval = taskNeedsLeaderApproval(existing);
          const canApprove = canApproveTaskAsLeader(user);
          if (!canApprove && !(isAssigned && !needsApproval)) {
            return {
              kind: "result",
              action: "update",
              entity: "task",
              ok: false,
              error: `Task #${taskId} memerlukan persetujuan Leader/Manager.`,
            };
          }
        }

        const changes: TaskUpdateDraft["changes"] = [];
        const fieldMap: Array<[keyof typeof patch, string, unknown]> = [
          ["title", "Judul", existing.title],
          ["description", "Deskripsi", existing.description],
          ["status", "Status", existing.status],
          ["priority", "Priority", existing.priority],
          ["due_date", "Deadline", existing.due_date],
          ["report", "Catatan", existing.report],
        ];
        for (const [key, label, previous] of fieldMap) {
          const next = patch[key];
          if (next === undefined) continue;
          if (display(next) === display(previous)) continue;
          changes.push({ field: label, from: display(previous), to: display(next) });
        }

        const draft: TaskUpdateDraft = {
          taskId,
          title: existing.title,
          changes,
          status: patch.status,
          nextTitle: patch.title,
          description: patch.description,
          priority: patch.priority,
          due_date: patch.due_date,
          report: patch.report,
        };

        if (!confirmed) {
          return { kind: "preview", action: "update", entity: "task", draft };
        }

        const cleanPatch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(patch)) {
          if (value !== undefined) cleanPatch[key] = value;
        }

        if (cleanPatch.status === "Finished" || cleanPatch.status === "Done") {
          cleanPatch.progress = progressForWorkflowStatus("Finished");
          cleanPatch.completed_at = new Date().toISOString();
        }

        if (Object.keys(cleanPatch).length === 0) {
          return { kind: "result", action: "update", entity: "task", ok: true, record: { task_id: existing.task_id, title: existing.title } };
        }
        const updated = await updateResource("Tasks", taskId, cleanPatch);
        return {
          kind: "result",
          action: "update",
          entity: "task",
          ok: true,
          record: { task_id: updated?.task_id ?? taskId, title: String(updated?.title ?? existing.title) },
        };
      },
    }),
    createTask: tool({
      description:
        "Siapkan atau buat task baru. Wajib workflowId. Tanpa confirmed=true hanya preview. Jangan set confirmed sendiri.",
      inputSchema: z.object({
        title: z.string().min(1).describe("Judul task"),
        workflowId: z.string().min(1).optional().describe("ID workflow/board. Wajib sebelum create."),
        description: z.string().optional(),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
        due_date: z.string().optional().describe("Format YYYY-MM-DD"),
        confirmed: z.boolean().optional().describe("Hanya true setelah user tap Konfirmasi di kartu."),
      }),
      execute: async ({
        title,
        workflowId,
        description,
        priority,
        due_date,
        confirmed,
      }): Promise<NeedsWorkflowResult | MutationPreview<TaskCreateDraft> | MutationResult<{ task_id: string; title: string; workflow_name: string }>> => {
        const [workflows, projects] = await Promise.all([listAccessibleWorkflows(ctx), listResource("Projects")]);
        const chosenId = String(workflowId ?? "").trim();
        if (!chosenId) {
          return {
            kind: "needsWorkflow",
            message: "Pilih workflow/board dulu.",
            title: title.trim(),
            workflows,
          };
        }

        const workflow = workflows.find((row) => row.workflow_id === chosenId);
        if (!workflow) {
          return {
            kind: "needsWorkflow",
            message: `Workflow ${chosenId} tidak ditemukan. Pilih dari daftar.`,
            title: title.trim(),
            workflows,
          };
        }

        const project = (projects as Project[]).find((row) => row.project_id === (workflow.project_id || ""));
        const draft: TaskCreateDraft = {
          title: title.trim(),
          workflowId: workflow.workflow_id,
          workflowName: workflow.name,
          projectId: workflow.project_id || "",
          projectName: project?.project_name ?? (workflow.project_id ? workflow.project_id : "No project"),
          description: description?.trim() ?? "",
          priority: priority ?? "Medium",
          due_date: due_date ?? "",
        };

        if (!confirmed) {
          return { kind: "preview", action: "create", entity: "task", draft };
        }

        const projectId = workflow.project_id || "";
        const taskId = await nextTicketId(projectId, title);
        const created = await createResource("Tasks", {
          task_id: taskId,
          title: title.trim(),
          description: description?.trim() ?? "",
          project_id: projectId,
          workflow_id: workflow.workflow_id,
          company_id: companyId,
          assigned_by: user.user_id,
          assigned_to: [user.user_id],
          priority: priority ?? "Medium",
          status: "To Do",
          due_date: due_date ?? "",
          progress: 0,
          labels: [],
        });

        return {
          kind: "result",
          action: "create",
          entity: "task",
          ok: true,
          record: {
            task_id: created.task_id,
            title: created.title,
            workflow_name: workflow.name,
          },
        };
      },
    }),
  };
}
