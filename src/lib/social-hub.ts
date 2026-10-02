import {
  campaignTextFields,
  personaFields,
  type Campaign,
  type CampaignInput,
  type CampaignStatus,
  type PersonaInput,
} from "@/lib/types/social-hub";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Only keys present in `body` are returned. */
export function parsePersonaInput(body: Record<string, unknown>): { value: PersonaInput } | { error: string } {
  const value: PersonaInput = {};
  for (const field of personaFields) {
    if (body[field] !== undefined) value[field] = String(body[field] ?? "").trim();
  }
  if (value.name !== undefined && !value.name) return { error: "Persona name is required." };
  if (body.sort_order !== undefined) value.sort_order = Number(body.sort_order) || 0;
  return { value };
}

export function parseCampaignInput(body: Record<string, unknown>): { value: CampaignInput } | { error: string } {
  const value: CampaignInput = {};
  for (const field of campaignTextFields) {
    if (body[field] !== undefined) value[field] = String(body[field] ?? "").trim();
  }
  if (value.name !== undefined && !value.name) return { error: "Campaign name is required." };
  for (const field of ["start_date", "end_date"] as const) {
    if (value[field] && !DATE_PATTERN.test(value[field]!)) return { error: `${field.replace("_", " ")} must be YYYY-MM-DD.` };
  }
  if (value.start_date && value.end_date && value.end_date < value.start_date) return { error: "End date must be on or after start date." };
  if (value.brief_url && !/^https?:\/\//i.test(value.brief_url)) return { error: "Brief link must start with http:// or https://" };
  if (body.budget !== undefined) {
    if (body.budget === null || body.budget === "") value.budget = null;
    else {
      const budget = Number(body.budget);
      if (!Number.isFinite(budget) || budget < 0) return { error: "Budget must be a positive number." };
      value.budget = budget;
    }
  }
  return { value };
}

/** Upcoming before start, done after end; undated campaigns count as upcoming. */
export function campaignStatus(campaign: Pick<Campaign, "start_date" | "end_date">, today = new Date().toISOString().slice(0, 10)): CampaignStatus {
  if (campaign.end_date && campaign.end_date < today) return "done";
  if (campaign.start_date && campaign.start_date <= today) return "running";
  return "upcoming";
}

export function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
