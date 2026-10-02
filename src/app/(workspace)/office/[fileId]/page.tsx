import styles from "./fileId.module.css";

import { notFound } from "next/navigation";

import { OfficeFileEditor } from "@/components/app/office/office-file-editor";
import { getResourceById } from "@/lib/server/store";
import { getOfficeFileAccess } from "@/lib/server/office";

export default async function OfficeFilePage({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const access = await getOfficeFileAccess(fileId).catch(() => null);
  if (!access) notFound();

  const { file } = access;
  let locationLabel = "Personal notes";
  let backHref = "/office?location=personal";
  if (file.scope === "project" && file.project_id) {
    const project = await getResourceById("Projects", file.project_id);
    locationLabel = [project?.project_name ?? "Project", file.folder].filter(Boolean).join(" / ");
    backHref = `/office?location=${file.project_id}`;
  }

  return (
    <div className={styles.page}>
      <OfficeFileEditor file={file} canEdit={access.canEdit} canDelete={access.canDelete} locationLabel={locationLabel} backHref={backHref} />
    </div>
  );
}
