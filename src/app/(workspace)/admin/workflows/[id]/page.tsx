import { redirect } from "next/navigation";

import styles from "./id.module.css";

export default async function AdminWorkflowDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  void styles.page;
  const { id } = await params;
  redirect(`/workflows/${id}`);
}
