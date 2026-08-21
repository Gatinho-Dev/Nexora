import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { realtime } from "@/lib/ws";
import { useChatUIStore } from "@/store/useChatUIStore";
import { EmojiPicker } from "./EmojiPicker";
import { formatSize } from "./MessageItem";
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
} from "lucide-react";
import { toast } from "sonner";

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
  const [uploading, setUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef(0);

  const replyingTo = useChatUIStore((s) => s.replyingTo);
  const setReplyingTo = useChatUIStore((s) => s.setReplyingTo);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const send = trpc.message.send.useMutation({
    onError: (e) => toast.error(e.message),
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
            (m) =>
              m.username?.toLowerCase().startsWith(mentionQuery.toLowerCase()) ||
              m.name?.toLowerCase().startsWith(mentionQuery.toLowerCase()),
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
    // Mention detection: last @token before cursor
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
    const before = text.slice(0, cursor).replace(/@([a-zA-Z0-9_.-]*)$/, `@${username} `);
    const after = text.slice(cursor);
    setText(before + after);
    setMentionQuery(null);
    textareaRef.current?.focus();
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
        attachmentIds: files.map((f) => f.id),
      },
      {
        onSuccess: () => {
          setText("");
          setFiles([]);
          setReplyingTo(null);
        },
      },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
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
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? `Falha ao enviar ${file.name}`);
          continue;
        }
        setFiles((prev) => [...prev, data]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Audio recording ─────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecordSeconds(0);
      recordTimer.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
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
    const file = new File([recordedBlob], `mensagem-de-voz.${ext}`, { type: recordedBlob.type });
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao enviar áudio.");
        return;
      }
      send.mutate(
        { channelId, conversationId, content: "", attachmentIds: [data.id] },
        { onSuccess: () => cancelRecording() },
      );
    } finally {
      setUploading(false);
    }
  };

  const fmtSecs = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="px-4 pb-4 pt-1">
      {/* Reply banner */}
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-t-lg bg-secondary px-3 py-2 text-sm">
          <CornerUpLeft className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Respondendo a{" "}
            <span className="font-semibold text-foreground">
              @{replyingTo.author.name ?? replyingTo.author.username}
            </span>
          </span>
          <span className="truncate text-muted-foreground text-xs flex-1">
            {replyingTo.content}
          </span>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setReplyingTo(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pending attachments */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-t-lg bg-secondary px-3 py-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="relative flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs"
            >
              {f.mimeType.startsWith("image/") ? (
                <img src={f.url} alt={f.filename} className="h-10 w-10 rounded object-cover" />
              ) : (
                <span className="text-lg">📄</span>
              )}
              <div className="max-w-32">
                <div className="truncate font-medium">{f.filename}</div>
                <div className="text-muted-foreground">{formatSize(f.size)}</div>
              </div>
              <button
                className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5"
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recording UI */}
      {recording || recordedUrl ? (
        <div className="flex items-center gap-3 rounded-lg bg-input border border-border px-4 py-3">
          {recording ? (
            <>
              <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium">Gravando... {fmtSecs(recordSeconds)}</span>
              <div className="ml-auto flex gap-2">
                <button
                  className="flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground"
                  onClick={() => {
                    stopRecording();
                    cancelRecording();
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Cancelar
                </button>
                <button
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  onClick={stopRecording}
                >
                  <Square className="h-4 w-4" /> Parar
                </button>
              </div>
            </>
          ) : (
            <>
              <audio src={recordedUrl ?? undefined} className="hidden" id="recorded-preview" />
              <button
                className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-sm"
                onClick={() => {
                  const audio = document.getElementById("recorded-preview") as HTMLAudioElement;
                  audio.play();
                }}
              >
                <Play className="h-4 w-4" /> Ouvir
              </button>
              <span className="text-sm text-muted-foreground">{fmtSecs(recordSeconds)}</span>
              <div className="ml-auto flex gap-2">
                <button
                  className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-sm"
                  onClick={cancelRecording}
                >
                  <Trash2 className="h-4 w-4" /> Descartar
                </button>
                <button
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                  onClick={sendRecording}
                  disabled={uploading || send.isPending}
                >
                  <SendHorizonal className="h-4 w-4" /> Enviar
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "relative flex items-end gap-1 rounded-lg bg-input border border-border px-3 py-2",
            (replyingTo || files.length > 0) && "rounded-t-none",
          )}
        >
          {/* Mention autocomplete */}
          {mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md bg-popover border border-border shadow-lg overflow-hidden z-20">
              {mentionCandidates.map((m, i) => (
                <button
                  key={m.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                    i === mentionIndex ? "bg-hover" : "",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (m.username) insertMention(m.username);
                  }}
                >
                  <span className="font-semibold">{m.name ?? m.username}</span>
                  <span className="text-muted-foreground">@{m.username}</span>
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
          <button
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Enviar arquivo"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <PlusCircle className="h-5 w-5" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm py-1.5 max-h-48 placeholder:text-muted-foreground disabled:opacity-50"
            placeholder={uploading ? "Enviando arquivos..." : placeholder}
            value={text}
            disabled={disabled || uploading}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
          />

          <EmojiPicker onPick={(emoji) => setText((t) => t + emoji)}>
            <button
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Emojis"
              type="button"
            >
              <Smile className="h-5 w-5" />
            </button>
          </EmojiPicker>

          {text.trim() || files.length > 0 ? (
            <button
              className="p-1.5 text-primary hover:opacity-80 transition-opacity disabled:opacity-40"
              title="Enviar"
              disabled={disabled || send.isPending || uploading}
              onClick={doSend}
            >
              <SendHorizonal className="h-5 w-5" />
            </button>
          ) : (
            <button
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Gravar mensagem de voz"
              disabled={disabled}
              onClick={startRecording}
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
