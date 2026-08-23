import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/endpoints";

export function CreateServerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = trpc.server.create.useMutation({
    onSuccess: async data => {
      await utils.server.list.invalidate();
      onOpenChange(false);
      setName("");
      setDescription("");
      setIconUrl(null);
      navigate(`/channels/${data.server.id}/first`);
    },
    onError: e => toast.error(e.message),
  });

  const uploadIcon = async (file: File) => {
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
      if (!res.ok) throw new Error(data.error ?? "Falha no upload");
      setIconUrl(data.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Criar servidor
          </DialogTitle>
          <DialogDescription className="text-center">
            Seu servidor é o lugar onde você e seus amigos conversam.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (name.trim())
              create.mutate({
                name: name.trim(),
                description: description.trim() || undefined,
                iconUrl: iconUrl ?? undefined,
              });
          }}
        >
          <div className="flex justify-center">
            <button
              type="button"
              className="relative h-20 w-20 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt="Ícone"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  <span className="text-[10px] font-semibold mt-1">
                    {uploading ? "ENVIANDO..." : "ENVIAR"}
                  </span>
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e =>
                e.target.files?.[0] && uploadIcon(e.target.files[0])
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-name">Nome do servidor</Label>
            <Input
              id="server-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Servidor incrível"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-desc">Descrição (opcional)</Label>
            <Textarea
              id="server-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Sobre o que é este servidor?"
              maxLength={500}
              rows={2}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={create.isPending || uploading}
          >
            {create.isPending ? "Criando..." : "Criar servidor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
