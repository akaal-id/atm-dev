import type { ProjectKpi } from "@/lib/types/project-hub";

type KpiFields = Partial<Pick<ProjectKpi, "name" | "unit" | "target_value" | "actual_value" | "channel" | "funnel" | "sort_order">>;

/** Validate a KPI create/patch body; only keys present in `body` are returned. */
export function parseKpiInput(body: Record<string, unknown>): { value: KpiFields } | { error: string } {
  const value: KpiFields = {};

  for (const field of ["name", "unit", "channel", "funnel"] as const) {
    if (body[field] !== undefined) value[field] = String(body[field] ?? "").trim();
  }
  for (const field of ["target_value", "actual_value"] as const) {
    if (body[field] === undefined) continue;
    const number = body[field] === "" ? 0 : Number(body[field]);
    if (!Number.isFinite(number) || number < 0) return { error: `${field.replace("_", " ")} must be a positive number.` };
    value[field] = number;
  }
  if (body.sort_order !== undefined) value.sort_order = Number(body.sort_order) || 0;

  return { value };
}

/** Achievement percentage (0 when no target), capped for display at 999. */
export function kpiAchievement(kpi: Pick<ProjectKpi, "target_value" | "actual_value">) {
  if (!kpi.target_value) return 0;
  return Math.min(999, Math.round((kpi.actual_value / kpi.target_value) * 100));
}

export function formatKpiValue(value: number, unit: string) {
  const formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
  if (!unit) return formatted;
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}
