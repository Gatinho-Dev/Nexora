/**
 * Estado da interface do Cider: painéis laterais, modo imersivo, paleta de
 * comandos e avisos.
 *
 * Espelha `state/ui.ts` do desktop — mesma união de painéis, mesmos avisos —
 * com uma diferença de arquitetura: **a navegação não mora aqui**. No desktop o
 * aplicativo é uma janela única e a rota é estado interno; aqui é um site, e
 * endereço, botão voltar e link compartilhável são do `react-router`. Manter
 * uma cópia da rota aqui só criaria duas verdades para a mesma coisa.
 */

import { create } from "zustand";

export type PanelKind = "queue" | "lyrics";
export type ImmersiveLayout = "cover" | "lyrics";
export type ToastKind = "info" | "success" | "warning" | "error";

/**
 * Pergunta que a interface faz **antes** de fazer algo destrutivo.
 *
 * Hoje só existe uma: trocar a fila quando isso jogaria fora faixas colocadas à
 * mão ("Reproduzir isto limpará a sua fila", na referência do iOS 18). Ela mora
 * aqui, e não dentro da tela que disparou a ação, porque quem pergunta é a
 * interface inteira — a mesma caixa serve para a busca, a estação e a biblioteca.
 */
export interface QueuePrompt {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  actionLabel?: string;
  action?: () => void;
  timeoutMs: number;
}

interface CiderUiStore {
  panel: PanelKind | null;
  immersive: boolean;
  immersiveLayout: ImmersiveLayout | null;
  /**
   * Tela cheia de letras: a que abre ao clicar na capa do que está tocando.
   *
   * É separada do modo imersivo porque responde a outra pergunta. O imersivo é
   * "quero ver a capa grande"; esta tela é "quero a letra, com o controle do
   * lado", e é onde a letra é lida de verdade.
   */
  lyricsScreen: boolean;
  palette: boolean;
  /** Gaveta da barra lateral em telas estreitas. */
  sidebarOpen: boolean;
  /** Host da última instância que respondeu (selo da topbar). */
  searchSource: string | null;
  /** Instâncias que falharam antes de alguma responder. */
  searchAttempts: Array<{ instance: string; error: string }>;
  lastSearchError: string | null;
  toasts: Toast[];
  /** Pergunta pendente de confirmação (ver `QueuePrompt`). */
  queuePrompt: QueuePrompt | null;
  /**
   * Gaveta "Adicionar músicas à fila".
   *
   * Fica na store, e não no painel, porque o painel lateral **fecha** quando se
   * navega enquanto a gaveta continua útil — e porque o botão que a abre vive em
   * mais de um lugar (o fim da fila e a pílula).
   */
  queueAddOpen: boolean;
  onboarding: boolean;
  /**
   * O `<iframe>` do YouTube pode não reproduzir em navegadores sem DRM ou com
   * bloqueio de terceiros. Esta trava faz o aviso aparecer **uma vez por
   * sessão**, em vez de repetir a cada faixa.
   */
  limitationSeen: boolean;

  setPanel: (panel: PanelKind | null) => void;
  togglePanel: (panel: PanelKind) => void;
  setImmersive: (value: boolean) => void;
  toggleImmersive: () => void;
  setImmersiveLayout: (layout: ImmersiveLayout | null) => void;
  setLyricsScreen: (value: boolean) => void;
  setPalette: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
  setSearchMeta: (meta: {
    source: string | null;
    attempts: Array<{ instance: string; error: string }>;
    error: string | null;
  }) => void;
  toast: (toast: Omit<Toast, "id" | "timeoutMs"> & { timeoutMs?: number }) => void;
  dismissToast: (id: number) => void;
  askQueuePrompt: (prompt: QueuePrompt) => void;
  dismissQueuePrompt: () => void;
  setQueueAddOpen: (value: boolean) => void;
  setOnboarding: (value: boolean) => void;
  markLimitationSeen: () => void;
}

let toastId = 1;

export const useCiderUi = create<CiderUiStore>((set, get) => ({
  panel: null,
  immersive: false,
  immersiveLayout: null,
  lyricsScreen: false,
  palette: false,
  sidebarOpen: false,
  searchSource: null,
  searchAttempts: [],
  lastSearchError: null,
  toasts: [],
  queuePrompt: null,
  queueAddOpen: false,
  onboarding: false,
  limitationSeen: false,

  setPanel: (panel) => set({ panel }),

  togglePanel: (panel) => set((state) => ({ panel: state.panel === panel ? null : panel })),

  setImmersive: (value) => set({ immersive: value }),

  toggleImmersive: () => set((state) => ({ immersive: !state.immersive })),

  setImmersiveLayout: (layout) => set({ immersiveLayout: layout }),

  setLyricsScreen: (value) => set({ lyricsScreen: value }),

  setPalette: (value) => set({ palette: value }),

  setSidebarOpen: (value) => set({ sidebarOpen: value }),

  setSearchMeta: ({ source, attempts, error }) =>
    set({ searchSource: source, searchAttempts: attempts, lastSearchError: error }),

  toast: ({ kind, title, message, action, actionLabel, timeoutMs }) => {
    const id = toastId++;
    const item: Toast = {
      id,
      kind,
      title,
      message,
      action,
      actionLabel,
      timeoutMs: timeoutMs ?? (kind === "error" ? 9000 : 5000),
    };
    set((state) => ({ toasts: [...state.toasts.slice(-4), item] }));
    if (item.timeoutMs > 0) {
      setTimeout(() => get().dismissToast(id), item.timeoutMs);
    }
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),

  askQueuePrompt: (prompt) => set({ queuePrompt: prompt }),

  dismissQueuePrompt: () => set({ queuePrompt: null }),

  setQueueAddOpen: (value) => set({ queueAddOpen: value }),

  setOnboarding: (value) => set({ onboarding: value }),

  markLimitationSeen: () => set({ limitationSeen: true }),
}));

/** Atalho para avisos fora de componentes React. */
export const ciderToast = (
  kind: ToastKind,
  title: string,
  message?: string,
  extra?: Partial<Pick<Toast, "action" | "actionLabel" | "timeoutMs">>,
): void => {
  useCiderUi.getState().toast({ kind, title, message, ...extra });
};
