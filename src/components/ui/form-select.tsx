"use client";

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
  required = false,
  disabled = false,
  placeholder = "Select option",
  className,
  fullWidth = true,
}: FormSelectProps) {
  const [value, setValue] = useState(defaultValue);
  const items = options.map((option) => ({ value: option.value, label: option.label }));

  return (
    <div className={cn("min-w-0", className)}>
      <input type="hidden" name={name} value={value} required={required} />
      <Select
        value={value}
        items={items}
        onValueChange={(nextValue) => {
          if (nextValue !== null) setValue(nextValue);
        }}
        disabled={disabled}
        modal={false}
      >
        <SelectTrigger size="form" className={cn("bg-white shadow-none hover:bg-white", fullWidth ? "w-full" : "w-auto min-w-[11rem]")}>
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
