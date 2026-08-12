import styles from "./id.module.css";
import { EmailBlastDetailLoader } from "@/components/app/email-blast/email-blast-detail-loader";

export default async function EmailBlastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className={styles.page}>
      <EmailBlastDetailLoader id={id} />
    </div>
  );
}
