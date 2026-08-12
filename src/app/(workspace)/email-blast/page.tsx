import styles from "./email-blast.module.css";
import { EmailBlastComposeView } from "@/components/app/email-blast/email-blast-compose-view";

export default function EmailBlastPage() {
  return (
    <div className={styles.page}>
      <EmailBlastComposeView />
    </div>
  );
}
