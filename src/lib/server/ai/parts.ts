import type { UIMessage } from "ai";

export function textFromParts(parts: UIMessage["parts"] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function isFilePart(
  part: UIMessage["parts"][number],
): part is Extract<UIMessage["parts"][number], { type: "file" }> {
  return part.type === "file";
}

export function hasAudioPart(parts: UIMessage["parts"] | undefined) {
  return (parts ?? []).some((part) => isFilePart(part) && part.mediaType.startsWith("audio"));
}

export function persistableParts(parts: UIMessage["parts"] | undefined): unknown[] {
  return (parts ?? []).map((part) => {
    if (!isFilePart(part)) return part;
    if (part.url.startsWith("data:")) {
      return {
        type: "file",
        mediaType: part.mediaType,
        filename: part.filename,
        url: "",
      };
    }
    return part;
  });
}

function fileUrlUsable(url: string) {
  return url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://");
}

/** Keep audio bytes only on the latest user turn so history does not explode. */
export function messagesForModel(messages: UIMessage[]): UIMessage[] {
  let lastUserIndex = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i]?.role === "user") lastUserIndex = i;
  }
  return messages.map((message, index) => ({
    ...message,
    parts: (message.parts ?? []).flatMap((part): UIMessage["parts"] => {
      if (!isFilePart(part)) return [part];
      if (!fileUrlUsable(part.url)) return [];
      if (index !== lastUserIndex && part.url.startsWith("data:")) return [];
      return [part];
    }),
  }));
}
