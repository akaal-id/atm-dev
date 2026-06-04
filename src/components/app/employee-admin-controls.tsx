"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { EmployeeStatus, RoleKey } from "@/lib/types";

export interface EmployeeAdminUser {
  user_id: string;
  full_name: string;
  email: string;
  position: string;
  department_id: string;
  role_id: RoleKey;
  employment_status: EmployeeStatus;
  birthday: string;
  join_date: string;
  is_active: boolean;
  profile_photo: string;
  bio: string;
}

export interface EmployeeAdminDepartment {
  department_id: string;
  department_name: string;
}

export interface EmployeeAdminRole {
  role_id: RoleKey;
  role_name: string;
}

export function EmployeeAdminControls({
  employee,
  departments,
  roles,
  statuses,
  canRemove,
}: {
  employee: EmployeeAdminUser;
  departments: EmployeeAdminDepartment[];
  roles: EmployeeAdminRole[];
  statuses: readonly EmployeeStatus[];
  canRemove: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const response = await fetch(`/api/resources/Users/${employee.user_id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: new FormData(event.currentTarget),
    }).catch(() => null);

    setSaving(false);

    if (!response?.ok) {
      const error = await response?.json().catch(() => null);
      setMessage(error?.error ? String(error.error) : "Could not save user details.");
      return;
    }

    setMessage("User details saved.");
    router.refresh();
  };

  const removeUser = async () => {
    if (!canRemove || removing) return;
    setRemoving(true);
    setMessage("");

    const formData = new FormData();
    formData.set("_method", "delete");

    const response = await fetch(`/api/resources/Users/${employee.user_id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: formData,
    }).catch(() => null);

    setRemoving(false);

    if (!response?.ok) {
      const error = await response?.json().catch(() => null);
      setMessage(error?.error ? String(error.error) : "Could not remove user account.");
      return;
    }

    router.push("/employees");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={saveUser} encType="multipart/form-data" className="grid gap-4 md:grid-cols-2">
        <Field label="Full name">
          <input name="full_name" required className="input" defaultValue={employee.full_name} />
        </Field>
        <Field label="Email">
          <input name="email" required type="email" className="input" defaultValue={employee.email} />
        </Field>
        <Field label="Position">
          <input name="position" required className="input" defaultValue={employee.position} />
        </Field>
        <Field label="Department">
          <select name="department_id" className="input" defaultValue={employee.department_id}>
            {departments.map((department) => (
              <option key={department.department_id} value={department.department_id}>
                {department.department_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select name="role_id" className="input" defaultValue={employee.role_id}>
            {roles.map((role) => (
              <option key={role.role_id} value={role.role_id}>
                {role.role_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employment status">
          <select name="employment_status" className="input" defaultValue={employee.employment_status}>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Birthday">
          <input name="birthday" type="date" className="input" defaultValue={employee.birthday} />
        </Field>
        <Field label="Join date">
          <input name="join_date" type="date" className="input" defaultValue={employee.join_date} />
        </Field>
        <Field label="Account status">
          <select name="is_active" className="input" defaultValue={String(employee.is_active)}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
        <Field label="Profile photo">
          <input name="profile_photo" type="url" className="input" defaultValue={employee.profile_photo} />
          <input name="profile_photo_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input" />
        </Field>
        <Field label="Bio">
          <textarea name="bio" className="input" rows={4} defaultValue={employee.bio} />
        </Field>
        <div className="flex items-end">
          <button disabled={saving} className="h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Saving..." : "Save user"}
          </button>
        </div>
      </form>

      {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">{message}</p> : null}

      {canRemove ? (
        <button
          type="button"
          onClick={removeUser}
          disabled={removing}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
        >
          <Trash2 className="h-4 w-4" />
          {removing ? "Removing..." : "Remove user account"}
        </button>
      ) : (
        <p className="text-sm font-medium text-slate-500">You cannot remove your own account while signed in.</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
