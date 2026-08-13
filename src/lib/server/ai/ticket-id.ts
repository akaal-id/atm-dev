import { listResource } from "@/lib/server/store";

function makeTicketPrefix(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
    .filter(Boolean);
  if (words.length >= 2) return words.map((word) => word[0]).join("").slice(0, 5);
  return (words[0] ?? "ATM").slice(0, 5);
}

export async function nextTicketId(projectId: string, title: string) {
  const [projects, tasks] = await Promise.all([listResource("Projects"), listResource("Tasks")]);
  const project = projects.find((candidate) => candidate.project_id === projectId);
  const prefix =
    String(project?.ticket_id_prefix || "")
      .trim()
      .toUpperCase() || makeTicketPrefix(project?.project_name || title || "Akaal Task");
  const pattern = new RegExp(`^${prefix}-(\\d{3,})$`);
  const nextNumber =
    tasks.reduce((max, task) => {
      const match = pattern.exec(task.task_id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

export async function nextTicketIds(projectId: string, title: string, count: number) {
  if (count <= 0) return [];
  const first = await nextTicketId(projectId, title);
  const match = /^(.*-)(\d+)$/.exec(first);
  if (!match) return Array.from({ length: count }, (_, index) => `${first}${index || ""}`);
  const prefix = match[1];
  const start = Number(match[2]);
  const width = match[2].length;
  return Array.from({ length: count }, (_, index) => `${prefix}${String(start + index).padStart(width, "0")}`);
}
