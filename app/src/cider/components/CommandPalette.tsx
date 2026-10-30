/**
 * Paleta de comandos (Ctrl+K).
 *
 * Mesmo papel do desktop: navegar, trocar tema e comandar o player sem tirar a
 * mão do teclado. Aqui ela também é o caminho mais curto para escolher um tema —
 * o que o usuário pediu —, porque cada tema aparece como um comando com o nome
 * exato.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Compass, ListMusic, MicVocal, Palette, Play, Search, Settings, SkipForward } from "lucide-react";

import { CIDER_NAV_ITEMS } from "../nav";
import { useCider } from "../useCider";
import { useCiderSettings } from "../settings/store";
import { useCiderUi } from "../ui";

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: typeof Search;
  run: () => void;
}

/**
 * A paleta só existe enquanto está aberta.
 *
 * Montar e desmontar (em vez de esconder) é o que zera o termo de busca e o
 * cursor entre uma abertura e outra — sem efeito de limpeza, que provocaria uma
 * renderização em cascata toda vez que a paleta fechasse.
 */
export function CiderCommandPalette() {
  const open = useCiderUi((state) => state.palette);
  if (!open) return null;
  return <PaletteBody />;
}

function PaletteBody() {
  const setPalette = useCiderUi((state) => state.setPalette);
  const setImmersive = useCiderUi((state) => state.setImmersive);
  const togglePanel = useCiderUi((state) => state.togglePanel);
  const { engine, state } = useCider();
  const themes = useCiderSettings((store) => store.themes);
  const selectTheme = useCiderSettings((store) => store.selectTheme);
  const navigate = useNavigate();

  const [term, setTerm] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = CIDER_NAV_ITEMS.map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      hint: "Ir para",
      icon: Compass,
      run: () => navigate(item.path),
    }));

    const themeCommands: Command[] = [
      { id: "theme-auto", label: "Tema: Automático", hint: "Aparência", icon: Palette, run: () => selectTheme("auto") },
      { id: "theme-dark", label: "Tema: Escuro", hint: "Aparência", icon: Palette, run: () => selectTheme("dark") },
      { id: "theme-light", label: "Tema: Claro", hint: "Aparência", icon: Palette, run: () => selectTheme("light") },
      ...themes.map((theme) => ({
        id: `theme-${theme.id}`,
        label: `Tema: ${theme.name}`,
        hint: theme.builtin ? "Embutido" : "Seu tema",
        icon: Palette,
        run: () => selectTheme(theme.id),
      })),
    ];

    const actions: Command[] = [
      {
        id: "playpause",
        label: state.phase === "playing" ? "Pausar" : "Reproduzir",
        hint: "Player",
        icon: Play,
        run: () => engine.toggle(),
      },
      { id: "next", label: "Próxima faixa", hint: "Player", icon: SkipForward, run: () => engine.next() },
      { id: "queue", label: "Alternar a fila", hint: "Painel", icon: ListMusic, run: () => togglePanel("queue") },
      { id: "lyrics", label: "Alternar as letras", hint: "Painel", icon: MicVocal, run: () => togglePanel("lyrics") },
      { id: "immersive", label: "Modo imersivo", hint: "Tela", icon: Play, run: () => setImmersive(true) },
      {
        id: "settings",
        label: "Abrir as configurações (Aparência)",
        hint: "Sistema",
        icon: Settings,
        run: () => navigate("/cider/configuracoes"),
      },
    ];

    return [...nav, ...themeCommands, ...actions];
  }, [engine, navigate, selectTheme, setImmersive, state.phase, themes, togglePanel]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const list = needle
      ? commands.filter((command) => command.label.toLowerCase().includes(needle))
      : commands;
    return list.slice(0, 40);
  }, [commands, term]);

  // O foco entra no campo assim que a paleta aparece, sem esperar o primeiro
  // clique: é uma paleta de teclado.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const runCommand = (command: Command) => {
    command.run();
    setPalette(false);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Paleta de comandos" onClick={() => setPalette(false)}>
      <div className="modal palette" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          value={term}
          placeholder="Buscar um comando, tema ou tela…"
          aria-label="Buscar comando"
          onChange={(event) => {
            setTerm(event.target.value);
            setCursor(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((value) => Math.min(filtered.length - 1, value + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((value) => Math.max(0, value - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const command = filtered[cursor];
              if (command) runCommand(command);
            } else if (event.key === "Escape") {
              // A paleta abre com o foco no campo (é uma paleta de teclado),
              // então sem isto o primeiro Esc só desfocava o campo e a paleta
              // continuava na tela — o desktop fecha no primeiro Esc.
              event.preventDefault();
              setPalette(false);
            }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 ? (
            <p className="small muted" style={{ padding: 12 }}>
              Nenhum comando com “{term}”.
            </p>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  className="palette-item"
                  data-selected={index === cursor ? "true" : "false"}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => runCommand(command)}
                >
                  <Icon size={16} />
                  <span>{command.label}</span>
                  <span className="palette-kind">{command.hint}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
