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
| API | `src/app/api/ai/chat/route.ts` | Endpoint chat utama: `streamText`, system prompt, tools, penyimpanan memory |
| UI | `src/components/app/ai-assistant/ai-assistant-widget/` | Widget chat — FAB + drawer/modal, riwayat, composer |

## 2. Cara kerja sekarang

- **Modal/drawer**, dibuka lewat FAB (`MessageCircle`) yang muncul di seluruh halaman app.
- **Riwayat chat**: sidebar di dalam drawer, load dari `/api/ai/conversations`. Klik item → `loadConversation()` fetch pesan lama, replace state chat.
- **System prompt**: dirakit inline di `buildSystemPrompt()` ([route.ts](../src/app/api/ai/chat/route.ts)) — identity + role-based access rule (Super Admin / Admin-Leader / Staff) + injeksi memory user (summary + facts) ke dalam satu string besar. Belum dimodulkan.
- **Tools** yang sudah ada: `getMyTasks` (list task milik user aktif), `rememberFact` (simpan fakta baru ke `ai_user_memory`).
- **Memory per-user**: tabel `ai_user_memory.facts` (key-value), diisi lewat tool `rememberFact` atau manual. Contoh fact aktif: `task_query_rule_strict` milik user Afif A — soal filter "task saya" vs "semua task" berdasar role.
  - ⚠️ Diketahui ada 3 fact yang isinya tumpang tindih untuk rule yang sama (`task_query_preference`, `task_query_rule`, `task_query_rule_strict`) — belum dirapikan. Lihat roadmap.

## 3. Bug yang sudah diperbaiki

**Klik riwayat chat → tampilan malah "chat baru" (padahal indikator sidebar sudah benar).**

- **Akar masalah**: [ai-assistant-widget.tsx](../src/components/app/ai-assistant/ai-assistant-widget/ai-assistant-widget.tsx) pakai `useChat({ id: conversationId ?? "ai-pending", ... })`. `useChat` (AI SDK) simpan `messages` di internal store yang di-*key* oleh `id`. Saat `loadConversation()` manggil `setConversationId(newId)` dan `setMessages(...)` di render-cycle yang sama, `setMessages` masih nunjuk ke store-entry `id` **lama** (React belum re-render). Begitu re-render jalan dengan `id` baru, SDK cari entry `id` itu — kosong.
- **Fix**: `id` internal `useChat` dipisah dari `conversationId` — dibikin konstan pakai `chatSessionId = useId()` (server tidak pernah baca field `id` dari body request, cuma pakai `conversationId` yang dikirim terpisah lewat ref — jadi aman dijadikan konstan).
- **File yang diubah**: `ai-assistant-widget.tsx` — deklarasi `chatSessionId`, dan `useChat({ id: chatSessionId, transport })`.

## 4. Keputusan arsitektur yang sudah disepakati (belum diimplementasi)

Refactor `route.ts` (monolith) jadi modular per domain:

```
src/lib/server/ai/
├── system-prompt.ts   # Builder utama
├── registry.ts        # Gabungin rules + tools semua modul
├── base.ts             # Identity, tone, bahasa
├── rules.ts             # Rule umum lintas-modul (akses role, larangan ngarang)
└── modules/
    ├── task.ts          # Rule + tools task (termasuk rule Afif, setelah dirapikan)
    ├── subtask.ts
    ├── workflow.ts
    └── memory.ts
```

Prinsip: rule + tools **satu domain digabung** dalam satu file modul (bukan dipisah folder `rules/` vs `tools/`) karena keduanya coupled. `base.ts`/`rules.ts` cuma untuk yang benar-benar lintas-modul. Belum ada 1 baris kode pun dari struktur ini yang ditulis — masih tahap desain. Lihat roadmap untuk detail risiko & urutan kerja.
