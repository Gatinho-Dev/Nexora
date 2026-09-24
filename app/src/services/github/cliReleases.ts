import {
  cliReleasesResponseSchema,
  type CliReleasesResponse,
} from "@contracts/cliReleases";
import { apiUrl } from "@/lib/endpoints";

export class CliReleasesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliReleasesError";
  }
}

export async function fetchCliReleases(
  signal?: AbortSignal
): Promise<CliReleasesResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/cli/releases"), {
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal,
    });
  } catch {
    throw new CliReleasesError(
      "Não foi possível carregar as versões mais recentes."
    );
  }

  if (!response.ok) {
    throw new CliReleasesError(
      "Não foi possível carregar as versões mais recentes."
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CliReleasesError("A resposta de versões não pôde ser lida.");
  }

  const parsed = cliReleasesResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new CliReleasesError(
      "A resposta de versões tem um formato inesperado."
    );
  }
  return parsed.data;
}
