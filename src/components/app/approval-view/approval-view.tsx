"use client";

import styles from "./approval-view.module.css";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Clock3,
  Layers,
  AlertCircle,
  Loader2,
  CheckSquare,
} from "lucide-react";

import { Page } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TaskStatusPill } from "@/components/ui/status-pill";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { AppData } from "@/components/app/views";
import type { TaskChecklist } from "@/lib/types";
import { cn, formatShortDate } from "@/lib/utils";

interface ApprovalViewProps {
  data: AppData;
}

export function ApprovalView({ data }: ApprovalViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [updating, setUpdating] = useState(false);

  // Local state for checklists to allow optimistic/instant updates without waiting for server reload
  const [localChecklists, setLocalChecklists] = useState<TaskChecklist[]>(data.checklists);

  useEffect(() => {
    setLocalChecklists(data.checklists);
  }, [data.checklists]);

  // Filter states
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("All");

  const userName = (id: string) => {
    return data.users.find((u) => u.user_id === id)?.full_name ?? "Unassigned";
  };

  const getTaskChecklists = (taskId: string) => {
    return localChecklists.filter((item) => item.task_id === taskId);
  };

  // 1. Toggle Assignee Completion
  const handleToggleAssignee = async (
    checklistId: string,
    currentCompleted: boolean
  ) => {
    if (updating) return;

    // Optimistically update local state immediately
    const prevChecklists = [...localChecklists];
    setLocalChecklists((prev) =>
      prev.map((c) =>
        c.checklist_id === checklistId
          ? { ...c, assignee_completed: !currentCompleted, is_completed: !currentCompleted }
          : c
      )
    );

    try {
      const formData = new FormData();
      formData.set("assignee_completed", String(!currentCompleted));

      const response = await fetch(`/api/resources/Task_Checklists/${checklistId}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Sync server data in the background
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to toggle assignee checklist:", error);
      // Revert to original state on error
      setLocalChecklists(prevChecklists);
    }
  };

  // 2. Toggle Leader Approval
  const handleToggleSubtask = async (
    checklistId: string,
    currentApproved: boolean,
    assigneeCompleted: boolean
  ) => {
    if (updating) return;

    // Optimistically update local state immediately
    const prevChecklists = [...localChecklists];
    setLocalChecklists((prev) =>
      prev.map((c) =>
        c.checklist_id === checklistId
          ? {
              ...c,
              pm_approved: !currentApproved,
              assignee_completed: !currentApproved ? true : c.assignee_completed,
              is_completed: !currentApproved ? true : c.is_completed,
            }
          : c
      )
    );

    try {
      const formData = new FormData();
      formData.set("pm_approved", String(!currentApproved));
      if (!currentApproved && !assigneeCompleted) {
        formData.set("assignee_completed", "true"); // Leader override completes subtask
      }

      const response = await fetch(`/api/resources/Task_Checklists/${checklistId}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Sync server data in the background
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to toggle subtask approval:", error);
      // Revert to original state on error
      setLocalChecklists(prevChecklists);
    }
  };

  // 3. Approve All Subtasks
  const handleApproveAll = async (taskChecklists: TaskChecklist[]) => {
    const toApprove = taskChecklists.filter((c) => !c.pm_approved);
    if (toApprove.length === 0 || updating) return;

    // Optimistically update local state immediately
    const prevChecklists = [...localChecklists];
    const toApproveIds = new Set(toApprove.map((c) => c.checklist_id));
    setLocalChecklists((prev) =>
      prev.map((c) =>
        toApproveIds.has(c.checklist_id)
          ? { ...c, pm_approved: true, assignee_completed: true, is_completed: true }
          : c
      )
    );

    try {
      await Promise.all(
        toApprove.map((c) => {
          const formData = new FormData();
          formData.set("pm_approved", "true");
          if (!c.assignee_completed) {
            formData.set("assignee_completed", "true");
          }
          return fetch(`/api/resources/Task_Checklists/${c.checklist_id}`, {
            method: "POST",
            headers: { accept: "application/json" },
            body: formData,
          });
        })
      );

      // Sync server data in the background
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to approve all subtasks:", error);
      // Revert to original state on error
      setLocalChecklists(prevChecklists);
    }
  };

  // 4. Submit Task as Done
  const handleSubmitDone = async (taskId: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/done`, {
        method: "POST",
        headers: { accept: "application/json" },
      });

      if (response.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (error) {
      console.error("Failed to submit task as done:", error);
    } finally {
      setUpdating(false);
    }
  };

  // Filter tasks to show only: In Progress, Waiting Approval, Ready
  const approvalCandidateTasks = data.tasks.filter((task) =>
    ["In Progress", "Waiting Approval", "Ready"].includes(task.status)
  );

  const filteredTasks = approvalCandidateTasks.filter((task) => {
    const matchStatus =
      selectedStatus === "All" ? true : task.status === selectedStatus;
    const matchProject =
      selectedProjectId === "All" || task.project_id === selectedProjectId;
    return matchStatus && matchProject;
  });

  const projectOptions = [
    { value: "All", label: "All Projects" },
    ...data.projects.map((p) => ({ value: p.project_id, label: p.project_name })),
  ];

  const statusTabs = ["All", "In Progress", "Waiting Approval", "Ready"];

  return (
    <Page>
      <div className={styles.toolbar}>
        {/* Status Filter Tabs */}
        <div className={styles.statusTabs}>
          {statusTabs.map((tab) => {
            const isActive = selectedStatus === tab;
            const count =
              tab === "All"
                ? approvalCandidateTasks.length
                : approvalCandidateTasks.filter((t) => t.status === tab).length;

            return (
              <button
                key={tab}
                onClick={() => setSelectedStatus(tab)}
                className={cn(
                  styles.statusTab,
                  isActive
                    ? styles.statusTabActive
                    : styles.statusTabIdle
                )}
              >
                {tab}
                <span
                  className={cn(
                    styles.statusTabCount,
                    isActive
                      ? styles.statusTabCountActive
                      : styles.statusTabCountIdle
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Project Select Filter */}
        <div className={styles.projectFilter}>
          <Layers className={styles.projectFilterIcon} />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className={styles.projectSelect}
          >
            {projectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Single Column Grid of Wide Task Cards */}
      {filteredTasks.length === 0 ? (
        <div className={styles.emptyState}>
          <CheckSquare className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>
            No tasks found
          </h3>
          <p className={styles.emptyText}>
            There are no approval candidate tasks matching the filters.
          </p>
        </div>
      ) : (
        <div className={styles.taskList}>
          {filteredTasks.map((task) => {
            const taskChecklists = getTaskChecklists(task.task_id);
            const needsApproval = taskNeedsLeaderApproval(task);
            const approvedCount = taskChecklists.filter((c) => c.pm_approved).length;

            const isLeaderApproved =
              !needsApproval ||
              (taskChecklists.length > 0
                ? taskChecklists.every((item) => item.pm_approved)
                : true);

            const doneDisabled = needsApproval && !isLeaderApproved;
            const project = data.projects.find(
              (p) => p.project_id === task.project_id
            );

            return (
              <article
                key={task.task_id}
                className={styles.taskCard}
              >
                {/* Main Card Columns */}
                <div className={styles.taskCardGrid}>
                  
                  {/* Task details column */}
                  <div className={styles.taskDetails}>
                    <div className={styles.taskIdRow}>
                      <code className={styles.taskId}>
                        #{task.task_id}
                      </code>
                      <Badge
                        tone={
                          task.priority === "Urgent"
                            ? "red"
                            : task.priority === "High"
                            ? "yellow"
                            : "neutral"
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <Link
                      href={`/tasks/${task.task_id}`}
                      className={styles.taskTitle}
                    >
                      {task.title}
                    </Link>
                    {task.description && (
                      <p className={styles.taskDescription}>
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Project Cell */}
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>Project</span>
                    <span className={styles.metaValue}>
                      {project?.project_name ?? "No Project"}
                    </span>
                  </div>

                  {/* Date Cell */}
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>Date</span>
                    <span className={styles.metaValueMuted}>
                      {task.due_date ? formatShortDate(task.due_date) : "-"}
                    </span>
                  </div>

                  {/* Assignees Cell */}
                  <div className={styles.metaField}>
                    <span className={styles.metaLabel}>Assignees</span>
                    <div className={styles.assigneeAvatars}>
                      {task.assigned_to.map((id) => (
                        <Avatar
                          key={id}
                          name={userName(id)}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Status Cell */}
                  <div className={styles.statusField}>
                    <span className={styles.metaLabel}>Status</span>
                    <TaskStatusPill
                      status={task.status}
                      dueDate={task.due_date}
                      handedOffAt={task.handed_off_at}
                    />
                  </div>
                </div>

                {/* Subtasks and Report display section - side by side */}
                <div className={styles.checklistSection}>
                  
                  {/* Left Column: Subtasks Checklists */}
                  <div className={styles.checklistHeaderStack}>
                    {taskChecklists.length > 0 ? (
                      <>
                        <div className={styles.checklistHeader}>
                          <span>Subtasks ({approvedCount}/{taskChecklists.length})</span>
                        </div>

                         <div className={styles.checklistList}>
                           {taskChecklists.map((subtask) => {
                             const assigneeDone =
                               subtask.assignee_completed || subtask.is_completed;
                             const approved = subtask.pm_approved;
                             const itemComplete = assigneeDone && (!needsApproval || approved);
 
                             return (
                               <div
                                 key={subtask.checklist_id}
                                 className={styles.checklistItem}
                               >
                                 <p
                                   className={cn(
                                     styles.checklistItemText,
                                     itemComplete
                                       ? styles.checklistItemTextDone
                                       : styles.checklistItemTextTodo
                                   )}
                                 >
                                   {subtask.title}
                                 </p>
 
                                 <div className={styles.checklistActions}>
                                   {/* Assignee Checkbox */}
                                   <button
                                     type="button"
                                     disabled={updating || isPending}
                                     onClick={() =>
                                       handleToggleAssignee(
                                         subtask.checklist_id,
                                         assigneeDone
                                       )
                                     }
                                     className={styles.assigneeToggle}
                                   >
                                     <span
                                       className={cn(
                                         styles.checkBox,
                                         assigneeDone
                                           ? styles.checkBoxDone
                                           : styles.checkBoxIdle,
                                         (updating || isPending) && styles.checkBoxDisabled
                                       )}
                                     >
                                       {assigneeDone ? (
                                         <Check className={styles.checkIcon} />
                                       ) : null}
                                     </span>
                                     <span 
                                       className={cn(styles.checkLabel, assigneeDone ? styles.checkLabelDone : styles.checkLabelMuted)}
                                     >
                                       Assignee
                                     </span>
                                   </button>
 
                                   {/* Leader Approved Checkbox */}
                                   {needsApproval && (
                                     <button
                                       type="button"
                                       disabled={updating || isPending || !assigneeDone}
                                       onClick={() =>
                                         handleToggleSubtask(
                                           subtask.checklist_id,
                                           approved,
                                           assigneeDone
                                         )
                                       }
                                       className={cn(
                                         styles.leaderToggle,
                                         assigneeDone ? styles.leaderToggleReady : styles.leaderToggleLocked
                                       )}
                                     >
                                       <span
                                         className={cn(
                                           styles.checkBox,
                                           approved
                                             ? styles.checkBoxLeaderDone
                                             : styles.checkBoxIdle,
                                           (!assigneeDone || updating || isPending) && styles.checkBoxDisabled
                                         )}
                                         style={
                                           approved
                                             ? {
                                                 backgroundColor: "#10b981",
                                                 borderColor: "#10b981",
                                               }
                                             : undefined
                                         }
                                       >
                                         {approved ? (
                                           <Check className={styles.checkIcon} />
                                         ) : null}
                                       </span>
                                       <span 
                                         className={cn(styles.checkLabel, approved ? "" : styles.checkLabelMuted)}
                                         style={approved ? { color: "#10b981" } : undefined}
                                       >
                                         Leader
                                       </span>
                                     </button>
                                   )}
                                 </div>
                               </div>
                             );
                           })}
                         </div>

                      </>
                    ) : (
                      <p className={styles.hintText}>
                        No subtasks assigned to this task.
                      </p>
                    )}
                  </div>

                  {/* Right Column: Completion report */}
                  <div className={styles.approvalBanner}>
                    <p className={styles.approvalBannerText}>
                      Completion Report
                    </p>
                    {task.report ? (
                      <LinkifiedText
                        text={task.report}
                        className={styles.approvalBannerIcon}
                      />
                    ) : (
                      <p className={styles.hintText}>
                        No report submitted yet.
                      </p>
                    )}
                  </div>

                </div>

                {/* Bottom Actions Row - aligned with the grid */}
                <div className={styles.cardActions}>
                  
                  {/* Bottom Left: Approve All Button */}
                  <div>
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      disabled={
                        updating ||
                        isPending ||
                        !needsApproval ||
                        taskChecklists.filter((c) => !c.pm_approved).length === 0
                      }
                      onClick={() => handleApproveAll(taskChecklists)}
                      className={styles.actionButton}
                    >
                      Approve All Subtasks
                    </Button>
                  </div>

                  {/* Bottom Right: Submit as Done Button */}
                  <div>
                    {updating ? (
                      <Button
                        disabled
                        variant="success"
                        size="lg"
                        className={styles.actionButton}
                      >
                        <Loader2 className={styles.spinner} />
                        Processing...
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="success"
                        size="lg"
                        disabled={doneDisabled}
                        onClick={() => handleSubmitDone(task.task_id)}
                        className={styles.actionButton}
                      >
                        <CheckCircle2 className={styles.approveIcon} />
                        Submit as Done
                      </Button>
                    )}

                    {doneDisabled && (
                      <p className={styles.warning}>
                        <AlertCircle className={styles.warningIcon} />
                        All subtasks must be approved by the leader first.
                      </p>
                    )}
                  </div>

                </div>

              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
