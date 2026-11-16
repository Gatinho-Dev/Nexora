/**
 * Nexora Bots - Template Picker
 * Galeria "Começar de um modelo" do assistente de criação de bots.
 */

import { memo, useMemo } from "react";
import { BOT_TEMPLATES } from "./botTemplates";
import { renderIcon } from "@/components/flow/nodes/flowIcons";

export type TemplateChoice = string | "blank";

interface BotTemplatePickerProps {
  selectedId: TemplateChoice | null;
  onSelect: (id: TemplateChoice) => void;
}

export const BotTemplatePicker = memo(function BotTemplatePicker({
  selectedId,
  onSelect,
}: BotTemplatePickerProps) {
  const nodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const template of BOT_TEMPLATES) {
      try {
        counts.set(template.id, template.build().nodes.length);
      } catch {
        counts.set(template.id, 0);
      }
    }
    return counts;
  }, []);

  return (
    <div role="radiogroup" aria-label="Escolha um ponto de partida">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Começar do zero */}
        <button
          type="button"
          role="radio"
          aria-checked={selectedId === "blank"}
          onClick={() => onSelect("blank")}
          className={`group flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all duration-fast ${
            selectedId === "blank"
              ? "border-primary-500 bg-primary-500/10"
              : "border-surface-border hover:border-surface-border-strong hover:bg-surface-hover/50"
          }`}
        >
          <span
            className={`p-2 rounded-lg ${
              selectedId === "blank"
                ? "bg-primary-500 text-white"
                : "bg-surface-tertiary text-text-secondary group-hover:text-text-primary"
            }`}
          >
            {renderIcon("Plus", 20)}
          </span>
          <span className="font-medium text-text-primary">Começar do zero</span>
          <span className="text-xs text-text-tertiary leading-relaxed">
            Tela em branco: arraste os nós que quiser e monte o fluxo do seu
            jeito.
          </span>
          <span className="text-xs font-medium text-text-tertiary">
            0 nós
          </span>
        </button>

        {/* Modelos prontos */}
        {BOT_TEMPLATES.map((template) => {
          const isSelected = selectedId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(template.id)}
              className={`group flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all duration-fast ${
                isSelected
                  ? "border-primary-500 bg-primary-500/10"
                  : "border-surface-border hover:border-surface-border-strong hover:bg-surface-hover/50"
              }`}
            >
              <span
                className={`p-2 rounded-lg ${
                  isSelected
                    ? "bg-primary-500 text-white"
                    : "bg-surface-tertiary text-text-secondary group-hover:text-text-primary"
                }`}
              >
                {renderIcon(template.icon, 20)}
              </span>
              <span className="font-medium text-text-primary">
                {template.name}
              </span>
              <span className="text-xs font-medium text-primary-500">
                {template.tagline}
              </span>
              <span className="text-xs text-text-tertiary leading-relaxed">
                {template.description}
              </span>
              <span className="text-xs font-medium text-text-tertiary">
                {nodeCounts.get(template.id) ?? 0} nós · pronto pra editar
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-tertiary mt-4 text-center">
        Dá pra trocar o texto, os tempos e os canais depois — o modelo é só o
        começo.
      </p>
    </div>
  );
});
