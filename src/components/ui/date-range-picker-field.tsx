"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { jakartaToday } from "@/lib/metrics";
import { cn, formatShortDate } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DateRangeValue = {
  from: string;
  to: string;
};

type DateRangePickerFieldProps = {
  label?: string;
  value?: DateRangeValue;
  onChange?: (value: DateRangeValue) => void;
  placeholder?: string;
  className?: string;
};

const triggerClassName =
  "flex h-[2.75rem] w-full items-center gap-2 rounded-lg border border-input bg-white px-3 text-left text-sm font-semibold text-slate-950 shadow-none transition-colors outline-none hover:bg-white focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

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

function formatRangeLabel(value: DateRangeValue, emptyLabel: string) {
  if (value.from && value.to) {
    return `${formatShortDate(value.from)} – ${formatShortDate(value.to)}`;
  }
  if (value.from) {
    return `${formatShortDate(value.from)} – …`;
  }
  if (value.to) {
    return `… – ${formatShortDate(value.to)}`;
  }
  return emptyLabel;
}

function isBetween(date: string, from: string, to: string) {
  return Boolean(from && to && date > from && date < to);
}

export function DateRangePickerField({
  label,
  value = { from: "", to: "" },
  onChange,
  placeholder = "Any date",
  className,
}: DateRangePickerFieldProps) {
  const today = jakartaToday();
  const [open, setOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(value.from ? value.from.slice(0, 7) : today.slice(0, 7));
  const [pendingFrom, setPendingFrom] = useState("");
  const cells = useMemo(() => monthCells(monthKey), [monthKey]);
  const hasValue = Boolean(value.from || value.to);

  const activeFrom = pendingFrom || value.from;
  const activeTo = pendingFrom ? "" : value.to;

  const setValue = (nextValue: DateRangeValue) => {
    onChange?.(nextValue);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setMonthKey(value.from ? value.from.slice(0, 7) : today.slice(0, 7));
      setPendingFrom("");
    }
    setOpen(nextOpen);
  };

  const selectDate = (date: string) => {
    if (!pendingFrom) {
      setPendingFrom(date);
      return;
    }

    const [from, to] = pendingFrom <= date ? [pendingFrom, date] : [date, pendingFrom];
    setPendingFrom("");
    setValue({ from, to });
    setOpen(false);
  };

  const clearValue = () => {
    setPendingFrom("");
    setValue({ from: "", to: "" });
  };

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      {label ? <span className="text-xs font-extrabold text-slate-600">{label}</span> : null}
      <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
        <PopoverTrigger type="button" className={cn(triggerClassName, !hasValue && !pendingFrom && "text-muted-foreground")}>
          <CalendarDays className="size-4 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-left">
            {pendingFrom ? `${formatShortDate(pendingFrom)} – …` : formatRangeLabel(value, placeholder)}
          </span>
          {hasValue ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date range"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                clearValue();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  clearValue();
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
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonthKey((current) => shiftMonth(current, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-bold text-slate-900">{monthTitle(monthKey)}</p>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonthKey((current) => shiftMonth(current, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <p className="mt-3 text-xs font-medium text-slate-500">
            {pendingFrom ? "Select an end date" : "Select a start date"}
          </p>

          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[0.7rem] font-bold tracking-wide text-slate-400 uppercase">
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

              const isStart = date === activeFrom;
              const isEnd = date === activeTo;
              const inRange = isBetween(date, activeFrom, activeTo);
              const isToday = today === date;
              const isSelected = isStart || isEnd;

              return (
                <Button
                  key={date}
                  type="button"
                  variant={isSelected ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => selectDate(date)}
                  className={cn(
                    "size-9 rounded-md text-sm font-semibold",
                    inRange && "bg-primary-subtle text-primary hover:bg-primary-subtle",
                    !isSelected && isToday && "bg-blue-50 text-blue-700 hover:bg-blue-100",
                  )}
                >
                  {Number(date.slice(8, 10))}
                </Button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setPendingFrom("");
                setValue({ from: today, to: today });
                setOpen(false);
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-slate-500"
              onClick={() => {
                clearValue();
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
