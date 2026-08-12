import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { activeTasks, isTaskOverdue, jakartaToday, visibleTasksForUser } from "@/lib/metrics";
import {
  CONTEXT_WINDOW,
  countUserMessages,
  getConversationForUser,
  getConversationMessages,
  getUserMemory,
  rememberUserFact,
  takeContextWindow,
  titleFromUserText,
  updateConversationTitle,
  upsertMessage,
  upsertUserMemory,
} from "@/lib/server/ai-chat-actions";
import { getCurrentUser } from "@/lib/server/auth";
import { DEFAULT_COMPANY_ID, getActiveCompanyContext } from "@/lib/server/company-context";
import { canApproveTaskAsLeader } from "@/lib/permissions";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import { progressForWorkflowStatus } from "@/lib/workflow";
import { createResource, getResourceById, listResource, updateResource } from "@/lib/server/store";
import type { AiMemoryFact } from "@/lib/types/ai-chat";
import type { Task } from "@/lib/types";
import { makeId } from "@/lib/utils";

function taskBelongsToCompany(task: Task, companyId: string) {
  const scoped = (task.company_id ?? "").trim();
  if (!scoped) return companyId === DEFAULT_COMPANY_ID;
  return scoped === companyId;
}

function textFromParts(parts: UIMessage["parts"] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function formatFacts(facts: AiMemoryFact[]): string {
  if (!facts.length) return "(belum ada fakta tersimpan)";
  return facts.map((fact) => `- ${fact.key}: ${fact.value}`).join("\n");
}

function buildSystemPrompt(input: {
  fullName: string;
  roleId: string;
  roleName: string;
  companyName: string;
  pagePath?: string;
  memorySummary: string;
  memoryFacts: AiMemoryFact[];
}) {
  const pageLine = input.pagePath?.trim()
    ? `Halaman aktif pengguna: ${input.pagePath.trim()}.`
    : "";
  const memorySummary = input.memorySummary.trim() || "(belum ada ringkasan memory)";

  const isSuperAdmin = input.roleId === "super_admin" || input.roleId === "org_owner";
  const isAdminOrLeader = isSuperAdmin || input.roleId === "admin" || input.roleId === "leader";

  const accessScopeRule = isSuperAdmin
    ? `HAK AKSES MULTI-TENANT & SUPERADMIN:
- Kamu adalah Super Admin. Kamu memiliki akses PENUH ke SELURUH task di semua divisi, semua user, dan semua perusahaan.
- Kamu dapat melihat, meng-update, mengubah deadline, mengubah deskripsi, atau menambah sub-task/checklist untuk APAPUN task yang ada.`
    : isAdminOrLeader
    ? `HAK AKSES ADMIN / LEADER:
- Kamu adalah Admin/Leader. Kamu memiliki akses mengelola task di seluruh tim/divisi dalam perusahaan ini.
- Kamu dapat melihat dan meng-update task anggota tim.`
    : `HAK AKSES ANGGOTA (STAFF/EMPLOYEE):
- Kamu adalah Staff/Employee biasa. Akses kamu terbatas HANYA pada task yang ditugaskan kepada kamu (getMyTasks).
- Kamu hanya dapat memperbarui task milikmu sendiri.`;

  return `Kamu adalah Asisten ATM, asisten AI di dalam aplikasi ERP internal Asia Karya Lumina.
Jawab singkat, jelas, dan dalam Bahasa Indonesia kecuali diminta bahasa lain.
Pengguna saat ini: ${input.fullName} (role_id: ${input.roleId}, role_name: ${input.roleName}).
Perusahaan aktif: ${input.companyName}.
${pageLine}

${accessScopeRule}

Memory pengguna (lintas chat, tersimpan dari percakapan sebelumnya — PAKAI ini secara aktif kalau relevan,
misalnya untuk menyapa sesuai preferensi, mengingat gaya kerja, atau konteks berulang. Jangan mengarang di luar
data ini. Update lewat tool rememberFact kalau user minta diingat sesuatu yang baru):
Ringkasan: ${memorySummary}
Fakta:
${formatFacts(input.memoryFacts)}

Kamu punya kemampuan (tools) untuk mengelola data task milik pengguna secara langsung:
1. getMyTasks: Ambil daftar task yang dapat diakses oleh pengguna.
2. updateTask: Perbarui data task (status, judul, deskripsi, priority, due_date, report/catatan).
3. createChecklist: Tambahkan sub-task / item checklist baru ke suatu task.

Panduan penggunaan tools:
- Jika pengguna ingin mengubah status, deadline, judul, deskripsi, atau priority task (misalnya: "ubah deadline ke 20 November 2027", "update status ke Done", "ganti deskripsi jadi X"), panggil tool updateTask langsung! Jangan bilang tidak punya akses.
- Jika pengguna minta dibuatkan breakdown sub-task/checklist baru untuk suatu task, panggil tool createChecklist!
- Setelah tool berhasil dijalankan, konfirmasikan ke pengguna dengan singkat dan jelas bahwa perubahan telah berhasil disimpan.
- JANGAN menulis daftar task sebagai markdown/bullet/nomor saat getMyTasks — UI sudah menampilkan kartu klikabel.
- Untuk data ERP di luar Task (absensi, email blast, dll) kamu belum punya akses, bilang terus terang belum bisa.`;
}

async function maybeRefreshMemory(input: {
  userId: string;
  conversationId: string;
  force?: boolean;
}) {
  try {
    const userCount = await countUserMessages(input.conversationId);
    // Refresh on the very first message (so memory starts populating right away) and then
    // every 3 messages after — 8 was too sparse, leaving ai_user_memory empty for most chats.
    if (!input.force && userCount !== 1 && userCount % 3 !== 0) return;

    const existing = await getUserMemory(input.userId);
    const recent = takeContextWindow(await getConversationMessages(input.conversationId), 16);
    const transcript = recent
      .map((row) => {
        const text = textFromParts(row.parts as UIMessage["parts"]);
        return text ? `${row.role}: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n");

    if (!transcript.trim()) return;

    const { text } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      prompt: `Perbarui ringkasan memory pengguna ERP berdasarkan chat berikut.
Simpan hanya fakta stabil (preferensi, nama panggilan, gaya kerja, konteks berulang).
Jangan simpan data sensitif (password, token, rahasia).
Balas HANYA JSON valid: {"summary":"...","facts":[{"key":"...","value":"..."}]}

Memory lama:
summary: ${existing?.summary ?? ""}
facts: ${JSON.stringify(existing?.facts ?? [])}

Chat terbaru:
${transcript}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const parsed = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      facts?: Array<{ key?: string; value?: string }>;
    };

    const facts: AiMemoryFact[] = Array.isArray(parsed.facts)
      ? parsed.facts
          .map((fact) => {
            const key = String(fact?.key ?? "").trim();
            const value = String(fact?.value ?? "").trim();
            if (!key || !value) return null;
            return { key, value, updated_at: new Date().toISOString() } satisfies AiMemoryFact;
          })
          .filter((fact): fact is AiMemoryFact => Boolean(fact))
      : (existing?.facts ?? []);

    await upsertUserMemory({
      userId: input.userId,
      summary: String(parsed.summary ?? existing?.summary ?? "").trim().slice(0, 1200),
      facts: facts.slice(-40),
    });
  } catch (error) {
    console.error("AI memory refresh failed", error);
  }
}

/**
 * POST /api/ai/chat
 * Streams a chat reply from the configured LLM. Auth-gated — no anonymous access.
 * Persists messages to the given conversation and injects ERP + profile memory context.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    messages?: UIMessage[];
    conversationId?: string;
    pagePath?: string;
  };

  const conversationId = String(body.conversationId ?? "").trim();
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
  }

  const conversation = await getConversationForUser(conversationId, user.user_id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const windowed = takeContextWindow(incoming, CONTEXT_WINDOW);
  const lastUser = [...windowed].reverse().find((message) => message.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "User message is required." }, { status: 400 });
  }

  const priorCount = (await getConversationMessages(conversationId)).length;
  await upsertMessage({
    messageId: lastUser.id || makeId("aim"),
    conversationId,
    role: "user",
    parts: lastUser.parts ?? [],
  });

  if (priorCount === 0 || conversation.title === "Chat baru") {
    const title = titleFromUserText(textFromParts(lastUser.parts));
    if (title !== "Chat baru") {
      await updateConversationTitle(conversationId, title).catch(() => undefined);
    }
  }

  const [context, memory] = await Promise.all([
    getActiveCompanyContext(user.user_id),
    getUserMemory(user.user_id),
  ]);

  let memoryTouched = false;

  const result = streamText({
    model: google("gemini-3.5-flash-lite"),
    system: buildSystemPrompt({
      fullName: user.full_name,
      roleId: user.role_id,
      roleName: user.role.role_name,
      companyName: context.company.name,
      pagePath: body.pagePath,
      memorySummary: memory?.summary ?? "",
      memoryFacts: memory?.facts ?? [],
    }),
    messages: await convertToModelMessages(windowed),
    stopWhen: stepCountIs(4),
    tools: {
      getMyTasks: tool({
        description: "Ambil daftar task aktif (belum selesai) yang dapat diakses pengguna.",
        inputSchema: z.object({}),
        execute: async () => {
          const companyId = context.company.id;
          const allTasks = await listResource("Tasks");
          const isSuperAdmin = user.role_id === "super_admin" || user.role_id === "org_owner";
          const isAdminOrLeader = isSuperAdmin || user.role_id === "admin" || user.role_id === "leader";

          const scoped = isSuperAdmin
            ? allTasks
            : isAdminOrLeader
            ? allTasks.filter((task) => taskBelongsToCompany(task, companyId))
            : visibleTasksForUser(allTasks, user.user_id).filter((task) =>
                taskBelongsToCompany(task, companyId),
              );

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
      updateTask: tool({
        description:
          "Perbarui data suatu task (status, title, description, priority, due_date, report/catatan).",
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
        }),
        execute: async ({ taskId, ...patch }) => {
          const existing = await getResourceById("Tasks", taskId);
          if (!existing) return { ok: false, error: `Task #${taskId} tidak ditemukan.` };

          const isSuperAdmin = user.role_id === "super_admin" || user.role_id === "org_owner";
          const isAdminOrLeader = isSuperAdmin || user.role_id === "admin" || user.role_id === "leader";
          const isAssigned = Array.isArray(existing.assigned_to) && existing.assigned_to.includes(user.user_id);

          if (!isSuperAdmin && !isAdminOrLeader && !isAssigned) {
            return { ok: false, error: `Anda tidak memiliki hak akses untuk meng-update task #${taskId}.` };
          }

          if (patch.status === "Finished" || patch.status === "Done") {
            const needsApproval = taskNeedsLeaderApproval(existing);
            const canApprove = canApproveTaskAsLeader(user);
            if (!canApprove && !(isAssigned && !needsApproval)) {
              return {
                ok: false,
                error: `Task #${taskId} memerlukan persetujuan Leader/Manager. Hanya Manager/Admin/Super Admin atau Worker tanpa leader approval yang dapat menyelesaikan task ini secara langsung.`,
              };
            }
          }

          const cleanPatch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(patch)) {
            if (v !== undefined) cleanPatch[k] = v;
          }

          if (cleanPatch.status === "Finished" || cleanPatch.status === "Done") {
            cleanPatch.progress = progressForWorkflowStatus("Finished");
            cleanPatch.completed_at = new Date().toISOString();
          }

          if (Object.keys(cleanPatch).length === 0) return { ok: true, task: existing };
          const updated = await updateResource("Tasks", taskId, cleanPatch);
          return { ok: true, task: updated };
        },
      }),
      createChecklist: tool({
        description: "Tambahkan sub-task / item checklist baru ke dalam task.",
        inputSchema: z.object({
          taskId: z.string().min(1).describe("ID task (misal AKL-008)"),
          title: z.string().min(1).describe("Judul item checklist / sub-task"),
        }),
        execute: async ({ taskId, title }) => {
          const existing = await getResourceById("Tasks", taskId);
          if (!existing) return { ok: false, error: `Task #${taskId} tidak ditemukan.` };
          const created = await createResource("Task_Checklists", {
            task_id: taskId,
            title,
            is_completed: false,
            assignee_completed: false,
            pm_approved: false,
          });
          return { ok: true, checklist: created };
        },
      }),
      rememberFact: tool({
        description:
          "Simpan fakta stabil tentang user (preferensi, nama panggilan, gaya kerja). Pakai saat user minta diingat.",
        inputSchema: z.object({
          key: z.string().min(1).max(80),
          value: z.string().min(1).max(400),
        }),
        execute: async ({ key, value }) => {
          memoryTouched = true;
          const saved = await rememberUserFact(user.user_id, key, value);
          return { ok: true, key, value, factCount: saved.facts.length };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: windowed,
    generateMessageId: () => makeId("aim"),
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || !responseMessage) return;
      try {
        await upsertMessage({
          messageId: responseMessage.id || makeId("aim"),
          conversationId,
          role: "assistant",
          parts: responseMessage.parts ?? [],
        });
        await maybeRefreshMemory({
          userId: user.user_id,
          conversationId,
          force: memoryTouched,
        });
      } catch (error) {
        console.error("persist AI assistant message failed", error);
      }
    },
  });
}
