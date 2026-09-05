import { useRef, useState } from "react";
import { Heart, Loader2, Music2, Play, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { apiUrl } from "@/lib/endpoints";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type UploadResponse = { id: number; url: string; error?: string };

async function audioDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => resolve(Math.round(audio.duration * 1000)), { once: true });
      audio.addEventListener("error", () => reject(new Error("Não foi possível ler este áudio.")), { once: true });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SoundboardPanel({
  open,
  onOpenChange,
  serverId,
  channelId,
  canUse,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
  channelId: number;
  canUse: boolean;
  canManage: boolean;
}) {
  const sounds = trpc.advanced.server.soundboard.useQuery({ serverId }, { enabled: open });
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎵");
  const [volume, setVolume] = useState(80);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const play = trpc.advanced.server.playSound.useMutation({ onError: error => toast.error(error.message) });
  const favorite = trpc.advanced.server.favoriteSound.useMutation({
    onSuccess: () => void sounds.refetch(),
    onError: error => toast.error(error.message),
  });
  const remove = trpc.advanced.server.deleteSound.useMutation({
    onSuccess: () => {
      void sounds.refetch();
      toast.success("Som removido.");
    },
    onError: error => toast.error(error.message),
  });
  const save = trpc.advanced.server.upsertSound.useMutation({
    onSuccess: () => {
      setName("");
      void sounds.refetch();
      toast.success("Som adicionado ao servidor.");
    },
    onError: error => toast.error(error.message),
  });

  const upload = async (file: File) => {
    if (!file.type.startsWith("audio/")) return toast.error("Escolha um arquivo de áudio.");
    if (!name.trim()) return toast.error("Digite um nome antes de enviar.");
    setUploading(true);
    try {
      const durationMs = await audioDuration(file);
      if (durationMs < 100 || durationMs > 10_000) throw new Error("O som deve ter entre 0,1 e 10 segundos.");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(apiUrl("/api/upload"), { method: "POST", body: form, credentials: "include" });
      const data = await response.json() as UploadResponse;
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o áudio.");
      await save.mutateAsync({ serverId, fileId: data.id, name: name.trim(), emoji: emoji.trim() || null, volume, durationMs });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o áudio.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border-white/10 bg-panel text-white sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Music2 className="size-5 text-[#8290ff]" />Soundboard</DialogTitle></DialogHeader>
        <p className="text-xs leading-5 text-muted2">Os sons são reproduzidos para todos no canal. O backend aplica limite contra spam.</p>

        {canManage && (
          <section className="space-y-3 rounded-xl border border-white/[0.07] bg-black/10 p-3">
            <div className="grid grid-cols-[64px_1fr] gap-2"><Input value={emoji} onChange={event => setEmoji(event.target.value)} maxLength={8} aria-label="Emoji do som" /><Input value={name} onChange={event => setName(event.target.value)} maxLength={64} placeholder="Nome do som" aria-label="Nome do som" /></div>
            <div className="space-y-2"><div className="flex justify-between text-[11px] text-muted2"><span>Volume padrão</span><span>{volume}%</span></div><Slider min={0} max={100} value={[volume]} onValueChange={([value]) => setVolume(value)} aria-label="Volume padrão do som" /></div>
            <input ref={fileInput} type="file" accept="audio/*" className="hidden" onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} />
            <Button type="button" variant="secondary" className="min-h-11 w-full" disabled={uploading || save.isPending} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}Enviar áudio de até 10s</Button>
          </section>
        )}

        {sounds.isLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="size-6 animate-spin text-[#8290ff]" /></div> : sounds.data?.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sounds.data.map(sound => (
              <div key={sound.id} className="group relative rounded-xl border border-white/[0.07] bg-sidebar p-2">
                <button type="button" disabled={!canUse || play.isPending} onClick={() => play.mutate({ channelId, soundId: sound.id })} className="flex min-h-20 w-full flex-col items-center justify-center rounded-lg text-center hover:bg-white/5 disabled:opacity-45" aria-label={`Tocar ${sound.name}`}>
                  <span className="text-2xl" aria-hidden>{sound.emoji || "🎵"}</span><span className="mt-1 max-w-full truncate text-xs font-semibold">{sound.name}</span><Play className="mt-1 size-3 text-muted2" />
                </button>
                <button type="button" onClick={() => favorite.mutate({ soundId: sound.id, favorite: !sound.favorite })} className={cn("absolute left-1 top-1 grid size-8 place-items-center rounded-full bg-black/35", sound.favorite ? "text-pink-400" : "text-white/60")} aria-label={sound.favorite ? "Remover dos favoritos" : "Favoritar som"}><Heart className={cn("size-3.5", sound.favorite && "fill-current")} /></button>
                {canManage && <button type="button" disabled={remove.isPending} onClick={() => remove.mutate({ serverId, id: sound.id })} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-black/35 text-red-300 opacity-0 focus:opacity-100 group-hover:opacity-100" aria-label={`Excluir ${sound.name}`}><Trash2 className="size-3.5" /></button>}
              </div>
            ))}
          </div>
        ) : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-white/10 text-center"><div><Plus className="mx-auto size-8 text-faint" /><p className="mt-2 text-sm font-bold">Nenhum som ainda</p><p className="mt-1 text-xs text-muted2">Administradores podem enviar o primeiro clipe.</p></div></div>}
      </DialogContent>
    </Dialog>
  );
}
