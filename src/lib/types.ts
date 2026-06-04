export type RoleKey =
  | "super_admin"
  | "admin"
  | "leader"
  | "supervisor"
  | "staff"
  | "employee"
  | "intern"
  | "viewer";

export type EmployeeStatus =
  | "Intern"
  | "Employee"
  | "Staff"
  | "Supervisor"
  | "Manager"
  | "Leader"
  | "Admin"
  | "Freelance"
  | "Part-time"
  | "Full-time"
  | "Resigned"
  | "Inactive";

export type SignupStatus = "invited" | "pending" | "approved" | "verified" | "rejected";

export type TaskStatus =
  | "To Do"
  | "In Progress"
  | "Waiting Approval"
  | "Ready"
  | "Finished"
  | "Need Revision"
  | "Approved"
  | "Done"
  | "Late"
  | "Cancelled";

export type ProjectStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting for Review"
  | "Revision"
  | "Approved"
  | "Completed"
  | "On Hold"
  | "Cancelled";

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export type AttendanceStatus =
  | "Present"
  | "Late"
  | "Absent"
  | "Sick"
  | "Izin"
  | "Cuti"
  | "Work From Home"
  | "Half Day"
  | "Pending Approval"
  | "Approved"
  | "Rejected";

export type LeaveRequestType = "Izin" | "Sick" | "Cuti" | "WFH" | "Half Day";

export type Permission =
  | "dashboard:view"
  | "tasks:own"
  | "tasks:team"
  | "tasks:manage"
  | "projects:manage"
  | "attendance:own"
  | "attendance:team"
  | "attendance:approve"
  | "announcements:view"
  | "announcements:manage"
  | "employees:view"
  | "employees:manage"
  | "leaderboard:view"
  | "notifications:view"
  | "admin:view"
  | "settings:manage"
  | "roles:manage"
  | "reports:export";

export interface User {
  user_id: string;
  full_name: string;
  email: string;
  password_hash_or_auth_id: string;
  profile_photo: string;
  bio: string;
  phone: string;
  department_id: string;
  position: string;
  employment_status: EmployeeStatus;
  role_id: RoleKey;
  birthday: string;
  join_date: string;
  is_active: boolean;
  signup_status: SignupStatus | "";
  signup_provider: string;
  verification_key_hash: string;
  verification_expires_at: string;
  requested_at: string;
  approved_at: string;
  rejected_at: string;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  department_id: string;
  department_name: string;
  leader_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  role_id: RoleKey;
  role_name: string;
  description: string;
  permissions_json: Permission[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  task_id: string;
  title: string;
  description: string;
  project_id: string;
  assigned_by: string;
  assigned_to: string[];
  priority: Priority;
  status: TaskStatus;
  due_date: string;
  progress: number;
  labels: string[];
  need_leader_approval?: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TaskComment {
  comment_id: string;
  task_id: string;
  user_id: string;
  comment: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskChecklist {
  checklist_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  assignee_completed: boolean;
  assignee_completed_by: string;
  pm_approved: boolean;
  pm_approved_by: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  project_id: string;
  ticket_id_prefix: string;
  project_name: string;
  description: string;
  owner_user_id: string;
  members: string[];
  priority: Priority;
  status: ProjectStatus;
  progress: number;
  deadline: string;
  notes: string;
  links: string[];
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  attendance_id: string;
  user_id: string;
  date: string;
  clock_in: string;
  clock_out: string;
  status: AttendanceStatus;
  note: string;
  approval_status: "Not Required" | "Pending Approval" | "Approved" | "Rejected";
  approved_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  request_id: string;
  user_id: string;
  request_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url: string;
  status: "Pending Approval" | "Approved" | "Rejected";
  approved_by: string;
  approval_note: string;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  announcement_id: string;
  title: string;
  body: string;
  category: "General" | "HR" | "Task" | "Event" | "Birthday" | "Important" | "Policy" | "Reminder";
  target_department: string;
  target_users: string[];
  is_pinned: boolean;
  scheduled_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  event_id: string;
  title: string;
  description: string;
  type:
    | "Birthday"
    | "Task"
    | "Deadline"
    | "Announcement"
    | "Meeting"
    | "Leave"
    | "Sick"
    | "Izin"
    | "Project Milestone"
    | "Company Event";
  start_date: string;
  end_date: string;
  related_user_id: string;
  related_task_id: string;
  related_project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  notification_id: string;
  user_id: string;
  title: string;
  description: string;
  type: string;
  related_link: string;
  is_read: boolean;
  created_at: string;
}

export interface GamificationPoint {
  point_id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  points: number;
  reason: string;
  created_at: string;
}

export interface Badge {
  badge_id: string;
  badge_name: string;
  description: string;
  icon: string;
  criteria_json: Record<string, string | number | boolean>;
  created_at: string;
  updated_at: string;
}

export interface UserBadge {
  user_badge_id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface ActivityLog {
  log_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
  created_at: string;
}

export interface Setting {
  setting_id: string;
  setting_key: string;
  setting_value: string;
  setting_type: "text" | "number" | "boolean" | "json" | "time" | "date";
  updated_by: string;
  updated_at: string;
}

export interface CurrentUser extends Omit<User, "password_hash_or_auth_id"> {
  role: Role;
  department: Department;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  attendanceRate: number;
  pendingApprovals: number;
  activeEmployees: number;
  unreadNotifications: number;
}
