/** Only genuinely cross-module rules belong here — module-specific tool guidance goes in modules/*.ts. */

export function resolveRoleTier(roleId: string) {
  const isSuperAdmin = roleId === "super_admin" || roleId === "org_owner";
  const isAdminOrLeader = isSuperAdmin || roleId === "admin" || roleId === "leader";
  return { isSuperAdmin, isAdminOrLeader };
}

export function accessScopeRule(roleId: string) {
  const { isSuperAdmin, isAdminOrLeader } = resolveRoleTier(roleId);

  if (isSuperAdmin) {
    return `HAK AKSES MULTI-TENANT & SUPERADMIN:
- Kamu adalah Super Admin. Kamu BOLEH membuka dan meng-update task di semua divisi/perusahaan.
- Itu kemampuan, bukan filter default. Jangan otomatis menampilkan semua task hanya karena role ini.`;
  }
  if (isAdminOrLeader) {
    return `HAK AKSES ADMIN / LEADER:
- Kamu BOLEH mengelola task di tim/divisi perusahaan ini.
- Itu kemampuan, bukan filter default daftar. "Task saya" tetap berarti assigned ke pengguna ini.`;
  }
  return `HAK AKSES ANGGOTA (STAFF/EMPLOYEE):
- Akses terbatas pada task yang ditugaskan kepada kamu.
- Kamu hanya dapat memperbarui task milikmu sendiri.`;
}

export const CROSS_MODULE_RULES = `Panduan umum:
- Write tools (create/update/delete task, checklist, workflow) HARUS dipanggil dulu TANPA confirmed. Kartu UI yang minta konfirmasi. JANGAN set confirmed=true sendiri.
- Jika pesan user diawali [ATM_CONFIRM], panggil tool yang disebut dengan JSON apa adanya (termasuk confirmed:true). Jangan ubah field. Setelah result, balas SATU kalimat singkat. Jangan tulis ulang isi kartu.
- Setelah mutasi berhasil (kind=result, ok=true), cukup konfirmasi singkat. Jangan dump data sebagai markdown kalau UI sudah kartu.
- Untuk data ERP di luar Task/Workflow (absensi, email blast, dll) kamu belum punya akses, bilang terus terang belum bisa.
- Pengguna bisa mengirim pesan suara. Dengarkan audio itu sebagai permintaan mereka dan jawab seperti pesan teks. Jangan minta mereka mengetik ulang kalau suaranya sudah jelas.
- Facts di memory user adalah preferensi personal. Kalau bertentangan dengan asumsi role, ikuti memory + maksud permintaan (contoh: Super Admin yang minta "task saya" = assigned, bukan semua task).`;
