import { useEffect, useMemo, useState } from "react";
import { Flag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ReportDialog,
} from "./ReportDialog";
import type { ReportTarget } from "./reportMeta";

export const OPEN_REPORT_EVENT = "nexora:open-report";

type ReportEventDetail = {
  type?: ReportTarget["type"];
  id?: number;
};

export function ReportHost() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [kind, setKind] = useState<"message" | "user">("message");
  const [idText, setIdText] = useState("");
  const [target, setTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<ReportEventDetail>).detail;
      if (
        detail?.type &&
        typeof detail.id === "number" &&
        Number.isSafeInteger(detail.id) &&
        detail.id > 0
      ) {
        setTarget({ type: detail.type, id: detail.id });
        return;
      }
      setKind("message");
      setIdText("");
      setPickerOpen(true);
    };
    window.addEventListener(OPEN_REPORT_EVENT, open);
    return () => window.removeEventListener(OPEN_REPORT_EVENT, open);
  }, []);

  const parsedId = useMemo(() => {
    const n = Number.parseInt(idText.trim(), 10);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }, [idText]);

  const continueToReport = () => {
    if (parsedId === null) return;
    setTarget({ type: kind, id: parsedId });
    setPickerOpen(false);
  };

  return (
    <>
      <Dialog
        open={pickerOpen}
        onOpenChange={v => {
          setPickerOpen(v);
          if (!v) setTarget(null);
        }}
      >
        <DialogContent className="top-auto bottom-0 left-[50%] max-h-[88dvh] w-full max-w-none translate-x-[-50%] translate-y-0 gap-0 overflow-y-auto rounded-t-2xl rounded-b-none border-white/10 bg-sidebar p-0 pb-[env(safe-area-inset-bottom)] text-white shadow-2xl duration-200 data-[state=open]:slide-in-from-bottom-8 sm:top-[50%] sm:max-h-[92dvh] sm:max-w-sm sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" />
          <DialogHeader className="gap-1 px-5 pt-5 text-left sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Flag className="h-4 w-4 text-red-400" aria-hidden />
              Denunciar
            </DialogTitle>
            <DialogDescription className="text-xs text-muted2">
              Cole o ID do que deseja denunciar. Dica: use “Copiar ID” no menu
              da mensagem ou do perfil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 py-4 sm:px-6">
            <Tabs value={kind} onValueChange={v => setKind(v as "message" | "user")}>
              <TabsList className="h-9 w-full bg-panel border border-white/10">
                <TabsTrigger value="message" className="flex-1 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white">
                  Mensagem
                </TabsTrigger>
                <TabsTrigger value="user" className="flex-1 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white">
                  Usuário
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              autoFocus
              inputMode="numeric"
              value={idText}
              onChange={e => setIdText(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={e => {
                if (e.key === "Enter") continueToReport();
              }}
              placeholder={
                kind === "message" ? "ID da mensagem" : "ID do usuário"
              }
              className="h-10 border-white/10 bg-panel text-sm text-white placeholder:text-faint focus-visible:border-[#5865F2]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-5 py-3.5 sm:px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPickerOpen(false)}
              className="h-9 rounded-lg px-4 text-sm text-muted2 hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={parsedId === null}
              onClick={continueToReport}
              className="h-9 rounded-lg bg-[#5865F2] px-5 text-sm font-semibold text-white hover:bg-[#4752C4] disabled:opacity-50"
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {target && (
        <ReportDialog
          open
          onOpenChange={() => setTarget(null)}
          target={target}
        />
      )}
    </>
  );
}
