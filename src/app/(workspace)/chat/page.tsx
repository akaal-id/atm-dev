import { MessageSquare } from "lucide-react";

import { ChatLayout } from "@/components/app/chat/chat-layout";
import { requireUser } from "@/lib/server/auth";
import { listDirectory, listRoomsForUser } from "@/lib/server/chat-actions";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await requireUser();
  const [rooms, directory] = await Promise.all([listRoomsForUser(), listDirectory()]);

  return (
    <ChatLayout rooms={rooms} directory={directory}>
      <div className="grid h-full place-items-center bg-slate-50 text-center">
        <div className="max-w-xs">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-blue-600">
            <MessageSquare className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Your messages</p>
          <p className="mt-1 text-sm text-slate-500">Select a conversation or start a new one to begin chatting.</p>
        </div>
      </div>
    </ChatLayout>
  );
}
