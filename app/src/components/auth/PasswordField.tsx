import { useState, type RefObject } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  disabled,
  inputRef,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wider text-muted2"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 rounded-lg border-black/20 bg-rail pr-12 text-base text-white"
        />
        <button
          type="button"
          onClick={() => setVisible(previous => !previous)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          disabled={disabled}
          className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted2 transition-colors hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
