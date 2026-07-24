import { redirect } from "next/navigation";

export default function AdminNewWorkflowRedirectPage() {
  redirect("/workflows/new");
}
