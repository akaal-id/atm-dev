import { AppShell } from "@/components/app/app-shell";

export default function WorkspaceLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return <AppShell modal={modal}>{children}</AppShell>;
}
