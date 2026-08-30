import { useState } from "react";
import { useNavigate } from "react-router";
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
  const [code, setCode] = useState("");

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
            if (c) {
              onOpenChange(false);
              setCode("");
              navigate(`/invite/${c}`);
            } else {
              toast.error("Informe um código de convite válido.");
            }
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
          <Button type="submit" className="w-full">
            Revisar convite
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
