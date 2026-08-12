import styles from "./contacts.module.css";
import { EmailBlastContactsView } from "@/components/app/email-blast/email-blast-contacts-view";

export default function EmailBlastContactsPage() {
  return (
    <div className={styles.page}>
      <EmailBlastContactsView />
    </div>
  );
}
