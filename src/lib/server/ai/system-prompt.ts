import { baseIdentityPrompt } from "@/lib/server/ai/base";
import { memoryRules } from "@/lib/server/ai/modules/memory";
import { subtaskRules } from "@/lib/server/ai/modules/subtask";
import { taskRules } from "@/lib/server/ai/modules/task";
import { workflowRules } from "@/lib/server/ai/modules/workflow";
import { accessScopeRule, CROSS_MODULE_RULES } from "@/lib/server/ai/rules";
import type { AiMemoryFact } from "@/lib/types/ai-chat";

export function buildSystemPrompt(input: {
  fullName: string;
  roleId: string;
  roleName: string;
  companyName: string;
  pagePath?: string;
  memorySummary: string;
  memoryFacts: AiMemoryFact[];
}) {
  return [
    baseIdentityPrompt({
      fullName: input.fullName,
      roleId: input.roleId,
      roleName: input.roleName,
      companyName: input.companyName,
      pagePath: input.pagePath,
    }),
    accessScopeRule(input.roleId),
    memoryRules({ memorySummary: input.memorySummary, memoryFacts: input.memoryFacts }),
    taskRules,
    subtaskRules,
    workflowRules,
    CROSS_MODULE_RULES,
  ]
    .filter((block) => block.trim())
    .join("\n\n");
}
