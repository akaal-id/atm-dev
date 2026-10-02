export type OfficeFileType = "sheet" | "doc";

export const officeFileTypes: OfficeFileType[] = ["sheet", "doc"];
export type OfficeScope = "project" | "personal";

/** List row — without the (potentially large) sheet snapshot or doc body. */
export type OfficeFileSummary = {
  file_id: string;
  company_id: string;
  scope: OfficeScope;
  project_id: string | null;
  owner_user_id: string;
  type: OfficeFileType;
  title: string;
  folder: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type OfficeFile = OfficeFileSummary & {
  /** Univer data: IWorkbookData (sheet) or `{ version: 2, tabs }` (doc). */
  snapshot: Record<string, unknown> | null;
  /** Rich-text HTML for docs. */
  content: string;
};

export const officeSummaryColumns =
  "file_id,company_id,scope,project_id,owner_user_id,type,title,folder,updated_by,created_at,updated_at";
