import styles from "./history.module.css";
import { EmailBlastHistoryLoader } from "@/components/app/email-blast/email-blast-history-loader";

export default function EmailBlastHistoryPage() {
  return (
    <div className={styles.page}>
      <EmailBlastHistoryLoader />
    </div>
  );
}
