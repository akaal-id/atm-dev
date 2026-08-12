"use client";

import styles from "./date-picker-field.module.css";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { jakartaToday } from "@/lib/metrics";
import { cn, formatShortDate } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type CalendarView = "days" | "months" | "years";

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

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

function toMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthTitle(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function shiftMonth(monthKey: string, delta: number) {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return toMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

function yearDecadeStart(year: number) {
  return Math.floor(year / 12) * 12;
}

const filterControlClassName =
  styles.filterBar;

const formControlClassName =
  styles.input;

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
  const [view, setView] = useState<CalendarView>("days");
  const [monthKey, setMonthKey] = useState(value ? value.slice(0, 7) : today.slice(0, 7));
  const cells = useMemo(() => monthCells(monthKey), [monthKey]);
  const { year, month } = parseMonthKey(monthKey);
  const decadeStart = yearDecadeStart(year);
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
      setView("days");
    }
    setOpen(nextOpen);
  };

  const selectDate = (date: string) => {
    setValue(date);
    setOpen(false);
  };

  const headerLabel =
    view === "days"
      ? monthTitle(monthKey)
      : view === "months"
        ? String(year)
        : `${decadeStart} – ${decadeStart + 11}`;

  const goPrev = () => {
    if (view === "days") setMonthKey((current) => shiftMonth(current, -1));
    else if (view === "months") setMonthKey(toMonthKey(year - 1, month));
    else setMonthKey(toMonthKey(year - 12, month));
  };

  const goNext = () => {
    if (view === "days") setMonthKey((current) => shiftMonth(current, 1));
    else if (view === "months") setMonthKey(toMonthKey(year + 1, month));
    else setMonthKey(toMonthKey(year + 12, month));
  };

  const advanceView = () => {
    if (view === "days") setView("months");
    else if (view === "months") setView("years");
  };

  return (
    <div className={cn(styles.layout, className)}>
      {label ? <span className={styles.caption}>{label}</span> : null}
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
        <PopoverTrigger
          type="button"
          disabled={disabled}
          className={cn(triggerClassName, !value && styles.modalpanel)}
        >
          <CalendarDays className={styles.emptystate} />
          <span className={styles.captionSpan}>
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
              className={styles.icon}
            >
              <X className={styles.dialogPanel} />
            </span>
          ) : (
            <ChevronDown aria-hidden="true" className={styles.emptystate} />
          )}
        </PopoverTrigger>

        <PopoverContent side="bottom" align="start" sideOffset={4} className={styles.emptystatePopovercontent}>
          <div className={styles.emptystateDiv}>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous" onClick={goPrev}>
              <ChevronLeft className={styles.dialogPanel} />
            </Button>
            <button
              type="button"
              className={styles.previous}
              onClick={advanceView}
              aria-label={view === "days" ? "Choose month" : view === "months" ? "Choose year" : "Year range"}
              disabled={view === "years"}
            >
              <span className="truncate">{headerLabel}</span>
              {view !== "years" ? <ChevronDown className={styles.iconChevrondown} /> : null}
            </button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Next" onClick={goNext}>
              <ChevronRight className={styles.dialogPanel} />
            </Button>
          </div>

          {view === "days" ? (
            <>
              <div className={styles.next}>
                {WEEKDAYS.map((day) => (
                  <span key={day} className={styles.item}>
                    {day}
                  </span>
                ))}
              </div>

              <div className={styles.emptystate}>
                {cells.map((date, index) => {
                  if (!date) {
                    return <span key={`empty-${index}`} className={styles.captionPrimary} aria-hidden="true" />;
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
                        styles.previous,
                        !isSelected && isToday && styles.control,
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </Button>
                  );
                })}
              </div>
            </>
          ) : null}

          {view === "months" ? (
            <div className={styles.panel}>
              {MONTH_SHORT.map((label, index) => {
                const nextMonth = index + 1;
                const isSelected = month === nextMonth;
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    className={styles.dialogPanel}
                    onClick={() => {
                      setMonthKey(toMonthKey(year, nextMonth));
                      setView("days");
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          ) : null}

          {view === "years" ? (
            <div className={styles.panel}>
              {Array.from({ length: 12 }, (_, index) => decadeStart + index).map((nextYear) => {
                const isSelected = year === nextYear;
                return (
                  <Button
                    key={nextYear}
                    type="button"
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    className={styles.dialogPanel}
                    onClick={() => {
                      setMonthKey(toMonthKey(nextYear, month));
                      setView("months");
                    }}
                  >
                    {nextYear}
                  </Button>
                );
              })}
            </div>
          ) : null}

          <div className={styles.region}>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setMonthKey(today.slice(0, 7));
                setView("days");
                selectDate(today);
              }}
            >
              Today
            </Button>
            {canClear ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className={styles.modalpanel}
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
