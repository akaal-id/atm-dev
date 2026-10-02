export type AudiencePersona = {
  persona_id: string;
  project_id: string;
  company_id: string;
  name: string;
  age_range: string;
  gender: string;
  location: string;
  occupation: string;
  description: string;
  interests: string;
  pain_points: string;
  goals: string;
  /** Comma-separated channels this persona uses. */
  channels: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  campaign_id: string;
  project_id: string;
  company_id: string;
  name: string;
  objective: string;
  channel: string;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD */
  end_date: string;
  budget: number | null;
  brief_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CampaignStatus = "upcoming" | "running" | "done";

export const personaFields = ["name", "age_range", "gender", "location", "occupation", "description", "interests", "pain_points", "goals", "channels"] as const;
export const campaignTextFields = ["name", "objective", "channel", "start_date", "end_date", "brief_url", "notes"] as const;

export type PersonaInput = Partial<Pick<AudiencePersona, (typeof personaFields)[number] | "sort_order">>;
export type CampaignInput = Partial<Pick<Campaign, (typeof campaignTextFields)[number] | "budget">>;
