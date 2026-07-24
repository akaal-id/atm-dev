"use client";

import { CreateTaskModal } from "@/components/app/create-task-modal";
import { Page } from "@/components/app/page-layout";
import { TaskWorkspace } from "@/components/app/task-workspace";
import { WorkflowBoardHeader } from "@/components/app/workflow/workflow-board-header";
import { canApproveTaskAsLeader, hasPermission } from "@/lib/permissions";
import type { CurrentUser, Project, Task, TaskChecklist, User, Workflow } from "@/lib/types";

type WorkflowOption = {
  id: string;
  name: string;
  project_id: string | null;
};

export function WorkflowDetailClient({
  workflow,
  tasks = [],
  users = [],
  projects = [],
  checklists = [],
  currentUser,
  workflows = [],
}: {
  workflow: Workflow;
  tasks?: Task[];
  users?: User[];
  projects?: Project[];
  checklists?: TaskChecklist[];
  currentUser: CurrentUser;
  workflows?: WorkflowOption[];
}) {
  if (!workflow || !currentUser) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">Unable to load workflow.</p>
      </Page>
    );
  }

  const canCreateTasks =
    hasPermission(currentUser.role_id, "tasks:own") ||
    hasPermission(currentUser.role_id, "tasks:team") ||
    hasPermission(currentUser.role_id, "tasks:manage");
  const canEditWorkflow =
    hasPermission(currentUser.role_id, "tasks:manage") || hasPermission(currentUser.role_id, "projects:manage");
  const canMoveFinished = canApproveTaskAsLeader(currentUser);
  const taskModalUsers = users.map((user) => ({
    user_id: user.user_id,
    full_name: user.full_name,
    is_active: user.is_active,
  }));
  const taskModalProjects = projects.map((project) => ({
    project_id: project.project_id,
    project_name: project.project_name,
    ticket_id_prefix: project.ticket_id_prefix || "",
  }));
  const createTaskAction = canCreateTasks ? (
    <CreateTaskModal
      currentUser={currentUser}
      users={taskModalUsers}
      projects={taskModalProjects}
      workflows={workflows}
      defaultWorkflowId={workflow.workflow_id}
    />
  ) : null;

  return (
    <Page>
      <TaskWorkspace
        tasks={tasks}
        users={users}
        projects={projects}
        checklists={checklists}
        currentUser={currentUser}
        scope="team"
        canMoveFinished={canMoveFinished}
        workflow={workflow}
        header={
          <WorkflowBoardHeader
            workflow={workflow}
            projects={projects}
            canEdit={canEditWorkflow}
            actions={createTaskAction}
          />
        }
      />
    </Page>
  );
}
