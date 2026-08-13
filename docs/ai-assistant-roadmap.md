# AI Assistant — Roadmap (Perubahan yang Akan Datang)

Living doc. Urutan bukan final — sesuaikan kalau prioritas berubah.
Pasangan doc: [ai-assistant-status.md](./ai-assistant-status.md) untuk yang sudah selesai.

Selesai dan dipindah ke status doc: chat sebagai route + overlay intercept, FAB `Link`, chat baru on open, pesan suara Gemini, scroll kolom konten, markdown list, modularisasi `src/lib/server/ai/` (di-wire ke `route.ts`).

## 0. Catatan eksplorasi: 2-layer database (offline-first) — belum diputuskan

Ide dari diskusi: layer lokal di device user (bukan cuma Supabase di internet). Belum tentu relevan buat AI Assistant, lebih ke arsitektur data ATM ERP secara umum — dicatat di sini biar gak hilang.

- **Layer internet**: Supabase (sudah jalan).
- **Layer lokal device**: kandidat IndexedDB (browser), disinkron pakai sync engine.
- **Kandidat sync engine**: PowerSync atau ElectricSQL — punya integrasi resmi ke Supabase, urusin sync + conflict resolution otomatis (dibanding bikin sendiri pakai IndexedDB + queue manual, yang gampang buggy).
- **Tradeoff**: nambah dependency + service baru (PowerSync butuh service tambahan); perlu desain skema yang sync-friendly — gak semua tabel cocok disinkron ke device.
- **Belum diputuskan**: apakah ini kebutuhan nyata atau sekadar eksplorasi arah. Tidak lagi nge-block kerjaan chat — route chat sudah jalan.

## 1. Fact memory — jangan dihapus

Fact per-user tetap perlu. Yang salah sebelumnya: **rule di kode terlalu kaku** (Super Admin = dump semua task), jadi memory "task saya = assigned" tertimpa.

Sekarang `getMyTasks` default `assigned`; `accessible` hanya kalau user minta semua/tim. Memory facts boleh tetap ada sebagai preferensi personal.

## 2. Belum dijadwalkan (dicatat biar gak lupa)

- Tool workflow **advance status** (CRUD + kartu konfirmasi sudah ada; status board tetap turunan task).
- Filter rule/tools berdasar `pagePath` (anti prompt bloat). Context sudah membawa `pagePath`.
- Namespacing nama tool (`task_list`, `workflow_advance`, dst.) sebelum modul nambah dan risiko tabrakan key naik.
- Pesan suara: transkrip tersimpan di bubble (sekarang hanya label “Pesan suara”; audio tidak di-persist). Latency `gemini-3.5-flash-lite` di audio kadang lebih lambat dari 3.1 Lite — cadangan ganti model per giliran suara kalau perlu.
