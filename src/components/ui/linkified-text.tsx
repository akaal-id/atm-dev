const urlPattern = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const trailingPunctuationPattern = /[),.!?:;]+$/;

function safeHref(value: string) {
  const href = value.startsWith("www.") ? `https://${value}` : value;

  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function renderPlainText(value: string, keyPrefix: string) {
  return value.split("\n").flatMap((line, index, lines) => {
    const key = `${keyPrefix}-line-${index}`;
    return index === lines.length - 1 ? [line] : [line, <br key={key} />];
  });
}

function renderLinkedText(value: string) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(...renderPlainText(value.slice(lastIndex, index), `text-${index}`));
    }

    const trailing = rawUrl.match(trailingPunctuationPattern)?.[0] ?? "";
    const cleanUrl = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
    const href = safeHref(cleanUrl);

    if (href) {
      nodes.push(
        <a key={`link-${index}`} href={href} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline-offset-2 hover:underline">
          {cleanUrl}
        </a>,
      );
    } else {
      nodes.push(cleanUrl);
    }

    if (trailing) nodes.push(trailing);
    lastIndex = index + rawUrl.length;
  }

  if (lastIndex < value.length) {
    nodes.push(...renderPlainText(value.slice(lastIndex), `text-${lastIndex}`));
  }

  return nodes;
}

export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  return <p className={className}>{renderLinkedText(text)}</p>;
}
