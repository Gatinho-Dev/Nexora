import { z } from "zod";
import { env } from "../../lib/env";
import {
  ProviderApiError,
  type ExternalIntegrationProvider,
  type NormalizedActivity,
  type ProviderProfile,
  type ProviderTokens,
} from "../types";

/**
 * Cider — o player web em `/cider`.
 *
 * Diferente de todo outro provider do registro, o Cider **não tem OAuth nem
 * credencial**. Ele é um app do próprio usuário rodando no navegador dele: a
 * página de `/cider` monta a atividade e a envia pelo WebSocket, já autenticado
 * pela sessão. Este provider existe só para:
 *
 * - dar rótulo, ícone e capacidades ao `cider` na UI de conexões;
 * - dizer ao `presenceWorker` que existe uma origem de atividade que não é
 *   consultada por polling (o push vem do cliente).
 *
 * Os métodos de OAuth são stubs deliberados: chegar aqui significaria que algo
 * tentou conectar o Cider como se fosse um serviço externo, e a resposta
 * correta é recusar com uma mensagem que explique o caminho certo.
 */
export const ciderProvider: ExternalIntegrationProvider = {
  id: "cider",
  label: "Cider",
  capabilities: {
    // Não há conta para conectar: a identidade vem da sessão do navegador.
    accountConnection: false,
    livePresence: true,
    profileLink: true,
    artwork: true,
    timestamps: true,
  },
  configured: () => env.ciderPlayerEnabled,
  enabled: () => env.ciderPlayerEnabled,

  buildAuthorizeUrl: () => {
    throw new ProviderApiError(
      "cider",
      400,
      "O Cider não usa OAuth. Abra /cider no navegador para publicar o que está tocando."
    );
  },

  exchangeCode: async (): Promise<ProviderTokens> => {
    throw new ProviderApiError(
      "cider",
      400,
      "O Cider não troca código por token: a atividade chega pelo WebSocket da sessão."
    );
  },

  fetchProfile: async (): Promise<ProviderProfile> => {
    throw new ProviderApiError(
      "cider",
      400,
      "O Cider não tem perfil para buscar: a identidade é a da sessão ativa."
    );
  },
};

/**
 * Atividade de entrada aceita do player `/cider`.
 *
 * Validado com zod no `handleEvent` do WebSocket antes de chegar em
 * `persistActivity`. Os limites batem com as colunas da tabela
 * `rich_presence_activities` — um cliente malicioso não consegue gravar
 * string gigante nem URL arbitrária.
 */
/**
 * URL de imagem/álbum.
 *
 * `z.string().url()` sozinho **aceita `javascript:alert(1)`** — foi verificado.
 * A refine exige `https` explicitamente. A segunda camada de proteção é o
 * allowlist de host em `safeImageUrl`, que roda mesmo se o schema passar.
 */
const imageUrl = z
  .string()
  .url()
  .max(600)
  .refine(value => value.startsWith("https://"), {
    message: "apenas https",
  });

export const CiderActivitySchema = z.object({
  /** `null` significa "parei de ouvir" e limpa a atividade. */
  title: z.string().min(1).max(200).nullable(),
  details: z.string().max(240).nullable().optional(),
  state: z.string().max(240).nullable().optional(),
  largeImageUrl: imageUrl.nullable().optional(),
  largeImageText: z.string().max(200).nullable().optional(),
  smallImageUrl: imageUrl.nullable().optional(),
  smallImageText: z.string().max(200).nullable().optional(),
  /** Epoch ms. `startedAt`/`endsAt` desenham a barra de progresso. */
  startedAt: z.number().int().nonnegative().nullable().optional(),
  endsAt: z.number().int().nonnegative().nullable().optional(),
  externalUrl: z
    .string()
    .url()
    .max(500)
    .refine(value => value.startsWith("https://"), { message: "apenas https" })
    .nullable()
    .optional(),
});

