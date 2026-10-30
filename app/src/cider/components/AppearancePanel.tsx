/**
 * Aparência: escolha de tema, editor visual de tokens e controles de cor.
 *
 * É a mesma mecânica do desktop — cartões de tema com amostras reais, editor de
 * tokens com pré-visualização ao vivo, presets de destaque, importar/exportar
 * JSON —, com uma diferença de armazenamento: os temas do usuário ficam no
 * `localStorage`, não em SQLite. Nada sai da máquina.
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Check, Download, FileJson, Palette, RotateCcw, Save, Trash2, Upload } from "lucide-react";

import { ACCENT_PRESETS, DESIGN_TOKENS, TOKEN_GROUPS, defaultTokenValues, numericToken } from "../settings/designTokens";
import { useCiderSettings } from "../settings/store";
import type { AppearanceTheme } from "../settings/themes";
import { Button, Field, Modal, Slider, Switch } from "./primitives";

const CARD_SWATCHES = ["--cider-bg", "--cider-accent", "--cider-accent-secondary", "--cider-text"] as const;

export function AppearanceSettings() {
  const settings = useCiderSettings((state) => state.settings);
  const themes = useCiderSettings((state) => state.themes);
  const selectTheme = useCiderSettings((state) => state.selectTheme);
  const patch = useCiderSettings((state) => state.patch);
  const apply = useCiderSettings((state) => state.apply);

  const builtins = themes.filter((theme) => theme.builtin);
  const custom = themes.filter((theme) => !theme.builtin);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const importTheme = useCiderSettings((state) => state.importTheme);
  const exportTheme = useCiderSettings((state) => state.exportTheme);
  const deleteTheme = useCiderSettings((state) => state.deleteTheme);
  const [message, setMessage] = useState<string | null>(null);

  // O cartão de tema abriga os chips Exportar/Apagar, então ele não pode ser um
  // `<button>`: `<button>` dentro de `<button>` é HTML inválido, o React avisa
  // no console e o leitor de tela anuncia dois controles aninhados.
  // `role="button"` + teclado devolve a mesma interação, com os chips como
  // botões de verdade por cima.
  const cardKeyDown = (themeId: string) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectTheme(themeId);
  };

  const download = (name: string, text: string) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCurrent = (theme: AppearanceTheme) => {
    try {
      download(`${theme.name.replace(/[^\w.-]+/g, "-").toLowerCase()}.cider-theme.json`, exportTheme(theme.id));
      setMessage(`Tema “${theme.name}” exportado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao exportar o tema");
    }
  };

  return (
    <>
      <div className="setting-group">
        <h3>Tema</h3>
        <p className="group-hint">
          Os temas embutidos são os mesmos do Cider 2 desktop — mesmos tokens, mesma paleta. Um tema
          define cores, vidro, formas e pode trazer CSS próprio.
        </p>

        <div className="theme-grid">
          {[
            { id: "auto", name: "Automático", description: "Segue o claro/escuro do sistema operacional." },
            { id: "dark", name: "Escuro", description: "Base escura padrão do Cider 2." },
            { id: "light", name: "Claro", description: "Base clara com contraste alto." },
          ].map((entry) => (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              className="theme-card"
              aria-pressed={settings.theme === entry.id}
              onClick={() => selectTheme(entry.id)}
              onKeyDown={cardKeyDown(entry.id)}
            >
              <div className="swatches">
                {entry.id === "light" ? (
                  <>
                    <span style={{ background: "#f7f7fa" }} />
                    <span style={{ background: "#ffffff" }} />
                    <span style={{ background: "#e0414f" }} />
                  </>
                ) : (
                  <>
                    <span style={{ background: "#0b0a12" }} />
                    <span style={{ background: "#15131f" }} />
                    <span style={{ background: "#ff5f6d" }} />
                  </>
                )}
              </div>
              <span className="theme-name">
                {entry.name}
                {settings.theme === entry.id ? <Check size={13} /> : null}
              </span>
              <span className="theme-desc">{entry.description}</span>
            </div>
          ))}

          {[...builtins, ...custom].map((theme) => (
            <div
              key={theme.id}
              role="button"
              tabIndex={0}
              className="theme-card"
              aria-pressed={settings.theme === theme.id}
              onClick={() => selectTheme(theme.id)}
              onKeyDown={cardKeyDown(theme.id)}
            >
              <div className="swatches">
                {CARD_SWATCHES.map((variable) => (
                  <span
                    key={variable}
                    style={{ background: theme.tokens?.[variable] ?? "transparent" }}
                    title={`${variable}: ${theme.tokens?.[variable] ?? "não definido"}`}
                  />
                ))}
              </div>
              <span className="theme-name">
                {theme.name} {theme.builtin ? <span className="badge">embutido</span> : <span className="badge accent">seu</span>}
              </span>
              <span className="theme-desc">
                {theme.description ?? (theme.mode === "light" ? "Tema claro" : "Tema escuro")}
              </span>
              <div className="chip-row">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Download size={13} />}
                  onClick={(event) => {
                    event.stopPropagation();
                    exportCurrent(theme);
                  }}
                >
                  Exportar
                </Button>
                {theme.builtin ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={13} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteTheme(theme.id);
                      setMessage(`Tema “${theme.name}” apagado.`);
                    }}
                  >
                    Apagar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="inline mt-4">
          <Button icon={<Upload size={15} />} onClick={() => setImportOpen(true)}>
            Importar tema (JSON)
          </Button>
          <span className="xsmall faint">
            A importação valida prefixo (`--cider-`), tamanho e recusa `url()`/`@import`.
          </span>
        </div>

        {message ? <p className="xsmall faint">{message}</p> : null}
      </div>

      <ThemeEditor />

      <div className="setting-group">
        <h3>Cores e vidro</h3>
        <div className="setting-row stacked">
          <div className="setting-label">
            <span className="label">Cor de destaque</span>
            <span className="desc">Usada em botões, seleção e realces. Os presets são os do desktop.</span>
          </div>
          <div className="setting-control left wrap">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="chip"
                aria-pressed={
                  settings.accent.toLowerCase() === preset.accent.toLowerCase() &&
                  settings.accentSecondary.toLowerCase() === preset.secondary.toLowerCase()
                }
                onClick={() => patch({ accent: preset.accent, accentSecondary: preset.secondary })}
                title={`${preset.accent} / ${preset.secondary}`}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 34,
                    height: 12,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${preset.accent}, ${preset.secondary})`,
                    marginRight: 6,
                  }}
                />
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row stacked">
          <div className="setting-label">
            <span className="label">Destaque personalizado</span>
          </div>
          <div className="setting-control left">
            <div className="color-input">
              <input
                type="color"
                value={settings.accent}
                aria-label="Destaque primário"
                onChange={(event) => patch({ accent: event.target.value })}
              />
              <input
                className="input"
                value={settings.accent}
                aria-label="Destaque primário (texto)"
                onChange={(event) => patch({ accent: event.target.value })}
              />
            </div>
            <div className="color-input">
              <input
                type="color"
                value={settings.accentSecondary}
                aria-label="Destaque secundário"
                onChange={(event) => patch({ accentSecondary: event.target.value })}
              />
              <input
                className="input"
                value={settings.accentSecondary}
                aria-label="Destaque secundário (texto)"
                onChange={(event) => patch({ accentSecondary: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Transparência das superfícies</span>
            <span className="desc">Quanto do fundo aparece através das barras e painéis.</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Transparência"
              value={settings.transparency}
              min={0.4}
              max={1}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(value) => patch({ transparency: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Desfoque do vidro</span>
            <span className="desc">Valores altos custam GPU. Em máquinas modestas, use 0–16 px.</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Desfoque"
              value={settings.glassBlur}
              min={0}
              max={80}
              step={2}
              format={(value) => `${value} px`}
              onChange={(value) => patch({ glassBlur: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Efeito de vidro</span>
            <span className="desc">Desliga todo o desfoque de uma vez.</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Efeito de vidro"
              checked={settings.glass}
              onChange={(value) => patch({ glass: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Intensidade das sombras</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Sombras"
              value={settings.shadowIntensity}
              min={0}
              max={2}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(value) => patch({ shadowIntensity: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Opacidade das bordas</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Bordas"
              value={settings.borderOpacity}
              min={0}
              max={0.6}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(value) => patch({ borderOpacity: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Cores da capa atual</span>
            <span className="desc">
              O destaque acompanha a paleta da capa que está tocando. A cor é extraída no seu
              navegador, sem enviar a imagem para lugar nenhum.
            </span>
          </div>
          <div className="setting-control">
            <Switch
              label="Cores da capa"
              checked={settings.themeFollowCover}
              onChange={(value) => {
                patch({ themeFollowCover: value });
                // Ao desligar, o destaque volta na hora para o configurado.
                if (!value) apply();
              }}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Ambiente luminoso</span>
            <span className="desc">Um brilho suave da capa ao fundo do aplicativo.</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Ambiente luminoso"
              checked={settings.coverAmbient}
              onChange={(value) => patch({ coverAmbient: value })}
            />
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>Escalas e tipografia</h3>
        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Fonte da interface</span>
          </div>
          <div className="setting-control">
            <select
              className="select"
              value={settings.fontFamily}
              onChange={(event) => patch({ fontFamily: event.target.value })}
            >
              <option value="system">Sistema (recomendado)</option>
              <option value="humanist">Humanista (Inter/Cantarell)</option>
              <option value="rounded">Arredondada</option>
              <option value="serif">Serifada</option>
              <option value="mono">Monoespaçada</option>
            </select>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Escala da fonte</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Escala da fonte"
              value={settings.fontScale}
              min={0.8}
              max={1.4}
              step={0.02}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(value) => patch({ fontScale: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Arredondamento</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Arredondamento"
              value={settings.radiusScale}
              min={0}
              max={2}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(value) => patch({ radiusScale: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Densidade</span>
            <span className="desc">Compacta reduz a altura das barras; espaçosa aumenta.</span>
          </div>
          <div className="setting-control">
            <div className="segmented" role="group" aria-label="Densidade">
              {(
                [
                  ["comfortable", "Confortável"],
                  ["compact", "Compacta"],
                  ["spacious", "Espaçosa"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.density === value}
                  onClick={() => patch({ density: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Animações</span>
          </div>
          <div className="setting-control">
            <div className="segmented" role="group" aria-label="Animações">
              {(
                [
                  ["full", "Completas"],
                  ["reduced", "Reduzidas"],
                  ["off", "Desligadas"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.animations === value}
                  onClick={() => patch({ animations: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Velocidade das animações</span>
            <span className="desc">Só vale com as animações completas.</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Velocidade"
              value={settings.animationSpeed}
              min={0.25}
              max={3}
              step={0.05}
              format={(value) => `${value.toFixed(2)}×`}
              disabled={settings.animations !== "full"}
              onChange={(value) => patch({ animationSpeed: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Reduzir movimento</span>
            <span className="desc">Respeita também a preferência de acessibilidade do sistema.</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Reduzir movimento"
              checked={settings.reduceMotion}
              onChange={(value) => patch({ reduceMotion: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Modo econômico</span>
            <span className="desc">
              Desliga desfoques e sombras caras — útil em máquinas modestas ou quando a rolagem
              engasga.
            </span>
          </div>
          <div className="setting-control">
            <div className="segmented" role="group" aria-label="Modo de desempenho">
              {(
                [
                  ["balanced", "Equilibrado"],
                  ["economy", "Econômico"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.performance === value}
                  onClick={() => patch({ performance: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={importOpen}
        title="Importar tema (JSON)"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon={<FileJson size={15} />}
              onClick={() => {
                try {
                  const theme = importTheme(importText);
                  setMessage(`Tema “${theme.name}” importado.`);
                  setImportText("");
                  setImportOpen(false);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Falha ao importar o tema");
                }
              }}
            >
              Importar
            </Button>
          </>
        }
      >
        <Field label="Conteúdo do arquivo .cider-theme.json" hint="Cole o JSON de um tema exportado.">
          <textarea
            className="textarea"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='{ "id": "meu-tema", "name": "Meu tema", "tokens": { "--cider-accent": "#ff0" } }'
          />
        </Field>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Editor visual de tokens                                            *
 * ------------------------------------------------------------------ */

