import { adminNavigation, emailBlastNavigation, pageCopy, primaryNavigation, taskNavigation } from "@/lib/navigation";
import { appPathname, withTenant, type TenantRef } from "@/lib/tenant-path";

export type PageCopy = { title: string; eyebrow: string; description: string };

export function getPageCopy(pathname: string): PageCopy {
  const path = appPathname(pathname);
  const exact = pageCopy[path];
  if (exact) return exact;
  if (path.startsWith("/tasks/")) {
    return { title: "Task detail", eyebrow: "Tasks", description: "Checklist, comments, status history, and activity log." };
  }
  if (path.startsWith("/employees/")) {
    return { title: "Employee profile", eyebrow: "HR", description: "Profile, attendance, task history, birthday, and performance score." };
  }
  if (path.startsWith("/email-blast/history/")) {
    return { title: "Blast detail", eyebrow: "Email blast", description: "Email content, recipients, and delivery status for this send." };
  }
  if (path.startsWith("/email-blast/contacts/") && path !== "/email-blast/contacts") {
    return (
      pageCopy["/email-blast/contacts/[id]"] || {
        title: "Group detail",
        eyebrow: "Email blast",
        description: "Add or remove contacts for this group, then use it when composing a blast.",
      }
    );
  }
  if (path.startsWith("/chat")) return pageCopy["/chat"];
  if (path.startsWith("/workflows/") && path !== "/workflows/new") {
    return {
      title: "Workflow board",
      eyebrow: "Task boards",
      description: "Tasks grouped in this workflow — same board, list, and calendar views.",
    };
  }
  return pageCopy["/dashboard"];
}

export type BreadcrumbItem = { label: string; href?: string };

const labelByHref = new Map<string, string>();
for (const item of [...primaryNavigation, ...adminNavigation, ...emailBlastNavigation, ...taskNavigation]) {
  labelByHref.set(item.href, item.label);
  for (const child of item.children || []) {
    labelByHref.set(child.href, child.label);
  }
}

function segmentLabel(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getBreadcrumbs(pathname: string, tenant?: TenantRef | null): BreadcrumbItem[] {
  const path = appPathname(pathname);
  if (!path || path === "/") {
    return [{ label: "Dashboard", href: withTenant("/dashboard", tenant) }];
  }

  const parts = path.split("/").filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let href = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    href += `/${part}`;
    const isLast = index === parts.length - 1;
    const known = labelByHref.get(href);
    const copy = pageCopy[href];

    let label = known || copy?.title || segmentLabel(part);

    if (isLast) {
      const leafCopy = getPageCopy(path);
      if (!known && !pageCopy[href]) {
        label = leafCopy.title;
      } else if (copy) {
        label = copy.title;
      }
    }

    if (part === "tasks" && !isLast) label = "Tasks";
    if (part === "workflows" && !isLast) label = "Workflow";
    if (part === "admin" && !isLast) label = "Admin";
    if (part === "email-blast" && !isLast) label = "Email Blast";
    if (part === "attendance" && !isLast) label = "Attendance";
    if (part === "employees" && !isLast) label = "Employees";
    if (part === "chat" && !isLast) label = "Messages";

    crumbs.push(isLast ? { label } : { label, href: withTenant(href, tenant) });
  }

  return crumbs.length > 0 ? crumbs : [{ label: "Dashboard", href: withTenant("/dashboard", tenant) }];
}
