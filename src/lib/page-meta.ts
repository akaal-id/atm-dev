import { adminNavigation, emailBlastNavigation, pageCopy, primaryNavigation } from "@/lib/navigation";

export type PageCopy = { title: string; eyebrow: string; description: string };

export function getPageCopy(pathname: string): PageCopy {
  const exact = pageCopy[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/tasks/")) {
    return { title: "Task detail", eyebrow: "Tasks", description: "Checklist, comments, status history, and activity log." };
  }
  if (pathname.startsWith("/employees/")) {
    return { title: "Employee profile", eyebrow: "HR", description: "Profile, attendance, task history, birthday, and performance score." };
  }
  if (pathname.startsWith("/email-blast/history/")) {
    return { title: "Blast detail", eyebrow: "Email blast", description: "Email content, recipients, and delivery status for this send." };
  }
  if (pathname.startsWith("/email-blast/contacts/") && pathname !== "/email-blast/contacts") {
    return (
      pageCopy["/email-blast/contacts/[id]"] || {
        title: "Group detail",
        eyebrow: "Email blast",
        description: "Add or remove contacts for this group, then use it when composing a blast.",
      }
    );
  }
  if (pathname.startsWith("/chat")) return pageCopy["/chat"];
  return pageCopy["/dashboard"];
}

export type BreadcrumbItem = { label: string; href?: string };

const labelByHref = new Map<string, string>();
for (const item of [...primaryNavigation, ...adminNavigation, ...emailBlastNavigation]) {
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

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (!pathname || pathname === "/") {
    return [{ label: "Dashboard", href: "/dashboard" }];
  }

  const parts = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let href = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    href += `/${part}`;
    const isLast = index === parts.length - 1;
    const known = labelByHref.get(href);
    const copy = pageCopy[href];

    let label = known || copy?.title || segmentLabel(part);

    // Dynamic segments: prefer page copy title for the leaf
    if (isLast) {
      const leafCopy = getPageCopy(pathname);
      if (!known && !pageCopy[href]) {
        label = leafCopy.title;
      } else if (copy) {
        label = copy.title;
      }
    }

    // Group parent labels
    if (part === "tasks" && !isLast) label = "Tasks";
    if (part === "admin" && !isLast) label = "Admin";
    if (part === "email-blast" && !isLast) label = "Email Blast";
    if (part === "attendance" && !isLast) label = "Attendance";
    if (part === "employees" && !isLast) label = "Employees";
    if (part === "chat" && !isLast) label = "Messages";

    crumbs.push(isLast ? { label } : { label, href });
  }

  return crumbs.length > 0 ? crumbs : [{ label: "Dashboard", href: "/dashboard" }];
}