function ThemeEditor() {
  const settings = useCiderSettings((state) => state.settings);
  const themes = useCiderSettings((state) => state.themes);
  const saveTheme = useCiderSettings((state) => state.saveTheme);
  const createTheme = useCiderSettings((state) => state.createTheme);
  const apply = useCiderSettings((state) => state.apply);

  const activeTheme = themes.find((theme) => theme.id === settings.theme);
  const [draft, setDraft] = useState<Record<string, string>>(activeTheme?.tokens ?? {});
  const [live, setLive] = useState(true);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Trocar de tema no editor recarrega o rascunho. É um ajuste **durante a
  // renderização** (o padrão documentado do React para estado derivado de prop)
  // e não um efeito: um efeito aqui pintaria o rascunho antigo por um quadro
  // antes de corrigir, e o usuário poderia salvar o tema errado.
  const [editedTheme, setEditedTheme] = useState(settings.theme);
  if (editedTheme !== settings.theme) {
    setEditedTheme(settings.theme);
    setDraft(activeTheme?.tokens ?? {});
  }

  const draftEntries = useMemo(
    () => Object.entries(draft).filter(([, value]) => Boolean(value)),
    [draft],
  );

  // Pré-visualização real: escreve as variáveis no elemento raiz e restaura ao
  // sair. É o mesmo mecanismo que aplica o tema — nada de iframe de amostra.
  useEffect(() => {
    if (!live || typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const written: string[] = [];
    for (const [key, value] of draftEntries) {
      if (!key.startsWith("--cider-")) continue;
      root.style.setProperty(key, value);
      written.push(key);
    }
    return () => {
      for (const key of written) root.style.removeProperty(key);
      apply();
    };
  }, [draftEntries, live, apply]);

  const setToken = (variable: string, value: string) => {
    setDraft((previous) => ({ ...previous, [variable]: value }));
  };

  const persist = () => {
    if (!activeTheme) return;
    try {
      const saved = saveTheme({ ...activeTheme, tokens: draft });
      setMessage(`Tema “${saved.name}” atualizado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar o tema");
    }
  };

  const saveAsNew = () => {
    try {
      const created = createTheme({
        name,
        mode: activeTheme?.mode ?? "dark",
        tokens: draft,
        basedOn: activeTheme?.id,
      });
      setMessage(`Tema “${created.name}” criado e aplicado.`);
      setName("");
      setNameOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar o tema");
    }
  };

  const canPersist = Boolean(activeTheme && !activeTheme.builtin);

  return (
    <div className="setting-group">
      <h3>Editor visual de temas</h3>
      <p className="group-hint">
        Ajuste as variáveis de design; a pré-visualização vale para o aplicativo inteiro. Só é
        possível salvar sobre um tema seu — um tema embutido nunca é sobrescrito, ele vira base de
        um novo.
      </p>

      <div className="inline">
        <Switch label="Pré-visualizar no aplicativo" checked={live} onChange={setLive} />
        <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => setDraft(activeTheme?.tokens ?? {})}>
          Reverter ao tema
        </Button>
        <Button
          size="sm"
          icon={<Palette size={14} />}
          onClick={() => setDraft(defaultTokenValues())}
        >
          Valores padrão do Cider
        </Button>
        <div className="grow" />
        <Button
          size="sm"
          variant="primary"
          icon={<Save size={14} />}
          disabled={!canPersist}
          onClick={persist}
        >
          {canPersist ? `Salvar em “${activeTheme?.name}”` : "Embutido: use “salvar como novo”"}
        </Button>
        <Button size="sm" onClick={() => setNameOpen(true)}>
          Salvar como novo…
        </Button>
      </div>

      <div className="editor-layout mt-4">
        <div>
          {TOKEN_GROUPS.map((group) => (
            <div className="token-group" key={group}>
              <h4>{group}</h4>
              {DESIGN_TOKENS.filter((token) => token.group === group).map((token) => (
                <TokenControl
                  key={token.variable}
                  variable={token.variable}
                  label={token.label}
                  kind={token.kind}
                  min={token.min}
                  max={token.max}
                  step={token.step}
                  unit={token.unit}
                  defaultValue={token.defaultValue}
                  value={draft[token.variable]}
                  onChange={setToken}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="preview-frame">
          <div className="preview-bar">
            <span className="badge accent">Pré-visualização</span>
            <span className="xsmall faint">tokens em edição</span>
          </div>
          <div
            className="preview-body"
            style={{
              background: draft["--cider-bg"] ?? "var(--cider-bg)",
              color: draft["--cider-text"] ?? "var(--cider-text)",
            }}
          >
            <div className="inline">
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: `calc(10px * ${numericToken(draft["--cider-radius-scale"], 1)})`,
                  background: `linear-gradient(135deg, ${draft["--cider-accent"] ?? "#ff5f6d"}, ${
                    draft["--cider-accent-secondary"] ?? "#7b5cff"
                  })`,
                }}
              />
              <div className="stack tight">
                <strong style={{ color: draft["--cider-text"] ?? undefined }}>Título da faixa</strong>
                <span style={{ color: draft["--cider-text-muted"] ?? undefined }}>Artista · Álbum</span>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: draft["--cider-surface-strong"] ?? "rgba(255,255,255,0.1)" }}>
              <div
                style={{
                  width: "62%",
                  height: "100%",
                  borderRadius: 999,
                  background: draft["--cider-accent"] ?? "#ff5f6d",
                }}
              />
            </div>
            <div className="inline">
              <span
                className="badge"
                style={{
                  background: draft["--cider-accent"] ?? "#ff5f6d",
                  color: draft["--cider-bg"] ?? "#0b0a12",
                  borderColor: "transparent",
                }}
              >
                Destaque
              </span>
              <span className="badge" style={{ borderColor: draft["--cider-border"] ?? undefined }}>
                Aviso
              </span>
            </div>
            <p style={{ color: draft["--cider-text-faint"] ?? undefined, fontSize: "var(--cider-text-xs)" }}>
              Este painel usa as variáveis em edição — o mesmo mecanismo aplica ao aplicativo
              inteiro.
            </p>
          </div>
        </div>
      </div>

      {message ? <p className="xsmall faint">{message}</p> : null}

      <Modal
        open={nameOpen}
        title="Salvar como novo tema"
        onClose={() => setNameOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNameOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!name.trim()} onClick={saveAsNew}>
              Criar tema
            </Button>
          </>
        }
      >
        <Field label="Nome do tema" hint="Até 60 caracteres; o id é gerado sozinho.">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>
      </Modal>
    </div>
  );
}

function TokenControl({
  variable,
  label,
  kind,
  min,
  max,
  step,
  unit,
  defaultValue,
  value,
  onChange,
}: {
  variable: string;
  label: string;
  kind: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  defaultValue: string;
  value?: string;
  onChange: (variable: string, value: string) => void;
}) {
  const current = value ?? defaultValue;
  const numeric = kind === "slider" || kind === "number";
  const parsed = numericToken(current, numericToken(defaultValue, 0));

  return (
    <div className="token-row">
      <span className="token-name" title={variable}>
        {label}
      </span>
      {kind === "color" ? (
        <div className="color-input">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#000000"}
            aria-label={label}
            onChange={(event) => onChange(variable, event.target.value)}
          />
          <input
            className="input"
            value={current}
            aria-label={`${label} (texto)`}
            onChange={(event) => onChange(variable, event.target.value)}
          />
        </div>
      ) : numeric ? (
        <Slider
          label={label}
          min={min ?? 0}
          max={max ?? 100}
          step={step ?? 1}
          value={parsed}
          format={(next) => `${next}${unit ?? ""}`}
          onChange={(next) => onChange(variable, `${next}${unit ?? ""}`)}
        />
      ) : (
        <input
          className="input"
          value={current}
          aria-label={label}
          onChange={(event) => onChange(variable, event.target.value)}
        />
      )}
    </div>
  );
}
