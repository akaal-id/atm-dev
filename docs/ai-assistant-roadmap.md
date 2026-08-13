# AI Assistant — Roadmap (Perubahan yang Akan Datang)

Living doc. Urutan bukan final — sesuaikan kalau prioritas berubah.
Pasangan doc: [ai-assistant-status.md](./ai-assistant-status.md) untuk yang sudah selesai.

## 0. Catatan eksplorasi: 2-layer database (offline-first) — belum diputuskan

Ide dari diskusi: layer lokal di device user (bukan cuma Supabase di internet). Belum tentu relevan buat AI Assistant, lebih ke arsitektur data ATM ERP secara umum — dicatat di sini biar gak hilang.

- **Layer internet**: Supabase (sudah jalan).
- **Layer lokal device**: kandidat IndexedDB (browser), disinkron pakai sync engine.
- **Kandidat sync engine**: PowerSync atau ElectricSQL — punya integrasi resmi ke Supabase, urusin sync + conflict resolution otomatis (dibanding bikin sendiri pakai IndexedDB + queue manual, yang gampang buggy).
- **Tradeoff**: nambah dependency + service baru (PowerSync butuh service tambahan); perlu desain skema yang sync-friendly — gak semua tabel cocok disinkron ke device.
- **Belum diputuskan**: apakah ini kebutuhan nyata (offline capability, latency, device storage limit) atau sekadar eksplorasi arah. Perlu klarifikasi kebutuhan user sebelum masuk ke roadmap teknis konkret. Kalau jadi jalan, bisa berdampak ke #1 (route refactor chat) — cek dulu sebelum implementasi #1 kalau keputusan ini sudah matang duluan.

## 1. Chat jadi halaman sendiri, bukan modal (prioritas — akar masalah render)

