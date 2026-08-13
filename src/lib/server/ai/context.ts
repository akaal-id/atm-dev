import type { CurrentUser } from "@/lib/types";

/** Shared runtime context for AI modules (tools + optional page-aware rules). */
export type AiToolContext = {
  user: CurrentUser;
  companyId: string;
  companyName: string;
  pagePath?: string;
  onRememberFact?: () => void;
};
