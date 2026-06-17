// Live Chat domain types.
// Note: primary/foreign keys are TEXT to match users.user_id and tasks.task_id.

export type RoomType = "private" | "group";
export type MemberRole = "admin" | "member";
export type MessageType = "text" | "file" | "task" | "system";

export interface ChatRoom {
  room_id: string;
  name: string;
  type: RoomType;
  avatar_url: string;
  created_by: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomMember {
  member_id: string;
  room_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  created_at: string;
}

/** Open Graph metadata scraped from the first URL found in a message. */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface ChatMessage {
  message_id: string;
  room_id: string;
  sender_id: string;
  type: MessageType;
  content: string; // TipTap HTML
  file_url: string | null;
  file_name: string | null;
  file_mime: string | null;
  task_id: string | null;
  link_preview: LinkPreview | null;
  reply_to: string | null;
  created_at: string;
}

/** Lightweight author info denormalized for rendering bubbles. */
export interface ChatAuthor {
  user_id: string;
  full_name: string;
  profile_photo: string;
}

/** A message joined with its author + (optional) task card data. */
export interface ChatMessageView extends ChatMessage {
  author: ChatAuthor | null;
  task?: ChatTaskCard | null;
  /** Set on optimistic (not-yet-confirmed) messages. */
  pending?: boolean;
}

/** Minimal task shape rendered inside a task-call chat bubble. */
export interface ChatTaskCard {
  task_id: string;
  title: string;
  description: string;
  status: string;
  project_id: string;
}

/** A room in the sidebar list, with derived display fields. */
export interface ChatRoomSummary extends ChatRoom {
  members: ChatAuthor[];
  /** Resolved display title (group name, or the other user for private chats). */
  displayName: string;
  displayAvatar: string;
  lastMessagePreview: string;
  memberCount: number;
}

// ---- Server action payloads -------------------------------------------------

export interface SendMessageInput {
  message_id: string; // generated client-side so optimistic + realtime rows dedupe
  room_id: string;
  type?: MessageType;
  content: string;
  file_url?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  task_id?: string | null;
  reply_to?: string | null;
}

export interface CreateRoomInput {
  name?: string;
  type: RoomType;
  member_ids: string[]; // excluding the creator, who is added automatically as admin
}

export interface ResumableUploadResult {
  uploadUrl: string;
  fileId: null; // resumable sessions yield the id only after the PUT completes
}
