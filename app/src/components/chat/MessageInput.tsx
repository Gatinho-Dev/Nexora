import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import { realtime } from "@/lib/ws";
import { useChatUIStore } from "@/store/useChatUIStore";
import { useAppStore } from "@/store/useAppStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { SlashCommandMenu } from "./SlashCommandMenu";

const GifPicker = lazy(() =>
  import("./GifPicker").then(m => ({ default: m.GifPicker })),
);
const EmojiPickerPro = lazy(() =>
  import("./pickers/EmojiPickerPro").then(m => ({ default: m.EmojiPickerPro })),
);
const StickerPicker = lazy(() =>
  import("./pickers/StickerPicker").then(m => ({ default: m.StickerPicker })),
);
const PollCreator = lazy(() =>
  import("./poll/PollCreator").then(m => ({ default: m.PollCreator })),
);

function PickerFallback() {
  return <div className="h-72 w-80 rounded-xl bg-[#24262c] animate-pulse" />;
}
import {
  applyTextCommand,
  computeFunCommand,
  getFavoriteCommands,
  pushRecentCommand,
  searchCommands,
  toggleFavoriteCommand,
  type NexoraCommand,
} from "@/lib/commands/registry";
import { formatSize } from "@/lib/formatSize";
import { apiUrl } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  Smile,
  Mic,
  SendHorizonal,
  X,
  CornerUpLeft,
  Square,
  Play,
  Trash2,
  UploadCloud,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  FileCode,
  Quote,
  Camera,
  ImageIcon,
  FileText,
  Sticker,
  Sparkles,
  MessageSquarePlus,
  BarChart3,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PendingFile = {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  moderationStatus?: string | null;
  /** MODERATION_UNAVAILABLE terminal state — user can retry. */
  failed?: boolean;
};

/** Terminal moderation states allow sending; others must be awaited. */
function isMediaCleared(f: PendingFile): boolean {
  return (
    !f.moderationStatus ||
    f.moderationStatus === "approved" ||
    f.moderationStatus === "sensitive"
  );
}

type ToolbarAction =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "spoiler"
  | "code"
  | "codeblock"
  | "quote";

const TOOLBAR_ACTIONS: {
  icon: typeof Bold;
  label: string;
  action: ToolbarAction;
}[] = [
  { icon: Bold, label: "Negrito (**negrito**)", action: "bold" },
  { icon: Italic, label: "Itálico (*itálico*)", action: "italic" },
  { icon: Underline, label: "Sublinhado (__sublinhado__)", action: "underline" },
  { icon: Strikethrough, label: "Tachado (~~tachado~~)", action: "strike" },
  { icon: EyeOff, label: "Spoiler (||texto||)", action: "spoiler" },
  { icon: Code, label: "Código inline (`código`)", action: "code" },
  { icon: FileCode, label: "Bloco de código", action: "codeblock" },
  { icon: Quote, label: "Citação (> texto)", action: "quote" },
];

type Props = {
  channelId?: number;
  conversationId?: number;
  threadId?: number;
  placeholder: string;
  members?: { id: number; username: string | null; name: string | null }[];
  disabled?: boolean;
};

