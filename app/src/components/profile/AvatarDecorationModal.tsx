import { useState } from "react";
import { CircleSlash, Info, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { StyledDisplayName } from "@/components/profile/StyledDisplayName";
import {
  AVATAR_DECORATION_SECTIONS,
  getAvatarDecoration,
  getAvatarDecorationsBySection,
  type AvatarDecoration,
  type AvatarDecorationId,
} from "@/lib/avatarDecorations";
import type { NameStyle } from "@/lib/nameStyle";

/**
 * "Mudar decoração de avatar".
 *
 * Reproduz o modal do Discord: à esquerda as decorações agrupadas em "Suas
 * decorações" e "Exclusivo do Nexora", à direita a prévia grande da moldura
 * sobre o avatar real, a mesma moldura no contexto de uma conversa e o cartão
 * com o nome da decoração.
 *
 * Como no modal de estilo do nome, o editor trabalha numa cópia local e só
 * chama `onApply` no botão "Aplicar" — trocar de decoração não grava nada até
 * o usuário confirmar.
 */
export function AvatarDecorationModal({
  open,
  onOpenChange,
  value,
  displayName,
  username,
  avatar,
  nameStyle,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AvatarDecorationId;
  displayName: string;
  username: string;
  avatar: string;
  nameStyle: NameStyle;
  onApply: (decoration: AvatarDecorationId) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] w-[min(860px,calc(100vw-16px))] gap-0 overflow-hidden rounded-2xl border-black/20 bg-[#f4f5fb] p-0 text-[#171923] sm:max-w-[860px]"
      >
        <DialogTitle className="sr-only">Mudar decoração de avatar</DialogTitle>
        {/* O editor fica num componente à parte justamente para ser remontado a
            cada abertura: assim o rascunho nasce da decoração salva, sem efeito
            sincronizando os dois. */}
        <DecorationEditor
          value={value}
          displayName={displayName}
          username={username}
          avatar={avatar}
          nameStyle={nameStyle}
          onApply={onApply}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DecorationEditor({
  value,
  displayName,
  username,
  avatar,
  nameStyle,
  onApply,
  onClose,
}: {
  value: AvatarDecorationId;
  displayName: string;
  username: string;
  avatar: string;
  nameStyle: NameStyle;
  onApply: (decoration: AvatarDecorationId) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AvatarDecorationId>(value);
  const selected = getAvatarDecoration(draft);
  const changed = draft !== value;

  return (
    <>
      <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
        <h2 className="text-lg font-bold">Mudar decoração de avatar</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid size-8 place-items-center rounded-lg text-[#5c6270] transition-colors hover:bg-black/5 hover:text-[#171923]"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid min-h-0 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_300px]">
        {/* ── Coluna de escolhas ── */}
        <div className="space-y-5 p-5">
          {AVATAR_DECORATION_SECTIONS.map(section => (
            <section key={section.id}>
              <h3 className="mb-2 text-[13px] font-bold">{section.label}</h3>
              <div className="grid grid-cols-3 gap-2">
                {getAvatarDecorationsBySection(section.id).map(decoration => (
                  <DecorationTile
                    key={decoration.id}
                    decoration={decoration}
                    selected={draft === decoration.id}
                    name={displayName}
                    src={avatar}
                    onSelect={() => setDraft(decoration.id as AvatarDecorationId)}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="flex items-start gap-1.5 text-[11px] leading-4 text-[#5c6270]">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              A decoração aparece no seu avatar em todo o Nexora: no perfil, nas
              conversas e no servidor. Ela não muda a sua foto.
            </span>
          </p>
        </div>

        {/* ── Prévia ── */}
        <div className="flex flex-col gap-4 border-t border-black/10 bg-[#eceef7] p-5 md:border-l md:border-t-0">
          <div className="grid aspect-square place-items-center rounded-xl bg-[#e2e4f0]">
            <ProfileAvatar
              userId={undefined}
              name={displayName}
              src={avatar || null}
              decoration={draft}
              size="2xl"
              className="scale-[1.6]"
            />
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                userId={undefined}
                name={displayName}
                src={avatar || null}
                decoration={draft}
                size="lg"
              />
              <div className="min-w-0">
                <StyledDisplayName
                  font={nameStyle.font}
                  effect={nameStyle.effect}
                  colorA={nameStyle.colorA}
                  colorB={nameStyle.colorB}
                  className="text-base"
                >
                  {displayName || "Seu nome"}
                </StyledDisplayName>
                <p className="truncate text-[11px] text-[#5c6270]">
                  @{username || "usuario"}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-[#f4f5fb] px-2.5 py-1.5">
              <p className="text-[13px] font-bold">{selected.label}</p>
              <p className="text-[11px] text-[#5c6270]">{selected.note}</p>
            </div>
          </div>

          <div className="mt-auto flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1 bg-white text-[#171923] hover:bg-black/5"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!changed}
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="flex-1 bg-[#5865F2] text-white hover:bg-[#4752C4] disabled:bg-[#5865F2]/40"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function DecorationTile({
  decoration,
  selected,
  name,
  src,
  onSelect,
}: {
  decoration: AvatarDecoration;
  selected: boolean;
  name: string;
  src: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={decoration.label}
      className={
        selected
          ? "flex flex-col items-center gap-1.5 rounded-xl border-2 border-[#5865F2] bg-white px-2 py-3 transition-colors"
          : "flex flex-col items-center gap-1.5 rounded-xl border border-black/10 bg-white px-2 py-3 transition-colors hover:border-black/25"
      }
    >
      {decoration.id === "none" ? (
        <span className="grid size-20 place-items-center rounded-full border border-black/10">
          <CircleSlash className="size-6 text-[#6b6f7d]" aria-hidden />
        </span>
      ) : (
        <ProfileAvatar
          userId={undefined}
          name={name}
          src={src || null}
          decoration={decoration.id}
          size="xl"
        />
      )}
      <span className="truncate text-[10px] font-bold text-[#5c6270]">
        {decoration.label}
      </span>
    </button>
  );
}
