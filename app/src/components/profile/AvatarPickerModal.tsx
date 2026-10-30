import { useRef, useState } from "react";
import { ArrowLeft, Clapperboard, ImagePlus, Loader2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useGifSearch } from "@/hooks/useGifSearch";
import { loadRecentAvatars } from "@/lib/recentAvatars";
import { cn } from "@/lib/utils";

/**
 * "Selecione uma imagem".
 *
 * É o modal que abre no botão esquerdo do grupo "Avatar e decorações" do
 * estúdio de perfil: duas fontes no topo (enviar um arquivo do computador ou
 * escolher um GIF no Klipy) e, embaixo, os últimos uploads de avatar do próprio
 * usuário guardados neste navegador.
 *
 * A escolha do GIF troca o conteúdo do modal pela busca — como no Discord — em
 * vez de empilhar um popover dentro do diálogo.
 */
export function AvatarPickerModal({
  open,
  onOpenChange,
  current,
  onUpload,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Avatar em edição, para marcar qual dos recentes já está no perfil. */
  current: string;
  onUpload: (file: File) => void;
  /** Aplica uma URL já hospedada (GIF escolhido ou upload recente). */
  onPick: (url: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] w-[min(480px,calc(100vw-16px))] gap-0 overflow-hidden rounded-2xl border-black/20 bg-white p-0 text-[#171923] sm:max-w-[480px]"
      >
        <DialogTitle className="sr-only">Selecione uma imagem</DialogTitle>
        {/* Remontado a cada abertura: a tela volta sempre para a lista de
            fontes e os recentes são lidos de novo. */}
        <Picker open={open} current={current} onUpload={onUpload} onPick={onPick} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Picker({
  open,
  current,
  onUpload,
  onPick,
  onClose,
}: {
  open: boolean;
  current: string;
  onUpload: (file: File) => void;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"sources" | "gifs">("sources");
  const [recents] = useState(() => loadRecentAvatars());
  const fileRef = useRef<HTMLInputElement>(null);
  // Busca no Klipy já no primeiro render do modal: o cartão "Escolher GIF"
  // mostra um GIF real e, ao entrar na busca, os resultados vêm do cache.
  const { query, setQuery, gifs, loading, error } = useGifSearch(open);
  const preview = gifs[0];

  const choose = (url: string) => {
    if (!url) {
      toast.error("GIF inválido.");
      return;
    }
    onPick(url);
    onClose();
  };

  if (mode === "gifs") {
    return (
      <>
        <header className="flex items-center gap-2 border-b border-black/10 px-5 py-4">
          <button
            type="button"
            onClick={() => setMode("sources")}
            aria-label="Voltar"
            className="grid size-7 place-items-center rounded-lg text-[#5c6270] transition-colors hover:bg-black/5 hover:text-[#171923]"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h2 className="text-base font-bold">Escolher GIF</h2>
        </header>

        <div className="space-y-3 px-5 py-4">
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar GIFs no Klipy..."
            className="h-9 border-black/15 text-sm"
            aria-label="Buscar GIFs"
          />
          <div className="max-h-[320px] overflow-y-auto">
            {loading && gifs.length === 0 && (
              <div className="flex items-center justify-center py-12 text-[#8b8e9b]">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
            {!loading && error && (
              <p className="py-10 text-center text-xs text-[#5c6270]">{error}</p>
            )}
            {!loading && !error && gifs.length === 0 && (
              <p className="py-10 text-center text-xs text-[#5c6270]">
                {query ? "Nenhum GIF encontrado." : "Nenhum GIF em alta agora."}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {gifs.map(gif => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => choose(gif.url)}
                  title={gif.desc}
                  className="overflow-hidden rounded-lg transition-shadow hover:ring-2 hover:ring-[#5865F2]"
                >
                  <img
                    src={gif.preview || gif.url}
                    alt={gif.desc || "GIF"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
          <a
            href="https://klipy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[10px] text-[#8b8e9b] transition-colors hover:text-[#171923]"
          >
            Powered by KLIPY
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4">
        <h2 className="text-base font-bold">Selecione uma imagem</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid size-8 place-items-center rounded-lg text-[#5c6270] transition-colors hover:bg-black/5 hover:text-[#171923]"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="space-y-6 px-5 pb-5">
        <div className="grid grid-cols-2 gap-3">
          <SourceCard
            onClick={() => fileRef.current?.click()}
            icon={<ImagePlus className="size-6" aria-hidden />}
            label="Enviar imagem"
          />
          <SourceCard
            onClick={() => setMode("gifs")}
            icon={<Clapperboard className="size-6" aria-hidden />}
            label="Escolher GIF"
            badge="GIF"
            preview={preview ? preview.preview || preview.url : null}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Enviar imagem"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
            onClose();
          }}
        />

        <section>
          <h3 className="text-sm font-bold">Avatares Recentes</h3>
          <p className="mt-0.5 text-xs text-[#5c6270]">
            Acesse seus envios de Avatar mais recentes.
          </p>
          {recents.length === 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-black/15 p-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f0f1f5] text-[#9aa0b0]">
                <UserRound className="size-5" aria-hidden />
              </span>
              <p className="text-xs leading-4 text-[#5c6270]">
                Você ainda não enviou nenhum avatar. Os seus últimos envios ficam
                guardados aqui para você voltar a eles.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {recents.map(url => (
                <button
                  key={url}
                  type="button"
                  onClick={() => choose(url)}
                  aria-label="Usar este avatar"
                  aria-pressed={url === current}
                  className={cn(
                    "size-14 overflow-hidden rounded-full border-2 transition-colors",
                    url === current
                      ? "border-[#5865F2]"
                      : "border-transparent hover:border-black/25",
                  )}
                >
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function SourceCard({
  onClick,
  icon,
  label,
  badge,
  preview,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  preview?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-[190px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#f0f1f5] text-[#2b2f3a] transition-colors hover:bg-[#e5e7ef]"
    >
      {preview && (
        <img
          src={preview}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover opacity-80"
        />
      )}
      {badge && (
        <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white">
          {badge}
        </span>
      )}
      <span className={cn("relative z-10", preview && "text-white drop-shadow")}>
        {icon}
      </span>
      <span
        className={cn(
          "relative z-10 text-sm font-bold",
          preview ? "text-white drop-shadow" : "text-[#2b2f3a]",
        )}
      >
        {label}
      </span>
    </button>
  );
}
