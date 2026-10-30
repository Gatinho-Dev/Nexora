import { Fragment, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Discord-style markdown renderer, implemented as a safe tokenizer:
 * bold, italic (+ underscore form), bold+italic, underline, strikethrough,
 * inline code, fenced code blocks with lightweight syntax highlighting,
 * ||spoiler|| text, > quotes, # headers, links/images, mentions and basic
 * link embeds (YouTube / Spotify). Everything is rendered as React
 * elements — no HTML injection.
 */
export function MessageContent({ content }: { content: string }) {
  const blocks = splitCodeBlocks(content);
  return (
    <span className="message-content">
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <CodeBlock key={i} text={block.text} lang={block.lang} />
        ) : (
          <Fragment key={i}>{renderBlocks(block.text)}</Fragment>
        ),
      )}
    </span>
  );
}

// ── Block level ───────────────────────────────────────────────

type CodeBlockData = { type: "code"; text: string; lang: string };
type TextBlock = { type: "text"; text: string };

function splitCodeBlocks(content: string): (CodeBlockData | TextBlock)[] {
  const parts = content.split(/```/);
  const blocks: (CodeBlockData | TextBlock)[] = [];
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // Fenced block — first line may carry the language tag
      const match = part.match(/^([a-zA-Z0-9+#_-]*)\n/);
      const lang = match ? match[1].toLowerCase() : "";
      const text = match ? part.slice(match[0].length) : part;
      blocks.push({ type: "code", text: text.replace(/\n$/, ""), lang });
    } else if (part) {
      blocks.push({ type: "text", text: part });
    }
  });
  return blocks;
}

/** Splits a plain-text region into paragraphs, quotes and headers. */
function renderBlocks(text: string): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let para: string[] = [];
  let quote: string[] = [];

  const flushPara = (key: string) => {
    if (para.length === 0) return;
    const joined = para.join("\n");
    out.push(
      <span key={key} className="block whitespace-pre-wrap">
        {renderInline(joined)}
        {renderEmbeds(joined)}
      </span>,
    );
    para = [];
  };
  const flushQuote = (key: string) => {
    if (quote.length === 0) return;
    out.push(
      <blockquote key={key} className="message-quote">
        {quote.map((q, i) => (
          <span key={i} className="block">
            {renderInline(q)}
          </span>
        ))}
      </blockquote>,
    );
    quote = [];
  };
  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const Tag = listOrdered ? "ol" : "ul";
    out.push(
      <Tag
        key={key}
        className={cn(
          "my-1 pl-6",
          listOrdered ? "list-decimal" : "list-disc",
        )}
      >
        {listItems.map((item, i) => (
          <li key={i} className="leading-6">
            {renderInline(item)}
          </li>
        ))}
      </Tag>,
    );
    listItems = [];
  };

  let listItems: string[] = [];
  let listOrdered = false;

  lines.forEach((line, i) => {
    // Listas: "- item", "* item" e "1. item"
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flushPara(`p${i}`);
      flushQuote(`q${i}`);
      const wantOrdered = !!ordered;
      if (listItems.length > 0 && wantOrdered !== listOrdered) {
        flushList(`l${i}`);
      }
      listOrdered = wantOrdered;
      listItems.push((bullet?.[1] ?? ordered?.[1]) as string);
      return;
    }
    if (listItems.length > 0) {
      flushList(`l${i}`);
    }
    const header = line.match(/^(#{1,3})\s+(.+)$/);
    if (header && !line.startsWith("#!")) {
      flushPara(`p${i}`);
      flushQuote(`q${i}`);
      const level = header[1].length;
      out.push(
        <span
          key={`h${i}`}
          className={
            level === 1
              ? "message-header message-h1"
              : level === 2
                ? "message-header message-h2"
                : "message-header message-h3"
          }
        >
          {renderInline(header[2])}
        </span>,
      );
      return;
    }
    if (/^>\s?/.test(line)) {
      flushPara(`p${i}`);
      quote.push(line.replace(/^>\s?/, ""));
      return;
    }
    if (quote.length > 0) {
      // Discord ends a quote on an empty line only
      if (line.trim() === "") {
        flushQuote(`q${i}`);
      } else {
        quote.push(line.replace(/^>\s?/, ""));
      }
      return;
    }
    para.push(line);
  });
  flushPara("pend-p");
  flushQuote("pend-q");
  flushList("pend-l");
  return out;
}

// ── Link embeds (YouTube / Spotify) ───────────────────────────

const YOUTUBE_RE =
  /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,20})[^\s]*/g;
const SPOTIFY_RE =
  /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode)\/([A-Za-z0-9]+)[^\s]*/g;

/**
 * FACADE: thumbnail + botão play; o iframe oficial só monta ao clicar.
 * Evita dezenas de players pesados em canais longos (performance e
 * privacidade — nada de scripts de terceiros sem interação).
 */
function renderEmbeds(text: string): ReactNode[] {
  const embeds: ReactNode[] = [];
  const yt = [...text.matchAll(YOUTUBE_RE)];
  const sp = [...text.matchAll(SPOTIFY_RE)];
  for (const m of yt.slice(0, 2)) {
    embeds.push(
      <EmbedFacade
        key={`yt-${m[1]}`}
        thumbnail={`https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`}
        playerUrl={`https://www.youtube-nocookie.com/embed/${m[1]}`}
        label="YouTube"
        aspect="aspect-video"
      />,
    );
  }
  for (const m of sp.slice(0, 2)) {
    embeds.push(
      <EmbedFacade
        key={`sp-${m[2]}`}
        playerUrl={`https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=nexora`}
        label="Spotify"
        aspect="aspect-[21/9]"
        compact
      />,
    );
  }
  return embeds;
}

