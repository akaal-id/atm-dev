import "server-only";

import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { getProjectAccess } from "@/lib/server/project-hub";
import { supabaseRest } from "@/lib/server/supabase-rest";
import type { CurrentUser } from "@/lib/types";
import { officeSummaryColumns, type OfficeFile, type OfficeFileSummary, type OfficeFileType } from "@/lib/types/office";
import { makeId } from "@/lib/utils";

const enc = encodeURIComponent;

export type OfficeFileAccess = { user: CurrentUser; file: OfficeFile; canEdit: boolean; canDelete: boolean };

/**
 * Personal files: owner only (admins included — notes are private).
 * Project files: anyone who can see the project in this company; contributors edit,
 * the file owner or a project editor may delete.
 */
export async function getOfficeFileAccess(fileId: string): Promise<OfficeFileAccess | null> {
  const user = await getCurrentUser();
  if (!user || !fileId) return null;

  const [file] = await supabaseRest<OfficeFile[]>(`/office_files?file_id=eq.${enc(fileId)}&select=*&limit=1`);
  if (!file) return null;

  if (file.scope === "personal") {
    if (file.owner_user_id !== user.user_id) return null;
    return { user: user as CurrentUser, file, canEdit: true, canDelete: true };
  }

  const project = await getProjectAccess(file.project_id ?? "");
  if (!project || project.companyId !== file.company_id) return null;
  return {
    user: user as CurrentUser,
    file,
    canEdit: project.canContribute,
    canDelete: project.canEdit || file.owner_user_id === user.user_id,
  };
}

/** Personal files of the user plus project files of the active company. */
export async function listOfficeFiles(userId: string, companyId: string) {
  const [personal, project] = await Promise.all([
    supabaseRest<OfficeFileSummary[]>(
      `/office_files?scope=eq.personal&owner_user_id=eq.${enc(userId)}&select=${officeSummaryColumns}&order=updated_at.desc`,
    ),
    supabaseRest<OfficeFileSummary[]>(
      `/office_files?scope=eq.project&company_id=eq.${enc(companyId)}&select=${officeSummaryColumns}&order=updated_at.desc`,
    ),
  ]);
  return [...personal, ...project];
}

type CreateInput = {
  type: OfficeFileType;
  title: string;
  projectId: string | null;
  folder: string;
  content?: string;
  /** Initial Univer data, e.g. from an imported file. */
  snapshot?: Record<string, unknown> | null;
};

/** Create in a project (contributors only) or, with `projectId = null`, as a personal note. */
export async function createOfficeFile(input: CreateInput): Promise<{ file: OfficeFile } | { error: string; status: number }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  let companyId: string;
  if (input.projectId) {
    const project = await getProjectAccess(input.projectId);
    if (!project) return { error: "Project not found", status: 404 };
    if (!project.canContribute) return { error: "Only project members can add files to this project.", status: 403 };
    companyId = project.companyId;
  } else {
    companyId = (await getActiveCompanyContext(user.user_id)).company.id;
  }

  const now = new Date().toISOString();
  const [file] = await supabaseRest<OfficeFile[]>("/office_files", {
    method: "POST",
    body: JSON.stringify({
      file_id: makeId("ofc"),
      company_id: companyId,
      scope: input.projectId ? "project" : "personal",
      project_id: input.projectId,
      owner_user_id: user.user_id,
      type: input.type,
      title: input.title,
      folder: input.projectId ? input.folder : "",
      snapshot: input.snapshot ?? null,
      content: input.content ?? "",
      updated_by: user.user_id,
      created_at: now,
      updated_at: now,
    }),
  });
  return { file };
}

export async function updateOfficeFile(fileId: string, userId: string, patch: Partial<Pick<OfficeFile, "title" | "folder" | "snapshot" | "content">>) {
  const [file] = await supabaseRest<OfficeFileSummary[]>(`/office_files?file_id=eq.${enc(fileId)}&select=${officeSummaryColumns}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_by: userId, updated_at: new Date().toISOString() }),
  });
  return file ?? null;
}

export async function deleteOfficeFile(fileId: string) {
  await supabaseRest<void>(`/office_files?file_id=eq.${enc(fileId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function listProjectOfficeFiles(projectId: string) {
  return supabaseRest<OfficeFileSummary[]>(
    `/office_files?scope=eq.project&project_id=eq.${enc(projectId)}&select=${officeSummaryColumns}&order=updated_at.desc`,
  );
}
