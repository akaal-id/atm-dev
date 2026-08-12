import styles from "./approval.module.css";
import { ApprovalView } from "@/components/app/approval-view";
import { getAppData } from "@/lib/server/app-data";
import { requirePermission } from "@/lib/server/auth";

export default async function AdminApprovalPage() {
  await requirePermission("admin:view");
  const data = await getAppData(["Users", "Tasks", "Task_Checklists", "Projects", "Task_Comments"]);
  return (
    <div className={styles.page}>
      <ApprovalView data={data} />
    </div>
  );
}