function EmbedFacade({
  thumbnail,
  playerUrl,
  label,
  aspect,
  compact = false,
}: {
  thumbnail?: string;
  playerUrl: string;
  label: string;
  aspect: string;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <span className="message-embed mt-1 block max-w-[544px] overflow-hidden rounded-xl border border-white/10 bg-[#232529] select-none">
      {playing ? (
        <span className={cn("relative block w-full", aspect)}>
          <iframe
            src={playerUrl}
            title={`Player de ${label}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            className="absolute inset-0 h-full w-full border-0"
          />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className={cn(
            "group relative block w-full text-left",
            !compact && aspect,
            compact ? "h-20" : "",
          )}
          aria-label={`Reproduzir de ${label}`}
        >
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="ml-0.5 h-6 w-6" />
            </span>
          </span>
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {label}
          </span>
        </button>
      )}
    </span>
  );
}

// ── Inline level ──────────────────────────────────────────────

const TOKEN_RE =
  /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*|__[^_\n]+__|_[^_\n]+_|~~[^~\n]+~~|\|\|[^|\n]+\|\||`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<]+|@[a-zA-Z0-9_.-]+|@everyone|@here)/g;

/** Bloqueia esquemas perigosos (javascript:, data:, vbscript:). */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function renderInline(text: string): ReactNode[] {
  const segments = text.split(TOKEN_RE);
  return segments.map((seg, i) => {
    if (!seg) return null;
    // Bold + italic
    if (seg.startsWith("***") && seg.endsWith("***") && seg.length > 6) {
      return (
        <strong key={i}>
          <em>{renderInline(seg.slice(3, -3))}</em>
        </strong>
      );
    }
    // Bold
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
      return <strong key={i}>{renderInline(seg.slice(2, -2))}</strong>;
    }
    // Italic (* or _)
    if (
      (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) ||
      (seg.startsWith("_") && seg.endsWith("_") && seg.length > 2)
    ) {
      return <em key={i}>{renderInline(seg.slice(1, -1))}</em>;
    }
    // Underline
    if (seg.startsWith("__") && seg.endsWith("__") && seg.length > 4) {
      return <u key={i}>{renderInline(seg.slice(2, -2))}</u>;
    }
    // Strikethrough
    if (seg.startsWith("~~") && seg.endsWith("~~") && seg.length > 4) {
      return <s key={i}>{renderInline(seg.slice(2, -2))}</s>;
    }
    // Spoiler text
    if (seg.startsWith("||") && seg.endsWith("||") && seg.length > 4) {
      return <SpoilerText key={i}>{renderInline(seg.slice(2, -2))}</SpoilerText>;
    }
    // Inline code
    if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 2) {
      return (
        <code key={i} className="inline-code">
          {seg.slice(1, -1)}
        </code>
      );
    }
    // Links & images
    // Markdown link: [texto](https://…)
    const mdLink = seg.match(/^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (mdLink) {
      if (!isSafeUrl(mdLink[2])) return <span key={i}>{mdLink[1]}</span>;
      return (
        <a
          key={i}
          href={mdLink[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-link"
        >
          {mdLink[1]}
        </a>
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
        <a
          key={i}
          href={seg}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-link"
        >
          {seg}
        </a>
      );
    }
    // Mentions
    if (seg === "@everyone" || seg === "@here") {
      return (
        <span key={i} className="mention">
          {seg}
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

function isImageUrl(url: string): boolean {
  return /^https?:\/\/[^\s<]+\.(gif|png|jpe?g|webp|avif)(\?[^\s<]*)?$/i.test(url);
}

function SpoilerText({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className={
        revealed
          ? "message-spoiler message-spoiler-revealed"
          : "message-spoiler"
      }
      title={revealed ? undefined : "Contém spoiler — clique para revelar"}
      aria-label={revealed ? undefined : "Texto com spoiler, clique para revelar"}
    >
      {children}
    </button>
  );
}

// ── Syntax highlighting (lightweight, dependency-free) ────────

const KEYWORDS: Record<string, string[]> = {
  js: "const let var function return if else for while class extends new this typeof instanceof async await import export from default try catch finally throw switch case break continue null undefined true false delete void yield static get set".split(" "),
  ts: "const let var function return if else for while class extends implements interface type enum new this typeof instanceof async await import export from default try catch finally throw switch case break continue null undefined true false readonly public private protected as satisfies keyof never unknown any void number string boolean".split(" "),
  py: "def class return if elif else for while import from as pass break continue lambda None True False and or not in is try except finally raise with yield global nonlocal assert del async await print self".split(" "),

};

function keywordsFor(lang: string): Set<string> {
  if (["py", "python"].includes(lang)) return new Set(KEYWORDS.py);
  if (["ts", "typescript", "tsx"].includes(lang)) return new Set(KEYWORDS.ts);
  if (
    ["js", "javascript", "jsx", "json", "mjs", "cjs", "java", "c", "cpp", "cs", "go", "rust", "rs"].includes(lang)
  )
    return new Set(KEYWORDS.js);
  return new Set();
}

type Tok = { t: string; c: string };

function tokenize(code: string, lang: string): Tok[] {
  if (lang === "diff") {
    return code.split("\n").map(line => ({
      t: line,
      c: line.startsWith("+")
        ? "tok-add"
        : line.startsWith("-")
          ? "tok-del"
          : line.startsWith("@@")
            ? "tok-kw"
            : "",
    }));
  }

  const kw = keywordsFor(lang);
  const toks: Tok[] = [];
  // Order matters: comments, strings, numbers, words.
  // `#` only counts as a comment when not followed by a hex color.
  const scanner =
    /(\/\/[^\n]*|#(?![0-9a-fA-F]{3,8}\b)[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([\s\S])/g;
  let m: RegExpExecArray | null;
  while ((m = scanner.exec(code))) {
    if (m[1]) toks.push({ t: m[1], c: "tok-com" });
    else if (m[2]) toks.push({ t: m[2], c: "tok-str" });
    else if (m[3]) toks.push({ t: m[3], c: "tok-num" });
    else if (m[4])
      toks.push({
        t: m[4],
        c: kw.has(m[4]) ? "tok-kw" : /^[A-Z]/.test(m[4]) ? "tok-type" : "",
      });
    else if (m[5]) toks.push({ t: m[5], c: "" });
    else toks.push({ t: m[6], c: "" });
  }
  return toks;
}

const HIGHLIGHT_LANGS = new Set([
  "js", "javascript", "jsx", "ts", "typescript", "tsx", "json", "py", "python",
  "css", "scss", "less", "html", "xml", "bash", "sh", "shell", "zsh",
  "java", "c", "cpp", "cs", "go", "rust", "rs", "sql", "yaml", "yml", "toml", "diff",
]);

function CodeBlock({ text, lang }: { text: string; lang: string }) {
  const label = lang ? `< ${lang.toUpperCase()} >` : "";

  const body: ReactNode = HIGHLIGHT_LANGS.has(lang)
    ? tokenize(text, lang).map((tok, i) =>
        tok.c ? (
          <span key={i} className={tok.c}>
            {tok.t}
          </span>
        ) : (
          <Fragment key={i}>{tok.t}</Fragment>
        ),
      )
    : text;

  return (
    <pre>
      {label && <span className="code-lang">{label}</span>}
      <code>{body}</code>
    </pre>
  );
}
