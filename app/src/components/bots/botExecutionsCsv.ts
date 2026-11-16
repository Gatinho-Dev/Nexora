import type { BotExecution } from "@/contracts/bots";

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Gera o conteúdo CSV do histórico de execuções (cabeçalho + 1 linha por execução). */
export function executionsToCsv(executions: BotExecution[]): string {
  const header = ["id", "status", "trigger", "duration_ms", "started_at", "error"];
  const lines = executions.map((execution) =>
    [
      execution.id,
      execution.status,
      execution.trigger.type,
      String(execution.duration),
      execution.startedAt,
      execution.error?.message ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

/** Baixa o CSV gerado por executionsToCsv. */
export function downloadExecutionsCsv(executions: BotExecution[], botId: string): void {
  const blob = new Blob([executionsToCsv(executions)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bot-${botId}-executions.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
