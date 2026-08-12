import styles from "./id.module.css";
import { EmailBlastGroupDetailView } from "@/components/app/email-blast/email-blast-group-detail-view";

export default async function EmailBlastContactGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className={styles.page}>
      <EmailBlastGroupDetailView groupId={id} />
    </div>
  );
}
