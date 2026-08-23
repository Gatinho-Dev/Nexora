import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { realtime } from "@/lib/ws";
import { useChatUIStore } from "@/store/useChatUIStore";
import { EmojiPicker } from "./EmojiPicker";
import { GifPicker } from "./GifPicker";
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
} from "lucide-react";
import { toast } from "sonner";
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
};

type Props = {
  channelId?: number;
  conversationId?: number;
  placeholder: string;
  members?: { id: number; username: string | null; name: string | null }[];
  disabled?: boolean;
};

export function MessageInput({
  channelId,
  conversationId,
  placeholder,
  members = [],
  disabled,
}: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [spoilerIds, setSpoilerIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef(0);

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
    emitTyping();
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/@([a-zA-Z0-9_.-]*)$/);
    setMentionQuery(match ? match[1] : null);
    setMentionIndex(0);
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

  const doSend = () => {
    const content = text.trim();
    if ((!content && files.length === 0) || send.isPending) return;
    send.mutate(
      {
        channelId,
        conversationId,
        content,
        replyToId: replyingTo?.id,
        attachmentIds: files.map(f => f.id),
        spoilerIds: spoilerIds.filter(id => files.some(f => f.id === id)),
      },
      {
        onSuccess: () => {
          setText("");
          setFiles([]);
          setSpoilerIds([]);
          setReplyingTo(null);
        },
      }
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const uploadFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(apiUrl("/api/upload"), {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? `Falha ao enviar ${file.name}`);
          continue;
        }
        setFiles(prev => [...prev, data]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    <div className="px-4 pb-4 pt-1 relative bg-[#313338]">
      {/* Dropzone overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-[#1E1F22]/90 border-4 border-dashed border-[#4654D8] backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white pointer-events-none animate-in fade-in duration-150">
          <UploadCloud className="h-16 w-16 text-[#4654D8]" />
          <h2 className="text-2xl font-bold tracking-tight">
            Solte para enviar
          </h2>
          <p className="text-sm text-[#B5BAC1]">
            Envie seus arquivos diretamente para o chat da Nexora
          </p>
        </div>
      )}

      {/* Reply header banner */}
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-t-xl bg-[#2B2D31] border border-white/10 px-3.5 py-2 text-xs text-white select-none">
          <CornerUpLeft className="h-3.5 w-3.5 text-[#4654D8]" />
          <span>
            Respondendo a{" "}
            <span className="font-bold text-[#4654D8]">
              @{replyingTo.author.name ?? replyingTo.author.username}
            </span>
          </span>
          <span className="truncate text-[#B5BAC1] text-xs flex-1">
            {replyingTo.content}
          </span>
          <button
            className="text-[#B5BAC1] hover:text-white transition-colors"
            onClick={() => setReplyingTo(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pending attachments */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-t-xl bg-[#2B2D31] border border-white/10 px-3.5 py-2.5">
          {files.map(f => {
            const isSpoiler = spoilerIds.includes(f.id);
            return (
              <div
                key={f.id}
                className="relative flex items-center gap-2 rounded-lg border border-white/10 bg-[#232428] px-2.5 py-1.5 text-xs text-white"
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
                  <div className="text-[#B5BAC1]">{formatSize(f.size)}</div>
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
                    className="rounded-full bg-white/10 p-0.5 text-[#B5BAC1] hover:text-white transition-colors"
                  >
                    {isSpoiler ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
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

      {/* Voice recording controls */}
      {recording || recordedUrl ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#2B2D31] border border-white/10 px-4 py-3 text-white shadow-lg">
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
                  className="flex items-center gap-1.5 rounded-lg bg-[#4654D8] text-white hover:bg-[#3D49BF] px-3 py-1.5 text-xs font-bold transition-colors"
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
                <Play className="h-3.5 w-3.5 text-[#4654D8]" /> Ouvir
              </button>
              <span className="text-xs font-mono text-[#B5BAC1]">
                {fmtSecs(recordSeconds)}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#B5BAC1] hover:text-white px-3 py-1.5 text-xs font-medium transition-colors"
                  onClick={cancelRecording}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Descartar
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-[#4654D8] hover:bg-[#3D49BF] text-white px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
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
            "relative flex min-h-11 items-end gap-1.5 rounded-lg bg-[#383A40] border border-transparent px-3.5 py-2 transition-colors focus-within:border-[#4654D8]",
            (replyingTo || files.length > 0) && "rounded-t-none border-t-0"
          )}
        >
          {/* Mention Candidates Autocomplete */}
          {mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-[#232428] border border-white/10 shadow-2xl overflow-hidden z-30 select-none">
              {mentionCandidates.map((m, i) => (
                <button
                  key={m.id}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors",
                    i === mentionIndex
                      ? "bg-[#4654D8]/20 text-white font-bold"
                      : "text-[#B5BAC1] hover:bg-white/5 hover:text-white"
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

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 text-[#B5BAC1] hover:text-white transition-colors disabled:opacity-40"
                  disabled={disabled || uploading}
                  onClick={() => fileInputRef.current?.click()}
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
            className="flex-1 bg-transparent outline-none resize-none text-sm text-[#DBDEE1] py-1.5 max-h-48 placeholder:text-[#949BA4] disabled:opacity-50"
            placeholder={uploading ? "Enviando arquivos..." : placeholder}
            value={text}
            disabled={disabled || uploading}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
          />

          <EmojiPicker onPick={emoji => setText(t => t + emoji)}>
            <button
              className="p-1.5 text-[#B5BAC1] hover:text-white transition-colors"
              title="Emojis"
              type="button"
            >
              <Smile className="h-5 w-5" />
            </button>
          </EmojiPicker>

          {!disabled && (
            <GifPicker onPick={url => setText(t => `${t}${t ? " " : ""}${url} `)}>
              <button
                className="p-0.5 text-[10px] font-extrabold tracking-wider rounded bg-white/5 hover:bg-white/15 border border-[#B5BAC1]/40 text-[#B5BAC1] hover:text-white transition-colors disabled:opacity-40"
                title="GIFs"
                type="button"
                disabled={disabled}
              >
                GIF
              </button>
            </GifPicker>
          )}

          {text.trim() || files.length > 0 ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-1.5 text-[#4654D8] hover:text-[#4654D8] transition-colors disabled:opacity-40"
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
                    className="p-1.5 text-[#B5BAC1] hover:text-white transition-colors disabled:opacity-40"
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
    </div>
  );
}
