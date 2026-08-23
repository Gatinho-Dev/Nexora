import { Fragment, type ReactNode } from "react";

/**
 * Safe markdown-lite renderer: bold, italic, underline, strikethrough,
 * inline code, code blocks, links and @mentions. No HTML injection -
 * everything is rendered as React elements.
 */
export function MessageContent({ content }: { content: string }) {
  const blocks = splitCodeBlocks(content);
  return (
    <span className="message-content">
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <pre key={i}>
            <code>{block.text}</code>
          </pre>
        ) : (
          <Fragment key={i}>{renderInline(block.text)}</Fragment>
        ),
      )}
    </span>
  );
}

type Block = { type: "text" | "code"; text: string };

function splitCodeBlocks(content: string): Block[] {
  const parts = content.split(/```/);
  const blocks: Block[] = [];
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // Inside code fence - strip optional language tag on first line
      const cleaned = part.replace(/^[a-zA-Z0-9]+\n/, "");
      blocks.push({ type: "code", text: cleaned.replace(/\n$/, "") });
    } else if (part) {
      blocks.push({ type: "text", text: part });
    }
  });
  return blocks;
}

const TOKEN_RE =
  /(\*\*[^*]+\*\*|\*[^*\n]+\*|__[^_]+__|~~[^~]+~~|`[^`\n]+`|https?:\/\/[^\s<]+|@[a-zA-Z0-9_.-]+|@everyone)/g;

const IMAGE_URL_RE = /^https?:\/\/[^\s<]+\.(gif|png|jpe?g|webp|avif)(\?[^\s<]*)?$/i;

function isImageUrl(url: string): boolean {
  return IMAGE_URL_RE.test(url);
}

function renderInline(text: string): ReactNode[] {
  const segments = text.split(TOKEN_RE);
  return segments.map((seg, i) => {
    if (!seg) return null;
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
      return <strong key={i}>{renderInline(seg.slice(2, -2))}</strong>;
    }
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
      return <em key={i}>{seg.slice(1, -1)}</em>;
    }
    if (seg.startsWith("__") && seg.endsWith("__") && seg.length > 4) {
      return <u key={i}>{seg.slice(2, -2)}</u>;
    }
    if (seg.startsWith("~~") && seg.endsWith("~~") && seg.length > 4) {
      return <s key={i}>{seg.slice(2, -2)}</s>;
    }
    if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 2) {
      return (
        <code key={i} className="inline-code">
          {seg.slice(1, -1)}
        </code>
      );
    }
    if (/^https?:\/\//.test(seg)) {
      if (isImageUrl(seg)) {
        return (
          <img
            key={i}
            src={seg}
            alt="Imagem anexada"
            loading="lazy"
            className="mt-1 max-w-md max-h-80 rounded-lg border border-white/10 object-contain"
          />
        );
      }
      return (
        <a key={i} href={seg} target="_blank" rel="noopener noreferrer" className="chat-link">
          {seg}
        </a>
      );
    }
    if (seg === "@everyone") {
      return (
        <span key={i} className="mention">
          @everyone
        </span>
      );
    }
    if (/^@[a-zA-Z0-9_.-]+$/.test(seg)) {
      return (
        <span key={i} className="mention">
          {seg}
        </span>
      );
    }
    return <Fragment key={i}>{seg}</Fragment>;
  });
}
