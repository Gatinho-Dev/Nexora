/**
 * Nexora Bots - Bot Editor Modal
 * Assistente de criação/edição em 3 passos: Modelo → Detalhes → Montar.
 * Modos Simple (fluxo visual) e Advanced (código).
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider } from 'reactflow';
import type {
  Bot,
  BotMode,
  BotFlow,
  NodeDefinition,
  ValidationError,
} from '@/contracts/bots';
import { BotFlowEditor } from '@/components/flow/BotFlowEditor';
import { renderIcon } from '@/components/flow/nodes/flowIcons';
import { getBotTemplate } from './botTemplates';
import { BotTemplatePicker, type TemplateChoice } from './BotTemplatePicker';

// ============================================
// Avatar Upload
// ============================================

const AvatarUpload = memo(function AvatarUpload({
  src,
  onChange,
  onRemove,
  size = 80,
}: {
  src: string | null;
  onChange: (url: string | null) => void;
  onRemove: () => void;
  size?: number;
}) {
  const [preview, setPreview] = useState<string | null>(src);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(src);
  }, [src]);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setPreview(url);
        onChange(url);
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      e.target.value = '';
    },
    [handleFileSelect]
  );

  const handleRemove = useCallback(() => {
    setPreview(null);
    onRemove();
  }, [onRemove]);

  const handleUrlPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData('text');
      if (text.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
        e.preventDefault();
        setPreview(text);
        onChange(text);
      }
    },
    [onChange]
  );

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handleUrlPaste}
        className={`relative rounded-xl overflow-hidden border-2 transition-all duration-fast cursor-pointer ${
          dragging
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-surface-border hover:border-primary-500/50'
        }`}
        style={{ width: size, height: size }}
        role="button"
        tabIndex={0}
        aria-label={src ? 'Change avatar' : 'Upload avatar'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 items-center justify-center opacity-0 hover:opacity-100 focus-within:opacity-100 hidden group-hover:flex">
              <span className="text-white text-sm font-medium">Change</span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-tertiary bg-surface-tertiary">
            {renderIcon('Image', 24)}
            <span className="text-xs mt-1">Upload Avatar</span>
            <span className="text-xs text-text-tertiary/50 mt-0.5">Click or drag & drop</span>
          </div>
        )}

        {src && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="absolute top-1 right-1 p-1 rounded-full bg-danger-500/90 text-white hover:bg-danger-500 transition-colors"
            aria-label="Remove avatar"
          >
            {renderIcon('X', 12)}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>
    </div>
  );
});

// ============================================
// Mode Selector (Pills)
// ============================================

const ModeSelector = memo(function ModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: BotMode;
  onChange: (mode: BotMode) => void;
  disabled?: boolean;
}) {
  const modes: { value: BotMode; label: string; icon: string; description: string }[] = [
    {
      value: 'simple',
      label: 'Visual',
      icon: 'Zap',
      description: 'Arraste nós e ligue o fluxo sem escrever código',
    },
    {
      value: 'advanced',
      label: 'Código',
      icon: 'Code2',
      description: 'TypeScript direto, controle total do comportamento',
    },
  ];

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Bot mode">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => !disabled && onChange(mode.value)}
          disabled={disabled}
          className={`relative flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-fast ${
            value === mode.value
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-surface-border hover:border-surface-border-strong'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          role="radio"
          aria-checked={value === mode.value}
        >
          <div
            className={`p-2 rounded-lg ${
              value === mode.value
                ? 'bg-primary-500 text-white'
                : 'bg-surface-tertiary text-text-secondary'
            }`}
          >
            {renderIcon(mode.icon, 20)}
          </div>
          <span className="font-medium text-text-primary">{mode.label}</span>
          <span className="text-xs text-text-tertiary text-center px-2">{mode.description}</span>
        </button>
      ))}
    </div>
  );
});

// ============================================
// Code Editor (Advanced Mode)
// ============================================

const CodeEditor = memo(function CodeEditor({
  code,
  onChange,
  onValidate,
  readOnly = false,
}: {
  code: string;
  onChange: (code: string) => void;
  onValidate: (errors: ValidationError[]) => void;
  readOnly?: boolean;
}) {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Simple validation for TypeScript code
  useEffect(() => {
    const validationErrors: ValidationError[] = [];

    // Check for basic structure
    if (!code.trim()) {
      validationErrors.push({
        field: 'code',
        message: 'Code cannot be empty',
        severity: 'error',
      });
    } else {
      // Check for required exports
      if (!code.includes('export default') && !code.includes('export {')) {
        validationErrors.push({
          field: 'code',
          message: 'Code must export a default handler function',
          severity: 'error',
        });
      }

      // Check for async handler
      if (!code.includes('async') && code.includes('export')) {
        validationErrors.push({
          field: 'code',
          message: 'Handler function should be async',
          severity: 'warning',
        });
      }
    }

    setErrors(validationErrors);
    onValidate(validationErrors);
  }, [code, onValidate]);

  const template = `import { BotContext, BotHandler } from 'nexora-bots';

interface MyBotConfig {
  // Your config type here
}

const handler: BotHandler<MyBotConfig> = async (context, config) => {
  // Your bot logic here
  const { event, client, utils, log } = context;

  // Example: Respond to messages
  if (event.type === 'message_create') {
    const message = event.data;
    if (message.content === '!ping') {
      await client.sendMessage(message.channel_id, 'Pong! 🏓');
    }
  }
};

export default handler;`;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-surface-border">
        <h3 className="font-medium text-text-primary">Code Editor</h3>
        <div className="flex items-center gap-2">
          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-danger-500">
              {renderIcon('AlertCircle', 12)}
              {errors.filter((e) => e.severity === 'error').length} error(s)
            </span>
          )}
          <button
            onClick={() => {
              onChange(template);
              setErrors([]);
            }}
            className="btn btn-secondary btn-sm"
            disabled={readOnly}
          >
            Load Template
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          className="w-full h-full font-mono text-sm p-4 bg-surface-primary border-none resize-none outline-none text-text-primary placeholder-text-tertiary"
          placeholder="// TypeScript code editor (Monaco would be here)\n// Paste your bot code here..."
          spellCheck={false}
        />
        {errors.length > 0 && (
          <div className="absolute bottom-0 right-0 m-4 p-3 bg-surface-secondary border border-danger-500/30 rounded-xl shadow-xl max-w-xs max-h-40 overflow-y-auto">
            <div className="flex items-center gap-2 text-xs text-danger-500 mb-2">
              {renderIcon('AlertCircle', 14)}
              <span className="font-medium">Validation Issues</span>
            </div>
            <ul className="space-y-1 text-xs text-text-secondary">
              {errors.map((err, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-danger-500">•</span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================
// Steps Indicator
// ============================================

type WizardStep = 'template' | 'details' | 'build';

const STEP_LABELS: Record<WizardStep, string> = {
  template: 'Modelo',
  details: 'Detalhes',
  build: 'Montar',
};

const StepsIndicator = memo(function StepsIndicator({
  steps,
  current,
  onGoTo,
}: {
  steps: WizardStep[];
  current: WizardStep;
  onGoTo: (step: WizardStep) => void;
}) {
  const currentIndex = steps.indexOf(current);
  return (
    <ol className="flex items-center gap-2" aria-label="Progresso da criação">
      {steps.map((step, i) => {
        const isCurrent = step === current;
        const isDone = i < currentIndex;
        const isClickable = i < currentIndex;
        return (
          <li key={step} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onGoTo(step)}
              className={`flex items-center gap-2 rounded-lg px-1 py-0.5 ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-primary-500 text-white'
                    : isDone
                    ? 'bg-success-500 text-white'
                    : 'bg-surface-tertiary text-text-tertiary'
                }`}
              >
                {isDone ? renderIcon('Check', 14) : i + 1}
              </span>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isCurrent ? 'text-text-primary' : 'text-text-tertiary'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={`flex-1 h-0.5 rounded mx-1 transition-colors ${
                  isDone || isCurrent ? 'bg-primary-500/60' : 'bg-surface-border'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
});

// ============================================
// Bot Editor Modal (Wizard)
// ============================================

interface BotEditorModalProps {
  bot: Bot | null; // null for create
  isOpen: boolean;
  onClose: () => void;
  onSave: (bot: Partial<Bot> & { mode: BotMode }) => Promise<void>;
  availableNodes?: NodeDefinition[];
  saving?: boolean;
}

export const BotEditorModal = memo(function BotEditorModal({
  bot,
  isOpen,
  onClose,
  onSave,
  availableNodes,
  saving = false,
}: BotEditorModalProps) {
  const isEditing = !!bot;

  const [step, setStep] = useState<WizardStep>(bot ? 'details' : 'template');
  const [templateId, setTemplateId] = useState<TemplateChoice | null>(null);
  const [mode, setMode] = useState<BotMode>(bot?.mode || 'simple');
  const [name, setName] = useState(bot?.name || '');
  const [description, setDescription] = useState(bot?.description || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(bot?.avatarUrl || null);
  const [flow, setFlow] = useState<BotFlow | null>(bot?.flow || null);
  const [code, setCode] = useState(bot?.code || '');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saveBlocked, setSaveBlocked] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(bot ? 'details' : 'template');
      setTemplateId(null);
      setMode(bot?.mode || 'simple');
      setName(bot?.name || '');
      setDescription(bot?.description || '');
      setAvatarUrl(bot?.avatarUrl || null);
      setFlow(bot?.flow || null);
      setCode(bot?.code || '');
      setErrors([]);
      setSaveBlocked(null);
    }
  }, [isOpen, bot]);

  const steps: WizardStep[] = isEditing ? ['details', 'build'] : ['template', 'details', 'build'];

  const handleValidate = useCallback((newErrors: ValidationError[]) => {
    setErrors(newErrors);
  }, []);

  const handleFlowChange = useCallback((newFlow: BotFlow) => {
    setFlow(newFlow);
    setSaveBlocked(null);
  }, []);

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setSaveBlocked(null);
  }, []);

  const handleTemplateSelect = useCallback(
    (id: TemplateChoice) => {
      setTemplateId(id);
      if (id === 'blank') {
        setFlow(null);
      } else {
        const template = getBotTemplate(id);
        if (template) {
          setFlow(template.build());
          setName((prev) => prev.trim() || template.suggestedName);
        }
      }
      setErrors([]);
      setSaveBlocked(null);
      setStep('details');
    },
    []
  );

  const handleSave = useCallback(async () => {
    const validationErrors: ValidationError[] = [];

    if (!name.trim()) {
      validationErrors.push({ field: 'name', message: 'Dê um nome para o bot', severity: 'error' });
    }

    if (mode === 'advanced' && !code.trim()) {
      validationErrors.push({ field: 'code', message: 'O código não pode estar vazio', severity: 'error' });
    }

    const flowErrors = errors.filter((e) => e.severity === 'error');
    if (mode === 'simple' && flowErrors.length > 0) {
      setSaveBlocked(
        `Faltam ${flowErrors.length} ajuste(s) no fluxo (veja os avisos no canvas). Complete os campos obrigatórios antes de salvar.`
      );
      return;
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSaveBlocked(validationErrors[0].message);
      if (validationErrors[0].field === 'name') setStep('details');
      return;
    }

    setSaveBlocked(null);
    const botData: Partial<Bot> & { mode: BotMode } = {
      name: name.trim(),
      description: description.trim(),
      avatarUrl,
      mode,
      flow: mode === 'simple' ? flow : null,
      code: mode === 'advanced' ? code : null,
    };

    await onSave(botData);
  }, [name, description, avatarUrl, mode, flow, code, errors, onSave]);

  if (!isOpen) return null;

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;
  const nodeCount = flow?.nodes.length ?? 0;
  const isBuildStep = step === 'build';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className={`modal-content w-full ${isBuildStep ? 'max-w-6xl' : 'max-w-3xl'} max-h-[92vh]`}>
        {/* Header */}
        <div className="modal-header flex-col items-stretch gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="editor-title" className="text-lg font-semibold text-text-primary">
                {isEditing ? 'Editar bot' : 'Criar bot'}
              </h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                {isEditing
                  ? 'Ajuste os detalhes ou o fluxo — as mudanças valem na próxima execução.'
                  : 'Em 3 passos: escolha um começo, dê identidade e monte o comportamento.'}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" aria-label="Fechar">
              {renderIcon('X', 20)}
            </button>
          </div>
          <StepsIndicator steps={steps} current={step} onGoTo={setStep} />
        </div>

        {/* Body */}
        <div className="modal-body flex flex-col min-h-0" style={{ maxHeight: isBuildStep ? '74vh' : '66vh' }}>
          {/* Step: Template */}
          {step === 'template' && (
            <div className="flex-1 overflow-y-auto" role="tabpanel" aria-label="Escolher modelo">
              <BotTemplatePicker selectedId={templateId} onSelect={handleTemplateSelect} />
            </div>
          )}

          {/* Step: Details */}
          {step === 'details' && (
            <div className="flex-1 overflow-y-auto" role="tabpanel" aria-label="Detalhes do bot">
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div>
                    <span className="label">Avatar</span>
                    <AvatarUpload
                      src={avatarUrl}
                      onChange={setAvatarUrl}
                      onRemove={() => setAvatarUrl(null)}
                      size={88}
                    />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="label label-required" htmlFor="bot-name">Nome</label>
                      <input
                        id="bot-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex.: Recepção, Sentinela, DJ"
                        className={`input ${errors.some((e) => e.field === 'name') ? 'input-error' : ''}`}
                        maxLength={100}
                        autoFocus
                      />
                      {errors.some((e) => e.field === 'name') && (
                        <p className="text-xs text-danger-500 mt-1 ml-1">
                          {errors.find((e) => e.field === 'name')?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label" htmlFor="bot-desc">Descrição</label>
                      <textarea
                        id="bot-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="O que esse bot faz no servidor?"
                        className="input min-h-[72px] resize-y"
                        maxLength={500}
                        rows={3}
                      />
                      <p className="text-xs text-text-tertiary mt-1">{description.length}/500</p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="label label-required">Como montar</span>
                  <ModeSelector value={mode} onChange={setMode} />
                </div>
              </div>
            </div>
          )}

          {/* Step: Build */}
          {step === 'build' && (
            <div className="flex-1 flex flex-col min-h-0" role="tabpanel" aria-label="Montar comportamento">
              {/* Build status bar */}
              <div className="flex items-center gap-3 px-1 pb-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-surface-tertiary rounded-full px-2.5 py-1">
                  {renderIcon(mode === 'simple' ? 'Zap' : 'Code2', 12)}
                  {mode === 'simple' ? `${nodeCount} nó(s)` : `${code.split('\n').length} linha(s)`}
                </span>
                {mode === 'simple' && errorCount === 0 && warningCount === 0 && nodeCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-500 bg-success-500/10 rounded-full px-2.5 py-1">
                    {renderIcon('Check', 12)}
                    Fluxo válido
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-500 bg-danger-500/10 rounded-full px-2.5 py-1">
                    {renderIcon('AlertCircle', 12)}
                    {errorCount} erro(s) pra corrigir
                  </span>
                )}
                {warningCount > 0 && errorCount === 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary bg-surface-tertiary rounded-full px-2.5 py-1">
                    {renderIcon('Info', 12)}
                    {warningCount} aviso(s)
                  </span>
                )}
                {mode === 'simple' && nodeCount === 0 && (
                  <span className="text-xs text-text-tertiary">
                    Arraste nós da lateral para o canvas e ligue uns nos outros.
                  </span>
                )}
              </div>

              <div className={mode === 'simple' ? 'flex-1 min-h-[52vh] rounded-xl overflow-hidden border border-surface-border' : 'flex-1 min-h-[52vh] rounded-xl overflow-hidden border border-surface-border flex flex-col'}>
                {mode === 'simple' ? (
                  <ReactFlowProvider>
                    <BotFlowEditor
                      initialFlow={flow || undefined}
                      readOnly={false}
                      onChange={handleFlowChange}
                      onValidate={handleValidate}
                      availableNodes={availableNodes}
                    />
                  </ReactFlowProvider>
                ) : (
                  <CodeEditor
                    code={code}
                    onChange={handleCodeChange}
                    onValidate={handleValidate}
                    readOnly={false}
                  />
                )}
              </div>

              {saveBlocked && (
                <p className="flex items-center gap-2 text-xs text-danger-500 bg-danger-500/10 border border-danger-500/20 rounded-lg px-3 py-2 mt-3" role="alert">
                  {renderIcon('AlertCircle', 14)}
                  {saveBlocked}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === 'template' && (
            <>
              <button onClick={onClose} className="btn btn-secondary">
                Cancelar
              </button>
              <span className="text-xs text-text-tertiary mr-auto ml-2 hidden sm:inline">
                Escolha um modelo para continuar — dá pra mudar tudo depois.
              </span>
            </>
          )}
          {step === 'details' && (
            <>
              {!isEditing && (
                <button onClick={() => setStep('template')} className="btn btn-secondary mr-auto">
                  {renderIcon('ChevronLeft', 14)} Modelo
                </button>
              )}
              {isEditing && <span className="mr-auto" />}
              <button onClick={onClose} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={() => setStep('build')} className="btn btn-primary">
                Montar {renderIcon('ChevronRight', 14)}
              </button>
            </>
          )}
          {step === 'build' && (
            <>
              <button onClick={() => setStep('details')} className="btn btn-secondary mr-auto">
                {renderIcon('ChevronLeft', 14)} Detalhes
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    {renderIcon('Loader2', 14, 'currentColor', 'animate-spin')} Salvando...
                  </>
                ) : (
                  <>
                    {renderIcon('Save', 14)} Salvar bot
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

BotEditorModal.displayName = 'BotEditorModal';
