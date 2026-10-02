import type { AudiencePersona, Campaign } from "@/lib/types/social-hub";

export type StrategyOptionType = "funnel" | "pillar" | "channel" | "theme";

export const strategyOptionTypes: StrategyOptionType[] = ["funnel", "pillar", "channel", "theme"];

export const strategyOptionLabels: Record<StrategyOptionType, string> = {
  funnel: "Funnel",
  pillar: "Content pillar",
  channel: "Channel",
  theme: "Theme",
};

export type Brand = {
  brand_id: string;
  company_id: string;
  parent_brand_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export type StrategyOption = {
  option_id: string;
  project_id: string;
  company_id: string;
  type: StrategyOptionType;
  label: string;
  description: string;
  /** Planned share of content (0–100); used for pillars. */
  target_share: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectKpi = {
  kpi_id: string;
  project_id: string;
  company_id: string;
  name: string;
  unit: string;
  target_value: number;
  actual_value: number;
  channel: string;
  funnel: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ContentItem = {
  item_id: string;
  project_id: string;
  company_id: string;
  /** Linked production task (ticket id), empty while the row is still an idea. */
  task_id: string;
  title: string;
  brand_id: string | null;
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD */
  create_date: string;
  /** YYYY-MM-DD */
  publication_date: string;
  theme: string;
  funnel: string;
  pillar: string;
  channel: string;
  brief_url: string;
  drive_url: string;
  publication_url: string;
  caption: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const contentEditableFields = [
  "title",
  "task_id",
  "brand_id",
  "month",
  "create_date",
  "publication_date",
  "theme",
  "funnel",
  "pillar",
  "channel",
  "brief_url",
  "drive_url",
  "publication_url",
  "caption",
] as const;

export type ContentInput = Partial<Pick<ContentItem, (typeof contentEditableFields)[number]>>;

export type ProjectHubData = {
  /** Brands linked to this project (with parent for sub-brands). */
  brands: Brand[];
  /** Company brand master, for the brand picker. */
  companyBrands: Brand[];
  strategy: StrategyOption[];
  kpis: ProjectKpi[];
  content: ContentItem[];
  personas: AudiencePersona[];
  campaigns: Campaign[];
};

/** Akaal defaults seeded into a new project's strategy (docs/project-hub-plan.md). */
export const defaultStrategyOptions: Array<Pick<StrategyOption, "type" | "label" | "description" | "target_share">> = [
  { type: "funnel", label: "Awareness", description: "TOFU", target_share: null },
  { type: "funnel", label: "Consideration", description: "MOFU", target_share: null },
  { type: "funnel", label: "Conversion", description: "BOFU", target_share: null },
  { type: "pillar", label: "Educational", description: "", target_share: 30 },
  { type: "pillar", label: "Entertaining", description: "", target_share: 30 },
  { type: "pillar", label: "Inspirational", description: "", target_share: 20 },
  { type: "pillar", label: "Promotional", description: "", target_share: 20 },
  { type: "channel", label: "Instagram", description: "", target_share: null },
  { type: "channel", label: "TikTok", description: "", target_share: null },
  { type: "channel", label: "YouTube", description: "", target_share: null },
  { type: "channel", label: "Facebook", description: "", target_share: null },
  { type: "channel", label: "LinkedIn", description: "", target_share: null },
  { type: "channel", label: "X", description: "", target_share: null },
  { type: "channel", label: "Website", description: "", target_share: null },
];

/** Minimal user shape passed to project dashboard client components. */
export type ProjectUserSummary = {
  user_id: string;
  full_name: string;
  profile_photo?: string;
  position?: string;
  is_active: boolean;
};