export function MessageInput({
  channelId,
  conversationId,
  threadId,
  placeholder,
  members = [],
  disabled,
}: Props) {
  const isMobile = useIsMobile();
  const { user: authUser } = useAuth();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [spoilerIds, setSpoilerIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const lastTypingSent = useRef(0);

  // ── Slash commands ──────────────────────────────────────────
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [pendingCommand, setPendingCommand] = useState<NexoraCommand | null>(
    null,
  );
  const [commandArgs, setCommandArgs] = useState("");
  const slashMatches = slashOpen ? searchCommands(text) : [];
  const [favoriteCmds, setFavoriteCmds] = useState<string[]>(() =>
    getFavoriteCommands(),
  );
  const [pollOpen, setPollOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicName, setTopicName] = useState("");
  const navigate = useNavigate();
  const createTopic = trpc.threads.create.useMutation({
    onSuccess: data => {
      setTopicOpen(false);
      setTopicName("");
      toast.success("Tópico criado!");
      if (channelId) {
        navigate(
          `/channels/${window.location.pathname.split("/")[2]}/${channelId}/t/${data.id}`,
        );
      }
    },
    onError: e => toast.error(e.message),
  });
  const createPoll = trpc.poll.create.useMutation({
    onSuccess: () => {
      setPollOpen(false);
      setText("");
    },
    onError: e => toast.error(e.message),
  });
  const nickCommand = trpc.command.nick.useMutation({
    onSuccess: () => {
      toast.success("Apelido atualizado!");
      setText("");
    },
    onError: e => toast.error(e.message),
  });
  const friendRequest = trpc.friend.sendRequest.useMutation({
    onError: e => toast.error(e.message),
  });

  // ── Rascunho por canal/conversa ─────────────────────────────
  const draftKey = channelId
    ? `c:${channelId}`
    : conversationId
      ? `dm:${conversationId}`
      : null;
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Troca de canal: restaura o rascunho salvo.
    if (!draftKey) return;
    const timeout = setTimeout(() => {
      try {
        const drafts = JSON.parse(
          localStorage.getItem("nexora-drafts") ?? "{}",
        ) as Record<string, string>;
        setText(drafts[draftKey] ?? "");
      } catch {
        setText("");
      }
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const saveDraft = (value: string) => {
    if (!draftKey) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        const drafts = JSON.parse(
          localStorage.getItem("nexora-drafts") ?? "{}",
        ) as Record<string, string>;
        if (value) drafts[draftKey] = value;
        else delete drafts[draftKey];
        localStorage.setItem("nexora-drafts", JSON.stringify(drafts));
      } catch {
        // ignore storage failures
      }
    }, 400);
  };

  const clearDraft = () => {
    if (!draftKey) return;
    try {
      const drafts = JSON.parse(
        localStorage.getItem("nexora-drafts") ?? "{}",
      ) as Record<string, string>;
      delete drafts[draftKey];
      localStorage.setItem("nexora-drafts", JSON.stringify(drafts));
    } catch {
      // ignore storage failures
    }
  };

  // ── Upload com progresso (XHR) ──────────────────────────────
  const [uploadingItems, setUploadingItems] = useState<
    { tempId: number; name: string; progress: number; xhr: XMLHttpRequest }[]
  >([]);
  const uploadTempId = useRef(0);

  const replyingTo = useChatUIStore(s => s.replyingTo);
  const setReplyingTo = useChatUIStore(s => s.setReplyingTo);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const send = trpc.message.send.useMutation({
    onError: e => toast.error(e.message),
  });

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  // Focus on reply
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const mentionCandidates =
    mentionQuery !== null
      ? members
          .filter(
            m =>
              m.username
                ?.toLowerCase()
                .startsWith(mentionQuery.toLowerCase()) ||
              m.name?.toLowerCase().startsWith(mentionQuery.toLowerCase())
          )
          .slice(0, 6)
      : [];

  const emitTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 3000) return;
    lastTypingSent.current = now;
    realtime.send({ t: "typing", channelId, conversationId });
  };

  const handleChange = (value: string) => {
    setText(value);
    saveDraft(value);
    emitTyping();
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/@([a-zA-Z0-9_.-]*)$/);
    setMentionQuery(match ? match[1] : null);
    setMentionIndex(0);
    // Slash commands: "/" no início abre o menu; depois de escolher um
    // comando, o texto vira os argumentos.
    if (pendingCommand) {
      setCommandArgs(value);
      setSlashOpen(false);
    } else {
      const isSlashQuery = value.startsWith("/") && !value.includes(" ");
      setSlashOpen(isSlashQuery);
      setSlashIndex(0);
    }
  };

  const executeCommand = (command: NexoraCommand, args: string) => {
    const trimmed = args.trim();
    if (command.execution === "server") {
      if (command.name === "nick") {
        if (!channelId) {
          toast.error("/nick só funciona em canais de servidor.");
          return;
        }
        nickCommand.mutate({ channelId, nickname: trimmed });
        return;
      }
      if (command.name === "status") {
        const valid = ["online", "idle", "dnd", "invisible"];
        if (!valid.includes(trimmed)) {
          toast.error("Use: /status online, idle, dnd ou invisible");
          return;
        }
        realtime.send({ t: "presence", status: trimmed as never });
        if (authUser) {
          useAppStore
            .getState()
            .setPresence(
              authUser.id,
              trimmed === "invisible" ? "offline" : trimmed,
            );
        }
        toast.success(`Status alterado para ${trimmed}.`);
        setText("");
        return;
      }
      if (command.name === "dm") {
        // Abre o busca-rápido oficial (usuários/DMs) — digite o nome lá.
        toast("Digite o nome da pessoa no busca-rápido.");
        useAppStore.getState().setQuickSwitcherOpen(true);
        setText("");
        return;
      }
      if (command.name === "friend-add") {
        if (!trimmed) {
          toast.error("Use: /friend-add usuário");
          return;
        }
        friendRequest.mutate(
          { username: trimmed },
          {
            onSuccess: () => {
              toast.success(`Pedido de amizade enviado a @${trimmed}.`);
              setText("");
            },
          },
        );
        return;
      }
      return;
    }
    if (command.name === "poll") {
      setPollOpen(true);
      setText("");
      return;
    }
    if (command.name === "topic") {
      if (!channelId) {
        toast.error("/topic só funciona em canais de servidor.");
        return;
      }
      setTopicName(trimmed);
      setTopicOpen(true);
      setText("");
      return;
    }
    if (command.name === "upload") {
      fileInputRef.current?.click();
      return;
    }
    if (command.name === "help") {
      const list = searchCommands("")
        .map(c => `/${c.name} — ${c.description}`)
        .join("\n");
      toast("Comandos disponíveis:\n" + list, { duration: 8000 });
      setText("");
      return;
    }
    if (command.name === "gif") {
      if (!trimmed) {
        toast("Digite o que buscar: /gif gato dançando");
        return;
      }
      void (async () => {
        try {
          const res = await fetch(
            apiUrl(`/api/gifs/search?q=${encodeURIComponent(trimmed)}`),
            { credentials: "include" },
          );
          if (!res.ok) throw new Error();
          const results = (await res.json()) as { url?: string }[];
          const url = results[0]?.url;
          if (!url) {
            toast.error("Nenhum GIF encontrado.");
            return;
          }
          send.mutate(
            { channelId, conversationId, content: url, threadId },
            {
              onSuccess: () => {
                setText("");
                clearDraft();
              },
            },
          );
        } catch {
          toast.error("Não foi possível buscar o GIF agora.");
        }
      })();
      return;
    }
    // Diversão: coinflip/dice/random/choose/8ball/calc → envia o resultado.
    const funResult = computeFunCommand(command.name, args);
    if (funResult !== null) {
      send.mutate(
        { channelId, conversationId, content: funResult, threadId },
        {
          onSuccess: () => {
            setText("");
            clearDraft();
          },
        },
      );
      return;
    }
    const transformed = applyTextCommand(command.name, args);
    if (transformed === null) {
      toast.error("Este comando precisa de um argumento.");
      return;
    }
    send.mutate(
      { channelId, conversationId, content: transformed, threadId },
      {
        onSuccess: () => {
          setText("");
          clearDraft();
        },
      },
    );
  };

  const selectCommand = (command: NexoraCommand) => {
    setSlashOpen(false);
    setSlashIndex(0);
    pushRecentCommand(command.name);
    setFavoriteCmds(getFavoriteCommands());
    if (command.execution === "client" && !command.args) {
      // /shrug etc.: executa direto
      executeCommand(command, "");
      setText("");
      return;
    }
    // Comando com argumentos: trava o modo comando e usa o campo como args.
    setPendingCommand(command);
    setCommandArgs("");
    setText("");
    textareaRef.current?.focus();
  };

  const submitPendingCommand = () => {
    if (!pendingCommand) return;
    executeCommand(pendingCommand, commandArgs);
    setPendingCommand(null);
    setCommandArgs("");
  };

  const insertMention = (username: string) => {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? text.length;
    const before = text
      .slice(0, cursor)
      .replace(/@([a-zA-Z0-9_.-]*)$/, `@${username} `);
    const after = text.slice(cursor);
    setText(before + after);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const toggleSpoiler = (id: number) => {
    setSpoilerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Markdown toolbar ────────────────────────────────────────
  const applyFormat = (before: string, after: string = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? start;
    const selected = text.slice(start, end);
    const next =
      text.slice(0, start) + before + selected + after + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      if (selected) {
        el.setSelectionRange(
          start + before.length,
          start + before.length + selected.length
        );
      } else {
        const pos = start + before.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const applyQuote = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? start;
    const selected = text.slice(start, end) || "";
    const quoted = (selected || "").replace(/^/gm, "> ");
    const next = text.slice(0, start) + quoted + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + quoted.length, start + quoted.length);
    });
  };

  const runToolbarAction = (action: ToolbarAction) => {
    switch (action) {
      case "bold":
        applyFormat("**");
        break;
      case "italic":
        applyFormat("*");
        break;
      case "underline":
        applyFormat("__");
        break;
      case "strike":
        applyFormat("~~");
        break;
      case "spoiler":
        applyFormat("||");
        break;
      case "code":
        applyFormat("`");
        break;
      case "codeblock":
        applyCodeBlock();
        break;
      case "quote":
        applyQuote();
        break;
    }
  };

  const applyCodeBlock = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? start;
    const selected = text.slice(start, end);
    const block = "```\n" + selected + "\n```";
    const next = text.slice(0, start) + block + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      // Cursor right after the opening fence so the user can type the language
      el.setSelectionRange(start + 3, start + 3);
    });
  };

  const doSend = () => {
    const content = text.trim();
    if ((!content && files.length === 0) || send.isPending) return;
    if (!files.every(isMediaCleared)) {
      toast.error("Verificando mídia... Aguarde a análise de segurança.");
      return;
    }
    send.mutate(
      {
        channelId,
        conversationId,
        content,
        replyToId: replyingTo?.id,
        threadId,
        attachmentIds: files.map(f => f.id),
        spoilerIds: spoilerIds.filter(id => files.some(f => f.id === id)),
      },
      {
        onSuccess: () => {
          setText("");
          clearDraft();
          setFiles([]);
          setSpoilerIds([]);
          setReplyingTo(null);
        },
      }
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash commands têm prioridade quando o menu está aberto.
    if (slashOpen && slashMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex(i => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex(
          i => (i - 1 + slashMatches.length) % slashMatches.length,
        );
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        selectCommand(slashMatches[slashIndex]);
        return;
      }
      if (e.key === "Escape") {
        setSlashOpen(false);
        return;
      }
    }
    // Modo argumento de comando: Enter executa, Esc cancela.
    if (pendingCommand) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitPendingCommand();
        return;
      }
      if (e.key === "Escape") {
        setPendingCommand(null);
        setCommandArgs("");
        setText("");
        return;
      }
    }
    if (mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          i => (i - 1 + mentionCandidates.length) % mentionCandidates.length
        );
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const candidate = mentionCandidates[mentionIndex];
        if (candidate?.username) insertMention(candidate.username);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
    if (e.key === "Escape" && replyingTo) {
      setReplyingTo(null);
    }
  };

  /** Upload de um arquivo via XHR com progresso + cancelamento. */
  const uploadOne = (file: File) =>
    new Promise<void>(resolve => {
      const tempId = ++uploadTempId.current;
      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      setUploadingItems(prev => [
        ...prev,
        { tempId, name: file.name, progress: 0, xhr },
      ]);
      xhr.upload.addEventListener("progress", e => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadingItems(prev =>
            prev.map(item =>
              item.tempId === tempId ? { ...item, progress: percent } : item,
            ),
          );
        }
      });
      xhr.addEventListener("load", () => {
        setUploadingItems(prev => prev.filter(i => i.tempId !== tempId));
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300) {
            toast.error(data.error ?? `Falha ao enviar ${file.name}`);
          } else {
            setFiles(prev => [...prev, data]);
            if (data.moderationStatus === "processing") {
              void waitForModeration(data.id);
            }
          }
        } catch {
          toast.error(`Falha ao enviar ${file.name}`);
        }
        resolve();
      });
      xhr.addEventListener("error", () => {
        setUploadingItems(prev => prev.filter(i => i.tempId !== tempId));
        toast.error(`Falha de rede ao enviar ${file.name}`);
        resolve();
      });
      xhr.addEventListener("abort", () => {
        setUploadingItems(prev => prev.filter(i => i.tempId !== tempId));
        toast(`Envio de ${file.name} cancelado.`);
        resolve();
      });
      xhr.open("POST", apiUrl("/api/upload"));
      xhr.withCredentials = true;
      xhr.send(form);
    });

  const cancelUpload = (tempId: number) => {
    setUploadingItems(prev => {
      const item = prev.find(i => i.tempId === tempId);
      item?.xhr.abort();
      return prev;
    });
  };

  const uploadFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        await uploadOne(file);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** Poll the safety pipeline until this file reaches a terminal state. */
  const waitForModeration = async (fileId: number, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const res = await fetch(
          apiUrl(`/api/moderation/status?ids=${fileId}`),
          { credentials: "include" }
        );
        if (!res.ok) continue;
        const { statuses } = (await res.json()) as {
          statuses: Record<string, string>;
        };
        const status = statuses[String(fileId)];
        if (!status) continue;
        setFiles(prev =>
          prev.map(f =>
            f.id === fileId ? { ...f, moderationStatus: status } : f
          )
        );
        if (status === "blocked") {
          setFiles(prev => prev.filter(f => f.id !== fileId));
          toast.error(
            "Essa imagem não pode ser enviada porque viola as regras de segurança da Nexora."
          );
          return;
        }
        if (status === "review_required") {
          // MODERATION_UNAVAILABLE: mantém o chip com botão de tentar novamente.
          setFiles(prev =>
            prev.map(f =>
              f.id === fileId ? { ...f, moderationStatus: status, failed: true } : f
            )
          );
          toast.error("Não foi possível verificar essa imagem agora. Tente novamente.");
          return;
        }
        if (status === "approved" || status === "sensitive") return;
      } catch {
        // transient network error — keep polling
      }
    }
    // Timed out polling: mark as failed (never silently publish unmoderated).
    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, failed: true } : f))
    );
    toast.error("Não foi possível verificar esta mídia no momento.");
  };

  /** Owner retries a media stuck in MODERATION_UNAVAILABLE. */
  const retryFailedMedia = async (fileId: number) => {
    try {
      const res = await fetch(apiUrl(`/api/moderation/retry/${fileId}`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? { ...f, moderationStatus: "processing", failed: false }
            : f
        )
      );
      void waitForModeration(fileId);
    } catch {
      toast.error("Não foi possível verificar essa imagem agora. Tente novamente em alguns instantes.");
    }
  };

  // Drag and drop listener
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setIsDraggingOver(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (e.dataTransfer?.files) {
        void uploadFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // ── Audio recording ─────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecordSeconds(0);
      recordTimer.current = setInterval(
        () => setRecordSeconds(s => s + 1),
        1000
      );
      setRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    if (recordTimer.current) clearInterval(recordTimer.current);
    setRecording(false);
  };

  const cancelRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordSeconds(0);
  };

  const sendRecording = async () => {
    if (!recordedBlob) return;
    const ext = recordedBlob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([recordedBlob], `mensagem-de-voz.${ext}`, {
      type: recordedBlob.type,
    });
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao enviar áudio.");
        return;
      }
      send.mutate(
        { channelId, conversationId, content: "", attachmentIds: [data.id] },
        { onSuccess: () => cancelRecording() }
      );
    } finally {
      setUploading(false);
    }
  };

  const fmtSecs = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="px-4 pt-1 relative bg-chat pb-[calc(16px+env(safe-area-inset-bottom))] md:pb-4">
      {/* Menu de anexos (mobile) */}
      {attachOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setAttachOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-150" />
          <div
            className="absolute inset-x-3 bottom-3 space-y-1 rounded-2xl border border-white/10 bg-panel p-2 shadow-2xl pb-[calc(env(safe-area-inset-bottom)+8px)] animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
            role="menu"
            aria-label="Adicionar anexo"
          >
            <button
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setTimeout(() => cameraInputRef.current?.click(), 60);
              }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-semibold text-bodyx transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <Camera className="h-5 w-5 text-primary" />
              Câmera
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setTimeout(() => mediaInputRef.current?.click(), 60);
              }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-semibold text-bodyx transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <ImageIcon className="h-5 w-5 text-primary" />
              Foto ou vídeo
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setTimeout(() => fileInputRef.current?.click(), 60);
              }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-semibold text-bodyx transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <FileText className="h-5 w-5 text-primary" />
              Arquivo
            </button>
            {channelId && (
              <>
                <div className="h-px bg-white/[0.06]" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setAttachOpen(false);
                    setTopicName("");
                    setTopicOpen(true);
                  }}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-semibold text-bodyx transition-colors hover:bg-white/5 active:bg-white/10"
                >
                  <MessageSquarePlus className="h-5 w-5 text-primary" />
                  Criar tópico
                </button>
              </>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setPollOpen(true);
              }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-semibold text-bodyx transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <BarChart3 className="h-5 w-5 text-primary" />
              Criar enquete
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setPendingCommand(null);
                setText("/");
                setSlashOpen(true);
                setSlashIndex(0);
                textareaRef.current?.focus();
              }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3.5 text-left text-sm font-semibold text-bodyx transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <Sparkles className="h-5 w-5 text-primary" />
              Usar apps
            </button>
          </div>
        </div>
      )}

      {/* Menu + (desktop): popup ancorado */}
      {attachOpen && isMobile === false && (
        <div
          className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl z-30 select-none animate-in fade-in slide-in-from-bottom-1 duration-150"
          role="menu"
          aria-label="Adicionar anexo"
          onMouseLeave={() => setAttachOpen(false)}
        >
          <button
            role="menuitem"
            onClick={() => {
              setAttachOpen(false);
              fileInputRef.current?.click();
            }}
            className="flex min-h-[44px] w-full items-center gap-3 px-3.5 text-left text-xs font-semibold text-bodyx transition-colors hover:bg-white/5"
          >
            <FileText className="h-4 w-4 text-primary" />
            Enviar um arquivo
          </button>
          {channelId && (
            <button
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setTopicName("");
                setTopicOpen(true);
              }}
              className="flex min-h-[44px] w-full items-center gap-3 px-3.5 text-left text-xs font-semibold text-bodyx transition-colors hover:bg-white/5"
            >
              <MessageSquarePlus className="h-4 w-4 text-primary" />
              Criar tópico
            </button>
          )}
          <button
            role="menuitem"
            onClick={() => {
              setAttachOpen(false);
              setPollOpen(true);
            }}
            className="flex min-h-[44px] w-full items-center gap-3 px-3.5 text-left text-xs font-semibold text-bodyx transition-colors hover:bg-white/5"
          >
            <BarChart3 className="h-4 w-4 text-primary" />
            Criar enquete
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setAttachOpen(false);
              setText("/");
              setSlashOpen(true);
              setSlashIndex(0);
              textareaRef.current?.focus();
            }}
            className="flex min-h-[44px] w-full items-center gap-3 px-3.5 text-left text-xs font-semibold text-bodyx transition-colors hover:bg-white/5"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Usar apps
          </button>
        </div>
      )}

      {/* Dropzone overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-rail/90 border-4 border-dashed border-[#5865F2] backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white pointer-events-none animate-in fade-in duration-150">
          <UploadCloud className="h-16 w-16 text-[#5865F2]" />
          <h2 className="text-2xl font-bold tracking-tight">
            Solte para enviar
          </h2>
          <p className="text-sm text-muted2">
            Envie seus arquivos diretamente para o chat da Nexora
          </p>
        </div>
      )}

      {/* Reply header banner */}
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-t-xl bg-sidebar border border-white/10 px-3.5 py-2 text-xs text-white select-none">
          <CornerUpLeft className="h-3.5 w-3.5 text-[#5865F2]" />
          <span>
            Respondendo a{" "}
            <span className="font-bold text-[#5865F2]">
              @{replyingTo.author.name ?? replyingTo.author.username}
            </span>
          </span>
          <span className="truncate text-muted2 text-xs flex-1">
            {replyingTo.content}
          </span>
          <button
            className="text-muted2 hover:text-white transition-colors"
            onClick={() => setReplyingTo(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Uploads em andamento (progresso + cancelar) */}
      {uploadingItems.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-t-xl bg-sidebar border border-white/10 px-3.5 py-2.5">
          {uploadingItems.map(item => (
            <div
              key={item.tempId}
              className="flex w-52 flex-col gap-1.5 rounded-lg border border-white/10 bg-panel px-2.5 py-2 text-xs text-bodyx"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{item.name}</span>
                <button
                  onClick={() => cancelUpload(item.tempId)}
                  aria-label={`Cancelar envio de ${item.name}`}
                  className="rounded p-0.5 text-muted2 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#5865F2] transition-all duration-200"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <span className="text-right text-[10px] text-muted2">
                Enviando… {item.progress}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pending attachments */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-t-xl bg-sidebar border border-white/10 px-3.5 py-2.5">
          {files.map(f => {
            const isSpoiler = spoilerIds.includes(f.id);
            const isFailed = f.failed === true;
            return (
              <div
                key={f.id}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                  isFailed
                    ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-100"
                    : "border-white/10 bg-panel text-bodyx"
                )}
              >
                {f.mimeType.startsWith("image/") ? (
                  <div className="relative">
                    <img
                      src={f.url}
                      alt={isSpoiler ? "Spoiler" : f.filename}
                      className={cn(
                        "h-10 w-10 rounded-md object-cover transition-all",
                        isSpoiler && "blur-md"
                      )}
                    />
                    {isSpoiler && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 text-[9px] font-bold tracking-widest">
                        SPOILER
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-lg">📄</span>
                )}
                <div className="max-w-32">
                  <div className="truncate font-medium">{f.filename}</div>
                  <div className="text-muted2">{formatSize(f.size)}</div>
                </div>
                {/* Attachment actions */}
                {f.mimeType.startsWith("image/") && (
                  <button
                    type="button"
                    title={
                      isSpoiler ? "Remover marcação de spoiler" : "Marcar como spoiler"
                    }
                    aria-label={
                      isSpoiler ? "Remover marcação de spoiler" : "Marcar como spoiler"
                    }
                    onClick={() => toggleSpoiler(f.id)}
                    className="rounded-full bg-white/10 p-0.5 text-muted2 hover:text-white transition-colors"
                  >
                    {isSpoiler ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </button>
                )}
                {isFailed && (
                  <button
                    type="button"
                    title="Não foi possível verificar agora — tentar novamente"
                    onClick={() => retryFailedMedia(f.id)}
                    className="flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-1 text-[10px] font-bold text-amber-200 hover:bg-black/60"
                  >
                    ⚠ Tentar novamente
                  </button>
                )}
                {isFailed && (
                  <button
                    type="button"
                    title="Não foi possível verificar agora — tentar novamente"
                    onClick={() => retryFailedMedia(f.id)}
                    className="flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-1 text-[10px] font-bold text-amber-200 hover:bg-black/60"
                  >
                    ⚠ Tentar novamente
                  </button>
                )}
                <button
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white p-0.5 shadow hover:bg-red-600 transition-colors"
                  onClick={() =>
                    setFiles(prev => prev.filter(x => x.id !== f.id))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Markdown formatting toolbar */}
      {toolbarVisible && !recording && !recordedUrl && (
        <div
          className="mb-1 flex flex-wrap items-center gap-0.5 rounded-t-lg bg-sidebar px-2 py-1"
          role="toolbar"
          aria-label="Formatação de texto"
        >
          {TOOLBAR_ACTIONS.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onMouseDown={e => {
                e.preventDefault();
                runToolbarAction(action);
              }}
              className="rounded p-1.5 text-muted2 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <span className="ml-auto hidden pr-1 text-[10px] font-bold uppercase tracking-wider text-faint sm:block">
            Markdown
          </span>
        </div>
      )}

      {/* Voice recording controls */}
      {recording || recordedUrl ? (
        <div className="flex items-center gap-3 rounded-xl bg-sidebar border border-white/10 px-4 py-3 text-white shadow-lg">
          {recording ? (
            <>
              <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold tracking-wide">
                Gravando... {fmtSecs(recordSeconds)}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 text-xs font-medium transition-colors"
                  onClick={() => {
                    stopRecording();
                    cancelRecording();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Cancelar
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-[#5865F2] text-white hover:bg-[#4752C4] px-3 py-1.5 text-xs font-bold transition-colors"
                  onClick={stopRecording}
                >
                  <Square className="h-3.5 w-3.5" /> Parar
                </button>
              </div>
            </>
          ) : (
            <>
              <audio
                src={recordedUrl ?? undefined}
                className="hidden"
                id="recorded-preview"
              />
              <button
                className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 text-xs font-medium transition-colors"
                onClick={() => {
                  const audio = document.getElementById(
                    "recorded-preview"
                  ) as HTMLAudioElement;
                  audio.play();
                }}
              >
                <Play className="h-3.5 w-3.5 text-[#5865F2]" /> Ouvir
              </button>
              <span className="text-xs font-mono text-muted2">
                {fmtSecs(recordSeconds)}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted2 hover:text-white px-3 py-1.5 text-xs font-medium transition-colors"
                  onClick={cancelRecording}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Descartar
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
                  onClick={sendRecording}
                  disabled={uploading || send.isPending}
                >
                  <SendHorizonal className="h-3.5 w-3.5" /> Enviar
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "relative flex min-h-11 items-end gap-1.5 rounded-lg bg-[#383A40] border border-transparent px-3.5 py-2 transition-colors focus-within:border-[#5865F2]",
            (replyingTo || files.length > 0 || toolbarVisible) &&
              "rounded-t-none border-t-0"
          )}
        >
          {/* Slash command autocomplete */}
          {slashOpen && slashMatches.length > 0 && !pendingCommand && (
            <SlashCommandMenu
              commands={slashMatches}
              selectedIndex={slashIndex}
              onSelect={selectCommand}
              onHover={setSlashIndex}
              query={text.replace(/^\//, "")}
              favorites={favoriteCmds}
              onToggleFavorite={name =>
                setFavoriteCmds(toggleFavoriteCommand(name))
              }
            />
          )}

          {/* Chip do comando em modo argumentos */}
          {pendingCommand && (
            <div className="absolute bottom-full left-0 mb-2 flex w-full max-w-md items-center gap-2 rounded-t-xl border border-white/10 border-b-0 bg-panel px-3 py-2 text-xs text-white z-30">
              {(() => {
                const Icon = pendingCommand.icon;
                return <Icon className="h-3.5 w-3.5 text-[#5865F2]" />;
              })()}
              <span className="font-bold">/{pendingCommand.name}</span>
              <span className="truncate text-muted2">
                {pendingCommand.args?.[0]?.description ?? "argumentos"}
              </span>
              <button
                onClick={() => {
                  setPendingCommand(null);
                  setCommandArgs("");
                  setText("");
                }}
                className="ml-auto rounded p-0.5 text-muted2 hover:text-white"
                aria-label="Cancelar comando"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Mention Candidates Autocomplete */}
          {mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-panel border border-white/10 shadow-2xl overflow-hidden z-30 select-none">
              {mentionCandidates.map((m, i) => (
                <button
                  key={m.id}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors",
                    i === mentionIndex
                      ? "bg-[#5865F2]/20 text-white font-bold"
                      : "text-muted2 hover:bg-white/5 hover:text-white"
                  )}
                  onMouseDown={e => {
                    e.preventDefault();
                    if (m.username) insertMention(m.username);
                  }}
                >
                  <span className="font-semibold">{m.name ?? m.username}</span>
                  <span className="text-[11px] opacity-70">@{m.username}</span>
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => uploadFiles(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-hidden
            onChange={e => {
              setAttachOpen(false);
              void uploadFiles(e.target.files);
            }}
          />
          <input
            ref={mediaInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            aria-hidden
            onChange={e => {
              setAttachOpen(false);
              void uploadFiles(e.target.files);
            }}
          />

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 text-muted2 hover:text-white transition-colors disabled:opacity-40 active:scale-90 rounded-full"
                  disabled={disabled || uploading}
                  onClick={() => {
                    if (isMobile) setAttachOpen(true);
                    else fileInputRef.current?.click();
                  }}
                >
                  <PlusCircle className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Enviar arquivo</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm text-bodyx py-1.5 max-h-48 placeholder:text-faint disabled:opacity-50"
            placeholder={
              pendingCommand
                ? pendingCommand.args?.[0]?.placeholder ?? "Argumentos do comando…"
                : uploading
                  ? "Enviando arquivos..."
                  : placeholder
            }
            value={text}
            disabled={disabled || uploading}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={e => {
              // Colar imagem do clipboard → preview/upload como anexo.
              const pasted = e.clipboardData?.files;
              if (pasted && pasted.length > 0) {
                e.preventDefault();
                void uploadFiles(pasted);
              }
            }}
            onFocus={() => setToolbarVisible(true)}
            onBlur={e => {
              if (
                !e.currentTarget.value &&
                !e.relatedTarget?.closest?.("[role=toolbar]")
              ) {
                setToolbarVisible(false);
              }
            }}
          />

          {!disabled && (
            <Suspense fallback={<PickerFallback />}>
              <StickerPicker
                onPick={slug => {
                  send.mutate(
                    {
                      channelId,
                      conversationId,
                      content: slug,
                      threadId,
                      tag: "sticker",
                    },
                    {
                      onError: e => toast.error(e.message),
                    },
                  );
                }}
              >
                <button
                  className="hidden sm:block p-1.5 text-muted2 hover:text-white transition-colors disabled:opacity-40"
                  title="Stickers"
                  type="button"
                  aria-label="Stickers"
                  aria-haspopup="true"
                  disabled={disabled}
                >
                  <Sticker className="h-5 w-5" />
                </button>
              </StickerPicker>
            </Suspense>
          )}

          <Suspense fallback={<PickerFallback />}>
            <EmojiPickerPro onPick={emoji => setText(t => t + emoji)}>
              <button
                className="p-1.5 text-muted2 hover:text-white transition-colors"
                title="Emojis"
                type="button"
                aria-label="Emojis"
                aria-haspopup="true"
              >
                <Smile className="h-5 w-5" />
              </button>
            </EmojiPickerPro>
          </Suspense>

          {!disabled && (
            <Suspense fallback={<PickerFallback />}>
              <GifPicker onPick={url => setText(t => `${t}${t ? " " : ""}${url} `)}>
                <button
                  className="hidden sm:block p-0.5 text-[10px] font-extrabold tracking-wider rounded bg-white/5 hover:bg-white/15 border border-[#B5BAC1]/40 text-muted2 hover:text-white transition-colors disabled:opacity-40"
                  title="GIFs"
                  type="button"
                  aria-label="GIFs"
                  aria-haspopup="true"
                  disabled={disabled}
                >
                  GIF
                </button>
              </GifPicker>
            </Suspense>
          )}

          {!disabled && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="hidden sm:block p-1.5 text-muted2 hover:text-white transition-colors disabled:opacity-40"
                    title="Apps e comandos"
                    type="button"
                    aria-label="Apps e comandos"
                    onClick={() => {
                      setPendingCommand(null);
                      setText("/");
                      setSlashOpen(true);
                      setSlashIndex(0);
                      textareaRef.current?.focus();
                    }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Apps e comandos</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {text.trim() || files.length > 0 ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-1.5 text-[#5865F2] hover:text-[#5865F2] transition-colors disabled:opacity-40"
                    disabled={disabled || send.isPending || uploading}
                    onClick={doSend}
                  >
                    <SendHorizonal className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Enviar mensagem</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-1.5 text-muted2 hover:text-white transition-colors disabled:opacity-40"
                    disabled={disabled}
                    onClick={startRecording}
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Gravar mensagem de voz
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Criar enquete (/poll ou + menu) */}
      <Suspense fallback={<div className="h-64 w-full animate-pulse" />}>
        <PollCreator
          open={pollOpen}
          onOpenChange={setPollOpen}
          busy={createPoll.isPending}
          onSubmit={data => {
            createPoll.mutate({
              channelId,
              conversationId,
              question: data.question,
              options: data.options,
              allowMultiple: data.allowMultiple,
              durationHours: data.durationHours,
            });
          }}
        />
      </Suspense>

      {/* Criar tópico (/topic ou + menu) */}
      <Dialog
        open={topicOpen}
        onOpenChange={open => {
          setTopicOpen(open);
          if (!open) setTopicName("");
        }}
      >
        <DialogContent className="sm:max-w-sm border-white/10 bg-[#24262c] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Criar tópico</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wide text-[#aeb4be]">
                Nome do tópico
              </Label>
              <Input
                value={topicName}
                onChange={e => setTopicName(e.target.value)}
                maxLength={100}
                placeholder="ex.: estratégia-da-partida"
                autoFocus
                className="h-10 border-white/[0.08] bg-[#17191e] text-sm text-white placeholder:text-[#68707b]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setTopicOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!topicName.trim() || createTopic.isPending}
                onClick={() =>
                  channelId &&
                  createTopic.mutate({
                    channelId,
                    name: topicName.trim(),
                  })
                }
                className="bg-[#5865F2] text-white hover:bg-[#5664e6]"
              >
                {createTopic.isPending ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                )}
                Criar tópico
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
