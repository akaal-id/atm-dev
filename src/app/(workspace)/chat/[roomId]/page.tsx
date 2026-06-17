import { notFound } from "next/navigation";

import { ChatLayout } from "@/components/app/chat/chat-layout";
import { ChatWindow } from "@/components/app/chat/chat-window";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/server/auth";
import { getRoom, listDirectory, listMembers, listMessages, listRoomsForUser } from "@/lib/server/chat-actions";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const me = await requireUser();

  // getRoom throws for non-members (membership is enforced server-side).
  const room = await getRoom(roomId).catch(() => null);
  if (!room) notFound();

  const [rooms, members, messages, directory] = await Promise.all([
    listRoomsForUser(),
    listMembers(roomId),
    listMessages(roomId),
    listDirectory(),
  ]);

  const myMembership = members.find((m) => m.user_id === me.user_id);
  const canManage = Boolean(myMembership) || hasPermission(me.role_id, "admin:view");
  const canRemoveOthers = hasPermission(me.role_id, "admin:view") || myMembership?.role === "admin";

  const other = room.type === "private" ? members.find((m) => m.user_id !== me.user_id) : undefined;
  const title =
    room.type === "private" ? other?.author?.full_name || room.name || "Direct message" : room.name || "Group";

  return (
    <ChatLayout rooms={rooms} directory={directory} activeRoomId={roomId}>
      <ChatWindow
        currentUser={{
          user_id: me.user_id,
          full_name: me.full_name,
          profile_photo: me.profile_photo,
          role_id: me.role_id,
        }}
        room={room}
        title={title}
        members={members}
        initialMessages={messages}
        directory={directory}
        canManage={canManage}
        canRemoveOthers={canRemoveOthers}
      />
    </ChatLayout>
  );
}