**Masalah**: chat sekarang modal/drawer yang di-mount di dalam `AiAssistantWidget`, satu instance yang dipakai ulang terus untuk conversation manapun. Bug `useChat` id-race yang baru diperbaiki ([status doc](./ai-assistant-status.md#3-bug-yang-sudah-diperbaiki)) itu **gejala**, bukan penyebab tunggal — akar masalahnya: modal ini gak pernah benar-benar remount, jadi state chat (messages, composer, tool-result yang lagi expand, dst.) harus di-*juggle* manual tiap ganti conversation atau tiap render lain nyerempet. Pola ini rawan bug serupa muncul lagi di tempat lain (bukan cuma di `useChat`).

**Arah perbaikan**: chat jadi **halaman/route sendiri**, bukan modal — tapi UX-nya harus tetap terasa modal:
- Klik tombol chat (FAB) → "masuk" ke halaman chat, transisi mulus (bukan hard navigation yang berasa reload).
- Halaman sebelumnya (yang lagi dibuka user pas klik FAB) **di-cache** — pas user klik X, balik ke halaman itu persis seperti kondisi terakhir (scroll position, filter, dst.), bukan reload/refetch dari nol.

**Kandidat teknis**: pola **Parallel Routes + Intercepting Routes** Next.js App Router (`@modal` slot + convention `(.)`/`(..)`) dibuat persis untuk kasus ini — kasih chat URL/route sendiri (jadi punya lifecycle mount/unmount yang bersih, refresh-safe, bisa di-share), tapi dirender sebagai overlay di atas halaman yang di-intercept, dan tombol kembali/close balik ke halaman asal lewat router cache Next.js secara native (gak perlu bikin cache manual).

⚠️ **Wajib dicek dulu sebelum implementasi**: [AGENTS.md](../AGENTS.md) bilang versi Next.js di repo ini **bukan Next.js yang biasa** — ada breaking changes dari yang umum diketahui. Baca dulu dokumentasi Parallel/Intercepting Routes di `node_modules/next/dist/docs/` sebelum nulis kode, jangan asumsikan convention standar Next.js berlaku sama persis di sini.

**Scope kerja**:
1. Baca `node_modules/next/dist/docs/` — konfirmasi API parallel/intercepting routes versi ini.
2. Desain struktur route: kemungkinan `src/app/(workspace)/@modal/(.)ai-chat/page.tsx` + slot `@modal` di layout terkait, atau pola lain kalau versi ini beda.
3. Pindahkan isi `AiAssistantWidget` (thread, composer, sidebar riwayat) dari komponen modal ke page component ini. FAB tetap ada di app-shell, tapi jadi `<Link>` ke route chat, bukan `onClick={() => setOpen(true)}`.
4. Pastikan state per-conversation (termasuk fix `chatSessionId` yang baru dibuat) tetap valid di dunia route — kemungkinan besar race condition ini otomatis hilang total karena tiap navigasi = mount baru, bukan state-juggling di komponen yang sama.
5. Uji: buka chat dari beberapa halaman berbeda (Tasks, Dashboard, dll.), pastikan close balik ke halaman+state yang benar.

## 2. Modularisasi AI logic (`route.ts` monolith → `src/lib/server/ai/`)

Struktur sudah disepakati (lihat [status doc §4](./ai-assistant-status.md#4-keputusan-arsitektur-yang-sudah-disepakati-belum-diimplementasi)). Kerjaan:

1. Bikin `src/lib/server/ai/base.ts` — pindahkan identity block dari `buildSystemPrompt()`.
2. Bikin `src/lib/server/ai/rules.ts` — pindahkan rule akses role (Super Admin/Admin-Leader/Staff), larangan ngarang data, dst. **Disiplin**: hanya rule yang benar-benar lintas-modul boleh masuk sini.
3. Bikin `src/lib/server/ai/modules/task.ts` — rule + tool `getMyTasks` (dan tool task lain kalau ada), termasuk rule query task yang baku (assignee-filter untuk "task saya", role-check untuk "semua task").
4. Bikin `modules/subtask.ts`, `modules/workflow.ts` — kosong dulu / placeholder kalau belum ada tool-nya, jangan dipaksa isi.
5. Bikin `modules/memory.ts` — pindahkan tool `rememberFact` + rule pemakaian memory.
6. Bikin `registry.ts` — gabungin semua rule jadi satu prompt, gabungin semua tools jadi satu object. **Tambahkan assert**: gak boleh ada key tool yang duplikat antar modul (self-check murah, jalanin pas build/dev).
7. Refactor `route.ts` — ganti `buildSystemPrompt()` inline dan definisi tools inline dengan konsumsi `registry.ts`. Target: `route.ts` cuma urus HTTP (auth, streaming, penyimpanan message), bukan isi prompt/tools.

**Risiko yang harus dijaga selama proses ini** (jangan nunggu ditemukan pas sudah besar):
- **Prompt bloat**: jangan gabung *semua* rule modul ke tiap request tanpa syarat — begitu modul nambah, token cost naik & rule saling encer. Minimal, filter berdasar `pagePath` yang sudah tersedia di context.
- **`rules.ts` jadi tong sampah lagi** — itu-itu juga masalah `route.ts` yang mau dibetulin. Awasi tiap PR yang nambah isi `rules.ts`.
- **Rule di code vs fact di DB**: `modules/task.ts` itu rule baku (global, semua user, butuh deploy buat ubah). `ai_user_memory.facts` itu preferensi personal per user (dinamis, gak butuh deploy). Dua-duanya jalan berbarengan — bukan salah satu gantiin yang lain.

## 3. Bersihin fact memory yang tumpang tindih

3 fact di `ai_user_memory` milik user Afif A isinya rule yang sama, beda redaksi: `task_query_preference`, `task_query_rule`, `task_query_rule_strict`. Setelah `modules/task.ts` (poin 2) berisi rule baku ini secara permanen, hapus ketiga fact tadi dari DB (atau merge jadi satu fact ringkas kalau masih ada nuansa personal yang perlu disimpan terpisah dari rule global).

## 4. Belum dijadwalkan (dicatat biar gak lupa)

- Tool baru untuk `subtask` (create/toggle) dan `workflow` (advance status) — sekarang cuma ada `getMyTasks` dan `rememberFact`.
- Namespacing konvensi nama tool (`task_list`, `workflow_advance`, dst.) sebelum jumlah modul bertambah dan risiko tabrakan key naik.
