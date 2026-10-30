import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreateCategoryModal({
  open,
  onOpenChange,
  serverId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"text" | "voice">("text");
  const create = trpc.server.createCategory.useMutation({
    onSuccess: () => {
      void utils.server.get.invalidate({ serverId });
      setName("");
      setKind("text");
      onOpenChange(false);
    },
    onError: error => toast.error(error.message),
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setName("");
      setKind("text");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar categoria</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            create.mutate({ serverId, name: trimmed, kind });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome da categoria</Label>
            <Input
              id="category-name"
              autoFocus
              value={name}
              onChange={event => setName(event.target.value)}
              maxLength={64}
              placeholder="Novos assuntos"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={value => setKind(value as "text" | "voice")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="voice">Voz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Criando..." : "Criar categoria"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
