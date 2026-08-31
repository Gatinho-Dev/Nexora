import { describe, expect, it } from "vitest";
import {
  formatMarkdownCodeBlock,
  formatMarkdownLink,
  formatMarkdownQuote,
  toggleMarkdownWrapper,
} from "./composerFormatting";

describe("composer formatting", () => {
  it("formats only the selected text", () => {
    const text = "Nexora é muito legal";
    const result = toggleMarkdownWrapper(text, { start: 9, end: 20 }, "**");
    expect(result?.text).toBe("Nexora é **muito legal**");
    expect(result && result.text.slice(result.start, result.end)).toBe("muito legal");
  });

  it("removes an existing wrapper while preserving the inner selection", () => {
    const text = "Nexora é **muito legal**";
    const result = toggleMarkdownWrapper(text, { start: 11, end: 22 }, "**");
    expect(result?.text).toBe("Nexora é muito legal");
    expect(result && result.text.slice(result.start, result.end)).toBe("muito legal");
  });

  it("formats multiline selections as code blocks and quotes", () => {
    expect(
      formatMarkdownCodeBlock("antes\na\nb\ndepois", { start: 6, end: 9 })?.text,
    ).toBe("antes\n```\na\nb\n```\ndepois");
    expect(formatMarkdownQuote("a\nb", { start: 0, end: 3 })?.text).toBe("> a\n> b");
  });

  it("creates a link and selects only the URL", () => {
    const result = formatMarkdownLink("visite Nexora hoje", { start: 7, end: 13 });
    expect(result?.text).toBe("visite [Nexora](https://) hoje");
    expect(result && result.text.slice(result.start, result.end)).toBe("https://");
  });

  it("does nothing without a selection", () => {
    expect(toggleMarkdownWrapper("Nexora", { start: 3, end: 3 }, "**")).toBeNull();
  });
});
