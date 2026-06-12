"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import styles from "./signup.module.css";

interface PasswordFieldProps {
  name: string;
  label: string;
  autoComplete: string;
  required?: boolean;
}

export function PasswordField({ name, label, autoComplete, required }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <label className={styles.field}>
      <span>
        {label}
        {required ? <b className={styles.requiredMark}>*</b> : null}
      </span>
      <div className={styles.passwordControl}>
        <input
          name={name}
          type={isVisible ? "text" : "password"}
          required={required}
          minLength={8}
          className="input"
          autoComplete={autoComplete}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={styles.passwordToggle}
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setIsVisible((current) => !current)}
        >
          <Icon size={18} aria-hidden="true" />
        </Button>
      </div>
    </label>
  );
}
