import { tool } from "ai";
import { z } from "zod";

import type { ChecklistCreateDraft, MutationPreview, MutationResult } from "@/lib/ai/mutation";
import type { AiToolContext } from "@/lib/server/ai/context";
import { createResource, getResourceById } from "@/lib/server/store";

export const subtaskRules = `Modul sub-task:
Tool: createChecklist.
- Jika pengguna minta breakdown sub-task/checklist baru, panggil createChecklist TANPA confirmed.
- UI menampilkan kartu. Jangan set confirmed=true sendiri.`;

export function subtaskTools(_ctx: AiToolContext) {
  return {
    createChecklist: tool({
      description:
        "Siapkan atau tambah item checklist. Tanpa confirmed=true hanya preview. Jangan set confirmed sendiri.",
      inputSchema: z.object({
        taskId: z.string().min(1).describe("ID task (misal AKL-008)"),
        title: z.string().min(1).describe("Judul item checklist / sub-task"),
        confirmed: z.boolean().optional().describe("Hanya true setelah user tap Konfirmasi di kartu."),
      }),
      execute: async ({
        taskId,
        title,
        confirmed,
      }): Promise<MutationPreview<ChecklistCreateDraft> | MutationResult<{ checklist_id: string; title: string }>> => {
        const existing = await getResourceById("Tasks", taskId);
        if (!existing) {
          return { kind: "result", action: "create", entity: "checklist", ok: false, error: `Task #${taskId} tidak ditemukan.` };
        }

        const draft: ChecklistCreateDraft = {
          taskId,
          taskTitle: existing.title,
          title: title.trim(),
        };

        if (!confirmed) {
          return { kind: "preview", action: "create", entity: "checklist", draft };
        }

        const created = await createResource("Task_Checklists", {
          task_id: taskId,
          title: title.trim(),
          is_completed: false,
          assignee_completed: false,
          pm_approved: false,
        });
        return {
          kind: "result",
          action: "create",
          entity: "checklist",
          ok: true,
          record: { checklist_id: created.checklist_id, title: created.title },
        };
      },
    }),
  };
}
