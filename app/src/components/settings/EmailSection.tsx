import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Loader2,
  Mail,
  MailCheck,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Configurações → Minha Conta → E-mail
 * Status, verificação/reenvio e alteração (com confirmação por e-mail).
 * O e-mail é opcional no Nexora — esta seção orienta quem não tem um.
 */
export function EmailSection() {
  const utils = trpc.useUtils();
  const status = trpc.account.emailStatus.useQuery();
  const totp = trpc.advanced.security.totp.useQuery();

  const [mode, setMode] = useState<"idle" | "change">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");

  const resend = trpc.account.resendVerification.useMutation({
    onSuccess: () => toast.success("Se houver um e-mail verificado a receber, o link foi reenviado."),
    onError: error => toast.error(error.message),
  });

  const change = trpc.account.requestEmailChange.useMutation({
    onSuccess: () => {
      toast.success(
        "Enviamos uma confirmação para o novo endereço. A alteração só vale após a confirmação.",
      );
      setMode("idle");
      setNewEmail("");
      setCurrentPassword("");
      setCode("");
      void utils.account.emailStatus.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (status.isLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-white/10 bg-sidebar p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  const email = status.data?.email ?? null;
  const verified = status.data?.verified ?? false;
  const pendingEmail = status.data?.pendingEmail ?? null;
  const requiresCode = totp.data?.enabled === true;
  const validNewEmail = EMAIL_PATTERN.test(newEmail.trim());

  const submitChange = () => {
    if (!validNewEmail || !currentPassword || change.isPending) return;
    change.mutate({
      email: newEmail.trim(),
      currentPassword,
      ...(requiresCode && code.trim() ? { code: code.trim() } : {}),
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-sidebar p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        <Mail className="h-4 w-4 text-[#7383FF]" aria-hidden />
        E-mail
      </h3>

      {!email ? (
        <p className="text-xs leading-5 text-muted2">
          Sua conta não tem um e-mail associado. Adicione um para usar
          verificação, recuperação de senha e alertas de segurança — isso não é
          obrigatório para usar o Nexora.
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-white">{email}</p>
          {verified ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-[#23A55A]">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Verificado
            </p>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#F0B232]">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                E-mail não verificado
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={resend.isPending}
                onClick={() => resend.mutate()}
                className="h-8 text-xs"
              >
                {resend.isPending && (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                )}
                Verificar agora
              </Button>
            </div>
          )}
          {pendingEmail && (
            <p className="text-[11px] text-muted2">
              Alteração pendente para{" "}
              <span className="text-[#b7beff]">{pendingEmail}</span> — confirme
              no novo endereço.
            </p>
          )}
        </div>
      )}

      {mode === "idle" ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setMode("change")}
          className="h-8 text-xs"
        >
          <Pencil className="mr-1 h-3 w-3" aria-hidden />
          {email ? "Alterar e-mail" : "Adicionar e-mail"}
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-chat p-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-email" className="text-xs text-muted2">
              Novo e-mail
            </Label>
            <Input
              id="new-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="border-white/10 bg-rail text-white"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              disabled={change.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-current-pass" className="text-xs text-muted2">
              Senha atual
            </Label>
            <Input
              id="email-current-pass"
              type="password"
              autoComplete="current-password"
              className="border-white/10 bg-rail text-white"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              disabled={change.isPending}
            />
          </div>
          {requiresCode && (
            <div className="space-y-1.5">
              <Label htmlFor="email-2fa" className="text-xs text-muted2">
                Código 2FA
              </Label>
              <Input
                id="email-2fa"
                inputMode="text"
                autoComplete="one-time-code"
                maxLength={32}
                placeholder="123456 ou código de backup"
                className="border-white/10 bg-rail text-white"
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={change.isPending}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={submitChange}
              disabled={!validNewEmail || !currentPassword || change.isPending}
              className="bg-[#5865F2] text-white hover:bg-[#4752C4]"
            >
              {change.isPending && (
                <Loader2 className="mr-1 size-3 animate-spin" aria-hidden />
              )}
              Continuar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMode("idle");
                setNewEmail("");
                setCurrentPassword("");
                setCode("");
              }}
              className="text-muted2 hover:text-white"
            >
              Cancelar
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] leading-4 text-muted2">
            <MailCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            O novo e-mail só substitui o atual depois de confirmado no novo
            endereço. Um aviso será enviado ao endereço anterior.
          </p>
        </div>
      )}
    </div>
  );
}
