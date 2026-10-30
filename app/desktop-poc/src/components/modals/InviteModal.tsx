import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

export function InviteModal({
  open,
  onOpenChange,
  serverId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serverId: number;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvite = trpc.server.createInvite.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const generate = () => {
    createInvite.mutate(
      { serverId },
      {
        onSuccess: (data) => {
          setInviteUrl(`${window.location.origin}/invite/${data.code}`);
          setCopied(false);
        },
      },
    );
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v && !inviteUrl) generate();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar pessoas</DialogTitle>
          <DialogDescription>
            Compartilhe este link para que outras pessoas entrem no servidor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            readOnly
            value={inviteUrl ?? "Gerando convite..."}
            className="font-mono text-sm"
            onFocus={(e) => e.target.select()}
          />
          <Button onClick={copy} disabled={!inviteUrl} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" /> O link não expira por padrão
          </span>
          <Button variant="ghost" size="sm" onClick={generate} disabled={createInvite.isPending}>
            Gerar novo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
