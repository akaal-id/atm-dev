"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { jakartaToday } from "@/lib/metrics";
import { cn, formatShortDate } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DatePickerFieldProps = {
  label?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  variant?: "filter" | "form";
  className?: string;
};

function monthCells(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: firstDay.getUTCDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const filterControlClassName =
  "flex h-[2.75rem] w-full items-center gap-2 rounded-lg border border-input bg-white px-3 text-left text-sm font-semibold text-slate-950 shadow-none transition-colors outline-none hover:bg-white focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

const formControlClassName =
  "input flex h-[2.75rem] w-full items-center gap-2 bg-white px-3 text-left font-semibold text-slate-950 shadow-none transition-colors outline-none hover:bg-white focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

export function DatePickerField({
  label,
  name,
  value: controlledValue,
  defaultValue = "",
  onChange,
  required = false,
  disabled = false,
  clearable,
  placeholder,
  variant = "filter",
  className,
}: DatePickerFieldProps) {
  const today = jakartaToday();
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(value ? value.slice(0, 7) : today.slice(0, 7));
  const cells = useMemo(() => monthCells(monthKey), [monthKey]);
  const canClear = clearable ?? (variant === "filter" && !required);
  const emptyLabel = placeholder ?? (variant === "filter" ? "Any date" : "Select date");
  const triggerClassName = variant === "filter" ? filterControlClassName : formControlClassName;

  const setValue = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setMonthKey(value ? value.slice(0, 7) : today.slice(0, 7));
    }
    setOpen(nextOpen);
  };

  const selectDate = (date: string) => {
    setValue(date);
    setOpen(false);
  };

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      {label ? <span className="text-xs font-extrabold text-slate-600">{label}</span> : null}
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
        <PopoverTrigger
          type="button"
          disabled={disabled}
          className={cn(triggerClassName, !value && "text-muted-foreground")}
        >
          <CalendarDays className="size-4 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-left">
            {value ? formatShortDate(value) : emptyLabel}
          </span>
          {value && canClear && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setValue("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  setValue("");
                }
              }}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </span>
          ) : (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          )}
        </PopoverTrigger>

        <PopoverContent side="bottom" align="start" sideOffset={4} className="w-[18.5rem] p-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setMonthKey((current) => shiftMonth(current, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-bold text-slate-900">{monthTitle(monthKey)}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setMonthKey((current) => shiftMonth(current, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.7rem] font-bold tracking-wide text-slate-400 uppercase">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className="size-9" aria-hidden="true" />;
              }

              const isSelected = value === date;
              const isToday = today === date;

              return (
                <Button
                  key={date}
                  type="button"
                  variant={isSelected ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => selectDate(date)}
                  className={cn(
                    "size-9 rounded-md text-sm font-semibold",
                    !isSelected && isToday && "bg-blue-50 text-blue-700 hover:bg-blue-100",
                  )}
                >
                  {Number(date.slice(8, 10))}
                </Button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="link" size="sm" onClick={() => selectDate(today)}>
              Today
            </Button>
            {canClear ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-slate-500"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : (
              <span />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
