import { describe, expect, it } from "vitest";
import type { BotExecution } from "@/contracts/bots";
import { executionsToCsv } from "./botExecutionsCsv";

function makeExecution(overrides: Partial<BotExecution> = {}): BotExecution {
  return {
    id: "42",
    botId: "7",
    serverId: "1",
    status: "success",
    trigger: { type: "message_create", data: {} },
    context: { variables: {} },
    result: { nodesExecuted: 2, actionsPerformed: [] },
    error: null,
    startedAt: "2026-11-16T12:00:00.000Z",
    completedAt: "2026-11-16T12:00:01.500Z",
    duration: 1500,
    ...overrides,
  };
}

describe("executionsToCsv", () => {
  it("gera cabeçalho + linhas", () => {
    const csv = executionsToCsv([makeExecution()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("id,status,trigger,duration_ms,started_at,error");
    expect(lines[1]).toContain("42,success,message_create,1500,");
  });

  it("escapa vírgula, aspas e quebra de linha", () => {
    const csv = executionsToCsv([
      makeExecution({
        id: "9",
        status: "failed",
        error: { nodeId: "n1", message: 'Falhou, "feio"\nde verdade' },
      }),
    ]);
    expect(csv).toContain('"Falhou, ""feio""\nde verdade"');
  });

  it("lista vazia gera só o cabeçalho", () => {
    expect(executionsToCsv([])).toBe(
      "id,status,trigger,duration_ms,started_at,error"
    );
  });
});
