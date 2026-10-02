import { contentEditableFields, type ContentInput, type ContentItem } from "@/lib/types/project-hub";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const URL_FIELDS = new Set(["brief_url", "drive_url", "publication_url"]);

/** Validate a content create/patch body; only keys present in `body` are returned. */
export function parseContentInput(body: Record<string, unknown>): { value: ContentInput } | { error: string } {
  const value: ContentInput = {};

  for (const field of contentEditableFields) {
    if (body[field] === undefined) continue;
    const raw = body[field] === null ? "" : String(body[field]);
    const text = field === "caption" ? raw.replace(/\r\n/g, "\n") : raw.trim();

    if (field === "brand_id") {
      value.brand_id = text || null;
      continue;
    }
    if ((field === "create_date" || field === "publication_date") && text && !DATE_PATTERN.test(text)) {
      return { error: `${field.replace("_", " ")} must be YYYY-MM-DD.` };
    }
    if (field === "month" && text && !MONTH_PATTERN.test(text)) return { error: "Month must be YYYY-MM." };
    if (URL_FIELDS.has(field) && text && !/^https?:\/\//i.test(text)) {
      return { error: `${field.replace("_url", "").replace("_", " ")} link must start with http:// or https://` };
    }
    value[field] = text;
  }

  if (value.title !== undefined && !value.title) return { error: "Title is required." };
  // Month follows the publication date unless it was set explicitly.
  if (value.publication_date && body.month === undefined) value.month = value.publication_date.slice(0, 7);
  return { value };
}

export function formatMonth(month: string) {
  if (!MONTH_PATTERN.test(month)) return month || "—";
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(new Date(year, monthIndex - 1, 1));
}

/** Matrix order: by publication date (undated last), then creation. */
export function sortContent(items: ContentItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = left.publication_date || "9999";
    const rightDate = right.publication_date || "9999";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    return left.created_at.localeCompare(right.created_at);
  });
}

/** Count content per label for one strategy dimension. */
export function countBy(items: ContentItem[], field: "funnel" | "pillar" | "channel" | "theme") {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item[field];
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** "Parent › Sub-brand" label for a brand id. */
export function brandLabel(brandId: string | null, brands: Array<{ brand_id: string; name: string; parent_brand_id: string | null }>) {
  if (!brandId) return "";
  const brand = brands.find((item) => item.brand_id === brandId);
  if (!brand) return "";
  const parent = brand.parent_brand_id ? brands.find((item) => item.brand_id === brand.parent_brand_id) : undefined;
  return parent ? `${parent.name} › ${brand.name}` : brand.name;
}
