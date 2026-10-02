import styles from "./chat.module.css";
import { MessageSquare } from "lucide-react";

import { ChatLayout } from "@/components/app/chat/chat-layout";
import { requireUser } from "@/lib/server/auth";
import { ensureSelfRoom, listDirectory, listRoomsForUser } from "@/lib/server/chat-actions";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await requireUser();
  // Personal notes room is created on first visit so it always shows in the list.
  await ensureSelfRoom().catch(() => null);
  const [rooms, directory] = await Promise.all([listRoomsForUser(), listDirectory()]);

  return (
    <div className={styles.page}>
      <ChatLayout rooms={rooms} directory={directory}>
      <div className={styles.empty}>
        <div>
          <div className={styles.emptyIcon}>
            <MessageSquare aria-hidden />
          </div>
          <p className={styles.emptyTitle}>Your messages</p>
          <p className={styles.emptyText}>Pick a conversation on the left, or start a new one with the + button.</p>
        </div>
      </div>
    </ChatLayout>
    </div>
  );
}
