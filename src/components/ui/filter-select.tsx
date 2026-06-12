"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type FilterSelectProps = {
  label?: string;
  value: string;
  options: FilterSelectOption[];
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  className?: string;
};

export function FilterSelect({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  placeholder = "Select option",
  fullWidth = true,
  className,
}: FilterSelectProps) {
  const items = options.map((option) => ({ value: option.value, label: option.label }));

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      {label ? <span className="text-xs font-extrabold text-slate-600">{label}</span> : null}
      <Select
        value={value}
        items={items}
        onValueChange={(nextValue) => {
          if (nextValue) onValueChange?.(nextValue);
        }}
        disabled={disabled}
        modal={false}
      >
        <SelectTrigger
          size="filter"
          className={cn(
            "bg-white text-sm font-semibold text-slate-950 shadow-none hover:bg-white",
            fullWidth ? "w-full" : "w-auto min-w-[11rem]",
          )}
        >
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
