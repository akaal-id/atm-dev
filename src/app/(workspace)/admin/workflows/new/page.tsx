import { redirect } from "next/navigation";

import styles from "./new.module.css";

export default function AdminNewWorkflowRedirectPage() {
  void styles.page;
  redirect("/workflows/new");
}
