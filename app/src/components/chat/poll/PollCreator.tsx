import { useEffect, useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PollCreatorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    question: string;
    options: string[];
    allowMultiple: boolean;
    durationHours: number;
  }) => void;
  busy?: boolean;
};

const DURATIONS = [
  { value: 1, label: "1 hora" },
  { value: 4, label: "4 horas" },
  { value: 8, label: "8 horas" },
  { value: 24, label: "24 horas" },
  { value: 72, label: "3 dias" },
  { value: 168, label: "7 dias" },
];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export function PollCreator({
  open,
  onOpenChange,
  onSubmit,
  busy = false,
}: PollCreatorProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [durationHours, setDurationHours] = useState(24);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
      setDurationHours(24);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const trimmedOptions = options.map(o => o.trim());
  const validOptions = trimmedOptions.filter(o => o.length > 0);
  const questionValid = question.trim().length >= 3;
  const optionsValid =
    validOptions.length >= MIN_OPTIONS &&
    options.every(o => o.length <= 120) &&
    new Set(validOptions).size === validOptions.length;
  const canSubmit = questionValid && optionsValid && !busy;

  const updateOption = (index: number, value: string) => {
    if (value.length > 120) return;
    setOptions(prev => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOption = () => {
    setOptions(prev =>
      prev.length >= MAX_OPTIONS ? prev : [...prev, ""],
    );
  };

  const removeOption = (index: number) => {
    setOptions(prev =>
      prev.length <= MIN_OPTIONS ? prev : prev.filter((_, i) => i !== index),
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      question: question.trim(),
      options: validOptions,
      allowMultiple,
      durationHours,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-white/10 bg-[#24262c] text-white">
        <DialogHeader>
          <DialogTitle>Criar enquete</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="poll-question">Pergunta</Label>
            <Input
              id="poll-question"
              value={question}
              maxLength={300}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Faça uma pergunta..."
              className="min-h-[44px] border-white/10 bg-[#2b2d31]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Respostas</Label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  maxLength={120}
                  onChange={e => updateOption(index, e.target.value)}
                  placeholder={`Resposta ${index + 1}`}
                  className="min-h-[44px] border-white/10 bg-[#2b2d31]"
                  aria-label={`Resposta ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= MIN_OPTIONS}
                  aria-label={`Remover resposta ${index + 1}`}
                  className="text-white/60 hover:text-white disabled:opacity-30"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button
                type="button"
                variant="ghost"
                onClick={addOption}
                className="justify-start gap-2 text-[#5865F2] hover:bg-[#5865F2]/10 hover:text-[#5865F2]"
              >
                <Plus className="size-4" />
                Adicionar resposta
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Duração</Label>
            <Select
              value={String(durationHours)}
              onValueChange={v => setDurationHours(Number(v))}
            >
              <SelectTrigger className="w-full border-white/10 bg-[#2b2d31]">
                <SelectValue placeholder="Selecione a duração" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#24262c] text-white">
                {DURATIONS.map(d => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#2b2d31] p-3">
            <Label
              htmlFor="poll-multiple"
              className="cursor-pointer text-sm font-normal"
            >
              Permitir várias respostas
            </Label>
            <Switch
              id="poll-multiple"
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
          </div>
        </div>

        <DialogFooter className="mt-2 flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="border-white/10 hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-[#5865F2] text-white hover:bg-[#5865F2]/80"
          >
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Publicando...
              </>
            ) : (
              "Publicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
