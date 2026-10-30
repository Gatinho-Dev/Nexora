import { describe, expect, it } from "vitest";
import { parseNaturalSearch } from "./messageFeaturesRouter";

describe("parseNaturalSearch", () => {
  it("extracts explicit advanced filters", () => {
    const parsed = parseNaturalSearch(
      'planejamento from:"Daniel" in:geral server:42 after:2026-08-01 before:2026-09-01 has:image mentions:maria'
    );
    expect(parsed).toMatchObject({
      text: "planejamento",
      from: "Daniel",
      in: "geral",
      server: "42",
      has: "image",
      mentions: "maria",
    });
    expect(parsed.after?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(parsed.before?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("understands natural Portuguese author, attachment and month phrases", () => {
    const parsed = parseNaturalSearch("mensagens do Daniel com imagens de agosto");
    expect(parsed.from).toBe("Daniel");
    expect(parsed.has).toBe("image");
    expect(parsed.after?.getUTCMonth()).toBe(7);
    expect(parsed.before?.getUTCMonth()).toBe(8);
    expect(parsed.text).toBe("");
  });

  it("keeps unknown has values as searchable text-free filters", () => {
    const parsed = parseNaturalSearch("relatório has:document");
    expect(parsed.has).toBeUndefined();
    expect(parsed.text).toBe("relatório");
  });
});
