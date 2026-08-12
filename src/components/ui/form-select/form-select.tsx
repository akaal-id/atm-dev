"use client";

import styles from "./form-select.module.css";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FormSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type FormSelectProps = {
  name: string;
  options: FormSelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  fullWidth?: boolean;
};

export function FormSelect({
  name,
  options,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  required = false,
  disabled = false,
  placeholder = "Select option",
  className,
  fullWidth = true,
}: FormSelectProps) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : uncontrolledValue;
  const items = options.map((option) => ({ value: option.value, label: option.label }));

  return (
    <div className={cn(styles.content, className)}>
      <input type="hidden" name={name} value={value} required={required} />
      <Select
        value={value || null}
        items={items}
        onValueChange={(nextValue) => {
          if (nextValue === null) return;
          if (!isControlled) setUncontrolledValue(nextValue);
          onValueChange?.(nextValue);
        }}
        disabled={disabled}
        modal={false}
      >
        <SelectTrigger size="form" className={cn(styles.field, fullWidth ? styles.select : styles.wauto)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent side="bottom" align="start" sideOffset={6} alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