export type CiderActivityInput = z.infer<typeof CiderActivitySchema>;

/** A capa só pode vir de hosts de imagem do YouTube. */
export const CIDER_IMAGE_HOSTS = new Set([
  "i.ytimg.com",
  "img.youtube.com",
  "yt3.ggpht.com",
  "lh3.googleusercontent.com",
]);

/**
 * Valida e normaliza a atividade vinda do player.
 *
 * Devolve `null` quando a atividade precisa ser **descartada** (inválida), e
 * `{ clear: true }` quando é válida mas significa "não estou ouvindo nada".
 * A distinção importa: a primeira apaga o que já estava gravado, a segunda
 * também — mas só depois de passar pelas regras de URL, para que um cliente
 * malicioso não consiga limpar a presença dos outros só mandando lixo.
 */
export function normalizeCiderActivity(input: CiderActivityInput): {
  clear: boolean;
  activity: NormalizedActivity | null;
} {
  if (input.title === null) return { clear: true, activity: null };
  const title = input.title;

  const now = Date.now();
  const window = validWindow(input.startedAt, input.endsAt, now);

  return {
    clear: false,
    activity: {
      provider: "cider",
      type: "music",
      title,
      details: input.details ?? null,
      state: input.state ?? null,
      largeImageUrl: safeImageUrl(input.largeImageUrl),
      largeImageText: input.largeImageText ?? null,
      smallImageUrl: safeImageUrl(input.smallImageUrl),
      smallImageText: input.smallImageText ?? null,
      startedAt: new Date(window.startedAt),
      endsAt: window.endsAt === null ? null : new Date(window.endsAt),
      externalUrl: input.externalUrl ?? null,
      isLive: false,
      ttlMs: env.ciderActivityIntervalMs * 3,
    },
  };
}

/** Duração máxima plausível de uma faixa: 30 h, folga larga. */
const MAX_TRACK_MS = 30 * 60 * 60 * 1000;
/** Tolerância de relógio entre o navegador e o servidor. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Valida a janela `startedAt`/`endsAt`, que é o que desenha a barra de progresso.
 *
 * Regras, todas necessárias: sem elas um cliente pode mandar `endsAt` no ano
 * 3000 (barra eterna) ou `startedAt` no futuro (barra negativa, e `now -
 * startedAt` negativo passaria num `< 86_400_000` ingênuo).
 *
 * Quando a janela não serve, a atividade **continua valendo** — só perde a
 * barra: é melhor mostrar a faixa sem progresso do que mostrar nada.
 */
function validWindow(
  rawStarted: number | null | undefined,
  rawEnds: number | null | undefined,
  now: number
): { startedAt: number; endsAt: number | null } {
  const started = toEpochMs(rawStarted);
  const ends = toEpochMs(rawEnds);

  if (started === null || ends === null) {
    return { startedAt: started ?? now, endsAt: null };
  }
  // Não começou no futuro (tolerando desvio de relógio) e começou hoje.
  if (started > now + CLOCK_SKEW_MS) return { startedAt: now, endsAt: null };
  if (now - started > 86_400_000) return { startedAt: now, endsAt: null };
  // A barra precisa avançar para a frente e durar no máximo uma faixa.
  if (ends <= started) return { startedAt: started, endsAt: null };
  if (ends - started > MAX_TRACK_MS) return { startedAt: started, endsAt: null };
  return { startedAt: started, endsAt: ends };
}

/**
 * Converte epoch para milissegundos, aceitando segundos e milissegundos.
 *
 * O corte em 1e11 separa os dois: 1e11 ms é 1973, 1e11 s é o ano 5138. Uma
 * data razoável cai de um lado ou do outro sem ambiguidade.
 */
function toEpochMs(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value < 1e11 ? value * 1000 : value;
}

/** Só aceita capa de host de imagem conhecido; qualquer outra vira `null`. */
function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!CIDER_IMAGE_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
