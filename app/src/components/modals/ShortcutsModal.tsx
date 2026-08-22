import { useEffect } from "react";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function ShortcutsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-[#2B2D31] border border-white/10 text-white rounded-2xl shadow-2xl select-none">
        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white mb-2">
          <Keyboard className="h-5 w-5 text-[#5865F2]" /> Atalhos da Nexora
        </DialogTitle>
        <div className="space-y-3 text-xs">
          <ShortcutRow label="Quick Switcher" keys={["Ctrl", "K"]} />
          <ShortcutRow label="Atalhos do Teclado" keys={["Ctrl", "/"]} />
          <ShortcutRow label="Enviar mensagem" keys={["ENTER"]} />
          <ShortcutRow
            label="Quebrar linha no chat"
            keys={["Shift", "ENTER"]}
          />
          <ShortcutRow
            label="Cancelar resposta / Fechar modal"
            keys={["ESC"]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
      <span className="text-[#B5BAC1] font-medium">{label}</span>
      <div className="flex gap-1">
        {keys.map(k => (
          <kbd
            key={k}
            className="px-2 py-0.5 rounded-md bg-[#313338] border border-white/10 font-mono text-[10px] font-bold text-white shadow-xs"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
