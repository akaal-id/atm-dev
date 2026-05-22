import { allPermissions, roles } from "@/lib/data/seed";
import type { Permission, RoleKey } from "@/lib/types";

export const employeeStatusOptions = [
  "Intern",
  "Employee",
  "Staff",
  "Supervisor",
  "Manager",
  "Leader",
  "Admin",
  "Freelance",
  "Part-time",
  "Full-time",
  "Resigned",
  "Inactive",
] as const;

export const taskStatuses = ["To Do", "In Progress", "Waiting Approval", "Need Revision", "Approved", "Done", "Late", "Cancelled"] as const;

export const projectStatuses = [
  "Not Started",
  "In Progress",
  "Waiting for Review",
  "Revision",
  "Approved",
  "Completed",
  "On Hold",
  "Cancelled",
] as const;

export const attendanceStatuses = [
  "Present",
  "Late",
  "Absent",
  "Sick",
  "Izin",
  "Cuti",
  "Work From Home",
  "Half Day",
  "Pending Approval",
  "Approved",
  "Rejected",
] as const;

export function getRole(roleId: RoleKey) {
  return roles.find((role) => role.role_id === roleId) ?? roles[roles.length - 1];
}

export function hasPermission(roleId: RoleKey, permission: Permission) {
  const role = getRole(roleId);
  return role.permissions_json.includes(permission) || role.permissions_json.length === allPermissions.length;
}

export function hasAnyPermission(roleId: RoleKey, permissions: Permission[]) {
  return permissions.some((permission) => hasPermission(roleId, permission));
}

export function roleLabel(roleId: RoleKey) {
  return getRole(roleId).role_name;
}
