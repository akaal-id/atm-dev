"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";

import { PasswordField } from "./password-field";
import styles from "./signup.module.css";

type CompanyOption = { id: string; name: string; is_verified?: boolean };
type DepartmentOption = { department_id: string; department_name: string };

/** Employee access-request fields — org id → company → department cascade. */
export function SignupFields() {
  const [organizationInput, setOrganizationInput] = useState("");
  const [resolvedOrganizationId, setResolvedOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [orgStatus, setOrgStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [orgError, setOrgError] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [deptStatus, setDeptStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const ref = organizationInput.trim();
    if (!ref) {
      setOrgStatus("idle");
      setOrgError("");
      setOrganizationName("");
      setResolvedOrganizationId("");
      setCompanies([]);
      setCompanyId("");
      setDepartments([]);
      setDepartmentId("");
      setDeptStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setOrgStatus("loading");
      setOrgError("");
      setCompanyId("");
      setDepartments([]);
      setDepartmentId("");
      setDeptStatus("idle");
      try {
        const response = await fetch(`/api/signup/organization?id=${encodeURIComponent(ref)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = (await response.json()) as {
          error?: string;
          organization?: { id: string; name: string };
          companies?: CompanyOption[];
        };
        if (!response.ok) throw new Error(body.error || "Organization not found");

        setOrganizationName(body.organization?.name || "");
        setResolvedOrganizationId(body.organization?.id || ref);
        setCompanies(body.companies || []);
        setOrgStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setOrganizationName("");
        setResolvedOrganizationId("");
        setCompanies([]);
        setOrgStatus("error");
        setOrgError(error instanceof Error ? error.message : "Organization not found");
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [organizationInput]);

  useEffect(() => {
    if (!companyId) {
      setDepartments([]);
      setDepartmentId("");
      setDeptStatus("idle");
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setDeptStatus("loading");
      setDepartmentId("");
      try {
        const response = await fetch(`/api/signup/departments?company_id=${encodeURIComponent(companyId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = (await response.json()) as { error?: string; data?: DepartmentOption[] };
        if (!response.ok) throw new Error(body.error || "Failed to load departments");
        setDepartments(body.data || []);
        setDeptStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        setDepartments([]);
        setDeptStatus("error");
      }
    })();

    return () => controller.abort();
  }, [companyId]);

  const companyDisabled = orgStatus !== "ready" || companies.length === 0;
  const departmentDisabled = !companyId || deptStatus === "loading" || departments.length === 0;

  return (
    <>
      <input type="hidden" name="account_type" value="employee" />
      <input type="hidden" name="organization_id" value={resolvedOrganizationId} />

      <label className={styles.field}>
        <span>
          Full name <b className={styles.requiredMark}>*</b>
        </span>
        <input name="full_name" required className="input" autoComplete="name" />
      </label>
      <label className={styles.field}>
        <span>
          Email <b className={styles.requiredMark}>*</b>
        </span>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </label>
      <PasswordField name="password" label="Password" autoComplete="new-password" required />
      <PasswordField name="confirm_password" label="Confirm password" autoComplete="new-password" required />
      <label className={styles.field}>
        <span>Profile photo</span>
        <input name="profile_photo" type="url" className="input" placeholder="https://..." />
        <input
          name="profile_photo_file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
          className="input"
        />
      </label>
      <label className={styles.field}>
        <span>Phone</span>
        <input name="phone" className="input" autoComplete="tel" />
      </label>

      <label className={styles.field}>
        <span>
          Organization ID <b className={styles.requiredMark}>*</b>
        </span>
        <div className={styles.orgIdControl}>
          <input
            className="input"
            value={organizationInput}
            onChange={(event) => setOrganizationInput(event.target.value)}
            placeholder="e.g. org_your_company"
            autoComplete="off"
            required
            aria-invalid={orgStatus === "error"}
            aria-describedby={organizationName && orgStatus === "ready" ? "org-id-status" : undefined}
          />
          {orgStatus === "loading" ? (
            <span className={styles.orgIdStatus} aria-label="Looking up organization">
              <Loader2 className={styles.orgIdSpin} aria-hidden />
            </span>
          ) : null}
          {orgStatus === "ready" ? (
            <span
              id="org-id-status"
              className={styles.orgIdStatusOk}
              title={organizationName ? `Found: ${organizationName}` : "Organization found"}
              aria-label={organizationName ? `Found: ${organizationName}` : "Organization found"}
            >
              <Check className={styles.orgIdIcon} aria-hidden />
            </span>
          ) : null}
          {orgStatus === "error" ? (
            <span
              className={styles.orgIdStatusError}
              title={orgError || "Organization not found"}
              aria-label={orgError || "Organization not found"}
            >
              <X className={styles.orgIdIcon} aria-hidden />
            </span>
          ) : null}
        </div>
      </label>

      <label className={styles.field}>
        <span>
          Company <b className={styles.requiredMark}>*</b>
        </span>
        <FormSelect
          key={`company-${resolvedOrganizationId}-${companies.length}`}
          name="company_id"
          required
          disabled={companyDisabled}
          value={companyId}
          onValueChange={setCompanyId}
          placeholder={
            orgStatus === "idle"
              ? "Enter organization ID first"
              : orgStatus === "loading"
                ? "Loading companies…"
                : companies.length === 0
                  ? "No companies in this organization"
                  : "Select company"
          }
          options={companies.map((company) => ({
            value: company.id,
            label: company.name,
          }))}
        />
      </label>

      <label className={styles.field}>
        <span>
          Department <b className={styles.requiredMark}>*</b>
        </span>
        <FormSelect
          key={`department-${companyId}-${departments.length}`}
          name="department_id"
          required
          disabled={departmentDisabled}
          value={departmentId}
          onValueChange={setDepartmentId}
          placeholder={
            !companyId
              ? "Select company first"
              : deptStatus === "loading"
                ? "Loading departments…"
                : departments.length === 0
                  ? "No departments yet — ask your admin"
                  : "Select department"
          }
          options={departments.map((department) => ({
            value: department.department_id,
            label: department.department_name,
          }))}
        />
      </label>

      <label className={styles.field}>
        <span>
          Birth date <b className={styles.requiredMark}>*</b>
        </span>
        <DatePickerField name="birthday" required variant="form" />
      </label>
      <label className={styles.field}>
        <span>
          Join date <b className={styles.requiredMark}>*</b>
        </span>
        <DatePickerField name="join_date" required variant="form" />
      </label>
      <label className={styles.fieldWide}>
        <span>Bio</span>
        <textarea name="bio" className="input" rows={4} placeholder="Tell the team a little about your role or background." />
      </label>
      <Button className={styles.submit} type="submit" size="lg">
        Request account
      </Button>
    </>
  );
}
