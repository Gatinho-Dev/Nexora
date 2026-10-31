/**
 * Nexora Bots - Node Configuration Sidebar
 * Right sidebar for configuring selected node properties
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { NodeDefinition, ConfigField, FlowNode, SelectOption, NodeData } from '@/types/bots';
import { renderIcon } from '@/components/flow/nodes/FlowNodes';

// ============================================
// Field Components
// ============================================

const FieldLabel = memo(function FieldLabel({
  label,
  required,
  description,
  error,
}: {
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
}) {
  return (
    <div className="mb-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="text-danger-500" aria-hidden="true">*</span>}
        {description && (
          <Info className="w-4 h-4 text-text-tertiary hover:text-text-secondary cursor-help transition-colors" />
        )}
      </label>
      {description && (
        <p className="text-xs text-text-tertiary mt-0.5 ml-1">{description}</p>
      )}
      {error && (
        <p className="text-xs text-danger-500 mt-0.5 ml-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
});

const TextInput = memo(function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  error,
  type = 'text',
  multiline = false,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  type?: 'text' | 'password' | 'number';
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div className="relative">
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`input ${error ? 'input-error' : ''} ${disabled ? 'opacity-50' : ''} font-mono text-xs`}
          spellCheck={false}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`input ${error ? 'input-error' : ''} ${disabled ? 'opacity-50' : ''}`}
          spellCheck={false}
        />
      )}
    </div>
  );
});

const SelectInput = memo(function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
  searchable = false,
  multiple = false,
}: {
  value: string | string[] | number | number[] | null;
  onChange: (value: string | string[] | number | number[] | null) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  searchable?: boolean;
  multiple?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        String(opt.value).toLowerCase().includes(query) ||
        opt.description?.toLowerCase().includes(query)
    );
  }, [options, searchQuery, searchable]);

  const handleSelect = (option: SelectOption) => {
    if (multiple) {
      const current = (Array.isArray(value) ? value : []) as (string | number)[];
      const newValue = current.includes(option.value)
        ? current.filter((v) => v !== option.value)
        : [...current, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  };

  const displayValue = useMemo(() => {
    if (value === null || value === undefined || value === '') return null;
    if (multiple && Array.isArray(value)) {
      return value
        .map((v) => options.find((o) => o.value === v)?.label)
        .filter(Boolean)
        .join(', ');
    }
    return options.find((o) => o.value === value)?.label || String(value);
  }, [value, options, multiple]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full input ${error ? 'input-error' : ''} ${disabled ? 'opacity-50' : ''} text-left justify-between pr-10`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
      >
        <span className={displayValue ? 'text-text-primary' : 'text-text-tertiary'}>
          {displayValue || placeholder || 'Select...'}
        </span>
        {isOpen ? renderIcon('ChevronUp', 16) : renderIcon('ChevronDown', 16)}
      </button>

      {isOpen && (
        <div className="absolute z-dropdown top-full left-0 right-0 mt-1 bg-surface-secondary border border-surface-border rounded-lg shadow-xl max-h-60 overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-surface-border">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="input input-sm"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-[300px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-text-tertiary text-sm">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-hover transition-colors ${
                    multiple && Array.isArray(value) && value.includes(option.value)
                      ? 'bg-primary-500/10 text-primary-500'
                      : !multiple && value === option.value
                      ? 'bg-primary-500/10 text-primary-500'
                      : 'text-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-text-tertiary ml-auto">{option.description}</span>
                    )}
                    {multiple && Array.isArray(value) && value.includes(option.value) && (
                      <CheckCircle className="w-4 h-4 text-primary-500" />
                    )}
                    {!multiple && value === option.value && (
                      <CheckCircle className="w-4 h-4 text-primary-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

const BooleanInput = memo(function BooleanInput({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="toggle" style={{ width: '48px', height: '26px' }}>
      <input
        type="checkbox"
        className="toggle-input"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track w-full h-full" />
      <span className="toggle-thumb" />
    </label>
  );
});

const CodeInput = memo(function CodeInput({
  value,
  onChange,
  placeholder,
  disabled,
  error,
  language = 'javascript',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  language?: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-tertiary uppercase tracking-wide">{language}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(value)}
            className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Copy code"
          >
            {renderIcon('Copy', 14)}
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={8}
        spellCheck={false}
        className={`code-block ${error ? 'border-danger-500' : ''} ${disabled ? 'opacity-50' : ''} font-mono text-xs resize-y min-h-[200px]`}
      />
    </div>
  );
});

const NumberInput = memo(function NumberInput({
  value,
  onChange,
  placeholder,
  disabled,
  error,
  min,
  max,
  step = 1,
}: {
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={`input ${error ? 'input-error' : ''} ${disabled ? 'opacity-50' : ''} w-32`}
      />
    </div>
  );
});

const JsonInput = memo(function JsonInput({
  value,
  onChange,
  placeholder,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}) {
  const [isValid, setIsValid] = useState(true);
  const [parsed, setParsed] = useState<unknown>(null);

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      try {
        const parsedValue = newValue ? JSON.parse(newValue) : null;
        setParsed(parsedValue);
        setIsValid(true);
      } catch {
        setIsValid(false);
        setParsed(null);
      }
    },
    [onChange]
  );

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-tertiary uppercase tracking-wide">JSON</span>
        <div className="flex items-center gap-1.5">
          {!disabled && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(value)}
              className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
              aria-label="Copy JSON"
            >
              {renderIcon('Copy', 14)}
            </button>
          )}
          <span
            className={`w-2 h-2 rounded-full ${
              isValid ? 'bg-success-500' : 'bg-danger-500'
            }`}
            title={isValid ? 'Valid JSON' : 'Invalid JSON'}
          />
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
        spellCheck={false}
        className={`code-block ${!isValid || error ? 'border-danger-500' : ''} ${disabled ? 'opacity-50' : ''} font-mono text-xs resize-y min-h-[150px]`}
      />
      {!isValid && (
        <p className="text-xs text-danger-500 mt-1 ml-1 flex items-center gap-1">
          {renderIcon('AlertCircle', 12, 'var(--color-danger-500)')}
          Invalid JSON format
        </p>
      )}
    </div>
  );
});

const CronInput = memo(function CronInput({
  value,
  onChange,
  placeholder,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}) {
  // Simple cron validation
  const isValid = useMemo(() => {
    if (!value) return true;
    const parts = value.trim().split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'e.g., 0 * * * *'}
        disabled={disabled}
        className={`input ${!isValid || error ? 'input-error' : ''} ${disabled ? 'opacity-50' : ''} font-mono`}
      />
      {!isValid && value && (
        <p className="text-xs text-danger-500 mt-1 ml-1 flex items-center gap-1">
          {renderIcon('AlertCircle', 12, 'var(--color-danger-500)')}
          Invalid cron expression (expected 5 or 6 fields)
        </p>
      )}
      <div className="mt-2 p-2 bg-surface-tertiary/50 rounded text-xs text-text-tertiary font-mono">
        <div className="flex gap-4 text-xs">
          <span>min</span>
          <span>hour</span>
          <span>day</span>
          <span>month</span>
          <span>weekday</span>
          <span className="text-text-tertiary/50">(year)</span>
        </div>
        <div className="flex gap-4 mt-1 text-xs">
          <span>0-59</span>
          <span>0-23</span>
          <span>1-31</span>
          <span>1-12</span>
          <span>0-6</span>
          <span className="text-text-tertiary/50">optional</span>
        </div>
      </div>
    </div>
  );
});

// ============================================
// Field Renderer
// ============================================

const FieldRenderer = memo(function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
  errors,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}) {
  const fieldError = errors?.[field.key];
  const handleChange = (newValue: unknown) => onChange(field.key, newValue);

  switch (field.type) {
    case 'text':
      return (
        <TextInput
          value={String(value || '')}
          onChange={handleChange as (v: string) => void}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
        />
      );

    case 'textarea':
      return (
        <TextInput
          value={String(value || '')}
          onChange={handleChange as (v: string) => void}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
          multiline
          rows={4}
        />
      );

    case 'number':
      return (
        <NumberInput
          value={value as number | ''}
          onChange={handleChange as (v: number | '') => void}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
        />
      );

    case 'boolean':
      return (
        <BooleanInput
          value={Boolean(value)}
          onChange={handleChange as (v: boolean) => void}
          disabled={disabled}
        />
      );

    case 'select':
      return (
        <SelectInput
          value={value as string | number | null}
          onChange={handleChange as (v: string | number | null) => void}
          options={field.options || []}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
          searchable={(field.options || []).length > 10}
        />
      );

    case 'multiselect':
      return (
        <SelectInput
          value={value as string[] | number[] | null}
          onChange={handleChange as (v: string[] | number[] | null) => void}
          options={field.options || []}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
          multiple
          searchable
        />
      );

    case 'channel':
      return (
        <SelectInput
          value={value as string | null}
          onChange={handleChange as (v: string | null) => void}
          options={[
            { value: '', label: 'Use Trigger Channel', description: 'Automatically use the channel from the trigger' },
            ...(field.options || []),
          ]}
          placeholder={field.placeholder || 'Select channel...'}
          disabled={disabled}
          error={fieldError}
          searchable
        />
      );

    case 'role':
      return (
        <SelectInput
          value={value as string | null}
          onChange={handleChange as (v: string | null) => void}
          options={field.options || []}
          placeholder={field.placeholder || 'Select role...'}
          disabled={disabled}
          error={fieldError}
          searchable
        />
      );

    case 'user':
      return (
        <SelectInput
          value={value as string | null}
          onChange={handleChange as (v: string | null) => void}
          options={[
            { value: '', label: 'Use Trigger User', description: 'Automatically use the user from the trigger' },
            ...(field.options || []),
          ]}
          placeholder={field.placeholder || 'Select user...'}
          disabled={disabled}
          error={fieldError}
          searchable
        />
      );

    case 'code':
      return (
        <CodeInput
          value={String(value || '')}
          onChange={handleChange as (v: string) => void}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
        />
      );

    case 'json':
      return (
        <JsonInput
          value={String(value || '')}
          onChange={handleChange as (v: string) => void}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
        />
      );

    case 'cron':
      return (
        <CronInput
          value={String(value || '')}
          onChange={handleChange as (v: string) => void}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
        />
      );

    default:
      return (
        <TextInput
          value={String(value || '')}
          onChange={handleChange as (v: string) => void}
          placeholder={field.placeholder}
          disabled={disabled}
          error={fieldError}
        />
      );
  }
});

// ============================================
// Node Config Sidebar
// ============================================

interface NodeConfigSidebarProps {
  node: FlowNode | null;
  nodeDefinition: NodeDefinition | null;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  validationErrors?: Record<string, string>;
}

export const NodeConfigSidebar = memo(function NodeConfigSidebar({
  node,
  nodeDefinition,
  onUpdate,
  onClose,
  onDeleteNode,
  onDuplicateNode,
  validationErrors = {},
}: NodeConfigSidebarProps) {
  if (!node || !nodeDefinition) {
    return (
      <div className="flex flex-col h-full bg-surface-secondary border-l border-surface-border">
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <h3 className="font-medium text-text-primary">Node Configuration</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" aria-label="Close sidebar">
            {renderIcon('X', 20)}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center text-text-tertiary">
              {renderIcon('Settings', 32)}
            </div>
            <p className="text-text-secondary">Select a node to configure</p>
            <p className="text-text-tertiary text-sm mt-1">Click on any node in the canvas to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  const config = (node.data.config || {}) as Record<string, unknown>;
  const category = nodeDefinition.category;

  const categoryIcons: Record<string, string> = {
    trigger: 'Zap',
    action: 'Send',
    logic: 'GitBranch',
  };

  const categoryColors: Record<string, string> = {
    trigger: '#3ba55c',
    action: '#5865f2',
    logic: '#faa61a',
  };

  const categoryColor = categoryColors[category] || '#5865f2';

  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      onUpdate(node.id, { ...config, [key]: value });
    },
    [node.id, config, onUpdate]
  );

  // Get visible fields based on dependencies
  const visibleFields = useMemo(() => {
    return nodeDefinition.configSchema.filter((field) => {
      if (!field.showWhen) return true;
      try {
        return field.showWhen(config);
      } catch {
        return true;
      }
    });
  }, [nodeDefinition.configSchema, config]);

  return (
    <div className="flex flex-col h-full bg-surface-secondary border-l border-surface-border">
      {/* Header */}
      <div className="p-4 border-b border-surface-border">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 p-2 rounded-lg"
            style={{ background: `${categoryColor}20`, color: categoryColor }}
          >
            {renderIcon(categoryIcons[category] || 'Settings', 20, categoryColor)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-text-primary truncate">{node.data.label}</h3>
              <span
                className={`badge ${category === 'trigger' ? 'badge-success' : category === 'action' ? 'badge-primary' : 'badge-warning'}`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5 truncate">{nodeDefinition.label}</p>
          </div>
        </div>

        {/* Node Actions */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-surface-border">
          {onDuplicateNode && (
            <button
              onClick={() => onDuplicateNode(node.id)}
              className="flex-1 btn btn-secondary btn-sm"
              title="Duplicate node"
            >
              <span className="flex items-center gap-1.5">
                {renderIcon('Copy', 14)}
                Duplicate
              </span>
            </button>
          )}
          {onDeleteNode && (
            <button
              onClick={() => onDeleteNode(node.id)}
              className="flex-1 btn btn-danger btn-sm"
              title="Delete node"
            >
              <span className="flex items-center gap-1.5">
                {renderIcon('Trash2', 14)}
                Delete
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Config Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleFields.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary">
            <p>No configuration options for this node</p>
            <p className="text-xs mt-1">This node works with default settings</p>
          </div>
        ) : (
          <>
            {visibleFields.map((field) => (
              <div
                key={field.key}
                className={`animate-fade-in ${field.dependsOn ? 'ml-4 border-l-2 border-surface-border pl-3' : ''}`}
              >
                <FieldLabel
                  label={field.label}
                  required={field.required}
                  description={field.description}
                  error={validationErrors[field.key]}
                />
                <FieldRenderer
                  field={field}
                  value={config[field.key] ?? field.defaultValue}
                  onChange={handleConfigChange}
                  disabled={field.required && false} // Could add logic to disable required fields
                  errors={validationErrors}
                />
              </div>
            ))}

            {/* Inputs/Outputs Info */}
            {nodeDefinition.inputs.length > 0 || nodeDefinition.outputs.length > 0 && (
              <div className="pt-4 border-t border-surface-border space-y-3">
                {nodeDefinition.inputs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      {renderIcon('Database', 12)}
                      Inputs
                    </h4>
                    <div className="space-y-1">
                      {nodeDefinition.inputs.map((input) => (
                        <div
                          key={input.id}
                          className="flex items-center gap-2 text-xs text-text-secondary px-2 py-1.5 rounded bg-surface-tertiary/50"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              background:
                                input.type === 'execution'
                                  ? categoryColor
                                  : 'var(--color-text-tertiary)',
                            }}
                          />
                          <span className="font-mono text-text-tertiary">{input.type}</span>
                          <span className="font-medium text-text-primary">{input.name}</span>
                          {input.required && (
                            <span className="text-danger-500">*</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {nodeDefinition.outputs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      {renderIcon('Zap', 12)}
                      Outputs
                    </h4>
                    <div className="space-y-1">
                      {nodeDefinition.outputs.map((output) => (
                        <div
                          key={output.id}
                          className="flex items-center gap-2 text-xs text-text-secondary px-2 py-1.5 rounded bg-surface-tertiary/50"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              background:
                                output.type === 'execution'
                                  ? categoryColor
                                  : 'var(--color-text-tertiary)',
                            }}
                          />
                          <span className="font-mono text-text-tertiary">{output.type}</span>
                          <span className="font-medium text-text-primary">{output.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface-border bg-surface-tertiary/50">
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>Node ID: <code className="font-mono text-text-secondary">{node.id.slice(0, 8)}...</code></span>
          <span>Type: <code className="font-mono text-text-secondary">{nodeDefinition.type}</code></span>
        </div>
      </div>
    </div>
  );
});