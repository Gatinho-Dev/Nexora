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
    changePassword.mutate({ currentPassword, newPassword });
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
            <div className="space-y-2">
              <Label htmlFor="cur-pass" className="text-xs text-muted2">
                Senha atual
              </Label>
              <Input
                id="cur-pass"
                type="password"
                className="border-black/20 bg-[#1E1F22] text-white"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pass" className="text-xs text-muted2">
                Nova senha
              </Label>
              <Input
                id="new-pass"
                type="password"
                className="border-black/20 bg-[#1E1F22] text-white"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf-pass" className="text-xs text-muted2">
                Confirmar nova senha
              </Label>
              <Input
                id="conf-pass"
                type="password"
                className="border-black/20 bg-[#1E1F22] text-white"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              className="bg-[#5865F2] font-medium text-white hover:bg-[#4752C4]"
              disabled={
                !currentPassword ||
                newPassword.length < 6 ||
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
