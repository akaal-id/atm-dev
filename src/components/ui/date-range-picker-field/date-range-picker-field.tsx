"use client";

import styles from "./date-range-picker-field.module.css";

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
  styles.weekdays;

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
    <div className={cn(styles.modalpanel, className)}>
      {label ? <span className={styles.caption}>{label}</span> : null}
      <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
        <PopoverTrigger type="button" className={cn(triggerClassName, !hasValue && !pendingFrom && styles.dialogPanel)}>
          <CalendarDays className={styles.dialogpanelCalendardays} />
          <span className={styles.content}>
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
              className={styles.icon}
            >
              <X className={styles.dialogpanelX} />
            </span>
          ) : (
            <ChevronDown aria-hidden="true" className={styles.dialogpanelCalendardays} />
          )}
        </PopoverTrigger>

        <PopoverContent side="bottom" align="start" sideOffset={4} className={styles.dialogpanelPopovercontent}>
          <div className={styles.dialogpanelDiv}>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonthKey((current) => shiftMonth(current, -1))}>
              <ChevronLeft className={styles.dialogpanelX} />
            </Button>
            <p className={styles.itemDescription}>{monthTitle(monthKey)}</p>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonthKey((current) => shiftMonth(current, 1))}>
              <ChevronRight className={styles.dialogpanelX} />
            </Button>
          </div>

          <p className={styles.nextMonth}>
            {pendingFrom ? "Select an end date" : "Select a start date"}
          </p>

          <div className={styles.panel}>
            {WEEKDAYS.map((day) => (
              <span key={day} className={styles.item}>
                {day}
              </span>
            ))}
          </div>

          <div className={styles.emptystate}>
            {cells.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className={styles.captionSpan} aria-hidden="true" />;
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
                    styles.button,
                    inRange && styles.control,
                    !isSelected && isToday && styles.control,
                  )}
                >
                  {Number(date.slice(8, 10))}
                </Button>
              );
            })}
          </div>

          <div className={styles.region}>
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
              className={styles.dialogPanel}
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
