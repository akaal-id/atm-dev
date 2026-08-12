import { NextResponse } from "next/server";

import { hasAnyPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/auth";
import { listResource } from "@/lib/server/store";
import type { Workflow } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasAnyPermission(user.role_id, ["tasks:own", "tasks:team", "tasks:manage"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, projects, workflows] = await Promise.all([
    listResource("Users", { select: "user_id,full_name,is_active,company_id" }),
    listResource("Projects", { select: "project_id,project_name,ticket_id_prefix,company_id" }),
    listResource("Workflows", { select: "workflow_id,name,project_id,company_id" }),
  ]);

  return NextResponse.json({
    users: users.map((entry) => ({
      user_id: entry.user_id,
      full_name: entry.full_name,
      is_active: entry.is_active,
    })),
    projects: projects.map((project) => ({
      project_id: project.project_id,
      project_name: project.project_name,
      ticket_id_prefix: project.ticket_id_prefix || "",
    })),
    workflows: (workflows as Workflow[]).map((workflow) => ({
      id: workflow.workflow_id,
      name: workflow.name,
      project_id: workflow.project_id || null,
    })),
  });
}
