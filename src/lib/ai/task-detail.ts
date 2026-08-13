import type { AiPriority } from "@/lib/ai/mutation";
import type { TaskStatus } from "@/lib/types";

export type AiTaskChecklistItem = {
  checklist_id: string;
  title: string;
  is_completed: boolean;
};

export type AiTaskCommentItem = {
  comment_id: string;
  author: string;
  comment: string;
  created_at: string;
};

export type AiTaskDetail = {
  task_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: AiPriority;
  due_date: string;
  is_due_today: boolean;
  is_overdue: boolean;
  progress: number;
  project_name: string;
  workflow_name: string;
  assignees: string[];
  assigned_by: string;
  labels: string[];
  report: string;
  created_at: string;
  checklist: AiTaskChecklistItem[];
  comments: AiTaskCommentItem[];
};

export type AiTaskPickItem = {
  task_id: string;
  title: string;
  status: TaskStatus;
};
