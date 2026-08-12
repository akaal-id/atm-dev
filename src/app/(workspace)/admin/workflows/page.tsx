import { redirect } from "next/navigation";

import styles from "./workflows.module.css";

export default function AdminWorkflowsRedirectPage() {
  void styles.page;
  redirect("/workflows");
}
