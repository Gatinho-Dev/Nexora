import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hash, Volume2, MessagesSquare, Megaphone } from "lucide-react";
import { toast } from "sonner";
import type { CategoryDTO } from "@contracts/types";

export function CreateChannelModal({
  open,
  onOpenChange,
  serverId,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serverId: number;
  categories: CategoryDTO[];
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [type, setType] = useState<"TEXT" | "VOICE" | "FORUM" | "STAGE">("TEXT");
  const [categoryId, setCategoryId] = useState<string>("none");

  const create = trpc.server.createChannel.useMutation({
    onSuccess: () => {
      utils.server.get.invalidate();
      onOpenChange(false);
      setName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const relevantCategories = categories.filter((c) =>
    type === "VOICE" || type === "STAGE" ? c.kind === "voice" : c.kind === "text",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar canal</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate({
              serverId,
              name: name.trim(),
              type,
              categoryId: categoryId !== "none" ? Number(categoryId) : undefined,
            });
          }}
        >
          <div className="space-y-2">
            <Label>Tipo de canal</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) =>
                setType(v as "TEXT" | "VOICE" | "FORUM" | "STAGE")
              }
            >
              <label className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover">
                <RadioGroupItem value="TEXT" id="t-text" />
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Texto</div>
                  <div className="text-xs text-muted-foreground">
                    Mensagens, imagens, arquivos e reações
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover">
                <RadioGroupItem value="VOICE" id="t-voice" />
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Voz</div>
                  <div className="text-xs text-muted-foreground">
                    Áudio, vídeo e compartilhamento de tela
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover">
                <RadioGroupItem value="FORUM" id="t-forum" />
                <MessagesSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Fórum</div>
                  <div className="text-xs text-muted-foreground">
                    Publique posts e converse por tópicos, como um fórum
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-hover">
                <RadioGroupItem value="STAGE" id="t-stage" />
                <Megaphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Palco</div>
                  <div className="text-xs text-muted-foreground">
                    Audiência assiste e só quem for autorizado pode falar
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-name">Nome do canal</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "TEXT"
                  ? "novo-canal"
                  : type === "FORUM"
                    ? "novo-forum"
                    : type === "STAGE"
                      ? "Palco principal"
                      : "Sala de voz"
              }
              required
              maxLength={64}
            />
          </div>

          {relevantCategories.length > 0 && (
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {relevantCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Criando..." : "Criar canal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
