export type AiMessageRole = "user" | "assistant" | "system";

export type AiMemoryFact = {
  key: string;
  value: string;
  updated_at: string;
};

export type AiConversation = {
  conversation_id: string;
  user_id: string;
  company_id: string;
  title: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  message_id: string;
  conversation_id: string;
  role: AiMessageRole;
  parts: unknown[];
  created_at: string;
};

export type AiUserMemory = {
  user_id: string;
  summary: string;
  facts: AiMemoryFact[];
  updated_at: string;
};

export type AiConversationSummary = Pick<
  AiConversation,
  "conversation_id" | "title" | "last_message_at" | "created_at" | "updated_at" | "company_id"
>;
