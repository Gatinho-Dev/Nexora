import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function JoinServerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [code, setCode] = useState("");

  const join = trpc.server.joinByCode.useMutation({
    onSuccess: async (data) => {
      await utils.server.list.invalidate();
      onOpenChange(false);
      setCode("");
      navigate(`/channels/${data.serverId}/first`);
    },
    onError: (e) => toast.error(e.message),
  });

  const extractCode = (value: string) => {
    // Accept both raw codes and full invite URLs
    const match = value.match(/(?:invite\/)?([A-Za-z0-9_-]{6,32})\s*$/);
    return match ? match[1] : value.trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Entrar em um servidor</DialogTitle>
          <DialogDescription className="text-center">
            Cole um código ou link de convite para entrar.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const c = extractCode(code);
            if (c) join.mutate({ code: c });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-code">Código ou link de convite</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD123 ou /invite/ABCD123"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={join.isPending}>
            {join.isPending ? "Entrando..." : "Entrar no servidor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
