/**
 * Nexora Bots - Bot Editor Modal
 * Modal for creating/editing bots with Simple (Visual Flow) and Advanced (Code) modes
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Bot,
  BotMode,
  BotFlow,
  ValidationError,
} from '@/types/bots';
import { BotFlowEditor } from '@/components/flow/BotFlowEditor';
import { renderIcon } from '@/components/flow/nodes/FlowNodes';

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
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
      label: 'Simple',
      icon: 'Zap',
      description: 'Visual flow editor with drag & drop',
    },
    {
      value: 'advanced',
      label: 'Advanced',
      icon: 'Code2',
      description: 'Write TypeScript code directly',
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

  // Load Monaco Editor dynamically
  useEffect(() => {
    const loadMonaco = async () => {
      try {
        // In a real app, you'd import monaco-editor properly
        // For now, we'll use a textarea fallback
        console.log('Monaco Editor would be loaded here');
      } catch (err) {
        console.error('Failed to load Monaco:', err);
      }
    };
    loadMonaco();
  }, []);

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
        {/* Monaco Editor would go here */}
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          className="w-full h-full font-mono text-sm p-4 bg-surface-primary border-none resize-none outline-none text-text-primary placeholder-text-tertiary"
          placeholder="// TypeScript code editor (Monaco would be here)\n// Paste your bot code here..."
          spellCheck={false}
        />
        {errors.length > 0 && (
          <div className="absolute bottom-0 right-0 m-4 p-3 bg-surface-secondary border border-danger-500/30 rounded-lg shadow-xl max-w-xs max-h-40 overflow-y-auto">
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
// Bot Editor Modal
// ============================================

interface BotEditorModalProps {
  bot: Bot | null; // null for create
  isOpen: boolean;
  onClose: () => void;
  onSave: (bot: Partial<Bot> & { mode: BotMode }) => Promise<void>;
  availableNodes?: any[];
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
  const [mode, setMode] = useState<BotMode>(bot?.mode || 'simple');
  const [name, setName] = useState(bot?.name || '');
  const [description, setDescription] = useState(bot?.description || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(bot?.avatarUrl || null);
  const [flow, setFlow] = useState<BotFlow | null>(bot?.flow || null);
  const [code, setCode] = useState(bot?.code || '');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [activeTab, setActiveTab] = useState<'basic' | 'flow' | 'code'>('basic');

  const isEditing = !!bot;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode(bot?.mode || 'simple');
      setName(bot?.name || '');
      setDescription(bot?.description || '');
      setAvatarUrl(bot?.avatarUrl || null);
      setFlow(bot?.flow || null);
      setCode(bot?.code || '');
      setErrors([]);
      setActiveTab('basic');
    }
  }, [isOpen, bot]);

  const handleValidate = useCallback((newErrors: ValidationError[]) => {
    setErrors(newErrors);
  }, []);

  const handleFlowChange = useCallback((newFlow: BotFlow) => {
    setFlow(newFlow);
  }, []);

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  const handleSave = useCallback(async () => {
    // Validate
    const validationErrors: ValidationError[] = [];

    if (!name.trim()) {
      validationErrors.push({ field: 'name', message: 'Name is required', severity: 'error' });
    }

    if (mode === 'simple' && flow) {
      // Flow validation happens in BotFlowEditor
    }

    if (mode === 'advanced' && !code.trim()) {
      validationErrors.push({ field: 'code', message: 'Code is required for advanced mode', severity: 'error' });
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setActiveTab('basic');
      return;
    }

    const botData: Partial<Bot> & { mode: BotMode } = {
      name: name.trim(),
      description: description.trim(),
      avatarUrl,
      mode,
      flow: mode === 'simple' ? flow : null,
      code: mode === 'advanced' ? code : null,
    };

    await onSave(botData);
  }, [name, description, avatarUrl, mode, flow, code, onSave]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="modal-content w-full max-w-4xl max-h-[90vh]">
        {/* Header */}
        <div className="modal-header">
          <h2 id="editor-title" className="text-lg font-semibold text-text-primary">
            {isEditing ? 'Edit Bot' : 'Create Bot'}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" aria-label="Close">
              {renderIcon('X', 20)}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-surface-border">
            {['basic', 'flow', 'code'].map((step, i) => {
              
              const isActive = activeTab === step;
              const isCompleted = ['basic', 'flow', 'code'].indexOf(activeTab) > i;
              return (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex-1 h-1 rounded transition-colors ${
                      isActive || isCompleted ? 'bg-primary-500' : 'bg-surface-border'
                    }`}
                  />
                  {i < 2 && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-500 text-white'
                          : isCompleted
                          ? 'bg-success-500 text-white'
                          : 'bg-surface-tertiary text-text-tertiary'
                      }`}
                    >
                      {isCompleted ? renderIcon('CheckCircle', 14) : i + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tab Panels */}
          <div className="flex-1 overflow-y-auto">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6" role="tabpanel" aria-labelledby="basic-tab">
                <div>
                  <h3 className="text-sm font-medium text-text-secondary mb-4">Basic Information</h3>

                  <div className="space-y-4">
                    {/* Avatar */}
                    <div>
                      <label className="label">Avatar</label>
                      <AvatarUpload
                        src={avatarUrl}
                        onChange={setAvatarUrl}
                        onRemove={() => setAvatarUrl(null)}
                        size={96}
                      />
                      <p className="text-xs text-text-tertiary mt-1">
                        Recommended: 256x256px, max 5MB. PNG, JPG, or WebP.
                      </p>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="label label-required">Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter bot name"
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

                    {/* Description */}
                    <div>
                      <label className="label">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what this bot does..."
                        className="input min-h-[80px] resize-y"
                        maxLength={500}
                        rows={3}
                      />
                      <p className="text-xs text-text-tertiary mt-1">{description.length}/500</p>
                    </div>

                    {/* Mode Selector */}
                    <div>
                      <label className="label label-required">Mode</label>
                      <ModeSelector value={mode} onChange={setMode} />
                      <p className="text-xs text-text-tertiary mt-1">
                        {mode === 'simple'
                          ? 'Visual flow editor with drag-and-drop nodes'
                          : 'Full TypeScript code editor with IntelliSense'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-end pt-4 border-t border-surface-border">
                  <button
                    onClick={() => setActiveTab(mode === 'simple' ? 'flow' : 'code')}
                    className="btn btn-primary"
                    disabled={errors.some((e) => e.field === 'name' && e.severity === 'error')}
                  >
                    Continue {renderIcon(mode === 'simple' ? 'Zap' : 'Code2', 14)}
                  </button>
                </div>
              </div>
            )}

            {/* Flow Editor Tab (Simple Mode) */}
            {activeTab === 'flow' && mode === 'simple' && (
              <div className="h-[500px]" role="tabpanel" aria-labelledby="flow-tab">
                <BotFlowEditor
                  initialFlow={flow || undefined}
                  readOnly={false}
                  onChange={handleFlowChange}
                  onValidate={handleValidate}
                  availableNodes={availableNodes}
                />
                <div className="flex justify-end pt-4 border-t border-surface-border mt-4">
                  <button onClick={() => setActiveTab('basic')} className="btn btn-secondary mr-2">
                    {renderIcon('X', 14)} Back
                  </button>
                  <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        {renderIcon('Loader2', 14, 'animate-spin')} Saving...
                      </>
                    ) : (
                      <>
                        {renderIcon('Save', 14)} Save Bot
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Code Editor Tab (Advanced Mode) */}
            {activeTab === 'code' && mode === 'advanced' && (
              <div className="h-[500px]" role="tabpanel" aria-labelledby="code-tab">
                <CodeEditor
                  code={code}
                  onChange={handleCodeChange}
                  onValidate={handleValidate}
                  readOnly={false}
                />
                <div className="flex justify-end pt-4 border-t border-surface-border mt-4">
                  <button onClick={() => setActiveTab('basic')} className="btn btn-secondary mr-2">
                    {renderIcon('X', 14)} Back
                  </button>
                  <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        {renderIcon('Loader2', 14, 'animate-spin')} Saving...
                      </>
                    ) : (
                      <>
                        {renderIcon('Save', 14)} Save Bot
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Mode mismatch - show message to switch mode */}
            {(activeTab === 'flow' && mode === 'advanced') && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  {renderIcon('Code2', 48, 'var(--color-text-tertiary)')}
                  <h3 className="text-lg font-medium text-text-primary mt-4">Advanced Mode</h3>
                  <p className="text-text-tertiary mt-2">Switch to Advanced mode to edit code</p>
                  <button onClick={() => setMode('advanced')} className="btn btn-primary mt-4">
                    Switch to Advanced
                  </button>
                </div>
              </div>
            )}

            {(activeTab === 'code' && mode === 'simple') && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  {renderIcon('Zap', 48, 'var(--color-text-tertiary)')}
                  <h3 className="text-lg font-medium text-text-primary mt-4">Simple Mode</h3>
                  <p className="text-text-tertiary mt-2">Switch to Simple mode to use visual flow editor</p>
                  <button onClick={() => setMode('simple')} className="btn btn-primary mt-4">
                    Switch to Simple
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer (for basic tab) */}
        {activeTab === 'basic' && (
          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => setActiveTab(mode === 'simple' ? 'flow' : 'code')}
              className="btn btn-primary"
              disabled={errors.some((e) => e.field === 'name' && e.severity === 'error')}
            >
              Continue {renderIcon(mode === 'simple' ? 'Zap' : 'Code2', 14)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

BotEditorModal.displayName = 'BotEditorModal';