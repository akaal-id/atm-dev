import styles from "./ai-chat.module.css";

import { AiChatView } from "@/components/app/ai-assistant/ai-chat-view";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Full-page fallback: hard refresh while the modal is open, direct link, or
// sharing the URL. Same AiChatView as the intercepted overlay — one
// implementation, `variant="page"` just drops the fixed-viewport CSS.
export default async function AiChatPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireUser();
  const { from } = await searchParams;

  return (
    <div className={styles.page}>
      <AiChatView variant="page" pagePath={from} />
    </div>
  );
}
