import { Paperclip } from "lucide-react";
import styles from "./email-blast-content-card.module.css";

import { Card, CardBody, CardHeader } from "@/components/ui/card";

function SectionTitle({ title }: { title: string }) {
  return <h2 className={styles.title}>{title}</h2>;
}

interface EmailBlastContentCardProps {
  subject: string;
  body: string;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
}

/** Read-only display of blast subject, body, and optional attachment. */
export function EmailBlastContentCard({
  subject,
  body,
  attachmentName = null,
  attachmentUrl = null,
}: EmailBlastContentCardProps) {
  return (
    <Card className={styles.body}>
      <CardHeader>
        <SectionTitle title="Email content" />
      </CardHeader>
      <CardBody className={styles.text}>
        <div className={styles.body}>
          <p className={styles.emailblastcontent}>Subject</p>
          <p className={styles.text}>{subject}</p>
        </div>
        <div className={styles.body}>
          <p className={styles.emailblastcontent}>Body</p>
          <pre className={styles.sectionBody}>
            {body}
          </pre>
        </div>
        {attachmentName ? (
          <div className={styles.section}>
            <Paperclip className={styles.paperclip} aria-hidden />
            {attachmentUrl ? (
              <a href={attachmentUrl} className={styles.link}>
                {attachmentName}
              </a>
            ) : (
              <span className={styles.meta}>{attachmentName}</span>
            )}
          </div>
        ) : (
          <p className={styles.emptyText}>Tidak ada lampiran.</p>
        )}
      </CardBody>
    </Card>
  );
}
