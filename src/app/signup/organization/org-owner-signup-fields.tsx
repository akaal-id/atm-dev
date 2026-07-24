"use client";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";

import { PasswordField } from "../password-field";
import styles from "../signup.module.css";

/** Organization owner registration fields (/signup/organization). */
export function OrgOwnerSignupFields() {
  return (
    <>
      <input type="hidden" name="account_type" value="org_owner" />
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
        <span>Phone</span>
        <input name="phone" className="input" autoComplete="tel" />
      </label>
      <label className={styles.field}>
        <span>
          Organization name <b className={styles.requiredMark}>*</b>
        </span>
        <input name="organization_name" required className="input" placeholder="e.g. PT Maju Jaya Group" />
      </label>
      <label className={styles.field}>
        <span>First company name</span>
        <input name="company_name" className="input" placeholder="Optional — defaults to organization name" />
      </label>
      <label className={styles.field}>
        <span>Birth date</span>
        <DatePickerField name="birthday" variant="form" />
      </label>
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
      <label className={styles.fieldWide}>
        <span>Bio</span>
        <textarea name="bio" className="input" rows={3} placeholder="Optional — about you or your organization." />
      </label>
      <p className={styles.hint}>
        After signup, sign in and complete the monthly subscription (dummy paywall) to unlock the ERP dashboard.
      </p>
      <Button className={styles.submit} type="submit" size="lg">
        Create organization
      </Button>
    </>
  );
}
