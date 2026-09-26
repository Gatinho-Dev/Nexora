import { useState } from "react";
import { Eye, Info, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StyledDisplayName } from "@/components/profile/StyledDisplayName";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  NAME_COLOR_SWATCHES,
  NAME_EFFECTS,
  NAME_FONTS,
  NAME_GRADIENT_PRESETS,
  randomNameStyle,
  type NameStyle,
} from "@/lib/nameStyle";
import { cn } from "@/lib/utils";

/**
 * "Alterar estilo do nome exibido".
 *
 * O modal edita uma cópia local e só chama `onApply` no fim, como no Discord:
 * o usuário experimenta fontes e cores sem sujar o perfil a cada clique, e o
 * botão "Aplicar" é o único ponto de confirmação.
 */
export function DisplayNameStyleModal({
  open,
  onOpenChange,
  value,
  displayName,
  username,
  avatar,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: NameStyle;
  displayName: string;
  username: string;
  avatar: string;
  onApply: (style: NameStyle) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] w-[min(860px,calc(100vw-16px))] gap-0 overflow-hidden rounded-2xl border-black/20 bg-[#f4f5fb] p-0 text-[#171923] sm:max-w-[860px]"
      >
        <DialogTitle className="sr-only">Alterar estilo do nome exibido</DialogTitle>
        {/* O editor fica num componente à parte justamente para ser remontado a
            cada abertura: assim o rascunho nasce do estilo salvo, sem efeito
            sincronizando os dois. */}
        <StyleEditor
          value={value}
          displayName={displayName}
          username={username}
          avatar={avatar}
          onApply={onApply}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function StyleEditor({
  value,
  displayName,
  username,
  avatar,
  onApply,
  onClose,
}: {
  value: NameStyle;
  displayName: string;
  username: string;
  avatar: string;
  onApply: (style: NameStyle) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<NameStyle>(value);
  const update = (patch: Partial<NameStyle>) =>
    setDraft(current => ({ ...current, ...patch }));

  return (
    <>
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="text-lg font-bold">Alterar estilo do nome exibido</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-8 place-items-center rounded-lg text-[#5c6270] transition-colors hover:bg-black/5 hover:text-[#171923]"
          >
            <Eye className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_300px]">
          {/* ── Coluna de escolhas ── */}
          <div className="space-y-5 p-5">
            <Section label="Escolha fonte" preview={<Eye className="size-3.5" />}>
              <div className="grid grid-cols-4 gap-2">
                {NAME_FONTS.map(font => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => update({ font: font.id })}
                    title={font.label}
                    aria-label={`Fonte ${font.label}`}
                    aria-pressed={draft.font === font.id}
                    className={cn(
                      "grid h-[60px] place-items-center rounded-xl border bg-white text-xl font-bold transition-colors",
                      draft.font === font.id
                        ? "border-[#5865F2] ring-2 ring-[#5865F2]/25"
                        : "border-black/10 hover:border-black/20"
                    )}
                  >
                    <span className={font.className}>{font.sample}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section
              label="Escolha efeito"
              preview={<Eye className="size-3.5" />}
              hint="Efeitos com ponto não usam a segunda cor."
            >
              <div className="grid grid-cols-4 gap-2">
                {NAME_EFFECTS.map(effect => {
                  const selected = draft.effect === effect.id;
                  return (
                    <button
                      key={effect.id}
                      type="button"
                      onClick={() => update({ effect: effect.id })}
                      aria-pressed={selected}
                      className={cn(
                        "relative grid h-[52px] place-items-center rounded-xl border bg-white px-1 text-center text-[11px] font-semibold transition-colors",
                        selected
                          ? "border-[#5865F2] ring-2 ring-[#5865F2]/25"
                          : "border-black/10 hover:border-black/20"
                      )}
                    >
                      {!effect.usesSecondColor && !selected && (
                        <span
                          className="absolute right-1.5 top-1.5 size-1 rounded-full bg-[#5865F2]"
                          aria-hidden="true"
                        />
                      )}
                      <StyledDisplayName
                        font={draft.font}
                        effect={effect.id}
                        colorA={draft.colorA}
                        colorB={draft.colorB}
                        className="text-[13px]"
                      >
                        {effect.label}
                      </StyledDisplayName>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section
              label="Escolha cor"
              preview={<Eye className="size-3.5" />}
            >
              <div className="space-y-3">
                {/* Barra de gradiente com as duas cores, como na referência. */}
                <div
                  className="relative h-[52px] overflow-hidden rounded-xl border border-black/10"
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${draft.colorA}, ${draft.colorB})`,
                  }}
                >
                  <label className="absolute inset-y-0 left-0 flex w-1/2 cursor-pointer items-center pl-3">
                    <input
                      type="color"
                      value={draft.colorA}
                      onChange={event => update({ colorA: event.target.value })}
                      className="sr-only"
                      aria-label="Primeira cor"
                    />
                    <span className="size-5 rounded-full border-2 border-white shadow" />
                  </label>
                  <label className="absolute inset-y-0 right-0 flex w-1/2 cursor-pointer items-center justify-end pr-3">
                    <input
                      type="color"
                      value={draft.colorB}
                      onChange={event => update({ colorB: event.target.value })}
                      className="sr-only"
                      aria-label="Segunda cor"
                    />
                    <span className="size-5 rounded-full border-2 border-white shadow" />
                  </label>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {NAME_COLOR_SWATCHES.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => update({ colorA: color })}
                      aria-label={`Usar a cor ${color}`}
                      aria-pressed={draft.colorA.toLowerCase() === color.toLowerCase()}
                      className={cn(
                        "h-9 rounded-lg border-2 transition-transform hover:scale-105",
                        draft.colorA.toLowerCase() === color.toLowerCase()
                          ? "border-[#5865F2]"
                          : "border-white/70"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {NAME_GRADIENT_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        update({ colorA: preset.from, colorB: preset.to })
                      }
                      className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] font-semibold transition-colors hover:border-black/25"
                    >
                      <span
                        className="size-4 shrink-0 rounded-full"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                        }}
                      />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          </div>

          {/* ── Prévia ao vivo ── */}
          <div className="flex flex-col gap-4 border-t border-black/10 bg-[#eceef7] p-5 md:border-l md:border-t-0">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  userId={undefined}
                  name={displayName}
                  src={avatar || null}
                  decoration="none"
                  size="lg"
                />
                <div className="min-w-0">
                  <StyledDisplayName
                    font={draft.font}
                    effect={draft.effect}
                    colorA={draft.colorA}
                    colorB={draft.colorB}
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
                <StyledDisplayName
                  font={draft.font}
                  effect={draft.effect}
                  colorA={draft.colorA}
                  colorB={draft.colorB}
                  className="text-[13px]"
                >
                  {displayName || "Seu nome"}
                </StyledDisplayName>
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-[11px] leading-4 text-[#5c6270]">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                Cores e efeitos do nome não aparecem para os outros. Eles também
                podem variar no Nexora e nos modos claro/escuro.
              </span>
            </p>

            <div className="mt-auto flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraft(randomNameStyle())}
                className="flex-1 bg-white text-[#171923] hover:bg-black/5"
              >
                <Sparkles className="mr-1.5 size-3.5" />
                Surpreenda-me
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
                className="flex-1 bg-[#5865F2] text-white hover:bg-[#4752C4]"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
    </>
  );
}

function Section({
  label,
  preview,
  hint,
  children,
}: {
  label: string;
  preview?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-[13px] font-bold">{label}</h3>
        {preview}
      </div>
      {hint ? (
        <p className="mb-2 text-[10px] text-[#6b7280]">{hint}</p>
      ) : null}
      {children}
    </section>
  );
}
