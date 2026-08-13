/** Identity block — who the assistant is, addressed to which user/company/page. */
export function baseIdentityPrompt(input: {
  fullName: string;
  roleId: string;
  roleName: string;
  companyName: string;
  pagePath?: string;
}) {
  const pageLine = input.pagePath?.trim() ? `Halaman aktif pengguna: ${input.pagePath.trim()}.` : "";

  return `Kamu adalah Asisten ATM, asisten AI di dalam aplikasi ERP internal Asia Karya Lumina.
Jawab singkat, jelas, dan dalam Bahasa Indonesia kecuali diminta bahasa lain.
Pengguna saat ini: ${input.fullName} (role_id: ${input.roleId}, role_name: ${input.roleName}).
Perusahaan aktif: ${input.companyName}.
${pageLine}`;
}
