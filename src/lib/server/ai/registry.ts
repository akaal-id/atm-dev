import { memoryTools } from "@/lib/server/ai/modules/memory";
import { subtaskTools } from "@/lib/server/ai/modules/subtask";
import { taskTools } from "@/lib/server/ai/modules/task";
import { workflowTools } from "@/lib/server/ai/modules/workflow";
import type { AiToolContext } from "@/lib/server/ai/context";
import { buildSystemPrompt } from "@/lib/server/ai/system-prompt";
import type { AiMemoryFact } from "@/lib/types/ai-chat";

type ToolBag = Record<string, unknown>;

function assertUniqueToolKeys(modules: Array<{ name: string; tools: ToolBag }>) {
  const seen = new Map<string, string>();
  for (const mod of modules) {
    for (const key of Object.keys(mod.tools)) {
      const previous = seen.get(key);
      if (previous) {
        throw new Error(`Duplicate AI tool key "${key}" in modules "${previous}" and "${mod.name}".`);
      }
      seen.set(key, mod.name);
    }
  }
}

/** Assemble prompt + tools. pagePath is available for later module filtering; all modules load for now. */
export function createAiRegistry(
  ctx: AiToolContext,
  memory: { memorySummary: string; memoryFacts: AiMemoryFact[] },
) {
  const modules = [
    { name: "task", tools: taskTools(ctx) },
    { name: "subtask", tools: subtaskTools(ctx) },
    { name: "workflow", tools: workflowTools(ctx) },
    { name: "memory", tools: memoryTools(ctx) },
  ];
  assertUniqueToolKeys(modules);

  const tools = Object.assign({}, ...modules.map((mod) => mod.tools)) as ReturnType<typeof taskTools> &
    ReturnType<typeof subtaskTools> &
    ReturnType<typeof workflowTools> &
    ReturnType<typeof memoryTools>;

  const system = buildSystemPrompt({
    fullName: ctx.user.full_name,
    roleId: ctx.user.role_id,
    roleName: ctx.user.role.role_name,
    companyName: ctx.companyName,
    pagePath: ctx.pagePath,
    memorySummary: memory.memorySummary,
    memoryFacts: memory.memoryFacts,
  });

  return { system, tools };
}
