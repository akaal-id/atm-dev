import { AiChatView } from "@/components/app/ai-assistant/ai-chat-view";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Intercepted route: rendered into the @modal slot as an overlay when chat is
// opened via client-side nav from any (workspace) page. `(.)` matches at the
// same route-segment level as (workspace) itself — @modal is a slot, not a
// segment, so it doesn't count toward the depth.
export default async function AiChatModalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireUser();
  const { from } = await searchParams;

  return <AiChatView variant="overlay" pagePath={from} />;
}
