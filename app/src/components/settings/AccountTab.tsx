import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/Avatar";
import { EmailSection } from "@/components/settings/EmailSection";
import { AccountDangerZone } from "@/components/settings/AccountDangerZone";
import { PasswordField } from "@/components/auth/PasswordField";
import {
  DiscordCard,
  DiscordInfoRow,
  DiscordPageHeader,
} from "@/components/settings/DiscordSettings";

/**
 * "Minha conta" — identidade, credenciais e a zona de risco.
 *
 * Nome de exibição e nome de usuário são editados inline (Enter salva, Esc
 * cancela) reaproveitando as mutations existentes em `account`.
 */
export function AccountTab() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [disconnectOthers, setDisconnectOthers] = useState(true);
  // Com 2FA ligado, trocar a senha exige o código — sem isso a rota volta o
  // erro do servidor depois do envio.
  const totp = trpc.advanced.security.totp.useQuery();
  const requiresCode = totp.data?.enabled === true;
  const [editingField, setEditingField] = useState<"name" | "username" | null>(
    null
  );
  const [draft, setDraft] = useState("");

  const changePassword = trpc.account.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCode("");
    },
    onError: e => toast.error(e.message),
  });
  const updateProfile = trpc.account.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Nome de exibição atualizado.");
      setEditingField(null);
    },
    onError: e => toast.error(e.message),
  });
  const setUsername = trpc.account.setUsername.useMutation({
    onSuccess: () => {
      toast.success("Nome de usuário atualizado.");
      setEditingField(null);
    },
    onError: e => toast.error(e.message),
  });

  const submit = () => {
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não corresponde à nova senha.");
      return;
    }
    changePassword.mutate({
      currentPassword,
      newPassword,
      disconnectOthers,
      ...(requiresCode && code.trim() ? { code: code.trim() } : {}),
    });
  };

  const saveInlineField = () => {
    const value = draft.trim();
    if (!value) return;
    if (editingField === "name") updateProfile.mutate({ displayName: value });
    else if (editingField === "username") setUsername.mutate({ username: value });
  };

  return (
    <div className="space-y-6">
      <DiscordPageHeader
        title="Minha conta"
        description="Gerencie suas credenciais e segurança de acesso à Nexora."
      />

      <div className="flex items-center gap-4 rounded-lg border border-black/15 bg-[#232428] p-4">
        <Avatar
          userId={user?.id}
          name={user?.name}
          src={user?.avatar}
          size="lg"
          showStatus={false}
        />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{user?.name}</p>
          <p className="truncate text-xs text-muted2">
            @{user?.username ?? "usuario-nexora"}
          </p>
        </div>
      </div>

      <section className="divide-y divide-black/20 overflow-hidden rounded-lg border border-black/15 bg-[#232428]">
        <DiscordInfoRow
          label="Nome de exibição"
          value={user?.name ?? ""}
          actionDisabled={updateProfile.isPending}
          onAction={() => {
            setEditingField("name");
            setDraft(user?.name ?? "");
          }}
        />
        <DiscordInfoRow
          label="Nome de usuário"
          value={`@${user?.username ?? ""}`}
          actionDisabled={setUsername.isPending}
          onAction={() => {
            setEditingField("username");
            setDraft(user?.username ?? "");
          }}
        />
        {editingField ? (
          <div className="space-y-2 p-4">
            <label
              htmlFor="account-inline-edit"
              className="text-[11px] font-semibold text-[#949BA4]"
            >
              {editingField === "name"
                ? "Novo nome de exibição (aceita emojis, até 64 caracteres)"
                : "Novo nome de usuário (alfanumérico)"}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="account-inline-edit"
                value={draft}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveInlineField();
                  }
                  if (e.key === "Escape") setEditingField(null);
                }}
                className="border-black/20 bg-[#1E1F22] text-white"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveInlineField}
                  className="bg-[#5865F2] text-white hover:bg-[#4752C4]"
                >
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingField(null)}
                  className="bg-[#4E5058] text-white hover:bg-[#6D6F78]"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <EmailSection />

      {user?.username ? (
        <DiscordCard
          title="Alterar senha"
          description="Exigimos a senha atual para confirmar que é você."
        >
          <div className="space-y-3 px-4 py-2">
            <PasswordField
              id="cur-pass"
              label="Senha atual"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              disabled={changePassword.isPending}
            />
            <PasswordField
              id="new-pass"
              label="Nova senha"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              hint="Use pelo menos 6 caracteres."
              disabled={changePassword.isPending}
            />
            <PasswordField
              id="conf-pass"
              label="Confirmar nova senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={changePassword.isPending}
            />
            {requiresCode && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="change-password-2fa"
                  className="text-xs font-semibold uppercase tracking-wider text-muted2"
                >
                  Código 2FA ou código de backup
                </Label>
                <Input
                  id="change-password-2fa"
                  inputMode="text"
                  autoComplete="one-time-code"
                  maxLength={32}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="h-12 rounded-lg border-black/20 bg-[#1E1F22] text-base text-white"
                  disabled={changePassword.isPending}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-muted2">
              <input
                type="checkbox"
                checked={disconnectOthers}
                onChange={event => setDisconnectOthers(event.target.checked)}
                className="size-4 accent-[#5865F2]"
              />
              Encerrar todas as outras sessões após alterar a senha
            </label>
            <Button
              className="bg-[#5865F2] font-medium text-white hover:bg-[#4752C4]"
              disabled={
                !currentPassword ||
                newPassword.length < 6 ||
                (requiresCode && !code.trim()) ||
                changePassword.isPending
              }
              onClick={submit}
            >
              {changePassword.isPending ? "Salvando..." : "Alterar senha"}
            </Button>
          </div>
        </DiscordCard>
      ) : (
        <p className="text-xs text-muted2">
          Esta conta utiliza autenticação externa da plataforma.
        </p>
      )}

      <AccountDangerZone />
    </div>
  );
}
