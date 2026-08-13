# AI Assistant — Status (Yang Sudah Dibuat)

Living doc. Update tiap ada perubahan signifikan pada fitur AI Assistant (ATM chat).
Pasangan doc: [ai-assistant-roadmap.md](./ai-assistant-roadmap.md) untuk rencana ke depan.

## 1. Struktur file

| Layer | File | Peran |
|---|---|---|
| DB migration | `docs/migrations/ai-assistant-chat.sql` | Skema tabel `ai_conversations`, `ai_messages`, `ai_user_memory` |
| Types | `src/lib/types/ai-chat.ts` | `AiConversation`, `AiMessageRow`, `AiUserMemory`, `AiMemoryFact`, dst. |
| Data layer | `src/lib/server/ai-chat-actions.ts` | Wrapper Supabase REST: CRUD conversation, message, user memory facts |
| Data layer | `src/lib/server/supabase-rest.ts` | Helper REST client ke Supabase |
| API | `src/app/api/ai/conversations/route.ts` | List + create conversation |
| API | `src/app/api/ai/conversations/[id]/route.ts` | Get + delete satu conversation (+ messages-nya) |
| API | `src/app/api/ai/chat/route.ts` | HTTP: auth, persist, stream. Prompt/tools dari registry |
| AI | `src/lib/server/ai/registry.ts` | Gabung modules → system prompt + tools (assert key unik) |
| AI | `src/lib/server/ai/system-prompt.ts` | Rakit prompt dari base + rules + modul |
| AI | `src/lib/server/ai/base.ts`, `rules.ts` | Identity + rule akses role + rule lintas-modul |
| AI | `src/lib/server/ai/modules/task.ts` | `getMyTasks`, `getTask`, `updateTask`, `createTask` (preview → confirm) |
| AI | `src/lib/server/ai/modules/subtask.ts` | `createChecklist` (preview → confirm) |
| AI | `src/lib/server/ai/modules/workflow.ts` | `listWorkflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow` |
| AI | `src/lib/server/ai/ticket-id.ts` | Generator ID tiket (`AKL-001`) |
| AI | `src/lib/ai/mutation.ts` | Kontrak preview/result + pesan `[ATM_CONFIRM]` |
| AI | `src/lib/server/ai/modules/memory.ts` | `rememberFact` + refresh ringkasan memory |
| AI | `src/lib/server/ai/parts.ts` | Helper parts: teks, audio stub persist |
| Routes | `src/app/(workspace)/ai-chat/page.tsx` | Fallback halaman penuh (`variant="page"`) |
| Routes | `src/app/(workspace)/@modal/(.)ai-chat/page.tsx` | Overlay intercept (`variant="overlay"`) |
| Routes | `src/app/(workspace)/@modal/default.tsx`, `@modal/ai-chat/page.tsx` | Slot kosong + fallback biar overlay tidak nyangkut |
| UI | `src/components/app/ai-assistant/ai-chat-view/` | Thread, riwayat, composer, mic, markdown |
| UI | `src/components/app/ai-assistant/ai-mutation-card/` | Kartu konfirmasi mutasi + daftar workflow |
| UI | `src/components/app/ai-assistant/ai-task-detail-card/` | Kartu detail satu task di chat |
| UI | `src/components/app/ai-assistant/ai-chat-fab/` | FAB → `Link` ke `/ai-chat?from=…` |

Widget lama `ai-assistant-widget` sudah dihapus.

## 2. Cara kerja sekarang

- **Route `/ai-chat`**, bukan drawer `setOpen`. Klik FAB = client navigation (`next/link`).
  - Dari halaman workspace → intercepting route merender overlay di atas halaman asal. Close = `router.back()`.
  - Refresh / buka URL langsung → halaman penuh.
- **Chat baru tiap buka FAB.** Percakapan di DB baru dibuat saat pesan pertama (teks atau suara). Riwayat di-fetch saat sidebar jam dibuka.
- **System prompt + tools**: `createAiRegistry()` di `src/lib/server/ai/`. `route.ts` hanya HTTP.
- **Tools**: `getMyTasks` (default **assigned**), `getTask` (kartu detail di chat), `updateTask`, `createTask` (wajib workflow), `createChecklist`, `listWorkflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow`, `rememberFact`.
- **Mutasi lewat kartu**: create/update/delete task, checklist, dan workflow **tidak nulis** sampai user tap Konfirmasi. Tool pertama mengembalikan `{ kind: "preview" }`. Tombol kirim pesan `[ATM_CONFIRM]` + JSON `confirmed: true`. Model dilarang set `confirmed` sendiri.
- **Create task tanpa board**: `{ kind: "needsWorkflow" }` + daftar board yang bisa diklik, lalu preview task.
- **Pesan suara**: mic di composer → Gemini. Byte audio tidak disimpan di DB (hanya penanda “Pesan suara”).
- **Memory per-user**: `ai_user_memory.facts` tetap dipakai. Preferensi personal mengalahkan asumsi role (contoh: Super Admin + "task saya" = assigned). Jangan hapus fact hanya karena rule sudah ada di kode.
- **Shell**: kolom konten workspace yang scroll (`overflow-y` di `.content`), bukan scrollbar window. Overlay chat mengunci body.

## 3. Bug / UX yang sudah diperbaiki

**Klik riwayat → tampilan “chat baru”.** `useChat` id-race: `setConversationId` + `setMessages` di cycle yang sama. Fix: `chatSessionId = useId()` konstan, terpisah dari `conversationId`. Sekarang di `ai-chat-view.tsx`.

**FAB `<a href>` bikin hard nav** (intercept overlay tidak jalan, header fallback ke “Command center”). Fix: `next/link`.

**Bullet markdown tidak kelihatan** (reset `list-style` Tailwind + marker di luar box). Fix: bullet/nomor via `::before` di `.mdList`.

## 4. Keputusan arsitektur

`route.ts` monolith sudah dipecah ke `src/lib/server/ai/` (registry + modules). Filter prompt per `pagePath` belum dipasang — semua modul task/subtask/workflow/memory masih ikut tiap request. Write tools memakai preview + konfirmasi kartu, bukan `needsApproval` native AI SDK (belum ada di `ai@7` yang dipakai).
