export type TextSelection = { start: number; end: number };

export type FormattingResult = TextSelection & { text: string };

export function toggleMarkdownWrapper(
  text: string,
  selection: TextSelection,
  before: string,
  after = before,
): FormattingResult | null {
  const { start, end } = selection;
  const selected = text.slice(start, end);
  if (!selected) return null;

  const wrappedOutside =
    text.slice(Math.max(0, start - before.length), start) === before &&
    text.slice(end, end + after.length) === after;
  const selectedIncludesWrapper =
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length > before.length + after.length;

  if (wrappedOutside) {
    const nextStart = start - before.length;
    return {
      text:
        text.slice(0, nextStart) + selected + text.slice(end + after.length),
      start: nextStart,
      end: nextStart + selected.length,
    };
  }

  if (selectedIncludesWrapper) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length,
    };
  }

  return {
    text: text.slice(0, start) + before + selected + after + text.slice(end),
    start: start + before.length,
    end: start + before.length + selected.length,
  };
}

export function formatMarkdownCodeBlock(
  text: string,
  selection: TextSelection,
): FormattingResult | null {
  const selected = text.slice(selection.start, selection.end);
  if (!selected) return null;
  const block = `\`\`\`\n${selected}\n\`\`\``;
  return {
    text: text.slice(0, selection.start) + block + text.slice(selection.end),
    start: selection.start + 4,
    end: selection.start + 4 + selected.length,
  };
}

export function formatMarkdownQuote(
  text: string,
  selection: TextSelection,
): FormattingResult | null {
  const selected = text.slice(selection.start, selection.end);
  if (!selected) return null;
  const quoted = selected.replace(/^/gm, "> ");
  return {
    text: text.slice(0, selection.start) + quoted + text.slice(selection.end),
    start: selection.start,
    end: selection.start + quoted.length,
  };
}

export function formatMarkdownLink(
  text: string,
  selection: TextSelection,
): FormattingResult | null {
  const selected = text.slice(selection.start, selection.end);
  if (!selected) return null;
  const formatted = `[${selected}](https://)`;
  const urlStart = selection.start + selected.length + 3;
  return {
    text: text.slice(0, selection.start) + formatted + text.slice(selection.end),
    start: urlStart,
    end: urlStart + "https://".length,
  };
}
